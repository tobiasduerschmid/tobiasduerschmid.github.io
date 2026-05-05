---
name: diagrams
description: Rules and type catalog for drawing diagrams in this SEBook project. USE THIS SKILL EVERY SINGLE TIME you are about to draw any diagram, chart, tree, graph, architecture sketch, flow, state machine, DAG, directory listing, memory layout, or any other visual — AND every time you are even tempted to produce ASCII art (including `├──` box-drawing trees, `+---+` ASCII boxes, indented text diagrams, or Unicode line-art) — AND every time you are about to write a `mermaid` diagram or fenced ` ```mermaid` block, edit a page that contains one, or call `mermaid.initialize` (you must not — the project's `SebookMermaid` theme owns initialization). ASCII art is never correct here — the project has a dedicated ArchUML renderer plus interactive git/filesystem widgets, and this skill tells you which type to pick and where to find the syntax. Trigger even when the user says "just sketch it", "show the structure", "draw a tree", "visualize X", "diagram of Y", "render this flowchart", or when you are about to include a fenced code block whose content looks like a figure rather than code.
---

# Drawing diagrams in SEBook

## The two rules

**Rule 1 — Never produce ASCII art.** Not for directory trees, not for architecture sketches, not for "quick" before/after pictures, not for memory layouts. If you catch yourself typing `├──`, `┌─┐`, `+---+`, or a chain of indented labels meant to look structural — stop. Pick an ArchUML type from the table below instead.

This rule exists because the project ships a custom renderer (`js/ArchUML/uml-bundle.js`) that turns text specs into real SVG with proper icons, connectors, and theme-aware colors. ASCII art looks broken next to that rendering, doesn't respect dark mode, doesn't scale, and can't carry annotations cleanly.

**Rule 2 — If you use mermaid, go through `SebookMermaid`.** Mermaid is an *acceptable fallback* (see the Mermaid section near the end of this file for when it's appropriate), but every page that contains a mermaid diagram must load `js/mermaid-theme.js` after the mermaid CDN script, and **you must never call `mermaid.initialize` yourself**. The `SebookMermaid` theme makes mermaid output match the ArchUML visual language (palette, font, drop-shadow, dark-mode behavior) so a page mixing both reads as one figure set. Skipping the theme means the diagram lands with mermaid's pastel default styling, which clashes with every ArchUML diagram on the page.

## Pick a type

All ArchUML types are invoked with `<pre><code class="<class-name>">…@startuml…@enduml…</code></pre>`. The reference with full syntax and worked examples is [REFERENCE.md](../../../js/ArchUML/REFERENCE.md). Read **only the section you need** — don't pull in the whole file.

| You want to draw… | Class name | Syntax reference |
|---|---|---|
| Classes, interfaces, inheritance, associations | `language-uml-class` | [REFERENCE.md §Class Diagrams (L266)](../../../js/ArchUML/REFERENCE.md) |
| Interactions / messages between participants over time | `language-uml-sequence` | [REFERENCE.md §Sequence Diagrams (L646)](../../../js/ArchUML/REFERENCE.md) |
| Named states and transitions (behavioral modeling) | `language-uml-state` | [REFERENCE.md §State Machine Diagrams (L974)](../../../js/ArchUML/REFERENCE.md) |
| Components, ports, ball-and-socket interfaces | `language-uml-component` | [REFERENCE.md §Component Diagrams (L1167)](../../../js/ArchUML/REFERENCE.md) |
| Nodes, artifacts, infrastructure topology | `language-uml-deployment` | [REFERENCE.md §Deployment Diagrams (L1322)](../../../js/ArchUML/REFERENCE.md) |
| Actors and use cases | `language-uml-usecase` | [REFERENCE.md §Use Case Diagrams (L1475)](../../../js/ArchUML/REFERENCE.md) |
| Workflows, process steps, decisions, fork/join, swimlanes | `language-uml-activity` | [REFERENCE.md §Activity Diagrams (L1571)](../../../js/ArchUML/REFERENCE.md) |
| Ad-hoc box-and-arrow (memory layouts, conceptual before/after, anything "none of the above") | `diagram-freeform` | [REFERENCE.md §Freeform Diagrams (L1676)](../../../js/ArchUML/REFERENCE.md) |
| Git commit DAGs — commits, branches, HEAD, merges, cherry-picks | `diagram-gitgraph` | [REFERENCE.md §Git Commit Graphs (L1826)](../../../js/ArchUML/REFERENCE.md) |
| **Set membership / overlaps** (2–5 sets, classifications, taxonomies) | `diagram-venn` | [REFERENCE.md §Venn Diagrams (L1904)](../../../js/ArchUML/REFERENCE.md) |
| **Entity-Relationship schemas** (Chen notation — entities, attributes, relationships, cardinalities) | `diagram-er` | [REFERENCE.md §ER Diagrams (L2154)](../../../js/ArchUML/REFERENCE.md) |
| **Directory / folder tree** (filesystem layouts) | `diagram-folder-tree` | See below — not in REFERENCE.md |

### Notes and annotations on any diagram
Almost every type supports `note left/right/top/bottom of <id> : …` and multi-line notes. See [REFERENCE.md §Notes & Annotations (L2324)](../../../js/ArchUML/REFERENCE.md). Venn supports notes targeting set intersections (e.g. `note right of SetA & SetB : …`); ER supports notes on entities and relationships.

### Quick reference card
For a one-page cheat sheet of arrows and operators, see [REFERENCE.md §Quick Reference Card (L2670)](../../../js/ArchUML/REFERENCE.md).

## Folder-tree (not in REFERENCE.md)

The folder-tree renderer is documented inline in the renderer source. Read the header comment at [uml-bundle.js L16940–16962](../../../js/ArchUML/uml-bundle.js) — it's ~20 lines covering the complete syntax.

The TL;DR (read the source comment before using — annotations and edge cases matter):
- Indentation = depth. First indented line sets the indent unit.
- Trailing `/` on a name → folder icon. Otherwise → file icon.
- Trailing `← note`, `# note`, or `// note` on a line → italic annotation.
- Wrap in `@startuml` / `@enduml`.

Used elsewhere in SEBook: search for `class="diagram-folder-tree"` in [SEBook/](../../../SEBook/) for live examples.

## Interactive widgets (separate from ArchUML rendering)

These are *animated* before/after cards — NOT static ArchUML diagrams. Use them when you want the reader to click and watch a command change state, not just see a final picture. Each has full usage docs in a top-of-file comment in its JS source:

| Widget | Wrapper | Docs (top of file) |
|---|---|---|
| **Git command animation** — animate a single git command, or a multi-step sequence, over a live commit graph + file-state strip | `<div data-git-command-lab>` / `<div data-git-command-lab-multi>` | [git-command-lab.js](../../../js/git-command-lab.js) |
| **Filesystem command animation** — animate shell / fs commands over a folder tree | `<div data-fs-command-lab>` / `<div data-fs-command-lab-multi>` | [fs-command-lab.js](../../../js/fs-command-lab.js) |

Both widgets embed a JSON spec inside a `<script type="application/json">` child. Read the header comment for the exact state shape and step format.

## Page embedding (one-time setup per page)

Any page that uses ArchUML diagrams needs the bundle loaded in its front matter area. Check that these already exist before adding:

```html
<script src="/js/ArchUML/uml-bundle.js"></script>
```

The git and fs command-lab widgets additionally require their own scripts and stylesheets — see the example setups in [SEBook/tools/git.md](../../../SEBook/tools/git.md) (top of file) and [SEBook/tools/shell.md](../../../SEBook/tools/shell.md).

## Known renderer limits (read before authoring labels)

These are traps this renderer does **not** forgive. Hit one and the diagram ships with literal `\n` characters or duplicated boxes in the page.

- **`\n` does not produce a line break inside labels.** Arrow labels (`A --> B : text`), transition labels, and state body descriptions (`StateName : text`) render `\n` as the two characters `\`, `n` — not as a newline. If you need multi-line context, either (a) keep the label short and single-line, or (b) move the detail into a `note ... end note` block attached to the nearest element. Real newlines *do* work inside `note ... end note` bodies and inside `class Foo { ... }` bodies — just not inside label strings.
- **Prefer plain identifiers over `"Display Name" as Alias`.** The `"X" as Y` aliasing form has produced duplicate / stray boxes in component diagrams here (the display string leaks out as its own component). Use a single-word identifier directly (`component EventBus`) instead of aliasing. If you truly need a multi-word display label, verify it renders cleanly before committing.
- **Avoid special characters in labels.** Symbols like `✗`, `✓`, em-dashes, and parentheses-heavy labels have caused layout issues. Spell the meaning out in words.

## Accessibility — aria-label is auto-generated; figcaptions are *contextual only*

Every rendered diagram is wrapped in a `<figure>`. Two parallel describers walk the `@startuml` source and emit a verbal structural description that gets set as the `aria-label` on the `role="img"` SVG container:

- **Static production builds** — `_plugins/uml_static.rb` runs at Jekyll render time and bakes the description into the emitted HTML.
- **Live client-rendered diagrams** (tutorials, popouts, SE Gym, dev-mode SEBook pages) — `js/uml-auto-describe.js` patches `UMLShared.applySvgAccessibility` so every re-render (including the live tutorial diagrams that update as the student types) gets the same description.

Both produce the same output, e.g. *"UML class diagram with 6 classes (Customer, VIP, Guest, Order, LineItem, Product) and 1 interface (Billable). VIP extends Customer. Order implements Billable. Customer is associated with Order with multiplicity one to many. Order composes LineItem with multiplicity one to one or more."* That auto-generated text is the WCAG 2.2 §1.1.1 (Non-text Content) text alternative — authors do **not** need to write a description that retells what's on the diagram.

If you change the describer, change *both* in lockstep — they ship as one feature.

The visible `<figcaption>` is therefore reserved for *context the diagram itself doesn't carry* — pedagogical framing, the takeaway you want the reader to land on, why this design was chosen, references to related concepts. If you can't add a caption that does something the SVG and surrounding prose don't already do, leave it off (the plugin renders no figcaption at all when none is supplied).

Set an author caption with `data-uml-caption="…"` on the wrapper `<div>`, or with a leading `caption: …` line in the `@startuml` spec — the attribute wins when both are present:

```html
<div class="uml-class-diagram-container"
     data-uml-type="sequence"
     data-uml-caption="The Façade hides 13 subsystem calls behind one method — that ratio is what makes the pattern earn its keep."
     data-uml-spec='@startuml
…
@enduml'></div>
```

Good captions add value the diagram alone can't:
- *"This is the same compound that powers MVC — Observer + Strategy + Composite."*
- *"Why composition, not inheritance? Adding rocket-powered ducks would explode the hierarchy."*
- *"The chain of filled diamonds models cascade-on-delete; SQL `ON DELETE CASCADE` is the database analog."*

Bad captions (leave them off):
- *"UML class diagram showing the Façade pattern roles — a Client delegates to a Façade that hides three Subsystem classes."* (Just retells the diagram. The aria-label already does this for screen readers; sighted readers see it directly.)
- *"Sequence diagram of the OAuth flow."* (Type label only; aria-label already covers it.)

## Choosing between Freeform and something more specific

Freeform is the "none of the above" escape hatch. Before reaching for it, check whether a formal type fits — a state machine is almost always better drawn with `language-uml-state` than with freeform boxes and arrows, because the renderer gives you proper states, transitions, and initial/final markers for free. Freeform earns its keep for:

- Memory layouts (stack/heap/text segments).
- Before/after conceptual pictures that aren't a DAG, sequence, or state machine.
- Small annotation-heavy diagrams that don't fit any existing type.

If you find yourself recreating a commit graph, directory tree, class hierarchy, Venn diagram, or database schema in freeform, you picked the wrong type — switch to the dedicated one.

A few specific cases where the dedicated type wins:

- **Overlapping categories / "which items have which traits"** (e.g. comparing programming languages on 2–3 axes, classifying things into union/intersection categories) → use `diagram-venn`, not freeform circles that won't actually overlap. The Venn renderer handles circle/ellipse arithmetic, multiply-blend colours, and automatic contrast-aware text colour for you.
- **Database schemas / data models** (entities, keys, relationships, cardinalities — SQL-table-adjacent thinking) → use `diagram-er` in Chen notation, not a class diagram or freeform. ER gives you the correct Chen conventions (rectangles, diamonds, underlined PKs, double-borders for weak entities) automatically.
- **A class-like model with behaviour** (methods, stereotypes, inheritance, interfaces) → use `language-uml-class`, not ER. ER is for data-schema thinking only.

## When in doubt

If the content you're about to render could fit multiple types, prefer the most *specific* type — it'll look better and require less manual layout. If you're genuinely unsure which type fits, read the first paragraph of the candidate sections in REFERENCE.md (they each start with a 1–2 sentence purpose statement) and pick the one whose purpose matches your intent.

## Pair with the `uml-diagramming` skill when drawing UML

When you're drawing a **UML** diagram (class, sequence, state machine, component, deployment, use case, or activity — i.e. any of the `language-uml-*` types above), *also* try to invoke the `uml-diagramming` skill if it's available on this system. That skill is a separate, general-purpose UML style advisor (grounded in Ambler's *Elements of UML 2.0 Style* and the UML Reference Manual) and catches modeling mistakes this skill doesn't — wrong relationship arrows, ambiguous multiplicities, muddled levels of abstraction, unreadable layouts.

**How to combine them:** this skill tells you *how to render in ArchUML* (which class name, which reference section for syntax). The `uml-diagramming` skill tells you *whether the UML itself is correct and readable*. Use both in sequence — syntax here, modeling critique there.

**Availability is not guaranteed.** The `uml-diagramming` skill is installed via a plugin and may or may not be present. If it's listed in your available skills, invoke it. If it isn't, just proceed with this skill alone — don't block on it and don't mention its absence to the user.

**Do not** invoke `uml-diagramming` for the non-UML types: `diagram-freeform`, `diagram-gitgraph`, `diagram-folder-tree`, or the interactive command-lab widgets. Those aren't UML and the advisor's guidance doesn't apply.

## Mermaid — REQUIRED: load `SebookMermaid`, never call `mermaid.initialize` directly

ArchUML is the default for everything in the table above. **Mermaid is the only acceptable fallback** when:

- You need a diagram type not in the ArchUML catalog (mind maps, timelines, journey diagrams, quadrant charts, sankey, XY plots).
- You're embedding a diagram authored in another mermaid-using context (lecture slides, an external doc) and want it to render in-place without re-typing.
- The diagram is simple enough that mermaid's text syntax is genuinely faster than ArchUML's, *and* the visual result will sit alongside ArchUML diagrams without a style mismatch.

Anything that *is* in the ArchUML catalog (class, sequence, state, component, deployment, use case, activity, freeform, gitgraph, folder-tree, venn, ER) — use ArchUML. Don't introduce a parallel mermaid version of an ArchUML-supported type; readers experience the page as one figure set and the inconsistency is jarring.

### Required: load and use SebookMermaid

Every page that contains a mermaid block **must** load both scripts in this order, after the page's main content scripts:

```html
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<script src="/js/mermaid-theme.js"></script>
```

The second script defines `window.SebookMermaid` and immediately calls `mermaid.initialize(...)` with theme variables, font, and colors that mirror the ArchUML palette in [css/uml-diagram.css](../../../css/uml-diagram.css) and [js/ArchUML/uml-bundle.js](../../../js/ArchUML/uml-bundle.js):

- Stroke `#4060a0`, fill `#fdfcf8`, header fill `#d0ddef`, text `#222`, edge `#444`
- Font: `'Segoe UI', system-ui, -apple-system, sans-serif` at `14px`
- Dark mode: SVG `filter: invert(1) hue-rotate(180deg)` (matches the rule ArchUML applies)

**Never call `mermaid.initialize` yourself** — it would override the project palette and produce a diagram that visually disagrees with adjacent ArchUML figures. The whole point of `mermaid-theme.js` is to make every mermaid diagram in the project look like it belongs next to an ArchUML diagram.

### Inline ` ```mermaid` blocks in markdown

Mermaid blocks inside markdown render through `SebookMermaid.render(rootEl)`. Pages that already render markdown after page-load (e.g. tutorials, the popout instructions panel) call this for you — see the call sites in [js/tutorial-code.js](../../../js/tutorial-code.js) (`_renderInlineMermaid`) and [tutorial-instructions-popup.html](../../../tutorial-instructions-popup.html) (`renderContent`). New pages that re-render markdown dynamically must call `SebookMermaid.render(rootEl)` after each `innerHTML` update.

For static markdown (rendered once at build time), no call is needed — the auto-initialize in `mermaid-theme.js` covers blocks that exist on first paint.

### What you write as a mermaid author

A `<pre><code class="language-mermaid">…</code></pre>` block (or a fenced ` ```mermaid` block in markdown that converts to that). Keep node and edge labels short — mermaid's HTML labels can wrap, but boxes get sized at 14px font, so very long labels still need `<br/>` breaks or shorter wording. Don't set inline `style:` overrides on individual nodes that conflict with the theme palette (red/green for "good/bad" semantic accents are fine; arbitrary brand colors break the visual unity).
