-- Each party has its own rows. Do not put every party in one JSON document.
-- Phone numbers and questionnaire answers belong in dgn_room_private only.
-- The running server creates these tables itself when DATABASE_URL is set.
-- This file is the same layout for a Supabase project. The server key is the
-- only role that can read or write them.

create table if not exists public.dgn_room (
  code text primary key,
  version integer not null,
  active_at bigint not null default 0,
  created_at bigint not null default 0,
  humans integer not null default 0,
  has_live boolean not null default false,
  data jsonb not null
);
create table if not exists public.dgn_room_private (
  code text primary key references public.dgn_room(code) on delete cascade,
  data jsonb not null
);
create table if not exists public.dgn_book (
  id boolean primary key default true,
  version integer not null,
  data jsonb not null,
  constraint dgn_book_one check (id)
);
create table if not exists public.dgn_seen (
  player_id text primary key,
  seen_at bigint not null
);

alter table public.dgn_room enable row level security;
alter table public.dgn_room_private enable row level security;
alter table public.dgn_book enable row level security;
alter table public.dgn_seen enable row level security;
revoke all on public.dgn_room, public.dgn_room_private, public.dgn_book, public.dgn_seen from anon, authenticated;
