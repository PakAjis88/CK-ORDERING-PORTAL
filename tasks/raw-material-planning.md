# Raw Material Planning, Phase 1

Status: **built 2026-10-01, scoped to the Nuttybites series (Almond/Cashew/Pistachio/Mix).** See `tasks/todo.md` for the full build record, confirmed recipe data, and verification notes. This file is kept as background/design reference. Not committed/pushed yet as of this status line — check `git log` for current state.

Every other product line (Simple Juice, Dipping, Cut Fruits, Seasonal) shows "no recipe yet" in the Material Plan until recipes are added for them, one line at a time, the same way Nuttybites was done.

## Goal
Show the operator how much of each raw material (ingredients and packaging) CK needs to buy to fulfil outstanding outlet orders.

## Decisions (confirmed with user)
- Recipes are **per cooking batch + yield** (e.g. 1 batch uses 20 kg peanuts and makes 100 jars)
- Portal **tracks CK's raw material stock on hand**, updated by the operator
- **Packaging included** (jars, bottles, pouches, labels, cartons)
- Demand = **firm orders only**: cartons ordered but not yet delivered, same basis as the Production tab. Forecasting is Phase 2, not now.

## Calculation (browser-side, no RPC)
For every non-cancelled order line with cartons still outstanding:
- remaining cartons = `cartons_ordered − delivered`
- units = remaining cartons × `units_per_carton_snapshot` (already on each order line)
- for each recipe line of that product, the amount needed depends on the line's basis:
  - **per batch** (ingredients): `units ÷ batch_yield × qty`
  - **per unit** (e.g. 1 jar, 1 label per jar): `units × qty`
  - **per carton** (e.g. 1 outer carton): `remaining cartons × qty`

Per raw material: **needed**, **on hand**, **shortfall** = max(0, needed − on hand), **suggested buy** = shortfall rounded up to whole purchase packs.

The per-line basis lets packaging be entered naturally ("1 jar per unit") instead of making the operator calculate "100 jars per batch" by hand, which would break silently whenever the batch yield changes.

Products with outstanding orders but **no recipe yet** are listed as a warning, so the plan never looks complete when it isn't.

## Checklist

**Schema** (new migration `supabase/raw_materials_setup.sql` + mirror in `schema.sql`)
- [ ] `raw_materials`: id, code (unique), name, unit (kg / g / L / ml / pcs), pack_size (> 0, in that unit), stock_on_hand (≥ 0, default 0), active, created_at
- [ ] `product_recipes`: product_id (PK → products), batch_yield (integer > 0, finished units per batch)
- [ ] `product_recipe_lines`: product_id, raw_material_id, qty (> 0), basis (`batch` / `unit` / `carton`), unique (product_id, raw_material_id)
- [ ] RLS enabled on all three, SELECT for operators only, no direct client writes
- [ ] Operator-only `SECURITY DEFINER` RPCs following the `upsert_product` pattern:
  - `upsert_raw_material(...)` (add/edit, including pack size)
  - `set_raw_material_stock(p_id, p_qty)` (quick stock update)
  - `save_product_recipe(p_product_id, p_batch_yield, p_lines jsonb)` (replaces the product's whole recipe in one call)

**Frontend**
- [ ] `src/lib/api/materials.js`: list raw materials, list recipes, and wrappers for the 3 RPCs
- [ ] `src/lib/materialPlan.js`: the pure calculation above (unit-testable, no React)
- [ ] Catalogue tab: "Recipe" button per product → modal with batch yield + lines (raw material, qty, basis)
- [ ] Catalogue tab: new "Raw Materials" section → list with add/edit and inline stock-on-hand update
- [ ] Production tab: new "Material Plan" section below the existing table → needed / on hand / shortfall / suggested buy, "no recipe" warning, CSV export
- [ ] `OperatorHome.jsx`: load raw materials + recipes alongside existing data and pass them down
- [ ] i18n keys (`en`/`ms`)

**Verification**
- [ ] Hand-check `materialPlan.js` against a small worked example (1 product, 1 batch recipe with an ingredient, a per-unit jar and a per-carton box)
- [ ] Live test with a disposable raw material + recipe on one product; confirm the plan numbers match the hand calculation using real outstanding orders
- [ ] Confirm outlets can't read or write any of the new tables (RLS) — call as an outlet account
- [ ] Clean up test data

## Not in Phase 1
- Forecasting from order history, safety stock, supplier lead times
- Automatically deducting raw material stock when production happens (the operator updates stock counts manually for now)
- Supplier/purchase order tracking
