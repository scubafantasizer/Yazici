import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export type SearchResult = {
  filePath: string;
  lineNumber: number;
  match: string;
};

/**
 * Executes a ripgrep (rg) search in the specified directory.
 * If ripgrep is not installed, it falls back to standard grep (Linux/macOS).
 */
export async function searchFiles(query: string, dir: string): Promise<SearchResult[]> {
  try {
    // -n: show line numbers
    // -i: ignore case
    // --no-heading: simple format
    // Escape single quotes for the shell
    const safeQuery = query.replace(/'/g, "'\\''");
    
    // First try ripgrep (faster, respects .gitignore)
    try {
      const { stdout } = await execAsync(`rg -ni --no-heading '${safeQuery}' "${dir}"`);
      return parseResults(stdout);
    } catch (rgError: any) {
      // If ripgrep returns 1, it just means no results found.
      if (rgError.code === 1) return [];
      
      // If code is 127, rg is not found. Fall back to grep.
      console.warn('ripgrep not found, falling back to grep. For optimal performance, please install ripgrep.');
      const { stdout } = await execAsync(`grep -rni '${safeQuery}' "${dir}"`);
      return parseResults(stdout);
    }
  } catch (error: any) {
    if (error.code === 1) return []; // grep returns 1 when no matches
    console.error('Search error:', error);
    return [];
  }
}

function parseResults(output: string): SearchResult[] {
  return output
    .split('\n')
    .filter(line => line.trim().length > 0)
    .map(line => {
      // Format: filePath:lineNumber:match
      const firstColon = line.indexOf(':');
      const secondColon = line.indexOf(':', firstColon + 1);
      
      if (firstColon === -1 || secondColon === -1) return null;

      const filePath = line.substring(0, firstColon);
      const lineNumberStr = line.substring(firstColon + 1, secondColon);
      const match = line.substring(secondColon + 1);

      return {
        filePath,
        lineNumber: parseInt(lineNumberStr, 10) || 0,
        match: match.trim()
      };
    })
    .filter((res): res is SearchResult => res !== null);
}
