# SE Gym avatar artifact audit

The reported cheek blotch was the optional birthmark rendered as a large, high-contrast scalloped shape. It now uses a smaller, continuous contour and a translucent skin-shadow color. The default remains “None”; skin variation is an explicit personal choice. The correction was checked across all 15 preset skin tones, alongside clean faces and vitiligo.

## Configuration review

Three parallel audits reviewed the actual SVG with the production renderer, supported by a separate skin-tone and head/hair matrix. These are systematic samples, not an exhaustive cross-product of all possible avatars.

| Area | Coverage |
| --- | --- |
| Hair | All 86 hairstyles in 516 configurations: three skin/hair contrasts, rotating head shapes, default settings and opposing head/hair limits. |
| Face | 805 portraits covering every head, eye, nose, mouth, facial-hair and facial-detail option; every eye/lash pair; representative facial-hair/mouth pairs and combined control limits. |
| Accessories and clothing | 304 configurations covering all accessory, body and outfit options plus proportion limits. Follow-up checks cover all four opaque hats and seven ear-mounted device/jewelry options. |
| Skin details and crown fitting | 81 configurations: all 15 skin tones with three facial-detail settings, plus six heads crossed with six representative hairstyles at opposing limits. |

The visual pass included light and dark backgrounds and light-skin/dark-hair, deep-skin/light-hair, and deep-skin/dark-hair contrasts. Corrections were rendered again in the affected families.

## Corrected defects

- Removed the shared forehead arc that appeared as a stray hairline on bald faces.
- Made head proportions carry the complete head assembly, with the neck extending behind the jaw. Body-mounted accessories retain their body position.
- Fitted ears to the actual cheek contour; ear devices and jewelry follow the resulting ear placement and ear adjustments.
- Anchored eyelashes to the selected eyes. Lash controls reshape the fan without moving its roots away from the eyelids.
- Kept complete mouths within the selected jaw at control limits, rather than hiding overflow by cutting off the lips.
- Replaced floating braid texture, detached ponytail highlights, self-intersecting lower hair shapes and abrupt mask-cut ends with contained, tapered contours.
- Corrected translucent or low scalp caps and fitted full-coverage hairstyles to the crown at reduced hair dimensions.
- Joined headphone/headset bands to their earpieces and refined hat and headband contours. Each opaque hat has its own hair envelope, which follows the hat when hair and accessory adjustments differ. Independent hair, foreground and root frames preserve their existing face and shoulder boundaries.
- Bridged narrow shoulders to raised sleeves and placed belt hardware over the selected clothing.

## Follow-up silhouette and material polish

A further pass refines eight long or parted crowns (`long-straight`, `long-center-part`, `straight-long-layers`, `center-part`, `long-layers`, `loose-waves`, `butterfly-layers`, `side-part-lob`) and six curl or puff styles (`curly-bob`, `rounded-curls`, `voluminous-curls`, `curly-layers`, `coily-puff`, `double-puffs`). The crowns have more compact, parted silhouettes; curl contours use varied clumps, and the puffs have irregular coily edges. Existing rear hair geometry remains intact. The eight new crown clips live in the rear layers, so foreground cloning does not duplicate their IDs.

Decorative hair light and sheen now blend toward the selected hair color, reducing pale patches on dark hair while preserving the contrast tokens used by outlines and facial features. The `soft-smile`, `small-smile` and `neutral` expressions gain a thin contrast-aware seam and a restrained lower-lip plane so they remain visible on deep skin.

The follow-up review includes:

- 576 before/after crown renderings across three contrasts, both themes, narrow/broad heads and opposing adjustments; 40 full figures cover all five milestones.
- 696 crown/head/adjustment configurations with painted coverage checks. These caught a small scalp sliver at the side-parted lob's high part under an extreme adjustment; lowering the part closed it. The final sweep found no sampled exposed scalp, eye/chin/neck overlaps or duplicate IDs.
- 105 curl configurations at portrait and 72-pixel thumbnail sizes, including an unchanged wavy control.
- 126 combined-source color and hat configurations, covering silver, white and vivid colors in dark mode, plus a final side-part boundary check.
- 1,728 mouth configurations across all 18 expressions, three contrasts, four heads and eight independent adjustment boundaries, with no missing, escaping or clipped mouth paint. The three revised expressions were also inspected at native 180- and 600-pixel sizes.
- 90 milestone/time/head/contrast samples at 180 pixels and 18 Infinity examples at 600 pixels. Facial centers remain fixed in head coordinates at animation times 0, 1.21 and 2.2 seconds.

These matrices are targeted regression and visual samples, not every possible combination. Saved option values and the interaction model remain stable; the corrections improve artwork, paint order and proportion fitting.

## Final garment, facial-hair and device audit

The completion review found several additional material and attachment defects:

- Super-suit panel seams previously painted through casual clothes. Their existing paths now belong to the selected super-suit; only diffuse torso light remains shared.
- Full-top garments previously tinted the exposed lower neck. Moving the unchanged neck group above garment paint preserves its selected skin color. All 22 outfits were inspected across three body frames and two contrasting palette/theme pairs: 132 configurations at native 180- and 600-pixel sizes.
- Four small chin-hair styles had long pointed ends that resembled pendants. Shorter curved patches now fit between the complete mouth and the actual jaw. Sideburns now begin at the temples and taper naturally. Eight mustache subgroups follow the upper lip independently of their surrounding beard or chin patch.
- Head-specific cheek shading previously overlaid opaque beard paint as hard ovals. Its unchanged layer now paints beneath facial hair, retaining the same head coordinate frame.
- Wired earbuds now include two smooth cables, attached to fitted buds and the selected neckline. The independent sweep checked 765 configurations at three animation times, covering all head, ear, body and outfit options and each attachment-control boundary; no sampled endpoint was disconnected.
- The Bruin's nose and smile previously inherited pale fur-outline ink over a light muzzle on three fur presets. Muzzle-relative ink restores their contrast while retaining the outer fur outline. Rendered contrast is checked across all five fur presets and black/white custom-color endpoints.

The independent accessory/mascot review included 225 valid configurations at native 180- and 600-pixel sizes: all 54 non-empty accessories across three contrasts, six compatible accessory stacks across three contrasts, and Bruin milestone/animation examples. Facial-hair review covered all 17 styles, with targeted before/after and opposing-adjustment sheets for the revised chin patches, sideburns and mustaches. These counts describe targeted samples, not an exhaustive cross-product.

The preview build also exposed a detached-SVG measurement failure in the new group fitting. Detached and hidden templates now receive temporary layout before measurement and return to their original owner, size and visibility afterward. All 353 previews generate successfully with the corrected renderer.

## Regression contracts

`tests/se-gym-hero-artifacts.spec.js` checks rendered paint rather than exact path strings or fixed screenshots. The original nine tests cover 2,531 configurations:

- Neck/head overlap: 261 configurations.
- Ear/head overlap: 348 head/ear combinations and 27 ear-control configurations.
- Mouth and nose containment under head adjustments: 270 and 360 configurations.
- Eye/lash attachment: 612 configurations.
- Complete-mouth containment under independent mouth adjustments: 576 configurations.
- Opaque crown coverage: 32 configurations.
- Body-accessory placement under head adjustments: 45 configurations.

The final artifact suite also checks 1,080 chin-patch configurations, 2,160 mustache configurations, 12 detached/hidden template comparisons, 11 earbud attachment boundaries and seven Bruin fur colors. A final cheek/beard overlap case verifies that changing skin-tint paint cannot alter opaque beard interiors; exposing those same pixels without facial hair provides a positive control. The resulting 15 artifact tests cover 5,802 configuration samples. The template checks compare actual raster paint, preserve ownership and hidden state, and require the temporary measurement host to be removed. A separate lifecycle sweep covered 108 configurations through 324 human→Bruin→human transitions, including hidden ancestors, hidden roots and zero-sized roots; every revealed image matched a freshly mounted reference.

`tests/se-gym-hero-clothing-paint.spec.js` checks 48 browser-rendered neck samples across four collar families, three body frames, two skin tones and two garment palettes. Clothing colors must not change exposed skin paint; changing skin color is the positive control.

Scratch negative controls reject disabled chin/mustache fitting, missing earbud cables, the former Bruin ink, the former garment/neck ordering, and the former cheek/beard ordering. They leave production source untouched.

The complete-mouth test compares the visible paint with the same mouth rendered without ancestor clipping, preserving authored internal tooth clips. This detects a clipped-off smile as well as paint outside the jaw. Crown coverage counts opaque material; translucent shading cannot satisfy the test. Attachment tests require actual painted overlap or connected components within a small antialiasing allowance.

`tests/se-gym-hero-hat-fit.spec.js` adds four tests across 72 configurations: four hats, three hairstyles, three head shapes and two opposing adjustment limits. It compares the actual hair paint with the available hair intersected by the hat's cut region in a common portrait frame. Both missing and protruding hair are failures. Face and shoulder boundaries remain in the hair frame. The visual follow-up additionally includes bald heads, for 96 hat configurations.

All four hat tests reject a scratch version with alignment disabled: the old behavior produces missing hair at the baseball/prayer-cap rims and protruding hair at the beanie/bucket-hat rims. The production source is not modified by that mutation check.

Three older hair tests now measure painted coverage in the selected head's coordinate frame instead of relying on bounding boxes or applying an accessory fit twice. A gathered side ponytail is checked as an asymmetric style. Deliberately removing side-panel/headband paint or opening a central scalp gap makes these tests fail. The soft-face-light test rejects shared forehead strokes while preserving the intended quiet jaw highlight, instead of requiring an exact count of paths.

The actual customizer was also checked with its static thumbnail manifest disabled. Soul patch, light goatee, goatee, rounded goatee, full beard and wired earbuds all retained their complete selected paint after live-template pruning, matching an unpruned rendering of the same representative state. The native cards showed the details, with no console errors or invalid geometry.

The existing customizer suite continues to cover selection, saving, reload, randomization, import/export, fine-tuning, SVG reference isolation, accessible controls and the complete hairstyle registry. `tests/se-gym-hero-art-quality.spec.js` additionally checks face lighting, skin-detail clipping, eye catchlights and live thumbnail rendering. Run these alongside the scoped WCAG light/dark and print audits.

All 353 generated choice previews parse as SVG, contain no forbidden raster/filter elements, have unique IDs within each image and resolve every local reference. The September 2026 audit preserved the complete option registry. The scoped SE Gym accessibility runs reported no findings in light, dark, mobile and print checks; this is the scope of those runs, not a claim of a new whole-site certification.

The earlier verification passed **114 avatar tests**: the combined customizer, art-quality, artifact, hat-fitting and clothing suites passed 113 tests in 11.6 minutes; the final cheek/beard regression passed separately against the same production source. Together these include 15 artifact tests (5,802 configuration samples), four hat tests (72 configurations), and four clothing tests (48 rendered samples). Interactive accessibility checks were enabled. Both scoped accessibility suites passed with no findings, and all 353 regenerated previews passed the XML, geometry-value, ID and local-reference checks. JavaScript syntax checks, the Jekyll build and `git diff --check` also passed. The built runtime and CSS were verified byte-for-byte against the final source.

## Reproduction

```sh
node scripts/build_se_gym_hero_choice_previews.js
bundle exec jekyll build --incremental
npx playwright test tests/se-gym-hero-avatar.spec.js tests/se-gym-hero-art-quality.spec.js tests/se-gym-hero-artifacts.spec.js tests/se-gym-hero-hat-fit.spec.js tests/se-gym-hero-clothing-paint.spec.js tests/se-gym-hero-eye-accessories.spec.js
```

The preview generator must finish before Jekyll copies its output directory. Inspect representative portraits at both customizer and enlarged sizes after changing contours or attachment logic; automated containment checks cannot assess all aspects of visual quality.


## Expanded benchmark after the second report

The second supplied crop exposed how the optional vitiligo patch at the right smile corner could resemble a stray tooth. Its smaller secondary patch now follows the outer right cheek; the clean comparison uses the existing “None” choice. Skin variation remains optional and independent of the selected skin tone.

The follow-up used three independent visual audits:

| Corpus | Rendered and reviewed coverage |
| --- | --- |
| Reproducible mixed-avatar benchmark | 2,000 unique normalized states, 2,160 theme/time observations and 4,320 native PNGs. All 188 contact sheets were visually inspected across the team, with suspicious examples checked at 600px. |
| Skin and facial-detail matrix | 3,150 states: 14 detail choices, 15 skin tones, five heads and three tuning profiles. All 45 initial sheets were reviewed; all nine corrected sheets covering 630 representative states were reviewed again. |
| Wearables and wardrobe matrix | 900 states, all 51 sheets reviewed: 330 single-accessory cases, the full 462 body/outfit combinations, and 108 assembled accessory stacks. |

Counts are unique within each corpus; the corpora may overlap. The mixed benchmark includes all 353 registered categorical values and every registered palette swatch, plus each fine-tuning axis at both supported limits. It covers every head/eye, head/mouth, head/facial-hair, head/face-detail, eye/lash, eyebrow/eye, mouth/facial-hair and body/outfit pair. Larger pairs are sampled: head/hair coverage is 70.1%, hair/accessory 33.2%. The coverage JSON records the exact denominators and omissions.

The visual and focused paint checks exposed these additional defects:

- A chin dimple could move below the jaw onto the neck. Chin details now share the actual chin fitting contract; complete lips reserve enough space above them. All face-detail materials also intersect the selected face surface.
- Opposing nose and mouth adjustments could hide the nose tip inside the mouth. The nose now clears the actual upper-lip contour beneath it, preserving long noses and high smile corners. The initial focused probe found 15 hidden tips in 72 configurations; the corrected probe found zero.
- Forehead freckles could paint over opaque eyes. Skin materials now sit beneath hair, eyes, nose, lips and facial hair. Changing freckle pigment leaves eye interiors unchanged while exposed freckles still change visibly.
- The beanie cuff covered about 21% of eye paint at default settings and 58% in a boundary case. Complete opaque hats now clear the selected eyes; their existing hair envelopes follow the corrected hat placement.
- The eyepatch could expose up to 91% of the eye it was meant to cover. Its cover now attaches to the selected eye and grows only when needed. The final comparison also exposed a strap crossing the other eye; its smooth curved strap now connects the cover and temple above the uncovered eye. A separate 12-case raster probe measured 16.8–54.8% unwanted eye overlap before this correction.

The durable generator is `scripts/se_gym_avatar_benchmark.cjs`. Each run captures the SVG, runtime, styles, generator and their SHA-256 hashes before rendering. Stable state IDs, full normalized configurations, browser version, theme, animation time and milestone accompany every image. Source changes during a run are explicitly reported. The report separates machine failures, conservative geometry flags and visual inspection; a machine pass does not certify visual quality.

```sh
node scripts/se_gym_avatar_benchmark.cjs --limit 2000 --seed se-gym-art-2026 --out tmp/se-gym-avatar-benchmark-final
```

The output directory must be empty or owned by this generator. The generated HTML review links native 180px and 600px images and complete state JSON, with separate light and dark review pages. Static report presentation belongs to `css/se-gym-avatar-benchmark.css`. The report was checked at 320px and 1280px in both themes: 16px readable text, no horizontal overflow, working state disclosures and no automated WCAG A/AA findings.

The new facial regressions cover 2,592 nose/mouth configurations, 45 chin-dimple boundary configurations and a freckle/eye overlap case with an exposed-skin positive control. Together with the previous checks, the artifact suite covers 8,440 configuration samples in 18 tests. `tests/se-gym-hero-eye-accessories.spec.js` covers all 17 eye styles, three head boundaries and three opposing eye/accessory profiles for four hats and the eyepatch: 765 configurations. These tests require actual eye and accessory paint, complete intended eye coverage, an unobstructed other eye, and a visible connected strap.

All three new face regressions reject the preserved defective source on the intended paint assertions. The freckle test sees a maximum RGB change of 71 inside the old eye paint and zero with the corrected order; its visible-skin positive control still changes by 71. Disabling accessory fitting exposes the original hat/cover defects, and restoring the old crossing strap fails every eyepatch tuning partition on the other-eye visibility assertion. Negative controls run from scratch copies without changing production source.


## Current verification

The complete avatar run passed 132 tests in 14.1 minutes with interactive accessibility checks enabled. After the final strap-only correction, all 25 eye-accessory/art-quality tests and four affected customizer integration tests passed again. The final scoped SE Gym screen and print accessibility suites both passed with zero findings. An earlier screen-audit attempt failed to write its report because the chosen report filename matched the benchmark directory; rerunning with a distinct JSON filename resolved that tooling error.

The final benchmark rerender completed all 2,000 unique states and 2,160 observations, with zero renderer failures or conservative geometry flags. Its source hashes match the final files, stayed unchanged throughout the run, and its 2,000 case IDs match the discovery run exactly. All 39 eyepatch states in that final corpus were independently measured and visually reviewed at native 180px and 600px, alongside the 12 original strap cases: 100% intended-eye coverage and connected strap paint, zero uncovered-eye overlap, and no browser errors.

All 353 regenerated choice previews pass XML parsing, finite-value, unique-ID, local-reference and vector-only checks. The Jekyll build, JavaScript syntax and whitespace checks pass. The built renderer and both affected CSS modules match source byte-for-byte. These results establish the stated benchmark and regression scope; they do not exhaust every possible continuous adjustment or cross-product of traits.
