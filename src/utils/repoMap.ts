import fs from 'fs';
import path from 'path';

const IGNORED = new Set(['node_modules', '.git', 'dist', '.cache', '__pycache__']);

function walk(dir: string, baseDir: string, depth = 0): string[] {
  if (depth > 6) return [];
  const lines: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
      .filter(e => !IGNORED.has(e.name))
      .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));

    for (const e of entries) {
      const rel  = path.relative(baseDir, path.join(dir, e.name));
      const mtime = fs.statSync(path.join(dir, e.name)).mtimeMs;
      lines.push(`${rel}${e.isDirectory() ? '/' : ''}\t${Math.floor(mtime)}`);
      if (e.isDirectory()) lines.push(...walk(path.join(dir, e.name), baseDir, depth + 1));
    }
  } catch { /* skip */ }
  return lines;
}

export function generateRepoMap(workspaceRoot: string, query = ''): string {
  if (!fs.existsSync(workspaceRoot)) return '(workspace empty)';

  const allLines = walk(workspaceRoot, workspaceRoot);
  
  // Sort by recency if query is empty, else keep tree order
  const sorted = query
    ? allLines
    : allLines.sort((a, b) => {
        const ta = parseInt(a.split('\t')[1] ?? '0');
        const tb = parseInt(b.split('\t')[1] ?? '0');
        return tb - ta;
      });

  // Limit to 800 tokens worth (~100 lines)
  const limited = sorted.slice(0, 100).map(l => l.split('\t')[0]);
  return limited.join('\n') || '(workspace empty)';
}
