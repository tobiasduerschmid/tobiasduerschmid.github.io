# Narrated design-pattern lessons

Observer and State share one player: language-selectable code, ArchUML class,
state, and sequence diagrams, topic illustrations, and a knowledge check at the
end of every section. A lesson is data plus a few topic includes; the player,
reader, and print views are generic.

## Adding a lesson

1. Write `_data/explainers/<topic>.yml` (speech, scenes, cues, diagrams),
   `<topic>_code.yml` (Python, Java, C++, TypeScript blocks with focus lines),
   and `<topic>_quizzes.yml` (one entry per scene id).
2. Register the topic in `_data/narrated_patterns.yml`: name, summary,
   prerequisites, chapter and view paths, the complete-examples note, and a
   `visuals` map from scene keys to the includes that draw them.
3. Render speech with `scripts/render-explainer-narration.py --topic <topic>`
   (add the topic to its `--topic` choices). This writes the MP3, captions,
   TTS script, and `<topic>_timing.json`.
4. In the chapter, link `narrated-explainer.css`, `narrated-pattern.css`,
   `narrated-pattern-document.css`, and `<topic>-narration.css` before
   `print-light.css`, set `static_uml: true`, and add
   `{% include narrated-pattern.html topic="<topic>" %}`.
5. Add `SEBook/<path>/<topic>/read.html` and `print.html` with
   `layout: narrated-pattern-reader`, `topic: <topic>`, and
   `{% include narrated-pattern-reading.html topic=page.topic %}`.

## Storyboard features

- `scene.code`, `scene.diagram`, and `scene.cards` choose what a scene shows.
  Any key in the topic's `visuals` map, such as `ui: true`, adds that include;
  the include receives the current cue and reads its own cue fields.
- Diagrams accept `type` (`class` by default, `state`, or `sequence`).
  `cue.diagram_focus` hatches one class, interface, state, or lifeline.
  A diagram with `steps` lists lifelines in `source` and message groups in
  `steps`; `cue.diagram_steps` shows the first groups, so a trace can reveal
  messages only after a prediction.
- `scene.part` (`Context`, `Problem`, `Solution`, or `Consequences`) shows where
  the scene sits in the pattern description, in the player and the reader.
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
`js/narrated-pattern-document.js` handles the shared language preference and the
theme carried in view links; it is safe to load once per lesson on combined
course pages.

`js/narrated-explainer.js` stops for each section's check 0.3 s before the
section boundary, inside the silence after its last cue, because the next
section's speech begins exactly at the boundary. Every section must therefore
end with more than 0.3 s of silence (the renderer's default is 0.55 s).

The shared transport also adds the full-screen button to every narration
(Node.js, React, and the pattern lessons) where the browser supports element
full screen. The whole `.nja-player` fills the screen, so captions, settings,
and knowledge checks stay available. Diagrams need no refit: their readable
width is set in `em` and capped by the column, so they fit both layouts.

## Checks

Run each lesson's node test (`scripts/tests/<topic>-narration.test.js`) and
Playwright spec, plus `tests/wcag22-complete-audit.spec.js` for the chapter and
both views. `tests/narration-fullscreen.spec.js` covers full screen on every
narration page; add a new narration's page to its list. See
`docs/observer-animation.md` and `docs/state-narration.md` for the
topic-specific details.
