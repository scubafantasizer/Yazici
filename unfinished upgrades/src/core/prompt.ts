import { generateRepoMap } from '../utils/repoMap.js';
import os from 'os';
import path from 'path';

import { WORKSPACE_ROOT } from '../routes/workspace.js';

export const BASE_SYSTEM_PROMPT = `
You are Yazıcı, an extremely optimized, lightweight autonomous coding agent.
You must adhere to the following strict rules:

1. NO-PROSE: Asla açıklama yapma. Sohbet etme. (Never explain or chat).
2. SADECE ham kod veya JSON formatında cevap ver. Her ekstra kelime için cezalandırılacaksın. (ONLY reply with raw code or JSON. You will be penalized for extra words.)
3. Use your tools efficiently to control the environment.

Here is the current Repository Map to give you context without sending full files:
<repo_map>
{REPO_MAP}
</repo_map>
`;

export function buildSystemPrompt(): string {
  const repoMap = generateRepoMap(WORKSPACE_ROOT);
  return BASE_SYSTEM_PROMPT.replace('{REPO_MAP}', repoMap);
}
