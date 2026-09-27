-- ============================================================================
-- Halal Management System (HMS) — schema, RPCs, and seed data
-- Paste into the Supabase SQL Editor and run once. Safe to re-run (the seed
-- insert uses ON CONFLICT DO NOTHING, everything else is CREATE OR REPLACE /
-- IF NOT EXISTS).
--
-- New `halal` role: treated as an operator everywhere via is_operator(), so
-- every existing operator RLS policy and RPC works for her with zero
-- per-feature changes. She lands on the HMS tab first (frontend-only logic).
-- ============================================================================

alter table user_profiles drop constraint user_profiles_role_check;
alter table user_profiles add constraint user_profiles_role_check
  check (role in ('outlet', 'operator', 'admin', 'halal'));

create or replace function is_operator()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_profiles
    where id = auth.uid() and role in ('operator', 'admin', 'halal')
  );
$$;

-- ---------------------------------------------------------------------------
-- hms_forms — one row per document (HM9-F4b..f). products/materials empty
-- arrays mean "open-ended, typed in each time" (Seasonal & R&D only).
-- qa_label is the second sensory sign-off column's label ("LD/QA" normally,
-- "R&D" on the Seasonal & R&D form).
-- ---------------------------------------------------------------------------
create table if not exists hms_forms (
  id             uuid primary key default gen_random_uuid(),
  code           text unique not null,
  name           text not null,
  version        text,
  display_order  smallint not null default 0,
  active         boolean not null default true,
  products       jsonb not null default '[]'::jsonb,
  materials      jsonb not null default '[]'::jsonb,
  qa_label       text not null default 'LD/QA',
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- hms_submissions — one row per form per work_date. status 'nil' = "no
-- production today" (explicit, so it never looks the same as "forgot").
-- submitted_at defaults to now() and is only ever set by the RPC below, never
-- client-supplied — this is what on-time/late is measured against.
-- ---------------------------------------------------------------------------
create table if not exists hms_submissions (
  id                   uuid primary key default gen_random_uuid(),
  form_id              uuid not null references hms_forms(id),
  work_date            date not null,
  status               text not null check (status in ('submitted', 'nil')),
  production_date      date,
  product_weight       text,
  products             jsonb,
  materials            jsonb,
  sensory              jsonb,
  packing_date         date,
  product_expiry_date  date,
  total_pcs            integer,
  total_ctn            integer,
  prepared_by          text,
  checked_by           text,
  submitted_at         timestamptz not null default now(),
  submitted_by         uuid references auth.users(id),
  updated_at           timestamptz not null default now(),
  unique (form_id, work_date)
);

create index if not exists idx_hms_submissions_date on hms_submissions(work_date);

-- ---------------------------------------------------------------------------
-- hms_holidays — operator-maintained; a working day that falls here is never
-- counted as missed.
-- ---------------------------------------------------------------------------
create table if not exists hms_holidays (
  date  date primary key,
  name  text
);

alter table hms_forms enable row level security;
alter table hms_submissions enable row level security;
alter table hms_holidays enable row level security;

drop policy if exists "hms_forms operator read" on hms_forms;
create policy "hms_forms operator read" on hms_forms for select using (is_operator());

drop policy if exists "hms_submissions operator read" on hms_submissions;
create policy "hms_submissions operator read" on hms_submissions for select using (is_operator());

drop policy if exists "hms_holidays operator read" on hms_holidays;
create policy "hms_holidays operator read" on hms_holidays for select using (is_operator());

-- ---------------------------------------------------------------------------
-- RPCs — the only way any client role mutates hms_* tables.
-- ---------------------------------------------------------------------------

create or replace function submit_hms_form(p_form_id uuid, p_work_date date, p_payload jsonb)
returns hms_submissions
language plpgsql security definer set search_path = public as $$
declare
  v_submission hms_submissions;
begin
  if not is_operator() then
    raise exception 'Operator only';
  end if;
  if exists (select 1 from hms_submissions where form_id = p_form_id and work_date = p_work_date) then
    raise exception 'A record already exists for this form and date — reopen it first';
  end if;

  insert into hms_submissions (
    form_id, work_date, status, production_date, product_weight, products, materials,
    sensory, packing_date, product_expiry_date, total_pcs, total_ctn, prepared_by, checked_by,
    submitted_by
  ) values (
    p_form_id, p_work_date, 'submitted',
    nullif(p_payload->>'production_date', '')::date,
    p_payload->>'product_weight',
    coalesce(p_payload->'products', '[]'::jsonb),
    coalesce(p_payload->'materials', '[]'::jsonb),
    p_payload->'sensory',
    nullif(p_payload->>'packing_date', '')::date,
    nullif(p_payload->>'product_expiry_date', '')::date,
    nullif(p_payload->>'total_pcs', '')::integer,
    nullif(p_payload->>'total_ctn', '')::integer,
    p_payload->>'prepared_by',
    p_payload->>'checked_by',
    auth.uid()
  )
  returning * into v_submission;

  return v_submission;
end;
$$;

create or replace function mark_hms_nil(p_form_id uuid, p_work_date date)
returns hms_submissions
language plpgsql security definer set search_path = public as $$
declare
  v_submission hms_submissions;
begin
  if not is_operator() then
    raise exception 'Operator only';
  end if;
  if exists (select 1 from hms_submissions where form_id = p_form_id and work_date = p_work_date) then
    raise exception 'A record already exists for this form and date — reopen it first';
  end if;

  insert into hms_submissions (form_id, work_date, status, submitted_by)
  values (p_form_id, p_work_date, 'nil', auth.uid())
  returning * into v_submission;

  return v_submission;
end;
$$;

-- Corrects an already-submitted record's content without touching
-- submitted_at, so fixing a typo can't retroactively change on-time/late.
create or replace function update_hms_submission(p_id uuid, p_payload jsonb)
returns hms_submissions
language plpgsql security definer set search_path = public as $$
declare
  v_submission hms_submissions;
begin
  if not is_operator() then
    raise exception 'Operator only';
  end if;

  update hms_submissions set
    production_date = nullif(p_payload->>'production_date', '')::date,
    product_weight = p_payload->>'product_weight',
    products = coalesce(p_payload->'products', products),
    materials = coalesce(p_payload->'materials', materials),
    sensory = coalesce(p_payload->'sensory', sensory),
    packing_date = nullif(p_payload->>'packing_date', '')::date,
    product_expiry_date = nullif(p_payload->>'product_expiry_date', '')::date,
    total_pcs = nullif(p_payload->>'total_pcs', '')::integer,
    total_ctn = nullif(p_payload->>'total_ctn', '')::integer,
    prepared_by = p_payload->>'prepared_by',
    checked_by = p_payload->>'checked_by',
    updated_at = now()
  where id = p_id
  returning * into v_submission;

  if not found then
    raise exception 'Submission not found';
  end if;

  return v_submission;
end;
$$;

-- Deletes a submission so the day can be redone — mirrors reopen_stock_report.
-- This does reset the on-time/late record for that day; use sparingly.
create or replace function reopen_hms_submission(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_operator() then
    raise exception 'Operator only';
  end if;
  delete from hms_submissions where id = p_id;
end;
$$;

create or replace function upsert_hms_holiday(p_date date, p_name text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_operator() then
    raise exception 'Operator only';
  end if;
  insert into hms_holidays (date, name) values (p_date, p_name)
  on conflict (date) do update set name = excluded.name;
end;
$$;

create or replace function delete_hms_holiday(p_date date)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_operator() then
    raise exception 'Operator only';
  end if;
  delete from hms_holidays where date = p_date;
end;
$$;

grant execute on function submit_hms_form(uuid, date, jsonb) to authenticated;
grant execute on function mark_hms_nil(uuid, date) to authenticated;
grant execute on function update_hms_submission(uuid, jsonb) to authenticated;
grant execute on function reopen_hms_submission(uuid) to authenticated;
grant execute on function upsert_hms_holiday(date, text) to authenticated;
grant execute on function delete_hms_holiday(date) to authenticated;

-- ---------------------------------------------------------------------------
-- Seed the 5 forms with their exact product/material lists, transcribed
-- directly from reference/hms/HMS DAILY.xlsx (see tasks/todo.md for the
-- verified list). "ROASTED CAHSEW" in the source is corrected to
-- "ROASTED CASHEW" here.
-- ---------------------------------------------------------------------------
insert into hms_forms (code, name, version, display_order, products, materials, qa_label) values
('HM9-F4b', 'Simple Juice', '2', 1,
 '["SJ01","SJ02","SJ03","SJ04","SJ05","SJ06","SJ07","SJ08","SJ09","SJ10","SJ11","SJ12","SJ13","SJ14","SJ15","SJ16","SJ17","SJ18","SJ19","SJ20","SJ21","SJ22","SEASONAL"]'::jsonb,
 '["AIR/WATER","GULA/WHITE SUGAR","WATERMELON","GUAVA","GREEN APPLE","RED APPLE","RED DRAGON","MANGO","ORANGE","LEMON","PINEAPPLE","CARROT","GINGER","BEETROOT","KIWI","GRAPE","PASSION FRUIT","BANANA","PERSIMMON","STRAWBERRY","PEAR","POMEGRANATE","SIRAP","GREEN TEA","RED TEA","SUSU CAIR","SUSU PEKAT"]'::jsonb,
 'LD/QA'),
('HM9-F4c', 'Dipping (Sauce & Powder)', '1', 2,
 '["SERBUK ASAM BOI ORI 1KG","SERBUK ASAM BOI PEDAS 1KG","SWEET CHILI 1KG","SERBUK ASAM BOI ORI 150G","SERBUK ASAM BOI PEDAS 120G","SOS ASAM BOI TONG","SOS ASAM BOI BOTOL 250G","KUAH ROJAK ORI 490G","KUAH ROJAK GALLON 10L","KUAH ROJAK PENANG"]'::jsonb,
 '["AIR/WATER","GULA/WHITE SUGAR","GARAM/SALT","PLUM POWDER","CHILI FLAKES","ASAM BOI (PRESERVED FRUIT)","ICING SUGAR","RED CHILI","KICAP PEKAT/THICK SOY SAUCE","PETIS","BELACAN","GULA PERANG/BROWN SUGAR","KICAP MANIS UDANG/SWEET SOY SAUCE","CILI GILING","BIJAN","KACANG HANCUR"]'::jsonb,
 'LD/QA'),
('HM9-F4d', 'Re-Packing', '2', 3,
 '["NUTTYBITES ALMOND","NUTTYBITES CASHEW","NUTTYBITES PISTACHIO","NUTTY BITES MIX"]'::jsonb,
 '["ROASTED ALMOND","ROASTED CASHEW","ROASTED PISTACHIO","ROASTED MIX NUT"]'::jsonb,
 'LD/QA'),
('HM9-F4e', 'Cut Fruits', '1', 4,
 '["CUT FRUITS","CUT FRUITS + ROJAK PENANG SAUCE","CUT FRUITS + SERBUK ASAM ORI"]'::jsonb,
 '["STRAWBERRY","PEAR","POMEGRANATE","GUAVA","GREEN APPLE","RED APPLE","RED DRAGON","MANGO","ORANGE","LEMON","PINEAPPLE","CARROT","GINGER","BEETROOT","KIWI","GRAPE","PASSION FRUIT","BANANA","PERSIMMON","HONEY DEW","ROCK MELON","HAMI MELON","CUCUMBER","PAPAYA","SUNGOLD MELON","SERBUK ASAM BOI ORI","SERBUK ASAM BOI PEDAS","KACANG HANCUR"]'::jsonb,
 'LD/QA'),
('HM9-F4f', 'Seasonal & R&D', '0', 5, '[]'::jsonb, '[]'::jsonb, 'R&D')
on conflict (code) do nothing;
