# C4 editor: editing the UML-notation views with the UML editor's interaction code

Date: 2026-11-12, revised twice on 2026-11-13; brought up to the built code on 2026-11-21. Status: design, revision 3.2 (built). Revision 1 was reviewed on 2026-11-12, once against the code and once from the learner's side; the two reviews gave 34 findings, and revision 2 answered each one. Revision 3 records the user's answers of 2026-11-13 to the seven questions revision 2 left open (§14) and builds them in: an id follows only the first rename of something added on a canvas, also for deployment nodes and interfaces; the boxes of an interfaces view can be moved, for which the bundle's component renderer learns to turn balls and sockets after positions are applied; the UML editor itself gets moves without a drag; and refusals become visible in C4-notation views. Revision 3.1 answers the third review (of revision 3 and its plan, 2026-11-13). It settles what the review found open: arrow-key steps inside a move without a drag are exact and never snap; where the "⋯" button sits; which lines get bend items; that one key press opens one menu; how one check finds every kind of overlap; and that the diagram-editor scripts may load twice on one page. It also brings the code pointers up to the tree after the user's pull. The Revision log at the end says where each change is. Nothing is implemented. Writing this document changed no other file. Two repositories are affected, the site and the ArchUML submodule `js/ArchUML`. Lane agents commit neither (decision PR-1); by the user's direction of 2026-11-13 ("when done commit and push", `inputs.md`), the controller commits and pushes both after the final verification and review.

Inputs: the user request and the user's two decisions of 2026-11-12 (§1), a code map of the same day, the two review notes, and the user's answers of 2026-11-13 to §14 (`.superpowers/sdd/2026-11-12-c4-uml-editing/`, session notes that are not tracked).

Binding context: the C4 spec `docs/superpowers/specs/2026-11-08-c4-model-design.md` (§3.4 host contract, §4.8 layout, §4.9 text splices, §4.10 identity, §4.11 interfaces, §5 views, §6.3 and §6.6 UML mappings, §9 editor, §11 tutorials, §13 testing), the routing redesign `docs/superpowers/specs/2026-11-09-c4-routing-redesign.md` (§7, §9.3, §10), `docs/c4-decisions.md` (SC-5, SC-7, RR-3, RR-8, ED-2 to ED-7, AP-1, PR-1), `docs/c4-editor.md`, and `CLAUDE.md`. Where this document changes one of them, §15 lists the change.

Line numbers in `_includes/uml-editor.html` refer to the working tree of 2026-11-13 after the user's pull (13,866 lines; revision 3.1 brought §3.1 and §3.2 up to it). Other line numbers refer to the tree of 2026-11-12. All of them will drift; function names are the stable reference. The counts in §3.1 say on which tree each was measured. Test counts marked "input map" come from the code map and were not re-counted. A statement marked "(probe)" was observed during the code review by rendering ArchUML text with the real bundle in headless Chromium, read-only; one marked "(probe, revision 3)" was observed the same way on 2026-11-13.

## 0. Decision in one paragraph

The UML editor's canvas code moves out of `_includes/uml-editor.html` into a framework-free, multi-instance module, `ArchUMLDiagramEditor`, in the ArchUML submodule (`js/ArchUML/diagram-editor/`). The module turns pointer and keyboard input on a rendered ArchUML drawing into *operations* ("add this element here", "rewire that end", "move this message before line 14"). It never writes anything itself. Every operation goes to an *edit adapter*, which says whether the operation is allowed and makes the change. There are two adapters. The *text adapter* is today's string rewriting, split into pure functions and checked byte for byte against the editor as it is now, so the UML editor behaves as before. The *C4 model adapter* turns the same operations into `design.yml` splices through `ArchUMLC4.edit`, or refuses them with a sentence the learner can see and hear when the model has no place for them. The C4 editor mounts the module's drawing interaction under its own listbox, keys, menus, inspector, message region, and single undo stack, on all four UML-notation views. Box positions (code views, interfaces views, and the top-level nodes of deployment views), bends of lines the renderer routes one by one, and lifeline order are kept in the `layout` section of `design.yml` and travel inside the ArchUML text that `toUml` generates, so the live canvas, embedded figures, the static prerender, and print draw the same picture. After the refactor the UML editor gets one behaviour change, by the user's decision of 2026-11-13: the moves without a drag that the module then holds for both hosts ("Move…", then a click; a bend menu; keyboard paths; §3.11).

## 1. Intent, scope, and terms

User request (verbatim): "Allow the user to also modify the UML diagrams by reusing the UML editor code /maintainable-code /test-design".

User decisions (2026-11-12):

| ID | Decision |
|---|---|
| U1 | **Model-backed.** The UML editor's drawing interactions become a reusable module with an edit adapter. The UML editor keeps editing ArchUML text through a text adapter with today's behaviour. The C4 editor's adapter turns each gesture into a `design.yml` change. Gestures with no model meaning are disabled with an explanation. `design.yml` stays the single source of truth. |
| U2 | **All four views.** Dynamic (sequence), deployment, code (class), and interfaces (component) become editable on the canvas. |

The user's decisions of 2026-11-13 on the seven questions of revision 2 are recorded in §14 as D1 to D7.

Terms used below:

- **Rendered document**: the ArchUML text a canvas currently draws. In the UML editor it is the textarea's text. In the C4 editor it is what `toUml` generated for the open view.
- **Reference**: a name for one drawn thing in the terms of the rendered document.
  - An element is named by its layout id, the id its declaration has in the rendered document. The renderer stamps it as `data-layout-id`, or for a class box as `data-layout-bounds-id`. The scene finds the box as the editor does today, through `findRenderedBox` and `UMLShared.renderedLayoutBox`, never with an attribute selector of its own.
  - A line is named by its `data-layout-route-id` (`rel:N`, `seqmsg:N`, `edge-N`, `usecase:N`) and the line of the rendered document it stands for (§3.4).
  - A fragment is named by its id, and an insertion place by a line number of the rendered document.
- **Operation**: a plain data object that says what the learner asked for, written with references (§3.4).
- **Scene fact**: a value an operation carries that was read from the drawing, such as a drawn position or the line a drawn route resolves to. Adapters get scene facts from the operation and never look at the SVG.
- **Edit adapter**: the one part that knows what the rendered document means and the only part that changes the source of truth.
- **Classic host**: the UML editor page (`_includes/uml-editor.html`). **C4 host**: the C4 editor (`js/ArchUML/c4/editor/`).
- **Message region**: the visible line of text above the C4 editor's canvas that shows the current instruction, refusal, or result (§7.5).

## 2. Architecture

### 2.1 Participants and their responsibilities

| Participant | Knows | Does | Decides | Asks |
|---|---|---|---|---|
| Renderer (bundle renderers; `c4-render.js` for C4) | — | Draws the rendered document as SVG with layout hooks | Layout and routing | — |
| **Session** (the mount) | The adapter, the host, the revision of the current drawing | On `sync`, reads the adapter's `contents()` and `tools()` once and gives them to the scene and the surface | Nothing | Adapter `contents()`, `tools()` |
| **Scene** (module) | What is drawn and where: boxes, routes, fragments, handles, insertion anchors | Hit tests, geometry, snapping, free places, overlaps; resolves a drawn line to the relation it stands for | Nothing | Nothing: it is given the SVG and the contents |
| **Gestures** (module) | The state of one press or one in-place text entry | Drag sessions, the same sessions started without a press (§3.11), in-place editors, choosers, menus | Which command a gesture means | Commands |
| **Commands** (module) | The selection | Builds operations from references and scene facts, restores selection and focus after a redraw, reports the verdict | Nothing about the model | Adapter `can`, `targets`, `apply`; host services |
| **Edit adapter** (one per host) | What the rendered document means | Changes the source of truth | Whether an operation is allowed, and the words of a refusal | Its source of truth |
| **Surface** (classic: in the module; C4: the C4 editor's own) | Accessible targets | Roles, tab stops, keys, modes | The interaction grammar | Commands |
| **Host** | The document, the undo stack, storage | Renders, shows and announces messages, confirms, undoes | When to redraw | The module's `sync` |

Each fact has one owner. In particular: the module holds no copy of the document, keeps no undo history, and touches no storage, network, clipboard, or global. The adapter has two callers inside the module: the session, at `sync`, and the commands. Scene, gestures, and surfaces hold no reference to it.

**When the document is read** (revision 3.2, as built). The session reads `adapter.contents()` once per `sync`, and the scene uses that reading for hit testing. A command reads `adapter.contents()` again when it builds an operation and resolves every reference (a route's line, an anchor, a member) against that reading; the operation carries that reading's revision. For the text adapter this is the UML editor's behaviour before this work: the canvas parses the textarea at gesture time, also inside the 120 ms debounce after typing, when ordinal route ids (`edge-N`, `usecase:N`) are matched against the current text. For the C4 adapter both readings come from the drawing, and `apply` refuses a changed document with `stale`.

### 2.2 Module map

All new shared code lives in the submodule, as hand-maintained UMD scripts with no build step and no AMD branch (C4 spec §3.1). Parts register on `ArchUMLDiagramEditorParts`; the mount publishes `ArchUMLDiagramEditor`. A page can load the scripts twice: the combined course page (`/SEBook/all.html`) holds the UML editor and C4 editors, which load them separately. A second load keeps what the first one registered and published, so sessions mounted before and after it share one set of parts.

| Unit | Responsibility | Depends on |
|---|---|---|
| `diagram-editor/manifest.json` | The ordered script list (groups `core`, `text`). The single source for every loader; a `_data` symlink feeds the Liquid includes, as for C4. | — |
| `diagram-editor/de-operations.js` | The operation vocabulary: shapes, required fields, the verdict shape (§3.4). Pure. | — |
| `diagram-editor/de-geometry.js` | Points, boxes, snapping, alignment guides, free places, overlaps, route maths (segments, anchored two- and three-point routes, port constraints). Pure. | — |
| `diagram-editor/de-scene.js` | Reads one SVG plus the contents the session hands it into a scene: editable items, routes, fragments, lifelines, activation bars, insertion anchors, nesting by geometry. | geometry, `UMLShared` (read only) |
| `diagram-editor/de-selection.js` | The selection set (primary and multi-select). | — |
| `diagram-editor/de-commands.js` | Every command: capability check, operation, `apply`, selection and focus after the redraw, the report to the host. No pointer or key knowledge. | operations, scene, selection |
| `diagram-editor/de-gestures-*.js` (move, connect, palette, sequence, routes, marquee) | Gesture sessions (§3.8) and their feedback: ghosts, guides, target marks. | commands, scene, geometry |
| `diagram-editor/de-placing.js` (from stage A1) | A move without a press (§3.11): starts the move session of a box, or of one bend of a line, with no pointer down, and steers it by pointer positions, steps, a commit, and a cancel. It owns no preview or snapping of its own; those are the move and route gestures'. | gestures, commands |
| `diagram-editor/de-inline.js`, `de-menus.js` | In-place text editors; context menus and choosers. | commands |
| `diagram-editor/de-viewport.js` | Pan, zoom, fit, canvas bounds. | geometry |
| `diagram-editor/de-surface-classic.js` | The UML editor's accessible targets, keys, tool status, empty-canvas actions, and its pointer driver (§3.8), as they are today; from stage A1 also its ways into a move without a drag (§3.11). | commands, gestures |
| `diagram-editor/de-mount.js` | `ArchUMLDiagramEditor.mount(options)`: the session. | all of the above |
| `diagram-editor/text/*.js` | The **text adapter** (§3.6): reading ArchUML text into `contents()`, one pure rewrite per operation and diagram type, the element and relation schemas, and the body serializers the Properties pane uses. | operations, bundle parsers |
| `css/diagram-editor.css` | Presentation of the hit layer, handles, guides, marquee, target marks, bend numbers, in-place editors, choosers, and menus, with `--uml-edit-*` custom properties. | — |
| `c4/editor/c4-editor-uml-adapter.js` and `c4-editor-uml-{code,dynamic,deployment,interfaces,layout}.js` | The **C4 model adapter** (§5): a DOM-free planner per view (operation to commands or refusal) and a thin executor. | `ArchUMLC4`, the editor's shared actions |
| `c4/editor/c4-editor-uml-canvas.js` | Connects the C4 canvas (overlay, modes, pointer dispatcher, inspector) to a mounted session (§7). | diagram editor, C4 editor parts |
| `c4/editor/c4-editor-messages.js` | The message region (§7.5): one visible message at a time, with its offer. | C4 editor DOM kit |

Dependencies point one way: site adapters → C4 editor → diagram editor → bundle. The diagram editor knows nothing about C4, the site, tutorials, or storage. The C4 core stays DOM-free and does not depend on the diagram editor.

### 2.3 Why the submodule, not the site

1. The C4 editor lives in the submodule and must be able to run without the site (C4 spec D3, J1; decision SC-2). It cannot depend on a file in the site repository.
2. The text adapter is ArchUML grammar knowledge. It belongs next to the parsers and renderers that define that grammar, where a renderer change and its rewrite rule can change together.
3. The site keeps what is the site's: page markup, persistence, export, and the tutorial wrapper.

Consequence: this work changes both repositories. Submodule files are edited in place (`CLAUDE.md`), and every summary names both.

### 2.4 Mounting contract

A host renders, then hands the drawing to the module. The module never renders. Where a command needs a second drawing (the automatic place of one box), it asks the host service `autoLayout`.

| Member | Meaning |
|---|---|
| `mount({ root, canvas, adapter, host, surface, idPrefix, env })` | `root`: the element that bounds the editor (key scope, popups, full screen). `canvas`: the element that holds the SVG. `surface`: `'classic'` (default) or a host object (§7.3). `env`: `{ document, now(), schedule }`, so tests control time. Returns the session. |
| `session.sync({ svg, revision }, { restore })` | The host calls it after every render. The session reads `adapter.contents()` and `adapter.tools()`, and the scene and hit layer are rebuilt from them and the SVG. `restore` names the selection to bring back (after undo, redo, or an edit). |
| `session.commands` | The commands as functions, for surfaces, toolbars, and forms. |
| `session.gestures` | Gesture factories `{ id, start(event, press) }` (§3.8). The classic surface runs them with its own pointer driver; the C4 host registers the ones it wants on its pointer dispatcher. |
| `session.startPlacing(target)` (from stage A1) | Starts the move of a box (`{ ref }`) or of bend `n` of a line (`{ ref, bend: n }`) without a press and returns its session `{ follow(event), nudge(dx, dy), commit(event), cancel() }`, or `null` after announcing why it cannot start (§3.11). `follow` and `commit(event)` snap as a drag does; `nudge` moves by exactly its step and never snaps. A surface or a host steers it; outside the classic surface the module binds no key and no menu to it. |
| `session.select(ref)`, `session.selection()`, `session.setTool(tool)`, `session.tool()` | Selection and the active palette tool. |
| `session.viewport` | Zoom, pan, and fit, for the host's zoom buttons. |
| `session.destroy()` | Removes every listener (one `AbortController`), every timer, and every node the module added. |

Host services (`options.host`), all optional except `announce`:

| Service | Called for |
|---|---|
| `announce(message, { assertive, verdict })` | The sentence of a result or a refusal. `verdict` is given when the sentence reports an operation's verdict, so a host can show its offer. |
| `status(text, { kind })` | The instruction of an armed tool or a mode; an empty text ends it. |
| `confirm(request)` | A question before a destructive change. |
| `undo()`, `redo()`, `canUndo()`, `canRedo()` | The host's undo stack. |
| `onSelectionChange(selection)`, `openProperties(ref)` | Host forms that follow the selection. |
| `registerEscape(layer)` | The host's Escape order. |
| `autoLayout()` | The positions the renderer gives the current document without any saved layout, as `{ positions }`. The classic host's implementation is today's `withTemporaryAutoSvg`, unchanged. |

### 2.5 Alternatives considered

| Alternative | Why not |
|---|---|
| **Forms only** (today): UML views stay pictures, edited through the inspector | The smallest option. It does not meet U2. |
| **Parse and compare**: let the UML editor edit the generated ArchUML text, then derive the `design.yml` change from the difference | The difference does not say which model element was meant (a retyped label, or a removed and a new relation?). A refusal could only come after the fact. Excluded by U1. |
| **Embed the UML editor** in the C4 editor and keep its text in step with the model | Two sources of truth and two undo stacks, against C4 spec §3.4. |
| **A second canvas editor**, written for C4 | Repeats the drag, guide, anchor, and route code; the two would drift. It is the opposite of the request, and of ED-4. |
| **Chosen**: one module, one operation vocabulary, two adapters | Changes are refused before they happen, with the model's own reasons; each host keeps one undo stack; the drawing code exists once. |

### 2.6 The changes this structure is built for

| Expected change | What has to change |
|---|---|
| The UML editor gains a gesture | One operation, its rewrite in the text adapter, and a corpus entry. The C4 adapter refuses the new operation until a row is added for it. |
| `design.yml` gains a field a UML gesture can fill (for example an association between code elements) | One row of the C4 adapter's table, and its refusal goes. The module and the UML editor do not change. |
| A renderer changes how it stamps ids on the SVG | The scene, and the adapters' `contents()`. |
| The bundle learns to grow a node around a pinned child, or to hold a bend of a line between a ball and its socket | The layout parts of §4.2 for that view, and the matching refusal goes. Revision 3 took this path once: the bundle now places balls and sockets after positions are applied (§6), `positions` became a part of interfaces views, and `layout/fixed-order` went. |
| A third host (the VS Code webview of C4 spec §3.5) | Host services only; it reuses the C4 adapter. |

Not prepared for, on purpose: another rendering technology than ArchUML's SVG; more than one learner editing at once; a diagram type the bundle cannot draw.

## 3. Preparatory refactor (behaviour-preserving), and stage A1 after it

### 3.1 The starting point, measured

`_includes/uml-editor.html` has 13,866 lines on 2026-11-13 (13,638 on 2026-11-12; the user's pull of 2026-11-13 brought upstream editor fixes): about 260 of markup and one script. `init()` (from line 773) holds 488 functions at its top level (588 at any depth) that share closure state through about 115 closure-level declarations, some 60 of them mutable (these three counts are of 2026-11-12). In that script, measured again on 2026-11-13:

- 57 distinct fixed element ids are looked up with `getElementById`;
- `textarea.value` appears on 315 lines (306 on 2026-11-12); 103 of them assign to it, in about 60 functions (§3.5 lists them; every per-function count is unchanged);
- `typeSelect.value` appears on 140 lines;
- `snapshotForUndo(` appears on 72 lines and `renderDiagram(` on 95 (93 on 2026-11-12);
- 29 functions read the selection (`selectedLayoutId`, `selectedLayoutKind`, `selectedLayoutIds`), among them the Properties pane's builders, `updateClassActions`, `undo`, and `redo` (2026-11-12);
- 174 lines add a listener, counting `addHitboxListener` (175 on 2026-11-12), and 30 remove one; one pair of document-level pointer listeners and one key listener live for the page;
- 77 lines assign to an element's `style`;
- one Liquid output tag sits in the script (line 12787), so the script is not JavaScript until the tag is replaced;
- `window.__umlEditorBooted` allows one instance per page.

Every edit follows one pattern: snapshot for undo, assign new text to the textarea, render, announce. That pattern is the seam. It is not yet a clean one: the functions at the write sites also read the drawn SVG and the page (§3.6), and about a quarter of the write sites sit in panels that stay in the include (§3.5).

### 3.2 What is extracted, and where it goes

| Responsibility | Today (functions; where each starts on 2026-11-13) | Destination |
|---|---|---|
| Selection set | `selectionSize`, `clearSelectionSet`, `setSelectedLayoutId` (922, 923, 2012) | `de-selection.js` |
| SVG geometry and editable items | `svgPoint` … `findEditableElements`, `collectPositions`, `collectMoveParts` (1424 … 1752, 1791, 1850) | `de-geometry.js`, `de-scene.js` |
| Routes on the drawing | `findEditableRoutes`, `applyRoutePoints`, `collectConnectedRoutes`, `shiftRoutePoints`, `anchoredTwoPointRoute`, `constrainedPortPosition` (2108–2332); matching a drawn route to a relation by its stamped line or its drawn ends, `drawnRouteEndpoints`, `relationLineForUnnamedRoute`, `relationLineForOrdinalRoute`, `relationLineMatchForRouteId` (8917–9017), now against the relations of `contents()` | `de-scene.js`, `de-geometry.js` |
| Reading ArchUML text | `collectModelElements`, `declarationIdForLine`, `sequenceFragmentRanges`, `parseSequenceModel`, `parseClassDeclaration`, the body parsers, `relationLineIndices`, `tokenizeRelationParts`, `parseRelationLine` (1046, 1300, 3062, 4707, 6825, 8260–8529, 9080, 9308, 9412) | `text/` (the adapter's `contents()`) |
| Layout metadata in text | `normalizeLayoutMode`, `isLayoutModeDirective`, `applyLayoutDirective`, `stripLayoutMetadata`, `insertPos`, `appendLayoutBlock`, `writePositionsIntoSource` (941–980, 1212–1368) | `text/` |
| Element and relation rewrites | `buildElementLine`, `addElementToSource`, `buildRelationLine`, `addRelationToSource`, `rewriteSourceLines`, `removeElementFromSource`, `removeRelationLine`, `replaceBlockByMatch`, `renameReferencesInRelations`, `cloneDeclarationForDuplicate`, `renameElement`, `replaceRelationLine`, `rewireRelationEndpoint`, `invertRelationDirection` (2663–2851, 3709–4029, 8717–8862, 9613–9734) | `text/` |
| Sequence rewrites | message insertion and moves, fragments (kind, guard, else, unwrap, move), activation bars (about 2870–3708; `sequenceInsertLineForY` 2901) | `text/` |
| Raw source rewrites | `replaceSequenceLineRange`, the line-model rows, `appendRawLine`, `replaceCrcCardInSource` (4746, 5039–5153, 5603, 7480) | `text/` |
| Deployment nesting | `ownedElementIds`, `deploymentNestingRefusal`, `carryDeploymentDescendants`, `addDeploymentChildIntoNode` (2547–2625, 5590) | Geometry of "what would contain what" in `de-scene.js`; the verdict and its words in `text/` |
| Tools and placement | `setActiveTool`, `handleCanvasPointerDown`, `placeElementAt`, `findComponentAtSvgPoint` (5318–5543) | `de-commands.js`, `de-gestures-palette.js` |
| Menus and choosers | `showContextMenu`, `build*ContextMenu`, `showElementChooser`, `showRelationChooser` (5685–5877) | `de-menus.js` |
| Drags | extend handle, sequence message (`startSequenceMessageDrag` 6525), fragment (`startFragmentDrag` 6170), activation bar, `updateExtendDrag` (6626), `installRouteEditor` (9922), `updateDrag` with smart guides (11595), marquee (about 12125) | `de-gestures-*.js` |
| In-place editors | `startInlineRelationEdit`, `startInlineRename`, `setElementLabel`, `setSequenceLifelineHead`, `startInlineFragmentEdit`, `startInlineFragmentConditionEdit`, `reorderSequenceLifelines`, `startInlineMemberEdit` (9782, 10549–11182) | `de-inline.js`, commands |
| Selection commands | `deleteSelected`, `selectAll`, `duplicateSelected`, `nudgeElement` (9833, 11321–11427) | `de-commands.js` |
| Hit layer, targets, keys | `clearEditLayer`, `installInteractiveSvgSemantics`, empty-canvas actions, palette buttons and icons (about 4100–4700; `addElementWithoutCanvas` 4482), `installVisualEditor`, the editor's key handlers (1973, 1982, 10024, 12187, 12538, 12564) | `de-surface-classic.js` |
| View transform | `applyEditorCanvasBounds`, `applyViewTransform`, `zoomAt`, `zoomToFit` (1541, 11258–11308) | `de-viewport.js` |

### 3.3 Who owns each piece of state

The closure bindings of `init()` are divided as follows. A binding has one owner; the other side reaches it only through the listed member.

| State today | Owner after the refactor | How the other side reaches it |
|---|---|---|
| Selection: `selectedLayoutId`, `selectedLayoutKind`, `selectedLayoutIds` | Module (`de-selection.js`), per session | Host forms read `session.selection()`, are told through `host.onSelectionChange`, and select with `session.select(ref)`. `undo` and `redo` capture `session.selection()`. |
| `pendingSelect` | Nobody: it stops being state | A verdict's `select`, and the selection an undo captured, travel as the `restore` argument of `sync`. |
| Tool state: `activeTool`, `pendingRelation`, `renamingId` | Module (commands, gestures, in-place editors) | `session.setTool`, `session.tool()`; the tool status line is fed by `host.status`. |
| Drag state: `dragState`, `extendDragState`, `sequenceMessageDragState`, `fragmentDragState`, `activationDragState`, `paletteDragState`, `suppressPaletteClick` | Module: each lives inside its gesture session (§3.8); none stays at module level | — |
| Click tracking: `lastHitboxClick`, `lastRouteClick` | Module (classic surface) | — |
| Popups: `relationChooser`, `contextMenu`, their return-focus elements, `inlineRenameInput`, `inlineRenameCancel` | Module (`de-menus.js`, `de-inline.js`) | `host.registerEscape` |
| View: `zoom`, `panOffset`, `initialCanvasRevealPending`, the zoom limits | Module (`de-viewport.js`) | `session.viewport` |
| Scene caches: `activationBarIndex`, the hit layer | Module (scene), rebuilt at every `sync` | — |
| Canvas constants (`EDITOR_CANVAS_*`, `EDITOR_MIN_TARGET_CSS_PX`, `SVG_NS`); grammar tables (`SEQUENCE_FRAGMENT_KINDS`, the schemas, `SEQUENCE_KEYWORDS`) | Module (geometry, viewport); `text/` | — |
| Document: the textarea's text, `currentType`, `sourceDrafts`, the type and layout selects | Host | The text adapter's `read()`, `type()`, and `write` |
| Render loop: `debounceTimer`, `renderGeneration`, `pendingVisualEditorInstall`, `LIVE_RENDER_DEBOUNCE_MS`, the renderer wait | Host | `session.sync` |
| Undo: `undoStack`, `redoStack`, `historyByType`, the limits, `suspendUndo`, `lastSnapshotValue` | Host | `host.undo`, `host.redo`, `host.canUndo`, `host.canRedo`; the `info.undo` of `write` |
| Persistence and export: `autosaveScope`, `autosaved`, `autosaveTimer`, `autosaveFailed`, the Python and export constants | Host | — |
| Full screen: `fullscreenPending`, `fullscreenReturnFocus` | Host | The module mounts its popups inside `root`, so they follow full screen. |
| Host forms: `classMemberDraft`, `classActionsRenderedSource`, `calloutEditor`, the Properties pane and panel elements | Host | `session.selection()`, `session.commands`, `adapter.apply` |
| Page elements (the 57 ids) and configuration (`EDITOR_CONFIG`, `supportedTypes`, and the like) | Host | Passed to `mount` as elements and options |

Stage R2 ends with the two halves in two function scopes inside the include: the module half is created by one function that receives only the mount options. A read across the line is then a `ReferenceError`, which the existing suites catch. Stage R5 moves the module half to files.

### 3.4 The edit adapter

An adapter has five members.

| Member | Contract |
|---|---|
| `contents()` | What the rendered document means: `{ type, revision, elements, relations, fragments, activations }`. An element has `id` (its layout id), `kind`, `label` (as drawn), `name` (the text an in-place editor starts with), `axis` (`xy`, `port`, `label`, `note`, `order`, or `none` for a box that cannot be moved), `parentId`, and `members: [{ list, index, text }]`, where `text` is the source's text for the member, not the drawn text. A relation has `line`, `routeId` (`null` when the renderer stamps none), `kind`, `from`, `to`, `label`, and `text` (the editable part of the label). A fragment has `id`, `operator`, `startLine`, `endLine`, and `branches: [{ line, guard }]`. No side effects. |
| `tools()` | The palette for this document: element tools and relation tools (`id`, `label`, `glyph`, flags), and `unavailable: [{ id, label, summary, message }]` for tools the notation has but this adapter cannot serve (§5.6). |
| `can(operation)` | A verdict, with no side effects. Called when a gesture starts and when it is dropped, never per pointer move. |
| `targets(request)` | Advice for a gesture with one open end. `request` is an operation without that end, plus `open` (`to`, `from`, `into`, or `parent`). The answer lists the candidates the scene offers: `[{ ref, ok, code, summary }]`. Called once, when the gesture starts. `null` means "no advice": the gesture then marks no target as possible or not possible, which is the classic editor's behaviour today, and the text adapter always answers `null`. |
| `apply(operation)` | Makes the change and returns a verdict, or a promise of one when a confirmation or a form is part of the change. The text adapter always answers synchronously. |

A **verdict** is `{ ok: true, select, message }` or `{ ok: false, code, summary, message, offer }`. `select` is a reference in the document as it is after the change. `message` is the sentence to show and announce. `summary` is one line of at most about 60 characters, for menus and choosers. `code` is stable and is what tests assert; the code `cancelled` (the learner closed a form) has no message. `offer` is at most one follow-up the learner may accept: `{ label, operation }`, applied as of the drawing it was refused on; or a host action named by its key: `{ label, view }` opens a view, `{ label, select }` shows a selection in the inspector, and `{ label, commands }` dispatches core commands as one change.

**Revision.** `contents().revision` is an opaque token that changes whenever the rendered document changes; both adapters derive it from the document's text, so an operation logged in one process can be replayed in another. Every operation carries the revision of the scene it was built from. What an adapter does with it is part of that adapter's contract:

- The text adapter never refuses for it. Today a gesture that follows typing within the 120 ms render debounce is applied to the text as it is, and that stays so.
- The C4 adapter refuses an operation built against another revision with code `stale`, because it translates the operation through the source map of the drawing it was built on (§4.1).

The contract of `apply`:

| | |
|---|---|
| The caller must | Build the operation from the current scene, with its revision and the scene facts the operation's row names. |
| On `ok: true` | The source of truth changed by exactly one undoable step. The host redraws and calls `sync`. `select` names the changed thing in the new drawing. |
| On `ok: false` | Nothing changed, and `message` says why in the learner's words. A drag preview is put back. |
| Always | An operation takes effect completely or not at all (a C4 `batch` returns its first refusal without edits). After `sync`, the drawing shows the source of truth and nothing else. |

Validation has one owner. `apply` decides for itself and never relies on an earlier `can` or `targets`; those are advice for the interface, so a handle can be withheld, a target marked, or a menu item explained. The module does not check model rules, and the C4 adapter does not repeat the core's: it asks the core by a dry run.

**Operation vocabulary.** Fields use references. `at` is an insertion anchor `{ beforeLine }` in the rendered document, or a point for a box. The column "Scene facts" lists what the command adds from the drawing (§3.6 says where each comes from today). An adapter uses the facts its document needs and ignores the others.

| Family | Operation | Fields | Scene facts | Classic code it replaces |
|---|---|---|---|---|
| Layout | `layout.setMode` | `mode` | — | `applyLayoutDirective` (the layout select) |
| Layout | `layout.set` | `positions` (the moved boxes), `routes` (the changed bends) | Every drawn position; the stored routes the move shifted; for a deployment drawing, per moved box whether it still lies inside its parent's drawn box and which nested node's box holds its centre | The commit of `updateDrag`, `nudgeElement`, and the route editor |
| Layout | `layout.reset` | `target`: `all`, an element, or a route | Every drawn position; for one element its automatic position, from `host.autoLayout()`; for a route its storage key | Reset Layout, Reset Selected |
| Element | `element.add` | `tool`, `name`, `into`, `anchor`, and `placed` (`dropped` or `automatic`) | `at`: the drop point, or for a click or key the free place right of the drawn boxes that `addElementWithoutCanvas` computes today; every drawn position | `placeElementAt`, `addElementWithoutCanvas`, `addEmptyElement`, the starters, `addPortIntoComponent`, `addDeploymentChildIntoNode`, anchored notes, sequence control lines |
| Element | `element.rename` | `ref`, `text` | — | `renameElement`, `renameActivityElement`, `setElementLabel`, `setSequenceLifelineHead`, `updateSequenceParticipant`, `replaceVirtualNoteText` |
| Element | `element.update` | `ref`, `changes` (structured: stereotype, abstract, dashed, colour, texture, a CRC card's lists, a use-case system's members) | — | `replaceClassDeclaration`, `replaceGenericElement`, `replaceCrcCard`, `changeSystemMembership` |
| Element | `element.duplicate` | `refs`, `offset` | Drawn positions of the originals | `duplicateElement`, `duplicateSelected` |
| Element | `element.reparent` | `ref`, `parent` (a reference, or `null` for the top level) | — | Classic: none, because a deployment drop that would change nesting is refused inside `layout.set`. C4: §5.4. |
| Element | `element.remove` | `ref` | — | The removals inside the Properties pane and the sequence model panel (`removeElementFromSource` alone) |
| Element | `selection.remove` | `elements`, `relations`, `fragments`, `activations` | — | `deleteSelected` (one operation, so one undo step) |
| Member | `member.add`, `member.update`, `member.remove` | `owner`, `list`, `index`, `text` | — | `submitClassMember`, `startInlineMemberEdit` (both through `replaceClassDeclaration`) |
| Relation | `relation.add` | `tool`, `from`, `to`, `label` | `at` for a message | The callers of `addRelationToSource`: `showRelationChooser`, `connectWithSelectedRelationTool`, `handleHitboxClickForRelation`, `addSequenceRelationAtLine`, `addSequenceSingleMessage` |
| Relation | `relation.update` | `ref`, `changes` (label, kind, multiplicity, navigability, stereotype, dashed) | — | `replaceRelationLine`, `startInlineRelationEdit` |
| Relation | `relation.rewire` | `ref`, `end`, `to` | — | `rewireRelationEndpoint` |
| Relation | `relation.invert` | `ref` | — | `invertRelationDirection` |
| Sequence | `lifeline.add` | `tool`, `name` | — | `addSequenceParticipant`, `addSequenceStarterPair` |
| Sequence | `lifeline.reorder` | `order` | — | `reorderSequenceLifelines` (inside the drag commit) |
| Sequence | `message.move` | `ref`, `at` | — | `moveSequenceMessageBlockToLine`, `moveSequenceMessageToBranch` |
| Sequence | `fragment.add` | `operator`, `at` or `wrap: { fromLine, toLine }` | — | The fragment stubs of `placeElementAt`, `commitWrap` |
| Sequence | `fragment.update` | `ref`, `operator`, `guard: { branch, text }` | — | `changeFragmentKind`, `changeFragmentCondition`, `changeFragmentBranchCondition`, the in-place fragment editor's commit |
| Sequence | `fragment.addBranch`, `fragment.unwrap`, `fragment.move` | `ref`, `at` | — | `addFragmentElseBranch`, `unwrapFragment`, `moveFragmentBy`, `moveSequenceFragmentToLine` |
| Sequence | `activation.add`, `activation.set` | lifeline, slots | — | `createActivationBar`, `setActivationBarSlots` |
| Raw source | `source.replace` | `text` | — | The callouts panel's `commitSource` |
| Raw source | `source.insertLines` | `lines`, `at` (a line, or the end) | — | `makeQuickInsertButton`, `addLineModelPreset`, `addGitgraphBranchRow`, `addGitgraphCommitRow` |
| Raw source | `source.replaceLines`, `source.removeLines`, `source.moveLines` | a line range, with `lines` or `before` | — | `replaceLineModelRow`, `replaceSequenceLineRange`, `deleteLineModelRow`, `moveLineModelRow` |
| Raw source | `source.replaceDeclaration` | `ref`, `text` | — | `replaceLineForElementId` (six callers that rebuild one declaration with the text adapter's body serializers) |

The **raw-source family** carries ArchUML text. It exists for the forms that stay in the classic host and edit the document by its lines: the line-model panels of the diagram types the canvas does not model structurally (git graphs, folder trees, Venn and entity-relationship diagrams), the quick-insert buttons, the callouts panel, and Properties-pane fields that rebuild a declaration. Only the text adapter serves it. The C4 adapter refuses every `source.*` operation with code `not-in-model/source`; no C4 surface can send one, and a test asserts both halves.

A relation reference is `{ routeId, line, candidates }`. The scene resolves a drawn route to a line of the rendered document as the editor does today: directly for ids that carry a line (`rel:N`, `seqmsg:N`), and by the drawn ends and label for ordinal ids (`edge-N`, `usecase:N`). A line the renderer draws without a route id (every line of a class diagram's generalization and realization trees, §4.2) resolves by the elements it touches: `candidates` lists every relation without a route of its own whose ends include them all, and `line` is that relation when there is exactly one, else `-1`. With `line: -1` the adapter keeps the connection and says why, as today. The classic surface uses only `line`. The C4 surface offers `candidates` in a chooser (§5.2).

**Undo hooks.** The module has no undo stack.

- An operation may carry `undo: { key }`, the coalescing key the classic code passes to `snapshotForUndo` today (for example `rel-rewire:12`, or none). The host or adapter decides what one step is.
- Ctrl/Cmd+Z, Ctrl+Y, and Cmd+Shift+Z inside the editor call `host.undo()` and `host.redo()`.
- After an undo or redo the host calls `session.sync(drawing, { restore })`, and the module restores the selection and focus as `applySnapshot` does today.

### 3.5 Write sites and their operations

The 103 assignments to the textarea, by the function that holds them. Seven are document loads that stay with the host; 96 become operations. About 25 of the 96 sit in forms that stay in the include (the last four rows and the row of `element.update`). Stage R0 turns this table into a checked map with one entry per assignment (§3.10).

| Write sites (function, count) | Becomes |
|---|---|
| `applySnapshot` (1), the load at start (2), the empty-document scaffold in `renderDiagram` (1), the type switch (2), `resetCurrentDiagramToStarter` (1) | The host's `setDocument(text, { reason })`; no operation |
| The layout select (1), `nudgeElement` (1), `updateDrag` (3, one of them the lifeline reorder), Reset Selected (3), Reset Layout (1) | `layout.setMode`, `layout.set`, `lifeline.reorder`, `layout.reset` |
| `placeElementAt` (14), `addElementWithoutCanvas` (1), `addEmptyElement` (1), `addClassStarter` (1), `addStateStarter` (1), `addSequenceStarterPair` (1), `addSequenceParticipant` (1), `addDeploymentChildIntoNode` (1), `updateExtendDrag` (1), `handleHitboxClickForSequenceElementTool` (2), `handleHitboxClickForAnchoredNoteTool` (1) | `element.add`, `lifeline.add`, `fragment.add` |
| `renameElement` (3), `renameActivityElement` (1), `setSequenceLifelineHead` (1), `updateSequenceParticipant` (1), `replaceVirtualNoteText` (1) | `element.rename` |
| `replaceClassDeclaration` (1), `replaceGenericElement` (1), `replaceCrcCard` (1), `changeSystemMembership` (1) | `element.update`, `member.*` |
| `deleteSelected` (4) | `selection.remove` |
| `duplicateElement` (1), `duplicateSelected` (1) | `element.duplicate` |
| `addSequenceRelationAtLine` (1), `showRelationChooser` (1), `connectWithSelectedRelationTool` (2), `addSequenceSingleMessage` (2), `handleHitboxClickForRelation` (1) | `relation.add` |
| `replaceRelationLine` (1), `rewireRelationEndpoint` (1), `invertRelationDirection` (1) | `relation.update`, `relation.rewire`, `relation.invert` |
| `moveSequenceMessageBlockToLine` (1), `moveSequenceMessageToBranch` (1) | `message.move` |
| `changeFragmentKind` (1), `changeFragmentCondition` (1), `changeFragmentBranchCondition` (1), the in-place fragment editor (1), `addFragmentElseBranch` (1), `unwrapFragment` (1), `moveFragmentBy` (2), `moveSequenceFragmentToLine` (1), `commitWrap` (1) | `fragment.*` |
| `setActivationBarSlots` (1), `createActivationBar` (1) | `activation.*` |
| Properties-pane removals in `renderChildren`, `renderPorts`, and `renderDeploymentChildren` (3); the sequence model panel's participant row (1) | `element.remove` |
| `replaceLineForElementId` (1) | `source.replaceDeclaration` |
| The callouts panel's `commitSource` (1) | `source.replace` |
| `makeQuickInsertButton` (1), `replaceSequenceLineRange` (1), `replaceLineModelRow` (1), `deleteLineModelRow` (1), `moveLineModelRow` (1), `addGitgraphBranchRow` (1), `addGitgraphCommitRow` (1), `addLineModelPreset` (8) | `source.insertLines`, `source.replaceLines`, `source.removeLines`, `source.moveLines` |

### 3.6 The text adapter, and the recipe that produces it

The text adapter is created with `{ read(), write(text, info), type(), bundle }`. For each operation it computes the new text with a pure rewrite and calls `write` once. `info` carries the undo key, the text an undo returns to, and the selection to restore. `write` ends in the host's `setDocument`, which is the only assignment to the textarea in the whole editor; the host's own document loads (the first row of §3.5) call the same function.

**The recipe.** Today one function does everything for one edit. `moveSequenceMessageBlockToLine` is typical: it resolves the route against the drawn SVG, reads the textarea, snapshots, writes, selects, renders, and announces in one body. `deploymentNestingRefusal` mixes a parse of the textarea with rendered boxes. `stripLayoutMetadata` reads the type select. Reset Selected renders an off-screen automatic layout into `document.body` to learn one position. Such functions cannot be moved as they stand. Stage R1 applies the same split to each of the about 60 functions of §3.5 (Split Phase, Extract Function, and Introduce Parameter; no statement changes for another reason):

1. **Gather** (stays in the command). Everything read from the drawing or the page becomes a scene fact or a field of the operation:
   - the line a route resolves to (`relationInfoForRouteId` and, for ordinal ids, `drawnRouteEndpoints`, `relationLineForOrdinalRoute`, and `relationLineForUnnamedRoute`);
   - drawn positions (`collectPositions`) and the routes a move shifted;
   - insertion anchors (`sequenceInsertLineForY`) and the node under a drop (`findComponentAtSvgPoint`);
   - containment of the moved boxes (the `renderedLayoutBox` half of `deploymentNestingRefusal`);
   - automatic positions (`autoLayoutPositions`, which becomes the host service `autoLayout`).
2. **Compute** (becomes the rewrite). The statements that build the new text are extracted into `rewrite(text, type, operation)`, which returns `{ text, select, message }` or a refusal. `textarea.value` becomes the parameter `text` and `typeSelect.value` the parameter `type`, also inside shared helpers such as `stripLayoutMetadata`.
3. **Commit** (the adapter). `apply` calls the rewrite with `read()` and `type()` and passes the result to `write`.
4. **Show** (the host's `write`, then the command). Snapshot with the operation's undo key and the text before; set the document; render; `sync`. The command then restores the selection and reports the message, in today's order.

Each application is reviewed against the corpus entry of its gesture. In stage R5 the rewrites, by then pure, move to `text/` without a changed statement, so that review reads as a move.

Requirements, each checked by §9:

1. For every gesture of the corpus, the textarea's text after the gesture, after Undo, and after Redo equals the text the editor before this refactor produces, byte for byte. This includes the cases where today's code prepares the text before it snapshots (an empty textarea gets its `@startuml` scaffold first). It also includes the normalizing today's code does on a write: `addElementToSource` and `addRelationToSource` always re-serialize the layout through `stripLayoutMetadata` and `writePositionsIntoSource`, which turns CRLF into LF, rounds `@pos` values, writes `@layout` entries of declared ids inline, and puts the block back after `@startuml`. That is behaviour to keep, not a defect to remove.
2. Announcements, the tool status line, the selection after the gesture, and the focused target are the same.
3. Refusals keep their words, for example the deployment nesting sentences of `deploymentNestingRefusal`.
4. A rewrite takes the text, the type, and the operation, and returns text. It reads no DOM, no clock, and no global. Where it needs a bundle parser (`UMLStateDiagram.parse`, `UMLDeploymentDiagram.parse`, `UMLCRCDiagram.parse`, `UMLUseCaseDiagram.parse`, `UMLShared.extractLayoutMetadata`), it gets the bundle through `bundle`.
5. The text adapter never answers `stale` (§3.4), and its `can` refuses nothing that today's code lets a gesture start.

Rewriting `var` to `const` and `let`, and other tidying, is a later mechanical step per file under the same corpus.

### 3.7 Per-instance options replace ids and globals

| Today | Becomes |
|---|---|
| 57 fixed `uml-pg-*` ids looked up in `document` | The classic host looks them up once inside its root and passes elements (`root`, `canvas`, palette, status). The ids stay as they are in the include: they are the contract of `js/tutorial-uml-editor.js` and of the existing tests. |
| `#uml-pg-config`, `EDITOR_CONFIG` | Host configuration; the module receives options only. |
| `window.__umlEditorBooted` | Stays in the include as the page's own guard. The module has none. |
| `window.UMLEditor.autosaveKey`, `.storageScope`, `.resetCurrentDiagram` | Stay in the include, unchanged (the tutorial wrapper calls them). |
| `window.UMLShared`, `window.UML*Diagram` | Read through `env` and `bundle`, defaulting to the page's. |
| `document.addEventListener` for pointer moves, pointer up, keys, and presses outside a popup | Listeners on `root.ownerDocument`, added for the life of the gesture session or popup that needs them and removed with it, all under the session's abort signal. A session that began inside `root` keeps its moves and its release wherever the pointer goes, and a press outside an open menu or chooser still dismisses it, both as today. The key listener acts only while focus is inside `root`. |
| `Date.now()`, `setTimeout`, `requestIdleCallback` | `env.now` and `env.schedule` in the module (the 500 ms double-click window). The undo coalescing windows (600 ms, capped at 3 s) stay with the host's undo stack. |
| `window.SebookConfirmation.confirm`, `navigator.clipboard`, `localStorage`, `window.dismissAccessibleTooltips` | Host services, or host code that stays in the include. |
| Ids of generated nodes (in-place inputs, menus, `aria-describedby`) | Prefixed with `idPrefix`, unique per instance. |
| CSS class names `uml-pg-*` | Unchanged. They are scoped by `root`, and the tests use them. |

### 3.8 Gestures are sessions

Today a drag exists in two forms. Five drags keep their state in closure variables (`dragState`, `extendDragState`, `sequenceMessageDragState`, `fragmentDragState`, `activationDragState`) and are driven by one pair of document listeners that lives for the page. Four more (the palette drag, the press that places an element, the hitbox press, and the marquee) add and remove their own document listeners per gesture. The C4 editor has one pointer dispatcher (`c4-editor-pointer.js`), in which a gesture is `{ start(event, press) }` and `start` returns `null` to pass or a session `{ move(event), end(event), cancel(), deferCapture }`.

Stage R3 gives every classic drag that one shape, in place:

- Each drag becomes a gesture factory. Its state lives in the session object it returns, so no drag state is left at module level.
- The classic surface gets a small pointer driver. On a press inside the canvas it asks the factories in today's order of precedence and takes the first session. For the life of that session it listens on the document for moves, the release, and a cancel, and it removes those listeners when the session ends. Escape cancels the active session through the surface's key handler.
- What must not change: which gesture claims a press, the movement thresholds, the previews, the commit on release, and what a drag does when the pointer leaves the canvas.

In the C4 host the same factories are registered with `dispatcher.use`. No drag has two implementations and there is no second dispatcher; ED-4 is amended to say so (§15).

### 3.9 What stays in the include

Page markup and its ids; configuration; the boot guard and renderer wait; the diagram-type switch with per-type drafts and histories; the layout select; the textarea, typing, and the text-edit undo baseline; `setDocument`; the undo and redo stacks and buttons; autosave and its indicators; draft diagnostics (calling the text adapter's reader); the render loop and error box; `autoLayout`; export, Copy ArchUML, Generate Python; full screen; splitters; the help banner. `js/tutorial-uml-editor.js` is not changed.

The Properties pane, the class editing bar, the sequence and line-model panels, and the callouts panel wiring also stay. They are forms of the classic host and clients of the text adapter: they read the selection through the session, build their values with the text adapter's serializers, and change the document only through `session.commands` or `adapter.apply` with the operations of §3.5. None assigns to the textarea.

### 3.10 Stages

Each stage ends with the same gate: the suites of §9.4 pass with no change to any existing test file, the gesture corpus matches byte for byte, and the touched routes pass the WCAG audit.

| Stage | Change | New evidence at this stage |
|---|---|---|
| R0 Safety net | No production change. Record the gesture corpus from the editor as it is (§9.2). Record the baseline of the existing suites, including known failures (PR-5). | The **write-site map**: one entry per assignment (its key, the operation or `setDocument` reason of §3.5, the corpus gestures that reach it, or the reason none can). The key is the chain of named functions around the assignment and its ordinal in that chain, because two listeners can share a name: `btn:click` writes in `showRelationChooser` and in `makeQuickInsertButton`, `rmBtn:click` in `renderPorts` and in `renderDeploymentChildren`. A unit test fails when an assignment in the include is missing from the map. |
| R1 One writer | Inside the include: each write site is split by the recipe of §3.6 and handled by an in-file text adapter. `textarea.value = …` remains once, in `setDocument`. `snapshotForUndo` is called from two places: the host's `write` and the typing handler. | Operations, with their scene facts and revisions, are logged for each corpus gesture and stored beside its text. The map test now requires exactly one assignment. |
| R2 One reader, one owner | Inside the include: canvas code asks `contents()` instead of parsing the textarea; state is divided as in §3.3 and the two halves sit in two function scopes; `document` and `window` uses go through injected `env`. | — |
| R3 Sessions | Inside the include: every drag becomes a gesture factory run by the classic pointer driver (§3.8); listeners follow §3.7. | The corpus entries recorded at R0 for a drag released outside the canvas, a drag cancelled with Escape, and a press outside an open menu still match. |
| R4 Presentation | Inside the include: static style assignments in the code that will move (the dimmed palette button during a palette drag, the connect handle's plus sign, the quick-insert buttons' alignment, and the like) become state classes in CSS. Values computed at runtime stay CSSOM sets. | Computed styles of each state are equal before and after, in both themes (§9.4). |
| R5 Move out | Files move to `js/ArchUML/diagram-editor/` in this order: text adapter, geometry and scene, commands, gestures, classic surface and mount, CSS module. The include loads the manifest scripts. | Node tests replay the logged operations against the text adapter (§9.1); the module-load test. |
| R6 Two instances | A test page mounts two sessions with a fake adapter. | The contract test of §9.3. |

No stage from R0 to R6 adds a feature. A defect found on the way is reported, and fixed separately. The UML editor's one behaviour change in this work is stage A1 (§3.11), which starts after R6.

### 3.11 Stage A1: moves without a drag in the UML editor (behaviour change)

Stages R0 to R6 change nothing a learner can notice. Stage A1 follows R6 and changes one thing, by the user's decision (§14 D5): the two gaps of §13 close. Today an element moves by dragging or by arrow keys and has no single-pointer path without a drag (WCAG 2.5.7), and a line is reshaped only by dragging a segment (2.5.7 and 2.1.1). The C4 surface needs the same paths for its UML views (§7.4). So the module holds them once, and each surface adds only its own way in.

**What the module gains** (for both surfaces; nothing here knows a host):

- **A move without a press.** `session.startPlacing({ ref })` starts, for a target the move gesture can drag (a box, a port, a label, a note, a card, a lifeline head), the session that a drag of that target starts, with no pointer down. The preview, the snapping and guides of a pointer position, the constraint of a port to its component's border, the descendants a node carries, and the rest of a multi-selection are therefore the drag's own; there is no second implementation of them. The session behaves as if the target had been grabbed at the centre of its box. It has:
  - `follow(event)`: the preview goes where a drag to that pointer position would put it, snapping and guides included;
  - `nudge(dx, dy)`: the preview moves by exactly that step. A step never snaps to the grid or to a guide, whether the Snap box is checked or not, as today's arrow-key nudge (`nudgeElement`) adds its step exactly. A snapping step would round a 1 px step straight back to the grid and would turn a 10 px step from a position off the grid into a different one, so the keyboard could not do what the arrow keys do today;
  - `commit(event)`: it ends as a release at that point would, snapping included; `commit()` without an event writes where the preview is;
  - `cancel()`: the preview goes back and nothing is applied.

  A commit builds the operation the drag builds (`layout.set`, or `lifeline.reorder` for a head): one undo step, and the drag's announcement.
- **Bends as numbered things.** A bend is a point of a line between its two ends. Bends are numbered from the line's source end, starting at 1.
  - `commands.bends(ref)` lists them as they are drawn.
  - `commands.addBend(ref, at)` puts a new bend in the middle of the line's longest segment, or at `at`, as a preview, and returns its move session; cancelling that session takes the bend away again.
  - `session.startPlacing({ ref, bend: n })` moves bend n. Its steps are exact too, and a pointer position snaps as the route drag's does.
  - `commands.removeBend(ref, n)` removes it, and `commands.straighten(ref)` leaves the line its two ends and no bend.
  - Every write is one `layout.set` with that line's `routes` entry and the scene facts of a route drag's commit. §3.4 gains no operation and the text adapter no rewrite.
  - While one line is selected, each of its bends shows its number as text on the drawing, so that "Move bend 2…" can be matched to the picture. The numbers are not targets and not tab stops.
- **Refusals and redraws.** When the adapter's `can` refuses the operation a commit would build, no session starts and the refusal's sentence is announced. A redraw ends a running session: `sync` cancels it, applies nothing, and says that the drawing changed. One session runs at a time. The redraw that a session's own commit causes is not such a redraw: the session ends when its commit starts, so that redraw cancels nothing and adds nothing to the drag's announcement. This matters in the C4 host, where `apply` is a promise and the redraw and `sync` can come before it resolves.

**What the classic surface adds** (its ways in; the C4 surface's are in §7.4):

| Action | Dragging (as today) | Single pointer (new) | Keyboard |
|---|---|---|---|
| Move an element | Drag it | Its menu, "Move…", then a click at the place | The same menu item, then arrow keys (10 px; with Shift 1 px, today's nudge steps, exact and never snapped) and Enter. The source changes only on Enter. Arrow keys on a focused element still nudge it at once, as today. |
| Reshape a line | Drag a segment | Its menu: "Add a bend", "Move bend n…" (then a click at the place), "Remove bend n", "Straighten" | The same menu; after "Add a bend" or "Move bend n…", arrow keys and Enter |

- **Opening the menu.** A right-click opens the menu of an element or a line today, and that stays. Two ways are new.
  - The surface shows a "⋯" button on the one selected element or line; it is at least 24 by 24 CSS px at every zoom level and has the accessible name "Actions for ‹label›". It sits beside the item, outside every other hit target of the drawing: the item's box, its ports and handles, and a line's segments and bends. Where a crowded drawing leaves no such place, it is drawn under those targets. Either way a press aimed at any of them still reaches it, and no existing gesture loses its target.
  - Shift+F10 or the Menu key on a focused diagram item opens the same menu, handled by the surface, so that the keyboard path does not depend on the browser and the operating system sending a context-menu event for a key (macOS has no standard key for it). On Windows and Linux the browser also sends that event to the focused item, whose existing context-menu listener opens the menu today; the menu still opens once, with focus on its first item, and no browser menu opens over it.
  - The button is not a tab stop, so the tab order of the diagram items stays as it is; the keys reach the same menu.
- **While a move runs.** The tool status line gives the instruction ("Moving Player: click where it should go, or use the arrow keys and press Enter. Escape cancels."), and its Cancel button is shown. The pointer over the canvas moves the preview; a click commits; Escape, Cancel, or a press outside the canvas cancels ("Move cancelled; Player stays where it was."). The move takes the arrow keys and Enter before the focused item's own key handler, so an arrow key moves the preview and does not nudge the item. Afterwards focus is on the moved item.
- **The menus.** The new items follow "Edit properties" in an element's menu and "Edit relation" in a line's. The items a menu has today keep their labels and their order among themselves. The bend items appear only on a line that a drag of its segment bends today. A sequence message has none: `findEditableRoutes` lists it as a route and its menu opens like a line's, but a drag moves or retargets the message. "Move bend n…" and "Remove bend n" appear once for each bend, and "Straighten" only when the line has a bend. With several things selected there is no "⋯" button; the menu of any selected item still opens by right-click or by the keys, and "Move…" then moves the whole selection, as a drag of that item does.

**What must not change.** Every drag; the arrow-key nudge; the items a menu has today; the Properties pane; the status and announcement texts of every existing gesture; the tab order. The gesture corpus (§9.2) is not recorded again and must still match byte for byte. It can, because it observes the document, the announcement regions, the Properties pane, the stored draft, the selection, and the focus, and none of these changes until one of the new paths is used. The stage's own behaviour is pinned by new tests (§9.3), not by corpus entries.

**The gate under a behaviour change.** §9.4 forbids editing the suites that drive the UML editor. This stage allows one kind of edit and no other: a test that fails solely because it states the absence this stage removes (an exact list of a menu's items, for example) gets that assertion changed. Each such change is listed with the old assertion, the new one, and the reason, and the gate records it as accepted; any other failure fails the stage.

**Not in this stage.** The other drags of the classic surface (the order of messages and fragments, activation bars, a relation's end, the extend handle, the palette, the marquee) were not audited for this design. The stage begins by listing each with the path it has without a drag (the model panel's rows, the Properties pane, click-to-place) and reports any that has none. It does not fix them; the session above is what a later fix would start.

## 4. Groundwork in the C4 core

### 4.1 `toUml` returns ids and a source map for all four views

`toUml(viewModel)` returns `{ type, text, ids, source }`. It stays a pure function of the view model. The view models do not carry what the map needs today, so the projection gains fields first.

**Fields the projection adds** (C4 spec §5; added fields only, no existing field changes):

| View | Added to the view model |
|---|---|
| Code | Per class: `lifted` (an element from outside the component, drawn as one box) and `synthesizedOperations` (a `function` drawn with its own call as its one operation). Per relation: `relationshipId` (dependencies; today a relation is only `{ type, sourceId, targetId, label }`), `modelSourceId` and `modelTargetId` (the declared ends, which differ from the drawn ends where `liftBeside` lifted one), and `lifted: { source, target }`. |
| Dynamic | Per message and fragment: `step: { containerPath, index }`, counted in the model's step list, so that a step left out of the drawing (an end that is no element) does not shift the positions after it. Per message: `status` (`forward`, `async`, `reply`, `delivery`, `invalid`), `reasonCode` (§4.3), and `relationshipIds`. Per branch: its index. |
| Deployment | Per link: `derived`, and for a derived path its `relationshipIds` (today only the first description and the technology survive the merge). Per hosted instance: `nodeId`. |
| Interfaces | Nothing: components, ports, and assemblies already carry their ids. |
| All four | `layout`: the view's normalized layout entry (§4.2), or `null`. |

A test asserts that the added fields change no drawing: for every shipped model and view, the `toUml` text and the `describe` output equal the ones recorded before the change. Unit tests that compare whole view models are audited first (C4 spec §15 names that risk).

**The result.**

- `ids` maps every alias in the text to a model id, for every view type: a code element or lifted element id (class), an element id (sequence), a node id or an instance key `<element>@<node>` (deployment), an element or interface id (component, as today).
- `source.lines` has one entry per line of the text without its layout block: `null`, or what the line stands for.

| View | Line entries |
|---|---|
| Code | `{ kind: 'element', id, lifted }`; `{ kind: 'member', id, list, index, synthesized }`; `{ kind: 'relation', relation: 'extends' \| 'implements' \| 'collaborator', from, to, modelFrom, modelTo, relationshipId }`, where `from` and `to` are the drawn ends |
| Dynamic | `{ kind: 'participant', id, boxId }`; `{ kind: 'box', id }`; `{ kind: 'message', containerPath, index, status }`; `{ kind: 'fragment', containerPath, index, operator }`; `{ kind: 'branch', containerPath, index, branch }`; `{ kind: 'fragment-end', containerPath, index }` |
| Deployment | `{ kind: 'node', id, parentId }`; `{ kind: 'instance', elementId, nodeId }`; `{ kind: 'link', derived, from, to, relationshipIds }` |
| Interfaces | `{ kind: 'element', id, role }`; `{ kind: 'port', role, interfaceId, elementId, consumerId }`; `{ kind: 'assembly', interfaceId, providerId, consumerId }` |

Rules:

- Without a layout entry the text equals today's text, so no existing figure changes. The one exception is the alias rule below, which changes only drawings that are wrong today.
- Aliases keep decision SC-7. Nothing stores an alias: selection, pins, and commands use model ids, and the adapter translates through the `ids` of the drawing the operation was built against. An alias that changes after a rename is therefore harmless.
- **Aliases are never keywords.** Today `aliasing()` only replaces characters. An element whose id is a word the target grammar reads at the start of a line loses its lines: with a participant `loop`, the message `loop -> api` is parsed as a `loop` fragment and is missing from the drawing (probe). The UML editor guards against this with `SEQUENCE_KEYWORDS`; the C4 generator does not, and an editable dynamic view, where a first rename sets the id, makes the case easy to reach. From M3, an alias that equals such a word, compared without case, gets a trailing underscore (`loop_`) before the collision suffix. The word list per text type (sequence, class, deployment) is read off the bundle's parsers at M3 and is a superset of the editor's `SEQUENCE_KEYWORDS`; a renderer test draws one model per listed word and requires one stamped route per relation or step.
- An insertion anchor maps to a step position: before a message or a fragment line, that item's position; before an `else` line, the end of the branch above it; before a fragment's `end`, the end of its last branch; before `@enduml`, the end of the scenario.

### 4.2 Layout entries for UML-notation views (extends C4 spec §4.8)

A layout entry under a C4-notation view key stays a map from element id to `[x, y]`. Under a UML-notation view key it is a map with named parts:

```yaml
layout:
  containers of registration:        # C4 notation: unchanged
    web: [40, 120]
  code of policy:
    positions:
      EnrollmentPolicy: [80, 40]
      EnrollmentRule: [420, 40]
      PrerequisiteRule: [300, 300]
      UnitCapRule: [540, 300]
    routes:
      - {from: EnrollmentPolicy, to: EnrollmentRule, relation: collaborator, points: [[380, 90], [400, 60], [420, 90]]}
  deployment production:
    positions:                        # top-level nodes only
      student-laptop: [40, 40]
      campus-cloud: [300, 40]
    routes:
      - {from: ingress, to: api-pod, relation: link, points: [[520, 150], [560, 185], [520, 220]]}
  dynamic enroll:
    lifelines: [web, policy, coordinator, seats, billing-gateway]
  interfaces of api:
    positions:                        # every drawn box
      web: [60, 40]
      api: [60, 260]
      billing: [440, 260]
```

| Part | Views | Meaning |
|---|---|---|
| `positions` | code, deployment, interfaces | The top-left corner of a drawn box, as for C4 pins. In a code view every drawn box can hold one, keyed by element id (an element drawn from outside the component by its own id). In a deployment view only top-level nodes can, keyed by node id. In an interfaces view every drawn box can (a consumer, the subject, a provider), keyed by element id; its balls and sockets then turn to face their partners (§6). |
| `routes` | code, deployment | A list of `{ from, to, relation, points }`. In a code view `relation` is `collaborator` (a dependency line), and `from` and `to` are the drawn ends. In a deployment view it is `link` (between nodes, by node id) or `derived` (between hosted instances, each written `<element>@<node>`, always in that form). `points` has at least two `[x, y]` pairs. |
| `lifelines` | dynamic | The order of the lifelines, as element ids. Lifelines of one organization box stay together when drawn (§6). |

What cannot hold a position or a bend, and why:

| Not kept | Reason | Refusal (§5.1) |
|---|---|---|
| Positions of nested nodes and hosted instances | The deployment renderer applies saved positions as absolute coordinates and does not grow a node around a pinned child: a nested node pinned at (1200, 700) is drawn outside its parent, which spans 300–640 by 28–556 (probe). The picture would contradict the model's nesting. Without a position of their own, nested boxes are laid out inside their node and follow it when it moves. | `layout/inside-node` |
| Bends of generalization and realization lines | The class renderer draws every such line, also a single one, as part of a tree per target and stamps no route id, source, or target on it; only dependencies get `rel:N` (probe). There is nothing to attach a saved route to. | `layout/inheritance-line` |
| A bend where two lines of one kind join the same pair in the same direction | A route is identified by its ends and kind. Relationship ids of parallel relationships are positional (`a->b#2`), so a route stored by position would move to the other line when the first is deleted. | `layout/parallel-lines` |
| In an interfaces view: a bend of the line between a ball and its socket, and a position of a ball or socket | The component renderer draws that line in two parts joined by the ball-and-socket symbol and stamps each with a number in drawing order (`edge-0`, `edge-1`), and the order changed when a box moved (probe, revision 3). With positions it also chooses where the two ends sit from the places of the boxes (§6). A stored bend would name a part by a number that shifts and hold a line whose ends move with every box. Revision 2 kept no position in this view either, because a moved box kept its ball or socket on the far side (probe); that limit went with the bundle change of §6 (§14 D3). | `layout/assembly`, `layout/port` |
| Positions in a dynamic view | A sequence diagram has no free positions; its one layout freedom is the order of its lifelines. | — |

Rules:

- The model knows a key's view type from the shared selector grammar (as for per-view fields, §4.8), and keys are normalized with `selectorKey`. A flat pin map under a UML view key, or a part the view type does not have (`routes` or `lifelines` under an interfaces view key, for example), is `schema/type` or `schema/unknown-key` with a hint. No shipped model has a layout entry under a UML view key today; a test asserts it.
- A route is applied only when the view draws exactly one line of that `relation` from `from` to `to`. It is dropped while drawing when one of its ends no longer lies on the border of its end box, because a box moved or changed size (§6).
- An entry that names something the view no longer draws, or a position for a box that cannot hold one, is ignored when drawing and removed the next time the editor writes that view's layout. It is not an error.
- "Change id…" rewrites `positions` keys, `from` and `to` (both parts of an instance key), and `lifelines` items. Delete removes them, as §4.10 already says for layout entries. The new `changeNodeId` (§4.3) does the same for a node in the entries of its environment's deployment views: its `positions` key, a `link` end, and the node part of an instance key. An interface id occurs in no layout part, so `changeInterfaceId` rewrites none.
- Why named parts and not more keys in the flat map: `routes` and `lifelines` are legal element ids, so a reserved key beside element ids could collide with an element.
- Why not a `participants` list on the scenario: lifeline order is presentation. A scenario's participants stay derived from its steps.

### 4.3 Commands and shared rules the core gains

All commands follow C4 spec §4.9: text splices, bytes outside the edit ranges unchanged, add-then-delete identity, refused while the YAML has errors.

| Command | Purpose |
|---|---|
| `setUmlLayout { viewKey, positions, routes, lifelines }` | Writes the named parts of one UML view's layout entry (a part given as `null` is removed; an empty entry and an empty `layout` are pruned). One splice. It refuses a part the view type lacks, a position for a nested node or a hosted instance, and a route for an inheritance line. `pinPosition` and `unpinPosition` keep serving C4-notation views and refuse UML view keys. |
| `moveStep` with `toContainerPath` | Moves a step or fragment to another step list (into or out of a branch). Without it the command is as today. |
| `wrapSteps { scenarioId, containerPath, from, to, operator }` | Puts consecutive steps of one list into a new fragment's first branch. |
| `unwrapFragment { scenarioId, containerPath, index }` | Replaces a fragment by the steps of its branches, in order. |
| `setFragmentOperator`, `setBranchGuard`, `addBranch`, `removeBranch` | Fragment edits the inspector writes with its splice kit today. The inspector switches to these commands, so each has one implementation (ED-4). |
| `moveNode { environmentId, nodeId, newParentNodeId }` | Re-parents a deployment node with its nested nodes; `null` makes it a top-level node. Refuses a node inside itself and an infrastructure parent. |
| `setNodeLink`, `removeNodeLink { environmentId, nodeId, targetNodeId, … }` | Node collaborators, which the inspector also writes with its splice kit today; it switches too. |
| `changeNodeId { environmentId, nodeId, newId }` | Gives a deployment node a new id and rewrites what names it: its key under `nodes`, the link keys of the other nodes of its environment, and its layout sites (§4.2). It refuses an id that is not an id (§4.8) and one that another node of the environment has. The editor uses it for the first rename of a node added on a canvas (§5.1); nothing else in this work calls it. |

Rules that the forms and the canvas must share move into the core, so each has one owner:

| Rule | Today | In the core |
|---|---|---|
| Which senders and receivers a step may have at a position | `validStepEnds` in `c4-editor-inspector-scenarios.js`, with its helpers `candidatePairs`, `structuralPairs`, `withStepsAt`, `stepListAt`, `trialStep`, `ALONG_RELATIONSHIP`, and the inspector's containment test `nested` | `ArchUMLC4.stepEnds(design, { scenarioId, containerPath, index, replace, sender })`, moved with those helpers and unchanged in what it accepts. It returns `{ froms, tosOf(from), problemOf(from, to) }`; `problemOf` gives `null` or a reason code. |
| Why a step is invalid | `classifyBackwardStep` reports its reason only as English text | Each status also carries `reasonCode`: `no-relationship`, `reply-without-request`, `asynchronous-no-reply`, `unknown-element`. `stepEnds` adds `nested-ends` (an element and its own part) and `same-element`. The texts, and so the `xlevel/scenario-step` messages, do not change. |
| Which code element may extend or implement which | Nothing checks kinds: `extends` and `implements` are read only for connectivity (`c4-checks.js`), so a class can implement a class and a class can extend an interface | `ArchUMLC4.inheritanceProblem(design, sourceId, relation, targetId)` gives `null` or a code (`extends-target`, `extends-kind`, `implements-target`, `extends-cycle`). `setList` on `extends` and `implements` refuses an added entry with it, so the Members form and the canvas give the same answer. Hand-written YAML is not flagged in this version (§13). |

The kind rule, in the terms of this design model's code kinds: a class or an abstract class extends a class or an abstract class; an interface extends an interface; a class, an abstract class, or an enum implements an interface; a function and a module extend and implement nothing.

## 5. The C4 model adapter

### 5.1 Rules for all four views

**One path to the model.** Every change is one or more `ArchUMLC4.edit` commands, dispatched through the editor state as one `batch` (one splice, one undo step, SC-5). Where the editor already has a shared action (rename, delete with its confirmation, add or move a relationship, add an element from a tile), the adapter calls that action and adds no second implementation (ED-4).

**Capability.** `can(operation)` answers from, in this order: the editor's mode (`read-only`, `yaml-errors`), the adapter's table for the view (below), a dry run of the commands through `ArchUMLC4.edit`, and `state.lockRefusal` for locks. `targets(request)` gives the same answer for each candidate end, once per gesture (§7.4). So a gesture that would be refused does not start, a target that would be refused is marked before the drop, and the learner sees and hears why.

**Identity (§4.10).** The adapter never writes ids itself. Every rename goes through a shared rename action, one for each kind of named thing, so the same rule holds on every canvas, in the inspector, and in the outline. The user decided the rule on 2026-11-13 (§14 D1), which confirms final review I6 of the C4 spec: **an id follows a name once, on the first rename of something that was just added on a canvas.**

| Named on the canvas | Name written to | Shared action | Id change on the first rename |
|---|---|---|---|
| Code element, lifeline, component box, hosted instance | `name` of the element, model-wide | `renameElement` (exists) | `changeElementId` |
| Deployment node | `name` of the node | `renameNode` (new) | `changeNodeId` (new, §4.3) |
| Provided interface | `name` of the interface | `renameInterface` (new) | `changeInterfaceId` |

A rename also changes the id when all four of these hold. Otherwise it changes the name alone:

1. The thing still has the placeholder name it was added with ("New class" and the other code-element names of the palette, "New node" or "New infrastructure node", "New interface") and the id the core gave that name (`new-node`, perhaps with a number).
2. Nothing refers to it except its own layout entries. For a node: no other node has a link to it. For an interface: no `uses` entry and no `interface ‹id›` selector names it.
3. The open view is not inside it (an element) and is not its description card (an interface).
4. No lock holds its id.

The new id is the one the core would give a new thing of that name. The rename and the id change are one batch, so one undo step, and the announcement ends "; its id is now ‹id›". Every later rename keeps the id, whatever the new name is. Escape in the name editor of a box that was just added keeps the placeholder, so the next rename is still the first. The Name fields of the node form and of the interface form call the same actions as the canvas, as the element's Name field does today: a node whose tile was dropped on the canvas and that is then named in the inspector gets its id there. "Change id…" stays for elements and interfaces; a node has no such control in this version (§14).

**Declared and derived.** Only what is declared in `design.yml` can be edited. A drawn thing the model derives (a deployment path between instances, the arrow style of a message, an organization box, an interfaces view's neighbours and assembly labels) answers an edit with a refusal that names what it is derived from, and where the table says so offers to show that source.

**Drawn ends and declared ends.** A code view draws an element from outside the component as one box that stands for it or for something inside it (`liftBeside`). A line to such a box can stand for a relationship to a component deep inside that system. The adapter therefore never builds a command from drawn ids alone. It takes the relationship id and the declared ends from the source map (§4.1):

- Editing the label or deleting the line acts on the declared relationship, and the confirmation and the announcement name its real ends.
- Moving the end that is drawn at a code element of this component keeps the other end's declared element.
- Moving or turning the end that is drawn at a lifted box is refused (`outside-view/lifted-end`): the learner cannot see what the line would be detached from.

**Effects outside the open view.** A canvas edit that changes the model beyond what the open view draws says so, in its announcement and in the label of its undo step. This covers renaming a lifeline, a hosted instance, a component box, or an interface ("Renamed Seat Gateway to Seat Store everywhere in the model"), adding a relationship from a dynamic, deployment, or interfaces view ("…added to the model; it appears in the C4 views of both elements"), and deleting a use in an interfaces view.

**Model content the view does not draw.** A gesture never adds something silently that the open view will not show:

- A dependency between two lifted boxes of a code view would not be drawn, because the view keeps only relationships that touch the component. It is refused (`outside-view/both-ends`).
- A relationship between two hosted instances is not drawn when node links already lead from the first instance's node to the second's (C4 spec §6.3). It is added, and the announcement says why no line appears and names the link that carries it; the offer "Show the relationship" opens it in the inspector.

**Locks and read-only (§11).** `read_only` leaves the listbox and navigation and mounts no editing. `locked_fields` needs no rule of its own: every operation becomes commands that pass `changedLockedPath`, so a refused edit carries the editor's `lockedSentence`. A locked `layout` path refuses moves in that view. Today that sentence has a subject only when an element holds the locked path; a locked step reads "Locked: given by the task, so it cannot be changed here." The state's `lockedRefusal` gains subjects for the other drawn things (the table below), in the one function the inspector forms use too.

**Withheld checks.** A tutorial step can hold diagnostics back until the learner asks (`checks.display: on-request`) or submits (`after-submit`), so that a prediction comes first (C4 spec §9.3). Until they are released, the canvas says no more than the scenario form's pickers show: target marks tell the possible ends from the others, and a refused step gets the general sentence `step/not-available`, with no reason and no offer. After Check now or Submit for review, and always under `live`, the specific sentence is used.

**Offers.** An offer is one button in the message region (§7.5). No offer changes the model's structure with one click: an offer that would add a relationship opens the relationship form, exists only in the expert profile, and asks the structural question first (§5.3). There is no offer when the dry run of its commands is refused.

**Refusals.** Codes are stable; tests assert codes, and one table test checks each code's texts (SC-10). A refusal has a short reason, used in menus and choosers, and a sentence, shown in the message region and announced. ‹…› are filled from the model. Sentences never use an arrow sign, which a screen reader reads as "right arrow"; they say "from … to …".

| Code | Short reason | Sentence | Offer |
|---|---|---|---|
| `read-only`, `yaml-errors` | "Read-only"; "Fix the YAML errors first" | The editor's existing sentences. | — |
| `locked` | "Given by the task" | "Locked: ‹subject› or a part of it is given by the task, so it cannot be changed here." ‹subject› is an element's name as today, or "step 3 of ‹scenario›", "the steps of ‹scenario›", "node ‹name›", "the link from ‹A› to ‹B›", "the positions in this view", "the lifeline order in this view". | — |
| `stale` | — | "The drawing changed before this edit was applied, so nothing was changed. Try again." | — |
| `outside-view` | "Shown from outside ‹Scope›" | "‹Name› is a ‹type› outside ‹Scope›. It is shown here because ‹Scope› works with it. Rename or delete it in ‹view title›." | Open ‹view title› |
| `outside-view/lifted-end` | "Ends inside ‹Box›" | "This line ends at ‹Deep name›, a ‹type› inside ‹Box›, which this view draws as one box. Move or turn that end in ‹view title›, where ‹Deep name› is drawn." | Open ‹view title› |
| `outside-view/both-ends` | "Both ends are outside ‹Scope›" | "‹A› and ‹B› are both outside ‹Scope›, so a line between them would not appear in this view. Add it in ‹view title›." | Open ‹view title› |
| `not-in-model/note` | "No notes in this design model" | "This design model has no place for notes on a diagram. Write the explanation in the element's description." | — |
| `not-in-model/duplicate` | "One identity per element" | "Duplicating is not available here: every element has one identity in the model. Add a new element and name it." | — |
| `not-in-model/association` | "Not recorded in this design model" | "This design model records three kinds of line between code elements: extends, implements, and a collaborator, drawn as a dependency. It has no place for a composition, an aggregation, or an association, although UML has them. Draw a dependency and say what ‹Source› asks ‹Target› for." | — |
| `extends-target` | "‹Target› is not a code element" | "‹Source› can extend or implement a code element. ‹Target› is a ‹type›." For a component it continues "Its classes and interfaces are in its code view."; for a container, system, or person, "Classes belong to the components inside a container." | Open code of ‹Target› (a component only) |
| `extends-kind` | "‹Source kind› cannot extend ‹target kind›" ("A class cannot extend an interface") | "‹Source› is ‹its kind› and ‹Target› is ‹its kind›. A class extends a class, and an interface extends an interface." (each kind with its article: "a class", "an interface"). For a class and an interface it continues "To promise an interface's operations, draw a realization." | — |
| `implements-target` | "Only an interface can be implemented" | "‹Target› is ‹its kind›. A class implements an interface; to build on a class, draw a generalization." | — |
| `extends-cycle` | "Would make a cycle" | "‹Target› already extends ‹Source›, so ‹Source› cannot extend ‹Target›." | — |
| `derived/keyword` | "Shows the element's kind" | "The keyword shows the kind of this code element. Change its kind in the inspector." | — |
| `derived/function-operation` | "Drawn from the function's name" | "A function is drawn with one operation, its own call. Edit the line to give it a signature; to remove it, change the element's kind." | — |
| `step/not-available` | "No step possible here" | "A step runs along a relationship the design has, or answers an earlier request in this scenario. A step from ‹Sender› to ‹Receiver› does neither at this place." | — |
| `step/no-relationship` | "No relationship from ‹Sender›" | "‹Sender› has no relationship to ‹Receiver›, and no earlier step asks ‹Sender› for something it could answer. A scenario uses the collaborations the design has: ‹Sender› can answer an element that asked it earlier, or the message can go through an element that already works with ‹Receiver›." | Expert profile only: "Declare a relationship from ‹Sender› to ‹Receiver›…" |
| `step/reply-without-request` | "No request to answer yet" | "‹Sender› can reply to ‹Receiver› only after an unanswered step from ‹Receiver› to ‹Sender›, earlier in this scenario or branch. A reply travels back along the request's relationship and needs none of its own." | "Add the request from ‹Receiver› to ‹Sender› first…" |
| `step/asynchronous-no-reply` | "No reply to an asynchronous message" | "The relationship from ‹Receiver› to ‹Sender› is asynchronous: ‹Receiver› does not wait, so no reply travels back along it. If ‹Sender› must tell ‹Receiver› something, that is a collaboration of its own." | Expert profile only: the same "Declare…" offer |
| `step/nested-ends` | "One is inside the other" | "‹Child› is inside ‹Parent›. A step runs between two elements that are not inside each other." | — |
| `step/same-element` | "A step needs two elements" | "A step runs between two elements. What ‹Name› does on its own belongs in its responsibilities." | — |
| `not-in-model/lifeline` | "Lifelines come from steps" | "A lifeline appears when a step uses its element. Choose Message, then the sender, then the receiver; Another element… lists the elements a step can reach from the sender." | — |
| `not-in-model/sequence-detail` | "Not recorded in a scenario" | "Activation bars, create and destroy marks, and lost and found messages have no place in this design model's scenarios. A scenario records who asks whom for what, in order." | — |
| `not-in-model/fragment` | "Not one of the five fragments" | "A scenario in this design model has five fragments: alt, opt, loop, par, and break." | — |
| `single-branch` | "‹operator› has one branch" | "‹operator› has one branch. Use alt for alternatives or par for branches that run at the same time." | — |
| `last-branch` | "A fragment keeps one branch" | "This is the fragment's only branch. Delete the fragment, or unwrap it to keep its steps." | — |
| `fragment-into-itself` | "Cannot go inside itself" | "A fragment cannot be moved into one of its own branches." | — |
| `derived/arrow` | "Follows the model" | "The arrow follows the model: solid for a call, dashed for a reply, an open arrowhead for a message, event, or stream. To change it, change the connector of the relationship this step runs along, or the step's direction." | — |
| `derived/box` | "Follows the model" | "This box shows that these lifelines belong to ‹Name›. It follows the model." | — |
| `not-in-model/artifact` | "Host a container or system instead" | "A deployment view of this design model shows which containers and software systems run on which nodes. It has no place for artifacts; host a container or a system on the node." | — |
| `infrastructure-leaf` | "Infrastructure hosts nothing" | "‹Node› is infrastructure, such as a load balancer: it hosts nothing and holds no nodes." | — |
| `node-into-itself` | "Cannot go inside itself" | "‹Node› cannot be moved into itself or into a node inside it." | — |
| `already-hosted` | "Already runs there" | "‹Node› already hosts ‹Element›." | — |
| `derived/path` | "Drawn from a relationship" | "This path is drawn from the relationship from ‹Source› to ‹Target› (‹description›), because both run on these nodes. Change that relationship, or add a link between the two nodes." | Show the relationship |
| `link-ends` | "A link joins two nodes" | "A link joins two nodes. To show that two elements talk, add a relationship between them." | — |
| `link-exists` | "These nodes are already linked" | "‹Node A› already has a link to ‹Node B›. Edit that link." | Show the link |
| `same-element-instances` | "Both are ‹Element›" | "Both boxes are ‹Element›, running on two nodes. To show that the copies talk to each other, add a link between ‹Node A› and ‹Node B›." | "Add a link from ‹Node A› to ‹Node B›…" |
| `layout/inside-node` | "Laid out inside ‹Parent›" | "‹Name› is inside ‹Parent›, and what is inside a node is laid out for you. Move ‹Parent›, or use Move to… to put ‹Name› somewhere else." | — |
| `not-in-model/port` | "Offer or use an interface instead" | "This design model has no ports. An element offers an interface (a ball) and uses one (a socket)." | — |
| `interfaces/add-element` | "Elements appear through interfaces" | "This view shows ‹Scope› and the elements that share an interface with it. Add elements in a C4 view; they appear here once they use or provide an interface." | — |
| `interfaces/declared-elsewhere` | "Declared on ‹Owner›" | "‹Interface› is declared on ‹Owner›. Rename or remove it in the interfaces view of ‹Owner›." | Open interfaces of ‹Owner› |
| `interfaces/neighbour` | "Here because of an interface" | "‹Name› appears here because it ‹uses \| provides› ‹Interface›. Delete that use, or delete the element in a C4 view." | — |
| `interfaces/assembly-ends` | "Delete it and draw the new one" | "A line joins one use to one interface. To change it, delete this use and draw the new one." | — |
| `interfaces/assembly-direction` | "The provider keeps the ball" | "The ball is on the side of the element that provides ‹Interface›. To turn the line around, describe an interface on ‹Consumer› and let ‹Provider› use it." | — |
| `derived/assembly-label` | "Lists the operations used" | "The label lists the operations ‹Consumer› uses. Change them under Uses in the relationship." | Show the relationship |
| `layout/assembly`, `layout/port` | "Routed for you"; "Placed for you" | "The line between a ball and its socket is routed for you, so the two stay joined. Move the elements to change it." / "A ball or socket is placed for you, on the side of its element that faces the other end. Move the elements to turn it." | — |
| `layout/inheritance-line` | "Routed for you" | "Generalization and realization lines are drawn as one tree for each parent, so they are routed for you. Move the elements to change them." | — |
| `layout/parallel-lines` | "Routed for you" | "Two lines of this kind join ‹A› and ‹B›, so they are routed for you. Move the elements to change them." | — |
| `layout/label` | "Follows its line" | "Labels follow their lines here. Move a bend, or the elements the line joins." | — |

A refusal of the core (a duplicate relationship, a containment link, `model/interface-provider`, an in-process interface across a container boundary) is passed on with the core's learner message. A duplicate between two hosted instances whose path a node link hides also names that link.

The sentences speak of "this design model", not of "a C4 model", wherever the limit is the schema's. C4 prescribes no notation, and its code level may be any UML class diagram (the `c4-model` skill, notation and views); a learner must not take a limit of `design.yml` for a rule of C4 or of UML. Every new text gets the alignment review that CP-4 requires before release.

### 5.2 Code view: `code of ‹component›` (class diagram)

| Gesture | Change to `design.yml` | Refused when (code) |
|---|---|---|
| Add Class, Abstract class, Interface, or Enum (expert profile: also Function, Module) | `addElement { parentId: ‹component›, type: code, kind, name }`, batched with its position in a view that holds positions (§6); the name is ready for editing | `locked` |
| Rename a code element | Shared rename action. A class is drawn under an identifier, so a space in the name is drawn as an underscore; the in-place editor's instruction line says so (§7.4). | Empty name (existing sentence); `locked`; a lifted element: `outside-view` |
| Add an attribute or operation; edit a member line; delete a member | `setList { elementId, field: attributes \| operations, items }`. The in-place editor starts from the model's text, never from the drawn text, because drawing replaces quotes, braces, and arrows by look-alikes. | `locked`; a lifted element: `outside-view`; deleting the one drawn operation of a function that declares none: `derived/function-operation` (editing that line writes the function's first operation) |
| Draw a generalization from A to B | `setList { A, extends, items + B }` | `extends-target`; `extends-kind`; `extends-cycle`; already present |
| Draw a realization from A to B | `setList { A, implements, items + B }` | `extends-target`; `implements-target`; already present |
| Draw a dependency from A to B | The shared add-relationship action through the anchored relationship form (description required; technology, connector, and Uses under More). A lifted box stands for its own element: a line drawn to the Billing System box is a relationship to that system, and the announcement names its type. | Both ends lifted: `outside-view/both-ends`; the core's refusals |
| Draw a composition, aggregation, association, bidirectional, or plain association | None | `not-in-model/association` |
| Edit a dependency's label | `updateRelationship { relationshipId, description }` | `locked` |
| Move an end | At a code element of this component: for extends and implements, one `setList` for a new target or a `batch` of two for a new source, with the declared target id; for a dependency, the shared move-relationship action, keeping the other end's declared element. At a lifted box: none. | As for drawing; `outside-view/lifted-end` |
| Invert a line | Extends, implements: `batch` moving the entry to the other element. Dependency: the shared move-relationship action with both ends. | `extends-kind`; `extends-cycle`; a lifted end: `outside-view/lifted-end`; the core's refusals |
| Delete a line | `setList` without the entry, by its declared target id; a dependency through the shared delete-relationship action | `locked` |
| Delete a code element | Shared delete action; its confirmation lists dependents | `locked`; a lifted element: `outside-view` |
| Move boxes; move a bend of a dependency | `setUmlLayout` (§6) | `locked`; two dependencies in one direction between one pair: `layout/parallel-lines` |
| Bend a generalization or realization line | None | `layout/inheritance-line` |
| Duplicate; add a note; edit a keyword | None | `not-in-model/duplicate`; `not-in-model/note`; `derived/keyword` |

A code element's kind, stereotypes, and design choices stay in the inspector. Pattern roles drawn as stereotypes under `with patterns` are derived.

**Selecting an inheritance line.** The renderer stamps no id on these lines, so a press is resolved by the elements the pressed line touches (§3.4). A branch of a class with one parent stands for one line and selects it. On a shared trunk, or on the branch of a class that both extends and implements, the surface opens a chooser of the lines there ("PrerequisiteRule implements EnrollmentRule", "UnitCapRule implements EnrollmentRule"). Every line is also an option of the listbox (§7.3), built from the source map, so the keyboard path does not depend on geometry.

### 5.3 Dynamic view: `dynamic ‹scenario›` (sequence diagram)

The palette has one **Message** tool and the five fragments. The arrow a message gets is derived (§6.3 of the C4 spec), so there are no separate synchronous, asynchronous, and return tools. A reply is a step back to the asker: it is drawn dashed when it answers a request that is still open in that scenario or branch. A step may run along a declared relationship or one derived from lower levels; `stepEnds` (§4.3) decides, and the canvas does not ask which of the two it is.

A new step or fragment is confirmed in one small anchored form, the same on every path (drag, clicks, keys), built from the scenario form's step fields (ED-4): Sender, Receiver, **Position**, and Description for a step; Operator, Guard, and Position for a fragment. The model changes when the form is confirmed, as one undo step; Escape adds nothing ("No step added."), as Escape removes a pending relationship in C4 views.

| Gesture | Change to `design.yml` | Refused when (code) |
|---|---|---|
| Draw a message from one lifeline to another at a height; or Message, then the sender's lifeline, then the receiver's at a height; or C with the keyboard (§7.4). Receivers are the ends `stepEnds` allows; "Another element…" lists the allowed ends not yet in the scenario, grouped by the element they are in, the scenario's level first. | The step form opens with the ends, the position, and a starting description (for a step along a relationship, the description of a step this scenario already has between the same two elements, else the backing relationship's description; empty for a reply or a delivery; revision 3.2, as built). Confirming it runs `addStep { scenarioId, containerPath, index, step: { from, to, description } }`. | `step/no-relationship`, `step/reply-without-request`, `step/asynchronous-no-reply`, `step/nested-ends`, `step/same-element`, or `step/not-available` while checks are withheld; `locked` |
| Accept "Add the request from ‹Receiver› to ‹Sender› first…" | The step form for the request, at the same position. The learner then draws the reply. | As for drawing |
| Accept "Declare a relationship from ‹Sender› to ‹Receiver›…" (expert profile) | The anchored relationship form, headed by "This adds a relationship to the model. ‹Sender› will depend on ‹Receiver› in every scenario and every view, not only in this one. Is that the design you want?", then `batch[addRelationship, addStep]`: one undo step. | The core's refusals; `locked` (then there is no offer) |
| Move a message or a fragment earlier or later, into or out of a branch | `moveStep` (with `toContainerPath` across lists) | `locked`; `fragment-into-itself` |
| Move an end of a message to another lifeline; invert a message | `updateStep` with `from`, `to`, or both | As for drawing, at that position |
| Edit a message's label | `updateStep { description }`. The drawn label may also show the technology and, with interfaces shown, the operation; the editor starts with the description alone. | `locked` |
| Make a message asynchronous or synchronous | `updateStep { connector }` in the step's anchored form. The form shows the connector of the relationship the step runs along as the default ("Follows the relationship: call"). Choosing another one shows a warning in the form: "This step would be asynchronous, while the relationship it runs along is a call. A step usually follows its relationship; if every use is asynchronous, change the relationship's connector.", with a button that opens that relationship. | Asking for a return arrow: `derived/arrow` |
| Delete a message | `removeStep` | `locked` |
| Add alt, opt, loop, par, or break at a height, or from the keyboard | The fragment form, then `addFragment` | critical, ref, neg: `not-in-model/fragment` |
| Wrap messages in a fragment (a step's menu "Wrap in a fragment…": the operator, and the last step to include, chosen from the steps that follow it in the same branch) | `wrapSteps` | `locked` |
| Change a fragment's operator | `setFragmentOperator` | More than one branch to opt, loop, or break: `single-branch` |
| Edit a guard | `setBranchGuard` | Empty: the scenario form's existing sentence |
| Add a branch; remove a branch | `addBranch`; `removeBranch` | `single-branch`; `last-branch` |
| Unwrap a fragment | `unwrapFragment` | `locked` |
| Delete a fragment | `removeStep`. When it holds steps, the confirmation lists them and has three answers: Delete with its steps, Unwrap instead (keeps the steps), Cancel. | `locked` |
| Rename a lifeline | Shared rename action; the element is renamed in the whole model, and the announcement says so (§5.1) | `locked` |
| Reorder lifelines | `setUmlLayout { lifelines }` (§6) | `locked` |
| Delete a lifeline | After a confirmation that lists them, `batch` of `removeStep` for every step the element sends or receives, from the last to the first so that positions stay valid. The element stays in the model. | `locked` |
| Add an actor or participant alone | None | `not-in-model/lifeline` |
| Activate, deactivate, destroy, create, lost, found, note | None | `not-in-model/sequence-detail`, `not-in-model/note` |
| Change an arrow's style; edit an organization box | None | `derived/arrow`; `derived/box` |

**A message that no relationship backs** is refused, and the novice profile offers no way to declare the relationship from the refusal. Reasons:

- One rule. The scenario form already offers only valid senders and receivers, and the canvas follows the same function (§4.3).
- The shortcut is the mistake a tutorial step teaches against. Step 8 of the C4 tutorial (`failed-seat-hold`, novice profile, no `locked_fields`, `checks.display: on-request`) gives the learner a draft with the step `seats -> web`, asks "why would declaring the missing relationship make the check pass but the design worse?", and has a hint, "A Shortcut Is Not a Repair", for a model that declares a relationship from `seats` to `web`. A one-click "Declare the relationship" on the canvas would hand the learner that wrong repair. Locks do not help: the step locks nothing.
- For a reply, declaring a relationship is also wrong in C4 and in RDD terms. A reply travels back along the request's relationship and belongs to the asker's collaboration; a relationship from the replier to the asker would be a second, false dependency in every C4 view. So `step/reply-without-request` offers the request, never a relationship.
- In the expert profile the offer stays for the two cases where a new collaboration can be the right design, and its form asks the structural question before anything is written.

Rejected: a one-click declare in every profile (revision 1; the reasons above); writing the invalid step for the checks to report (the form would then forbid what the canvas allows). The user confirmed the expert offer on 2026-11-13 (§14 D2).

Reordering is not limited by validity, as in the form's Move up and Move down; a step that loses its backing is reported by `xlevel/scenario-step` under the step's display mode.

### 5.4 Deployment view: `deployment ‹environment›` (deployment diagram)

In a C4 model nesting is data (`nodes` inside a node), so the nesting moves that the UML editor refuses are real edits here. They are never a side effect of moving a box:

- A move changes a position and nothing else. Only top-level nodes hold positions (§4.2). Dragging a nested node or a hosted instance moves no box; it can only put the thing into another node.
- A dragged top-level node can be released on empty canvas, which moves it, or on a marked node, which puts it inside that node. The mark under the pointer shows which of the two a release will do.
- Nesting changes in two ways: a drop on a node that `targets` marked as possible, or the menu "Move to…", which lists the nodes that can take the thing and, for a node, "At the top level (not inside a node)". A drop anywhere else changes nothing and says why (`layout/inside-node`).
- The announcement and the undo step's label name the change of nesting ("Moved API pod into Campus cloud"; "Moved API pod out of Campus cloud to the top level").

| Gesture | Change to `design.yml` | Refused when (code) |
|---|---|---|
| Add a node: a tile dropped on empty canvas or on a node; a click or A (§7.4 says where it goes) | `addNode { environmentId, parentNodeId, name }`, batched with its position for a top-level node in a view that holds positions; the name is ready for editing | `infrastructure-leaf`; `locked` |
| Add an infrastructure node | `addNode { kind: infrastructure }` | `infrastructure-leaf` |
| Host a container or system on a node (the Host tile on a node, or with a node selected) | A chooser of the containers and software systems the node does not host, then `setHosts` | `infrastructure-leaf`; `already-hosted`; the core's advice for a component or person |
| Put a node into another node, or at the top level | `moveNode`. Going into a node, its position is removed in the same batch; arriving at the top level in a view that holds positions, it gets a free place (§6). | `infrastructure-leaf`; `node-into-itself` |
| Put a hosted instance on another node | `batch` of two `setHosts` | `infrastructure-leaf`; `already-hosted` |
| Rename a node; rename a hosted instance | For a node the shared node rename action (§5.1): `updateNode { field: name }`, joined by `changeNodeId` in the same undo step on the first rename of a node added on a canvas. For a hosted instance the shared rename action for the element, which renames it in the whole model and says so. | `locked` |
| Delete a node | `removeNode` after a confirmation that lists nested nodes, hosted instances, and links | `locked` |
| Delete a hosted instance | `setHosts` without it; the announcement says the element stays in the model | `locked` |
| Connect two nodes | `setNodeLink` through an anchored form (description required, technology optional) | A node with itself; `link-exists` |
| Connect two hosted instances | The shared add-relationship action between the two elements; the form says it adds a relationship to the model. When node links already carry it, the announcement says why no line appears (§5.1). | Two instances of one element: `same-element-instances`; the core's refusals |
| Connect a node and an instance | None | `link-ends` |
| Edit, move an end of, invert, or delete a link between nodes | `setNodeLink`; `batch[removeNodeLink, setNodeLink]`; `removeNodeLink` | `locked` |
| The same on a derived path | None | `derived/path` |
| Move a top-level node (it carries what it contains); move a bend | `setUmlLayout` (§6) | `locked` |
| Move a nested node or a hosted instance without putting it into another node | None | `layout/inside-node` |
| Add a component or an artifact; plain line, dependency; note | None | `not-in-model/artifact` (the Host tile replaces the Component tool); `not-in-model/note` |

A node's kind, technology, and number of instances stay in the inspector's node form; the kind is also in the node's context menu. The drawn name with "×N" and a link's drawn label (the technology alone, a renderer choice) are compositions, so an in-place edit starts from the name alone, and editing a link opens its form.

### 5.5 Interfaces view: `interfaces of ‹element›` (component diagram)

| Gesture | Change to `design.yml` | Refused when (code) |
|---|---|---|
| Add a provided interface to the view's subject | `addInterface { elementId: ‹scope›, name: "New interface" }` (a shorthand list is expanded first, in the same undo step); the name is ready for editing, and the first name also sets the id (§5.1) | On a neighbour: `interfaces/declared-elsewhere` with its offer; `locked` |
| Draw a line from a consumer to a ball ("use this interface") | With a relationship from the consumer to the provider: `setUses` adding the interface. Without one: the anchored relationship form, then `batch[addRelationship, setUses]`; the form says that it adds a relationship to the model. Operations are chosen in the Uses picker. | The core's `model/interface-provider` and in-process messages; `locked` |
| Rename a ball or socket | The shared interface rename action (§5.1): `updateInterface { interfaceId, field: name, value }`, joined by `changeInterfaceId` in the same undo step on the first rename of an interface added on a canvas; the announcement says the interface is renamed in the whole model | An interface declared elsewhere: `interfaces/declared-elsewhere` |
| Delete a ball nothing uses | `removeInterface` after its confirmation | `interfaces/declared-elsewhere` |
| Delete a line between a ball and a socket | After a confirmation that lists them, `setUses` without the interface on every relationship behind the line; the relationships stay | `locked` |
| Move an end of that line, or invert it; edit its label | None | `interfaces/assembly-ends`; `interfaces/assembly-direction`; `derived/assembly-label` |
| Rename a component box | Shared rename action; the element is renamed in the whole model, and the announcement says so | `locked` |
| Delete a consumer or provider box | None | `interfaces/neighbour` |
| Move a box (a consumer, the subject, or a provider) | `setUmlLayout` (§6); the balls and sockets of the moved box and of its partners turn to face each other | `locked` |
| Move a ball or socket; bend a line | None | `layout/port`; `layout/assembly` |
| Add a component, a port, a note, a plain line, or a dependency | None | `interfaces/add-element`; `not-in-model/port`; `not-in-model/note` |
| Enter on a consumer or provider | Opens its interfaces view, as today | — |

The view draws what an element provides and uses. What an operation realizes (`realizes`), and everything else inside an interface description, is not drawn here and stays in the interface form and on the description card.

Without positions the view is laid out as before: the elements that use the subject above it, the ones it uses below. Once a box has been moved the view keeps the learner's arrangement, and its legend names the subject instead of pointing at a place (§6).

### 5.6 What stays disabled, and how the learner is told

| Reason | UML-editor operations |
|---|---|
| The schema has nowhere to store it | Composition, aggregation, association, multiplicity, navigability; notes and callouts; activation bars, create, destroy, lost, found; critical, ref, neg; artifacts; ports; duplicate |
| The drawing derives it | Arrow style, organization boxes, lone lifelines, keywords and stereotypes, derived deployment paths, an interfaces view's neighbours and assembly labels |
| It belongs to another view | Renaming or deleting a lifted element, or moving a line's end at one; adding elements to an interfaces view; interfaces declared on another element |
| The layout does not keep it in this version | Positions of nested nodes and hosted instances; bends of inheritance lines and of parallel lines; in an interfaces view the bends of lines between balls and sockets and the positions of balls and sockets; label positions |

U1 asks for "disabled with an explanation", so nothing a learner may look for is simply missing:

- **Tools.** The palette shows the tools the adapter serves. After them it has one disclosure, "More UML tools (not available here)", which lists the notation's other tools (`tools().unavailable`) as `aria-disabled` items, each with its short reason on one line ("Composition: not recorded in this design model"). The relationship chooser that opens when a line is drawn lists the unavailable kinds the same way, after the available ones. Activating a disabled item changes nothing and shows its full sentence in the message region.
- **Manipulations of something that is drawn** (a drag, a menu command) stay reachable. A menu item that cannot run is `aria-disabled` and carries the short reason as visible text; activating it shows the sentence. A refused drag puts its preview back and shows the sentence.
- A menu or chooser item never carries a multi-sentence text, so menus reflow at 320 CSS px.
- Help lists every refusal with its sentence under "Not available in this design model".

## 6. Layout for UML views

**Where the layout is applied.** The projection attaches the view's layout entry to the view model (`viewModel.layout`). `toUml` writes it into the text as ArchUML's own layout block, directly after `@startuml`: `node "<alias>" x=… y=…` for positions, `edge "rel:<line>" points="…"` for routes, and the lifelines' declaration order for `lifelines` (the lifelines of one organization box stay together). Line-based route ids count lines without the layout block, so the block does not shift them (probe: the class, sequence, and deployment route ids are the same with and without a block). An interfaces view whose entry holds a position also gets the line `layout ports facing` after its direction line (below); without a position its text is today's.

Every path draws that one text: the editor canvas, an embedded figure, the static prerender (`uml_to_svg.js` runs the same `c4-render.js`), and print, which prints the same DOM. So there is no second place that applies pins, and "Copy ArchUML source" and the CLI's `uml` command carry the layout too.

**Static equals live.** RR-8 compares delegated UML views by node coordinates and route points. That comparison gains pinned fixtures for each view type that holds positions (code, deployment, and interfaces); a pinned box must also sit exactly on its pin on both paths (probe: a saved position is the top-left corner of the drawn box). The interfaces fixture also compares where the balls and sockets sit, because it is the one fixture drawn through the new `layout ports facing` path.

**Balls and sockets face their partners (a bundle change; §14 D3).** Today the component renderer chooses the side of every provided and required interface before saved positions exist, and `applyLayoutPositions` then moves each ball and socket with its box. A consumer moved below its provider keeps its socket on its lower side: the line leaves the provider's ball upward, passes both boxes on the left, and enters the consumer from below (probe; repeated for revision 3 on the reference view `interfaces of api`). The renderer gains one directive for component diagrams, `layout ports facing`:

- **The line.** It stands on a line of its own and is read by the component parser before the shared layout directives, as `layout wrap` is in sequence diagrams. It changes neither the direction nor the layout preference. A bundle without the change ignores the line (probe, revision 3: the drawing equals the one without it).
- **When it acts.** Only when the document gives at least one component a saved position. The sides are then chosen after the positions are applied, from the two boxes of each assembly at their final places:
  - one box above the other, with a gap between them: the lower side of the upper box and the upper side of the lower one;
  - one box beside the other: the right side of the left box and the left side of the right one;
  - apart in both directions: the direction with the larger gap, and with equal gaps the direction of the diagram's `layout vertical` or `layout horizontal`;
  - overlapping boxes: the sides the automatic layout chose.
- **Other ports.** A ball or socket that takes part in several assemblies faces the partner of its first connector. A port with a saved position of its own, a port outside every assembly, and a plain port keep what they have today.
- **Boxes and lines.** A box is sized for its ports as today, so it can change size when its ports change sides; its top-left corner stays on its saved position. Where the two boxes overlap along the facing direction, the ball and the socket sit at one x (or one y) and the line is straight, as it is today between neighbours of a vertical stack. For boxes beside each other this means where they share a height at which both can hold a port: below each box's name and keyword lines and above its bottom inset. Where they overlap only outside such heights, the ports still face each other, each at the nearest height its side allows, and the line bends once in the gap (revision 3.2, as built; across a vertical gap every shared x can hold a port). The line of an assembly crosses neither of its two boxes once the facing sides are at least 46 units apart; closer than that the ball-and-socket symbol can enter a box by a few units (a known limit of the renderer's joint placement, `docs/c4-decisions.md`).
- **What stays byte for byte.** Every drawing without the directive, and every drawing with it but without a saved position of a component. So no existing component diagram changes: not the 89 on the site (the component corpus of the A/B guard, counted 2026-11-13), not an interfaces view without positions, and not a diagram a learner moves in the UML editor, which does not write the directive.

`toUml` writes the directive only into an interfaces view that holds a position. The UML editor draws it when a learner types it, and its layout select and its write-back leave the line alone, because they claim only the layout modes they know (`isLayoutModeDirective`). The evidence is an A/B run and a renderer test (§9.1, §9.5).

**The legend of an interfaces view names its subject.** The legend line under the drawing ended "In the middle: Registration API, the subject of this view." A place cannot identify the subject once boxes move, and a sentence that points at a place says nothing to a reader who does not see the layout (WCAG 1.3.3). The line now ends "The subject of this view is Registration API.", in every interfaces view, with or without positions: in the figure, in `describe`, and in the editor. The automatic layout still puts the elements that use the subject above it and the ones it uses below; the legend no longer claims that order.

**The routing redesign does not apply.** `c4-place` and `c4-route` place and route C4-notation views only. UML views are placed and routed by the bundle's renderers, which apply ArchUML's layout block: a pinned box moves alone, and its neighbours do not make room (the C4 settle step of routing spec §4.7 has no counterpart). The rules that follow from this:

1. **The first move pins every box that can hold a position** (every drawn box of a code view or an interfaces view; every top-level node of a deployment view), so nothing jumps afterwards, as in the UML editor today. A moved top-level node carries what it contains: nested boxes hold no position and follow their node (probe).
2. **Additions.**
   - A tile dropped at a point is placed there and pinned. In a view without positions this counts as the first move, so the other boxes are pinned where they are drawn.
   - A box added by a click or a key gets no drop point. In a view that holds positions it goes to a free place, right of the drawn boxes (the place the UML editor's `addElementWithoutCanvas` computes), and is pinned there. In a view without positions the automatic layout places it.
   - A nested node or a hosted instance is laid out inside its node.
   - A box that appears through an edit made elsewhere (a new consumer or provider in an interfaces view, a lifted box in a code view, a top-level node added in the inspector) has no position. The renderer places it where the automatic layout would, and rule 4 looks at it when the editor next draws the view.
3. **Return to automatic layout** for one box removes its position; the renderer then places it where the automatic layout would. "Reset layout" removes the view's whole entry.
4. **Overlaps are never silent.** After an addition, a return to automatic layout, an edit that makes a pinned box grow (a class gains a member, a node gains a nested node), a move that changes the size of a box in an interfaces view because its balls and sockets changed sides, or the first drawing of a view in which a box without a position appeared (rule 2), the scene checks whether a box that holds a position now overlaps another box. If it does, the message region names the two ("Enrollment Policy now overlaps Unit Cap Rule.") and offers "Move ‹Name› to a free place", which is a move like any other. One check catches all five, whatever caused them and whichever view module drew the boxes. After every drawing of a view that holds positions, the editor takes the overlapping pairs in which at least one box holds a position and compares them with the pairs of its last drawing of that view; on a view's first drawing in the editor, every such pair is new. It names the first new pair in reading order. ‹Name› is the box of the pair whose rectangle changed since that last drawing, else the later one in reading order. A pair it has named is not named again while it stays overlapped.
5. **A bend lasts as long as its line still joins its two boxes.** When a box with a position moves, the module shifts the bends of its lines with it and writes them in the same `setUmlLayout`, as the UML editor does. When a box moves or changes size for another reason, a stored bend can end beside or inside it. `renderDelegatedView` draws the view once, inside the bundle's opt-in `UMLShared.renderSkippingDetachedRoutes`, which leaves out every stored route whose first point is not on the border of its source box or whose last point is not on the border of its target box (`renderedLayoutBox`, a tolerance of 1.5 units, the points measured as the route element holds them); such a line keeps the route the renderer drew, and `renderDelegatedView` lists the dropped routes in its result. (Revision 3.2: until Ruling RR-11 it checked the drawing afterwards and drew the view a second time without those routes.) Static, printed, and live figures therefore agree, and the editor removes the dropped routes at its next layout write and says so.

**Lifeline order.** A lifeline dropped among the lifelines of its own box changes their order. Dropped outside its box, it moves the whole box to that side. The announcement names what moved ("Moved the Registration API box left of Billing System").

**Print.** A pinned drawing can be wider than the automatic one. `markPrintOrientation` already marks delegated drawings for a landscape page. Shipped models with UML-view pins fall under the 9 pt gate (AP-1); a learner's own pins can exceed it, and Reset layout is the remedy (§11).

## 7. Host integration in the C4 editor

### 7.1 Drawing seam

`ArchUMLC4Render` gains `renderDelegatedView(container, viewModel, options)`, which returns `{ svgText, uml, droppedRoutes }`: the `toUml` result that was actually drawn, and the stored routes it left out (§6). `render` calls it. The canvas calls it for UML-notation views and stops rewriting the document's `view:` line (`textShowingView` is removed).

### 7.2 Mounting

For a UML-notation drawing the canvas does three things, in this order:

1. It draws.
2. It mounts or syncs one `ArchUMLDiagramEditor` session with the C4 model adapter, the C4 surface, and the drawing's `uml`. The scene reads the drawing before anything is added to it. The module then adds its hit layer, which the bundle's route and obstacle collectors already skip by its class.
3. It lays its listbox over the drawing. The listbox group carries `data-layout-ignore`, which the bundle's two collectors (`collectRouteObstacleBoxes`, `collectEditableRoutes`) learn to skip beside the hit layer. Without it an option rectangle could be read as a box or a route, and the ordinal numbering of unnamed lines would shift.

A redraw destroys nothing but the hit layer and the listbox.

One generalized overlay builder replaces `attachComponents` and serves all four UML views. It finds each box through the scene, so class boxes, which carry `data-layout-bounds-id` and no `data-layout-id` (probe), are found like the others. The builder has a read-only mode with today's behaviour. Milestone M4 switches the interfaces view to that mode, so its existing read-only test stays green and unchanged until M7 turns editing on. Without the diagram-editor scripts on the page the canvas behaves as today, so the editor can ship before a host loads them.

### 7.3 The C4 surface

The classic surface makes every target a button and a tab stop, nudges with arrow keys, and, until stage A1 (§3.11), has no way without a drag to move a box or a bend. The C4 editor keeps its own grammar instead, the same in every view: one listbox with a roving tab stop, selection following focus, and modes with single-pointer and keyboard paths (C4 spec §9.1, §9.2). So the C4 host takes the module's scene, commands, and gestures, and supplies the surface itself.

Options of a UML view, in sets (`role="group"`) of the one listbox "Elements in this view". The description carries in words what the drawing shows by line style, nesting, or place (WCAG 1.3.1):

| View | Sets | Option name | The description says |
|---|---|---|---|
| Code | "Code elements of ‹component›"; "Outside ‹component›"; "Lines" | The element's name; "PrerequisiteRule implements EnrollmentRule"; "Enrollment Policy asks for … from Enrollment Rule" | The element's kind. For a line: generalization, realization, or dependency; "routed for you" for an inheritance line; for a lifted end, "ends at ‹deep name› inside ‹box›". |
| Dynamic | "Lifelines"; "Steps", in order | The element's name; "Step 3: Registration Coordinator asks for an eligibility decision from Enrollment Policy"; "alt fragment, 2 branches" | For a lifeline: "lifeline 2 of 5" and "in ‹box name›". For a step: how it is drawn (call, reply, asynchronous message, or delivery) and where it sits ("in alt, branch 2 of 2: a section is full"). For a fragment: each branch's guard. |
| Deployment | "Nodes"; "Hosted"; "Links" | The node's name; "Registration API on API pod"; "Ingress forwards HTTPS requests to API pod" | For a node: kind, technology, "inside ‹parent›" or "at the top level". For a link: "declared link", or "derived from the relationship from ‹A› to ‹B›; follows the model". |
| Interfaces | The three sets of today (consumers, the subject, providers); "Interfaces"; "Uses" | The element's name; the interface's name; "Planner Web App uses Enrollment API of Registration API" | For an interface: "provided by ‹element›", and "offered through ‹descendant›" or "delegated from ‹ancestor›" where that applies. For a use: the operations used. |

Every description also carries the type line, "position kept" where the box holds one, the problem count when diagnostics are shown (an invalid step is drawn like a call, so its state is a problem, not a line style), and what Enter does. Pointer hit targets (boxes, line segments, handles) are the module's and are `aria-hidden`; each is at least 24 by 24 CSS pixels at every magnification.

### 7.4 Every drag has a single-pointer and a keyboard path (WCAG 2.5.7, 2.1.1)

A drag chooses a place with the pointer. The other two paths must reach the same places, so the last column says where a result goes when nothing was dragged. Each result is announced with its place ("Added step 4, after step 3, in alt, branch 2: a section is full").

| Action | Drag | Single pointer | Keyboard | Place without a drag |
|---|---|---|---|---|
| Move a box that holds a position | Drag it; guides and snapping; Escape cancels | Menu "Move…", then click the place; the inspector's Position section (step buttons, X and Y, Return to automatic layout) | M, arrow keys (Shift: larger steps), Enter | The clicked point; the arrow steps |
| Add an element | Drag a tile onto the canvas or onto a node | Click the tile | A | Code view: §6, rule 2. Deployment view: with a node focused or selected, the Add menu asks "Inside ‹node›" (the default, unless it is infrastructure) or "At the top level"; otherwise the top level. |
| Draw a line (code, deployment, interfaces) | Drag from a connect handle to the target | Click the tool or handle, then the source, then the target | C, arrow keys through the marked targets, Enter | —. A chooser offers the kinds that fit the pair. |
| Draw a message | Drag from a lifeline to another, at the height of the step | Message, then the sender's lifeline, then the receiver's lifeline at the height of the step | C on a lifeline or a step opens the step form | Pointer: the height of the release or of the second click, mapped to an anchor (§4.1). Keyboard: after the focused step, in its branch; from a lifeline, at the end of the scenario. The form's Position select lists every place ("after step 3", "in alt, branch 2: a section is full, at the end") and can change it. |
| Add a fragment | Drag the Fragment tile to a height | Fragment, the operator, then a click at a height | A, Fragment | As for a message |
| Move a message or fragment | Drag it up or down | Menu "Move earlier", "Move later", "Move into…", "Move out of the fragment"; the scenario form's row menu | M, ↑ and ↓, Enter | Each press goes to the next insertion place in reading order, entering and leaving branches, and announces it ("Before step 5, in alt, branch 2: a section is full"). |
| Move an end of a line or message | Drag the end | Menu "Move to…" with the possible new sources or targets; the others are listed disabled with their short reason | The same menu | — |
| Wrap messages in a fragment | — | A step's menu "Wrap in a fragment…" | The same menu | — |
| Reorder lifelines | Drag a head sideways | Menu "Move left", "Move right" | M, ← and →, Enter | Inside its box a lifeline swaps with its neighbour. At the edge of its box, the next press moves the whole box past the neighbouring lifeline or box, and the announcement says that the box moved. |
| Put a node into another node; put a hosted instance on another node | Drag it onto a marked node | Menu "Move to…" with the nodes that can take it and, for a node, "At the top level (not inside a node)" | The same menu | —. A drop anywhere else changes nothing (§5.4). |
| Move a bend | Drag a segment | The line's "⋯" button or menu: "Add a bend", "Move bend N…" (then click the place), "Remove bend N", "Straighten" | The same menu; after "Add a bend" or "Move bend N…", arrow keys and Enter | "Add a bend" puts the bend in the middle of the line's longest segment (from a right-click on the line: at the pressed point) and enters Move for it; Escape takes it away again. |
| Pan, magnify | As in C4 views | Scrollbars, zoom buttons | As in C4 views | — |

**Moves without a drag are the module's** (§3.11). This host's Move mode (M, or "Move…" in a menu) steers `session.startPlacing`, and the line's menu calls the module's bend commands. The preview, the snapping, and the commit are therefore the drag's own, and they are the same code the UML editor uses for its "Move…" and its bend menu. What this host adds is its keys, its menu items, its Escape layer, and its instruction text. Its arrow steps are the C4 editor's (10 units; with Shift 50), and like every `nudge` they are exact. Its C4-notation Move mode stays as it is.

**Target marks.** When a gesture with an open end starts (a line or message being drawn, an end being moved, a node or instance being put somewhere, C mode), the command asks `adapter.targets` once and the scene marks every candidate: a possible target with the thick dashed outline of C4 views, the others with a thin outline and a struck-through circle. Both cues are shapes, and both are checked after the dark-mode inversion. In C mode the arrow keys move through the possible targets first; the others follow, described as "not available: ‹short reason›", and Enter on one shows its sentence. A drop on a target that is not possible puts the preview back and shows the same sentence.

**Selection.** The C4 editor keeps its single selection. The module's multi-selection (marquee, Ctrl/Cmd+click, select all, group moves) is a classic-surface feature and is not registered in this host.

**Keys and clicks.**

- Drags act on pointer up (2.5.2).
- A double-click always edits the text under the pointer in place. It never opens another view, so a double-click on a lifeline renames it, as a UML-editor user expects.
- Enter opens what has an inside or its own interfaces view, and says that there is nothing to open on anything else. The zoom badge and the menu item "Open ‹view›" do the same.
- F2 edits in place: a name, a step's description, a fragment's first guard. Delete and Backspace remove after the confirmations of §5. Shift+F10 opens the menu.
- A selected line shows a "⋯" button beside the middle of its longest segment, 24 by 24 CSS pixels at every magnification, which opens its menu with one click. It is placed by the module's rule of §3.11, outside the segment's own hit target and every other one, so a press on the segment still starts a bend. A line's menu therefore never depends on a right-click or on the timed long press. The line's row in the inspector has the same menu.
- While a line is selected, each bend shows its number as text in its handle, so "Move bend 2…" can be matched to the drawing.

**In-place editors.** Each is an HTML input over the drawing with an accessible name and a visible instruction line tied to it with `aria-describedby` ("Enter saves, Escape cancels."). A code element's name adds "Class names have no spaces; a space is drawn as _."

| Editor | Accessible name | Starts with | Escape |
|---|---|---|---|
| Name of an element, node, or interface | "Name of ‹type› ‹current name›" | The model's name | Keeps the old name |
| Name of a box that was just added | The same | The placeholder name, selected | Keeps the placeholder; the box stays, and Undo removes it |
| Description of a step | "Description of step ‹n›" | The step's description | Keeps the old text |
| Guard of a branch | "Guard of branch ‹n› of ‹operator›" | The guard | Keeps the old guard |
| A member line | "‹Attribute \| Operation› ‹n› of ‹class›" | The model's text for the member | Keeps the old line |

New steps and fragments are not edited in place: they are confirmed in their anchored form (§5.3), whose Escape adds nothing.

No new key is introduced in the C4 editor. The "C4 editor" section of `/shortcuts/` gains the words for steps, lifelines, and bends, and the editor's Help lists the same rows. (The UML editor's new keys of stage A1 are in §3.11.)

### 7.5 One undo stack, one message region, one live region

- **Undo.** Every change reaches the document through `state.dispatch`, so it is one step in the host's one stack: the editor's history on the site, Monaco's in a tutorial (§3.4 of the C4 spec). The module's undo keys call the state's undo and redo.
- **The message region.** Today the C4 editor's `announce` writes only to a live region that is hidden from sight (`c4-editor__live c4-editor__sr-only`), and no host supplies `host.announce`. A sighted learner whose drag snaps back would see no reason, and an offer would have nowhere to live. The editor therefore gains one visible message region:
  - It is HTML inside the editor root, directly before the canvas region in DOM order and drawn above the canvas. An editable editor always keeps the row at the height of one line of text, so a message that appears does not push the drawing away under the pointer; a longer message wraps and the row grows. A read-only editor has no row.
  - It shows one message at a time: the instruction of the armed tool or mode ("Message: click the sender's lifeline, then the receiver's at the height of the step. Escape cancels."), or the last refusal, result, or notice. A refusal starts with the words "Not done:" and has an icon; it does not rely on colour.
  - A message stays until the next message replaces it, an edit succeeds, another view opens, or the learner chooses Dismiss. It never disappears on a timer.
  - An offer is a native button in the region; Dismiss is another. Both come directly before the canvas region in the tab order, so Shift+Tab from the canvas reaches them and no new key is needed. The announcement of a message with an offer ends with the offer's label.
  - Text is at paragraph size (`font: inherit`). The region has base, `html.dark-mode`, and print rules together; print hides it.
- **The live region.** The module's `announce` and `status` both end in the C4 editor's `announce`, which writes the same sentence to the visible region and, once, to the polite live region. The visible region is not itself live, so nothing is announced twice. Each change is announced once, with the label of its undo step.
- **C4-notation views.** Their refusals and mode instructions had the same gap (§13). The region is the editor's, not the UML views', so M4 routes those two call sites through it as well (decided, §14 D6): `refuse()` in `c4-editor-actions.js` shows a refusal, and the instructions of Move and Add relationship in `c4-editor-canvas-editing.js` show as instructions. The words that reach the live region stay as they are.
- **Escape and dialogs.** In-place editors, choosers, and menus register with the editor's Escape order as popovers and menus; a pending tool or drag is the "Move" layer. The module listens for no Escape of its own in this host. Confirmations use `host.confirm`; forms are the editor's anchored forms and `<dialog>` elements inside its root, so they work in full screen.

### 7.6 Selection, outline, inspector, palette

- Selecting an option selects in the editor state: an element, a relationship, an interface, an environment's node, and a new kind, `{ scenarioId, step: { containerPath, index } }`, for which the scenario form reveals and marks the step's row. Selecting in the outline or a form focuses the option when the view draws it.
- The inspector's Position section and the toolbar's Reset layout work where a view holds layout: positions in code views, in interfaces views, and for top-level deployment nodes, and the lifeline order in dynamic views. For a box that holds no position the section shows the refusal's sentence instead of controls. The Members, scenario, node, and Interfaces forms stay the full keyboard path to every model change.
- Palette tiles come from the adapter's `tools()`: code: Class, Abstract class, Interface, Enum, then the line tools Generalization, Realization, Dependency; dynamic: Message and Fragment (a menu of the five); deployment: Node, Infrastructure node, Host a container or system, then the line tools Link between nodes and Relationship between hosted elements; interfaces: Provided interface, Use an interface. The disclosure of unavailable tools follows them (§5.6).
- The Dynamic and Deployment level buttons offer "New scenario…" and "New environment…" (the existing `addScenario` and `addEnvironment` commands), so an editable view can be reached without typing YAML. This closes the known gap named in `docs/c4-editor.md`.

### 7.7 Focus

| After | Focus goes to |
|---|---|
| Adding an element or a node | Its in-place name editor, then its option |
| Adding a step, a fragment, a relationship, a link, or an interface use | The first field of its anchored form; after confirming, the new thing's option; after Escape, the option or control that started it |
| Deleting | The next option in reading order, else the previous, else the canvas region |
| A move, a moved end, a reorder | The moved thing's option |
| A refusal | Stays where it was; the sentence is shown in the message region and announced |
| Accepting an offer | Where the offered action puts it: the first option of the opened view, the first field of the opened form, or the moved box's option; for a shown selection, its option when the view draws it, else where focus was before the message's buttons; the inspector is revealed |
| Dismissing a message | The option or control that had focus before the message's buttons |
| A redraw | The focused option, found again by its model id |
| Closing a form, chooser, or menu | The option or control that opened it |

Every focus move reveals its target inside the canvas scroll region and between the page's sticky bars (2.4.11). A reveal in the inspector (the step's row, the node's form) scrolls only the inspector's own scroll box, never the page or the canvas, so the focused option stays in view; a test checks it in the stacked layout.

### 7.8 Presentation

- `js/ArchUML/css/diagram-editor.css` owns the hit layer and its widgets. `css/tutorial-uml-editor.css` imports it and maps its custom properties, so the UML editor's computed styles do not change; `css/c4-editor-theme.css` maps them for the C4 editor. Each mapping keeps base, `html.dark-mode`, and `@media print` rules together.
- States are classes (refactor stage R4). No `style` attributes and no page-local `<style>`; values measured at runtime (a position, a size) are set through the CSSOM. No state is shown by opacity alone, and in the C4 editor every visible, operable control keeps at least 3:1 against its background in light and in dark mode.
- States drawn over the SVG (focus, selection, a possible target, a target that is not possible) have a non-colour cue, and focus rings are at least 2 px with non-scaling strokes (C4 spec §6.2). The canvas sits under the dark-mode invert filter, so each colour is checked after inversion.
- In-place editors, choosers, menus, forms, and the message region are HTML inside the editor root and outside the SVG, so the invert filter never touches them. They use the editor's `--c4-ui-*` tokens and inherit the paragraph size (`font: inherit`; `em` only; no `rem`).
- Print hides the hit layer, target marks, in-place editors, menus, choosers, and the message region, and prints the drawing light; exported SVG never contains any of them.
- Previews and snapping do not animate. Where the moved classic CSS has a transition, the system's or the site's reduced-motion preference removes it.

### 7.9 Performance

A drag moves SVG parts and never re-renders; the drop is one dispatch, one projection, one draw, also when a stale route is dropped (§6 rule 5). `targets` runs once per gesture; for a message it is one `stepEnds` call, which classifies a scenario twice whatever the model's size. The budgets of C4 spec §9.2 apply; a renderer test times the reference model's UML views with pins.

## 8. Tutorials

- **Can steps use it?** Yes, with no new YAML key. Wherever the C4 editor is editable, its UML views are. A step that opens `dynamic enroll` or `code of policy` gets an editable canvas.
- **Read-only steps** (`read_only: true`) show the listbox and navigation only, as today.
- **Locks** bind the canvas as they bind the forms (§5.1), and a lock refusal names the drawn thing. `locked_fields: [layout]` fixes a drawing.
- **Display modes** bind the canvas too. While a step withholds its checks (`on-request` before Check now, `after-submit` before Submit for review), the canvas shows which ends a step can have, as the scenario form's pickers do, and refuses the others with the general sentence only (§5.1). It gives no reason and no offer before the learner has asked for the checks.
- **Predicates are unchanged.** Grading reads `design.yml` through `ArchUMLC4.query`. No predicate reads `layout`, and none is added. A metamorphic content test asserts it: adding layout entries to every graded model changes no result.
- **Hints, Submit for review, cooldown**: unchanged.
- **Adapter.** `js/tutorial-c4.js` is unchanged: canvas edits arrive as the same splices under host undo.
- **Content.** Whether the two C4 tutorials need a change is a test result, not a claim of this document. The step that decides it is step 8 of the C4 tutorial (`failed-seat-hold`): novice profile, no locks, checks on request, and a lesson against declaring `seats → web`.
  - A new end-to-end test draws the message from the Seat Gateway to the Planner Web App on that step's canvas. It must be refused, with `step/not-available` before Check now and `step/no-relationship` after it, with no offer in either case, and with the design unchanged.
  - The content test and the hint-claim audit run again on models made on the canvas: the solution drawn as two replies inside the `alt` branch, and the seed with the teammate's draft pasted on the YAML surface, as the step instructs. The canvas cannot write that draft's invalid step; that is intended.
  - The alignment review decides whether the step's Repair instruction should name the canvas.
- **The UML tutorials** (`backend: uml-editor`) are untouched by the refactor: stages R0 to R6 change no behaviour, and `js/tutorial-uml-editor.js` is not edited. Stage A1 reaches them, because they use the same editor: they get the same ways into a move without a drag (§3.11). Grading reads the source text and does not change, and no YAML key is added.
- **Skill.** `tutorial-authoring` is updated in the same change: its C4 section says that UML views are editable, how locks and display modes act there, and that no key was added; its "Shared UML editor behavior" notes name the module, the adapter, and the forms that stay in the include.

## 9. Testing

Tests follow the `test-design` skill: named by behaviour, oracles on the spec and no further, partitions and boundaries, controlled time, and doubles only at ports we own (a fake adapter, a fake host).

### 9.1 Unit tests (Node; a renderer test adds Chromium)

| Subject | Oracle |
|---|---|
| Text adapter, per operation and diagram type | The replay: for each operation logged for the corpus, `apply(before, operation)` gives the recorded `after`, byte for byte. Two properties follow from the rewrites being pure and are asserted over the same operations: a refused operation returns no text, and a replay in a second fresh context gives the same bytes. Nothing is asserted about what a rewrite leaves untouched. Today's writes normalize the whole document (§3.6), so "bytes outside the changed lines stay" and "add, then remove, restores the text" are false for CRLF input and for inline `@pos` beside an `@layout` block, which the corpus contains on purpose. |
| The write-site map | Every assignment to the textarea in the include has an entry (R0); exactly one assignment remains (from R1). |
| `contents()` of the text adapter | For each published diagram on the site and each example: every layout id (`data-layout-id` or `data-layout-bounds-id`) and every route line the renderer stamps has an entry (run with the bundle's parsers, loaded as `js/uml-describe-cli.js` loads them). |
| Projection fields | Adding them changes no `toUml` text and no `describe` output on any shipped model. (The legend sentence of interfaces views changes in the same milestone, §6; the recorded outputs take that one replacement, sentence for sentence, and nothing is recorded again.) Per field: a lifted end keeps its declared element; a step left out of the drawing does not shift the positions after it; a derived path lists every relationship it merges. |
| `toUml` ids and source map | For every shipped model and view: text without a layout entry equals today's; every alias is in `ids`; every relation, message, and fragment line has an entry; the anchor rules of §4.1 at each boundary (first and last step, an empty branch, between `else` and `end`, nesting two deep). Metamorphic: renaming an unrelated element changes no other alias. No alias equals a listed keyword in any letter case. |
| Layout schema | Each part accepted and rejected per view type, including a position for a nested node, a route for an inheritance line, and a route or a lifeline order under an interfaces key (its positions are accepted); unknown ids ignored; every Change-id site rewritten; JSON Schema agreement. `toUml` of an interfaces view writes the layout block and `layout ports facing` when the entry holds a position, and today's text when it holds none. |
| Component renderer, `layout ports facing` (a renderer test: the bundle alone in Chromium, inside `npm run test:unit`) | The reference interfaces views with one box placed above, below, left, and right of its partner, and diagonally with the larger gap in each direction: the ball and the socket are on the facing sides (a side is read from the drawing: the edge of the box that the end of the line lies on); the line crosses neither box; each pinned corner is on its position. Boundaries: overlapping boxes keep the automatic sides; equal gaps follow the diagram's direction; a port with a position of its own keeps it. The control: without the directive a moved box keeps its ports' sides. The directive without a saved position draws the same SVG as no directive, over the component examples of `REFERENCE.md`, the routing fixtures, and every shipped interfaces view. |
| First-rename identity | For an element, a deployment node, and an interface: the first rename of a thing that still has its placeholder name and id gives it the id the core gives that name, in the same undo step; a second rename keeps the id; so does a thing that something refers to, a thing the open view is inside, and one whose id is locked. `changeNodeId` by the §4.9 oracles (renaming and renaming back restores the text), with one test for each place it rewrites and one for each refusal. |
| Moves without a drag (the module, with a fake adapter and a fake host) | A move started without a press and committed at a point builds the operation that a drag released there builds, compared field by field, for a box, a port, and one box of a multi-selection. `nudge` moves by exactly its step with snapping on, from a start off the grid; `commit` without an event; `cancel` applies nothing. A refused `can` starts nothing, and a redraw cancels; the redraw a commit causes cancels nothing, also when `apply` resolves after it. Bends: their numbering; a new bend on a straight line, in the longest of several segments, and at a given point; removing the only, the first, and the last bend; straightening. |
| New core commands and shared rules | The §4.9 oracles for each command; refusals by code. `stepEnds` gives the same ends as the old `validStepEnds` at every position of every shipped scenario, compared before the old function is deleted, and one reason code per partition. `inheritanceProblem` over every pair of code kinds. |
| C4 planner, per view | One test per row of §5.2 to §5.5: after executing the plan, the model facts the row states hold (through `ArchUMLC4.load` and `query`), and nothing else changed. One test per refusal: its code, and that no text changed. Partitions: declared and derived, inside and outside the scope, a lifted and a declared end, locked and free, each step status, checks withheld and released, novice and expert. Every `source.*` operation is refused. |
| Refusal table | Each code's short reason and sentence equal the reviewed table (the one place that pins wording); no sentence contains an arrow sign; every short reason fits one line. |

### 9.2 The gesture corpus and the byte-identity contract

- **What it is.** A set of scripted gestures per diagram type, stored as fixtures: start text, gesture, and the text, announcements, selection, and focus after it, after Undo, and after Redo. It is recorded once, at stage R0, from the editor before the refactor, and never re-recorded to make a stage pass. From R1 each gesture's logged operation is stored beside it.
- **How inputs are chosen.** Every operation of §3.4 for every diagram type that supports it, including the forms that stay in the include (Properties pane, class editing bar, sequence and line-model panels, callouts, CRC cards), and these boundaries: an empty document and one without `@enduml`; CRLF line endings; quoted ids and `::` names; a port named by its bare alias; inline `@pos` and a `@layout` block together; nested deployment nodes; nested fragments, an empty branch, the first and the last message; a connection that matches no single line; a multi-selection; two nudges inside the 600 ms window and one burst beyond its 3 s cap; typing followed by a gesture inside the 120 ms render debounce; a drag released outside the canvas, a drag cancelled with Escape, and a press outside an open menu; an edit after Undo; a source that fails to render, then Undo; switching the diagram type and back.
- **Coverage as a map.** At R0 the corpus runs with script coverage, and the write-site map (§3.10) records for each of the 103 assignments the gestures that reach it, or the reason none can.
- **Where it runs.** In Playwright against the real page at every stage (the contract of U1's text adapter), and from R5 in Node against the adapter alone.
- **Determinism.** The clock is controlled (`page.clock`, then `env.now`); no fixed waits.

### 9.3 End-to-end tests (Playwright)

- **Module contract** (a page built by the test, with a fake adapter): two sessions on one page do not share selection, tools, keys, or ids; the module reads and writes no storage, cookie, network, clipboard, or global beyond its two names; every change arrives as an operation and nothing else changes the page's document; a gesture with `targets` returning `null` shows no marks; `destroy` removes every listener and node.
- **C4 flows per view**, located by role and accessible name: keyboard only, single pointer only (no drag), and by dragging, for the main rows of §5.2 to §5.5; one undo step per gesture, in the standalone editor and in a tutorial (Monaco's stack); pins survive reload and appear in the embedded figure; a locked step and a read-only step.
- **Refusals are visible.** For a refused drop, a disabled menu item, a disabled palette item, and a press on a locked thing: the message region is visible and has the refusal's sentence; its offer button is reached and operated with the keyboard alone; Dismiss returns focus. The same holds in a C4-notation view for a refused delete of a locked element and for the instruction of Move mode (§14 D6). A table-driven DOM test passes every refusal of §5.1 through the editor's report path and requires its sentence in the region and, once, in the live region. The lock test also closes the open item "no end-to-end test covers a lock refusal on the visual surface".
- **Places without a drag.** For each row of §7.4 with a place: the keyboard-only and the pointer-only path put the result where the row says, and the announcement names the place. This includes the Position select of the step form, "Inside ‹node›" against "At the top level", and a new bend in the middle of the longest segment.
- **Nesting.** A nested node dropped beside its parent changes nothing and shows `layout/inside-node`; "Move to…" with "At the top level" moves it, and the undo label names the change.
- **What options say.** A call, a reply, an asynchronous message, and a delivery each say so in their option's description; a step in a branch names its fragment, branch, and guard; a derived path says that it is derived.
- **Overlaps.** In a view that holds positions, an element added by a click or by A overlaps no box; a class that grows over another raises the overlap notice and its offer works. Each other trigger of §6 rule 4 raises the notice once: a box dropped onto another, a return to automatic layout onto a pinned box, a box that first appears through an edit elsewhere (a lifted box in a code view, a top-level node added in the inspector), and a box of an interfaces view that grows when its balls and sockets turn. A pair already named is not named again on the next drawing.
- **Target marks.** While a message is drawn, possible and other lifelines carry their two shapes of mark in both themes.
- **Step 8** of the C4 tutorial, as §8 describes.
- **Interfaces positions.** A consumer moved below the subject by dragging, by "Move…" and a click, and with M, arrow keys, and Enter: after each, its socket is on its upper side and the subject's ball on its lower side, the line crosses neither box, the position is in `layout`, and the drawing made again from that model is the same. Moving a ball shows `layout/port`. A box that grows over a neighbour when its balls and sockets turn raises the overlap notice, and so does a consumer that appeared through an edit in another view. The Position section of a pinned box and Reset layout work as in a code view (§7.6); after Reset layout the view's text is today's again, without `layout ports facing`.
- **The interfaces test** that today asserts "Delete and F2 change nothing" is replaced in M7 by the rows of §5.5. Two things that existing C4 tests assert change, each because the behaviour does: this one, and the legend sentence of an interfaces view (three tests pin its words, §6).
- **UML editor, moves without a drag** (stage A1, on the built editor page).
  - "Move…" and a click give the source text that dragging the element to the same place gives.
  - The keyboard path gives the source text that the same arrow-key nudges of the focused element give, from a start off the grid, where a snapping path would differ. Until Enter the source does not change and the status line still reads "Moving …". With Shift and Snap checked, an arrow moves 1 px.
  - Each path is one undo step. Escape cancels and leaves the text unchanged. A port stays on its component's border.
  - A new bend lands in the middle of the longest segment, shows its number, and is placed with arrow keys and Enter; "Move bend n…", "Remove bend n", and "Straighten" each do what their name says, in one undo step. A sequence message's menu has no bend item.
  - Typing in the source, Undo, and switching the diagram type while a move runs each cancel the move and apply nothing.
  - Shift+F10 and the Menu key open exactly one menu, with focus on its first item, also when the browser sends its own context-menu event for these keys.
  - The "⋯" button opens the menu with one click, is no tab stop, and takes no press aimed at the item's box, ports, handles, or segments.
  - Print and the downloaded SVG show none of it. The accessibility checks run at each new state (the menu, a running move, bend numbers) in both themes at 320 and 1440 CSS px, and the button keeps its size at 50% and 200% zoom.
- **Accessibility**: `a11yCheckpoint` at each interactive state (a tool armed, Move mode, an in-place editor, a chooser, a refusal with an offer, a form) in both themes at 320 and 1440 CSS px; the focus table of §7.7, including that an inspector reveal leaves the focused option in view; target sizes; the print view shows no hit layer, no menu, and no message region.

### 9.4 A/B: the UML editor stays as it is

The gate of every refactor stage, and of stage A1 with the exception in point 5:

1. Every suite that drives the UML editor passes with **no change to its file** (`git diff` on it is empty), and `js/tutorial-uml-editor.js` is unchanged. The list is derived, not written down, so it cannot drift: `scripts/uml-editor-gate.js` (new, tracked) collects every file under `tests/` and `scripts/tests/` that matches `uml-pg-`, `tools/uml-editor`, `uml-playground`, `uml-editor.html`, `UMLTutorialEditor`, or a `uml-editor` backend fixture, adds `tests/uml-renderer.spec.js` for the bundle, prints the list, and runs it.
   - On the tree of 2026-11-12 the search finds 22 files (27 on 2026-11-13; the list is derived, so its length is no contract): `uml-visual-layout-editor` (152 tests, input map), `uml-editor-integrity-regressions` (50), `-semantics-regressions` (13), `-review-regressions` (14), `-student-flows` (13), `uml-behavioral-editor-regressions` (10), `uml-editor-alignment` (5), `uml-editor-callouts` (24), `uml-callouts` (11), `uml-class-member-edit`, `uml-class-quick-edit`, `uml-fragment-edit`, `uml-fit-editor`, `uml-fit-view`, `uml-homework-export`, `uml-homework-grading` (the spec and the unit test), `uml-readable-sizing`, `tutorial-confirmations`, `tutorial-browser-fullscreen`, `crc-editor`, and `tutor-hints`.
   - Revision 1's hand-written list missed the last two. `crc-editor.spec.js` opens both editor pages, and CRC cards have write-back paths of their own (`stripLayoutMetadata`, `readLayoutPositions` through `UMLCRCDiagram.parse`, `replaceCrcCard`) that the text adapter must keep. `tutor-hints.spec.js` mounts `uml-editor` backend fixtures.
   - Failures that exist at R0 are recorded there and reported, not fixed (PR-5).
2. The corpus matches.
3. Computed styles of the hit layer's states are unchanged on the UML editor page (assertions on CSS properties, both themes); this is the evidence for stage R4.
4. No new console error on the three pages that include the editor.
5. From stage A1 on, point 1 has the one exception of §3.11: an accepted change to an assertion that stated the absence the stage removes. The gate lists every accepted change with its reason. Point 2 has no exception: the corpus is never recorded again for this work.

### 9.5 Audits

`tests/wcag22-complete-audit.spec.js` filtered to the UML editor, the playground, a UML tutorial, the C4 editor page, and both C4 tutorials; a full sweep at the last milestone; `tests/wcag22-print-audit.spec.js` and `tests/print-light-theme.spec.js` for the C4 editor page and a C4 tutorial's print view; `npm run test:unit`; the static-plugin test with pinned fixtures; `tests/ai-training-opt-out.spec.js` (no built page is added). From stage A1 the audit of the UML routes includes `/shortcuts/`.

**A/B run for the bundle and the legend.** The A/B guard of the routing redesign (its §10; `scripts/tools/c4-routing/ab-compare.js`) renders every diagram of a corpus with the ArchUML of before and of after and compares the drawings byte for byte, live at three widths and as the static prerender. For this work it must end with 0 differences on the component corpus (every UML component diagram on the site) and on the deployment corpus. On the C4 corpus it must end with 0 differences once the legend sentence is left out of the comparison, apart from drawings whose alias was a keyword (§4.1), which the run lists by name.

## 10. Milestones

Each ends with its gate green. Gates are local (CI runs no tests).

| | Milestone | Gate |
|---|---|---|
| M0 | R0: corpus, baseline, write-site map | Corpus recorded; the map is complete and its test passes |
| M1 | R1 to R4, all inside the include: one writer; one reader and one owner per state; gesture sessions; presentation in CSS | §9.4 |
| M2 | R5 and R6: the module in the submodule; two instances | §9.4; §9.1 text adapter; §9.3 module contract; audits of the UML routes |
| M2b | Stage A1 (§3.11): the module's moves without a drag, and the UML editor's ways into them | §9.4 with its point 5; §9.1 moves without a drag; the UML editor tests of §9.3; audits of the UML routes and `/shortcuts/` |
| M3 | Core groundwork (§4): projection fields, source map, keyword-safe aliases, layout parts, commands (with `changeNodeId`), shared rules, the reworded legend; the bundle's `data-layout-ignore` and `layout ports facing` | `npm run test:unit`; the A/B run of §9.5; C4 display specs and static equals live unchanged, except the legend sentence and drawings whose alias was a keyword |
| M4 | Host seam (§7.1 to §7.3, §7.5 to §7.8): the delegated drawing, the generalized overlay with the interfaces view in its read-only mode, the gesture factories on the dispatcher, the message region; and the **code view** | Planner and e2e tests for §5.2; the visible-refusal tests; C4 editor specs unchanged; audits |
| M5 | **Deployment view** | The same for §5.4 |
| M6 | **Dynamic view** | The same for §5.3; the step 8 test |
| M7 | **Interfaces view**, with movable boxes; the read-only listbox goes | The same for §5.5; the changed interfaces test; the interfaces positions tests |
| M8 | Tutorials, documents, skills, inventories (§8, §15) | Tutorial specs; the content test and hint-claim audit with canvas-made models; full WCAG sweep; print audit |

M0 to M2 change no behaviour and can ship alone. M2b follows M2 by the user's decision (§14 D5); it is the UML editor's only behaviour change in this work, and M4 builds the C4 surface's Move mode and bend menu on what it adds to the module. M3 changes no drawing that is right today; it changes one sentence of text under every interfaces figure (the legend, §6). The views are ordered by how close they are to what the module already does: class boxes and members first, sequences with their anchors third, the derived-heavy interfaces view last. M5 starts from the layout limits of §4.2 and M7 from the bundle change of §6, so their pinned fixtures cannot record a broken drawing as expected output.

The two bundle changes are listed under M3 because the C4 work needs them. The plan makes them first, before the gesture corpus is recorded, so that the corpus sees the bundle it will run on.

## 11. Risks

| Risk | Mitigation |
|---|---|
| A 13,866-line file with about 300 browser tests (input map) drifts in timing or focus while it is taken apart | Seven stages; the corpus records text, undo, announcements, selection, and focus; R1 to R4 change statements only by a stated recipe, and R5 only moves |
| The split of about 60 write-site functions goes wrong in a case the corpus does not reach | The write-site map names the gestures behind every assignment; a site no gesture reaches is listed with its reason and reviewed by hand |
| The existing tests bind ids and class names | Both are kept as defaults; the gate forbids editing those tests, and its list is derived by search |
| Two interaction grammars (classic and C4) drift apart | They share scene, commands, and gestures; only roles, keys, and modes differ, and §7.4 is tested |
| The source map and the renderer's line-based ids disagree | A property test over every shipped model and generated models resolves every stamped id through the map |
| Anchors in nested fragments are off by one | Boundary tests at each anchor rule; step positions come from the model's lists, not from the drawn items |
| The renderers do not support what a layout entry asks for | §4.2 keeps only what the probes showed to draw correctly; the limits are refusals with sentences, and each can be lifted by a bundle change without touching the module, as revision 3 did for the positions of an interfaces view |
| Pinning every box makes `layout` long, and a learner's pins can print below 9 pt | Only on the first move; Reset layout; shipped models are gated |
| A canvas refusal gives away what a tutorial step asks the learner to predict | Withheld checks withhold the reason and the offer (§5.1); the step 8 test |
| New learner sentences contradict the chapter, or state a schema limit as a rule of C4 | "This design model" wording; alignment review (CP-4); codes, not wording, in tests |
| The message region changes the layout of every C4 editor | It keeps one line's height at all times in an editable editor and none in a read-only one; the C4 editor specs and audits run in M4 |
| Two repositories change | Every summary names both and the submodule state; one manifest per script list with a load test |
| The inspector's splice-kit edits and `validStepEnds` move to the core | Each move keeps the existing inspector tests; a differential test compares old and new step ends before the old function goes |
| The component renderer changes for `layout ports facing`, and it draws every component diagram on the site | The directive is opt-in and acts only with saved positions; the A/B run must show 0 differences on the component, deployment, and C4 corpora; the renderer test checks each relative placement; the plan changes the bundle before the gesture corpus is recorded |
| A box of an interfaces view changes size when its balls and sockets change sides, and lands on a neighbour | Its corner stays on its position; rule 4 of §6 names the overlap and offers a free place |
| Stage A1 changes the UML editor under suites that must not change | It adds ways in and changes no existing gesture; the corpus must still match; one kind of test edit is allowed, listed, and recorded (§3.11) |
| A learner starts a move without a drag and then types in the source | A redraw cancels the move, applies nothing, and says so (§3.11); a test |
| The legend's new sentence changes text under every interfaces figure, and three tests pin the old words | One sentence; the three tests change with it; the alignment review (CP-4) reads it |
| `changeNodeId` misses a place that names the node | The §4.9 oracles and one test for each place (§9.1) |

## 12. Non-goals

- No change to what the UML editor does through stages R0 to R6, and after them only stage A1 (§3.11); its other known gaps stay (§13). No new diagram type.
- No build step, bundler, framework, or TypeScript.
- No editing of generated ArchUML text in the C4 editor. "Copy ArchUML source" stays an export.
- No new C4 notation, schema field outside `layout`, predicate, hint condition, tutorial key, or storage key.
- No bends of the lines between balls and sockets and no positions of balls and sockets in interfaces views; no positions for nested deployment nodes and hosted instances; no bends of inheritance lines; no label or port pins.
- The UML editor does not write `layout ports facing`: a component diagram moved there behaves as today. A learner can type the directive.
- No "Change id…" control for deployment nodes; `changeNodeId` serves the first rename only.
- No activation bars, notes, callouts, or lost and found messages in C4 views.
- No multi-selection in the C4 editor.
- No change to how C4-notation views are edited, placed, or routed. The one shared addition is the message region (§7.5), which also shows their refusals and mode instructions.
- No change to the bundle's renderers beyond one skipped attribute (`data-layout-ignore`) and the component renderer's `layout ports facing` (§6), which changes no drawing that lacks the directive.
- The Properties pane and model panels of the UML editor are not redesigned and stay in the include.

## 13. Pre-existing issues noticed

Reported here; fixed only where a line says so.

- **WCAG 2.5.7 in the UML editor.** Moving an element has a keyboard path (arrow keys) but no single-pointer path without dragging; moving a route bend has neither. Stages R0 to R6 keep this behaviour, because they change none. Stage A1 closes both gaps (§3.11; decided, §14 D5). The C4 surface never had them (§7.4). C4 spec §16 lists the first half and adds that the `wcag-aa-compliance` skill words 2.5.7 as if a keyboard path were enough; both are corrected with this work (§15). The classic surface's other drags were not audited; stage A1 lists them and reports any without a path (§3.11).
- **WCAG 3.3.1 and 3.3.3 in the C4 editor's C4-notation views.** Refusals (`refuse()` in `c4-editor-actions.js`) and the instructions of Move and Add relationship (`c4-editor-canvas-editing.js`) reach only the screen-reader-only live region (`createAnnouncer` in `c4-editor-dom.js`); sighted learners get no text. Fixed in M4 (decided, §14 D6): both go through the message region of §7.5 (two call sites and their tests).
- **Keyword ids break generated sequence text.** `aliasing()` in `c4-uml.js` only replaces characters, so an element whose id is a sequence keyword loses its messages (probe). Fixed in M3 (§4.1), because the editable dynamic view makes the case easy to reach.
- **The core accepts generalizations and realizations that are wrong in UML** (a class that implements a class). From M3 the edit commands refuse them (§4.3). Hand-written YAML is still not flagged; a check rule would be a separate change.
- **Lock refusals without a subject.** A locked step, node, or layout entry reads "Locked: given by the task, so it cannot be changed here." Fixed in the shared function (§5.1).
- **Three renderer limits** (probes): a pinned component keeps its balls and sockets on their old sides; a pinned nested deployment node can be drawn outside its parent; generalization and realization lines carry no route id. The first is lifted for documents that carry `layout ports facing` (§6; decided, §14 D3); a component diagram without the directive keeps it. The other two are not changed here; §4.2 keeps away from them.
- **The legend of an interfaces view points at a place** ("In the middle: …"), which says nothing to a reader who does not see the layout (WCAG 1.3.3). Reworded in M3 (§6).
- **Stored bends in the UML editor can end inside a box** after the box grows. The classic behaviour is unchanged; the C4 drawing drops such a bend (§6).
- The include adds listeners on 174 lines and removes them on 30; one pointer pair and one key listener live for the page. Harmless for one instance; stages R2 and R3 give them an abort signal and a session's lifetime because two instances need it.
- The include assigns to `style` on 77 lines; some are static presentation (a dragged palette button dimmed to 0.6 opacity, the connect handle's plus sign), against the style-ownership rule of `CLAUDE.md`. Stage R4 moves those to classes without changing their look. Whether a dimmed control meets 1.4.3 and 1.4.11 in the UML editor is not judged here.
- The inspector writes fragment guards, branches, and node collaborators with its splice kit, not through core commands, against ED-4's "one implementation". §4.3 lifts them.
- `c4-editor-actions-shared.js` calls the relationship move a batch "until the core has `moveRelationship`", while decision ED-5 records a core command. The code and the record disagree.
- `c4-editor-canvas.js` rewrites the document's `view:` line to make the renderer draw a UML view (`textShowingView`). §7.1 removes the need.
- `docs/c4-editor.md` lists that no visual command creates the first scenario or environment. §7.6 adds them.
- A class in a code view is drawn under its alias, so "Billing System" reads "Billing_System". The drawn text is unchanged by this design; the in-place editor says so (§7.4).

## 14. Decisions taken with the user, 2026-11-13

Revision 2 ended here with seven questions. The user answered them on 2026-11-13 (`inputs.md` in the session notes). Each answer is recorded with what it changes; the numbers are those of the questions.

| | Question | Decision | Where it is built |
|---|---|---|---|
| D1 | Identity: does an id follow every rename, or only the first rename of something added on a canvas? Does that cover deployment nodes and interfaces? | **The first rename only.** Something just added on a canvas, which still has its placeholder name and id, takes its id from its first rename; every later rename keeps the id. This holds for elements, deployment nodes, and interfaces. It confirms final review I6 of the C4 spec, which was waiting for this answer in `docs/c4-decisions.md`. | §5.1; `changeNodeId` in §4.2 and §4.3; §5.4, §5.5; §9.1 |
| D2 | Dynamic view: no shortcut from a refusal? | **Accepted as written.** Novices get no offer to declare a relationship; a reply may offer to add its request; the expert profile keeps the declare offer, behind the form that asks the structural question. | §5.3, unchanged |
| D3 | Interfaces view: positions? | **Movable boxes.** The shared component renderer chooses the sides of balls and sockets after positions are applied, behind a layout directive, so that existing component diagrams stay as they are; the legend is reworded; the interfaces view holds positions like a code view. | §4.2, §5.5, §6, §9.1, §9.3; the A/B run of §9.5 |
| D4 | Deployment view: only top-level nodes hold positions? | **Accepted as written** for this version. | §4.2, unchanged |
| D5 | Should the UML editor get moves without a drag? | **Yes.** The standalone UML editor gets the same "Move…" and a click, and the same bend menu (WCAG 2.5.7), with tests of its own. It is a behaviour change. | §3.11, §9.3, §9.4, §10 |
| D6 | C4-notation views: visible refusals? | **Yes.** The message region also shows their refusals and mode instructions. | §7.5, §9.3, §13 |
| D7 | Unavailable tools: listed, or hidden? | **Accepted as written**: listed, disabled, with a one-line reason, in a disclosure after the available tools. | §5.6, unchanged |

Two points the answers leave to this design. They are decided here and are the first things to correct if the user meant otherwise:

- **D3 says "positions like a code view".** The boxes hold positions. The line between a ball and its socket holds no bend, and a ball or socket no position of its own: the renderer draws that line in two numbered parts and chooses its ends from the places of the boxes (§4.2), so a stored bend would hold a line whose ends move with every box. `layout/assembly` and `layout/port` stay, with sentences that say what to move instead.
- **D1 adds `changeNodeId` for the first rename.** A deployment node gets no "Change id…" control in this version, while elements and interfaces have one. After its first rename a node's id changes only in the YAML.

## 15. Changes to other documents and inventories

| Document | Change |
|---|---|
| C4 spec §3 module map | The diagram-editor units, the C4 adapter files, and the message region |
| C4 spec §4.8 | Layout entries of UML-notation views (§4.2 here), with what cannot hold a position or a bend |
| C4 spec §4.10 | The first-rename rule, confirmed and extended to deployment nodes and interfaces (§5.1 here); `changeNodeId` and the places it rewrites; references in the new layout parts |
| C4 spec §5.2, §5.3 | The fields the projection adds (§4.1 here) |
| C4 spec §6.3, §6.6 | `toUml` returns `ids` and `source` for every UML view; the layout block; aliases are never keywords; the deployment editor no longer refuses nesting edits in C4. In §6.6: an interfaces view with positions carries `layout ports facing`; "consumers above, the element in the middle, providers below" describes its automatic layout only; the legend names the subject and no place |
| C4 spec §9.1, §9.2, §9.5 | The message region in the editor's DOM order, and that it shows the refusals and mode instructions of C4-notation views too; options, descriptions, keys, target marks, and the table of §7.4 for UML views; a double-click edits and Enter opens in UML views; `interfaces of` is editable and its boxes can be moved; Position and Reset layout where a view holds layout; the new selection kind |
| C4 spec §9.3 | What the canvas says while checks are withheld |
| C4 spec §13, §16, §17 | The tests of §9; the issues of §13, where §16's UML editor item closes with stage A1; an entry for this change |
| `docs/c4-editor.md` | Loading the diagram-editor scripts; the UML-view contract; the message region; the known gap closed |
| `docs/c4-decisions.md` | New entries: the module and its adapters; the layout shape and its limits; no declare shortcut from a refusal; the C4 surface; the message region. **ED-3 is amended**: the interactive layer stays an overlay, and the renderer gains `renderDelegatedView`, draws layout-bearing `toUml` text, and no longer serves a read-only interfaces view. **ED-4 is amended**: every drag is one session on the one dispatcher; sessions for C4-notation views are built in `c4-editor-drag.js`, and sessions for UML-notation drawings by the diagram editor's gesture factories. The open item about a lock refusal test closes. From revision 3: the first-rename rule is confirmed, so its item under "Decisions to confirm" closes, and it extends to deployment nodes and interfaces; `layout ports facing` and the positions of an interfaces view, with the open item "Interfaces view" brought up to date; stage A1; visible refusals in C4-notation views. From revision 3.1: PR-1 records the user's direction of 2026-11-13 that the controller commits and pushes both repositories after the final review, while lane agents still never commit. |
| `js/ArchUML/REFERENCE.md` | The layout parts in the C4 section; `data-layout-ignore`; `layout ports facing` in the component section; the interfaces view's order as its automatic layout, and its new legend sentence |
| `c4/schema/1/design.schema.json` | The layout parts |
| Skills | `tutorial-authoring` (§8, and stage A1 in its notes on the shared UML editor); `diagrams` (C4 UML views are editable in the editor; the picture is still edited through the model); `wcag-aa-compliance` (2.5.7 asks for a single-pointer path without a drag, and a keyboard path alone does not meet it; four places in the skill word it as if it did) |
| `shortcuts.html` | The C4 editor section's wording for steps, lifelines, and bends; no new key there, so no new row. The "UML visual editors" section gains rows for Shift+F10 or the Menu key on a diagram item and for the keys of a running move (stage A1). The "Conflicts with browser and operating system shortcuts" paragraph gains one sentence: on a focused diagram item of the UML editors, Shift+F10 and the Menu key open the item's own menu in place of the browser's context menu, as a right-click there does. |
| `_includes/uml-editor.html` (stage A1) | The Move tip of the help banner and the preview's help text name the menu path beside dragging |
| `_data/glossary.yml`, `cookies.html` | No change: no new abbreviation and no new storage |

## Sources read for revision 2

Skills, each `SKILL.md` in full: `c4-model`, `responsibility-driven-design`, `software-architecture`, `maintainable-code`, `test-design`, `wcag-aa-compliance`, `light-dark-mode`, `print-light-mode`, `keyboard-glossary-tracker`, `diagrams`, and `tutorial-authoring`. The references each routes this task to:

- `c4-model`: `references/notation-and-views.md`, `references/methods-and-theory.md`; a keyword search of `references/edge-cases.md`.
- `responsibility-driven-design`: `references/index.md`, `references/practice/collaborations-and-control.md`, `references/practice/reliability-and-contracts.md`.
- `software-architecture`: `references/index.md`, `references/tasks/design.md`, `references/quality/modifiability.md`, `references/quality/testability-usability.md`, `references/views/module.md`, `references/views/interfaces-behavior.md`, `references/views/c4-crosswalk.md`.
- `maintainable-code`: `references/javascript.md`, `references/refactoring.md`, `references/decision-protocol.md`.
- `test-design`: `references/playwright.md`.
- The other six skills have no separate references.

Not read, because no route of this task leads there: the other references of `c4-model` (among them foundations, tooling, model format, and review), of `responsibility-driven-design` (among them the design and review workflows, foundations, adaptation, and examples), of `software-architecture` (among them methods, styles, lifecycle, and sources), and of `maintainable-code` (clean code, design principles, modularity, architecture).

Documents: the input note and both review notes in full; revision 1 of this document in full; the C4 spec (§1, §3, §4.3 to §4.10 and the start of §4.11, §5, §6, §9, §10, §11, and §13 to §17); `docs/c4-editor.md` in full; `docs/c4-decisions.md` (the introduction, SC-5 to SC-10, SC-14, RR-3, RR-6 to RR-8, RR-14, ED-1 to ED-9, CP-4, CP-5, AP-1 to AP-4, PR-1 to PR-5, and the open items); `CLAUDE.md`.

Code, read only:

- `_includes/uml-editor.html`: the declarations of `init()`, undo and redo, the layout write-back, every assignment to the textarea with its function, the host panels' rewrites, deployment nesting, route resolution, Reset Selected, the document-level listeners, and the `style` assignments. The counts of §3.1 were measured again.
- `js/ArchUML/uml-bundle.js`: layout metadata and the layout block, `applyLayoutPositions`, `applyLayoutRoutes`, the route and obstacle collectors, the box lookup, the class renderer's inheritance groups and route attributes, and where the component and deployment renderers apply positions.
- `js/ArchUML/c4/`: `c4-uml.js` in full; `c4-projection.js` (step classification and the three UML projections); `c4-model.js` (relationship ids); `c4-checks.js` (`extends` and `implements`).
- `js/ArchUML/c4/editor/`: `c4-editor-pointer.js`; `c4-editor-canvas.js` (the overlay and the drawing); `c4-editor-overlay.js` (components, options, the "⋯" button); `c4-editor-dom.js` (the announcer); `c4-editor-actions.js` (`refuse`); `c4-editor-state.js` (dispatch and locks); `c4-editor-canvas-editing.js` (mode announcements); `c4-editor-inspector-scenarios.js` (`validStepEnds`); `c4-editor-toolbar.js` (tiles).
- `_data/tutorials/c4.yml`: step 8 with its tests and hints, and the tutorial's profile, locks, and display modes.
- `tests/c4-editor-interface-views.spec.js` (the read-only assertion), and a search of `tests/` and `scripts/tests/` for the files that drive the UML editor.

The probes cited in this document were run by the code review, not repeated here.

## Sources read for revision 3

Skills, each `SKILL.md` in full: `c4-model`, `responsibility-driven-design`, `software-architecture`, `maintainable-code` with `references/javascript.md`, `test-design` with `references/playwright.md`, `wcag-aa-compliance`, `diagrams`, `keyboard-glossary-tracker`, and `writing-plans`.

Documents: `inputs.md` with the user's answers and the controller's ruling; this document and its plan in full; the C4 spec §4.8 to §4.10, §6.6, §9.2, and §16; `docs/c4-decisions.md` (PR-1 to PR-5 and the open items); the routing redesign §10; `scripts/tools/c4-routing/README.md`; `js/ArchUML/REFERENCE.md` (the component section).

Code, read only:

- `js/ArchUML/uml-bundle.js`: the layout directives and the layout block, `applyLayoutPositions` with its port handling, and the component renderer's `parse`, `computeLayout` (where port sides are chosen), `facingStackPorts`, `alignFacingStackPorts`, and `render`.
- `js/ArchUML/c4/`: `c4-uml.js` in full; `c4-describe.js` (the legend sentence); the interfaces projection of `c4-projection.js`; `c4-edit-sections.js` (nodes), `c4-edit-interfaces.js` (ids), and `c4-edit-references.js` (reference sites).
- `js/ArchUML/c4/editor/`: `c4-editor-actions-ids.js` in full; the node form of `c4-editor-inspector-deployment.js`; the Name field and the id field of `c4-editor-interfaces-form.js`; how `c4-editor-inspector.js` hands the shared actions to its forms; the Move mode of `c4-editor-canvas-editing.js`; `c4-editor-actions-canvas.js` (tiles).
- `_includes/uml-editor.html`: the layout select and write-back (`isLayoutModeDirective`, `applyLayoutDirective`, `stripLayoutMetadata`, `writePositionsIntoSource`, `declarationIdForLine`), the context menus, the key handlers of the diagram items, the route editor and the route branch of `updateDrag`, and the toolbar and help markup. `shortcuts.html` (the UML visual editors section).
- Tests: `scripts/tests/uml-component-render.test.js`, the menu and toolbar assertions of the UML editor suites, `tests/c4-editor-interface-views.spec.js`, and `scripts/tools/c4-routing/ab-compare.js`.

Probes of 2026-11-13, read-only, with the real bundle in headless Chromium: the reference view `interfaces of api` without positions, with every box pinned, with the consumer pinned below and right of its provider, and with the line `layout ports facing` on today's bundle. They gave the three statements marked "(probe, revision 3)". The A/B guard's `count` gave the corpus sizes (89 component sources, with the tool's pinned numbers matching).

## Sources read for revision 3.1

Skills, each `SKILL.md` in full: `c4-model`, `responsibility-driven-design`, `software-architecture`, `maintainable-code` with `references/javascript.md`, `test-design` with `references/playwright.md`, `wcag-aa-compliance`, `diagrams`, and `writing-plans`.

Documents: `inputs.md` (with the 2026-11-13 answers, the wave-gate ruling, the commit rules, and the Withdrawn section, which this revision does not apply), `progress.md`, the two review-3 notes (`review3-code.md`, `review3-decisions.md`), the commit manifest's notes and its re-verification section, this document and its plan in full, and `docs/c4-decisions.md` (PR-1 and the open items).

Code, read only, on the trees of 2026-11-13 (site `6bff04b4` on `fix/state-page-uml-test`, ArchUML `939e129` on `fix/uml-routing-and-theme-rerender`, both with the uncommitted C4 work):

- `_includes/uml-editor.html`: the two pairs of listeners that share a name (`btn:click`, `rmBtn:click`), the snap box, the arrow-key nudge of a diagram item, `nudgeElement`, the snapping of `updateDrag` and of its route branch, the Liquid tag, and the starting line of every function §3.2 names.
- `js/ArchUML/c4/editor/`: `c4-editor-actions-ids.js`, how `c4-editor-actions.js` publishes the shared actions, the node form's and the interface form's Name fields and kits, the placeholders of `c4-editor-actions-canvas.js`, and the key steps of `c4-editor-canvas-editing.js`.
- `js/ArchUML/c4/`: `addInterface` and `changeInterfaceId` in `c4-edit-interfaces.js`; `interfaceDependentsOf` and the view-selector sites in `c4-edit-references.js`.
- Elsewhere: the helpers of `scripts/tests/uml-component-render.test.js`, the script loading of `_layouts/sebook-combined.html` and `_includes/c4-editor-scripts.html`, the sections of `shortcuts.html`, and ArchUML commit `939e129` (its theme re-render queue).

No probe was run for this revision.

## Revision log

**Revision 3.2, 2026-11-21 (release, plan Task 48).** The design was built. This revision brings the text up to the built code where a ruling or a task changed it, and records the rest in `docs/c4-decisions.md` (UV-1 to UV-16, RR-15).

| Source | What changed | Where |
|---|---|---|
| Ruling RR-11 (2026-11-15) | A dropped stale bend costs no second drawing: `renderDelegatedView` draws once inside the bundle's opt-in `UMLShared.renderSkippingDetachedRoutes`, and the bundle's orthogonal router became faster with the same output (RR-15; routing spec §8). | §6 rule 5, §7.9 |
| Task 42b | Host-action offers are named by their key (`view`, `select`, `commands`); accepting a `select` offer focuses the shown selection's option when the view draws it, else focus returns, and the inspector is revealed. | §3.4, §7.7 |
| Task 42c | The palettes of code and deployment views list their line tools after the element tools. | §7.6 |
| Task 44 | A new step along a relationship starts with the words of a step the scenario already has between the same two elements, else with the relationship's description. | §5.3 |
| Task 2b | "Straight where the boxes overlap" holds, for boxes beside each other, where both can hold a port at one height; the line of an assembly stays out of both boxes from a gap of 46 units. | §6 |
| Plan Global Constraints | When the document is read (once per `sync` for the scene, again by a command for its operation). | §2.1 |

Not changed here, and recorded in `docs/c4-decisions.md` instead: the operation fields, refusal codes, part names, host services, and planner conventions the tasks added beyond §2.4, §3.3, §3.4, and §5 (UV-15), the additions the plan made (UV-9), and the open items (an `action` plan's missing post-action message, `findRenderedBox` with overlapping classes, and others).

**Revision 3.1, 2026-11-13.** The third review checked revision 3 and its plan against the code and against the user's decisions (`review3-code.md`, `review3-decisions.md`: 36 findings, numbered as the review task lists them). Most findings are about the plan; the plan's revision 3.1 answers all of them. This document changed where a finding showed a gap or an ambiguity in the design itself.

| Findings | What changed | Where |
|---|---|---|
| 7, 24 | Inside a move without a drag, `nudge` moves by exactly its step and never snaps, as today's arrow-key nudge; `follow` and a commit at a point snap as a drag does; `commit()` writes where the preview is. The move takes the arrow keys and Enter before the item's own nudge, and the source changes only on Enter. The keyboard oracle is today's nudges, from a start off the grid; Shift moves 1 px with Snap checked. The C4 host's steps (10 and 50 units) are exact too. | §2.4, §3.11, §7.4, §9.1, §9.3 |
| 11 | One key press opens one menu, also where Windows and Linux browsers send a context-menu event for Shift+F10 or the Menu key; `shortcuts.html`'s Conflicts paragraph gains a sentence. | §3.11, §9.3, §15 |
| 12 | The redraw a move's own commit causes cancels nothing, also when `apply` resolves after it. | §3.11, §9.1 |
| 13 | The "⋯" button sits beside its item, outside every other hit target; in the C4 host a line's button sits beside the middle of its longest segment, not on it. | §3.11, §7.4, §9.3 |
| 34 | Bend items appear only on lines a segment drag bends; a sequence message has none. | §3.11, §9.3 |
| 33 | Undo and switching the diagram type during a move are tested beside typing. | §9.3 |
| 6, 28 | Overlap rule 4 is one check after every drawing, which catches all five triggers; each trigger has a test. | §6, §9.3 |
| 1, 18 | The interfaces-positions tests include the Position section and Reset layout. (Every other D3 statement here was already right; the plan's Task 46 was not.) | §9.3 |
| 3, 26 | Static equals live also compares where the balls and sockets of the pinned interfaces fixture sit. | §6 |
| 5 | The write-site map keys an assignment by its chain of named functions, because two pairs of listeners share a name. | §3.10 |
| 14 | A second load of the diagram-editor scripts on one page keeps what the first registered. | §2.2 |
| 2, 19 | The first-rename rule names the infrastructure node's placeholder. (The plan's Task 35 now builds the rule for nodes and interfaces.) | §5.1 |
| 17 | Line numbers and counts of `_includes/uml-editor.html` brought up to the tree after the user's pull (13,866 lines; `appendRawLine` at 5603, outside the range revision 3 cited). | Line-number note, §3.1, §3.2, §11, §13 |
| 35 | Lane agents still never commit; the controller commits and pushes both repositories after the final review, by the user's direction of 2026-11-13; PR-1 records it. | Header, §15 |
| 9 | The line-number note names the tree it refers to. Both repositories moved after `inputs.md` was written; the plan has the controller confirm the trees with the user before the waves start. | Line-number note |

The other findings (4, 8, 10, 15, 16, 20 to 23, 25, 27, 29 to 32, 36) change only the plan.

**Revision 3, 2026-11-13.** The user answered the seven questions of §14. The answers to questions 2, 4, and 7 accept revision 2 as written; the other four change the design.

| Answer | What changed | Where |
|---|---|---|
| D1: an id follows the first rename only, for elements, deployment nodes, and interfaces | The identity rule is written out with its four conditions and one shared rename action for each kind; `changeNodeId` joins the core's commands, with the layout sites it rewrites; the node form's and the interface form's Name fields use the shared actions; tests for the first and for a later rename. | §4.2, §4.3, §5.1, §5.4, §5.5, §9.1, §11, §12, §15 |
| D3: the boxes of an interfaces view can be moved | `positions` is a part of interfaces views. The bundle's component renderer gains `layout ports facing`, which chooses the sides of balls and sockets after positions are applied and changes no drawing without the directive. `toUml` writes it with the layout block. `layout/fixed-order` is gone; the sentences of `layout/assembly` and `layout/port` say what to move. The legend names the subject instead of a place. A box that appears through an edit elsewhere, and one that changes size when its ports turn, come under the overlap rule. An A/B run over the component, deployment, and C4 corpora and a renderer test are the evidence. | §0, §2.6, §4.2, §5.1, §5.5, §5.6, §6, §7.6, §9.1, §9.3, §9.5, §10, §11, §12, §13, §15 |
| D5: the UML editor gets moves without a drag | Stage A1 after R6: the module gains a move without a press and bend commands, shared by both surfaces; the classic surface gains "Move…", the bend menu, a "⋯" button, and Shift+F10; the gate allows one listed kind of test edit; the corpus is not recorded again. The C4 surface's Move mode and bend menu steer the same module code. | §0, §2.1, §2.2, §2.4, §3.10, §3.11, §7.4, §9.1, §9.3, §9.4, §9.5, §10 (M2b), §11, §12, §13, §15 |
| D6: refusals are visible in C4-notation views | No longer conditional: the two call sites go through the message region in M4, with their tests. | §7.5, §9.3, §12, §13, §15 |
| D2, D4, D7 | Recorded; nothing changes. | §5.3, §14 |

Added while revising, beyond the answers: the legend's old wording is listed as a pre-existing issue (§13); the count of suites the gate finds is given for 2026-11-13 as well (§9.4); two points the answers leave open are decided and named for correction (§14).

**Revision 2, 2026-11-12.** Findings 1 to 11 and 22 to 30 come from the code review, 12 to 21 and 31 to 34 from the learner and accessibility review. Where a row names §14, it means the questions that section held then; revision 3 replaced them by the decisions.

| # | Severity | What changed | Where |
|---|---|---|---|
| 1 | critical | A state-ownership table. A raw-source operation family that only the text adapter serves and the C4 adapter refuses, and structured operations for the other host-form edits. All 103 write sites listed by function and mapped to an operation or to a host document load; R0 delivers that map with a test. | §3.3, §3.4, §3.5, §3.9, §3.10 |
| 2 | important | "Moved without changing a statement" is replaced by a recipe (gather, compute, commit, show). Values read from the drawing travel in the operation as scene facts. The off-screen automatic layout becomes the host service `autoLayout`. Rewrites are pure, so the Node replay is possible. | §2.4, §3.4, §3.6 |
| 3 | important | Interfaces views hold no positions. The false sentence of `layout/port` is replaced. The bundle change is named as the alternative. | §4.2, §5.5, §14 |
| 4 | important | Code-view routes are for dependency lines only; every inheritance line is routed for you. Inheritance lines are selected through candidates and through listbox options. | §3.4, §4.2, §5.2 |
| 5 | important | Only top-level deployment nodes hold positions; what is inside a node follows it. | §4.2, §5.4, §6 |
| 6 | important | The fields the projection adds are named, with a test that they change no drawing. | §4.1, §9.1, §15 |
| 7 | important | The source map carries declared ends and the relationship id beside the drawn ends. Moving or turning a lifted end is refused; other edits keep the declared end. | §4.1, §5.1, §5.2 |
| 8 | important | Stage R3 turns every classic drag into a gesture session with a classic pointer driver. Listeners live per session or popup. ED-4 is amended. | §3.7, §3.8, §3.10, §15 |
| 9 | important | The two properties are dropped; byte identity with the R0 corpus is the oracle, and the normalizing of today's writes is named as behaviour to keep. | §3.6, §9.1 |
| 10 | important | The gate list is derived by search; `crc-editor` and `tutor-hints` are in it. | §9.4 |
| 11 | important | Aliases are never keywords, from M3. | §4.1, §10, §13 |
| 12 | critical | A visible message region with offers; tests that each kind of refusal is visible; the same gap in C4-notation views is surfaced. | §7.5, §7.7, §9.3, §13, §14 |
| 13 | critical | No declare offer for novices or for replies; the expert offer asks the structural question; withheld checks withhold reason and offer; a step 8 test; question 2 carries the evidence. | §5.1, §5.3, §8, §9.3, §11, §14 |
| 14 | important | The place of every addition made without a drag is defined and announced. | §5.3, §6, §7.4 |
| 15 | important | Option descriptions state the step's kind, its fragment and branch, a link's origin, and a lifeline's box. The keyboard move through branches and the lifeline move at a box edge are defined. "Move out of the fragment" is added. | §7.3, §7.4 |
| 16 | important | The adapter member `targets`, and marks for possible and other targets. | §3.4, §5.1, §7.4 |
| 17 | important | A move never changes nesting. Nesting changes by a drop on a marked node or by "Move to…", which has "At the top level". The announcement and the undo label name it. | §5.4, §7.4 |
| 18 | important | Additions go to a free place and are pinned there; overlaps are announced with an offer; a test. | §6, §9.3 |
| 19 | important | One kind rule in the core, shared by the Members form and the canvas; `extends-kind` and `implements-target`. | §4.3, §5.1, §5.2 |
| 20 | important | "This design model" instead of "a C4 model"; `extends-target` without a false pointer; lock refusals name the drawn thing; `step/nested-ends`; no arrow signs in sentences. | §5.1 |
| 21 | important | Unavailable tools are listed, disabled, with one-line reasons; menus carry short reasons, the message region the sentence. | §3.4, §5.6, §14 |
| 22 | minor | A reference names an element by its layout id, found through the scene's box lookup. | §1, §7.2 |
| 23 | minor | The scene is read before the listbox is laid; the listbox carries `data-layout-ignore`. | §7.2 |
| 24 | minor | Routes have no index; two lines of one kind between one pair are routed for you. | §4.2 |
| 25 | minor | The session reads `contents()`; the scene is given data and asks nobody. | §2.1, §2.4 |
| 26 | minor | Reason codes come from the core; `stepEnds` moves with its helpers. | §4.3 |
| 27 | minor | ED-3 is amended for `renderDelegatedView` and layout-bearing text. | §15 |
| 28 | minor | Revisions are derived from the text; the text adapter never answers `stale`. | §3.4, §3.6 |
| 29 | minor | Nothing is added silently that the view does not draw. | §5.1 |
| 30 | minor | Member edits start from the model's text; a function's drawn call is handled. | §3.4, §4.1, §5.2 |
| 31 | minor | A double-click edits in place; Enter opens. | §5.5, §7.4 |
| 32 | minor | Effects outside the open view are announced; a step connector that differs from its relationship warns; "Another element…" lists valid ends only. | §5.1, §5.3 |
| 33 | minor | A "⋯" button on a selected line; names and Escape of the in-place editors; bend numbers; inspector reveals; static styles become classes (stage R4); print and reduced motion. | §3.10, §7.4, §7.7, §7.8 |
| 34 | minor | `same-element-instances`; "Unwrap instead"; the underscore note; non-drag paths for the UML editor proposed after M2; the added tests. | §5.1, §5.3, §5.4, §7.4, §9.3, §10 |

Added while revising, beyond the findings: a stored bend is dropped when its line no longer joins its boxes (§6, rule 5), because the new limit on nested positions makes that case common; and a tile dropped in a view without positions counts as the first move (§6, rule 2).
