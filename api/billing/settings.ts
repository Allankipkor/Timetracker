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

  try {
    // 1. GET Method: Retrieve merchant paybill/till settings
    if (req.method === 'GET') {
      const userId = req.headers['x-user-id'] as string;
      let isAdmin = false;
      if (userId) {
        const adminCheck = await sql`
          SELECT role FROM users WHERE id = ${userId} LIMIT 1;
        `;
        isAdmin = adminCheck.rows.length > 0 && adminCheck.rows[0].role === 'super_admin';
      }

      const result = await sql`
        SELECT paybill_number, till_number, bank_name, usd_to_kes_rate, intasend_public_key, intasend_live, intasend_secret_key, paystack_public_key, paystack_live, paystack_secret_key
        FROM merchant_billing_settings
        WHERE id = 'primary'
        LIMIT 1;
      `;

      if (result.rows.length === 0) {
        // Fallback default response if not seeded yet
        return res.status(200).json({
          paybillNumber: '400222',
          tillNumber: '511234',
          bankName: 'Lipa na M-Pesa (Paybill)',
          usdToKesRate: 130.00,
          intasendPublicKey: '',
          intasendLive: false,
          intasendSecretKey: '',
          paystackPublicKey: '',
          paystackLive: false,
          paystackSecretKey: ''
        });
      }

      const settings = result.rows[0];
      return res.status(200).json({
        paybillNumber: settings.paybill_number,
        tillNumber: settings.till_number,
        bankName: settings.bank_name,
        usdToKesRate: parseFloat(settings.usd_to_kes_rate),
        intasendPublicKey: settings.intasend_public_key || '',
        intasendLive: !!settings.intasend_live,
        intasendSecretKey: isAdmin ? (settings.intasend_secret_key || '') : undefined,
        paystackPublicKey: settings.paystack_public_key || '',
        paystackLive: !!settings.paystack_live,
        paystackSecretKey: isAdmin ? (settings.paystack_secret_key || '') : undefined
      });
    }

    // 2. POST Method: Update billing configurations (requires admin authorization)
    if (req.method === 'POST') {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized: missing user context' });
      }

      // Verify that calling user is a super admin
      const adminCheck = await sql`
        SELECT role FROM users WHERE id = ${userId} LIMIT 1;
      `;

      if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'super_admin') {
        return res.status(403).json({ error: 'Forbidden: Admin privileges required' });
      }

      const { 
        paybillNumber, 
        tillNumber, 
        bankName, 
        usdToKesRate, 
        intasendPublicKey, 
        intasendLive, 
        intasendSecretKey,
        paystackPublicKey,
        paystackLive,
        paystackSecretKey
      } = req.body;

      if (paybillNumber === undefined || tillNumber === undefined || !bankName || !usdToKesRate) {
        return res.status(400).json({ error: 'Missing required configuration parameters' });
      }

      await sql`
        INSERT INTO merchant_billing_settings (
          id, paybill_number, till_number, bank_name, usd_to_kes_rate, 
          intasend_public_key, intasend_live, intasend_secret_key,
          paystack_public_key, paystack_live, paystack_secret_key
        )
        VALUES (
          'primary', 
          ${paybillNumber.trim()}, 
          ${tillNumber.trim()}, 
          ${bankName.trim()}, 
          ${usdToKesRate}, 
          ${intasendPublicKey ? intasendPublicKey.trim() : ''}, 
          ${!!intasendLive}, 
          ${intasendSecretKey ? intasendSecretKey.trim() : ''},
          ${paystackPublicKey ? paystackPublicKey.trim() : ''}, 
          ${!!paystackLive}, 
          ${paystackSecretKey ? paystackSecretKey.trim() : ''}
        )
        ON CONFLICT (id) DO UPDATE SET
          paybill_number = EXCLUDED.paybill_number,
          till_number = EXCLUDED.till_number,
          bank_name = EXCLUDED.bank_name,
          usd_to_kes_rate = EXCLUDED.usd_to_kes_rate,
          intasend_public_key = EXCLUDED.intasend_public_key,
          intasend_live = EXCLUDED.intasend_live,
          intasend_secret_key = EXCLUDED.intasend_secret_key,
          paystack_public_key = EXCLUDED.paystack_public_key,
          paystack_live = EXCLUDED.paystack_live,
          paystack_secret_key = EXCLUDED.paystack_secret_key;
      `;

      return res.status(200).json({ status: 'success', message: 'Merchant billing configurations updated' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Merchant billing settings error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
