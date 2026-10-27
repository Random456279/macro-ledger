/* Daily targets from the profile. Pure math, no DOM.
   Calories: Mifflin-St Jeor, or Katch-McArdle when a body fat estimate is given, times an
   activity factor, plus or minus about 500 kcal per pound per week of goal pace.
   Macros: protein per pound (of lean mass when known), fat floor around 27% of calories,
   carbs fill the rest. Micros: Dietary Reference Intakes by sex and age; "max" items are
   Dietary Guidelines limits. Anything here can be overridden per user in Me → Edit targets. */
import { num, clamp } from './util.js';
import { S } from './state.js';

export function calcTargets(p) {
  const lb = num(p.weightLb), kg = lb * 0.45359237;
  const cm = (num(p.heightFt) * 12 + num(p.heightIn)) * 2.54, age = num(p.age);
  const bf = (p.bodyFat === null || p.bodyFat === undefined || p.bodyFat === '') ? null : clamp(num(p.bodyFat), 3, 60);
  const male = p.sex !== 'f';
  const bmr = bf !== null ? 370 + 21.6 * (kg * (1 - bf / 100)) : (10 * kg + 6.25 * cm - 5 * age + (male ? 5 : -161));
  const tdee = bmr * num(p.activity || 1.375);
  const rate = num(p.rate || 1);
  const delta = p.goal === 'lose' ? -500 * rate : p.goal === 'gain' ? 500 * rate : 0;
  let kcal = Math.round((tdee + delta) / 10) * 10;
  kcal = Math.max(kcal, male ? 1500 : 1200);
  const cut = p.goal === 'lose';
  let protein = bf !== null ? lb * (1 - bf / 100) * (cut ? 1.1 : 1.0) : lb * (cut ? 0.9 : 0.8);
  protein = Math.round(protein);
  let fat = Math.round(Math.max(kcal * 0.27 / 9, lb * 0.3));
  let carbs = Math.round((kcal - protein * 4 - fat * 9) / 4);
  if (carbs < 60) { carbs = 60; fat = Math.round(Math.max(40, (kcal - protein * 4 - carbs * 4) / 9)); }
  return {
    kcal, protein, carbs, fat,
    fiber: Math.round(kcal / 1000 * 14), addedSugar: Math.round(kcal * 0.10 / 4), satFat: Math.round(kcal * 0.10 / 9),
    cholesterol: 300, sodium: 2300, potassium: male ? 3400 : 2600, calcium: 1000, iron: male ? 8 : (age > 50 ? 8 : 18), vitD: 15,
    vitA: male ? 900 : 700, vitC: male ? 90 : 75, vitB12: 2.4, magnesium: male ? (age <= 30 ? 400 : 420) : (age <= 30 ? 310 : 320), zinc: male ? 11 : 8,
    bmr: Math.round(bmr), tdee: Math.round(tdee),
  };
}

export function profileComplete(p) { return !!(p && p.age && p.heightFt && p.weightLb); }

/* Saved targets win; anything a newer version tracks that the saved set lacks falls back to the calculated value. */
export function activeTargets() {
  const p = S.profile || {};
  const base = profileComplete(p) ? calcTargets(p) : {};
  return Object.assign(base, p.targets || {});
}
