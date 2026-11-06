import { supabase } from '../supabaseClient'

// Nested select: order_lines follow their parent order, each line carries
// its product and its delivery batches. RLS scopes rows automatically
// (outlet sees only its own, operator sees all).
const ORDER_SELECT = `
  id, order_no, outlet_id, order_date, cancelled, is_reorder, note, completed_date, total, created_at,
  outlet:outlets(id, code, name),
  order_lines(
    id, product_id, cartons_ordered, is_extra,
    unit_price_snapshot, units_per_carton_snapshot, carton_price_snapshot, line_value,
    product:products(id, code, name, category),
    delivery_batches(id, batch_no, qty, expiry_date, delivered_date, is_buffer, drop_id, is_extra_part)
  )
`

export async function listMyOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .order('order_date', { ascending: false })
  if (error) throw error
  return data
}

// Operator view — same query; RLS returns every outlet's orders for operator/admin roles.
export async function listAllOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .order('order_date', { ascending: false })
  if (error) throw error
  return data
}

export async function getOrder(orderId) {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('id', orderId)
    .single()
  if (error) throw error
  return data
}

export async function placeOrder(lines, isReorder = false) {
  const { data, error } = await supabase.rpc('place_order', {
    p_lines: lines.map((l) => ({ product_id: l.productId, cartons: l.cartons })),
    p_is_reorder: isReorder,
  })
  if (error) throw error
  return getOrder(data.id)
}

export async function editOrder(orderId, lines) {
  const { error } = await supabase.rpc('edit_order', {
    p_order_id: orderId,
    p_lines: lines.map((l) => ({ product_id: l.productId, cartons: l.cartons })),
  })
  if (error) throw error
  return getOrder(orderId)
}

export async function cancelOrder(orderId) {
  const { error } = await supabase.rpc('cancel_order', { p_order_id: orderId })
  if (error) throw error
}

// lines: [{ orderLineId, batch1Qty, batch1Expiry, batch1DeliveredDate, batch2Qty, batch2Expiry, batch2DeliveredDate }]
export async function recordDelivery(orderId, lines) {
  const { error } = await supabase.rpc('record_delivery', {
    p_order_id: orderId,
    p_lines: lines.map((l) => ({
      order_line_id: l.orderLineId,
      batch1_qty: l.batch1Qty || 0,
      batch1_expiry: l.batch1Expiry || null,
      batch1_delivered_date: l.batch1DeliveredDate || null,
      batch2_qty: l.batch2Qty || 0,
      batch2_expiry: l.batch2Expiry || null,
      batch2_delivered_date: l.batch2DeliveredDate || null,
    })),
  })
  if (error) throw error
  return getOrder(orderId)
}

// Penghantaran Extra: lines [{ productId, cartons, expiry }]. Returns the server's
// summary of where each carton went (knocked off which orders / extra on latest order).
export async function recordBufferDelivery(outletId, deliveredDate, lines) {
  const { data, error } = await supabase.rpc('record_buffer_delivery', {
    p_outlet_id: outletId,
    p_delivered_date: deliveredDate || null,
    p_lines: lines.map((l) => ({ product_id: l.productId, cartons: l.cartons, expiry: l.expiry || null })),
  })
  if (error) throw error
  return data
}

export async function removeBufferBatch(batchId) {
  const { error } = await supabase.rpc('remove_buffer_batch', { p_batch_id: batchId })
  if (error) throw error
}
