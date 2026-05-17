"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const keyStore = __importStar(require("../services/keyStore.js"));
const keyPool = __importStar(require("../services/keyPool.js"));
// ─── Key Management ───────────────────────────────────────────────────────────
const router = (0, express_1.Router)();
router.get('/api/keys', (_req, res) => {
    res.json(keyStore.listKeys());
});
router.post('/api/keys', (req, res) => {
    const { provider, key } = req.body;
    if (!provider || !key) {
        res.status(400).json({ error: 'provider and key required' });
        return;
    }
    keyStore.addKey(provider, key);
    res.json({ ok: true });
});
router.delete('/api/keys/:provider/:index', (req, res) => {
    keyStore.removeKey(req.params.provider, parseInt(req.params.index, 10));
    res.json({ ok: true });
});
router.delete('/api/keys/:provider', (req, res) => {
    keyStore.clearProvider(req.params.provider);
    res.json({ ok: true });
});
router.get('/api/status', (_req, res) => {
    res.json(keyPool.getStatus());
});
router.post('/api/cooldowns/reset', (_req, res) => {
    keyPool.resetCooldowns();
    res.json({ ok: true });
});
exports.default = router;
