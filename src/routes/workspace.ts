import { Router } from 'express';
import fs   from 'fs';
import path from 'path';
import os   from 'os';

// ─── Workspace (local filesystem) ─────────────────────────────────────────────
// Preserves the original GateAi behavior: a single local workspace directory.

const router = Router();

const WORKSPACE_ROOT = path.join(os.homedir(), 'GateAI-Workspace');

if (!fs.existsSync(WORKSPACE_ROOT)) {
  fs.mkdirSync(WORKSPACE_ROOT, { recursive: true });
  fs.writeFileSync(
    path.join(WORKSPACE_ROOT, 'hello.html'),
    `<!DOCTYPE html>
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
</html>`,
  );
  fs.writeFileSync(path.join(WORKSPACE_ROOT, 'notes.md'), '# My Notes\n\nStart typing here...\n');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safePath(rel: string): string {
  const abs = path.resolve(WORKSPACE_ROOT, rel ?? '');
  if (!abs.startsWith(WORKSPACE_ROOT)) throw new Error('Path traversal blocked');
  return abs;
}

type TreeEntry = {
  name: string;
  type: 'dir' | 'file';
  path: string;
  children?: TreeEntry[];
};

function buildTree(dir: string, base = ''): TreeEntry[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const result: TreeEntry[] = [];

  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) {
      result.push({ name: e.name, type: 'dir', path: rel, children: buildTree(path.join(dir, e.name), rel) });
    } else {
      result.push({ name: e.name, type: 'file', path: rel });
    }
  }

  return result.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get('/api/files', (_req, res) => {
  try {
    res.json({ tree: buildTree(WORKSPACE_ROOT), root: WORKSPACE_ROOT });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/api/files/content', (req, res) => {
  try {
    const abs     = safePath(req.query.path as string);
    const content = fs.readFileSync(abs, 'utf8');
    res.json({ content, path: req.query.path });
  } catch (err: unknown) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post('/api/files/content', (req, res) => {
  try {
    const { path: rel, content } = req.body as { path: string; content: string };
    const abs = safePath(rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post('/api/files/create', (req, res) => {
  try {
    const { path: rel, type } = req.body as { path: string; type: 'file' | 'dir' };
    const abs = safePath(rel);
    if (type === 'dir') {
      fs.mkdirSync(abs, { recursive: true });
    } else {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      if (!fs.existsSync(abs)) fs.writeFileSync(abs, '', 'utf8');
    }
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post('/api/files/rename', (req, res) => {
  try {
    const { from, to } = req.body as { from: string; to: string };
    fs.renameSync(safePath(from), safePath(to));
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.delete('/api/files', (req, res) => {
  try {
    const abs = safePath(req.query.path as string);
    if (fs.statSync(abs).isDirectory()) {
      fs.rmSync(abs, { recursive: true });
    } else {
      fs.unlinkSync(abs);
    }
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(400).json({ error: (err as Error).message });
  }
});

export default router;
