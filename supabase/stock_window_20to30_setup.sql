-- ============================================================================
-- Widen the monthly stock reporting window from "20th only" to "20th-30th"
-- Paste into the Supabase SQL Editor and run once. Safe to re-run.
--
-- Original rule (MIGRATION_BRIEF.md section 6/9): the Laporan Stok form was
-- only open on the 20th of each month. This widens it to stay open from the
-- 20th through the 30th (11 days). In shorter months (e.g. February) it just
-- stays open through the last real day of the month, since there's no day 30
-- for `extract(day from current_date)` to match.
-- ============================================================================

create or replace function is_stock_window_open()
returns boolean
language sql stable security definer set search_path = public as $$
  select (extract(day from current_date) between 20 and 30)
    or coalesce(
         (select (value->>'enabled')::boolean from app_settings where key = 'stock_window_override'),
         false
       );
$$;

grant execute on function is_stock_window_open() to authenticated;
