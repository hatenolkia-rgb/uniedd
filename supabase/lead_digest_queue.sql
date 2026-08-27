-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query).
--
-- This is NOT a permanent booking record — it's a small holding pen for the
-- 24-hour digest email. api/contact writes one row per lead; the daily
-- api/send-lead-digest cron job reads everything in here, emails one
-- summary, then deletes those rows. Nobody views this table directly and
-- nothing accumulates in it long-term.

create table if not exists lead_digest_queue (
  id              uuid primary key default gen_random_uuid(),
  first_name      text not null,
  last_name       text,
  email           text not null,
  phone           text not null,
  instrument      text not null,
  age_group       text,
  demo_date       text not null,
  demo_time       text not null,
  timezone        text,
  requires_payment boolean not null default false,
  created_at      timestamptz not null default now()
);

-- Only the server (service-role key, which bypasses RLS) ever touches this
-- table — enabling RLS with no policies blocks anon/authenticated access
-- entirely as a safety net, even though nothing client-side should reach it.
alter table lead_digest_queue enable row level security;
