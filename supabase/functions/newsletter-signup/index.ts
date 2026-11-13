// newsletter-signup — takes an address from the public sign-up box and adds it
// to Ola's contacts in Resend. Newsletters themselves are written and sent from
// Resend's Broadcasts screen, which adds the unsubscribe link for her.
// Holds the Resend key, so it never reaches the browser.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ALLOWED_ORIGINS = [
  "https://cotoaleksandra.com",
  "https://www.cotoaleksandra.com",
  "https://grotkoaleksandra.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
];

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

serve(async (req: Request) => {
  const cors = corsHeaders(req.headers.get("origin"));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const form = await req.json();

    // Honeypot: act like it worked, add nobody.
    if (clean(form.website, 200)) return json({ success: true });

    const email = clean(form.email, 200).toLowerCase();
    if (!looksLikeEmail(email)) {
      return json({ error: "That email doesn't look right." }, 400);
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      console.error("newsletter-signup: RESEND_API_KEY is not set");
      return json({ error: "The list isn't open yet. Try again soon?" }, 503);
    }

    // Optional: drop sign-ups into one Resend segment, so broadcasts can
    // target just the newsletter list.
    const segmentId = Deno.env.get("RESEND_SEGMENT_ID");

    const res = await fetch("https://api.resend.com/contacts", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        unsubscribed: false,
        ...(segmentId ? { segments: [{ id: segmentId }] } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      // Already on the list: say yes without revealing who's subscribed.
      if (res.status === 409 || /already exists/i.test(detail)) return json({ success: true });
      console.error("Resend contact failed:", res.status, detail);
      return json({ error: "Couldn't add you just now. Try again?" }, 502);
    }

    return json({ success: true });
  } catch (err) {
    console.error("newsletter-signup error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
