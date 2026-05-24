---
title: Debugging – Finding and Fixing Faults Systematically
layout: sebook
---

> *"Debugging is like being a detective in a crime movie where you are also the murderer."* — Filipe Fortes

Debugging is the **systematic process of finding and fixing faults** (commonly called "bugs") in a program's source code. Every working developer spends a large fraction of their time on it, and a good debugging process is one of the highest-leverage skills you can build.

# Why Debugging Skills Matter

Software defects are not a niche concern: they cost the U.S. economy roughly **$60 billion every year**, and validation activities (including debugging) consume **50–75% of development time** on a typical project. The cost isn't the hour you spent fixing the bug — it's the revenue lost, the customer trust eroded, and, in safety-critical settings, the lives placed at risk while the defect was in production.

Empirical studies of professional developers find that the best debuggers are roughly **three times as efficient** as average ones on the same defects. That gap is not innate talent; it comes from a disciplined process. The rest of this chapter is that process.

# The Search-the-Error-Message Pattern

Before you launch a full debugging session, ask whether the error is *yours* at all. If you see a message coming from a framework, library, or external service that does not directly point to a fix, you are very likely the thousandth developer to encounter it — and a 30-second search will usually surface a solution.

| When you see… | Do this |
|---|---|
| An error from a **framework, library, or service** (not your own code) | Search the error message |
| An error from your **own code** | Skip the search and start the 4-step debugging process below |

**The pattern, applied carefully:**

1. **Strip project-specific identifiers** from the input and output. `ERROR: relation "tobias_dev_orders_2026_q1" does not exist` will find very little. `ERROR: relation does not exist` will find the underlying cause. Stripping also helps with privacy — usernames, internal hostnames, and API keys do not need to be sent to third parties.
2. **Paste the cleaned message** into a search engine or AI assistant.
3. **Study results before acting.** This is where caution earns its keep. With the rise of AI agents that browse the web, *prompt injection* attacks plant malicious "fix this by running…" instructions on pages that look like normal Stack Overflow answers. Read any command before you run it; activate the shell-scripting judgment you developed in earlier chapters. A suggestion to `git push --force` to `main` or to `curl … | sudo bash` is almost never the right answer.
4. **Only after** external sources are exhausted, ask a more experienced coworker. Their time is more expensive than yours, and they will not be pleased if the answer was one search away.

# What Counts as a "Bug"? — Fault, Error, Failure

Casual conversation uses *bug* to mean any of three different things. Debugging works better when you keep them separate, because **each one is observed at a different place in the system** and points you toward a different next step.

<div class="uml-class-diagram-container" data-uml-type="state" data-uml-spec='@startuml
[*] --> Fault
Fault --> Error : program executes\nthe faulty location
Error --> Failure : incorrect state\nreaches system boundary
Failure --> [*]
note right of Fault
  An erroneous **location**
  in the code.
  e.g., variable not initialized,
  string used where a number
  was expected.
end note
note right of Error
  An incorrect **state** during
  execution.
  e.g., a variable holds the
  wrong value.
end note
note right of Failure
  Observed incorrect **outside
  behavior** at the system boundary.
  e.g., crash, wrong output, hung UI.
end note
@enduml'></div>

**Why the distinction is load-bearing:**

A `try { … } catch { … }` block that swallows an exception turns a *failure* back into a contained *error* — the user no longer sees a crash, even though the fault is still in the code. Real systems use this on purpose: **fault-tolerant systems** (think airplane flight control, payment processors) assume that faults *will* exist and design so that errors do not propagate to failures. The right level of error handling is its own design decision, covered in the [Defensive Programming chapter](/SEBook/development_practices/) — for debugging, the lesson is that *where you observe the symptom is not where you fix the bug*.

## Worked example

```python
import sys
import math

def cal_circumference(radius):
    diameter = 2 * radius
    circumference = diameter * math.pi
    return circumference

def __main__():
    try:
        input_radius = sys.argv[1]
        C = cal_circumference(input_radius)
        print(f"The circumference of a circle with radius {input_radius} is: {C}")
    except:
        print("An error occurred but there is no failure")

__main__()
```

* **Fault** — line 10. `sys.argv[1]` is always a **string**; nothing converts it to a number before it flows into `cal_circumference`.
* **Error** — inside `cal_circumference`, `radius` is `'10'`, so `diameter = 2 * radius` produces `'1010'` (Python repeats the string twice) instead of `20`.
* **Failure** — would be the wrong number printed to the user. The bare `except:` block here *prevents* the failure but masks the fault and makes the bug harder to find.

# The Four-Step Debugging Process

The rest of this chapter walks through the same four steps in order. The progression matters: skipping ahead — for example, jumping into a debugger before you can reliably reproduce the bug — wastes hours.

1. **Investigate** symptoms to reproduce the bug
2. **Locate** the faulty code
3. **Determine** the root cause
4. **Implement and verify** a fix

# Step 1: Reproduce the Bug

> **Goal:** Get to a place where you can observe the bug on demand — and, eventually, where a test can do it for you.

A bug you cannot reproduce is a bug you cannot debug. The cautionary tale: between 1985 and 1987 the **Therac-25** radiation-therapy machine killed six patients with massive overdoses. The triggering condition was an experienced operator typing faster than the developers expected — a sequence the test team had never reproduced because they typed slower. Until the team could reproduce the input sequence, the bug remained invisible.

To reproduce a bug, capture two things:

**The problem environment** — the *setting* in which the bug occurs:

* Hardware, operating system, runtime, package versions, browser
* User settings, configuration flags, feature gates
* The exact build of the software the user was running

**The problem history** — the *steps* that reach the bug:

* Sequence of data inputs and user interactions
* Communication with other components (HTTP request bodies, message-queue payloads)
* Timing, randomness seeds, physical influences where relevant (NASA's deep-space missions, for example, deal with cosmic-ray bit flips that can only be reproduced with the right hardware-level instrumentation)

This is *why* the bug-report templates of mature projects feel tedious — *"OS version? Browser? Steps to reproduce?"* That tedium is the developer's only path back to the user's experience.

## Write an Automated Bug-Reproduction Test

Once you can reproduce the bug manually, your **next step is to automate the reproduction**. A failing test is more valuable than a sticky note that says "reproduce by clicking these seven things."

* **Why automate it now, before you know the fix?** Because you are about to try a dozen possible fixes. Doing the reproduction manually each time is slow, error-prone, and (much worse) tempting to skip.
* **Simplify the test** — strip out every input detail that is not load-bearing for the failure. A 200-step reproduction usually has 5 critical steps and 195 confounders.
* **Keep the test forever.** When the fix lands, this test becomes a **regression test** that prevents the same bug from sneaking back in a future change.

You are essentially turning the user's report into a permanent, runnable specification of the bug's absence.

# Step 2: Locate the Faulty Code

> **Goal:** Reduce the search space from "the whole codebase" to "this file, probably this function."

In a well-designed system, the responsibility for the symptom should map cleanly to a single module. In any other system — which is most of them — you need tactics.

## Logging

Add logging statements that record what the program is actually doing. Python's `logging` module, JavaScript's `console.debug` / `pino`, Java's `slf4j`, Rust's `tracing` — every mature ecosystem has one. Use **levels** (`debug`, `info`, `warning`, `error`, `critical`) so production can run at `warning` while you crank it up to `debug` when investigating.

What to log:

* **Inputs**, especially unexpected ones
* **State changes** — *"transitioned from `unauthenticated` to `authenticated`"*
* **Communication with other components** — request/response payloads, message-queue events

A formatted log line such as

```
2026-05-24 14:14:47 | ERROR | main.py:34 | Failed to connect to database: 'my_db'
```

gives you a file, a line number, a level, and a human-readable message in one glance — orders of magnitude more useful than `print("here")`. For backend systems especially, **build logging in from day one**; debugging without logs is debugging with one hand tied behind your back.

## Visual Diagrams

If your codebase is a few thousand lines, reading every file to find the bug is hopeless. A component or sequence diagram that shows *what talks to what* — even a hand-drawn one — typically cuts the search drastically. Empirical studies of robotics engineers debugging unfamiliar systems found that engineers who had a generated component diagram found the faulty component significantly faster than those who only had the source code, because the diagram lets you ask *"does this component even receive the input it needs?"* before you start reading code.

This is one reason the SEBook chapters on [UML class](/SEBook/uml_class_diagram.html), [sequence](/SEBook/uml_sequence_diagram.html), [state](/SEBook/uml_state_diagram.html), and [component](/SEBook/uml_component_diagram.html) diagrams are worth the time — they pay back when something breaks.

## Focus on the Most Likely Origins

Bugs cluster. They are more likely to live in:

* **Code with [code smells](/SEBook/development_practices/code_smells.html)** — long methods, duplicated code, deeply nested conditionals. [Refactor](/SEBook/development_practices/refactoring.html) the worst offenders *before* you start debugging when you can; it often makes the bug obvious.
* **Code that was written quickly** — at 2 a.m., under deadline, by an AI agent without supervision, by a contributor unfamiliar with the module.
* **Code at boundaries** — wherever data crosses a type boundary (string ↔ number), a process boundary (request parsing, response serialization), or a security boundary.

Common low-level bugs your linter or type-checker can flag automatically: **uninitialized variables, unused values, unreachable code, memory leaks, null-pointer access, type inconsistencies.** Run the linter before you start hand-searching.

## Assertions

`assert` statements catch errors *as they happen*, at the source, rather than letting them propagate silently into something inscrutable later.

```python
def withdraw(account, amount):
    assert amount > 0, "withdrawal amount must be positive"
    assert account.balance >= amount, "insufficient funds"
    account.balance -= amount
```

An assertion failure points directly at the violated invariant, which is far easier to diagnose than the eventual `NoneType has no attribute 'balance'` three call-frames deep. Most languages let you compile assertions out of production binaries (Python's `-O` flag, C's `NDEBUG`), so the diagnostic cost is paid only during development and test runs. Some teams measure code quality in **assertions per 100 lines of code** — it is a crude metric, but a defensive program is usually a debuggable program.

Note that **assertions are not exceptions**. They are not meant to be caught and recovered from; they signal a *programmer* mistake (a violated invariant), not a *user* mistake (bad input). For graceful recovery use proper error handling; for "this should never happen" use an assertion.

# Step 3: Determine the Root Cause

> **Goal:** Understand *why* the faulty code behaves the way it does — what you believed about the program that turns out to be wrong.

## Rubber Duck Debugging

The most valuable root-cause-analysis tool costs about $3 and lives on your desk.

**Why it works:** when you read code you wrote yourself, you suffer from the **curse of knowledge** — you see what you *intended* to write, not what you *actually* wrote. The defect is on the page, but your mental model is overwriting it.

**How to apply it:** put a rubber duck (or any inanimate object — a coffee mug, a houseplant) on your desk and **explain your code to it, line by line.** At some point you will tell the duck what the next line *should* do, look at the line, and realize it doesn't do that. The duck has found your bug.

Why a duck and not a teammate? Two reasons. A teammate will interrupt and may confirm your biases. And a teammate is usually busy debugging their own code. The duck is always available, and it never agrees with you when you are wrong.

> **For students:** in this course, prefer rubber-duck debugging over asking an AI assistant to find the bug for you. The act of explaining the code is what builds the mental model you will need for the next, harder bug. Use AI for accelerating things you already understand; use the duck for things you don't yet.

## Step-Through Debugger

The second-most-valuable root-cause tool: an **interactive debugger** that lets you pause execution and inspect program state.

The core moves, supported by every modern IDE (VS Code, PyCharm, IntelliJ, Chrome DevTools…):

* **Breakpoint** — an intentional stopping point. Click the gutter to the left of a line; when execution reaches that line, it pauses *before* executing it.
* **Step over / step into / step out** — advance one line at a time; descend into a function call; pop back out to the caller.
* **Watch / inspect** — read variables in the current scope, evaluate expressions in the debug console (e.g., type `len(items) > 0` to ask a question of the running program).
* **Call stack** — see who called this function, and who called *them*.

Walking the worked-example program above through the debugger would show you, immediately:

| Line reached | Local state observed | What you learn |
|---|---|---|
| `input_radius = sys.argv[1]` (after) | `input_radius = '10'` (string) | The CLI argument is a **string** |
| `cal_circumference(input_radius)` (entered) | `radius = '10'` | The string is passed through unchanged |
| `diameter = 2 * radius` (after) | `diameter = '1010'` | `2 * '10'` *concatenates*, it doesn't multiply |
| `circumference = diameter * math.pi` | `TypeError` | The `except` swallows it as a "failure" message |

The bug isn't in `cal_circumference` at all — it's in the missing `int()` / `float()` conversion at line 10. The debugger tells you that in 30 seconds; staring at the code might take much longer.

### Run Configurations

Most IDEs let you save a **run / launch configuration** so the debugger always starts the program with the right arguments and environment. In VS Code that's a `launch.json` entry:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Python Debugger: Current File",
      "type": "debugpy",
      "request": "launch",
      "args": ["10"],
      "program": "${file}",
      "console": "integratedTerminal"
    }
  ]
}
```

For backend / Node.js / multi-process systems, the configuration grows — `--inspect` flags, port forwarding, source maps. The search engines / AI tools from the [search pattern](#the-search-the-error-message-pattern) above are well-equipped to help you write that configuration.

### Conditional Breakpoints

When a bug only manifests on the 1000th iteration of a loop, stepping through 999 boring iterations is unbearable. Right-click a breakpoint and add a **condition** (`i == 1000`, or `request.user.id == 'tobias' and request.amount > 50000`). The breakpoint only fires when the condition is true. You can also attach a **hit count** so the breakpoint triggers only on the Nth pass through the line.

### Time-Travel Debuggers

Standard debuggers go forward. A **time-travel debugger** records the execution and lets you **step backwards** — re-examine a variable's value three lines ago, hypothetically change it, and re-run forward from that point. They are not built into VS Code by default but are available as extensions for Python (`rr`, `pyrasite`), Node.js, and other runtimes. The SEBook's [Python debugging tutorial](/SEBook/tools/python-debugging) gives you a sandboxed time-travel debugger to practice with — once you have used one, you will look for them everywhere.

# Step 4: Implement and Verify the Fix

> **Goal:** Land a fix that closes the bug *and* keeps the rest of the system green.

The temptation is to call the bug "fixed" the moment the failing reproduction stops failing. Resist it. Two more steps separate a *plausible* fix from a *trustworthy* one.

## Add Assertions to Catch Nearby Bugs

The conditions that produced this bug probably hold in other places too. After the fix, sprinkle assertions on the surrounding invariants — *"radius is a number"*, *"discount is between 0 and 1"*, *"queue length is non-negative"*. They serve as live documentation and they will catch the next bug in the family before it ships.

## Run the Test Suite

Run the **regression test** you wrote in Step 1 (it should now pass) **and the rest of the suite** (none of the previously-passing tests should now fail). A fix that introduces a new bug is a [regression](/SEBook/testing.html#regression-testing) — common and embarrassing, but easy to catch if you have the discipline to re-run the suite before you call it done.

## Document the Fix

In three places:

1. **A code comment** — *only when the why is non-obvious.* `# Convert from string to float because sys.argv always returns strings` belongs in the code; `# Increment x` does not.
2. **The git commit message** — reference the bug report or ticket. `fix(checkout): convert radius from str to float (closes #4271)` is searchable forever; `fix bug` is not.
3. **The bug report itself** — close it with a short description of the root cause and the fix. This is your project's institutional memory: the next person to hit a similar symptom will find your write-up.

This last step also makes you more effective when working alongside AI coding agents — they will sometimes "helpfully" undo a non-obvious fix a few commits later if there is no comment explaining why it was non-obvious in the first place.

## Keep the Test Forever

The reproduction test you wrote in Step 1 stays in the suite as a permanent regression test. **Regression testing** — re-running existing tests after code changes to ensure new updates haven't broken old behavior — is the entire reason a green CI pipeline gives you any confidence at all.

# Debugging-Adjacent Git Tools

Two git commands deserve a mention here because they answer questions debuggers can't:

* **[`git blame <file>`](/SEBook/tools/git.html)** — for each line in the file, shows the commit that last changed it, the author, and the timestamp. *"When was this line written? What was the change that introduced it?"* GitHub renders this beautifully.
* **[`git bisect`](/SEBook/tools/git.html)** — when a regression test passes on an old commit and fails on the current commit, `git bisect` performs a binary search across the intervening commits to identify the **specific commit that introduced the bug**. With an automated test you can run `git bisect start <bad> <good> && git bisect run ./run-tests.sh` and walk away while git does the bisection. Hundreds of commits resolve in roughly $\log_2(n)$ steps.

These are covered in depth in the [Git chapter](/SEBook/tools/git.html); the point here is that they belong in your debugging toolbox, not just your version-control workflow.

# Interactive Tutorial

Want to practice the step-through debugger, breakpoints, and a time-travel debugger on real (broken) code?

* **[Python Debugging Tutorial](/SEBook/tools/python-debugging)** — work through several bugs in a sandboxed editor with a full debugger, including time-travel features.

# Practice

{% include flashcards.html id="debugging" %}

{% include quiz.html id="debugging" %}
