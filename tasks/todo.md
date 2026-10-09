# Todo — Extra delivery ("Dihantar Lebih")

Operator can record more cartons delivered than ordered; the line is marked **Dihantar Lebih +N** everywhere delivery is shown. No new column: extra is derived (`delivered > cartons_ordered`).

## Steps
- [x] 1. DB: `supabase/extra_delivery_setup.sql` — `record_delivery` drops the "exceeds cartons ordered" error; order completes only when EVERY line is delivered >= ordered. Mirrored in `schema.sql`. (Written; **user must run it in the SQL Editor**)
- [x] 2. Operator form (`OrdersDashboard.jsx`): no cap above ordered, violet "Dihantar Lebih +N" badge, CSV "Dihantar Lebih" column, outstanding never negative
- [x] 3. Outlet view (`MyOrders.jsx`): shows "Dihantar Lebih +N"
- [x] 4. Work order PDF (`workOrderPdf.js`): "Dihantar Lebih +N" under the product name
- [x] 5. Production balance (`orderStatus.js` `productionSummary`): per-line `max(0, ordered - delivered)`; hand-checked (10 ordered/13 delivered + 5 ordered/0 delivered gives balance 5)
- [x] 6. i18n (`i18n.jsx`): `lnExtra` in en + ms
- [x] 7. Verify: lint + build clean (only pre-existing warnings); SQL run by user; live RPC test on sandbox outlet MBG034 passed 8/8

## Review

Delivered quantity per line may now exceed the ordered quantity; the line is marked "Dihantar Lebih +N" on the operator form, outlet My Orders, work order PDF and the orders CSV. No new column: extra = delivered - ordered, derived.

Two knock-on problems were found by reading the code and fixed rather than just lifting the cap: (1) `record_delivery` judged completion on order-wide totals, so an extra on one line could mask a shortfall on another — now checked per line; (2) the Production balance was ordered - delivered per product across all orders, so an extra to one outlet would have cancelled another outlet's outstanding — now summed per line, floored at 0.

Live test (sandbox MBG034, 2-line order, all as real accounts): over-delivery accepted; order stays open while the other line is short; completes when every line is met; exact delivery still completes; lowering a line reopens it; outlet account is refused. The test order is left fully delivered (nothing outstanding). Throwaway script deleted.

No upper limit on the extra quantity (a typo is accepted but shown prominently and editable).

Follow-up (Sunway Giza, Asam Boi Pedas 1kg, ordered 1 / delivered 3 could not be keyed in): cause was that the front-end change had not been deployed yet (live bundle had no "Dihantar Lebih"; origin/main was still 203bf07), so the live form still clamped to the ordered quantity. Fix = commit + push so Netlify deploys it.
