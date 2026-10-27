/* Workout sessions, sets, favorites (templates) and per-exercise history. Pure data; no DOM.
   session (kind 'workouts', id = date + '_' + random so a date range is an id range):
     { id, date, name, started, finished|null, templateId|null, note,
       items: [{ id, exId, name, type, sets: [{ w, r, s, m, d, done }], note }] }
   template (kind 'templates'): { id, name, items: [{ exId, name, type, sets: n }], count, last } */
import { S, hooks } from './state.js';
import { commit } from './store.js';
import { mkid, num, ymd } from './util.js';
import { findExercise, SET_FIELDS } from './exercises.js';
import { toast } from './ui.js';

const blankSet = () => ({ w: null, r: null, s: null, m: null, d: null, done: false });

export function dayWorkouts(dayKey) {
  return Object.values(S.workouts).filter(w => w && w.date === dayKey).sort((a, b) => (a.started || 0) - (b.started || 0));
}
export function recentWorkouts(n = 12, beforeDate) {
  return Object.values(S.workouts).filter(w => w && (!beforeDate || w.date < beforeDate)).sort((a, b) => (b.date + (b.started || 0)).localeCompare(a.date + (a.started || 0))).slice(0, n);
}

/* Debounced persistence: set inputs fire often. */
const timers = new Map();
export function saveWorkout(w, now) {
  w.updated = Date.now(); S.workouts[w.id] = w;
  if (now) { clearTimeout(timers.get(w.id)); timers.delete(w.id); commit('workouts', w.id, w); return; }
  clearTimeout(timers.get(w.id));
  timers.set(w.id, setTimeout(() => { timers.delete(w.id); commit('workouts', w.id, w); }, 500));
}
export function flushWorkoutSaves() { timers.forEach((t, id) => { clearTimeout(t); if (S.workouts[id]) commit('workouts', id, S.workouts[id]); }); timers.clear(); }
export function deleteWorkout(id) { clearTimeout(timers.get(id)); timers.delete(id); delete S.workouts[id]; commit('workouts', id, null); }

export function startWorkout(dayKey, opts = {}) {
  const w = { id: dayKey + '_' + mkid(), date: dayKey, name: opts.name || 'Workout', started: Date.now(), finished: null, templateId: opts.templateId || null, note: '', items: [] };
  (opts.items || []).forEach(it => addExercise(w, findExercise(it.exId) || { id: it.exId, name: it.name, type: it.type || 'weight' }, it.sets, it.prefill !== false));
  saveWorkout(w, true);
  return w;
}

/* Adds an exercise with `count` sets (default: last time's count or 3), pre-filled from the most recent session when asked. */
export function addExercise(w, ex, count, prefill = true) {
  const last = prefill ? lastPerformance(ex.id, w.date, w.id) : null;
  const n = count || (last ? last.sets.length : 3);
  const sets = [];
  for (let i = 0; i < n; i++) {
    const src = last && last.sets[Math.min(i, last.sets.length - 1)];
    sets.push(src ? Object.assign(blankSet(), { w: src.w, r: src.r, s: src.s, m: src.m, d: src.d }) : blankSet());
  }
  w.items.push({ id: mkid(), exId: ex.id, name: ex.name, type: ex.type || 'weight', sets, note: '' });
  saveWorkout(w);
  return w.items[w.items.length - 1];
}
export function removeExercise(w, ii) { w.items.splice(ii, 1); saveWorkout(w, true); }
export function addSet(w, ii) {
  const it = w.items[ii]; if (!it) return;
  const prev = it.sets[it.sets.length - 1];
  it.sets.push(prev ? Object.assign(blankSet(), { w: prev.w, r: prev.r, s: prev.s, m: prev.m, d: prev.d }) : blankSet());
  saveWorkout(w, true);
}
export function removeSet(w, ii, si) { const it = w.items[ii]; if (!it) return; it.sets.splice(si, 1); if (!it.sets.length) it.sets.push(blankSet()); saveWorkout(w, true); }
export function updateSet(w, ii, si, field, value) {
  const it = w.items[ii]; const st = it && it.sets[si]; if (!st) return;
  st[field] = value === '' || value === null || value === undefined ? null : Number(value);
  saveWorkout(w);
}
export function toggleDone(w, ii, si) {
  const it = w.items[ii]; const st = it && it.sets[si]; if (!st) return;
  st.done = !st.done;
  saveWorkout(w, true);
}
export function finishWorkout(w) { w.finished = Date.now(); w.items.forEach(it => it.sets.forEach(st => { if (setHasData(it.type, st)) st.done = true; })); saveWorkout(w, true); }
export function reopenWorkout(w) { w.finished = null; saveWorkout(w, true); }
export function renameWorkout(w, name) { w.name = String(name || 'Workout').trim().slice(0, 40) || 'Workout'; saveWorkout(w, true); }

export function setHasData(type, st) { return SET_FIELDS[type || 'weight'].some(f => st[f.k] !== null && st[f.k] !== undefined && st[f.k] !== ''); }

/* Most recent earlier session that includes this exercise, with its sets that have data. */
export function lastPerformance(exId, beforeDate, excludeId) {
  const list = Object.values(S.workouts).filter(w => w && w.id !== excludeId && (w.date < beforeDate || (w.date === beforeDate && w.id !== excludeId)));
  list.sort((a, b) => (b.date + (b.started || 0)).localeCompare(a.date + (a.started || 0)));
  for (const w of list) {
    const it = (w.items || []).find(x => x.exId === exId);
    if (it) { const sets = it.sets.filter(st => setHasData(it.type, st)); if (sets.length) return { date: w.date, sets, type: it.type }; }
  }
  return null;
}
export function setText(type, st) {
  const t = type || 'weight';
  if (t === 'time') return (num(st.s) ? num(st.s) + 's' : '–');
  if (t === 'cardio') return (num(st.m) ? num(st.m) + ' min' : '–') + (num(st.d) ? ' · ' + num(st.d) + ' mi' : '');
  const w = st.w === null || st.w === undefined ? null : num(st.w);
  return (w === null ? (t === 'bodyweight' ? 'BW' : '–') : (t === 'bodyweight' ? 'BW+' + w : w)) + '×' + (st.r === null || st.r === undefined ? '–' : num(st.r));
}
export function summary(w) {
  let sets = 0, volume = 0, exercises = 0;
  (w.items || []).forEach(it => { const done = it.sets.filter(st => setHasData(it.type, st)); if (done.length) exercises++; sets += done.length; if (it.type === 'weight' || it.type === 'bodyweight') done.forEach(st => { volume += num(st.w) * num(st.r); }); });
  const minutes = w.finished && w.started ? Math.max(1, Math.round((w.finished - w.started) / 60000)) : null;
  return { sets, volume, exercises, minutes };
}

/* Favorites */
export function saveTemplate(w, name) {
  const t = { id: mkid(), name: String(name || w.name || 'Workout').trim().slice(0, 40), items: (w.items || []).map(it => ({ exId: it.exId, name: it.name, type: it.type, sets: it.sets.length })), count: 0, last: null, created: Date.now() };
  S.templates[t.id] = t; commit('templates', t.id, t); return t;
}
export function deleteTemplate(id) { delete S.templates[id]; commit('templates', id, null); }
export function startFromTemplate(dayKey, t) {
  t.count = (t.count || 0) + 1; t.last = Date.now(); commit('templates', t.id, t);
  return startWorkout(dayKey, { name: t.name, templateId: t.id, items: t.items.map(it => ({ exId: it.exId, name: it.name, type: it.type, sets: it.sets })) });
}
export function repeatLast(dayKey) {
  const prev = recentWorkouts(1, dayKey)[0]; if (!prev) { toast('No earlier workout to repeat'); return null; }
  return startWorkout(dayKey, { name: prev.name, items: (prev.items || []).map(it => ({ exId: it.exId, name: it.name, type: it.type, sets: it.sets.length })) });
}
export function addCustomExercise(name, group, type) {
  const ex = { id: 'c_' + mkid(), name: String(name).trim().slice(0, 40), group: group || 'Other', type: type || 'weight', created: Date.now() };
  S.exercises[ex.id] = ex; commit('exercises', ex.id, ex); hooks.render(); return ex;
}
