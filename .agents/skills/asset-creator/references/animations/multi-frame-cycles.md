# Multi-frame discrete cycles — sprite-style frame animation in SVG

Most SVG animation interpolates between values smoothly. Sometimes you want the *opposite* — a discrete cycle that hard-cuts between N stacked frames, like a sprite sheet. This is what powers a topic-icon cycler ("code → testing → git → data → uml → graph → code …"), a mascot expression rotator, a hint-cue cycle, or any "rotating placard" pattern.

The SMIL mechanism is `calcMode="discrete"` plus opacity flipping across stacked frames.

## The pattern

You stack all N frames in the same position, each in its own `<g>`, and animate each frame's opacity to be `1` only during its slot and `0` everywhere else. The keyTimes form an equal partition `[0, 1/N, 2/N, …, 1]` and `calcMode="discrete"` means values jump *exactly* at each keyTime instead of interpolating.

```svg
<g id="topic-icon-cycle" transform="translate(400 600)">
  <!-- Frame 1: Code -->
  <g opacity="1">
    <animate attributeName="opacity"
             values="1; 0; 0; 0; 0; 0; 1"
             keyTimes="0; 0.1667; 0.3333; 0.5; 0.6667; 0.8333; 1"
             dur="13.2s"
             repeatCount="indefinite"
             calcMode="discrete"/>
    <!-- code icon paths here -->
  </g>

  <!-- Frame 2: Testing -->
  <g opacity="0">
    <animate attributeName="opacity"
             values="0; 1; 0; 0; 0; 0; 0"
             keyTimes="0; 0.1667; 0.3333; 0.5; 0.6667; 0.8333; 1"
             dur="13.2s"
             repeatCount="indefinite"
             calcMode="discrete"/>
    <!-- testing icon paths here -->
  </g>

  <!-- Frame 3: Git -->
  <g opacity="0">
    <animate attributeName="opacity"
             values="0; 0; 1; 0; 0; 0; 0"
             keyTimes="0; 0.1667; 0.3333; 0.5; 0.6667; 0.8333; 1"
             dur="13.2s"
             repeatCount="indefinite"
             calcMode="discrete"/>
    <!-- git icon paths here -->
  </g>

  <!-- … Frames 4, 5, 6 follow the same pattern, each with a `1` at its slot. -->
</g>
```

## Why `calcMode="discrete"` and not animating with `calcMode="linear"`

If you used `calcMode="linear"` with `values="1; 0"`, the opacity would *fade* from 1 to 0 across the slot. Visually that means two frames briefly cross-fade at the boundary. For a sprite-style cycle you don't want that — you want a hard cut, like a film projector. `calcMode="discrete"` is the hard cut: the value stays at `1` until the next keyTime, then snaps to `0`.

If you *do* want a cross-fade transition between frames (gentler, more cinematic), use `calcMode="linear"` and offset adjacent frames' opacity ramps so they cross at 50% during the transition window. The hero in this project uses **discrete** for the topic-icon cycle because the icons are small and a cross-fade would just look like flicker.

## Picking the cycle length

The total cycle period (`dur`) divided by N is the **dwell time per frame** — how long each frame is visible before the next one appears. The reader must be able to *register* each frame.

| Frame count | Min dwell per frame | Recommended total `dur` |
|---|---|---|
| 2 frames | 1.5 s | 3–4 s |
| 3 frames | 1.8 s | 5–6 s |
| 4 frames | 2.0 s | 8–10 s |
| 5 frames | 2.2 s | 11–13 s |
| 6 frames | 2.2 s | 13–15 s |
| 8 frames | 2.0 s (faster — eye gets used to it) | 16–18 s |
| 12+ frames | 1.5 s | 18–25 s |

Below ~1.5 s per frame, the cycle starts to feel like a flicker rather than a reveal — the reader can't register what each icon *means* before it's replaced.

**Don't pick a `dur` that makes the dwell exactly 1.0, 1.5, or 2.0 seconds.** Match the irregular timing pattern from [`./easing-and-timing.md`](./easing-and-timing.md): 13.2 s feels more organic than 12.0 s for a 6-frame cycle.

## When stacking frames is the wrong tool

Use a discrete frame cycle when:
- All frames are **the same size and position** (sprite-style).
- All frames are **stylistically identical** (same line weight, same palette).
- The cycle is **decorative**, not informational (the user doesn't need to act on a specific frame).
- The motion should be **predictable and looping**, not event-triggered.

Use a different mechanism when:
- The user needs to **act on a specific frame** (use a UI control with click/keyboard navigation, not an autoplay cycle).
- The frames are **different sizes / positions / styles** (use sequential `<g>` with `<animate begin="indefinite">` triggered by other animations' `end` event, so they fully replace each other layout-wise rather than stack).
- The cycle should pause on hover (use CSS `@keyframes` with `animation-play-state: paused` on `:hover`, harder in SMIL).
- The reader has reduced-motion preferences (see "Reduced motion" below).

## Adding overlapping transitions

If a hard cut feels too aggressive, you can give each frame a brief fade-in / fade-out window by switching to `calcMode="linear"` and using 4 stops per frame instead of 2:

```svg
<!-- Frame 1: Code — fades in over the first 5% of slot, holds 90%, fades out 5% -->
<g opacity="1">
  <animate attributeName="opacity"
           values="1; 1; 0; 0; 0; 0; 0; 0; 0; 0; 0; 1; 1"
           keyTimes="0; 0.158; 0.176; 0.323; 0.343; 0.490; 0.510; 0.657; 0.677; 0.823; 0.843; 0.982; 1"
           dur="13.2s"
           repeatCount="indefinite"
           calcMode="linear"/>
  <!-- code paths -->
</g>
```

The keyTimes get fiddly fast. For most use cases, stick with `calcMode="discrete"` — the slight harshness of the cut is forgiven if the cycle is decorative.

## Tying frame cycles to other motion

You can synchronize a frame cycle to a different animation's beat by sharing the `dur` and the `begin`:

```svg
<!-- Frame cycle starts when the breath cycle's 6th iteration begins (13.2s = 2.2s * 6) -->
<animate attributeName="opacity"
         values="1; 0; 0; 0; 0; 0; 1"
         keyTimes="0; 0.1667; 0.3333; 0.5; 0.6667; 0.8333; 1"
         dur="13.2s" begin="0s"
         repeatCount="indefinite"
         calcMode="discrete"/>
```

If both `dur="13.2s"` and `begin="0s"` are shared across the frame cycle and the breath, they will stay phase-locked forever. That's usually what you want for a "every 6 breaths, the icon changes" effect.

## Reduced motion

A discrete frame cycle is **especially important** to gate behind `prefers-reduced-motion: reduce`. Unlike a subtle breath which is barely noticeable when paused, a frame cycle that stops cycling means **frame 1 sits there forever** — which may not be the frame you'd want to show as the static fallback.

Options for reduced-motion users:

1. **Pause on the current frame.** Set `animation-play-state: paused` (CSS) or `begin="indefinite"` (SMIL). Whichever frame is visible at the moment the page loads stays visible.

2. **Force a canonical frame.** Set the opacity statically on whichever frame is the "default" (`opacity="1"`) and set all others to `opacity="0"`. This is the most predictable behavior — every reduced-motion user sees the same frame.

3. **Cycle the static frame on each page load.** Pick a deterministic rotation based on the page URL hash or visit count, so different reduced-motion users see different frames over time, but each user sees a stable frame for the duration of their visit.

See [`./reduced-motion.md`](./reduced-motion.md) for the implementation patterns.

## Common pitfalls

| Symptom | Likely cause | Fix |
|---|---|---|
| Frames cross-fade instead of hard-cut | `calcMode="linear"` or default | Set `calcMode="discrete"` |
| Frame 1 is visible during the entire cycle | All frames default `opacity="1"`; only the active frame is set explicitly to 1 | Default `opacity="0"` on every frame except frame 1, then animate each to be `1` only during its slot |
| The cycle is too fast to read | `dur` too short for N frames | Set `dur ≥ 2 × N` seconds for N ≤ 6 |
| Two frame cycles drift apart over time | Cycles have different `dur` values | Share `dur` (and ideally `begin`) across cycles that should stay phase-locked |
| Reduced-motion users see a flickering icon | No `prefers-reduced-motion` gating | See [`./reduced-motion.md`](./reduced-motion.md) |
| Page-load races: some frames appear before SMIL starts | SMIL starts when the SVG enters the document; before that, raw HTML opacity is visible | Set the desired default frame's `opacity="1"` in the markup; others `opacity="0"`. SMIL takes over once the page is ready. |

## See also

- [`./easing-and-timing.md`](./easing-and-timing.md) — picking a believable `dur`
- [`./idle-cycles.md`](./idle-cycles.md) — biological cycles (which are continuous, not discrete)
- [`./additive-transforms.md`](./additive-transforms.md) — for compound motion alongside the cycle
- [`./reduced-motion.md`](./reduced-motion.md) — required gating
