# Narrated design-pattern lessons

Observer, State, Strategy, and Model-View-Controller share one player:
language-selectable code, ArchUML class, state, sequence, and CRC diagrams,
topic illustrations, and a knowledge check at the end of every section. A
lesson is data plus a few topic includes; the player, reader, and print views
are generic. The UML class-diagram lesson (`docs/uml-class-diagram-narration.md`),
the UML sequence-diagram lesson (`docs/uml-sequence-diagram-narration.md`),
the UML state machine diagram lesson (`docs/uml-state-diagram-narration.md`), and
the UML component diagram lesson (`docs/uml-component-diagram-narration.md`)
use the same player for notation rather than a pattern: each script declares
its own `lesson.parts`, which the player, reader, and print views show instead
of the pattern description's parts. A lesson whose visual package lists no
`languages`, like the component diagram lesson, shows no language selector
and no complete examples.

The readable script and separate visual package use the shared
[versioned narration format](narration-format.md), also used by videos,
explainers, and case studies.

## Adding a lesson

1. Write `_data/narrations/<topic>.yml` with `kind: pattern`, readable `say`
   cues, scene order, and teaching text. Keep the four-language blocks and
   checks in `_data/explainers/<topic>_code.yml` and `<topic>_quizzes.yml`.
2. Put name, summary, prerequisites, chapter/views paths, and complete-example
   notes in `lesson`. Put diagrams, visual state, and the `presentation.visuals`
   include map in `_data/narration_visuals/<topic>.json`. Discovery is automatic.
3. Validate using `python3 scripts/render-explainer-narration.py --topic <topic> --check`.
   Render with `--model` and `--voices`, then run `node scripts/narration.js check <topic>`.
   This writes the MP3, captions, TTS script, and `<topic>_timing.json`. Only
   changes to speech inputs or ordering require audio regeneration.
4. Set `static_uml: true` in the chapter and add
   `{% include narration.html topic="<topic>" %}`. It loads the shared styles
   and the JSON package’s `presentation.styles` before `print-light.css`.
   Such pages embed diagrams drawn at build time; an incremental
   `jekyll serve` redraws them after any ArchUML renderer change.
5. Add `SEBook/<path>/<topic>/read.html` and `print.html` with
   `layout: narrated-pattern-reader`, `topic: <topic>`, and
   `{% include narrated-pattern-reading.html topic=page.topic %}`.

## Storyboard features

The fields below describe the compiled runtime. Speech and teaching fields
come from the YAML; diagram definitions and render state come from the JSON
package’s `resources`, `scenes.<id>.state`, and `scenes.<id>.cues.<cue-id>`.

- `scene.code`, `scene.diagram`, and `scene.cards` choose what a scene shows.
  Any key in the topic's `visuals` map, such as `ui: true`, adds that include;
  the include receives the current cue and reads its own cue fields.
- `cue.focus` names a line list in the code block's `focus` map; the player
  marks those lines and scrolls to the first. A block's optional `scroll` map
  (`scroll: {<focus>: <line>}`) names the line to show instead when the marked
  lines do not fit the code window. The window shows about ten lines, and
  fewer at laptop widths, where the code column beside the diagram is about
  50 characters wide and long lines wrap.
- Diagrams accept `type` (`class` by default, `state`, `sequence`, `crc`,
  `component`, or a non-UML ArchUML type such as `freeform` or `folder-tree`).
  `cue.diagram_focus` hatches one class, interface, state, lifeline, or
  component; CRC cards and non-UML types cannot be highlighted. A diagram with `steps` lists lifelines in
  `source` and message groups (or CRC cards) in `steps`; `cue.diagram_steps`
  shows the first groups, so a trace can reveal messages only after a
  prediction.
- `cue.source` is a citation shown on screen below the explanation strip, in
  the player and the reader. It is never spoken: the narration text names no
  sources, which `scripts/tests/narrated-pattern-sources.test.js` checks.
- `cue.diagram` switches one cue to another diagram of the storyboard; the
  player updates the region's label and caption, and the reader shows the new
  diagram's caption where it first appears.
- `scene.part` (`Context`, `Problem`, `Solution`, or `Consequences`) shows where
  the scene sits in the pattern description, in the player and the reader.
- The player shows a clickable part strip and scene outline from its opening
  frame. Scenes without a `part` preview Context's scene links without marking
  a part or scene as current. Keep their `part` omitted. Optional
  `lesson.outline_labels` in the readable script maps scene ids to concise
  link labels; otherwise the scene's `outline` or `label` is used.
- A topic’s `presentation.scripts` list in the visual package loads files from
  `js/` before the player starts. Before replacing a visual for a new cue, the
  player dispatches a cancelable `narrated-pattern:cue` event on the visual's
  slot with `detail.settled` (the reading step's copy); a live illustration
  cancels it and moves itself to that cue's state. `js/mvc-dashboard.js` is the
  example.
- A quiz entry is one question, or `questions:` for a multi-question summary.
- `cue.prediction: true` hides the takeaway until the next cue; give such cues a
  `pause_after` silence.

## How the player works

`_includes/narrated-pattern-reading.html` renders every cue as a static reading
step: code with marks in all four languages, the diagram for that cue (rendered
at build time), and the topic illustrations. It is the reading and print views
and the chapter transcript. `js/narrated-pattern.js` derives the player's stage
from the current cue: it marks code lines in place and copies the matching
reading step's diagram and illustrations, so no topic needs its own script.
`js/narrated-lesson.js` holds what it shares with video narrations
(`docs/video-narration.md`): copying a cue's diagram, marking code lines,
section checks, and the `mount` lifecycle shared by both adapters. The roadmap markup comes from
`_includes/narrated-lesson-navigation.html`; jumps preserve playback state and
move keyboard focus to the matching control in the destination scene.
Shared styles apply to the `narrated-lesson` class, and the
reader layout serves both lesson types.
`js/narrated-pattern-document.js` handles the shared language preference and the
theme carried in view links; it is safe to load once per lesson on combined
course pages.

`js/narrated-explainer.js` stops for each section's check 0.3 s before the
section boundary, inside the silence after its last cue, because the next
section's speech begins exactly at the boundary. Every section must therefore
end with at least 2.5 s of silence, giving learners time to inspect the
completed picture before the check (ordinary cues default to 0.55 s).

The shared transport also adds the full-screen button to every narration
(Node.js, React, and the pattern lessons). The whole `.nja-player` fills the
screen, so captions, settings, and knowledge checks stay available. It uses
the standard or Safari's prefixed API; where neither exists (Safari on
iPhone) or the browser refuses, the player fills the viewport itself and makes
the page behind it inert until the button or Escape returns it. Style full
screen on `.is-fullscreen`, which both modes set, not on `:fullscreen`. Diagrams need no refit: their readable
width is set in `em`, and in the player and reader they scale down to the column by default
(`max-width: 100%`), so a wide diagram is never clipped in either layout. Keep lesson
diagrams narrow, so that scaling stays small and labels stay legible. A diagram with
teaching callouts inverts only its model layer in dark mode, as everywhere on the site.

## Checks

Run each lesson's node test (`scripts/tests/<topic>-narration.test.js`) and
Playwright spec, plus `tests/wcag22-complete-audit.spec.js` for the chapter and
both views. `tests/narration-fullscreen.spec.js` covers full screen on every
narration page; add a new narration's page to its list. See
`tests/narration-navigation.spec.js` for opening-frame navigation, keyboard
jumps, focus, and mobile reflow checks across both lesson types. See
`docs/observer-animation.md`, `docs/state-narration.md`, and `docs/strategy-narration.md` for the
topic-specific details, and the `design-pattern-narration` skill for how to
author a lesson.
