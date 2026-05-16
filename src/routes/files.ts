import { Router } from 'express';
import { db, touchProject, contentSize } from '../db/index.js';

// ─── Project Files ────────────────────────────────────────────────────────────

const router = Router();

// LIST
router.get('/api/projects/:projectId/files', (req, res) => {
  try {
    const { path, q, caseSensitive } = req.query as {
      path?: string;
      q?: string;
      caseSensitive?: string;
    };

    let sql    = 'SELECT * FROM files WHERE project_id = ?';
    const params: unknown[] = [req.params.projectId];

    if (path) { sql += ' AND path LIKE ?'; params.push(`${path}%`); }
    sql += ' ORDER BY is_dir DESC, path ASC';

    let files = db.prepare(sql).all(...params) as {
      id: string; path: string; content: string; is_dir: number;
    }[];

    // Search within file content
    if (q) {
      const term  = caseSensitive === 'true' ? q : q.toLowerCase();
      const results: object[] = [];

      for (const file of files) {
        if (file.is_dir) continue;
        const lines = file.content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line  = lines[i]!;
          const haystack = caseSensitive === 'true' ? line : line.toLowerCase();
          const col      = haystack.indexOf(term);
          if (col === -1) continue;
          results.push({ fileId: file.id, path: file.path, line: i + 1, column: col + 1, matchText: q, context: line.trim() });
        }
      }
      res.json(results);
      return;
    }

    res.json(files);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// CREATE / UPSERT
router.post('/api/projects/:projectId/files', (req, res) => {
  try {
    const { path, content = '', isDir = false } = req.body as {
      path: string;
      content?: string;
      isDir?: boolean;
    };
    if (!path) { res.status(400).json({ error: 'path required' }); return; }

    const existing = db.prepare(
      'SELECT id FROM files WHERE project_id = ? AND path = ?',
    ).get(req.params.projectId, path);

    let file: unknown;
    if (existing) {
      file = db.prepare(
        `UPDATE files SET content = ?, size = ?, updated_at = datetime('now')
         WHERE project_id = ? AND path = ? RETURNING *`,
      ).get(content, contentSize(content), req.params.projectId, path);
    } else {
      file = db.prepare(
        `INSERT INTO files (project_id, path, content, is_dir, size)
         VALUES (?, ?, ?, ?, ?) RETURNING *`,
      ).get(req.params.projectId, path, content, isDir ? 1 : 0, contentSize(content));
    }

    touchProject(req.params.projectId!);
    res.status(201).json(file);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET
router.get('/api/projects/:projectId/files/:fileId', (req, res) => {
  const file = db.prepare(
    'SELECT * FROM files WHERE id = ? AND project_id = ?',
  ).get(req.params.fileId, req.params.projectId);
  if (!file) { res.status(404).json({ error: 'File not found' }); return; }
  res.json(file);
});

// UPDATE
router.patch('/api/projects/:projectId/files/:fileId', (req, res) => {
  try {
    const { content } = req.body as { content?: string };
    if (content == null) { res.status(400).json({ error: 'content required' }); return; }

    const file = db.prepare(
      `UPDATE files SET content = ?, size = ?, updated_at = datetime('now')
       WHERE id = ? AND project_id = ? RETURNING *`,
    ).get(content, contentSize(content), req.params.fileId, req.params.projectId);

    if (!file) { res.status(404).json({ error: 'File not found' }); return; }
    touchProject(req.params.projectId!);
    res.json(file);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// RENAME
router.post('/api/projects/:projectId/files/:fileId/rename', (req, res) => {
  try {
    const { newPath } = req.body as { newPath: string };
    if (!newPath) { res.status(400).json({ error: 'newPath required' }); return; }

    const file = db.prepare(
      `UPDATE files SET path = ?, updated_at = datetime('now')
       WHERE id = ? AND project_id = ? RETURNING *`,
    ).get(newPath, req.params.fileId, req.params.projectId);

    if (!file) { res.status(404).json({ error: 'File not found' }); return; }
    touchProject(req.params.projectId!);
    res.json(file);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// DELETE
router.delete('/api/projects/:projectId/files/:fileId', (req, res) => {
  const file = db.prepare(
    'DELETE FROM files WHERE id = ? AND project_id = ? RETURNING id',
  ).get(req.params.fileId, req.params.projectId);
  if (!file) { res.status(404).json({ error: 'File not found' }); return; }
  touchProject(req.params.projectId!);
  res.sendStatus(204);
});

export default router;
