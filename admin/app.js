// The back room: read the letters, keep the work list current.
// RLS decides what comes back — this page only keeps the UI tidy.
import { supabase, CONFIGURED } from '../shared/supabase.js';
import { requireSession, signOut } from '../shared/auth.js';
import { path } from '../shared/paths.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const when = (iso) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

if (!CONFIGURED) {
  document.getElementById('letters').innerHTML =
    '<p class="studio__empty">Supabase isn’t connected yet.</p>';
  throw new Error('Supabase not configured');
}

const user = await requireSession(path('login/'));
if (!user) throw new Error('redirecting');
document.getElementById('who').textContent = user.email;

document.getElementById('signout').addEventListener('click', async () => {
  await signOut();
  location.replace(path());
});

// ---------- tabs ----------
const TABS = { 'tab-letters': 'panel-letters', 'tab-work': 'panel-work' };
Object.keys(TABS).forEach((id) => {
  document.getElementById(id).addEventListener('click', () => {
    Object.entries(TABS).forEach(([tab, panel]) => {
      const active = tab === id;
      document.getElementById(tab).setAttribute('aria-selected', String(active));
      document.getElementById(panel).hidden = !active;
    });
  });
});

// ---------- letters ----------
async function renderLetters() {
  const box = document.getElementById('letters');
  const { data, error } = await supabase
    .from('contact_submissions')
    .select('id, name, email, subject, message, created_at, handled')
    .order('created_at', { ascending: false });

  if (error) {
    box.innerHTML = `<p class="studio__empty">Couldn’t open the letterbox: ${esc(error.message)}</p>`;
    return;
  }
  if (!data.length) {
    box.innerHTML = '<p class="studio__empty">No letters yet. The form is listening.</p>';
    return;
  }

  box.innerHTML = data.map((row) => `
    <article class="note-card">
      <div class="note-card__head">
        <span class="note-card__subject">${esc(row.subject)}</span>
        ${row.handled ? '' : '<span class="fresh">new</span>'}
        <span class="note-card__when label">${esc(when(row.created_at))}</span>
      </div>
      <p class="note-card__from label">${esc(row.name)} —
        <a href="mailto:${esc(row.email)}?subject=${encodeURIComponent('Re: ' + row.subject)}">${esc(row.email)}</a>
      </p>
      <p class="note-card__body">${esc(row.message)}</p>
      <p class="note-card__actions">
        <button class="mini label" data-id="${esc(row.id)}" data-next="${row.handled ? 'false' : 'true'}">
          ${row.handled ? 'mark unread' : 'mark handled'}
        </button>
      </p>
    </article>
  `).join('');

  box.querySelectorAll('button[data-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const { error: updateError } = await supabase
        .from('contact_submissions')
        .update({ handled: btn.dataset.next === 'true' })
        .eq('id', btn.dataset.id);
      if (updateError) { btn.disabled = false; alert(updateError.message); return; }
      renderLetters();
    });
  });
}

// ---------- the work ----------
const form = document.getElementById('workForm');
const workNote = document.getElementById('workNote');

async function renderWork() {
  const list = document.getElementById('workList');
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, name_em, meta, url, sort_order, published')
    .order('sort_order', { ascending: true });

  if (error) { list.innerHTML = `<p class="studio__empty">${esc(error.message)}</p>`; return; }
  if (!data.length) {
    list.innerHTML = '<p class="studio__empty">Nothing here yet — the site is showing the placeholder rows.</p>';
    return;
  }

  list.innerHTML = data.map((p) => `
    <article class="note-card">
      <div class="note-card__head">
        <span class="note-card__subject">${esc(p.name)} ${p.name_em ? `<em>${esc(p.name_em)}</em>` : ''}</span>
        ${p.published ? '' : '<span class="fresh">draft</span>'}
        <span class="note-card__when label">no. ${p.sort_order}</span>
      </div>
      <p class="note-card__from label">${esc(p.meta || '')}${p.url ? ` · ${esc(p.url)}` : ''}</p>
      <p class="note-card__actions">
        <button class="mini label" data-edit='${esc(JSON.stringify(p))}'>edit</button>
        <button class="mini label" data-remove="${esc(p.id)}">remove</button>
      </p>
    </article>
  `).join('');

  list.querySelectorAll('button[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = JSON.parse(btn.dataset.edit);
      Object.entries(p).forEach(([key, value]) => {
        const field = form.elements[key];
        if (!field) return;
        if (field.type === 'checkbox') field.checked = Boolean(value);
        else field.value = value ?? '';
      });
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  list.querySelectorAll('button[data-remove]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this piece?')) return;
      btn.disabled = true;
      const { error: deleteError } = await supabase
        .from('projects').delete().eq('id', btn.dataset.remove);
      if (deleteError) { btn.disabled = false; alert(deleteError.message); return; }
      renderWork();
    });
  });
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const row = {
    name: fd.get('name').trim(),
    name_em: fd.get('name_em')?.trim() || null,
    meta: fd.get('meta')?.trim() || null,
    url: fd.get('url')?.trim() || null,
    sort_order: Number(fd.get('sort_order') || 10),
    published: fd.get('published') === 'on',
  };
  const id = fd.get('id');
  if (id) row.id = id;

  workNote.className = 'letter__note';
  workNote.textContent = 'saving…';

  const { error } = await supabase.from('projects').upsert(row);
  if (error) {
    workNote.className = 'letter__note bad';
    workNote.textContent = error.message;
    return;
  }
  workNote.className = 'letter__note ok';
  workNote.textContent = 'saved.';
  form.reset();
  form.elements.id.value = '';
  renderWork();
});

await renderLetters();
await renderWork();
