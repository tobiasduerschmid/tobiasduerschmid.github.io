# My Teammate: accumulating office damage

## Intent and agreed direction

The office gradually retains evidence of the team's setbacks. The user chose
accumulating office damage, with less clutter than the first mockups. Keep
the coffee throw near 3:32, add a permanent paper bin, and give every new
element detailed artwork consistent with the existing stage. Animation must
have convincing spatial relationships, contact, release, impact, and settling.
Each of the six issues adds one compact, identifiable residue group, clearly
caused by a visible on-stage action. That cause may be an animated visual
element, the Teammate, or a supporting cast member.

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
word marks, not duplicated timing literals. The staging actions below are
proposed builder choices for satisfying the visible-cause requirement, not
exact gestures specified by the user. Refine their placement and choreography
against the full scene while preserving each cause and its physical outcome.

Opening: establish the clean office and a permanent, empty paper bin beside
the desk. The bin is part of the set, not an additional residue group.

| Issue | Visible cause/action | Lasting trace |
| --- | --- | --- |
| 1. Requirements / Product Manager | On the existing “meeting” cue at 0:27.56, the Teammate tears the meeting-with-users card. Its two halves follow visible paths: one falls through the bin opening and one misses, landing beside it. | One torn-card group: a half inside the bin and a half on the floor. |
| 2. Unpinned dependencies / Build Engineer | During the overnight-mail gag at 1:13.86–1:18.88, close and remove the carton while returning the laptop correctly. A short torn tape strip visibly detaches from the carton during its removal, catches on the bin rim, and settles. | One curled packing-tape remnant on the bin rim; the carton leaves. |
| 3. Brittle tests / Test Engineer | Begin at the lost-night beat, 2:08.94–2:09.86: the Test Engineer pulls a compact report from a visible paper slot in the failing-test visual, folds it, and drops it onto the desk. Allow the sequence to continue beyond that short cue window so release, desk contact, and settling remain readable. | One compact folded test report at the desk. It remains when the test is rewritten and passes. |
| 4. Exposed implementation decisions / UI Developer | Link a visibly snagged cable to the existing spreading-UI-change gag. The UI Developer tugs it, pulling one low wall panel slightly loose, then presses the panel back and applies two short tape strips. Keep the pull, snag, panel movement, and repair spatially connected. | One repaired panel-seam group with two short, subdued tape strips; all instructional UI icons remain legible. |
| 5. Force-pushed shared history / Back-End Developer | At backend-4 “gone”, 3:31.60, the Back-End Developer throws the existing mug toward an unoccupied patch of rear wall. Show the held mug, release, flight, wall impact, and fragments falling to the floor directly below. | One compact coffee-impact group: a wall stain with two thin drips, a few recognisable mug pieces, and a small wet patch by the wall. |
| 6. Committed secrets / Security Engineer | On the existing rocket “launch” cue at 4:01.66, its exhaust visibly contacts a rear-wall patch along the launch path. The exhaust dissipates from that same contact area as the rocket leaves. Keep the bill in its existing presentation. | One small, softly edged soot mark at the exhaust contact area. |

The force-push broom may visibly move earlier physical traces, but must not
erase them or create another residue group. Restore all four “fix” commits to
their correct locations on “restore” at 3:26.08; none remains as floor debris.
The discarded weekend cards retain their existing transient role.

Final refrain and outro: all six residue groups remain, including when the
instructional diagrams reset or a depicted software problem is repaired.
Preserve the contrast between his green laptop/footlights and the red shared
build board. The completed accumulation contains exactly six compact residue
groups. Used cups, plant/poster damage, weekend cards, and confetti add no
persistent clutter. Do not tilt the clock, sag the curtains, or introduce
structural collapse.

## Artwork and composition

The permanent bin belongs beside the desk, with its base on the same floor
plane as nearby furniture. Give it a tapered metal body, elliptical opening,
dark interior, restrained mesh or seam detail, a highlighted rim, and a contact
shadow. Paper inside must sit behind the front rim and front body. Its fill
comes only from the specified torn-card half; the later tape catches on its
rim. Keep both small enough to preserve the visible opening and interior.

Paper needs thickness suggested by folded corners, crease shadows, different
front/back planes, and a small floor shadow. Tape needs a lifted edge, subdued
material texture, and a shadow aligned with its supporting surface. Coffee is a translucent
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

Every trace follows a readable chain: visible cause → continuous trajectory
or connected contact → settling → persistence. A stain, tape patch, loose
panel, or paper cannot pop into place as incidental damage. Show the action
that creates it, with the same object and contact location carried through
each phase. For a direct seek, derive the correct phase or settled result
without replaying earlier actions.

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

For paper, show a continuous path from the actual source to the bin, desk, or floor.
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

Check the six cumulative steps individually at before/action/after times.
Before an issue's action its residue is absent; during the action the visible
source, trajectory, or contact explains it; afterward exactly that one compact
group has been added. Recheck all earlier groups after each later step and
each diagram reset, including the finale and outro. Broom movement must leave
earlier traces present in their new positions, and all four restored commits
must return to the graph. Verify six residue groups total, without incidental
extra debris.

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
