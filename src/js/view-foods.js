/* The Foods tab (foods, supplements and saved meals), plus the shared food row used by the Add sheet. */
import { S } from './state.js';
import { esc, fmt } from './util.js';
import { allFoodsList, sortedFoods, matches, foodSub } from './foods.js';
import { mealTotals } from './log.js';
import { ICON } from './ui.js';

/* act: the data-act fired when the row body is tapped ('food-open' in Foods, 'pick' in Add). */
export function foodRow(f, act) {
  return '<div class="row"><button class="star ' + (f.fav ? 'on' : '') + '" data-act="fav" data-id="' + esc(f.id) + '" aria-label="' + (f.fav ? 'Unfavorite' : 'Favorite') + '">★</button>'
    + '<button class="main" style="background:none;border:0;padding:0;text-align:left" data-act="' + act + '" data-id="' + esc(f.id) + '"><div class="title">' + esc(f.name) + '</div><div class="sub">' + esc(foodSub(f)) + (f.rating ? ' · ★ ' + f.rating : '') + '</div></button>'
    + '<div class="kcal num">' + fmt(f.n && f.n.kcal) + '<small>cal</small></div></div>';
}

/* A saved meal in the Foods tab: star toggles favorite, body opens it. */
export function savedMealRow(m) {
  const t = mealTotals(m); const n = (m.items || []).length;
  return '<div class="row"><button class="star ' + (m.fav ? 'on' : '') + '" data-act="meal-fav" data-id="' + esc(m.id) + '" aria-label="' + (m.fav ? 'Unfavorite' : 'Favorite') + '">★</button>'
    + '<button class="main" style="background:none;border:0;padding:0;text-align:left" data-act="meal-open" data-id="' + esc(m.id) + '"><div class="title">' + esc(m.name) + '</div><div class="sub">' + n + ' item' + (n === 1 ? '' : 's') + ' · P ' + fmt(t.protein) + ' C ' + fmt(t.carbs) + ' F ' + fmt(t.fat) + (m.rating ? ' · ★ ' + m.rating : '') + '</div></button>'
    + '<div class="kcal num">' + fmt(t.kcal) + '<small>cal</small></div></div>';
}

export function sortedMeals(list) {
  return list.sort((a, b) => ((b.fav ? 1 : 0) - (a.fav ? 1 : 0)) || ((b.count || 0) - (a.count || 0)) || String(a.name).localeCompare(String(b.name)));
}

export function foodsListHtml() {
  const q = S.foodsQuery;
  if (S.foodsSort === 'meals') {
    const list = sortedMeals(Object.values(S.meals).filter(m => matches({ name: m.name }, q)));
    const empty = q ? 'No matches.' : 'Save your meals here, then log them in one tap.';
    return list.length ? list.map(savedMealRow).join('') : '<div class="empty">' + empty + '</div>';
  }
  const base = allFoodsList().filter(f => matches(f, q));
  let list, empty;
  if (S.foodsSort === 'supp') {
    list = base.filter(f => f.kind === 'supplement').sort((a, b) => ((b.inStack ? 1 : 0) - (a.inStack ? 1 : 0)) || String(a.name).localeCompare(String(b.name)));
    empty = q ? 'No matches.' : 'No supplements yet. Tap Scan label with a Supplement Facts panel, then mark it "In daily stack".';
  } else {
    list = sortedFoods(base.filter(f => f.kind !== 'supplement' || S.foodsSort !== 'count'), S.foodsSort);
    empty = q ? 'No matches.' : 'Foods you log, scan or describe land here. Favorites and ratings make them one tap next time.';
  }
  return list.length ? list.map(f => foodRow(f, 'food-open')).join('') : '<div class="empty">' + empty + '</div>';
}

export function foodsHtml() {
  const chip = (k, l) => '<button class="chip ' + (S.foodsSort === k ? 'on' : '') + '" data-act="foods-sort" data-sort="' + k + '">' + l + '</button>';
  const meals = S.foodsSort === 'meals';
  let h = '<input class="search" id="foodsSearch" type="search" placeholder="' + (meals ? 'Search my meals' : 'Search my foods') + '" value="' + esc(S.foodsQuery) + '" autocomplete="off">'
    + '<div class="chips">' + chip('count', 'Most logged') + chip('fav', 'Favorites') + chip('recent', 'Recent') + chip('az', 'A to Z') + chip('meals', 'Meals') + chip('supp', 'Supplements') + '</div>';
  if (meals) h += '<div class="btnrow"><button class="btn" data-act="meal-new">New meal</button></div><div class="hint">A meal is a few foods you eat together. Build one here, or save a slot of Today from its ··· menu.</div>';
  else {
    h += '<div class="btnrow"><button class="btn" data-act="scan">' + ICON.camera + ' Scan label</button><button class="btn ghost" data-act="new-manual">New food</button></div>';
    if (S.foodsSort === 'supp') h += '<div class="note">Scanning a Supplement Facts panel works like any label. Mark items "In daily stack" and Today gets a one-tap Log stack button (or turn on automatic logging in Me).</div>';
  }
  h += '<div class="list card" id="foodsList">' + foodsListHtml() + '</div>';
  return h;
}
