"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router_js_1 = require("../core/router.js");
const prompt_js_1 = require("../core/prompt.js");
// ─── Chat Stream ──────────────────────────────────────────────────────────────
const router = (0, express_1.Router)();
router.post('/api/chat/stream', async (req, res) => {
    const { messages, provider = 'gemini' } = req.body;
    if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ error: 'messages array required' });
        return;
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
    const ac = new AbortController();
    req.on('close', () => ac.abort());
    try {
        const systemMessage = { role: 'user', content: (0, prompt_js_1.buildSystemPrompt)() };
        const messagesWithSystem = [systemMessage, ...messages];
        const result = await (0, router_js_1.route)(messagesWithSystem, provider, (text) => send({ type: 'chunk', text }), (r) => send({ type: 'route', ...r }), ac.signal);
        send({ type: 'done', ...result });
    }
    catch (err) {
        const msg = err.message;
        if (msg === 'aborted') {
            send({ type: 'aborted' });
        }
        else {
            send({ type: 'error', message: msg });
        }
    }
    res.end();
});
exports.default = router;
