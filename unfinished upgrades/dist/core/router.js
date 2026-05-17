"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.route = route;
const keyPool_js_1 = require("../services/keyPool.js");
const adapters_js_1 = require("../providers/adapters.js");
const MODELS = {
    claude: { basic: 'claude-haiku-4-5', inter: 'claude-sonnet-4-5', adv: 'claude-opus-4-5' },
    gemini: { basic: 'gemini-2.0-flash', inter: 'gemini-2.5-flash', adv: 'gemini-2.5-pro' },
    openai: { basic: 'gpt-4o-mini', inter: 'gpt-4o', adv: 'gpt-4o' },
    deepseek: { basic: 'deepseek-chat', inter: 'deepseek-chat', adv: 'deepseek-reasoner' },
};
const FALLBACKS = {
    claude: ['openai', 'gemini', 'deepseek'],
    gemini: ['openai', 'claude', 'deepseek'],
    openai: ['claude', 'gemini', 'deepseek'],
    deepseek: ['openai', 'gemini', 'claude'],
};
// ─── Intent classifier ────────────────────────────────────────────────────────
const CLASSIFIER_PROMPT = `You are a task complexity classifier.
Respond with exactly one word: "basic", "inter", or "adv".
basic — simple Q&A, greetings, formatting, trivial edits
inter — explaining code, adding features, writing tests
adv   — architecture design, deep debugging, security audits`;
async function classifyIntent(messages, signal) {
    const last = messages[messages.length - 1]?.content ?? '';
    for (const provider of ['gemini', 'deepseek', 'openai', 'claude']) {
        const keyInfo = (0, keyPool_js_1.getKey)(provider);
        if (!keyInfo)
            continue;
        let result = '';
        const probe = [
            { role: 'user', content: `${CLASSIFIER_PROMPT}\n\nMessage: ${last.slice(0, 500)}` },
        ];
        try {
            await callProvider(provider, keyInfo, probe, 'basic', (t) => { result += t; }, signal);
            result = result.trim().toLowerCase();
            if (result === 'basic' || result === 'inter' || result === 'adv')
                return result;
        }
        catch { /* try next */ }
    }
    return 'inter';
}
// ─── Provider dispatcher ──────────────────────────────────────────────────────
async function callProvider(provider, keyInfo, messages, tier, onToken, signal) {
    const model = MODELS[provider][tier];
    const { key, index } = keyInfo;
    let statusCode;
    switch (provider) {
        case 'claude':
            statusCode = await (0, adapters_js_1.streamClaude)(key, messages, model, onToken, signal);
            break;
        case 'gemini':
            statusCode = await (0, adapters_js_1.streamGemini)(key, messages, model, onToken, signal);
            break;
        case 'openai':
            statusCode = await (0, adapters_js_1.streamOpenAI)(key, messages, model, onToken, signal);
            break;
        case 'deepseek':
            statusCode = await (0, adapters_js_1.streamDeepSeek)(key, messages, model, onToken, signal);
            break;
    }
    if (statusCode >= 400) {
        (0, keyPool_js_1.handleError)(provider, index, statusCode);
        throw Object.assign(new Error(`HTTP ${statusCode}`), { statusCode });
    }
}
async function route(messages, preferredProvider, onToken, onRoute, signal) {
    const pref = preferredProvider;
    let tier = 'inter';
    let clean = [...messages];
    // Allow explicit tier override via prefix: "/adv explain this"
    const last = messages[messages.length - 1]?.content ?? '';
    const tagMatch = last.match(/^\/?(\basic|inter|adv)\s+/i);
    if (tagMatch) {
        tier = tagMatch[1].toLowerCase();
        clean = [
            ...messages.slice(0, -1),
            { ...messages[messages.length - 1], content: last.replace(/^\/?(\basic|inter|adv)\s+/i, '') },
        ];
    }
    else {
        tier = await classifyIntent(messages, signal);
    }
    const providers = [pref, ...FALLBACKS[pref].filter(p => p !== pref)];
    for (const provider of providers) {
        const keyInfo = (0, keyPool_js_1.getKey)(provider);
        if (!keyInfo)
            continue;
        const model = MODELS[provider][tier];
        onRoute({ provider, model, tier });
        try {
            await callProvider(provider, keyInfo, clean, tier, onToken, signal);
            return { provider, model, tier };
        }
        catch (err) {
            if (err.message === 'aborted')
                throw err;
            // continue to next provider
        }
    }
    throw new Error('No available API keys. Add keys in Settings.');
}
