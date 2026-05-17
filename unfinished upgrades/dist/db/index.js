"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.touchProject = touchProject;
exports.contentSize = contentSize;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const fs_1 = __importDefault(require("fs"));
// ─── Setup ────────────────────────────────────────────────────────────────────
const GATEAI_DIR = path_1.default.join(os_1.default.homedir(), '.gateai');
if (!fs_1.default.existsSync(GATEAI_DIR))
    fs_1.default.mkdirSync(GATEAI_DIR, { recursive: true });
exports.db = new better_sqlite3_1.default(path_1.default.join(GATEAI_DIR, 'gateai.db'));
exports.db.pragma('journal_mode = WAL');
exports.db.pragma('foreign_keys = ON');
// ─── Schema ───────────────────────────────────────────────────────────────────
exports.db.exec(`
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
function touchProject(id) {
    exports.db.prepare(`UPDATE projects SET updated_at = datetime('now') WHERE id = ?`).run(id);
}
/** Compute file size from content length. */
function contentSize(content) {
    return Buffer.byteLength(content, 'utf8');
}
