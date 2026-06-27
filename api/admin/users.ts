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
    // 1. Verify that the current user is a super admin
    const callerResult = await sql`
      SELECT role FROM users WHERE id = ${userId} LIMIT 1;
    `;

    if (callerResult.rows.length === 0 || callerResult.rows[0].role !== 'super_admin') {
      return res.status(403).json({ error: 'Forbidden: Admin privileges required' });
    }

    // 2. GET method: list all users
    if (req.method === 'GET') {
      const usersResult = await sql`
        SELECT id, name, email, role, status, created_at AS "createdAt"
        FROM users 
        ORDER BY created_at DESC;
      `;
      return res.status(200).json(usersResult.rows);
    }

    // 3. POST method: update a user's role or status
    if (req.method === 'POST') {
      const { targetUserId, status, role } = req.body;

      if (!targetUserId) {
        return res.status(400).json({ error: 'Missing targetUserId' });
      }

      // Prevent super_admin from changing their own role or status to avoid self-lockout
      if (targetUserId === userId) {
        return res.status(400).json({ error: 'Cannot modify your own administrator account' });
      }

      if (status) {
        if (!['approved', 'pending', 'rejected'].includes(status)) {
          return res.status(400).json({ error: 'Invalid status value' });
        }
        await sql`
          UPDATE users SET status = ${status} WHERE id = ${targetUserId};
        `;
      }

      if (role) {
        if (!['super_admin', 'user'].includes(role)) {
          return res.status(400).json({ error: 'Invalid role value' });
        }
        await sql`
          UPDATE users SET role = ${role} WHERE id = ${targetUserId};
        `;
      }

      return res.status(200).json({ status: 'success', message: 'User account updated successfully' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Admin users API error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
