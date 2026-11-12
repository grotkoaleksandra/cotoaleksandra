# cotoaleksandra.com

Aleksandra's portfolio and contact site. Static HTML/CSS/JS on GitHub Pages,
with Supabase behind it for the contact form, the work list and the private
back room. There is no server.

## Load on demand

| Task | Read first |
|---|---|
| Tables, RLS, who counts as the owner | `docs/SCHEMA.md` |
| Deploying, domain, migrations, secrets | `docs/DEPLOY.md` |
| Keys | `docs/CREDENTIALS.md` (gitignored — never commit) |

## Two rules that shape everything

1. **The browser only ever talks to Supabase.** No third-party key appears in
   page JavaScript. Anything needing a secret lives in
   `supabase/functions/<name>/` and the page calls that function.
2. **Every table has RLS on.** The database decides who sees what. Filtering
   in the browser is cosmetic, never a security boundary.

## Graceful degradation is a feature

`shared/supabase.js` exports two flags, and everything Supabase-backed checks
one of them before touching the page:

- `CONTACT_READY` — the project URL is set. Enough for the contact form, because
  the `contact-form` edge function has JWT verification off and needs no key.
- `CONFIGURED` — the anon key is set too. Required for the work list, sign-in
  and the back room.

Unset, the page keeps its static contact link and the placeholder work rows
written in `index.html` rather than showing something broken. Keep it that way.

## Layout

```
index.html            the one public page: a printed-folio portfolio (cover, contents,
                      about, experience, folder tabs, a coloured page per brand, contact)
folio.css             its look — Inter Tight (heavy) + Monsieur La Doulaise (script), grey paper
karol.svg             dot-drawn Karol with a CSS-animated wagging tail
logos/, work/         client logos and project images
desktop.*, win98.css, home.* — earlier designs; no longer loaded
desktop/              the intranet: a Windows 98 desktop (98.css) whose folders open small
                      sites; locked folders are encrypted (see "Desktop folders" below)
styles.css            the original design; still used by admin/ and login/
shared/supabase.js    the one client — import it, never build another
shared/paths.js       site-root helper (the site lives at / and at /cotoaleksandra/)
shared/auth.js        session helpers
shared/projects-service.js   the work list
shared/contact-service.js    the browser half of the contact form
shared/page.js        wires the public page to Supabase when it's connected
admin/                the back room: letters + work editor
login/                Google sign-in
supabase/migrations/  schema and RLS
supabase/functions/   edge functions (contact-form)
```

## House style

- Fraunces for display, Archivo for everything else. One accent, `--accent`.
- Lowercase headings, ✳ as the mark, dry and warm — "say cześć", not "get in
  touch". Copy is written in her voice, not a template's.
- New colours or spacing values become tokens in `:root` first.
- Paths are relative, because the site is served from the root of
  cotoaleksandra.com and from the `/cotoaleksandra/` subpath on github.io.

## Desktop folders (cotoaleksandra.com/desktop)

A playground and client-prototype drop next to the portfolio (noindex). Each
folder is an icon in `desktop/index.html`:

- **Open folder:** put a site in `desktop/f/<name>/index.html`, add
  `<button class="icon" data-folder="<name>" data-title="…" data-src="f/<name>/" data-karol="…">`.
- **Locked folder:** write the page as ONE self-contained HTML file in
  `desktop/_src/<name>/index.html` (gitignored, never published), then
  `node desktop/tools/lock.mjs desktop/_src/<name>/index.html desktop/f/<name>.lock.json '<password>'`
  and add an icon with `data-lock="f/<name>.lock.json"` (+ `.icon__lock` badge).
  Record the password in `docs/CREDENTIALS.md`. To change a password, re-run lock.mjs.
- Locked pages are AES-GCM encrypted (PBKDF2, 310k rounds) and decrypted in the
  browser; they run in a sandboxed iframe. Fine for prototypes, not for secrets;
  use real passwords.
- Direct link to a folder: `cotoaleksandra.com/desktop/#<name>`.
