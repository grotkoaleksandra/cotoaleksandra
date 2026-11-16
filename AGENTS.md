# cotoaleksandra.com

Aleksandra's site. The home page is a Windows 98 desktop; her portfolio sits
behind a password at /portfolio/. Static HTML/CSS/JS on GitHub Pages,
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

Unset, the portfolio keeps its static contact link rather than showing
something broken. Keep it that way.

## Layout

```
index.html            the home page: the Windows 98 desktop (markup here; its CSS/JS and
                      folders live in desktop/). Holds the site's SEO: title, OG, JSON-LD
portfolio/            the portfolio, LOCKED: index.html asks for the password and decrypts
                      portfolio.lock.json in the browser (see "The portfolio" below)
_src/portfolio/       its plaintext source (gitignored, only on Ola's computer)
tools/lock-portfolio.sh  re-encrypts the portfolio after editing
folio.css             the portfolio's look — Inter Tight (heavy) + Monsieur La Doulaise (script)
karol.svg             dot-drawn Karol with a CSS-animated wagging tail
logos/, work/         client logos and project images
desktop.*, win98.css, home.* — earlier designs; no longer loaded
desktop/              the desktop's CSS/JS, folders (desktop/f/) and lock tool; /desktop/
                      itself just redirects to / (keeping #folder links working)
styles.css            the original design
shared/config.js      Supabase URL + public anon key (no dependencies; desktop.js reads it)
shared/supabase.js    the one client — import it, never build another
shared/paths.js       site-root helper (the site lives at / and at /cotoaleksandra/)
shared/auth.js        session helpers
shared/projects-service.js   the work list
shared/contact-service.js    the browser half of the contact form
shared/page.js        wires the portfolio to Supabase (contact form, newsletter)
shared/unlock.js      decrypts locked pages; remembers the portfolio unlock per tab session
admin/                Ola's admin (Win98 look): emailed-code login, makes /desktop folders
login/                redirects to admin/
supabase/migrations/  schema and RLS
supabase/functions/   edge functions (contact-form, newsletter-signup, keepalive, open-folder, folder-password)
```

## House style

- Fraunces for display, Archivo for everything else. One accent, `--accent`.
- Lowercase headings, ✳ as the mark, dry and warm — "say cześć", not "get in
  touch". Copy is written in her voice, not a template's.
- New colours or spacing values become tokens in `:root` first.
- Paths are relative, because the site is served from the root of
  cotoaleksandra.com and from the `/cotoaleksandra/` subpath on github.io.

## The portfolio (cotoaleksandra.com/portfolio/, password-locked)

The page is encrypted; only `portfolio/portfolio.lock.json` is published. To edit:

1. Edit `_src/portfolio/index.html` (gitignored plaintext; paths are relative to
   /portfolio/, so `../work/…`, `../folio.css`, `../shared/page.js`).
   Preview it decrypted by locking and opening `http://localhost:8000/portfolio/`.
2. `tools/lock-portfolio.sh` (asks for the password; it's in `docs/CREDENTIALS.md`).
3. Commit and push `portfolio/portfolio.lock.json`. Never commit `_src/`.

`_src/` exists only on Ola's computer: back it up, or the portfolio can only be
recovered by decrypting the lock file with the password. The portfolio page
is noindex; images in `work/` are plain files (not encrypted) but are not
listed anywhere public. The desktop's portfolio icon checks the password in
the desktop dialog, stores it in sessionStorage and goes to /portfolio/.
Old links to the home page's sections (`/#about`, `/#contact`…) ask for the
password and land on that section. To change the password, re-run the script
with the new one and update `docs/CREDENTIALS.md`.

## Desktop folders (the home page, cotoaleksandra.com)

A playground and client-prototype drop. Each folder is an icon in the root
`index.html` (paths there are relative to the site root):

- **Open folder:** put a site in `desktop/f/<name>/index.html`, add
  `<button class="icon" data-folder="<name>" data-title="…" data-src="desktop/f/<name>/" data-karol="…">`.
- **Locked folder:** write the page as ONE self-contained HTML file in
  `desktop/_src/<name>/index.html` (gitignored, never published), then
  `node desktop/tools/lock.mjs desktop/_src/<name>/index.html desktop/f/<name>.lock.json '<password>'`
  and add an icon with `data-lock="desktop/f/<name>.lock.json"` (+ `.icon__lock` badge).
  Record the password in `docs/CREDENTIALS.md`. To change a password, re-run lock.mjs.
- Locked pages are AES-GCM encrypted (PBKDF2, 310k rounds) and decrypted in the
  browser; they run in a sandboxed iframe. Fine for prototypes, not for secrets;
  use real passwords.
- Direct link to a folder: `cotoaleksandra.com/#<name>` (old `/desktop/#<name>` links redirect).
- **Shortcuts** (`.icon--shortcut`, e.g. "birthday" → urodziny.cotoaleksandra.com)
  stay last; folders from /admin/ are inserted before the first one.

### Folders made in /admin/ (no code, no deploy)
Ola can also make folders at `cotoaleksandra.com/admin/`: pictures, notes and
links, open or password-locked. They live in Supabase (`desktop_folders`,
`folder_items`, private bucket `desktop`) and desktop.js adds their icons after
the hardcoded ones. Locked ones open through the `open-folder` edge function.
Details: `docs/DEPLOY.md` → "Admin: desktop folders".
