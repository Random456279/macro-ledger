/* Meal sheets: the builder (new or edit) and the "Log meal" sheet. A meal: { id, name, items: [{foodId, qty}], fav, rating, count, last } */
import { $, $$, esc, fmt, fmtQty, num } from './util.js';
import { S, MEAL_SLOTS, slotNow } from './state.js';
import { scaled } from './nutrients.js';
import { BASICS } from './basics.js';
import { allFoodsList, sortedFoods, matches, foodSub } from './foods.js';
import { mealTotals } from './log.js';
import { openSheet, sheetFrame, starsHtml, ICON } from './ui.js';

export function openMealBuilder(meal) {
  const m = meal || { id: null, name: '', items: [] };
  const el = openSheet(sheetFrame(m.id ? 'Edit meal' : 'New meal',
    '<div class="field"><label>Name</label><input id="m-name" type="text" value="' + esc(m.name) + '" placeholder="Usual breakfast"></div>'
    + '<div class="field"><label>Add a food</label><input class="search" id="m-search" type="search" placeholder="Search my foods and basics" autocomplete="off"><div class="list" id="m-results"></div></div>'
    + '<div><div class="sec-h"><h2 style="font-size:15px">Items</h2><span class="meta" id="m-tot"></span></div><div class="list" id="m-items"></div></div>'
    + (m.id ? '<div class="btnrow"><button class="btn danger" data-act="meal-delete" data-id="' + esc(m.id) + '">Delete meal</button></div>' : ''),
    '<button class="btn primary" data-act="m-save">' + (m.id ? 'Save changes' : 'Save meal') + '</button>'), { name: 'mealb' });
  el._meal = { id: m.id, name: m.name, items: (m.items || []).map(i => Object.assign({}, i)), fav: m.fav, rating: m.rating, count: m.count, last: m.last };
  const totals = () => { const t = mealTotals(el._meal); $('#m-tot', el).textContent = fmt(t.kcal) + ' cal · P ' + fmt(t.protein) + ' C ' + fmt(t.carbs) + ' F ' + fmt(t.fat); };
  const paintItems = () => {
    const items = el._meal.items;
    $('#m-items', el).innerHTML = items.length ? items.map((it, i) => { const f = S.foods[it.foodId]; if (!f) return ''; return '<div class="row"><div class="main"><div class="title">' + esc(f.name) + '</div><div class="sub">' + esc(f.servingLabel || '') + '</div></div><input class="num" type="number" inputmode="decimal" step="0.25" min="0.1" value="' + fmtQty(it.qty) + '" data-mi="' + i + '" style="width:64px;border:1px solid var(--line);border-radius:6px;padding:6px;text-align:center" aria-label="Servings"><button class="closex" data-act="m-remove" data-i="' + i + '" aria-label="Remove">' + ICON.x + '</button></div>'; }).join('') : '<div class="empty">No items yet. Search above to add.</div>';
    totals();
  };
  el._paintItems = paintItems; paintItems();
  $('#m-search', el).addEventListener('input', e => {
    const q = e.target.value.trim(); const res = $('#m-results', el); if (!q) { res.innerHTML = ''; return; }
    const copies = new Set(allFoodsList().map(f => f.basicKey).filter(Boolean));
    const list = sortedFoods(allFoodsList().filter(f => matches(f, q)), 'count').concat(BASICS.filter(b => !copies.has(b.basicKey) && matches(b, q))).slice(0, 8);
    res.innerHTML = list.map(f => '<button class="row" data-act="m-add" data-id="' + esc(f.id) + '"><div class="main"><div class="title">' + esc(f.name) + '</div><div class="sub">' + esc(foodSub(f)) + '</div></div><div class="kcal num">' + fmt(f.n.kcal) + '<small>cal</small></div></button>').join('') || '<div class="empty">No matches.</div>';
  });
  el.addEventListener('input', e => { const inp = e.target.closest('input[data-mi]'); if (!inp) return; el._meal.items[Number(inp.dataset.mi)].qty = num(inp.value) || 1; totals(); });
}

export function openMeal(mealId) {
  const m = S.meals[mealId]; if (!m) return; const t = mealTotals(m);
  const slot0 = MEAL_SLOTS.some(x => x.k === S.addSlot) ? S.addSlot : slotNow();
  const body = '<div><div style="font-weight:800;font-size:18px">' + esc(m.name) + '</div><div class="small muted num">' + fmt(t.kcal) + ' cal · P ' + fmt(t.protein) + ' C ' + fmt(t.carbs) + ' F ' + fmt(t.fat) + '</div></div>'
    + '<div class="list">' + (m.items || []).map(it => { const f = S.foods[it.foodId]; if (!f) return ''; const n = scaled(f.n, num(it.qty)); return '<div class="row"><div class="main"><div class="title">' + esc(f.name) + '</div><div class="sub num">' + esc(fmtQty(it.qty) + ' × ' + (f.servingLabel || 'serving')) + '</div></div><div class="kcal num">' + fmt(n.kcal) + '</div></div>'; }).join('') + '</div>'
    + '<div class="field"><label>Portion</label><div class="seg" id="qtySlot2"><button type="button" data-v="0.5">Half</button><button type="button" data-v="1" class="on">Whole</button><button type="button" data-v="1.5">1.5×</button><button type="button" data-v="2">2×</button></div></div>'
    + '<div class="field"><label>Meal slot</label><div class="seg" id="qtySlot">' + MEAL_SLOTS.map(s => '<button type="button" data-v="' + s.k + '" class="' + (s.k === slot0 ? 'on' : '') + '">' + s.label.replace('Snacks', 'Snack') + '</button>').join('') + '</div></div>'
    + '<div class="field"><label>Rating</label>' + starsHtml(m.rating, 'rate-meal', 'data-id="' + esc(m.id) + '"') + '</div>'
    + '<div class="btnrow"><button class="btn ghost" data-act="meal-edit" data-id="' + esc(m.id) + '">Edit meal</button></div>';
  const el = openSheet(sheetFrame('Log meal', body, '<button class="btn primary" data-act="meal-log">Log it</button>'), { name: 'meal' });
  el._mealId = m.id; el._dayKey = S.dayKey;
}
