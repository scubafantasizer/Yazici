import Database from 'better-sqlite3';
import { pipeline } from '@xenova/transformers';
import path from 'path';
import fs from 'fs';
import { WORKSPACE_ROOT } from '../routes.js';

let extractor: any = null;
const db = new Database(':memory:'); // For speed, can be persisted to file

db.exec(`
  CREATE TABLE IF NOT EXISTS embeddings (
    path TEXT PRIMARY KEY,
    content TEXT,
    vector BLOB
  )
`);

export async function indexWorkspace() {
  if (!extractor) {
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }

  const files = getAllFiles(WORKSPACE_ROOT);
  for (const f of files) {
    if (f.includes('node_modules') || f.includes('.git')) continue;
    const content = fs.readFileSync(f, 'utf8');
    if (content.length > 50000) continue; // Skip huge files

    const output = await extractor(content.slice(0, 1000), { pooling: 'mean', normalize: true });
    const vector = Buffer.from(new Float32Array(output.data).buffer);
    
    db.prepare('INSERT OR REPLACE INTO embeddings (path, content, vector) VALUES (?, ?, ?)')
      .run(f.replace(WORKSPACE_ROOT, ''), content, vector);
  }
}

export async function semanticSearch(query: string, limit = 5) {
  if (!extractor) extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  
  const output = await extractor(query, { pooling: 'mean', normalize: true });
  const queryVector = new Float32Array(output.data);

  // Note: Standard SQLite doesn't have vec_distance, 
  // we either use better-sqlite3-vec or a simple rank function
  const all = db.prepare('SELECT path, content, vector FROM embeddings').all();
  const scored = all.map((row: any) => {
    const rowVector = new Float32Array(row.vector.buffer);
    const score = cosineSimilarity(queryVector, rowVector);
    const snippet = row.content ? row.content.slice(0, 200).replace(/\n/g, ' ') + '...' : '';
    return { path: row.path, score, snippet };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

function cosineSimilarity(a: Float32Array, b: Float32Array) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

function getAllFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) results = results.concat(getAllFiles(file));
    else results.push(file);
  });
  return results;
}
