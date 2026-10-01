# Todo — Raw Material Planning, starting with Nuttybites

Full design + confirmed real recipe data: see the approved plan (also mirrored below). Build step by step, mark off as we go.

## Confirmed data
| Code | Product | Raw nut/carton | Batch yield | Pouch | Outer box |
|---|---|---|---|---|---|
| P05 | Almond 30G | 10kg Roasted Almond | 330 | Almond Pouch 30g | Almond Outer Box |
| P06 | Cashew 30G | 10kg Roasted Cashew | 330 | Cashew Pouch 30g | Cashew Outer Box |
| P07 | Mix 40G | 10kg Roasted Mixed Nut | 245 | Mix Pouch 40g | Mix Outer Box |
| P08 | Pistachio 30G | 10kg Roasted Pistachio | 330 | Pistachio Pouch 30g | Pistachio Outer Box |

Every product: nut = per-carton basis, pouch = per-unit basis, box = per-carton basis. Nothing shared between flavors.

## Phase 1 — Schema (`supabase/raw_materials_setup.sql` + mirror in `schema.sql`) — DONE
- [ ] `raw_materials`: id, code (unique), name, unit (kg/pcs), pack_size, stock_on_hand (default 0, ≥0), active, created_at
- [ ] `product_recipes`: product_id (PK → products), batch_yield (>0)
- [ ] `product_recipe_lines`: product_id, raw_material_id, qty (>0), basis (`batch`/`unit`/`carton`), unique (product_id, raw_material_id)
- [ ] RLS on all 3: operator-only SELECT (`is_operator()`), no direct client writes
- [x] RPCs: `upsert_raw_material`, `set_raw_material_stock`, `save_product_recipe` — all `SECURITY DEFINER`, `is_operator()`-gated, matching `upsert_product`'s pattern
- [x] Seed data: 12 raw materials + 4 recipes inserted via code-based lookups (no hardcoded UUIDs)
- [x] Verified live: all 12 raw materials and 4 recipes read back correctly with the right qty/basis per line

## Phase 2 — Calculation logic — DONE
- [x] `src/lib/materialPlan.js`: pure function, no React — resolves each raw material's needed qty per line basis, aggregates across outstanding orders, computes shortfall + suggested buy, flags products with outstanding orders but no recipe
- [x] Hand-checked against real outstanding Cashew orders (7 real order lines, one already fully delivered and correctly excluded): expected 210kg nuts / 630 pouches / 21 boxes by hand, got exactly that from the function

## Phase 3 — API layer — DONE
- [x] `src/lib/api/materials.js`: `listRawMaterials`, `listProductRecipes`, `getProductRecipe`, `upsertRawMaterial`, `setRawMaterialStock`, `saveProductRecipe`
- [x] Verified live: `set_raw_material_stock` RPC works end-to-end (set to 50, confirmed, reset back to 0 — no leftover test data), outlet accounts get an empty result from `raw_materials` (RLS confirmed)

## Phase 4 — Frontend UI — DONE
- [x] `RecipeModal.jsx` (new file): batch yield + dynamic recipe lines (raw material dropdown, qty, basis select), pre-fills from an existing recipe via `getProductRecipe`
- [x] `RawMaterials.jsx` (new file): list with add/edit modal + inline stock-on-hand editing
- [x] `Catalogue.jsx`: added a "Recipe" button per product opening `RecipeModal`, and renders `RawMaterials` in a new section below the product list
- [x] `Production.jsx`: new "Material Plan" section — needed/on hand/shortfall/suggested buy table, "no recipe yet" warning banner, CSV export (reuses `downloadCsv`)
- [x] `OperatorHome.jsx`: loads `rawMaterials`/`recipes` alongside existing data, wires `refreshMaterials` through to both Catalogue (recipe + raw material saves) and Production
- [x] i18n: skipped for now — new UI uses plain English labels matching this round's scope (Nuttybites/internal tooling); can be bilingual-ized alongside a future product line if needed

## Phase 5 — Verification — DONE
- [x] Rebuilt clean after every phase; linter clean on every new/changed file (checked specifically given the real bug this caught in HMS)
- [x] Live-tested every RPC directly, not just read the seeded data: `set_raw_material_stock`, `upsert_raw_material` (create + edit, confirmed code is immutable on edit like products), `save_product_recipe` (create, then re-save to confirm it fully replaces the old lines rather than duplicating)
- [x] Full pipeline test against real live data: fetched exactly as the app does (`listRawMaterials`/`listProductRecipes`/orders), ran `materialPlan()`, confirmed correct needed/shortfall/suggested-buy for all 4 Nuttybites products including a surplus case (shortfall correctly capped at 0, not negative) and the "no recipe yet" warning correctly listing every other outstanding product
- [x] Confirmed outlets get an empty result from all 3 new tables (`raw_materials`, `product_recipes`, `product_recipe_lines`)
- [x] All test data (a disposable product, a disposable raw material, their recipe link, and temporary stock values on the real Cashew materials) fully cleaned up and confirmed gone

## Review

Built in the planned order: schema+seed → calculation → API → UI, verifying live at every step rather than at the end. The three-basis design (batch/unit/carton) held up well against real business data — the user's numbers were naturally per-carton (nuts, boxes) and per-unit (pouches), not per-batch, so nothing needed converting or fudging to fit the schema.

One thing resolved honestly rather than guessed: purchase pack sizes for all 12 new raw materials default to 1 (no rounding) since the real supplier pack sizes weren't available — confirmed with the user rather than inventing plausible-looking numbers that could have misled a real purchase decision. The operator can correct these via the Raw Materials screen once known.

Scope is deliberately narrow: only the 4 Nuttybites products have recipes. Every other product with outstanding orders shows up in the "no recipe yet" warning, by design — more product lines get added the same way, one at a time, whenever the user is ready.
