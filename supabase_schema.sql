-- ═══════════════════════════════════════════════════════════
--  us.cal — Complete Supabase Schema
--  Safe to re-run at any time (fully idempotent)
--  Supabase Dashboard → SQL Editor → paste → Run
-- ═══════════════════════════════════════════════════════════


-- ─── 0. CLEAN UP ─────────────────────────────────────────────────────────────
-- Drop all policies first so re-runs never hit "already exists" errors

drop policy if exists "Authenticated users can read profiles" on profiles;
drop policy if exists "Users can update own profile"          on profiles;
drop policy if exists "Users can update own extras"           on profiles;
drop policy if exists "Owner can select own events"           on events;
drop policy if exists "Owner can insert own events"           on events;
drop policy if exists "Owner can update own events"           on events;
drop policy if exists "Owner can delete own events"           on events;
drop policy if exists "Partner can read events"               on events;
drop policy if exists "Owner full access"                     on events;
drop policy if exists "Members can read their partnership"    on partnerships;
drop policy if exists "Members can insert partnership"        on partnerships;
drop policy if exists "Members can delete their partnership"  on partnerships;
drop policy if exists "Creator manages invite"                on invite_links;
drop policy if exists "Anyone can read invite to accept"      on invite_links;
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'calendar_stickers') then
    drop policy if exists "Partners can read stickers"   on calendar_stickers;
    drop policy if exists "Partners can insert stickers" on calendar_stickers;
    drop policy if exists "Partners can update stickers" on calendar_stickers;
    drop policy if exists "Partners can delete stickers" on calendar_stickers;
  end if;
end $$;

-- Remove tables from realtime publication safely before re-adding
do $$
begin
  if exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='events') then
    alter publication supabase_realtime drop table events;
  end if;
  if exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='calendar_stickers') then
    alter publication supabase_realtime drop table calendar_stickers;
  end if;
end $$;

-- Drop trigger so we can recreate cleanly
drop trigger if exists on_auth_user_created on auth.users;


-- ─── 1. TABLES ───────────────────────────────────────────────────────────────

-- PROFILES
-- One row per user. Auto-created on signup via trigger below.
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text        not null default '',
  email        text        not null default '',
  extras       jsonb       not null default '{}',
  updated_at   timestamptz          default now()
);

-- PARTNERSHIPS
-- A single row links two users as a couple.
create table if not exists partnerships (
  id         uuid primary key default gen_random_uuid(),
  user_a     uuid not null references auth.users(id) on delete cascade,
  user_b     uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_a, user_b)
);

-- EVENTS
create table if not exists events (
  id           uuid    primary key default gen_random_uuid(),
  owner_id     uuid    not null references auth.users(id) on delete cascade,
  title        text    not null,
  date         date    not null,
  start_time   time    not null,
  end_time     time    not null,
  is_private   boolean              default false,
  event_type   text                 default 'mine',   -- 'mine' | 'ours'
  location     text                 default '',
  notes        text                 default '',
  is_recurring boolean              default false,
  recur_rule   text,
  series_id    uuid,                              -- groups recurring events so they can be deleted together
  location_lat double precision,
  location_lng double precision,
  updated_at   timestamptz          default now(),
  created_at   timestamptz          default now()
);

-- CALENDAR STICKERS
-- Emoji or image stickers placed on specific dates in Month view.
-- Shared between both partners via the partnership — both see & edit them.
create table if not exists calendar_stickers (
  id             text    primary key,              -- client-generated UUID
  partnership_id uuid    not null references partnerships(id) on delete cascade,
  date           date    not null,                 -- which calendar cell this belongs to
  sticker_type   text    not null,                 -- 'emoji' | 'image'
  sticker_value  text    not null,                 -- emoji char or base64 data URL
  x              float   not null default 10,      -- % position within cell (0–100)
  y              float   not null default 20,      -- % position within cell (0–100)
  size           float   not null default 36,      -- rendered size in px
  created_by     uuid    references auth.users(id) on delete set null,
  updated_at     timestamptz default now()
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


-- ─── 2. SAFE COLUMN ADDITIONS ────────────────────────────────────────────────
-- These are no-ops if the columns already exist (idempotent upgrades)

alter table profiles add column if not exists email        text        not null default '';
alter table profiles add column if not exists extras       jsonb       not null default '{}';

alter table events  add column if not exists event_type   text        not null default 'mine';
alter table events  add column if not exists location     text        not null default '';
alter table events  add column if not exists notes        text        not null default '';
alter table events  add column if not exists location_lat double precision;
alter table events  add column if not exists series_id    uuid;
create index if not exists events_series_id on events(series_id) where series_id is not null;
alter table events  add column if not exists location_lng double precision;


-- ─── 3. AUTO-PROFILE TRIGGER ─────────────────────────────────────────────────
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


-- ─── 4. BACKFILL EXISTING USERS ──────────────────────────────────────────────
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


-- ─── 5. ROW LEVEL SECURITY ───────────────────────────────────────────────────

alter table profiles          enable row level security;
alter table partnerships      enable row level security;
alter table events            enable row level security;
alter table calendar_stickers enable row level security;
alter table invite_links      enable row level security;

-- PROFILES
-- Any signed-in user can read profiles (needed to look up partner by email)
create policy "Authenticated users can read profiles"
  on profiles for select
  using (auth.role() = 'authenticated');

-- Only the owner can update their own profile
create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- EVENTS
-- Split into per-operation policies so INSERT/UPDATE/DELETE each
-- get both USING and WITH CHECK — required for writes to work.

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

-- Partner can read events (app hides details for private ones)
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
create policy "Members can read their partnership"
  on partnerships for select
  using (auth.uid() = user_a or auth.uid() = user_b);

create policy "Members can insert partnership"
  on partnerships for insert
  with check (auth.uid() = user_a or auth.uid() = user_b);

create policy "Members can delete their partnership"
  on partnerships for delete
  using (auth.uid() = user_a or auth.uid() = user_b);

-- CALENDAR STICKERS
-- Both partners can fully read/write stickers that belong to their partnership.
-- Helper function checks membership once to avoid repetition.

create policy "Partners can read stickers"
  on calendar_stickers for select
  using (
    exists (
      select 1 from partnerships p
      where p.id = partnership_id
        and (p.user_a = auth.uid() or p.user_b = auth.uid())
    )
  );

create policy "Partners can insert stickers"
  on calendar_stickers for insert
  with check (
    exists (
      select 1 from partnerships p
      where p.id = partnership_id
        and (p.user_a = auth.uid() or p.user_b = auth.uid())
    )
  );

create policy "Partners can update stickers"
  on calendar_stickers for update
  using (
    exists (
      select 1 from partnerships p
      where p.id = partnership_id
        and (p.user_a = auth.uid() or p.user_b = auth.uid())
    )
  );

create policy "Partners can delete stickers"
  on calendar_stickers for delete
  using (
    exists (
      select 1 from partnerships p
      where p.id = partnership_id
        and (p.user_a = auth.uid() or p.user_b = auth.uid())
    )
  );

-- INVITE LINKS
create policy "Creator manages invite"
  on invite_links for all
  using (auth.uid() = creator_id);

create policy "Anyone can read invite to accept"
  on invite_links for select
  using (true);


-- ─── 6. REALTIME ─────────────────────────────────────────────────────────────
-- Pushes changes live to all connected clients

alter publication supabase_realtime add table events;
alter publication supabase_realtime add table calendar_stickers;


-- ─── 7. INDEXES ──────────────────────────────────────────────────────────────
-- Speed up the most common lookups

create index if not exists events_owner_date    on events (owner_id, date);
create index if not exists events_date          on events (date);
create index if not exists stickers_partnership on calendar_stickers (partnership_id);
create index if not exists stickers_date        on calendar_stickers (date);