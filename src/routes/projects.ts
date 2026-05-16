import { Router } from 'express';
import { db } from '../db/index.js';

// ─── Projects ─────────────────────────────────────────────────────────────────

const router = Router();

// LIST
router.get('/api/projects', (req, res) => {
  try {
    const { search, language, limit = '50', offset = '0' } = req.query as Record<string, string>;
    let sql  = 'SELECT * FROM projects WHERE 1=1';
    const params: unknown[] = [];

    if (search)   { sql += ' AND name LIKE ?';     params.push(`%${search}%`); }
    if (language) { sql += ' AND language = ?';    params.push(language); }
    sql += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    res.json(db.prepare(sql).all(...params));
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// CREATE
router.post('/api/projects', (req, res) => {
  try {
    const { name, description, language } = req.body as {
      name: string;
      description?: string;
      language?: string;
    };
    if (!name) { res.status(400).json({ error: 'name required' }); return; }

    const project = db.prepare(
      `INSERT INTO projects (name, description, language)
       VALUES (?, ?, ?)
       RETURNING *`,
    ).get(name, description ?? null, language ?? null);

    res.status(201).json(project);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET
router.get('/api/projects/:id', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
  res.json(project);
});

// UPDATE
router.patch('/api/projects/:id', (req, res) => {
  try {
    const { name, description, language } = req.body as Partial<{
      name: string;
      description: string;
      language: string;
    }>;
    const fields: string[] = [];
    const params: unknown[] = [];

    if (name        != null) { fields.push('name = ?');        params.push(name); }
    if (description != null) { fields.push('description = ?'); params.push(description); }
    if (language    != null) { fields.push('language = ?');    params.push(language); }
    if (!fields.length)      { res.status(400).json({ error: 'Nothing to update' }); return; }

    fields.push("updated_at = datetime('now')");
    params.push(req.params.id);

    const project = db.prepare(
      `UPDATE projects SET ${fields.join(', ')} WHERE id = ? RETURNING *`,
    ).get(...params);

    if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
    res.json(project);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// DELETE
router.delete('/api/projects/:id', (req, res) => {
  const project = db.prepare('DELETE FROM projects WHERE id = ? RETURNING *').get(req.params.id);
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
  res.sendStatus(204);
});

// STATS
router.get('/api/projects/:id/stats', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }

  const fileStats = db.prepare(
    `SELECT COUNT(*) as count, COALESCE(SUM(size), 0) as total_size
     FROM files WHERE project_id = ?`,
  ).get(req.params.id) as { count: number; total_size: number };

  const jobStats = db.prepare(
    `SELECT COUNT(*) as count FROM print_jobs WHERE project_id = ?`,
  ).get(req.params.id) as { count: number };

  res.json({
    fileCount:      fileStats.count,
    totalSizeBytes: fileStats.total_size,
    printJobCount:  jobStats.count,
    lastActiveAt:   (project as { updated_at: string }).updated_at,
  });
});

export default router;
