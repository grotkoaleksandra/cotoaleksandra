// ===== cotoaleksandra_ — glitch/terminal edition =====

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const GLYPHS = '!<>-_\\/[]{}—=+*^?#@$%&AΛΞΩΨ0123456789';

// ---- text scramble ----
function scramble(el, finalText, duration = 600) {
  if (reducedMotion) { el.textContent = finalText; return; }
  const start = performance.now();
  function frame(now) {
    const progress = Math.min((now - start) / duration, 1);
    const settled = Math.floor(finalText.length * progress);
    let out = finalText.slice(0, settled);
    for (let i = settled; i < finalText.length; i++) {
      out += finalText[i] === ' ' ? ' ' : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    }
    el.textContent = out;
    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// ---- boot sequence ----
const boot = document.getElementById('boot');
const bootLog = document.getElementById('bootLog');
const BOOT_LINES = [
  '✳ dear reader, one moment —',
  '✳ dusting the pixels .............. done',
  '✳ warming up the whimsy ........... done',
  '✳ brewing jedna kawa .............. ☕',
  '✳ curtain up_',
];

function endBoot() {
  if (!boot.classList.contains('is-done')) {
    boot.classList.add('is-done');
    initHero();
  }
}

function runBoot() {
  if (reducedMotion || sessionStorage.getItem('booted')) { endBoot(); return; }
  sessionStorage.setItem('booted', '1');
  let li = 0;
  function nextLine() {
    if (boot.classList.contains('is-done')) return;
    if (li >= BOOT_LINES.length) { setTimeout(endBoot, 350); return; }
    const line = BOOT_LINES[li++];
    let ci = 0;
    const typed = setInterval(() => {
      if (boot.classList.contains('is-done')) { clearInterval(typed); return; }
      bootLog.textContent += line[ci++];
      if (ci >= line.length) {
        clearInterval(typed);
        bootLog.textContent += '\n';
        setTimeout(nextLine, 90);
      }
    }, 8);
  }
  nextLine();
}
// ---- hero ----
const heroTitle = document.getElementById('heroTitle');
const heroSub = document.getElementById('heroSub');
const SUB_TEXT = 'apps, websites & other small inventions — dreamt up on a tram, shipped by the weekend';

let heroInit = false;
function initHero() {
  if (heroInit) return;
  heroInit = true;
  scramble(heroTitle, 'ALEKSANDRA', 900);
  if (reducedMotion) { heroSub.textContent = SUB_TEXT; return; }
  const typeStart = performance.now();
  const typeDuration = 1400;
  const typer = setInterval(() => {
    const progress = Math.min((performance.now() - typeStart) / typeDuration, 1);
    heroSub.textContent = SUB_TEXT.slice(0, Math.ceil(SUB_TEXT.length * progress));
    if (progress >= 1) clearInterval(typer);
  }, 24);
}
if (reducedMotion) initHero();

// kick off the boot only after the hero bindings exist
boot.addEventListener('click', endBoot);
document.addEventListener('keydown', endBoot, { once: true });
setTimeout(endBoot, 2600); // failsafe: never hold the page hostage
runBoot();

heroTitle.addEventListener('mouseenter', () => scramble(heroTitle, 'ALEKSANDRA', 500));

// ---- scramble on hover (nav links, buttons, project names) ----
document.querySelectorAll('[data-scramble]').forEach((el) => {
  const original = el.textContent;
  el.addEventListener('mouseenter', () => scramble(el, original, 350));
});
document.querySelectorAll('[data-scramble-hover]').forEach((el) => {
  const original = el.textContent;
  el.closest('a').addEventListener('mouseenter', () => scramble(el, original, 400));
});

// ---- intermittent glitches ----
const glitchables = document.querySelectorAll('.glitch');
if (!reducedMotion) {
  setInterval(() => {
    const el = glitchables[Math.floor(Math.random() * glitchables.length)];
    el.classList.add('is-glitching');
    setTimeout(() => el.classList.remove('is-glitching'), 300);
  }, 3200);

  // occasional marquee speed burst
  const track = document.getElementById('marqueeTrack');
  setInterval(() => {
    track.classList.add('is-glitching');
    setTimeout(() => track.classList.remove('is-glitching'), 900);
  }, 11000);
}

// ---- skill bars ----
document.querySelectorAll('.skills__bar').forEach((bar) => {
  const level = parseInt(bar.dataset.level, 10);
  bar.textContent = '▓'.repeat(level) + '░'.repeat(10 - level);
});

// ---- scroll reveal ----
document.documentElement.classList.add('reveal-ready');
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

// ---- sealed rows shouldn't navigate ----
document.querySelectorAll('[data-sealed]').forEach((row) => {
  row.addEventListener('click', (e) => e.preventDefault());
});
