---
title: "RegEx Tutorial: Basics"
layout: sebook
---


<div class="rt-progress-label" id="rt-progress-label">0 / 16 exercises completed</div>
<div class="rt-progress">
  <div class="rt-progress-fill" id="rt-progress-fill"></div>
</div>

This hands-on tutorial will walk you through Regular Expressions step by step. Each section builds on the last. Complete exercises to unlock your progress. Don't worry about memorizing everything — focus on understanding the **patterns**.

Regular expressions look intimidating at first — that's completely normal. Even experienced developers regularly look up regex syntax. The key is to break patterns into small, logical pieces. By the end of this tutorial, you'll be able to read and write patterns that would have looked like gibberish an hour ago. If you get stuck, that means you're learning — every programmer has been exactly where you are.

**Three exercise types** appear throughout:
- **Build it** (Parsons): drag and drop regex fragments into the correct order.
- **Write it** (Free): type a regex from scratch.
- **Fix it** (Fixer Upper): a broken regex is given — debug and repair it.

Your progress is saved in your browser automatically.

# Literal Matching

The simplest regex is just the text you want to find. The pattern `cat` matches the exact characters **c**, **a**, **t** — in that order, wherever they appear. This means it matches inside words too: `cat` appears in "edu**cat**ion" and "s**cat**ter".

Key points:
- RegEx is **case-sensitive** by default: `cat` does not match "Cat" or "CAT".
- The engine scans left-to-right, reporting every non-overlapping match.

<div class="rt-section" data-section="Literal Matching"></div>


# Character Classes

A **character class** `[...]` matches any **single character** listed inside the brackets. For example, `[aeiou]` matches any one lowercase vowel.

You can also use **ranges**: `[a-z]` matches any lowercase letter, `[0-9]` matches any digit, and `[A-Za-z]` matches any letter regardless of case.

To **negate** a class, place `^` right after the opening bracket: `[^a-z]` matches any character that is **not** a lowercase letter — digits, punctuation, spaces, etc.

<div class="rt-section" data-section="Character Classes"></div>


# Meta Characters

Writing out full character classes every time gets tedious. RegEx provides **meta character** escape sequences:

| meta character | Meaning | Equivalent Class |
|-----------|---------|-----------------|
| `\d` | Any digit | `[0-9]` |
| `\D` | Any non-digit | `[^0-9]` |
| `\w` | Any "word" character | `[a-zA-Z0-9_]` |
| `\W` | Any non-word character | `[^a-zA-Z0-9_]` |
| `\s` | Any whitespace | `[ \t\n\r\f]` |
| `\S` | Any non-whitespace | `[^ \t\n\r\f]` |

The **dot** `.` is a wildcard that matches **any single character** (except newline). Because the dot matches almost everything, it is powerful but easy to overuse. When you actually need to match a literal period, **escape it**: `\.`

<div class="rt-section" data-section="Meta Characters"></div>


# Anchors

**Before reading this section**, try the first exercise below. Use what you already know to write a regex that matches *only* if the entire string is digits. You'll discover a gap in your toolkit — that's the point!

So far every pattern matches **anywhere** inside a string. **Anchors** constrain *where* a match can occur without consuming characters:

| Anchor | Meaning |
|--------|---------|
| `^` | Start of string (or line in multiline mode) |
| `$` | End of string (or line in multiline mode) |
| `\b` | Word boundary — the point between a "word" character (`\w`) and a "non-word" character (`\W`), or vice versa |

Anchors are critical for **validation**. Without them, the pattern `\d+` would match the `42` inside `"hello42world"`. Adding anchors — `^\d+$` — ensures the **entire** string must be digits.

Word boundaries (`\b`) let you match whole words. `\bgo\b` matches the standalone word "go" but not "goal" or "cargo".

<div class="rt-section" data-section="Anchors"></div>


# Quantifiers

Quantifiers control **how many times** the preceding element must appear:

| Quantifier | Meaning |
|------------|---------|
| `*` | Zero or more times |
| `+` | One or more times |
| `?` | Zero or one time (optional) |
| `{n}` | Exactly *n* times |
| `{n,}` | *n* or more times |
| `{n,m}` | Between *n* and *m* times |

**Common misconception: `*` vs `+`**

Students frequently confuse these two. The key difference:
- `a*b` matches `b`, `ab`, `aab`, `aaab`, ... — the `a` is **optional** (zero or more).
- `a+b` matches `ab`, `aab`, `aaab`, ... — at least **one** `a` is required.

If you want "one or more", reach for `+`. If you genuinely mean "zero or more", use `*`. Getting this wrong is one of the most common sources of regex bugs.

<div class="rt-section" data-section="Quantifiers"></div>


# Alternation & Combining

The **pipe** `|` works like a logical OR: `cat|dog` matches either "cat" or "dog". Alternation has low precedence, so `gray|grey` matches the full words — you don't need parentheses for simple cases.

When you combine multiple regex features, patterns become expressive:
- `gr[ae]y` — character class for the spelling variant.
- `\d{2}:\d{2}` — two digits, a colon, two digits (time format).
- `^(0[1-9]|1[0-2])/(0[1-9]|[12]\d|3[01])$` — a month/day format validator. (It accepts impossible combinations like `02/30` and `04/31`; properly validating month-specific day limits — let alone leap years — is beyond what regex alone can express, and is one of the classic limits of regex pattern matching.)

Start simple and add complexity only when tests demand it.

<div class="rt-section" data-section="Alternation & Combining"></div>

---

You've completed the basics! You now know how to match literal text, use character classes, metacharacters, anchors, quantifiers, and alternation.

**Ready for more?** Continue to the [Advanced RegEx Tutorial](/SEBook/tools/regex-tutorial-advanced.html) to learn greedy vs. lazy matching, groups, lookaheads, and tackle integration challenges.

<script src="/js/regex-tutorial.js"></script>
