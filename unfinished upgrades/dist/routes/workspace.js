"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORKSPACE_ROOT = void 0;
const express_1 = require("express");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
// ─── Workspace (local filesystem) ─────────────────────────────────────────────
// Preserves the original GateAi behavior: a single local workspace directory.
const router = (0, express_1.Router)();
exports.WORKSPACE_ROOT = path_1.default.join(os_1.default.homedir(), 'GateAI-Workspace');
if (!fs_1.default.existsSync(exports.WORKSPACE_ROOT)) {
    fs_1.default.mkdirSync(exports.WORKSPACE_ROOT, { recursive: true });
    fs_1.default.writeFileSync(path_1.default.join(exports.WORKSPACE_ROOT, 'hello.html'), `<!DOCTYPE html>
<html>
<head><title>Hello from GateAI</title>
<style>
  body { font-family: sans-serif; padding: 40px; background: #1a1a2e; color: #eee; }
  h1   { color: #7c6af7; }
  p    { color: #aaa; }
</style>
</head>
<body>
  <h1>Hello from GateAI</h1>
  <p>Edit this file or create new ones using the file explorer on the left.</p>
  <p>Ask the AI assistant on the right for help building anything.</p>
</body>
</html>`);
    fs_1.default.writeFileSync(path_1.default.join(exports.WORKSPACE_ROOT, 'notes.md'), '# My Notes\n\nStart typing here...\n');
}
// ─── Helpers ──────────────────────────────────────────────────────────────────
function safePath(rel) {
    const abs = path_1.default.resolve(exports.WORKSPACE_ROOT, rel ?? '');
    if (!abs.startsWith(exports.WORKSPACE_ROOT))
        throw new Error('Path traversal blocked');
    return abs;
}
function buildTree(dir, base = '') {
    const entries = fs_1.default.readdirSync(dir, { withFileTypes: true });
    const result = [];
    for (const e of entries) {
        if (e.name.startsWith('.'))
            continue;
        const rel = base ? `${base}/${e.name}` : e.name;
        if (e.isDirectory()) {
            result.push({ name: e.name, type: 'dir', path: rel, children: buildTree(path_1.default.join(dir, e.name), rel) });
        }
        else {
            result.push({ name: e.name, type: 'file', path: rel });
        }
    }
    return result.sort((a, b) => {
        if (a.type !== b.type)
            return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
    });
}
// ─── Routes ───────────────────────────────────────────────────────────────────
router.get('/api/files', (_req, res) => {
    try {
        res.json({ tree: buildTree(exports.WORKSPACE_ROOT), root: exports.WORKSPACE_ROOT });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/api/files/content', (req, res) => {
    try {
        const abs = safePath(req.query.path);
        const content = fs_1.default.readFileSync(abs, 'utf8');
        res.json({ content, path: req.query.path });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.post('/api/files/content', (req, res) => {
    try {
        const { path: rel, content } = req.body;
        const abs = safePath(rel);
        fs_1.default.mkdirSync(path_1.default.dirname(abs), { recursive: true });
        fs_1.default.writeFileSync(abs, content, 'utf8');
        res.json({ ok: true });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.post('/api/files/create', (req, res) => {
    try {
        const { path: rel, type } = req.body;
        const abs = safePath(rel);
        if (type === 'dir') {
            fs_1.default.mkdirSync(abs, { recursive: true });
        }
        else {
            fs_1.default.mkdirSync(path_1.default.dirname(abs), { recursive: true });
            if (!fs_1.default.existsSync(abs))
                fs_1.default.writeFileSync(abs, '', 'utf8');
        }
        res.json({ ok: true });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.post('/api/files/rename', (req, res) => {
    try {
        const { from, to } = req.body;
        fs_1.default.renameSync(safePath(from), safePath(to));
        res.json({ ok: true });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.delete('/api/files', (req, res) => {
    try {
        const abs = safePath(req.query.path);
        if (fs_1.default.statSync(abs).isDirectory()) {
            fs_1.default.rmSync(abs, { recursive: true });
        }
        else {
            fs_1.default.unlinkSync(abs);
        }
        res.json({ ok: true });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
const search_js_1 = require("../utils/search.js");
router.get('/api/workspace/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) {
            res.status(400).json({ error: 'Search query (q) is required' });
            return;
        }
        // We only search within the Workspace Root
        const results = await (0, search_js_1.searchFiles)(query, exports.WORKSPACE_ROOT);
        // Map absolute paths back to relative paths for the client
        const mapped = results.map(r => ({
            ...r,
            filePath: r.filePath.startsWith(exports.WORKSPACE_ROOT)
                ? r.filePath.substring(exports.WORKSPACE_ROOT.length + 1) // +1 for slash
                : r.filePath
        }));
        res.json(mapped);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
