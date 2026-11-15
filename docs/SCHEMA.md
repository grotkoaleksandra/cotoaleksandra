# Schema

Source of truth: `supabase/migrations/`. RLS is on for every table.

## `site_admins`
The allowlist that decides who the owner is. No public policies — only the
service role reads it. Policies elsewhere consult it through `is_site_admin()`,
a `security definer` function that matches `auth.jwt() ->> 'email'` against
this table.

Holds `cotoaleksandra@gmail.com` only (the second address was removed on
2026-11-15). Sign-ups are off, so nobody else can even get a session.

## `projects`
The rows in "the work". Shaped to match the markup rather than a generic CMS:

| column | notes |
|---|---|
| id | uuid |
| name | the roman part — `Untitled,` |
| name_em | the italic tail — `for now` |
| meta | the small right-hand line — `a lovely little app · soon` |
| url | optional link; without one the row isn't clickable |
| sort_order | ascending; also shown as "no. 1", "no. 2" |
| published | drafts stay out of the public list |

Anyone may select rows where `published = true`. The owner may do anything.
When the table is empty the page keeps the placeholder rows in `index.html`.

## `contact_submissions`
Notes from the form.

| column | notes |
|---|---|
| id | uuid |
| name / email / subject / message | all required |
| source | defaults to `cotoaleksandra` |
| handled | toggled in the back room |
| created_at | indexed descending |

**There is no anon insert policy, on purpose.** The public form posts to the
`contact-form` edge function, which validates, rate-limits and writes with the
service role — so the table can't be written to from a browser at all.

## `desktop_folders`
Folders made in `/admin/` for `/desktop`.

| column | notes |
|---|---|
| id | uuid; also the image folder name in the `desktop` bucket |
| slug | the link, `/desktop/#slug`; a–z, 0–9, dashes; not `karol`/`demo`/`sari`/`welcome`/`pw`/`desk` |
| name | icon label |
| locked | true = needs a password |
| password_hash | `pbkdf2_sha256$310000$salt$hash`; set only by the `folder-password` function |
| karol | Karol's line when you point at the icon |
| sort | ascending |

Anyone may select every column except `password_hash` (column grants). The
admin may insert/update `slug, name, karol, sort` and delete. `locked` and
`password_hash` are written only by the service role.

## `folder_items`
| column | notes |
|---|---|
| folder_id | cascade-deleted with the folder |
| type | `image` / `text` / `link` |
| content | text: the note |
| url, caption | link: target and label; image: caption |
| image_path, width, height | image: path in the private `desktop` bucket |
| sort | ascending |

Anyone may select items of folders that are **not** locked; the admin may do
anything. Locked items only come out of the `open-folder` function.

## `folder_open_attempts`
Password guesses, for rate limiting in `open-folder` (IP stored hashed).
Service role only.
