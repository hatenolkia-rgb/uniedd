-- Online multiplayer chess for uniedd.com/games/chess-online
--
-- Run this whole file once in the Supabase SQL editor (Dashboard -> SQL Editor
-- -> New query -> paste -> Run). It is idempotent: running it again is safe.
--
-- How it fits together
--   * The website talks to these tables only from its server (API route
--     app/api/games/chess/route.ts) with the existing SUPABASE_URL +
--     SUPABASE_SERVICE_ROLE_KEY. Moves are checked with chess.js on the server
--     before they are stored, so a player can't send an illegal move.
--   * Browsers may *read* public.chess_games through Supabase Realtime with
--     the public anon key (optional, for instant move updates). Anonymous users
--     can't read the queue or seats tables (they hold per-player secrets) and
--     can't write anything.
--   * Matchmaking is first-in-first-out and race-safe: chess_matchmake()
--     serialises pairing with a transaction advisory lock and claims the
--     opponent row with FOR UPDATE SKIP LOCKED, so two players can never be
--     paired with the same person.
--   * Waiting players send a heartbeat every few seconds. Entries not seen for
--     15 seconds (closed tab, lost connection) are never matched and are
--     deleted after a minute.

-- ---------------------------------------------------------------- tables

create table if not exists public.chess_games (
  id uuid primary key default gen_random_uuid(),
  white_name text not null check (char_length(white_name) between 1 and 32),
  black_name text not null check (char_length(black_name) between 1 and 32),
  moves text[] not null default '{}',
  fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  ply integer not null default 0 check (ply >= 0),
  status text not null default 'active'
    check (status in ('active', 'checkmate', 'stalemate', 'draw', 'resigned', 'abandoned')),
  result text check (result is null or result in ('1-0', '0-1', '1/2-1/2')),
  reason text,
  last_move jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chess_seats (
  game_id uuid not null references public.chess_games (id) on delete cascade,
  color text not null check (color in ('w', 'b')),
  name text not null,
  secret_hash text not null,
  seen_at timestamptz not null default now(),
  primary key (game_id, color)
);

create index if not exists chess_seats_secret_idx on public.chess_seats (game_id, secret_hash);

create table if not exists public.chess_queue (
  id uuid primary key,
  name text not null check (char_length(name) between 1 and 32),
  secret_hash text not null,
  joined_at timestamptz not null default now(),
  seen_at timestamptz not null default now(),
  game_id uuid references public.chess_games (id) on delete cascade,
  color text check (color is null or color in ('w', 'b'))
);

create index if not exists chess_queue_waiting_idx
  on public.chess_queue (joined_at, id) where game_id is null;

create index if not exists chess_games_updated_idx on public.chess_games (updated_at);

-- ---------------------------------------------------------------- security

alter table public.chess_games enable row level security;
alter table public.chess_seats enable row level security;
alter table public.chess_queue enable row level security;

-- Anyone may read games (names + moves only; no secrets live in this table).
-- Needed so the browser can receive Realtime updates with the anon key.
drop policy if exists "chess_games public read" on public.chess_games;
create policy "chess_games public read" on public.chess_games
  for select to anon, authenticated using (true);

-- No policies on chess_seats / chess_queue: anon and authenticated users get
-- no access at all. Only the server (service role) uses them.
revoke all on public.chess_queue, public.chess_seats from anon, authenticated;
revoke insert, update, delete, truncate on public.chess_games from anon, authenticated;
grant select on public.chess_games to anon, authenticated;
grant all on public.chess_games, public.chess_seats, public.chess_queue to service_role;

-- ---------------------------------------------------------------- functions

-- Join (or keep alive) a waiting-room ticket and try to pair it with the
-- longest-waiting live player. Call it again every few seconds while waiting:
-- it doubles as the heartbeat. Returns state 'waiting' or 'matched'.
create or replace function public.chess_matchmake(p_ticket uuid, p_name text, p_secret_hash text)
returns table (state text, game_id uuid, color text)
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.chess_queue%rowtype;
  opp public.chess_queue%rowtype;
  new_game uuid;
  me_color text;
begin
  -- One pairing at a time across the whole database (held until commit).
  perform pg_advisory_xact_lock(hashtext('uniedd_chess_matchmaking'));

  -- Housekeeping: drop stale tickets and old games.
  delete from public.chess_queue q where q.game_id is null and q.seen_at < now() - interval '60 seconds';
  delete from public.chess_queue q where q.game_id is not null and q.seen_at < now() - interval '10 minutes';
  delete from public.chess_games g where g.updated_at < now() - interval '2 days';

  select * into me from public.chess_queue q where q.id = p_ticket for update;
  if found then
    if me.secret_hash <> p_secret_hash then
      raise exception 'chess: ticket secret does not match' using errcode = '42501';
    end if;
    update public.chess_queue q set seen_at = now() where q.id = p_ticket;
    if me.game_id is not null then
      return query select 'matched'::text, me.game_id, me.color;
      return;
    end if;
  else
    insert into public.chess_queue (id, name, secret_hash) values (p_ticket, left(p_name, 32), p_secret_hash)
    returning * into me;
  end if;

  -- First in, first out: the oldest ticket that is still alive.
  select * into opp
  from public.chess_queue q
  where q.game_id is null
    and q.id <> p_ticket
    and q.seen_at >= now() - interval '15 seconds'
  order by q.joined_at, q.id
  limit 1
  for update skip locked;

  if not found then
    return query select 'waiting'::text, null::uuid, null::text;
    return;
  end if;

  me_color := case when random() < 0.5 then 'w' else 'b' end;

  insert into public.chess_games (white_name, black_name)
  values (
    case when me_color = 'w' then me.name else opp.name end,
    case when me_color = 'w' then opp.name else me.name end
  )
  returning id into new_game;

  insert into public.chess_seats (game_id, color, name, secret_hash) values
    (new_game, me_color, me.name, me.secret_hash),
    (new_game, case when me_color = 'w' then 'b' else 'w' end, opp.name, opp.secret_hash);

  update public.chess_queue q set game_id = new_game, color = me_color, seen_at = now() where q.id = me.id;
  update public.chess_queue q set game_id = new_game, color = case when me_color = 'w' then 'b' else 'w' end where q.id = opp.id;

  return query select 'matched'::text, new_game, me_color;
end;
$$;

-- Leave the waiting room. If the ticket was matched a moment earlier the game
-- is returned instead, so the player isn't left without an opponent.
create or replace function public.chess_cancel(p_ticket uuid, p_secret_hash text)
returns table (state text, game_id uuid, color text)
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.chess_queue%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('uniedd_chess_matchmaking'));
  select * into me from public.chess_queue q where q.id = p_ticket and q.secret_hash = p_secret_hash for update;
  if not found then
    return query select 'gone'::text, null::uuid, null::text;
    return;
  end if;
  if me.game_id is not null then
    return query select 'matched'::text, me.game_id, me.color;
    return;
  end if;
  delete from public.chess_queue q where q.id = p_ticket;
  return query select 'cancelled'::text, null::uuid, null::text;
end;
$$;

-- Heartbeat for a seated player. Returns the player's colour and how long
-- (milliseconds, by the database clock) since the opponent was last seen.
create or replace function public.chess_touch(p_game uuid, p_secret_hash text)
returns table (color text, opponent_idle_ms bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  my_color text;
begin
  update public.chess_seats s set seen_at = now()
  where s.game_id = p_game and s.secret_hash = p_secret_hash
  returning s.color into my_color;
  if my_color is null then
    return;
  end if;
  return query
    select my_color, (extract(epoch from (now() - s.seen_at)) * 1000)::bigint
    from public.chess_seats s
    where s.game_id = p_game and s.color <> my_color;
end;
$$;

-- Store a move the server has already validated with chess.js. Optimistic
-- concurrency: only applies if the game is still active, it is this player's
-- turn and nobody moved since the server read the game (p_expected_ply).
create or replace function public.chess_apply_move(
  p_game uuid,
  p_secret_hash text,
  p_expected_ply integer,
  p_uci text,
  p_fen text,
  p_last_move jsonb,
  p_status text,
  p_result text,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  my_color text;
  n integer;
begin
  select s.color into my_color from public.chess_seats s
  where s.game_id = p_game and s.secret_hash = p_secret_hash;
  if my_color is null then
    return false;
  end if;
  if (p_expected_ply % 2 = 0 and my_color <> 'w') or (p_expected_ply % 2 = 1 and my_color <> 'b') then
    return false;
  end if;

  update public.chess_games g set
    moves = g.moves || p_uci,
    fen = p_fen,
    ply = g.ply + 1,
    last_move = p_last_move,
    status = p_status,
    result = p_result,
    reason = p_reason,
    updated_at = now()
  where g.id = p_game and g.ply = p_expected_ply and g.status = 'active';
  get diagnostics n = row_count;

  update public.chess_seats s set seen_at = now() where s.game_id = p_game and s.color = my_color;
  return n = 1;
end;
$$;

-- End a game early: 'resign', or 'claim' a win when the opponent has been
-- gone for at least 45 seconds.
create or replace function public.chess_end_game(p_game uuid, p_secret_hash text, p_kind text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  my_color text;
  opp_seen timestamptz;
  n integer;
begin
  select s.color into my_color from public.chess_seats s
  where s.game_id = p_game and s.secret_hash = p_secret_hash;
  if my_color is null then
    return false;
  end if;

  if p_kind = 'resign' then
    update public.chess_games g set
      status = 'resigned',
      result = case when my_color = 'w' then '0-1' else '1-0' end,
      reason = case when my_color = 'w' then 'White resigned' else 'Black resigned' end,
      updated_at = now()
    where g.id = p_game and g.status = 'active';
  elsif p_kind = 'claim' then
    select s.seen_at into opp_seen from public.chess_seats s where s.game_id = p_game and s.color <> my_color;
    if opp_seen is null or opp_seen > now() - interval '45 seconds' then
      return false;
    end if;
    update public.chess_games g set
      status = 'abandoned',
      result = case when my_color = 'w' then '1-0' else '0-1' end,
      reason = case when my_color = 'w' then 'Black left the game' else 'White left the game' end,
      updated_at = now()
    where g.id = p_game and g.status = 'active';
  else
    return false;
  end if;
  get diagnostics n = row_count;
  return n = 1;
end;
$$;

-- Only the website's server (service role) may call these.
revoke all on function public.chess_matchmake(uuid, text, text) from public, anon, authenticated;
revoke all on function public.chess_cancel(uuid, text) from public, anon, authenticated;
revoke all on function public.chess_touch(uuid, text) from public, anon, authenticated;
revoke all on function public.chess_apply_move(uuid, text, integer, text, text, jsonb, text, text, text) from public, anon, authenticated;
revoke all on function public.chess_end_game(uuid, text, text) from public, anon, authenticated;
grant execute on function public.chess_matchmake(uuid, text, text) to service_role;
grant execute on function public.chess_cancel(uuid, text) to service_role;
grant execute on function public.chess_touch(uuid, text) to service_role;
grant execute on function public.chess_apply_move(uuid, text, integer, text, text, jsonb, text, text, text) to service_role;
grant execute on function public.chess_end_game(uuid, text, text) to service_role;

-- ---------------------------------------------------------------- realtime

-- Push chess_games changes to subscribed browsers (Supabase Realtime).
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chess_games'
  ) then
    alter publication supabase_realtime add table public.chess_games;
  end if;
end;
$$;

-- Ask PostgREST to pick up the new tables and functions right away.
notify pgrst, 'reload schema';
