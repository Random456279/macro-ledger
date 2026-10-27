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
  { k: 'vitB12', label: 'Vitamin B12', unit: 'mcg', dp: 1, ext: true },
  { k: 'magnesium', label: 'Magnesium', unit: 'mg', dp: 0, ext: true },
  { k: 'zinc', label: 'Zinc', unit: 'mg', dp: 1, ext: true },
];
export const NK = NUTR.map(n => n.k);
export const NMETA = Object.fromEntries(NUTR.map(n => [n.k, n]));
/* Short labels for the micronutrient line under supplement entries. */
export const SHORT = { vitD: 'D', calcium: 'Ca', iron: 'Fe', potassium: 'K', vitA: 'A', vitC: 'C', vitB12: 'B12', magnesium: 'Mg', zinc: 'Zn' };

const numOrNull = v => { if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };

/* A complete nutrient vector from a partial one; missing keys become null (unknown), never 0. */
export function fullN(partial) { const n = {}; NK.forEach(k => { n[k] = (partial && partial[k] !== undefined) ? numOrNull(partial[k]) : null; }); return n; }
export function blankN() { const n = {}; NK.forEach(k => n[k] = null); return n; }
/* Per-serving vector times a serving count; null stays null. */
export function scaled(n, q) { const o = {}; NK.forEach(k => { o[k] = (n && n[k] !== null && n[k] !== undefined) ? Number(n[k]) * q : null; }); return o; }
