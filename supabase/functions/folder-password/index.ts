// folder-password — locks, re-locks or opens a desktop folder. Admin only.
//
// POST { folder_id, password }   (Authorization: Bearer <admin session token>)
//   password: a string (4+ chars) → folder becomes locked with that password
//   password: null                → folder becomes open, hash removed
//
// The password is hashed here (PBKDF2-SHA256, random 16-byte salt) and only
// the hash is stored. The browser can't write `locked` or `password_hash`
// itself: those columns aren't granted to any browser role.
// JWT verification is OFF at the gateway; this function checks the caller's
// session and the admin allowlist (is_site_admin()) itself.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const ALLOWED_ORIGINS = [
  "https://cotoaleksandra.com",
  "https://www.cotoaleksandra.com",
  "https://grotkoaleksandra.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
];
const ITERATIONS = 310_000;

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));

async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS }, key, 256,
  ));
  return `pbkdf2_sha256$${ITERATIONS}$${b64(salt)}$${b64(bits)}`;
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req.headers.get("origin"));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = req.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return json({ error: "Sign in first" }, 401);

  // Who is asking? Ask Postgres, as them: is_site_admin() reads their JWT.
  const asCaller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: user } = await asCaller.auth.getUser(auth.slice(7));
  if (!user?.user) return json({ error: "Sign in first" }, 401);
  const { data: isAdmin } = await asCaller.rpc("is_site_admin");
  if (isAdmin !== true) return json({ error: "Not allowed" }, 403);

  let body: { folder_id?: unknown; password?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const folderId = String(body.folder_id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(folderId)) return json({ error: "Bad folder" }, 400);

  let update: { locked: boolean; password_hash: string | null };
  if (body.password === null) {
    update = { locked: false, password_hash: null };
  } else if (typeof body.password === "string" && body.password.length >= 4 && body.password.length <= 200) {
    update = { locked: true, password_hash: await hashPassword(body.password) };
  } else {
    return json({ error: "Passwords need at least 4 characters." }, 400);
  }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await db
    .from("desktop_folders").update(update).eq("id", folderId)
    .select("id, locked").maybeSingle();
  if (error) return json({ error: "Couldn't save" }, 500);
  if (!data) return json({ error: "No such folder" }, 404);
  return json({ ok: true, locked: data.locked });
});
