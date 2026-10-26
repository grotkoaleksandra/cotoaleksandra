// ===== cotoaleksandra — one long page, four categories =====
// The categories sit one under another. Scrolling moves between them; the side
// list highlights the one in view and the background takes its colour. Links
// like cotoaleksandra.com/#showcase still open straight onto that category.

document.documentElement.classList.add('js');

// We place the page ourselves (top, or the linked category); don't let the
// browser restore an old scroll position over it.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

const panels = [...document.querySelectorAll('[data-panel]')];
const links = [...document.querySelectorAll('[data-go]')];

let shown = null;

function setCurrent(name) {
  if (shown === name) return;
  shown = name;
  document.body.dataset.category = name;

  links.forEach((link) => {
    const on = link.dataset.go === name;
    link.classList.toggle('is-on', on);
    if (on) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  });

  // Keep the address in step without adding a history entry per scroll.
  const hash = name === 'hello' ? location.pathname + location.search : `#${name}`;
  history.replaceState(null, '', hash);
}

// The category crossing the middle of the screen is the current one.
const current = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) setCurrent(entry.target.dataset.panel);
  });
}, { rootMargin: '-50% 0px -50% 0px' });

// Each category's cards rise in the first time it comes into view.
const reveal = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('enter');
    reveal.unobserve(entry.target);
  });
}, { threshold: 0.15 });

// A link straight to a category (cotoaleksandra.com/#about) lands on it first;
// only then start following the scroll, so the address isn't reset on load.
const start = panels.find((p) => p.id === location.hash.slice(1));
if (start) start.scrollIntoView({ behavior: 'instant' });
setCurrent(start ? start.id : 'hello');

requestAnimationFrame(() => panels.forEach((panel) => {
  current.observe(panel);
  reveal.observe(panel);
}));

// ---- showcase folders: one tab per project ----
// Without this script every folder simply shows, one under another.
document.querySelectorAll('.folders').forEach((folders) => {
  const tabs = [...folders.querySelectorAll('[role="tab"]')];

  function open(tab, focus) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus({ preventScroll: true });
    // Slide the row of tabs (not the page) so the open one is in view.
    const row = tab.parentElement;
    if (tab.offsetLeft < row.scrollLeft || tab.offsetLeft + tab.offsetWidth > row.scrollLeft + row.clientWidth) {
      row.scrollTo({ left: tab.offsetLeft - 18, behavior: 'smooth' });
    }
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => open(tab));
    tab.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (step) open(tabs[(i + step + tabs.length) % tabs.length], true);
    });
  });

  open(tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0]);
});
