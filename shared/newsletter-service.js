// Browser side of the newsletter sign-up. Posts to the newsletter-signup edge
// function, which holds the Resend key and adds the address to her contacts.
import { SUPABASE_URL, CONTACT_READY } from './supabase.js';

export async function joinNewsletter({ email, website }) {
  if (website) return { ok: true }; // honeypot filled — drop it quietly
  if (!CONTACT_READY) return { ok: false, error: 'The list is not connected yet.' };

  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/newsletter-signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
  } catch {
    return { ok: false, error: 'Could not reach the server. Try again?' };
  }

  let payload = {};
  try { payload = await res.json(); } catch { /* empty body */ }

  if (!res.ok) return { ok: false, error: payload.error || 'Something went wrong. Try again?' };
  return { ok: true };
}
