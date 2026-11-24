# SE Book song videos

Live vector playback and video export for the music videos in SE Book chapters. The first one is
"Snapshots and Pointers", the Git song on `SEBook/tools/git.md`, embedded with
`{% include song-video.html song=site.data.songs.snapshots_and_pointers %}`.
Published videos live in `assets/video/`. Shared artwork and choreography live
in `js/song-video/`, stage styles in `css/song-video-stage.css`, fonts in
`fonts/song-video/`, and the soundtrack in `assets/audio/`. This scripts folder
contains only the offline export tools and is excluded from the Jekyll build.

## Live playback

The chapter embeds `/assets/song-player/snapshots-and-pointers.html`, a
same-origin frame that isolates the artwork from chapter CSS. `_layouts/song-player.html`
serializes the storyboard at build time, so playback needs neither a YAML
parser nor access to `_data/` or `node_modules/`. Both renderers call
`SongScene.build(stage, storyboard, songId)` and use the same choreography.

`player.js` uses native audio `currentTime` for every rendered picture. It
measures drawing cost and reduces the visual frame rate on slower hardware;
missed frames are skipped, never queued or used to slow down the soundtrack.
The audio always supplies the clock. Rendering stops during pause, buffering,
and hidden tabs; on return it jumps to the current audio time. Captions use
the selected track's WebVTT cues and overlay the picture at readable, unscaled
text size. The integrated controls provide play/pause, seeking, five-second skips,
mute, a captions toggle, and fullscreen. Picture clicks/taps toggle playback;
double clicks/taps seek five seconds on either side. Focus-scoped F, K, Space,
and arrow shortcuts use those same controls. Shared speed settings range from
0.5× to 2× and apply to the native audio clock, so the animation stays in sync.
On touch devices, fullscreen requests
a landscape orientation lock when available; otherwise, a portrait viewport
rotates the player surface. Browsers without native fullscreen expand the
existing same-origin frame to the visible viewport without reloading audio.
Escape or the fullscreen button restores the page, scroll position, and focus.
Reduced-motion users start in lyrics-only mode with visual descriptions.

Scene visibility is managed centrally in `scene.js` for every song and the
exporter. Fully transparent top-level pictures leave the document, a comment
holding each one's place, so invisible artwork costs no style, layout, paint,
or compositor surface throughout the song. Hiding them with `display: none`
is not enough: WebKit keeps allocating style data for paused animations posed
inside a once-rendered `display: none` subtree, which grew Safari's memory by
megabytes per frame until an iPhone reloaded the page. Native animation
timing restores pictures before frame callbacks measure them, including
backward seeks; nested words and cards retain their layout space. A
choreography that adds stage layers of its own returns them, `return { layers:
[…] }`, and their pictures are culled the same way.
`SongScene.culledPictures(stage)` lists the pictures currently out of the
document, for tests that inspect a song's whole artwork.
Lyrics-only mode avoids building the scene and disposes existing artwork.
Turning animation back on rebuilds the scene at the current audio position.
The catalog-wide resource tests cover startup, repeated seeks, and mode changes
in all three browser engines. They guard against excessive rendering work;
physical iPhone memory and crash testing is still required for device validation.

The Audio track selector switches between the song and the audio-described
recording without losing the current song position. `tracks.js` maps the
described audio's clock through `assets/audio/*-described.json`: during each
narration interval it holds the authored picture; afterward it resumes the
original choreography. Both recordings use the selected playback speed. The same control
bar and captions work with either track; there are no raster video players on
the Git chapter or its live player page.

Audio downloads and the full transcript remain available if media fails.
The chapter owns the embedded player's single transcript disclosure; the
standalone player keeps a transcript link. Live visual descriptions appear
in lyrics-only mode or when animation fails, without repeating them below
the normal picture.
Without JavaScript, a native audio control is provided. The player reads the
existing SE Gym hero appearance for optional student-at-laptop cameos (and for
the face a song character can wear, below); it never saves or changes that
appearance. Missing or unavailable saved data uses the
default Bruin; an unavailable avatar asset leaves a laptop illustration. Nothing autoplays, and media is not fetched
until the reader presses play or chooses another audio track.

`/SEBook/playlist.html` discovers live players from the storyboard catalog and
offers course defaults from `_data/song_playlists.yml`. Students can reorder,
add, and remove videos in their saved list. See `docs/song-playlists.md` for
module boundaries, storage contracts, and authoring another playlist.

The student is an optional, asynchronous enhancement. One copy of the shared
hero artwork is adapted to a seated pose, stripped of workout layers and
independent animation, and reused across the intro, remotes bridge, final
chorus, and outro.
Its head, blink, gaze, and typing-arm motion follows the same absolute song
clock as the diagrams, with a still working pose under reduced motion. Fitting,
hair, and accessories remain inside the shared head assembly; pupils move
inside their original eye clips. The saved character never gates playback or
adds another animation loop. A storyboard can set `student.laptop_logo` to a local SVG URL
to use a song-specific laptop emblem in both the live player and exports;
without it, the shared Git mark is retained. The shell song uses the official
Bash logo, with attribution and license in `assets/icons/bash/`.

A song character can also wear a hero's own head: `student.heroHead()`
resolves, on first request, to the saved human or Prof head, neck up, or,
without one (no saved hero, or the Bruin), to the SE Gym's default human
hero's (`HeroAvatar.DEFAULTS`, never saved). It resolves to null on an export
stage, which never loads the renderer, or if the renderer fails, and the
character then keeps its own drawn face. The information-hiding song's
Agent 00 (`ih-kit.js`) wears it in every scene, including the case-file and
finale cameos that replaced two laptop cameos. One render is pruned to the
head assembly and neck, without body-bound accessories or unreferenced
definitions, then copied per wearer with `HeroAvatar.cloneSvg`, so every copy
owns its IDs and style scope and a hidden scene never breaks another copy's
paints. The neck layer sits under the wearer's collar and the face, hair, and
beard over it (the Prof's fixed portrait keeps its own neck under the collar).
The copy blinks on the song clock (not under reduced motion); the wearer
directs its glance and wink, which masks split per eye, and lifts one brow
(the brows are split per side the same way). Agent 00's fists take
the hero's skin tokens, and a hairline bright halo outlines very dark skin or
hair against the noir stage.

`student.castHead(style)` renders a fixed supporting character through the
same wardrobe, keeping that look across its cameos. Draw It Out uses four
fixed looks for its hoodie, curls, beard, and hijab teammates. A worn head's
pose can set `expression` to `thoughtful`, `puzzled`, or `worried` for a closed
mouth fitted to that hero's face; `neutral` restores its chosen mouth and
allows the existing `hush` and `sing` controls. Expressions, gaze, and blinks
follow song time, including backward seeks and reduced motion. Set
`expressionFrom` and `expressionMix` (0–1) to morph between closed-mouth
reactions and fade to or from the hero's chosen smile. The sketch-kit cast
eases its mouth, brows, gaze, and head tilt together over each reaction.

The playlist's Random avatar switch (`song-player-random-avatar`, see
`docs/song-playlists.md`) makes every appearance a new random human hero
instead. `create` and `heroHead()` then hand out looks through a wardrobe.
One render holds the main thread for about a tenth of a second, so the looks
that playback will use, plus a spare, are rendered one per idle period once
the scene is built; a hero's entrance never waits on one. Only a return after
seeking back that takes the spare has another rendered. A character's
`dresser` changes its look only as it comes on stage (a new cameo cue, or a
wearer returning after leaving the stage or being culled), so a look never
changes in view. A wearer's `wear(head)` must therefore replace an earlier
head's copies and colour tokens (`head.paint`).

Each Agent 00 cameo is choreographed to its lyric with `ih.agent({ moves })`,
a list of `[songTime, move]` pairs from `MOVES` in `ih-kit.js`: `tie`, `lapel`,
`shh` (an index finger upright across pursed lips, the other fingers curled
under the chin, one brow raised and eyes darting), `button`, `watch`, `glance`
(with a knowing nod), and `wink` (a raised brow, a head tilt, and a glint off
the smile). The lips purse by drawing the hero's own mouth in about its
centre, so the gesture works for every saved mouth. `entrance: 'left' |
'right'` glides the agent in and settles the knees; `toastHold` brings a
raised martini down to the chest after that many seconds. Every pose is
computed from song time; with reduced motion the moves snap into place and the
glide, sway, and glint stay still.

Celebration confetti uses seeded paper ribbons and tickets with varied sizes,
scattered launch positions, subdued shading, and tumbling. Every pose is
calculated from the current song time, so repeated seeks reproduce the same
frame. Particle counts stay bounded, and inactive bursts stop updating.
The information-hiding song instead uses `fireworks.js`: five staggered comet
launches and chrysanthemum bursts, with drag, gravity, tapered trails, and
fading embers. The effect stays behind teaching artwork, is clipped above the
caption reserve, and is hidden for reduced motion. It has no independent clock,
randomness during playback, strobing, or full-screen flash.
The aurora backdrop uses radial gradients instead of moving blur filters.

The exporter writes the described audio and timing manifest from the same
frame-accurate edit plan. `scripts/video-tools/extract-audio.swift` can extract the AAC stream from
an existing described MP4 without re-encoding. Published MP4s remain export
artifacts, independent of the live player.

Run the focused browser matrix against a built site served with HTTP byte-range
support (for example, `bundle exec jekyll serve --port 4189`). Python's basic
HTTP server does not provide the seekable media responses this matrix needs:

```bash
SONG_PLAYER_BASE_URL=http://127.0.0.1:4189 \
  npx playwright test --config tests/song-vector.config.js
```

The matrix exercises Chromium, Firefox, and WebKit. Physical phone and
screen-reader checks complement these automated tests.

Firefox rounded-border rendering also needs a **compositor readback** check:
ordinary automated screenshots use a software snapshot and can miss WebRender
seams. With Node 22+ and a desktop Firefox installed, run:

```sh
node scripts/song-video/check-firefox-paint.js /Applications/Firefox.app/Contents/MacOS/firefox /tmp/song-firefox-paint
```

This opens a disposable Firefox profile (never the user's profile), enables
`remote.screenshot.use_readback`, and checks 50 transformed rounded shapes at
fractional pixel density. It saves before/after frames, rejects stray interior
border pixels, verifies unchanged layout, and closes the test browser. This
reproduces [Firefox bug 2076078](https://bugzilla.mozilla.org/show_bug.cgi?id=2076078).
The same defect also shows as thin L-shaped lines inside the corners of
rounded boxes on a scaled stage, because Firefox draws a rounded border as
separate corner and edge pieces. In Firefox, the shared scene preparation
(`rounded-surfaces.js`) therefore repaints every rounded box with a solid
border, including pseudo-elements, without a border: an opaque box paints
its border colour as a border-box background layer under its fill, and a
translucent or empty box draws the ring with a free pseudo-element masked to
the border area. Layout is unchanged. The repaint copies computed colours, so
a class change that could change paint repaints just the boxes inside the
changed element, a picture returning from culling repaints just the boxes
whose state classes changed while it was out of the document, and boxes
whose border or fill is animated keep their border. Dashed and dotted borders, SVG paths, and other browsers keep their
existing rendering.

## One storyboard, many outputs

`_data/songs/<song>.yml` is the single source of truth. Each lyric line has
its timing (`start`, `end`), the times of the words the visuals hit
(`marks`), the sung `text`, and a `visual` description of what the video shows
for it; each section has a `narration` for the audio-described cut. The
choreography draws against `marks`, `captions.js` turns the lines into
WebVTT, `described-cut.js` builds the described cut from the `narration`s, and
`_includes/song-transcript.html` prints every line with its `visual` as the
transcript: in a chapter's song figure (`_includes/song-video.html`), or, for
a song only in the video playlists, inside its player page (a
`layout: song-player` page without `transcript` prints it in a "Full
transcript" disclosure). A song with several singers gives each section a
`voice` (a line may have its own); the captions and the transcript name the
singer whenever the voice changes: "(Product Manager) They need twenty
coffees…".

`beats` gives the beat grid (`bpm`, `first`) that pulses and dance steps
follow. A take whose tempo drifts can also list `times`, every beat in
seconds; `Timeline.beats` then follows that tempo map instead of the fixed
grid. The TDD song's map comes from beats tracked on the percussion and
smoothed over ±5 beats.

Two optional fields let a song bring its own look. `theme` picks the stage
backdrop from `SongKit.themes` (default `studio`, the aurora). Every song now
brings a room that fits its topic: `night-sky` is the starry sky of "Unbox
the Stack", `darkroom` the photographer's darkroom of "Snapshots and
Pointers" (prints of snapshots drying on a line, with HEAD and branch tags
pointing at the newest one), `story-wall` the team-room wall of "Invest in
Your Stories" (sticky notes and index cards in a story map), `workshop` the
pegboard shadow board of "Small Tools, One Job Each", `ballroom` the TDD
song's evening ballroom, `spy` the information-hiding song's noir
operations room, `object-city` the city-builder game at dusk of "Let
the Object Decide", `drafting-room` the architectural blueprint of
"Draw It Out While It's Cheap to Change" (cyanotype paper in UCLA Blue
with fold creases and a white grid, a bordered sheet with a title block, a plan fragment with dimension
lines, and drafting tools at the edges), `opera-house` the opera house of
"It Works on My Machine", and `team-room` the office of "Inspect and Adapt".
A theme script registers itself
in `SongKit.themes`, draws its room once, and poses it only from song time;
its stylesheet keeps the scenery faint enough that text over it keeps 4.5:1.
`extras` lists the song's own stylesheets and scripts (`styles`, `scripts`),
which both the live player and the export stage load, in order, before the
choreography; the networking song uses them for `night-sky.js`, its
illustrations in `js/song-video/art/`, and `net-kit.js`. The illustrations are live vector art: shapes, gradients,
and patterns, without filters or bitmaps. `net-kit.js` writes each drawing
into the page once as an SVG `<symbol>` and shows every copy with `<use>`.

"Small Tools, One Job Each", the shell song on `SEBook/tools/shell.md`, uses
the `workshop` theme and brings `js/song-video/shell-kit.js` with
`css/song-video-shell-kit.css`. Each of its pieces draws one visual metaphor
beside the real notation: scissors that cut a command line at its spaces
(with tape for quoted words), a filing cabinet for `PATH`, a map for the
directory tree, a conveyor belt of machines for a pipeline, an address label
for the shebang, a padlock for execute permission, a decision diamond for
`if`, a rubber stamp for a `for` loop, a boom gate for `&&`, and collectible
cards that fill a toolbox in the command chant. Pieces that need a word's
position measure it on the first visible frame, because the live player
builds the scene before it shows the picture.

"Red, Green, Refactor", the TDD song on `SEBook/testing/tdd.md`, uses the
`ballroom` theme (`js/song-video/ballroom.js`) and three modules of its own:
`tdd-dancers.js` draws Test and Code as one stage-wide SVG rig whose keyed
poses, travelling waltz on the beat grid, and two-bone IK for the hold (a
promenade hold, joined hands, or the arch of an underarm turn) are all pure
functions of song time. One couple dances the whole song: scenes move it with
`place()`, and it walks or waltzes there on the beat instead of cutting
between copies. `showcase()` is the refactoring moment: Test presents Code
while the code lines on her gown snap into clean indentation under a
spotlight. `tdd-kit.js` draws the notation (Python code
cards with syntax colours, a pytest terminal, suites, the Red/Green/Refactor
cycle, MyStack, the test pyramid); and `tdd-props.js` draws the pictures
(floor tiles, mismatched gears that jam in an integration failure, a staff with
repeat signs for regression tests, flaky-noise waves, a fence of tests).

"Let the Object Decide", the object-oriented programming song on
`SEBook/oop-song.md`, uses the `object-city` theme
(`js/song-video/object-city.js`). The same file draws the town the song keeps
returning to: a top-down game window with two crossing roads, a traffic
light, a bus stop, and a bike lane. Its vehicles (car, hybrid, bus, bike,
ambulance, grey type-code tokens, and dashed outlines of kinds nobody has
written yet) drive routes nose first, with rounded corners, pulling away and
braking smoothly and slowing into turns, all as pure functions of song time
(`distanceFor()` sizes a drive so that the next one starts at the same speed);
`sprite()` draws one vehicle large with a hood
that opens. `js/song-video/oop-kit.js` draws the notation in one consistent
language: UML-style object cards (state behind a padlock, methods as buttons
on a door), message envelopes flying on dashed arcs, C++ code cards that
change in place, the rule card that collects the song's five rules, red and
green flags for the quiz, and single-line pictures such as a vtable, a
Rectangle/Square test bench that resizes, and the grid of classes against
operations.

"Draw It Out While It's Cheap to Change", the UML song on `SEBook/uml.md`,
uses the `drafting-room` theme (`js/song-video/drafting-room.js`) and draws its notation with the SE
Book's own ArchUML renderer: the storyboard's `extras` load
`js/ArchUML/uml-bundle.js`, `js/archuml-compact-pane.js` and
`js/song-video/model-kit.js` (styles in `css/song-video-model-kit.css`).
A sheet given a `fit` box lays out a bare `layout compact` spec for that
box (`layout compact WxH`); the build only prebuilds a storyboard view whose
spec already names its size. `ModelKit.diagram()` renders a class,
sequence, state, or component spec in an off-screen host, so ArchUML can lay
it out while the player keeps the stage hidden, records the bounds of every
drawn element (boxes, message and transition routes, characters of labels),
crops the drawing, and moves the SVG onto a paper sheet. The choreography
then rings, dims, crosses, traces, or labels parts of the real notation in
an overlay inside the same SVG, so emphasis scales with what it points at:
a ring draws its outline on over a soft glow, a highlighter band sweeps in
along its long side, and a callout sits beside its part with a leader line
to it. A ring, band, or callout given an `until` stays up for at least
1.5 s, or 0.6 s plus three words a second for a callout's text, a planning
floor for reading while the song goes on. Swap one sheet for another in the
same place, with the same spec scale, to change one thing and keep the rest
(verse 4 changes only the alt, opt, or loop frame around the same two
lifelines). `ModelKit.code()` puts Python source beside the notation, in the
shared syntax colours. Class diagrams carry no route ids: find their arrows
by shape (an edge's `polygon` head, the `stroke-dasharray` of a
realization).
Routing many connectors is slow in the browser (a tangle of eight arrows
took about a second), so a storyboard can list its views under `diagrams`
(name: `kind` and `spec`) and pass them to `ModelKit.diagram()`. The build
draws each one with the static-diagram renderer and cache
(`_plugins/uml_static.rb`, through `_plugins/song_diagrams.rb`) into the
player page, and the kit uses that drawing instead of calling ArchUML. A
spec the page has no drawing for, as in the export stage, is still drawn in
the browser.
`js/song-video/sketch-kit.js` (styles in `css/song-video-sketch-kit.css`)
draws the pictures beside the notation from the lecture's building
metaphors: a brick wall laid in a hurry around one crooked brick, four
teammates whose thought bubbles show different buildings
until a clear whiteboard drawing aligns them, a load-bearing wall, a floor
plan whose layers fade, an eraser, a coding-agent robot, a car whose wheels
outlive it, a house whose rooms do not, a shelf of software engineering
classics, a paper plane, library book #42 moving between
states, a function machine whose identical calls stay side by side, and a
ball that snaps into a socket. `drawIn()` strokes a drawing in like a pen.
`js/song-video/architect.js` (styles in `css/song-video-architect.css`)
casts the viewer's own SE Gym hero as the song's architect, as the
information-hiding song casts Agent 00: a detailed figure standing at ease
in unisex clothes on a unisex build (shoulders little wider than the hips,
no waist shaping), a white shirt buttoned to the collar with rolled sleeves,
a camel knit vest, straight trousers, and derby shoes, holding a pencil and
a rolled drawing, that wears `SongStudentAvatar`'s `heroHead()` (export
stages keep its drawn face). Its sleeves turn at the shoulder inside the
vest's armholes, which are drawn again over them until an arm comes across
the body. Then that whole arm moves forward: its sleeve in front of the
other shoulder, the collar, and hair or a beard on the chest, and its
forearm and hand in front of the other arm
(`tests/song-architect-layering.spec.js`). Unlike Agent 00 on the noir
stage, it draws no halo round very dark skin or hair.
Its hands are in proportion, about three quarters as long as the forearm,
and each wrist turns only as far as a wrist can (`WRIST_RANGE`). The pencil
hand is seen from the thumb's side, a giant pencil in a writing grip: the
thumb's pad and nail in front, the index finger arched over the pencil, the
middle finger under it. Its fingers are built from their joints (`finger()`),
so a pose's knuckles stay where a hand's are. The other hand is a fist seen
from its back, as the wristwatch on that wrist requires, round a roll that
passes behind the forearm. Pointing far off, the wrist bends back so the
pencil leads along the arm (`tests/song-draw-it-out-architect.spec.js` checks
that its line meets the quiz answer it points at).
`ArchitectKit.architect()` places it in a scene and plays named moves on
sung words, towards stage points: `point`, `tap`, `trace`, and `sketch` aim
the pencil (two-bone inverse kinematics, touching the point when in reach;
further off the elbow stays low and the wrist lays the pencil on the line
to the point); `check`, `cross`, and `circle` draw a tick, a cross, or a ring
in the air on the way to it, along smooth paths. `erase` draws the hand in,
slides the pencil to its midpoint, rolls it between the moving thumb and
fingers, and closes the grip near the rubber before pointing and rubbing.
The barrel stays in the pinch through the turn. `draw`
draws a route of stage points small in the air, at the pace the drafting
pencil draws it on the sheet. Out at the side the elbow always goes below
the line to the point, so it never flips over, and the shoulder turns the
forearm out only as far as a real one does, further the higher the arm is
raised (`outwardLimit()`); where that is not enough the arm reaches further
along the same line instead of folding the forearm out sideways. Easing
between two poses straightens the elbow rather than folding the forearm
back through the upper arm (`unfolded()`). `inspect` leans in, pencil to
chin (`chin: false` keeps the pencil down); `sight`
holds the pencil out at arm's length; `think` brings the pencil to the chin
(the upper arm foreshortened as it comes forward); `look`, `scan`, and
`shake` move only the eyes and the head; `watch` checks the wristwatch;
`send` raises the pencil and flings it out at a point; and `present`, `aha`,
`nod`, `bow`, and `wave` round it out. `flip` moves the pencil to the other
hand. Its motion follows how people move: a minimum-jerk speed profile for
every reach, the upper arm leading while the forearm, the hand, and the
head trail it (`LAG`), the hand catching up as the arm slows
(`followThrough()`), a lean after a sideways reach that the free arm
balances (`balance()`), and two steps with a give at the knees when it walks
in. Long joint sweeps get more time, including the approach to a moving
stroke; elbow and wrist limits are applied before interpolation. A move
cued while another is under way takes over the joints it uses,
and a return to rest just before it is skipped, so the arm goes straight on
to its next pose. The architect carries the story, standing wherever a scene
leaves room beside its content: it steps in after "fix it later" has cracked
the building and draws the building again for the pencil to copy; decides
what the floor plan leaves out, taps the flaw on paper, and hands the plan
on and ticks off what comes back in verse 1; talks the Class Diagram over
with a teammate, taps the padlock, and rewrites the one line an interface
lets it swap in verse 2; thinks over whether a player is part of a team in
verse 3; acts out verse 4's "you" (it circles the bottleneck, waits on its
watch for the synchronous reply, then sends the asynchronous message off
and carries on); runs the pencil along the states in verse 5; points out
the ball and the socket in verse 6; joins every chorus; invites you to the
pop quiz; and in the outro holds up the drawing, looks round the four
diagrams, bows, and waves goodbye. The take sings its seven-question pop quiz as call
and response, all about one new system, a pizza app, on the quiz cards the
other songs use: a numbered card with the question and an answer bar that
slams in when the answer is sung. Every card is narrowed: a question about a
diagram shows that diagram beside it, changing when the answer lands, and
the others show the architect thinking it over, then ticking off, pointing
at, or circling the answer. Where the lyric sheet splits a sentence across
short lines to slow the singing, the storyboard keeps the sentence, or a
clause of a long one, as one line.

"My Teammate (It Works on My Machine)", a comic opera about teamwork, is only in
the video library on `/SEBook/playlist.html`: it has no chapter page, so its
player page prints the transcript. It uses the `opera-house` theme
(`js/song-video/opera-house.js`):
a gilded proscenium with velvet drapes, a fringed valance, a curtain,
footlights, and a conductor in the pit, framing a software team's office.
The curtain is flown, rising and falling: a curtain drawn sideways sweeps its
folds' light and dark stripes across the picture, which the flash screen
rightly counts as flashing (in JPEG frames the dark folds also turn
saturated red).
The choreography poses the office through `OperaHouse.of(stage)` (`curtain`,
`clock`, `sky`, `board`, `footlights`, each a cue of song time): the wall
clock beside the arched window, the sky in the window, and the build-status
board's six lamps follow the story. The drapes and the curtain sit in front
of the scenes, so the cast enters from the wings behind them.
`js/song-video/opera-cast.js` (styles in `css/song-video-opera-cast.css`)
draws the seven singers on one unisex rig: the Teammate, the tenor, with his
own drawn face (a towering pompadour and a twirled moustache), and six
teammates in the costumes of their roles (the Product Manager's blazer, the
Build Engineer's hi-vis vest, the Test Engineer's lab coat, the UI
Developer's painter's apron, the Back-End Developer's hoodie, the Security
Engineer's tactical jacket), who wear `SongStudentAvatar`'s `heroHead()`
with an open singing mouth drawn over it while they sing (`singingMouth()`).
`OperaCast.figure()` places a singer, glides it in from a wing, poses it with
named moves on sung words (pointing and presenting by two-bone inverse
kinematics, with the finger and hand geometry the architect shares through
`js/song-video/figure-geometry.js`), puts props in its hands, and opens its
mouth on its own sung words (`wordsFor()`). A move's return to rest puts back
only what that move posed, and gives way to a later move that has already
posed the same arm or face, so overlapping holds never snap a pose away.
Arm reaches retain a soft elbow and cap flexion at 150 degrees. Wrist targets
are bounded before interpolation so the hands ease into their poses instead
of hitting a hard limit early. Immutable pose keys compile into per-field
tracks that begin at the actual interrupted pose, with zero velocity and
acceleration at the ends of an uninterrupted transition. Temple taps use the
same angle convention as their opening pose; taps and wags fit complete
repetitions inside their hold. The audience's raised arms pivot at their
shoulders, and reduced motion holds each commanded pose. The lead's
`gestureSpeed: 1.55` gives him brisker transitions while retaining the same
anticipated cue landings; eighteen extra word accents keep his delivery busy.
Across the cast, upper sleeves attach at the collarbone and underarm instead
of rotating an outlined shoulder cap. Torso outlines sit beneath the joined
cloth, upper sleeves sit beneath costume details until crossing the chest,
and a shared lighting field runs through the elbow without a shaded joint
cap. A rounded shoulder leads into a narrow upper arm and a concave axilla.
Bare arms use one continuous surface through the elbow; forearm endpoints
follow the rotating hand's wrist edge. This follows the layered arms in
“Design It In”; vest armholes and costume trim remain distinct garment details.
Every hand view has a continuous authored silhouette, with the index beside
the thumb; overlapping finger tubes are not used. Palm-facing extended fingers
have creases rather than nails. Dorsal views have their own surface details.
Wrist outline widths match, and forearm shading fades into the hand. Curled poses use a palm-side
view: a sideways point puts the index above the three folded fingers, whose
distal joints disappear behind the palm; the thumb wraps across them. Power
grips use that same thumb/index relationship on both mirrored arms. Rolled
sleeves end above the exposed elbow, with their fold drawn inside the sleeve
surface rather than as a separate outlined cap. The bare elbow's outside
rounds the joint; its inside runs smoothly from the cloth opening to the wrist,
without a hidden return arc forming a hook at deep flexion. Long sleeves have
one continuous shoulder-to-wrist surface. A matching foreground forearm pass
handles torso occlusion, overlapping the base fill and suppressing internal
ink and stroke-cap nubs. Short sleeves cover the bare arm's proximal contour.
Sleeve folds are clipped to the moving cloth surface,
so bends cannot leave protruding corners or detached ink. The lead's drawn face adds
iris fibers and catchlights, moving eyelid contours, brow and moustache hairs,
ear folds, clipped hair strands, and a shaded lower lip. Joy raises the cheeks
while leaving the eyes open. One eye aperture controls its white, iris clip,
and lid edge through the entire blink. Closed mouths retain filled upper and
lower lips. Mouth opening separates those same curves, with teeth and tongue
clipped inside and the lower lip kept above the chin. The `turn` channel (−1…1) gives the lead a shallow head turn of up
to about 13 degrees, with gaze contributing a small amount. Its chin stays
anchored; the shared facial plane, projecting nose, hair mass, sideburns,
clipped cheeks, brows, and eyes move coherently. Ear parallax opposes the
front facial features, with subtle near/far foreshortening. The pose tracks
ease turns and restore them on backward seeks.

`figure({ reactions: [[from, to, facialFields]] })` holds an emotional beat
across gestures, with eased entrance and exit. My Teammate also sets
`expressWhileSinging: true` for its supporting cast: expressive complaints,
weary final lines, and ensemble singing ease back to relaxed listening faces.
Closely spaced words form phrases so the brows do not pulse with every
syllable. A facepalm or an earlier complaint cannot pin a silent listener's
mouth into a frown.
The worn hero renderer receives `smile`, `frown`, `misery`, `wide`, `happy`,
and `round` as well as the sung opening. Brows pivot around their measured
centres: inner ends lower for anger and lift for misery. The emotional
mouth remains active between words, and never hides the singing layer.
Optional numeric expressions preserve the separate named-reaction API used
by other songs. Inspect both the drawn export faces and actual worn heads;
the export stage alone does not exercise the live cast's SVG fits.
Cloth uses broad radial light and shade instead of hard polygonal facets;
clipped, softened highlights follow the arm contours through bends. Facial
shading stays subtle, with warm blush, tapered brows, and hair detail clipped
to its silhouette.
`HOLDING` specifies each prop's hand contact, object contact, grip, orientation,
and optional carrying pose. Persistent objects reserve their arm and the free
hand gestures; a resting hand never releases its fingers while retaining a
tool. Clipboards and palettes sit between supporting fingers and the thumb.
The mug stays upright, the cane's fixed shaft reaches the floor through an
adjusted supporting wrist, and the broom and stamp have coordinated working
strokes. During the refrain the lead walks to the desk, and the laptop base
follows the side-view supporting hand's contact through `figure.handPoint()`
throughout pickup, lifting and lowering. Compact fingers sit beneath the base
and the thumb overlaps its rim. Regression checks inspect the painted support
area and rim overlap rather than comparing two copies of a contact constant.
The required review is documented in
`.agents/skills/asset-creator/references/character/hand-arm-contact.md`.
`js/song-video/machine-kit.js` (styles in `css/song-video-machine-kit.css`)
draws the pictures: the coffee app on a giant phone, a shelf of package
versions and the new ones marching in, a clean-build machine, code cards
whose lines change in place, tests as clingy little cards, the Orders module
as a building with doors, a commit graph that squashes and force-pushes, a
folder swept into a commit, the public repo's cloud raining keys, server
racks, a climbing cloud bill, and the moral on the curtain. Each act places
its props in the room its singers leave: no prop drawn in front of a singer
may cover their face, and none covers the clock, the board, or another
prop's text (`tests/song-it-works-on-my-machine.spec.js` checks the faces,
every teammate's worn face, and the laptop raised on the Teammate's palm).

"Inspect and Adapt", a Scrum musical, is embedded in `SEBook/process/scrum.md`
after the Scrum Events section, as a consolidation of the chapter. It plays
in the `team-room` theme (`js/song-video/team-room.js`, styles in
`css/song-video-team-room.css`), the Found It team's office: a large display
fills a warm white wall under a team sign that names each section
(`TeamRoom.sign()`), with a floor-to-ceiling window over the city on the left
and, on the right, the team's task board (sticky notes held by magnets) and a
clock; downlights wash the wall, and a rug lies on the oak planks beside a
plant. The room moves gently all song, each motion slow, small, and posed from
song time (`animate()` in the theme): clouds drift past the window, the city's
lit windows glow up and down, the daylight shaft dims as clouds pass and creeps
across the floor with dust floating in it, the plant sways, a few notes stir,
and the clock keeps the song's time. Under reduced motion it holds still. Slides are laid out on the
display's logical 588 × 300 screen (`TeamRoom.SCREEN`) in a layer of their own,
`TeamRoom.slides(layers)`, behind the cast, which the display shows 1.2 times
larger (`TeamRoom.ZOOM`) round the screen's centre; `TeamRoom.toDisplay([x,
y])` turns a screen point into the stage point a singer points or presents at.
The choreography returns that layer so `scene.js` culls its pictures. The
opera cast performs there, and each role is drawn in the metaphor of the
CS 130 Scrum lecture. `opera-cast.js` dresses the
Scrum Master as `coach`, the team coach (a teal track jacket with white and
gold stripes down its sides and sleeves, a stand collar, and a whistle on a
lanyard, holding a clipboard), and the Product Owner as `navigator`, the value
navigator (a navy double-breasted sea coat with brass buttons and gold cuff
braid over a Breton shirt, a compass pin, and a spyglass prop); a costume's
`sleeveTrim(upper, fore)` adds the stripes and the braid. Three Developers wear
the UI Developer's apron, `coder`'s hoodie, and the Test Engineer's lab coat.
The New Developer, the main character, is the viewer's own SE Gym hero
(`heroHead`). Every other character is the gender of the voice that sings it,
measured on the take: a woman sings the Product Owner, a man the Scrum Master,
and a mixed choir the Developers, drawn as two men and a woman (the Test
Engineer). In the player each wears a random human hero's head restyled within
the gender (`castLook` in the choreography, through `castHead`): drawn once per
viewing and kept all song. On export stages each wears the drawn face for its
gender, where a figure's `gender: 'woman'` gives it a woman's face with long
hair.
`js/song-video/scrum-scenes.js` (styles in `css/song-video-scrum-scenes.css`)
draws the metaphors as slides: a header band with the role's emblem (a
whistle, a compass, a hard hat), its name, and its metaphor; a scene; and a
list of what the role is accountable for (✓) above a "Not" row. The coach's
scene is a basketball court seen from above, the Developers on it and the
coach on the sideline: they draw their own plays and huddle, a game clock runs
a timebox down, a project manager's pyramid gives way to a servant-leader's
inverted one, and the coach clears a wall from a player's path. The
navigator's is a sea chart whose compass reads Value: the user stories are
waypoints on a course ordered by value to the product vision, and an idea off
the course is not sailed to. The builders stack the Increment block by block.
The same module draws the chorus's temple (Empiricism on its three pillars)
and the role cards. In act one each role stands beside the display; from the
chorus on, the whole cast stands in a line downstage, in front of its lower
edge, each singer stepping forward toward the viewer, so the slides keep the
display's height above their heads.
`js/song-video/scrum-kit.js` (styles in `css/song-video-scrum-kit.css`)
draws the rest: the Sprint strip (a frame named Sprint holding its four
events, each with its icon and lit while it is sung, with the arrow back to
the start), the Scrum board (Product Backlog, Sprint Backlog, and Increment,
its empty slots drawn dashed, whose one-line story cards, each edged in its
kind's colour, move, swell, split, lock, and stack as the lyrics
move them, over an explanation bar that carries the coach's or the
navigator's emblem when they act), checklists ticked on cue, the quiz card
with its answer bar and emblem, and the intro's pictures. The Sprint loop is a
strip rather than an ArchUML state diagram because the diagram, even laid
out horizontally, only fits the space above the cast at about half size, too
small to read.

"Not a One-Time Investment", the design-with-reuse song, is embedded in
`SEBook/designprinciples/reuse.md` after the libraries-versus-frameworks
section, as a review of the chapter's cases. It keeps the lecture's own
metaphor for reuse, composing existing building blocks, all the way through,
in toy bricks. The `brick-site` theme (`js/song-video/brick-site.js`, colours
in `css/song-video-brick-site.css`) is a construction site at sunrise,
after the lecture's title picture: a twin-towered hall and a building going
up, brick courses in tan with blue and gold cornices, tiled roofs, toy window
pieces whose room lights fade as morning arrives, lamp posts, a tower
crane carrying a prebuilt module of bricks, and a studded baseplate as the
ground. The ground, studs, loose bricks, and lamps are present from the first
frame. The intro (`BUILD` in the theme) lays the ground-floor bases and
assembles the crane, which lifts its module during the instrumental.
The three refrains add lower floors, upper floors and tower shafts, then
belfries, roofs, and the site's final wall courses. Each brick course rises
under a clip path while the next brick drops into its slot. The hall's
staggered towers have separate milestones so pauses leave complete windows.
Finished floors hold between choruses; seeking backward restores the earlier
build. `SongScene` passes the authored `song` timing API to the theme alongside
`duration`, so construction follows the section boundaries. The crane places
its module in the outro. During explanations the forklift
holds still; the clouds drift gently as the sunrise continues. The buildings stay sharp
on either side of the central teaching area.
Selected illustration contours stay crisp; the hero has no surrounding halo.
The sky stays unobscured, with no broad dark scrim. Every pose is a function of song
time, so a seek shows the right stage of the build.
Gold section banners stay at the top left, clear of the central illustrations.
They provide the section heading without a second floating title brick.
`js/song-video/reuse-kit.js` (styles in `css/song-video-reuse-kit.css`)
draws open compositions: compact opaque plaques for text, self-contained
code/terminal screens, and coloured bricks directly over the site. Case
illustrations take turns in the 440px-wide space between the towers,
without scaling down their type. `focusPanel()` gives each illustration its
own lyric-timed windows and returns to causal diagrams when the song needs
them. The two benefit cards appear separately. Each checklist question
replaces the previous one beside its growing brick tower. Quiz questions
remain through the listening pause, then give way to their answer pictures
and green answer bricks.
Answer illustrations start their changes on the sung answer, so a version
update, module split, or framework call is visible rather than already
finished at the reveal. The Heartbleed fix date and passing tests hold before
their next picture. The left-pad column lands on its base after losing its
support; the application pivots on the surviving column. Text and brick
separation uses crisp outlines and hard offsets, without blurred shadows.
The outro switches from a shell command to a JavaScript example, then holds
its completed casebook through the final note.
Both Ariane launch platforms rest on the ground, with their names underneath.
The rockets stay full size: Ariane 4 rises out through the top of the frame;
Ariane 5 climbs roughly twice as fast into the low cloud bank, holds at the
overflow moment for the 37-second explanation, then veers and breaks apart
there. The breakup separates clipped sections of the actual rocket artwork
through an amber fireball, with rising smoke and fading embers. It resolves
before the comparison appears; reduced motion shows one settled breakup
illustration. Compact 16-bit and overflow labels accompany the continuous flight, without gauge
cutaways. `rocket()` takes a ground height and an authored centre destination
and arrival time, keeping the launch and explosion positions consistent.
A package is a brick whose studs are its interface; a brick
stacked on another depends on it, so the urllib3 tower tilts when version
2.0.0 brings different studs. The taller left-pad build uses individual blocks
in staggered courses; its right column drops when the tiny support goes.
Three compact build-error readouts sit below the platform while the tower
remains visible. A framework is a baseplate with a socket for your brick; the
refrain's questions each add a brick to a tower; principles and quiz answers
are bricks that snap on; and left-pad's own job is shown with bricks too
(`padColumn()`: padding bricks drop in on the left until a column of numbers
lines up on the right). One colour means one thing across the song: blue for
reused packages (and the case tabs and headings that file them), gold for
your own code and what is worth keeping, red for what breaks, green for what
is fixed or right, grey for a framework's structure. Code cards (JavaScript through the shared
`SongKit.highlightJavaScript`) turn off Fira Code's ligatures, so `===` and
`!==` read as typed. One continuous hero performs as the site foreman
(opera-cast.js's `foreman` costume: hi-vis vest, gold hard hat, tool pouch).
The hero stands on the right-hand construction tower, beside the crane.
The building and performer share the same course schedule: small steps land
as bricks reach the hero, and completed levels hold between choruses. The
hero remains on the finished tower for the outro. Reduced motion shows a
still performer on the completed tower. The shared word-timed singing rig follows the storyboard's marks,
resting during instrumental gaps and quiz pauses. Reduced motion keeps the
mouth neutral. The intro clipboard gives way to a gold brick for the finale.

The sky begins in cool blue hour with rose beneath the clouds. `sunriseAt()`
projects a uniformly advancing solar hour angle into an east-facing view at
34° north, for an illustrative morning with fixed declination. The sun rises
up and right; its elevation drives every lighting change. Rose and coral
intensify before the horizon crossing, then the upper sky clears to azure
while cloud undersides become peach and cream. Window reflections and brick
faces brighten, and stars, room lights, and lamps fade at elevation thresholds.
Only some rooms are lit in blue hour, with stable differences in brightness.
Their warm interiors have shaded recesses and darker floors; unlit panes
reflect the cool sky. Broad, subtle reflections replace diagonal shine marks.
Room lights fade smoothly at staggered dawn thresholds while the frames and
glass pick up daylight. Seeking restores the same room lighting.
The cloud treatment retains the security song's cool upper masses and warm
lower surfaces. A separate directional highlight turns toward the sun from
each bank's current position. Banks drift at slightly different speeds,
travelling less than five percent of the stage width over the song without
wrapping or jumping. Both their positions and light directions follow song
time. As in the Security song, thin wisps shear a little faster than the
clipped inner folds, while sunlit filaments remain anchored to the bank's
sun-facing light field. Small travelling ripples flex the cloud silhouettes,
with staggered phases and fixed tapered tips. Body, clipping edge, and lit
rim share the same contour so the shading stays attached. All cloud motion
remains fixed under reduced motion.
The changing palette follows
[NOAA's cloud-colour explanation](https://www.noaa.gov/jetstream/clouds/color-of-clouds).
UCLA blue and gold accent the construction and teaching bricks.
Reduced motion holds a settled morning pose. The transcript, audio description, and
playlist thumbnail must be regenerated when that visual story changes.

"Design It In Before They Break In", the security song, is embedded at the top of the Summary of
`SEBook/systems/security.md`, as a review of the whole chapter. It walks the
lecture's four-question security plan (security model, threat model, attack
surface, protection mechanisms), naming SQL injection and cross-site
scripting as separate attacks with one shared mistake, and its bridge retells
the 2026 Hugging Face case and its lessons. The `frontier` theme
(`js/song-video/frontier.js`, colours in `css/song-video-frontier.css`) is a
desert town at dusk built of computing. Its street opens with the four
services of verse 4, the lecture's example system: a general store, the post
office under a radio mast, a storehouse, and a barn, each with its icon on a
sign. All song long they are the town's evening silhouettes; verse 4 lights
them (`town.light`), and once each part has its own key the cable between them
thins and picket fences rise between them, to stay up for the rest of the song
(`town.compartments`), so the same buildings, wires, and fences serve both the
backdrop and the lesson. Past them stand a water tower whose tank is a database
cylinder, a false-front saloon that is a server rack, a store stacked from
software modules, and a router shack, all joined by one network cable that
runs behind the buildings (jacks on each) with data packets travelling it both
ways. Their status lights come on one by one as late golden hour turns
linearly into blue hour, then onward toward night. The shared sunset clock
runs at 88% speed from the same golden-hour starting point, placing blue
hour at about 49% of the song and retaining more afterglow at the end.
The sun follows a west-facing equinox path at 34° north, using a constant
solar hour-angle clock (88.8° to 99° before the shared 12% slowdown)
compressed into the song. The slower clock keeps the red disc visible longer
and the high clouds colourful through most of the song, ending in later blue hour.
Its disc warms from gold to orange-red and flattens near the horizon through
NOAA's standard-atmosphere refraction approximation. The disc is enlarged
1.5× for readability; it sets during the second minute. A local halo
follows the disc while a wider horizon afterglow fades with solar elevation.
Broad cloud banks have sun-facing amber and red-orange relief over cool
ambient shading. Their illustrative heights (1.6–11 km) determine when they
enter Earth's shadow: low clouds darken first, high banks retain the last
warm light, followed by a restrained scattered afterglow fading into blue-grey.
One steady wind carries the banks, with subtle shear in their wisps and
clipped internal folds. Lighting follows their current positions; seeking
recreates the same sky exactly. Reduced motion holds a
settled blue-hour sky. Geometry follows [NOAA's solar equations](https://gml.noaa.gov/grad/solcalc/solareqns.PDF);
the illustrated lighting follows the [WMO Cloud Atlas](https://cloudatlas.wmo.int/en/appearance-of-clouds-colour.html),
with art-directed colours rather than a full atmospheric scattering model.
The desert ground retains its dusty ochre and brown material
colours, with cooler, darker foreground shading instead of a blue overlay.
`js/song-video/western-kit.js` (styles in `css/song-video-western-kit.css`)
draws the pieces: the plan board with a pictogram per question and a stamp
per principle, its sung poster and principle lit in turn; wooden planks for
headings; slates for code (SQL and HTML through the shared
`SongKit.highlightSql` and `highlightHtml`); the lecture's post (slides
12–14) as a social-media post whose timestamp is the viewer's current date
and time; the login form; the app as a building whose ways in are its attack
surface (`appFront`); crimson attack vectors (`vector`) for attacks coming
in and amber trails for stolen data going out; a wanted poster for the threat
model; padlocks (hung on a wooden `lockBoard`, or drawn first as a blueprint
sketch), keys, the labels, keys, and permissions over the town's lit services
(`services`) and their database, the blast-radius
ring, and the app's porch, whose flowerpot can hide a key or a honeypot.
Code slates use paragraph-size type with deliberate line breaks. Travelling
arrowheads and cookies follow the same eased progress as their path strokes;
an opening padlock moves its steel shackle, outline, and reflection together.
The porch's clipped shingle roof, wood grain, recessed window, hinges, and
barrel hardware share the ambient night light; its lantern and window stay warm.
Its flowerpot has a rounded terracotta lip, soil and gravel, fine leaf veins,
and UCLA Blue petals with UCLA Gold centers. The whole plant remains inside
the pot's tipping group, preserving the outlaw's contact points.
The bridge's robot bubbles quote 38148c on finding working credentials:
two excerpts from page 35 of the August 2026 METR / Redwood report, labelled
as recorded thoughts, with the source also in the visual transcript.
`js/song-video/principle-scenes.js` (styles in
`css/song-video-principle-scenes.css`) shows each principle at work under its
stamp: a see-through padlock beside its published blueprint (Open Design), a
checkpoint that inspects every input (Zero Trust), and a key rack with one
narrow key per job and the admin master key retired (Least Privilege).
The checkpoint crates have brass straps and fasteners; the rack's keys have
distinct cuts, with separated, readable permission tags.
`js/song-video/sheriff.js` is the hero: a rigged sheriff (felt hat, leather
vest, star, bandana, boots, a gun belt with a holstered revolver it reaches
for but never draws) wearing the viewer's head, with two-bone arms and moves
(point, present, tip, hips, draw, nod, look, hold); the mouth opens on sung
words, from the storyboard's word marks. Its sleeve, forearm, hand, and
head silhouettes share warm brown ink, with finer lines inside the fingers.
Pointing rolls the hand to place the straight index along its upper edge,
with the other fingers curled below and the thumb across them.
The arms retain a slight elbow bend at full reach; tapered forearms follow
the wrist tangents. Gesture easing settles velocity and acceleration at
each endpoint, with a small shoulder-to-elbow-to-finger delay and a slower
release. Every contact pose still settles at its authored cue.
`js/song-video/outlaw.js` (styles in
`css/song-video-outlaw.css`) is the singer, the hired tester: a masked outlaw
in profile who sneaks along routes of stage points with a step cycle locked
to the distance travelled, adult limb proportions, grounded boots, relaxed
wrists, and continuous foot swings and turns. It freezes, reaches, lifts, types, shrugs, and
carries props (a laptop, a cookie jar for stolen cookies, a magnifier, a
loot sack, a honeypot jar), with a line of little robot AI agents (`bot`).
It appears wherever the song talks about an attacker, and in the closing
bars it falls for a honeypot under the flowerpot. Both figures share their
hands, built joint by joint, from `js/song-video/frontier-hand.js`. The outlaw's
blinks, breathing, cloth motion, and gesture oscillations hold still under
reduced motion; its keyed actions remain synchronized with the lyrics.
The sheriff's forearms follow the wrist edges without a seam across the palm;
held props sit between the palm and near fingers. The outro key flies in the
HUD layer, targeting the posed grip in the same frame, then transfers into
the hand without passing behind the torso.
Interrupted sheriff gestures start from the pose at the interruption. The
robot bandits ease into and out of their surprised poses; reduced motion
keeps those reactions still.

"Meet Me One Level Up", the coding-agent song for CS 35L Lecture 14 (Agentic
SWE), is only in the video library on `/SEBook/playlist.html`, so its player
page prints the transcript. The singer is the AI coding agent itself, just
out of training, telling the student how it was made and where the two of
them understand each other best: one level above the code, in requirements,
design, and tests. Its lyrics and learning design are in
`docs/meet-me-one-level-up-song-lyrics.md`. The `agent-campus` theme
(`js/song-video/agent-campus.js`, colours in `css/song-video-agent-campus.css`)
has two rooms: an old library, where the agent trains (the intro through the
first chorus), and a modern office with a glass mezzanine, where it works from
verse 3, the inference phase (`AgentCampus.switchAt(song)` cross-dissolves
them); `AgentCampus` also exports the floor line and the mezzanines.
`js/song-video/coding-agent.js` (styles in `css/song-video-coding-agent.css`)
draws the singer as a misplaced genius: a small chibi robot in a UCLA-blue
hoodie with a graduation cap set askew and a NEW badge on a lanyard, hovering
on a glowing pod, its face on a dark visor screen. `CodingAgent.agent()`
glides it along a `route`, plays named `moves` (wave, point, present, tap,
think, type, cheer, heart, shrug, nod, shake, tilt, scratch, beckon, bow,
hop, read, write, look, offer, spin, lecture, lost) and `faces` (happy, joy,
curious, thinking, worried, sheepish, surprised, wink, love, focused, smug,
confused) on sung words, puts props in its `holds` (book, pen, magnifier,
mug, card, wand), opens its mouth on the storyboard's word marks
(`CodingAgent.wordsOf()`), and reports a hand's grip (`handPoint()`). Its
gags fit the persona: a sparkle on the visor when it is smug or lectures
(with a light bulb), an antenna that curls into a question mark and a double
take when it is confused or lost, a sweat drop when it is sheepish or
worried, the cap hopping off in surprise, gears turning while it thinks, and
hearts on love. Hops and cheers squash and stretch, and the antenna and
tassel follow through. Every gag is a function of song time, and reduced
motion holds them still. The
choreography builds one agent for the whole song, after every scene, so it
stays in front of what it points at. `js/song-video/agent-kit.js` (styles in
`css/song-video-agent-kit.css`) draws the teaching pictures in one language:
cards (cream paper in the library, white in the office), dark code panels in
the shared syntax colours, pills, check and cross marks, and bubbles; the
lecture's phase strip (1 Pre-training, 2 Post-training, 3 Inference) lit for
verses 1–3; the weights as a brass slider console that freezes at inference;
the context whiteboard that rereads its items on every call and is wiped for
a new session; the free-shipping receipt; the photo folder whose files
overwrite each other; the abstraction ladder (assembly, source, design) with
its review lens; sequence diagrams in UML notation with lost replies; test
cards, the boundary number line, and padlocks; the bridge's accidental and
essential complexity and the seedling that grows when you try it yourself;
and `levels()`, the chorus picture used all four times: a code floor marked
10,000 lines, and one level up, Requirements, Design, and Tests, where the
student's and the agent's thoughts meet. Every example is told in full on
screen (setup, what went wrong, the rule), so the video teaches without the
slides. To keep the load down, the captions carry the sung words: a label
adds what the line does not say (a value, a result, a name for the picture)
and never repeats it, each label stays up long enough to read, and a scene
drops a picture once the song has moved past it. A verse ending on its punch
line keeps its picture through the next verse's first words (`HANDOFF` in
the choreography). The viewer's SE Gym hero sits at a laptop as the "you" the
agent sings to; on "meet me one level up" it rises with the agent, beside the
chorus's upper floor and onto the office mezzanine in the outro. The take's
three quiz questions are call and response on the shared quiz card.

A section's `delivery` sets its captions: `sung` and `spoken` lines are one
cue each, while `call` lines are quiz questions with an `answer` and
`answer_at`, captioned as two cues. A question the recording never answers
keeps its `call` line without `answer` and `answer_at`: it is one cue, and
the player makes no quiz pause for it. `answer` transcribes the recording;
`answer_code` optionally supplies an executable command for the shell quiz's
visual answer. An optional `pause_at` marks a safe stop between the question
and the first answer sound. Check it against the recording, including answers
sung as separate letters, and leave enough margin for playback at 2× speed.
Without it, the shared player stops 0.12 seconds before `answer_at`. A sung
call-and-response chant without separate answers, like the shell song's
command chant, is `sung`.

### The audio-described cut

The song has vocals almost throughout, so there is no room to describe the
picture over it. The described cut uses extended audio description instead:
before each section the picture holds while the narrator (the storyboard's
`narrator` voice for macOS `say`) reads the section's `narration`, then the
song resumes exactly where it paused. The held frames are symlinks to the
song's frames, so the cut costs no extra capture time. Narration text keeps
Git notation (`app.py`, `--amend`) for the captions; `spokenForm()` spells it
out for the voice, along with dotted IP addresses and any terms in the
storyboard's `narrator.pronounce` (for example `SYN-ACK: sin ack`).

| File | Role |
| --- | --- |
| `stage.html`, `stage.js` | Offline harness for the shared 960×540 CSS-pixel stage (captured at 2× = 1920×1080), with deterministic `seek(t)` |
| `../../js/song-video/scene.js` | Shared scene assembly, authored timing lookup, typography loading and disposal |
| `../../js/song-video/rounded-surfaces.js` | One-time Firefox rounded-border paint preparation for every song |
| `../../js/song-video/timeline.js` | Paused Web Animations posed by `seek(t)`, per-frame updaters, the beat grid, camera punches and shakes |
| `../../js/song-video/kit.js` | Builders for stickers, kinetic type, terminals, stations, paths and graphs; the Python, JavaScript, SQL, and HTML highlighters (`highlightPython()`, `highlightJavaScript()`, `highlightSql()`, `highlightHtml()`) and `writeCode()`, which every code card uses for the shared `.code-tok--*` syntax colours in `css/song-video-stage.css` |
| `../../js/song-video/virtual-clock.js` | Independent graph clocks; never replaces browser timers |
| `../../js/song-video/graph-track.js` | Retained graph transitions with deterministic seeking and disposal |
| `../../js/song-video/songs/<song>.js` | The choreography: what appears on which sung word |
| `../../assets/audio/<song>.m4a` | Shared soundtrack (normalized to about −16 LUFS with −1 dBFS peaks) |
| `captions.js` | WebVTT captions for both cuts, from the storyboard |
| `described-cut.js`, `wav.js` | The audio-described cut: narration, holds, frame order, soundtrack |
| `render.js` | Runs the whole pipeline |
| `../video-tools/check-flashes.swift` | WCAG 2.3.1 flash screen; a failure stops the render (shared with the SE Book teaser) |
| `../video-tools/encode-mp4.swift` | H.264 + AAC encoding with AVFoundation, no ffmpeg needed (shared with the SE Book teaser) |

### How GitGraph animations become video frames

The graph panels use the SE Book's own `js/git-graph.js`, so the video shows
the same commit pops, label glides, and merge bursts as the chapter's
command labs. GitGraph animates with real timers and CSS transitions, which a
frame-by-frame render can't wait for. Each graph owns an independent virtual
clock. `graph-track.js` retains the current transition during forward playback,
advances its timers to the requested moment, and seeks animations to their
exact age. A backward or discontinuous seek reconstructs the needed transition
once and releases the replaced graph. Four headless browsers can still capture
separate chunks of the song, and
transitions can play faster than on the page (`speed`, default 1.6×) to fit
the tempo.

## Preview

Start the `song-video-stage` server from `.claude/launch.json` (or run
`python3 -m http.server 4591` in the repo root) and open:

- `http://127.0.0.1:4591/scripts/song-video/stage.html?song=snapshots_and_pointers&play&fit`
  plays with the soundtrack (click to pause or resume)
- `…/stage.html?song=snapshots_and_pointers&t=61.5&fit` shows one still frame

## Render

```bash
node scripts/song-video/render.js snapshots_and_pointers
```

The full render captures about 7,400 frames with four headless browsers (a few
minutes), screens them for flashing, and encodes both cuts. It needs macOS with
Xcode Command Line Tools (`swift`), the storyboard's `say` voice, a Chromium for Playwright (set
`PLAYWRIGHT_CHROME_EXECUTABLE` to an installed Chrome if Playwright's own
browsers aren't installed), and
about 1.5 GB of temporary disk for the frames.

- `--stills 18.6,61.5 --out DIR` renders just those moments as PNGs, for
  checking a choreography.
- `--frames-dir DIR` keeps the frames; add `--skip-capture` to re-encode the
  frames an earlier run kept (for example after changing the bitrate).

A storyboard without `video` (like `unbox_the_stack`) plays only in the live
player. Its render skips the frames, the encode, and the poster, and writes
the captions and the audio-described track in under a minute; add
`--check-flashes` to capture the frames anyway and run the flash screen.

## Adding a song

1. Write and record the song (the `educational-songcraft` skill covers the
   lyric design), then align the lyrics to the recording. The first song's
   lines and `marks` came from Whisper word timestamps aligned to the lyric
   sheet; check them by ear, and caption what is actually sung.
2. Add `_data/songs/<song>.yml` with the same fields as
   `snapshots_and_pointers.yml` (including a `narration` per section and a
   `visual` per line), and a soundtrack under `assets/audio/`. Write the
   soundtrack with its index first (`moov` before `mdat`, "faststart"):
   Chrome failed to load a take whose index came last from Jekyll's server,
   with "FFmpegDemuxer: data source error". Quote `marks` keys in the
   YAML, since Jekyll's parser reads bare `on`, `no`, and `yes` as booleans.
   The chapter transcript is excluded from MathJax (`mathjax_ignore` in
   `_includes/song-video.html`), so lyrics may quote `$1` or `$?` as written.
3. Write `js/song-video/songs/<song>.js`, registering
   `window.SongChoreographies['<song>']`. Keep the teaching rule: every visual
   shows what the line sings, so the audio and transcript carry everything.
4. For live playback add a page with `layout: song-player`, `song: <song>` and
   its chapter transcript link (a song with no chapter leaves out
   `transcript`, and the player prints the transcript itself), then point the
   storyboard's `player` at it.
   Render, include the video in a chapter, add the song to `SONGS` in
   `tests/song-video.spec.js` (`standalone: true` for a song tested on its
   player page) (and to `songPlayers` in
   `tests/song-vector-art.spec.js`, and its question count to
   `scripts/tests/song-quiz-pause.test.js`), and load `css/song-video.css` on
   that page.
   Leave out `video`, `described_video`, and `poster` for a live-only song.

## Accessibility contract

- Both cuts have captions, on by default: the sung lyrics, naming the singer
  at each change of voice in a song with several, plus the narration in the
  described cut (WCAG 1.2.2).
- The audio-described cut describes each section before it plays, and the
  transcript gives every line with a description of what the video shows
  (1.2.1, 1.2.3, 1.2.5).
- Nothing autoplays, and the page loads no video data until someone presses
  play (1.4.2, 2.2.2).
- Frames pass the flash screen (2.3.1), and text drawn into the video keeps at
  least 4.5:1 contrast against the dark stage (1.4.3).
- Nothing essential sits in the bottom 80 CSS pixels of the stage, where the
  player draws captions.
- `tests/song-video.spec.js` checks both captions tracks, the transcript, and
  the served media; `scripts/tests/song-captions.test.js`,
  `scripts/tests/song-described-cut.test.js`, and
  `scripts/tests/song-video-virtual-clock.test.js` cover the caption
  builder, the described cut, and the virtual clock.
