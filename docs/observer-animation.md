# Observer narrated UI example

The Observer chapter starts with an approximately 11-minute narration about a text editor. Document
is the concrete Subject; Preview, CharacterCount, and SaveButton are concrete
Observers. Learners choose Python, Java, C++, or TypeScript before playing and can
switch code without changing the narration position.

## Learning sequence

The lesson establishes the UI state, examines a conditional-heavy model, explains
four roles in an ArchUML class diagram, implements each responsibility, traces
notification and detachment, weighs consequences, and judges applicability. It
keeps the UI example constant to make the responsibility change visible. Code
marks and role hatching follow each spoken cue. Prediction prompts precede the
coupling explanation, trace result, and transfer explanation. Each has six seconds
of silence; learners can pause for longer. Cues marked `prediction: true` hide the
section takeaway until the explanation, including when seeking backwards.

The initial code sits beside an ArchUML diagram of DocumentBefore's direct
references to the three concrete UI classes. Narration, caption, and the section's
quiz feedback explain why domain classes should avoid those dependencies: UI
widgets and presentation rules tend to change more often than the domain model.
The corresponding widget is highlighted in both representations. On narrow
screens, the diagram follows the code and remains keyboard-scrollable.
Implementation sections show the solution's six actual classes beside the code,
highlighting the class being discussed. The runtime trace keeps that structure
visible and shows the changing widget state below it.

Every one of the 11 sections ends with exactly one question. The standalone
player mounts the existing `SebookQuiz` renderer from `js/tutorial-quiz.js`, so
answer shuffling, misconception feedback, retry, and keyboard operation match
tutorial quizzes. Audio pauses at the boundary; the learner can answer or skip,
then continue. Previous and Next move directly between scenes, skipping any open
check; they do not open checks themselves. Seeking and scene selection also remain
available for review. Answers
stay in memory for the current page only; the player adds no persistence.

## Sources

- `_data/explainers/observer.yml`: language-independent speech, visual
  descriptions, scene sequence, ArchUML source, and semantic focus keys.
  The `diagrams` map stores each diagram's label, text description, optional
  caption, and source; a scene's `diagram` key selects it.
- `_data/explainers/observer_code.yml`: four equivalent examples and mappings
  from semantic focus keys to one-based source lines. `example_order` assembles
  complete runnable examples without the earlier conditional-heavy version.
- `_data/explainers/observer_quizzes.yml`: one question per scene ID. Questions
  are separate from speech so editing feedback does not invalidate audio.
- `_data/explainers/observer_ui.yml`: the editor states shared by the player and
  the static reading steps.
- `_data/explainers/observer_timing.json`: generated cue boundaries and source hash.
- `assets/audio/observer-pattern.mp3` and `assets/narration/observer-pattern.*`:
  generated compressed speech, captions, and pronunciation-adjusted script.
- `_includes/observer-animation.html`, `_includes/observer-editor-illustration.html`,
  `js/observer-animation.js`, and `css/observer-animation.css`: lesson-specific UI.

`js/narrated-explainer.js` shares the native-audio transport with Node.js and React. The
Observer adapter adds section checkpoints and derives visual state from the
current cue. `narrated-explainer-code.html` and `css/narrated-explainer.css` share Rouge
highlighting and the theme. Light and dark palettes follow `html.dark-mode`,
including diagram, controls, code, focus markers, and quiz feedback.
Text accents use the site's UCLA navy in light mode and its light-blue companion
in dark mode; gold-filled controls retain dark icons.

## Reading and printing

`/SEBook/designpatterns/observer/read/` is the self-paced HTML lesson. Every cue
has its explanation, marked code, highlighted ArchUML diagram, and illustrated
editor state where applicable. It has no audio or playback controls. Each section
ends with one question and an expandable answer. The language selector updates
all examples. Links between the player, reader, and print view carry the selected
language and theme in their URLs, including when copied or opened in another tab.
The reader's section list is collapsible to keep the first step near the top.

`_includes/observer-reading-content.html` supplies the reader, the chapter's
transcript, and `/SEBook/designpatterns/observer/print/`. Browser printing from
the chapter uses this same content. Print is always light, includes the selected
language and answer explanations, and removes navigation and controls. Without
JavaScript, all four languages and all visualizations are still available.

ArchUML diagrams are rendered during the Jekyll build. The player clones the
completed diagram for the current reading step, preserving its geometry while
changing class emphasis. Sizing is applied synchronously before painting; cue
changes do not rerun diagram layout or briefly display an intermediate zoom.
These pages opt into `static_uml: true` so local development builds also include
their diagrams without JavaScript.
ArchUML's readable-size calculation compares screen-space transforms for the root
SVG and its labels. Firefox reports their `getCTM()` transforms in inconsistent
coordinate spaces, which otherwise makes repeated fitting alternate sizes.
`js/observer-document.js` owns language visibility and view-link preferences on all
three surfaces. It loads before the player adapter so the initial cue uses the
requested language. It does not load the audio player. The player groups language
and transport controls in a compact wrapping toolbar without reducing type or
control sizes. Native audio, script, and caption downloads
remain available in the narrated version.

## Scope of the examples

Widget fields represent UI state; actual toolkit rendering and input-event
wiring are omitted. Attach each object once, detach only registered objects,
use one thread, keep registrations stable during notification, and do not edit
recursively from `update`. Notifications are synchronous, in registration order;
an exception stops the loop. Attaching does not initialize a view. The simple
example strings avoid differences in Unicode length semantics. C++ registrations
use non-owning pointers and must end before the corresponding widgets are destroyed.
These are stated teaching assumptions, not guarantees of the Observer pattern.

The review keeps these limits explicit instead of expanding the example into a
production event framework. Role definitions precede implementation details, and
the state-ordering question asks learners to reason about a concrete mismatch
between a callback argument and stored state. These changes support explanation
and retrieval; their effect on learning has not been measured with students.

## Regeneration and checks

Use the same isolated Kokoro environment described in `docs/nodejs-animation.md`:

```sh
python scripts/render-explainer-narration.py --topic observer \
  --model /path/to/kokoro-v1.0.onnx \
  --voices /path/to/voices-v1.0.bin \
  --work-dir /tmp/observer-kokoro-render
bundle exec jekyll build
node --test scripts/tests/observer-narration.test.js scripts/tests/nodejs-narration.test.js scripts/tests/code-highlight.test.js
A11Y_INTERACTIVE_CHECKS=1 npx playwright test tests/observer-animation.spec.js tests/nodejs-animation.spec.js
npx playwright test --project observer-firefox
```

Run language checks with Python 3, a Java compiler/runtime, a C++17 compiler, and
Node.js with TypeScript stripping. Missing language toolchains are reported as
skipped tests; a release check should execute all four. Also type-check the complete
TypeScript example with `tsc --strict --noEmit`; stripping does not type-check.
Serve audio with byte-range support to test seeking (Jekyll's server or the deployed
site), since Python's basic `http.server` does not implement media ranges.
Use a full Jekyll build after storyboard changes so the page's embedded data is refreshed.
The static UML build needs Playwright's Chromium. If it is not installed, set
`PLAYWRIGHT_CHROME_EXECUTABLE` to an installed Chrome executable for the build
and browser tests.
The `observer-firefox` project also requires `npx playwright install firefox`.

Tests check actual UI state for empty text, an edit, and a later edit after
detachment; speech/source consistency; all language and cue mappings; section
checkpoints; reversible seeking; theme, mobile, print, and no-JavaScript behavior;
stable diagram dimensions across animation frames; all static reading steps;
and accessibility at the diagram, code, quiz, and reading states. Automated checks do not
replace listening to changed speech or a manual assistive-technology review.
