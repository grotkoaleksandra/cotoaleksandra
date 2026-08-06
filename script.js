// ===== cotoaleksandra — warm editorial motion =====

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- split hero lines into chars for the staggered rise ----
let charDelay = 0;
document.querySelectorAll('[data-split]').forEach((el) => {
  const text = el.textContent;
  el.textContent = '';
  [...text].forEach((ch) => {
    const span = document.createElement('span');
    span.className = 'char';
    span.textContent = ch === ' ' ? ' ' : ch;
    span.style.transitionDelay = `${charDelay}ms`;
    charDelay += 26;
    el.appendChild(span);
  });
});

// contact "say cześć" gets per-char spans too (for the hover ripple)
const contactBig = document.getElementById('contactBig');
if (contactBig) {
  const frag = document.createDocumentFragment();
  contactBig.childNodes.forEach(() => {});
  const nodes = [...contactBig.childNodes];
  contactBig.textContent = '';
  nodes.forEach((node) => {
    const isEm = node.nodeName === 'EM';
    const text = node.textContent;
    [...text].forEach((ch, i) => {
      const span = document.createElement('span');
      span.className = 'char in';
      span.textContent = ch === ' ' ? ' ' : ch;
      span.style.transitionDelay = `${i * 22}ms`;
      if (isEm) {
        const em = document.createElement('em');
        em.appendChild(span);
        frag.appendChild(em);
      } else {
        frag.appendChild(span);
      }
    });
  });
  contactBig.appendChild(frag);
}

// kick the hero chars in once fonts settle
(document.fonts?.ready || Promise.resolve()).then(() => {
  requestAnimationFrame(() => {
    document.querySelectorAll('.hero .char').forEach((c) => c.classList.add('in'));
  });
});

// ---- rotating word ----
const ROTATOR_WORDS = ['apps', 'websites', 'tiny tools', 'odd ideas', 'weekend plans'];
const rotatorWord = document.getElementById('rotatorWord');
let rotatorIndex = 0;
if (!reducedMotion) {
  setInterval(() => {
    if (document.hidden) return; // don't cycle (or strand a hidden word) in background tabs
    rotatorWord.classList.add('out');
    setTimeout(() => {
      rotatorIndex = (rotatorIndex + 1) % ROTATOR_WORDS.length;
      rotatorWord.textContent = ROTATOR_WORDS[rotatorIndex];
      rotatorWord.classList.remove('out');
      rotatorWord.classList.add('pre');
      setTimeout(() => rotatorWord.classList.remove('pre'), 30);
    }, 360);
  }, 2400);
}

// ---- split prose into words for the read-along reveal ----
document.querySelectorAll('[data-words]').forEach((el) => {
  const words = el.textContent.trim().split(/\s+/);
  el.textContent = '';
  words.forEach((w, i) => {
    const span = document.createElement('span');
    span.className = 'word';
    span.textContent = w;
    span.style.transitionDelay = `${i * 36}ms`;
    el.appendChild(span);
    el.appendChild(document.createTextNode(' '));
  });
});

// ---- scroll reveals ----
document.documentElement.classList.add('reveal-ready');

// stagger reveal-up elements within each section
document.querySelectorAll('section, footer').forEach((scope) => {
  scope.querySelectorAll('.reveal-up').forEach((el, i) => {
    el.style.setProperty('--d', `${Math.min(i * 90, 450)}ms`);
  });
});

const io = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    if (el.classList.contains('reveal-up')) el.classList.add('in');
    if (el.hasAttribute('data-words')) el.querySelectorAll('.word').forEach((w) => w.classList.add('in'));
    if (el.classList.contains('meter')) {
      el.style.setProperty('--level', `${el.dataset.level}%`);
      el.classList.add('filled');
    }
    io.unobserve(el);
  });
}, { threshold: 0.18 });

document.querySelectorAll('.reveal-up, [data-words], .meter').forEach((el) => io.observe(el));
