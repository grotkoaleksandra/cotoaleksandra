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

## Supabase — keys
The URL and the (public) legacy anon key are in `shared/config.js`;
`shared/supabase.js` builds the one client from them.

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

## Admin: desktop folders (added 2026-11-15)

`/admin/` is a private Windows-98-style page (noindex) where Ola makes folders
for `/desktop`. Changes show up on the desktop at once; no deploy needed.

**Logging in.** Email link or code (Supabase Auth, passwordless). Sign-ups are
**off**, so only accounts that already exist can ask for a code, and only
addresses in `site_admins` can change anything; RLS enforces that in the
database, not just in the page. Auth emails go out through custom SMTP
(Resend, `cotoaleksandra.com` domain): Authentication → Emails → SMTP Settings.
Supabase's built-in mailer only delivers to members of the Supabase org.

**Where things live**

| what | where |
|---|---|
| page | `admin/index.html`, `admin/admin.js`, `admin/admin.css` |
| desktop side | `desktop/desktop.js` ("folders from /admin/"), `desktop/desktop.css` |
| tables | `desktop_folders`, `folder_items`, `folder_open_attempts` (`supabase/migrations/20261115120000_desktop_folders.sql`) |
| images | private Storage bucket `desktop`, one folder per desktop folder id |
| open a folder | edge function `open-folder` (JWT verification off): checks the password, rate-limits guesses (8 wrong per IP per folder per 15 min, 40 per folder), returns items with 30-minute signed image URLs |
| set a password | edge function `folder-password` (JWT verification off, checks the caller is an admin itself): hashes with PBKDF2-SHA256, 310k rounds, random salt |

Browsers can list folder names (that's what draws the icons) and read items
of **open** folders. Nobody but the service role can read `password_hash`, and
`locked`/`password_hash` can only change through `folder-password`.
The hardcoded folders (Karol, demo, sari) are untouched and keep working if
Supabase is down; DB folders just don't appear then.

Edge functions are deployed by pasting `supabase/functions/<name>/index.ts`
into the dashboard editor (Edge Functions → the function → Code → Deploy);
there is no CLI here. SQL goes through the dashboard SQL editor; keep a copy of
each migration in `supabase/migrations/`.

**Adding another admin.** Two steps in the SQL editor:

```sql
-- 1. allow the address to change things
insert into site_admins (email) values ('someone@example.com');
```

2. Give the address a login: sign-ups are off, so create it under
Authentication → Users → Add user → *Send invitation* (or copy the `do $$`
block in `supabase/migrations/20261115120100_admin_login_user.sql` with the new
address). Removing someone: delete their `site_admins` row (and the user).
