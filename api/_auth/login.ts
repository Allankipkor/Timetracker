import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, hashPassword } from '../_utils/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Missing email or password' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const passwordHash = hashPassword(password);

    // Query user
    const userResult = await sql`
      SELECT id, name, email, role, status, subscription_tier, subscription_status, subscription_expires_at, created_at FROM users 
      WHERE email = ${trimmedEmail} AND password_hash = ${passwordHash}
      LIMIT 1;
    `;

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = userResult.rows[0];

    // Check account status
    if (user.status === 'pending') {
      return res.status(403).json({ error: 'Your account is pending admin approval. Please try again later.' });
    }
    if (user.status === 'rejected') {
      return res.status(403).json({ error: 'Your account registration has been rejected by an administrator.' });
    }

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
    console.error('Login failed:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
