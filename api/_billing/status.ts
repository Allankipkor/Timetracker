import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_utils/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-id');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const userId = req.headers['x-user-id'] as string;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: missing user context' });
  }

  const { paymentId } = req.query;
  if (!paymentId) {
    return res.status(400).json({ error: 'Missing paymentId parameter' });
  }

  try {
    const result = await sql`
      SELECT status, plan_tier FROM subscription_payments
      WHERE id = ${paymentId} AND user_id = ${userId}
      LIMIT 1;
    `;

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    return res.status(200).json({
      status: result.rows[0].status, // 'pending', 'approved', 'failed'
      planTier: result.rows[0].plan_tier
    });
  } catch (error: any) {
    console.error('Check payment status failed:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
