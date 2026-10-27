/* Persistence. Two layers: a localStorage mirror (always on, so the app opens instantly and
   works signed out) and the artifact `db` capability (durable, follows the account).
   All writes go through commit(kind, id, data); kind is 'profile' | 'foods' | 'meals' | 'days'.
   Document layout under the user's root doc u/<uid>:
     u/<uid>                 profile (stats, goal, targets, settings)
     u/<uid>/foods/<id>      one food or supplement
     u/<uid>/meals/<id>      one saved meal (bundle of foodIds + qty)
     u/<uid>/days/<yyyy-mm-dd>  one logged day: { date, entries[], stackLogged } */
import { KEY, S, hooks, COLLECTIONS } from './state.js';
import { ymd, addDays, clone } from './util.js';
import { toast } from './ui.js';
import { API, apiGetState, apiPutDocs, clearKey } from './backend.js';

export const LS = {
  get() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } },
  set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* storage may be unavailable */ } },
  clear() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } },
};
export function persistLocal() { const o = { profile: S.profile, tab: S.tab, savedAt: Date.now() }; COLLECTIONS.forEach(k => { o[k] = S[k]; }); LS.set(o); }

/* One write in flight per document path; later writes to the same doc queue behind it. */
const writeQ = new Map();
function chain(path, fn) {
  const prev = writeQ.get(path) || Promise.resolve();
  const p = prev.catch(() => {}).then(fn);
  writeQ.set(path, p);
  p.catch(e => { toast('Could not save (' + (e && e.code ? e.code : 'error') + ')'); });
  return p;
}
const stripUndefined = o => JSON.parse(JSON.stringify(o));

export function commit(kind, id, data) {
  persistLocal();
  if (S.mode === 'pending') { S.pending.push([kind, id, data]); return; }
  if (S.mode === 'api') { enqueue(kind, id, data); return; }
  if (S.mode !== 'db') return;
  const ref = kind === 'profile' ? S.base : S.base.collection(kind).doc(id);
  if (data === null) chain(ref.path, () => ref.delete());
  else chain(ref.path, () => ref.set(stripUndefined(data)));
}
export function flushPending() { const p = S.pending; S.pending = []; p.forEach(([k, id, d]) => commit(k, id, d)); }

/* ---- API mode: write-through with an offline outbox ---- */
const OUTBOX_LS = 'macroledger.outbox';
let outbox = [];
let flushTimer = null, flushing = false;
function loadOutbox() { try { outbox = JSON.parse(localStorage.getItem(OUTBOX_LS) || '[]'); } catch (e) { outbox = []; } if (!Array.isArray(outbox)) outbox = []; }
function saveOutbox() { try { localStorage.setItem(OUTBOX_LS, JSON.stringify(outbox)); } catch (e) { /* ignore */ } }
function enqueue(kind, id, data) {
  const key = kind + '/' + (kind === 'profile' ? 'me' : id);
  outbox = outbox.filter(o => o.key !== key);                 /* only the latest write per doc matters */
  outbox.push({ key, kind, id: kind === 'profile' ? 'me' : id, data: data === null ? null : stripUndefined(data), updated: Date.now() });
  saveOutbox(); scheduleFlush(150);
}
function scheduleFlush(ms) { clearTimeout(flushTimer); flushTimer = setTimeout(flushOutbox, ms); }
export async function flushOutbox() {
  if (flushing || !outbox.length || S.mode !== 'api') return;
  flushing = true; const batch = outbox.slice(0, 200);
  try {
    await apiPutDocs(batch.map(o => ({ kind: o.kind, id: o.id, data: o.data, updated: o.updated })));
    const sent = new Set(batch.map(o => o.key + '@' + o.updated));
    outbox = outbox.filter(o => !sent.has(o.key + '@' + o.updated)); saveOutbox();
    API.lastSync = Date.now();
    if (outbox.length) scheduleFlush(50);
  } catch (e) {
    if (e && e.code === 'unauthorized') { toast('Device key no longer valid'); }
    else scheduleFlush(15000);                                   /* offline or server hiccup: retry later */
  } finally { flushing = false; }
}
export const outboxSize = () => outbox.length;

function applyState(st) {
  S.profile = st.profile || null;
  COLLECTIONS.forEach(k => {
    const incoming = st[k] || {};
    if (k === 'days' || k === 'workouts') { const keep = {}; Object.keys(S[k]).forEach(id => { if (!incoming[id]) keep[id] = S[k][id]; }); S[k] = Object.assign(keep, incoming); }
    else S[k] = incoming;
    Object.keys(S[k]).forEach(id => { if (S[k][id] && typeof S[k][id] === 'object' && !S[k][id].id) S[k][id].id = id; });
  });
  persistLocal();
}

/* Connect to the Worker API with the stored device key. Resolves 'ok', 'unauthorized' or 'offline'. */
export async function connectApi() {
  loadOutbox();
  let st;
  try { st = await apiGetState(); }
  catch (e) {
    if (e && e.code === 'unauthorized') { clearKey(); S.mode = 'local'; S.daysLoaded = true; flushPending(); return 'unauthorized'; }
    S.mode = 'api'; S.daysLoaded = true; flushPending(); return 'offline';   /* keep working from the mirror; outbox syncs later */
  }
  S.mode = 'api';
  const serverEmpty = !st.profile && !Object.keys(st.foods || {}).length && !Object.keys(st.days || {}).length;
  const localHasData = !!(S.localBoot && (S.localBoot.profile || Object.keys(S.localBoot.foods || {}).length));
  if (serverEmpty && localHasData && !outbox.length) {
    /* first connect from a device that already has data: push it up */
    if (S.profile) enqueue('profile', null, S.profile);
    COLLECTIONS.forEach(k => Object.keys(S[k]).forEach(id => enqueue(k, id, S[k][id])));
    toast('Moved this phone\'s log to your account');
  } else if (!outbox.length) {
    applyState(st);
  } else {
    applyState(st); /* queued local writes replay on top */
  }
  S.daysLoaded = true; flushPending(); API.lastSync = Date.now();
  scheduleFlush(100);
  return 'ok';
}

/* Pull the latest state when the app comes back to the foreground. */
export async function refreshFromApi() {
  if (S.mode !== 'api') return;
  await flushOutbox();
  if (outbox.length) return;
  try { const st = await apiGetState(); applyState(st); API.lastSync = Date.now(); hooks.render(); } catch (e) { /* offline */ }
}

/* Load the localStorage mirror into S before anything renders. */
export function bootLocal() {
  const local = LS.get();
  if (!(local && typeof local === 'object')) return;
  S.localBoot = local;
  S.profile = local.profile || null; COLLECTIONS.forEach(k => { S[k] = (local[k] && typeof local[k] === 'object') ? local[k] : {}; });
  if (local.tab && local.tab !== 'me' && local.tab !== 'meals') S.tab = local.tab;
}

/* Decide the storage mode once the artifact runtime has answered. */
export function connectStore(db, uid) {
  if (db && uid) {
    S.mode = 'db'; S.uid = uid;
    try { S.base = db.doc('u/' + uid); subscribeDb(); flushPending(); }
    catch (e) { S.mode = 'local'; S.daysLoaded = true; flushPending(); }
  } else { S.mode = 'local'; S.daysLoaded = true; flushPending(); }
}

function subscribeDb() {
  const base = S.base;
  const onErr = e => { if (e && e.code === 'revoked') { S.mode = 'local'; toast('Lost connection to your account; saving on this device'); } };
  base.onSnapshot(snap => {
    if (!snap.exists && snap.metadata.fromCache) return;
    if (snap.exists) { S.profile = clone(snap.data()); }
    else if (!S.migrated && S.localBoot && S.localBoot.profile) { migrateLocal(); }
    else { S.profile = null; }
    persistLocal(); hooks.render();
  }, onErr);
  ['foods', 'meals', 'templates', 'exercises'].forEach(kind => {
    base.collection(kind).onSnapshot(qs => {
      if (qs.metadata.fromCache && qs.empty && Object.keys(S[kind]).length) return;
      const m = {}; qs.docs.forEach(d => { m[d.id] = Object.assign(clone(d.data()), { id: d.id }); });
      S[kind] = m; persistLocal(); hooks.render(); hooks.refreshOpenLists();
    }, onErr);
  });
  const cutoff = ymd(addDays(new Date(), -60));
  ['days', 'workouts'].forEach(kind => {
    base.collection(kind).where('date', '>=', cutoff).onSnapshot(qs => {
      if (qs.metadata.fromCache && qs.empty && Object.keys(S[kind]).length) return;
      const keep = {}; Object.keys(S[kind]).forEach(k => { if (k < cutoff) keep[k] = S[kind][k]; });
      qs.docs.forEach(d => { keep[d.id] = Object.assign(clone(d.data()), { id: d.id }); });
      S[kind] = keep; if (kind === 'days' && !qs.metadata.fromCache) S.daysLoaded = true; persistLocal(); hooks.render();
    }, onErr);
  });
}

/* First sign-in on a device that already has local data: push it up once. */
function migrateLocal() {
  S.migrated = true;
  const L = S.localBoot;
  S.profile = L.profile; COLLECTIONS.forEach(k => { S[k] = L[k] || {}; });
  commit('profile', null, S.profile);
  COLLECTIONS.forEach(k => Object.keys(S[k]).forEach(id => commit(k, id, S[k][id])));
  toast('Moved your local log into your account');
}

/* Days older than the subscribed window load on demand when the user navigates to them. */
export async function loadDay(key) {
  if (S.days[key]) return;
  if (S.mode === 'db') {
    try { const snap = await S.base.collection('days').doc(key).get(); if (snap.exists) { S.days[key] = clone(snap.data()); persistLocal(); hooks.render(); } } catch (e) { /* ignore */ }
  } else if (S.mode === 'api') {
    try { const st = await apiGetState(400); if (st.days && st.days[key]) { S.days[key] = st.days[key]; } Object.keys(st.workouts || {}).forEach(id => { if (id.startsWith(key)) S.workouts[id] = st.workouts[id]; }); persistLocal(); hooks.render(); } catch (e) { /* offline */ }
  }
}

/* Import a backup (the JSON from "Copy backup"): merges and writes everything through commit. */
export function importBackup(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('Not a backup');
  let n = 0;
  if (obj.profile && typeof obj.profile === 'object') { S.profile = obj.profile; commit('profile', null, S.profile); n++; }
  COLLECTIONS.forEach(k => Object.keys(obj[k] || {}).forEach(id => { const d = obj[k][id]; if (d && typeof d === 'object') { S[k][id] = Object.assign({ id }, d, k === 'days' ? { date: d.date || id } : {}); commit(k, id, S[k][id]); n++; } }));
  return n;
}
