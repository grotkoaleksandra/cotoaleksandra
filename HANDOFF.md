# Handoff — picking this up in Claude Code

Read `AGENTS.md` for conventions, `docs/SCHEMA.md` for the database and
`docs/DEPLOY.md` for shipping. State of play as of 2026-09-24.

**Everything is pushed and live.** The contact form on
`https://grotkoaleksandra.github.io/cotoaleksandra/` was submitted from the
real page and answered "Landed. She'll write back." — the row reached
Supabase and was then deleted. One thing is left: the anon key.

## What this is

Aleksandra's portfolio and contact site. Static HTML/CSS/JS on GitHub Pages,
Supabase behind it for the contact form, the work list and a private back
room. No server anywhere.

**Design (chosen by Aleksandra, 2026-09-30):** a quiet list of categories on
the left in thin, faded text — *hello / showcase / about me / contact* — and
the content in white boxes in the middle. The background behind the boxes
changes colour per category (pink / yellow / blue / green). One category is
shown at a time, switched by the URL hash (`#showcase` etc.). This replaced the
earlier cream-and-terracotta scrolling page, which she found ugly. Lives in
`index.html`, `home.css`, `home.js`.

- Repo: `github.com/grotkoaleksandra/cotoaleksandra` (public)
- Live: `https://grotkoaleksandra.github.io/cotoaleksandra/`
- Domain: `cotoaleksandra.com` — **live** (2026-09-30). DNS at Cloudflare: 4 A records + `www` CNAME, all "DNS only" (grey cloud — must stay grey or GitHub's certificate breaks). Custom domain set in repo Settings → Pages, HTTPS enforced. Cloudflare also holds Resend's `send` MX/SPF and `resend._domainkey` DKIM records.
- Deploys: `.github/workflows/` → Pages, on every push to `main`

## Supabase — live and verified

| | |
|---|---|
| Org | Syrena (free plan) |
| Project | `cotoaleksandra` |
| Ref | `vnkwdfbwplgkcjgvvixp` |
| URL | `https://vnkwdfbwplgkcjgvvixp.supabase.co` (already in `shared/supabase.js`) |

Applied and checked in SQL, not assumed:

- `contact_submissions` — RLS on, 3 policies, **no anon insert policy by
  design** (the form posts to the edge function, which writes with the
  service role, so the table isn't writable from a browser)
- `projects` — RLS on, 5 policies
- `site_admins` — RLS on, **0 policies on purpose** (service role only);
  `is_site_admin()` is `security definer` and every other policy consults it.
  Seeded with `cotoaleksandra@gmail.com` and `grotkowskaaleksandra3@gmail.com`
- `contact-form` edge function deployed and tested against the live endpoint:
  valid note → `200 {success,id}` + row stored; honeypot → `200`, nothing
  stored; malformed address → `400`. Test row deleted, table is empty.
- **JWT verification is off** on that function, deliberately. It's a public
  endpoint that does its own validation, honeypot and five-per-hour-per-address
  rate limit, so the page posts to it with no key.

## The two-flag design — don't break this

`shared/supabase.js` exports two flags. Everything Supabase-backed checks one
before touching the page, so a missing key or a Supabase outage degrades to
the original static site instead of showing something broken.

- `CONTACT_READY` — project URL present. **Already true.** Turns on the form.
- `CONFIGURED` — anon key also present. **Still false.** Gates the work list,
  sign-in and `/admin/`, which keep the placeholder rows in `index.html`.

Anything new that depends on Supabase checks the right flag first.

## One thing still open

### Paste the anon key
Supabase → Project Settings → API Keys → **Legacy anon, service_role API
keys** → copy `anon` → replace `YOUR_SUPABASE_ANON_KEY` in
`shared/supabase.js` (line 7). Public by design; RLS is the protection.
Use the **legacy JWT** key, not the new `sb_publishable_…` one — the pinned
supabase-js (2.39.3) expects the JWT form.

That flips `CONFIGURED` and lights up the work list, `/login/` and `/admin/`.
Nothing else is blocking.

### Optional, only if you want `/admin/`
Google Cloud OAuth client with redirect URI
`https://vnkwdfbwplgkcjgvvixp.supabase.co/auth/v1/callback`, then enable the
provider in Supabase → Authentication → Providers, and add the site's URLs
under Authentication → URL Configuration.

## Then, in rough order
- Replace the four placeholder work rows with real projects — either through
  `/admin/` or by editing `index.html`
- Fill in the social links if any are missing
- Optional: `RESEND_API_KEY` + `CONTACT_NOTIFY_TO` as Supabase secrets so
  notes also arrive by email (without them the form still works, notes just
  live in the back room)

## Gotchas
- The site is served from **two roots** — `/` on the domain and
  `/cotoaleksandra/` on github.io. Every path is relative and
  `shared/paths.js` resolves the site root. Don't hardcode absolute paths.
- `docs/CREDENTIALS.md` is gitignored. Keep it that way.
- The database password was generated at project creation and never recorded.
  Nothing here needs it; reset it in Project Settings → Database if it's ever
  wanted.
- Preview with `python3 -m http.server 8000` and open `http://localhost:8000` —
  not the `file://` path, because the pages load ES modules.
- There's an unrelated from-scratch build at `~/Documents/ola-site` — a
  different design, never pushed anywhere. Keep or delete; it is not this site.
