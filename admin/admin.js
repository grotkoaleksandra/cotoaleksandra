// admin — manage the folders on /desktop.
//
// Sign-in is an emailed link or code (Supabase Auth, sign-ups off), and only
// the address in `site_admins` can change anything: Row-Level Security
// enforces that in the database, this page only keeps the UI tidy.
// Passwords for locked folders are hashed by the folder-password edge
// function; this page never stores or reads them back.
import { supabase, CONFIGURED } from '../shared/supabase.js';
import { FUNCTIONS_URL } from '../shared/config.js';

const $ = (id) => document.getElementById(id);
const BUCKET = 'desktop';
const MAX_SIDE = 2000;
const RESERVED = ['karol', 'demo', 'sari', 'welcome', 'pw', 'desk'];

// ---- small helpers ----
function say(el, text, kind = '') { el.textContent = text; el.className = `msg ${kind}`; }
function status(text) { $('status').textContent = text; }
const slugify = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'l')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
function slugProblem(slug) {
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(slug)) return 'The link may use a–z, 0–9 and dashes only.';
  if (RESERVED.includes(slug)) return `“${slug}” is taken by a built-in folder.`;
  return '';
}
function friendly(err) {
  const m = err?.message || String(err);
  if (/duplicate key|desktop_folders_slug_key/.test(m)) return 'Another folder already uses that link.';
  if (/row-level security|permission denied/i.test(m)) return 'Not allowed: is this the admin account?';
  return m;
}

// ---- clock ----
const clock = $('clock');
const tick = () => { clock.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
tick(); setInterval(tick, 15000);

if (!CONFIGURED) {
  $('login').hidden = false;
  say($('loginMsg'), 'Supabase isn’t connected.', 'bad');
  throw new Error('Supabase not configured');
}

// ================= sign-in =================
const emailForm = $('emailForm');
const codeForm = $('codeForm');
const loginMsg = $('loginMsg');

function showLogin() {
  $('main').hidden = true;
  $('login').hidden = false;
  emailForm.hidden = false;
  codeForm.hidden = true;
}

emailForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('email').value.trim().toLowerCase();
  $('sendBtn').disabled = true;
  say(loginMsg, 'Sending…');
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: location.origin + location.pathname },
  });
  $('sendBtn').disabled = false;
  if (error) {
    // Unknown addresses get the same answer as known ones would be too
    // revealing; Supabase says "Signups not allowed" for those.
    say(loginMsg, /signup|not allowed|not found/i.test(error.message)
      ? 'That address can’t log in here.' : error.message, 'bad');
    return;
  }
  emailForm.hidden = true;
  codeForm.hidden = false;
  say(loginMsg, `Sent to ${email}.`, 'ok');
  $('code').focus();
});

codeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  say(loginMsg, 'Checking…');
  const { error } = await supabase.auth.verifyOtp({
    email: $('email').value.trim().toLowerCase(),
    token: $('code').value.trim(),
    type: 'email',
  });
  if (error) { say(loginMsg, 'That code didn’t work. Try again, or send a new one.', 'bad'); return; }
  say(loginMsg, '');
});
$('backBtn').addEventListener('click', () => { emailForm.hidden = false; codeForm.hidden = true; say(loginMsg, ''); });

$('logoutBtn').addEventListener('click', async () => { await supabase.auth.signOut(); showLogin(); });

let started = false;
let checking = false;
async function onSession(session) {
  if (!session) { started = false; showLogin(); return; }
  if (started || checking) return;
  checking = true;
  const { data: isAdmin } = await supabase.rpc('is_site_admin');
  checking = false;
  if (isAdmin !== true) {
    showLogin();
    say(loginMsg, `${session.user.email} isn’t an admin here.`, 'bad');
    await supabase.auth.signOut();
    return;
  }
  started = true;
  $('login').hidden = true;
  $('main').hidden = false;
  $('who').textContent = session.user.email;
  // Clean the ?code=… from a magic link out of the address bar.
  if (location.search) history.replaceState(null, '', location.pathname + location.hash);
  route();
}
// Fires once with the stored session (or a magic-link one) and on every change.
// Deferred, because calling Supabase from inside this callback can deadlock.
supabase.auth.onAuthStateChange((_event, session) => { setTimeout(() => onSession(session), 0); });

// ================= routing: list ↔ one folder =================
// #f=<id> opens a folder, so reloading keeps your place.
addEventListener('hashchange', () => { if (started) route(); });
function route() {
  const id = new URLSearchParams(location.hash.slice(1)).get('f');
  if (id) openFolder(id); else showList();
}
$('upBtn').addEventListener('click', () => { location.hash = ''; });

// ================= the folder list =================
let folders = [];

async function loadFolders() {
  const { data: rows, error } = await supabase
    .from('desktop_folders')
    .select('id, slug, name, locked, karol, sort, created_at, folder_items(count)')
    .order('sort', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  folders = rows.map((r) => ({ ...r, count: r.folder_items?.[0]?.count ?? 0 }));
  return folders;
}

async function showList() {
  current = null;
  $('mainTitle').textContent = 'Desktop folders';
  $('upBtn').hidden = true;
  $('newBtn').hidden = false;
  $('viewLink').href = '../desktop/';
  $('listView').hidden = false;
  $('folderView').hidden = true;
  status('Loading…');
  try { await loadFolders(); } catch (err) { status(friendly(err)); return; }
  renderList();
  status(`${folders.length} folder(s)`);
}

function renderList() {
  const ul = $('folderList');
  ul.replaceChildren();
  if (!folders.length) {
    ul.innerHTML = '<li class="empty">No folders yet. Make one with “New folder…”.</li>';
    return;
  }
  folders.forEach((f, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="f-name"><span class="ficon"></span><span><b></b><br><span class="f-meta"></span></span></span>
      <span class="f-actions">
        <button data-act="up" aria-label="Move up" title="Move up">▲</button>
        <button data-act="down" aria-label="Move down" title="Move down">▼</button>
        <button data-act="open">Open</button>
        <button data-act="delete">Delete</button>
      </span>`;
    li.querySelector('.ficon').classList.toggle('is-locked', f.locked);
    li.querySelector('b').textContent = f.name;
    li.querySelector('.f-meta').textContent = `#${f.slug} · ${f.locked ? 'locked' : 'open'} · ${f.count} item(s)`;
    li.querySelector('[data-act="up"]').disabled = i === 0;
    li.querySelector('[data-act="down"]').disabled = i === folders.length - 1;
    li.querySelector('.f-name').addEventListener('dblclick', () => { location.hash = `f=${f.id}`; });
    li.querySelector('[data-act="open"]').addEventListener('click', () => { location.hash = `f=${f.id}`; });
    li.querySelector('[data-act="up"]').addEventListener('click', () => moveFolder(i, -1));
    li.querySelector('[data-act="down"]').addEventListener('click', () => moveFolder(i, 1));
    li.querySelector('[data-act="delete"]').addEventListener('click', () => deleteFolder(f));
    ul.appendChild(li);
  });
}

// Reorder by renumbering sort in steps of 10, writing only rows that changed.
async function renumber(table, rows) {
  const changed = rows.map((r, i) => ({ r, sort: (i + 1) * 10 })).filter(({ r, sort }) => r.sort !== sort);
  for (const { r, sort } of changed) {
    const { error } = await supabase.from(table).update({ sort }).eq('id', r.id);
    if (error) throw error;
    r.sort = sort;
  }
}

async function moveFolder(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= folders.length) return;
  [folders[i], folders[j]] = [folders[j], folders[i]];
  renderList();
  status('Saving order…');
  try { await renumber('desktop_folders', folders); status('Order saved'); } catch (err) { status(friendly(err)); showList(); }
}

async function removeImages(folderId) {
  const { data: files } = await supabase.storage.from(BUCKET).list(folderId, { limit: 1000 });
  if (files?.length) await supabase.storage.from(BUCKET).remove(files.map((o) => `${folderId}/${o.name}`));
}

async function deleteFolder(f) {
  if (!confirm(`Delete “${f.name}” and everything in it? This can’t be undone.`)) return;
  status('Deleting…');
  try {
    await removeImages(f.id);
    const { error } = await supabase.from('desktop_folders').delete().eq('id', f.id);
    if (error) throw error;
    status(`Deleted “${f.name}”`);
  } catch (err) { status(friendly(err)); }
  if (current?.id === f.id) location.hash = ''; else showList();
}

// ================= new folder =================
const newDialog = $('newDialog');
const nName = $('nName');
const nSlug = $('nSlug');
let slugTouched = false;

$('newBtn').addEventListener('click', () => {
  $('newForm').reset();
  slugTouched = false;
  $('nPassRow').hidden = true;
  say($('newMsg'), '');
  newDialog.hidden = false;
  nName.focus();
});
newDialog.querySelectorAll('[data-cancel]').forEach((b) => b.addEventListener('click', () => { newDialog.hidden = true; }));
nName.addEventListener('input', () => { if (!slugTouched) nSlug.value = slugify(nName.value); });
nSlug.addEventListener('input', () => { slugTouched = true; });
document.querySelectorAll('input[name="nKind"]').forEach((r) => r.addEventListener('change', () => {
  const locked = $('nLocked').checked;
  $('nPassRow').hidden = !locked;
  $('nPass').required = locked;
}));
addEventListener('keydown', (e) => { if (e.key === 'Escape') newDialog.hidden = true; });

$('newForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('newMsg');
  const slug = nSlug.value.trim();
  const problem = slugProblem(slug);
  if (problem) { say(msg, problem, 'bad'); return; }
  const locked = $('nLocked').checked;
  const password = $('nPass').value;
  if (locked && password.length < 4) { say(msg, 'Passwords need at least 4 characters.', 'bad'); return; }
  say(msg, 'Creating…');
  const sort = (folders.reduce((m, f) => Math.max(m, f.sort), 0) || 0) + 10;
  const { data, error } = await supabase.from('desktop_folders')
    .insert({ name: nName.value.trim(), slug, karol: $('nKarol').value.trim() || null, sort })
    .select('id').single();
  if (error) { say(msg, friendly(error), 'bad'); return; }
  if (locked) {
    const res = await setPassword(data.id, password);
    if (!res.ok) { say(msg, `Folder made, but the password didn’t save: ${res.error}`, 'bad'); return; }
  }
  newDialog.hidden = true;
  location.hash = `f=${data.id}`;
});

async function setPassword(folderId, password) {
  const { data: { session } } = await supabase.auth.getSession();
  try {
    const res = await fetch(`${FUNCTIONS_URL}/folder-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ folder_id: folderId, password }),
    });
    const body = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, locked: body.locked } : { ok: false, error: body.error || `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ================= one folder =================
let current = null;
let items = [];

async function openFolder(id) {
  $('listView').hidden = true;
  $('folderView').hidden = false;
  $('upBtn').hidden = false;
  $('newBtn').hidden = true;
  status('Loading…');
  const { data, error } = await supabase.from('desktop_folders')
    .select('id, slug, name, locked, karol, sort').eq('id', id).maybeSingle();
  if (error || !data) { status(error ? friendly(error) : 'That folder is gone.'); location.hash = ''; return; }
  current = data;
  $('mainTitle').textContent = `${data.name}`;
  $('viewLink').href = `../desktop/#${data.slug}`;
  $('fName').value = data.name;
  $('fSlug').value = data.slug;
  $('fKarol').value = data.karol || '';
  say($('settingsMsg'), ''); say($('lockMsg'), ''); say($('uploadMsg'), '');
  renderLock();
  await loadItems();
}

function renderLock() {
  $('lockState').textContent = current.locked
    ? '🔒 Locked. Visitors need the password. (It’s stored only as a hash, so it can’t be shown here; set a new one to change it.)'
    : '📂 Open. Anyone with the link can look inside.';
  $('lockBtn').textContent = current.locked ? 'Change password' : 'Lock with this password';
  $('unlockBtn').hidden = !current.locked;
  $('fPass').value = '';
}

$('settingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('settingsMsg');
  const slug = $('fSlug').value.trim();
  const problem = slugProblem(slug);
  if (problem) { say(msg, problem, 'bad'); return; }
  say(msg, 'Saving…');
  const patch = { name: $('fName').value.trim(), slug, karol: $('fKarol').value.trim() || null };
  const { error } = await supabase.from('desktop_folders').update(patch).eq('id', current.id);
  if (error) { say(msg, friendly(error), 'bad'); return; }
  Object.assign(current, patch);
  $('mainTitle').textContent = current.name;
  $('viewLink').href = `../desktop/#${current.slug}`;
  say(msg, 'Saved.', 'ok');
});

$('lockForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('lockMsg');
  say(msg, 'Saving…');
  const res = await setPassword(current.id, $('fPass').value);
  if (!res.ok) { say(msg, res.error, 'bad'); return; }
  current.locked = true;
  renderLock();
  say(msg, 'Password set.', 'ok');
});

$('unlockBtn').addEventListener('click', async () => {
  if (!confirm(`Remove the password? Anyone with the link will see what’s in “${current.name}”.`)) return;
  const msg = $('lockMsg');
  say(msg, 'Saving…');
  const res = await setPassword(current.id, null);
  if (!res.ok) { say(msg, res.error, 'bad'); return; }
  current.locked = false;
  renderLock();
  say(msg, 'It’s open now.', 'ok');
});

async function loadItems() {
  const { data, error } = await supabase.from('folder_items')
    .select('id, type, content, url, caption, image_path, width, height, sort')
    .eq('folder_id', current.id)
    .order('sort', { ascending: true }).order('created_at', { ascending: true });
  if (error) { status(friendly(error)); return; }
  items = data;
  const paths = items.filter((i) => i.type === 'image').map((i) => i.image_path);
  const thumbs = new Map();
  if (paths.length) {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
    (signed || []).forEach((s) => { if (s.signedUrl) thumbs.set(s.path, s.signedUrl); });
  }
  renderItems(thumbs);
  status(`${items.length} item(s)`);
}

function renderItems(thumbs) {
  const ul = $('itemList');
  ul.replaceChildren();
  if (!items.length) { ul.innerHTML = '<li class="empty">Empty. Add pictures, notes or links above.</li>'; return; }
  items.forEach((it, i) => {
    const li = document.createElement('li');
    let lead;
    if (it.type === 'image') {
      lead = document.createElement('img');
      lead.className = 'thumb';
      lead.alt = '';
      lead.src = thumbs.get(it.image_path) || '';
    } else {
      lead = document.createElement('span');
      lead.className = 'kind';
      lead.textContent = it.type === 'text' ? '📝 note' : '🔗 link';
    }
    const body = document.createElement('div');
    body.className = 'body';
    const field = (tag, value, key, placeholder, max) => {
      const el = document.createElement(tag);
      if (tag === 'textarea') el.rows = 3;
      el.value = value || '';
      el.placeholder = placeholder;
      el.maxLength = max;
      el.addEventListener('change', () => saveItem(it, { [key]: el.value.trim() || (key === 'caption' ? null : el.value) }));
      return el;
    };
    if (it.type === 'image') body.append(field('input', it.caption, 'caption', 'caption (optional)', 300));
    if (it.type === 'text') body.append(field('textarea', it.content, 'content', 'note', 5000));
    if (it.type === 'link') {
      const url = field('input', it.url, 'url', 'https://', 2000);
      url.type = 'url';
      body.append(url, field('input', it.caption, 'caption', 'label (optional)', 300));
    }
    const acts = document.createElement('div');
    acts.className = 'acts';
    acts.innerHTML = '<button data-a="up" aria-label="Move up">▲</button><button data-a="down" aria-label="Move down">▼</button><button data-a="del">Delete</button>';
    acts.querySelector('[data-a="up"]').disabled = i === 0;
    acts.querySelector('[data-a="down"]').disabled = i === items.length - 1;
    acts.querySelector('[data-a="up"]').addEventListener('click', () => moveItem(i, -1, thumbs));
    acts.querySelector('[data-a="down"]').addEventListener('click', () => moveItem(i, 1, thumbs));
    acts.querySelector('[data-a="del"]').addEventListener('click', () => deleteItem(it));
    li.append(lead, body, acts);
    ul.appendChild(li);
  });
}

async function saveItem(it, patch) {
  if ('url' in patch && !/^https?:\/\//i.test(patch.url || '')) { status('Links must start with http:// or https://'); return; }
  if ('content' in patch && !String(patch.content || '').trim()) { status('A note can’t be empty (delete it instead).'); return; }
  status('Saving…');
  const { error } = await supabase.from('folder_items').update(patch).eq('id', it.id);
  if (error) { status(friendly(error)); return; }
  Object.assign(it, patch);
  status('Saved');
}

async function moveItem(i, dir, thumbs) {
  const j = i + dir;
  if (j < 0 || j >= items.length) return;
  [items[i], items[j]] = [items[j], items[i]];
  renderItems(thumbs);
  status('Saving order…');
  try { await renumber('folder_items', items); status('Order saved'); } catch (err) { status(friendly(err)); loadItems(); }
}

async function deleteItem(it) {
  if (!confirm('Delete this from the folder? This can’t be undone.')) return;
  status('Deleting…');
  const { error } = await supabase.from('folder_items').delete().eq('id', it.id);
  if (error) { status(friendly(error)); return; }
  if (it.type === 'image') await supabase.storage.from(BUCKET).remove([it.image_path]);
  loadItems();
}

const nextSort = () => (items.reduce((m, it) => Math.max(m, it.sort), 0) || 0) + 10;

async function addItem(row) {
  const { error } = await supabase.from('folder_items').insert({ folder_id: current.id, sort: nextSort(), ...row });
  if (error) throw error;
}

$('noteForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try { await addItem({ type: 'text', content: $('noteText').value.trim() }); $('noteText').value = ''; loadItems(); }
  catch (err) { status(friendly(err)); }
});

$('linkForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = $('linkUrl').value.trim();
  if (!/^https?:\/\//i.test(url)) { status('Links must start with http:// or https://'); return; }
  try {
    await addItem({ type: 'link', url, caption: $('linkLabel').value.trim() || null });
    $('linkForm').reset();
    loadItems();
  } catch (err) { status(friendly(err)); }
});

// ---- pictures: shrink in the browser, then upload to the private bucket ----
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Can’t read ${file.name}`)); };
    img.src = url;
  });
}

async function shrink(file) {
  const { img, url } = await loadImage(file);   // <img> applies EXIF rotation
  try {
    const w0 = img.naturalWidth;
    const h0 = img.naturalHeight;
    // Animated GIFs would lose their animation on a canvas: keep small ones as they are.
    if (file.type === 'image/gif' && file.size <= 8 * 1024 * 1024) return { blob: file, ext: 'gif', width: w0, height: h0 };
    const scale = Math.min(1, MAX_SIDE / Math.max(w0, h0));
    const width = Math.round(w0 * scale);
    const height = Math.round(h0 * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    const toBlob = (type, q) => new Promise((r) => canvas.toBlob(r, type, q));
    // PNGs keep transparency if they stay a sensible size; everything else is JPEG.
    if (file.type === 'image/png') {
      ctx.drawImage(img, 0, 0, width, height);
      const png = await toBlob('image/png');
      if (png && png.size < 2.5 * 1024 * 1024) return { blob: png, ext: 'png', width, height };
    }
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const jpg = await toBlob('image/jpeg', 0.85);
    if (!jpg) throw new Error(`Couldn’t shrink ${file.name}`);
    return { blob: jpg, ext: 'jpg', width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function uploadFiles(fileList) {
  const files = [...fileList].filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
  if (!files.length || !current) return;
  const msg = $('uploadMsg');
  let done = 0;
  for (const file of files) {
    say(msg, `Uploading ${done + 1} of ${files.length}…`);
    try {
      const { blob, ext, width, height } = await shrink(file);
      const path = `${current.id}/${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET)
        .upload(path, blob, { contentType: blob.type || `image/${ext}`, cacheControl: '3600', upsert: false });
      if (upErr) throw upErr;
      const caption = null;
      try { await addItem({ type: 'image', image_path: path, width, height, caption }); }
      catch (err) { await supabase.storage.from(BUCKET).remove([path]); throw err; }
      items.push({ sort: nextSort() });   // keep the next sort ahead while looping
      done++;
    } catch (err) {
      say(msg, `${file.name}: ${friendly(err)}`, 'bad');
      await loadItems();
      return;
    }
  }
  say(msg, `${done} picture(s) added.`, 'ok');
  $('files').value = '';
  loadItems();
}

const drop = $('drop');
$('files').addEventListener('change', (e) => uploadFiles(e.target.files));
['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('is-over')));
drop.addEventListener('drop', (e) => { e.preventDefault(); uploadFiles(e.dataTransfer.files); });
// Dropping a picture anywhere else shouldn't navigate away from the page.
['dragover', 'drop'].forEach((t) => addEventListener(t, (e) => { if (!e.target.closest?.('#drop')) e.preventDefault(); }));
