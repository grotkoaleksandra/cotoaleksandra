// ===== cotoaleksandra — the desktop intranet =====
// A Windows 98 desktop. Each folder opens a small site in a window; locked
// folders hold an encrypted page (tools/lock.mjs) that only opens with its
// password, decrypted right here in the browser. Links like
// cotoaleksandra.com/desktop/#demo open that folder straight away.

document.documentElement.classList.add('js');

const desk = document.getElementById('desk');
const phone = matchMedia('(max-width: 760px)');
const calm = matchMedia('(prefers-reduced-motion: reduce)');
const windows = () => [...document.querySelectorAll('[data-window]')];

// ---- the clock in the taskbar ----
const clock = document.getElementById('clock');
function tick() { clock.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
tick();
setInterval(tick, 15000);

// ---- windows ----
let zTop = 10;
let opened = 0;

function bringToFront(win) {
  win.style.zIndex = ++zTop;
  windows().forEach((w) => w.classList.toggle('is-front', w === win));
  renderTaskbar();
}

function place(win) {
  if (win.dataset.placed || phone.matches) return;
  // Cascade new windows, right of the icon column, so they never stack exactly.
  const icons = document.querySelector('.icons').getBoundingClientRect();
  const left = Math.min(icons.right + 30 + (opened % 6) * 30, Math.max(16, desk.clientWidth - win.offsetWidth - 16));
  const top = Math.min(16 + (opened % 6) * 28, Math.max(8, desk.clientHeight - 200));
  win.style.left = `${left}px`;
  win.style.top = `${top}px`;
  win.dataset.placed = '1';
  opened++;
}

function showWindow(win) {
  win.hidden = false;
  place(win);
  bringToFront(win);
  history.replaceState(null, '', `#${win.dataset.name || win.id}`);
  setActiveIcon(win.dataset.name || win.id);
  win.querySelector('[data-close]').focus({ preventScroll: true });
}

function closeWindow(win) {
  win.hidden = true;
  win.classList.remove('is-front');
  const next = windows().filter((w) => !w.hidden).sort((a, b) => b.style.zIndex - a.style.zIndex)[0];
  history.replaceState(null, '', next ? `#${next.dataset.name || next.id}` : location.pathname + location.search);
  setActiveIcon(next && (next.dataset.name || next.id));
  if (next) bringToFront(next); else renderTaskbar();
}

function setActiveIcon(name) {
  document.querySelectorAll('.icon').forEach((i) => i.classList.toggle('is-active', !!name && (i.dataset.folder || i.dataset.open) === name));
}

function wireWindow(win) {
  win.querySelector('[data-close]').addEventListener('click', () => closeWindow(win));
  win.addEventListener('pointerdown', () => bringToFront(win));
  // Drag by the title bar (not on phones, where windows are full screen).
  const bar = win.querySelector('.title-bar');
  bar.addEventListener('pointerdown', (e) => {
    if (phone.matches || e.target.closest('button')) return;
    const startX = e.clientX - win.offsetLeft;
    const startY = e.clientY - win.offsetTop;
    bar.setPointerCapture(e.pointerId);
    // While dragging, frames must not swallow the pointer.
    win.querySelectorAll('iframe').forEach((f) => { f.style.pointerEvents = 'none'; });
    const move = (ev) => {
      win.style.left = `${Math.min(Math.max(ev.clientX - startX, -win.offsetWidth + 80), desk.clientWidth - 60)}px`;
      win.style.top = `${Math.min(Math.max(ev.clientY - startY, 0), desk.clientHeight - 30)}px`;
    };
    const up = () => {
      win.querySelectorAll('iframe').forEach((f) => { f.style.pointerEvents = ''; });
      bar.removeEventListener('pointermove', move);
      bar.removeEventListener('pointerup', up);
    };
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', up);
  });
}
windows().forEach(wireWindow);

// ---- taskbar: one button per open window ----
const taskWindows = document.getElementById('taskWindows');
function renderTaskbar() {
  taskWindows.replaceChildren(...windows().filter((w) => !w.hidden).map((w) => {
    const b = document.createElement('button');
    b.textContent = w.querySelector('.title-bar-text').textContent;
    b.classList.toggle('is-front', w.classList.contains('is-front'));
    b.addEventListener('click', () => showWindow(w));
    return b;
  }));
}

// ---- Start menu ----
const startButton = document.getElementById('startButton');
const startMenu = document.getElementById('startMenu');
function toggleStart(open = startMenu.hidden) {
  startMenu.hidden = !open;
  startButton.setAttribute('aria-expanded', open);
  if (open) startMenu.querySelector('button, a').focus({ preventScroll: true });
}
startButton.addEventListener('click', (e) => { e.stopPropagation(); toggleStart(); });
startMenu.addEventListener('click', (e) => { if (e.target.closest('button, a')) toggleStart(false); });
document.addEventListener('pointerdown', (e) => {
  if (!startMenu.hidden && !e.target.closest('#startMenu, #startButton')) toggleStart(false);
});

// ---- folders ----
const unlocked = new Map();   // folder name → decrypted HTML, for this visit only

function folderWindow(icon) {
  const name = icon.dataset.folder;
  let win = document.getElementById(`win-${name}`);
  if (win) return win;
  const locked = !!icon.dataset.lock;
  win = document.createElement('section');
  win.className = 'window window--wide folderwin';
  win.id = `win-${name}`;
  win.dataset.window = '';
  win.dataset.name = name;
  win.setAttribute('aria-label', icon.dataset.title);
  win.innerHTML = `
    <div class="title-bar">
      <div class="title-bar-text"></div>
      <div class="title-bar-controls"><button aria-label="Maximize" data-full title="Open full screen"></button><button data-close aria-label="Close"></button></div>
    </div>
    <div class="folderwin__addr field-row"><label>Address</label><input type="text" readonly></div>
    <div class="window-body"><iframe title=""></iframe></div>
    <div class="status-bar"><p class="status-bar-field"></p><p class="status-bar-field"></p></div>`;
  win.querySelector('.title-bar-text').textContent = icon.dataset.title;
  win.querySelector('.folderwin__addr input').value = `${location.origin}${location.pathname}#${name}`;
  win.querySelector('iframe').title = icon.dataset.title;
  const [left, right] = win.querySelectorAll('.status-bar-field');
  left.textContent = locked ? 'Unlocked folder' : 'Folder';
  right.textContent = locked ? '🔒 private' : 'public';
  win.querySelector('[data-full]').addEventListener('click', () => openFull(icon));
  win.hidden = true;
  desk.appendChild(win);
  wireWindow(win);
  return win;
}

function openFolder(icon) {
  const name = icon.dataset.folder;
  if (icon.dataset.lock && !unlocked.has(name)) { askPassword(icon); return; }
  const win = folderWindow(icon);
  const frame = win.querySelector('iframe');
  if (!frame.dataset.loaded) {
    if (icon.dataset.lock) {
      // Decrypted pages run sandboxed, in their own opaque origin.
      frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups allow-modals');
      frame.srcdoc = unlocked.get(name);
    } else {
      frame.src = icon.dataset.src;
    }
    frame.dataset.loaded = '1';
  }
  showWindow(win);
  karolSays(icon.dataset.lock ? 'you’re in. nice.' : icon.dataset.karol);
}

function openFull(icon) {
  if (!icon.dataset.lock) { window.open(icon.dataset.src, '_blank', 'noopener'); return; }
  const url = URL.createObjectURL(new Blob([unlocked.get(icon.dataset.folder)], { type: 'text/html' }));
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ---- the password dialog ----
const pw = document.getElementById('pw');
const pwForm = document.getElementById('pwForm');
const pwInput = document.getElementById('pwInput');
const pwError = document.getElementById('pwError');
const pwOk = document.getElementById('pwOk');
let asking = null;

function askPassword(icon) {
  asking = icon;
  document.getElementById('pwName').textContent = icon.dataset.title;
  pwError.textContent = '';
  pwInput.value = '';
  pw.hidden = false;
  pw.style.zIndex = ++zTop + 100;
  pwInput.focus();
  history.replaceState(null, '', `#${icon.dataset.folder}`);
  karolSays(icon.dataset.karol);
}
function closePassword() { pw.hidden = true; asking = null; }
pw.querySelectorAll('[data-cancel]').forEach((b) => b.addEventListener('click', closePassword));

const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function decrypt(lock, password) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: b64(lock.salt), iterations: lock.iterations },
    base, { name: 'AES-GCM', length: 256 }, false, ['decrypt'],
  );
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(lock.iv) }, key, b64(lock.ct));
  return new TextDecoder().decode(plain);
}

pwForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!asking) return;
  const icon = asking;
  pwOk.disabled = true;
  pwError.textContent = 'Checking…';
  try {
    const lock = await (await fetch(icon.dataset.lock, { cache: 'no-store' })).json();
    unlocked.set(icon.dataset.folder, await decrypt(lock, pwInput.value));
    closePassword();
    openFolder(icon);
  } catch {
    pwError.textContent = 'Access denied. Wrong password.';
    pwInput.select();
    if (!calm.matches) { pw.classList.remove('is-shaking'); void pw.offsetWidth; pw.classList.add('is-shaking'); }
    karolSays('nope. that’s not it.');
  } finally {
    pwOk.disabled = false;
  }
});

// ---- icons ----
document.querySelectorAll('[data-open]').forEach((el) => {
  el.addEventListener('click', () => showWindow(document.getElementById(el.dataset.open)));
});
document.querySelectorAll('.icon[data-folder]').forEach((icon) => {
  icon.addEventListener('click', () => openFolder(icon));
});

// Escape closes the password box, the Start menu, or the window on top.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!pw.hidden) { closePassword(); return; }
  if (!startMenu.hidden) { toggleStart(false); startButton.focus(); return; }
  const topWin = windows().filter((w) => !w.hidden).sort((a, b) => b.style.zIndex - a.style.zIndex)[0];
  if (topWin) closeWindow(topWin);
});

// ---- Karol, the assistant ----
const karol = document.getElementById('karol');
const dog = document.getElementById('karolDog');
const bubble = document.getElementById('karolSays');
const pats = ['woof.', 'more pats please.', 'I guard the locked folders.', 'no, I don’t know the passwords.', 'good boy, that’s me.'];

fetch('../karol.svg?v=1')
  .then((r) => r.text())
  .then((svg) => { dog.innerHTML = svg; })
  .catch(() => { dog.innerHTML = '<img src="../karol.svg?v=1" alt="" width="460" height="515">'; });

let quiet;
function karolSays(text) { if (text) bubble.textContent = text; wake(); }

function walkTo(icon) {
  if (phone.matches) return;
  const d = desk.getBoundingClientRect();
  const r = icon.getBoundingClientRect();
  const area = document.querySelector('.icons').getBoundingClientRect();
  karol.style.bottom = 'auto';
  karol.style.right = 'auto';
  karol.style.left = `${area.right - d.left + 8}px`;
  karol.style.top = `${Math.max(70, r.bottom - d.top - karol.offsetWidth * 1.05)}px`;
  if (!calm.matches) {
    karol.classList.add('is-walking');
    clearTimeout(walkTo.t);
    walkTo.t = setTimeout(() => karol.classList.remove('is-walking'), 900);
  }
}
document.querySelectorAll('.icon').forEach((icon) => {
  const point = () => { walkTo(icon); karolSays(icon.dataset.karol); };
  icon.addEventListener('pointerenter', point);
  icon.addEventListener('focus', point);
});

let pat = 0;
dog.addEventListener('click', () => {
  karolSays(pats[pat++ % pats.length]);
  karol.classList.remove('is-happy');
  void karol.offsetWidth;
  karol.classList.add('is-happy');
});

function wake() {
  if (karol.classList.contains('is-asleep')) {
    karol.classList.remove('is-asleep');
    if (bubble.textContent === 'z z z') bubble.textContent = '';
  }
  clearTimeout(quiet);
  quiet = setTimeout(() => { karol.classList.add('is-asleep'); bubble.textContent = 'z z z'; }, 30000);
}
['pointermove', 'keydown', 'pointerdown'].forEach((t) => addEventListener(t, wake, { passive: true }));
wake();

// ---- start: the linked folder or window, or the read me ----
windows().forEach((w) => { w.hidden = true; });
const want = location.hash.slice(1);
const linkedFolder = document.querySelector(`.icon[data-folder="${CSS.escape(want)}"]`);
if (linkedFolder) openFolder(linkedFolder);
else if (document.getElementById(want)?.matches('[data-window]')) showWindow(document.getElementById(want));
else if (!phone.matches) showWindow(document.getElementById('welcome'));
