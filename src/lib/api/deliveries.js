import { supabase } from '../supabaseClient'

const BUCKET = 'delivery-photos'
const MAX_EDGE = 1280 // longest side of the compressed photo, in pixels

// Malaysia calendar date (YYYY-MM-DD). The week runs Monday to Sunday.
export const klToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })

export function klWeekStart(today = klToday()) {
  const d = new Date(`${today}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

// Shrinks a camera photo to a JPEG of roughly 100-250 KB before it is uploaded.
// Older iPhones reject the orientation option, so fall back to a plain <img>, which
// browsers already draw the right way up.
async function decodePhoto(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return { width: img.naturalWidth, height: img.naturalHeight, source: img }
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

export async function compressPhoto(file) {
  const bitmap = await decodePhoto(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap.source || bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  let blob = null
  for (const quality of [0.6, 0.45, 0.3]) {
    blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (blob && blob.size <= 300 * 1024) break
  }
  if (!blob) throw new Error('Could not read that photo. Please take it again.')
  return blob
}

// Uploads the photo, then saves the delivery. lines: [{ productId, cartons, expiry }]
// dropId is generated when the photo is taken; the photo is stored as <dropId>.jpg.
export async function recordStaffDelivery({ outletId, lines, photo, dropId }) {
  const path = `${dropId}.jpg`
  const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, photo, { contentType: 'image/jpeg' })
  if (uploadErr && !/already exists|duplicate/i.test(uploadErr.message)) {
    throw new Error('Could not upload the photo. Check the connection and try again.')
  }
  const { data, error } = await supabase.rpc('record_staff_delivery', {
    p_outlet_id: outletId,
    p_lines: lines.map((l) => ({ product_id: l.productId, cartons: l.cartons, expiry: l.expiry })),
    p_drop_id: dropId,
    p_photo_path: path,
  })
  if (error) throw error
  return data // { drop_id, delivered_date, lines: [{ product, cartons, knocked_off, extra }] }
}

// cartons 0 removes the entry. Staff: current week only (enforced by the database).
export async function correctDeliveryEntry({ dropId, productId, cartons, expiry }) {
  const { data, error } = await supabase.rpc('correct_delivery_entry', {
    p_drop_id: dropId, p_product_id: productId, p_cartons: cartons, p_expiry: expiry || null,
  })
  if (error) throw error
  return data
}

// The server returns at most 1000 rows per request, so a long report is fetched page by page.
const PAGE = 1000

export async function listDeliveries(from, to, outletId) {
  const data = []
  for (let start = 0; ; start += PAGE) {
    const { data: page, error } = await supabase
      .rpc('list_deliveries', { p_from: from, p_to: to, p_outlet_id: outletId || null })
      .range(start, start + PAGE - 1)
    if (error) throw error
    data.push(...page)
    if (page.length < PAGE) break
  }
  return data.map((r) => ({
    batchId: r.batch_id, dropId: r.drop_id, deliveredDate: r.delivered_date,
    outletCode: r.outlet_code, outletName: r.outlet_name,
    productId: r.product_id, productCode: r.product_code, productName: r.product_name,
    cartons: r.cartons, expiry: r.expiry_date, orderNo: r.order_no,
    kind: r.kind, enteredBy: r.entered_by, photoPath: r.photo_path, createdAt: r.created_at, canCorrect: r.can_correct,
  }))
}

export async function signedPhotoUrl(path) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600)
  if (error) throw error
  return data.signedUrl
}
