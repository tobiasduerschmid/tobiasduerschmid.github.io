---
title: "Python Essentials — Sample Solutions"
layout: sebook
---

# Python Essentials: Scripting & Automation — Sample Solutions

These are reference solutions for each exercise in the interactive tutorial.
Each solution explains **why** it is correct, connecting the code back to the
concepts taught in that step.

---

## Step 1: Hello, Python! — `hello.py`

```python
# Task: Change the message to "Hello, CS 35L!"
print("Hello, CS 35L!")
```

**Why this is correct:**

- **`print("Hello, CS 35L!")`:** Python's `print()` is the direct equivalent of C++'s `printf()` / `cout` and Bash's `echo`. The test checks that the exact string `"Hello, CS 35L!"` appears in the output.
- Python scripts run top-to-bottom with no `main()` function, no `#include`, and no semicolons — unlike C++. This is the same execution model as a Bash script.
- The string is surrounded by double quotes; Python accepts both single and double quotes interchangeably.

---

## Step 2: Variables, Types & f-Strings — `profile.py`

```python
name  = "Alice"
year  = 2
gpa   = 3.819
major = "Computer Science"

# Using a single f-string with :.2f to format GPA
print(f"Student: {name} | Year: {year} | Major: {major} | GPA: {gpa:.2f}")
```

**Why this is correct:**

- **`f"..."` prefix:** Marks the string as an f-string so `{variable}` expressions are evaluated and interpolated. The `f` prefix is analogous to backtick template literals in JavaScript or C++'s `printf` format specifiers.
- **`{gpa:.2f}`:** The `:.2f` format specifier inside the braces tells Python to format `gpa` as a float with exactly two decimal places. `3.819` rounds to `3.82` in the output, which is what the test checks. The variable still holds the original value `3.819` — the formatting happens only at display time.
- **Variables, not literals:** The test uses AST inspection to ensure you used the variable names (`name`, `year`, `major`, `gpa`) inside the f-string rather than hard-coding the values as strings.
- **Dynamic vs. weak typing:** Python infers `year` as `int` and `gpa` as `float` from the assigned values — no type declarations needed. But Python will refuse `"Year: " + year` (a `TypeError`) because it won't silently coerce `int` to `str`.

---

## Step 3: The Indentation Trap — `grades.py`

```python
# Fixer Upper: both bugs fixed
scores = [95, 83, 71, 62, 55]

for score in scores:
    if score >= 90:
        print(f"Score {score}: A")    # Bug 1 fixed: indented 8 spaces
    elif score >= 80:
        print(f"Score {score}: B")    # Bug 2 fixed: f-string instead of + concatenation
    elif score >= 60:
        print(f"Score {score}: C")
    else:
        print(f"Score {score}: F")
```

**Why this is correct:**

- **Bug 1 — indentation error:** The original `print(f"Score {score}: A")` was at the same indentation level as `if score >= 90:`, which is an `IndentationError`. The body of an `if` block must be indented one level further. Python uses indentation (4 spaces) instead of `{}` to define blocks — this is the most common negative-transfer mistake from C++.
- **Bug 2 — type error:** The original `print("Score " + score + ": B")` fails with `TypeError: can only concatenate str (not "int") to str`. Unlike C++, Python will not silently convert `score` (an `int`) to a string when concatenating. The fix is to use an f-string: `f"Score {score}: B"`, which handles the conversion automatically.
- The tests verify that scores 95, 83, and 71 produce the correct letter grades A, B, and C respectively.

---

## Step 4: Functions — `functions.py`

```python
def mean(numbers):
    """Return the arithmetic mean of a list of numbers."""
    return sum(numbers) / len(numbers)

def label_score(score, threshold=50):
    """Return 'pass' if score >= threshold, else 'fail'."""
    if score >= threshold:
        return 'pass'
    else:
        return 'fail'

# --- Quick self-test ---
data = [4, 8, 15, 16, 23, 42]
print(f"Data: {data}")
print(f"Mean: {mean(data)}")
print(f"Score 75: {label_score(75)}")
print(f"Score 30: {label_score(30)}")
print(f"Score 75 (threshold=80): {label_score(75, 80)}")
```

**Why this is correct:**

- **`mean`:** `sum(numbers)` and `len(numbers)` are Python built-ins. In Python 3, `/` always performs **float division** (`sum / len` returns a `float`), so `mean([4, 8, 15, 16, 23, 42])` returns `18.0`, not `18`. The test checks `== 18.0`. This is different from C++ where `int / int` would be integer division.
- **`label_score` with default parameter:** `threshold=50` is a default parameter — calling `label_score(75)` uses `50` as the threshold (returns `'pass'`), while `label_score(75, 80)` overrides it with `80` (returns `'fail'`). Default parameters must always come after required parameters in the signature.
- **`return` is explicit:** Unlike C++ (which has undefined behavior for missing `return`), Python functions without `return` silently return `None`. You must write `return 'pass'` explicitly.
- **`def` vs C++:** Python's `def` requires no return type or parameter types — Python infers types dynamically at runtime.

---

## Step 5: Loops — `loops.py`

```python
def running_total(numbers):
    """Return a list of cumulative sums.
    Example: running_total([1, 2, 3]) == [1, 3, 6]
    """
    result = []
    total = 0
    for n in numbers:
        total += n          # add n to the running sum
        result.append(total)  # append the current cumulative total
    return result

# --- Quick self-test ---
data = [4, 8, 15, 16, 23, 42]
print(f"Data:          {data}")
print(f"Running total: {running_total(data)}")

# Verify your understanding of / vs //
print(f"7 / 2  = {7 / 2}")    # 3.5
print(f"7 // 2 = {7 // 2}")   # 3
```

**Why this is correct:**

- **`for n in numbers:`** Python's `for` loop iterates over items directly — no index variable needed. This is cleaner than C++'s `for (int i = 0; i < nums.size(); i++)`.
- **`total += n`:** Adds each element to the running sum before appending.
- **`result.append(total)`:** `list.append()` is Python's equivalent of `std::vector::push_back()`. Appending `total` (not `n`) gives the cumulative sum at each position.
- **`result = []`:** Initializes an empty list. `total = 0` is the accumulator. Both must be initialized before the loop.
- **`7 / 2` → `3.5`:** Python 3's `/` always gives a `float`. For C++-style integer division, use `//` (`7 // 2` → `3`). This is one of the most common negative-transfer traps from C++.
- The test checks `running_total([1, 2, 3]) == [1, 3, 6]` — after the first iteration: `total = 1`, second: `total = 3`, third: `total = 6`.

---

## Step 6: List Comprehensions — `listcomp.py`

```python
from functions import mean

def above_average(numbers):
    """Return a list of numbers strictly greater than the mean."""
    avg = mean(numbers)
    return [x for x in numbers if x > avg]

def squares_up_to(n):
    """Return [1**2, 2**2, ..., n**2] using range() and **."""
    return [x**2 for x in range(1, n + 1)]

# --- Quick self-test ---
data = [4, 8, 15, 16, 23, 42]
print(f"Data:          {data}")
print(f"Above average: {above_average(data)}")
print(f"Squares to 5:  {squares_up_to(5)}")
```

**Why this is correct:**

- **`above_average`:** The general form is `[expression for variable in iterable if condition]`. The condition `x > avg` is strictly greater than (not `>=`), as the test checks `above_average([4, 8, 15, 16, 23, 42]) == [23, 42]`. The mean is `18.0`; only `23` and `42` are strictly above it.
- **AST check:** The test uses Python's `ast` module to verify that `above_average` contains a `ListComp` node. A manual `for` loop with `append` would pass functionally but fail this test — you must use list comprehension syntax.
- **`squares_up_to`:** `range(1, n + 1)` generates `1` through `n` inclusive (stop is exclusive, so we need `n + 1`). `x**2` uses the `**` exponentiation operator — not `^` which is bitwise XOR in Python. The test checks `squares_up_to(5) == [1, 4, 9, 16, 25]`.
- **`**` operator check:** The test also uses AST inspection to confirm `squares_up_to` contains a `BinOp` with `Pow` — you must use `**`, not `math.pow()`.

---

## Step 7: Reading Files with open() and with — `word_count.py`

```python
# SUB-GOAL: Initialize the counter
total = 0

# SUB-GOAL: Open and read the file
with open("data.txt") as f:
    for line in f:
        words = line.split()
        # SUB-GOAL: Accumulate the count
        total += len(words)

# SUB-GOAL: Report the result
print(f"Total words: {total}")
```

**Why this is correct:**

- **`with open("data.txt") as f:`** The `with` statement is Python's context manager for resource management — it guarantees the file is closed when the block exits, even if an exception occurs. This is analogous to RAII in C++. Without `with`, you must manually call `f.close()`, and if an exception occurs before that line, the file handle leaks.
- **`for line in f:`** Files are directly iterable in Python. Each iteration yields one line including the trailing `\n`. This is memory-efficient — only one line is in memory at a time (important for large files).
- **`line.split()`** without arguments splits on any whitespace and discards empty strings, so `len(words)` correctly counts the words per line.
- **`total += len(words)`:** Accumulates the count across all lines. The three lines in `data.txt` have 9 + 9 + 6 = 24 words. The test checks for `'Total words: 24'` in the output.
- **No `line.strip()` needed here:** `split()` without arguments already handles the trailing `\n` by splitting on all whitespace.

---

## Step 8: Regular Expressions in Python: the re Module — `log_parser.py`

```python
import re

with open("log.txt") as f:
    text = f.read()

# 1. Extract all timestamps (HH:MM:SS) and print count
timestamps = re.findall(r'\d{2}:\d{2}:\d{2}', text)
print(f"Timestamps found: {len(timestamps)}")

# 2. Extract all ERROR lines and print count
errors = re.findall(r'ERROR.*', text)
print(f"Errors: {len(errors)}")

# 3. Redact IPv4 addresses and print redacted log
redacted = re.sub(r'\d+\.\d+\.\d+\.\d+', 'x.x.x.x', text)
print(redacted)
```

**Why this is correct:**

- **`re.findall(r'\d{2}:\d{2}:\d{2}', text)`:** `\d{2}` matches exactly two digits; the colons are literal. This matches all 6 timestamp entries (`09:23:11`, `09:23:45`, etc.). The test checks for `'Timestamps found: 6'` in the output.
- **`re.findall(r'ERROR.*', text)`:** `ERROR` matches the literal word; `.*` matches everything to the end of the line (`.` doesn't match `\n` by default in Python's `re`). This finds the 2 ERROR lines. The test checks for `'Errors: 2'`.
- **`re.sub(r'\d+\.\d+\.\d+\.\d+', 'x.x.x.x', text)`:** `\d+` matches one or more digits; `\.` matches a literal dot (unescaped `.` would match any character). This replaces both `192.168.1.42` and `10.0.0.7` with `x.x.x.x`. The tests check that `x.x.x.x` appears in the output and that `192.168.1.42` does not.
- **Raw strings (`r'...'`):** The `r` prefix prevents Python from interpreting backslashes before `re` sees them. `r'\d+'` passes the two-character sequence `\d` to the regex engine; without `r`, `'\d'` would be just `'d'`.
- **`f.read()` vs line-by-line:** This step uses `f.read()` to load the entire file as a string, because `re.findall()` and `re.sub()` operate on a string. This is fine for small log files; for very large files, you'd process line by line.

---

## Step 9: sys.argv & stderr — `safe_word_count.py`

```python
import sys

# 1. Check sys.argv — error to stderr + exit(1) if no filename
if len(sys.argv) < 2:
    print("Error: no filename given", file=sys.stderr)
    sys.exit(1)

# 2. Print "Reading: <filename>" to stderr
filename = sys.argv[1]
print(f"Reading: {filename}", file=sys.stderr)

# 3. Count words, print "Total words: <count>" to stdout
total = 0
with open(filename) as f:
    for line in f:
        total += len(line.split())

print(f"Total words: {total}")
```

**Why this is correct:**

- **`sys.argv`:** A list where index `0` is the script name and index `1` onwards are the arguments. `len(sys.argv) < 2` means no filename was given. This mirrors C/C++'s `argc < 2` check.
- **`print(..., file=sys.stderr)`:** The `file=` keyword argument redirects the print to `sys.stderr` instead of `sys.stdout`. This is Python's equivalent of C++'s `std::cerr` and Bash's `echo "error" >&2`. Mixing error messages into stdout would corrupt pipelines.
- **`sys.exit(1)`:** Terminates the process with exit code 1 — the Unix convention for failure. The test captures this as a `SystemExit` exception.
- **`print(f"Reading: {filename}", file=sys.stderr)`:** Diagnostic/progress messages go to stderr. The test captures stderr separately and checks for `'Reading: data.txt'`.
- **`print(f"Total words: {total}")`:** Normal output goes to stdout (the default). The test checks stdout for `'Total words: 24'` when `data.txt` is passed. The word count logic is identical to Step 7.

---

## Step 10: Capstone: Build a Log Analyzer — `log_analyzer.py`

```python
import sys
import re

def count_by_level(text, level):
    """Return the number of lines matching the given log level."""
    return len(re.findall(rf'{level}.*', text))

def extract_ips(text):
    """Return all unique IP addresses found in text."""
    return set(re.findall(r'\d+\.\d+\.\d+\.\d+', text))

def parse_args():
    """Validate and return the filename argument."""
    if len(sys.argv) < 2:
        print("Error: no filename given", file=sys.stderr)
        sys.exit(1)
    return sys.argv[1]

def read_log(filename):
    """Read and return the full log file as a string."""
    print(f"Reading: {filename}", file=sys.stderr)
    with open(filename) as f:
        return f.read()

def print_report(text):
    """Print the analysis report to stdout."""
    lines = text.strip().splitlines()
    total = len(lines)
    unique_ips = len(extract_ips(text))
    errors = count_by_level(text, 'ERROR')
    warnings = count_by_level(text, 'WARNING')

    print("Log Analysis Report")
    print("===================")
    print(f"Total lines:    {total}")
    print(f"Unique IPs:     {unique_ips}")
    print(f"Errors:         {errors}")
    print(f"Warnings:       {warnings}")

# Main flow
filename = parse_args()
text = read_log(filename)
print_report(text)
```

**Why this is correct:**

- **`parse_args()`:** Validates `sys.argv`, prints an error to `sys.stderr`, and calls `sys.exit(1)` if no argument is given. The test captures `SystemExit` and verifies the exit code is non-zero.
- **`read_log()`:** Prints `"Reading: <filename>"` to `sys.stderr` (the test captures stderr and checks for this). Returns the full file content as a string for regex processing.
- **`count_by_level(text, 'ERROR')`:** Uses `re.findall(r'ERROR.*', text)` — `.*` matches to end of line. The log has 2 ERROR and 1 WARNING line. Tests use regex `re.search(r'[Ee]rror.*2', output)` so the label can be `Errors:` or `errors:`.
- **`extract_ips(text)` with `set(...)`:** `re.findall()` returns all IP matches including duplicates. Wrapping in `set()` removes duplicates. `len(set(...))` is the Pythonic one-liner for counting unique items. The log has 2 unique IPs.
- **`total = len(text.strip().splitlines())`:** `splitlines()` splits on newlines and handles the trailing newline correctly (unlike `split('\n')` which would include an empty string). The log has 6 lines.
- **Function decomposition:** The capstone explicitly rewards a function-based design — each function has a single responsibility, making it testable and readable.
