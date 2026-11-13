# Always Code karaoke

The playlist entry `always_code` uses the user's twelve replacement lyric lines
unchanged. It is instrumental karaoke, not a generated vocal performance.

## Audio edit

Source: the supplied `Rick-Astley-SnapYT.App.mp4`, a Sing King karaoke video.
The opening sound ends around four seconds, followed by silence. The backing
track starts around 10.7 seconds. Keep source seconds **10.65–70.95** for the
instrumental intro, first verse, and first chorus (60.30 seconds total).
Apply a 12 ms entrance fade and a one-second exit fade; export AAC at 192 kb/s
with the MP4 index first. The source remains untouched.

Phrase starts follow the source video's visible karaoke cues. Word highlights
are proportional guides within those phrases: there are no recorded vocals to
force-align. The beat grid is an approximate dance guide, not an audio-analysis
measurement. Lyrics, timings, visual alternatives, and narration live in
`_data/songs/always_code.yml`.

## Live SVG playback

The existing song player supplies pause, seek, captions, lyrics-only mode,
reduced-motion handling, and an extended audio-description track. The latter
reads the replacement lyrics and describes the illustrations before each
section. Saved custom playlists retain their order; the library and the CS 35L
default playlist include the new song.

The headphone-wearing terminal accompanies twelve separate SVG concept scenes.
Each scene cuts in exactly at its lyric's `start` time; there are no crossfades
or props carried over from the previous line. All scene poses derive from the
shared audio clock, including backward seeks. Reduced-motion mode shows each
scene's settled state. Lyrics remain HTML text with a word highlight and
underline. There is no rendered video or poster.

The system-view lyric uses a UML sequence diagram, generated with ArchUML from
`docs/always-code-sequence.puml`. `js/song-video/always-code-sequence.js` retains
its participant positions, call/return arrow notation, and activation extents;
vertical whitespace is compressed to fit the illustration area and CSS owns
its typography and colors. Calls and returns appear in chronological order.
The other line-specific scenes live in `js/song-video/always-code-scenes.js`.

Regenerate captions and described audio using:

```sh
node scripts/song-video/render.js always_code
```

Set `PLAYWRIGHT_CHROME_EXECUTABLE` to an installed Chrome when the bundled
browser is unavailable. Add `--check-flashes` to screen the live choreography
frame by frame without publishing a rendered video.

The stage is deliberately dark in both themes. Its text remains real text in
the browser; the shared player provides unscaled captions and a transcript for
small screens. No new browser storage or keyboard shortcuts are introduced.
