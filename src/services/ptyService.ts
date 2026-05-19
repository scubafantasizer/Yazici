import * as pty from 'node-pty';
import { WebSocketServer, WebSocket } from 'ws';
import { WORKSPACE_ROOT } from '../routes.js';
import os from 'os';

export function startPTYService(wss: WebSocketServer) {
  wss.on('connection', (ws: WebSocket) => {
    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

    const term = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 120,
      rows: 30,
      cwd: WORKSPACE_ROOT,
      env: process.env as { [key: string]: string }
    });

    // PTY -> WebSocket
    term.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'output', data }));
      }
    });

    // WebSocket -> PTY
    ws.on('message', (msg: Buffer) => {
      try {
        const { type, data, cols, rows } = JSON.parse(msg.toString());
        if (type === 'input') term.write(data);
        if (type === 'resize') term.resize(cols, rows);
      } catch { /* skip malformed */ }
    });

    ws.on('close', () => {
      term.kill();
    });
  });
}
