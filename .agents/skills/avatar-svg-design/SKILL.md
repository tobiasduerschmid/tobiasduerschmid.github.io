---
name: avatar-svg-design
description: Project rule for drawing comic-style hero/avatar SVG artwork in the SE Gym customizer. USE THIS SKILL EVERY SINGLE TIME you write, edit, review, restructure, or delete any SVG path in [`_includes/se-gym-hero.svg`](../../../_includes/se-gym-hero.svg) — any `data-hero-slot="hair"`, `"hairline"`, `"hair-root"`, `"head-shape"`, `"face-clear"`, `"head-features"`, `"eye-shape"`, `"eyebrow"`, `"eyelash-style"`, `"ear-shape"`, `"nose-shape"`, `"mouth-style"`, `"face-feature"`, `"facial-hair"`, `"accessory"`, `"silhouette"`, `"body-shape"`, `"outfit-style"`, `"emblem"`, `"milestone-power"`, `"mascot"`, `"mascot-arms"`, `"mascot-paws"` group, any `data-hero-default-torso` / `data-hero-default-buckle` / `data-hero-buckle-default` / `data-hero-default-head` / `data-hero-neck-base` / `data-hero-head-assembly` / `data-hero-kind-layer` / `data-hero-barbell` / `data-hero-motion` block, any gradient / pattern / clipPath / filter in the `<defs>` of that file, any CSS variable like `--hero-hair`, `--hero-hair-light`, `--hero-hair-dark`, `--hero-hair-rim`, `--hero-skin`, `--hero-suit`, `--hero-cape`, `--hero-face-line`, `--hero-eye`, `--hero-mouth-fill` in `js/se-gym-hero-avatar.js` or anywhere else, any choice entry in `HERO_CHOICE_SETS` / `PALETTES` / `BRUIN_DEFAULTS` / `BODY_SHAPES` in `js/se-gym-hero-avatar.js`, any avatar contrast token computation in `avatarContrastTokens()`, any thumbnail preview generator, any `_includes/se-gym-customizer.html`, or any new hair / facial-hair / eye / nose / mouth / accessory / outfit / body-shape / emblem / mascot option added to the system. Trigger when adding a new hair style, a new outfit, a new accessory, a new eye / mouth / nose option, a new body shape, a new emblem, a new mascot variant, a new milestone tier, or any new visual element on the hero; when fixing a "the hair looks bad" / "the smile is weird" / "the eyes don't match" / "make this more polished" / "make this more comic" / "the avatar doesn't look like me" / "match this reference photo" complaint; when refactoring the SVG path data for an existing option; when adjusting outline weights / cel shading / gradients / colors in the avatar SVG; when adding a thumbnail-only variant. The hero customizer is the centerpiece of [`/se-gym/`](../../../se-gym.html) and the trapdoor by which students personalize their relationship with the site — bad-looking hero art makes the whole feature feel toy-grade. **Drawing comic-style SVG hair, faces, and bodies is much harder than it looks, and naive approaches reliably produce amateurish results — the single biggest predictor of whether SVG hair reads as "polished comic" or "amateur" is the number of `L` (line) commands in the silhouette and the regularity of the wisp spacing.**
---

# Avatar SVG Design

## Why this skill exists

The SE Gym customizer at [`/se-gym/`](../../../se-gym.html) is the project's most ambitious illustrative surface. It is also the part where well-intentioned edits most reliably go off the rails — because drawing a stylized human face in SVG path syntax is a problem that *looks* like "just draw the shape you want" but is in fact a small applied design discipline with its own conventions, traps, and pedagogy.

This file captures every painful lesson I've learned trying to draw comic-style hair, faces, and accessories for this hero. It is grounded in:

- **The avataaars source code convention** (Pablo Stanley's open-source SVG avatar system, the de-facto reference for "what good cartoon avatar SVG looks like under the hood"),
- **Cognitive-load-friendly comic-art pedagogy** from Clip Studio Tips, Domestika, and Wacom's *Etherington Bros Comics Crash Course* (the Shapes → Tufts → Strands framework, the "minimum / maximum volume" guideline, the "clump don't space" rule),
- **Specific mistakes that have already shipped in this codebase and had to be reverted**, documented below so the next agent can recognize them in their own work.

The renderer is checked into [`_includes/se-gym-hero.svg`](../../../_includes/se-gym-hero.svg), driven by [`js/se-gym-hero-avatar.js`](../../../js/se-gym-hero-avatar.js), and customized through the dialog in [`se-gym.html`](../../../se-gym.html). Every option visible in the customizer's UI is a `<g data-hero-slot="…" data-hero-option="…" display="none">` group inside the SVG.

## Inclusive trait model

The avatar describes physical and stylistic traits, not inferred identity. Skin tone, head shape, eyes, nose, mouth, hair, facial hair, lashes, body frame, clothing, and head coverings must remain independently combinable.

- Never add race- or ethnicity-labeled face presets. Use literal geometry labels such as “wide bridge,” “rounded tip,” or “soft oval.”
- Never gate a trait by binary presentation. In particular, facial hair, prominent lashes, long hair, protective styles, turbans, scarves, hijabs, and headwraps must remain available in any combination.
- Random generation samples independent trait families. Do not reintroduce male/female recipes or use cultural accessories as demographic proxies.
- Keep the legacy `appearance.presentation` enum readable only for saved-state compatibility; the renderer and new random avatars ignore it.
- Give darker skin tones, protective hairstyles, fuller bodies, and head coverings the same shading, detail, animation, and compatibility care as every other option.

## The single biggest rule

**Never use `L` (straight line) commands in a hair, hairline, or facial-feature silhouette path. Never.**

Every time someone (including me) has tried to draw "wispy strand tips" by alternating `L` commands like

```
... L 442 172 L 438 188 L 432 170 L 426 184 L 418 168 L 410 188 ...
```

the result has been a saw-tooth zig-zag that the user has explicitly described as "amateurish". The geometry creates sharp corners every 8–10 pixels, which read in the rendered comic as raw triangular spikes rather than soft hair. There is no amount of stroke-linejoin or stroke-linecap that rescues this — the underlying corners are still sharp.

Use only `C` (cubic Bezier) and occasionally `Q` (quadratic Bezier) for the silhouette and all fringe / wisp edges. Cubic curves with two control points give you the fine control you need to make a *wisp tip* rather than a *triangle tip*.

**Why this is the single biggest rule:** the difference between professional comic-style hair SVG (e.g., the avataaars project) and amateurish hair SVG is overwhelmingly down to whether the silhouette is made of carefully placed cubic Beziers or zig-zag straight lines. Everything else (colors, layering, shading) is secondary.

## Style doctrine: soft-flat, not flat-flat and not semi-realistic

After surveying the avatar literature (DiceBear, Open Peeps, Humaaans, Bitmoji, Memoji, plus the Anthropic deep-research review of parameterizable avatar systems), the project's house style is **soft-flat**: flat fills with restrained gradients, layered shape overlap, and a single bold rim stroke per major silhouette. This sits between two failure modes:

- **Fully flat** (one color per shape, no gradient, no shadow plate): too iconographic; loses the comic warmth the project wants.
- **Semi-realistic** (multi-stop gradients everywhere, soft drop-shadow filters, painterly highlights): too heavy; doesn't scale across the user's full demographic option space, gets muddy at small sizes, and bloats the rendered file.

Soft-flat means: one CSS-variable-driven hair-grad on the silhouette + **one** cel-shaded shadow plate + **one** cel-shaded highlight plate + at most a sheen stroke and a few flow lines. If you find yourself adding a third gradient or a Gaussian-blur filter, stop — you're drifting into semi-realistic territory and your design will not survive the contrast-token system that retints every color per user.

## Family-based silhouette generation

A second high-leverage insight from the research review: don't think of each hair style as a unique snowflake; think of it as a *parameter combination on a family*.

```
hair = family + length + front_layer + back_layer + volume + texture
```

- **Family** — `fringe`, `side-swept`, `crop`, `fade`, `bob`, `long-straight`, `curly`, `coily`, `braids`, `locs`, `updo`. The family controls overall silhouette shape; everything else is a parameter on top.
- **Length** — short / medium / long. Determines whether the back_layer extends below the shoulders.
- **front_layer** — the part of the hair the viewer sees first: bangs, sweep, fringe wisps. Most stylistic identity lives here.
- **back_layer** — the part of the hair behind the head: the halo, the volume cue, the sides. Often subtle; usually drawn first in z-order.
- **volume** — control-point offsets on the silhouette; how far the maximum-volume line sits from the skull.
- **texture** — straight / wavy / curly / coily. Mainly controls the *flow lines* and *strand-tip detail* layers, not the silhouette.

**The most common omission** is the back_layer. A hair style with only a front silhouette and no back-layer halo looks pasted-on; the head doesn't appear to have hair *behind* it, just hair stuck *to its forehead*. Even a few-pixel back-layer halo, drawn first and slightly offset behind the front silhouette, fixes this. See the `tousled-wispy-fringe` group in [`_includes/se-gym-hero.svg`](../../../_includes/se-gym-hero.svg) for the back-layer-first pattern.

## The professional convention: one complex path, not many simple shapes

The most counter-intuitive lesson is this:

> **A piece of polished comic-style hair is _one_ continuous SVG path with 20–30 chained cubic Beziers, _not_ a stack of separate shapes for "main silhouette + 6 individual wisps".**

Look at any hair file in the [avataaars source](https://github.com/fangpenlin/avataaars/blob/master/src/avatar/top/ShortHairShaggy.tsx). The path data is a single `<path d="M … C … C … C … Z" />` where the wavy, tousled, irregular edges are baked into the path through carefully placed control points on short cubic Bezier segments.

The reason this convention wins:

1. **The outline is continuous.** A single rim stroke wraps around the entire silhouette without joint artifacts where multiple sub-paths meet.
2. **The fill is one shape.** A gradient or pattern fills the whole hair mass uniformly. With multiple stacked shapes, you can see seams where opacities or gradient origins differ subtly.
3. **The strand tips integrate with the silhouette.** They look like *part of the hair*, not like ornaments glued on top.
4. **Z-order is simpler.** You don't have to worry about the order in which six wisp-shapes overlap.

**When to break this rule (sparingly):** A single small *highlight* layer (cel-shaded brighter region) on top of the silhouette is fine and traditional. So is a single small *crown cowlick* sitting on top. The rule applies to the *silhouette and fringe* — those must be one path.

## The three-method framework (Clip Studio / Wacom pedagogy)

Professional comic artists construct hair in three passes, in this order:

| Pass | What it produces | In SVG terms |
| --- | --- | --- |
| **1. Shapes** | The overall silhouette, viewed as a single mass wrapping around the skull. Defines the volume and the general direction of the sweep. | One complex path with cubic Beziers. |
| **2. Tufts** | Two to four asymmetric *clumps* of hair within the silhouette. Tufts radiate from the crown outward. | Internal cel-shaded fills (mid-tone shadow shape, top-light highlight shape) hinting at the tufts, plus subtle ridge lines. |
| **3. Strands** | A handful of individual strand tips and flow lines suggesting texture. Strands taper from thick at the root to thin at the tip. | Short stroked paths (`stroke-linecap="round"`, varying `stroke-width`) drawn over the silhouette. |

**The cardinal sin** at the strands stage is drawing strands as *evenly spaced parallel lines*. Real tousled hair clumps. Three close strands plus a gap plus two strands plus a bigger gap plus one strand looks like hair. Six strands at equal 12-pixel spacing looks like a comb.

The Clip Studio guide puts it bluntly: *"clump a few strands together, so it looks more natural. It should not be evenly spaced."* This is the single most important pedagogical principle for strand work.

The same rule governs the **`curl-symbol` texture marks** on the curly / coily family (`curly`, `coils`, `afro`, `rounded-afro`, `curly-bob`, `rounded-curls`, `voluminous-curls`, `curly-layers`). The standard block (July 2026 cleanup) is **two tone groups, clumped asymmetrically**: a `--hero-hair-dark` group (stroke ~1.8–2, opacity ~.4) whose arcs tuck into *specific perimeter bumps* — these carry the texture on light hair — plus one or two `--hero-hair-light` arcs (stroke ~1.4–1.5, opacity ~.55) *inside the key-light zone only* — these carry it on dark hair. A single rim-tone group fanned evenly across the crown reads as floating scribbled worms; that shipped and was reworked. Vary every scale and rotation, and keep marks concentric with the silhouette scallop they sit inside.

## Volume guidelines (minimum and maximum volume)

The Etherington Bros / Clip Studio rule:

- Draw the **minimum volume line** — the curve that hugs the skull just outside the bone.
- Draw the **maximum volume line** — the curve that defines the farthest extent of the hair silhouette.
- All hair, all strands, all wisps live between those two lines.

In this codebase's coordinate space (see the next section), the head's bone curve is roughly:

- Crown at `(400, 126)`
- Temples at `(357, 144)` / `(443, 144)`
- Bottom of head at `(400, 240)`

So the minimum-volume line for a short hair style is something like `M 357 178 C 357 144, 372 128, 400 126 C 428 128, 443 144, 443 178` (i.e., it traces the top of the skull).

The maximum-volume line depends on the style — for a tight crop it's only ~10 px outside the skull; for a tousled fringe it's ~20–30 px above and ~10 px wider on each side. **A common mistake is putting the maximum-volume line too far from the skull**, which makes the avatar look like it's wearing a helmet rather than having hair. Compact, head-hugging silhouettes read as "hair"; oversized blob silhouettes read as "hat".

## Project coordinate system (memorize this section)

Every avatar option in [`_includes/se-gym-hero.svg`](../../../_includes/se-gym-hero.svg) is drawn into the same coordinate space. Memorize the key landmarks before placing a single point:

| Landmark | x | y |
| --- | --- | --- |
| Hero center (viewBox center) | 400 | ~322 |
| Top of skull (default head shape) | 400 | 126 |
| Left temple | 357 | 144 |
| Right temple | 443 | 144 |
| Eyes (default round) | 381 / 419 | 185 |
| Nose tip | 400 | ~200 |
| Mouth (smile) | 400 | ~225 |
| Chin (default head) | 400 | 240 |
| Neck base | 400 | ~262 |
| Shoulder line | 320 / 480 | ~268 |
| Belt/waist | 400 | ~410 |
| Boot top | 372 / 428 | ~552 |
| Foot bottom | ~370 / ~430 | ~624 |
| Barbell bar | 280–520 | ~85 |

The viewBox is `80 -20 640 665`. The entire head + face + hair group is wrapped in:

```svg
<g data-hero-head-assembly
   transform="translate(400 236) scale(1.16) translate(-400 -236)">
```

— a `1.16x` enlargement around `(400, 236)`. This means that when you place a point at `(x, y)` inside the head assembly, its rendered position is `(400 + 1.16·(x − 400), 236 + 1.16·(y − 236))`. Hair at `y = 126` (skull crown) renders at screen y ≈ 108.4. Hair at `y = 178` (fringe bottom) renders at screen y ≈ 168.72.

**Practical consequence:** if you draw hair extending up to `y = 60`, it will collide with the barbell (which sits at y ≈ 85–110). If you draw fringe wisps extending down to `y = 195+`, they will cover the eyes (which render at screen y ≈ 178.88). Keep the silhouette in the `y = 96–178` range, with optional wisp tips reaching at most `y = 184`.

## The CSS variable color system

**Do not hardcode hair / skin / suit colors.** The avatar reads CSS variables that [`js/se-gym-hero-avatar.js`](../../../js/se-gym-hero-avatar.js) sets dynamically based on each user's saved appearance. The same SVG paths render as a brunette in tactical blue or a blonde in red-and-gold depending on the user.

The variables you should use, with the fallback hex from [`_includes/se-gym-hero.svg`](../../../_includes/se-gym-hero.svg):

| Variable | Meaning | Fallback |
| --- | --- | --- |
| `--hero-hair` | Hair main fill | `#1f140c` |
| `--hero-hair-light` | Cel-shaded hair highlight | `#4a3220` |
| `--hero-hair-dark` | Hair shadow / rim outline | `#0f0905` |
| `--hero-hair-rim` | Inner strand definition lines | `#4a3220` |
| `--hero-hair-specular` | Hair-derived sheen; never raw white | warm hair-relative tone |
| `--hero-hair-detail-opacity` | Opacity for fine strand detail | `.5` |
| `--hero-skin-light` | Skin lit side | `#dfa07a` |
| `--hero-skin` | Skin mid | `#b46a3d` (darken 22%) |
| `--hero-skin-mid` | Skin mid-tone | `#c5815b` |
| `--hero-skin-highlight` | Skin specular | `#fff1dc` (light skin) |
| `--hero-face-line` | Face contour line | `#7a4a2a` (light skin) |
| `--hero-eye` | Iris color | user-chosen |
| `--hero-eyebrow` | Eyebrow stroke | contrast-aware |
| `--hero-mouth-fill` | Mouth interior | `#5a2418` |
| `--hero-mouth-line` | Mouth outline | `#3a1408` |
| `--hero-lip-fill` | Lip fill (full-lips mouths) | varies by skin |
| `--hero-cheek` | Blush | varies by skin |
| `--hero-suit` | Suit primary | user-chosen |
| `--hero-suit-light` / `--hero-suit-dark` | Suit shading | derived |
| `--hero-suit-shadow` / `--hero-suit-rim` | Suit occlusion and edge light | derived |
| `--hero-suit-specular` / `--hero-suit-ambient` | Suit highlight and fill light | derived |
| `--hero-hand-highlight` | Skin-relative hand form light | derived |
| `--hero-cape` | Cape outer | user-chosen |
| `--hero-cape-inner` | Cape inner / gold trim | user-chosen |
| `--hero-glasses-frame` | Glasses frame | contrast-aware |
| `--hero-glasses-frame-dark` | Glasses bridge | contrast-aware |
| `--hero-glasses-metal` | Wire frames | contrast-aware |
| `--hero-lens-fill` | Glasses lens tint | varies |

For gradients, the SVG defines `hair-grad-{{ hero_variant }}`, `skin-{{ hero_variant }}`, `suit-{{ hero_variant }}`, `gold-{{ hero_variant }}`, `boot-cream-{{ hero_variant }}`, etc. Always reference these by URL: `fill="url(#hair-grad-{{ hero_variant }})"`.

**The contrast logic is non-trivial.** Inspect `avatarContrastTokens()` in [`js/se-gym-hero-avatar.js`](../../../js/se-gym-hero-avatar.js:~1700) before assuming a color will work — it adjusts highlights, rims, eyebrows, glasses frames, and face lines to maintain WCAG-compliant contrast for the user's combination of skin and hair color. Hardcoding a hex that "looks fine" against your test palette will likely fail catastrophically against someone else's. (See also the `light-dark-mode` and `wcag-aa-compliance` skills.)

### The desaturated-highlight trap (and the `color-mix` re-warm fix)

The `--hero-hair-light` token (`contrastTokens.hairHighlight`) is **deliberately desaturated** for dark hair: for near-black hair it resolves to a flat warm-*gray* (e.g. `#776c64`, not the SVG's warmer `#4a3220` fallback). That is correct for the JS's purpose — lightening near-black always washes out saturation — but if you then drop that token in at full strength as the *top stop of `hair-grad`* (or as a broad top-light plate at high opacity, or pair it with a pure-`#ffffff` sheen stroke), the result is a **gray crown streak that reads like gray hair or a bald patch** on every dark-haired user. This shipped and looked unprofessional until fixed.

**Two compounding mistakes produce it:** (1) the highlight *color* is gray, and (2) it's applied as a large flat zone with a hard edge to the base. Fix both **in the SVG** (the token itself is contrast-mandated — don't fight it, and don't edit the JS to "fix" the color or you may regress feature contrast):

- **Re-warm toward the user's own hair base with `color-mix`** (already used elsewhere in the project, e.g. `css/tutorial.css`): `color-mix(in srgb, var(--hero-hair-light, #4a3220) 58%, var(--hero-hair, #1f140c))`. Mixing toward `--hero-hair` is **safe for every hair color** — it pulls a blonde highlight toward blonde and a black highlight toward black; it never injects a foreign hue. Mixing toward a fixed warm hex would muddy blondes, so don't.
- **Shape it as a soft sheen, not a flat plate** — a two-step gradient falloff (highlight → half-strength → base by ~38 %) avoids the hard light/dark seam.
- **Warm any pure-white sheen stroke** the same way (`color-mix(in srgb, #ffffff 60%, var(--hero-hair-light, …))`) and keep its opacity ≤ ~0.3; pure white at 0.34 over near-black hair is itself a gray line.

This is purely decorative (the SVG is `aria-hidden`), so it is **not** a WCAG concern — but the shared `hair-grad` gradient feeds ~270 fills across all ~90 hair styles, so verify the change on short / fade / long / curly / afro / locs / braids / bun styles and on the blonde + dark-on-dark palettes before trusting it.

## The hero-slot system

Every customizable feature is a `<g data-hero-slot="…" data-hero-option="…" display="none">` element. The JS reads `state.appearance.hairStyle` (etc.) and toggles `display="inline"` on the matching group, `display="none"` on all others. The slot system is the contract:

- **You may add new options** by adding a new `<g data-hero-slot="hair" data-hero-option="my-new-style" display="none">…</g>` block. You must also add `choice('my-new-style', 'My New Style')` to `HERO_CHOICE_SETS.hairStyle.groups[…].options` in [`js/se-gym-hero-avatar.js`](../../../js/se-gym-hero-avatar.js).
- **You must add a matching hairline** (`<g data-hero-slot="hairline" data-hero-option="my-new-style" display="none">…</g>`). The hairline is the *forehead shadow* under the bangs/fringe. If your style has no fringe, leave the group empty.
- **You should consider adding a hair-root** (`<g data-hero-slot="hair-root" data-hero-option="my-new-style" display="none">…</g>`) if the style needs additional details behind the head (e.g., long hair).
- **Bookkeeping in JS:** Check `SHORT_HAIR_STYLES`, `POLISHED_SHORT_HAIR_STYLES`, `PARTIAL_HEAD_COVERAGE_HAIR_STYLES`, and other lookup tables in [`js/se-gym-hero-avatar.js`](../../../js/se-gym-hero-avatar.js:~920). Failing to register a new style in the relevant list means it won't be selectable from the right preset group.

For non-hair slots:

- **Eye shapes** must define both a `<clipPath id="eye-{shape}-left-{{ hero_variant }}">` and `<clipPath id="eye-{shape}-right-{{ hero_variant }}">` in `<defs>` (~line 125), then the visible `<g data-hero-slot="eye-shape" data-hero-option="…">` group draws the white sclera, dark iris (clipped), pupil, and catchlight.
- **Mouth styles** must define the mouth-fill (inner) and outline. The smile-cheek-shadow opacity is controlled by `--hero-smile-cheek-shadow-opacity`.
- **Accessories** can be additive (glasses + headphones can co-exist). The JS calls `setMultiSlot('accessory', […])`. Some accessory groups are mutually exclusive — defined in `HAIR_COVERING_ACCESSORIES`.

## Cel-shading layer order

A polished comic-style hero option is constructed in this layer order (back to front). Layers 1 and 2 implement the **back_layer / front_layer** separation from the family-based silhouette pattern above:

1. **Back-layer halo** — the hair *behind* the head. A slightly larger silhouette in the darkest hair color, opacity `.5–.6`, sometimes translated `(+2, +4)` for soft depth. This is what makes the head look like it actually has hair growing on it, not hair pasted on its forehead. Omit only for truly skull-hugging styles (buzz, fade, bald).
2. **Main silhouette (front_layer)** — the single complex path. Fill: `url(#hair-grad-{{ hero_variant }})`. Stroke: `var(--hero-hair-dark, #0f0905)`, width `3.0–4.0`, `stroke-linejoin="round"`, `stroke-linecap="round"`.
3. **Sweep / mid-tone shadow** — a smaller cel-shaded shape inside the silhouette, indicating the volumetric shadow side. Fill: `var(--hero-hair, #1f140c)` or `var(--hero-hair-dark, #0f0905)` at opacity `.32–.42`. No stroke. Per the soft-flat doctrine, this is **one** plate, not a gradient — sharp edges.
4. **Top-light highlight** — a smaller cel-shaded shape on the lit side of the crown. Fill: `var(--hero-hair-light, #4a3220)`, opacity `.55–.72`. No stroke. Again **one** plate, sharp-edged.
5. **Specular sheen** — a thin bright stroke (white at low opacity, `stroke-width="2.5–3.2"`) along the brightest catchlight, optionally paired with a slightly lower warm-tone parallel stroke for depth.
6. **Flow / feathering detail** — 2–4 short stroked paths suggesting strand direction. `stroke="var(--hero-hair-rim, #4a3220)"`, `stroke-width="1.4–1.7"`, `opacity="var(--hero-hair-detail-opacity, .5)"`.
7. **Strand-tip definition** — small dark accents inside each fringe lock, mirroring the lock geometry.
8. **Strand-tip highlights** — small light accents inside each fringe lock, on the lit side.
9. **Crown cowlick / signature tuft** — optional small standing strand, with its own thick rim outline. Treat as a separate small path.
10. **Comic crown detail (`use href="#comic-crown-hair-detail-{{ hero_variant }}"`)** — the shared decorative crown lines defined once in `<defs>`. Always include this at the end of a hair group; it's what ties the project's styles together aesthetically.

Outline weights, by rule of thumb:

| Element | Stroke width | Why |
| --- | --- | --- |
| Main hair silhouette | 3.0–4.0 | The boldest outline in the avatar. |
| Crown cowlick | 2.2–2.6 | Reads as part of the hair mass. |
| Eye sclera outer (default round) | none (white fill) | Eyes' bold rim comes from glasses or from the pupil. |
| Iris / pupil clip-paths | 1.2–1.5 inside | Crisp small details. |
| Eyebrows | 2.0–2.7 | Strong feature read. |
| Glasses (rectangular) | 3.0–4.2 | Glasses are a focal point. |
| Suit silhouette / panels | 2.1–3.0 | Suit is busy; thinner strokes prevent overpowering the face. |
| Boot stroke | 2.4–3.0 | Defines feet clearly. |
| Cape silhouette | 2.4–3.3 (variable) | Cape often uses no stroke, relying on gradient + inner ribbon. |

## Wisp construction: how to make a fringe lock that reads as a strand of hair, not a triangle

A fringe lock (wispy strand tip) is a *tapered teardrop* that hangs down from the main silhouette. It must:

- Be wider at the root (where it joins the silhouette) than at the tip.
- Taper to a *rounded* point, not a sharp `L`-corner.
- Curve along an *S* or *C* axis — a perfectly straight strand looks fake.
- Have an outline that flows with the curve (`stroke-linejoin="round"`).

The avataaars convention embeds the wisp into the silhouette. Inside the main `<path d="…">`, after the right side of the silhouette has come down, you walk across the bottom with alternating "down to tip, up to next root" cubic Beziers:

```
... (right side of silhouette arrives at (442, 170)) ...
C 438 174 432 184 428 178      <- right-side wisp: dips to ~(432, 180) and comes back up to (428, 178)
C 424 174 420 170 416 172      <- recess between wisps
C 412 178 404 188 398 184      <- long center-right wisp: dips to ~(403, 187) and comes up
C 392 178 386 170 382 172      <- recess
C 378 180 372 188 366 182      <- long center-left wisp
C 360 176 354 170 350 174      <- recess
C 348 178 346 180 348 176      <- back to start; leftmost gentle dip
Z
```

Each wisp uses *one* cubic Bezier whose two control points are positioned **further down (higher y)** than the start and end points — pulling the curve into a downward dip. The depth of the dip is controlled by how far down the controls are placed:

- Subtle wisp (~5 px dip): controls at `y_root + 6`.
- Medium wisp (~10 px dip): controls at `y_root + 14`.
- Dramatic wisp (~16 px dip): controls at `y_root + 22`.

**Vary the dips.** Three medium dips next to each other is boring. A short dip, then a medium, then a dramatic, then a recess that's also slightly irregular — that reads as *tousled*.

**Asymmetry rules.** Even spacing kills the comic-art feel. For a fringe that spans `x = 350` to `x = 442` (92 px), don't put six wisps at `x = 360, 374, 388, 402, 416, 430`. Instead, cluster:

- A pair of short wisps near the left temple (`x = 354, 364`).
- A gap (`x = 364 → 380`).
- A clump of three at center, with the middle one longest (`x = 380, 390, 402`).
- A gap.
- A single asymmetric wisp on the right (`x = 422`).
- A small flick at the far right (`x = 438`).

That's six wisps but they read as *three clumps* — left pair, center trio, right single — which is what tousled hair actually does.

## What I just shipped and had to revert (don't repeat these)

Three distinct attempts at the `tousled-wispy-fringe` hair style had to be redone. The mistakes:

### Attempt 1: Saw-tooth `L`-line silhouette

```svg
<path d="M 347 165 C 346 150, 350 135, 360 120 …
         L 448 160 L 446 172 L 440 156 L 435 168 L 428 152 L 423 165 …
         Z"/>
```

The bottom edge of the silhouette was a series of straight-line zig-zags using `L 442 172 L 438 188 L 432 170 L 426 184 …`. The user's verbatim feedback was *"it looks very bad and not like the reference at all."* The corners were sharp triangles. No amount of stroke-linejoin or stroke-linecap fixed the fundamental geometry. **Lesson: never use L for the fringe.**

### Attempt 2: Wrong proportions (helmet hair)

```svg
<path d="M 346 178
         C 338 150 342 116 358 98
         C 370 82 388 76 398 86 …
```

The silhouette extended up to `y = 76` (50 px above the skull crown) and out to `x = 338 / x = 462` (20 px wider than the head on each side). The result looked like a comic helmet, not hair. **Lesson: match the maximum-volume line of other hair styles in the file — top around `y = 100–116`, sides around `x = 350–450`.**

### Attempt 3: Six evenly-spaced identical leaf wisps

```svg
<g fill="url(#hair-grad-…)" stroke="var(--hero-hair-dark, …)" stroke-width="2.4">
  <path d="M 354 162 C 348 168 348 178 354 180 C 360 176 362 168 360 160 Z"/>
  <path d="M 368 160 C 362 168 362 180 370 180 C 376 176 376 168 374 158 Z"/>
  <path d="M 384 158 C 376 168 378 180 388 180 C 394 176 396 166 392 156 Z"/>
  <path d="M 402 158 C 396 168 400 180 408 180 C 414 174 414 164 410 156 Z"/>
  <path d="M 420 160 C 416 168 420 178 426 178 C 432 174 432 164 428 158 Z"/>
  <path d="M 436 164 C 434 170 440 176 444 174 C 446 168 442 162 440 162 Z"/>
</g>
```

Six leaf-shaped wisps drawn *as separate paths on top of the silhouette*, at uniform 14-px spacing, with near-identical shapes. The user's verbatim feedback: *"all of the hair patterns look super amateurish."* Two compounding problems: (a) the avataaars convention is one path, not separate wisps stacked on top, and (b) even if you do stack wisps, they must cluster asymmetrically, not march in lockstep. **Lesson: embed the wisps into the silhouette path with varied dip depths and clumped (not even) spacing.**

## Comic crown detail (the project's shared aesthetic)

In `<defs>`, the file defines:

```svg
<g id="comic-crown-hair-detail-{{ hero_variant }}" clip-path="url(#comic-crown-hair-clip-…)">
  <!-- highlight lines, shadow strokes, parting hint -->
</g>
```

Every hair option ends with `<use href="#comic-crown-hair-detail-{{ hero_variant }}"/>`. This is the project's *house style* — small comic-y crown highlights, hair-parting hint, top-of-head shadow. Always include this at the end of a hair group; it's what makes the avatar styles feel like they belong to the same set rather than disparate clipart.

If you're adding a hair style that should *not* have a visible parting (a buzz cut, a bald, a full helmet of curls), it's fine to omit. But for every fringe / parted style, include the `<use>`.

## Face features: eye, nose, mouth, eyebrow

The same principles apply, scaled down:

- **Eyes** are constructed inside-out: white sclera path → dark iris circle clipped to the eye shape → bright pupil → tiny catchlight dot. The catchlight is what makes the eye read as "alive" — never omit it. The "round" default has both a tiny `#fff` catchlight near `(383.6, 184.6)` and a soft secondary one at `(381.1, 188.1)`. Adding a second catchlight is the cheapest possible upgrade to readability.
- **Eyebrows** must use `var(--hero-eyebrow, …)` — they're contrast-adjusted by JS for users whose hair color is too close to their skin to read directly.
- **Mouths** range from `smile` (simple curve) to `toothy-bright-smile` (multi-layer with teeth, cheek dimples, soft lip line). Match the mouth's *complexity* to the rest of the option set — a tutorial avatar that already uses a simple round eye should not have a hyper-detailed multi-tooth grin; the visual weight will be lopsided.
- **Noses** are 90% subtle: a soft shadow plus a single nostril dot is usually enough. The `noseOpacity` and `nostrilOpacity` variables get set by JS based on skin tone — darker skin tones need higher opacity (the contrast against `#dfa07a` skin is different from against `#3d2515` skin). **Keep the bridge contour short.** A bridge shadow/highlight stroke that runs the *full* length of the nose (from between the eyes down to the tip) reads as a long drawn line down the middle of the face — amateurish, and the most common "nose looks off" complaint. For the generic `soft` / `rounded` noses, start the bridge stroke roughly halfway down (≈ `y=197` rather than `y=189`) so it defines only the lower bridge → tip and the upper bridge stays implied by the face's own form shadow. **Do _not_ blanket-shorten every nose option** — characterful noses (aquiline, wide, prominent-bridge variants) keep their full bridge *on purpose*; shortening them all homogenizes the set and erases the variety users pick between.

## Accessories: glasses, headphones, headwear, jewelry

Most accessories sit inside a `transform:scale(.8620689655); transform-origin: 400px 252px` group in the SVG's scoped styles. This is the inverse of the `1.16x` head-assembly scale, so body-anchored accessories retain their authored size. **If you add a new accessory and it looks "too big", check whether the standard inverse-scale rule applies** — a fresh `<g data-hero-slot="accessory">` without it renders at full head-assembly scale.

Glasses specifically must:

- Use `var(--hero-glasses-frame, …)` for the frame stroke, `var(--hero-glasses-frame-dark, …)` for the bridge, `var(--hero-lens-fill, …)` for the lens fill (a barely-visible white at low alpha).
- Have a small white catchlight stroke inside each lens (`stroke="#ffffff"`, `stroke-width="1.2–1.6"`, `opacity=".42–.5"`) — this is the *single* most important detail that makes glasses look like glass instead of paint.

## Body shapes, outfits, and mascots

The SVG includes 21 body-shape variants and 22 outfit options. Body shapes share the suit gradient (`url(#suit-{{ hero_variant }})`); outfits override or layer on top.

When adding a new body shape:

- Match the existing path structure: an outer darker silhouette path + an inner gradient-filled path. The outer path is `fill="#0a3e6f"` (the suit-dark fallback); the inner uses `fill="url(#suit-{{ hero_variant }})"`.
- Keep the same waistline (`y ≈ 410`) and neckline (`y ≈ 246`) so the belt buckle, shoulders, and head assembly still align.
- Register the option in `BODY_SHAPES` and `ALL_SILHOUETTE_FEATURES` in [`js/se-gym-hero-avatar.js`](../../../js/se-gym-hero-avatar.js:~660).
- Update `BODY_RIG_FITS` so shared surfaces, chest details, arms, hand anchors, seams, legs, boots, and milestone shoes adapt with the frame. Never scale the outer `.se-gym-hero-svg`; that distorts the head and barbell.
- Update `BODY_ARM_MORPHOLOGY_STRENGTH` so the default limb volume matches the authored torso. Milestone strength is independent and adds to—never replaces—the body-frame baseline.
- Tag new shared body layers with the appropriate `data-hero-body-fit-target` (`surface`, `chest`, `arms`, `arm-seams`, `hands`, `lower-body`, or `milestone-shoes`). All fit transforms scale around the central x-axis and must preserve the shoulder, wrist, waist, and bar anchors.

The bruin mascot variant (`data-hero-kind-layer="bruin"`) is a parallel set of fur-and-muzzle paths that replace the human head, hands, and torso. It uses its own gradient (`bruin-fur-{{ hero_variant }}`). If you add a hero feature, you must usually also add a bruin equivalent (or explicitly opt it out of the bruin layer).

## Arm muscle tiers (milestone-driven)

The hero's arms are not one fixed shape — they interpolate between six authored silhouettes depending on milestone strength. The arm silhouettes use `data-hero-slot="muscle-strength"`; milestone power layers separately control the glow and boot plates.

```
none    — slim cylindrical sleeve   (shoulder width ≈ 18 px in viewBox units)
bronze  — toned, gentle bicep curve (shoulder width ≈ 24 px, peak ≈ 32 px)
silver  — athletic, clear bicep peak + deltoid groove (peak ≈ 46 px)
gold    — muscular, defined separation + rim light (peak ≈ 64 px)
diamond — bodybuilder, dramatic peak + dual specular sheens (peak ≈ 84 px)
infinity — maximum stylized strength with the richest form lighting
```

Each tier lives in its own `<g data-hero-slot="muscle-strength" data-hero-option="…" data-hero-muscle-zone="…">` block inside the four arm sub-groups:

- `data-hero-muscle-zone="left-upper"` — left shoulder / bicep / tricep
- `data-hero-muscle-zone="left-forearm"` — left forearm (rotates with elbow pivot)
- `data-hero-muscle-zone="right-upper"` — right shoulder / bicep / tricep (mirrored across x=400)
- `data-hero-muscle-zone="right-forearm"` — right forearm

Critical invariants the tiers must preserve:

1. **Shared pivots, dome-capped ends.** The shoulder rotation centre is `(322, 268)` for the left arm and `(478, 268)` for the right; the elbow centre is `(322, 162)` / `(478, 162)`. These are referenced in the parent `<g data-arm-side="…"><animateTransform>` and **must not shift between tiers** — otherwise the overhead-press animation jerks on every milestone swap. Each upper-arm silhouette ends in a **rounded dome wrapping the elbow pivot** (apex at `x=322/478`, `y≈152–154.5` by tier, horizontal tangent at the apex), and each forearm's base cap bulges to `y≈169–172` below the pivot — two round bone ends circling the same pivot stay joined at any rotation, so no separate joint patch is needed. **Never taper either segment to a point at the pivot**: a zero-width apex at `(322, 162)` produces the hourglass "balloon-animal" pinch that shipped before the July 2026 arm cleanup. Shoulder ends still start at exactly `(322 ± n, 268)` / `(478 ± n, 268)`.
2. **One continuous cubic-Bezier silhouette per tier.** No `L` commands. The lateral side (away from body centerline x=400) bulges more than the medial side — that's the asymmetric anatomy that makes muscles read as natural instead of tubular.
3. **Cel-shaded FILL plates, not strokes**, for primary form light/shadow. Strokes are reserved for specular sheens, deltoid grooves, brachialis lines, and rim lights. The shading reads as painted depth at any render size — including the 180 px customizer thumbnail and the 600 px hero.
4. **Specular sheen** is always a thin near-white stroke at low opacity (~0.3–0.6) placed on the bicep peak's brightest point. For `diamond`, layer two sheens (wide + narrow) for tighter catchlight.
5. **Rim light** (gold + diamond only) is a bright `--hero-suit-light` stroke along the lateral silhouette edge. This is what separates the arm from the cape behind it at higher tiers.
6. **Anatomy lines** (gold + diamond) are thin dark grooves at muscle-separation points: the deltoid-bicep junction and the brachialis edge below the bicep.
7. **The gold wristband cuff stays identical across all tiers** — it's a metal accessory that doesn't flex.

The six tiers all live in `_includes/se-gym-hero.svg` between the `data-hero-human-arms` opening `<g>` and the matching closing `</g>`. The animation `<animateTransform>` elements sit outside the muscle-tier blocks, at the `data-arm-side` level, so they're shared across tiers and never duplicated.

### Adding a new muscle tier

If you ever add a sixth tier:

1. Register the new option in `MILESTONE_TIERS` and `MILESTONE_TOKENS` in [`js/se-gym-hero-avatar.js`](../../../js/se-gym-hero-avatar.js:~1134).
2. Add a `<g data-hero-slot="milestone-power" data-hero-option="<new>" data-hero-muscle-zone="<zone>" display="none">` block in **all four** arm zones (`left-upper`, `left-forearm`, `right-upper`, `right-forearm`).
3. Match the pivot coordinates above. Bicep peak should sit at roughly `y=205–220` (slightly closer to the elbow than to the shoulder — anatomically the bicep belly peaks ~60% of the way down from the shoulder).
4. Keep the lateral peak farther from x=400 than the medial peak by at least 4 px (asymmetry).

### Editing existing muscle tiers

When tweaking an existing tier's silhouette, **keep the start points and the dome-cap convention unchanged**. The path should always start at `M <shoulder_x> 268` (where `shoulder_x` varies by tier — e.g. 313 for none, 299 for diamond on the left), and the elbow end must remain a rounded dome centred on the pivot (`(322, 162)` left / `(478, 162)` right) — the dome, not a point, is what keeps the joint covered during the press cycle. Verify any elbow edit at the press extreme (`svg.setCurrentTime(1.21)` — 56° forearm bend), not just at rest.

Three companion conventions from the July 2026 arm cleanup:

- **`arm-suit` is a `userSpaceOnUse` gradient** spanning wrist (`y=64`) to shoulder (`y=276`), shared by both segments. Bounding-box units gave the upper arm and forearm separate light-to-dark ramps that met at the elbow as a hard value seam. Don't convert it back, and don't fill arm parts with bbox-mapped gradients.
- **No elbow joint lens.** The forearm's own base arc reads as the elbow crease. The old `arm-joint` radial-gradient lens read as a doll-joint ball and was removed.
- **The deltoid overlap caps** (one per shoulder, after the tier groups) are filled with `url(#arm-suit-…)` so they extend the sleeve invisibly while masking the shoulder pivot. Don't give them their own gradient or rim stroke — that recreates the "balloon knot".

## Animation: the lift cycle and idle life

Three SVG `<animateTransform>` blocks drive the "lifting a barbell" feel:

- `data-hero-motion="cape-rock"` — the cape shares the body's `0 → +1.2 → 0` settle and rotates `−1.2° → +1.8° → −1.2°`, 2.2 s period.
- `data-hero-motion="body-lift"` — the body settles `0 → +1.2 → 0` instead of hovering, 2.2 s period.
- `data-hero-motion="barbell-lift"` — the barbell translates `−16 → +16 → −16`, 2.2 s period.
- The head adds a restrained `4.4s` settle. The eyes and eyelashes crossfade to authored closed-lid arcs rather than squashing irises into a line.

There are also several smaller `<animate>` / `<animateTransform>` blocks (chest-plate glow pulse, eye blink, ear wiggle on the bruin, topic-icon cross-fades on the plates).

These are coordinated and phase-locked. If you add a new motion, copy the existing pattern (`calcMode="spline" keySplines="0.5 0 0.4 1; 0.2 0.7 0.3 1"`, `keyTimes="0;0.55;1"`, `begin="0s"`) so the rhythm stays consistent. **Respect both motion controls:** `prefers-reduced-motion` and the visible “Pause Hero Motion” control pause every SVG timeline. Do not add CSS or JavaScript motion that bypasses either mechanism.

### Two rules that keep everything moving "in sync"

The whole rig must read as one coordinated organism — a viewer should never catch one part sliding on its own clock. Two failure modes break that, and both have shipped here:

1. **Every period must be a harmonic of the 2.2 s base** (2.2 / 4.4 / 6.6 / 13.2 …), with `begin="0s"`. A motion on an unrelated period — an eye-blink at `5.3s`, a flash at `3.4s` — *temporally drifts*: it lands at a different point in the breath every cycle, so the figure looks like a bag of independently-timed parts. The fix is not to remove the motion but to retune its `dur` to the nearest harmonic (the blink → `4.4s` = one blink per two breaths reads perfectly natural while staying phase-locked). After any animation edit, list every `dur=` (`grep -oE 'dur="[0-9.]+s"'`) and confirm they're *all* harmonics of the base.

2. **Don't give a sub-feature its own positional/scale breath that its siblings don't share.** The head, eyes, brows, nose, mouth, ears, and any glasses/accessory all ride the shared `body-lift` already, so they move together for free. A *differential* motion layered on one region — e.g. a `lower-face-breath-position` translate that nudges only the nose+mouth down, or a per-feature `nose-breath-scale` / `mouth-breath-scale` — makes that region drift relative to the eyes, and the face visibly "comes apart" at the bottom of the breath even though the timing is technically phase-locked. Let the face move as **one unit**: keep these differential transforms at identity (`values="0 0;0 0;0 0"` / `1 1;1 1;1 1`) unless you have a deliberate, character-appropriate reason (the bruin's ear-wiggle is an intentional flourish; an accidental lower-face slide is not). The cheapest way to catch this: freeze the SVG at `t=0` and at `t≈1.21s` (the breath extreme) with `setCurrentTime()` and confirm the *spacing between features* is unchanged — only the whole head should have translated.

## Verification checklist

After any avatar SVG change, before claiming done:

0. **Family check.** Does the hair have *both* a back_layer (halo behind head) and a front_layer (the main visible silhouette)? If only front exists, the design will read as "hair stuck on" rather than "hair growing from". The back-layer check is the cheapest possible polish upgrade — usually a single low-opacity path.
1. **Render the page.** Start the Jekyll dev server with the `preview_*` tools, navigate to `/se-gym/`, and look at the hero at the page's default size *and* at the customizer thumbnail size. A design that looks good at 600×620 but mushy at 180×190 is incomplete.
2. **Switch to dark mode.** The `--hero-*` color variables work in both modes by design, but if you've used a hardcoded hex, dark mode will reveal it. (Cross-reference the `light-dark-mode` skill.)
3. **Try at least three appearance combinations:** light skin + dark hair (the default), dark skin + light hair, dark skin + dark hair. The contrast logic in `avatarContrastTokens()` produces meaningfully different outlines in each case; make sure your design holds up.
4. **Toggle every milestone tier** (`bronze`, `silver`, `gold`, `diamond`, `infinity`) and confirm the hero still reads.
5. **Verify accessibility.** The avatar SVG is `aria-hidden="true"` so it doesn't appear in the accessibility tree, but if you've added any *text labels* (like the "SE" emblem at line ~604), they must satisfy WCAG 2.2 AA contrast. Cross-reference the `wcag-aa-compliance` skill.
6. **Walk the customizer.** Open the customizer panel and confirm your new option appears in the right preset group, the thumbnail renders correctly, and selecting it updates the main hero.

## When to ask for a reference image

If a user says "make the hair look like *this*", request the reference image and study it before writing a single path. Trying to draw "a tousled wispy fringe" from a verbal description has failed catastrophically every time it's been tried in this codebase. Insist on the photo.

Then, before you start, write down (in the chat or a scratch comment) what you actually see:

- How tall is the hair above the skull? (As a fraction of head height — e.g., "30%" or "50%".)
- Where's the parting? (Left, right, center, none.)
- Which direction does the fringe sweep? (Left-to-right, right-to-left, straight down.)
- How many distinct lock-tips are visible at the fringe edge?
- What's the hair color? (Note: this is set by `--hero-hair`, you don't draw it.)
- Are there any distinguishing features? (Cowlick, side flick, undercut, etc.)

That observation list is your blueprint. Refer back to it as you set every control point.

## Quick reference: the "good attempt" template

For copy-paste when starting a new short-hair option:

```svg
<g data-hero-slot="hair" data-hero-option="my-style" display="none">
  <!-- 1. Main silhouette: ONE complex path, smooth cubic Beziers only. -->
  <path d="M 348 176
           C 342 162 338 148 342 132
           C 346 118 352 110 360 104
           C 368 98 384 96 396 100
           C 408 96 422 100 432 112
           C 442 122 446 138 444 156
           C 442 168 440 172 438 172
           [embed your fringe wisps as a series of cubic Beziers here]
           C 348 178 346 176 348 176 Z"
        fill="url(#hair-grad-{{ hero_variant }})"
        stroke="var(--hero-hair-dark, #0f0905)"
        stroke-width="3.6"
        stroke-linejoin="round"
        stroke-linecap="round"/>
  <!-- 2. Mid-tone sweep shadow -->
  <path d="…" fill="var(--hero-hair, #1f140c)" opacity=".4"/>
  <!-- 3. Top-light highlight -->
  <path d="…" fill="var(--hero-hair-light, #4a3220)" opacity=".58"/>
  <!-- 4. Specular sheen -->
  <path d="…" stroke="#ffffff" stroke-width="2.8" fill="none"
        stroke-linecap="round" opacity=".5"/>
  <!-- 5. Flow / feathering -->
  <path d="…" stroke="var(--hero-hair-rim, #4a3220)" stroke-width="1.5"
        fill="none" stroke-linecap="round"
        opacity="var(--hero-hair-detail-opacity, .5)"/>
  <!-- 6. Optional crown cowlick -->
  <path d="…" fill="url(#hair-grad-{{ hero_variant }})"
        stroke="var(--hero-hair-dark, #0f0905)" stroke-width="2.2"/>
  <!-- 7. Always include the comic crown detail -->
  <use href="#comic-crown-hair-detail-{{ hero_variant }}"/>
</g>
```

Use this as a structural template; fill in the path data with cubic Beziers placed using the principles in this file.

## Related skills

- [`wcag-aa-compliance/SKILL.md`](../wcag-aa-compliance/SKILL.md) — Color contrast, focus indicators, motion preferences.
- [`light-dark-mode/SKILL.md`](../light-dark-mode/SKILL.md) — Dark-mode contract; `--hero-*` variables already work in both modes, but any hardcoded color you sneak in will not.
- [`maintainable-code/SKILL.md`](../maintainable-code/SKILL.md) — Names, abstractions, and the test for adding a new option. (When does it deserve a new `data-hero-slot` group vs. a parameter on an existing one?)
- [`diagrams/SKILL.md`](../diagrams/SKILL.md) and [`good-diagrams/SKILL.md`](../good-diagrams/SKILL.md) — These are *not* about avatar art, but the underlying SVG / path-drawing instincts overlap; if you find yourself reaching for ASCII art, you've gone off the rails.

## References

- **avataaars** (Pablo Stanley) — open-source SVG avatar system that established the "one complex path" convention for cartoon hair: <https://github.com/fangpenlin/avataaars>
- **Clip Studio Tips: Drawing Stylised Hair — Shapes, Tufts & Strands** (xz_art) — the three-method framework: <https://tips.clip-studio.com/en-us/articles/6072>
- **Clip Studio Tips: Simple Tricks for Drawing Hair Fast & Easy** (.avi.) — the "minimum / maximum volume" guideline and the "vary thickness" rule: <https://tips.clip-studio.com/en-us/articles/10785>
- **drawcartoonstyle.com: How to draw bangs** — the "clump don't space" cardinal rule and the outward-growth-direction stroke principle: <https://drawcartoonstyle.com/how-to-draw-bangs/>
- **Wacom Community: Etherington Bros Comics Crash Course #2 — Hair and Head Shapes** — the "shapes as compositional element" framing: <https://community.wacom.com/en-us/etherington-bros-comics-crash-course-2-hair-and-head-shapes/>
- **Domestika blog: Character Design Tutorial — How to Draw Comic-Style Female Hair** — the "wisps come from inking, not silhouette" insight: <https://www.domestika.org/en/blog/4953-character-design-tutorial-how-to-draw-comic-style-female-hair>
