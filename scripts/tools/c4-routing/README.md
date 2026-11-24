# C4 layout and routing tools

Offline tools for the C4 placement and routing engines (`js/ArchUML/c4/c4-place.js` with its parts `c4-place-*.js`,
`c4-route.js` with its parts `c4-route-*.js`, `c4-render.js`).
The design they serve is [the routing redesign](../../../docs/superpowers/specs/2026-11-09-c4-routing-redesign.md);
§9 defines the metrics and §10 the A/B guard. None of these tools runs in `npm test`, `npm run test:unit`, or
`npm run test:timing`: each one starts Chromium and renders dozens to hundreds of drawings, which takes from half a
minute to several minutes. Run them by hand before and after a change to the C4 modules or the UML bundle. Each has
an npm script that takes the same arguments after `--`: `npm run c4-routing:ab -- compare <A> <B>`,
`npm run c4-routing:views -- <outPrefix>`, `npm run c4-routing:uml -- <outDir> <specs…>` and `npm run c4-routing:seeds`.

All tools resolve paths from the repository, so they run from any folder. Write their output outside the repository
(for example under `/tmp`); none of it is tracked. Prefix the commands with `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` on
machines whose locale is not UTF-8. `PLAYWRIGHT_CHROME_EXECUTABLE` names an installed Chrome when Playwright's own
browser is missing (`scripts/chromium-launch-options.js`).

## `ab-compare.js`: the A/B guard

Renders every diagram of a corpus with two snapshots of ArchUML and byte-compares the drawings, in two modes: `live`
(the bundle and the C4 scripts in Chromium, at container widths 320, 740 and 1200 by default) and `static` (the
snapshot's own `uml_to_svg.js`, as the site build prerenders). It first renders snapshot A twice (the A/A control
must show no difference) and checks that every A-side output is a valid drawing.

| Corpus | What it holds | Use it when |
|---|---|---|
| `component` (default) | every UML component diagram on the site: narration JSON, `data-uml-spec` blocks, `language-uml-component` code blocks (89 on 2026-11-10; the counts are pinned in `EXPECTED`) | any change to the bundle or the C4 modules: component diagrams must stay byte-identical (§10) |
| `deployment` | every UML deployment diagram on the site | a change to the deployment renderer; differences are expected only where the change means them |
| `c4` | every C4 figure on the site (chapter fences, `c4-view` includes, quiz `data-uml-spec` blocks, the reference's examples, tutorial fences) and the router's gated and generated views | a refactor of the C4 modules: it must show 0 differences |

```bash
node scripts/tools/c4-routing/ab-compare.js snapshot /tmp/c4ab/before     # before the change
# … edit …
node scripts/tools/c4-routing/ab-compare.js snapshot /tmp/c4ab/after
node scripts/tools/c4-routing/ab-compare.js compare /tmp/c4ab/before /tmp/c4ab/after               # component
node scripts/tools/c4-routing/ab-compare.js compare /tmp/c4ab/before /tmp/c4ab/after --corpus c4
node scripts/tools/c4-routing/ab-compare.js count --corpus c4             # the corpus only, no rendering
# a change meant only to add an attribute or rename ids: drop the matches on both sides before comparing
node scripts/tools/c4-routing/ab-compare.js compare /tmp/c4ab/before /tmp/c4ab/after --corpus c4 --ignore ' data-c4-print="landscape"'
```

`snapshot` copies `js/ArchUML/{uml-bundle.js,uml_to_svg.js,c4/,css/,vendor/}` and `js/git-graph.js` into a new folder
and records their SHA-256 sums in `SHA256SUMS`. Take the "before" snapshot immediately before the first edit, so
uncommitted work of other changes is part of the baseline, not of the diff. Baselines are not kept in the
repository: the working tree at the moment of the snapshot is the baseline.

The run ends with `PASS` (exit 0) or `FAIL` (exit 1) and lists the differing sources by id
(`<form>:<file>:<position>`). A corpus whose extracted count disagrees with an independent substring count (or, for
component diagrams, with `EXPECTED`) stops the run with exit 2: content changed, or the extractor misses a form.
Update `EXPECTED` only after checking that content really changed, and say so in the change. A run takes about two
minutes for `component` and about four for `c4`.

## `render-views.js`: pictures and metrics of the gated views

Renders the views of `scripts/tests/c4-route-views.js` (the §9.3 table, the pinned booking component view, and the
generated landscapes, named `generated seed <n>` and `generated 40 elements`) to PNG,
once plain and once annotated (red circles: crossings; orange dashed boxes: detached or ambiguous labels; blue bands:
segments along a boundary line), and writes `<prefix>metrics.json` with the numbers the route-quality gates use
(`scripts/tests/c4-route-metrics.js`).

```bash
node scripts/tools/c4-routing/render-views.js /tmp/c4views/after-                       # the working tree
node scripts/tools/c4-routing/render-views.js /tmp/c4views/before- /tmp/c4ab/before/js/ArchUML   # a snapshot
ONLY="booking components,containers" node scripts/tools/c4-routing/render-views.js /tmp/c4views/some-
ONLY="generated seed 4" node scripts/tools/c4-routing/render-views.js /tmp/c4views/seed-   # a ratcheted seed (§9.3)
```

Compare two `metrics.json` files to see what a change did to crossings, bends, detours, labels and sizes.

## `render-uml.js`: UML component and deployment diagnosis

Renders component or deployment specs in a 1200 px container and prints rough route metrics (proper crossings,
bends per route, render time). The routing redesign used it to study the component engine whose ideas the C4 engine
adopts; its specs are in `scripts/tests/fixtures/c4-routing/specs/`. It gates nothing.

```bash
node scripts/tools/c4-routing/render-uml.js /tmp/uml component:scripts/tests/fixtures/c4-routing/specs/component-api-gateway.puml
BUNDLE=/tmp/c4ab/before/js/ArchUML/uml-bundle.js node scripts/tools/c4-routing/render-uml.js /tmp/uml-before deployment:scripts/tests/fixtures/c4-routing/specs/deployment-nested.puml
```

## `record-place-seeds.js`: placement test seeds

The Node placement tests (`js/ArchUML/tests/c4/place.test.js`) start from the seed that `seedPositions` computes in a
browser, because the seed depends on text measurement. This tool computes the seed of every graph in
`js/ArchUML/tests/c4/place-graphs.js` in Chromium and writes `js/ArchUML/tests/c4/fixtures/place-seeds.json`. Run it
after adding or changing a graph or the seed, and commit the regenerated fixture with that change.

```bash
node scripts/tools/c4-routing/record-place-seeds.js
```

## What the gates read instead

The route-quality gates (`scripts/tests/c4-route-quality.test.js`), the layout and render tests, and the timing lane
(`scripts/tests/timing/c4-route-timing.test.js`) read only tracked files: the models in `_includes/c4-models/` and
`js/ArchUML/tests/c4/fixtures/`, and the shared view list `scripts/tests/c4-route-views.js`. The diagnosis-era
`straight-feasible.js` (straight lines possible at the current positions) is not kept: the avoidable-bend metric of
`scripts/tests/c4-route-metrics.js` replaced it, and the route-quality gates hold it at 0.
