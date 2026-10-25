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
backward seeks; nested words and cards retain their layout space.
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
`_includes/song-video.html` prints every line with its `visual` as the
on-page transcript.

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
the Object Decide", and `drafting-room` the architectural blueprint of
"Draw It Out While It's Cheap to Change" (cyanotype paper in UCLA Blue
with fold creases and a white grid, a bordered sheet with a title block, a plan fragment with dimension
lines, and drafting tools at the edges). A theme script registers itself
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
written yet) drive keyframed routes, brake, and dance on the beat, all as
pure functions of song time; `sprite()` draws one vehicle large with a hood
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
`js/ArchUML/uml-bundle.js` and `js/song-video/model-kit.js` (styles in
`css/song-video-model-kit.css`). `ModelKit.diagram()` renders a class,
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
`js/song-video/sketch-kit.js` (styles in `css/song-video-sketch-kit.css`)
draws the pictures beside the notation from the lecture's building
metaphors: a brick wall laid in a hurry around one crooked brick, four
teammates whose thought bubbles show different buildings
until a clear whiteboard drawing aligns them, a load-bearing wall, a floor
plan whose layers fade, an eraser, a coding-agent robot, a car whose wheels
outlive it, a house whose rooms do not, a shelf of software engineering
classics, an hourglass and a paper plane, library book #42 moving between
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
sung words, towards stage points: `point`, `tap`, `trace`,
and `sketch` aim the pencil (two-bone inverse kinematics, touching the point
when in reach); `check`, `cross`, and `circle` draw a tick, a cross, or a
ring in the air on the way to it; `inspect` leans in, pencil to chin;
`sight` holds the pencil out at arm's length; `think` brings the pencil
to the chin (the upper arm foreshortened as it comes forward); and
`present`, `aha`, `nod`, and `bow` round it out. `flip` moves the pencil to
the other hand. The architect stands wherever a scene leaves room beside its
content: it sketches the plan in the intro, circles the floor plan's pipes
and taps the flaw on paper in verse 1, thinks over whether a player is part
of a team and ticks off the safe association in verse 3, circles the
database where the bottleneck grows in verse 4, points out the ball and the
socket in verse 6, joins the first two choruses' opening lines, and in the
outro holds up the drawing, runs the pencil round the four diagrams between
the two hooks, and bows. The take sings its seven-question pop quiz as call
and response, all about one new system, a pizza app, on the quiz cards the
other songs use: a numbered card with the question and an answer bar that
slams in when the answer is sung. Every card is narrowed: a question about a
diagram shows that diagram beside it, changing when the answer lands, and
the others show the architect thinking it over, then ticking off, pointing
at, or circling the answer. Where the lyric sheet splits a sentence across
short lines to slow the singing, the storyboard keeps the sentence, or a
clause of a long one, as one line.

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
| `../../js/song-video/kit.js` | Builders for stickers, kinetic type, terminals, stations, paths and graphs; the Python highlighter (`highlightPython()`) and `writeCode()`, which every code card uses for the shared `.code-tok--*` syntax colours in `css/song-video-stage.css` |
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
   its chapter transcript link, then point the storyboard's `player` at it.
   Render, include the video in a chapter, add the song to `SONGS` in
   `tests/song-video.spec.js` (and to `songPlayers` in
   `tests/song-vector-art.spec.js`, and its question count to
   `scripts/tests/song-quiz-pause.test.js`), and load `css/song-video.css` on
   that page.
   Leave out `video`, `described_video`, and `poster` for a live-only song.

## Accessibility contract

- Both cuts have captions, on by default: the sung lyrics, plus the
  narration in the described cut (WCAG 1.2.2).
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
