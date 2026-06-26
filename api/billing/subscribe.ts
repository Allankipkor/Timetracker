import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../db.js';

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
    const { planTier, paymentMethod, transactionCode } = req.body;

    if (!planTier || !paymentMethod) {
      return res.status(400).json({ error: 'Missing required parameters: planTier or paymentMethod' });
    }

    if (!['basic_monthly', 'standard_monthly', 'premium_weekly'].includes(planTier)) {
      return res.status(400).json({ error: 'Invalid planTier selection' });
    }

    if (!['card', 'paybill'].includes(paymentMethod)) {
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

      return res.status(200).json({
        status: 'pending',
        message: 'Your payment reference has been submitted. The administrator will review and approve your subscription shortly.'
      });
    }

    return res.status(400).json({ error: 'Unsupported payment routing' });
  } catch (error: any) {
    console.error('Subscription handler error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
