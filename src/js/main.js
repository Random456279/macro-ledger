/* Entry point: render loop, event routing, boot. Keep this file small; features live in their modules. */
import { S, hooks, APP_NAME } from './state.js';
import { $, $$, esc, ymd, niceDate, shortDate } from './util.js';
import { bootLocal, connectStore, connectApi, refreshFromApi, flushOutbox, flushPending } from './store.js';
import { isStandalone, loadKey } from './backend.js';
import { openKeySheet } from './sheet-misc.js';
import { ICON, topSheet, closeSheet } from './ui.js';
import { maybeAutoLogStack } from './log.js';
import { initAI, scanLabel } from './ai.js';
import { todayHtml } from './view-today.js';
import { foodsHtml, foodsListHtml } from './view-foods.js';
import { workoutHtml } from './view-workout.js';
import { meHtml, onboardingHtml, profileFormUpdate, profileGoalChanged } from './view-me.js';
import { setFormKind } from './sheet-food.js';
import { refreshOpenLists } from './sheet-add.js';
import { updateSet, flushWorkoutSaves } from './workouts.js';
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
  else if (S.tab === 'workout') main.innerHTML = workoutHtml();
  else if (S.tab === 'me') { main.innerHTML = meHtml(); profileFormUpdate(main); }
  else { S.tab = 'today'; main.innerHTML = todayHtml(); }
}
function renderHeader() {
  const h = $('#hdr');
  if (!S.profile) { h.innerHTML = '<div><div class="eyebrow">' + esc(APP_NAME) + '</div><h1>Welcome</h1></div>'; return; }
  const titles = { today: 'Today', foods: 'Foods', workout: 'Workout', me: 'Me' };
  const dated = S.tab === 'today' || S.tab === 'workout';
  const isToday = S.dayKey === ymd(new Date());
  let right = '';
  if (dated) {
    right = '<div class="datenav"><button class="iconbtn" data-act="day" data-n="-1" aria-label="Previous day">' + ICON.chevL + '</button>'
      + '<button class="link dlabel num ' + (isToday ? 'today' : '') + '" data-act="day-today">' + (isToday ? 'Today' : shortDate(S.dayKey)) + '</button>'
      + '<button class="iconbtn" data-act="day" data-n="1" aria-label="Next day">' + ICON.chevR + '</button></div>';
  }
  const eyebrow = dated && isToday ? niceDate(S.dayKey) : APP_NAME;
  const title = dated && !isToday ? niceDate(S.dayKey) : titles[S.tab] || 'Today';
  h.innerHTML = '<div><div class="eyebrow">' + esc(eyebrow) + '</div><h1>' + esc(title) + '</h1></div>' + right;
}
function renderTabs() {
  const t = $('#tabs');
  const b = (k, label, icon) => '<button data-act="tab" data-tab="' + k + '" class="' + (S.tab === k ? 'on' : '') + '">' + icon + label + '</button>';
  const addAct = S.tab === 'workout' ? 'w-add-exercise' : 'add';
  t.innerHTML = b('today', 'Today', ICON.today) + b('foods', 'Foods', ICON.foods)
    + '<button class="add" data-act="' + addAct + '" aria-label="' + (S.tab === 'workout' ? 'Add exercise' : 'Add food') + '"><span class="plus">' + ICON.plus + '</span>Add</button>'
    + b('workout', 'Workout', ICON.workout) + b('me', 'Me', ICON.me);
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
  const si = e.target.closest('input[data-w]');
  if (si) { const w = S.workouts[si.dataset.w]; if (w) updateSet(w, Number(si.dataset.ii), Number(si.dataset.si), si.dataset.f, si.value); return; }
  if (e.target.closest('#f-age,#f-hft,#f-hin,#f-wt,#f-bf,#f-act')) profileFormUpdate($('#main'));
});
window.addEventListener('pagehide', flushWorkoutSaves);
$('#main').addEventListener('change', e => { if (e.target.closest('#f-hft,#f-hin,#f-act')) profileFormUpdate($('#main')); });

(async function boot() {
  bootLocal();
  S.ready = true; render();
  if (isStandalone()) {
    /* own URL: the Worker API with a device key; local-only until a key is entered */
    if (loadKey()) {
      const r = await connectApi(); render();
      if (r === 'unauthorized') openKeySheet('That device key is no longer valid. Paste a current one.');
    } else { S.mode = 'local'; S.daysLoaded = true; flushPending(); render(); openKeySheet(); }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshFromApi(); });
    window.addEventListener('online', () => flushOutbox());
    return;
  }
  if (!(window.claude && typeof window.claude.use === 'function')) { S.mode = 'local'; S.pending = []; S.daysLoaded = true; render(); return; }
  let db = null, user = null, sample = null;
  try { [db, user, sample] = await Promise.all([claude.use('db'), claude.use('user'), claude.use('sample')]); } catch (e) { /* treat as absent */ }
  await initAI(sample);
  let uid = null; try { uid = user ? await user.id() : null; } catch (e) { uid = null; }
  connectStore(db, uid);
  render();
})();
