# Avatar systems — parametrizable, themeable, multi-instance illustrations

A *single hero figure* is one piece of SVG with one customizer (see [comic-hero.md](./comic-hero.md)). An *avatar system* is a generator: a stable semantic API that produces many instances with different identity, theme, motion, and accessibility settings. The SE Gym hero customizer is one such system. So is DiceBear, Open Peeps, Humaaans, and any LMS profile-photo replacement.

This file describes the architecture that lets an avatar system stay coherent over years of design churn — when individual paths get redrawn but the same product code keeps working.

## The three-layer model

Avatar systems that survive a design overhaul separate three concerns. If any layer leaks into another, the system becomes brittle.

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Semantic descriptor                                      │
│    Product-facing data. Human readable.                     │
│    skinTone, hairTexture, expression, accessories…          │
├─────────────────────────────────────────────────────────────┤
│ 2. Rig                                                       │
│    Stable internal controls.                                 │
│    head_shape_id, hair_front_id, eye_spacing, brow_angle,   │
│    palette.skin.base, blink_weight…                          │
├─────────────────────────────────────────────────────────────┤
│ 3. Render                                                    │
│    Concrete SVG: symbol IDs, path data, CSS variables,       │
│    morph weights, display="none" toggles.                    │
└─────────────────────────────────────────────────────────────┘
```

Why three layers and not two?

- **Descriptor → render directly** couples product data to illustration details. When a designer renames a hair group from `bob-03` to `short-bob-v2`, every stored avatar breaks.
- **Descriptor → rig → render** lets the rig absorb illustration churn. The descriptor field `hair.baseStyle = "curly-bob"` stays stable. The rig maps it to whatever symbol IDs the current illustration uses.

The mapping descriptor → rig is what the *generator* does. The mapping rig → render is what the *renderer* does. They are different responsibilities.

## A descriptor schema you can copy

```json
{
  "id": "student-avatar-001",
  "version": "1.0",
  "seed": "c4c0c7d8-9fb2-4b63-a7b6-52cf8a50b6b6",
  "style": "soft-flat-bust",
  "identity": {
    "skinTone": "medium-warm-3",
    "faceShape": "oval-wide",
    "eyeShape": "almond",
    "eyeColor": "brown-700",
    "browStyle": "soft-arched",
    "noseStyle": "medium-rounded",
    "mouthStyle": "gentle-smile",
    "freckles": 0.25
  },
  "hair": {
    "baseStyle": "curly-bob",
    "frontLayer": "curl-fringe-02",
    "backLayer": "bob-03",
    "texture": "coily",
    "volume": 0.62,
    "length": "short",
    "color": "dark-brown-900"
  },
  "body": { "frame": "youth-neutral", "torsoType": "uniform-shirt" },
  "clothing": { "top": "hoodie", "topColor": "blue-600", "badge": "science-club" },
  "accessories": { "glasses": "round-thin", "headwear": null, "earwear": null },
  "expression": { "preset": "attentive", "blinkRateHz": 0.18, "gazeDirection": "center" },
  "motion": { "idlePreset": "breathe-blink-glance", "reducedMotionSafe": true },
  "a11y": {
    "role": "img",
    "title": "Student avatar",
    "desc": "Smiling student with curly short dark-brown hair, round glasses, blue hoodie."
  },
  "privacy": {
    "derivedFromPhoto": false,
    "requiresGuardianConsent": false,
    "biometricSourceRetained": false
  }
}
```

**Why group fields by function, not SVG layer.** `identity`, `hair`, `body`, `clothing`, `accessories`, `expression`, `motion`, `a11y`, `privacy` — these are the buckets a *product* thinks in. SVG-internal terms (path IDs, gradient offsets, clipPath references) belong in the rig layer, not the descriptor.

**Why include `seed`.** Deterministic regeneration. Two services rendering the same descriptor must produce the same SVG. A seed makes any procedural choice repeatable.

**Why include `version`.** Avatars persist for years; the schema will evolve. Migrations need a starting point.

**Why include `a11y` and `privacy` at the descriptor level.** These are *requirements*, not implementation details. They survive across renderers.

## The minimum field inventory

| Group | Required fields | Optional advanced fields |
|---|---|---|
| **Core identity** | `skinTone`, `faceShape`, `eyeShape`, `browStyle`, `noseStyle`, `mouthStyle` | `undertone`, `freckles`, `vitiligoPattern`, `dimples`, `scarTokens` |
| **Hair** | `baseStyle`, `texture`, `length`, `color` | `frontLayer`, `backLayer`, `volume`, `hairline`, `fadeType`, `highlightToken` |
| **Body** | `frame`, `torsoType` | `shoulderScale`, `neckLength`, `postureBias` |
| **Clothing** | `top`, `topColor` | `layer2`, `patternToken`, `uniformVariant`, `clubBadge` |
| **Accessories** | `glasses`, `headwear` | `assistiveDeviceToken`, `lanyard`, `pinSet` |
| **Behavior** | `expressionPreset`, `idlePreset` | `blinkRateHz`, `gazePattern`, `visemeMode` |
| **Accessibility** | `title`, `desc`, `decorative`, `reducedMotionSafe` | `contrastMode`, `fallbackIconStyle` |
| **Privacy** | `derivedFromPhoto`, `consentStatus` | `sourceDeletionAt`, `auditStamp`, `fairnessReviewId` |

Tailor to your product, but treat this as a baseline floor — most omissions become design debt later.

## The render pattern — `<symbol>` + `<use>` + CSS custom properties

The combination that makes an avatar renderable cheaply and recolorable per instance:

```svg
<svg viewBox="0 0 128 128" role="img" aria-labelledby="av-title av-desc"
     style="--skin: #c98a64; --hair: #3b2a20; --top: #2563eb; --blink: 1;">
  <title id="av-title">Student avatar</title>
  <desc id="av-desc">Student avatar with curly hair and hoodie.</desc>

  <defs>
    <symbol id="head-oval" viewBox="0 0 128 128">
      <ellipse cx="64" cy="54" rx="30" ry="36" fill="var(--skin)"/>
    </symbol>
    <symbol id="hair-curly-bob" viewBox="0 0 128 128">
      <path d="M30,54 C28,20 100,16 98,56 C92,36 36,36 30,54 Z" fill="var(--hair)"/>
    </symbol>
    <symbol id="eyes-almond" viewBox="0 0 128 128">
      <g opacity="var(--blink)">
        <ellipse cx="52" cy="56" rx="6" ry="3" fill="#111"/>
        <ellipse cx="76" cy="56" rx="6" ry="3" fill="#111"/>
      </g>
    </symbol>
    <symbol id="hoodie" viewBox="0 0 128 128">
      <path d="M28,106 C32,86 96,86 100,106 L100,128 L28,128 Z" fill="var(--top)"/>
    </symbol>
  </defs>

  <use href="#hoodie"/>
  <use href="#head-oval"/>
  <use href="#hair-curly-bob"/>
  <use href="#eyes-almond"/>
</svg>
```

Two properties of this pattern that matter:

1. **Each `<use>` instance inherits the inline `style` of its host SVG.** That's why per-instance `--skin`, `--hair`, `--top` works without re-emitting the symbol library. Two avatars on the same page with different palette tokens reuse the same `<defs>` and theme independently.

2. **`<symbol>` defines reusable graphical templates that don't render directly.** They render only via `<use>`. That means you can ship a single sprite library and `<use>` it from many `<svg>` instances — or inline the whole library into one `<svg>` per avatar and let the SVG be self-contained. Both work.

## Deterministic seeded generation

Random avatars must regenerate identically given the same seed. A weak generator stores the *output* (the descriptor JSON). A strong one stores only the *seed* and re-derives the descriptor every time.

```js
function seededDescriptor(seed) {
  const rng = mulberry32(hashSeed(seed));
  return {
    seed,
    style: 'soft-flat-bust',
    identity: {
      skinTone: pick(rng, SKIN_TONES, weighted_by_inclusion),
      faceShape: pick(rng, FACE_SHAPES),
      eyeShape: pick(rng, EYE_SHAPES),
      // …
    },
    hair: pickFromFamily(rng, 'curly') ? CURLY_BOB : STRAIGHT_BANG,
    // …
  };
}
```

Three rules for seeded generation:

- **`pick()` must be a pure function of the rng state.** Never read system time, page URL, or session data inside the generation pipeline — that breaks reproducibility.
- **Use a real PRNG (mulberry32, xorshift, splitmix64), not `Math.random()`.** `Math.random()` is not seedable in any standard way; you cannot regenerate the same output across machines.
- **Don't store the seed as the primary key.** Store the descriptor too. If you change the generation rules, the seed produces a *different* descriptor; you want stored avatars to survive rule changes.

## Variation layers — what changes, separately

Variation in an avatar system comes in four orthogonal layers. Mixing them up is the most common cause of unmaintainable customizers.

| Layer | What it varies | How it's expressed in SVG |
|---|---|---|
| **Paint** | Skin tone, hair color, clothing color, accessory color | CSS custom properties, palette tokens |
| **Surface** | Freckles, fabric pattern, subtle skin texture, fade in hair | `<pattern>` tiles, mild `<feTurbulence>`, masked overlays |
| **Shape** | Face proportions, hair silhouette, eye form, mouth/nose family | Pre-authored `<symbol>` variants, `display="none"` toggles |
| **Motion** | Blink rate, idle energy, gaze pattern | Animation presets — `<animateTransform>` parameters or CSS class |

If a team finds themselves encoding everything as path swaps (shape layer) or everything as color tokens (paint layer), the system is collapsing. Each variation type has a natural home in one of the four layers; respect that and the customizer stays sane.

### Family-based shape generation

Procedural shape variation in SVG should **select from authored primitives**, not synthesize splines from scratch. A "procedural hair" system that tries to draw individual strands ends up with thousands of paths, aliasing, and zero art direction. A practical hair model:

```
hair_style := family + length + front_layer + back_layer + volume + curl_bias

family    ∈ {straight, wavy, curly, coily, locs, braids, fade, shaved, covered}
length    ∈ {pixie, short, shoulder, long}
volume    ∈ [0, 1]                   ← path control-point offsets
curl_bias ∈ [0, 1]                   ← alternate contour templates
```

The illustration team authors *templates* per family + length combination. The generator picks a template and applies `volume` / `curl_bias` as multipliers on control-point offsets. The system is procedural in the *selection and deformation* sense — not in the wild-synthesis sense. That keeps things art-directable and culturally controllable.

## Animating rig variables, not raw paths

Animation on an avatar system should target *rig controls*, not arbitrary path attributes. If your animation code reaches into the descendant DOM and rewrites `<path d="…">` strings, you've created a system that breaks every time an illustrator redraws the path.

The right pattern:

```js
// Animate the rig variable, not the path.
avatar.style.setProperty('--blink', 0);                       // closed
setTimeout(() => avatar.style.setProperty('--blink', 1), 80); // open
```

In the SVG, `--blink` is wired to `opacity` (or `transform: scaleY(…)`) on the appropriate group. The animation code never touches the path. When the illustrator changes the eye shape, the animation still works.

For more on this principle — *rig animation vs attribute animation vs topology animation* — see [`../animations/path-morphing.md`](../animations/path-morphing.md).

## Complexity tiers

The same descriptor should be renderable at multiple complexity levels. Most products eventually need this — tiny avatars in a roster, standard avatars in a dashboard, rich avatars on a profile page.

| Tier | When to use | Visual budget | Animation budget |
|---|---|---|---|
| **Tiny / iconographic** | Roster cells (24–48 px), reduced-motion mode, monochrome UIs, badges, placeholders | Solid fills, no gradients, no filters | None |
| **Standard / soft-flat** | Dashboards, identity chips, classroom views (64–256 px) | Flat fills + restrained gradients, layered shapes | Idle transform + opacity animations |
| **Rich** | Profile page (256 px+), hero illustration | Multi-stop gradients, masks, subtle drop-shadow filter, full inking layer | Compound idle motion, expression presets, optional matched-topology morphs |

The descriptor doesn't change between tiers — the renderer does. A `tiny` renderer drops detail by ignoring secondary `<use>` references; a `rich` renderer engages the comic-illustration stack (back-fill → silhouette → mid-tone → highlight → inking → micro-detail per [`comic-hero.md`](./comic-hero.md)).

## Representation and bias — author the option space deliberately

A customizer system's *defaults* and *available options* encode an editorial position. Narrow defaults (one skin tone, three hairstyles, no head coverings, no assistive devices) silently exclude users. Bias also enters through upstream tooling: photo-fitting algorithms, attribute inference, latent-space sampling, demographic-imbalanced training sets.

Practical rules for an inclusive option space:

- **Skin tones:** at least 10 evenly-spaced tones across the full Fitzpatrick range, with explicit warm/cool/neutral undertone variants.
- **Hair textures:** straight, wavy, curly, coily, locs, braids, fade, shaved, *and* covered (hijab, durag, kufi, kerchief, religious head coverings).
- **Accessories:** glasses, hearing aids, cochlear implants, eye patches, mobility aids visible at portrait scale.
- **Body proportions:** vary frame size, not just height. Avoid "default = thin" assumptions.
- **Cultural motifs:** clothing patterns and accessory motifs are *selectable*, not *defaulted from demographic guess*. Don't bind a hairstyle to a skin tone in the generator rules.
- **Gender:** don't force a binary toggle. Provide neutral defaults; let users mix from any pool.
- **Avoid status hierarchies in defaults.** Tier-locked or "premium" features around appearance can create exclusion dynamics, especially in education contexts where avatars become identity markers.

Test outputs with culturally diverse reviewers before release. Automated tests can verify the option space is *available*; only humans can verify the option space is *respectful*.

## Privacy and student data

If your avatar system is used in an educational setting and integrates real student information, additional constraints apply:

- **Prefer non-biometric descriptors over stored face embeddings.** A descriptor like "almond eyes, warm-medium skin, curly hair" is not biometric. A learned face embedding is.
- **If you offer photo-assisted personalization** (a student uploads a photo and the system fits an avatar), process the photo ephemerally, do not retain it unless explicitly authorized, and frame the feature as *assistive editing* not *automatic identity inference*.
- **Age-appropriate everything.** Body proportions, poses, clothing options. Educational avatars are not adult avatars.
- **Consent paths.** COPPA (US, under 13), FERPA (US, student records), the EU GDPR / DSAR / age-of-consent thresholds, the UK Children's Code, and UNICEF's AI-for-children guidance all apply when student data crosses into avatar generation. Privacy review should sit *inside* the asset pipeline, not after it.

The safe default for student-facing avatar systems: **let users author options explicitly, fit conservatively from inputs, never infer sensitive traits when the user can choose them directly**.

## Validation matrix for an avatar system

| Area | What to test | Tools / method |
|---|---|---|
| Visual regression | 100–500 seeded outputs per style tier, all themes | Playwright screenshots, Storybook/Chromatic |
| Animation QA | Keyframes, reduced-motion mode, cross-browser parity | Playwright across Chromium/Firefox/WebKit |
| Accessibility | `role`, `title`, `desc`, decorative vs informative, contrast, reduced motion | axe-core, Lighthouse, manual screen reader |
| Fairness / inclusion | Coverage of skin/hair/accessory/body option space, demographic review of defaults | Human review + audit samples |
| Privacy | Data retention, consent logs, source-photo deletion behavior | Privacy review + legal checklist |
| Cultural | Clothing, hairstyles, symbols, accessory motifs | Diverse human reviewers |
| Determinism | Same seed → same output, across machines and process boundaries | Property-based tests over seed space |
| ID collision | Multi-instance pages don't share gradient/clip IDs | Snapshot test of two instances on one page |

## See also

- [comic-hero.md](./comic-hero.md) — the rendering technique an avatar system's "rich" tier uses
- [style-families.md](./style-families.md) — picking a visual style (flat / soft-flat / semi-realistic / isometric / iconographic) before committing to a customizer
- [primitive-characters.md](./primitive-characters.md) — geometric mascots, the simplest end of the style continuum
- [../animations/idle-cycles.md](../animations/idle-cycles.md) — idle motion presets (breath, blink, sway)
- [../animations/path-morphing.md](../animations/path-morphing.md) — when expression presets need real shape change
- [../animations/reduced-motion.md](../animations/reduced-motion.md) — required gating for any idle motion
