// Pure calculation, no React: what one carton (and one unit) of a product
// costs to make, from its recipe lines and the raw materials' unit costs.
//
// product: { units_per_carton }
// lines: [{ rawMaterialId, qty, basis }]   (qty already a number)
// rawMaterials: [{ id, name, unitCost }]   (unitCost null = not entered)
//
// Lines whose material has no cost (or a per-batch line with no valid batch
// yield) are left out of the total and listed in `missing`, so a partial total
// is never presented as a complete one.

import { neededForLine } from './materialPlan'

export function recipeCost(product, batchYield, lines, rawMaterials) {
  const byId = Object.fromEntries(rawMaterials.map((m) => [m.id, m]))
  const unitsPerCarton = product.units_per_carton
  const missing = []
  let perCarton = 0

  const rows = lines.map((line) => {
    const material = byId[line.rawMaterialId]
    const amount = neededForLine(1, unitsPerCarton, line, batchYield) // amount of material for one carton
    const needsYield = line.basis === 'batch' && !(batchYield > 0)
    const cost = material && material.unitCost != null && !needsYield ? amount * material.unitCost : null
    if (cost == null) {
      if (material && !missing.includes(material.name)) missing.push(material.name)
    } else {
      perCarton += cost
    }
    return { rawMaterialId: line.rawMaterialId, amount: needsYield ? null : amount, cost }
  })

  return { rows, perCarton, perUnit: unitsPerCarton > 0 ? perCarton / unitsPerCarton : 0, missing }
}
