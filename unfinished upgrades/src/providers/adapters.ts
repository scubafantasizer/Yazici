import https from 'https';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Message = { role: 'user' | 'assistant'; content: string };

// ─── Core HTTPS helper ────────────────────────────────────────────────────────

function httpsRequest(
  options: https.RequestOptions,
  body: string,
  onChunk: (chunk: string | null) => void,
  signal?: AbortSignal,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      resolve(res.statusCode ?? 0);
      res.on('data', (c: Buffer) => onChunk(c.toString()));
      res.on('end', () => onChunk(null));
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
): Promise<number> {
  const body = JSON.stringify({ model, max_tokens: 8192, stream: true, messages });
  return httpsRequest(
    {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
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
): Promise<number> {
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const body = JSON.stringify({ contents });
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
): Promise<number> {
  const body = JSON.stringify({ model, messages, stream: true });
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
): Promise<number> {
  return streamOpenAI(apiKey, messages, model, onToken, signal, 'api.deepseek.com');
}
