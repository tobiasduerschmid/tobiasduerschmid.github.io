# Project rules

This file is the canonical source of project-wide instructions for any AI coding agent. `CLAUDE.md` and `GEMINI.md` are symlinks to this file.

## Accessibility — WCAG 2.2 Level AA is required

Every change to this repository — new feature, bug fix, refactor, content edit, or dependency bump — must leave every reachable page **fully compliant with [WCAG 2.2 Level AA](https://www.w3.org/TR/WCAG22/)**. That means satisfying all 30 Level A *and* all 25 Level AA success criteria — 55 in total — on every page the build emits. This is a hard requirement, not a goal. If you cannot make a change AA-compliant, stop and surface the trade-off to the user before proceeding.

This rule applies to **all** outputs the site produces, including tutorial pages, the SEBook, SEGym, blog posts, print layouts, popout windows, embedded widgets (quizzes, flashcards, audio players, code editors, terminals, UML/diagram renderers), and any new component you introduce.

The full checklist (all 55 success criteria, project-specific gotchas, verification steps, and common pitfalls) lives in [`.agents/skills/wcag-aa-compliance/SKILL.md`](./.agents/skills/wcag-aa-compliance/SKILL.md). Read it before starting any change that affects what reaches the browser. CI enforces the rule via [`tests/wcag22-complete-audit.spec.js`](./tests/wcag22-complete-audit.spec.js).

If you discover a pre-existing AA violation in code adjacent to your change, surface it to the user — don't silently fix sweeping accessibility debt as part of an unrelated PR. Do fix violations you *introduced* in the same change.

## Git submodules — fix them in place when they break a test

This repository pulls in [`js/ArchUML`](./js/ArchUML/) as a git submodule. When a test, type-check, or audit run fails because of a bug in submodule code, **fix it in the submodule's working tree directly** — edit the file under `js/ArchUML/`, re-run the failing test until it passes, and leave the submodule's commit pointer for the user to commit/push when they review the change.

Do **not** stop and ask the user to do the submodule fix themselves. The submodule files are checked out in this repo, the build serves them directly (`/js/ArchUML/uml-bundle.js`), and there is no separate test/CI loop that would catch the bug faster. Fixing in place is the only path to a green test run.

Surface the fact that you touched the submodule in your end-of-turn summary so the user knows there are two repos to commit.

## Minimum font sizes — readable text is paragraph-size

Anything the user is meant to **read or type** must render at **paragraph size or larger** (the on-screen size of the surrounding `<p>`, around 16–22 px depending on context). Form inputs, textareas, button labels, field labels, list items, table cells, code blocks, instructional prose, modal bodies, tooltip text, and toast/status messages all count as readable text.

> ⚠️ **`rem` is a trap on this site.** The root rule sets `html { font-size: 62.5% }` so `1rem = 10px` here, *not* the usual 16 px. Body / `<p>` text actually renders at ~16-22 px because larger values are set further down. **`font-size: 1rem` will produce 10 px on this site — illegible.** New widget CSS should use one of:
>
> 1. **Inherit:** omit `font-size` and let the surrounding `<p>` context decide. This is the safest default for an include that may be dropped into multiple page templates.
> 2. **`em` (relative to inherited size):** `0.9em` for hints, `1.2em` for sub-headings, `0.85em` for decorative pills. Scales with the surrounding context.
> 3. **`font: inherit` on form controls:** browser defaults for `input` / `textarea` / `button` / `select` are *not* inherited from the parent — set `font: inherit` so typed content matches surrounding paragraph text.

Concrete defaults unless you have a stated reason to deviate:

- **Body / paragraph / form input / button / label / textarea / table cell:** inherit from surrounding `<p>` (or `font: inherit` on form controls). Never `0.7rem`–`1rem` (that's 7–10 px on this site).
- **Secondary text (hints, captions, metadata, "last saved" timestamps):** `0.9em` minimum (≈90 % of the surrounding text).
- **Decorative micro-labels (uppercase pills, single-letter chips):** `0.85em` minimum, and only when the text is short and high-contrast.
- **Headings:** larger than body, never smaller. (`h3 ≥ 1.2em` of paragraph, `h2 ≥ 1.4em`, `h1 ≥ 1.7em`.)

Do **not** use `font-size: 0.78rem` / `0.8rem` / `0.85rem` / `0.92rem` for content the user has to *read to perform a task*. Those sizes show up in copy-pasted "compact" widget CSS and they render at 7.8–9.2 px on this site, illegible especially in dark mode and on high-DPI laptop screens. If a label needs to be smaller for layout reasons, the layout is wrong, not the type. Resize the container or move the label, don't shrink the text.

This rule applies anywhere CSS is written — `.css` / `.scss` files, inline `<style>` blocks in includes / layouts / pages, JS-injected stylesheets via template literals, and inline `style="font-size: …"` attributes. It applies to new components, edits to existing components, and JS-generated tooltips / toasts / popovers. WCAG 2.2 doesn't pin a numeric minimum but Success Criterion 1.4.4 (Resize Text) and 1.4.12 (Text Spacing) effectively assume sane base sizes; this rule operationalizes that for the project.

**Verify, don't assume.** After any CSS change that touches font sizes, open the page in the browser preview and read the affected text at normal zoom. If you have to lean in, the size is wrong.

## Project skills

The project keeps a set of detailed, evidence-based playbooks in [`.agents/skills/`](./.agents/skills/). Claude Code auto-loads these via its skill mechanism, but other agents must read them explicitly when their triggers apply. **Before starting work that matches a trigger below, read the corresponding `SKILL.md` in full.**

For Claude Code only, the same files are also reachable via `.claude/skills/` (a symlink to `.agents/skills/`); for Gemini CLI via `.gemini/skills/` (also a symlink). All three paths resolve to the same content.

| Trigger — start work that involves… | Read this skill |
| --- | --- |
| Any HTML / CSS / JS / SVG / include / layout / content change that affects what reaches the browser. **Every change must keep every reachable page WCAG 2.2 Level AA compliant** — full criteria reference, project-specific gotchas, and verification steps. | [`.agents/skills/wcag-aa-compliance/SKILL.md`](./.agents/skills/wcag-aa-compliance/SKILL.md) |
| Any color / CSS / SCSS / inline `<style>` / JS-injected stylesheet / SVG `fill`/`stroke` change. **Every CSS change must work in both light and dark mode.** | [`.agents/skills/light-dark-mode/SKILL.md`](./.agents/skills/light-dark-mode/SKILL.md) |
| Browser persistence: cookies, `localStorage`, `sessionStorage`, IndexedDB, Cache API, Service Worker registration, BroadcastChannel, File System Access API, third-party storage libs (`localforage`, `idb`, `js-cookie`, `Dexie`). The user-facing storage inventory at `/cookies/` and user-facing preferences page at `/settings/` must stay in sync. | [`.agents/skills/cookie-storage-tracker/SKILL.md`](./.agents/skills/cookie-storage-tracker/SKILL.md) |
| Keyboard shortcuts and glossary terms: any new or changed abbreviation, acronym, initialism, inline `abbr`, keyboard shortcut, hotkey, key chord, `KeyboardEvent`, `aria-keyshortcuts`, editor key binding, modal `Esc` behavior, or custom arrow-key operation. The public references at `/glossary/` and `/shortcuts/` must stay in sync. | [`.agents/skills/keyboard-glossary-tracker/SKILL.md`](./.agents/skills/keyboard-glossary-tracker/SKILL.md) |
| Deciding *whether* a diagram earns its place, and *how* to design it pedagogically. Pairs with the `diagrams` skill below. | [`.agents/skills/good-diagrams/SKILL.md`](./.agents/skills/good-diagrams/SKILL.md) |
| Picking the right diagram type and syntax (Mermaid / ArchUML / etc.) and avoiding ASCII art. | [`.agents/skills/diagrams/SKILL.md`](./.agents/skills/diagrams/SKILL.md) |
| Authoring or editing quiz YAML in `_data/quizzes/*.yml` or `quiz:` blocks inside `_data/tutorials/*.yml` — schema, misconception feedback, shuffle-safe phrasing. | [`.agents/skills/quiz-format/SKILL.md`](./.agents/skills/quiz-format/SKILL.md) |
| Creating, editing, reviewing, or extending anything that touches the in-browser tutorial system — `_data/tutorials/*.yml` content or schema, the `_layouts/tutorial.html` / `_layouts/print-tutorial.html` layouts, the `tutorial-*-popup.html` popouts, the `js/tutorial-*.js` runtime / debugger / backend workers, the `SEBook/<section>/<slug>-tutorial.md` + `<slug>-tutorial/print.md` page-pair convention, the `/SEBook/tutorials` auto-index, or any new tutorial-runtime feature. **The skill must be updated in the same change whenever a tutorial-runtime feature is added or modified** so the architecture and YAML schema stay accurate. | [`.agents/skills/tutorial-authoring/SKILL.md`](./.agents/skills/tutorial-authoring/SKILL.md) |
| Designing, evaluating, critiquing, or improving educational content where the real question is *whether learners will actually learn from this* — any SEBook chapter under `SEBook/`, any interactive tutorial under `_data/tutorials/*.yml`, any quiz under `_data/quizzes/*.yml`, any flashcard set under `_data/flashcards/`, CS130 / CS35L lecture material, homework, exams, rubrics, syllabi, study guides, or training modules. Applies Cognitive Load Theory, Mayer's multimedia learning, ICAP, Variation Theory, Bloom's taxonomy, Dunlosky's effective-techniques synthesis, Hattie's Visible Learning, Dehaene's four pillars, Self-Determination Theory, Universal Design for Learning, and Understanding by Design — picking the right lens for the artifact and audience. Defers to the project skills above (`tutorial-authoring`, `quiz-format`, `good-diagrams`, `test-design`) for *operational* mechanics so its recommendations stay aligned with project conventions. Includes a project-specific overlay (`references/content-types/sebook-chapter.md`) covering ArchUML embeds, the flashcard+quiz tail, chapter↔tutorial pairs, the course aggregator, and the bookmark system. | [`.agents/skills/pedagogical-advisor/SKILL.md`](./.agents/skills/pedagogical-advisor/SKILL.md) |
| Creating, editing, restructuring, or deleting any test — Playwright `*.spec.js` end-to-end suites under `tests/`, pytest backend tests, Jest / Vitest unit tests, property-based tests (`hypothesis`, `fast-check`), snapshot assertions, mutation configs, test fixtures, test doubles (`unittest.mock`, `jest.mock`, `sinon`), or any change to wait helpers / sleeps / retries / parallelism in test config. **Every test must capture the spec — no less (liar test), no more (over-specified) — and survive a clean internal refactor.** Covers oracle strength, behavior-vs-implementation, partition + boundary input choice, determinism, the test-doubles decision tree, the Meszaros / van Deursen test-smell catalog, and a Playwright-specific deep-dive at [`.agents/skills/test-design/references/playwright.md`](./.agents/skills/test-design/references/playwright.md) — locator hierarchy (`getByRole`/`getByLabel`/`getByTestId` priority order), auto-waiting and web-first assertions (no `waitForTimeout`), test isolation across browser contexts, `page.route` mocking discipline ("only mock what you don't own"), visual-regression brittleness traps, console-error oracles, soft assertions, and the e2e smell catalog. | [`.agents/skills/test-design/SKILL.md`](./.agents/skills/test-design/SKILL.md) |
| Editing the SE Gym hero customizer SVG — any path in `_includes/se-gym-hero.svg` (hair, hairline, eye, mouth, head, accessory, body-shape, outfit, emblem, mascot groups), any choice/palette/contrast-token logic in `js/se-gym-hero-avatar.js`, or any new visual option. Comic-style avatar art is its own discipline with reliable failure modes — saw-tooth `L`-lines, evenly-spaced mechanical wisps, helmet-sized hair silhouettes. The skill captures the avataaars "one complex path" convention, the Shapes → Tufts → Strands framework, project coordinates, the CSS-variable color system, layer order for cel-shading, and concrete fixes for mistakes that have already shipped and been reverted. | [`.agents/skills/avatar-svg-design/SKILL.md`](./.agents/skills/avatar-svg-design/SKILL.md) |

If a skill's trigger matches your task, reading the skill is **not optional** — these files capture project-specific traps that have caused real bugs and that are not derivable from reading the surrounding code.
