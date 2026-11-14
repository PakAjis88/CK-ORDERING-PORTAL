import { dueDate, daysSince, EDIT_DAYS } from './format'

// All of these operate on an order row shaped like:
// { ...orders columns, order_lines: [{ ...order_lines columns, delivery_batches: [...] }] }

export const lineDelivered = (line) => (line.delivery_batches || []).reduce((s, b) => s + (b.qty || 0), 0)
export const orderedCartons = (order) => order.order_lines.reduce((s, l) => s + l.cartons_ordered, 0)
export const deliveredCartons = (order) => order.order_lines.reduce((s, l) => s + lineDelivered(l), 0)
export const isFull = (order) => order.order_lines.every((l) => lineDelivered(l) >= l.cartons_ordered)
export const anyDelivered = (order) => order.order_lines.some((l) => lineDelivered(l) > 0)

// Extra = delivered beyond what was ordered: Dihantar Lebih on an ordered line,
// or a buffer item with no order (line ordered 0, is_extra). One rule for both.
export const extraCartons = (line) => Math.max(0, lineDelivered(line) - line.cartons_ordered)
export const hasExtra = (order) => order.order_lines.some((l) => extraCartons(l) > 0)
// Cartons in batches 3+ (Penghantaran Extra and delivery staff entries), which
// the normal 2-batch delivery form does not edit.
export const bufferQty = (line) => (line.delivery_batches || []).filter((b) => b.batch_no >= 3).reduce((s, b) => s + (b.qty || 0), 0)

// How one line's deliveries lay out in the two Batch boxes of the operator's delivery form.
//  - Batch 1 / Batch 2 entered by the operator stay in their own box.
//  - Ordinary delivery-staff entries (they carry a drop_id and are not the "extra part") fill the
//    FREE box(es), oldest delivery first. Those boxes are display only (staffSlot[n] = true).
//  - Everything else (the operator's Penghantaran Extra, staff extras, a third staff batch) is `rest`.
export function deliverySlots(line) {
  const all = line.delivery_batches || []
  const slots = { 1: all.find((b) => b.batch_no === 1) || null, 2: all.find((b) => b.batch_no === 2) || null }
  const staffSlot = { 1: false, 2: false }
  const staff = all
    .filter((b) => b.batch_no >= 3 && b.drop_id && !b.is_extra_part)
    .sort((a, b) => (a.delivered_date || '').localeCompare(b.delivered_date || '') || a.batch_no - b.batch_no)
  const free = [1, 2].filter((n) => !slots[n])
  const placed = new Set()
  staff.slice(0, free.length).forEach((b, i) => { slots[free[i]] = b; staffSlot[free[i]] = true; placed.add(b) })
  const rest = all.filter((b) => b.batch_no >= 3 && !placed.has(b))
  return { slots, staffSlot, rest }
}
// Cartons in `rest`, so Batch 1 + Batch 2 + this always add up to the delivered total.
export const restQty = (line) => deliverySlots(line).rest.reduce((s, b) => s + (b.qty || 0), 0)

export const STATUS_META = {
  pending: { key: 'stPending', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  partial: { key: 'stPartial', cls: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  overdue: { key: 'stOverdue', cls: 'bg-red-100 text-red-700 border-red-200' },
  accomplished: { key: 'stDone', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  accomplished_late: { key: 'stLate', cls: 'bg-emerald-50 text-emerald-700 border-amber-300' },
  cancelled: { key: 'stCancelled', cls: 'bg-slate-100 text-slate-400 border-slate-200' },
}

export function displayStatus(order, now) {
  if (order.cancelled) return 'cancelled'
  const due = dueDate(order)
  if (isFull(order)) {
    return order.completed_date && new Date(order.completed_date) > due ? 'accomplished_late' : 'accomplished'
  }
  if (now > due) return 'overdue'
  return anyDelivered(order) ? 'partial' : 'pending'
}

export const canEdit = (order, now) =>
  !order.cancelled && deliveredCartons(order) === 0 && daysSince(order.order_date, now) <= EDIT_DAYS

// Cartons still outstanding per product across all of this outlet's open
// orders — drives the "you have items awaiting delivery" warning banner
// and the reorder-confirmation modal.
export function outstandingFor(orders) {
  const map = {}
  orders.filter((o) => !o.cancelled && !isFull(o)).forEach((o) => {
    o.order_lines.forEach((l) => {
      const out = l.cartons_ordered - lineDelivered(l)
      if (out > 0) {
        if (!map[l.product_id]) map[l.product_id] = { productId: l.product_id, product: l.product, cartons: 0, orderNos: new Set() }
        map[l.product_id].cartons += out
        map[l.product_id].orderNos.add(o.order_no)
      }
    })
  })
  return Object.values(map).map((v) => ({ ...v, orderNos: [...v.orderNos] }))
}

// Cartons ordered vs. delivered per product, across every non-cancelled
// order network-wide (any outlet, any order date) — drives the
// "Production" tab floor briefing sheet. Unlike outstandingFor, this does
// NOT filter out full orders: it needs the running ordered/delivered
// totals per product so the table still adds up even when balance is 0.
// balance is summed per line and floored at 0, so an extra delivery
// (Dihantar Lebih) to one outlet never cancels another outlet's outstanding.
export function productionSummary(orders) {
  const map = {}
  orders.filter((o) => !o.cancelled).forEach((o) => {
    o.order_lines.forEach((l) => {
      if (!map[l.product_id]) map[l.product_id] = { productId: l.product_id, product: l.product, ordered: 0, delivered: 0, balance: 0 }
      const del = lineDelivered(l)
      map[l.product_id].ordered += l.cartons_ordered
      map[l.product_id].delivered += del
      map[l.product_id].balance += Math.max(0, l.cartons_ordered - del)
    })
  })
  return Object.values(map)
}
