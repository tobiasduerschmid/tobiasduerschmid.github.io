# Reduced motion — required gating for every animation that ships

Every animation in this project — every SMIL `<animate>`, every CSS `@keyframes`, every JS-driven motion — must respect the user's `prefers-reduced-motion` setting. This is non-negotiable for production assets.

## The user need

Up to 35% of adults experience vestibular discomfort (dizziness, nausea, disorientation) from animated motion on a screen. The most common triggers are large translations, parallax scrolling, sudden zooms, and persistent rotation. For some users this is a passing annoyance; for others it triggers migraines or vertigo lasting hours.

The OS-level setting `prefers-reduced-motion: reduce` is how these users tell their browser "do not animate things at me unnecessarily". macOS, Windows, iOS, Android, and Linux all expose this setting. The browser surfaces it as a CSS media query and as a JS API.

## The WCAG rule

**WCAG 2.2 Success Criterion 2.3.3 — Animation from Interactions** (Level AAA): motion triggered by interaction can be disabled.

The closely related **Success Criterion 2.2.2 — Pause, Stop, Hide** (Level A): for any moving, blinking, or scrolling content that starts automatically, lasts more than 5 seconds, and is presented in parallel with other content, the user can pause, stop, or hide it.

This project enforces both. An autoplaying idle cycle on a hero illustration *is* "moving content presented in parallel with other content" — it must respond to the user's reduced-motion preference, or the page fails AA.

## The amplitude question — even *without* reduced-motion, keep it subtle

Even users without reduced-motion enabled benefit from restrained motion. A character that bobs ±3 px reads as alive; a character that bobs ±20 px reads as a panic attack. Cap idle motion at the amplitudes in [`./idle-cycles.md`](./idle-cycles.md):

- Translation: ±3–5 px in a 640-wide viewBox
- Rotation: ±1–2°
- Scale: 0.97–1.03 (a 3% pulse)
- No parallax on idle. No background-position drift on idle. No persistent zoom.

If you're tempted to make idle motion more dramatic, *don't* — instead make it briefer, triggered by an event (hover, scroll-into-view), and gate that interaction behind reduced-motion.

## Pattern 1 — CSS `@media (prefers-reduced-motion: reduce)`

For animations driven by CSS `@keyframes`, the standard pattern is to define the animation once, then disable it inside a reduced-motion media query:

```css
.hero-figure {
  animation: hero-breath 2.2s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .hero-figure {
    animation: none;        /* simplest: just stop. */
  }
}
```

`animation: none` is the cleanest *removal*. Alternatives:

- `animation-play-state: paused` — the animation freezes at whatever frame it was at when the page loaded. Useful when the figure happens to look fine in any pose.
- `animation: hero-breath-static …` — swap in a different keyframe set that holds a single state. Useful when you want a deliberate fallback pose.

**Inverse pattern (preferred for new code):** declare reduced motion as the default, then opt in to motion when the user has *no preference*:

```css
.hero-figure {
  /* no animation by default */
}

@media (prefers-reduced-motion: no-preference) {
  .hero-figure {
    animation: hero-breath 2.2s ease-in-out infinite;
  }
}
```

This guarantees the figure works without animation. The only way to see the breath is to actively opt in (which is what the user's OS setting expresses). It's a safer default — a bug in the media query can't accidentally leak motion into a reduced-motion user's session.

## Pattern 2 — SMIL animations + `prefers-reduced-motion`

SMIL `<animate>` and `<animateTransform>` *cannot* be gated by a CSS media query alone — they ignore CSS `animation: none`. You need a different mechanism.

### Option A — Wrap in a CSS class and use `display: none` for the animation source

If the entire `<g>` only exists to hold animations, hide it:

```svg
<g id="idle-loop" class="hero-motion-only">
  <animateTransform …/>
  …
</g>
```

```css
@media (prefers-reduced-motion: reduce) {
  .hero-motion-only { display: none; }
}
```

This works only when the animated `<g>` has no rendered children that should remain visible — for example, a sparkle effect group whose only purpose is animation. It does *not* work for a `<g>` that contains the character body and *also* animates it.

### Option B — Use `begin="indefinite"` and start the animation only via JS when motion is allowed

```svg
<animateTransform attributeName="transform" type="translate"
                  values="0 -3; 0 3; 0 -3" dur="2.2s"
                  repeatCount="indefinite"
                  begin="indefinite"
                  id="hero-breath-anim"/>
```

`begin="indefinite"` means the animation is set up but never starts on its own. Then in JavaScript:

```javascript
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.getElementById('hero-breath-anim').beginElement();
}
```

This is the most reliable pattern for SMIL in a reduced-motion-aware page. The animation doesn't start *at all* for reduced-motion users — there's no "I'm pausing it" race condition to worry about.

### Option C — Conditionally inline the animation via Jekyll / Liquid

If your build system has access to the user-agent or a build-time flag (rare), you can render the `<animate>` elements only conditionally. In Jekyll this is not generally possible at request time, but for *progressively-enhanced* sites you can render a static SVG and have a JS hook upgrade it with SMIL when motion is allowed:

```javascript
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  // Inject <animateTransform> nodes into the SVG.
  const breath = document.createElementNS('http://www.w3.org/2000/svg', 'animateTransform');
  breath.setAttribute('attributeName', 'transform');
  breath.setAttribute('type', 'translate');
  breath.setAttribute('values', '0 -3; 0 3; 0 -3');
  breath.setAttribute('dur', '2.2s');
  breath.setAttribute('repeatCount', 'indefinite');
  document.getElementById('hero-torso').appendChild(breath);
}
```

This is the cleanest separation but requires JS. For purely-static SVG includes, Option B is usually better.

## Pattern 3 — Listening for *changes* to the preference

A user can toggle their OS setting while your page is open. Listen for changes with `MediaQueryList.addEventListener`:

```javascript
const mq = window.matchMedia('(prefers-reduced-motion: reduce)');

function applyMotionPref() {
  document.querySelectorAll('[data-hero-motion]').forEach(el => {
    el.style.animationPlayState = mq.matches ? 'paused' : 'running';
  });
}

mq.addEventListener('change', applyMotionPref);
applyMotionPref();   // initial
```

This is overkill for a hero illustration on a marketing page, but essential for a long-lived application where the user might enable reduced-motion mid-session.

## What "reduce" actually means — not "remove all motion"

Reading WCAG and the OS-level documentation, `prefers-reduced-motion: reduce` does **not** mean "remove every animation". It means:

- **Remove vestibular triggers.** No large translations, no parallax, no zoom, no persistent rotation.
- **Keep functional feedback.** A button click can still have a brief subtle press effect. A loading spinner can still spin (it's communicating state).
- **Make non-essential motion optional.** Idle cycles, page entrance animations, decorative loops — these should turn off.

A character's idle breath is *non-essential* (the page conveys the same information static). Turn it off for reduced-motion. A blinking save indicator is *essential feedback* (the user needs to know their work is being saved) — keep it, but maybe slow it down.

## Amplitudes that are safe even *with* reduced-motion off

For a user who *hasn't* enabled reduced-motion, you still want to stay below the vestibular threshold for the small minority that don't know to enable it. Safe defaults:

| Motion | Safe amplitude in 640-wide viewBox |
|---|---|
| Translation (idle) | ≤ ±5 px |
| Rotation (idle) | ≤ ±2° |
| Scale (idle) | 0.97–1.03 (3% pulse) |
| Translation (event, like a hover bounce) | ≤ ±12 px |
| Rotation (event) | ≤ ±10° |
| Scale (event) | 0.9–1.1 (10% pulse) |

Above these, gate the *event itself* behind `prefers-reduced-motion: no-preference` regardless of whether the animation is idle or interactive.

## The audit checklist

Before declaring an animated asset done, run this check:

1. ☐ Does the asset render correctly when `prefers-reduced-motion: reduce` is set? (Toggle in OS, or in DevTools → Rendering panel → "Emulate CSS prefers-reduced-motion: reduce".)
2. ☐ With reduced-motion on, is the figure in a **canonical static pose** — not a mid-breath frozen frame?
3. ☐ With reduced-motion off, do the idle amplitudes fall within the safe table above?
4. ☐ If the page has *multiple* animated assets, do they collectively stay within the safe limits? (Two ±3 px animations near each other still aggregate into ±3 px — they don't add visually.)
5. ☐ Is the animation gated by *one* of the patterns above (CSS media query, SMIL `begin="indefinite"` + JS, conditional inline)? Don't rely on the fact that the animation is "subtle" — gate it.

## Common pitfalls

| Symptom | Likely cause | Fix |
|---|---|---|
| Animation runs even with reduced-motion enabled | SMIL animation; CSS gating doesn't reach SMIL | Use SMIL `begin="indefinite"` + JS startup or wrap in `display: none` group |
| Reduced-motion freezes the figure in an awkward pose | `animation-play-state: paused` lands on a mid-frame | Switch to `animation: none` (resets to keyframe 0) or define a static fallback |
| Two animations on one page each "just under the threshold" combine to vestibular trigger | Aggregate not considered | Audit the *whole page* for total visible motion; cut the less essential one |
| Reduced-motion users see hero icon perpetually as frame 1 | Discrete frame cycle paused at first frame | See [`./multi-frame-cycles.md`](./multi-frame-cycles.md) — pick a canonical reduced-motion frame deliberately |
| Toggling OS setting mid-session doesn't update the page | No `MediaQueryList.addEventListener('change', …)` listener | Add the listener if the session is long-lived; usually not needed for short-lived pages |
| CI test asserts a specific animation runs but breaks under reduced-motion | Test environment has reduced-motion on by default | Set `await page.emulateMedia({ reducedMotion: 'no-preference' })` in the test |

## See also

- [`./idle-cycles.md`](./idle-cycles.md) — the safe amplitude ranges in context
- [`./easing-and-timing.md`](./easing-and-timing.md) — the cycle math
- [`./additive-transforms.md`](./additive-transforms.md) — pausing compound motion
- [`./multi-frame-cycles.md`](./multi-frame-cycles.md) — picking a canonical static frame
- [WCAG 2.3.3 — Animation from Interactions](https://www.w3.org/TR/WCAG22/#animation-from-interactions)
- [WCAG 2.2.2 — Pause, Stop, Hide](https://www.w3.org/TR/WCAG22/#pause-stop-hide)
