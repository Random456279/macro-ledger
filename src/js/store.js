/* Persistence. Two layers: a localStorage mirror (always on, so the app opens instantly and
   works signed out) and the artifact `db` capability (durable, follows the account).
   All writes go through commit(kind, id, data); kind is 'profile' | 'foods' | 'meals' | 'days'.
   Document layout under the user's root doc u/<uid>:
     u/<uid>                 profile (stats, goal, targets, settings)
     u/<uid>/foods/<id>      one food or supplement
     u/<uid>/meals/<id>      one saved meal (bundle of foodIds + qty)
     u/<uid>/days/<yyyy-mm-dd>  one logged day: { date, entries[], stackLogged } */
import { KEY, S, hooks } from './state.js';
import { ymd, addDays, clone } from './util.js';
import { toast } from './ui.js';

export const LS = {
  get() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } },
  set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* storage may be unavailable */ } },
  clear() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } },
};
export function persistLocal() { LS.set({ profile: S.profile, foods: S.foods, meals: S.meals, days: S.days, tab: S.tab, savedAt: Date.now() }); }

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
  if (S.mode !== 'db') return;
  const ref = kind === 'profile' ? S.base : S.base.collection(kind).doc(id);
  if (data === null) chain(ref.path, () => ref.delete());
  else chain(ref.path, () => ref.set(stripUndefined(data)));
}
export function flushPending() { const p = S.pending; S.pending = []; p.forEach(([k, id, d]) => commit(k, id, d)); }

/* Load the localStorage mirror into S before anything renders. */
export function bootLocal() {
  const local = LS.get();
  if (!(local && typeof local === 'object')) return;
  S.localBoot = local;
  S.profile = local.profile || null; S.foods = local.foods || {}; S.meals = local.meals || {}; S.days = local.days || {};
  if (local.tab && local.tab !== 'me') S.tab = local.tab;
}

/* Decide the storage mode once the runtime has answered. */
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
  base.collection('foods').onSnapshot(qs => {
    if (qs.metadata.fromCache && qs.empty && Object.keys(S.foods).length) return;
    const f = {}; qs.docs.forEach(d => { f[d.id] = Object.assign(clone(d.data()), { id: d.id }); });
    S.foods = f; persistLocal(); hooks.render(); hooks.refreshOpenLists();
  }, onErr);
  base.collection('meals').onSnapshot(qs => {
    if (qs.metadata.fromCache && qs.empty && Object.keys(S.meals).length) return;
    const m = {}; qs.docs.forEach(d => { m[d.id] = Object.assign(clone(d.data()), { id: d.id }); });
    S.meals = m; persistLocal(); hooks.render(); hooks.refreshOpenLists();
  }, onErr);
  const cutoff = ymd(addDays(new Date(), -60));
  base.collection('days').where('date', '>=', cutoff).onSnapshot(qs => {
    if (qs.metadata.fromCache && qs.empty && Object.keys(S.days).length) return;
    const keep = {}; Object.keys(S.days).forEach(k => { if (k < cutoff) keep[k] = S.days[k]; });
    qs.docs.forEach(d => { keep[d.id] = clone(d.data()); });
    S.days = keep; if (!qs.metadata.fromCache) S.daysLoaded = true; persistLocal(); hooks.render();
  }, onErr);
}

/* First sign-in on a device that already has local data: push it up once. */
function migrateLocal() {
  S.migrated = true;
  const L = S.localBoot;
  S.profile = L.profile; S.foods = L.foods || {}; S.meals = L.meals || {}; S.days = L.days || {};
  commit('profile', null, S.profile);
  Object.values(S.foods).forEach(f => commit('foods', f.id, f));
  Object.values(S.meals).forEach(m => commit('meals', m.id, m));
  Object.keys(S.days).forEach(k => commit('days', k, S.days[k]));
  toast('Moved your local log into your account');
}

/* Days older than the 60-day window load on demand when the user navigates to them. */
export async function loadDay(key) {
  if (S.days[key] || S.mode !== 'db') return;
  try { const snap = await S.base.collection('days').doc(key).get(); if (snap.exists) { S.days[key] = clone(snap.data()); persistLocal(); hooks.render(); } } catch (e) { /* ignore */ }
}
