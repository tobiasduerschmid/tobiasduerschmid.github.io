# The C4 editor: host contract, events, and content security

The C4 editor edits one `design.yml` model (spec: `docs/superpowers/specs/2026-11-08-c4-model-design.md`, §3.4, §9, §10). It is framework-free and lives in the ArchUML submodule. It never touches storage, files, the network, cookies, the clipboard, `window.open`, or site globals. Everything outside the editor goes through the **host** object that the page passes to `mount`. This page is the contract a host programs against: the SEBook site (`js/c4-editor-site.js`), a tutorial, or a future VS Code webview.

`tests/c4-editor-contract.spec.js` checks the contract from the host's side, and `scripts/tests/c4-editor-dom.test.js` the keys and Problems-panel commands that reach the host. `tests/c4-editor-a11y.spec.js` checks the keyboard and pointer behaviour and runs axe.

Why the contract looks this way (one undo stack, the echo rule, the host callbacks for Check now and Submit for review, the overlay over the normal renderer) is recorded with the other C4 decisions and the open items in [`docs/c4-decisions.md`](c4-decisions.md), section "Editor".

## Loading

The scripts load in the order of `js/ArchUML/c4/manifest.json`: `core`, then `render`, then `editor` (`c4-editor-mount.js` is last). `_includes/c4-scripts.html` and `_includes/c4-editor-scripts.html` emit them from that list, and so does any other host. The editor also needs `js/ArchUML/uml-bundle.js` for the delegated UML views and `js/ArchUML/css/c4-editor.css` for its layout. Each module publishes its part on `ArchUMLC4EditorParts`. The mount publishes `ArchUMLC4Editor`.

**The diagram editor.** The four UML-notation views (code, deployment, dynamic, and interfaces) are edited on the canvas through the diagram editor, `js/ArchUML/diagram-editor/` (UML-view editing spec `docs/superpowers/specs/2026-11-12-c4-uml-view-editing.md`, §2, §7). A host that wants that editing loads the diagram editor's `core` group, from `js/ArchUML/diagram-editor/manifest.json`, and its stylesheet `js/ArchUML/css/diagram-editor.css`, before the C4 editor scripts. On the site, `{% include diagram-editor-scripts.html groups="core" defer="true" %}` does both: `_includes/c4-editor-scripts.html` and the `backend: c4` block of `_layouts/tutorial.html` include it before the editor scripts, deferred like them, so it runs first (`scripts/tests/diagram-editor-registration.test.js` checks the order). A page that also holds the UML editor loads the core group twice; the second load replaces nothing. Without the diagram editor the canvas draws the UML-notation views as before, with a read-only listbox of their boxes.

## Mounting

```js
const editor = ArchUMLC4Editor.mount(rootElement, {
  text,                       // the document text (required in practice; default '')
  view: 'containers of registration', // optional; the model's default view otherwise. `landscape` opens
                              // the default view too: the editor's top view is the context view (ED-10)
  profile: 'novice',          // 'novice' | 'expert' (default 'expert')
  size: 'regular',            // 'compact' | 'regular' | 'tall' (a modifier class, never a style attribute), or
                              // 'fill': the host gives the root its height and the canvas takes what the rows
                              // above it leave (the tutorial workspace; see "Layout by width" below)
  outline: 'open',            // 'open' | 'collapsed': whether the outline region starts expanded
  scaffolds: { definitions, sentenceFrames, inlineLint, carryDown, trace, emptyStateGuide }, // booleans, default on
  checks: { display: 'live', disable: [], severity: {}, thresholds: {}, honorFileIgnores: true },
  lockedFields: [],           // dotted YAML paths of given parts (spec §11); '*' matches one segment
  reveal: 'all',              // 'all' | 'on-request' (prediction tasks)
  sourceEditor: true,         // false: no YAML tab (the host's own text editor is the YAML surface)
  readOnly: false,
  palette: undefined,         // diagram colour override (spec §6.2)
  links: { patterns: {}, styles: {}, glossary: {} },
  host: { /* below */ },
});
```

`mount` throws a `TypeError` for an option outside the contract, for a host without `onTextChange`, for an optional host member that is given but is not a function, and for `undo: 'host'` without the four host undo methods. Several editors can share a page. Every id the editor writes, and every ARIA reference, carries an instance prefix (`c4-editor-1-…`, `c4-editor-2-…`), and each editor has its own undo history and its own Escape handling.

**Layout by width.** The root is a size container, and the regions follow its width, never the window's (spec §9.1). From 60em up, the outline, canvas, and inspector share one row. From 45em to 60em, the inspector and panels stack below; the outline keeps a 13em column beside the canvas, or only its button's width when collapsed. Below 45em, where a 13em column would leave the drawing narrower than one element box, everything stacks, the outline in a short scroll box or a single row above the canvas. With `size: 'fill'` the root becomes a size container in both axes, so the host must give it a height (the tutorial's workspace pane does); the canvas is then as tall as the root less the toolbar and the rows above it, at least the compact height, and the inspector and panels follow in the root's own scroll. The tutorial (`js/tutorial-c4.js`) mounts with `size: 'fill'` and starts the outline collapsed in a workspace column narrower than 60em; at viewport widths up to 900px, where the tutorial uses document flow, `css/tutorial-c4.css` returns the editor to the regular height.

The returned handle:

| Method | What it does |
|---|---|
| `setText(text, { reason })` | Replaces the document with text from the host. It **never** calls `onTextChange`. See the echo rule below. |
| `getText()` | The current document text. |
| `openView(selector)` | Opens a view (spec §5.1 selectors). |
| `select(selection)` | Selects an element id, or `{ elementId }`, `{ relationshipId }`, `{ interfaceId }`, `{ scenarioId }`, a step of a scenario `{ scenarioId, step: { containerPath, index } }`, `{ environmentId, nodeId }`, or `null`. |
| `getDiagnostics()` | The diagnostics the learner can see now (profile and `checks.display` applied). |
| `submitForReview()` | Releases the diagnostics under `checks.display: 'after-submit'`. |
| `destroy()` | Removes every listener the editor added to the page, ends full screen, and empties `rootElement`, leaving its attributes as the editor found them. |

## The host object

| Member | Required | Called when | Arguments and result |
|---|---|---|---|
| `onTextChange(text, info)` | yes | The editor changed the document: a visual edit, typing in its YAML tab, or its own undo/redo. | `info = { reason, edits, version, label }`. `reason` is `'edit'`, `'source'`, `'undo'`, or `'redo'`. `edits` is a list of `{ offset, length, text }` splices against the previous text, ready for Monaco's `pushEditOperations` or a VS Code `WorkspaceEdit`. `version` grows by one per emitted change. `label` names the step ("Delete Seat Gateway"). |
| `onViewChange(selector)` | no | A different view opened. | |
| `onSelectionChange(selection)` | no | The selection changed. | The selection object, or `null`. |
| `confirm(request)` | no | Before a destructive command, such as Delete. | `{ title, message, lead, details, confirmLabel, cancelLabel, trigger }` → `Promise<boolean>`. Without it, the editor opens its own labelled `<dialog>` inside its root, which starts on Cancel. |
| `announce(message)` | no | Every polite announcement, also written to the editor's own live region. | |
| `openFile()` | no | Toolbar **Open…**. The button exists only when the host has the method. | → `Promise<{ text, name } \| null>` |
| `saveFile(text, info)` | no | Toolbar **Download YAML**. | `info = { format: 'yaml', view }` → `Promise<void>` |
| `exportSvg(svgText, info)` | no | Toolbar **Download SVG**. | `info = { format: 'svg', view, title }` |
| `copyText(text, info)` | no | **Copy ArchUML source** (UML views) and **Copy description** (interface cards). | `info.format` is `'archuml'` or `'markdown'` |
| `createSourceEditor(container, options)` | no | The YAML tab is first shown. Without it, the editor uses a labelled `<textarea>`. | Returns `{ getValue, setValue, applyEdits, revealRange, setMarkers, focus, onDidChange, dispose }`. `options = { value, language: 'yaml', label, readOnly, undo, redo }`; the host routes its undo keys to `options.undo`/`options.redo`, so the document keeps one undo history. |
| `undo` | no | | `'editor'` (default) or `'host'` |
| `performUndo()`, `performRedo()`, `canUndo()`, `canRedo()` | with `undo: 'host'` | Toolbar Undo/Redo and Ctrl/Cmd+Z, Ctrl+Y, and Cmd+Shift+Z in the canvas. | The host undoes in its own stack and sends the restored text back with `setText`. The editor records no history of its own. |
| `onRequestCheck()` | no | Ctrl/Cmd+Enter anywhere in the editor (spec §9.2). A tutorial runs Test My Work. Without it, the key stays the page's. | |
| `onRequestSave()` | no | Ctrl/Cmd+S anywhere in the editor. A tutorial saves the design file. Without it, the key stays the page's (the browser's own Save). | |
| `onCheckNow(diagnostics)` | no | The learner chose **Check now** in the Problems panel (`checks.display: 'on-request'`). | The diagnostics it released. |
| `onSubmitForReview(diagnostics)` | no | The learner chose **Submit for review** in the Problems panel (`checks.display: 'after-submit'`). A tutorial opens Test My Work. | The diagnostics it released. The handle's own `submitForReview()` is the host's call, so it has no notice, as `setText` never calls `onTextChange`. |

### Undo

With `undo: 'editor'` the editor keeps text snapshots: at most 100 steps, and edits within 600 ms of the previous edit join its step. A `setText` that changes the text is a step of its own, so the learner can undo the host's change. Every Undo and Redo, from the toolbar, the keys, or the YAML tab, is announced with the label of the step it takes back or repeats ("Undone: Move Student."; a step the host made reads "a change made outside the editor"). With `undo: 'host'` the host owns the one undo stack, as VS Code and tutorials whose Monaco model is the persisted document do. The SEBook site keeps editor undo, and its Monaco YAML tab routes undo/redo to the editor. The toolbar's "↶ Undo" and "↷ Redo" name the step they would take back or repeat in their tooltip and accessible description ("Undo: Move Student. Ctrl+Z (Cmd+Z on a Mac)"; with `undo: 'host'`, "Undo the last change."), carry `aria-keyshortcuts`, and stay solid buttons with muted text when there is nothing to undo (ED-11).

### The echo rule (as implemented)

`setText(text)` with text **equal to the editor's current text** is a no-op: no `onTextChange`, no redraw, no undo step. The current text is the editor's last emitted text whenever the host is in step, so a host that writes every change it hears straight back to the editor (as a Monaco or VS Code model listener does) causes no loop. The rule compares against the current text, not against "the last emitted text" as earlier spec wording said, so it also absorbs a host that repeats its own last `setText`. `setText` never calls `onTextChange`. Hosts should still guard their own change listeners while they apply the editor's edits (the `writing` flag pattern of `CompilerTutorialEditor`), so the editor's change does not come back as a fresh host edit.

## The message region

An editable editor has one visible message region, `role="region"` named "Messages", directly before the canvas in DOM order and drawn over the canvas's top edge (UML-view editing spec §7.5). It keeps the height of one line of text, so a message never pushes the drawing away under the pointer. It shows one message at a time: the instruction of a mode or a tool, or the last refusal, result, or notice. A refusal starts with the label "Not done:" and an icon. A message stays until the next one, a successful edit, another view, or Dismiss; it never disappears on a timer. A message may carry one offer, a native button ("Open code of Seat Gateway", "Move Enrollment Policy to a free place"), and Dismiss is another; both come right before the canvas in the tab order, so Shift+Tab from the canvas reaches them. The region is not live: each message is also written once to the editor's polite live region and passed to `host.announce`. A read-only editor has no region. Print hides it.

## Editing text in place on the C4-notation views

On a context, container, or component view, F2 renames the focused element, and a double-click edits the text under the pointer in a field laid over it: an element's name, description, technology (its type line, for a container or component), or one responsibility line, and a relationship's description or technology (ED-12). A double-click on a box outside its text renames it; it never zooms (Enter, the zoom badge, the breadcrumbs, and the Scope list do). The field is named for what it edits ("Description of Registration API"); Enter keeps the text as one undo step, Escape keeps the old text, and leaving the field keeps what was typed. A refusal (read-only, a lock, YAML errors, an invalid value) stays in the field with its reason after Enter. A description is edited in a wrapping field; Enter keeps it, and line breaks are not kept. The renderer marks each line of a box or a label with the part it shows (`data-c4-text`: `name`, `type`, `description`, `responsibility` with `data-c4-index`, `more`, `annotation`, `interfaces`, `technology`), the hook the editor reads.

## Editing the UML-notation views

With the diagram editor loaded, the canvas mounts one diagram-editor session on a drawn code view (`code of ‹component›`) and lays the listbox "Elements in this view" over it. The deployment, dynamic, and interfaces views follow the same contract as their view modules arrive (spec §5.3–§5.5). Every gesture becomes `design.yml` commands, one dispatch and one undo step, or a refusal in the message region; nothing changes the drawing alone.

- **Palette.** The palette offers the open view's own tools: first the element tools (code: Class, Abstract class, Interface, Enum; the expert profile adds Function and Module), then the line tools that are not also element tools (code: Generalization, Realization, Dependency). After them the disclosure "More UML tools (not available here)" lists the notation's tools this design model cannot record, each disabled with its short reason ("Composition: not recorded in this design model"); activating one says its sentence. At narrow widths the Add menu (key A) lists both. A tile adds its element named by its placeholder ("New class") and opens its name in place; the first rename of an element that still has its placeholder name and id gives it the id of its name (spec §5.1). A click or A places the new box right of the drawn boxes when the view keeps positions; a tile dropped on the drawing is placed where it is dropped, and in a view without positions that drop pins every box where it is drawn. Chosen with the keyboard or from the Add menu, an addition goes where the focus is: inside the selected box (the deployment view then asks "Inside ‹node›" or "At the top level"), or after the selected step, in its list. A line tool chosen with the pointer, and one that is no element tool, waits for the two boxes the line is drawn between; a dynamic view's Message does so too, unless the scenario has no lifeline yet, where it opens the step form. A tool with operators (Fragment) lists them first; chosen with the pointer, the operator then waits for a click at the height where the fragment goes. A line tool is not dragged.
- **Positions.** A view keeps its layout under `layout.‹view›` in `design.yml` (spec §4.2: `positions`, `routes`, `lifelines`). Positions are in the layout's own frame: the renderer fits a drawing to its margins, so a kept box is drawn shifted by the same amount as every other, and the editor converts between the two. The first move pins every box that can hold a position. The inspector's Position section moves the selected box by steps or to a typed X and Y, as M and the arrow keys do, and returns it to automatic layout; for a box that holds no position it shows why. The toolbar's Reset layout removes the view's whole entry.
- **Ways in.** Every drag has a single-pointer and a keyboard path (spec §7.4): M or "Move…" moves a box, C or "Draw a line" draws a line through the marked targets, the toolbar's Add relationship draws one from the selected box (or from the box clicked first), the menu of the one selected box or line opens from its "⋯" button, a right-click, or Shift+F10, and F2 or a double-click edits a name or a member line in place; F2 also edits a step's description ("Description of step ‹n›") and a fragment's first guard ("Guard of branch 1 of ‹operator›"). The "⋯" button is 24 by 24 CSS px at every magnification, is named "Actions for ‹label›", lies clear of every hit target, is no tab stop, and is absent while a mode or a drag runs. A line's menu moves its ends and bends; a sequence message has no bend items. A press on a line that stands for several lines, such as the shared trunk of an inheritance tree, opens the chooser "Lines here". A click on a box that cannot be moved here (a ball, a lifeline head) selects what its option stands for; only a drag of it says why it does not move. In a dynamic view a drag from one lifeline's dashed line to another draws a message at the height of the release, and so do Message, a click on the sender's lifeline, and a click on the receiver's at the height of the step; a lifeline's head dragged sideways reorders the lifelines, and so does M on a lifeline, where Left and Right choose its view module's "Move left" or "Move right" and Enter applies it; M on a step or a fragment goes through the places its view module lists with Up and Down, announcing each, and Enter moves it there; C on a step or a fragment opens the step form after it. A click on the canvas outside the drawing places a box being moved there. A box dropped on a node or box its view module marks possible is put into it; a drop anywhere else changes nothing. Each option's menu ends with its view module's own items (a fragment's "Remove branch 2", say).
- **Selection.** Selecting an option selects in the editor state what it stands for: an element, a relationship, an interface, an environment's node, or a step of a scenario, `{ scenarioId, step: { containerPath, index } }` (spec §7.6). The core's selection after a step command, `{ scenarioId, containerPath, index }`, is kept in that shape. A step selection marks its scenario in the outline and shows the scenario form, which reveals the step's row.
- **Forms.** A new step, fragment, link, or relationship is confirmed in an anchored form beside what it was opened from (`actions.openAnchoredForm`, `c4-editor-anchored-form.js`): Enter or its default button confirms, Escape or Cancel adds nothing and returns focus to where the form was opened. Each editor makes its own forms from the page's form factories (`ArchUMLC4EditorParts.umlFormFactories`), so two editors on one page never share one.
- **Options.** Every box, line, and fragment the drawing shows is an option. A line is named by the route the drawing draws for it (`rel:‹line›`; a message, `seqmsg:‹line›`), or by `rel:‹line›` when the renderer draws it without a route of its own. An option's description ends with its problem count while diagnostics are shown (for a step or a fragment, the diagnostics at it or inside it), then with what Enter does: "Enter: nothing to open", except on an interfaces view's neighbour, whose Enter opens its interfaces view, as its own words say. In a deployment view every node and hosted instance can be pressed, dragged, and dropped on; only the top-level nodes keep positions (spec §14 D4).
- **Not done.** A gesture this design model has no place for, or that belongs to another view, is refused with a code of the spec's refusal table, a short reason in menus and choosers, and a sentence in the message region; Help lists them all under "Not available in this design model". A refusal's offer is the message region's button. It opens a view (`view`), shows a selection in the inspector (`select`: it selects it, reveals the inspector, and focuses its option when the view draws it, else focus returns where it was), dispatches commands (`commands`), or applies an operation of the module's vocabulary (`operation`), as of the drawing the refusal was made on; on any other drawing the adapter refuses it as stale, and a text change withdraws the message with its offer. A confirmation's choice may carry its own result sentence (`message`), which is announced in place of the plan's.
- **Drawings.** A view the renderer draws nothing for, such as a new scenario with no step yet, is edited on an empty drawing, so its palette adds the first element. A drawing made while the editor is not rendered (another surface shown, such as a tutorial's YAML surface) is made again when the editor is shown, because nothing could be measured.

## Keyboard, focus, and full screen

The shortcut scope, the Escape order, and the focus table are those of spec §9.2. `/shortcuts/#c4-editor` lists them for readers.

- **Keys for the host**: Ctrl/Cmd+Enter calls `host.onRequestCheck()` and Ctrl/Cmd+S calls `host.onRequestSave()`, with `preventDefault`, wherever focus is in the editor, form fields and the YAML tab included (the chords are not typing). An event something inside the editor already prevented is left alone, and a key whose member the host lacks stays the page's.
- **Escape order**: popover → menu → dialog → Move → full screen → clear selection. One layer closes per press, and each layer calls `preventDefault`. The editor ignores Escape events that something else already prevented.
- **Full screen**: in the browser's own full screen, the browser takes the Escape key and leaves full screen before the page sees it, which would skip the open layers. The editor therefore uses the Fullscreen API only where the Keyboard Lock API (`navigator.keyboard.lock(['Escape'])`) keeps Escape for the page. That is Chromium-based browsers in a secure context; there, holding Escape down still leaves full screen, as the browser tells the reader. Everywhere else, and when the browser refuses either API, the editor uses its full-screen overlay: a fixed layer over the page, with the rest of the page inert. Either way Escape closes the innermost layer first.
- **Delete** moves focus to the next option in arrow-key (reading) order, else to the previous one. When the view has nothing left, and so has no listbox, focus goes to the canvas region.
- Dialogs are `<dialog>` elements opened with `showModal` inside the editor root, so they work in full screen. Closing one gives focus back to the control that opened it. For a command chosen from an element's menu, that control is the element's option.

## Content security

The editor uses no inline scripts, no `eval`, and no `new Function`. It loads no images, fonts, or other resources, and sets computed styles only through the CSSOM. The C4 renderer writes presentation attributes and classes only. `tests/c4-editor-contract.spec.js` runs the editor under `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'` (the test injects its scripts inline) and requires zero `securitypolicyviolation` events.

A host that loads the scripts from files can serve a stricter policy. ArchUML's UML renderers (used for the delegated component, code, and interface views) write inline `style` attributes on their SVG roots, so `style-src` needs `'unsafe-inline'`:

```
default-src 'none'; script-src ${cspSource}; style-src ${cspSource} 'unsafe-inline'; img-src ${cspSource} data:
```

## The VS Code path (not built)

Spec §3.5 describes this path. The extension host `require`s `js/ArchUML/c4/c4-core.js` for diagnostics, turning their ranges into Problems. A `CustomTextEditorProvider` webview loads the manifest scripts, the bundle, and the editor under the policy above. It mounts with:

- `sourceEditor: false`, because VS Code's own text editor is the YAML surface;
- `host.undo: 'host'`, with `performUndo`/`performRedo` running VS Code's `undo`/`redo` commands on the document, and `canUndo`/`canRedo` answered from the last state the extension posted;
- `onTextChange(text, info)` posting `info.edits` to the extension host, which applies them as one `WorkspaceEdit`. When the document changes, the extension posts the new text back, and the webview calls `setText`. The echo rule makes the editor's own change, coming back this way, a no-op.
- `saveFile`, `exportSvg`, `copyText`, and `confirm` mapped to `postMessage` requests for `vscode.workspace.fs`, `env.clipboard`, and `window.showWarningMessage`. `announce` can be left out: the editor's own live region is inside the webview.

The webview maps `--c4-ui-*` to `--vscode-*` theme variables. The versioned schema URL in the file's first line gives completion in the plain text editor.

## Known gaps

- None recorded. (Until UML-view editing, no visual command created the first scenario or deployment environment. The toolbar now offers "New scenario…" and "New environment…" beside the view levels while the model has none: each asks for a title or name, adds it as one change, and opens its Dynamic or Deployment view.)
