# Project rules

This file is the canonical source of project-wide instructions for any AI coding agent. `CLAUDE.md` and `GEMINI.md` are symlinks to this file.

## Accessibility — WCAG 2.2 Level AA is required

Every change to this repository — new feature, bug fix, refactor, content edit, or dependency bump — must leave every reachable page **fully compliant with [WCAG 2.2 Level AA](https://www.w3.org/TR/WCAG22/)**. This is a hard requirement, not a goal. If you cannot make a change AA-compliant, stop and surface the trade-off to the user before proceeding.

This rule applies to **all** outputs the site produces, including tutorial pages, the SEBook, SEGym, blog posts, print layouts, popout windows, embedded widgets (quizzes, flashcards, audio players, code editors, terminals, UML/diagram renderers), and any new component you introduce.

### What "AA-compliant" means in practice here

Walk this checklist for every change that touches HTML, CSS, JS, SVG, an include, a layout, or content. The criteria below are the ones that get violated most often in this codebase — not the full spec, just the parts you have to actively remember.

- **Contrast (1.4.3 / 1.4.11).** Text needs ≥ 4.5:1 against its background (≥ 3:1 for large text ≥ 18pt or ≥ 14pt bold). UI components, focus indicators, and meaningful graphics need ≥ 3:1. **Verify in both light and dark mode** — see `.agents/skills/light-dark-mode/SKILL.md` for the project's light/dark pattern (`html.dark-mode` class on `<html>`, no `prefers-color-scheme` media queries).
- **Use of color (1.4.1).** Color is never the only signal. Errors, required fields, diff hunks, status badges, and graph edges must also carry a shape, label, icon, or text difference.
- **Non-text content (1.1.1).** Every `<img>` has a meaningful `alt`, or `alt=""` if it's purely decorative. SVG icons that convey meaning need `<title>` or `aria-label`; SVG icons that are decorative need `aria-hidden="true"`. Diagrams (Mermaid, ArchUML, UML) need a text alternative — usually a caption or surrounding prose that conveys the same information.
- **Keyboard (2.1.1, 2.1.2, 2.4.3, 2.4.7, 2.4.11).** Every interactive element is reachable and operable with the keyboard alone, in a logical tab order, with a **visible** focus indicator that is not obscured by sticky headers/footers. No keyboard traps. Use native `<button>` / `<a>` / `<input>` whenever possible — `div` with a click handler is almost always wrong.
- **Page title (2.4.2).** Every page has a unique, descriptive `<title>`.
- **Headings (2.4.6, 1.3.1).** One `<h1>` per page; no skipped heading levels (don't jump h2 → h4); section structure reflects the visual structure.
- **Labels and names (3.3.2, 4.1.2, 2.5.3).** Every form control has an associated `<label>` (or `aria-label` / `aria-labelledby`). Custom controls expose name, role, and state correctly. The accessible name matches or contains the visible text — don't put "Submit" on a button that's labeled "Save".
- **Reflow (1.4.10) and text spacing (1.4.12).** The page works at 320 CSS pixels wide without horizontal scroll, and survives users overriding line-height, letter-spacing, etc. Avoid fixed pixel widths on text containers.
- **Focus not obscured (2.4.11).** Focused elements must not be hidden behind sticky headers, sidebars, or modals. Test by tabbing through the page top-to-bottom.
- **Motion and timing (2.2.2, 2.3.1, 2.3.3).** Auto-playing animations longer than 5 s need a pause/stop/hide control. Nothing flashes more than 3× per second. Respect `prefers-reduced-motion` for non-essential motion.
- **Status messages (4.1.3).** Toasts, "saved" indicators, validation errors, and live progress must use `role="status"` / `role="alert"` / `aria-live` so assistive tech announces them without stealing focus.
- **Target size (2.5.8).** Interactive controls are at least 24×24 CSS pixels (with the spacing exception in the spec).
- **Focus appearance (2.4.13).** Don't remove the default focus outline without replacing it with something visible in both light and dark mode.

### Verification before claiming done

A change is not done until you have verified it. The bar:

1. **Run the audit test for any pages you touched.** The canonical sweep is `tests/wcag22-complete-audit.spec.js` (Playwright). Scope it with `WCAG_AUDIT_URL_FILTER` when iterating, e.g. `WCAG_AUDIT_URL_FILTER='/SEBook/tools/uml-playground' npx playwright test tests/wcag22-complete-audit.spec.js`.
2. **Tab through your change keyboard-only** and confirm focus is visible at every stop, no traps, and no element gets hidden by sticky chrome.
3. **Check both light and dark mode** for contrast on every color you introduced or changed.
4. **Spot-check with a screen reader** (VoiceOver on macOS: ⌘F5) for any new interactive widget — heading structure, labels, status messages, dialog focus.

If you genuinely cannot run a check (e.g. headless environment with no audio output), say so explicitly rather than claiming pass.

### When you find an existing violation

If you discover a pre-existing AA violation in code adjacent to your change, surface it to the user. Don't silently fix sweeping accessibility debt as part of an unrelated PR — split it into its own task so the diff stays reviewable. Do fix violations you *introduced* in the same change.

## Project skills

The project keeps a set of detailed, evidence-based playbooks in [`.agents/skills/`](./.agents/skills/). Claude Code auto-loads these via its skill mechanism, but other agents must read them explicitly when their triggers apply. **Before starting work that matches a trigger below, read the corresponding `SKILL.md` in full.**

For Claude Code only, the same files are also reachable via `.claude/skills/` (a symlink to `.agents/skills/`); for Gemini CLI via `.gemini/skills/` (also a symlink). All three paths resolve to the same content.

| Trigger — start work that involves… | Read this skill |
| --- | --- |
| Any color / CSS / SCSS / inline `<style>` / JS-injected stylesheet / SVG `fill`/`stroke` change. **Every CSS change must work in both light and dark mode.** | [`.agents/skills/light-dark-mode/SKILL.md`](./.agents/skills/light-dark-mode/SKILL.md) |
| Browser persistence: cookies, `localStorage`, `sessionStorage`, IndexedDB, Cache API, Service Worker registration, BroadcastChannel, File System Access API, third-party storage libs (`localforage`, `idb`, `js-cookie`, `Dexie`). The user-facing storage inventory at `/cookies/` must stay in sync. | [`.agents/skills/cookie-storage-tracker/SKILL.md`](./.agents/skills/cookie-storage-tracker/SKILL.md) |
| Deciding *whether* a diagram earns its place, and *how* to design it pedagogically. Pairs with the `diagrams` skill below. | [`.agents/skills/good-diagrams/SKILL.md`](./.agents/skills/good-diagrams/SKILL.md) |
| Picking the right diagram type and syntax (Mermaid / ArchUML / etc.) and avoiding ASCII art. | [`.agents/skills/diagrams/SKILL.md`](./.agents/skills/diagrams/SKILL.md) |
| Authoring or editing quiz YAML in `_data/quizzes/*.yml` or `quiz:` blocks inside `_data/tutorials/*.yml` — schema, misconception feedback, shuffle-safe phrasing. | [`.agents/skills/quiz-format/SKILL.md`](./.agents/skills/quiz-format/SKILL.md) |

If a skill's trigger matches your task, reading the skill is **not optional** — these files capture project-specific traps that have caused real bugs and that are not derivable from reading the surrounding code.
