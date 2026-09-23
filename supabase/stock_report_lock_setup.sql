-- ============================================================================
-- Lock a stock report after submission; operator-only reopen
-- Paste into the Supabase SQL Editor and run once. Safe to re-run.
--
-- New rule for the 27 Aug 2026 production launch: once an outlet submits its
-- monthly stock report, the form locks (no more resubmitting/correcting on
-- their own) until an operator explicitly reopens it for that outlet/month.
-- ============================================================================

create or replace function submit_stock_report(p_lines jsonb)
returns stock_reports
language plpgsql security definer set search_path = public as $$
declare
  v_outlet_id uuid := my_outlet_id();
  v_month char(7) := to_char(current_date, 'YYYY-MM');
  v_report stock_reports;
  v_line jsonb;
begin
  if v_outlet_id is null then
    raise exception 'Only an outlet user can submit a stock report';
  end if;
  if not is_stock_window_open() then
    raise exception 'Stock reporting window is closed';
  end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'Stock report must have at least one line';
  end if;
  if exists (select 1 from stock_reports where outlet_id = v_outlet_id and report_month = v_month) then
    raise exception 'Stock report already submitted for this month — ask your operator to reopen it';
  end if;

  insert into stock_reports (outlet_id, report_month, submitted_by)
  values (v_outlet_id, v_month, auth.uid())
  on conflict (outlet_id, report_month) do update
    set submitted_at = now(), submitted_by = excluded.submitted_by
  returning * into v_report;

  delete from stock_report_lines where stock_report_id = v_report.id;

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

-- Operator-only: clear an outlet's stock report for a month so they can submit again.
create or replace function reopen_stock_report(p_outlet_id uuid, p_month char(7))
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_operator() then
    raise exception 'Operator only';
  end if;
  delete from stock_reports where outlet_id = p_outlet_id and report_month = p_month;
end;
$$;

grant execute on function submit_stock_report(jsonb) to authenticated;
grant execute on function reopen_stock_report(uuid, char) to authenticated;
