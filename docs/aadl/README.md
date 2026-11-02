# AADL chapter and browser tutorial

Research and design prepared on **1 November 2026** for SEBook. The preferred deployment is **entirely in the learner's browser**, following the author's stated preference.

This package records the research and design behind the AADL chapter and four-step browser tutorial. The implementation reuses OSATE for language semantics and latency analysis; it does not implement a substitute AADL parser. See [verification](verification.md) for the distinction between native reference checks and actual browser evidence.

| Deliverable | Contents |
| --- | --- |
| [Chapter draft](chapter-draft.md) | Purpose, architectural vocabulary, annotated textual examples, deployment, modes, flows, analysis interpretation, and retrieval questions. |
| [Tutorial design](tutorial-design.md) | Learning objectives, lesson sequence, concrete student tasks, assessment and feedback contracts, and transfer assessment. |
| [Backend design](backend-design.md) | Browser-first engine choice, automatic visualization, analysis contracts, lifecycle, integration points, and acceptance criteria. |
| [Research record](research.md) | Supplied PDF mapping, verified primary sources, tool/version distinctions, source inconsistencies, and open questions. |
| [Example models](examples/) | Original AADL files used by the chapter; validation scope and commands are recorded in [verification](verification.md). |

The chapter follows the useful progression in Feiler and Gluch's supplied book excerpt: interfaces → composition → runtime tasks → deployment → analysis. Its original campus-rover model transfers the book's powerboat control pattern to another domain. Textual source remains authoritative; diagrams and reports are derived from the same resolved instance.

The main engineering decision is to **reuse OSATE's language semantics**. A headless Java bridge runs through CheerpJ 5/Java 25. The original Java 21 browser probe exposed runtime compatibility failures; the tested Java 25 route uses a narrowly scoped reflection adapter. Engine source, reproducible artifact build, and compatibility details live in [`aadl/`](../../aadl/). See the backend design and verification record for limits and evidence.

Student pages are [`SEBook/architecture/aadl.md`](../../SEBook/architecture/aadl.md), the [tutorial](../../SEBook/architecture/aadl-tutorial.md), and its [print view](../../SEBook/architecture/aadl-tutorial/print.md). The nine-lesson tutorial design remains a roadmap; the first release teaches reading an architecture, repairing a port contract, supplying missing timing evidence, and deriving a tight supported bound. The browser host is under `js/aadl/`, with a thin adapter in `js/tutorial-aadl.js`.
