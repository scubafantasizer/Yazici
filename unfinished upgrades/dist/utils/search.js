"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchFiles = searchFiles;
const child_process_1 = require("child_process");
const util_1 = __importDefault(require("util"));
const execAsync = util_1.default.promisify(child_process_1.exec);
/**
 * Executes a ripgrep (rg) search in the specified directory.
 * If ripgrep is not installed, it falls back to standard grep (Linux/macOS).
 */
async function searchFiles(query, dir) {
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
        }
        catch (rgError) {
            // If ripgrep returns 1, it just means no results found.
            if (rgError.code === 1)
                return [];
            // If code is 127, rg is not found. Fall back to grep.
            console.warn('ripgrep not found, falling back to grep. For optimal performance, please install ripgrep.');
            const { stdout } = await execAsync(`grep -rni '${safeQuery}' "${dir}"`);
            return parseResults(stdout);
        }
    }
    catch (error) {
        if (error.code === 1)
            return []; // grep returns 1 when no matches
        console.error('Search error:', error);
        return [];
    }
}
function parseResults(output) {
    return output
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => {
        // Format: filePath:lineNumber:match
        const firstColon = line.indexOf(':');
        const secondColon = line.indexOf(':', firstColon + 1);
        if (firstColon === -1 || secondColon === -1)
            return null;
        const filePath = line.substring(0, firstColon);
        const lineNumberStr = line.substring(firstColon + 1, secondColon);
        const match = line.substring(secondColon + 1);
        return {
            filePath,
            lineNumber: parseInt(lineNumberStr, 10) || 0,
            match: match.trim()
        };
    })
        .filter((res) => res !== null);
}
