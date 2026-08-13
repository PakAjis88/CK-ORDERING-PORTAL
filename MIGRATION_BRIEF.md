# CK Products Ordering Portal — Migration Brief

Status: prototype validated in-chat (React, in-memory, single-file). This document
is the full spec for productionizing it. The working prototype is `ck-portal.jsx`
in this same output set — use it as the UI/behaviour reference; this brief is the
source of truth for the *rules* behind it.

## 1. Purpose

Web app for CK Products to collect and manage orders from 40 MBG outlets, and for
CK operators/production to track fulfillment and stock. Replaces a manual process.

## 2. Target stack

- Frontend: React (Vite)
- Backend/DB/Auth: Supabase (existing account: retailadmin.mbg@gmail.com — one
  project slot available, use it for this single project)
- Hosting: Netlify (already connected), auto-deploy from GitHub
- Repo: **new, private** GitHub repo, suggested name `ck-ordering-portal`
- Secrets: Supabase URL/anon key etc. go in **Netlify environment variables**,
  never committed to the repo

## 3. Roles & auth

Two roles, real per-user login (replacing the prototype's view-switcher):
- **Outlet** — one login per outlet (40 total)
- **Operator/Admin** — CK staff who manage fulfillment, stock tracking, exports

## 4. Product catalogue (final, confirmed)

Ordered by **carton**. Stock reported in **single units**. Order line value =
cartons × carton price, and this price is **snapshotted onto the order line at
the moment of ordering** — later price changes must never alter historical orders.

| ID | Name | Unit price (RM) | Units/carton | Carton price (RM) | Category |
|----|------|---:|---:|---:|---|
| P01 | Asam Boi Pedas 1Kg | 21.81 | 4 | 87.24 | 2 – Funfruits |
| P02 | Ck Sweet Spicy 1kg | 15.21 | 4 | 60.84 | 2 – Funfruits |
| P03 | Kuah Rojak (original) 490g | 5.21 | 12 | 62.52 | 1 – Dry & Nuts |
| P04 | MBG CK Kuah Rojak 10L | 150.01 | 1 | 150.01 | 2 – Funfruits |
| P05 | Nuttybites Roasted Almond 40G | 3.16 | 30 | 94.80 | 1 – Dry & Nuts |
| P06 | Nuttybites Roasted Cashew 40G | 3.05 | 30 | 91.50 | 1 – Dry & Nuts |
| P07 | Nuttybites Roasted Mix 60G | 4.35 | 30 | 130.50 | 1 – Dry & Nuts |
| P08 | Nuttybites Roasted Pistachio 40G | 3.21 | 30 | 96.30 | 1 – Dry & Nuts |
| P09 | Serbuk Asam Boi Ori V2 150G | 5.05 | 20 | 101.00 | 1 – Dry & Nuts |
| P10 | Serbuk Asam Boi Pedas V2 120G | 5.27 | 20 | 105.40 | 1 – Dry & Nuts |
| P11 | Serbuk Asam boi (Original) 1Kg | 15.53 | 4 | 62.12 | 2 – Funfruits |
| P12 | Sos Asam Boi Tong 20L | 503.10 | 1 | 503.10 | 2 – Funfruits |
| P13 | Sos Asam Boi Dipping Sauce 250gn | 5.50 | 15 | 82.50 | 1 – Dry & Nuts |

Categories:
- **Cat 1** — BM: "Barang Kering & Kacang" / EN: "Dry Products & Nuts" → P03, P05–P10, P13
- **Cat 2** — BM: "Item FunFruits" / EN: "Funfruits Item" → P01, P02, P04, P11, P12

Each product needs a **photo** (currently placeholders) and a **thumbnail slot**
on the order form.

## 5. Outlets

40 outlets, id pattern `MBG001`–`MBG040`, display name `MBG {location}`. Full
seed list of location names is in `ck-portal.jsx`.

## 6. Business rules (all confirmed through iteration — do not re-derive)

### Order lifecycle & the 30-day cycle
- Fulfillment deadline is **30 days from each order's own date** — a *rolling*
  window per order, **not** calendar month-end.
- Statuses: `Pending` (nothing delivered) → `Partial` (some lines delivered) →
  `Accomplished` (fully delivered within 30 days) → `Done (late)` (fully
  delivered, but after the 30-day mark) → `Overdue` (30 days passed, still
  short) → `Cancelled` (voided by outlet, excluded from all metrics).
- Status is **derived**, not stored directly — computed from delivered quantity
  vs ordered quantity vs today's date vs the 30-day due date.
- Order number format: `CK-YYMM-###`, sequential within the month, e.g. `CK-2608-014`.

### Reorder handling
- If an outlet tries to order a product it still has undelivered cartons on
  (from any non-cancelled, non-fully-delivered order), show a warning banner on
  the order form listing what's outstanding (product, cartons short, source
  order numbers).
- If they proceed to order that same product, show a confirmation modal asking
  whether this is a reorder because the original hasn't arrived, before submitting.
- Confirmed reorders are placed as a **new, separate order** (tagged with a
  note/flag, e.g. "Re-order — items not yet received") — they do **not** merge
  into or replace the original order.
- The **original pending order stays open on its own clock** and gets flagged
  Overdue by the system once its own 30 days lapse, same as any other order.
- The reorder flag should be visible to the operator (badge on the order row)
  and should also print on the PDF work order near the order number.

### Outlet self-service edit/cancel
- A **Pending** order (no deliveries recorded yet) can be **edited or cancelled
  by the outlet within 3 days of the order date**.
- After 3 days, or once any delivery has been recorded against it, it's locked
  — the outlet must place a new order instead (which starts its own fresh
  30-day cycle).
- Edit reopens the same order (same order number/date) with lines pre-filled;
  cancel requires an explicit confirm step and marks the order `Cancelled`
  (kept for records, excluded from stats).

### Fulfillment / delivery entry (operator side)
- Operator can expand any order row to see and edit its lines.
- Each line supports **up to two delivery batches** (different expiry dates
  from different production runs): `Delivered 1` + `Expiry 1`, `Delivered 2` +
  `Expiry 2`. Sum of the two batches cannot exceed the ordered carton count for
  that line; entering the first field caps/adjusts the second automatically.
- If a delivered quantity is entered but its paired expiry date is left blank,
  flag that field (amber outline) — don't block saving, just nudge.
- A "Mark all delivered" shortcut fills batch 1 to the full ordered quantity.
- Order-level status recalculates from the line batches on save.

### Monthly stock reporting
- Each outlet reports once a month: **quantity on hand in single units** plus
  **one nearest-expiry date per product** (encourages FIFO — outlets report the
  soonest-to-expire batch, not every batch).
- The reporting form is **only open on the 20th of each month**. Outside that
  day it's locked, with a "preview/testing" override toggle for admin/QA use —
  this override should probably become an actual admin-only setting in
  production rather than a public checkbox.
- Re-submitting in the same month **replaces** the existing submission for that
  outlet/month (no duplicate rows).
- Operator sees a submitted/outstanding tracker per month, with per-outlet
  drill-down and CSV export.

### Language
- **UI default is Bahasa Melayu.** A small "ENG" control top-right toggles the
  whole interface to English (and back to "BM").
- **Month names always render in English** regardless of the active UI
  language (e.g. "6 Aug 2026") — this was an explicit correction from the
  person, don't let it regress to locale-based month formatting.
- **Open question, not yet decided:** should the WhatsApp confirmation slip
  always generate in one fixed language regardless of the outlet's UI
  language, so the group chat stays consistent? Ask before assuming either way.

### WhatsApp confirmation slip
Generated immediately after an order is placed, with a "Copy for WhatsApp" button.
Format (translate labels per active language, values stay as-is):
```
🧾 CK ORDER CONFIRMED
Order No : CK-2608-014
Outlet   : MBG Putra Heights
Products : 5 items · 22 cartons
Value    : RM 1,847.60 (est.)
Date     : 6 Aug 2026
```

### PDF work order (locked format — see section 7)

### CSV export
- Orders tab export: order no, outlet, order date, due date, product, ordered,
  delivered, outstanding, batch1 qty/expiry, batch2 qty/expiry, line value,
  order total, status, completed date, note. One row per order line.
- Stock tracker export: outlet, month, submitted date, product, qty (units),
  nearest expiry. One row per stock line.

## 7. PDF work order — locked spec

Purpose: operator downloads this per order to (a) brief the production team on
quantities to make, (b) let the floor record what was actually delivered by
hand, (c) pin on the notice board.

Confirmed decisions:
- **No pricing anywhere** — production-only sheet, no carton price, no order value.
- **Dihantar 1 / Luput 1 / Dihantar 2 / Luput 2 columns left blank** for
  handwriting on the floor (mirrors the same dual-batch fields as the operator
  screen, so paper and system stay consistent when keyed back in).
- **Bahasa Melayu, with month names in English.**
- One page, A4, per order.

Layout (see rendered sample `ck-workorder-sample.pdf` in this output set):
- Header: CK logo mark, "Arahan Pengeluaran & Penghantaran", order number
  (large, top-right), print timestamp.
- Meta block: Outlet (name + code), Status, Order date, Due date (order date + 30 days).
- If the order is a reorder, print a visible flag near the order number/status
  (e.g. "• TEMPAHAN SEMULA").
- Item table grouped by category (category name as a sub-header row), columns:
  # | Produk | Karton | Unit/ktn | **Jumlah unit** (bold — this is the actual
  production quantity) | Dihantar 1 | Luput 1 | Dihantar 2 | Luput 2 (last four
  blank, amber-tinted to visually separate "plan" from "record").
- Totals row: total cartons, total units.
- Catatan (notes) box.
- Signature strip: Disediakan oleh / Disemak & diterima oleh / Tarikh.

Still open, not yet decided: a "print all of today's orders" batch option for
the operator (currently only one-PDF-per-order exists).

A **working stub already exists in the prototype** (`ck-portal.jsx`): a
"Download PDF" button on each operator order row generates this exact sheet
client-side via jsPDF, loaded from a CDN. In production this should become a
proper bundled dependency (npm install jspdf + jspdf-autotable) rather than a
runtime CDN fetch — same visual spec, cleaner implementation.

## 8. Data model (target — see supabase_schema.sql for a draft DDL)

Seven tables, designed so old orders are immune to later catalogue/price changes:

- **outlets** — id, code, name, active
- **products** — id, name, category, unit_price, units_per_carton, active
- **orders** — id, order_no, outlet_id, order_date, cancelled, note,
  completed_date, total (denormalized for quick display), created_at
- **order_lines** — id, order_id, product_id, cartons_ordered, **unit_price_snapshot,
  units_per_carton_snapshot, carton_price_snapshot** (never recompute from
  current product price), line_value
- **delivery_batches** — id, order_line_id, batch_no (1 or 2), qty, expiry_date,
  recorded_at (separate table rather than two columns on order_lines — cleaner
  if we ever need >2 batches later)
- **stock_reports** — id, outlet_id, report_month, submitted_at
- **stock_report_lines** — id, stock_report_id, product_id, qty_on_hand, nearest_expiry
- **users** (Supabase Auth) — linked to either an outlet_id (outlet role) or
  flagged as operator/admin

## 9. Still open / to confirm during build

1. WhatsApp slip: fixed language or follows outlet's UI toggle?
2. Real product photos to replace placeholders (need actual image assets).
3. "Print all today's orders" batch PDF — build now or later?
4. RLS (row-level security) policy design in Supabase: outlets should only
   read/write their own orders and stock reports; operators/admins see everything.
5. Whether the 20th-only stock window should have an actual admin-configurable
   override (vs. the prototype's public "preview" checkbox).

## 10. What NOT to change without asking

The business rules in section 6 were reached through several rounds of
back-and-forth with the person and were each explicitly confirmed. Treat them
as settled requirements, not suggestions — especially the 30-day rolling cycle
(not calendar month), the 3-day edit window, reorder-as-separate-order, and the
20th-only stock window.
