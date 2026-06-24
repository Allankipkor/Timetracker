import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './db.js';

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
    if (req.method === 'GET') {
      const result = await sql`
        SELECT * FROM paypal_settings WHERE user_id = ${userId} LIMIT 1;
      `;

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'PayPal settings not found' });
      }

      const settings = result.rows[0];

      return res.status(200).json({
        email: settings.email,
        clientId: settings.client_id,
        mode: settings.mode,
        currency: settings.currency
      });
    }

    if (req.method === 'POST') {
      const { email, clientId, mode, currency } = req.body;

      if (!email || !clientId || !mode || !currency) {
        return res.status(400).json({ error: 'Missing required settings parameters' });
      }

      await sql`
        INSERT INTO paypal_settings (user_id, email, client_id, mode, currency)
        VALUES (${userId}, ${email}, ${clientId}, ${mode}, ${currency})
        ON CONFLICT (user_id) DO UPDATE SET
          email = EXCLUDED.email,
          client_id = EXCLUDED.client_id,
          mode = EXCLUDED.mode,
          currency = EXCLUDED.currency;
      `;

      return res.status(200).json({ status: 'success', message: 'PayPal settings updated' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Settings handler error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
