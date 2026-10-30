# Todo — Operator can add new users (outlet + staff)

Today all logins are created by a private script run on the developer's PC with the service-role key (`scripts/private/provision_users.mjs`). A browser can never hold that key, so the operator needs a small server-side function that does the same job after checking the caller really is an operator.

## Confirmed with user
- Operator can add: **new outlet logins** (also creates the outlet: code + name) and **staff logins** (operator, halal/HMS).
- First password is **typed by the operator** (same practice as today, outlet password = phone number).

## Design
- **Supabase Edge Function `create-user`** (server-side, gets the service-role key automatically; no secret for the user to handle). Same calls as the provisioning script: `auth.admin.createUser({ email_confirm: true })` + insert `user_profiles` (+ insert `outlets` row for a new outlet).
- Function first checks the caller: valid login (JWT required) AND `user_profiles.role` is `operator` or `admin`. **Halal accounts cannot add users.** Staff roles it may create: `operator`, `halal` only (never `admin`).
- Validation: email format, password >= 6 chars, outlet code not already used, email not already used. If any step fails after another succeeded, it undoes what it created (no orphan outlet/auth user).
- Never returns or logs passwords. Browser calls it via `supabase.functions.invoke('create-user')`.
- New **Users** tab in the operator portal (shown to operator/admin only): one form, kind = Outlet / Staff; success message shows the email created. No user list/edit/delete in this round (RLS only lets a user read their own profile; separate feature if wanted).
- Not an SQL-only RPC on purpose: inserting into `auth.users` directly is fragile (identities, GoTrue version changes), unlike the password-reset trick which only updates a column.

## Steps
- [x] 1. `supabase/functions/create-user/index.ts` (Edge Function code, kept in repo so it's versioned) + short deploy note in the file header
- [x] 2. `src/lib/api/users.js`: `createUser(...)` wrapper around `functions.invoke`, surfaces the function's error message
- [x] 3. `src/pages/operator/Users.jsx` + tab in `OperatorHome.jsx` (hidden for halal)
- [x] 4. i18n: tab label en + ms (form text is plain English like Raw Materials)
- [x] 5. USER deployed (done): deploy the function (Supabase Dashboard → Edge Functions → create `create-user`, paste the code, deploy); I give exact clicks
- [x] 6. Live test (13/13 passed; test users + outlet removed and confirmed gone) with disposable accounts (a test staff user and a test outlet), as the real operator: created, can log in, outlet appears in lists, duplicate email/code rejected, outlet account and halal account are refused, bad password rejected. Test users removed afterwards (Authentication → Users in dashboard, or I clean up if the service key file is restored)
- [ ] 7. lint + build done; commit done; push only after a separate go-ahead (push deploys the Users tab to Netlify)
- [x] 8. Review section + memory update

## Side finding (separate small task, needs user in the dashboard)
Supabase Auth currently has **public sign-up enabled** (`disable_signup: false`). Nobody can get data (no profile row = no access) but strangers can create junk auth accounts. The app never uses sign-up, and the Edge Function is unaffected by this setting. Recommend switching it off: Dashboard → Authentication → Sign In / Providers → turn off "Allow new users to sign up".

## Risks / honest notes
- Edge Function is deployed outside GitHub/Netlify, so a push does not update it; redeploys are a manual paste (same as SQL files). Free tier includes Edge Functions.
- An operator can create operator/halal accounts, i.e. give others full operator powers by design. Only trusted staff should hold operator logins.

## Review
Operator can add new outlet logins (creates the outlet too) and staff logins (operator, halal) from a new Users tab; halal accounts don't see the tab and the server refuses them anyway.

Built as a Supabase Edge Function (create-user, service-role key stays server-side) because a browser can't create auth users safely. Live test as the real operator, 13/13 passed: unauthenticated refused (401); staff + outlet creation; duplicate email, duplicate outlet code, short password, role admin all rejected; new users can log in with correct profile/outlet link; outlet and halal accounts refused (403); new outlet visible to operator. Dashboard setting 'Verify JWT with legacy secret' left ON (works).

Test data (2 auth users + outlet MBGTEST1) removed by the user in the dashboard and confirmed gone (outlets back to 34).

Open: (1) the function lives in Supabase, not Netlify: a push does not update it; redeploy by pasting index.ts again after any change. (2) Public sign-up is still enabled in Supabase Auth: user should switch it off (Authentication > Sign In / Providers). (3) No user list/edit/delete/reset yet.
