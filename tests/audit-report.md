# Tutorial Test Suite Audit & Stabilization Report

## 1. Primary Fixes

### 1.1 Git Tutorial Step 13 Timeout
- **Issue:** Step 13 ("Resolving a Merge Conflict") was failing due to a two-fold issue:
  1. `git merge` would occasionally hang awaiting an editor for the merge commit message.
  2. The complexity of the step (6 serial Git commands in v86) exceeded the 30s/60s timeouts.
- **Solution:**
  - Appended `--no-edit` to the `git merge` command in `_data/tutorials/git.yml`.
  - Increased `TEST_RUN_TIMEOUT` in `tests/git-tutorial.spec.js` to 120 seconds.
  - Increased `_runSilent` command safety timer in `js/tutorial-code.js` from 10s to 30s.

### 1.2 Race Condition in Solution Application
- **Issue:** `applySolution()` in `js/tutorial-code.js` was returning immediately while commands were still queued in the VM. Tests would then attempt to verify state (or answer quizzes) before the environment was ready.
- **Solution:**
  - Refactored `_syncFileToBackend` and `_syncFileToV86` to return Promises.
  - Refactored `applySolution` to return a unified Promise that chains all file writes and command executions.
  - Updated `tests/tutorial-helpers.js` and `tests/git-tutorial.spec.js` to explicitly `await` the result of `applySolution`.

### 1.3 Port Conflict Resolution
- **Issue:** The Jekyll server was picking dynamic ports, causing `baseURL` mismatches in Playwright.
- **Solution:** Updated `playwright.config.js` to force the server into port 4000 (`JEKYLL_PORT=4000`).

## 2. Stability Improvements

- **Shell Tutorial:** Resolved a persistent timeout in step 1 ("Hello, Shell!") which was caused by the same race condition mentioned in 1.2.
- **Test Helper Cleanup:** Removed the fragile `page.waitForTimeout(2_000)` calls from the test helpers, as they are now superseded by deterministic `await` on the engine state.
- **Duplication Reduction:** Eliminated the custom `passCurrentStepTestsV86` from `git-tutorial.spec.js`, as the global helper is now robust enough to handle the v86 backend.

## 3. Verification Results

- **Shell Scripting:** PASSED (All 30+ tests)
- **Node.js:** PASSED
- **Pyodide (Python):** PASSED
- **Git Tutorial:** Awaiting final full-file run (Step 13 passing in isolation confirms the fix).

## 4. Maintenance Recommendation

- Keep `workers: 1` for all tutorial tests to prevent VM orchestration deadlocks.
- Monitor the v86 boot process; if timeouts occur, consider further increasing `VM_BOOT_TIMEOUT`.
