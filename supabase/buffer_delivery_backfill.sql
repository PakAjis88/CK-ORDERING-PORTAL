-- OPTIONAL. Run only after buffer_delivery_setup.sql, and only if you want
-- cartons that were ALREADY delivered beyond the ordered quantity to be charged
-- (line value = max(ordered, delivered) x price) on past orders.
-- Without this, an old over-delivered order keeps its old total until the next
-- time its delivery is saved, then it changes at that moment.
-- Idempotent. Only touches orders that have an over-delivered line.

select recompute_order(o.id)
from orders o
where exists (
  select 1 from order_lines ol
  where ol.order_id = o.id
    and coalesce((select sum(db.qty) from delivery_batches db where db.order_line_id = ol.id), 0) > ol.cartons_ordered
);
