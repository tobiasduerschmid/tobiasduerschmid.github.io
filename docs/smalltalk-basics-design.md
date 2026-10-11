# Smalltalk in 30 Minutes

The tutorial at `/SEBook/tools/smalltalk-basics-tutorial` adapts the supplied
*Smalltalk OOP Tutorial Design* research document into a short SqueakJS activity.
Its source is `_data/tutorials/smalltalk-basics.yml`; the existing live-workspace
demo remains separate.

The existing automatic tutorial listing discovers the live page. No manual
navigation, chapter, or SE Gym links are added.

## Scope and Timing

Four missions budget 5, 7, 7, and 9 minutes, leaving roughly two minutes for
initial image loading and transitions. This is a planning estimate, not a
measured learner completion time. Audience: programmers who know variables and
functions, with no Smalltalk prerequisite.

The document's longer Pharo course is deliberately reduced to messages,
retained object state, Boolean blocks, and one subclass override. Traits,
metaclasses, `super` lookup, debugger instruction, refactoring, and the longer
application project are outside this lesson. The source examples are verified
in this project's pinned Squeak image rather than assumed portable from Pharo.

## Learning and Evidence

- Messages: predict before evaluating; change one argument; explain receiver,
  message, and result.
- Live objects: inspect a retained scorekeeper, accept a method edit, predict
  its next state, and refresh the same inspector. Automated checks separately
  verify the scoring behavior on fresh objects.
- Boolean objects: contrast `True>>ifTrue:` with `False>>ifTrue:` and explain
  delayed block evaluation. Explicitly acknowledge compiler inlining.
- Subclasses: inspect the class definition, change one override, explain `self`
  inside inherited behavior, and write a repeatable two-win Boolean check.

This preserves the source document's predict–observe–explain cycle and fading
from prepared examples to learner-generated checks. Explanations and predictions
are self-checks, not automatically assessed. Passing the behavior checks alone
is not evidence of conceptual mastery. Optional checks and ungated navigation
keep a short independent session moving.

## Maintenance

Each step is a separate prepared scene; live objects do not cross steps. The
native runtime and shared tutorial layouts own execution and presentation.
No lesson-specific runtime or styling is needed. Keep the print page paired
with the live page and retain stable step keys when making editorial changes.

`tests/smalltalk-basics-checks.spec.js` exercises authored checks and examples in
the real image, including alternative correct solutions and plausible wrong
ones. `tests/smalltalk-basics-tutorial.spec.js` covers the learner's Browser and
terminal paths, rendered accessibility states, automatic discovery, and print content.
