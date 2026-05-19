import fs   from 'fs';
import path from 'path';
import { pipeline } from '@xenova/transformers';

let embedder: any = null;

async function getEmbedder() {
  if (!embedder) {
    // Using a lightweight model for speed
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return embedder;
}

function cosineSimilarity(v1: number[], v2: number[]) {
  let dot = 0;
  let m1 = 0;
  let m2 = 0;
  for (let i = 0; i < v1.length; i++) {
    dot += v1[i] * v2[i];
    m1 += v1[i] * v1[i];
    m2 += v2[i] * v2[i];
  }
  return dot / (Math.sqrt(m1) * Math.sqrt(m2));
}

export async function selectRelevantContext(
  userQuery: string,
  workspaceFiles: string[],
  maxFiles = 3,
  maxTokensPerFile = 600
): Promise<string> {
  
  // Fallback to keyword search if files list is empty or if error occurs
  if (!workspaceFiles || workspaceFiles.length === 0) {
    // In a real app, we would list all files in the workspace here
    return ""; 
  }

  try {
    const embed = await getEmbedder();
    const queryEmbed = await embed(userQuery, { pooling: 'mean', normalize: true });
    const queryVector = Array.from(queryEmbed.data) as number[];

    const scoredFiles: { path: string; score: number }[] = [];

    for (const file of workspaceFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8').slice(0, 1000); // Only embed first 1k chars
        const fileEmbed = await embed(content, { pooling: 'mean', normalize: true });
        const fileVector = Array.from(fileEmbed.data) as number[];
        const score = cosineSimilarity(queryVector, fileVector);
        scoredFiles.push({ path: file, score });
      } catch { /* skip */ }
    }

    const top = scoredFiles.sort((a, b) => b.score - a.score).slice(0, maxFiles);
    
    let context = '';
    for (const f of top) {
      const content = fs.readFileSync(f.path, 'utf8');
      context += `\n[FILE: ${f.path}]\n${content.slice(0, maxTokensPerFile * 4)}\n`;
    }

    return context;
  } catch (err) {
    console.warn("Semantic search failed, falling back to keywords:", err);
    // Simple keyword fallback
    const queryWords = userQuery.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const scoredFiles: { path: string; score: number }[] = [];

    for (const file of workspaceFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8').toLowerCase();
        let score = 0;
        for (const word of queryWords) {
          if (content.includes(word)) score++;
        }
        if (score > 0) scoredFiles.push({ path: file, score });
      } catch { /* skip */ }
    }

    const top = scoredFiles.sort((a, b) => b.score - a.score).slice(0, maxFiles);
    let context = '';
    for (const f of top) {
      context += `\n[FILE: ${f.path}]\n${fs.readFileSync(f.path, 'utf8').slice(0, maxTokensPerFile * 4)}\n`;
    }
    return context;
  }
}
