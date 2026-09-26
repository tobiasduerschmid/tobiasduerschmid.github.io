# SE Book teaser video

Render source for the 20-second teaser on the SE Book landing page (`/SEBook/`,
included via `_includes/sebook-teaser.html`). The published files live in
`assets/video/`; this folder is excluded from the Jekyll build.

## One script, many outputs

[`_data/sebook_teaser.yml`](../../_data/sebook_teaser.yml) is the storyboard and the
single source of truth. Each scene's `on_screen` text is drawn into the video,
its `sound` line captions the music, its `narration` is spoken in the
audio-described cut, and the page prints `on_screen`, `description`, and
`sound` as the transcript. Change text or timing there, then re-render.

| File | Role |
| --- | --- |
| `stage.html`, `stage.css`, `stage.js` | 1920×1080 motion graphics with a deterministic `seek(t)` clock; also emits timed sound cues |
| `audio/soundtrack.js` (+ `instruments.js`, `dsp.js`) | Synthesised instrumental score, arranged against the scenes and cues |
| `audio/narration.js` | Narration for the audio-described cut (macOS `say`) |
| `captions.js` | WebVTT captions for both cuts |
| `check-flashes.swift` | WCAG 2.3.1 flash screen; a failure stops the render |
| `encode-mp4.swift` | H.264 + AAC encoding with AVFoundation (no ffmpeg needed) |
| `render.js` | Runs the whole pipeline |

## Preview

Start the `sebook-teaser-stage` server from `.claude/launch.json` (or run
`python3 -m http.server 4590` in the repo root) and open:

- `http://127.0.0.1:4590/scripts/sebook-teaser/stage.html?play&fit` for a real-time loop
- `http://127.0.0.1:4590/scripts/sebook-teaser/stage.html?t=7.6&fit` for one still frame

## Render

```bash
node scripts/sebook-teaser/render.js
```

It takes about four minutes and needs macOS with Xcode Command Line Tools
(`swift`), the `Samantha` voice for `say`, Playwright's Chromium
(`npx playwright install chromium`), and network access for Google Fonts. Add
`--frames-dir DIR` to keep the PNG frames and WAV mixes for inspection. The
script prints both mixes' loudness (target −16 LUFS) and the flash-screen
result.

## Accessibility contract

- Both cuts have captions (WCAG 1.2.2). The instrumental cut captions the
  music; the described cut also captions the narration.
- The audio-described cut and the on-page transcript cover the visuals
  (1.2.3, 1.2.5). The render stops if narration lines would overlap.
- Nothing autoplays (1.4.2, 2.2.2), and the page loads no video data until
  someone presses play.
- Frames pass the flash screen (2.3.1), and on-video text keeps at least
  4.5:1 contrast against the dark background (1.4.3).
- `tests/sebook-teaser.spec.js` checks the captions, the transcript, and the
  served media.
