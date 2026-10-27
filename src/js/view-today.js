/* The Today tab: the Remaining panel (Nutrition Facts styling), the full label, the meal slots
   and the Supplements row. Pure HTML builders; state changes happen in actions.js. */
import { S, MEAL_SLOTS } from './state.js';
import { esc, fmt, fmtQty, num, ymd, addDays, parseYmd, clamp } from './util.js';
import { NUTR, NMETA, SHORT, scaled } from './nutrients.js';
import { activeTargets } from './targets.js';
import { getDay, dayTotals, dayExtras, entryAmountText } from './log.js';
import { stackFoods } from './foods.js';

export function goalWord() {
  const p = S.profile; if (!p) return '';
  if (p.goal === 'lose') return 'Cut · ' + fmtQty(p.rate || 1) + ' lb/wk';
  if (p.goal === 'gain') return 'Gain · ' + fmtQty(p.rate || 0.5) + ' lb/wk';
  return 'Maintain';
}

const PLUS = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
const DOTS = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';

export function todayHtml() {
  const key = S.dayKey; const day = getDay(key); const T = activeTargets(); const tot = dayTotals(day);
  const remain = T.kcal - tot.kcal; const over = remain < 0;
  const kpct = T.kcal ? clamp(tot.kcal / T.kcal * 100, 0, 100) : 0;
  const macro = (k, label) => {
    const target = T[k] || 0, eaten = tot[k], left = target - eaten, pct = target ? clamp(eaten / target * 100, 0, 100) : 0;
    return '<div class="macro"><span class="label">' + label + '</span><div class="val num">' + fmt(Math.abs(left)) + '<small>g ' + (left < 0 ? 'over' : 'left') + '</small></div>'
      + '<div class="bar ' + (left < 0 ? 'over' : '') + '"><i style="width:' + pct.toFixed(1) + '%"></i></div><div class="of num">' + fmt(eaten) + ' of ' + fmt(target) + '</div></div>';
  };
  const count = (day.entries || []).length;
  let h = '<section class="hero"><div class="kcal-word">' + (over ? 'Calories over' : 'Calories left') + '</div>'
    + '<div class="kcal-big num ' + (over ? 'over' : '') + '">' + fmt(Math.abs(remain)) + '</div>'
    + '<div class="kcal-meta num"><b>' + fmt(tot.kcal) + ' eaten</b> of ' + fmt(T.kcal) + '</div>'
    + '<div class="bar ' + (over ? 'over' : '') + '"><i style="width:' + kpct.toFixed(1) + '%"></i></div>'
    + '<div class="macros">' + macro('protein', 'Protein') + macro('carbs', 'Carbs') + macro('fat', 'Fat') + '</div>'
    + '<div class="hero-foot"><span class="goal">' + esc(goalWord()) + (count ? ' · ' + count + ' item' + (count === 1 ? '' : 's') : '') + '</span><button class="link" data-act="toggle-full">Details</button></div>'
    + '</section>';

  const yKey = ymd(addDays(parseYmd(key), -1)); const y = S.days[yKey];
  if (!count && y && (y.entries || []).length) {
    h += '<div class="note" style="display:flex;justify-content:space-between;align-items:center;gap:10px"><span>Nothing logged yet.</span><button class="btn sm" data-act="copy-yesterday">Copy yesterday</button></div>';
  }
  const slotHeader = (s, kc, extraActs) => '<div class="slot-h"><h2>' + s.label + (kc ? '<span class="kc num">' + fmt(kc) + ' cal</span>' : '') + '</h2><div class="acts">' + (extraActs || '') + '<button class="iconbtn" data-act="add" data-slot="' + s.k + '" aria-label="Add to ' + s.label + '">' + PLUS + '</button></div></div>';
  MEAL_SLOTS.forEach(s => {
    const es = (day.entries || []).filter(e => e.slot === s.k);
    const kc = es.reduce((a, e) => a + num(e.n && e.n.kcal) * num(e.qty), 0);
    h += '<section class="slot">' + slotHeader(s, kc, es.length ? '<button class="iconbtn" data-act="slot-more" data-slot="' + s.k + '" aria-label="More for ' + s.label + '">' + DOTS + '</button>' : '');
    if (!es.length) h += '<div class="none quiet">Nothing yet</div>';
    else { h += '<div class="slot-body">'; es.forEach(e => { h += entryRowHtml(e); }); h += '</div>'; }
    h += '</section>';
  });
  const stack = stackFoods(); const se = (day.entries || []).filter(e => e.slot === 'supplement');
  if (stack.length || se.length) {
    const kc = se.reduce((a, e) => a + num(e.n && e.n.kcal) * num(e.qty), 0);
    const canLog = stack.length && !day.stackLogged;
    h += '<section class="slot">' + slotHeader({ k: 'supplement', label: 'Supplements' }, kc, canLog ? '<button class="btn sm pill" data-act="log-stack">Log stack · ' + stack.length + '</button>' : '');
    if (!se.length) h += '<div class="none quiet">' + (stack.length ? 'Stack not logged yet' : 'Nothing yet') + '</div>';
    else { h += '<div class="slot-body">'; se.forEach(e => { h += entryRowHtml(e); }); h += '</div>'; }
    h += '</section>';
  }
  return h;
}

/* The Details sheet body: the day's full nutrient breakdown. */
export function detailsHtml() {
  const day = getDay(S.dayKey); const T = activeTargets(); const tot = dayTotals(day);
  return fullLabelHtml(tot, T, dayExtras(day));
}

export function fullLabelHtml(tot, T, extras) {
  let h = '<div class="nf-full"><div class="nf-cols" style="padding-top:0"><span>Eaten today</span><span>% of target</span></div>';
  let extStarted = false;
  NUTR.forEach(m => {
    if (m.ext && !extStarted) { extStarted = true; h += '<div class="nf-cols"><span>Also tracked</span><span>% of target</span></div>'; }
    const eaten = tot[m.k]; const target = T[m.k];
    let pct = '';
    if (m.noTarget || !target) pct = '<span class="pct lim">–</span>';
    else { const p = Math.round(eaten / target * 100); pct = '<span class="pct num ' + (p > 100 ? 'over' : '') + '">' + p + '%</span>'; }
    const tgt = (m.noTarget || !target) ? '' : ' <span class="muted small num">/ ' + fmt(target, m.dp) + (m.max ? ' max' : '') + '</span>';
    h += '<div class="nf-row ' + (m.sub ? 'sub' : '') + '"><span class="n">' + m.label + '</span><span class="v num">' + fmt(eaten, m.dp) + (m.unit ? ' ' + m.unit : '') + tgt + '</span>' + pct + '</div>';
  });
  if (extras && extras.length) {
    h += '<div class="nf-cols"><span>Other actives</span><span></span></div>';
    extras.forEach(x => { h += '<div class="nf-row"><span class="n">' + esc(x.name) + '</span><span class="v num">' + fmt(x.v, x.v % 1 ? 1 : 0) + (x.unit ? ' ' + esc(x.unit) : '') + '</span><span class="pct lim">–</span></div>'; });
  }
  h += '<div class="nf-foot">Targets come from your stats and goal (Me tab). Items marked max are limits, not goals. The omega-3 target is a common guideline (EPA + DHA), not a DRI. Micronutrient totals only count foods that list them.</div></div>';
  return h;
}

/* The small line under a supplement entry: its leading actives. Foods show only amount and calories. */
export function miniLine(e, n) {
  if (e.kind === 'supplement' && !(num(n.kcal) > 20)) {
    const parts = Object.keys(SHORT).filter(k => num(n[k]) > 0).map(k => SHORT[k] + ' ' + fmt(n[k], NMETA[k].dp) + NMETA[k].unit);
    (e.extras || []).forEach(x => { if (num(x.v) > 0) parts.push(x.name + ' ' + fmt(num(x.v) * num(e.qty), num(x.v) % 1 ? 1 : 0) + (x.unit || '')); });
    if (parts.length) return parts.slice(0, 4).join(' · ');
  }
  return '';
}

export function entryRowHtml(e) {
  const n = scaled(e.n, num(e.qty));
  const mini = miniLine(e, n);
  return '<button class="entry" data-act="entry" data-id="' + e.id + '"><div class="main"><div class="title">' + esc(e.name) + '</div><div class="sub num">' + esc(entryAmountText(e)) + (e.restaurant ? ' · ' + esc(e.restaurant) : '') + '</div>' + (mini ? '<div class="macros-mini">' + esc(mini) + '</div>' : '') + '</div><div class="kcal num">' + fmt(n.kcal) + '</div></button>';
}
