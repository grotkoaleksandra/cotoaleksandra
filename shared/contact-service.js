// Browser side of the contact form. The page never talks to an email provider
// directly — it posts to the contact-form edge function, which holds the keys.
import { SUPABASE_URL, CONTACT_READY } from './supabase.js';

export async function submitContactForm({ name, email, subject, message, website }) {
  if (website) return { ok: true }; // honeypot filled — drop it quietly
  if (!CONTACT_READY) return { ok: false, error: 'The form is not connected yet.' };

  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/contact-form`, {
      method: 'POST',
      // No key needed: the function verifies nothing about the caller and
      // everything about the note.
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, subject, message, source: 'cotoaleksandra' }),
    });
  } catch {
    return { ok: false, error: 'Could not reach the server. Try again?' };
  }

  let payload = {};
  try { payload = await res.json(); } catch { /* empty body */ }

  if (!res.ok) return { ok: false, error: payload.error || 'Something went wrong. Try again?' };
  return { ok: true, id: payload.id };
}
