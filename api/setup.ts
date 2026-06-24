import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // 1. Users Table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 2. Projects Table
    await sql`
      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        client_name VARCHAR(100) NOT NULL,
        color VARCHAR(50) NOT NULL,
        hourly_rate DECIMAL(10, 2) NOT NULL DEFAULT 0.00
      );
    `;

    // 3. Tasks Table
    await sql`
      CREATE TABLE IF NOT EXISTS tasks (
        id VARCHAR(50) PRIMARY KEY,
        project_id VARCHAR(50) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL
      );
    `;

    // 4. Time Entries Table
    await sql`
      CREATE TABLE IF NOT EXISTS time_entries (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        project_id VARCHAR(50) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        task_id VARCHAR(50),
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        duration INTEGER NOT NULL DEFAULT 0,
        is_billable BOOLEAN NOT NULL DEFAULT TRUE,
        is_invoice_generated BOOLEAN NOT NULL DEFAULT FALSE,
        invoice_id VARCHAR(50)
      );
    `;

    // 5. Invoices Table
    await sql`
      CREATE TABLE IF NOT EXISTS invoices (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        invoice_number VARCHAR(50) NOT NULL,
        client_name VARCHAR(100) NOT NULL,
        client_email VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        due_date DATE NOT NULL,
        items JSONB NOT NULL,
        subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
        tax_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        discount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        status VARCHAR(50) NOT NULL DEFAULT 'Draft',
        project_id VARCHAR(50) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        currency VARCHAR(10) NOT NULL DEFAULT 'USD'
      );
    `;

    // 6. PayPal Settings Table
    await sql`
      CREATE TABLE IF NOT EXISTS paypal_settings (
        user_id VARCHAR(50) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        client_id VARCHAR(255) NOT NULL,
        mode VARCHAR(20) NOT NULL DEFAULT 'sandbox',
        currency VARCHAR(10) NOT NULL DEFAULT 'USD'
      );
    `;

    // Seeding Guest Sandbox User profile data (so writes don't fail)
    const guestPasswordHash = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92'; // sha256 of 'guest'
    
    await sql`
      INSERT INTO users (id, name, email, password_hash)
      VALUES ('usr_guest', 'Guest Developer', 'guest@example.com', ${guestPasswordHash})
      ON CONFLICT (id) DO NOTHING;
    `;

    await sql`
      INSERT INTO paypal_settings (user_id, email, client_id, mode, currency)
      VALUES ('usr_guest', 'guest@example.com', 'Aef_9X8DMOCK_CLIENT_ID_zY2', 'sandbox', 'USD')
      ON CONFLICT (user_id) DO NOTHING;
    `;

    await sql`
      INSERT INTO projects (id, user_id, name, client_name, color, hourly_rate)
      VALUES ('proj_onboard', 'usr_guest', 'Freelance Tasks', 'Sample Client', '#3b82f6', 150.00)
      ON CONFLICT (id) DO NOTHING;
    `;

    await sql`
      INSERT INTO tasks (id, project_id, name)
      VALUES 
        ('tsk_dev', 'proj_onboard', 'Software Development'),
        ('tsk_design', 'proj_onboard', 'UI/UX Design')
      ON CONFLICT (id) DO NOTHING;
    `;

    return res.status(200).json({
      status: 'success',
      message: 'Vercel Postgres database tables setup and guest seeding complete!'
    });
  } catch (error: any) {
    console.error('Database setup failed:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to initialize database tables.',
      error: error.message
    });
  }
}
