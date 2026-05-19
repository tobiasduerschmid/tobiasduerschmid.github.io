# Easing and timing — picking believable curves

The difference between an animation that reads as "alive" and one that reads as "mechanical" is almost always **the easing curve**, not the path of motion. Linear motion looks robotic; eased motion looks natural. This file is the reference for *how* to set eases in SMIL SVG animations and *why* certain timings feel believable while others don't.

## The default: ease-in-out cubic, `0.4 0 0.6 1`

For any idle motion (breath, sway, weight shift, hair drift) the project default is:

```svg
calcMode="spline"
keySplines="0.4 0 0.6 1"
```

This is a symmetric ease-in-out cubic Bezier. It is slow at the start, fast through the middle, slow at the end — which is the curve that *physical objects with mass* follow when they reverse direction (a chest at the top of an inhale, a swing at the peak of its arc, a head at the end of a tilt).

**Why this specific curve and not just any ease-in-out?** The control points `(0.4, 0)` and `(0.6, 1)` give a *deeper* hold at the extremes than the standard CSS `ease-in-out` (`(0.42, 0, 0.58, 1)`). The deeper hold reads as "settling" before reversal, which is exactly what biological motion does at the peak of a breath.

If you're tempted to write your own keySplines for an idle cycle: don't. Use this one. Save your custom eases for *event* animations (a punch, a jump, a bounce), not for idle.

## How `calcMode` and `keySplines` work together

SMIL's animation timing is controlled by three coupled attributes:

| Attribute | What it does | Common values |
|---|---|---|
| `keyTimes` | Where each value-stop lands in the cycle (0 to 1) | `"0; 0.5; 1"` for a 3-stop animation |
| `calcMode` | How values are interpolated between stops | `linear` (default), `spline`, `discrete`, `paced` |
| `keySplines` | When `calcMode="spline"`: cubic-Bezier control points for each segment | `"0.4 0 0.6 1"` per segment, joined by `;` |

**Critical rule:** `keySplines` must have **`keyTimes.length - 1`** segments. A 3-stop animation needs 2 segments; a 5-stop needs 4. If you have one fewer than required, the browser silently falls back to linear and your eases vanish.

```svg
<!-- 3 stops, 2 segments — note the two keySplines joined by semicolon. -->
<animate values="0; 5; 0"
         keyTimes="0; 0.5; 1"
         calcMode="spline"
         keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
         dur="2.2s" repeatCount="indefinite"/>
```

The pattern `"<ease>; <ease>; …"` is so common in idle loops that it's worth making a habit: every time you write a multi-stop animation, **count the segments and confirm keySplines matches**.

## The keySplines cheat sheet

| Curve | keySplines | When to use |
|---|---|---|
| Linear (default) | (omit `calcMode`) | Saccades, snap motions, discrete-mode cross-fades |
| Ease-in (slow start, fast end) | `0.4 0 1 1` | A character "falling into" a pose |
| Ease-out (fast start, slow end) | `0 0 0.6 1` | A reaction snap (head jerks toward something then settles) |
| Ease-in-out (project default) | `0.4 0 0.6 1` | Idle cycles — breath, sway, weight shift |
| Ease-in-out-strong (deeper holds) | `0.7 0 0.3 1` | Slower idle, "settling" motion at extremes |
| Anticipation (back-up before going) | `0.5 -0.2 0.5 1` | A coil/wind-up before a strike or jump (use sparingly) |
| Overshoot (bounce-out past target) | `0.5 0 0.3 1.3` | A pop/bounce reaction (use sparingly) |

For the anticipation and overshoot curves, the control-point `y` values go outside the `[0, 1]` range. That's allowed in SMIL keySplines (unlike CSS cubic-bezier where the y-axis is also clamped in some implementations). The motion temporarily *passes* the target before coming back.

## Cycle-length math

The believable period for a cycle depends on what the cycle represents. Use this table as a starting point, then test the figure in motion before committing:

| Cycle | Period | Why |
|---|---|---|
| Resting breath | 2.0–2.4 s | ~25–30 breaths/min, the resting rate |
| Excited / post-exercise breath | 1.0–1.4 s | ~45–60 breaths/min |
| Sleep breath | 3.5–4.2 s | ~15–17 breaths/min |
| Heartbeat pulse (chest jump) | 0.8–1.0 s | ~60–75 BPM resting |
| Blink interval | 4.5–6.5 s | ~10 blinks/min |
| Hair sway | 2× breath period | Pendulum at chest-mass scale |
| Weight shift | 8–14 s | Subconscious posture adjustment |
| Eye saccade interval | 4–8 s | Active visual scanning |

**Avoid round numbers.** A cycle of exactly 2.0 s, 3.0 s, 4.0 s tends to feel mechanical because the cycle boundaries land on the second-mark of the animation clock. Slight deviations — 2.2 s, 3.3 s, 4.4 s, 5.3 s, 7.3 s — feel more organic. (This is a perceptual effect, not a technical one — the renderer doesn't care, but the human watching does.)

**Avoid common multiples.** If breath is 2.2 s and you set hair sway to 4.4 s (exactly 2×), the cycles re-align every 4.4 s and the eye catches the pattern. Try 4.7 s instead (~2.14×) so they drift relative to each other and never sync.

## Cycle phase — staggering identical animations

Two identical animations starting at the same instant feel mechanical (they "punch in" together). Staggering with `begin="<offset>s"` makes a chorus of animations feel organic:

```svg
<!-- Three sparkles, same animation, staggered by .25s and .5s. -->
<circle r="4">
  <animate attributeName="opacity" values="0;1;0"
           dur="1.5s" begin="0s" repeatCount="indefinite"/>
</circle>
<circle r="4">
  <animate attributeName="opacity" values="0;1;0"
           dur="1.5s" begin="0.25s" repeatCount="indefinite"/>
</circle>
<circle r="4">
  <animate attributeName="opacity" values="0;1;0"
           dur="1.5s" begin="0.5s" repeatCount="indefinite"/>
</circle>
```

For an idle character, you usually *don't* want to stagger the breath itself — chest and shoulder share a cause, they should sync. But you *do* stagger ornaments (sparkles, particle effects, secondary hair strands) so they don't all pulse at the same instant.

## When to use `keyTimes` with three vs five stops

A 3-stop animation `values="A; B; A"` `keyTimes="0; 0.5; 1"` gives equal time at each end. That's fine for symmetric motion (a chest going up and down). But sometimes a cycle isn't symmetric — a heartbeat is a fast contract + slow release. Use 5 stops to introduce asymmetry:

```svg
<!-- Heartbeat: fast spike + slow recovery. -->
<animate values="1; 1.05; 1; 1.02; 1"
         keyTimes="0; 0.1; 0.18; 0.30; 1"
         dur="1s"
         calcMode="spline"
         keySplines="0.2 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0 0 0 0"
         repeatCount="indefinite"/>
```

That's: a fast spike to 1.05 in the first 100 ms, recovery to 1.0 by 180 ms, a tiny secondary bump (the "dub" of "lub-dub") at 300 ms, then a long flat hold to 1.0 s. Five stops capture the two-beat structure of a real heartbeat — three stops can't.

## SMIL vs CSS keyframe timing

You can drive SVG animations from CSS `@keyframes` instead of SMIL `<animate>`. The trade-offs:

| Concern | SMIL (`<animate>`, `<animateTransform>`) | CSS (`@keyframes`) |
|---|---|---|
| Where the animation lives | Inside the SVG, travels with it | In a stylesheet, separate from the SVG |
| Easing syntax | `keySplines` per segment | `animation-timing-function` per keyframe via `cubic-bezier(…)` |
| Pause for reduced motion | Hard — must remove the `<animate>` or set `begin="indefinite"` | Easy — `animation-play-state: paused` in a media query |
| Transform animation | `<animateTransform additive="sum">` for compounding | `transform: …; @keyframes …` — but only one `transform` rule wins per element |
| Browser support | Removed warnings for SMIL years ago; current browsers all support it | Universal |
| Per-attribute animation | Yes — animate `d`, `opacity`, individual transforms separately | Limited — CSS can't easily animate `d`, but Houdini and CSS `d` property (newer) can |

For *idle character motion* (breath, blink, sway): SMIL is usually cleaner — you can put `additive="sum"` on multiple `<animateTransform>` elements to compose breath + tilt + sway on one group, which is awkward in CSS.

For *page-level* animations (a hero entering from the left when the page loads): CSS keyframes are usually cleaner — they integrate with the rest of the page styling and `prefers-reduced-motion` media query is one block.

The se-gym hero uses SMIL throughout because the compound motion (breath + cape rock + barbell lift + topic-icon cycle) requires `additive="sum"` and per-element `begin` staggering, which is awkward to express in CSS without one `<animate>` per transform component.

## Common pitfalls

| Symptom | Likely cause | Fix |
|---|---|---|
| Eases silently fail (motion is linear) | `keySplines` has wrong segment count for `keyTimes` | Count: keySplines = keyTimes.length − 1 |
| Idle motion feels mechanical | `calcMode="linear"` | Use `calcMode="spline"` with `keySplines="0.4 0 0.6 1"` |
| Cycles lock into a synchronized rhythm | Periods are common multiples (2.0, 4.0, 6.0) | Use mutually non-integer periods (2.2, 4.7, 5.3, 7.3) |
| Heartbeat looks like a single bounce, not two beats | 3 stops insufficient for asymmetric motion | Use 5 stops to capture lub-dub |
| Particle group "punches in" all at once | All copies share `begin="0s"` | Stagger with `begin="0.0s"`, `"0.25s"`, `"0.5s"`, … |
| Two `<animateTransform>` on one element clobber each other | Missing `additive="sum"` | See [`./additive-transforms.md`](./additive-transforms.md) |
| Animation can't be paused for accessibility | SMIL animation, no gating mechanism | See [`./reduced-motion.md`](./reduced-motion.md) — gate via `begin="indefinite"` or use CSS keyframes |

## See also

- [`./idle-cycles.md`](./idle-cycles.md) — the named cycles (breath, blink, sway) that use these eases
- [`./additive-transforms.md`](./additive-transforms.md) — composing animations on one element
- [`./reduced-motion.md`](./reduced-motion.md) — the accessibility gating rule
- [`./rotation-animations.md`](./rotation-animations.md) — rotation specifically, pivot-point math
