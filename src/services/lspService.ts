import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { WORKSPACE_ROOT } from '../routes.js';

const execAsync = promisify(exec);

export interface Diagnostic {
  file: string;
  line: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export class LSPService {
  async getDiagnostics(): Promise<Diagnostic[]> {
    try {
      // Use tsc --noEmit for TypeScript diagnostics
      const { stdout } = await execAsync('npx tsc --noEmit --pretty false', { cwd: WORKSPACE_ROOT });
      return this.parseTSCOutput(stdout);
    } catch (err: any) {
      return this.parseTSCOutput(err.stdout || '');
    }
  }

  private parseTSCOutput(output: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const lines = output.split('\n');
    for (const line of lines) {
      const match = line.match(/^(.+)\((\d+),(\d+)\): (error|warning|info) (.+): (.+)$/);
      if (match) {
        diagnostics.push({
          file: match[1],
          line: parseInt(match[2], 10),
          severity: match[4] as any,
          message: match[6]
        });
      }
    }
    return diagnostics;
  }

  async getDefinition(filePath: string, line: number, character: number): Promise<any> {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      const word = this.getWordAt(lines[line], character);
      if (!word) return null;

      const { stdout } = await execAsync(`rg -nI -j 4 --pcre2 "\\b(class|function|const|let|var|interface|type)\\s+${word}\\b"`, { cwd: WORKSPACE_ROOT });
      if (!stdout) return null;

      const firstMatch = stdout.split('\n')[0];
      const parts = firstMatch.split(':');
      const file = parts[0];
      const lineNo = parts[1];
      return {
        uri: path.normalize(path.join(WORKSPACE_ROOT, file)),
        range: {
          start: { line: parseInt(lineNo) - 1, character: 0 },
          end: { line: parseInt(lineNo) - 1, character: 100 }
        }
      };
    } catch { return null; }
  }

  async getReferences(filePath: string, line: number, character: number): Promise<any[]> {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      const word = this.getWordAt(lines[line], character);
      if (!word) return [];

      const { stdout } = await execAsync(`rg -nI -j 4 "\\b${word}\\b"`, { cwd: WORKSPACE_ROOT });
      if (!stdout) return [];

      return stdout.trim().split('\n').map(l => {
        const parts = l.split(':');
        const file = parts[0];
        const lineNo = parts[1];
        return {
          uri: path.normalize(path.join(WORKSPACE_ROOT, file)),
          range: {
            start: { line: parseInt(lineNo) - 1, character: 0 },
            end: { line: parseInt(lineNo) - 1, character: 100 }
          }
        };
      });
    } catch { return []; }
  }

  private getWordAt(lineText: string, char: number): string | null {
    const before = lineText.slice(0, char).split(/[^a-zA-Z0-9_]/).pop() || '';
    const after = lineText.slice(char).split(/[^a-zA-Z0-9_]/)[0] || '';
    return before + after || null;
  }
}

export const lspService = new LSPService();
export const getDefinition = (f:string, l:number, c:number) => lspService.getDefinition(f,l,c);
export const getReferences = (f:string, l:number, c:number) => lspService.getReferences(f,l,c);
