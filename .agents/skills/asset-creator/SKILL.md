---
name: asset-creator
description: Create SVG assets — logos, icons, customized icons, primitive characters, full comic-style illustrations (heroes, mascots, scene props), and parametrizable avatar systems (customizer-driven, themed via CSS variables, multi-instance) with or without animation. USE THIS SKILL EVERY SINGLE TIME you are about to write or edit a `.svg` file, an inline `<svg>` block in a Jekyll include / HTML / Markdown page, an SVG built in JS (`document.createElementNS('http://www.w3.org/2000/svg', …)`, JS template-literal SVG strings), an SVG used as `<img src>` / `background-image: url(…svg)`, or any standalone illustration asset (`_includes/*.svg`, `assets/**/*.svg`, `<symbol>`/`<defs>`/`<use>` sprite or symbol sheets, hero/avatar artwork, customizer-driven avatars, scene illustrations, decorative graphics, mascots, animated badges, exercise/topic icons, animated loaders). Trigger when drawing a path, placing a gradient, building a multi-layered comic illustration (head/hair/eye/body assembly), designing an avatar customizer or descriptor schema, picking a visual style family (flat / soft-flat / semi-realistic / isometric / iconographic), adding or tuning an idle animation cycle (breathing, blinking, sway, weight shift), composing multiple animations on one element, building a sprite-like discrete frame cycle, morphing a path between two shapes, choosing between SMIL / CSS / WAAPI for an animation, or honoring `prefers-reduced-motion`. Also trigger on requests like "draw an SVG of …", "make me a hero / avatar / mascot", "build an avatar customizer", "animate this icon", "morph this shape into that one", "make it breathe / blink / wave", "add a catchlight", "ink the outline", "layer the hair", "make the cape billow", "give it a comic look", or any task that involves authoring an illustration asset. NOTE: ArchUML / Mermaid / data-driven diagrams have a dedicated skill (`diagrams`) — defer to it for those; this skill is for illustration / decorative / character / icon / avatar assets.
---

# Asset Creator

## Core responsibility
Create SVG assets — fetched icons, custom paths, or full layered illustrations — optionally animated.

- **SVG only.** No React / JSX, no JavaScript runtime. SMIL `<animate>` and CSS animations inside the `<svg>` are fine.
- **Transparent background.** SVGs are transparent by default; do not add a background `<rect>` unless the asset is explicitly framed.

## Understand requirements first

Before drawing, decide *what kind of asset* this is — the answer governs the entire workflow (whether to fetch reference icons, which sub-reference to read, how to layer).

| Domain | Read this |
|---|---|
| Picking a visual style (flat / soft-flat / semi-realistic / isometric / iconographic) — *do this before drawing* | [style-families.md](./references/character/style-families.md) |
| Any line / curve / path `d` attribute | [path-creation.md](./references/path-creation.md) |
| Simple geometric mascot — primitive proportions, beginner-friendly | [primitive-characters.md](./references/character/primitive-characters.md) |
| Comic / cartoon figure with rendered anatomy — hero, avatar, detailed mascot, multi-pass shading, layered hair / eyes | [comic-hero.md](./references/character/comic-hero.md) |
| Customizer-driven avatar **system** — parametrizable, themed via CSS vars, multi-instance, descriptor-schema-driven | [avatar-system.md](./references/character/avatar-system.md) |
| Arrows of any tip shape | [arrow-guidelines.md](./references/arrow-guidelines.md) |

## Fetching reference icons

Real icon libraries exist so assets across a project share a visual language. Reach for them before drawing from scratch.

- `mcp__video_gen_tools__search_icons` — fetch icon names by keyword. Call repeatedly with different keywords if the first set is thin.
- `mcp__video_gen_tools__get_icons` — fetch the SVG content of named icons.

For each asset, retrieve several candidates and pick the best match rather than committing to the first hit.

**If a search returns nothing:** try a synonym or a related concept (a "trophy" search may miss "award" or "medal"). After two failed keywords, fall back to the type-specific guidance below.

## Creation by asset type

### `logo`
- Fetch reference icons.
- Use the matching icon **as-is**. The whole point of using a real logo is visual fidelity; tweaks break it.
- If no reference matches, render the brand/entity name inside a visual box rather than approximating a wrong logo.

### `icon`
- Fetch reference icons.
- Use the matching icon **as-is**. Icon libraries are designed for cross-asset consistency — modifying one icon makes it visually disagree with every other icon on the page.
- If no reference matches, draw a new one in the same simple style.

### `customized`
- Fetch reference icons.
- If a reference matches the description, use it as-is.
- Only if *no* reference matches, tweak the closest one.
- If no direct references exist, search for *similar* icons, study their shape language, and create from scratch in that style.

### `character`
- Don't fetch icons — icon libraries don't carry the proportions or weight needed for a character.
- Build from scratch using [primitive-characters.md](./references/character/primitive-characters.md). This type is for the simple geometric "beginner mascot" — flat fills, friendly blob shapes, consistent proportions.
- For a fully rendered comic figure, use `comic-illustration` below instead.

### `comic-illustration`
- Don't fetch icons. Comic-rendered figures are not in icon libraries; any partial match will fight the rest of the figure's proportions and inking style.
- Build from scratch using [comic-hero.md](./references/character/comic-hero.md).
- **Build in anatomical layers** (back-fill → silhouette → mid-tone → highlight → inking → micro-detail). A comic figure drawn as one flat group looks like clip-art no matter how nice the individual paths are; the layered stack is what creates the depth a reader expects from comics.
- **Inking goes on top** of fills/gradients, not on the silhouette layer. If a fill paints over a rim line, the layer order is wrong.
- **Name groups by anatomical slot** (`<g data-hero-slot="head-shape">`, `<g data-hero-slot="eye-shape">`) and **namespace IDs by variant** when multiple instances may appear on one page (`id="suit-{{ hero_variant }}"`) so two heroes don't share a gradient.

### `avatar-system`
- A *system*, not a single figure: customizer-driven, descriptor-schema-backed, multi-instance, themed per-instance via CSS variables. The SE Gym hero customizer is one such system.
- Read [avatar-system.md](./references/character/avatar-system.md) for the three-layer model (semantic descriptor → rig → render), descriptor schema template, deterministic seeded generation, and the variation taxonomy (paint / surface / shape / motion).
- Also read [style-families.md](./references/character/style-families.md) **before** picking the visual language — the style family determines the entire parameter surface. The default recommendation for customizers with wide demographic variation is **soft-flat primary + iconographic fallback**.
- Build the per-instance theming with `<symbol>` + `<use>` + CSS custom properties. Each `<use>` inherits its host SVG's inline style, so two avatars on one page can theme independently without re-emitting the symbol library.
- Animate **rig variables** (e.g. `--blink`, `--smile`), not raw path data. Code that rewrites `<path d="…">` strings breaks every time an illustrator redraws the path; code that sets CSS custom properties survives illustration churn. See [path-morphing.md](./references/animations/path-morphing.md) for the three-level mental model (attribute / rig / topology animation).
- **Author the option space deliberately.** Skin tones, hair textures, head coverings, assistive devices, body proportions — narrow defaults silently exclude users. See the representation section in [avatar-system.md](./references/character/avatar-system.md).
- For student / minor data: prefer non-biometric descriptors over stored face embeddings; if photo-assisted personalization exists, frame it as assistive editing not automatic identity inference, and document retention/deletion behavior.

## Complexity tiers

The same descriptor often needs to render at multiple complexity levels. Most products eventually need this — tiny avatars in a roster, standard avatars in a dashboard, rich avatars on a profile page.

| Tier | When to use | Visual budget | Animation budget |
|---|---|---|---|
| **Tiny / iconographic** | Roster cells (24–48 px), reduced-motion mode, monochrome UIs, badges, placeholders | Solid fills, no gradients, no filters | None |
| **Standard / soft-flat** | Dashboards, identity chips, classroom views (64–256 px) | Flat fills + restrained gradients, layered shapes | Idle transform + opacity animations |
| **Rich** | Profile page (256 px+), hero illustration | Multi-stop gradients, masks, subtle drop-shadow filter, full inking layer | Compound idle motion, expression presets, optional matched-topology morphs |

The descriptor stays the same across tiers — only the renderer changes. A `tiny` renderer ignores secondary `<use>` references; a `rich` renderer engages the full comic-illustration stack from [comic-hero.md](./references/character/comic-hero.md).

## SVG basics

```svg
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <style>/* CSS styles and animations */</style>
  <!-- SVG elements here -->
</svg>
```

### Root attributes

| Attribute | Purpose | Example |
|---|---|---|
| `viewBox` | Internal coordinate system | `"0 0 100 100"` |
| `xmlns` | XML namespace (required) | `"http://www.w3.org/2000/svg"` |

### Basic shapes

```svg
<rect x="10" y="10" width="80" height="60" rx="5" ry="5" fill="#3B82F6"/>
```
`x`, `y` = top-left corner; `width`, `height` = dimensions; `rx`, `ry` = corner radius; `fill` = fill color.

```svg
<circle cx="50" cy="50" r="40" fill="#EF4444"/>
```
`cx`, `cy` = center; `r` = radius.

```svg
<ellipse cx="50" cy="50" rx="40" ry="25" fill="#10B981"/>
```
`cx`, `cy` = center; `rx`, `ry` = X and Y radii.

```svg
<line x1="10" y1="10" x2="90" y2="90" stroke="#000" stroke-width="2"/>
<polyline points="10,90 50,10 90,90" fill="none" stroke="#000" stroke-width="2"/>
<polygon points="50,10 90,90 10,90" fill="#F59E0B"/>
```

### Path — the most expressive element

| Command | Name | Parameters | Example |
|---|---|---|---|
| `M` | Move to | x, y | `M 10 10` |
| `L` | Line to | x, y | `L 90 90` |
| `H` | Horizontal line | x | `H 50` |
| `V` | Vertical line | y | `V 50` |
| `C` | Cubic Bezier | x1,y1 x2,y2 x,y | `C 20,20 80,20 90,90` |
| `Q` | Quadratic Bezier | x1,y1 x,y | `Q 50,0 90,90` |
| `A` | Arc | rx ry rotation large-arc sweep x y | `A 25 25 0 0 1 50 50` |
| `Z` | Close path | — | `Z` |

Lowercase variants use coordinates relative to the current position.

```svg
<!-- Triangle -->
<path d="M 50 10 L 90 90 L 10 90 Z" fill="#8B5CF6"/>

<!-- Curved shape -->
<path d="M 10 50 Q 50 10 90 50 T 170 50" stroke="#000" fill="none"/>
```

### Groups and transforms

Use `<g>` to group elements and apply shared transforms or styles:

```svg
<g transform="translate(50, 50)" fill="#3B82F6">
  <circle r="20"/>
  <rect x="-10" y="25" width="20" height="10"/>
</g>
```

| Transform | Syntax | Example |
|---|---|---|
| Translate | `translate(x, y)` | `translate(50, 50)` |
| Scale | `scale(s)` or `scale(sx, sy)` | `scale(2)` |
| Rotate | `rotate(deg)` or `rotate(deg, cx, cy)` | `rotate(45)` |
| Skew | `skewX(deg)` or `skewY(deg)` | `skewX(10)` |

### Fill and stroke

```svg
<rect
  fill="#3B82F6"           /* Fill color */
  fill-opacity="0.8"       /* Fill transparency */
  stroke="#1D4ED8"         /* Stroke color */
  stroke-width="2"         /* Stroke width */
  stroke-opacity="0.9"     /* Stroke transparency */
  stroke-linecap="round"   /* butt | round | square */
  stroke-linejoin="round"  /* miter | round | bevel */
  stroke-dasharray="5 3"   /* Dash pattern */
/>
```

Color values:
```svg
fill="#3B82F6"                  /* Hex */
fill="rgb(59, 130, 246)"        /* RGB */
fill="rgba(59, 130, 246, 0.5)"  /* RGBA */
fill="currentColor"             /* Inherit from parent text color */
fill="none"                     /* Transparent */
```

Embedded CSS keeps presentation separate from structure:

```svg
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <style>
    .primary { fill: #3B82F6; }
    .secondary { fill: #EF4444; }
    .outline { fill: none; stroke: #000; stroke-width: 2; }
  </style>
  <circle class="primary" cx="50" cy="50" r="30"/>
</svg>
```

### `<defs>` and `<use>` — reusable elements

`<defs>` stores elements that don't render directly until referenced. This is where gradients, patterns, filters, clip-paths, and any reusable shape live.

```svg
<defs>
  <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%" stop-color="#3B82F6"/>
    <stop offset="100%" stop-color="#8B5CF6"/>
  </linearGradient>
  <circle id="dot" r="5"/>
</defs>

<rect fill="url(#grad1)" x="10" y="10" width="80" height="80"/>
<use href="#dot" x="20" y="20" fill="red"/>
<use href="#dot" x="50" y="50" fill="blue"/>
```

### Gradients

```svg
<defs>
  <linearGradient id="linear" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#3B82F6"/>
    <stop offset="100%" stop-color="#EF4444"/>
  </linearGradient>

  <radialGradient id="radial" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#FFF"/>
    <stop offset="100%" stop-color="#3B82F6"/>
  </radialGradient>
</defs>
```

For multi-piece characters where one gradient must span separate shapes (e.g., skin across face + neck + hand), use `gradientUnits="userSpaceOnUse"` so the gradient is pinned to absolute coordinates instead of refitting to each shape's bounding box.

### Clipping and masking

```svg
<defs>
  <clipPath id="circle-clip">
    <circle cx="50" cy="50" r="40"/>
  </clipPath>

  <mask id="fade-mask">
    <linearGradient id="fade" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="white"/>
      <stop offset="100%" stop-color="black"/>
    </linearGradient>
    <rect fill="url(#fade)" width="100" height="100"/>
  </mask>
</defs>

<rect clip-path="url(#circle-clip)" x="0" y="0" width="100" height="100" fill="#3B82F6"/>
<rect mask="url(#fade-mask)" fill="#3B82F6" width="100" height="100"/>
```

`clip-path` is a hard binary mask (inside or outside). `mask` uses luminance (white = fully visible, black = fully hidden, gray = partial) — essential for soft fade-outs.

### Best practices

Each rule below has a reason. Knowing the *why* lets you judge edge cases instead of mechanically following the rule.

1. **Always set `viewBox`.** Without it, the SVG renders at fixed pixel dimensions and can't scale responsively. The viewBox decouples internal coordinates from on-screen size.
2. **No background `<rect>` unless asked.** SVGs are transparent by default; adding a background couples the asset to the page color and breaks it on themed backgrounds.
3. **Group related elements with `<g>`.** Groups carry shared transforms and styles, and they're how animations target a whole limb / region at once.
4. **Use meaningful IDs.** Cryptic IDs like `g1`, `path42` become unmaintainable. Use slot-oriented names: `id="head-assembly"`, `id="hair-grad"`, `id="suit-{{ variant }}"`.
5. **Keep numeric precision to ~2 decimals.** More precision bloats the file without visible benefit; `cx="382.516789"` renders identically to `cx="382.52"`.
6. **Style with classes when reusing values.** Inline `fill` is fine for one-offs, but a `.primary`-class makes a 12-shape palette swap trivial.
7. **For comic illustrations, the inking layer goes on top.** Strokes that read as "ink" must not be overpainted by later fills or gradients. If you find a gradient sitting over the rim line you drew, the layer order is wrong — move inking down in the document so it renders last.
8. **Namespace IDs that may be reused on a page** with a variant token (`id="suit-{{ hero_variant }}"`). Two instances of the same asset on one page that share an ID will fight over the referenced gradient and visually swap fills when one re-renders.

## Positioning in the scene

### The viewBox coordinate system

```svg
<svg viewBox="minX minY width height" xmlns="http://www.w3.org/2000/svg">
```

| Parameter | Meaning |
|---|---|
| `minX` | Left edge X coordinate (usually 0) |
| `minY` | Top edge Y coordinate (usually 0) |
| `width` | Internal width in SVG units |
| `height` | Internal height in SVG units |

```
(0,0) ─────────────────────────► X (width)
  │
  │     (25%,25%)        (75%,25%)
  │        ●────────────────●
  │        │                │
  │        │   (50%,50%)    │
  │        │       ●        │
  │        │    center      │
  │        │                │
  │        ●────────────────●
  │     (25%,75%)        (75%,75%)
  │
  ▼
 Y (height)
```

| Position | Formula |
|---|---|
| Top-left | (0, 0) |
| Top-center | (width/2, 0) |
| Center | (width/2, height/2) |
| Bottom-center | (width/2, height) |

### Safe zone and max scale

Keep icon centers within 10–90% of viewBox so they don't clip at the edge:

```
availableSpace = viewBoxSize * 0.8
maxScale       = availableSpace / iconViewBoxSize
```

### Attaching effects at a point on an icon

When you add an effect (muzzle flash, sparks, glow) tied to a specific spot on an icon, the effect's coordinate must be in the icon's coordinate space — not the surrounding scene's space.

1. **Find the attachment point** in the icon's own viewBox (e.g., the gun barrel tip).
2. **Position the effect with `transform="translate(x, y)"`** at that coordinate.

```svg
<!-- Gun icon with viewBox 0 0 512 512, barrel tip at (486, 175) -->
<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <path d="M79.238 115.768..." fill="#333"/>

  <g transform="translate(486, 175)">
    <polygon points="0,0 15,-8 12,0 15,8" fill="#FF6600">
      <animate attributeName="opacity" values="1;0;1" dur="0.1s" repeatCount="indefinite"/>
    </polygon>
  </g>
</svg>
```

| Icon type | Attachment point | How to find |
|---|---|---|
| Guns / weapons | Barrel tip | Rightmost X, mid-height Y in icon's coordinate space |
| Swords / blades | Blade tip | Topmost or rightmost point in icon's coordinate space |
| Characters | Hand position | Locate arm/hand path segments and read their coordinates |
| Vehicles | Exhaust / wheels | Bottom or rear coordinates in icon's coordinate space |

**Debugging tip:** drop a temporary `<circle cx="…" cy="…" r="5" fill="red"/>` at the attachment point to verify position before adding the effect.

## Animations

Every animation that ships in this project must respect `prefers-reduced-motion: reduce` (WCAG 2.3.3). See [reduced-motion.md](./references/animations/reduced-motion.md) before authoring — gating is non-negotiable and accessibility audits check this first.

### Picking an animation engine — SMIL vs CSS vs WAAPI

Three mechanisms drive SVG animation; each has a sweet spot. Pick before you write the animation, not in the middle of debugging it.

| Engine | Sweet spot | Trade-offs |
|---|---|---|
| **SMIL** (`<animate>`, `<animateTransform>` inside the SVG) | Self-contained declarative SVG that travels with the asset (email-safe embeds, static SVG files served as `<img>`, customizer outputs). Compound motion via `additive="sum"` is cleaner here than in CSS. | Harder to orchestrate with application state. Cannot be paused by a CSS media query alone — reduced-motion gating needs `begin="indefinite"` + JS or a `display: none` wrapper (see [reduced-motion.md](./references/animations/reduced-motion.md)). |
| **CSS** (`@keyframes`, `transition`, `animation`) | Idle motion (breath, blink, sway), hover effects, page-level entrance animations. Cleanest `prefers-reduced-motion` story — one media-query block toggles everything. | Limited semantic control once interactions get complex; one `transform` rule wins per element (compound motion needs per-axis groups). Can't easily animate `d` across keyframes in older engines. |
| **WAAPI** (`element.animate([…], …)`) | Interactive state machines, timeline coordination, programmatic orchestration with promises and events. The browser owns timing; the application owns state. | More application code than CSS or SMIL. Path `d` interpolation is less consistent across engines than transform animation — use a library if you need cross-browser morphs. |

Most projects end up using a mix: **SMIL inside self-contained SVG assets, CSS for page-level effects, WAAPI when application state must drive timeline coordination**. The hero in this project uses SMIL because its compound motion (breath + cape rock + barbell lift + topic-icon cycle) needs `additive="sum"` and per-element `begin` staggering, both of which are clumsy in CSS without one `<animate>` per transform component.

### Animation references

| Topic | Reference | When to read |
|---|---|---|
| Rotation (any rotating element — wheels, gears, doors, levers) | [rotation-animations.md](./references/animations/rotation-animations.md) | Whenever the animation is a rotate around a pivot |
| Path following (object follows a path via `<animateMotion>` + `<mpath>`) | [path-following.md](./references/animations/path-following.md) | Orbits, conveyors, anything that traces a route |
| Path drawing (line appears on screen via `stroke-dasharray` + `stroke-dashoffset`) | [path-drawing.md](./references/animations/path-drawing.md) | Reveal-style line animations, signature draws |
| Path morphing (`d` interpolation across shapes) | [path-morphing.md](./references/animations/path-morphing.md) | Facial expressions changing silhouette, logo morphs, controlled shape transitions. Covers the matching-command-structure rule and library escape hatches (Flubber / d3-interpolate-path / Anime.js). |
| Idle cycles (breathing, blinking, hair sway, weight shift — "alive" loops) | [idle-cycles.md](./references/animations/idle-cycles.md) | Any character animation. Covers period, amplitude, and sync rules. |
| Easing and timing (`calcMode="spline"` + `keySplines`, cycle-length math) | [easing-and-timing.md](./references/animations/easing-and-timing.md) | Whenever you set a `dur` or pick an ease. Default ease-in-out (`0.4 0 0.6 1`) and why linear motion reads as robotic. |
| Additive transforms (`additive="sum"` to stack multiple animations on one element) | [additive-transforms.md](./references/animations/additive-transforms.md) | When breath + tilt + sway compound on one `<g>` |
| Multi-frame discrete cycles (`calcMode="discrete"` for sprite-like frame flipping) | [multi-frame-cycles.md](./references/animations/multi-frame-cycles.md) | Topic-icon rotators, expression cyclers, telegraphed pose stages |
| Reduced motion (required gating) | [reduced-motion.md](./references/animations/reduced-motion.md) | **Before any animation ships.** SMIL + CSS + WAAPI patterns, vestibular-safe amplitudes, WCAG 2.3.3. |

### The three levels of animation

A useful mental model from [path-morphing.md](./references/animations/path-morphing.md): most motion belongs in level 1 or 2, not level 3.

- **Attribute animation** — opacity, transforms, fills, radii. Cheap, robust. Most idle motion lives here.
- **Rig animation** — semantic controls (`--blink`, `--smile`) that drive multiple attributes. Survives illustration refactors. Best for expression systems and avatar customizers.
- **Topology animation** — the `d` attribute itself. Most expressive, most fragile. Use when shape change is the point; otherwise prefer rig animation.

## Reference map

**Core**
- [path-creation.md](./references/path-creation.md) — generate path `d` attributes with Python scripts
- [arrow-guidelines.md](./references/arrow-guidelines.md) — arrow tip shapes
- [fetching-icons.md](./references/fetching-icons.md) — Bootstrap / Font Awesome / Game Icons via MCP
- [paths_guidelines.md](./references/paths_guidelines.md) — full path-type catalog with example commands

**Characters**
- [style-families.md](./references/character/style-families.md) — picking a visual language (flat / soft-flat / semi-realistic / isometric / iconographic) before drawing
- [primitive-characters.md](./references/character/primitive-characters.md) — geometric mascots with consistent proportions
- [comic-hero.md](./references/character/comic-hero.md) — layered comic figures, inking, multi-pass shading, eye structure with catchlights
- [avatar-system.md](./references/character/avatar-system.md) — parametrizable customizer-driven avatar systems: descriptor schema, `<symbol>`/`<use>`/CSS-vars, seeded generation, variation taxonomy, representation, validation matrix
- [emotions.md](./references/character/emotions.md) — facial expressions and `clipPath`-based eye blink animation

**Animations**
- [rotation-animations.md](./references/animations/rotation-animations.md) — all rotation patterns with pivot math
- [path-following.md](./references/animations/path-following.md) — `<animateMotion>` + `<mpath>`
- [path-drawing.md](./references/animations/path-drawing.md) — `stroke-dasharray` reveal
- [path-morphing.md](./references/animations/path-morphing.md) — `d` interpolation, matching command structure, library escape hatches; three levels of animation (attribute / rig / topology)
- [idle-cycles.md](./references/animations/idle-cycles.md) — breath, blink, sway, weight shift
- [easing-and-timing.md](./references/animations/easing-and-timing.md) — `keySplines`, `calcMode`, cycle-length math
- [additive-transforms.md](./references/animations/additive-transforms.md) — stacking with `additive="sum"`
- [multi-frame-cycles.md](./references/animations/multi-frame-cycles.md) — discrete-mode opacity cycling
- [reduced-motion.md](./references/animations/reduced-motion.md) — `prefers-reduced-motion`, vestibular safety, SMIL + CSS + WAAPI gating patterns

**Pivots** (rotation around a specific anchor)
- [pivots/end-pivot-examples.md](./references/animations/pivots/end-pivot-examples.md) — fixed-anchor rotation (clocks, pendulums, doors)
- [pivots/center-pivot-examples.md](./references/animations/pivots/center-pivot-examples.md) — spin around center (fans, wheels, gears)
- [pivots/edge-point-pivot-examples.md](./references/animations/pivots/edge-point-pivot-examples.md) — rotation from arbitrary perimeter points
- [pivots/attached-objects-examples.md](./references/animations/pivots/attached-objects-examples.md) — parent rotates with attached children (seesaws, Ferris wheels)

## Rotation conventions

The project uses a clock-style rotation system: **0° points up, positive angles rotate clockwise, negative rotate counter-clockwise.**

To reach a target orientation:
1. Draw the shape **pointing up** (0°).
2. Apply `rotate(target_degrees)`.

| Target | Transform |
|---|---|
| 45° (up-right) | `rotate(45)` ✓ |
| 135° (down-right) | `rotate(135)` ✓ |
| 270° (left) | `rotate(270)` or `rotate(-90)` ✓ |

❌ `rotate(-45)` does **not** give 45° (up-right) — it gives 315° (up-left). Don't negate to reach a positive angle.
