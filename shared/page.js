// Wires the public page to Supabase — but only when it's connected.
// Nothing here changes the page until real keys are in shared/supabase.js.
import { CONFIGURED, CONTACT_READY } from './supabase.js';
import { loadProjects } from './projects-service.js';
import { submitContactForm } from './contact-service.js';

if (CONFIGURED) swapInTheWork();
if (CONTACT_READY) openTheLetterbox();

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---- the work list ----
async function swapInTheWork() {
  const list = document.querySelector('.works');
  if (!list) return;

  const projects = await loadProjects();
  if (!projects) return; // nothing published yet — leave the placeholders alone

  list.innerHTML = projects.map((p, i) => `
    <a class="work reveal-up in" href="${esc(p.url || '#')}"${p.url ? ' target="_blank" rel="noopener"' : ''}>
      <span class="work__no label">no. ${i + 1}</span>
      <span class="work__name">${esc(p.name)}${p.name_em ? ` <em>${esc(p.name_em)}</em>` : ''}</span>
      <span class="work__meta label">${esc(p.meta || '')}</span>
      <span class="work__arrow" aria-hidden="true">→</span>
    </a>
  `).join('');

  // The section note promises the work is "being framed" — retire it once
  // there is actual work on the page.
  document.querySelector('#work .section__note')?.remove();
}

// ---- the letter form ----
function openTheLetterbox() {
  const form = document.getElementById('contactForm');
  const note = document.getElementById('contactNote');
  if (!form) return;

  form.hidden = false;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const send = form.querySelector('button[type="submit"]');
    const payload = Object.fromEntries(new FormData(form).entries());

    if (!payload.name || !payload.email || !payload.subject || !payload.message) {
      note.className = 'letter__note bad';
      note.textContent = 'All four, please.';
      return;
    }

    send.disabled = true;
    note.className = 'letter__note';
    note.textContent = 'sending…';

    const result = await submitContactForm(payload);
    send.disabled = false;

    if (result.ok) {
      form.reset();
      note.className = 'letter__note ok';
      note.textContent = 'Landed. She’ll write back.';
    } else {
      note.className = 'letter__note bad';
      note.textContent = result.error;
    }
  });
}
