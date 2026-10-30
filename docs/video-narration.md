# Video narrations

A video narration is a narrated lesson with one screen that shows, cue by
cue, an animated stage drawn with the song-video engine. It plays like a
video, with the music player's controls, and shares its transport, one
knowledge check per section, and the reading and print views with the
design-pattern lessons. The screen can also show a structured-text slide, an
ArchUML diagram, or code, for lessons whose storyboard defines `slides`,
`diagrams`, or `languages`; a lesson that animates should draw its structured
text and diagrams on the stage too, so the whole video keeps one style. The
first lesson is Scrum (`SEBook/process/scrum.md`), animated in all 49 cues.

Use a video narration for a topic that is explained with pictures and
structured text rather than one evolving code example (processes,
architectures, team practices). A design-pattern lesson
(`docs/narrated-pattern.md`) remains the right type for a pattern taught
through four-language code.

The versioned authoring contract and a complete minimal example are in
[`narration-format.md`](narration-format.md). Use the shared compiler and
`narration.html` entry point for every new lesson.

## Files

| File | Role |
|---|---|
| `_data/narrations/<topic>.yml` | Readable speech (`say`), scene order, teaching text, navigation, and lesson metadata. |
| `_data/narration_visuals/<topic>.json` | Separate renderer settings, slides, diagrams, language metadata, and scene/cue visual state. |
| `_data/explainers/<topic>_quizzes.yml` | One check per scene id (a scene without an entry has none), or `questions:` for the summary. |
| `_data/explainers/<topic>_timing.json` | Written by the renderer: cue times, each cue's `speech_end`, and the speech fingerprint. |
| `site.data.video_narrations` | Compiled compatibility view; metadata comes from the script’s `lesson` and the visual package’s `presentation`. Do not create a second registry file. |
| `_includes/narration.html`, `_includes/video-narration.html` | Public entry point and video adapter; pass `topic` to `narration.html`. |
| `_includes/narrated-lesson-navigation.html` | Shared two-level roadmap, visible from the opening frame. |
| `_includes/video-narration-reading.html` | Every cue with its panels: reading and print views, the transcript, and the source the player copies from. |
| `_includes/video-narration-slide.html` | One cue's slide (layouts below). |
| `_layouts/video-narration-stage.html`, `css/video-narration-stage.css` | The animation frame's page, and the stage's light and dark tokens. |
| `_layouts/narrated-pattern-reader.html` | Reading and print views of both lesson types (`video_narration: true`). |
| `js/video-narration.js` | The player adapter: panels per cue, copies settled panels, poses the stage. |
| `js/video-narration-stage.js` | Inside the frame: turns cues into song lines, builds the choreography, `seek(time)`. |
| `js/narrated-lesson.js` | Shared with the pattern lessons: diagram copies, code marks, section checks, and roadmap jumps with keyboard focus. |
| `css/video-narration.css` | The screen, panels, and slide layouts, in both themes and print. |
| `js/video-narration/<topic>.js`, `<topic>-kit.js`, `css/video-narration-<topic>.css` | The topic's choreography and artwork, loaded only in its frame. |
| `_data/explainers/<topic>_notes.yml` | Key points per cue for the printable notes. |
| `_layouts/narration-notes.html`, `_includes/narration-notes.html`, `css/video-narration-notes.css`, `js/narration-notes.js` | Shared editable handout for every narration kind: settles visuals, saves student writing locally, and prints. |
| `_includes/narration-note-visual.html`, `_includes/narration-note-editor.html` | Reuse each kind's visuals and provide labeled note fields with plain-text print content. |
| `_includes/video-narration-stage-assets.html` | The stage's styles, data, and scripts, shared by the stage frame and the notes. |

## The player

The lesson plays like a video. The video holds the scene's header (number,
part strip, title, and task), then a frame (`.vn-frame`) with the screen, the
captions (the narration text, on by default), and a control bar; below the
video come the cue's step and note and the scene's takeaway. The complete
clickable part strip stays visible on every scene, including the opening frame
before playback and the summary. Each part jumps to its first scene. The
second-level outline shows the current part's scenes; an overview without a
`part` previews the first registered part's scenes without marking either a
part or a scene as current. The control bar
has: position; play, back and forward 5 seconds, previous and
next scene, restart, and time; mute, volume, captions (CC), settings (scene,
speed, caption size, "Animate visuals", knowledge check, and code language
when there is code), and full screen.

The controls behave like the music player's because they reuse its modules:
`js/song-video/controls-visibility.js` (controls hide after 3 seconds of
playback in full screen and return on pointer, key, or tap),
`js/song-video/gestures.js` (click the picture to play or pause, double-click
its left or right half to skip 5 seconds), and `js/song-video/keyboard.js`
(K or Space, the arrow keys, 0 to 9, C, and F). They find the video, control
bar, and settings through the song player's class hooks, which
`_includes/video-narration.html` adds beside its own classes. Keys typed in a
knowledge check stay with the quiz.

Full screen keeps a horizontal, two-level roadmap across the top on laptops
and phones. Each level scrolls sideways when its labels do not fit; it never
becomes a sidebar or shrinks the text. The inline scene title and task remain
available to screen readers, while the roadmap identifies the fullscreen scene.
The 16:9 picture fills the space below the roadmap. Compact controls overlay
its bottom edge, and captions sit just above the controls on an opaque,
theme-aware background. Long or enlarged captions scroll within the overlay;
the CC button can reveal any artwork beneath them. A knowledge check replaces
the picture and overlays. Where the browser has no element full screen (iPhone
Safari) or refuses it, the shared transport draws the full screen itself: the
video fills the viewport, the page behind it is inert, and the button or
Escape returns. Both modes set `.is-fullscreen` on the video and send a
`narration-fullscreenchange` event, which the full-screen layout and the
control-visibility timer follow.

On touch screens held upright, `bindFullscreenLayout` rotates the inner
`.vn-surface` clockwise into landscape. It leaves the device's orientation
unlocked, works in both native and viewport fullscreen, and stops rotating
when the phone turns sideways. The **Landscape in full screen** checkbox in
settings lets viewers use portrait instead; its choice lasts for this page
visit. The layout uses the measured surface dimensions (including visual viewport
resizing), so a rotated phone gets the same horizontal roadmap and compact
controls as a sideways one. Settings
open in a bounded, scrollable panel without shrinking the picture. Knowledge
checks keep a visible fullscreen exit for touch users.

## Compiled storyboard

The following illustrates the **runtime** shape, not an authoring file. Put
readable scene fields and `say` in the YAML; put `show`, panel references, and
highlights in the JSON package, keyed by stable scene/cue IDs. The compiler
merges them and maps `say` to `text`.

A scene declares the panels it may show, and `show` lists the ones its cues
show by default; a cue may override `show` with one or two panels.

```yaml
- id: increment
  part: Artifacts            # one of lesson.parts; omit for intro and summary
  animation: true            # the animated stage is available
  slide: artifacts           # a key of `slides`; a cue may switch with `slide:`
  diagram: item_lifecycle    # a key of `diagrams`; a cue may switch with `diagram:`
  show: [animation]
  cues:
    - text: …                # speech and captions
      visual: …              # the screen's accessible name; the reading view's animation text
      show: [diagram, slide] # two panels sit side by side where the screen is wide
      slide_reveal: 3        # show the first three items
      slide_focus: increment # mark one item (border, fill, aria-current)
      diagram_focus: ProductBacklog
      diagram_steps: 0       # show the first n steps of a stepped diagram
```

Slide layouts (`_includes/video-narration-slide.html`): `cards` (default), `steps`
(numbered), `pillars` (`roof` and `base` around the items), and `table`
(`columns`, then `cells` per item; the first cell heads its row). Keep item text
to short phrases: the narration explains, the slide signals.

Code panels work as in the pattern lessons: the storyboard lists `languages`,
`default_language`, and `example_order`, `<topic>_code.yml` holds the blocks, a
scene names its `code` block, and cues name a `focus` key. The language control,
complete examples, and code panel appear only for lessons with `languages`.

## The animated stage

The stage runs in a same-origin frame (`/assets/video-narration/<topic>.html`,
layout `video-narration-stage`), so the song-video engine keeps its own
`Timeline` and styles away from the chapter, as the song player does. The frame
loads when the screen comes near the viewport. `js/video-narration-stage.js`
presents the narration to `SongScene.build` as a song: each scene a section,
each cue a line `<scene>-<n>` whose `marks` estimate when each word is spoken,
in proportion to the characters and pauses before it within the cue's speech.
A repeated word is keyed `word2`, `word3`, and so on.

The choreography registers `window.SongChoreographies[<topic>]` and draws only
for cues that show the animation. It uses the song kits (`kit.scene`,
`kit.sticker`, `kit.stamp`, `kit.confetti`, `StoryKit.card`) plus its own kit;
every pose is a function of narration time. The visual package’s `presentation.animation` lists the
stage theme and the styles and scripts the frame loads.

The stage follows the site's light or dark mode: `js/video-narration-stage.js`
mirrors the embedding page's `dark-mode` class onto the frame and keeps
following it. `css/video-narration-stage.css` holds the `--vn-*` tokens, dark
by default and light under `html:not(.dark-mode)`, re-points the song kit's
`--text` and `--muted`, and repaints the story wall in daylight. A topic's
artwork paints surfaces, lines, and text only with these tokens. The song
kit's confetti sits behind a picture's content; `ScrumKit.overlay(picture)`
gives a celebration a layer on top.

The parent player poses the stage at the narration time on every frame while
the animation is shown. With "Animate visuals" off (the default under
reduced motion), each cue shows one still picture, posed 0.3 s before the cue
ends. Until the frame is ready, or if it fails, a poster in the panel shows the
cue's visual description. The frame is `aria-hidden`; the screen's accessible
name is the cue's `visual`, and the reading and print views describe each
animated cue in words.

## Editable notes and PDF export

Every narration kind uses the same notes page. The shared `narration.html`
entry point supplies **Save lesson notes as PDF** and **Edit lesson notes**
links. Jekyll generates the `narration-notes` layout/include at the compiler's
`lesson.notes_url`: `lesson.views`, or `lesson.chapter` minus a trailing
`.html`, followed by `/notes/`. Export appends `#export`. New lessons need no
hand-authored notes route. The old `video-narration-notes` layout/include are
compatibility wrappers; `js/narration-notes.js` owns the shared lifecycle.
See [the shared format](narration-format.md#editable-lesson-notes-and-pdf-export)
for the notes schema, editable fields, local storage, and all-kind tests.

For an animated video, the page loads the stage styles and scripts
(`_includes/video-narration-stage-assets.html`, the same list the stage frame
uses) and builds the stage once, out of view. For each cue it calls
`VideoNarrationStage.still(time)` at the cue's resting time: the stage poses
there, and a copy of it keeps the pose because every animated value is
written into the copy's inline styles, and ids are renamed per copy. The copy
replaces the row's description of its picture, which is what shows without
scripts. After the fonts and pictures are ready, the shared script opens the
print dialog when `#export` is present; its own button prints again.

Each row pairs the picture with the cue's key points from
`_data/explainers/<topic>_notes.yml`, a labeled editable field, and ruled lines;
each section's check
from `<topic>_quizzes.yml` follows as a row with room to answer, and the
answers, with each wrong option's feedback, close the notes. Notes keys use
`<scene.id>-<cue.id>`; only the existing Scrum file uses the legacy positional
fallback. Each input autosaves under `sebook-narration-notes-<topic>`, with
deletion available in Browser storage. Printed student writing comes from
plain-text paragraphs mirrored from the textareas, so it remains readable
and can flow across pages.

In print only the lesson remains. Blank animated-stage handouts keep three
rows per Letter page, then the answers. Non-video handouts use content-height
rows; any row with student writing grows instead of clipping its text.
Blank-stage pictures print at a fixed 3.6in (the stage at 0.36).
The ruled lines are bordered spans, so they print without background
graphics; the pictures keep their colors with `print-color-adjust: exact`.
The notes always use the light palette, including when the site or operating
system prefers dark mode. Print CSS keeps the live HTML text and SVG artwork
as vector graphics: it disables filters and shadows, omits the decorative
plaster and ruled-paper textures, and gives confetti a solid paper color.
The remaining gradients, slide content, and layout are preserved. The notes
tests inspect every object in the generated PDF for raster images (including
images inside patterns and soft masks), and compare the light/dark PDF drawing
streams so a theme preference cannot change the printed artwork.
PDF export uses the browser's support for accessible HTML, including whatever
tagging it provides. Verify the saved file's text and reading order; the
presence of tags alone is not proof of PDF or full-site conformance.

## Adding a video narration

1. Write `_data/narrations/<topic>.yml` (`kind: video`), its companion
   `_data/narration_visuals/<topic>.json`, and optional quizzes. Follow
   `docs/narration-format.md`; discovery and registration are automatic.
2. Validate with `python3 scripts/render-explainer-narration.py --topic <topic> --check`,
   then render with `--model` and `--voices` pointing to the Kokoro installation.
   Run `node scripts/narration.js check <topic>` after rendering.
3. For animation, add `assets/video-narration/<topic>.html` (front matter
   `layout: video-narration-stage`, `topic`, `sitemap: false`), the choreography,
   its kit, and its stage CSS, and list them under `presentation.animation`
   in the visual package. Data-only slides need no stage page or choreography.
4. In the chapter, set `static_uml: true` if a diagram is used and add
   `{% include narration.html topic="<topic>" %}`. It selects the adapter and
   loads its styles, including `presentation.styles`, before `print-light.css`.
5. Add `read.html` and `print.html` under the script’s `lesson.views` path with
   `layout: narrated-pattern-reader`, `video_narration: true`, `topic`, and
   `{% include video-narration-reading.html topic=page.topic %}`.
6. Add the chapter to `tests/narration-fullscreen.spec.js`, and copy
   `scripts/tests/scrum-narration.test.js` and `tests/scrum-narration.spec.js`.
7. Write one to four concise key points per cue in
   `_data/explainers/<topic>_notes.yml`, keyed by stable scene and cue IDs.
   The shared generator supplies the notes page and both chapter links.
   Run the common notes tests and the video still/print checks. Inspect a
   blank handout and one containing long student writing; do not add a
   per-topic copy of the notes layout, script, or page.

The `video-narration` skill covers how to author a lesson that teaches well.
