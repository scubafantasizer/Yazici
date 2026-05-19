import fs   from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { searchFiles } from '../utils/search.js';
import { lspService } from '../services/lspService.js';
import { browserService } from '../services/browserService.js';
import { memoryService } from '../services/memoryService.js';
import { getSudoPass } from '../services/keyStore.js';
import crypto from 'crypto';

export const WORKSPACE_ROOT = path.join(process.env.HOME ?? '~', 'Yazıcı-Workspace');

export type ActionResult = {
  type: string;
  path?: string;
  output?: string;
  error?: string;
};

// ─── Tool block parser ────────────────────────────────────────────────────────

const TOOL_BLOCK_RE = /```(file|delete|read|search|exec|!bash)(?::([^\n`]*))?\n?([\s\S]*?)```/g;

export interface ParsedAction {
  tool: string;
  target: string;
  body: string;
}

export function parseActions(text: string): ParsedAction[] {
  const actions: ParsedAction[] = [];
  
  // 1. Try to parse as a single JSON object (Strict Mode)
  try {
    const json = JSON.parse(text.trim());
    if (json.actions && Array.isArray(json.actions)) {
      for (const a of json.actions) {
        actions.push({
          tool: a.type,
          target: a.path || a.query || a.command || '',
          body:   a.content || a.text || ''
        });
      }
      return actions;
    }
  } catch {
    // Not valid JSON or doesn't match schema, fall through to block parser
  }

  // 2. Legacy triple-backtick block parser
  let m: RegExpExecArray | null;
  while ((m = TOOL_BLOCK_RE.exec(text)) !== null) {
    const [, tool, target = '', body = ''] = m;
    actions.push({ tool: tool!, target: target.trim(), body: body.trim() });
  }
  return actions;
}

// ─── Executor ────────────────────────────────────────────────────────────────

const BLOCKED_PATTERNS = ['rm -rf /', 'mkfs', 'dd if=', ':(){ :|:& };:', 'chmod -R 777 /',
                          'shutdown', 'reboot', 'passwd', 'sudo rm', ':(){'];

function safePath(rel: string): string {
  const abs = path.resolve(WORKSPACE_ROOT, rel);
  if (!abs.startsWith(WORKSPACE_ROOT)) throw new Error(`Path traversal blocked: ${rel}`);
  return abs;
}

export async function executeActions(
  actions: ParsedAction[],
  onStep?: (step: string) => void,
): Promise<ActionResult[]> {
  const results: ActionResult[] = [];

  for (const { tool, target, body } of actions) {
    try {
      switch (tool) {
        case 'write_file':
        case 'file': {
          onStep?.(`✍ writing (pending diff): ${target}`);
          const abs = safePath(target);
          // Instead of writing immediately, we could store it as a pending change 
          // for the frontend to show a diff. 
          // But for now, we'll write it and emit the diff in Group 2.3.
          fs.mkdirSync(path.dirname(abs), { recursive: true });
          fs.writeFileSync(abs, body || '', 'utf8');
          results.push({ type: 'write_file', path: target, output: `✓ written: ${target}` });
          break;
        }

        case 'patch_file':
        case 'patch': {
          onStep?.(`🩹 patching: ${target}`);
          const abs = safePath(target);
          if (!fs.existsSync(abs)) {
            results.push({ type: 'patch_file', error: `File not found: ${target}` });
            break;
          }
          // For now, we use a simple overwrite for patch as well, but labeled differently 
          // to encourage the model to send diffs. Task 2.1 will add proper diff handling.
          fs.writeFileSync(abs, body || '', 'utf8'); 
          results.push({ type: 'patch_file', path: target, output: `✓ patched: ${target}` });
          break;
        }

        case 'read_file':
        case 'read': {
          onStep?.(`📄 reading: ${target}`);
          const abs     = safePath(target);
          const content = fs.readFileSync(abs, 'utf8');
          results.push({ type: 'read_file', path: target, output: content });
          break;
        }

        case 'delete_file':
        case 'delete': {
          onStep?.(`🗑 deleting: ${target}`);
          const abs = safePath(target);
          if (fs.statSync(abs).isDirectory()) fs.rmSync(abs, { recursive: true });
          else fs.unlinkSync(abs);
          results.push({ type: 'delete_file', path: target, output: `✓ deleted: ${target}` });
          break;
        }

        case 'search': {
          onStep?.(`🔍 searching: ${target || body}`);
          const query = (target || body).trim();
          const found = await searchFiles(query, WORKSPACE_ROOT);
          const out   = found.length
            ? found.slice(0, 30).map(r => `${r.filePath}:${r.lineNumber}: ${r.match}`).join('\n')
            : '(no results)';
          results.push({ type: 'search', output: out });
          break;
        }

        case 'exec':
        case '!bash': {
          let cmd = (body || target).trim();
          onStep?.(`⚙ exec: ${cmd.slice(0, 60)}`);
          if (BLOCKED_PATTERNS.some(p => cmd.includes(p)) && !cmd.includes('{{SUDO}}')) {
            results.push({ type: 'exec', error: `Blocked: destructive command detected` });
            break;
          }
          if (cmd.includes('{{SUDO}}')) {
            const sudoPass = getSudoPass();
            if (!sudoPass) {
              results.push({ type: 'exec', error: 'Sudo password is not set in the configuration.' });
              break;
            }
            cmd = cmd.replace(/\{\{SUDO\}\}/g, `echo "${sudoPass.replace(/"/g, '\\"')}" | sudo -S`);
          }
          try {
            const out = execSync(cmd, {
              cwd: WORKSPACE_ROOT,
              encoding: 'utf8',
              timeout: 60_000,
              shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
            });
            results.push({ type: 'exec', output: out });
          } catch (e: unknown) {
            const err = e as { stdout?: string; stderr?: string; message: string };
            results.push({ type: 'exec', error: (err.stderr || err.stdout || err.message).slice(0, 500) });
          }
          break;
        }

        case 'fetch_web': {
          onStep?.(`🌐 fetching: ${target}`);
          try {
            const res = await fetch(target);
            const text = await res.text();
            results.push({ type: 'fetch_web', output: text.slice(0, 5000) });
          } catch (e: any) {
            results.push({ type: 'fetch_web', error: e.message });
          }
          break;
        }

        case 'git_commit_push': {
          onStep?.(`🌳 git commit: ${target}`);
          try {
            execSync('git add .', { cwd: WORKSPACE_ROOT });
            execSync(`git commit -m "${target.replace(/"/g, '\\"')}"`, { cwd: WORKSPACE_ROOT });
            const pushOut = execSync('git push', { cwd: WORKSPACE_ROOT, encoding: 'utf8' });
            results.push({ type: 'git_commit_push', output: `✓ Pushed: ${pushOut.slice(0, 200)}` });
          } catch (e: any) {
            results.push({ type: 'git_commit_push', error: e.message });
          }
          break;
        }

        case 'encrypt_file': {
          onStep?.(`🔒 encrypting: ${target}`);
          try {
            const abs = safePath(target);
            const content = fs.readFileSync(abs, 'utf8');
            const cipher = crypto.createCipheriv('aes-256-cbc', crypto.scryptSync(body, 'salt', 32), Buffer.alloc(16, 0));
            let encrypted = cipher.update(content, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            fs.writeFileSync(abs + '.enc', encrypted, 'utf8');
            fs.unlinkSync(abs);
            results.push({ type: 'encrypt_file', output: `✓ Encrypted to ${target}.enc` });
          } catch (e: any) {
            results.push({ type: 'encrypt_file', error: e.message });
          }
          break;
        }

        case 'decrypt_file': {
          onStep?.(`🔓 decrypting: ${target}`);
          try {
            const abs = safePath(target);
            const encrypted = fs.readFileSync(abs, 'utf8');
            const decipher = crypto.createDecipheriv('aes-256-cbc', crypto.scryptSync(body, 'salt', 32), Buffer.alloc(16, 0));
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            fs.writeFileSync(abs.replace('.enc', ''), decrypted, 'utf8');
            fs.unlinkSync(abs);
            results.push({ type: 'decrypt_file', output: `✓ Decrypted to ${target.replace('.enc', '')}` });
          } catch (e: any) {
            results.push({ type: 'decrypt_file', error: e.message });
          }
          break;
        }

        case 'browse': {
          onStep?.(`🌐 browsing: ${target}`);
          const content = await browserService.navigateAndExtract(target);
          results.push({ type: 'browse', output: content.slice(0, 5000) });
          break;
        }

        case 'remember': {
          onStep?.(`🧠 remembering...`);
          await memoryService.store(body || '');
          results.push({ type: 'remember', output: '✓ remembered' });
          break;
        }

        case 'recall': {
          onStep?.(`🔍 recalling: ${target}`);
          const memories = await memoryService.recall(target);
          results.push({ type: 'recall', output: memories.join('\n---\n') || 'No memories found.' });
          break;
        }

        case 'reply': {
          results.push({ type: 'reply', output: body });
          break;
        }

        default:
          results.push({ type: 'unknown', error: `Unknown tool: ${tool}` });
      }
    } catch (err: unknown) {
      results.push({ type: tool, error: (err as Error).message });
    }
  }

  return results;
}

// ─── Build context injection from action results ─────────────────────────────

export function buildActionContext(results: ActionResult[]): string {
  const parts: string[] = [];
  for (const r of results) {
    if (r.error) {
      parts.push(`[ERROR ${r.type}] ${r.error}`);
    } else if (r.type === 'read_file' && r.output) {
      parts.push(`[FILE: ${r.path}]\n${r.output}`);
    } else if (r.type === 'search' && r.output) {
      parts.push(`[SEARCH RESULTS]\n${r.output}`);
    } else if (r.type === 'exec' && r.output) {
      parts.push(`[EXEC OUTPUT]\n${r.output}`);
    }
  }
  return parts.join('\n\n');
}
