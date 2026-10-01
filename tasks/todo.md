# Todo — PDF filename includes outlet name

## Plan
- [x] `downloadOrderPdf` in `src/lib/workOrderPdf.js` now saves as `<Outlet Name> <Order No>.pdf` instead of just `<Order No>.pdf`
- [x] Added `safeFilePart()` to strip filesystem-invalid characters from the outlet name (cheap insurance, not expected to trigger on current outlet names)
- [x] Batch PDF (`downloadBatchPdf`) left unchanged — it covers many outlets in one file, per-outlet naming doesn't apply

## Verification
- [x] Rebuilt clean
- [x] Verified the exact output against real outlet names: `AEON Mall Nilai CK-2609-006.pdf`, and `Institut Jantung Negara (IJN) CK-2609-010.pdf` (confirms the sanitizer correctly leaves parentheses alone while being ready to strip truly invalid characters)

## Review

Small, one-function change. Confirmed the separator (plain space) with the user before implementing since the request's literal format had no visible separator between the two parts.
