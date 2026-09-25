# Python tutorial review

Reviewed 24 September 2026. Target: the entire 20-step working-tree tutorial, not just its diff from `f82a351c0a2af77924eb1fdcf5f5985cff81e038`.

## Assessment

The object-model sequence is a substantial improvement: names, list entries, members, class objects, copying, equality, calls, defaults, and dispatch form a coherent progression. Later questions retrieve these ideas in new contexts. The concrete reference diagrams support that progression without introducing UML notation.

The tutorial still needs assessment repairs. Its reference solutions pass, but several graders accept the misconception they are intended to detect, while others reject correct Python because of formatting or import spelling. Some older explanations also teach incorrect C++/shell comparisons. These are actionable defects, rather than evidence that the whole sequence needs redesign.

This report records findings, reproductions, and proposed repairs. The review itself does not apply those repairs. The separately requested Mac shortcut label and optional step navigation are implementation work, not remedies for the grader findings below. Optional navigation reduces the harm of a misleading gate but does not make its feedback correct.

**Priority:** P2 means a substantive correction to make before relying on the affected exercise as evidence of learning. P3 means a useful refinement. No P0 issue was identified. Findings are grouped by repair, rather than counted once for every failing assertion.

## Evidence and limits

- Read all 20 steps, including instructions, starters, solutions, feedback, and all 83 authored grader commands.
- Manually reviewed all 100 embedded quiz questions, answer keys, and explanations; independently executed 33 quiz computations and a counterexample to the indentation question.
- Executed 90 grader scenarios: all 20 reference solutions plus 70 correct alternatives or deliberately incorrect variants. All 83 reference-solution checks pass.
- Ran the existing Python browser suite: **49/49 passed**. Independently reproduced nine grading cases in the browser's Pyodide runtime, including both false acceptance and false rejection.
- Exercised all eight final-step questions separately; the required final quiz completed successfully. The regular Python suite skips that final quiz.
- Reproduced legacy progress restoration in an isolated browser context. No user progress was changed.
- The MCQ wording lint reported no length/formatting tells. This does not establish factual correctness, shuffle safety, or useful distractors.
- Existing live/print diagram and accessibility results from the preceding implementation are useful baseline evidence; this review is not a new comprehensive WCAG certification. No learner outcome, retention, timing, or difficulty data were collected.

Review lenses: both requested pedagogical-advisor skills; tutorial-authoring; CS tutorial design; quiz-format; test-design; and the Superpowers review workflow. The pedagogical conclusions below concern observable alignment and opportunities to reason, not predicted numerical learning gains.

Source locations below refer to `_data/tutorials/python.yml` unless a different file is named. They describe the reviewed snapshot; subsequent edits can shift line numbers.

## Grading findings

### G1 — P2: the required type-hint experiment makes correct work fail

**Locations:** task line 3164; behavior checks 3298–3314.

The task emphatically requires uncommenting `print(mean(['a', 'b']))`. The graders execute the whole file without catching the deliberately generated `TypeError`. Completing that instruction on top of the correct solution produces **4/6 passing checks**, including in Pyodide. The provided solution quietly leaves it commented.

**Repair:** explicitly tell learners to restore the comment after the experiment, or isolate the experiment from the graded definitions. Preserve the useful distinction between an error caused by the function body and enforcement of annotations.

### G2 — P2: annotation grading is both too restrictive and too permissive

**Locations:** 3243–3296.

Correct `numbers:list[float]`, `score:int`, and `->float:` formatting gets **4/6**. Changing the parameter annotation to the wrong `list[str]`, or removing `first_failing`'s return annotation, gets **6/6**. Source-substring matching checks spelling and spacing, while a global count of seven annotations misses one of the eight required positions.

**Repair:** check each specified function, parameter, and return annotation semantically. Keep explicitly required constructs, but allow formatting variants. An unrelated annotation or an import elsewhere must not satisfy the requirement. Add positive controls using alternative whitespace and negative controls with a missing/wrong annotation.

### G3 — P2: equality grading accepts field identity comparisons

**Locations:** 2358–2364, 2375–2379, 2389–2395.

This incorrect replacement passes **3/3**, both natively and in Pyodide:

```python
return self.title is other.title and self.artist is other.artist
```

The equal fields in the tests use repeated literals, so their identity happens to coincide with their value. A separate variant that accepts any object with `title` and `artist` also passes, although the task explicitly requires `NotImplemented` for non-Recording operands.

**Repair:** create equal-but-distinct strings dynamically for both fields and establish that distinction in the fixture. Include an unrelated object with matching attributes. Check the result, not the literal use of `==` or `isinstance`.

### G4 — P2: the capstone never tests uniqueness

**Locations:** sample log near 5120; unique-IP check 5237–5247.

The fixture contains two addresses without repetitions. Removing `set(...)` from `extract_ips` still passes **7/7**, including in Pyodide. The capstone's own quiz identifies this exact mistake, but its exercise accepts it.

**Repair:** include repeated addresses and a different address, plus a no-address input. Assert the resulting unique count. This is a core requirement, not an adversarial hardcoding concern.

### G5 — P2: numeric output checks accept incorrect larger values

**Locations:** 4273–4279, 4581/4592, 4886, 5233/5246/5259/5272.

The word-count checks accept `Total words: 240` where 24 is required. Multiplying all capstone counts by ten produces 60/20/20/10 and still passes **7/7**. Substrings and unbounded regular expressions match the expected digits inside the wrong numbers. Removing the capstone header also passes despite the specified report format.

**Repair:** parse complete labeled numeric fields or compare complete expected report lines. Be strict where the task explicitly specifies a format, and tolerant of harmless whitespace elsewhere. Check the final word-count record rather than accepting an intermediate subtotal.

### G6 — P2: command-line tests do not establish that the supplied file is read

**Locations:** step 18 checks 4862–4891; step 19 checks 5201–5276.

Replacing `open(filename)` with `open('data.txt')` or `open('server.log')` passes **3/3** or **7/7**. Every grader supplies that same sample filename and content. Step 18 also accepts duplicating the diagnostic on stdout, contrary to the taught separation of streams.

**Repair:** invoke the script with a second temporary filename containing different data, including an empty file where appropriate. Verify stdout and stderr separately. Keep the existing meaningful missing-argument/exit-status checks.

### G7 — P2: regex grading accepts incomplete and overbroad replacement

**Locations:** 4596–4603.

Adding `count=1` to the solution's `re.sub` leaves the second address unchanged yet passes **5/5**, including in Pyodide. The grader checks only the first address's absence and the existence of a replacement. Replacing escaped dots with wildcard dots also passes the current fixtures.

**Repair:** compare the whole redacted result: every address changed, surrounding text preserved. Add a non-address numeric string whose separators are not dots. Full IPv4 range validation is outside the stated exercise.

### G8 — P2: valid import forms are rejected

**Locations:** regex AST check 4565–4571; dataclass AST check 5748–5763.

Both `from re import findall, sub` and `import re as regex` perform the requested operations but get **4/5**. `import dataclasses` with `@dataclasses.dataclass(frozen=True)` gets **8/9** despite correct behavior and passing the semantic dataclass check. These failures reproduce in Pyodide.

**Repair:** resolve imports/aliases when checking an explicitly requested construct, or use the existing semantic check where sufficient. The library/construct requirement is legitimate; mandating a particular local name is not.

### G9 — P2: cumulative sums can mutate the caller and still pass

**Locations:** task 3587–3588; checks 3661–3678.

This implementation passes **3/3**, contradicting “returns a new list”:

```python
def running_total(numbers):
    for i in range(1, len(numbers)):
        numbers[i] += numbers[i - 1]
    return numbers
```

A second variant starting with `[numbers[0]]` passes while failing for an empty list.

**Repair:** assert the returned identity differs from the input and that the input remains unchanged. Include empty, singleton, zero, and mixed-sign cases. This is also an opportunity to assess the earlier reference lessons through actual code.

### G10 — P2: required iteration constructs and input variation are incompletely checked

**Locations:** 3588, 3876–3877, 4017–4029.

`list(itertools.accumulate(numbers))` passes the exercise that explicitly requires a `for` loop. A manual loop passes `squares_up_to`, which explicitly requires a list comprehension; a fixed `[1, 2, 3, 4, 5]` also passes despite requiring `range`. The AST check examines exponentiation only. Retaining `range(1, 6)` regardless of `n` passes because the only tested bound is 5.

**Repair:** check the explicitly required constructs inside the target function, plus behavior for another positive bound and the documented boundaries. Preserve equivalent comprehensions, variable names, and comparison direction. These construct checks would enforce the teaching contract, not over-specify it.

### G11 — P2: function tests miss fractional means and threshold equality

**Locations:** 1037–1079.

Each of these errors independently gets **6/6**:

```python
return sum(numbers) // len(numbers)
```

```python
return 'pass' if score > threshold else 'fail'
```

All tested means are integral; no tested score equals its threshold.

**Repair:** include `[1, 2] → 1.5` and both default/custom threshold boundaries. Do not invent a contract for the mean of an empty list. Numeric correctness is the objective; requiring a specific implementation is unnecessary.

### G12 — P2: geometry tests establish only one triangle and omit field types

**Locations:** 5732–5743 and the surrounding Point/RGB checks.

`round(sqrt(x*x + y*y), 0)` passes **9/9** despite returning 1.0 for `(1,1)`. Even `float(self.x + 2)` passes; only `(3,4)` is exercised. Changing the required Point `int` annotations to `str` also passes.

**Repair:** test origin, an axis, a negative coordinate, and a nonintegral distance with an appropriate tolerance. Check the required field/property annotations. Retain the useful frozen-field, equality, attribute-style access, and RGB leading-zero tests. `math.hypot` is a valid alternative and already passes.

### G13 — P2: member-object tests miss ordering and unrelated state destruction

**Locations:** 1586–1589, 1603–1609, 1840–1843.

`insert(0, item)` passes both “append” exercises (**3/3** each), because the fixture adds the same object twice. Playlist `rename` can also reset `self.tracks = []` and pass **3/3**, despite the contract saying it updates only `name`.

**Repair:** append distinct objects in an order containing a repetition, and check their identities in order. Rename a populated playlist, retaining and comparing the queue and artist references afterward. Do not require an actual `append` call; slice-based appending is equally valid.

### G14 — P2: flat-list identity preservation is checked for only one input

**Locations:** 1318–1329.

`opening + copy.deepcopy(late)`, followed by extending with `encore`, passes **3/3**. Only `opening` contains a mutable marker, although the contract promises to preserve every supplied track's identity.

**Repair:** place distinct mutable markers in all three inputs and check every resulting element's identity. Keep the existing empty-list, duplication, new-outer-list, and input-preservation checks.

### G15 — P2: the indentation exercise can omit a required result

**Locations:** 802–823.

Deleting the final `else` branch still gets **4/4**, even though score 55 is not reported. Score 62 is unasserted too.

**Repair:** check all five required score/grade records. A normalized sequence of records can allow harmless spacing while detecting omissions.

### G16 — P3: profile formatting is only partially checked

**Locations:** 367–395.

An unlabeled `3.820` passes the two-decimal GPA check; splitting the required one-line profile across lines also passes **5/5**.

**Repair:** check the complete profile record, including its GPA label and two decimal digits, while allowing the starter's separate type-demonstration output. Keep the justified f-string construct requirement.

## Correctness and learning-design findings

### C1 — P2: several language comparisons teach false transfer rules

| Location | Problem | Repair |
|---|---|---|
| 279, 294 | A C++ string literal is described as `const char*`/`std::string`; an apostrophe inside double quotes is said to require escaping. | Distinguish the literal's array type from conversions. `"It's easy"` already compiles unchanged. |
| 798 | Says C++ silently converts an integer to a string during concatenation. | Contrast Python f-strings with stream insertion or explicit conversion, not a nonexistent general C++ conversion. |
| 1164 | Says `#include` brings only declarations, not executable statements. | Explain textual inclusion versus Python module execution. Included text is not restricted to declarations. [GCC documentation](https://gcc.gnu.org/onlinedocs/cpp/Include-Operation.html). |
| 3575–3576, 3647, 3728 | Calls Python floor division/remainder “like C++” without qualification. | For negative inputs Python gives `-7 // 2 == -4`, `-7 % 2 == 1`; C++ gives `-3`, `-1`. Explain floor versus truncation. [Python reference](https://docs.python.org/3.11/reference/expressions.html#binary-arithmetic-operations), [C++ draft](https://eel.is/c%2B%2Bdraft/expr.mul). |
| 4310 | Says equivalent C++ file reading requires explicit `close()` and 20+ lines. | Acknowledge scoped stream cleanup; compare the actual syntax rather than inventing missing C++ resource management. [File-buffer destructor specification](https://eel.is/c%2B%2Bdraft/filebuf.cons). |
| 4453–4454 | Equates `grep`/`grep -c` with `findall`/its length. | Distinguish matching lines from matching substrings. `ERROR ERROR` on one line gives one matching line and two matches. This matters for the capstone's line counts. |

The apostrophe, literal type, and negative-arithmetic cases were also verified with a compiled C++17 example. These corrections matter particularly because this tutorial explicitly teaches through the learner's C++ and shell knowledge.

### C2 — P2: the indentation quiz has an overgeneralized answer

**Locations:** question 867–883; related explanation 730.

The question says mixing tabs and spaces in the same file raises an error. A file can use tabs consistently in one block and spaces consistently in another and execute successfully. Python rejects ambiguous/inconsistent indentation, not every file containing both. The feedback even claims the parser refuses to assign a tab width, contrary to its documented rule. [Python lexical reference](https://docs.python.org/3/reference/lexical_analysis.html#indentation).

**Repair:** show a concrete inconsistent snippet, or qualify the stem. Keep “use consistent spaces” as style guidance. Also distinguish syntactically invalid indentation from valid indentation that places a statement in the wrong block.

### L1 — P2: a few objectives depend on instruction supplied too late

**Locations:** Functions objectives/task 922, 957–970; import-guard question 1149–1164; capstone 5073–5111.

- The first `mean` task arrives before a learner-facing explanation of `/` versus `//`; that distinction appears in the solution and quiz, with fuller instruction much later. Introduce it immediately before the first attempt and use a fractional prediction.
- Functions promises keyword-argument use without showing a keyword call in the lesson. Add a call such as `label_score(75, threshold=80)` and one small use task.
- The import guard is called “spaced review,” but earlier exposure is mainly a passing quiz mention. Give it a brief worked example before testing it as retrieval.
- The capstone explicitly requires a `set` without earlier worked use, while claiming that all component skills are already taught. Its hint reveals `len(set(...))` rather than establishing the duplicate-removal model. Teach sets briefly beforehand, or label a just-in-time example openly as new instruction.

These are local prerequisite repairs. They do not justify moving the entire object-model sequence or adding another large theory section.

### L2 — P2: indentation hints direct attention toward the wrong defect

**Locations:** 809–825.

The exercise contains an indentation error and a string/int concatenation error. Its hints ask about thresholds, ordering conditions, and adding `elif` branches, although those parts are already correct in the starter.

**Repair:** first direct attention to the exception's line and block ownership; then contrast the operands in the failing concatenation. Keep grade-logic hints only for an actual grade-logic failure. Formative feedback should help learners localize the observed problem.

### L3 — P2: several prediction/run instructions cannot be followed as written

**Locations:** 3527–3533, 4189, 5599–5608.

The word-count prompt asks learners to run an unfinished starter to check their prediction, but both accumulation and output are `pass`; it prints nothing. The `range` demonstration contains bodyless `for` statements that cannot be run as displayed. The dataclass starter asks learners to uncomment `a.x = 99` after TODO 2, while `a = Point(3, 4)` is in a different block that says to wait until all TODOs are finished. Following that order gives `NameError`, not the intended frozen-field exception.

**Repair:** compare the word count after implementation, or provide a runnable worked example. Give syntax fragments a visible label, or add `print(i)` bodies. Make the frozen-field probe self-contained with its own instance construction; offer checks after individual TODOs.

### L4 — P3: some prediction answers are already visible

**Locations:** 526, 1215, 1460, 1739, 3155; coverage document 81–82.

Several exact answers or answer-bearing diagrams sit immediately alongside a request to predict. The coverage document overstates how consistently reveals protect answers. Put these explanations in the existing reveal pattern after the learner commits an answer. Preserve worked examples where showing the answer is intentional; the issue is claiming a prediction opportunity while displaying its answer. This is a design inference, not a measured learning deficit.

### C3 — P3: qualify memory and resource claims

**Locations:** 4334–4341, 5010-era file-cleanup question.

Line iteration does not guarantee constant memory regardless of file size: its input memory depends on the longest line, and accumulating all results consumes additional memory. A 2 GB text file also does not imply exactly 2 GB of decoded string storage. Similarly, omitting `with` removes deterministic context-manager cleanup; it does not guarantee that a file handle will never be reclaimed automatically.

**Repair:** say “bounded by the current line and any results retained” and explain deterministic closure without overclaiming inevitable leakage. Keep `with` as the recommended practice.

### C4 — P3: an explanation is not shuffle-safe

**Location:** 456.

“The `%` operator (option D)” refers to the authored option position, while options shuffle. The operator also remains supported in Python 3; calling it “the old Python 2 way” is misleading.

**Repair:** refer to “the `%`-formatting expression” by content and describe it as an older formatting style. [Python string-formatting reference](https://docs.python.org/3/library/stdtypes.html#printf-style-string-formatting).

## Runtime and regression-suite findings

### R1 — P2: inserted steps inherit unrelated saved completion evidence

**Locations:** tutorial introduction 64–68; `js/tutorial-code.js` 1185–1204 and 10650–10658.

The old tutorial had 12 steps. Restoring an old completed attempt at zero-based step 11 opens the new **Inheritance and Method Dispatch** step, with its tests and quiz already recorded as passed. Before the optional-navigation change, Next proceeded to Type Hints without the new inheritance quiz. The warning is only in step 1 and was not visible on this resumed path.

**Repair:** version completion evidence or map stable step identifiers during migration, preserving file drafts. Surface any migration message at the restored step. The new permission to skip steps makes navigation access intentional; it does **not** make inherited pass marks accurate.

### R2 — P2: the browser suite does not establish grader quality

**Locations:** `tests/python-tutorial.spec.js` 60–73 and 265–289; `tests/tutorial-helpers.js` 115–169.

The suite loads the authored solution and reads the quiz's own answer metadata. This is appropriate for checking integration and quiz mechanics, but it cannot independently establish semantic correctness. The nine Pyodide counterexamples passed through the same UI despite the green 49-test run. The final eight-question quiz is explicitly excluded by `!isLast`; a separate manual probe showed it currently works.

**Repair:** keep the integration journey and add a small persistent corpus of meaningful correct alternatives and plausible wrong programs for the affected graders, using the lowest practical test layer. Add a final-quiz integration check and skipping/resume coverage for the newly requested optional navigation. Do not multiply full browser boots for every pure Python input partition.

The serial full-tutorial journey is a legitimate journey, not automatically a test smell. Likewise, using `applySolution` for setup is not itself a defect. Its evidence is simply narrower than “every correct student solution is accepted and every relevant error is rejected.”

## Coverage by step

| Step | What was checked / conclusion |
|---|---|
| 1 Hello | Minimal output exercise and quiz. Appropriate orientation; no substantial grader finding. |
| 2 Variables | Alternate f-string quotes accepted; precision/record oracle weak; inaccurate C++ comparisons. |
| 3 Names/references | Strong identity/rebinding/None checks; explicit-addition alternative passes. No substantive grader finding. |
| 4 Indentation | Explicit string conversion accepted; omitted F result passes; incorrect-target hints and tab/space overclaim. |
| 5 Functions | Alternate loop/conditional solutions accepted; fractional and threshold-boundary gaps. |
| 6 Lists | Strong grouping, emptiness, duplicate, and fresh-outer checks; incomplete identity coverage across inputs. |
| 7 Members | Good shared-artist and independent-queue checks; ordering and rename preservation gaps. |
| 8 Class objects | Good alias/counter/shadowing/future-instance checks; `type(self)` alternative accepted; append ordering gap. |
| 9 Copying | Strong shallow/deep boundaries and preservation of repeated internal references; wrong shallow-as-deep variant rejected. |
| 10 Equality | Useful symmetry/live-value/field tests, but identity comparison and unrelated structural operands escape. |
| 11 Calls/defaults | Strong ownership, explicit-empty-list, omitted/None, repeated-call checks; correct alternatives accepted, common errors rejected. |
| 12 Inheritance | Good inherited initialization, same-instance dispatch, evolving state, independent lists; valid `super` forms accepted. |
| 13 Type hints | Sound conceptual contrast undermined by probe conflict and source-text annotation grading. |
| 14 Loops | Output checks miss ownership, empty input, and required loop; C++ division comparison needs correction. |
| 15 Comprehensions | Strict above-average boundary is checked; squares construct and bound coverage are weak. |
| 16 Files | Valid counting alternatives accepted; output oracle and prediction/run instructions need repair. |
| 17 Regex | Correct happy path; incomplete redaction accepted, valid imports rejected, line/match equivalence wrong. |
| 18 CLI | Useful missing-argument exit/stderr checks; alternate filenames and clean stdout not established. |
| 19 Capstone | Appropriate synthesis opportunity; new set prerequisite and weak unique-count/report/input oracles. |
| 20 Dataclasses | Good frozen/equality/property/RGB coverage; insufficient distance inputs/types and excessive decorator spelling constraint. |

## What to preserve and how to repair efficiently

Preserve the progression from bindings to contained objects and then class state; the six contrasting call cases; the deep-copy example preserving repeated internal references; the later questions about comprehensions, mutable defaults, and frozen member lists; and the fresh examples and object-reference diagrams. These provide useful contrasts and repeated application across contexts.

Repair order:

1. Remove false rejection: the crashing probe, annotation spelling checks, and import/decorator spelling checks.
2. Add the few inputs that distinguish the central misconceptions: equal-but-distinct strings, fractional means, boundary scores, repeated addresses, multiple replacements, populated renamed queues, and independent return lists.
3. Replace numeric substring checks and vary command-line input files.
4. Correct transfer explanations and add the missing small prerequisites before their first assessment.
5. Complete the prediction/feedback refinements and retain regression cases for every reproduced defect.

Do not tighten tests beyond the teaching contract: exact code layout, variable names, helper decomposition, and use of a particular append/copy expression are not generally requirements. Conversely, explicitly requested f-strings, `for`, comprehensions, `range`, `**`, `super`, and dataclasses can legitimately be assessed as constructs.

Not judged as required behavior: mean/above-average on an unspecified empty domain; malformed CLI arguments or missing-file recovery; IPv6 or complete IPv4 octet validation; invalid RGB ranges; arbitrary iterables; inheritance diamonds; hostile grader evasion; long-term retention; and exact completion-time estimates. A top-level class-counter demonstration can disturb the grader's initial counter, but its contract was ambiguous, so it was not promoted to a confirmed defect.

Temporary reproduction artifacts from this review are `/tmp/review_early_python_contracts.py`, `/tmp/review_early_python_results.json`, `/tmp/review_late_contracts.py`, `/tmp/review_late_contracts_report.json`, `/tmp/python_review_quizzes.py`, `/tmp/python-review-quiz-results.json`, and `/tmp/python_review_runtime.cjs`. The prose reproductions above retain the essential evidence if temporary files are later removed.

## Follow-up usability changes and validation

During the review, the user separately requested a Mac Command-key label and the ability to skip steps. Both were implemented:

- The first Run hint displays `⌘+Enter` on Mac and `Ctrl+Enter` elsewhere, using an opt-in label helper shared by live, detached-instruction, and print views. Shortcut behavior is unchanged.
- Python enables `allow_skip_steps` and makes tests/quizzes optional. Every numbered step is selectable, including after restoring an older restricted unlock list. Exercises remain usable; skipped checks are not recorded as passes. Existing pass evidence is not migrated by this change (R1 still applies).
- All **51 Python browser checks** and **5 optional/required quiz checks** passed, with Python accessibility checkpoints enabled. A separate required-quiz popout/navigation regression also passed: **57 browser checks total** for these follow-ups.
- The shortcut helper passed Mac, Windows, Linux, dynamic replacement, print-mode, abbreviation-expansion, and scoped accessibility checks. The rebuilt in-app preview exposed all 20 step buttons as enabled.

These passing checks validate the two requested usability changes. They do not resolve or invalidate the independent assessment/content findings above.
