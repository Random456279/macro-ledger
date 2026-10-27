/* The Workout tab: the selected day's session (sets you can type into), favorites to start from, and history. */
import { S } from './state.js';
import { esc, fmt, num, niceDate, shortDate, ymd } from './util.js';
import { SET_FIELDS } from './exercises.js';
import { dayWorkouts, recentWorkouts, lastPerformance, setText, summary, setHasData } from './workouts.js';

const DOTS = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';
const CHECK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>';
const X = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

export function workoutHtml() {
  const key = S.dayKey; const sessions = dayWorkouts(key); const isToday = key === ymd(new Date());
  let h = '';
  if (!sessions.length) h += startHtml(key, isToday);
  sessions.forEach(w => { h += sessionHtml(w); });
  if (sessions.length) h += '<div><button class="btn block ghost" data-act="w-start-blank">Add another session</button></div>';
  h += historyHtml(key);
  return h;
}

function startHtml(key, isToday) {
  const temps = Object.values(S.templates).sort((a, b) => (b.count || 0) - (a.count || 0) || String(a.name).localeCompare(String(b.name)));
  const last = recentWorkouts(1, key)[0];
  let h = '<section class="card"><div class="kcal-word">' + (isToday ? 'Today' : esc(niceDate(key))) + '</div><div style="font-size:22px;font-weight:500;letter-spacing:-.02em;margin:6px 0 14px">No workout logged</div>';
  if (temps.length) {
    h += '<div class="label" style="margin-bottom:8px">Start a favorite</div><div class="list" style="margin-bottom:12px">' + temps.map(t => '<button class="row" data-act="w-start-template" data-id="' + esc(t.id) + '"><div class="main"><div class="title">' + esc(t.name) + '</div><div class="sub">' + t.items.map(i => i.name).join(', ') + '</div></div></button>').join('') + '</div>';
  }
  h += '<div class="btnrow">' + (last ? '<button class="btn" data-act="w-repeat-last">Repeat last (' + esc(last.name) + ')</button>' : '') + '<button class="btn primary" data-act="w-start-blank">Start blank</button></div>';
  if (!temps.length) h += '<p class="hint" style="margin-top:12px">Finish a session, then use its ··· menu to save it as a favorite. Favorites start pre-filled with your last weights and reps.</p>';
  return h + '</section>';
}

function sessionHtml(w) {
  const sm = summary(w); const done = !!w.finished;
  let h = '<section class="card wk" data-w="' + esc(w.id) + '"><div class="slot-h" style="padding:0 0 6px">'
    + '<button class="link" style="font-size:20px;font-weight:500;color:var(--ink);letter-spacing:-.02em;text-align:left" data-act="w-rename">' + esc(w.name) + '</button>'
    + '<div class="acts"><button class="iconbtn" data-act="w-more" aria-label="Workout menu">' + DOTS + '</button></div></div>'
    + '<div class="small muted num" style="margin-bottom:10px">' + (done ? 'Done · ' + (sm.minutes ? sm.minutes + ' min · ' : '') : 'In progress · ') + sm.sets + ' set' + (sm.sets === 1 ? '' : 's') + (sm.volume ? ' · ' + fmt(sm.volume) + ' lb moved' : '') + '</div>';
  if (!w.items.length) h += '<div class="empty" style="padding:14px 0">No exercises yet. Tap + Add exercise.</div>';
  h += '<div class="exs">'; w.items.forEach((it, ii) => { h += exerciseHtml(w, it, ii, done); }); h += '</div>';
  h += '<div class="btnrow" style="margin-top:12px"><button class="btn" data-act="w-add-exercise">+ Add exercise</button>' + (done ? '<button class="btn ghost" data-act="w-reopen">Reopen</button>' : '<button class="btn primary" data-act="w-finish">Finish</button>') + '</div>';
  return h + '</section>';
}

function exerciseHtml(w, it, ii, done) {
  const fields = SET_FIELDS[it.type || 'weight'];
  const last = lastPerformance(it.exId, w.date, w.id);
  let h = '<div class="ex"><div class="ex-h"><div class="main"><div class="title">' + esc(it.name) + '</div>'
    + (last ? '<div class="sub num">Last ' + esc(shortDate(last.date)) + ' · ' + esc(last.sets.map(st => setText(last.type, st)).join(', ')) + '</div>' : '') + '</div>'
    + '<button class="iconbtn" data-act="w-remove-ex" data-ii="' + ii + '" aria-label="Remove exercise">' + X + '</button></div>';
  h += '<div class="sets"><div class="set head"><span>Set</span>' + fields.map(f => '<span>' + f.label + '</span>').join('') + '<span></span></div>';
  it.sets.forEach((st, si) => {
    h += '<div class="set ' + (st.done ? 'done' : '') + '"><span class="n num">' + (si + 1) + '</span>'
      + fields.map(f => '<input class="num" type="number" inputmode="decimal" step="' + f.step + '" min="0" data-w="' + esc(w.id) + '" data-ii="' + ii + '" data-si="' + si + '" data-f="' + f.k + '" value="' + (st[f.k] === null || st[f.k] === undefined ? '' : esc(st[f.k])) + '" placeholder="–" aria-label="' + f.label + '" ' + (done ? 'readonly' : '') + '>').join('')
      + '<button class="done-btn ' + (st.done ? 'on' : '') + '" data-act="w-set-done" data-ii="' + ii + '" data-si="' + si + '" aria-label="Mark set done">' + CHECK + '</button></div>';
  });
  h += '</div>';
  if (!done) h += '<div class="ex-f"><button class="link" data-act="w-add-set" data-ii="' + ii + '">+ Add set</button>' + (it.sets.length > 1 ? '<button class="link muted" data-act="w-remove-set" data-ii="' + ii + '" data-si="' + (it.sets.length - 1) + '">Remove last</button>' : '') + '</div>';
  return h + '</div>';
}

function historyHtml(key) {
  const list = recentWorkouts(10, key).filter(w => w.date !== key);
  if (!list.length) return '';
  let h = '<section class="slot"><div class="slot-h"><h2>Recent</h2></div><div class="slot-body">';
  list.forEach(w => { const sm = summary(w); h += '<button class="entry" data-act="w-open" data-date="' + esc(w.date) + '"><div class="main"><div class="title">' + esc(w.name) + '</div><div class="sub">' + esc(niceDate(w.date)) + ' · ' + (w.items || []).map(i => i.name).slice(0, 4).join(', ') + ((w.items || []).length > 4 ? '…' : '') + '</div></div><div class="kcal num">' + sm.sets + ' sets</div></button>'; });
  return h + '</div></section>';
}
