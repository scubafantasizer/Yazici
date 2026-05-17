"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_js_1 = require("../db/index.js");
// ─── Projects ─────────────────────────────────────────────────────────────────
const router = (0, express_1.Router)();
// LIST
router.get('/api/projects', (req, res) => {
    try {
        const { search, language, limit = '50', offset = '0' } = req.query;
        let sql = 'SELECT * FROM projects WHERE 1=1';
        const params = [];
        if (search) {
            sql += ' AND name LIKE ?';
            params.push(`%${search}%`);
        }
        if (language) {
            sql += ' AND language = ?';
            params.push(language);
        }
        sql += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit, 10), parseInt(offset, 10));
        res.json(index_js_1.db.prepare(sql).all(...params));
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// CREATE
router.post('/api/projects', (req, res) => {
    try {
        const { name, description, language } = req.body;
        if (!name) {
            res.status(400).json({ error: 'name required' });
            return;
        }
        const project = index_js_1.db.prepare(`INSERT INTO projects (name, description, language)
       VALUES (?, ?, ?)
       RETURNING *`).get(name, description ?? null, language ?? null);
        res.status(201).json(project);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// GET
router.get('/api/projects/:id', (req, res) => {
    const project = index_js_1.db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
    }
    res.json(project);
});
// UPDATE
router.patch('/api/projects/:id', (req, res) => {
    try {
        const { name, description, language } = req.body;
        const fields = [];
        const params = [];
        if (name != null) {
            fields.push('name = ?');
            params.push(name);
        }
        if (description != null) {
            fields.push('description = ?');
            params.push(description);
        }
        if (language != null) {
            fields.push('language = ?');
            params.push(language);
        }
        if (!fields.length) {
            res.status(400).json({ error: 'Nothing to update' });
            return;
        }
        fields.push("updated_at = datetime('now')");
        params.push(req.params.id);
        const project = index_js_1.db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ? RETURNING *`).get(...params);
        if (!project) {
            res.status(404).json({ error: 'Project not found' });
            return;
        }
        res.json(project);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// DELETE
router.delete('/api/projects/:id', (req, res) => {
    const project = index_js_1.db.prepare('DELETE FROM projects WHERE id = ? RETURNING *').get(req.params.id);
    if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
    }
    res.sendStatus(204);
});
// STATS
router.get('/api/projects/:id/stats', (req, res) => {
    const project = index_js_1.db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
    }
    const fileStats = index_js_1.db.prepare(`SELECT COUNT(*) as count, COALESCE(SUM(size), 0) as total_size
     FROM files WHERE project_id = ?`).get(req.params.id);
    const jobStats = index_js_1.db.prepare(`SELECT COUNT(*) as count FROM print_jobs WHERE project_id = ?`).get(req.params.id);
    res.json({
        fileCount: fileStats.count,
        totalSizeBytes: fileStats.total_size,
        printJobCount: jobStats.count,
        lastActiveAt: project.updated_at,
    });
});
exports.default = router;
