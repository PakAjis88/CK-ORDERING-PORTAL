-- ============================================================================
-- Let the operator manually key in an outlet's stock report
-- Paste into the Supabase SQL Editor and run once. Safe to re-run.
--
-- Outlets aren't yet submitting stock reports themselves, so the operator
-- needs to enter an outlet's balance + expiry dates on their behalf. This
-- writes into the same stock_reports/stock_report_lines tables the rest of
-- the app already reads — no separate data model. Unlike the outlet's own
-- submit_stock_report(), this bypasses the 20th-30th reporting window
-- entirely (operator can backfill any month, anytime). It still refuses to
-- overwrite an existing report — use reopen_stock_report() first.
-- ============================================================================

create or replace function submit_stock_report_for_outlet(p_outlet_id uuid, p_month char(7), p_lines jsonb)
returns stock_reports
language plpgsql security definer set search_path = public as $$
declare
  v_report stock_reports;
  v_line jsonb;
begin
  if not is_operator() then
    raise exception 'Operator only';
  end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'Stock report must have at least one line';
  end if;
  if exists (select 1 from stock_reports where outlet_id = p_outlet_id and report_month = p_month) then
    raise exception 'Stock report already submitted for this month — reopen it first';
  end if;

  insert into stock_reports (outlet_id, report_month, submitted_by)
  values (p_outlet_id, p_month, auth.uid())
  returning * into v_report;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    insert into stock_report_lines (
      stock_report_id, product_id, qty_on_hand, nearest_expiry, qty_on_hand_2, nearest_expiry_2
    )
    values (
      v_report.id,
      (v_line->>'product_id')::uuid,
      (v_line->>'qty_on_hand')::integer,
      nullif(v_line->>'nearest_expiry', '')::date,
      (v_line->>'qty_on_hand_2')::integer,
      nullif(v_line->>'nearest_expiry_2', '')::date
    );
  end loop;

  return v_report;
end;
$$;

grant execute on function submit_stock_report_for_outlet(uuid, char, jsonb) to authenticated;
