/* My Foods and Meals: lookup, search, sorting, save and delete. A food record:
   { id, name, brand, restaurant, servingLabel, servingGrams, n (per serving), kind: 'food'|'supplement',
     inStack, stackQty, fav, rating, count, last, source, confidence, notes, basicKey } */
import { S } from './state.js';
import { commit } from './store.js';
import { BASICS } from './basics.js';
import { fmtQty, mkid, num } from './util.js';

export function allFoodsList() { return Object.values(S.foods); }
export function lookupFood(id) { return S.foods[id] || BASICS.find(b => b.id === id) || null; }
export function findBasicCopy(key) { return allFoodsList().find(f => f.basicKey === key); }

/* A Basics template becomes a real food in My Foods the first time it is used. */
export function materialize(food) {
  if (!food) return food;
  if (!String(food.id).startsWith('basic:')) return food;
  const existing = findBasicCopy(food.basicKey); if (existing) return existing;
  const copy = Object.assign({}, food, { id: mkid(), source: 'basic', created: Date.now(), count: 0, fav: false, rating: 0 });
  S.foods[copy.id] = copy; commit('foods', copy.id, copy); return copy;
}

export function foodSub(f) {
  const parts = [];
  if (f.restaurant) parts.push('at ' + f.restaurant); else if (f.brand) parts.push(f.brand);
  if (f.servingLabel) parts.push(f.servingLabel);
  if (f.kind === 'supplement') parts.push(f.inStack ? 'stack · ' + fmtQty(f.stackQty || 1) + '/day' : 'supplement');
  return parts.join(' · ');
}
export function stackFoods() {
  return allFoodsList().filter(f => f.kind === 'supplement' && f.inStack && num(f.stackQty) > 0).sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export function saveFood(f) { f.updated = Date.now(); S.foods[f.id] = f; commit('foods', f.id, f); }
export function deleteFood(id) { delete S.foods[id]; commit('foods', id, null); }
export function saveMeal(m) { m.updated = Date.now(); S.meals[m.id] = m; commit('meals', m.id, m); }
export function deleteMeal(id) { delete S.meals[id]; commit('meals', id, null); }

export function sortedFoods(list, sort) {
  const arr = list.slice();
  if (sort === 'az') arr.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  else if (sort === 'recent') arr.sort((a, b) => (b.last || 0) - (a.last || 0));
  else if (sort === 'fav') arr.sort((a, b) => ((b.fav ? 1 : 0) - (a.fav ? 1 : 0)) || ((b.rating || 0) - (a.rating || 0)) || ((b.count || 0) - (a.count || 0)));
  else arr.sort((a, b) => ((b.count || 0) - (a.count || 0)) || String(a.name).localeCompare(String(b.name)));
  return arr;
}
export function matches(f, q) {
  if (!q) return true;
  const s = (f.name + ' ' + (f.brand || '') + ' ' + (f.restaurant || '')).toLowerCase();
  return q.toLowerCase().split(/\s+/).every(w => s.includes(w));
}
