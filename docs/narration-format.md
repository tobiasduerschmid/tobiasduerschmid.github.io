# Shared narration format, version 1

All narrated lessons use one source contract: Scrum's animated video, Observer,
State, Strategy, MVC, the UML diagram lessons, the Node.js and React explainers,
and the Therac-25, Cloudflare, and Hugging Face case studies. They share
compilation, the player's scene display, fullscreen handling, and a browser
data interface; lessons with rendered speech also share audio timing,
captions, and the transport. Presentation adapters retain their distinct
teaching interactions.

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
  voice: drama3-female6
  speed: 1
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

A `case-study` lesson may omit `media` while its speech is not yet rendered.
Such a text-only lesson keeps the same `say` text, fingerprint, and decisions,
but it has no audio, captions, script, or timing file. Its player offers
step-by-step cue navigation, decisions, scene review, and full screen through
`NarrationTransport.mount` in text-only mode, and `node scripts/narration.js check`
reports it as text only instead of requiring timing. A text-only lesson that
still has a timing file is an error. To add narration later, add the `media`
block and render the audio as described below. Other kinds always need `media`,
because their players depend on the audio clock.

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
`speech.voice` names the voice, and through it the speech engine; see
[Speech engines](#speech-engines). Every lesson uses `drama3-female6`.

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
   `jekyll serve --incremental` rebuilds a page when the narration it names
   changes: its script, visual package, or `_data/explainers/<id>_*`
   companions. A page names a narration with `topic="..."` on an include, as
   above, or with `topic:` or `narration:` front matter, as the reader, print,
   notes, and stage views do (`_plugins/data_regenerator.rb`). Name the topic
   one of these ways in any new view that reads narration data, or incremental
   builds keep serving its old content.
3. Validate before rendering audio:
   ```sh
   node scripts/narration.js compile queues
   python3 scripts/render-explainer-narration.py --topic queues --check
   ```
   These do not load the speech model or write audio. `compile` prints the
   resolved runtime JSON; omit the topic to compile all lessons.
4. Generate audio with a running Drama 3 server (see
   [Speech engines](#speech-engines)), review the cues it lists, and check:
   ```sh
   python3 scripts/render-explainer-narration.py --topic queues
   node scripts/narration.js check queues
   ```
   There is no topic allowlist to update. The render command uses the same
   compiler as Jekyll. Unchanged spoken cues reuse the cue cache in
   `~/.cache/sebook-narration/<topic>`; changed words render again, and all
   timestamps and captions are rebuilt.
5. Build, inspect inline/fullscreen/reader/print views in both themes, and run
   the relevant narration and accessibility tests. `check` without a topic
   validates all scripts and speech fingerprints; deployment runs it too.

A speech fingerprint includes ordered scene/cue IDs, written speech, pauses,
voice, speed, and pronunciation rules. Speech edits, reordering, and voice
changes require regeneration. Layout, artwork, navigation, source citations,
and visual-description edits do not. Existing audio was retained during the
migration after comparing every old runtime field; only timing metadata gained
cue IDs and the speech fingerprint.

## Speech engines

`scripts/render-explainer-narration.py` resolves `speech.voice` with
`scripts/narration_speech/voices.py`. A folder
`scripts/narration_speech/voices/<id>/` holding a `voice.json` registers a voice
and names its engine; any other ID is a Kokoro voice. The renderer caches each
cue's chosen clip under the speaker's identity and the spoken words, so an edit
re-renders only the cues it changed, and every other cue keeps its published
delivery. The site never contacts an engine; it serves the rendered files.

### Fish Audio Drama 3

`voices/drama3-female6/` defines the voice of every lesson: `voice.json` holds
the delivery tag that opens every request (`[warm, enthusiastic, welcoming]`)
and the transcript of `reference.flac`. That clip is a 16.5-second line in a
voice Drama 3 invented during auditions, not a recording of a real person, and
was time-compressed to about 178 words per minute. Drama 3 copies voice, tone
and pace from it, so it has no speed setting: `speech.speed` must be `1`.
Editing either file changes the speaker identity and renders every cue anew.
The players credit "Built with Fish Audio", as the Fish Audio license requires
(`_includes/narration-player-credit.html`).

Drama 3 runs on an NVIDIA GPU. The lessons were rendered on a DGX Spark (GB10);
the server takes about 56% of its memory. To set up a host:

1. Create a Python 3.12 virtualenv and install
   [sglang-omni](https://github.com/sgl-project/sglang-omni) from source, editable
   (`pip install -e`). The lessons used commit `e698f755`, which brought torch
   2.14.1+cu130, sglang 0.5.23 and flashinfer-python 0.7.2.
2. Download the `fishaudio/drama-3` model from Hugging Face (the lessons used
   snapshot `78e5ab79`).
3. Start the server on that host and wait for "Drama 3 ready" (about five
   minutes; the first start also compiles FlashInfer kernels):
   ```sh
   DRAMA3_VENV=~/drama3/venv DRAMA3_MODEL=/path/to/drama-3/snapshot \
     scripts/narration_speech/drama3-serve.sh
   ```
   The script's header lists its settings; the defaults fit the GB10 with CUDA 13.
4. On the machine that renders, forward the port (the maintainer keeps the SSH
   target in the untracked `.env.local` as `NARRATION_TTS_SSH`):
   ```sh
   ssh -N -L 8000:127.0.0.1:8000 "$NARRATION_TTS_SSH"
   ```
5. When done, stop the server with `kill "$(cat ~/drama3/server.pid)"` (the
   process ID sits next to `DRAMA3_LOG`).

Render on Apple silicon, where Whisper checks each take (`mlx-whisper`):

```sh
uv run --no-project -p 3.12 --with numpy --with scipy --with soundfile \
  --with pyloudnorm --with num2words --with mlx-whisper \
  python scripts/render-explainer-narration.py --topic queues
```

Drama 3 takes no seed and sometimes drops or repeats a word, so each cue gets up
to `--takes` takes (default 3). Rendering stops at the first take Whisper hears
as written; otherwise the closest take is kept. A render takes roughly as long
as the lesson plays. Clips are trimmed and matched to -23 LUFS.

The renderer ends by listing the cues whose transcript still differs from the
script. Differences in spacing, apostrophes, or a plural "s" ("hall hopper"
heard as "hallhopper") are not listed. Listen to each listed cue: a misheard
homophone ("whole" as "hole") is fine; a missing or repeated word is a slip.
Re-render a slip with `--retake <scene>/<cue>`. When every take drops the same
word, reword it for speech only with a pronunciation entry; the captions keep
the written text. Drama 3 tends to drop a label that opens a sentence before a
colon, so `"Predict: the battery": "Now predict: the battery"` keeps it.
Keep pronunciation entries that spell out identifiers and acronyms
(`setState: set state`, `UML: U M L`); Drama 3 needs no phonetic respellings.

### Kokoro

Any unregistered voice ID, such as `af_heart`, renders with
[kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) (`kokoro-onnx==0.6.1`,
`soundfile`): pass `--model kokoro-v1.0.onnx --voices voices-v1.0.bin`. Kokoro
renders one deterministic take per cue, used as is, with no transcript review.

`scripts/tests/test_narration_speech.py` covers the transcript comparison, take
choice, the Drama 3 request, and voice resolution without a GPU or Whisper.

## Editable lesson notes and PDF export

Every lesson shares the same handout, whatever its kind. The public `narration.html`
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
mirror preserves that safe formatting and real list structure. Each cue starts
on its own printed page, with a full-width visual above its key points and
nearly two inches of ruled handwriting space. Animated-stage pictures print
7.2 inches wide on both Letter and A4. Code, diagrams, and student writing use
their content height and can continue across pages rather than clip or shrink.
Knowledge checks follow their section; answers remain at the end.
The handout uses the light palette, including from a dark-mode
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
- `_includes/narration-player-*.html`: the player chrome every kind shares.
  Every player wraps its stage, checkpoint, and captions in one video
  (`.vn-video` > `.vn-surface` > `.vn-frame`) and ends it with
  `narration-player-controls.html`, the one thin control bar, which is the
  song player's: the same icons (`player-icon.html`, which
  `_layouts/song-player.html` also renders) and layout. The position line;
  then play, back and forward 5 seconds, previous and next scene, and the
  clock (position and length) on the left; a lesson's code language, mute,
  volume, captions (CC), the settings toggle, and full screen on the right.
  Its settings panel floats over the player's lower right
  (`js/song-video/settings-panel.js`, shared with the song player) and holds
  the scene select, speed, caption size, and landscape in full screen. A
  player passes choices that stay in the bar as `view` (the code language,
  `narration-player-language.html`), its own settings (motion, knowledge
  check) as `settings`, and controls that lead the transport (a case
  study's step buttons) as `lead`. A case study without rendered speech
  passes `text_only=true` and gets no position, transport, volume, captions
  toggle, or speed. `narration-player-tips.html` explains the pointer and
  keyboard use, `narration-player-scripts.html` loads the shared runtime
  before a player's own scripts, and the scene and speed selects, the audio
  element, and the download credit complete the set. Change a shared control
  here once, not in each player.
- `js/narration-player.js`: the single player entry point and data boundary.
  It normalizes companion quizzes and inline scene checkpoints, mounts the
  declared visual renderer, and owns check continuation, replay boundaries,
  roadmap and step navigation, focus, language refresh, and final song handoff.
  Every kind uses this lifecycle, including explainers without authored checks.
- `js/narration-transport.js`: the audio clock, seeking, motion,
  fullscreen, cue presentation, and print lifecycle. `mount` selects an audio
  or text-only session from the presence of authored media. Both support scene
  and cue navigation, refresh, pause, and fullscreen; audio sessions also expose
  play and time seeking. Unchecked scenes play continuously. Printing opens the
  transcript and its nested answer disclosures, then restores their state.
- `js/narration-player-controls.js`: the control bar's behavior, from the song
  player's own modules (`js/song-video/`): the same keys in every player (K or
  Space, the arrow keys, 0 to 9, C, F, and Escape, documented at
  `/shortcuts/`), controls that hide after 3 seconds of playback in full
  screen, 5-second skips, captions and their size, volume, the settings panel,
  and the landscape surface on portrait touch screens. A player with a picture
  control (video narrations) also plays and skips by click and double-click.
  While a knowledge check or decision is open, the bar steps aside: the
  checkpoint replaces the picture, keys typed in it answer it, and its own
  buttons continue or skip.
- `js/narration-preferences.js`: the shared captions, playback-speed, and knowledge-check
  preference for video, pattern, explainer, and case-study players and
  `/settings/`. The `sebook-narration-preferences` cookie stores
  `{captions: boolean, speed: number, finalCheckOnly: boolean}` for one year,
  with `Path=/`, `SameSite=Lax`, and `Secure` on HTTPS. Defaults are captions on,
  1x, and all knowledge checks;
  visiting a lesson does not write a cookie. Every speed selector uses
  `narration-playback-speeds.html` (0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x).
  The shared control bar applies viewing preferences, including audio's current
  and default playback rate. Choices synchronize all mounted players without
  moving the playback position or starting audio. Returning to an open tab
  refreshes external changes or deletion; `/cookies/` lists and deletes the
  cookie. Invalid fields use their defaults, and blocked cookies leave the
  current page usable. Music video and inline audio clip settings are separate.
  **Only pause for the final knowledge check** is available in every player's
  settings and My Settings. The player supplies `shouldCheck(index)` to the
  transport, skipping intermediate boundaries without pausing or restarting
  audio. Step-mode continuation and its button labels follow the same policy.
  The last authored check remains enabled even if unchecked scenes follow it;
  a lesson with no checks gains no pause. Explicit review through the timeline
  or review buttons still opens any check. Prediction pauses are independent,
  and changing this preference affects upcoming boundaries without dismissing
  an already open check or changing quiz answers.
- Full screen fills the screen with the player's video
  (`css/narrated-explainer.css`): the stage, or the checkpoint that replaces
  it, takes the whole surface and scrolls inside; captions and the bar
  overlay its lower edge. Panels marked `data-fullscreen-scroll` become tab
  stops while the player fills the screen, so the keyboard can scroll them.
  A checkpoint offers its own **Exit full screen** button there. A video
  narration adds its 16:9 screen and roadmap (`css/video-narration.css`).
- `js/narration-diagram.js`: copies a diagram the build drew in the reading
  version into a player, renaming its ids, for lessons and case studies.
- `_includes/narration-player-check.html`: one semantic check panel for all
  kinds, using `.narration-check` and the common light/dark/print styling.
- `js/narration-quiz.js`: the check presentation lifecycle, including mounting,
  opening, closing, retained answers, and replay feedback. It delegates grading
  to SebookQuiz and receives continuation/replay callbacks from NarrationPlayer.
  Single-question feedback goes directly to **Continue narration** (or
  **Continue lesson** without audio); multi-question summaries retain results.
  The final action is **Continue to song** for a paired song, otherwise
  **Finish review**. The same labels apply to case-study decisions.
  **Re-listen to segment** appears after wrong answers and on results with
  mistakes. The player replays from after the previous authored check, or the
  beginning, retaining answers until the check returns. Text-only lessons
  offer **Review this scene**. No renderer owns check or replay behavior.
- Visual modules expose `createRenderer(root, data)`, returning `render(frame)`.
  The root's `data-narration-renderer` names the module. A frame contains the DOM
  `element`, authored `scene` and `cue`, `sceneIndex`, `cueIndex`, `progress`,
  `motion`, and audio `time` when available. Pattern, video, case-study, Node.js,
  and React renderers implement this contract. They only present visuals.
  Pattern code highlighting stays with its renderer; focused diagram copying
  is shared by `NarrationDiagram.showReadingStep`.
- `js/narration-song.js` owns the paired media session. It pauses narration,
  hides its surface without destroying its DOM or clock, and loads a song iframe
  inside the same `[data-vn-video]` container. `SongPlayerEmbeds.register(frame)`
  supplies sizing, theme propagation, and coordination with other song audio.
  **Previous song** pauses the song and restores the narration and keyboard
  focus without changing its completed position. Neither direction scrolls to
  the separate chapter song or leaves fullscreen. The host retains native or
  viewport fullscreen; `song-video/presentation.js` delegates fullscreen buttons
  to it and receives `song-player:host-fullscreen` state. All messages validate
  origin and source. A ready handshake starts playback only after the song's
  controls have initialized. The retained song frame can be revisited.
- `js/narration-timeline.js` paints proportional scene segments behind the
  native seek slider, with the current chapter beside the clock. Hover or
  keyboard seeking previews the scene and timestamp above the rail; Escape
  dismisses the label. Check dots are labeled buttons at section boundaries.
  Close checks share a dot that opens their titled choices and timestamps,
  preserving 24px targets and a single row on narrow screens. The adapter
  supplies `checkScenes` to the transport; clicking a dot pauses, seeks to that
  section's end, and opens its check through the existing section-end callback.
- Inline players place controls first in document order, above the picture.
  Fullscreen keeps the bottom overlay and begins a fresh idle period for every
  entry path. A stationary pointer does not pin narration chrome; keyboard
  navigation, visible timeline labels, open settings/pickers, dragging, paused playback, and buffering
  keep it visible. Closing a check returns fullscreen focus to the video so
  auto-hide can resume. Playlist controls retain their existing layout.
- The four presentation adapters own cue rendering and their distinct learning
  interactions. They do not reimplement the clock or parse a second source format.

`readData` accepts the older `data-np-*`, `data-explainer-*`, and `data-case-*`
attributes at this boundary so cached HTML survives a runtime update. New
templates always use `narration-data.html`; its common attributes take precedence.

Keep this boundary when extending the system. Prefer another lesson in an
existing kind over a new player. Add an adapter only for a demonstrated new
interaction, with a compiled contract and behavior tests. Do not move speech
into a visual package or hard-code a new topic in the audio renderer.

## Student study companions

Optional `_data/explainers/<id>_study.yml` files add question-to-cue reviews and
fresh retries, editable diagram exercises, and comparisons of two authored
frames. `scripts/narration/study.js` validates the version-1 contract and every
reference; the source loader exports `entry.study`. These fields do not change
the speech fingerprint. See [the schema and runtime contract](narration-study.md).
All players share prediction holds and searchable review. Keep topic scripts
limited to visuals; do not reimplement these learning controls per lesson.
