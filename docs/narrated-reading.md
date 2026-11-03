# Self-paced narration readers

Every narration links to a **Read at my own pace** view and a **Print
step-by-step version** view. The reading and print routes are:

| Lesson | Reading | Print |
| --- | --- | --- |
| Node.js | `/SEBook/tools/nodejs/read/` | `/SEBook/tools/nodejs/print/` |
| React | `/SEBook/tools/react/read/` | `/SEBook/tools/react/print/` |
| Observer | `/SEBook/designpatterns/observer/read/` | `/SEBook/designpatterns/observer/print/` |

Each cue becomes an HTML section with its explanation, highlighted code, settled
illustration, and visual description. There is no audio player on these pages.
The same sections appear in the chapter transcript and when printing the chapter.
Prediction answers use native details disclosures on screen and expand in print.
Observer retains its per-section knowledge checks and complete code examples.

## Ownership

- `_data/narration_views.yml` owns routes, reader introductions, and renderer names,
  separate from the speech storyboard and its audio fingerprint.
- Every narration kind shares one reader shell: the `np-*` page hooks,
  `css/narrated-pattern-document.css`, and `js/narrated-pattern-document.js`.
  `_layouts/narrated-reader.html` applies it to explainer lessons, and
  `_layouts/narrated-pattern-reader.html` to pattern and video lessons. Topic
  styles still own their own illustrations.
- `js/narrated-pattern-document.js` handles the shared language preference,
  printing, and theme propagation through real link URLs (`data-np-view-link`).
  It enhances every reading or print view (`.np-document-page`) and every
  pattern or video player.
- `_includes/narrated-explainer-visual.html` is shared by playback and reading.
  `_includes/narrated-reading-content.html` sequences the Node.js and React cues.
  Observer's existing `observer-reading-content.html` supplies its language
  variants and build-time ArchUML diagrams.
- `_plugins/narration_snapshots.rb` invokes `scripts/render-narration-snapshots.js`
  once per uncached lesson. It reuses the live artwork renderer with reduced motion
  at the end of each cue. A renderer can provide `renderStatic` when a moving
  element needs a different, responsive DOM placement in a document; React's
  reordered list uses it to commit its rows in document order, because the
  snapshot page has no stylesheet to measure a translation against. No artwork
  script is needed in the built reader.

Build snapshots are cached in `.cache/narration-reading/`, keyed by the generated
markup, storyboard, renderer, and snapshot driver. Failure stops the build rather
than publishing incorrect initial-state illustrations. This uses the existing
Playwright/Chromium build dependency; `PLAYWRIGHT_CHROME_EXECUTABLE` can select an
installed Chrome, just as in the other rendering scripts.

When adding a narration, register its view metadata, add its `read.html` and
`print.html` stubs using `layout: narrated-reader`, and include the shared reader
stylesheet after the topic stylesheet and before `print-light.css`. Both routes
must work without JavaScript; JavaScript only enhances preferences and controls.

## Verification

`tests/narrated-reading.spec.js` verifies links for all registered narrations,
theme round trips, complete no-JavaScript steps, code variants, responsive visual
states, prediction reveals, and chapter printing. Observer's specialized reader
tests remain in `tests/observer-animation.spec.js`. Run the topic animation suites
when changing shared visual markup or an artwork renderer.
