/* The action registry. Every tappable element carries data-act="<name>" (plus data-* args);
   main.js routes clicks here. A new feature adds its handlers to this map (or exports its own
   map that main.js merges), never its own click listeners on document. */
import { S, SLOT_LABEL, slotNow, hooks } from './state.js';
import { $, $$, num, numOrNull, mkid, ymd, addDays, parseYmd, shortDate } from './util.js';
import { NUTR } from './nutrients.js';
import { calcTargets, profileComplete, activeTargets } from './targets.js';
import { commit, persistLocal, loadDay, LS } from './store.js';
import { lookupFood, materialize, saveFood, deleteFood, saveMeal, deleteMeal } from './foods.js';
import { getDay, logFood, logMeal, logStack, updateEntry, removeEntry, copyDay } from './log.js';
import { toast, openSheet, closeSheet, closeAllSheets, topSheet, topSheetNamed, sheetFrame } from './ui.js';
import { openAdd, renderAddList } from './sheet-add.js';
import { openQty, addFromQty, openEntry } from './sheet-qty.js';
import { openFoodForm, readFoodForm, extraRowHtml } from './sheet-food.js';
import { openMealBuilder, openMeal } from './sheet-meal.js';
import { openTargetsEditor, openConfirm } from './sheet-misc.js';
import { openDescribe, submitDescribe } from './ai.js';
import { readProfileForm } from './view-me.js';

const render = () => hooks.render();

export const ACT = {
  /* navigation */
  tab(b) { S.tab = b.dataset.tab; if (S.tab === 'today') S.dayKey = ymd(new Date()); persistLocal(); render(); $('#main').scrollTop = 0; },
  day(b) { S.dayKey = ymd(addDays(parseYmd(S.dayKey), Number(b.dataset.n))); loadDay(S.dayKey); render(); },
  'day-today'() { S.dayKey = ymd(new Date()); render(); },
  'toggle-full'() { S.fullOpen = !S.fullOpen; render(); },
  'copy-yesterday'() { copyDay(ymd(addDays(parseYmd(S.dayKey), -1)), S.dayKey); render(); toast('Copied yesterday'); },
  close() { closeSheet(); },
  'confirm-yes'() { const el = topSheet(); const f = el._onYes; closeSheet(); f && f(); },

  /* adding and editing entries */
  add(b) { openAdd(b.dataset.slot); },
  'add-filter'(b) { S.addFilter = b.dataset.f; renderAddList(); },
  pick(b) { const f = lookupFood(b.dataset.id); if (f) openQty(f); },
  'pick-meal'(b) { S.addSlot = S.addSlot || slotNow(); openMeal(b.dataset.id); },
  'q-step'(b) { const el = topSheet(); el._step && el._step(Number(b.dataset.d)); },
  'q-set'(b) { const el = topSheet(); $('#qtyInput', el).value = b.dataset.v; el._paint && el._paint(); },
  'q-add'() { addFromQty(false); },
  'q-add-more'() { addFromQty(true); },
  entry(b) { openEntry(b.dataset.id); },
  'entry-save'() { const el = topSheet(); const qty = el._servings(); if (!(qty > 0)) { toast('Enter an amount'); return; } const slot = ($('#qtySlot .on', el) || { dataset: { v: el._entry.slot } }).dataset.v; updateEntry(el._dayKey, el._entry.id, { qty, amount: el._amount(), slot }); closeSheet(); render(); },
  'entry-delete'() { const el = topSheet(); removeEntry(el._dayKey, el._entry.id); closeSheet(); render(); toast('Removed'); },
  'log-stack'() { logStack(S.dayKey, false); render(); },
  'log-stack-close'() { logStack(S.dayKey, false); closeAllSheets(); S.tab = 'today'; render(); },

  /* foods */
  fav(b) { const f = lookupFood(b.dataset.id); if (!f) return; const m = materialize(f); m.fav = !m.fav; saveFood(m); render(); hooks.refreshOpenLists(); },
  'rate-food'(b) { const f = S.foods[b.dataset.id]; if (!f) return; f.rating = Number(b.dataset.star); saveFood(f); $$('[data-act="rate-food"]', b.parentElement).forEach(x => x.classList.toggle('on', Number(x.dataset.star) <= f.rating)); },
  'rate-form'(b) { const el = topSheet(); el._rating = Number(b.dataset.star); $$('[data-act="rate-form"]', b.parentElement).forEach(x => x.classList.toggle('on', Number(x.dataset.star) <= el._rating)); },
  'foods-sort'(b) { S.foodsSort = b.dataset.sort; render(); },
  'foods-supp'() { S.tab = 'foods'; S.foodsSort = 'supp'; S.foodsQuery = ''; render(); $('#main').scrollTop = 0; },
  'food-open'(b) { const f = S.foods[b.dataset.id]; if (f) openFoodForm(f); },
  'new-manual'() { openFoodForm(null); },
  'ff-more'(b) { const el = topSheet(); const ext = $('#ff-ext', el); ext.hidden = !ext.hidden; b.textContent = ext.hidden ? 'More vitamins and minerals ▾' : 'Fewer nutrients ▴'; },
  'ff-extra-add'() { const el = topSheet(); const box = $('#ff-extras', el); box.insertAdjacentHTML('beforeend', extraRowHtml({ name: '', v: null, unit: 'mg' }, box.children.length)); const last = box.lastElementChild; if (last) $('.x-name', last).focus(); },
  'ff-extra-remove'(b) { const row = b.closest('.xrow'); if (row) row.remove(); },
  'ff-save'() { const el = topSheet(); const f = readFoodForm(el); if (!f.name) { toast('Give it a name'); return; } saveFood(f); closeSheet(); render(); hooks.refreshOpenLists(); toast('Saved'); },
  'ff-save-add'() { const el = topSheet(); const f = readFoodForm(el); if (!f.name) { toast('Give it a name'); return; } saveFood(f); const q = el._addQty || 1; closeSheet(); openQty(f, { qty: q, title: 'Add ' + f.name }); },
  'food-delete'(b) { const id = b.dataset.id; openConfirm('Delete this food?', 'It stays in any days already logged.', 'Delete', () => { deleteFood(id); closeAllSheets(); render(); toast('Deleted'); }); },

  /* AI entry points */
  scan() {
    if (!S.ai.sample) { toast('Scanning needs Claude; opening manual entry'); openFoodForm(null); return; }
    if (!S.ai.images) { toast('Photos aren\'t available in this view; describe it instead'); openDescribe(); return; }
    $('#photoInput').click();
  },
  describe() { openDescribe(); },
  'd-go'() { submitDescribe(topSheet()); },

  /* meals */
  'save-meal'(b) {
    const day = getDay(S.dayKey); const es = (day.entries || []).filter(e => e.slot === b.dataset.slot); if (!es.length) return;
    const items = []; es.forEach(e => { if (!S.foods[e.foodId]) return; const ex = items.find(i => i.foodId === e.foodId); if (ex) ex.qty += num(e.qty); else items.push({ foodId: e.foodId, qty: num(e.qty) }); });
    if (!items.length) { toast('These entries aren\'t linked to saved foods'); return; }
    openMealBuilder({ id: null, name: SLOT_LABEL[b.dataset.slot] + ' ' + shortDate(S.dayKey), items });
  },
  'meal-new'() { openMealBuilder(null); },
  'meal-open'(b) { S.addSlot = slotNow(); openMeal(b.dataset.id); },
  'meal-edit'(b) { const m = S.meals[b.dataset.id]; closeSheet(); if (m) openMealBuilder(m); },
  'meal-fav'(b) { const m = S.meals[b.dataset.id]; if (!m) return; m.fav = !m.fav; saveMeal(m); render(); },
  'rate-meal'(b) { const m = S.meals[b.dataset.id]; if (!m) return; m.rating = Number(b.dataset.star); saveMeal(m); $$('[data-act="rate-meal"]', b.parentElement).forEach(x => x.classList.toggle('on', Number(x.dataset.star) <= m.rating)); },
  'meal-log'() { const el = topSheet(); const m = S.meals[el._mealId]; if (!m) return; const mult = Number(($('#qtySlot2 .on', el) || { dataset: { v: 1 } }).dataset.v) || 1; const slot = ($('#qtySlot .on', el) || { dataset: { v: slotNow() } }).dataset.v; logMeal(m, mult, slot, el._dayKey); closeAllSheets(); S.tab = 'today'; S.dayKey = el._dayKey; render(); toast('Logged ' + m.name); },
  'meal-delete'(b) { const id = b.dataset.id; openConfirm('Delete this meal?', 'Logged days keep their entries.', 'Delete', () => { deleteMeal(id); closeAllSheets(); render(); toast('Deleted'); }); },
  'm-add'(b) { const el = topSheetNamed('mealb'); const f = materialize(lookupFood(b.dataset.id)); if (!f) return; const ex = el._meal.items.find(i => i.foodId === f.id); if (ex) ex.qty += 1; else el._meal.items.push({ foodId: f.id, qty: 1 }); $('#m-search', el).value = ''; $('#m-results', el).innerHTML = ''; el._paintItems(); },
  'm-remove'(b) { const el = topSheetNamed('mealb'); el._meal.items.splice(Number(b.dataset.i), 1); el._paintItems(); },
  'm-save'() { const el = topSheetNamed('mealb'); const m = el._meal; m.name = $('#m-name', el).value.trim(); if (!m.name) { toast('Name the meal'); return; } if (!m.items.length) { toast('Add at least one food'); return; } if (!m.id) { m.id = mkid(); m.created = Date.now(); m.count = 0; } saveMeal(m); closeAllSheets(); render(); toast('Meal saved'); },

  /* profile, targets, settings */
  'onb-save'() { const p = readProfileForm($('#main'), S.profileDraft || {}); if (!profileComplete(p)) return; p.targets = calcTargets(p); p.custom = false; p.created = Date.now(); S.profile = p; S.profileDraft = null; commit('profile', null, p); S.tab = 'today'; render(); toast('Targets set'); },
  'me-save'() { const p = readProfileForm($('#main'), S.profile); if (!profileComplete(p)) { toast('Age, height and weight are needed'); return; } p.targets = calcTargets(p); p.custom = false; S.profile = p; commit('profile', null, p); render(); toast('Recalculated'); },
  'edit-targets'() { openTargetsEditor(); },
  't-save'() { const el = topSheet(); const T = Object.assign({}, activeTargets()); NUTR.forEach(m => { if (m.noTarget) return; const v = numOrNull($('#t-' + m.k, el).value); if (v !== null) T[m.k] = v; }); S.profile.targets = T; S.profile.custom = true; commit('profile', null, S.profile); closeSheet(); render(); toast('Targets updated'); },
  'toggle-careful'() { S.profile.careful = !S.profile.careful; commit('profile', null, S.profile); render(); },
  'toggle-autostack'() { S.profile.autoStack = !S.profile.autoStack; commit('profile', null, S.profile); render(); },
  export() {
    const data = JSON.stringify({ exported: new Date().toISOString(), profile: S.profile, foods: S.foods, meals: S.meals, days: S.days });
    const done = () => toast('Backup copied to clipboard');
    const fallback = () => { const el = openSheet(sheetFrame('Backup', '<p class="small muted">Copy this text and keep it somewhere safe.</p><textarea id="bk" style="width:100%;min-height:220px;font-family:var(--mono);font-size:11px;border:1px solid var(--line);border-radius:8px;padding:8px"></textarea>'), { name: 'backup' }); const ta = $('#bk', el); ta.value = data; ta.focus(); ta.select(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(data).then(done).catch(fallback); else fallback();
  },
  reset() { openConfirm('Reset everything?', 'This deletes your profile, foods, meals and every logged day from this app. There is no undo.', 'Delete it all', doReset); },
};

export function doReset() {
  const foods = Object.keys(S.foods), meals = Object.keys(S.meals), days = Object.keys(S.days);
  foods.forEach(id => commit('foods', id, null)); meals.forEach(id => commit('meals', id, null)); days.forEach(k => commit('days', k, null)); commit('profile', null, null);
  S.profile = null; S.foods = {}; S.meals = {}; S.days = {}; S.profileDraft = null; S.migrated = true; S.localBoot = null;
  LS.clear(); S.tab = 'today'; closeAllSheets(); render(); toast('Reset');
}
