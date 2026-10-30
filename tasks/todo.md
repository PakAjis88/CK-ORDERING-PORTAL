# Todo — Fix Supabase lint "Security Definer View" (order_line_delivered)

The view ignored RLS: an anonymous caller (public anon key, no login) could read delivered quantities per order line, while the real table `delivery_batches` correctly returned nothing. Nothing in the app used the view, so it is dropped.

## Steps
- [x] 1. `supabase/fix_order_line_delivered_view.sql`: `drop view if exists public.order_line_delivered;` (paste into SQL Editor)
- [x] 2. `supabase/schema.sql`: view definition removed, replaced by a short comment
- [x] 3. Checklist + review in this file
- [x] 4. User ran the SQL in the Supabase SQL Editor
- [x] 5. Verified: anon GET of the view now returns 404 (PGRST205); operator sign-in works and orders with their delivery batches still load (33 orders)
- [ ] 6. Commit; push only after a separate go-ahead

## Review

One view dropped, no app code touched. Before: anonymous read of the view returned HTTP 200 with rows. After: HTTP 404, relation not found. The app never referenced the view (delivered qty is computed client-side), and an operator session still loads all orders with delivery batches, confirming nothing depended on it. Remaining: commit/push of the repo files (schema.sql, the new fix SQL, this file).
