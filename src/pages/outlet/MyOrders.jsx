import { Fragment, useState } from 'react'
import { useT } from '../../lib/i18n'
import { fmt, fmtDate } from '../../lib/format'
import { displayStatus, canEdit, deliveredCartons, orderedCartons, lineDelivered } from '../../lib/orderStatus'
import { Th, Td, Badge, Empty, ReorderBadge } from '../../components/ui'

export default function MyOrders({ now, orders, onEdit, onCancel }) {
  const { t } = useT()
  const [open, setOpen] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [busy, setBusy] = useState(false)

  if (orders.length === 0) return <Empty>{t('noOrdersYet')}</Empty>

  const confirmCancel = async () => {
    setBusy(true)
    try { await onCancel(cancelTarget); setCancelTarget(null) }
    finally { setBusy(false) }
  }

  return (
    <div>
      <div className="text-xs text-slate-500 mb-2">{t('editWithin')}</div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr><Th>{t('colOrderNo')}</Th><Th>{t('colDate')}</Th><Th right>{t('colItems')}</Th><Th right>{t('colDelivered')}</Th><Th right>{t('colValue')}</Th><Th>{t('colStatus')}</Th><Th /></tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const st = displayStatus(o, now)
              const isOpen = open === o.id
              const editable = canEdit(o, now)
              return (
                <Fragment key={o.id}>
                  <tr className={`border-t border-slate-100 hover:bg-slate-50 ${o.cancelled ? 'opacity-50' : ''}`}>
                    <Td mono><span className="cursor-pointer" onClick={() => setOpen(isOpen ? null : o.id)}>{o.order_no}</span>{o.is_reorder && <ReorderBadge />}</Td>
                    <Td>{fmtDate(o.order_date)}</Td>
                    <Td right mono>{o.order_lines.length}</Td>
                    <Td right mono>{deliveredCartons(o)}/{orderedCartons(o)}</Td>
                    <Td right mono>{fmt(o.total)}</Td>
                    <Td><Badge st={st} /></Td>
                    <Td>
                      {editable ? (
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => onEdit(o)} className="text-xs border border-slate-300 hover:bg-slate-50 px-2.5 py-1 rounded-md font-medium">{t('edit')}</button>
                          <button onClick={() => setCancelTarget(o)} className="text-xs border border-red-200 text-red-600 hover:bg-red-50 px-2.5 py-1 rounded-md font-medium">{t('cancelOrder')}</button>
                        </div>
                      ) : <span className="text-xs text-teal-700 cursor-pointer" onClick={() => setOpen(isOpen ? null : o.id)}>{isOpen ? '▾' : '▸'}</span>}
                    </Td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-slate-50 border-t border-slate-100">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="space-y-1">
                          {o.order_lines.map((l) => {
                            const del = lineDelivered(l)
                            const out = l.cartons_ordered - del
                            return (
                              <div key={l.id} className="flex justify-between text-xs">
                                <span className="text-slate-600">{l.product.name} <span className="font-mono">×{l.cartons_ordered}</span></span>
                                <span className="font-mono text-slate-500">
                                  {del}/{l.cartons_ordered} {t('lnDelivered').toLowerCase()}
                                  {(l.delivery_batches || []).length > 0 && (
                                    <span className="text-slate-400"> · {l.delivery_batches.map((b) => `${b.qty}@${fmtDate(b.expiry_date)}`).join(', ')}</span>
                                  )}
                                  {out > 0 && <span className="text-amber-700"> · {out} {t('outstanding')}</span>}
                                </span>
                              </div>
                            )
                          })}
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
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5">
            <h3 className="font-semibold mb-2">{t('cancelTitle')}</h3>
            <p className="text-sm text-slate-600 mb-4">{t('cancelBody', { orderNo: cancelTarget.order_no })}</p>
            <div className="flex gap-2">
              <button onClick={() => setCancelTarget(null)} className="flex-1 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium py-2.5 rounded-lg">{t('keepOrder')}</button>
              <button onClick={confirmCancel} disabled={busy} className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white text-sm font-medium py-2.5 rounded-lg">{t('cancelYes')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
