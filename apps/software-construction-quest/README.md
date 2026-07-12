# Software Construction Quest workspace

This workspace contains The Broken Build, a React and WebGL sub-app hosted by the existing Jekyll site. Read `GAME_DESIGN.md` before changing progression, learning content, or mini-game behavior.

## Commands

Run commands from the repository root:

```sh
npm run dev:quest
npm run build:quest
npm run check:quest
```

The development server provides the React app shell directly. The production build emits static assets into `assets/software-construction-quest`; Jekyll hosts those assets from the authored `/software-construction-quest/` page.

## Adding a quest

Add a `QuestDefinition` to `src/content/questCatalog.ts`, assign it to exactly one district, and add its identifier to that district's ordered `questIds`. Include observable objectives, option-specific feedback, prerequisite recommendations, a deep-practice link when available, and precise lecture file/page provenance.

Choose the simplest existing challenge kind that measures the objective. A new visual mechanic is not justified when a choice, exact evidence set, ordering, matching, or bounded text answer captures the behavior cleanly.

## Adding a challenge kind

Extend the discriminated union in `src/domain/types.ts`, add one pure evaluator branch, add its initial submission, add focused unit tests, and register one semantic React renderer. The evaluator may depend on domain data only. It may not import React, Three.js, DOM APIs, browser storage, or network clients.

Any pointer or drag interaction must also expose visible native controls. Any continuing movement requires pause and reduced-motion behavior. Arbitrary learner code must never execute in the page context.

## Host contract

Jekyll owns metadata, the skip link, shared theme initialization, the unified privacy notice, and the page entry point. The app owns only the content inside `#software-construction-quest-root`.

The app reads two browser records:

- `se-gym-hero-avatar`, owned by the SE Gym avatar customizer;
- `software-construction-quest-progress`, owned by this app.

The first record is read-only here. The second is versioned, boundary-normalized, documented on `/cookies/`, and resettable in the app.

## Verification

Use unit tests for challenge evaluation, progress transitions, review scheduling, avatar normalization, and catalog invariants. Use Playwright for complete learner journeys, rendered accessibility, persistence across reload, text-only fallback, and host integration. Tests select controls by accessible role and name and wait only for observable states.
