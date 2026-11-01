# Local tutor coaching implementation plan

> **For agentic workers:** Use Superpowers executing-plans for the main work and a
> focused parallel investigation for independent engine safeguards. Keep unrelated
> worktree edits. No commits or publication are requested.

**Goal:** Improve the local tutor using observed chats, without replacing the learner's reasoning.

**Architecture:** Source-validated coaching moves and authored questions → validated
draw_diagram request → separate ArchUML generation with a checked call graph. Full in-memory turns and explicit context recovery.

**Tech stack:** Existing browser JavaScript modules, WebLLM/wllama/ONNX, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-01-local-tutor-coaching-design.md`.

## Global constraints

- Same 3B model, 2048-token context, 768-token ONNX input cap; no new model files.
- Retain complete source/guidance; keep tests/solutions out of tutor prompts.
- No specification/code answers, implicit recap, automatic history clipping or
  silent retries with missing context.
- New runtime behavior must update tutorial-authoring documentation.

## Review focus

- Long learner evidence and corrections survive beyond two exchanges.
- Output exhaustion never commits a partial answer to dialogue history.
- Context errors preserve the draft and transcript and give a workable restart.
- Malformed, duplicate or unknown tool requests never execute arbitrary actions.
- Stopping during a second generation or rendering cannot publish a late result.

## Task 1: Evidence and prompt structure

- [x] Record real baseline conversations outside the repository.
- [x] Evaluate concise coaching prompt against misconception, correction, answer
  pressure, missing prerequisite, closure and an unfamiliar follow-up.
- [x] In prompts.mjs and a focused tutor module, preserve complete turns; add
  behavioral unit tests before replacing truncation and inline syntax cards.

## Task 2: Bounded diagram generation

- [x] Implement parse/validate + second-generation orchestration, with a single
  supported tool and no recursion. Add failing tests for malformed/multiple
  requests, plain replies, diagram failure and cancellation first.
- [x] Wire the existing addon and rendering boundary; keep the coach text if an
  optional diagram fails. Verify real model requests and real rendered output.

## Task 3: Context and chat lifecycle

- [x] Disable native context shifting; classify pinned engine context errors.
- [x] Retain complete successful turns and preserve drafts/transcripts on errors.
  Provide explicit learner recap recovery and focused accessible browser tests.
- [x] Verify native full-context behavior using the real cached model.

## Task 4: Verification and documentation

- [x] Run focused unit/integration/browser checks and screen accessibility checks.
- [x] Rehearse complete conversations through the UI; distinguish measured model
  behavior from deterministic transport fixtures.
- [x] Update tutorial instructions, architecture skill and documentation; record
  observed successes, unresolved failures and a small independent-learning pilot.
- [x] Obtain a fresh review, fix material issues, refresh port 4020 and report.

## Completion evidence

Real WebLLM episodes and rejected prompt variants are summarized in
`docs/local-tutor-evaluation.md`. Context exhaustion preserved the loaded model,
draft and transcript; an explicit learner recap recovered. The final two-stage
model drawing rendered a verified call map. Focused unit checks and 79 browser
checks passed; interactive accessibility checks were enabled. Fresh review found
and resolved diagram answer-label/alias bypasses, an absent-diagram fallback,
negated visual routing, and missing download controls on tutor-only steps.
No commits, publication, model changes or large repository assets were requested.
