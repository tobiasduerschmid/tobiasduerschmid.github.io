---
title: "RegEx Tutorial: Advanced"
layout: sebook
---

<style>
/* ── Progress Bar ──────────────────────────────────────────────── */
.rt-progress { background: #e9ecef; border-radius: 8px; height: 12px; margin-bottom: 1.5em; overflow: hidden; }
.rt-progress-fill { background: linear-gradient(90deg, #2774AE, #005587); height: 100%; border-radius: 8px; transition: width 0.4s ease; width: 0%; }
.rt-progress-label { text-align: right; font-size: 0.85em; font-weight: 600; color: #555; margin-bottom: 0.4em; }

/* ── Exercise Card ─────────────────────────────────────────────── */
.rt-exercise { background: #fff; border: 1px solid #ddd; border-left: 4px solid #2774AE; border-radius: 6px; padding: 1.2em 1.4em; margin-bottom: 1.5em; transition: border-color 0.3s; }
.rt-exercise.rt-complete { border-left-color: #28a745; }
.rt-ex-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5em; }
.rt-ex-title { font-size: 1.15em; font-weight: 700; color: #005587; }
.rt-ex-status { font-size: 1.3em; color: #28a745; min-width: 1.4em; text-align: right; }
.rt-goal { margin: 0.3em 0 1em; line-height: 1.5; }

/* ── Sample Text Box ───────────────────────────────────────────── */
.rt-text-box { margin-bottom: 1em; }
.rt-text-label, .rt-tests-label, .rt-parsons-label, .rt-fixer-label { font-size: 0.82em; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #666; margin-bottom: 0.3em; }
.rt-sample { font-family: 'Courier New', Courier, monospace; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 0.8em 1em; line-height: 1.7; word-break: break-word; font-size: 0.95em; }

/* ── Match Highlighting ────────────────────────────────────────── */
.rt-match { background: #FFD100; color: #000; padding: 1px 2px; border-radius: 3px; font-weight: 600; }

/* ── Input ──────────────────────────────────────────────────────── */
.rt-input-wrap { display: flex; align-items: center; gap: 4px; margin-bottom: 0.8em; }
.rt-delim { font-family: 'Courier New', Courier, monospace; font-size: 1.2em; color: #888; font-weight: 700; }
.rt-input { font-family: 'Courier New', Courier, monospace; font-size: 1.05em; border: 2px solid #ccc; border-radius: 4px; padding: 0.4em 0.6em; flex: 1; min-width: 0; transition: border-color 0.2s; }
.rt-input:focus { border-color: #2774AE; outline: none; box-shadow: 0 0 0 3px rgba(39, 116, 174, 0.15); }
.rt-input-fixer .rt-input { border-color: #dc3545; background: #fff5f5; }

/* ── Error Display ─────────────────────────────────────────────── */
.rt-error { display: none; color: #dc3545; font-size: 0.85em; margin-bottom: 0.5em; font-family: monospace; }

/* ── Test Cases ────────────────────────────────────────────────── */
.rt-tests { margin-bottom: 1em; }
.rt-test { padding: 0.25em 0; font-size: 0.92em; transition: color 0.2s; }
.rt-test-icon { display: inline-block; width: 1.2em; text-align: center; }
.rt-test-pass { color: #28a745; }
.rt-test-pass .rt-test-icon { font-weight: bold; }
.rt-test-fail { color: #dc3545; }
.rt-test-fail .rt-test-icon { font-weight: bold; }
.rt-test-input { font-size: 0.95em; background: #f0f0f0; padding: 1px 5px; border-radius: 3px; }
.rt-test-label { color: #666; font-size: 0.9em; }
.rt-test-pass .rt-test-label { color: #28a745; }
.rt-test-fail .rt-test-label { color: #dc3545; }

/* ── Action Buttons ────────────────────────────────────────────── */
.rt-actions { display: flex; gap: 0.6em; flex-wrap: wrap; margin-bottom: 0.5em; }
.rt-btn { padding: 0.45em 1.2em; border: none; border-radius: 4px; cursor: pointer; font-size: 0.92em; font-weight: 600; transition: background 0.2s, transform 0.1s; }
.rt-btn:active { transform: scale(0.97); }
.rt-btn-check { background: #2774AE; color: #fff; }
.rt-btn-check:hover { background: #005587; }
.rt-btn-skip { background: #e9ecef; color: #333; }
.rt-btn-skip:hover { background: #dee2e6; }
.rt-btn-clear { background: #f8d7da; color: #721c24; font-size: 0.82em; padding: 0.3em 0.8em; margin-top: 0.4em; }
.rt-btn-clear:hover { background: #f5c6cb; }

/* ── Result Messages ───────────────────────────────────────────── */
.rt-result { display: none; padding: 0.6em 1em; border-radius: 4px; font-size: 0.92em; margin-top: 0.3em; }
.rt-result-pass { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
.rt-result-fail { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }

/* ── Parsons (Drag & Drop) ─────────────────────────────────────── */
.rt-parsons { margin-bottom: 1em; }
.rt-parsons-bank { display: flex; flex-wrap: wrap; gap: 6px; min-height: 42px; padding: 0.5em; background: #f8f9fa; border: 1px dashed #adb5bd; border-radius: 4px; margin-bottom: 0.5em; }
.rt-parsons-target { display: flex; align-items: center; gap: 4px; margin-bottom: 0.4em; }
.rt-parsons-drop { display: flex; flex-wrap: wrap; gap: 4px; min-height: 36px; min-width: 120px; flex: 1; padding: 0.3em 0.5em; background: #fff; border: 2px dashed #2774AE; border-radius: 4px; }
.rt-frag { display: inline-block; padding: 0.3em 0.7em; background: #e7f1fa; border: 1px solid #2774AE; border-radius: 4px; cursor: grab; font-family: 'Courier New', Courier, monospace; font-size: 1em; font-weight: 600; user-select: none; transition: background 0.15s, transform 0.15s; }
.rt-frag:hover { background: #d0e4f5; transform: translateY(-1px); }
.rt-frag.rt-dragging { opacity: 0.4; }

/* ── Fixer Hint ────────────────────────────────────────────────── */
.rt-hint { margin-bottom: 0.8em; font-size: 0.9em; }
.rt-hint summary { cursor: pointer; color: #2774AE; font-weight: 600; }
.rt-hint p { margin: 0.3em 0 0; color: #555; }

/* ── Visualizer ────────────────────────────────────────────────── */
.rt-viz { margin-top: 1em; background: #f4f7fb; border: 1px solid #d0dae8; border-radius: 6px; padding: 1em 1.2em; }
.rt-viz-title { font-weight: 700; font-size: 1em; margin-bottom: 0.8em; color: #005587; }
.rt-viz-sc { margin-bottom: 1.2em; }
.rt-viz-sc:last-child { margin-bottom: 0; }
.rt-viz-sc-label { font-weight: 600; font-size: 0.95em; margin-bottom: 0.4em; color: #333; }
.rt-viz-row { margin-bottom: 0.3em; font-size: 0.92em; }
.rt-viz-rl { font-weight: 600; display: inline-block; width: 55px; color: #555; }
.rt-viz-re, .rt-viz-str { font-family: 'Courier New', Courier, monospace; letter-spacing: 0.05em; font-size: 1.05em; background: #fff; padding: 3px 6px; border-radius: 3px; border: 1px solid #ddd; display: inline-block; }
.rt-viz-desc { margin: 0.6em 0; font-size: 0.9em; line-height: 1.5; min-height: 2.5em; color: #333; }
.rt-viz-ctrls { display: flex; gap: 0.4em; align-items: center; flex-wrap: wrap; }
.rt-viz-btn { padding: 0.3em 0.8em; border: 1px solid #adb5bd; background: #fff; border-radius: 4px; cursor: pointer; font-size: 0.85em; transition: background 0.15s; }
.rt-viz-btn:hover { background: #e9ecef; }
.rt-viz-btn-p { font-weight: 600; border-color: #2774AE; color: #2774AE; }
.rt-viz-counter { font-size: 0.82em; color: #888; margin-left: 0.4em; }

/* Visualizer highlights */
.rt-viz-hl-re { background: #FFD100; color: #000; padding: 1px 2px; border-radius: 2px; font-weight: 700; }
.rt-viz-hl-m { background: #d4edda; border-radius: 2px; }
.rt-viz-cur { border-bottom: 3px solid #dc3545; font-weight: 700; }

/* ── Self-Explanation Prompts ──────────────────────────────────── */
.rt-self-explain { margin-top: 0.8em; padding: 0.8em 1em; background: #f0f7ff; border: 1px solid #b8d4f0; border-radius: 6px; }
.rt-se-title { color: #005587; font-weight: 600; font-size: 0.95em; margin: 0; }
.rt-se-question { margin: 0.5em 0 0.3em; font-size: 0.93em; line-height: 1.5; }
.rt-se-think { margin: 0 0 0.5em; font-size: 0.85em; color: #666; font-style: italic; }
.rt-se-answer { margin-top: 0.3em; }
.rt-se-answer > summary { cursor: pointer; color: #2774AE; font-size: 0.9em; font-weight: 600; }
.rt-se-answer p { margin: 0.3em 0 0; font-size: 0.9em; line-height: 1.5; color: #333; }

/* ── Print-Only Answer ─────────────────────────────────────────── */
.rt-print-answer { display: none; }

/* ── Dark Mode ─────────────────────────────────────────────────── */
:root.dark-mode .rt-exercise { background: #1e1e1e; border-color: #444; color: #ddd; }
:root.dark-mode .rt-exercise.rt-complete { border-left-color: #28a745; }
:root.dark-mode .rt-ex-title { color: #7ec8e3; }
:root.dark-mode .rt-sample { background: #2a2a2a; border-color: #555; color: #ddd; }
:root.dark-mode .rt-input { background: #2a2a2a; border-color: #555; color: #ddd; }
:root.dark-mode .rt-input:focus { border-color: #7ec8e3; box-shadow: 0 0 0 3px rgba(126, 200, 227, 0.15); }
:root.dark-mode .rt-input-fixer .rt-input { background: #2a1a1a; border-color: #dc3545; }
:root.dark-mode .rt-test-input { background: #333; color: #ddd; }
:root.dark-mode .rt-test-label { color: #aaa; }
:root.dark-mode .rt-btn-skip { background: #333; color: #ccc; }
:root.dark-mode .rt-btn-skip:hover { background: #444; }
:root.dark-mode .rt-parsons-bank { background: #2a2a2a; border-color: #555; }
:root.dark-mode .rt-parsons-drop { background: #1e1e1e; border-color: #7ec8e3; }
:root.dark-mode .rt-frag { background: #1a3a5c; border-color: #7ec8e3; color: #ddd; }
:root.dark-mode .rt-frag:hover { background: #254a6e; }
:root.dark-mode .rt-viz { background: #1a2a3a; border-color: #3a5a7a; }
:root.dark-mode .rt-viz-title { color: #7ec8e3; }
:root.dark-mode .rt-viz-re, :root.dark-mode .rt-viz-str { background: #2a2a2a; border-color: #555; color: #ddd; }
:root.dark-mode .rt-viz-btn { background: #2a2a2a; border-color: #555; color: #ccc; }
:root.dark-mode .rt-viz-btn:hover { background: #333; }
:root.dark-mode .rt-viz-desc { color: #ccc; }
:root.dark-mode .rt-progress { background: #333; }
:root.dark-mode .rt-progress-label { color: #aaa; }
:root.dark-mode .rt-match { background: #b8960a; color: #fff; }
:root.dark-mode .rt-result-pass { background: #1a3a1a; color: #7ec87e; border-color: #2a5a2a; }
:root.dark-mode .rt-result-fail { background: #3a1a1a; color: #e87e7e; border-color: #5a2a2a; }
:root.dark-mode .rt-hint summary { color: #7ec8e3; }
:root.dark-mode .rt-hint p { color: #bbb; }
:root.dark-mode .rt-text-label, :root.dark-mode .rt-tests-label, :root.dark-mode .rt-parsons-label, :root.dark-mode .rt-fixer-label { color: #aaa; }
:root.dark-mode .rt-error { color: #e87e7e; }
:root.dark-mode .rt-btn-clear { background: #3a1a1a; color: #e87e7e; }
:root.dark-mode .rt-btn-clear:hover { background: #4a2a2a; }
:root.dark-mode .rt-goal { color: #ccc; }
:root.dark-mode .rt-delim { color: #888; }
:root.dark-mode .rt-self-explain { background: #1a2a3a; border-color: #3a5a7a; }
:root.dark-mode .rt-se-title { color: #7ec8e3; }
:root.dark-mode .rt-se-question { color: #ddd; }
:root.dark-mode .rt-se-think { color: #999; }
:root.dark-mode .rt-se-answer > summary { color: #7ec8e3; }
:root.dark-mode .rt-se-answer p { color: #ccc; }

/* ── Print Styles ──────────────────────────────────────────────── */
@media print {
  .rt-progress, .rt-actions, .rt-viz-ctrls, .rt-btn-clear, .rt-parsons-label { display: none !important; }
  .rt-print-answer { display: block !important; margin-top: 0.5em; padding: 0.4em 0.8em; background: #f0f0f0; border-radius: 4px; }
  .rt-exercise { break-inside: avoid; border: 1px solid #ccc; page-break-inside: avoid; }
  .rt-parsons-bank, .rt-parsons-target { display: none !important; }
  .rt-viz { break-inside: avoid; }
}
</style>

<div class="rt-progress-label" id="rt-progress-label">0 / 13 exercises completed</div>
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

This is where regex goes from "I can follow along" to "I can solve problems on my own."

<div class="rt-section" data-section="Putting It All Together"></div>

<script src="/js/regex-tutorial-advanced.js"></script>
