---
name: narration-authoring
description: >-
  Shared authoring format and runtime rules for ALL SEBook narrations: animated videos,
  design patterns, code explainers, and case studies. Read when creating or editing
  _data/narrations/*.yml, _data/narration_visuals/*.json, narration compilation, audio
  rendering, narration includes, shared player behavior, or editable PDF lesson notes
  (_data/explainers/*_notes.yml, narration-notes layout/includes, js/narration-notes.js).
  Also read the video-narration
  or design-pattern-narration skill for those kinds. Update this skill and
  docs/narration-format.md when the source contract or shared architecture changes.
---

# Shared narration authoring

Use the versioned data contract in [docs/narration-format.md](../../../docs/narration-format.md).
It includes a complete minimal lesson, field reference, commands, and extension boundaries.
Like tutorials, a new lesson supplies data and a page referencing its ID; do not clone a player.

## Source ownership

- `_data/narrations/<id>.yml` is the readable script. It owns `version: 1`, `id`,
  `kind`, `title`, `lesson`, `speech`, `media`, and ordered `scenes`. Spoken cues
  use `say: >-`. Keep accessible `visual` descriptions, explanations, predictions,
  citations, and case-study checkpoints beside the speech so reviewers can read
  the whole teaching sequence without navigating renderer code.
- `_data/narration_visuals/<id>.json` is the separate visual package. Its
  `presentation` selects assets, `resources` holds diagrams/slides/code metadata,
  and `scenes.<scene-id>` holds `state` and `cues.<cue-id>` rendering payloads.
  This JSON can be machine-generated; it does not need an author-friendly DSL.
  Bespoke animation choreography remains in referenced JS/CSS assets. Do not
  duplicate spoken words there or add timestamps to the readable script.
- IDs are stable identities. Keep a cue's ID when rewriting or moving it; never
  renumber existing `cue-1` names after inserting another cue. Use meaningful
  IDs for new material. Every scene and cue needs an entry in the visual package,
  even an empty state. Compiler errors must identify missing/dangling links.
- Keep optional `<id>_code.yml`, `_quizzes.yml`, and `_ui.yml` under
  `_data/explainers/` using their established schemas. Every lesson also needs
  `<id>_notes.yml` with concise, authored key points for each cue. Generated timing
  remains `<id>_timing.json`; MP3/captions/script remain under `assets/`.
- There is no authored `_data/explainers/<id>.yml`, `narrated_patterns.yml`, or
  `video_narrations.yml` registry. Do not recreate them. Jekyll provides those
  renderer-facing data views in memory from the canonical specification.

## Choose an existing kind

- `video`: animated stage, slides, diagrams, and optional code panels. A slide
  lesson needs no topic-specific JS. Animated artwork uses the song-video stage.
- `pattern`: four-language worked code, diagrams, optional live illustrations,
  and section checks. Read `design-pattern-narration` for its teaching structure.
- `explainer`: the Node.js/React artwork adapters with the shared transport.
- `case-study`: evidence and decision checkpoints, supporting narrated and
  self-paced investigation. Keep its decision controller in its adapter.

A new topic does not require a new kind. Add a new adapter only when a concrete
interaction cannot fit these contracts. Do not force distinct teaching flows
through conditionals in the transport.

## Shared core

`scripts/narration/compile.js` validates and compiles without IO. `source.js`
loads files and discovers topics. `scripts/narration.js` is the CLI used by
Jekyll, Python speech generation, tests, and CI. Never introduce another parser
or a checked-in compiled copy. `_plugins/narrations.rb` exposes compiled lessons.

Embed `{% include narration.html topic="<id>" %}` in the chapter. It selects
its adapter and styles; topic styles belong in `presentation.styles`. Set
`static_uml: true` when needed. Preserve light/dark styling and load print-light
last. Use each kind's reader/print conventions. The shared generator supplies
the editable notes view automatically; all views consume the same compiled story.

`narration-data.html` and `NarratedExplainer.readData` define one browser data
boundary. `NarratedExplainer.enhance` owns audio time, seeking, captions, motion,
speed, and fullscreen. Pattern/video adapters use `NarratedLesson.mount` for
section checks, navigation/focus, and language refresh; adapters supply cue
rendering only. Keep all players paused until explicit playback.

For lessons with parts, show the clickable two-level roadmap from the very
first frame, even when the introduction has no part. Preview the first part's
scene links without marking them current. Keep the actual current scene/part
marked accessibly, and preserve keyboard focus after a jump. Video fullscreen
keeps navigation horizontal on phones and laptops, compact controls, and
readable optional captions over the lower picture; see `video-narration`.

## Editable notes and PDF handouts for every kind

Every video, pattern, explainer, and case-study narration uses the shared
`_layouts/narration-notes.html` and `_includes/narration-notes.html`.
`_plugins/narrations.rb` generates a notes page at the compiled
`lesson.notes_url`: append `/notes/` to `lesson.views`, or to `lesson.chapter`
with a trailing `.html` removed. With neither set, the base is
`/SEBook/narrations/<id>`. An existing page at that route takes precedence;
keep any retained page as a thin delegate to the common include. Do not add
per-topic page copies or a notes registry.

`narration.html` adds **Save lesson notes as PDF** (`notes_url#export`) and
**Edit lesson notes** (`notes_url`). These apply to all nine current lessons,
not only Scrum. `js/narration-notes.js` prepares the visuals, restores and saves
student text, waits for fonts and settled pictures, then opens the print dialog
for `#export`. It is the sole notes lifecycle script. The reusable visual and
editor includes are `narration-note-visual.html` and `narration-note-editor.html`;
the common stylesheet remains `css/video-narration-notes.css`.

- Author `_data/explainers/<id>_notes.yml` as a mapping from
  `<scene.id>-<cue.id>` to one to four substantive bullets, each at most
  16 words. Preserve IDs when reorganizing. Existing Scrum notes alone may
  retain the legacy `<scene.id>-<one-based cue position>` fallback.
- Keep the whole handout's key points at most half the spoken word count,
  with no run of eight copied speech words. Retain taught terms, important
  qualifications, rules, and prediction questions. Do not leak the next cue's
  answer into a prediction row. Use inline `**bold**` for defined terms.
- Each cue has its settled visual, key points, and a labeled field for the
  learner's notes. Section checks and case-study checkpoints follow their
  section, with an answer/reasoning field; answers stay at the end. Reuse
  code, diagram, illustration, and explainer renderers. Do not flatten
  readable content into screenshots or reimplement the lesson in a handout.
- The code-language select affects the open handout only; it does not write
  a language preference. Keep authored bullets and student writing separate
  from the speech. Notes-only edits never require audio regeneration.
- Save on input under `sebook-narration-notes-<id>` as
  `{version: 1, entries: {"cue:scene/id": "text", "question:scene/0": "text"}}`.
  Cue keys use stable IDs; question keys use the scene and zero-based question
  position. There is no autosave toggle. Preserve editing and export when
  browser storage fails, with a visible status. Read `cookie-storage-tracker`
  for any persistence change and keep `/cookies/` deletion and `/settings/`
  disclosure aligned.
- Screen textareas mirror their plain text into paragraphs for print. Blank
  animated-stage handouts keep three rows per Letter page; non-video rows
  use content height. Populated student notes must grow across pages rather
  than clip, overlap, or shrink to preserve a row count. Keep ruled space for
  handwriting, light print colors, and editing controls out of print.
- Preserve semantic headings, labeled fields, visual descriptions, keyboard
  access, and no-script blank-handout reading/printing. PDF tagging depends
  on the browser. Inspect the PDF's text and reading order; a tags check does
  not establish complete PDF accessibility or full-site WCAG conformance.

Run `scripts/tests/narration-notes.test.js` and `tests/narration-notes.spec.js`
for all kinds; use the video notes suites for stage stills and blank-handout
pagination. Test saved text after reload, per-lesson isolation, deletion,
storage failure, long writing, code-language choice, and PDF export. Inspect
representative saved PDFs and keep verification artifacts outside the repo.

## Edit speech and regenerate

1. Edit `say`, `speech.pronunciations`, and pauses in the YAML. Captions retain
   written English; pronunciation replacements affect TTS only. Keep at least
   2.5 seconds of viewing silence before section checks, including the summary.
2. Run `node scripts/narration.js compile <id>` and
   `python3 scripts/render-explainer-narration.py --topic <id> --check`.
   These validate without loading Kokoro or writing media.
3. To render, omit `--check` and provide `--model /path/kokoro.onnx` and
   `--voices /path/voices.bin`. Use the existing installation and cache. Topic
   discovery is automatic. Regenerate audio, captions, script, and timing together.
4. Run `node scripts/narration.js check <id>`; omit the ID to validate all lessons.

The fingerprint includes ordered scene/cue IDs, written speech, pauses, voice,
speed, and pronunciation rules. Those changes require regeneration. Visual
state, illustrations, navigation labels, source citations, and visual-description
edits do not. Preserve written speech during structural refactors; prove old
and compiled content equivalent before retaining existing audio. Do not fake a
new fingerprint to bypass a substantive speech change.

## Verification

Run `scripts/tests/narration-spec.test.js`, the affected topic content tests,
and player/reader/print browser checks. Shared-core edits exercise every kind,
not just Scrum. Verify new data-only lessons through the real include and
adapter, not just compilation. Test stale speech detection and broken visual
references. Check fullscreen, touch, keyboard, quizzes, theme switching, reduced
motion, captions, and no-JavaScript reading alternatives. Run the scoped WCAG
complete audit; report its scope without claiming a full-site audit.

Update this skill, the kind-specific skills, and `docs/narration-format.md`
together when changing the contract or common lifecycle.
