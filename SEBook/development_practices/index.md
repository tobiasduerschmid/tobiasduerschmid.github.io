---
title: Development Practices
layout: sebook
---

# Practice Across Development Practices

Use the master deck when you want a mixed review of code-reading, debugging, review, AI, prompting, code-smell, and refactoring vocabulary. Use the master quiz to practice deciding which engineering practice fits a realistic maintenance situation.

{% include flashcards.html id="development_practices" %}

{% include quiz.html id="development_practices" %}

# Code Beacons

[Code Beacons](/SEBook/development_practices/beacons.html) explains how experienced developers use familiar identifiers, structures, tests, and architectural cues as cognitive anchors while reading unfamiliar code.

# Code Comprehension

[Code Comprehension](/SEBook/development_practices/code_comprehension.html) teaches how developers form mental models of a system, why top-down reading matters, and how architecture-code gaps make comprehension harder. The [Part 1](/SEBook/development_practices/code-comprehension-tutorial) and [Part 2](/SEBook/development_practices/code-comprehension-advanced-tutorial) tutorials turn those ideas into guided practice.

# Debugging

[Debugging](/SEBook/development_practices/debugging.html) covers reproducing a fault, localizing the root cause, using debuggers and assertions, verifying the fix, and preserving the regression test. The [Python Debugging Tutorial](/SEBook/tools/python-debugging) gives hands-on practice with breakpoints and time-travel debugging.

# Defensive Programming and Design by Contract

[Defensive Programming in Python](/SEBook/development_practices/defensive-programming-tutorial) teaches boundary validation, precise exceptions, invariant preservation, and failure reporting. [Design by Contract in Python](/SEBook/development_practices/design-by-contract-tutorial) follows it with caller/callee responsibility, preconditions, postconditions, old-state reasoning, invariants, and contract strength.

# Generative AI

[Generative AI in Software Engineering](/SEBook/development_practices/genAI.html) explains how AI coding tools change productivity, verification, skill formation, supervision, and team workflows without replacing engineering judgment.

# Modern Code Review

[Modern Code Review](/SEBook/development_practices/modern_code_review.html) teaches review as a socio-technical practice: small reviewable changes, reviewer cognition, asynchronous workflows, defect finding, knowledge transfer, and AI-era risks.

# Prompt Engineering

[Prompt Engineering](/SEBook/development_practices/promptengineering.html) covers how to communicate tasks, constraints, examples, and verification expectations to AI assistants so their output is useful and reviewable.

# Code Smells

[Code Smells](/SEBook/development_practices/code_smells.html) teaches the symptoms of poor design, including long methods, large classes, duplicated code, feature envy, and deeply nested conditionals.

# Refactoring

[Refactoring](/SEBook/development_practices/refactoring.html) explains behavior-preserving transformations, safe refactoring rhythm, and the relationship between smells, tests, and design improvement. The [Code Smells and Refactoring Tutorial](/SEBook/tools/code-smells-refactoring-tutorial) provides tool-supported practice.

# Top-Down Code Comprehension

[Top-Down Code Comprehension](/SEBook/development_practices/topdown.html) focuses on hypothesis-driven reading: start from purpose and architecture, then use targeted navigation to confirm or revise the mental model.
