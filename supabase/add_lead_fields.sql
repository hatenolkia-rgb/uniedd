-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query)
-- against the existing `bookings` table, to support the /book-trial funnel.
--
-- Until these columns exist, /api/contact will still work (email + WhatsApp
-- notifications go out normally) — it just logs a Supabase insert error and
-- skips persisting the row, exactly like it already does for any other DB
-- hiccup. Nothing breaks, but leads won't show up in the `bookings` table
-- until this migration is applied.

alter table bookings
  add column if not exists age_group text,
  add column if not exists source text default 'website';
