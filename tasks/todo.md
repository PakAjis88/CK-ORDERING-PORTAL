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
- [ ] 11b. Push only after separate go-ahead; confirm deploy

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
- [ ] A9b. Push only after separate go-ahead; confirm deploy

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
