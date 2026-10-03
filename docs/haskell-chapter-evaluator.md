# Haskell chapter expression evaluators

The Haskell chapter progressively enhances highlighted source with editable code.
Place `{% include haskell-evaluator.html expression='shadowExample' %}` immediately
after a complete `haskell` fence to add a companion prompt. The expression is
editable and is never evaluated automatically. Use a finite, relevant example;
do not prefill the answer to a prediction or transfer question.

Load `js/haskell/chapter-evaluator.js` as a module and
`css/haskell-evaluator.css` on the chapter, before `css/print-light.css`.
The include starts hidden; without JavaScript the source remains readable.
It also works when the chapter is rendered inside a combined book page.

Each evaluator uses only its adjacent fence, plus Prelude. A fence must contain
complete definitions, not a transcript or incomplete program. For a block of
library signatures, `prelude=true` evaluates in Prelude without loading those
signatures as declarations; those reference signatures remain read-only.
The other examples use a native textarea with an inert syntax mirror, using
the existing Haskell lexer. Editing preserves native selection, undo, and input
methods; Tab leaves the editor. Reset code restores the authored example.
Current code is read when Evaluate is pressed; edits never run automatically.
Edits and history last only for this page visit.

`chapter-evaluator.js` owns the view, per-example history, and a bounded
transcript (50 commands / 100 entries, at most 16,000 characters per entry).
`chapter-runtime.js` owns one lazy sandboxed frame and request lifetime. Only
one expression runs at a time; the other Evaluate buttons are disabled while
it runs. Actual typing in either code or an expression prepares MicroHs in the
background, overlapping its download with editing; otherwise the first Evaluate
boots it. Merely reading or focusing a field does not load the compiler. No
Monaco editor, per-example runtime, polling, or persistent storage is added.
`chapter-source.js` owns the native editor and syntax/print mirror, separately
from runtime and transcript behavior. Highlighting never replaces input text.

All evaluations restore the selected source to the same `Example.hs` file and
use the existing `js/haskell-worker.js` protocol. Unchanged source can reuse
the adapter's compilation cache; results are never cached. Switching examples
replaces the module so their definitions do not leak into each other. Input
and output are always assigned as text, never inserted as HTML.

Stop, startup failure, and timeout discard the exact frame, listeners, timers,
and pending requests. The next Evaluate creates a fresh runtime. Boot is bounded
at 90 seconds and each write/evaluation request at 30 seconds. Page hiding
disposes the runtime; browser-history restoration retains usable controls.
MicroHs uses the same cooperative frame execution as the tutorials: some
pathological cyclic computations can delay browser event processing and Stop.
The existing adapter's cycle analysis and diagnostics remain in force.

The DOM preserves code-before-prompt order. Each evaluator is named for its
section; the input has a visible label, output is a live log, and loading/errors
have status text. An indeterminate progress indicator appears in the result
area until evaluation settles, including Stop/error/timeout. Reduced-motion
preferences disable its rotation. Native form submission and buttons supplement the documented
history/clear/interrupt shortcuts. CSS owns light/dark colors, readable controls,
narrow-screen stacking, and print removal of interactive controls. Print shows
the complete current source (including edits), wraps long lines, removes editor
scroll/height limits, and uses black text on white even from dark mode.
Before printing, temporary groups keep each heading/introduction with its first
example; after printing those groups are removed and editing resumes unchanged.

Verify with `tests/haskell-chapter-evaluator.spec.js` against the real compiler,
the scoped WCAG audit, and visual checks in both themes and at narrow widths.
