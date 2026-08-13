import { useState, useMemo, createContext, useContext, Fragment } from "react";

/* ================================================================== *
 * CK PRODUCTS ORDERING PORTAL — clickable prototype
 * In-memory only. Outlet/Operator switch stands in for separate logins.
 * Default language: Bahasa Melayu (toggle ENG). Month names always English.
 * Fulfillment cycle: 30 days from order date.
 * ================================================================== */

const CAT = {
  1: { en: "Dry Products & Nuts", ms: "Barang Kering & Kacang" },
  2: { en: "Funfruits Item", ms: "Item FunFruits" },
};
const PRODUCTS = [
  { id: "P01", name: "Asam Boi Pedas 1Kg", unitPrice: 21.81, perCarton: 4, cat: 2 },
  { id: "P02", name: "Ck Sweet Spicy 1kg", unitPrice: 15.21, perCarton: 4, cat: 2 },
  { id: "P03", name: "Kuah Rojak (original) 490g", unitPrice: 5.21, perCarton: 12, cat: 1 },
  { id: "P04", name: "MBG CK Kuah Rojak 10L", unitPrice: 150.01, perCarton: 1, cat: 2 },
  { id: "P05", name: "Nuttybites Roasted Almond 40G", unitPrice: 3.16, perCarton: 30, cat: 1 },
  { id: "P06", name: "Nuttybites Roasted Cashew 40G", unitPrice: 3.05, perCarton: 30, cat: 1 },
  { id: "P07", name: "Nuttybites Roasted Mix 60G", unitPrice: 4.35, perCarton: 30, cat: 1 },
  { id: "P08", name: "Nuttybites Roasted Pistachio 40G", unitPrice: 3.21, perCarton: 30, cat: 1 },
  { id: "P09", name: "Serbuk Asam Boi Ori V2 150G", unitPrice: 5.05, perCarton: 20, cat: 1 },
  { id: "P10", name: "Serbuk Asam Boi Pedas V2 120G", unitPrice: 5.27, perCarton: 20, cat: 1 },
  { id: "P11", name: "Serbuk Asam boi (Original) 1Kg", unitPrice: 15.53, perCarton: 4, cat: 2 },
  { id: "P12", name: "Sos Asam Boi Tong 20L", unitPrice: 503.10, perCarton: 1, cat: 2 },
  { id: "P13", name: "Sos Asam Boi Dipping Sauce 250gn", unitPrice: 5.50, perCarton: 15, cat: 1 },
];
const cartonPrice = (p) => p.unitPrice * p.perCarton;
const productById = (id) => PRODUCTS.find((p) => p.id === id);
const CAT_ORDER = [1, 2];

const OUTLET_NAMES = [
  "Putra Heights", "Setia Alam", "Kota Damansara", "Bangi Gateway", "Nilai Square",
  "Seremban 2", "Melaka Mall", "Batu Pahat", "JB City Square", "Tebrau",
  "Kajang Prima", "Cheras Leisure", "Ampang Point", "Wangsa Walk", "KL Eco City",
  "Subang Parade", "Sunway Pyramid", "Klang Parade", "Shah Alam Stadium", "Puchong Bandar",
  "Cyberjaya DPulze", "Bangsar South", "Mont Kiara", "Damansara Uptown", "Kepong Metro",
  "Rawang Star", "Ipoh Parade", "Taiping Sentral", "Penang Gurney", "Bukit Mertajam",
  "Sungai Petani", "Alor Setar Mall", "Kuantan East Coast", "Kuala Terengganu", "Kota Bharu",
  "Kuching Vivacity", "Miri Bintang", "Kota Kinabalu Imago", "Sandakan Harbour", "Tawau Central",
];
const OUTLETS = OUTLET_NAMES.map((n, i) => ({ id: `MBG${String(i + 1).padStart(3, "0")}`, name: `MBG ${n}` }));
const outletById = (id) => OUTLETS.find((o) => o.id === id);

/* ---------- i18n ---------- */
const CYCLE_DAYS = 30;
const EDIT_DAYS = 3;
const DICT = {
  en: {
    brandSub: "MBG Outlet Network",
    proto: "Prototype · seeded data, resets on reload · the Outlet/Operator switch stands in for the separate logins we'll add later.",
    outlet: "Outlet", operator: "Operator", signedInAs: "Signed in as",
    tabNewOrder: "New order", tabMyOrders: "My orders", tabStock: "Stock report",
    perCarton: "{price}/carton · {n} {unit}", unitS: "unit", unitP: "units", cartonLabel: "CARTON",
    orderSummary: "Order summary",
    orderEmpty: "Add cartons to any product to start. Values update as you go.",
    itemsCartons: "{n} items · {c} cartons", estValue: "Estimated value", placeOrder: "Place order",
    orderPlaced: "Order placed", copyIntro: "Copy the slip below into your WhatsApp group.",
    slipTitle: "CONFIRMATION SLIP", copyWa: "Copy for WhatsApp", copied: "Copied ✓", placeAnother: "Place another order",
    colOrderNo: "Order No", colDate: "Date", colItems: "Items", colCartons: "Cartons",
    colDelivered: "Delivered", colValue: "Value", colStatus: "Status", colProduct: "Product", colOutlet: "Outlet",
    noOrdersYet: "No orders yet. Your placed orders will appear here with their status.",
    stPending: "Pending", stPartial: "Partial", stOverdue: "Overdue", stDone: "Accomplished", stLate: "Done (late)", stCancelled: "Cancelled",
    windowOpen: "Reporting is open today (the 20th). Report your nearest-expiry stock for {month}.",
    windowClosed: "Reporting opens on the 20th of each month.", previewForm: "open for testing",
    alreadySubmitted: "Already submitted on {date} — submitting again will replace it.",
    qtyOnHand: "Qty on hand (units)", nearestExpiry: "Nearest expiry", submitStock: "Submit stock report",
    tabOrdersFulfil: "Orders & fulfillment", tabStockTracker: "Stock tracker",
    statOrders: "Orders", statValue: "Est. value", statRate: "Fulfilment rate (30d)",
    statPending: "Pending", statPartial: "Partial", statOverdue: "Overdue",
    statOutlets: "Outlets", statSubmitted: "Submitted", statOutstanding: "Outstanding",
    month: "Month", allMonths: "All months", allOutlets: "All outlets", status: "Status", allStatuses: "All statuses",
    exportCsv: "Export CSV", noMatch: "No orders match these filters.",
    submittedN: "Submitted · {n}", outstandingN: "Outstanding · {n}",
    noSubs: "No submissions for {month} yet.", allReported: "All outlets have reported.",
    unitsExp: "{qty} units · exp {date}", outstanding: "outstanding",
    slipHeader: "🧾 CK ORDER CONFIRMED", slipOrderNo: "Order No", slipOutlet: "Outlet",
    slipProducts: "Products", slipItems: "items", slipCartons: "cartons", slipValue: "Value", slipEst: "(est.)", slipDate: "Date",
    fulfilTitle: "Delivery / fulfillment", ordered: "Ordered", lineStatus: "Line status",
    markAllDelivered: "Mark all delivered", saveDelivery: "Save delivery", cancel: "Cancel",
    lnDelivered: "Delivered", lnPartial: "Partial", lnOutstanding: "Outstanding", remaining: "{c} left",
    viewDetails: "Details", del1: "Delivered 1", exp1: "Expiry 1", del2: "Delivered 2", exp2: "Expiry 2", downloadPdf: "Download PDF",
    dueBy: "Due by {date}",
    reorderBadge: "Re-order", awaitingTitle: "You have items awaiting delivery",
    awaitingDesc: "These items from earlier orders haven't arrived in full yet. Only re-order what you truly haven't received.",
    awaitingItem: "{name} — {c} cartons outstanding (order {orders})",
    reorderModalTitle: "Confirm re-order",
    reorderModalBody: "You still have these items awaiting delivery from an earlier order:",
    reorderModalQ: "Are you re-ordering because you haven't received them yet? Placing this adds a new order on top of the pending one.",
    reorderConfirm: "Yes, place re-order", reorderCancel: "Cancel", reorderNote: "Re-order — items not yet received",
    edit: "Edit", cancelOrder: "Cancel", saveChanges: "Save changes", editBack: "Back without saving",
    editingBanner: "Editing {orderNo} — allowed within 3 days of placing. After that, place a new order instead.",
    editWithin: "Pending orders can be edited or cancelled within 3 days.",
    cancelTitle: "Cancel this order?", cancelBody: "{orderNo} will be voided. This can't be undone.",
    cancelYes: "Yes, cancel order", keepOrder: "Keep it",
  },
  ms: {
    brandSub: "Rangkaian Outlet MBG",
    proto: "Prototaip · data contoh, set semula bila dimuat semula · suis Outlet/Operator menggantikan log masuk berasingan yang akan ditambah kemudian.",
    outlet: "Outlet", operator: "Operator", signedInAs: "Log masuk sebagai",
    tabNewOrder: "Tempahan Baru", tabMyOrders: "Tempahan Saya", tabStock: "Laporan Stok",
    perCarton: "{price}/karton · {n} {unit}", unitS: "unit", unitP: "unit", cartonLabel: "KARTON",
    orderSummary: "Ringkasan Tempahan",
    orderEmpty: "Tambah karton pada mana-mana produk untuk mula. Nilai dikemas kini secara automatik.",
    itemsCartons: "{n} item · {c} karton", estValue: "Anggaran Nilai", placeOrder: "Hantar Tempahan",
    orderPlaced: "Tempahan Dihantar", copyIntro: "Salin slip di bawah ke kumpulan WhatsApp anda.",
    slipTitle: "SLIP PENGESAHAN", copyWa: "Salin untuk WhatsApp", copied: "Disalin ✓", placeAnother: "Buat tempahan lain",
    colOrderNo: "No. Tempahan", colDate: "Tarikh", colItems: "Item", colCartons: "Karton",
    colDelivered: "Dihantar", colValue: "Nilai", colStatus: "Status", colProduct: "Produk", colOutlet: "Outlet",
    noOrdersYet: "Tiada tempahan lagi. Tempahan anda akan dipapar di sini beserta statusnya.",
    stPending: "Menunggu", stPartial: "Sebahagian", stOverdue: "Tertunggak", stDone: "Selesai", stLate: "Selesai (lewat)", stCancelled: "Dibatalkan",
    windowOpen: "Laporan dibuka hari ini (20hb). Laporkan stok tarikh luput terdekat untuk {month}.",
    windowClosed: "Laporan dibuka pada 20hb setiap bulan.", previewForm: "buka untuk ujian",
    alreadySubmitted: "Telah dihantar pada {date} — hantar semula akan menggantikannya.",
    qtyOnHand: "Kuantiti ada (unit)", nearestExpiry: "Luput terdekat", submitStock: "Hantar Laporan Stok",
    tabOrdersFulfil: "Tempahan & Pemenuhan", tabStockTracker: "Penjejak Stok",
    statOrders: "Tempahan", statValue: "Angg. nilai", statRate: "Kadar pemenuhan (30h)",
    statPending: "Menunggu", statPartial: "Sebahagian", statOverdue: "Tertunggak",
    statOutlets: "Outlet", statSubmitted: "Dihantar", statOutstanding: "Belum Hantar",
    month: "Bulan", allMonths: "Semua bulan", allOutlets: "Semua outlet", status: "Status", allStatuses: "Semua status",
    exportCsv: "Eksport CSV", noMatch: "Tiada tempahan sepadan dengan penapis ini.",
    submittedN: "Dihantar · {n}", outstandingN: "Belum Hantar · {n}",
    noSubs: "Tiada penghantaran untuk {month} lagi.", allReported: "Semua outlet telah melapor.",
    unitsExp: "{qty} unit · luput {date}", outstanding: "belum hantar",
    slipHeader: "🧾 TEMPAHAN CK DISAHKAN", slipOrderNo: "No. Tempahan", slipOutlet: "Outlet",
    slipProducts: "Produk", slipItems: "item", slipCartons: "karton", slipValue: "Nilai", slipEst: "(angg.)", slipDate: "Tarikh",
    fulfilTitle: "Penghantaran / pemenuhan", ordered: "Ditempah", lineStatus: "Status item",
    markAllDelivered: "Tandai semua dihantar", saveDelivery: "Simpan penghantaran", cancel: "Batal",
    lnDelivered: "Dihantar", lnPartial: "Sebahagian", lnOutstanding: "Belum hantar", remaining: "baki {c}",
    viewDetails: "Butiran", del1: "Dihantar 1", exp1: "Luput 1", del2: "Dihantar 2", exp2: "Luput 2", downloadPdf: "Muat turun PDF",
    dueBy: "Perlu siap sebelum {date}",
    reorderBadge: "Tempahan semula", awaitingTitle: "Anda ada item menunggu penghantaran",
    awaitingDesc: "Item ini dari tempahan terdahulu belum dihantar sepenuhnya. Tempah semula hanya yang benar-benar belum diterima.",
    awaitingItem: "{name} — {c} karton belum dihantar (tempahan {orders})",
    reorderModalTitle: "Sahkan Tempahan Semula",
    reorderModalBody: "Anda masih ada item ini menunggu penghantaran dari tempahan terdahulu:",
    reorderModalQ: "Adakah anda menempah semula kerana belum menerimanya? Tindakan ini menambah tempahan baharu di atas yang masih menunggu.",
    reorderConfirm: "Ya, hantar tempahan semula", reorderCancel: "Batal", reorderNote: "Tempahan semula — item belum diterima",
    edit: "Ubah", cancelOrder: "Batal", saveChanges: "Simpan perubahan", editBack: "Kembali tanpa simpan",
    editingBanner: "Mengubah {orderNo} — dibenarkan dalam 3 hari selepas dihantar. Selepas itu, buat tempahan baharu.",
    editWithin: "Tempahan menunggu boleh diubah atau dibatalkan dalam masa 3 hari.",
    cancelTitle: "Batal tempahan ini?", cancelBody: "{orderNo} akan dibatalkan. Tindakan ini tidak boleh diundur.",
    cancelYes: "Ya, batal tempahan", keepOrder: "Kekalkan",
  },
};
const interp = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => (vars && k in vars ? vars[k] : `{${k}}`));
const LangCtx = createContext({ lang: "ms", t: (k) => k });
const useT = () => useContext(LangCtx);

/* ---------- format (months always English) ---------- */
const fmt = (n) => "RM " + n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
const monthKey = (iso) => iso.slice(0, 7);
const monthLabel = (key) => { const [y, m] = key.split("-"); return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" }); };
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (iso, n) => { const d = new Date(iso); d.setDate(d.getDate() + n); return d; };
const dueDate = (o) => addDays(o.date, CYCLE_DAYS);
const daysSince = (iso, now) => Math.floor((startOfDay(now) - startOfDay(new Date(iso))) / 86400000);
const todayISO = () => new Date().toISOString().slice(0, 10);

/* ---------- derived order state ---------- */
const lineDelivered = (l) => (l.batches || []).reduce((s, b) => s + (b.qty || 0), 0);
const orderedCartons = (o) => o.lines.reduce((s, l) => s + l.cartons, 0);
const deliveredCartons = (o) => o.lines.reduce((s, l) => s + lineDelivered(l), 0);
const isFull = (o) => o.lines.every((l) => lineDelivered(l) >= l.cartons);
const anyDelivered = (o) => o.lines.some((l) => lineDelivered(l) > 0);
const displayStatus = (o, now) => {
  if (o.cancelled) return "cancelled";
  const due = dueDate(o);
  if (isFull(o)) return o.completedDate && new Date(o.completedDate) > due ? "accomplished_late" : "accomplished";
  if (now > due) return "overdue";
  return anyDelivered(o) ? "partial" : "pending";
};
const STATUS_META = {
  pending: { key: "stPending", cls: "bg-amber-100 text-amber-800 border-amber-200" },
  partial: { key: "stPartial", cls: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  overdue: { key: "stOverdue", cls: "bg-red-100 text-red-700 border-red-200" },
  accomplished: { key: "stDone", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  accomplished_late: { key: "stLate", cls: "bg-emerald-50 text-emerald-700 border-amber-300" },
  cancelled: { key: "stCancelled", cls: "bg-slate-100 text-slate-400 border-slate-200" },
};
const canEdit = (o, now) => !o.cancelled && deliveredCartons(o) === 0 && daysSince(o.date, now) <= EDIT_DAYS;

const outstandingFor = (orders, outletId) => {
  const map = {};
  orders.filter((o) => o.outletId === outletId && !o.cancelled && !isFull(o)).forEach((o) => {
    o.lines.forEach((l) => {
      const out = l.cartons - lineDelivered(l);
      if (out > 0) {
        if (!map[l.productId]) map[l.productId] = { cartons: 0, orderNos: new Set() };
        map[l.productId].cartons += out; map[l.productId].orderNos.add(o.orderNo);
      }
    });
  });
  return Object.entries(map).map(([productId, v]) => ({ productId, cartons: v.cartons, orderNos: [...v.orderNos] }));
};

const receiptText = (order, t) => {
  const o = outletById(order.outletId);
  return [
    t("slipHeader"), `${t("slipOrderNo")} : ${order.orderNo}`, `${t("slipOutlet")} : ${o.name}`,
    `${t("slipProducts")} : ${order.lines.length} ${t("slipItems")} · ${orderedCartons(order)} ${t("slipCartons")}`,
    `${t("slipValue")} : ${fmt(order.total)} ${t("slipEst")}`, `${t("slipDate")} : ${fmtDate(order.date)}`,
  ].join("\n");
};

/* ---------- seeds ---------- */
const line = (pid, cartons, delivered = 0, expiry = null) => {
  const p = productById(pid);
  return {
    productId: pid, cartons,
    batches: delivered > 0 ? [{ qty: delivered, expiry: expiry || "2026-12-31" }] : [],
    unitPrice: p.unitPrice, perCarton: p.perCarton, cartonPrice: cartonPrice(p), lineValue: cartonPrice(p) * cartons,
  };
};
const mkOrder = (orderNo, outletId, date, lines, completedDate = null, note = null) => ({
  id: orderNo, orderNo, outletId, date, lines, completedDate, note, cancelled: false,
  total: lines.reduce((s, l) => s + l.lineValue, 0),
});
const SEED_ORDERS = [
  mkOrder("CK-2606-002", "MBG002", "2026-06-08", [line("P01", 3, 3, "2026-10-31"), line("P05", 2, 2, "2026-09-30"), line("P13", 4, 4, "2026-11-15")], "2026-06-19"),
  mkOrder("CK-2606-005", "MBG011", "2026-06-22", [line("P12", 1, 1, "2027-02-28"), line("P03", 6, 6, "2026-10-20")], "2026-07-25"), // late (>30d)
  mkOrder("CK-2606-009", "MBG028", "2026-06-27", [line("P09", 5, 0), line("P10", 5, 0)], null), // overdue
  mkOrder("CK-2607-003", "MBG001", "2026-07-05", [line("P01", 2, 2, "2026-11-30"), line("P02", 2, 2, "2026-10-31"), line("P07", 3, 3, "2026-09-30"), line("P13", 6, 6, "2026-12-15")], "2026-07-18"),
  mkOrder("CK-2607-006", "MBG016", "2026-07-11", [line("P05", 4, 4, "2026-10-10"), line("P06", 4, 4, "2026-10-12"), line("P07", 4, 4, "2026-09-28"), line("P08", 4, 4, "2026-11-01")], "2026-07-25"),
  mkOrder("CK-2607-010", "MBG023", "2026-07-19", [line("P04", 2, 1, "2027-01-31"), line("P12", 1, 0)], null), // partial
  mkOrder("CK-2607-014", "MBG035", "2026-07-28", [line("P03", 10, 10, "2026-10-05"), line("P09", 3, 3, "2026-11-20")], "2026-08-02"),
  mkOrder("CK-2608-001", "MBG007", "2026-08-02", [line("P01", 2, 2, "2026-12-01"), line("P02", 1, 1, "2026-11-11"), line("P05", 3, 3, "2026-09-30")], "2026-08-04"),
  mkOrder("CK-2608-002", "MBG019", "2026-08-04", [line("P13", 8, 0), line("P03", 4, 0)], null), // pending, editable
  mkOrder("CK-2608-003", "MBG001", "2026-08-05", [line("P07", 5, 5, "2026-09-30"), line("P08", 2, 0), line("P12", 1, 0)], null), // partial (default outlet)
];
const SEED_STOCK = [
  { id: "S1", outletId: "MBG002", month: "2026-07", submittedDate: "2026-07-20", lines: [{ productId: "P01", qty: 12, expiry: "2026-11-30" }, { productId: "P05", qty: 40, expiry: "2026-10-15" }] },
  { id: "S2", outletId: "MBG016", month: "2026-07", submittedDate: "2026-07-20", lines: [{ productId: "P07", qty: 25, expiry: "2026-09-30" }, { productId: "P13", qty: 60, expiry: "2026-12-01" }] },
];

/* ================================================================== */
export default function App() {
  const NOW = new Date();
  const [lang, setLang] = useState("ms");
  const [view, setView] = useState("outlet");
  const [outletId, setOutletId] = useState(OUTLETS[0].id);
  const [orders, setOrders] = useState(SEED_ORDERS);
  const [stock, setStock] = useState(SEED_STOCK);
  const t = (k, vars) => interp(DICT[lang][k] ?? k, vars);
  const catName = (c) => CAT[c][lang];

  return (
    <LangCtx.Provider value={{ lang, t, catName }}>
      <div className="min-h-screen bg-slate-100 text-slate-800 font-sans">
        <header className="bg-slate-900 text-white">
          <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-teal-500 flex items-center justify-center font-bold font-mono">CK</div>
              <div><div className="font-semibold leading-tight">CK Products</div><div className="text-xs text-slate-400 leading-tight">{t("brandSub")}</div></div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setLang(lang === "ms" ? "en" : "ms")} title="Language"
                className="px-2.5 py-1.5 rounded-md border border-slate-600 text-xs font-semibold text-slate-200 hover:bg-slate-800">{lang === "ms" ? "ENG" : "BM"}</button>
              <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
                <SwitchBtn active={view === "outlet"} onClick={() => setView("outlet")}>{t("outlet")}</SwitchBtn>
                <SwitchBtn active={view === "operator"} onClick={() => setView("operator")}>{t("operator")}</SwitchBtn>
              </div>
            </div>
          </div>
        </header>
        <div className="bg-teal-50 border-b border-teal-200 text-teal-900 text-xs"><div className="max-w-6xl mx-auto px-4 py-1.5">{t("proto")}</div></div>
        <main className="max-w-6xl mx-auto px-4 py-6">
          {view === "outlet"
            ? <OutletApp now={NOW} outletId={outletId} setOutletId={setOutletId} orders={orders} setOrders={setOrders} stock={stock} setStock={setStock} />
            : <OperatorApp now={NOW} orders={orders} setOrders={setOrders} stock={stock} />}
        </main>
      </div>
    </LangCtx.Provider>
  );
}

function SwitchBtn({ active, onClick, children }) {
  return <button onClick={onClick} className={`px-3 sm:px-4 py-1.5 rounded-md text-sm font-medium transition ${active ? "bg-white text-slate-900" : "text-slate-300 hover:text-white"}`}>{children}</button>;
}
function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 border-b border-slate-200 mb-5 overflow-x-auto">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition ${active === t.id ? "border-teal-600 text-teal-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{t.label}</button>
      ))}
    </div>
  );
}
function Thumb() {
  return (
    <div className="w-11 h-11 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-300 shrink-0">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
      </svg>
    </div>
  );
}
function CatHeader({ children }) {
  return <div className="flex items-center gap-3 mt-5 mb-2 first:mt-0"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</span><span className="h-px bg-slate-200 flex-1" /></div>;
}
function ReorderBadge() { const { t } = useT(); return <span className="inline-block text-[10px] px-1.5 py-0.5 rounded border border-indigo-200 bg-indigo-50 text-indigo-600 font-medium align-middle ml-1">{t("reorderBadge")}</span>; }

/* ================================================================== *
 * OUTLET
 * ================================================================== */
function OutletApp({ now, outletId, setOutletId, orders, setOrders, stock, setStock }) {
  const { t } = useT();
  const [tab, setTab] = useState("order");
  const [confirmed, setConfirmed] = useState(null);
  const [editOrder, setEditOrder] = useState(null);

  const startEdit = (o) => { setEditOrder(o); setConfirmed(null); setTab("order"); };
  const cancelOrder = (o) => setOrders(orders.map((x) => (x.id === o.id ? { ...x, cancelled: true } : x)));
  const submitNew = (o) => { setOrders([o, ...orders]); setConfirmed(o); setEditOrder(null); };
  const updateOrder = (o) => { setOrders(orders.map((x) => (x.id === o.id ? o : x))); setConfirmed(o); setEditOrder(null); };

  return (
    <div>
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5 flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-500">{t("signedInAs")}</label>
        <select value={outletId} onChange={(e) => { setOutletId(e.target.value); setConfirmed(null); setEditOrder(null); }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium bg-white flex-1 min-w-[180px]">
          {OUTLETS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <span className="text-xs font-mono text-slate-400">{outletId}</span>
      </div>

      <Tabs active={tab} onChange={(x) => { setTab(x); setConfirmed(null); setEditOrder(null); }}
        tabs={[{ id: "order", label: t("tabNewOrder") }, { id: "history", label: t("tabMyOrders") }, { id: "stock", label: t("tabStock") }]} />

      {tab === "order" && (confirmed
        ? <Confirmation order={confirmed} onNew={() => setConfirmed(null)} />
        : <OrderForm outletId={outletId} orders={orders} editOrder={editOrder}
            onSubmit={submitNew} onUpdate={updateOrder} onCancelEdit={() => { setEditOrder(null); setTab("history"); }} />)}
      {tab === "history" && <MyOrders now={now} outletId={outletId} orders={orders} onEdit={startEdit} onCancel={cancelOrder} />}
      {tab === "stock" && <StockReport now={now} outletId={outletId} stock={stock} setStock={setStock} />}
    </div>
  );
}

function OrderForm({ outletId, orders, editOrder, onSubmit, onUpdate, onCancelEdit }) {
  const { t, catName } = useT();
  const editing = !!editOrder;
  const [qty, setQty] = useState(() => {
    const q = {}; if (editOrder) editOrder.lines.forEach((l) => (q[l.productId] = l.cartons)); return q;
  });
  const [modal, setModal] = useState(null);
  const setCartons = (pid, v) => setQty((q) => ({ ...q, [pid]: Math.max(0, Math.min(999, v || 0)) }));

  const outstanding = useMemo(() => (editing ? [] : outstandingFor(orders, outletId)), [orders, outletId, editing]);
  const outMap = Object.fromEntries(outstanding.map((o) => [o.productId, o]));

  const lines = useMemo(() => PRODUCTS.filter((p) => (qty[p.id] || 0) > 0).map((p) => line(p.id, qty[p.id])), [qty]);
  const total = lines.reduce((s, l) => s + l.lineValue, 0);
  const totalCartons = lines.reduce((s, l) => s + l.cartons, 0);

  const buildNew = (note) => {
    const date = todayISO();
    const mk = monthKey(date).replace("-", "").slice(2);
    const seq = orders.filter((o) => monthKey(o.date).replace("-", "").slice(2) === mk).length + 1;
    return mkOrder(`CK-${mk}-${String(seq).padStart(3, "0")}`, outletId, date, lines, null, note);
  };
  const attempt = () => {
    if (lines.length === 0) return;
    if (editing) { onUpdate({ ...editOrder, lines, total }); return; }
    const overlap = lines.filter((l) => outMap[l.productId]).map((l) => outMap[l.productId]);
    if (overlap.length > 0) { setModal({ overlap }); return; }
    onSubmit(buildNew(null));
  };

  return (
    <div className="grid lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2">
        {editing && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 mb-4 flex items-center justify-between gap-3">
            <span className="text-sm text-indigo-900">{t("editingBanner", { orderNo: editOrder.orderNo })}</span>
            <button onClick={onCancelEdit} className="text-xs text-indigo-700 hover:underline whitespace-nowrap">{t("editBack")}</button>
          </div>
        )}
        {!editing && outstanding.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-2">
              <span className="text-amber-600 text-lg leading-none">⚠</span>
              <div>
                <div className="text-sm font-semibold text-amber-900">{t("awaitingTitle")}</div>
                <p className="text-xs text-amber-800 mt-0.5">{t("awaitingDesc")}</p>
                <ul className="mt-2 space-y-1">
                  {outstanding.map((o) => <li key={o.productId} className="text-xs text-amber-900 font-mono">{t("awaitingItem", { name: productById(o.productId).name, c: o.cartons, orders: o.orderNos.join(", ") })}</li>)}
                </ul>
              </div>
            </div>
          </div>
        )}

        {CAT_ORDER.map((cat) => (
          <div key={cat}>
            <CatHeader>{catName(cat)}</CatHeader>
            <div className="space-y-2">
              {PRODUCTS.filter((p) => p.cat === cat).map((p) => {
                const c = qty[p.id] || 0; const pending = outMap[p.id];
                return (
                  <div key={p.id} className={`bg-white border rounded-xl p-3 ${pending ? "border-amber-300" : "border-slate-200"}`}>
                    <div className="flex items-center gap-3">
                      <Thumb />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm leading-tight">{p.name}</div>
                        <div className="text-xs text-slate-500 font-mono">{t("perCarton", { price: fmt(cartonPrice(p)), n: p.perCarton, unit: p.perCarton > 1 ? t("unitP") : t("unitS") })}</div>
                        {pending && <div className="text-[11px] text-amber-700 font-mono mt-0.5">⚠ {pending.cartons} {t("colCartons").toLowerCase()} {t("outstanding")}</div>}
                      </div>
                      <div className="text-right font-mono text-sm w-24 shrink-0 text-slate-700">{c > 0 ? fmt(cartonPrice(p) * c) : "—"}</div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 pl-14">
                      <StepBtn onClick={() => setCartons(p.id, c - 1)}>−</StepBtn>
                      <input value={c} onChange={(e) => setCartons(p.id, parseInt(e.target.value.replace(/\D/g, "")) || 0)} className="w-14 text-center border border-slate-300 rounded-md py-1.5 font-mono text-sm" inputMode="numeric" />
                      <StepBtn onClick={() => setCartons(p.id, c + 1)}>+</StepBtn>
                      <span className="text-xs font-semibold tracking-wide text-slate-400">{t("cartonLabel")}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="lg:col-span-1">
        <div className="bg-white border border-slate-200 rounded-xl p-4 lg:sticky lg:top-4">
          <div className="text-sm font-semibold mb-3">{t("orderSummary")}</div>
          {lines.length === 0 ? <p className="text-sm text-slate-500">{t("orderEmpty")}</p> : (
            <div className="space-y-1.5 mb-3">
              {lines.map((l) => (
                <div key={l.productId} className="flex justify-between text-xs">
                  <span className="text-slate-600 truncate pr-2">{productById(l.productId).name} <span className="font-mono">×{l.cartons}</span></span>
                  <span className="font-mono text-slate-700 shrink-0">{fmt(l.lineValue)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="border-t border-slate-200 pt-3 text-sm text-slate-500">{t("itemsCartons", { n: lines.length, c: totalCartons })}</div>
          <div className="flex justify-between items-baseline mt-1"><span className="text-sm text-slate-500">{t("estValue")}</span><span className="font-mono font-semibold text-lg">{fmt(total)}</span></div>
          <button onClick={attempt} disabled={lines.length === 0} className="w-full mt-4 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-medium py-2.5 rounded-lg transition">{editing ? t("saveChanges") : t("placeOrder")}</button>
        </div>
      </div>

      {modal && <ReorderModal overlap={modal.overlap} onConfirm={() => { setModal(null); onSubmit(buildNew(t("reorderNote"))); }} onCancel={() => setModal(null)} />}
    </div>
  );
}

function ReorderModal({ overlap, onConfirm, onCancel }) {
  const { t } = useT();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5">
        <div className="flex items-center gap-2 mb-3"><span className="w-9 h-9 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-lg">⚠</span><h3 className="font-semibold">{t("reorderModalTitle")}</h3></div>
        <p className="text-sm text-slate-600">{t("reorderModalBody")}</p>
        <ul className="my-3 space-y-1 bg-slate-50 rounded-lg p-3">
          {overlap.map((o) => <li key={o.productId} className="text-xs font-mono text-slate-700 flex justify-between"><span className="truncate pr-2">{productById(o.productId).name}</span><span className="shrink-0 text-amber-700">{o.cartons} · {o.orderNos.join(", ")}</span></li>)}
        </ul>
        <p className="text-sm text-slate-600 mb-4">{t("reorderModalQ")}</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium py-2.5 rounded-lg">{t("reorderCancel")}</button>
          <button onClick={onConfirm} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium py-2.5 rounded-lg">{t("reorderConfirm")}</button>
        </div>
      </div>
    </div>
  );
}
function StepBtn({ onClick, children }) { return <button onClick={onClick} className="w-8 h-8 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center">{children}</button>; }

function Confirmation({ order, onNew }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const text = receiptText(order, t);
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); } };
  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-4"><div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto text-2xl">✓</div><h2 className="font-semibold mt-2">{t("orderPlaced")}</h2><p className="text-sm text-slate-500">{t("copyIntro")}</p></div>
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-dashed border-slate-300 px-5 py-3 text-center text-xs tracking-widest text-slate-400 font-mono">{t("slipTitle")}</div>
        <pre className="px-5 py-4 text-sm font-mono whitespace-pre-wrap text-slate-800 leading-relaxed">{text}</pre>
        <div className="border-t border-dashed border-slate-300 p-3"><button onClick={copy} className="w-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium py-2.5 rounded-lg transition">{copied ? t("copied") : t("copyWa")}</button></div>
      </div>
      <button onClick={onNew} className="w-full mt-3 text-sm text-teal-700 hover:underline">{t("placeAnother")}</button>
    </div>
  );
}

function MyOrders({ now, outletId, orders, onEdit, onCancel }) {
  const { t } = useT();
  const [open, setOpen] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const mine = orders.filter((o) => o.outletId === outletId);
  if (mine.length === 0) return <Empty>{t("noOrdersYet")}</Empty>;
  return (
    <div>
      <div className="text-xs text-slate-500 mb-2">{t("editWithin")}</div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr><Th>{t("colOrderNo")}</Th><Th>{t("colDate")}</Th><Th right>{t("colItems")}</Th><Th right>{t("colDelivered")}</Th><Th right>{t("colValue")}</Th><Th>{t("colStatus")}</Th><Th /></tr>
          </thead>
          <tbody>
            {mine.map((o) => {
              const st = displayStatus(o, now); const isOpen = open === o.id; const editable = canEdit(o, now);
              return (
                <Fragment key={o.id}>
                  <tr className={`border-t border-slate-100 hover:bg-slate-50 ${o.cancelled ? "opacity-50" : ""}`}>
                    <Td mono><span className="cursor-pointer" onClick={() => setOpen(isOpen ? null : o.id)}>{o.orderNo}</span>{o.note && <ReorderBadge />}</Td>
                    <Td>{fmtDate(o.date)}</Td>
                    <Td right mono>{o.lines.length}</Td>
                    <Td right mono>{deliveredCartons(o)}/{orderedCartons(o)}</Td>
                    <Td right mono>{fmt(o.total)}</Td>
                    <Td><Badge st={st} /></Td>
                    <Td>
                      {editable ? (
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => onEdit(o)} className="text-xs border border-slate-300 hover:bg-slate-50 px-2.5 py-1 rounded-md font-medium">{t("edit")}</button>
                          <button onClick={() => setCancelTarget(o)} className="text-xs border border-red-200 text-red-600 hover:bg-red-50 px-2.5 py-1 rounded-md font-medium">{t("cancelOrder")}</button>
                        </div>
                      ) : <span className="text-xs text-teal-700 cursor-pointer" onClick={() => setOpen(isOpen ? null : o.id)}>{isOpen ? "▾" : "▸"}</span>}
                    </Td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-slate-50 border-t border-slate-100">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="space-y-1">
                          {o.lines.map((l) => {
                            const del = lineDelivered(l); const out = l.cartons - del;
                            return (
                              <div key={l.productId} className="flex justify-between text-xs">
                                <span className="text-slate-600">{productById(l.productId).name} <span className="font-mono">×{l.cartons}</span></span>
                                <span className="font-mono text-slate-500">
                                  {del}/{l.cartons} {t("lnDelivered").toLowerCase()}
                                  {(l.batches || []).length > 0 && <span className="text-slate-400"> · {(l.batches).map((b) => `${b.qty}@${fmtDate(b.expiry)}`).join(", ")}</span>}
                                  {out > 0 && <span className="text-amber-700"> · {out} {t("outstanding")}</span>}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {cancelTarget && <CancelModal order={cancelTarget} onConfirm={() => { onCancel(cancelTarget); setCancelTarget(null); }} onCancel={() => setCancelTarget(null)} />}
    </div>
  );
}

function CancelModal({ order, onConfirm, onCancel }) {
  const { t } = useT();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5">
        <h3 className="font-semibold mb-2">{t("cancelTitle")}</h3>
        <p className="text-sm text-slate-600 mb-4">{t("cancelBody", { orderNo: order.orderNo })}</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium py-2.5 rounded-lg">{t("keepOrder")}</button>
          <button onClick={onConfirm} className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2.5 rounded-lg">{t("cancelYes")}</button>
        </div>
      </div>
    </div>
  );
}

function StockReport({ now, outletId, stock, setStock }) {
  const { t, catName } = useT();
  const [preview, setPreview] = useState(false);
  const windowOpen = now.getDate() === 20;
  const editable = windowOpen || preview;
  const month = monthKey(todayISO());
  const existing = stock.find((s) => s.outletId === outletId && s.month === month);
  const [rows, setRows] = useState(() => { const base = {}; PRODUCTS.forEach((p) => (base[p.id] = { qty: "", expiry: "" })); if (existing) existing.lines.forEach((l) => (base[l.productId] = { qty: String(l.qty), expiry: l.expiry })); return base; });
  const setRow = (pid, f, v) => setRows((r) => ({ ...r, [pid]: { ...r[pid], [f]: v } }));
  const submit = () => {
    const lines = PRODUCTS.filter((p) => rows[p.id].qty !== "" && Number(rows[p.id].qty) >= 0).map((p) => ({ productId: p.id, qty: Number(rows[p.id].qty), expiry: rows[p.id].expiry }));
    const rec = { id: `S${Date.now()}`, outletId, month, submittedDate: todayISO(), lines };
    setStock([rec, ...stock.filter((s) => !(s.outletId === outletId && s.month === month))]);
  };
  return (
    <div>
      <div className={`rounded-xl px-4 py-3 mb-4 text-sm border ${windowOpen ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
        {windowOpen ? t("windowOpen", { month: monthLabel(month) }) : t("windowClosed")}
        {!windowOpen && <label className="ml-2 inline-flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} /><span className="underline">{t("previewForm")}</span></label>}
      </div>
      {existing && <div className="text-xs text-slate-500 mb-3">{t("alreadySubmitted", { date: fmtDate(existing.submittedDate) })}</div>}
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[520px]">
          <thead className="bg-slate-50 text-slate-500 text-xs"><tr><Th>{t("colProduct")}</Th><Th right>{t("qtyOnHand")}</Th><Th>{t("nearestExpiry")}</Th></tr></thead>
          <tbody>
            {CAT_ORDER.flatMap((cat) => [
              <tr key={"h" + cat} className="bg-slate-50/70"><td colSpan={3} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 border-t border-slate-100">{catName(cat)}</td></tr>,
              ...PRODUCTS.filter((p) => p.cat === cat).map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <Td>{p.name}</Td>
                  <Td right><input disabled={!editable} value={rows[p.id].qty} onChange={(e) => setRow(p.id, "qty", e.target.value.replace(/\D/g, ""))} placeholder="0" inputMode="numeric" className="w-24 text-right border border-slate-300 rounded-md py-1.5 px-2 font-mono text-sm disabled:bg-slate-50 disabled:text-slate-400" /></Td>
                  <Td><input type="date" disabled={!editable} value={rows[p.id].expiry} onChange={(e) => setRow(p.id, "expiry", e.target.value)} className="border border-slate-300 rounded-md py-1.5 px-2 font-mono text-sm disabled:bg-slate-50 disabled:text-slate-400" /></Td>
                </tr>
              )),
            ])}
          </tbody>
        </table>
        <div className="p-3 border-t border-slate-200"><button onClick={submit} disabled={!editable} className="bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition">{t("submitStock")}</button></div>
      </div>
    </div>
  );
}

/* ================================================================== *
 * OPERATOR
 * ================================================================== */
function OperatorApp({ now, orders, setOrders, stock }) {
  const { t } = useT();
  const [tab, setTab] = useState("orders");
  return (
    <div>
      <Tabs active={tab} onChange={setTab} tabs={[{ id: "orders", label: t("tabOrdersFulfil") }, { id: "stock", label: t("tabStockTracker") }]} />
      {tab === "orders" ? <OrdersDashboard now={now} orders={orders} setOrders={setOrders} /> : <StockTracker stock={stock} />}
    </div>
  );
}

function OrdersDashboard({ now, orders, setOrders }) {
  const { t } = useT();
  const months = useMemo(() => [...new Set(orders.map((o) => monthKey(o.date)))].sort().reverse(), [orders]);
  const [month, setMonth] = useState("all");
  const [outlet, setOutlet] = useState("all");
  const [status, setStatus] = useState("all");
  const [expanded, setExpanded] = useState(null);
  const [draft, setDraft] = useState({});

  const rows = orders.filter((o) => {
    if (month !== "all" && monthKey(o.date) !== month) return false;
    if (outlet !== "all" && o.outletId !== outlet) return false;
    if (status !== "all" && displayStatus(o, now) !== status) return false;
    return true;
  });
  const scope = (month === "all" ? orders : orders.filter((o) => monthKey(o.date) === month)).filter((o) => !o.cancelled);
  const value = scope.reduce((s, o) => s + o.total, 0);
  const cnt = (k) => scope.filter((o) => displayStatus(o, now) === k).length;
  const rate = scope.length ? Math.round((cnt("accomplished") / scope.length) * 100) : 0;

  const openRow = (o) => {
    setExpanded(o.id);
    setDraft(Object.fromEntries(o.lines.map((l) => {
      const b = l.batches || [];
      return [l.productId, { q1: b[0]?.qty || 0, e1: b[0]?.expiry || "", q2: b[1]?.qty || 0, e2: b[1]?.expiry || "" }];
    })));
  };
  const setField = (pid, field, val, ordered) => setDraft((d) => {
    const row = { ...d[pid], [field]: val };
    let q1 = Number(row.q1) || 0, q2 = Number(row.q2) || 0;
    if (field === "q1") { q1 = Math.max(0, Math.min(ordered, q1)); q2 = Math.min(q2, ordered - q1); }
    if (field === "q2") { q2 = Math.max(0, Math.min(ordered, q2)); q1 = Math.min(q1, ordered - q2); }
    return { ...d, [pid]: { ...row, q1, q2 } };
  });
  const markAll = (o) => setDraft(Object.fromEntries(o.lines.map((l) => { const d = draft[l.productId] || {}; return [l.productId, { q1: l.cartons, e1: d.e1 || "", q2: 0, e2: "" }]; })));
  const save = (o) => {
    const newLines = o.lines.map((l) => {
      const d = draft[l.productId] || {}; const batches = [];
      if ((d.q1 || 0) > 0) batches.push({ qty: d.q1, expiry: d.e1 || "" });
      if ((d.q2 || 0) > 0) batches.push({ qty: d.q2, expiry: d.e2 || "" });
      return { ...l, batches };
    });
    const full = newLines.every((l) => lineDelivered(l) >= l.cartons);
    const completedDate = full ? (o.completedDate || todayISO()) : null;
    setOrders(orders.map((x) => (x.id === o.id ? { ...x, lines: newLines, completedDate } : x)));
    setExpanded(null);
  };

  const exportCsv = () => {
    const head = ["Order No", "Outlet", "Order Date", "Due Date", "Product", "Ordered", "Delivered", "Outstanding", "Batch1 Qty", "Batch1 Expiry", "Batch2 Qty", "Batch2 Expiry", "Line Value", "Order Total", "Status", "Completed", "Note"];
    const out = [head.join(",")];
    rows.forEach((o) => {
      const st = DICT.en[STATUS_META[displayStatus(o, now)].key]; const due = dueDate(o).toISOString().slice(0, 10);
      o.lines.forEach((l) => {
        const b = l.batches || [];
        out.push([o.orderNo, `"${outletById(o.outletId).name}"`, o.date, due, `"${productById(l.productId).name}"`, l.cartons, lineDelivered(l), l.cartons - lineDelivered(l),
          b[0]?.qty || "", b[0]?.expiry || "", b[1]?.qty || "", b[1]?.expiry || "", l.lineValue.toFixed(2), o.total.toFixed(2), st, o.completedDate || "", `"${o.note || ""}"`].join(","));
      });
    });
    downloadCsv(out.join("\n"), `ck-orders-${month}.csv`);
  };

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        <Stat label={t("statOrders")} value={scope.length} />
        <Stat label={t("statValue")} value={fmt(value)} mono />
        <Stat label={t("statRate")} value={`${rate}%`} tone={rate >= 70 ? "good" : "warn"} />
        <Stat label={t("statPending")} value={cnt("pending")} tone={cnt("pending") ? "warn" : "muted"} />
        <Stat label={t("statPartial")} value={cnt("partial")} tone={cnt("partial") ? "info" : "muted"} />
        <Stat label={t("statOverdue")} value={cnt("overdue")} tone={cnt("overdue") ? "bad" : "muted"} />
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        <Select value={month} onChange={setMonth} label={t("month")} options={[["all", t("allMonths")], ...months.map((m) => [m, monthLabel(m)])]} />
        <Select value={outlet} onChange={setOutlet} label={t("colOutlet")} options={[["all", t("allOutlets")], ...OUTLETS.map((o) => [o.id, o.name])]} />
        <Select value={status} onChange={setStatus} label={t("status")} options={[["all", t("allStatuses")], ["pending", t("stPending")], ["partial", t("stPartial")], ["overdue", t("stOverdue")], ["accomplished", t("stDone")], ["accomplished_late", t("stLate")], ["cancelled", t("stCancelled")]]} />
        <button onClick={exportCsv} className="ml-auto text-sm bg-white border border-slate-300 hover:bg-slate-50 px-4 py-2 rounded-lg font-medium">{t("exportCsv")}</button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr><Th>{t("colOrderNo")}</Th><Th>{t("colOutlet")}</Th><Th>{t("colDate")}</Th><Th right>{t("colItems")}</Th><Th right>{t("colDelivered")}</Th><Th right>{t("colValue")}</Th><Th>{t("colStatus")}</Th><Th /></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="text-center text-slate-400 py-8 text-sm">{t("noMatch")}</td></tr>}
            {rows.map((o) => {
              const st = displayStatus(o, now); const del = deliveredCartons(o), ord = orderedCartons(o); const isOpen = expanded === o.id; const locked = o.cancelled;
              return (
                <Fragment key={o.id}>
                  <tr className={`border-t border-slate-100 hover:bg-slate-50 ${locked ? "opacity-50" : "cursor-pointer"}`} onClick={() => (locked ? null : isOpen ? setExpanded(null) : openRow(o))}>
                    <Td mono>{o.orderNo}{o.note && <ReorderBadge />}</Td>
                    <Td>{outletById(o.outletId).name}</Td>
                    <Td>{fmtDate(o.date)}</Td>
                    <Td right mono>{o.lines.length}</Td>
                    <Td right mono><span className={del < ord ? "text-amber-600" : "text-emerald-600"}>{del}/{ord}</span></Td>
                    <Td right mono>{fmt(o.total)}</Td>
                    <Td><Badge st={st} /></Td>
                    <Td><div className="flex items-center gap-2 justify-end"><PdfBtn order={o} />{!locked && <span className="text-xs text-teal-700 whitespace-nowrap">{isOpen ? "▾" : "▸"} {t("viewDetails")}</span>}</div></Td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-slate-50 border-t border-slate-100">
                      <td colSpan={8} className="px-4 py-4">
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("fulfilTitle")} · <span className="text-slate-400 normal-case font-normal">{t("dueBy", { date: fmtDate(dueDate(o).toISOString().slice(0, 10)) })}</span></div>
                          <div className="flex items-center gap-3">
                            <button onClick={() => markAll(o)} className="text-xs text-teal-700 hover:underline">{t("markAllDelivered")}</button>
                            <PdfBtn order={o} label={t("downloadPdf")} />
                          </div>
                        </div>
                        <div className="border border-slate-200 rounded-lg overflow-x-auto bg-white">
                          <table className="w-full text-sm min-w-[640px]">
                            <thead className="bg-slate-50 text-slate-400 text-xs">
                              <tr><Th>{t("colProduct")}</Th><Th right>{t("ordered")}</Th><Th right>{t("del1")}</Th><Th>{t("exp1")}</Th><Th right>{t("del2")}</Th><Th>{t("exp2")}</Th><Th>{t("lineStatus")}</Th></tr>
                            </thead>
                            <tbody>
                              {o.lines.map((l) => {
                                const d = draft[l.productId] || { q1: 0, e1: "", q2: 0, e2: "" };
                                const del = (Number(d.q1) || 0) + (Number(d.q2) || 0);
                                const lnSt = del >= l.cartons ? "d" : del > 0 ? "p" : "o";
                                return (
                                  <tr key={l.productId} className="border-t border-slate-100">
                                    <Td>{productById(l.productId).name}</Td>
                                    <Td right mono>{l.cartons}</Td>
                                    <Td right><input value={d.q1} onChange={(e) => setField(l.productId, "q1", parseInt(e.target.value.replace(/\D/g, "")) || 0, l.cartons)} inputMode="numeric" className="w-16 text-right border border-slate-300 rounded-md py-1 px-2 font-mono text-sm" /></Td>
                                    <Td><input type="date" value={d.e1} onChange={(e) => setField(l.productId, "e1", e.target.value, l.cartons)} className={`border rounded-md py-1 px-2 font-mono text-xs ${(Number(d.q1) || 0) > 0 && !d.e1 ? "border-amber-300" : "border-slate-300"}`} /></Td>
                                    <Td right><input value={d.q2} onChange={(e) => setField(l.productId, "q2", parseInt(e.target.value.replace(/\D/g, "")) || 0, l.cartons)} inputMode="numeric" className="w-16 text-right border border-slate-300 rounded-md py-1 px-2 font-mono text-sm" /></Td>
                                    <Td><input type="date" value={d.e2} onChange={(e) => setField(l.productId, "e2", e.target.value, l.cartons)} className={`border rounded-md py-1 px-2 font-mono text-xs ${(Number(d.q2) || 0) > 0 && !d.e2 ? "border-amber-300" : "border-slate-300"}`} /></Td>
                                    <Td>
                                      {lnSt === "d" && <span className="text-xs text-emerald-600 font-medium">✓ {t("lnDelivered")}</span>}
                                      {lnSt === "p" && <span className="text-xs text-indigo-600 font-medium">{t("lnPartial")} · {t("remaining", { c: l.cartons - del })}</span>}
                                      {lnSt === "o" && <span className="text-xs text-amber-600 font-medium">{t("lnOutstanding")}</span>}
                                    </Td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => setExpanded(null)} className="border border-slate-300 hover:bg-slate-100 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg">{t("cancel")}</button>
                          <button onClick={() => save(o)} className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg">{t("saveDelivery")}</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StockTracker({ stock }) {
  const { t } = useT();
  const months = useMemo(() => { const s = new Set(stock.map((x) => x.month)); s.add(monthKey(todayISO())); return [...s].sort().reverse(); }, [stock]);
  const [month, setMonth] = useState(months[0]);
  const [open, setOpen] = useState(null);
  const submitted = stock.filter((s) => s.month === month);
  const ids = new Set(submitted.map((s) => s.outletId));
  const outstanding = OUTLETS.filter((o) => !ids.has(o.id));
  const exportCsv = () => {
    const head = ["Outlet", "Month", "Submitted", "Product", "Qty (units)", "Nearest Expiry"]; const out = [head.join(",")];
    submitted.forEach((s) => s.lines.forEach((l) => out.push([`"${outletById(s.outletId).name}"`, s.month, s.submittedDate, `"${productById(l.productId).name}"`, l.qty, l.expiry].join(","))));
    downloadCsv(out.join("\n"), `ck-stock-${month}.csv`);
  };
  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-5">
        <Stat label={t("statOutlets")} value={OUTLETS.length} />
        <Stat label={t("statSubmitted")} value={submitted.length} tone="good" />
        <Stat label={t("statOutstanding")} value={outstanding.length} tone={outstanding.length ? "warn" : "good"} />
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        <Select value={month} onChange={setMonth} label={t("month")} options={months.map((m) => [m, monthLabel(m)])} />
        <button onClick={exportCsv} disabled={submitted.length === 0} className="ml-auto text-sm bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 px-4 py-2 rounded-lg font-medium">{t("exportCsv")}</button>
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t("submittedN", { n: submitted.length })}</div>
          <div className="space-y-2">
            {submitted.length === 0 && <Empty>{t("noSubs", { month: monthLabel(month) })}</Empty>}
            {submitted.map((s) => (
              <div key={s.id} className="bg-white border border-slate-200 rounded-xl">
                <button onClick={() => setOpen(open === s.id ? null : s.id)} className="w-full flex items-center justify-between px-4 py-3 text-left"><span className="text-sm font-medium">{outletById(s.outletId).name}</span><span className="text-xs text-slate-400 font-mono">{fmtDate(s.submittedDate)}</span></button>
                {open === s.id && <div className="px-4 pb-3 space-y-1 border-t border-slate-100 pt-2">{s.lines.map((l) => <div key={l.productId} className="flex justify-between text-xs"><span className="text-slate-600">{productById(l.productId).name}</span><span className="font-mono text-slate-500">{t("unitsExp", { qty: l.qty, date: fmtDate(l.expiry) })}</span></div>)}</div>}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t("outstandingN", { n: outstanding.length })}</div>
          <div className="bg-white border border-slate-200 rounded-xl p-2 max-h-[420px] overflow-y-auto">
            {outstanding.length === 0 ? <p className="text-sm text-emerald-700 p-3">{t("allReported")}</p> : outstanding.map((o) => <div key={o.id} className="flex items-center justify-between px-3 py-2 text-sm border-b border-slate-50 last:border-0"><span>{o.name}</span><span className="text-xs font-mono text-amber-600">{t("outstanding")}</span></div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- shared ---------- */
function downloadCsv(text, filename) { const blob = new Blob([text], { type: "text/csv;charset=utf-8;" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); }

/* ---------- PDF work order (production-only · BM · English months) ---------- */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if ([...document.scripts].some((s) => s.src === src)) return resolve();
    const el = document.createElement("script");
    el.src = src; el.onload = () => resolve(); el.onerror = () => reject(new Error("Cannot load " + src));
    document.head.appendChild(el);
  });
}
let _jspdf = null;
async function ensureJsPDF() {
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js");
  _jspdf = window.jspdf.jsPDF;
  return _jspdf;
}
const printDateTime = () => {
  const d = new Date();
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) + ", " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};
async function downloadOrderPdf(order) {
  try {
    const JsPDF = await ensureJsPDF();
    const doc = new JsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth(), M = 40;
    const teal = [13, 148, 136], ink = [15, 23, 42], mute = [100, 116, 139], line = [203, 213, 225];
    const amberFill = [255, 251, 235], brown = [146, 64, 14];

    doc.setFillColor(...teal); doc.roundedRect(M, 30, 30, 30, 5, 5, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("courier", "bold"); doc.setFontSize(14);
    doc.text("CK", M + 15, 50, { align: "center" });
    doc.setTextColor(...ink); doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text("CK Products", M + 40, 44);
    doc.setTextColor(...mute); doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text("Arahan Pengeluaran & Penghantaran", M + 40, 57);
    doc.setTextColor(...ink); doc.setFont("courier", "bold"); doc.setFontSize(16); doc.text(order.orderNo, W - M, 46, { align: "right" });
    doc.setTextColor(...mute); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.text("Dicetak " + printDateTime(), W - M, 58, { align: "right" });
    doc.setDrawColor(...ink); doc.setLineWidth(1.5); doc.line(M, 70, W - M, 70);

    const now = new Date();
    const stKey = STATUS_META[displayStatus(order, now)].key;
    const statusMs = DICT.ms[stKey];
    const due = dueDate(order).toISOString().slice(0, 10);
    let y = 88;
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(...mute);
    doc.text("Outlet", M, y); doc.text("Status", W / 2, y);
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(...ink);
    doc.text(outletById(order.outletId).name, M, y + 13);
    doc.setFont("courier", "normal"); doc.setFontSize(8); doc.setTextColor(148, 163, 184);
    doc.text(order.outletId, M + doc.getTextWidth(outletById(order.outletId).name) * 1.15 + 8, y + 13);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...ink); doc.text(statusMs, W / 2, y + 13);
    if (order.note) { doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(79, 70, 229); doc.text("• TEMPAHAN SEMULA", W / 2 + 90, y + 13); }
    y += 30;
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(...mute);
    doc.text("Tarikh tempahan", M, y); doc.text("Perlu siap sebelum", W / 2, y);
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(...ink);
    doc.text(fmtDate(order.date), M, y + 13); doc.text(fmtDate(due), W / 2, y + 13);
    y += 22; doc.setDrawColor(...line); doc.setLineWidth(0.5); doc.line(M, y, W - M, y); y += 6;

    const head = [["#", "Produk", "Karton", "Unit/ktn", "Jumlah unit", "Dihantar 1", "Luput 1", "Dihantar 2", "Luput 2"]];
    const body = []; let idx = 0, totKar = 0, totUnit = 0;
    CAT_ORDER.forEach((cat) => {
      const items = order.lines.filter((l) => productById(l.productId).cat === cat);
      if (!items.length) return;
      body.push([{ content: CAT[cat].ms, colSpan: 9, styles: { fillColor: [248, 250, 252], textColor: mute, fontStyle: "bold", fontSize: 7.5, halign: "left" } }]);
      items.forEach((l) => {
        idx++; const p = productById(l.productId); const units = l.cartons * p.perCarton; totKar += l.cartons; totUnit += units;
        body.push([String(idx), p.name, String(l.cartons), String(p.perCarton), { content: String(units), styles: { fontStyle: "bold" } }, "", "", "", ""]);
      });
    });
    body.push([{ content: "Jumlah", colSpan: 2, styles: { fontStyle: "bold" } }, { content: String(totKar), styles: { fontStyle: "bold", halign: "right" } }, "", { content: String(totUnit), styles: { fontStyle: "bold", halign: "right" } }, "", "", "", ""]);

    doc.autoTable({
      head, body, startY: y, margin: { left: M, right: M }, theme: "grid",
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 4, lineColor: line, lineWidth: 0.4, textColor: ink, valign: "middle" },
      headStyles: { fillColor: [255, 255, 255], textColor: mute, fontStyle: "normal", fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 20 }, 1: { cellWidth: "auto" },
        2: { cellWidth: 42, halign: "right", font: "courier" }, 3: { cellWidth: 46, halign: "right", font: "courier" },
        4: { cellWidth: 54, halign: "right", font: "courier" },
        5: { cellWidth: 56 }, 6: { cellWidth: 50 }, 7: { cellWidth: 56 }, 8: { cellWidth: 50 },
      },
      didParseCell: (data) => {
        const delivery = data.column.index >= 5;
        if (data.section === "head") { if (delivery) { data.cell.styles.fillColor = amberFill; data.cell.styles.textColor = brown; data.cell.styles.halign = "center"; } return; }
        const r0 = data.row.raw[0];
        const spanRow = r0 && typeof r0 === "object" && r0.colSpan;
        if (delivery && !spanRow) { data.cell.styles.fillColor = amberFill; data.cell.styles.minCellHeight = 20; }
      },
    });

    let fy = doc.lastAutoTable.finalY + 16;
    doc.setDrawColor(...line); doc.setLineWidth(0.5); doc.rect(M, fy, W - 2 * M, 42);
    doc.setFontSize(7); doc.setTextColor(...mute); doc.text("Catatan", M + 6, fy + 12);
    fy += 42 + 26;
    const col = (W - 2 * M) / 3;
    doc.setDrawColor(...mute); doc.setLineWidth(0.6);
    [0, 1, 2].forEach((i) => doc.line(M + i * col, fy, M + i * col + col - 14, fy));
    doc.setFontSize(7.5); doc.setTextColor(...mute);
    doc.text("Disediakan oleh", M, fy + 12); doc.text("Disemak & diterima oleh", M + col, fy + 12); doc.text("Tarikh", M + 2 * col, fy + 12);

    doc.save(`${order.orderNo}.pdf`);
  } catch (e) {
    alert("PDF: " + (e?.message || e) + "\n(The PDF library couldn't load — check the network, then retry.)");
  }
}
function PdfBtn({ order, label }) {
  const [busy, setBusy] = useState(false);
  const go = async (e) => { e.stopPropagation(); setBusy(true); try { await downloadOrderPdf(order); } finally { setBusy(false); } };
  return <button onClick={go} disabled={busy} className="text-xs border border-slate-300 hover:bg-slate-50 disabled:opacity-50 px-2.5 py-1 rounded-md font-medium">{busy ? "…" : (label || "PDF")}</button>;
}
function Th({ children, right }) { return <th className={`px-4 py-2 font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>; }
function Td({ children, right, mono }) { return <td className={`px-4 py-2.5 ${right ? "text-right" : "text-left"} ${mono ? "font-mono" : ""}`}>{children}</td>; }
function Badge({ st }) { const { t } = useT(); const m = STATUS_META[st]; return <span className={`inline-block text-xs px-2 py-0.5 rounded-full border font-medium ${m.cls}`}>{t(m.key)}</span>; }
function Stat({ label, value, mono, tone }) {
  const toneCls = { good: "text-emerald-700", warn: "text-amber-600", bad: "text-red-600", info: "text-indigo-600", muted: "text-slate-400" }[tone] || "text-slate-900";
  return <div className="bg-white border border-slate-200 rounded-xl p-3"><div className="text-xs text-slate-500">{label}</div><div className={`text-xl font-semibold ${mono ? "font-mono" : ""} ${toneCls}`}>{value}</div></div>;
}
function Select({ value, onChange, label, options }) {
  return <label className="inline-flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm"><span className="text-slate-400 text-xs">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="bg-transparent font-medium outline-none">{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>;
}
function Empty({ children }) { return <div className="bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center text-sm text-slate-500">{children}</div>; }
