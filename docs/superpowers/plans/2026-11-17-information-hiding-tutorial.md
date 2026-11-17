# Information Hiding Tutorial Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Information Hiding in Python tutorial with a five-lesson, tool-driven tutorial in which students analyze change impact, refactor with the editor's tools, test, and re-analyze.

**Architecture:** One YAML file drives the existing `pyodide` tutorial runtime; no new runtime features. All code, graders, and instruction text were prototyped and verified, and ship as a kit that is copied into place. The remaining work is hints, quizzes, explanations, one small editor usability fix, wiring, and browser verification.

**Tech Stack:** Jekyll, `_data/tutorials/*.yml`, Pyodide + pytest, `js/tutorial-refactorings.js`, Python `unittest`, `node:test`, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-17-information-hiding-tutorial-design.md`
**Kit:** `docs/superpowers/specs/2026-11-17-information-hiding-tutorial-kit/` (`skeleton.yml`, three test files)

## Global Constraints

- Read before starting: `CLAUDE.md`, and the skills `tutorial-authoring`, `cs-tutorial-design`, `pedagogical-advisor`, `quiz-format`, `good-diagrams`, `diagrams`, `wcag-aa-compliance`, `light-dark-mode`, `print-light-mode`, `test-design`, `maintainable-code`, `keyboard-glossary-tracker`.
- Do not retype code from the kit. Copy files; edit only `TODO(...)` markers.
- Do not change any starter file, grader command, or instruction text in the skeleton unless a test in this plan requires it. If you must, rerun Tasks 1 and 3 tests.
- Say "change impact analysis". Never "change test".
- Reading budget: lesson 1 ≤ 420 visible words, lessons 2–5 ≤ 350.
- Quiz: title `Step N — Knowledge Check`, `min_score: 0.8`, 4 questions (5 in lesson 5). No "misconception" in feedback. No positional option references. No "run this snippet".
- Hints: three per check, titled by content, never the answer.
- No inline `style=` or `<style>`; fonts inherit; WCAG 2.2 AA; light, dark, and print.
- Work in a fresh worktree from `master`. Stage explicit paths only. Commit only when the user asks; where a step says "Commit", stage and stop if no commit was requested.

## Review Focus

1. Student selects whole lines including indentation → Extract must still be offered (Task 2 test).
2. Student extracts too few lines, so the owner returns the vendor's object → that lesson's "another provider" check fails, others stay green (`test_mistakes` in the grader test).
3. Student makes the client private before moving callers → checks fail by assertion, none crash (`renamed before moving`).
4. Student refactors by hand in a different shape → all checks pass (`test_other_correct_submissions`).
5. Returning student with an old save → lands on lesson 1, nothing credited, no error (Task 6 Playwright test).

---

### Task 1: Install the kit tests and the skeleton

**Files:**
- Create: `scripts/tests/test_information_hiding_graders.py`, `scripts/tests/test_information_hiding_content.py`, `scripts/tests/information-hiding-tool-paths.test.js` (copied from the kit)
- Replace: `_data/tutorials/information-hiding.yml` (copied from kit `skeleton.yml`)

**Interfaces:**
- Produces: lesson keys `payments`, `menu`, `wait-times`, `rewards`, `clubhub`; every later task edits only `TODO(...)` markers in the YAML.

- [ ] **Step 1:** Copy the three test files to `scripts/tests/`.
- [ ] **Step 2:** Run `python3 -m pytest scripts/tests/test_information_hiding_graders.py -q`. Expected: FAIL (`KeyError: 'payments'`; the old tutorial is still in place).
- [ ] **Step 3:** Copy kit `skeleton.yml` over `_data/tutorials/information-hiding.yml`.
- [ ] **Step 4:** Run `python3 -m pytest scripts/tests/test_information_hiding_graders.py -q`. Expected: `13 passed`.
- [ ] **Step 5:** Run `node --test scripts/tests/information-hiding-tool-paths.test.js`. Expected: `# pass 5`, `# fail 0`.
- [ ] **Step 6:** Run `python3 -m pytest scripts/tests/test_information_hiding_content.py -q`. Expected: exactly 3 failures (`test_nothing_is_left_unwritten`, `test_every_check_has_a_graduated_hint_ladder`, `test_quiz_format`), 7 passed.
- [ ] **Step 7:** Commit.

### Task 2: Let Extract accept whole-line selections

**Files:**
- Modify: `js/tutorial-refactorings.js` (`selectedStatementBoundsFromAnalysis`, about line 1418)
- Test: `tests/refactoring-engine.spec.js`
- Modify: `.agents/skills/tutorial-authoring/SKILL.md` (§4.5 bullet on `tutorial-refactorings.js`)

**Interfaces:**
- Consumes: `normalizeSelection(selection, content)` returning `{startLine, startCol, endLine, endCol}` (0-based columns).
- Produces: no API change.

- [ ] **Step 1: Write the failing test** next to `'only offers extract for a precise complete-statement selection'`:

```js
test('extract accepts whole lines selected together with their indentation', () => {
  const before = text`
class OrderService:
    def checkout(self, payments, cents):
        token = payments.authenticate()
        paid = payments.capture(token, cents)
        return paid
`;
  const workspace = workspaceFrom({ 'order_service.py': before }, 'order_service.py');
  const analysis = analyze(workspace);
  const exact = selectionBetween(before, 'token = payments.authenticate()', 'paid = payments.capture(token, cents)');
  const fromColumnOne = { ...exact, startColumn: 1 };
  const throughNextLineStart = { ...exact, startColumn: 1, endLineNumber: exact.endLineNumber + 1, endColumn: 1 };
  const expected = applyPlan(workspace, adapter.planExtract(workspace, analysis, 'order_service.py', exact, 'charge'));
  for (const selection of [fromColumnOne, throughNextLineStart]) {
    const plan = adapter.planExtract(workspace, analysis, 'order_service.py', selection, 'charge');
    expect(plan.error).toBeFalsy();
    expect(applyPlan(workspace, plan)).toEqual(expected);
    expect(api.computePythonActionAvailability(workspace, analysis, 'order_service.py',
      { lineNumber: selection.startLineNumber, column: selection.startColumn }, selection, null).extract).toBe(true);
  }
});
```

- [ ] **Step 2:** Run `npx playwright test tests/refactoring-engine.spec.js -g "whole lines"`. Expected: FAIL with "Start the selection on the first token".
- [ ] **Step 3: Implement.** In `selectedStatementBoundsFromAnalysis`, right after `normalizeSelection`, if every character of the first selected line before `normalized.startCol` is whitespace and the selection extends past that line's indentation, set `normalized.startCol` to the index of the line's first non-whitespace character. Do not change `normalizeSelection` itself; other refactorings use it.
- [ ] **Step 4:** Run `npx playwright test tests/refactoring-engine.spec.js`. Expected: all pass, including `'does not extract partial expressions or indentation-only selections'`.
- [ ] **Step 5:** Add one sentence to the skill's `tutorial-refactorings.js` bullet: Extract accepts selections that start in the first statement's indentation; and add a short "Designing steps for the refactoring tools" note listing constraints 1–3 and 5 from the spec and naming `scripts/tests/information-hiding-tool-paths.test.js` as the pattern for pinning a tool path.
- [ ] **Step 6:** Commit.

### Task 3: Tool reference footer

**Files:**
- Create: `_includes/refactoring-tools-reference.html`
- Modify: `_data/tutorials/information-hiding.yml` (add `instructions_footer_include: refactoring-tools-reference.html` after `description`)

- [ ] **Step 1:** Read `_includes/regex-tutorial-reference.html` and mirror its element and class structure.
- [ ] **Step 2:** Write the include with the six bullets from the spec section "Tool reference footer". Native `<details>`/`<summary>`, no inline styles, platform-aware `<kbd>` for modifiers.
- [ ] **Step 3:** Run all three tests from Task 1 (same expected results as Task 1 Steps 4–6).
- [ ] **Step 4:** Commit.

### Task 4: Hints

**Files:**
- Modify: `_data/tutorials/information-hiding.yml` (every `hints:` placeholder)

- [ ] **Step 1:** Read `js/tutor-chat.js` to learn which file `code_*` conditions see in a multi-file Pyodide step. Use `condition:` only where it is reliable; otherwise write unconditional, self-diagnosing hints ("If the Refactor menu has no Extract entry, …").
- [ ] **Step 2:** Write one three-hint ladder per row of the spec's hint table, per lesson, adapted to that lesson's names. Define each ladder once with a YAML anchor and reference it from every check in its group.
- [ ] **Step 3:** Read each ladder as a whole: all three hints together must still leave the decision (which files, which lines, which assertion) to the student.
- [ ] **Step 4:** Run `python3 -m pytest scripts/tests/test_information_hiding_content.py -q -k hint_ladder`. Expected: PASS. Rerun the grader test: `13 passed`.
- [ ] **Step 5:** Commit.

### Task 5: Knowledge checks and solution explanations

**Files:**
- Modify: `_data/tutorials/information-hiding.yml` (`quiz.questions`, `solution.explanation` in all five lessons)

- [ ] **Step 1:** Write the 21 questions from the spec's blueprints (4, 4, 4, 4, 5). Set `difficulty` per the quiz-format skill. Vary which option is correct and keep the correct option from being the longest.
- [ ] **Step 2:** Write the five `solution.explanation` blocks from the spec.
- [ ] **Step 3:** Run `python3 scripts/audit_mcq_tells.py` and `python3 scripts/audit_difficulty_coverage.py`; fix anything they report for this tutorial.
- [ ] **Step 4:** Run `python3 -m pytest scripts/tests/test_information_hiding_content.py -q`. Expected: `10 passed`.
- [ ] **Step 5:** Run `npm run test:unit`. Expected: no new failures.
- [ ] **Step 6:** Commit.

### Task 6: Browser journey

**Files:**
- Create: `tests/information-hiding-tutorial.spec.js` (template: `tests/test-doubles-tutorial.spec.js`)

- [ ] **Step 1: Write the tests** as one serial journey on one page at `/SEBook/designprinciples/information-hiding-tutorial`:
  - `has five lessons` — `expectStepCount(page, 5)`.
  - For each lesson: `window._tutorial.applySolution()`, click **Test My Work**, expect `✅ All N tests passed!` with N = 8, 10, 11, 8, 12; then `answerQuizCorrectly`.
  - `starter fails the analysis checks` — on lesson 1 before applying the solution, Test My Work shows the first check failed and "The shop still behaves the same with PayPal" passed.
  - `each lesson shows its authored diagrams` — lesson 1 has two, lessons 2 and 3 one each; each is `role="img"` with a non-empty accessible name.
  - `an old save starts over` — seed `localStorage['tutorial-progress-information-hiding'] = {step: 5, stepsPassed: [0,1,2,3,4,5], quizPassed: [0,1,2], files: {'playlist.py': {content: 'x', language: 'python'}}, activeFile: 'playlist.py'}`, reload, expect lesson 1 active, lesson 2 locked, no page error.
  - `print view renders` — `/SEBook/designprinciples/information-hiding-tutorial/print` shows five lesson headings and four diagrams; no console errors.
- [ ] **Step 2:** Run `npx playwright test tests/information-hiding-tutorial.spec.js`. Fix the tutorial or the test until it passes.
- [ ] **Step 3:** Commit.

### Task 7: Wiring

**Files:**
- Modify: `SEBook/designprinciples/informationhiding.md` (last paragraph, line 1287)
- Modify: `_data/CS35L_nav.yml`, `_data/study_plans/CS35L.yml`

- [ ] **Step 1:** Replace the chapter's last paragraph with: "Once the flashcards and quiz feel solid, the [**Information Hiding in Python tutorial**](/SEBook/designprinciples/information-hiding-tutorial) puts this chapter to work in about 75 minutes. In five small designs you work out which files a change would touch, move the leaked knowledge into one module with the editor's refactoring tools, keep the tests green, and compare the change impact before and after. You practice on a payment provider, a file format, an algorithm, and a copied rule, then run a change impact analysis on a system you have not seen."
- [ ] **Step 2:** In `_data/CS35L_nav.yml`, after the "Information Hiding" subtopic, add `- name: Information Hiding Tutorial` with `url: /SEBook/designprinciples/information-hiding-tutorial`.
- [ ] **Step 3:** In `_data/study_plans/CS35L.yml`, as the first item under `# Design and process`, add `title: "Information Hiding Tutorial"`, `type: tutorial`, `url: /SEBook/designprinciples/information-hiding-tutorial`.
- [ ] **Step 4:** `bundle exec jekyll build`. Expected: no errors or new warnings.
- [ ] **Step 5:** Commit.

### Task 8: Verify in the browser and clean up

- [ ] **Step 1:** Start the `jekyll-serve` preview. Do lesson 1 as a student with the real tools: select the three lines (whole lines, with indentation), Extract `charge`, Move to `Payments`, Test. Confirm the menu entries, the preview dialog, and green tests. Do one Extract + Move in lesson 2 and the rename from the `def` line.
- [ ] **Step 2:** In every lesson check: the live diagram shows what the instructions say it shows; the linter shows no diagnostics on starter or solution; the footer opens; text is paragraph size.
- [ ] **Step 3:** Repeat the visual check in dark mode, at 900 px width, and in the print view (light palette, diagrams fit).
- [ ] **Step 4:** Time lesson 1 and lesson 5 as a student. If either exceeds 20 minutes, report it instead of trimming on your own.
- [ ] **Step 5:** Run `npx playwright test tests/wcag22-complete-audit.spec.js tests/ai-training-opt-out.spec.js` and the three Task 1 tests. All pass.
- [ ] **Step 6:** Delete `docs/superpowers/specs/2026-11-17-information-hiding-tutorial-kit/`. Its files now live at their final paths.
- [ ] **Step 7:** `git diff --cached --name-only` and `git diff --cached --check`. Commit. Report: the submodule was not touched; one shared runtime file changed (`js/tutorial-refactorings.js`).
