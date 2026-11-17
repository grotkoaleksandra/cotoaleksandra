// ===== cotoaleksandra — the desktop intranet =====
// A Windows 98 desktop. Each folder opens a small site in a window; locked
// folders hold an encrypted page (tools/lock.mjs) that only opens with its
// password, decrypted right here in the browser. Links like
// cotoaleksandra.com/#demo open that folder straight away. The desktop is
// the home page (index.html at the site root); /desktop/ redirects there.
//
// The portfolio icon is special: it checks the password here, remembers it
// for the session (shared/unlock.js) and goes to /portfolio/, which decrypts
// and shows the real page.
//
// Folders made in /admin/ live in Supabase and are added after the hardcoded
// icons (see "folders from /admin/" below). If Supabase is down, they simply
// don't appear; everything hardcoded keeps working.

import { SUPABASE_URL, SUPABASE_ANON_KEY, FUNCTIONS_URL } from '../shared/config.js';
import { decrypt, fetchLock, portfolioPassword } from '../shared/unlock.js?v=1';

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
  if (win.contains(document.activeElement)) document.activeElement.blur();   // e.g. its frame, after Escape
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
    // End the drag however the pointer goes away (a cancelled touch or lost
    // capture too), or the window keeps following the pointer.
    const ends = ['pointerup', 'pointercancel', 'lostpointercapture'];
    const up = () => {
      win.querySelectorAll('iframe').forEach((f) => { f.style.pointerEvents = ''; });
      bar.removeEventListener('pointermove', move);
      ends.forEach((t) => bar.removeEventListener(t, up));
    };
    bar.addEventListener('pointermove', move);
    ends.forEach((t) => bar.addEventListener(t, up));
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
  const locked = !!(icon.dataset.lock || icon.dataset.locked);
  const db = !!icon.dataset.db;
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
    <div class="window-body">${db ? '<div class="dbfolder"></div>' : '<iframe title=""></iframe>'}</div>
    <div class="status-bar"><p class="status-bar-field"></p><p class="status-bar-field"></p></div>`;
  win.querySelector('.title-bar-text').textContent = icon.dataset.title;
  win.querySelector('.folderwin__addr input').value = `${location.origin}${location.pathname}#${name}`;
  if (db) win.classList.add('folderwin--db');
  else {
    const frame = win.querySelector('iframe');
    frame.title = icon.dataset.title;
    // Keys pressed inside the folder's page never reach this document, so
    // Escape there would do nothing. Same-origin pages: listen in them.
    frame.addEventListener('load', () => {
      try { frame.contentWindow.addEventListener('keydown', (e) => { if (e.key === 'Escape') onEscape(); }); } catch { /* sandboxed: see FRAME_ESC */ }
    });
  }
  const [left, right] = win.querySelectorAll('.status-bar-field');
  left.textContent = locked ? 'Unlocked folder' : 'Folder';
  right.textContent = locked ? '🔒 private' : 'public';
  win.querySelector('[data-full]').addEventListener('click', () => (db ? win.classList.toggle('is-max') : openFull(icon)));
  win.hidden = true;
  desk.appendChild(win);
  wireWindow(win);
  return win;
}

function openFolder(icon) {
  const name = icon.dataset.folder;
  if (icon.dataset.portfolio) { openPortfolio(icon); return; }
  if (icon.dataset.db) { openDbFolder(icon); return; }
  if (icon.dataset.lock && !unlocked.has(name)) { askPassword(icon); return; }
  const win = folderWindow(icon);
  const frame = win.querySelector('iframe');
  if (!frame.dataset.loaded) {
    if (icon.dataset.lock) {
      // Decrypted pages run sandboxed, in their own opaque origin.
      frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups allow-modals');
      frame.srcdoc = unlocked.get(name) + FRAME_ESC;
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

// Sandboxed (decrypted) pages run in their own origin, so they tell us
// about Escape themselves.
const FRAME_ESC = `<script>addEventListener('keydown',function(e){if(e.key==='Escape')parent.postMessage('desktop:escape','*')})<\/script>`;
addEventListener('message', (e) => {
  if (e.data === 'desktop:escape' && [...document.querySelectorAll('.folderwin iframe')].some((f) => f.contentWindow === e.source)) onEscape();
});

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

// ---- the portfolio: locked, opens full page at /portfolio/ ----
// `section` = an old home-page anchor (#about, #contact…) to land on.
let portfolioSection = '';
function goToPortfolio(icon) {
  history.replaceState(null, '', location.pathname + location.search);  // so Back doesn't bounce here again
  location.href = icon.dataset.portfolio + (portfolioSection ? `#${portfolioSection}` : '');
}
function openPortfolio(icon) {
  if (portfolioPassword.get()) { karolSays('off you go.'); goToPortfolio(icon); return; }
  askPassword(icon);
}
const portfolioIcon = document.querySelector('.icon[data-portfolio]');
document.querySelectorAll('[data-portfolio-link]').forEach((el) => el.addEventListener('click', (e) => {
  e.preventDefault();
  openPortfolio(portfolioIcon);
}));

pwForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!asking) return;
  const icon = asking;
  pwOk.disabled = true;
  pwError.textContent = 'Checking…';
  try {
    if (icon.dataset.portfolio) {
      await decrypt(await fetchLock(icon.dataset.lock), pwInput.value);   // throws if wrong
      portfolioPassword.set(pwInput.value);
      closePassword();
      karolSays('you’re in. nice.');
      goToPortfolio(icon);
      return;
    }
    if (icon.dataset.db) {
      const res = await openFolderFn(icon.dataset.folder, pwInput.value);
      if (res.status === 429) { pwError.textContent = 'Too many tries. Wait a few minutes.'; karolSays('easy. wait a bit.'); return; }
      if (!res.ok) throw new Error('denied');
      unlocked.set(icon.dataset.folder, await res.json());
    } else {
      const lock = await fetchLock(icon.dataset.lock);
      unlocked.set(icon.dataset.folder, await decrypt(lock, pwInput.value));
    }
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
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') onEscape(); });
function onEscape() {
  if (!pw.hidden) { closePassword(); return; }
  if (!startMenu.hidden) { toggleStart(false); startButton.focus(); return; }
  const topWin = windows().filter((w) => !w.hidden).sort((a, b) => b.style.zIndex - a.style.zIndex)[0];
  if (topWin) closeWindow(topWin);
}

// ---- Karol, the assistant ----
const karol = document.getElementById('karol');
const dog = document.getElementById('karolDog');
const bubble = document.getElementById('karolSays');
const pats = ['woof.', 'more pats please.', 'I guard the locked folders.', 'no, I don’t know the passwords.', 'good boy, that’s me.'];

const karolSvg = new URL('../karol.svg?v=1', import.meta.url).href;
fetch(karolSvg)
  .then((r) => r.text())
  .then((svg) => { dog.innerHTML = svg; })
  .catch(() => { dog.innerHTML = `<img src="${karolSvg}" alt="" width="460" height="515">`; });

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

// ---- folders from /admin/ (Supabase) ----
// Icons come from the desktop_folders table (anyone may list them; RLS hides
// password hashes). Contents, open or locked, come from the open-folder edge
// function, which hands back short-lived signed links for the images.
const restHeaders = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };

function timeout(ms) {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

function openFolderFn(slug, password) {
  return fetch(`${FUNCTIONS_URL}/open-folder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(password == null ? { slug } : { slug, password }),
    signal: timeout(20000),
  });
}

async function loadDbFolders() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/desktop_folders?select=slug,name,locked,karol&order=sort.asc,created_at.asc`,
      { headers: restHeaders, signal: timeout(6000) },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const folders = await res.json();
    const before = document.querySelector('.icons > .icon--shortcut');   // keep the shortcuts last
    folders.forEach((f) => {
      if (document.querySelector(`.icon[data-folder="${CSS.escape(f.slug)}"]`)) return;
      const icon = document.createElement('button');
      icon.className = 'icon';
      icon.dataset.folder = f.slug;
      icon.dataset.title = f.name;
      icon.dataset.db = '1';
      if (f.locked) icon.dataset.locked = '1';
      icon.dataset.karol = f.karol || (f.locked ? 'this one’s locked. ask Ola for the password.' : `${f.name}. open it!`);
      icon.innerHTML = `<span class="icon__folder">${f.locked ? '<span class="icon__lock" aria-hidden="true"></span>' : ''}</span><span class="icon__label"></span>`;
      icon.querySelector('.icon__label').textContent = f.name;
      icon.addEventListener('click', () => openFolder(icon));
      const point = () => { walkTo(icon); karolSays(icon.dataset.karol); };
      icon.addEventListener('pointerenter', point);
      icon.addEventListener('focus', point);
      before.before(icon);
    });
  } catch (err) {
    console.warn('[desktop] folders from /admin/ unavailable:', err.message);
  }
}

async function openDbFolder(icon) {
  const name = icon.dataset.folder;
  const locked = !!icon.dataset.locked;
  if (locked && !unlocked.has(name)) { askPassword(icon); return; }
  const win = folderWindow(icon);
  showWindow(win);
  const box = win.querySelector('.dbfolder');
  if (!box.dataset.loaded) {
    let data = unlocked.get(name);
    if (!data) {
      box.innerHTML = '<p class="dbfolder__empty">Opening…</p>';
      try {
        const res = await openFolderFn(name);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = await res.json();
      } catch {
        box.innerHTML = '<p class="dbfolder__empty">This folder won’t open right now. Try again in a minute.</p>';
        return;
      }
    }
    renderDbFolder(box, data.items || []);
    box.dataset.loaded = '1';
    win.querySelector('.status-bar-field').textContent = `${(data.items || []).length} object(s)`;
  }
  karolSays(locked ? 'you’re in. nice.' : icon.dataset.karol);
}

function renderDbFolder(box, items) {
  box.replaceChildren();
  if (!items.length) {
    box.innerHTML = '<p class="dbfolder__empty">This folder is empty.</p>';
    return;
  }
  items.forEach((it) => {
    let el;
    if (it.type === 'image' && it.src) {
      el = document.createElement('figure');
      el.className = 'dbfolder__img';
      const a = document.createElement('a');
      a.href = it.src; a.target = '_blank'; a.rel = 'noopener';
      const img = document.createElement('img');
      img.src = it.src; img.alt = it.caption || ''; img.loading = 'lazy'; img.decoding = 'async';
      if (it.width && it.height) { img.width = it.width; img.height = it.height; }
      a.appendChild(img);
      el.appendChild(a);
      if (it.caption) { const c = document.createElement('figcaption'); c.textContent = it.caption; el.appendChild(c); }
    } else if (it.type === 'text') {
      el = document.createElement('p');
      el.className = 'dbfolder__text';
      el.textContent = it.content;
    } else if (it.type === 'link' && /^https?:\/\//i.test(it.url || '')) {
      el = document.createElement('p');
      el.className = 'dbfolder__link';
      const a = document.createElement('a');
      a.href = it.url; a.target = '_blank'; a.rel = 'noopener';
      a.textContent = it.caption || it.url;
      el.append('🔗 ', a);
    }
    if (el) box.appendChild(el);
  });
}

// ---- start: the linked folder or window, or the read me ----
windows().forEach((w) => { w.hidden = true; });
let want = decodeURIComponent(location.hash.slice(1));
// Links to the old home page's sections (#about, #contact…) now live in the
// portfolio: ask for its password, then land on that section.
if (['about', 'experience', 'work', 'tarocik', 'contact', 'top'].includes(want)) {
  portfolioSection = want;
  want = 'portfolio';
}
const findIcon = () => document.querySelector(`.icon[data-folder="${CSS.escape(want)}"]`);
const dbReady = loadDbFolders();
if (findIcon()) openFolder(findIcon());
else if (want && document.getElementById(want)?.matches('[data-window]')) showWindow(document.getElementById(want));
else if (want) {
  // Maybe a folder made in /admin/: wait for those (briefly) before giving up.
  dbReady.then(() => {
    if (findIcon()) openFolder(findIcon());
    else if (!phone.matches) showWindow(document.getElementById('welcome'));
  });
} else if (!phone.matches) showWindow(document.getElementById('welcome'));
