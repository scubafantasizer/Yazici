import { exec } from 'child_process';
import { promisify } from 'util';
import { WORKSPACE_ROOT } from '../routes.js';
import { route } from './router.js';
import { Message } from '../providers/adapters.js';

const execAsync = promisify(exec);

export interface TestResult {
  success: boolean;
  output: string;
}

export async function runTests(): Promise<TestResult> {
  try {
    // Try common test commands
    const cmd = fs.existsSync(path.join(WORKSPACE_ROOT, 'package.json')) ? 'npm test' : 'pytest';
    const { stdout, stderr } = await execAsync(cmd, { cwd: WORKSPACE_ROOT, timeout: 60000 });
    return { success: true, output: stdout + stderr };
  } catch (err: any) {
    return { success: false, output: err.stdout + err.stderr || err.message };
  }
}

import fs from 'fs';
import path from 'path';

export async function selfHealLoop(
  messages: Message[],
  provider: string,
  onToken: (t: string) => void,
  maxAttempts = 2
): Promise<void> {
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt++;
    const testResult = await runTests();
    if (testResult.success) break;

    const fixPrompt: Message[] = [
      ...messages,
      { 
        role: 'user', 
        content: `Tests failed (Attempt ${attempt}/${maxAttempts}):\n\`\`\`\n${testResult.output.slice(-2000)}\n\`\`\`\nPlease fix the errors above.` 
      }
    ];

    await route(fixPrompt, provider, onToken, () => {}, { strict: true });
  }
}
