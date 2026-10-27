/* The profile form (shared by onboarding and the Me tab), the onboarding screen, and the Me tab. */
import { S, ACTIVITY, VERSION } from './state.js';
import { $, esc, fmt, fmtQty, numOrNull } from './util.js';
import { NUTR } from './nutrients.js';
import { calcTargets, profileComplete, activeTargets } from './targets.js';
import { stackFoods } from './foods.js';
import { aiAvailable, API, isStandalone } from './backend.js';
import { outboxSize } from './store.js';

export function profileFormHtml(p) {
  const sel = (v) => Number(p.activity || 1.375) === v ? 'selected' : '';
  const ft = Number(p.heightFt) || null, inch = (p.heightIn === null || p.heightIn === undefined || p.heightIn === '') ? null : Number(p.heightIn);
  const ftOpts = '<option value="" disabled ' + (ft ? '' : 'selected') + '>ft</option>' + [4, 5, 6, 7].map(v => '<option value="' + v + '" ' + (ft === v ? 'selected' : '') + '>' + v + ' ft</option>').join('');
  const inOpts = '<option value="" disabled ' + (inch === null ? 'selected' : '') + '>in</option>' + Array.from({ length: 12 }, (_, v) => '<option value="' + v + '" ' + (inch === v ? 'selected' : '') + '>' + v + ' in</option>').join('');
  return '<div class="stack">'
    + '<div class="field"><label>Sex</label><div class="seg" id="f-sex"><button type="button" data-v="m" class="' + (p.sex !== 'f' ? 'on' : '') + '">Male</button><button type="button" data-v="f" class="' + (p.sex === 'f' ? 'on' : '') + '">Female</button></div></div>'
    + '<div class="grid2"><div class="field"><label>Age</label><input id="f-age" type="number" inputmode="numeric" min="13" max="100" value="' + esc(p.age ?? '') + '"></div>'
    + '<div class="field"><label>Weight</label><div class="unitwrap"><input id="f-wt" type="number" inputmode="decimal" min="60" max="600" step="0.1" value="' + esc(p.weightLb ?? '') + '"><span class="unit">lb</span></div></div></div>'
    + '<div class="field"><label>Height</label><div class="grid2"><select id="f-hft" aria-label="Feet">' + ftOpts + '</select><select id="f-hin" aria-label="Inches">' + inOpts + '</select></div></div>'
    + '<div class="field"><label>Body fat (optional)</label><div class="unitwrap"><input id="f-bf" type="number" inputmode="decimal" min="3" max="60" step="0.5" value="' + esc(p.bodyFat ?? '') + '" placeholder="Your best guess"><span class="unit">%</span></div><span class="hint">With a body fat estimate, calories use lean mass (Katch-McArdle) and protein is set per pound of lean mass.</span></div>'
    + '<div class="field"><label>Activity</label><select id="f-act">' + ACTIVITY.map(a => '<option value="' + a.v + '" ' + sel(a.v) + '>' + a.label + '</option>').join('') + '</select></div>'
    + '<div class="field"><label>Goal</label><div class="seg" id="f-goal"><button type="button" data-v="lose" class="' + (p.goal === 'lose' ? 'on' : '') + '">Lose fat</button><button type="button" data-v="maintain" class="' + (!p.goal || p.goal === 'maintain' ? 'on' : '') + '">Maintain</button><button type="button" data-v="gain" class="' + (p.goal === 'gain' ? 'on' : '') + '">Gain</button></div></div>'
    + '<div class="field" id="f-rate-wrap" ' + (p.goal === 'lose' || p.goal === 'gain' ? '' : 'hidden') + '><label>Pace</label><div class="seg" id="f-rate">' + rateButtons(p) + '</div></div>'
    + '</div>';
}
export function rateButtons(p) {
  const opts = p.goal === 'gain' ? [0.25, 0.5, 1] : [0.5, 1, 1.5, 2];
  const cur = Number(p.rate) || (p.goal === 'gain' ? 0.5 : 1);
  return opts.map(r => '<button type="button" data-v="' + r + '" class="' + (cur === r ? 'on' : '') + '">' + r + ' lb/wk</button>').join('');
}
export function readProfileForm(root, base) {
  const p = Object.assign({}, base || {});
  const sexBtn = $('#f-sex .on', root); p.sex = sexBtn ? sexBtn.dataset.v : 'm';
  p.age = numOrNull($('#f-age', root).value); p.heightFt = numOrNull($('#f-hft', root).value); p.heightIn = numOrNull($('#f-hin', root).value) || 0;
  p.weightLb = numOrNull($('#f-wt', root).value); p.bodyFat = numOrNull($('#f-bf', root).value);
  p.activity = Number($('#f-act', root).value);
  const goalBtn = $('#f-goal .on', root); p.goal = goalBtn ? goalBtn.dataset.v : 'maintain';
  const rb = $('#f-rate .on', root); p.rate = rb ? Number(rb.dataset.v) : (p.goal === 'gain' ? 0.5 : 1);
  return p;
}
/* Called whenever a profile form (onboarding or Me) changes; the listeners live on #main once, see main.js. */
export function profileFormUpdate(root) {
  if (!$('#f-age', root)) return;
  const onboarding = !S.profile;
  const p = readProfileForm(root, onboarding ? S.profileDraft : S.profile);
  if (onboarding) S.profileDraft = p;
  const prev = $('#targets-preview', root); if (prev) prev.innerHTML = targetsPreviewHtml(p);
  const go = $('#onb-go', root); if (go) go.disabled = !profileComplete(p);
}
export function profileGoalChanged(root) {
  const goalBtn = $('#f-goal .on', root); const goal = goalBtn ? goalBtn.dataset.v : 'maintain';
  const wrap = $('#f-rate-wrap', root); if (!wrap) return;
  wrap.hidden = !(goal === 'lose' || goal === 'gain'); $('#f-rate', root).innerHTML = rateButtons({ goal });
}
export function targetsPreviewHtml(p) {
  if (!profileComplete(p)) return '<div class="targets-preview"><div class="tp-h">Your daily targets</div><div class="muted small" style="padding-top:8px">Fill in age, height and weight to see them.</div></div>';
  const T = calcTargets(p);
  return '<div class="targets-preview"><div class="tp-h">Your daily targets</div>'
    + '<div class="tp-row"><span>Calories</span><b class="num">' + fmt(T.kcal) + '</b></div>'
    + '<div class="tp-row"><span>Protein</span><b class="num">' + fmt(T.protein) + ' g</b></div>'
    + '<div class="tp-row"><span>Carbs</span><b class="num">' + fmt(T.carbs) + ' g</b></div>'
    + '<div class="tp-row"><span>Fat</span><b class="num">' + fmt(T.fat) + ' g</b></div>'
    + '<div class="tp-row"><span class="muted">Maintenance</span><span class="muted num">' + fmt(T.tdee) + ' cal (BMR ' + fmt(T.bmr) + ')</span></div></div>';
}
export function onboardingHtml(p) {
  return '<div class="onb-hero"><h2>Your numbers, your food.</h2><p>Enter your stats once. Macro Ledger sets daily calorie and macro targets; you log against them by scanning labels, describing meals, or tapping favorites.</p></div>'
    + '<div class="card">' + profileFormHtml(p) + '</div><div id="targets-preview">' + targetsPreviewHtml(p) + '</div>'
    + '<button class="btn primary block" id="onb-go" data-act="onb-save" disabled>Start tracking</button>'
    + '<p class="small muted">Targets use Mifflin-St Jeor (or Katch-McArdle with body fat), an activity multiplier, and about 500 calories per pound per week of change. You can override any number later in Me.</p>';
}
export function meHtml() {
  const p = S.profile; const T = activeTargets();
  const pend = outboxSize();
  const storage = S.mode === 'db' ? 'Saved to your Claude account' : S.mode === 'api' ? (API.online ? 'Synced to your server' + (pend ? ' (' + pend + ' pending)' : '') : 'Offline, ' + pend + ' change' + (pend === 1 ? '' : 's') + ' waiting to sync') : S.mode === 'pending' ? 'Connecting…' : 'Saved on this device only';
  const aiLine = S.ai.sample ? ('Label scanning (Nutrition Facts and Supplement Facts) and meal estimates run on your Claude account' + (S.ai.images ? '.' : ' (photos not available in this view).')) : aiAvailable() ? 'Label scanning and meal estimates run through your own server and API key.' : isStandalone() ? 'Connect this device (Me → Data) to scan labels and estimate meals.' : 'Open this page inside Claude to scan labels and estimate meals.';
  const stack = stackFoods();
  let h = '<section class="stack"><div class="sec-h"><h2>Stats and goal</h2></div><div class="card">' + profileFormHtml(p) + '</div><div id="targets-preview">' + targetsPreviewHtml(p) + '</div>'
    + '<div class="btnrow"><button class="btn primary" data-act="me-save">Save and recalculate</button></div>'
    + (p.custom ? '<div class="note warn">You are using custom targets. Saving here replaces them with recalculated ones.</div>' : '') + '</section>';
  h += '<section class="stack"><div class="sec-h"><h2>Targets in use</h2><button class="link" data-act="edit-targets">Edit</button></div><div class="card" style="padding-block:4px">';
  NUTR.forEach(m => { if (m.noTarget) return; h += '<div class="kv"><span class="k">' + m.label + (m.max ? ' (max)' : '') + '</span><span class="v num">' + fmt(T[m.k], m.dp) + (m.unit ? ' ' + m.unit : '') + '</span></div>'; });
  h += '</div></section>';
  h += '<section class="stack"><div class="sec-h"><h2>Scanning</h2></div><div class="card" style="padding-block:4px">'
    + '<div class="toggle"><div><div style="font-weight:600">Careful mode</div><div class="small muted">Slower, more thorough label reading. Off means fast.</div></div><button class="sw ' + (p.careful ? 'on' : '') + '" data-act="toggle-careful" role="switch" aria-checked="' + (p.careful ? 'true' : 'false') + '" aria-label="Careful mode"></button></div></div>'
    + '<p class="hint">' + esc(aiLine) + '</p></section>';
  h += '<section class="stack"><div class="sec-h"><h2>Supplements</h2><button class="link" data-act="foods-supp">Manage</button></div><div class="card" style="padding-block:4px">'
    + '<div class="toggle"><div><div style="font-weight:600">Log my stack automatically</div><div class="small muted">Adds your daily stack to Today the first time you open the app each day.</div></div><button class="sw ' + (p.autoStack ? 'on' : '') + '" data-act="toggle-autostack" role="switch" aria-checked="' + (p.autoStack ? 'true' : 'false') + '" aria-label="Log stack automatically"></button></div>'
    + (stack.length ? stack.map(f => '<div class="kv"><span class="k">' + esc(f.name) + '</span><span class="v num">' + fmtQty(f.stackQty) + ' × ' + esc(f.servingLabel || 'serving') + '</span></div>').join('') : '<div class="kv"><span class="k muted">No stack yet. Scan a Supplement Facts label and mark it "In daily stack".</span></div>')
    + '</div></section>';
  h += '<section class="stack"><div class="sec-h"><h2>Data</h2><span class="meta">build ' + esc(VERSION) + '</span></div><div class="card" style="padding-block:4px"><div class="kv"><span class="k">Storage</span><span class="v">' + esc(storage) + '</span></div>'
    + '<div class="kv"><span class="k">Foods / meals / days</span><span class="v num">' + Object.keys(S.foods).length + ' / ' + Object.keys(S.meals).length + ' / ' + Object.keys(S.days).length + '</span></div>'
    + (isStandalone() ? '<div class="kv"><span class="k">Device key</span><span class="v">' + (API.key ? '<button class="link" data-act="disconnect">Disconnect</button>' : '<button class="link" data-act="connect">Connect</button>') + '</span></div>' : '') + '</div>'
    + '<div class="btnrow"><button class="btn" data-act="export">Copy backup</button><button class="btn" data-act="import">Import backup</button></div>'
    + '<div class="btnrow"><button class="btn danger" data-act="reset">Reset everything</button></div></section>';
  return h;
}
