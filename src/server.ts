import express from 'express';
import cors    from 'cors';
import path    from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

import router from './routes/index.js';

// ─── Setup ────────────────────────────────────────────────────────────────────

const app  = express();
const PORT = parseInt(process.env.PORT ?? '3147', 10);
const HOST = process.env.HOST ?? '127.0.0.1';

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── API routes ───────────────────────────────────────────────────────────────

app.use(router);

// ─── SPA fallback ─────────────────────────────────────────────────────────────

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}`;
  console.log(`\n  ✦ Yazıcı v3.0.0\n`);
  console.log(`  Local:  ${url}`);
  console.log(`  API:    ${url}/api/health\n`);
});
