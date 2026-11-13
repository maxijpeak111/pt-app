# PT App — Project Notes

## What this is

A personal training app for the owner (a beginner coder and trainee personal trainer), used as a
home-screen web app on an iPhone. **Long-term it becomes a public app for other people**, so keep it adaptable.

## How it works now (static app, no servers)

- Plain HTML, CSS and vanilla JavaScript in `docs/`. No build step, no framework, no backend.
- Hosted free by GitHub Pages from the `docs/` folder on `main`: https://maxijpeak111.github.io/pt-app/
- All user data lives on the phone only (localStorage key `pt.v1`). Backup/restore is in More → Settings.
- Installed from Safari: Share → Add to Home Screen.
- Publishing = commit and push to `main`; Pages redeploys in about a minute. Claude can do this from chat.
- The old Next.js app (`src/`, `package.json`, etc.) is legacy and not used; Pages only serves `docs/`.

## Files (`docs/`)

- `index.html`, `style.css`, `manifest.webmanifest`, `sw.js` (network-first service worker), `icons/`, `media/`
- `js/core.js` state, helpers, intensity maths, built-in stretches and exercises
- `js/sessions.js`, `plan.js`, `recover.js`, `fuel.js`, `more.js` (progress/goals), `more2.js` (sleep, meditation, exercises), `more3.js` (your code, settings/backup), `import.js` (calendar import), `app.js` (router)
- Adding a JS file: add it to `index.html` and to the `SHELL` list in `sw.js`; bump `V` in `sw.js` when caching changes.

## Rules

- Design: dark, sleek, serious; red, black, white. Big tap targets, few taps to log. Respect iPhone safe areas.
- Use relative paths only (the site lives under `/pt-app/`).
- Never hard-code the owner's personal data (goals, shifts, quotes, targets). It is user data.
- Keep units and labels configurable where possible; data shapes should be able to carry a user id later.
- Build DOM with `PT.h` (text is always text, never HTML) and `PT.fill` for replacing children.
- Explain things to the owner in plain language.

## Exercise levels, folders, meals (v2 data)

- Each library exercise can have `kind` (strength | cardio | time), `unit`, and `range: {min, max}` = the owner's own
  level 1 (warm-up) and level 10 (max). `PT.atLevel(lib, level)` interpolates; `PT.target(ex, level)` falls back to
  `PT.scaleEx` (global % range) for exercises with no range. First use of an exercise asks for the range.
- Session exercises: `{id, exId, name, kind, level}`. Planned items can override per exercise: `item.levels[exId]`;
  `PT.levelOf`, `PT.itemLevel` (average). Sessions are built from folders (`PT.FOLDERS`, by tag) via `PT.browseSheet`;
  a whole saved session can be stacked in. Type and tags are derived from the exercises.
- Foods are per usual portion (`portion` label, optional `portionG`, macros for that portion); meals/plates use `qty`
  in portions. Add meal = slot → stack foods from groups (`PT.FOOD_GROUPS`) and usual meals → optional save as usual meal.
- Calorie target: rest-day targets + `settings.hardKcal`; `PT.dayLoad` (0–10 from planned levels) scales extra kcal,
  which goes to carbs (`PT.dayTargets`).
- `PT.migrate()` upgrades v1 data (foods per 100 g → portion of 100 g; meal grams → qty) and runs on restore too.

## Calendar import

- Plan tab → Import calendar (also in More → Settings). Copies a prompt for any Claude chat with calendar/Notion access;
  the user pastes the JSON reply back. Format: `{"ptImport":1,"days":[{date,shift,events,sessions,note}]}` (see `PT.IMPORT_PROMPT`).
- Shifts replace that day's shift; imported events (`imported: true`) are replaced on re-import; hand-added events kept;
  sessions matched to saved sessions by name (case-insensitive), skipped if already planned that day.
- Plan days now have an `events` array: `{id, title, start, end, imported?}`.

## Status

All planned features are built: session builder and merge, weekly planner with shifts, intensity slider,
logging, goals/progress, recovery (stretches, sauna/bike/walk), nutrition, sleep, meditation,
exercise library with demo links, personal quotes/principles, backup.
Not yet checked on a real phone. Ideas for later: barcode scanning, accounts and sync for a public version.
