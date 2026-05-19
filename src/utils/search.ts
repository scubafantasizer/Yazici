import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export interface SearchResult {
  filePath: string;
  lineNumber: number;
  match: string;
}

export async function searchFiles(query: string, workspaceRoot: string): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  try {
    const out = execSync(`rg --json -n "${query.replace(/"/g, '\\"')}" .`, {
      cwd: workspaceRoot, encoding: 'utf8', timeout: 10_000,
    });
    for (const line of out.split('\n')) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.type === 'match') {
          results.push({
            filePath: obj.data.path.text,
            lineNumber: obj.data.line_number,
            match: obj.data.lines.text.trim(),
          });
        }
      } catch { /* skip */ }
    }
  } catch {
    // Fallback: simple recursive grep
    try {
      const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory() && !['node_modules', '.git', 'dist'].includes(entry.name)) walk(full);
          else if (entry.isFile()) {
            try {
              const lines = fs.readFileSync(full, 'utf8').split('\n');
              lines.forEach((l, i) => {
                if (l.toLowerCase().includes(query.toLowerCase())) {
                  results.push({ filePath: path.relative(workspaceRoot, full), lineNumber: i + 1, match: l.trim() });
                }
              });
            } catch { /* skip binary */ }
          }
        }
      };
      if (fs.existsSync(workspaceRoot)) walk(workspaceRoot);
    } catch { /* ignore */ }
  }
  return results;
}
