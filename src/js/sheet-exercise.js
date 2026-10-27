/* The exercise picker: search, muscle-group chips, built-ins plus custom, and "add your own". */
import { $, esc } from './util.js';
import { S } from './state.js';
import { EX_GROUPS, searchExercises, allExercises } from './exercises.js';
import { openSheet, sheetFrame, topSheetNamed } from './ui.js';
import { lastPerformance, setText } from './workouts.js';

export function openExercisePicker(workoutId) {
  S.exQuery = ''; S.exGroup = 'All';
  const body = '<div class="sheet-top"><input class="search" id="exSearch" type="search" placeholder="Search exercises" autocomplete="off">'
    + '<div class="chips" id="exChips"></div></div>'
    + '<div class="list card" id="exList"></div>'
    + '<div><button class="link" data-act="ex-custom">+ Add an exercise of your own</button></div>';
  const el = openSheet(sheetFrame('Add exercise', body), { name: 'expick' });
  el._workoutId = workoutId;
  $('#exSearch', el).addEventListener('input', e => { S.exQuery = e.target.value; renderExerciseList(); });
  renderExerciseList();
}

export function renderExerciseList() {
  const el = topSheetNamed('expick'); if (!el) return;
  const groups = ['All'].concat(EX_GROUPS);
  if (allExercises().some(e => !e.builtin)) groups.push('Mine');
  $('#exChips', el).innerHTML = groups.map(g => '<button class="chip ' + (S.exGroup === g ? 'on' : '') + '" data-act="ex-group" data-g="' + g + '">' + g + '</button>').join('');
  let list = S.exGroup === 'Mine' ? allExercises().filter(e => !e.builtin && (!S.exQuery || e.name.toLowerCase().includes(S.exQuery.toLowerCase()))) : searchExercises(S.exQuery, S.exGroup);
  const w = S.workouts[el._workoutId]; const date = w ? w.date : S.dayKey;
  $('#exList', el).innerHTML = list.length ? list.map(e => {
    const last = lastPerformance(e.id, date, el._workoutId);
    const sub = last ? 'Last: ' + last.sets.map(st => setText(last.type, st)).join(', ') : e.group;
    return '<button class="row" data-act="ex-pick" data-id="' + esc(e.id) + '"><div class="main"><div class="title">' + esc(e.name) + '</div><div class="sub">' + esc(sub) + '</div></div></button>';
  }).join('') : '<div class="empty">No match. Add it as your own below.</div>';
}

export function openCustomExercise() {
  const body = '<div class="field"><label>Name</label><input id="cx-name" type="text" placeholder="e.g. Pendlay Row"></div>'
    + '<div class="grid2"><div class="field"><label>Muscle group</label><select id="cx-group">' + EX_GROUPS.concat(['Other']).map(g => '<option>' + g + '</option>').join('') + '</select></div>'
    + '<div class="field"><label>Logs as</label><select id="cx-type"><option value="weight">Weight × reps</option><option value="bodyweight">Bodyweight (+lb) × reps</option><option value="time">Seconds</option><option value="cardio">Minutes and miles</option></select></div></div>';
  openSheet(sheetFrame('Your exercise', body, '<button class="btn primary" data-act="ex-custom-save">Add</button>'), { name: 'excustom' });
  setTimeout(() => { const i = $('#cx-name'); if (i) i.focus(); }, 60);
}
