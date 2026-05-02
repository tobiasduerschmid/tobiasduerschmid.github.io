---
name: wcag-aa-compliance
description: Project rule that every reachable page must remain fully compliant with WCAG 2.2 Level AA. USE THIS SKILL EVERY SINGLE TIME you write, edit, review, or remove anything that ends up in the user-facing surface — any HTML / Markdown / Liquid / Jekyll include / layout / page (`*.html`, `*.md`, `_includes/*`, `_layouts/*`), any CSS / SCSS / inline `<style>` / JS-injected stylesheet, any JavaScript that creates / modifies / shows / hides / focuses / labels DOM elements, any SVG (icons, diagrams, charts, decorative graphics), any image (`<img>`, `background-image`, `<picture>`, `<source>`), any `<video>` / `<audio>` / `<track>`, any form control (`<input>`, `<select>`, `<textarea>`, `<button>`, custom widgets, contenteditable surfaces), any color / background / border / shadow / outline change, any focus / hover / active / disabled state, any modal / dialog / popover / tooltip / popout window, any toast / live region / status message / progress indicator, any keyboard handler / shortcut / chord, any drag / pointer / touch / motion handler, any animation / transition / scroll-snap / parallax / autoplay effect, any navigation / menu / breadcrumb / skip-link, any heading / landmark / list / table, any iframe / embedded widget (quizzes, flashcards, code editors, terminals, UML / Mermaid / ArchUML diagrams, audio players), any print stylesheet, any tutorial step / SEBook chapter / SEGym exercise / blog post. Trigger when adding new components / widgets / pages / layouts, changing existing visuals or interactions, fixing bugs that touch the rendered page, refactoring shared CSS, bumping a frontend dependency that emits markup or styles, editing content (yes — alt text, link text, heading levels, error copy, label wording all count), or merging anything that produces output the browser displays. Also trigger on requests like "make this look nicer", "add a button / modal / banner", "fix this color", "add a tooltip", "the page looks weird at small widths", "add a video / audio clip", "add a chart / diagram", "let users drag this around", or any prompt where the change is observable in the browser. Every change must leave the site compliant with all 55 Level A and Level AA success criteria of WCAG 2.2; the audit test at `tests/wcag22-complete-audit.spec.js` enforces this in CI. If you cannot make a change AA-compliant, stop and surface the trade-off to the user before proceeding — this is non-negotiable.
---

# WCAG 2.2 Level AA Compliance

## Why this skill exists

This site is used by students — including students with disabilities, students using screen readers, students using keyboard-only navigation, students on small or zoomed displays, students with low-contrast vision, and students who turn off animation because it makes them dizzy. Tutorials, SEBook chapters, SEGym exercises, and embedded widgets (quizzes, flashcards, code editors, terminals, UML / Mermaid / ArchUML diagrams) all need to work for them.

The project rule is simple and absolute: **every reachable page must satisfy [WCAG 2.2 Level AA](https://www.w3.org/TR/WCAG22/) at all times.** That means meeting all 30 Level A criteria *and* all 25 Level AA criteria — 55 success criteria in total — on every page the build emits. This applies to new features, bug fixes, refactors, content edits, and dependency bumps. There is no "we'll fix it later" grace period; if you cannot make your change AA-compliant, stop and surface the trade-off to the user before proceeding.

This is enforced by [`tests/wcag22-complete-audit.spec.js`](../../../tests/wcag22-complete-audit.spec.js) (Playwright). The test file enumerates the criteria and runs an automated DOM audit across every emitted HTML page. CI runs it on every PR. Automated checks cover roughly half the criteria; the rest require manual verification — that's why this skill exists.

## The four principles (POUR)

WCAG groups its 55 success criteria into four principles. When triaging a change, ask which principle the change most affects, then walk that section's checklist:

1. **Perceivable** — Users must be able to perceive the content (read it, hear it, see it). Includes alt text, captions, contrast, color use, reflow, text spacing.
2. **Operable** — Users must be able to operate the interface (keyboard, focus, no traps, target size, motion). Includes keyboard support, focus management, timing, pointer interactions.
3. **Understandable** — Users must be able to understand both the content and the operation (labels, errors, predictable behavior). Includes language, error handling, consistent help.
4. **Robust** — Content must be robust enough to work with assistive technologies (correct semantics, status messages). Includes accessible names, roles, states, live regions.

## Day-to-day checklist (high-frequency violations)

These are the criteria most often violated in this codebase. Walk this list before claiming a UI change is done — it covers maybe 70% of the issues you will actually introduce. The full criteria reference comes after.

- **Contrast (1.4.3 / 1.4.11).** Text needs ≥ 4.5:1 against its background (≥ 3:1 for large text — 18pt or 14pt bold). UI components, focus indicators, and meaningful graphics need ≥ 3:1. **Verify in both light and dark mode** — see [`light-dark-mode/SKILL.md`](../light-dark-mode/SKILL.md) for the project's `html.dark-mode` pattern.
- **Use of color (1.4.1).** Color is never the only signal. Errors, required fields, diff hunks, status badges, and graph edges must also carry a shape, label, icon, or text difference.
- **Non-text content (1.1.1).** Every `<img>` has a meaningful `alt`, or `alt=""` if it is purely decorative. SVG icons that convey meaning need `<title>` or `aria-label`; SVG icons that are decorative need `aria-hidden="true"`. Diagrams (Mermaid, ArchUML, UML) need a text alternative — usually a caption or surrounding prose that conveys the same information.
- **Keyboard (2.1.1, 2.1.2, 2.4.3, 2.4.7, 2.4.11).** Every interactive element is reachable and operable with the keyboard alone, in a logical tab order, with a **visible** focus indicator that is not obscured by sticky headers/footers. No keyboard traps. Use native `<button>` / `<a>` / `<input>` whenever possible — `div` with a click handler is almost always wrong.
- **Page title (2.4.2).** Every page has a unique, descriptive `<title>`.
- **Headings (2.4.6, 1.3.1).** One `<h1>` per page; no skipped heading levels (don't jump h2 → h4); section structure reflects the visual structure.
- **Labels and names (3.3.2, 4.1.2, 2.5.3).** Every form control has an associated `<label>` (or `aria-label` / `aria-labelledby`). Custom controls expose name, role, and state correctly. The accessible name matches or contains the visible text — don't put "Submit" on a button that's labeled "Save".
- **Reflow (1.4.10) and text spacing (1.4.12).** The page works at 320 CSS pixels wide without horizontal scroll, and survives users overriding line-height, letter-spacing, etc. Avoid fixed pixel widths on text containers.
- **Focus not obscured (2.4.11).** Focused elements must not be hidden behind sticky headers, sidebars, or modals. Test by tabbing through the page top-to-bottom.
- **Motion and timing (2.2.2, 2.3.1, 2.3.3).** Auto-playing animations longer than 5 s need a pause/stop/hide control. Nothing flashes more than 3× per second. Respect `prefers-reduced-motion` for non-essential motion.
- **Status messages (4.1.3).** Toasts, "saved" indicators, validation errors, and live progress must use `role="status"` / `role="alert"` / `aria-live` so assistive tech announces them without stealing focus.
- **Target size (2.5.8).** Interactive controls are at least 24×24 CSS pixels (with the spacing exception in the spec).
- **Focus appearance (2.4.7, 2.4.13).** Don't remove the default focus outline without replacing it with something visible in both light and dark mode.

## Full WCAG 2.2 AA criteria reference

The complete list of all 55 success criteria you must satisfy. The format is `<id> <Level> — <name> — <what to check in this codebase>`. "(NEW in 2.2)" marks the six criteria added in WCAG 2.2 — these are the ones authors most often miss because they are not in older guides.

### 1 — Perceivable

- **1.1.1** A — *Non-text Content.* Every `<img>` has `alt`; meaningful SVGs have `<title>`/`aria-label`; decorative graphics have `alt=""`/`aria-hidden="true"`. Diagrams need a text alternative (caption or surrounding prose).
- **1.2.1** A — *Audio-only and Video-only (Prerecorded).* Provide a transcript for audio-only and a transcript or audio-described version for video-only. Tutorials with screen-recordings count.
- **1.2.2** A — *Captions (Prerecorded).* All prerecorded video with audio has synchronized captions. Use `<track kind="captions">` on `<video>`.
- **1.2.3** A — *Audio Description or Media Alternative (Prerecorded).* Either an audio description track or a full text alternative describing the visual track.
- **1.2.4** AA — *Captions (Live).* Live audio (live streams, webinars) has captions. We don't ship live audio today, but if you add it, captions are required.
- **1.2.5** AA — *Audio Description (Prerecorded).* Audio description for video where dialog and audio do not convey the visual information on their own.
- **1.3.1** A — *Info and Relationships.* Use real semantic HTML — `<table>` with `<th>`/`<caption>`, `<ul>`/`<ol>`, `<fieldset>`/`<legend>`, `<nav>`, `<main>`, `<section>`, `<article>`. Visual grouping that is not in the DOM is invisible to assistive tech.
- **1.3.2** A — *Meaningful Sequence.* The DOM order matches the reading/operation order. Don't use CSS `order:` or absolute positioning to reshuffle the visual order without reshuffling the DOM.
- **1.3.3** A — *Sensory Characteristics.* Don't say "click the green button on the right" — say "click the *Save* button". Instructions must not depend solely on shape, color, size, or position.
- **1.3.4** AA — *Orientation.* The page works in both portrait and landscape; don't lock orientation unless essential. We don't lock orientation, just don't add `screen.orientation.lock()`.
- **1.3.5** AA — *Identify Input Purpose.* For inputs collecting common user data (name, email, address, etc.), set the right `autocomplete` attribute (`autocomplete="email"`, `name`, `tel`, etc.).
- **1.4.1** A — *Use of Color.* Color is never the only differentiator. Pair color with a shape, label, icon, underline, or text difference. Especially watch diff hunks, status chips, required-field markers, graph edges.
- **1.4.2** A — *Audio Control.* Audio that auto-plays for more than 3 s has a pause/stop/mute control independent of system volume. We default audio to opt-in — keep it that way.
- **1.4.3** AA — *Contrast (Minimum).* Body text ≥ 4.5:1 against its background; large text (≥ 18pt or ≥ 14pt bold) ≥ 3:1. Verify in **both** light and dark mode using a contrast checker.
- **1.4.4** AA — *Resize Text.* Text scales to 200% without loss of content or functionality. Avoid fixed-px font sizes for body text; prefer `rem` / `em`.
- **1.4.5** AA — *Images of Text.* Don't use images of text where real text would do. The only exception is logos. Mermaid / ArchUML render to SVG with real text — that is fine.
- **1.4.10** AA — *Reflow.* The page works at 320 CSS pixels wide and 256 CSS pixels tall with no horizontal scroll for vertical content (and vice versa). Two-column tutorial layouts must collapse cleanly. Avoid fixed pixel widths on text containers.
- **1.4.11** AA — *Non-text Contrast.* UI components (button borders, form-input borders, focus rings, toggle states) and meaningful graphics (icons, chart lines, diagram strokes) need ≥ 3:1 against their adjacent colors.
- **1.4.12** AA — *Text Spacing.* The page survives users overriding line-height to 1.5×, paragraph spacing to 2×, letter-spacing to 0.12em, word-spacing to 0.16em. Don't constrain text containers in ways that clip overflow when users widen spacing.
- **1.4.13** AA — *Content on Hover or Focus.* Tooltips and popovers triggered by hover/focus must be **dismissible** (Esc closes them), **hoverable** (the user can move the pointer onto the popover without it disappearing), and **persistent** (they stay until the user dismisses them or moves focus). Don't rely on pure CSS `:hover { display: block }`.

### 2 — Operable

- **2.1.1** A — *Keyboard.* Every interactive element works with the keyboard alone. Custom widgets need correct keyboard handlers (Enter/Space for buttons, arrow keys for menus/tabs/listboxes, Esc for dialogs).
- **2.1.2** A — *No Keyboard Trap.* The user can always tab out of any widget — no infinite focus loops. Modals must release focus to the trigger when closed.
- **2.1.4** A — *Character Key Shortcuts.* If you add a single-key shortcut (e.g. press `s` to save), it must be (a) disable-able, (b) remappable, *or* (c) only active when the relevant component has focus. Otherwise screen-reader users hit it accidentally.
- **2.2.1** A — *Timing Adjustable.* Any time-limit (auto-logout, quiz timer) can be turned off, adjusted (≥ 10×), or extended (≥ 20 s warning + extension). We don't ship hard time-limits today; if you add one, give the user control.
- **2.2.2** A — *Pause, Stop, Hide.* Auto-playing animations or auto-updating content longer than 5 s have a pause/stop/hide control. This includes auto-advancing carousels and looping background videos.
- **2.3.1** A — *Three Flashes or Below Threshold.* Nothing flashes more than 3 times per second. Most things in this codebase don't, but watch CSS animations on diff hunks, "live" indicators, and any `flash` keyframes.
- **2.4.1** A — *Bypass Blocks.* Provide a "skip to main content" link as the first focusable element on every layout. Already present in [`_includes/header.html`](../../../_includes/header.html); preserve it on new layouts.
- **2.4.2** A — *Page Titled.* Every page has a unique, descriptive `<title>`. Set it via the page's front matter `title:` — don't ship `<title>Untitled</title>`.
- **2.4.3** A — *Focus Order.* Tab order matches reading order. If you use `tabindex`, prefer `tabindex="0"` (in DOM order) over `tabindex="N>0"` (which forces specific positions and is fragile).
- **2.4.4** A — *Link Purpose (In Context).* The link text — possibly combined with its sentence/list-item — describes where it goes. Avoid bare "click here" / "read more". Prefer "Read the *UML playground* docs".
- **2.4.5** AA — *Multiple Ways.* Users can reach pages by more than one path: site search, table of contents, sitemap, navigation menus. The SEBook table of contents and SEGym index satisfy this; new feature areas need at least one navigational entry-point besides direct linking.
- **2.4.6** AA — *Headings and Labels.* Headings and form labels are descriptive of the section/control they introduce. Don't use `<h2>Section</h2>` everywhere — make the heading say what the section is about.
- **2.4.7** AA — *Focus Visible.* The focused element has a clearly visible focus indicator. Never `outline: none` without a replacement. Use `:focus-visible` to suppress the ring on mouse clicks while keeping it for keyboard.
- **2.4.11** AA — *Focus Not Obscured (Minimum).* (NEW in 2.2) When an element receives focus, it is not entirely hidden behind sticky headers, footers, sidebars, or modal overlays. Test by tabbing top-to-bottom and watching for elements that disappear under sticky chrome.
- **2.5.1** A — *Pointer Gestures.* Any function operable with a multi-point or path-based gesture (pinch, swipe, two-finger drag) is also operable with a single-pointer gesture (tap, click). Drag-and-drop must have a non-drag fallback.
- **2.5.2** A — *Pointer Cancellation.* Down-events don't trigger destructive actions. Use `click` (not `mousedown`/`pointerdown`) for activation, so the user can drag away to cancel.
- **2.5.3** A — *Label in Name.* The accessible name (what the screen reader announces) contains the visible text. If a button shows "Save", its `aria-label` cannot be "Submit form". Voice-control users say what they see.
- **2.5.4** A — *Motion Actuation.* If a feature is triggered by device motion (shake, tilt), there is also a UI-control alternative, and motion can be disabled.
- **2.5.7** AA — *Dragging Movements.* (NEW in 2.2) Anything operable by dragging (reorderable lists, sliders, drag-and-drop graders) has a single-pointer alternative — buttons, keyboard handlers, or text-input. Pure-drag interactions are forbidden.
- **2.5.8** AA — *Target Size (Minimum).* (NEW in 2.2) Pointer targets are at least 24×24 CSS pixels, **or** spaced so a 24-pixel circle around each target does not overlap. Watch dense icon rows, table cell controls, footnote markers.

### 3 — Understandable

- **3.1.1** A — *Language of Page.* `<html lang="en">` (or whatever the page's language is) is set on every layout. Already set in [`_layouts/default.html`](../../../_layouts/default.html); preserve it.
- **3.1.2** AA — *Language of Parts.* Inline foreign-language phrases use `<span lang="…">` so screen readers switch pronunciation. E.g. `<span lang="de">Schadenfreude</span>`.
- **3.2.1** A — *On Focus.* Receiving focus does not trigger a context change (no auto-submitting, auto-navigation, or surprise modals on focus).
- **3.2.2** A — *On Input.* Changing a form value does not trigger a context change unless the user has been warned. Don't auto-submit on `<select>` change without telling the user.
- **3.2.3** AA — *Consistent Navigation.* Repeated navigation (header, footer, sidebar) appears in the same relative order on every page. Don't reorder header items per-section.
- **3.2.4** AA — *Consistent Identification.* Components with the same function are labeled consistently across pages. The "Toggle dark mode" button is "Toggle dark mode" everywhere — not "Theme" on one page and "Dark mode" on another.
- **3.2.6** A — *Consistent Help.* (NEW in 2.2) If help is offered (contact link, FAQ, chat), it appears in the same relative order on every page that includes it.
- **3.3.1** A — *Error Identification.* Form errors are identified in text, not just by color. Say *which* field is wrong and *what* is wrong.
- **3.3.2** A — *Labels or Instructions.* Form controls have visible labels or instructions. Placeholder text is not a label — it disappears when the user types.
- **3.3.3** AA — *Error Suggestion.* When an error is detected and a suggestion is known, offer it. "Email address must contain @" beats "Invalid input".
- **3.3.4** AA — *Error Prevention (Legal, Financial, Data).* For consequential actions, the user can review/correct before submission, or can reverse it. We don't have legal/financial flows; if you add quiz scoring that is permanent, give a confirmation step.
- **3.3.7** A — *Redundant Entry.* (NEW in 2.2) Don't ask the user to re-enter information they already provided in the same session, unless re-entry is essential (e.g. password confirmation). Pre-fill or remember.
- **3.3.8** AA — *Accessible Authentication (Minimum).* (NEW in 2.2) If you add login, don't require a cognitive function test (puzzle, math, image identification) unless an alternative is available. Allow paste into password fields. We don't ship auth today; if added, follow this rule.

### 4 — Robust

- **4.1.2** A — *Name, Role, Value.* Custom widgets expose correct ARIA name, role, state, and value. A custom checkbox needs `role="checkbox"` and `aria-checked`. Use native elements first; reach for ARIA only when there is no native equivalent.
- **4.1.3** AA — *Status Messages.* Non-focus-stealing status updates (toast notifications, "saved", live validation errors, async loading complete, quiz "correct"/"incorrect" feedback) use `role="status"`, `role="alert"`, or an `aria-live` region. Don't `alert()` — and don't move focus to a status element.

> WCAG 2.2 removed the old 4.1.1 *Parsing* criterion; it is no longer required. Don't ask for it; existing references should not be re-added.

## What's new in WCAG 2.2 (the easy-to-miss ones)

WCAG 2.2 added six criteria over 2.1. Old code, old guides, and many automated tools still don't check these — so they are this codebase's most likely accidental violations:

| Criterion | Level | Watch for |
|---|---|---|
| 2.4.11 *Focus Not Obscured (Minimum)* | AA | Sticky headers/footers covering the focused element when tabbing through. |
| 2.5.7 *Dragging Movements* | AA | Drag-and-drop reorder lists, sliders, drag-to-trash. Always provide a button/keyboard fallback. |
| 2.5.8 *Target Size (Minimum)* | AA | Dense icon rows, footnote markers, table cell buttons under 24×24 px. |
| 3.2.6 *Consistent Help* | A | Contact / help links must keep the same relative position across pages that include them. |
| 3.3.7 *Redundant Entry* | A | Don't re-ask for the same data twice in one flow. |
| 3.3.8 *Accessible Authentication (Minimum)* | AA | If you add login, no cognitive puzzles without alternative. |

If your change is in the territory of any of these, double-check it explicitly — they are the ones easiest to ship without noticing.

## Verification before claiming done

A change is not done until you have verified it. The bar:

1. **Run the audit test for any pages you touched.** The canonical sweep is [`tests/wcag22-complete-audit.spec.js`](../../../tests/wcag22-complete-audit.spec.js) (Playwright). Scope it with `WCAG_AUDIT_URL_FILTER` while iterating, e.g.:
   ```bash
   WCAG_AUDIT_URL_FILTER='/SEBook/tools/uml-playground' \
     npx playwright test tests/wcag22-complete-audit.spec.js
   ```
   For a comprehensive run set `WCAG_AUDIT_FULL_SWEEP=1` (slower; CI uses this).
2. **Tab through your change keyboard-only** and confirm focus is visible at every stop, no traps, and no element gets hidden by sticky chrome (1.4.11, 2.1.1, 2.1.2, 2.4.3, 2.4.7, 2.4.11).
3. **Check both light and dark mode** for contrast on every color you introduced or changed (1.4.3, 1.4.11). See [`light-dark-mode/SKILL.md`](../light-dark-mode/SKILL.md).
4. **Resize and reflow.** Open DevTools, set the viewport to 320 px wide, confirm no horizontal scroll and no clipped content (1.4.10, 1.4.12).
5. **Spot-check with a screen reader** for any new interactive widget — heading structure, labels, status messages, dialog focus (1.1.1, 1.3.1, 2.4.6, 3.3.2, 4.1.2, 4.1.3). VoiceOver on macOS: ⌘F5.
6. **Disable color**, briefly, to confirm color is not the only signal (1.4.1). Chrome DevTools → *Rendering* → *Emulate vision deficiencies* → *Achromatopsia*.
7. **Toggle reduced motion** in your OS and confirm non-essential animations stop or shorten (2.2.2, 2.3.3).

If you genuinely cannot run a check (e.g. headless environment with no audio output, no GUI for VoiceOver), say so explicitly rather than claiming pass. A reasoned "automated checks pass; could not visually confirm focus order in this environment" is much better than a false claim of success.

## When you find an existing violation

If you discover a pre-existing AA violation in code adjacent to your change, **surface it to the user** rather than silently fixing it. Don't pile sweeping accessibility debt into an unrelated PR — split it into its own task so the diff stays reviewable.

Do fix violations you *introduced* in the same change; that is the diff under review and it is your responsibility.

When surfacing, include: which criterion is violated, where (file + line), what would fix it, and a rough estimate of scope (one-line tweak vs. structural rewrite). The user decides whether to add it to the current change, file a follow-up task, or defer.

## Common mistakes (don't do these)

- **Removing `outline: none` without a replacement** — a focus indicator is required (2.4.7). If the default ring clashes with your design, restyle it via `:focus-visible { outline: 2px solid …; outline-offset: 2px; }` — don't delete it.
- **Using a `<div>` with a `click` handler** — keyboard users can't activate it, screen-reader users don't know it's interactive (2.1.1, 4.1.2). Use `<button type="button">` or `<a href="...">`. If you genuinely need a div, you must add `role`, `tabindex="0"`, Enter/Space handlers, and matching ARIA state — that is almost always more work than just using the right element.
- **Color-only error states** — `border: 1px solid red` with no icon, no text, no `aria-invalid` (1.4.1, 3.3.1). Pair color with text and an `aria-describedby` that points to the error message.
- **Placeholder as label** — placeholders disappear on input (3.3.2). Use a real `<label>` (visible or `sr-only`).
- **Tooltips that vanish on hover-out without a way to dismiss with keyboard** — fails 1.4.13. Make the tooltip dismissible with Esc, persistent until dismissed, and hoverable.
- **`<img alt="image of...">`** — screen readers already announce "image"; don't repeat it. Just say what the image *is* in context.
- **Auto-advancing carousels** — they fail 2.2.2 unless they have a pause control. Default to no auto-advance, or include a visible pause/stop button.
- **Hover-only affordances** — features that only appear on hover are invisible to touch and keyboard users (2.1.1). Always provide a focus-visible or always-visible alternative.
- **Tab order mismatch** — using `position: absolute` or CSS `order:` to visually reshuffle without updating the DOM (1.3.2, 2.4.3). Match DOM order to reading order.
- **`aria-label` that contradicts visible text** — fails 2.5.3. Voice-control users say what they see; the accessible name must contain the visible label.
- **Hardcoded heading levels that skip** — going `<h2>` → `<h4>` because `<h3>` "looks too big" (1.3.1, 2.4.6). Use the right level and restyle with CSS.
- **Drag-only interactions** (NEW concern in 2.2) — every drag-to-reorder, drag-to-resize, drag-to-trash must have a button/keyboard alternative (2.5.7).
- **24px target sizes ignored** (NEW concern in 2.2) — dense rows of small icon buttons, footnote markers, X-close buttons that are 16×16. Either enlarge or space them so a 24-px circle doesn't overlap (2.5.8).

## Quick decision guide

| Situation | What to do |
|---|---|
| Adding any new interactive element | Use a native element (`<button>`, `<a>`, `<input>`). Give it a visible label or `aria-label`. Verify keyboard, focus ring, contrast in both modes, target size ≥ 24×24. |
| Adding a new color | Run a contrast check (≥ 4.5:1 text, ≥ 3:1 UI/large text) in both light and dark mode. Pair with shape/icon/text if it conveys state. |
| Adding a new image or icon | Decide: meaningful → `alt="..."` / `<title>` / `aria-label`; decorative → `alt=""` / `aria-hidden="true"`. |
| Adding a diagram (Mermaid / ArchUML / UML) | Add a caption or surrounding prose that conveys the same information for non-visual users. See [`good-diagrams/SKILL.md`](../good-diagrams/SKILL.md) and [`diagrams/SKILL.md`](../diagrams/SKILL.md). |
| Adding a video or audio clip | Provide captions (`<track kind="captions">`) and a transcript. No autoplay with audio. |
| Adding a form | Real `<label>` for every control. Errors in text, not just color. Use `autocomplete` for common fields. Don't use placeholder as label. |
| Adding a modal / dialog | Trap focus inside while open, restore focus to trigger on close. Esc closes. `role="dialog"` + `aria-labelledby`. |
| Adding a tooltip / popover | Trigger on focus, not just hover. Dismissible with Esc, persistent, hoverable (1.4.13). |
| Adding a drag interaction | Provide a non-drag alternative (buttons, keyboard arrow keys, text input) (2.5.7). |
| Adding a status update / toast | `role="status"` or `aria-live="polite"`; don't move focus to it (4.1.3). |
| Adding a sticky header / footer | Verify focused elements are not hidden behind it when tabbing (2.4.11). |
| Editing content (alt text, headings, labels) | Yes, this counts. Verify alt text is meaningful, headings don't skip levels, labels match the visible text. |
| Bumping a frontend dependency | Re-run the audit test on representative pages — dependency updates can silently regress accessibility. |
