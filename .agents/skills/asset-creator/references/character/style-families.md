# Style families — picking a visual language before you draw

A character or scene illustration belongs to one of five style families. The choice determines the entire parameter surface — what's easy to vary, what's expensive to animate, how big the customizer can grow, and whether the illustration scales down to a 24 px chip without falling apart.

This file is the editorial reference for that choice. Pick the family *before* opening the SVG, not while you're already drawing — the layering, palette structure, and animation budget all flip depending on which family you commit to.

## The five families

| Family | SVG primitives | Best for | Strengths | Costs |
|---|---|---|---|---|
| **Flat** | Solid fills, limited strokes, simple shape layering | Roster portraits, identity chips, dashboards, customizers with broad demographic variation | Easiest to parametrize, animate, recolor, theme, compress | Can feel generic if silhouette language is weak |
| **Soft-flat** | Flat base + restrained gradients, shadow plates, shape overlap with masks | Primary custom avatars, friendly product mascots, illustrations that need warmth without complexity | Better emotional richness without abandoning vector efficiency | Needs authoring discipline; muddy if shading is sloppy |
| **Semi-realistic** | Multi-stop gradients, subtle blur, highlight masks, anatomical linework | Profile-page heroes, marketing pages, "premium" feel | Bespoke, expressive, signature visual | Harder to keep consistent across demographic variation; expensive at small sizes |
| **Isometric** | Axonometric projection, body rotations implied by 30°/120°/210°/300° plane logic | Learning scenes, dashboards, "journey" illustrations, team overviews | Strong for contextual storytelling | Identity at small size is weak; facial animation is awkward |
| **Iconographic** | Simplified head/shoulders glyphs, strokes or fills, very few details | Tiny avatars, reduced-motion mode, monochrome UIs, badges, placeholders | Maximum legibility, smallest payload, consistent UI fit | Lowest personal expression |

## The default recommendation: **soft-flat primary + iconographic fallback**

For a character system that needs to work across roster cells, dashboards, and profile pages, the highest-leverage architecture is:

- **Primary renderer: soft-flat.** Torso-up bust portrait. Layered fills with one or two gradient passes (skin, hair). Inking on top. Compound idle motion.
- **Mandatory fallback: iconographic.** Same descriptor, simplified renderer. Used when (a) the avatar appears below ~48 px, (b) the user has `prefers-reduced-motion: reduce`, (c) the render context is monochrome, or (d) the payload budget is tight.
- **Optional: isometric.** Same palette and clothing motifs, but a separate scene-character renderer. Used for "learning journey" illustrations where the body is in a pose, not a portrait.

The descriptor is shared across all three renderers; the geometry isn't. See [`avatar-system.md`](./avatar-system.md) for the descriptor architecture.

## When each family is the *wrong* choice

| Family | Avoid when… |
|---|---|
| **Flat** | The product needs emotional warmth and you've been told the avatars feel "corporate" or "generic" — switch to soft-flat. |
| **Soft-flat** | You're rendering below ~48 px — gradients become invisible noise; switch to flat or iconographic. |
| **Semi-realistic** | You need wide demographic variation — consistency across skin tones / hair textures / facial features is much harder when every avatar needs anatomically-tuned shading. |
| **Semi-realistic** | The asset will be themed across many color modes — heavy gradients fight CSS theming. |
| **Isometric** | The avatar must convey identity at portrait scale — isometric heads are tilted/projected and read poorly small. |
| **Isometric** | You need facial animation — lip sync, expression presets, and gaze shifts are awkward when the head is on a 30° tilt. |
| **Iconographic** | The avatar is the *primary* identity surface (profile page) — too austere. Use as a fallback layer, not the headline. |

## Style → animation budget

Style choice constrains what's affordable to animate.

| Family | Idle motion budget | Expression budget | Compound motion |
|---|---|---|---|
| **Flat** | Generous — transforms and opacity are cheap on flat fills | Generous — discrete frame swaps work well | Generous |
| **Soft-flat** | Generous, with care for gradient overlap during transforms | Generous, but gradients should travel with their shapes | Generous |
| **Semi-realistic** | Restrained — `feGaussianBlur` filters are expensive to recompute on transform | Restrained — gradient/mask state must follow morphs | Limited; pick one or two channels |
| **Isometric** | Restrained — translating body parts breaks projection illusion if not done in plane-coherent directions | Very limited — face is projected, not face-on | Restrained |
| **Iconographic** | None or minimal — typically a static fallback | None | None |

## Style → parametrization surface

What kinds of fields the descriptor must expose depends on the style.

| Family | Required descriptor fields | What scales smoothly |
|---|---|---|
| **Flat** | Categorical switches (`hairStyle`, `glassesStyle`) + paint tokens (`skinTone`, `hairColor`, `topColor`) | Adding more categorical variants |
| **Soft-flat** | Above + shading tokens (`shadowOffset`, `highlightStrength`, `gradientWarmth`) | Adding more gradient passes per shape |
| **Semi-realistic** | Above + anatomical controls (`browDepth`, `cheekFullness`, `noseProminence`) + continuous shading | Tuning anatomy, less smooth across demographics |
| **Isometric** | Above + pose controls (`bodyRotation`, `armPose`, `legPose`, `propsHeld`) | Adding new poses |
| **Iconographic** | Categorical only (`headStyle`, `expressionToken`) — paint optional | Adding more discrete tokens; doesn't degrade with style scaling |

**Don't mix styles within one figure.** A soft-flat torso with semi-realistic eyes looks broken — the rendering language disagrees with itself.

## Choosing a family — the decision flow

```
What's the primary use case?
│
├─ Roster cells / small UI / monochrome contexts
│  └─ Iconographic.
│
├─ Profile page / hero / marketing-only context
│  ├─ Need broad demographic variation? → Soft-flat
│  └─ One-off bespoke hero? → Semi-realistic
│
├─ Scene illustration / dashboard / journey diagram
│  └─ Isometric. (And probably also a separate portrait renderer.)
│
└─ Default identity / customizer-driven avatar
   └─ Soft-flat.  ←  the highest-leverage default
      (Add iconographic as a mandatory fallback.)
```

## Style → palette structure

| Family | Stops per gradient | Highlight pass | Shadow pass | Inking |
|---|---|---|---|---|
| **Flat** | 1 (solid fill) | — | — | Optional, single weight |
| **Soft-flat** | 2–3 | One soft gradient overlay at low opacity | One soft gradient overlay at low opacity | Multi-pass with varied widths |
| **Semi-realistic** | 4 | Highlight gradient + secondary specular | Shadow gradient + ambient occlusion plate | Multi-pass with varied widths and `opacity` |
| **Isometric** | 1–2 (flat planes, one per face direction) | Implied by plane lightness, no overlay | Implied by plane darkness | Single weight, often at the silhouette only |
| **Iconographic** | 1 (or `currentColor`) | — | — | Single uniform stroke |

For the soft-flat default, the gradient stops follow the 4-stop comic recipe (highlight → light → mid → shadow) from [`comic-hero.md`](./comic-hero.md).

## Cross-family palette tokens

If you support multiple renderers, the *same* palette tokens drive all of them. The iconographic renderer collapses `--skin-highlight`, `--skin-light`, `--skin-mid`, `--skin-shadow` into a single `currentColor`; the soft-flat renderer uses all four. The semi-realistic renderer adds a fifth `--skin-ambient` plate. The descriptor never sees these differences — it just says `skinTone: "medium-warm-3"` and the renderer maps that token to whichever palette structure it needs.

## Brand consistency across families

When a product ships two renderers (e.g. soft-flat avatars + isometric scene characters), the families look related when they share:

- **Palette tokens.** Same skin / hair / clothing colors, just expressed in different paint structures.
- **Clothing motifs.** A "science-club hoodie" should be recognizable in both an isometric scene and a soft-flat portrait.
- **Facial proportions.** Eyes / nose / mouth relative spacing stays consistent; the projection differs.
- **Motion vocabulary.** Same idle cycles (breath, blink, sway), tuned per family.

They look broken when they share:

- **Topology.** A semi-realistic face mesh can't be retopologized into a flat one; don't try.
- **Linework weight.** Each family has its own ink discipline; mixing weights reads as "the illustrations were done by different people."

## Common pitfalls

| Symptom | Likely cause | Fix |
|---|---|---|
| Avatar looks "generic" / "corporate" | Pure flat without silhouette signature | Switch to soft-flat *or* invest in stronger silhouette language (more distinctive hair / glasses / clothing) |
| Avatar feels muddy / 3D-rendered | Too many shading passes for the chosen family | Cut down to the stop count appropriate for the family |
| Tiny avatars in a roster are unreadable | Standard renderer used at every size | Add an iconographic fallback below ~48 px |
| Customizer combinatorics exploded | Trying to do semi-realistic for an avatar system | Move to soft-flat; semi-realistic doesn't scale across demographics |
| Isometric character animations feel off | Face animation attempted on a projected head | Don't animate isometric faces; use isometric for body poses only, switch to portrait renderer for emotion |
| Two renderers look "by different people" | Linework / palette structure unshared across families | Share palette tokens and clothing motifs; accept that topology differs |
| Theme swap looks broken in dark mode | Hard-coded hex values rather than CSS variables in the renderer | Replace literals with `var(--…)` (see [light-dark-mode](../../light-dark-mode/SKILL.md) project rule) |

## See also

- [comic-hero.md](./comic-hero.md) — the comic-illustration layering technique (which is *how soft-flat and semi-realistic are rendered*)
- [primitive-characters.md](./primitive-characters.md) — the geometric-mascot end of the continuum
- [avatar-system.md](./avatar-system.md) — making the style choice part of a parametrizable system
- [../animations/idle-cycles.md](../animations/idle-cycles.md) — animation budget by family
