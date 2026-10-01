import { supabase } from '../supabaseClient'

export async function listRawMaterials() {
  const { data, error } = await supabase
    .from('raw_materials')
    .select('id, code, name, unit, pack_size, stock_on_hand, active')
    .eq('active', true)
    .order('code')
  if (error) throw error
  return data.map((m) => ({
    id: m.id, code: m.code, name: m.name, unit: m.unit,
    packSize: Number(m.pack_size), stockOnHand: Number(m.stock_on_hand),
  }))
}

// Every product's recipe in one shot, shaped for materialPlan.js.
export async function listProductRecipes() {
  const [{ data: recipes, error: e1 }, { data: lines, error: e2 }] = await Promise.all([
    supabase.from('product_recipes').select('product_id, batch_yield'),
    supabase.from('product_recipe_lines').select('product_id, raw_material_id, qty, basis'),
  ])
  if (e1) throw e1
  if (e2) throw e2
  return recipes.map((r) => ({
    productId: r.product_id,
    batchYield: r.batch_yield,
    lines: lines
      .filter((l) => l.product_id === r.product_id)
      .map((l) => ({ rawMaterialId: l.raw_material_id, qty: Number(l.qty), basis: l.basis })),
  }))
}

export async function getProductRecipe(productId) {
  const [{ data: recipe, error: e1 }, { data: lines, error: e2 }] = await Promise.all([
    supabase.from('product_recipes').select('batch_yield').eq('product_id', productId).maybeSingle(),
    supabase.from('product_recipe_lines').select('raw_material_id, qty, basis').eq('product_id', productId),
  ])
  if (e1) throw e1
  if (e2) throw e2
  if (!recipe) return null
  return { batchYield: recipe.batch_yield, lines: lines.map((l) => ({ rawMaterialId: l.raw_material_id, qty: Number(l.qty), basis: l.basis })) }
}

export async function upsertRawMaterial({ id, code, name, unit, packSize }) {
  const { data, error } = await supabase.rpc('upsert_raw_material', {
    p_id: id || null, p_code: code, p_name: name, p_unit: unit, p_pack_size: packSize,
  })
  if (error) throw error
  return data
}

export async function setRawMaterialStock(id, qty) {
  const { error } = await supabase.rpc('set_raw_material_stock', { p_id: id, p_qty: qty })
  if (error) throw error
}

// lines: [{ rawMaterialId, qty, basis }]
export async function saveProductRecipe(productId, batchYield, lines) {
  const { error } = await supabase.rpc('save_product_recipe', {
    p_product_id: productId,
    p_batch_yield: batchYield,
    p_lines: lines.map((l) => ({ raw_material_id: l.rawMaterialId, qty: l.qty, basis: l.basis })),
  })
  if (error) throw error
}
