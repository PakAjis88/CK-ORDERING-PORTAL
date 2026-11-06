// Pure helpers over the rows returned by listDeliveries() (one row per batch).

export const KIND_LABEL = { normal: 'Normal', dihantar_lebih: 'Dihantar Lebih', penghantaran_extra: 'Penghantaran Extra' }

// One entry = one product within one delivery (drop). It can span several
// rows when the cartons knocked off more than one order.
export function groupEntries(rows) {
  const map = new Map()
  rows.forEach((r) => {
    const key = `${r.dropId}:${r.productId}`
    if (!map.has(key)) {
      map.set(key, {
        key, dropId: r.dropId, productId: r.productId, deliveredDate: r.deliveredDate,
        outletCode: r.outletCode, outletName: r.outletName, productCode: r.productCode, productName: r.productName,
        expiry: r.expiry, enteredBy: r.enteredBy, photoPath: r.photoPath, canCorrect: r.canCorrect, createdAt: r.createdAt,
        cartons: 0, parts: [],
      })
    }
    const e = map.get(key)
    e.cartons += r.cartons
    e.parts.push({ orderNo: r.orderNo, cartons: r.cartons, kind: r.kind })
  })
  return [...map.values()].sort((a, b) =>
    b.deliveredDate.localeCompare(a.deliveredDate) ||
    a.outletCode.localeCompare(b.outletCode) ||
    a.productCode.localeCompare(b.productCode))
}

export const extraOf = (entry) => entry.parts.filter((p) => p.kind !== 'normal')

// Flat rows for the Excel / PDF report: one line per batch so the order that
// was knocked off is visible, with extras marked.
export function reportRows(rows) {
  return rows.map((r) => ({
    date: r.deliveredDate, outletCode: r.outletCode, outlet: r.outletName,
    productCode: r.productCode, product: r.productName, cartons: r.cartons,
    expiry: r.expiry || '', orderNo: r.orderNo, type: KIND_LABEL[r.kind] || r.kind, enteredBy: r.enteredBy,
  }))
}
