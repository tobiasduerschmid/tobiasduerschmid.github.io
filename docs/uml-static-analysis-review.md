# Focused static-analysis improvements for UML inference

Reviewed 19 October 2026 against the four source analyzers, the nine chapter lab
families, and the class/sequence tutorials. This extends the
[sequence-inference evidence review](uml-sequence-research-evidence.md); it is
an engineering selection, not a new systematic literature review.

## Selected changes

### Track the object returned by a helper

`selected = selector.choose(original); selected.read()` should call the
original object's lifeline when `choose` returns that argument. Returning
`self`/`this` likewise should not create another instance. Before this change,
some analyzers invented a receiver or omitted the next call.

`js/uml-return-summaries.js` tracks symbolic origins: the receiver, a particular
parameter, or unknown. Local assignments copy origins. Alternative paths keep
a definite origin only when they agree, and a method summary requires every
considered path to return that same origin. An implicit return, disagreeing
returns, unsupported control flow, or an exhausted budget declines the summary.
This follows the transfer-and-join approach described in
[Clang's introduction to data-flow analysis](https://clang.llvm.org/docs/DataFlowAnalysisIntro.html#formalization),
using a much smaller domain tailored to object identity.

Language adapters build these summaries lazily and cache them per parsed
method. Calls apply the result to the actual receiver and arguments captured
at that call site. The summary does not prove purity, remove calls, evaluate
guards, or authorize dropping side effects. A new allocation remains distinct.
C++ by-value returns cannot use borrowed-object identity merely because their
source expression names a parameter.

The shared traversal permits at most 128 statements, eight nested levels, and
32 parameters. Adapters bound their token/AST scans too. Unsupported cases
keep the existing symbolic inference and diagnostics; no solver or learner-code
execution is introduced.

### Resolve known behavior before expanding a call

An empty subclass can inherit behavior. Python and TypeScript now include
inherited methods when deciding whether a class contributes sequence
interactions, using cached inheritance traversal with cycle protection.
This does not add inherited members to the class's own declaration compartment.

Java also distinguishes unambiguous fixed-arity overloads before selecting a
body or return summary. Same-arity, variable-arity, and unresolved inherited
ambiguities remain conservative. This is a limited candidate filter, not Java's
complete overload algorithm: the specification also considers argument types,
conversions, variable arity, and the most-specific applicable method.
See [JLS §15.12.2](https://docs.oracle.com/javase/specs/jls/se25/html/jls-15.html#jls-15.12.2).

## Considered but not added here

| Technique | Potential benefit | Reason to retain the current boundary |
| --- | --- | --- |
| Constant values joined across general branches | More known iterable labels after conditional assignments | Requires further type, scope, escape, and loop-state handling beyond the existing bounded literal propagation. |
| Full points-to sets and heap summaries | More field-return and polymorphic-call precision | Must represent alternative objects and heap effects consistently rather than choosing one plausible receiver. |
| Predicate solving and unreachable-branch pruning | Eliminate infeasible paths | Changes what teaching diagrams promise; current exercises deliberately compare possible paths and reason about conditions. |
| Interprocedural collection-value propagation | Show literal items through helper parameters | Needs alias/mutation guarantees across calls; a returned-object identity summary is insufficient. |

## Teaching and verification contract

The receiver lab now distinguishes returning an existing object from allocating
a new one. The sequence chapter and return-values tutorial use the same
distinction. Returning an object and drawing a reply arrow are separate choices:
the tutorial's existing consumed-result convention still controls reply display.
Design and Implementation views share the same object identities, calls, and
control-flow structure. Their spelling differences do not prove equivalent
designs, ownership intent, or runtime outcomes.

Verification pairs successful alias, receiver, and agreeing-branch cases with
rebindings, differing returns, fallthrough, unsupported flow, scope shadowing,
and C++ value-copy counterexamples. Existing tutorial grading and published
diagram targets remain part of the regression suite. Browser checks exercise
the shared worker and fallback paths; timing measurements distinguish warm
inference from compiler startup and rendering.
