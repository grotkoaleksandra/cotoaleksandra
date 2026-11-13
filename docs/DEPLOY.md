# Deploying

## Local preview
```bash
python3 -m http.server 8000
```
Open `http://localhost:8000` — not the `file://` path, because the pages load
ES modules.

## Frontend
`.github/workflows/deploy.yml` publishes `main` to GitHub Pages on every push.

```bash
git add -A && git commit -m "..." && git push
```

Live at `https://grotkoaleksandra.github.io/cotoaleksandra/`, and at
`cotoaleksandra.com` once DNS points at it.

## Custom domain
Settings → Pages → Custom domain → `cotoaleksandra.com`, then at the
registrar:

| type | name | value |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | grotkoaleksandra.github.io |

Tick **Enforce HTTPS** once the certificate is issued. Adding the domain in
Settings writes a `CNAME` file into the repo — leave it there.

## Supabase — what's already done

Project `cotoaleksandra` (ref `vnkwdfbwplgkcjgvvixp`) exists in the Syrena
org. Done:

- ✅ schema and RLS applied — `site_admins`, `projects`, `contact_submissions`,
  all with RLS on, seeded with both of Ola's addresses
- ✅ `contact-form` edge function deployed and tested end to end (valid note
  stored, honeypot silently dropped, bad email rejected)
- ✅ JWT verification turned **off** on that function: it is a public endpoint
  that does its own validation, honeypot and rate limiting, so the page posts
  to it without any key
- ✅ the project URL is in `shared/supabase.js`

## Supabase — what's left

1. **Paste the anon key.** Project Settings → API Keys → "Legacy anon,
   service_role API keys" → copy `anon` → replace `YOUR_SUPABASE_ANON_KEY` in
   `shared/supabase.js`. Only the database-backed parts need it: the work list,
   sign-in and the back room. The contact form already works without it.
2. **Google sign-in** (only needed for `/admin/`): Authentication → Providers →
   Google, with a Google Cloud OAuth client whose authorized redirect URI is
   `https://vnkwdfbwplgkcjgvvixp.supabase.co/auth/v1/callback`. Add the site's
   own URLs under Authentication → URL Configuration.

## Edge function secrets
`supabase secrets set KEY=value`

| secret | required | effect |
|---|---|---|
| `RESEND_API_KEY` | no | emails Ola when a note arrives |
| `CONTACT_NOTIFY_TO` | no | where that email goes |
| `CONTACT_NOTIFY_FROM` | no | verified Resend sender; defaults to their sandbox address |

Without them the form still works — notes land in the database and show up in
the back room, they just don't email anyone.

Record every key in `docs/CREDENTIALS.md`, which is gitignored.

## Staying awake (added 2026-11-13)

Free Supabase projects pause after ~7 idle days, which silently broke the
contact form once. `.github/workflows/keepalive.yml` calls the `keepalive`
edge function every 2 days (JWT verification off). If the project is paused
or the contact form stops answering, the run fails and GitHub emails Ola;
resume the project from the dashboard. The workflow also resets GitHub's
60-day "inactive repo" timer so the schedule never switches itself off.

Only cotoaleksandra is active; uczta and burn-yer-boats were paused on
2026-11-13 to stay within the free plan's 2 active projects.
