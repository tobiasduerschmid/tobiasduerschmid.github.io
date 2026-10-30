# Model-View-Controller narrated lesson

The Model-View-Controller chapter opens with an approximately 13-minute
narration built on the shared player in `docs/narrated-pattern.md`. Its
example is a data visualizer that charts weekly screen time as a table, a bar
chart, and a pie chart. The structure follows POSA1 (pp. 125-143), but the
spoken narration names no authors, books, or dates; cues that draw on a source
show it on screen in their `source` field. The narration builds a
plain-language mental model for undergraduate students, and it shows the
concrete redesign before abstracting it into the pattern's roles.

In the player the dashboard is live (`js/mvc-dashboard.js`): each cue animates
it to the cue's state, so the opening shows an edit spreading to every view,
and students can edit rows, click bars, and swap in a read-only controller
between cues. The dashboard is itself a small MVC app.

## Learning sequence

Each scene shows its part of the pattern description:

1. The dashboard in action (an edit animates through every view, then
   students try it), how a pattern is described, and the three roles in one
   sentence.
2. Context: interactive apps whose interface keeps changing.
3. Problem: `ScreenTimeApp` stores the data, handles input, and draws every
   chart; in the dashboard, every input redraws all three views. A
   prediction asks what a line chart and a phone port would touch, and the
   scene ends with the four demands a solution must meet.
4. to 8. The concrete redesign: `Dataset` (data, list of dependents,
   notify), the views (ask for data on update, draw, highlight one view), the
   controllers (the base ignores input, `TableController` changes the data,
   `ChartController` changes one view), one edit traced on a sequence
   diagram that ends with the loop, and the set-up code with its factory
   method.
9. The abstraction: CRC cards for Model, View, and Controller, each mapped to
   the class that played it, then a role-level class diagram of how the roles
   interact.
10. Consequences, applicability (including view and controller merged into one
    component, Observer, Strategy, and Composite inside the pattern, and
    server-side web MVC), then a transfer task: a line chart and a read-only
    pie chart.
11. A summary of all four parts, followed by a six-question summary quiz on a
    new example (a fitness app).

Section checks ask about the pattern, not the screen-time data, and each one
is answerable from the narration that precedes it.

## Classical sources behind the narration

The structure follows POSA1; these sources were read in full and shape
specific cues:

- Reenskaug, "Models–Views–Controllers," Xerox PARC note, 10 December 1979
  ([Zenodo, CC BY 4.0](https://zenodo.org/records/3676092)): models represent
  knowledge that matches the user's perceived world. In this first note the
  controller sends messages to views, and views may update the model; later
  Smalltalk-80 controllers, like POSA1's, send requests to the model.
- Krasner and Pope, "A Cookbook for Using the Model-View-Controller User
  Interface Paradigm in Smalltalk-80," JOOP 1(3), 1988: models must not know
  their views and controllers; both views and controllers can be dependents;
  `changed:` names the aspect that changed; `defaultControllerClass` supplies
  a view's controller; `NoController` serves read-only views.
- Gamma et al., *Design Patterns*, 1994, "Design Patterns in Smalltalk MVC"
  (pp. 4–6): Observer, Composite, and Strategy inside MVC; disabling a view
  with a controller that ignores input; Factory Method for the default
  controller.
- Burbeck, "Applications Programming in Smalltalk-80: How to use
  Model-View-Controller," 1987/1992: passive and active models, the one-to-one
  view–controller link, and how control passes among controllers.
- Fowler, "GUI Architectures," 2006: Separated Presentation, Observer
  Synchronization and its traceability cost, and the later variants
  (Application Model, MVP, Presentation Model).
- Freeman et al., *Head First Design Patterns*, ch. 12: MVC as a compound
  pattern; its view forwards input to the controller, a common teaching
  variant that differs from POSA1, where users interact only through
  controllers.

## Sources

See [the shared format](narration-format.md). Spoken `say` cues and teaching
text live in the YAML; diagrams, code/animation state, and renderer settings
live separately in `_data/narration_visuals/mvc.json`.


- `_data/narrations/mvc.yml`: speech, scenes, parts, and teaching text.
- `_data/narration_visuals/mvc.json`: renderer state and diagrams (CRC cards,
  three class diagrams, and both scenarios as sequence diagrams).
- `_data/explainers/mvc_code.yml`: the four-language examples.
- `_data/explainers/mvc_quizzes.yml`: section checks and the summary quiz.
- `_data/explainers/mvc_ui.yml`: the dashboard states, and the events and
  expected output that both designs must produce.
- `_includes/mvc-dashboard-panel.html` and `css/mvc-narration.css`: the
  illustrated dashboard. Bar lengths and pie slices are SVG geometry computed
  at build time; the reader and print views show this static picture.
- `js/mvc-dashboard.js`: the live dashboard in the player, loaded through the
  `presentation.scripts` in `_data/narration_visuals/mvc.json`.

## Regeneration and checks

Render with the Kokoro setup from `docs/nodejs-animation.md`, and see
`docs/state-narration.md` for the espeak-ng long-path workaround:

```sh
python scripts/render-explainer-narration.py --topic mvc \
  --model /path/to/kokoro-v1.0.onnx --voices /path/to/voices-v1.0.bin
```

`node --test scripts/tests/mvc-narration.test.js` checks the storyboard,
marks, timing, and quizzes, and runs both designs in every language against
the expected dashboard. `tests/mvc-narration.spec.js` covers the player,
diagram steps and highlights, the dashboard, themes, mobile layout, the
reader and print views, and accessibility.
