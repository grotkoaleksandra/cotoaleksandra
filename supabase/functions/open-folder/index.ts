// open-folder — hands out the contents of a desktop folder made in /admin/.
//
// POST { slug, password? }
//   open folder            → 200 { folder, items }
//   locked, right password → 200 { folder, items }
//   locked, wrong/missing  → 401 { error: "denied" }   (after a short delay)
//   too many wrong guesses → 429 { error: "slow down" }
//   unknown slug           → 404 { error: "not found" }
//
// Images come back as short-lived signed URLs from the private `desktop`
// bucket. Passwords are checked against a salted PBKDF2-SHA256 hash (written
// by folder-password); the hash never leaves this function.
// JWT verification is OFF: this is a public endpoint and does its own checks.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const ALLOWED_ORIGINS = [
  "https://cotoaleksandra.com",
  "https://www.cotoaleksandra.com",
  "https://grotkoaleksandra.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
];

const SIGNED_URL_SECONDS = 60 * 30;   // long enough to look, short enough not to share
const WINDOW_MINUTES = 15;
const MAX_FAILS_PER_IP = 8;           // per folder, per 15 minutes
const MAX_FAILS_PER_FOLDER = 40;      // from everyone, per 15 minutes

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const enc = new TextEncoder();
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sha256Hex(s: string) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Stored as pbkdf2_sha256$<iterations>$<salt b64>$<hash b64>
async function verifyPassword(password: string, stored: string | null) {
  if (!stored) return false;
  const [scheme, iter, saltB64, hashB64] = stored.split("$");
  if (scheme !== "pbkdf2_sha256") return false;
  const expected = fromB64(hashB64);
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: fromB64(saltB64), iterations: Number(iter) },
    key, expected.length * 8,
  ));
  let diff = bits.length ^ expected.length;
  for (let i = 0; i < Math.min(bits.length, expected.length); i++) diff |= bits[i] ^ expected[i];
  return diff === 0;
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

  let body: { slug?: unknown; password?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const slug = String(body.slug ?? "").trim().toLowerCase().slice(0, 40);
  const password = typeof body.password === "string" ? body.password.slice(0, 200) : "";
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return json({ error: "not found" }, 404);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: folder, error } = await db
    .from("desktop_folders")
    .select("id, slug, name, locked, password_hash")
    .eq("slug", slug)
    .maybeSingle();
  if (error) return json({ error: "Something went wrong" }, 500);
  if (!folder) return json({ error: "not found" }, 404);

  if (folder.locked) {
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
    const ipHash = (await sha256Hex(`${slug}|${ip}`)).slice(0, 32);
    const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

    const [{ count: mine }, { count: all }] = await Promise.all([
      db.from("folder_open_attempts").select("id", { count: "exact", head: true })
        .eq("slug", slug).eq("ip_hash", ipHash).eq("ok", false).gte("created_at", since),
      db.from("folder_open_attempts").select("id", { count: "exact", head: true })
        .eq("slug", slug).eq("ok", false).gte("created_at", since),
    ]);
    if ((mine ?? 0) >= MAX_FAILS_PER_IP || (all ?? 0) >= MAX_FAILS_PER_FOLDER) {
      await sleep(800);
      return json({ error: "slow down" }, 429);
    }

    const ok = password !== "" && await verifyPassword(password, folder.password_hash);
    await db.from("folder_open_attempts").insert({ slug, ip_hash: ipHash, ok });
    if (!ok) {
      await sleep(600 + Math.floor(Math.random() * 400));
      return json({ error: "denied" }, 401);
    }
  }

  const { data: rows, error: itemsError } = await db
    .from("folder_items")
    .select("id, type, content, url, caption, image_path, width, height")
    .eq("folder_id", folder.id)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (itemsError) return json({ error: "Something went wrong" }, 500);

  const paths = (rows ?? []).filter((r) => r.type === "image").map((r) => r.image_path as string);
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data } = await db.storage.from("desktop").createSignedUrls(paths, SIGNED_URL_SECONDS);
    (data ?? []).forEach((s) => { if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl); });
  }

  const items = (rows ?? []).map((r) => r.type === "image"
    ? { type: "image", src: signed.get(r.image_path) ?? null, caption: r.caption, width: r.width, height: r.height }
    : r.type === "link"
      ? { type: "link", url: r.url, caption: r.caption }
      : { type: "text", content: r.content });

  return json({ folder: { slug: folder.slug, name: folder.name, locked: folder.locked }, items });
});
