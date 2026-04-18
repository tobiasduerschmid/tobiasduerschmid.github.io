---
title: Version Control with Git 
layout: sebook
---

<script src="/js/git-graph.js"></script>
<script src="/js/git-command-lab.js"></script>
<script src="/js/ArchUML/uml-bundle.js"></script>
<script src="/js/fs-command-lab.js"></script>
<link rel="stylesheet" href="/css/git-graph.css">
<link rel="stylesheet" href="/css/git-command-lab.css">
<link rel="stylesheet" href="/css/fs-command-lab.css">
<style>
.git-graph-svg { display: block; }
.git-graph-svg .git-graph-node { filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); }
.git-graph-canvas svg { max-width: 100%; height: auto; display: block; }
</style>
<script>
document.addEventListener('DOMContentLoaded', function () {
  (function tryInit() {
    if (!window.GitGraph) { setTimeout(tryInit, 30); return; }
    document.querySelectorAll('.git-graph-canvas').forEach(function (el) {
      if (el.querySelector('svg')) return;
      var s = el.querySelector('script[type="application/json"]');
      if (!s) return;
      var d = JSON.parse(s.textContent);
      el.innerHTML = GitGraph.renderToSVG(GitGraph.parseGitState(d.log, d.branches, d.head));
      var svg = el.querySelector('svg');
      if (svg) {
        svg.setAttribute('width',  Math.round(parseFloat(svg.getAttribute('width'))  * 1.15));
        svg.setAttribute('height', Math.round(parseFloat(svg.getAttribute('height')) * 1.15));
      }
    });
  })();
});
</script>

> **Want to practice?** Try the [Interactive Git Tutorial](/SEBook/tools/git-tutorial.html) — hands-on exercises in a real Linux system right in the browser!

In modern software construction, version control is not just a convenience — it is a foundational practice that solves several major challenges of managing code: collaboration, change tracking, traceability, safe rollback, and parallel development. Git is by far the most common tool for version control.

Throughout this page you will find **interactive command cards** — click the button to animate the graph transformation a command performs, and click again to undo. This is the fastest way to build an intuition for what each Git command actually does to your commit graph.

# Basics

## What is Version Control?

**Version control** (also known as source control or revision control) is the software engineering practice of controlling, organizing, and tracking different versions in the history of computer files. A tool that supports version control is called a **Version Control System (VCS)**.

The most common version control systems are:
* **[Git](https://git-scm.com/)** (most common for open source, also used by Microsoft, Apple, and most other companies)
* **[Mercurial](https://www.mercurial-scm.org/)** (used by Meta, Jane Street, and others {% cite goode2014scaling %})
* **Piper** (Google's internal tool {% cite Potvin2016 %})
* **Subversion** (some older projects)

Manual version control — saving files with names like `Homework_final_v2_really_final.txt` — is cumbersome and error-prone. Automated systems like Git solve several critical problems:

* **Collaboration** — multiple developers can work concurrently without overwriting each other's changes.
* **Change Tracking** — see exactly what has changed since you last worked on a file.
* **Traceability** — every modification records who made it, when, and why.
* **Reversion** — if a bug is introduced, revert to a known good state.
* **Parallel Development** — branches let you work on features or fixes in isolation.

## Centralized vs. Distributed

| Feature | Centralized (e.g., Subversion, Piper) | Distributed (e.g., Git, Mercurial) |
| :--- | :--- | :--- |
| **Data Storage** | Single central repository | Every developer has a full copy of history |
| **Offline Work** | Needs server connection to commit | Work and commit fully offline |
| **Best For** | Small teams with strict central control | Large teams, open-source, distributed workflows |

## The Three States

Git operates across three areas that every file passes through:

1. **Working Directory** — files as they exist on your disk right now.
2. **Staging Area (Index)** — a middle ground where you stage the exact changes you want in your next snapshot.
3. **Local Repository** — the `.git/` directory, where Git stores compressed snapshots (commits) of project history.

A **commit** is a permanent snapshot: an immutable object identified by a 40-character SHA-1 hash, with pointers to its parent commit(s) and to a **tree** object that records the project's directory structure at that moment. The chain of parents is what we call *history*, and the visual form of that chain is the **commit graph** you'll animate below.

# Building History

Everything in this section produces **new commits** — either a single commit on top of the current branch, or a merge commit that weaves two branches together. Hashes only grow; nothing is rewritten.

## Making Commits

The canonical local workflow:

1. **Initialize** a repo with `git init`.
2. **Stage** file contents with `git add <filename>`.
3. **Commit** the snapshot with `git commit -m "message"`.
4. Check state anytime with `git status`, review history with `git log`.

Before we see a commit happen, one concept to introduce: **`HEAD`**. In every graph on this page you'll see a white chip labelled `HEAD` pointing at a commit — it marks where *you are* in history, i.e. the commit your next operation will act on. Normally `HEAD` points at a branch (like `main`), and the branch in turn points at a commit; `HEAD` follows the branch forward as new commits are added.

Git tracks files through **three "trees"**: the **working directory** (your files on disk), the **index/staging area** (a snapshot of what your next commit will contain), and the **repository** (the committed history). The strip above each graph below mirrors what `git status` prints — **Untracked**, **Not staged**, and **Staged**. `git add` moves files into Staged; `git commit` turns Staged into the next node in the graph.

<div data-git-command-lab-multi>
<script type="application/json">
{
  "description": "Typing a new file doesn't involve Git yet \u2014 it lives only in your **working directory**. `git add` copies the current contents into the **staging area** (the index), marking them for the next commit. `git commit` then turns whatever is staged into a new, immutable node in the graph.\n\nClick through to see each step: a fresh `login.js` appears untracked, moves to staged with `git add`, then folds into commit **C** when you commit.",
  "initialState": {
    "log": "B000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|HEAD -> main\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "* main",
    "head": "refs/heads/main",
    "files": {
      "untracked": ["login.js"],
      "unstaged": [{"status": "modified", "path": "README.md"}],
      "staged": [],
      "stashed": []
    }
  },
  "steps": [
    {
      "command": "git add login.js",
      "description": "Stages `login.js`. The row slides from **Untracked** to **Staged** and flashes gold to mirror the graph's commit-burst. `README.md` remains unstaged \u2014 `git add` only moves the files you name.",
      "state": {
        "log": "B000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|HEAD -> main\nA000000000000000000000000000000000000000||Repository init|",
        "branches": "* main",
        "head": "refs/heads/main",
        "files": {
          "untracked": [],
          "unstaged": [{"status": "modified", "path": "README.md"}],
          "staged": [{"status": "new file", "path": "login.js"}],
          "stashed": []
        }
      }
    },
    {
      "command": "git commit -m \"Add login\"",
      "description": "Saves the staged changes as a new, immutable snapshot on the current branch. The staged row disappears as commit **C** pops in on top of **B** and both `HEAD` and `main` glide forward. The unstaged `README.md` is untouched \u2014 it wasn't staged, so it wasn't included.",
      "state": {
        "log": "C000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Add login|HEAD -> main\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|\nA000000000000000000000000000000000000000||Repository init|",
        "branches": "* main",
        "head": "refs/heads/main",
        "files": {
          "untracked": [],
          "unstaged": [{"status": "modified", "path": "README.md"}],
          "staged": [],
          "stashed": []
        }
      }
    }
  ]
}
</script>
</div>

### Shortcut: `git add -A` vs. `git commit -am`

Typing `git add <file>` for every modified file gets tedious. Two shortcuts stage multiple files at once, but they differ in one critical way: **whether they touch untracked files**.

<div data-git-command-lab>
<script type="application/json">
{
  "command": "git add -A",
  "undoCommand": "git restore --staged .",
  "description": "`git add -A` (or `--all`) stages **every** change in the working tree \u2014 modifications to tracked files, deletions, *and* brand-new untracked files. Watch `notes.txt` (untracked) and `src/utils.js` (modified) both slide into **Staged**.\n\nThis is the \"just stage everything\" command, and the reason some teams discourage it: it's easy to accidentally stage generated files, logs, or secrets you didn't mean to commit.\n\nThe real undo for this is `git restore --staged .` \u2014 it unstages every file, moving rows back from Staged to their previous zones.",
  "before": {
    "log": "B000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|HEAD -> main\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "* main",
    "head": "refs/heads/main",
    "files": {
      "untracked": ["notes.txt"],
      "unstaged": [{"status": "modified", "path": "src/utils.js"}],
      "staged": [],
      "stashed": []
    }
  },
  "after": {
    "log": "B000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|HEAD -> main\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "* main",
    "head": "refs/heads/main",
    "files": {
      "untracked": [],
      "unstaged": [],
      "staged": [
        {"status": "new file", "path": "notes.txt"},
        {"status": "modified", "path": "src/utils.js"}
      ],
      "stashed": []
    }
  }
}
</script>
</div>

<div data-git-command-lab>
<script type="application/json">
{
  "command": "git commit -am \"Update utils\"",
  "undoCommand": "git reset --soft HEAD~1",
  "description": "`git commit -a` (or `-am` to add a message in one go) auto-stages *only tracked* files that have been modified or deleted, then commits in a single step \u2014 **untracked files are ignored entirely**.\n\nWatch the difference vs. `git add -A` above: `src/utils.js` (tracked, modified) flies into the new commit **C**, but `notes.txt` (untracked) stays put in the **Untracked** zone. This is `-am`'s safety feature \u2014 you won't accidentally commit files Git has never seen before.\n\nThe real undo is `git reset --soft HEAD~1` \u2014 it removes commit **C** while keeping the changes staged (so you can edit and re-commit).",
  "before": {
    "log": "B000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|HEAD -> main\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "* main",
    "head": "refs/heads/main",
    "files": {
      "untracked": ["notes.txt"],
      "unstaged": [{"status": "modified", "path": "src/utils.js"}],
      "staged": [],
      "stashed": []
    }
  },
  "after": {
    "log": "C000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Update utils|HEAD -> main\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "* main",
    "head": "refs/heads/main",
    "files": {
      "untracked": ["notes.txt"],
      "unstaged": [],
      "staged": [],
      "stashed": []
    }
  }
}
</script>
</div>

**Rule of thumb:** `git add -A` stages **everything new** (dangerous); `git commit -am` is a safe shortcut for **tracked-only** commits. When in doubt, run `git status` first to see what each will affect.

### Inspecting Changes

`git diff` compares different versions of your code:

* `git diff` — working directory vs. staging area.
* `git diff --staged` (or `--cached`) — staging area vs. the latest commit. Useful to review exactly what you are about to commit.
* `git diff HEAD` — working directory vs. the latest commit.
* `git diff HEAD^ HEAD` — parent vs. latest commit (shows what the latest commit changed).
* `git diff main..feature` — commits in `feature` not yet in `main`.

`git log` shows the sequence of past commits. Useful flags: `-p` shows each commit's patch; `--oneline` is one commit per line; `--graph --all` renders an ASCII art graph of all branches and merges.

## Branching

A **branch** in Git is just a **lightweight pointer** to a commit — literally a text file in `.git/refs/heads/` containing a commit's SHA. Creating or deleting a branch is nearly instantaneous. The `HEAD` pointer (stored in `.git/HEAD`) usually contains a symbolic reference to the current branch, such as `ref: refs/heads/main`.

<div data-git-command-lab>
<script type="application/json">
{
  "command": "git switch -c feature",
  "description": "Creates a new branch pointer at the current commit *and* moves `HEAD` onto it in a single step \u2014 shorthand for `git branch feature` followed by `git switch feature`.\n\nBoth pointers start at the same commit, so **no files change**; future commits you make will land on `feature` rather than `main`.",
  "before": {
    "log": "B000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|HEAD -> main\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "* main",
    "head": "refs/heads/main"
  },
  "after": {
    "log": "B000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|HEAD -> feature, main\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "  main\n* feature",
    "head": "refs/heads/feature"
  }
}
</script>
</div>

<div data-git-command-lab>
<script type="application/json">
{
  "command": "git switch feature",
  "description": "Repoints `HEAD` from one branch to another \u2014 **pure pointer movement**.\n\nNo commit objects are created or modified; Git just updates your working directory to match the target branch's tip.\n\nUse this to navigate between parallel lines of development.",
  "before": {
    "log": "B000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|HEAD -> main, feature\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "* main\n  feature",
    "head": "refs/heads/main"
  },
  "after": {
    "log": "B000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|HEAD -> feature, main\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "  main\n* feature",
    "head": "refs/heads/feature"
  }
}
</script>
</div>

Where a commit lands depends entirely on where `HEAD` is pointing when you run `git commit`. A very common mistake is running `git branch <name>` and then immediately starting work — `git branch` creates the pointer but leaves `HEAD` on the current branch, so all new commits continue landing there. The two labs below show this side-by-side.

<div data-git-command-lab-multi>
<script type="application/json">
{
  "description": "**Common mistake: `git branch` without switching.** `git branch feature` creates the pointer but does **not** move `HEAD` — commits keep landing on `main`.\n\nWatch `HEAD` carefully: it never leaves `main`.",
  "initialState": {
    "log": "B000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|HEAD -> main\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "* main",
    "head": "refs/heads/main"
  },
  "steps": [
    {
      "command": "git branch feature",
      "description": "`git branch feature` creates a new branch pointer at the current commit. **`HEAD` does not move** — it still points to `main`.\n\nBoth pointers reference the same commit, but you are still on `main`.",
      "state": {
        "log": "B000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|HEAD -> main, feature\nA000000000000000000000000000000000000000||Repository init|",
        "branches": "* main\n  feature",
        "head": "refs/heads/main"
      }
    },
    {
      "command": "git commit -m \"Add feature work\"",
      "description": "Commit **C** lands on `main` — not on `feature` — because `HEAD` was still pointing at `main`.\n\n`feature` is left behind at B. This is the classic mistake: you did the work on the wrong branch.",
      "state": {
        "log": "C000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Add feature work|HEAD -> main\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|feature\nA000000000000000000000000000000000000000||Repository init|",
        "branches": "* main\n  feature",
        "head": "refs/heads/main"
      }
    }
  ]
}
</script>
</div>

<div data-git-command-lab-multi>
<script type="application/json">
{
  "description": "**Correct approach: switch first, then commit.** `git switch feature` moves `HEAD` onto the branch before you start working. Commits then land exactly where you intended.",
  "initialState": {
    "log": "B000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|HEAD -> main, feature\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "* main\n  feature",
    "head": "refs/heads/main"
  },
  "steps": [
    {
      "command": "git switch feature",
      "description": "`git switch feature` moves `HEAD` to point at `feature`. From this point on, commits will advance `feature`, not `main`.",
      "state": {
        "log": "B000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|HEAD -> feature, main\nA000000000000000000000000000000000000000||Repository init|",
        "branches": "  main\n* feature",
        "head": "refs/heads/feature"
      }
    },
    {
      "command": "git commit -m \"Add feature work\"",
      "description": "Commit **C** correctly lands on `feature`. `main` stays behind at B, untouched — exactly the isolation branches are designed for.",
      "state": {
        "log": "C000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Add feature work|HEAD -> feature\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|main\nA000000000000000000000000000000000000000||Repository init|",
        "branches": "  main\n* feature",
        "head": "refs/heads/feature"
      }
    }
  ]
}
</script>
</div>

### Detached HEAD

If you point `HEAD` directly at a commit hash instead of a branch (for example, to inspect an older version with `git switch --detach <commit>`), you are in **detached HEAD** state. Any commits made here are not anchored to a branch and are easy to lose when switching away — always create a branch with `git switch -c <name>` before leaving a detached HEAD if you have new work. `git reflog` can recover the hashes if you forget.

<div data-git-command-lab>
<script type="application/json">
{
  "command": "git switch --detach HEAD~1",
  "description": "Points `HEAD` **directly** at a specific commit (here, one step before the current tip) instead of at a branch. This is called **detached HEAD** state.\n\nUseful for inspecting old code \u2014 but commits made in this state aren't anchored to any branch and are easy to lose when switching away.\n\nRecover them with `git reflog`, or stay safe by running `git switch -c <name>` to bookmark your work before leaving.",
  "before": {
    "log": "B000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Add login|HEAD -> main\nA000000000000000000000000000000000000000||Initial commit|",
    "branches": "* main",
    "head": "refs/heads/main"
  },
  "after": {
    "log": "B000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Add login|main\nA000000000000000000000000000000000000000||Initial commit|HEAD",
    "branches": "  main",
    "head": "detached"
  }
}
</script>
</div>

## Merging

Once work has happened in parallel on two branches, you eventually want to bring it back together. Git has three modes of `git merge`, each with a distinct graph shape.

### Fast-Forward Merge

<div data-git-command-lab>
<script type="application/json">
{
  "command": "git merge feature",
  "description": "**Fast-forward merge.** Because `main` hasn't advanced since `feature` branched, there's nothing to reconcile.\n\nGit simply slides `main`'s pointer forward to `feature`'s tip \u2014 **no merge commit is created**, history stays perfectly linear, and both pointers now reference the same commit.",
  "before": {
    "log": "D000000000000000000000000000000000000000|C000000000000000000000000000000000000000|Add tests|feature\nC000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Add login|\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|HEAD -> main\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "* main\n  feature",
    "head": "refs/heads/main"
  },
  "after": {
    "log": "D000000000000000000000000000000000000000|C000000000000000000000000000000000000000|Add tests|HEAD -> main, feature\nC000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Add login|\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "* main\n  feature",
    "head": "refs/heads/main"
  }
}
</script>
</div>

### Three-Way Merge

<div data-git-command-lab>
<script type="application/json">
{
  "command": "git merge feature",
  "description": "**Three-way merge.** Both branches have commits the other doesn't: `main` added E; `feature` added C and D.\n\nGit compares both tips against their **common ancestor** (B) and creates a new merge commit **M** with *two parents* \u2014 one per branch.\n\nThe resulting diamond shape in the graph is the hallmark of a three-way merge.",
  "before": {
    "log": "E000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Hotfix|HEAD -> main\nD000000000000000000000000000000000000000|C000000000000000000000000000000000000000|Feature B|feature\nC000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Feature A|\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "* main\n  feature",
    "head": "refs/heads/main"
  },
  "after": {
    "log": "M000000000000000000000000000000000000000|E000000000000000000000000000000000000000 D000000000000000000000000000000000000000|Merge branch 'feature'|HEAD -> main\nE000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Hotfix|\nD000000000000000000000000000000000000000|C000000000000000000000000000000000000000|Feature B|feature\nC000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Feature A|\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "* main\n  feature",
    "head": "refs/heads/main"
  }
}
</script>
</div>

### Forcing a Merge Commit: `--no-ff`

<div data-git-command-lab>
<script type="application/json">
{
  "command": "git merge --no-ff feature",
  "description": "**Forces a merge commit** even though a fast-forward would have worked. The result **M** has two parents: the previous `main` tip (B) and the `feature` tip (D).\n\nThe extra commit looks redundant but preserves a visible trace that a feature branch was integrated \u2014 handy when reviewing history to see *which commits belonged to which feature*.",
  "before": {
    "log": "D000000000000000000000000000000000000000|C000000000000000000000000000000000000000|Add tests|feature\nC000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Add login|\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|HEAD -> main\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "* main\n  feature",
    "head": "refs/heads/main"
  },
  "after": {
    "log": "M000000000000000000000000000000000000000|B000000000000000000000000000000000000000 D000000000000000000000000000000000000000|Merge branch 'feature'|HEAD -> main\nD000000000000000000000000000000000000000|C000000000000000000000000000000000000000|Add tests|feature\nC000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Add login|\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "* main\n  feature",
    "head": "refs/heads/main"
  }
}
</script>
</div>

### Merge Conflicts

When Git cannot automatically reconcile differences (usually because the same lines were changed in both branches), it marks the conflicting sections in the file with conflict markers:

```
<<<<<<< HEAD
your version of the code
=======
incoming branch version
>>>>>>> feature-branch
```

The full resolution sequence is: edit the conflicting file to remove all markers and keep the correct content, stage it with `git add`, then finalise with `git commit`. Use `git merge --abort` to cancel a merge in progress and return to the pre-merge state.

<div data-git-command-lab-multi>
<script type="application/json">
{
  "description": "**Resolving a merge conflict step by step.** When `git merge` cannot automatically reconcile changes it pauses and leaves conflict markers in the affected files. The graph does not change until you complete or abort the merge.",
  "initialState": {
    "log": "E000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Hotfix on main|HEAD -> main\nD000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Edit greeting on feature|feature\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "* main\n  feature",
    "head": "refs/heads/main",
    "files": {
      "untracked": [],
      "unstaged": [],
      "staged": [],
      "stashed": []
    }
  },
  "steps": [
    {
      "command": "git merge feature",
      "description": "Both branches edited the same lines in `greeting.txt`. Git cannot decide which version to keep, so it **pauses the merge** and injects conflict markers into the file.\n\n`greeting.txt` appears as `unstaged` (modified with conflicts) — Git will not let you commit until every conflict is resolved.",
      "output": "Auto-merging greeting.txt\nCONFLICT (content): Merge conflict in greeting.txt\nAutomatic merge failed; fix conflicts and then commit the result.",
      "state": {
        "log": "E000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Hotfix on main|HEAD -> main\nD000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Edit greeting on feature|feature\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|\nA000000000000000000000000000000000000000||Repository init|",
        "branches": "* main\n  feature",
        "head": "refs/heads/main",
        "files": {
          "untracked": [],
          "unstaged": [{"status": "modified", "path": "greeting.txt"}],
          "staged": [],
          "stashed": []
        }
      }
    },
    {
      "command": "manual edits to greeting.txt",
      "description": "Open `greeting.txt` and remove the conflict markers, keeping the content you want:\n\n```\n<<<<<<< HEAD\nHello, world! (hotfix)\n=======\nHi there! (feature)\n>>>>>>> feature\n```\n\nAfter editing, the file is clean but still shows as `unstaged` — not yet staged for the merge commit.",
      "state": {
        "log": "E000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Hotfix on main|HEAD -> main\nD000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Edit greeting on feature|feature\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|\nA000000000000000000000000000000000000000||Repository init|",
        "branches": "* main\n  feature",
        "head": "refs/heads/main",
        "files": {
          "untracked": [],
          "unstaged": [{"status": "modified", "path": "greeting.txt"}],
          "staged": [],
          "stashed": []
        }
      }
    },
    {
      "command": "git add greeting.txt",
      "description": "`git add` marks the conflict in `greeting.txt` as **resolved** and moves it to the staging area.\n\nIf there were multiple conflicting files you would repeat this for each one before moving on.",
      "state": {
        "log": "E000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Hotfix on main|HEAD -> main\nD000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Edit greeting on feature|feature\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|\nA000000000000000000000000000000000000000||Repository init|",
        "branches": "* main\n  feature",
        "head": "refs/heads/main",
        "files": {
          "untracked": [],
          "unstaged": [],
          "staged": [{"status": "modified", "path": "greeting.txt"}],
          "stashed": []
        }
      }
    },
    {
      "command": "git commit",
      "description": "With all conflicts staged, `git commit` finalises the merge by creating the merge commit **M** with two parents — one from each branch.\n\nThe graph now shows the classic diamond shape that marks a three-way merge.",
      "state": {
        "log": "M000000000000000000000000000000000000000|E000000000000000000000000000000000000000 D000000000000000000000000000000000000000|Merge branch 'feature'|HEAD -> main\nE000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Hotfix on main|\nD000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Edit greeting on feature|feature\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|\nA000000000000000000000000000000000000000||Repository init|",
        "branches": "* main\n  feature",
        "head": "refs/heads/main",
        "files": {
          "untracked": [],
          "unstaged": [],
          "staged": [],
          "stashed": []
        }
      }
    }
  ]
}
</script>
</div>

# Reshaping History

The commands above only *append* commits. This section covers commands that **create new commit objects with new hashes** or **move branch pointers backward** — operations that rewrite or rearrange history. They are powerful but must be used carefully: rewriting commits that others have already pulled breaks collaborators' copies of the repository.

## Rebasing

<div data-git-command-lab>
<script type="application/json">
{
  "command": "git rebase main",
  "description": "Takes the commits unique to `feature` (C and D) and **replays** them on top of `main`'s current tip (E).\n\nBecause each replayed commit has a different parent than before, it gets a new hash **C\u2032**, **D\u2032** \u2014 the old C and D are gone. `feature` now looks like it was branched from the latest `main`.\n\nClean linear history \u2014 but because hashes changed, *never rebase a branch you've already pushed*.",
  "before": {
    "log": "E000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Hotfix|main\nD000000000000000000000000000000000000000|C000000000000000000000000000000000000000|Feature B|HEAD -> feature\nC000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Feature A|\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "  main\n* feature",
    "head": "refs/heads/feature"
  },
  "after": {
    "log": "D'00000000000000000000000000000000000000|C'00000000000000000000000000000000000000|Feature B|HEAD -> feature\nC'00000000000000000000000000000000000000|E000000000000000000000000000000000000000|Feature A|\nE000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Hotfix|main\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "  main\n* feature",
    "head": "refs/heads/feature"
  }
}
</script>
</div>

> **Golden rule:** never rebase a branch that has been pushed to a shared remote. The new commits *look* the same to you but have different hashes, so your collaborators' clones still reference the old hashes — a recipe for conflicts and lost work.

### Divergence and Time-Travel

The single-step card above shows rebase as a finished magic trick — two commits appear on top of `main` with new hashes. The multi-step walkthrough below pulls the trick apart: you build up the divergence yourself, pause to see the fork, and only *then* ask Git to replay history. Watch the graph, not the commands — the whole point is to replace "commands I memorised" with "pointer moves I can picture".

<div data-git-command-lab-multi>
<script type="application/json">
{
  "description": "Start from an empty repo. We'll build up a two-branch divergence commit by commit, pause to observe the fork, and then use `git rebase` to flatten it — watching commit **C** vanish and a brand-new **C′** appear on top of **D**.\n\nThree ideas to hold in your head as you click through:\n\n1. **Commands are pointer moves.** Branches are lightweight labels; `checkout` and `commit` just slide those labels along a DAG.\n2. **Parallel universes are real.** Once `main` and `feature` both have commits the other lacks, history is *not* a single timeline anymore.\n3. **Commits are immutable.** Rebase never *moves* C — it copies its changes onto a new parent, producing a different commit object (**C′**) with a different hash.",
  "initialState": {
    "log": "",
    "branches": "* main",
    "head": "refs/heads/main"
  },
  "steps": [
    {
      "command": "git commit -m \"A\"  &&  git commit -m \"B\"",
      "description": "Two commits land on `main` in sequence, giving us a base timeline. `HEAD -> main` advances together — the branch label is just a pointer to the tip commit, and `HEAD` is a pointer to the branch.\n\nNothing surprising yet: a linear chain, exactly the mental model most newcomers arrive with.",
      "state": {
        "log": "B000000000000000000000000000000000000000|A000000000000000000000000000000000000000|B|HEAD -> main\nA000000000000000000000000000000000000000||A|",
        "branches": "* main",
        "head": "refs/heads/main"
      }
    },
    {
      "command": "git checkout -b feature  &&  git commit -m \"C\"",
      "description": "`git checkout -b feature` creates a new branch pointer at the current commit (B) and moves `HEAD` onto it — no new commit, just two labels now sitting on the same node.\n\nThen `git commit -m \"C\"` adds **C** on top of **B**, and because `HEAD -> feature`, only `feature` advances. `main` stays pinned at B.",
      "state": {
        "log": "C000000000000000000000000000000000000000|B000000000000000000000000000000000000000|C|HEAD -> feature\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|B|main\nA000000000000000000000000000000000000000||A|",
        "branches": "  main\n* feature",
        "head": "refs/heads/feature"
      }
    },
    {
      "command": "git checkout main  &&  git commit -m \"D\"",
      "description": "`git checkout main` slides `HEAD` back to the `main` pointer (still at B). Then `git commit -m \"D\"` adds **D** as a second child of B.\n\nThis is the key moment: **B now has two children** — one per branch. The graph forks. `main` and `feature` are no longer on the same line; they are parallel universes that share an ancestor but have each moved on independently.",
      "state": {
        "log": "D000000000000000000000000000000000000000|B000000000000000000000000000000000000000|D|HEAD -> main\nC000000000000000000000000000000000000000|B000000000000000000000000000000000000000|C|feature\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|B|\nA000000000000000000000000000000000000000||A|",
        "branches": "* main\n  feature",
        "head": "refs/heads/main"
      }
    },
    {
      "command": "git log --graph --all --oneline",
      "description": "**Pedagogical pause.** This command doesn't change anything — it just asks Git to print the same DAG you see in the graph panel above. `--all` means \"every branch\", and `--graph` draws the fork as ASCII art.\n\nSpend a moment here. The two arrows pointing at **B** are the whole story of divergence: one commit, two children, two branch pointers living in their own worlds. Any merge or rebase from here on is just a strategy for reconciling these two universes.",
      "state": {
        "log": "D000000000000000000000000000000000000000|B000000000000000000000000000000000000000|D|HEAD -> main\nC000000000000000000000000000000000000000|B000000000000000000000000000000000000000|C|feature\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|B|\nA000000000000000000000000000000000000000||A|",
        "branches": "* main\n  feature",
        "head": "refs/heads/main"
      }
    },
    {
      "command": "git checkout feature",
      "description": "Pure pointer move: `HEAD` detaches from `main` and re-attaches to `feature`. No commit is created, no file content changes in the graph — just the yellow `HEAD` label slides from **D** over to **C**.\n\nWe do this *before* the rebase because `git rebase main` replays **the current branch** on top of `main`. Getting `HEAD` onto `feature` first tells Git which universe we want to rewrite.",
      "state": {
        "log": "D000000000000000000000000000000000000000|B000000000000000000000000000000000000000|D|main\nC000000000000000000000000000000000000000|B000000000000000000000000000000000000000|C|HEAD -> feature\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|B|\nA000000000000000000000000000000000000000||A|",
        "branches": "  main\n* feature",
        "head": "refs/heads/feature"
      }
    },
    {
      "command": "git rebase main",
      "description": "The time-travel rewrite. Git takes every commit on `feature` that is *not* on `main` (here: just **C**) and **replays** its changes on top of `main`'s tip (**D**).\n\nWatch the graph carefully: **C doesn't move.** It can't — commits are immutable. Instead, Git creates a brand-new commit **C′** with a different parent (D instead of B) and therefore a different hash. The `feature` pointer snaps over to C′; the old **C** becomes unreferenced and disappears.\n\nThe fork is gone, history reads as one straight line, and you've seen the deepest lesson Git has to offer: *you cannot change a commit. You can only build new ones and move pointers to them.*",
      "state": {
        "log": "C'00000000000000000000000000000000000000|D000000000000000000000000000000000000000|C|HEAD -> feature\nD000000000000000000000000000000000000000|B000000000000000000000000000000000000000|D|main\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|B|\nA000000000000000000000000000000000000000||A|",
        "branches": "  main\n* feature",
        "head": "refs/heads/feature"
      }
    }
  ]
}
</script>
</div>

## Amending the Tip Commit

<div data-git-command-lab>
<script type="application/json">
{
  "command": "git commit --amend",
  "description": "**Rewrites** the most recent commit in place \u2014 typically to fix a typo in the message or include a file you forgot to stage.\n\nBecause a commit's hash is derived from its content, the amended commit gets a brand-new hash **C\u2032**; the original **C** is discarded.\n\n*Safe for local work, but never amend a commit you've already pushed* \u2014 collaborators' clones still reference the old hash.",
  "before": {
    "log": "C000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Fix bug (typo)|HEAD -> main\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Add feature|\nA000000000000000000000000000000000000000||Initial commit|",
    "branches": "* main",
    "head": "refs/heads/main"
  },
  "after": {
    "log": "C'00000000000000000000000000000000000000|B000000000000000000000000000000000000000|Fix critical bug|HEAD -> main\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Add feature|\nA000000000000000000000000000000000000000||Initial commit|",
    "branches": "* main",
    "head": "refs/heads/main"
  }
}
</script>
</div>

Amend is safe on local work but subject to the same golden rule: never amend a commit you've already pushed to a shared branch.

## Squash Merge

<div data-git-command-lab>
<script type="application/json">
{
  "command": "git merge --squash feature",
  "description": "Collapses every commit on `feature` into a single new commit on `main` (C+D).\n\nCrucially, this new commit has **only one parent** \u2014 the previous `main` tip (E) \u2014 *not* the `feature` branch's tip (D). That's because `--squash` produces a regular commit, not a merge commit: Git records the squashed work as if you had written those changes directly on `main` yourself, with no structural link back to `feature`.\n\nThe `feature` branch stays at D, unreferenced from `main`'s history; commands like `git log main` won't show it as an ancestor.\n\nUseful when you want `main` to read as a series of clean features, not every intermediate \"fix typo\" commit \u2014 but the trade-off is that you lose the ability to trace the original commits from `main`.",
  "before": {
    "log": "E000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Hotfix|HEAD -> main\nD000000000000000000000000000000000000000|C000000000000000000000000000000000000000|Feature D|feature\nC000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Feature C|\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "* main\n  feature",
    "head": "refs/heads/main"
  },
  "after": {
    "log": "C+D0000000000000000000000000000000000000|E000000000000000000000000000000000000000|Squashed C+D|HEAD -> main\nE000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Hotfix|\nD000000000000000000000000000000000000000|C000000000000000000000000000000000000000|Feature D|feature\nC000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Feature C|\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "* main\n  feature",
    "head": "refs/heads/main"
  }
}
</script>
</div>

## Interactive Rebase

`git rebase -i <base>` opens an editor with a **todo file** listing each commit between `<base>` and `HEAD`. You change the action in front of each line to rewrite history exactly how you like:

| Action | Effect |
| :-- | :-- |
| `pick` | Keep the commit as-is |
| `reword` | Keep, but edit the message |
| `edit` | Stop at this commit to amend it |
| `squash` | Fold into the previous commit (combine messages) |
| `fixup` | Like `squash`, but discard this commit's message |
| `drop` | Remove the commit entirely |

<div data-git-command-lab>
<script type="application/json">
{
  "command": "git rebase -i HEAD~3  (squash)",
  "description": "**Interactive rebase** lets you rewrite a range of commits commit-by-commit.\n\nHere we open the todo file, keep `B` as `pick`, and mark `C` and `D` as `squash` \u2014 meaning Git *melds* them into the previous commit.\n\nThe three commits collapse into one new commit **B+C+D** with a unified message. Perfect for tidying up a series of \"fix typo\" / \"oops\" commits before sharing.",
  "rebaseFile": "pick   B Add login feature\nsquash C Fix login bug\nsquash D Fix typo again\n\n# Rebase A..D onto A (3 commands)\n#\n# Commands:\n# p, pick   = use commit\n# r, reword = use commit, edit message\n# e, edit   = use commit, stop to amend\n# s, squash = meld into previous commit\n# f, fixup  = like squash, discard this commit's message\n# d, drop   = remove commit",
  "before": {
    "log": "D000000000000000000000000000000000000000|C000000000000000000000000000000000000000|Fix typo again|HEAD -> main\nC000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Fix login bug|\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Add login feature|\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "* main",
    "head": "refs/heads/main"
  },
  "after": {
    "log": "B+C+D00000000000000000000000000000000000|A000000000000000000000000000000000000000|Add login feature (with fixes)|HEAD -> main\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "* main",
    "head": "refs/heads/main"
  }
}
</script>
</div>

<div data-git-command-lab>
<script type="application/json">
{
  "command": "git rebase -i HEAD~3  (drop)",
  "description": "Same interactive-rebase mechanism, different action: marking `C` as `drop` **removes it from history entirely**.\n\nThe later commit `D` is replayed on top of `B` (skipping C), producing a new commit **D\u2032** with a new hash.\n\nUseful for removing an embarrassing commit or a stray debug change that shouldn't have been committed.",
  "rebaseFile": "pick B Add login\ndrop C Oops debug print\npick D Add tests\n\n# Rebase A..D onto A (3 commands)\n#\n# Commands:\n# p, pick   = use commit\n# r, reword = use commit, edit message\n# e, edit   = use commit, stop to amend\n# s, squash = meld into previous commit\n# f, fixup  = like squash, discard this commit's message\n# d, drop   = remove commit",
  "before": {
    "log": "D000000000000000000000000000000000000000|C000000000000000000000000000000000000000|Add tests|HEAD -> main\nC000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Oops debug print|\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Add login|\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "* main",
    "head": "refs/heads/main"
  },
  "after": {
    "log": "D'00000000000000000000000000000000000000|B000000000000000000000000000000000000000|Add tests|HEAD -> main\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Add login|\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "* main",
    "head": "refs/heads/main"
  }
}
</script>
</div>

## Undoing: Reset vs. Revert

Two commands remove the effect of a commit, with fundamentally different graph consequences.

### `git reset --hard` — rewind the branch (local only)

<div data-git-command-lab>
<script type="application/json">
{
  "command": "git reset --hard HEAD~1",
  "description": "**Rewinds** the `main` branch pointer by one commit, dropping everything that was on top.\n\nThe tip commit (C) is no longer reachable from any branch and will be garbage-collected eventually.\n\n`--hard` also **overwrites your working directory and staging area** to match the target commit, so any uncommitted changes are lost \u2014 watch the staged `notes.txt` vanish along with commit C.\n\n*Only safe for local, unpushed work.*",
  "before": {
    "log": "C000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Buggy commit|HEAD -> main\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Add feature|\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "* main",
    "head": "refs/heads/main",
    "files": {
      "untracked": [],
      "unstaged": [{"status": "modified", "path": "src/bug.js"}],
      "staged": [{"status": "new file", "path": "notes.txt"}],
      "stashed": []
    }
  },
  "after": {
    "log": "B000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Add feature|HEAD -> main\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "* main",
    "head": "refs/heads/main",
    "files": {
      "untracked": [],
      "unstaged": [],
      "staged": [],
      "stashed": []
    }
  }
}
</script>
</div>

### `git revert` — append an inverse commit (safe for shared branches)

<div data-git-command-lab>
<script type="application/json">
{
  "command": "git revert HEAD",
  "description": "Instead of rewriting history, `revert` **appends** a new commit **R** whose changes exactly undo those of the target commit.\n\nThe original commit (C) still exists and is still reachable \u2014 history now records both the bug being introduced *and* it being reverted.\n\nThis is the **only safe way** to undo a commit that has already been pushed to a shared branch.",
  "before": {
    "log": "C000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Buggy commit|HEAD -> main\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Add feature|\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "* main",
    "head": "refs/heads/main"
  },
  "after": {
    "log": "R000000000000000000000000000000000000000|C000000000000000000000000000000000000000|Revert \"Buggy commit\"|HEAD -> main\nC000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Buggy commit|\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Add feature|\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "* main",
    "head": "refs/heads/main"
  }
}
</script>
</div>

**Rule of thumb:** for local work you haven't pushed, `reset --hard` is fine. For anything pushed to a shared branch, always use `revert`.

## Cherry-picking

`git cherry-pick <hash>` copies a single commit from another branch onto the current branch as a new commit (new hash, same changes). Useful to grab a specific fix without merging an entire branch:

<div data-git-command-lab>
<script type="application/json">
{
  "command": "git cherry-pick H",
  "description": "Copies the changes from a single commit onto the current branch as a brand-new commit.\n\nHere we grab a specific fix (H) from a short `hotfix` branch *without merging the whole branch*.\n\nThe copy gets a new hash **H\u2032** because its parent is different, but it contains the same changes. Useful for backporting a bug fix to a release branch.",
  "before": {
    "log": "D000000000000000000000000000000000000000|C000000000000000000000000000000000000000|Feature D|HEAD -> main\nC000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Feature C|\nH000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Security patch|hotfix\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Feature B|\nA000000000000000000000000000000000000000||Initial commit|",
    "branches": "* main\n  hotfix",
    "head": "refs/heads/main"
  },
  "after": {
    "log": "H'00000000000000000000000000000000000000|D000000000000000000000000000000000000000|Security patch|HEAD -> main\nD000000000000000000000000000000000000000|C000000000000000000000000000000000000000|Feature D|\nC000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Feature C|\nH000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Security patch|hotfix\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Feature B|\nA000000000000000000000000000000000000000||Initial commit|",
    "branches": "* main\n  hotfix",
    "head": "refs/heads/main"
  }
}
</script>
</div>

# Remote Collaboration

Git really shines once you're sharing work with other people. This section covers the commands for working with remotes and the rescue tools for when something goes wrong.

## Remotes

A **remote** is a named URL pointing to another copy of the repository — typically on GitHub, GitLab, or a self-hosted server. Remote servers typically host **bare repositories** (`git init --bare`) — repositories with no working tree; they store the object database, refs, and config (the contents of a regular `.git/` directory) but no checked-out files.

* **`git clone <url>`** — creates a local copy of a remote repository.
* **`git remote`** — lists configured remotes. `git remote add origin <url>` registers a remote named `origin` (the conventional primary remote name).
* **`git fetch`** — downloads new commits and branches from a remote *without* modifying your working directory or current branch. Useful for reviewing before deciding how to integrate.
* **`git pull`** — shorthand for `git fetch` followed by `git merge`. Fetches and immediately merges into your current branch.
* **`git push`** — uploads your local commits to a remote. `git push -u origin <branch>` pushes and sets up **upstream tracking**, so future `git push` and `git pull` on this branch can omit the remote name.

The diagram below shows how each command moves data between the four areas Git works with:

<pre><code class="language-uml-sequence">
@startuml
participant WorkingTree
participant StagingArea
participant LocalRepo
participant RemoteRepo

RemoteRepo ->> LocalRepo: git clone / git fetch
LocalRepo ->> WorkingTree: git checkout
WorkingTree ->> StagingArea: git add
StagingArea ->> LocalRepo: git commit
WorkingTree ->> LocalRepo: git commit -a
LocalRepo ->> WorkingTree: git merge
RemoteRepo ->> WorkingTree: git pull
LocalRepo ->> RemoteRepo: git push
@enduml
</code></pre>

### Remote-Tracking Branches

A **remote-tracking branch** (e.g. `origin/main`) is a read-only local reference stored in `.git/refs/remotes/`. It records the last known position of a branch on the remote — not where the remote is *right now*, but where it was the last time you communicated with it. In the graphs below it appears with a **dashed label** and grey color to distinguish it from your local branch pointer.

You cannot commit to a remote-tracking branch directly. It moves only when you run `git fetch`, `git pull`, or `git push`. This design lets you inspect and compare what is on the remote (`git log origin/main`, `git diff main..origin/main`) before deciding how to integrate.

The key distinction between `fetch` and `pull` is worth animating. The remote-tracking branch `origin/main` (shown with a dashed label) records the last known state of the remote — `fetch` advances it without touching your local branch; `pull` goes one step further and merges it in:

<div data-git-command-lab>
<script type="application/json">
{
  "command": "git fetch",
  "description": "Downloads new commits from the remote into the remote-tracking branch (origin/main) without touching your local branch or working directory.\n\nAfter a fetch you can review what changed (git log origin/main, git diff main..origin/main) before deciding to merge.",
  "before": {
    "log": "B000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Latest commit|HEAD -> main, origin/main\nA000000000000000000000000000000000000000||Initial commit|",
    "branches": "* main",
    "head": "refs/heads/main"
  },
  "after": {
    "log": "D000000000000000000000000000000000000000|C000000000000000000000000000000000000000|Add feature|origin/main\nC000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Fix bug|\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Latest commit|HEAD -> main\nA000000000000000000000000000000000000000||Initial commit|",
    "branches": "* main",
    "head": "refs/heads/main"
  }
}
</script>
</div>

<div data-git-command-lab>
<script type="application/json">
{
  "command": "git pull",
  "description": "Shorthand for git fetch + git merge — downloads the remote commits and immediately fast-forwards the local branch to match origin/main.\n\nBoth pointers land on the same commit. If the local branch had diverged, a merge commit would be created instead.",
  "before": {
    "log": "B000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Latest commit|HEAD -> main, origin/main\nA000000000000000000000000000000000000000||Initial commit|",
    "branches": "* main",
    "head": "refs/heads/main"
  },
  "after": {
    "log": "D000000000000000000000000000000000000000|C000000000000000000000000000000000000000|Add feature|HEAD -> main, origin/main\nC000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Fix bug|\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Latest commit|\nA000000000000000000000000000000000000000||Initial commit|",
    "branches": "* main",
    "head": "refs/heads/main"
  }
}
</script>
</div>

### Diverged `pull`: Merge Commit vs. Rebase

The fast-forward case above is the lucky path — your local branch had no new commits of its own, so Git could simply slide `main` forward. The interesting case is when *both* you and the remote have moved on since your last sync. Suppose you committed **B** locally, and while you were working, a teammate pushed **C** to the remote. Now `main` and `origin/main` have diverged, both descending from the common ancestor **A**.

`git pull` handles this by creating a **merge commit** that ties the two tips together — preserving the full DAG but littering history with "Merge branch 'main' of origin" commits:

<div data-git-command-lab>
<script type="application/json">
{
  "command": "git pull",
  "description": "After `git fetch`, Git sees that `main` (at B) and `origin/main` (at C) have diverged from their common ancestor A. `git pull`'s default strategy is **merge**: it creates a new merge commit **M** with two parents — your local **B** and the remote's **C** — and advances `main` to M.\n\nHistory is preserved exactly (no hashes change), but the graph gains a diamond and a commit message like *\"Merge branch 'main' of origin/main\"*. On a busy team branch, these pile up and clutter the log.",
  "before": {
    "log": "C000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Teammate's change|origin/main\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Your local work|HEAD -> main\nA000000000000000000000000000000000000000||Shared base|",
    "branches": "* main",
    "head": "refs/heads/main"
  },
  "after": {
    "log": "M000000000000000000000000000000000000000|B000000000000000000000000000000000000000 C000000000000000000000000000000000000000|Merge branch 'main' of origin/main|HEAD -> main\nC000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Teammate's change|origin/main\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Your local work|\nA000000000000000000000000000000000000000||Shared base|",
    "branches": "* main",
    "head": "refs/heads/main"
  }
}
</script>
</div>

`git pull --rebase` is the antidote. Instead of merging, it **replays** your local commits on top of the fetched remote tip, producing a linear history with no merge commit. Your local **B** becomes **B′** with a new hash, parented on the remote's **C** instead of the shared ancestor **A**:

<div data-git-command-lab>
<script type="application/json">
{
  "command": "git pull --rebase",
  "description": "Same diverged situation, different integration strategy. `git pull --rebase` fetches `origin/main` (bringing in C), then **rebases** your local commits onto it — each of your commits is replayed as a brand-new commit with a new hash.\n\nHere your single local commit **B** is replayed on top of **C**, becoming **B′**. The old **B** is discarded. History reads as a straight line (`A → C → B′`), and no merge commit appears.\n\nRule of thumb: prefer `git pull --rebase` on your own feature branch to keep the log clean; stick with the default `git pull` (merge) on shared long-lived branches where rewriting any history — even your own — is risky.",
  "before": {
    "log": "C000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Teammate's change|origin/main\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Your local work|HEAD -> main\nA000000000000000000000000000000000000000||Shared base|",
    "branches": "* main",
    "head": "refs/heads/main"
  },
  "after": {
    "log": "B'00000000000000000000000000000000000000|C000000000000000000000000000000000000000|Your local work|HEAD -> main\nC000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Teammate's change|origin/main\nA000000000000000000000000000000000000000||Shared base|",
    "branches": "* main",
    "head": "refs/heads/main"
  }
}
</script>
</div>

You can make `--rebase` the default for a branch (`git config branch.main.rebase true`) or globally (`git config --global pull.rebase true`) so you don't have to type the flag every time.

### Pushing

`git push` is the mirror image of `git fetch`: it uploads your local commits to the remote and then advances the **remote-tracking branch** `origin/main` to match. The commits themselves do not change (no new hashes) — only the grey dashed label slides forward to catch up with your local `main`:

<div data-git-command-lab>
<script type="application/json">
{
  "command": "git push",
  "description": "You've made two local commits (**C** and **D**) on top of the last shared state (**B**). `git push` sends them to the remote and, once the remote accepts them, Git advances `origin/main` to match your local `main`.\n\nNotice what *doesn't* happen: no new commit is created, and no existing commit gets a new hash. The only visible change is that the dashed `origin/main` label hops from **B** up to **D** — a pointer move, nothing more. This is why `push` is a structural no-op on the graph: it only updates where the remote-tracking label sits.\n\n`git push` fails if the remote has commits you don't have locally (someone else pushed since your last fetch). Pull first to reconcile, then push.",
  "before": {
    "log": "D000000000000000000000000000000000000000|C000000000000000000000000000000000000000|Add tests|HEAD -> main\nC000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Add feature|\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Fix bug|origin/main\nA000000000000000000000000000000000000000||Initial commit|",
    "branches": "* main",
    "head": "refs/heads/main"
  },
  "after": {
    "log": "D000000000000000000000000000000000000000|C000000000000000000000000000000000000000|Add tests|HEAD -> main, origin/main\nC000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Add feature|\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Fix bug|\nA000000000000000000000000000000000000000||Initial commit|",
    "branches": "* main",
    "head": "refs/heads/main"
  }
}
</script>
</div>

### The Force-Push Warning

`git push -f` (force-push) overwrites remote history to match your local copy. On a shared branch this **permanently deletes** commits your collaborators have already pushed. Never force-push to `main` or any shared integration branch. If you've rebased or amended commits that are already remote, push to a new branch instead — or use `--force-with-lease` which at least refuses to overwrite if the remote has moved since your last fetch.

## Rescue and Debugging Tools

* **`git stash` / `git stash pop`** — temporarily save uncommitted changes (staged and unstaged) so you can switch contexts without making a messy commit. `pop` re-applies the stashed changes later.

Under the hood, `git stash` is implemented as **real commit objects**, not a separate storage area. When you run `git stash`, Git creates up to two commits off of `HEAD`:

1. An **index commit `i`** whose tree captures the state of the *staging area*. Its single parent is the current `HEAD`.
2. A **WIP commit `w`** whose tree captures the state of the *working directory*. It's a **merge commit** with **two parents** — the current `HEAD` *and* the index commit `i` — so that a future `stash pop` can restore both the staged and unstaged halves independently.

The ref `refs/stash` (shown in the graph as the **stash** pointer, and exposed by name as `stash@{0}`) then points at the `w` commit. Neither `main` nor `HEAD` moves — stashing never touches your branch. The shelf on the right still shows `stash@{0}` as a user-facing handle; the new commits in the graph are what `stash@{0}` actually *is*.

`git stash pop` is the inverse: it applies `w`'s working-tree changes back onto the index/working directory, then drops the `refs/stash` ref. Without a ref reaching them, the `i` and `w` commits become unreachable and get garbage-collected by Git's background GC.

<div data-git-command-lab-multi>
<script type="application/json">
{
  "description": "You're mid-change on `main`, but need to jump to another branch for a quick fix. Committing half-finished work is ugly; `git stash` saves the state aside so you can come back to it with `pop` later.\n\nStash is **not** a separate storage area \u2014 it's regular commit objects (`i` for the index, `w` for the working tree) on a dangling branch `refs/stash`. Watch the graph: the new commits pop into a sibling lane during `git stash` and vanish during `git stash pop`. The shelf on the right is just a friendlier view of the same data.",
  "initialState": {
    "log": "B000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|HEAD -> main\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "* main",
    "head": "refs/heads/main",
    "files": {
      "untracked": [],
      "unstaged": [{"status": "modified", "path": "checkout.js"}],
      "staged": [{"status": "modified", "path": "cart.js"}],
      "stashed": []
    }
  },
  "steps": [
    {
      "command": "git stash",
      "description": "Git creates two new commits off `B`:\n\n- **`i`** captures the *staged* tree (so `cart.js`'s staged version is preserved). Parent: `B`.\n- **`w`** captures the *working* tree (so `checkout.js`'s unstaged modification is preserved too). Parents: `B` and `i` \u2014 a merge commit, so both halves can be recovered independently.\n\nThe ref `refs/stash` (shown as the **stash** pointer) now points at `w`. `HEAD` and `main` stay at `B`; your branch history is untouched. The working tree and index are rewound to `B`'s state, leaving the strip clean.",
      "state": {
        "log": "w000000000000000000000000000000000000000|B000000000000000000000000000000000000000 i000000000000000000000000000000000000000|WIP on main: B Initial commit|refs/stash\ni000000000000000000000000000000000000000|B000000000000000000000000000000000000000|index on main: B Initial commit|\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|HEAD -> main\nA000000000000000000000000000000000000000||Repository init|",
        "branches": "* main",
        "head": "refs/heads/main",
        "files": {
          "untracked": [],
          "unstaged": [],
          "staged": [],
          "stashed": [{"ref": "stash@{0}", "branch": "main", "message": "cart + checkout WIP"}]
        }
      }
    },
    {
      "command": "git stash pop",
      "description": "Git replays `w`'s tree onto your working directory \u2014 `cart.js` and `checkout.js` both come back \u2014 then deletes the `refs/stash` ref. Without any ref reaching them, `i` and `w` become unreachable commit objects; Git's garbage collector removes them on its next pass, so the graph snaps back to just `B` and `A`.\n\n(Note: `pop` defaults to restoring every change as unstaged. Use `git stash pop --index` to preserve the original staged/unstaged split; this lab simplifies for pedagogy.)",
      "state": {
        "log": "B000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|HEAD -> main\nA000000000000000000000000000000000000000||Repository init|",
        "branches": "* main",
        "head": "refs/heads/main",
        "files": {
          "untracked": [],
          "unstaged": [{"status": "modified", "path": "checkout.js"}],
          "staged": [{"status": "modified", "path": "cart.js"}],
          "stashed": []
        }
      }
    }
  ]
}
</script>
</div>

* **`git bisect`** — binary search through commit history to find the exact commit that introduced a bug. You mark known-good and known-bad commits, then Git checks out the midpoint repeatedly. With 1,000 commits in the range, it finds the culprit in at most **10 tests**.
The workflow for `git bisect` is always the same six-step ritual — start a session, mark bad, mark good, then let Git drive. Click through the demo below to see each command and its effect on the graph.

<div data-git-command-lab-multi>
<script type="application/json">
{
  "description": "Our repository has 6 commits on `main`. A bug appeared recently — we know commit **B** (`Initial setup`) was clean. We'll use `git bisect` to binary-search the history and pinpoint the exact bad commit.\n\n`git bisect` eliminates *half* the remaining candidates on each step, so even a repo with 1,000 commits needs at most **10 tests**.",
  "initialState": {
    "log": "F000000000000000000000000000000000000000|E000000000000000000000000000000000000000|Add analytics|HEAD -> main\nE000000000000000000000000000000000000000|D000000000000000000000000000000000000000|Fix layout|\nD000000000000000000000000000000000000000|C000000000000000000000000000000000000000|Add auth|\nC000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Add login|\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial setup|\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "* main",
    "head": "refs/heads/main"
  },
  "steps": [
    {
      "command": "git bisect start",
      "description": "`git bisect start` initialises the bisect session. Git creates `.git/BISECT_LOG` to record progress. No visible change to the graph — this just puts Git into bisect mode.",
      "state": {
        "log": "F000000000000000000000000000000000000000|E000000000000000000000000000000000000000|Add analytics|HEAD -> main\nE000000000000000000000000000000000000000|D000000000000000000000000000000000000000|Fix layout|\nD000000000000000000000000000000000000000|C000000000000000000000000000000000000000|Add auth|\nC000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Add login|\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial setup|\nA000000000000000000000000000000000000000||Repository init|",
        "branches": "* main",
        "head": "refs/heads/main"
      }
    },
    {
      "command": "git bisect bad",
      "description": "`git bisect bad` marks the current commit (`HEAD`, F — `Add analytics`) as **bad**: the bug is present here. Git stores this as `refs/bisect/bad`.",
      "state": {
        "log": "F000000000000000000000000000000000000000|E000000000000000000000000000000000000000|Add analytics|HEAD -> main, bisect/bad\nE000000000000000000000000000000000000000|D000000000000000000000000000000000000000|Fix layout|\nD000000000000000000000000000000000000000|C000000000000000000000000000000000000000|Add auth|\nC000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Add login|\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial setup|\nA000000000000000000000000000000000000000||Repository init|",
        "branches": "* main",
        "head": "refs/heads/main"
      }
    },
    {
      "command": "git bisect good B",
      "description": "`git bisect good B` marks B (`Initial setup`) as the last known-good commit. The search range is now [C, D, E] — 3 commits. Git picks the **midpoint (D)** and checks it out automatically. HEAD is now detached at D.",
      "state": {
        "log": "F000000000000000000000000000000000000000|E000000000000000000000000000000000000000|Add analytics|main, bisect/bad\nE000000000000000000000000000000000000000|D000000000000000000000000000000000000000|Fix layout|\nD000000000000000000000000000000000000000|C000000000000000000000000000000000000000|Add auth|HEAD\nC000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Add login|\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial setup|bisect/good\nA000000000000000000000000000000000000000||Repository init|",
        "branches": "  main",
        "head": "detached"
      }
    },
    {
      "command": "git bisect bad",
      "description": "`git bisect bad` marks D (`Add auth`) as bad — you tested it and the bug is present. The search range narrows to [C] (the single commit between B-good and D-bad). Git checks out **C** for your next test.",
      "state": {
        "log": "F000000000000000000000000000000000000000|E000000000000000000000000000000000000000|Add analytics|main, bisect/bad\nE000000000000000000000000000000000000000|D000000000000000000000000000000000000000|Fix layout|\nD000000000000000000000000000000000000000|C000000000000000000000000000000000000000|Add auth|bisect/bad\nC000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Add login|HEAD\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial setup|bisect/good\nA000000000000000000000000000000000000000||Repository init|",
        "branches": "  main",
        "head": "detached"
      }
    },
    {
      "command": "git bisect good",
      "description": "`git bisect good` marks C (`Add login`) as good — you tested it and the bug is absent. Git now knows the answer: C is good and D is bad, and they are adjacent, so **`Add auth` (D) is the first bad commit**.\n\nGit prints the full commit details. Run `git show D` or `git diff C D` to see exactly what changed.",
      "state": {
        "log": "F000000000000000000000000000000000000000|E000000000000000000000000000000000000000|Add analytics|main, bisect/bad\nE000000000000000000000000000000000000000|D000000000000000000000000000000000000000|Fix layout|\nD000000000000000000000000000000000000000|C000000000000000000000000000000000000000|Add auth|bisect/bad\nC000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Add login|HEAD, bisect/good\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial setup|bisect/good\nA000000000000000000000000000000000000000||Repository init|",
        "branches": "  main",
        "head": "detached"
      }
    },
    {
      "command": "git bisect reset",
      "description": "`git bisect reset` ends the bisect session and returns `HEAD` back to `main`. All `bisect/*` refs are deleted and the working directory is clean again.\n\nThe culprit was **D** (`Add auth`) — now you know exactly where to look for the fix.",
      "state": {
        "log": "F000000000000000000000000000000000000000|E000000000000000000000000000000000000000|Add analytics|HEAD -> main\nE000000000000000000000000000000000000000|D000000000000000000000000000000000000000|Fix layout|\nD000000000000000000000000000000000000000|C000000000000000000000000000000000000000|Add auth|\nC000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Add login|\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial setup|\nA000000000000000000000000000000000000000||Repository init|",
        "branches": "* main",
        "head": "refs/heads/main"
      }
    }
  ]
}
</script>
</div>

* **`git blame <file>`** — annotates each line with the author and commit hash of the last person to modify it.
* **`git reflog`** — chronological log of every position `HEAD` has been at. Your safety net for recovering "lost" commits after an accidental reset or a detached-HEAD detour: `git reflog` shows the hash, and `git switch -c <name> <hash>` brings it back.
* **`git show <commit>`** — displays detailed information about a specific commit or other Git object.

## Submodules

For very large projects, **Git submodules** let you include another Git repository as a subdirectory while keeping its history independent. Internally a submodule is just a "gitlink" entry — a pinned commit SHA — in the superproject, alongside a `.gitmodules` config file with the URL. Each populated submodule directory contains a small `.git` text file (a "gitfile"), not a full `.git/` directory; the submodule's actual git data (objects, refs, HEAD) is stored in the parent repo's `.git/modules/<name>/` directory. Pulling always brings in the pinned revision, which makes submodule updates explicit rather than automatic.

The walk-through below covers the commands you'll meet most: adding submodules, cloning a parent repo that uses them, and updating submodules to new commits. Each step mutates the directory tree on the left; changed rows get a yellow burst so you can see exactly what the command touched.

<div data-fs-command-lab-multi>
<script type="application/json">
{
  "description": "A superproject `myproject/` starts with just its own source. We'll add two submodules, commit the result, then see what happens on a fresh clone.",
  "initialState": {
    "tree": "myproject/\n  .git/\n  src/\n    app.js"
  },
  "steps": [
    {
      "command": "git submodule add https://github.com/acme/libfoo libs/foo",
      "description": "`git submodule add` clones the remote into `libs/foo` *and* writes a new top-level `.gitmodules` file recording the mapping. The submodule is pinned to the remote's current HEAD (shown as the annotation hash).",
      "state": {
        "tree": "myproject/\n  .git/\n  .gitmodules\n  libs/\n    foo/ ← submodule @ abc123\n      README.md\n      src/\n        foo.js\n  src/\n    app.js"
      }
    },
    {
      "command": "git submodule add https://github.com/acme/libbar libs/bar",
      "description": "A second submodule. `.gitmodules` now records two mappings; both pinned folders are part of the superproject's working tree.",
      "state": {
        "tree": "myproject/\n  .git/\n  .gitmodules\n  libs/\n    bar/ ← submodule @ 9f2e10\n      README.md\n      src/\n        bar.js\n    foo/ ← submodule @ abc123\n      README.md\n      src/\n        foo.js\n  src/\n    app.js"
      }
    },
    {
      "command": "git commit -m \"Add libfoo and libbar as submodules\"",
      "description": "The superproject commit records **three** things: the new `.gitmodules` file, the `libs/foo` pin, and the `libs/bar` pin. No files change; the commit metadata below is what Git prints.",
      "state": {
        "tree": "myproject/\n  .git/\n  .gitmodules\n  libs/\n    bar/ ← submodule @ 9f2e10\n      README.md\n      src/\n        bar.js\n    foo/ ← submodule @ abc123\n      README.md\n      src/\n        foo.js\n  src/\n    app.js",
        "output": "[main a1b2c3d] Add libfoo and libbar as submodules\n 3 files changed, 6 insertions(+)\n create mode 100644 .gitmodules"
      }
    },
    {
      "command": "git clone https://example.com/myproject.git cloned",
      "description": "On a fresh machine, a **plain** clone brings down `.gitmodules` but leaves the submodule directories *empty*. The pins exist in Git's config, but the trees aren't populated yet.",
      "state": {
        "tree": "cloned/\n  .git/\n  .gitmodules\n  libs/\n    bar/ ← empty — not initialised\n    foo/ ← empty — not initialised\n  src/\n    app.js"
      }
    },
    {
      "command": "git submodule init",
      "description": "`init` reads `.gitmodules` and registers each submodule in `.git/config`. Still no files appear — it's a local bookkeeping step.",
      "state": {
        "tree": "cloned/\n  .git/\n  .gitmodules\n  libs/\n    bar/ ← empty — not initialised\n    foo/ ← empty — not initialised\n  src/\n    app.js",
        "output": "Submodule 'libs/bar' (https://github.com/acme/libbar) registered for path 'libs/bar'\nSubmodule 'libs/foo' (https://github.com/acme/libfoo) registered for path 'libs/foo'"
      }
    },
    {
      "command": "git submodule update",
      "description": "`update` fetches each registered submodule and checks out the pinned commit. Previously-empty folders now contain the submodule's files at the exact revision the superproject recorded.",
      "state": {
        "tree": "cloned/\n  .git/\n  .gitmodules\n  libs/\n    bar/ ← submodule @ 9f2e10\n      README.md\n      src/\n        bar.js\n    foo/ ← submodule @ abc123\n      README.md\n      src/\n        foo.js\n  src/\n    app.js"
      }
    },
    {
      "command": "git submodule update --remote libs/foo",
      "description": "`--remote` advances one submodule to the latest commit on its tracking branch. The annotation flips to a newer hash and the superproject is now dirty — you'd commit the updated pin next.",
      "state": {
        "tree": "cloned/\n  .git/\n  .gitmodules\n  libs/\n    bar/ ← submodule @ 9f2e10\n      README.md\n      src/\n        bar.js\n    foo/ ← submodule @ de4f71\n      CHANGELOG.md\n      README.md\n      src/\n        foo.js\n        helpers.js\n  src/\n    app.js"
      }
    },
    {
      "command": "git clone --recurse-submodules https://example.com/myproject.git sibling",
      "description": "The shortcut: clone + init + update in one go. A brand-new working copy comes down fully populated. Use this whenever you know a repo uses submodules.",
      "state": {
        "tree": "sibling/\n  .git/\n  .gitmodules\n  libs/\n    bar/ ← submodule @ 9f2e10\n      README.md\n      src/\n        bar.js\n    foo/ ← submodule @ abc123\n      README.md\n      src/\n        foo.js\n  src/\n    app.js"
      }
    }
  ]
}
</script>
</div>

# Best Practices

* **Write meaningful commit messages.** Explain *what* changed and *why*. Avoid vague messages like "bugfix" or "small changes".
* **Commit small and often.** Prefer many coherent commits over one giant "everything" update.
* **Never force-push on shared branches.** `git push -f` can permanently delete your collaborators' work.
* **Prefer `revert` over `reset` for shared history.** `reset --hard` destroys history; `revert` preserves it.
* **Use `.gitignore`.** Prevent tracking unnecessary or sensitive files. The file uses glob patterns:
  * `*.pyc` — ignore files by extension.
  * `__pycache__/` — ignore an entire directory (trailing slash).
  * `.env` — ignore a specific file (commonly used to protect secrets and API keys).
  * `node_modules/`, `venv/` — ignore dependency folders.
  * `.DS_Store`, `Thumbs.db` — ignore OS-generated clutter.
  
  Note: `.gitignore` has **no retroactive effect** — files already tracked must be explicitly removed with `git rm --cached <file>` before the ignore pattern applies. Commit the `.gitignore` itself so the whole team benefits.
* **Pull frequently.** Regularly pull the latest changes from the main branch to catch merge conflicts early.
* **Prefer `git switch` and `git restore` over `git checkout`.** The `checkout` command is overloaded — it does both branch navigation *and* file restoration. The split replacements `git switch` (navigate branches) and `git restore` (undo file changes), introduced in Git 2.23, make intent clearer. `git checkout` is still fully supported.

# Quiz

## Basic Git
{% include flashcards.html id="git_basic" %}

{% include quiz.html id="git_basic" %}

## Advanced Git
{% include flashcards.html id="git_advanced" %}

{% include quiz.html id="git_advanced" %}

