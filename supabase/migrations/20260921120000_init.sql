-- cotoaleksandra.com — initial schema
-- Two tables, RLS on both, one allowlist that decides who the owner is.

-- ============================================================
-- Who gets into /admin/
-- ============================================================
create table if not exists site_admins (
  email text primary key,
  added_at timestamptz not null default now()
);

alter table site_admins enable row level security;
-- No public policies at all: only the service role reads this table. The
-- helper below is SECURITY DEFINER so policies can consult it without
-- exposing the list to anyone.

create or replace function is_site_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from site_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function is_site_admin() from public;
grant execute on function is_site_admin() to authenticated;

-- Ola's addresses. Signing in with a Google account not listed here gets a
-- working session and an empty dashboard, which is the point.
insert into site_admins (email) values
  ('cotoaleksandra@gmail.com'),
  ('grotkowskaaleksandra3@gmail.com')
on conflict (email) do nothing;

-- ============================================================
-- The work
-- ============================================================
create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,          -- "Untitled,"
  name_em     text,                   -- "for now"  (the italic tail)
  meta        text,                   -- "a lovely little app · soon"
  url         text,
  sort_order  integer not null default 10,
  published   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists projects_sort_idx on projects (sort_order);

alter table projects enable row level security;

drop policy if exists "Published work is public" on projects;
create policy "Published work is public"
  on projects for select
  using ( published = true );

drop policy if exists "Owner reads all work" on projects;
create policy "Owner reads all work"
  on projects for select to authenticated
  using ( is_site_admin() );

drop policy if exists "Owner adds work" on projects;
create policy "Owner adds work"
  on projects for insert to authenticated
  with check ( is_site_admin() );

drop policy if exists "Owner edits work" on projects;
create policy "Owner edits work"
  on projects for update to authenticated
  using ( is_site_admin() ) with check ( is_site_admin() );

drop policy if exists "Owner removes work" on projects;
create policy "Owner removes work"
  on projects for delete to authenticated
  using ( is_site_admin() );

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_touch_updated_at on projects;
create trigger projects_touch_updated_at
  before update on projects
  for each row execute function touch_updated_at();

-- ============================================================
-- Letters from the contact form
-- ============================================================
create table if not exists contact_submissions (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  phone      text,
  subject    text not null,
  message    text not null,
  source     text default 'cotoaleksandra',
  handled    boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists contact_submissions_created_idx
  on contact_submissions (created_at desc);

alter table contact_submissions enable row level security;

-- Deliberately no anon insert policy: the public form posts to the
-- contact-form edge function, which validates and writes with the service
-- role. The table itself is not writable from a browser.

drop policy if exists "Owner reads letters" on contact_submissions;
create policy "Owner reads letters"
  on contact_submissions for select to authenticated
  using ( is_site_admin() );

drop policy if exists "Owner updates letters" on contact_submissions;
create policy "Owner updates letters"
  on contact_submissions for update to authenticated
  using ( is_site_admin() ) with check ( is_site_admin() );

drop policy if exists "Owner deletes letters" on contact_submissions;
create policy "Owner deletes letters"
  on contact_submissions for delete to authenticated
  using ( is_site_admin() );
