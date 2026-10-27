/* The Meals tab. */
import { S } from './state.js';
import { esc, fmt } from './util.js';
import { mealTotals } from './log.js';

export function mealsHtml() {
  const list = Object.values(S.meals).sort((a, b) => ((b.fav ? 1 : 0) - (a.fav ? 1 : 0)) || ((b.count || 0) - (a.count || 0)) || String(a.name).localeCompare(String(b.name)));
  let h = '<div class="note">A meal is a bundle of foods you log together. Save one from any slot on Today, or build one here.</div>'
    + '<button class="btn block" data-act="meal-new">+ New meal</button><div class="list">';
  if (!list.length) h += '<div class="empty">No meals saved yet.</div>';
  list.forEach(m => {
    const t = mealTotals(m);
    h += '<div class="row"><button class="star ' + (m.fav ? 'on' : '') + '" data-act="meal-fav" data-id="' + esc(m.id) + '" aria-label="Favorite">★</button><button class="main" style="background:none;border:0;padding:0;text-align:left" data-act="meal-open" data-id="' + esc(m.id) + '"><div class="title">' + esc(m.name) + '</div><div class="sub">' + (m.items || []).length + ' item' + ((m.items || []).length === 1 ? '' : 's') + ' · P ' + fmt(t.protein) + ' C ' + fmt(t.carbs) + ' F ' + fmt(t.fat) + (m.rating ? ' · ' + '★'.repeat(m.rating) : '') + '</div></button><div class="kcal num">' + fmt(t.kcal) + '<small>cal</small></div></div>';
  });
  return h + '</div>';
}
