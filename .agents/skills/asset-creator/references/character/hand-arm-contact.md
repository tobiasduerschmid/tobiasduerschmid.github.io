# Human arms, hands, sleeves, and object contact

Read this before drawing or changing a character gesture, limb rig, sleeve,
hand shape, held object, or its choreography. These are correctness requirements
for both main and supporting characters. Attractive shading and passing motion
tests do not compensate for a reversed thumb, broken elbow, or floating prop.

## Reason about the interaction before drawing

Inventory every hand shape, sleeve construction, character, mirrored side,
held object, and action in the affected animation. Include background cast,
resting poses, entrances/exits, and pickup/release intervals. A fix to a shared
hand or joint must be checked in all its callers, including other songs.

For each interaction, specify:

- Which anatomical hand it is, whether the palm/back/side faces the camera,
  which edge carries the thumb and index, and what forearm rotation makes that
  view possible. Screen-left is not anatomical left. Mirror the complete arm,
  hand, grip, and contact arrangement together.
- The shoulder, elbow, wrist, knuckle line, and intended fingertip or palm
  contact. Choose a feasible elbow bend and wrist angle before adding cloth.
- For an object: its actual handle/edge/hole/support point, corresponding hand
  contact, grip type, allowed orientation, and whether it is being carried,
  used, passed, or released. Do not infer a grip from a generic gesture name.

## Empty hands still need a coherent anatomy

Count the digits in the rendered silhouette, not just in a data structure.
The thumb starts proximally on the radial side; the index is adjacent to it;
the remaining fingers follow in order. Folded fingers flex back toward the
palm and occlude one another. Their tips are not extra knuckles. A sideways
point must read as the index, not the little finger. A power grip normally
shows the thumb opposing or crossing the index side of the curled fingers;
reusing a back-of-hand silhouette with a palm-side pose reverses this relation.

Use consistent palm/back detail: palm creases, nails, and dorsal tendons must
agree with the selected view. Do not switch between incompatible views merely
by changing a discrete hand-shape key while the wrist stays unchanged.

Build the visible hand as a coherent surface. In this song rig, use one
continuous contour for each empty-hand view, with interior creases rather
than separately outlined finger tubes. Tight joint splines can self-intersect;
overpainting them with a palm leaves triangular fill fragments and false
knuckles. Layer separate pieces only for real occlusion (for example, a thumb
in front of a board), and keep their internal roots unoutlined. Match wrist
outline thickness and tangents, and fade forearm shading into the hand.

A palm-facing extended index must not show its dorsal nail. Do not paste the
same nail path onto every pose; folded digits and rotated thumbs need their
own visible-surface reasoning. Review silhouettes first, then digit order,
then palm/back details at enlarged scale. A joint-name or digit-count test is
not an anatomy oracle: test the rendered filled region, gaps, actual contacts,
and visible marks, and inspect the result. References: [Proko's hand construction](https://www.proko.com/course-lesson/how-to-draw-hands-from-imagination-step-by-step/)
and [Art Prof's hand anatomy lecture](https://artprof.org/learn/fundamentals/anatomy-for-artists-hands/).

Check gesture meaning in context: a temple tap lands beside the temple, a
shushing finger reaches the lips, a palm rests on the chest, and a point aims
at its target. For a target across the body, bend the elbow and bring the
forearm across; do not pull the upper arm straight through the neck. Preserve
requested energy with anticipation and quick, eased transitions, rather than
unbounded joint turns or long rotations through the body.

## Sleeve and elbow construction

The inner and outer sides of a bent elbow have different geometry. The outer
contour rounds the joint; the inner contour cuts back to a crease. Symmetric
caps, overlapping tubes, or a single rounded rectangle leave bulbous elbows,
notches, and straight cut lines at deep flexion. Construct both contours from
the same shoulder/elbow/wrist frame, with tangent continuity and a tapered
wrist. Check for self-intersections and contour reversals at extreme bends.

A rolled sleeve belongs above the elbow and moves with the upper arm. Leave
room for the bare elbow to bend below it; do not use the cuff as a rotating
elbow cap. At a deep bend the forearm may occlude the inner cuff. Long sleeves
need a continuous cloth silhouette through the fold. Shoulders and underarms
join the torso without circular sockets or a stretched web from the neck.

Simplify the surface before adding patches. A rolled sleeve can use a fold
line inside the upper-sleeve silhouette; do not add another outlined capsule
at the elbow. For exposed elbows, remove hidden return arcs that curl back
into the visible contour. Ease any contour adjustment continuously with the
bend angle; a hard geometry threshold can produce a pop between clean poses.
Long sleeves need one continuous shoulder-to-wrist base surface. A separate
foreground pass is justified by torso occlusion, not by the joint itself.
Overlap its fill with the base and suppress internal strokes and their end
caps, so antialiasing cannot expose a slit, diagonal panel edge, or ink nub.

Occlusion masks must distinguish the proximal upper arm from the distal
forearm. Subtracting the entire upper-sleeve silhouette from exposed skin
also erases the forearm where a deeply folded arm overlaps its own shirt.
Keep that distal surface visible through the mask, using the same joint
contours as the painted limb. Check its edges as well as its centre.

For a long sleeve, the continuous base and its foreground forearm pass must
agree about torso depth. If their join reaches an apron, vest, or lapel,
keep connected cloth in front; do not expose a flat construction cap over
the garment. Buried bicep/axilla return contours remain uninked inside the
torso even when the sleeve moves forward. The forearm owns the outlines of
real crossings. A sleeve moving over an apron still belongs beneath hair,
scarves, and the collar; keep that torso-depth pass separate from the
foreground forearm used for face-touching gestures. Review depth changes in
both directions and nearby frames: reparenting a whole sleeve can reveal
a previously hidden contour loop.

Clip fold lines and shading to the actual moving surface. Give each visible
boundary one outline owner. Inspect at large scale for detached ink, square
corners, small skin gaps, abrupt shade ends, and wrist discontinuities, then
inspect at normal viewing size. Reproduce the reported pose on both sides,
then inspect neighboring transition frames and all sleeve styles; removing
an artifact from a rolled sleeve must not distort an exposed short-sleeve arm.

## Object-specific constraints

| Interaction | Required contact and motion |
| --- | --- |
| Mug | Fingers enclose the handle, thumb opposes them, opening and liquid remain upward. Coordinate the wrist and cup orientation; rotating only the cup inside a fixed fist is not a solution. |
| Clipboard / thin board | Fingers support one face/edge and the thumb opposes on the other face. Keep it readable/upright when presenting; do not spin it when another gesture begins. |
| Palette | Thumb passes through the actual thumb hole; remaining fingers support the board. |
| Wrench / magnifier / shaft tool | Closed power grip around the shaft, thumb on the index side. Tool axis follows the selected grip view and forearm rotation. An open resting hand cannot retain it. |
| Trophy / stamp | Grip the stem/knob; cup stays up and stamp pad faces the stamping surface. The lift and working stroke preserve the same contact. |
| Cane | Hand supports the crook; rigid shaft reaches the ground. Leaning/crouching adjusts the arm, not the cane length. |
| Broom | Shaft remains inside each gripping hand; bristles move toward/across the floor. If two hands are used, solve both against one shaft, not independent gesture paths. |
| Laptop / supported load | Use a palm-up or side-view support with compact fingers under the base and an opposing thumb on the rim. A dorsal waving hand is not a supporting grip. Base and hand share a contact through pickup, travel, hold, lowering, and release; matching only the final frame is insufficient. |

Give persistent objects a stable holding pose and let the free hand gesture.
An occupied hand must not silently become an open hand, pointing finger, or
thumbs-up while retaining its object. If the story needs the occupied hand to
gesture, author the combined action explicitly. If both hands are occupied,
use head/body expression or stage a release. Intentional tilts, spills, throws,
or transfers require an explicit story action, not accidental interpolation.

## Required verification

1. Generate an inventory from the real choreography. Sample every gesture and
   held-object interval, including anticipation, peak, hold, interruption,
   return, pickup, and release. Check forward playback and out-of-order seeks.
2. Sweep the real motion for finite transforms, joint limits, wrist continuity,
   contact drift, orientation changes, and excessive per-frame rotation.
   Test actual world-space geometry, including body sway, scale, and mirroring.
   A standalone pose atlas does not replace live frames: held-prop orientation,
   grounded contacts, and scene occlusion may be resolved by the caller.
3. Render and inspect every hand view and sleeve style on both sides. Include
   maximum flexion/extension, raised and crossed arms, facial contact, maximum
   wrist bends, and the most extreme samples found in the motion sweep.
4. Inspect all prop interactions at useful close-up scale and in the complete
   scene. Verify thumb/index order, opposing fingers, grip occlusion, object
   gravity, floor/support contact, face clearance, and foreground UI layering.
5. Add focused behavioral regressions for the failure found: e.g. cup up-vector,
   closed grip through gesture changes, actual handle-to-hand contact, or laptop
   support throughout its lift. Check contact against the painted hand and object
   surfaces; comparing two copies of the same contact constant can pass while
   that point floats outside the skin. A metadata assertion that a digit is named
   "index" does not establish that its visible anatomy is correct.
6. Recheck reduced motion and the shared renderer's other callers. Refresh
   affected previews and playlist thumbnails. Do not declare the anatomy fixed
   from a green test count alone; visual review is a separate required gate.

Keep temporary contact sheets, sweep data, and screenshots outside the repo.
Record what was inspected and distinguish automated evidence from visual
judgment. A reported screenshot is a regression case to reproduce, not an
isolated frame to patch while leaving the shared cause in place.
