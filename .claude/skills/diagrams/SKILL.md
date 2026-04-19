---
name: diagrams
description: Rules and type catalog for drawing diagrams in this SEBook project. USE THIS SKILL EVERY SINGLE TIME you are about to draw any diagram, chart, tree, graph, architecture sketch, flow, state machine, DAG, directory listing, memory layout, or any other visual — AND every time you are even tempted to produce ASCII art (including `├──` box-drawing trees, `+---+` ASCII boxes, indented text diagrams, or Unicode line-art). ASCII art is never correct here — the project has a dedicated ArchUML renderer plus interactive git/filesystem widgets, and this skill tells you which type to pick and where to find the syntax. Trigger even when the user says "just sketch it", "show the structure", "draw a tree", "visualize X", "diagram of Y", or when you are about to include a fenced code block whose content looks like a figure rather than code.
---

# Drawing diagrams in SEBook

## The one rule

**Never produce ASCII art.** Not for directory trees, not for architecture sketches, not for "quick" before/after pictures, not for memory layouts. If you catch yourself typing `├──`, `┌─┐`, `+---+`, or a chain of indented labels meant to look structural — stop. Pick an ArchUML type from the table below instead.

This rule exists because the project ships a custom renderer (`js/ArchUML/uml-bundle.js`) that turns text specs into real SVG with proper icons, connectors, and theme-aware colors. ASCII art looks broken next to that rendering, doesn't respect dark mode, doesn't scale, and can't carry annotations cleanly.

## Pick a type

All ArchUML types are invoked with `<pre><code class="<class-name>">…@startuml…@enduml…</code></pre>`. The reference with full syntax and worked examples is [REFERENCE.md](../../../js/ArchUML/REFERENCE.md). Read **only the section you need** — don't pull in the whole file.

| You want to draw… | Class name | Syntax reference |
|---|---|---|
| Classes, interfaces, inheritance, associations | `language-uml-class` | [REFERENCE.md §Class Diagrams (L105)](../../../js/ArchUML/REFERENCE.md) |
| Interactions / messages between participants over time | `language-uml-sequence` | [REFERENCE.md §Sequence Diagrams (L481)](../../../js/ArchUML/REFERENCE.md) |
| Named states and transitions (behavioral modeling) | `language-uml-state` | [REFERENCE.md §State Machine Diagrams (L809)](../../../js/ArchUML/REFERENCE.md) |
| Components, ports, ball-and-socket interfaces | `language-uml-component` | [REFERENCE.md §Component Diagrams (L1002)](../../../js/ArchUML/REFERENCE.md) |
| Nodes, artifacts, infrastructure topology | `language-uml-deployment` | [REFERENCE.md §Deployment Diagrams (L1157)](../../../js/ArchUML/REFERENCE.md) |
| Actors and use cases | `language-uml-usecase` | [REFERENCE.md §Use Case Diagrams (L1310)](../../../js/ArchUML/REFERENCE.md) |
| Workflows, process steps, decisions, fork/join, swimlanes | `language-uml-activity` | [REFERENCE.md §Activity Diagrams (L1406)](../../../js/ArchUML/REFERENCE.md) |
| Ad-hoc box-and-arrow (memory layouts, conceptual before/after, anything "none of the above") | `diagram-freeform` | [REFERENCE.md §Freeform Diagrams (L1511)](../../../js/ArchUML/REFERENCE.md) |
| Git commit DAGs — commits, branches, HEAD, merges, cherry-picks | `diagram-gitgraph` | [REFERENCE.md §Git Commit Graphs (L1661)](../../../js/ArchUML/REFERENCE.md) |
| **Directory / folder tree** (filesystem layouts) | `diagram-folder-tree` | See below — not in REFERENCE.md |

### Notes and annotations on any diagram
Almost every type supports `note left/right/top/bottom of <id> : …` and multi-line notes. See [REFERENCE.md §Notes & Annotations (L1739)](../../../js/ArchUML/REFERENCE.md).

### Quick reference card
For a one-page cheat sheet of arrows and operators, see [REFERENCE.md §Quick Reference Card (L2085)](../../../js/ArchUML/REFERENCE.md).

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

## Choosing between Freeform and something more specific

Freeform is the "none of the above" escape hatch. Before reaching for it, check whether a formal type fits — a state machine is almost always better drawn with `language-uml-state` than with freeform boxes and arrows, because the renderer gives you proper states, transitions, and initial/final markers for free. Freeform earns its keep for:

- Memory layouts (stack/heap/text segments).
- Before/after conceptual pictures that aren't a DAG, sequence, or state machine.
- Small annotation-heavy diagrams that don't fit any existing type.

If you find yourself recreating a commit graph, directory tree, or class hierarchy in freeform, you picked the wrong type — switch to the dedicated one.

## When in doubt

If the content you're about to render could fit multiple types, prefer the most *specific* type — it'll look better and require less manual layout. If you're genuinely unsure which type fits, read the first paragraph of the candidate sections in REFERENCE.md (they each start with a 1–2 sentence purpose statement) and pick the one whose purpose matches your intent.

## Pair with the `uml-diagramming` skill when drawing UML

When you're drawing a **UML** diagram (class, sequence, state machine, component, deployment, use case, or activity — i.e. any of the `language-uml-*` types above), *also* try to invoke the `uml-diagramming` skill if it's available on this system. That skill is a separate, general-purpose UML style advisor (grounded in Ambler's *Elements of UML 2.0 Style* and the UML Reference Manual) and catches modeling mistakes this skill doesn't — wrong relationship arrows, ambiguous multiplicities, muddled levels of abstraction, unreadable layouts.

**How to combine them:** this skill tells you *how to render in ArchUML* (which class name, which reference section for syntax). The `uml-diagramming` skill tells you *whether the UML itself is correct and readable*. Use both in sequence — syntax here, modeling critique there.

**Availability is not guaranteed.** The `uml-diagramming` skill is installed via a plugin and may or may not be present. If it's listed in your available skills, invoke it. If it isn't, just proceed with this skill alone — don't block on it and don't mention its absence to the user.

**Do not** invoke `uml-diagramming` for the non-UML types: `diagram-freeform`, `diagram-gitgraph`, `diagram-folder-tree`, or the interactive command-lab widgets. Those aren't UML and the advisor's guidance doesn't apply.
