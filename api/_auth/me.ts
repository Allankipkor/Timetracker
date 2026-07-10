import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_utils/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-id');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = req.headers['x-user-id'] as string;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: missing user context' });
  }

  try {
    const result = await sql`
      SELECT id, name, email, role, status, subscription_tier, subscription_status, subscription_expires_at, created_at
      FROM users
      WHERE id = ${userId}
      LIMIT 1;
    `;

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    return res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      subscriptionTier: user.subscription_tier,
      subscriptionStatus: user.subscription_status,
      subscriptionExpiresAt: user.subscription_expires_at,
      createdAt: user.created_at
    });
  } catch (error: any) {
    console.error('Fetch profile failed:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
