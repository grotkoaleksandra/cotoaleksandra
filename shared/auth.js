// Session helpers for the private pages (sign-in itself lives in admin/admin.js). This is a UX gate only —
// the real boundary is Row-Level Security on the tables.
import { supabase, CONFIGURED } from './supabase.js';
import { path } from './paths.js';

export async function getSession() {
  if (!CONFIGURED) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) { console.error('[auth] getSession', error); return null; }
  return data.session ?? null;
}

export async function getUser() {
  return (await getSession())?.user ?? null;
}

export async function signOut() {
  if (CONFIGURED) await supabase.auth.signOut();
}

/** Send anyone without a session to the login page. Returns the user, or null. */
export async function requireSession(loginPath = path('login/')) {
  const user = await getUser();
  if (!user) { location.replace(loginPath); return null; }
  return user;
}
