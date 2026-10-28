/* Morning weigh-ins. One number per day, stored on the day doc as `weight` (lb). Pure data; no DOM.
   The trend is what matters: a 7-day average, compared with the 7 days before it. */
import { S } from './state.js';
import { commit } from './store.js';
import { getDay } from './log.js';
import { ymd, addDays, parseYmd, num } from './util.js';

export function logWeight(dayKey, lb) {
  const day = getDay(dayKey); day.date = dayKey;
  const v = lb === null || lb === undefined || lb === '' ? null : Math.round(num(lb) * 10) / 10;
  if (v === null || !(v > 0)) delete day.weight; else day.weight = v;
  S.days[dayKey] = day; commit('days', dayKey, day);
}

/* Logged weights, oldest first, within the last `n` days ending on `endKey` (today by default). */
export function weightSeries(n = 30, endKey) {
  const end = endKey || ymd(new Date()); const start = ymd(addDays(parseYmd(end), -(n - 1)));
  return Object.keys(S.days).filter(k => k >= start && k <= end && S.days[k] && S.days[k].weight > 0).sort().map(k => ({ date: k, lb: S.days[k].weight }));
}

/* The most recent weigh-in on or before a day; falls back to the profile's weight. */
export function latestWeight(beforeKey) {
  const keys = Object.keys(S.days).filter(k => (!beforeKey || k <= beforeKey) && S.days[k] && S.days[k].weight > 0).sort();
  if (keys.length) { const k = keys[keys.length - 1]; return { date: k, lb: S.days[k].weight }; }
  return S.profile && S.profile.weightLb > 0 ? { date: null, lb: S.profile.weightLb } : null;
}

const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;

export function weightStats(endKey) {
  const end = endKey || ymd(new Date());
  const last14 = weightSeries(14, end);
  const split = ymd(addDays(parseYmd(end), -6));
  const cur = last14.filter(p => p.date >= split).map(p => p.lb);
  const prev = last14.filter(p => p.date < split).map(p => p.lb);
  const avg7 = mean(cur), avgPrev = mean(prev);
  const perWeek = cur.length >= 2 && prev.length >= 2 ? avg7 - avgPrev : null;
  const latest = latestWeight(end);
  return { latest: latest && latest.date ? latest : null, avg7, n7: cur.length, avgPrev, nPrev: prev.length, perWeek, series: weightSeries(30, end) };
}

/* Weekly change the profile is aiming for, in lb (negative for a cut). */
export function goalPerWeek() {
  const p = S.profile; if (!p) return 0;
  if (p.goal === 'lose') return -(num(p.rate) || 1);
  if (p.goal === 'gain') return num(p.rate) || 0.5;
  return 0;
}

export const signed = (v, dp = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(dp);

/* A small inline sparkline of the series (width 100%, fixed height). Returns '' with fewer than 2 points. */
export function sparklineSvg(series, w = 320, h = 44) {
  if (!series || series.length < 2) return '';
  const first = parseYmd(series[0].date), last = parseYmd(series[series.length - 1].date);
  const span = Math.max(1, Math.round((last - first) / 86400000));
  const lbs = series.map(p => p.lb); let lo = Math.min(...lbs), hi = Math.max(...lbs);
  if (hi - lo < 2) { const mid = (hi + lo) / 2; lo = mid - 1; hi = mid + 1; }
  const px = p => (Math.round((parseYmd(p.date) - first) / 86400000) / span) * (w - 8) + 4;
  const py = p => h - 4 - ((p.lb - lo) / (hi - lo)) * (h - 8);
  const pts = series.map(p => px(p).toFixed(1) + ',' + py(p).toFixed(1)).join(' ');
  const end = series[series.length - 1];
  return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="' + pts + '"/><circle cx="' + px(end).toFixed(1) + '" cy="' + py(end).toFixed(1) + '" r="3.5" fill="var(--accent)"/></svg>';
}
