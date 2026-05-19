# Idle cycles — make a character feel alive

An "idle cycle" is the looping subtle motion a character does when nothing is happening. It is the *only* thing that separates a figure that looks alive from one that looks frozen. A perfectly rendered comic hero with no idle motion reads as a static illustration; the *same hero* with a 3% breath cycle and a once-every-5-second blink reads as a living character.

This file covers the four idle cycles that matter most: **breathing, blinking, hair sway, weight shift**. Each has a believable period, amplitude, and easing — get those wrong and the character looks robotic, jittery, or seasick.

## Why subtle is better than dramatic

The single most common mistake in idle animation is **over-animating**. A hero who breathes by translating 20 px up and down looks broken. A hero who breathes by 3 px reads as alive. The reader's eye is extraordinarily sensitive to biological motion — you do not need a lot of amplitude for the cycle to register. Cap idle motion at:

| Cycle | Max amplitude |
|---|---|
| Breath (chest rise) | ±3–5 px in a 640-wide viewBox |
| Hair sway (rotation) | ±1–2° |
| Weight shift (translate) | ±2–4 px |
| Blink (eyelid close) | full close, but only ~80 ms held |
| Eye saccade / micro-look | ±1–2 px translate on iris |

If you double these numbers, the figure crosses from "alive" into "panicked" or "drunk" — the brain reads large idle motion as distress.

## Breathing

Breath is the foundational idle. Without it, *nothing else looks alive*. The pattern is a slow, ease-in-out, additive translate on the torso group.

**Period:** 2.2 seconds is the project standard (matches the resting-breath rate of ~27 breaths/minute when interpreted as one full inhale-exhale). Faster (1.5 s) reads as "exercising"; slower (4 s) reads as "asleep" or "meditation".

**Why 2.2 s and not exactly 2 s?** 2 s is suspiciously round. Cycles that land on the second mark sync up with the browser's animation clock in ways the eye can sometimes detect. A slight off-round number (2.2, 2.7, 3.3) feels more organic.

```svg
<!-- Torso group: breathing translate.
     Note `additive="sum"` so this composes with any rotation/sway above. -->
<g data-hero-motion="body-lift">
  <animateTransform attributeName="transform" type="translate"
                    values="0 -3; 0 3; 0 -3"
                    keyTimes="0; 0.5; 1"
                    dur="2.2s"
                    repeatCount="indefinite"
                    calcMode="spline"
                    keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
                    additive="sum"/>
  …
</g>
```

The `keySplines="0.4 0 0.6 1"` is an ease-in-out cubic-bezier — that's the curve breath actually follows (slow at the top of the inhale, fast through the middle, slow at the bottom of the exhale). Linear motion here reads as a mechanical lift, not a breath. See [`./easing-and-timing.md`](./easing-and-timing.md) for the full keySplines reference.

**Where to attach the animation:** the *torso group*, not the whole character. If you breathe the whole character, the feet move too and the figure looks like it's hovering. The legs should stay planted; the chest should rise. If the feet are inside a `<g>` that breathes, factor them out.

## Compound chest motion

A more realistic chest also rocks slightly — the shoulders rise faster than the belly, and the head tips back imperceptibly. You can stack these by putting the animations on different groups:

```svg
<g data-hero-motion="chest-rise">
  <animateTransform attributeName="transform" type="translate"
                    values="0 0; 0 -4; 0 0"
                    keyTimes="0; 0.5; 1" dur="2.2s"
                    repeatCount="indefinite"
                    calcMode="spline"
                    keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"/>
  <g data-hero-motion="head-tip">
    <animateTransform attributeName="transform" type="rotate"
                      values="0 400 170; -1.2 400 170; 0 400 170"
                      keyTimes="0; 0.5; 1" dur="2.2s"
                      repeatCount="indefinite"
                      calcMode="spline"
                      keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
                      additive="sum"/>
    …
  </g>
</g>
```

The head tip is a 1.2° rotation around the neck pivot `(400, 170)` — small enough that you barely see it, but enough that the figure no longer feels like a paper cutout. See [`./additive-transforms.md`](./additive-transforms.md) for how `additive="sum"` lets these compose.

## Blinking

Blinking is what makes the *eyes* feel alive (separate from breath, which makes the *body* feel alive). The pattern is **very fast (~80 ms close, ~80 ms open) at long intervals (4–6 s) with jitter**.

Real humans blink every 4–6 s, not every 2 s. Frequent blinking reads as nervousness. Try a **multi-stop opacity animation** with most of the time spent open, and a tiny window of closed:

```svg
<!-- Blink: 80% of the time open, brief close around the midpoint,
     plus a second blink at ~85% to break the perfect periodicity. -->
<g data-eye-shape="open">
  <animate attributeName="opacity"
           values="1; 1; 0; 1; 1; 1; 0; 1"
           keyTimes="0; 0.48; 0.5; 0.52; 0.84; 0.86; 0.88; 1"
           dur="5.3s"
           repeatCount="indefinite"
           calcMode="linear"/>
</g>
<g data-eye-shape="closed" opacity="0">
  <animate attributeName="opacity"
           values="0; 0; 1; 0; 0; 0; 1; 0"
           keyTimes="0; 0.48; 0.5; 0.52; 0.84; 0.86; 0.88; 1"
           dur="5.3s"
           repeatCount="indefinite"
           calcMode="linear"/>
</g>
```

**Why two stacked eye groups and an opacity cross-fade?** You could try animating the eyelid's `transform="scaleY(…)"`, but scaleY squashes the catchlights too. A cleaner pattern is to have a separate "closed" eye group (a curved line for the closed lid) and cross-fade opacities between "open" and "closed" using `calcMode="linear"` over a very short window. Together, the close/open looks like a real blink.

**Why a second blink at ~85%?** Humans rarely blink at exactly even intervals. Adding a "double blink" within the cycle breaks the perfect periodicity, which the eye is good at noticing. Two blinks per 5.3 s averages ~4.7 s/blink — within the natural range.

## Hair sway

If the hair is long enough to move (anything past the shoulders), it should sway gently. Pattern: a small rotation around the **top of the hair group** (so the bottom moves and the roots don't drift), at ~2.2 s (matched to breath), with ±1–2° amplitude.

```svg
<g id="long-hair-backfill"
   transform="rotate(0 400 170)"><!-- placeholder; animateTransform overrides -->
  <animateTransform attributeName="transform" type="rotate"
                    values="0 400 170; 1.5 400 170; 0 400 170; -1.5 400 170; 0 400 170"
                    keyTimes="0; 0.25; 0.5; 0.75; 1"
                    dur="4.4s"
                    repeatCount="indefinite"
                    calcMode="spline"
                    keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"/>
  …
</g>
```

**Why 4.4 s (double the breath cycle)?** If hair sways at the *same* rate as breath, the eye latches onto the synchronization and the motion feels mechanical. If hair sways at *exactly half* the rate (2× the period), the motions interlock without obvious lockstep. Try also 1.8× or 2.5× ratios for a less periodic feel.

## Weight shift

A standing character that *never* shifts weight reads as a mannequin. A subtle weight shift — translating the hip group 2–3 px horizontally over a long cycle — adds humanity:

```svg
<g data-hero-motion="hip-shift">
  <animateTransform attributeName="transform" type="translate"
                    values="0 0; 3 0; 0 0; -3 0; 0 0"
                    keyTimes="0; 0.25; 0.5; 0.75; 1"
                    dur="11s"
                    repeatCount="indefinite"
                    calcMode="spline"
                    keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"/>
  …
</g>
```

11 s is deliberately long. A human in a relaxed stance shifts every 8–15 s, not every 2 s. If you make this faster, the figure looks fidgety.

## Eye saccade (optional, advanced)

If the eyes look at a fixed point for too long, they read as glassy / non-living. A micro-translate on the iris/pupil group every 4–8 s suggests the character is actually looking around:

```svg
<g data-hero-eye-group>
  <animateTransform attributeName="transform" type="translate"
                    values="0 0; 0 0; 1 0; 1 0; 0 0; -1 0; -1 0; 0 0"
                    keyTimes="0; 0.18; 0.20; 0.45; 0.47; 0.65; 0.85; 1"
                    dur="7.3s"
                    repeatCount="indefinite"
                    calcMode="linear"/>
</g>
```

`calcMode="linear"` here — saccades are fast snap motions, not eased. The character snaps to the new look-direction and holds.

## Synchronizing vs desynchronizing cycles

Two related rules:

1. **Sync what shares a physical cause.** Chest rise, head tip, and shoulder lift all come from the same breath — same period (2.2 s), same easing, same phase. Use one `<animateTransform>` on a parent group, or copies on each child with *identical* `keyTimes/dur/calcMode/keySplines`.

2. **Desync what doesn't.** Hair sway and breath shouldn't share a period (else it locks into a loop the eye notices). Eye blink shouldn't share a period with anything — give it its own jittery 5.3 s cycle. Saccades shouldn't share with blinks.

A character that has its breath at 2.2 s, hair sway at 4.4 s, blink at 5.3 s, and weight shift at 11 s reads as living because none of those cycles ever come into perfect alignment.

## Reduced motion

Every idle cycle in this file must be paused or stripped when the user has `prefers-reduced-motion: reduce` set. See [`./reduced-motion.md`](./reduced-motion.md) for the pattern — typically you wrap idle animations in a `@media (prefers-reduced-motion: no-preference)` block, or set `animation-play-state: paused` inside a `@media (prefers-reduced-motion: reduce)` block.

This is non-negotiable for production assets and is one of the first things accessibility audits check. WCAG 2.3.3 (Animation from Interactions) is the formal rule.

## Common pitfalls

| Symptom | Likely cause | Fix |
|---|---|---|
| Character "hovers" — feet move with the chest | Breath translate applied to whole character group | Factor out the feet, breathe only the torso group |
| Character looks panicked / drunk | Idle amplitude too large | Halve the amplitude; ±3 px not ±10 |
| Eye blink looks like the eye disappears | Single-eye-element opacity flip without an "closed" replacement | Stack open + closed eye groups, cross-fade opacities |
| All cycles lock into a synchronized rhythm | All cycles share the same `dur` | Pick distinct periods (2.2, 4.4, 5.3, 7.3, 11 s) so they never align |
| Idle motion reads as mechanical | `calcMode="linear"` on breath / sway | Use `calcMode="spline"` with ease-in-out `keySplines="0.4 0 0.6 1"` |
| Hair "drifts" off the head as it sways | Rotation center wrong (e.g. at character centroid) | Rotate around the top of the hair group / scalp, not the figure centroid |
| Audit fails accessibility | No `prefers-reduced-motion` handling | See [`./reduced-motion.md`](./reduced-motion.md) |

## See also

- [`./easing-and-timing.md`](./easing-and-timing.md) — the keySplines values and cycle-length math behind these rules
- [`./additive-transforms.md`](./additive-transforms.md) — how breath + sway + tilt compose on one group
- [`./reduced-motion.md`](./reduced-motion.md) — required gating for production
- [`../character/comic-hero.md`](../character/comic-hero.md) — the figure structure these animations attach to
