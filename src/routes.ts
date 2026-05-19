import { Router, type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

import { route }            from './core/router.js';
import { buildSystemPrompt } from './core/prompt.js';
import { budgeHistory }      from './utils/historyBudge.js';
import { orchestrate }       from './core/orchestrator.js';
import { selfHealLoop }      from './core/selfHealLoop.js';
import { parseActions, executeActions, buildActionContext } from './core/executor.js';
import { checkpointManager } from './services/checkpoint.js';
import { indexWorkspace, semanticSearch } from './services/semanticSearch.js';
import { searchFiles }       from './utils/search.js';
import * as keyStore         from './services/keyStore.js';
import * as keyPool          from './services/keyPool.js';
import { type Message }      from './providers/adapters.js';

export const WORKSPACE_ROOT = path.join(os.homedir(), 'Yazıcı-Workspace');

const router = Router();

// ─── Health ───────────────────────────────────────────────────────────────────
router.get('/api/health', (_req, res) => {
  res.json({ ok: true, version: '4.0.0', ts: new Date().toISOString() });
});

// ─── Keys ────────────────────────────────────────────────────────────────────
router.get('/api/keys', (_req, res) => res.json(keyStore.listKeys()));

router.post('/api/keys', (req, res) => {
  const { provider, key } = req.body;
  if (!provider || !key) { res.status(400).json({ error: 'provider and key required' }); return; }
  keyStore.addKey(provider, key);
  res.json({ ok: true });
});

router.delete('/api/keys/:provider/:index', (req, res) => {
  keyStore.removeKey(req.params.provider!, parseInt(req.params.index!, 10));
  res.json({ ok: true });
});

router.post('/api/keys/sudo', (req, res) => {
  const { password } = req.body;
  if (!password) { res.status(400).json({ error: 'password required' }); return; }
  keyStore.setSudoPass(password);
  res.json({ ok: true });
});

router.get('/api/keys/sudo/status', (_req, res) => {
  res.json({ hasSudo: !!keyStore.getSudoPass() });
});

router.get('/api/status', (_req, res) => res.json(keyPool.getStatus()));

// ─── Workspace File API ───────────────────────────────────────────────────────
function safePath(rel: string): string {
  if (!fs.existsSync(WORKSPACE_ROOT)) fs.mkdirSync(WORKSPACE_ROOT, { recursive: true });
  const abs = path.resolve(WORKSPACE_ROOT, rel);
  if (!abs.startsWith(WORKSPACE_ROOT)) throw new Error('Path traversal blocked');
  return abs;
}

router.get('/api/files', (req, res) => {
  try {
    const dirPath = (req.query.path as string) || '';
    const abs = safePath(dirPath);
    if (!fs.existsSync(abs)) { res.json({ files: [] }); return; }
    const entries = fs.readdirSync(abs, { withFileTypes: true });
    const files = entries.map(e => ({
      name: e.name,
      path: path.join(dirPath, e.name),
      isDir: e.isDirectory(),
      size: e.isFile() ? fs.statSync(path.join(abs, e.name)).size : 0,
    }));
    res.json({ files });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/file', (req, res) => {
  try {
    const filePath = (req.query.path as string);
    if (!filePath) { res.status(400).json({ error: 'path required' }); return; }
    const abs = safePath(filePath);
    const content = fs.readFileSync(abs, 'utf8');
    res.json({ content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/file', (req, res) => {
  try {
    const { path: filePath, content } = req.body;
    if (!filePath) { res.status(400).json({ error: 'path required' }); return; }
    const abs = safePath(filePath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content || '', 'utf8');
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/api/file', (req, res) => {
  try {
    const filePath = (req.query.path as string);
    if (!filePath) { res.status(400).json({ error: 'path required' }); return; }
    const abs = safePath(filePath);
    if (fs.statSync(abs).isDirectory()) fs.rmSync(abs, { recursive: true });
    else fs.unlinkSync(abs);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Search ───────────────────────────────────────────────────────────────────
router.get('/api/search', async (req, res) => {
  const { q } = req.query as { q?: string };
  if (!q) { res.status(400).json({ error: 'q required' }); return; }
  try {
    const results = await searchFiles(q, WORKSPACE_ROOT);
    res.json({ results: results.slice(0, 100) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/search/semantic', async (req, res) => {
  const { query } = req.body;
  try {
    const results = await semanticSearch(query);
    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Checkpoints ──────────────────────────────────────────────────────────────
router.get('/api/checkpoints', (_req, res) => {
  res.json({ checkpoints: checkpointManager.list() });
});

router.post('/api/checkpoints/restore', async (req, res) => {
  const { id } = req.query as { id: string };
  try {
    await checkpointManager.restoreCheckpoint(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Git ──────────────────────────────────────────────────────────────────────
router.post('/api/git/commit', async (req, res) => {
  const { message } = req.body;
  try {
    execSync('git add .', { cwd: WORKSPACE_ROOT });
    execSync(`git commit -m "${(message || 'Update').replace(/"/g, '\\"')}"`, { cwd: WORKSPACE_ROOT });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Chat Stream ──────────────────────────────────────────────────────────────
router.post('/api/chat/stream', async (req: Request, res: Response) => {
  const { messages, provider = 'gemini', agentMode = 'mono', strict = false } = req.body as {
    messages: { role: string; content: string }[];
    provider?: string;
    agentMode?: string;
    strict?: boolean;
  };

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: 'messages array required' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (obj: object) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  const ac   = new AbortController();
  req.on('close', () => ac.abort());

  try {
    const budgedMessages = budgeHistory(messages as Message[]);
    await orchestrate(budgedMessages, provider, agentMode, (t) => send({ type: 'chunk', text: t }));

    const lastQuery = (messages[messages.length - 1] as Message)?.content || '';
    const systemPrompt = await buildSystemPrompt(strict, lastQuery);

    let fullResponse = '';
    const result = await route(
      budgedMessages, provider,
      (text) => { fullResponse += text; send({ type: 'chunk', text }); },
      (r)    => send({ type: 'route', ...r }),
      { signal: ac.signal, system: systemPrompt, strict }
    );

    const actions = parseActions(fullResponse);
    if (actions.length > 0) {
      const needsSnapshot = actions.some(a => ['write_file','patch_file','delete_file'].includes(a.tool));
      if (needsSnapshot) await checkpointManager.createCheckpoint(`Before: ${lastQuery.slice(0,30)}...`);

      for (const a of actions) send({ type: 'action_start', tool: a.tool, target: a.target });

      const actionResults = await executeActions(actions, (step) => send({ type: 'action_step', text: step }));
      const actionResultContext = buildActionContext(actionResults);

      if (actionResultContext) {
        const followUp: Message[] = [
          ...messages as Message[],
          { role: 'assistant', content: fullResponse },
          { role: 'user', content: `[TOOL RESULTS]\n${actionResultContext}\n\nNow continue based on the above.` },
        ];
        await route(followUp, provider,
          (text) => send({ type: 'chunk', text }),
          (_r) => {},
          { signal: ac.signal, system: systemPrompt, strict }
        );
        send({ type: 'done', ...result, actions: actions.length, followUp: true });
        await selfHealLoop(messages as Message[], provider, (t) => send({ type: 'chunk', text: t }));
      } else {
        send({ type: 'done', ...result, actions: actions.length });
        await selfHealLoop(messages as Message[], provider, (t) => send({ type: 'chunk', text: t }));
      }
    } else {
      send({ type: 'done', ...result });
    }
  } catch (err: unknown) {
    const msg = (err as Error).message;
    if (msg === 'aborted') send({ type: 'aborted' });
    else                   send({ type: 'error', message: msg });
  }
  res.end();
});

export default router;
