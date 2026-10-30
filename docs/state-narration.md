# State narrated lesson

The State chapter opens with an approximately 11-minute narration built on the
shared player in `docs/narrated-pattern.md`. Its example is a video game's
companion dog: Following, Fetching, and Napping react differently to
`throwBall()`, `whistle()`, and `tick()`, and the dog naps when its energy runs
out. Game companions keep gaining behaviors, so adding states is the realistic
change the pattern is chosen for.

## Learning sequence

The narration follows the structure of a pattern description, and each scene
shows its part (Context, Problem, Solution, Consequences):

1. How a pattern is described, with the dog's two reactions to one throw.
2. Context: a UML state machine of the dog, guarded transitions included, and
   the warning that the pattern's context is not its Context role.
3. Problem: the mode-checking `DogBefore`, beside a table of reactions by state
   and input. Each method is one column; a prediction asks what a forgotten
   zoomies branch does (the `else` branches treat it as napping).
4. Solution: the abstract roles Context, State, and Concrete State.
5. to 7. Each role in code: `DogState`, `Dog`, and the three state classes. Each
   class is one row of the table; the energy guard stays as a data check.
8. Collaborations: a sequence diagram that reveals one message group per cue,
   so the second `throwBall()` is predicted before it is shown.
9. Consequences, then applicability (including State versus Strategy and
   stacking effects), then a transfer task: adding a Zoomies state changes only
   the transition into it.
10. A summary that recalls all four parts, followed by a six-question summary
    quiz on a new example (a video player).

Section checks ask about the pattern, not the dog. The example is original: it
borrows the shape of GoF's TCPConnection, Head First's every-state-answers-
every-action idea, Nystrom's game states, and Kerievsky's step-by-step
refactoring without reusing their examples.

## Sources

See [the shared format](narration-format.md). Spoken `say` cues and teaching
text live in the YAML; diagrams, code/animation state, and renderer settings
live separately in `_data/narration_visuals/state.json`.


- `_data/narrations/state.yml`: speech, scenes, parts, and teaching text.
- `_data/narration_visuals/state.json`: diagrams and renderer state.
- `_data/explainers/state_code.yml`: the four-language examples.
- `_data/explainers/state_quizzes.yml`: section checks and the summary quiz.
- `_data/explainers/state_ui.yml`: the companion panel states and the table of
  reactions, which is also the test oracle for both designs.
- `_includes/state-companion-panel.html`, `_includes/state-behavior-table.html`,
  and `css/state-narration.css`: the topic illustrations.

## Regeneration and checks

Render with the Kokoro setup from `docs/nodejs-animation.md`:

```sh
python scripts/render-explainer-narration.py --topic state \
  --model /path/to/kokoro-v1.0.onnx --voices /path/to/voices-v1.0.bin
```

espeak-ng 1.52 truncates data paths longer than 160 bytes and then reports a
missing `phontab` under `/Users/runner/...`. If the environment lives under a
long path, copy `espeakng_loader/espeak-ng-data` to a short directory and point
`espeakng_loader.get_data_path` at it; phonemizer resolves symlinks, so a link
is not enough.

`node --test scripts/tests/state-narration.test.js` checks the storyboard,
marks, timing, and quizzes, and runs both designs in every language against the
table of reactions. Python 3, a JDK, clang++ (C++17), and Node.js with type
stripping are needed for the language checks; missing tools are skipped.
`tests/state-narration.spec.js` covers the player, reader, print view, themes,
mobile layout, and accessibility.
