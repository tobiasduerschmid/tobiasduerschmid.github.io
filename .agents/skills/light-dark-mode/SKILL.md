---
name: light-dark-mode
description: >-
  Project rule that every CSS change must work in BOTH light mode and dark mode. USE THIS SKILL EVERY SINGLE TIME you write, edit, review, or remove anything that affects how the page looks — any rule in a `.css` or `.scss` file under `css/` or `_sass/`, any `<style>` block inside a Jekyll include / layout / page (`_includes/*.html`, `_layouts/*.html`, `*.html`, `*.md` front-matter pages), any JS-injected stylesheet (template-literal CSS strings, `document.createElement('style')`, `style.textContent = '...'`, `style.innerHTML = '...'`, `appendChild(styleEl)`, `insertRule()`, `CSSStyleSheet`), any inline `style="..."` attribute, any `element.style.color = ...` / `element.style.backgroundColor = ...` / `element.style.borderColor = ...` / `element.style.boxShadow = ...` / `element.style.fill = ...` / `element.style.stroke = ...` / `element.style.cssText = ...`, any SVG `fill=` / `stroke=` / `<style>` inside SVG, any new CSS custom property (`--foo: #...`), any change to a color, background, border, shadow, outline, or filter — even a one-line tweak. Trigger when adding new components / widgets / modals / tooltips / popovers / chips / badges, changing existing colors, introducing new hex values (`#fff`, `#000`, `#abc123`), `rgb()` / `rgba()` / `hsl()` / `hsla()` / named colors (`white`, `black`, `gray`, `red`, etc.), `box-shadow` (especially `rgba(0,0,0,...)` shadows that vanish on dark), `border-color`, `outline-color`, `background-image` with gradients, SVG icons, Mermaid / ArchUML / UML diagrams, syntax-highlight themes, code blocks, terminal output panels, form inputs, focus rings, hover/active/disabled states, scrollbars, dividers, tables, charts, or anything where a contrast assumption is baked in. Also trigger on requests like "make this look nicer", "tweak the color", "fix the styling", "match the rest of the page", "the button is hard to see", "add a card / panel / banner", "highlight this", "add a hover effect", "give this a subtle shadow", or any request that will end up emitting CSS to the browser. The site has a JS-toggled dark mode via `html.dark-mode` and users actually use it — if you only style one mode, the other mode breaks (invisible text, white flashes, illegible code blocks, unreadable diagrams). This is non-negotiable: a CSS change is not done until both modes look correct.
---

# Light Mode & Dark Mode

## Why this skill exists

This site has a real dark mode that real users use. It is **not** `@media (prefers-color-scheme: dark)` — it is a **JavaScript-toggled class on the `<html>` element**:

```js
document.documentElement.classList.add('dark-mode');     // user clicked the moon
document.documentElement.classList.remove('dark-mode');  // user clicked the sun
```

The toggle button lives in [`_includes/header.html`](../../../_includes/header.html), the choice is persisted in `localStorage`, and the class is re-applied on every page load by [`_includes/head.html`](../../../_includes/head.html) before paint. That means **`html.dark-mode` can be present on any page at any time**, and any CSS rule you write — anywhere — will be evaluated in both states.

If you write only the light-mode version of a rule, dark-mode users see white-on-white, white flashes between page loads, illegible code blocks, or shadows that disappear into the page. If you write only a dark-mode override and forget the default, light-mode users get the same problem in reverse. **A CSS change is not done until you have considered both modes.**

This is especially load-bearing for tutorials, where students often switch to dark mode for late-night study sessions, and where unreadable code blocks or invisible diagrams cause real friction.

## The pattern (use this, not media queries)

This project does **not** use `@media (prefers-color-scheme: dark)` anywhere. Don't introduce it — it would race with the JS toggle and produce inconsistent results when the user's OS preference differs from their site preference. Use the class selectors instead:

```css
/* Default rule — applies in light mode (and serves as the base in dark mode if not overridden) */
.my-thing {
  background: #fff;
  color: #1a1a1a;
  border: 1px solid #d0d7de;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

/* Dark-mode override — the class is on <html>, so the selector chains from there */
html.dark-mode .my-thing {
  background: #1c2533;
  color: #e6edf3;
  border-color: #2a323e;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4); /* shadows need to be darker on dark backgrounds */
}
```

When you specifically need to scope a rule to **light mode only** (e.g. you are overriding an inherited dark-mode style, or you have a base rule that should not apply in light mode), use:

```css
html:not(.dark-mode) .my-thing { ... }
```

Both forms are heavily used in the existing CSS — search for them and follow the local convention.

## What to consider for every CSS change

Walk through this short mental checklist for any color-bearing property you write or edit. If you can't honestly answer "yes" to all of these, the change isn't done.

1. **Background colors** — Does the background still have enough contrast with text in dark mode? White (`#fff`) backgrounds blind dark-mode users; near-black (`#0d1117`-ish) backgrounds disappear in light mode.
2. **Text colors** — `#000` / `#1a1a1a` is fine on white but invisible on `#1c2533`. Pair every text color change with a dark-mode counterpart.
3. **Borders & dividers** — `#e0e0e0` borders vanish on dark backgrounds; bright borders on light backgrounds become harsh lines. Both directions need their own value.
4. **Box-shadows** — `rgba(0,0,0,0.08)` is *invisible* on a dark panel. Either bump the opacity (`0.4`+) for dark mode or swap the color. Same for `text-shadow`.
5. **Hover / focus / active / disabled states** — A button with a `:hover` background change needs the dark-mode equivalent too, or the affordance disappears. Focus rings (`outline`, `:focus-visible`) need to be visible against both backgrounds.
6. **Form inputs** — Default browser styling is light-themed. Inputs / textareas / selects almost always need explicit dark-mode `background` and `color`, or they look like a light-mode element pasted onto a dark page.
7. **Code blocks & terminal panels** — These often have their own theme (e.g. Prism, custom terminal output). Verify both themes — a syntax highlighter built for light mode is unreadable on dark and vice versa.
8. **SVG / icons / diagrams** — Inline SVGs with hardcoded `fill=` / `stroke=` don't auto-flip. The project pattern for diagrams is the invert filter (see Mermaid / ArchUML section below). For one-off icons, prefer `currentColor` so they inherit the surrounding `color`.
9. **Gradients & background images** — A gradient designed for a white page often looks muddy on a dark page. Pick a dark-mode gradient or skip the gradient in dark mode.
10. **Semi-transparent overlays** — `rgba(255,255,255,0.6)` overlays read as a frosted layer in light mode but as a glow in dark mode. Pick mode-appropriate values.

## Where CSS changes actually live (so you don't miss any)

"Every CSS change" includes more than `.css` files. All of these emit CSS to the browser and **all of them need both modes**:

- **Stylesheets** — `css/*.css`, `_sass/*.scss`, `css/main.scss`. Most rules live here.
- **`<style>` blocks inside Jekyll includes / layouts / pages** — e.g. `_includes/flashcards.html`, `_includes/quiz.html`, `_includes/header.html`. These are first-class CSS; they already contain `html.dark-mode` rules, so any new style you add here must too.
- **JS template-literal CSS** — code like `js/tutorial-refactorings.js` and `js/tutorial-popout-manager.js` injects entire stylesheets via `<style>` tags built from string literals. These are CSS — same rule applies. Search for `'html.dark-mode` in JS to find the existing pattern.
- **Programmatic styles** — `element.style.background = '#fff'`, `style.cssText = '...'`, `setAttribute('style', '...')`, `insertRule()`. If the value is conditional on theme, branch on `document.documentElement.classList.contains('dark-mode')`. If it's a static color, prefer moving it to a stylesheet so the dark-mode variant can sit next to it.
- **SVG attributes** — `fill="#000"`, `stroke="#333"` inside `<svg>` tags. Replace with `currentColor` where possible, or add a dark-mode override CSS rule that targets the SVG selector.

## Special cases this project already handles

### Mermaid / ArchUML / UML diagrams

These render SVG with a baked-in light theme. The site flips them in dark mode using a CSS filter rather than re-theming them:

```css
html.dark-mode div.mermaid svg { filter: invert(1) hue-rotate(180deg); }
```

If you add a new diagram type or a new SVG-rendering widget, follow this pattern (or theme the SVG natively). See [`js/mermaid-theme.js`](../../../js/mermaid-theme.js) for the canonical example and the comments around line 170 explaining why.

### Workspace panels that are always dark

Some IDE-style panels (the editor / terminal pane) are intentionally dark in **both** modes — see the comment "Always dark-mode for the workspace panels" at the top of [`css/tutorial.css`](../../../css/tutorial.css). When editing those panels, match the existing convention: the dark colors are the default, and the only mode-specific rules are `html:not(.dark-mode)` rules for the surrounding chrome (toolbar buttons, labels) so they stay legible against the page's white background.

### Popout windows

Tutorial popouts pass the dark-mode state through the URL (`&dark=0|1`) and re-apply the class on the popup's `<html>` — see [`js/tutorial-popout-manager.js`](../../../js/tutorial-popout-manager.js). If you create a new popout / detached pane, propagate the theme the same way, otherwise the popup defaults to light and looks broken next to a dark parent.

## Verification (do this before claiming done)

You cannot tell from code alone whether the colors actually work — verify visually. The fastest path:

1. Open the page that exercises your change in a browser.
2. Toggle dark mode using the moon/sun button in the site header (or run `document.documentElement.classList.toggle('dark-mode')` in DevTools).
3. Look at the affected element in **both** states. Check: text legibility, border visibility, shadow visibility, hover/focus feedback, and that you don't see a flash of the wrong theme on initial load.
4. If the element has interactive states (hover, focus, active, disabled), exercise them in both modes.

If you genuinely cannot run the site (e.g. you're operating headlessly), say so explicitly rather than claiming the change is verified. A reasoned "the colors are paired but I could not visually confirm" is much better than a false claim of success.

## Common mistakes (don't do these)

- **Adding a `#fff` background without a `html.dark-mode` override.** This is the single most common failure. Search your diff for `#fff`, `white`, `#ffffff` — every one needs a paired dark-mode rule unless you've consciously decided light-on-light is correct.
- **Adding `@media (prefers-color-scheme: dark)`.** Wrong mechanism for this project. Use `html.dark-mode`.
- **Forgetting hover/focus/disabled.** A `.btn { background: #eee }` with `.btn:hover { background: #ddd }` needs *both* its hover and base style overridden in dark mode — not just the base.
- **Shadows that disappear on dark.** `box-shadow: 0 2px 8px rgba(0,0,0,0.06)` is invisible on `#1c2533`. Either swap to a darker shadow or use a light glow (`rgba(255,255,255,0.04)`) for the dark-mode variant.
- **Hardcoded SVG `fill="#000"` / `stroke="#333"`.** They don't flip. Use `currentColor`, a CSS class, or add an explicit `html.dark-mode svg ...` rule.
- **JS that sets `style.color = '#000'` unconditionally.** Either branch on the dark-mode class, or move the color to a class-based rule and toggle the class instead.
- **Adding a new CSS file without touching existing dark-mode rules but expecting them to apply.** Dark-mode rules in this project are explicit per selector — if your new selector isn't covered, you need to add the override yourself.
- **Assuming "the page already does dark mode" means your new component does too.** It does not. Inheritance only carries you so far — most components in this codebase have explicit per-component dark-mode rules, and yours should too.

## Quick decision guide

| Situation | What to do |
| --- | --- |
| Adding a new component with any color | Write the default rule + a paired `html.dark-mode .your-component { ... }` block |
| Tweaking an existing color | Find the existing `html.dark-mode` rule for that selector and update it in lockstep |
| Adding an inline `<style>` in an include | Add the `html.dark-mode` block right next to it in the same `<style>` |
| Injecting CSS from JS | Include both light and dark rules in the same template literal — `'html.dark-mode .x { ... }'` |
| Setting `element.style.X` from JS | Check `document.documentElement.classList.contains('dark-mode')` and branch — or, better, toggle a class instead |
| Adding an SVG icon | Use `currentColor` for `fill` / `stroke` so it inherits the text color, or add an explicit dark-mode override |
| Adding a Mermaid / ArchUML diagram | The existing invert filter handles it — verify visually that the result is legible |
| Working on the editor / terminal workspace panels | These are always dark; match the local convention — light-mode overrides are for the chrome only |
