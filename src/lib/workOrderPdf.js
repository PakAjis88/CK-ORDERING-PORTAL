import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { CAT, CAT_ORDER } from './i18n'
import { fmtDate, dueDate } from './format'
import { displayStatus } from './orderStatus'

const STATUS_MS = {
  pending: 'Menunggu', partial: 'Sebahagian', overdue: 'Tertunggak',
  accomplished: 'Selesai', accomplished_late: 'Selesai (lewat)', cancelled: 'Dibatalkan',
}

const printDateTime = () => {
  const d = new Date()
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export function downloadOrderPdf(order) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth(), M = 40
  const teal = [13, 148, 136], ink = [15, 23, 42], mute = [100, 116, 139], line = [203, 213, 225]
  const amberFill = [255, 251, 235], brown = [146, 64, 14]

  doc.setFillColor(...teal); doc.roundedRect(M, 30, 30, 30, 5, 5, 'F')
  doc.setTextColor(255, 255, 255); doc.setFont('courier', 'bold'); doc.setFontSize(14)
  doc.text('CK', M + 15, 50, { align: 'center' })
  doc.setTextColor(...ink); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('CK Products', M + 40, 44)
  doc.setTextColor(...mute); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text('Arahan Pengeluaran & Penghantaran', M + 40, 57)
  doc.setTextColor(...ink); doc.setFont('courier', 'bold'); doc.setFontSize(16); doc.text(order.order_no, W - M, 46, { align: 'right' })
  doc.setTextColor(...mute); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text('Dicetak ' + printDateTime(), W - M, 58, { align: 'right' })
  doc.setDrawColor(...ink); doc.setLineWidth(1.5); doc.line(M, 70, W - M, 70)

  const now = new Date()
  const statusMs = STATUS_MS[displayStatus(order, now)]
  const due = dueDate(order)
  let y = 88
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...mute)
  doc.text('Outlet', M, y); doc.text('Status', W / 2, y)
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...ink)
  doc.text(order.outlet.name, M, y + 13)
  doc.setFont('courier', 'normal'); doc.setFontSize(8); doc.setTextColor(148, 163, 184)
  doc.text(order.outlet.code, M + doc.getTextWidth(order.outlet.name) * 1.15 + 8, y + 13)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...ink); doc.text(statusMs, W / 2, y + 13)
  if (order.is_reorder) { doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(79, 70, 229); doc.text('• TEMPAHAN SEMULA', W / 2 + 90, y + 13) }
  y += 30
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...mute)
  doc.text('Tarikh tempahan', M, y); doc.text('Perlu siap sebelum', W / 2, y)
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...ink)
  doc.text(fmtDate(order.order_date), M, y + 13); doc.text(fmtDate(due.toISOString().slice(0, 10)), W / 2, y + 13)
  y += 22; doc.setDrawColor(...line); doc.setLineWidth(0.5); doc.line(M, y, W - M, y); y += 6

  const head = [['#', 'Produk', 'Karton', 'Unit/ktn', 'Jumlah unit', 'Dihantar 1', 'Luput 1', 'Dihantar 2', 'Luput 2']]
  const body = []; let idx = 0, totKar = 0, totUnit = 0
  CAT_ORDER.forEach((cat) => {
    const items = order.order_lines.filter((l) => l.product.category === cat)
    if (!items.length) return
    body.push([{ content: CAT[cat].ms, colSpan: 9, styles: { fillColor: [248, 250, 252], textColor: mute, fontStyle: 'bold', fontSize: 7.5, halign: 'left' } }])
    items.forEach((l) => {
      idx++
      const units = l.cartons_ordered * l.units_per_carton_snapshot
      totKar += l.cartons_ordered; totUnit += units
      body.push([String(idx), l.product.name, String(l.cartons_ordered), String(l.units_per_carton_snapshot), { content: String(units), styles: { fontStyle: 'bold' } }, '', '', '', ''])
    })
  })
  body.push([{ content: 'Jumlah', colSpan: 2, styles: { fontStyle: 'bold' } }, { content: String(totKar), styles: { fontStyle: 'bold', halign: 'right' } }, '', { content: String(totUnit), styles: { fontStyle: 'bold', halign: 'right' } }, '', '', '', ''])

  autoTable(doc, {
    head, body, startY: y, margin: { left: M, right: M }, theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 4, lineColor: line, lineWidth: 0.4, textColor: ink, valign: 'middle' },
    headStyles: { fillColor: [255, 255, 255], textColor: mute, fontStyle: 'normal', fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 20 }, 1: { cellWidth: 'auto' },
      2: { cellWidth: 42, halign: 'right', font: 'courier' }, 3: { cellWidth: 46, halign: 'right', font: 'courier' },
      4: { cellWidth: 54, halign: 'right', font: 'courier' },
      5: { cellWidth: 56 }, 6: { cellWidth: 50 }, 7: { cellWidth: 56 }, 8: { cellWidth: 50 },
    },
    didParseCell: (data) => {
      const delivery = data.column.index >= 5
      if (data.section === 'head') { if (delivery) { data.cell.styles.fillColor = amberFill; data.cell.styles.textColor = brown; data.cell.styles.halign = 'center' } return }
      const r0 = data.row.raw[0]
      const spanRow = r0 && typeof r0 === 'object' && r0.colSpan
      if (delivery && !spanRow) { data.cell.styles.fillColor = amberFill; data.cell.styles.minCellHeight = 20 }
    },
  })

  let fy = doc.lastAutoTable.finalY + 16
  doc.setDrawColor(...line); doc.setLineWidth(0.5); doc.rect(M, fy, W - 2 * M, 42)
  doc.setFontSize(7); doc.setTextColor(...mute); doc.text('Catatan', M + 6, fy + 12)
  fy += 42 + 26
  const col = (W - 2 * M) / 3
  doc.setDrawColor(...mute); doc.setLineWidth(0.6)
  ;[0, 1, 2].forEach((i) => doc.line(M + i * col, fy, M + i * col + col - 14, fy))
  doc.setFontSize(7.5); doc.setTextColor(...mute)
  doc.text('Disediakan oleh', M, fy + 12); doc.text('Disemak & diterima oleh', M + col, fy + 12); doc.text('Tarikh', M + 2 * col, fy + 12)

  doc.save(`${order.order_no}.pdf`)
}
