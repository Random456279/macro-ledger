/* UI primitives shared by every screen: toast, bottom sheets, icons, star ratings.
   Nothing here knows about foods or days. */
import { $, $$, esc } from './util.js';
import { S } from './state.js';

export const ICON = {
  x: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  chevL: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  chevR: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  foods: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
  meals: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="7"/><path d="M12 6V3M9 3h6"/></svg>',
  me: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>',
  camera: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.2"/></svg>',
  pen: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4l10-10-4-4L4 16z"/></svg>',
  type: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6h14M12 6v13M9 19h6"/></svg>',
};

let toastT;
export function toast(msg) {
  const t = $('#toast'); if (!t) return;
  t.textContent = msg; t.classList.add('in'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('in'), 2200);
}

/* Sheets stack. openSheet returns the scrim element; callers hang per-sheet state on it (el._food etc.). */
export function openSheet(html, opts = {}) {
  const scrim = document.createElement('div'); scrim.className = 'scrim';
  scrim.innerHTML = '<div class="sheet" role="dialog" aria-modal="true">' + html + '</div>';
  document.body.appendChild(scrim);
  scrim.addEventListener('click', e => { if (e.target === scrim) closeSheet(); });
  S.sheets.push({ el: scrim, name: opts.name || '', onClose: opts.onClose });
  requestAnimationFrame(() => scrim.classList.add('in'));
  return scrim;
}
export function closeSheet() { const rec = S.sheets.pop(); if (!rec) return; rec.el.remove(); if (rec.onClose) rec.onClose(); }
export function closeAllSheets() { while (S.sheets.length) closeSheet(); }
export function topSheet() { return S.sheets.length ? S.sheets[S.sheets.length - 1].el : null; }
export function topSheetNamed(name) { for (let i = S.sheets.length - 1; i >= 0; i--) if (S.sheets[i].name === name) return S.sheets[i].el; return null; }
export function sheetFrame(title, body, footer) {
  return '<div class="sheet-h"><h2>' + esc(title) + '</h2><button class="closex" data-act="close" aria-label="Close">' + ICON.x + '</button></div>'
    + '<div class="sheet-b">' + body + '</div>' + (footer ? '<div class="sheet-f">' + footer + '</div>' : '');
}
export function starsHtml(rating, act, extra) {
  let h = '<span class="stars" role="radiogroup" aria-label="Rating">';
  for (let i = 1; i <= 5; i++) h += '<button type="button" class="' + (i <= (rating || 0) ? 'on' : '') + '" data-act="' + act + '" data-star="' + i + '" ' + (extra || '') + ' aria-label="' + i + ' star' + (i > 1 ? 's' : '') + '">★</button>';
  return h + '</span>';
}
export { $, $$ };
