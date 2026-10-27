/* The Today tab: the Remaining panel (Nutrition Facts styling), the full label, the meal slots
   and the Supplements row. Pure HTML builders; state changes happen in actions.js. */
import { S, MEAL_SLOTS } from './state.js';
import { esc, fmt, fmtQty, num, ymd, addDays, parseYmd, clamp } from './util.js';
import { NUTR, NMETA, SHORT, scaled } from './nutrients.js';
import { activeTargets } from './targets.js';
import { getDay, dayTotals, entryAmountText } from './log.js';
import { stackFoods } from './foods.js';

export function goalWord() {
  const p = S.profile; if (!p) return '';
  if (p.goal === 'lose') return 'Cut · ' + fmtQty(p.rate || 1) + ' lb/wk';
  if (p.goal === 'gain') return 'Gain · ' + fmtQty(p.rate || 0.5) + ' lb/wk';
  return 'Maintain';
}

export function todayHtml() {
  const key = S.dayKey; const day = getDay(key); const T = activeTargets(); const tot = dayTotals(day);
  const remain = T.kcal - tot.kcal; const over = remain < 0;
  const macro = (k, label) => {
    const target = T[k] || 0, eaten = tot[k], left = target - eaten, pct = target ? clamp(eaten / target * 100, 0, 100) : 0;
    return '<div class="macro"><b>' + label + '</b><div class="bar ' + (left < 0 ? 'over' : '') + '"><i style="width:' + pct.toFixed(1) + '%"></i></div>'
      + '<div class="left num">' + (left < 0 ? fmt(-left) + ' g over' : fmt(left) + ' g left') + '<small>' + fmt(eaten) + ' / ' + fmt(target) + ' g</small></div></div>';
  };
  let h = '<section class="nf"><div class="nf-head"><div class="nf-title">Remaining</div><div class="goal">' + esc(goalWord()) + '</div></div>'
    + '<div class="kcal-line"><div><div class="kcal-word">' + (over ? 'Calories over' : 'Calories left') + '</div><div class="kcal-big num ' + (over ? 'over' : '') + '">' + fmt(Math.abs(remain)) + '</div></div>'
    + '<div class="kcal-meta num"><b>' + fmt(tot.kcal) + ' eaten</b>of ' + fmt(T.kcal) + ' target</div></div>'
    + '<div class="macros">' + macro('protein', 'Protein') + macro('carbs', 'Carbs') + macro('fat', 'Fat') + '</div>'
    + '<div class="nf-toggle"><button class="link" data-act="toggle-full">' + (S.fullOpen ? 'Hide full label ▴' : 'Full label ▾') + '</button><span class="small muted num">' + (day.entries || []).length + ' item' + ((day.entries || []).length === 1 ? '' : 's') + '</span></div>';
  if (S.fullOpen) h += fullLabelHtml(tot, T);
  h += '</section>';

  const yKey = ymd(addDays(parseYmd(key), -1)); const y = S.days[yKey];
  if (!(day.entries || []).length && y && (y.entries || []).length) {
    h += '<div class="note" style="display:flex;justify-content:space-between;align-items:center;gap:10px"><span>Nothing logged yet.</span><button class="btn sm" data-act="copy-yesterday">Copy yesterday</button></div>';
  }
  MEAL_SLOTS.forEach(s => {
    const es = (day.entries || []).filter(e => e.slot === s.k);
    const kc = es.reduce((a, e) => a + num(e.n && e.n.kcal) * num(e.qty), 0);
    h += '<section class="slot"><div class="slot-h"><h2>' + s.label + '</h2><div class="acts">' + (es.length ? '<span class="kc num">' + fmt(kc) + ' cal</span><button class="btn sm ghost" data-act="save-meal" data-slot="' + s.k + '">Save meal</button>' : '') + '<button class="btn sm" data-act="add" data-slot="' + s.k + '">+ Add</button></div></div>';
    if (!es.length) h += '<div class="none">Nothing yet</div>';
    else es.forEach(e => { h += entryRowHtml(e); });
    h += '</section>';
  });
  const stack = stackFoods(); const se = (day.entries || []).filter(e => e.slot === 'supplement');
  if (stack.length || se.length) {
    const kc = se.reduce((a, e) => a + num(e.n && e.n.kcal) * num(e.qty), 0);
    const canLog = stack.length && !day.stackLogged;
    h += '<section class="slot"><div class="slot-h"><h2>Supplements</h2><div class="acts">' + (se.length ? '<span class="kc num">' + fmt(kc) + ' cal</span>' : '')
      + (canLog ? '<button class="btn sm" data-act="log-stack">Log stack (' + stack.length + ')</button>' : '')
      + '<button class="btn sm ' + (canLog ? 'ghost' : '') + '" data-act="add" data-slot="supplement">+ Add</button></div></div>';
    if (!se.length) h += '<div class="none">' + (stack.length ? 'Stack not logged yet' : 'Nothing yet') + '</div>';
    else se.forEach(e => { h += entryRowHtml(e); });
    h += '</section>';
  }
  return h;
}

export function fullLabelHtml(tot, T) {
  let h = '<div class="nf-full"><div class="nf-cols"><span>Eaten today</span><span>% of target</span></div>';
  let extStarted = false;
  NUTR.forEach(m => {
    if (m.ext && !extStarted) { extStarted = true; h += '<div class="nf-cols" style="margin-top:8px;border-top:4px solid var(--ink)"><span>Also tracked</span><span>% of target</span></div>'; }
    const eaten = tot[m.k]; const target = T[m.k];
    let pct = '';
    if (m.noTarget || !target) pct = '<span class="pct lim">–</span>';
    else { const p = Math.round(eaten / target * 100); pct = '<span class="pct num ' + (p > 100 ? 'over' : '') + '">' + p + '%</span>'; }
    const tgt = (m.noTarget || !target) ? '' : ' <span class="muted small num">/ ' + fmt(target, m.dp) + (m.max ? ' max' : '') + '</span>';
    h += '<div class="nf-row ' + (m.sub ? 'sub' : '') + '"><span class="n">' + m.label + '</span><span class="v num">' + fmt(eaten, m.dp) + (m.unit ? ' ' + m.unit : '') + tgt + '</span>' + pct + '</div>';
  });
  h += '<div class="nf-foot">Targets come from your stats and goal (Me tab). Items marked max are limits, not goals. Micronutrient totals only count foods that list them.</div></div>';
  return h;
}

/* The small line under an entry: macros, or the leading micros for a low-calorie supplement. */
export function miniLine(e, n) {
  if (e.kind === 'supplement' && !(num(n.kcal) > 20)) {
    const parts = Object.keys(SHORT).filter(k => num(n[k]) > 0).slice(0, 4).map(k => SHORT[k] + ' ' + fmt(n[k], NMETA[k].dp) + NMETA[k].unit);
    if (parts.length) return parts.join(' · ');
  }
  return 'P ' + fmt(n.protein) + '  C ' + fmt(n.carbs) + '  F ' + fmt(n.fat);
}

export function entryRowHtml(e) {
  const n = scaled(e.n, num(e.qty));
  return '<button class="entry" data-act="entry" data-id="' + e.id + '"><div class="main"><div class="title">' + esc(e.name) + '</div><div class="sub num">' + esc(entryAmountText(e)) + (e.restaurant ? ' · ' + esc(e.restaurant) : '') + '</div><div class="macros-mini">' + esc(miniLine(e, n)) + '</div></div><div class="kcal num">' + fmt(n.kcal) + '</div></button>';
}
