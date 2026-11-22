# ArchUML Compact Layout, Phase 1: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `layout compact` chooses, for class and state diagrams, the valid drawing whose smallest label is largest in its pane, without adding crossings or bends.

**Architecture:** Two new pure modules in `js/ArchUML/uml-bundle.js` (`UMLLayoutQuality`, `UMLCompactLayout`) sit after `UMLAdvancedLayout`. Each renderer records a DOM-free scene while generating SVG and offers an adapter; the coordinator realizes candidates, squeezes empty space, verifies, and selects.

**Tech Stack:** Plain ES5-style JavaScript in one hand-maintained bundle (no build step); `node:test` with a `vm` sandbox for unit tests; Playwright for corpus tests.

**Spec:** `docs/superpowers/specs/2026-11-21-archuml-compact-layout-design.md`

## Global Constraints

- Work only in the worktree `.claude/worktrees/compact-layout` and its `js/ArchUML` checkout (branch `feature/compact-layout`). Never touch the main checkout.
- Do not commit or push. Leave changes in the working tree.
- Output for any spec without `layout compact`, and for any spec with an `@layout` block, must stay byte-identical. The old compact code path stays for `@layout` specs.
- The new modules must not touch the DOM: no `document`, `querySelector`, `getBBox`. The bundle also runs in a worker.
- No text smaller than the diagram's base font in compact; never shrink text; never wrap text.
- Class compact font sizes stay within base + 0..4 px (`js/uml-live.js` measures only those).
- Inheritance stays vertical; boxes with authored positions never move; a composite state moves as one body.
- The search is bounded by routing passes: 8 for up to 12 boxes + edges, 5 up to 30, else 3. No timers, no randomness.
- Score weights: crossing 0.05, bend 0.015, excess detour 0.03 (above 1.5). Overlap tolerance 0.5. Merge threshold 6. Detached label: farther than one line height (font + 6) from its owner route, or nearer to another route.
- Every agent loads the skills `maintainable-code`, `test-design`, `software-architecture`, `responsibility-driven-design`, `c4-model` first, and `wcag-aa-compliance` / `light-dark-mode` when changing drawn output.

## Review Focus

- A spec with zero edges or a single box: compact returns a valid drawing, not an exception.
- A pane given as `layout compact 0x700` or `layout compact axb`: ignored, falls back to the container.
- A diagram whose reference drawing already has an overlap: repaired or flagged with `data-uml-layout-issues`, never thrown.
- A label wider than any gap: it keeps its room (the gap is not squeezed below it).
- Rendering in the worker shim (no real DOM): compact works and yields SVG text.

---

### Task 1: Pane directive and resolver

**Files:** Modify `js/ArchUML/uml-bundle.js` (`parseLayoutDirective` ~904; `UMLLayoutCore` ~5567–6213). Create `js/ArchUML/tests/support/load-bundle.js`, `js/ArchUML/tests/compact-pane.test.js`.

**Interfaces — Produces:**
- `loadBundle(): window` in `tests/support/load-bundle.js` (vm sandbox, fake document whose canvas `measureText` returns `length * 8`; same approach as the site's `tests/uml-route-geometry.test.js`).
- `UMLShared.parseLayoutDirective(line)` additionally returns `pane: {width, height} | null`; `layout compact 600x700` → `layoutPreference: 'compact'`, `pane: {width: 600, height: 700}`.
- `UMLLayoutCore.resolvePane(container, directivePane) → {width, height, source}` with `source` one of `'spec' | 'container' | 'default'`; default `900 × 600`.

- [ ] Write failing tests: `layout compact` → pane null; `layout compact 600x700` → 600/700; `layout compact 0x700`, `layout compact axb`, `layout compact 600x` → preference compact, pane null; `resolvePane(null, {width:600,height:700})` → spec; `resolvePane(null, null)` → 900×600 default; a fake container with `clientWidth 500` and `getBoundingClientRect().height 400` → 500×400 container.
- [ ] Run `node --test js/ArchUML/tests/compact-pane.test.js`; expect failures.
- [ ] Implement. Container height: the element's own height when ≥ 40, else `window.innerHeight − 24` when available, else default height.
- [ ] Run again; expect pass. Each renderer's parse loop stores `parsed.pane` (class ~7649, state ~13968).

### Task 2: Scene and quality judge

**Files:** Modify `js/ArchUML/uml-bundle.js` (new IIFE after `UMLAdvancedLayout`, ~7560). Create `js/ArchUML/tests/layout-quality.test.js`.

**Interfaces — Produces:**
- `UMLLayoutQuality.createScene() → scene` with `width`, `height`, `smallestFont` (Infinity until noted), `nodes[]`, `routes[]`, `labels[]`, and methods `addNode({id, x, y, width, height, kind, container, parent})`, `addRoute({id, points, source, target, bundle})`, `addLabel({id, x, y, width, height, owner, kind, onRoute})`, `noteFont(size)`, `setSize(width, height)`.
- `UMLLayoutQuality.evaluate(scene, pane) → {fit, emArea, crossings, bends, excessDetour, violations, valid, score}`; `violations` items are `{kind, a, b}` with kind in `node-node | label-node | label-label | route-node | route-label | route-merge | label-detached`.
- `UMLLayoutQuality.WEIGHTS = {crossing: 0.05, bend: 0.015, detour: 0.03}`.

- [ ] Write failing tests with hand-built scenes: boxes just touching (valid), overlapping by 1 (node-node), parent containing child (valid); label on a foreign box (label-node), on its owner (valid); two labels overlapping; route through a third box (route-node), through its own end (valid), through an enclosing container of its end (valid); route through a label (route-label), through an `onRoute: true` label (valid); two routes collinear for 10 units (route-merge), same `bundle` (valid), for 5 units (valid); proper crossing counts 1, T-junction 0, shared endpoint 0; bends of an L route = 1; a U route of length 300 over direct distance 100 gives excessDetour 1.5; label 40 units from its route (label-detached), nearer to another route (label-detached); `fit` for w 600, h 300, font 14 in pane 600×750 = 14; score = ln(fit) − weighted terms.
- [ ] Run; expect failures. Implement. Run; expect pass.

### Task 3: Squeezer

**Files:** Modify `js/ArchUML/uml-bundle.js` (new IIFE `UMLCompactLayout` after `UMLLayoutQuality`). Create `js/ArchUML/tests/compact-squeeze.test.js`.

**Interfaces — Produces:**
- `UMLCompactLayout.squeeze(bodies, scene, clearances) → {[id]: {x, y}}`.
  - `bodies`: `[{id, x, y, width, height, pinned, alignTop}]` (top-level movable bodies; `alignTop` is a key shared by bodies that keep a common top edge).
  - `clearances`: `{lanePitch, boxClearance, stub, labelPad}`.

Algorithm (per axis, x then y): for each pair facing across a gap with overlapping extent on the other axis, the occupied width is the merged length of the intervals taken in the gap by route segments parallel to the facing sides (± lanePitch/2), labels (± labelPad), and stubs of routes attached to the facing sides (stub length), plus `2 × boxClearance`; the required separation is `min(current gap, max(boxClearance, occupied))`. Bodies joined by a route that is a single straight segment perpendicular to the axis share one offset. Solve longest-path once from each side over order-preserving constraints, take the midpoint, round to integers. Pinned bodies keep their coordinates; others may only move toward them.

- [ ] Write failing tests: two boxes 200 apart with nothing between → gap becomes `boxClearance`; with a 60-wide label between → gap ≥ 60 + 2·labelPad; with two vertical tracks → gap keeps both lanes; two boxes joined by a straight vertical edge keep equal x-centres; a pinned box does not move and its neighbour moves toward it; bodies sharing `alignTop` keep equal y; running squeeze on its own output changes nothing; order of bodies is never reversed.
- [ ] Run; expect failures. Implement. Run; expect pass.

### Task 4: Coordinator

**Files:** Modify `js/ArchUML/uml-bundle.js` (`UMLCompactLayout`). Create `js/ArchUML/tests/compact-optimize.test.js`.

**Interfaces — Consumes:** Tasks 2, 3. **Produces:**
- `UMLCompactLayout.passBudget(boxCount, edgeCount) → 8 | 5 | 3`.
- `UMLCompactLayout.optimize(adapter, pane) → {svg, scene, metrics, passes, issues}`.
- Adapter contract: `candidates() → [placement]` (first is the normal placement), `bodies(placement) → bodies`, `withPositions(placement, positions) → placement` (a new placement; never mutates), `realize(placement) → {svg, scene}`, `clearances`, `size → {boxes, edges}`, optional `estimate(placement) → {width, height}` for ranking.

Behaviour: realize the first candidate (reference). Squeeze it, realize, accept only if valid and crossings and bends are not higher than the reference; otherwise widen: re-squeeze with `boxClearance + lanePitch` for pairs adjacent to worsened routes, at most twice. If the reference is invalid, repair by realizing with gaps widened around the violating pair, at most three times. Remaining budget goes to further candidates in `estimate` order, each realized then squeezed. Return the highest `score` among valid drawings; if none is valid, the one with fewest violations, with `issues` = that count. Never exceed the budget.

- [ ] Write failing tests with a fake adapter whose `realize` builds scenes from positions: budget values at 12/13/30/31; the squeezed drawing wins when valid; a squeeze that adds a crossing is rejected and the reference returned; passes never exceed budget; an invalid reference that widening fixes ends valid with `issues` 0; an always-invalid adapter returns `issues > 0` and does not throw; a second candidate with better fit wins; two runs return identical results.
- [ ] Run; expect failures. Implement. Run; expect pass.

### Task 5: Class diagram adapter

**Files:** Modify `js/ArchUML/uml-bundle.js` (class module ~7595–12230). Create `js/ArchUML/tests/compact-class.test.js` (Playwright via `node:test`, pattern of `tests/state-label-association.test.js`).

**Interfaces — Consumes:** Tasks 1–4.

- [ ] Write failing tests (real Chromium, DOM-measured, independent of the scene): for the Observer spec of `test-uml.html` section 5 and the six-class order spec in `tests/uml-renderer.spec.js:4145` (site repo), `layout compact` gives: no two class boxes overlapping; the label `notifies` within one line height of its association line; no more route bends than the same spec without a layout line; every `text` font size ≥ the class member font size; `layout compact 600x750` yields a larger `smallestFont × min(600/w, 750/h)` than `layout compact 1200x675` does for that same pane on a spec with two unconnected hierarchies (pane changes the shape); a spec with an `@layout` block renders byte-identically to the pre-change bundle (compare against `git show HEAD:uml-bundle.js` loaded in a second page).
- [ ] Run; expect failures.
- [ ] Record the scene in `generateSVG`: every class box, note, association route (incl. hierarchy fans with `bundle` = target + type), multiplicity and relation label, font sizes, final size. Attach it as `layout.scene`.
- [ ] Add a compact metric table (padding, margin, uniform label font = member font; fonts within base + 0..4) used when compact is on and the spec has no `@layout` block; gaps stay at the normal values for the reference.
- [ ] Build the adapter in `renderFromData` inside `withAdaptiveClassTypography`: candidates = normal placement, plus hierarchy families and unconnected groups re-packed into rows for the pane; bodies = classes (pinned if authored, `alignTop` = parent name for siblings of one fan); `realize` = copy layout, set positions, `generateSVG`. Call `UMLCompactLayout.optimize`, write `data-uml-layout-issues` on the root when `issues > 0` and `console.warn` once.
- [ ] Run class tests; expect pass. Run all `js/ArchUML/tests/*.test.js`.

### Task 6: State diagram adapter

**Files:** Modify `js/ArchUML/uml-bundle.js` (state module ~13834–15780). Create `js/ArchUML/tests/compact-state.test.js`.

- [ ] Write failing tests: the order spec of `SEBook/uml_state_diagram.md` (first diagram, without callouts) with `layout compact 600x750` has width ≤ 700 and `smallestFont × min(600/w, 750/h)` ≥ 12; no state boxes overlap; each transition label is nearest its own route (reuse the measure of `tests/state-label-association.test.js`); bends not above the default layout's; existing `state-label-association` tests still pass with `layout compact` prepended; an `@layout` spec is byte-identical.
- [ ] Record the scene (states, composites as containers, transitions, labels, notes). Compact metrics (state min width from text, padding). Adapter: candidates = TB and LR unless the direction is authored; composites move whole. Hook into `render`.
- [ ] Run; expect pass. Run all ArchUML tests.

### Task 9: Sequence diagrams (added 2026-11-21 at Tobias's request; pulled forward from phase 3)

**Files:** Modify `js/ArchUML/uml-bundle.js` (sequence module only, `generateSequenceSVG` and helpers). Create `js/ArchUML/tests/compact-sequence.test.js`.

A sequence diagram is a fixed grid: no candidates and no squeeze. Compact means exact spacing. Message order, lifeline order, frame nesting and activation alignment never change. Without `layout compact`, and with an `@layout` block, output stays byte-identical.

- [ ] Failing tests (real Chromium, DOM-measured): for three corpus specs (a plain three-lifeline exchange, one with nested `alt`/`loop` frames and a self-message, one with an actor and a note) under `layout compact`: width and height in font units are each ≤ today's compact; total area in font units is at least 15 % below today's compact on the frame spec; no message label overlaps a lifeline it does not belong to, another label, an activation bar, or a participant head; every self-message label is clear of the next lifeline; every text is at least the message font size; message order top to bottom equals source order; lifeline order left to right equals declaration order; each frame encloses exactly the messages it encloses today; activation bars start and end at the same messages as today.
- [ ] Lifeline gaps: replace the 60 px floor and equal-share split with the smallest gaps that satisfy every message's need (label width + margins between its two lifelines, minus the heads between them), solved by raising gaps only where a constraint is unmet, shortest spans first. Self-message labels and side notes count as needs of the gap they occupy.
- [ ] Tighten in compact: frame open/close paddings, the space below the last message, outer margins, row pitch down to label height plus clearance; heads as tall as their own content needs (an actor no longer makes every head tall, but heads keep a common baseline); fragment and note text at the message font size.
- [ ] Record a scene (heads and notes as nodes, frames as containers, messages as routes, labels) so `UMLLayoutQuality.evaluate` reports zero violations on the three specs; set `data-uml-layout-issues` when it does not.

### Task 7: Benchmark and corpus checks

**Files:** Create `scripts/uml-layout-benchmark.js`, `tests/uml-compact-corpus.spec.js`.

- [ ] Benchmark: extracts class and state specs from `test-uml.html`, `SEBook/**/*.md`, `_data/narration_visuals/*.json`; renders default and compact in 1200×675 and 600×750 containers with a bundle path argument; reports per type the median and 10th-percentile label size, crossings, bends, DOM-measured overlaps, and slowest render; `--compare <oldBundle>` reports per-spec regressions > 2 % and byte differences for non-compact renders. Port the measurement from the throwaway harness in the scratchpad `recon/baseline.js`, adding label-to-own-route distance.
- [ ] Corpus spec: for every class and state spec in `test-uml.html`, compact has no DOM-measured overlap among class/state boxes and texts.
- [ ] Run the benchmark against `git show HEAD:uml-bundle.js`; record the table in the task report.

### Task 8: Panes for lessons, song sheets, tutorials; reference docs

**Files:** Modify `_includes/narrated-pattern-diagram.html`, `js/song-video/model-kit.js`, `js/uml-live.js`, `js/ArchUML/REFERENCE.md`, `_includes/archuml-reference.md`.

- [ ] Narration include: a `layout compact` line without a size becomes `layout compact 600x700`.
- [ ] `model-kit.js` `diagram()`: when `fit` is given and the spec has a bare `layout compact`, insert `fit.w x fit.h`.
- [ ] `uml-live.js` `snapshotContainer`: pass the target pane's width and height, not the staging element's.
- [ ] Document `layout compact [WxH]` and the new behaviour.
- [ ] Tests: unit tests under `scripts/tests/` for the two string transforms.
