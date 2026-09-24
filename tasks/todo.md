# Todo — 3 outlet-side improvements

Source: outlet-operation review, confirmed important on 2026-09-24. Three independent improvements, each scoped to be minimal — no big rewrites, per the Workflow rule in `CLAUDE.md`.

## 1. Draft auto-save for stock report entry — DONE
Problem: `rows` in `src/pages/outlet/StockReport.jsx` is plain React state — a refresh, dropped connection, or accidental navigation mid-entry loses everything typed, with no warning.

- [x] In `StockReport.jsx`, pull `profile` from `useAuth()` to get the outlet's own id for a draft key
- [x] Build a localStorage key like `stock-draft-${profile.outlet_id}-${month}`
- [x] On mount (only when the report is still editable, i.e. no `existing` submission), restore any saved draft into `rows` if present
- [x] On every `rows` change while editable, write the current `rows` to that localStorage key
- [x] On successful `submitStockReport`, clear that localStorage key
- [x] No changes needed to `StockReportForm.jsx` (rows state lives in the parent) or to the operator's manual-entry modal in `StockTracker.jsx` (out of scope — that's a short single-sitting entry, not the outlet's own recurring workflow)

## 2. Self-service password recovery via a security question (no email — outbound email isn't configured) — DONE
Problem: `Login.jsx` has no password-recovery option at all — an outlet that forgets their password (their own phone number) has no way to recover it except asking the operator to reset it manually. Email-based reset isn't viable (outbound email not set up in Supabase for this project), so this uses a security question instead. **Bigger attack surface than any other RPC in this schema** — it must be callable by a fully anonymous caller (the whole point is the outlet isn't logged in), so its only protection is the answer check + a fail-lockout. Needs explicit sign-off before building — see the design write-up in chat (2026-09-24).

**Schema:**
- [x] Add `security_question text`, `security_answer_hash text`, `security_fail_count integer not null default 0`, `security_locked_until timestamptz` to `user_profiles`
- [x] `set_security_answer(p_question text, p_answer text)` — any signed-in user, hashes the answer with `crypt(p_answer, gen_salt('bf'))` (pgcrypto, already enabled), upserts onto the caller's own row
- [x] `get_security_question(p_email text)` — anonymous-callable, returns just the question text (or null) for a given login email, so the recovery UI can display it — no answer/hash ever leaves the database
- [x] `reset_password_with_answer(p_email text, p_answer text, p_new_password text)` — anonymous-callable, generic "Incorrect answer" error in every failure case, 5-attempt/15-minute lockout, rewrites `auth.users.encrypted_password` directly on success

**Frontend:**
- [x] One-time "Set up account recovery" prompt (`src/components/SecuritySetupBanner.jsx`) shown in `OutletHome.jsx` when `profile.security_question` is null — dismissible/skippable, reappears next login until completed
- [x] `Login.jsx`: "Forgot password?" link → enter email → fetch+show their question via `get_security_question` → answer + new password (+ confirm) → call `reset_password_with_answer` → back to normal login on success
- [x] New i18n keys for the setup prompt and the recovery flow (both `en`/`ms`)
- [x] Added `refreshProfile` to `AuthContext.jsx` so the banner disappears immediately after saving, no full reload needed
- [x] Verified live with a disposable test account (created and deleted via service role, never a real outlet). Found and fixed two real bugs along the way:
  1. `crypt`/`gen_salt` live in Supabase's `extensions` schema, not `public` — functions needed `search_path = public, extensions`
  2. `raise exception` rolls back everything done earlier in the same call, which was silently undoing the fail-count increment before it ever persisted — changed `reset_password_with_answer` to return `boolean` instead of raising on a wrong answer, so the counter update survives
  - Confirmed: 5 wrong attempts → locked out (even the correct answer is blocked while locked) → correct answer after clearing the lock → succeeds → new password logs in, old password rejected
  - Confirmed real outlet accounts (163 Retail Park) are unaffected: `get_security_question` returns null cleanly, normal login still works

**Explicitly flagged for your decision, not assumed:**
- [x] Confirmed: 5 attempts / 15-minute lockout
- [x] Confirmed: skippable setup prompt, reminded each login until done

## 3. Read-only stock report history for outlets — DONE
Problem: `getMyStockReport(month)` already supports any month, but `StockReport.jsx` only ever calls it with the current month — outlets have no way to check what they reported in a past month without asking the operator.

- [x] Added a month `Select` (reused from `src/components/ui.jsx`) to `StockReport.jsx`, defaulting to the current month, options = current + last 6 months
- [x] Selecting a past month refetches `getMyStockReport(thatMonth)` and renders read-only (existing `editable={false}` support in `StockReportForm`, no changes needed there); shows a new "no submission for {month}" empty state when nothing was submitted
- [x] Draft auto-save (item 1) stays scoped to the current month only — switching to a past month doesn't touch or overwrite the current month's draft
- [x] Verified the underlying query live against a real outlet: current-month fetch returns data, a past empty month returns `[]` cleanly, matching what the new UI logic expects
- [ ] **Partially unverified**: the React state transitions when switching the month dropdown (blank→populate→back to editable current month) are correct by code review, but not click-tested in an actual browser — the Browser pane tool is unavailable this session. Worth a quick manual click-through before considering this fully done.

## Review

All 3 improvements are implemented and DB migrations are live. Summary:

**1. Draft auto-save (stock report entry)** — `StockReport.jsx` now saves in-progress entries to `localStorage` per outlet+month, restores on reload, clears on successful submit. Small, isolated change, no schema/RPC needed.

**2. Security-question password recovery** — new `user_profiles` columns + 3 RPCs (`set_security_answer`, `get_security_question`, `reset_password_with_answer`), a dismissible setup banner on the outlet home screen, and a "Forgot password?" flow on `Login.jsx`. This was the biggest and riskiest piece — it's the first RPC in the schema that must be callable by a fully anonymous caller, so its only protection is the answer check plus a 5-attempt/15-minute lockout, and every failure path returns the same generic error to avoid leaking which emails are real accounts.
  - Found and fixed two real bugs during live verification (both now documented as comments in the SQL itself): pgcrypto's `crypt`/`gen_salt` live in Supabase's `extensions` schema, not `public`, so the functions needed `search_path = public, extensions`; and `raise exception` in PL/pgSQL rolls back everything done earlier in that same call, which was silently erasing the fail-count increment before it ever reached the database — fixed by having the function return `boolean` instead of raising on a wrong answer.
  - Verified end-to-end with a disposable test account (created and deleted via the service-role key, never a real outlet's login): setup, question retrieval, 5 wrong answers triggering the lockout, the lockout blocking even the correct answer, a legitimate reset succeeding once cleared, and the new password actually working while the old one no longer does. Also confirmed a real outlet account is unaffected by the migration.

**3. Read-only stock history for outlets** — `StockReport.jsx` gained a month picker (current + last 6 months); picking a past month renders the same form read-only via the existing `editable` prop, with a new empty state if nothing was submitted that month. No new backend needed — `getMyStockReport(month)` already supported arbitrary months.

**Known gap:** the Browser pane tool was unavailable all session, so nothing here was click-tested in an actual browser — verification was build checks + direct REST/RPC calls against the live Supabase project + careful code review. The backend logic (the part with real risk — password handling, RLS, lockout) was verified thoroughly this way; the pure React state-transition behavior (e.g. the month dropdown, the setup banner's dismiss/reopen) is lower-risk but only reviewed, not clicked through. Recommend a quick manual pass in a real browser before/shortly after this goes live.

**Not yet done:** none of this has been committed or pushed — pending your review.
