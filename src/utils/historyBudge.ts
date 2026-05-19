export type Message = { role: 'user' | 'assistant' | 'system'; content: string; };

const MAX_TOKENS = 8000;
const CHARS_PER_TOKEN = 4;
const MAX_CHARS = MAX_TOKENS * CHARS_PER_TOKEN;

/**
 * Trims the conversation history to stay within token limits.
 * Keeps the most recent messages and the system prompt.
 */
export function budgeHistory(messages: Message[]): Message[] {
  const system = messages.find(m => m.role === 'system');
  const others  = messages.filter(m => m.role !== 'system');

  let total = system ? system.content.length : 0;
  const kept: Message[] = [];

  // Walk backwards, keep most recent messages
  for (let i = others.length - 1; i >= 0; i--) {
    const msg = others[i]!;
    total += msg.content.length;
    if (total > MAX_CHARS && kept.length > 1) break;
    kept.unshift(msg);
  }

  return system ? [system, ...kept] : kept;
}
