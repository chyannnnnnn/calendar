-- ─────────────────────────────────────────────
--  us.cal  —  Supabase Schema
--  Run this in: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────

-- 1. PARTNERSHIPS
--    Links two users together as a "couple" / shared pair.
create table if not exists partnerships (
  id          uuid primary key default gen_random_uuid(),
  user_a      uuid references auth.users(id) on delete cascade,
  user_b      uuid references auth.users(id) on delete cascade,
  created_at  timestamptz default now(),
  unique(user_a, user_b)
);

-- 2. EVENTS
create table if not exists events (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid references auth.users(id) on delete cascade not null,
  title         text not null,
  date          date not null,                  -- e.g. 2026-03-15
  start_time    time not null,                  -- e.g. 09:00
  end_time      time not null,
  is_private    boolean default false,          -- partner sees "Busy" only
  is_recurring  boolean default false,
  recur_rule    text,                           -- 'weekly' | 'daily' etc (future)
  updated_at    timestamptz default now(),
  created_at    timestamptz default now()
);

-- 3. INVITE LINKS
--    User A creates a link, User B clicks it → partnership formed.
create table if not exists invite_links (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid references auth.users(id) on delete cascade,
  code        text unique not null,             -- short random code in URL
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  expires_at  timestamptz default (now() + interval '7 days'),
  created_at  timestamptz default now()
);

-- ─── Row Level Security ───────────────────────────────────

alter table events enable row level security;
alter table partnerships enable row level security;
alter table invite_links enable row level security;

-- Events: owner can do anything
create policy "Owner full access"
  on events for all
  using (auth.uid() = owner_id);

-- Events: partner can read (even private ones show as busy — handled in app)
create policy "Partner can read events"
  on events for select
  using (
    exists (
      select 1 from partnerships p
      where (p.user_a = auth.uid() and p.user_b = owner_id)
         or (p.user_b = auth.uid() and p.user_a = owner_id)
    )
  );

-- Partnerships: both members can read
create policy "Members can read their partnership"
  on partnerships for select
  using (auth.uid() = user_a or auth.uid() = user_b);

-- Invite links: creator can manage, anyone can read to accept
create policy "Creator manages invite"
  on invite_links for all
  using (auth.uid() = creator_id);

create policy "Anyone can read invite to accept"
  on invite_links for select
  using (true);

-- ─── Realtime ─────────────────────────────────────────────
-- Enable realtime so partner's events appear live
alter publication supabase_realtime add table events;