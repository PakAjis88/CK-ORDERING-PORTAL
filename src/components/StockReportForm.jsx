import { useT, CAT_ORDER } from '../lib/i18n'
import { Th, Td, Thumb } from './ui'
import ExpiryDateInput, { isValidExpiry, MAX_YEAR } from './ExpiryDateInput'

// Barang Kering & Kacang (category 1) must report a first expiry date when
// there's actual stock; Funfruits (category 2) may always leave it blank,
// and a zero (out-of-stock) quantity never requires one either way.
const expiryRequired = (p) => p.category === 1
const hasStock = (r) => r?.qty !== '' && Number(r.qty) > 0

export default function StockReportForm({ products, rows, setRow, editable, saving, onSubmit, submitLabel, fixedMobileBar = true }) {
  const { t, catName } = useT()

  const missingExpiry = products.filter((p) => expiryRequired(p) && hasStock(rows[p.id]) && !rows[p.id]?.expiry)
  const badExpiry = products.filter((p) => !isValidExpiry(rows[p.id]?.expiry) || !isValidExpiry(rows[p.id]?.expiry2))

  const handleSubmit = () => {
    if (missingExpiry.length > 0 || badExpiry.length > 0) return
    const lines = products
      .filter((p) => rows[p.id].qty !== '' && Number(rows[p.id].qty) >= 0)
      .map((p) => ({
        productId: p.id,
        qtyOnHand: Number(rows[p.id].qty),
        nearestExpiry: rows[p.id].expiry || null,
        qtyOnHand2: rows[p.id].qty2 !== '' ? Number(rows[p.id].qty2) : null,
        nearestExpiry2: rows[p.id].expiry2 || null,
      }))
    if (lines.length === 0) return
    onSubmit(lines)
  }

  const disabled = !editable || saving || missingExpiry.length > 0 || badExpiry.length > 0

  return (
    <div className={fixedMobileBar ? 'pb-24 lg:pb-0' : ''}>
      {missingExpiry.length > 0 && <div className="text-xs text-red-600 mb-3">{t('expiryRequired')}</div>}
      {badExpiry.length > 0 && <div className="text-xs text-red-600 mb-3">{t('expiryInvalid', { year: MAX_YEAR })}</div>}
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <Th />
              <Th>{t('colProduct')}</Th>
              <Th right>{t('qtyOnHand')}</Th>
              <Th>{t('nearestExpiry')}</Th>
              <Th right>{t('qtyOnHand2')}</Th>
              <Th>{t('nearestExpiry2')}</Th>
            </tr>
          </thead>
          <tbody>
            {CAT_ORDER.flatMap((cat) => [
              <tr key={'h' + cat} className="bg-slate-50/70">
                <td colSpan={6} className="px-4 py-2 text-sm font-bold uppercase tracking-wide text-slate-500 border-t border-slate-100">{catName(cat)}</td>
              </tr>,
              ...products.filter((p) => p.category === cat).map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <Td><Thumb src={p.photo_url} alt={p.name} /></Td>
                  <Td>
                    <div className="font-medium text-sm leading-tight">{p.name}</div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                      {t('unitsPerCartonHint', { n: p.units_per_carton, unit: p.units_per_carton > 1 ? t('unitP') : t('unitS') })}
                    </div>
                  </Td>
                  <Td right>
                    <input
                      disabled={!editable} value={rows[p.id]?.qty ?? ''}
                      onChange={(e) => setRow(p.id, 'qty', e.target.value.replace(/\D/g, ''))}
                      placeholder="0" inputMode="numeric"
                      className="w-24 text-right border border-slate-300 rounded-md py-1.5 px-2 font-mono text-sm disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </Td>
                  <Td>
                    <ExpiryDateInput
                      disabled={!editable} value={rows[p.id]?.expiry ?? ''}
                      onChange={(v) => setRow(p.id, 'expiry', v)}
                      highlight={expiryRequired(p) && hasStock(rows[p.id]) && !rows[p.id]?.expiry}
                    />
                    {expiryRequired(p) && <span className="text-red-500 text-xs align-top ml-0.5">*</span>}
                  </Td>
                  <Td right>
                    <input
                      disabled={!editable} value={rows[p.id]?.qty2 ?? ''}
                      onChange={(e) => setRow(p.id, 'qty2', e.target.value.replace(/\D/g, ''))}
                      placeholder="0" inputMode="numeric"
                      className="w-24 text-right border border-slate-300 rounded-md py-1.5 px-2 font-mono text-sm disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </Td>
                  <Td>
                    <ExpiryDateInput
                      disabled={!editable} value={rows[p.id]?.expiry2 ?? ''}
                      onChange={(v) => setRow(p.id, 'expiry2', v)}
                    />
                  </Td>
                </tr>
              )),
            ])}
          </tbody>
        </table>
        <div className={`${fixedMobileBar ? 'hidden lg:block' : ''} p-3 border-t border-slate-200`}>
          <button
            onClick={handleSubmit} disabled={disabled}
            className="bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition"
          >
            {saving ? '…' : submitLabel}
          </button>
        </div>
      </div>

      {/* Mobile: submit stays reachable without scrolling past the whole table */}
      {fixedMobileBar && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
          <button
            onClick={handleSubmit} disabled={disabled}
            className="w-full max-w-6xl mx-auto block bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-medium py-2.5 rounded-lg transition"
          >
            {saving ? '…' : submitLabel}
          </button>
        </div>
      )}
    </div>
  )
}
