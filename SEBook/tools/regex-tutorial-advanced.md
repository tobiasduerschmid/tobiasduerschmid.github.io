---
title: "RegEx Tutorial: Advanced"
layout: sebook
---


<div class="rt-progress-label" id="rt-progress-label">0 / 16 exercises completed</div>
<div class="rt-progress">
  <div class="rt-progress-fill" id="rt-progress-fill"></div>
</div>

This is the second part of the Interactive RegEx Tutorial. If you haven't completed the [Basics Tutorial](/SEBook/tools/regex-tutorial.html) yet, start there first — the exercises here assume you're comfortable with literal matching, character classes, metacharacters, anchors, quantifiers, and alternation.

# Warm-Up Review

Before diving into advanced features, let's make sure the basics are solid. These exercises combine concepts from the Basics tutorial. If any feel rusty, revisit the [Basics](/SEBook/tools/regex-tutorial.html).

<div class="rt-section" data-section="Warm-Up Review"></div>


# Greedy vs. Lazy

By default, quantifiers are **greedy** — they match as much text as possible. This often surprises beginners.

Consider matching HTML tags with `<.*>` against the string `<b>bold</b>`:
- **Greedy** `<.*>` matches `<b>bold</b>` — the entire string! The `.*` gobbles everything up, then backtracks just enough to find the **last** `>`.
- **Lazy** `<.*?>` matches `<b>` and then `</b>` separately. Adding `?` after the quantifier makes it match as **little** as possible.

The lazy versions: `*?`, `+?`, `??`, `{n,m}?`

Use the step-through visualizer in the first exercise below to see exactly how the engine behaves differently in each mode.

<div class="rt-section" data-section="Greedy vs. Lazy"></div>


# Groups & Named Groups

Parentheses `(...)` create a **group** — they treat multiple characters as a single unit for quantifiers. `(na){2,}` means "the sequence **na** repeated 2 or more times" — matching `nana`, `nanana`, etc. You can access what each group matched by index (e.g., `match[1]`).

**Named groups** let you label what each group matches instead of counting parentheses:

| Syntax | Meaning |
|--------|---------|
| `(?<name>...)` | Create a group called *name* |
| `match.groups.name` | Retrieve the matched value in code |

For example, `^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$` matches a date and lets you access `match.groups.year`, `match.groups.month`, and `match.groups.day` directly — much clearer than `match[1]`, `match[2]`, `match[3]`.

<div class="rt-section" data-section="Groups & Named Groups"></div>


# Lookaheads & Lookbehinds

**Lookaround** assertions check what comes before or after the current position **without including it in the match**. They are "zero-width" — they don't consume characters.

| Syntax | Name | Meaning |
|--------|------|---------|
| `(?=...)` | Positive lookahead | What follows must match `...` |
| `(?!...)` | Negative lookahead | What follows must NOT match `...` |
| `(?<=...)` | Positive lookbehind | What precedes must match `...` |
| `(?<!...)` | Negative lookbehind | What precedes must NOT match `...` |

A classic use case: **password validation**. To require at least one digit AND one uppercase letter, you can chain lookaheads at the start: `^(?=.*\d)(?=.*[A-Z]).+$`. Each lookahead checks a condition independently, and the `.+` at the end actually consumes the string.

Lookbehinds are useful for extracting values after a known prefix — like capturing dollar amounts after a `$` sign without including the `$` itself.

<div class="rt-section" data-section="Lookaheads & Lookbehinds"></div>


# Putting It All Together

You've learned every major regex feature. The real skill is knowing **which tools to combine** for a given problem. These exercises don't tell you which section to draw from — you'll need to decide which combination of character classes, anchors, quantifiers, groups, and lookarounds to use.

This is where regex goes from "I can follow along" to "I can solve problems on my own".

<div class="rt-section" data-section="Putting It All Together"></div>

<script src="/js/regex-tutorial-advanced.js"></script>
