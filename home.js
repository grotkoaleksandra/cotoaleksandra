// ===== cotoaleksandra — category switching =====
// One category on screen at a time. The URL hash is the source of truth, so
// links like cotoaleksandra.com/#portfolio open straight onto that category.

const CATEGORIES = ['hello', 'portfolio', 'about', 'contact'];

function show(name) {
  if (!CATEGORIES.includes(name)) name = 'hello';

  document.body.dataset.category = name;

  document.querySelectorAll('[data-panel]').forEach((panel) => {
    const on = panel.dataset.panel === name;
    panel.hidden = !on;
    panel.classList.toggle('enter', on);
  });

  document.querySelectorAll('[data-go]').forEach((link) => {
    const on = link.dataset.go === name;
    link.classList.toggle('is-on', on);
    if (on) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', () => show(location.hash.slice(1)));
show(location.hash.slice(1));
