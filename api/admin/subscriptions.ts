import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_utils/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-id');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const userId = req.headers['x-user-id'] as string;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: missing user context' });
  }

  try {
    // 1. Verify caller is a super admin
    const callerCheck = await sql`
      SELECT role FROM users WHERE id = ${userId} LIMIT 1;
    `;
    if (callerCheck.rows.length === 0 || callerCheck.rows[0].role !== 'super_admin') {
      return res.status(403).json({ error: 'Forbidden: Admin privileges required' });
    }

    // 2. GET Method: list all subscription transactions
    if (req.method === 'GET') {
      const result = await sql`
        SELECT 
          p.id, p.user_id AS "userId", p.plan_tier AS "planTier", 
          p.amount, p.payment_method AS "paymentMethod", 
          p.transaction_code AS "transactionCode", p.status, 
          p.created_at AS "createdAt",
          u.name AS "userName", u.email AS "userEmail"
        FROM subscription_payments p
        JOIN users u ON p.user_id = u.id
        ORDER BY p.created_at DESC;
      `;
      return res.status(200).json(result.rows);
    }

    // 3. POST Method: approve or reject a pending transaction
    if (req.method === 'POST') {
      const { paymentId, action } = req.body;

      if (!paymentId || !action || !['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'Missing or invalid parameters: paymentId or action' });
      }

      // Fetch payment details
      const paymentRes = await sql`
        SELECT user_id, plan_tier, status FROM subscription_payments WHERE id = ${paymentId} LIMIT 1;
      `;
      if (paymentRes.rows.length === 0) {
        return res.status(404).json({ error: 'Payment record not found' });
      }

      const payment = paymentRes.rows[0];

      if (payment.status !== 'pending') {
        return res.status(400).json({ error: `This payment transaction has already been ${payment.status}` });
      }

      if (action === 'approve') {
        const expiresInterval = payment.plan_tier === 'premium_weekly' ? '7 days' : '30 days';

        // Update payment log status
        await sql`
          UPDATE subscription_payments SET status = 'approved' WHERE id = ${paymentId};
        `;

        // Update target user subscription
        await sql`
          UPDATE users 
          SET 
            subscription_tier = ${payment.plan_tier},
            subscription_status = 'active',
            subscription_expires_at = NOW() + CAST(${expiresInterval} AS INTERVAL),
            subscription_id = ${paymentId}
          WHERE id = ${payment.user_id};
        `;
      } else if (action === 'reject') {
        // Update payment log status
        await sql`
          UPDATE subscription_payments SET status = 'rejected' WHERE id = ${paymentId};
        `;
      }

      return res.status(200).json({ status: 'success', message: `Subscription request successfully ${action}d` });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Admin subscriptions endpoint error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
