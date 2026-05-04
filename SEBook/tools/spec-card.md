---
layout: sebook
title: "Spec Card — fillable e2e test design tool"
permalink: /SEBook/tools/spec-card
description: "An interactive Spec Card form for e2e test design. Five fields — Behavior, Should pass when, Should fail when, Locator contract, Oracle — auto-saved to your browser. Use it before writing the test."
---

# Spec Card

A **Spec Card** is the small artifact you fill in *before* writing an end-to-end test. It forces the load-bearing question — *"what about this UI is the stable contract?"* — before you commit code that pins the wrong thing.

The card has **five fields** and **fits on one screen**. Use this tool to draft, edit, and export a Spec Card any time you're about to write a Playwright test (or any other behavior-level test). Everything is saved in your browser; nothing is sent to a server.

> **From the [Playwright tutorial — Step 2](/SEBook/tools/playwright-tutorial?step=1).** This tool is the standalone version of the Spec Card you build in the tutorial. Use it to keep a portfolio of cards as you write tests at school and at work.

{% include spec-card-form.html id="default" title="Spec Card" %}

## How to use the five fields

| Field | What goes here | What does NOT go here |
| ----- | -------------- | --------------------- |
| **Behavior** | One sentence: *what user-visible behavior are you proving?* — e.g. "User can add a todo and see it in the list." | A click sequence (`clicks add then types`). A test name (`test_add_button`). |
| **Should pass when** | Implementation changes the test must *survive* — CSS rename, restyle, layout shift, button moved to a different parent. | Behavior changes. If a change here breaks the test, that's a regression, not a survival case. |
| **Should fail when** | Regressions the test must *catch* — silent data loss, wrong count, missing element, accessibility break. | Performance issues, unrelated bugs, rendering quirks the spec doesn't promise. |
| **Locator contract** | Stable queries: `getByRole('button', { name: ... })`, `getByLabel(...)`, semantic `getByTestId('add-todo-action')`. | CSS classes, XPath, DOM positions (`> div:nth-child(2)`). |
| **Oracle** | The observable outcome that confirms success — what would the user see? E.g. "the new item appears in the list." | Internal state, Redux store contents, component prop values. |

## When to write a Spec Card

Whenever you're about to write a new e2e test. Specifically:

- **Before opening the test file.** The card is upstream of the code; if you write the test first, you've already committed to assertions before deciding what's promised.
- **Before refactoring an old test.** If you can't fill in *Should pass when* and *Should fail when* for the existing test, it's coupled to incidental detail — that's the brittleness Step 5 of the Playwright tutorial makes tactile.
- **Before discussing a flaky test on the team.** The card makes the spec explicit so the team can argue about *what's actually promised* instead of *why the test is failing*.

## What the buttons do

- **Export as Markdown.** Downloads `spec-card-default.md` (or your card's id) — paste into a PR description, a comment in the test file, or your design doc.
- **Copy to clipboard.** Same content as Export, but to the clipboard so you can paste anywhere.
- **Reset.** Clears all fields and removes this card from your browser. Asks before overwriting non-empty content.

The card auto-saves on every keystroke. The "Saved" badge confirms it's persisted. Storage details are in the [storage inventory](/cookies/) under `spec-card-<id>`.

## Pair with the Playwright tutorial

The Playwright tutorial's Step 2 introduces the Spec Card and uses it through Steps 7–8. If you haven't done it yet, the tutorial walks you through filling in your first card while writing a test against a small Todo app. Open the tutorial: [Playwright Tutorial — End-to-End Testing for React Apps](/SEBook/tools/playwright-tutorial).
