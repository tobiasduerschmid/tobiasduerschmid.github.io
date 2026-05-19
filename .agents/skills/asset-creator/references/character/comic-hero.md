# Comic-style hero / avatar illustration

This is what you reach for when a primitive geometric mascot isn't enough — full-figure heroes, themed avatars, customizer-driven characters, scene illustrations with rendered anatomy. The technique below is what separates a "clip-art mascot" from a figure that reads as comic illustration.

## The single rule that separates "drawing" from "comic"

A comic figure is **never one flat group of shapes**. It is a stack of intentional layers, drawn in a fixed order, each layer doing one job. If you try to draw a hero as one big group with everything painted on top of the silhouette, the result will look amateur no matter how nice the individual paths are. The depth comes from the layering, not from path skill.

```
Bottom of stack → top of stack
─────────────────────────────────────────────────────────
  back-fill        long hair behind shoulder, cape inner
  silhouette       skin / suit / hair base — flat fills
  mid-tone         comic-shadow gradient, panel shadows
  highlight        comic-highlight gradient, rim light, catchlights
  inking           rim strokes, contour lines, fold lines
  micro-detail     stray hairs, eyebrow arch, mouth corner
─────────────────────────────────────────────────────────
```

When the layer order is wrong, the figure looks "muddy" or "plastic". Two of the most common mistakes:

1. **Inking placed on the silhouette layer.** The fills painted on top hide the ink. Fix: move inking to a top layer or use stacking groups (`<g id="head-assembly">` containing silhouette, then `<g id="head-inking">` after it).
2. **Highlight gradient placed below the silhouette.** The fill covers the highlight and the figure looks flat. Fix: highlight always sits on top of its base fill.

The hero SVG in this project (`_includes/se-gym-hero.svg`) follows this layer order exactly — when you study it, read it top-to-bottom and notice how each `<g>` corresponds to one of the layers above.

## Defining the palette in `<defs>`

A comic figure needs at least these stops to read with depth. Each goes in `<defs>` and is referenced by `fill="url(#…)"`. Use CSS custom properties as the `stop-color` so a customizer or theme can override them without rewriting paths.

```svg
<defs>
  <!-- 4-stop body gradient: highlight → light → mid → shadow.
       Three stops feels flat; five+ feels muddy. Four is the comic sweet spot. -->
  <linearGradient id="skin" gradientUnits="userSpaceOnUse" x1="0" y1="82" x2="0" y2="270">
    <stop offset="0"   stop-color="var(--hero-skin-highlight, #fff1dc)"/>
    <stop offset=".38" stop-color="var(--hero-skin-light,     #dfa07a)"/>
    <stop offset=".78" stop-color="var(--hero-skin-mid,       #c5815b)"/>
    <stop offset="1"   stop-color="var(--hero-skin,           #b46a3d)"/>
  </linearGradient>

  <!-- Hair gradient: a darker variant of skin, with the same 4-stop spacing. -->
  <linearGradient id="hair-grad" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0"   stop-color="var(--hero-hair-light, #4a3220)"/>
    <stop offset=".36" stop-color="var(--hero-hair,       #1f140c)"/>
    <stop offset=".78" stop-color="var(--hero-hair-dark,  #0f0905)"/>
    <stop offset="1"   stop-color="var(--hero-hair-dark,  #0f0905)" stop-opacity=".74"/>
  </linearGradient>

  <!-- A *separate* highlight gradient (not a stop in the base gradient).
       This is what gives the surface its specular comic look. Apply it as
       an overlay layer with reduced opacity. -->
  <linearGradient id="hair-comic-highlight" gradientUnits="userSpaceOnUse"
                  x1="360" y1="112" x2="440" y2="166">
    <stop offset="0"   stop-color="#ffffff"             stop-opacity=".36"/>
    <stop offset=".36" stop-color="var(--hero-hair-light)" stop-opacity=".74"/>
    <stop offset=".72" stop-color="var(--hero-hair-light)" stop-opacity=".22"/>
    <stop offset="1"   stop-color="#ffffff"             stop-opacity="0"/>
  </linearGradient>

  <!-- Comic-shadow overlay — same shape, different gradient, low opacity. -->
  <linearGradient id="hair-comic-shadow" gradientUnits="userSpaceOnUse"
                  x1="360" y1="158" x2="440" y2="176">
    <stop offset="0"   stop-color="var(--hero-hair-dark)" stop-opacity=".10"/>
    <stop offset=".45" stop-color="var(--hero-hair-dark)" stop-opacity=".58"/>
    <stop offset="1"   stop-color="var(--hero-hair-dark)" stop-opacity=".16"/>
  </linearGradient>

  <!-- Soft drop-shadow filter for layers that should feel attached
       (hair on head, jewel on belt). Subtle is the goal — `dy="2"`
       is more believable than `dy="10"`. -->
  <filter id="soft-depth" x="-35%" y="-35%" width="170%" height="170%">
    <feDropShadow dx="0" dy="2.2" stdDeviation="1.5" flood-opacity=".3"/>
  </filter>
</defs>
```

**Why `gradientUnits="userSpaceOnUse"` for skin and hair?** The default (`objectBoundingBox`) re-fits the gradient to each shape's bounding box. That's fine for a single ellipse but it *breaks* multi-piece characters: the gradient on the cheek will not line up with the gradient on the jaw because they have different bounding boxes. `userSpaceOnUse` pins the gradient to absolute coordinates so the same lighting reads continuously across separate shapes.

## Inking (the "comic line")

Comic inking is the difference between "this looks like a 3D render" and "this looks like a comic page". The rules:

| Property | Value | Why |
|---|---|---|
| `stroke` | `var(--hero-hair-rim, #4a3220)` — a *darker variant of the local fill*, not pure black | Pure black `#000` reads as harsh / printed-on. A dark-but-tinted ink belongs to the figure. |
| `stroke-width` | 1.7–3.0 for typical 640-wide viewBox | Vary widths across the figure: outer silhouette ~3, internal contour ~2, hair micro-detail ~1.7. Uniform stroke width is a tell of clip-art. |
| `stroke-linecap` | `"round"` | Hard caps look like printed text. Round caps look hand-drawn. |
| `fill` | `"none"` | Inking is a stroked path, not a filled shape. |
| `opacity` | 0.4–0.6 (never 1.0) | A solid ink at full opacity flattens the gradient under it. Half-opacity ink reads as drawn-into-the-rendering. |

Layering inking as **multiple stroked paths at slightly different widths and opacities** is what makes the ink feel hand-drawn rather than vector-perfect:

```svg
<!-- Hair micro-detail strokes: a few short curves at low opacity,
     stacked, each suggesting a hair-strand rather than literally drawing one. -->
<path d="M 364 160 C 376 144, 388 136, 398 140
         M 402 140 C 412 136, 424 144, 436 160
         M 371 146 L 382 166
         M 394 136 L 400 166
         M 429 146 L 418 166"
      stroke="var(--hero-hair-rim, #4a3220)"
      stroke-width="2.17" fill="none" stroke-linecap="round"
      opacity="var(--hero-hair-detail-opacity, .5)"/>
```

Two cheap wins that read as "comic" immediately:

1. **Double the silhouette outline:** one wide, low-opacity dark stroke for the *halo* effect, and one narrow, higher-opacity stroke on top for the *crisp edge*. Together they suggest a printed-comic outline that's thicker on the outside than the inside.
2. **Break the outline at light sources.** A continuous outline reads as flat. Leave a 2–4 unit gap in the rim line where light hits (top-left of the head, the bridge of the nose, the upper edge of the shoulder).

## Layered hair construction

Hair is the technique that most often distinguishes a comic figure from a generic vector mascot. Build it in **four passes**:

1. **Back-fill (longest hair):** a path behind the shoulders / neck, drawn before the head silhouette. This is what gives the figure long flowing hair — the rest of the hair sits on top of the head silhouette. Use the base `hair-grad`.

2. **Crown silhouette:** a closed path that approximates the visible hair-on-skull shape. Filled with `hair-grad`.

3. **Crown highlight & shadow (clipped):** a `<clipPath>` matching the crown silhouette, then *inside* that clip-path: a highlight gradient overlay (low opacity) and a shadow gradient overlay (low opacity). The clip ensures the overlays follow the silhouette exactly even when you redraw the silhouette.

4. **Wispy detail strokes:** a few stroked curves and zigzags representing individual hair strands. These should hint at hair *direction* (curving down on the sides, flowing forward over the brow) rather than literally drawing every strand. 5–10 strokes is enough; more starts to look like a wig.

```svg
<!-- Crown silhouette + clipped detail overlays. -->
<clipPath id="comic-crown-hair-clip" clipPathUnits="userSpaceOnUse">
  <path d="M 350 180 C 346 140, 368 108, 400 106
           C 432 108, 454 140, 450 180
           C 436 166, 418 158, 400 158
           C 382 158, 364 166, 350 180 Z"/>
</clipPath>

<g id="comic-crown-hair-detail" clip-path="url(#comic-crown-hair-clip)">
  <!-- Pass 1: highlight overlay -->
  <path d="…" fill="url(#hair-comic-highlight)" opacity=".56"/>
  <!-- Pass 2: zigzag strand suggestion at very low opacity -->
  <path d="M 362 170 L 371 139 L 384 166 L 395 130 L 400 162 L 407 130
           L 418 166 L 431 139 L 438 170 …" fill="var(--hero-hair)" opacity=".18"/>
  <!-- Pass 3: directional micro-strokes -->
  <path d="…" stroke="var(--hero-hair-rim)" stroke-width="2.17" fill="none"
        stroke-linecap="round" opacity=".5"/>
  <!-- Pass 4: shadow under the bang line -->
  <path d="…" fill="url(#hair-comic-shadow)" opacity=".26"/>
</g>
```

For a **tousled-wispy fringe** (the most flattering for hero avatars), the silhouette path uses repeated `Q` quadratic curves rather than smooth `C` cubics — the Q curves create the subtle peaks-and-valleys that read as "individual strands":

```
d="M 352 170 Q 358 178 366 170 Q 372 180 380 170 Q 386 180 394 170
   Q 400 180 408 170 Q 414 180 422 170 Q 428 180 436 170 Q 442 178 448 170
   C 446 182 430 188 400 188 C 370 188 354 182 352 170 Z"
```

Each `Q xc yc x y` pair plants one bump. Vary the y-control values (`178`, `180`, `180`, `180`, `180`, `180`, `178`) by 1–2 units to break the symmetry — perfectly equal bumps read as artificial.

## Eye structure with catchlights

A comic eye is **never** a single black dot. The eye is what carries the character's "presence" and it needs at least this stack to feel alive:

```svg
<g data-eye="round-left">
  <!-- 1. Sclera (white of eye). -->
  <ellipse cx="381" cy="185" rx="7" ry="8.5" fill="#ffffff"/>

  <!-- 2. Upper-lid shadow: a wedge above the eye that suggests the
        eyelid casting a shadow on the sclera. Without this, eyes
        look "open wide" and surprised. -->
  <path d="M 374 185 A 7 8.5 0 0 1 388 185 L 388 183.3
           Q 381 174.5 374 183.3 Z" fill="#000000" opacity=".07"/>

  <!-- 3. Top-half tint on sclera (clip the lower half away). -->
  <ellipse cx="381" cy="185" rx="7" ry="8.5"
           fill="#000000" opacity=".08"
           clip-path="inset(0 0 50% 0)"/>

  <!-- 4. Iris + pupil + catchlights, ALL clipped to the eye outline
        so they cannot leak when the character looks sideways. -->
  <g clip-path="url(#eye-round-left)">
    <circle cx="382" cy="187" r="5.06" fill="var(--hero-eye, #1f140c)"/>
    <!-- Inner iris highlight (subtle inner ring) -->
    <circle cx="383.5" cy="185.5" r="1.27" fill="#ffffff" opacity=".9"/>
    <!-- Pupil -->
    <circle cx="382" cy="187" r="2.53" fill="#000"/>
    <!-- Main catchlight (white dot at upper-left of pupil) -->
    <circle cx="383.6" cy="184.6" r="1.84" fill="#ffffff"/>
    <!-- Secondary catchlight (small dim spot lower-right) -->
    <circle cx="381.1" cy="188.1" r="0.8" fill="#ffffff" opacity=".4"/>
    <!-- Tertiary microhighlight (translated copy of main, low opacity) -->
    <circle cx="383.6" cy="184.6" r="0.69" fill="#ffffff" opacity=".5"
            transform="translate(-1, 2)"/>
  </g>
</g>
```

The catchlight rules:

- **Main catchlight: upper-left of the pupil.** This implies a key light from the upper-left, which is the dominant convention in Western illustration and what readers expect.
- **Secondary catchlight: opposite quadrant (lower-right), at ~40% opacity.** This implies a softer fill light. Without it, the eye feels matte and dead. With it, the eye feels glassy and alive.
- **The catchlights must straddle the pupil edge**, not sit fully inside it. A catchlight that's entirely inside the pupil looks like a sticker. A catchlight that straddles the pupil edge looks like a reflection.
- **All eye contents must be clipped to the sclera shape.** Otherwise when the character looks sideways the iris and pupil leak over the lid line.

For an **almond** eye, replace the sclera ellipse with two `Q`-curve paths meeting at points (the almond shape) and adjust the clipPath accordingly:

```svg
<path d="M 370 185 Q 381 176, 394 185 Q 381 194, 370 185 Z" fill="#ffffff"/>
```

## Skin shading

Skin gets its softness from a **vertical 4-stop gradient** (light at top, mid in the middle, shadow at the bottom) — not from extra paths. Adding more paths to "shade" the face usually makes it muddy. Trust the gradient.

For the cheeks/blush, a `radialGradient` at a specific point on the face works better than a fill — it falls off naturally:

```svg
<radialGradient id="blush" cx="50%" cy="50%" r="50%">
  <stop offset="0"   stop-color="#e08a7a" stop-opacity=".45"/>
  <stop offset="1"   stop-color="#e08a7a" stop-opacity="0"/>
</radialGradient>

<circle cx="378" cy="220" r="14" fill="url(#blush)"/>
<circle cx="422" cy="220" r="14" fill="url(#blush)"/>
```

## Body proportions for a hero

Heroes are exaggerated. Use these guidelines (in head-heights, the classical art-school unit — measure the character's height in multiples of its head):

| Style | Heads tall | Shoulder width (heads) | When to use |
|---|---|---|---|
| Chibi mascot | 2.5–3 | 1 | Cute beginner-friendly mascot, large head emphasis |
| Realistic | 7.5–8 | 2.5 | Adult, naturalistic, neutral |
| Heroic | 8–9 | 3 | Comic-book hero, exaggerated capability |
| Super-heroic | 9–10 | 3.5 | Splash-page hero, dynamic action |

The se-gym hero is **heroic** proportions: 8.5 heads with 3-head shoulders. That's what gives it the "stands tall" silhouette.

## Inking the body — multi-pass contour

The body silhouette gets the same multi-pass treatment as hair. A typical hero arm line uses three stacked strokes:

```svg
<!-- Halo: wide, dark, low opacity. Creates the depth illusion. -->
<path d="M 332 320 C 322 400, 320 490, 328 545"
      stroke="#001428" stroke-width="3.75" fill="none" opacity=".35"/>

<!-- Crisp: narrower, higher opacity. The actual readable contour. -->
<path d="M 370 295 C 364 380, 366 470, 372 540"
      stroke="#001428" stroke-width="2.25" fill="none" opacity=".2"/>

<!-- Highlight rim: cyan or warm-tinted opposite of the halo. Suggests rim light. -->
<path d="M 384 440 L 386 555" stroke="#042947" stroke-width="3.75" opacity=".7"/>
```

Together those three lines look "inked" — separately, each is just a stroke.

## Symbol naming and customizer hooks

Comic illustrations are rarely one-off — they're usually part of a system (avatar customizer, expression library, scene pose set). Name groups by *anatomical slot*, not by *visual variant*, so a customizer can swap variants without re-finding everything:

```svg
<g data-hero-slot="head-shape"   data-hero-option="default">  …  </g>
<g data-hero-slot="head-shape"   data-hero-option="oval"      display="none">  …  </g>
<g data-hero-slot="head-shape"   data-hero-option="round"     display="none">  …  </g>
…
<g data-hero-slot="eye-shape"    data-hero-option="round">    …  </g>
<g data-hero-slot="eye-shape"    data-hero-option="almond"    display="none">  …  </g>
…
```

The customizer JS then just toggles `display="none"` / `display=""` on `[data-hero-slot="…"][data-hero-option="…"]` to switch variants — no path rewriting needed.

**Stable IDs for animation targets** are equally important. Always namespace IDs that need to be unique per instance (when multiple heroes can appear on one page) using a Liquid / Handlebars variant token:

```svg
<linearGradient id="suit-{{ hero_variant }}" …/>
<g data-hero-motion="body-lift" id="body-lift-{{ hero_variant }}">…</g>
```

Without the variant token, two heroes on one page share the same `#suit` gradient ID and one will visually steal the other's fill.

## Light/dark mode

The project's CSS variables (`--hero-hair`, `--hero-skin`, `--hero-eye`, etc.) are theme-swapped at the document root. A comic figure that uses these variables for its `stop-color` and `stroke` values will theme automatically. A figure that hard-codes hex values for ink and shadow will look wrong in dark mode (the dark inking disappears against a dark background).

**Rules of thumb:**
- Ink color = `var(--hero-X-rim, fallback)` not `#000`.
- Highlight overlay = `#ffffff` with `stop-opacity` (white reads as highlight in both modes).
- Shadow overlay = `var(--hero-X-dark, fallback)` with low opacity, not `#000`.
- Test the figure with `[data-theme="dark"]` toggled at the document root before declaring it done.

## Accessibility

A decorative hero illustration should set `aria-hidden="true"` and `focusable="false"` — it carries no information that prose doesn't, and assistive tech doesn't need to announce it. If the figure *does* convey information (e.g., an instructional pose), set `role="img"` and add an `aria-label` describing the pose.

If the figure animates, `prefers-reduced-motion` must pause or freeze the animation — see [`../animations/reduced-motion.md`](../animations/reduced-motion.md). This is a hard requirement for production assets.

## Common pitfalls

| Symptom | Likely cause | Fix |
|---|---|---|
| Figure looks like clip-art / Microsoft Word mascot | Layering missing — everything painted on one layer | Split into back-fill, silhouette, mid-tone, highlight, inking, micro-detail groups |
| Outline looks harsh / printed-on | Pure `#000` stroke at full opacity | Tinted stroke at 0.4–0.6 opacity, color = darker variant of local fill |
| Eyes look "dead" or doll-like | Single catchlight, no upper-lid shadow | Add upper-lid shadow + secondary catchlight at ~40% opacity |
| Hair looks like a wig | Too many uniform-width strokes, or no clipped highlight overlay | Limit to 5–10 directional strokes inside a clipPath, add `hair-comic-highlight` + `hair-comic-shadow` overlays |
| Skin looks plastic / 3D-render | Too many shading paths competing | Trust the 4-stop vertical gradient, remove extra shadow paths |
| Animations clash / fight each other on one element | Multiple `<animateTransform>` without `additive="sum"` | See [`../animations/additive-transforms.md`](../animations/additive-transforms.md) |
| Figure swaps fills with another instance on the same page | Shared gradient ID across instances | Namespace IDs with a variant token (`id="suit-{{ variant }}"`) |
| Animation triggers vestibular discomfort | Large translates / scale / rotation | Cap idle motion at small amplitudes; gate behind `prefers-reduced-motion: no-preference` — see reduced-motion.md |

## See also

- [`../animations/idle-cycles.md`](../animations/idle-cycles.md) — make the hero breathe, blink, and sway
- [`../animations/easing-and-timing.md`](../animations/easing-and-timing.md) — pick believable cycle lengths and ease curves
- [`../animations/additive-transforms.md`](../animations/additive-transforms.md) — compose multiple animations on the same group
- [`../animations/reduced-motion.md`](../animations/reduced-motion.md) — accessibility gating
- [`./primitive-characters.md`](./primitive-characters.md) — when you want a flat geometric mascot instead
- [`./emotions.md`](./emotions.md) — swapping expressions on a comic face
