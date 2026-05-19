import { getKey, handleError } from '../services/keyPool.js';
import { streamClaude, streamGemini, streamOpenAI, streamDeepSeek, type Message } from '../providers/adapters.js';
import { telemetry } from '../services/telemetry.js';

// ─── Model tiers ──────────────────────────────────────────────────────────────

type Tier     = 'basic' | 'inter' | 'adv';
type Provider = 'claude' | 'gemini' | 'openai' | 'deepseek' | 'groq';

const MODELS: Record<Provider, Record<Tier, string>> = {
  claude:   { basic: 'claude-haiku-4-5-20251001',   inter: 'claude-sonnet-4-6',              adv: 'claude-opus-4-6'                  },
  gemini:   { basic: 'gemini-2.0-flash-lite',        inter: 'gemini-2.5-flash-preview-05-20', adv: 'gemini-2.5-pro-preview-05-06'     },
  openai:   { basic: 'gpt-4o-mini',                  inter: 'gpt-4.1',                        adv: 'o4-mini'                          },
  deepseek: { basic: 'deepseek-chat',                inter: 'deepseek-chat',                  adv: 'deepseek-reasoner'                },
  groq:     { basic: 'llama-3.3-70b-versatile',      inter: 'llama-3.3-70b-versatile',        adv: 'llama-3.3-70b-versatile'          },
};

const FALLBACKS: Record<Provider, Provider[]> = {
  claude:   ['openai', 'gemini', 'groq', 'deepseek'],
  gemini:   ['openai', 'claude', 'groq', 'deepseek'],
  openai:   ['claude', 'gemini', 'groq', 'deepseek'],
  deepseek: ['openai', 'gemini', 'groq', 'claude'],
  groq:     ['gemini', 'openai', 'claude', 'deepseek'],
};

// ─── Local intent classifier (zero API calls) ─────────────────────────────────

const BASIC_SIGNALS = ['hi', 'hello', 'hey', 'what is', 'explain', 'merhaba', 'nedir',
                       'nasıl çalışır', 'ne demek', 'selam', 'define', 'definition',
                       'what does', 'how does', 'describe', 'list'];
const ADV_SIGNALS   = ['refactor entire', 'security audit', 'architecture', 'performance bottleneck',
                       'tüm sistemi', 'mimari', 'güvenlik açığı', 'redesign', 'optimize entire',
                       'audit', 'systemic', 'overhaul', 'migration', 'migrat', 'deep dive'];

function classifyIntentLocal(messages: Message[]): Tier {
  const last = (messages[messages.length - 1]?.content ?? '').toLowerCase().trim();
  const wordCount = last.split(/\s+/).length;

  if (wordCount < 10 && BASIC_SIGNALS.some(s => last.includes(s))) return 'basic';
  if (ADV_SIGNALS.some(s => last.includes(s)) || wordCount > 300) return 'adv';
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
  responseFormat?: 'text' | 'json_object',
): Promise<void> {
  const model = MODELS[provider][tier];
  const { key, index } = keyInfo;
  let result: { statusCode: number; headers: unknown };

  switch (provider) {
    case 'claude':   result = await streamClaude(key, messages, model, onToken, signal, responseFormat); break;
    case 'gemini':   result = await streamGemini(key, messages, model, onToken, signal, responseFormat); break;
    case 'groq':     result = await streamOpenAI(key, messages, model, onToken, signal, 'api.groq.com', responseFormat); break;
    case 'openai':   result = await streamOpenAI(key, messages, model, onToken, signal, 'api.openai.com', responseFormat); break;
    case 'deepseek': result = await streamDeepSeek(key, messages, model, onToken, signal); break;
  }

  if (result!.statusCode >= 400) {
    handleError(provider, index, result!.statusCode);
    throw Object.assign(new Error(`HTTP ${result!.statusCode}`), { statusCode: result!.statusCode });
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export type RouteResult = { provider: string; model: string; tier: string };

export async function route(
  messages: Message[],
  preferredProvider: string,
  onToken: (t: string) => void,
  onRoute: (r: RouteResult) => void,
  options?: { signal?: AbortSignal; system?: string; strict?: boolean },
): Promise<RouteResult> {
  const signal = options?.signal;
  const pref = preferredProvider as Provider;
  let tier: Tier = 'inter';
  let clean      = [...messages];

  // If system prompt is provided, prepend it with the 'system' role
  if (options?.system) {
    clean = [{ role: 'system', content: options.system, cache: true }, ...clean];
  }

  // Allow explicit tier override via prefix: "/adv explain this"
  const last     = messages[messages.length - 1]?.content ?? '';
  const tagMatch = last.match(/^[/]?(basic|inter|adv)\s+/i);
  if (tagMatch) {
    tier  = tagMatch[1]!.toLowerCase() as Tier;
    clean = [
      ...messages.slice(0, -1),
      { ...messages[messages.length - 1]!, content: last.replace(/^[/]?(basic|inter|adv)\s+/i, '') },
    ];
  } else {
    tier = classifyIntentLocal(messages);
  }

  const providers: Provider[] = [pref, ...FALLBACKS[pref].filter(p => p !== pref)];

  // Detect coding intent to force strict mode
  const isCodeTask = /write|create|fix|refactor|implement|build|update/i.test(last);
  const strict = options?.strict ?? isCodeTask;

  for (const provider of providers) {
    const keyInfo = getKey(provider);
    if (!keyInfo) continue;
    const model = MODELS[provider][tier];
    onRoute({ provider, model, tier });
    try {
      const start = Date.now();
      await callProvider(provider, keyInfo, clean, tier, onToken, signal, strict ? 'json_object' : undefined);
      const latencyMs = Date.now() - start;
      
      telemetry.track({
        type: 'model_used',
        provider,
        model,
        tier,
        latencyMs,
        success: true
      });

      return { provider, model, tier };
    } catch (err: unknown) {
      if ((err as Error).message === 'aborted') throw err;
    }
  }

  throw new Error('No available API keys. Add keys in Settings.');
}
