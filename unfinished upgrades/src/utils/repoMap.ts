import fs from 'fs';
import path from 'path';

/**
 * Generates a concise map of the repository, including directory structure
 * and function/class signatures for supported file types.
 * Aimed at token efficiency (Aider-style).
 */
export function generateRepoMap(root: string, maxDepth = 5): string {
  let map = '';

  function scan(dir: string, depth: number, prefix = ''): void {
    if (depth > maxDepth) return;
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    // Separate dirs and files
    const dirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== 'dist');
    const files = entries.filter(e => e.isFile() && !e.name.startsWith('.') && isRelevant(e.name));

    // Process directories
    for (const d of dirs) {
      map += `${prefix}📁 ${d.name}/\n`;
      scan(path.join(dir, d.name), depth + 1, `${prefix}  `);
    }

    // Process files
    for (const f of files) {
      map += `${prefix}📄 ${f.name}\n`;
      const signatures = extractSignatures(path.join(dir, f.name));
      if (signatures) {
        map += signatures.split('\n').map(line => `${prefix}    ${line}`).join('\n') + '\n';
      }
    }
  }

  scan(root, 0);
  return map;
}

function isRelevant(filename: string): boolean {
  const ext = path.extname(filename);
  return ['.ts', '.js', '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.php'].includes(ext);
}

function extractSignatures(filePath: string): string | null {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const signatures: string[] = [];

  // Simple regex-based signature extraction
  // Covers: export function, class, interface, type, async function, const (...) =>
  const patterns = [
    /^(export\s+)?(async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(.*?\)/,
    /^(export\s+)?class\s+([a-zA-Z0-9_]+)/,
    /^(export\s+)?interface\s+([a-zA-Z0-9_]+)/,
    /^(export\s+)?type\s+([a-zA-Z0-9_]+)/,
    /^(export\s+)?const\s+([a-zA-Z0-9_]+)\s*=\s*(\(.*?\)|[a-zA-Z0-9_]+)\s*=>/,
  ];

  for (const line of lines) {
    const trimmed = line.trim();
    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        signatures.push(trimmed);
        break;
      }
    }
  }

  if (signatures.length === 0) return null;
  // Limit signatures to keep it concise
  return signatures.slice(0, 10).join('\n') + (signatures.length > 10 ? '\n...' : '');
}
