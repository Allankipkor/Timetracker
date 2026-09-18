import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, hashPassword } from './_utils/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // 0. Auto-rename legacy un-prefixed tables to timetracker_ prefix if they exist
    const legacyTables = [
      { from: 'users', to: 'timetracker_users' },
      { from: 'projects', to: 'timetracker_projects' },
      { from: 'tasks', to: 'timetracker_tasks' },
      { from: 'time_entries', to: 'timetracker_time_entries' },
      { from: 'invoices', to: 'timetracker_invoices' },
      { from: 'paypal_settings', to: 'timetracker_paypal_settings' },
      { from: 'merchant_billing_settings', to: 'timetracker_merchant_billing_settings' },
      { from: 'subscription_payments', to: 'timetracker_subscription_payments' }
    ];

    for (const { from, to } of legacyTables) {
      try {
        await sql.query(`ALTER TABLE IF EXISTS "${from}" RENAME TO "${to}";`);
      } catch (renameErr) {
        // Ignored if target table already exists or source does not exist
      }
    }

    // Drop legacy foreign key constraints that may reference old table names or cause constraint violations
    const legacyFks = [
      'ALTER TABLE IF EXISTS timetracker_paypal_settings DROP CONSTRAINT IF EXISTS paypal_settings_user_id_fkey;',
      'ALTER TABLE IF EXISTS timetracker_projects DROP CONSTRAINT IF EXISTS projects_user_id_fkey;',
      'ALTER TABLE IF EXISTS timetracker_tasks DROP CONSTRAINT IF EXISTS tasks_project_id_fkey;',
      'ALTER TABLE IF EXISTS timetracker_time_entries DROP CONSTRAINT IF EXISTS time_entries_user_id_fkey;',
      'ALTER TABLE IF EXISTS timetracker_time_entries DROP CONSTRAINT IF EXISTS time_entries_project_id_fkey;',
      'ALTER TABLE IF EXISTS timetracker_invoices DROP CONSTRAINT IF EXISTS invoices_user_id_fkey;',
      'ALTER TABLE IF EXISTS timetracker_invoices DROP CONSTRAINT IF EXISTS invoices_project_id_fkey;',
      'ALTER TABLE IF EXISTS timetracker_subscription_payments DROP CONSTRAINT IF EXISTS subscription_payments_user_id_fkey;'
    ];
    for (const dropQ of legacyFks) {
      try {
        await sql.query(dropQ);
      } catch (e) {
        // Ignored
      }
    }

    // 1. Users Table
    await sql`
      CREATE TABLE IF NOT EXISTS timetracker_users (
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

    // Perform migrations for timetracker_users safely
    try {
      await sql`ALTER TABLE timetracker_users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';`;
      await sql`ALTER TABLE timetracker_users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';`;
      await sql`ALTER TABLE timetracker_users ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(30) DEFAULT 'free';`;
      await sql`ALTER TABLE timetracker_users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) DEFAULT 'inactive';`;
      await sql`ALTER TABLE timetracker_users ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP NULL;`;
      await sql`ALTER TABLE timetracker_users ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(100) NULL;`;
      await sql`UPDATE timetracker_users SET role = 'user' WHERE role IS NULL;`;
      await sql`UPDATE timetracker_users SET status = 'approved' WHERE status IS NULL;`;
      await sql`UPDATE timetracker_users SET subscription_tier = 'premium_weekly' WHERE subscription_tier IS NULL;`;
      await sql`UPDATE timetracker_users SET subscription_status = 'active' WHERE subscription_status IS NULL;`;
    } catch (migErr) {
      console.warn('Users migration warnings:', migErr);
    }

    // 2. Projects Table
    await sql`
      CREATE TABLE IF NOT EXISTS timetracker_projects (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL,
        client_name VARCHAR(100) NOT NULL,
        color VARCHAR(50) NOT NULL,
        hourly_rate DECIMAL(10, 2) NOT NULL DEFAULT 0.00
      );
    `;

    // 3. Tasks Table
    await sql`
      CREATE TABLE IF NOT EXISTS timetracker_tasks (
        id VARCHAR(50) PRIMARY KEY,
        project_id VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL
      );
    `;

    // 4. Time Entries Table
    await sql`
      CREATE TABLE IF NOT EXISTS timetracker_time_entries (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        project_id VARCHAR(50) NOT NULL,
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
      CREATE TABLE IF NOT EXISTS timetracker_invoices (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
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
        project_id VARCHAR(50) NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'USD'
      );
    `;

    // 6. PayPal Settings Table
    await sql`
      CREATE TABLE IF NOT EXISTS timetracker_paypal_settings (
        user_id VARCHAR(50) PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        client_id VARCHAR(255) NOT NULL,
        mode VARCHAR(20) NOT NULL DEFAULT 'sandbox',
        currency VARCHAR(10) NOT NULL DEFAULT 'USD'
      );
    `;

    // 7. Merchant Billing Settings Table
    await sql`
      CREATE TABLE IF NOT EXISTS timetracker_merchant_billing_settings (
        id VARCHAR(50) PRIMARY KEY DEFAULT 'primary',
        paybill_number VARCHAR(50) NOT NULL DEFAULT '',
        till_number VARCHAR(50) NOT NULL DEFAULT '',
        bank_name VARCHAR(100) NOT NULL DEFAULT 'Lipa na M-Pesa (Paybill)',
        usd_to_kes_rate DECIMAL(10, 2) NOT NULL DEFAULT 130.00,
        paypal_client_id VARCHAR(255) NOT NULL DEFAULT 'test',
        paypal_mode VARCHAR(20) NOT NULL DEFAULT 'sandbox',
        intasend_public_key VARCHAR(255) NOT NULL DEFAULT '',
        intasend_live BOOLEAN NOT NULL DEFAULT FALSE,
        intasend_secret_key VARCHAR(255) NOT NULL DEFAULT '',
        paystack_public_key VARCHAR(255) NOT NULL DEFAULT '',
        paystack_live BOOLEAN NOT NULL DEFAULT FALSE,
        paystack_secret_key VARCHAR(255) NOT NULL DEFAULT '',
        payhero_api_username VARCHAR(255) NOT NULL DEFAULT '',
        payhero_api_password VARCHAR(255) NOT NULL DEFAULT '',
        payhero_channel_id VARCHAR(50) NOT NULL DEFAULT '',
        gravitypay_public_key VARCHAR(255) NOT NULL DEFAULT '',
        gravitypay_secret_key VARCHAR(255) NOT NULL DEFAULT '',
        gravitypay_live BOOLEAN NOT NULL DEFAULT TRUE,
        active_mpesa_gateway VARCHAR(30) NOT NULL DEFAULT 'payhero'
      );
    `;

    // Perform migrations for timetracker_merchant_billing_settings safely
    try {
      await sql`ALTER TABLE timetracker_merchant_billing_settings ADD COLUMN IF NOT EXISTS paypal_client_id VARCHAR(255) NOT NULL DEFAULT 'test';`;
      await sql`ALTER TABLE timetracker_merchant_billing_settings ADD COLUMN IF NOT EXISTS paypal_mode VARCHAR(20) NOT NULL DEFAULT 'sandbox';`;
      await sql`ALTER TABLE timetracker_merchant_billing_settings ADD COLUMN IF NOT EXISTS intasend_public_key VARCHAR(255) NOT NULL DEFAULT '';`;
      await sql`ALTER TABLE timetracker_merchant_billing_settings ADD COLUMN IF NOT EXISTS intasend_live BOOLEAN NOT NULL DEFAULT FALSE;`;
      await sql`ALTER TABLE timetracker_merchant_billing_settings ADD COLUMN IF NOT EXISTS intasend_secret_key VARCHAR(255) NOT NULL DEFAULT '';`;
      await sql`ALTER TABLE timetracker_merchant_billing_settings ADD COLUMN IF NOT EXISTS paystack_public_key VARCHAR(255) NOT NULL DEFAULT '';`;
      await sql`ALTER TABLE timetracker_merchant_billing_settings ADD COLUMN IF NOT EXISTS paystack_live BOOLEAN NOT NULL DEFAULT FALSE;`;
      await sql`ALTER TABLE timetracker_merchant_billing_settings ADD COLUMN IF NOT EXISTS paystack_secret_key VARCHAR(255) NOT NULL DEFAULT '';`;
      await sql`ALTER TABLE timetracker_merchant_billing_settings ADD COLUMN IF NOT EXISTS payhero_api_username VARCHAR(255) NOT NULL DEFAULT '';`;
      await sql`ALTER TABLE timetracker_merchant_billing_settings ADD COLUMN IF NOT EXISTS payhero_api_password VARCHAR(255) NOT NULL DEFAULT '';`;
      await sql`ALTER TABLE timetracker_merchant_billing_settings ADD COLUMN IF NOT EXISTS payhero_channel_id VARCHAR(50) NOT NULL DEFAULT '';`;
      await sql`ALTER TABLE timetracker_merchant_billing_settings ADD COLUMN IF NOT EXISTS gravitypay_public_key VARCHAR(255) NOT NULL DEFAULT '';`;
      await sql`ALTER TABLE timetracker_merchant_billing_settings ADD COLUMN IF NOT EXISTS gravitypay_secret_key VARCHAR(255) NOT NULL DEFAULT '';`;
      await sql`ALTER TABLE timetracker_merchant_billing_settings ADD COLUMN IF NOT EXISTS gravitypay_live BOOLEAN NOT NULL DEFAULT TRUE;`;
      await sql`ALTER TABLE timetracker_merchant_billing_settings ADD COLUMN IF NOT EXISTS active_mpesa_gateway VARCHAR(30) NOT NULL DEFAULT 'payhero';`;
    } catch (migErr) {
      console.warn('Billing settings migration warnings:', migErr);
    }

    // 8. Subscription Payments Table
    await sql`
      CREATE TABLE IF NOT EXISTS timetracker_subscription_payments (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        plan_tier VARCHAR(30) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        payment_method VARCHAR(20) NOT NULL,
        transaction_code VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Re-attach safe foreign key constraints (with ON DELETE CASCADE)
    const safeFks = [
      'ALTER TABLE timetracker_paypal_settings ADD CONSTRAINT timetracker_paypal_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES timetracker_users(id) ON DELETE CASCADE;',
      'ALTER TABLE timetracker_projects ADD CONSTRAINT timetracker_projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES timetracker_users(id) ON DELETE CASCADE;',
      'ALTER TABLE timetracker_tasks ADD CONSTRAINT timetracker_tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES timetracker_projects(id) ON DELETE CASCADE;',
      'ALTER TABLE timetracker_time_entries ADD CONSTRAINT timetracker_time_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES timetracker_users(id) ON DELETE CASCADE;',
      'ALTER TABLE timetracker_time_entries ADD CONSTRAINT timetracker_time_entries_project_id_fkey FOREIGN KEY (project_id) REFERENCES timetracker_projects(id) ON DELETE CASCADE;',
      'ALTER TABLE timetracker_invoices ADD CONSTRAINT timetracker_invoices_user_id_fkey FOREIGN KEY (user_id) REFERENCES timetracker_users(id) ON DELETE CASCADE;',
      'ALTER TABLE timetracker_invoices ADD CONSTRAINT timetracker_invoices_project_id_fkey FOREIGN KEY (project_id) REFERENCES timetracker_projects(id) ON DELETE CASCADE;',
      'ALTER TABLE timetracker_subscription_payments ADD CONSTRAINT timetracker_subscription_payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES timetracker_users(id) ON DELETE CASCADE;'
    ];
    for (const addQ of safeFks) {
      try {
        await sql.query(addQ);
      } catch (e) {
        // Ignored if already attached or table constraint exists
      }
    }

    // Seed default merchant billing details
    await sql`
      INSERT INTO timetracker_merchant_billing_settings (
        id, paybill_number, till_number, bank_name, usd_to_kes_rate, 
        paypal_client_id, paypal_mode, 
        intasend_public_key, intasend_live, intasend_secret_key,
        paystack_public_key, paystack_live, paystack_secret_key,
        gravitypay_public_key, gravitypay_secret_key, gravitypay_live,
        active_mpesa_gateway
      )
      VALUES (
        'primary', '400222', '511234', 'Lipa na M-Pesa (Paybill)', 130.00, 
        'test', 'sandbox', 
        '', false, '',
        '', false, '',
        '', '', true,
        'payhero'
      )
      ON CONFLICT (id) DO NOTHING;
    `;

    // Seeding Guest Sandbox User and Admin profile data
    const guestPasswordHash = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92'; // sha256 of 'guest'
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@timecamp.com').trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminPasswordHash = hashPassword(adminPassword);
    const defaultClientId = process.env.PAYPAL_CLIENT_ID || 'test';

    // Delete any stale rows with conflicting emails or old default admin
    try {
      if (adminEmail !== 'admin@timecamp.com') {
        await sql`DELETE FROM timetracker_users WHERE email = 'admin@timecamp.com';`;
      }
      await sql`DELETE FROM timetracker_users WHERE email IN ('guest@example.com', ${adminEmail}) AND id NOT IN ('usr_guest', 'usr_admin');`;
    } catch (cleanErr) {
      console.warn('Conflict clean warning:', cleanErr);
    }
    
    await sql`
      INSERT INTO timetracker_users (id, name, email, password_hash, role, status, subscription_tier, subscription_status)
      VALUES ('usr_guest', 'Guest Developer', 'guest@example.com', ${guestPasswordHash}, 'user', 'approved', 'premium_weekly', 'active')
      ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        password_hash = EXCLUDED.password_hash,
        role = 'user', 
        status = 'approved', 
        subscription_tier = 'premium_weekly', 
        subscription_status = 'active';
    `;

    await sql`
      INSERT INTO timetracker_users (id, name, email, password_hash, role, status, subscription_tier, subscription_status)
      VALUES ('usr_admin', 'System Admin', ${adminEmail}, ${adminPasswordHash}, 'super_admin', 'approved', 'premium_weekly', 'active')
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
      VALUES ('usr_guest', 'guest@example.com', ${defaultClientId}, 'sandbox', 'USD')
      ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, client_id = EXCLUDED.client_id;
    `;

    await sql`
      INSERT INTO timetracker_paypal_settings (user_id, email, client_id, mode, currency)
      VALUES ('usr_admin', ${adminEmail}, ${defaultClientId}, 'sandbox', 'USD')
      ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, client_id = EXCLUDED.client_id;
    `;

    await sql`
      INSERT INTO timetracker_projects (id, user_id, name, client_name, color, hourly_rate)
      VALUES ('proj_onboard', 'usr_guest', 'Freelance Tasks', 'Sample Client', '#3b82f6', 150.00)
      ON CONFLICT (id) DO NOTHING;
    `;

    await sql`
      INSERT INTO timetracker_tasks (id, project_id, name)
      VALUES 
        ('tsk_dev', 'proj_onboard', 'Software Development'),
        ('tsk_design', 'proj_onboard', 'UI/UX Design')
      ON CONFLICT (id) DO NOTHING;
    `;

    return res.status(200).json({
      status: 'success',
      message: 'Vercel Postgres database tables setup (timetracker_ prefix) and admin/guest seeding complete!'
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
