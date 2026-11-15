# Facial expressions and small head turns

Facial polish is a correctness requirement, not a collection of extra marks.
First establish a coherent expression with eyes, brows, cheeks, and mouth;
then add detail that follows those surfaces. Read the actual rendered face
at presentation size as well as enlarged. Preserve the character's identity.

## One expression, coordinated parts

- Joy combines lifted mouth corners and cheeks with alert, readable eyes.
  Do not substitute closed arcs whenever a happy control crosses a threshold.
  Keep blinks independent from emotional squinting.
- Anger lowers the inner brow ends and firms the mouth corners; misery raises
  the inner brow ends, lowers the lids, and turns the mouth down. In SVG's
  downward-positive coordinates, the picture's left brow rotates clockwise
  to knit inward, while the right rotates counterclockwise. Verify the
  painted result; an incorrect sign can turn anger into surprise or sadness.
- Choose emotion from the meaning of each line, not from speaking activity.
  An explanatory line is attentive; an accusation can be angry; exhaustion
  can be weary. Never assign one angry profile to every solo or every sung
  phrase. Author specific line/word windows, ease in/out, and compare the
  same character explaining, accusing, recovering, and listening.
- A singer's emotion persists through syllables and the gaps between them.
  Forward every supported control to both drawn and worn-head renderers.
  Keep expressive delivery tied to the intended speaking phrases. Restore
  relaxed listening faces when a singer is silent; do not impose a permanent
  unhappy resting face on the cast. A gesture reset must not erase the
  current phrase's emotion, and a gesture hold must not prolong it forever.
  Emotional closed mouths must not fade out the singing layer.

## Continuous geometry and attachment

- Drive the eye white, iris clipping boundary, and upper/lower lid contours
  from one aperture. A blink collapses that aperture continuously. Never
  paint a mismatched flat skin patch over a shaded face to conceal an eye.
  Keep pupils and catchlights inside their clips at maximum gaze offsets.
- Keep filled upper and lower lips visible when the mouth is closed.
  Check computed paint and rendered pixels, not just nonempty paths or
  visible bounding boxes. Rebuild the preview when shared styles change.
- Start an opening mouth from the closed lip curve. Inspect tiny openings,
  not just closed and fully open states: threshold swaps can produce pops.
  Clip teeth and tongue to the mouth interior. Derive lower-lip placement
  from the actual curve, not a Bézier control point below it. Keep the lip
  and chin details separate at the largest vowel.
- Rotate a head around its neck attachment, not the centre of its bounding
  box. A shallow turn may use a shared projected facial plane with a little
  extra nose depth and subtle near/far eye and ear foreshortening. Move
  cheeks, brows, hair mass, sideburns, and temple accessories consistently
  too. Ear parallax is behind the face; nose parallax is in front of it. Keep the
  angle small; profile views require authored silhouettes and occlusion.
  The mouth, moustache, brows, and clipping paths must travel coherently.
- Detail follows volume: hair strokes follow the locks and stay clipped to
  the silhouette, brow hairs stay inside the brows, ear contours fit inside
  the helix, and lip highlights follow the lip. Avoid duplicate outlines,
  floating accents, sharp shading patches, and texture that obscures emotion.
- At small sizes, paired curled nose-wing outlines and isolated septum dots
  can look like jewelry. Use short filled nostrils, open subdued creases, and
  soft tip volume; never make nostrils bright rings on deep skin. Review all
  variants at their actual on-page size before calling the detail an improvement.
- Fit shared/customized features in their own coordinate spaces, preserving
  existing renderer transforms. Measure only after attachment, before the
  expression changes the bounds. Each instance needs private paint/clip IDs.

## Required verification

Inspect maximum left/right turn, tilt, gaze, brow lift, joy, distress, full
vowels, and complete blinks, plus intermediate turns, half blinks, and tiny
mouth openings. Check the neck connection, ears, far eye, lip/chin clearance,
and clipped details in those frames. Sample the actual choreography's extrema
and neighbouring frames, not only invented poses or a few attractive stills.

For a cast, inspect every affected role in its real live renderer. Fallback
export faces can conceal bugs in worn avatar fits or ignored controls. Include
representative skin tones, eye/brow/mouth shapes, glasses, and facial hair when
the shared renderer changes. Check both forward and backward seeks, repeat
the same timestamp to verify determinism, and exercise reduced motion.

Numerical checks should cover finite geometry, visible happy eyes, facial
paint staying inside the head, fixed attachment during turns, and an audible
singer retaining its visible mouth opening. These checks complement rendered
review; they cannot establish that an expression looks human or convincing.

For shared SE Gym heads, use `HeroAvatar.setHeadTurn(svg, amount)` from the
existing playback clock (−1 screen-left, 0 frontal, +1 screen-right). It owns
the depth planes, fitting composition, and reduced-motion reset; songs must
not reimplement those transforms. Thin small-size contours use the renderer's
skin-relative `--hero-face-accent`, with visible filled closed lips retained.

Project implementation: `js/song-video/opera-cast.js` owns the drawn lead and
pose channels; `js/song-video/student-avatar.js` fits worn heads. Relevant
regressions are in `tests/song-it-works-on-my-machine.spec.js` and the shared
song/architect suites. Keep temporary galleries and screenshots outside Git.
