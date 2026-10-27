/* The nutrient table, in Nutrition Facts order, and the helpers that shape a nutrient vector.
   Every food, entry and target uses these keys. Add a nutrient here and the whole app
   (forms, full label, totals, AI prompts) picks it up; also give it a target in targets.js. */

export const NUTR = [
  { k: 'kcal', label: 'Calories', unit: '', dp: 0 },
  { k: 'fat', label: 'Total Fat', unit: 'g', dp: 0 },
  { k: 'satFat', label: 'Saturated Fat', unit: 'g', dp: 1, sub: true, max: true },
  { k: 'transFat', label: 'Trans Fat', unit: 'g', dp: 1, sub: true, noTarget: true },
  { k: 'cholesterol', label: 'Cholesterol', unit: 'mg', dp: 0, max: true },
  { k: 'sodium', label: 'Sodium', unit: 'mg', dp: 0, max: true },
  { k: 'carbs', label: 'Total Carbohydrate', unit: 'g', dp: 0 },
  { k: 'fiber', label: 'Dietary Fiber', unit: 'g', dp: 0, sub: true },
  { k: 'sugar', label: 'Total Sugars', unit: 'g', dp: 0, sub: true, noTarget: true },
  { k: 'addedSugar', label: 'Added Sugars', unit: 'g', dp: 0, sub: true, max: true },
  { k: 'protein', label: 'Protein', unit: 'g', dp: 0 },
  { k: 'vitD', label: 'Vitamin D', unit: 'mcg', dp: 1 },
  { k: 'calcium', label: 'Calcium', unit: 'mg', dp: 0 },
  { k: 'iron', label: 'Iron', unit: 'mg', dp: 1 },
  { k: 'potassium', label: 'Potassium', unit: 'mg', dp: 0 },
  /* ext: shown in a second block of the full label and behind "More vitamins and minerals" on forms */
  { k: 'vitA', label: 'Vitamin A', unit: 'mcg', dp: 0, ext: true },
  { k: 'vitC', label: 'Vitamin C', unit: 'mg', dp: 0, ext: true },
  { k: 'vitE', label: 'Vitamin E', unit: 'mg', dp: 1, ext: true },
  { k: 'vitK', label: 'Vitamin K', unit: 'mcg', dp: 0, ext: true },
  { k: 'vitB6', label: 'Vitamin B6', unit: 'mg', dp: 1, ext: true },
  { k: 'folate', label: 'Folate', unit: 'mcg', dp: 0, ext: true },
  { k: 'vitB12', label: 'Vitamin B12', unit: 'mcg', dp: 1, ext: true },
  { k: 'magnesium', label: 'Magnesium', unit: 'mg', dp: 0, ext: true },
  { k: 'zinc', label: 'Zinc', unit: 'mg', dp: 1, ext: true },
  { k: 'selenium', label: 'Selenium', unit: 'mcg', dp: 0, ext: true },
  { k: 'iodine', label: 'Iodine', unit: 'mcg', dp: 0, ext: true },
  { k: 'omega3', label: 'Omega-3 (EPA + DHA)', unit: 'mg', dp: 0, ext: true },
  { k: 'creatine', label: 'Creatine', unit: 'g', dp: 1, ext: true, noTarget: true },
  { k: 'caffeine', label: 'Caffeine', unit: 'mg', dp: 0, ext: true, max: true },
];
export const NK = NUTR.map(n => n.k);
export const NMETA = Object.fromEntries(NUTR.map(n => [n.k, n]));
/* Short labels for the micronutrient line under supplement entries, in display priority order. */
export const SHORT = { omega3: 'Ω3', vitD: 'D', creatine: 'Creatine', caffeine: 'Caffeine', calcium: 'Ca', iron: 'Fe', potassium: 'K', magnesium: 'Mg', zinc: 'Zn', vitA: 'A', vitC: 'C', vitE: 'E', vitK: 'Vit K', vitB6: 'B6', folate: 'Folate', vitB12: 'B12', selenium: 'Se', iodine: 'I' };

/* Free-form actives that have no column (beta-alanine, citrulline, probiotics, ashwagandha...):
   [{name, v, unit}] on a food or entry. Sum a list of them by name and unit. */
export function sumExtras(lists) {
  const acc = new Map();
  lists.forEach(([extras, q]) => (extras || []).forEach(x => {
    if (!x || !x.name) return;
    const key = String(x.name).trim().toLowerCase() + '|' + String(x.unit || '').trim().toLowerCase();
    const cur = acc.get(key) || { name: String(x.name).trim(), unit: String(x.unit || '').trim(), v: 0 };
    cur.v += Number(x.v || 0) * q; acc.set(key, cur);
  }));
  return Array.from(acc.values()).sort((a, b) => a.name.localeCompare(b.name));
}
export function cleanExtras(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 16).map(x => ({ name: String((x && (x.name ?? x.n)) || '').trim().slice(0, 40), v: numOrNull(x && (x.v ?? x.amount)) ?? 0, unit: String((x && x.unit) || '').trim().slice(0, 12) })).filter(x => x.name);
}

const numOrNull = v => { if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };

/* A complete nutrient vector from a partial one; missing keys become null (unknown), never 0. */
export function fullN(partial) { const n = {}; NK.forEach(k => { n[k] = (partial && partial[k] !== undefined) ? numOrNull(partial[k]) : null; }); return n; }
export function blankN() { const n = {}; NK.forEach(k => n[k] = null); return n; }
/* Per-serving vector times a serving count; null stays null. */
export function scaled(n, q) { const o = {}; NK.forEach(k => { o[k] = (n && n[k] !== null && n[k] !== undefined) ? Number(n[k]) * q : null; }); return o; }
