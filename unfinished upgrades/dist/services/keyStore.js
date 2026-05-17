"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addKey = addKey;
exports.removeKey = removeKey;
exports.clearProvider = clearProvider;
exports.listKeys = listKeys;
exports.load = load;
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
// ─── Storage ──────────────────────────────────────────────────────────────────
const KEY_FILE = path_1.default.join(os_1.default.homedir(), '.gateai', 'keys.json');
// ─── Encryption ───────────────────────────────────────────────────────────────
function deriveEncKey() {
    const seed = os_1.default.hostname() + os_1.default.userInfo().username + 'gateai-v3';
    return crypto_1.default.createHash('sha256').update(seed).digest();
}
function encrypt(text) {
    const key = deriveEncKey();
    const iv = crypto_1.default.randomBytes(16);
    const cipher = crypto_1.default.createCipheriv('aes-256-gcm', key, iv);
    const enc = cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${tag}:${enc}`;
}
function decrypt(data) {
    const key = deriveEncKey();
    const [ivHex, tagHex, enc] = data.split(':');
    const decipher = crypto_1.default.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return decipher.update(enc, 'hex', 'utf8') + decipher.final('utf8');
}
// ─── Persistence ──────────────────────────────────────────────────────────────
function load() {
    if (!fs_1.default.existsSync(KEY_FILE))
        return {};
    try {
        const raw = JSON.parse(fs_1.default.readFileSync(KEY_FILE, 'utf8'));
        const result = {};
        for (const [provider, keys] of Object.entries(raw)) {
            result[provider] = keys.map(k => decrypt(k));
        }
        return result;
    }
    catch {
        return {};
    }
}
function save(data) {
    const enc = {};
    for (const [provider, keys] of Object.entries(data)) {
        enc[provider] = keys.map(k => encrypt(k));
    }
    fs_1.default.writeFileSync(KEY_FILE, JSON.stringify(enc, null, 2));
}
// ─── Public API ───────────────────────────────────────────────────────────────
function addKey(provider, key) {
    const data = load();
    if (!data[provider])
        data[provider] = [];
    if (!data[provider].includes(key))
        data[provider].push(key);
    save(data);
}
function removeKey(provider, index) {
    const data = load();
    if (data[provider]) {
        data[provider].splice(index, 1);
        if (data[provider].length === 0)
            delete data[provider];
        save(data);
    }
}
function clearProvider(provider) {
    const data = load();
    delete data[provider];
    save(data);
}
function listKeys() {
    const data = load();
    const result = {};
    for (const [provider, keys] of Object.entries(data)) {
        result[provider] = keys.map((k, i) => ({
            index: i,
            preview: k.slice(0, 8) + '...' + k.slice(-4),
        }));
    }
    return result;
}
