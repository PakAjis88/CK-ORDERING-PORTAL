import { Fragment, useMemo, useState } from 'react'
import { useT } from '../../lib/i18n'
import { fmt, fmtDate, monthKey, monthLabel, dueDate, todayISO } from '../../lib/format'
import { displayStatus, deliveredCartons, orderedCartons, lineDelivered, STATUS_META } from '../../lib/orderStatus'
import { recordDelivery } from '../../lib/api/orders'
import { downloadOrderPdf, downloadBatchPdf } from '../../lib/workOrderPdf'
import { downloadCsv } from '../../lib/csv'
import { Th, Td, Badge, Stat, Select, ReorderBadge } from '../../components/ui'

const STATUS_EN = {
  pending: 'Pending', partial: 'Partial', overdue: 'Overdue',
  accomplished: 'Accomplished', accomplished_late: 'Done (late)', cancelled: 'Cancelled',
}

// Sort priority for lines inside the expanded delivery-entry table: a line
// with an outstanding follow-up delivery (already partially delivered per
// persisted delivery_batches) surfaces first, then untouched lines, then
// fully-delivered lines last. Reads persisted data only (not the in-progress
// `draft` state), so it doesn't reshuffle rows mid-edit during the session.
const lineStage = (l) => {
  const delivered = lineDelivered(l)
  if (delivered > 0 && delivered < l.cartons_ordered) return 0 // needs follow-up
  if (delivered === 0) return 1 // untouched
  return 2 // fully delivered
}

export default function OrdersDashboard({ now, orders, outlets, onChanged }) {
  const { t } = useT()
  const months = useMemo(() => [...new Set(orders.map((o) => monthKey(o.order_date)))].sort().reverse(), [orders])
  const [month, setMonth] = useState('all')
  const [outlet, setOutlet] = useState('all')
  const [status, setStatus] = useState('all')
  const [expanded, setExpanded] = useState(null)
  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState(false)
  const [printingBatch, setPrintingBatch] = useState(false)

  const todaysOrders = useMemo(() => orders.filter((o) => o.order_date === todayISO() && !o.cancelled), [orders])
  const printToday = () => {
    setPrintingBatch(true)
    try { downloadBatchPdf(todaysOrders, todayISO()) } finally { setPrintingBatch(false) }
  }

  const rows = orders.filter((o) => {
    if (month !== 'all' && monthKey(o.order_date) !== month) return false
    if (outlet !== 'all' && o.outlet_id !== outlet) return false
    if (status !== 'all' && displayStatus(o, now) !== status) return false
    return true
  })
  const scope = (month === 'all' ? orders : orders.filter((o) => monthKey(o.order_date) === month)).filter((o) => !o.cancelled)
  const value = scope.reduce((s, o) => s + Number(o.total), 0)
  const cnt = (k) => scope.filter((o) => displayStatus(o, now) === k).length
  const rate = scope.length ? Math.round((cnt('accomplished') / scope.length) * 100) : 0

  const openRow = (o) => {
    setExpanded(o.id)
    setDraft(Object.fromEntries(o.order_lines.map((l) => {
      const b = l.delivery_batches || []
      const b1 = b.find((x) => x.batch_no === 1), b2 = b.find((x) => x.batch_no === 2)
      return [l.id, {
        q1: b1?.qty || 0, e1: b1?.expiry_date || '', dd1: b1?.delivered_date || todayISO(),
        q2: b2?.qty || 0, e2: b2?.expiry_date || '', dd2: b2?.delivered_date || todayISO(),
      }]
    })))
  }
  const setField = (lineId, field, val, ordered) => setDraft((d) => {
    const row = { ...d[lineId], [field]: val }
    let q1 = Number(row.q1) || 0, q2 = Number(row.q2) || 0
    if (field === 'q1') { q1 = Math.max(0, Math.min(ordered, q1)); q2 = Math.min(q2, ordered - q1) }
    if (field === 'q2') { q2 = Math.max(0, Math.min(ordered, q2)); q1 = Math.min(q1, ordered - q2) }
    return { ...d, [lineId]: { ...row, q1, q2 } }
  })
  const markAll = (o) => setDraft(Object.fromEntries(o.order_lines.map((l) => {
    const persisted = lineDelivered(l)
    const d = draft[l.id] || {}
    if (persisted > 0 && persisted < l.cartons_ordered) {
      const b1 = (l.delivery_batches || []).find((x) => x.batch_no === 1)
      return [l.id, {
        q1: b1?.qty || 0, e1: b1?.expiry_date || '', dd1: b1?.delivered_date || todayISO(),
        q2: l.cartons_ordered - persisted, e2: d.e2 || '', dd2: d.dd2 || todayISO(),
      }]
    }
    return [l.id, { q1: l.cartons_ordered, e1: d.e1 || '', dd1: d.dd1 || todayISO(), q2: 0, e2: '', dd2: todayISO() }]
  })))
  const save = async (o) => {
    setSaving(true)
    try {
      const lines = o.order_lines.map((l) => {
        const d = draft[l.id] || {}
        return {
          orderLineId: l.id,
          batch1Qty: d.q1 || 0, batch1Expiry: d.e1 || null, batch1DeliveredDate: d.dd1 || null,
          batch2Qty: d.q2 || 0, batch2Expiry: d.e2 || null, batch2DeliveredDate: d.dd2 || null,
        }
      })
      await recordDelivery(o.id, lines)
      await onChanged()
      setExpanded(null)
    } finally {
      setSaving(false)
    }
  }

  const exportCsv = () => {
    const head = ['Order No', 'Outlet', 'Order Date', 'Due Date', 'Product', 'Ordered', 'Delivered', 'Outstanding', 'Batch1 Qty', 'Batch1 Delivered', 'Batch1 Expiry', 'Batch2 Qty', 'Batch2 Delivered', 'Batch2 Expiry', 'Line Value', 'Order Total', 'Status', 'Completed', 'Note']
    const out = [head.join(',')]
    rows.forEach((o) => {
      const st = STATUS_EN[displayStatus(o, now)]
      const due = dueDate(o).toISOString().slice(0, 10)
      o.order_lines.forEach((l) => {
        const b = l.delivery_batches || []
        const b1 = b.find((x) => x.batch_no === 1), b2 = b.find((x) => x.batch_no === 2)
        out.push([
          o.order_no, `"${o.outlet.name}"`, o.order_date, due, `"${l.product.name}"`, l.cartons_ordered, lineDelivered(l), l.cartons_ordered - lineDelivered(l),
          b1?.qty || '', b1?.delivered_date || '', b1?.expiry_date || '', b2?.qty || '', b2?.delivered_date || '', b2?.expiry_date || '',
          Number(l.line_value).toFixed(2), Number(o.total).toFixed(2), st, o.completed_date || '', `"${o.note || ''}"`,
        ].join(','))
      })
    })
    downloadCsv(out.join('\n'), `ck-orders-${month}.csv`)
  }

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        <Stat label={t('statOrders')} value={scope.length} />
        <Stat label={t('statValue')} value={fmt(value)} mono />
        <Stat label={t('statRate')} value={`${rate}%`} tone={rate >= 70 ? 'good' : 'warn'} />
        <Stat label={t('statPending')} value={cnt('pending')} tone={cnt('pending') ? 'warn' : 'muted'} />
        <Stat label={t('statPartial')} value={cnt('partial')} tone={cnt('partial') ? 'info' : 'muted'} />
        <Stat label={t('statOverdue')} value={cnt('overdue')} tone={cnt('overdue') ? 'bad' : 'muted'} />
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        <Select value={month} onChange={setMonth} label={t('month')} options={[['all', t('allMonths')], ...months.map((m) => [m, monthLabel(m)])]} />
        <Select value={outlet} onChange={setOutlet} label={t('colOutlet')} options={[['all', t('allOutlets')], ...outlets.map((o) => [o.id, o.name])]} />
        <Select value={status} onChange={setStatus} label={t('status')} options={[['all', t('allStatuses')], ['pending', t('stPending')], ['partial', t('stPartial')], ['overdue', t('stOverdue')], ['accomplished', t('stDone')], ['accomplished_late', t('stLate')], ['cancelled', t('stCancelled')]]} />
        <button
          onClick={printToday} disabled={todaysOrders.length === 0 || printingBatch}
          className="ml-auto text-sm bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 px-4 py-2 rounded-lg font-medium"
        >
          {printingBatch ? '…' : t('printBatch', { n: todaysOrders.length })}
        </button>
        <button onClick={exportCsv} className="text-sm bg-white border border-slate-300 hover:bg-slate-50 px-4 py-2 rounded-lg font-medium">{t('exportCsv')}</button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr><Th>{t('colOrderNo')}</Th><Th>{t('colOutlet')}</Th><Th>{t('colDate')}</Th><Th right>{t('colItems')}</Th><Th right>{t('colDelivered')}</Th><Th right>{t('colValue')}</Th><Th>{t('colStatus')}</Th><Th /></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="text-center text-slate-400 py-8 text-sm">{t('noMatch')}</td></tr>}
            {rows.map((o) => {
              const st = displayStatus(o, now)
              const del = deliveredCartons(o), ord = orderedCartons(o)
              const isOpen = expanded === o.id
              const locked = o.cancelled
              const sortedLines = isOpen ? [...o.order_lines].sort((a, b) => lineStage(a) - lineStage(b)) : null
              return (
                <Fragment key={o.id}>
                  <tr className={`border-t border-slate-100 hover:bg-slate-50 ${locked ? 'opacity-50' : 'cursor-pointer'}`} onClick={() => (locked ? null : isOpen ? setExpanded(null) : openRow(o))}>
                    <Td mono>{o.order_no}{o.is_reorder && <ReorderBadge />}</Td>
                    <Td>{o.outlet.name}</Td>
                    <Td>{fmtDate(o.order_date)}</Td>
                    <Td right mono>{o.order_lines.length}</Td>
                    <Td right mono><span className={del < ord ? 'text-amber-600' : 'text-emerald-600'}>{del}/{ord}</span></Td>
                    <Td right mono>{fmt(o.total)}</Td>
                    <Td><Badge st={st} /></Td>
                    <Td>
                      <div className="flex items-center gap-2 justify-end">
                        <PdfBtn order={o} />
                        {!locked && <span className="text-xs text-teal-700 whitespace-nowrap">{isOpen ? '▾' : '▸'} {t('viewDetails')}</span>}
                      </div>
                    </Td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-slate-50 border-t border-slate-100">
                      <td colSpan={8} className="px-4 py-4">
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {t('fulfilTitle')} · <span className="text-slate-400 normal-case font-normal">{t('dueBy', { date: fmtDate(dueDate(o).toISOString().slice(0, 10)) })}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <button onClick={() => markAll(o)} className="text-xs text-teal-700 hover:underline">{t('markAllDelivered')}</button>
                            <PdfBtn order={o} label={t('downloadPdf')} />
                          </div>
                        </div>
                        <div className="border border-slate-200 rounded-lg overflow-x-auto bg-white">
                          <table className="w-full text-sm min-w-[820px]">
                            <thead className="bg-slate-50 text-slate-400 text-xs">
                              <tr><Th>{t('colProduct')}</Th><Th right>{t('ordered')}</Th><Th right>{t('del1')}</Th><Th>{t('date1')}</Th><Th>{t('exp1')}</Th><Th right>{t('del2')}</Th><Th>{t('date2')}</Th><Th>{t('exp2')}</Th><Th>{t('lineStatus')}</Th></tr>
                            </thead>
                            <tbody>
                              {sortedLines.map((l) => (
                                <DeliveryLineRow key={l.id} l={l} d={draft[l.id] || { q1: 0, e1: '', dd1: todayISO(), q2: 0, e2: '', dd2: todayISO() }} setField={setField} t={t} />
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => setExpanded(null)} className="border border-slate-300 hover:bg-slate-100 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg">{t('cancel')}</button>
                          <button onClick={() => save(o)} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-sm font-medium px-4 py-2 rounded-lg">{saving ? '…' : t('saveDelivery')}</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PdfBtn({ order, label }) {
  const [busy, setBusy] = useState(false)
  const go = async (e) => {
    e.stopPropagation()
    setBusy(true)
    try { downloadOrderPdf(order) } finally { setBusy(false) }
  }
  return <button onClick={go} disabled={busy} className="text-xs border border-slate-300 hover:bg-slate-50 disabled:opacity-50 px-2.5 py-1 rounded-md font-medium">{busy ? '…' : (label || 'PDF')}</button>
}

// A line that's already partially delivered (per persisted delivery_batches)
// locks batch 1's display to read-only and highlights batch 2 as the active
// follow-up input, plus an extra banner row calling out what's still owed —
// see plan doc for the "known limitation" note on lines with both batches
// already used but still short (needs the schema's batch_no cap lifted,
// out of scope here).
function DeliveryLineRow({ l, d, setField, t }) {
  const del2 = (Number(d.q1) || 0) + (Number(d.q2) || 0)
  const lnSt = del2 >= l.cartons_ordered ? 'd' : del2 > 0 ? 'p' : 'o'
  const persistedDelivered = lineDelivered(l)
  const isFollowUp = persistedDelivered > 0 && persistedDelivered < l.cartons_ordered
  const b1 = (l.delivery_batches || []).find((x) => x.batch_no === 1)
  const b1Locked = isFollowUp && (b1?.qty || 0) > 0

  return (
    <Fragment>
      <tr className="border-t border-slate-100">
        <Td>{l.product.name}</Td>
        <Td right mono>{l.cartons_ordered}</Td>
        <Td right>
          {b1Locked
            ? <span className="font-mono text-sm text-slate-500">{d.q1}</span>
            : <input value={d.q1} onChange={(e) => setField(l.id, 'q1', parseInt(e.target.value.replace(/\D/g, ''), 10) || 0, l.cartons_ordered)} inputMode="numeric" className="w-16 text-right border border-slate-300 rounded-md py-1 px-2 font-mono text-sm" />}
        </Td>
        <Td>
          {b1Locked
            ? <span className="font-mono text-xs text-slate-500">{fmtDate(d.dd1)}</span>
            : <input type="date" value={d.dd1} onChange={(e) => setField(l.id, 'dd1', e.target.value, l.cartons_ordered)} className="border border-slate-300 rounded-md py-1 px-2 font-mono text-xs" />}
        </Td>
        <Td>
          {b1Locked
            ? <span className="font-mono text-xs text-slate-500">{fmtDate(d.e1)}</span>
            : <input type="date" value={d.e1} onChange={(e) => setField(l.id, 'e1', e.target.value, l.cartons_ordered)} className={`border rounded-md py-1 px-2 font-mono text-xs ${(Number(d.q1) || 0) > 0 && !d.e1 ? 'border-amber-300' : 'border-slate-300'}`} />}
        </Td>
        <Td right>
          <input value={d.q2} onChange={(e) => setField(l.id, 'q2', parseInt(e.target.value.replace(/\D/g, ''), 10) || 0, l.cartons_ordered)} inputMode="numeric" className={`w-16 text-right border rounded-md py-1 px-2 font-mono text-sm ${isFollowUp ? 'bg-amber-100 border-amber-300' : 'border-slate-300'}`} />
        </Td>
        <Td>
          <input type="date" value={d.dd2} onChange={(e) => setField(l.id, 'dd2', e.target.value, l.cartons_ordered)} className={`border rounded-md py-1 px-2 font-mono text-xs ${isFollowUp ? 'bg-amber-100 border-amber-300' : 'border-slate-300'}`} />
        </Td>
        <Td>
          <input type="date" value={d.e2} onChange={(e) => setField(l.id, 'e2', e.target.value, l.cartons_ordered)} className={`border rounded-md py-1 px-2 font-mono text-xs ${isFollowUp ? 'bg-amber-100 border-amber-300' : ((Number(d.q2) || 0) > 0 && !d.e2 ? 'border-amber-300' : 'border-slate-300')}`} />
        </Td>
        <Td>
          {lnSt === 'd' && <span className="text-xs text-emerald-600 font-medium">✓ {t('lnDelivered')}</span>}
          {lnSt === 'p' && isFollowUp && <span className="text-xs text-amber-700 font-bold">⚠ {t('lnPartial')} · {t('remaining', { c: l.cartons_ordered - del2 })}</span>}
          {lnSt === 'p' && !isFollowUp && <span className="text-xs text-indigo-600 font-medium">{t('lnPartial')} · {t('remaining', { c: l.cartons_ordered - del2 })}</span>}
          {lnSt === 'o' && <span className="text-xs text-amber-600 font-medium">{t('lnOutstanding')}</span>}
        </Td>
      </tr>
      {isFollowUp && (
        <tr className="bg-amber-50 border-t border-amber-100">
          <td colSpan={9} className="px-4 py-1.5 text-xs text-amber-700 font-medium">
            {t('outstandingFollowUp', { c: l.cartons_ordered - persistedDelivered })}
          </td>
        </tr>
      )}
    </Fragment>
  )
}
