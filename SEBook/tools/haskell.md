---
layout: sebook
title: Haskell
---

# Your Learning Path

Haskell makes familiar problems look different: values stay immutable, functions are ordinary values, and a program evaluates expressions as their results are needed. This three-part path adapts CS131 functional-programming lectures, homework topics, quizzes, and past exams into original interactive practice. Bring experience with functions, conditionals, lists, and basic recursion in Python or C++; no prior Haskell is required.

1. **[Expressions, Types, and Recursion](/SEBook/tools/haskell-tutorial)** — 10 steps, about 90–110 minutes. Predict function application, repair type and boundary errors, work with tuples and lists, then build a budget-limited prefix selector. [Part 1 print view](/SEBook/tools/haskell-tutorial/print).
2. **[Functions and Laziness](/SEBook/tools/haskell-functions-tutorial)** — 8 steps, about 80–100 minutes. Work with map/filter, lambdas, closures, currying, composition, folds, and finite observations of infinite lists. Finish with an independent pipeline. [Part 2 print view](/SEBook/tools/haskell-functions-tutorial/print).
3. **[Data and Persistent Programs](/SEBook/tools/haskell-data-tutorial)** — 9 steps, about 100–115 minutes. Model alternatives and records, use constrained generic types, transform recursive data, reason about persistent updates, and build a pure event simulator. [Part 3 print view](/SEBook/tools/haskell-data-tutorial/print).

Take the parts in order, preferably across separate study sessions. The times are estimates, not deadlines; each part includes a suggested break.

# A Useful Study Loop

Before running an example, commit to a prediction and a reason. Compare the output with that prediction, explain the gap, then change one thing. The checks call your functions on several inputs, including empty collections and exact boundaries. Hints become more specific as you open them; instructor solutions are available for comparison after an attempt.

Passing the checks gives evidence about the behavior you implemented. To test your understanding, explain why the solution works and invent an input that would reject a tempting wrong approach. Return the next day and recreate a short function from memory. A week later, try one capstone with different example data before consulting your notes.

# The Browser Workspace

The tutorials use the site's locally pinned MicroHs Haskell runtime. **Run** reloads the current workspace and executes the supplied `main` display action; **Test My Work** checks the functions directly. A new step has its own starter, and **Reset Step** restores that starter. The normal tutorial controls provide hints, progress, and print views.

The runtime supports the course features exercised in this path: ordinary expressions and types, patterns, recursion, comprehensions, higher-order functions, lazy lists, algebraic data, records, type constraints, and module imports. It is a compact implementation rather than the complete Glasgow Haskell Compiler toolchain. Compiler messages can differ from the lecture's interpreter. Interactive terminal input, external packages, and compiler-specific extensions are not part of these exercises. Monad theory is outside the supplied course's Haskell scope; the output harness is provided.

For language reference after practice, consult the [Haskell report on expressions](https://www.haskell.org/onlinereport/haskell2010/haskellch3.html) and [declarations and bindings](https://www.haskell.org/onlinereport/haskell2010/haskellch4.html). The course lessons keep application grouping distinct from evaluation order and distinguish a fold's grouping from the demand needed to evaluate its result.
