import { useState } from 'react'
import { useT } from '../../lib/i18n'
import { listDeliveries } from '../../lib/api/deliveries'

// Fetches the delivery log for the chosen range and saves it as Excel or PDF.
export default function ReportButtons({ filters }) {
  const { t } = useT()
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const run = async (kind) => {
    setError('')
    setBusy(kind)
    try {
      const rows = await listDeliveries(filters.from, filters.to, filters.outletId)
      if (rows.length === 0) { setError(t('dlNoRows')); return }
      // loaded only when a report is asked for, so the Excel/PDF code does not slow down the first page load
      const { downloadDeliveryExcel, downloadDeliveryPdf } = await import('../../lib/deliveryReport')
      if (kind === 'excel') await downloadDeliveryExcel(rows, filters.from, filters.to)
      else downloadDeliveryPdf(rows, filters.from, filters.to)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy('')
    }
  }

  const btn = 'flex-1 rounded-xl text-base font-semibold py-3.5 disabled:opacity-50'
  return (
    <div>
      <div className="flex gap-3">
        <button onClick={() => run('excel')} disabled={!!busy} className={`${btn} bg-emerald-600 hover:bg-emerald-700 text-white`}>{busy === 'excel' ? '…' : t('dlExcel')}</button>
        <button onClick={() => run('pdf')} disabled={!!busy} className={`${btn} bg-slate-800 hover:bg-slate-900 text-white`}>{busy === 'pdf' ? '…' : t('dlPdf')}</button>
      </div>
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </div>
  )
}
