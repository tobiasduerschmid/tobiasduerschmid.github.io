# Shell Scripting Tutorial — Sample Solutions

These are reference solutions for each exercise in the interactive tutorial.
Each solution explains **why** it is correct, connecting the code back to the
concepts taught in that step.

---

## Step 1: Hello, Shell! — `morning.sh`

```bash
#!/bin/bash
set -e

echo "Good morning!"
echo "Today is $(date +%A)"
echo "You are logged in as: $(whoami)"
```

**Why this is correct:**

- **Line 1 (`#!/bin/bash`):** The shebang tells the OS to use Bash as the
  interpreter. Without it, the OS might guess wrong.
- **Line 2 (`set -e`):** Exits the script immediately if any command fails,
  preventing silent cascading errors.
- **`echo "Good morning!"`:** Prints a literal string. The test checks for
  the word "morning" (case-insensitive).
- **`$(date +%A)`:** Command substitution — the shell runs `date +%A`
  (which outputs the day name, e.g., "Monday"), captures its stdout, and
  injects it into the string. The test checks for any day-of-week name.
- **`$(whoami)`:** Similarly captures the current username. In the tutorial
  environment this is `root`.

After writing the script, the student runs:
```bash
chmod +x morning.sh   # grants execute permission
./morning.sh           # runs it from the current directory
```

---

## Step 2: Navigating the Filesystem — Build a project skeleton

```bash
# 1. Create the directory tree
mkdir -p myproject/src myproject/docs myproject/tests

# 2. Copy notes.txt into myproject/docs/
cp notes.txt myproject/docs/

# 3. Move data.csv into myproject/src/ and rename it to input.csv
mv data.csv myproject/src/input.csv

# 4. Copy morning.sh into myproject/src/ as a backup
cp morning.sh myproject/src/

# 5. Create an empty placeholder file
touch myproject/tests/test_placeholder.txt

# 6. Remove it
rm myproject/tests/test_placeholder.txt

# 7. Verify
ls -R myproject
```

**Why this is correct:**

- **`mkdir -p`:** The `-p` flag creates all missing parent directories in
  one command. Without it, `mkdir myproject/src` would fail if `myproject/`
  didn't exist yet. You can list multiple paths in one command.
- **`cp notes.txt myproject/docs/`:** Copies the file into the directory.
  The original `notes.txt` remains in the working directory — `cp` always
  duplicates, never moves.
- **`mv data.csv myproject/src/input.csv`:** A single `mv` command can
  simultaneously relocate *and* rename. After this, `data.csv` no longer
  exists at its original location (the test checks this with `! [ -f data.csv ]`).
- **`cp morning.sh myproject/src/`:** Creates a backup copy. Execute
  permissions travel with the file — the copy will also be executable.
- **`touch` + `rm`:** `touch` creates an empty file (or updates
  timestamps on an existing one). `rm` permanently removes a file —
  there is no undo, no trash can. The test verifies the file was removed
  with `! [ -f ... ]`.

---

## Step 3: Pipes — Tool Isolation Exercises

### Part 1: Individual tool practice

```bash
# 1. grep practice — find all WARN lines
grep "WARN" server_log.txt > grep_result.txt

# 2. cut practice — extract message types (second field)
cut -d' ' -f2 server_log.txt > cut_result.txt

# 3. head practice — first 3 lines only
head -3 server_log.txt > head_result.txt
```

**Why these are correct:**

- Each command uses **one tool** on the log file and redirects (`>`) to a
  specific output file. This is the component-skill isolation phase.
- `grep "WARN"` matches 3 lines (lines containing WARN).
- `cut -d' ' -f2` splits each line on spaces and extracts the second
  field — the message type (INFO, WARN, ERROR).
- `head -3` outputs only the first 3 lines of the file.

### stderr exercise

```bash
# Step A: see both stdout and stderr on the terminal
ls server_log.txt no_such_file.txt

# Step B: redirect stdout only — error still shows on screen
ls server_log.txt no_such_file.txt > ls_out.txt

# Step C: redirect both streams separately
ls server_log.txt no_such_file.txt > ls_out.txt 2> ls_err.txt
```

**Why this is correct:**

- `>` only captures **stdout** (file descriptor 1). The error message from
  `no_such_file.txt` travels on **stderr** (file descriptor 2).
- `2>` specifically redirects stderr. After Step C, `ls_out.txt` contains
  `server_log.txt` and `ls_err.txt` contains the "No such file" error.

### Part 2: Pipeline exercises

```bash
# 1. Count total lines
wc -l < server_log.txt > line_count.txt

# 2. Filter errors
grep "ERROR" server_log.txt > errors_only.txt

# 3. Count errors
grep "ERROR" server_log.txt | wc -l > error_count.txt

# 4. Extract timestamps (first field)
cut -d' ' -f1 server_log.txt > timestamps.txt

# 5. Top 2 message types by frequency
cut -d' ' -f2 server_log.txt | sort | uniq -c | sort -rn | head -2 > top_message_types.txt
```

**Why these are correct:**

- **Exercise 1:** `wc -l < server_log.txt` uses input redirection (`<`) so
  `wc` outputs only the number (`15`), not `15 server_log.txt`. This matters
  because the test does an integer comparison on the file contents.
- **Exercise 2:** `grep "ERROR"` filters to only lines containing "ERROR" (4 lines).
- **Exercise 3:** The pipe `|` connects `grep`'s stdout to `wc -l`'s stdin.
  `wc -l` counts the 4 lines that `grep` outputs. The result (`4`) is saved.
- **Exercise 4:** `cut -d' ' -f1` extracts the first space-delimited field
  (the timestamps like `08:12:01`). All 15 lines have timestamps.
- **Exercise 5:** This is a 5-stage pipeline:
  1. `cut -d' ' -f2` extracts message types (INFO, WARN, ERROR)
  2. `sort` groups identical types together (required for `uniq`)
  3. `uniq -c` collapses duplicates and prefixes counts
  4. `sort -rn` sorts numerically in descending order (highest count first)
  5. `head -2` takes the top 2 — INFO (8) and ERROR (4)

---

## Step 4: Variables & The Quoting Trap

### Bug fix: `buggy.sh`

The original bug is on this line:

```bash
line_count=$(wc -l $filename)     # BUG
```

The fix:

```bash
line_count=$(wc -l "$filename")   # FIXED — quoted variable
```

**Why this is correct:**

- The variable `filename` contains `"my report.txt"` — a value with a space.
- Without quotes, Bash **word-splits** `$filename` into two separate
  arguments: `my` and `report.txt`. So `wc -l` receives two filenames
  that don't exist.
- With double quotes (`"$filename"`), the entire value is treated as one
  argument, and `wc -l` correctly processes the file `my report.txt`.

### Build your own: `inventory.sh`

```bash
#!/bin/bash
set -e

project="mytools"
version="v1.0"
count=$(ls *.sh | wc -l)
echo "Project: $project $version — $count scripts found"
```

**Why this is correct:**

- Two variables (`project`, `version`) are declared with `=` and no spaces.
- `$(ls *.sh | wc -l)` uses command substitution to capture the number of
  `.sh` files. The glob `*.sh` expands to all matching filenames; `wc -l`
  counts the lines of output (one per file).
- The `echo` combines all three variables in a double-quoted string. Double
  quotes allow `$variable` expansion while preserving spaces.
- The test checks for a version pattern (`v1.0`) and a script count
  (`N scripts`).

---

## Step 5: Conditionals — `health_check.sh`

Fill in the three blanks:

```bash
#!/bin/bash
set -e

file="${1:-server_log.txt}"

# Step 1: Check if the file exists
if [ ! -f "$file" ]; then
    echo "Error: $file not found" >&2
    exit 1
fi

# Step 2: Count ERROR lines
# Note: grep -c exits with code 1 when no matches are found.
# The "|| true" prevents set -e from killing the script in that case.
error_count=$(grep -c "ERROR" "$file" || true)

# Step 3: Decide severity
if [ "$error_count" -gt 3 ]; then
    echo "CRITICAL: $error_count errors found"
elif [ "$error_count" -gt 0 ]; then
    echo "WARNING: $error_count errors found"
else
    echo "OK: no errors found"
fi
```

**Why the blanks are filled this way:**

- **Blank 1: `! -f "$file"`** — The `-f` test checks if a path is a regular
  file. The `!` negates it: "if the file does NOT exist, enter this block."
  The variable is quoted to handle filenames with spaces.
- **Blank 2: `"$error_count" -gt 3`** — The `-gt` operator does integer
  "greater than" comparison. With 4 errors in `server_log.txt`, this
  evaluates to true, printing "CRITICAL."
- **Blank 3: `"$error_count" -gt 0`** — If not greater than 3, check if
  greater than 0. This catches the 1-3 error range as "WARNING."
- The `|| true` on the `grep -c` line is critical: `grep -c` returns exit
  code 1 when there are zero matches, which would trigger `set -e` and
  kill the script. `|| true` ensures the overall expression always succeeds.

---

## Step 6: Loops — `batch_check.sh`

Fill in the three blanks in the skeleton:

```bash
first=$(head -1 "$f")                    # Blank 1
```

```bash
if [ "$first" = "#!/bin/bash" ]; then    # Blank 2
```

```bash
echo "fail $f (missing shebang)"         # Blank 3 (two lines)
failed=$((failed + 1))
```

**Why the blanks are filled this way:**

- **Blank 1: `first=$(head -1 "$f")`** — `head -1` prints the first line
  of a file. `$(...)` captures that output into the variable `first`.
  `"$f"` is quoted to handle filenames with spaces safely.
- **Blank 2: `"$first" = "#!/bin/bash"`** — String comparison using `=`
  (not `-eq`, which is for integers). Both sides are quoted to prevent
  word splitting. The `#!` in the shebang is not a comment here — it's
  inside a quoted string being compared literally.
- **Blank 3: `echo "fail $f (missing shebang)"` + `failed=$((failed + 1))`**
  — Mirrors the pass branch structure. `$((failed + 1))` evaluates the
  arithmetic and you must assign it back — `$(( ))` alone doesn't modify
  the variable.

The loop structure, counters (`passed=0`, `failed=0`), and summary line
(`Checked $total files: $passed passed, $failed failed`) were provided
in the skeleton.

---

## Step 7: Arguments & Special Variables — `file_info.sh`

```bash
#!/bin/bash
set -e

if [ "$#" -eq 0 ]; then
    echo "Usage: $0 <file1> ..." >&2
    exit 1
fi

for f in "$@"; do
    if [ -d "$f" ]; then
        echo "$f: directory"
    elif [ ! -f "$f" ]; then
        echo "$f: not found"
    else
        lines=$(wc -l < "$f")
        echo "$f: $lines lines"
    fi
done
```

**Why this is correct:**

- **`$#` check:** `$#` holds the count of positional arguments (not
  counting `$0`). If zero, print usage and exit with code 1.
- **`$0` in usage:** Prints the script's own name, so the usage message
  adapts if the script is renamed.
- **`"$@"` (quoted):** Expands to all arguments as separate, properly
  quoted words. Without quotes, arguments containing spaces would be
  split into multiple words.
- **`-d "$f"`:** Tests if the path is a directory. Checked first because
  `-f` returns false for directories.
- **`! -f "$f"`:** Negated file test — true when the path is not a regular
  file (i.e., doesn't exist, or is a special file).
- **`wc -l < "$f"`:** Uses input redirection so `wc` outputs only the
  count (e.g., `15`), not `15 server_log.txt`.

---

## Step 8: Functions — `toolkit.sh`

```bash
#!/bin/bash
set -e

to_upper() {
    local input="$1"
    echo "$input" | tr '[:lower:]' '[:upper:]'
}

file_ext() {
    local path="$1"
    echo "${path##*.}"
}

is_number() {
    local val="$1"
    if [[ "$val" =~ ^-?[0-9]+$ ]]; then
        return 0
    else
        return 1
    fi
}

# Test the functions
echo "to_upper: $(to_upper hello)"
echo "file_ext: $(file_ext report.csv)"
if is_number 42; then
    echo "is_number 42: yes"
fi
if ! is_number abc; then
    echo "is_number abc: no"
fi
```

**Why this is correct:**

- **`local` keyword:** Every variable inside a function is declared with
  `local` to prevent leaking into the global scope. Without `local`,
  `input`, `path`, and `val` would overwrite any same-named global variables.
- **`to_upper`:** Pipes the argument through `tr`, which translates
  lowercase character classes to uppercase. The function returns data by
  `echo`ing it — callers capture with `$(to_upper hello)`.
- **`file_ext`:** Uses parameter expansion `${path##*.}` — the `##` removes
  the longest prefix matching `*.` (everything up to and including the last
  dot), leaving just the extension (e.g., `csv`).
- **`is_number`:** Uses `[[ ]]` with the `=~` regex operator. The regex
  `^-?[0-9]+$` matches an optional minus sign followed by one or more
  digits. `return 0` means success (true); `return 1` means failure (false).
  This lets the function be used directly in `if is_number "$val"; then`.
- **Test section:** Demonstrates all three functions. `$(to_upper hello)`
  captures the echoed output. `is_number` is tested in an `if` statement
  because it communicates via exit codes, not stdout.

---

## Step 9: Case Statements & Exit Codes — `service.sh`

```bash
#!/bin/bash
set -e

case "$1" in
    start)
        touch /tmp/my_service.pid && echo "Starting service..."
        exit 0
        ;;
    stop)
        rm /tmp/my_service.pid 2>/dev/null || true
        echo "Stopping service..."
        exit 0
        ;;
    status)
        if [ -f /tmp/my_service.pid ]; then
            echo "Service is running"
            exit 0
        else
            echo "Service is stopped"
            exit 1
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop|status}" >&2
        exit 2
        ;;
esac
```

**Why this is correct:**

- **`case "$1" in`:** Matches the first argument against patterns. `"$1"` is
  quoted to prevent word splitting.
- **`start)`:** Uses `&&` chaining — `echo` runs only if `touch` succeeds.
  `touch` creates the PID file (simulating a service starting).
- **`stop)`:** Uses `|| true` — if the PID file doesn't exist, `rm` fails
  with a non-zero exit code, but `|| true` prevents `set -e` from killing
  the script. `2>/dev/null` silences the "No such file" error message.
- **`status)`:** Uses `-f` to check if the PID file exists. Exits 0 if
  running, 1 if stopped — meaningful exit codes that callers can act on.
- **`*)`:** The catch-all default matches any unrecognized input (or empty
  input). The usage message goes to **stderr** (`>&2`) because it's an
  error, not normal output. `exit 2` signals "misuse / wrong arguments."
- **`;;`:** Terminates each branch. `esac` closes the `case` block (it's
  "case" spelled backwards).

---

## Step 10: Build a Log Monitor — `monitor.sh`

```bash
#!/bin/bash
set -e

# --- Function ---
count_by_level() {
    local level="$1"
    local file="$2"
    grep -c "$level" "$file" || true
}

# --- Arguments and validation ---
file="${1:-server_log.txt}"

if [ ! -f "$file" ]; then
    echo "Error: $file not found" >&2
    exit 1
fi

# --- Header ---
echo "=== Log Monitor Report ==="

# --- Summary ---
total=$(wc -l < "$file")
errors=$(count_by_level "ERROR" "$file")
warns=$(count_by_level "WARN" "$file")
infos=$(count_by_level "INFO" "$file")

echo "Total entries: $total"
echo "ERROR: $errors"
echo "WARN: $warns"
echo "INFO: $infos"

# --- Error details ---
echo ""
echo "--- Error Details ---"
grep "ERROR" "$file" || true

# --- Severity assessment ---
case "$errors" in
    0)
        echo "Status: HEALTHY"
        ;;
    1|2|3)
        echo "Status: WARNING"
        ;;
    *)
        echo "Status: CRITICAL"
        ;;
esac

# --- Exit code ---
if [ "$errors" -gt 0 ]; then
    exit 1
else
    exit 0
fi
```

**Why this is correct:**

This capstone integrates every major concept from the tutorial:

- **Function (`count_by_level`):** Accepts a log level and filename,
  echoes the count. Uses `local` for scoping. The `|| true` prevents
  `set -e` from killing the script when `grep -c` finds zero matches
  (which returns exit code 1). Callers capture the count with
  `$(count_by_level "ERROR" "$file")`.
- **Default argument (`${1:-server_log.txt}`):** If no argument is passed,
  defaults to `server_log.txt`. The `:-` operator substitutes the default
  when the variable is unset or empty.
- **File validation (`! -f "$file"`):** Checks that the file exists before
  proceeding. Error message goes to stderr (`>&2`).
- **Pipes and redirection:** `wc -l < "$file"` counts lines (using `<` to
  get just the number). `grep "ERROR" "$file" || true` prints error lines
  without crashing on zero matches.
- **Loop over ERROR lines:** `grep "ERROR"` outputs all matching lines.
  The `|| true` is needed in case there are zero errors.
- **`case` statement for severity:** Uses `0)`, `1|2|3)`, and `*)` as
  patterns. The `|` operator matches multiple values (1 OR 2 OR 3). The
  `*` catch-all handles 4 or more errors as CRITICAL. Note: `case` uses
  glob patterns, not numeric ranges — `1-3)` would match the literal
  string "1-3", not a range.
- **Meaningful exit codes:** `exit 1` if errors are present (non-zero =
  failure in Unix), `exit 0` if clean. This allows callers (CI/CD pipelines,
  other scripts) to react programmatically.
- **`chmod +x monitor.sh`:** Required before running with `./monitor.sh`
  (the test checks that the execute bit is set).

### Expected output for `server_log.txt`:

```
=== Log Monitor Report ===
Total entries: 15
ERROR: 4
WARN: 3
INFO: 8

--- Error Details ---
08:15:45 ERROR failed to process request /api/users
08:18:33 ERROR database timeout after 30s
08:22:47 ERROR connection refused by upstream service
08:31:44 ERROR out of memory on worker-3
Status: CRITICAL
```

The script exits with code 1 (errors present).
