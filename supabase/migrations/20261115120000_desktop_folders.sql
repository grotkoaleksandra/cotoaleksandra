-- cotoaleksandra.com — desktop folders managed from /admin/
--
-- Folders shown on /desktop next to the hardcoded ones (Karol, demo, sari).
-- Open folders: anyone can list them and read their items.
-- Locked folders: anyone can see the icon (slug, name, padlock), but the items
-- only come out of the `open-folder` edge function, after it checks the
-- password against a salted PBKDF2 hash. The hash never leaves the database:
-- no browser role has the column privilege to select it.
-- Images live in the private `desktop` bucket; visitors only ever get
-- short-lived signed URLs from `open-folder`.
-- Only the admin (site_admins, via is_site_admin()) can write anything.

-- ============================================================
-- Admin allowlist: Ola's admin address only
-- ============================================================
insert into site_admins (email) values ('cotoaleksandra@gmail.com')
on conflict (email) do nothing;
delete from site_admins where lower(email) <> 'cotoaleksandra@gmail.com';

-- ============================================================
-- Folders
-- ============================================================
create table if not exists desktop_folders (
  id            uuid primary key default gen_random_uuid(),
  -- used in links (/desktop/#slug); must not clash with the hardcoded icons
  slug          text not null unique
                check (slug ~ '^[a-z0-9][a-z0-9-]{0,39}$'
                       and slug not in ('karol', 'demo', 'sari', 'welcome', 'pw', 'desk')),
  name          text not null check (char_length(btrim(name)) between 1 and 60),
  locked        boolean not null default false,
  password_hash text,       -- pbkdf2_sha256$iterations$salt$hash, set only by folder-password
  karol         text check (char_length(karol) <= 160),   -- Karol's line when you point at it
  sort          integer not null default 100,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint desktop_folders_lock_has_hash check (not locked or password_hash is not null)
);

create index if not exists desktop_folders_sort_idx on desktop_folders (sort, created_at);

drop trigger if exists desktop_folders_touch_updated_at on desktop_folders;
create trigger desktop_folders_touch_updated_at
  before update on desktop_folders
  for each row execute function touch_updated_at();

alter table desktop_folders enable row level security;

-- Column privileges: password_hash is readable by nobody but the service role,
-- and `locked`/`password_hash` can only be changed by the folder-password
-- edge function (service role), which hashes the password server-side.
revoke all on desktop_folders from anon, authenticated;
grant select (id, slug, name, locked, karol, sort, created_at, updated_at)
  on desktop_folders to anon, authenticated;
grant insert (slug, name, karol, sort) on desktop_folders to authenticated;
grant update (slug, name, karol, sort) on desktop_folders to authenticated;
grant delete on desktop_folders to authenticated;

drop policy if exists "Folder icons are public" on desktop_folders;
create policy "Folder icons are public"
  on desktop_folders for select to anon, authenticated
  using ( true );

drop policy if exists "Admin adds folders" on desktop_folders;
create policy "Admin adds folders"
  on desktop_folders for insert to authenticated
  with check ( is_site_admin() );

drop policy if exists "Admin edits folders" on desktop_folders;
create policy "Admin edits folders"
  on desktop_folders for update to authenticated
  using ( is_site_admin() ) with check ( is_site_admin() );

drop policy if exists "Admin removes folders" on desktop_folders;
create policy "Admin removes folders"
  on desktop_folders for delete to authenticated
  using ( is_site_admin() );

-- ============================================================
-- What's inside a folder
-- ============================================================
create table if not exists folder_items (
  id          uuid primary key default gen_random_uuid(),
  folder_id   uuid not null references desktop_folders(id) on delete cascade,
  type        text not null check (type in ('image', 'text', 'link')),
  content     text check (char_length(content) <= 5000),    -- text: the note
  url         text check (url is null or url ~* '^https?://'),  -- link: where it goes
  caption     text check (char_length(caption) <= 300),     -- image caption / link label
  image_path  text,                                          -- image: path in the desktop bucket
  width       integer,
  height      integer,
  sort        integer not null default 100,
  created_at  timestamptz not null default now(),
  constraint folder_items_shape check (
    (type = 'image' and image_path is not null) or
    (type = 'text'  and content is not null) or
    (type = 'link'  and url is not null)
  )
);

create index if not exists folder_items_folder_sort_idx on folder_items (folder_id, sort, created_at);

alter table folder_items enable row level security;

revoke all on folder_items from anon, authenticated;
grant select on folder_items to anon, authenticated;
grant insert, update, delete on folder_items to authenticated;

drop policy if exists "Items of open folders are public" on folder_items;
create policy "Items of open folders are public"
  on folder_items for select to anon, authenticated
  using ( exists (select 1 from desktop_folders f where f.id = folder_id and not f.locked) );

drop policy if exists "Admin reads all items" on folder_items;
create policy "Admin reads all items"
  on folder_items for select to authenticated
  using ( is_site_admin() );

drop policy if exists "Admin adds items" on folder_items;
create policy "Admin adds items"
  on folder_items for insert to authenticated
  with check ( is_site_admin() );

drop policy if exists "Admin edits items" on folder_items;
create policy "Admin edits items"
  on folder_items for update to authenticated
  using ( is_site_admin() ) with check ( is_site_admin() );

drop policy if exists "Admin removes items" on folder_items;
create policy "Admin removes items"
  on folder_items for delete to authenticated
  using ( is_site_admin() );

-- ============================================================
-- Password attempts (rate limiting for open-folder). Service role only.
-- IPs are stored hashed, never raw.
-- ============================================================
create table if not exists folder_open_attempts (
  id          bigint generated always as identity primary key,
  slug        text not null,
  ip_hash     text not null,
  ok          boolean not null,
  created_at  timestamptz not null default now()
);
create index if not exists folder_open_attempts_lookup_idx
  on folder_open_attempts (slug, created_at desc);

alter table folder_open_attempts enable row level security;
revoke all on folder_open_attempts from anon, authenticated;

-- ============================================================
-- Images: a private bucket. Only the admin reads or writes it directly;
-- visitors get signed URLs from open-folder.
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('desktop', 'desktop', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admin reads desktop images" on storage.objects;
create policy "Admin reads desktop images"
  on storage.objects for select to authenticated
  using ( bucket_id = 'desktop' and public.is_site_admin() );

drop policy if exists "Admin uploads desktop images" on storage.objects;
create policy "Admin uploads desktop images"
  on storage.objects for insert to authenticated
  with check ( bucket_id = 'desktop' and public.is_site_admin() );

drop policy if exists "Admin replaces desktop images" on storage.objects;
create policy "Admin replaces desktop images"
  on storage.objects for update to authenticated
  using ( bucket_id = 'desktop' and public.is_site_admin() )
  with check ( bucket_id = 'desktop' and public.is_site_admin() );

drop policy if exists "Admin deletes desktop images" on storage.objects;
create policy "Admin deletes desktop images"
  on storage.objects for delete to authenticated
  using ( bucket_id = 'desktop' and public.is_site_admin() );
