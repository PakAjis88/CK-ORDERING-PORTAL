import { supabase } from '../supabaseClient'

export async function isStockWindowOpen() {
  const { data, error } = await supabase.rpc('is_stock_window_open')
  if (error) throw error
  return data
}

export async function setStockWindowOverride(enabled) {
  const { error } = await supabase.rpc('set_stock_window_override', { p_enabled: enabled })
  if (error) throw error
}

export async function getMyStockReport(month) {
  const { data, error } = await supabase
    .from('stock_reports')
    .select('id, outlet_id, report_month, submitted_at, lines:stock_report_lines(product_id, qty_on_hand, nearest_expiry)')
    .eq('report_month', month)
    .maybeSingle()
  if (error) throw error
  return data
}

// lines: [{ productId, qtyOnHand, nearestExpiry }]
export async function submitStockReport(lines) {
  const { error } = await supabase.rpc('submit_stock_report', {
    p_lines: lines.map((l) => ({
      product_id: l.productId,
      qty_on_hand: l.qtyOnHand,
      nearest_expiry: l.nearestExpiry || null,
    })),
  })
  if (error) throw error
}

// Operator: all reports for a given month, across outlets.
export async function listStockReports(month) {
  const { data, error } = await supabase
    .from('stock_reports')
    .select(`
      id, outlet_id, report_month, submitted_at,
      outlet:outlets(id, code, name),
      lines:stock_report_lines(product_id, qty_on_hand, nearest_expiry, product:products(id, code, name))
    `)
    .eq('report_month', month)
    .order('submitted_at', { ascending: false })
  if (error) throw error
  return data
}
