import express from 'express';
import cors    from 'cors';
import path    from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import helmet from 'helmet';
import chokidar from 'chokidar';
import rateLimit from 'express-rate-limit';

import { startPTYService } from './services/ptyService.js';
import { indexWorkspace } from './services/semanticSearch.js';
import router, { WORKSPACE_ROOT } from './routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = parseInt(process.env.PORT ?? '3147', 10);
const HOST = process.env.HOST ?? '127.0.0.1';

app.use(helmet({ contentSecurityPolicy: false, frameguard: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../frontend/dist')));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

app.use(router);

// SPA fallback: serve the React app for all non-API routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

function clearPort(port: number): void {
  try {
    execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' });
  } catch { /* port already clear */ }
}

clearPort(PORT);

const server = app.listen(PORT, HOST, async () => {
  const url = `http://${HOST}:${PORT}`;
  console.log(`\n  ✦ Yazıcı v4.0.0 "DEHŞET"\n`);
  console.log(`  Local:  ${url}`);
  console.log(`  API:    ${url}/api/health\n`);

  try {
    console.log('  ✦ Indexing workspace...');
    await indexWorkspace();
    console.log('  ✓ Ready.\n');
  } catch (err: any) {
    console.error('  ⚠ Indexing failed:', err.message);
  }
});

// PTY WebSocket
const wss = new WebSocketServer({ server, path: '/pty' });
startPTYService(wss);

// Hot-reload WebSocket
const hotWss = new WebSocketServer({ noServer: true });
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url!, `http://${request.headers.host}`).pathname;
  if (pathname === '/hot') {
    hotWss.handleUpgrade(request, socket, head, (ws) => hotWss.emit('connection', ws, request));
  }
});

chokidar.watch(WORKSPACE_ROOT, { ignoreInitial: true }).on('all', (_event, filePath) => {
  hotWss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'reload', path: filePath }));
    }
  });
});
