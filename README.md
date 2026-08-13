# CK Ordering Portal

Multi-outlet ordering and fulfillment app for CK Products / MBG outlets.

- `MIGRATION_BRIEF.md` — source of truth for business rules and data model.
- `supabase/schema.sql` — Postgres/Supabase schema (RPC-mediated writes, RLS).
- `reference/ck-portal.jsx` — original prototype, UI/behavior reference only.

## Dev setup

```bash
npm install
cp .env.example .env.local   # fill in Supabase URL/anon key
npm run dev
```

Supabase keys are never committed — `.env.local` is gitignored, and production
values live in Netlify environment variables.
