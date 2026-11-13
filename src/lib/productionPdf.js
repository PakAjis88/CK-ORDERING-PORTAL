import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { CAT, CAT_ORDER } from './i18n'
import { todayISO } from './format'
import { deliveryCells } from './productionSheets'

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

const dmy = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

// One product's sheet for packing / delivery: outlet | qty ordered | four "Hantar" columns that
// staff write in by hand. Deliveries already recorded are pre-filled, first date in the first
// column. sheet: productSheet() result; range: { from, to } order dates (ISO).
export function downloadProductSheetPdf(sheet, product, range) {
  const doc = buildProductSheetDoc(sheet, product, range)
  doc.save(`ck-pengeluaran-${product.code}-${todayISO()}.pdf`)
}

function buildProductSheetDoc(sheet, product, range) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 40
  const teal = [13, 148, 136], ink = [15, 23, 42], mute = [100, 116, 139], line = [203, 213, 225]

  doc.setFillColor(...teal); doc.roundedRect(M, 30, 30, 30, 5, 5, 'F')
  doc.setTextColor(255, 255, 255); doc.setFont('courier', 'bold'); doc.setFontSize(14)
  doc.text('CK', M + 15, 50, { align: 'center' })
  doc.setTextColor(...ink); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('CK Products', M + 40, 44)
  doc.setTextColor(...mute); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text('Senarai Pengeluaran', M + 40, 57)
  doc.setFontSize(8); doc.text('Dicetak ' + printDateTime(), W - M, 58, { align: 'right' })
  doc.setDrawColor(...ink); doc.setLineWidth(1.5); doc.line(M, 70, W - M, 70)

  doc.setTextColor(...ink); doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.text(product.name, M, 96)
  doc.setTextColor(...mute); doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text(`${product.code}  ·  Tempahan ${dmy(range.from)} hingga ${dmy(range.to)}`, M, 111)

  if (sheet.rows.length === 0) {
    doc.setTextColor(...mute); doc.setFontSize(11)
    doc.text('Tiada tempahan untuk produk ini dalam julat tarikh ini.', M, 150)
    return doc
  }

  const body = sheet.rows.map((r, i) => {
    const cells = deliveryCells(r.deliveries, 4)
    return [String(i + 1), `${r.code}  ${r.name}`, String(r.ordered), ...cells.map((c) => (c ? { content: String(c.qty) + (c.more ? ' +' : ''), date: c.date } : ''))]
  })

  autoTable(doc, {
    head: [['Bil', 'Outlet', 'Dipesan', 'Hantar 1', 'Hantar 2', 'Hantar 3', 'Hantar 4']],
    body, startY: 124, margin: { left: M, right: M }, theme: 'grid',
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 5, lineColor: line, lineWidth: 0.5, textColor: ink, valign: 'middle', minCellHeight: 32 },
    headStyles: { fillColor: [241, 245, 249], textColor: mute, fontStyle: 'bold', fontSize: 8, minCellHeight: 20, halign: 'center' },
    columnStyles: {
      0: { cellWidth: 26, halign: 'center', textColor: mute },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 54, halign: 'center', fontStyle: 'bold', fontSize: 13 },
      3: { cellWidth: 58, halign: 'center', valign: 'top', fontSize: 12 },
      4: { cellWidth: 58, halign: 'center', valign: 'top', fontSize: 12 },
      5: { cellWidth: 58, halign: 'center', valign: 'top', fontSize: 12 },
      6: { cellWidth: 58, halign: 'center', valign: 'top', fontSize: 12 },
    },
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index === 1) data.cell.styles.halign = 'left'
    },
    // the delivery date sits small under a pre-filled quantity
    didDrawCell: (data) => {
      if (data.section !== 'body' || data.column.index < 3) return
      const raw = data.cell.raw
      if (!raw || typeof raw !== 'object' || !raw.date) return
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...mute)
      doc.text(dm(raw.date), data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height - 4, { align: 'center' })
    },
  })

  // the big total: cartons still to produce
  let y = doc.lastAutoTable.finalY + 28
  if (y > H - 100) { doc.addPage(); y = 70 }
  doc.setDrawColor(...ink); doc.setLineWidth(1.5); doc.line(M, y - 14, W - M, y - 14)
  doc.setTextColor(...ink); doc.setFont('helvetica', 'bold'); doc.setFontSize(20)
  doc.text(`JUMLAH PERLU DIKELUARKAN: ${sheet.totalBalance} karton`, M, y + 10)
  doc.setTextColor(...mute); doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text(`Dipesan ${sheet.totalOrdered}  ·  Sudah dihantar ${sheet.totalDelivered}`, M, y + 28)

  return doc
}
