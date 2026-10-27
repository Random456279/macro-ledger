// Headless smoke test of the BUILT app (dist/macro-ledger.html) in jsdom: local mode (no window.claude) and db mode (stubbed capabilities).
// Run with: npm test
const fs = require('fs');
const { JSDOM } = require('jsdom');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'dist', 'macro-ledger.html'), 'utf8');
const page = '<!doctype html><html><head><meta charset="utf-8"></head><body>' + html + '</body></html>';

function tick(ms = 0) { return new Promise(r => setTimeout(r, ms)); }
function assert(c, m) { if (!c) { throw new Error('ASSERT: ' + m); } console.log('ok  ' + m); }

async function runLocal() {
  const dom = new JSDOM(page, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.test/' });
  const { window } = dom; const d = window.document;
  const errors = []; window.addEventListener('error', e => errors.push(e.message));
  await tick(20);
  assert(errors.length === 0, 'no script errors on load');
  assert(d.querySelector('#onb-go'), 'onboarding rendered');
  assert(d.querySelector('#onb-go').disabled, 'start disabled until stats entered');
  const set = (id, v) => { const el = d.querySelector(id); el.value = String(v); el.dispatchEvent(new window.Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
  set('#f-age', 20); set('#f-wt', 180); set('#f-bf', 15);
  assert(d.querySelector('#onb-go').disabled, 'start still disabled before height');
  set('#f-hft', 6); set('#f-hin', 0);
  d.querySelector('#f-goal button[data-v="lose"]').click();
  assert(!d.querySelector('#onb-go').disabled, 'start enabled after stats');
  assert(d.querySelector('#targets-preview').textContent.includes('Calories'), 'targets preview shows calories');
  d.querySelector('#onb-go').click(); await tick(5);
  assert(d.querySelector('.nf-title') && d.querySelector('.nf-title').textContent === 'Remaining', 'today view rendered after onboarding');
  const kcalLeft = d.querySelector('.kcal-big').textContent; console.log('    kcal left: ' + kcalLeft);
  // open add sheet, pick basics, log an egg x2
  d.querySelector('nav.tabs button.add').click(); await tick(5);
  assert(d.querySelector('.scrim .sheet'), 'add sheet open');
  d.querySelector('[data-act="add-filter"][data-f="basics"]').click();
  const egg = d.querySelector('[data-act="pick"][data-id="basic:egg"]'); assert(egg, 'basics list shows egg');
  egg.click(); await tick(5);
  assert(d.querySelector('#qtyInput'), 'qty sheet open');
  d.querySelector('[data-act="q-set"][data-v="2"]').click();
  d.querySelector('[data-act="q-add"]').click(); await tick(5);
  assert(!d.querySelector('.scrim'), 'sheets closed after add');
  assert(d.querySelector('.entry'), 'entry rendered in slot');
  const eaten = d.querySelector('.kcal-meta b').textContent; assert(eaten.startsWith('144'), 'eaten shows 144 for 2 eggs (got ' + eaten + ')');
  // full label toggle
  d.querySelector('[data-act="toggle-full"]').click(); await tick(2);
  assert(d.querySelectorAll('.nf-row').length === 29, 'full label has 29 rows (got ' + d.querySelectorAll('.nf-row').length + ')');
  // edit entry: change qty to 1, slot to lunch
  d.querySelector('.entry').click(); await tick(2);
  d.querySelector('#qtyInput').value = '1';
  d.querySelector('#qtySlot button[data-v="lunch"]').click();
  d.querySelector('[data-act="entry-save"]').click(); await tick(2);
  const lunch = Array.from(d.querySelectorAll('.slot')).find(s => s.querySelector('h2').textContent === 'Lunch');
  assert(lunch.querySelector('.entry'), 'entry moved to lunch');
  // save slot as meal
  lunch.querySelector('[data-act="save-meal"]').click(); await tick(2);
  assert(d.querySelector('#m-name'), 'meal builder open from slot');
  d.querySelector('#m-name').value = 'Egg lunch';
  d.querySelector('[data-act="m-save"]').click(); await tick(2);
  d.querySelector('nav.tabs button[data-tab="meals"]').click(); await tick(2);
  assert(d.querySelector('[data-act="meal-open"]'), 'meal listed in Meals tab');
  d.querySelector('[data-act="meal-open"]').click(); await tick(2);
  d.querySelector('[data-act="meal-log"]').click(); await tick(2);
  assert(d.querySelectorAll('.entry').length === 2, 'meal logged adds entry (2 entries now)');
  // foods tab, favorite + manual new food
  d.querySelector('nav.tabs button[data-tab="foods"]').click(); await tick(2);
  assert(d.querySelector('[data-act="food-open"]'), 'foods tab lists egg copy');
  d.querySelector('[data-act="fav"]').click(); await tick(2);
  assert(d.querySelector('.star.on'), 'favorite toggled');
  d.querySelector('[data-act="new-manual"]').click(); await tick(2);
  d.querySelector('#ff-name').value = 'Test bar'; d.querySelector('#n-kcal').value = '200'; d.querySelector('#n-protein').value = '20';
  d.querySelector('[data-act="ff-save-add"]').click(); await tick(2);
  assert(d.querySelector('#qtyInput'), 'save and add opens qty');
  d.querySelector('[data-act="q-add"]').click(); await tick(2);
  assert(d.querySelectorAll('.entry').length === 3, 'manual food logged');
  // weights: chicken raw by the pound, then add + another
  d.querySelector('nav.tabs button[data-tab="today"]').click(); await tick(2);
  d.querySelector('nav.tabs button.add').click(); await tick(5);
  d.querySelector('[data-act="add-filter"][data-f="basics"]').click();
  d.querySelector('[data-act="pick"][data-id="basic:chickenraw"]').click(); await tick(5);
  assert(d.querySelector('#unitSeg'), 'unit switcher shown for food with serving weight');
  d.querySelector('#unitSeg button[data-u="lb"]').click(); await tick(2);
  d.querySelector('#qtyInput').value = '0.9'; d.querySelector('#qtyInput').dispatchEvent(new window.Event('input', { bubbles: true }));
  const eq = d.querySelector('#qtyEquiv').textContent; assert(eq.startsWith('= 3.61 servings'), 'lb converts to servings (' + eq + ')');
  const kcalPrev = d.querySelector('#qtyPreview b').textContent; assert(kcalPrev === '491', '0.9 lb raw chicken previews 491 cal (got ' + kcalPrev + ')');
  assert(d.querySelector('[data-act="q-add-more"]'), 'add + another offered');
  d.querySelector('[data-act="q-add-more"]').click(); await tick(5);
  assert(d.querySelector('#addList') && !d.querySelector('#qtyInput'), 'add sheet stays open after add + another');
  d.querySelector('[data-act="add-filter"][data-f="basics"]').click();
  d.querySelector('[data-act="pick"][data-id="basic:ricedry"]').click(); await tick(5);
  d.querySelector('#unitSeg button[data-u="g"]').click(); await tick(2);
  d.querySelector('[data-act="q-set"][data-v="100"]').click();
  d.querySelector('[data-act="q-add"]').click(); await tick(5);
  const subs = Array.from(d.querySelectorAll('.entry .sub')).map(x => x.textContent);
  assert(subs.some(t => t.startsWith('0.9 lb · 3.61 servings')), 'entry shows weight and servings (' + subs.join(' | ') + ')');
  assert(subs.some(t => t.startsWith('100 g · 2.22 servings')), 'grams entry shows weight');
  // edit a weighed entry keeps its unit
  Array.from(d.querySelectorAll('.entry')).find(x => x.querySelector('.sub').textContent.startsWith('0.9 lb')).click(); await tick(2);
  assert(d.querySelector('#unitSeg button.on').dataset.u === 'lb' && d.querySelector('#qtyInput').value === '0.9', 'edit entry reopens in lb');
  d.querySelector('[data-act="close"]').click(); await tick(2);
  // supplements: manual supplement, stack, log stack, auto-stack
  d.querySelector('nav.tabs button[data-tab="foods"]').click(); await tick(2);
  d.querySelector('[data-act="new-manual"]').click(); await tick(2);
  d.querySelector('#ff-name').value = 'Vitamin D3'; d.querySelector('#ff-serving').value = '1 softgel';
  d.querySelector('#ff-kind button[data-v="supplement"]').click(); await tick(2);
  assert(!d.querySelector('#ff-stack').hidden, 'stack fields appear for supplements');
  d.querySelector('#ff-instack button[data-v="1"]').click();
  d.querySelector('#ff-stackqty').value = '2';
  d.querySelector('[data-act="ff-more"]').click(); assert(!d.querySelector('#ff-ext').hidden, 'extra nutrients expand');
  d.querySelector('#n-vitD').value = '25'; d.querySelector('#n-vitC').value = '0';
  d.querySelector('[data-act="ff-save"]').click(); await tick(2);
  d.querySelector('[data-act="foods-sort"][data-sort="supp"]').click(); await tick(2);
  assert(d.querySelector('#foodsList .title').textContent === 'Vitamin D3', 'supplements chip lists the supplement');
  assert(d.querySelector('#foodsList .sub').textContent.includes('stack · 2/day'), 'row shows stack qty');
  d.querySelector('nav.tabs button[data-tab="today"]').click(); await tick(2);
  const suppSec = Array.from(d.querySelectorAll('.slot')).find(s => s.querySelector('h2').textContent === 'Supplements');
  assert(suppSec && suppSec.querySelector('[data-act="log-stack"]'), 'Today shows Supplements row with Log stack');
  suppSec.querySelector('[data-act="log-stack"]').click(); await tick(2);
  const suppSec2 = Array.from(d.querySelectorAll('.slot')).find(s => s.querySelector('h2').textContent === 'Supplements');
  assert(suppSec2.querySelector('.entry') && !suppSec2.querySelector('[data-act="log-stack"]'), 'stack logged once, button gone');
  assert(suppSec2.querySelector('.entry .sub').textContent.startsWith('2 × 1 softgel'), 'stack entry uses servings per day');
  assert(suppSec2.querySelector('.macros-mini').textContent.startsWith('D 50.0mcg'), 'supplement row shows micros (' + suppSec2.querySelector('.macros-mini').textContent + ')');
  if (!d.querySelector('.nf-row')) { d.querySelector('[data-act="toggle-full"]').click(); await tick(2); }
  const rows = Array.from(d.querySelectorAll('.nf-row')); const vitRow = rows.find(r => r.querySelector('.n').textContent === 'Vitamin D');
  assert(vitRow.querySelector('.pct').textContent === '347%', 'vitamin D % of target counts the stack (' + vitRow.querySelector('.pct').textContent + ')');
  d.querySelector('[data-act="toggle-full"]').click();
  // auto stack on a fresh day
  d.querySelector('nav.tabs button[data-tab="me"]').click(); await tick(2);
  d.querySelector('[data-act="toggle-autostack"]').click(); await tick(2);
  assert(d.body.textContent.includes('Vitamin D3'), 'Me lists the stack');
  window.localStorage.setItem('__t', '1');
  // day nav + copy yesterday
  d.querySelector('nav.tabs button[data-tab="today"]').click(); await tick(2);
  const todayCount = d.querySelectorAll('.entry').length;
  d.querySelector('[data-act="day"][data-n="1"]').click(); await tick(2);
  assert(d.querySelector('[data-act="copy-yesterday"]'), 'tomorrow offers copy yesterday');
  d.querySelector('[data-act="copy-yesterday"]').click(); await tick(2);
  assert(d.querySelectorAll('.entry').length === todayCount, 'copied all ' + todayCount + ' entries');
  assert(!d.querySelector('[data-act="log-stack"]'), 'copied day counts its stack as logged');
  d.querySelector('[data-act="day-today"]').click(); await tick(2);
  // me tab render + targets editor
  d.querySelector('nav.tabs button[data-tab="me"]').click(); await tick(2);
  assert(d.querySelector('[data-act="edit-targets"]'), 'me tab rendered');
  d.querySelector('[data-act="edit-targets"]').click(); await tick(2);
  d.querySelector('#t-protein').value = '190';
  d.querySelector('[data-act="t-save"]').click(); await tick(2);
  assert(d.body.textContent.includes('custom targets'), 'custom targets flagged');
  // describe flow without claude -> manual
  d.querySelector('nav.tabs button.add').click(); await tick(2);
  d.querySelector('[data-act="describe"]').click(); await tick(2);
  assert(d.querySelector('#ff-name'), 'describe without Claude falls back to manual form');
  // persistence
  const saved = JSON.parse(window.localStorage.getItem('macroledger.v1'));
  assert(saved.profile && Object.keys(saved.foods).length === 5 && Object.keys(saved.days).length === 2, 'localStorage mirror has profile, 5 foods, 2 days (' + Object.keys(saved.foods).length + ')');
  // simulate a new day: remove today's supplement entries + flag, reload, auto-stack should log
  const todayKey = Object.keys(saved.days).sort()[0];
  saved.days[todayKey].entries = saved.days[todayKey].entries.filter(e => e.slot !== 'supplement'); saved.days[todayKey].stackLogged = false; saved.tab = 'today';
  window.localStorage.setItem('macroledger.v1', JSON.stringify(saved));
  const dom2 = new JSDOM(page, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.test/', beforeParse(w) { w.localStorage.setItem('macroledger.v1', JSON.stringify(saved)); } });
  await tick(30);
  const d2 = dom2.window.document;
  const sup2 = Array.from(d2.querySelectorAll('.slot')).find(s => s.querySelector('h2').textContent === 'Supplements');
  assert(sup2 && sup2.querySelector('.entry') && !sup2.querySelector('[data-act="log-stack"]'), 'auto-stack logs on first open of the day');
  dom2.window.close();
  assert(errors.length === 0, 'no script errors during local flow');
  // export fallback (no clipboard)
  window.close();
}

async function runDb() {
  // Stub a minimal db/user/sample behind window.claude.use
  const store = {}; const subs = [];
  function snapDoc(path) { const data = store[path]; return { id: path.split('/').pop(), exists: !!data, data: () => data, metadata: { fromCache: false, hasPendingWrites: false } }; }
  function notify() { subs.forEach(s => s()); }
  function docRef(path) { return { id: path.split('/').pop(), path,
    get: async () => snapDoc(path), set: async d => { store[path] = JSON.parse(JSON.stringify(d)); notify(); }, update: async d => { Object.assign(store[path], d); notify(); }, delete: async () => { delete store[path]; notify(); },
    onSnapshot: (next) => { const fn = () => next(snapDoc(path)); subs.push(fn); setTimeout(fn, 0); return () => {}; }, collection: p => colRef(path + '/' + p) }; }
  function colRef(path) { const q = (filter) => ({ where: (f, op, v) => q((d) => d[f] >= v), orderBy: () => q(filter), limit: () => q(filter),
    get: async () => snapQ(), onSnapshot: (next) => { const fn = () => next(snapQ()); subs.push(fn); setTimeout(fn, 0); return () => {}; } });
    function snapQ(filter) { const docs = Object.keys(store).filter(k => k.startsWith(path + '/') && k.split('/').length === path.split('/').length + 1).map(k => snapDoc(k)); return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } }; }
    return Object.assign(q(), { path, doc: id => docRef(path + '/' + (id || 'auto' + Math.random().toString(36).slice(2))), add: async d => { const r = docRef(path + '/x' + Math.random().toString(36).slice(2)); await r.set(d); return r; } }); }
  const db = { doc: p => docRef(p), collection: p => colRef(p) };
  const user = { id: async () => 'u_test', isOwner: async () => true, canEdit: async () => true, can: async () => true };
  const calls = [];
  const sample = Object.assign(async (input, opts) => ({ text: 'x', truncated: false, modelTierApplied: 'quick' }), {
    json: async (input, opts) => { calls.push({ input: input.slice(0, 40), img: !!(opts && opts.images), tier: opts && opts.modelTier }); if (calls.length === 4) return { kind: 'supplement', basis: 'knowledge', name: 'Ultimate Omega 2X', brand: 'Nordic Naturals', servingLabel: '2 soft gels', servingGrams: null, perServing: { kcal: 20, fat: 2, omega3: 2150 }, extras: [{ name: 'EPA', amount: 1125, unit: 'mg' }, { name: 'DHA', amount: 875, unit: 'mg' }], confidence: 'high', notes: 'values from memory; verify lemon vs unflavored' };
      if (calls.length === 3) return { kind: 'supplement', name: 'Multivitamin', brand: 'Acme', servingLabel: '1 tablet', servingGrams: null, perServing: { vitD: 25, vitA: 900, vitC: 90, vitB12: 6, magnesium: 50, zinc: 11, calcium: 200, iron: 18 }, confidence: 'high', notes: 'also 50 mg omega-3' }; return { kind: 'food', name: 'Scanned Bar', brand: 'Acme', servingLabel: '1 bar (45g)', servingGrams: 45, perServing: { kcal: 210, protein: 12, carbs: 20, fat: 9, fiber: 3, sugar: 8, addedSugar: 6, satFat: 2.5, transFat: 0, cholesterol: 5, sodium: 150, potassium: 120, calcium: 40, iron: 1.2, vitD: 0 }, confidence: 'high', notes: 'clear label' }; },
    limits: async () => ({ maxPromptBytes: 262144, images: { maxCount: 4, maxInputBytes: 20e6, mediaTypes: ['image/jpeg', 'image/png'] } }),
  });
  const dom = new JSDOM(page, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.test/',
    beforeParse(window) { window.claude = { use: async name => ({ db, user, sample })[name] || null }; window.URL.createObjectURL = () => 'blob:x'; window.URL.revokeObjectURL = () => {}; } });
  const { window } = dom; const d = window.document;
  const errors = []; window.addEventListener('error', e => errors.push(e.message));
  await tick(30);
  assert(errors.length === 0, '[db] no errors on load');
  const set = (id, v) => { const el = d.querySelector(id); el.value = String(v); el.dispatchEvent(new window.Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
  set('#f-age', 20); set('#f-hft', 6); set('#f-hin', 0); set('#f-wt', 180);
  d.querySelector('#onb-go').click(); await tick(20);
  assert(store['u/u_test'] && store['u/u_test'].targets, '[db] profile written to u/<uid>');
  assert(d.querySelector('.nf-title'), '[db] today rendered');
  // log a basic -> food doc + day doc
  d.querySelector('nav.tabs button.add').click(); await tick(5);
  d.querySelector('[data-act="add-filter"][data-f="basics"]').click();
  d.querySelector('[data-act="pick"][data-id="basic:chicken"]').click(); await tick(5);
  d.querySelector('[data-act="q-add"]').click(); await tick(30);
  const foodDocs = Object.keys(store).filter(k => k.startsWith('u/u_test/foods/')); const dayDocs = Object.keys(store).filter(k => k.startsWith('u/u_test/days/'));
  assert(foodDocs.length === 1 && dayDocs.length === 1, '[db] food and day docs written (' + foodDocs.length + ', ' + dayDocs.length + ')');
  assert(d.querySelectorAll('.entry').length === 1, '[db] entry rendered from snapshot');
  // scan flow with stubbed sample
  d.querySelector('nav.tabs button.add').click(); await tick(5);
  const input = d.querySelector('#photoInput');
  const file = new window.File(['abc'], 'label.jpg', { type: 'image/jpeg' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new window.Event('change', { bubbles: true })); await tick(30);
  assert(d.querySelector('#ff-name') && d.querySelector('#ff-name').value === 'Scanned Bar', '[db] scan filled the form from sample.json');
  assert(calls.length === 1 && calls[0].img && calls[0].tier === 'quick', '[db] sample.json called with an image on quick tier');
  assert(d.querySelector('#ff-conf').textContent.includes('high'), '[db] confidence shown');
  d.querySelector('[data-act="ff-save-add"]').click(); await tick(5);
  d.querySelector('[data-act="q-add"]').click(); await tick(30);
  assert(d.querySelectorAll('.entry').length === 2, '[db] scanned food logged');
  // describe flow
  d.querySelector('nav.tabs button.add').click(); await tick(5);
  d.querySelector('[data-act="describe"]').click(); await tick(5);
  d.querySelector('#d-text').value = 'chicken bowl'; d.querySelector('#d-where').value = 'Chipotle';
  d.querySelector('#d-portion button[data-v="0.5"]').click();
  d.querySelector('[data-act="d-go"]').click(); await tick(30);
  assert(d.querySelector('#ff-rest').value === 'Chipotle', '[db] describe form carries restaurant');
  d.querySelector('[data-act="ff-save-add"]').click(); await tick(5);
  assert(d.querySelector('#qtyInput').value === '0.5', '[db] half portion preselected');
  d.querySelector('[data-act="q-add"]').click(); await tick(30);
  assert(d.querySelectorAll('.entry').length === 3, '[db] described meal logged');
  // scan a supplement
  d.querySelector('nav.tabs button.add').click(); await tick(5);
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new window.Event('change', { bubbles: true })); await tick(30);
  assert(d.querySelector('#ff-name').value === 'Multivitamin', '[db] supplement scan filled form');
  assert(d.querySelector('#ff-kind button.on').dataset.v === 'supplement' && !d.querySelector('#ff-stack').hidden, '[db] scan detected supplement kind');
  assert(d.querySelector('#ff-instack button.on').dataset.v === '1', '[db] supplement defaults to in stack');
  assert(!d.querySelector('#ff-ext').hidden && d.querySelector('#n-zinc').value === '11', '[db] extra nutrients filled and shown');
  d.querySelector('[data-act="ff-save"]').click(); await tick(30);
  d.querySelector('nav.tabs button[data-tab="today"]').click(); await tick(5);
  const ss = Array.from(d.querySelectorAll('.slot')).find(s => s.querySelector('h2').textContent === 'Supplements');
  assert(ss && ss.querySelector('[data-act="log-stack"]'), '[db] Today offers Log stack after saving supplement');
  ss.querySelector('[data-act="log-stack"]').click(); await tick(30);
  const dayDoc = Object.entries(store).find(([k]) => k.startsWith('u/u_test/days/'))[1];
  assert(dayDoc.stackLogged === true && dayDoc.entries.some(e => e.slot === 'supplement' && e.kind === 'supplement'), '[db] day doc carries stack entries and flag');
  assert(d.querySelectorAll('.entry').length === 4, '[db] stack entry rendered');
  // front-of-package scan: fish oil recognized from memory, with omega-3 column and EPA/DHA extras
  d.querySelector('nav.tabs button.add').click(); await tick(5);
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new window.Event('change', { bubbles: true })); await tick(30);
  assert(d.querySelector('#ff-name').value === 'Ultimate Omega 2X', '[db] front scan identified the product');
  assert(d.querySelector('#ff-status').textContent.includes('from Claude') && d.querySelector('#ff-status').className.includes('warn'), '[db] front scan is flagged as from memory');
  assert(d.querySelector('#ff-conf').textContent.includes('medium') && d.querySelector('#ff-conf').textContent.includes('from memory'), '[db] recall confidence capped at medium');
  assert(d.querySelector('#n-omega3').value === '2150', '[db] omega-3 column filled');
  const xrows = d.querySelectorAll('#ff-extras .xrow'); assert(xrows.length === 2 && xrows[0].querySelector('.x-name').value === 'EPA' && xrows[0].querySelector('.x-v').value === '1125', '[db] EPA/DHA landed in other actives');
  d.querySelector('[data-act="ff-extra-add"]').click(); assert(d.querySelectorAll('#ff-extras .xrow').length === 3, '[db] can add an active row');
  d.querySelectorAll('[data-act="ff-extra-remove"]')[2].click(); assert(d.querySelectorAll('#ff-extras .xrow').length === 2, '[db] can remove an active row');
  d.querySelector('[data-act="ff-save-add"]').click(); await tick(5);
  assert(d.querySelector('#qtySlot button.on').dataset.v === 'supplement', '[db] supplement defaults to the Supplements slot');
  d.querySelector('[data-act="q-add"]').click(); await tick(30);
  const suppRows = Array.from(d.querySelectorAll('.entry')).filter(x => x.textContent.includes('Ultimate Omega'));
  assert(suppRows.length === 1 && suppRows[0].querySelector('.macros-mini').textContent.startsWith('Ω3 2,150mg'), '[db] entry shows omega-3 (' + (suppRows[0] && suppRows[0].querySelector('.macros-mini').textContent) + ')');
  if (!d.querySelector('.nf-row')) { d.querySelector('[data-act="toggle-full"]').click(); await tick(2); }
  const o3 = Array.from(d.querySelectorAll('.nf-row')).find(r => r.querySelector('.n').textContent.startsWith('Omega-3'));
  assert(o3 && o3.querySelector('.pct').textContent === '430%', '[db] omega-3 % of 500 mg target (' + (o3 && o3.querySelector('.pct').textContent) + ')');
  const epa = Array.from(d.querySelectorAll('.nf-row')).find(r => r.querySelector('.n').textContent === 'EPA');
  assert(epa && epa.querySelector('.v').textContent.startsWith('1,125 mg'), '[db] other actives section sums EPA');
  const saved = Object.values(store).find(v => v && v.name === 'Ultimate Omega 2X'); assert(saved && saved.basis === 'knowledge' && saved.extras.length === 2, '[db] food doc keeps basis and extras');
  // reset
  d.querySelector('nav.tabs button[data-tab="me"]').click(); await tick(5);
  d.querySelector('[data-act="reset"]').click(); await tick(5);
  d.querySelector('[data-act="confirm-yes"]').click(); await tick(40);
  assert(Object.keys(store).length === 0, '[db] reset deleted all docs');
  assert(d.querySelector('#onb-go'), '[db] back to onboarding after reset');
  assert(errors.length === 0, '[db] no script errors during db flow');
  window.close();
}

(async () => { try { await runLocal(); await runDb(); console.log('ALL PASSED'); } catch (e) { console.error('FAILED: ' + e.message); process.exit(1); } })();
