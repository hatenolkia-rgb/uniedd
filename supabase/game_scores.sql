-- Optional leaderboard table for UniEDD Games.
-- Run this in the Supabase SQL editor if you want production scores stored
-- in the existing Supabase project (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
-- Until it exists, the API falls back to in-memory scores (plus each
-- player's personal best in localStorage).

create table if not exists public.game_scores (
  id uuid primary key default gen_random_uuid(),
  game text not null,
  nickname text not null,
  score integer not null check (score >= 0 and score <= 5000),
  created_at timestamptz not null default now()
);

create index if not exists game_scores_game_score_idx
  on public.game_scores (game, score desc, created_at asc);
