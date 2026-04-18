---
title: Shell Scripting - Automating the Command Line
layout: sebook
---

<script src="/js/ArchUML/uml-bundle.js"></script>
<script src="/js/fs-command-lab.js"></script>

<link rel="stylesheet" href="/css/fs-command-lab.css">

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

### 3. Permissions, Environment, and Documentation
These tools manage how your shell operates and how you access information:
* **`man`**: Access the manual pages for other commands. This is arguably the most useful command, providing built-in documentation for every other command in the system.
* **`chmod`**: Change file mode bits (permissions). Files in a Unix-like system have three primary types of permissions: **read (r), write (w), and execute (x)**. For security reasons, the system requires an explicit **execute permission** because you do not want to accidentally run a file from an unknown source. Permissions are often read in "bits" for the owner (u), group (g), and others (o).
* **`which` / `type`**: Locate the binary or type for a command.
* **`export`**: Set environment variables. The **`PATH`** variable is especially important; it tells the shell which directories to search for executable programs. You can temporarily update it using `export` or make it permanent by adding the command to your `~/.bashrc` or `~/.profile` file.
* **`source` / `.`**: Execute commands from a file in the current shell environment.

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

### Piping
The pipe operator `|` is the most powerful composition tool. It takes the `stdout` of the command on the left and sends it directly into the `stdin` for the command on the right. 

*Example:* `cat access.log | grep "ERROR" | wc -l`
This pipeline reads a log file, filters only the lines containing "ERROR", and then counts how many lines there are.

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