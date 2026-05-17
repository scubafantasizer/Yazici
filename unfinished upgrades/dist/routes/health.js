"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
// ─── Health ───────────────────────────────────────────────────────────────────
const router = (0, express_1.Router)();
router.get('/api/health', (_req, res) => {
    res.json({ ok: true, version: '3.0.0', ts: new Date().toISOString() });
});
exports.default = router;
