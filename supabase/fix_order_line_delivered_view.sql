-- Security fix: order_line_delivered was a view that ignored Row Level Security
-- (anyone with the public anon key could read delivered quantities per order
-- line). Nothing in the app uses it (delivered qty is computed client-side from
-- delivery_batches), so it is dropped.
-- Paste into the Supabase SQL Editor and run once. Safe to re-run.

drop view if exists public.order_line_delivered;
