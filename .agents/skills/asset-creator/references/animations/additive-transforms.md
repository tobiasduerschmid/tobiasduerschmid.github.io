# Additive transforms — composing multiple animations on one element

A character that does *only one thing* feels stiff. A character that breathes *and* sways *and* tilts its head at the same time feels alive. The mechanism that lets multiple animations coexist on the same SVG element without clobbering each other is **`additive="sum"`**.

This file is the reference for stacking animations cleanly.

## The problem

Suppose you put two `<animateTransform>` elements on the same `<g>`, one for breath (translate) and one for a head tilt (rotate):

```svg
<g data-hero-motion="head">
  <animateTransform attributeName="transform" type="translate"
                    values="0 -3; 0 3; 0 -3"  dur="2.2s"
                    repeatCount="indefinite"/>
  <animateTransform attributeName="transform" type="rotate"
                    values="0; 2; 0"  dur="2.2s"
                    repeatCount="indefinite"/>
  …
</g>
```

What happens at runtime? The second `<animateTransform>` **replaces** the first. The element rotates 0→2→0 and never translates. The breath animation is silently dropped because SMIL's default mode for transforms is `additive="replace"` (the value of the most recent animation wins).

## The fix

Add `additive="sum"` to every animation that should compose:

```svg
<g data-hero-motion="head">
  <animateTransform attributeName="transform" type="translate"
                    values="0 -3; 0 3; 0 -3"  dur="2.2s"
                    repeatCount="indefinite"
                    additive="sum"/>
  <animateTransform attributeName="transform" type="rotate"
                    values="0; 2; 0"  dur="2.2s"
                    repeatCount="indefinite"
                    additive="sum"/>
  …
</g>
```

Now both compose: the group translates *and* rotates, and the visible motion is the sum of the two.

**Always set `additive="sum"` for compound transforms.** It costs nothing when there's only one animation, and it removes a class of bug where adding a second animation later silently breaks the first.

## When `replace` is actually what you want

The `additive="sum"` rule is the default *for stacking*. There are two cases where you want `additive="replace"` (or just to omit it):

1. **Sole animation on the element.** No reason to opt in, but no harm either.
2. **Mode switching.** If you want a "calm" cycle to fully *replace* an "excited" cycle when triggered, use `replace`. This is rare for idle motion but common for event-triggered state changes.

## A real compound: breath + tilt + sway on one group

The hero in this project applies four animations to its torso/head assembly. Here's the pattern:

```svg
<g id="hero-head-assembly">
  <!-- 1. Vertical breath: chest rises and falls -->
  <animateTransform attributeName="transform" type="translate"
                    values="0 -3; 0 3; 0 -3"
                    keyTimes="0; 0.5; 1"
                    dur="2.2s"
                    repeatCount="indefinite"
                    calcMode="spline"
                    keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
                    additive="sum"/>

  <!-- 2. Subtle head tip during inhale -->
  <animateTransform attributeName="transform" type="rotate"
                    values="0 400 170; -1.2 400 170; 0 400 170"
                    keyTimes="0; 0.5; 1"
                    dur="2.2s"
                    repeatCount="indefinite"
                    calcMode="spline"
                    keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
                    additive="sum"/>

  <!-- 3. Slow shoulder-to-shoulder weight shift (longer cycle, drifts vs breath) -->
  <animateTransform attributeName="transform" type="translate"
                    values="0 0; 2 0; 0 0; -2 0; 0 0"
                    keyTimes="0; 0.25; 0.5; 0.75; 1"
                    dur="11s"
                    repeatCount="indefinite"
                    calcMode="spline"
                    keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"
                    additive="sum"/>

  <!-- 4. Long-period hair sway (the hair group only, not the whole assembly) -->
  …
</g>
```

The combined motion: the head bobs up and down 2.2 s breath, tips back imperceptibly with each inhale, shifts side-to-side over 11 s, and the hair drifts independently. The eye reads this as a living, present character — not a wireframe in a loop.

## Order of evaluation

When `additive="sum"` is on multiple animations on one element, the browser applies them in **document order** (top to bottom in the SVG source). For pure translates and rotates that compose linearly, this doesn't matter. But for **rotate around a pivot point**, order matters because rotation isn't commutative with translation:

- `translate(0, -3) → rotate(2, 400, 170)` ≠ `rotate(2, 400, 170) → translate(0, -3)`

If the head tip looks wrong (the head moves away from the neck pivot as it tips), reorder the animations so the rotation happens *before* the translation in document order.

## Compound rotation around different pivots

Suppose you want a planetary-style "head bobble" — the head rotates around the neck *and* the eyes counter-rotate to keep gaze level. That's two rotations with different pivot centers, both `additive="sum"`:

```svg
<g id="head">
  <!-- Head rotates around neck -->
  <animateTransform attributeName="transform" type="rotate"
                    values="0 400 170; 5 400 170; 0 400 170"
                    dur="3s" repeatCount="indefinite"
                    additive="sum"/>
  <g id="eyes">
    <!-- Eyes counter-rotate around eye-center to keep gaze level despite head tilt -->
    <animateTransform attributeName="transform" type="rotate"
                      values="0 400 185; -5 400 185; 0 400 185"
                      dur="3s" repeatCount="indefinite"
                      additive="sum"/>
    …
  </g>
</g>
```

This produces a head-tip with stable eye gaze — the eyes don't tilt with the head. It's a small detail but reads as a deliberate, alive character.

## Mixing translate and animateMotion

`<animateMotion>` is a path-following animation (see [`./path-following.md`](./path-following.md)). It can compose with translates using the same `additive="sum"` pattern:

```svg
<g>
  <!-- Object follows a circular path -->
  <animateMotion dur="6s" repeatCount="indefinite" additive="sum">
    <mpath href="#orbit-path"/>
  </animateMotion>

  <!-- And also bobs vertically as it orbits -->
  <animateTransform attributeName="transform" type="translate"
                    values="0 -4; 0 4; 0 -4"
                    dur="1.5s" repeatCount="indefinite"
                    additive="sum"/>
</g>
```

The object orbits AND bobs — a more lifelike orbit than pure circular motion.

## Adding `accumulate="sum"` for progressive motion

Different attribute: `accumulate` controls whether *each iteration* of a repeating animation adds to the previous iteration's end state.

- `accumulate="none"` (default): each iteration starts from `values[0]`. The animation loops in place.
- `accumulate="sum"`: each iteration starts from where the previous one ended. The animation progresses outward forever.

```svg
<!-- A growing ring: each cycle starts where the last one ended, so the
     ring keeps expanding outward. Useful for ripple effects. -->
<animate attributeName="r" from="0" to="20"
         dur="1s" repeatCount="indefinite"
         accumulate="sum"/>
```

You almost never want `accumulate="sum"` for idle character motion (the character would drift across the screen forever). You sometimes want it for emitter effects (sparkles, ripples, expanding shockwaves).

## Common pitfalls

| Symptom | Likely cause | Fix |
|---|---|---|
| Adding a second animation breaks the first | Missing `additive="sum"` | Add `additive="sum"` to all animations on the element |
| Head pivots about the wrong point as it tilts | Translate happens after rotate; rotation center stale | Put rotate first in document order, or move pivot point |
| Object drifts off-screen over time | Mistakenly using `accumulate="sum"` for idle motion | Remove `accumulate`, use `repeatCount="indefinite"` only |
| Eyes tilt with the head when you wanted level gaze | No counter-rotation animation on the eye group | Add an opposite-sign `<animateTransform type="rotate">` on the eyes |
| Mixed `animateMotion` + `animateTransform` jump on iteration boundary | `animateMotion` lacks `additive="sum"` | Add it on both |

## See also

- [`./idle-cycles.md`](./idle-cycles.md) — the named cycles that this composition technique enables
- [`./easing-and-timing.md`](./easing-and-timing.md) — the `keySplines` you'd reuse across composed animations
- [`./path-following.md`](./path-following.md) — `<animateMotion>` specifics
- [`./rotation-animations.md`](./rotation-animations.md) — rotation pivot math
- [`./reduced-motion.md`](./reduced-motion.md) — accessibility gating for all of the above
