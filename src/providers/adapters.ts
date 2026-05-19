import https from 'https';
import type { IncomingHttpHeaders } from 'http';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Message = { role: 'user' | 'assistant' | 'system'; content: string; cache?: boolean };
export type StreamResult = { statusCode: number; headers: IncomingHttpHeaders };

// ─── Core HTTPS helper ────────────────────────────────────────────────────────

function httpsRequest(
  options: https.RequestOptions,
  body: string,
  onChunk: (chunk: string | null) => void,
  signal?: AbortSignal,
): Promise<StreamResult> {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const result = { statusCode: res.statusCode ?? 0, headers: res.headers };
      res.on('data', (c: Buffer) => onChunk(c.toString()));
      res.on('end', () => {
        onChunk(null);
        resolve(result);
      });
    });
    req.on('error', reject);
    if (signal) {
      signal.addEventListener('abort', () => { req.destroy(); reject(new Error('aborted')); });
    }
    req.write(body);
    req.end();
  });
}

// ─── SSE parser ───────────────────────────────────────────────────────────────

function makeSSEParser(onLine: (data: string) => void) {
  let buf = '';
  return (chunk: string | null) => {
    if (chunk === null) return;
    buf += chunk;
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (line.startsWith('data: ') && !line.includes('[DONE]')) {
        onLine(line.slice(6));
      }
    }
  };
}

// ─── Claude ───────────────────────────────────────────────────────────────────

export async function streamClaude(
  apiKey: string,
  messages: Message[],
  model: string,
  onToken: (t: string) => void,
  signal?: AbortSignal,
  responseFormat?: 'text' | 'json_object',
): Promise<StreamResult> {
  const system = messages.find(m => m.role === 'system')?.content;
  const userMsgs = messages.filter(m => m.role !== 'system');

  // Cache the system prompt if it exists (highly reusable)
  const systemBlock = system ? [{
    type: 'text',
    text: system,
    cache_control: { type: 'ephemeral' }
  }] : undefined;

  const mappedMessages = userMsgs.map((m, i) => {
    // Cache very large user messages that are older than the immediate context
    const isOldAndLarge = i < userMsgs.length - 2 && m.content.length > 2000;
    if (isOldAndLarge && m.role === 'user') {
      return {
        role: m.role,
        content: [{ type: 'text', text: m.content, cache_control: { type: 'ephemeral' } }]
      };
    }
    return { role: m.role as 'user' | 'assistant', content: m.content };
  });

  const body = JSON.stringify({ 
    model, 
    max_tokens: 8192, 
    stream: true, 
    system: systemBlock,
    messages: mappedMessages,
    response_format: responseFormat ? { type: responseFormat } : undefined
  });
  return httpsRequest(
    {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
        'Content-Length': Buffer.byteLength(body),
      },
    },
    body,
    makeSSEParser((data) => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          onToken(parsed.delta.text);
        }
      } catch { /* skip malformed chunks */ }
    }),
    signal,
  );
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

export async function streamGemini(
  apiKey: string,
  messages: Message[],
  model: string,
  onToken: (t: string) => void,
  signal?: AbortSignal,
  responseFormat?: 'text' | 'json_object',
): Promise<StreamResult> {
  const system = messages.find(m => m.role === 'system')?.content;
  const contents = messages.filter(m => m.role !== 'system').map((m) => {
    const parts: any[] = [];
    if (typeof m.content === 'string') {
      parts.push({ text: m.content });
    } else if (Array.isArray(m.content)) {
      const contentArray = m.content as any[];
      for (const item of contentArray) {
        if (item.type === 'text') parts.push({ text: item.text });
        if (item.type === 'image') {
          const [header, data] = item.source.data.split(';base64,');
          const mime = header.split(':')[1];
          parts.push({ inlineData: { mimeType: mime, data } });
        }
      }
    }
    return {
      role: m.role === 'assistant' ? 'model' : 'user',
      parts
    };
  });
  const body = JSON.stringify({ 
    contents,
    systemInstruction: system ? { parts: [{ text: system }] } : undefined,
    generationConfig: responseFormat === 'json_object' ? { responseMimeType: 'application/json' } : undefined
  });
  return httpsRequest(
    {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    },
    body,
    makeSSEParser((data) => {
      try {
        const parsed = JSON.parse(data);
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) onToken(text);
      } catch { /* skip */ }
    }),
    signal,
  );
}

// ─── OpenAI-compatible ────────────────────────────────────────────────────────

export async function streamOpenAI(
  apiKey: string,
  messages: Message[],
  model: string,
  onToken: (t: string) => void,
  signal?: AbortSignal,
  hostname = 'api.openai.com',
  responseFormat?: 'text' | 'json_object',
): Promise<StreamResult> {
  // OpenAI doesn't have a top-level system parameter in the same way for all models, 
  // but it supports the 'system' role in the messages array.
  const body = JSON.stringify({ 
    model, 
    messages, 
    stream: true,
    response_format: responseFormat ? { type: responseFormat } : undefined
  });
  return httpsRequest(
    {
      hostname,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body),
      },
    },
    body,
    makeSSEParser((data) => {
      try {
        const parsed = JSON.parse(data);
        const text = parsed.choices?.[0]?.delta?.content;
        if (text) onToken(text);
      } catch { /* skip */ }
    }),
    signal,
  );
}

// ─── DeepSeek ─────────────────────────────────────────────────────────────────

export async function streamDeepSeek(
  apiKey: string,
  messages: Message[],
  model: string,
  onToken: (t: string) => void,
  signal?: AbortSignal,
  responseFormat?: 'text' | 'json_object',
): Promise<StreamResult> {
  return streamOpenAI(apiKey, messages, model, onToken, signal, 'api.deepseek.com', responseFormat);
}

// ─── Groq ─────────────────────────────────────────────────────────────────────

export async function streamGroq(
  apiKey: string,
  messages: Message[],
  model: string,
  onToken: (t: string) => void,
  signal?: AbortSignal,
  responseFormat?: 'text' | 'json_object',
): Promise<StreamResult> {
  return streamOpenAI(apiKey, messages, model, onToken, signal, 'api.groq.com', responseFormat);
}
