-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query)
-- against the existing `bookings` table.
--
-- Part 1 supports the /book-trial funnel. Part 2 supports the /admin/leads
-- page. Until Part 1 is applied, /api/contact still works (email + WhatsApp
-- notifications go out normally) — it just logs a Supabase insert error and
-- skips persisting the row, exactly like it already does for any other DB
-- hiccup. Nothing breaks, but leads won't show up in the `bookings` table
-- until this migration is applied.

-- ============================================================
-- Part 1 — lead funnel fields
-- ============================================================
alter table bookings
  add column if not exists age_group text,
  add column if not exists source text default 'website',
  add column if not exists created_at timestamptz default now();

-- ============================================================
-- Part 2 — /admin/leads page
-- ============================================================
alter table bookings
  add column if not exists contacted boolean default false;

-- Enable Row Level Security, then allow any *authenticated* Supabase user
-- to read and update bookings. Nobody can sign up on their own (see the
-- "disable public signups" step below), so "authenticated" here means
-- exactly the accounts you've manually created for your team — that's
-- what makes this "admin or assigned people only".
alter table bookings enable row level security;

drop policy if exists "Authenticated users can read bookings" on bookings;
create policy "Authenticated users can read bookings"
  on bookings for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can update bookings" on bookings;
create policy "Authenticated users can update bookings"
  on bookings for update
  to authenticated
  using (true)
  with check (true);

-- ============================================================
-- Part 3 — manual steps in the Supabase dashboard (not SQL)
-- ============================================================
-- 1. Authentication > Providers > Email > turn OFF "Allow new users to
--    sign up". This is what stops random people from creating their own
--    account and reading your leads — only accounts you create manually
--    can ever log in.
-- 2. Authentication > Users > Add user > enter each team member's email
--    and a temporary password. Give that password to them directly (not
--    over email/chat where it could be intercepted) and have them change
--    it on first login if you add a "change password" flow later, or just
--    rotate it yourself periodically.
-- 3. Project Settings > API > copy the "Project URL" and the "anon /
--    public" key (NOT the service_role key) into your hosting env vars:
--      NEXT_PUBLIC_SUPABASE_URL
--      NEXT_PUBLIC_SUPABASE_ANON_KEY
