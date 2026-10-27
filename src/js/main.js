/* Entry point: render loop, event routing, boot. Keep this file small; features live in their modules. */
import { S, hooks } from './state.js';
import { $, $$, esc, ymd, niceDate, shortDate } from './util.js';
import { bootLocal, connectStore, persistLocal } from './store.js';
import { ICON, topSheet, closeSheet } from './ui.js';
import { maybeAutoLogStack } from './log.js';
import { initAI, scanLabel } from './ai.js';
import { todayHtml } from './view-today.js';
import { foodsHtml, foodsListHtml } from './view-foods.js';
import { mealsHtml } from './view-meals.js';
import { meHtml, onboardingHtml, profileFormUpdate, profileGoalChanged } from './view-me.js';
import { setFormKind } from './sheet-food.js';
import { refreshOpenLists } from './sheet-add.js';
import { ACT } from './actions.js';

export function render() {
  if (!S.ready) return;
  renderHeader();
  const main = $('#main'); const tabs = $('#tabs');
  if (!S.profile) {
    tabs.hidden = true;
    if ($('#onb-go', main)) return;   /* keep what they're typing */
    main.innerHTML = onboardingHtml(S.profileDraft || {}); profileFormUpdate(main); return;
  }
  tabs.hidden = false; renderTabs();
  if (S.tab === 'today') { maybeAutoLogStack(); main.innerHTML = todayHtml(); }
  else if (S.tab === 'foods') main.innerHTML = foodsHtml();
  else if (S.tab === 'meals') main.innerHTML = mealsHtml();
  else if (S.tab === 'me') { main.innerHTML = meHtml(); profileFormUpdate(main); }
}
function renderHeader() {
  const h = $('#hdr');
  if (!S.profile) { h.innerHTML = '<div><div class="eyebrow">Macro Ledger</div><h1>Set up</h1></div>'; return; }
  const titles = { today: 'Today', foods: 'My Foods', meals: 'Meals', me: 'Me' };
  let right = '';
  if (S.tab === 'today') {
    const isToday = S.dayKey === ymd(new Date());
    right = '<div class="datenav"><button class="iconbtn" data-act="day" data-n="-1" aria-label="Previous day">' + ICON.chevL + '</button>'
      + '<button class="link dlabel num ' + (isToday ? 'today' : '') + '" data-act="day-today">' + (isToday ? 'Today' : shortDate(S.dayKey)) + '</button>'
      + '<button class="iconbtn" data-act="day" data-n="1" aria-label="Next day">' + ICON.chevR + '</button></div>';
  }
  const title = S.tab === 'today' && S.dayKey !== ymd(new Date()) ? niceDate(S.dayKey) : titles[S.tab];
  h.innerHTML = '<div><div class="eyebrow">Macro Ledger</div><h1>' + esc(title) + '</h1></div>' + right;
}
function renderTabs() {
  const t = $('#tabs');
  const b = (k, label, icon) => '<button data-act="tab" data-tab="' + k + '" class="' + (S.tab === k ? 'on' : '') + '">' + icon + label + '</button>';
  t.innerHTML = b('today', 'Today', ICON.today) + b('foods', 'Foods', ICON.foods)
    + '<button class="add" data-act="add" aria-label="Add food"><span class="plus">' + ICON.plus + '</span>Add</button>'
    + b('meals', 'Meals', ICON.meals) + b('me', 'Me', ICON.me);
}

hooks.render = render;
hooks.refreshOpenLists = refreshOpenLists;

/* One delegated click handler: segmented controls first (pure UI), then the action registry. */
document.addEventListener('click', e => {
  const seg = e.target.closest('.seg button');
  if (seg) {
    $$('button', seg.parentElement).forEach(x => x.classList.toggle('on', x === seg));
    const segId = seg.parentElement.id; const main = seg.closest('#main');
    if (main) { if (segId === 'f-goal') profileGoalChanged(main); profileFormUpdate(main); }
    else if (segId === 'unitSeg') { const el = topSheet(); if (el && el._setUnit) el._setUnit(seg.dataset.u); }
    else if (segId === 'ff-kind') { const el = topSheet(); if (el) setFormKind(el, seg.dataset.v); }
    return;
  }
  const b = e.target.closest('[data-act]'); if (!b) return;
  const fn = ACT[b.dataset.act]; if (!fn) return;
  e.preventDefault(); fn(b, e);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.sheets.length) closeSheet(); });
$('#photoInput').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) scanLabel(f); });
$('#main').addEventListener('input', e => {
  if (e.target.id === 'foodsSearch') { S.foodsQuery = e.target.value; const list = $('#foodsList'); if (list) list.innerHTML = foodsListHtml(); return; }
  if (e.target.closest('#f-age,#f-hft,#f-hin,#f-wt,#f-bf,#f-act')) profileFormUpdate($('#main'));
});
$('#main').addEventListener('change', e => { if (e.target.closest('#f-hft,#f-hin,#f-act')) profileFormUpdate($('#main')); });

(async function boot() {
  bootLocal();
  S.ready = true; render();
  if (!(window.claude && typeof window.claude.use === 'function')) { S.mode = 'local'; S.pending = []; S.daysLoaded = true; render(); return; }
  let db = null, user = null, sample = null;
  try { [db, user, sample] = await Promise.all([claude.use('db'), claude.use('user'), claude.use('sample')]); } catch (e) { /* treat as absent */ }
  await initAI(sample);
  let uid = null; try { uid = user ? await user.id() : null; } catch (e) { uid = null; }
  connectStore(db, uid);
  render();
})();
