# TLA+ and PlusCal tutorial backend

The `tla` backend runs the official TLA+ parser, PlusCal translator, and TLC
model checker in the browser. It is intended for small executable models and
explicitly separates a completed model check from inspecting one behavior.
The first introduction is **PlusCal and Temporal Logic** at
`/SEBook/verification/pluscal-tutorial`. It develops C-style PlusCal models,
counterexample interpretation, concurrent actions, and temporal properties
across ten lessons. Its print view is at
`/SEBook/verification/pluscal-tutorial/print`. The broader follow-up is
`/SEBook/verification/tla-tutorial`, with a matching print view at
`/SEBook/verification/tla-tutorial/print`.

## Authoring contract

Use one backend per tutorial and ordinary editable source/configuration files:

```yaml
backend: tla
autosave_type: files
require_tests: false
require_quiz: false
allow_skip_steps: true
tla:
  config_file: Model.cfg
steps:
  - title: States and Transitions
    key: states-and-transitions
    run_file: Model.tla
    open_file: Model.tla
    files:
      - path: Model.tla
        language: tlaplus
        reseed: true
        content: |
          ---- MODULE Model ----
          VARIABLE flag
          Init == flag = FALSE
          Next == flag' = ~flag
          Spec == Init /\ [][Next]_flag
          TypeOK == flag \in BOOLEAN
          ====
      - path: Model.cfg
        language: plaintext
        reseed: true
        content: |
          SPECIFICATION Spec
          INVARIANT TypeOK
```

`steps[].tla.config_file` overrides the tutorial setting. `run_file` identifies
the entry module independently of the active editor tab. Its module name must
match the filename. The `.cfg` file contains the finite constant assignments,
initial/next-state or specification selection, and properties to check. It is
part of the learner's editable, saved workspace. Additional named `.tla` modules
in the same folder can be imported with TLA+'s ordinary module mechanism.

Use stable step keys and `reseed: true` when lessons reuse filenames with
different starting models. Supply solutions through the existing
`solution.files: [{path, language, content}]` array. The normal tutorial draft,
Reset, solution-reveal, progress, and print conventions apply. There are no shell
setup commands and this backend is not available inside mixed-backend tutorials.

The current host boundary accepts at most 64 named `.tla`/`.cfg` files totaling
1 MiB, in one folder. It requests a maximum of 100,000 states and 30 seconds per
check. These are browser-workspace limits, not restrictions in the TLA+
language. A larger model can be edited here but cannot be claimed checked if a
limit prevents completion.

## Actions and conclusions

| Action or result | What it establishes |
| --- | --- |
| Check syntax / translate PlusCal | SANY can analyze the specification, or the PlusCal translator can produce TLA+. This does not check the configured properties. |
| Check every reachable state | TLC explores this configured model and checks its selected properties. A successful, completed result applies to this model, with its bounds, assumptions, and constraints. |
| Counterexample | TLC found a behavior violating a selected property, or a deadlock when deadlock checking is enabled. Inspect the states and the failing requirement. |
| Explore one behavior | The learner chooses among allowed next states. This is one behavior; other choices may have different outcomes. |
| Watch an operator | During live exploration, evaluates a defined operator without parameters at the selected state. It is not a universal property check or arbitrary debugger expression; completed counterexamples retain values for inspection but not a live evaluation session. |
| Incomplete, stopped, or error | No successful verification conclusion is available. A canceled or bounded run never earns a passing result. |

Checking and exploration translate supplied PlusCal modules automatically. The generated TLA+
is shown as derived output; editing the PlusCal source and running again
regenerates it. Authored `.cfg` properties must remain intact during translation.

Counterexamples expose state values and changes, action/source information when
available, and an explicit loop for repeating liveness behavior. Back, Next,
Jump to state, and the state list inspect the recorded behavior. A changed source
or configuration makes old results stale. This view is separate from the site's
imperative call-stack debugger: it does not claim expression-level stepping,
breakpoint suspension inside TLC, or compatibility with the desktop Debug Adapter
Protocol.

TLC model checking uses state fingerprints; a successful finite check is not an
unbounded mathematical proof. It also does not establish that the chosen
properties capture the intended requirements or that an implementation conforms
to the model. Explain state constraints, disabled deadlock checks, and fairness
assumptions wherever a lesson relies on them. Fairness excludes specified
infinite postponement behaviors; adding it does not repair a real scheduler.

## Declarative tutorial checks

Use an instructor-authored invariant and configuration to check the exercise's
requirement independently of edits to the learner's property/configuration:

```yaml
tests:
  - description: The flag remains Boolean.
    tla:
      status: complete
      invariant: 'flag \in BOOLEAN'
      model_config: |
        SPECIFICATION Spec
```

`invariant` requires nonempty `model_config`. For a temporal requirement, use
`property` instead; the two fields are mutually exclusive:

```yaml
tests:
  - description: The request eventually completes.
    tla:
      status: complete
      property: '<>done'
      model_config: |
        SPECIFICATION Spec
        CHECK_DEADLOCK FALSE
```

The assessment adapter creates a
separate, uniquely named module extending the learner's module and defines
`SEBookProperty` from the supplied expression. It supplies the trusted
configuration plus `INVARIANT SEBookProperty` or `PROPERTY SEBookProperty` to
TLC. Both the source and generated checking module
use the official tools; PlusCal in the learner's module is translated first.
The generated files do not replace the learner's editor files.

`model_config` can also be used without a supplied expression when an exercise needs a
trusted temporal-property configuration. Outcome-only checks remain supported
for intentionally exploratory tasks, but they use the learner's configuration.
The supported statuses are `complete` and `counterexample`, with optional
`reason`. Current reasons include `exhausted-state-space`, `invariant`,
`deadlock`, `liveness`, and `property`. Runtime errors, incomplete checks, and
cancellation are unassessed, not passes. Parse-only results and chosen-path
exploration must never be used to award model-checking credit.

The introductory PlusCal tutorial uses trusted checks for its invariant and
temporal-property exercises. Removing or weakening an editable property alone
cannot make a model satisfy the independently supplied requirement. The shared
**Test My Work** panel explains passes, counterexamples,
errors, and incomplete checks. No custom success/failure-message YAML fields
are introduced by this backend.

The property-writing lesson checks the learner's predicate against permitted
and forbidden reachable counts, then checks that the editable configuration
selects an invariant that fails on the deliberately faulty model. Its expected
counterexample is successful exercise evidence, not a correct algorithm.
The response lesson starts with the faulty initial-position implication
`Response == requested => <>delivered`. Learners repair its scope so later
requests create an obligation too. Two temporal implications compare the
submitted formula with the intended requirement on a fixed one-request model.
Together they require acceptance of quiet/successful behaviors and rejection of
the dropped-request behavior. This is equivalence over the fixture's behaviors,
not unrestricted formula equivalence.

The retry capstone combines safety and progress checks with reachability
witnesses for both successful upload and exhausted failure. Attempt accounting
requires bounded values and each transition to preserve the count or increase
it by one. `RetryLimit` counts every attempt, including the first. The
zero-budget check requires the count to remain zero and upload to remain false
throughout the behavior, as well as eventual termination. The witness checks
expect invariant counterexamples; a counterexample can therefore be a passed
exercise criterion. Instructor configurations use `RetryLimit = 2` and the
zero-budget boundary. The learner also checks 3 separately. These finite checks
do not establish every possible budget or every clause of an arbitrary edited
algorithm; the contract and explanations remain part of review.

Keep the oracle aligned with the exercise: even a trusted property cannot
establish that a learner's model adequately represents the intended system.
Removing all interesting behavior can make some properties vacuously true.
Both tutorials offer **Test My Work** with optional progression. The broader
four-lesson tutorial checks the bound at reference capacity 2, the concurrent
completion invariant, and the eventual-completion property. The ordinary
**Check every reachable state** action continues to use the learner's editable
configuration. Neither tutorial requires a gate merely because a checker is
available.

## Engine and deployment boundary

The semantic engine is the official `tla2tools.jar`, including SANY, `pcal.trans`,
and TLC. It runs on Java 11 through CheerpJ, separately from the site's existing
`java-worker.js` Java-subset-to-JavaScript transpiler. The engine is pinned under
`js/vendor/tlaplus/1.8.0-fc6878c603f0/`, with licenses and SHA-256 sums. This pin
is the official rolling build published on 2026-10-28, source commit
`56d37a9b7bf529086fd961160e0b8975e224eafc`; it is not labeled the older stable
1.7.4 release. Its tools JAR SHA-256 is
`fc6878c603f0fdc18b9fe3e5bf51860cb90ab5b1154e3c371660c036d6bdd63e`.

The host serves static assets and the model executes in the learner's browser;
there is no server-side verification service. CheerpJ's runtime download is a
separate third-party dependency, so first-run startup and network availability
matter. Browser memory, execution time, and available APIs differ from a desktop
JVM. Using the official implementation preserves its language semantics; it does
not promise that TLC can execute every mathematically valid TLA+ specification.
This backend does not provide TLAPS theorem proving, distributed TLC workers,
arbitrary uploaded Java override classes, or an unbounded state-space service.

CheerpJ is a proprietary browser JVM with a hosted Community License, distinct
from the open-source TLA+ tools. Its terms cover individual projects and require
attribution, which the workspace displays. Institutional deployment and
self-hosting have separate terms; see the [current CheerpJ licensing
documentation](https://cheerpj.com/docs/licensing.html). No CheerpJ runtime binary
is redistributed in this repository.

State-count and elapsed-time limits do not impose a hard memory ceiling on an
individual TLA+ value. A sufficiently large expression can exhaust a browser
tab's memory. This backend is intended for small instructional models.

`js/tla/client.mjs` fetches and SHA-256-verifies the two pinned JARs before
transferring them through a private `MessagePort`. It creates the runtime as a
`data:` URL, whose origin remains opaque with the sandbox tokens
`allow-scripts allow-same-origin`. The latter token lets CheerpJ's nested
vendor-origin helper use its own origin; it does not give the outer runtime
the SEBook origin. The runtime cannot read the tutorial's DOM or SEBook storage.
`tla-runtime-frame.html` supplies the template and pinned CheerpJ 4.3 loader;
`js/tla/frame.js` connects that frame to the Java bridge.

The opaque runtime uses the locally pinned `fake-indexeddb` 6.2.6 adapter for
its in-memory Java filesystem. Model files in that filesystem are discarded
with the frame. Tutorial drafts use the existing tutorial progress mechanism,
independently of the Java filesystem. CheerpJ runtime/helper assets still make
requests to the vendor CDN, and the vendor helper may maintain its own
origin-scoped runtime cache; this is not a claim that all third-party storage
is absent. The public `/cookies/` inventory describes that boundary.

`js/tla/model.mjs` owns workspace snapshots, result normalization, display values,
and basic outcome matching. `js/tla/assessment.mjs` builds trusted checks and
generates plain-text grading feedback. `js/tla/controller.mjs` owns result freshness,
session lifetime, selected states, and alternate exploration branches.
`js/tla/view.js` owns presentation, state navigation, next-state choices, and
operator evaluation controls. `js/tutorial-tla.js` integrates these components
with the shared tutorial editor, run transaction, source selection, and test
results. None reimplements TLA+ operators. `tla/src/sebook/tla/` owns the narrow
Java bridge to official semantic evaluation; `tla/README.md` documents the wire
format, build, and upstream provenance.

Checks and syntax operations release their JVM after completion. Exploration
retains one JVM until Stop, a new run, navigation, or disposal. Source edits
invalidate prior evidence. Trace and choice limits must be disclosed when the
display shows only part of a behavior or its available successors. Changes to
runtime isolation or persistence must remain in sync with the public storage
inventory.

## Lesson design and validation

The introductory PlusCal tutorial starts with a worked playlist model and a
boundary defect before asking learners to write a property. A ticket-reservation
example then contrasts interleavings with atomic actions. Temporal truth,
eventual completion, response requirements, and an upload capstone introduce
reasoning over behaviors. The final lesson revisits what the checked model
establishes. C-style PlusCal keeps the algorithm syntax familiar while the
lessons introduce property notation at the point of use. Tests and knowledge
checks remain optional, and all ten lessons can be selected directly.
Recurrence and stabilization are an optional, ungraded extension. The final
knowledge check uses a new response scenario rather than grading that extension.
The [design rationale](pluscal-tutorial-design.md) maps each lesson to specific
research findings, design inferences, and observable learner work. It also
records the limits of the evidence and the unmeasured pacing estimate.

The separate TLA+ and PlusCal tutorial's four lessons use a worked example,
a boundary repair, a concurrency contrast,
and a safety/liveness contrast. They introduce notation at the point of use and
ask learners to predict, check, inspect evidence, modify one aspect, and explain
the result. Hints direct attention to guards or atomicity boundaries rather than
reveal the repaired code. Full reference models stay in `solution.files`.

| Lesson | Starter evidence | Reference-model evidence |
| --- | --- | --- |
| States and Transitions | Complete check with three distinct states at capacity 2 | Complete check with four states at capacity 3 |
| An Invariant Counterexample | `WithinCapacity` fails at `count = 3` | Strict increment guard completes the check |
| Concurrent Updates in PlusCal | Both workers finish with `total = 1`, violating `AllCounted` | One atomic read/update action per worker completes the check |
| Safety, Liveness, and Fairness | `EventuallyDone` fails through infinite stuttering | Weak fairness excludes that behavior; the configured check completes |

`scripts/tests/tla-tutorial-content.test.js` executes the authored starter and
solution files with the pinned official translator/checker. It also checks the
final lesson's safety-only comparison: removing the temporal property succeeds
without establishing liveness. The suite uses temporary workspaces outside the
repository and preserves the original configuration after PlusCal translation.
It also executes the introductory PlusCal models, their defects, and their repairs;
the real assessment module and Java bridge verify that trusted checks accept
the reference programs and reject a faulty loop even after the editable
property/configuration is weakened.

Run it with an installed Java 11+ runtime:

```sh
JAVA_BIN=/absolute/path/to/java node --test scripts/tests/tla-tutorial-content.test.js
```

Without Java, those semantic checks are explicitly skipped, while the authoring
contract test still runs. `TLA_TOOLS_JAR` can select another official artifact for
an intentional upgrade comparison; the default is the pinned repository JAR.
These CLI checks establish fixture behavior, not browser-runtime compatibility.
Browser tests must separately exercise real startup, Stop, stale results,
configuration edits, keyboard navigation, and both live and print views.

Language references: Leslie Lamport's [TLA+ and PlusCal tutorial](https://lamport.azurewebsites.net/tla/tutorial/contents.html),
[PlusCal C-syntax manual](https://lamport.azurewebsites.net/tla/c-manual.pdf), and the
[official TLA+ tools source](https://github.com/tlaplus/tlaplus).
