-- ============================================================================
-- Second qty/expiry batch on stock reports
-- Paste into the Supabase SQL Editor and run once. Safe to re-run.
--
-- Adds qty_on_hand_2 / nearest_expiry_2 to stock_report_lines — a second,
-- optional qty+expiry pair per product per report, mirroring the two-batch
-- pattern operators already use for deliveries (del1/exp1, del2/exp2).
-- Both new columns are nullable: NULL means "batch 2 not used" for that
-- product line, the same way nearest_expiry already represents "no expiry
-- entered". Unlike delivery_batches, this stays two plain columns on the
-- existing row (not a child table) because submit_stock_report() replaces
-- every line wholesale on each submit — there is nothing incremental to model.
-- ============================================================================

alter table stock_report_lines add column if not exists qty_on_hand_2 integer check (qty_on_hand_2 >= 0);
alter table stock_report_lines add column if not exists nearest_expiry_2 date;

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

grant execute on function submit_stock_report(jsonb) to authenticated;
