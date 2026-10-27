/* Everything that talks to Claude through the artifact `sample` capability:
   the label reader (Nutrition Facts and Supplement Facts photos), the meal estimator
   (typed descriptions, optional restaurant), prompt text, result coercion, error copy.
   Calls run on the viewer's own Claude account; the first call asks their consent. */
import { S } from './state.js';
import { NK, cleanExtras } from './nutrients.js';
import { $, $$, esc, numOrNull, fmtQty } from './util.js';
import { toast, openSheet, sheetFrame, closeSheet } from './ui.js';
import { openFoodForm, fillFoodForm, setStatus } from './sheet-food.js';
import { askJSON, aiAvailable } from './backend.js';

export const JSON_SHAPE = '{"kind": "food"|"supplement", "basis": "label"|"knowledge", "name": string, "brand": string|null, "servingLabel": string, "servingGrams": number|null, "servingsPerContainer": number|null, "perServing": {' + NK.map(k => '"' + k + '": number|null').join(', ') + '}, "extras": [{"name": string, "amount": number, "unit": string}], "confidence": "high"|"medium"|"low", "notes": string}';
export const UNIT_RULES = 'Units: grams for protein, carbs, fat, fiber, sugar, addedSugar, satFat, transFat and creatine; milligrams for cholesterol, sodium, potassium, calcium, iron, vitC, vitE, vitB6, magnesium, zinc, omega3 and caffeine; micrograms for vitD, vitA (as RAE), vitK, folate (as DFE), vitB12, selenium and iodine. omega3 is EPA plus DHA in mg (use total omega-3 if that is all that is printed; put EPA and DHA separately in extras). If a value is printed only as a percent Daily Value, convert it with these daily values: calcium 1300 mg, iron 18 mg, potassium 4700 mg, vitamin D 20 mcg, vitamin A 900 mcg, vitamin C 90 mg, vitamin E 15 mg, vitamin K 120 mcg, vitamin B6 1.7 mg, folate 400 mcg, vitamin B12 2.4 mcg, magnesium 420 mg, zinc 11 mg, selenium 55 mcg, iodine 150 mcg. Convert IU: vitamin D 40 IU = 1 mcg, vitamin A 3.33 IU = 1 mcg, vitamin E 1.5 IU = 1 mg. Every other active with an amount (beta-alanine, citrulline, taurine, probiotics in CFU, ashwagandha, electrolytes not listed above, other B vitamins, biotin, chromium, copper, manganese) goes in extras as {name, amount, unit}, one entry each, exact label wording for the name.';
export const LABEL_PROMPT = 'You are reading a photo of a packaged food or supplement. Reply with ONLY a JSON object in this shape, no prose:\n' + JSON_SHAPE
  + '\nFirst decide what the photo shows. (A) A Nutrition Facts or Supplement Facts panel is visible, fully or mostly: set basis to "label" and extract the values exactly as printed. (B) Only the front or side of the package is visible, no facts panel: identify the exact product (brand, product name, variant, strength or flavor, count or size if visible), set basis to "knowledge", and fill the values from what you know of that product\'s current label. In case B say in notes that the values are from memory and must be checked against the panel, name any detail you were unsure of (which variant, which serving size), and set confidence no higher than "medium"; if you cannot identify the product confidently, leave perServing null, set confidence "low" and explain in notes.'
  + '\nkind is "supplement" for a Supplement Facts product (vitamins, minerals, fish oil, protein or pre-workout powders, creatine, gummies), otherwise "food". Use PER SERVING values, never per container or per package, when both are shown. servingLabel is the serving size as printed, for example "2/3 cup (55g)", "2 soft gels" or "1 scoop (31g)"; servingGrams is the gram weight if printed, else null. ' + UNIT_RULES
  + ' If a nutrient is not on the label use null. If the product name or brand is not visible, give a short best guess and say so in notes. Put anything unclear or cut off in notes. For basis "label", set confidence "low" if the panel is blurry or partly hidden, "medium" if a few values were hard to read, else "high".';

export function describePrompt(desc, where) {
  return 'Estimate the nutrition of a meal someone ate. Reply with ONLY a JSON object in this shape, no prose:\n' + JSON_SHAPE
    + '\nRules: kind is "food", basis is "knowledge", extras is usually []. If the description gives weights, volumes or counts (0.8 lb chicken breast, 2 eggs, 200 g rice, 1 tbsp oil), use them exactly instead of typical portions; treat weights of meat, fish, rice, pasta, oats and potatoes as RAW unless the description says cooked, and apply normal cooking yields. Where no amounts are given, use typical restaurant or home portions, and when the restaurant is a chain with published nutrition information, use its published figures. Treat the WHOLE description, as served, as one serving: name is a short dish name under 40 characters; servingLabel says what one serving means here, for example "1 bowl as described" or "full plate as served"; set brand to null and servingsPerContainer to null. Estimate every nutrient you reasonably can (especially kcal, protein, carbs, fat, fiber, sugar, satFat, sodium, potassium) and use null only when you truly cannot. ' + UNIT_RULES
    + ' In notes, state the key assumptions in one sentence, including whether weights were taken as raw or cooked. Confidence "high" for published chain data or fully weighed ingredients, "medium" for a well-defined dish, "low" for a vague description.'
    + '\n\nMeal: ' + desc + '\nRestaurant: ' + (where || 'not specified (home-cooked or unknown)');
}

/* Shape-check an AI reply into a partial food. Never trusts types. */
export function coerceAI(j, defaults) {
  const o = (j && typeof j === 'object' && !Array.isArray(j)) ? j : {};
  const per = (o.perServing && typeof o.perServing === 'object') ? o.perServing : {};
  const n = {}; NK.forEach(k => { n[k] = numOrNull(per[k]); });
  const basis = o.basis === 'knowledge' ? 'knowledge' : 'label';
  let confidence = ['high', 'medium', 'low'].includes(o.confidence) ? o.confidence : 'medium';
  if (basis === 'knowledge' && confidence === 'high') confidence = 'medium';   /* recall is never "high" */
  return Object.assign({}, defaults, {
    kind: o.kind === 'supplement' ? 'supplement' : (defaults.kind || 'food'), basis,
    name: typeof o.name === 'string' ? o.name.trim().slice(0, 80) : '', brand: typeof o.brand === 'string' ? o.brand.trim().slice(0, 60) : null,
    servingLabel: typeof o.servingLabel === 'string' ? o.servingLabel.trim().slice(0, 60) : '', servingGrams: numOrNull(o.servingGrams), n,
    extras: cleanExtras(o.extras),
    confidence, notes: typeof o.notes === 'string' ? o.notes.trim().slice(0, 300) : null,
  });
}

export function aiErrorCopy(e) {
  const c = e && e.code;
  if (c === 'not_granted' || c === 'sampling_disabled' || c === 'not_declared') return 'Claude isn\'t allowed on this page, so scanning is off. You can still enter the label by hand below.';
  if (c === 'rate_limited') return 'You\'ve hit your Claude usage limit for now. Enter it by hand, or try again later.';
  if (c === 'images_unavailable' || c === 'image_rejected') return 'That photo couldn\'t be sent. Try a clearer JPEG, or enter the label by hand.';
  if (c === 'invalid_json' || c === 'empty_completion') return 'The label couldn\'t be read into numbers. Try again with a sharper, straight-on photo, or enter it by hand.';
  if (c === 'session_expired') return 'Your Claude session expired. Sign in again, then retry.';
  if (c === 'offline') return 'No connection. Scanning needs the network; enter it by hand for now.';
  if (c === 'unauthorized') return 'This device key is no longer valid. Reconnect in Me.';
  if (c === 'server_not_configured') return 'The server has no AI key yet. Enter it by hand for now.';
  if (c === 'refused') return 'Claude declined to read that image. Enter it by hand.';
  if (c === 'cancelled') return 'Cancelled.';
  return 'Something went wrong talking to Claude. Try again, or enter it by hand.';
}

/* "quick" is the fast tier; Careful mode (Me → Scanning) uses the default tier. */
export function modelOpts() { return { modelTier: (S.profile && S.profile.careful) ? 'default' : 'quick' }; }

/* Called at boot with the resolved sample namespace (or null). */
export async function initAI(sample) {
  S.ai.sample = sample || null; S.ai.images = false;
  if (!sample) return;
  try {
    const lim = await sample.limits();
    S.ai.images = !!(lim && lim.images);
    const input = $('#photoInput');
    if (input && lim && lim.images && lim.images.mediaTypes && lim.images.mediaTypes.length) input.accept = lim.images.mediaTypes.join(',');
  } catch (e) { S.ai.images = false; }
}

export async function scanLabel(file) {
  if (!aiAvailable()) { toast('Scanning needs Claude; opening manual entry'); openFoodForm(null); return; }
  const thumb = URL.createObjectURL(file);
  const el = openFoodForm(null, { title: 'Scan label', status: '<span class="spin"></span>Reading the label…', thumb });
  el._meta.source = 'label';
  try {
    const j = await askJSON(LABEL_PROMPT, Object.assign({ images: [file] }, modelOpts()));
    const d = coerceAI(j, { source: 'label' });
    if (!document.body.contains(el)) return;
    fillFoodForm(el, d);
    const miss = NK.every(k => d.n[k] === null) && !d.extras.length;
    const isSupp = d.kind === 'supplement';
    const supp = isSupp ? ' Set how many you take a day.' : '';
    let msg, cls = '';
    if (miss) { msg = 'No numbers came back. ' + (d.notes ? esc(d.notes) + ' ' : '') + 'Try a photo of the facts panel, or enter them by hand.'; cls = 'bad'; }
    else if (d.basis === 'knowledge') { msg = 'Recognized from the front of the package. These numbers are from Claude\'s memory of this product, not its label; check them against the panel' + (d.notes ? ' · ' + esc(d.notes) : '') + '.' + supp; cls = 'warn'; }
    else { msg = 'Read from your ' + (isSupp ? 'Supplement Facts panel' : 'label') + '. Check the numbers before saving' + (d.notes ? ' · ' + esc(d.notes) : '') + '.' + supp; cls = d.confidence === 'low' ? 'warn' : ''; }
    setStatus(el, msg, cls);
  } catch (e) {
    if (!document.body.contains(el)) return;
    setStatus(el, esc(aiErrorCopy(e)), 'bad');
  }
}

export function openDescribe() {
  if (!aiAvailable()) { toast('Estimates need Claude; opening manual entry'); openFoodForm(null); return; }
  const body = '<div class="field"><label>What did you eat?</label><textarea id="d-text" placeholder="e.g. 0.9 lb chicken breast (raw), 1 cup cooked white rice, 1 tbsp olive oil&#10;or: chicken burrito bowl with white rice, black beans, guac and salsa"></textarea><span class="hint">Weights and counts you give are used exactly. Meat and grain weights count as raw unless you say cooked.</span></div>'
    + '<div class="field"><label>Restaurant (optional)</label><input id="d-where" type="text" placeholder="Chipotle, Joe T. Garcia\'s, home…"></div>'
    + '<div class="field"><label>How much of it did you eat?</label><div class="seg" id="d-portion"><button type="button" data-v="1" class="on">All</button><button type="button" data-v="0.75">3/4</button><button type="button" data-v="0.5">Half</button><button type="button" data-v="0.25">1/4</button></div></div>'
    + '<div class="note">Claude estimates the full dish as served; the portion scales what gets logged. Chains with published nutrition come out close; independent restaurants are a rougher estimate. For exact weighed foods you already have saved, use Favorites or Basics and switch the amount to lb or oz.</div>';
  const el = openSheet(sheetFrame('Describe a meal', body, '<button class="btn primary" data-act="d-go">Estimate</button>'), { name: 'describe' });
  setTimeout(() => $('#d-text', el).focus(), 50);
}

/* Reads the describe sheet (must be the top sheet), closes it, and runs the estimate. */
export function submitDescribe(el) {
  const desc = $('#d-text', el).value.trim(); if (!desc) { toast('Describe what you ate first'); return; }
  const where = $('#d-where', el).value.trim(); const portion = Number(($('#d-portion .on', el) || { dataset: { v: 1 } }).dataset.v) || 1;
  closeSheet(); runDescribe(desc, where, portion);
}

export async function runDescribe(desc, where, portion) {
  const el = openFoodForm(null, { title: where ? 'Dining out' : 'Described meal', status: '<span class="spin"></span>Estimating…', addQty: portion });
  el._meta.source = where ? 'restaurant' : 'describe'; el._meta.restaurant = where || null;
  $('#ff-rest', el).value = where || '';
  try {
    const j = await askJSON(describePrompt(desc, where), modelOpts());
    const d = coerceAI(j, { source: where ? 'restaurant' : 'describe' });
    if (!document.body.contains(el)) return;
    if (!d.name) d.name = desc.slice(0, 40);
    if (!d.servingLabel) d.servingLabel = 'as described';
    fillFoodForm(el, d);
    setStatus(el, 'Estimate for the full dish as served' + (portion !== 1 ? '; ' + fmtQty(portion) + ' of it will be logged' : '') + '. Check the numbers before saving' + (d.notes ? ' · ' + esc(d.notes) : '') + '.', d.confidence === 'low' ? 'warn' : '');
  } catch (e) {
    if (!document.body.contains(el)) return;
    setStatus(el, esc(aiErrorCopy(e)), 'bad');
  }
}
