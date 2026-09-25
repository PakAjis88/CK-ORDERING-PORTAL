-- ============================================================================
-- Fix stock reporting window: 20th through the real end of the month
-- Paste into the Supabase SQL Editor and run once. Safe to re-run.
--
-- The previous version checked `extract(day from current_date) between 20
-- and 30`, which wrongly excluded the 31st in every 31-day month (Jan, Mar,
-- May, Jul, Aug, Oct, Dec) — the window closed a day early instead of
-- running through the actual end of the month. This uses date arithmetic
-- instead of a hardcoded upper bound, so it's correct for any month length
-- with no special-casing.
-- ============================================================================

create or replace function is_stock_window_open()
returns boolean
language sql stable security definer set search_path = public as $$
  select (current_date >= date_trunc('month', current_date)::date + 19)
    or coalesce(
         (select (value->>'enabled')::boolean from app_settings where key = 'stock_window_override'),
         false
       );
$$;

grant execute on function is_stock_window_open() to authenticated;
