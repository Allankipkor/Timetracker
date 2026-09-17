import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_utils/db.js';
import { sendTelegramNotification } from '../_utils/telegram.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Signature');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    console.log('GravityPay Callback Received:', JSON.stringify(body));

    // Extract reference and status
    const reference = body.reference || body.external_reference || body.externalReference || body.transactionId;
    const status = body.status;
    const mpesaReceipt = body.mpesaReceipt || body.mpesa_receipt || body.receiptNumber || body.transactionId;

    if (!reference) {
      console.warn('GravityPay Webhook missed reference parameter.');
      return res.status(400).json({ error: 'Missing transaction reference' });
    }

    // Retrieve pending payment by id or transaction_code or matching reference prefix
    const paymentRes = await sql`
      SELECT id, user_id, plan_tier, amount, status 
      FROM timetracker_subscription_payments 
      WHERE id = ${reference} OR transaction_code = ${reference} OR id LIKE ${'%' + reference + '%'}
      LIMIT 1;
    `;

    if (paymentRes.rows.length === 0) {
      console.warn(`Payment reference ${reference} not found in subscription_payments`);
      return res.status(404).json({ error: 'Payment reference not found' });
    }

    const payment = paymentRes.rows[0];

    // Avoid processing if already handled
    if (payment.status !== 'pending') {
      console.log(`Payment reference ${payment.id} already processed with status: ${payment.status}`);
      return res.status(200).json({ message: 'Already processed' });
    }

    const isSuccess = (status && typeof status === 'string' && status.toLowerCase() === 'success') || status === 'COMPLETED' || body.success === true;

    if (isSuccess) {
      const expiresInterval = payment.plan_tier === 'premium_weekly' ? '7 days' : '30 days';
      const actualCode = mpesaReceipt || ('GP-' + Math.random().toString(36).substr(2, 9).toUpperCase());

      // Approve payment
      await sql`
        UPDATE timetracker_subscription_payments 
        SET status = 'approved', transaction_code = ${actualCode} 
        WHERE id = ${payment.id};
      `;

      // Update user subscription
      await sql`
        UPDATE timetracker_users 
        SET 
          subscription_tier = ${payment.plan_tier},
          subscription_status = 'active',
          subscription_expires_at = NOW() + CAST(${expiresInterval} AS INTERVAL),
          subscription_id = ${payment.id}
        WHERE id = ${payment.user_id};
      `;

      // Fetch user details for notification
      let userName = 'Unknown User';
      let userEmail = 'N/A';
      try {
        const userRes = await sql`
          SELECT name, email FROM timetracker_users WHERE id = ${payment.user_id} LIMIT 1;
        `;
        if (userRes.rows.length > 0) {
          userName = userRes.rows[0].name;
          userEmail = userRes.rows[0].email;
        }
      } catch (dbErr) {
        console.error('Failed to fetch user details for Telegram notification:', dbErr);
      }

      // Send Telegram notification
      try {
        const alertMessage = `✅ <b>Automated Subscription Payment Approved</b>\n\n<b>User:</b> ${userName} (${userEmail})\n<b>Plan Tier:</b> ${payment.plan_tier}\n<b>Amount:</b> $${parseFloat(payment.amount).toFixed(2)}\n<b>M-Pesa Receipt:</b> ${actualCode}\n<b>Method:</b> GravityPay STK Push`;
        await sendTelegramNotification(alertMessage);
      } catch (telegramErr) {
        console.error('Failed to send Telegram alert:', telegramErr);
      }

      console.log(`Successfully approved GravityPay payment ${payment.id} for user ${payment.user_id}`);
    } else {
      // Mark as failed
      await sql`
        UPDATE timetracker_subscription_payments 
        SET status = 'failed' 
        WHERE id = ${payment.id};
      `;

      console.log(`Payment ${payment.id} marked as failed from GravityPay callback`);
    }

    return res.status(200).json({ status: 'success', message: 'GravityPay callback processed successfully' });
  } catch (error: any) {
    console.error('GravityPay Webhook error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
