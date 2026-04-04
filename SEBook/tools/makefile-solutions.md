---
title: "Makefiles — Sample Solutions"
layout: sebook
---

# Makefiles: From Pain to Power (C Edition) — Sample Solutions

These are reference solutions for each exercise in the interactive tutorial.
Each solution explains **why** it is correct, connecting the code back to the
concepts taught in that step.

---

## Step 1: The Pain of Manual Compilation — `math.c`

Fix the missing semicolon in `math.c`:

```c
int add(int a, int b) {
    return a + b;   // Bug fixed: added the missing semicolon
}
```

Then recompile:

```bash
cd make_project
gcc main.c math.c io.c -o app
```

**Why this is correct:**

- **Test 1:** `grep -q 'a + b;' math.c` — the semicolon must be present at the end of the `return` statement.
- **Test 2:** `[ -f app ]` — the compiled executable `app` must exist.
- **The pain of manual compilation:** After fixing the one-character bug, you had to re-type (or recall) the entire `gcc` command to recompile all three files — even `main.c` and `io.c` were untouched. This is the core problem Make solves: in a 500-file project, fixing one typo means recompiling everything.

---

## Step 2: Your First Makefile & The Tab Trap — `Makefile`

Fix the spaces-to-Tab issue with `sed`, then verify:

```bash
# Replace the 4 leading spaces with a real Tab character
sed -i 's/^    /\t/' Makefile

# Verify the Tab is there (recipe lines show as ^I in cat -A)
cat -A Makefile

# Run make — should now compile successfully
make
```

The corrected `Makefile` (with a real Tab before `gcc`):

```makefile
app: main.c math.c io.c
	gcc main.c math.c io.c -o app
```

**Why this is correct:**

- **Test 1:** `grep -qP '^\tgcc' Makefile` — the recipe line must start with a real Tab character (`\t`), not spaces. `grep -P` uses Perl-compatible regex where `\t` matches a literal Tab.
- **Test 2:** `[ -f app ]` — Make must have run successfully and produced the `app` executable.
- **The Tab Trap:** Make's parser uses the Tab character specifically to identify recipe lines. Spaces look identical on screen but cause the infamous `missing separator. Stop.` error. Most editors silently convert Tab keypresses to spaces, which is why this trap catches beginners.
- **`sed -i 's/^    /\t/'`:** `s/pattern/replacement/` substitutes the pattern. `^    ` matches four spaces only at the start of a line (`^` anchors to line start). `\t` is a Tab character. `-i` edits the file in-place.

---

## Step 3: Don't Repeat Yourself (DRY) with Variables — `Makefile`

```makefile
CC = gcc
CFLAGS = -Wall -std=c11

app: main.o math.o io.o
	$(CC) $(CFLAGS) main.o math.o io.o -o app

main.o: main.c
	$(CC) $(CFLAGS) -c main.c

math.o: math.c
	$(CC) $(CFLAGS) -c math.c

io.o: io.c
	$(CC) $(CFLAGS) -c io.c
```

**Why this is correct:**

- **Test 1:** `grep -q 'CC *=' Makefile` — the `CC` variable must be defined.
- **Test 2:** `grep -q 'CFLAGS *=' Makefile` — the `CFLAGS` variable must be defined.
- **Test 3:** `grep -q '\$(CC)' Makefile` — `$(CC)` must appear in the file (replacing the hardcoded `gcc`).
- **Test 4:** `make && [ -f app ]` — the build must still succeed.
- **DRY principle:** Before this refactor, `gcc -Wall -std=c11` appeared 4 times. With `CC = gcc` and `CFLAGS = -Wall -std=c11`, a switch from `gcc` to `clang` requires editing exactly one line. This is the same principle as C++ `#define` or Python constants.
- **`$(CC)` syntax:** Make expands variables with `$(VAR_NAME)` or `${VAR_NAME}`. The parentheses (or braces) are required for multi-character variable names — `$CC` alone would be interpreted as `$C` followed by the literal character `C`.

---

## Step 4: Smarter Rules: Automatic Variables & Patterns — `Makefile`

```makefile
CC = gcc
CFLAGS = -Wall -std=c11
OBJS = main.o math.o io.o

app: $(OBJS)
	$(CC) $(CFLAGS) $^ -o $@

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@
```

**Why this is correct:**

- **Test 1:** `grep -q 'OBJS *=' Makefile` — the `OBJS` variable must be defined.
- **Test 2:** `grep -q '\$(OBJS)' Makefile` — `$(OBJS)` must appear in the `app` rule.
- **Test 3:** `grep -qP '%\.o.*:.*%\.c' Makefile` — a pattern rule `%.o: %.c` must exist.
- **Test 4:** `grep -qP '\$[<^@]' Makefile` — at least one automatic variable (`$<`, `$^`, or `$@`) must be used.
- **Test 5:** `make && [ -f app ]` — build must succeed.
- **`$^` (all prerequisites):** In the `app` rule, `$^` expands to `main.o math.o io.o` — all the files listed in `$(OBJS)`. This replaces the repetitive `main.o math.o io.o` in the recipe.
- **`$@` (target name):** In the `app` rule, `$@` expands to `app`. In the pattern rule when building `math.o`, `$@` expands to `math.o`.
- **`$<` (first prerequisite):** In the pattern rule, `$<` expands to the `.c` file (e.g., `math.c`). Using `$<` instead of `$^` compiles only the single matching source file.
- **Pattern rule `%.o: %.c`:** The `%` wildcard matches any filename stem. This single rule replaces all three explicit `.o` rules. Adding `newfile.c` to `OBJS` is all that's needed — no new explicit rule required.

---

## Step 5: The Magic of Incremental Builds

```bash
# Run make — should say "make: 'app' is up to date"
make

# Touch math.c to simulate a change (updates its timestamp)
touch math.c

# Run make again — only math.c is recompiled
make
```

**Why this is correct:**

- **Test:** `[ math.o -nt main.o ]` — `math.o` must be newer than `main.o`. After `touch math.c` + `make`, only `math.c` → `math.o` was recompiled, so `math.o` has a newer timestamp than `main.o` (which was not recompiled).
- **Make's timestamp heuristic:** Make compares the last-modified time of each target against its prerequisites. If a prerequisite is newer than the target, the target is out-of-date and its recipe runs.
- **`touch math.c`:** Updates `math.c`'s modification timestamp without changing its content. Make sees `math.c` is now newer than `math.o` and recompiles just that one file, then re-links `app`. `main.c` and `io.c` are untouched.
- **Why this matters:** In a large project, this turns a potential hours-long full rebuild into a seconds-long incremental one.

---

## Step 6: The .PHONY Sabotage — `Makefile`

Add the `clean` target and `.PHONY` declaration:

```makefile
CC = gcc
CFLAGS = -Wall -std=c11
OBJS = main.o math.o io.o

app: $(OBJS)
	$(CC) $(CFLAGS) $^ -o $@

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

.PHONY: clean
clean:
	rm -f *.o app
```

**Why this is correct:**

- **Test 1:** `grep -q '\.PHONY:.*clean' Makefile` — `.PHONY: clean` must appear in the file (before or after the `clean:` rule).
- **Test 2:** `grep -q 'clean:' Makefile && make clean >/dev/null 2>&1 && [ ! -f app ] && ! ls *.o 2>/dev/null` — the `clean` target must exist, `make clean` must succeed, and afterwards no `app` or `.o` files should remain.
- **The sabotage scenario:** If a file named `clean` exists in your project directory and `.PHONY` is absent, Make thinks `clean` is a real file target. Since `clean` has no prerequisites, Make sees it as always up-to-date and refuses to run the recipe (`make: 'clean' is up to date.`).
- **`.PHONY: clean`:** Tells Make that `clean` is a command name, not a filename. Make ignores any file on disk named `clean` and always runs the recipe. Always declare non-file targets (like `clean`, `test`, `all`) as `.PHONY`.
- **`rm -f *.o app`:** `-f` suppresses errors when files don't exist. Without it, `make clean` would fail if called when already clean.

---

## Step 7: Mastering Make

No file edits are required for this step — it is a review and summary.

```bash
# Review the complete, professional Makefile you've built:
cat Makefile

# Final build to confirm everything still works
make clean
make
```

**The complete professional `Makefile`:**

```makefile
CC = gcc
CFLAGS = -Wall -std=c11
OBJS = main.o math.o io.o

app: $(OBJS)
	$(CC) $(CFLAGS) $^ -o $@

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

.PHONY: clean
clean:
	rm -f *.o app
```

**Why this is correct:**

- This Makefile demonstrates every concept from the tutorial in 10 lines:
  - **Variables (`CC`, `CFLAGS`, `OBJS`):** DRY principle — change the compiler or flags in one place.
  - **`$(OBJS)` prerequisite:** Declarative dependency graph — Make knows which `.o` files `app` needs.
  - **`$^` and `$@`:** Automatic variables — no repetition of filenames in the link command.
  - **Pattern rule `%.o: %.c`:** One rule handles all source files; adding `newfile.c` just requires adding `newfile.o` to `OBJS`.
  - **`.PHONY: clean`:** Guarantees `make clean` always runs regardless of filesystem state.
  - **Tab characters on recipe lines:** The invisible but critical requirement that separates Make from all other config formats.

**Key concept connections:**

| Makefile feature | Why it matters |
|---|---|
| Tab trap | Parser requirement — spaces cause `missing separator` error |
| Variables (`CC`, `CFLAGS`) | DRY — one-line change to switch compilers |
| Pattern rule `%.o: %.c` | Scalable — one rule for any number of source files |
| Automatic variables `$@`, `$<`, `$^` | No filename repetition in recipes |
| Timestamp-based DAG | Incremental builds — only recompiles what changed |
| `.PHONY` | Non-file targets always run, even if a same-named file exists |
