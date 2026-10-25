# Shared player controls and playlists

Every page using `_layouts/song-player.html` gets the same picture gestures,
speed selector, captions, description track, and full-screen controls.
`controls.js` owns native media commands; `gestures.js` only interprets picture
activation (300 ms to distinguish a single click/tap from a double).
Keyboard/assistive activation of the native picture button is immediate.
Visible back/forward buttons offer the same five-second seeks without a gesture.
`keyboard.js` maps focus-scoped F, K, Space, and Left/Right to the shared
commands. Space controls playback even on the full-screen button; Enter keeps
native button activation. Editable fields, modifiers, links, and disclosures
retain their native keys. The public reference is `/shortcuts/`.

The native audio element remains the only clock. Setting both `playbackRate`
and `defaultPlaybackRate` changes the speed of the audio and every scene driven
by its current time, including after switching the description track. No song
choreography implements speed or controls.

## Adding a video or course playlist

1. Add the usual song storyboard in `_data/songs/` and its `song-player` page.
   The storyboard's `player` URL makes it appear in the playlist library;
   titles, durations, and credits are read from that same storyboard.
2. Add a record in `_data/song_playlists.yml` with a unique `id`, a `title`, a
   `description`, and ordered `songs` (storyboard filenames without `.yml`).
   The first course playlist supplies the initial student list. The browser
   never changes these authored defaults.

`playlist-model.js` owns pure ordering and saved-data validation.
`preferences.js` owns storage access. `playlist-page.js` renders edits and
keeps one-step Undo in memory. `playlist-player.js` owns the single player
iframe; `embed.js` retains shared sizing, theme, and full-screen behavior.
Previous/next song buttons follow the student's current order and are disabled
at the beginning/end (or for an empty list). A manual skip starts the selected song.

The player reports `song-player:ready`, `song-player:playing`,
`song-player:ended`, and `song-player:play-blocked` with its song ID. The playlist starts a selected video
using `song-player:play` with that ID. Both sides check origin and source;
song IDs prevent late events from a replaced video affecting the new one.
Playback starts only after a user action, continues in the current list order,
and stops after the last video. If a browser blocks playback (including the
next video), both the playlist and player ask the student to press Play in the
video. Loading another course list stops playback.

## Browser storage

- `song-player-speed`: a JSON number, one of 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2.
  Missing or invalid values use 1. Shared with the control on `/settings/`.
- `song-player-playlist`: `{ "version": 1, "songs": ["snapshots_and_pointers", "unbox_the_stack"] }`.
  Missing/malformed/unknown-version records use the first default playlist.
  Unknown IDs and duplicates are removed; an explicit empty list stays empty.
  No playback position, history, or media is stored.
- `song-player-quiz-pause` and `song-player-random-avatar`: JSON booleans set by
  the playlist's options (below). Anything but `true` means off.

Defaults are not written just by visiting. Save failures leave editing usable
for the current visit with an honest status message. Storage events update
other open pages. All four entries are documented and deletable at `/cookies/`.


Playlist-only options use validated same-origin messages to the current iframe.
`playlist-controls.js` owns optional previous/next toolbar buttons; standalone
players keep them hidden. The parent owns order and boundary availability.
`playlist-reorder.js` owns pointer capture, drop preview, edge scrolling, and
cancellation. Only a completed, changed drop edits the model, saves, and sets Undo.
Native Move up/down buttons remain the keyboard and single-pointer alternative.

The playlist checkbox stores `song-player-quiz-pause` (default false).
`quiz-pause.js` schedules a stop just before each line's `answer_at`, or at an
explicit `pause_at` if provided. New songs participate through their storyboard,
without their own control code. Playback speed and described-audio time mapping
are respected. Seeking forward skips passed questions; seeking back before its pause point
re-arms it. Manual Play continues past the stopped answer, and every later
question pauses again. Disabling the checkbox never starts playback by itself.
With this mode enabled, hiding the tab pauses playback because browsers throttle
background timers. Returning to the tab requires Play.

The playlist's Random avatar switch stores `song-player-random-avatar` (default
false). Unlike quiz pauses, it applies to every music video: each player reads it
when it loads and passes it to `SongScene.build` as `randomAvatar`. The playlist
also sends it with its other options, and a player whose value changes rebuilds
its picture at the current time, so the switch takes effect at once without
starting or seeking playback. With it on, `student-avatar.js` gives each
appearance of the viewer's hero a new random human hero from
`HeroAvatar.randomAvatar()`: every student cameo, and every entrance of a
character that wears the hero's head. A look stays while its character
remains on stage; seeking keeps it unless the character leaves and returns.
The saved hero is never read for display or changed.
