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
