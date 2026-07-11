import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_utils/db.js';
import { sendTelegramNotification } from '../_utils/telegram.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-id');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = req.headers['x-user-id'] as string;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: missing user context' });
  }

  try {
    const { planTier, paymentMethod, transactionCode, phoneNumber } = req.body;

    if (!planTier || !paymentMethod) {
      return res.status(400).json({ error: 'Missing required parameters: planTier or paymentMethod' });
    }

    if (!['basic_monthly', 'standard_monthly', 'premium_weekly'].includes(planTier)) {
      return res.status(400).json({ error: 'Invalid planTier selection' });
    }

    if (!['card', 'paybill', 'payhero'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'Invalid paymentMethod' });
    }

    // Determine prices
    let amount = 0.00;
    if (planTier === 'basic_monthly') amount = 9.00;
    else if (planTier === 'standard_monthly') amount = 18.00;
    else if (planTier === 'premium_weekly') amount = 30.00;

    const paymentId = 'pay_' + Math.random().toString(36).substr(2, 9);

    // 1. Card Checkout: Instant Simulation approval
    if (paymentMethod === 'card') {
      if (!transactionCode) {
        return res.status(400).json({ error: 'Missing transaction code reference.' });
      }

      const settingsResult = await sql`
        SELECT paystack_secret_key, paystack_live FROM merchant_billing_settings WHERE id = 'primary' LIMIT 1;
      `;
      const secretKey = settingsResult.rows.length > 0 ? settingsResult.rows[0].paystack_secret_key : '';
      
      if (!secretKey) {
        return res.status(400).json({ error: 'Card payment gateway is not configured by the administrator.' });
      }

      // Check for duplicate transaction codes
      const dupCheck = await sql`
        SELECT id FROM subscription_payments WHERE transaction_code = ${transactionCode} LIMIT 1;
      `;
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({ error: 'This payment transaction reference has already been processed.' });
      }

      // Verify the transaction with Paystack
      const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${transactionCode}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${secretKey}`,
          'Accept': 'application/json'
        }
      });

      if (!verifyRes.ok) {
        const errText = await verifyRes.text();
        return res.status(400).json({ error: `Paystack validation failed: ${errText}` });
      }

      const verifyData = await verifyRes.json();
      
      if (!verifyData.status || verifyData.data.status !== 'success') {
        return res.status(400).json({ 
          error: `Transaction verification failed. Status: ${verifyData?.data?.status || 'unknown'}` 
        });
      }

      const expiresInterval = planTier === 'premium_weekly' ? '7 days' : '30 days';

      // Insert approved payment log
      await sql`
        INSERT INTO subscription_payments (id, user_id, plan_tier, amount, payment_method, transaction_code, status)
        VALUES (${paymentId}, ${userId}, ${planTier}, ${amount}, 'card', ${transactionCode}, 'approved');
      `;

      // Update user subscription state
      await sql`
        UPDATE users 
        SET 
          subscription_tier = ${planTier},
          subscription_status = 'active',
          subscription_expires_at = NOW() + CAST(${expiresInterval} AS INTERVAL),
          subscription_id = ${paymentId}
        WHERE id = ${userId};
      `;

      // Fetch the updated user profile
      const userRes = await sql`
        SELECT id, name, email, role, status, subscription_tier, subscription_status, subscription_expires_at FROM users WHERE id = ${userId} LIMIT 1;
      `;
      const updatedUser = userRes.rows[0];

      return res.status(200).json({
        status: 'success',
        message: 'Subscription purchased successfully!',
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          status: updatedUser.status,
          subscriptionTier: updatedUser.subscription_tier,
          subscriptionStatus: updatedUser.subscription_status,
          subscriptionExpiresAt: updatedUser.subscription_expires_at
        }
      });
    }

    // 2. Paybill Checkout: Record reference and await manual verification
    if (paymentMethod === 'paybill') {
      if (!transactionCode || transactionCode.trim().length < 5) {
        return res.status(400).json({ error: 'Please enter a valid Transaction Reference Code' });
      }

      const trimmedCode = transactionCode.trim().toUpperCase();

      // Check if this transaction code is already registered to avoid duplicates
      const dupCheck = await sql`
        SELECT id FROM subscription_payments WHERE transaction_code = ${trimmedCode} LIMIT 1;
      `;
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({ error: 'This payment transaction code has already been submitted' });
      }

      // Insert pending paybill reference
      await sql`
        INSERT INTO subscription_payments (id, user_id, plan_tier, amount, payment_method, transaction_code, status)
        VALUES (${paymentId}, ${userId}, ${planTier}, ${amount}, 'paybill', ${trimmedCode}, 'pending');
      `;

      // Fetch user details for the Telegram notification
      let userName = 'Unknown User';
      let userEmail = 'N/A';
      try {
        const userRes = await sql`
          SELECT name, email FROM users WHERE id = ${userId} LIMIT 1;
        `;
        if (userRes.rows.length > 0) {
          userName = userRes.rows[0].name;
          userEmail = userRes.rows[0].email;
        }
      } catch (dbErr) {
        console.error('Failed to fetch user details for Telegram notification:', dbErr);
      }

      // Send Telegram alert
      try {
        const alertMessage = `💳 <b>New Pending Subscription Payment</b>\n\n<b>User:</b> ${userName} (${userEmail})\n<b>Plan Tier:</b> ${planTier}\n<b>Amount:</b> $${amount.toFixed(2)}\n<b>M-Pesa Reference:</b> ${trimmedCode}\n\n<i>Please log into the Admin Dashboard to verify and approve this payment.</i>`;
        await sendTelegramNotification(alertMessage);
      } catch (telegramErr) {
        console.error('Failed to send payment Telegram alert:', telegramErr);
      }

      return res.status(200).json({
        status: 'pending',
        message: 'Your payment reference has been submitted. The administrator will review and approve your subscription shortly.'
      });
    }

    // 3. PayHero Automated Checkout: Initiate STK push to user's phone
    if (paymentMethod === 'payhero') {
      if (!phoneNumber) {
        return res.status(400).json({ error: 'Missing M-Pesa phone number for STK Push request.' });
      }

      // Fetch USD to KES rate from settings
      const settingsResult = await sql`
        SELECT usd_to_kes_rate FROM merchant_billing_settings WHERE id = 'primary' LIMIT 1;
      `;
      const rate = settingsResult.rows.length > 0 ? parseFloat(settingsResult.rows[0].usd_to_kes_rate) : 130.00;

      const username = process.env.PAYHERO_API_USERNAME || '';
      const password = process.env.PAYHERO_API_PASSWORD || '';
      const channelId = process.env.PAYHERO_CHANNEL_ID || '';

      if (!username || !password || !channelId) {
        return res.status(400).json({ error: 'PayHero payment gateway is not configured by the administrator.' });
      }

      // Format phone number to 254XXXXXXXXX
      let formattedPhone = phoneNumber.replace(/\D/g, '');
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '254' + formattedPhone.substring(1);
      } else if (formattedPhone.startsWith('7') || formattedPhone.startsWith('1')) {
        formattedPhone = '254' + formattedPhone;
      }

      if (formattedPhone.length !== 12 || !formattedPhone.startsWith('254')) {
        return res.status(400).json({ error: 'Please enter a valid M-Pesa phone number (e.g. 0712345678).' });
      }

      // Calculate KES amount
      const amountInKes = Math.round(amount * rate);
      const payheroRef = paymentId;
      const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

      // Determine webhook callback URL
      const host = req.headers.host || 'invoiceaccumulator.com';
      const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
      const callbackUrl = `${protocol}://${host}/api/billing/payhero-callback`;

      console.log(`Initiating PayHero STK Push. Phone: ${formattedPhone}, Amount: ${amountInKes} KES, Callback: ${callbackUrl}`);

      // Call PayHero STK Push API
      const payheroRes = await fetch('https://backend.payhero.co.ke/api/v2/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          amount: amountInKes,
          phone_number: formattedPhone,
          channel_id: parseInt(channelId, 10),
          provider: 'm-pesa',
          external_reference: payheroRef,
          callback_url: callbackUrl
        })
      });

      if (!payheroRes.ok) {
        const errText = await payheroRes.text();
        console.error('PayHero API error response:', errText);
        return res.status(400).json({ error: `PayHero integration error: ${errText}` });
      }

      const payheroData: any = await payheroRes.json();
      console.log('PayHero response:', JSON.stringify(payheroData));

      // Insert pending payhero reference
      await sql`
        INSERT INTO subscription_payments (id, user_id, plan_tier, amount, payment_method, transaction_code, status)
        VALUES (${paymentId}, ${userId}, ${planTier}, ${amount}, 'payhero', ${formattedPhone}, 'pending');
      `;

      return res.status(200).json({
        status: 'pending',
        paymentId: paymentId,
        message: 'STK Push request initiated. Please check your phone for the M-Pesa PIN prompt.'
      });
    }

    return res.status(400).json({ error: 'Unsupported payment routing' });
  } catch (error: any) {
    console.error('Subscription handler error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
