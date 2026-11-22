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

## Songs paired with a narration

On a chapter page containing both a narration and its corresponding song,
the song video is the destination after the narration's final knowledge-check
quiz is completed (for example, Scrum → *Inspect and Adapt*). Preserve this
handoff when changing song embeds or players. Follow the shared
[narration completion rule](../narration-authoring/SKILL.md#transition-from-narration-to-the-chapter-song)
for feedback, explicit player pairing, playback, and keyboard focus. After
this handoff, **Previous song** restores the completed narration inside the
same frame, with song playback stopped. Both transitions retain fullscreen;
inline transitions replace the frame contents without scrolling elsewhere.

## Character anatomy and object handling

When changing character art or motion, follow the required
[hand, arm, sleeve, and contact review](../asset-creator/references/character/hand-arm-contact.md).
Treat this as a release gate for every affected main and supporting character,
including empty hands. Inventory the actual choreography, check both mirrored
sides and extreme/interrupted poses, and inspect rendered contacts in context.
Held objects need explicit grips and appropriate motion: cups remain upright,
canes meet the floor, tools stay enclosed by fingers, and supported loads stay
on the palm throughout travel. Do not independently animate an object and its
hand and check only their final alignment. Fix shared causes, add behavioral
regressions, and visually inspect the results before claiming completion.

For hand revisions, inspect the enlarged silhouette before shading: use coherent
palm/back views, no palm-side nails on extended fingers, and no intersecting
finger tubes or internal overlap outlines. Verify wrist ink and shading joins.
The contact solver must include the actual posed grip after wrist limits.

## Facial expressions

For character face changes, follow the required
[expression and head-turn review](../asset-creator/references/character/emotions.md).
Connect the same emotional controls to drawn and worn heads. Keep bright eyes
visible during joy, keep sung mouths visible during negative expressions,
and hold the speaking phrase's emotion through gesture resets. Return silent
listeners to relaxed resting faces. Closed mouths still need filled lips. Inspect maximum turns,
blinks, vowels, and nearby transition frames in the actual live player, as
well as export fallbacks. Verify deterministic seeks and reduced motion;
numeric containment checks supplement, rather than replace, visual review.
