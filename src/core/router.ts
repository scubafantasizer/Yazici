import { getKey, handleError } from '../services/keyPool.js';
import { streamClaude, streamGemini, streamOpenAI, streamDeepSeek, type Message } from '../providers/adapters.js';

// ─── Model tiers ──────────────────────────────────────────────────────────────

type Tier     = 'basic' | 'inter' | 'adv';
type Provider = 'claude' | 'gemini' | 'openai' | 'deepseek';

const MODELS: Record<Provider, Record<Tier, string>> = {
  claude:   { basic: 'claude-haiku-4-5',    inter: 'claude-sonnet-4-5',   adv: 'claude-opus-4-5'      },
  gemini:   { basic: 'gemini-2.0-flash',    inter: 'gemini-2.5-flash',    adv: 'gemini-2.5-pro'       },
  openai:   { basic: 'gpt-4o-mini',         inter: 'gpt-4o',              adv: 'gpt-4o'               },
  deepseek: { basic: 'deepseek-chat',       inter: 'deepseek-chat',       adv: 'deepseek-reasoner'    },
};

const FALLBACKS: Record<Provider, Provider[]> = {
  claude:   ['openai', 'gemini', 'deepseek'],
  gemini:   ['openai', 'claude', 'deepseek'],
  openai:   ['claude', 'gemini', 'deepseek'],
  deepseek: ['openai', 'gemini', 'claude'],
};

// ─── Intent classifier ────────────────────────────────────────────────────────

const CLASSIFIER_PROMPT = `You are a task complexity classifier.
Respond with exactly one word: "basic", "inter", or "adv".
basic — simple Q&A, greetings, formatting, trivial edits
inter — explaining code, adding features, writing tests
adv   — architecture design, deep debugging, security audits`;

async function classifyIntent(messages: Message[], signal?: AbortSignal): Promise<Tier> {
  const last = messages[messages.length - 1]?.content ?? '';
  for (const provider of ['gemini', 'deepseek', 'openai', 'claude'] as Provider[]) {
    const keyInfo = getKey(provider);
    if (!keyInfo) continue;
    let result = '';
    const probe: Message[] = [
      { role: 'user', content: `${CLASSIFIER_PROMPT}\n\nMessage: ${last.slice(0, 500)}` },
    ];
    try {
      await callProvider(provider, keyInfo, probe, 'basic', (t) => { result += t; }, signal);
      result = result.trim().toLowerCase();
      if (result === 'basic' || result === 'inter' || result === 'adv') return result;
    } catch { /* try next */ }
  }
  return 'inter';
}

// ─── Provider dispatcher ──────────────────────────────────────────────────────

async function callProvider(
  provider: Provider,
  keyInfo: { key: string; index: number },
  messages: Message[],
  tier: Tier,
  onToken: (t: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const model = MODELS[provider][tier];
  const { key, index } = keyInfo;
  let statusCode: number;

  switch (provider) {
    case 'claude':   statusCode = await streamClaude(key, messages, model, onToken, signal); break;
    case 'gemini':   statusCode = await streamGemini(key, messages, model, onToken, signal); break;
    case 'openai':   statusCode = await streamOpenAI(key, messages, model, onToken, signal); break;
    case 'deepseek': statusCode = await streamDeepSeek(key, messages, model, onToken, signal); break;
  }

  if (statusCode >= 400) {
    handleError(provider, index, statusCode);
    throw Object.assign(new Error(`HTTP ${statusCode}`), { statusCode });
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export type RouteResult = { provider: string; model: string; tier: string };

export async function route(
  messages: Message[],
  preferredProvider: string,
  onToken: (t: string) => void,
  onRoute: (r: RouteResult) => void,
  signal?: AbortSignal,
): Promise<RouteResult> {
  const pref = preferredProvider as Provider;
  let tier: Tier    = 'inter';
  let clean         = [...messages];

  // Allow explicit tier override via prefix: "/adv explain this"
  const last     = messages[messages.length - 1]?.content ?? '';
  const tagMatch = last.match(/^\/?(\basic|inter|adv)\s+/i);
  if (tagMatch) {
    tier  = tagMatch[1]!.toLowerCase() as Tier;
    clean = [
      ...messages.slice(0, -1),
      { ...messages[messages.length - 1]!, content: last.replace(/^\/?(\basic|inter|adv)\s+/i, '') },
    ];
  } else {
    tier = await classifyIntent(messages, signal);
  }

  const providers: Provider[] = [pref, ...FALLBACKS[pref].filter(p => p !== pref)];

  for (const provider of providers) {
    const keyInfo = getKey(provider);
    if (!keyInfo) continue;
    const model = MODELS[provider][tier];
    onRoute({ provider, model, tier });
    try {
      await callProvider(provider, keyInfo, clean, tier, onToken, signal);
      return { provider, model, tier };
    } catch (err: unknown) {
      if ((err as Error).message === 'aborted') throw err;
      // continue to next provider
    }
  }

  throw new Error('No available API keys. Add keys in Settings.');
}
