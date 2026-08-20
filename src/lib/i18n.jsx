import { createContext, useContext, useMemo, useState } from 'react'

export const CAT = {
  1: { en: 'Dry Products & Nuts', ms: 'Barang Kering & Kacang' },
  2: { en: 'Funfruits Item', ms: 'Item FunFruits' },
}
export const CAT_ORDER = [1, 2]

const DICT = {
  en: {
    brandSub: 'MBG Outlet Network',
    outlet: 'Outlet', operator: 'Operator', signedInAs: 'Signed in as',
    tabNewOrder: 'New order', tabMyOrders: 'My orders', tabStock: 'Stock report',
    perCarton: '{price}/carton · {n} {unit}', unitS: 'unit', unitP: 'units', cartonLabel: 'CARTON',
    orderSummary: 'Order summary',
    orderEmpty: 'Add cartons to any product to start. Values update as you go.',
    itemsCartons: '{n} items · {c} cartons', estValue: 'Estimated value', placeOrder: 'Place order',
    orderPlaced: 'Order placed', copyIntro: 'Copy the slip below into your WhatsApp group.',
    slipTitle: 'CONFIRMATION SLIP', copyWa: 'Copy for WhatsApp', copied: 'Copied ✓', placeAnother: 'Place another order',
    colOrderNo: 'Order No', colDate: 'Date', colItems: 'Items', colCartons: 'Cartons',
    colDelivered: 'Delivered', colValue: 'Value', colStatus: 'Status', colProduct: 'Product', colOutlet: 'Outlet',
    noOrdersYet: 'No orders yet. Your placed orders will appear here with their status.',
    stPending: 'Pending', stPartial: 'Partial', stOverdue: 'Overdue', stDone: 'Accomplished', stLate: 'Done (late)', stCancelled: 'Cancelled',
    windowOpen: 'Reporting is open today. Report your nearest-expiry stock for {month}.',
    windowClosed: 'Reporting opens on the 20th of each month.',
    alreadySubmitted: 'Already submitted on {date} — submitting again will replace it.',
    qtyOnHand: 'Stock Balance 1 (Pack/Bottle)', nearestExpiry: 'Expiry Date 1', qtyOnHand2: 'Stock Balance 2 (Pack/Bottle)', nearestExpiry2: 'Expiry Date 2', unitsPerCartonHint: '{n} {unit}/carton', submitStock: 'Submit stock report',
    tabOrdersFulfil: 'Orders & fulfillment', tabStockTracker: 'Stock tracker', tabCatalogue: 'Catalogue',
    uploadPhoto: 'Upload photo', changePhoto: 'Change photo', deletePhoto: 'Delete photo',
    tabProduction: 'Production',
    statCartonsToProduce: 'Cartons to produce', statProductsToProduce: 'Products pending',
    balanceToProduce: 'Balance', printProduction: 'Print production summary',
    noProduction: 'No open orders right now — nothing to produce.',
    statOrders: 'Orders', statValue: 'Est. value', statRate: 'Fulfilment rate (30d)',
    statPending: 'Pending', statPartial: 'Partial', statOverdue: 'Overdue',
    statOutlets: 'Outlets', statSubmitted: 'Submitted', statOutstanding: 'Outstanding',
    month: 'Month', allMonths: 'All months', allOutlets: 'All outlets', status: 'Status', allStatuses: 'All statuses',
    exportCsv: 'Export CSV', noMatch: 'No orders match these filters.',
    printBatch: "Print today's orders ({n})",
    submittedN: 'Submitted · {n}', outstandingN: 'Outstanding · {n}',
    noSubs: 'No submissions for {month} yet.', allReported: 'All outlets have reported.',
    unitsExp: '{qty} units · exp {date}', outstanding: 'outstanding',
    fulfilTitle: 'Delivery / fulfillment', ordered: 'Ordered', lineStatus: 'Line status',
    markAllDelivered: 'Mark all delivered', saveDelivery: 'Save delivery', cancel: 'Cancel',
    lnDelivered: 'Delivered', lnPartial: 'Partial', lnOutstanding: 'Outstanding', remaining: '{c} left',
    outstandingFollowUp: '↳ Outstanding from earlier delivery — {c} cartons still to go out',
    viewDetails: 'Details', del1: 'Delivered 1', date1: 'Date 1', exp1: 'Expiry 1', del2: 'Delivered 2', date2: 'Date 2', exp2: 'Expiry 2', downloadPdf: 'Download PDF',
    dueBy: 'Due by {date}',
    reorderBadge: 'Re-order', awaitingTitle: 'You have items awaiting delivery',
    awaitingDesc: "These items from earlier orders haven't arrived in full yet. Only re-order what you truly haven't received.",
    awaitingItem: '{name} — {c} cartons outstanding (order {orders})',
    reorderModalTitle: 'Confirm re-order',
    reorderModalBody: 'You still have these items awaiting delivery from an earlier order:',
    reorderModalQ: "Are you re-ordering because you haven't received them yet? Placing this adds a new order on top of the pending one.",
    reorderConfirm: 'Yes, place re-order', reorderCancel: 'Cancel',
    edit: 'Edit', cancelOrder: 'Cancel', saveChanges: 'Save changes', editBack: 'Back without saving',
    editingBanner: 'Editing {orderNo} — allowed within 3 days of placing. After that, place a new order instead.',
    editWithin: 'Pending orders can be edited or cancelled within 3 days.',
    cancelTitle: 'Cancel this order?', cancelBody: "{orderNo} will be voided. This can't be undone.",
    cancelYes: 'Yes, cancel order', keepOrder: 'Keep it',
    loginTitle: 'Sign in', loginEmail: 'Email', loginPassword: 'Password', loginSubmit: 'Sign in',
    loginError: 'Invalid email or password.', signOut: 'Sign out',
    overrideOn: 'Stock window override is ON — reporting is open regardless of date.',
    overrideToggleOn: 'Force stock window open', overrideToggleOff: 'Stop forcing it open',
  },
  ms: {
    brandSub: 'Rangkaian Outlet MBG',
    outlet: 'Outlet', operator: 'Operator', signedInAs: 'Log masuk sebagai',
    tabNewOrder: 'Tempahan Baru', tabMyOrders: 'Tempahan Saya', tabStock: 'Laporan Stok',
    perCarton: '{price}/karton · {n} {unit}', unitS: 'unit', unitP: 'unit', cartonLabel: 'KARTON',
    orderSummary: 'Ringkasan Tempahan',
    orderEmpty: 'Tambah karton pada mana-mana produk untuk mula. Nilai dikemas kini secara automatik.',
    itemsCartons: '{n} item · {c} karton', estValue: 'Anggaran Nilai', placeOrder: 'Hantar Tempahan',
    orderPlaced: 'Tempahan Dihantar', copyIntro: 'Salin slip di bawah ke kumpulan WhatsApp anda.',
    slipTitle: 'SLIP PENGESAHAN', copyWa: 'Salin untuk WhatsApp', copied: 'Disalin ✓', placeAnother: 'Buat tempahan lain',
    colOrderNo: 'No. Tempahan', colDate: 'Tarikh', colItems: 'Item', colCartons: 'Karton',
    colDelivered: 'Dihantar', colValue: 'Nilai', colStatus: 'Status', colProduct: 'Produk', colOutlet: 'Outlet',
    noOrdersYet: 'Tiada tempahan lagi. Tempahan anda akan dipapar di sini beserta statusnya.',
    stPending: 'Menunggu', stPartial: 'Sebahagian', stOverdue: 'Tertunggak', stDone: 'Selesai', stLate: 'Selesai (lewat)', stCancelled: 'Dibatalkan',
    windowOpen: 'Laporan dibuka hari ini. Laporkan stok tarikh luput terdekat untuk {month}.',
    windowClosed: 'Laporan dibuka pada 20hb setiap bulan.',
    alreadySubmitted: 'Telah dihantar pada {date} — hantar semula akan menggantikannya.',
    qtyOnHand: 'Baki Stock 1 (Pack/Botol)', nearestExpiry: 'Tarikh Luput 1', qtyOnHand2: 'Baki Stock 2 (Pack/Botol)', nearestExpiry2: 'Tarikh Luput 2', unitsPerCartonHint: '{n} {unit}/karton', submitStock: 'Hantar Laporan Stok',
    tabOrdersFulfil: 'Tempahan & Pemenuhan', tabStockTracker: 'Penjejak Stok', tabCatalogue: 'Katalog',
    uploadPhoto: 'Muat naik foto', changePhoto: 'Tukar foto', deletePhoto: 'Padam foto',
    tabProduction: 'Pengeluaran',
    statCartonsToProduce: 'Karton perlu keluar', statProductsToProduce: 'Produk belum lengkap',
    balanceToProduce: 'Baki', printProduction: 'Cetak Senarai Pengeluaran',
    noProduction: 'Tiada tempahan terbuka sekarang — tiada apa perlu dikeluarkan.',
    statOrders: 'Tempahan', statValue: 'Angg. nilai', statRate: 'Kadar pemenuhan (30h)',
    statPending: 'Menunggu', statPartial: 'Sebahagian', statOverdue: 'Tertunggak',
    statOutlets: 'Outlet', statSubmitted: 'Dihantar', statOutstanding: 'Belum Hantar',
    month: 'Bulan', allMonths: 'Semua bulan', allOutlets: 'Semua outlet', status: 'Status', allStatuses: 'Semua status',
    exportCsv: 'Eksport CSV', noMatch: 'Tiada tempahan sepadan dengan penapis ini.',
    printBatch: 'Cetak tempahan hari ini ({n})',
    submittedN: 'Dihantar · {n}', outstandingN: 'Belum Hantar · {n}',
    noSubs: 'Tiada penghantaran untuk {month} lagi.', allReported: 'Semua outlet telah melapor.',
    unitsExp: '{qty} unit · luput {date}', outstanding: 'belum hantar',
    fulfilTitle: 'Penghantaran / pemenuhan', ordered: 'Ditempah', lineStatus: 'Status item',
    markAllDelivered: 'Tandai semua dihantar', saveDelivery: 'Simpan penghantaran', cancel: 'Batal',
    lnDelivered: 'Dihantar', lnPartial: 'Sebahagian', lnOutstanding: 'Belum hantar', remaining: 'baki {c}',
    outstandingFollowUp: '↳ Baki daripada penghantaran lepas — {c} karton belum dihantar',
    viewDetails: 'Butiran', del1: 'Dihantar 1', date1: 'Tarikh 1', exp1: 'Luput 1', del2: 'Dihantar 2', date2: 'Tarikh 2', exp2: 'Luput 2', downloadPdf: 'Muat turun PDF',
    dueBy: 'Perlu siap sebelum {date}',
    reorderBadge: 'Tempahan semula', awaitingTitle: 'Anda ada item menunggu penghantaran',
    awaitingDesc: 'Item ini dari tempahan terdahulu belum dihantar sepenuhnya. Tempah semula hanya yang benar-benar belum diterima.',
    awaitingItem: '{name} — {c} karton belum dihantar (tempahan {orders})',
    reorderModalTitle: 'Sahkan Tempahan Semula',
    reorderModalBody: 'Anda masih ada item ini menunggu penghantaran dari tempahan terdahulu:',
    reorderModalQ: 'Adakah anda menempah semula kerana belum menerimanya? Tindakan ini menambah tempahan baharu di atas yang masih menunggu.',
    reorderConfirm: 'Ya, hantar tempahan semula', reorderCancel: 'Batal',
    edit: 'Ubah', cancelOrder: 'Batal', saveChanges: 'Simpan perubahan', editBack: 'Kembali tanpa simpan',
    editingBanner: 'Mengubah {orderNo} — dibenarkan dalam 3 hari selepas dihantar. Selepas itu, buat tempahan baharu.',
    editWithin: 'Tempahan menunggu boleh diubah atau dibatalkan dalam masa 3 hari.',
    cancelTitle: 'Batal tempahan ini?', cancelBody: '{orderNo} akan dibatalkan. Tindakan ini tidak boleh diundur.',
    cancelYes: 'Ya, batal tempahan', keepOrder: 'Kekalkan',
    loginTitle: 'Log masuk', loginEmail: 'E-mel', loginPassword: 'Kata laluan', loginSubmit: 'Log masuk',
    loginError: 'E-mel atau kata laluan tidak sah.', signOut: 'Log keluar',
    overrideOn: 'Override tetingkap stok AKTIF — laporan dibuka tanpa mengira tarikh.',
    overrideToggleOn: 'Paksa buka tetingkap stok', overrideToggleOff: 'Henti paksa buka',
  },
}

// Fixed, regardless of active UI language (brief section 6 "Language" — confirmed decision).
const SLIP_LANG = 'ms'
export const SLIP_DICT = {
  slipHeader: '🧾 TEMPAHAN CK DISAHKAN', slipOrderNo: 'No. Tempahan', slipOutlet: 'Outlet',
  slipProducts: 'Produk', slipItems: 'item', slipCartons: 'karton', slipValue: 'Nilai', slipEst: '(angg.)', slipDate: 'Tarikh',
}
export { SLIP_LANG }

export const interp = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => (vars && k in vars ? vars[k] : `{${k}}`))

const LangCtx = createContext(null)

export function LangProvider({ children }) {
  const [lang, setLang] = useState('ms')
  const value = useMemo(() => ({
    lang,
    setLang,
    t: (k, vars) => interp(DICT[lang][k] ?? k, vars),
    catName: (c) => CAT[c][lang],
  }), [lang])
  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>
}

export const useT = () => useContext(LangCtx)
