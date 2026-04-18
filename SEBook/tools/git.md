---
title: Version Control with Git 
layout: sebook
---

<script src="/js/git-graph.js"></script>
<script src="/js/git-command-lab.js"></script>
<link rel="stylesheet" href="/css/git-graph.css">
<link rel="stylesheet" href="/css/git-command-lab.css">
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

A **commit** is a permanent snapshot: an immutable object identified by a 40-character SHA-1 hash, pointing to its parent commit(s). The chain of parents is what we call *history*, and the visual form of that chain is the **commit graph** you'll animate below.

# Building History

Everything in this section produces **new commits** — either a single commit on top of the current branch, or a merge commit that weaves two branches together. Hashes only grow; nothing is rewritten.

## Making Commits

The canonical local workflow:

1. **Initialize** a repo with `git init`.
2. **Stage** file contents with `git add <filename>`.
3. **Commit** the snapshot with `git commit -m "message"`.
4. Check state anytime with `git status`, review history with `git log`.

Before we see a commit happen, one concept to introduce: **`HEAD`**. In every graph on this page you'll see a white chip labelled `HEAD` pointing at a commit — it marks where *you are* in history, i.e. the commit your next operation will act on. Normally `HEAD` points at a branch (like `main`), and the branch in turn points at a commit; `HEAD` follows the branch forward as new commits are added.

<div data-git-command-lab>
<script type="application/json">
{
  "command": "git commit -m \"Add login\"",
  "description": "Saves the staged changes as a new, immutable snapshot on the current branch.\n\nWatch the graph: a fresh commit node **C** appears on top of **B** with B as its parent, and both `HEAD` and `main` glide forward to it.\n\nEach `git commit` only ever *adds* a node \u2014 history never changes underneath.",
  "before": {
    "log": "B000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|HEAD -> main\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "* main",
    "head": "refs/heads/main"
  },
  "after": {
    "log": "C000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Add login|HEAD -> main\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "* main",
    "head": "refs/heads/main"
  }
}
</script>
</div>

### Inspecting Changes

`git diff` compares different versions of your code:

* `git diff` — working directory vs. staging area.
* `git diff --staged` (or `--cached`) — staging area vs. the latest commit. Useful to review exactly what you are about to commit.
* `git diff HEAD` — working directory vs. the latest commit.
* `git diff HEAD^ HEAD` — parent vs. latest commit (shows what the latest commit changed).
* `git diff main..feature` — commits in `feature` not yet in `main`.

`git log` shows the sequence of past commits. Useful flags: `-p` shows each commit's patch; `--oneline` is one commit per line; `--graph --all` renders an ASCII art graph of all branches and merges.

## Branching

A **branch** in Git is just a **lightweight pointer** to a commit — literally a 41-byte text file in `.git/refs/heads/` containing a commit's SHA. Creating or deleting a branch is nearly instantaneous. The `HEAD` pointer (stored in `.git/HEAD`) usually contains a symbolic reference to the current branch, such as `ref: refs/heads/main`.

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

### Merge Conflicts

When Git cannot automatically reconcile differences (usually because the same lines were changed in both branches), it marks the conflicting sections in the file:

```
<<<<<<< HEAD
your version of the code
=======
incoming branch version
>>>>>>> feature-branch
```

Resolve by editing the file to keep the correct content (removing all markers), then `git add` the resolved file and `git commit` to complete the merge. Use `git merge --abort` to cancel a merge in progress and return to the pre-merge state.

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
    "log": "E000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Hotfix|HEAD -> main\nD000000000000000000000000000000000000000|C000000000000000000000000000000000000000|Feature B|feature\nC000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Feature A|\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "* main\n  feature",
    "head": "refs/heads/main"
  },
  "after": {
    "log": "C+D0000000000000000000000000000000000000|E000000000000000000000000000000000000000|Squashed C+D|HEAD -> main\nE000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Hotfix|\nD000000000000000000000000000000000000000|C000000000000000000000000000000000000000|Feature B|feature\nC000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Feature A|\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|\nA000000000000000000000000000000000000000||Repository init|",
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
  "description": "**Rewinds** the `main` branch pointer by one commit, dropping everything that was on top.\n\nThe tip commit (C) is no longer reachable from any branch and will be garbage-collected eventually.\n\n`--hard` also **overwrites your working directory and staging area** to match the target commit, so any uncommitted changes are lost.\n\n*Only safe for local, unpushed work.*",
  "before": {
    "log": "C000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Buggy commit|HEAD -> main\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Add feature|\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "* main",
    "head": "refs/heads/main"
  },
  "after": {
    "log": "B000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Add feature|HEAD -> main\nA000000000000000000000000000000000000000||Repository init|",
    "branches": "* main",
    "head": "refs/heads/main"
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

A **remote** is a named URL pointing to another copy of the repository — typically on GitHub, GitLab, or a self-hosted server. Remote servers use **bare repositories** (`git init --bare`) which contain only Git metadata, no working directory.

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

### The Force-Push Warning

`git push -f` (force-push) overwrites remote history to match your local copy. On a shared branch this **permanently deletes** commits your collaborators have already pushed. Never force-push to `main` or any shared integration branch. If you've rebased or amended commits that are already remote, push to a new branch instead — or use `--force-with-lease` which at least refuses to overwrite if the remote has moved since your last fetch.

## Rescue and Debugging Tools

* **`git stash` / `git stash pop`** — temporarily save uncommitted changes (staged and unstaged) so you can switch contexts without making a messy commit. `pop` re-applies the stashed changes later.
* **`git bisect`** — binary search through commit history to find the exact commit that introduced a bug. You mark known-good and known-bad commits, then Git checks out the midpoint repeatedly.
* **`git blame <file>`** — annotates each line with the author and commit hash of the last person to modify it.
* **`git reflog`** — chronological log of every position `HEAD` has been at. Your safety net for recovering "lost" commits after an accidental reset or a detached-HEAD detour: `git reflog` shows the hash, and `git switch -c <name> <hash>` brings it back.
* **`git show <commit>`** — displays detailed information about a specific commit or other Git object.

## Submodules

For very large projects, **Git submodules** let you include another Git repository as a subdirectory while keeping its history independent. Internally a submodule is just a file pointing to a specific commit hash in the external repo — pulling always brings in that exact revision, which makes submodule updates explicit rather than automatic.

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
* **Use `git switch` instead of `git checkout`.** The legacy `checkout` command does too many things (branch navigation *and* file restoration). Prefer the split replacements `git switch` (navigate branches) and `git restore` (undo file changes).

# Quiz

## Basic Git
{% include flashcards.html id="git_basic" %}

{% include quiz.html id="git_basic" %}

## Advanced Git
{% include flashcards.html id="git_advanced" %}

{% include quiz.html id="git_advanced" %}

