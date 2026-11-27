# Closer Look Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any narration offer an optional, cue-anchored code example that pauses the narration when opened and resumes where it paused.

**Architecture:** `closer_look` is authored on a cue in `_data/narrations/<id>.yml` and validated by the compiler against blocks in `_data/explainers/<id>_code.yml`. A shared include renders the panel at build time with Rouge; `js/narration-closer-look.js`, mounted by `NarrationPlayer` like checks, owns offer, timeline marker, panel, pause/resume, and arrows. Notes and reader reuse the include.

**Tech Stack:** Jekyll/Liquid, Rouge, vanilla JS, Node unit tests (`scripts/tests/*.test.js`), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-26-closer-look-design.md`. Working prototype (behavior and CSS reference): `/private/tmp/claude-501/-Users-tobiasduerschmid-Projects-tobiasduerschmid-github-io/183c70fc-8230-4957-800a-20fcd70719db/scratchpad/closer-look/` (`closer-look.js`, `closer-look.css`).

## Global Constraints

- Work in a fresh worktree off `feature/architectural-style-narrations` (another session edits `arch-styles`); see memory `worktree-site-build`.
- Python examples fully type-hinted (parameters, returns, attributes). Code lines at most 58 characters. Languages: python, java, cpp, typescript.
- `closer_look` never enters the speech fingerprint (no audio re-render).
- WCAG 2.2 AA; readable text at paragraph size (inherit / em, never rem); no inline styles in authored markup; light, `html.dark-mode`, print coherent; dark mode must opt out of `html.dark-mode .post-content svg` inversion.
- Shortcut E (focus in player, chip visible) added to `shortcuts.html`.
- Tests fail before their code exists.

## Review Focus

- Language without a block for one group → compile error naming lesson, cue, language, block.
- Seeking or pressing play while open → panel closes, no double resume.
- Opening from the marker while far from the cue → seeks to cue start, Continue resumes there.
- Escape in full screen with panel open → closes panel only, stays in full screen.
- Lesson with no closer looks → no marker, no chip, no extra DOM.

---

### Task 1: Compile and validate `closer_look`

**Files:**
- Modify: `scripts/narration/compile.js` (`CUE_FIELDS`, `compileCue`, new `validateCloserLook`)
- Modify: `scripts/narration/source.js` (pass `<id>_code.yml` to validation)
- Test: `scripts/tests/narration-closer-look.test.js`

**Interfaces:**
- Produces: compiled cue field `closer_look: {title, notice, offer = 'See it in code', code, groups: [{id,label}], relations: [{kind: 'call'|'dependency', from: 'group.focus', to, label: [string,string]}], steps: [{question, text, focus: ['group.focus'], relation?, remove?}]}`; `_code.yml` blocks named `<code>_<group>` (array of files allowed via `files: [{file, source, focus}]`).
- `validateCloserLook(lessonId, cueId, look, examples) -> string[]` (error messages).

- [ ] Step 1: tests `accepts the layered example`, `rejects unknown group in focus`, `rejects focus key missing in one language` (message contains `java`), `rejects relation kind outside call|dependency`, `closer_look does not change speech_sha256`.
- [ ] Step 2: run `node --test scripts/tests/narration-closer-look.test.js` → FAIL.
- [ ] Step 3: implement; `checkSpeech` fingerprint input unchanged.
- [ ] Step 4: tests PASS; `node scripts/narration.js check` PASS.
- [ ] Step 5: commit.

### Task 2: Layered content

**Files:**
- Modify: `_data/narrations/layered_style.yml` (cue `callbacks/not_uses`)
- Create: `_data/explainers/layered_style_code.yml`

Content = prototype `LOOK` and `CODE` (Python type-hinted version, `engine/core.py`). Steps: Who owns the interface? / Who calls whom? / Who imports whom? / Remove a layer.

- [ ] Step 1: `node scripts/narration.js check layered_style` PASS, timing fingerprint unchanged; commit.

### Task 3: Panel include and styles

**Files:**
- Create: `_includes/narration-closer-look.html` (params: `topic`, `scene`, `cue`, `mode` = `player|notes|reader`)
- Create: `css/narration-closer-look.css`
- Modify: `_includes/narration-data.html` or each adapter to render one hidden panel per closer look inside `.vn-frame` / the kind's frame; load the CSS via the shared player includes.

Markup per prototype: `section.cl-panel[hidden][data-closer-look="scene/cue"]`, heading `h3` tabindex -1, steps group, `p.cl-step-text[aria-live=polite]`, language panels `[data-code-language]` highlighted with Rouge `highlight` tag, lines `.nja-code-line[data-group][data-line]`, `pre tabindex=0 aria-label=<file>`, `svg.cl-arrows`.

- [ ] Step 1: Playwright `tests/narration-closer-look.spec.js` › `layers page renders a hidden closer-look panel with four languages` → FAIL; implement; PASS; commit.

### Task 4: Runtime

**Files:**
- Create: `js/narration-closer-look.js` (`window.NarrationCloserLook.create(root, {story, timing, player}) -> {update(time), isOpen(), close()}`)
- Modify: `js/narration-player.js` (create after quiz; `canPlay` respects it; render calls `update`), `_includes/narration-player-scripts.html`, Escape routing in `js/narration-player-controls.js`.

Behavior exactly as spec "Learner behavior"; port prototype logic, replacing DOM hacks with player APIs (`player.pause()`, `play()`, `seekTo()`).

- [ ] Step 1: Playwright tests: `chip shows only during its cue`, `E opens, pauses, focuses heading`, `Continue resumes at paused time`, `Escape closes and stays paused`, `marker seeks to cue start and opens`, `play or seek closes panel`, `Escape in full screen keeps full screen`, `phone shows offer below picture and hides arrows`, `dark mode arrows not inverted`, `lesson without closer looks has no marker` → FAIL.
- [ ] Step 2: implement; all PASS; axe on open panel via `a11yCheckpoint`; commit.

### Task 5: Notes, reader, print, docs

**Files:**
- Modify: `_includes/narration-notes.html` (closer look after its cue, `mode=notes`), reader layouts (`<details>`), `css/narration-closer-look.css` print rules
- Modify: `docs/narration-format.md`, `.agents/skills/narration-authoring/SKILL.md`, `.agents/skills/video-narration/SKILL.md`, `shortcuts.html`, `_config.yml` asset_version

- [ ] Step 1: tests in `tests/narration-notes.spec.js` › `notes include the layered closer look code` and `shortcuts page lists E` → FAIL; implement; PASS.
- [ ] Step 2: run `tests/wcag22-complete-audit.spec.js` filtered to layers, print audit for layers; commit.
