"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_js_1 = require("../db/index.js");
// ─── Environments ─────────────────────────────────────────────────────────────
const router = (0, express_1.Router)();
// LIST
router.get('/api/projects/:projectId/environments', (req, res) => {
    res.json(index_js_1.db.prepare('SELECT * FROM environments WHERE project_id = ?').all(req.params.projectId));
});
// CREATE
router.post('/api/projects/:projectId/environments', (req, res) => {
    try {
        const { name, runtime } = req.body;
        if (!name) {
            res.status(400).json({ error: 'name required' });
            return;
        }
        const env = index_js_1.db.prepare(`INSERT INTO environments (project_id, name, runtime)
       VALUES (?, ?, ?) RETURNING *`).get(req.params.projectId, name, runtime ?? null);
        res.status(201).json(env);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// GET
router.get('/api/projects/:projectId/environments/:envId', (req, res) => {
    const env = index_js_1.db.prepare('SELECT * FROM environments WHERE id = ? AND project_id = ?').get(req.params.envId, req.params.projectId);
    if (!env) {
        res.status(404).json({ error: 'Environment not found' });
        return;
    }
    res.json(env);
});
// UPDATE
router.patch('/api/projects/:projectId/environments/:envId', (req, res) => {
    try {
        const { name, runtime, status } = req.body;
        const fields = [];
        const params = [];
        if (name != null) {
            fields.push('name = ?');
            params.push(name);
        }
        if (runtime != null) {
            fields.push('runtime = ?');
            params.push(runtime);
        }
        if (status != null) {
            fields.push('status = ?');
            params.push(status);
        }
        if (!fields.length) {
            res.status(400).json({ error: 'Nothing to update' });
            return;
        }
        fields.push("updated_at = datetime('now')");
        params.push(req.params.envId, req.params.projectId);
        const env = index_js_1.db.prepare(`UPDATE environments SET ${fields.join(', ')} WHERE id = ? AND project_id = ? RETURNING *`).get(...params);
        if (!env) {
            res.status(404).json({ error: 'Environment not found' });
            return;
        }
        res.json(env);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// DELETE
router.delete('/api/projects/:projectId/environments/:envId', (req, res) => {
    const env = index_js_1.db.prepare('DELETE FROM environments WHERE id = ? AND project_id = ? RETURNING id').get(req.params.envId, req.params.projectId);
    if (!env) {
        res.status(404).json({ error: 'Environment not found' });
        return;
    }
    res.sendStatus(204);
});
// START / STOP / RESTART (status transitions)
for (const [verb, status] of [['start', 'running'], ['stop', 'stopped'], ['restart', 'running']]) {
    router.post(`/api/projects/:projectId/environments/:envId/${verb}`, (req, res) => {
        const env = index_js_1.db.prepare(`UPDATE environments SET status = ?, updated_at = datetime('now')
       WHERE id = ? AND project_id = ? RETURNING *`).get(status, req.params.envId, req.params.projectId);
        if (!env) {
            res.status(404).json({ error: 'Environment not found' });
            return;
        }
        res.json(env);
    });
}
// ─── Env Vars ─────────────────────────────────────────────────────────────────
router.get('/api/projects/:projectId/environments/:envId/vars', (req, res) => {
    res.json(index_js_1.db.prepare('SELECT * FROM env_vars WHERE env_id = ?').all(req.params.envId));
});
router.put('/api/projects/:projectId/environments/:envId/vars/:key', (req, res) => {
    try {
        const { value } = req.body;
        if (value == null) {
            res.status(400).json({ error: 'value required' });
            return;
        }
        const v = index_js_1.db.prepare(`INSERT INTO env_vars (env_id, key, value) VALUES (?, ?, ?)
       ON CONFLICT(env_id, key) DO UPDATE SET value = excluded.value
       RETURNING *`).get(req.params.envId, req.params.key, value);
        res.json(v);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.delete('/api/projects/:projectId/environments/:envId/vars/:key', (req, res) => {
    index_js_1.db.prepare('DELETE FROM env_vars WHERE env_id = ? AND key = ?').run(req.params.envId, req.params.key);
    res.sendStatus(204);
});
exports.default = router;
