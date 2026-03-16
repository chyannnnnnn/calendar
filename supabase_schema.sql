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
  if exists (select 1 from information_schema.tables where table_name = 'whiteboard_items') then
    drop policy if exists "Partners can read whiteboard"  on whiteboard_items;
    drop policy if exists "Partners can insert whiteboard" on whiteboard_items;
    drop policy if exists "Partners can update whiteboard" on whiteboard_items;
    drop policy if exists "Partners can delete whiteboard" on whiteboard_items;
  end if;
end $$;

do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'bucket_items') then
    drop policy if exists "Partners can read bucket"   on bucket_items;
    drop policy if exists "Partners can insert bucket" on bucket_items;
    drop policy if exists "Partners can update bucket" on bucket_items;
    drop policy if exists "Partners can delete bucket" on bucket_items;
  end if;
end $$;

do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'diary_entries') then
    drop policy if exists "Partners can read diary"   on diary_entries;
    drop policy if exists "Owner can insert diary"    on diary_entries;
    drop policy if exists "Owner can update diary"    on diary_entries;
    drop policy if exists "Owner can delete diary"    on diary_entries;
  end if;
end $$;

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
  if exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='diary_entries') then
    alter publication supabase_realtime drop table diary_entries;
  end if;
  if exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='whiteboard_items') then
    alter publication supabase_realtime drop table whiteboard_items;
  end if;
  if exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='bucket_items') then
    alter publication supabase_realtime drop table bucket_items;
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

-- DIARY ENTRIES
-- Shared journal entries. Both partners can read all entries for their partnership.
-- Each entry is owned by one author but visible to the partner.
create table if not exists diary_entries (
  id             text        primary key,
  partnership_id uuid        not null references partnerships(id) on delete cascade,
  author_id      uuid        not null references auth.users(id)   on delete cascade,
  date           date        not null,
  title          text        not null default '',
  body           text        not null default '',
  mood           text,                             -- emoji mood tag
  tag            text        default 'everyday',   -- 'everyday'|'date'|'anniversary'|'milestone'|'travel'
  photo_url      text,                             -- base64 or URL
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- WHITEBOARD ITEMS
-- Freeform sticky notes, photos, and decorations on a shared canvas.
create table if not exists whiteboard_items (
  id             text        primary key,
  partnership_id uuid        not null references partnerships(id) on delete cascade,
  author_id      uuid        not null references auth.users(id)   on delete cascade,
  type           text        not null default 'note',   -- 'note'|'photo'|'sticker'
  content        text        not null default '',       -- text, base64, or emoji
  x              float       not null default 10,       -- % position
  y              float       not null default 10,
  w              float       not null default 20,       -- % width
  rotation       float       not null default 0,        -- degrees
  color          text        not null default '#FFF9C4',
  font_size      int         not null default 14,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- BUCKET LIST ITEMS
-- Shared couple to-do / bucket list.
create table if not exists bucket_items (
  id             text        primary key,
  partnership_id uuid        not null references partnerships(id) on delete cascade,
  author_id      uuid        not null references auth.users(id)   on delete cascade,
  text           text        not null,
  category       text        not null default 'experience', -- 'travel'|'food'|'experience'|'creative'|'milestone'
  done           boolean     not null default false,
  done_by        uuid        references auth.users(id),
  done_at        timestamptz,
  created_at     timestamptz default now()
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

-- Enforce one-partnership-per-user on existing tables
-- (safe to re-run — DO blocks swallow duplicate constraint errors)
do $$
begin
  -- First delete any orphan/duplicate partnerships (keep the most recent one per user)
  delete from partnerships p1
  using partnerships p2
  where p1.user_a = p2.user_a and p1.id < p2.id;

  delete from partnerships p1
  using partnerships p2
  where p1.user_b = p2.user_b and p1.id < p2.id;

  -- Now add the unique constraints if they don't exist
  if not exists (
    select 1 from pg_constraint where conname = 'partnerships_user_a_key'
  ) then
    alter table partnerships add constraint partnerships_user_a_key unique (user_a);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'partnerships_user_b_key'
  ) then
    alter table partnerships add constraint partnerships_user_b_key unique (user_b);
  end if;
end $$;
create index if not exists events_series_id   on events(series_id) where series_id is not null;
create index if not exists diary_partnership  on diary_entries(partnership_id, date desc);
create index if not exists diary_author       on diary_entries(author_id);
create index if not exists whiteboard_partnership on whiteboard_items(partnership_id);
create index if not exists bucket_partnership     on bucket_items(partnership_id, done, created_at);
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

-- Partner can read events: ONLY the direct partner in the same partnership row.
-- This prevents scenario where A-B and A-C both exist (which DB now blocks, but
-- belt-and-suspenders): C cannot read B's events even if A is in both.
create policy "Partner can read events"
  on events for select
  using (
    exists (
      select 1 from partnerships p
      where p.id = (
        -- Find the ONE partnership that includes the current viewer
        select p2.id from partnerships p2
        where p2.user_a = auth.uid() or p2.user_b = auth.uid()
        limit 1
      )
      and (
        (p.user_a = auth.uid() and p.user_b = owner_id) or
        (p.user_b = auth.uid() and p.user_a = owner_id)
      )
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

-- DIARY ENTRIES
-- Shared journal entries. Both partners can read all entries for their partnership.
-- Each entry is owned by one author but visible to the partner.
create table if not exists diary_entries (
  id             text        primary key,
  partnership_id uuid        not null references partnerships(id) on delete cascade,
  author_id      uuid        not null references auth.users(id)   on delete cascade,
  date           date        not null,
  title          text        not null default '',
  body           text        not null default '',
  mood           text,                             -- emoji mood tag
  tag            text        default 'everyday',   -- 'everyday'|'date'|'anniversary'|'milestone'|'travel'
  photo_url      text,                             -- base64 or URL
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- WHITEBOARD ITEMS
-- Freeform sticky notes, photos, and decorations on a shared canvas.
create table if not exists whiteboard_items (
  id             text        primary key,
  partnership_id uuid        not null references partnerships(id) on delete cascade,
  author_id      uuid        not null references auth.users(id)   on delete cascade,
  type           text        not null default 'note',   -- 'note'|'photo'|'sticker'
  content        text        not null default '',       -- text, base64, or emoji
  x              float       not null default 10,       -- % position
  y              float       not null default 10,
  w              float       not null default 20,       -- % width
  rotation       float       not null default 0,        -- degrees
  color          text        not null default '#FFF9C4',
  font_size      int         not null default 14,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- BUCKET LIST ITEMS
-- Shared couple to-do / bucket list.
create table if not exists bucket_items (
  id             text        primary key,
  partnership_id uuid        not null references partnerships(id) on delete cascade,
  author_id      uuid        not null references auth.users(id)   on delete cascade,
  text           text        not null,
  category       text        not null default 'experience', -- 'travel'|'food'|'experience'|'creative'|'milestone'
  done           boolean     not null default false,
  done_by        uuid        references auth.users(id),
  done_at        timestamptz,
  created_at     timestamptz default now()
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
alter publication supabase_realtime add table diary_entries;
alter publication supabase_realtime add table whiteboard_items;
alter publication supabase_realtime add table bucket_items;


-- ─── 7. INDEXES ──────────────────────────────────────────────────────────────
-- Speed up the most common lookups

create index if not exists events_owner_date    on events (owner_id, date);
create index if not exists events_date          on events (date);
create index if not exists stickers_partnership on calendar_stickers (partnership_id);
create index if not exists stickers_date        on calendar_stickers (date);