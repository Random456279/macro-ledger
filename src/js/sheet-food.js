/* The food form sheet: new food, edit food, and the target the AI fills after a scan or a
   description. Owns reading and writing the form; saving is done by actions.js. */
import { $, $$, esc, numOrNull, mkid } from './util.js';
import { NUTR, NK, blankN, cleanExtras } from './nutrients.js';
import { openSheet, sheetFrame, starsHtml, ICON } from './ui.js';

/* "Other actives": free-form rows for anything the nutrient table has no column for. */
export function extraRowHtml(x, i) {
  return '<div class="xrow" data-xi="' + i + '"><input type="text" class="x-name" placeholder="e.g. Beta-alanine" value="' + esc(x && x.name || '') + '" aria-label="Active"><input type="number" inputmode="decimal" step="any" class="x-v num" placeholder="amount" value="' + esc(x && x.v !== null && x.v !== undefined ? x.v : '') + '" aria-label="Amount"><input type="text" class="x-unit" placeholder="mg" value="' + esc(x && x.unit || '') + '" aria-label="Unit"><button type="button" class="closex" data-act="ff-extra-remove" data-i="' + i + '" aria-label="Remove">' + ICON.x + '</button></div>';
}
export function extrasBlockHtml(extras) {
  const list = cleanExtras(extras);
  return '<div class="stack tight"><div class="sec-h"><h2 style="font-size:15px">Other actives</h2><span class="meta">no column, tracked by name</span></div>'
    + '<div id="ff-extras">' + list.map(extraRowHtml).join('') + '</div>'
    + '<div><button type="button" class="link" data-act="ff-extra-add">+ Add an active</button></div></div>';
}
export function readExtras(el) {
  return cleanExtras($$('#ff-extras .xrow', el).map(r => ({ name: $('.x-name', r).value, v: numOrNull($('.x-v', r).value), unit: $('.x-unit', r).value })));
}

export function nutrientFieldsHtml(n) {
  const field = m => '<div class="field"><label>' + m.label + '</label><div class="unitwrap"><input id="n-' + m.k + '" type="number" inputmode="decimal" step="any" value="' + (n && n[m.k] !== null && n[m.k] !== undefined ? esc(n[m.k]) : '') + '" placeholder="–"><span class="unit">' + (m.unit || 'cal') + '</span></div></div>';
  const core = NUTR.filter(m => !m.ext), ext = NUTR.filter(m => m.ext);
  const anyExt = ext.some(m => n && n[m.k] !== null && n[m.k] !== undefined);
  return '<div class="ngrid">' + core.map(field).join('') + '</div>'
    + '<div><button type="button" class="link" data-act="ff-more">' + (anyExt ? 'Fewer nutrients ▴' : 'More vitamins and minerals ▾') + '</button></div>'
    + '<div class="ngrid" id="ff-ext" ' + (anyExt ? '' : 'hidden') + '>' + ext.map(field).join('') + '</div>';
}

export function setFormKind(el, kind, inStack) {
  $$('#ff-kind button', el).forEach(b => b.classList.toggle('on', b.dataset.v === kind));
  const st = $('#ff-stack', el); if (st) st.hidden = kind !== 'supplement';
  if (inStack !== undefined) $$('#ff-instack button', el).forEach(b => b.classList.toggle('on', (b.dataset.v === '1') === !!inStack));
}

/* opts: title, status (html), thumb (object URL of the label photo), addQty (portion to preselect after save) */
export function openFoodForm(food, opts = {}) {
  const f = food || { id: null, name: '', brand: '', servingLabel: '', servingGrams: null, n: blankN(), source: 'manual', kind: 'food' };
  const isNew = !f.id; const kind = f.kind === 'supplement' ? 'supplement' : 'food';
  const statusHtml = opts.status ? '<div class="note" id="ff-status">' + opts.status + '</div>' : '<div id="ff-status" hidden></div>';
  const body = statusHtml + (opts.thumb ? '<img class="thumb" id="ff-thumb" alt="Your label photo">' : '')
    + '<div class="stack"><div class="field"><label>Name</label><input id="ff-name" type="text" value="' + esc(f.name) + '" placeholder="e.g. Chobani Greek Yogurt, Vanilla"></div>'
    + '<div class="grid2"><div class="field"><label>Brand</label><input id="ff-brand" type="text" value="' + esc(f.brand || '') + '"></div><div class="field"><label>Restaurant</label><input id="ff-rest" type="text" value="' + esc(f.restaurant || '') + '" placeholder="if eaten out"></div></div>'
    + '<div class="grid2"><div class="field"><label>Serving size</label><input id="ff-serving" type="text" value="' + esc(f.servingLabel || '') + '" placeholder="1 cup (240 ml)"></div><div class="field"><label>Serving weight</label><div class="unitwrap"><input id="ff-grams" type="number" inputmode="decimal" value="' + esc(f.servingGrams ?? '') + '" placeholder="optional"><span class="unit">g</span></div></div></div>'
    + '<div class="field"><label>Type</label><div class="seg" id="ff-kind"><button type="button" data-v="food" class="' + (kind === 'food' ? 'on' : '') + '">Food</button><button type="button" data-v="supplement" class="' + (kind === 'supplement' ? 'on' : '') + '">Supplement</button></div></div>'
    + '<div class="stack tight" id="ff-stack" ' + (kind === 'supplement' ? '' : 'hidden') + '><div class="grid2"><div class="field"><label>In daily stack</label><div class="seg" id="ff-instack"><button type="button" data-v="1" class="' + (f.inStack ? 'on' : '') + '">Yes</button><button type="button" data-v="0" class="' + (f.inStack ? '' : 'on') + '">No</button></div></div><div class="field"><label>Servings per day</label><input id="ff-stackqty" type="number" inputmode="decimal" step="any" min="0" value="' + esc(f.stackQty ?? 1) + '"></div></div><span class="hint">Stack items log together with one tap on Today, or automatically each day (Me → Supplements).</span></div>'
    + '<div class="sec-h"><h2 style="font-size:15px">Per serving</h2><span class="meta" id="ff-conf"></span></div>' + nutrientFieldsHtml(f.n) + extrasBlockHtml(f.extras) + '</div>'
    + (isNew ? '' : '<div class="field"><label>Rating</label>' + starsHtml(f.rating, 'rate-form') + '</div><div class="btnrow"><button class="btn danger" data-act="food-delete" data-id="' + esc(f.id) + '">Delete food</button></div>');
  const footer = isNew
    ? '<button class="btn" data-act="ff-save">Save</button><button class="btn primary" data-act="ff-save-add">Save and add</button>'
    : '<button class="btn primary" data-act="ff-save">Save changes</button>';
  const el = openSheet(sheetFrame(opts.title || (isNew ? 'New food' : 'Edit food'), body, footer), { name: 'food' });
  el._food = f; el._rating = f.rating || 0; el._meta = { source: f.source || 'manual', confidence: f.confidence || null, notes: f.notes || null, restaurant: f.restaurant || null, basis: f.basis || null };
  if (opts.thumb) { const img = $('#ff-thumb', el); img.src = opts.thumb; img.onload = () => URL.revokeObjectURL(opts.thumb); }
  if (opts.addQty) el._addQty = opts.addQty;
  return el;
}

/* Fill the open form from an AI result (coerceAI output) or any partial food. */
export function fillFoodForm(el, data) {
  if (!el || !document.body.contains(el)) return;
  if (data.name) $('#ff-name', el).value = data.name;
  if (data.brand) $('#ff-brand', el).value = data.brand;
  if (data.restaurant) $('#ff-rest', el).value = data.restaurant;
  if (data.servingLabel) $('#ff-serving', el).value = data.servingLabel;
  if (data.servingGrams) $('#ff-grams', el).value = data.servingGrams;
  NK.forEach(k => { const v = data.n ? data.n[k] : null; $('#n-' + k, el).value = (v === null || v === undefined) ? '' : v; });
  if (NUTR.some(m => m.ext && data.n && data.n[m.k] !== null && data.n[m.k] !== undefined)) { $('#ff-ext', el).hidden = false; $('[data-act="ff-more"]', el).textContent = 'Fewer nutrients ▴'; }
  if (data.extras && data.extras.length) $('#ff-extras', el).innerHTML = cleanExtras(data.extras).map(extraRowHtml).join('');
  if (data.kind === 'supplement') setFormKind(el, 'supplement', true);
  el._meta.source = data.source || el._meta.source; el._meta.confidence = data.confidence || null; el._meta.notes = data.notes || null; el._meta.basis = data.basis || null;
  const c = $('#ff-conf', el); if (c) c.innerHTML = data.confidence ? '<span class="conf ' + esc(data.confidence) + '">' + esc(data.confidence) + ' confidence' + (data.basis === 'knowledge' ? ' · from memory' : '') + '</span>' : '';
}

export function readFoodForm(el) {
  const f = Object.assign({}, el._food);
  f.name = $('#ff-name', el).value.trim(); f.brand = $('#ff-brand', el).value.trim() || null; f.restaurant = $('#ff-rest', el).value.trim() || null;
  f.servingLabel = $('#ff-serving', el).value.trim() || '1 serving'; f.servingGrams = numOrNull($('#ff-grams', el).value);
  const kb = $('#ff-kind .on', el); f.kind = (kb && kb.dataset.v === 'supplement') ? 'supplement' : 'food';
  const sb = $('#ff-instack .on', el); f.inStack = f.kind === 'supplement' && !!sb && sb.dataset.v === '1';
  f.stackQty = numOrNull($('#ff-stackqty', el).value) || 1;
  const n = {}; NK.forEach(k => { n[k] = numOrNull($('#n-' + k, el).value); }); f.n = n;
  f.extras = readExtras(el);
  f.rating = el._rating || 0; f.source = el._meta.source; f.confidence = el._meta.confidence; f.notes = el._meta.notes; f.basis = el._meta.basis || null;
  if (!f.id) { f.id = mkid(); f.created = Date.now(); f.count = 0; f.fav = !!f.fav; }
  return f;
}

export function setStatus(el, html, cls) { const s = $('#ff-status', el); if (!s) return; s.className = 'note ' + (cls || ''); s.innerHTML = html; s.hidden = !html; }
