---
name: song-video
description: Project rules for educational song videos — `_data/songs/*.yml` storyboards with a `player`, their choreographies under `js/song-video/songs/`, themes and kits under `js/song-video/`, song-player pages under `assets/song-player/`, and their entries in `_data/song_library.yml` and `_data/song_playlists.yml`. Use when adding, restyling, or shipping a song video. Not for video narrations (see video-narration).
---

# Song videos

The engine, storyboard format, render pipeline, and tests are documented in
`scripts/song-video/README.md`; the playlist library in
`docs/song-playlists.md`. This skill keeps the rules that are easy to forget
when a song ships.

## Every song ships with a playlist thumbnail

A song with a `player` appears in the SE Book playlist library. Without a
thumbnail its card shows an empty grey box, so before a song ships:

1. Render candidate frames:
   `node scripts/song-video/render.js <song> --stills t1,t2,… --out DIR`.
2. Pick a frame that shows the song's central idea, in a settled pose (no
   mid-animation blur), with a clear composition that still reads at card
   size.
3. Record it as `thumbnail_time` in `_data/song_library.yml`, and export that
   frame as a 640×360 WebP to `assets/song-playlist/<song>.webp`
   (`docs/song-playlists.md`, step 2).
4. Commit the WebP with the song. Re-export it whenever the scene's art
   changes.
