-- Private teacher lobbies for online chess (uniedd.com/games/chess-online?room=CODE)
--
-- Run this AFTER supabase/chess_multiplayer.sql (already applied in production).
-- Paste the whole file into the Supabase SQL editor and press Run. It is
-- idempotent: running it again is safe.
--
-- What it adds
--   * New columns on public.chess_games (version, is_private, teacher/student
--     names, teacher colour, take-back and demo settings, pending take-back).
--     These hold no secrets: anon can still only READ chess_games (for Realtime).
--   * public.chess_rooms: invite code + teacher/student secret hashes.
--     Server-only (RLS on, no policies, no anon grants).
--   * Functions chess_room_create / chess_room_join / chess_room_touch /
--     chess_room_update, callable only by the service role. Teacher-only
--     actions are checked against the room creator's secret, and every change
--     must quote the version it was based on, so stale actions are rejected.
--   * chess_apply_move / chess_end_game are re-created so public games also
--     bump chess_games.version (and can't touch private rooms).

-- Added for private teacher lobbies (v2). Written as ALTERs so this file can be
-- re-run on a database that already has the first version.
alter table public.chess_games add column if not exists version integer not null default 0;
alter table public.chess_games add column if not exists is_private boolean not null default false;
alter table public.chess_games add column if not exists teacher_name text;
alter table public.chess_games add column if not exists student_name text;
alter table public.chess_games add column if not exists teacher_color text;
alter table public.chess_games add column if not exists allow_takebacks boolean not null default false;
alter table public.chess_games add column if not exists demo_mode boolean not null default false;
alter table public.chess_games add column if not exists takeback_request jsonb;

-- 'waiting' = private room created, student not joined yet.
alter table public.chess_games drop constraint if exists chess_games_status_check;
alter table public.chess_games add constraint chess_games_status_check
  check (status in ('waiting', 'active', 'checkmate', 'stalemate', 'draw', 'resigned', 'abandoned'));
alter table public.chess_games drop constraint if exists chess_games_teacher_color_check;
alter table public.chess_games add constraint chess_games_teacher_color_check
  check (teacher_color is null or teacher_color in ('w', 'b'));

-- Private rooms: the invite code and both players' secrets. Server-only (the
-- code is NOT stored in chess_games, which anon users can read).
create table if not exists public.chess_rooms (
  game_id uuid primary key references public.chess_games (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z2-9]{6}$'),
  teacher_secret_hash text not null,
  student_secret_hash text,
  teacher_seen_at timestamptz not null default now(),
  student_seen_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.chess_rooms enable row level security;
revoke all on public.chess_rooms from anon, authenticated;
grant all on public.chess_rooms to service_role;
grant select on public.chess_games to anon, authenticated;

-- ---------------------------------------------------------------- public games: bump version

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
    version = g.version + 1,
    updated_at = now()
  where g.id = p_game and g.ply = p_expected_ply and g.status = 'active' and not g.is_private;
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
      version = g.version + 1,
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
      version = g.version + 1,
      updated_at = now()
    where g.id = p_game and g.status = 'active';
  else
    return false;
  end if;
  get diagnostics n = row_count;
  return n = 1;
end;
$$;

-- ---------------------------------------------------------------- private rooms (teachers)
--
-- A teacher creates a room and gets a 6-character code; one student joins with
-- it. Rooms never enter the public waiting room. The teacher (creator) can
-- take moves back, approve or decline a student's take-back request, allow
-- free student take-backs, reset the board, choose colours and use demo mode
-- (move both sides). Every change bumps chess_games.version and must quote the
-- version it was based on, so stale actions are rejected.

create or replace function public.chess_room_create(p_name text, p_secret_hash text)
returns table (game_id uuid, code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  new_code text;
  new_game uuid;
  attempt integer := 0;
begin
  delete from public.chess_games g where g.updated_at < now() - interval '2 days';
  insert into public.chess_games (white_name, black_name, is_private, teacher_name, teacher_color, status)
  values (left(p_name, 32), 'Student', true, left(p_name, 32), 'w', 'waiting')
  returning id into new_game;
  loop
    attempt := attempt + 1;
    select string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1), '')
      into new_code from generate_series(1, 6);
    begin
      insert into public.chess_rooms (game_id, code, teacher_secret_hash) values (new_game, new_code, p_secret_hash);
      exit;
    exception when unique_violation then
      if attempt >= 20 then raise; end if;
    end;
  end loop;
  return query select new_game, new_code;
end;
$$;

-- Join a room by code. The teacher or the same student re-joining gets their
-- seat back; a new student may take the seat if it is empty or the previous
-- student has been gone for over a minute. States: joined / full / missing.
create or replace function public.chess_room_join(p_code text, p_name text, p_secret_hash text)
returns table (state text, game_id uuid, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  rm public.chess_rooms%rowtype;
begin
  select * into rm from public.chess_rooms r where r.code = upper(trim(p_code)) for update;
  if not found then
    return query select 'missing'::text, null::uuid, null::text;
    return;
  end if;
  if rm.teacher_secret_hash = p_secret_hash then
    return query select 'joined'::text, rm.game_id, 'teacher'::text;
    return;
  end if;
  if rm.student_secret_hash = p_secret_hash then
    update public.chess_rooms r set student_seen_at = now() where r.game_id = rm.game_id;
    return query select 'joined'::text, rm.game_id, 'student'::text;
    return;
  end if;
  if rm.student_secret_hash is not null and rm.student_seen_at > now() - interval '60 seconds' then
    return query select 'full'::text, null::uuid, null::text;
    return;
  end if;
  update public.chess_rooms r set student_secret_hash = p_secret_hash, student_seen_at = now() where r.game_id = rm.game_id;
  update public.chess_games g set
    student_name = left(p_name, 32),
    white_name = case when g.teacher_color = 'w' then g.teacher_name else left(p_name, 32) end,
    black_name = case when g.teacher_color = 'w' then left(p_name, 32) else g.teacher_name end,
    status = case when g.status = 'waiting' then 'active' else g.status end,
    takeback_request = null,
    version = g.version + 1,
    updated_at = now()
  where g.id = rm.game_id;
  return query select 'joined'::text, rm.game_id, 'student'::text;
end;
$$;

-- Heartbeat for a room member: role, colour, opponent idle time, room code.
create or replace function public.chess_room_touch(p_game uuid, p_secret_hash text)
returns table (role text, color text, opponent_idle_ms bigint, code text, student_joined boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  rm public.chess_rooms%rowtype;
  tc text;
begin
  select * into rm from public.chess_rooms r where r.game_id = p_game;
  if not found then
    return;
  end if;
  select g.teacher_color into tc from public.chess_games g where g.id = p_game;
  if rm.teacher_secret_hash = p_secret_hash then
    update public.chess_rooms r set teacher_seen_at = now() where r.game_id = p_game;
    return query select 'teacher'::text, tc,
      case when rm.student_seen_at is null then 0::bigint
           else (extract(epoch from (now() - rm.student_seen_at)) * 1000)::bigint end,
      rm.code, rm.student_secret_hash is not null;
  elsif rm.student_secret_hash = p_secret_hash then
    update public.chess_rooms r set student_seen_at = now() where r.game_id = p_game;
    return query select 'student'::text, case when tc = 'w' then 'b' else 'w' end,
      (extract(epoch from (now() - rm.teacher_seen_at)) * 1000)::bigint, rm.code, true;
  end if;
end;
$$;

-- Every change to a private room. The website's server works out the new
-- position with chess.js and passes it in (p_moves, p_fen, ...); this function
-- checks who may do what and that nothing changed since p_expected_version.
--   move               side to move (teacher may move both sides in demo mode)
--   undo               teacher: take back the last move
--   takeback           student, when take-backs are allowed: back to before their last move
--   request / decline  student asks for a take-back / teacher declines
--   approve            teacher approves the pending request (same as takeback)
--   set_takebacks      teacher: p_flag allows free student take-backs
--   set_demo           teacher: p_flag lets the teacher move both sides
--   reset              teacher: start position
--   set_teacher_color  teacher: p_teacher_color is the teacher's colour
--   resign             either player
create or replace function public.chess_room_update(
  p_game uuid,
  p_secret_hash text,
  p_expected_version integer,
  p_kind text,
  p_moves text[],
  p_fen text,
  p_last_move jsonb,
  p_status text,
  p_result text,
  p_reason text,
  p_flag boolean,
  p_teacher_color text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  rm public.chess_rooms%rowtype;
  g public.chess_games%rowtype;
  who text;
  n integer;
  k integer := 0;
  new_n integer := coalesce(cardinality(p_moves), 0);
  sc text;
  to_move text;
  last_color text;
  board_change boolean := false;
begin
  select * into rm from public.chess_rooms r where r.game_id = p_game;
  if not found then
    return false;
  end if;
  who := case when rm.teacher_secret_hash = p_secret_hash then 'teacher'
              when rm.student_secret_hash = p_secret_hash then 'student' end;
  if who is null then
    return false;
  end if;

  select * into g from public.chess_games x where x.id = p_game for update;
  if g.version <> p_expected_version then
    return false;
  end if;
  if p_kind in ('undo', 'approve', 'decline', 'set_takebacks', 'set_demo', 'reset', 'set_teacher_color') and who <> 'teacher' then
    return false;
  end if;

  n := coalesce(cardinality(g.moves), 0);
  sc := case when g.teacher_color = 'w' then 'b' else 'w' end;
  to_move := case when n % 2 = 0 then 'w' else 'b' end;
  last_color := case when n % 2 = 1 then 'w' else 'b' end;

  if p_kind = 'move' then
    if g.status <> 'active' or new_n <> n + 1 or p_moves[1:n] is distinct from g.moves then
      return false;
    end if;
    if not ((who = 'teacher' and (g.demo_mode or to_move = g.teacher_color)) or (who = 'student' and to_move = sc)) then
      return false;
    end if;
    board_change := true;
  elsif p_kind in ('undo', 'takeback', 'approve') then
    if g.status = 'waiting' or n = 0 then
      return false;
    end if;
    if p_kind = 'undo' then
      k := 1;
    else
      if p_kind = 'takeback' and not g.allow_takebacks then
        return false;
      end if;
      if p_kind = 'approve' and (g.takeback_request is null or (g.takeback_request ->> 'n')::int <> n) then
        return false;
      end if;
      -- back to just before the student's last move
      k := case when last_color = sc then 1 else 2 end;
    end if;
    if n < k or new_n <> n - k or p_moves is distinct from coalesce(g.moves[1:n - k], '{}') then
      return false;
    end if;
    board_change := true;
  elsif p_kind = 'reset' then
    if new_n <> 0 then
      return false;
    end if;
    board_change := true;
  elsif p_kind = 'request' then
    if who <> 'student' or g.status = 'waiting' or g.takeback_request is not null or n < (case when sc = 'w' then 1 else 2 end) then
      return false;
    end if;
    update public.chess_games x set takeback_request = jsonb_build_object('n', n, 'at', now()), version = x.version + 1, updated_at = now()
    where x.id = p_game;
  elsif p_kind = 'decline' then
    if g.takeback_request is null then
      return false;
    end if;
    update public.chess_games x set takeback_request = null, version = x.version + 1, updated_at = now() where x.id = p_game;
  elsif p_kind in ('set_takebacks', 'set_demo') then
    if p_flag is null then
      return false;
    end if;
    update public.chess_games x set
      allow_takebacks = case when p_kind = 'set_takebacks' then p_flag else x.allow_takebacks end,
      demo_mode = case when p_kind = 'set_demo' then p_flag else x.demo_mode end,
      version = x.version + 1,
      updated_at = now()
    where x.id = p_game;
  elsif p_kind = 'set_teacher_color' then
    if p_teacher_color is null or p_teacher_color not in ('w', 'b') then
      return false;
    end if;
    update public.chess_games x set
      teacher_color = p_teacher_color,
      white_name = case when p_teacher_color = 'w' then x.teacher_name else coalesce(x.student_name, 'Student') end,
      black_name = case when p_teacher_color = 'w' then coalesce(x.student_name, 'Student') else x.teacher_name end,
      takeback_request = null,
      version = x.version + 1,
      updated_at = now()
    where x.id = p_game;
  elsif p_kind = 'resign' then
    if g.status <> 'active' or p_status <> 'resigned' then
      return false;
    end if;
    update public.chess_games x set status = 'resigned', result = p_result, reason = p_reason, takeback_request = null,
      version = x.version + 1, updated_at = now()
    where x.id = p_game;
  else
    return false;
  end if;

  if board_change then
    update public.chess_games x set
      moves = coalesce(p_moves, '{}'),
      ply = new_n,
      fen = p_fen,
      last_move = p_last_move,
      status = case when p_kind = 'reset' and rm.student_secret_hash is null then 'waiting' else p_status end,
      result = p_result,
      reason = p_reason,
      takeback_request = null,
      version = x.version + 1,
      updated_at = now()
    where x.id = p_game;
  end if;

  if who = 'teacher' then
    update public.chess_rooms r set teacher_seen_at = now() where r.game_id = p_game;
  else
    update public.chess_rooms r set student_seen_at = now() where r.game_id = p_game;
  end if;
  return true;
end;
$$;


-- Only the website's server (service role) may call these.
revoke all on function public.chess_room_create(text, text) from public, anon, authenticated;
revoke all on function public.chess_room_join(text, text, text) from public, anon, authenticated;
revoke all on function public.chess_room_touch(uuid, text) from public, anon, authenticated;
revoke all on function public.chess_room_update(uuid, text, integer, text, text[], text, jsonb, text, text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.chess_room_create(text, text) to service_role;
grant execute on function public.chess_room_join(text, text, text) to service_role;
grant execute on function public.chess_room_touch(uuid, text) to service_role;
grant execute on function public.chess_room_update(uuid, text, integer, text, text[], text, jsonb, text, text, text, boolean, text) to service_role;

-- chess_games is already in the supabase_realtime publication (from
-- chess_multiplayer.sql); make sure, in case that step was skipped.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') and not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chess_games'
  ) then
    alter publication supabase_realtime add table public.chess_games;
  end if;
end;
$$;

notify pgrst, 'reload schema';
