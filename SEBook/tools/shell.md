---
title: Shell Scripting - Automating the Command Line
layout: sebook
---

<script src="/js/ArchUML/uml-bundle.js"></script>
<script src="/js/fs-command-lab.js"></script>
<script src="/js/unix-command-lab.js"></script>

<link rel="stylesheet" href="/css/fs-command-lab.css">
<link rel="stylesheet" href="/css/unix-command-lab.css">

> **Start here:** If you are new to shell scripting, begin with the [Interactive Shell Scripting Tutorial](/SEBook/tools/shell-tutorial.html) — hands-on exercises in a real Linux system. This article is a **reference** to deepen your understanding afterward.

If you have ever found yourself performing the same repetitive tasks on your computer—renaming batches of files, searching through massive text logs, or configuring system environments—then shell scripting is the magic wand you need. Shell scripting is the bedrock of system administration, software development workflows, and server management.

In this detailed educational article, we will explore the concepts, syntax, and power of shell scripting, specifically focusing on the most ubiquitous UNIX shell: Bash.
 
# Basics 
## What is the Shell?

To understand shell scripting, you first need to understand the "shell".

An operating system (like Linux, macOS, or Windows) acts as a middleman between the physical hardware of your computer and the software applications you want to run. It abstracts away the complex details of the hardware so developers can write functional software.

The **kernel** is the core of the operating system that interacts directly with the hardware. The **shell**, on the other hand, is a command-line interface (CLI) that serves as the primary gateway for users to interact with a computer's operating system. While many modern users are accustomed to graphical user interfaces (GUIs), the shell is a program that specifically takes text-based user commands and passes them to the operating system to execute. In the context of this course, mastering the shell is like becoming a "wizard" who can construct and manipulate complex software systems simply by typing words.

### Motivation: Why the Shell is Essential
As a software engineer, you need to be familiar with the ecosystem of tools that help you build software efficiently. The **Linux ecosystem** offers a vast array of specialized tools that allow you to write programs faster and debug log files by combining small, powerful commands. Understanding the shell increases your productivity in a professional environment and provides a foundation for learning other domain-specific scripting languages. Furthermore, the shell allows you to program **directly on the operating system** without the overhead of additional interpreters or heavy libraries.

## The Unix Philosophy
The shell's power is rooted in the **Unix philosophy**, which dictates:
1. Write programs that do one thing and do it well.
2. Write programs to work together.
3. Write programs to handle text streams, because that is a universal interface.

By treating data as a sequence of characters or bytes—similar to a **conveyor belt** rather than a truck—the shell allows parallel processing and the composition of complex behaviors from simple parts.

 

## Essential UNIX Commands

Before writing scripts, you need to know the fundamental commands that you will be stringing together. These are the building blocks of any UNIX environment.

### 1. File Handling
These are the foundational tools for interacting with the POSIX filesystem:
* **`ls`**: List directory contents (files and other directories).
* **`cd`**: Change the current working directory (e.g., use `..` to move to a parent folder).
* **`pwd`**: Print the name of the current/working directory so you don't get lost.
* **`mkdir`**: Create a new directory.
* **`cp`**: Copy files. Use `-r` (recursive) to copy a directory and its contents.
* **`mv`**: Move or rename files and directories.
* **`rm`**: Remove (delete) files. Use `-r` to remove a directory and its contents recursively.
* **`rmdir`**: Remove empty directories (only works on empty ones).
* **`touch`**: Create an empty file or update timestamps.

Play each card to see the command's effect; click again to undo. The descriptions call out the flags you'll reach for most often.

#### `ls` — list directory contents

<div data-fs-command-lab>
<script type="application/json">
{
  "command": "ls -la",
  "description": "Lists directory contents. **`-l`** switches to the long format (permissions, owner, size, mtime). **`-a`** includes hidden entries — anything starting with `.`. **`-h`** prints sizes as `1.2K` / `4.3M` instead of raw bytes. Plain `ls` gives you just the visible names.",
  "before": {
    "tree": "project/\n  .env\n  README.md\n  src/\n    app.js",
    "cwd": "project"
  },
  "after": {
    "tree": "project/\n  .env\n  README.md\n  src/\n    app.js",
    "cwd": "project",
    "output": "total 16\ndrwxr-xr-x  4 user user  128 Apr 18 09:10 .\ndrwxr-xr-x  3 user user   96 Apr 18 09:00 ..\n-rw-------  1 user user   42 Apr 18 09:05 .env\n-rw-r--r--  1 user user  980 Apr 18 09:08 README.md\ndrwxr-xr-x  3 user user   96 Apr 18 09:10 src"
  }
}
</script>
</div>

#### `cd` — change working directory

<div data-fs-command-lab>
<script type="application/json">
{
  "command": "cd src",
  "description": "Changes the current working directory. A relative name like `src` is resolved from the cwd. **`..`** goes up to the parent. **`~`** jumps to your home directory. **`-`** (a single dash) returns to the previous cwd. The change only affects the current shell session — subshells don't inherit it.",
  "before": {
    "tree": "project/\n  README.md\n  src/\n    app.js\n    utils.js",
    "cwd": "project"
  },
  "after": {
    "tree": "project/\n  README.md\n  src/\n    app.js\n    utils.js",
    "cwd": "project/src"
  }
}
</script>
</div>

#### `pwd` — print current path

<div data-fs-command-lab>
<script type="application/json">
{
  "command": "pwd",
  "description": "Prints the absolute path of the current working directory. **`-L`** (the default) keeps symlink names in the path as-is. **`-P`** resolves symlinks to the real, physical path. Useful to sanity-check *where* you are before running destructive commands.",
  "before": {
    "tree": "project/\n  README.md\n  src/\n    app.js",
    "cwd": "project/src"
  },
  "after": {
    "tree": "project/\n  README.md\n  src/\n    app.js",
    "cwd": "project/src",
    "output": "/home/user/project/src"
  }
}
</script>
</div>

#### `mkdir` — create a directory

<div data-fs-command-lab>
<script type="application/json">
{
  "command": "mkdir -p docs/api",
  "description": "Creates a new directory. **`-p`** creates any missing parents *and* stays silent if the directory already exists — the safe, idempotent form used in scripts. **`-m 755`** sets the permission mode at creation time. Without `-p`, every parent must already exist or `mkdir` errors out.",
  "before": {
    "tree": "project/\n  README.md\n  src/\n    app.js",
    "cwd": "project"
  },
  "after": {
    "tree": "project/\n  README.md\n  docs/\n    api/\n  src/\n    app.js",
    "cwd": "project"
  }
}
</script>
</div>

#### `mkdir` without `-p` — missing parent

<div data-fs-command-lab>
<script type="application/json">
{
  "command": "mkdir docs/api",
  "description": "Without **`-p`**, every parent must already exist. Here `docs/` has not been created yet, so `mkdir` refuses to create `docs/api` — it errors out and the filesystem is unchanged. The fix is `mkdir -p docs/api` or first running `mkdir docs`.",
  "before": {
    "tree": "project/\n  README.md\n  src/\n    app.js",
    "cwd": "project"
  },
  "after": {
    "tree": "project/\n  README.md\n  src/\n    app.js",
    "cwd": "project",
    "output": "mkdir: cannot create directory 'docs/api': No such file or directory",
    "exit": 1
  }
}
</script>
</div>

#### `cp` — copy files and directories

<div data-fs-command-lab>
<script type="application/json">
{
  "command": "cp -r src/ backup/",
  "description": "Copies a file or directory. **`-r`** (or `-R`) is mandatory for directories — it recursively copies everything inside. **`-i`** prompts before overwriting an existing destination. **`-n`** never overwrites. **`-v`** prints every copied path. The source is preserved; this is duplication, not a move.",
  "before": {
    "tree": "project/\n  README.md\n  src/\n    app.js\n    utils.js",
    "cwd": "project"
  },
  "after": {
    "tree": "project/\n  README.md\n  backup/\n    app.js\n    utils.js\n  src/\n    app.js\n    utils.js",
    "cwd": "project"
  }
}
</script>
</div>

#### `cp` without `-r` — directory requires the flag

<div data-fs-command-lab>
<script type="application/json">
{
  "command": "cp src/ backup/",
  "description": "**`-r`** is mandatory when the source is a directory. Without it, `cp` refuses to copy `src/` and prints an error — the filesystem is left unchanged. Add `-r` (or `-R`) to copy the directory and all its contents.",
  "before": {
    "tree": "project/\n  README.md\n  src/\n    app.js\n    utils.js",
    "cwd": "project"
  },
  "after": {
    "tree": "project/\n  README.md\n  src/\n    app.js\n    utils.js",
    "cwd": "project",
    "output": "cp: -r not specified; omitting directory 'src/'",
    "exit": 1
  }
}
</script>
</div>

#### `mv` — move or rename

<div data-fs-command-lab>
<script type="application/json">
{
  "command": "mv notes.txt archive/",
  "description": "Moves or renames. If the destination is an existing directory (like `archive/`), the source is moved *into* it. If the destination is a new name, the source is renamed. **`-i`** prompts before overwriting; **`-n`** refuses to overwrite. Unlike `cp`, no `-r` is needed — `mv` handles directories natively.",
  "before": {
    "tree": "project/\n  README.md\n  notes.txt\n  archive/",
    "cwd": "project"
  },
  "after": {
    "tree": "project/\n  README.md\n  archive/\n    notes.txt",
    "cwd": "project"
  }
}
</script>
</div>

#### `rm` — remove files and directories

<div data-fs-command-lab>
<script type="application/json">
{
  "command": "rm -rf tmp/",
  "description": "Removes files. **`-r`** recurses into directories and deletes their contents. **`-f`** forces removal: no prompts, no errors for missing files. **`-i`** is the opposite — prompts for every file (safest). There is **no trash can**: once `rm` finishes, the files are gone. Double-check your path before pressing Enter.",
  "before": {
    "tree": "project/\n  README.md\n  src/\n    app.js\n  tmp/\n    cache.db\n    logs/\n      build.log",
    "cwd": "project"
  },
  "after": {
    "tree": "project/\n  README.md\n  src/\n    app.js",
    "cwd": "project"
  }
}
</script>
</div>

#### `rmdir` — remove an empty directory

<div data-fs-command-lab>
<script type="application/json">
{
  "command": "rmdir build/",
  "description": "Removes *only empty* directories. If `build/` still contains files or subdirectories, `rmdir` refuses and errors out — far safer than `rm -r` when you just want to clean up a leftover empty folder. **`-p`** also removes parent directories that become empty as a side-effect.",
  "before": {
    "tree": "project/\n  README.md\n  build/\n  src/\n    app.js",
    "cwd": "project"
  },
  "after": {
    "tree": "project/\n  README.md\n  src/\n    app.js",
    "cwd": "project"
  }
}
</script>
</div>

#### `rmdir` on a non-empty directory

<div data-fs-command-lab>
<script type="application/json">
{
  "command": "rmdir src/",
  "description": "`rmdir` only removes *empty* directories. `src/` still contains `app.js`, so the command refuses and prints an error — the filesystem is left unchanged. Use `rm -r src/` to remove a directory and all its contents.",
  "before": {
    "tree": "project/\n  README.md\n  src/\n    app.js",
    "cwd": "project"
  },
  "after": {
    "tree": "project/\n  README.md\n  src/\n    app.js",
    "cwd": "project",
    "output": "rmdir: failed to remove 'src/': Directory not empty",
    "exit": 1
  }
}
</script>
</div>

#### `touch` — create an empty file / bump timestamps

<div data-fs-command-lab>
<script type="application/json">
{
  "command": "touch .env",
  "description": "Creates an empty file if it doesn't exist, or updates the access/modification timestamps of an existing file. **`-a`** updates only the access time; **`-m`** only the modification time. **`-d \"2024-01-01\"`** (or **`-t`**) sets a specific timestamp — useful for reproducible builds and tricking `make` into re-running a target.",
  "before": {
    "tree": "project/\n  README.md\n  src/\n    app.js",
    "cwd": "project"
  },
  "after": {
    "tree": "project/\n  .env\n  README.md\n  src/\n    app.js",
    "cwd": "project"
  }
}
</script>
</div>

#### Walkthrough: file handling in action

Step through a realistic session to see each command's effect on the directory tree. New or changed rows get a yellow burst; the `(you are here)` marker tracks the current working directory.

<div data-fs-command-lab-multi>
<script type="application/json">
{
  "description": "Start in an empty `project/` directory. Each step runs one command; the tree and `ls` output update to match what you would see in a real shell.",
  "initialState": {
    "tree": "project/\n  README.md\n  src/\n    app.js\n    utils.js",
    "cwd": "project"
  },
  "steps": [
    {
      "command": "pwd",
      "description": "`pwd` prints the current working directory. The filesystem doesn't change — the output below the tree is what the shell would print.",
      "state": {
        "tree": "project/\n  README.md\n  src/\n    app.js\n    utils.js",
        "cwd": "project",
        "output": "/home/user/project"
      }
    },
    {
      "command": "ls",
      "description": "`ls` lists the contents of the cwd. Still no tree changes — the interesting result is stdout.",
      "state": {
        "tree": "project/\n  README.md\n  src/\n    app.js\n    utils.js",
        "cwd": "project",
        "output": "README.md  src"
      }
    },
    {
      "command": "mkdir docs",
      "description": "`mkdir` creates a new directory relative to cwd. `docs/` appears as a sibling of `src/`.",
      "state": {
        "tree": "project/\n  README.md\n  docs/\n  src/\n    app.js\n    utils.js",
        "cwd": "project"
      }
    },
    {
      "command": "touch docs/readme.md",
      "description": "`touch` creates an empty file (or updates an existing one's mtime). The new file appears inside `docs/`.",
      "state": {
        "tree": "project/\n  README.md\n  docs/\n    readme.md\n  src/\n    app.js\n    utils.js",
        "cwd": "project"
      }
    },
    {
      "command": "cd src",
      "description": "`cd` moves the cwd. The tree is identical — only the `(you are here)` marker shifts to `src/`.",
      "state": {
        "tree": "project/\n  README.md\n  docs/\n    readme.md\n  src/\n    app.js\n    utils.js",
        "cwd": "project/src"
      }
    },
    {
      "command": "ls",
      "description": "Running `ls` now lists the contents of `src/` (the new cwd).",
      "state": {
        "tree": "project/\n  README.md\n  docs/\n    readme.md\n  src/\n    app.js\n    utils.js",
        "cwd": "project/src",
        "output": "app.js  utils.js"
      }
    },
    {
      "command": "cp app.js backup.js",
      "description": "`cp` copies a file. The source (`app.js`) stays; a new sibling (`backup.js`) appears in the same directory.",
      "state": {
        "tree": "project/\n  README.md\n  docs/\n    readme.md\n  src/\n    app.js\n    backup.js\n    utils.js",
        "cwd": "project/src"
      }
    },
    {
      "command": "mv backup.js ../docs/backup.js",
      "description": "`mv` moves (or renames) a file. The source disappears from `src/` and reappears under `docs/` — a single conceptual operation, shown as a simultaneous removal and arrival.",
      "state": {
        "tree": "project/\n  README.md\n  docs/\n    backup.js\n    readme.md\n  src/\n    app.js\n    utils.js",
        "cwd": "project/src"
      }
    },
    {
      "command": "cd ..",
      "description": "`..` refers to the parent directory. The cwd marker jumps back up to `project/`.",
      "state": {
        "tree": "project/\n  README.md\n  docs/\n    backup.js\n    readme.md\n  src/\n    app.js\n    utils.js",
        "cwd": "project"
      }
    },
    {
      "command": "rm -r docs",
      "description": "`rm -r` removes a directory *and everything it contains* recursively. Use with care — there is no trash bin in a POSIX shell.",
      "state": {
        "tree": "project/\n  README.md\n  src/\n    app.js\n    utils.js",
        "cwd": "project"
      }
    }
  ]
}
</script>
</div>

### 2. Text Processing and Data Manipulation
Unix treats text streams as a universal interface, and these tools allow you to transform that data:
* **`cat`**: Concatenate and print files to standard output.
* **`grep`**: Search for patterns using regular expressions.
* **`sed`**: Stream editor for filtering and transforming text (commonly search-and-replace).
* **`tr`**: Translate or delete characters (e.g., changing case or removing digits).
* **`sort`**: Sort lines of text files alphabetically; add `-n` for numeric order, `-r` to reverse.
* **`uniq`**: Filter adjacent duplicate lines; the `-c` flag prefixes each line with its occurrence count. Because it only compares *consecutive* lines, you almost always pipe `sort` first so that duplicates are adjacent.
* **`wc`**: Word count (lines, words, characters).
* **`cut`**: Extract specific sections/fields from lines.
* **`comm`**: Compare two sorted files line by line.
* **`head` / `tail`**: Output the first or last part of files.
* **`awk`**: Advanced pattern scanning and processing language.

These commands do not modify the filesystem tree — they transform **streams of text**. The lab cards below make that visible: inputs flow in from the left (stdin + any referenced files), the command transforms them, and outputs emerge on the right (stdout + stderr + exit status). For a few cards you will be asked to **predict the output before running it** — that one small act of committing a guess is worth far more than reading the answer cold.

#### `cat` — print a single file

<div data-unix-command-lab>
<script type="application/json">
{
  "command": "cat notes.txt",
  "description": "`cat` reads one or more files and prints them to **stdout**. Given a single file argument it just dumps the contents. With no arguments at all, `cat` reads from stdin — which is why `cat` on its own looks like it \"hangs\" waiting for input.",
  "input": {
    "files": [
      { "name": "notes.txt", "content": "milk\neggs\nbread" }
    ]
  },
  "output": {
    "stdout": "milk\neggs\nbread",
    "exit": 0
  }
}
</script>
</div>

#### `cat` — what the name actually means: con**cat**enate

<div data-unix-command-lab>
<script type="application/json">
{
  "command": "cat intro.txt chapter1.txt outro.txt > book.txt",
  "description": "Given **multiple file arguments**, `cat` prints them back-to-back in the order you listed them — literal concatenation. Combined with `>` redirection, this is a common way to stitch fragments together into a single file. The source files are never modified.",
  "predict": true,
  "predictPrompt": "Three fragments are listed in order. What will `book.txt` contain after running this? Write out your expected output by cooping lines from the intput. Then run the command to check your answer.",
  "input": {
    "files": [
      { "name": "intro.txt",    "content": "== Preface ==\nWelcome.\n" },
      { "name": "chapter1.txt", "content": "== Chapter 1 ==\nIt was a dark and stormy night.\n" },
      { "name": "outro.txt",    "content": "== The End ==\n" }
    ]
  },
  "output": {
    "stdout": "",
    "files": [
      { "name": "book.txt", "content": "== Preface ==\nWelcome.\n== Chapter 1 ==\nIt was a dark and stormy night.\n== The End ==\n", "action": "create" }
    ],
    "exit": 0
  },
  "notice": "Nothing reaches the terminal — the redirection sent every byte into `book.txt`. The files join **exactly** as-is: if a source file doesn't end in a newline, the next file's first line continues on the same line."
}
</script>
</div>

#### Common mistake — *useless use of `cat`*

<div data-unix-command-lab>
<script type="application/json">
{
  "command": "cat log.txt | grep ERROR",
  "description": "This works, but there's no reason to spawn `cat` just to feed a single file into `grep`. `grep` can open the file itself: `grep ERROR log.txt`. Beginners reach for `cat | grep` because it feels like \"the shell way\" — but it hides what's really feeding the pipeline. The idiomatic form is below.",
  "input": {
    "files": [
      { "name": "log.txt", "content": "08:00 INFO start\n08:01 ERROR disk full\n08:02 INFO retry\n08:03 ERROR timeout" }
    ]
  },
  "output": {
    "stdout": "08:01 ERROR disk full\n08:03 ERROR timeout",
    "exit": 0
  },
  "notice": "Prefer `grep ERROR log.txt` — same result, one fewer process, and the stdin panel stays empty (no one is piping anything in)."
}
</script>
</div>

#### `grep` — search for lines matching a pattern

<div data-unix-command-lab>
<script type="application/json">
{
  "command": "grep ERROR log.txt",
  "description": "`grep` prints each line of the file (or stdin) that matches the given pattern. Lines that don't match are silently dropped. The exit code is `0` if at least one match was found, `1` if nothing matched, and `2` on error.",
  "predict": true,
  "predictPrompt": "Before running: which lines from log.txt do you expect to see on stdout? Write them out by coping lines from the input. Then run the command to check your answer.",
  "input": {
    "files": [
      { "name": "log.txt", "content": "08:00 INFO  start\n08:01 ERROR disk full\n08:02 INFO  retry\n08:03 ERROR timeout\n08:04 INFO  done" }
    ]
  },
  "output": {
    "stdout": "08:01 ERROR disk full\n08:03 ERROR timeout",
    "exit": 0
  }
}
</script>
</div>

#### Common mistake — *regex metacharacters in an unquoted pattern*

<div data-unix-command-lab>
<script type="application/json">
{
  "command": "grep a.b names.txt",
  "description": "The student wants lines containing the literal string `a.b`. But `.` is a regex metacharacter meaning \"any **single** character\" — so the pattern matches `aab`, `axb`, `a3b`, etc. Use `grep -F 'a.b'` for a fixed (literal) string, or escape the dot with `grep 'a\\.b'`.",
  "predict": true,
  "predictPrompt": "Which lines of `names.txt` will `grep a.b` print? Remember `.` matches *exactly one* character — not a dot, and not a run.",
  "input": {
    "files": [
      { "name": "names.txt", "content": "alice\naab\naxb\na3b\naab-extra\naleph.bet\nfoobar" }
    ]
  },
  "output": {
    "stdout": "aab\naxb\na3b\naab-extra",
    "exit": 0
  },
  "notice": "`aab`, `axb`, `a3b`, and `aab-extra` all contain an `a` followed by a *single* character followed by `b`. **`aleph.bet` does NOT match** — between the `a` and the `b` there are five characters (`leph.`), and `.` in the regex only stands in for one. Quote patterns (`grep 'a\\.b'`) or use `-F` for fixed strings to avoid accidental regex matches."
}
</script>
</div>

#### `grep` — no match is not the same as error (exit code `1`)

<div data-unix-command-lab>
<script type="application/json">
{
  "command": "grep WARN log.txt",
  "description": "Sometimes students see a command \"produce nothing\" and assume it broke. `grep` *deliberately* exits with status **1** when it doesn't find any matches — that's not an error, it's a usable signal. Scripts branch on it: `if grep -q ERROR log.txt; then alert; fi`. Watch the exit badge carefully: the command succeeded in doing its job, it just found nothing.",
  "input": {
    "files": [
      { "name": "log.txt", "content": "08:00 INFO  start\n08:01 INFO  retry\n08:02 INFO  done\n" }
    ]
  },
  "output": {
    "stdout": "",
    "exit": 1
  },
  "notice": "Exit **1** from `grep` means *no match* — the file was read successfully, the pattern was valid, there were simply no matching lines. Exit **2** would mean a *real* error like a missing file (you'll see that exit code in the Error Handling section). Always distinguish 1 from 2 before treating nonzero as failure."
}
</script>
</div>

#### `sed` — stream editor (search and replace)

<div data-unix-command-lab>
<script type="application/json">
{
  "command": "sed 's/ERROR/FAIL/' log.txt",
  "description": "`sed` applies an editing script to each line of its input. `s/ERROR/FAIL/` replaces the **first** occurrence of `ERROR` on each line with `FAIL`. Add a trailing `g` (`s/ERROR/FAIL/g`) to replace **all** occurrences on each line. The original file is **not** modified — `sed` writes the transformed stream to stdout. Use `-i` for in-place editing.",
  "predict": true,
  "predictPrompt": "What does stdout look like after `s/ERROR/FAIL/` runs on every line of `log.txt`?",
  "input": {
    "files": [
      { "name": "log.txt", "content": "08:01 ERROR disk full\n08:03 ERROR timeout" }
    ]
  },
  "output": {
    "stdout": "08:01 FAIL disk full\n08:03 FAIL timeout",
    "exit": 0
  }
}
</script>
</div>

#### Common mistake — *single quotes block variable expansion in `sed`*

<div data-unix-command-lab>
<script type="application/json">
{
  "command": "sed 's/$user/guest/' log.txt",
  "description": "The student has `user=\"alice\"` in their shell and expects `sed` to substitute `alice` for `guest`. But **single quotes** prevent the shell from expanding `$user` — `sed` literally searches for the four characters `$user`. Since no line contains `$user`, nothing is replaced. Use double quotes (`sed \"s/$user/guest/\"`) when you need variable expansion.",
  "predict": true,
  "predictPrompt": "`$user` is `alice` in the shell environment. What do you think stdout will show — and how many lines get replaced?",
  "input": {
    "env": [
      { "name": "user", "value": "alice" }
    ],
    "files": [
      { "name": "log.txt", "content": "alice logged in\nbob logged in\nalice logged out" }
    ]
  },
  "output": {
    "stdout": "alice logged in\nbob logged in\nalice logged out",
    "exit": 0
  },
  "notice": "The output is identical to the input — `sed` found nothing to replace because it was literally hunting for `$user`, not `alice`."
}
</script>
</div>

#### `tr` — translate or delete characters

<div data-unix-command-lab>
<script type="application/json">
{
  "command": "tr 'a-z' 'A-Z'",
  "description": "`tr` reads from **stdin** only (never a file — pipe or redirect into it) and translates characters one-for-one. Here every lowercase letter becomes uppercase. `tr -d 'aeiou'` would *delete* the listed characters instead of translating them. `tr -s ' '` squeezes runs of spaces into one.",
  "input": {
    "stdin": "Hello, Ada Lovelace!"
  },
  "output": {
    "stdout": "HELLO, ADA LOVELACE!",
    "exit": 0
  }
}
</script>
</div>

#### `sort` — sort lines

<div data-unix-command-lab>
<script type="application/json">
{
  "command": "sort names.txt",
  "description": "Sorts its input alphabetically, line by line. Add **`-n`** for numeric order (otherwise `10` sorts before `2`), **`-r`** to reverse, **`-u`** to also drop duplicates. Works on stdin if no file argument is given.",
  "predict": true,
  "predictPrompt": "Write the lines of `names.txt` in the order `sort` will print them.",
  "input": {
    "files": [
      { "name": "names.txt", "content": "charlie\nalice\nbob\nalice" }
    ]
  },
  "output": {
    "stdout": "alice\nalice\nbob\ncharlie",
    "exit": 0
  }
}
</script>
</div>

#### `uniq` — filter *adjacent* duplicate lines

<div data-unix-command-lab>
<script type="application/json">
{
  "command": "uniq names.txt",
  "description": "`uniq` collapses duplicate lines — but it's a streaming tool that keeps exactly **one line of memory**. That means it only notices duplicates when they appear *next to each other* in the input.",
  "predict": true,
  "predictPrompt": "`names.txt` contains four names, with `alice` appearing twice (but not in consecutive lines). How many lines will `uniq` print, and which ones? Write the exact output you expect here. Then run the command.",
  "input": {
    "files": [
      { "name": "names.txt", "content": "charlie\nalice\nbob\nalice" }
    ]
  },
  "output": {
    "stdout": "charlie\nalice\nbob\nalice",
    "exit": 0
  },
  "notice": "All four lines still appear — the two `alice`s are not adjacent, so `uniq` treats them as distinct. `uniq` is a one-line-lookahead filter, not a set operation. The fix is in the next card."
}
</script>
</div>

#### The fix — *`sort | uniq` puts duplicates next to each other*

<div data-unix-command-lab>
<script type="application/json">
{
  "command": "sort names.txt | uniq",
  "description": "Pipe through `sort` first so identical lines become **adjacent** — now `uniq` can see them and collapse them. The `sort | uniq` idiom is so common that `sort -u names.txt` is shorthand for exactly this pipeline. With `-c`, `uniq` also prefixes each line with its occurrence count (great for frequency tables).",
  "input": {
    "files": [
      { "name": "names.txt", "content": "charlie\nalice\nbob\nalice" }
    ]
  },
  "output": {
    "stdout": "alice\nbob\ncharlie",
    "exit": 0
  },
  "notice": "The two `alice` lines collapsed to one because sorting made them adjacent. `sort -u names.txt` would give the same result in one command."
}
</script>
</div>

#### `wc` — word / line / character count

<div data-unix-command-lab>
<script type="application/json">
{
  "command": "wc -l log.txt",
  "description": "Counts **lines, words, and characters** by default. **`-l`** shows just the line count, **`-w`** the word count, **`-c`** the byte count. Pedantic detail: `wc -l` counts **newline characters** — a file whose last line has no trailing newline reports one fewer line than you might expect.",
  "predict": true,
  "predictPrompt": "How many lines does `log.txt` have? (Including the format — `wc -l` prints the number *and* the filename.)",
  "input": {
    "files": [
      { "name": "log.txt", "content": "08:00 INFO  start\n08:01 ERROR disk full\n08:02 INFO  retry\n08:03 ERROR timeout\n08:04 INFO  done\n" }
    ]
  },
  "output": {
    "stdout": "5 log.txt",
    "exit": 0
  }
}
</script>
</div>

#### `cut` — extract columns from each line

<div data-unix-command-lab>
<script type="application/json">
{
  "command": "cut -d: -f1 /etc/passwd",
  "description": "Splits each line on the delimiter given by **`-d`** and prints the field(s) chosen by **`-f`**. Here `-d:` splits on colons and `-f1` prints the first field — the usernames from the password file. `-f1,3` would print fields 1 and 3; `-f1-3` prints fields 1 through 3.",
  "predict": true,
  "predictPrompt": "Given the file below, what will stdout contain? Write your prediction. Then run the command to check your answer.",
  "input": {
    "files": [
      { "name": "/etc/passwd", "content": "root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nalice:x:1000:1000:Alice:/home/alice:/bin/bash" }
    ]
  },
  "output": {
    "stdout": "root\ndaemon\nalice",
    "exit": 0
  }
}
</script>
</div>

#### Common mistake — *`cut -d ' '` on whitespace-separated data*

<div data-unix-command-lab>
<script type="application/json">
{
  "command": "cut -d ' ' -f 2 log.txt",
  "description": "The student wants the second \"column\" of a space-separated log file. But `cut` treats **every single space** as a delimiter. When fields are separated by *runs* of spaces, there are empty fields between them — so `-f 2` is the empty string for most lines. Use `awk '{print $2}'` instead: awk collapses runs of whitespace by default.",
  "predict": true,
  "predictPrompt": "The student expects `INFO`, `ERROR`, `INFO` — one level per line. Do you agree, or will something else happen? Write your prediction.",
  "input": {
    "files": [
      { "name": "log.txt", "content": "08:00  INFO  start\n08:01  ERROR disk\n08:02  INFO  retry" }
    ]
  },
  "output": {
    "stdout": "\n\n",
    "exit": 0
  },
  "notice": "Three empty lines — field 2 for each line was the empty string between the first and second spaces. `awk '{print $2}'` would have printed `INFO`, `ERROR`, `INFO`."
}
</script>
</div>

#### `comm` — compare two sorted files

<div data-unix-command-lab>
<script type="application/json">
{
  "command": "comm a.txt b.txt",
  "description": "Compares two **sorted** files line by line and prints three columns: lines unique to the first file, lines unique to the second file, lines in both. Use flags to suppress columns: `-1` hides column 1, `-12` hides both unique columns (leaving only common lines). The files must be sorted; otherwise the output is meaningless.",
  "input": {
    "files": [
      { "name": "a.txt", "content": "alice\nbob\ncharlie" },
      { "name": "b.txt", "content": "alice\ndave\ncharlie" }
    ]
  },
  "output": {
    "stdout": "\t\talice\n\tbob\n\t\tcharlie\n\tdave",
    "exit": 0
  },
  "notice": "Tabs separate the columns. `bob` is only in `a.txt`; `dave` is only in `b.txt`; `alice` and `charlie` are in both."
}
</script>
</div>

#### `head` — print the first N lines

<div data-unix-command-lab>
<script type="application/json">
{
  "command": "head -n 3 log.txt",
  "description": "Prints the first **N** lines of each input (default 10). **`-n 3`** gives just the first three. Pair it with `tail` to grab a slice out of the middle of a file: `head -n 20 file | tail -n 5` yields lines 16–20.",
  "input": {
    "files": [
      { "name": "log.txt", "content": "08:00 INFO  start\n08:01 ERROR disk full\n08:02 INFO  retry\n08:03 ERROR timeout\n08:04 INFO  done" }
    ]
  },
  "output": {
    "stdout": "08:00 INFO  start\n08:01 ERROR disk full\n08:02 INFO  retry",
    "exit": 0
  }
}
</script>
</div>

#### `tail` — print the last N lines

<div data-unix-command-lab>
<script type="application/json">
{
  "command": "tail -n 2 log.txt",
  "description": "Prints the last **N** lines (default 10). **`-f`** follows the file as new lines are appended (the canonical way to watch a live log). **`tail -n +K`** prints from line K onward, which is the other way to stream a file-tail.",
  "input": {
    "files": [
      { "name": "log.txt", "content": "08:00 INFO  start\n08:01 ERROR disk full\n08:02 INFO  retry\n08:03 ERROR timeout\n08:04 INFO  done" }
    ]
  },
  "output": {
    "stdout": "08:03 ERROR timeout\n08:04 INFO  done",
    "exit": 0
  }
}
</script>
</div>

#### `awk` — field-aware text processing

<div data-unix-command-lab>
<script type="application/json">
{
  "command": "awk '{print $2, $1}' names.txt",
  "description": "`awk` runs its program once per input line. `$1`, `$2`, … are the whitespace-separated fields (collapsing runs of whitespace by default, unlike `cut -d ' '`). This program swaps field order and prints them separated by a space. **`-F:`** changes the field separator.",
  "predict": true,
  "predictPrompt": "`{print $2, $1}` prints the second field, then the first, on every line. What does stdout look like?",
  "input": {
    "files": [
      { "name": "names.txt", "content": "alice Lovelace\nada King\ngrace Hopper" }
    ]
  },
  "output": {
    "stdout": "Lovelace alice\nKing ada\nHopper grace",
    "exit": 0
  }
}
</script>
</div>

### 3. Permissions, Environment, and Documentation
These tools manage how your shell operates and how you access information:
* **`man`**: Access the manual pages for other commands. This is arguably the most useful command, providing built-in documentation for every other command in the system.
* **`chmod`**: Change file mode bits (permissions). Files in a Unix-like system have three primary types of permissions: **read (r), write (w), and execute (x)**. For security reasons, the system requires an explicit **execute permission** because you do not want to accidentally run a file from an unknown source. Permissions are often read in "bits" for the owner (u), group (g), and others (o).
* **`which` / `type`**: Locate the binary or type for a command.
* **`export`**: Set environment variables. The **`PATH`** variable is especially important; it tells the shell which directories to search for executable programs. You can temporarily update it using `export` or make it permanent by adding the command to your `~/.bashrc` or `~/.profile` file.
* **`source` / `.`**: Execute commands from a file in the current shell environment.

#### `chmod` — add execute permission

<div data-unix-command-lab>
<script type="application/json">
{
  "command": "chmod +x deploy.sh",
  "description": "`chmod +x` grants execute permission so the shell will actually *run* the file when you type `./deploy.sh`. `+x` sets the bit for **everyone** (owner, group, others); `u+x` sets it only for the owner. Without an execute bit, the shell rejects the file with `Permission denied`.",
  "input": {
    "files": [
      { "name": "deploy.sh", "content": "#!/bin/bash\necho \"deploying…\"", "hint": "mode before: -rw-r--r--  (644)" }
    ]
  },
  "output": {
    "files": [
      { "name": "deploy.sh", "content": "#!/bin/bash\necho \"deploying…\"", "before": "#!/bin/bash\necho \"deploying…\"", "action": "modify", "hint": "mode after: -rwxr-xr-x  (755)" }
    ],
    "exit": 0
  },
  "notice": "Content unchanged, permissions changed. `chmod` only flips permission bits; it doesn't touch the file's bytes."
}
</script>
</div>

#### Common mistake — *running a script without `chmod +x` (exit code `126`)*

<div data-unix-command-lab>
<script type="application/json">
{
  "command": "./deploy.sh",
  "description": "A classic \"it should work\" moment: the script exists, the contents are correct, but you never ran `chmod +x` on it. The shell finds the file but refuses to execute it, returning exit code **126** — a POSIX-specific code meaning \"command found but not executable\". Distinct from 127 (command not found entirely).",
  "input": {
    "files": [
      { "name": "deploy.sh", "content": "#!/bin/bash\necho \"deploying…\"", "hint": "mode: -rw-r--r--  (644 — no execute bit)" }
    ]
  },
  "output": {
    "stderr": "bash: ./deploy.sh: Permission denied",
    "exit": 126
  },
  "notice": "Exit **126** is your cue that the file is there but not marked executable. Fix: `chmod +x deploy.sh`. This code is distinct from **127** (shell couldn't find the file at all) — the distinction matters when a CI job fails and you need to know which one it was."
}
</script>
</div>

#### Common mistake — *`chmod 777` as a security shortcut*

<div data-unix-command-lab>
<script type="application/json">
{
  "command": "chmod 777 secrets.txt",
  "description": "`777` grants **read, write, and execute to everyone** on the system. Students reach for it when they see \"Permission denied\" and want to make the problem go away — but on a shared or networked machine this is an open invitation for any other user or process to read and modify the file. The right answer is almost never `777`. Use `644` for regular files, `755` for executables and directories, `600` for secrets.",
  "input": {
    "files": [
      { "name": "secrets.txt", "content": "API_TOKEN=sk-abc123", "hint": "mode before: -rw-------  (600)" }
    ]
  },
  "output": {
    "files": [
      { "name": "secrets.txt", "content": "API_TOKEN=sk-abc123", "before": "API_TOKEN=sk-abc123", "action": "modify", "hint": "mode after: -rwxrwxrwx  (777)" }
    ],
    "exit": 0
  },
  "notice": "Every user on the machine can now read your API token and overwrite the file. For a secrets file you want `chmod 600`."
}
</script>
</div>

#### `which` — locate a command's binary

<div data-unix-command-lab>
<script type="application/json">
{
  "command": "which python3",
  "description": "`which` searches `$PATH` for the named command and prints the **full path** of the first match. Use it to confirm *which* copy of a tool you're actually running when multiple versions exist. For shell builtins and aliases use `type -a` instead — `which` only finds on-disk binaries.",
  "input": {
    "env": [
      { "name": "PATH", "value": "/home/alice/.local/bin:/usr/local/bin:/usr/bin:/bin" }
    ]
  },
  "output": {
    "stdout": "/usr/local/bin/python3",
    "exit": 0
  }
}
</script>
</div>

#### Common mistake — *command not found (exit code `127`)*

<div data-unix-command-lab>
<script type="application/json">
{
  "command": "gti status",
  "description": "Every developer has fat-fingered this one. The shell scans every directory in `$PATH` for `gti`, doesn't find it (the student meant `git`), and bails with exit code **127** — the universal \"command not found\" signal. Scripts use the same exit code to detect \"an expected tool isn't installed\" and fall back or fail loudly.",
  "input": {
    "env": [
      { "name": "PATH", "value": "/usr/local/bin:/usr/bin:/bin" }
    ]
  },
  "output": {
    "stderr": "bash: gti: command not found",
    "exit": 127
  },
  "notice": "Exit **127** always means \"the shell couldn't locate any file by that name in `$PATH`\" — distinct from exit **126** (file found, but not executable). A robust script tests before it calls: `command -v git >/dev/null || { echo \"git is required\" >&2; exit 127; }`."
}
</script>
</div>

#### `export` — set an environment variable for child processes

<div data-unix-command-lab>
<script type="application/json">
{
  "command": "export PATH=$PATH:/opt/tools/bin",
  "description": "`export` makes a variable visible to **child processes** — scripts and programs you launch. Setting `VAR=value` without `export` only makes the variable visible to the current shell. Here we append `/opt/tools/bin` to `$PATH` so the shell finds binaries in that directory. The change lasts until you close this shell; put it in `~/.bashrc` to make it permanent.",
  "input": {
    "env": [
      { "name": "PATH", "value": "/usr/local/bin:/usr/bin:/bin" }
    ]
  },
  "output": {
    "env": [
      { "name": "PATH", "value": "/usr/local/bin:/usr/bin:/bin:/opt/tools/bin", "action": "modified" }
    ],
    "exit": 0
  }
}
</script>
</div>

#### `source` — run a script in the *current* shell

<div data-unix-command-lab>
<script type="application/json">
{
  "command": "source env.sh",
  "description": "`source env.sh` (or `. env.sh`) runs the script's commands **in the current shell**, so any variable assignments it makes persist. If you had instead run `./env.sh`, the script would run in a child shell and its assignments would disappear the moment it exits. This is how tools like `nvm`, `pyenv`, and virtualenvs activate themselves.",
  "input": {
    "files": [
      { "name": "env.sh", "content": "export API_URL=https://api.example.com\nexport DEBUG=1" }
    ],
    "env": [
      { "name": "API_URL", "value": "(unset)" }
    ]
  },
  "output": {
    "env": [
      { "name": "API_URL", "value": "https://api.example.com", "action": "set" },
      { "name": "DEBUG", "value": "1", "action": "set" }
    ],
    "exit": 0
  },
  "notice": "Run the same file with `./env.sh` and the `API_URL` variable would be gone the moment the child shell exits — the parent shell's environment would be unchanged."
}
</script>
</div>

### 4. System, Networking, and Build Tools
Tools used for remote work, debugging, and automating the construction process:
* **`ssh`**: Secure shell to connect to remote machines like SEASnet.
* **`scp`**: Securely copy files between hosts.
* **`wget` / `curl`**: Download files or data from the internet.
* **`make`**: Build automation tool that uses shell-like syntax to manage the incremental build process of complex software, ensuring that only changed files are recompiled.
* **`gcc` / `clang`**: C/C++ compilers.
* **`tar`**: Manipulate tape archives (compressing/decompressing).

 

## The Power of I/O Redirection and Piping

The true power of the shell comes from connecting commands. Every shell program typically has three standard stream ports:
1.  **Standard Input (`stdin` / `0`)**: Usually the keyboard.
2.  **Standard Output (`stdout` / `1`)**: Usually the terminal screen.
3.  **Standard Error (`stderr` / `2`)**: Where error messages go, also usually the terminal.



### Redirection
You can redirect these streams using special operators:
* `>`: Redirects `stdout` to a file, overwriting it. (e.g., `echo "Hello" > file.txt`)
* `>>`: Redirects `stdout` to a file, appending to it without overwriting.
* `<`: Redirects `stdin` from a file. (e.g., `cat < input.txt`)
* `2>`: Redirects `stderr` to a specific file to specifically log errors.
* `2>&1`: Redirects `stderr` to the standard output stream. **Note**: order matters — `command > file.txt 2>&1` sends both streams to the file, whereas `command 2>&1 > file.txt` only redirects stdout to the file while stderr still goes to the terminal.

#### `>` — redirect stdout to a file (overwrite)

<div data-unix-command-lab>
<script type="application/json">
{
  "command": "echo hello > greeting.txt",
  "description": "`>` captures the command's **stdout** and writes it to `greeting.txt`, **overwriting** whatever was there. The shell opens the destination file *before* the command runs, which is why `>` always truncates the target. Note: nothing appears on stdout in the terminal anymore — it all went to the file.",
  "input": {
    "files": [
      { "name": "greeting.txt", "content": "old contents" }
    ]
  },
  "output": {
    "stdout": "",
    "files": [
      { "name": "greeting.txt", "content": "hello\n", "before": "old contents", "action": "overwrite" }
    ],
    "exit": 0
  },
  "notice": "Stdout in the terminal is **empty** — the bytes didn't vanish, they ended up in the file."
}
</script>
</div>

#### Common mistake — *`>` silently clobbers existing data*

<div data-unix-command-lab>
<script type="application/json">
{
  "command": "sort data.txt > data.txt",
  "description": "The student wants to sort a file in place. But the shell opens `data.txt` for writing (truncating it) **before** `sort` runs — so `sort` reads an empty file, produces no output, and `data.txt` is now empty. This is one of the most painful shell beginners-traps; many hours of work have been lost this way. Use an intermediate file: `sort data.txt > sorted.tmp && mv sorted.tmp data.txt` — or `sort -o data.txt data.txt` (sort has a safe in-place mode).",
  "predict": true,
  "predictPrompt": "Before running: what do you think `data.txt` will contain afterwards — the sorted content, or something else?",
  "input": {
    "files": [
      { "name": "data.txt", "content": "charlie\nalice\nbob" }
    ]
  },
  "output": {
    "stdout": "",
    "files": [
      { "name": "data.txt", "content": "", "before": "charlie\nalice\nbob", "action": "overwrite" }
    ],
    "exit": 0
  },
  "notice": "`data.txt` is now **empty**. The shell truncated it to open it for writing, then `sort` read zero bytes and wrote zero bytes back."
}
</script>
</div>

#### `>>` — redirect stdout and *append*

<div data-unix-command-lab>
<script type="application/json">
{
  "command": "echo \"new entry\" >> log.txt",
  "description": "`>>` appends stdout to the file rather than truncating it. Always the right choice for log files or any destination whose existing content you care about. `>` would delete everything previously in `log.txt`.",
  "input": {
    "files": [
      { "name": "log.txt", "content": "08:00 start\n08:01 ready" }
    ]
  },
  "output": {
    "stdout": "",
    "files": [
      { "name": "log.txt", "content": "new entry\n", "before": "08:00 start\n08:01 ready", "action": "append" }
    ],
    "exit": 0
  }
}
</script>
</div>

#### `2>` — redirect stderr to a separate file

<div data-unix-command-lab>
<script type="application/json">
{
  "command": "grep ERROR log.txt 2> errors.log",
  "description": "Stdout and stderr are **two separate streams** — sending one to a file does nothing to the other. Here stdout still shows the matches; any error message (e.g. missing file) would have been captured in `errors.log` instead. The `2` is the file descriptor for stderr; `1` is stdout.",
  "input": {
    "files": [
      { "name": "log.txt", "content": "08:01 ERROR disk full\n08:02 INFO retry\n08:03 ERROR timeout" }
    ]
  },
  "output": {
    "stdout": "08:01 ERROR disk full\n08:03 ERROR timeout",
    "exit": 0
  },
  "notice": "`errors.log` was not created because `grep` didn't write anything to stderr. The redirection happens whether or not the stream gets anything."
}
</script>
</div>

#### Common mistake — *redirection order: `2>&1 > file` vs `> file 2>&1`*

<div data-unix-command-lab>
<script type="application/json">
{
  "command": "build.sh 2>&1 > build.log",
  "description": "The student wants **both** stdout and stderr captured into `build.log`. But redirections are applied **left-to-right**: `2>&1` first makes stderr a duplicate of *the current stdout* (which is still the terminal), and only *then* does `> build.log` redirect stdout to the file. Result: stdout goes to the file, but stderr still goes to the terminal. The correct form is `build.sh > build.log 2>&1` (set stdout first, then dup stderr from stdout).",
  "input": {
    "files": [
      { "name": "build.sh", "content": "#!/bin/bash\necho \"compiling main.c\"\n>&2 echo \"warning: unused variable\"\nexit 0" }
    ]
  },
  "output": {
    "stderr": "warning: unused variable",
    "files": [
      { "name": "build.log", "content": "compiling main.c\n", "action": "create" }
    ],
    "exit": 0
  },
  "notice": "The stderr warning **still shows in the terminal** — not in `build.log`. Fix: `build.sh > build.log 2>&1` (or in Bash, `&> build.log`)."
}
</script>
</div>

### Piping
The pipe operator `|` is the most powerful composition tool. It takes the `stdout` of the command on the left and sends it directly into the `stdin` for the command on the right. 

*Example:* `cat access.log | grep "ERROR" | wc -l`
This pipeline reads a log file, filters only the lines containing "ERROR", and then counts how many lines there are.

#### Pipe `|` — composing commands

<div data-unix-command-lab>
<script type="application/json">
{
  "command": "grep ERROR log.txt | wc -l",
  "description": "A pipe takes the **stdout of the left command** and wires it directly into the **stdin of the right command**. No temporary files, no shared memory — just a stream of bytes. This is the single most powerful idea in the UNIX philosophy: small tools compose into pipelines. Here we filter the log for error lines and then count them.",
  "predict": true,
  "predictPrompt": "Two commands, one pipe. What number appears on stdout?",
  "input": {
    "files": [
      { "name": "log.txt", "content": "08:00 INFO  start\n08:01 ERROR disk full\n08:02 INFO  retry\n08:03 ERROR timeout\n08:04 INFO  done" }
    ]
  },
  "output": {
    "stdout": "2",
    "exit": 0
  },
  "notice": "`grep` produced two matching lines; those two lines flowed into `wc -l`'s stdin, which counted them. Only `wc`'s result (the number `2`) reaches the terminal."
}
</script>
</div>

### Here Documents and Here Strings
Sometimes you need to feed a block of text directly into a command without creating a temporary file. A **here document** (`<<`) lets you embed multi-line input inline, up to a chosen delimiter:

```bash
cat <<EOF
Server: production
Version: 1.4.2
Status: running
EOF
```

The shell expands variables inside the block (just like double quotes). To suppress expansion, quote the delimiter: `<<'EOF'`.

A **here string** (`<<<`) feeds a single expanded string to a command's standard input — a concise alternative to `echo "text" | command`:
```bash
grep "ERROR" <<< "08:15:45 ERROR failed to connect"
```

### Process Substitution
Advanced shell users often utilize process substitution to treat the output of a command as a file. The syntax looks like `<(command)`. For example, `H < <(G) >> I` allows you to refer to the standard output of command `G` as a file, redirect it into the standard input of `H`, and append the output to `I`.

 
## Writing Your First Shell Script

When you find yourself typing the same commands repeatedly, you should create a **shell script**. A shell script is written in a plain text file (often ending in `.sh`) and contains a sequence of commands that the shell executes as a program. 

### Interpreted Nature
Unlike a compiled language like C++, which is **compiled** into machine code before execution, shell scripts are **interpreted** at runtime rather than ahead of time. This allows for rapid prototyping. Bash always reads at least one complete line of input, and reads *all* lines that make up a compound command (such as an `if` block or `for` loop) before executing any of them. This means a syntax error on a later line inside a multi-line compound block is caught before the block starts executing — but an error in a branch that is never reached at runtime may go unnoticed. Use `bash -n script.sh` to check for syntax errors without running the script.



### The Shebang
Every script should start with a "shebang" (`#!`). This tells the operating system which interpreter should be used to run the script. For Bash scripts, the first line should be:
```bash
#!/bin/bash
```

### Execution Permissions
By default, text files are not executable for security reasons. Execute permission is required only if you want to run the script directly as a command:
```bash
chmod +x myscript.sh
./myscript.sh
```
Alternatively, you can bypass the execute-permission requirement entirely by passing the file as an argument to the Bash interpreter directly — no `chmod` needed:
```bash
bash myscript.sh
```
You can also run a script's commands *within the current shell* (inheriting and potentially modifying its environment) using `source` or the `.` builtin: `source myscript.sh`.

### Debugging Scripts
When a script behaves unexpectedly, Bash has built-in tracing modes that let you see exactly what the shell is doing:

* **`bash -n script.sh`**: Reads the script and checks for syntax errors without executing any commands. Always run this first when a script refuses to start.
* **`bash -x script.sh`** (or `set -x` inside the script): Prints a trace of each command and its expanded arguments to `stderr` before executing it — indispensable for logic bugs. Each traced line is prefixed with `+`.
* **`bash -v script.sh`** (or `set -v`): Prints each line of input exactly as read, before expansion — useful for seeing the raw source being interpreted.

You can combine flags: `bash -xv script.sh`. To turn tracing on for only a section of a script, use `set -x` before that section and `set +x` after it.

### Error Handling (`set -e` and Exit Status)
By default, a Bash script will continue executing even if a command fails. Every command returns a numerical code known as an **Exit Status**; `0` generally indicates success, while any non-zero value indicates an error or failure. Continuing after a failure can be dangerous and lead to unexpected behavior. To prevent this, you should typically include `set -e` at the top of your scripts:
```bash
#!/bin/bash
set -e
```
This tells the shell to exit immediately if any simple command fails, making your scripts safer and more predictable.

Work through each script **in your head first** — predict what reaches stdout before pressing Run. Each `echo` call below prints on its own line, so the number of lines on stdout tells you exactly how many `echo` statements ran. The output literally stops where execution stopped. The comparison panel will tell you if you got it; if not, the Notice below will explain why.

#### Lab 1 — `set -e` before vs. after

<div data-unix-command-lab>
<script type="application/json">
{
  "command": "bash demo.sh",
  "description": "This script runs `false` **twice** — once before `set -e` is enabled, and once after. `false` is a tiny program whose only job is to exit with status `1`, so it's a convenient stand-in for \"a command that failed\". Trace the script line by line and commit to a prediction.",
  "predict": true,
  "predictPrompt": "Which `echo` statements reach stdout, and in what order? (Each one prints on its own line.)",
  "input": {
    "files": [
      { "name": "demo.sh", "content": "#!/bin/bash\necho \"A\"\nfalse\necho \"B\"\nset -e\necho \"C\"\nfalse\necho \"D\"\n" }
    ]
  },
  "output": {
    "stdout": "A\nB\nC",
    "exit": 1
  },
  "notice": "The first `false` is harmless — `set -e` is not yet active, so Bash simply continues. The **second** `false` fires `set -e`, the shell exits immediately, and `echo \"D\"` is never reached. The script's own exit code is `1` — inherited from the `false` that killed it."
}
</script>
</div>

#### Lab 2 — `set -e` is *suppressed* inside `&&` and `||`

<div data-unix-command-lab>
<script type="application/json">
{
  "command": "bash chain.sh",
  "description": "A critical subtlety: Bash does **not** let `set -e` fire when a failing command is part of an `&&` or `||` chain, because its exit status is being *tested*. Only a **bare** failing command kills the script. Contrast the two patterns below — one `false && …` chain and one bare `false` — and predict exactly what reaches stdout.",
  "predict": true,
  "predictPrompt": "`set -e` is active throughout. Which `echo` statements reach stdout, and in what order?",
  "input": {
    "files": [
      { "name": "chain.sh", "content": "#!/bin/bash\nset -e\necho \"A\"\nfalse && echo \"skip\"\necho \"B\"\nfalse || echo \"rescue\"\necho \"C\"\nfalse\necho \"D\"\n" }
    ]
  },
  "output": {
    "stdout": "A\nB\nrescue\nC",
    "exit": 1
  },
  "notice": "Two chained `false`s survive: `false && echo \"skip\"` returns **exit 1** overall, but `set -e` is suppressed because `false` is part of an `&&` test. `false || echo \"rescue\"` runs its rescue branch (overall exit 0). The **bare** `false` on the next-to-last line has nothing catching it, so `set -e` fires and `echo \"D\"` is unreached. The idiom `command || true` is the standard way to intentionally ignore a failure under `set -e`. Pipelines, by the way, are yet another story: `set -e` only inspects the *last* stage of a pipeline unless you also `set -o pipefail`."
}
</script>
</div>

#### Lab 3 — Synthesis: functions, `set -e`, `||`, `&&` — all at once

<div data-unix-command-lab>
<script type="application/json">
{
  "command": "bash song.sh",
  "description": "A synthesis of everything from the first two labs — a **function with its own `return 1`**, `set -e`, and a mix of `||` rescues, `&&` chains, and bare commands. Trace line by line. Somewhere in the script `set -e` fires and the rest is unreachable — finding *where* is the whole puzzle.",
  "predict": true,
  "predictPrompt": "What appears on **stdout**, line by line? (The function prints `Never gonna` every time it's *called*, not each time its return value is used.)",
  "input": {
    "files": [
      { "name": "song.sh", "content": "#!/bin/bash\nnever_gonna() {\n    echo \"Never gonna\"\n    return 1\n}\nnever_gonna\nfalse\nset -e\nfalse || true\ntrue || echo \"give you\"\nfalse || echo \"up.\"\nnever_gonna || true\necho \"let you\" && false\necho \"down.\"\n" }
    ]
  },
  "output": {
    "stdout": "Never gonna\nup.\nNever gonna\nlet you",
    "exit": 1
  },
  "notice": "Small pop-culture payoff: if `set -e` hadn't killed the script, stdout would spell out **Rick Astley's \"Never gonna give you up. Never gonna let you down.\"** — the 1987 chorus. The script *almost* finishes it. Walking through: (1) `never_gonna` *before* `set -e` — harmless, prints `Never gonna`. (2) bare `false` — also harmless, still no `set -e`. (3) `set -e` activates. (4) `false || true` — absorbed by `||`, nothing printed. (5) `true || echo …` — `true` succeeded, so `||` is skipped. (6) `false || echo \"up.\"` — rescue fires, prints `up.`. (7) `never_gonna || true` — function runs, prints `Never gonna` again, its `return 1` is swallowed. (8) `echo \"let you\" && false` — **this is the kill line**. `echo` prints; then `false` is the command *after* the final `&&`, which means `set -e` is **not** suppressed — the script exits. (9) `echo \"down.\"` is never reached, and the world is denied the resolution."
}
</script>
</div>


## Syntax and Programming Constructs

Bash is a full-fledged programming language, but because it is an interpreted scripting language rather than a compiled language (like C++ or Java), its syntax and scoping rules are quite different.

### 5. Scripting Constructs
In our scripts, we also treat these keywords as "commands" for building logic:
* **`#!` (Shebang)**: An OS-level interpreter directive on the first line of a script file — not a Bash keyword or command. When the OS executes the file, it reads `#!` and uses the rest of that line as the interpreter path. Within Bash itself, any line starting with `#` is simply a comment and is ignored.
* **`read`**: Read a line from standard input into a variable. Common flags: `-p "prompt"` displays a prompt on the same line, `-s` silently hides typed input (useful for passwords), and `-n 1` returns after exactly one character instead of waiting for Enter.
* **`if` / `then` / `elif` / `else` / `fi`**: Conditional execution.
* **`for` / `do` / `done` / `while`**: Looping constructs.
* **`case` / `in` / `esac`**: Multi-way branching on a single value.
* **`local`**: Declare a variable scoped to the current function.
* **`return`**: Exit a function with a numeric status code.
* **`exit`**: Terminate the script with a specific status code.

#### `read` — read a line of stdin into a variable

<div data-unix-command-lab>
<script type="application/json">
{
  "command": "read -p \"Name: \" name; echo \"Hi, $name\"",
  "description": "`read` consumes one line from stdin (up to the next newline) and assigns it to the named variable. **`-p`** prints a prompt on the same line before reading. Here the user types `Ada` and presses Enter; the second command prints a greeting. Always pair `read` with `-r` when reading arbitrary text — without it, backslashes get interpreted as line-continuation.",
  "input": {
    "stdin": "Ada"
  },
  "output": {
    "stdout": "Name: Ada\nHi, Ada",
    "exit": 0
  },
  "notice": "The `Name: ` prompt is printed *before* `read` blocks for input; once a newline arrives, `read` returns and the next command runs."
}
</script>
</div>

### Variables
You can assign values to variables without declaring a type. Note that there are **no spaces** around the equals sign in Bash.
```bash
NAME="Ada"
echo "Hello, $NAME"
```

### Parameter Expansion — Default Values and String Manipulation
Beyond simple `$VAR` substitution, Bash supports a powerful set of **parameter expansion** operators that let you handle missing values and manipulate strings entirely within the shell, without spawning external tools.

**Default values:**
```bash
# Use "server_log.txt" if $1 is unset or empty
file="${1:-server_log.txt}"

# Use "anonymous" if $NAME is unset or empty, AND assign it
NAME="${NAME:=anonymous}"
```

**String trimming** — remove a pattern from the start (`#`) or end (`%`) of a value:
```bash
path="/home/user/project/main.sh"
filename="${path##*/}"    # removes longest prefix up to last /  → "main.sh"
noext="${filename%.*}"    # removes shortest suffix from last .  → "main"
```
The double form (`##` / `%%`) removes the *longest* match; the single form (`#` / `%`) removes the *shortest*.

**Search and replace:**
```bash
msg="Hello World World"
echo "${msg/World/Earth}"    # replaces first match  → "Hello Earth World"
echo "${msg//World/Earth}"   # replaces all matches  → "Hello Earth Earth"
```

### Scope Differences
Unlike C++ or Java, Bash lacks strict block-level scoping (like `{}` blocks). Variables assigned anywhere in a script — including inside `if` statements and loops — remain accessible throughout the entire script's global scope. There are, however, several important isolation boundaries:

* **Function-level scoping**: variables declared with the `local` builtin *inside a Bash function* are visible only to that function and its callees.
* **Subshells**: commands grouped with `( list )`, command substitutions `$(...)`, and background jobs run in a *subshell* — a copy of the shell environment. Any variable assignments made inside a subshell do not propagate back to the parent shell.
* **Per-command environment**: a variable assignment placed immediately before a simple command (e.g., `VAR=value command`) is only visible to that command for its duration, leaving the surrounding scope untouched.

### Arithmetic
Math in Bash is slightly idiosyncratic. While a language like C++ operates directly on integers with `+` or `/`, arithmetic in Bash needs to be enclosed within `$(( ... ))` or evaluated using the `let` command.
```bash
x=5
y=10
sum=$((x + y))
echo "The sum is $sum"
```

### Control Structures: If-Statements and Loops
Bash supports standard control flow constructs. 

**If-Statements:**
```bash
if [ "$sum" -gt 10 ]; then
    echo "Sum is greater than 10"
elif [ "$sum" -eq 10 ]; then
    echo "Sum is exactly 10"
else
    echo "Sum is less than 10"
fi
```

> **`[` is a shell builtin command:** The single bracket `[` is not special syntax — it is a builtin command, a synonym for `test`. Because Bash implements it internally, its arguments must be separated by spaces just like any other command: `[ -f "$file" ]` is correct, but `[-f "$file"]` tries to run a command named `[-f`, which fails. This is why the spaces inside brackets are mandatory, not just stylistic. (An external binary `/usr/bin/[` also exists on most systems, but Bash uses its builtin by default — you can verify with `type -a [`.)

The following table covers the most important tests available inside `[ ]`:

| Test | Meaning |
|:---|:---|
| `-f path` | Path exists and is a regular file |
| `-d path` | Path exists and is a directory |
| `-z "$var"` | String is empty (zero length) |
| `"$a" = "$b"` | Strings are equal |
| `"$a" != "$b"` | Strings are not equal |
| `$x -eq $y` | Integers are equal |
| `$x -gt $y` | Integer greater than |
| `$x -lt $y` | Integer less than |
| `! condition` | Logical NOT (negates the test) |

**Important:** use `-eq`, `-lt`, `-gt` for numbers and `=` / `!=` for strings. Mixing them produces wrong results silently.

> **`[` vs `[[`:** The double bracket `[[ ... ]]` is a Bash keyword with additional power: it does not perform word splitting on variables, allows `&&` and `||` inside the condition, and supports regex matching with `=~`. Prefer `[[ ]]` in new Bash scripts.

**Loops:**
```bash
for i in 1 2 3 4 5; do
    echo "Iteration $i"
done
```

For numeric ranges, the **C-style `for` loop** (the *arithmetic for command*) is often cleaner:
```bash
for (( i=1; i<=5; i++ )); do
    echo "Iteration $i"
done
```
This is a distinct looping construct from the standalone `(( ))` arithmetic compound command. In this form, expr1 is evaluated once at start, expr2 is tested before each iteration (loop runs while non-zero), and expr3 is evaluated after each iteration — the same semantics as C's `for` loop.

**Loop control keywords:**
* **`break`**: Exit the loop immediately, regardless of the remaining iterations.
* **`continue`**: Skip the rest of the current iteration and jump to the next one.

```bash
for f in *.log; do
    [ -s "$f" ] || continue    # skip empty files
    grep -q "ERROR" "$f" || continue
    echo "Errors found in: $f"
done
```

### Quoting and Word Splitting
How you quote text profoundly changes how Bash interprets it — this is one of the most common sources of bugs in shell scripts.
* **Single quotes (`'...'`)**: All characters are literal. No variable or command substitution occurs. `echo 'Cost: $5'` prints exactly `Cost: $5`.
* **Double quotes (`"..."`)**: Spaces are preserved, but `$VARIABLE` and `$(command)` are still expanded. `echo "Hello $USER"` prints `Hello Ada`.

A critical pitfall is **word splitting**: when you reference an unquoted variable, the shell splits its value on whitespace and treats each word as a separate argument. Consider:
```bash
FILE="my report.pdf"
rm $FILE      # WRONG: shell splits into two args: "my" and "report.pdf"
rm "$FILE"    # CORRECT: the entire value is passed as one argument
```
Always quote variable references with double quotes to protect against word splitting.

### Command Substitution
**Command substitution** captures the standard output of a command and uses it as a value in-place. The modern syntax is `$(command)`:
```bash
TODAY=$(date +%Y-%m-%d)
echo "Backup started on: $TODAY"
```
The shell runs the inner command in a subshell, then replaces the entire `$(...)` expression with its output. This is the standard way to assign the results of commands to variables.

### Positional Parameters and Special Variables
Scripts receive command-line arguments via **positional parameters**. If you run `./backup.sh /src /dest`, then inside the script:

| Variable | Value | Description |
|:---|:---|:---|
| `$0` | `./backup.sh` | Name of the script itself |
| `$1` | `/src` | First argument |
| `$2` | `/dest` | Second argument |
| `$#` | `2` | Total number of arguments passed |
| `$@` | `/src /dest` | All arguments as separate, properly-quoted words |
| `$?` | (exit code) | Exit status of the most recent command |

When iterating over all arguments, always use `"$@"` (quoted). Without quotes, `$@` is subject to word splitting and arguments containing spaces are silently broken into multiple words:
```bash
for f in "$@"; do
    echo "Processing: $f"
done
```

### Command Chaining with `&&` and `||`
Because every command returns an exit status, you can chain commands conditionally without writing a full `if/then/fi` block:
* **`&&` (AND)**: The right-hand command runs only if the left-hand command **succeeds** (exit code `0`).
  `mkdir output && echo "Directory created"` — only prints if `mkdir` succeeded.
* **`||` (OR)**: The right-hand command runs only if the left-hand command **fails** (non-zero exit code).
  `cd /target || exit 1` — exits the script immediately if the directory cannot be entered.

This compact chaining idiom is widely used in professional scripts for concise, readable error handling.

### Background Jobs
Appending `&` to a command runs it **asynchronously** — the shell launches it in the background and immediately returns to the prompt without waiting for it to finish:

```bash
./long_running_build.sh &
echo "Build started, continuing with other work..."
```

Two special variables are useful when managing background processes:
* **`$$`**: The process ID (PID) of the current shell itself. Often used to create unique temporary file names: `tmp_file="/tmp/myscript.$$"`.
* **`$!`**: The PID of the most recently backgrounded job. Use it to wait for or kill a specific background process.

The `jobs` command lists all active background jobs; `fg` brings the most recent one back to the foreground, and `bg` resumes a stopped job in the background.

## Functions — Reusable Building Blocks

When the same logic appears in multiple places, extract it into a **function**. Functions in Bash work like small scripts-within-a-script: they accept positional arguments via `$1`, `$2`, etc. — independently of the outer script's own arguments — and can be called just like any other command.

```bash
greet() {
    local name="$1"
    echo "Hello, ${name}!"
}

greet "engineer"   # → Hello, engineer!
```

### The `local` Keyword
Without `local`, any variable set inside a function leaks into and overwrites the global script scope. Always declare function-internal variables with `local` to prevent subtle bugs:

```bash
process() {
    local result="$1"   # visible only inside this function
    echo "$result"
}
```

### Returning Values from Functions
The `return` statement only carries a numeric exit code (0–255), not data. To pass a string back to the caller, have the function `echo` the value and capture it with command substitution:

```bash
to_upper() {
    echo "$1" | tr '[:lower:]' '[:upper:]'
}

loud=$(to_upper "hello")   # loud="HELLO"
```

You can also use functions directly in `if` statements, because a function's exit code is treated as its truth value: `return 0` is success (true), `return 1` is failure (false).

## Case Statements — Readable Multi-Way Branching

When you need to check one variable against many possible values, a `case` statement is far cleaner than a chain of `if/elif`:

```bash
case "$command" in
    start)   echo "Starting service..."  ;;
    stop)    echo "Stopping service..."  ;;
    status)  echo "Checking status..."   ;;
    *)       echo "Unknown command: $command" >&2; exit 2 ;;
esac
```

Each branch ends with `;;`. The `*` pattern is the **catch-all default**, matching any value not handled by earlier branches. The block closes with `esac` (case backwards).

### Exit Codes — The Language of Success and Failure
Every command — including your own scripts — exits with a number. **0 always means success**; any non-zero value means failure. This is the *opposite* of most programming languages where 0 is falsy. Conventional exit codes are:

| Code | Meaning |
|:---|:---|
| `0` | Success |
| `1` | General error |
| `2` | Misuse — wrong arguments or invalid input |

Meaningful exit codes make scripts **composable**: other scripts, CI pipelines, and tools like `make` can call your script and take action based on the result. For example, `./monitor.sh || alert_team` only triggers the alert when your monitor exits non-zero.

## Shell Expansions — Brace Expansion and Globbing

The shell performs several rounds of expansion on a command line before executing it. Understanding the order helps you predict and control what the shell does.

### Brace Expansion
First comes **brace expansion**, which generates arbitrary lists of strings. It is a purely textual operation — no files need to exist:

```bash
mkdir project/{src,tests,docs}      # creates three directories at once
cp config.yml config.yml.{bak,old}  # copies to two names simultaneously
echo {1..5}                          # → 1 2 3 4 5  (sequence expression)
```

Brace expansion happens before all other expansions, so you can combine it freely with variables and globbing.

## Supercharging Scripts with Regular Expressions

Because the UNIX philosophy is heavily centered around text streams, text processing is a massive part of shell scripting. **Regular Expressions (RegEx)** is a vital tool used within shell commands like `grep`, `sed`, and `awk` to find, validate, or transform text patterns quickly.

> **Globbing vs. Regular Expressions:** These look similar but are entirely different systems. **Globbing** (filename expansion) uses `*`, `?`, and `[...]` to match filenames — the shell expands these *before* the command runs (e.g., `rm *.log` deletes all `.log` files). The three special pattern characters are: `*` matches any string (including empty), `?` matches any single character, and `[` opens a bracket expression `[...]` that matches any one of the enclosed characters — e.g., `[a-z]` matches any lowercase letter, and `[!a-z]` matches any character that is not a lowercase letter. **Regular Expressions** use `^`, `$`, `.*`, `[0-9]+`, and similar constructs — they are pattern languages used by tools like `grep`, `sed`, and `awk`, and also natively by Bash itself via the `=~` operator inside `[[ ]]` conditionals (which evaluates POSIX extended regular expressions directly without spawning an external tool). Critically, `*` means "match anything" in globbing, but "zero or more of the preceding character" in RegEx.

RegEx allows you to match sub-strings in a longer sequence. Critical to this are **anchors**, which constrain matches based on their location:
* `^` : Start of string. (Does not allow any other characters to come before).
* `$` : End of string. 

*Example:* `^[a-zA-Z0-9]{8,}$` validates a password that is strictly alphanumeric and at least 8 characters long, from the exact beginning of the string to the exact end.

## Conclusion

Shell scripting is an indispensable skill for anyone working in tech. By viewing the shell as a set of modular tools (the "Infinity Stones" of your development environment), you can combine simple operations to perform massive, complex tasks with minimal effort. Start small by automating a daily chore on your machine, and before you know it, you will be weaving complex UNIX tools together with ease!

# Quiz

{% include flashcards.html id="shell_commands_reference" %}

{% include flashcards.html id="shell" %}

{% include flashcards.html id="shell_pipes" %}

{% include quiz.html id="shell" %}

{% include quiz.html id="shell_parson" %}

After finishing these quizzes, you are now ready to practice in a real Linux system. Try the [Interactive Shell Scripting Tutorial](/SEBook/tools/shell-tutorial.html)!