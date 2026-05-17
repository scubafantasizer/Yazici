import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

// ─── Setup ────────────────────────────────────────────────────────────────────

const GATEAI_DIR = path.join(os.homedir(), '.gateai');
if (!fs.existsSync(GATEAI_DIR)) fs.mkdirSync(GATEAI_DIR, { recursive: true });

export const db = new Database(path.join(GATEAI_DIR, 'gateai.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    name        TEXT NOT NULL,
    description TEXT,
    language    TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS files (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    path        TEXT NOT NULL,
    content     TEXT NOT NULL DEFAULT '',
    is_dir      INTEGER NOT NULL DEFAULT 0,
    size        INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(project_id, path)
  );

  CREATE TABLE IF NOT EXISTS environments (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'stopped',
    runtime     TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS env_vars (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    env_id      TEXT NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    key         TEXT NOT NULL,
    value       TEXT NOT NULL DEFAULT '',
    UNIQUE(env_id, key)
  );

  CREATE TABLE IF NOT EXISTS print_jobs (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    prompt      TEXT NOT NULL,
    model       TEXT,
    status      TEXT NOT NULL DEFAULT 'queued',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS print_steps (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    job_id      TEXT NOT NULL REFERENCES print_jobs(id) ON DELETE CASCADE,
    step_index  INTEGER NOT NULL,
    type        TEXT NOT NULL,
    description TEXT NOT NULL,
    file_path   TEXT,
    content     TEXT,
    result      TEXT
  );
`);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Touch the updated_at field of a project. */
export function touchProject(id: string): void {
  db.prepare(`UPDATE projects SET updated_at = datetime('now') WHERE id = ?`).run(id);
}

/** Compute file size from content length. */
export function contentSize(content: string): number {
  return Buffer.byteLength(content, 'utf8');
}
