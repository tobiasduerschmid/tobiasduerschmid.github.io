# Python object-reference labs: teaching review

Reviewed 2026-10-03. Scope: all twelve previous placements (six in the Python
chapter, six in the interactive tutorial), all seven previous source examples,
and the neighboring explanations, worked examples, tasks, and quizzes. The
revised set contains eight shared example records, each embedded once on each
surface. This is a teaching-design review, not a study of student learning.

The audience is programmers transitioning from C++ to Python, with functions,
lists, objects, copying, and equality introduced in sequence in the tutorial.
The supplied `essential_python_td.pptx` is a source of concepts, not operational
instructions. Examples use different code and situations from the lecture.

## Selection principle

Keep a lab when the student must distinguish competing models by following an
object or reference across a consequential statement. Ask for an intermediate
relationship as well as output: object counts, two expressions reaching one
object, or which stored reference moves. Then ask for a controlled edit and a
new prediction. Clicking Forward or arriving at the right output is not alone
evidence that the student understands sharing.

The separate [research record](object-reference-pedagogy-research.md) contains
search provenance, lecture locators, primary sources, study designs and access
limits. In particular, Rørnes, Runde, and Jensen's Python study shows why an
immutable-value example can yield a correct answer under both a correct
reference model and an incorrect copy-value model. Fisler, Krishnamurthi, and
Wilson document difficulty transferring scope/mutation reasoning between
languages. Johnson, McQuistin, and O'Donnell give direct Python evidence for
confusion around superficially similar list operations. These are reasons to
make the reference distinction observable; they do not validate these exact
activities or establish a universal ranking of the most common errors.

## Every previous placement

| Previous placement | Decision | Learning reason and resulting change |
| --- | --- | --- |
| Tutorial `references`: `names_rebinding` | Remove lab | Inline string leaves hide the very identity relationship at issue. The existing title/poster prediction, explicit string-object snapshot, and independent assignment task remain; they also avoid prematurely introducing list operations. |
| Chapter `None and Reachability`: `names_rebinding` | Remove lab | The saved-ticket string case repeats nearby immutable rebinding, but does not visualize reachability. Keep the short None/alias prediction and explanation; do not simulate destruction timing with a tracer that retains references. |
| Tutorial `lists`: `shared_slots` | Revise and substitute | Replaces the opening/sets code, static diagram, and repeated walkthrough with one editable scene. Append changes a shared object; explicit slot assignment changes one reference. The changed-code task rebinds the separate name instead. |
| Chapter `Nested Lists: Mutation and Rebinding`: `shared_slots` | Revise and substitute | Replaces the static nested-list prediction. Students follow both slots before and after mutation/replacement. `+=` versus `+` remains a later optional contrast after argument semantics, rather than the first list reference example. |
| Tutorial `members`: `member_sharing` | Keep, refine prompt | Distinct outer instances can retain one supplied member. Construction and `self` are taught first. Students pause in `add`, identify `self`, then compare member mutation with replacing one attribute. Use a neutral title. |
| Chapter `Member Objects Are References Too`: `returned_member_alias` | Replace | Receiver rebinding, a helper call, a second construction, a returned receiver, and a saved member alias introduce too many simultaneous targets here. Use `member_sharing`; nested-call runtime behavior remains tested with a separate test program. |
| Tutorial `classes`: `class_attributes` | Simplify | `+=` both mutates and assigns, obscuring which operation creates an instance attribute. Use append followed by explicit instance assignment, then a variation assigning the class attribute. Retain the preceding scalar lookup explanation and independent per-instance-list task. |
| Chapter `A Shared Mutable Attribute`: `class_attributes` | Simplify and substitute | Replace the duplicate ReviewBatch walkthrough. Inspect where the attribute exists, instead of guessing from the spelling `first.items`. Mutation does not itself install an instance attribute. |
| Tutorial `copies`: `shallow_copy` | Revise and substitute | Remove the unnecessary `fork` helper and replace the redundant nested-list snapshots with the lab. Compare shallow/deep copying and repeated internal references; keep the custom Show/Mixer example and independent `versions` task as transfer. |
| Chapter `Assignment, Shallow Copy, and Deep Copy`: `shallow_copy` | Revise | The diagrams and prose transfer the rule to custom members. The lab exposes shallow sharing and deep copy's preserved internal aliasing; it replaces the separate static repeated-camera prediction. |
| Tutorial `calls-defaults`: `parameter_rebinding` | Simplify | Replace rotation/pop with append, local assignment, return. Remove the redundant parameter-rebinding Mermaid snapshot. Retain the six helper cases/table and independent task because they vary strings, list slots, and custom objects. |
| Chapter `Passing Arguments`: `parameter_rebinding` | Simplify | Students compare caller and local parameter at two pauses, then identify which call-site binding receives the return. No queue-rotation algorithm is needed to explain the distinction. |

## Additions and what students must do

| New placement on both surfaces | Wrong model being tested | Visible evidence and reattempt |
| --- | --- | --- |
| Equality: `identity_equality` | Equal contents imply one object; another name necessarily creates another object. | Count two list objects and three names before comparison; predict which names observe append. Replace the second list construction with alias assignment and re-predict Booleans and mutation. This complements custom `__eq__`, rather than teaching a new equality policy. |
| Mutable defaults: `mutable_default` | Omitted arguments create fresh defaults on every call; returning a list freezes a snapshot. | On entry to call two, compare its parameter with the previously returned `first` alias. Predict whether that earlier result changes. Supply a newly constructed list to just the second call, then use the separate None repair pattern. |
| Loops: `loop_rebinding` | The loop name aliases a container slot, as a C++ `auto&` variable can. | Follow the loop name before/after its assignment and across both iterations. Replace assignment with `clear()` and compare the unchanged final empty loop value against the different outer-list contents. This repairs an overly broad C++ analogy in the tutorial and supports its existing transfer quiz. |

These additions follow the lecture and language semantics; direct empirical
frequency evidence is not available here for every individual Python trap.
Class-default, deep-copy, equality, and default-argument priorities are also
curricular judgments. The research record distinguishes those from observed
student-model findings.

There is deliberately no ninth widget for repetition/comprehensions. A short,
independent prediction compares `[[0]] * 2`, repeated evaluation of a name,
and evaluation of `[0]` per iteration. Its feedback explains that construction,
not comprehension syntax alone, creates independent rows. That provides later
transfer of the list lesson without another full playback activity.

## Representation and workload safeguards

- The diagram abbreviates primitive values in place. First-use prose explains
  that this does not introduce a different Python value/reference semantics.
- Default-function storage is not drawn. Both surfaces say so and use the
  parameter/returned alias as the visible evidence; prose explains retention.
- Short neutral titles leave the prediction open. Prepared explanations give the
  original result and causal account. A separate visible **Try one change**
  prompt keeps the prediction task available during editing; **Check the suggested
  change** hides the variant answer until requested. Reset closes both reveals.
  Printing the prepared example includes both prompts and answers; edited-code
  printouts do not attach those prepared answers to arbitrary code.
- The first tutorial lab distinguishes its editor from the independent task's
  editor. Prepared lab code is not the exercise's completed implementation.
- Current step keys, starter files, solutions, tests, quizzes, and progress
  configuration remain unchanged. Instructional examples replace duplicate
  tours where feasible. Most lessons use one lab; the calls lesson has two
  because local rebinding and reuse across separate calls are distinct contrasts.
- The `+=` synthesis is retained in chapter prose with a predict/check variation,
  supported by the direct Python operator-confusion study. Its extra semantics
  do not burden the introductory class/list traces.

## Verification and teaching follow-up

Execute the source and every authored variation; check the intended identity
relationships, not only output. Prepared traces must be complete and agree with
the browser interpreter. Browser checks cover actual rendered arrows, forward
and backward playback, inline editing, lesson navigation, detached instructions,
mobile themes, and complete print transcripts. Automated accessibility checks
are useful evidence but are not a manual WCAG certification.

A future classroom check should ask students to predict a fresh, unanimated
program, mark which expressions reach one object, and explain a changed line.
Compare the reason and transfer response with the initial prediction; do not
count playback completion or favorable reactions as a learning gain. Such a
learner evaluation has not been performed for these revisions.
