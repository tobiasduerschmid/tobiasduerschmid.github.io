# Strategy narrated lesson

The Strategy chapter opens with an approximately 12-minute narration built on the
shared player in `docs/narrated-pattern.md`. Its example is a group-expense app:
Ava, Ben, and Chloe split a dinner equally, by percentage, or as a birthday
treat, and the person logging the expense chooses the method. Expense apps keep
gaining split methods, so adding algorithms is the realistic change the pattern
is chosen for.

## Sources

See [the shared format](narration-format.md). Spoken `say` cues and teaching
text live in the YAML; diagrams, code/animation state, and renderer settings
live separately in `_data/narration_visuals/strategy.json`.


The lesson follows three books and quotes none of their examples. The narration
never says their names aloud; each cue that draws on one shows the source on
screen in its `source` field:

- **Design Patterns (GoF), Strategy:** the applicability list (including
  behaviors that appear as conditionals), the three roles, the collaborations
  (clients create and pass a strategy; the context passes data or itself), the
  seven consequences, and the first implementation issue, taking data to the
  strategy versus passing the context.
- **Refactoring to Patterns (Kerievsky), Replace Conditional Logic with
  Strategy** (named *Replace Conditional Calculations with Strategy* in the 2004
  draft): a calculation whose helper methods repeat the same conditional, the
  long parameter list it signals, the step-by-step mechanics (move the
  calculation, then replace the conditional with one subclass at a time), the
  constructor-versus-setter choice, and the warning that much conditional logic
  does not justify the pattern. The bill split has the shape of his loan capital
  calculation.
- **Head First Design Patterns:** encapsulate what varies, program to an
  interface, favor composition over inheritance, and change a behavior at
  runtime through a setter.

## Learning sequence

Each scene shows its part of the pattern description (Context, Problem,
Solution, Consequences):

1. How a pattern is described, with the same dinner split equally and then as a
   birthday treat.
2. Context: one task with a family of interchangeable algorithms, chosen by the
   client, plus the warning that the pattern's context is not its Context role.
3. Problem: the method-checking `ExpenseBefore`, beside a table of split methods
   by operation. `shares()` and `label()` repeat the same check, the constructor
   carries every method's data, and a prediction asks what a new itemized split
   costs (the `else` branches treat it as a birthday).
4. Solution: the roles Strategy, Concrete Strategy, and Context, with the client
   that chooses.
5. to 7. Each role in code: `SplitStrategy` and its contract (the shares add up
   to the total), `Expense` with `setStrategy`, and the three concrete
   strategies, one row of the table each. `EqualSplit` is stateless and shared.
8. Collaborations: a sequence diagram that reveals one message group per cue,
   so the request after `setStrategy` is predicted before it is shown.
9. Consequences, then applicability (a conditional or a function parameter may
   be simpler; Strategy versus State and Template Method), then a transfer task:
   an itemized split is one new class plus the client code that offers it.
10. A summary that recalls all four parts, followed by a six-question summary
    quiz on a new example (a photo app's export formats).

## Files

- `_data/narrations/strategy.yml`: speech, scenes, parts, and teaching text.
- `_data/narration_visuals/strategy.json`: diagrams and renderer state.
- `_data/explainers/strategy_code.yml`: the four-language examples.
- `_data/explainers/strategy_quizzes.yml`: section checks and the summary quiz.
- `_data/explainers/strategy_ui.yml`: the panel cases and the table of split
  methods. Its cases are also the test oracle for both designs.
- `_includes/strategy-split-panel.html`, `_includes/strategy-method-table.html`,
  and `css/strategy-narration.css`: the topic illustrations.

## Regeneration and checks

Render with the Kokoro setup from `docs/nodejs-animation.md`, including the
espeak-ng short-path workaround in `docs/state-narration.md`:

```sh
python scripts/render-explainer-narration.py --topic strategy \
  --model /path/to/kokoro-v1.0.onnx --voices /path/to/voices-v1.0.bin
```

`node --test scripts/tests/strategy-narration.test.js` checks the storyboard,
marks, timing, and quizzes, and runs both designs in every language against the
cases, including a strategy changed at runtime and rejected percentages. Python 3,
a JDK, clang++ (C++17), and Node.js with type stripping are needed for the
language checks; missing tools are skipped. `tests/strategy-narration.spec.js`
covers the player, reader, print view, themes, mobile layout, and accessibility.
