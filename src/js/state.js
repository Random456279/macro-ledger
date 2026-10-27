/* App-wide state and constants. One mutable object (S) that every module reads and the
   data modules write; `hooks` lets low-level modules ask for a re-render without
   importing the UI (main.js fills them in at boot). */
import { ymd } from './util.js';

export const VERSION = '0.6.0';
export const KEY = 'macroledger.v1';          /* localStorage mirror key */

export const SLOTS = [
  { k: 'breakfast', label: 'Breakfast' }, { k: 'lunch', label: 'Lunch' }, { k: 'dinner', label: 'Dinner' },
  { k: 'snack', label: 'Snacks' }, { k: 'supplement', label: 'Supplements' },
];
export const MEAL_SLOTS = SLOTS.filter(s => s.k !== 'supplement');
export const SLOT_LABEL = Object.fromEntries(SLOTS.map(s => [s.k, s.label]));

/* Amount units for the quantity sheet. g is grams per unit; sv means servings. */
export const UNITS = {
  sv: { label: 'Servings', g: null, step: 0.5, chips: [0.5, 1, 1.5, 2, 3] },
  g: { label: 'g', g: 1, step: 10, chips: [50, 100, 150, 200, 300] },
  oz: { label: 'oz', g: 28.3495, step: 1, chips: [2, 4, 6, 8, 12] },
  lb: { label: 'lb', g: 453.592, step: 0.25, chips: [0.25, 0.5, 0.75, 1, 1.5] },
};

export const ACTIVITY = [
  { v: 1.2, label: 'Mostly sitting, little exercise' },
  { v: 1.375, label: 'Light: 1 to 3 workouts a week' },
  { v: 1.55, label: 'Moderate: 3 to 5 workouts a week' },
  { v: 1.725, label: 'Active: 6 to 7 workouts a week' },
  { v: 1.9, label: 'Very active: two-a-days or physical job' },
];

export const slotNow = () => { const h = new Date().getHours(); if (h >= 4 && h < 11) return 'breakfast'; if (h < 16) return 'lunch'; if (h < 22) return 'dinner'; return 'snack'; };

export const S = {
  ready: false, tab: 'today', dayKey: ymd(new Date()), fullOpen: false,
  /* data (mirrors the store) */
  profile: null, profileDraft: null, foods: {}, meals: {}, days: {},
  /* store plumbing */
  mode: 'pending', uid: null, base: null, pending: [], localBoot: null, migrated: false, daysLoaded: false, autoDone: {},
  /* AI availability */
  ai: { sample: null, images: false },
  /* UI */
  sheets: [], addFilter: 'favorites', addSlot: null, addQuery: '', foodsQuery: '', foodsSort: 'count',
};

/* Filled in by main.js. Data modules call these instead of importing the UI. */
export const hooks = { render() {}, refreshOpenLists() {} };
