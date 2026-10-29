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

## Files

| File | Role |
|---|---|
| `_data/explainers/<topic>.yml` | Storyboard: speech, scenes, cues, `slides`, `diagrams`, optional `languages`. |
| `_data/explainers/<topic>_quizzes.yml` | One check per scene id (a scene without an entry has none), or `questions:` for the summary. |
| `_data/explainers/<topic>_timing.json` | Written by the renderer: cue times, each cue's `speech_end`, and the storyboard's SHA-256. |
| `_data/video_narrations.yml` | Registry: name, summary, prerequisites, chapter and view paths, `parts`, `parts_label`, `animation`. |
| `_includes/video-narration.html` | The player; include it with `topic`. |
| `_includes/video-narration-reading.html` | Every cue with its panels: reading and print views, the transcript, and the source the player copies from. |
| `_includes/video-narration-slide.html` | One cue's slide (layouts below). |
| `_layouts/video-narration-stage.html`, `css/video-narration-stage.css` | The animation frame's page, and the stage's light and dark tokens. |
| `_layouts/narrated-pattern-reader.html` | Reading and print views of both lesson types (`video_narration: true`). |
| `js/video-narration.js` | The player adapter: panels per cue, copies settled panels, poses the stage. |
| `js/video-narration-stage.js` | Inside the frame: turns cues into song lines, builds the choreography, `seek(time)`. |
| `js/narrated-lesson.js` | Shared with the pattern lessons: diagram copies, code marks, section checks. |
| `css/video-narration.css` | The screen, panels, and slide layouts, in both themes and print. |
| `js/video-narration/<topic>.js`, `<topic>-kit.js`, `css/video-narration-<topic>.css` | The topic's choreography and artwork, loaded only in its frame. |
| `_data/explainers/<topic>_notes.yml` | Key points per cue for the printable notes. |
| `_layouts/video-narration-notes.html`, `_includes/video-narration-notes.html`, `css/video-narration-notes.css`, `js/video-narration-notes.js` | The printable notes: draws each cue's picture from the stage, then prints. |
| `_includes/video-narration-stage-assets.html` | The stage's styles, data, and scripts, shared by the stage frame and the notes. |

## The player

The lesson plays like a video. The video holds the scene's header (number,
part strip, title, and task), then a frame (`.vn-frame`) with the screen, the
captions (the narration text, on by default), and a control bar; below the
video come the cue's step and note and the scene's takeaway. Each part in the part strip is a button that jumps to the start of that part's first scene. The control bar
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

Full screen fills the display with the video, in the page's light or dark
colors: the scene's header, the picture letterboxed at 16:9, and captions and
controls in their own places, so nothing covers the picture. Where the screen
is at least 3:2 the header is a sidebar beside the picture (the picture is
limited by height there, so a sidebar costs less picture than a header row);
on a short, wide screen such as a phone on its side, the captions join the
sidebar and the picture takes the height above the controls; on narrower
screens the header is a row above the picture. A knowledge check opens inside
the full-screen video. Where the browser has no element full screen (iPhone
Safari) or refuses it, the shared transport draws the full screen itself: the
video fills the viewport, the page behind it is inert, and the button or
Escape returns. Both modes set `.is-fullscreen` on the video and send a
`narration-fullscreenchange` event, which the full-screen layout and the
control-visibility timer follow.

## Storyboard

A scene declares the panels it may show, and `show` lists the ones its cues
show by default; a cue may override `show` with one or two panels.

```yaml
- id: increment
  part: Artifacts            # one of the registry's parts; omit for intro and summary
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
every pose is a function of narration time. The registry's `animation` lists the
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

## Printable notes

The **Save lesson notes as PDF** button under the video opens `<views>/notes/#export`
(layout `video-narration-notes`, include `_includes/video-narration-notes.html`,
styles `css/video-narration-notes.css`, script `js/video-narration-notes.js`).
The page loads the narration's stage styles and scripts
(`_includes/video-narration-stage-assets.html`, the same list the stage frame
uses) and builds the stage once, out of view. For each cue it calls
`VideoNarrationStage.still(time)` at the cue's resting time: the stage poses
there, and a copy of it keeps the pose because every animated value is
written into the copy's inline styles, and ids are renamed per copy. The copy
replaces the row's description of its picture, which is what shows without
scripts. When every picture is drawn, the page opens the print dialog (the
`#export` hash), where readers save a PDF; its own button prints again.

Each row pairs the picture with the cue's key points from
`_data/explainers/<topic>_notes.yml` and ruled lines; each section's check
from `<topic>_quizzes.yml` follows as a row with room to answer, and the
answers, with each wrong option's feedback, close the notes. In print only
the lesson remains: three rows a Letter page, then the answers. Pictures
print at a fixed 3.6in (the stage at 0.36), so print layout needs no script.
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

## Adding a video narration

1. Write the storyboard and quizzes, and register the topic in
   `_data/video_narrations.yml`.
2. Render speech with `scripts/render-explainer-narration.py --topic <topic>`
   (add the topic to its `--topic` choices).
3. For animation, add `assets/video-narration/<topic>.html` (front matter
   `layout: video-narration-stage`, `topic`, `sitemap: false`), the choreography,
   its kit, and its stage CSS, and list them under `animation`.
4. In the chapter, link `song-video-fonts.css`, `narrated-explainer.css`,
   `narrated-pattern.css`, `narrated-pattern-document.css`, and
   `video-narration.css` before `print-light.css`, set `static_uml: true` if a
   diagram is used, and add `{% include video-narration.html topic="<topic>" %}`.
5. Add `read.html` and `print.html` under the registry's `views` path with
   `layout: narrated-pattern-reader`, `video_narration: true`, `topic`, and
   `{% include video-narration-reading.html topic=page.topic %}`.
6. Add the chapter to `tests/narration-fullscreen.spec.js`, and copy
   `scripts/tests/scrum-narration.test.js` and `tests/scrum-narration.spec.js`.
7. Write the key points in `_data/explainers/<topic>_notes.yml` and add
   `notes.html` under the `views` path (`layout: video-narration-notes`,
   `topic`, `permalink: <views>/notes/`, `sitemap: false`, and
   `{% include video-narration-notes.html topic=page.topic %}`). The button
   appears once the key points exist, and the notes tests cover every
   registered narration.

The `video-narration` skill covers how to author a lesson that teaches well.
