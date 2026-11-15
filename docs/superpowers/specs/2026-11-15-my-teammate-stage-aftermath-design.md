# My Teammate: accumulating office damage

## Intent and agreed direction

The office gradually retains evidence of the team's setbacks. The user chose
accumulating office damage, with less clutter than the first mockups. Keep
the coffee throw near 3:32, add a permanent paper bin, and give every new
element detailed artwork consistent with the existing stage. Animation must
have convincing spatial relationships, contact, release, impact, and settling.

The singers, instructional diagrams, captions, and central performance area
remain the focus. Detail comes from coherent materials, folds, edges, and
shadows, rather than larger objects or a higher object count. The recent face,
hand, sleeve, and grip improvements must be preserved.

## Approaches considered

1. Subtle aftermath: mostly paper, cups, stains, and lighting. Keeps the
   teaching space clear but offers little physical escalation.
2. Accumulating office damage: clutter, modest repairs, a coffee impact,
   and a small rocket mark. The user chose this direction, then requested
   a smaller footprint and less debris. This is the design below.
3. Theatrical collapse: sagging curtains, crooked scenery, and dropped signs.
   This competes with the lesson and is outside the chosen scope.

## Visual progression

Times below refer to the original song. Bind production cues to its existing
word marks, not duplicated timing literals. All aftermath remains through the
following acts and final refrain unless an explicit cleanup action moves it.

| Beat | Action | Retained trace |
| --- | --- | --- |
| Opening | Establish the clean office and a paper bin beside the desk. | Empty bin; clear floor. |
| PM, 0:41–0:45 | Discard rejected demo papers into the bin; one misses. | A small amount of paper in the bin and one sheet next to it. |
| Build, 1:14–1:19 | Preserve the overnight-shipping gag and return the laptop correctly. | A small packing-tape remnant on the desk or bin area; remove the large carton after the gag. |
| Test, 2:07–2:10 | Show the cost of the lost night in the existing time lapse. | Two used cups and a compact folded test report at the desk; no floor-length printout. |
| UI, 2:34–2:49 | Echo the spreading changes with a small shift in the low wall paneling, followed by repair. | Two or three short, subdued tape patches near panel seams; preserve the legibility of all UI icons. |
| Force-push, 3:05–3:31 | Extend the existing sweep into the bin/desk area. Restore all recovered commits to their correct locations. | Move existing clutter rather than multiplying it. The discarded weekend cards become one small folded pair near the bin. |
| Back-End Developer, “gone”, 3:31.6 | Throw the existing mug toward an unoccupied patch of the rear wall. | A compact coffee stain with two thin drips; a few recognisable mug pieces and a small wet patch by the wall. |
| Security, 3:57–4:04 | Use the existing bill and rocket beats. | A small, softly edged exhaust mark high on the wall. Keep the bill in its existing presentation; no giant hanging receipt. |
| Final refrain and outro | Preserve the contrast between his green laptop/footlights and the red shared build board. | Earlier traces stay. Only a few confetti pieces remain near existing debris; one can catch in the stain. |

A very slight plant droop and a small curled poster corner are optional
background accents from the mockups, not additional headline events. Retain
them only if they remain unobtrusive with the actual cast and diagrams present.
Do not tilt the clock, sag the curtains, or introduce structural collapse.

## Artwork and composition

The permanent bin belongs beside the desk, with its base on the same floor
plane as nearby furniture. Give it a tapered metal body, elliptical opening,
dark interior, restrained mesh or seam detail, a highlighted rim, and a contact
shadow. Paper inside must sit behind the front rim and front body. Its fill
increases slightly across the song without becoming a towering pile.

Paper needs thickness suggested by folded corners, crease shadows, different
front/back planes, and a small floor shadow. Tape needs a lifted edge, subdued
material texture, and a shadow aligned with the wall. Coffee is a translucent
irregular deposit flattened onto the wall, with rounded satellites, a faint
drying edge, and gravity-aligned drips. Mug fragments retain the original mug's
ivory material and red band. Soot has a soft falloff, not an opaque black blob.

Match the existing comic artwork's outline weight, rounded forms, warm/cool
palette, and broad light direction. Gradients and detail must follow surfaces;
avoid disconnected highlight polygons, duplicate outlines, and muddy shading.
Do not add text that is too small to read at ordinary player sizes.

The builder chooses precise positions against actual stage occupancy. Keep
the centre clear and place static traces low, near the desk, or in the outer
wall areas. Backdrop marks are behind cast and diagrams. Floor props have
consistent depth ordering and cannot mask a hand, face, foot contact, or
caption. Check desktop and narrow player sizes, with the complete scene.

## Motion and spatial model

Use the existing deterministic song clock. Derive each event's state from
absolute song time so direct seeks, reverse seeks, pauses, and replay produce
the same state. Do not append stains, particles, or bin contents as side effects
of playback. Bound the number of retained props and predefine their outcomes.

Treat the room as a fixed camera viewing a floor plane and a rear wall. Keep
attachment anchors in their owner's coordinates, then project into the scene.
Apparent size, orientation, shadow position, and occlusion must agree with the
same depth; avoid independently tweening them into contradictory states.

For the mug, preserve its existing upright held pose and solved grip through
the wind-up. Transfer the visible mug once, at release, from the hand to a
free-flight state with matching position, scale, orientation, and velocity.
The empty hand follows through naturally. Use a short ballistic trajectory
toward the rear wall; the cup can rotate after release. Coffee appears at the
actual impact point and spreads in the wall's plane, then drips downward.
Fragments fall from that same contact, land on the floor below, and lose energy
through a small bounce or slide. Contact shadows tighten on landing. Do not
force every phase into the gap before the next lyric if that makes it snap;
release belongs on “gone”, while quiet settling may continue into the handoff.
Remove later held-mug cues that would make the thrown mug reappear.

For paper, show a continuous path from the actual source to the bin or floor.
Foreshorten a sheet as it turns, switch the visible side coherently, and avoid
stretching its silhouette. Use rear-rim → paper → front-rim depth ordering at
the opening. Floor contact removes downward motion before any small slide.
Use short easing for character anticipation and follow-through; gravity-driven
flight should not ease to a stop in mid-air. Quiet aftermath stays still once
settled. Any final drip is one discrete callback, not an endless competing loop.

Under reduced motion, retain the correct held/released and before/after states
without rapid throws, shaking, or fluttering. Preserve the player's existing
lyrics-only default. No flashing light changes or whole-stage camera shake.

## Implementation boundaries

Build on the existing SVG song engine; do not introduce a 3D dependency.
Keep aftermath artwork and its state evaluation together in a song-specific
module or clearly bounded helper. Choreography supplies semantic event cues;
the renderer owns geometry, depth, materials, and motion. Extend shared stage
or cast APIs only for a reusable attachment/layer capability that is needed.
Other songs must retain their current appearance and behavior by default.

Preserve current unrelated working-tree changes, including ongoing avatar and
head-turn work. Update the storyboard's visual descriptions and narration for
the new meaningful events, the corresponding described-track artifacts, and
the playlist thumbnail according to the song-video workflow. Temporary review
scripts, screenshots, and mockups stay outside the repository.

## Verification and completion

Numerical checks should cover deterministic direct/reverse seeks, bounded
prop counts, unique mug ownership, continuous release position/orientation,
correct wall/floor contact, bin occlusion, and reduced-motion end states.
Use behavioral assertions rather than snapshots of internal path strings.

Render and inspect the full cast with every affected scene. For each moving
prop, inspect anticipation, release, flight extrema, the frame before impact,
impact, rebound, and settling, plus frames immediately before/after scene
transitions. Inspect at normal presentation size and enlarged. Review the
coffee interaction as a continuous clip as well as individual frames. Check
the finale for cumulative clutter, face/diagram/caption overlap, and artwork
consistency. Run relevant song, shared-prop, and accessibility regressions.

Static mockups establish the amount and style of damage only. They are not
evidence that animation or contact is correct. Do not claim universal
perfection: report the actual frame ranges and checks completed, and resolve
visible artifacts before shipping.
