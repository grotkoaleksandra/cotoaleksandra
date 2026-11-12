// Lock a desktop folder: encrypt one self-contained HTML page with a password.
//
//   node desktop/tools/lock.mjs desktop/_src/<name>/index.html desktop/f/<name>.lock.json '<password>'
//
// The page must be a single file (inline its CSS/JS; images as data: URIs or
// absolute https URLs). Its unencrypted source lives in desktop/_src/, which is
// gitignored, so only the encrypted .lock.json is ever published.
//
// Format: AES-256-GCM, key from PBKDF2-SHA-256 (310,000 rounds, random salt),
// decrypted in the visitor's browser by desktop.js with the same password.
// Good protection for prototypes; use a real password, since a determined
// person can guess offline at a password that is short or common.

import { readFile, writeFile } from 'node:fs/promises';
import { webcrypto as crypto } from 'node:crypto';

const [src, out, password] = process.argv.slice(2);
if (!src || !out || !password) {
  console.error('usage: node desktop/tools/lock.mjs <source.html> <out.lock.json> <password>');
  process.exit(1);
}

const ITERATIONS = 310000;
const enc = new TextEncoder();
const b64 = (buf) => Buffer.from(buf).toString('base64');

const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
  base,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt'],
);
const html = await readFile(src);
const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, html);

await writeFile(out, JSON.stringify({ v: 1, kdf: 'PBKDF2-SHA-256', iterations: ITERATIONS, salt: b64(salt), iv: b64(iv), ct: b64(ct) }) + '\n');
console.log(`locked ${src} → ${out} (${html.length} bytes)`);
