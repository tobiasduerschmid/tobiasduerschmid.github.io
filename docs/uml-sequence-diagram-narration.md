# Sequence-diagram narrated lesson

The UML sequence-diagram chapter (`SEBook/uml_sequence_diagram.md`) opens with an
approximately 12-minute narration built on the shared pattern player in
`docs/narrated-pattern.md`. It is a notation lesson, not a design pattern, so it
declares its own parts (Lifelines, Messages, Activations, Fragments) in
`lesson.parts`; the rest of the player, reader, print view, and checks are shared.

The audience already reads UML class diagrams. The lesson starts from the game's
class diagram and adds what it cannot show: who sends which message to whom, in
what order, in one scenario.

## Running example

A space-exploration game. The instructor first chose a turn-based battle from three
candidates (a streak-saving language-learning round and a concert presale ticket
hold were the others), then asked for an example with less pain, and picked the
space probe from three gentler options (a cozy farm and a café order rush were the
others). The probe scans every asteroid in range. The code
(`_data/explainers/uml_sequence_diagram_code.yml`) is `Probe.scanAll(rocks)`:

- `sfx.play("ping")`: playing a sound only queues it, so the probe never waits.
  It is the lesson's asynchronous message.
- `scanPower()`: a self-message returning three times the probe's level.
- for each rock: `scan(power)` returns the points still unscanned, which decide
  between `collectSample()` (a reply with the crystals) and `tag(2)` (no reply).
- if every rock was fully scanned: the probe constructs a `StarMap` (the creation
  message) and queues the chime.

The lesson teaches on a concrete run first (a pebble that needs 10 points of
scanning and a boulder that needs 20, so no star map), then generalizes it into one
diagram with loop, alt, and opt fragments, and finally asks students to unroll that
diagram for a new run (a pebble and a shard, so the opt runs). The transfer
exercise translates a docking station's recharge into a diagram (loop, synchronous
check with a reply, opt, and an asynchronous beep). The summary quiz uses a new
scenario, a flashcard app.

Choices that keep the notation exact:

- **No destroyed lifeline (X).** Inside a loop, one lifeline stands for a
  different rock on each pass, so ending it would leave the next pass without a
  participant, and in the garbage-collected languages there is no destruction event
  for the code to show. None of SEBook's 86 sequence diagrams uses an X either. An
  X at the bottom of a lifeline marks the destruction of its instance (UML 2.5.1
  §17.4.4.2); mention it in class if needed.
- **The star map is created once, inside the opt.** A creation inside the loop
  would create the same lifeline on every pass.
- **One sound player receives both asynchronous messages**, which keeps every
  diagram at four or five lifelines.

## Sources

The narration states ideas as concepts and never names its sources aloud.
Cues that draw on one show it in their `source` field.

- **OMG, UML 2.5.1, §17 Interactions** (the instructor's copy, `uml_spec.pdf`; PDF
  page = printed page + 42). Lifeline heads `name[selector] : Type` and "time increases
  down the page; the distance between events is not a measurement of time"
  (§17.3.3–17.3.4); a lifeline represents one interacting entity (§17.12.17);
  message signatures name an operation or a signal of the receiver and the
  arguments match its parameters in order (§17.4.3); arrowheads: synchronous
  filled, asynchronous open, reply dashed, creation dashed with an open
  arrowhead, found and lost messages with a filled dot (§17.4.4); request and
  reply label grammar, `v=mymsg(w=myout:16):96` (§17.4.4); execution
  specifications as thin bars that may overlap (§17.2.4); valid and invalid
  trace sets, and runs a diagram does not describe (§17.2.3); alt, `else`, opt
  as alt with one empty operand, and loop with minimum and maximum (§17.6.3);
  `loop(minint, maxint)`, a plain loop meaning zero to unlimited, and guards in
  square brackets (§17.6.4).
- **Rumbaugh, Jacobson, and Booch, The Unified Modeling Language Reference
  Manual** (the instructor's copy is the 1999 first edition, UML 1.x): sequence
  diagram (time down, no meaning in horizontal order, arrange objects to keep
  arrows short; a created object's symbol sits at the head of the creating
  message); lifeline; activation, which "corresponds to a value of the stack
  frame" and includes time spent waiting for subordinate calls; message (a call
  blocks the caller until it returns; a return arrow may be suppressed when
  implicit).
- **Clements et al., Documenting Software Architectures, 2nd ed.**:
  §8.3.1 sequence diagrams show instances from the structural documentation in
  one scenario, trace documentation does not try to capture every trace, and a
  mix of synchronous and asynchronous messages should use the distinct arrows
  with returns for the synchronous calls; §8.5 when behavior diagrams pay off
  (whiteboard design, spotting bugs in a transaction across several modules);
  Epilogue §E.4 keep a diagram current or throw it away; Appendix A, a sequence
  diagram describes the behavior of the classes of a class diagram in one trace.

Where the 1999 manual differs from UML 2.5.1, the lesson follows UML 2.5.1 and
the existing SEBook chapter: UML 1.x underlined object names, drew conditional
branches by splitting lifelines instead of alt fragments, used a stick
arrowhead for flat flow and a half-stick arrowhead for asynchronous messages,
and called execution specifications activations or focus of control. The
narration says "activation bars, which UML formally calls execution
specifications". ArchUML still underlines lifeline heads, as UML 1.x did; that
is a renderer convention shared by every SEBook diagram, not something the
lesson teaches.

## Consistency with SEBook

A survey of the 86 sequence diagrams in SEBook (chapters, design-pattern pages,
tutorials, and narrations) fixed these conventions, which the lesson follows:

- lifeline heads `name: Type` (79 diagrams), anonymous `: Type` when the name
  does not matter, and a found message or an actor to start the scenario;
- synchronous calls with dashed replies whose labels name the returned value,
  omitted when the return is obvious; asynchronous messages are rare and always
  mean the sender does not wait;
- activation bars, nested for self-messages; `<<create>>` creation messages to
  the head of the new lifeline;
- `loop`, `alt` with `[else]`, and `opt`, with guards in square brackets and
  collection iteration written `for each … in …`;
- names in camelCase, as the chapter's diagrams spell them, with the Python code
  in snake_case.

SEBook's code-lab analyzers for Java, TypeScript, and C++
(`js/uml-analyzer-java.js`, `js/uml-analyzer-js.js`, `js/uml-analyzer-cpp.js`)
infer the same message order and fragment nesting from the lesson's code as the
general diagram shows; the node test checks all three.

## Renderer notes

- Sequence diagrams use `layout compact`, and the lesson's CSS keeps code above
  each diagram at every width, because four or five lifelines need about
  1,150–1,400 px at readable size. In narrower columns the diagram scrolls, and
  cues that discuss a lifeline on the right set `diagram_focus` so the player
  pans to it.
- The star map is highlighted while it is created mid-diagram. That needs the
  ArchUML fix that draws a created head with its participant's highlight and
  texture (the `create` branch of the sequence renderer); without it, the
  highlight check in `tests/uml-sequence-diagram-narration.spec.js` fails for the
  `choices/create` and `runs/answer` cues.
- In the `trace` diagram, `scanPower()` is a self-call without its own bar. In a
  compact layout that needs the ArchUML fix that starts the next row below the
  self-call's return; without it, the return and `scan(12)` share one line, and
  `tests/uml-page-layout.spec.js` reports their labels overlapping.
- The call-stack panel is an ArchUML freeform stack with `layout vertical`. That
  needs the ArchUML fix that keeps an authored freeform direction; without it, a
  wide column lays the frames side by side, and the call-stack check in the same
  spec fails.

## Learning sequence

| Scene | Part | Teaches |
|---|---|---|
| intro | — | The turn, the class diagram's limits, the four parts. |
| lifelines | Lifelines | `name : Type`, one class with two lifelines, anonymous heads, free order. |
| calls | Messages | Found message, asynchronous play, self-message, prediction, synchronous scan with its reply. |
| replies | Messages | Reply values, optional replies, label grammar. |
| activations | Activations | Bars, waiting callers, nested bars, the call-stack analogy (with a call-stack panel). |
| loop | Fragments | From one run to every run, loop guards, loop limits. |
| choices | Fragments | alt, `[else]` and guards, opt, creation. |
| runs | Fragments | Predict and unroll a new run; diagrams describe traces. |
| practice | — | Consistency with the class diagram, reachability, when to draw one. |
| transfer | — | Translate the docking station's recharge. |
| summary | — | The four parts, then the summary quiz. |

Every section ends with at least 2.5 seconds of silence before its knowledge
check, and each prediction pauses for 5 to 6 seconds.

## Files

- `_data/narrations/uml_sequence_diagram.yml`: speech and teaching text.
- `_data/narration_visuals/uml_sequence_diagram.json`: diagrams and cue state.
- `_data/explainers/uml_sequence_diagram_code.yml`, `_quizzes.yml`, `_notes.yml`,
  `_ui.yml` (the scenarios that the tests and the scan panel share), and the
  generated `_timing.json`.
- `_includes/uml-sequence-diagram-scan-panel.html`,
  `_includes/uml-sequence-diagram-call-stack.html`, `css/uml-sequence-diagram-narration.css`.
- `SEBook/uml_sequence_diagram/read.html` and `print.html`.
- `assets/audio/uml-sequence-diagram.mp3` and
  `assets/narration/uml-sequence-diagram.{vtt,txt}`.

## Regeneration and checks

```sh
node scripts/narration.js compile uml_sequence_diagram
python3 scripts/render-explainer-narration.py --topic uml_sequence_diagram --check
python3 scripts/render-explainer-narration.py --topic uml_sequence_diagram \
  --model /absolute/path/kokoro-v1.0.onnx --voices /absolute/path/voices-v1.0.bin
node scripts/narration.js check uml_sequence_diagram
node --test scripts/tests/uml-sequence-diagram-narration.test.js
```

Pronunciations spell out identifiers (`scanAll: scan all`), `sfx`
(`S F X`), and `asynchronous` (`A-synchronous`), which the voice otherwise
starts with a schwa that sounds like "a synchronous". Sentences avoid a
capitalized identifier at their start, because the pronunciation keys are
case-sensitive, and avoid "that objects" and "says which object", which the
voice stresses as the verb.

The node test checks the scenarios against the rules, the concrete diagrams
against the scenarios, every message against the class diagram, the three
analyzers against the general diagram, all four languages against the
scenarios, the quizzes, the notes, and the audio fingerprint. Then run
`tests/uml-sequence-diagram-narration.spec.js`, the `uml_sequence_diagram` cases of
`tests/narration-notes.spec.js`, `tests/narration-fullscreen.spec.js`, and
`tests/narration-navigation.spec.js`, the chapter's case of
`tests/uml-page-layout.spec.js` (no diagram labels overlap), and the WCAG audit filtered to
`uml_sequence_diagram` (the chapter and its read, print, and notes views).
