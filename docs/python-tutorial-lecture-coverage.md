# Essential Python chapter and tutorial coverage

Source: `essential_python_handouts.pptx`, 29 slides supplied for this revision.
The student-facing tutorial is `_data/tutorials/python.yml`; its existing live
and print pages both consume that file. The companion chapter is `SEBook/tools/python.md`. The separate instructor demo
`python-lecture.yml` is not the target of this revision.

## Coverage and retrieval

| Lecture slides | Concept | First instruction and practice | Later retrieval |
| --- | --- | --- | --- |
| 2–5 | Names refer to objects; numbers and strings are objects; rebinding, `None`, lifetime | Names, Objects & References | Function calls, regex matches, dataclasses |
| 2–4 | Construction, `__init__`, `self`, methods, instance attributes | Objects & Member References | Copying, equality, inheritance |
| 6–7 | Class objects, shared class attributes, per-instance attributes | Class Objects & Instance Attributes | Copying and report snapshots |
| 8–9 | Assignment aliases; mutation is visible through aliases | Names, Objects & References; Objects & Member References | Type hints, loops, comprehensions |
| 10 | Shallow versus deep copying of outer and member objects | Aliases, Shallow Copies, and Deep Copies | Comprehensions, log-analyzer snapshot question |
| 11–13 | Identity, ordinary-class equality, `__eq__`, `isinstance` | Identity and Value Equality | Generated dataclass equality versus identity |
| 14–16 | Inheritance, initialization, `super`, dynamic dispatch | Inheritance and Method Dispatch | Mixed review within the object-model sequence |
| 17–18 | Immutable strings, concatenation, rebinding, garbage collection | Names, Objects & References | Regular-expression results |
| 19 | OpenCL context, parallel work-items, global IDs, bounds checks | Brief OpenCL connection in Hello, Python | Context only; not a Python coding requirement |
| 20–21 | Heterogeneous lists as arrays of references; indexing, membership, concatenation costs | Lists of References | Command-line indexing/copying decision |
| 22–23 | Nested lists, mutation versus rebinding an inner-list name | Lists of References | Shallow/deep copies, loop variables, comprehensions |
| 24–26 | Shared argument objects and independent parameter bindings; all six mutation/rebinding cases | Function Calls and Mutable Defaults | Annotated calls, collection loops |
| 27–29 | Definition-time defaults, accidental sharing, `None` sentinel | Function Calls and Mutable Defaults | File-processing destination, including an explicit empty list |

Member objects receive their own construction-and-sharing exercise before
copying. Class objects receive their own lesson before equality and inheritance.
Later checks distinguish local rebinding, mutation of a shared object, and
replacement of an attribute or list entry. Music and event examples replace the
lecture's geometry, professor, pet, fruit, and word-accumulation examples.

## Learning design

The new lessons isolate reference binding before combining it with functions and
classes. Runnable prediction examples precede repair or construction tasks.
Solutions stay in the solution panel; hints progress from the relevant object
relationship to a partial strategy. Knowledge checks combine current material
with an earlier concept after the component concepts have been taught.

The expanded tutorial is intended for multiple sittings. The first lesson gives
stopping points and asks learners to retrieve an earlier example when returning.
Existing scripting exercises remain, so the object model supports the original
automation objective rather than replacing it.

## Accuracy decisions

- Names, attributes, list entries, and parameters hold references. Physical
  addresses, exact allocation counts, and collection timing are not language
  guarantees. `None` is a singleton object.
- Argument passing shares the object while creating a separate parameter
  binding; it does not give the function a C++ reference to the caller's name.
- List concatenation, `append`, and `extend` have different behavior and costs.
  The complexity discussion identifies the usual CPython implementation and
  assumes constant-time element comparison for linear membership estimates.
- Deep copying supported member state preserves repeated references within the
  copy; immutable objects may be reused.
- A subclass that defines its own initializer must explicitly invoke a base
  initializer when that initialization is needed. Otherwise it can inherit one.
- Frozen dataclasses prevent ordinary field assignment, not mutation of member
  objects. Field equality and freezing are independent options. Hashing also
  depends on the participating field values.

## Companion chapter

The Python chapter explains the same object model through a robotic observatory,
with fresh examples distinct from the lecture and the music/event tutorial.
Its main practice link opens the local Python tutorial. Worked traces and
prediction prompts build the concepts; the tutorial supplies editable exercises.
The existing chapter quiz and both flashcard decks add mixed retrieval for
references, member objects, class state, copying, equality, calls, defaults, and
inheritance, using separate weather-station examples. Existing scripting topics
remain available.

## Reference diagrams and SE Gym retrieval

Eight Mermaid reference snapshots in the tutorial and seven in the chapter make
bindings, shared members, class objects, copying boundaries, and parameter scope
visible. They are concrete object graphs, not UML models. Rectangles represent
name bindings, rounded boxes represent objects, and labeled arrows identify
attribute or list-slot references. Captions state the inference to make; accessible
descriptions spell out the graph. Prediction reveals keep answers out of the
initial prediction phase.

The existing Python quiz now contains 29 questions, and each existing Python
flashcard deck contains 18 cards. The additional mixed practice includes choosing
a selective copy policy, passing a class object, contrasting list concatenation
with in-place extension, and distinguishing default evaluation from later name
rebinding. SE Gym discovers these existing deck IDs automatically; the tools and
current CS35L flashcard collections continue including them.

## Existing saved progress

The runtime stores completion by numeric step position, without a tutorial
content version. Inserting lessons changes what old completion marks refer to.
The first lesson explains this to returning learners and points to SE Gym's
export controls before a reset. Existing exercise filenames and drafts remain
unchanged. This content revision does not delete saved work or add a storage
migration.

## Verification approach

- Execute every authored solution against every step grader.
- Check new starters fail the intended exercises, correct alternatives pass,
  and plausible errors in sharing/copying/defaults are rejected.
- Run the existing YAML-driven Python tutorial browser suite, quiz wording
  audit, Jekyll build, and scoped accessibility audits for live and print views.
- Review new quiz snippets independently against their answer keys.
