---
title: Test Design — Partitions, Boundaries, and Oracles
layout: sebook
---

Writing a test is not the same as choosing a good test. Many suites look thorough but share the same weakness: every case lives in the comfortable middle of the input space, where most bugs are not. Test design is the discipline of picking inputs and assertions on purpose — so a small suite finds a large number of real defects.

This page covers three complementary techniques: **equivalence partitioning**, **boundary value analysis**, and **oracle design**. Hands-on practice for all three lives in the [Testing Foundations tutorial](/SEBook/tools/testing-foundations-tutorial).

# Equivalence Partitioning

An **equivalence partition** is a set of inputs that the system should treat the same way. For a function that accepts usernames of length 3–12, the input space divides naturally into three partitions:

- **Too short** — length 0, 1, 2
- **Valid** — length 3, 4, …, 12
- **Too long** — length 13 and up

The principle: if `"a"` is rejected, `"ab"` almost certainly is too — they are in the same partition. You do not need to test every value. **One representative per partition** is usually enough for the interior of the partition.

Partitioning is **black-box**: it is derived from the specification, not the implementation. This is deliberate. Tests derived from the implementation tend to miss behavior the implementation forgot to handle.

# Boundary Value Analysis

The interior of a partition is easy; the edges are where bugs live. For the range `3 ≤ len ≤ 12`, the four critical boundaries are:

| Input length | Expected | Why test this? |
|---|---|---|
| 2 | reject | Just **below** the valid minimum |
| 3 | accept | Exactly the valid minimum |
| 12 | accept | Exactly the valid maximum |
| 13 | reject | Just **above** the valid maximum |

These four tests catch the canonical off-by-one bug — writing `>` instead of `>=`, or `<` instead of `<=`. Compare that to "try length 1, length 5, length 100": all in the middle of partitions, none on boundaries. A suite of such tests can pass even when the function rejects length 12 incorrectly.

**The heuristic.** For any function with a numeric input range `[min, max]`:

1. **Partition** the input space into regions the function should treat the same way.
2. **Pick one representative** per partition.
3. **Test every boundary** — the last invalid value before each partition change and the first valid value after it.

The same heuristic applies beyond numbers: for a string length, the empty string and a single-character string are common special boundaries; for a collection, size zero and size one often behave differently than larger sizes; for time ranges, midnight and the boundary between billing cycles deserve their own cases.

# The Invalid-Input Partition

Specifications usually describe what *valid* input looks like. The **invalid-input partition** is everything else — `None`, wrong types, malformed structures, values far outside the expected domain. Real callers are messier than the specification assumes: today the function is wired to one sanitized form, tomorrow it is imported by a new endpoint or a CLI.

A test that exercises at least one invalid input pins down the function's **contract** for future callers. This is why professional test suites always include a case like `validate_password(None)` even when the calling form can never produce a non-string.

# Oracle Design — What Makes an Assertion Strong?

A test only catches bugs if its **oracle** (the assertion that decides pass/fail) is strong enough. Compare three oracles for the *same* function call `celsius_to_fahrenheit(0)`:

| Strength | Assertion | What breaks it? |
|---|---|---|
| **Weak** | `assert result is not None` | Almost nothing — `42`, `"hello"`, and `32.0` all pass |
| **Medium** | `assert isinstance(result, (int, float))` | Type errors only — wrong numeric values slip through |
| **Strong** | `assert result == 32.0` | Any incorrect value |

A weak oracle lets most bugs through. Developers under time pressure — and AI assistants trying to "make the test pass" — often default to weak oracles because they almost always succeed. The test looks productive; it tests nothing.

The rule: **write the strongest oracle you can**. Assert on the specific expected value, not on a shape or a range, unless the range itself is what the specification requires. When a concrete expected value is expensive to compute, assert on a **property** of the output (sortedness, idempotence, conservation of count) — still strong, just expressed differently.

# Putting It Together

A competent black-box test plan for `validate_username(s)` — valid when `3 ≤ len(s) ≤ 12` — looks like this:

```python
def test_valid_representative():     assert validate_username("alice") is True      # middle
def test_too_short_just_below_min(): assert validate_username("ab")    is False     # boundary
def test_boundary_min_valid():       assert validate_username("abc")   is True      # boundary
def test_boundary_max_valid():       assert validate_username("abcdefghijkl")  is True   # boundary
def test_too_long_just_above_max():  assert validate_username("abcdefghijklm") is False  # boundary
def test_empty_string():             assert validate_username("")      is False     # edge of partition
```

Six tests, three partitions, four boundaries, one strong oracle per test. That plan catches far more real bugs than twelve tests clustered in the easy middle. When you cannot fit six, drop the middle representative last — the boundaries are doing the heavy lifting.

For interactive practice designing partitions and boundaries against live code, work through the [Testing Foundations tutorial](/SEBook/tools/testing-foundations-tutorial). For writing tests *before* the code that satisfies them, continue to the [TDD tutorial](/SEBook/tools/tdd-tutorial).
