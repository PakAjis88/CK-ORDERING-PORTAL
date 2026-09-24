// Typed dd/mm/yy expiry date. Emits an ISO date (yyyy-mm-dd) once the entry is a real date
// between 2000 and MAX_YEAR; while incomplete or invalid it emits the raw dd/mm/yy text instead,
// which isValidExpiry() rejects so the form can block submission.
export const MAX_YEAR = 2030

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

export const isValidExpiry = (v) => !v || ISO_RE.test(v)

const isoToDisplay = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`

const mask = (digits) => [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6)].filter(Boolean).join('/')

function parse(digits) {
  if (digits.length !== 6) return null
  const d = Number(digits.slice(0, 2)), m = Number(digits.slice(2, 4)), y = 2000 + Number(digits.slice(4, 6))
  if (y > MAX_YEAR || m < 1 || m > 12 || d < 1) return null
  if (d > new Date(Date.UTC(y, m, 0)).getUTCDate()) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export default function ExpiryDateInput({ value, onChange, disabled, highlight }) {
  const display = ISO_RE.test(value || '') ? isoToDisplay(value) : value || ''
  const invalid = !isValidExpiry(value)

  const handleChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 6)
    onChange(parse(digits) ?? mask(digits))
  }

  return (
    <input
      disabled={disabled} value={display} onChange={handleChange}
      placeholder="dd/mm/yy" inputMode="numeric" maxLength={8}
      className={`w-28 border rounded-md py-1.5 px-2 font-mono text-sm disabled:bg-slate-50 disabled:text-slate-400 ${
        invalid || highlight ? 'border-red-400 focus:outline-red-400' : 'border-slate-300'
      }`}
    />
  )
}
