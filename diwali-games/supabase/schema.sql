-- Database setup for the hosted version (Supabase). Run once in the SQL editor, then insert
-- your own secret:  insert into dgn_secret (id, secret) values (1, '<same value as DGN_SECRET>');
create table if not exists public.dgn_state (id int primary key, version bigint not null default 0, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists public.dgn_presence (player_id text primary key, seen_at timestamptz not null default now());
create table if not exists public.dgn_secret (id int primary key, secret text not null);
alter table public.dgn_state enable row level security;
alter table public.dgn_presence enable row level security;
alter table public.dgn_secret enable row level security;
revoke all on public.dgn_state, public.dgn_presence, public.dgn_secret from anon, authenticated;

create or replace function public.dgn_check(p_secret text) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_secret is null or not exists (select 1 from dgn_secret where id = 1 and secret = p_secret) then
    raise exception 'forbidden';
  end if;
end $$;

create or replace function public.dgn_load(p_secret text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; online jsonb;
begin
  perform dgn_check(p_secret);
  select version, data into r from dgn_state where id = 1;
  select coalesce(jsonb_agg(player_id), '[]'::jsonb) into online from dgn_presence where seen_at > now() - interval '25 seconds';
  if r is null then return jsonb_build_object('version', 0, 'data', null, 'online', online); end if;
  return jsonb_build_object('version', r.version, 'data', r.data, 'online', online);
end $$;

-- Compare-and-swap save; broadcasts the new version on the public Realtime channel 'dgn'.
create or replace function public.dgn_save(p_secret text, p_version bigint, p_data jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare v bigint;
begin
  perform dgn_check(p_secret);
  if p_version = 0 then
    insert into dgn_state (id, version, data) values (1, 1, p_data) on conflict (id) do nothing returning version into v;
  else
    update dgn_state set version = version + 1, data = p_data, updated_at = now() where id = 1 and version = p_version returning version into v;
  end if;
  if v is not null then
    perform realtime.send(jsonb_build_object('v', v), 'state', 'dgn', false);
  end if;
  return v;
end $$;

create or replace function public.dgn_seen(p_secret text, p_player text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform dgn_check(p_secret);
  insert into dgn_presence (player_id, seen_at) values (p_player, now()) on conflict (player_id) do update set seen_at = now();
end $$;

revoke all on function public.dgn_check(text) from public, anon, authenticated;
grant execute on function public.dgn_load(text), public.dgn_save(text, bigint, jsonb), public.dgn_seen(text, text) to anon;
