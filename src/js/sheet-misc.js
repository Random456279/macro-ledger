/* Small sheets: the day's Details, the targets editor, the per-slot menu, and the in-page confirm
   (the viewer shows no native confirm()). */
import { esc } from './util.js';
import { NUTR } from './nutrients.js';
import { SLOT_LABEL } from './state.js';
import { activeTargets } from './targets.js';
import { openSheet, sheetFrame, topSheetNamed, closeSheet } from './ui.js';
import { detailsHtml } from './view-today.js';

/* Details is a toggle: a second tap (or the test's second click) closes it. */
export function toggleDetails() {
  if (topSheetNamed('details')) { closeSheet(); return; }
  openSheet(sheetFrame('Today in detail', detailsHtml()), { name: 'details' });
}

export function openSlotMenu(slot) {
  const body = '<div class="stack tight">'
    + '<button class="btn block" data-act="save-meal" data-slot="' + slot + '">Save ' + esc(SLOT_LABEL[slot].toLowerCase()) + ' as a meal</button>'
    + '<button class="btn block danger" data-act="clear-slot" data-slot="' + slot + '">Remove everything in ' + esc(SLOT_LABEL[slot].toLowerCase()) + '</button></div>';
  openSheet(sheetFrame(SLOT_LABEL[slot], body), { name: 'slotmenu' });
}

export function openTargetsEditor() {
  const T = activeTargets();
  const body = '<div class="note">Set your own numbers. Saving from the stats form later recalculates and replaces these.</div><div class="ngrid">' + NUTR.filter(m => !m.noTarget).map(m => '<div class="field"><label>' + m.label + (m.max ? ' (max)' : '') + '</label><div class="unitwrap"><input id="t-' + m.k + '" type="number" inputmode="decimal" step="any" value="' + esc(T[m.k] ?? '') + '"><span class="unit">' + (m.unit || 'cal') + '</span></div></div>').join('') + '</div>';
  openSheet(sheetFrame('Edit targets', body, '<button class="btn primary" data-act="t-save">Save targets</button>'), { name: 'targets' });
}

export function openConfirm(title, text, cta, onYes) {
  const el = openSheet(sheetFrame(title, '<p>' + esc(text) + '</p>', '<button class="btn" data-act="close">Cancel</button><button class="btn danger" data-act="confirm-yes">' + esc(cta) + '</button>'), { name: 'confirm' });
  el._onYes = onYes;
}
