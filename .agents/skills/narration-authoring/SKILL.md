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
- Ask for a prediction only when students can work out the answer from what
  the lesson has taught, or when their first intuition is likely wrong;
  otherwise state the answer. In speech, refer to a rule by its name
  (independence, publisher ignorance), never by its number alone; a listener
  can't look back to see which rule "rule two" was. The number may accompany
  the name where the rule is defined, matching its card on screen.
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
  self-paced investigation. Its renderer only presents evidence; the common
  player owns decisions and step navigation.
  A case study may be text only: omit `media` until its speech is rendered.
  `NarrationTransport.mount` then selects cue stepping without audio; `check`
  reports it as text only, and a leftover timing file is an error. Other
  kinds always need `media`.

A new topic does not require a new kind. Kinds select visual templates and
renderers. Every kind uses the same player and knowledge-check lifecycle;
add common behavior there rather than creating a topic-specific controller.

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
Incremental builds rebuild a page when the narration it names changes (script,
visuals, or `_data/explainers/<id>_*` companions). A page names one with
`topic="<id>"` on an include or `topic:` / `narration:` front matter
(`_plugins/data_regenerator.rb`); a new view that reads narration data must too.

Players compose shared chrome from `_includes/narration-player-*.html`; add
or change a common control there, never in one player. Every player wraps its
stage, checkpoint, and captions in one video (`.vn-video` > `.vn-surface` >
`.vn-frame`) and ends the surface with `narration-player-controls.html`: one thin bar
that is the song player's, with its icons (`player-icon.html`, shared with
`_layouts/song-player.html`), its layout, and its floating settings panel
(`js/song-video/settings-panel.js`), which holds the scene, speed, caption
size, and landscape choices. Every narration shows the same controls in the
same order; keep it that way. Pass choices that must stay on screen as
`view` (a lesson's code language, `narration-player-language.html`, so it
is never hidden in settings), player-specific settings as `settings`,
controls that lead the transport (case-study steps) as `lead`, and
`text_only=true` for a story without rendered speech; add
`narration-player-tips.html` and load `narration-player-scripts.html` before
the player's own scripts. `js/narration-player-controls.js` gives every
player the song player's keys, auto-hiding full-screen controls, captions,
mute and volume, settings, and landscape surface;
`tests/narration-player-controls.spec.js` checks every lesson's bar against
that order. `js/narration-preferences.js` owns the one-year, site-wide
`sebook-narration-preferences` cookie used by the control bar and `/settings/`:
`captions` (true), `speed` (1), `finalCheckOnly` (false), `captionSize` (1),
`landscape` (true), `predictions` (true), `motion` (null: follow system),
`volume` (1), and `muted` (false). Explicit motion choices are booleans and
survive system-preference changes. Every narration offers
0.5x, 0.75x, 1x, 1.25x, 1.5x, and 2x via
`narration-playback-speeds.html`. Choices synchronize players on the page and
refresh on cookie-change events where supported or on returning to a tab;
blocked cookies still permit changes for that page. A player without a control
must preserve its saved value. Scene selection is lesson navigation, not a
shared preference. Code language uses the separate, site-wide
`sebook-code-language` cookie through `SEBookCodePreferences`, including the
reading and print views; old localStorage choices migrate before profile sync
retires them. Keep these preferences out of individual renderers and the song player's
separate preferences. `tests/narration-preferences.spec.js` covers all lessons,
cross-kind persistence, settings, and deletion. **Only pause for the final
knowledge check** skips intermediate checks during audio and step-mode
continuation. Keep the last authored check, even if unchecked scenes follow;
no checks means no new pause. Manual review buttons and timeline markers
remain available, and Pause and predict is independent. The shared player
supplies `shouldCheck(index)` to the transport so skipped boundaries never
pause/restart audio. `tests/narration-check-preferences.spec.js` verifies these
transitions and restoring all checks. A checkpoint replaces the picture and the
bar steps aside until it is answered or skipped. Full screen fills the screen
with the video: the stage (or checkpoint) scrolls inside, and captions and
the bar overlay its lower edge. Mark scrolling panels
`data-fullscreen-scroll` so the transport makes them tab stops there.
`js/narration-diagram.js` is the one diagram copier for lessons and case
studies.

Explainer chapters reuse `narrated-reading-content.html` for their complete
illustrated transcript and `narration-view-links.html` for reader/print links.
Playback selects `.nja-scene[data-scene]` panels only: reader snapshots also
carry `data-scene`, and must never be hidden by the transport's scene changes.

The bar follows the picture and captions in document order and stays at the
bottom in both modes; settings open above it. Inline players also include
`narration-player-start.html`, a synchronized play/pause button at the upper
left with space reserved in the scene header. Hide that shortcut in fullscreen
and while a check, closer look, or prediction replaces the picture.
Every fullscreen entry starts a fresh idle period, including
keyboard and viewport fallback entry. Narration chrome hides with a stationary
pointer, while actual keyboard navigation, visible timeline labels, open settings/pickers, and dragging
keep controls visible. Checks close settings; fullscreen continuation returns
focus to the video so hiding resumes. Playlist layout is independent.
Video headers use compact, horizontally scrolling rows on phones. In touch
fullscreen only, the header shares the bar's idle state and collapses when
hidden to enlarge the picture. `SongControlsVisibility` accepts `extraControls`
so keyboard focus in that navigation keeps both surfaces visible. A first tap
reveals them without pausing; desktop fullscreen navigation stays visible.
`js/narration-timeline.js` supplies duration-proportional scene segments, scene
labels with timestamps on hover/keyboard seeking, a current-chapter label, and
accessible check buttons at boundaries. Adapters pass `checkScenes` to the
transport. Checks and closer looks share one chronological marker lane.
Nearby markers share a button that opens a named choice list, retaining
24px targets without overlaps even at phone widths or the end of the timeline.
Code-shaped markers distinguish closer looks; grouped markers have a stacked
outline. `js/narration-quiz.js` adapts the shared quiz next action:
one-question feedback leads directly to Continue narration (or the final
action), for correct and incorrect answers; multi-question checks keep results.
`NarrationQuiz.create` owns the shared panel, current attempt, feedback,
and **Re-listen to segment** buttons. It delegates grading to `SebookQuiz` and
invokes the player's continuation/replay callbacks. `NarrationPlayer` computes
the replay start after the previous authored check, or at scene zero for the
first check, including intervening unchecked scenes. Replay returns to the
same check with a fresh unanswered attempt, as does any new automatic or manual
opening. Explanation and similar-question detours return to the existing attempt.
Text-only lessons offer scene review.

`narration-data.html` and `NarrationPlayer` define one browser data boundary.
Companion quizzes and inline `scene.checkpoint` questions normalize there into
one scene-indexed check list. `NarrationPlayer.mount(root)` owns continuation,
replay, roadmap/step navigation, focus, language refresh, and song handoff for
all kinds. `_includes/narration-player-check.html` is their one check template,
styled by `.narration-check` in `css/narrated-explainer.css`.

A root declares `data-narration-renderer` naming a visual module. The common
bootstrap mounts every root once after deferred scripts load. A visual module
implements `createRenderer(root, data)` and returns `render(frame)`, where
`frame` contains `element`, `scene`, `cue`, `sceneIndex`, `cueIndex`, `progress`,
`motion`, and audio `time` when available. A renderer only presents that frame;
it never creates a transport, binds navigation, or mounts a quiz.

`NarrationTransport.mount` supplies audio or text-only cue navigation behind
one session contract. Audio sessions additionally expose `play` and `seekTo`.
The transport owns the clock, cue text, motion, fullscreen, and transcript
printing; the shared control bar applies saved captions and playback speed.
Audio pauses at enabled checks and prediction gates; other cues play
continuously. A check stops inside its section's closing silence, by a timer
armed from playback start (frames stop in background tabs), so the next
section is never heard. Audio and captions are versioned by the speech
fingerprint. Keep every player paused until explicit playback. Step-mode continuation
stays silent; check labels and single-question completion follow the same UI
for every kind. Shared controls, timeline, and song modules keep their existing
specialized responsibilities.

For lessons with parts, show the clickable two-level roadmap from the very
first frame, even when the introduction has no part. Preview the first part's
scene links without marking them current. Keep the actual current scene/part
marked accessibly, and preserve keyboard focus after a jump. Video fullscreen
keeps navigation horizontal on phones and laptops, compact controls, and
readable optional captions over the lower picture; see `video-narration`.

## Transition from narration to the chapter song

When a chapter contains both a narration and a corresponding song video,
completing the narration's **final knowledge-check quiz** must transition to
that song video. For example, the Scrum narration hands off to **Inspect and
Adapt: a Scrum musical** on the same page.

Keep final answer feedback and quiz results available until the learner takes
the quiz's completion action; that action performs the handoff. Intermediate
knowledge checks continue the narration. Target the corresponding song
explicitly, stop narration playback, and replace the narration surface with the
song inside the same player frame without overlapping audio. Never scroll to
the separate chapter song or exit and re-enter fullscreen. A page without a corresponding
song retains its normal narration completion behavior.

Pair an interactive song explicitly with `narration="<narration-root-id>"`
on its `song-video.html` include (Scrum uses `scrum-video`). The final action
reads **Continue to song**. The shared `NarrationSong.continueToSong(root,
player)` retains the narration DOM and clock while a song iframe replaces
its surface. The existing host keeps native or viewport fullscreen active,
as in playlist navigation. Both narration transports expose `toggleFullscreen()`
and `exitFullscreen()` so the song can delegate fullscreen controls to its host.
After this handoff, **Previous song** must pause the song and restore the
completed narration inside the same frame with focus on its play control (or
player settings for a text-only lesson). Preserve fullscreen and position;
do not restart it. Inline transitions replace only the frame's contents.
Validate message origin and the paired frame before accepting the return.

When implementing or changing this handoff, verify final versus intermediate
checks, pages with and without a song, and keyboard and fullscreen transitions
in both directions, including entering/exiting fullscreen while the song is visible.
Implement the handoff through shared narration completion handling.

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
**Edit lesson notes** (`notes_url`). Pass these shared `notes_actions` to each
adapter directly below its player, before tips, credits, and the transcript.
Keep navigation-link semantics while styling the actions as buttons, with
wrapping, visible focus, and light/dark colors. Hide them in print. These
apply to every kind, not only Scrum. `js/narration-notes.js` prepares the visuals, restores and saves
student text, waits for fonts and settled pictures, then opens the print dialog
for `#export`. It is the sole notes lifecycle script. The reusable visual and
editor includes are `narration-note-visual.html` and `narration-note-editor.html`;
the common stylesheet remains `css/video-narration-notes.css`.
`js/narration-note-rich-text.js` owns safe markup normalization and keyboard/paste
editing, using the local pinned DOMPurify dependency. Native editing commands
preserve undo history; storage and export remain in the lifecycle script.

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
- The code-language select shares `SEBookCodePreferences` and its cookie with
  players and reading views. Keep authored bullets and student writing separate
  from the speech. Notes-only edits never require audio regeneration.
- Save on input under `sebook-narration-notes-<id>` as
  `{version: 2, entries: {"cue:scene/id": {html: "My <strong>note</strong>"}}}`.
  Cue keys use stable IDs; question keys use the scene and zero-based question
  position (`question:scene/0`). Load version 1 plain strings literally and
  upgrade on the first edit without changing keys. Accept only supported
  semantic markup from saved or pasted content, without executable content,
  attributes, or arbitrary styling. There is no autosave toggle. Preserve editing and export when
  browser storage fails, with a visible status. Read `cookie-storage-tracker`
  for any persistence change and keep `/cookies/` deletion and `/settings/`
  disclosure aligned.
- Labeled multiline rich-text fields have visible keyboard help and no
  formatting toolbar. Scope Cmd/Ctrl+B, I, U (bold, italic, underline) and
  Cmd/Ctrl+Shift+7, 8 (numbered and bulleted lists) to the focused field;
  preserve native undo/redo and Tab navigation. Keep `/shortcuts/` aligned.
  Print mirrors preserve safe formatting and semantic lists. Blank
  handouts flow cues into available page space, with full-width visuals above
  key points and two ruled writing lines. Animated stages print
  7.2 inches wide on Letter and A4. Code, diagrams, and populated student notes
  must grow across pages rather than clip, overlap, or shrink. Keep ruled space for
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

Generate every new or revised audio description with the local Fish Audio
Drama 3 service at `http://127.0.0.1:8000` and registered voice
`drama3-female6`. For song soundtracks and their synchronized captions,
follow the [song audio description workflow](../song-video/SKILL.md#render-audio-descriptions-with-drama-3).

1. Edit `say`, `speech.pronunciations`, and pauses in the YAML. Captions retain
   written English; pronunciation replacements affect TTS only. Keep at least
   2.5 seconds of viewing silence before section checks, including the summary.
   The shared transport pauses the audio right after a checked section's (or a
   prediction's) last word and opens the check or reveal prompt on a timer, so
   no output buffer can play the next speech first; never pause near the
   boundary instead (see `video-narration`, "No sound may reach a check").
2. Run `node scripts/narration.js compile <id>` and
   `python3 scripts/render-explainer-narration.py --topic <id> --check`.
   These validate without loading a speech engine or writing media.
3. To render, omit `--check`. `speech.voice` picks the engine through
   `scripts/narration_speech/voices.py`: every lesson uses the registered Fish
   Audio Drama 3 voice `drama3-female6` (speed must be 1), which needs a running
   Drama 3 server and Whisper on Apple silicon; an unregistered ID is a Kokoro
   voice needing `--model` and `--voices`. Setup and review are in
   `docs/narration-format.md#speech-engines`. Topic discovery is automatic.
   Regenerate audio, captions, script, and timing together; the per-cue cache in
   `~/.cache/sebook-narration/<id>` keeps unchanged cues as published.
4. Listen to every cue the renderer lists for review. Re-render a dropped or
   repeated word with `--retake <scene>/<cue>`, or reword it for speech only
   with a pronunciation entry when every take drops it. Whisper cannot hear a
   mispronunciation, so also listen to identifiers, acronyms, and heteronyms.
5. Run `node scripts/narration.js check <id>`; omit the ID to validate all lessons.
   Changes to `scripts/narration_speech/` run `scripts/tests/test_narration_speech.py`.

The fingerprint includes ordered scene/cue IDs, written speech, pauses, voice,
speed, and pronunciation rules. Those changes require regeneration. Visual
state, illustrations, navigation labels, source citations, and visual-description
edits do not. Preserve written speech during structural refactors; prove old
and compiled content equivalent before retaining existing audio. Do not fake a
new fingerprint to bypass a substantive speech change.

## Student study tools

Keep the six shared learning features in the common player. The complete schema
and behavior contract is in [`docs/narration-study.md`](../../../docs/narration-study.md).

- `prediction: true` creates an intentional hold after the spoken prediction
  and its authored pause. **Pause and predict** defaults on; **Reveal explanation**
  continues. Seeking clears the hold, and disabling the setting restores timed
  playback. Preserve speech timing; do not extend audio pauses to implement this.
  Reader answers use disclosures and remain visible in print. The standalone
  reader's `narrated-pattern-document.js` opens them for printing and restores
  their previous state afterwards; dedicated print views open them on load.
- `_data/explainers/<id>_study.yml` optionally supplies `version: 1`, `reviews`,
  `exercises`, and `comparisons`. `scripts/narration/study.js` validates the
  companion against the story/quizzes; it is exported as `entry.study` and
  `data-narration-study`, outside the speech fingerprint.
- `reviews[quizScene]` is an array in original question order. Each item names
  the teaching `scene` and stable `cue`, plus a fresh single-choice `retry` using
  the quiz schema. Supply one item per question, including summary questions.
  Review returns to the same original question/feedback. Retry grading is
  separate from the first score. Unauthored lessons keep segment replay.
- Exercises carry `id`, `title`, `scene`, `cue`, `prompt`, diagram `type`,
  `starter`, `solution`, and `checks`. Keep a meaningful design change for the
  learner. Preview draws editable diagram notation; it does not execute code
  or automatically grade semantic correctness. Worked solutions and self-check
  criteria are deliberately revealed. Use the lesson's running example.
- Comparisons carry `id`, `title`, `question`, `before`/`after` references
  (`scene`, `cue`, `label`), and `consequences`. Contrast a concrete change request,
  benefits, costs, and when a simpler alternative suffices. The learner can write
  a reason before optionally revealing consequences.
- Search indexes explanation/cue text and diagram terms. Inspection reuses
  authored reader frames and the current language, linking `diagram_focus`
  and code `focus` lines to cue explanations. Native labeled buttons provide the
  keyboard equivalent of diagram/source clicks; do not invent unmapped links.
- `NarrationStudy` owns session-only review marks, viewed cues, and answered-check
  counts. Keep viewing separate from answering or mastery. Practice drafts and
  comparison reflections also last only until leaving/reloading the page. No new
  storage is written. Saved writing belongs in the existing lesson-notes view.

Use `narration-study.css` for readable light/dark/fullscreen/print presentation.
Full screen hides Study tools and closes an open study panel so lesson navigation
and playback remain available. Exiting restores the tools with session drafts retained.
Study fields and buttons retain native keys instead of media shortcuts. Verify
search/jump, draft retention/reset, code-language inspection, summary-question
review/return/retry, normal/accelerated prediction holds and opt-out, mobile fullscreen, and
printed answers with the narration-study and prediction-review tests.

## Closer looks: optional code at the moment it helps

A **closer look** is an optional worked example on one cue, for an idea that
is important or counter-intuitive, such as the Layers lesson's "control flow
and dependency are different relations". While the cue plays, a **See it in
code** offer shows at the picture's top right (a row under the picture on
phones) and a code-shaped marker shares the timeline's check lane. Opening it (click, marker,
or <kbd>E</kbd>) pauses the narration and puts the panel where the picture
was; **Continue narration** resumes at the same moment. The schema, behavior,
and file ownership are in
[`docs/narration-format.md#closer-looks`](../../../docs/narration-format.md#closer-looks).

- **Pedagogy.** Offer one where learners split: worked detail helps novices
  and slows those who already have the idea (expertise reversal), so it is
  never forced. The speech never mentions it, nothing waits for it, and the
  narration never pauses by itself; do not add a hold, a check, or audio for
  it. Ask questions in the steps ("Who calls whom?") whose answers the
  highlighted lines show, end with a consequence (such as removing a layer),
  and lay out the groups the way the lesson's view draws them, so the code
  reads as the picture the learner just saw.
- **Authoring.** Add `closer_look` to the cue in `_data/narrations/<id>.yml`
  (`title`, `notice`, optional `offer`, a content kind such as `code`, `groups`,
  optional `relations`, and `steps`). It is outside the speech fingerprint:
  adding or editing one never re-renders audio. Code goes in
  `_data/explainers/<id>_code.yml` in all four languages (python, java, cpp,
  typescript), one block `<code>_<group>` per group (`file`, `source`, `focus`,
  or `files` for several). Write idiomatic code, **always fully type-hinted
  Python**, at most **60 characters per line**. Step text may use `<code>`,
  `<strong>`, and `<em>`. The compiler rejects unknown groups, relations, or
  focus keys and any missing language block.
- **Where it shows.** The player panel; after its cue in the reading and print
  views and the chapter transcript; and in the lesson notes, as a block after
  the cue's row (not a `.vn-note` row; video-lesson notes then load the shared
  narration styles, which can shift their pagination slightly).
- **Extending.** The view reads only markup: an element marked
  `data-closer-look-focus="group.key"` is an anchor, so a new content kind adds
  a validator to `CONTENT` in `scripts/narration/closer-look.js`, a branch in
  `narration-closer-look.html`, and an include that marks anchors; offer,
  steps, and player behavior stay as they are (language switching and relation
  lanes are code-specific). A new relation kind adds `RELATION_KINDS`, the view's
  `RELATION_HEADS` entry, and its line style. Keep the offer, panel, and marker
  in the shared player; never add a topic-specific closer look.
- **Gotchas.** The page inverts every `.post-content svg` in dark mode, so the
  closer look's SVGs opt out with `filter: none`. The offer's accessible name
  is set as `aria-label` (visible label first) because a visually hidden title
  inserts a stray space into the computed name. Pick the offer's corner for
  the drafting-room art; a new theme must check that the top-right band is free.
- **Verify** with `scripts/tests/narration-closer-look.test.js` and
  `tests/narration-closer-look.spec.js` (offer timing, <kbd>E</kbd>, Continue
  position, Escape, marker, play or seek leaving, replay, steps, every language
  without wrapping, viewport full screen, phone, dark mode, a lesson without
  looks), plus the notes and reading views in light, dark, and print.

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
