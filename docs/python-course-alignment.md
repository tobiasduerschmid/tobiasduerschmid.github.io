# Python chapter and CS131 practice alignment

The [Python chapter](../SEBook/tools/python.md) serves students who already know
basic C++ and need to reason about Python programs in CS131. Its central model
is object identity, references, mutation, and rebinding. Later sections apply
that model to calls, object-oriented interfaces, closures, iteration, and
concurrent tasks.

## Source scope

The source collection is the user-supplied
`drive-download-20261006T220654Z-1-001.zip` (October 6, 2026). Reviewed evidence
includes the Essential Python handouts and lecture notes, the other language
concept lecture notes, homework assignments and problems, past quizzes and
exams, and learning-assistant worksheets. PDF page numbers below are physical
pages starting at 1. DOCX locators use problem labels or topic headings because
their pagination depends on the renderer.

The archive contains no standalone interpreter-project specification. Project
preparation therefore covers the Python prerequisites described in the course
notes and interpreter-related homework: recursive data, dictionaries, scope
lookup, explicit error translation, and separation of host-language behavior
from the language being implemented. This is not a claim to cover an unseen
project specification. Instructions inside course documents are evidence about
student tasks, not instructions governing repository work.

Programs, questions, and answers added here are newly authored. Source problem
names identify the assessed concept; they are not programs to reproduce or
solution keys to republish. Python-looking pseudocode for hypothetical languages
does not establish actual Python implementation guarantees.

## Coverage map

This map includes retained coverage as well as additions. It maps Python
language concepts, not every algorithm, language comparison, or non-Python
topic in the course.

| Course concept and principal evidence | Chapter coverage | Practice evidence |
| --- | --- | --- |
| Environment setup: Homework PYTHON1; Essential Python notes | Environments, Imports, and Program Entry; virtual environments and interpreter selection | Environment quiz; import/environment explanation card |
| Execution, syntax, types, scope: Essential Python and Data notes; Homework TYPING4 and TYPING10 | Execution model, indentation, LEGB, unbound locals, comprehension scope, type hints, dynamic versus weak typing | Local-name card; evaluation-order and runtime-type checks |
| Object references, identity, reachability: Essential Python handouts pp. 2–5, 13; Homework DATA3 | Objects, None, garbage collection, identity versus equality; distinguish reachability from collection timing | Existing identity/reference practice; new cycle-copy card |
| List “arrays,” references in slots, nested sharing: Essential Python pp. 17–21; Quiz 1 Problem 2C–D | Collections; replacement versus mutation; slicing versus slice assignment; independent and shared rows | Slice-write and comprehension questions; independent-grid writing card |
| Class and instance state: Essential Python pp. 6–7; OOP notes | Class objects, shared counters, lookup and shadowing, mutable class attributes, explicit self | Retained class-state questions and new classmethod practice |
| Assignment, shallow copy, deep copy: Essential Python pp. 8–10; Midterm F24 V1 Problem 4, pp. 7–8 | Copies & Equality; outer slots versus children; dictionary/list/tuple combinations; repeated shallow copies and deep-copy boundaries | Copy-depth questions, separate-copy-operation question, copy repair cards |
| Tuple immutability with mutable children: Homework PYTHON4 | Dictionary/list/tuple trace; tuple augmented-assignment puzzle | Tuple-child question; tuple replacement explanation card |
| Parameter mutation, rebinding, and boxing: Essential Python pp. 22–24; Homework PYTHON2; Quiz 1 Problem 2A–B | Six calls; integer and mutable holder; two aliased parameters; comparison with C++ value/pointer/reference parameters | Holder-rebinding and two-parameter practice |
| Copies within functions: Homework PYTHON3; Midterm S23 V1 Problem 6, pp. 6–7 | Combining a Parameter with a Shallow Copy; nested mutation versus outer replacement | Shallow-parameter-records question; retained Parsons and repair items |
| Returned aliases followed by attribute replacement: Midterm F23 Problem 1, pp. 2–3 | Returned References Survive Attribute Replacement | Returned-list question and nested-isolation getter repair card |
| Default argument evaluation and persistence: Essential Python pp. 25–27; Function notes and Homework FUNC1 | Definition-time immutable defaults; persistent dictionaries; constructor defaults; explicit arguments; None repair preserving empty input | Dictionary-rebind, immutable-default, constructor-sharing, and ownership-contract questions; set-default and initializer repair cards |
| Strings, numbers, collections, loops, unpacking: Essential Python notes and worksheets | Text & Numbers; Collections; comprehensions, enumerate, slicing, truthiness, chained comparisons | Retained syntax decks and puzzles; new comprehension-order question |
| Functions as values, purity, closures, currying: Functional and Function notes; Homework HASKELL7 and ADVHASKELL1–4; Final F23 | Functions & Iteration; local versus external mutation, map/filter/reduce, captured bindings, nonlocal, partial application | Closure, curry, lazy-map, and purity questions; closure construction and mutation cards |
| Recursion and pattern matching: Homework HASKELL2, HASKELL9, TYPING10, and LOGIC6 | Recursive structured data; base cases and contracts; match/case guards and captures; environment membership and lexical-scope boundaries | Recursive-leaves, match-capture, and zero-valued binding questions; recursive count and lookup construction cards |
| Object protocols and interfaces: Homework PYTHON5, OOP1, OOP5–6; OOP notes; Final F24 V1 Problem 5 | Properties, naming conventions, operator methods, inheritance, dynamic dispatch, class/static methods, cooperative super, mixins, abstract base classes | Property, classmethod, operator, multiple-inheritance, and abstract-contract questions; super and abstraction cards |
| Iterators and generators: Control notes; Homework CTRL2–3; Final F24 V1 Problem 6; Final F23 traversal questions | Independent iterator positions, exhaustion, custom iterator, lazy generator execution, yield from, finite consumption | Iterator and generator questions; write-next and filtering-generator cards |
| Exceptions and cleanup: Function notes; exception questions in past finals | Narrow handlers, propagation, handler order, else, finally, custom errors, with, mutations surviving failure | Finally-order and no-rollback questions; finally-return card |
| Threading and async: Control notes; Homework CTRL4–6 | Scheduling versus parallelism, start/join, synchronization, GIL qualification, coroutine versus task, await boundaries | Scheduling and GIL questions; coroutine/task explanation and concurrent-task construction cards |
| Script tools and OpenCL: Essential Python notes and handouts p. 29 | Files, imports, main guard, command-line arguments, regex, OpenCL sidebar | Retained scripting practice; new module-entry question |

## Example variation and assessment design

Early examples isolate one distinction: replacing a slot versus mutating its
referent, or rebinding a parameter versus editing a shared holder. Later examples
combine several already introduced rules: a function copies an outer list,
mutates a nested record, replaces a different record, and returns the copy.
Arrays use built-in Python lists; NumPy views are explicitly outside that rule.

The examples change structure as well as names and constants. For example,
copying is practiced across dictionaries containing tuples and mutable lists,
shared children across separate deep-copy calls, and copies made inside a
function. Defaults vary across integers, lists, dictionaries, sets, constructors,
omitted arguments, and explicitly supplied empty objects.

Prediction prompts precede worked explanations. “One-change” questions expose
the critical distinction; writing cards require a repair from a stated contract.
Distractor feedback explains the mistaken object or control-flow model and is
safe when choices shuffle. Difficulty labels are author estimates, not measured
learner performance. No claim of learning gains follows from automated checks.

## Practice wiring

The chapter embeds both general Python practice and the CS131 object-semantics
decks. SE Gym discovers these active data files through its existing catalog;
there is no separate copy of the new questions to maintain.

| Data file | Items after update | Newly added |
| --- | ---: | ---: |
| `_data/quizzes/python.yml` | 62 questions | 23 |
| `_data/quizzes/cs131_python.yml` | 28 questions | 12 |
| `_data/flashcards/python_syntax_explain.yml` | 41 cards | 13 |
| `_data/flashcards/python_syntax_generate.yml` | 26 cards | 8 |
| `_data/flashcards/cs131_python.yml` | 22 cards | 12 |

Existing identifiers and chapter anchors remain stable. Class Objects stays at
`#class-objects` but is demoted from the top navigation to make room for Functions
& Iteration. Practice remains optional; the three-pass reading route supports
using the long chapter over separate study sessions.

## Language accuracy boundaries

The chapter links official Python references for copying, defaults, inheritance,
abstract base classes, environments, threading, and async tasks. These qualify
lecture shorthand: deep copying need not duplicate every immutable value;
copies can preserve cycles and shared children; class bodies execute at class
definition; a tuple's members may refer to mutable objects; type hints do not
automatically enforce calls; and the GIL is not a universal Python requirement
or a substitute for synchronization.

## Verification record

Verified on October 6, 2026:

- A full Jekyll build succeeds; the built-site quiz/flashcard include audit finds
  no missing data. All 68 added practice identifiers occur in both the chapter
  and the SE Gym catalog. Chapter fragment links resolve, HTML identifiers are
  unique, and the training opt-out metadata remains present.
- All 34 added standalone chapter programs execute. All 26 added quiz programs
  produce the exact marked output. Eighteen flashcard snippets execute with
  their stated result or intentional exception; twelve solution contracts were
  exercised, including fresh defaults, supplied empty containers, independent
  rows/copies, empty/exhausted iterators, recursive input, and scheduling both
  async tasks before waiting. Conceptual answers were reviewed separately.
- Quiz metadata, identifier uniqueness, answer indices, and distractor feedback
  validate. The multiple-choice clue audit reports no flags in either updated
  quiz file.
- The existing object-reference chapter smoke test and SE Gym mobile flashcard
  readability test pass. The canonical screen and print WCAG audits pass for
  `/SEBook/tools/python.html`, `/glossary/`, and `/se-gym/`, with zero automated
  findings. Screen coverage includes light/dark modes, keyboard focus, and mobile
  reflow. This scoped automated result is not a full manual conformance finding
  for every site page or interactive state.
