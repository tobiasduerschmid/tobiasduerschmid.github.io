# Deep Bug Audit Report

Date: 2026-05-04

## Confirmed Bugs Fixed

### 1. Advanced Git Step 4 solution raced its own tests

**Confirmation:** `npx playwright test tests/git-advanced-tutorial.spec.js` repeatedly timed out on Step 4 with only 2/5 tests passing before the fix.

**Root cause:** `applySolution()` returned while long v86 solution commands could still be draining through the terminal. The test then clicked "Test My Work" against a partial repository state.

**Change:** `js/tutorial-code.js` now waits for active step setup and adds v86 prompt barriers before and after visible solution commands.

### 2. Advanced Git Step 6 instructor solution did not do the required task

**Confirmation:** After Step 4 was fixed, Step 6 consistently failed because `.git-blame-ignore-revs` was missing the CI-Bot formatter commit.

**Root cause:** The test correctly required the Task 2 ignore-revs workflow, but the instructor solution only ran `git blame` and never wrote `.git-blame-ignore-revs`.

**Change:** `_data/tutorials/git-advanced.yml` now writes the CI-Bot SHA to `.git-blame-ignore-revs` and configures `blame.ignoreRevsFile`.

### 3. Advanced Git Step 7 used an unavailable Python test path

**Confirmation:** A temporary diagnostic Playwright spec showed Step 7's repository was repaired, while the test still failed; the VM diagnostic reported `python3: command not found` in the test execution path. A later pass also showed that the first shell-only replacement was too exact because it accepted only one source spelling of a correct `absolute()` repair.

**Root cause:** The step's bisect instructions and validation relied on `python3 test_calculator.py`, but that command is not reliable in the v86 test runner path. Replacing it with one exact `grep` moved the false negative from "missing interpreter" to "equivalent correct code rejected."

**Change:** Step 7 now uses shell-only validation that extracts the effective `absolute()` body and accepts common correct repairs such as `abs(x)`, sign-check ternaries, and if/else branches.

### 4. Advanced Git capstone counted the wrong commit range

**Confirmation:** The capstone reached 5/7 passing tests. The Git graph showed exactly one solution fix commit after setup's final seeded capstone commit, but the test counted from the bug commit and included setup's later seeded commits.

**Root cause:** The "exactly one fix commit" gate used `Capstone: simplify absolute...` as the baseline even though setup intentionally adds later capstone commits before the learner fix.

**Change:** The capstone now counts commits after `Capstone: reorder helper comments`, the final seeded setup commit.

### 5. Advanced Git Step 4 validation pinned exact source text

**Confirmation:** The Step 4 validation gate required exact strings for `ValueError("Cannot divide by zero")`, `TypeError("Arguments must be numbers")`, `return a ** b`, and `return a / b`. That rejects semantically correct learner repairs that use different exception text or equivalent whitespace while still satisfying the tutorial task.

**Root cause:** The gate checked literal source snippets instead of the workflow's durable outcome. The step had already stopped relying on stash reflogs because they are not durable after `stash pop`, but the replacement gate overfit to one instructor-solution spelling.

**Change:** Step 4 now extracts the `safe_divide()` and `power()` bodies with shell tools and checks the required control-flow shape without pinning exact exception messages or whitespace.

### 6. v86 background serial work could collide with the interactive terminal

**Confirmation:** I applied the new background-sync tests to a clean current `HEAD` without the runtime fix and ran them in an isolated no-server Playwright config. The two new checks failed: background serial fallback still ran after prompt reveal had started, and `_canAcceptTerminalInput` did not exist. The same four-test file passes after the fix.

**Root cause:** The runtime only checked `_terminalReadyForInput` when deciding whether legacy serial fallback could run. During prompt reveal that flag is intentionally false, so git graph/gutter fallback commands could still be injected while the terminal was becoming interactive. Separately, user keystrokes were forwarded to v86 even while output was muted or silent serial commands/listeners were still active.

**Change:** `js/tutorial-code.js` now records when prompt reveal starts, blocks legacy serial fallback after that point unless background sync is paused, gates user input on prompt visibility plus serial idleness, and retries prompt readiness recovery instead of silently accepting input early. `tests/tutorial-v86-background-sync.spec.js` covers both behaviors.

## Verification

- `bundle exec jekyll build --strict_front_matter` passed.
- `bash scripts/check_quizzes.sh` passed.
- `node --check js/tutorial-code.js` passed.
- `env JEKYLL_PORT=4184 npx playwright test tests/git-advanced-tutorial.spec.js` passed: 29/29.
- `npx playwright test tests/tutorial-v86-background-sync.spec.js --config /private/tmp/main-playwright.no-server.config.js` passed: 4/4.

## Not Staged By This Audit

The worktree also contains local untracked files under `.claude/`, `tmp/`, `design_doc.md`, and `tests/quiz-rendering.spec.js`. They were not changed for these confirmed bugs and should not be included in an audit-only commit.
