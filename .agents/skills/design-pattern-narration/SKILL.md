---
name: design-pattern-narration
description: >-
  Authoring guide for narrated design-pattern lessons in the SEBook (the Observer, State, Strategy,
  and Model-View-Controller narrations, and any new one). USE THIS SKILL EVERY TIME you create, extend, restructure, or review
  a narrated pattern lesson: `_data/narrations/<topic>.yml` (readable speech and teaching text),
  `_data/narration_visuals/<topic>.json` (diagrams and renderer state),
  `<topic>_code.yml` (Python/Java/C++/TypeScript examples), `<topic>_quizzes.yml` (section checks and
  the summary quiz), `<topic>_timing.json`, the shared narration compiler, topic
  illustrations such as `_includes/<topic>-*.html` with `css/<topic>-narration.css`, the
  `SEBook/designpatterns/<topic>/read.html` and `print.html` views, the narration audio and captions
  under `assets/`, or `scripts/render-explainer-narration.py`. Also trigger on requests like "make a
  narration for the X pattern", "pick an example for the X narration", "fix the narration
  pronunciation", "the narration cuts into the next word", "add a summary quiz", or "restructure the
  narration around context, problem, solution, and consequences". Covers choosing the example,
  structuring the narration as a pattern description, writing cues, diagrams, four-language code, and
  conceptual quizzes, rendering Kokoro speech, wiring the chapter, and verifying the result. The
  shared player itself is documented in docs/narrated-pattern.md.
---

# Authoring narrated design-pattern lessons

Read [narration-authoring](../narration-authoring/SKILL.md) first for the common
source format, compiler, player boundary, and speech workflow. Use `kind: pattern`;
keep the narration readable and the renderer state in its separate JSON package.

A narrated lesson is an approximately 11–13 minute, Kokoro-voiced walk through one
design pattern at the top of its SEBook chapter (see `/SEBook/designpatterns/observer.html`,
`/SEBook/designpatterns/state.html`, and `/SEBook/designpatterns/strategy.html`). A lesson is **data plus a few topic
illustrations**: the player, transport, reader, and print views are shared. The architecture
and file list live in [`docs/narrated-pattern.md`](../../../docs/narrated-pattern.md); this
skill is about authoring a lesson that teaches well and ships clean.

If you only remember eight things:

1. **The narration is a pattern description.** Its spine is Context → Problem → Solution
   (roles) → Consequences. Each of these is a first-class scene with a `part:` field, so
   learners see on screen which part of the description they are in.
2. **Show the concrete solution before abstracting it.** After the problem, redesign the
   example in code, one class at a time, and trace one input through it. Only then step back:
   "remove the screen time and the charts, and three roles remain." Map every abstract role to
   the example class that played it. Students should leave with the pattern, not the example,
   but they reach it through the example (concreteness fading).
3. **Build a mental model, not a glossary.** The audience is undergraduate computer science
   students. Explain each idea in plain words ("a list of dependents it notifies", "the data and
   its rules") and state one memorable loop or rule they can reuse ("a controller changes the
   model, the model announces the change, and every view redraws from the model"). Use a term
   only when it deepens understanding, such as linking to a pattern they know (Observer, Factory
   Method); define it when you first use it, and then use it consistently.
4. **The example must be a genuinely good fit for the pattern.** Original, inspired by the
   literature but not copied, relatable to Gen Z students, and *growing along the pattern's
   variation axis* (more states for State, more observers for Observer). If an `enum` and a
   `switch` would honestly be the better design, the example is wrong.
5. **Quizzes test the pattern, using only what the narration taught.** One check per section,
   plus one multi-question summary quiz at the end that covers every part of the description on
   a *new* scenario. Every key, and every reason to reject a distractor, must have been said in
   the narration before the check, in the narration's own words.
6. **Code ships in Python, Java, C++, and TypeScript, and the tests run it.** The before
   (conditional) and after (pattern) designs must produce identical behavior, checked against one
   data oracle.
7. **Finish the words, then let learners inspect the picture before every quiz.** Every
   identifier or symbol the TTS mangles gets a `pronunciations` entry. Give the last cue before
   each knowledge check, including the summary quiz, `pause_after: 2.5` or longer. Keep its
   completed slide visible throughout that silence; the player opens the check 0.3 s before
   the boundary, leaving at least two seconds to look after speech finishes at normal speed.
8. **Sources are shown, never read aloud; history is left out.** The spoken narration (and
   its captions), the quizzes, and the lesson summary teach concepts: they never name authors,
   books, dates, or places, and never say "the book says" or "as X observes". State the idea and
   why it matters to students instead. To credit a source, put it in the cue's `source` field,
   which the player and the reader show on screen under the explanation. Record fuller
   provenance for maintainers in `docs/<topic>-narration.md`.
   `scripts/tests/narrated-pattern-sources.test.js` fails if any cue's speech names a source.

Read [`quiz-format`](../quiz-format/SKILL.md) before writing questions,
[`good-diagrams`](../good-diagrams/SKILL.md) and [`diagrams`](../diagrams/SKILL.md) before
writing diagrams, [`pedagogical-advisor`](../pedagogical-advisor/SKILL.md) for the example and
sequence, and [`sebook-authoring`](../sebook-authoring/SKILL.md) for the chapter that hosts the
lesson. WCAG 2.2 AA, light/dark mode, the font-size rules, and the no-inline-styles rule in
`AGENTS.md` apply to every illustration you add.

## 1. Choose the running example

Do this first and get the user's agreement before writing speech; every later artifact depends
on it, and a rejected example means re-rendering the audio.

Read what the literature uses for the pattern (GoF, Head First Design Patterns, POSA, Kerievsky's
*Refactoring to Patterns*, Nystrom's *Game Programming Patterns*; the local RAG index holds
the books, and the user-level `design-patterns` skill, where installed, names a NotebookLM
notebook for them). Note the *shape* each
source uses, then design a new example with the same shape. Compare at least three candidates
against these criteria:

| Criterion | Question to answer |
|---|---|
| Pattern fit | Does the forces section of GoF actually apply? Would a simpler design (an `enum` + `switch`, a callback, a lambda) be better? If yes, reject. |
| Variation axis | Is adding another variant (a state, an observer, a strategy) a change this domain really sees? The transfer task depends on it. |
| Behavior per variant | Do several requests behave differently in each variant (for State: every state answers every request)? One-request examples collapse into Strategy or a flag. |
| Relatable | Will a UCLA undergraduate recognize it without domain explanation (games, apps, editors, streaming, social features)? |
| Small | Fits three variants, three requests, and about 10 lines per class in all four languages. |
| Original | Not a copy of a textbook example (no gumball machine, TCPConnection, weather station). Record which sources inspired it in `docs/<topic>-narration.md`. |

Examples that were rejected and why: a pull-request status workflow for State (its behavior is a
status check plus permissions; an `enum` is the better design). Examples that shipped: a text
editor whose preview, character count, and save button observe the document (Observer); a game
companion dog that follows, fetches, and naps (State); a group-expense app that splits a bill
equally, by percentage, or as a birthday treat, refactored from a method-checking calculation
the way Kerievsky refactors a loan's capital calculation (Strategy); a screen-time visualizer
whose table, bar chart, and pie chart share one dataset, live and editable in the player
(Model-View-Controller).

Ground the whole lesson in those sources, not only the example: follow GoF's applicability,
participants, collaborations, consequences, and implementation issues, use Kerievsky's
refactoring mechanics for the problem-to-solution steps, and borrow Head First's design
principles where they explain a role. The narration states these ideas as concepts without
saying the sources aloud (rule 8); show the source on screen in the cue's `source` field, so
students can find it again.

## 2. Structure the scenes

Use this sequence and adapt it only with a reason. `part:` is one of `Context`, `Problem`,
`Solution`, `Consequences`; omit it for the intro, transfer, and summary.

**Every player shows its two-level clickable roadmap from the opening frame.**
Keep Context → Problem → Solution → Consequences visible on every scene,
including the introduction, transfer, and summary. Each part jumps to its first
scene. Under it, show the current part's scene links; a scene without `part`
previews Context's scenes. Mark only the actual current part and scene with
`aria-current="step"`, so an overview preview has no current marker. Use the
shared `narrated-lesson-navigation.html` include and `NarratedLesson.mount`
helper, also used by video narrations. Navigation must work before playback,
by keyboard and touch, in mobile/fullscreen layouts and both themes; keep
focus in the destination navigation after a jump. Do not invent a storyboard
`part` solely to display navigation. Put short navigation labels in the script’s
`lesson.outline_labels` map keyed by scene id, so presentation-only edits do not change
the audio fingerprint. Existing storyboard `outline` and `label` fields are
fallbacks.

| Scene | `part` | What it does |
|---|---|---|
| intro | — | Show the example working (animate it, and let students try it if the illustration is live), then preview how a pattern is described and name the roles in one plain sentence. |
| context | Context | The recurring situation, shown with the example (a state machine for State, a UI for Observer). Warn about name collisions, such as State's `Context` *role* versus the pattern's *context*. |
| problem | Problem | The naive design in code and the demands a solution must meet. End on a prediction cue about what breaks when the domain grows. |
| one scene per new class | Solution | The concrete redesign: each class of the example in code ("Solution, concretely: …"), with a class diagram of the example and `diagram_focus` on the class. |
| collaborations | Solution | One input traced through the example's classes on a sequence diagram, one message group per cue, with a prediction before a reveal. End by stating the loop in one sentence. |
| solution | Solution | The abstraction ("Solution, abstracted: …"): the pattern's roles, each mapped back to the example class that played it, as CRC cards or a role diagram. Show how the roles interact on a role-level class diagram. |
| consequences | Consequences | Benefits and liabilities, each tied to a code change the learner just saw. |
| applicability | Context | When to use it and when not to, plus the neighboring pattern it is confused with (State vs. Strategy, Observer vs. Mediator). |
| transfer | — | Extend the example along the variation axis; name exactly which code changes. |
| summary | — | Recall all four parts with `cards`, then the summary quiz. |

The Model-View-Controller lesson follows this order. The Observer and State lessons predate the
concrete-first rule and introduce the roles before the code.

Each scene has a `purpose` (shown as "Our task"), a `title`, a `takeaway`, and cues. Keep every
diagram within about 9 symbols; split rather than crowd.

## 3. Write the cues

Each cue is one spoken paragraph of about 40–50 words (2–4 sentences); the shipped lessons run at
140–150 words per minute, so 35–40 cues make an 11–13 minute lesson. Fields, all in
`_data/narrations/<topic>.yml`:

- `id`: a stable cue identity; preserve it when moving or rewriting the cue.
- `say`: the spoken words, which are also the captions. Write it as written English; the
  `pronunciations` map fixes speech only.
- `visual`: a description of what is on screen for this cue. It becomes the stage's accessible
  name, so describe the marks and diagram emphasis, not the speech.
- `step` and `note`: the short explanation strip under the code.
- `source`: an optional citation shown on screen below the explanation strip, such as
  "Gamma et al., Design Patterns: Strategy, Applicability". It is never spoken.
- `prediction: true`: asks the learner to predict; it hides the takeaway and needs a
  `pause_after` of a few seconds so there is time to think. The next cue gives the answer.

Put the following renderer fields in `_data/narration_visuals/<topic>.json`,
under `scenes.<scene-id>.cues.<cue-id>`, not in the spoken script:

- `focus`: a key into the code block's `focus` map; the player marks those lines in every
  language. `table_focus`, `ui_state`, and similar keys are read by topic illustrations.
- `diagram_focus`: one class, interface, state, or lifeline to highlight. `diagram_steps`: how many
  sequence message groups (or CRC cards) are shown. `diagram`: switch this cue to another
  diagram of the storyboard, for example from CRC cards to a class diagram of how the roles
  interact; the region label and caption follow it.

Narration rules:

- Say role names exactly as the diagrams spell them, introduce a term before using it, and
  connect every consequence to something seen earlier.
- Prefer plain words to the pattern literature's vocabulary: "a list of dependents" over
  "change-propagation mechanism", "the data and its rules" over "functional core", "a request
  to change only this view" over "display request". Name a variant by what it does ("view and
  controller merged into one component") rather than by its catalog name.
- No history in any text, and no sources in speech, captions, `step`, `note`, or `visual`
  text; citations belong in `source`, which is shown but never spoken.
- Never refer to a quiz option or an on-screen position that the learner might not see
  (captions, reader view, and print use the same text).

## 4. Diagrams

Diagrams live under `resources.diagrams` in the visual JSON package as
ArchUML sources and render at build time
(`static_uml: true` on the chapter). Use the type that matches the question the scene answers:

- **class** for the role diagram and the solution's structure (`type` may be omitted);
- **state** for a lifecycle whose behavior depends on state, with guards in square brackets;
- **sequence** for collaborations, with lifelines in `source` and message groups in `steps`;
- **crc** for role cards when the source describes structure that way (POSA does), with one
  card per entry in `steps`. CRC cards cannot take `diagram_focus`, and they list
  responsibilities, not interactions: follow them with a role-level class diagram (a cue-level
  `diagram`) that shows which role calls which, and highlight the role being discussed.

Lessons learned from the shipped lessons: keep sequence diagrams to three or four lifelines and
omit return arrows that add width without meaning; use anonymous lifelines (`: Following`) for
shared stateless objects; give each diagram a `label`, a `description` (the text alternative),
and a `caption` that explains the notation once. Check every highlight target exists, because a
misspelled `diagram_focus` silently highlights nothing.

## 5. Code in four languages

`_data/explainers/<topic>_code.yml` has one entry per language with `label`, `filename`, `note`,
`imports`, and `blocks`. Each block has `source` and a `focus` map of named line lists (1-based).
`resources.example_order` in the visual package lists the blocks that make up the complete example; the
`problem` block is the before design.

- Write idiomatic code in each language, not a transliteration (Java `static final INSTANCE`
  fields, C++ function-local statics, Python module constants, TypeScript module consts).
- Keep each block short enough to read on the stage without scrolling far.
- A data file such as `<topic>_ui.yml` describes the expected behavior (for State, a table of
  reactions by state and request). The node test runs both designs in all four languages against
  it, and the topic illustrations render from the same data.
- C++ compiles with `-std=c++17 -Wall -Wextra -pedantic -Werror`. TypeScript must pass
  `tsc --strict`; run it separately, because the node test only strips types. If a toolchain
  (often the JDK) is missing locally, say so in your summary; the test skips it rather than
  passing it.

## 6. Quizzes

`_data/explainers/<topic>_quizzes.yml` has one entry per scene id, in scene order. Follow
`quiz-format` (sparse `option_feedback` keyed by option index, no length or markup tells, no
position references), plus these lesson-specific rules:

- **Ask about the pattern.** Stems name the pattern and a role or consequence ("In the State
  pattern, which role …"), never the dog's or the document's details. A learner who skipped the
  example but understands the pattern should be able to answer.
- **Test only what the narration taught.** Audit every question: name the cue, in that section
  or earlier, that states the key and the reason each distractor is wrong. If no cue does, change
  the question or teach the idea first. Use the narration's words in stems and options (if the
  narration says "a list of dependents", do not ask about the "change-propagation mechanism"),
  and do not introduce new terms in explanations or feedback.
- **Rotate `correct_index`** across questions; options shuffle, but authors drift toward index 0.
- **The last scene's entry is a summary quiz:** `questions:` with about six items on a new
  scenario (a sports app for Observer, a video player for State, a photo app's export formats for
  Strategy), covering context, problem,
  roles, collaboration, consequences, and applicability in that order. The player keeps their
  order (`shuffle_questions: false`); options still shuffle.

## 7. Render the speech

`scripts/render-explainer-narration.py --topic <topic>` renders each cue with Kokoro (voice
`af_heart`, speed 0.95), adds `pause_after` silence (0.55 s by default), and writes the MP3,
WebVTT captions, the spoken script, and `_data/explainers/<topic>_timing.json` with the
speech fingerprint. Topic discovery is automatic; never add a topic allowlist.
Validate first with `--check` (no speech model needed). Setup and the espeak-ng
long-path workaround are in `docs/nodejs-animation.md` and `docs/state-narration.md`.

- Run `node scripts/narration.js check <topic>` after editing. Re-render after changes
  to `say`, pauses, voice, speed, pronunciation rules, or scene/cue order or IDs.
  Visual state, diagram layout, navigation, citations, and descriptions do not affect
  the speech fingerprint. Unchanged speech reuses the per-cue WAV cache.
- Listen to every cue that contains code identifiers, acronyms, or symbols. Typical fixes:
  `UML: U M L`, `C++: C plus plus`, `enum: E num`, camelCase names split into words
  (`setState: set state`). Captions keep the written form.
- Abbreviations with periods break inside: written "p.m." phonemizes as `pˈiː.ˈɛm.`, a stop
  between letters that sounds like "pee. em.", so map it (`p.m.: PM.`, keeping the sentence's
  full stop). Check a doubtful word by its phonemes, not by ear alone:
  `Kokoro(...).tokenizer.phonemize(text, 'en-us')` shows what the voice will say. Whisper
  transcripts normalize such words back to their written form, so they cannot catch it.
- Heteronyms take the wrong reading after a noun: in "the plan lives on the wall" espeak reads
  `lˈaɪvz` (the plural of "life"). Respell the phrase (`plan lives: plan livs`). Check every
  "lives", "read", "lead", "close", "live", "wind", "tear", and "minute" by its phonemes.
- **Every quiz needs a short viewing pause after the final word.** On the last cue of every
  section with a knowledge check (including the final summary quiz), author `pause_after: 2.5`
  or longer. The player stops 0.3 s before the section boundary, so this leaves 2.2 s to inspect
  the completed slide at normal speed (1.1 s at 2x), while stopping before the next section's
  first word. The default 0.55 s pause leaves only 0.25 s and is insufficient before a quiz.
  Keep the final picture complete and visible from `speech_end` through the pause; do not
  postpone its last reveal until the quiz opens. Put the silence into the rendered audio and
  regenerate the MP3, captions, and timing together, rather than delaying a quiz over ongoing
  speech. Follow the Scrum node and playback tests: verify at least two seconds between
  `speech_end` and the check at normal speed, the final picture remains visible before the
  check opens, and playback stops before the next section's speech. Check accelerated playback
  too. Do not shorten or trim the spoken audio to make room.

## 8. Wire the lesson into the site

Follow "Adding a lesson" in `docs/narrated-pattern.md`: add the readable script
and JSON visual package, then include `narration.html` with `topic` in the chapter
and add the `read.html` and `print.html` views. `lesson` holds human-facing metadata;
`presentation.visuals`, `presentation.scripts`, and `presentation.styles` in the
JSON package select illustrations and assets. Registration and shared styles are automatic.

- Topic illustrations are includes that read `include.cue`; their CSS goes in
  `css/<topic>-narration.css` with base, `html.dark-mode`, and `@media print` rules together.
  Readable text inherits its size or uses `em` (never `rem`, which is 10 px here).
- **Make the example live when seeing it change teaches the idea.** Show the problem and the
  solution in motion (an edit spreading to every view) and let students change it themselves.
  List the script in the visual package’s `presentation.scripts`. The script upgrades
  the static illustration in the player only, cancels the player's `narrated-pattern:cue` event,
  and animates to the state that the settled reading step describes (for example in a
  `data-<topic>-cue` attribute). Reader and print views keep the static, accessible picture. The
  Model-View-Controller dashboard (`js/mvc-dashboard.js`) is the template, and it is itself
  built with the pattern it teaches.
- Live illustrations need labeled controls, keyboard access, a polite status message for each
  student action (not for narrated changes), and no motion under `prefers-reduced-motion`.
  Mark which parts reacted with text as well as motion, and never move focus during narration.
- Liquid cannot nest bracket lookups: `a[b[c]]` silently renders empty. Assign the inner
  value to a variable first. An illustration that shows zeros or blanks usually hit this.
- Tables beside code get a narrow column. Use `overflow-wrap: break-word` with
  `hyphens: auto` (not `anywhere`, which breaks words at random letters), and keep cell text
  short.
- Add the topic to the lists that name the narrated lessons: `shortcuts.html`, `settings.html`,
  and `cookies.html` ("narrated design-pattern lessons (Observer, State, …)").
- Full screen, captions, speed, scene selection, and the language switch come from the shared
  transport. Do not add per-topic transport code.

## 9. Verify

Copy `scripts/tests/state-narration.test.js` and `tests/state-narration.spec.js` as templates;
they check structure, timing, both designs in all languages, quizzes, focus targets, and the
player in both themes and on mobile. Then:

```bash
node --test scripts/tests/<topic>-narration.test.js
```

Build the site (the Bash tool needs `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`), run the topic spec
and `tests/narration-fullscreen.spec.js` (add the new page to its list) with
`A11Y_INTERACTIVE_CHECKS=1`, and run `tests/wcag22-complete-audit.spec.js` with
`WCAG_AUDIT_URL_FILTER` matching the chapter and both views. Finally, play the lesson in the
browser: watch for a check that clips the next word, a highlight that misses its target, and
text that needs leaning in to read.
