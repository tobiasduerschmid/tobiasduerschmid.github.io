# Bug Scan Report

Date: 2026-05-04

## Scope

I inventoried the tracked repository files and treated "entire code" as tracked source, content, data, config, runtime, scripts, and tests. I did not treat generated output or dependency/vendor trees as source to edit. The scan used per-file parsers where applicable, plus build and browser regressions:

- 721 tracked files inventoried.
- JSON, YAML, JavaScript, Ruby, Python, and shell files were parsed or syntax-checked individually where the toolchain supports it.
- Jekyll was built cleanly after fixes.
- The confirmed browser failures were rerun against a rebuilt local `_site`.

## Confirmed Bugs Fixed

### 1. Several `.json` data files were not valid JSON

Files changed:

- `_data/activities.json`
- `_data/news.json`
- `_data/photography.json`
- `_data/projects.json`
- `_data/publications.json`
- `_data/teaching.json`

Confirmation:

- Strict `JSON.parse` failed on these files before the fix.
- Jekyll accepted them because its data loader is permissive enough to parse YAML-like syntax from files with a `.json` extension.
- `_data/publications.json` had an additional content bug: `\emph{...}` was interpreted by YAML as an escape character plus text, producing broken generated text.

Root cause:

The files had JSON extensions but contained YAML/JSON5-style constructs: trailing commas, raw multiline strings, and an invalid `\emph` escape. This let the site build while breaking strict JSON tooling and corrupting one publication caption.

Change:

I converted the files to strict pretty-printed JSON while preserving the parsed data. For the corrupted publication caption, I replaced the malformed emphasis markers with HTML `<em>...</em>`.

Verification:

- All tracked JSON files now parse with `JSON.parse`.
- A semantic comparison against the previous Jekyll/YAML parse matched after normalizing the corrupted emphasis escape.

### 2. Publication acceptance rates never displayed

File changed:

- `_includes/publications.html`

Confirmation:

- The include read `site.data.publications.a_rate_threashold`, but the data key is `a_rate_threshold`.
- That typo made the acceptance-rate condition false even when `show_a_rate` and `p.a_rate` were present.

Root cause:

A misspelled Liquid variable disconnected the template from the data file. The comparison also relied on uncoerced values.

Change:

I corrected the key to `a_rate_threshold` and coerced both threshold and publication acceptance rate to numbers before comparing.

### 3. Scrollable Git graph regions were not keyboard focusable

File changed:

- `js/accessibility-fixes.js`

Confirmation:

- `tests/git-graph-accessibility.spec.js:5` reproduced the bug on a clean rebuilt site.
- The post-load accessibility patch handled scrollable tutorial content and editor tabs, but omitted `.tvm-git-graph-container`.

Root cause:

The generic accessibility repair path did not include live Git graph containers, so raw or dynamically inserted scrollable graph regions could remain unreachable by keyboard scrolling.

Change:

I added `.tvm-git-graph-container` to the scrollable-region focusability selector.

### 4. ArchUML diagrams lacked accessible `<figure>` wrappers

Files changed:

- `js/ArchUML/uml-bundle.js`
- `_plugins/uml_static.rb`

Confirmation:

- `tests/wcag-phase1.spec.js:151` reliably failed because SEBook ArchUML diagrams had no `figure.sebook-figure--archuml`.
- Both the client renderer and static Jekyll plugin emitted bare diagram containers.

Root cause:

The CSS/tests expected ArchUML diagrams to use the same figure/caption semantics as other diagrams, but the ArchUML render paths never created those wrappers or an accessible image role/name.

Change:

I added client-side figure wrapping with fallback captions, optional explicit `caption:` extraction, `role="img"`, and `aria-label`. I mirrored the same structure in the static UML plugin so production/CI static rendering matches the client path.

### 5. Sequence lifelines were filtered and not queryable by the regression test

File changed:

- `js/ArchUML/uml-bundle.js`

Confirmation:

- `tests/uml-renderer.spec.js:7` reproduced the bug.
- The renderer emitted lifeline `<line>` elements with the shared SVG shadow filter and without the expected `uml-sequence-lifeline` class.

Root cause:

The lifeline drawing path reused filtered SVG styling that is appropriate for boxes and nodes, but not for dashed lifelines. The regression exists because filtered dashed lifelines can fail to paint reliably in Chrome.

Change:

I added `class="uml-sequence-lifeline"` and removed the shadow filter from sequence lifeline lines.

### 6. The State pattern UML example had a misaligned visual trunk

File changed:

- `js/ArchUML/uml-bundle.js`

Confirmation:

- `tests/uml-renderer.spec.js:5099` reproduced the issue on `/SEBook/designpatterns/state.html`.
- Geometry probes showed `State` and `HasQuarterState` could align while `GumballMachine` stayed far left.

Root cause:

The hierarchy alignment code handled odd fan-outs, where a true median child exists, but skipped anchored even fan-outs. A later post-layout free-class nudge then moved the context class away from the hierarchy trunk. In the two-state example, the renderer needed to keep the selected central state, interface, and context on the same vertical trunk.

Change:

I extended the hierarchy alignment logic for anchored even fan-outs and extended the post-layout context realignment pass from odd-only medians to aligned hierarchy medians generally.

### 7. Venn diagrams rejected CSS named colors despite supporting them later

File changed:

- `js/ArchUML/uml-bundle.js`

Confirmation:

- The full UML renderer smoke test exposed one missing SVG: `85. Custom Colors - CSS Named Colors (Light Fills)`.
- Source inspection showed `normalizeHex()` already supports named CSS colors such as `lightyellow`, but the `set` parser only accepted color tokens with a leading `#`.

Root cause:

The parser and color normalizer disagreed. `set Alpha lightyellow` failed to parse as a set declaration, so the renderer produced the "No sets declared" fallback instead of an SVG.

Change:

I widened the `set` declaration regex to accept either `#...` colors or bare CSS named colors.

## Signals Not Fixed

These first-pass failures were not changed because they were not reliably confirmed after a clean rebuild, or the rerun environment was not valid for that runtime:

- The initial full Playwright run showed abbreviation-related failures, but those passed on a clean rebuilt static run. I treated them as stale-server or stale-build signals, not confirmed bugs.
- The initial full Playwright run showed tutorial capstone/time-out failures. A static server rerun is not a reliable confirmation for those tutorial runtime checks, so I did not alter tutorial content or runtime code for them.
- The initial full WCAG audit timed out. A scoped WCAG 2.2 AA audit over the affected SEBook pages passed after the fixes.

## Verification

Passed after the final changes:

- `bundle exec jekyll build`
- strict JSON parse of all tracked JSON files: `JSON parse OK 19`
- JavaScript parse of all tracked JS files: `JS parse OK 98`
- `_plugins/uml_static.rb` Ruby syntax check
- focused regressions:
  - `tests/git-graph-accessibility.spec.js:5`
  - `tests/uml-renderer.spec.js:7`
  - `tests/uml-renderer.spec.js:5099`
  - `tests/wcag-phase1.spec.js:151`
- full UML renderer regression file: `42 passed, 4 skipped`
- scoped WCAG 2.2 AA audit for `/SEBook/tools/networking.html` and `/SEBook/designpatterns/state.html`: conformance passed, 0 findings

