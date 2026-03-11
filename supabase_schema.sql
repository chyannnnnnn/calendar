-- ═══════════════════════════════════════════════════════════
--  us.cal — Complete Supabase Schema
--  Safe to re-run at any time (fully idempotent)
--  Supabase Dashboard → SQL Editor → paste → Run
-- ═══════════════════════════════════════════════════════════


-- ─── 0. CLEAN UP (drop everything first so re-runs never fail) ───────────────

drop policy if exists "Authenticated users can read profiles" on profiles;
drop policy if exists "Users can update own profile"          on profiles;
drop policy if exists "Owner full access"                     on events;
drop policy if exists "Owner can select own events"           on events;
drop policy if exists "Owner can insert own events"           on events;
drop policy if exists "Owner can update own events"           on events;
drop policy if exists "Owner can delete own events"           on events;
drop policy if exists "Partner can read events"               on events;
drop policy if exists "Members can read their partnership"    on partnerships;
drop policy if exists "Members can insert partnership"        on partnerships;
drop policy if exists "Members can delete their partnership"  on partnerships;
drop policy if exists "Creator manages invite"                on invite_links;
drop policy if exists "Anyone can read invite to accept"      on invite_links;

-- Remove events from realtime publication safely before re-adding
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'events'
  ) then
    alter publication supabase_realtime drop table events;
  end if;
end $$;

-- Drop trigger so we can recreate cleanly
drop trigger if exists on_auth_user_created on auth.users;


-- ─── 1. TABLES ───────────────────────────────────────────────────────────────

-- PROFILES
-- One row per user. Auto-created on signup via trigger below.
-- Stores display_name + email so partners can find each other by email.
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  email        text not null default '',
  updated_at   timestamptz default now()
);

-- Safe to run even if column already exists
alter table profiles add column if not exists email text not null default '';

-- Add event_type for existing databases
alter table events add column if not exists event_type text not null default 'mine';
alter table events add column if not exists location   text not null default '';
alter table events add column if not exists notes      text not null default '';

-- PARTNERSHIPS
-- A single row links two users as a pair.
-- Either user can insert (to create the link) or delete (to unlink).
create table if not exists partnerships (
  id          uuid primary key default gen_random_uuid(),
  user_a      uuid not null references auth.users(id) on delete cascade,
  user_b      uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz default now(),
  unique(user_a, user_b)
);

-- EVENTS
create table if not exists events (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  date         date not null,
  start_time   time not null,
  end_time     time not null,
  is_private   boolean default false,
  event_type   text default 'mine',     -- 'mine' (personal) | 'ours' (shared date)
  location     text default '',
  notes        text default '',
  is_recurring boolean default false,
  recur_rule   text,
  updated_at   timestamptz default now(),
  created_at   timestamptz default now()
);

-- INVITE LINKS (kept for future use)
create table if not exists invite_links (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid references auth.users(id) on delete cascade,
  code        text unique not null,
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  expires_at  timestamptz default (now() + interval '7 days'),
  created_at  timestamptz default now()
);


-- ─── 2. AUTO-PROFILE TRIGGER ─────────────────────────────────────────────────
-- Fires on every new signup and inserts a profiles row automatically.

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do update set
    display_name = coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    email        = new.email,
    updated_at   = now();
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();


-- ─── 3. BACKFILL EXISTING USERS ──────────────────────────────────────────────
-- Inserts profile rows for any accounts created before this trigger existed.
-- Safe to run multiple times — uses ON CONFLICT DO UPDATE.

insert into profiles (id, display_name, email)
select
  id,
  coalesce(raw_user_meta_data->>'display_name', split_part(email, '@', 1)),
  email
from auth.users
on conflict (id) do update set
  display_name = excluded.display_name,
  email        = excluded.email,
  updated_at   = now();


-- ─── 4. ROW LEVEL SECURITY ───────────────────────────────────────────────────

alter table profiles      enable row level security;
alter table partnerships  enable row level security;
alter table events        enable row level security;
alter table invite_links  enable row level security;

-- PROFILES
-- Any signed-in user can read profiles (needed to find partner by email)
create policy "Authenticated users can read profiles"
  on profiles for select
  using (auth.role() = 'authenticated');

-- Only the owner can update their own profile
create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- EVENTS
-- Split into explicit per-operation policies so INSERT/UPDATE/DELETE
-- each get both a USING and WITH CHECK clause — required for writes to work.

create policy "Owner can select own events"
  on events for select
  using (auth.uid() = owner_id);

create policy "Owner can insert own events"
  on events for insert
  with check (auth.uid() = owner_id);

create policy "Owner can update own events"
  on events for update
  using  (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Owner can delete own events"
  on events for delete
  using (auth.uid() = owner_id);

-- Partner can read events (app handles showing "Busy" for private ones)
create policy "Partner can read events"
  on events for select
  using (
    exists (
      select 1 from partnerships p
      where (p.user_a = auth.uid() and p.user_b = owner_id)
         or (p.user_b = auth.uid() and p.user_a = owner_id)
    )
  );

-- PARTNERSHIPS
-- Either member can read their shared partnership row
create policy "Members can read their partnership"
  on partnerships for select
  using (auth.uid() = user_a or auth.uid() = user_b);

-- Either member can create a partnership (email-based linking)
create policy "Members can insert partnership"
  on partnerships for insert
  with check (auth.uid() = user_a or auth.uid() = user_b);

-- Either member can delete (unlink) the partnership
create policy "Members can delete their partnership"
  on partnerships for delete
  using (auth.uid() = user_a or auth.uid() = user_b);

-- INVITE LINKS
create policy "Creator manages invite"
  on invite_links for all
  using (auth.uid() = creator_id);

create policy "Anyone can read invite to accept"
  on invite_links for select
  using (true);


-- ─── 5. REALTIME ─────────────────────────────────────────────────────────────
-- Pushes event changes live to all connected clients

alter publication supabase_realtime add table events;


-- ─── 6. PROFILE EXTRAS ───────────────────────────────────────────────────────
-- Stores rich profile info as a JSONB column so we can add fields freely
-- without schema migrations. App reads/writes this as a plain JS object.

alter table profiles add column if not exists extras jsonb not null default '{}';

-- Allow users to update their own extras
drop policy if exists "Users can update own extras" on profiles;
-- (covered by existing "Users can update own profile" policy which is for all of profiles)