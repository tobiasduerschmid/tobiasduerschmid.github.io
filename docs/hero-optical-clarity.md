# SE Gym hero clarity at small sizes

The shared hero must remain legible in song ensembles, student portraits,
customizer previews, and the full Gym rendering. SVG preserves scalable geometry;
it does not guarantee that fine features survive rasterization at the final size.
This document records design reasoning and a review procedure, not a certification
that every possible appearance combination has been checked.

## Evidence and its limits

- **Optical weight depends on display size.** Google's Material Symbols adjusts
  stroke weight with optical size to preserve apparent weight. Apply that principle
  selectively to facial edges; its icon axes are not an avatar-specific formula.
  [Material Symbols guide](https://developers.google.com/fonts/docs/material_symbols)
- **Essential forms need room.** IBM recommends spacing between icon elements,
  fine-tuning geometry, and reducing details that fail when scaled down. Preserve
  brow–lid separation and the eye aperture before adding texture. IBM's exact grid,
  stroke sizes, and flat perspective are brand conventions, not requirements here.
  [UI icon design](https://www.ibm.com/design/language/iconography/ui-icons/design/),
  [pictogram design](https://www.ibm.com/design/language/iconography/pictograms/design/)
- **Thin shapes can fade despite sufficient declared contrast.** W3C notes that
  antialiasing can make a thin feature much fainter than its CSS color. Inspect the
  composited result as well as token contrast. The 3:1 criterion concerns visual
  information needed to understand content, not every decorative facial plane.
  [Non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- **Expression is not microtexture.** Du and Martinez found that recognition of
  photographed expressions remained relatively stable across several reductions,
  with different confusion patterns for different emotions. Their study used 34
  participants, grayscale photos, upscaled stimuli, and a controlled visual angle;
  its 20×30-pixel result is not a minimum UI face size. The design inference is to
  protect coherent mouth, eye, and brow relationships before decorative detail.
  [The resolution of facial expressions of emotion](https://pmc.ncbi.nlm.nih.gov/articles/PMC3702732/)
- **A rendering hint is not a sharpening filter.** SVG `crispEdges` may disable
  antialiasing or snap geometry. Keep smooth curves for faces; neither `auto` nor
  `geometricPrecision` promises identical pixels across browsers. Avoid snapping
  animated features to pixels, which can introduce visible stepping.
  [SVG 2 rendering hints](https://www.w3.org/TR/SVG2/painting.html#ShapeRenderingProperty)

## Shared artwork constraints

Keep the existing soft-flat style and independent appearance choices. Improve the
shared SVG and palette computation where the concern belongs; avoid duplicating
the same corrective paths in each song. Static presentation belongs in CSS modules;
JavaScript supplies appearance-dependent tokens and pose state.

Use a deliberate hierarchy: eye aperture and upper lid, eyebrow silhouette, and
mouth seam carry expression. Nose wings, lower-lid reflections, ear folds, iris
texture, and hair strands support those features without competing with them.
Keep secondary edges short and restrained. Do not outline every crease with the
bright face-accent token or reintroduce ring-like nostril contours.

Clear glasses should preserve the pupil, iris, and sclera beneath them. A broad
opaque lens tint or reflection can veil the entire eye even when the frame has
excellent contrast. Keep material cues localized and compare the eyes with and
without the clear lens on light and deep skin. Intentionally tinted or opaque
eyewear remains a separate visual choice.

Preserve fitting transforms, clipped eyes, private definition IDs, and the shared
head-turn API. A detail should not float outside its own surface during a turn,
blink, or expression. Do not add animation clocks or bypass pause/reduced motion.

## Review procedure

1. Capture a deterministic before/after pair with identical appearance, pose,
   timeline, viewport, and browser. Judge each at its actual CSS size first.
2. Inspect head heights around 40, 64, 96, and 160 CSS pixels, plus the large Gym
   portrait. These are review samples, not promised readability thresholds. Check
   device scale factors 1 and 2; use enlarged crops only to diagnose geometry.
3. Cover light, medium, and deep skin; light, dark, and vivid hair; narrow and round
   eyes; different nose/lip shapes; glasses, facial hair, and head coverings. Include
   Prof and Bruin where a shared rule reaches them. Keep user-selected traits intact.
4. Inspect neutral, joy, anger, concern, open singing mouths, and blinks at left,
   center, and right turns, including intermediate and reverse seeks. Confirm that
   listening faces remain relaxed and expression boundaries do not pop or detach.
5. Review the actual song ensemble, a student portrait, Gym hero, and customizer
   preview in both page themes. Context changes perceived weight and contrast;
   an isolated face crop cannot prove scene legibility. Check print behavior where
   the changed consumer includes the hero in print.
6. Pair visual review with focused behavioral tests: visible feature separation,
   composited pixels, clipping/attachment, customization, and deterministic poses.
   Use semantic regions with tolerance for antialiasing, not exact whole-image
   hashes. Exercise Chromium, Firefox, and WebKit for shared paint changes.
7. Report the configurations, consumers, and checks actually reviewed. A green
   geometry or contrast test does not establish flawless anatomy, emotion, or all
   accessibility criteria. Keep scratch galleries and screenshots out of commits.
