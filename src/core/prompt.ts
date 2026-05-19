import { generateRepoMap }    from '../utils/repoMap.js';
import { WORKSPACE_ROOT }    from '../routes.js';
import { selectRelevantContext } from './contextSelector.js';
import { lspService } from '../services/lspService.js';
import { semanticSearch } from '../services/semanticSearch.js';
import fs from 'fs';
import path from 'path';

// System Prompt Configuration

// ─── System Prompt ────────────────────────────────────────────────────────────

const BASE = `You are Yazıcı v4, an extremely optimized autonomous coding agent.

STRICT RULES:
1. NO-PROSE. Never explain or chat. Every unnecessary word wastes tokens.
2. ONLY reply with raw code or JSON. Penalized for extra words.
3. Use tool blocks to act. Prefer reading only what you need via the repo map.

TOOLS (use these exact fenced-block formats):
- Read file:    \`\`\`read:path/to/file.ext\`\`\`
- Write file:   \`\`\`file:path/to/file.ext\n[full content]\n\`\`\`
- Patch file:   \`\`\`patch:path/to/file.ext\n[diff or new content]\n\`\`\`
- Delete file:  \`\`\`delete:path/to/file.ext\`\`\`
- Search code:  \`\`\`search:keyword or pattern\`\`\`
- Run command:  \`\`\`exec:bash\n[command]\n\`\`\`  (Use {{SUDO}} before commands requiring root, e.g. {{SUDO}} apt update)
- Git Push:     \`\`\`git_commit_push:Commit Message Here\`\`\`
- Fetch Web:    \`\`\`fetch_web:https://example.com\`\`\`
- Encrypt:      \`\`\`encrypt_file:path/to/file.ext\n[password]\n\`\`\`
- Decrypt:      \`\`\`decrypt_file:path/to/file.enc\n[password]\n\`\`\`

WORKFLOW STRATEGY (token-efficient):
1. Check the repo map below to locate relevant files — NEVER read files blindly.
2. Use \`\`\`search:...\`\`\` to find exact locations before reading large files.
3. Read only the specific file you need, then act.
4. After writing a file, confirm with a single line: "✓ written: path/to/file"

CURRENT REPOSITORY MAP:
<repo_map>
{REPO_MAP}
</repo_map>

LSP DIAGNOSTICS:
<diagnostics>
{DIAGNOSTICS}
</diagnostics>

ADDITIONAL CONTEXT:
{CONTEXT}`;

const STRICT_JSON_BASE = `You are Yazıcı v4, an extremely optimized autonomous coding agent.

STRICT RULES:
1. ONLY reply with valid JSON matching the schema below.
2. NO-PROSE. The "thought" field must be concise (max 50 words).
3. Penalized for any text outside the JSON.

JSON SCHEMA:
{
  "thought": "concise plan",
  "actions": [
    {
      "type": "write_file | patch_file | read_file | delete_file | search | exec | fetch_web | git_commit_push | encrypt_file | decrypt_file | reply",
      "path": "string (optional)",
      "content": "string (optional)",
      "query": "string (optional)",
      "command": "string (optional, use {{SUDO}} prefix if root needed)",
      "text": "string (for reply)"
    }
  ]
}

CURRENT REPOSITORY MAP:
<repo_map>
{REPO_MAP}
</repo_map>

LSP DIAGNOSTICS:
<diagnostics>
{DIAGNOSTICS}
</diagnostics>

ADDITIONAL CONTEXT:
{CONTEXT}

{RULES}`;

export async function buildSystemPrompt(strict = false, userQuery: string = ''): Promise<string> {
  const repoMap = generateRepoMap(WORKSPACE_ROOT, userQuery);
  const diagnostics = await lspService.getDiagnostics();
  const diagStr = diagnostics.length > 0 
    ? diagnostics.slice(0, 10).map(d => `${d.file}:${d.line} - ${d.message}`).join('\n')
    : "No errors detected.";

  let context = '';
  if (userQuery) {
    // Smart Context: If query looks like a specific task, pull some extra file contents
    const searchRes = await semanticSearch(userQuery, 2);
    context = searchRes.map(r => `[CONTENT: ${r.path}]\n${fs.readFileSync(path.join(WORKSPACE_ROOT, r.path), 'utf8').slice(0, 2000)}`).join('\n\n');
  }

  let rules = '';
  try {
    const rulesPath = path.join(WORKSPACE_ROOT, '.yazici-rules');
    if (fs.existsSync(rulesPath)) {
      rules = `PROJECT RULES:\n${fs.readFileSync(rulesPath, 'utf8')}`;
    }
  } catch { /* ignore */ }

  let skills = '';
  try {
    const skillsPath = path.join(WORKSPACE_ROOT, '.ai-skills.md');
    if (fs.existsSync(skillsPath)) {
      skills = `AI SKILLS & MISSION:\n${fs.readFileSync(skillsPath, 'utf8')}`;
    }
  } catch { /* ignore */ }

  const base = strict ? STRICT_JSON_BASE : BASE;
  return base
    .replace('{REPO_MAP}', repoMap)
    .replace('{CONTEXT}',  context)
    .replace('{DIAGNOSTICS}', diagStr)
    .replace('{RULES}', rules)
    .replace('{CONTEXT}', skills); // Re-injecting skills into a secondary context block
}
