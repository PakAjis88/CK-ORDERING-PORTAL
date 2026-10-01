// Pure calculation, no React — how much of each raw material is needed to
// fulfil outstanding outlet orders, given each product's recipe.
//
// recipes: [{ productId, batchYield, lines: [{ rawMaterialId, qty, basis }] }]
// rawMaterials: [{ id, code, name, unit, packSize, stockOnHand }]
// orders: order rows shaped like orderStatus.js expects (order_lines with
//         cartons_ordered, units_per_carton_snapshot, delivery_batches)

import { lineDelivered } from './orderStatus'

// Amount of one raw material needed for one order line's outstanding cartons,
// given one recipe line's basis.
function neededForLine(remainingCartons, unitsPerCarton, recipeLine, batchYield) {
  const { qty, basis } = recipeLine
  if (basis === 'carton') return remainingCartons * qty
  if (basis === 'unit') return remainingCartons * unitsPerCarton * qty
  // 'batch': qty per whole batch, which yields batchYield finished units
  return ((remainingCartons * unitsPerCarton) / batchYield) * qty
}

export function materialPlan(orders, recipes, rawMaterials) {
  const recipeByProduct = Object.fromEntries(recipes.map((r) => [r.productId, r]))
  const materialById = Object.fromEntries(rawMaterials.map((m) => [m.id, m]))
  const needed = {} // rawMaterialId -> total needed
  const missingRecipe = {} // productId -> product (outstanding orders, no recipe)

  orders.filter((o) => !o.cancelled).forEach((o) => {
    o.order_lines.forEach((l) => {
      const remaining = l.cartons_ordered - lineDelivered(l)
      if (remaining <= 0) return

      const recipe = recipeByProduct[l.product_id]
      if (!recipe) {
        missingRecipe[l.product_id] = l.product
        return
      }

      recipe.lines.forEach((line) => {
        const amount = neededForLine(remaining, l.units_per_carton_snapshot, line, recipe.batchYield)
        needed[line.rawMaterialId] = (needed[line.rawMaterialId] || 0) + amount
      })
    })
  })

  const rows = Object.entries(needed).map(([rawMaterialId, need]) => {
    const material = materialById[rawMaterialId]
    const onHand = material?.stockOnHand || 0
    const shortfall = Math.max(0, need - onHand)
    const packSize = material?.packSize || 1
    const suggestedBuy = shortfall > 0 ? Math.ceil(shortfall / packSize) * packSize : 0
    return { rawMaterialId, material, needed: need, onHand, shortfall, suggestedBuy }
  })

  return { rows, missingRecipe: Object.values(missingRecipe) }
}
