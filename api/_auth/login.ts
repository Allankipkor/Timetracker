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

    // Support dynamic admin credentials from Vercel environment variables
    const envAdminEmail = (process.env.ADMIN_EMAIL || 'admin@timecamp.com').trim().toLowerCase();
    const envAdminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    // If logging in as the environment-configured admin
    if (trimmedEmail === envAdminEmail && password === envAdminPassword) {
      const adminPasswordHash = hashPassword(envAdminPassword);
      const defaultClientId = process.env.PAYPAL_CLIENT_ID || 'test';

      // Ensure/sync admin account with latest env credentials in the database
      try {
        await sql`
          INSERT INTO timetracker_users (id, name, email, password_hash, role, status, subscription_tier, subscription_status)
          VALUES ('usr_admin', 'System Admin', ${envAdminEmail}, ${adminPasswordHash}, 'super_admin', 'approved', 'premium_weekly', 'active')
          ON CONFLICT (id) DO UPDATE SET 
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            password_hash = EXCLUDED.password_hash,
            role = 'super_admin',
            status = 'approved',
            subscription_tier = 'premium_weekly',
            subscription_status = 'active';
        `;

        await sql`
          INSERT INTO timetracker_paypal_settings (user_id, email, client_id, mode, currency)
          VALUES ('usr_admin', ${envAdminEmail}, ${defaultClientId}, 'sandbox', 'USD')
          ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email;
        `;
      } catch (syncErr) {
        console.warn('Admin sync warning during login:', syncErr);
      }

      return res.status(200).json({
        id: 'usr_admin',
        name: 'System Admin',
        email: envAdminEmail,
        role: 'super_admin',
        status: 'approved',
        subscriptionTier: 'premium_weekly',
        subscriptionStatus: 'active',
        subscriptionExpiresAt: null,
        createdAt: new Date().toISOString()
      });
    }

    // Query user from database for standard users or registered accounts
    const userResult = await sql`
      SELECT id, name, email, role, status, subscription_tier, subscription_status, subscription_expires_at, created_at FROM timetracker_users 
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
