# Schema

Source of truth: `supabase/migrations/`. RLS is on for every table.

## `site_admins`
The allowlist that decides who the owner is. No public policies — only the
service role reads it. Policies elsewhere consult it through `is_site_admin()`,
a `security definer` function that matches `auth.jwt() ->> 'email'` against
this table.

Seeded with `cotoaleksandra@gmail.com` and `grotkowskaaleksandra3@gmail.com`.
Signing in with any other Google account gets a valid session and an empty
dashboard, which is the intent.

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
