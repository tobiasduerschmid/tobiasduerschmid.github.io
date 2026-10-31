---
name: print-light-mode
description: >-
  Project rule that every printed page and exported PDF comes out in the LIGHT palette, whatever theme the reader saved, with WCAG AA contrast on paper. USE THIS SKILL EVERY SINGLE TIME you write, edit, review, or remove anything that affects how a page prints or exports: any `@media print` rule in `css/*.css` or `_sass/_print.scss`, `css/print-light.css`, anything keyed on `html.print-light-mode`, the print controller `_includes/print-light-controller.html` or `_includes/head.html`, any `window.print()` / `beforeprint` / `afterprint` / `matchMedia('print')` code, print views (`<slug>/print.md`, the `print-tutorial`, `narration-notes`, and narrated-reader layouts), pop-outs and standalone pages with their own `<head>`, any script that restores or toggles the saved theme (`classList.add('dark-mode')`, a `?dark=1` or `?theme=dark` parameter, a cookie read), and any filled, colored, or dark component (buttons, badges, step numbers, callouts, code chips, panels, progress bars, artwork) that could print as a dark block or as light text on a fill. Trigger on requests like "fix the print layout", "this prints dark", "the PDF has yellow headings", "add a print view", "make this page printable", "export to PDF", "the print audit fails", or a new page, popout, or layout with its own `<head>`. Print is paper: the dark theme must never reach it. The dark theme leaking into print has shipped before (gold headings and white links on white paper), and it was invisible on screen and in the default audit sample, so this skill records where the guarantee lives and how to prove it.
---

# Print Light Mode

## Why this skill exists

Print is paper. Whatever theme a reader saved, a printed page or exported PDF must be the light palette: dark text on white, readable contrast, no large dark blocks. This site's dark theme is a runtime class (`html.dark-mode`) that scripts re-apply at load, and print used to leak it: a page loaded under print media (headless PDF export, and the print audit) held both `print-light-mode` and `dark-mode`, and the dark rules won. The result was gold headings and white citation links on white paper, on 7 of the 11 pages in the default audit sample. Nothing looked wrong on screen, which is why this needs its own rules. It is also an accessibility requirement: the AA rule in `AGENTS.md` covers print layouts (see [`wcag-aa-compliance`](../wcag-aa-compliance/SKILL.md)).

## Where the guarantee comes from

1. **The print controller, [`_includes/print-light-controller.html`](../../../_includes/print-light-controller.html).** While print mode is active (`beforeprint`, or `matchMedia('print')` matching, including at load), it adds `print-light-mode`, removes `dark-mode`, and **keeps it off**: a `MutationObserver` reverts any script that re-applies the theme. `exitPrintMode` restores the saved theme, so the cookie and the reader's preference are never changed. It leaves a `print-light-mode` class the document already had, so it is safe on print-light-by-design documents.
   - [`head.html`](../../../_includes/head.html) includes it, which covers the shared layouts (`default`, `blog`/`blog-post`, `framework`, `sebook`, `sebook-combined`, `tutorial`).
   - Pages with their own `<head>` that can carry `dark-mode` must add `{% include print-light-controller.html %}` themselves: the tutorial and UML pop-outs, `uml-python-workspace.html`, and the narrated reader layouts do. A file without front matter needs an empty `---` / `---` block first so Liquid runs.
2. **Dedicated print documents** (`print-tutorial`, `narration-notes`, and the narrated readers' `print_view`) set `print-light-mode` statically on `<html>` and never carry `dark-mode`: the head preference loader skips the theme when that class is present, and `print-tutorial` also enforces it with its own observer.
3. **CSS fallback, [`css/print-light.css`](../../../css/print-light.css).** Loaded last on every printable page. Its `@media print` block resets `html.dark-mode:not(.print-light-mode)` for a print that never enters runtime print mode. The `:not(.print-light-mode)` gate is deliberate: it protects the coloured teaching artwork in dedicated print documents. Do not loosen it.
4. **Global print policy, [`_sass/_print.scss`](../../../_sass/_print.scss)** (compiled into `main.css`): white page, `#111` text, UCLA-blue headings, `#eef` code chips, and `print-color-adjust: exact` on everything, so fills print regardless of the browser's "Background graphics" setting. Pages that do **not** load `main.css` (print views, narration notes, pop-outs, narrated readers) get none of this.
5. **Tutorials print through a dedicated view.** `tutorial.html` opens `<slug>/print.html` on Ctrl/Cmd+P and on `beforeprint`. Players and video are replaced by transcripts in print (`song-video.css`); stage documents are export-only.

## Rules for authors

- **Never fix a theme leak with per-layout guards or print overrides.** Scripts that restore the saved theme need no print check; the controller owns it. If a page leaks, check that it includes the controller.
- **Screen-only colour rules belong in `@media screen`.** A high-specificity `!important` colour rule written for light or dark mode will beat print rules. `h1 code, … { color: inherit !important }` is wrapped in `@media screen` because inheriting the print heading blue puts code at 4.36:1 on its `#eef` chip.
- **Interactive controls print plain.** Buttons read the `--sebook-button-*` tokens, which print overrides on **`:root`**, not `html` (the theme defines them on `:root`, which out-ranks `html`; an `html` override silently does nothing). Danger buttons don't use the tokens, so `print-light.css` prints them as outlines. No new control may print as a large dark filled block.
- **Light text on a fill needs the fill to print.** Under `main.css` it does. Anywhere else, either set `print-color-adjust: exact` on the element (a content badge such as `.step-number` in `tutorial-print.css`) or print it as dark text on white (interface chrome such as the selected tab, `.tvm-diagram-type-btn.active` in `tutorial.css`, which also gets a heavier border so the selected state does not depend on color). Prefer the second for controls: it needs no ink and does not depend on the browser's "Background graphics" setting.
- **Print contrast:** text 4.5:1, large text 3:1, measured against what is actually painted. The audit flags any opaque element of at least 8,000 px² with luminance under 0.35. Decorative artwork in dedicated print documents keeps its colours by design, but the dark-surface rule still applies to it, so prefer light grounds for large illustration shapes.
- **Keep base, `html.dark-mode`, and `@media print` rules together** (project rule), and check light mode, dark mode, and print for every colour you add.
- **A new page family needs a print path.** Give it the controller (or a static `print-light-mode`), load `print-light.css` last, and add it to the verification below.

## Verify

Print audit (print media with a saved dark preference; report in `tmp/`):

```bash
npx playwright test tests/wcag22-print-audit.spec.js                       # one page per family, a sample
WCAG_PRINT_AUDIT_URL_FILTER='^/blog/' npx playwright test tests/wcag22-print-audit.spec.js
WCAG_PRINT_AUDIT_PAGE_LIMIT=4 npx playwright test tests/wcag22-print-audit.spec.js
WCAG_PRINT_AUDIT_FULL_SWEEP=1 npx playwright test tests/wcag22-print-audit.spec.js   # every page, about 25 minutes
```

Report a sample as a sample. It takes the first page per family, which for blog is the `/blog/` index, so posts are only covered by the URL filter. The audit injects `dark-mode` after load; the controller reverts that on pages that include it, so it measures real light-print output there.

The audit does not catch everything. For a wider check, load every built page under print media with the `dark-mode=true` cookie and `?dark=1&theme=dark` on the URL (the mechanisms real pages use to restore a theme), and flag: `dark-mode` still on `<html>`, a dark `color-scheme`, a page background that is not light, opaque surfaces of at least 8,000 px² with luminance under 0.35, and text that only reaches its contrast against a fill, which is invisible when the browser skips background graphics unless `print-color-adjust: exact` applies. Ignore content parked off the page, such as the skip link at `left: -9999px`. Sweeps like this found the pop-out theme leaks and several text-on-fill cases that the audit's sample never reached.

Regression specs: [`tests/print-light-theme.spec.js`](../../../tests/print-light-theme.spec.js) (saved dark theme via cookie or URL, loaded in print mode, print then restore, on a blog post, a chapter, the home page, a pop-out, and a narration reader) and [`tests/print-contrast.spec.js`](../../../tests/print-contrast.spec.js) (buttons, heading code). Shared helpers: `tests/print-helpers.js`. Keep both green when touching theme or print code.

Look at the real output. Set the `dark-mode=true` cookie, load the page **under print media** (what headless exporters do) and also load it on screen then print, then render it:

```js
await page.emulateMedia({ media: 'print' });
await page.goto(url);
await page.pdf({ path: 'out.pdf', printBackground: true });   // then: pdftoppm -png -r 45 -f 1 -l 1 out.pdf out
```

To see why an element has its colour, list the media-aware `color` rules that match it; to check a token, read `getComputedStyle(document.documentElement).getPropertyValue('--sebook-button-primary-bg')` under print emulation.

## Traps already hit

- Blog posts and SEBook chapters re-apply the saved theme at DOM ready, after print mode has begun when the page is loaded for print. The controller's observer is what makes that harmless.
- A page holding both `dark-mode` and `print-light-mode` cannot be saved by CSS, because the fallback is gated on the class being absent. Fix it at the source.
- `/SEBook/all.html` and `/SEBook/CS35L.html` are huge: under load the audit reports a navigation timeout there. That is not a print finding; re-run them alone.
- A change that passes the default sample can still fail on a page the sample skips. When you touch shared print CSS, run a wider sample or the full sweep.

## Related skills

[`light-dark-mode`](../light-dark-mode/SKILL.md) for the screen themes, [`wcag-aa-compliance`](../wcag-aa-compliance/SKILL.md) for the AA rule and PDF export checks, [`test-design`](../test-design/SKILL.md) for writing the specs, and [`maintainable-code`](../maintainable-code/SKILL.md) for where presentation lives.
