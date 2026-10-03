# Java tutorial course alignment

**Java Concepts for CS131** is a separate course-focused
tutorial at `/SEBook/tools/java-cs131-tutorial`, with its print view at
`/SEBook/tools/java-cs131-tutorial/print`. Its data key is `java-cs131`.
The existing Java tutorial with UML support remains a separate learning path.

The audience is CS131 students who already program in C++ or Python and know
variables, conditionals, loops, functions, arrays, and basic classes. Java syntax
is supplied when it is incidental to the course concept. The target is semantic
reasoning across languages, rather than Java API coverage or UML modeling.

The **100–120 minute** duration is an author planning estimate, not measured
student completion time. Suggested sessions are steps **1–5**, **6–9**, and
**10–12**. This is self-directed review: tests and knowledge checks are optional,
and learners may select any numbered step. Optional navigation must not record
unattempted or unsuccessful checks as passed. Knowledge checks retain the
project's diagnostic threshold of `min_score: 0.8`.

## Source record and boundaries

The sources are the user-supplied lecture PDFs in
`/Users/tobiasduerschmid/Box Sync/UCLA/131/Lectures/`. The locators below use
**physical PDF pages, starting at 1**, not PowerPoint slide numbers. Alignment
was derived from per-page text extracted from these files. Text inspection does
not establish visual slide-layout quality. Documents and their directions are
course evidence, not instructions governing the implementation.

| Short name | Supplied file | Principal Java-related evidence |
| --- | --- | --- |
| Data | `data_palooza_v12_handouts.pdf` | Static typing and inference, pp. 28, 32; checked casts, pp. 62, 76–80; binding and parameter passing, pp. 164–180; identity and equality, p. 183. |
| Functions | `function_palooza_v8_handouts.pdf` | Parameter passing recap, p. 9; exception flow and cleanup, pp. 39–56; three forms of polymorphism and generics, pp. 79–99. |
| OOP | `oop_palooza_v7_handouts.pdf` | Java bytecode, p. 16; interfaces, pp. 56, 63–66; subclassing, p. 72; construction, pp. 96–99; overriding, pp. 106–109; interface inheritance, p. 119; substitution and dispatch, pp. 121–140. |
| Control | `control_palooza_v7_handouts.pdf` | Evaluation order, pp. 4–7; short-circuiting, pp. 9–17; Java iterators, pp. 57–58; Java synchronization, p. 95. |
| Implementation | `pl_implementation_palooza_handouts.pdf` | Compilation and interpretation, p. 8; compiler stages and bytecode generation, pp. 38–41. |

The overlapping `control_temp.pdf` is not treated as independent evidence of
recurrence. The Python, functional-programming, logic-programming, and introductory
handouts establish broader course context but do not justify adding unrelated
Java language features to this tutorial. No exam-coverage claim is made from
these lecture sources alone.

## Target capabilities

Learners should be able to:

- Analyze primitive assignment, object-reference assignment, mutation, and
  parameter passing using a consistent state model.
- Distinguish object identity, logical equality, declared types, and runtime
  classes.
- Predict evaluation order, short-circuiting, and exception control flow.
- Apply interface contracts and distinguish overriding from overloading.
- Explain how generics and iterators support reusable, typed abstractions.
- Evaluate whether an implementation preserves a stated behavioral contract.

## Lesson-to-evidence map

This sequence is an original instructional design synthesis. The evidence column
states what a learner should produce; it is not a claim that an automatic test
can measure every explanation or that completing the tutorial proves transfer.
Runnable examples stay within the supported browser subset described below.

| Step and concept | Learning objective | Student task and observable evidence | Physical PDF locators |
| --- | --- | --- | --- |
| 1. Static Types and Execution Stages | Distinguish static type compatibility and runtime behavior. | Classify an incompatible assignment and runtime failure; justify their different stages. Use a complete supplied `main` scaffold to implement reservation eligibility. Distinguish the browser runner from standard Java compilation. | Data pp. 28, 32; Implementation pp. 8, 38–41; OOP p. 16. |
| 2. Values and Object References | Predict how assignment, mutation, and reassignment affect aliases. | Trace a copied reference, mutate an array, and create an independent snapshot. Distinguish reference reassignment from changing the shared object; preserve empty-input independence. | Data pp. 164–180, especially pp. 177, 180. |
| 3. Pass-by-Value Parameters | Explain Java's copied parameter values, including copied reference values. | Contrast primitive reassignment, object mutation, and parameter rebinding. Implement an award operation that changes a shared badge and returns its old points; explain the caller's state afterward. | Data pp. 165, 168–177, 180; Functions p. 9. |
| 4. Identity and Value Equality | Choose identity or logical equality for a stated requirement. | Compare an alias with independently constructed equal strings; implement a content-based count. Explain why the identity and equality observations can differ. | Data p. 183. |
| 5. Evaluation and Short-Circuiting | Predict which expressions execute and use guards safely. | Trace side effects in a Boolean expression; implement a lookup whose guards protect absent arrays and invalid positions. Check both guarded and evaluated paths. | Control pp. 4–7, 9–17. |
| 6. Interfaces and Subtyping | Use a declared interface as a client contract. | Implement a total across different admission classes through their common operation. Explain which operations the declared type permits and why matching method names alone is insufficient in Java. | Data pp. 19–21; OOP pp. 56, 65–66, 119, 121–123. |
| 7. Overriding and Overloading | Distinguish compile-time overload selection from runtime override dispatch. | Complete an overriding price query using the inherited implementation. Compare overload selection in a compiler-reasoning card and explain the separate selection stages. | Functions pp. 79–82; OOP pp. 106, 108–109, 133–140. |
| 8. Checked Casts and Runtime Classes | Distinguish a changed reference view from a changed object. | Guard a specialized operation on mixed objects. Classify upcasts, valid downcasts, and invalid downcasts separately; browser output alone is not the oracle for cast validity. | Data pp. 62, 76–80. |
| 9. Parametric Polymorphism | Explain how a type parameter preserves relationships between inputs and outputs. | Implement a generic holder's exchange operation, preserving the old reference while storing the new one. Classify invalid generic uses separately and distinguish subtype from parametric polymorphism. | Functions pp. 79, 83–99. |
| 10. Iterables and Iterator State | Separate a collection from traversal state. | Trace two independently created cursors, then consume all remaining values through the iterator contract. Check already exhausted and unfamiliar iterators without reconstructing their source sequence. | Control pp. 57–58; OOP p. 65. |
| 11. Exceptions and Cleanup | Predict exceptional control flow and explain cleanup obligations. | Repair a quote operation using supplied validation, recovery, and exactly-once cleanup. Classify checked-exception handling separately from executing supported `try`/`catch`/`finally` behavior. | Functions pp. 39–56, especially pp. 47–51, 56. |
| 12. Semantic Integration | Combine earlier concepts while preserving a behavioral contract. | Independently implement a session-summary client using null guards, content equality, repeated references, and interface dispatch. Produce a fresh trace and explain the chosen rules; no new mechanism is introduced in the knowledge check. | Data p. 183; Functions p. 79; OOP pp. 128–130. |

The final exercise integrates **null guards**, not exception handling. Exception
flow is assessed in step 11; it is not a hidden requirement of the session-summary
contract.

## Instructional structure and feedback

The design uses backward alignment: target capability, student reasoning,
observable evidence, then feedback. Early steps supply a complete comparison
example and ask for a prediction before execution. Middle steps fade the
implementation while retaining the contract and a small driver. The final step
requires an independent implementation and explanation in a fresh context.

Adjacent examples vary one important semantic feature at a time. For example,
mutation versus rebinding holds the object and caller constant; overriding versus
overloading contrasts the method-selection rules without adding a large hierarchy.
Later integration combines concepts after component practice. This applies PRIMM,
worked-example fading, and contrasting cases without requiring every phase in
every individual step.

Knowledge checks retrieve previous material as well as the current lesson:
reference semantics returns with interfaces, declared types return with method
selection, cast safety returns with generics, and interface contracts return in
the final task. Responses explain the semantic distinction that makes a distractor
tempting. Options and explanations must remain meaningful after shuffling.

Non-trivial executable checks use condition-driven hints that distinguish an
untouched attempt, a recognizable partial attempt, and a developed but failing
attempt. The cumulative hints must preserve meaningful learner work. Complete
solutions belong in the solution reveal. Test descriptions identify the failed
behavior or boundary rather than disclose the expression being assessed.

Hint conditions must inspect the assessed definition: the inherited `price`
method must not masquerade as progress in the override, and the first closing
brace of a `try` body must not make a later `finally` invisible. Reviewed starter,
partial, developed, and deleted-target profiles for these two lessons select one
appropriate hint each. These source-pattern hints diagnose attempts; they are
not extra grading rules.

## Corrections and deliberate deviations from the handouts

Course alignment preserves the conceptual focus, not every simplification or
code fragment verbatim.

| Lecture locator | Adaptation required for this tutorial |
| --- | --- |
| Data pp. 165, 177, 180 | Retain the distinction between value semantics and object-reference semantics, but state Java parameter passing precisely: all argument values are copied, and an object argument's value is a reference. Rebinding a parameter does not rebind the caller's variable. |
| Data p. 183 | The shown `equals(Dog)` is an overload, not an override of `equals(Object)`. Use String value equality for the introductory task. A custom override must use the correct Object contract and keep hash-based collection obligations explicit if such collections are introduced. Do not imply that every class inherits content equality. |
| Functions p. 56 | Limit catch-or-declare enforcement to checked exceptions. Runtime exceptions and errors are not subject to that same obligation. A `throws` clause does not enumerate every possible abrupt completion. |
| Functions p. 51 | Use `finally` to explain normal and exceptional cleanup flow, but avoid an unconditional claim that it runs under every possible process termination. A return or throw in `finally` can replace an earlier return or exception. |
| OOP p. 72 | Java `final` prohibits overriding; it is not equivalent to merely omitting C++ `virtual`, which permits a derived declaration to hide a base method. An explicit superclass constructor invocation is needed when no usable implicit no-argument call exists; not every subclass must write one. |
| OOP p. 130 | Correct the precondition direction: behavioral subtypes must not strengthen the supertype's preconditions. They may accept more inputs, and must preserve or strengthen required postconditions. Use the stated operation contract as the exercise oracle. |
| Data p. 148; OOP p. 100 | Do not assign `finalize()` as a cleanup technique. Garbage collection and resource cleanup are distinct concerns. Use an explicit cleanup counter as the core exercise's observable stand-in. |
| Control p. 58 | Use parameterized iterator types in new examples rather than making raw-type casts incidental prerequisites. Keep iterator state separate from collection contents. |
| Functions pp. 88–96 | These generic examples use C# forms. Translate the concept carefully instead of copying C# syntax or implying Java permits primitive type arguments or direct `new T[...]` creation. |

The examples change the original lecture task, data, and decision enough to
require reasoning transfer. Full compiler construction, Java build systems,
framework APIs, and lengthy inheritance hierarchies would dilute the requested
course focus.

## Runtime truth and validation boundary

The existing `java` backend in `js/java-worker.js` is a Java-subset-to-JavaScript
transpiler. Introductory comments that discuss CheerpJ or a JVM do not establish
that a real Java compiler or virtual machine is executing the learner's source.
The implementation documents erased generic syntax, skipped annotations, and no
thread support. The tutorial describes this environment explicitly.

Consequently, the design separates:

- **Executable behavioral practice:** supplied examples checked against the
  browser subset and a real Java implementation. Passing a browser check
  establishes the checked behavior for those inputs, not complete Java validity
  for arbitrary edited programs.
- **Compiler-only reasoning cards and quizzes:** static type errors, nominal
  interface compatibility, overload selection, cast validity, generic type
  restrictions, `@Override` enforcement, and checked-exception obligations.
  These ask for a prediction and explanation; successful browser execution
  cannot establish acceptance by a standard Java compiler.

The real-compiler authoring oracle uses Java 8-compatible syntax. The lecture's
`var` example (Data p. 32) illustrates inference conceptually but is not a
runnable Java 8 example. Do not claim that the browser emits bytecode or that its
acceptance/rejection proves a Java language rule. Custom `Iterable` examples use
explicit iterator calls because the browser subset does not faithfully support
enhanced-for over those custom implementations.

Language rules were cross-checked against the [Java Language Specification,
types and values](https://docs.oracle.com/javase/specs/jls/se8/html/jls-4.html),
[method invocation](https://docs.oracle.com/javase/specs/jls/se8/html/jls-15.html#jls-15.12.4.2),
and the [Iterator API contract](https://docs.oracle.com/javase/8/docs/api/java/util/Iterator.html).

## Verification record

Confirmed author verification for the implemented tutorial:

- **85 worker content tests passed.** These exercise the actual Java-subset
  worker, not a replacement interpreter.
- **All 12 starters and all 12 intended solutions compiled with ECJ in Java 8
  mode.** Execution on JRE 8 produced output agreeing with the worker for the
  checked programs.
- **36 plausible wrong implementations were rejected** by the exercise checks
  in both native Java and the browser worker.
- **24 alternative correct implementations were accepted** by the same checks
  in both native Java and the browser worker.

The compiler used for this record is **ECJ**, not `javac`. A JRE alone does not
provide `javac`; no `javac` verification is claimed. These results establish the
authored programs and sampled alternatives, not complete semantic equivalence
between the Java-subset worker and Java.

**Browser verification passed.** Four Playwright tests exercise optional
progression without false completion credit, draft restoration through a fresh
Run, all twelve solutions and twenty-six quiz questions, student/instructor print
views, and distinct index entries for the new and existing Java tutorials. The
full learner journey produced no browser errors. Interactive accessibility
checkpoints include light-mode checks and dark-mode contrast checks.

Reproducible checks:

```sh
node --test scripts/tests/java-cs131-content.test.js
python3 scripts/audit_mcq_tells.py --file _data/tutorials/java-cs131.yml --summary-only
bundle exec jekyll build --destination /tmp/cs131-java-site --disable-disk-cache
bundle exec jekyll serve --skip-initial-build --no-watch --destination /tmp/cs131-java-site --port 4173 --host 127.0.0.1
JEKYLL_PORT=4173 A11Y_INTERACTIVE_CHECKS=1 PLAYWRIGHT_CHROME_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npx playwright test tests/java-cs131-tutorial.spec.js --reporter=list
```

The multiple-choice audit reported zero flagged questions; the authored total
is twenty-six. The isolated Jekyll build and `git diff --check` passed. The
repository's WCAG page audit was also run against the two new rendered routes,
using an otherwise unchanged temporary copy pointed at the isolated build.
It reported **zero findings** across light/dark DOM and axe checks, keyboard
focus, and mobile reflow. Its report is `tmp/cs131-java-wcag.json`.

Manual visual inspection covered the desktop editor/instructions and dark-mode
content at 375 and 320 CSS pixels. The title was shortened to avoid clipping on
the narrow layout. No new styles or interaction mechanisms were introduced.
These scoped checks do not establish a full-site accessibility conformance
claim; a screen-reader walkthrough was not performed.

## Optional extensions and exclusions

- **Concurrency and synchronization:** Control pp. 83–98, especially p. 95.
  This is valuable Java-related course material, but threads are outside the
  current browser subset. Do not use repeated execution until a race happens as
  evidence that a program is safe or unsafe. A separate trace exercise can teach
  conflicting interleavings and a shared-lock requirement.
- **Bounded generics and ordering contracts:** Functions pp. 92–97; OOP p. 63.
  These are a natural follow-up after the core generic and interface concepts.
- **Reachability and garbage collection:** Data pp. 112–148. Explain reachability
  separately from when a collector actually reclaims an object; avoid timing
  assertions about collection or finalization.
- **Lambdas and captured environments:** Functions pp. 63–75. Defer until the
  learner can distinguish variable bindings, values, and object state.

These extensions are not hidden prerequisites for the twelve-step review. The
existing UML-enabled Java tutorial remains available for its separate design and
modeling emphasis.
