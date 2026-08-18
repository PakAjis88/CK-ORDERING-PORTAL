import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { CAT, CAT_ORDER } from './i18n'
import { todayISO } from './format'

const printDateTime = () => {
  const d = new Date()
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

// rows: pre-sorted [{ product, ordered, delivered, balance }, ...] — same
// shape as productionSummary() in orderStatus.js, already grouped by the
// caller's sort so the PDF matches whatever's on screen.
export function downloadProductionPdf(rows) {
  const doc = buildProductionDoc(rows)
  doc.save(`ck-production-${todayISO()}.pdf`)
}

function buildProductionDoc(rows) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth(), M = 40
  const teal = [13, 148, 136], ink = [15, 23, 42], mute = [100, 116, 139], line = [203, 213, 225]
  const amberFill = [255, 251, 235], brown = [146, 64, 14]

  doc.setFillColor(...teal); doc.roundedRect(M, 30, 30, 30, 5, 5, 'F')
  doc.setTextColor(255, 255, 255); doc.setFont('courier', 'bold'); doc.setFontSize(14)
  doc.text('CK', M + 15, 50, { align: 'center' })
  doc.setTextColor(...ink); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('CK Products', M + 40, 44)
  doc.setTextColor(...mute); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text('Ringkasan Pengeluaran', M + 40, 57)
  doc.setTextColor(...mute); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text('Dicetak ' + printDateTime(), W - M, 58, { align: 'right' })
  doc.setDrawColor(...ink); doc.setLineWidth(1.5); doc.line(M, 70, W - M, 70)

  const head = [['#', 'Produk', 'Ditempah', 'Dihantar', 'Baki']]
  const body = []
  let idx = 0, totOrdered = 0, totDelivered = 0, totBalance = 0
  CAT_ORDER.forEach((cat) => {
    const items = rows.filter((r) => r.product.category === cat)
    if (!items.length) return
    body.push([{ content: CAT[cat].ms, colSpan: 5, styles: { fillColor: [248, 250, 252], textColor: mute, fontStyle: 'bold', fontSize: 7.5, halign: 'left' } }])
    items.forEach((r) => {
      idx++
      totOrdered += r.ordered; totDelivered += r.delivered; totBalance += r.balance
      body.push([String(idx), r.product.name, String(r.ordered), String(r.delivered), { content: String(r.balance), styles: { fontStyle: 'bold' } }])
    })
  })
  body.push([{ content: 'Jumlah', colSpan: 2, styles: { fontStyle: 'bold' } }, { content: String(totOrdered), styles: { fontStyle: 'bold', halign: 'right' } }, { content: String(totDelivered), styles: { fontStyle: 'bold', halign: 'right' } }, { content: String(totBalance), styles: { fontStyle: 'bold', halign: 'right' } }])

  autoTable(doc, {
    head, body, startY: 88, margin: { left: M, right: M }, theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 5, lineColor: line, lineWidth: 0.4, textColor: ink, valign: 'middle' },
    headStyles: { fillColor: [255, 255, 255], textColor: mute, fontStyle: 'normal', fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: 24 }, 1: { cellWidth: 'auto' },
      2: { cellWidth: 70, halign: 'right', font: 'courier' },
      3: { cellWidth: 70, halign: 'right', font: 'courier' },
      4: { cellWidth: 70, halign: 'right', font: 'courier' },
    },
    didParseCell: (data) => {
      if (data.column.index !== 4) return
      if (data.section === 'head') { data.cell.styles.fillColor = amberFill; data.cell.styles.textColor = brown; return }
      const r0 = data.row.raw[0]
      const spanRow = r0 && typeof r0 === 'object' && r0.colSpan
      if (spanRow) return
      const balance = Number(data.cell.raw?.content ?? data.cell.raw)
      if (balance > 0) { data.cell.styles.fillColor = amberFill; data.cell.styles.textColor = brown }
    },
  })

  return doc
}
