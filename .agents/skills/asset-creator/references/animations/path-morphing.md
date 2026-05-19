# Path morphing — when shapes themselves change

Most SVG animation is *attribute animation* (changing opacity, transforms, fills) or *rig animation* (changing a semantic control like blink amount or smile strength). Both are cheap, robust, and well-supported.

Path morphing is the third option: animate the `d` attribute itself so the *shape* changes. It's the most expressive option and the most fragile. This file is the reference for *when to reach for it* and *how to do it without breaking*.

## The three levels of animation

A useful mental model — most animation belongs in the first two levels, not the third.

| Level | What changes | Examples | Fragility |
|---|---|---|---|
| **Attribute animation** | Scalar / discrete properties: opacity, transform, fill, stroke-width, radius | Breathing, blinking via opacity, hover bounces | Low — robust to illustration refactors |
| **Rig animation** | Semantic control variables that drive multiple attributes | "Smile strength 0→1" drives mouth path, cheek raise, eye squint via CSS vars | Low — survives path redraws if the rig API is stable |
| **Topology animation** | The path's `d` attribute itself | A mouth morphing from neutral to grin, a logo morphing into a checkmark | High — breaks if the path strings diverge in command structure |

If you can express the motion as level 1 or 2, do that. Path morphing is for the cases where shape change is the point — facial expressions that change silhouette, transformation reveals, controlled logo morphs.

## The native rule: matching command structure

SVG's native path interpolation (via SMIL `<animate attributeName="d">` or CSS `d:`) only produces smooth motion when **both path strings share the same command structure** — the same sequence of `M`/`L`/`C`/`Q`/`Z` commands with the same number of arguments. Identical commands, same count, in the same order.

```svg
<!-- ✅ Smooth: both paths have the same commands (M, Q, Q, Z) -->
<path>
  <animate attributeName="d" dur="0.5s" repeatCount="indefinite"
           values="M 10 50 Q 30 20 50 50 Q 70 80 90 50 Z;
                   M 10 50 Q 30 80 50 50 Q 70 20 90 50 Z;
                   M 10 50 Q 30 20 50 50 Q 70 80 90 50 Z"/>
</path>

<!-- ❌ Broken: path commands diverge (Q vs C, different point count) -->
<path>
  <animate attributeName="d" dur="0.5s"
           values="M 10 50 Q 50 20 90 50 Z;
                   M 10 50 C 30 20 70 20 90 50 Z"/>
</path>
```

In the broken example, the browser falls back to a discrete jump from one shape to the other — no interpolation. There's no warning; the animation just doesn't ease.

**The practical rule when authoring:** if you want shape A to morph to shape B natively, draw both with *the same number of anchor points and the same command types*. Reuse the same Bezier topology and only change the control point coordinates.

This is restrictive enough that most production morphs use a library to relax it.

## Library escape hatches

Three libraries solve the command-structure problem by reparameterizing one path to match the other before interpolation:

| Library | What it does | When to use |
|---|---|---|
| [`d3-interpolate-path`](https://github.com/pbeshai/d3-interpolate-path) | Resamples both paths to a common point count, then interpolates linearly | D3-based pipelines; data-driven path transitions; logo morphs |
| [`flubber`](https://github.com/veltman/flubber) | Best-guess interpolation between arbitrary 2D shapes; handles disjoint shape→shape, one→many, many→one | Single-purpose shape morphs (a triangle becoming a star); morph between two unrelated SVG paths |
| [`animejs`](https://animejs.com/) `svg.morphTo()` | One-call morphing of a `<path>` to another path's `d` | When you're already using Anime.js; the convenience API |
| [`motion`](https://motion.dev/) | Modern animation library; SVG path morphing is one of its capabilities | If you're already using Motion / Framer Motion |

Pattern with Anime.js:

```js
import { svg, animate } from 'animejs';

const [fromD, toD] = svg.morphTo('#smilePath', 0.33);
animate('#mouthPath', {
  d: [fromD, toD],
  duration: 220,
  easing: 'inOutSine'
});
```

Pattern with Flubber:

```js
import { interpolate } from 'flubber';

const interpolator = interpolate(fromD, toD);
const mouth = document.getElementById('mouthPath');

// drive with a tween (gsap, raf loop, or animation library)
function tick(t /* 0..1 */) {
  mouth.setAttribute('d', interpolator(t));
}
```

Both library APIs accept arbitrary `d` strings and handle the topology mismatch internally. The trade-off is that the *intermediate shapes* are library-determined — they may pass through visual states the original artist didn't intend. For a logo morph, that's usually fine; for a facial expression, you may need to author intermediate keyframes manually anyway.

## Practical patterns

### Matched-topology authoring (preferred for facial expressions)

When you control the source of truth (your own SVG illustrations), author morph pairs with matching command structure from the start. The illustration team draws "neutral mouth" and "smiling mouth" as variants of the same Bezier — same anchor count, same command types, only coordinates differ.

```svg
<!-- Mouth: 6-point Bezier with stable topology across expressions -->
<defs>
  <path id="mouth-neutral" d="M 50 70 Q 55 72 60 70 Q 65 72 70 70 Q 75 72 80 70 Z"/>
  <path id="mouth-smile"   d="M 50 70 Q 55 76 60 78 Q 65 80 70 78 Q 75 76 80 70 Z"/>
</defs>

<path id="active-mouth" d="M 50 70 Q 55 72 60 70 Q 65 72 70 70 Q 75 72 80 70 Z">
  <animate attributeName="d" dur="0.22s" fill="freeze"
           from="M 50 70 Q 55 72 60 70 Q 65 72 70 70 Q 75 72 80 70 Z"
           to="M 50 70 Q 55 76 60 78 Q 65 80 70 78 Q 75 76 80 70 Z"
           begin="indefinite"/>
</path>
```

The animation eases smoothly because the topology matches. No library needed.

### Discrete pose stages with cross-fades (when topology can't match)

When two expressions have genuinely different topology (e.g. closed mouth vs open shouting mouth), don't morph — *cross-fade* between two stacked paths via opacity:

```svg
<g id="mouth-stack">
  <path id="mouth-closed" d="…" opacity="1"/>
  <path id="mouth-open"   d="…" opacity="0"/>
</g>
```

```js
// Trigger an "open mouth" expression.
document.getElementById('mouth-closed').animate(
  [{ opacity: 1 }, { opacity: 0 }],
  { duration: 80, fill: 'forwards' }
);
document.getElementById('mouth-open').animate(
  [{ opacity: 0 }, { opacity: 1 }],
  { duration: 80, fill: 'forwards' }
);
```

This is conceptually closer to a sprite cycle (see [`./multi-frame-cycles.md`](./multi-frame-cycles.md)) than a morph. It avoids the topology problem entirely.

### Rig variable + paired paths (preferred for expression rigs)

For an expression *rig* (a smile slider that interpolates from neutral to grin), combine matched-topology paths with a CSS variable driving a path-data interpolation. CSS doesn't natively interpolate `d:` across vars in all browsers, so this is typically done with JS:

```js
function setSmile(t) {
  const d = interpolatePathString(NEUTRAL_D, GRIN_D, t);
  document.getElementById('mouth').setAttribute('d', d);
}
```

The benefit: the public API is `setSmile(0..1)` — a clean rig variable. The implementation can use matched topology (no library) or a morph library (any topology) without changing the API.

## When path morphing is the *wrong* tool

| Symptom | Reach for instead |
|---|---|
| Eye blink | Stacked open/closed eye groups with opacity cross-fade. Don't morph the eye path. |
| Head tilt | `<animateTransform type="rotate">`. Don't morph the head outline. |
| Breath cycle | `<animateTransform type="translate">` on the torso. Don't morph the body outline. |
| Hover bounce | CSS `transform: translateY(…)` with `transition`. Don't morph anything. |
| Icon swap | Two stacked icons, opacity cross-fade — or a `<use>` href swap. Morphing icon A → icon B is rarely worth the QA cost. |
| Animated diagram | Use the dedicated diagram skill ([`diagrams`](../../../diagrams/SKILL.md)) — ArchUML / Mermaid handle their own transitions. |

The single most common mistake: trying to morph an entire character pose. The path counts diverge, the libraries produce dreamlike intermediate states, and the result reads as broken. Pose changes belong to rig variables + matched-topology limbs, not whole-character path morphs.

## Cross-browser support

| Mechanism | Chromium | Firefox | WebKit / Safari | Notes |
|---|---|---|---|---|
| SMIL `<animate attributeName="d">` | ✅ | ✅ | ✅ | Strict matching-command-structure rule applies |
| CSS `d:` transition (`d: path(…)`) | ✅ | ✅ | ✅ | Same matching rule. Newer support; check current state for production |
| WAAPI (`element.animate([{d: …}])`) | ⚠️ Partial | ⚠️ | ⚠️ | Path interpolation in WAAPI is less consistent than for transforms; library-assisted preferred |
| Library-assisted (Flubber / d3-interpolate-path) | ✅ | ✅ | ✅ | The library handles the math; the actual update is just `setAttribute('d', …)` |

The library-assisted route is the most portable in 2026 because the actual DOM update (`setAttribute('d', …)` on every frame) works everywhere — it's a property set, not an interpolation engine.

## Reduced motion

Path morphing animations must respect `prefers-reduced-motion: reduce` like every other animation in the project. See [`./reduced-motion.md`](./reduced-motion.md).

For path morphs, the reduced-motion fallback is usually: **set the final path state immediately** rather than animating to it. Don't pause mid-morph — that leaves the figure in an intermediate state that may not be a designed pose.

```js
function smile() {
  const mouth = document.getElementById('mouth');
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    mouth.setAttribute('d', GRIN_D);  // jump straight to target
  } else {
    animateMorph(mouth, NEUTRAL_D, GRIN_D, 220);
  }
}
```

## Common pitfalls

| Symptom | Likely cause | Fix |
|---|---|---|
| Animation falls back to a discrete jump | `values` paths have mismatched command structure | Author with matching topology, or use a morph library |
| Intermediate frames look unnatural | Library reparameterized in a visually unintended way | Add intermediate keyframes manually, or switch to matched-topology authoring |
| Animation re-runs path math every frame on tens of paths | Computing the interpolation in JS each frame without caching | Cache the interpolator function (libraries return one), call it per frame |
| Two morph animations clash on one element | Both setting `d` directly, no `additive` composition (and `d` doesn't compose additively anyway) | Use one driver per `<path>`; compose morphs at the rig level instead |
| Reduced-motion users see a frozen mid-morph state | Animation paused, not skipped | Skip to the target state instead of pausing |
| Path morph drift across browsers | SMIL behavior diverges on edge cases (Z command handling, decimal precision) | Use a library; the library normalizes both inputs |

## See also

- [`./additive-transforms.md`](./additive-transforms.md) — the cheaper alternative for compound motion
- [`./multi-frame-cycles.md`](./multi-frame-cycles.md) — stacked-frame cross-fade as an alternative to morphing
- [`./easing-and-timing.md`](./easing-and-timing.md) — ease curves that compose with morph timing
- [`./reduced-motion.md`](./reduced-motion.md) — required gating
- [`../character/avatar-system.md`](../character/avatar-system.md) — rig variables driving morphs at the system level
