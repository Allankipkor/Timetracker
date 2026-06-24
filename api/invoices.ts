import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-id');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;

  try {
    // -------------------------------------------------------------
    // Public Endpoint: Get Single Invoice with project & settings details
    // -------------------------------------------------------------
    if (req.method === 'GET' && id) {
      const invoiceId = id as string;
      
      const invoiceResult = await sql`
        SELECT * FROM invoices WHERE id = ${invoiceId} LIMIT 1;
      `;

      if (invoiceResult.rows.length === 0) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const invoice = invoiceResult.rows[0];
      const ownerUserId = invoice.user_id;

      // Fetch owner project
      const projectResult = await sql`
        SELECT * FROM projects WHERE id = ${invoice.project_id} LIMIT 1;
      `;

      // Fetch owner paypal settings
      const settingsResult = await sql`
        SELECT * FROM paypal_settings WHERE user_id = ${ownerUserId} LIMIT 1;
      `;

      const formattedInvoice = {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        clientName: invoice.client_name,
        clientEmail: invoice.client_email,
        date: invoice.date.toISOString().split('T')[0],
        dueDate: invoice.due_date.toISOString().split('T')[0],
        items: typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items,
        subtotal: parseFloat(invoice.subtotal),
        taxRate: parseFloat(invoice.tax_rate),
        taxAmount: parseFloat(invoice.tax_amount),
        discount: parseFloat(invoice.discount),
        total: parseFloat(invoice.total),
        status: invoice.status,
        projectId: invoice.project_id,
        currency: invoice.currency
      };

      const formattedProject = projectResult.rows.length > 0 ? {
        id: projectResult.rows[0].id,
        name: projectResult.rows[0].name,
        clientName: projectResult.rows[0].client_name,
        color: projectResult.rows[0].color,
        hourlyRate: parseFloat(projectResult.rows[0].hourly_rate)
      } : null;

      const formattedSettings = settingsResult.rows.length > 0 ? {
        email: settingsResult.rows[0].email,
        clientId: settingsResult.rows[0].client_id,
        mode: settingsResult.rows[0].mode,
        currency: settingsResult.rows[0].currency
      } : null;

      return res.status(200).json({
        invoice: formattedInvoice,
        project: formattedProject,
        paypalSettings: formattedSettings
      });
    }

    // -------------------------------------------------------------
    // Public Endpoint: Update Invoice Status (e.g. Paid during checkout)
    // -------------------------------------------------------------
    if (req.method === 'POST' && id) {
      const invoiceId = id as string;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ error: 'Missing status in body' });
      }

      await sql`
        UPDATE invoices SET status = ${status} WHERE id = ${invoiceId};
      `;

      return res.status(200).json({ status: 'success', message: `Invoice status updated to ${status}` });
    }

    // -------------------------------------------------------------
    // Private Endpoints: Require User Context
    // -------------------------------------------------------------
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: missing user context' });
    }

    if (req.method === 'GET') {
      const result = await sql`
        SELECT * FROM invoices WHERE user_id = ${userId} ORDER BY date DESC;
      `;

      const invoices = result.rows.map(row => ({
        id: row.id,
        invoiceNumber: row.invoice_number,
        clientName: row.client_name,
        clientEmail: row.client_email,
        date: row.date.toISOString().split('T')[0],
        dueDate: row.due_date.toISOString().split('T')[0],
        items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
        subtotal: parseFloat(row.subtotal),
        taxRate: parseFloat(row.tax_rate),
        taxAmount: parseFloat(row.tax_amount),
        discount: parseFloat(row.discount),
        total: parseFloat(row.total),
        status: row.status,
        projectId: row.project_id,
        currency: row.currency
      }));

      return res.status(200).json(invoices);
    }

    if (req.method === 'POST') {
      const invoicesList = req.body; // Expect array of Invoices

      if (!Array.isArray(invoicesList)) {
        return res.status(400).json({ error: 'Body must be an array of invoices' });
      }

      const incomingIds = invoicesList.map(inv => inv.id);

      // Deletions: Remove invoices not in incoming list
      if (incomingIds.length > 0) {
        await sql`
          DELETE FROM invoices 
          WHERE user_id = ${userId} AND id NOT IN (${incomingIds});
        `;
      } else {
        await sql`
          DELETE FROM invoices WHERE user_id = ${userId};
        `;
      }

      // Upsert invoices
      for (const inv of invoicesList) {
        const itemsJson = JSON.stringify(inv.items);
        const dateObj = new Date(inv.date);
        const dueDateObj = new Date(inv.dueDate);

        await sql`
          INSERT INTO invoices (
            id, user_id, invoice_number, client_name, client_email,
            date, due_date, items, subtotal, tax_rate, tax_amount,
            discount, total, status, project_id, currency
          )
          VALUES (
            ${inv.id}, ${userId}, ${inv.invoiceNumber}, ${inv.clientName}, ${inv.clientEmail},
            ${dateObj}, ${dueDateObj}, ${itemsJson}, ${inv.subtotal}, ${inv.taxRate}, ${inv.taxAmount},
            ${inv.discount}, ${inv.total}, ${inv.status}, ${inv.projectId}, ${inv.currency}
          )
          ON CONFLICT (id) DO UPDATE SET
            invoice_number = EXCLUDED.invoice_number,
            client_name = EXCLUDED.client_name,
            client_email = EXCLUDED.client_email,
            date = EXCLUDED.date,
            due_date = EXCLUDED.due_date,
            items = EXCLUDED.items,
            subtotal = EXCLUDED.subtotal,
            tax_rate = EXCLUDED.tax_rate,
            tax_amount = EXCLUDED.tax_amount,
            discount = EXCLUDED.discount,
            total = EXCLUDED.total,
            status = EXCLUDED.status,
            project_id = EXCLUDED.project_id,
            currency = EXCLUDED.currency;
        `;
      }

      return res.status(200).json({ status: 'success', message: 'Invoices synced' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Invoices handler error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
