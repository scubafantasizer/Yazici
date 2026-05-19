import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';

const DB_PATH = path.join(os.homedir(), '.yazici', 'memory.db');

export class MemoryService {
  private db: sqlite3.Database;

  constructor() {
    if (!fs.existsSync(path.dirname(DB_PATH))) {
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    }
    this.db = new sqlite3.Database(DB_PATH);
    this.init();
  }

  private init() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        content TEXT,
        tags TEXT
      )
    `);
  }

  async store(content: string, tags: string[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run('INSERT INTO memory (content, tags) VALUES (?, ?)', [content, tags.join(',')], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async recall(query: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT content FROM memory WHERE content LIKE ? LIMIT 5', [`%${query}%`], (err, rows) => {
        if (err) reject(err);
        else resolve((rows as any[]).map(r => r.content));
      });
    });
  }
}

export const memoryService = new MemoryService();
