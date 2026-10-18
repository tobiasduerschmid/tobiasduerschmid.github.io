# Live UML from source

The class and sequence chapters embed small Python/Java exercises with
`{% include uml-code-lab.html example="visibility" %}`. Set `uml_code_labs: true`
in the chapter front matter. Examples live in `_data/uml_code_labs.yml`:
`title`, `type` (`class` or `sequence`), `explanation`, and `java`/`python`
objects containing `code` and one brief `task`.

Keep each exercise about one visible change. Its prompt asks learners to
predict that change before editing; the explanation stays collapsed. The
source is analyzed locally, never executed. Inference is a source sketch,
not a complete compiler, runtime trace, or proof of ownership/lifetimes.
Verify both starter code and the suggested edit with the real analyzers.

## Ownership

- `js/uml-live.js` owns source analysis, lazy analyzer loading, worker queues,
  main-thread fallback, text measurement, SVG rendering and accessible names.
  Tutorials and chapter labs use the same pipeline and `js/uml-worker.js`.
- `js/uml-code-lab.js` owns the chapter controls, debounce, per-language drafts,
  reset, status, and stale-result guards. Edits debounce for 150 ms. A spinner occupies reserved space
  beside the diagram title while the previous diagram stays in place. Its
  animation stops for reduced-motion preferences; updates remain announced
  through a visually hidden status. Python is the default; drafts exist only
  in memory and switching languages preserves each draft.
- `js/uml-code-lab-editor.js` enhances the source field with Monaco's Java and
  Python grammars, adapting font size and theme to the chapter, with pure white
  and pure black editor backgrounds. The shared
  `js/monaco-loader.js` loads the locally vendored editor for both tutorials and
  chapters. Escape leaves the editor using `js/monaco-focus-exit.js`. A native
  textarea remains available if Monaco fails to load. No persistence is added.
- `js/tutorial-code.js` continues to own tutorial file models, progress, layout
  preferences, diagram colors and zoom. Its existing JavaScript/TypeScript UML
  support remains available; chapter controls expose only Java and Python.
- `_includes/uml-code-lab.html` owns semantic markup and escaped source
  fallbacks. `css/uml-code-lab.css` owns presentation in light, dark, mobile and
  print. Print uses the current draft and only a diagram matching that draft.

Load the ArchUML bundle and `uml-auto-describe.js`, then `uml-live.js` before
either host script. Both chapter layouts (including course aggregators) load
these assets once. The measuring SVG's styles live in `css/uml-diagram.css`.

## Shared client

```js
const client = UMLLive.createClient();
const diagrams = await client.analyze({
  language: 'java',
  sources: { 'Example.java': source },
  options: { hideVisibility: false, hideMultiplicity: false }
});
await client.render({
  type: 'class', syntax: diagrams.classDiagram, target, readOnly: true,
  isCurrent: () => revision === requestedRevision
});
client.dispose();
```

`analyze` returns `{ classDiagram, sequenceDiagram, errors }`. Analyzer errors
are data; loading/worker failures fall back to the local analyzer and reject
if that also fails. Rendering returns false for stale or disposed work.
`UMLLive.isSuperseded(error)` identifies replaced queued analysis requests.
`UMLLive.withClassLayout(syntax, preference)` replaces class layout directives.
Tutorial hosts may supply analyzer paths and `loadTypeScript` to `createClient`.
Rendering uses a temporary off-screen surface, then replaces the visible SVG
only when the complete result is current. `readOnly: true` gives the container
the image role and ArchUML's native keyboard-scrolling behavior; editor hosts
keep their own focus policy. The surface is removed on success, supersession,
or failure.

Each client has one worker with separate analysis/render queues. Each queue
keeps an active request, the latest pending request and one exact-input cache.
Different widgets never cancel one another. A worker failure or timeout
terminates it and releases outstanding requests before fallback. Owners must
dispose clients on teardown; chapter pages pause them on `pagehide` and
recreate them on a persisted `pageshow`. `UMLCodeLab.destroyWithin(element)`
supports an explicitly removed host. Status and source revisions prevent an
old render from becoming the displayed answer to a newer edit.
Text measurement reuses matching labels from the previous render; the cache
retains only that render's entries, so successive edits cannot grow it indefinitely.

## Verification

Build with `bundle exec jekyll build`, then run:

```sh
PLAYWRIGHT_SERVE_BUILT_SITE=1 A11Y_INTERACTIVE_CHECKS=1 npx playwright test tests/uml-code-lab.spec.js --project=chromium
```

The suite exercises edits, language and widget isolation, reset, no-worker
fallback, empty-source recovery, accessibility, small screens and print.
