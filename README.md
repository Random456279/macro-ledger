# TARE (repo: macro-ledger)

A personal iPhone health app, shown as TARE in the UI: set calorie, macro and nutrient targets from your
stats, log food by scanning labels, describing meals, or tapping favorites, watch what's left for the day,
and log workouts (weight, reps, sets) with favorite sessions to repeat. It runs on its own URL (Cloudflare
Worker + D1, see SETUP.md) and can also be published as a claude.ai artifact.

- `npm install` once, then `npm test` to build and run the suite, `npm run shots` for phone-width screenshots.
- The build output `dist/macro-ledger.html` is what gets published to the artifact.
- Read `ARCHITECTURE.md` before changing anything. It is the contract for humans and agents alike.
