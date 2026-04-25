# Example library

A small library of well-crafted quiz questions across SE topics, each demonstrating `option_feedback` at the quality bar described in `pedagogy.md`. Use these as templates and inspiration when drafting your own.

The two flagship examples (recursion base case, unit-test properties) live in `pedagogy.md`. The examples here are deliberately compact — copy the structure, swap in your domain.

## Big-O — confusing operations with iterations

```yaml
- question: |
    What is the time complexity of this function?

    ```python
    def f(arr):
        for x in arr:
            for y in arr:
                if x + y == 0:
                    return True
        return False
    ```
  type: single
  options:
    - "O(n)"
    - "O(n log n)"
    - "O(n²)"
    - "O(2n)"
  correct_index: 2
  option_feedback:
    0: "This counts the inner work as constant. The inner loop runs `n` times for *each* of the `n` outer iterations — `n × n = n²`, not `n + constant`."
    1: "`O(n log n)` shows up for divide-and-conquer (mergesort, balanced trees). There's no halving here — both loops do a full pass."
    3: "This is the *constant-multiplier-vs-exponent* misconception. Two nested loops aren't `2 × n` work, they're `n × n` work. Big-O cares about the *shape* of growth (linear, quadratic, exponential), not the number of loops."
  explanation: "Two nested loops over the same `n`-element collection give **O(n²)**. A useful sanity check: doubling `n` should roughly *quadruple* the runtime — that's the signature of quadratic."
```

## Async/await — confusing await with blocking

```yaml
- question: |
    In JavaScript, what does `await fetch(url)` do?
  type: single
  options:
    - "Blocks the entire program until the response arrives"
    - "Pauses the current async function and yields control back to the event loop until the response arrives"
    - "Spawns a new thread that runs the network request in parallel"
    - "Returns a Promise that the next line must `.then()` to receive"
  correct_index: 1
  option_feedback:
    0: "This is the *await-blocks-everything* misconception, often imported from synchronous languages. JavaScript is single-threaded but **non-blocking** — `await` only suspends the *current* async function. The event loop continues running other tasks (other timers, UI events, other promises) while this one is waiting."
    2: "JavaScript is single-threaded — `await` doesn't spawn threads. The illusion of concurrency comes from the event loop interleaving tasks at await points, not from parallelism."
    3: "`await` *is* the `.then()` — it unwraps the Promise so the next line gets the resolved value directly. That's the whole point of `async/await` over raw Promises."
  explanation: "`await` suspends *one* async function and registers a callback on the Promise. Control returns to the event loop, which is free to run other code. When the Promise resolves, the suspended function resumes."
```

## Mutation in shared state — Python list aliasing

```yaml
- question: |
    What does this code print?

    ```python
    def add_item(item, lst=[]):
        lst.append(item)
        return lst

    print(add_item(1))
    print(add_item(2))
    ```
  type: single
  options:
    - "[1] then [2]"
    - "[1] then [1, 2]"
    - "[1, 2] then [1, 2]"
    - "TypeError: default argument cannot be a list"
  correct_index: 1
  option_feedback:
    0: "This assumes the default `lst=[]` creates a fresh list on every call. Python evaluates default arguments **once at function definition**, not on each call — the same list object is reused across calls."
    2: "This is the *late-binding-defaults* confusion in reverse. The list does mutate across calls, but each call returns the list as it stands *at that moment* — not the final state."
    3: "Mutable defaults are legal Python. They're a *gotcha*, not a syntax error — the language doesn't warn you. (PEP 8 / lint tools do.)"
  explanation: "This is the **mutable default argument** trap. Python evaluates `lst=[]` once when `def` runs, then reuses the same list across calls. The fix: use `lst=None` and create the list inside the function (`if lst is None: lst = []`)."
```

## Design patterns — multi-choice with omission, where Strategy fits

```yaml
- question: |
    Which of the following are good signals that the **Strategy** pattern may help?
  type: multiple
  options:
    - "Multiple algorithms exist for the same task and the choice depends on runtime context"
    - "A class has a long if-else chain selecting between behaviors that could be encapsulated"
    - "You want to swap algorithms in tests with cheap stand-ins"
    - "An algorithm is used in exactly one place and has been stable for years"
    - "You want to reduce the number of classes in your codebase"
  correct_indices: [0, 1, 2]
  option_feedback:
    0: "Runtime selection between interchangeable algorithms is the canonical Strategy use case — that's the force the pattern was designed for."
    1: "An if-else chain over algorithm choices is the *unrolled* form of Strategy. Refactoring to Strategy turns each branch into a class with a shared interface; the conditional disappears."
    2: "Strategy gives you a seam for test doubles. If your sort algorithm is a Strategy, your test can pass in a `RecordingSortStrategy` to inspect calls — without subclassing the unit under test."
    3: "This is the *pattern-fishing* trap — applying patterns to stable single-use code adds indirection without benefit. Strategy is for code that *will* vary, not code that *might*. If it doesn't vary, the if-else (or single function) is fine."
    4: "Strategy *increases* the class count (one per algorithm). The pattern's value is decoupling, not minimalism. If you're optimizing for fewer classes, Strategy is the wrong tool."
  explanation: "Strategy decouples *what* (the task) from *how* (the algorithm). It earns its place when the algorithm varies — at runtime, across deployment environments, or across tests. It pays no dividends for stable, single-use code."
```

## SQL — confusing aggregate with row-level filter

```yaml
- question: |
    You want every department whose **total salary expense** exceeds $1,000,000. Which clause filters by the aggregate?
  type: single
  options:
    - "WHERE SUM(salary) > 1000000"
    - "HAVING SUM(salary) > 1000000"
    - "GROUP BY salary > 1000000"
    - "ORDER BY SUM(salary) DESC LIMIT 1"
  correct_index: 1
  option_feedback:
    0: "This is the *WHERE-on-aggregates* misconception. `WHERE` is evaluated **before** `GROUP BY`, on individual rows — the aggregate doesn't exist yet at that point. Use `HAVING` for filters that depend on aggregates."
    2: "`GROUP BY` partitions rows into groups; it doesn't accept conditions. The condition belongs in `HAVING` (post-aggregation) or `WHERE` (pre-aggregation)."
    3: "This sorts and returns only the top department. The question asks for *every* department over the threshold — that's a filter (HAVING), not a top-N query."
  explanation: "SQL evaluates clauses in this order: `FROM` → `WHERE` → `GROUP BY` → `HAVING` → `SELECT` → `ORDER BY` → `LIMIT`. `WHERE` runs before grouping (filters individual rows); `HAVING` runs after grouping (filters group results)."
```

## How to write your own

When you sit down to draft `option_feedback` for a question:

1. **List the wrong options.** For each, finish the sentence: "Students who pick this are probably thinking…"
2. If you can't finish that sentence crisply for an option, *don't* write feedback for it. Move on.
3. For the ones you can answer:
   - Name the misconception with a label if one exists ("the off-by-one error", "*expert blind spot*", "the *late-binding-defaults* confusion").
   - State the proximate distinction in one sentence ("X is in C++; C uses Y").
   - If room remains within the 3-sentence budget, gesture at the *real* model — what's actually going on.
4. Read it back. Did you accidentally start with "you"? Did you repeat what `explanation:` says? If yes, rewrite.
5. Compare to the question's general `explanation:`. The two should be doing different jobs — the explanation lays out canonical reasoning; the feedback corrects a specific misconception.
