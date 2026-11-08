// ===== cotoaleksandra — the portfolio =====
// A Warsaw clock, project rows that open their folder, and a small preview
// image that follows the cursor over a row. Links like
// cotoaleksandra.com/#tarocik open that project's folder.

// ---- Warsaw time in the top bar ----
const clock = document.getElementById('clock');
const warsaw = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit' });
function tick() { clock.textContent = warsaw.format(new Date()); }
tick();
setInterval(tick, 15000);

// ---- project rows open their folder ----
const rows = [...document.querySelectorAll('.proj__row')];

function setOpen(row, open) {
  row.setAttribute('aria-expanded', open);
  document.getElementById(row.getAttribute('aria-controls')).hidden = !open;
}

rows.forEach((row) => {
  row.addEventListener('click', () => {
    const open = row.getAttribute('aria-expanded') !== 'true';
    setOpen(row, open);
    if (open) history.replaceState(null, '', `#${row.closest('.proj').id}`);
  });
});

const linked = document.getElementById(location.hash.slice(1));
if (linked?.classList.contains('proj')) setOpen(linked.querySelector('.proj__row'), true);

// ---- the preview that follows the cursor ----
const peek = document.getElementById('peek');
const fine = matchMedia('(hover: hover) and (pointer: fine)');

rows.forEach((row) => {
  const src = row.dataset.preview;
  if (!src) return;
  row.addEventListener('pointerenter', () => {
    if (!fine.matches || row.getAttribute('aria-expanded') === 'true') return;
    peek.src = src;
    peek.hidden = false;
  });
  row.addEventListener('pointermove', (e) => {
    peek.style.transform = `translate(${e.clientX + 24}px, ${e.clientY - 80}px)`;
  });
  row.addEventListener('pointerleave', () => { peek.hidden = true; });
  row.addEventListener('click', () => { peek.hidden = true; });
});
