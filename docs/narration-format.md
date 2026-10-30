# Shared narration format, version 1

All narrated lessons use one source contract: Scrum's animated video, Observer,
State, Strategy, MVC, the Node.js and React explainers, and the Therac-25 and
Cloudflare investigations. They share compilation, audio timing, captions,
transport, fullscreen handling, and a browser data interface. Presentation
adapters retain their distinct teaching interactions.

## Files and ownership

| File | Authoritative content |
| --- | --- |
| `_data/narrations/<id>.yml` | Readable narration, scene order, navigation, teaching text, speech settings, media paths, and lesson metadata. |
| `_data/narration_visuals/<id>.json` | Renderer configuration, diagrams/slides, scene state, and cue state. This package can be machine-produced. |
| `_data/explainers/<id>_code.yml`, `_quizzes.yml`, `_ui.yml` | Optional code, assessments, and example behavior. |
| `_data/explainers/<id>_notes.yml` | Human-authored key points for every cue in the editable PDF handout. Required for every lesson. |
| `_data/explainers/<id>_timing.json` | Generated cue boundaries, stable cue IDs, and the speech fingerprint. Never author timestamps. |
| `assets/audio/`, `assets/narration/` | Generated MP3, captions, and pronunciation-adjusted script. |

The old combined `_data/explainers/<id>.yml` scripts and separate pattern/video
registries have been migrated. There is no checked-in compiled copy to keep in
sync. Jekyll compiles in memory and provides the renderer-facing
`site.data.explainers`, `site.data.narrated_patterns`, and
`site.data.video_narrations` views for the existing player and reading templates.

## A readable script

A minimal complete script is:

```yaml
version: 1
id: queues
kind: video
title: One request at a time
lesson:
  name: Queues
  parts: [Idea]
  parts_label: Lesson sections
  summary: See how a queue preserves arrival order.
  prerequisites: No programming prerequisites.
  chapter: /SEBook/concepts/queues.html
  views: /SEBook/concepts/queues
speech:
  voice: af_heart
  speed: 0.95
  pronunciations: {}
media:
  audio: /assets/audio/queues.mp3
  captions: /assets/narration/queues.vtt
  script: /assets/narration/queues.txt
scenes:
  - id: arrival
    label: Arrival order
    title: First in, first out
    part: Idea
    purpose: Follow the order of two requests.
    takeaway: A queue serves the earliest waiting request first.
    cues:
      - id: waiting
        say: >-
          Two requests arrive. The first request waits at the front of the
          queue. It is served before the second request.
        visual: Two requests labeled First and Second, in arrival order.
        step: Preserve arrival order
        note: The request at the front is served next.
        pause_after: 2.5
```

`kind` is `video`, `pattern`, `explainer`, or `case-study`. IDs must be lowercase
letters, digits, underscores, or hyphens, starting with a letter. Scene IDs are
unique within the lesson; cue IDs are unique within a scene. IDs are permanent
identities, not positions: retain them when moving or rewording a cue. The
migrated `cue-1`, `cue-2`, etc. are stable names; never renumber them after an
insertion. New cues should use meaningful names such as `waiting`.

`lesson` contains name, summary, prerequisites, chapter/views links, optional
parts/parts_label, and optional `outline_labels` keyed by scene ID. Pattern
lessons default to Context, Problem, Solution, Consequences. An introduction
without `part` previews the first part's links without marking them current.
Keep code-example notes (`complete_examples`) here too.
The compiler derives `lesson.notes_url` from `lesson.views`, or from
`lesson.chapter` with a trailing `.html` removed, then appends `/notes/`.
With neither link present, it uses `/SEBook/narrations/<id>/notes/`.

Scene teaching fields are `label`, `title`, `part`, `outline`, `purpose`,
`takeaway`, optional evidence/source references, and a case-study `checkpoint`.
Cue fields are `id`, `say`, `visual`, `step`, `note`, `source`, `prediction`, and
`pause_after`. `say` is the written speech and caption text. Pronunciations
modify only TTS output. A missing pause means 0.55 seconds; zero is permitted.
Keep the longer viewing pause before a quiz required by the narration skills.
Speech currently uses Kokoro's English (`en-us`) renderer.

## The visual package

The companion `_data/narration_visuals/queues.json` can be generated or edited
with tools independently of the speech:

```json
{
  "version": 1,
  "presentation": {},
  "resources": {
    "slides": {
      "queue": {
        "heading": "Arrival order",
        "layout": "cards",
        "items": [
          {"title": "First", "text": "Front of the queue"},
          {"title": "Second", "text": "Waits behind First"}
        ]
      }
    }
  },
  "scenes": {
    "arrival": {
      "state": {"slide": "queue", "show": ["slide"]},
      "cues": {"waiting": {}}
    }
  }
}
```

There must be exactly one scene entry and one cue entry for each script ID,
even when its state is `{}`. This makes removed, misspelled, and dangling
references errors instead of silent wrong pictures. Reordering the script
preserves its visual associations.

The compiler owns the envelope and prevents visual data from overriding speech
or teaching fields. Adapters own the payload:

- **Video:** `resources.slides`, `resources.diagrams`, language metadata, scene
  `show`/`slide`/`diagram`/`code`/`animation`, and cue highlight/animation state.
  Slides, diagrams, and code use the shared player without a new JS adapter.
  Bespoke artwork can declare `presentation.animation` with its frame page,
  theme, stylesheet paths, and ordered JS modules. Scrum's existing stage and
  choreography remain separate JS assets referenced by that package.
- **Pattern:** `resources.diagrams`, language/example metadata, scene code and
  illustration slots, cue focus/state, and `presentation.visuals`/`scripts`.
  Live illustrations keep their cue-event adapter; they do not own playback.
- **Explainer:** worked code and renderer poses. `presentation.renderer` names
  the existing Node.js/React artwork adapter. A new custom renderer provides
  the matching art include and script; use `video` for a data-only new lesson.
- **Case study:** diagrams and cue references; readable evidence, citations,
  and decision checkpoints remain in the YAML. Self-paced decision behavior
  remains in its case-study adapter.

`presentation.styles` lists topic-specific CSS modules. Common styles are
selected by kind, and print-light policy is loaded last. Visual packages are
local, trusted author assets; they are not an untrusted upload format.

## Add and edit a lesson

1. Add the YAML script and its JSON visual package. Use existing lessons for
   kind-specific examples. Add key points in `<id>_notes.yml` for every cue and
   optional quizzes/code using their existing schemas; do not invent a new
   quiz or code format.
2. Add a chapter using the shared entry point:
   ```liquid
   {% include narration.html topic="queues" %}
   ```
   It selects the adapter and styles from the specification. Add
   `static_uml: true` to the page if the lesson uses UML. Add the reader/print
   views described in the corresponding narration skill. Jekyll generates
   the notes page automatically; do not copy a per-topic notes page.
3. Validate before rendering audio:
   ```sh
   node scripts/narration.js compile queues
   python3 scripts/render-explainer-narration.py --topic queues --check
   ```
   These do not load the speech model or write audio. `compile` prints the
   resolved runtime JSON; omit the topic to compile all lessons.
4. Generate audio with the existing Kokoro installation:
   ```sh
   python3 scripts/render-explainer-narration.py --topic queues \
     --model /absolute/path/kokoro.onnx --voices /absolute/path/voices.bin
   node scripts/narration.js check queues
   ```
   There is no topic allowlist to update. The render command uses the same
   compiler as Jekyll. Unchanged spoken cues reuse its existing WAV cache;
   changed words render again, and all timestamps/captions are rebuilt.
5. Build, inspect inline/fullscreen/reader/print views in both themes, and run
   the relevant narration and accessibility tests. `check` without a topic
   validates all scripts and speech fingerprints; deployment runs it too.

A speech fingerprint includes ordered scene/cue IDs, written speech, pauses,
voice, speed, and pronunciation rules. Speech edits, reordering, and voice
changes require regeneration. Layout, artwork, navigation, source citations,
and visual-description edits do not. Existing audio was retained during the
migration after comparing every old runtime field; only timing metadata gained
cue IDs and the speech fingerprint.

## Editable lesson notes and PDF export

All nine lessons share the same handout: Scrum, Observer, State, Strategy,
MVC, Node.js, React, Therac-25, and Cloudflare. The public `narration.html`
entry point adds **Save lesson notes as PDF** (`lesson.notes_url#export`) and
**Edit lesson notes** (`lesson.notes_url`). The actions are navigation links
styled as buttons directly below each player, before tips, credits, and the
transcript. `narration.html` passes one shared `notes_actions` slot to every
adapter; keep its visual placement and document order aligned. The notes generator in
`_plugins/narrations.rb` creates the route using the `narration-notes` layout
and include. An existing page at that URL takes precedence; Scrum's retained
page delegates to the shared include. Do not maintain another lesson registry.

Write the handout's key points separately from speech:

```yaml
# _data/explainers/queues_notes.yml
arrival-waiting:
  - "**Queue order:** earlier arrivals go first"
```

The key is `<scene.id>-<cue.id>`. Preserve these identities when reordering
the lesson. Only existing Scrum notes retain the legacy
`<scene.id>-<one-based cue position>` fallback; use stable IDs for new notes.
Each cue needs one to four substantive bullets, at most 16 words each, with
at most half the narration's total word count and no run of eight copied
speech words. Keep taught terms, qualifications, rules, and prediction
questions; do not reveal a later cue's answer early. Inline `**bold**` marks
terms. Editing these notes never changes the audio fingerprint or requires
speech generation.

Each cue pairs its settled visual with those key points and a labeled field
for the learner's notes. Section checks or case-study checkpoints follow
their section with a field for an answer and reasoning; the answer key stays
at the end. Video lessons reuse `VideoNarrationStage.still(cue.end - 0.3)`;
other kinds reuse their diagram, code, illustration, or explainer renderer
through `narration-note-visual.html`. Never flatten readable code, diagrams,
or student writing into screenshots. The code-language control affects only
the open handout and does not change the site's saved language preference.
Non-video pictures include a visible description inside their image wrapper:
Chromium can omit an image's PDF tag when all its children are hidden from the
accessibility tree, so keep that description available in the exported file.

`js/narration-notes.js` owns visual preparation, export, and editable-note
persistence for every kind. After pictures and fonts settle, `#export` opens
the browser's print dialog; the page's print button can open it again. Each
input saves text and formatting to `localStorage` under
`sebook-narration-notes-<id>`:

```json
{"version":2,"entries":{"cue:arrival/waiting":{"html":"My <strong>note</strong>"},"question:arrival/0":{"html":"My reasoning"}}}
```

Cue entries use stable scene/cue IDs; question entries use the scene ID and
zero-based question position within that section. Empty fields are removed,
and an empty lesson record is deleted. There is no separate autosave toggle.
Saved text is restored on return; storage failures leave editing and export
available with a status message. `/cookies/#narration-notes` lists the records
with per-lesson and bulk deletion, and `/settings/` explains the behavior.
The optional Chrome profile sync extension follows its existing rules for
localStorage; the site does not receive the notes. Version 1 plain-text entries
are loaded literally, including any markup characters, and upgraded on the
first edit. Keep the existing storage keys and entry identities.

The shared `narration-note-editor.html` uses a labeled multiline rich-text
textbox with visible keyboard help, without formatting buttons. While a field
has focus, Cmd/Ctrl+B, I, and U toggle bold, italic, and underline;
Cmd/Ctrl+Shift+7 and 8 toggle numbered and bulleted lists. Preserve native
undo/redo and let Tab leave the field. Document shortcuts in `/shortcuts/`.
Only supported semantic markup is accepted from pasted or stored content;
discard executable content, attributes, and arbitrary styling. The print
mirror preserves that safe formatting and real list structure. Blank animated-stage
handouts retain three rows per Letter page. Non-video rows use their content
height, and rows with student writing can expand across pages rather than
clip text or shrink it to meet a row count. Ruled blank space remains for
handwriting. The handout uses the light palette, including from a dark-mode
page, and print omits editing controls, navigation, and the site footer.

Export begins with accessible HTML and uses the browser's PDF support;
tagging and reading order depend on that browser. Check labels, headings,
text alternatives, keyboard use, no-script fallbacks, saved text, and a
rendered PDF. A test finding PDF tags does not establish full PDF or full-site
accessibility conformance. Run `scripts/tests/narration-notes.test.js` and
`tests/narration-notes.spec.js` across all kinds, plus the video-specific
notes checks for stage stills and blank-page geometry. Keep generated PDFs
and verification screenshots outside the repository.

## Shared core and extension boundary

- `scripts/narration/compile.js`: pure validation/compilation and speech identity.
- `scripts/narration/source.js`: file loading and topic discovery.
- `scripts/narration.js`: CLI used by Jekyll, audio tooling, and CI.
- `_plugins/narrations.rb`: adapts compiled lessons to Jekyll data views.
- `_includes/narration.html`, `narration-data.html`: page/style entry and data contract.
- `_layouts/narration-notes.html`, `_includes/narration-notes.html`,
  `narration-note-visual.html`, and `narration-note-editor.html`: one generated
  editable handout for every lesson, with small kind-specific visual branches.
- `js/narration-notes.js` and `css/video-narration-notes.css`: shared handout
  preparation, local saving, print lifecycle, and screen/print layout.
- `js/narration-note-rich-text.js`: safe markup normalization and focused
  keyboard/paste behavior, using the local pinned DOMPurify dependency.
  Native editing commands preserve the browser's undo history; keep storage
  and export orchestration in `narration-notes.js`.
- `js/narrated-explainer.js`: shared audio clock, seeking, speed, motion,
  fullscreen, print lifecycle, and `readData` boundary for every adapter.
- `js/narrated-lesson.js`: common mounting, quiz lifecycle, navigation/focus,
  language refresh, diagram copying, and code highlighting for pattern/video lessons.
- The four presentation adapters own cue rendering and their distinct learning
  interactions. They do not reimplement the clock or parse a second source format.

`readData` accepts the older `data-np-*`, `data-explainer-*`, and `data-case-*`
attributes at this boundary so cached HTML survives a runtime update. New
templates always use `narration-data.html`; its common attributes take precedence.

Keep this boundary when extending the system. Prefer another lesson in an
existing kind over a new player. Add an adapter only for a demonstrated new
interaction, with a compiled contract and behavior tests. Do not move speech
into a visual package or hard-code a new topic in the audio renderer.
