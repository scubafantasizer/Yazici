"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const url_1 = require("url");
const __filename = (0, url_1.fileURLToPath)(import.meta.url);
const __dirname = path_1.default.dirname(__filename);
const index_js_1 = __importDefault(require("./routes/index.js"));
// ─── Setup ────────────────────────────────────────────────────────────────────
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT ?? '3147', 10);
const HOST = process.env.HOST ?? '127.0.0.1';
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.static(path_1.default.join(__dirname, '..', 'public')));
// ─── API routes ───────────────────────────────────────────────────────────────
app.use(index_js_1.default);
// ─── SPA fallback ─────────────────────────────────────────────────────────────
app.get('*', (_req, res) => {
    res.sendFile(path_1.default.join(__dirname, '..', 'public', 'index.html'));
});
// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, HOST, () => {
    const url = `http://${HOST}:${PORT}`;
    console.log(`\n  ✦ Yazıcı v3.0.0\n`);
    console.log(`  Local:  ${url}`);
    console.log(`  API:    ${url}/api/health\n`);
});
