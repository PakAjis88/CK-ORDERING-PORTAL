# Todo — Work order PDF should show recorded delivery data

## Problem
`src/lib/workOrderPdf.js`'s `drawOrderPage()` always leaves the "Dihantar 1/2" (delivered) and "Luput 1/2" (expiry) columns blank, regardless of whether a delivery has already been recorded for that order. The data is already being fetched — `order.order_lines[].delivery_batches` (from `ORDER_SELECT` in `src/lib/api/orders.js`) — it's just never read when building the PDF rows. So reprinting the PDF for e.g. CK-2609-006 after today's partial delivery still shows blank delivery columns instead of what was actually delivered.

Confirmed: delivery quantities are recorded in cartons (`DeliveryLineRow` in `OrdersDashboard.jsx` caps `q1`/`q2` against `l.cartons_ordered`), same unit as the existing "Karton" column, so no unit conversion is needed.

## Plan
- [ ] In `drawOrderPage()`'s row-building loop (around line 57-62 of `workOrderPdf.js`), for each order line find its `delivery_batches` entries with `batch_no === 1` and `batch_no === 2`
- [ ] Fill "Dihantar 1"/"Dihantar 2" with that batch's `qty` (cartons) if it exists, else blank (not yet delivered — matches today's behavior for undelivered lines)
- [ ] Fill "Luput 1"/"Luput 2" with that batch's `expiry_date` formatted via the already-imported `fmtDate`, else blank
- [ ] No changes needed anywhere else — `order.order_lines[].delivery_batches` is already fetched by every code path that calls `downloadOrderPdf`/`downloadBatchPdf` (both take an already-loaded `order`/`orders` array), so reprinting after a delivery naturally picks up the latest data with no new fetch required

## Verification
- [x] Rebuilt clean
- [x] Fetched the real order CK-2609-006 (a genuine partial delivery, exactly the case the user described) and simulated the exact row-building logic against it: a 2-of-5-cartons-delivered line correctly shows "2" + its expiry date, a fully-delivered 5-of-5 line shows "5" + expiry, and an undelivered line stays blank on both batches — matches expectations exactly
- [x] No regression: undelivered lines/orders render identically to before (blank columns), since `drawOrderPage()` is the one shared function used by both `downloadOrderPdf` and `downloadBatchPdf` — the fix applies to both automatically, no separate change needed

## Review

One-line-of-cause fix: `drawOrderPage()` in `workOrderPdf.js` builds each order line's PDF row but was hardcoding the delivery columns to `''` instead of reading `l.delivery_batches`, which every caller already fetches. Now it looks up batch 1/2 by `batch_no` and fills in the recorded cartons + expiry when present, leaving it blank when not — so reprinting an order's PDF after recording a delivery reflects it automatically, with zero new data fetching and no change needed to either `downloadOrderPdf` or `downloadBatchPdf` since both funnel through this one function. Verified against a real order with a genuine partial delivery rather than synthetic test data.
