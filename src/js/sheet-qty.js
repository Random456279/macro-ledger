/* The amount sheet ("How much?") and the entry editor. Amounts are entered in servings, or by
   weight (g, oz, lb) when the food has a serving weight; the log always stores servings and
   keeps what the user typed in entry.amount for display. */
import { $, $$, esc, num, fmt, fmtQty } from './util.js';
import { S, UNITS, SLOTS, MEAL_SLOTS, SLOT_LABEL, slotNow, hooks } from './state.js';
import { scaled } from './nutrients.js';
import { foodSub } from './foods.js';
import { getDay, logFood } from './log.js';
import { openSheet, closeSheet, closeAllSheets, topSheet, topSheetNamed, sheetFrame, starsHtml, toast } from './ui.js';

export function chipsHtml(U) { return U.chips.map(v => '<button class="chip" data-act="q-set" data-v="' + v + '">' + v + '</button>').join(''); }

export function qtyBlockHtml(hasGrams, unit, value) {
  const U = UNITS[unit] || UNITS.sv;
  return '<div class="field"><label>' + (hasGrams ? 'Amount' : 'Servings') + '</label>'
    + (hasGrams ? '<div class="seg" id="unitSeg">' + Object.keys(UNITS).map(u => '<button type="button" data-u="' + u + '" class="' + (u === unit ? 'on' : '') + '">' + UNITS[u].label + '</button>').join('') + '</div>' : '')
    + '<div class="stepper"><button type="button" data-act="q-step" data-d="-1" aria-label="Less">−</button><input id="qtyInput" class="num" type="number" inputmode="decimal" step="any" min="0" value="' + esc(value) + '"><button type="button" data-act="q-step" data-d="1" aria-label="More">+</button></div>'
    + '<div class="chips" id="qtyChips">' + chipsHtml(U) + '</div>'
    + '<div class="small muted num" id="qtyEquiv"></div></div><div class="preview" id="qtyPreview"></div>';
}

export function slotSegHtml(slot0, withSupp) {
  const list = withSupp ? [SLOTS[4]].concat(MEAL_SLOTS) : MEAL_SLOTS;
  return '<div class="field"><label>Log under</label><div class="seg ' + (withSupp ? 'five' : '') + '" id="qtySlot">' + list.map(s => '<button type="button" data-v="' + s.k + '" class="' + (s.k === slot0 ? 'on' : '') + '">' + s.label.replace('Snacks', 'Snack').replace('Supplements', 'Supps') + '</button>').join('') + '</div></div>';
}

/* Attaches the amount logic to a sheet: el._servings(), el._amount(), el._paint(), el._setUnit(u), el._step(d). */
export function wireQty(el, spec) {
  el._q = { n: spec.n, sg: num(spec.servingGrams) > 0 ? num(spec.servingGrams) : null, unit: (spec.unit && UNITS[spec.unit]) ? spec.unit : 'sv' };
  if (!el._q.sg) el._q.unit = 'sv';
  const input = () => $('#qtyInput', el);
  el._servings = () => { const v = num(input().value); const q = el._q; return (q.unit === 'sv' || !q.sg) ? v : v * UNITS[q.unit].g / q.sg; };
  el._amount = () => { const q = el._q; return (q.unit === 'sv' || !q.sg) ? null : { v: Math.round(num(input().value) * 100) / 100, unit: q.unit }; };
  el._paint = () => {
    const sv = el._servings(); const n = scaled(el._q.n, sv);
    $('#qtyPreview', el).innerHTML = ['kcal', 'protein', 'carbs', 'fat'].map(k => '<div><b class="num">' + fmt(n[k]) + '</b><span>' + (k === 'kcal' ? 'cal' : k) + '</span></div>').join('');
    const eq = $('#qtyEquiv', el); if (!eq) return;
    if (!el._q.sg) { eq.textContent = ''; return; }
    const grams = sv * el._q.sg;
    eq.textContent = el._q.unit === 'sv' ? ('= ' + fmt(grams) + ' g') : ('= ' + fmtQty(sv) + ' serving' + (Math.abs(sv - 1) < 1e-9 ? '' : 's') + ' (' + fmt(grams) + ' g)');
  };
  el._setUnit = u => {
    if (!UNITS[u] || !el._q.sg) return;
    const sv = el._servings(); el._q.unit = u;
    input().value = u === 'sv' ? fmtQty(sv) : fmtQty(sv * el._q.sg / UNITS[u].g);
    $$('#unitSeg button', el).forEach(b => b.classList.toggle('on', b.dataset.u === u));
    $('#qtyChips', el).innerHTML = chipsHtml(UNITS[u]);
    el._paint();
  };
  el._step = d => { const U = UNITS[el._q.unit]; input().value = fmtQty(Math.max(U.step, num(input().value) + d * U.step)); el._paint(); };
  input().addEventListener('input', el._paint);
  el._paint();
}

/* opts: slot, unit, qty, title, cta, onAdd(qty, slot, amount) to intercept instead of logging */
export function openQty(food, opts = {}) {
  const isSupp = food.kind === 'supplement';
  const slot0 = opts.slot || (isSupp ? 'supplement' : (S.addSlot || slotNow()));
  const withSupp = isSupp || slot0 === 'supplement';
  const hasGrams = num(food.servingGrams) > 0;
  const unit = (hasGrams && opts.unit) ? opts.unit : 'sv';
  const value = opts.qty || (isSupp && num(food.stackQty)) || 1;
  const inAdd = !!topSheetNamed('add') && !opts.onAdd;
  const body = '<div><div style="font-weight:800;font-size:18px">' + esc(food.name) + '</div><div class="small muted">' + esc(foodSub(food)) + '</div></div>'
    + qtyBlockHtml(hasGrams, unit, value) + slotSegHtml(slot0, withSupp);
  const footer = (inAdd ? '<button class="btn" data-act="q-add-more">Add + another</button>' : '') + '<button class="btn primary" data-act="q-add">' + (opts.cta || 'Add') + '</button>';
  const el = openSheet(sheetFrame(opts.title || 'How much?', body, footer), { name: 'qty' });
  el._food = food; el._dayKey = S.dayKey; el._onAdd = opts.onAdd;
  wireQty(el, { n: food.n, servingGrams: food.servingGrams, unit });
}

/* The Add / Add + another buttons. */
export function addFromQty(more) {
  const el = topSheet(); const qty = el._servings(); if (!(qty > 0)) { toast('Enter an amount'); return; }
  const amount = el._amount(); const slot = ($('#qtySlot .on', el) || { dataset: { v: slotNow() } }).dataset.v;
  if (el._onAdd) { el._onAdd(qty, slot, amount); return; }
  logFood(el._food, qty, slot, el._dayKey, amount);
  if (more) { closeSheet(); S.addSlot = slot; hooks.refreshOpenLists(); hooks.render(); toast('Added. Pick the next one'); return; }
  closeAllSheets(); S.tab = 'today'; S.dayKey = el._dayKey; hooks.render(); toast('Added to ' + SLOT_LABEL[slot]);
}

export function openEntry(entryId) {
  const day = getDay(S.dayKey); const e = (day.entries || []).find(x => x.id === entryId); if (!e) return;
  const f = S.foods[e.foodId];
  const sg = num(e.servingGrams) || (f && num(f.servingGrams)) || 0;
  const unit = (sg > 0 && e.amount && UNITS[e.amount.unit]) ? e.amount.unit : 'sv';
  const value = unit === 'sv' ? fmtQty(e.qty) : fmtQty(e.amount.v);
  const withSupp = e.slot === 'supplement' || e.kind === 'supplement';
  const body = '<div><div style="font-weight:800;font-size:18px">' + esc(e.name) + '</div><div class="small muted">' + esc(e.servingLabel || 'serving') + (e.restaurant ? ' · ' + esc(e.restaurant) : e.brand ? ' · ' + esc(e.brand) : '') + '</div></div>'
    + qtyBlockHtml(sg > 0, unit, value) + slotSegHtml(e.slot, withSupp)
    + (f ? '<div class="field"><label>Rate this food</label>' + starsHtml(f.rating, 'rate-food', 'data-id="' + esc(f.id) + '"') + '</div>' : '')
    + '<div class="btnrow"><button class="btn danger" data-act="entry-delete">Remove</button>' + (f ? '<button class="btn ghost" data-act="food-open" data-id="' + esc(f.id) + '">Edit food</button>' : '') + '</div>';
  const el = openSheet(sheetFrame('Edit entry', body, '<button class="btn primary" data-act="entry-save">Save</button>'), { name: 'entry' });
  el._entry = e; el._dayKey = S.dayKey;
  wireQty(el, { n: e.n, servingGrams: sg, unit });
}
