"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getKey = getKey;
exports.handleError = handleError;
exports.resetCooldowns = resetCooldowns;
exports.getStatus = getStatus;
const keyStore_js_1 = require("./keyStore.js");
// ─── State ────────────────────────────────────────────────────────────────────
const cooldowns = {};
const roundRobin = {};
// ─── Cooldown helpers ─────────────────────────────────────────────────────────
function ck(provider, index) {
    return `${provider}:${index}`;
}
function isOnCooldown(provider, index) {
    const key = ck(provider, index);
    if (!cooldowns[key])
        return false;
    if (Date.now() > cooldowns[key]) {
        delete cooldowns[key];
        return false;
    }
    return true;
}
function setCooldown(provider, index, ms) {
    cooldowns[ck(provider, index)] = Date.now() + ms;
}
// ─── Public API ───────────────────────────────────────────────────────────────
function getKey(provider) {
    const keys = (0, keyStore_js_1.load)()[provider] ?? [];
    if (keys.length === 0)
        return null;
    const start = roundRobin[provider] ?? 0;
    for (let i = 0; i < keys.length; i++) {
        const idx = (start + i) % keys.length;
        if (!isOnCooldown(provider, idx)) {
            roundRobin[provider] = (idx + 1) % keys.length;
            return { key: keys[idx], index: idx };
        }
    }
    return null;
}
function handleError(provider, index, statusCode, retryAfter) {
    if (statusCode === 429) {
        setCooldown(provider, index, retryAfter ? retryAfter * 1000 : 60_000);
    }
    else if (statusCode === 401 || statusCode === 403) {
        setCooldown(provider, index, 24 * 60 * 60 * 1000);
    }
}
function resetCooldowns() {
    for (const key of Object.keys(cooldowns))
        delete cooldowns[key];
}
function getStatus() {
    const all = (0, keyStore_js_1.load)();
    const result = {};
    for (const [provider, keys] of Object.entries(all)) {
        result[provider] = {
            total: keys.length,
            available: keys.filter((_, i) => !isOnCooldown(provider, i)).length,
        };
    }
    return result;
}
