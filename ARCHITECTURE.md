# Macro Ledger: architecture and working rules

Macro Ledger is an iPhone macro and nutrient tracker, published as a claude.ai artifact (a hosted page
added to the home screen). One owner (Wills), data per account, no backend. This file is the contract
for anyone, human or agent, who changes the code. Read it fully before editing.

## The one-minute version

- Source lives in `src/`. The app is **published as a single HTML file** built from it (`npm run build`).
- The published file is what the phone runs. The artifact URL never changes; every publish replaces it.
- `npm test` builds and runs the headless suite. It must pass before any publish.
- Each feature lives in its own module. An agent owns the files listed in its brief and touches nothing else
  except the two registries (`actions.js`, `main.js`) and the one line in `ARCHITECTURE.md` that lists its module.
- Data documents are append-only in spirit: never rename or repurpose an existing field. Add new ones.

## Build, test, publish

```
npm install                 # once; esbuild + jsdom
npm run build               # src/ -> dist/macro-ledger.html (inline CSS + bundled JS)
npm test                    # build + test/smoke.cjs (jsdom, local mode and stubbed db/AI mode)
npm run shots               # build + phone-width screenshots to test/shots/ (needs Playwright Chromium)
```

Publishing is done with the claude.ai Artifact tool, from a Claude session, never by hand:
build, then publish `dist/macro-ledger.html` to the existing artifact (pass its `url`, or publish from the
same file path the session used before). The artifact declares these capabilities and they must be kept:
`db` with rules `u: owner/owner` and `u/{self}: interact/interact`, `user`, `sample` with `images: true`.
Passing `capabilities` again is only needed to change them; omitting the field keeps them.

Bump `VERSION` in `src/js/state.js` on every publish. It shows under Me → Data as "build x.y.z", which is how
the phone confirms it loaded the new code.

## Runtime environment

The page runs inside the claude.ai artifact viewer. Facts that shape the code:

- The viewer wraps the file in its own `<html><head>` skeleton. `src/index.html` is therefore a fragment:
  `<title>`, a meta, font links, the `<!-- CSS -->` and `<!-- JS -->` placeholders, and the markup shell.
- No native `alert/confirm/prompt`, no `window.print`, no downloads from links. Confirmations are sheets
  (`sheet-misc.js openConfirm`); exports go to the clipboard.
- External scripts only from a short CDN allowlist; the app uses none. Fonts from Google Fonts only.
- `window.claude.use(name)` resolves a capability namespace or `null`. The app must work when every
  capability is `null` (signed-out viewer, local file, test harness).
- `db` keeps data under `u/<uid>` (see Data model). `sample` asks Claude on the viewer's account; the first
  call shows a consent dialog. `user.id()` gives the opaque id used as the db root.
- Browser storage (`localStorage`) is a mirror for instant boot and offline use, never the source of truth
  when `db` is available.

## Module map

Dependencies point downward only. A module may import from any layer below it, never above or sideways
within the same layer unless listed. `state.hooks` (`render`, `refreshOpenLists`) exists so lower layers can
request a re-render without importing the UI.

| Layer | File | Owns | Imports |
|---|---|---|---|
| 0 | `util.js` | DOM query, escaping, numbers, dates, formatting | nothing |
| 0 | `nutrients.js` | `NUTR` table (keys, labels, units, ext flag), `fullN/blankN/scaled` | nothing |
| 1 | `state.js` | `S` (all mutable state), `VERSION`, slots, units, activity levels, `hooks` | util |
| 1 | `basics.js` | built-in generic foods | nutrients |
| 2 | `targets.js` | `calcTargets`, `profileComplete`, `activeTargets` | util, state |
| 2 | `ui.js` | toast, sheet stack, icons, star control | util, state |
| 3 | `store.js` | localStorage mirror, `commit`, db subscriptions, migration, `connectStore` | state, util, ui |
| 4 | `foods.js` | My Foods and Meals CRUD, search, sort, Basics materialization, stack list | state, store, basics, util |
| 5 | `log.js` | day docs, totals, entries, log/edit/remove/copy, stack logging and auto-log | state, store, nutrients, util, foods, ui |
| 6 | `sheet-food.js` | food form (new, edit, AI-filled) read/write | util, nutrients, ui |
| 6 | `sheet-misc.js` | targets editor, confirm sheet | util, nutrients, targets, ui |
| 6 | `view-foods.js` | Foods tab, shared `foodRow` | state, util, foods, ui |
| 6 | `view-meals.js` | Meals tab | state, util, log |
| 6 | `view-today.js` | Today tab, full label, entry rows | state, util, nutrients, targets, log, foods |
| 6 | `view-me.js` | profile form, onboarding, Me tab | state, util, nutrients, targets, foods |
| 7 | `ai.js` | prompts, coercion, label scan, describe sheet and estimate, `initAI` | state, nutrients, util, ui, sheet-food |
| 7 | `sheet-qty.js` | amount sheet (servings or weight), entry editor, `addFromQty` | util, state, nutrients, foods, log, ui |
| 7 | `sheet-add.js` | Add sheet, filters, `refreshOpenLists` | util, state, basics, foods, log, ui, view-foods |
| 7 | `sheet-meal.js` | meal builder, log-meal sheet | util, state, nutrients, basics, foods, log, ui |
| 8 | `actions.js` | the `ACT` registry: every `data-act` handler | everything below |
| 9 | `main.js` | `render`, header and tabs, event routing, boot | everything |

Planned modules (not yet written; create them at layer 7 and register in `actions.js`/`main.js`):
`suggest.js` (what closes today's gap), `trends.js` (weight log, rolling averages, weekly review),
`workouts.js` (training log and day-type targets).

## Conventions

- **Rendering.** Views are pure functions returning HTML strings; `main.render()` paints the active tab.
  Sheets build their HTML once and keep live state on the scrim element (`el._food`, `el._q`, ...).
  Call `hooks.render()` after state changes; never touch `#main` from a data module.
- **Events.** One delegated click listener in `main.js`. Interactive elements carry `data-act="name"` and
  `data-*` arguments; handlers live in `actions.js` and receive `(button, event)`. Segmented controls
  (`.seg button`) toggle themselves before the registry runs. Do not add `document`-level listeners
  elsewhere; per-sheet listeners on inputs are fine.
- **Writes.** Every persisted change goes through `store.commit(kind, id, data)` with kind `profile`,
  `foods`, `meals` or `days`; `data === null` deletes. `commit` also refreshes the localStorage mirror.
  Store snapshots are frozen: clone before editing (the store layer already does).
- **Nutrients.** Always work with full vectors from `fullN()`; `null` means unknown and must stay null
  (never 0) so the full label can tell "none" from "not listed". Add a nutrient by appending to `NUTR`
  and giving it a target in `targets.calcTargets`; forms, totals, label and AI prompts follow.
- **AI.** The label reader accepts a facts-panel photo (basis 'label', exact) or a front-of-package photo (basis 'knowledge': product identified, values from the model's memory, confidence capped at medium, flagged in the form). The page cannot reach the web, so 'knowledge' is recall, never a lookup. Prompts ask for a strict JSON shape (`ai.JSON_SHAPE`) and go through `coerceAI` before anything
  touches the form. Never trust a field's type. Fast tier by default; Careful mode uses the default tier.
  Every AI result lands in the food form for the user to confirm; nothing is logged without a tap.
- **Copy.** Plain, short, no exclamation marks. No em dashes anywhere in UI text or comments.
- **Style.** Light theme only (deliberate). Tokens live at the top of `src/css/app.css`; new components use
  the existing tokens and classes (`.btn`, `.chip`, `.seg`, `.row`, `.sheet`, `.note`, `.kv`).
- **Mobile.** 390px wide is the design width. Anything new gets checked in `npm run shots` or a real phone.

## Data model

All documents are plain JSON under the viewer's root `u/<uid>` in the artifact db (and mirrored in
localStorage under `macroledger.v1` as `{profile, foods, meals, days, tab}`).

```
profile  (u/<uid>)
  sex 'm'|'f', age, heightFt, heightIn, weightLb, bodyFat|null, activity (multiplier), goal 'lose'|'maintain'|'gain',
  rate (lb/wk), targets {kcal, protein, carbs, fat, fiber, addedSugar, satFat, cholesterol, sodium, potassium, calcium,
  iron, vitD, vitA, vitC, vitE, vitK, vitB6, folate, vitB12, magnesium, zinc, selenium, iodine, omega3, caffeine, bmr, tdee}, custom (bool: targets hand-edited),
  careful (bool: AI default tier), autoStack (bool), created

food  (u/<uid>/foods/<id>)
  id, name, brand|null, restaurant|null, servingLabel, servingGrams|null, n (per-serving nutrient vector),
  kind 'food'|'supplement', inStack, stackQty, fav, rating 0..5, count, last, created, updated,
  extras [{name, v, unit}] (actives with no column, e.g. EPA, beta-alanine), basis 'label'|'knowledge'|null (knowledge = filled
  from Claude's memory after a front-of-package photo; always confirm), source 'manual'|'label'|'describe'|'restaurant'|'basic',
  confidence|null, notes|null, basicKey (if copied from Basics)

meal  (u/<uid>/meals/<id>)
  id, name, items [{foodId, qty}], fav, rating, count, last, created, updated

day  (u/<uid>/days/<yyyy-mm-dd>)
  date, stackLogged (bool), entries [entry]
  entry: id, foodId, name, brand, restaurant, servingLabel, servingGrams, kind, qty (servings),
         amount {v, unit 'g'|'oz'|'lb'}|null (what was typed), n (per-serving vector frozen at log time), extras (copied from the food),
         slot 'breakfast'|'lunch'|'dinner'|'snack'|'supplement', t, mealId?
```

Entries copy the food's nutrients at log time so editing a food never rewrites history. Days older than
60 days are not subscribed; `store.loadDay` fetches one on demand.

## Targets (so nobody re-derives them)

Calories: Mifflin-St Jeor BMR, or Katch-McArdle when body fat is given, times the activity multiplier,
then minus 500 kcal per lb/week on a cut or plus 500 on a gain, rounded to 10, floored at 1500 (men) or
1200 (women). Protein: 1.1 g per lb lean mass on a cut, 1.0 otherwise (0.9 / 0.8 per lb bodyweight without
body fat). Fat: max(27% of calories, 0.3 g per lb). Carbs: the remainder, floored at 60 g. Micros: NIH DRIs
by sex and age; limits (satFat, addedSugar 10% of calories, sodium 2300, cholesterol 300) from the Dietary
Guidelines and FDA Daily Values; omega-3 (EPA + DHA) 500 mg is a common guideline, not a DRI, and caffeine 400 mg is the FDA ceiling. All overridable in Me → Edit targets (`profile.custom = true`).

## Working as a team of agents

1. The lead writes one brief per agent: the feature, the files it owns, the data fields it may add, the
   `data-act` names it will register, and the test it must add to `test/smoke.cjs`.
2. Each agent works in its own worktree or branch, runs `npm test` (and `npm run shots` for UI), and hands
   back a diff plus a two-line summary. It does not publish.
3. The lead merges in layer order (lowest first), runs the full suite, bumps `VERSION`, builds, publishes,
   and tells the owner what changed in plain words.
4. Conflicts are a brief problem, not a merge problem: if two agents need the same file, split the file
   first (the way `sheet-*.js` and `view-*.js` are split) and re-brief.
5. Anything that needs the real phone (camera, consent dialogs) is listed as "to verify on device" in the
   hand-back, never assumed to work.

## Roadmap

See the conversation history for detail; in short: (2) suggestions that close today's gap from favorites
and meals, plus restaurant memory; (3) weight and body fat log, rolling averages, adaptive targets;
(4) micronutrients estimated for described meals and weekly shortfall flags; (5) workouts and day-type
targets; (6) sharing with friends (each account already gets a private `u/<uid>` subtree).
