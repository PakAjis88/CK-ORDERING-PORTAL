// Next automatic raw material code: RM-001, RM-002, ... one above the highest
// existing RM-<digits> code. Codes of any other shape (e.g. RM-BOX-ALM) are ignored.
export function nextMaterialCode(materials) {
  let highest = 0
  materials.forEach((m) => {
    const hit = /^RM-(\d+)$/.exec(m.code || '')
    if (hit) highest = Math.max(highest, Number(hit[1]))
  })
  return `RM-${String(highest + 1).padStart(3, '0')}`
}
