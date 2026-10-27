/* Pure helpers: DOM queries, escaping, numbers, dates, formatting.
   No app state and no imports, so anything may import this. */

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const mkid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const pad = n => String(n).padStart(2, '0');
export const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const num = v => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
export const numOrNull = v => { if (v === null || v === undefined || v === '') return null; const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, '')); return Number.isFinite(n) ? n : null; };
export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export const fmt = (n, dp = 0) => (n === null || n === undefined || !Number.isFinite(Number(n))) ? '–' : Number(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
export const fmtQty = q => { const n = Number(q); if (!Number.isFinite(n)) return '1'; return (Math.round(n * 100) / 100).toString(); };
export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const niceDate = key => { const d = parseYmd(key); return DOW[d.getDay()] + ', ' + MON[d.getMonth()] + ' ' + d.getDate(); };
export const shortDate = key => { const d = parseYmd(key); return MON[d.getMonth()] + ' ' + d.getDate(); };
/* Store snapshots are frozen; the app always edits its own copies. */
export const clone = o => JSON.parse(JSON.stringify(o));
