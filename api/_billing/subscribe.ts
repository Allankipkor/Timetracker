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

    if (!['card', 'paybill', 'payhero', 'gravitypay', 'mpesa'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'Invalid paymentMethod' });
    }

    // Fetch merchant billing settings for dynamic plan prices & gateway credentials
    const merchantSettingsRes = await sql`
      SELECT price_basic_monthly, price_standard_monthly, price_premium_weekly
      FROM timetracker_merchant_billing_settings WHERE id = 'primary' LIMIT 1;
    `;
    const merchantSettings = merchantSettingsRes.rows.length > 0 ? merchantSettingsRes.rows[0] : null;

    const pBasic = merchantSettings?.price_basic_monthly ? parseFloat(merchantSettings.price_basic_monthly) : 9.00;
    const pStandard = merchantSettings?.price_standard_monthly ? parseFloat(merchantSettings.price_standard_monthly) : 18.00;
    const pPremium = merchantSettings?.price_premium_weekly ? parseFloat(merchantSettings.price_premium_weekly) : 30.00;

    // Determine prices dynamically
    let amount = 0.00;
    if (planTier === 'basic_monthly') amount = pBasic;
    else if (planTier === 'standard_monthly') amount = pStandard;
    else if (planTier === 'premium_weekly') amount = pPremium;

    const paymentId = 'pay_' + Math.random().toString(36).substr(2, 9);

    // 1. Card Checkout: Paystack verification
    if (paymentMethod === 'card') {
      if (!transactionCode) {
        return res.status(400).json({ error: 'Missing transaction code reference.' });
      }

      const settingsResult = await sql`
        SELECT paystack_secret_key, paystack_live FROM timetracker_merchant_billing_settings WHERE id = 'primary' LIMIT 1;
      `;
      const secretKey = settingsResult.rows.length > 0 ? settingsResult.rows[0].paystack_secret_key : '';
      
      if (!secretKey) {
        return res.status(400).json({ error: 'Card payment gateway is not configured by the administrator.' });
      }

      // Check for duplicate transaction codes
      const dupCheck = await sql`
        SELECT id FROM timetracker_subscription_payments WHERE transaction_code = ${transactionCode} LIMIT 1;
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
        INSERT INTO timetracker_subscription_payments (id, user_id, plan_tier, amount, payment_method, transaction_code, status)
        VALUES (${paymentId}, ${userId}, ${planTier}, ${amount}, 'card', ${transactionCode}, 'approved');
      `;

      // Update user subscription state
      await sql`
        UPDATE timetracker_users 
        SET 
          subscription_tier = ${planTier},
          subscription_status = 'active',
          subscription_expires_at = NOW() + CAST(${expiresInterval} AS INTERVAL),
          subscription_id = ${paymentId}
        WHERE id = ${userId};
      `;

      // Fetch the updated user profile
      const userRes = await sql`
        SELECT id, name, email, role, status, subscription_tier, subscription_status, subscription_expires_at FROM timetracker_users WHERE id = ${userId} LIMIT 1;
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
        SELECT id FROM timetracker_subscription_payments WHERE transaction_code = ${trimmedCode} LIMIT 1;
      `;
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({ error: 'This payment transaction code has already been submitted' });
      }

      // Insert pending paybill reference
      await sql`
        INSERT INTO timetracker_subscription_payments (id, user_id, plan_tier, amount, payment_method, transaction_code, status)
        VALUES (${paymentId}, ${userId}, ${planTier}, ${amount}, 'paybill', ${trimmedCode}, 'pending');
      `;

      // Fetch user details for the Telegram notification
      let userName = 'Unknown User';
      let userEmail = 'N/A';
      try {
        const userRes = await sql`
          SELECT name, email FROM timetracker_users WHERE id = ${userId} LIMIT 1;
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

    // 3. Automated M-Pesa STK Push (PayHero / GravityPay with Auto-Failover)
    if (paymentMethod === 'payhero' || paymentMethod === 'gravitypay' || paymentMethod === 'mpesa') {
      if (!phoneNumber) {
        return res.status(400).json({ error: 'Missing M-Pesa phone number for STK Push request.' });
      }

      // Fetch USD to KES rate and gateway settings
      const settingsResult = await sql`
        SELECT usd_to_kes_rate, active_mpesa_gateway, gravitypay_public_key, gravitypay_secret_key, gravitypay_live
        FROM timetracker_merchant_billing_settings WHERE id = 'primary' LIMIT 1;
      `;
      const settings = settingsResult.rows.length > 0 ? settingsResult.rows[0] : null;
      const rate = settings ? parseFloat(settings.usd_to_kes_rate) : 130.00;
      const configuredActiveGateway = (settings?.active_mpesa_gateway === 'gravitypay') ? 'gravitypay' : 'payhero';

      // Determine requested gateway routing
      let targetGateway = configuredActiveGateway;
      if (paymentMethod === 'gravitypay') targetGateway = 'gravitypay';
      else if (paymentMethod === 'payhero') targetGateway = 'payhero';

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
      const host = req.headers.host || 'invoiceaccumulator.com';
      const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';

      // Credentials for gateways
      const payheroUsername = process.env.PAYHERO_API_USERNAME || '';
      const payheroPassword = process.env.PAYHERO_API_PASSWORD || '';
      const payheroChannelId = process.env.PAYHERO_CHANNEL_ID || '';
      const payheroConfigured = !!(payheroUsername && payheroPassword && payheroChannelId);

      const gpPublicKey = settings?.gravitypay_public_key || process.env.GRAVITYPAY_PUBLIC_KEY || '';
      const gpSecretKey = settings?.gravitypay_secret_key || process.env.GRAVITYPAY_SECRET_KEY || '';
      const gravitypayConfigured = !!(gpPublicKey && gpSecretKey);

      // Helper to trigger PayHero STK Push
      const tryPayHero = async () => {
        if (!payheroConfigured) {
          throw new Error('PayHero payment gateway credentials are not configured.');
        }

        const payheroRef = paymentId;
        const authHeader = 'Basic ' + Buffer.from(`${payheroUsername}:${payheroPassword}`).toString('base64');
        const callbackUrl = `${protocol}://${host}/api/billing/payhero-callback`;

        console.log(`Initiating PayHero STK Push. Phone: ${formattedPhone}, Amount: ${amountInKes} KES, Callback: ${callbackUrl}`);

        const payheroRes = await fetch('https://backend.payhero.co.ke/api/v2/payments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify({
            amount: amountInKes,
            phone_number: formattedPhone,
            channel_id: parseInt(payheroChannelId, 10),
            provider: 'm-pesa',
            external_reference: payheroRef,
            callback_url: callbackUrl
          })
        });

        if (!payheroRes.ok) {
          const errText = await payheroRes.text();
          throw new Error(`PayHero API error (${payheroRes.status}): ${errText}`);
        }

        return await payheroRes.json();
      };

      // Helper to trigger GravityPay STK Push
      const tryGravityPay = async () => {
        if (!gravitypayConfigured) {
          throw new Error('GravityPay gateway credentials are not configured.');
        }

        // GravityPay reference must be between 1 and 12 characters
        const gpRef = (paymentId.replace('pay_', 'GP')).substring(0, 12);
        console.log(`Initiating GravityPay STK Push. Phone: ${formattedPhone}, Amount: ${amountInKes} KES, Ref: ${gpRef}`);

        const gpRes = await fetch('https://api.gravitypayapp.com/api/v1/stk/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${gpSecretKey}`,
            'x-api-key': gpPublicKey
          },
          body: JSON.stringify({
            phoneNumber: formattedPhone,
            amount: amountInKes,
            reference: gpRef,
            description: `TimeCamp ${planTier}`
          })
        });

        if (!gpRes.ok) {
          const errText = await gpRes.text();
          throw new Error(`GravityPay API error (${gpRes.status}): ${errText}`);
        }

        return await gpRes.json();
      };

      let executedGateway: 'payhero' | 'gravitypay' = targetGateway === 'gravitypay' ? 'gravitypay' : 'payhero';
      let primaryError: any = null;

      try {
        if (targetGateway === 'gravitypay') {
          await tryGravityPay();
          executedGateway = 'gravitypay';
        } else {
          await tryPayHero();
          executedGateway = 'payhero';
        }
      } catch (err: any) {
        primaryError = err;
        console.warn(`${targetGateway} STK Push failed (${err.message}). Checking for secondary fallback...`);

        // Attempt failover if the alternative gateway is configured
        if (targetGateway === 'payhero' && gravitypayConfigured) {
          try {
            console.log('Failing over to GravityPay STK push...');
            await tryGravityPay();
            executedGateway = 'gravitypay';
            primaryError = null;
          } catch (gpErr: any) {
            console.error('GravityPay fallback also failed:', gpErr);
          }
        } else if (targetGateway === 'gravitypay' && payheroConfigured) {
          try {
            console.log('Failing over to PayHero STK push...');
            await tryPayHero();
            executedGateway = 'payhero';
            primaryError = null;
          } catch (phErr: any) {
            console.error('PayHero fallback also failed:', phErr);
          }
        }

        if (primaryError) {
          console.error(`${executedGateway} STK Push failed:`, primaryError);
          return res.status(400).json({
            error: primaryError.message || `Failed to initiate STK Push via ${executedGateway}. Please try again or use manual Paybill.`
          });
        }
      }

      // Insert pending payment log
      await sql`
        INSERT INTO timetracker_subscription_payments (id, user_id, plan_tier, amount, payment_method, transaction_code, status)
        VALUES (${paymentId}, ${userId}, ${planTier}, ${amount}, ${executedGateway}, ${formattedPhone}, 'pending');
      `;

      return res.status(200).json({
        status: 'pending',
        paymentId: paymentId,
        gateway: executedGateway,
        message: `STK Push prompt sent via ${executedGateway === 'gravitypay' ? 'GravityPay' : 'PayHero'}. Please enter your M-Pesa PIN on your phone.`
      });
    }

    return res.status(400).json({ error: 'Unsupported payment routing' });
  } catch (error: any) {
    console.error('Subscription handler error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
