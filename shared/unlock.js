// Opens pages locked with desktop/tools/lock.mjs (AES-GCM, key from
// PBKDF2-SHA-256). Used by the desktop's locked folders and by /portfolio/.
// Wrong password → decrypt() throws.

const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function decrypt(lock, password) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: b64(lock.salt), iterations: lock.iterations },
    base, { name: 'AES-GCM', length: 256 }, false, ['decrypt'],
  );
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(lock.iv) }, key, b64(lock.ct));
  return new TextDecoder().decode(plain);
}

export async function fetchLock(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// The portfolio's unlock is remembered for this browser tab's session, so
// reloads and the way back from the desktop don't ask again.
const KEY = 'coto:portfolio';
export const portfolioPassword = {
  get() { try { return sessionStorage.getItem(KEY); } catch { return null; } },
  set(v) { try { sessionStorage.setItem(KEY, v); } catch { /* private mode: ask next time */ } },
  clear() { try { sessionStorage.removeItem(KEY); } catch { /* nothing */ } },
};
