# Homework 3 assignment workspace

`_data/tutorials/homework-3.yml` uses the React tutorial runtime as an assignment
workspace at `/SEBook/tools/homework-3`, with its normal `/print` companion.
The CS35L navigation links it; `exclude_from_index: true` keeps it out of the
guided tutorial catalog. All three milestones share nine editable files, with
stable step keys and ordinary file autosave. They deliberately have no quizzes,
model solutions, hint ladders, or progression gates. `show_hints: false` also
suppresses TutorChat's automatically generated hints. Reset restores the shared
starter, so the instructions explicitly warn that it resets the notebooks too.

## Sources and adaptations

- Assignment text: the user's pasted “A simple interactive game app” handout.
- Starter: [UCLA-CS-35L/assign3 at f7e6476](https://github.com/UCLA-CS-35L/assign3/tree/f7e64760134cedd246aa5a9ac01b2bcf0a692e60).
  The Python starter, package configuration, and Vite configuration are retained.
  App is an assignment placeholder without a game implementation. Main uses
  namespace imports so stripping imports for the browser still works. Styles
  retain the board hooks with readable sizing, contrast, focus and print rules.
- Grader: user-supplied `assign3.zip`, SHA-256
  `7abf9b68c1af98a81ebb9ab53185e88680465107fa417f7223c6b446f1b2c515`.
  Its Python/Selenium runner and installation scripts are not executed or
  distributed by this page. The earlier `autograder_2.zip` was unrelated and
  is not used.

## Independent public checks

The nine browser checks are authored from the assignment rules, with different
opening positions, move sequences, and assertions from the supplied grader.
They are formative feedback, not a public copy of the private grading suite.
Descriptions name the rule being exercised; assertion failures include the
expected and actual full board. Students are asked to reproduce failures and
write additional cases rather than special-case public examples.

Coverage includes alternating placement and occupied-square rejection; legal
horizontal, vertical, and diagonal movement; the three-piece limit; invalid
sources and destinations; row-edge adjacency; turn and selection recovery;
center vacating and winning exceptions for **both** players; and terminal
boards after placement and movement wins across rows, columns, and diagonals.
Expected boards are literal examples. No move validator, winner algorithm,
reference game, or completed assignment implementation is stored in the
assignment, browser checks, test fixtures, or download code.

The selector preserves the assignment's nine square-button contract and accepts
`Xx`, `0Oo`, or blank. Buttons are queried again after each event so harmless
React DOM replacement does not break checks. React `flushSync` settles ordinary
state updates from each click. `react_reset_between_tests: true` rebuilds the
isolated preview and assertion channel before every scenario, even after a
failure, without changing the student's source. Other React tutorials keep
their existing shared-preview behavior by default.

All browser-delivered tests are inspectable. Independent examples avoid leaking
the private cases, but cannot prevent hard-coding the public examples or prove
correctness for every game. Keep the real Gradescope suite outside this repo.
The six original copied cases and their method-name mapping have been removed.

## Boundaries students must see

These checks are not an official score. The preview uses React 18 and the
starter's local Vite project uses React 19. Arbitrary npm imports are not
supported by the preview; single-line imports are stripped. The local project
and Gradescope remain the final verification environment.

Students must retain the two starter Python examples and add at least three
new test methods, including a post-win test. The browser does not execute or
pretend to grade those Python tests, notebook quality, build/package correctness,
or lateness. Students can run their Python tests in the local starter or upload
a browser download directly.

## Instructor and print views

The assignment has no `solution` payload. The shared tutorial layout only emits
a Solution control for tutorials that actually define solutions, so adding
`?instructor-mode=true` cannot reveal an assignment solution. This preserves
instructor controls for other tutorials that do provide worked solutions.

The Print link opens `/SEBook/tools/homework-3/print`, a standalone light-mode
assignment brief with all three sections, rules, and the submission checklist.
`print_starter_files: false` omits the nine shared starter files from each section
rather than printing the same listings three times. The page offers Print / Save
as PDF and never includes the student's draft code or any solution. Download ZIP
remains the way to export current code. Instructor mode has the same brief.

## Submission download

**Download ZIP** is available in all three sections. The `download` manifest
lists the nine project files explicitly. The controller reads their current
editor models at activation, so it includes inactive-file edits, empty notebooks,
and edits made with Auto-save off. It never falls back to stale saved progress.
Missing models fail the export rather than producing a partial archive.

`assign.zip` contains `src/` and the remaining files at the archive root, matching
the supplied grader's `/autograder/submission/package.json` and Python-test paths.
It contains neither the site runtime nor instructor checks. The download uses
locally vendored fflate 0.8.2 (MIT); see its vendor README for provenance.
Students upload this ZIP to Gradescope themselves. Downloading does not grade,
submit, or assert completeness. No external service receives student code.
For local testing, extract it into the course starter, retaining `helper` and
`requirements.txt`; local edits can still be packaged with `./helper zip`.

The handout's WSL `headless` argument is unsupported by the pinned starter's
argument parser. Instructions identify the version difference rather than
promising that this invocation works. The upstream helper and Docker setup
are not reimplemented in the site.
