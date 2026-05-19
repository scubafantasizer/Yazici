import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

const OLD_GATEAI_DIR = path.join(os.homedir(), '.gateai');
const KEY_DIR = path.join(os.homedir(), '.yazici');

// Migration check
if (!fs.existsSync(KEY_DIR) && fs.existsSync(OLD_GATEAI_DIR)) {
  try {
    fs.renameSync(OLD_GATEAI_DIR, KEY_DIR);
    console.log(`\n  ✦ Migrated config from ${OLD_GATEAI_DIR} to ${KEY_DIR}\n`);
  } catch (err) {
    console.error(`  ⚠ Failed to migrate config: ${(err as Error).message}`);
  }
}

if (!fs.existsSync(KEY_DIR)) fs.mkdirSync(KEY_DIR, { recursive: true });

const KEY_FILE = path.join(KEY_DIR, 'keys.json');

type KeyMap = Record<string, string[]>;

// ─── Encryption ───────────────────────────────────────────────────────────────

function deriveEncKey(): Buffer {
  const seed = os.hostname() + os.userInfo().username + 'yazici-v3';
  return crypto.createHash('sha256').update(seed).digest();
}

function encrypt(text: string): string {
  const key = deriveEncKey();
  const iv  = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc    = cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
  const tag    = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${enc}`;
}

function decrypt(data: string): string {
  const key  = deriveEncKey();
  const [ivHex, tagHex, enc] = data.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(enc, 'hex', 'utf8') + decipher.final('utf8');
}

// ─── Persistence ──────────────────────────────────────────────────────────────

function load(): KeyMap {
  if (!fs.existsSync(KEY_FILE)) return {};
  try {
    const raw: Record<string, string[]> = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
    const result: KeyMap = {};
    for (const [provider, keys] of Object.entries(raw)) {
      result[provider] = keys.map(k => decrypt(k));
    }
    return result;
  } catch {
    return {};
  }
}

function save(data: KeyMap): void {
  const enc: Record<string, string[]> = {};
  for (const [provider, keys] of Object.entries(data)) {
    enc[provider] = keys.map(k => encrypt(k));
  }
  fs.writeFileSync(KEY_FILE, JSON.stringify(enc, null, 2));
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function addKey(provider: string, key: string): void {
  const data = load();
  if (!data[provider]) data[provider] = [];
  if (!data[provider].includes(key)) data[provider].push(key);
  save(data);
}

export function removeKey(provider: string, index: number): void {
  const data = load();
  if (data[provider]) {
    data[provider].splice(index, 1);
    if (data[provider].length === 0) delete data[provider];
    save(data);
  }
}

export function clearProvider(provider: string): void {
  const data = load();
  delete data[provider];
  save(data);
}

export function listKeys(): Record<string, { index: number; preview: string }[]> {
  const data = load();
  const result: Record<string, { index: number; preview: string }[]> = {};
  for (const [provider, keys] of Object.entries(data)) {
    if (provider === 'SUDO_PASS') continue; // Hide sudo password from UI
    result[provider] = keys.map((k, i) => ({
      index: i,
      preview: k.slice(0, 8) + '...' + k.slice(-4),
    }));
  }
  return result;
}

export function setSudoPass(password: string): void {
  const data = load();
  data['SUDO_PASS'] = [password];
  save(data);
}

export function getSudoPass(): string | null {
  const data = load();
  return data['SUDO_PASS']?.[0] || null;
}

export { load };
