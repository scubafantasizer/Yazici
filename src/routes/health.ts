import { Router } from 'express';

// ─── Health ───────────────────────────────────────────────────────────────────

const router = Router();

router.get('/api/health', (_req, res) => {
  res.json({ ok: true, version: '3.0.0', ts: new Date().toISOString() });
});

export default router;
