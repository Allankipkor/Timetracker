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
      // 1. Fetch user projects
      const projectsResult = await sql`
        SELECT * FROM projects WHERE user_id = ${userId};
      `;

      if (projectsResult.rows.length === 0) {
        return res.status(200).json([]);
      }

      const projects = projectsResult.rows;

      // 2. Fetch tasks for all user projects
      const projectIds = projects.map(p => p.id);
      
      // PostgreSQL handles IN queries via ANY($1)
      const tasksResult = await sql`
        SELECT * FROM tasks WHERE project_id = ANY(${projectIds});
      `;

      const tasks = tasksResult.rows;

      // 3. Map tasks to projects
      const formattedProjects = projects.map(project => ({
        id: project.id,
        name: project.name,
        clientName: project.client_name,
        color: project.color,
        hourlyRate: parseFloat(project.hourly_rate),
        tasks: tasks
          .filter(t => t.project_id === project.id)
          .map(t => ({ id: t.id, name: t.name }))
      }));

      return res.status(200).json(formattedProjects);
    } 

    if (req.method === 'POST') {
      const projectsList = req.body; // Expect array of Project objects

      if (!Array.isArray(projectsList)) {
        return res.status(400).json({ error: 'Body must be an array of projects' });
      }

      // Sync projects and tasks inside a transaction
      // Vercel Postgres does not have a formal transaction command on sql tag easily,
      // but we can query them sequentially or use a client from pool.
      // Let's do it sequentially.
      
      const incomingIds = projectsList.map(p => p.id);

      // Deletions: Remove database records not in incoming list
      if (incomingIds.length > 0) {
        await sql`
          DELETE FROM projects 
          WHERE user_id = ${userId} AND id <> ALL (${incomingIds});
        `;
      } else {
        await sql`
          DELETE FROM projects WHERE user_id = ${userId};
        `;
      }

      // Upsert projects
      for (const p of projectsList) {
        await sql`
          INSERT INTO projects (id, user_id, name, client_name, color, hourly_rate)
          VALUES (${p.id}, ${userId}, ${p.name}, ${p.clientName}, ${p.color}, ${p.hourlyRate})
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            client_name = EXCLUDED.client_name,
            color = EXCLUDED.color,
            hourly_rate = EXCLUDED.hourly_rate;
        `;

        // Upsert tasks for this project
        const incomingTaskIds = p.tasks.map((t: any) => t.id);
        
        // Deletions for this project's tasks
        if (incomingTaskIds.length > 0) {
          await sql`
            DELETE FROM tasks 
            WHERE project_id = ${p.id} AND id <> ALL (${incomingTaskIds});
          `;
        } else {
          await sql`
            DELETE FROM tasks WHERE project_id = ${p.id};
          `;
        }

        // Insert new/updated tasks
        for (const t of p.tasks) {
          await sql`
            INSERT INTO tasks (id, project_id, name)
            VALUES (${t.id}, ${p.id}, ${t.name})
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name;
          `;
        }
      }

      return res.status(200).json({ status: 'success', message: 'Projects synced' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Projects handler error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
