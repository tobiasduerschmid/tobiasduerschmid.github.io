# Haskell debugger: values and equation decisions

The learning task is to explain calls such as `countAtLeast 60 [60,59,60]`:
which equation applies, what names its patterns bind, which branch a condition
chooses, how recursive arguments change, and how results return. A stack of
function names with every value hidden cannot answer these questions.

## Research informing the design

- [GHCi's debugger](https://ghc.gitlab.haskell.org/ghc/doc/users_guide/ghci.html#the-ghci-debugger)
  separates non-forcing inspection (`:print`, `:sprint`) from explicitly forcing
  values (`:force`). Automatic inspection must not cause an exception, make an
  unused computation run, or traverse an infinite list.
- [Hat](https://archives.haskell.org/projects.haskell.org/hat/) exposes calls
  with their arguments and results. Its post-execution views can use values
  learned later. Our live history instead freezes the observations available
  at each event so rewinding does not silently reveal future information.
- [HOOD/HugsHood](https://www.haskell.org/hugs/pages/users_guide/observe.html)
  distinguishes observations of demand from direct heap inspection. Our
  wrappers follow the observation approach: an underscore means not observed
  through that call, not proof that the underlying shared value is unevaluated
  everywhere in the program.
- [Haskelite (Vasconcelos and Marques, 2024)](https://arxiv.org/html/2407.11831v1)
  presents equation choices and guard results explicitly for teaching. We use
  that presentation idea while retaining MicroHs as the compiler and evaluator.
  We do not simulate Haskell execution in JavaScript or claim to show every
  primitive reduction.

These sources motivate design choices; they do not establish that this specific
interface has been validated with students.

## Pedagogical design follow-up

Discovery used Sider Scholar and SciSpace, followed by checking the primary
sources. [Stepping Lazy Programs (Chang et al., 2011)](https://arxiv.org/abs/1108.4706)
explains why imperative stepping can obscure lazy evaluation and presents a
semantically justified algebraic stepper. This is a semantic design result, not
evidence of learning gains for our interface. We retain actual runtime events
and explain demand, equation selection, and partial returns; we do not label
our trace a complete algebraic reduction sequence.

[Teaching Introductory Functional Programming Using Haskelite (Vasconcelos,
2025)](https://arxiv.org/html/2508.03640v1) reports classroom use, recommends small
examples, and warns against relying exclusively on operational tracing.
Feedback came from 14 forum participants and six questionnaire respondents;
historical pass-rate differences cannot establish a causal benefit.

Our resulting design choices are deliberately small:

- Show supplied arguments at entry, and distinguish them from observations.
- Explain the current call, selected equation, or partial return beside the
  relevant values rather than requiring students to infer meaning from arrows.
- Keep one guided activity in Structural Recursion: predict and compare the same
  `joinRows` definition under whole-list printing and `take 1`. Learners explain
  why demand changes the calls, while each call retains its own bindings.
- Keep the existing equational reasoning and independent implementation task;
  the debugger supplements reasoning rather than replacing it with clicking.

These are research-informed design decisions. Student usability and learning
outcomes for this debugger still require direct evaluation.

## Implementation contract

`instrument.js` turns each top-level equation into a local alternative with the
same patterns and `where` scope. A separate fallback records failure and proceeds
to the next alternative. MicroHs performs the actual matches in source order;
there is no second matcher guessing what the program did. Guards and `if`
conditions are observed at their original evaluation point. A catch-all that
succeeds leaves later equations marked “not reached”. Equation breakpoints stop
when that equation is selected; guard/condition breakpoints stop before the test.
Step Into also visits attempts and failures.

`helper-source.js` generates the Haskell support module. Observers preserve lazy
fields and record values when the program demands them. Safe scalar observers
cover Int, Word, Bool, Char, Float, and Double, with list, pair, and Maybe
composition from explicit type signatures. Unannotated list patterns also allow
structural list observations. Observers add no Show or other class constraint to
learner functions. Unrecognized types, polymorphic fields, custom types, and
names that may shadow Prelude types remain opaque. Function-valued results
remain functions. Integer is deliberately not treated as a primitive Int.

`session.js` captures arguments, pattern bindings, matching decisions, and
results in immutable snapshots. An observed cons cell does not imply that its
head or tail has been used. An IO action reaching its outer representation does
not imply completion of its effects. Delayed conditions can resume an earlier
call's captured scope; the UI labels this instead of inventing another call.

Local `where` values follow the same observation contract as arguments. A lazy
wrapper stays on the original binding RHS; demanding a shared binding records
its outer result once. It never evaluates unused definitions or list fields to
populate the panel. Each declaration has a distinct observation path within its
call context. A delayed local can be observed after its enclosing result returns;
that event displays the captured call rather than assigning it to another call.

The **Local bindings** section separates declarations from pattern bindings.
Before observation it displays the source expression with “not observed”; this
means no observation through this binding, not a claim about global heap state.
After demand it displays the observed value or partial structure. Snapshots do
not acquire information from future events. These choices follow
[HOOD's observation model](https://www.haskell.org/hugs/pages/users_guide/observe.html)
and [GHCi's distinction between non-forcing inspection and forcing](https://ghc.gitlab.haskell.org/ghc/doc/users_guide/ghci.html#the-ghci-debugger).
They retain the earlier Haskelite-inspired focus on explaining source bindings.

`local-bindings.js` discovers direct, simple `where` value declarations. Concrete
observers use explicit local signatures or conservative type-equivalent uses in
an explicitly typed result. Inferred observers require every reference to prove
the same concrete type, preserving polymorphic uses. Redefined/imported operators
and rebindable conditionals disable the corresponding inference. Unknown types
remain opaque; instrumentation adds no `Show` constraint. Nested local functions, destructuring declarations, and
`let` scopes are not exposed as local value definitions by this analysis.

Call-entry previews also retain **supplied expressions**, separately from
observed values. `call-sites.js` records direct saturated calls to functions in
the same module. An application marker associates that source call with the
actual demanded invocation; it does not speculate that every source call runs.
Literal lists/pairs and forwarded pattern bindings retain their supplied
structure. Thus the first call shows `countAtLeast 60 [60, 59, 60]` immediately,
and recursive calls show the remaining lists even before matching starts.
Arithmetic and arbitrary calls remain expressions until their values are
observed. The UI labels previews containing supplied expressions, and each
argument retains its separate `observed_repr` for the observation contract.
No expression is executed merely to produce a preview, and history never
borrows observations from a later step.

This source annotation deliberately avoids ambiguous lexical scopes (`let`,
lambda, `case`, binding generators, and potentially shadowing `where` names),
partial applications, and imported callees. Those calls still get their ordinary
runtime observations. Source previews and structural copying are bounded;
unknown or oversized portions remain opaque or abbreviated.

The renderer shares these views between the tutorial and debugger popout. Calls
show argument previews; equation rows pair source with textual status; conditions
show True/False and the selected branch. History entries describe their event.
Unavailable Watch and empty Globals sections do not consume space. An expandable
value guide explains underscores, preview limits, and type coverage.

No compiler bytes, persistence families, or keyboard shortcuts change. Existing
source-layout diagnostics, history limits, and cooperative-runtime cancellation
limits still apply. Nested local functions and IO statements do not have their
own call frames. Arbitrary watch evaluation and variable mutation remain disabled.

## Verification

The real MicroHs contract suite covers the motivating repeated-score example,
early catch-alls, false guards, imported modules, source mapping, stepping,
non-exhaustive/runtime errors, unused exceptions, infinite lists, partial tuples,
custom types, polymorphism, function-valued results, and source layout. Browser
coverage exercises the displayed explanation, history, keyboard controls,
popout synchronization, and accessibility. Tests compare concrete results and
observations, not the spelling of generated helper names.
