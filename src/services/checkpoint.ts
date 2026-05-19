import fs   from 'fs';
import path from 'path';
import { WORKSPACE_ROOT } from '../routes.js';

interface Checkpoint {
  id: string;
  timestamp: string;
  description: string;
  files: Record<string, string>; // path -> content snapshot
}

export class CheckpointManager {
  private checkpoints: Checkpoint[] = [];
  private maxCheckpoints = 20;

  async createCheckpoint(description: string): Promise<string> {
    const id = Date.now().toString(36);
    const snapshot: Record<string, string> = {};

    this.walkAndSnapshot(WORKSPACE_ROOT, WORKSPACE_ROOT, snapshot);

    this.checkpoints.push({
      id,
      timestamp: new Date().toISOString(),
      description,
      files: snapshot
    });

    if (this.checkpoints.length > this.maxCheckpoints) {
      this.checkpoints.shift();
    }

    return id;
  }

  async restoreCheckpoint(id: string): Promise<void> {
    const cp = this.checkpoints.find(c => c.id === id);
    if (!cp) throw new Error(`Checkpoint ${id} not found`);

    for (const [relPath, content] of Object.entries(cp.files)) {
      const abs = path.join(WORKSPACE_ROOT, relPath);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content, 'utf8');
    }
  }

  list(): Omit<Checkpoint, 'files'>[] {
    return this.checkpoints.map(({ id, timestamp, description }) => ({ id, timestamp, description }));
  }

  private walkAndSnapshot(dir: string, root: string, snapshot: Record<string, string>) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || ['node_modules', 'dist', 'build', '.yazici'].includes(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      const rel = path.relative(root, abs);
      if (entry.isDirectory()) {
        this.walkAndSnapshot(abs, root, snapshot);
      } else {
        try {
          snapshot[rel] = fs.readFileSync(abs, 'utf8');
        } catch { /* skip */ }
      }
    }
  }
}

export const checkpointManager = new CheckpointManager();
