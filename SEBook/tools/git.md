---
title: Version Control with Git 
layout: sebook
---

> **Want to practice?** Try the [Interactive Git Tutorial](/SEBook/tools/git-tutorial.html) — hands-on exercises in a real Linux system right in the browser!

In modern software construction, version control is not just a convenience—it is a foundational practice, solving several major challenges associated with managing code. 
Git is by far the most common tool for version control. 
Let's dive into both!

# Basics 

## What is Version Control?

**Version control** (also known as source control or revision control) is the software engineering practice of controlling, organizing, and tracking different versions in the history of computer files. While it works best with text-based source code, it can theoretically track any file type.

We call a tool that supports version control a **Version Control System (VCS)**.
The most common version control systems are:
* **[Git](https://git-scm.com/)** (most common for open source systems, also used by Microsoft, Apple, and most other companies)
* **[Mercurial](https://www.mercurial-scm.org/)** (used by Meta, formerly Facebook {% cite goode2014scaling %}, Jane Street, and some others)
* **Piper** (internal tool used by Google {% cite Potvin2016 %})
* **Subversion** (used by some older projects)

### Why is it Essential?
Manual version control—saving files with names like `Homework_final_v2_really_final.txt`—is cumbersome and error-prone. Automated systems like Git solve several critical problems:
* **Collaboration**: Multiple developers can work concurrently on the same project without overwriting each other's changes.
* **Change Tracking**: Developers can see exactly what has changed since they last worked on a file.
* **Traceability**: It provides a summary of every modification: who made it, when it happened, and why.
* **Reversion/Rollback**: If a bug is introduced, you can easily revert to a known stable version.
* **Parallel Development**: Branching allows for the isolated development of new features or bug fixes without affecting the main codebase.


## Centralized vs. Distributed Version Control

There are two primary models of version control systems:

| Feature | Centralized (e.g., Subversion, Piper) | Distributed (e.g., Git, Mercurial) |
| :--- | :--- | :--- |
| **Data Storage** | Data is stored in a single central repository. | Each developer has a full copy of the entire repository history. |
| **Offline Work** | Requires a connection to the central server to make changes. | Developers can work and commit changes locally while offline. |
| **Best For** | Small teams requiring strict centralized control. | Large teams, open-source projects, and distributed workflows. |


## The Git Architecture: The Three States

To understand Git, you must understand where your files live at any given time. Git operates across three main "states" or areas:

1.  **Working Directory (or Working Tree)**: This is where you currently edit your files. It contains the files as they exist on your disk.
2.  **Staging Area (or Index)**: This is a middle ground where you "stage" changes you want to include in your next snapshot.
3.  **Local Repository**: This is where Git stores the compressed snapshots (commits) of your project's history.



## Fundamental Git Workflow

A typical Git workflow follows these steps:
1.  **Initialize**: Turn a directory into a Git repo using `git init`.
2.  **Stage**: Add file contents to the staging area with `git add <filename>`.
3.  **Commit**: Record the snapshot of the staged changes with `git commit -m "message"`.
4.  **Check Status**: Use `git status` to see which files are modified, staged, or untracked.
5.  **Review History**: Use `git log` to see the sequence of past commits.

### Inspecting Differences
`git diff` is used to compare different versions of your code:
* **`git diff`**: Compares the working directory to the staging area.
* **`git diff HEAD`**: Compares the working directory to the latest commit.
* **`git diff HEAD^ HEAD`**: Compares the parent commit to the latest commit (shows what the latest commit changed).


## Branching and Merging

A **branch** in Git is like a pointer to a commit (implemented as a lightweight, 41-byte text file stored in `.git/refs/heads/` that contains the SHA checksum of the commit it currently points to). Creating or destroying a branch is nearly instantaneous — Git writes or deletes a tiny reference, not a copy of your project. The **HEAD** pointer (stored in `.git/HEAD`) normally holds a symbolic reference to the current branch, such as `ref: refs/heads/main`.

### Integrating Changes
When you want to bring changes from a feature branch back into the main codebase, Git typically uses one of two automatic merge strategies:

* **Fast-Forward Merge**: When the target branch (`main`) has received no new commits since the feature branch was created, Git simply advances the `main` pointer to the tip of the feature branch. No merge commit is created; the history stays perfectly linear.
* **Three-Way Merge**: When both branches have diverged — each has commits the other doesn't — Git compares both tips against their common ancestor and creates a new **merge commit** with two parents. The commit graph forms a diamond shape where the two diverging paths converge.

### Alternative Integration Workflows
For more control over your project's history, you can use these manual techniques:

* **Rebasing**: Re-applies commits from one branch onto a new base, producing new commit objects with new SHA hashes. Creates a linear history but must **never** be used on shared branches, as it rewrites history that collaborators may already have.
* **Squashing**: `git merge --squash` collapses all commits from a feature branch into a single commit on the target branch, keeping the main history tidy.

### Complications
* **Merge Conflict**: Happens when Git cannot automatically reconcile differences — usually when the same lines of code were changed in both branches.
* **Detached HEAD**: Occurs when HEAD points directly to a commit hash rather than a branch reference — for example, when using `git switch --detach <commit>` to inspect an older version of the codebase. New commits made in this state are not anchored to any branch and can easily be lost when switching away. To preserve work from a detached HEAD, create a new branch with `git switch -c <name>` before switching elsewhere.


## Advanced Power Tools

Git includes several advanced commands for debugging and project management:
* **`git stash`**: Temporarily saves local changes (staged and unstaged) so you can switch branches without committing messy or incomplete work.
* **`git cherry-pick`**: Selectively applies a specific commit from one branch onto another.
* **`git bisect`**: Uses a binary search through your commit history to find the exact commit that introduced a bug.
* **`git blame`**: Annotates each line of a file with the name of the author and the commit hash of the last person to modify it.
* **`git revert`**: Safely "undoes" a previous commit by creating a *new* commit with the inverse changes, preserving the original history.

## Managing Large Projects: Submodules

For very large projects, **Git Submodules** allow you to keep one Git repository as a subdirectory of another. This is ideal for including external libraries or shared modules while maintaining their independent history. Internally, a submodule is represented as a file pointing to a specific commit ID in the external repo.


## Best Practices for Professional Use

* **Write Meaningful Commit Messages**: Messages should explain *what* was changed and *why*. Avoid vague messages like "bugfix" or "small changes".
* **Commit Small and Often**: Aim for small, coherent commits rather than massive, "everything" updates.
* **Never Force-Push (`git push -f`) on Shared Branches**: Force-pushing overwrites the remote history to match your local copy, permanently deleting any commits your collaborators have already pushed.
* **Use `git revert` to Undo Shared History**: When a bad commit has already been pushed, use `git revert <hash>` to create a new "anti-commit" that safely inverts the change while preserving the full history. Never use `git reset --hard` on shared branches — it rewrites history and breaks every collaborator's local copy.
* **Use `.gitignore`**: Always include a `.gitignore` file to prevent tracking unnecessary or sensitive files, such as build artifacts or private keys.
* **Pull Frequently**: Regularly pull the latest changes from the main branch to catch merge conflicts early.

# Git Command Manual

Common Git commands can be categorized into several functional groups, ranging from basic setup to advanced debugging and collaboration.

## Configuration and Initialization
Before working with Git, you must establish your identity and initialize your project.
* **`git config`**: Used to set global or repository-specific settings. Common configurations include setting your username, email, and preferred text editor.
* **`git init`**: Initializes a new, empty Git repository in your current directory, allowing Git to begin tracking files.

## The Core Workflow (Local Changes)
These commands manage the lifecycle of your changes across the three Git states: the working directory, the staging area (index), and the repository history.
* **`git add`**: Adds file contents to the staging area to be included in the next commit.
* **`git status`**: Provides an overview of which files are currently modified, staged for the next commit, or untracked by Git.
* **`git commit`**: Records a snapshot of all changes currently in the staging area and saves it as a new version in the local repository's history. Professional practice encourages writing meaningful commit messages to help team members understand the "what" and "why" of changes.
* **`git log`**: Displays the sequence of past commits. Using `git log -p` allows you to see the actual changes (patches) introduced in each commit.
* **`git diff`**: Compares different versions of your project:
    * `git diff`: Compares the working directory to the staging area.
    * `git diff HEAD`: Compares the working directory to the latest commit.
    * `git diff HEAD^ HEAD`: Compares the parent commit to the latest commit (shows what the latest commit changed).
* **`git restore`** *(Git 2.23+)*: The modern command for undoing file changes, replacing the file-restoration uses of the older `git checkout` and `git reset`:
    * `git restore --staged <file>`: **Unstages** a file, moving it out of the staging area while leaving working directory modifications untouched.
    * `git restore <file>`: **Discards** all uncommitted changes to a file in the working directory, restoring it to its last staged or committed state. This is irreversible — uncommitted changes will be permanently lost.

## Branching and Merging
Branching allows for parallel development, such as working on a new feature without affecting the main codebase.
* **`git branch`**: Lists, creates, or deletes branches. A branch is a lightweight pointer (a 41-byte file in `.git/refs/heads/`) to a specific commit.
* **`git switch`** *(recommended, Git 2.23+)*: The modern, dedicated command for navigating branches.
    * `git switch <branch>`: Switches to an existing branch.
    * `git switch -c <new-branch>`: Creates a new branch and immediately switches to it.
    * `git switch --detach <commit>`: Checks out an arbitrary commit in detached HEAD state for safely inspecting older code without affecting any branch.
* **`git checkout`** *(legacy)*: The older multi-purpose command that handled both branch switching and file restoration. Still widely encountered in documentation and scripts. `git checkout <branch>` is equivalent to `git switch <branch>`; `git checkout -b <name>` is equivalent to `git switch -c <name>`.
* **`git merge`**: Integrates changes from one branch into another.
    * **`git merge --squash`**: Combines all commits from a feature branch into a single commit on the target branch to maintain a cleaner history.
* **`git rebase`**: Re-applies commits from one branch onto a new base. This is often used to create a linear history, though it must never be used on shared branches.


## Remote Operations
These commands facilitate collaboration by syncing your local work with a remote server (like GitHub).
* **`git clone`**: Creates a local copy of an existing remote repository.
* **`git pull`**: Fetches changes from a remote repository and immediately merges them into your current local branch.
* **`git push`**: Uploads your local commits to a remote repository. **Note**: Never use `git push -f` (force-push) on shared branches, as it can overwrite and destroy work pushed by other team members.

## Advanced and Debugging Tools
Git includes powerful utilities for handling complex scenarios and tracking down bugs.
* **`git stash` / `git stash pop`**: Temporarily saves uncommitted changes (both staged and unstaged) so you can switch contexts without making a messy commit. Use `pop` to re-apply those changes later.
* **`git cherry-pick`**: Selectively applies a single specific commit from one branch onto another.
* **`git bisect`**: Uses a binary search through commit history to find the exact commit that introduced a bug.
* **`git blame`**: Annotates each line of a file with the author and commit ID of the last person to modify it.
* **`git revert <commit>`**: Creates a new "anti-commit" that applies the exact inverse changes of a previous commit, safely undoing it without rewriting history. Prefer this over `git reset` whenever the commit to undo has already been pushed to a shared branch.
* **`git show`**: Displays detailed information about a specific Git object, such as a commit.
* **`git submodule`**: Allows you to include an external Git repository as a subdirectory of your project while maintaining its independent history.

# Quiz

{% include flashcards.html id="git" %}

{% include quiz.html id="git" %}