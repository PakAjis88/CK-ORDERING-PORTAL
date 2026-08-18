import { supabase } from '../supabaseClient'

const BUCKET = 'product-photos'

// One canonical object path per product (its code) — re-uploading always
// replaces it in place (upsert), so there's never an orphaned old file.
export async function uploadProductPhoto(product, file) {
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(product.code, file, { upsert: true, contentType: file.type, cacheControl: '3600' })
  if (uploadErr) throw uploadErr

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(product.code)
  const photoUrl = `${data.publicUrl}?v=${Date.now()}` // cache-bust since the path never changes

  const { error: rpcErr } = await supabase.rpc('set_product_photo', {
    p_product_id: product.id,
    p_photo_url: photoUrl,
  })
  if (rpcErr) throw rpcErr
  return photoUrl
}

export async function deleteProductPhoto(product) {
  await supabase.storage.from(BUCKET).remove([product.code])
  const { error } = await supabase.rpc('set_product_photo', { p_product_id: product.id, p_photo_url: null })
  if (error) throw error
}
