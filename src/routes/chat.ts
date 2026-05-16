import { Router, type Request, type Response } from 'express';
import { route } from '../core/router.js';

// ─── Chat Stream ──────────────────────────────────────────────────────────────

const router = Router();

router.post('/api/chat/stream', async (req: Request, res: Response) => {
  const { messages, provider = 'gemini' } = req.body as {
    messages: { role: string; content: string }[];
    provider?: string;
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
    const result = await route(
      messages as { role: 'user' | 'assistant'; content: string }[],
      provider,
      (text) => send({ type: 'chunk', text }),
      (r)    => send({ type: 'route', ...r }),
      ac.signal,
    );
    send({ type: 'done', ...result });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    if (msg === 'aborted') {
      send({ type: 'aborted' });
    } else {
      send({ type: 'error', message: msg });
    }
  }

  res.end();
});

export default router;
