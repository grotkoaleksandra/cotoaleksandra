// ===== cotoaleksandra — the desktop =====
// Icons open windows; windows drag, stack and close; Karol walks over to
// whatever you point at and says what it is. Links like
// cotoaleksandra.com/#tarocik open that window straight away.

document.documentElement.classList.add('js');

const desk = document.getElementById('desk');
const windows = [...document.querySelectorAll('[data-window]')];
const phone = matchMedia('(max-width: 760px)');
const calm = matchMedia('(prefers-reduced-motion: reduce)');

// ---- the clock in the menu bar ----
const clock = document.getElementById('clock');
function tick() {
  const now = new Date();
  clock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  clock.dateTime = now.toISOString();
}
tick();
setInterval(tick, 15000);

// ---- windows ----
let zTop = 10;
let opened = 0;

function bringToFront(win) {
  win.style.zIndex = ++zTop;
}

function place(win) {
  if (win.dataset.placed || phone.matches) return;
  // Cascade new windows from the top left, so they never land exactly on top of each other.
  const w = win.offsetWidth;
  const maxLeft = Math.max(16, desk.clientWidth - w - 150);   // leave the icon column free
  const left = Math.min(40 + (opened % 6) * 34, maxLeft);
  const topPx = Math.min(24 + (opened % 6) * 30, Math.max(16, desk.clientHeight - 200));
  win.style.left = `${left}px`;
  win.style.top = `${topPx}px`;
  win.dataset.placed = '1';
  opened++;
}

function openWindow(id, { fromIcon } = {}) {
  const win = document.getElementById(id);
  if (!win) return;
  const wasHidden = win.hidden;
  win.hidden = false;
  place(win);
  bringToFront(win);
  if (wasHidden && !calm.matches) {
    win.classList.remove('is-opening');
    void win.offsetWidth;
    win.classList.add('is-opening');
  }
  history.replaceState(null, '', `#${id}`);
  document.querySelectorAll('.icon').forEach((i) => i.classList.toggle('is-active', i.dataset.open === id));
  win.querySelector('[data-close]').focus({ preventScroll: true });
  if (fromIcon) karolSays(lines.opened[id] || fromIcon.dataset.karol);
}

function closeWindow(win) {
  win.hidden = true;
  const next = windows.filter((w) => !w.hidden).sort((a, b) => b.style.zIndex - a.style.zIndex)[0];
  history.replaceState(null, '', next ? `#${next.id}` : location.pathname + location.search);
  document.querySelectorAll('.icon').forEach((i) => i.classList.toggle('is-active', next && i.dataset.open === next.id));
  if (next) next.querySelector('[data-close]').focus({ preventScroll: true });
}

document.querySelectorAll('[data-open]').forEach((el) => {
  el.addEventListener('click', () => openWindow(el.dataset.open, { fromIcon: el.classList.contains('icon') ? el : null }));
});

windows.forEach((win) => {
  win.querySelector('[data-close]').addEventListener('click', () => closeWindow(win));
  win.addEventListener('pointerdown', () => bringToFront(win));

  // Drag by the title bar (not on phones, where windows are full screen).
  const bar = win.querySelector('.window__bar');
  bar.addEventListener('pointerdown', (e) => {
    if (phone.matches || e.target.closest('[data-close]')) return;
    const startX = e.clientX - win.offsetLeft;
    const startY = e.clientY - win.offsetTop;
    win.classList.add('is-dragging');
    bar.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const maxX = desk.clientWidth - 60;
      const maxY = desk.clientHeight - 30;
      win.style.left = `${Math.min(Math.max(ev.clientX - startX, -win.offsetWidth + 80), maxX)}px`;
      win.style.top = `${Math.min(Math.max(ev.clientY - startY, 0), maxY)}px`;
    };
    const up = () => {
      win.classList.remove('is-dragging');
      bar.removeEventListener('pointermove', move);
      bar.removeEventListener('pointerup', up);
    };
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', up);
  });
});

// Escape closes the window on top.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const topWin = windows.filter((w) => !w.hidden).sort((a, b) => b.style.zIndex - a.style.zIndex)[0];
  if (topWin) closeWindow(topWin);
});

// ---- Karol, the guide ----
const karol = document.getElementById('karol');
const dog = document.getElementById('karolDog');
const bubble = document.getElementById('karolSays');

const lines = {
  opened: {
    welcome: 'that’s Ola. the folders on the right are her work.',
    about: 'oh, that’s me in there.',
    contact: 'she reads everything. eventually.',
  },
  pat: ['woof.', 'more pats please.', 'I’m a good boy.', 'have you opened Tarocik yet?', 'the handmade folder is my favourite.'],
};

// Draw Karol inline so his tail can be paused when he falls asleep.
fetch('karol.svg?v=1')
  .then((r) => r.text())
  .then((svg) => { dog.innerHTML = svg; })
  .catch(() => { dog.innerHTML = '<img src="karol.svg?v=1" alt="" width="460" height="515">'; });

let quiet;
function karolSays(text) {
  bubble.textContent = text;
  wake();
}

function walkTo(icon) {
  if (phone.matches) return;
  const d = desk.getBoundingClientRect();
  const r = icon.getBoundingClientRect();
  const k = karol.offsetWidth;
  karol.style.bottom = 'auto';
  // Stand just left of the icon area (never on top of other icons), level with this one.
  const area = document.querySelector('.icons').getBoundingClientRect();
  karol.style.left = `${Math.max(8, area.left - d.left - k - 6)}px`;
  karol.style.top = `${Math.max(70, r.bottom - d.top - k * 1.05)}px`;
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

let pats = 0;
dog.addEventListener('click', () => {
  karolSays(lines.pat[pats++ % lines.pat.length]);
  karol.classList.remove('is-happy');
  void karol.offsetWidth;
  karol.classList.add('is-happy');
});

// Left alone for a while, he falls asleep; anything wakes him.
function wake() {
  if (karol.classList.contains('is-asleep')) {
    karol.classList.remove('is-asleep');
    if (bubble.textContent === 'z z z') bubble.textContent = '';
  }
  clearTimeout(quiet);
  quiet = setTimeout(() => {
    karol.classList.add('is-asleep');
    bubble.textContent = 'z z z';
  }, 30000);
}
['pointermove', 'keydown', 'pointerdown'].forEach((t) => addEventListener(t, wake, { passive: true }));
wake();

// ---- start: the linked window, or the read me ----
const linked = windows.find((w) => w.id === location.hash.slice(1));
windows.forEach((w) => { w.hidden = true; });
if (!phone.matches || linked) openWindow(linked ? linked.id : 'welcome');
