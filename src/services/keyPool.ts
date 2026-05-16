import { load as loadKeys } from './keyStore.js';

// ─── State ────────────────────────────────────────────────────────────────────

const cooldowns: Record<string, number> = {};
const roundRobin: Record<string, number> = {};

// ─── Cooldown helpers ─────────────────────────────────────────────────────────

function ck(provider: string, index: number): string {
  return `${provider}:${index}`;
}

function isOnCooldown(provider: string, index: number): boolean {
  const key = ck(provider, index);
  if (!cooldowns[key]) return false;
  if (Date.now() > cooldowns[key]) { delete cooldowns[key]; return false; }
  return true;
}

function setCooldown(provider: string, index: number, ms: number): void {
  cooldowns[ck(provider, index)] = Date.now() + ms;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getKey(provider: string): { key: string; index: number } | null {
  const keys = loadKeys()[provider] ?? [];
  if (keys.length === 0) return null;

  const start = roundRobin[provider] ?? 0;
  for (let i = 0; i < keys.length; i++) {
    const idx = (start + i) % keys.length;
    if (!isOnCooldown(provider, idx)) {
      roundRobin[provider] = (idx + 1) % keys.length;
      return { key: keys[idx]!, index: idx };
    }
  }
  return null;
}

export function handleError(provider: string, index: number, statusCode: number, retryAfter?: number): void {
  if (statusCode === 429) {
    setCooldown(provider, index, retryAfter ? retryAfter * 1000 : 60_000);
  } else if (statusCode === 401 || statusCode === 403) {
    setCooldown(provider, index, 24 * 60 * 60 * 1000);
  }
}

export function resetCooldowns(): void {
  for (const key of Object.keys(cooldowns)) delete cooldowns[key];
}

export function getStatus(): Record<string, { total: number; available: number }> {
  const all = loadKeys();
  const result: Record<string, { total: number; available: number }> = {};
  for (const [provider, keys] of Object.entries(all)) {
    result[provider] = {
      total: keys.length,
      available: keys.filter((_, i) => !isOnCooldown(provider, i)).length,
    };
  }
  return result;
}
