// Pure calculation for one product's production sheet (no React, no PDF).
//
// orders: the shape returned by listAllOrders(): each order has outlet_id, outlet {code, name},
// cancelled, and order_lines [{ product_id, cartons_ordered, delivery_batches: [{ qty, delivered_date }] }].
//
// One row per outlet, adding up all of that outlet's (non-cancelled) orders for the product:
//   ordered   - cartons originally ordered (0 when the outlet only got the product as an extra)
//   delivered - cartons delivered so far, all batches
//   balance   - cartons still owed: per order line max(0, ordered - delivered), so over-delivery
//               on one order never hides a shortfall on another
//   deliveries - the delivered cartons grouped by delivery date, oldest first
export function productSheet(orders, productId) {
  const byOutlet = new Map()

  orders.filter((o) => !o.cancelled).forEach((o) => {
    o.order_lines.filter((l) => l.product_id === productId).forEach((l) => {
      if (!byOutlet.has(o.outlet_id)) {
        byOutlet.set(o.outlet_id, {
          outletId: o.outlet_id, code: o.outlet?.code || '', name: o.outlet?.name || '',
          ordered: 0, delivered: 0, balance: 0, dates: new Map(),
        })
      }
      const row = byOutlet.get(o.outlet_id)
      const batches = l.delivery_batches || []
      const delivered = batches.reduce((s, b) => s + (b.qty || 0), 0)
      row.ordered += l.cartons_ordered
      row.delivered += delivered
      row.balance += Math.max(0, l.cartons_ordered - delivered)
      batches.forEach((b) => row.dates.set(b.delivered_date, (row.dates.get(b.delivered_date) || 0) + (b.qty || 0)))
    })
  })

  const rows = [...byOutlet.values()]
    .map(({ dates, ...r }) => ({
      ...r,
      deliveries: [...dates.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, qty]) => ({ date, qty })),
    }))
    .sort((a, b) => a.code.localeCompare(b.code))

  return {
    rows,
    totalOrdered: rows.reduce((s, r) => s + r.ordered, 0),
    totalDelivered: rows.reduce((s, r) => s + r.delivered, 0),
    totalBalance: rows.reduce((s, r) => s + r.balance, 0),
  }
}

// The delivered cartons laid out over a fixed number of columns, first delivery in the first column.
// With more delivery dates than columns, the last column holds the sum of the rest (more: true).
// Returns an array of length `count`; unused columns are null (left blank for handwriting).
export function deliveryCells(deliveries, count = 4) {
  const cells = Array(count).fill(null)
  if (deliveries.length <= count) {
    deliveries.forEach((d, i) => { cells[i] = { qty: d.qty, date: d.date, more: false } })
  } else {
    deliveries.slice(0, count - 1).forEach((d, i) => { cells[i] = { qty: d.qty, date: d.date, more: false } })
    cells[count - 1] = { qty: deliveries.slice(count - 1).reduce((s, d) => s + d.qty, 0), date: null, more: true }
  }
  return cells
}
