# C4 model: SEBook chapter, ArchUML C4 toolkit, and design.yml editor

Status: design agreed in conversation on 2026-11-08. The user explicitly approved the architecture, the `design.yml` schema with its design-choices addendum, and the views/notation section, then delegated all remaining decisions to the designer. A five-lens adversarial review (C4/RDD semantics, pedagogy, accessibility and project rules, engineering feasibility, completeness) produced 65 findings; this revision resolves them. §17 lists where approved sections changed and why. Nothing has been implemented or committed. The ArchUML submodule is a separate repository; the user commits both repositories.

Decision record: [`docs/c4-decisions.md`](../../c4-decisions.md) consolidates the decisions taken while implementing this spec (with dates, reasons, rejected alternatives, and where each lives in code and tests) and lists the open items, the decisions waiting for the user, and the pre-existing accessibility findings. This spec stays the binding text; §17 records its changes.

## 1. Intent

### What the user asked for

- A SEBook chapter on the C4 model: why it matters, how to use it, what each level captures, notation, and trade-offs. Every level is explained through Responsibility-Driven Design (RDD): KNOW/DO/DECIDE responsibilities and collaborations with a purpose.
- ArchUML renders C4 views, and C4 diagrams embed in SEBook pages as easily as other ArchUML diagrams.
- A C4 editor that reads and writes `design.yml` files (the "Design IR" from lecture L04, redesigned for C4 and RDD). Usable by undergraduates with little modeling experience; able to produce professional diagrams; easy switching between levels; zooming into and out of elements.
- The editor works inside the tutorial system, with automated consistency checks and author-written predicates over the resulting model.
- The editor is reusable JavaScript that a VS Code extension can host later.
- Structurizr is inspiration only; the result stays consistent with ArchUML.
- An optional block records technology, design-pattern, architectural-style, and tactic choices for elements and connectors.
- The supplementary views use UML.

### Decisions taken with the user

| ID | Question | Decision |
|---|---|---|
| D1 | Compatibility with existing CS 188 `design.yml` files | Clean new schema. Existing files are not supported; they get a dedicated error message. |
| D2 | How SEBook embeds C4 diagrams | `design.yml` content plus a `view:` selector, in a ```` ```c4 ```` fence or a `data-uml-type="c4"` container. One format everywhere. |
| D3 | Where reusable code lives | All of it in ArchUML (core, renderer, editor, schema, CLI). The website keeps thin adapters. |
| D4 | Editor interaction model | Model-first with a live canvas: outline and inspector forms beside a navigable, editable diagram. |
| D5 | Views in the first release | System context, container, component, plus dynamic, code, system landscape, deployment. |
| D6 | Layout engine | Native ArchUML layout, synchronous once loaded. No ELK. |
| D7 | Notation of the supplementary views | Code → UML class diagram, dynamic → UML sequence diagram, deployment → UML deployment diagram. Landscape stays in C4 notation. |
| D8 | Design choices | Optional `choices:` block on software elements and on collaborators (connectors). `connector:` replaces the earlier `async:` flag. |
| D9 | Interface descriptions | `provides` grows from a list of signatures into interface descriptions with a syntactic view (operations, inputs, outputs, typed fields with constraints) and a semantic view (purpose, side effects, usage restrictions, errors, examples, meanings, units, formats, shared vocabulary). They are drawn as an interface card and as a UML component view with provided and required interfaces. Relationships name the interfaces they use; operations name the responsibilities they realize. (User request after lecture L14, 2026-11-08.) |
| D10 | Where learners practise interface descriptions | A separate follow-up tutorial "Describe an interface" of about 30 minutes, assigned with the interoperability lecture. The C4 tutorial keeps its nine steps (including the seat-hold step) and its length of about 90 minutes; only its change-impact step gains one interface prediction and one check (+1 minute). (Decision U1, option A, 2026-11-08; §11.) |

### Decisions taken by the designer (delegated)

| ID | Decision | Reason |
|---|---|---|
| J1 | VS Code is designed for, not built: host contract, DOM-free core, versioned JSON Schema, CLI, a fake-host contract test and a strict-CSP test ship now; the extension does not. | "Could also be reused" asks for readiness; an extension is a separate product. |
| J2 | Worked example: the lecture's course-registration system. Chapter near-transfer: campus room booking. Tutorial final transfer: a domain that is neither published nor practised (makerspace equipment loans), with reference models kept out of the published model folder. | A familiar domain lowers intrinsic load so effort goes to C4 and RDD; the step sequence is original design synthesis. Transfer evidence needs an unpractised domain. |
| J3 | Brown's Internet Banking example is linked (c4model.com), not reproduced. The supplied PDFs and the PPTX are never committed; they are added to `.git/info/exclude`. | Copyright and repository hygiene. |
| J4 | Chapter at `SEBook/architecture/c4.md`, next to AADL. `_data/CS130_nav.yml` unchanged. | AADL precedent; course nav is a curriculum decision. |
| J5 | Nothing is committed by the agent. Submodule work stays in the ArchUML working tree for the user. The placeholder submodule HEAD `31368bc` ("SOME COMMMIT UNDO AFTERWARDS") is left untouched and reported. | Repository rules and git safety. |
| J6 | Existing SEBook definitions of "component" (independently deployable, i.e. a C4 container) are not rewritten. Short terminology notes with links go into `software_architecture.md` and `uml_component_diagram.md`. | Keeps prior chapters intact while removing the contradiction for readers. |
| J7 | Interface ids share the element id namespace (compared ignoring case). A relationship from S to T may use an interface provided by T, by a descendant of T, or by an ancestor of T that is neither S nor an ancestor of S (request and response); by S itself when the interface is an `event` or `stream` interface or T is a `queue` or `topic` (S emits it, or connects its own interface to the channel); or, when T is a `queue` or `topic`, by another element that has its own relationship to T (the broker carries the contract; it does not own it). | Unambiguous references without paths; a container's API is handled by one of its components (UML delegation); in publish-subscribe the publisher owns the event contract and the arrows point at the topic. |
| J8 | Interfaces appear on C4 boxes and arrows only when a view asks (`annotations: [interfaces]` or the selector suffix `with interfaces`); the dedicated interface views always show them. | Brown's level discipline: APIs and payloads distract on context and container views unless they are the question; existing golden renders stay unchanged. |
| J9 | Interface code lives in the existing core modules; the core manifest does not change. | Milestone 2 embeds a copy of the core manifest in the bundle stub; a new core file during the parallel milestones would break that equality test. |
| J10 | The interface card is selected by interface id alone (`interface enrollment-api`); `interface <id> of <element>` is accepted as a synonym and checked. | Interface ids are model-wide (J7), so the provider adds nothing to identity. |
| J11 | The interface card is semantic HTML inside the C4 figure container (an article with labelled groups, definition lists, and one field table per type), not an SVG. | The card is a document, not a diagram: as HTML it inherits paragraph size, reflows (WCAG 1.4.10), honours text spacing (1.4.12), exposes its structure (1.3.1), paginates in print, and needs no second text version. |
| J12 | `realizes` names the provider's own responsibilities, or a descendant's responsibility that refines one of them. An operation realizes a responsibility R when it lists R, or when the responsibilities it lists together cover every direct refinement of R, recursively. | RDD contracts advertise the provider's obligations, never its private implementation (Wirfs-Brock & McKean 2003; Parnas 1972); refinement is partial (§4.5), so one refinement does not stand for its parent. |
| J13 | Milestone 1's fixture `js/ArchUML/tests/c4/fixtures/course-registration.yml` stays untouched: it keeps the reference model as it stood before interfaces and before the chapter review's amendments, and nothing re-syncs it with §4.2. The §4.2 block (interfaces plus the chapter's accepted amendments) is what `_includes/c4-models/course-registration.yml` and the Milestone 1b fixture `course-registration-interfaces.yml` contain; Milestone 1b re-asserts the Milestone 1 invariants on it. | Changing the fixture under running Milestone 1 tests silently changes what their text edits and property runs exercise. |
| J14 | Interfaces are not a C4 abstraction. They appear on relationship and box labels, in the interfaces view, and on cards; never in the level navigation, the level toggle group, or the containment outline. | An interface is the contract a system, container, or component offers, wherever a client crosses its boundary. |

## 2. Sources and evidence

- Simon Brown, *The C4 Model for Visualising Software Architecture* (Leanpub, 2022 edition; the local PDF is used for reading only and cited by publisher URL). Normative definitions also from c4model.com, licensed CC BY 4.0: adapted definitions carry an attribution line (title, Simon Brown, URL, licence link, "adapted: shortened and reworded"), and the chapter states that adapted CC BY text is not covered by the site's own reservation.
- Luca Mezzalira, *Communicating Architecture with the C4 Model* (IcePanel ebook): checklist and pitfalls are paraphrased and attributed; nothing is reproduced.
- Lecture L04 (CS 188): RDD process, KNOW/DO/DECIDE, collaborators, Design IR slots, `design.yml`, scenarios. The chapter defines everything it uses; it never depends on the lecture.
- The C4 and RDD skills, Structurizr documentation, IcePanel and LikeC4 documentation.
- Evidence that C4 diagrams improve learning is thin (an educational proposal and an experience report; grade D). The chapter presents C4 as a communication discipline and states this limit.
- Arisholm & Sjøberg (2004, IEEE TSE, doi 10.1109/TSE.2004.43): senior consultants maintained a delegated control style faster, while undergraduates and junior consultants performed far better with a centralized style. The chapter's trade-offs section states this moderation; it is a reason to pair delegated designs with dynamic views, not a claim that delegation is always cheaper.
- Lecture L14 (Interoperability and API Design) defines an interface description as a syntactic view (document format, actions, parameters, outputs) plus a semantic view (purpose, side effects, usage restrictions, error handling, examples), asks for the semantics of shared data (units, tax, date formats, reference frames), and names three remedies for semantic mismatches: document the semantics, agree on a shared vocabulary, and write integration tests. Its case is the Mars Climate Orbiter: the Phase I report of the Mishap Investigation Board (`MCOMIB1999`; NASA, 10 November 1999) found that the Software Interface Specification already required the ground software's file in metric units (newton-seconds), one side wrote pound-force seconds, and no check compared the file with the specification. So a stated unit is what makes the check possible, and checking both implementations against it is the other half. The interface rules also draw on Clements et al. 2010, Bass et al. 2012, Wirfs-Brock & McKean 2003, and Parnas 1972. The SEBook already teaches interoperability (`SEBook/quality_attributes/interoperability.md`); the C4 chapter links it and teaches only what is new (§12).

## 3. Architecture

### Module map

All reusable code lives in `js/ArchUML/`. Files are hand-maintained UMD scripts with no build step, matching ArchUML. Each works as a classic `<script>` (browser, worker, static prerender page) and through `require` (Node tests, CLI, a future VS Code extension host). No file has an AMD branch, because Monaco's loader defines `define.amd`.

| Unit | Responsibility | Depends on |
|---|---|---|
| `vendor/yaml/2.9.1/yaml.js` | Vendored eemeli `yaml` 2.9.1 (ISC), built from the upstream package by `scripts/build-archuml-yaml.js` (site repo) with esbuild: IIFE with global `ArchUMLYAML` plus a CommonJS footer, legal comments kept. `yaml@2.9.1` becomes an exact devDependency. Ships `LICENSE`, `README.md` (source, version, regeneration command), `SHA256SUMS`. | — |
| `c4/manifest.json` | The ordered list of C4 scripts. The single source for every loader (renderer stub, prerender page, CLI renderer, describer CLI, Liquid includes via a `_data` symlink, Ruby fingerprint). | — |
| `c4/c4-yaml.js` | The only module that touches the YAML library: parse with ranges and errors, map paths to ranges, return a node's source text in one-line flow form (`flowText`, used for interface examples, §4.11), compute **text-splice edits** (§4.9), never re-print a whole document. | yaml |
| `c4/c4-schema.js` | Element types, allowed fields, enums, shorthand rules, canonical key order, id rules, pattern and style catalogs with required roles, the interface catalogs and parsers (§4.11), and the pure selector grammar (`parseSelector`, `canonicalSelector`, `selectorKey`, §5.1) shared by the model and the projection. | — |
| `c4/c4-model.js` | Normalize a parsed document into the Model plus structural diagnostics, including interface descriptions (§4.11), their references, and the per-view-type field rules of custom views. | schema, yaml adapter |
| `c4/c4-projection.js` | View catalog, selector parsing and canonical form, `projectView(model, request)` (§5), breadcrumbs, drill targets. | model |
| `c4/c4-checks.js` | Rule catalog and runner (§7). | model, projection |
| `c4/c4-query.js` | Selectors and the declarative predicate evaluator (§8). | model, projection, checks |
| `c4/c4-edit.js` | Facade of the editing commands returning text-splice edits (§4.9, §4.10): dispatches a command by its `op` to one of the three command families below. | the `c4-edit-*` modules |
| `c4/c4-edit-splices.js` | The splice and YAML-path machinery the commands share: drafts of several splices reported as disjoint splices against the original text, removals that prune the collections they empty, key-by-key writes, values by YAML path. Knows no command and no model. | yaml adapter |
| `c4/c4-edit-results.js` | What every command returns (finished text with splices and the selection, or a refusal) and the argument checks the families share. | — |
| `c4/c4-edit-references.js` | Where a design names elements, responsibilities, and interfaces (§4.10, §4.11): reference sites, the edits that rename them, and the dependents a delete or a move removes. | schema, model |
| `c4/c4-edit-elements.js` | Commands of the element tree: elements, responsibilities, relationships and the interfaces they use, list fields, design choices (§4.5–§4.7, §4.10). | splices, results, references |
| `c4/c4-edit-sections.js` | Commands of the sections beside the tree: scenarios and steps, deployment environments and nodes, decisions, requirements, groups, views, pinned positions, the schema header (§4.8, §6.4). | splices, results, references |
| `c4/c4-edit-interfaces.js` | Commands of interface descriptions: interfaces, operations, errors, examples, types and fields, vocabulary terms (§4.11, §9.5). | splices, results, references |
| `c4/c4-describe.js` | Brief and verbose text descriptions of a projected view. | projection |
| `c4/c4-uml.js` | Code, dynamic, deployment, and interfaces views as ArchUML class, sequence, deployment, and component source text, with escaping (§6.3, §6.6); since the UML-view editing work, with `ids` and a source map for every view, the layout block of the view's UML layout entry, and aliases that are never a keyword of the target grammar. | projection |
| `c4/c4-constraints.js` | Rules the inspector's forms and the editor's UML canvas share, each with one owner (UML-view editing spec §4.3): the containment test `isNested`, the step ends a scenario allows at a position (`stepEnds`, `structuralSenders`), and the kind rule of `extends` and `implements` (`inheritanceProblem`). Pure and DOM-free; the facade adapts designs to models. | schema, model, projection |
| `c4/c4-core.js` | Facade `ArchUMLC4`: `load`, `listViews`, `project`, `check`, `query`, `edit`, `describe`, `toUml`, `positionForAnchor`, `dependentsOf`, `interfacesOf`, `usableInterfaces`, `interfaceDependentsOf`, `interfaceSelectorsOf`, `isNested`, `stepEnds`, `structuralSenders`, `inheritanceProblem`, `version`. | all of the above |
| `c4/c4-place-frame.js`, `c4-place-ranks.js`, `c4-place-corridors.js`, `c4-place-cross.js`, `c4-place-settle.js`, `c4/c4-place.js` | Placement of C4-notation views (routing redesign §4): the flow frame and constants, ranks and order, corridors and label slots, coordinates across the flow, and the final boxes with pins applied and overlaps settled; `c4-place.js` runs a placement through these parts and publishes `ArchUMLC4Place`. Pure and DOM-free. | — |
| `c4/c4-route-frame.js`, `c4-route-shapes.js`, `c4-route-labels.js`, `c4-route-candidates.js`, `c4-route-costs.js`, `c4-route-state.js`, `c4-route-pricing.js`, `c4-route-separate.js`, `c4-route-select.js`, `c4-route-growth.js`, `c4-route-evidence.js`, `c4/c4-route.js` | Routing of C4-notation views (routing redesign §5, §6): the flow frame, constants and edge classes, tracks, ends and route shapes, label places and label choice, hard filters and the fallback ladder, the objective, the selection state, move pricing, the separation of close parallels, global selection, growth, and evidence mode; `c4-route.js` runs a routing through these parts and publishes `ArchUMLC4Route`. DOM-free. | `UMLShared` (read only, grid fallback) |
| `c4/c4-markup.js` | Markup as text, shared by the SVG drawing and the interface card: escaping, rounded numbers, elements. Pure and DOM-free. | — |
| `c4/c4-card.js` | The interface description card as semantic HTML text (§6.6). | markup |
| `c4/c4-render.js` | Drawing of C4-notation views (landscape, context, container, component): layout orchestration (§6.4) over placement and routing, legend, title, SVG hooks, and the print mark of a wide drawing; the card through `c4-card.js` (§6.6); the title, legend, and notes around the delegated interfaces view; delegation of UML views to the bundle's UML renderers inside an inner element. Publishes `ArchUMLC4Render`. | core, place, route, markup, card, `UMLShared`, `UMLAdvancedLayout`, UML renderers |
| `uml-bundle.js`: small `UMLC4Diagram` stub | Registers type `c4` in every bundle list; `render(container, text)` renders synchronously when the C4 scripts are present and otherwise loads them lazily with the completion contract (§3.3); `parse(text)` without DOM (returns `null` when the core is absent). | manifest copy (tested equal), `ArchUMLC4Render` |
| `uml-bundle.js`: deployment renderer | Gains nested deployment nodes (§6.3). | — |
| `c4/editor/*.js`, `css/c4-editor.css` | Framework-free editor UI, `ArchUMLC4Editor.mount(root, options)` (§9). | core, render |
| `c4/editor/c4-editor-uml-*.js` (`refusals`, `layout`, `adapter`, `canvas`, `interaction`, and one view module each for `code`, `dynamic`, `deployment`, `interfaces`) | The C4 model adapter of the diagram editor and the C4 surface over it (UML-view editing spec §5, §7): the reviewed refusal table, the layout planner, one DOM-free planner per UML-notation view (an operation becomes core commands, a shared action, a form, or a refusal), the executor that dispatches a plan as one batch, and the canvas wiring that mounts a diagram-editor session under the editor's own listbox, keys, menus, and undo stack. | core, the editor's shared actions, diagram editor |
| `c4/editor/c4-editor-messages.js`, `c4-editor-anchored-form.js` | The message region (one visible instruction, refusal, or result with its offer, labelled "Messages"; UML-view editing spec §7.5) and the small form anchored to a drawn thing that the relationship, link, and step forms use. | editor DOM kit |
| `diagram-editor/*.js`, `diagram-editor/text/*.js`, `css/diagram-editor.css` | The UML editor's drawing interaction as a framework-free, multi-instance module, `ArchUMLDiagramEditor` (scene, gestures, commands, menus, in-place editors, viewport, moves without a drag, the classic surface) and its text adapter. It knows nothing about C4; the C4 editor mounts it through the adapter above (UML-view editing spec §2). | bundle (`UMLShared`, read only) |
| `c4/schema/1/design.schema.json` | JSON Schema for yaml-language-server and VS Code. Text fields accept strings, numbers and booleans (YAML 1.2 core typing in other tools); typed fields accept numeric strings. Agreement with `c4-schema.js` is tested on a shared corpus of accepted and rejected documents. | — |
| `c4/cli.js` | `node c4/cli.js check|describe|views|uml <file> [--view …] [--interfaces] [--json] [--strict]` (§7.3; `--interfaces` adds interface views to `views`). | core |
| Site adapters | SEBook includes and host adapter, standalone editor page, tutorial backend, registrations (§10, §11). | editor, core |

Dependencies point one way: site adapters → editor → render → core → yaml. The core knows nothing about the DOM, drawing, the site, or VS Code. Since the UML-view editing work the editor also depends on the diagram editor (site adapters → C4 editor → diagram editor → bundle); the diagram editor knows nothing about C4, the core does not depend on it, and without its scripts on a page the C4 canvas behaves as before (`docs/superpowers/specs/2026-11-12-c4-uml-view-editing.md` §2.2).

### 3.1 UMD pattern

```js
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./c4-schema.js'), require('./c4-yaml.js'));
  } else {
    var parts = root.ArchUMLC4Parts = root.ArchUMLC4Parts || {};
    parts.model = factory(parts.schema, parts.yaml);
  }
})(typeof self !== 'undefined' ? self : this, function (schema, yamlAdapter) {
  'use strict';
  /* … */
  return { normalize: normalize };
});
```

`c4-core.js` publishes `ArchUMLC4`; `c4-render.js` publishes `ArchUMLC4Render`. A unit test loads every manifest file, in order, in a fresh `vm` context and asserts both globals exist; a second test asserts the bundle stub's embedded list equals `manifest.json`.

### 3.2 Where the C4 scripts load

- **Preloaded** (synchronous rendering) wherever C4 is the topic: pages with front matter `c4: true` (chapter, editor page, uml-reference page), the tutorial layout when `backend: c4`, the tutorial print layout and the detached instructions popout (§11), the static prerender page (`uml_to_svg.js`), `uml_render.js`, and `uml-describe-cli.js` (Node `require`).
- **Lazy** everywhere else that can show a C4 figure (SE Gym quiz and flashcard cards, other tutorials), through the completion contract below.

### 3.3 Lazy completion contract

1. The stub keeps one memoized load promise. It injects the manifest scripts in order, resolved relative to the bundle's own URL, and shows an accessible "Loading diagram" placeholder (`role="img"`, `aria-label`).
2. On success, for each pending container that is still connected and whose spec text is unchanged: render; call `UMLShared.applySvgAccessibility(container, 'c4', text, brief)` (which `uml-auto-describe.js` patches to attach the verbose block); hide the nested SVG from accessibility as `renderAll` does; call `UMLShared.autoFitSVG(container)` so readable sizing and keyboard scrolling apply.
3. On failure: a visible error state styled for both themes, with a matching `aria-label`, and no retry loop.
4. `uml-auto-describe.js`'s c4 branch reads `window.ArchUMLC4` at call time and bypasses `extractNotationExplanations` and `stripDecorations`.
5. A Playwright test on a fixture page without preloaded scripts asserts the described label, the verbose block, paragraph-size labels, and keyboard scrolling.

### 3.4 Host contract

The editor never touches storage, files, network, cookies, or site globals. Everything outside the editor goes through the host object.

```js
const editor = ArchUMLC4Editor.mount(rootElement, {
  text,                                    // initial document text
  view: 'containers of registration',      // optional initial view selector
  profile: 'novice',                       // 'novice' | 'expert'
  scaffolds: { definitions: true, sentenceFrames: true, inlineLint: true,
               carryDown: true, trace: true, emptyStateGuide: true },
  checks: { display: 'live',               // 'live' | 'on-request' | 'after-submit'
            disable: [], severity: {}, thresholds: {}, honorFileIgnores: true },
  lockedFields: [],                        // dotted YAML paths of given parts (§11)
  reveal: 'all',                           // 'all' | 'on-request' (prediction tasks)
  sourceEditor: true,                      // false: no internal YAML tab
  readOnly: false,
  palette: undefined,                      // optional diagram palette override (§6.2)
  links: { patterns: {}, styles: {}, glossary: {} },
  host: {
    onTextChange(text, info) {},           // required; info = {reason, edits, version, label}
    onViewChange(selector) {},
    onSelectionChange(selection) {},
    openFile() {},                         // Promise<{text, name} | null>
    saveFile(text, info) {},               // Promise<void>
    exportSvg(svgText, info) {},           // Promise<void>
    copyText(text, info) {},               // "Copy ArchUML source", "Copy YAML"
    confirm(request) {},                   // Promise<boolean>; site: SebookConfirmation.confirm
    announce(message) {},
    createSourceEditor(container, options) {}, // returns a SourceEditor handle (below)
    undo: 'editor',                        // 'editor' | 'host'
    performUndo() {}, performRedo() {},    // required when undo === 'host'
    canUndo() {}, canRedo() {},            // required when undo === 'host'
    onRequestCheck() {},                   // tutorials: Ctrl/Cmd+Enter runs Test My Work (§9.2)
    onRequestSave() {},                    // tutorials: Ctrl/Cmd+S saves the design file (§9.2)
    onCheckNow(diagnostics) {},            // the learner chose Check now (§9.3)
    onSubmitForReview(diagnostics) {},     // the learner chose Submit for review (§9.3); tutorials open Test My Work
  },
});

editor.setText(text, { reason: 'external' }); // never calls onTextChange
editor.getText();
editor.openView('components of api');
editor.select('policy');
editor.getDiagnostics();
editor.submitForReview();                 // releases diagnostics when checks.display = 'after-submit'
editor.destroy();                         // removes every listener and timer
```

- `info.edits` is a list of `{offset, length, text}` splices against the previous text, so Monaco applies them with `pushEditOperations` and VS Code with a minimal `WorkspaceEdit`. `info.version` increases by one per emitted change.
- Echo suppression: `setText` with text equal to the editor's current text (which is its last emitted text while the host is in step) is a no-op; hosts guard their own change listeners while applying the editor's edits (the `writing` flag pattern from `CompilerTutorialEditor`).
- `undo: 'host'` routes Undo/Redo buttons and Ctrl/Cmd+Z/Y on the canvas to the host. Every host has exactly one undo stack. Hosts whose Monaco model is the persisted document (tutorials with `sourceEditor: false`, VS Code) use host undo; the SEBook site host keeps editor undo because its Monaco YAML tab loads lazily, and routes undo/redo keys in that tab to the editor while Monaco records none of the editor's pushes.
- `createSourceEditor` returns `{getValue, setValue, applyEdits, revealRange, setMarkers, focus, onDidChange, dispose}`. The site supplies Monaco with a textarea fallback.
- Theming: diagram colours come from the palette option (§6.2). Editor chrome uses `--c4-ui-*` custom properties with ArchUML defaults; the site maps its tokens with dark and print overrides; a VS Code host maps `--vscode-*`.
- Content security: no inline scripts, `eval` or `new Function`. Computed styles are set through the CSSOM. ArchUML's UML renderers emit inline `style` attributes on SVG roots, so the documented VS Code webview policy is `default-src 'none'; script-src ${cspSource}; style-src ${cspSource} 'unsafe-inline'; img-src ${cspSource} data:`. The C4 renderer itself uses presentation attributes and classes only.

### 3.5 Future VS Code path (not built)

The extension host `require`s `js/ArchUML/c4/c4-core.js` for diagnostics (ranges → Problems). A `CustomTextEditorProvider` webview loads the manifest scripts, the bundle, and the editor, plus a host adapter mapping the contract to `postMessage` and `WorkspaceEdit` with `undo: 'host'` and `sourceEditor: false` (the native text editor is the YAML surface). The versioned schema URL gives completion in the plain text editor.

## 4. The `design.yml` schema (`schema: c4-design/1`)

### 4.1 Principles

- Nesting mirrors zooming: `systems` → `containers` → `components` → `code`.
- Every software element (system, container, component, code element) has the same RDD slots: `responsibilities`, `collaborators`, `owns`, `provides`, `invariants`, `quality`, and optional `choices`. On systems, containers, and components, `provides` holds interface descriptions: what a client must know to use the element without reading its code, in a syntactic view and a semantic view (§4.11).
- Interfaces connect the two halves of RDD: a responsibility says what an element is obliged to do; an operation of its interface says how a client asks for it (`realizes`); a collaborator says which operation it uses (`uses`).
- Collaborators are the C4 relationships: written once on the element that asks, drawn as an arrow from initiator to receiver, labelled so it reads as a sentence ("Coordinator *asks for an eligibility decision from* Policy").
- Declare a relationship at the most detailed level you know; higher views derive it (§5).
- Model, views, and layout are separate. Views are derived; `views:` customizes them; `layout:` is editor-managed.

### 4.2 Worked example

This is the chapter's reference model, shipped as `_includes/c4-models/course-registration.yml` and as the Milestone 1b fixture `js/ArchUML/tests/c4/fixtures/course-registration-interfaces.yml` (both equal this block, without the `yaml-language-server` comment in the include). A unit test requires it (and every other shipped model and tutorial solution) to produce zero errors and zero warnings under default options.

The Milestone 1 fixture `js/ArchUML/tests/c4/fixtures/course-registration.yml` keeps the block as it stood before this revision (no interfaces, no chapter amendments) and is never re-synced with this section (J13). Compared with it, the element tree and the relationships' endpoints are unchanged (14 elements, 8 relationships, the seven default views, the container view's brief label); only the code-view label below changes wording. The interface additions:

- a shared `vocabulary` with "quarter unit", which every interface inherits;
- on the Registration API, the responsibility `api-billing` and the Enrollment API: a REST interface with interface-level restrictions and errors, one operation that realizes the API's three responsibilities, a request whose `section_ids` state their constraints, and an outcome that states its unit (quarter units), its date format, and a meaning for each status value;
- on the Billing System, the Tuition Charges message interface this team depends on (documented on the external system);
- `uses` on the two collaborators that cross a container or system boundary, and `refines: api-billing` on the Billing Gateway's responsibility, so the operation's side effect "requests the tuition charge" traces to a responsibility.

The chapter review's accepted amendments (2026-11-08):

- FR-07 reads "A student who lacks a prerequisite or would exceed the unit cap is refused before any seat is held, and is told why." (it was about clashes, which no element detected or explained, so the refinement trace from FR-07 broke);
- the browser node sends HTTPS requests to the ingress (`collaborators: {ingress: sends HTTPS requests to}`), so traffic enters the cluster through the ingress, and the deployment view draws no derived browser-to-pod path (§6.3);
- the API pod's technology is `Kubernetes pod` (was `Docker`);
- the code view's `EnrollmentPolicy` → `EnrollmentRule` label reads "delegates each eligibility check to".

The alignment review's instructor decisions (2026-11-09):

- the model's and the system's descriptions no longer promise conflict-free schedules, which no element detects ("Students plan a term schedule and enroll in every section of it, or in none." and "Plans term schedules and enrolls students in their sections.");
- the system-level requirement FR-11 ("Every completed enrollment is charged tuition, and a billing outage never delays an enrollment.", the chapter's worked derivation uses the same text) and the system responsibility `sys-billing` that traces to it; `api-billing` refines `sys-billing`, so the trace runs from the Billing Gateway through the Registration API to a requirement (the element and relationship counts do not change);
- Tuition Charges' operation syntax reads `send ChargeRequested to the queue billing.charges` and its restriction says who may *send* to the queue: a `message` interface's provider is the one receiver of commands that senders send (§9.3, Style definitions); `publish` stays the verb of `event` interfaces. The type keeps the name `ChargeRequested`.

The Registration Coordinator no longer lists `provides: ["evaluate(proposal) -> Outcome"]`: the web app's request enters through the Enrollment API, which the coordinator handles (the interfaces view shows it as delegated, §5.3), so a separate in-process interface on the coordinator would only be reported as unused. The shorthand is demonstrated by the §4.11 example. Fields and errors that carry prose are written as block maps, because commas and colons inside a flow map `{…}` start new keys; flow maps stay for short syntax-only entries.

```yaml
# yaml-language-server: $schema=https://tobiasduerschmid.github.io/js/ArchUML/c4/schema/1/design.schema.json
schema: c4-design/1
name: Course Registration
description: Students plan a term schedule and enroll in every section of it, or in none.
status: proposed
enterprise: UCLA

requirements:
  FR-07: A student who lacks a prerequisite or would exceed the unit cap is refused before any seat is held, and is told why.
  FR-09: A student is enrolled in every section of a plan, or in none.
  FR-11: Every completed enrollment is charged tuition, and a billing outage never delays an enrollment.

vocabulary:
  quarter unit: the UCLA credit unit; most courses are worth 4 quarter units

people:
  student:
    name: Student
    description: Plans and confirms one term schedule.
    collaborators:
      web: plans a schedule and enrolls using

systems:
  registration:
    name: Course Registration
    description: Plans term schedules and enrolls students in their sections.
    responsibilities:
      - decide: whether a student may enroll in a section
        id: sys-eligibility
        requirements: [FR-07]
      - do: hold a seat in every section of a plan, or in none
        id: sys-holds
        requirements: [FR-09]
      - do: request the tuition charge for every completed enrollment
        id: sys-billing
        requirements: [FR-11]
    containers:
      web:
        name: Planner Web App
        kind: browser_app
        technology: TypeScript, React
        description: Lets students compare draft schedules in the browser.
        responsibilities:
          - do: let students compare draft schedules
        collaborators:
          coordinator: {description: submits plans to, technology: JSON/HTTPS, uses: enrollment-api.submit-plan}
      api:
        name: Registration API
        technology: Python, FastAPI
        description: Decides eligibility and enrolls students atomically.
        responsibilities:
          - decide: whether a student may enroll in a section
            id: api-eligibility
            refines: sys-eligibility
          - do: hold a seat in every section of a plan, or in none
            id: api-holds
            refines: sys-holds
          - do: request the tuition charge for every completed enrollment
            id: api-billing
            refines: sys-billing
        provides:
          enrollment-api:
            name: Enrollment API
            description: Enrolls one student in every section of a planned schedule, or in none.
            style: rest
            technology: JSON/HTTPS
            version: 1
            restrictions:
              - Only the Planner Web App may call it, acting for the signed-in student named in the request.
              - A student may send at most 10 requests per minute.
            errors:
              unauthorized:
                code: 401
                when: the caller is not signed in as the student named in the request; the client asks the student to sign in again
              too-many-requests:
                code: 429
                when: the student sent more than 10 requests in one minute; the client waits for the Retry-After time and tries again
            operations:
              submit-plan:
                syntax: POST /v1/enrollments
                input: EnrollmentRequest
                output: EnrollmentOutcome
                purpose: When a client submits a student's plan for one term, the API decides whether the student may enroll and then enrolls the student in every section of the plan, or in none.
                side_effects:
                  - An enrolled outcome holds a seat in every section of the plan and requests the tuition charge from Billing.
                  - A refused outcome changes nothing.
                errors:
                  invalid-plan:
                    code: 422
                    when: the plan breaks a constraint of EnrollmentRequest, such as a section listed twice; the client shows the broken constraint
                  unknown-section:
                    code: 422
                    when: a section id does not exist in the requested term; the client shows the section and lets the student remove it
                examples:
                  - input: {student_id: "905123456", term: 2027-winter, section_ids: ["187204", "187310"]}
                    output: {status: enrolled, units_enrolled: 8, decided_at: "2027-01-05T09:30:00-08:00"}
                    note: Two 4-unit sections that do not clash.
                realizes: [api-eligibility, api-holds, api-billing]
            types:
              EnrollmentRequest:
                description: One student's plan for one term.
                fields:
                  student_id:
                    type: string
                    meaning: university id of the student who enrolls
                    format: nine digits
                  term:
                    type: string
                    meaning: the academic term of every section in the plan
                    format: "<year>-<fall | winter | spring | summer>"
                  section_ids:
                    type: string[]
                    meaning: the sections the student wants to take together
                    format: six-digit section ids
                    constraints: 1 to 8 items, no duplicates
              EnrollmentOutcome:
                description: The decision for the whole plan.
                fields:
                  status:
                    type: string
                    meaning: whether the plan was accepted
                    values:
                      enrolled: the student now holds a seat in every section of the plan
                      refused: the student holds no new seat; reason says why
                  units_enrolled:
                    type: number
                    meaning: total units the student holds in the term after this attempt
                    unit: quarter units
                  decided_at:
                    type: datetime
                    meaning: the moment the API decided the outcome
                    format: ISO 8601 with a UTC offset
                  reason:
                    type: string
                    meaning: the reason for a refusal in words a student understands
                    required: false
            vocabulary:
              section: one scheduled offering of a course in one term
              plan: the sections a student wants to take together in one term
        choices:
          technology:
            chosen: FastAPI 0.115 on Python 3.12
            alternatives: [Django REST Framework, Flask]
            because: typed request models and async database access
          styles: [layers]
        components:
          coordinator:
            name: Registration Coordinator
            technology: Python module
            stereotypes: [coordinator]
            responsibilities:
              - do: sequence one enrollment attempt
              - decide: which step of the attempt runs next
            collaborators:
              policy: asks for an eligibility decision from
              seats: reserves all seats or none through
              billing-gateway: asks for tuition charges through
            invariants: [never decides eligibility or writes seat state]
            quality: [an enrollment outcome appears within 2 s for 95% of attempts]
          policy:
            name: Enrollment Policy
            technology: Python module
            stereotypes: [service_provider]
            responsibilities:
              - decide: whether prerequisites and unit caps allow enrollment
                refines: api-eligibility
            code:
              EnrollmentPolicy:
                kind: class
                operations: ["+ decide(student, section): Decision"]
                collaborators: {EnrollmentRule: delegates each eligibility check to}
                choices: {patterns: [{pattern: Strategy, role: Context, instance: eligibility-rules}]}
              EnrollmentRule:
                kind: interface
                operations: ["+ evaluate(student, section): RuleResult"]
                choices: {patterns: [{pattern: Strategy, role: Strategy, instance: eligibility-rules}]}
              PrerequisiteRule:
                kind: class
                implements: [EnrollmentRule]
                operations: ["+ evaluate(student, section): RuleResult"]
                choices: {patterns: [{pattern: Strategy, role: ConcreteStrategy, instance: eligibility-rules}]}
              UnitCapRule:
                kind: class
                implements: [EnrollmentRule]
                operations: ["+ evaluate(student, section): RuleResult"]
                choices: {patterns: [{pattern: Strategy, role: ConcreteStrategy, instance: eligibility-rules}]}
          seats:
            name: Seat Gateway
            technology: Python module
            stereotypes: [interfacer]
            owns: [seat holds]
            responsibilities:
              - know: which seats are held for each attempt
              - do: hold every requested seat atomically, or none
                refines: api-holds
            collaborators:
              db: {description: writes seat holds to, technology: SQL/TCP}
          billing-gateway:
            name: Billing Gateway
            technology: Python module
            stereotypes: [interfacer]
            responsibilities:
              - do: request tuition charges for a completed enrollment
                refines: api-billing
            collaborators:
              billing:
                description: requests tuition charges from
                technology: AMQP
                connector: message
                uses: tuition-charges.charge-tuition
                choices:
                  technology: {chosen: RabbitMQ, alternatives: [synchronous HTTPS call], because: a billing outage must not block enrollment}
      db:
        name: Registration Database
        kind: database
        technology: PostgreSQL 16
        description: Durably stores plans, enrollment attempts, and seat holds.
        responsibilities:
          - do: durably store plans, enrollment attempts, and seat holds
  billing:
    name: Billing System
    external: true
    description: Charges tuition and fees for the university.
    provides:
      tuition-charges:
        name: Tuition Charges
        description: Accepts requests to charge tuition to a student's account.
        style: message
        technology: AMQP, JSON
        version: 2
        restrictions:
          - Only systems holding a university service credential may send to billing.charges.
        operations:
          charge-tuition:
            syntax: send ChargeRequested to the queue billing.charges
            input: ChargeRequested
            purpose: When a registration system reports a completed enrollment, Billing adds the tuition for the enrolled units to the student's account.
            side_effects:
              - Adds one charge to the student's account; a repeated message with the same request_id adds nothing.
            errors:
              malformed-message: the message does not match ChargeRequested; Billing moves it to the queue billing.charges.rejected, where the sender's operators review it
              unknown-student: no student account exists for student_id; Billing moves the message to billing.charges.rejected
            examples:
              - input: {request_id: 7f3c2a, student_id: "905123456", term: 2027-winter, units: 8, amount: 418400}
                note: Billing sends no reply; the charge appears on the student's account.
        types:
          ChargeRequested:
            description: One request to charge tuition for one enrollment attempt.
            fields:
              request_id:
                type: string
                meaning: identifies one charge request so that a repeated message is charged once
              student_id:
                type: string
                meaning: university id of the student to charge
                format: nine digits
              term:
                type: string
                meaning: the term the tuition is for
                format: "<year>-<fall | winter | spring | summer>"
              units:
                type: number
                meaning: units the student enrolled in by this attempt
                unit: quarter units
              amount:
                type: integer
                meaning: tuition owed for these units, before financial aid and without fees
                unit: US cents

scenarios:
  enroll:
    title: Enroll in a planned schedule
    steps:
      - web -> coordinator: submits the plan to
      - coordinator -> policy: asks for an eligibility decision from
      - alt:
          - when: eligible
            steps:
              - coordinator -> seats: reserves all seats or none through
              - coordinator -> billing-gateway: asks for tuition charges through
          - when: not eligible
            steps:
              - coordinator -> web: reports the refusal and its reason to

deployment:
  production:
    name: Production
    nodes:
      laptop:
        name: Student's computer
        kind: device
        nodes:
          browser:
            name: Web browser
            kind: environment
            technology: "Chrome, Firefox, or Safari"
            hosts: [web]
            collaborators:
              ingress: sends HTTPS requests to
      campus-cloud:
        name: Campus cloud
        kind: environment
        technology: Kubernetes
        nodes:
          ingress:
            name: Ingress load balancer
            kind: infrastructure
            technology: NGINX
            collaborators:
              api-pod: forwards HTTPS requests to
          api-pod: {name: API pod, kind: environment, technology: Kubernetes pod, instances: 3, hosts: [api]}
          postgres: {name: Managed database, kind: environment, technology: PostgreSQL 16, hosts: [db]}
      data-centre:
        name: University data centre
        kind: environment
        hosts: [billing]

decisions:
  one-database:
    title: Keep plans and seat holds in one relational database
    status: accepted
    context: Seat holds and enrollment must commit atomically.
    decision: One PostgreSQL database with serializable transactions for seat holds.
    alternatives: [a separate seat service with its own store]
    consequences: The database is a single point of failure.
    affects: [db, seats]
```

### 4.3 Top-level keys

`schema` (optional in embeds, written by the editor; §4.8), `name`, `description`, `status` (`sketch · proposed · accepted · implemented`), `enterprise` (name of the organization), `view` (embed selector and initial editor view; shared model files never declare it), `requirements`, `groups`, `people`, `systems`, `scenarios`, `deployment`, `decisions`, `views`, `checks`, `layout`, `vocabulary` (the model's shared dictionary, §4.11), and any `x-*` key.

### 4.4 Element fields

| Field | Person | System | Container | Component | Code |
|---|---|---|---|---|---|
| `name`, `description`, `collaborators`, `tags`, `source` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `external` (not designed or owned by this team; drawn grey) | ✓ | ✓ | | | |
| `in_enterprise` (default `true` when top-level `enterprise` is set) | ✓ | ✓ | | | |
| `group` | top-level `groups` | top-level `groups` | parent system's `groups` | parent container's `groups` | |
| `kind` | | | `application` (default) · `browser_app` · `mobile_app` · `desktop_app` · `function` · `database` · `file_store` · `queue` · `topic` | | `class` (default) · `interface` · `abstract_class` · `enum` · `function` · `module` |
| `technology` | | | ✓ | ✓ | |
| `responsibilities`, `owns`, `provides`, `invariants`, `quality`, `choices` | ✗ | ✓ | ✓ | ✓ | ✓ |
| `stereotypes` (`information_holder`, `structurer`, `service_provider`, `coordinator`, `controller`, `interfacer`) | | | ✓ | ✓ | ✓ |
| `groups` (definitions) | | ✓ | ✓ | | |
| `attributes`, `operations`, `extends`, `implements` | | | | | ✓ |
| Children | | `containers` | `components` | `code` | |

- People are actors, not design participants: `responsibilities` on a person is an error whose message says a person's goal belongs in `description`.
- `name` defaults to the id. `source` is a repository path or URL. `tags` are free strings.
- `external` and `in_enterprise` are independent: the university's own Billing System is external to this team yet inside the UCLA boundary; a third-party SaaS is `external: true, in_enterprise: false`.
- `browser_app` is a client-side web application running in the browser (browser-window shape); a server-side web application is an `application`.
- On systems, containers, and components, `provides` holds interface descriptions (§4.11), including on external systems: documenting the interface of a system this team does not own records what the team relies on (the Billing System's Tuition Charges).
- On code elements, `provides` keeps its Milestone 1 meaning, a list of signature strings, and declares no interface: a class's members are its `operations`, drawn in the code view. The full form on a code element is `schema/misplaced-field` ("Describe a class's operations in `operations`; describe the contract clients use on its component").
- People do not provide interfaces: a person's `provides` is `schema/misplaced-field` ("People do not provide interfaces; they may use one through `uses`").

### 4.5 Responsibilities, ownership, and refinement

- `responsibilities` is a list. An item is a string beginning with `KNOW`, `DO`, or `DECIDE` (case-insensitive), or a map with exactly one of `know`, `do`, `decide`, plus optional `id`, `refines` (one id or a list; must be owned by an ancestor element), and `requirements`. Untyped strings are accepted and reported by `rdd/untyped`.
- **KNOW** means the element can provide the information: it holds it, derives it, or obtains it from a collaborator ("knows does not mean stores").
- **`owns`** names facts for which the element is the single source of truth and the only writer.
- **Storage is DO**: a data-store container DOES durably store information; it is custody, not authority. The owner of the information writes it there.
- **Refinement**: a child (any descendant) responsibility `refines` the parent responsibility it helps realize. Coverage is defined over descendants everywhere (checks, carry-down tray, predicates).

### 4.6 Collaborators (relationships)

A map from target element id to one of: a string (the relationship description); a map `{description, technology, connector, responsibility, uses, choices}`; or a list of these for several relationships to the same target.

- `description` reads from source to target: "asks for an eligibility decision from". A description of one or two words is reported by `c4/vague-relationship` (catches noun phrases such as "section facts").
- `connector`: `call` (default) · `message` · `event` · `stream` · `shared-data`. `message`, `event`, `stream` are asynchronous and drawn dashed.
- `responsibility`: id of a responsibility owned by the target, a descendant of the target, or an ancestor of the target that is neither the source nor an ancestor of the source (the same rule as `uses`, §4.11): the help being requested. This only widens what Milestone 1 accepted.
- `uses`: the interface the source uses, as `<interface-id>` (some operations of the interface, unspecified) or `<interface-id>.<operation-id>`, or a list of these; resolved by decision J7 (§4.11). `uses` is not allowed on deployment-node collaborators.
- The responsibilities a relationship *requests* are its `responsibility` plus every responsibility realized by an operation it uses. Predicates (§8) and the step checks that ask whether a target advertises the requested responsibility read this set.
- When a relationship has no `technology` and every interface it uses has the same `technology`, views and checks use that technology for the relationship (it is drawn in the normal technology position; `c4/cross-container-technology` counts it).
- A collaborator map without `description` is accepted and reported by `rdd/no-reason`.

### 4.7 Design choices

Optional `choices:` on systems, containers, components, code elements, and collaborators:

- `technology`: `{chosen, alternatives, because, decision}`; `decision` names an entry in `decisions:`. The short `technology:` label stays the text drawn in diagrams.
- `styles`: architectural style names.
- `patterns`: `"Pattern"`, `"Pattern: Role"`, or `{pattern, role, instance, decision}`. Entries sharing an `instance` form one pattern application; entries without `instance` are not completeness-checked.
- `tactics`: strings.

Catalog (from SEBook chapters), with required roles in brackets: Strategy [Context, Strategy, ConcreteStrategy], State [Context, State, ConcreteState], Observer [Subject, Observer], Command [Command, ConcreteCommand, Receiver, Invoker], Adapter [Target, Adapter, Adaptee], Facade [Facade], Composite [Component, Leaf, Composite], Singleton [Singleton], Factory Method [Creator, Product], Abstract Factory [AbstractFactory, ConcreteFactory, AbstractProduct], Builder [Builder, Director], Mediator [Mediator, Colleague], Visitor [Visitor, Element], MVC [Model, View, Controller]. Styles: layers, pipes-and-filters, publish-subscribe, client-server, microservices, event-driven. Unknown names are allowed. The host supplies documentation links, so the core stays site-agnostic.

### 4.8 Other sections and parsing rules

- `groups` (top level for people and systems; on systems for containers; on containers for components): `{id: {name, description}}`. One level of grouping; groups are boundaries, not levels.
- `scenarios`: `{id: {title, description, steps}}`. A step is `"a -> b": description` or `{from, to, description, technology, connector, responsibility, uses}`. A step's `uses` names one operation (`<interface>.<operation>`); without it, a step takes its backing relationship's use when that relationship names exactly one operation. A step `uses` that is not among the backing relationship's uses fails `xlevel/scenario-step`. Fragments: `alt: [{when, steps}]`, `par: [{when, steps}]`, `opt: {when, steps}`, `loop: {when, steps}`, `break: {when, steps}`. Step semantics are in §6.3.
- `deployment`: `{environment-id: {name, description, nodes}}`. A node has `name`, `description`, `kind` (`device · environment · infrastructure`), `technology`, `instances` (integer ≥ 1), `hosts` (container ids **or** software-system ids), nested `nodes`, `collaborators` (to nodes in the same environment), `tags`. Infrastructure nodes are leaves: `hosts` or `nodes` on one is an error. Node ids are unique per environment.
- `decisions`: `{id: {title, status (proposed · accepted · superseded · rejected), context, decision, alternatives, consequences, affects, supersedes, date}}`.
- `requirements`: `{id: text}` or `{id: {text, kind (functional · quality · constraint)}}`.
- `views`: `{id: {view, title, description, include, exclude, direction (down · right), annotations (patterns · styles · tactics · interfaces), show_title, derived}}`. `view` is a built-in selector. `include` adds elements beyond the default selection (e.g. a container of another system, drawn inside its system's labelled boundary); `exclude` removes elements and their edges; `derived: false` hides derived edges. Reserved view ids: `landscape`, `context`, `containers`, `components`, `code`, `dynamic`, `deployment`, `interfaces`, `interface`. Allowed fields depend on the base view: a custom view based on `interfaces of <id>` accepts `title`, `description`, `show_title`, `exclude` (removes consumers and providers), and `direction` (`down`, the default: consumers above, the element in the middle, providers below; or `right`); a custom view based on `interface <id>` accepts `title`, `description`, and `show_title`. Other fields on these two are `schema/misplaced-field`, reported by `load()` (the model knows the base type from the shared selector grammar, §5.1). `annotations: [interfaces]` is allowed on views whose base is landscape, context, container, component, or dynamic (§5.1).
- `checks`: `{ignore: [{rule, element, because}]}`. An entry without `because` is inactive and reported (`checks/unexplained-ignore`).
- `layout`: `{canonical-view-key: {element-id: [x, y]}}`, written by the editor. Built-in views are keyed by their canonical selector; custom views by their id. Under the key of a UML-notation view the entry is a map with named parts instead (`docs/superpowers/specs/2026-11-12-c4-uml-view-editing.md` §4.2): `positions` (`{id: [x, y]}`, the top-left corner of a drawn box; in a code view every drawn box, in an interfaces view every drawn box, in a deployment view top-level nodes only), `routes` (code and deployment views: a list of `{from, to, relation, points}`, with `relation` `collaborator`, `link`, or `derived`, and a hosted instance written `<element>@<node>`), and `lifelines` (dynamic views: the lifeline order as element ids). What cannot hold a position or a bend is refused with a reason: positions of nested nodes and hosted instances (`layout/inside-node`), bends of generalization and realization lines (`layout/inheritance-line`), a bend where two lines of one kind join one pair in one direction (`layout/parallel-lines`), and in an interfaces view a bend of a ball-and-socket line or a position of a ball or socket (`layout/assembly`, `layout/port`). A flat pin map under a UML view key is `schema/type`, a part the view type lacks `schema/unknown-key`; an entry naming something the view no longer draws is ignored when drawing and removed at the editor's next layout write. The command `setUmlLayout` writes the parts (`layout/part` for a part the view lacks); `pinPosition` and `unpinPosition` refuse a UML view key (`layout/uml-view`).
- `schema`: optional in embeds (defaults to `c4-design/1`); the editor writes it; a missing `schema` in a file opened by the editor or CLI is `schema/version` (info); an unknown version is `schema/version` (error); a CS 188 RDD file (`schema_version: "1.0"` with `CAN-` components) gets a dedicated error explaining that the C4 editor uses a different format.
- YAML is parsed with the failsafe schema (every scalar is a string, so `1.10`, `no`, and `on` keep their exact text); only known typed fields are converted (`external`, `in_enterprise`, `show_title`, `derived` → booleans; `instances` → integer; layout coordinates → numbers). Inside interface descriptions only a field's `required` is converted (to a boolean), and only inside a field map; typed conversion and unknown-key checks never apply to the keys of `fields`, of inline field maps, of `errors`, of `values` maps, of `vocabulary`, or to anything under `examples`, because those keys are user data (a field may be called `required`, `external`, or `instances`). Interface `version`, error `code`, and every value inside `examples` stay text, so `version: 1.10` and an example value `no` keep their exact spelling.
- Unknown keys are errors with a "did you mean" suggestion; `x-*` keys are allowed and preserved.
- Ids match `^[A-Za-z][A-Za-z0-9_-]*$`. Element ids are unique across the model; responsibility, requirement, decision, scenario, environment, group, and view ids each have their own namespace; deployment node ids are unique per environment.
- Shorthands accepted on read: responsibility strings, collaborator strings, `"a -> b": text` steps, pattern strings, a `provides` list of signature strings, operation strings (syntax only), field strings (type only), error strings (the `when` text), and value lists (values without meanings) (§4.11). The editor writes shorthand when a value has no extra fields.
- Canonical key order for new elements: `name, description, kind, technology, external, in_enterprise, stereotypes, group, responsibilities, collaborators, owns, provides, invariants, quality, choices, <children>, tags, source`.
- Caption in embeds: the YAML comment `# caption: …` on the first line (ArchUML's existing caption syntax; the YAML parser ignores it).

### 4.9 Editing by text splices

`yaml` 2.9.1 re-serializes a whole document when printing (alignment of comments, flow-collection padding, and line wrapping all change) and cannot print a document with errors. The core therefore never re-prints a document. Each edit command locates the target node through its source range (CST tokens kept), stringifies only the new or changed node with fixed options (indent 2, `lineWidth: 0`, `flowCollectionPadding: false`), and splices it into the original text. `edit()` returns `{text, edits: [{offset, length, text}], selection}`. While the document has YAML errors, edit commands are unavailable (§7.3).

Test oracle: for every command on every shipped model, the bytes outside the returned edit ranges are identical to the input, and add-then-delete restores the original text exactly.

### 4.10 Identity rules

- New element id = slug of its name, fixed at creation: NFKD, strip marks, lowercase, runs of non-alphanumerics → `-`, trim `-`; if empty or not starting with a letter, prefix the type initial (`c-`, `p-`…); collisions append `-2`, `-3`. Code element ids keep PascalCase (`Enrollment Policy` → `EnrollmentPolicy`). Renaming changes `name` only; the id shows under More › Id. One exception (final review I6, 2026-11-11): an element the editor adds on the canvas is named "New <type>" with that name's id (`new-container`), and its first rename also gives it the id of the committed name, in the same undo step, while it still has that placeholder name and id, nothing but its own positions refers to it, and the open view is not inside it. So the `design.yml` a learner hands in and the selectors they type carry ids that read like the names. The user confirmed this rule on 2026-11-13 (UML-view editing spec §14, D1) and extended it to deployment nodes (placeholder "New node" or "New infrastructure node", through `renameNode` and the core command `changeNodeId`, which rewrites the node's key, the link keys of its environment, and its layout sites in that environment's deployment views) and interfaces (through `renameInterface`; the open view must not be its card, and no stored `interface <id>` selector may name it, `interfaceSelectorsOf`). Every rename, from a canvas or a form, goes through the shared action of its kind, so each kind has one implementation of the four conditions. A deployment node has no "Change id…" control; after its first rename its id changes only in the YAML.
- Responsibility ids are generated when first needed (a refinement link, a collaborator `responsibility`): `<element-id>-<kind>-<n>`.
- "Change id…" rewrites every reference (and, in the layout parts of UML-notation views, `positions` keys, both ends of a route including the element part of an instance key, and `lifelines` items): collaborator keys, `refines`, collaborator `responsibility`, `decisions.affects`, `hosts`, `extends`, `implements`, scenario steps (map form and shorthand keys), `views.*.include/exclude`, view selectors (`views.*.view`, top-level `view`, including `interfaces of <id>` and the `of <id>` of `interface <i> of <id>`), `layout` keys and entries, `checks.ignore[].element`, and every `uses` entry and `interface <id>` selector naming the element's shorthand interface (whose id is the element id, §4.11). The dialog warns that references outside the file (tutorial configuration, predicates) are not rewritten. A unit test covers each site.
- "Change interface id…" rewrites `uses` entries (relationships and scenario steps) and `interface <id>` selectors. Renaming an operation rewrites `<interface>.<operation>` entries. Renaming a type rewrites `input`, `output`, and field `type` references inside the same interface (`T` and `T[]`).
- Delete lists every dependent reference in its confirmation and removes them: incoming collaborators, scenario steps, `hosts`, `affects`, include/exclude, layout entries, ignore entries, and `refines` links from child responsibilities. A reference inside a subtree that the same command already removes (an incoming collaborator, a deleted element's own interfaces) is neither listed nor edited separately, so no edit lies inside another. What remains for interfaces: `uses` entries whose provider is a strict descendant of a surviving target (`web → api` using `coordinator.evaluate` when `coordinator` is deleted: the collaborator stays and loses only that entry; an emptied `uses` key is removed), and `realizes` entries on a surviving ancestor's operation that name a deleted descendant's responsibility. Deleting an interface or an operation removes the `uses` entries that name it; deleting a responsibility removes it from `realizes` lists.
- Move (re-parenting by `moveElement` or the outline drag) lists the `uses`, `responsibility`, and `realizes` entries that stop resolving under §4.6 and §4.11 after the move, and removes them in the same splice after confirmation, as Delete does.
- Canonical selector form (layout keys, comparisons): lowercase plural keyword, single spaces, the element id exactly as declared (an interface id in lowercase, since interface ids are unique ignoring case, §4.11): `containers of registration`. Element ids are case-sensitive everywhere (they are YAML keys), so `components of API` does not name `api`.

### 4.11 Interfaces: syntax and semantics

An interface description says what a client must know to use an element correctly without reading its code (Clements et al. 2010; lecture L14). An interface is not a C4 abstraction (J14): it is the contract a system, a container, or a component offers wherever a client crosses its boundary. The description has two views, and the schema keeps them apart so the editor, the card, and the checks can treat them separately:

- **Syntactic view**: the interface's style, technology (protocol and document format), and version; its operations, each with a `syntax` line as a client would write it, an `input`, and an `output`; the named types those refer to, with fields, field types, whether a field is required, allowed values, and `constraints` (ranges, patterns, lengths, cardinality). A schema such as JSON Schema or OpenAPI can check this view automatically.
- **Semantic view**: per operation, its `purpose`, `side_effects` (state changes visible outside the provider), `restrictions` (who may call it, preconditions, rate limits), `errors` (what can go wrong, why, and what the client should do), `examples`, and `realizes` (the provider's responsibilities the operation fulfils); per field, its `meaning`, `unit`, `format`, an `example`, and a meaning for each allowed value; a `vocabulary` of shared terms. Only people and integration tests can check this view; a stated unit is what makes such a test possible.

This is the RDD contract made explicit (Wirfs-Brock & McKean 2003): the advertised responsibility (`purpose`, `realizes`), the client-supplied information (`input`), the conditions of use (`restrictions`), and the aftereffects (`output`, `side_effects`, `errors`). The provider's private implementation is not part of it.

**Placement.** `provides` with interfaces is allowed on systems, containers, and components (§4.4). Declare an interface on the element a client addresses: a container's HTTP API on the container, a remote endpoint that one component exposes (a controller with its own route) on that component with its remote `style`, an in-process module's operations on the component with `style: library`. A component's in-process interface is reachable only from its own container (`interface/in-process-across-boundary`). An external system may document the interface this team relies on. The provider of an `event` or `stream` interface is its emitter; the provider of a `message` interface (commands) is its receiver.

**Forms.**

1. Shorthand list: `provides: ["GET /readers/{id}", "POST /orders"]`. The list is one *shorthand interface* whose id is the element id, whose name is "<element name> interface", and whose operations have only a `syntax`. It is a sketch: semantic rules do not apply to it, and `interface/syntax-only` (info) suggests the full form once it is used across a container or system boundary.
2. Full form: a map from interface id to an interface map. Mixing strings and maps in one `provides` list is `schema/type`.

An empty list or map declares no interface. The addition is backward compatible (every Milestone 1 `provides` list keeps its meaning), so the schema version stays `c4-design/1`.

**Interface map** (canonical key order): `name` (default: the id), `description`, `style` (`rest · rpc · graphql · soap · message · event · stream · library · file`; unset means "not sure yet"), `technology` (protocol and document format, such as `JSON/HTTPS`), `version` (text), `restrictions` and `errors` (apply to every operation, written once: authentication, rate limits, malformed requests), `operations`, `types`, `vocabulary`, and `x-*` keys. `operations` may be empty or absent when `types` is not: the interface is then a **document format** (a file or record two systems exchange), its `description` carries the purpose, and clients use it with a whole-interface `uses`.

**Operation** (`operations: {operation-id: …}`): a string is the `syntax` alone. A map has, in canonical order: `syntax`, `input`, `output`, `purpose`, `side_effects`, `restrictions`, `errors`, `examples`, `realizes`.

- `syntax`: one line, such as `POST /v1/enrollments`, `evaluate(plan) -> EnrollmentOutcome`, or `send ChargeRequested to the queue billing.charges`. A `{name}` placeholder is filled by the input field of the same name (`GET /v1/plans/{id}` takes the input field `id`; the card prints "id (in the path)"); `interface/unbound-parameter` reports a placeholder without one.
- `input`, `output`: a type expression (below) or an inline field map (same shape as a type's `fields`). For a request/response or `message` operation the payload is `input`; for an `event` or `stream` operation (something the provider emits) the payload is `output` and there is no `input`.
- `side_effects`, `restrictions`: a string or a list of strings. An operation also has every interface-level restriction.
- `errors`: a map from error name to a string (when and why it happens, and what the client should do) or `{when, code}` (`code` is the protocol's code, such as `401`). An operation also has every interface-level error; checks and predicates count both.
- `examples`: a list of `{input, output, note}` (at least one of the three keys); `input` and `output` hold any YAML value, kept as failsafe data, and the model also keeps each one's source text in one-line flow form (`inputText`, `outputText`), so the card prints `units_enrolled: 8` as written, not as a quoted string. `interface/example-mismatch` checks examples against the declared types.
- `realizes`: a responsibility id or a list of them (KNOW, DO, or DECIDE). It names the provider's own responsibilities; a descendant's responsibility is accepted when it refines, at any depth, one of the provider's, and then counts as contributing to it (J12). A descendant's responsibility that refines none of the provider's is a private obligation (`interface/realizes-internal`); a responsibility of anything else is `model/realizes-owner`. A query operation usually realizes a KNOW responsibility; a command a DO or DECIDE responsibility.

**Type** (`types: {TypeName: …}`): `{description, fields}`. **Field** (`fields: {field_name: …}`): a string is the `type` alone; a map has, in canonical order: `type`, `meaning`, `unit`, `format`, `required` (boolean, default `true`), `values`, `constraints`, `example`.

- `values`: a list of allowed values (shorthand), or a map from value to meaning (`{enrolled: the student holds a seat in every section, refused: …}`); the syntactic view shows the values, the semantic view their meanings.
- `constraints`: a string or a list of strings stating what a schema would check: `> 0`, `at most 8 items`, `matches ^[A-Z]{3}$`, `1 to 8 items, no duplicates`.
- `unit`: what one step of a number means (`US cents`, `quarter units`, `seconds`, `items`). `format`: how a value is written (`ISO 8601 with a UTC offset`, `nine digits`). A field's `type` is always a type expression; a nested structure is a named type of the same interface.

**Type expressions**: `name` or `name[]` (a list). `name` is a primitive (`string · integer · number · decimal · boolean · date · datetime · time · duration · uuid · uri · binary · any`) or a type of the same interface. Types are local to their interface. Spellings from other languages are read as synonyms and normalized: `str` → `string`, `int` → `integer`, `float` and `double` → `number`, `bool` → `boolean`, `dateTime` and `timestamp` → `datetime`, and `List<T>`, `list[T]`, `Array<T>` → `T[]`; each spelling is reported once per interface as `interface/type-spelling` (info) and the editor writes the standard form. A named type the interface does not define, or text that is not a type expression (`a number`), is `interface/undefined-type` (warning, "PaymentMethod is used but not described; add it under Types"). So a first draft copied from lecture slides (`flightNumber: str`, `paymentReference: PaymentMethod`) loads without errors.

**Writing prose in YAML.** Inside a flow map `{…}`, a comma starts a new key: `{meaning: total units, after this attempt}` declares a second key `after this attempt`. Such a stray key is `schema/unknown-key`; when it has no value and contains a space, the hint reads "A comma inside a {…} value starts a new key; write this field as a block map, one key per line, or put the text in quotes." Write fields, errors, and purposes that carry prose as block maps (as the reference model does); keep flow maps for short syntax-only entries (`id: string`, `{type: string, values: [a, b]}`). The editor writes a field as a block map once it gains a `meaning`, and quotes text where YAML needs it.

**Canonical key order** for new entries, used by the editor's splices: interface `name, description, style, technology, version, restrictions, errors, operations, types, vocabulary`; operation `syntax, input, output, purpose, side_effects, restrictions, errors, examples, realizes`; type `description, fields`; field `type, meaning, unit, format, required, values, constraints, example`; error `when, code`; example `input, output, note`; collaborator map `description, technology, connector, responsibility, uses, choices`.

**Vocabulary**: `vocabulary: {term: meaning}`, at the top level (the model's shared dictionary, which every interface inherits and every card prints under "Shared vocabulary") and per interface (terms that only this interface needs). Terms are free text ("quarter unit"). An interface that redefines a shared term with a different meaning, or two interfaces that define one term differently, are reported by `interface/conflicting-vocabulary`.

**Identity and references.**

- Interface ids match the element id pattern and share the element namespace: an interface id may not equal another interface id or an element id, ignoring case, except that any interface, shorthand or full form, may have its own providing element's id (`model/duplicate-id`); a shorthand interface always does, and expanding it to the full form keeps that id so its `uses` references keep resolving. Selectors and predicates match interface ids ignoring case.
- Operation ids, error names, and value keys are unique within their map (YAML keys); operation ids and error names match the id pattern. Type names match `^[A-Za-z][A-Za-z0-9_]*$`; field names match `^[A-Za-z_][A-Za-z0-9_-]*$`.
- Shorthand operation ids are derived, deterministically and once per read, after ignoring a leading UML visibility marker (`+`, `-`, `#`, `~`) and leading underscores: a leading identifier followed by `(` gives that identifier (`evaluate(plan) -> EnrollmentOutcome` → `evaluate`); an HTTP method followed by a path gives the slug of method and path (`POST /orders` → `post-orders`); otherwise the slug of the first three words; an empty slug or one not starting with a letter becomes `op`; collisions append `-2`, `-3` in list order. Converting a shorthand interface to the full form (editor command, §9.5) writes these ids, so references keep resolving.
- `uses` resolution (decision J7): an entry is `<interface>` or `<interface>.<operation>` (ids contain no dots, so a second `.` is `schema/value`). For a relationship from S to T naming interface I provided by P, the use is valid when (1) P is T, a descendant of T, or an ancestor of T that is neither S nor an ancestor of S (a *request*); (2) P is S and I's style is `event` or `stream` (S *emits* I to the subscriber T), or P is S and T is a container of kind `queue` or `topic` (S connects its own interface to the channel: it publishes its events there, or receives its commands from there); or (3) T is a `queue` or `topic` container and P, another element, has its own relationship to T (a *broker peer*: a subscriber reading the publisher's events, or a sender putting the receiver's commands on the queue). Otherwise the use is `model/interface-provider`. Unknown interfaces, operations, and `realizes` responsibilities are `model/unknown-reference` with a suggestion; when the first part of a `uses` entry is an element id that is not a shorthand interface, the hint names that element's interfaces ("api is an element; name one of its interfaces: enrollment-api").
- Counting uses: a request, an emission to a subscriber, and a broker-peer use make the interface *used*; an emission into a `queue` or `topic` (case 2 with a broker target) only declares the channel and does not count as a use. A whole-interface use counts every operation of the interface as used; it does not match a predicate asking for a specific operation (§8).
- A relationship without `uses` that summarizes lower-level relationships (they lift onto the same pair with the same synchrony, §5.2) carries their uses, marked `inherited`, for views, checks, and predicates.

**Text splices.** Interface edits follow §4.9: each command replaces or inserts one node. Converting the shorthand list to the full form is one splice replacing the `provides` value. Field, error, value, vocabulary, and example edits insert or delete one map entry or sequence item; an inline field map is edited in place; a field written as a type string switches to the map form only when a second key is set, and to a block map once it has a `meaning`. Example input and output are written from the text the user typed (validated as one flow node), never re-printed from data. The byte-preservation oracle (§4.9) covers every interface command.

**Example** (a separate small model; the comments name every interface diagnostic it produces; Milestone 1 rules add their own, such as `rdd/no-responsibility` on the Campus Shop system):

```yaml
schema: c4-design/1
name: Campus Shop
systems:
  shop:
    name: Campus Shop
    description: Sells printed course readers to students.
    containers:
      app:
        name: Shop App
        technology: Python, Flask
        description: Takes orders for course readers and charges for them.
        responsibilities:
          - do: take an order for a course reader
            id: app-orders
        collaborators:
          payments:
            description: charges the order total through
            technology: JSON/HTTPS
            uses: card-payments.charge
        # Shorthand: one interface with id "app" and operations get-readers-id and post-orders.
        # interface/unused (info): no relationship uses it yet.
        provides: ["GET /readers/{id}", "POST /orders"]
  payments:
    name: Payment Provider
    external: true
    description: Charges credit and debit cards for online shops.
    provides:
      card-payments:
        name: Card Payments API
        style: rest
        technology: JSON/HTTPS
        version: 3
        operations:
          charge:
            syntax: POST /v3/charges
            input:
              amount:
                type: integer
                meaning: total to charge, including sales tax
                unit: US cents
              card_token:
                type: string
                meaning: one-time token the browser received for the card
              idempotency_key:
                type: string
                meaning: see the vocabulary entry idempotency key
            output: Charge
            purpose: When a shop sends an amount and a card token, the provider charges the card once and reports whether the money moved.
            side_effects:
              - The card is charged once; a repeated idempotency key charges nothing.
            restrictions:
              - Callers authenticate with the shop's secret key.
            errors:
              card-declined:
                code: 402
                when: the card issuer refused the charge; the shop asks for another card
              invalid-amount:
                code: 400
                when: the amount is zero or negative; the shop fixes its total before trying again
            examples:
              - input: {amount: 1250, card_token: tok_visa, idempotency_key: order-77}
                output: {id: ch_1, status: succeeded}
                note: A 12.50 USD charge that succeeds.
          # Operation shorthand (syntax only): interface/no-purpose (warning),
          # interface/no-errors (warning: a REST interface), and
          # interface/unused-operation (info: the shop uses only charge).
          refund: POST /v3/refunds
        types:
          Charge:
            description: The result of one charge.
            fields:
              id: string    # field shorthand; interface/no-meaning (info)
              # A value list without meanings on an interface used across a system boundary:
              # interface/no-meaning (info).
              status: {type: string, meaning: whether the money moved, values: [succeeded, failed]}
        vocabulary:
          idempotency key: a client-chosen string that makes a repeated request take effect only once
```

**Model additions** (normative for Milestone 1b): `Model.vocabulary: [{term, meaning, path}]`; `Model.interfaces: Map<id, Interface>`; `Element.interfaceIds`; `Element.provides` stays a flat list of syntax lines (the operation's `syntax`, else its id; on code elements the Milestone 1 strings) so code written against Milestone 1 keeps working; `Relationship.uses: [{interfaceId, operationId | null, text, path, kind: 'request' | 'emit' | 'channel' | 'broker-peer', inherited}]`; `Relationship.requests: string[]` (§4.6).

## 5. Views and projection

### 5.1 View catalog and selectors

| View | Selector | Primary elements | Notation |
|---|---|---|---|
| System landscape | `landscape` | All people and systems | C4 |
| System context | `context of <system>` | The system | C4 |
| Container | `containers of <system>` | The system's containers | C4 |
| Component | `components of <container>` | The container's components | C4 |
| Code | `code of <component>` | The component's code elements | UML class diagram |
| Dynamic | `dynamic <scenario>` | The scenario's participants | UML sequence diagram |
| Deployment | `deployment <environment>` | The environment's nodes and instances | UML deployment diagram |
| Interfaces | `interfaces of <system, container, or component>` | The element, the interfaces it provides and requires, their consumers and providers | UML component diagram (provided and required interfaces) inside a C4 title, legend, and notes |
| Interface description | `interface <interface-id>` | One interface | Interface card (semantic HTML) |
| Custom | `<view id>` | As its base view | As its base view |

Accepted synonyms: `container of`, `component of`, `system context of`; keyword matching is case-insensitive, while the id is matched exactly. Without `view:`, an embed shows the context view of the first non-external system, or the landscape. A selector naming an unknown view or element, or an element of the wrong type (`code of api`, `components of registration`), is `view/unknown-selector` or `view/wrong-scope-type` (error); embeds render an accessible error figure listing the valid views.

Selector grammar (keywords are case-insensitive; element ids are matched exactly, §4.10; interface ids are matched ignoring case, §4.11; single spaces in the canonical form). The grammar is a pure function in `c4-schema.js` (`parseSelector`, `canonicalSelector`, `selectorKey`), used by the model (layout keys, per-base view fields) and by the projection:

```
selector    := base [" with " annotation ("," annotation)*]
base        := "landscape"
             | ("context" | "system context") " of " id
             | ("containers" | "container") " of " id
             | ("components" | "component") " of " id
             | "code of " id
             | "dynamic " id
             | "deployment " id
             | "interfaces of " id
             | "interface " interface-id [" of " id]
             | view-id
annotation  := "interfaces" | "patterns" | "styles" | "tactics"
```

- `with …` is equivalent to a custom view over the same base with the same `annotations` (added to a custom view's own), so embeds and the editor can show interfaces without declaring a view. It is allowed exactly where that custom view could carry the annotation: `interfaces` on landscape, context, container, component, and dynamic views; `styles` and `tactics` on landscape, context, container, and component views; `patterns` there and on code views (§6.3); elsewhere it is `view/wrong-scope-type`. The canonical form sorts annotations alphabetically (`containers of registration with interfaces, patterns`).
- `selectorKey` gives the view's key (§4.8 layout keys, `ViewModel.key`): the canonical base without the suffix, or the custom view id, so pins are shared between the plain and the annotated view. Layout keys are normalized with `selectorKey` (`Containers of registration with interfaces` → `containers of registration`). Milestone 1's `canonicalSelector()` keeps its meaning for selectors without a suffix.
- `interfaces of` names a system, container, or component; a person or a code element is `view/wrong-scope-type` (the message points to the code view for a class's operations). `interface <id>` names an interface id, matched ignoring case (J10); the canonical form drops a trailing `of <element>`, which must name the interface's provider (otherwise `view/wrong-scope-type`, naming the provider). `interface of <x>`, when no interface has the id `of`, is reported as `view/unknown-selector` with the suggestion `interfaces of <x>`.
- `listViews(model)` is unchanged (the seven selectors of the reference model). `listViews(model, {interfaces: true})` appends `interfaces of <id>` for every system, container, and component that provides or requires an interface (§5.3), in document order, then `interface <id>` for every interface, in document order; the reference model gives six and two. The editor's Interfaces control and the CLI's `views --interfaces` use the option.
- Breadcrumbs: an interface view is a view of its element, not a level (J14). `interfaces of E` appends "Interfaces of <E name>" to the trail of the view that shows E as a primary element; `interface I` appends "Interface description: <I name>" to the trail of the view that shows I's provider as a primary element.

### 5.2 Projection algorithm for C4-notation views

1. **Eligible set** per view type:
   - landscape, context: people and systems;
   - container (scope system S): people, systems other than S, S's containers;
   - component (scope container C in S): people, systems other than S, S's other containers, C's components;
   - plus elements named in a custom view's `include` (containers of other systems are drawn inside a labelled boundary of their system).
2. **Lift** each relationship endpoint to its nearest eligible ancestor-or-self. An endpoint that lands on the scope element (S in a container view, C in a component view) is a *boundary landing*.
3. **Keep** the primary elements plus their direct neighbours through lifted edges; draw every lifted edge among kept elements, including edges between two neighbours.
4. **Boundary landings**: drop silently when a child-level edge with the same counterpart and direction exists. Otherwise keep the counterpart visible and draw the edge to the boundary in a legend-explained "not yet assigned to a container/component" style, and report `xlevel/unreceived` (incoming) or `xlevel/unsent` (outgoing) with a quick fix that chooses the child. This keeps the novice sequence (system first, then people and dependencies, then containers) visually continuous.
5. **Explicit wins**: when relationships are declared between two kept elements, derived edges of the same synchrony between that pair are dropped. Otherwise lifted edges of the same synchrony (`call`/`shared-data` vs asynchronous) between the same pair merge into one derived edge carrying its provenance; it shows the first description plus "(+N more)", and a technology only when all sources agree.
6. **Exclude** removes elements and their edges; `derived: false` removes derived edges.
7. Context and landscape views omit relationship technology. The landscape and context views draw the enterprise boundary around elements with `in_enterprise` true when `enterprise` is set.
8. The view model carries title ("Container view: Course Registration"), description, nodes, nested boundaries and groups, edges, legend entries actually used, breadcrumbs (Landscape › Context › Containers › Components › Code), drill targets, and the element count (a view over 20 elements renders and reports `c4/large-view`).
9. **Interfaces on edges**: every edge carries `interfaces: [{interfaceId, name, operationIds, inherited}]`, the union of its sources' uses in document order (`operationIds` is empty for a whole-interface use). An explicit relationship carries its own `uses`; when it declares none, it carries the uses of the lower-level relationships it summarizes (those that lift onto the same pair with the same synchrony, the set `xlevel/unsummarized` and `xlevel/summary-copy` already compute), marked `inherited: true`. So an explicit summary `registration → billing` that wins over the derived edge still shows "via Tuition Charges". When an edge has no technology and all its interfaces agree on one, the edge takes it (`technologySource: 'interface'`; otherwise `'relationship'` for a declared technology and `null` for none). Edges carry interfaces whether or not the view is annotated; only annotated views draw them.
10. **Interfaces on nodes**: when the view's annotations include `interfaces`, each software node carries `interfaces: [{interfaceId, name, declaredOnName, delegatedFromName}]`: its *provided set* (§5.3, rule 1); otherwise `[]`.
11. **Selector and key**: the view model gains `selector` (the canonical selector including any `with …` suffix) and `annotations` (the effective list); `key` keeps its meaning, the layout key (`selectorKey`).
12. **Dynamic views with interfaces**: in a dynamic view annotated with `interfaces`, a message whose step uses one operation (its own `uses` or its backing relationship's single operation, §4.8) carries `operation: {interfaceId, operationId, syntax}`; the sequence label appends the syntax in parentheses ("submits the plan to [JSON/HTTPS] (POST /v1/enrollments)").
13. **Fields for UML-view editing** (added fields only; no existing field changed, and a baseline test shows that no `toUml` text or `describe` output changed; UML-view editing spec §4.1): code views carry per class `lifted` and `synthesizedOperations`, and per relation `relationshipId`, the declared ends `modelSourceId` and `modelTargetId`, and `lifted: { source, target }`; dynamic views carry per message and fragment `step: { containerPath, index }` counted in the model's step list, per message `status`, `reasonCode`, and `relationshipIds`, per branch its index, `containerPath`, and `stepCount`, and `uml.stepCount`; deployment views carry per link `derived` and, for a derived path, its `relationshipIds`, and per hosted instance `nodeId`. Every UML-notation view carries `layout`, its normalized layout entry (§4.8) or `null`.

### 5.3 Projection of interface views

**`interfaces of E`** (notation `uml-component`; E is a system, container, or component):

1. *Provided set*, in this order without duplicates: the interfaces declared on E; the interfaces declared on E's descendants that a relationship from outside E uses (marked `declaredOn`, "offered through <descendant name>"); and the interfaces declared on an ancestor A of E that a relationship from outside A uses while targeting E or a descendant of E (marked `delegatedFrom`, "delegated from <A name>": E handles calls that enter A through that interface, UML delegation).
2. *Required set*: for every relationship whose source is E or a descendant of E, whose target is outside E, and whose use is a request or a broker-peer use, each interface it uses (deduplicated); E requires it. Emissions are not requirements.
3. *Consumers*: for each provided interface, the elements that use it (the source of a request or a broker-peer use; the target of an emission to a subscriber), outside E, each lifted to the child of the lowest common ancestor of that element and E that contains the element, or to the element's top-level system or person when the two share no ancestor (the element at E's level of abstraction: for a container E, a sibling container or another system). *Providers*: for each required interface, its provider, lifted the same way. A person is lifted to itself and then left out of the components: it is listed in `people` and in a note ("Also used directly by Student (person)"), because the component notation has no actor.
4. One assembly per (provider node, interface, consumer node), labelled with the syntax lines of the operations used, in document order ("+N more" after two; no label for a whole-interface use), followed by "(through <broker name>)" for a broker-peer use.
5. A provided interface that nothing uses is drawn without an assembly. An element with no provided and no required interfaces shows the scope alone with the text "<E name> provides and uses no described interfaces yet."
6. The view model's `uml` is `{ components: [{ id, name, typeLabel, role: 'consumer' | 'scope' | 'provider', external, provides: [{ interfaceId, name, declaredOnId, declaredOnName, delegatedFromId, delegatedFromName }], requires: [{ interfaceId, name }] }], assemblies: [{ interfaceId, providerId, consumerId, label, throughId, throughName }], people: [{ id, name, interfaceIds }], notes: [string], emptyText, direction }`. Components are ordered consumers, scope, providers (document order within each role). The projection adds nothing to this view for UML-view editing: its components, ports, and assemblies already carry their ids; it carries `layout` like the other UML-notation views (§5.2, item 13). `notes` holds, in order, the person note, one "offered through" note per `declaredOn` interface ("Enrollment endpoint is offered through Enrollment Endpoint."), and one "delegated" note per `delegatedFrom` interface ("Enrollment API belongs to Registration API; Registration Coordinator handles its calls."). Title: "Interface view: <E name>". `exclude` removes consumers and providers with their assemblies; `direction` comes from a custom view (default `down`); `include` and `derived` do not apply.

On the reference model: `interfaces of api` has the consumer Planner Web App, the scope, and the provider Billing System; `interfaces of coordinator` shows the Enrollment API delegated from the Registration API with the consumer Planner Web App; `interfaces of registration` requires Tuition Charges from Billing System.

**`interface I`** (notation `interface-card`): the view model's `card` is

    { id, name, typeLabel /* "REST interface · JSON/HTTPS · version 1" */, style, technology, version,
      provider: { id, name, typeLabel }, description, shorthand, documentFormat,
      usedBy:    [{ elementId, name, typeLabel, operationIds }],
      handledBy: [{ elementId, name, operationIds }],   // targets strictly below the provider of relationships that use I
      all: { restrictions: [string], errors: [{ name, code, when }] },   // interface level
      operations: [{ id, syntax, placeholders, input, output,           // input/output: { typeText } | { typeName } (inline) | null
                     purpose, sideEffects, restrictions, errors: [{ name, code, when }],
                     examples: [{ inputText, outputText, note }],
                     realizes: [{ id, kind, text, ownerName }] }],
      types: [{ name, description, owner /* null, or { operationId, part } for an inline map named "<operation> input" */,
                fields: [{ name, typeText, required, inPath, values /* [{ value, meaning }] | null */, constraints,
                           meaning, unit, format, example }] }],
      vocabulary: [{ term, meaning, shared }] }

Title: "Interface description: <I name>". The type line has no brackets (J14): "<Style> interface · <technology> · version <version>", "Interface · <technology>" when the style is unset, and "Interface · syntax only" for a shorthand interface (`shorthand: true`, empty semantic fields). Example texts are the source texts kept by the model, so projection does not depend on the YAML adapter. On the reference card, `usedBy` is the Planner Web App (`submit-plan`) and `handledBy` the Registration Coordinator (`submit-plan`).

## 6. Rendering and notation

### 6.1 C4 notation

- **Box text**, all at the same font size (the site requires every label to reach paragraph size): **Name** (bold); *[Container: Python, FastAPI]* (italic, says "external" where it applies); then the description, or, if there is none, the first three responsibilities ("DECIDE whether a student may enroll", "+N more"). `annotations` adds one line at the same size.
- **Shapes**: person (head over a body box); `database` cylinder; `queue`/`topic` horizontal pipe; `browser_app` browser window; `mobile_app` phone outline; `file_store` folder; everything else a rounded box. The type line and the legend always state the meaning in text.
- **Boundaries**: dashed scope boundary labelled "Course Registration [Software System]"; groups with a different dash pattern; the enterprise boundary with a third; "not yet assigned" edges with their own dash pattern.
- **Relationships**: arrow from initiator to receiver; label = description, then "[technology]" on a second line; solid for `call` and `shared-data`, dashed for asynchronous connectors.
- **Interfaces in C4 views** (only with the `interfaces` annotation): a box gains one line "Provides: Enrollment API" (names of its provided set, each with its mark in parentheses, "offered through …" or "delegated from …"; "+N more" after two), at the same font size. An edge label gains one line "via Enrollment API" after the technology line, naming one interface ("via Enrollment API (+1 more)" when the edge uses more); edge labels wrap at the 300-unit box width. Context and landscape views still omit technology but show the "via" line. No new legend entry: the encoding is text. Without the annotation, the only visible effect of interfaces is the technology fallback (§4.6).
- **Legend** inside the SVG, below the diagram, listing only encodings used, each as a sample plus text. **Title** inside the SVG by default (`show_title: false` per view).
- Text is escaped with an escaper that also escapes `'`. The C4 renderer writes no inline `style` attributes.

### 6.2 Colours

Diagram colours come from a fixed palette object in `c4-render.js` (hosts may pass a `palette` option); they are never read from the CSS cascade, so static, live, exported, printed, and dark-mode renders bake identical values, and the site's dark-mode invert filter cannot double-invert them. One page rule overrides a baked colour, on screen only: the backdrop of a relationship label (`data-c4-label-backdrop`, §6.5) takes the page's colour in dark mode (`--c4-label-backdrop` in `css/uml-diagram.css` for figures and in `css/c4-editor-theme.css` for the editor's canvas, chosen so the invert filter turns it into the colour around the drawing), because a baked white backdrop shows as a black patch on the dark page; the attribute stays white, so exports and print are unchanged (polish round, 2026-11-11). Light ArchUML-style tints with dark text replace C4's usual dark blue with white text (3.49:1). External elements are grey **and** say "external". Editor states drawn over the SVG (focus, selection, trace highlight, move preview, pinned marker, problem marker) have non-colour cues (stroke width or dash, or a text badge repeated in the option description); focus rings are ≥ 2 px with `vector-effect: non-scaling-stroke`.

Normative palette test: for every diagram and state colour, composite on the real backdrops (`#fdfdfd` light page, `#121212` dark page after applying `invert(1) hue-rotate(180deg)`, the editor canvas surface, white paper) and require ≥ 4.5:1 for text and ≥ 3:1 for marks (design target 7:1 for text). A Playwright test asserts a figure rendered under `html.dark-mode` bakes the same fills as in light mode.

### 6.3 UML mappings

Generated ArchUML text normalizes newlines to spaces and escapes quotes, arrows (`->`, `-->`), braces, and `@enduml`-like tokens; adversarial generation tests cover them. Delegated renders go into an inner element so the outer container keeps its `c4` class, label, and C4-specific empty and error states.

- **Code → class diagram**: `class`, `abstract class`, `interface`, `enum` with `attributes`/`operations`; `function` → class with keyword «function» and one operation; `module` → class with keyword «module». `extends` → `--|>`; `implements` → `..|>`; collaborators → dependencies `..>` labelled with their description. Collaborators outside the component lift to their component, container, or system («component», «container», «software system»); people appear as «person». With `annotations: [patterns]`, pattern roles appear as stereotypes.
- **Dynamic → sequence diagram**: people are `actor`; other participants are lifelines `id: Name`; organization boxes group lifelines by their nearest container for components and by their system for containers (`<<external>>` where it applies; ArchUML boxes do not nest). Each step is a message "description [technology]". Step rules:
  - a forward step runs along a declared or derived relationship;
  - a backward step is a **reply** (`-->`) only when its backing relationship is `call` or `shared-data` and an unanswered forward step between the same pair precedes it in the same scenario or fragment; that forward step may also precede the reply's enclosing fragment, at any depth;
  - open requests are kept per branch: each branch of an `alt`, `opt`, `loop`, `par`, or `break` starts from a copy of the requests open where the fragment begins, so a reply inside one branch does not consume the request for a sibling branch or for the steps after the fragment;
  - a backward step against a Consumer→Queue/Topic relationship is a **delivery** drawn `->>`;
  - `message`, `event`, and `stream` steps use `->>`;
  - any other step fails `xlevel/scenario-step`, with a "declare the relationship" fix;
  - `alt`, `opt`, `loop`, `par`, `break` map one to one.
- **Deployment → deployment diagram**: nodes become `node` with «device», «executionEnvironment», or «infrastructure», labelled with name, technology, and "×N"; hosted containers become `component <<container>>`, hosted systems `component <<software system>>`; communication paths are derived from relationships lifted to the hosted instances and drawn between instances, plus explicit node collaborators. A derived path is left out when explicit node collaborators already connect the node hosting its source instance to the node hosting its target instance, directly or through other nodes of the same environment, in the relationship's direction: in the reference model the browser sends HTTPS requests to the ingress, which forwards them to the API pod, so the `web → coordinator` relationship adds no direct browser-to-pod path. The deployment renderer gains nested nodes (parse, layout, describer parent stack, REFERENCE.md); the UML visual editor preserves nested nodes when round-tripping and refuses to edit their nesting with an explanatory message; existing deployment regression suites stay green. In the C4 editor's deployment view nesting is edited through the model (a drop on a marked node or "Move to…", with "At the top level"; `moveNode`), so the C4 editor refuses no nesting edit as such (UML-view editing spec §5.4).
- **Since the UML-view editing work** (UML-view editing spec §4.1, §6): `toUml` returns `{ type, text, ids, source }` for every UML-notation view. `ids` maps every alias to a model id (a code element or lifted element, an element, a node or an instance key `<element>@<node>`, an element or interface); `source.lines` says what each line of the text without its layout block stands for. A view's UML layout entry is written into the text as ArchUML's own layout block after `@startuml` (`node "<alias>" x=… y=…`, `edge "rel:<line>" points="…"`, and the declaration order of the lifelines); line-based route ids count lines without that block. Without a layout entry the text equals the text before this work. Aliases are never a word the target grammar reads at the start of a line (compared without case, such an alias gets a trailing underscore before its collision suffix, `loop_`), which fixed generated sequence text for elements whose id was a keyword.

### 6.4 Layout (C4 views)

Deterministic and independent of the container's aspect ratio, so static prerender and live output match.

1. Lay out each boundary's children (scope boundary, then groups inside it) with `UMLAdvancedLayout.compute`, using virtual anchors that pull elements connected to outside people toward the top and elements depending on outside elements toward the bottom, then refine ranks (people alone on the first rank of every level that has people, shortest spans) and order within ranks (fewest crossings, outside partners at their real positions, then least movement from the seed).
2. Size each boundary around its children plus padding and label.
3. Lay out the outer level: people on top, the scope boundary in the middle, dependencies below (`direction: right` rotates this).
4. Route edges by choosing, for all edges together, among candidate routes (straight, one bend, two bends through mid-corridor tracks, lanes outside obstacles and boundaries, and `UMLShared.routeOrthogonalConnector` as fallback). A route has at most two bends and no detour, except upward edges, edges between elements of the same rank with an element between them, and edges entering a boundary past a blocking element, which may use up to four bends and a bounded detour. Among such routes, the choice minimises, in this order: conflicts (route ends too close on one side, labels without a legal position), crossings, routes over arrowheads or tails, close parallel routes, bends, more than two arrowheads on one side, then length. Edges never run within the boundary padding along any boundary line; a boundary is passable for edges whose endpoints it contains, and such an edge crosses each boundary line at most once. Place each label on or directly beside its own route; widen the gap rather than move a label away.
4a. **Straight edges first (user direction, 2026-11-09; refined by the routing redesign, docs/superpowers/specs/2026-11-09-c4-routing-redesign.md: within hard limits of at most 2 bends per edge, 4 when exempt, and no detour for ordinary edges, the layout minimizes crossings and route conflicts, then avoidable bends; zero avoidable bends is a gate).** Before routing, align connected elements so their relationships run straight: an element with one dominant neighbour in the adjacent row or column (more than half of the element's edges toward that row go to it, and it has no other partner in the element's row) shares that neighbour's centre line, or overlaps each of several neighbours enough for a straight route, when this causes no overlap (boundaries and groups shift as units, people and external elements outside the scope boundary align with the member they connect to), and the router prefers a straight segment over any bend. A relationship gets a bend only when no overlap-free alignment exists. The layout minimizes, in order, conflicting ends, crossings, routes over arrowheads, close parallels, bends, then length. Edges never run along or double back on a boundary line.
5. Apply pins from `layout:` (a pin is the top-left corner of the box, so a box that gains lines, for example under `with interfaces`, grows downward), refit boundaries, reroute. A pinned box keeps its pin: a box it overlaps makes room, moving up when the pin covers its lower part and down otherwise, and pushes what it then overlaps the same way (routing redesign §4.7). Only when two boxes that both hold a pin overlap does the lower move down by the overlap; the view model marks it (`pinAdjusted: true`), the option description says "pin adjusted", and the editor announces where it is drawn.

### 6.5 SVG hooks, accessibility, embedding

- Nodes carry `data-layout-id`, `data-c4-kind`, `data-c4-type`, `data-c4-drill`; edges carry `data-layout-route-id`, `data-c4-source`, `data-c4-target`, `data-c4-derived`, and an edge label's backdrop `data-c4-label-backdrop` (§6.2).
- Embedded figures use the standard ArchUML figure markup. `c4-describe.js` writes the brief label ("Container view of Course Registration: 3 containers, 1 person, 1 external system, 4 relationships") and the verbose text (elements by type with technology and responsibilities; one sentence per relationship; the legend). Absences are stated neutrally ("relationship to Billing System: no description"; "no technology") and rules are never named, so find-the-flaw figures stay equivalent for screen-reader users. Authors may supply a description for a flawed figure (`description` parameter of `c4-view.html`).
- Every C4 figure carries its source as `<script type="application/json" data-c4-source>` holding a JSON string in which every `<` is written as the six-character JSON escape `\u003c` (backslash, `u`, `0`, `0`, `3`, `c`), so `</script>` in the text cannot close the element (Ruby `JSON.generate(text).gsub('<') { '\u003c' }`, single-quoted; JavaScript `JSON.stringify(text).replace(/</g, '\\u003c')`, set as `textContent`), emitted by both the live renderer and `uml_static.rb`. Readers select the element as `script[type="application/json"][data-c4-source]` (edge groups also carry a `data-c4-source` attribute, the id of the relationship's source element, and come first in the figure) and read it with `JSON.parse(el.textContent)`. JavaScript adds an "Open in the C4 editor (opens a new tab)" link to the figure; the link carries the source in the URL fragment (`#c4=<base64url UTF-8>&view=<selector>`), so nothing is stored.
- `_includes/c4-view.html` prepends `view: <selector>` (and the caption comment) to a shared model from `_includes/c4-models/`; a unit test asserts shared models never declare `view:`.
- Printed C4 figures print every label at 9 pt or larger on A4 and US Letter (instructor decision, §17): a drawing too wide for a portrait column prints on a landscape page of its own (routing redesign §9.3 "Print"). Dynamic views, drawn as UML sequence diagrams, wrap lifeline names and message labels (`layout wrap 120`) so that they fit a landscape page at 9 pt.

### 6.6 Interface views

**Interfaces → UML component diagram.** `toUml` returns `{type: 'component', text, ids}` for `uml-component` views, where `ids` maps every generated alias to its element or interface id (`{e1: 'web', e2: 'api', e3: 'billing', p1: 'enrollment-api', …}`) so the canvas can map the delegated SVG's `data-layout-id` values back to elements. The text is rendered by the bundle's `UMLComponentDiagram` inside the inner element (§6.3). The reference model's `interfaces of api`:

```
@startuml
layout vertical
component "Planner Web App" as e1 <<Container: TypeScript, React>> {
  require "Enrollment API" as r1
}
component "Registration API" as e2 <<Container: Python, FastAPI>> {
  provide "Enrollment API" as p1
  require "Tuition Charges" as r2
}
component "Billing System" as e3 <<Software System, external>> {
  provide "Tuition Charges" as p2
}
p1 --> r1 : POST /v1/enrollments
p2 --> r2 : send ChargeRequested to the queue billing.charges
@enduml
```

Rules:

- Components are numbered `e1…` in view order (consumers, scope, providers) and ports `p1…`/`r1…` in order of appearance, so ids with hyphens or non-ASCII characters never reach the ArchUML parser.
- The C4 type line is the component's keyword (`<<…>>`), drawn by the bundle as a second, italic line under the name, so every box states its C4 type (Registration API is a container, Billing System a software system; neither is a C4 component).
- One `provide` port per assembly: an interface used by two consumers gets two balls with the same name, each joined to one socket (UML allows the symbol to repeat), so no ball sits next to a consumer as if the consumer provided it. A provided interface without a consumer gets one port. Provide and require ports carry the interface's name, the same on both ends; "offered through" and "delegated from" go into the notes and the description, never into port names.
- Escaping: inside quoted component and port names, `"` becomes `'`, `{` and `}` become `(` and `)`, and newlines become spaces; inside keywords, `<` and `>` become `‹` and `›` as well. Connector labels only fold newlines into spaces and trim: the bundle's component parser reads the rest of the line as the label, so REST paths such as `GET /readers/{id}` keep their braces.
- A direction is always emitted: `layout vertical` (the default `down`: consumers above, the element in the middle, providers below, the §6.4 convention) or `layout horizontal` (`right`). This order is the view's automatic layout only: since the UML-view editing work an interfaces view can hold positions (§4.8; decision D3 of 2026-11-13), and a view whose entry holds a position of a drawn box also gets the line `layout ports facing` after its direction line, so the bundle's component renderer turns each ball and socket to face its partner after the saved positions are applied. Without a saved position the text and the drawing are as before.
- Bundle requirements (Milestone 2, Appendix A of the plan): the component renderer draws a component's display name (`component "Display" as alias`) instead of its alias, measures that name for the box, and keeps the alias as `data-layout-id`; it parses and draws `<<keyword>>` on components; an explicit `layout vertical` or `layout horizontal` overrides the container's aspect ratio, and the declaration order of components is their rank order, so the static prerender and the live render agree (§6.4).

**C4 wrapper of the interfaces view.** `c4-render.js` puts the view's title above the delegated SVG and, below it, a legend line and the notes, all as text at paragraph size inside the C4 figure container: "Ball: an interface the element provides. Socket: an interface it requires. Ball in socket: the consumer uses that interface. The subject of this view is Registration API." (Until the UML-view editing work the last sentence read "In the middle: Registration API, the subject of this view."; a place cannot identify the subject once boxes move, and it said nothing to a reader who does not see the layout, WCAG 1.3.3. The same sentence ends the legend in `describe` and in the editor.) The empty-state text replaces the legend when `uml.emptyText` is set. Chapter captions of an interfaces view say once that the view borrows UML's component-diagram notation for provided and required interfaces while each box keeps its C4 type.

**Interface description card** (J11). `c4-render.js` writes the card as semantic HTML inside the C4 figure container, which carries `data-c4-notation="interface-card"` and no `role="img"`:

1. `<article class="c4-interface" data-c4-interface="enrollment-api">`, named by the interface name (`aria-labelledby`). Header: the name; the type line "REST interface · JSON/HTTPS · version 1"; "Provided by Registration API (Container: Python, FastAPI)"; the description; "Used by Planner Web App (submit-plan)"; "Handled inside Registration API by Registration Coordinator (submit-plan)".
2. A group labelled **Syntactic view** (`role="group"` with `aria-labelledby` on a visible label): per operation a `<dl>` with Operation, Syntax (in `<code>`), Input, and Output; for a document format, "Document format: the types below".
3. A group labelled **Semantic view**: first "All operations" (usage restrictions and errors declared on the interface, printed once), then one group per operation, labelled with its id and syntax line ("submit-plan: POST /v1/enrollments"), with Purpose, Side effects, Usage restrictions, Errors ("unknown-section (422): a section id does not exist in the requested term; …"), Examples ("Input {student_id: "905123456", …} → Output {status: enrolled, units_enrolled: 8, …}. Two 4-unit sections that do not clash."), and Realizes ("DECIDE whether a student may enroll in a section (Registration API)"). Missing items are written, not hidden: "Purpose: not stated.", "Errors: none stated." (neutral wording, no rule names).
4. A group labelled **Data types**: one `<table>` per type and per inline field map, with a `<caption>` (the type's name and description) and a two-level header: **Syntactic view** (Field, Type, Required, Allowed values, Constraints) and **Semantic view** (Meaning, Unit or format, Example), so a number and its unit share a row. Allowed values are listed in the syntactic columns; their meanings follow the field's meaning. A path parameter's field cell reads "id (in the path)". Each table sits in a keyboard-focusable scroll region with an accessible name, as a data table may scroll at 320 CSS px (WCAG 1.4.10 exception).
5. A group labelled **Shared vocabulary**: a `<dl>` of terms, the model-wide ones marked "(shared by the whole model)".
6. Text inherits the paragraph size; group labels are at least 1.2em and the name 1.3em. Colours come from site tokens with `html.dark-mode` and print variants, and the card is excluded from the dark-mode invert filter. Print keeps operation groups and table rows unbroken where they fit, and prints the card in the light palette.
7. Render option `panels: 'syntax'` (the `c4-view.html` parameter `panels`, emitted as the source directive `# panels: syntax`, like `# caption:` and `# description:`; a ```` ```c4 ```` fence in tutorial instructions, which has no include parameters, writes the same directive itself on a line after `# caption:`, as the interface tutorial's step 1 card does) shows the header, the syntactic group, and the data tables without their semantic columns, with no absence lines, so a figure can ask a prediction before the semantics are shown (§12). `describe()` honours the same option.
8. Hooks: `data-c4-panel="syntax" | "semantics" | "types"` on the groups and `data-c4-operation` on each operation's syntactic block. In the editor (§9.5) each operation's syntactic block holds a native button "Edit submit-plan".

Static prerender: `uml_to_svg.js` returns the card's outer HTML for `interface-card` views; `uml_static.rb` accepts that markup (an article with class `c4-interface` instead of an SVG root), namespaces its ids with the existing per-figure prefix, and wraps it without `role="img"` and without the screen-reader-only description block. The live and the static markup are equal.

**Accessible text.** `describe(viewModel, {panels})` covers both views. Interfaces: brief "Interface view of Registration API: provides 1 interface, requires 1 interface, 2 connected elements."; items "Registration API provides Enrollment API, used by Planner Web App (POST /v1/enrollments)." and "Registration API requires Tuition Charges from Billing System (send ChargeRequested to the queue billing.charges)."; then the legend line and the notes. Card (for the CLI, the editor's Explain panel, and Copy description): brief "Interface description of Enrollment API (REST interface, JSON/HTTPS, version 1), provided by Registration API: 1 operation, 2 types, 4 errors."; sections "Syntactic view", "Semantic view", "Data types", "Shared vocabulary", "Used by". A field item keeps type, unit, and meaning together: "units_enrolled: number; unit: quarter units; meaning: total units the student holds in the term after this attempt."; "status: string; one of enrolled (the student now holds a seat in every section of the plan), refused (the student holds no new seat; reason says why); meaning: whether the plan was accepted."; "section_ids: string[]; constraints: 1 to 8 items, no duplicates; format: six-digit section ids; meaning: the sections the student wants to take together.". Each operation's semantic item starts with its syntax line. The same absence sentences appear, and examples are spelled as on the card. Annotated C4 views add "Provides Enrollment API." to element items and "via Enrollment API" to relationship sentences. Embedded cards have no screen-reader-only description block: the card is the text.

## 7. Consistency checks

### 7.1 Diagnostic shape and severity

`{rule, severity, category, message, hint, element, path, range, fix}`; `range` is a line/column span in the YAML; `fix` is an optional editor command.

- **error**: the model is invalid or contradicts itself (YAML syntax, unknown keys, broken references, impossible containment, a scenario step with no backing relationship). Rendering continues best-effort; saving is never blocked.
- **warning**: violates a C4 or RDD rule or a strong heuristic.
- **info**: suggestions and heuristics with a real false-positive risk.

Each rule carries a short rationale and a public source (Brown's book, c4model.com, Wirfs-Brock & McKean, or a SEBook chapter) shown as help text and listed in REFERENCE.md. Thresholds are configurable heuristics, labelled as original design synthesis.

### 7.2 Rule catalog

| Rule | Severity | Checks |
|---|---|---|
| `yaml/syntax` | error | YAML syntax error |
| `schema/version` | error / info | Unknown version or CS 188 RDD file (error); missing `schema` in an opened file (info) |
| `schema/unknown-key` | error | Unknown key, with a suggestion |
| `schema/type`, `schema/value`, `schema/id-format` | error | Wrong value type, value outside an enum, invalid id |
| `schema/misplaced-field` | error | Field not allowed on this element type, with the reason |
| `model/duplicate-id` | error | Id reused within its namespace |
| `model/unknown-reference` | error | Reference to something that does not exist, including `uses` interfaces and operations and `realizes` responsibilities (with a suggestion; an element id in `uses` gets the element's interface ids as the suggestion) |
| `model/interface-provider` | error | `uses` names an interface that §4.11 does not allow for this relationship (J7) |
| `model/realizes-owner` | error | `realizes` names a responsibility owned by neither the provider nor one of its descendants |
| `model/wrong-type-reference` | error | Reference of the wrong type, worded in C4 terms ("a component is not separately deployable; host its container") |
| `model/containment-link` | error | Relationship between an element and itself, its ancestor, or its descendant |
| `model/refines-not-ancestor` | error | `refines` names a responsibility not owned by an ancestor |
| `model/responsibility-owner` | error | A collaborator's `responsibility` is not owned by the target, a descendant of the target, or an ancestor of the target outside the source's chain (§4.6) |
| `model/infrastructure-leaf` | error | An infrastructure node with `hosts` or `nodes` |
| `view/unknown-selector`, `view/wrong-scope-type` | error | Selector names nothing, or an element of the wrong type |
| `view/mixed-abstraction` | error | `include` names an element whose ancestor is also visible |
| `view/empty` | warning | View resolves to no elements |
| `view/no-purpose` | info | Custom view without a description |
| `c4/no-description` | warning | A person, system, container, or component box would be empty: no description and no responsibilities (code elements render as UML classes and are exempt) |
| `c4/sparse-description` | info | Description shorter than four words |
| `c4/no-technology` | warning | Container or component without technology (info for `database` and `file_store`; `TBD` → `c4/technology-tbd`, info) |
| `c4/vague-relationship` | warning | Description of one or two words, or a generic verb ("uses", "calls", "talks to", "data") |
| `c4/duplicate-relationship` | warning | Same endpoints and description twice |
| `c4/cross-container-technology` | warning | Relationship without technology whose endpoints, lifted to container level, are two different containers, or a container and a software system (relationships from people are exempt; the technology of a used interface counts, §4.6) |
| `c4/infrastructure-container` | warning | Container technology names infrastructure or a library (Docker, Kubernetes, VM, JAR, DLL) |
| `c4/external-decomposed` | warning | External system with containers |
| `c4/duplicate-name` | warning | Siblings (or top-level people and systems) with the same display name |
| `c4/isolated-element` | warning | No declared or derived, incoming or outgoing relationship; `extends`/`implements` count for code elements (info for code elements) |
| `c4/generic-name` | info | "Service A", "Backend", "DB1", "business logic" |
| `c4/large-view` | warning | View with more than 20 elements |
| `c4/broker-hub` | info | A container that looks like a message broker; suggests modeling queues and topics |
| `xlevel/scenario-step` | error | Step not valid under §6.3, or a step `uses` that is not among its backing relationship's uses (§4.8) |
| `xlevel/scenario-levels` | warning | A scenario contains an element and its ancestor |
| `xlevel/unreceived`, `xlevel/unsent` | info | Relationship lands on a decomposed element that no child receives or sends |
| `xlevel/unsummarized` | info | Two or more distinct lower-level relationships lift onto one pair without an explicit summary |
| `xlevel/summary-copy` | info | Summary copied verbatim from its only child relationship |
| `xlevel/undeployed` | info | Container not hosted in an environment that hosts its siblings |
| `rdd/no-responsibility` | warning | Internal system, container, or component without responsibilities (info for code and external systems) |
| `rdd/untyped` | warning | Responsibility without KNOW, DO, or DECIDE |
| `rdd/not-an-obligation` | warning | Reads as a field, method, or UI step: call-shaped text with or without arguments (`openSeats()`, `openSeats(section)`), an identifier, get/set, click/press/tap, an HTTP verb and path |
| `rdd/vague` | info | "handle", "manage", "process", "support" plus at most one noun |
| `rdd/owner-named` | info | Responsibility names another element as its subject |
| `rdd/no-reason` | warning | Collaborator without a description |
| `rdd/duplicate-authority` | warning / info | An `owns` item owned by another element off the same containment chain (warning); named in another off-chain element's KNOW (info). Data stores the owner writes to are exempt (custody). |
| `rdd/duplicate-decision` | info | Near-duplicate DECIDE text (normalized keyword overlap) off the same chain |
| `rdd/god-element` | warning | Component or code element with more than 9 unrefined responsibilities or more than 7 collaborators (info for containers; never systems) |
| `rdd/manager-name` | info | Name ending in Manager, Processor, Handler, Helper, or Util |
| `rdd/centralized-control` | info | Among three or more siblings, one owns most DECIDE responsibilities while the rest only KNOW |
| `rdd/coordinator-decides` | info | Question: should a coordinator own this decision? Skips sequencing and next-step decisions |
| `rdd/stereotype-mismatch` | info | Controller without DECIDE, information holder without KNOW, interfacer that crosses no boundary |
| `rdd/boundary-without-interfacer` | info | Component calling an external system without the interfacer stereotype |
| `rdd/unrefined` | info | A decomposed element's responsibility that no descendant refines |
| `rdd/collaboration-cycle` | info | Collaboration cycle among siblings |
| `rdd/unmeasurable-quality` | info | Quality statement without a number and unit or a comparator |
| `rdd/uncovered-requirement` | info | Requirement no responsibility references |
| `choices/unknown-pattern`, `choices/unknown-style` | info | Name not in the catalog |
| `choices/unknown-role` | warning | Role the pattern does not define |
| `choices/incomplete-pattern` | warning | Instance missing a required role |
| `checks/unexplained-ignore` | warning | `checks.ignore` entry without `because` (inactive) |
| `checks/stale-ignore` | info | `checks.ignore` entry that suppresses nothing |

**Learner messages for the core rules.** Every rule the novice profile shows, and every rule a tutorial step raises to warning, follows the interface pattern below: what is wrong in the learner's terms, why a reader needs it, and a question or a neutral example. Messages use only terms the chapter teaches (no "lifted", "decomposed", "off-chain", or "derived"), and the test that checks interface messages also checks these. `<…>` are placeholders. The "Checks" column above stays the implementer's description.

| Rule | Message (and hint) |
|---|---|
| `rdd/not-an-obligation` | "'<text>' reads like a field, a method, or a screen step. A responsibility is a promise a reader can check." Hint: "Finish the sentence '<element> promises to…' with KNOW, DO, or DECIDE." |
| `rdd/no-reason` | "<source>'s relationship to <target> has no description. A reader cannot tell what <source> asks for." Hint: "Read it aloud from <source>: what does it ask <target> for?" |
| `c4/vague-relationship` | "'<text>' could label any arrow. A reader cannot tell what <source> asks of <target>." Hint: "Write what is asked, ending with a word such as from, to, or through: 'requests tuition charges from'." |
| `c4/cross-container-technology` | "<source> and <target> run as separate applications, but the relationship names no technology. A reader cannot tell how the request travels." Hint: "Name the protocol or format, such as JSON/HTTPS or SQL/TCP." |
| `c4/infrastructure-container` | "<technology> says where <container> runs, not what it is built with. Where it runs belongs in a deployment view." Hint: "Name the language and framework, or the database product; write TBD if the team has not chosen." |
| `c4/generic-name` | "'<name>' could name a part of any system. A reader cannot tell what this one does." Hint: "Name it after what it does for its users." |
| `xlevel/scenario-step` | "Step <n>, <source> to <target>, follows no relationship in the model and answers no earlier request. A scenario can only use collaborations the design has." Hint: "Does an earlier step ask <source> for something it could answer?" |
| `xlevel/unreceived`, `xlevel/unsent` | "<relationship> reaches <element>, but no part inside it receives it (sends it)." Hint: "Choose which part receives (sends) it." |
| `rdd/uncovered-requirement` | Title "Requirement no responsibility traces to"; message "No responsibility traces to the requirement <id>." Help text: "Tracing each requirement to a responsibility shows which element is accountable for it; whether the design actually meets the requirement is for review and testing to show." Hint: "Which responsibility keeps the promise <id> asks for? Add <id> to its Requirements." |
| `rdd/centralized-control` | Help text: "A centralized style is simple to follow, but the central element grows with every new rule; a delegated style keeps each decision beside its data but asks maintainers to follow more collaborations. Which pays off depends on who maintains it and which changes come." Hint: "Centralized control is a choice. If rules keep accumulating here and the siblings hold the data each decision needs, consider delegating; for novice maintainers, a central element may be easier to follow." |
| `rdd/duplicate-authority` | "<fact> is owned by both <A> and <B>, which are not part of each other. A fact has one owner, its only writer." Hint: "Which of the two writes <fact>? A container and its own component may both list it." |

**Interface rules** (category `interface`). Every message follows one pattern: what is missing, why an independently built client needs it, and a question or a neutral example from outside the reference domain. Messages use the editor's field labels (Unit, Format, Meaning), never YAML syntax, and never contain a unit, format, or term of the reference model (a test enforces it). `<…>` are placeholders.

| Rule | Severity | Checks | Message (and hint) |
|---|---|---|---|
| `interface/no-syntax` | warning | Full-form interface with neither operations nor types; operation without `syntax` | "<op> has no syntax line. A client cannot call an operation it cannot write down." Hint: "Write the call as a client would, such as GET /books/{isbn} or reserve(book) -> Loan." For an empty interface: "<interface> has no operations and no types. Add an operation a client can call, or the types of the document it exchanges." |
| `interface/untyped-field` | warning | Field without `type` | "<field> has no Type. Without one, a client cannot tell a number from text." Hint: "Choose a primitive (string, integer, number, boolean, datetime, …) or a type of this interface." |
| `interface/undefined-type` | warning | A named type the interface does not define, or text that is not a type expression | "<Name> is used as a type but not described. A client needs its fields to build or read it." Hint: "Add <Name> under Types, or use a primitive such as string." For prose: "'<text>' is not a type. Use a primitive or a type of this interface; write a list as string[]." |
| `interface/no-purpose` | warning | Operation of a full-form interface without `purpose`; document-format interface without `description` | "<op> has no Purpose. A client cannot tell whether the operation fits its need." Hint: "Say when a client calls it and what the provider then does." |
| `interface/no-errors` | warning / info | Operation of a full-form interface without errors of its own or of its interface: warning when the style is `rest`, `rpc`, `graphql`, `soap`, or `message`; info for `event`, `stream`, `library`, `file`, and an unset style | "<op> lists no errors. A client built by another team must know what can go wrong and what to do then." Hint: "What happens when the caller is not allowed, sends something invalid, or calls too often?" For event and stream: "What can a subscriber not rely on: can it receive this twice, out of order, or not at all?" |
| `interface/no-unit` | warning / info | Warning: `integer`, `number`, or `decimal` field without `unit`, unless its `values` is a map with a meaning for every value (an enumerated code) or its name is an identifier (`id`, or ending in `_id`, `_ids`, `Id`, `Ids`). Info: a `string` field without `unit` whose name words include price, amount, cost, fee, weight, distance, size, or temperature | "<field> is a number with no Unit. Two teams can read the same number differently." Hint: "Set Unit to what a value of 1 means (seconds, cents, kilograms, items)." When the meaning already names a unit: "The meaning mentions a unit; put it in Unit so clients and checks can find it." Info: "<field> is text, but its name suggests a quantity. If it carries an amount, state its unit and what it includes (tax, fees), or make it a number with a Unit." |
| `interface/no-format` | warning / info | Warning: `date`, `datetime`, `time`, or `duration` field without `format`. Info: a `string` field without `format` whose name words include date, time, deadline, birthday, or dob, or end in at or on (`created_at`, `starts_on`) | "<field> is a date or time with no Format. Which comes first, day or month, and in which time zone?" Hint: "State the order of the parts and the time zone, for example YYYY-MM-DD in local time of the venue." Info: "<field> is text, but its name suggests a date or time. State its Format." |
| `interface/example-mismatch` | warning | An example's input or output has a key that is not a field of the declared type, lacks a required field, has a value outside `values`, or has non-numeric text in an `integer`, `number`, or `decimal` field (checked through named types and lists) | "Example <n> of <op> does not match its types: <problem>. An example that contradicts the syntax misleads every client that copies it." |
| `interface/realizes-internal` | warning | `realizes` names a descendant's responsibility that refines none of the provider's responsibilities | "<op> is linked to '<text>', an obligation private to <owner>. Clients rely on what <provider> promises, not on how its parts divide the work." Hint: "Link the operation to the responsibility of <provider> that this one helps realize, or remove the link." |
| `interface/in-process-across-boundary` | warning | A request use whose source lies in another container or system than the provider, where the interface's style is `library`, or the style is unset and the provider is a component (shorthand included) | "<interface> is an in-process interface of <provider>, and <source> runs in another container. A component is not separately deployable: a client elsewhere reaches it through an interface offered over the network." Hint: "Use the interface of the container the request enters, or set the remote style the component exposes." |
| `interface/requested-not-advertised` | warning | A collaborator with a `responsibility` and operation-level `uses`, where no used operation realizes that responsibility, one it refines, or one that refines it | "This relationship asks <target> for '<text>', but the operation it uses is linked to other responsibilities. Does the client call the right operation, or is the operation's link incomplete?" |
| `interface/type-spelling` | info | A type written in another language's spelling (`str`, `List<T>`, …), once per spelling and interface | "<spelling> is written <standard> in interface descriptions; both mean the same, and the editor writes the standard form." |
| `interface/syntax-only` | info | Shorthand interface used by a relationship that crosses a container or system boundary | "<interface> lists only call syntax, and <source> uses it across a <container or system> boundary. An independently built client also needs the purpose, the errors, and what the data means." Hint: "Describe it fully." |
| `interface/no-meaning` | info | Field without `meaning`; a field with `values` but without a meaning for some value, on an interface used across a container or system boundary | "<field> has no Meaning. A team that never spoke to you will guess." Hint: "What does this field identify or measure, and for whom?" For values: "Some values of <field> have no meaning. What does each value tell the client?" |
| `interface/no-example` | info | Operation of a full-form interface used across a container or system boundary without `examples` | "<op> has no example. One request with its response shows a client more than a page of rules." |
| `interface/unrealized` | info | Operation of a full-form interface on an internal element with responsibilities, without `realizes` | "<op> is not linked to a responsibility of <provider>. Which obligation does a client reach through it?" |
| `interface/leaks-implementation` | info | Operation syntax, type name, or field name containing a word that names storage or runtime internals: `sql`, `select`, `insert`, `table`, `column`, `row id`, `primary key`, `foreign key`, `orm`, `dao`, `stored procedure`, `mutex`, `heap`, `pointer`. Names are split into words at `_`, `-`, `.`, `/`, spaces, and lower-to-upper case changes before matching (`SeatTable` → seat, table; `class_section` → class, section) | "Does '<name>' tell clients how <provider> stores or computes data? Names of tables, keys, and locks tie clients to the implementation." |
| `interface/conflicting-vocabulary` | info | An interface term that redefines a shared (top-level) term, or the same term in two interfaces, with different meanings (case- and whitespace-normalized) | "'<term>' means different things in <A> and <B>. Two systems that read one word differently do not interoperate." Hint: "Agree on one meaning in the shared vocabulary, or use two terms." |
| `interface/style-mismatch` | info | Relationship whose connector and used interface disagree on synchrony (an asynchronous connector with a `rest`, `rpc`, `graphql`, or `soap` interface; a `call` or `shared-data` connector with a `message`, `event`, or `stream` interface) | "The relationship is drawn as <connector> but uses <interface>, a <style> interface. Is the call synchronous or not?" |
| `interface/unspecified-use` | info | Relationship between elements of two different software systems (neither endpoint a person) without `uses`, when neither a relationship it summarizes nor one that summarizes it names an interface | "<source> depends on <target>, another software system, but names no interface. Which interface does it use?" Hint: "<target> offers <names>." or "<target> describes no interface yet; describe the one this team relies on." |
| `interface/unused` | info | Interface that nothing uses (§4.11 counting), unless its provider (itself or through a descendant) receives a relationship without `uses` from a person or from another software system (an entry point; `interface/unspecified-use` covers the cross-system case) | "No relationship uses <interface>. Is it an entry point for clients outside this model, or can it go?" |
| `interface/unused-operation` | info | Operation of a used interface when every use of the interface names operations and none names this one | "No client uses <op>. Does any client need it? An interface that offers only what clients use is easier to keep stable." |
| `interface/no-version` | info | Full-form interface used across a system boundary, or provided by an external system, without `version` | "<interface> crosses a system boundary and states no Version. When it changes, how will clients know which description they implement?" |
| `interface/unbound-parameter` | info | A `{name}` placeholder in an operation's syntax without an input field of that name (full form only) | "The syntax of <op> has the placeholder {<name>}, but its input has no field <name>. A client cannot tell what to put there." Hint: "Add an input field <name> with its type and meaning." |

Rationale and sources of the interface rules (shown as help text and listed in REFERENCE.md):

| Rule | Rationale | Source |
|---|---|---|
| `model/interface-provider`, `model/realizes-owner` | A reference that contradicts containment or the direction of a contract is invalid, like `model/responsibility-owner`. | §4.6, §4.11 |
| `interface/no-syntax`, `interface/untyped-field`, `interface/undefined-type` | The syntactic view must say how to call the operation and what each parameter's type is; a type that is named but not described leaves the client guessing. | `Clements2010`; lecture L14 |
| `interface/type-spelling` | Standard type names make descriptions comparable across teams and languages; the other spelling is understood, so this is a suggestion. | — |
| `interface/no-purpose` | Without a purpose a client cannot tell whether the operation fits its need; the purpose is the advertised responsibility. | `Clements2010`; `WirfsBrock2003` |
| `interface/no-errors` | Remote request/response and command calls always fail somehow (authentication, validation, rate limits, outages), and error handling is part of the semantic view, so they meet the "strong heuristic" bar of §7.1. An emitted event's risks are delivery guarantees (duplicates, order, loss), which the review prompt and the event frame ask about; in-process and unknown styles may genuinely not fail. Hence info there. | `Clements2010`; `Bass2012` |
| `interface/no-unit`, `interface/no-format` | Syntactic interoperability is not enough: independently built systems read a number without a unit or a date without a format differently. The Mars Climate Orbiter's interface specification did state newton-seconds; one side wrote pound-force seconds and no test compared the file with the specification. A stated unit is what makes such a check possible. The exemptions keep false positives low: identifiers state a format, enumerated codes give each value a meaning. The string-name variants are info because names are weak evidence. | `MCOMIB1999`; `Bass2012` |
| `interface/example-mismatch` | The model-level counterpart of validating a document against its schema (lecture L14): a description must not contradict itself. Example values are illustrative, so warning rather than error. | lecture L14 |
| `interface/realizes-internal` | An RDD contract advertises the provider's obligations; its private implementation is not part of it. | `WirfsBrock2003`; `Parnas1972` |
| `interface/in-process-across-boundary` | A C4 component is not separately deployable; a client in another container reaches it only through a remote interface. Linking it to a library call mixes abstraction levels. | §4.4; Brown (c4model.com) |
| `interface/requested-not-advertised` | In RDD the receiver advertises the responsibility a collaborator requests; a used operation that realizes something else contradicts the stated request. | `WirfsBrock2003` |
| `interface/syntax-only`, `interface/no-example`, `interface/no-meaning` | Formalize contracts selectively: boundary-crossing, independently implemented collaborations need semantics; internal sketches may stay short. | `WirfsBrock2003` |
| `interface/unrealized` | Connects an operation to the responsibility it serves; absent links are common in early sketches. | `WirfsBrock2003` |
| `interface/leaks-implementation`, `interface/unused-operation` | Expose only what is needed: names of tables, keys, and locks couple clients to the implementation, and operations no client uses must still be kept stable. Word lists produce false positives (a restaurant API has tables), and an unused operation may serve clients outside the model, hence info; `cursor` and `thread` are left out because pagination cursors and discussion threads are ordinary API vocabulary. | `Parnas1972`; `Clements2010` |
| `interface/conflicting-vocabulary` | A shared vocabulary is a precondition of semantic interoperability; two meanings for one term signal a mismatch, unless the interfaces deliberately differ. | `Bass2012`; lecture L14 |
| `interface/style-mismatch` | A message interface used through a synchronous call (or the reverse) contradicts the drawn connector; asynchronous REST patterns exist, hence info. | §4.6 |
| `interface/unspecified-use`, `interface/unused` | Cross-system dependencies are where interoperability matters; an unused interface may be an entry point or dead weight, so the entry-point case is exempt and the rest is a question, not a verdict. | `Bass2012` |
| `interface/no-version`, `interface/unbound-parameter` | A shared interface changes in every system that uses it, so clients across a system boundary need to know which version they implement; a placeholder without a field cannot be called from the description alone. | `Bass2012`; `Clements2010` |

Severity calibration against §7.1: errors are reserved for references that cannot be resolved or contradict containment or the direction of a contract; warnings for omissions that make a description unusable by an independently built client (no syntax, no type, an undescribed type, no purpose, a remote request or command without errors, a quantity without a unit, a date without a format), for self-contradiction in examples, and for violations of a C4 or RDD rule (realizing a private obligation, calling an in-process interface from another container, requesting what the used operation does not advertise); info for everything with a real false-positive risk or that only matters across boundaries. An undefined type in a first draft is an incomplete description, not an invalid model, so it is a warning, and type spellings from other languages are info. The `interface/*` rules run only on a model that declares at least one full-form interface or one `uses` entry. A model whose interfaces are all shorthand lists is a sketch that has not opted in to interface descriptions (the Milestone 1 fixture is one), so it keeps its Milestone 1 diagnostics exactly; the `model/*` interface references are checked whenever they occur.

Configuration (host `checks` option, tutorial `c4.checks`, CLI flags) uses one shape: `{display, disable, severity, thresholds, honorFileIgnores}`; tests and the Problems panel use the same configuration. The novice profile hides info-level diagnostics by default, except `xlevel/unreceived` and `xlevel/unsent`, whose quick fix moves the relationship to a part inside the element (§9.2), and does not report incompleteness rules (`no-description`, `no-responsibility`, `no-technology`, `isolated-element`, and `interface/no-syntax`, `interface/untyped-field`, `interface/undefined-type`, `interface/no-purpose`, `interface/no-errors`, `interface/no-unit`, `interface/no-format`) on an element or interface until focus has left it once (`suppressIncompleteFor` accepts element and interface ids). Because `interface/no-meaning` is info, the novice Review panel's checklist lists the fields without a meaning instead (§9.5).

### 7.3 Failure behaviour per surface

| Condition | Live or static embed | Editor | Tutorial | CLI |
|---|---|---|---|---|
| YAML syntax error | Accessible error figure naming the line | Last valid model read-only with a banner and "Go to error"; visual commands disabled (`aria-disabled` with the reason); the YAML surface stays editable | Predicates return `null` ("Fix the YAML errors first"); C4 hint conditions are false | exit 1, diagnostics printed |
| Other errors | Best-effort render; diagnostics hidden unless the embed opts in (`diagnostics: true`) | Renders; Problems lists them | Predicates evaluate | exit 1 |
| Unknown or wrong selector | Error figure listing valid views | Opens the default view and reports the problem | Configuration error shown to the author only for the configured `c4.view` and for malformed selector syntax; a predicate selector (`view:` assertion, `in_view` filter) or id that names a view, scenario, or element missing from the learner's model fails the predicate with a learner-facing message (§8), and in a hint condition evaluates to false | exit 1 |
| Empty model | Empty-state figure ("This model has no people or systems yet") | Empty-state guide | — | exit 0 |
| C4 scripts fail to load | Error state (§3.3) | Mount reports a visible error | Backend reports a visible error | — |

CLI: exit 0 when there are no errors (warnings allowed), 1 when there are errors, 2 when `--strict` and there are warnings, 64 on usage errors, 66 when the file is unreadable. `--json` prints `{valid, counts: {error, warning, info}, diagnostics}`.

## 8. Tutorial predicates

`tests[].c4` holds one predicate. Unknown keys are author errors (the test fails naming the key, with a suggestion) and `scripts/tests/c4-tutorial-content.test.js` rejects them before release. Every id a predicate references (`id`, `of`, `from`, `to`, `in`, `parent`, `uses`, `realizes`, `realizes_any`, `requests`, `used_by`) must resolve, or the predicate fails with "unknown element X" ("unknown interface X", "unknown operation X.Y", "unknown responsibility X"; an operation `id` without `of` must name an operation of some interface; interface ids match ignoring case); `every` over an empty set fails; so predicates cannot pass vacuously.

- **Missing selectors are learner failures, not author errors.** A selector (`view:` assertion, `in_view` filter) or id that names a view, scenario, or element missing from the learner's model returns `{passed: false, message}` with a learner-facing message ("No view named who-decides yet", "No scenario named enroll yet", "unknown element coordinator2"); in a hint condition the same predicate evaluates to false. Only the configured `c4.view`, unknown predicate keys, and malformed selector syntax are author errors.
- Assertions (exactly one): `exists: <query>`, `absent: <query>`, `count: <query>` with one of `equals`/`at_least`/`at_most`, `every: <element filter>` with `satisfies: <element filter>`, `checks: {max_errors, max_warnings, rules, categories, disable}`, `view: {view, shows, hides, max_elements}` (`shows`/`hides` take ids or element filters), `same_as_seed: <element filter>` (unchanged compared with the step's authored starter content for `c4.file`, layout excluded; nothing is stored, so the baseline is the same after reload, revisit, Reset, and Show Solution).
- Queries (exactly one): `element: <filter>`, `relationship: {from, to, …}`, `responsibility: {of, …}`, `step: {scenario, from, to, in_fragment, reply}`, `requirement: {id, kind, text_any}`, `interface: <interface filter>`, `operation: <operation filter>`.
- Step query: `scenario` is a scenario id (required; unresolved → the predicate fails); `from`/`to` are ids or element filters; `in_fragment` (`alt · par · opt · loop · break`) matches a step enclosed at any depth by a fragment of that kind; `reply` (`true`/`false`) matches the §6.3 classification shared with `xlevel/scenario-step`.
- Requirement query: `id`, `kind` (`functional · quality · constraint`), `text_any`; it matches entries of `requirements:`, so steps can guard requirement counts (for example against an emptied `requirements:` section that would make `rdd/uncovered-requirement` vacuous).
- Element filter: `id`, `type` (`person · system · container · component · code`), `kind`, `name`, `name_any`, `in`, `parent`, `external`, `technology` (`present · absent`), `technology_any`, `stereotype`, `pattern`, `pattern_role`, `style`, `owns_any`, `has_responsibility: <responsibility filter>`, `responsibilities_at_least`.
- Relationship filter: `from`, `to` (id or element filter), `description_any`, `technology`, `technology_any`, `connector`, `derived` (`include` default · `exclude` · `only`), `in_view`.
- Responsibility filter: `of` (id or element filter), `id`, `kind`, `text_any`, `refines`, `leaf` (`true`: no descendant refines it).
- Element filter, added key: `provides_interface: <interface filter>` (the element's provided set, §5.3; `{}` matches any interface).
- Relationship filter, added keys: `uses` (`<interface>` or `<interface>.<operation>`, or a list: any of them; a whole-interface entry matches any use of that interface, an operation entry only a use of that operation; derived edges match through the union of their sources, and summaries through inherited uses); `uses_interface` (`present · absent · whole`, where `whole` means some use names no operation); `requests` (a responsibility id: the relationship's requested responsibilities, §4.6).
- Interface filter: `id`, `of` (provider: id or element filter), `in` (provider is the element or a descendant), `name_any`, `style`, `has_operation: <operation filter>`, `used_by` (id or element filter: some relationship whose source is that element or a descendant uses the interface).
- Operation filter: `id`, `of` (interface id or interface filter), `syntax_any`, `purpose`, `side_effects`, `restrictions` (each `present · absent`; `restrictions` counts the interface's restrictions), `errors_at_least` (counts the interface's errors), `examples_at_least`, `realizes` (a responsibility id or a list; the operation must realize each listed responsibility under J12: listed directly, or every direct refinement covered, recursively), `realizes_any` (some listed id appears in the operation's `realizes`, exactly as written; for hint conditions), `realizes_at_least` (number of ids listed), `input_has_field: <field filter>`, `output_has_field: <field filter>`.
- Field filter: `name_any`, `type` (a type expression in standard spelling), `type_any` (a list of them), `meaning`, `unit`, `format`, `constraints` (each `present · absent`), `values` (`present · absent · meaningful`, where `meaningful` means a map with a meaning for every value), `unit_any`.
- `same_as_seed` also accepts `{interface: <interface filter>, part: all | syntax}` (default `all`). The interface filter is matched in the seed (the learner's file at step entry); an empty match set fails. Each matched interface must exist in the current model under the same id, with the same provider, and with equal data, ignoring source paths. `part: syntax` compares only the syntactic view: style, technology, version, each operation's id, syntax, input, and output, and each type's fields with their type, required flag, allowed values (without meanings), and constraints.
- Interface semantics are graded structurally (presence, counts, `realizes` ids, units present) and through `checks:` predicates over `interface/*` rules. `syntax_any`, `name_any`, `realizes_any`, and `unit_any` are for lookups and hint conditions, as for `text_any`, with one exception: `unit_any` may grade a fixed domain unit when the step documents the accepted spellings (step 2 of the interface tutorial accepts any unit containing "quarter"). The vocabulary stays small on purpose: counts of interfaces or operations use `count:`, and anything finer is a `checks:` predicate over a named rule.
- **Allocation and refinement are graded structurally** (seeded ids, `refines`, `of`, element type, relationships). `text_any` is reserved for name lookups with documented synonym sets and for hint conditions; `owns_any` is a name lookup too.
- Text matching (`name_any`, `owns_any`, `text_any`, `description_any`, `technology_any`) is case-insensitive substring matching after normalizing whitespace and hyphens, so "held seats" matches the term "held seat". Results are `{passed: true | false | null, message, matched}`.
- Credit: Problems-panel diagnostics alone never award credit; a test awards credit for consistency only through an explicit `checks:` predicate. A `checks:` predicate first applies the step's `c4.checks` configuration (severity overrides, `disable`) and then its own `rules`, `categories`, and `disable` filters. The content test rejects a `checks:` predicate whose selected rules contain none at the asserted severity, reading each rule's severity as the step configures it.

Verified examples (in the content test each runs against its step's reference solution, two paraphrased correct models, and named wrong models: keyword-stuffed text, deleted target, DECIDE moved to the coordinator; the last six pass on the Milestone 1 fixture, and on the §4.2 reference model too except the requirement count, which is 3 there because §4.2 adds FR-11):

```yaml
tests:
  - description: The context view shows an adviser who uses the system
    c4:
      view:
        view: context of registration
        shows: [{type: person, name_any: [adviser, advisor]}]
  - description: Exactly one component refines the API's eligibility decision
    c4:
      count:
        responsibility: {of: {type: component}, kind: decide, refines: api-eligibility}
      equals: 1
  - description: The coordinator does not own the eligibility decision
    c4:
      absent:
        responsibility: {of: coordinator, refines: api-eligibility}
  - description: Every component in the API has at least one responsibility
    c4:
      every: {type: component, in: api}
      satisfies: {responsibilities_at_least: 1}
  - description: The model has no C4 or RDD warnings
    c4:
      checks: {max_errors: 0, max_warnings: 0, categories: [model, c4, xlevel, rdd]}
  - description: The refusal goes back to the web app as a reply inside the alt fragment
    c4:
      exists:
        step: {scenario: enroll, from: coordinator, to: web, in_fragment: alt, reply: true}
  - description: The model keeps both requirements
    c4:
      count:
        requirement: {}
      equals: 2
```

Each example below passes on the §4.2 reference model (for `same_as_seed` the seed is the reference model itself). The content test runs them against named wrong models: the Milestone 1b fixture `interfaces-step2-seed.yml` (the reference model with the Enrollment API reduced to its syntactic view; examples 1, 7, 8, and 9 pass on it, the other eight fail; the interface tutorial's own step 2 seed adds a seeded worked part, Billing's shorthand sketch, and the syntax-only `check-plan`, so example 9 fails there too, §11), a model whose web collaborator has no `uses`, a model whose operation realizes the coordinator's sequencing instead of the API's responsibilities, and, for the ninth example, models in which the Enrollment API gained an operation, moved to another element, or was deleted.

```yaml
tests:
  - description: The Registration API provides a REST interface
    c4:
      exists:
        element: {id: api, provides_interface: {style: rest}}
  - description: The web app names the API operation it uses
    c4:
      exists:
        relationship: {from: web, to: api, uses: enrollment-api.submit-plan}
  - description: An Enrollment API operation states at least two errors and realizes the seat-hold responsibility
    c4:
      exists:
        interface: {id: enrollment-api, of: api, has_operation: {errors_at_least: 2, realizes: api-holds}}
  - description: Every Enrollment API operation states its purpose
    c4:
      absent:
        operation: {of: enrollment-api, purpose: absent}
  - description: The number of units enrolled is counted in quarter units
    c4:
      exists:
        operation: {of: enrollment-api, id: submit-plan, output_has_field: {name_any: [units_enrolled], type: number, unit_any: [quarter]}}
  - description: No quantity lacks a unit, no date a format, no operation a purpose, and no example contradicts its types
    c4:
      checks: {max_warnings: 0, rules: [interface/no-unit, interface/no-format, interface/no-purpose, interface/example-mismatch]}
  - description: The system's relationship to Billing names the interface it uses
    c4:
      exists:
        relationship: {from: registration, to: billing, uses_interface: present}
  - description: Billing's interface is used from inside the Registration API
    c4:
      exists:
        interface: {of: billing, used_by: api}
  - description: The syntax of the Enrollment API is as it was
    c4:
      same_as_seed: {interface: {id: enrollment-api}, part: syntax}
  - description: The enrollment operation has effects, a restriction, an example, and a request that explains the term and its format
    c4:
      exists:
        interface:
          in: registration
          name_any: [enrollment]
          has_operation:
            syntax_any: [/enrollments]
            side_effects: present
            restrictions: present
            examples_at_least: 1
            input_has_field: {name_any: [term], meaning: present, format: present}
  - description: Through the operation it uses, the web app asks for the seat holds
    c4:
      exists:
        relationship: {from: web, to: api, requests: api-holds}
  - description: The plan's sections state their constraints and every status value says what it means
    c4:
      exists:
        operation:
          of: enrollment-api
          id: submit-plan
          input_has_field: {name_any: [section_ids], constraints: present}
          output_has_field: {name_any: [status], values: meaningful}
```

The seventh example matches the derived context-level edge through the `uses` of its source (`billing-gateway → billing`); the eighth counts a use by a descendant of `api`; the ninth is the guard of the interface tutorial's step 2; the tenth passes through the interface-level restrictions (the operation declares none of its own) and exercises `in`, `name_any`, `syntax_any`, `examples_at_least`, and `input_has_field`; the eleventh reads the responsibilities requested through the used operation; the twelfth exercises `constraints` and `values: meaningful`.

## 9. Editor

### 9.1 Layout

- DOM order, identical at every width (no CSS reordering): toolbar → outline (collapsible) → message region → canvas → inspector → bottom panels. The **message region** (since the UML-view editing work, `docs/superpowers/specs/2026-11-12-c4-uml-view-editing.md` §7.5) is a `section` named "Messages" directly before the canvas region, drawn over the canvas's top edge while the canvas keeps room for it at its top, so a message that appears never moves the drawing. It shows one message at a time (an instruction, a refusal, or a result, with at most one offer and a Dismiss button) and is not a live region; the editor's polite live region announces the same words, and `host.announce` receives them. A refusal carries the visible label "Not done:" with an icon before the sentence; the label is not part of the sentence. The region shows the refusals and mode instructions of C4-notation views too (decision D6 of 2026-11-13). Without the messages part, or in a read-only editor, the DOM is as before. The editor root is a size container (`container-type: inline-size`) with an em-based breakpoint, so inline embeds in a narrow chapter column stack instead of overflowing. Toolbar groups and the panel tablist wrap; narrow widths gain a "More" menu.
- **Toolbar**: view switcher (level buttons as a toggle group with `aria-pressed`, plus a scope `<select>`); outside that group, an "Interfaces" button that opens `interfaces of` the selected element and a "Show interfaces" toggle button (`aria-pressed`) on C4-notation and dynamic views that adds or removes the `with interfaces` suffix (both shown in the expert profile and in any model with interfaces; J14); breadcrumbs; **palette** (level-aware element-type tiles: drag one onto the canvas to place it, or click it to add at an automatic position; collapses into an Add menu at narrow widths); Add relationship; Undo/Redo; magnification (Zoom out, readout, Zoom in, Reset zoom, Fit; the site's existing names); Reset layout (unpins every element in the view); Full screen; file actions from the host (Open, Download YAML, Download SVG, Copy ArchUML source for UML views; on an interface card, "Copy description" replaces Download SVG and copies the card's description as Markdown through `host.copyText`); Help. The editor opens at 100% magnification; Fit is only on request.
- **Outline**: `role="tree"` of people, systems › containers › components › code, interfaces (one top-level branch listing "Enrollment API (Registration API)"; Enter opens `interface <id>` and selects it in the inspector), scenarios, deployment environments, decisions, requirements; filter field; arrows, expand/collapse, type-ahead.
- **Canvas**: in edit mode the SVG has no `role="img"` and no `aria-hidden`; it is `role="group"` labelled with the view title (restored for export and print), and the screen-reader-only verbose block is omitted because the Explain panel carries it. One `<g role="listbox" aria-label="Elements in this view">` contains `role="group"` sets ("Inside Course Registration", "Outside the system", one per group) holding flat `role="option"` targets with roving tabindex and selection following focus. A boundary is its own option and never contains options. Option name = element name; description = type line, technology, external, "contains N — Enter shows inside", pinned, problem count. Connect handles are `aria-hidden` and unfocusable (the toolbar's Add relationship is the equivalent control). The canvas scrolls inside its own focusable region. **UML-notation views** (code, dynamic, deployment, interfaces) are editable since the UML-view editing work: the listbox lies over the delegated drawing in a group marked `data-layout-ignore`, with the sets and options of the view's module (classes and dependency lines; lifelines, steps, and fragments; nodes, hosted instances, and links; consumers, the subject, providers, interfaces, and uses), each option's ref the box's drawn alias, mapped to a model id for selection and focus. Descriptions name a step's kind, its fragment and branch, a link's origin, a lifeline's box, and "position kept" for a box that holds one; target marks with a non-colour cue show possible and other targets during a gesture. A new selection kind, `{ scenarioId, step: { containerPath, index } }`, selects a step; the scenario form reveals and marks its row.
- **Inspector**: forms for the selected element, relationship, scenario, deployment node, decision, requirement, group, or view. Element sections: Basics (name, kind, technology, description, external, in enterprise; type and path read-only); Responsibilities; Collaborators; **Relationships in this view** (outgoing, incoming, and derived edges, each a button opening the relationship inspector); Position (a collapsed disclosure, the single-pointer fallback for dragging: pinned state, Move up/down/left/right buttons with a step selector, X/Y fields, Return to automatic layout; also in UML-notation views where the view holds layout, positions in code and interfaces views and for top-level deployment nodes, the lifeline order in dynamic views, and for a box that holds no position the refusal's sentence instead of controls); Design choices (collapsed); **Interfaces** (§9.5; on code elements, `provides` stays a read-only list under More); More (owns, invariants, quality, stereotypes, group, source, tags, id); Decisions affecting it. Code elements add Members (attributes, operations, extends, implements). Relationships: description, technology, connector, **Uses** (§9.5), choices; derived edges show their sources and "Add a summary relationship". Scenarios: an ordered step list (from/to pickers limited to valid steps, description, technology, connector, move up/down, fragment insertion for alt/opt/loop/par/break). Deployment nodes: kind, technology, instances, hosts (multi-select of containers and systems), nested nodes, node collaborators.
- **Bottom panels** (tablist): Problems, Review (automated results and human-judgment prompts, including the interface prompts in §9.5), Explain (verbose description of the current view, shown in print regardless of the active tab), YAML (when `sourceEditor` is true).
- Every control is at least 24 × 24 CSS px (twisties, × buttons, breadcrumb links, readout).

### 9.2 Interactions

**Direct manipulation is the default** (user direction, 2026-11-08): pointer users work by dragging, as in diagramming tools, and every drag also has a single-pointer alternative (WCAG 2.5.7) and a keyboard path. The alternatives live in an element's context menu (right-click, long-press, or its "⋯" button), the toolbar, and collapsed inspector sections, so they never clutter the default view.

| Action | Default (pointer) | Single-pointer alternative | Keyboard |
|---|---|---|---|
| Move an element (pins it) | Drag it; a grid snap and alignment guides help; Shift locks the axis; Escape during the drag cancels | Context menu "Move…", then click the destination; or the Position disclosure | M, arrows (Shift: larger steps), Enter |
| Create a relationship | Drag from a connect handle (shown on hover and selection) onto the target | Click the handle or the toolbar's Add relationship, then click the target | C, then pick the target |
| Add an element | Drag a palette tile onto the canvas (placed and pinned where dropped) | Click a palette tile (automatic position) | A opens the Add menu |
| Refine a parent responsibility | Drag it from the carry-down tray onto a child element | The tray item's "Refine into…" menu | Same menu |
| Reorder list items (responsibilities, collaborators, steps) | Drag a row by its handle | Move up / Move down in the row's menu | The same menu items |
| Re-parent an element | Drag it in the outline onto its new parent (valid targets only) | Context menu "Move to…", then choose the parent | Same command |
| Move a relationship to another source or target (for example from a container down to the component that sends or receives it) | Drag the relationship's end onto the new element (valid ends only) | The relationship's context menu (or its row under **Relationships in this view** in the inspector) "Move to…", then choose the new source or target | Same command |
| Pan the canvas | Drag empty canvas space | Scrollbars | Arrow keys in the focused canvas region |
| Magnify | Ctrl/Cmd+wheel or pinch | Zoom buttons | Ctrl/Cmd+=/−/0 |
| Zoom into an element | Double-click, or click its zoom badge (shown on elements with children) | The zoom badge | Enter |
| Rename | Click the selected element's name to edit it in place | Inspector name field | F2 |

- Drags give continuous feedback (a ghost, snap guides, highlighted valid drop targets with a non-colour cue such as a thicker dashed outline), trigger on pointer up (WCAG 2.5.2), and form one undo step. Dropping on an invalid target or pressing Escape returns everything unchanged. The live region announces the result ("Moved Registration API to 320, 140; position pinned."). A drop onto another element is drawn where it was dropped and the elements it covers make room; the announcement names them ("… position pinned. Registration API moved to make room."). When another pinned element keeps the dropped one off its pin, the announcement says where it is drawn ("…: it is drawn at 320, 300, nudged down so it does not overlap another pinned element; position pinned.").
- Touch: one finger drags elements and pans empty canvas; a long press opens the context menu; two fingers pinch to magnify. Canvas hit targets stay at least 24 × 24 CSS px at every magnification.
- **Zoom out**: Alt+↑ (Option+↑ on Mac), the breadcrumbs, or "Up to …". Zooming into an element without children opens an empty boundary with an "Add the first container/component" button and the palette ready for dropping.
- **Add details**: the palette offers only types valid at the current view (the expert profile adds "All types"); in dynamic views it offers Message and Fragment (a menu of the five operators), in deployment views Node, Infrastructure node, and Host a container or system, then the line tools Link between nodes and Relationship between hosted elements; in code views Class, Abstract class, Interface, Enum (Function and Module in the expert profile), then Generalization, Realization, and Dependency; in interfaces views Provided interface and Use an interface. Tools a view cannot offer are listed, disabled, with a one-line reason, in a disclosure after the available ones (decision D7). The Dynamic and Deployment level buttons offer "New scenario…" and "New environment…". A new element is inserted in the YAML, selected, and its name ready for in-place editing; the name committed there also sets its id (§4.10).
- **Relationship details**: dropping a connection (or choosing a target) opens a small anchored form with the description and its read-aloud preview ("Registration Coordinator asks for an eligibility decision from Enrollment Policy"), technology, and connector; Enter confirms; Escape removes the pending relationship.
- **Move a relationship**: "Move to…" opens a small anchored menu with two groups, "New source" and "New target", each listing the valid elements in the model's order, the moved end's own children first (the usual move one level down); an element whose name another element of its group shares is listed with its type and the element it lies in ("Billing System (container in Course Registration)"), and with its id when even those are the same (the element's "Move to…" menu, which re-parents it, does the same); for a drag, the same elements are the valid drop targets. The command rewrites the relationship in one text splice and one undo step, keeping its description, technology, connector, `uses`, `responsibility`, and choices; it moves the collaborator entry to the new source, or renames its key for a new target. It refuses a move that would duplicate a relationship already declared between the new pair (the message names that relationship) or point an element at itself. Afterwards the inspector shows the moved relationship's form, so a `uses` or `responsibility` that is no longer valid for the new pair (`model/interface-provider`, `model/responsibility-owner`) is fixed in place, and the live region announces the result ("Moved 'writes seat holds to': now from Seat Gateway to Registration Database"). The `xlevel/unreceived` and `xlevel/unsent` quick fix "Choose which part receives (sends) it" opens the same menu with the decomposed element's children; the novice profile shows these two rules and their quick fix although they are info (§7.2), because the quick fix is how a novice moves a relationship down a level.
- **Delete**: Delete or Backspace on a focused option or treeitem, or the inspector button; confirmation through `host.confirm` lists every dependent reference (§4.10).
- **Rename**: F2 (or clicking a selected element's name) edits the name in place on the canvas; Enter commits, Escape cancels; the inspector name field is equivalent. "Change id…" validates on submit, names the problem, and suggests a fix ("Ids start with a letter and use letters, digits, - or _; try seat-gateway").
- **UML-notation views** (UML-view editing spec §5, §7.4): every gesture of the diagram editor becomes a `design.yml` change through the C4 model adapter, as one batch and one undo step, or is refused before anything is written, with a sentence from the reviewed refusal table in the message region. The table of §7.4 there gives every drag a single-pointer path and a keyboard path (WCAG 2.5.7, 2.1.1). A double-click edits a name, a member, a step description, or a guard in place; Enter opens (in a code view nothing opens). M moves a box by exactly 10 units per arrow key (50 with Shift) and Enter places it; in a dynamic view Up and Down choose a step's or fragment's place and Left and Right a lifeline's. C on a step or fragment opens the step form after it; F2 on it edits its description or first guard. A line's menu in a code or deployment view adds and removes bends ("Add a bend", "Move bend n…", "Remove bend n", "Straighten"), with the bend numbers drawn while the line is selected; a sequence message has no bends. The "⋯" button of the selected item sits beside it, outside every other hit target (the diagram editor's `actionButtonPlace`). No new key was added: these are the keys above acting on more kinds of options.
- **Undo/redo**: host undo when `undo: 'host'`; otherwise text snapshots (100 entries; edits within 600 ms merge), and every Undo and Redo, from the toolbar, the keys, or the YAML tab, is announced with the label of the step it takes back or repeats ("Undone: Move Student.").
- **Shortcut scope**: Enter, Delete/Backspace, F2, M, and C act only on a focused canvas option (Enter, Delete/Backspace, F2 also on an outline treeitem); A (Add menu) and F (full screen) work while focus is in the canvas; Ctrl/Cmd+0 resets magnification, Ctrl/Cmd+= and Ctrl/Cmd+− zoom; letters never fire in the outline (type-ahead), menus, or form controls (input, select, textarea, contenteditable, Monaco); the toolbar keeps native activation. `aria-keyshortcuts` sits only on the controls the keys activate (Add relationship "C", Full screen "F", Help "Shift+?"). In tutorials Ctrl/Cmd+Enter calls `host.onRequestCheck` and Ctrl/Cmd+S is routed to the host; the tutorial host runs Test My Work for it in every `checks.display` mode (never Check now), except that under `after-submit` it stays disabled until Submit for review has run (§11). `/shortcuts/` gains a "C4 editor" section, and its Conflicts paragraph discloses that magnification keys apply inside the editor canvas.
- **Escape order** (innermost first, one layer per press, each calling `preventDefault`; the editor ignores events already prevented): popover → menu → dialog → Move → full screen → clear selection. The browser's own full screen takes Escape before the page sees it, so the editor uses it only where the Keyboard Lock API keeps Escape for the page (a long press still leaves); elsewhere it uses its full-screen overlay (2026-11-10, Task 12; `docs/c4-editor.md`). Dialogs (Add relationship, Change id, default confirm) are labelled `<dialog>` elements opened with `showModal`, mounted inside the editor root so they work in full screen, with initial focus and focus returned on close. Popovers mount inside the root.
- **Focus**: zoom in → first child option or the empty state's button; zoom out → the option of the element just left; delete → next option in arrow-key order, else previous, else the canvas region (an empty view has no listbox); Add → name field; F2, Add, and Problems' Show activate the inspector tab first in the stacked layout; dialog close → the control that opened it; any re-render restores the focused option by `data-layout-id`. Every editor focusable has `scroll-margin-block` (top ≥ the site navbar, bottom ≥ the read-aloud bar), and the focused option is revealed inside the canvas scroll region explicitly.
- **Announcements** (polite live region): view changes ("Component view of Registration API, 4 components"), additions, moves, problem counts (debounced).
- **Diagnostics in forms**: inline text starting with a severity word ("Error:", "Warning:", "Suggestion:"), linked by `aria-describedby`; `aria-invalid` only for error-severity diagnostics on that field. Problems rows name the element and field; Show focuses the field.
- **Performance**: YAML typing is debounced 250 ms; form edits apply immediately. Targets (one set, reconciled with the routing redesign §8): the DOM-free state update (parse, check, project) within 100 ms for 200 elements; layout and routing within 250 ms for a 40-element view (hard ceiling 1500 ms, a CI gate in the renderer tests); a drag re-routes only and never re-ranks; views above 40 elements may lay out after an idle callback with the previous drawing kept; measured by `c4/bench.js` and a Chromium timing gate over the reference views; collapsed outline subtrees render lazily.

### 9.3 Novice scaffolds

Each scaffold is switched independently (`scaffolds`); learners may toggle frames and the carry-down tray without affecting grading.

- Empty-state guide (in the chapter's subgoal order): "Add the system you are designing" → "Who uses it, and which systems does it depend on?" → "What must it know, do, or decide? Trace each to a requirement." → "Zoom in: add containers and give each responsibility one owner (Refine into…)".
- Level-aware Add menu; inline definitions with a "not to be confused with" line, as dismissible popovers that stay open on hover and focus. The wording carries the chapter's decision rules (§12, Abstractions). Person: "A human who uses a software system, named by role, such as Student." Software system: "Software that delivers value to its users, usually built and run by one team. External means built and run by another team, even inside your organization." Container: "An application or data store that must be running for the system to work, such as a web app, an API, or a database schema. Not a Docker container, which is only one way to run it." Component: "A group of related functionality behind one interface, inside one container. It is deployed with its container, never on its own." Code element: "A class, interface, function, or module that implements a component." Browser app: "runs in the user's browser — separate from the server that delivers it".
- Responsibility editor: KNOW/DO/DECIDE select, sentence frames (visible hint text beside the field, never field values), inline lint. KNOW: "<Element> can tell its clients … (for example, which seats are held for each attempt)." DO: "<Element> makes sure that … (an action and the guarantee it keeps)." DECIDE: "<Element> decides whether … (a judgment that applies a rule)."
- Collaborator editor: read-aloud preview, read as "<Source> <description> <Target> [<technology>]", with the hint "Say what <Source> asks <Target> for, starting with a verb: 'requests tuition charges from'."; technology required only across containers.
- Interface sentence frames (visible hint text beside each field, never field values; switchable with the other frames): Purpose "When a client …, <provider> … and returns …." (request and response), "When a sender sends …, <provider> …." (message interfaces), or "When <provider> publishes …, subscribers can …." (event interfaces); Side effect "After a successful call, … has changed: …."; Restriction "Only … may call this, and only when …."; Error (the "when" input; the name has its own input) "Happens when …; the client should then …."; Delivery (event and stream) "A subscriber may receive this … (once, or more than once) and … (in order, or in any order)."; Meaning "The … that this field identifies or measures, for …."; Unit "A value of 1 in this field means one … (second, cent, kilogram, item)."; Format "Written as …: which comes first, day or month? Which time zone?".
- Definitions popovers: **Interface description**: "what a client needs to use an element without reading its code: the syntax (operations, inputs, outputs, types) and the semantics (purpose, side effects, restrictions, errors, examples, meanings, units). Not a C4 abstraction: you describe one wherever a client crosses the boundary of a system, a container, or a component. Not to be confused with a UML «interface» in the code view, which lists operations only." **Syntactic view**: "how to call it: operations, parameters, outputs, types, allowed values, constraints." **Semantic view**: "what it means: purpose, effects, who may call it, what can go wrong, examples, units and formats." **Shared vocabulary**: "terms both sides agree on, so the same word means the same thing." **Style** (one line per option in the select): REST "requests to resources over HTTP"; RPC "calls a function on a remote server"; GraphQL "queries a typed schema over HTTP"; SOAP "XML messages with a formal contract"; Message "commands sent through a queue to one receiver"; Event "announcements a publisher sends to any subscriber"; Stream "a continuous sequence of records"; Library "calls inside one running program"; File "a document two systems exchange"; Not sure yet (the novice default).
- Carry-down tray: inside a scope, the parent's responsibilities with how many descendants refine each; drag one onto a child element (or use "Refine into…") to create a refining responsibility. It opens and closes with a "Responsibilities to refine" toggle button (`aria-expanded`) in the scope's header, at the top of the boundary, and the toggle's name is the one the chapter and tutorials use.
- Responsibility trace: selecting a responsibility highlights its ancestors' and descendants' refinements with a non-colour cue, lists them in the inspector under the responsibility as text ("Refines: DECIDE whether a student may enroll in a section (Course Registration)"; "Refined by: DECIDE whether prerequisites … (Enrollment Policy)"), each a button that selects that element, and announces the count in the polite live region ("Refined by 1 responsibility, refines 1"). §13's editor tests cover the lists and the announcement.
- Review prompts for C4 views (human judgment, in the Review panel for every C4-notation view, beside the interface prompts of §9.5): "Does each box's type match who builds and runs it? Is a data store your team runs drawn as its own software system?"; "Which element is the only writer of each fact, and the one maker of each decision?"; "Read each arrow aloud from the element that asks: does it say what is asked, and how it travels where it crosses a container?"; "Which reader and question is this view for, and which level did you leave out for them?"; "Does each responsibility keep the meaning of the requirement it traces to?"
- Problems empty state: "The checks found no problems. They test consistency and some completeness, not whether boundaries, owners, or names are right; see Review."
- `reveal: 'on-request'` for prediction tasks: starts at a named view, keeps the outline collapsed below the scope, and hides Explain until "Show inside".
- `checks.display`: `live`, `on-request` (a "Check now" button), or `after-submit` (nothing until `submitForReview`, offered as a "Submit for review" button). Under `on-request` and `after-submit`, inline lint (`scaffolds.inlineLint`) is suppressed until Check now or Submit for review runs, and then shown along with the Problems panel. While checks are withheld, the canvas of a UML-notation view says no more than the scenario form's pickers show: target marks tell the possible ends from the others, and a refused step gets the general sentence `step/not-available` (short reason "No step possible here"), with no reason and no offer (UML-view editing spec §5.1).

### 9.4 Styling and print

`css/c4-editor.css` (ArchUML) defines layout and states with `--c4-ui-*` variables and `em` sizes; form controls use `font: inherit`. Magnification uses a `--c4-zoom` custom property consumed by a stylesheet transform. No inline style attributes except CSSOM-set computed values. The site's `css/c4-editor-theme.css` maps tokens and adds `html.dark-mode` and print rules, and loads through `_includes/head.html` (page flag `c4`) before `print-light.css`. Print resets `--c4-zoom`, makes the canvas `overflow: visible; height: auto`, keeps the SVG within the page width (`max-width: 100%`, `break-inside: avoid`), shows the Explain panel, and hides toolbars and panels. When the canvas shows an interface card, print shows the card and not the Explain panel, so its text appears once. Size variants use modifier classes (`c4-editor--compact`, `--regular`, `--tall`), never a style attribute; `--fill` (final review I7) makes the root a size container whose canvas takes the height the host gives it, less the rows above the canvas (a measured `--c4-canvas-top` set through the CSSOM), which the tutorial workspace uses together with the `outline: 'collapsed'` mount option below 60em of column width.

### 9.5 Interfaces in the editor

- **Interfaces section** (element inspector of systems, containers, and components): a list (the generic list editor: drag to reorder, row menu with Move up, Move down, Remove, Change interface id…) of the element's interfaces, each row showing name, style, operation count, and a problem count; "Add interface" (name → slug id; a shorthand list is converted to the full form first, in one undo step, keeping derived operation ids); "Show interfaces view". A shorthand interface row offers "Describe fully" (the conversion) and edits its syntax lines inline.
- **Interface form** (opened from a row; breadcrumb "Registration API › Enrollment API" with a Back button): Basics (name, id read-only with Change interface id…, style select with the one-line definitions and the novice default "Not sure yet", technology, version, description), then a two-tab tablist (`role="tablist"`; Left and Right arrows, Home, End; each tab panel labelled). Tab names carry their problem counts ("Semantic view, 2 warnings"). Problems › Show selects the tab that holds the field before focusing it.
  - *Syntactic view*: Operations (list editor; each operation a disclosure with id, syntax, input and output pickers offering the primitives, this interface's types, a list toggle, and "Inline fields"); Types (list editor; each type a disclosure with description and a field list: name, type picker, required checkbox, allowed values, constraints).
  - *Semantic view*: "All operations" (restrictions and errors of the interface); then one block per operation, headed by its syntax line ("submit-plan: POST /v1/enrollments"). In the novice profile purpose, errors, and Realizes come first, and side effects, restrictions, and examples sit in disclosures labelled with their state ("Side effects: not described yet"). Errors are a list of name, code, and "Happens when …; the client should then …". Examples are built from the operation's input and output fields (one value box per field, typed as the field's type); the expert profile can switch to YAML flow text, and text that does not parse stays in place as a draft with "Error:" and the parser's message, and is not written. Realizes is a checkbox group of the provider's responsibilities, then each descendant's, grouped by owner and labelled "DO hold a seat in every section of a plan, or in none (Registration API)"; checking one calls `ensureResponsibilityId`. In the expert profile a descendant's responsibility that refines none of the provider's carries the visible note "private to <owner>"; the novice profile shows no notes, so the choice stays a judgment, and live lint reports `interface/realizes-internal`. "Meaning of data" lists every field of every type and inline map with its name and type shown read-only ("units_enrolled: number"), then Meaning, Unit (for numeric types and for text fields the `interface/no-unit` heuristic flags), Format (for temporal and text types), value meanings for fields with values, and Example behind a disclosure; "Show all properties" reveals every input, and the filter "Fields that need a unit or format" narrows the list. Shared vocabulary (term and meaning list; shared terms shown read-only with a link to the model's vocabulary).
  - Inline diagnostics on the fields (§9.2 rules); "Show description card" opens `interface <id>` on the canvas.
- **Uses picker** (relationship form and the anchored relationship form's "More"): a `<fieldset>` per group of interfaces that §4.11 allows for this relationship, from `ArchUMLC4.usableInterfaces` (core order: document order, each entry with its `relation`). For a relationship entering a container from outside, the entered container's interfaces come first ("Interfaces of Registration API (where the request enters)"); then the target's own; then remote interfaces offered by elements inside the target; then, for emitters and channels, "Interfaces <source> emits" and "Interfaces carried by <topic>". A component's in-process interface is never offered to a source in another container. Within a group, operations come first (those realizing the collaborator's `responsibility` first), and the whole-interface entry comes last as "Some operations of Enrollment API (unspecified)"; within one interface the whole-interface entry and the operation entries are mutually exclusive. Checking writes `uses` with `setUses` and switches a string collaborator to the map form. Empty state: "Neither Enrollment Policy nor the elements around it offer a described interface yet." with "Add an interface to Enrollment Policy". A derived edge lists the union of its sources' uses read-only.
- **Interface views on the canvas**: `interfaces of` renders the delegated UML component diagram inside its C4 title, legend, and notes, with the same listbox of options as other views over its components (option names from `toUml`'s `ids`; Enter on a consumer or provider opens its own interfaces view). Since the UML-view editing work it is editable (UML-view editing spec §5.5): its boxes can be moved and hold positions (decision D3), a provided interface and a use are added and removed through the model, a double-click renames, and the Position section and Reset layout work there. `interface <id>` renders the HTML card; each operation's syntactic block holds a native button "Edit submit-plan" that opens the operation in the interface form with focus on its syntax field, and Back returns focus to that button. The selected operation's syntactic and semantic blocks get a thicker dashed outline and a "Selected" text badge, and the canvas scrolls the focused block into view.
- **Review panel prompts** (human judgment, shown for interface views and for elements with interfaces): "Could a team that never spoke to you call this operation correctly from the description alone?"; "Which fields carry a quantity or a date; is the unit or format stated, what does it include (tax, fees), and what is it measured against (time zone, coordinate frame)?"; "Which test would show that both implementations read this field the same way?"; "Does any name reveal how the provider stores or computes data?"; "Which operations or fields does no client need?"; "Can this interface grow without breaking clients (an optional input field, an open list such as add-ons), and which change would need a new version?"; "Does every term mean the same in every interface it appears in?"; "For each error, does the client know what to do next?"; for `event` and `stream` interfaces, "Can a subscriber receive it twice, out of order, or not at all?"; for an `interfacer` component or an Adapter-pattern role that provides one interface and uses another, "Which formats, units, and terms does it translate?". Automated results list operations without purpose, errors, or examples and fields without unit, format, or meaning; the novice checklist always lists fields without a meaning.
- **Code elements**: `setList` refuses `provides` when the element's value is a full-form map (`{error: 'provides-full-form'}`); the More section shows a full-form `provides` read-only with a link to the Interfaces section.
- No new shortcut keys. The interface form's tablist uses the standard tabs keys (Left and Right arrows, Home, End), which the `/shortcuts/` C4 editor section lists.

## 10. Site integration

- **Registrations**: `c4` in every ArchUML type list (bundle renderer maps and selectors, container classes, fallback captions, `css/uml-diagram.css` hide/variables/dark-filter/sizing lists, `css/print-light.css`, `_plugins/uml_static.rb`, `uml_render.js`, `uml_to_svg.js`, `uml-auto-describe.js` describer cases, `se-gym-workout-loader.js`, `SEBook/tools/uml-reference.md` type map). `REFERENCE.md` gains a C4 section.
- **Static prerender**: `uml_to_svg.js` inlines the manifest scripts into its page and includes them in `RENDERER_HASH`; `uml_static.rb` appends them to `RENDERER_INPUT_PATHS` (the script-path index becomes a named constant) and emits the source element; `uml-static-plugin.test.js` covers C4 fences, data blocks, both fingerprints, and the source element. `scripts/tests/c4-content.test.js` validates every shipped model and every `c4` fence in SEBook pages (no errors; selectors resolve) so broken figures fail locally.
- **Describer**: `uml-auto-describe.js` describes C4 through `ArchUMLC4.describe`; `uml-describe-cli.js` requires the core in Node. Interface cards are text, so the describer adds no label or verbose block to a container with `data-c4-notation="interface-card"`; `uml_static.rb` emits card markup without them (§6.6).
- **Card styles**: the card's layout, tokens, `html.dark-mode` colours, and print rules live in the C4 section of `css/uml-diagram.css` (loaded wherever UML figures appear, including lazy C4 figures), which also excludes card containers from the dark-mode invert filter; `css/print-light.css` keeps the card light in print.
- **Includes**: `_includes/c4-view.html` (`model`, `view`, `caption`, `description`); `_includes/c4-editor.html` (`model`, `view`, `profile`, `task`, `size`) with a no-JavaScript fallback (static figure plus YAML source); `_includes/c4-scripts.html` (from the manifest via `_data/archuml_c4_manifest.json`, a symlink to `js/ArchUML/c4/manifest.json`), loaded when front matter sets `c4: true` and mirrored for combined course pages.
- **Standalone editor** `SEBook/tools/c4-editor.md`: examples inlined at build time (course registration, a campus-booking starter, blank); loading an example over unsaved work asks first. One localStorage draft `c4-editor-draft` = `{version: 1, text, savedAt, view}`, written debounced only after user edits; a non-modal restore banner; a visible message when storage is unavailable; a notice when another tab changes the draft. Opening a figure's fragment while a draft exists asks: Replace draft / Keep draft / Download draft first; never a silent overwrite. The profile switch is kept in memory. Chapter embeds keep edits in memory only.
- **Inventories**: `cookies.html` row for `c4-editor-draft` (purpose, record shape, multi-tab behaviour); `shortcuts.html` "C4 editor" section; glossary entries `C4 model` (prose writes "C4 model" in lowercase so it expands), `RDD`, `ADR`, `IR`, `AMQP`, `DSL`, `TBD`, `JAR`, `DLL`, `SVG`, and `SOAP` if the chapter names it (`API`, `REST`, `RPC`, `JSON`, `HTTP`, `HTTPS`, and `XML` already exist; units are spelled out, such as "newton-seconds" and "pound-force seconds", so they need no entries); `_data/sebook_nav.yml` entries (chapter, tutorial, interface tutorial, editor); bibliography entries.
- **Terminology notes** in `SEBook/software_architecture.md` and `SEBook/uml_component_diagram.md` linking to the chapter.
- **Supply chain**: a test verifies `js/ArchUML/vendor/yaml/2.9.1` (SHA256SUMS, exact version, licence, no AMD branch, no `</script`).

## 11. Tutorial integration

- **Backend** `c4` in `TutorialCode`, installed by `js/tutorial-c4.js` (AADL/TLA adapter pattern), with DOM-free assessment through `ArchUMLC4.query`. Work items: the dispatch sites listed in the tutorial-authoring skill; `_layouts/tutorial.html` passes `c4: config.c4 || {}` and loads the C4 scripts and CSS when the backend is `c4`; `_setActiveFile` and `_renderTabs` gain a C4 branch (activation, no tab popout).
- `design.yml` is an ordinary tutorial file (`language: yaml`), so autosave, Reset, `solution.files`, `reseed`/`persistent`, progress keys, quizzes, popouts, and print work unchanged. No new storage key.
- **Instruction figures**: `c4` fences in step instructions render in the step pane, in the detached instructions popout (`tutorial-instructions-popup.html`), and in the print view. The popout and the print view load the ArchUML bundle, the C4 manifest scripts, and `uml-auto-describe.js`, and run the renderer and describer on the inserted instructions (as the popout already does for Mermaid); print waits for rendering to finish before printing.
- The editor binds to the file's Monaco model with `undo: 'host'` and `sourceEditor: false`; the tutorial's surface switch, with the visible labels "Visual" and "YAML" above the editor, makes the Monaco model the YAML surface; edits apply as `pushEditOperations` under a `writing` guard; model changes call `editor.setText`.
- Configuration `c4: {file, view, profile, scaffolds, checks, locked_fields, reveal, read_only}` at tutorial and step level. A step-level `c4` merges over the tutorial-level `c4` key by key, and `scaffolds` and `checks` merge by sub-key. Scaffold and check keys keep the host option's camelCase (`sentenceFrames`, `inlineLint`, `carryDown`, `emptyStateGuide`, `honorFileIgnores`; one shape with the host `scaffolds` and `checks` options, §7.2); `_initC4` and the content test reject unknown keys under `c4.scaffolds` and `c4.checks` as author errors. `read_only` maps to the host `readOnly` option (for example a quiz-only step that shows a model).
- **Locked fields**: `locked_fields` lists dotted YAML paths (`requirements`, `systems.registration.responsibilities`, `systems.registration.containers.api.responsibilities`) and maps to the host `lockedFields` option. One semantics everywhere (editor `isLockedPath`, YAML-surface revert, content test): a path is split on `.`; a segment `*` matches exactly one key or list index; a lock covers the matched node and all its descendants; there is no implicit exemption — to leave meanings editable while locking syntax, lock the syntax leaves (for example `systems.registration.containers.api.provides.enrollment-api.types.*.fields.*.type` and `…operations.*.syntax`). Locks bind both surfaces: the visual editor refuses edits to a locked path, and an edit on the YAML surface that changes a locked path is reverted with a visible message naming the path (the editor's `lockedSentence`). Only the locked node is put back and the learner's other edits stay; when the locked node was removed or reshaped so that it cannot be put back alone, the text returns to the last readable text and the message names the other edits undone with it.
- **Test My Work and display modes**: Test My Work and Ctrl/Cmd+Enter run the step's tests in every `checks.display` mode. When the effective `checks.display` is `after-submit`, `js/tutorial-c4.js` renders a "Submit for review" button that calls `editor.submitForReview()`; until it has run in the current step visit, Test My Work and Ctrl/Cmd+Enter are disabled with a visible text reason. Inline lint under `on-request` and `after-submit` follows §9.3.
- **Hints**: `condition: {c4: <predicate>}` is handled by an early `typeof condition === 'object'` branch in `js/tutor-chat.js` `_evaluateHintCondition`, delegating to `tutorial._evaluateC4Hint`, evaluated against the frozen snapshot of the test run; false when the model cannot load, and false, silently, when the predicate names an id, view, or scenario that does not resolve (never an author error). For the `c4` backend, tests whose result is `null` produce no authored or fallback hints; a single "Fix the YAML errors first" card replaces them. The call of `TutorChat.onTestFailure` in `_renderTestResults` is guarded so a hint failure cannot leave the test controls busy. Hints follow the ladder orient → diagnose → scaffold and never give the target text.
- **Tutorial content** `_data/tutorials/c4.yml`; page pair `SEBook/architecture/c4-tutorial.md` + `c4-tutorial/print.md`; about 91 minutes (the sum of the step estimates below) with an optional break after step 5. Interface descriptions are practised in the follow-up tutorial "Describe an interface" below (D10).

| Step | Activity | Structural checks | Scaffolds | Minutes |
|---|---|---|---|---|
| 1 | Predict (quiz-only step with a static context figure): the web form, the API, and a database trigger could all check prerequisites; which should own the DECIDE, and what goes wrong with the other two? | — (quiz) | — | 5 |
| 2 | Investigate in the editor (`reveal: on-request`): zoom in to confirm, answer one Explain prompt | `view` shows | all | 8 |
| 3 | Repair the model behind a context view (a database modelled as its own software system, an unlabelled relationship to billing, a "Backend" box, a missing adviser); kept parts must survive | adviser shown; billing relationship described; no generic names; database not a system | frames, live lint | 10 |
| 4 | From three requirements (one failure case), write the system's KNOW/DO/DECIDE with `requirements:` references | each requirement referenced; ≥ 1 DECIDE; no `rdd/not-an-obligation` | frames, live lint | 10 |
| 5 | Allocate system responsibilities to containers (completion problem, seeded ids), then name the one collaboration the seed leaves out, the web app's relationship to the API (the chapter's subgoals 2 and 3) | refinement coverage by id; eligibility not in a `browser_app`; technology or TBD on containers; `web → api` declared with a technology; no `rdd/no-reason` or `c4/vague-relationship` warning (guard) | carry-down tray, live lint | 12 |
| 6 | Zoom into the Registration API (faded worked example: coordinator given, components stubbed) | coordinator refines nothing about eligibility; one writer of seat holds; collaborator targets advertise the requested responsibility | lint on request | 12 |
| 7 | Change impact: first open the Enrollment API's description card (`interface enrollment-api`) and read what its outcome returns; designs A and B as read-only figures; predict which elements' responsibilities, collaborators, invariants, and interfaces change for "unit caps per major"; then implement in B, making the change without changing what clients of the Enrollment API see | new DECIDE refines `api-eligibility` in `policy`; `same_as_seed` on coordinator and on the interface `enrollment-api` | lint on request | 11 |
| 8 | Seat-hold failure: the `enroll` happy path is seeded; add the `alt` failure branch and predict which missing relationship `xlevel/scenario-step` reports | branch exists; steps valid | lint on request | 8 |
| 9 | Transfer: makerspace equipment loans from three written requirements; self-review with a rubric (audience and levels, one owner per KNOW/DECIDE, labelled relationships, refinement), then diagnostics, then one revision; compare with two reference models that differ in one decision and explain the difference as a design decision | no errors; each requirement referenced | `checks.display: after-submit`, frames off by default | 15 |

Every step has one reasoning check (a knowledge-check item or an Explain prompt) and says what the checks cannot judge. `scripts/tests/c4-tutorial-content.test.js` validates predicate keys, runs each solution (pass), each seed, at least two alternative correct models per graded step (renamed ids, synonyms, relationships declared one level deeper; pass), and plausible wrong models (fail). Each seed fails at least one targeted test; guard predicates (`absent`, `same_as_seed`, `max_errors` over a seeded-valid model, and checks that a seeded part survives) are exempt and must instead fail on the named wrong model that breaks the part they guard.

The change-impact step states its constraint in the implementation phase, after the prediction is committed ("Make the change without changing what clients of the Enrollment API see"); its hint for the interface check asks "The new rule ends in a refusal. Does the outcome already have a way to say why a plan was refused?"; its explanation names the variability the interface already allows (the free-text `reason`), notes that a new optional output field would also be a compatible extension, and names reason codes with a version bump as a legitimate alternative whose cost is a change in every client (interoperability versus changeability).

**Follow-up tutorial "Describe an interface"** (decision D10). Interface descriptions need practice of their own: predicting from a syntax-only description, completing a semantic view, writing a description without scaffolds, and a transfer question. Inside the C4 tutorial that would have added about 15 minutes (a 12-minute step, 2 minutes for a transfer brief with an external system, and the change-impact addition) for an honest total of about 103 minutes, so the practice is a separate tutorial: `_data/tutorials/c4-interfaces.yml`, page pair `SEBook/architecture/c4-interfaces-tutorial.md` + `c4-interfaces-tutorial/print.md`, backend `c4`, the §4.2 reference model, `learning_objectives` 7, about 30 minutes (4 + 15 + 10 + 3 = 32; the pilot below times step 2), assigned with the interoperability lecture, which spaces the practice after the C4 tutorial. Every step states what the checks cannot judge:

| Step | Activity | Structural checks | Scaffolds | Minutes |
|---|---|---|---|---|
| 1 | Predict (quiz-only step with the syntax-only Enrollment API card, `panels: syntax`; the read-only editor shows `interfaces of api`): an ungraded "recall, then extend" commitment in the instructions (name the chapter's two misreadings of the card from memory, then one more value the card leaves open that the chapter did not discuss, and what that misreading would cost a student) and one multiple-answer prediction item with `option_feedback`: the unit of `units_enrolled`, the time zone of `decided_at`, the spelling of `term`, and whom `reason` is written for are open; the HTTP method, duplicate sections, and the values of `status` are settled by the syntactic view | — (quiz, `min_score: 0.8`) | — | 4 |
| 2 | Complete the Enrollment API's semantic view (completion problem; the syntactic view is given and pinned by a guard test; a worked part is seeded: the meanings and formats of `student_id` and `section_ids`, and the interface-level 401 error; the provider's knowledge comes as team notes): purpose, side effects, one example, usage restrictions, at least two errors (on the operation or the interface), every field's meaning, the unit of `units_enrolled`, the format of `term` and `decided_at`, a meaning for each `status` value; link the operation to the responsibilities a client relies on; make the web app's relationship name the operation it calls. Then transfer within the step: describe the second operation, `check-plan` (`POST /v1/plan-checks`, input `EnrollmentRequest`, output `PlanCheck` with `eligible`, `units_planned`, and an optional `reason`; syntax given and locked): its purpose, its side effects (a check holds no seat and requests no charge), a meaning for each outcome field, the unit of `units_planned`, only the responsibility a check fulfils, and the web app's use of it. Billing's queue is a one-line shorthand sketch here (`provides: ["send ChargeRequested to the queue billing.charges"]`, with a whole-interface use from the Billing Gateway), so that §8's examples 7 and 8 hold on the seed and step 3 is not recall | purpose, side effects, ≥ 1 example; restrictions and ≥ 2 errors (inherited count); no request or outcome field without a meaning; each `status` value has a meaning; `units_enrolled` unit names quarter units; `term` format; `realizes` covers `api-eligibility` and `api-holds`; no `interface/no-unit`, `no-format`, `no-purpose`, `example-mismatch`, `realizes-internal`, or `undefined-type` warning (this also requires a unit on `units_planned`); `web → api` uses `enrollment-api.submit-plan`; guard: the syntactic view equals the seed's; `check-plan`: purpose, side effects, and `realizes` covering `api-eligibility`; no `PlanCheck` field without a meaning; `web → api` uses `enrollment-api.check-plan`; guard: `check-plan` lists neither `api-holds` nor `api-billing` in `realizes` | interface sentence frames, live lint, interface card | 15 |
| 3 | Write Billing's Tuition Charges interface, syntax included, from a prose brief and three follow-up answers (queue name; US cents before aid and fees; the rejected queue), with frames off. The seed is the §4.2 reference model without Billing's `provides` and without `uses` on the Billing Gateway's relationship (the reference describes `submit-plan` only, so `check-plan` is not carried over); the brief says Billing receives the messages as commands. The reveal states the compatibility rule that step 4 assesses (an optional field keeps senders working; removing or renaming a field, or making one required, needs a new version) | an interface on Billing with an operation that has a purpose, a typed numeric input field with a unit, and ≥ 1 error; `billing-gateway → billing` names an interface; every message field has a meaning; no consistency warnings (guard) | frames off, lint on request | 10 |
| 4 | Knowledge check (`read_only` editor on the reference card of Tuition Charges as feedback on step 3: "Name one line the reference has that yours lacks; go back to step 3 and add it"). Item 1, in a new domain: "A warehouse system asks a carrier's Rate Quotes API for a price with `weight: 12`, meaning 12 pounds. Rate Quotes says that `weight` is a number with the Unit kilograms, and the request passes the carrier's schema. What does the carrier price, and what would have caught the mistake before a parcel shipped?" (key: a test that sends a real quote and checks it against the stated Unit; feedback for "the schema would reject it", "add a Meaning", and "change the type to decimal"). Item 2: "Billing's team wants to add an optional `discount` field to ChargeRequested. Which clients must change, and which later change to the message would need a new version?" | — (quiz, `min_score: 0.8`) | — | 3 |

Steps 2 and 3 say what the checks cannot judge: whether the purpose is true, whether the error list is complete, whether a meaning is one another team would read the same way, and whether the chosen unit and format are the ones the client expects; that is what an integration test settles. Step 2's prediction from step 1 is revisited in its explanation, which pairs the learner's answer with the Mars Climate Orbiter (same structure: a schema-valid number, two units). The interface tutorial joins the think-aloud pilot recommended in §12 and is timed there.

- **Skill updates**: `tutorial-authoring` (backend, configuration, predicate vocabulary, hint condition), `sebook-authoring` (`c4` embeds, `data-uml-type` list), `diagrams` and `good-diagrams` (C4 type; reconciliation: one decomposed scope per view, context neighbours styled distinctly, type text on every box plus a small legend).

## 12. Chapter (`SEBook/architecture/c4.md`)

Front matter: `title: The C4 Model`, `layout: sebook`, `permalink: /SEBook/architecture/c4`, `c4: true`, `static_uml: true`.

**Prerequisites** (stated at the top, with links): UML class, sequence, and deployment diagram basics; the software architecture chapter; recommended background for the interface section: the interoperability chapter (`/SEBook/quality_attributes/interoperability`). No RDD knowledge assumed; the Design IR is defined in the chapter.

**Learning objectives**

1. Distinguish person, software system, container, component, and code, and classify real artifacts (an SPA, a schema, a library, a serverless function) at the right level (Understand/Analyze).
2. Write KNOW/DO/DECIDE responsibilities with one owner per KNOW and DECIDE, and refine them across levels (Apply).
3. Write relationships as sentences with direction, intent, and technology where it matters (Apply).
4. Choose views and levels for a named audience and question, justifying levels left out (Evaluate).
5. Critique a view against the C4 checklist and RDD heuristics, and repair it (Evaluate).
6. Explain what automated consistency checks can and cannot establish (Understand).
7. Write an interface description for a collaboration that crosses a container or system boundary: syntax (operations, inputs, outputs, typed fields) and semantics (purpose, side effects, restrictions, errors, and each field's meaning, unit, or format); link each operation to the responsibilities it realizes and each relationship to the operation it uses; explain why syntactic agreement alone does not make systems interoperable; and tell a compatible interface change from one that needs a new version (Apply/Understand).

**Outline** (9 H1s)

| H1 | Job | Figures and activities | Objectives |
|---|---|---|---|
| `# Why C4` | Commit-then-reveal pretest: what an ambiguous boxes-and-lines diagram cannot answer; then the same system as a container view. Shared vocabulary; diagrams as views of one model (the Design IR, defined here). | Freeform "before" figure beside the container view | 4, 5 |
| `# Abstractions` | Person, software system, container, component, code; nesting; box text and relationship sentences introduced with the first figure. The chapter stays focused on C4: where a term is used differently elsewhere (Docker container; the deployable component of other SEBook chapters), one short definitional clause says so, without a separate section or table. | Quick Check: classify six items | 1 |
| `# Responsibilities` | RDD at every level: KNOW/DO/DECIDE; knows ≠ stores; `owns`; collaborations become relationships; refinement; a short note on the lecture's noun-phrase collaborators; the minimal YAML subset (people, systems, containers, responsibilities, collaborators). Two short paragraphs on stereotypes and control style. | YAML beside its rendered view; Quick Check | 2, 3 |
| `# Zooming In` | A worked derivation from three requirements with subgoal labels (identify responsibilities → assign owners → name collaborations → zoom in), each subgoal as a YAML fragment beside its rendered view; then `##` System Context, `##` Containers, `##` Components, `##` Code, `##` Interface Descriptions (last: interfaces are not a level), each with purpose and audience, elements, relationships, responsibilities, common mistakes; a faded "finish the next level" Quick Check. | One figure per level; find-the-flaw figures with authored descriptions; editor "Try it" (add a waitlist responsibility); for interface descriptions, the Enrollment API card twice (`panels: syntax` before a prediction, then in full), a find-the-flaw card whose flaws need judgment, the interfaces view of the Registration API (`interfaces of api`), and a Quick Check | 1, 2, 3, 5, 7 |
| `# Notation` | Titles, legends, technology, consistency, colour never alone; the review checklist. | Annotated figure | 5 |
| `# Supplementary Views` | Landscape (C4), dynamic (UML sequence), deployment (UML deployment): a container is not a Docker container or a replica. | Three figures; Quick Check | 1, 4 |
| `# Models, Not Pictures` | Model vs diagram; derived views and relationships; what checks can and cannot establish; drift and keeping design and code in sync; tooling (Structurizr, IcePanel, ArchUML); design choices and decisions in the model. | Quick Check: which claims a passing check supports | 6 |
| `# Trade-offs` | When C4 helps and hurts; optional levels; maintenance cost; what C4 cannot show; decomposition costs and Arisholm & Sjøberg's skill moderation; UML vs C4; diagrams-as-code vs modelling tools. | Quick Check (Evaluate) | 4 |
| `# Practice` | Near transfer: campus room booking in the editor (starter, suggested model revealed after the attempt); a far-transfer prose brief with new requirements; link to the tutorial; Brown's Internet Banking example on c4model.com; `## Flashcards`; `## Quiz`. | Editor embed | all |

- `## Interface Descriptions` (the last `##` of `# Zooming In`, after `## Code`), in this order:
  1. Opening: "Interfaces are not another level: you describe one wherever a client crosses the boundary of a system, a container, or a component." Two or three sentences recap syntactic and semantic interoperability and link `/SEBook/quality_attributes/interoperability` for the definition, the Mars Climate Orbiter case, adapters, the trade-offs, and practical interoperability.
  2. The Enrollment API card with `panels: syntax`, then a prediction prompt ("Name two ways an independently built client could misread this description").
  3. A `<details>` reveal: the Mars Climate Orbiter in three sentences, matching the interoperability chapter and `MCOMIB1999` (the interface specification required newton-seconds; one side wrote pound-force seconds; no test compared the file with the specification), and the same structure in this model (an `amount` read as dollars by one side and cents by the other).
  4. The full card as the worked solution: the syntactic view and the semantic view explained against it, each element of the semantic view in one sentence; units, formats, constraints, value meanings, and the shared vocabulary; `realizes` and the RDD contract (advertised responsibility, client-supplied information, conditions of use, aftereffects; the implementation stays private; cite `WirfsBrock2003`).
  5. The three remedies of lecture L14, in one paragraph: document the semantics, agree on a shared vocabulary, and test both implementations together. "A schema (JSON Schema, OpenAPI) checks the syntactic view automatically; only people and integration tests check the semantic view."
  6. A find-the-flaw card (inline `c4` fence, view `interface …`) whose flaws pass the linter and need judgment: an `amount` with `unit: dollars` that does not say whether tax is included, a date with `format: MM/DD` and no year or time zone, and an error "failed: when something goes wrong" that tells the client nothing to do. Its text is the card's own text, so screen-reader users meet the same flaws, and it doubles as an example for objective 6 (a clean check run does not mean the description is adequate).
  7. `uses` with the interfaces view (`interfaces of api`), read as "Registration API offers Enrollment API to Planner Web App and depends on Billing's Tuition Charges", with the caption sentence: "This view borrows UML's component-diagram notation for provided (ball) and required (socket) interfaces; each box keeps its C4 type: Registration API is a container and Billing System a software system." One sentence on the coordinator: the request enters through the Registration API's interface, and the interfaces view of the coordinator shows it handling those calls. One sentence on the shorthand (`provides: [ … ]`, a syntax-only sketch the editor asks to describe fully once a client in another container uses it).
  8. Documentation guidelines: externally visible effects only, expose only what clients need, minimal and use-case oriented (cite `Clements2010`).
  9. A Quick Check sorting eight statements into the syntactic or the semantic view (marker `<!-- objective: 7 -->`).
  10. Between items 7 and 8, a paragraph "Changing an interface" (objective 7's last clause, 2026-11-09): a change is compatible when every existing client keeps working without changing (adding an optional field); removing or renaming a field, or making an optional field required, needs a new `version` that every client must move to; the Enrollment API's `version: 1` names the description a client was built against. The `# Trade-offs` sentences below keep the cost and link here.
  11. After item 9, a Quick Check "compatible, or a new version?" on three changes to the Enrollment API (an optional request field `waitlist_ok`; `units_enrolled` renamed; `decided_at` removed), with a reveal (marker `<!-- objective: 7 -->`).
  Units are spelled out in prose ("newton-seconds", "pound-force seconds"); no new abbreviations; no cost figure for the orbiter (the existing pages disagree, §16).
- `# Trade-offs` gains two sentences and a link: a shared interface changes in every system that uses it, so versions and extensible formats trade implementation effort against allowed variability; an adapter can translate formats, units, and meanings, but only those both semantic views state (link the interoperability chapter's "Trade-offs" and "Practical Interoperability" sections; cite `Bass2012`).
- `# Notation` gains the "via" line and the `with interfaces` suffix in the review checklist.
- The interoperability chapter gains one sentence at the end of its semantic-interoperability section linking forward to the C4 chapter's `## Interface Descriptions` ("how to write such a description and read it as a card"); its wording on adapters and the orbiter already matches.
- Models in `_includes/c4-models/` (`course-registration.yml`, the §4.2 block; `campus-booking-starter.yml`); flawed variants inline; level-mixing examples as freeform figures with authored descriptions.
- Quiz `_data/quizzes/c4_model.yml` (13 items): at least 4 read or critique rendered `c4` figures; at least 2 Evaluate items (level choice, trade-offs); at least one per misconception (container vs running instance, Docker in one clause; component vs code element or library; levels optional; knows ≠ stores; consistency ≠ adequacy; labelled relationships) with `option_feedback`. Item 13 serves objective 7 and tests one construct, using the lecture's tax example: "A booking partner and Campus Shop disagree on totals although every message validates against the schema. Which revision of the interface description most directly prevents this?" Key: "State that price is in US cents and whether it includes sales tax." Distractors with `option_feedback`: "Add a JSON Schema with type number and minimum 0" (it constrains structure and values, but both sides can still read the number differently); "Add the meaning 'the price of the booking'" (a meaning without a unit leaves the same ambiguity); "Change price's type from number to decimal" (more precise syntax, same ambiguity). Flashcards `_data/flashcards/c4_model.yml` (18 cards) cover the same misconceptions plus three for objective 7 that train what only this chapter teaches (the interoperability deck already covers syntactic versus semantic interoperability and the orbiter): "Where does a field's unit go in an interface description, and why not only in its meaning?"; "What do `uses` and `realizes` connect, and which responsibilities may an operation realize?"; "On which element do you declare an HTTP API: the container clients address, or a component inside it? When is the component right?"
- Alignment: every quiz item and flashcard records the objective it serves (YAML comment), and the content test checks that each objective (1–7) has at least one chapter activity, one tutorial step, and one quiz item; objective 7 is served by the `## Interface Descriptions` Quick Checks (syntax or semantics; compatible or a new version), the interface tutorial "Describe an interface" (its compatibility clause by the step 3 reveal and step 4's second item, gated by `min_score`), and quiz item 13.
- Bibliography: `Brown2022C4` (Leanpub), `BrownC4Model` (c4model.com), `WirfsBrockWilkerson1989`, `BeckCunningham1989`, `Kruchten1995`, `ArisholmSjoberg2004` (doi 10.1109/TSE.2004.43), `MCOMIB1999` (Mars Climate Orbiter Mishap Investigation Board, Phase I Report, NASA, 10 November 1999, <https://llis.nasa.gov/llis_lib/pdf/1009464main1_0641-mr.pdf>; verify the URL before adding), plus existing `WirfsBrock2003`, `Bass2012`, `Clements2010`, `Parnas1972`.
- Release recommendation (outside this implementation): a cognitive walkthrough and a 3–5 student think-aloud pilot of tutorial steps 1–5 and step 9 and of the interface tutorial's steps 2–3, timing step 9 and the interface steps against their estimates.

## 13. Testing

Tests follow the `test-design` skill: behaviour-named, spec-pinning oracles, partitions and boundaries, determinism, no doubles for pure functions.

- **Core unit tests** (`node:test`, no browser) in `js/ArchUML/tests/c4/`; `npm run test:unit` becomes `node --test scripts/tests/*.test.js js/ArchUML/tests/c4/*.test.js`. Coverage: parsing, shorthands, typed fields, unknown keys, version handling; normalization; projection per view type (eligible sets, lifting, boundary landings, explicit wins, synchrony-aware merging, neighbour edges, include/exclude, enterprise membership, breadcrumbs, drill targets), including fixtures for the novice scaffold sequence and summary-plus-detail pairs; every rule with a passing and a violating fixture asserting rule id, element, and range, plus threshold boundaries (9/10 responsibilities; 20/21 elements; a system with 12 responsibilities never triggers `rdd/god-element`; Brown's external-but-inside case); scenario step semantics (reply, delivery, asynchronous callback); predicates (each key, strict keys, unresolved ids, tri-state, vacuous `every`); edits (bytes outside edit ranges unchanged for every command on every shipped model; add-then-delete identity; every Change-id reference site); describe sentences (including neutral absences); UML generation (parses with the target renderer, includes expected participants, members, and paths; adversarial text); palette contrast (normative, §6.2); JSON Schema agreement on a shared corpus; CLI exit codes and JSON shape; manifest consistency; zero warnings for shipped models and tutorial solutions.
- **Interface tests** (Milestone 1b, `js/ArchUML/tests/c4/interfaces-*.test.js`): the Milestone 1 invariants re-asserted on `course-registration-interfaces.yml` (14 elements, 8 relationships, the seven selectors, the container brief label, zero errors and warnings, every Milestone 1 command's byte preservation); shorthand and full-form normalization, document formats, interface-level restrictions and errors, value lists and maps, constraints, top-level vocabulary; derived operation ids and their stability across the shorthand-to-full conversion; failsafe typing (`required` only inside field maps; user-data keys never converted); type expressions, spellings, and undefined types (the lecture's createBooking transcribed verbatim loads without errors); `uses` resolution for request, emission, channel, and broker-peer uses and the rejected cases; `responsibility` and `realizes` resolution; the shared namespace and case-insensitive duplicates; every `interface/*` rule with a passing and a violating fixture, both severities where a rule has two, every message free of reference-model values; projection of `interfaces of` (provided set with declared-on and delegated entries, required set, lifted consumers and providers, people as notes, broker labels, empty state) and `interface` (card model, handled-by, absences); edge interfaces with inherited summary uses and the technology fallback; the selector grammar in `c4-schema.js`, the `with` suffix, `selectorKey`, per-base view fields in `load()`; predicates (each new key, inherited counts, J12 coverage, `same_as_seed` parts, unresolved ids); edit commands with byte preservation and add-then-delete identity, the cascades in Change id, Change interface id, operation and type renames, deletes (no nested edits), and moves; describe sentences for both views; component text with adversarial names.
- **Interface rendering and editor tests** (appended to Milestones 2 and 3): the bundle's component display names, keywords, and explicit layout direction; render gates on four interfaces-view fixtures (no label–box or label–label overlap, each interface name next to its ball, each assembly label nearest its connector, readable width of `interfaces of api` at most 44em, identical node coordinates in 320, 760, and 1440 px containers); annotation lines on boxes and edges with 40-character interface names and a tightly pinned pair; the HTML card (structure, table headers, `panels: syntax`, reflow and paragraph size at 320 CSS px in both themes, printed once in the light palette, static and live markup equal); the interface form's keyboard flow (tabs with counts, lists, Realizes checkboxes, Show selecting the tab), the Uses picker's groups and order, conversion of a shorthand list as one undo step, review prompts.
- **Renderer tests** (`node:test` with Playwright Chromium, in `scripts/tests/`): SVG hooks per view; escaping of `<img onerror>` and quotes; determinism; diagram-quality gates on golden fixtures (no overlapping element boxes, labels clear and distinct, no route through a non-endpoint box, legend and title inside the SVG, standalone SVG export, layout stability: unrelated elements move by a bounded amount after one edit); nested deployment nodes; existing deployment regressions green; `annotations` rendering.
- **Site Playwright**: C4 display (image role and label; labels at paragraph size at 320 and 1440 px; dark invert with identical baked fills; print light; keyboard scroll); the lazy path (§3.3); editor flows (keyboard-only creation of a context and container view; zoom in and out; responsibility and collaborator; derived edge to summary relationship by keyboard; pin with clicks only; scenario step with an `alt` fragment; deployment node; design choices; quick fix; YAML two-way sync; undo/redo; download; Escape order; focus table); fake-host contract test (only `onTextChange` supplied; traps prove no storage, cookie, fetch, XHR, or `window.open` access; no echo; host-undo routing; `destroy` removes listeners); strict-CSP page (zero `securitypolicyviolation` events under the documented policy); standalone page (fragment handoff, restore, discard, storage failure); axe checkpoints in both themes at 320 and 1440 px; tutorial flows (solution passes; seeds fail); hint conditions in `tests/tutor-hints.spec.js`.
- **UML-view editing** (`docs/superpowers/specs/2026-11-12-c4-uml-view-editing.md` §9): unit tests of the diagram-editor module, the text adapter's rewrites, the operation vocabulary, and the C4 planners (one test per table row and per refusal, through `ArchUMLC4.load` and `query`); the sealed byte-identity gesture corpus and computed-style evidence of the UML editor, run by `scripts/uml-editor-gate.js`; renderer tests of `data-layout-ignore` and `layout ports facing`; the static-equals-live comparison with pinned fixtures for every view that holds positions; a timing gate for delegated UML views with pins (`scripts/tests/timing/c4-delegated-view-timing.test.js`, 250 ms median, 1500 ms ceiling); end-to-end specs per view and for two editors on one page, the message region, the host gestures, moves without a drag in the UML editor (`tests/uml-editor-non-drag-moves.spec.js`), and a built-site dark-mode spec; the A/B guard over the component, deployment, and C4 corpora.
- **Audits**: `scripts/check_references.sh`, `scripts/check_quizzes.sh`, `scripts/audit_mcq_tells.py`; the WCAG audit on every touched route (chapter, tutorial and print, editor page, uml-reference, software_architecture, uml_component_diagram, shortcuts, cookies, glossary, one page per ArchUML diagram type), and a full sweep (`WCAG_AUDIT_FULL_SWEEP=1`) at the end of milestones 2 and 5; the print audit and print-light theme spec for the chapter, editor page, and tutorial print view; `tests/ai-training-opt-out.spec.js`.

## 14. Milestones

Each milestone ends with its gate commands green (CI runs no tests, so gates are local):

1. **Core**: vendored YAML and build script, manifest, core modules, CLI, JSON Schema, core unit tests; its fixture keeps the reference model as it stood before interfaces and the chapter amendments (J13). Gate: `npm run test:unit`.
1b. **Interfaces (core)**: interface schema and selector grammar in `c4-schema.js`, normalization and references, example source texts (`c4-yaml.js` `flowText`), projection of the two interface views and edge/node interfaces, `interface/*` rules, predicates, edit commands, descriptions, component text, facade and CLI options, JSON Schema, the second fixture `course-registration-interfaces.yml` (the §4.2 block with interfaces and the chapter amendments, J13) and its spec §4.2 sync, the §6.3 rule that draws no derived deployment path where explicit node collaborators connect the same nodes (plan `docs/superpowers/plans/2026-11-08-c4-interfaces.md`). Runs after Milestone 1 and in parallel with Milestone 2; touches only core files and their tests; Milestone 1's fixture and tests stay unchanged except the changes its Task 0 audit lists. Gate: `npm run test:unit`.
2. **Rendering**: `c4-render.js`, bundle stub and registrations, UML mappings, the HTML interface card and its static prerender, interface annotations, the bundle's component-diagram fixes (display names, keywords, explicit layout), and the delegated interfaces view with its title, legend, and notes (the interface tasks start once 1b is green), nested deployment nodes, static prerender and caches, describer, lazy path, display tests. Gate: unit tests, renderer tests, C4 display and diagram Playwright specs, existing UML suites, full WCAG sweep.
3. **Editor**: editor library (including the Interfaces section, interface form, Uses picker, interface review prompts, and the read-only `provides` of code elements), site host adapter, standalone page, inline embed, inventories (shortcuts, cookies, glossary), fake-host and CSP tests, editor flows. Gate: unit tests, editor specs, touched-route audits.
4. **Chapter**: chapter, models (`course-registration.yml` is the §4.2 block), the `## Interface Descriptions` section, the interoperability chapter's forward link, quiz, flashcards, bibliography, nav, terminology notes, attribution. Gate: content tests, quiz and reference checks, touched-route and print audits.
5. **Tutorial**: backend adapter, tutorial content (including the follow-up tutorial "Describe an interface" and its page pair, §11), hint conditions, content test, skill updates. Gate: tutorial specs, tutor-hint spec, content test, full WCAG sweep, print audit.
6. **Documentation**: `docs/c4-editor.md` (host contract, CSP, VS Code path), REFERENCE.md C4 section review, final cross-check.

## 15. Risks

- Layout quality for nested views is ours to tune: small views, a size warning, pins, diagram-quality gates.
- The editor is the largest unit: split into focused files behind the host contract and tested with a fake host.
- The tutorial backend touches about 25 dispatch sites in a 16k-line runtime: the existing tutorial suites run after the change.
- Hand-maintained UMD files need a strict load order: one manifest, a load test, and a bundle-copy test.
- A new vendored dependency: pinned version, licence, integrity hashes, supply-chain test.
- Two repositories change: the final summary lists both and the submodule state.
- Interface descriptions enlarge the schema students meet: the shorthand stays valid, first drafts in other languages' type spellings load without errors, the novice profile hides info diagnostics and defers incompleteness rules until an interface loses focus, and interface rules never fire on models that declare no interfaces.
- Parallel Milestones 1b and 2 share the `ViewModel` contract: 1b only adds fields (`edges[].interfaces`, `nodes[].interfaces`, `selector`, `annotations`, `card`, notations `uml-component` and `interface-card`), and Milestone 2 ignores unknown fields until its interface tasks run. Milestone 1 tests that compare whole objects would break on the added fields; the 1b plan's Task 0 audit finds them before any change.
- The interfaces view depends on bundle fixes (display names, keywords, explicit layout) that Milestone 2 makes in the submodule; until they land, only the component text is tested in 1b, and the render gates run in Milestone 2.

## 16. Pre-existing issues noticed (reported, not fixed)

- ArchUML submodule HEAD is a placeholder commit (`31368bc`, "SOME COMMMIT UNDO AFTERWARDS", empty `test.txt`).
- `uml-describe-cli.js` takes about 5 s per call because a polling `setInterval` keeps Node alive.
- `no_auto_uml` front matter is read by nothing; the `sebook.html` comment claims dark mode re-renders diagrams, but dark mode is a CSS filter.
- The tutorial view toggle (Editor/Git Graph/Make DAG) shows state only through a class (possible WCAG 4.1.2 issue). `TutorialCode` never dispatches `tvm:stepchange`.
- UML editor canvas targets do not expose selection state; its moves rely on keyboard nudges and dragging only (the same 2.5.7 gap this design avoids). The `wcag-aa-compliance` skill words 2.5.7 as if a keyboard alternative were sufficient. Closed with the UML-view editing work: stage A1 gives the UML editor "Move…" and a click, the bend menu, a "⋯" button, and Shift+F10 or the Menu key on a focused diagram item (`docs/superpowers/specs/2026-11-12-c4-uml-view-editing.md` §3.11; decision D5), and the skill now says that 2.5.7 asks for a single-pointer path and that a keyboard path alone does not meet it. Still without a keyboard path in the UML editor: panning the canvas beyond the preview pane's own scrolling (its single-pointer paths are the scrollbars and the zoom buttons).
- Found during the UML-view editing work (`docs/superpowers/specs/2026-11-12-c4-uml-view-editing.md` §13; details in `docs/c4-decisions.md`, open items): refusals and the Move and Add relationship instructions of C4-notation views reached only the live region (fixed, D6); generated sequence text lost the messages of an element whose id was a keyword (fixed); the core accepted generalizations and realizations that are wrong in UML (the edit commands now refuse them; hand-written YAML is still not flagged); lock refusals named no subject (fixed); the legend of an interfaces view pointed at a place (reworded); the component renderer kept balls and sockets on their old sides after a move (lifted behind `layout ports facing`); stored bends in the UML editor can end inside a box after it grows (the C4 drawing drops them; the UML editor is unchanged); two drawings on one page repeat the bundle's `<defs>` ids; the diagram editor's `findRenderedBox` measures the top box for both of two overlapping class boxes found by name.
- `TutorChat.onTestFailure` is called unguarded (this design guards it for C4 hints).
- Bibliography entries without `url`/`doi` (EelesCripps2009, Martin2017CleanArchitecture, Lilienthal2019); `Rozanski2011`'s DOI looks like a review.
- `sebook-authoring` skill still says `data-uml-type` is only class, sequence, or state.
- Untracked `tests/audit-url-inventory.js` and `scripts/tests/audit-url-inventory.test.js` are not used by any audit.
- `/shortcuts/` says Ctrl/Cmd+0 resets to 100% in the UML editor, while the editor's code fits the diagram.
- `tutorial-instructions-popup.html` renders only Mermaid and `ObjectReferenceLab` in detached instructions, so the ArchUML `uml-class` fences in `_data/tutorials/solid.yml` show as raw source with no text alternative there (the C4 tutorial fixes this for `c4` fences only, §11). Resolved 2026-11-10 (Task T, intended shared behaviour): the popout draws every ArchUML fence type, as the step pane does, and loads the bundle and `uml-auto-describe.js` only when a step has an ArchUML block, and the C4 toolkit before them only in a `backend: c4` tutorial. The print view still loads the bundle for every tutorial and lets it draw non-C4 fences before the describer loads (only C4 figures are described afterwards).
- `UMLComponentDiagram` draws a component's alias instead of its quoted display name (`component "Registration API" as e1` is drawn and sized as "e1"; parse() fills `displayNameMap`, but layout and drawing read `name`), ignores `layout vertical` and `layout horizontal` (orientation follows the container's aspect ratio), has no `<<keyword>>` on components, and closes a component block at a `}` inside the component's quoted name. Milestone 2 fixes the first three in the submodule (§6.6); the generator replaces braces in quoted names.
- The interoperability chapter states the Mars Climate Orbiter's cost as $327 M, its quiz as $193M; the C4 chapter states no cost.

## 17. Changes to user-approved sections after review

- **§3 architecture**: C4 drawing code moved from `uml-bundle.js` into `c4/c4-render.js` (lazy-loadable) with a small bundle stub; a manifest file replaces "load order defined in the renderer"; the host contract gained edit ranges, echo rules, host undo, scaffold and review options, and a stated CSP. Reason: the lazy path, two prerender caches, and the tutorial/VS Code bindings could not work as first written.
- **§4 schema**: `web_app` → `browser_app` (Brown separates server-side and client-side web apps); `in_enterprise` and top-level `groups` added (ownership and organization are independent axes); `hosts` accepts systems and infrastructure nodes are leaves (C4 deployment diagrams show system instances); `owns`, KNOW, and storage defined; the worked example rewritten to pass its own checks; edits are text splices (whole-document printing rewrites untouched lines).
- **§9 editor (user direction after the review)**: dragging is the default for moving, connecting, adding from a palette, refining from the carry-down tray, reordering lists, re-parenting in the outline, and panning; single-pointer alternatives (context-menu commands, click-then-click, collapsed Position controls) and keyboard paths remain for WCAG 2.5.7 and 2.1.1 but stay out of the default view. Relationship details use a small anchored form instead of a modal dialog; names are edited in place.
- **§5–§6 views and notation**: an explicit projection algorithm (system-level relationships no longer vanish from container views); diagram colours from a fixed palette instead of CSS variables (themed variables would be baked dark and then inverted again); dynamic replies restricted to synchronous relationships, with deliveries for queues and topics; UML mappings for `function` and `module`.
- 2026-11-08 (user direction): the chapter does not discuss the many meanings of "component"; it stays focused on C4 and gives a short definition where a term is used differently. Objective 1, the Abstractions row (no translation table), the misconception list, and the novice Component definition changed accordingly.
- **Tutorial draft questions (2026-11-08)**: the milestone 5 content drafts raised 21 questions; the controller's rulings changed these sections. §6.3: a reply may answer a forward step that precedes its enclosing fragment, and each fragment branch starts from a copy of the open requests. §7.2: `rdd/not-an-obligation` flags call-shaped text with or without arguments; `c4/generic-name` keeps "Backend". §7.3 and §8: a predicate selector or id naming a view, scenario, or element missing from the learner's model fails with a learner-facing message (false in hint conditions); only the configured `c4.view`, unknown predicate keys, and malformed selector syntax are author errors. §8: new `step` and `requirement` queries with verified examples; `same_as_seed` compares with the step's authored starter content; `checks:` predicates and the vacuity rule apply the step's `c4.checks` configuration; `owns_any` is a name lookup with substring matching. §9.2 and §9.3: Ctrl/Cmd+Enter runs Test My Work in every display mode; inline lint waits for Check now or Submit for review under `on-request` and `after-submit`. §11: `read_only`, key-by-key merging of step over tutorial configuration, camelCase scaffold and check keys with unknown keys rejected, dotted `locked_fields` paths enforced on the YAML surface, the "Visual"/"YAML" switch, Test My Work gated by Submit for review under `after-submit`, silent hint conditions on unresolved ids, one "Fix the YAML errors first" card instead of hints under YAML errors, instruction figures rendered in the popout and print view (§3.2 lists both as preloaded), about 90 minutes, and the seed and guard-test wording. §12: the think-aloud pilot includes step 9. Reason: several steps could not work as drafted (step 8 had no query for "branch exists"; a learner typo in a selector became an author error; locks did not bind the YAML view, so an emptied `requirements:` made coverage checks vacuous).
- **Interface descriptions (user request after lecture L14, 2026-11-08)**: `provides` holds interface descriptions with a syntactic view (operations, inputs, outputs, typed fields with allowed values and constraints) and a semantic view (purpose, side effects, restrictions, errors, examples, meanings, units, formats, value meanings, shared vocabulary), with interface-level restrictions and errors and a model-wide vocabulary (§4.11). The string list stays valid as a shorthand, and Milestone 1's fixture and tests are unaffected (J13): the fixture keeps the pre-revision block, while `_includes/c4-models/course-registration.yml` and the Milestone 1b fixture `course-registration-interfaces.yml` equal the new §4.2 block. Collaborators name the interfaces they use (`uses`), including event emitters and queue or topic peers (J7); operations name the responsibilities they realize (`realizes`, J12); `responsibility` accepts the same targets as `uses`. Two views: `interfaces of <element>` (a UML component diagram with provided and required interfaces, delegated and offered-through interfaces, inside a C4 title, legend, and notes) and `interface <id>` (an HTML card, J11), plus the selector suffix `with …` and the `interfaces` annotation, also on dynamic views (§5, §6.6); interfaces are not a C4 abstraction (J14). New rules: `model/interface-provider`, `model/realizes-owner`, and the `interface/*` category, which runs only once a model declares a full-form interface or a `uses` (§7.2). Predicates gained interface and operation queries, relationship keys `uses`, `uses_interface`, and `requests`, an element key, field keys for constraints and values, and an interface form of `same_as_seed` with a syntax part (§8); the editor gained an Interfaces section, an interface form with Syntactic and Semantic tabs, a Uses picker, an Interfaces outline branch and toolbar control, sentence frames, definitions, and review prompts (§9.5). The reference model gained two interfaces, a shared vocabulary, and one responsibility without changing its element or relationship counts, and lost the coordinator's one-line shorthand (§4.2). The chapter gained objective 7, a `## Interface Descriptions` section after `## Code` that links the interoperability chapter, one quiz item, and three flashcards (§12). Learners practise in a separate follow-up tutorial "Describe an interface" of about 30 minutes (D10, decision U1 option A; §11); the C4 tutorial keeps its steps and its "about 90 minutes", and its change-impact step gains one interface prediction and check (10 → 11 minutes). The plan is Milestone 1b (§14). Designer decisions J7–J14 (§1).
- **Merge of the interface addendum and the chapter amendments (2026-11-08, controller rulings)**: the addendum was merged before Milestone 1 is green; J13 keeps the Milestone 1 fixture unchanged, so no Milestone 1 test changes with this merge. §4.2 also takes the chapter review's four accepted amendments (FR-07 about prerequisites and the unit cap; the browser sends HTTPS requests to the ingress; API pod technology `Kubernetes pod`; code-view label "delegates each eligibility check to"); the amended block passes the addendum's interface verifier (172 checks). §6.3 draws no derived deployment path when explicit node collaborators connect the same nodes, so the browser reaches the API pod only through the ingress. Merge adjustments: the interface rule table, its rationale table, and the severity calibration follow the rule catalog as their own tables, because the interface table has a message column; the selector grammar keeps element ids exact (§4.10, §5.1) and lowercases only keywords and interface ids, so the addendum's layout-key example now uses `Containers of registration with interfaces`; the §8 query list keeps the `step` and `requirement` queries added earlier; the pilot keeps step 9; quiz item 13 is described after the existing quiz bullet instead of inside its count; the addendum's option B and its §16 note on an "about 75 minutes" claim were left out, because §11 already states about 90 minutes and decision U1 chose option A. Plans: `2026-11-08-c4-interfaces.md` (Milestone 1b) is new; the rendering plan gains Tasks 9–12, the editor plan Tasks 13–16 and an amendment to Task 8, the chapter plan the interface section, quiz item 13, three flashcards, and the interoperability link, and the tutorial plan the change-impact addition and the "Describe an interface" tutorial with its page pair.
- **Alignment review of the student-facing C4 artifacts (2026-11-09, pedagogical-advisor; texts only)**: §7.2 gained a table of learner messages for the core rules that the novice profile shows or that tutorial steps raise to warning (`rdd/not-an-obligation`, `rdd/no-reason`, `c4/vague-relationship`, `c4/cross-container-technology`, `c4/infrastructure-container`, `c4/generic-name`, `xlevel/scenario-step`, `xlevel/unreceived`/`unsent`, `rdd/duplicate-authority`), using the interface message pattern and only terms the chapter teaches; `rdd/uncovered-requirement` is retitled "Requirement no responsibility traces to" and its help text no longer equates tracing with meeting a requirement; `rdd/centralized-control`'s help text and hint no longer say delegation is easier to change, matching the chapter's Arisholm and Sjøberg account; the `interface/no-unit` hint says "a value of 1" instead of "one step". §9.3: the empty-state guide follows the chapter's subgoal order (responsibilities before containers); definitions popovers carry the chapter's decision rules and add person, software system (external), and code element; responsibility sentence frames and the collaborator read-aloud have reviewed copy; the Purpose frame is split into message ("When a sender sends …") and event ("When <provider> publishes …") wording, matching the Style definitions; the Unit frame reads "A value of 1 in this field means one …"; the carry-down tray opens with a named "Responsibilities to refine" toggle; the responsibility trace also lists Refines and Refined by as text in the inspector and announces the count; C4 views gain Review prompts and the Problems panel an empty-state caveat. Reason: the scaffolds contradicted the chapter's subgoal order, the checker's help text contradicted the chapter's account of coverage and control style, and several scaffolds were visual-only or used untaught terms. §4.11 is unchanged (see the alignment log for the open `publish` wording of Tuition Charges' syntax line). The js/ArchUML `c4-checks.js` help texts were updated to match.
- **Instructor decisions on the alignment review (2026-11-09, controller on behalf of the instructor)**: §11 is synced with the drafts: the C4 tutorial's step 5 also names the web app's relationship to the API (subgoal 3; 12 minutes, so about 91 minutes in all) and step 7 opens the Enrollment API's description card before the prediction; the "Describe an interface" table describes steps 1–4 as drafted (step 1's recall-then-extend commitment and `reason` option; step 2's seeded worked part and Billing's shorthand sketch; step 3's field-meaning test and compatibility reveal; step 4's Rate Quotes item with the integration-test key). Step 2 gains a second operation, `check-plan` (`POST /v1/plan-checks`, output `PlanCheck`), seeded as syntax only, which the learner describes after `submit-plan` with four new tests (purpose, side effects, and the eligibility link; a meaning for every `PlanCheck` field; a guard against copying the seat and charge links; the web app's use of it); step 2 takes 15 minutes, the tutorial 4 + 15 + 10 + 3 = 32, "about 30 minutes"; §8 now states its step 2 expectations for the Milestone 1b fixture and notes that the tutorial's seed differs from it. §12 objective 7 (and the chapter's) ends "and tell a compatible interface change from one that needs a new version"; the chapter's Interface Descriptions teaches the rule ("Changing an interface") and practises it with a Quick Check, and the tutorial assesses it (step 4, item 2). Quiz item 1 and the flashcard `c4-container-instances` (was `c4-container-not-docker`) ask about running instances, with Docker in one clause; the misconception list says "container vs running instance". The item-13 gloss no longer names the orbiter. §4.2: the two descriptions no longer promise conflict-free schedules; FR-11 ("Every completed enrollment is charged tuition, and a billing outage never delays an enrollment.", the chapter derivation's text) and `sys-billing` give `api-billing` a requirement to trace to (element and relationship counts unchanged; the Milestone 1 fixture unchanged, J13; §8's first block notes that §4.2 now has three requirements); Tuition Charges' syntax is `send ChargeRequested to the queue billing.charges`, and its restriction says who may send to the queue, in §4.2, §4.11, §6.6, and every plan and draft copy. §9.2: a "Move to…" command for relationships (drag an end; the relationship's context menu or its inspector row; one splice and one undo step keeping every field; refuses duplicates and self-loops); the `xlevel/unreceived` and `xlevel/unsent` quick fix opens it, and the novice profile shows these two info rules (§7.2). Plans: the interfaces plan's fixture expectations assert FR-11, `sys-billing`, the refinement, and the `send` syntax; the editor plan's Task 6 (actions and tests) and Task 8 (a Move to… button per relationship in the inspector, with a keyboard test) implement §9.2; the tutorial plan's Task 5b records the step 2 amendment and the minutes. Reason: the alignment review left these to the instructor; the drafts and the spec now agree. The C4 tutorial's own model is unchanged (its `billing-request` still refines nothing, because its requirements have no billing requirement).
- 2026-11-09 (user direction after previewing the renderer): §6.4 step 4a — align connected elements so relationships run straight; bends only when no overlap-free alignment exists; minimize total bends.
- 2026-11-09 (user direction 'use the same kind of approach we use for component diagrams'): §6.4 steps 1 and 4 mechanisms replaced by the C4 placement and route engines; step 4a objective order made explicit (conflicts and crossings before bends, within per-edge bend and detour limits); print label minimum added to §6.5.
- 2026-11-09 (independent plan review): `panels` travels as a `# panels:` source directive; one `locked_fields` semantics with `*` wildcards and no implicit exemptions; editor and layout performance budgets reconciled.
- 2026-11-09 (instructor decisions after the plan review): the chapter stays one long page; printed C4 labels must be at least 9 pt (wide views wrap, split, or use a landscape print layout instead of shrinking; this supersedes min(9 pt, current)); the chapter goes live together with the editor and both tutorials; a think-aloud pilot is recommended, not a release gate.
- 2026-11-09: §3.4 one-undo-stack rule clarified for the site host (editor undo; Monaco YAML tab forwards undo/redo).
- 2026-11-10 (Task T, Ruling F5): §3.4 the host contract gains `onRequestSave`, `onCheckNow`, and `onSubmitForReview`; the editor itself routes Ctrl/Cmd+Enter and Ctrl/Cmd+S to `onRequestCheck` and `onRequestSave` (preventDefault, anywhere in the editor; without the member the key stays the page's), and tells the host when the learner chose Check now or Submit for review in its Problems panel. The tutorial adapter uses these instead of its own key listener and its click detection on the panel's button. §11: a YAML-surface edit that changes a locked path puts back only the locked node and keeps the learner's other edits, unless the locked node was removed or reshaped, in which case all edits since the last readable text are undone and named; the after-submit controls keep the failed-run cooldown and "I'm sure" once Submit for review has run; the detached popout loads the C4 toolkit only for `backend: c4`.
- 2026-11-10 (Task 12, editor contract and compliance): §3.4 echo suppression states the rule as implemented (text equal to the editor's current text is a no-op); §9.2 Escape order: the browser's own full screen only with the Keyboard Lock API keeping Escape for the page, the overlay elsewhere, so Escape still closes the innermost layer first; §9.2 Focus: after a delete, "next" and "previous" follow the arrow-key reading order, and an emptied view gives focus to the canvas region (it has no listbox). The host contract, events, CSP, and VS Code path are documented in `docs/c4-editor.md`.
- 2026-11-11 (polish round after the final review, Task P): §6.2 the relationship-label backdrop takes the page colour on screen in dark mode; §6.4 step 5 a pinned box keeps its pin and the boxes it overlaps make room (routing redesign §4.7); §9.2 the drop announcement names what made room or where a nudged element is drawn, "Move to…" menus tell same-named elements apart by type and parent, and Undo/Redo announce their step's label.
- 2026-11-12 to 2026-11-21 (UML-view editing; user request "Allow the user to also modify the UML diagrams by reusing the UML editor code", decisions U1 and U2 of 2026-11-12 and D1 to D7 of 2026-11-13; design `docs/superpowers/specs/2026-11-12-c4-uml-view-editing.md`, decisions in `docs/c4-decisions.md` UV-1 to UV-16): the four UML-notation views (code, dynamic, deployment, interfaces) are editable on the canvas through the UML editor's interaction code, moved into the ArchUML module `ArchUMLDiagramEditor`, and a C4 model adapter that writes `design.yml` or refuses with a visible reason. §3 module map: the diagram-editor units, `c4-constraints.js`, the C4 adapter files, and the message region. §4.8: layout entries of UML-notation views have the named parts `positions`, `routes`, and `lifelines`, with the refusals for what cannot hold a position or a bend. §4.10: the first-rename rule of final review I6 is confirmed (D1) and extended to deployment nodes (`changeNodeId`) and interfaces; "Change id…" also rewrites the new layout parts. §5.2 item 13 and §5.3: the fields the projection adds. §6.3: `toUml` returns `ids` and a source map for every UML view, carries the layout block, and never uses a keyword as an alias; the C4 deployment view edits nesting through the model. §6.6: an interfaces view with a saved position carries `layout ports facing` (D3); "consumers above, the element in the middle, providers below" is its automatic layout only; the legend names the subject and no place. §9.1, §9.2, §9.5: the message region, also for C4-notation views (D6); options, descriptions, keys, target marks, and the paths without a drag of UML views; the Position section and Reset layout where a view holds layout; `interfaces of` is editable; the new step selection. §9.3: what the canvas says while checks are withheld. §13: the tests of the UML-view editing spec §9. §16: the UML editor's 2.5.7 item closes with stage A1 (D5), and the issues that work found are listed. Reason: the user's request; each answer of 2026-11-13 is recorded in `docs/c4-decisions.md` (UV-16) with the entry that holds it.
