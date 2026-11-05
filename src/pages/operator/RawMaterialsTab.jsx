import { useMemo, useState } from 'react'
import { materialPlan } from '../../lib/materialPlan'
import { recipeCost } from '../../lib/recipeCost'
import { downloadCsv } from '../../lib/csv'
import { CatHeader, Th, Td, Select, Empty } from '../../components/ui'
import RawMaterials from './RawMaterials'
import RecipeModal from './RecipeModal'

// Filters narrow both the list and the Material Plan to the raw materials used
// by the chosen product line / finished product (via their recipes).
export default function RawMaterialsTab({ products, rawMaterials, recipes, orders, onMaterialsChanged }) {
  const [line, setLine] = useState('') // '' = all product lines
  const [productId, setProductId] = useState('') // '' = all products
  const [recipeProduct, setRecipeProduct] = useState(null)

  const recipeByProduct = useMemo(() => Object.fromEntries(recipes.map((r) => [r.productId, r])), [recipes])
  const productById = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products])
  const lines = useMemo(() => [...new Set(products.map((p) => p.product_line).filter(Boolean))].sort(), [products])
  const productOptions = useMemo(
    () => products.filter((p) => (!line || p.product_line === line) && recipeByProduct[p.id]),
    [products, line, recipeByProduct]
  )
  // a product picked under another line is dropped when the line changes
  const activeProductId = productOptions.some((p) => p.id === productId) ? productId : ''

  const visibleIds = useMemo(() => {
    if (!line && !activeProductId) return null // no filter
    const productIds = activeProductId ? [activeProductId] : products.filter((p) => p.product_line === line).map((p) => p.id)
    const ids = new Set()
    productIds.forEach((id) => recipeByProduct[id]?.lines.forEach((l) => ids.add(l.rawMaterialId)))
    return ids
  }, [line, activeProductId, products, recipeByProduct])

  const shown = visibleIds ? rawMaterials.filter((m) => visibleIds.has(m.id)) : rawMaterials

  const usedIn = useMemo(() => {
    const map = {}
    recipes.forEach((r) => {
      const name = productById[r.productId]?.name
      if (!name) return
      r.lines.forEach((l) => { (map[l.rawMaterialId] ||= []).push(name) })
    })
    return map
  }, [recipes, productById])

  const plan = useMemo(() => materialPlan(orders, recipes, rawMaterials), [orders, recipes, rawMaterials])
  const planRows = visibleIds ? plan.rows.filter((r) => visibleIds.has(r.rawMaterialId)) : plan.rows
  const missingRecipe = activeProductId
    ? []
    : line ? plan.missingRecipe.filter((p) => productById[p.id]?.product_line === line) : plan.missingRecipe

  const selectedProduct = activeProductId ? productById[activeProductId] : null
  const cost = selectedProduct
    ? recipeCost(selectedProduct, recipeByProduct[activeProductId].batchYield, recipeByProduct[activeProductId].lines, rawMaterials)
    : null

  const exportMaterialCsv = () => {
    const head = ['Raw Material', 'Unit', 'Needed', 'On Hand', 'Shortfall', 'Suggested Buy']
    const out = [head.join(',')]
    planRows.forEach((r) => out.push([
      `"${r.material?.name || r.rawMaterialId}"`, r.material?.unit || '', r.needed, r.onHand, r.shortfall, r.suggestedBuy,
    ].join(',')))
    downloadCsv(out.join('\n'), 'ck-material-plan.csv')
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <Select value={line} onChange={setLine} label="Product line" options={[['', 'All lines'], ...lines.map((l) => [l, l])]} />
        <Select value={activeProductId} onChange={setProductId} label="Finished product" options={[['', 'All products'], ...productOptions.map((p) => [p.id, p.name])]} />
      </div>

      {cost && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Cost to make · {selectedProduct.name}</div>
            <div className="flex gap-6 font-mono text-sm">
              <span>RM {cost.perUnit.toFixed(4)} <span className="text-xs text-slate-400 font-sans">per unit</span></span>
              <span>RM {cost.perCarton.toFixed(2)} <span className="text-xs text-slate-400 font-sans">per carton ({selectedProduct.units_per_carton} units)</span></span>
            </div>
            {cost.missing.length > 0 && (
              <p className="text-xs text-amber-700 mt-1.5">Incomplete: no cost set for {cost.missing.join(', ')}.</p>
            )}
          </div>
          <button onClick={() => setRecipeProduct(selectedProduct)} className="text-sm border border-slate-300 hover:bg-slate-50 px-3 py-1.5 rounded-lg font-medium">Edit recipe</button>
        </div>
      )}

      <CatHeader>Raw materials</CatHeader>
      <RawMaterials rawMaterials={shown} allMaterials={rawMaterials} usedIn={usedIn} onChanged={onMaterialsChanged} />

      <div className="flex items-center justify-between mt-8 mb-3">
        <h3 className="text-sm font-semibold text-slate-700">Material Plan</h3>
        <button
          onClick={exportMaterialCsv} disabled={planRows.length === 0}
          className="text-sm bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 px-4 py-2 rounded-lg font-medium"
        >
          Export CSV
        </button>
      </div>

      {missingRecipe.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 text-xs text-amber-800">
          <span className="font-semibold">No recipe yet, not included below:</span>{' '}
          {missingRecipe.map((p) => p.name).join(', ')}
        </div>
      )}

      {planRows.length === 0 ? (
        <Empty>No raw material needs — nothing outstanding has a recipe yet.</Empty>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <Th>Raw Material</Th>
                <Th right>Needed</Th>
                <Th right>On Hand</Th>
                <Th right>Shortfall</Th>
                <Th right>Suggested Buy</Th>
              </tr>
            </thead>
            <tbody>
              {planRows.map((r) => (
                <tr key={r.rawMaterialId} className="border-t border-slate-100">
                  <Td>{r.material?.name || r.rawMaterialId}</Td>
                  <Td right mono>{r.needed.toLocaleString()} {r.material?.unit}</Td>
                  <Td right mono>{r.onHand.toLocaleString()} {r.material?.unit}</Td>
                  <Td right mono>
                    <span className={r.shortfall > 0 ? 'text-amber-600 font-semibold' : 'text-emerald-600'}>
                      {r.shortfall.toLocaleString()} {r.material?.unit}
                    </span>
                  </Td>
                  <Td right mono>{r.suggestedBuy.toLocaleString()} {r.material?.unit}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {recipeProduct && (
        <RecipeModal
          product={recipeProduct} rawMaterials={rawMaterials}
          onClose={() => setRecipeProduct(null)}
          onSaved={async () => { setRecipeProduct(null); await onMaterialsChanged() }}
        />
      )}
    </div>
  )
}
