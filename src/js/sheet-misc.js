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

/* Standalone only: paste the device key once. */
export function openKeySheet(message) {
  const body = (message ? '<div class="note warn">' + esc(message) + '</div>' : '')
    + '<p class="small muted">TARE keeps your data on your own server. Paste the device key you were given to connect this phone. Without it the app still works, but only on this device.</p>'
    + '<div class="field"><label>Device key</label><input id="k-key" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="ml_…"></div>';
  openSheet(sheetFrame('Connect this device', body, '<button class="btn" data-act="close">Not now</button><button class="btn primary" data-act="connect-go">Connect</button>'), { name: 'key' });
}

/* Paste a backup (from Copy backup) to merge it in. */
export function openImportSheet() {
  const body = '<p class="small muted">Paste the text from "Copy backup". Foods, meals, days and your profile are merged in; nothing is deleted.</p>'
    + '<div class="field"><label>Backup text</label><textarea id="imp-text" style="min-height:160px;font-size:12px" placeholder=\'{"exported": …\'></textarea></div>';
  openSheet(sheetFrame('Import backup', body, '<button class="btn primary" data-act="import-go">Import</button>'), { name: 'import' });
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
