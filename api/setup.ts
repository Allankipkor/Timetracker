import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Perform migrations for existing database tables to add columns safely
    try {
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(30) DEFAULT 'free';`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) DEFAULT 'inactive';`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP NULL;`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(100) NULL;`;
      await sql`UPDATE users SET role = 'user' WHERE role IS NULL;`;
      await sql`UPDATE users SET status = 'approved' WHERE status IS NULL;`;
      await sql`UPDATE users SET subscription_tier = 'premium_weekly' WHERE subscription_tier IS NULL;`;
      await sql`UPDATE users SET subscription_status = 'active' WHERE subscription_status IS NULL;`;
    } catch (migErr) {
      console.warn('Migration warnings (columns might already exist):', migErr);
    }

    // 1. Users Table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'user',
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        subscription_tier VARCHAR(30) NOT NULL DEFAULT 'free',
        subscription_status VARCHAR(20) NOT NULL DEFAULT 'inactive',
        subscription_expires_at TIMESTAMP NULL,
        subscription_id VARCHAR(100) NULL,
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

    // 7. Merchant Billing Settings Table
    await sql`
      CREATE TABLE IF NOT EXISTS merchant_billing_settings (
        id VARCHAR(50) PRIMARY KEY DEFAULT 'primary',
        paybill_number VARCHAR(50) NOT NULL DEFAULT '',
        till_number VARCHAR(50) NOT NULL DEFAULT '',
        bank_name VARCHAR(100) NOT NULL DEFAULT 'Lipa na M-Pesa (Paybill)',
        usd_to_kes_rate DECIMAL(10, 2) NOT NULL DEFAULT 130.00
      );
    `;

    // 8. Subscription Payments Table
    await sql`
      CREATE TABLE IF NOT EXISTS subscription_payments (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan_tier VARCHAR(30) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        payment_method VARCHAR(20) NOT NULL,
        transaction_code VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Seed default merchant billing details
    await sql`
      INSERT INTO merchant_billing_settings (id, paybill_number, till_number, bank_name, usd_to_kes_rate)
      VALUES ('primary', '400222', '511234', 'Lipa na M-Pesa (Paybill)', 130.00)
      ON CONFLICT (id) DO NOTHING;
    `;

    // Seeding Guest Sandbox User and Admin profile data
    const guestPasswordHash = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92'; // sha256 of 'guest'
    const adminPasswordHash = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9'; // sha256 of 'admin123'
    const defaultClientId = process.env.PAYPAL_CLIENT_ID || 'test';
    
    await sql`
      INSERT INTO users (id, name, email, password_hash, role, status, subscription_tier, subscription_status)
      VALUES ('usr_guest', 'Guest Developer', 'guest@example.com', ${guestPasswordHash}, 'user', 'approved', 'premium_weekly', 'active')
      ON CONFLICT (id) DO UPDATE SET role = 'user', status = 'approved', subscription_tier = 'premium_weekly', subscription_status = 'active';
    `;

    await sql`
      INSERT INTO users (id, name, email, password_hash, role, status, subscription_tier, subscription_status)
      VALUES ('usr_admin', 'System Admin', 'admin@timecamp.com', ${adminPasswordHash}, 'super_admin', 'approved', 'premium_weekly', 'active')
      ON CONFLICT (id) DO UPDATE SET role = 'super_admin', status = 'approved', subscription_tier = 'premium_weekly', subscription_status = 'active';
    `;

    await sql`
      INSERT INTO paypal_settings (user_id, email, client_id, mode, currency)
      VALUES ('usr_guest', 'guest@example.com', ${defaultClientId}, 'sandbox', 'USD')
      ON CONFLICT (user_id) DO UPDATE SET client_id = EXCLUDED.client_id;
    `;

    await sql`
      INSERT INTO paypal_settings (user_id, email, client_id, mode, currency)
      VALUES ('usr_admin', 'admin@timecamp.com', ${defaultClientId}, 'sandbox', 'USD')
      ON CONFLICT (user_id) DO UPDATE SET client_id = EXCLUDED.client_id;
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
