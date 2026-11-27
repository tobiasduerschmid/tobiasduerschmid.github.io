# Test-Driven Development video narration

The narration at the top of `SEBook/testing/tdd.md`, *Two cents short*, teaches
test-driven development through one small feature: splitting a dinner bill, in
cents, in a group-chat app. It follows the order motivation, a worked example,
the rules and why each one matters, and the consequences. It is a video
narration (`docs/video-narration.md`). Script: `_data/narrations/tdd.yml`;
visual package: `_data/narration_visuals/tdd.json`; checks:
`_data/explainers/tdd_quizzes.yml`; notes: `_data/explainers/tdd_notes.yml`;
code: `_data/explainers/tdd_code.yml`; artwork: `js/video-narration/tdd.js`,
`tdd-kit.js`, and `tdd-art.js` on the architecture kit and the wall kit, styled
by `css/video-narration-tdd.css` and `css/video-narration-tdd-art.css`, on the
`test-bench` backdrop (`js/song-video/test-bench.js`,
`css/song-video-test-bench.css`): a lab notebook page on a laboratory bench,
the testing lessons' counterpart of architecture's blueprint and process's
post-it wall. A test is a small experiment (expect, run, observe), so the
page is graph paper with a red margin line and punched holes, with faint ink
sketches of earlier experiments: a flask on a stand, a results table with one
failed check, and observed points along a dashed expected line. Its only
color lies at the right edge, where pictures rarely reach: a petri dish, test
tubes of red, green, and blue liquid (the cycle's colors), and a pH test
strip beside the color key it is read against. The sketches stay in one
faint ink, so no tick or cross of theirs reads as a verdict on the lesson. The final knowledge check
continues to the chapter's song, *Red, Green, Refactor*.

## Teaching design

- **Running example.** You built "Split the bill" the night before; on
  Friday's $80.00 ramen bill for three it shows $26.66 each, which sums to
  $79.98. The tests were green because they were written after the code, from
  its output. The lesson rebuilds the feature test-first, one test at a time,
  from a test list (one person pays it all, even split, leftover cents, zero
  people): a starter test and Fake It, a second example and Triangulate,
  Friday's bill as the third test and Obvious Implementation, then a
  refactoring on green. Zero people stays open as the learner's first cycle;
  the control bar's complete example shows one solution.
- **Rules.** Four named rules. Each gets its statement, the failure it
  prevents (shown in the example), why it prevents that failure, and what it
  costs or where it stops. Test first: last night's test copied the code's
  answer; written first, the expected value must come from the requirement,
  the test gets written, and the call is designed from the caller's side; the
  cost is knowing what the code should do, so explore with throwaway code when
  you don't. Watch it fail: the teammate's test that only counts shares stays
  green on buggy code; red before the fix and green after it show the test
  detects the behavior; a new test that passes at once means the behavior
  exists or the test is too weak; read the failure's reason. Smallest step:
  an untested tip parameter could be wrong while every test stays green; each
  green is a checkpoint, so a surprising red points at a few lines; step size
  follows confidence; small steps feel slow and still need design thought.
  Robert Martin's three laws appear as the strictest step size, as training.
  Refactor on green: a `<=` slip turns all three tests red, one edit, one
  cause; green before and after shows the checked behavior survived; one hat
  at a time; skipped cleanup piles up; and green proves only what the tests
  check.
- **Metaphors.** Each rule has one picture, and the speech links it in
  passing, in ordinary words, as the picture appears: a target painted around
  the arrow ("like shooting an arrow first and then painting the target"; test
  first draws the target first), a smoke alarm with no battery and its test
  button (watch it fail), checkpoints in a game, a gear you pick, and training
  wheels (smallest step), and two hats, the metaphor Fowler reports from Beck,
  with refactoring as a walk on a tightrope above a net labeled Safety net of
  tests (refactor on green). The net appears in the example's refactoring step,
  large in rule four's introduction (where it catches a `<=` slip and the tests
  turn red, then green after the undo), in the cleanup rule, in the
  regression-safety-net benefit, and in the recap. Where a metaphor carries a
  rule, the rule is a slim banner across the top and the picture fills the
  stage below it. The consequences link their pictures the same way: bricks
  against a tangle, taller towers that never reach the moon, a scale that
  stays level, and a metronome's steady beat; documentation that runs beside a
  stale note, an hourglass, and a mountain need no extra words.
- **Consequences.** What TDD reliably gives (more tests, a regression safety
  net, executable documentation while kept current, small and testable
  units), what it costs (time up front, a learning curve, tests to maintain),
  its limits, and what the evidence says: against a test written right after
  each small piece of code, experiments mostly find no clear difference;
  benefits track short, steady cycles more than test order; strict TDD is
  rare.
- **Predictions.** Four, each derivable or against a likely wrong intuition:
  the least code that passes the starter test (a constant), what the runner
  reports for the constant against two tests, what the old code returns for
  8000 cents and 3 people, and whether a new test that is green at once is
  good news.
- **Checks.** Every section ends with a check on a new program; the summary
  quiz asks seven questions about one new function, `letter_grade(points)`.

## The stage and the code

- **Four languages and frameworks.** Every code card and runner line exists
  in Python with pytest, Java with JUnit 5, C++ with GoogleTest, and
  TypeScript with Jest (`tdd_code.yml`, `stage` per language). The stage page
  embeds that file (`#narration-code`), the kit draws each piece once per
  language (`data-code-variant`), and the stage shows the language of the
  player's Code control (`data-code-language`, from the shared code-language
  preference; `js/video-narration-stage.js`). The notes' stills follow the
  notes' own language select. Speech and visual descriptions stay
  language-neutral. Every card and runner line was compiled and run in all
  four toolchains; the runner lines are verbatim (an ellipsis marks lines left
  out), and the runner cards in the cycle scene drop the runners' alignment
  spaces so the four fit. A click on a runner card switches the lesson's
  code to that card's language (a picture control, `data-stage-choice`; the
  hovered card offers "Use this language"); keyboard users have the same
  choice in the player's Code select.
- **Illustrations.** `js/video-narration/tdd-art.js` (`window.TddArt`,
  styled by `css/video-narration-tdd-art.css`) holds every picture: finished
  vector illustrations with flat fills, fine ink, and light from the top left,
  the same colors in both modes. Each function draws one `<svg>` into a box
  the caller sizes; states are classes on its root and moving parts are groups
  with a CSS pivot, so every moment is a still pose. The art has no text, ids,
  gradients, filters, or clip paths, because the notes page copies the stage
  for every cue. The kit places it with `TddKit.art` (poses, part reveals,
  moves), puts small pictures on paper notes with `TddKit.spot`, and lights the
  terminal's signal with it. A backdrop picture that cards lie on (the dinner
  table, the split machine, the safety net, the scale) carries
  `td-art--backdrop`, which the crowding check allows.
- **The workbench.** Through the example and the rules the editor column
  (test card above code card), the side column (test list, and one supporting
  object or the rule plaque), and the runner's terminal along the bottom keep
  their places. Code cards change as diffs: removed lines strike out, then
  leave as the added lines type in. The terminal grows upward with failure
  detail, which runs in columns when a runner prints many short lines, so the
  editor column always keeps room for the tallest language (Java).

## Sources

### How to read the locators

- **Beck.** The supplied text is a 2002 reviewer draft, not the printed book. Locators below are the **printed chapter** (checked against the publisher's table of contents) with the draft page in parentheses. Printed page numbers are not verified, so cite chapters.
- **Lecture.** "L9, slide N" is CS 35L Lecture 9, *Testing, TDD & Refactoring*.
- **Strength.** *Definitional* (what the originators say the practice is), *Strong*, *Moderate*, *Weak*, as in the dossier, section (c).

### Source table, by scene

| Scene / cue | What the lesson says | Source and locator | Strength, and the wording to keep |
|---|---|---|---|
| `intro/after` | A test written after the code tends to confirm what the code already does | [T12] Edwards and Shams 2014 (student tests follow the happy path); [B2] Beck, "Canon TDD", step 3 (copying computed values into expected values defeats double checking); [T4] Spacco and Pugh 2006, [T10] Buffardi and Edwards 2013 (students test after the code) | Moderate to strong. "Tends to", not "always" |
| `cycle/tdd` | TDD: a small automated test before the code | [B1] Beck 2002, Preface (draft p. 9); L9, slide 20 | Definitional |
| `cycle/loop` | Red, green, refactor; one turn takes minutes | [B1] Preface and Part I opener (draft pp. 9, 19); L9, slides 20, 22; [M1], [M2] (loops of seconds to minutes) | Definitional |
| `cycle/runner` | Each language has a test runner that reports red or green | The frameworks' own output, captured in `code.md`; red and green bars: [F4] Fowler, "Xunit" | Verified by running |
| `list/cards` | Write a test list before coding, so attention stays on the current case | [B1] ch. 25, Test List (draft pp. 97-98); [B2] step 1 | Definitional |
| `list/one` | One test at a time; all tests first means many red tests and rewrites | [B2] step 2, mistakes (rework of speculative tests; a long stretch without green); [B1] ch. 25 (ten broken tests keep you far from green) | Definitional |
| `starter/first_test` | Start with the easiest case; the test designs the interface from the caller's side | [B1] ch. 26, Starter Test (draft p. 107); [B1] ch. 1 (draft p. 16); [F1] Fowler, "Test Driven Development"; L9, slide 28 | Definitional |
| `starter/red` | A test that does not build counts as red | L9, slides 20, 24; [M3] Martin 2008, ch. 9, p. 122 (second law) | Definitional |
| `starter/fake`, `why_fake` | Fake It: return a constant; a fast green shows where you stand; one example keeps the scope small | [B1] ch. 28, Fake It ('Til You Make It) (draft p. 102); L9, slide 29 | Definitional |
| `triangulate/generalize` | Triangulate: generalize only when a second example forces it; more specific tests, more general code | [B1] ch. 28, Triangulate (draft pp. 103-104); [M4] Martin 2014 | Definitional. Beck uses Triangulate only when unsure; the lesson says "a second example", not "always two" |
| `leftover/red3` | The test could catch the bug because the expected shares were worked out independently | [B2] step 3 (double checking); [B1] ch. 25, Assert First (draft p. 99) | Definitional |
| `leftover/obvious` | Obvious Implementation: when you know what to type, type it | [B1] ch. 28 (draft p. 104) | Definitional |
| `refactor/smell`, `tidy` | Refactoring changes structure, not behavior; passing tests show behavior survived | L9, slides 20, 21, 27; [F8] Fowler 2018, ch. 2 | Definitional. Tests show it only for the cases they check (the refactor check's feedback says so) |
| `rules_red/test_first` | Rule 1 | [B1] Preface (first rule); [M3] p. 122 (first law) | Definitional |
| `rules_red/test_first_why` | Tests planned for later tend to get dropped under a deadline; interface from the caller's side | [B1] ch. 25, Test First (draft p. 98); [E2] George and Williams 2004 and [E6] Janzen and Saiedian 2008 (test-last groups often wrote few or no tests); [F1] | Practitioner rationale plus moderate evidence. "Tend to", not "are always" |
| `rules_red/watch`, `liar` | Rule 2: see each new test fail for the expected reason; a test that never fails proves nothing | [B1] Part I opener (run all tests and see the new one fail); L9, slides 14 and 24 ("testing the test"); [G1] Freeman and Pryce 2009, ch. 5, p. 42; [B2] | Definitional. **No empirical study isolates this rule** (dossier gap 8). "Proves nothing" is the lesson's reasoning |
| `rules_red/message` | Check that the failure is the expected one | [G1] ch. 5, "Watch the Test Fail" (wording seen only in excerpts; paraphrased) | Definitional |
| `rules_green/smallest` | Rule 3; code no test asked for is code no test checks | [M3] p. 122 (third law); L9, slide 26; [M1] | Definitional |
| `rules_green/debugging` | A red points at the lines since the last green; choose the step size by confidence | [M1] Martin 2005 ("a minute ago all their code worked"); [B1] ch. 28 and ch. 32 (draft pp. 102-104, 129) | Definitional. Supported indirectly by [E11] (fine granularity went with better outcomes) |
| `rules_green/strict` | The three laws are the strictest step size; training, not dogma | [M3] p. 122; [M4] (the laws codify line-by-line steps); [M2] Martin 2007 (following them perfectly does not always make sense); L9, slide 41 | Definitional. The card's wording paraphrases [M3] |
| `rules_green/on_green` | Rule 4: change structure only while all tests pass, and nothing else with it | [B1] Preface (second rule: eliminate duplication) and ch. 11 (draft pp. 46-47); [F8] ch. 2, "The Two Hats"; [B2] (mixing refactoring into making a test pass is a mistake); L9, slides 27, 35 | Definitional. No study isolates this rule (gap 8) |
| `rules_green/two_hats` | Never cleaning up is the common way TDD goes wrong | [F1] ("the most common way ... to screw up TDD is neglecting the third step"); [E12] Romano et al. 2017, [E24] Aniche and Gerosa 2010 (developers often skip refactoring) | Moderate |
| `benefits/more_tests` | More tests: the most consistent finding | [E3] Erdogmus et al. 2005; [E16] Fucci et al. 2018; [E19] Baldassarre et al. 2021; [E6]; [R10] Karac and Turhan 2018 | Strong |
| `benefits/safety_net` | A regression safety net makes change and refactoring safe | [F2] Fowler, "Self Testing Code"; [B1] Preface (ratchet); L9, slide 27 | Definitional. Test-after can give the same net [F2] |
| `benefits/docs` | Tests document how to call the code, only while kept current | [M1], [M2]; L9, slide 40; [E12] (observed developers rarely kept tests up to date); [R10] | Qualified on purpose (see section 3, point 4) |
| `benefits/small_units` | Smaller, simpler units; overall design debated | [E6] Janzen and Saiedian 2008; [R3] Shull et al. 2010, p. 17; [D2] Hansson 2014; [D4] Ousterhout and Martin 2024-25 | Moderate; coupling and cohesion claims are not confirmed |
| `costs/time` | In four industrial case studies: pre-release defect density 40 to 90% lower than similar teams, and a management-estimated 15 to 35% more development time | [E5] Nagappan et al. 2008, abstract and Table 3, p. 297 | Strong as a description of that study. Not randomized; comparison projects differ in size; four teams. The screen says "4 teams, not a general law" |
| `costs/discipline` | A learning curve; tests are code; tests of internals break on refactoring | [E23] Papis et al. 2022; [E18] Romano et al. 2019; [R6] Čaušević et al. 2011; [X1] Meszaros 2007, "Fragile Test", p. 239; L9, slide 15 | Moderate; practitioner consensus |
| `costs/limits` | Needs automated, fast, repeatable checks; poor fit without an exact answer, for response time, availability, and security, and for big designs | [B1] Preface (security, concurrency); [F7]; [C4] Barr et al. 2015; [C6]; [R3] p. 17; L9, slide 42; [B1] ch. 32 and [M4] (architecture is a separate, slower cycle) | Strong, reasoned from primary authorities. No TDD-specific study of non-functional properties was found |
| `evidence/versus_after` | Against a test right after each small piece of code: mostly no clear difference; big gains against late or scarce testing | [E22] Santos et al. 2021; [E13] Tosun et al. 2017; [E21]; [E10] Fucci et al. 2016; counterexample [E23]; [R7] Rafique and Mišić 2013; [E5] | Moderate to strong. "Mostly" matters: [E23] found an advantage; [E22] found test-last slightly ahead for novices |
| `evidence/steady` | Quality and productivity went with short, steady cycles, not test order | [E11] Fucci et al. 2017 (39 professionals); [R10] | Moderate (one rigorous study, consistent with [E4], [E20]). "And that it can fail" is the lesson's reasoning from rule 2 |
| `evidence/practice` | Strict TDD is rare (1.7% of 2,443 developers); hold realistic expectations | [E17] Beller et al. 2019; [E9]; [R10] p. 84 | Strong |

### Where the lecture and the evidence differ, and what the lesson does

These are the points for the instructor. The lecture is right about the practice and its rationale; the differences are in how strongly the benefits are claimed and whom the rules belong to. Rows 1 to 6 are points the evidence **contradicts or corrects**. Rows 7 to 10 are not errors in the slides: the lecture is silent or informal there, and the evidence adds a qualification worth a line.

| # | Lecture (L9) | What the evidence says | What the narration does | Suggested slide change |
|---|---|---|---|---|
| 1 | Slide 40: "TDD can increase productivity", citing Karac and Turhan | Karac and Turhan conclude the opposite: no consistent benefit, especially for productivity [R10, pp. 82, 84]. Meta-analysis: little to no effect on productivity [R7]; industrial studies report more initial time [E5, R6] | Says "time up front" is a cost, gives the case-study numbers with their context, and says experiments against test-right-after "mostly find no clear difference, in quality or in speed" | Replace with "Small, tested steps keep you focused; evidence on productivity is mixed, and industrial teams report more time up front" |
| 2 | Slides 28, 40: "TDD often leads to better design"; "leads to more modular design" | Smaller, simpler, better-tested units are found [E6]; lower coupling and higher cohesion were not confirmed [E6]; no consistent effect on internal quality [R3]; critics argue the opposite [D2, D3] | Benefit card "Small, testable units", with "Whether TDD improves a system's overall design is still debated" and a gray "Debated" card | "Writing the test first makes you design the interface from the caller's side; studies find smaller, simpler units. An overall design benefit is debated" |
| 3 | Slide 40: the citation "I. Karac & B. Tunhan" | The second author is Burak **Turhan**; *IEEE Software* 35(4):81-85, 2018 | Cites it correctly on screen | Fix the spelling |
| 4 | Slide 40: "Tests ... are always up-to-date" | Only if maintained: observed developers rarely kept tests current [E12]; [R10] flags test maintenance | "That holds only while you keep the tests current"; tag "Only while kept current" | "Well-kept tests document how the code is meant to be used" |
| 5 | Slide 41: "Rules of Test-Driven Development (According to 'Uncle Bob')" as *the* rules | The three laws are Robert Martin's strict, line-by-line formulation [M3, M4]; Beck's own rules are two (a failing test first; remove duplication) and leave the step size to your confidence [B1 Preface, ch. 28]; Martin himself says following them perfectly does not always make sense [M2] | Four named rules; the three laws appear as "the strictest form", as training. This matches the slide's own "This is NOT a dogma" | Title it "The three laws of TDD: the strictest form (Robert C. Martin)" |
| 6 | Slide 20: "Originally proposed by Kent Beck" | Beck calls it a rediscovery; test-first practice is older [R2, R1] | No history in speech | "Developed and popularized by Kent Beck in the late 1990s" |
| 7 | Slides 19, 20, 24 present putting the test first as the defining move; the lecture does not say which part of TDD produces its benefits | Once cycle length and steadiness are accounted for, the order had no important influence [E11]; similar in students [T14]. Test-first reliably yields more tests | "What tracks the benefits is the rhythm ... Writing the test first mainly guarantees that the test gets written, and that it can fail" | Add one line: "The benefits track short, steady cycles more than which came first" |
| 8 | The lecture does not say how widely TDD is practiced | Strict TDD is rare in practice: 1.7% of 2,443 developers [E17]; about 12% of projects that claimed it [E9] | "In practice, strict TDD is rare: most developers let tests guide them more loosely" | Mention it under "not a dogma" |
| 9 | Slide 42: the epigraph about "taller and taller towers", and "ACID-compliant DBMS" as the example | No source was found for either (dossier gaps 11) | Uses sourced limits: no exact right answer, non-functional qualities, big designs that cannot grow test by test | Mark the epigraph as anonymous; tie the limit to Beck's own caveat on concurrency and security |
| 10 | Slide 26: the first green for `MyStack` is `pass`; slide 37: a new test "already passes, yay" | Not wrong, but a test that passes at once has not been seen to fail | The lesson's rule 2 treats an unexpectedly green new test as a warning. The narration avoids the stack example entirely (it belongs to the song) | On slide 37, add "expected to pass: it confirms, it does not drive new code" |

Also different from the **chapter** (`SEBook/testing/tdd.md`), which the main session may want to align: it calls the three laws "three non-negotiable rules", names them "Rule One, Two, Three", and its Strategic Impact section claims TDD "naturally leads to smaller, more loosely coupled interfaces" (the "smaller" half is supported; "more loosely coupled" is not confirmed).

### What the lesson deliberately leaves out

- **History and people** (Beck, Martin, JUnit's origin, Project Mercury, the 2014 "Is TDD Dead?" debate): not in speech, by the format's rule. The debate's substance is carried by "still debated".
- **Knight Capital**: the lecture's opening motivates testing in general. A video on TDD needs a failure that test-*first* addresses, so the lesson opens on a test that confirmed its own code.
- **Mocks and test doubles, classicist against mockist TDD, coverage and mutation testing, the test pyramid, arrange-act-assert, fixtures**: other chapters, the song, and the tutorials cover them. `split` is a pure function, so it needs no double, which is itself the right decision.
- **Flow and focus**: only a hypothesis in the literature [E11 discussion, E25]; the lesson makes the attention argument only for the test list, which is Beck's own.
- **Numbers that could not be verified** (the 76% and 88% figures of [R9]; the 18% and 16% of [E2] without its confounds): not used.

### The running example

"Split the bill" is original to this lesson. Its shape follows Beck's Money example in spirit only (integers for money, a result that must add up) and uses none of its code. The Strategy lesson's group-expense app shares the theme of splitting; this lesson's function, numbers, and story are separate, and it does not reuse that lesson's classes. The song's and lecture's `MyStack` and the tutorial's Dragon Dice are not used.

Design decisions pinned by the tests: amounts are whole cents; the shares sum to the bill; shares differ by at most one cent; the first people in the list pay the leftover cents. The third test's input (8000 cents, 3 people) has the largest possible remainder for three people, so it also fails an implementation that gives all leftover cents to one person.

### Code and runner output

Every code card, every runner line, the closer look, and the complete example were compiled and run in all four toolchains on 2026-11-26 (`code.md`; raw output in `verified-runner-output.txt`; driver `verify/gen.py`). Versions: pytest 8.4.2 on Python 3.13; JUnit Jupiter with Console Launcher 1.11.4 on JDK 25; GoogleTest 1.18 with gMock, Apple clang, `-std=c++17 -Wall -Wextra -pedantic -Werror`; Jest 29 with ts-jest, `strict`.
