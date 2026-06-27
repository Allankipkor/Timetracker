import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, hashPassword } from '../_utils/db.js';
import { sendTelegramNotification } from '../_utils/telegram.js';

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
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Missing name, email, or password' });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await sql`
      SELECT id FROM users WHERE email = ${trimmedEmail} LIMIT 1;
    `;

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const userId = 'usr_' + Math.random().toString(36).substr(2, 9);
    const passwordHash = hashPassword(password);

    // Insert user with role 'user' and status 'pending'
    await sql`
      INSERT INTO users (id, name, email, password_hash, role, status)
      VALUES (${userId}, ${name.trim()}, ${trimmedEmail}, ${passwordHash}, 'user', 'pending');
    `;

    // Send Telegram alert
    try {
      const alertMessage = `🔔 <b>New Pending User Registration</b>\n\n<b>Name:</b> ${name.trim()}\n<b>Email:</b> ${trimmedEmail}\n\n<i>Please log into the Admin Dashboard to approve or reject this account.</i>`;
      await sendTelegramNotification(alertMessage);
    } catch (telegramErr) {
      console.error('Failed to send signup Telegram alert:', telegramErr);
    }

    // Create default PayPal settings for the new user
    const defaultPaypalEmail = trimmedEmail;
    const defaultClientId = process.env.PAYPAL_CLIENT_ID || 'test';
    await sql`
      INSERT INTO paypal_settings (user_id, email, client_id, mode, currency)
      VALUES (${userId}, ${defaultPaypalEmail}, ${defaultClientId}, 'sandbox', 'USD');
    `;

    // Create a default project for onboarding
    const projectId = 'proj_' + Math.random().toString(36).substr(2, 9);
    await sql`
      INSERT INTO projects (id, user_id, name, client_name, color, hourly_rate)
      VALUES (${projectId}, ${userId}, 'Freelance Tasks', 'Sample Client', '#3b82f6', 150.00);
    `;

    // Create default tasks
    const taskId1 = 'tsk_' + Math.random().toString(36).substr(2, 9);
    const taskId2 = 'tsk_' + Math.random().toString(36).substr(2, 9);
    await sql`
      INSERT INTO tasks (id, project_id, name)
      VALUES 
        (${taskId1}, ${projectId}, 'Software Development'),
        (${taskId2}, ${projectId}, 'UI/UX Design');
    `;

    return res.status(201).json({
      id: userId,
      name: name.trim(),
      email: trimmedEmail,
      createdAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Sign up failed:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
