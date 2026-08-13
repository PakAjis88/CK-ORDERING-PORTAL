import { interp, SLIP_DICT } from './i18n'
import { fmt, fmtDate } from './format'
import { orderedCartons } from './orderStatus'

// Fixed to Bahasa Melayu regardless of the outlet's active UI language, so
// the shared WhatsApp group stays consistent (confirmed decision).
export function receiptText(order) {
  const st = (k, vars) => interp(SLIP_DICT[k], vars)
  return [
    st('slipHeader'),
    `${st('slipOrderNo')} : ${order.order_no}`,
    `${st('slipOutlet')} : ${order.outlet?.name ?? ''}`,
    `${st('slipProducts')} : ${order.order_lines.length} ${st('slipItems')} · ${orderedCartons(order)} ${st('slipCartons')}`,
    `${st('slipValue')} : ${fmt(order.total)} ${st('slipEst')}`,
    `${st('slipDate')} : ${fmtDate(order.order_date)}`,
  ].join('\n')
}
