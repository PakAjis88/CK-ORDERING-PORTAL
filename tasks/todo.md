# Todo — 3 improvements (2026-09-25)

## 1. Fix stock reporting window: 20th through the real end of the month — DONE
Problem: `is_stock_window_open()` currently checks `extract(day from current_date) between 20 and 30`. That's wrong for every 31-day month (Jan/Mar/May/Jul/Aug/Oct/Dec) — the 31st gets excluded, so the window closes a day early instead of running through the actual end of the month. (Feb and the 30-day months already happen to work correctly with the current logic, just by coincidence of month length.)

- [x] Rewrote the check using date arithmetic: `current_date >= date_trunc('month', current_date)::date + 19` (the 20th of the current month) — true from the 20th through whatever the real last day of that month is, resets false on the 1st of the next month, no upper cap needed
- [x] New migration file `supabase/stock_window_end_of_month_setup.sql`
- [x] Updated `supabase/schema.sql`'s copy of `is_stock_window_open()`
- [x] Updated `windowClosed` i18n text (both `en`/`ms`)
- [x] Updated `MIGRATION_BRIEF.md`'s matching documentation lines (3 spots)

## 2 & 3. Enable ordering — open "Tempahan Baru" and "Tempahan Saya" — DONE
Both map to the same one-line change: `src/lib/featureFlags.js` has `ORDERS_ENABLED = false`, built specifically so flipping it to `true` re-enables both tabs at once (per the plan from the original staged-rollout work) — no other code changes needed, `OutletHome.jsx`/`Tabs` already handle the enabled state correctly, including reverting the default landing tab back to "order".

- [x] Confirmed with the user this is a deliberate go-live, not just a UI toggle
- [x] Flipped `ORDERS_ENABLED` to `true` in `src/lib/featureFlags.js`

## Verification
- [x] Ran the new SQL migration
- [x] Confirmed `is_stock_window_open()` still returns `true` today (Sept 25) against the live database
- [x] Verified the 31-day-month fix by hand (can't fast-forward the real clock): for Jan 2026, `date_trunc('month', current_date)::date + 19` = `2026-01-20`, so the window stays open through `2026-01-31` — the old `extract(day) between 20 and 30` incorrectly closed it one day early
- [x] Rebuilt clean
- [ ] Not yet click-tested in a browser (unavailable this session) — recommend confirming both tabs are enabled/clickable and a real test order can be placed end-to-end once deployed

## Review

All 3 items done:
1. **Stock window fix** — `is_stock_window_open()` now uses date arithmetic (`current_date >= 20th-of-this-month`) instead of a hardcoded `between 20 and 30`, which was silently closing the window a day early in every 31-day month. Updated the DB function, i18n text, and `MIGRATION_BRIEF.md`'s docs to match.
2. **& 3. Ordering enabled** — flipped `ORDERS_ENABLED` to `true` in `featureFlags.js`, the one-line switch this flag was built for. No other code changes — `OutletHome.jsx`/`Tabs` already handle both states.

This is a live-traffic-affecting change (real outlets can now place real orders) — confirmed with the user as a deliberate go-ahead before making the change, not just flipping a UI toggle. Nothing committed or pushed yet — pending review.
