# Todo — Keep-alive ping so the free Supabase project never auto-pauses

Why: on 2026-10 Supabase paused the free project after 7 days of inactivity (login stopped working until it was restored). A small scheduled job that touches the database every few days makes a 7-day silence much less likely.

Honest limit: Supabase does not document exactly what counts as "activity", so this is very likely but not guaranteed to work. Real daily use by outlets remains the best protection.

## Design (kept minimal)
- One GitHub Actions workflow, `.github/workflows/keep-alive.yml`, on a cron schedule (every 3 days, ~03:00 Malaysia time) plus a manual "Run workflow" button.
- It does one `curl` GET to the project's REST API: `.../rest/v1/products?select=id&limit=1` with the public anon key. That executes a real query on Postgres (returns `[]` for anonymous callers because of RLS, which is fine and exposes no data).
- Fails loudly (non-200 → job fails → GitHub emails the repo owner), so a paused/broken project gets noticed instead of silently ignored.
- No secrets needed: the Supabase URL and anon key are already public (shipped in the site's JavaScript). They go in the workflow file as plain text. The service-role key and any passwords are NOT used.

## Steps
- [ ] 1. Create `.github/workflows/keep-alive.yml` (schedule `0 19 */3 * *` UTC, `workflow_dispatch`, one curl step with `--fail`)
- [ ] 2. Commit locally (no push yet)
- [ ] 3. Ask for a separate go-ahead, then push
- [ ] 4. In GitHub → Actions tab, click "Run workflow" once to prove it works (green run = HTTP 200 from Supabase); confirm the run appears in Supabase's API logs if visible
- [ ] 5. Add a note to the Review section and update memory (reference_ck_portal_infra: keep-alive exists, how to check it)

## Known caveats to be aware of
- GitHub automatically disables scheduled workflows in a repo with no commits for 60 days. You commit often so this is unlikely, but if the portal goes quiet for 2 months the ping stops. Fallback: a free external pinger (e.g. cron-job.org) calling the same URL, no repo needed — can be added later if you prefer.
- GitHub cron can run a few minutes late and occasionally skips a run under load; every-3-days leaves room for a missed run within the 7-day window.
- Backups are separate: still download the data from Supabase every month or so.

## Review
(to be filled in at the end)
