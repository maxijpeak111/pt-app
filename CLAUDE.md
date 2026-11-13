# PT App — Project Plan

@AGENTS.md

## What this is

A personal training app for the owner, a trainee personal trainer, used mainly as an
installable web app on their iPhone. **Long-term it will become a public app for other people**,
so everything should be built to be adapted for different users later.

## About the owner

- Complete beginner at coding. Explain changes in plain language, avoid jargon, and always say
  exactly what to open or run to see the result.

## Design rules

- Dark, sleek, serious, simple and efficient. Mobile-first (iPhone).
- Colours: red, black and white only (tokens in `src/app/globals.css`: `ink`, `panel`, `line`, `brand`).
- Bold uppercase headings, minimal decoration, big tap targets, few taps to log anything.
- Respect iPhone safe areas (notch / home bar); the app is installed to the home screen as "PT".

## Tech stack

- Next.js (App Router, `src/` folder) + TypeScript + Tailwind CSS v4.
- Installable web app: `src/app/manifest.ts`, icons generated from `scripts/icon.svg` via `npm run icons`.
- **No database yet.** Don't add one until a feature needs it, and discuss the choice first.
- Run locally with `npm run dev -- --hostname 0.0.0.0` (port 3000) so the iPhone can reach it on Wi-Fi.

## Build for future multi-user use

- Never hard-code the owner's personal data (goals, min/max loads, shifts, quotes, targets) in
  components. Keep it as user data/settings that could belong to any user.
- Give data records a clear shape (TypeScript types in one place) that could later carry a `userId`.
- Keep data access behind small helper functions so storage can be swapped (local → database) later.
- Use units and labels that could later be made configurable (kg/lb, km/mi).

## How the code is organised

- Data types and storage live in `src/lib/<feature>/` (e.g. `src/lib/sessions/types.ts`, `storage.ts`).
  Storage is browser localStorage for now (key `pt.sessionTemplates.v1`); only `storage.ts` touches it.
- Times (pace, duration) are stored as **seconds**; typed as digits only with colons auto-inserted
  (`src/lib/duration.ts`, `DurationField`), since the iPhone number pad has no colon.
- Reusable inputs are in `src/components/ui/fields.tsx`; inputs use 16px text so iPhone doesn't zoom.
- `cacheComponents` is on: anything reading the URL (`usePathname`, dynamic `params`) must sit
  inside `<Suspense>`, and nothing may read the clock / random during server prerender.
- Ids come from `src/lib/id.ts` (`crypto.randomUUID` isn't available over plain http on the phone).

## Feature roadmap (build in this order)

1. **Session builder** — reusable session templates of type strength, run, swim, MMA or other,
   each with exercises. Strength logs sets, reps and weight. Cardio logs distance, pace and time.
   Templates can be combined (e.g. chest session + a run).
2. **Weekly planner** — calendar-style week view; drop sessions into days and add work shifts,
   which change week to week.
3. **Intensity slider** — 1 to 10 per session, scaling load or duration between the user's own
   minimum and maximum.
4. **Logging & progress** — log completed sessions and see progress against goals (e.g. marathon
   distance, triathlete status, full-body strength, martial arts improvement).
5. **Recovery** — stretches matched to the session or combined sessions, plus sauna, bike and walking.
6. **Nutrition** — enter foods and their macros, build meals by weight, see daily totals against
   targets the user sets.
7. **Sleep & meditation tracking.**
8. **Exercise demos** — videos or images for exercises.
9. **Motivation area** — the user's own quotes and philosophy.

## Current status

- [x] Project setup: Next.js + Tailwind, dark theme, bottom nav (Planner / Sessions) with
      placeholder screens, home-screen install (manifest + icons), git.
- [x] 1. Session builder (templates: create / edit / delete; exercises are strength or cardio).
      Combining templates is not built yet — do it with the weekly planner.
- [ ] 2. Weekly planner ← next up
- [ ] 3. Intensity slider
- [ ] 4. Logging & progress
- [ ] 5. Recovery
- [ ] 6. Nutrition
- [ ] 7. Sleep & meditation
- [ ] 8. Exercise demos
- [ ] 9. Motivation area

## Keep this file updated

After each feature or important decision, update "Current status" and any rules above.
