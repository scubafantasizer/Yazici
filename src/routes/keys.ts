import { Router } from 'express';
import * as keyStore from '../services/keyStore.js';
import * as keyPool  from '../services/keyPool.js';

// ─── Key Management ───────────────────────────────────────────────────────────

const router = Router();

router.get('/api/keys', (_req, res) => {
  res.json(keyStore.listKeys());
});

router.post('/api/keys', (req, res) => {
  const { provider, key } = req.body as { provider?: string; key?: string };
  if (!provider || !key) {
    res.status(400).json({ error: 'provider and key required' });
    return;
  }
  keyStore.addKey(provider, key);
  res.json({ ok: true });
});

router.delete('/api/keys/:provider/:index', (req, res) => {
  keyStore.removeKey(req.params.provider!, parseInt(req.params.index!, 10));
  res.json({ ok: true });
});

router.delete('/api/keys/:provider', (req, res) => {
  keyStore.clearProvider(req.params.provider!);
  res.json({ ok: true });
});

router.get('/api/status', (_req, res) => {
  res.json(keyPool.getStatus());
});

router.post('/api/cooldowns/reset', (_req, res) => {
  keyPool.resetCooldowns();
  res.json({ ok: true });
});

export default router;
