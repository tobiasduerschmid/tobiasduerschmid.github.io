---
title: "Version Control with Git — Sample Solutions"
layout: sebook
---

# Version Control with Git — Sample Solutions

These are reference solutions for each exercise in the interactive tutorial.
For Git steps, the "solution" is the sequence of terminal commands to run.
Each solution explains **why** the commands are correct.

---

## Step 1: Your First Repository

```bash
# Initialize a new repository in a directory called myproject
git init myproject

# Navigate into it
cd myproject

# Explore what was created
ls -la
```

**Why this is correct:**

- **`git init myproject`:** Creates a new directory `myproject/` and initializes a `.git/` folder inside it. The `.git/` folder is the entire repository — it stores all history, branches, and configuration. Without it, the directory is just a regular folder.
- The tests check: (1) `git config user.name` returns a non-empty value (already configured by the tutorial setup), (2) `git config user.email` returns a value, and (3) `/tutorial/myproject/.git` exists as a directory.
- **Plumbing vs. porcelain:** `git init` is a porcelain command. Internally it creates low-level object store directories (`objects/`, `refs/`) — the plumbing that all other commands build on.

---

## Step 2: Your First Commit

```bash
# Make sure you're in the myproject directory
cd /tutorial/myproject

# Check the status — calculator.py should appear as untracked (red)
git status

# Stage the file (move to staging area / loading dock)
git add calculator.py

# Check status again — calculator.py should now be green (staged)
git status

# Commit the staged snapshot with a descriptive message
git commit -m "Add calculator module with add and subtract"

# Verify — should say "nothing to commit, working tree clean"
git status
```

**Why this is correct:**

- **`git add calculator.py`:** Moves the file from the Working Directory to the Staging Area. Before `git add`, the file is "untracked" — Git sees it but doesn't track it. After, it's "staged" (green in `git status`).
- **`git commit -m "Add calculator module with add and subtract"`:** Creates a permanent snapshot. The test checks `git log --oneline | head -1 | grep -qi 'calc\|add'` — so the commit message must contain "calc" or "add" (case-insensitive).
- The test also verifies `git log --oneline -- calculator.py | grep -q '.'` — `calculator.py` must appear in at least one commit's history.
- **Why the two-step add/commit?** The Staging Area lets you precisely control what goes into each commit. You can edit 10 files but commit only 3 as one logical change.

---

## Step 3: The Edit-Stage-Commit Cycle

```bash
# Open calculator.py in the editor and add this function at the bottom:
# def multiply(a, b):
#     """Return the product of a and b."""
#     return a * b

# After saving (Ctrl+S), check status — calculator.py should be "modified" (red)
git status

# Preview what changed before staging (working directory vs. staging area)
git diff

# Stage and commit
git add calculator.py
git commit -m "Add multiply function to calculator"

# Review your history
git log
```

**The completed `calculator.py`:**

```python
"""A simple calculator module."""


def add(a, b):
    """Return the sum of a and b."""
    return a + b


def subtract(a, b):
    """Return the difference of a and b."""
    return a - b


def multiply(a, b):
    """Return the product of a and b."""
    return a * b
```

**Why this is correct:**

- **Test 1:** `grep -q 'def multiply' calculator.py` — the `multiply` function must exist in the file.
- **Test 2:** `git log --oneline | grep -qi 'multiply'` — the commit message must contain "multiply" (case-insensitive). The sample message `"Add multiply function to calculator"` satisfies this.
- **Test 3:** `[ $(git log --oneline | wc -l) -ge 2 ]` — the repository must have at least 2 commits total.
- **`git diff` before staging:** Compares the Working Directory to the Staging Area. Since nothing is staged yet, the staging area still matches the last commit — so `git diff` shows your `multiply` function as new lines with `+`.

---

## Step 4: Staging Strategies

```bash
# See all untracked files
git status

# Stage only README.md
git add README.md
git status   # README.md is green; others still red

# Stage test files using a glob pattern
git add test_*.py
git status   # test_calc.py and test_utils.py are now green

# Stage everything remaining (notes.txt)
git add .
git status   # All files are green

# Commit all staged files
git commit -m "Add test files, README, and project notes"
```

**Why this is correct:**

- **`git add README.md`:** Stages only `README.md`. The test verifies `git log --all --oneline -- README.md | grep -q '.'`.
- **`git add test_*.py`:** The shell glob expands to `test_calc.py test_utils.py`. Both are staged. Tests verify both files appear in history.
- **`git add .`:** Stages everything in the current directory and subdirectories — including `notes.txt`. The test verifies `notes.txt` is in history.
- **Four staging strategies:** Individual file (`git add README.md`), wildcard (`git add test_*.py`), current directory (`git add .`), all tracked+untracked (`git add --all`). All achieve the same end result here but give different levels of control.

---

## Step 5: Unstaging and Undoing Changes

```bash
# Add broken content and stage it
echo "BROKEN CODE" >> calculator.py
git add calculator.py
git status   # calculator.py is staged (green)

# Unstage it — move off the loading dock WITHOUT losing the edit
git restore --staged calculator.py
git status   # calculator.py is now modified but unstaged (red)

# Discard the working directory change entirely
git restore calculator.py
git status   # "nothing to commit, working tree clean"
```

**Why this is correct:**

- **Test 1:** `! grep -q 'BROKEN CODE' calculator.py` — the "BROKEN CODE" line must NOT be in the file. `git restore calculator.py` restores it to the last committed version.
- **Test 2:** `git diff --quiet && git diff --cached --quiet` — both the working directory and the staging area must be clean (no uncommitted changes).
- **`git restore --staged`:** Moves the file from staged → modified-but-unstaged. Edits are preserved — they stay in the working directory.
- **`git restore` (without `--staged`):** Discards working directory changes permanently. There is no undo — the file was never committed, so Git has no record of the "BROKEN CODE" version.
- **Warning:** `git reset --hard` would discard ALL uncommitted changes across all files — the nuclear option. Use it only when you're sure.

---

## Step 6: Ignoring Files with .gitignore

```bash
# Simulate problem files
mkdir -p __pycache__
echo "bytecode" > __pycache__/calculator.cpython-311.pyc
echo "SECRET_KEY=abc123" > .env
echo "debug log" > debug.log

# See them appearing in git status
git status

# Open .gitignore in the editor and add these patterns:
# __pycache__/
# *.pyc
# .env
# *.log

# After saving, verify the files vanish from status
git status   # Only .gitignore itself appears as untracked

# Commit the .gitignore
git add .gitignore
git commit -m "Add .gitignore to exclude compiled and secret files"
```

**The completed `.gitignore`:**

```
__pycache__/
*.pyc
.env
*.log
```

**Why this is correct:**

- **Tests verify each pattern:** `grep -q '__pycache__' .gitignore`, `grep -q '.env' .gitignore`, `grep -q '\*.pyc' .gitignore`.
- **`.gitignore` is committed:** `git log --oneline -- .gitignore | grep -q '.'` — the file must appear in history.
- **`.env` is not tracked:** `! git ls-files --cached | grep -q '.env'` — the secret file must never have been staged or committed.
- **`__pycache__/`:** The trailing `/` matches only directories named `__pycache__`, not a hypothetical file with that name.
- **`*.pyc`:** A glob that matches any file ending in `.pyc` in any subdirectory.
- **Why commit `.gitignore`?** Sharing it ensures all contributors automatically get the same ignore rules — including protection against accidentally committing `.env` secrets.

---

## Step 7: Inspecting History

```bash
# View full commit log (press q to exit)
git log

# Compact one-line view — easier to scan
git log --oneline

# Inspect the most recent commit (full diff)
git show HEAD

# Compare previous commit to latest
git diff HEAD~1 HEAD
```

**Why this is correct:**

- **Test:** `[ $(git log --oneline | wc -l) -ge 3 ]` — the repository must have at least 3 commits. By this step, you have: initial commit (Step 2), multiply commit (Step 3), and gitignore commit (Step 6).
- **`git log`:** Shows hash, author, date, and message for each commit. The hash is a 40-character SHA-1 identifier for each snapshot.
- **`git show HEAD`:** Displays the metadata plus the complete diff of the most recent commit. `HEAD` is a symbolic reference that always points to the currently checked-out commit.
- **`HEAD~1`:** Relative syntax for "one commit before HEAD". `HEAD~2` is two commits back, etc.
- **`git diff` variants to know:**
  - `git diff` — Working Directory vs. Staging Area (unstaged changes)
  - `git diff HEAD` — Working Directory vs. Last Commit (all uncommitted changes)
  - `git diff --staged` — Staging Area vs. Last Commit (what would be committed)
  - `git diff HEAD~1 HEAD` — Previous commit vs. latest commit

---

## Step 8: Branching

```bash
# List current branches
git branch   # shows "* main"

# Create and switch to a new branch
git switch -c feature-divide

# Confirm you're on the new branch
git branch   # shows "* feature-divide"

# Open calculator.py in the editor and add at the bottom:
# def divide(a, b):
#     """Return the quotient of a and b."""
#     if b == 0:
#         raise ValueError("Cannot divide by zero")
#     return a / b

# Stage and commit on the feature branch
git add calculator.py
git commit -m "Add divide function with zero-division check"

# Switch back to main — the divide function disappears
git switch main
cat calculator.py   # no divide function here

# Switch back to feature to verify
git switch feature-divide
cat calculator.py   # divide function is back

# Explore the branch pointer files
cat .git/refs/heads/main
cat .git/refs/heads/feature-divide
cat .git/HEAD

# Inspect an old commit in detached HEAD state, then return
git switch --detach HEAD~1
git switch feature-divide
```

**Why this is correct:**

- **Test 1:** `git branch | grep -q 'feature-divide'` — the branch must exist.
- **Test 2:** `git show feature-divide:calculator.py | grep -q 'def divide'` — the divide function must exist on the feature branch.
- **Test 3:** `git log feature-divide --oneline | grep -qi 'divide'` — the commit message must reference "divide".
- **Test 4:** `git branch --show-current | grep -q 'feature-divide'` — you must finish on the `feature-divide` branch (after returning from detached HEAD).
- **`git switch -c feature-divide`:** `-c` creates and switches in one command. A branch is just a 41-byte file in `.git/refs/heads/` containing the current commit's SHA.
- **Disappearing divide function:** When you `git switch main`, Git updates your working directory to match the snapshot that `main` points to — the `divide` function was never committed to `main`, so it vanishes. This is the power of branches as separate timelines.

---

## Step 9: Merging Branches

```bash
# Switch to the branch you want to merge INTO
git switch main

# Merge the feature branch (fast-forward — main has no new commits)
git merge feature-divide

# Verify the divide function is now on main
cat calculator.py
git log --oneline   # feature commit should now appear on main

# Optional cleanup: delete the feature branch
git branch -d feature-divide
```

**Why this is correct:**

- **Test 1:** `git branch --show-current | grep -q 'main'` — you must be on main.
- **Test 2:** `grep -q 'def divide' calculator.py` — the divide function must be in the working file on main after the merge.
- **Test 3:** `git log main --oneline | grep -qi 'divide'` — the divide commit must be in main's history.
- **Fast-forward merge:** Because `main` had no new commits since `feature-divide` was created, Git simply slides the `main` pointer forward to the same commit as `feature-divide`. No merge commit is created; the history stays perfectly linear.
- **`git branch -d feature-divide`:** The `-d` flag safely deletes only if the branch is fully merged. Its work is now part of `main`, so this is tidy cleanup.

---

## Step 10: Preparing for a Merge Conflict

```bash
# Create the update-add-function branch and switch to it
git switch -c update-add-function

# Open calculator.py and change the add function to:
# def add(a, b):
#     """Return the sum of a and b (integers only)."""
#     if not isinstance(a, (int, float)) or not isinstance(b, (int, float)):
#         raise TypeError("Arguments must be numbers")
#     return a + b

# Stage and commit
git add calculator.py
git commit -m "Add type checking to add function"

# Switch back to main (STAY here — conflict setup continues in next step)
git switch main

# Verify main still has the original add function
head -8 calculator.py
```

**Why this is correct:**

- **Test 1:** `git branch | grep -q 'update-add-function'` — the branch must exist.
- **Test 2:** `git log update-add-function --oneline | grep -qi 'type\|check\|add'` — the commit message must reference "type", "check", or "add".
- **Test 3:** `git branch --show-current | grep -q 'main'` — you must end on `main`.
- **Why this creates a conflict:** The `update-add-function` branch changed the `add` function. In the next step, you'll make a *different* change to the same function on `main`. When you then merge, both branches have diverging changes to the same lines — triggering a conflict.

---

## Step 11: Resolving a Merge Conflict

```bash
# Make sure you're on main
git switch main

# Open calculator.py and change add to:
# def add(a, b):
#     """Return the sum of a and b (with logging)."""
#     print(f"Adding {a} + {b}")
#     return a + b

# Stage and commit this change on main
git add calculator.py
git commit -m "Add logging to add function"

# Attempt the merge — this triggers a CONFLICT
git merge update-add-function

# Open calculator.py — you'll see conflict markers:
# <<<<<<< HEAD
#     """Return the sum of a and b (with logging)."""
#     print(f"Adding {a} + {b}")
#     return a + b
# =======
#     """Return the sum of a and b (integers only)."""
#     if not isinstance(a, (int, float)) or not isinstance(b, (int, float)):
#         raise TypeError("Arguments must be numbers")
#     return a + b
# >>>>>>> update-add-function

# Edit calculator.py to combine both versions — remove ALL markers:
# def add(a, b):
#     """Return the sum of a and b (with type checking and logging)."""
#     if not isinstance(a, (int, float)) or not isinstance(b, (int, float)):
#         raise TypeError("Arguments must be numbers")
#     print(f"Adding {a} + {b}")
#     return a + b

# Stage the resolved file (this marks the conflict as resolved)
git add calculator.py

# Complete the merge commit
git commit -m "Merge update-add-function: combine type checking and logging"
```

**The resolved `calculator.py` `add` function:**

```python
def add(a, b):
    """Return the sum of a and b (with type checking and logging)."""
    if not isinstance(a, (int, float)) or not isinstance(b, (int, float)):
        raise TypeError("Arguments must be numbers")
    print(f"Adding {a} + {b}")
    return a + b
```

**Why this is correct:**

- **Test 1:** `! grep -q '<<<<<<<\|=======\|>>>>>>>' calculator.py` — all conflict markers must be removed. Leaving even one marker in the file is a bug.
- **Test 2:** `! git status | grep -q 'Unmerged\|both modified'` — no unmerged paths remain.
- **Test 3:** `grep -q 'isinstance' calculator.py` — the type-checking code from `update-add-function` must be present.
- **Test 4:** `grep -q 'print' calculator.py` — the logging code from `main` must be present.
- **Conflict markers explained:** `<<<<<<< HEAD` is your current branch's version; `=======` is the separator; `>>>>>>> branch-name` is the incoming version. You must edit the file to the version you want and remove all three marker types.
- **`git add` after resolution:** Signals to Git that the conflict is resolved AND stages the content. Without it, `git commit` refuses with "unmerged paths". This is the same `git add` as always — it just takes on this extra role during a merge.

---

## Step 12: Safe Undo with git revert

```bash
# Introduce a deliberate "bad" commit
echo "print('debug: this should not be here')" >> calculator.py
git add calculator.py
git commit -m "Accidentally add debug print"

# View the history — bad commit is at the top
git log --oneline

# Revert it safely — creates a new "anti-commit" that undoes the bad one
git revert HEAD --no-edit

# Verify: the debug line is gone, but BOTH commits are still in history
git log --oneline
cat calculator.py
```

**Why this is correct:**

- **Test 1:** `git log --oneline | grep -qi 'revert'` — a revert commit must exist in the log (Git's default message is "Revert '...'").
- **Test 2:** `! grep -q 'debug: this should not be here' calculator.py` — the debug line must be gone from the file.
- **Test 3:** `[ $(git log --oneline | wc -l) -ge 8 ]` — the repository must have at least 8 commits by now.
- **`git revert HEAD --no-edit`:** Creates a new commit that applies the exact inverse of `HEAD`. `--no-edit` accepts the default message without opening a text editor.
- **Why NOT `git reset --hard`:** `reset --hard` destroys commits by moving the branch pointer backward — rewriting history. On a shared branch where teammates have already pulled, this would cause severe conflicts and require a force-push. `git revert` is always safe because it only adds new commits and never changes existing history.

---

## Step 13: Review and Best Practices

```bash
# View the complete history as a graph
git log --oneline --graph --all

# Final check — view the current state of calculator.py
cat calculator.py
```

**Why this is correct:**

- **Test 1:** `[ $(git log --oneline | wc -l) -ge 10 ]` — at least 10 commits in total.
- **Test 2:** `grep -q 'def add' calculator.py && grep -q 'def subtract' calculator.py && grep -q 'def multiply' calculator.py && grep -q 'def divide' calculator.py` — all four functions must be present in the final `calculator.py`.
- **Test 3:** `.gitignore` must be in the commit history.

**The final `calculator.py`:**

```python
"""A simple calculator module."""


def add(a, b):
    """Return the sum of a and b (with type checking and logging)."""
    if not isinstance(a, (int, float)) or not isinstance(b, (int, float)):
        raise TypeError("Arguments must be numbers")
    print(f"Adding {a} + {b}")
    return a + b


def subtract(a, b):
    """Return the difference of a and b."""
    return a - b


def multiply(a, b):
    """Return the product of a and b."""
    return a * b


def divide(a, b):
    """Return the quotient of a and b."""
    if b == 0:
        raise ValueError("Cannot divide by zero")
    return a / b
```

**Git workflow summary:** The complete workflow practiced in this tutorial:

```
git init          → create repository
git add           → stage changes (loading dock)
git commit        → save snapshot (truck drives away)
git status        → check current state
git log           → view history
git diff          → see what changed
git switch -c     → create and switch to branch
git merge         → combine branches
git restore       → discard uncommitted changes
git revert        → safely undo a committed change
```
