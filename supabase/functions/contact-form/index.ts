// contact-form — takes a note from the public form, stores it, and optionally
// emails Ola about it. Holds the service-role key and the Resend key, so
// neither ever reaches the browser.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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

    // Honeypot: act like it worked, store nothing.
    if (clean(form.website, 200)) return json({ success: true });

    const name = clean(form.name, 120);
    const email = clean(form.email, 200);
    const subject = clean(form.subject, 200);
    const message = clean(form.message, 5000);

    if (!name || !email || !subject || !message) {
      return json({ error: "All four, please." }, 400);
    }
    if (!looksLikeEmail(email)) {
      return json({ error: "That email doesn't look right." }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Light rate limit: five notes per address per hour.
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("contact_submissions")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", hourAgo);

    if ((count ?? 0) >= 5) {
      return json({ error: "That's a lot of notes. Try again in an hour." }, 429);
    }

    const { data, error } = await supabase
      .from("contact_submissions")
      .insert({
        name,
        email,
        subject,
        message,
        source: clean(form.source, 60) || "cotoaleksandra",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Database error:", error);
      return json({ error: "Couldn't save that. Try again?" }, 500);
    }

    // Optional notification. Skipped silently when Resend isn't set up.
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const notifyTo = Deno.env.get("CONTACT_NOTIFY_TO");
    const notifyFrom = Deno.env.get("CONTACT_NOTIFY_FROM") ?? "onboarding@resend.dev";

    if (resendKey && notifyTo) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: notifyFrom,
            to: [notifyTo],
            reply_to: email,
            subject: `A note from ${name}: ${subject}`,
            text: `${name} <${email}>\n\n${message}\n\n— cotoaleksandra.com`,
          }),
        });
        if (!res.ok) console.error("Resend failed:", res.status, await res.text());
      } catch (mailErr) {
        console.error("Resend threw:", mailErr);
      }
    }

    return json({ success: true, id: data.id });
  } catch (err) {
    console.error("contact-form error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
