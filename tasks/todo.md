# Todo — out-of-stock remark in Penjejak Stok (2026-09-25)

## Problem
When a product is out of stock (qty = 0), Penjejak Stok's expiry column should show the report's submission date as a remark instead of being blank — but today, category-1 items are forced to have *some* expiry typed in even at qty 0 (validation checks "qty entered", not "qty > 0"), so the remark would rarely have anything to attach to. Fixing both together.

## Plan
- [x] `src/components/StockReportForm.jsx`: changed `expiryRequired` check from "qty entered" to "qty > 0" (new `hasStock` helper) — no more forcing an expiry for a zero-quantity line (affects both the outlet's own form and the operator's manual-entry modal, since both use this shared component)
- [x] New i18n keys (`en`/`ms`): `unitsOutOfStock` (on-screen, includes qty) and `outOfStockRemark` (CSV, no qty since that column already exists) — deliberately not reusing "exp {date}" wording, since that would misread as a real expiry
- [x] `src/pages/operator/StockTracker.jsx`: new `lineText` helper — when a batch's qty is `0` and it has no expiry, shows the remark using that report's `submitted_at` instead of blank; used in both batch-1 and batch-2 display
- [x] Same logic (`csvExpiry` helper) applied to `exportCsv`, so the downloaded CSV matches what's shown on screen

## Verification
- [x] Rebuilt clean
- [x] Tested live on a genuinely outstanding outlet (AEON Taman Maluri, never touched any of the 20 real September submissions that already exist): submitted qty=0 for both a category-1 and category-2 product with no expiry — succeeded (the RPC itself never enforced the expiry-required rule, only the client did, so this was purely a client-side fix)
- [x] Fetched the submission back exactly as `listStockReports` would and simulated the exact display logic against that real data: qty=0/no-expiry correctly produces "0 units · out of stock (reported 25 Sept 2026)"; qty>0/real-expiry and qty>0/no-expiry (category 2) both produce unchanged output
- [x] Cleaned up the test submission via reopen — confirmed gone, outlet back to outstanding

## Review

Two small, contained changes: `StockReportForm.jsx`'s required-expiry check now looks at quantity > 0 instead of "was anything typed", so a zero-quantity line never needs a fabricated expiry date (in both the outlet's form and the operator's manual-entry modal, since they share this component). `StockTracker.jsx` then shows/exports a plain-language remark ("Out of stock, reported {date}") instead of a blank cell whenever a batch has zero quantity and no expiry, using the report's own submission date rather than inventing one.

Verified end-to-end on a real outlet that hadn't submitted yet this month, then cleaned up immediately — 20 other outlets already have genuine September submissions now that ordering is live, none of which were touched.

