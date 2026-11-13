# Todo — Penghantaran Extra (buffer stock) linked to the latest order

Operator records items CK sent without an order. They knock off the outlet's outstanding quantity (latest order first, then older); only cartons beyond everything owed become extra (charged at normal price). Dashboard card counts outlets that received extra (buffer beyond orders + Dihantar Lebih). Full design: approved plan (allocation rule, `recompute_order`, `record_buffer_delivery`, `remove_buffer_batch`).

## Steps
- [x] 1. This checklist
- [x] 2. Baseline recorded: 33 orders, sum of totals RM 59,711.14; 10 over-delivered lines in 6 real orders (would add RM 4,727.34 if charged)
- [x] 3. `supabase/buffer_delivery_setup.sql` (+ mirror in `schema.sql`) written; backfill split into OPTIONAL `buffer_delivery_backfill.sql` because it would re-charge 6 real past orders (RM 4,727.34)
- [x] 4. USER ran buffer_delivery_setup.sql (2026-11-04); pre-SQL snapshot taken first
- [x] 5. Verified: after setup SQL, 33 orders, RM 59,711.14, 0 orders or lines changed (backfill NOT run; user decision pending)
- [x] 6. API (`orders.js`) + helpers (`orderStatus.js`: `extraCartons`, `hasExtra`, `bufferQty`)
- [x] 7. `BufferDeliveryModal.jsx` + "+ Penghantaran Extra" button + link inside expanded order
- [x] 8. `OrdersDashboard.jsx`: new card, panel changes (buffer batches + Remove, extra lines, Mark-all fix), Extra tag, CSV columns; `OperatorHome.jsx` passes products
- [x] 9. Outlet `MyOrders.jsx` labels, `workOrderPdf.js` remarks, i18n (en + ms)
- [x] 10. Lint + build clean; live tests 34/34 passed on sandbox MBG034 (knock-off order, Dihantar Lebih, extra line, removal, rules, all-or-nothing, normal delivery, permissions); cleaned up, zero residue vs snapshot
- [x] 11a. Review written; committed (4c6a1ee)
- [x] 11b. Pushed 2026-11-05 (43e956a); live bundle confirmed

## Review

- **What changed:** operators can record items CK sent without an order (Penghantaran Extra). Cartons knock off what the outlet still owes for that product (latest order first, then older); only the part beyond what is owed is extra, charged at the normal carton price on the outlet's latest order (Dihantar Lebih if the product is on it, otherwise a new extra line with ordered 0). Over-delivery from the normal form is now charged too. New dashboard card counts outlets receiving extra; entries can be removed again; outlet order view and work-order PDF show the extras.
- **Database:** buffer_delivery_setup.sql (run 2026-11-04); rollback_buffer_delivery.sql kept for reversal; optional buffer_delivery_backfill.sql would add RM 4,727.34 across 6 past orders (decision with the user).
- **Tested:** 34/34 live checks on sandbox MBG034, zero residue; existing orders/totals identical to the pre-SQL snapshot.
- **Notes:** knock-off is decided at entry time only; the extra is always attached to the latest order not dated after the delivery.

---

# Todo — Raw materials upgrade: costing, product-line filter, dedicated tab (2026-11-04)

Approved plan: cost per unit of use on raw materials; filter by product line + single product; new "Raw Materials" tab that also holds the Material Plan (moved out of Production); recipe cost per finished product. (Penghantaran Extra items above are still pending the user running their SQL.)

## Steps
- [x] A1. Checklist
- [x] A2. `supabase/raw_material_costing_setup.sql` (unit_cost, product_line, `set_raw_material_cost`, `set_product_line`, seed lines) + mirrored in `schema.sql`
- [x] A3. USER ran the SQL (2026-11-04). Must be done BEFORE this front-end is pushed
- [x] A4. API: `materials.js` (unitCost, setRawMaterialCost), `products.js` (product_line, setProductLine)
- [x] A5. `recipeCost.js` (+ export `neededForLine`), cost card in `RecipeModal.jsx`
- [x] A6. `RawMaterialsTab.jsx` (filters, list with cost columns, Material Plan moved in); `OperatorHome.jsx` tab (hidden for halal); remove plan from `Production.jsx` and list from `Catalogue.jsx`
- [x] A7. Catalogue product form: Product line field
- [x] A8. Lint + build clean; recipeCost hand-checked; live RPC tests 12/12 passed (set/clear/negative/unknown, trim/clear line, outlet refused, Cashew 107.50 per carton, Nuttybites 12 materials, Cashew 3); test values restored
- [x] A9a. Review written; committed
- [x] A9b. Pushed 2026-11-05 with the others; live

## Review (A)

- **What changed:** raw materials now have a cost per unit of use (e.g. RM 2.98 per kg), products have a product line, and there is a dedicated Raw Materials tab (hidden for halal) with Product line + Finished product filters, a cost-to-make card per product (per unit and per carton, flagged incomplete when a material has no cost), and the Material Plan moved in from Production.
- **Database:** raw_material_costing_setup.sql (run 2026-11-04); rollback_raw_material_costing.sql drops it again (typed costs/lines would be lost). All 12 materials start with no cost; nothing invented.
- **Tested:** 12/12 live checks (set/clear/negative/unknown, trim/clear line, outlet refused, Cashew RM 107.50 per carton), values restored; lint + build clean.
- **Notes:** costs are current prices only (no history). Halal role can still read costs through the API; only the tab is hidden.


---

# Rollback safety net (2026-11-04)

Before the user runs the two setup SQL files:
- [x] R1. Read-only snapshot of orders, order_lines, delivery_batches, products, raw_materials (33 orders, RM 59,711.14, matches baseline) saved in the session scratchpad as `pre_sql_snapshot.json` (script: gitignored `scripts/private/snapshot.mjs`)
- [x] R2. `supabase/rollback_raw_material_costing.sql` (drops 2 functions, constraint, 2 columns; typed costs/lines are lost)
- [x] R3. `supabase/rollback_buffer_delivery.sql` (one transaction: remove buffer batches/extra lines, re-price lines to ordered x price, recompute completion for affected orders, restore previous `record_delivery`, drop buffer functions/columns, restore original constraints)
- [x] R4. Both setup files run; live tests done; totals identical to snapshot

Rollback phrases: "Roll back raw material costing" / "Roll back Penghantaran Extra" / "Roll back the last push" (Netlify > Deploys > previous deploy > Publish deploy, or git revert).

---

# Todo — Automatic raw material codes + universal carton box (2026-11-05)

Approved plan: new raw materials get their code automatically; ONE shared "Carton Box (universal)" at RM 1.64 per pcs used at 1 per carton in P05/P06/P07/P08 and P03 (Kuah Rojak 490g), replacing the four separate boxes.

## Steps
- [x] U1. Checklist
- [x] U2. Auto code in the Add raw material form (`RawMaterials.jsx`, `RawMaterialsTab.jsx`); check the logic on a few cases
- [x] U3. `supabase/universal_carton_box_setup.sql` + `supabase/rollback_universal_carton_box.sql`
- [x] U4. Read-only preview of the recipe lines that will change + fresh snapshot
- [x] U5. Lint + build
- [x] U6. USER ran universal_carton_box_setup.sql (2026-11-05)
- [x] U7. Read-only verification passed (one universal box RM 1.64, 5 recipes at 1 per carton, 0 old boxes, P03 box-only recipe); user to eyeball the tab
- [x] U8a. Review written; committed
- [x] U8b. Pushed 2026-11-05; live

## Review (U)

- **What changed:** new raw materials get their code automatically (RM-001, RM-002, ...; existing RM-BOX-xxx style codes ignored; locked when editing). The four separate outer boxes were replaced by ONE "Carton Box (universal)" at RM 1.64 per pcs, used at 1 per carton in Almond, Cashew, Mix, Pistachio and Kuah Rojak 490g (which got a box-only recipe).
- **Database:** universal_carton_box_setup.sql run 2026-11-05 (data only); rollback_universal_carton_box.sql kept for reversal.
- **Checked:** auto-code logic on 5 cases; lint + build clean; live data verified read-only afterwards (9 materials, 0 old boxes, 5 recipes on the new box, Cashew RM 37.64 per carton).
- **Notes:** the Cashew box line was 0.03 per unit (0.9 box per carton) and is now 1 per carton. Kuah Rojak shows RM 1.64 per carton (box only) until its other ingredients are added.


---

# Todo — Delivery staff role (2026-11-06)

Approved plan: new `delivery` role with a simple screen (outlet -> products/cartons/expiry -> one photo per outlet drop -> confirm), oldest-order-first knock-off with extras marked, corrections limited to the current Mon-Sun week for staff (operators/admins/HMS any time), Excel + PDF delivery log. Plan file: `.claude/plans/should-we-disable-the-radiant-dragonfly.md`.

## Steps
- [x] D1. Checklist
- [x] D2. Fresh read-only snapshot (post-backfill)
- [x] D3. `supabase/delivery_staff_setup.sql` (role, `delivery_drops`, batch columns, RPCs, private photo bucket) + `rollback_delivery_staff.sql`; mirror in `schema.sql`
- [x] D4. USER ran delivery_staff_setup.sql (2026-11-06)
- [x] D5a. Edge Function `create-user` accepts role `delivery` (code done)
- [x] D5b. USER redeployed the Edge Function (verified: accepts role delivery)
- [x] D6. Front-end data layer: `api/deliveries.js` (RPCs, photo compress/upload, signed URLs), `deliveryReport.js` (Excel + PDF), `orderStatus.js` bufferQty widened
- [x] D7. Staff UI `pages/delivery/DeliveryHome.jsx` (new delivery wizard, this week, report), App.jsx routing/role homes, Users form role option, operator Deliveries tab, i18n
- [x] D8. Lint + build
- [x] D9. Live tests 63/63 passed (real Edge Function login, oldest-first knock-off, extras marked, corrections, week lock, role isolation, private photos); cleaned up, zero residue vs snapshot
- [x] D10. User tested; review written; committed fa3da9c and pushed 2026-11-06; live bundle confirmed

## Review (D)
(to be filled in at the end)

## Pre-push hardening (2026-11-06)
- [x] H1. Found: completion date moved forward by later extra deliveries (live bug in `recompute_order`; seen on sandbox order CK-2610-023). Fixed in `delivery_staff_setup.sql` (also `buffer_delivery_setup.sql`, `schema.sql`)
- [x] H2. Reports could silently stop at 1000 rows (server cap): `listDeliveries` now pages; stable ordering in `list_deliveries`
- [x] H3. Two phones saving for the same outlet at once: per-outlet advisory lock in `record_staff_delivery` / `correct_delivery_entry`
- [x] H4. Indexes on `delivery_drops`; cap of 60 products per delivery; photo file names restricted to `<uuid>.jpg`
- [x] H5. Photo compress fallback for older iPhones; stale-response guard in the log; Excel/PDF code loaded only when asked (main bundle 325 -> 309 kB gzip)
- [x] H6. USER re-ran `delivery_staff_setup.sql` (2026-11-06)
- [x] H7. Re-tested 29/29: completion date kept, two phones at once (owed cartons knocked off once), 1,500+ rows paged (server cap of 1000 confirmed; ~190 ms/page), 13-product save 255 ms, correction 48 ms, bucket name rules, regression; cleaned up (counts back to before the test)

---

# Todo — Delivery staff: gallery photos + deliveries with no order (2026-11-12)

Approved plan: gallery photo choice; a delivery for an outlet with no order auto-creates an extra order (charged at carton price, one per outlet per day); same for the operator's Penghantaran Extra button. Plan file: `.claude/plans/should-we-disable-the-radiant-dragonfly.md`.

## Steps
- [x] G1. Checklist; roadmap saved to memory
- [x] G2. Read-only snapshot
- [x] G3. SQL in `delivery_staff_setup.sql` (+ `schema.sql` mirror, rollback update): `orders.auto_extra`, `_extra_target_order`, staff allocator, operator buffer function, correct cleanup, recompute completed date
- [x] G4. Front-end: gallery button; "new order created" notes; "No order" tag; `auto_extra` in order select; i18n
- [x] G5. Lint + build
- [ ] G6. USER re-runs `delivery_staff_setup.sql`
- [ ] G7. Live tests on a disposable outlet; clean up; compare to snapshot
- [ ] G8. User tries it; review, commit; push only after separate go-ahead

## Review (G, round 2 and 3)

- **What changed:** (1) delivery staff can choose a photo from the gallery as well as the camera; an operator/admin can switch that off and on for all staff (HMS, staff and outlet logins cannot); (2) a delivery to an outlet with no order auto-creates an extra order (CK-YYMM-### number, flagged auto_extra, charged at carton price, one per outlet per day, tagged No order on the dashboard), for the staff screen and the operator Penghantaran Extra button; (3) before saving, staff get a pop-up (Item ini dihantar lebih/ekstra tanpa order dari outlet) listing extra or unordered items, powered by a read-only preview in the database.
- **Database:** delivery_staff_setup.sql re-run 2026-11-12 (sections 8-11 are new); rollback_delivery_staff.sql restores the original operator functions; schema.sql mirror regenerated.
- **Tested:** 39 live checks on disposable outlets; no test data left; tests returned the order numbers they used.
- **Notes:** the gallery switch hides the button but the server cannot tell camera from gallery photos; an auto order consumes a real order number and appears in the outlet's My Orders; the earlier test run of N13 used a product that was owed, so it was re-run correctly.


## Round 3 additions (2026-11-12): gallery switch + "dihantar lebih/ekstra" pop-up
- [x] R1. SQL section 10 (gallery switch, operator/admin only) + section 11 (`preview_staff_delivery`) in `delivery_staff_setup.sql`; rollback + schema mirror
- [x] R2. `api/deliveries.js` (3 functions); `DeliveryHome.jsx`, `NewDelivery.jsx` (switch + pre-save pop-up), operator `Deliveries.jsx` switch card; i18n
- [x] R3. Lint + build
- [x] R4. USER re-ran `delivery_staff_setup.sql` ONCE (covers the earlier no-order work too)
- [x] R5. Live tests 39/39 (gallery switch + who can change it, preview rules incl. cancelled order / no order / mixed lines, preview writes nothing and matches the save, no-order auto orders: one per outlet per day, new day new order, correction/removal clean-up, operator button with and without orders, dashboard query); order-number counter restored; no test data left
- [x] R6. User tested (gallery, extra pop-up, switch); MBG034 sandbox cleared; committed 53f55b1 and pushed 2026-11-12; live bundle confirmed

---

# Todo — Pengeluaran tab: one printable sheet per product (2026-11-13)

Approved plan: click a product name in the Production tab to download its own A4 sheet: outlet | qty originally ordered | 4 blank Hantar columns (pre-filled with deliveries already recorded, one date per column) | big bold total of cartons still to produce. One row per outlet. Order-date range on screen drives the table, the summary PDF and the sheets. No database change. Plan file: `.claude/plans/should-we-disable-the-radiant-dragonfly.md`.

## Steps
- [x] P1. Checklist
- [x] P2. `src/lib/productionSheets.js` (`productSheet`) + hand-worked check
- [x] P3. `downloadProductSheetPdf` in `src/lib/productionPdf.js`; sample PDFs (made-up + live data) inspected
- [x] P4. `Production.jsx`: order-date range (smart default), clickable product names; i18n; lint + build
- [x] P5. User tried it; committed and pushed 2026-11-13

## Review (P)

- **What changed:** each product name in the Pengeluaran tab downloads its own A4 sheet: outlet | qty originally ordered | four blank Hantar columns (pre-filled with recorded deliveries, one date per column, a + marker when there are more than four dates) | large bold total of cartons still to produce. One row per outlet. A From/To order-date range (default: last 30 days, stretched back to the oldest open order) drives the table, the summary PDF and all sheets; cancelled orders are always left out.
- **No database change.** New files: productionSheets.js (calculation), productSheet PDF in productionPdf.js; Production.jsx and i18n updated.
- **Checked:** 11 hand-worked cases pass (two orders per outlet, over-delivery on one order not hiding a shortfall on another, extra-only outlet, cancelled orders, same-day batches, >4 delivery dates); sample PDFs inspected as images (38 outlets, long names, page breaks); live data for one product matched the Production tab row exactly (ordered 136, delivered 98, balance 68).
- **Notes:** the big total is the balance, as chosen; deliveries recorded after printing do not appear on an already printed sheet; changing the range changes the table numbers (it used to be all-time).

