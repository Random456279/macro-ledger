/* Small sheets: the targets editor and the in-page confirm (the viewer shows no native confirm()). */
import { esc } from './util.js';
import { NUTR } from './nutrients.js';
import { activeTargets } from './targets.js';
import { openSheet, sheetFrame } from './ui.js';

export function openTargetsEditor() {
  const T = activeTargets();
  const body = '<div class="note">Set your own numbers. Saving from the stats form later recalculates and replaces these.</div><div class="ngrid">' + NUTR.filter(m => !m.noTarget).map(m => '<div class="field"><label>' + m.label + (m.max ? ' (max)' : '') + '</label><div class="unitwrap"><input id="t-' + m.k + '" type="number" inputmode="decimal" step="any" value="' + esc(T[m.k] ?? '') + '"><span class="unit">' + (m.unit || 'cal') + '</span></div></div>').join('') + '</div>';
  openSheet(sheetFrame('Edit targets', body, '<button class="btn primary" data-act="t-save">Save targets</button>'), { name: 'targets' });
}

export function openConfirm(title, text, cta, onYes) {
  const el = openSheet(sheetFrame(title, '<p>' + esc(text) + '</p>', '<button class="btn" data-act="close">Cancel</button><button class="btn danger" data-act="confirm-yes">' + esc(cta) + '</button>'), { name: 'confirm' });
  el._onYes = onYes;
}
