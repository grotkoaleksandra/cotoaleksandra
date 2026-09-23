// The one Supabase client for this site. Import it — never build a second one.
//
// The project URL is public. So is the anon key — it is safe in a browser
// because every table is protected by Row-Level Security — but it still has to
// be pasted in by hand: Project Settings → API Keys → Legacy → anon.
const SUPABASE_URL = 'https://vnkwdfbwplgkcjgvvixp.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// Two levels of readiness, so the site lights up in the right order.
//
// CONTACT_READY — the contact form works with the URL alone. The contact-form
// edge function has JWT verification turned off (it is a public endpoint that
// does its own validation, honeypot and rate limiting), so the page needs no
// key to post a note.
//
// CONFIGURED — the database-backed parts (the work list, sign-in, the back
// room) also need the anon key. Until it is pasted in, the work section keeps
// the placeholder rows written in index.html and /admin/ says so plainly.
const CONTACT_READY = SUPABASE_URL.startsWith('https://');
const CONFIGURED = CONTACT_READY && !SUPABASE_ANON_KEY.startsWith('YOUR_');

function waitForSupabase(maxAttempts = 50) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      if (window.supabase?.createClient) resolve(window.supabase);
      else if (attempts >= maxAttempts) reject(new Error('Supabase library failed to load'));
      else { attempts++; setTimeout(check, 100); }
    };
    check();
  });
}

function makeClient(lib) {
  return lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
      storageKey: 'cotoaleksandra-auth',
      flowType: 'pkce',
    },
  });
}

let supabase = null;
if (CONFIGURED) {
  supabase = window.supabase?.createClient
    ? makeClient(window.supabase)
    : makeClient(await waitForSupabase());
}

// Keep the session alive when a phone tab comes back from the background.
if (CONFIGURED && typeof document !== 'undefined') {
  let lastVisibleAt = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastVisibleAt > 5 * 60 * 1000) {
      supabase.auth.getSession().then(({ data }) => {
        if (!data?.session) supabase.auth.refreshSession();
      });
    }
    lastVisibleAt = Date.now();
  });
}

export { supabase, SUPABASE_URL, SUPABASE_ANON_KEY, CONFIGURED, CONTACT_READY };
