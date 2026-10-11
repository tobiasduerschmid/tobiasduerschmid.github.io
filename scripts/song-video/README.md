# SE Book song videos

Render source for the music videos in SE Book chapters. The first one is
"Snapshots and Pointers", the Git song on `SEBook/tools/git.md`, embedded with
`{% include song-video.html song=site.data.songs.snapshots_and_pointers %}`.
The published files live in `assets/video/`; this folder is excluded from the
Jekyll build.

## One storyboard, many outputs

`_data/songs/<song>.yml` is the single source of truth. Each lyric line has
its timing (`start`, `end`), the times of the words the visuals hit
(`marks`), the sung `text`, and a `visual` description of what the video shows
for it; each section has a `narration` for the audio-described cut. The
choreography draws against `marks`, `captions.js` turns the lines into
WebVTT, `described-cut.js` builds the described cut from the `narration`s, and
`_includes/song-video.html` prints every line with its `visual` as the
on-page transcript.

### The audio-described cut

The song has vocals almost throughout, so there is no room to describe the
picture over it. The described cut uses extended audio description instead:
before each section the picture holds while the narrator (the storyboard's
`narrator` voice for macOS `say`) reads the section's `narration`, then the
song resumes exactly where it paused. The held frames are symlinks to the
song's frames, so the cut costs no extra capture time. Narration text keeps
Git notation (`app.py`, `--amend`) for the captions; `spokenForm()` spells it
out for the voice.

| File | Role |
| --- | --- |
| `stage.html`, `stage.css`, `stage.js` | 960×540 CSS-pixel stage (captured at 2× = 1920×1080) with a deterministic `seek(t)` |
| `timeline.js` | Paused Web Animations posed by `seek(t)`, per-frame updaters, the beat grid, camera punches and shakes |
| `kit.js` | Builders for stickers, stamps, kinetic type, the terminal, Git stations, file chips, flow arrows, snapshot cards, GitGraph panels, the Time Stone, confetti |
| `virtual-clock.js` | Replaces the page's timers so GitGraph's own animations run on song time |
| `graph-track.js` | A GitGraph panel that steps through Git states and poses GitGraph's real transition animations at any `t` |
| `songs/<song>.js` | The choreography: what appears on which sung word |
| `songs/<song>.m4a` | The soundtrack (the recording, normalized to about −16 LUFS with −1 dBFS peaks) |
| `captions.js` | WebVTT captions for both cuts, from the storyboard |
| `described-cut.js`, `wav.js` | The audio-described cut: narration, holds, frame order, soundtrack |
| `render.js` | Runs the whole pipeline |
| `../video-tools/check-flashes.swift` | WCAG 2.3.1 flash screen; a failure stops the render (shared with the SE Book teaser) |
| `../video-tools/encode-mp4.swift` | H.264 + AAC encoding with AVFoundation, no ffmpeg needed (shared with the SE Book teaser) |

### How GitGraph animations become video frames

The graph panels use the SE Book's own `js/git-graph.js`, so the video shows
the same commit pops, label glides, and merge bursts as the chapter's
command labs. GitGraph animates with real timers and CSS transitions, which a
frame-by-frame render can't wait for. For each frame, `graph-track.js`
rebuilds the panel from the previous state, settles it, renders the target
state, runs GitGraph's timers on the virtual clock up to the frame's moment,
and seeks every CSS animation to its exact age. Each frame is a pure function
of `t`, so four headless browsers can capture separate chunks of the song, and
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
browsers aren't installed), network access for the stage's Google Fonts, and
about 1.5 GB of temporary disk for the frames.

- `--stills 18.6,61.5 --out DIR` renders just those moments as PNGs, for
  checking a choreography.
- `--frames-dir DIR` keeps the frames; add `--skip-capture` to re-encode the
  frames an earlier run kept (for example after changing the bitrate).

## Adding a song

1. Write and record the song (the `educational-songcraft` skill covers the
   lyric design), then align the lyrics to the recording. The first song's
   lines and `marks` came from Whisper word timestamps aligned to the lyric
   sheet; check them by ear, and caption what is actually sung.
2. Add `_data/songs/<song>.yml` with the same fields as
   `snapshots_and_pointers.yml` (including a `narration` per section and a
   `visual` per line), and `songs/<song>.m4a`.
3. Write `songs/<song>.js`, registering
   `window.SongChoreographies['<song>']`. Keep the teaching rule: every visual
   shows what the line sings, so the audio and transcript carry everything.
4. Render, include the video in a chapter, add the song to `SONGS` in
   `tests/song-video.spec.js`, and load `css/song-video.css` on that page.

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
