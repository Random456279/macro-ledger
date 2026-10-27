/* The Add sheet: search, filter chips (favorites, recent, mine, basics, meals, supplements),
   and the Scan / Describe / Manual entry points. Row taps are handled in actions.js. */
import { $, esc, fmt } from './util.js';
import { S, SLOT_LABEL, slotNow } from './state.js';
import { BASICS } from './basics.js';
import { allFoodsList, sortedFoods, matches, stackFoods } from './foods.js';
import { getDay, mealTotals } from './log.js';
import { openSheet, sheetFrame, topSheetNamed, ICON } from './ui.js';
import { foodRow } from './view-foods.js';

export function openAdd(slot) {
  S.addSlot = slot || slotNow(); S.addQuery = '';
  if (S.addSlot === 'supplement') S.addFilter = 'supplements'; else if (S.addFilter === 'supplements') S.addFilter = 'favorites';
  const body = '<input class="search" id="addSearch" type="search" placeholder="Search foods and basics" autocomplete="off">'
    + '<div class="chips scroll" id="addChips"></div>'
    + '<div class="grid3"><button class="btn sm" data-act="scan">' + ICON.camera + ' Scan</button><button class="btn sm" data-act="describe">' + ICON.pen + ' Describe</button><button class="btn sm" data-act="new-manual">' + ICON.type + ' Manual</button></div>'
    + '<div class="list" id="addList"></div>';
  const el = openSheet(sheetFrame('Add to ' + SLOT_LABEL[S.addSlot], body), { name: 'add' });
  $('#addSearch', el).addEventListener('input', e => { S.addQuery = e.target.value; renderAddList(); });
  renderAddList();
}

export function mealRow(m) {
  const t = mealTotals(m);
  return '<div class="row"><span class="star ' + (m.fav ? 'on' : '') + '" aria-hidden="true">◆</span><button class="main" style="background:none;border:0;padding:0;text-align:left" data-act="pick-meal" data-id="' + esc(m.id) + '"><div class="title">' + esc(m.name) + '</div><div class="sub">Meal · ' + (m.items || []).length + ' items · P ' + fmt(t.protein) + ' C ' + fmt(t.carbs) + ' F ' + fmt(t.fat) + '</div></button><div class="kcal num">' + fmt(t.kcal) + '<small>cal</small></div></div>';
}

export function renderAddList() {
  const el = topSheetNamed('add'); if (!el) return;
  const q = S.addQuery.trim();
  const chips = [['favorites', 'Favorites'], ['recent', 'Recent'], ['mine', 'My foods'], ['basics', 'Basics'], ['meals', 'Meals'], ['supplements', 'Supplements']];
  $('#addChips', el).innerHTML = chips.map(([k, l]) => '<button class="chip ' + (S.addFilter === k ? 'on' : '') + '" data-act="add-filter" data-f="' + k + '">' + l + '</button>').join('');
  const mine = allFoodsList();
  let rows = '';
  if (q) {
    const copies = new Set(mine.map(f => f.basicKey).filter(Boolean));
    const list = sortedFoods(mine.filter(f => matches(f, q)), 'count').concat(BASICS.filter(b => !copies.has(b.basicKey) && matches(b, q)));
    rows = list.length ? list.map(f => foodRow(f, 'pick')).join('') : '<div class="empty">No matches. Scan it, describe it, or enter it manually.</div>';
    const ml = Object.values(S.meals).filter(m => matches({ name: m.name }, q));
    if (ml.length) rows += ml.map(m => mealRow(m)).join('');
  } else if (S.addFilter === 'meals') {
    const ml = Object.values(S.meals).sort((a, b) => ((b.fav ? 1 : 0) - (a.fav ? 1 : 0)) || ((b.count || 0) - (a.count || 0)));
    rows = ml.length ? ml.map(m => mealRow(m)).join('') : '<div class="empty">No meals yet. Log a few foods, then tap "Save meal" on that slot.</div>';
  } else if (S.addFilter === 'basics') {
    const copies = {}; mine.forEach(f => { if (f.basicKey) copies[f.basicKey] = f; });
    rows = BASICS.map(b => foodRow(copies[b.basicKey] || b, 'pick')).join('');
  } else if (S.addFilter === 'supplements') {
    const list = mine.filter(f => f.kind === 'supplement').sort((a, b) => ((b.inStack ? 1 : 0) - (a.inStack ? 1 : 0)) || String(a.name).localeCompare(String(b.name)));
    const stack = stackFoods();
    rows = (stack.length && !getDay(S.dayKey).stackLogged ? '<button class="btn block" data-act="log-stack-close" style="margin:4px 0 10px">Log my daily stack (' + stack.length + ')</button>' : '')
      + (list.length ? list.map(f => foodRow(f, 'pick')).join('') : '<div class="empty">No supplements yet. Tap Scan with a Supplement Facts panel in view.</div>');
  } else {
    let list = mine;
    if (S.addFilter === 'favorites') list = sortedFoods(list.filter(f => f.fav), 'fav');
    else if (S.addFilter === 'recent') list = sortedFoods(list.filter(f => f.last), 'recent').slice(0, 40);
    else list = sortedFoods(list, 'count');
    rows = list.length ? list.map(f => foodRow(f, 'pick')).join('') : '<div class="empty">' + (S.addFilter === 'favorites' ? 'Star a food to keep it here.' : S.addFilter === 'recent' ? 'Foods you log show up here, newest first.' : 'Nothing saved yet. Try Basics, or scan a label.') + '</div>';
  }
  $('#addList', el).innerHTML = rows;
}

/* Re-render the Add sheet's list if it is open (after a save or a store update). */
export function refreshOpenLists() { if (topSheetNamed('add')) renderAddList(); }
