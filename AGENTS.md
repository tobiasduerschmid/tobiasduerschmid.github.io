# Project rules

This file is the canonical source of project-wide instructions for any AI coding agent. `CLAUDE.md` and `GEMINI.md` are symlinks to this file.

## Accessibility — WCAG 2.2 Level AA is required

Every change to this repository — new feature, bug fix, refactor, content edit, or dependency bump — must leave every reachable page **fully compliant with [WCAG 2.2 Level AA](https://www.w3.org/TR/WCAG22/)**. That means satisfying all 30 Level A *and* all 25 Level AA success criteria — 55 in total — on every page the build emits. This is a hard requirement, not a goal. If you cannot make a change AA-compliant, stop and surface the trade-off to the user before proceeding.

This rule applies to **all** outputs the site produces, including tutorial pages, the SEBook, SEGym, blog posts, print layouts, popout windows, embedded widgets (quizzes, flashcards, audio players, code editors, terminals, UML/diagram renderers), and any new component you introduce.

The full checklist (all 55 success criteria, project-specific gotchas, verification steps, and common pitfalls) lives in [`.agents/skills/wcag-aa-compliance/SKILL.md`](./.agents/skills/wcag-aa-compliance/SKILL.md). Read it before starting any change that affects what reaches the browser. CI enforces the rule via [`tests/wcag22-complete-audit.spec.js`](./tests/wcag22-complete-audit.spec.js).

If you discover a pre-existing AA violation in code adjacent to your change, surface it to the user — don't silently fix sweeping accessibility debt as part of an unrelated PR. Do fix violations you *introduced* in the same change.

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

If a skill's trigger matches your task, reading the skill is **not optional** — these files capture project-specific traps that have caused real bugs and that are not derivable from reading the surrounding code.
