# Todo — Build HMS (Halal Management System)

Design reference: `tasks/hms-plan.md` (finalized 2026-09-25). This file is the step-by-step build checklist derived from it. Resume tonight, step by step — don't skip ahead.

## Phase 0 — DONE
- [x] Email: raihan.mbg@gmail.com
- [x] Name: Raihan
- [x] Password: 0167940280 — I create the auth user directly (service role), not the dashboard this time
- [x] Bilingual labels: keep the document's exact compound wording (e.g. "TARIKH PRODUCTION / PRODUCTION DATE") regardless of the language toggle

## Phase 1 — Schema (`supabase/hms_setup.sql` + mirror in `schema.sql`) — WRITTEN, needs to be run
- [ ] `alter table user_profiles drop constraint user_profiles_role_check` (or find its actual name), re-add allowing `role in ('outlet','operator','admin','halal')`
- [ ] Update `is_operator()`: `role in ('operator','admin')` → `role in ('operator','admin','halal')` — this alone makes every existing operator RLS policy/RPC work for her, no per-feature changes
- [ ] `hms_forms` (id, code unique e.g. `HM9-F4b`, name, version, display_order, active, products jsonb, materials jsonb — empty arrays for the two open-ended fields = Seasonal & R&D)
- [ ] `hms_submissions` (id, form_id → hms_forms, work_date date, status text check in ('submitted','nil'), production_date, product_weight, products jsonb, materials jsonb, sensory jsonb, packing_date, product_expiry_date, total_pcs, total_ctn, prepared_by, checked_by, submitted_at timestamptz not null default now(), submitted_by, updated_at; unique (form_id, work_date))
- [ ] `hms_holidays` (date primary key, name)
- [ ] RLS on all 3: SELECT for operators only (`is_operator()`), no direct client writes
- [ ] RPCs (`SECURITY DEFINER`, `is_operator()` check, matching `upsert_product`'s pattern):
  - [ ] `submit_hms_form(p_form_id, p_work_date, p_payload jsonb)` — inserts with `submitted_at = now()` (server-side, never client-supplied — this is what proves on-time/late); rejects if a submission already exists for that form+date (mirrors the stock-report lock)
  - [ ] `mark_hms_nil(p_form_id, p_work_date)` — same insert, `status = 'nil'`, no payload
  - [ ] `update_hms_submission(p_id, p_payload jsonb)` — corrects an already-submitted record's content **without** touching `submitted_at`, so fixing a typo can't retroactively change on-time/late status
  - [ ] `reopen_hms_submission(p_id)` — deletes a submission so it can be redone (mirrors `reopen_stock_report`; use sparingly, this does reset the on-time record for that day)
  - [ ] `upsert_hms_holiday(p_date, p_name)`, `delete_hms_holiday(p_date)`
- [ ] Seed the 5 `hms_forms` rows with their exact product/material lists — **use the lists below verbatim** (pulled directly from cell values in `reference/hms/HMS DAILY.xlsx`, not retyped from memory, so there's no transcription drift):

  **HM9-F4b — Simple Juice** (22 fixed SKUs + 1 open "Seasonal" slot in the same grid)
  Products: SJ01, SJ02, SJ03, SJ04, SJ05, SJ06, SJ07, SJ08, SJ09, SJ10, SJ11, SJ12, SJ13, SJ14, SJ15, SJ16, SJ17, SJ18, SJ19, SJ20, SJ21, SJ22, SEASONAL
  Materials (27): AIR/WATER, GULA/WHITE SUGAR, WATERMELON, GUAVA, GREEN APPLE, RED APPLE, RED DRAGON, MANGO, ORANGE, LEMON, PINEAPPLE, CARROT, GINGER, BEETROOT, KIWI, GRAPE, PASSION FRUIT, BANANA, PERSIMMON, STRAWBERRY, PEAR, POMEGRANATE, SIRAP, GREEN TEA, RED TEA, SUSU CAIR, SUSU PEKAT

  **HM9-F4c — Dipping (Sauce & Powder)**
  Products (10): SERBUK ASAM BOI ORI 1KG, SERBUK ASAM BOI PEDAS 1KG, SWEET CHILI 1KG, SERBUK ASAM BOI ORI 150G, SERBUK ASAM BOI PEDAS 120G, SOS ASAM BOI TONG, SOS ASAM BOI BOTOL 250G, KUAH ROJAK ORI 490G, KUAH ROJAK GALLON 10L, KUAH ROJAK PENANG
  Materials (16): AIR/WATER, GULA/WHITE SUGAR, GARAM/SALT, PLUM POWDER, CHILI FLAKES, ASAM BOI (PRESERVED FRUIT), ICING SUGAR, RED CHILI, KICAP PEKAT/THICK SOY SAUCE, PETIS, BELACAN, GULA PERANG/BROWN SUGAR, KICAP MANIS UDANG/SWEET SOY SAUCE, CILI GILING, BIJAN, KACANG HANCUR

  **HM9-F4d — Re-Packing**
  Products (4): NUTTYBITES ALMOND, NUTTYBITES CASHEW, NUTTYBITES PISTACHIO, NUTTY BITES MIX
  Materials (4): ROASTED ALMOND, ROASTED CASHEW, ROASTED PISTACHIO, ROASTED MIX NUT
  (source spells "cashew" as "CAHSEW" in one cell — using the corrected spelling here; flag to user if the exact source spelling should be preserved instead)

  **HM9-F4e — Cut Fruits**
  Products (3): CUT FRUITS, CUT FRUITS + ROJAK PENANG SAUCE, CUT FRUITS + SERBUK ASAM ORI
  Materials (28): STRAWBERRY, PEAR, POMEGRANATE, GUAVA, GREEN APPLE, RED APPLE, RED DRAGON, MANGO, ORANGE, LEMON, PINEAPPLE, CARROT, GINGER, BEETROOT, KIWI, GRAPE, PASSION FRUIT, BANANA, PERSIMMON, HONEY DEW, ROCK MELON, HAMI MELON, CUCUMBER, PAPAYA, SUNGOLD MELON, SERBUK ASAM BOI ORI, SERBUK ASAM BOI PEDAS, KACANG HANCUR

  **HM9-F4f — Seasonal & R&D**
  Products: [] (open-ended, typed in each time)
  Materials: [] (open-ended, typed in each time)
  Sensory sign-off label is "R&D" instead of "LD/QA" on this form only — form definition needs a field for this label override.

## Phase 2 — Malaysia-time status logic — DONE
- [x] `src/lib/hmsTime.js`: `todayMYT`, `deadlineUtc`, `isWeekend`, `isWorkingDay`, `hmsStatus` — pure functions, fixed UTC+8 offset, no timezone library needed
- [x] Hand-checked against 8 worked examples (16:58 MYT → on_time, 17:00 MYT → late, late-in-the-day still "late" not "missed", a genuinely past day with nothing submitted → missed, today before/after the deadline with nothing submitted → pending either way, weekend/holiday take priority over everything) — all correct

## Phase 3 — API layer — DONE
- [x] `src/lib/api/hms.js`: all 9 functions written, builds clean
- [x] Verified live end-to-end: submitted a real test record (Re-Packing, 2026-09-01), confirmed the duplicate-submission guard rejects a second attempt, marked nil for Cut Fruits/same date, tested holiday upsert+delete, confirmed an outlet account gets an empty result (not an error) from every `hms_*` table — RLS correctly blocks them
- [x] Cleaned up both test submissions via `reopen_hms_submission`, confirmed gone

## Phase 4 — Frontend UI (`src/pages/operator/hms/`) — DONE
- [x] `HmsForm.jsx` — generic renderer; fixed lists (Simple Juice, Dipping, Re-Packing, Cut Fruits) show every product/material with an input; Seasonal & R&D (empty lists) shows free-add rows instead; sensory block uses each form's own `qa_label` (LD/QA vs R&D); all labels are the document's exact bilingual wording, hardcoded (not run through `t()`), per the confirmed decision
- [x] `HmsToday.jsx` — date picker (defaults to today MYT), one card per form with status chip + Fill/No-production-today/Edit/Reopen actions depending on state
- [x] `HmsHistory.jsx` — month picker, dot-grid (forms × days of month), month totals (on-time/late/missed counts + on-time %)
- [x] `HmsHolidays.jsx` — add/remove holiday dates
- [x] `Hms.jsx` — container with internal Today/History/Holidays sub-tabs (reuses `Tabs`), fetches the 5 forms once
- [x] `OperatorHome.jsx`: added `hms` tab; default tab = `hms` when `profile.role === 'halal'`, unchanged otherwise
- [x] Bilingual labels kept exactly as the document wrote them, unsplit, regardless of language toggle (confirmed decision)

## Phase 5 — Provisioning — DONE
- [x] Generalized `provision_users.mjs`'s single `OPERATOR` object into a `STAFF` array (role/email/password/fullName), so non-outlet logins have a home without forcing an outlet shape on them
- [x] Created Raihan's auth user + `user_profiles` row (`role = 'halal'`)
- [x] Verified live: she logs in, profile shows `role: 'halal'`, and — since `is_operator()` now covers `halal` — she can already read `hms_forms` and `products` with zero extra RLS work, confirming the "treated as operator everywhere" design actually holds

## Phase 6 — Verification — DONE
- [x] Rebuilt clean after every phase, not just at the end
- [x] Hand-checked `hmsTime.js` against 8 worked examples (see Phase 2)
- [x] Live test as Raihan: submitted a fixed-list form (Re-Packing), rejected a duplicate submit, marked nil for a different category, tested holiday add/remove, reopened both and confirmed removal
- [x] Live test of the exact open-ended payload shape `HmsForm.jsx` produces (Seasonal & R&D, free-typed product+material) — RPC accepted and stored it correctly; reopened and confirmed removed
- [x] Unit-tested `buildPayload`/`initFromForm` directly: fixed-list blank init, filtering to only filled rows, and round-tripping a saved submission back into edit state all produce correct results
- [x] Confirmed outlets get an empty result (not an error) from every `hms_*` table
- [x] `is_operator()` already covered `operator` before this change and is untouched for that role — only `halal` was added — so the operator account's access is unaffected by construction, not just by inference
- [x] All test data cleaned up — nothing left in `hms_submissions`/`hms_holidays`

## Review

Built in the order planned: schema (5 forms seeded verbatim from the Excel review) → Raihan's login → Malaysia-time status logic → API layer → UI (generic form renderer + Today/History/Holidays) → verification at every step, mostly via live RPC calls and pure-function unit tests rather than a browser (the Browser pane tool was unavailable all session).

**Design note vs. the original plan:** "only shows forms that need attention today" turned out to be unnecessary to build — `HmsToday.jsx` simply always shows all 5 forms for the selected date with a `pending` chip until she acts (fill or mark nil). There's no way to know in advance which categories will produce, so this is simpler and equivalent to what was planned.

**Known gaps, not fixed in this pass:**
- Not click-tested in an actual browser — logic verified via direct API/RPC calls and extracted pure-function tests instead. Worth a manual pass once deployed.
- Reopen/undo use a plain browser `confirm()` dialog, not the custom modal style used elsewhere in the app (e.g. Stock Tracker's reopen confirmation) — functional, just less polished. Left as-is per "keep changes minimal."
- The flagged-earlier UTC-vs-Malaysia-time issue in `is_stock_window_open()` (unrelated pre-existing code) is still unfixed — separate task.

Nothing has been committed or pushed yet.

## Post-deploy bug fix (2026-09-27)

User reported: clicking Today → Holidays → History blanked the whole portal, needing a manual refresh. Console showed `Uncaught TypeError: l is not a function` inside React's internal effect-cleanup code, with no readable source location (minified, no sourcemap).

Root cause, found by fetching the live deployed bundle and reading the exact bytes around the crash: `HmsHolidays.jsx`'s `refresh` was written as a concise-body arrow function — `const refresh = () => listHmsHolidays().then(...)` — so calling it returns the `.then()` chain's Promise instead of `undefined`. `useEffect(refresh, [])` handed that Promise to React as if it were the effect's cleanup function; React tried to call it when `HmsHolidays` unmounted (switching to History), and a Promise isn't callable. Fixed by wrapping the body in `{ }` so it returns nothing, matching the same pattern already used safely in `HmsToday.jsx` and the pre-existing `StockTracker.jsx`. Searched the rest of the codebase for the same concise-arrow-into-useEffect shape — no other instances found.
