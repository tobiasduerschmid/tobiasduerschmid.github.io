# React narrated introduction

The React reference page embeds a ten-minute, nine-scene lesson with 26 timed
cues. It follows the Node.js introduction's dark stage, gold chapter stickers,
outlined objects, readable code, and concrete execution traces. Kokoro provides
synthetic narration without music; the published audio is a 24 kHz mono, 48 kbps
MP3 (about 3.6 MB). No model or uncompressed audio is delivered to the browser.

## Teaching design

The learner already knows basic programming but may not know JSX or React's
rendering model. The outcome is to trace a user event through a state update,
render, and commit, and distinguish props, state, and external synchronization.

The sequence follows one course and like count:

1. Declarative UI: describe a screen from the current data.
2. Components and JSX: functions, return, strings, tags, className, expressions.
3. Props: composition, object destructuring, separate instances, read-only inputs.
4. State: useState, array destructuring, persistent memory and render snapshots.
5. Events: passing callbacks versus calling them, queued state, render and commit.
6. Prediction: two replacement requests versus two pure updater functions.
7. Shared state: a common owner, values down, callbacks for requesting changes.
8. Lists: map, stable keys and copying an array before reversing it.
9. Effects: synchronizing a browser tab after commit, dependencies, cleanup scope.

Every example starts with its task, names prerequisites for excerpts, and explains
new syntax before relying on it. The same count holds surface details constant
while changing the concept. Props, state and queue results are labeled, not only
color-coded. A six-second retrieval pause precedes the update answer; the final
cue prompts a self-explanation and transfer to the interactive tutorial. This
uses the pedagogical-advisor skill's pretraining, signaling, temporal contiguity,
variation and retrieval guidance. Effects do not masquerade as the default place
for calculations, and neither callbacks nor setters are described as mutating
the current render's snapshot.

Official React documentation is linked in the transcript. This introductory
client-side model does not attempt to teach scheduling internals, server
components, deployment, data-fetching frameworks or optimization APIs.

## Ownership

- `_data/explainers/react.yml`: canonical examples, narration, pronunciation map,
  conceptual steps, focus lines and complete nonvisual descriptions.
- `_data/explainers/react_timing.json`: measured timings and source SHA-256.
- `_includes/react-animation-art.html` and `react-animation-preview.html`: concrete
  visual structures, without inline presentation.
- `css/react-animation.css`: React-specific artwork. `js/react-animation-art.js`:
  deterministic poses calculated from the audio clock, including backward seeks.
- `_includes/narrated-explainer*.html`, `css/narrated-explainer.css`, and
  `js/narrated-explainer.js`: player infrastructure shared with Node.js.
- `assets/audio/react-basics.mp3`, `assets/narration/react-basics.txt` and
  `assets/narration/react-basics.vtt`: publishable MP3, TTS input and captions.

`language: jsx` enables build-time Rouge highlighting of complete snippets before
splitting numbered lines. Token colors remain distinct under the execution-line
marker. `variant: alternate` selects an alternate snippet in a cue. The same
sources appear in the transcript, so the teaching examples cannot drift between
visual and nonvisual versions. Existing `nja-*` hooks are retained for shared
player internals; new artwork uses `ra-*` and stays scoped to React.

The player does not autoplay, persist preferences, or add custom keyboard keys.
Native inputs provide transport and scene selection. Reduced motion shows full
teaching states without travel. Captions, visual descriptions, a no-JavaScript
native audio player, and a print transcript provide alternate access. The stage
is dark in both themes; transcript and print follow the page's theme policy.

## Regeneration

Use the same optional offline Kokoro environment as the Node.js lesson:

```sh
python scripts/render-explainer-narration.py --topic react \
  --model /path/to/kokoro-v1.0.onnx \
  --voices /path/to/voices-v1.0.bin
bundle exec jekyll build --incremental
```

The renderer caches speech by text, voice and speed in `/tmp/react-kokoro-render`.
Speech-only substitutions split camel-case identifiers into words and use
`Javascript` and `Node JS`; JSX is left as one initialism to avoid separate
heavy stress on every letter. Captions and code retain normal spelling.
Review regenerated narration before publishing.

## Verification

```sh
node --test scripts/tests/explainer-narration.test.js scripts/tests/code-highlight.test.js
A11Y_INTERACTIVE_CHECKS=1 npx playwright test tests/react-animation.spec.js tests/nodejs-animation.spec.js
npx playwright test tests/react-animation-examples.spec.js
WCAG_AUDIT_URL_FILTER='^/SEBook/tools/(react|nodejs).html$' \
  npx playwright test tests/wcag22-complete-audit.spec.js --grep 'page audit matrix'
```

The unit suite checks asset consistency, compressed delivery, JSX parsing and
focus-line validity. Browser checks exercise actual MP3 playback, all poses in
desktop light and mobile dark themes, syntax colors, backward seeking, no-JS,
reduced motion, print and accessibility checkpoints. The example suite runs the
actual snippets with the tutorial's pinned React/Babel versions, checking click
counts, shared state, tab effects, and keyed reordering of frozen input data.
Playback tests decode the real MP3 through Chromium's virtual audio output so
they do not depend on hardware being attached. Combined-chapter tests verify that
Node.js and React initialize independently despite interleaved deferred scripts.
List reordering is a discrete commit, not an animation supplied by React.
Automated checks do not
replace listening, visual inspection or assistive-technology review.

The all-book integration check records an existing `mountWriteInQuestions`
exception when that page omits the `WriteInQuiz` assets. That unrelated quiz issue
predates this animation; other page exceptions still fail the check.
