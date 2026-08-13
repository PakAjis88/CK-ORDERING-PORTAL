import { supabase } from '../supabaseClient'

// Nested select: order_lines follow their parent order, each line carries
// its product and its delivery batches. RLS scopes rows automatically
// (outlet sees only its own, operator sees all).
const ORDER_SELECT = `
  id, order_no, outlet_id, order_date, cancelled, is_reorder, note, completed_date, total, created_at,
  outlet:outlets(id, code, name),
  order_lines(
    id, product_id, cartons_ordered,
    unit_price_snapshot, units_per_carton_snapshot, carton_price_snapshot, line_value,
    product:products(id, code, name, category),
    delivery_batches(id, batch_no, qty, expiry_date)
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

// lines: [{ orderLineId, batch1Qty, batch1Expiry, batch2Qty, batch2Expiry }]
export async function recordDelivery(orderId, lines) {
  const { error } = await supabase.rpc('record_delivery', {
    p_order_id: orderId,
    p_lines: lines.map((l) => ({
      order_line_id: l.orderLineId,
      batch1_qty: l.batch1Qty || 0,
      batch1_expiry: l.batch1Expiry || null,
      batch2_qty: l.batch2Qty || 0,
      batch2_expiry: l.batch2Expiry || null,
    })),
  })
  if (error) throw error
  return getOrder(orderId)
}
