# Halal Management System (HMS) tab — design finalized, ready to become a build checklist

Status: documents reviewed 2026-09-25 (`reference/hms/HMS DAILY.xlsx`, local-only, gitignored). All open design questions answered. Next step: turn this into a checklist in `tasks/todo.md` for final sign-off before any code, per `CLAUDE.md`.

## Context
CK's Halal Executive must complete a set of daily production/traceability records by **4:59pm, Mon–Fri**, and the owner needs to see at a glance whether each was **on time, late, or missed**. Today it's paper. The goal is an operator-side HMS tab where she fills each as a digital form, with the deadline enforced server-side.

## The document set
`HM9-F4b` through `HM9-F4f` — 5 sheets, **one identical template**, different product/material lists per category:

| Doc No | Category | Product codes | Raw material groups |
|---|---|---|---|
| HM9-F4b | Simple Juice | 22 fixed (SJ01–SJ22) + Seasonal | 27 fixed |
| HM9-F4c | Dipping (Sauce & Powder) | 10 fixed | 16 fixed |
| HM9-F4d | Re-Packing | 4 fixed (Nuttybites) | 4 fixed |
| HM9-F4e | Cut Fruits | 3 fixed | 26 fixed |
| HM9-F4f | Seasonal & R&D | **open** (typed in, not fixed) | **open** (typed in, not fixed) |

Every sheet has the same sections: production date + product weight → type of product (qty per SKU) → raw materials used (batch no + expiry date per material) → sensory test (Colour/Odour/Appearance/Taste, each checked by STAFF then LD/QA — "R&D" instead of "LD/QA" on the Seasonal sheet) → packing date → product expiry date → total output (pcs/ctn) → Prepared By / Checked By.

One generic form renderer, driven by each form's field definition, covers all 5 — no per-category screens.

## Confirmed decisions
- Product-code cells hold a **quantity produced**, not a checkbox.
- The Halal Exec fills the **entire form** herself (production details + both sensory columns).
- Most raw materials are **left blank on a normal day** — the form shows the full fixed list per category but only requires entries for what was actually used.
- A category only needs a submission on days it actually produced something.
- To make "nothing to report" distinct from "forgot": she gets a **"No production today"** button per category, alongside filling the full form — either one, done by the deadline, counts as settled (on time/late); neither by end of day counts as missed.
- Access: new `halal` role, treated as operator everywhere (`is_operator()` already covers any future role added the same way — needs one check to confirm; see build checklist), lands on the HMS tab first. Operator also sees the HMS tab, to monitor.
- All deadline/status logic runs in **Asia/Kuala_Lumpur**, not Supabase's default UTC.

## Data model (sketch)
- `hms_forms`: id, code (e.g. `HM9-F4b`), name, version, display_order, active, `products` (jsonb array of `{code, name}`, empty = open-ended), `materials` (jsonb array of `{name}`, empty = open-ended)
- `hms_submissions`: id, form_id, work_date, status (`submitted` | `nil`), production_date, product_weight, products (jsonb `[{code, qty}]` or free-typed `[{name, qty}]` for open-ended forms), materials (jsonb `[{name, batch_no, expiry_date}]`), sensory (jsonb per attribute: `{staff, qa, remarks}`), packing_date, product_expiry_date, total_pcs, total_ctn, prepared_by, checked_by, submitted_at (server-side `now()`, drives on-time/late — never client-supplied), submitted_by, updated_at; unique (form_id, work_date)
- `hms_holidays`: date, name — operator-maintained, excluded from "missed"
- RLS: operator-only (incl. `halal`) SELECT; writes via `SECURITY DEFINER` RPCs, matching the `upsert_product` pattern already in this schema

## UI
- **Today**: one card per category with fixed production that day (or all 5 if unsure which ran) — status chip (pending/on time/late/nil/missed) and a button to fill the form or mark nil
- **Form**: the generic renderer for one category + date — fixed categories show their full product/material lists with inputs; Seasonal & R&D lets her add product/material rows freely
- **History**: month grid, categories × working days, colour-coded, with month totals
- **Holidays**: operator adds/removes dates

## Flagged, unresolved for later
Existing UTC-based date logic elsewhere in the app (e.g. `is_stock_window_open()`) is off by up to 8 hours vs Malaysia time — separate fix, not blocking HMS.

## Next step
Turn this into a concrete checklist (schema files, RPCs, components, i18n) in `tasks/todo.md` and get final sign-off before writing any code.
