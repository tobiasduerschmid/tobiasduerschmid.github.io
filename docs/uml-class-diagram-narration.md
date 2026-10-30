# UML class-diagram narrated lesson

The UML Class Diagrams chapter opens with an approximately 14-minute narration on
the shared pattern-lesson player (`docs/narrated-pattern.md`). It teaches the basic
notation to students with no prior UML experience, starting from code they can
already read. Its running example is a study-group chat app: servers own channels,
channels own messages, members write messages and join voice channels, categories
group channels, and a new member redeems an invite.

The lesson uses `kind: pattern` because it needs the same parts as a design-pattern
lesson: four-language code, ArchUML diagrams that change per cue, section checks, and
the reader, print, and notes views. It is not a pattern description, so its script
declares its own `lesson.parts`: Classes, Generalization, Associations, and
Dependencies. `_includes/narrated-pattern-reading.html` passes those parts to the
reader and print views; lessons without `parts` keep the pattern default.

## Files

| File | Content |
| --- | --- |
| `_data/narrations/uml_class_diagram.yml` | Speech, scene order, teaching text, sources, pronunciations |
| `_data/narration_visuals/uml_class_diagram.json` | 36 ArchUML diagrams, code and diagram focus per cue, summary cards |
| `_data/explainers/uml_class_diagram_code.yml` | Python, Java, C++, and TypeScript blocks of one program |
| `_data/explainers/uml_class_diagram_quizzes.yml` | Twelve section checks and a six-question summary quiz |
| `_data/explainers/uml_class_diagram_notes.yml` | Handout key points for every cue |
| `SEBook/uml_class_diagram/read.html`, `print.html` | Reader and print views |
| `scripts/tests/uml-class-diagram-narration.test.js` | Structure, timing, code, diagrams, quizzes |
| `tests/uml-class-diagram-narration.spec.js` | Player, reader, themes, and mobile layout |

## Sources

The narration states each rule as a concept and never names a source aloud. Cues
that draw on one show it in their `source` field.

- **OMG Unified Modeling Language 2.5.1** (`uml_spec.pdf`): class notation and
  compartments (11.4, 9.2.4; a suppressed compartment allows no inference),
  property and operation syntax (9.5.4, 9.6.4), primitive types (clause 21),
  visibility kinds (7.8.24), multiplicity notation, with `*` equal to `0..*` and a
  single number for equal bounds (7.5.4), association semantics and notation,
  including links, navigability arrows, and "if no multiplicity is shown, no
  conclusion may be drawn" (11.5.3, 11.5.4), composite aggregation (9.5.3: a part in
  at most one composite at a time, deleted with it unless removed first; shared
  aggregation's semantics vary by application area), the constraint that the
  composite end's upper bound is at most 1 (9.9.17), generalization (9.2.4, 9.9.7),
  interfaces and realization (10.4.3, 10.4.4), and dependencies (7.7: the client's
  semantics are incomplete without the supplier).
- **Rumbaugh, Jacobson, and Booch, The Unified Modeling Language Reference
  Manual, 1st edition (1999, UML 1.x)**; every rule taken from it also holds in
  UML 2.5.1: classes as descriptors of objects with similar structure
  and behavior; attributes for plain data values and associations for connections
  among objects with identity; multiplicity counted from the opposite end
  ("multiplicity (of association)"); a missing visibility marker means not shown,
  not public ("visibility"); the purposes of generalization (substitutability and
  inheritance) and abstract operations in italics; realization drawn like
  generalization with a dashed line; a dependency means that a change to the
  supplier may require a change to the client; aggregation adds little to an
  association ("a modeling placebo"), while a composite is responsible for its
  parts' creation and destruction.
- **Clements et al., Documenting Software Architectures, 2nd edition**: Rule 3a,
  "Explain Your Notation" (the box-and-arrow sketch in the introduction), the
  generalization style that treats interface realization as another form of is-a,
  and Appendix A's "UML Class Diagrams: Too Much, Too Little" (draw one view per
  question rather than every relationship at once).
- **The SEBook chapter** (`SEBook/uml_class_diagram.md`): its aggregation and
  composition rules, which this lesson follows exactly. Composition is exclusive
  ownership: a part has at most one owner at a time and is deleted with it unless
  detached first, and the composite end shows `1` or `0..1`. Aggregation is a
  whole-part association without exclusive ownership whose lifetime UML leaves
  open; when unsure, a plain association is safe. Diamonds come from ownership
  rules, not from code syntax: references in Python, Java, and TypeScript look the
  same either way, while C++ value members or `unique_ptr` show ownership. The
  chapter's Python visibility mapping (`__name` private, `_name` protected) is the
  one the chapter's code analyzer uses.
- **CS 130 lecture 3 (UML 2)**: the scope and order of the class-diagram basics.
  Where the older slides describe aggregation as ownership, the lesson follows the
  SEBook chapter.

## Learning sequence

1. Introduction: a whiteboard sketch whose arrows could mean anything, then the
   same classes in UML as an advance organizer.
2. Classes: one class box from code (name, attributes, operations), then
   visibility, and how much detail a view shows. `Message` was chosen because it
   never changes later; its `author: Member` attribute returns in the
   associations section.
3. Generalization: text and voice channels share a name, renaming, and messages;
   the abstract `Channel` and its abstract `summary()`; substitution. Interfaces:
   `Mentionable`, realized by the unrelated `Member` and `Channel`, contrasted with
   generalization on one diagram.
4. Associations: the author attribute redrawn as a navigable association,
   multiplicities with a prediction (one voice channel per member at a time), then
   composition with a prediction (deleted accounts keep their messages) and
   aggregation (deleting a category keeps its channels).
5. Dependencies: `join(invite: Invite, nickname: String)` uses an invite without
   storing it; the stored member list is an association with `1..*`.
6. Reading a whole structural view, adding roles as a transfer task, and a
   summary quiz on a workout-tracking app.

## Notation decisions

- Association names are verb phrases placed mid-line (`written by`). ArchUML has
  no end-name position, and the specification places end names near the ends.
- Every association derived from stored references shows its navigability arrow.
  The transfer diagram, drawn before any code exists, shows no arrows at all.
- Constructors are left out of the class boxes, which the visibility section names
  as an example of a view choosing its detail.
- ArchUML draws an abstract class's name in italics with the property `{abstract}`
  below it, as UML 2.5.1 (9.2.4) and Rumbaugh describe. It used to add a «abstract»
  keyword, which neither source defines; the renderer was fixed for this lesson, and
  `scripts/tests/uml-abstract-class-notation.test.js` guards it. The narration
  teaches the italics; the abstract-class callout names both.
- Diagrams beside code stay within about 460 px of natural width, so the player's
  column (about 600 px at 1500 px) shows them near readable size: vertical layouts
  for the association, composition, and dependency scenes, interface boxes that list
  only what that scene discusses, and callouts above or below. The player scales any
  wider diagram down to its column. All variants of one scene keep similar widths, so
  a cue change moves emphasis without resizing the boxes.
- Every cue in a scene with code marks the lines it discusses and names them in its
  visual text. The code window shows about ten lines, so marks farther apart name the
  line to show in the block's `scroll` map, chosen for what the cue says: the subclasses
  while the narration introduces the two kinds of channels, Channel's `name` and `rename`
  for inheritance, the abstract `summary()`, and the stored member list.
- Callouts are teaching overlays, not UML. Each cue that needs a different callout
  switches to its own diagram variant; `scripts/tests/uml-class-diagram-narration.test.js`
  checks that every variant declares the classes it highlights.

## Speech

`speech.pronunciations` spells out `UML`, `C++`, the class names `TextChannel` and
`VoiceChannel`, the multiplicities `0..1` and `1..*`, and the noun `invite`, which
Kokoro otherwise stresses like the verb. Every section ends with at least 2.5 s of
silence before its check. Regenerate the audio after any change to `say`, pauses,
pronunciations, or the order or IDs of scenes and cues; diagrams, notes, quizzes,
and visual descriptions need no new audio.
