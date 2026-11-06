import writeXlsxFile from 'write-excel-file/browser'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { reportRows } from './deliveryLog'

const COLUMNS = [
  { header: 'Date', key: 'date', width: 12 },
  { header: 'Outlet code', key: 'outletCode', width: 12 },
  { header: 'Outlet', key: 'outlet', width: 26 },
  { header: 'Product code', key: 'productCode', width: 12 },
  { header: 'Product', key: 'product', width: 34 },
  { header: 'Cartons', key: 'cartons', width: 9 },
  { header: 'Expiry', key: 'expiry', width: 12 },
  { header: 'Order no.', key: 'orderNo', width: 14 },
  { header: 'Type', key: 'type', width: 18 },
  { header: 'Entered by', key: 'enteredBy', width: 18 },
]

const fileStamp = (from, to) => (from === to ? from : `${from}_to_${to}`)

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// rows: listDeliveries() output
export async function downloadDeliveryExcel(rows, from, to) {
  const flat = reportRows(rows)
  const head = COLUMNS.map((c) => ({ value: c.header, fontWeight: 'bold', backgroundColor: '#e2e8f0' }))
  const body = flat.map((r) => COLUMNS.map((c) => (r[c.key] === '' ? null : r[c.key])))
  const total = flat.reduce((s, r) => s + r.cartons, 0)
  const totalRow = COLUMNS.map((c, i) => {
    if (i === 4) return { value: 'Total cartons', fontWeight: 'bold' }
    if (c.key === 'cartons') return { value: total, fontWeight: 'bold' }
    return null
  })
  const blob = await writeXlsxFile([head, ...body, totalRow], {
    columns: COLUMNS.map((c) => ({ width: c.width })),
    sheet: 'Deliveries',
  }).toBlob()
  saveBlob(blob, `ck-deliveries-${fileStamp(from, to)}.xlsx`)
}

export function downloadDeliveryPdf(rows, from, to) {
  const flat = reportRows(rows)
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' })
  const W = doc.internal.pageSize.getWidth(), M = 36
  const teal = [13, 148, 136], ink = [15, 23, 42], mute = [100, 116, 139], line = [203, 213, 225], violet = [109, 40, 217]

  doc.setFillColor(...teal); doc.roundedRect(M, 28, 30, 30, 5, 5, 'F')
  doc.setTextColor(255, 255, 255); doc.setFont('courier', 'bold'); doc.setFontSize(14); doc.text('CK', M + 15, 48, { align: 'center' })
  doc.setTextColor(...ink); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('CK Products', M + 40, 42)
  doc.setTextColor(...mute); doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text(`Laporan Penghantaran  ·  ${from} hingga ${to}`, M + 40, 55)
  doc.setFontSize(8); doc.text('Dicetak ' + new Date().toLocaleString('en-GB'), W - M, 55, { align: 'right' })
  doc.setDrawColor(...ink); doc.setLineWidth(1.5); doc.line(M, 66, W - M, 66)

  const total = flat.reduce((s, r) => s + r.cartons, 0)
  const body = flat.map((r) => [r.date, `${r.outletCode} ${r.outlet}`, `${r.productCode} ${r.product}`, String(r.cartons), r.expiry || '—', r.orderNo, r.type, r.enteredBy])
  body.push([{ content: 'Jumlah karton', colSpan: 3, styles: { fontStyle: 'bold' } }, { content: String(total), styles: { fontStyle: 'bold', halign: 'right' } }, { content: '', colSpan: 4 }])

  autoTable(doc, {
    head: [['Tarikh', 'Outlet', 'Produk', 'Karton', 'Luput', 'No. Tempahan', 'Jenis', 'Dimasukkan oleh']],
    body, startY: 78, margin: { left: M, right: M }, theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 4, lineColor: line, lineWidth: 0.4, textColor: ink, valign: 'middle' },
    headStyles: { fillColor: [241, 245, 249], textColor: mute, fontStyle: 'bold', fontSize: 7.5 },
    columnStyles: { 3: { halign: 'right', font: 'courier' }, 4: { font: 'courier' }, 5: { font: 'courier' } },
    didParseCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 6) return
      if (data.cell.raw === 'Dihantar Lebih' || data.cell.raw === 'Penghantaran Extra') {
        data.cell.styles.textColor = violet; data.cell.styles.fontStyle = 'bold'
      }
    },
  })
  doc.save(`ck-deliveries-${fileStamp(from, to)}.pdf`)
}
