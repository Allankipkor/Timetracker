import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './_utils/db.js';

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
        SELECT * FROM time_entries 
        WHERE user_id = ${userId}
        ORDER BY start_time DESC;
      `;

      const entries = result.rows.map(row => ({
        id: row.id,
        description: row.description,
        projectId: row.project_id,
        taskId: row.task_id || '',
        startTime: row.start_time.toISOString(),
        endTime: row.end_time ? row.end_time.toISOString() : null,
        duration: parseInt(row.duration),
        isBillable: row.is_billable,
        isInvoiceGenerated: row.is_invoice_generated,
        invoiceId: row.invoice_id || null
      }));

      return res.status(200).json(entries);
    }

    if (req.method === 'POST') {
      const entriesList = req.body; // Expect array of TimeEntry

      if (!Array.isArray(entriesList)) {
        return res.status(400).json({ error: 'Body must be an array of time entries' });
      }

      const incomingIds = entriesList.map(e => e.id);

      // Deletions: Remove entries not in incoming list
      if (incomingIds.length > 0) {
        await sql`
          DELETE FROM time_entries 
          WHERE user_id = ${userId} AND id <> ALL (${incomingIds});
        `;
      } else {
        await sql`
          DELETE FROM time_entries WHERE user_id = ${userId};
        `;
      }

      // Upsert entries
      for (const e of entriesList) {
        const taskId = e.taskId || null;
        const endTime = e.endTime ? new Date(e.endTime) : null;
        const startTime = new Date(e.startTime);

        await sql`
          INSERT INTO time_entries (
            id, user_id, description, project_id, task_id, 
            start_time, end_time, duration, is_billable, 
            is_invoice_generated, invoice_id
          )
          VALUES (
            ${e.id}, ${userId}, ${e.description}, ${e.projectId}, ${taskId},
            ${startTime}, ${endTime}, ${e.duration}, ${e.isBillable},
            ${e.isInvoiceGenerated}, ${e.invoiceId}
          )
          ON CONFLICT (id) DO UPDATE SET
            description = EXCLUDED.description,
            project_id = EXCLUDED.project_id,
            task_id = EXCLUDED.task_id,
            start_time = EXCLUDED.start_time,
            end_time = EXCLUDED.end_time,
            duration = EXCLUDED.duration,
            is_billable = EXCLUDED.is_billable,
            is_invoice_generated = EXCLUDED.is_invoice_generated,
            invoice_id = EXCLUDED.invoice_id;
        `;
      }

      return res.status(200).json({ status: 'success', message: 'Time entries synced' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Time entries handler error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
