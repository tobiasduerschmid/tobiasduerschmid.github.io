# Information Hiding tutorial redesign — design

Date: 2026-11-17. Replaces `_data/tutorials/information-hiding.yml` in place.

## Intent

CS 35L sophomores have just sat through the Managing Complexity lecture (L15/L16). The tutorial lets them experience information hiding in code: look at a bad design, think through which parts a change would touch, make the change with the editor's refactoring tools, test that the code still works, and reason about change impact from there. Code edits are fast and tool-driven so that the time goes into design thinking.

## Learners and prerequisites

- Sophomores, fresh from the lecture. They know the vocabulary (secret, interface, implementation, change impact analysis) but have not applied it.
- Prior 35L work the tutorial relies on: Python tutorial; UML class diagram tutorial (`-` is `__name`, `#` is `_name`, `+` is public); Testing Foundations, TDD, and Test Doubles tutorials (pytest, behavior vs. implementation, boundaries, stub, spy).
- They have **not** used the refactoring tools. Lesson 1 teaches them click by click.

## Objectives

Students **understand**, **apply**, and **evaluate** information hiding:

1. Explain a module's secret as a design decision likely to change, and why a private attribute alone does not hide it.
2. Identify where an interface or a caller reveals a secret: a reached-through attribute, raw data in a return value, an algorithm carried out by callers, a copied rule.
3. Apply Extract Method, Move Method, and Rename with the tools to give a leaked decision one owner while tests stay green.
4. Apply earlier testing skills: behavior tests as safety net, rewrite a test that depends on a hidden detail, stub and spy tests at the new interface.
5. Evaluate a design with a change impact analysis before and after, and decide which likely change deserves a redesign.

**Non-goals:** `typing.Protocol`, writing abstract base classes (lesson 1 hands students a finished `PaymentGateway` ABC, which they know from the UML class diagram tutorial), dependency-injection frameworks, module guides, deep/shallow and coupling/cohesion beyond one sentence and quiz items, design docs.

**Anti-goals:** a reading-heavy tutorial; steps where typing dominates thinking; graders that accept only the tool-produced code; tasks that tell students which lines leak.

## Approach

Chosen: replace the existing eight-step tutorial with a from-scratch five-lesson tutorial at the same URL. Rejected: a companion prequel (user decision), and revising the old one in place (its refactors are typed by hand with `Protocol`, which is the opposite of the goal).

## The lesson loop

Every lesson has one numbered task list with these bold labels, in this order:

1. **Think** — a change request arrives. The student fills in `BEFORE` in `change_impact.py`: every file of ours that would need an edit. This is the prediction, and it is graded.
2. **Refactor** — move the knowledge to one owner with the tools.
3. **Test** — run pytest; practice one earlier testing skill.
4. **Reason** — fill in `AFTER`. A collapsed "What you just did" block names the concept.

The term is **change impact analysis** everywhere. Do not write "change test".

## Lessons

Exact starter code, model solutions, grader commands, and instruction text for all five lessons are in `_data/tutorials/information-hiding.yml`. That file is authoritative; where this document and the YAML disagree, the YAML wins. (The earlier design kit with its `skeleton.yml` has been deleted.) This table is the map.

Lesson 1 follows the lecture's design: the services depend on an interface `PaymentGateway` (given in `payment_gateway.py`, an ABC with `charge`, `refund`, `save_card`), `PayPalGateway` in `paypal_gateway.py` implements it and is the only class that knows PayPal, and `current_gateway()` in `gateway_choice.py` is the one place that picks the provider (the lecture's `getPaymentGateway()`). The tools move the protocol into `PayPalGateway`; the hand edits are the design decision: the base class, the services' imports and annotations, and the return type of `current_gateway()`. Adding the base class before all three operations exist makes `PayPalGateway()` fail to instantiate, and the instructions and hints use that error as feedback. Change impact analysis for "Switch to Stripe": `BEFORE` must list the three services and may list `paypal_gateway.py` and `gateway_choice.py`; `AFTER` is exactly `gateway_choice.py`, since Stripe gets a new class in a new file.

| # | key | Title | Secret (kind) | Leak | Tool path | Testing skill | Lecture slides |
|---|---|---|---|---|---|---|---|
| 1 | `payments` | A Decision Three Classes Know | payment provider (technology) | three services run PayPal's protocol through `gateway.paypal` and depend on `PayPalGateway`, not on the `PaymentGateway` interface | Extract + Move ×3 into `PayPalGateway` (first guided), Rename `paypal` → `__paypal`; by hand: `PayPalGateway(PaymentGateway)`, services and `current_gateway()` name only `PaymentGateway` | safety net: green before and after | 8–13, 21, 22, 24 |
| 2 | `menu` | Private Is Not Hidden | supplier file layout (data format) | private `__lines`, public `rows()` returns raw rows; kiosk and a test split them | Extract + Move ×2, Rename `rows` → `__rows` from the `def` line | rewrite the test that knew the layout (behavior, not implementation) | 14, 15, 23; L9 slide 15 |
| 3 | `wait-times` | The Algorithm Is a Secret Too | wait estimate (algorithm) | two callers compute it from `WaitTimes`' attributes | Extract + Move once; second caller calls the new operation by hand | hand-rolled stub; both sides of a boundary | 16, 17 |
| 4 | `rewards` | The Secret Nobody Imported | points rule (copied rule) | `Receipt` recomputes it; no import, no arrow | none (one-line change) | TDD red→green; stub value the copy cannot produce | 26, 27 |
| 5 | `clubhub` | Change Impact Analysis | texting provider, full-event rule | new domain; three roadmap changes with given likelihood | Extract + Move, hand edit, Rename; unguided | hand-rolled spy, strong oracle | 28, exit ticket |

Fading: lesson 1 gives exact lines and clicks; lesson 2 gives method names but not lines; lesson 3 gives the goal; lesson 5 gives only the target operation.

### Tool constraints the starter code depends on

Verified against `js/tutorial-refactorings.js`:

1. Extract refuses a helper name already used in the enclosing function, even as another object's attribute. Vendor SDKs therefore say `capture` / `reverse` / `vault` / `push`; our modules say `charge` / `refund` / `save_card` / `send`.
2. Move Method needs a parameter typed as the target class and does not add imports to the target file. Extracted helpers take only unannotated locals or built-in types.
3. Rename rewrites only the active file. A method rename must start on the `def` line (from a call site it renames only the calls).
4. Extract is offered only when the selection starts on the first token of the first statement. A selection that includes the leading indentation hides the menu entry. The plan fixes this in the engine (Task 2); the tool reference explains the selection either way.
5. Move Method leaves a forwarding method in the source class. Graders accept it. Moving the same lines from a second caller creates a duplicate method; graders accept that too.

### UML

- Live class diagram pane is on (`uml_diagram: true`, layout copied from `code-smells-refactoring.yml`). It shows the "before" in lessons 2–5, shows `PayPalGateway` gaining operations and implementing `PaymentGateway` in lesson 1, and gains a `Receipt ..> Rewards` arrow in lesson 4.
- Four authored diagrams (in the lessons' instruction text): lesson 1 today and target (the live pane cannot show that services reach `PayPalClient`; the target shows the services depending on the `PaymentGateway` interface, which `PayPalGateway` realizes), lesson 2 target, lesson 3 target. All four parse with `js/uml-describe-cli.js`.

### Tool reference footer

Create `_includes/refactoring-tools-reference.html` and set `instructions_footer_include: refactoring-tools-reference.html`. One native `<details>` with summary "How to use the refactoring tools", no inline styles, containing:

- **Extract Function/Method:** select whole statements, right-click, choose *Refactor: Extract Function/Method…*, and type a name. If the entry is missing, the selection probably starts on a blank line or ends in the middle of a statement.
- **Move Method:** click inside the method, right-click, choose *Refactor: Move Method…*, and pick the target class.
- **Rename Symbol:** click the name where it is defined (the `def` line or the `self.name = …` line), right-click, and choose *Refactor: Rename Symbol…*.
- Every tool shows a preview first. Accept it to apply the change.
- Keyboard: instead of right-clicking, press <kbd>Shift</kbd>+<kbd>F10</kbd> in the editor to open the same menu. On a Mac keyboard, hold <kbd>fn</kbd> as well.
- To back out: undo in each changed file, or use **Reset Current Step**.

The shipped include is the source of truth for this text; it marks up the key chord as nested `<kbd>` elements.

### Hints

Each check gets three hints, least revealing first, titled by content. Share ladders with YAML anchors per group. Never name a file for the `BEFORE` checks or a line for the refactoring checks.

| Check group | 1 | 2 | 3 |
|---|---|---|---|
| Before lists | Ask of each file: if this decision changed, would this file still be correct as written? | Search for the vendor's or format's own words (a call name, a separator, a number that comes from the rule), not for imports. | Tests are files too. Does any test repeat the detail? Vendor SDK files are not ours. |
| "works with another provider / stored differently / given estimate" | The stand-in offers only the operations in the target diagram. What does your caller still ask for? | Find the last line in the caller that only makes sense if you know the secret. Is it inside the method you moved? | If the caller still calls a method on what the owner returned, you moved too few lines. Undo and extract through the line that produces a plain value. |
| "still behaves the same" | Press Test and read the first failing line. | An `AttributeError` on a name with two underscores means something was made private while a caller still used it. | Undo the rename, finish moving the callers, then rename. Reset Step restores the start. |
| "keeps its client to itself" / "no longer hands out rows" | Which public name still gives a caller the client or the raw rows? | Rename it so it starts with two underscores. | Start the rename on the line where the name is defined, not where it is used. |
| "Your tests pass / still pass when … changes" | Run Test and read the failure. | A test that fails after a correct refactoring was checking how, not what. What did it want to guarantee? | Lessons 3–5: give the caller a stand-in with the one method it calls; choose the return value yourself. |
| "Your tests catch …" | Which input would make the correct code and the changed code disagree? | Boundary: test the last value on each side. Spy: check the recorded calls, all of them. | Assert the whole result (`==`), not that something is present. |
| "implements the interface" (lesson 1) | Does the `class` line say that `PayPalGateway` implements `PaymentGateway`? | Python refuses to create it until it has every operation the interface lists. | Read the "Can't instantiate abstract class" message: it names the missing operation. Not moved yet, or moved under another name? |
| "depend only on the interface" (lesson 1) | Annotations name what a parameter may be. Which name lets any provider in? | Imports and annotations are knowledge too, including a leftover forwarding method. | `gateway_choice.py` is the only place allowed to name `PayPalGateway`. |
| After lists | Redo the Think question on the new code. | Only files that still contain the secret belong; a brand-new file (lesson 1: Stripe's gateway) is not an edit. | If more than one file is left, a caller still knows it. Lesson 1: something still has to choose the provider. |
| `FIX_FIRST` (lesson 5) | Two things matter for each change. | How likely is it, and how many files does it touch today? | Pick the change that is high on both. |

### Knowledge checks

Each quiz is titled `Step N — Knowledge Check`, `min_score: 0.8`, 4 questions (5 in lesson 5), `single` type unless noted, at least 4 options, feedback on every tempting wrong option. Stems ≤ 45 words, snippets ≤ 8 lines. Follow the quiz-format skill; never say "misconception"; never tell the student to run a snippet.

**Lesson 1.** (a) Understand: what was the secret → the decision to use PayPal and its protocol; distractors: the card data, the `paypal` attribute's value, the order total. (b) Apply: a `TipService` snippet with `authenticate`, `capture`, `was_successful`, then business logic; which lines to extract and move → all three vendor lines; distractors: only the `capture` line (hands back PayPal's result object), the whole method, none. (c) Evaluate: what depending on `PaymentGateway` instead of `PayPalGateway` buys in a switch to Stripe → no service file changes; distractors: Stripe inherits PayPal's token handling from the interface, each service picks the provider with an `if`, nothing because Python ignores annotations at run time. (d) Testing: why the four tests stayed green → they check behavior through the services.

**Lesson 2.** (a) Understand: what leaked the layout → the public `rows()` returning raw rows, not the attribute. (b) Analyze: `Roster` with private `__players` and public `export()` returning `name;number;position` lines that callers split → the return value puts the format in the interface. (c) Evaluate/testing (lecture L9 slide 15): `assert c._items == ["pen"]` vs `assert c.count("pen") == 1` after list→dict → the second survives; a good test passes for any correct implementation. (d) Visible contract or hidden detail: which is something `Menu` must promise → "a drink has a price in cents"; hidden: column order, comma separator, prices stored as text.

**Lesson 3.** (a) Understand: what did `PickupScreen` know that it should not → how the estimate is calculated. (b) Testing: why the stub makes the boundary easy → the test controls the indirect input instead of arranging a queue and re-deriving the number. (c) Analyze, spaced: classify a new leak (`report.to_rows()` returns `a|b|c` strings callers split) → data format; distractors: algorithm, technology, not a leak. (d) Evaluate: `estimate(orders_ahead, minutes_per_drink)` vs `minutes_until_ready(order_id)` for a drink-based rule → the second; the first makes callers supply the algorithm's inputs.

**Lesson 4.** (a) Understand: kind of dependency between `Receipt` and `Rewards` at the start → semantic. (b) Evaluate/testing: a test passes the real `Rewards()` and expects 5 points; does it prove the receipt asks → no, copy and call agree. (c) Analyze: which pair has a semantic dependency → `OrderDesk` builds pickup codes `f"B-{n:04d}"` and `KitchenDisplay` reads the number with `code[2:]`. (d) Evaluate: the new arrow `Receipt → Rewards` → better: a visible dependency on a small interface replaced a hidden copy.

**Lesson 5.** (a) Evaluate: why A before C although C touches more files → likelihood and cost together. (b) Understand: `Notifier`'s secret now → which provider and its session/push protocol; that texts get sent is a visible contract. (c) Testing: stub or spy to check one text to the right phone → spy, it records indirect outputs. (d) Analyze: what would shrink change C to one file → `Event` offers operations for what callers need and keeps the list private. (e) Understand, spaced from lesson 2: rename `guests` to `__guests` and add `get_guests()` returning the list → not hidden.

### Solution explanations

Two to four sentences per lesson for instructor mode: which lines moved and why those; what the leftover forwarding methods are; what the rewritten or added test proves. Lesson 1 adds: the body of the published `paypal_gateway.py` is exactly what the tools produce; the base class, the services' imports and annotations, and `current_gateway()`'s return type are hand edits.

## Replacement mechanics

- Overwrite `_data/tutorials/information-hiding.yml`. Page pair and permalinks stay.
- `progress_version: 1` with the five keys above. An old unversioned save maps to no lesson: nothing is credited, the learner starts at lesson 1, old drafts stay in storage unshown. New file names do not collide with any old `open_file`.
- Rewrite the last paragraph of `SEBook/designprinciples/informationhiding.md` to describe the new tutorial.
- Add the tutorial to `_data/CS35L_nav.yml` under Design Principles and to `_data/study_plans/CS35L.yml` under "Design and process".

## Pedagogical review

Reviewed with `pedagogical-advisor` (quality gates, cognitive load), `cs-tutorial-design`, and `tutorial-authoring`.

| Lesson | Understand | Apply | Evaluate | Minutes |
|---|---|---|---|---|
| 1 | secret = decision; who knows it; depend on the interface | tools, guided then repeated; hand edits to the interface | impact 3–5 files → 1 line of wiring | 16 |
| 2 | private ≠ hidden; interface = promises | tools, student picks lines | impact includes a test | 13 |
| 3 | callers must not run the algorithm | tools + reuse | impact 4 → 1 | 13 |
| 4 | semantic vs. syntactic dependency | test first, one-line fix | the arrow trap | 10 |
| 5 | (explained in quiz) | tools, unguided | roadmap, fix-first, defer C | 16 |

- **Time:** about 68 minutes of tasks plus about 10 of quizzes.
- **Reading:** 419 / 334 / 316 / 314 / 302 words, 1,685 total, against 5,416 in the tutorial it replaces. Budgets are enforced by a test.
- **Scaffolding:** worked example → completion → faded → independent → transfer. Tool mechanics are pretrained on the lecture's own example, where the concept is already familiar. One two-move pattern (Extract, then Move) carries lessons 1, 2, 3, and 5.
- **Good use of time:** every graded action is a design judgment (which files, which lines, which test) or a 30-second tool action. Nothing is typed that a tool can write. Each testing task also teaches something about hiding: tests are callers, and a new interface is where doubles go.
- **Misconceptions with a prediction that exposes them:** private = hidden (lesson 2 `BEFORE`); no arrow = no dependency (lesson 4 `BEFORE`); fix the biggest change first (lesson 5 `FIX_FIRST`); a passing test proves the design (lesson 4 stub).
- **Feedback:** 8–12 small checks per lesson, ordered like the loop, so partial progress shows. Graders use stand-ins from "another provider", so any correct design passes, including hand edits.
- **Residual risks:** selection precision for Extract (Task 2 plus the footer); students renaming before moving (hint ladder; clean failure verified); the live pane hiding vendor arrows in lesson 1 (authored diagrams).

## Verification

Tests that read the shipped tutorial YAML:

- `test_information_hiding_graders.py` — every check against starter, model solution, other correct submissions, and mistakes (13 tests).
- `information-hiding-tool-paths.test.js` — replays every tool path through the real engine and runs each lesson's pytest file (5 tests).
- `test_information_hiding_content.py` — keys, reading budget, loop labels, hint ladders, quiz format (fails until hints, quizzes, and explanations are written).

Plus a Playwright journey in real Pyodide, an old-save migration check, print view, light and dark, and the WCAG audit.

## Left to the builder

Wording of hints, quiz questions, and solution explanations within the blueprints above; hint `condition:` choices after checking how `js/tutor-chat.js` reads multi-file steps; exact Playwright selectors.
