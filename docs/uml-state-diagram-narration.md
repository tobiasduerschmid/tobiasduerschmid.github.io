# UML state machine diagram narrated lesson

The UML state machine diagram chapter (`SEBook/uml_state_diagram.md`) opens with
an approximately 13-minute narration on the shared player in
`docs/narrated-pattern.md` (`kind: pattern`, topic `uml_state_diagram`). It
teaches the notation to students who have never seen a UML diagram: states,
transitions, what happens inside a state, and composite states. Speech and
teaching text live in `_data/narrations/uml_state_diagram.yml`; diagrams and cue
state live in `_data/narration_visuals/uml_state_diagram.json`; checks, notes,
code, and the behavior oracle live in `_data/explainers/uml_state_diagram_*.yml`.

## Running example

One campus delivery robot during one delivery: Driving, Waiting at your door,
Unlocked, and Returning to its base. The instructor chose it from three
candidates (a study timer, this robot, and a rental e-scooter). It gives every
element a natural moment:

| Element | Moment in the delivery |
|---|---|
| State, initial pseudostate, final state | The four situations; the trip starts in Driving and ends at the base. |
| Trigger and discarded events | `enterPin(code)` while Driving has no arrow, so it is ignored. |
| Guard and effect | `enterPin(code) [pin matches]`; `lidClosed / playThanks()`. |
| Time and change events | `after(10 min)` when nobody comes down; `when(battery < 15%)`. |
| Entry and exit behaviors | Unlocked unlocks on every way in and locks on every way out. |
| Do activity, completion transition | `do / driveToBase()`; the unlabeled arrow to the final state. |
| Internal transition versus self-transition | A wrong PIN must beep without restarting the 10 minutes (internal), while `extendWait` restarts them on purpose (self). Drawing the wrong PIN as a self-transition lets a prankster keep the robot waiting forever. |
| Composite state | Low battery in Driving, Waiting, or Unlocked becomes one transition from the border of Delivering; the lid still locks because exits run from the inside out. |

Each scene shows only the fragment of the machine it teaches, with a caption
when transitions are left out, so no diagram exceeds about eight symbols.
The review scene shows the whole flat machine (the battery transition still
leaves only Driving); the composite scene then generalizes the battery rule.
The summary quiz switches to a rental scooter so learners transfer the notation.

## Sources and how they were reconciled

The narration never names a source aloud; cues that draw on one show it in
their `source` field. Research digests were written from:

- **OMG UML 2.5.1 (formal/2017-12-05), Clause 14 and §13.3.** States as
  situations in which an invariant holds; transition syntax
  `trigger [guard] / effect`; internal, local, and external transitions (an
  internal transition runs no exit or entry behavior, and a doActivity keeps
  running); the initial transition carries no trigger or guard; the final state
  is a State and completes its region; unhandled events are discarded unless
  deferred; completion transitions have no trigger; time events (`after`) and
  change events (`when`, from false to true); execution order exit, effect,
  entry; group transitions exit innermost first.
- **Rumbaugh, Jacobson, and Booch, The Unified Modeling Language Reference
  Manual.** The file attached for this lesson is the first edition (1999,
  UML 1.x). Its notation for every element taught here agrees with the second
  edition (2005, UML 2.0), which was used for locators. Where the editions
  differ in wording (statechart diagram, action), the lesson follows UML 2
  terms (state machine diagram, effect, do activity). The manual measures
  `after(...)` from entry into the source state, which the narration says.
- **Clements et al., Documenting Software Architectures: Views and Beyond,
  2nd ed., Chapter 8.** Comprehensive models versus traces ("a video shows one
  delivery; the diagram shows all of them"), asking first "the states of what?",
  and drawing every transition out of every state (the timeout when nobody
  comes down). The review checklist builds on its advice.

Points where the sources leave room, and the lesson's choice:

- The spec's grammar writes `after 5 seconds` and `when x > 5` without
  parentheses; its own figures and the chapter use `after(…)` and `when(…)`.
  The lesson uses the parenthesized form throughout.
- `[else]` is defined for choice pseudostates. For two transitions that share
  a trigger, the lesson writes the opposite guard (`[pin wrong]`) instead.
- Neither book gives a naming rule for states. The "the robot is …" test is
  the lesson's own advice, presented as advice.
- Self-transitions re-running exit and entry follows from the spec's
  definitions of external transitions and is stated in the manual.

## Code

`uml_state_diagram_code.yml` holds two blocks per language. `first` maps states,
triggers, ignored events, guards, and effects onto direct assignments; `robot`
routes every state change through `transition` (exit, effect, enter) and adds
time, change, self, internal, and group transitions. The narration says
"such as an enum", because TypeScript uses a union of string literals that
Node's type stripping can run. `uml_state_diagram_ui.yml` lists event scenarios
and the expected actions; the topic test runs both blocks in every available
language against it. This machine had no JDK or `tsc`, so Java was not
compiled locally and TypeScript was only type-stripped.

Every cue in a code scene marks the lines it discusses. The window shows about
ten lines, fewer at 1440–1536 px, where commented lines wrap in the 50-character
code column. The code is ordered so that lines discussed together sit close:
the state field is set first, and the exit helper checks Unlocked before
Waiting. Where marks still cannot all fit, the block's `scroll` map names the
line to show:

- `order`: the transition helper;
- `extend`: `extendWait`;
- `guard_effect`: the guard;
- `lid_behaviors`: Unlocked's entry branch;
- `enter_exit`: the enter helper;
- `self_effects`: Waiting's exit branch;
- `states`: the enum in Python, and the state field in C++, whose data members
  come last (Java's and TypeScript's marks fit).

The spec checks the fit at 1280×720 and 1440×900.

## Renderer changes this lesson needed (ArchUML submodule)

- Internal transitions: `State : trigger [guard] / effect` rows and slash rows
  inside a state block are listed in the state's compartment. Rows without a
  slash keep their previous meaning (the TDD and Scrum diagrams are unchanged).
- A top-level highlight line no longer moves a nested state out of its
  composite, so `diagram_focus` works inside composite states.
- Self-transition loops are drawn after other routes, on the first face where
  neither the loop nor its label meets another transition.

`js/uml-auto-describe.js` now includes composite nesting, entry/exit/do rows,
and internal transitions in every state diagram's text alternative.

## Verification

```sh
node --test scripts/tests/uml-state-diagram-narration.test.js scripts/tests/uml-state-description.test.js
PLAYWRIGHT_CHROME_EXECUTABLE=... node --test scripts/tests/uml-behavioral-regressions.test.js
npx playwright test tests/uml-state-diagram-narration.spec.js
```

Then run `tests/narration-fullscreen.spec.js`, `tests/narration-navigation.spec.js`,
the notes tests, and `tests/wcag22-complete-audit.spec.js` filtered to the
chapter, both views, and the notes page.
