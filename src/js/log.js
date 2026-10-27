/* The daily log: day documents, totals, and every way an entry gets created or changed.
   A day: { date, entries: [entry], stackLogged }. An entry is a frozen copy of the food at
   log time plus a quantity, so editing a food later never rewrites history:
   { id, foodId, name, brand, restaurant, servingLabel, servingGrams, kind, qty (servings),
     amount: {v, unit} | null (what the user typed, for display), n (per serving), slot, t, mealId? } */
import { S } from './state.js';
import { commit } from './store.js';
import { NK, fullN } from './nutrients.js';
import { num, mkid, fmtQty, ymd } from './util.js';
import { materialize, saveFood, saveMeal, stackFoods } from './foods.js';
import { toast } from './ui.js';

export function getDay(key) { return S.days[key] || { date: key, entries: [] }; }
export function dayTotals(day) {
  const t = {}; NK.forEach(k => t[k] = 0);
  (day && day.entries || []).forEach(e => { const q = num(e.qty); NK.forEach(k => { t[k] += num(e.n && e.n[k]) * q; }); });
  return t;
}
export function mealTotals(meal) {
  const t = {}; NK.forEach(k => t[k] = 0);
  (meal.items || []).forEach(it => { const f = S.foods[it.foodId]; if (!f) return; NK.forEach(k => { t[k] += num(f.n && f.n[k]) * num(it.qty); }); });
  return t;
}

export function entryFrom(f, qty, slot, amount, extra) {
  return Object.assign({ id: mkid(), foodId: f.id, name: f.name, brand: f.brand || null, restaurant: f.restaurant || null, servingLabel: f.servingLabel || '', servingGrams: num(f.servingGrams) || null, kind: f.kind || 'food', qty: Number(qty) || 1, amount: amount || null, n: fullN(f.n), slot, t: Date.now() }, extra || {});
}
export function entryAmountText(e) {
  if (e.amount && num(e.amount.v) > 0) return fmtQty(e.amount.v) + ' ' + e.amount.unit + ' · ' + fmtQty(e.qty) + ' serving' + (Number(e.qty) === 1 ? '' : 's');
  return fmtQty(e.qty) + ' × ' + (e.servingLabel || 'serving');
}

export function logFood(food, qty, slot, dayKey, amount) {
  const f = materialize(food);
  const day = getDay(dayKey); day.date = dayKey;
  day.entries = (day.entries || []).concat([entryFrom(f, qty, slot, amount)]);
  S.days[dayKey] = day; commit('days', dayKey, day);
  f.count = (f.count || 0) + 1; f.last = Date.now(); saveFood(f);
}
export function logMeal(meal, mult, slot, dayKey) {
  const day = getDay(dayKey); day.date = dayKey; day.entries = day.entries || [];
  (meal.items || []).forEach(it => {
    const f = S.foods[it.foodId]; if (!f) return;
    day.entries.push(entryFrom(f, Number(it.qty) * mult, slot, null, { mealId: meal.id }));
    f.count = (f.count || 0) + 1; f.last = Date.now(); saveFood(f);
  });
  S.days[dayKey] = day; commit('days', dayKey, day);
  meal.count = (meal.count || 0) + 1; meal.last = Date.now(); saveMeal(meal);
}
/* Logs every supplement marked "in stack" that isn't already on the day, then marks the day's stack as logged. */
export function logStack(dayKey, auto) {
  const stack = stackFoods(); if (!stack.length) return false;
  const day = getDay(dayKey); day.date = dayKey; day.entries = day.entries || [];
  const have = new Set(day.entries.filter(e => e.slot === 'supplement').map(e => e.foodId));
  let added = 0;
  stack.forEach(f => { if (have.has(f.id)) return; day.entries.push(entryFrom(f, num(f.stackQty) || 1, 'supplement', null)); f.count = (f.count || 0) + 1; f.last = Date.now(); saveFood(f); added++; });
  day.stackLogged = true; S.days[dayKey] = day; commit('days', dayKey, day);
  toast(auto ? 'Logged your daily stack' : (added ? 'Stack logged' : 'Stack was already logged'));
  return true;
}
/* Called before rendering Today. Runs once per day, only for today, only after the store has answered. */
export function maybeAutoLogStack() {
  if (!S.profile || !S.profile.autoStack || S.mode === 'pending' || !S.daysLoaded) return;
  const today = ymd(new Date()); if (S.dayKey !== today || S.autoDone[today]) return;
  const day = getDay(today); if (day.stackLogged || !stackFoods().length) return;
  S.autoDone[today] = true; logStack(today, true);
}
export function updateEntry(dayKey, entryId, patch) {
  const day = getDay(dayKey); const e = (day.entries || []).find(x => x.id === entryId); if (!e) return;
  Object.assign(e, patch); S.days[dayKey] = day; commit('days', dayKey, day);
}
export function removeEntry(dayKey, entryId) {
  const day = getDay(dayKey); day.entries = (day.entries || []).filter(x => x.id !== entryId);
  if (!day.entries.some(e => e.slot === 'supplement')) day.stackLogged = false;
  S.days[dayKey] = day; commit('days', dayKey, day);
}
export function copyDay(fromKey, toKey) {
  const from = getDay(fromKey); const to = getDay(toKey); to.date = toKey;
  to.entries = (to.entries || []).concat((from.entries || []).map(e => Object.assign({}, e, { id: mkid(), t: Date.now() })));
  if ((from.entries || []).some(e => e.slot === 'supplement')) to.stackLogged = true;
  S.days[toKey] = to; commit('days', toKey, to);
}
