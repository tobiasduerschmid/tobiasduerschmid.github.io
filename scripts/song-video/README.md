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
existing SE Gym hero appearance for optional student-at-laptop cameos; it never
saves or changes that appearance. Missing or unavailable saved data uses the
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
The shared scene preparation detects rounded CSS borders, including pseudo
elements, and paints each as a single surface in Firefox. No scans run during
playback; SVG paths and other browsers retain their existing rendering.

## One storyboard, many outputs

`_data/songs/<song>.yml` is the single source of truth. Each lyric line has
its timing (`start`, `end`), the times of the words the visuals hit
(`marks`), the sung `text`, and a `visual` description of what the video shows
for it; each section has a `narration` for the audio-described cut. The
choreography draws against `marks`, `captions.js` turns the lines into
WebVTT, `described-cut.js` builds the described cut from the `narration`s, and
`_includes/song-video.html` prints every line with its `visual` as the
on-page transcript.

Two optional fields let a song bring its own look. `theme` picks the stage
backdrop from `SongKit.themes` (default `studio`, the aurora; `night-sky` is
the starry sky of "Unbox the Stack"). `extras` lists the song's own
stylesheets and scripts (`styles`, `scripts`), which both the live player
and the export stage load, in order, before the choreography; the networking
song uses them for `night-sky.js`, its illustrations in `js/song-video/art/`,
and `net-kit.js`. The illustrations are live vector art: shapes, gradients,
and patterns, without filters or bitmaps. `net-kit.js` writes each drawing
into the page once as an SVG `<symbol>` and shows every copy with `<use>`.

"Small Tools, One Job Each", the shell song on `SEBook/tools/shell.md`, keeps
the studio backdrop and brings `js/song-video/shell-kit.js` with
`css/song-video-shell-kit.css`. Each of its pieces draws one visual metaphor
beside the real notation: scissors that cut a command line at its spaces
(with tape for quoted words), a filing cabinet for `PATH`, a map for the
directory tree, a conveyor belt of machines for a pipeline, an address label
for the shebang, a padlock for execute permission, a decision diamond for
`if`, a rubber stamp for a `for` loop, a boom gate for `&&`, and collectible
cards that fill a toolbox in the command chant. Pieces that need a word's
position measure it on the first visible frame, because the live player
builds the scene before it shows the picture.

A section's `delivery` sets its captions: `sung` and `spoken` lines are one
cue each, while `call` lines are quiz questions with an `answer` and
`answer_at`, captioned as two cues. `answer` transcribes the recording;
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
| `../../js/song-video/kit.js` | Builders for stickers, kinetic type, terminals, stations, paths and graphs |
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
