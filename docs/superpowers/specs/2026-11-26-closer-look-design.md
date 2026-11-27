# Closer look: optional code examples inside narrations

## Intent

At important, counter-intuitive moments of a narration (first case: Layers,
5:26, "Control flow and dependency are different relations"), a learner can
pause, study a worked code example, and continue where they left off. A learner
who already understands loses nothing. The mechanism is shared by every
narration kind (video, pattern, explainer, case study).

## Goals, non-goals, anti-goals

- Goals: opt-in, cue-anchored code examples; resume at the paused position;
  four languages; same behavior inline, in full screen, and on phones; WCAG 2.2
  AA; light, dark, and print; authored as data only.
- Non-goals (v1): non-code content (worked artifacts for process lessons),
  executable or editable code, grading.
- Anti-goals: anything that interrupts learners who skip it (no automatic
  pause), anything that covers the drawing on phones, a second code format.

## Approaches considered

- **A. In-frame detour (chosen).** A chip offers the example while its cue
  plays; opening it pauses narration and replaces the picture with a code panel
  in the same frame, like a knowledge check. Works inline, in full screen, and
  on phones; reuses the check frame and timeline. Cost: the picture is hidden
  while reading, so the panel redraws the relation as arrows between lines.
- B. Side by side: keeps the picture visible, but the fixed 16:9 stage becomes
  unreadable at half width and does not fit phones.
- C. Section below the player: simplest, but leaves the video, fails in full
  screen, and loses the pause-look-continue rhythm.
- Rejected variant: automatic hold like Pause and predict; it charges every
  learner an interruption.

## Learner behavior

- **Offer.** During its cue, a "See it in code" chip appears at the picture's
  top-right (in full screen, top-right of the picture's cell; under 600 px, a
  full-width row below the picture showing the title too). It stays while
  playback is paused inside the cue and disappears when the cue ends. A
  polite status announces it once. A code-shaped marker on the timeline row
  (square, unlike round check dots) opens it at any time, seeking to the cue
  start. Reduced motion: no entrance animation.
- **Detour.** Opening (click, tap, marker, or E while the chip shows, focus in
  the player) pauses narration, hides picture and captions, shows the panel,
  and focuses its heading. The control bar stays visible. Panel: eyebrow
  "Closer look", title, one-sentence notice, Continue narration (time) and
  Close at top; numbered step buttons (`aria-pressed`); a live step
  explanation; a code-language select (the site's shared code-language
  preference); grouped files with line numbers and highlighted focus lines;
  relation arrows drawn between anchor lines with text labels (dashed and
  solid, not color alone); footer with Replay the explanation (cue start) and
  Continue narration.
- **Leaving.** Continue resumes at the paused position and returns focus to the
  video; Escape or Close returns to the paused picture and focuses the offer;
  pressing play or seeking closes the panel. Inside the panel, keys keep their
  native behavior.
- **Phones:** arrows hidden; code scrolls horizontally in focusable, named
  `pre` regions; layer tabs become headers.
- **Notes, reader, print:** the closer look follows its cue (title, notice,
  steps, code in the chosen language); the reader shows it as a disclosure.

## Authoring contract

On a cue in `_data/narrations/<id>.yml`, beside the speech (outside the speech
fingerprint, so no audio re-render):

```yaml
closer_look:
  title: Calls go up, imports point down
  notice: One collision, two relations: ...
  code: callbacks            # block prefix in <id>_code.yml
  groups:                    # top to bottom, as the view draws them
    - {id: game, label: "«layer» Game rules"}
    - {id: engine, label: "«layer» Engine"}
  relations:
    - {kind: call, from: engine.call, to: game.handler, label: [calls ↑, at run time]}
    - {kind: dependency, from: game.imports, to: engine.contract, label: [imports ↓, dependency]}
  steps:
    - {question: Who calls whom?, focus: [engine.call, game.handler, game.start], relation: call, text: ...}
```

Code lives in the existing `_data/explainers/<id>_code.yml` schema (python,
java, cpp, typescript; `blocks` with `source` and `focus`), extended with an
a per-block `file` (or `files` for several), named `<code>_<group>`. Steps may set `remove: <group>` to show
a layer deleted. The compiler validates every reference (blocks, groups, focus
keys in every language, relation endpoints) and reports dangling ones.

Code rules: lines at most 60 characters (measured: no wrapping in the desktop panel); **Python always fully type-hinted**
(parameters, returns, attributes); idiomatic per language.

## Architecture

- `scripts/narration/compile.js` validates and exports `closer_look`.
- Build time: the code is highlighted with Rouge through the same include as
  pattern code panels; one shared include renders the panel markup.
- `js/narration-closer-look.js`, mounted by `NarrationPlayer` for every kind
  (as checks are): offer, marker, panel, pause/resume, relation drawing.
  Escape is routed through the player's existing handling.
- `css/narration-closer-look.css`: `--nja-*` tokens, dark mode (opt out of the
  page's dark-mode SVG inversion), print.
- Notes and reader reuse the same include.
- Docs and skills: `docs/narration-format.md`, `narration-authoring` skill,
  `/shortcuts/` (E), video/pattern narration skills.

## First content

Layers, `callbacks/not_uses`: game file above engine file; steps Who owns the
interface? / Who calls whom? / Who imports whom? / Remove a layer; four
languages (prototype content in the 2026-11-26 mock-up).

## Verification

Unit tests for compile validation; Playwright for offer timing, E, marker,
pause and resume position, Escape, seek closing, language switch, phone
layout, full screen, dark mode, notes/print output, and axe on the open panel.
Each test fails before the feature exists.

## Left to the builder

Exact chip copy per lesson, arrow routing details, and how the timeline row
groups a marker next to a nearby check dot.
