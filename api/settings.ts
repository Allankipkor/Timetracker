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
    // Load current global settings
    const globalRes = await sql`
      SELECT paypal_client_id, paypal_mode FROM merchant_billing_settings WHERE id = 'primary' LIMIT 1;
    `;
    const globalClientId = globalRes.rows.length > 0 ? globalRes.rows[0].paypal_client_id : 'test';
    const globalMode = globalRes.rows.length > 0 ? globalRes.rows[0].paypal_mode : 'sandbox';

    if (req.method === 'GET') {
      const result = await sql`
        SELECT * FROM paypal_settings WHERE user_id = ${userId} LIMIT 1;
      `;

      if (result.rows.length === 0) {
        // Fallback default response
        return res.status(200).json({
          email: '',
          clientId: globalClientId,
          mode: globalMode,
          currency: 'USD'
        });
      }

      const settings = result.rows[0];

      return res.status(200).json({
        email: settings.email,
        clientId: globalClientId, // always return global
        mode: globalMode,         // always return global
        currency: settings.currency
      });
    }

    if (req.method === 'POST') {
      const { email, clientId, mode, currency } = req.body;

      if (!email || !currency) {
        return res.status(400).json({ error: 'Missing required settings parameters' });
      }

      // Check if user is admin
      const userRes = await sql`
        SELECT role FROM users WHERE id = ${userId} LIMIT 1;
      `;
      const isAdmin = userRes.rows.length > 0 && userRes.rows[0].role === 'super_admin';

      let activeClientId = globalClientId;
      let activeMode = globalMode;

      if (isAdmin && clientId && mode) {
        // Update global credentials
        await sql`
          UPDATE merchant_billing_settings
          SET paypal_client_id = ${clientId.trim()}, paypal_mode = ${mode.trim()}
          WHERE id = 'primary';
        `;
        activeClientId = clientId.trim();
        activeMode = mode.trim();
      }

      // Save user specific paypal config
      await sql`
        INSERT INTO paypal_settings (user_id, email, client_id, mode, currency)
        VALUES (${userId}, ${email.trim()}, ${activeClientId}, ${activeMode}, ${currency.trim()})
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
