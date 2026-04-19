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

> **Want to practice?** Try the [Interactive Git Tutorial](/SEBook/tools/git-tutorial.html) and the [Advanced Git Tutorial](/SEBook/tools/git-advanced-tutorial.html) — hands-on exercises in a real Linux system right in the browser!

In modern software construction, version control is not just a convenience — it is a foundational practice that solves several major challenges of managing code: collaboration, change tracking, traceability, safe rollback, and parallel development. Git is by far the most common tool for version control.

> **By the end of this chapter, you'll be able to:**
>
> - Explain in your own words what a **commit**, **branch**, **HEAD**, and the **commit DAG** are — and why Git treats commits as immutable.
> - Go through the everyday local workflow fluently: stage, commit, inspect, branch, switch, and merge.
> - Collaborate through a remote: push, fetch, pull, resolve a merge conflict, and open a pull request.
> - Diagnose and recover from the common failure modes — merge conflicts, detached HEAD, "lost" commits, accidental commits on the wrong branch.
> - Decide between `merge`, `rebase`, `cherry-pick`, `revert`, and `reset` for a given situation.
> - Recognise at a glance which commands **rewrite history** and which are **additive** — and why that distinction matters on shared branches.
>
> **Assumed background:** comfort with a Unix shell (running commands, `cd`, `ls`, chaining with `&&`); the idea that a hash is a fixed-length fingerprint of content; familiarity with text editors. **No prior Git experience is required** — every command you meet here is introduced with a before/after graph before you're expected to use it.
>
> **How to read this chapter.** On a first pass, read it linearly — the sections build on each other. After that, use the [Choosing the Right Tool](#choosing-the-right-tool) table at the end as your lookup index. At the end of each major section you'll find short **retrieval prompts** with collapsible answers — pause and try to answer them before revealing. They feel slow on purpose; that's the effort that makes the material stick.

This page is organised by **workflow phase** — the same sequence you move through on a real project:

1. **Core Concepts** — the mental model everything else builds on.
2. **Setup** — create or clone a repository and configure it.
3. **Author** — write code, craft commits, manage your working tree.
4. **Share** — branch, merge, push, pull, collaborate via pull requests and tags.
5. **Maintain** — polish history, organise the team's branching strategy, manage submodules.
6. **Debug** — investigate when things go wrong, and recover safely.

A final section — **[Choosing the Right Tool](#choosing-the-right-tool)** — is the decision table to come back to when you know what you want to do but can't remember which command does it.

Throughout the page you will find **interactive command cards** — click the button to animate the graph transformation a command performs, and click again to undo. This is the fastest way to build an intuition for what each Git command actually does to your commit graph.

# Core Concepts

Before the commands, the mental model. Each section below opens with the question it answers — if you think you already know the answer, try to articulate it in your own words before reading on. That tiny act of retrieval is more valuable than a careful re-read.

## What is Version Control?

### Why do we need version control?

Imagine four teammates editing the same 500-line program. You finish a function and email your copy around. Alice has already changed three of the files you touched; Bob is working on a fourth that you haven't seen; Carol fixed a bug last week that somehow didn't make it into your copy. When it's time to combine the work, whose version wins? Which edits are new? If the merged result crashes, how do you tell which change broke it?

Manual version control — saving files with names like `homework_final_v2_really_final.txt` — collapses under this kind of pressure within hours. A **Version Control System (VCS)** is a tool that automates the job. It records every change with who/when/why metadata, lets many people work concurrently without clobbering each other, and makes it possible to undo a change that turned out to be wrong — days, weeks, or years later.

The five concrete problems a VCS solves:

* **Collaboration** — multiple developers can work concurrently without overwriting each other's changes.
* **Change tracking** — see exactly what has changed since you last worked on a file.
* **Traceability** — every modification records who made it, when, and why.
* **Reversion** — if a bug is introduced, return to a known-good state.
* **Parallel development** — branches let you work on features or fixes in isolation.

The most common version control systems:

* **[Git](https://git-scm.com/)** (most common for open source, also used by Microsoft, Apple, and most other companies)
* **[Mercurial](https://www.mercurial-scm.org/)** (used by Meta, Jane Street, and others {% cite goode2014scaling %})
* **Piper** (Google's internal tool {% cite Potvin2016 %})
* **Subversion** (some older projects)

## Centralized vs. Distributed

### Why is Git "distributed"?

Because requiring a network connection for every Git operation is a terrible user experience — and older centralised systems like Subversion suffered from exactly that. Want to see what changed last week? Talk to the server. Want to commit? Talk to the server. Server is down? You can't work.

A **distributed** VCS inverts this: every developer's machine holds a full copy of the entire history. Commit, branch, and inspect history offline on a train; sync with teammates when you have a network. The three concrete wins:

- **Speed.** Local operations touch a local disk, no round-trip. `git log` on a 20-year-old repo is instant.
- **Resilience.** Every clone is a complete backup. The central server can die and the project survives.
- **Flexibility.** You can experiment on branches locally without permissions or policies getting in the way.

The trade-off is that "the truth" has to be reconciled when people sync — which is what most of the "merge" machinery in this chapter is about.

| Feature | Centralized (e.g., Subversion, Piper) | Distributed (e.g., Git, Mercurial) |
| :--- | :--- | :--- |
| **Data Storage** | Single central repository | Every developer has a full copy of history |
| **Offline Work** | Needs server connection to commit | Work and commit fully offline |
| **Best For** | Small teams with strict central control | Large teams, open-source, distributed workflows |

## Commits

### What is a commit, and why do we need them?

A **commit** is a **named snapshot** of your entire project at one moment, with a short message explaining *why* you took that snapshot. It's the fundamental unit Git reasons about: every branch, merge, rebase, and undo operation is expressed in terms of commits.

### Why not just auto-save continuously?

Three reasons we commit in discrete, meaningful units instead of letting the OS or editor save every keystroke:

1. **Meaningful units.** "Yesterday at 3:47 PM" is a useless coordinate when hunting a bug. "The commit where we added rate limiting" is something you can find, read, revert, or cherry-pick. Commits let you slice history into intention-sized pieces.
2. **Explanatory metadata.** Each commit records who made it, when, and — crucially — *why*, through its message. The diff shows what changed; the message tells future-you or your teammate the reasoning. A trail of good messages is project memory.
3. **Shared vocabulary.** Because every commit has a unique identity (a SHA — we'll meet hashes later), you and a teammate on another continent can refer to the exact same state of the project with a single string. "The bug reproduces on `a3f2d9c` but not on `b7e1c4d`." Commits are the atoms that reviews, releases, and deployments are built out of.

<details markdown="1">
<summary><strong>🔧 Under the Hood: what a commit actually is (content addressing, snapshots vs. diffs)</strong> (optional — skip on first pass)</summary>

Every object Git stores — every commit, every tree (a directory listing), every blob (a file's contents) — is identified by a **SHA-1 hash of its own content**. Change a single byte of the content and the hash changes. This is called **content addressing**.

Two consequences follow immediately:

- **Commits are immutable.** You cannot edit a commit in place — changing its content would change its SHA, so it would be a *different* commit. Every "rewrite" operation (`--amend`, `rebase`, `cherry-pick`) is really *"build a new commit with the change baked in, then move pointers to it"*. The old commit isn't edited; it's abandoned.
- **Identity travels.** Two collaborators whose repositories contain the same content produce the same SHAs. There's no central authority deciding what counts as "the same commit" — the content decides. That's why Git can sync distributed clones without a lock server.

**Snapshots, not diffs.** A common misconception is that Git stores each commit as a *diff* against its parent. It doesn't. A commit stores a **full tree snapshot** — a recursive directory listing of every tracked file at that moment, with each file's content hashed into a **blob** object. This sounds wasteful until you realise Git **deduplicates** by hash: if `README.md` is identical across 100 commits, the blob is stored *once* and all 100 tree objects reference its SHA. A 10-year-old repository with 50,000 commits typically takes only a few gigabytes because 99% of the content is shared between snapshots. The payoff: checking out any historical commit is instant — Git reads a tree, pulls the referenced blobs, writes them to disk. There's no "apply 50,000 diffs in sequence" step.

</details>

## The Three States

### Why do we need a staging area?

You might reasonably expect a simpler design: you edit files, you commit, done. Two states — working directory and history. Why does Git insert a middle layer?

The answer is that **what you edited** and **what you want in the next commit** are not always the same thing. Common situations:

- You've edited five files in one session — two for a feature, three for an unrelated cleanup. You want **two commits**, not one messy one. The staging area lets you add the feature files, commit, then add the cleanup files and commit separately.
- You've edited a file that mixes a real change with a debug `print` you forgot to remove. You want to commit the real change without the print. Staging individual *hunks* of a file (`git add -p`) lets you take half of a file now and leave the other half for later.
- You want to review what you're about to commit before committing. `git diff --staged` shows you exactly that — the staging area *is* the preview.

So Git operates across three areas that every file passes through:

1. **Working directory** — files as they exist on your disk right now.
2. **Staging area (a.k.a. the index)** — a preview of the next commit. Think of it as a *commit editor*: you can add files here, remove them, tweak which version goes in, and only commit when it reads the way you want.
3. **Local repository** — the permanent history, where committed snapshots live forever.

`git add` moves changes from the working directory into the staging area. `git commit` turns everything in staging into a new, immutable snapshot in the repository. `git status` tells you what's currently in each area.

## HEAD, Branches, and the Commit Graph

### What are branches, and why do we need them?

A **branch** is a named line of history you can work on in parallel with other lines. In practice: one branch per feature, bug fix, or experiment.

Why bother? Because real projects always have multiple streams of work happening at once. Without branches, you'd have exactly two bad options:

- **Queue everything.** Alice's feature blocks Bob's bug fix blocks Carol's refactor. Nobody ships until everything is ready.
- **Mix everything on one timeline.** Half-finished features, debug prints, and WIP experiments all live together on `main`. Every commit is a gamble about what's actually production-ready.

Branches solve this by letting each stream of work live on its own timeline. When a feature is done, you combine it back ("merge") into `main`. An experiment that doesn't pan out can be discarded without polluting the shared history. And critically, **all the branches are the same project** — the same files, the same history up to the point they diverged — so switching between them is instant.

### How do branches, HEAD, and the commit graph fit together?

Conceptually: a branch is a pointer to a commit, plus the chain of parent commits you can reach by walking backwards. `HEAD` is a pointer to *"where you are right now"* — usually at a branch, so that new commits extend that branch. All the Git graphs on this page are visualisations of branches as pointers into a **Directed Acyclic Graph (DAG)** of commits — each commit records one or more *parent* commit SHAs (zero for the root, one for a normal commit, two for a merge commit), and following the parent links walks you backwards through history.

<details markdown="1">
<summary><strong>🔧 Under the Hood: what branches, HEAD, and the `.git/` directory look like on disk</strong> (optional — skip on first pass)</summary>

A branch is **literally** a 41-byte text file. Inside `.git/refs/heads/` there is one file per branch, each containing one 40-character SHA plus a newline. Creating a branch is one `fwrite()`; deleting one is one `unlink()`. That's why branch operations are instant even on a 10 GB repo — nothing is copied.

`HEAD` is another text file at `.git/HEAD`. Normally it contains a *symbolic reference* like `ref: refs/heads/main`, which is Git's way of saying "follow whatever commit `main` points at." When you're in [detached HEAD](#detached-head) state, this file instead contains a raw SHA directly.

Both facts — branch-as-pointer-file and HEAD-as-indirection — are the reason `git commit` only has to rewrite a few bytes to advance history: update the branch file, and every reader sees the new tip.

**The `.git/` directory layout:**

<pre><code class="diagram-folder-tree">
@startuml
.git/
  HEAD                 ← contains "ref: refs/heads/main"
  refs/
    heads/
      main             ← contains "a3f2d9c…" (40-char SHA + newline)
      feature          ← contains "b7e1c4d…"
  objects/             ← content-addressed blob / tree / commit store
    a3/                ← sharded by first two hex chars
      f2d9c…
    …
@enduml
</code></pre>

The commits "on" a branch aren't stored with the branch; the branch is just a pointer, and *reachability through parent links* is what defines "on this branch." Walk the parent chain from a branch's SHA, and every commit you visit is part of that branch's history.

</details>

## The One Big Idea: Additive or Rewrite

Git stores your project as an **append-only history of snapshots**. Branches and `HEAD` are just pointers into that history.

Once you hold that picture, every Git command fits in one of two buckets:

> **Every Git command either (a) creates new snapshots and moves a pointer to them, or (b) only moves pointers. It never edits an existing snapshot in place.**

The (a) bucket is **additive** — safe on shared branches, because nothing anyone already has changes. The (b) bucket is more interesting: *moving pointers backward* (e.g. `git reset --hard`) effectively discards work, and some commands in bucket (a) create new snapshots that *replace* older ones (e.g. `git commit --amend`, `git rebase`). Collectively these are the commands that **rewrite history** — safe locally, dangerous after you've pushed. Throughout this page every such command carries an **⚠️ rewrites history** callout at first mention.

*Why* Git can work this way — the content-addressed hash machinery that makes snapshots cheap and tamper-evident — is covered in the optional **🔧 Under the Hood** callouts scattered throughout this page. For now, the pointer-and-snapshot picture is enough.

**🧠 Check yourself — Core Concepts.** Before moving on, try these without looking back:

1. **In your own words:** what's the difference between a *branch* and `HEAD`? Where does each point?
2. You run `git branch feature` and then make a commit. On which branch does the new commit land, and why?
3. Which of these are **additive** (safe on shared branches) and which **rewrite history**? `git commit`, `git merge`, `git reset --hard`, `git commit --amend`, `git revert`.
4. Why does Git keep commits instead of editing them in place when you change something?

<details markdown="1">
<summary>Click to view answers</summary>

1. `HEAD` points to **where you are right now** — usually at a branch. A branch (like `main`) points directly at a commit. The double indirection `HEAD → branch → commit` is what lets `git commit` advance history by rewriting only the branch pointer file.
2. The commit lands on **whichever branch `HEAD` was on** when you committed — not on `feature`. `git branch feature` creates the pointer but doesn't move `HEAD`. (This is the Common Mistake walkthrough in [Branching](#common-mistake-git-branch-without-switching).)
3. Additive: `git commit`, `git merge`, `git revert`. Rewrites history: `git reset --hard`, `git commit --amend`.
4. Because commits are **immutable** — the SHA that identifies a commit is a hash of its own contents. Editing a commit in place would change its identity, which would break every reference to it. Git's answer is to build a new commit and move pointers instead.

</details>

# Setting Up a Repository

Before you can commit anything, you need a repository and an identity. This is a one-time setup per project or machine — fast once, rarely revisited.

## Creating a New Repository (`git init`)

`git init` turns an existing directory into a Git repository by creating a hidden `.git/` folder. Everything Git tracks lives inside `.git/`: objects, refs, branches, config. Delete `.git/` and you have an ordinary folder again.

```bash
git init myproject
cd myproject
```

The command is instantaneous because it only creates directory scaffolding — no network, no files copied. You now have an empty repository with one branch (`main` by default, since Git 2.28 if configured, or `master` on older setups) and no commits.

## Cloning an Existing Repository (`git clone`)

If the project already exists elsewhere (GitHub, GitLab, a teammate's server), use `git clone` instead of `git init`. It downloads the full repository — every commit, every branch, every tag — and creates a local copy with the remote already configured as `origin`:

```bash
git clone https://github.com/example/myproject.git
cd myproject
```

A cloned repo is *fully functional offline* — because Git is distributed, every local clone contains the entire history.

## Configuring Your Identity

Every commit records who made it. Before your first commit, tell Git who you are:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

These settings live in `~/.gitconfig` and apply to every repo on your machine. Override per-repo with `git config user.name "..."` (omit `--global`) when you need a different identity for one project — common when mixing work and personal accounts.

## Ignoring Files (`.gitignore`)

### Why do we need `.gitignore`?

Not every file in your project directory is *source code that belongs in version control*. Your working tree also accumulates files that are generated from the source, personal to your machine, or downright dangerous to commit:

- **Build artefacts** — compiled binaries, `*.pyc` bytecode, `node_modules/`, `dist/`, `target/`. These are reproducible from the source and re-generated on every build. Committing them wastes repo space, creates merge conflicts on every build, and pollutes diffs.
- **Editor / OS debris** — `.DS_Store`, `Thumbs.db`, `.idea/`, `.vscode/settings.json` (sometimes). These reflect *your* machine's setup, not the project.
- **Local config and secrets** — `.env`, `*.pem`, database passwords, API keys. These must never enter history (see the security warning below).
- **Huge binary files** — videos, datasets, model checkpoints. Git is optimised for text; large opaque binaries bloat the repo and can't be diffed meaningfully. Use Git LFS for those.

Without a `.gitignore`, Git constantly reports these files as "untracked" in `git status`, and eventually someone stages `git add -A` and commits the wrong thing. The file tells Git to **pretend these paths don't exist** — they won't show up in `git status`, won't be staged by accident, and won't be tracked.

### What goes in a `.gitignore`, and why?

A typical Python project's `.gitignore`, annotated:

```
# Compiled Python — regenerated from .py sources, never need to share
*.pyc
__pycache__/

# Virtual environments — machine-local, contains thousands of installed packages
venv/
.venv/

# Secrets — never commit (rotate immediately if you do)
.env
*.pem

# OS clutter — only relevant to macOS / Windows file browsers
.DS_Store
Thumbs.db

# Editor metadata — reflects your personal editor, not the project
.vscode/
.idea/
```

The shape generalises: **for each entry, ask "is this reproducible from source?" or "is this personal to my machine?" or "is this a secret?"** If yes to any of those, it belongs in `.gitignore`. If it's hand-authored content that's part of the project, it does not.

A few defaults worth knowing for common ecosystems:

| Ecosystem | Typical ignores |
|---|---|
| Python | `__pycache__/`, `*.pyc`, `.venv/`, `venv/`, `.pytest_cache/`, `*.egg-info/`, `dist/`, `build/` |
| Node.js | `node_modules/`, `dist/`, `build/`, `.next/`, `coverage/`, `*.log` |
| Java / JVM | `target/`, `build/`, `*.class`, `*.jar` (unless vendored), `.gradle/` |
| C / C++ | `*.o`, `*.obj`, `build/`, `cmake-build-*/`, `*.exe` |
| Rust | `target/`, `Cargo.lock` *(only ignore for libraries, commit it for apps)* |
| OS / editor | `.DS_Store`, `Thumbs.db`, `.idea/`, `.vscode/` |

GitHub publishes a curated [`gitignore` template collection](https://github.com/github/gitignore) — pick your language's file and copy it as a starting point.

### Pattern syntax

| Pattern | Matches |
|---|---|
| `*.pyc` | Any file with a `.pyc` extension in any directory |
| `__pycache__/` | Trailing `/` restricts the match to directories named `__pycache__` |
| `.env` | A specific filename at any depth |
| `/build/` | Leading `/` anchors to the repo root only (not nested `build/` folders) |
| `docs/*.html` | A path-prefix glob |
| `!important.log` | Leading `!` negates a prior match — "include this even though `*.log` would exclude it" |

### Why do I need to set `.gitignore` up *before* my first commit?

`.gitignore` has **no retroactive effect** on files that are already tracked. If you commit `node_modules/` first and add `node_modules/` to `.gitignore` second, the directory stays tracked — Git keeps following every change inside it. You have to explicitly untrack it:

```bash
git rm --cached node_modules -r
git commit -m "Stop tracking node_modules"
```

(The `--cached` flag removes the files from Git's index only, *not* from your working directory.) Adding the pattern *before* the first commit avoids this step entirely — which is why every language guide tells you to create `.gitignore` first.

### Why commit `.gitignore` itself?

Because the rules are a project-level concern, not a personal one. Sharing the file means every teammate and every future clone automatically gets the same ignore rules. Without this, each developer independently re-discovers which files to ignore — and someone eventually commits `.env`.

> ⚠️ **`.gitignore` is not a security tool.** If a secret was *ever* committed — even in a commit that was later removed — it remains in history and in the reflog, visible to anyone who clones the repository. The correct response to a leaked credential is to **rotate it immediately** and scrub history with tools like `git filter-repo` or BFG Repo Cleaner.

<details markdown="1">
<summary><strong>🔧 Under the Hood: other places ignore rules can live</strong> (optional — skip on first pass)</summary>

Besides `.gitignore` files committed to the repo, Git honours two additional ignore sources:

- **`.git/info/exclude`** — local-only ignore rules for *your* working copy of this repo; not shared with the team. Useful for adding one-off patterns without editing the shared `.gitignore` (e.g. a scratch script you only use on your machine).
- **The global file** referenced by `core.excludesfile` (default `~/.config/git/ignore` on Linux/macOS) — your personal defaults that apply to every repo on your machine. The natural home for `.DS_Store`, `Thumbs.db`, and your editor's temp files.

Rules combine: a file is ignored if any of the three sources matches it, unless a later `!pattern` negates it.

</details>

**🧠 Check yourself — Setting Up.** Try these before peeking:

1. When would you reach for `git init` versus `git clone`?
2. Your first commit on a new project has `node_modules/` in it. You add `node_modules/` to `.gitignore` and commit. Is it still tracked? Why?
3. Your teammate accidentally committed `.env` (containing an API key) last week and the commit is on `main`. Someone suggests "just add `.env` to `.gitignore` and we're fine." Why is that advice wrong, and what should happen instead?

<details markdown="1">
<summary>Click to view answers</summary>

1. `git init` creates a brand-new empty repository in the current directory. `git clone <url>` downloads an existing repository from a remote (with its full history) and sets `origin` to the URL. New project → `init`. Joining an existing project → `clone`.
2. **Still tracked.** `.gitignore` has no retroactive effect on files that are already tracked. You need to run `git rm --cached node_modules -r` to untrack them, then commit. The `.gitignore` entry only prevents *future* additions.
3. The API key is now in the repo's permanent history and reflog — anyone with a clone (including past clones) can still see it. Adding to `.gitignore` only prevents *re-committing* it. Correct response: **rotate the key immediately** (assume it's compromised), then scrub the history with `git filter-repo` or BFG Repo Cleaner and force-update the remote.

</details>

# Making Commits

The canonical local workflow is the same every day:

1. **Initialise** the repo with `git init` (or clone it) — see [Setting Up a Repository](#setting-up-a-repository).
2. **Edit** files in your working directory.
3. **Stage** the exact changes you want in the next snapshot with `git add <filename>`.
4. **Commit** the snapshot with `git commit -m "message"`.
5. **Check state** with `git status` at any time; **review history** with `git log`.

Git tracks files through the **three trees** you met in Core Concepts: the **working directory** (files on disk), the **index/staging area** (what your next commit will contain), and the **repository** (committed history). The strip above each graph below mirrors what `git status` prints — **Untracked**, **Not staged**, and **Staged**. `git add` moves files into Staged; `git commit` turns Staged into the next node in the graph.

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

## Inspecting Before You Commit

Before turning staged changes into a permanent snapshot, *look at them*. `git diff` compares different versions of your code:

* `git diff` — working directory vs. staging area.
* `git diff --staged` (or `--cached`) — staging area vs. the latest commit. Useful to review exactly what you are about to commit.
* `git diff HEAD` — working directory vs. the latest commit.
* `git diff HEAD^ HEAD` — parent vs. latest commit (shows what the latest commit changed).
* `git diff main..feature` — commits in `feature` not yet in `main`.

`git status` is the dashboard; `git diff --staged` is the review step. Run both before every commit — it's the single best habit for keeping commits clean.

## Staging Shortcuts: `git add -A` vs. `git commit -am`

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

## Writing Good Commit Messages

A commit message is a note to your future self and your teammates. Professional projects follow a small set of conventions that compound across thousands of commits.

**The 50/72 rule:**

- **Subject line: ≤50 characters.** A short imperative summary, no trailing period.
- **Blank line.**
- **Body: wrap at 72 characters.** Explain the *why*, not just the *what* — the diff already shows what.

**Imperative mood.** Write the subject as a command describing what the commit does, not a past-tense description of what you did:

| ✅ Imperative | ❌ Past tense / gerund |
|---|---|
| `Add login endpoint` | `Added login endpoint` |
| `Fix off-by-one in pagination` | `Fixing off-by-one in pagination` |
| `Refactor user-service for clarity` | `Refactored user service` |

Mnemonic: a good subject line completes the sentence *"If applied, this commit will ______"*. "Add login endpoint" — yes. "Added login endpoint" — grammatically awkward.

**Conventional Commits (optional, team-level).** Many teams adopt the [Conventional Commits](https://www.conventionalcommits.org/) convention — a structured prefix that enables automated changelog generation and semantic-version bumping:

```
<type>(<optional scope>): <subject>

<optional body>

<optional footer(s)>
```

Common types: `feat` (new feature), `fix` (bug fix), `docs`, `refactor`, `test`, `chore`, `ci`, `build`. Example:

```
feat(auth): add rate limiting to login endpoint

Requests from a single IP are capped at 5 per minute.
Exceeding the limit returns HTTP 429 with a Retry-After
header. Protects against credential-stuffing attacks.

Closes #342
```

Whether to adopt Conventional Commits is a **team decision** — but writing imperative, ≤50-character subjects is universal.

## Fixing Your Last Commit (`git commit --amend`)

> ⚠️ **This command rewrites history.** Safe for commits you have not yet pushed. Never amend a commit that has been pushed to a shared branch — see the [Golden Rule of Shared History](#the-golden-rule-never-rewrite-pushed-commits).

### Why do we need `--amend`?

Because the most common "oops" in Git is noticing a typo in the commit message, or realising you forgot to `git add` a file, *seconds* after committing. Without `--amend` you'd have two bad options: leave the broken commit in history and create a follow-up ("fix typo in previous message"), or reset the branch and rebuild the commit manually. Neither is great. `--amend` gives you a dedicated "I meant this, not that" operation that replaces the tip commit with a corrected version.

### What it does

`git commit --amend` combines the staging area with the current tip commit and rewrites it — new hash, same branch position.

Typical uses:

- **Fix the message:** `git commit --amend -m "Correct subject line"`.
- **Include a forgotten file:** `git add forgotten.py && git commit --amend --no-edit` (keeps the original message).

<div data-git-command-lab>
<script type="application/json">
{
  "command": "git commit --amend",
  "description": "**\u26a0\ufe0f Rewrites history.** Replaces the most recent commit with a new one \u2014 typically to fix a typo in the message or include a file you forgot to stage.\n\nThe commit is not actually edited in place (commits are immutable). Git creates a brand-new commit **C\u2032** with the amended content and moves the branch pointer to it; the original **C** becomes unreferenced and is eventually garbage-collected.\n\n*Safe for local work, but never amend a commit you've already pushed* \u2014 collaborators' clones still reference the old hash and will see a diverged branch on next pull.",
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

Amend is the simplest of Git's rewrite operations — and therefore the gateway drug to the rest of [Reshaping History](#rewriting-history).

**🧠 Check yourself — Making Commits.** Try these before peeking:

1. Name the three areas a file passes through on its way into history. Which Git command moves it between each?
2. You have `src/utils.js` (modified) and `notes.txt` (untracked). You run `git commit -am "Update utils"`. What ends up in the new commit, and why?
3. You commit, then notice a typo in the message two seconds later. Which command fixes it, and why must you only use it on *local* commits?
4. Rewrite this commit subject in imperative mood: *"Fixed the pagination off-by-one error that broke the dashboard"*.

<details markdown="1">
<summary>Click to view answers</summary>

1. **Working directory → staging area (index) → repository.** `git add <file>` moves a change from working directory into staging. `git commit` moves staged changes into a new commit in the repository. (`git status` lets you inspect what's in each area at any time.)
2. **Only `src/utils.js` is committed.** `git commit -am` auto-stages *tracked, modified* files — it does not touch *untracked* files like `notes.txt`. That's the difference between `-am` and `git add -A`; `-am` is the safer shortcut.
3. `git commit --amend` (typically `--amend -m "New message"`). It creates a *new* commit replacing the old tip — same content, corrected message, different SHA. Safe locally because only your repo has the old SHA; dangerous after pushing because collaborators still have the old SHA and their clones will diverge.
4. *"Fix off-by-one in dashboard pagination"* (and ≤50 chars). The mnemonic: a good subject completes "If applied, this commit will ___".

</details>

# Managing Uncommitted Changes

Your working tree is often in a state you don't want to commit yet — half-finished edits, debug prints, generated files. Three commands manage this space.

## Discarding Changes (`git restore`)

`git restore <file>` replaces the file in your working directory with its committed version, discarding any unsaved edits:

```bash
git restore src/app.py               # discard working-tree edits
git restore --staged src/app.py      # unstage, but keep the edits
git restore --source=HEAD~3 src/app.py  # restore from 3 commits ago
```

- Without `--staged`, `restore` overwrites your working tree — **uncommitted edits are lost with no undo**.
- With `--staged`, `restore` only touches the index (moves the file out of "staged"), leaving your working-tree edits intact.

`git restore` and its sibling `git switch` (for branch navigation) were introduced in Git 2.23 as cleaner replacements for the overloaded `git checkout`. `git checkout` still works, but the split is clearer — navigate branches with `switch`, discard file changes with `restore`.

## Shelving Work in Progress (`git stash`)

`git stash` saves your uncommitted changes (staged and unstaged) to a private stack, then cleans the working tree — letting you switch contexts without making a messy commit:

```bash
git stash                   # save; working tree becomes clean
git switch hotfix           # do something urgent
# …commit and merge the hotfix…
git switch original-branch  # return
git stash pop               # restore and drop the stash
```

Flags worth knowing:

- `git stash -u` also stashes **untracked** files (otherwise ignored — a common surprise).
- `git stash pop` restores and drops the stash; `git stash apply` restores but keeps the stash in the stack (useful when you want to apply the same shelf to multiple branches).
- `git stash list` shows the stack; entries are named `stash@{0}` (most recent), `stash@{1}`, etc.
- `git stash drop stash@{n}` deletes an entry without applying it.

<details markdown="1">
<summary><strong>🔧 Under the Hood: how stash actually works</strong> (optional — skip on first pass)</summary>

Stash is **not** a separate storage area — it's regular commit objects on a dangling branch `refs/stash`. When you stash, Git creates up to two commits off `HEAD`:

1. An **index commit `i`** whose tree captures the state of the staging area. Parent: current `HEAD`.
2. A **WIP commit `w`** whose tree captures the working directory. Parents: current `HEAD` *and* `i` — a merge commit, so the staged and unstaged halves can be recovered independently.

The ref `refs/stash` (exposed as `stash@{0}`) points at `w`. Neither `main` nor `HEAD` moves — stashing never touches your branch. `git stash pop` re-applies `w`'s tree and deletes the ref; without a ref pointing at them, `i` and `w` become unreachable and are garbage-collected on the next `git gc`.

</details>

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

## Cleaning Untracked Files (`git clean`)

`git clean` is `git restore`'s cousin for files Git *doesn't* track. `git restore` can only touch files Git already knows about; `git clean` removes entire untracked files and directories:

```bash
git clean -n          # dry run — list what would be removed
git clean -f          # force — actually delete untracked files
git clean -fd         # also remove untracked directories
git clean -fdx        # also remove ignored files (!!!)
```

Like `git restore` without `--staged`, this is **permanent** — `git clean -fd` cannot be undone by Git. Always dry-run first. `-fdx` removes files that `.gitignore` excludes (build artefacts, `node_modules/`, caches) — useful for a full reset before diagnosing a build issue, but dangerous if `.gitignore` covers anything you don't want to lose.

**🧠 Check yourself — Managing Uncommitted Changes.** Try these before peeking:

1. Three files are all *uncommitted* but in different states: `a.js` is staged, `b.js` is modified-but-unstaged, `c.js` is brand-new-and-untracked. You run `git stash`. What happens to each?
2. What's the functional difference between `git restore file.js` and `git restore --staged file.js`?
3. You run `git clean -fd` in your project and realise too late that you had some untracked scratch notes in there. Can Git recover them? Why or why not?

<details markdown="1">
<summary>Click to view answers</summary>

1. `a.js` and `b.js` are stashed (tracked files — staged and unstaged changes both go onto the stash). `c.js` is **left untouched** in the working directory — plain `git stash` ignores untracked files. To include it, you'd need `git stash -u` (for untracked) or `git stash -a` (for untracked *and* ignored).
2. **Different target.** `git restore file.js` replaces the working-copy version with the staged (or committed) version — it **destroys working-copy edits**. `git restore --staged file.js` only unstages — it moves the file out of the index back to "unstaged", leaving your edits intact.
3. **No.** Untracked files were never in the object database or the reflog — Git has nothing to recover them from. OS-level backups or editor "local history" are your only hope. This is why `git clean` always wants a `-n` dry run first.

</details>

# Branching

A branch is Git's way of supporting **parallel lines of development** — you can experiment on a feature branch without touching `main`, and combine the work back only when it's ready.

## What a Branch Physically Is

Recall from [Core Concepts](#head-branches-and-the-commit-graph): a branch is a **41-byte pointer file** in `.git/refs/heads/` containing one commit's SHA. That's it — no per-branch copy of your files, no hidden metadata. Creating a branch is one `fwrite()`; it costs milliseconds even on a 10 GB repo.

This lightweight pointer is why Git encourages branching liberally. If branches were expensive copies, you'd avoid creating them. Because they're nearly free, best practice is to branch *often* — one branch per feature, bug fix, or experiment.

## Creating, Switching, and Deleting Branches

```bash
git branch                   # list local branches (* marks current)
git branch feature           # create a branch at HEAD (do NOT switch)
git switch feature           # switch HEAD to an existing branch
git switch -c feature        # create AND switch in one step (most common)
git branch -d feature        # delete (refuses if unmerged; safe)
git branch -D feature        # force-delete (no safety check)
```

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

## Common Mistake: `git branch` Without Switching

Where a commit lands depends entirely on where `HEAD` is pointing when you run `git commit`. A very common beginner mistake is running `git branch <name>` and then immediately starting work — `git branch` creates the pointer but leaves `HEAD` on the current branch, so all new commits continue landing there. The two labs below show this side-by-side.

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

> **Detached HEAD**, the third common HEAD state, is covered under [Undoing Committed Work](#detached-head) — it's most useful when investigating and recovering, not during normal branching.

**🧠 Check yourself — Branching.** Try these before peeking:

1. Your repo has 10 GB of code. How long does `git branch feature` take, and why?
2. You run `git branch feature`. Without moving from `main`, you stage and commit a new file. Sketch the graph (or describe it in one sentence). Where did the commit actually land?
3. What do `git switch feature` and `git switch -c feature` each do? When would you pick one over the other?

<details markdown="1">
<summary>Click to view answers</summary>

1. **Milliseconds.** A branch is a 41-byte text file in `.git/refs/heads/` containing one SHA. Creating one is one `fwrite()` — nothing is copied, nothing re-indexed. The 10 GB of code is irrelevant.
2. The commit lands on **`main`**, not `feature`. `git branch feature` creates a new pointer at the current commit but **doesn't move `HEAD`** — `HEAD` still points at `main`, so the next commit advances `main`. `feature` stays behind at the previous commit. (This is the classic Common Mistake — do `git switch -c feature` instead.)
3. `git switch feature` moves `HEAD` to an **existing** branch. `git switch -c feature` **creates** a new branch at the current commit *and* moves `HEAD` to it. Use `-c` when starting new work; omit it when navigating between branches that already exist.

</details>

# Merging

Once work has happened in parallel on two branches, you eventually want to bring it back together. Git has three modes of `git merge`, each with a distinct graph shape.

## Fast-Forward Merge

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

## Three-Way Merge

<div data-git-command-lab>
<script type="application/json">
{
  "command": "git merge feature",
  "description": "**Three-way merge.** Both branches have commits the other doesn't: `main` added E; `feature` added C and D.\n\nGit compares both tips against their **common ancestor** (B) and creates a new merge commit **M** with *two parents* \u2014 one per branch.\n\nThe resulting diamond shape in the graph is the hallmark of a three-way merge.\n\n*The strategy name shown in the output is* `ort` *(default since Git 2.33, Aug 2021); older versions and Pro Git show `recursive` \u2014 the algorithm is equivalent for this case.*",
  "output": "Merge made by the 'ort' strategy.\n src/app.py | 4 +++-\n 1 file changed, 3 insertions(+), 1 deletion(-)",
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

## Forcing a Merge Commit: `--no-ff`

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

## Squash Merge

> ⚠️ **This variant rewrites history** in the sense that it produces one new commit whose parent is `main`'s previous tip — not `feature`'s tip. The feature branch's individual commits are **not** recorded on `main`.

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

**Trade-off.** Squash merge makes `main`'s log read as one commit per feature (clean), but you lose the intermediate commits — which hurts `git bisect` precision if a regression later narrows to "the whole squashed feature." The internal commits still exist on the feature branch (if you don't delete it) and in reflog.

## Handling Merge Conflicts

When Git cannot automatically reconcile differences (usually because the same lines were changed in both branches), it marks the conflicting sections in the file with conflict markers:

```
<<<<<<< HEAD
your version of the code
=======
incoming branch version
>>>>>>> feature-branch
```

The full resolution sequence is: edit the conflicting file to remove all markers and keep the correct content, stage it with `git add`, then finalise with `git commit`. Use `git merge --abort` to cancel a merge in progress and return to the pre-merge state.

> **Your editor probably has a nicer UI for this.** VS Code, JetBrains IDEs, and most other editors surface conflicts inline with *"Accept Current"* / *"Accept Incoming"* / *"Accept Both"* buttons above each conflict block — you click rather than hand-edit the markers. The underlying command sequence is identical (`git add` then `git commit` to finalise); the buttons are just a friendlier way to produce the same resolved file.

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
      "description": "Both branches edited the same lines in `greeting.txt`. Git cannot decide which version to keep, so it **pauses the merge** and injects conflict markers into the file.\n\n`greeting.txt` now shows up with status **`unmerged`** (Git's own `git status` calls this *both modified* — it was modified on both sides of the merge). Git will not let you commit until every conflict is resolved.",
      "output": "Auto-merging greeting.txt\nCONFLICT (content): Merge conflict in greeting.txt\nAutomatic merge failed; fix conflicts and then commit the result.",
      "state": {
        "log": "E000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Hotfix on main|HEAD -> main\nD000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Edit greeting on feature|feature\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|\nA000000000000000000000000000000000000000||Repository init|",
        "branches": "* main\n  feature",
        "head": "refs/heads/main",
        "files": {
          "untracked": [],
          "unstaged": [{"status": "unmerged", "path": "greeting.txt"}],
          "staged": [],
          "stashed": []
        }
      }
    },
    {
      "command": "manual edits to greeting.txt",
      "description": "Open `greeting.txt` and remove the conflict markers, keeping the content you want:\n\n```\n<<<<<<< HEAD\nHello, world! (hotfix)\n=======\nHi there! (feature)\n>>>>>>> feature\n```\n\nEditing the file **does not clear the conflict flag** — `greeting.txt` still shows as `unmerged` and Git still refuses to commit. The conflict is officially marked resolved only when you `git add` the file in the next step.",
      "state": {
        "log": "E000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Hotfix on main|HEAD -> main\nD000000000000000000000000000000000000000|B000000000000000000000000000000000000000|Edit greeting on feature|feature\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Initial commit|\nA000000000000000000000000000000000000000||Repository init|",
        "branches": "* main\n  feature",
        "head": "refs/heads/main",
        "files": {
          "untracked": [],
          "unstaged": [{"status": "unmerged", "path": "greeting.txt"}],
          "staged": [],
          "stashed": []
        }
      }
    },
    {
      "command": "git add greeting.txt",
      "description": "`git add` has a second job during a merge: it **clears the `unmerged` flag** and simultaneously stages the resolved content. `greeting.txt` moves from `unmerged` (unstaged) to `modified` (staged).\n\nIf multiple files conflicted you would repeat this for each one before moving on.",
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
      "description": "With all conflicts staged, `git commit` finalises the merge by creating the merge commit **M** with two parents — one from each branch. Because the staging area already holds the resolved content, Git just needs a message: it pre-fills one (`Merge branch 'feature'`) and opens your editor so you can save-and-quit to accept it (or edit it first).\n\nThe graph now shows the classic diamond shape that marks a three-way merge.",
      "output": "[main M000000] Merge branch 'feature'",
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

## Merge Strategies (`ort`, `-X ours`, `-X theirs`)

Since Git 2.33 (August 2021), the default merge strategy is **ort** (Ostensibly Recursive's Twin) — a reimplementation of the older `recursive` strategy that's faster and handles renames better. For typical two-branch merges the output is identical; you rarely need to pick a strategy explicitly.

When the default auto-resolution doesn't do what you want, **strategy options** (`-X`) tune the behaviour:

```bash
git merge feature -X ours              # on conflict, keep OUR version (current branch)
git merge feature -X theirs            # on conflict, keep THEIR version (incoming)
git merge feature -X ignore-all-space  # ignore whitespace differences
```

**Important:** `-X ours`/`-X theirs` only affect *conflicting* lines — non-conflicting changes from both branches are still combined normally. Don't confuse them with the whole-branch strategies `-s ours` (discard the other branch's changes entirely) or `-s subtree` — far rarer and more dangerous operations.

Use `-X theirs` when integrating generated or vendored files where the incoming version is authoritative. Use `-X ours` sparingly — it's easy to silently lose incoming fixes.

**🧠 Check yourself — Merging.** Try these before peeking:

1. `main` is at commit B. `feature` branched from B and added commits C and D. `main` has not moved. You run `git merge feature` from `main`. What shape does history take — fast-forward or merge commit? Why?
2. Same setup, but now `main` has also added a commit E since `feature` branched. You run `git merge feature`. What's the shape now? How many parents does the new commit have?
3. `git merge --squash feature` produces a commit whose parent is `main`'s previous tip — *not* `feature`'s tip. What does this mean for `git log --graph` after the squash? Can you still tell from `main`'s history that `feature` existed?
4. Mid-merge, you open a conflicted file and edit it. You run `git status` and the file is still marked `unmerged`. What command officially marks it resolved?

<details markdown="1">
<summary>Click to view answers</summary>

1. **Fast-forward.** `main` had no commits of its own past B, so Git simply slides `main`'s pointer forward to D — no new commit is created. History stays linear.
2. A **three-way merge**. Git creates a new merge commit **M** with **two parents**: one is `main`'s previous tip (E), the other is `feature`'s tip (D). The shape is the classic diamond.
3. `main`'s history reads as a single linear commit with the squashed changes — no branch structure on `main`. The `feature` branch's individual commits still exist (on `feature` itself, or in reflog) but are **not reachable from `main`**. `git log main` won't traverse them. This is the trade-off: clean linear log, lost fine-grained history and weaker `git bisect` precision.
4. **`git add <file>`.** During a merge, `git add` has a double job: it stages the file *and* clears the `unmerged` flag. Only then will `git commit` let you finalise the merge.

</details>

# Remotes

Git really shines once you're sharing work with other people. This section opens with the two questions that trip up most newcomers.

### What's the difference between a local and a remote repository?

A **local repository** is the one on your laptop — the `.git/` folder inside your project directory. It's where your commits actually live while you work, and everything in this chapter up to now has only touched it.

A **remote repository** is another copy of the same project, living somewhere else — typically on GitHub, GitLab, or a self-hosted server. The remote is how your work becomes visible to anyone else: teammates, CI systems, deployment scripts, the open-source world.

Why have both? Three reasons:

1. **Collaboration.** Your teammates need access to your work. A single shared remote is the source of truth that everybody pushes to and pulls from.
2. **Backup.** Your laptop could die, be stolen, or get dropped in a lake. The remote is insurance — if your local repo vanishes, a fresh clone from the remote reconstructs it.
3. **Distribution.** In open-source projects, you don't have permission to write directly to the main repository. You clone your own copy, push commits to *your* remote (a "fork"), and open a pull request asking the maintainers to pull your changes into *theirs*.

The local↔remote split is also why Git feels different from older, centralised systems like SVN. In SVN, you need a network to commit at all — the server *is* the repo. In Git, your local repo is fully featured: you commit, branch, and inspect history offline, then sync with a remote when you're ready. Every Git command in this chapter up to now works without network access.

A **remote** — in the narrow Git sense — is a *named URL pointing to another copy of the repository*. `origin` is the conventional name for the primary remote (the one you cloned from). A single repo can have multiple remotes with different names (common in open-source: `origin` for your fork, `upstream` for the maintainer's repo).

<details markdown="1">
<summary><strong>🔧 Under the Hood: what a server-side remote actually stores</strong> (optional — skip on first pass)</summary>

Remote servers typically host **bare repositories** (created with `git init --bare`) — repositories with *no working tree*. They store the object database, refs, and config (the contents of a regular `.git/` directory), but no checked-out files. That makes sense: nobody is editing files directly on the server; the server exists to store history and serve it to clients on `push` / `fetch`. A bare repo's directory ends in `.git` by convention (e.g. `myproject.git`) so you can tell at a glance.

</details>

### What's the difference between `git clone` and `git pull`?

They sound similar and both "get code from a remote," which causes endless confusion. They do fundamentally different jobs:

| | `git clone <url>` | `git pull` |
|---|---|---|
| **When you run it** | Once per project, to get started | Repeatedly, to catch up with teammates' commits |
| **Needs an existing local repo?** | **No** — you run it outside of any repo | **Yes** — you run it inside the repo |
| **What it does** | Creates a new local repo from a remote: downloads every commit, branch, and tag; checks out the default branch; configures `origin` to point at `<url>` | Downloads **new** commits from the remote (`git fetch`) and integrates them into your current branch (`git merge` or `git rebase`) |
| **Directory it produces** | Creates a new folder named after the repo | Doesn't create anything — updates the existing working tree in place |
| **How often you run it** | Effectively once (per machine, per project) | Many times a day on an active team |

The tidy way to think about it: **`clone` is how a local repo is born; `pull` is how it stays current.**

A worked example:

```bash
# Day 1 — you join a project. You have no copy of it yet.
git clone https://github.com/acme/myproject.git     # creates myproject/ and downloads everything
cd myproject

# Days 2..N — you work on the project. Each day, teammates push new commits.
git pull                                             # brings those new commits into your branch
# ...do your work...
git push                                             # ship your commits back
git pull                                             # tomorrow morning: catch up again
```

If you ever find yourself running `git clone` twice for the same project, you probably wanted `git pull`. If you ever find yourself running `git pull` and getting "not a git repository", you probably wanted `git clone`.

## The five remote commands

The five commands that define remote collaboration:

* **`git clone <url>`** — creates a local copy of a remote repository ([Setup](#cloning-an-existing-repository-git-clone)).
* **`git remote`** — lists configured remotes. `git remote add origin <url>` registers a remote named `origin` (the conventional primary remote name); `git remote -v` lists existing remotes with their URLs.
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

## Remote-Tracking Branches: `origin/main` vs. `main`

This is one of Git's most persistent sources of confusion. There are actually **three different pointers** for any shared branch:

1. **Your local branch** (`main`) — the tip of your own work.
2. **Your remote-tracking branch** (`origin/main`) — your *snapshot* of where the remote was the last time you communicated with it. A read-only local reference stored in `.git/refs/remotes/origin/`.
3. **The actual remote branch** — what GitHub/GitLab/your server shows *right now*. You can only see its current state by running `git fetch` (or `git ls-remote`).

These three can be out of sync in different ways:

- **After you commit locally:** `main` is ahead of both `origin/main` and the actual remote. A `git push` synchronises them by uploading your commits.
- **After a teammate pushes:** the actual remote is ahead of both `origin/main` and your `main`. A `git fetch` updates `origin/main`. A `git pull` does both fetch *and* merge, bringing your `main` in sync.
- **After both you and teammates pushed:** you've diverged. Neither simple push nor simple pull works — you must integrate (merge or rebase) and then push. See [Diverged Pull](#diverged-pull-merge-vs-rebase) below.

Useful inspection commands that rely on this distinction:

```bash
git log origin/main                    # what's on the (last-fetched) remote
git log main..origin/main              # commits on remote not yet on local (incoming)
git log origin/main..main              # commits on local not yet on remote (unpushed)
git diff main origin/main              # content differences between the two
```

**Rule of thumb:** `origin/main` is a **read-only local cache of the remote**. You never commit to it; it only moves when you `fetch`, `pull`, or `push`. In the graphs below it appears with a **dashed label** and grey colour to distinguish it from your local branch pointer.

## Fetching vs. Pulling — Why You Have Two Commands

`git fetch` and `git pull` both "download" from the remote, but they differ in how invasive they are:

- **`git fetch`** — downloads new commits and updates remote-tracking branches only. Your local branches and working tree are untouched. Safe to run any time.
- **`git pull`** — shorthand for `git fetch` followed by `git merge` (or `git rebase` if configured). Downloads *and* integrates into your current branch.

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

**The case for running them separately** — the *fetch → inspect → merge* pattern:

```bash
git fetch                          # update origin/main
git log main..origin/main          # what's new? any dangerous changes?
git diff main origin/main          # what content would come in?
git merge origin/main              # integrate only after you've inspected
```

This pattern is especially valuable for branches you share with many people, where you want to see what's coming before you commit to integrating. **Use plain `pull`** for your own feature branch where you already know what's incoming (your CI, your own work on another machine), or during trivial fast-forward syncs.

## Diverged Pull: Merge vs. Rebase

The fast-forward case above is the lucky path — your local branch had no new commits of its own, so Git could simply slide `main` forward. The interesting case is when *both* you and the remote have moved on since your last sync. Suppose you committed **B** locally, and while you were working, a teammate pushed **C** to the remote. Now `main` and `origin/main` have diverged, both descending from the common ancestor **A**.

`git pull` handles this by creating a **merge commit** that ties the two tips together — preserving the full DAG but littering history with auto-generated "Merge remote-tracking branch 'origin/main'" commits:

<div data-git-command-lab>
<script type="application/json">
{
  "command": "git pull",
  "description": "After `git fetch`, Git sees that `main` (at B) and `origin/main` (at C) have diverged from their common ancestor A. `git pull`'s default strategy is **merge**: it creates a new merge commit **M** with two parents — your local **B** and the remote's **C** — and advances `main` to M.\n\nHistory is preserved exactly (no hashes change), but the graph gains a diamond and an auto-generated message *`Merge remote-tracking branch 'origin/main'`* (or, on older Git, *`Merge branch 'main' of <remote-url>`*). On a busy team branch, these pile up and clutter the log.",
  "before": {
    "log": "C000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Teammate's change|origin/main\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Your local work|HEAD -> main\nA000000000000000000000000000000000000000||Shared base|",
    "branches": "* main",
    "head": "refs/heads/main"
  },
  "after": {
    "log": "M000000000000000000000000000000000000000|B000000000000000000000000000000000000000 C000000000000000000000000000000000000000|Merge remote-tracking branch 'origin/main'|HEAD -> main\nC000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Teammate's change|origin/main\nB000000000000000000000000000000000000000|A000000000000000000000000000000000000000|Your local work|\nA000000000000000000000000000000000000000||Shared base|",
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

## Pushing

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

## The Force-Push Warning

`git push -f` (force-push) overwrites remote history to match your local copy. On a shared branch this **permanently deletes** commits your collaborators have already pushed. Never force-push to `main` or any shared integration branch. If you've rebased or amended commits that are already remote, push to a new branch instead — or use `--force-with-lease`, which at least refuses to overwrite if the remote has moved since your last fetch.

## Pull Requests and Code Review

On every real-world team, code doesn't go straight from your laptop to `main`. It goes through a **pull request** (PR, on GitHub or Bitbucket) or **merge request** (MR, on GitLab) — a proposal asking teammates to review the change before it lands.

The daily loop:

1. **Branch.** `git switch -c feat-login` — one branch per feature or bug fix.
2. **Commit.** Make your changes as a series of focused commits.
3. **Push.** `git push -u origin feat-login` — uploads your branch and sets upstream tracking.
4. **Open a PR.** On the hosting platform, request that `feat-login` be merged into `main`. Write a description explaining *what* changed and *why*. Link related issues.
5. **Review.** Teammates read the diff, leave inline comments, request changes or approve.
6. **Iterate.** Commit fixes locally, push again — the PR updates automatically.
7. **Merge.** After approval (and green CI), someone clicks "Merge" on the platform. Most platforms offer three merge strategies — regular merge, squash-and-merge, or rebase-and-merge — as a team-wide setting or per-PR choice.
8. **Clean up.** Delete the feature branch locally and on the remote.

**Why teams use PRs:**

- **Isolation.** Broken work never touches `main`; CI runs on the PR branch.
- **Review.** Every change is read by at least one other human before it ships.
- **Audit trail.** The PR is a durable record of the design discussion and approvals — valuable long after the commits themselves.
- **CI gate.** The platform can block merging until tests pass and reviewers approve.

**Forks vs. direct branches.** In internal team repositories, everyone pushes branches directly to the same `origin` and opens PRs there. In open-source projects (and some strict security contexts), you don't have push access to the main repo — you **fork** it into your own account, push branches to your fork, and open a PR from `yourfork:branch` → `upstream:main`. The mechanics are the same; only the *where you pushed the branch* differs.

**🧠 Check yourself — Remotes.** Try these before peeking:

1. There are three pointers that *all* sit on what feels like "the main branch": `main`, `origin/main`, and the actual branch on the remote server. Which one moves when you run each of these? `git commit`, `git fetch`, `git push`.
2. What's the practical difference between `git fetch` and `git pull` — and why have two commands?
3. You and a teammate both pushed to `main` since your last pull. A plain `git pull` succeeds but adds a `Merge remote-tracking branch 'origin/main'` commit. What would `git pull --rebase` have done instead, and why might you prefer it on a feature branch?
4. Why is `git push -f` to `main` considered dangerous even if you've only "cleaned up" your own commits?

<details markdown="1">
<summary>Click to view answers</summary>

1. `git commit` moves **`main`** (your local branch) — neither of the remote pointers changes. `git fetch` moves **`origin/main`** (your local snapshot of the remote) to match the actual remote; nothing else moves. `git push` uploads your commits and advances **both the actual remote and `origin/main`** to match your local `main`.
2. `git fetch` **downloads only** — updates `origin/main`, never touches your local branch or working tree. `git pull` is `fetch + merge` (or `fetch + rebase`) — it integrates immediately. Two commands exist so you can inspect what's coming (`git log main..origin/main`, `git diff`) before committing to integrate.
3. `--rebase` replays your local commits on top of the fetched `origin/main` tip, producing linear history with no merge commit (your commits get new hashes). Preferred on a feature branch because the log reads cleanly as one linear story; less appropriate on long-lived shared branches where *anyone* rewriting is risky.
4. Force-push **overwrites** the remote branch with your local copy. If any commits on the remote are not in your local copy (say, a teammate pushed while you were rebasing), they are **deleted from the server**. Even on "only your own commits", collaborators' clones still reference the old hashes, so their next pull will see a confused diverged state. Use `--force-with-lease` as a safer alternative, or — better — push to a new branch.

</details>

# Tagging Releases

A **tag** is a permanent, human-meaningful name for a specific commit — typically used to mark a release (`v1.0.0`, `v2.3.1-beta`, `release-2024-01-15`). Unlike branches, tags don't move. Once `v1.0.0` is created, it points to that commit forever.

## Lightweight vs. Annotated Tags

Git has two kinds of tags:

- **Lightweight tag** — just a pointer to a commit, like a branch that never moves. Created with `git tag <name>`.
- **Annotated tag** — a full Git object that carries a tagger name, email, timestamp, and message (and can be GPG-signed). Created with `git tag -a <name> -m "message"`.

For releases, **always use annotated tags**. They record who released what and when, and they're required for signed-release verification.

```bash
git tag -a v1.0.0 -m "Release v1.0.0: initial public release"
```

Use lightweight tags only for quick, personal markers you don't share.

## Listing, Pushing, and Checking Out Tags

```bash
git tag                           # list all tags
git tag -l "v1.*"                 # list tags matching a glob
git show v1.0.0                   # inspect the tag and its commit
git push origin v1.0.0            # push ONE tag to the remote
git push --tags                   # push ALL local tags
git switch --detach v1.0.0        # check out the tagged commit (detached HEAD)
git tag -d v1.0.0                 # delete the tag locally
git push origin :refs/tags/v1.0.0 # delete the tag on the remote
```

Tags are **not** pushed by default with `git push`. You must explicitly push them, either individually or with `--tags`. This is a common source of confusion — "I tagged the release but my teammate can't see it."

## Semantic Versioning and `git describe`

Teams often follow **Semantic Versioning (SemVer)**: `MAJOR.MINOR.PATCH`. Each component signals a different level of change:

| Bump | When | Example |
|---|---|---|
| **PATCH** (`1.2.3` → `1.2.4`) | Backwards-compatible bug fix | Fix crash when input is empty |
| **MINOR** (`1.2.4` → `1.3.0`) | Backwards-compatible new feature | Add optional `--verbose` flag |
| **MAJOR** (`1.3.0` → `2.0.0`) | Breaking change that existing callers can't use unchanged | Remove deprecated function; change default argument |

[Conventional Commits](#writing-good-commit-messages) plug directly into this: tools like [`semantic-release`](https://semantic-release.gitbook.io/) and [`standard-version`](https://github.com/conventional-changelog/standard-version) read the `feat:` / `fix:` / `BREAKING CHANGE:` prefixes in your commit history and automatically decide the next version number. For example, given these three commits since the last release (`v1.2.3`):

```
fix(parser): handle empty input
feat(cli): add --verbose flag
fix(logger): correct timestamp format
```

`semantic-release` sees one `feat` (MINOR bump wins over `fix`) and releases **`v1.3.0`** — generating a `CHANGELOG.md` entry that groups the commits by type. A single commit with `BREAKING CHANGE:` in its footer would instead bump the MAJOR. The convention is a *machine-readable protocol*, not just a naming style.

`git describe` produces a human-readable version string from the nearest tag:

```bash
$ git describe
v1.2.0-15-ga3f2d9c
```

Read this as *"15 commits past the v1.2.0 tag, at commit `a3f2d9c`"*. Build systems use this to stamp binaries with their exact source version.

**🧠 Check yourself — Tagging Releases.** Try these before peeking:

1. What's the practical difference between `git tag v1.0.0` (lightweight) and `git tag -a v1.0.0 -m "…"` (annotated)? Which one should you use for a public release?
2. You've tagged `v1.0.0` locally and pushed your branch. Your teammate pulls — can they see `v1.0.0`? What do you need to do?
3. Your project uses SemVer. A commit introduces a change to a public API that old callers can no longer use unchanged. Should the next version bump the MAJOR, MINOR, or PATCH number?

<details markdown="1">
<summary>Click to view answers</summary>

1. Lightweight tag = just a named pointer to a commit (like a branch that doesn't move). Annotated tag = a full Git object with tagger name, email, timestamp, optional message, and GPG signature support. For public releases, **always use annotated** — you want the provenance and signability.
2. **No, not by default.** Tags are not pushed with `git push`. You need `git push origin v1.0.0` (one tag) or `git push --tags` (all local tags). Very common source of "I tagged the release but nobody can see it."
3. **MAJOR** — breaking changes bump MAJOR. MINOR is for backwards-compatible new features; PATCH is for backwards-compatible bug fixes. Example: `1.2.3` → breaking change → `2.0.0`.

</details>

# Rewriting History

The commands in this section either **create new commit objects with new hashes** or **move branch pointers backward** — operations that rewrite or rearrange history. They are powerful, but the rule below is non-negotiable.

## The Golden Rule: Never Rewrite Pushed Commits

> ⚠️ **Never rewrite a branch that has been pushed to a shared remote.** The new commits *look* the same to you but have different hashes, so collaborators' clones still reference the old hashes — a recipe for conflicts, duplicate patches, and lost work.

All of the operations below create new commit objects or move pointers backward. They are **safe on local, unpushed commits** and **dangerous on anything that has been pushed**. When in doubt, use `git revert` (additive — see [Undoing Committed Work](#undoing-committed-work)) instead.

## Rebasing a Branch

### Why would I ever rebase instead of merging?

Because `merge` and `rebase` produce different *shapes* of history, and sometimes you want the shape `rebase` gives you. A `git merge feature` into `main` preserves the fact that `feature` was a parallel line of work — you get a diamond in the graph. A `git rebase main` on `feature` *replays* your feature commits on top of the latest `main`, producing a straight line of history with no fork.

Three concrete situations where people reach for `rebase`:

1. **Cleaning up before a PR.** Your feature branch has been open for a week; `main` has moved; you want the diff in the PR to be exactly your changes, not "your changes plus everything else that happened". A `git rebase main` replays your commits on top of the current `main` so the PR is clean.
2. **Keeping a linear log.** Some teams prefer `git log --oneline` on `main` to read as a single chain of features rather than a braided mess of merges. Rebasing feature branches before merging keeps the line straight.
3. **Squashing WIP commits.** Interactive rebase (`-i`) lets you combine, reorder, reword, or drop commits — handy when you have "fix typo" and "oops forgot semicolon" commits you don't want in the permanent record.

The cost: because replayed commits have *different hashes* from the originals, rebasing a branch you've already pushed breaks everyone else's clone of it. That's why rebase is safe locally and dangerous after pushing — the same rule that governs every other "rewrites history" operation.

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

## Cherry-Picking a Commit

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

## Deciding Between Rebase, Cherry-Pick, and Squash Merge

All three create new commits with new hashes. Their difference is **scope and intent**:

| Command | Scope | Intent |
|---|---|---|
| `git rebase <base>` | All commits unique to the current branch | "Put my work on top of the latest base." Produces linear history before a PR. |
| `git cherry-pick <sha>` | One commit (or a small range) | "I need this one fix on a different branch." Backports, selective pickups. |
| `git merge --squash <branch>` | All commits on a branch, collapsed into one | "Land this whole feature as a single commit on main." Clean feature-log. |

All three obey the [Golden Rule](#the-golden-rule-never-rewrite-pushed-commits) — never rewrite pushed history.

**🧠 Check yourself — Rewriting History.** Try these before peeking:

1. State the Golden Rule in your own words and explain *why* it exists (what actually breaks if you ignore it?).
2. Your branch has three commits on top of `main`: `Add login`, `Oops debug print`, `Add tests`. You want to land this as clean work on `main`. Which rewrite tool removes the middle commit without touching the other two, and what happens to the hashes?
3. A hotfix went in as commit `a3f2d9c` on the `release-2.x` branch. You need the same fix on `main`. You have two choices: `git merge release-2.x` or `git cherry-pick a3f2d9c`. Which do you pick, and why?
4. `git rebase` and `git merge --squash` both "clean up" history. Name one concrete situation where each is the right tool.

<details markdown="1">
<summary>Click to view answers</summary>

1. *Never rewrite commits that have already been pushed to a shared branch.* Rewrite operations produce **new commits with new SHAs** — the old ones look "the same" but aren't. Collaborators' clones still reference the old SHAs; their next pull sees a diverged branch, conflicts multiply, and patches can be duplicated or lost.
2. `git rebase -i HEAD~3` with the middle commit marked `drop`. The first commit keeps its hash (its parent didn't change); the *third* commit is replayed on top of the first, getting a new hash. Net: one old hash preserved, one new hash, the `Oops` commit gone.
3. **`git cherry-pick a3f2d9c`.** `git merge release-2.x` would drag *every* commit unique to `release-2.x` into `main`, not just the fix. Cherry-pick grabs exactly that one commit as a new commit on `main` (new hash, same changes) — surgical.
4. `git rebase main` before opening a PR on your feature branch — replays your commits on top of the latest base so the PR is clean and mergeable fast-forward. `git merge --squash feature` when landing a feature: you want `main`'s log to read as one commit per feature, not thirty `fix typo` commits.

</details>

# Branching Strategies

Once you can branch, merge, and open pull requests, the next question is: *how should the team organise branches?* Different answers emerge based on release cadence, team size, and tolerance for complexity. Three strategies cover most industry practice.

## Gitflow

**Gitflow** uses long-lived `main` and `develop` branches plus short-lived `feature/*`, `release/*`, and `hotfix/*` branches.

| Branch | Purpose | Lifetime |
|---|---|---|
| `main` | Production-ready code; tagged with release versions | Permanent |
| `develop` | Integration branch for unreleased work | Permanent |
| `feature/X` | New feature | Days–weeks |
| `release/X` | Stabilisation before a release | Days |
| `hotfix/X` | Urgent fix to production | Hours |

**Pros:** Clear roles; supports parallel releases and post-release hotfixes.
**Cons:** Heavy for small teams and fast-moving projects; long-lived branches invite merge-hell.
**Best for:** Versioned, shipped-to-customer software with slow release cadences.

## Trunk-Based Development

**Trunk-based development** keeps a single long-lived branch (`main` or `trunk`) and insists that feature branches live for hours, not days. Developers integrate multiple times a day. Unfinished work hides behind **feature flags** rather than on separate branches.

**Pros:** Minimal integration pain; small PRs; fast CI feedback.
**Cons:** Requires CI discipline; feature flags add complexity; riskier for regulated environments.
**Best for:** Continuous-deployment SaaS, high-velocity teams, modern web applications.

## Feature Branches with Pull Requests (GitHub Flow)

The middle ground, popular on GitHub: one long-lived `main` branch plus short-lived feature branches, each merged via a [pull request](#pull-requests-and-code-review) after review and CI. No `develop`, no `release/*`.

**Pros:** Simple model; aligns with the platform UX; supports PR review.
**Cons:** No built-in place for release stabilisation.
**Best for:** Most modern teams — this is the default for open-source and many internal projects.

## Choosing a Strategy

A rough decision tree:

- **Ship continuously to production, one version?** → Trunk-based or GitHub Flow.
- **Ship multiple versions in parallel to customers on different schedules?** → Gitflow.
- **Small team, no strong preference?** → GitHub Flow (least ceremony).

The single most important choice is *keeping feature branches short*. Regardless of strategy, branches that live for weeks accumulate merge conflicts and hide unfinished work from CI. Aim for *days*, not *weeks*.

**🧠 Check yourself — Branching Strategies.** Try these before peeking:

1. A startup ships a SaaS product to production several times a day from a single live version. Which strategy fits best, and what mechanism lets unfinished features live in `main` without shipping?
2. An enterprise product ships quarterly releases and simultaneously maintains v1.x, v2.x, and v3.x lines for different customers. Which strategy fits best, and why?
3. Regardless of strategy, *one* discipline matters more than the strategy choice itself. What is it, and why?

<details markdown="1">
<summary>Click to view answers</summary>

1. **Trunk-based development.** Integrate several times a day into a single `main`; hide unfinished features behind **feature flags** so code can ship while the feature is still "off" in production.
2. **Gitflow** — the combination of long-lived `main` (tagged with versions), `develop` (integration), and parallel `release/*` and `hotfix/*` branches is exactly what multi-version maintenance needs. The ceremony that feels heavy for a small SaaS team is load-bearing here.
3. **Keep feature branches short** — days, not weeks. Long-lived branches accumulate merge conflicts, hide unfinished work from CI, and defer integration pain to the worst possible moment.

</details>

# Submodules

For very large projects, **Git submodules** let you include another Git repository as a subdirectory while keeping its history independent. The superproject records two things for each submodule: a **pinned commit SHA** of the external repo, and a URL in a top-level `.gitmodules` file. Pulling always brings in the pinned revision, which makes submodule updates explicit rather than automatic.

<details markdown="1">
<summary><strong>🔧 Under the Hood: where the submodule's .git directory lives</strong> (optional — skip on first pass)</summary>

Each populated submodule directory contains a small `.git` **text file** (a "gitfile"), **not** a full `.git/` directory. The gitfile holds one line — e.g. `gitdir: ../../.git/modules/foo` — pointing at the submodule's actual git data (objects, refs, HEAD), which is stored inside the superproject at `.git/modules/<name>/`. This is why cloning the superproject is self-contained: every submodule's history is stored inside the parent repo's `.git/`.

The pin itself is stored in the superproject's tree as a **"gitlink"** entry — a tree entry with mode `160000` that points at a commit SHA instead of a blob SHA. That's the mechanism that makes the pin a first-class part of the commit's content.

</details>

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
      "description": "`git submodule add` clones the remote into `libs/foo` *and* writes a new top-level `.gitmodules` file recording the mapping. The submodule is pinned to the remote's current HEAD (shown as the annotation hash).\n\n**Where the submodule's git data actually lives:** its real `.git/` directory (objects, refs, HEAD) is stored inside the *superproject* at `.git/modules/foo/`. Inside `libs/foo/` there is only a small `.git` **text file** (a \"gitfile\") containing `gitdir: ../../.git/modules/foo`. This keeps every submodule's history inside the parent repo, which is why cloning the superproject is self-contained.",
      "state": {
        "tree": "myproject/\n  .git/\n    modules/\n      foo/ ← submodule's real .git directory\n  .gitmodules\n  libs/\n    foo/ ← submodule @ abc123\n      .git ← gitfile → ../../.git/modules/foo\n      README.md\n      src/\n        foo.js\n  src/\n    app.js"
      }
    },
    {
      "command": "git submodule add https://github.com/acme/libbar libs/bar",
      "description": "A second submodule. `.gitmodules` now records two mappings; both pinned folders are part of the superproject's working tree. Each submodule's real `.git/` is again stored inside the superproject's `.git/modules/<name>/`, and each working-tree directory holds just a thin `.git` gitfile pointing there.",
      "state": {
        "tree": "myproject/\n  .git/\n    modules/\n      bar/ ← submodule's real .git directory\n      foo/ ← submodule's real .git directory\n  .gitmodules\n  libs/\n    bar/ ← submodule @ 9f2e10\n      .git ← gitfile → ../../.git/modules/bar\n      README.md\n      src/\n        bar.js\n    foo/ ← submodule @ abc123\n      .git ← gitfile → ../../.git/modules/foo\n      README.md\n      src/\n        foo.js\n  src/\n    app.js"
      }
    },
    {
      "command": "git commit -m \"Add libfoo and libbar as submodules\"",
      "description": "The superproject commit records **three** things: the new `.gitmodules` file, the `libs/foo` pin, and the `libs/bar` pin (each stored as a tree entry with **mode 160000** \u2014 a *gitlink* pointing at a commit SHA). No files change; the commit metadata below is what Git prints.",
      "state": {
        "tree": "myproject/\n  .git/\n    modules/\n      bar/\n      foo/\n  .gitmodules\n  libs/\n    bar/ ← submodule @ 9f2e10\n      .git ← gitfile\n      README.md\n      src/\n        bar.js\n    foo/ ← submodule @ abc123\n      .git ← gitfile\n      README.md\n      src/\n        foo.js\n  src/\n    app.js",
        "output": "[main a1b2c3d] Add libfoo and libbar as submodules\n 3 files changed, 6 insertions(+)\n create mode 100644 .gitmodules\n create mode 160000 libs/bar\n create mode 160000 libs/foo"
      }
    },
    {
      "command": "git clone https://example.com/myproject.git cloned",
      "description": "On a fresh machine, a **plain** clone brings down `.gitmodules` but leaves the submodule directories *empty*. The pins exist in the superproject tree, but neither `.git/modules/<name>/` nor the submodule files have been fetched yet.",
      "state": {
        "tree": "cloned/\n  .git/\n  .gitmodules\n  libs/\n    bar/ ← empty — not initialised\n    foo/ ← empty — not initialised\n  src/\n    app.js"
      }
    },
    {
      "command": "git submodule init",
      "description": "`init` reads `.gitmodules` and registers each submodule's URL in `.git/config` (under a `[submodule \"libs/foo\"]` stanza). No `.git/modules/` is created and no files appear — it's a local bookkeeping step.",
      "state": {
        "tree": "cloned/\n  .git/\n  .gitmodules\n  libs/\n    bar/ ← empty — not initialised\n    foo/ ← empty — not initialised\n  src/\n    app.js",
        "output": "Submodule 'libs/bar' (https://github.com/acme/libbar) registered for path 'libs/bar'\nSubmodule 'libs/foo' (https://github.com/acme/libfoo) registered for path 'libs/foo'"
      }
    },
    {
      "command": "git submodule update",
      "description": "`update` fetches each registered submodule into `.git/modules/<name>/` and checks out the pinned commit into its working-tree directory. Each submodule directory now also contains a thin `.git` gitfile pointing back to the real `.git/` under `.git/modules/<name>/`.",
      "state": {
        "tree": "cloned/\n  .git/\n    modules/\n      bar/ ← fetched submodule .git\n      foo/ ← fetched submodule .git\n  .gitmodules\n  libs/\n    bar/ ← submodule @ 9f2e10\n      .git ← gitfile → ../../.git/modules/bar\n      README.md\n      src/\n        bar.js\n    foo/ ← submodule @ abc123\n      .git ← gitfile → ../../.git/modules/foo\n      README.md\n      src/\n        foo.js\n  src/\n    app.js"
      }
    },
    {
      "command": "git submodule update --remote libs/foo",
      "description": "`--remote` advances one submodule to the latest commit on its tracking branch. The annotation flips to a newer hash and the superproject is now dirty — you'd commit the updated pin next. Only the submodule's working tree and its `.git/modules/foo/` objects change; the gitfile and the directory layout stay the same.",
      "state": {
        "tree": "cloned/\n  .git/\n    modules/\n      bar/\n      foo/ ← new objects fetched\n  .gitmodules\n  libs/\n    bar/ ← submodule @ 9f2e10\n      .git ← gitfile\n      README.md\n      src/\n        bar.js\n    foo/ ← submodule @ de4f71\n      .git ← gitfile\n      CHANGELOG.md\n      README.md\n      src/\n        foo.js\n        helpers.js\n  src/\n    app.js"
      }
    },
    {
      "command": "git clone --recurse-submodules https://example.com/myproject.git sibling",
      "description": "The shortcut: clone + init + update in one go. A brand-new working copy comes down fully populated \u2014 including the `.git/modules/<name>/` store and the gitfiles inside each submodule directory. Use this whenever you know a repo uses submodules.",
      "state": {
        "tree": "sibling/\n  .git/\n    modules/\n      bar/\n      foo/\n  .gitmodules\n  libs/\n    bar/ ← submodule @ 9f2e10\n      .git ← gitfile\n      README.md\n      src/\n        bar.js\n    foo/ ← submodule @ abc123\n      .git ← gitfile\n      README.md\n      src/\n        foo.js\n  src/\n    app.js"
      }
    }
  ]
}
</script>
</div>

**🧠 Check yourself — Submodules.** Try these before peeking:

1. A submodule pins one specific thing about the external repo. What is it, and what does that mean for teammates who pull?
2. You clone a repo that uses submodules with plain `git clone`. The submodule directories exist but are empty. What one-command alternative would have populated them, and which two commands would you run after a plain clone to fix it?
3. Why use submodules over just copy-pasting the dependency's files into your repo?

<details markdown="1">
<summary>Click to view answers</summary>

1. A submodule pins **one commit SHA** of the external repo (plus a URL in `.gitmodules`). When teammates pull, they get the *same* commit you pinned — submodule updates are explicit: someone has to run `git submodule update --remote` and commit the new pin. That's the whole point of the mechanism.
2. `git clone --recurse-submodules <url>` would have handled everything in one go. From a plain clone, run `git submodule init` (registers URLs from `.gitmodules` into `.git/config`) and `git submodule update` (actually fetches and checks out the pinned commits).
3. Copy-pasting destroys history — you can't tell what upstream version you have, can't pull fixes, can't contribute back. Submodules preserve the independent history and make the version explicit and updatable.

</details>

# Investigating History

Once a project has accumulated history, reading it — and searching it — becomes its own skill. Four commands cover almost all investigation work.

## Viewing Commits (`git log`, `git show`)

`git log` shows the sequence of past commits. Useful flags:

- `-p` — show each commit's full patch (diff).
- `--oneline` — one commit per line (hash + subject).
- `--graph --all` — ASCII art graph across all branches and merges.
- `--stat` — per-file change summary (no full diff).
- `--grep="<pattern>"` — search commit messages.
- `-S"<string>"` — "pickaxe": find commits whose diff adds or removes `<string>`.
- `-- <path>` — limit to commits that touched `<path>`.

```bash
git log --oneline --graph --all   # the most useful overview
git log -p -- src/auth.py         # every change to one file, with diffs
git log --grep="rate limit"       # find "rate limit" in commit messages
git log -S"RateLimiter"           # find commits that added/removed the string "RateLimiter"
```

`git show <commit>` displays detailed information about a specific commit — the message, the author, the full diff. Pair it with `git blame` (below) to go from a suspicious line to the commit that wrote it:

```bash
git blame -L 42,42 src/auth.py   # who last touched line 42?
# copy the SHA, then:
git show <sha>                    # read the full context
```

## Tracing a Line's Origin (`git blame`)

`git blame <file>` annotates each line with the author, commit hash, and timestamp of the last person to modify it. Essential for understanding *why* a line exists before changing it:

```bash
git blame src/auth.py             # annotate every line
git blame -L 42,50 src/auth.py    # narrow to lines 42–50
git blame -w src/auth.py          # ignore whitespace-only changes (skip reformat commits)
```

**What blame doesn't see:** lines that *used to exist but were deleted*. For those — or for any behavioural regression where you don't yet know which line is at fault — use `git bisect`.

## Binary-Searching for Regressions (`git bisect`)

`git bisect` binary-searches through commit history to find the exact commit that introduced a bug. You mark known-good and known-bad commits, then Git checks out the midpoint repeatedly. With 1,000 commits in the range, it finds the culprit in at most **10 tests**.

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

**Automating bisect.** If your test script exits `0` on success and non-zero on failure, `git bisect run <script>` automates the whole search — Git runs the script at each candidate and uses the exit code to decide. Always end with `git bisect reset` — without it, HEAD stays on the last-checked historical commit, which is a confusing state to leave behind.

**🧠 Check yourself — Investigating History.** Try these before peeking:

1. You want to find every commit that mentions "rate limit" in its message, and — separately — every commit whose diff added or removed the string `RateLimiter`. Which `git log` flags?
2. A line in `src/auth.py` looks wrong. Which command tells you who last touched it, and which command do you then run to see the full context of that change?
3. A regression slipped in between release `v1.2.0` (known good) and `HEAD` (known bad). The range covers 256 commits. At most how many tests does `git bisect` need to find the culprit, and why?
4. Your bug is caused by a line that *used to exist* and was *deleted*. Why won't `git blame` find it, and what tool would you use instead?

<details markdown="1">
<summary>Click to view answers</summary>

1. `git log --grep="rate limit"` searches commit messages. `git log -S"RateLimiter"` (the *pickaxe*) searches commit diffs for additions or removals of that string.
2. `git blame <file>` (or `git blame -L 42,42 <file>` to narrow by line). Copy the SHA it prints, then `git show <sha>` to see the full diff and message.
3. **At most 8 tests.** `git bisect` is binary search: each test halves the remaining range, so 256 commits → log₂(256) = 8 iterations worst case. Even 1,000 commits needs only ~10.
4. `git blame` only annotates lines that **currently exist** — deleted lines aren't there to annotate. Use `git bisect` (find the commit that introduced the regression) or `git log -S"<removed string>"` (find commits that removed that exact string from the diff).

</details>

# Undoing Committed Work

Mistakes reach your history eventually — a buggy commit, an accidental merge, an embarrassing message. Git provides two opposing tools for undoing committed work, plus a safety net that makes both survivable.

### Why do we need two ways to "undo" a commit?

Because there are two genuinely different situations, and they call for opposite strategies:

- **The commit is only in your local repo** (you haven't pushed). You can just rewind the branch pointer — the commit becomes unreachable, garbage-collected later, and nobody else ever saw it. This is what `git reset` does.
- **The commit has been pushed** and teammates have it. You can't safely erase it — their clones still reference it, and trying to rewrite shared history makes every pull a conflict. The only safe undo is to add *another* commit that inverts the change. This is what `git revert` does.

The rule of thumb: **`reset` for private mistakes, `revert` for public mistakes.** The rest of this section unpacks both.

## Reverting a Commit (`git revert`)

> ✅ **Additive.** Safe on shared branches — preserves history exactly.

`git revert <sha>` creates a **new commit** whose changes are the exact inverse of the target commit. The original commit stays in history; the revert commit cancels its effect. Because no existing commits are modified, revert is safe even on branches that teammates have already pulled.

<div data-git-command-lab>
<script type="application/json">
{
  "command": "git revert HEAD",
  "description": "**Additive operation \u2014 safe on shared branches.** Instead of rewriting history, `revert` **appends** a new commit **R** whose changes exactly undo those of the target commit.\n\nThe original commit (C) still exists and is still reachable \u2014 history now records both the bug being introduced *and* it being reverted.\n\nBecause no existing hashes change, teammates who already pulled the buggy commit see the revert commit as a normal follow-up. This is the **only safe way** to undo a commit that has already been pushed.",
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

## Resetting a Branch (`git reset`)

> ⚠️ **Rewrites history.** Only safe on local, unpushed commits.

`git reset <sha>` moves the current branch pointer to `<sha>`, effectively **discarding** every commit between the old tip and `<sha>`. Those commits become unreachable from any branch and are eventually garbage-collected (though [reflog](#the-safety-net-git-reflog) can recover them within the retention window).

Three modes determine what happens to the working tree and staging area:

| Mode | Branch pointer | Staging area | Working tree | Use this when… |
|---|---|---|---|---|
| `--soft` | moves to target | **preserved** | preserved | You want to un-commit but keep everything staged — to re-commit with a better message, or to split the commit into smaller pieces. |
| `--mixed` (default) | moves to target | reset to target | preserved | You want to un-commit *and* un-stage, keeping your edits as plain working-tree changes to re-organise. |
| `--hard` | moves to target | reset to target | **overwritten** | You want the commit *and* its changes gone — a full wipe back to the target. Your uncommitted work is destroyed. |

Most common uses:

- `git reset --soft HEAD~1` — "un-commit" the last commit while keeping the changes staged (perfect for re-committing with a better message or splitting into smaller commits).
- `git reset HEAD~1` — un-commit and un-stage (changes stay as unstaged edits).
- `git reset --hard HEAD~1` — discard the commit *and* the changes entirely.

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

## Choosing: `reset` vs. `revert`

| Situation | Use |
|---|---|
| Mistake is on a **local, unpushed** branch | `git reset` (any mode) |
| Mistake has been **pushed** to a shared branch | `git revert` — always |
| You want to preserve history as an audit trail | `git revert` |
| You want to erase an embarrassing experiment (local only) | `git reset --hard` |

Force-pushing a rewritten shared branch after `git reset` is how teams accidentally destroy each other's work. See the [Force-Push Warning](#the-force-push-warning).

## Detached HEAD

`HEAD` normally points at a branch (e.g. `ref: refs/heads/main`). If you point `HEAD` directly at a commit — `git switch --detach <sha>`, checking out a tag, or mid-bisect — you are in **detached HEAD** state. No branch is "following" your commits.

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

**Why it matters:** any commits you make while detached are only reachable through `HEAD`. The moment you `git switch` to another branch, your new commits have no branch pointer anchoring them — they are *orphaned*. Git will garbage-collect them after the reflog retention window expires.

**The fix is always the same:** before leaving detached HEAD, create a branch to anchor any new work:

```bash
git switch -c my-experiment
```

## The Safety Net: `git reflog`

<details markdown="1">
<summary><strong>🔧 Under the Hood: why "deleted" commits are recoverable</strong> (optional — skip on first pass)</summary>

When you `git reset --hard HEAD~1` or drop a commit in an interactive rebase, the "removed" commit objects don't vanish from your repo. They become **unreachable** — no branch, tag, or `HEAD` position points at them. Git's garbage collector (`git gc`, which runs automatically on a schedule) eventually deletes unreachable objects.

But "eventually" has a grace period: unreachable objects are kept for roughly **90 days** by default, and every move of `HEAD` is additionally logged in the **reflog** (`.git/logs/HEAD`). That's what makes `git reflog` the universal undo — as long as the object is still in the database and the reflog still remembers the SHA, you can create a new branch pointing at it and recover the work. Commits are forgiving because immutability plus a retention window means nothing *really* disappears for a long time.

</details>

Every time `HEAD` moves — commit, checkout, reset, rebase, merge, cherry-pick, stash — Git records the movement in the **reflog**, a per-repository diary of HEAD's positions. The reflog is local, never pushed, and kept for ~90 days by default (`gc.reflogExpire` / `gc.reflogExpireUnreachable`).

```bash
$ git reflog
a3f2d9c HEAD@{0}: reset: moving to HEAD~2
b7e1c4d HEAD@{1}: commit: Add login validation
c9a2f3e HEAD@{2}: checkout: moving from main to feat-login
...
```

Each entry is `<sha> HEAD@{n}: <operation>: <description>`. The `@{n}` syntax is **reflog-relative** — `HEAD@{1}` means "where HEAD was one move ago," `HEAD@{2}` two moves ago, and so on.

**The universal recovery recipe** — for *any* destructive operation (rebase drop, hard reset, detached-HEAD orphan, merge gone wrong):

1. Run `git reflog` and find the SHA of the state you want to return to.
2. Create a branch anchoring that SHA:

```bash
git branch rescued-work <sha>
# or, if you want to reset your current branch instead:
git reset --hard <sha>
```

That's the whole pattern. Every "oh no, I lost my commits" question on Stack Overflow resolves to these two steps, as long as the reflog still has the entry and `git gc` hasn't pruned the unreachable objects.

> **Why this works.** Commits are immutable and SHAs are content-addressed. A "deleted" commit isn't deleted — it's *unreferenced*. As long as some reference (a branch, a tag, or the reflog) still mentions its SHA, the object is safe. The reflog is therefore the universal bookmark, surviving even when every branch pointer has moved away.

The reflog is one of the deepest reasons Git is forgiving: destructive commands look scary, but they are almost always recoverable for weeks after the fact.

**🧠 Check yourself — Undoing Committed Work.** Try these before peeking:

1. A buggy commit has been *pushed* to `main` and several teammates have already pulled it. Should you `git reset --hard` or `git revert`? Why?
2. For `git reset`, rank the three modes by how much state they destroy (least to most): `--soft`, `--mixed`, `--hard`.
3. You do `git switch --detach <sha>`, make two commits, then `git switch main` without creating a branch. Your new commits appear to be "gone." Are they really deleted? What's the recovery recipe?
4. State the universal recovery recipe for "I lost my commit" in two steps.

<details markdown="1">
<summary>Click to view answers</summary>

1. **`git revert`.** `reset --hard` rewrites history — collaborators' clones still reference the old SHAs; if you force-pushed a reset-ed branch, their next pull breaks badly. `revert` creates a new commit whose changes cancel out the buggy one, so history is preserved exactly — the only safe undo on shared history.
2. `--soft` (moves the branch pointer, keeps staging *and* working tree) < `--mixed` (also resets staging, keeps working tree) < `--hard` (resets staging *and* overwrites working tree — uncommitted changes lost).
3. **Not deleted — just unreferenced.** No branch points at them. They live in the object database for ~90 days and in the reflog for the same window. `git reflog` shows HEAD's history; find the SHA and run `git branch rescued <sha>`.
4. (1) `git reflog` — find the SHA of the state you want back. (2) `git branch <name> <sha>` (or `git reset --hard <sha>` on your current branch). That's the whole pattern.

</details>

# Choosing the Right Tool

Return-readers come to this page with a specific intent: *"I want to do X, which Git command?"* This table is that index.

| You want to… | Reach for… | Section |
|---|---|---|
| Make your changes part of the project's history | `git add` then `git commit` | [Making Commits](#making-commits) |
| Discard your uncommitted edits to one file | `git restore <file>` | [Managing Uncommitted Changes](#managing-uncommitted-changes) |
| Un-stage a file you accidentally added | `git restore --staged <file>` | [Managing Uncommitted Changes](#managing-uncommitted-changes) |
| Temporarily save your work for later | `git stash` / `git stash pop` | [Managing Uncommitted Changes](#managing-uncommitted-changes) |
| Fix a typo in your most recent commit (local only) | `git commit --amend` ⚠️ | [Making Commits](#making-commits) |
| Start a new line of work | `git switch -c <branch>` | [Branching](#branching) |
| Bring a feature branch into `main` | `git merge <branch>` | [Merging Branches](#merging) |
| Land a feature as a single clean commit on `main` | `git merge --squash <branch>` ⚠️ | [Merging Branches](#merging) |
| Preview what an incoming merge would change | `git fetch` then `git diff main..origin/main` | [Collaborating with Remotes](#remotes) |
| Copy one specific commit from another branch | `git cherry-pick <sha>` | [Reshaping History](#rewriting-history) |
| Clean up messy WIP commits before opening a PR | `git rebase -i <base>` ⚠️ | [Reshaping History](#rewriting-history) |
| Rebase your feature branch onto the latest `main` | `git rebase main` ⚠️ | [Reshaping History](#rewriting-history) |
| Mark a commit as release v1.0.0 | `git tag -a v1.0.0 -m "..."` then `git push --tags` | [Tagging Releases](#tagging-releases) |
| Undo a commit that's already been pushed | `git revert <sha>` | [Undoing Committed Work](#undoing-committed-work) |
| Delete commits on your local (unpushed) branch | `git reset --hard <sha>` ⚠️ | [Undoing Committed Work](#undoing-committed-work) |
| Find which commit introduced a bug | `git bisect start` + `git bisect run <test>` | [Investigating History](#investigating-history) |
| Find who last changed line 42 of a file | `git blame -L 42,42 <file>` then `git show <sha>` | [Investigating History](#investigating-history) |
| Recover a commit that looks "lost" | `git reflog` + `git branch <name> <sha>` | [Undoing Committed Work](#undoing-committed-work) |
| See the history graph across all branches | `git log --oneline --graph --all` | [Investigating History](#investigating-history) |
| Upload your branch for a PR | `git push -u origin <branch>` | [Collaborating with Remotes](#remotes) |
| Get teammates' changes without merging yet | `git fetch` | [Collaborating with Remotes](#remotes) |
| Get and integrate teammates' changes | `git pull` (or `git pull --rebase`) | [Collaborating with Remotes](#remotes) |
| Include another repo as a pinned dependency | `git submodule add <url> <path>` | [Submodules](#submodules) |

**Legend:** ⚠️ = rewrites history; never run on commits that have been pushed to a shared branch.

# Best Practices

A condensed checklist. Each item links back to its full section.

* **Write meaningful [commit messages](#writing-good-commit-messages).** Imperative mood, ≤50-character subject, blank line, wrapped body explaining *why*.
* **Commit small and often.** Prefer many coherent commits over one giant "everything" update.
* **Create [`.gitignore`](#ignoring-files-gitignore) before your first commit.** It has no retroactive effect on tracked files. Commit `.gitignore` itself so the team shares the rules.
* **Never commit secrets.** `.gitignore` is not a security tool — if a secret is ever committed, rotate it immediately and scrub history.
* **Never [force-push](#the-force-push-warning) on shared branches.** `git push -f` can permanently delete your collaborators' work. Use `--force-with-lease` only on branches only *you* work on.
* **Prefer [`revert`](#reverting-a-commit-git-revert) over [`reset`](#resetting-a-branch-git-reset) for shared history.** `reset --hard` destroys commits; `revert` preserves history.
* **Follow the [golden rule of shared history](#the-golden-rule-never-rewrite-pushed-commits).** Never rewrite pushed commits — use `revert` instead.
* **Pull frequently.** Regularly pull the latest changes from `main` to catch merge conflicts while they are small.
* **Prefer `git switch` and `git restore` over `git checkout`.** The `checkout` command is overloaded — it does both branch navigation *and* file restoration. The split replacements (introduced in Git 2.23) make intent clearer. `git checkout` is still fully supported for backward compatibility.
* **Review [branching strategy](#branching-strategies) with your team.** Short-lived branches beat long-lived ones every time, regardless of which strategy you pick.
* **Let `git reflog` be your safety net.** Destructive operations are almost always recoverable within ~90 days. Don't panic, reflog first.

# Quiz

## Basic Git
{% include flashcards.html id="git_basic" %}

{% include quiz.html id="git_basic" %}

## Advanced Git
{% include flashcards.html id="git_advanced" %}

{% include quiz.html id="git_advanced" %}
