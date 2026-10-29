---
name: video-narration
description: >-
  Authoring guide for video narrations in the SEBook: narrated lessons played like a video, whose
  every cue is a scene on an animated vector stage built with the song-video engine (the Scrum
  narration, and any new one). USE THIS SKILL EVERY TIME you create, extend, restructure, or review
  a video narration: `_data/explainers/<topic>.yml` with `animation` or `show`,
  `<topic>_quizzes.yml`, `_data/video_narrations.yml`, `_includes/video-narration*.html`,
  `_layouts/video-narration-stage.html`, `js/video-narration*.js`, `js/video-narration/<topic>.js`
  choreographies and kits, `css/video-narration*.css`, the stage page under
  `assets/video-narration/`, or a chapter that includes `video-narration.html`. Also trigger on
  requests like "make a narrated video lesson about X", "animate this narration", "refine the
  Scrum graphics", "the animation is out of sync with the narration", "text overlaps in the
  video", "full screen / mobile / dark mode looks wrong in the video", or "export the narration as
  notes / a PDF / a handout" (`<topic>_notes.yml`, `_layouts/video-narration-notes.html`,
  `js/video-narration-notes.js`). Covers the lesson type, example, narrative arc, one
  visual style, overlap and theme rules, animation timing, full screen and mobile, quizzes, the
  printable notes, rendering, and verification. Architecture: docs/video-narration.md.
---

# Authoring video narrations

A video narration is a 12 to 15 minute, Kokoro-voiced lesson that plays like a
video, with a knowledge check after each section. It shares its transport,
checks, and reading and print views with the design-pattern lessons. Read
[`docs/video-narration.md`](../../../docs/video-narration.md) for the
architecture, and [`design-pattern-narration`](../design-pattern-narration/SKILL.md)
for rules both lesson types share (cue length, predictions, pronunciation,
section-end silence, no history or attribution in speech).

If you only remember eleven things:

1. **Pick the type by what teaches the idea.** A pattern taught through one
   evolving code example is a design-pattern lesson. A process, practice, or
   architecture taught with pictures is a video narration. Code may appear in
   a video narration whose topic needs it; the Scrum lesson has none.
2. **One running example, chosen with the instructor.** Propose three
   candidates (relatable to UCLA undergraduates, original, able to give every
   concept a concrete moment) and get agreement before writing speech.
3. **Educational, exciting, and exact, for Gen Z students.** Open with a
   moment the audience has lived (a 6:58 p.m. dining-hall line), show what
   goes wrong without the idea, then preview the parts. Second person, short
   sentences, and game-like touches ("side quests", "level up", a
   character-select screen for roles, a telephone game, a balance) only where
   they clarify. Never trade accuracy for a joke.
4. **Every claim is checkable.** Ground the narration in the lecture and the
   authoritative source (for Scrum, the current Scrum Guide), say where they
   differ ("self-managing, often called self-organizing"; the three Daily
   Scrum questions are what "many teams" use), and record each source in
   `docs/<topic>-narration.md`.
5. **One visual style throughout.** Every cue is a scene on the animated
   stage, in the same materials: paper cards and notes on the wall, dark (or,
   in light mode, white) list cards, badges, stickers, stamps, and the topic's
   kit objects. Draw structured text and diagrams as scenes too (a list card,
   a temple of pillars, a balance, a board with columns and arrows) instead of
   switching to HTML slides or an ArchUML panel mid-video; the player still
   supports those panels, but mixing them breaks the video.
6. **Each picture shows the mechanism the cue names.** Animate what changes (a
   story moving to the Sprint Backlog, a blocker leaving the board, a beam
   tipping), timed to the words that name it. Put each state in words as well
   as color. Text on screen signals; the narration explains.
7. **Nothing overlaps, nothing leaves the stage.** See section 3. Run the
   overlap test after every layout change.
8. **The video follows the site's light or dark mode.** See section 4.
9. **Full screen and phones get the whole lesson.** See section 5.
10. **Quizzes test the topic using only what the narration taught.** Use
    [`pedagogical-advisor`](../pedagogical-advisor/SKILL.md),
    [`cs-tutorial-design`](../cs-tutorial-design/SKILL.md), and
    [`quiz-format`](../quiz-format/SKILL.md): application questions on new
    situations, distractors from real confusions (the Scrum Master as a
    boss), and a summary quiz on a new team. User-story actors are always real
    users, never "the system". Before every check, including the summary quiz,
    finish the speech and hold the completed picture for a short viewing pause:
    set the section's last cue to `pause_after: 2.5` or longer (see section 1).
11. **Every narration ships printable notes.** A button under the video
    saves them as a PDF: each cue's picture at rest beside its key points in
    note form, ruled lines to write on, each section's knowledge check, and
    the answers, and nothing else. They are drawn from the current narration
    when opened, never from a stored file. See section 6.

## 1. The narrative arc

Structure the lesson as the topic's own parts, shown by the `part` strip (for
Scrum: Theory, Roles, Artifacts, Events). Follow one story through them: for
Scrum, one sprint of one team. Use two or three `prediction: true` cues with
`pause_after: 4` before an important reveal; the picture asks the question
(an empty dashed slot, a "?") and answers only in the next cue. Close with a
scene that connects the parts and a recap that reuses the earlier pictures'
objects, so recall has visual anchors.

Write each cue as 30 to 55 spoken words. Give every cue a `visual` that
describes what is on screen, including its words, because it is the screen's
accessible name and the reading view's text for the picture. Update it in the
same edit as the choreography.

**Always leave time to look before a quiz.** Give the last cue of every section
with a knowledge check, including the summary quiz, `pause_after: 2.5` or
longer. Finish all spoken words and complete the picture by `speech_end`, then
hold it visibly through the silence. The player opens the quiz 0.3 s before
the section boundary, so 2.5 s of rendered silence leaves 2.2 s to inspect the
slide at normal speed (1.1 s at 2x). The ordinary 0.55 s cue pause leaves only
0.25 s and is insufficient. Regenerate the audio, captions, and timing
together; a delayed overlay over ongoing speech does not provide this pause.
Never trim speech or start the next section's words before the check.

## 2. Animation

Write the choreography against narration words: `begin(line)`, `end(line)`,
and `at(line, word)` (`song.mark`). Words are lowercase without punctuation or
apostrophes ("Hopper's" is `hoppers`); hyphenated words split ("built-in" is
`built`, `in`); repeats are `word2`, `word3`. A misspelled mark stops the stage
from building.

- One `picture(from, to)` per cue, or one spanning consecutive cues that share
  a picture (a temple that gains a pillar per cue, a board that fills in). The
  resting pose (0.3 s before a cue ends) must show that cue's whole picture,
  because it is the still image when motion is off. Before a quiz, that whole
  picture must already be present at `speech_end` and stay visible throughout
  the viewing pause; a last-moment reveal at the resting pose is too late.
- Leave no dead air: if words between two reveals take more than a few
  seconds, put something on screen for them.
- Stage text is at least 20px in the picture's artwork (18px on the 960x540 stage after the body's 91% scale), and decorative uppercase
  labels at least 17px; prefer fewer, larger words.
- Paper pieces (`card`, `note`, `speech`, `checklist`) are as wide as `w`
  plus padding; `listCard` is exactly `w`. Leave room for a raised, lit card.
- Stamps do not shake the stage, and nothing large changes brightness quickly
  (WCAG 2.3.1).
- The song kit draws confetti behind a picture's content. For a celebration
  that belongs on top, pass `sk.overlay(picture)` as its parent, start it on
  the word it celebrates, and keep the picture up long enough to see it.

## 3. No overlaps, no occlusion, visible gaps

Place every element so it neither touches nor hides another:

- Boxes keep a visible gap. Cards, badges, notes, panels, chips, and days in
  a row, a stack, or a grid stand at least 8px apart on the stage (6px after
  the 91% artwork scale). Compute spacing from each box's outer size: paper
  pieces are as wide as `w` plus their padding (a card adds 24px, a badge
  16px, a speech bubble 32px), and a card's height is its text plus 16px. A
  rotated piece (a sticker, a flag, a tilted note) grows its corners, so give
  it more room. A box inside another (a card in its column) fits inside it.
- Nothing covers a heading or a label. A piece that comes forward (the top
  story held up in front of the board) sits below the headings it would hide;
  move it, or fade what it would cover.
- A raised piece (a lit role card lifts 14px and thickens its border) needs
  room for its raised state, not only its resting one.
- No line runs behind text. A label on a line sits in a gap between two line
  segments (the bracket), never on a background mask, which some browsers
  paint under the line.
- A stamp or sticker that judges a card sits beside or below the words it
  judges, never over them.
- Moving pieces end where they cover nothing; if an object leaves ("the Scrum
  Master takes it"), let it leave and say so with a sticker.
- Every word stays inside the stage at every resting pose; long stickers are
  the usual culprits, so keep them short.
- `tests/<topic>-narration.spec.js` poses every cue and checks placement
  twice: the overlap test fails on text over text, text covered by a later
  piece (even one letter: a sticker clipping the "g" of "Sprint Backlog"
  counts), or text off the stage; the gap test fails on painted boxes closer
  than the gap without one containing the other. List an intended overlap in
  the test's allowlist with the reason (the gap test allows the top story
  held in front of the board); never weaken the threshold to pass.

## 4. Light and dark mode: no contrast issue in either

The video follows the site's setting, and every text must keep 4.5:1 against
what is painted behind it, in light **and** dark mode, on load **and** after
the viewer switches theme mid-video. Three rules produce that reliably:

1. **Paint only with theme tokens.** The frame mirrors the embedding page's
   `dark-mode` class (`js/video-narration-stage.js`), and
   `css/video-narration-stage.css` defines the `--vn-*` tokens (dark by
   default, light under `html:not(.dark-mode)`) and re-points the song kit's
   `--text` and `--muted`. In stage CSS, surfaces, lines, and text use only
   these tokens. The exceptions are objects that are the same in both modes
   and carry their own contrast: paper pieces with dark ink (cards, notes,
   badges, the phone) and bright fills with dark ink (stickers, flags).
   Accents used as text or lines use their `-ink` tokens, which darken in
   light mode. Pair every surface token with the text token meant for it;
   never put a surface token behind text that stays theme-independent.
2. **Never freeze a computed color.** Any code that copies computed colors
   into inline styles must repaint when the theme class on `<html>` changes.
   `js/song-video/rounded-surfaces.js` does this for Firefox's rounded-border
   fix, which runs only in Firefox, so a stale color there never shows in
   Chrome. Mixed themes on screen (dark cards on the light wall, or white
   cards with pale text) mean a frozen color or a stale stylesheet.
3. **Version every asset URL.** The frame loads its own CSS and scripts;
   each URL in the player, the frame layout, and the chapter carries
   `?v={{ site.asset_version }}`. Bump `asset_version` in `_config.yml`
   whenever a video narration's CSS or JS changes, so no viewer combines an old
   stylesheet with a new one.

Verify with tests and eyes, every time, in both modes:

- `every cue's text keeps 4.5:1 contrast in light/dark mode` poses every cue
  in each theme and measures each text against the fills behind it.
- `switching from light to dark (and back) while watching any cue paints it
  like a fresh video` switches theme at every cue, with Firefox's repaint
  forced on, and compares every element's painted colors with a stage loaded
  in that theme. It is the test that catches frozen colors; it failed on the
  old repaint module before the fix.
- Look at contact sheets of every cue in both themes, and switch theme while
  the video plays, in Chrome and Firefox. A token that passes on the wall can
  fail on a structure (light gold ink failed at 4.07:1 on the temple's roof).

## 5. The player, full screen, and mobile

The player's controls must stay at least as good as the music player's, which
shares its modules. Rules that came from review:

- The scene header is a two-level, clickable outline. The part strip's parts
  (Theory, Roles, Artifacts, Events) jump to each part's first scene; under
  it, the current part expands into its scenes (in Roles: Team and
  Developers, Product Owner, Scrum Master) as smaller ovals that jump to each
  scene's start, the current one filled. Give every scene with a `part` a
  short `outline` name, and keep `part` identical to a name in the
  registry's `parts`.
- Every picture has a heading strip: a tag naming the role, artifact, or
  event the picture teaches ("Role · Product Owner"), with the icon that
  stands for it throughout the video, drawn by `picture()` above the scaled
  artwork layer (`.sk-body`, 91%). Name a narrower topic for a cue range when
  a scene changes subject, and draw every piece in the body, never in the
  strip.
- While a knowledge check is open, the control bar steps aside so the quiz
  has the room; the quiz's own buttons continue the narration, and Esc still
  leaves full screen.
- An icon button reads at a glance at its real size. Never overlay a digit on
  an icon font's glyph, whose shapes sit off-center in their boxes: the skip
  buttons show their arrow and "5" side by side.
- Space on any player button toggles playback, as in the music player; Enter
  activates the button.

Full screen fills the display with the video, including the scene's header
(lesson sticker, scene number, part strip, title, and task). Where the screen
is at least 3:2, the header is a sidebar beside the picture, because the
picture is limited by height there; on a short, wide screen (a phone on its
side) the captions join the sidebar so the picture takes the height above the
controls; on narrower screens the header is a row above. Check full screen at
1440x900, 1920x1080, 1024x768, 844x390, and 390x844, and the inline player at
320px wide. Everything must also work by touch (tap the picture to play,
double-tap a side to skip).

Full screen works in every browser, so keep it working when you change the
player (`js/narrated-explainer.js`):

- The transport uses the standard API or Safari's prefixed one. Where neither
  exists (Safari on iPhone), or the browser refuses the request, the player
  fills the viewport itself (`.is-viewport-fullscreen`), Escape and the button
  leave it, and the page behind it is `inert`, so Tab never lands on hidden
  content.
- Style full screen on the player's `.is-fullscreen` class, never on
  `:fullscreen`, which the drawn mode does not match; react to the root's
  `narration-fullscreenchange` event, never to `document.fullscreenElement`
  alone.
- Give every newer CSS feature a fallback in the line before it: `100vh`
  before `100dvh`, a `vh` width before `cqw`/`cqh`. A missing `:has()` or
  container query may only lose polish, never content or a control. Use no
  script API newer than 2022 without a fallback (`findLastIndex` became
  `lastIndexWhere`).
- Test a missing API by deleting both the standard and the prefixed one in an
  init script: Chrome still has `webkitRequestFullscreen`, so removing only
  the standard one tests nothing.

## 6. Printable notes

Every video narration has printable notes: a handout students print or save
as a PDF and annotate. The **Save lesson notes as PDF** button under the video
opens the notes page (`<views>/notes/#export`), which draws the pictures and
opens the print dialog. Each cue is one row: its picture at rest (the pose
0.3 s before the cue ends, the same pose the stage audits check), its key
points beside it, and ruled lines to write on. After each section comes its
knowledge check as a row of its own, with room to answer; the answers, with
why each wrong option is wrong, close the notes. Print keeps only the lesson:
its title, three rows a page under each scene's heading, and the answers; the
introduction, links, and site footer stay on screen. Rules from review:

- **Key points are notes, not narration.** Write one to four bullets per cue
  in `_data/explainers/<topic>_notes.yml`, keyed by cue id
  (`<scene id>-<cue number>`), at most 16 words each, about half the
  narration's words in all. Telegraphic phrases, `**bold**` for the term a
  bullet defines, arrows for cause and effect ("Item too big → renegotiate
  scope"). Never repeat eight words in a row from the cue; a copied sentence
  is not a note.
- **Keep every idea, drop the talk.** Each term, rule, number, and timebox the
  cue teaches appears in its bullets; jokes, transitions, and repeated
  examples do not. Add a topic test that every taught term appears in the
  notes (the Scrum test lists roles, artifacts, commitments, events, and
  timeboxes).
- **Prediction cues keep their question.** Write the question as a bullet
  ("**Predict:** ... Counts? Goes where?") so students answer it on the lines;
  the next row has the answer.
- **Bullets are inline Markdown.** Only `**bold**` is meant; underscores and
  single asterisks turn into emphasis, so write blanks and lists in words.
- **The picture is the resting pose, so the resting pose must be complete.**
  A label still entering, a sticker covering a letter, or a piece that
  leaves before the cue ends shows up in print. The overlap test checks
  every resting pose for partly covered text.
- **Bullets live apart from the storyboard,** so editing them never changes
  the narration's audio fingerprint.
- **Notes come from the current narration, never from a stored file.** The
  notes page builds the narration's stage itself, out of view, and copies
  each cue's resting pose into its row (`VideoNarrationStage.still(time)`,
  which writes every animated value into the copy's inline styles). Editing
  the storyboard, timing, choreography, bullets, or quizzes changes the notes
  with nothing to re-render. Do not commit rendered stills or PDFs.
- **A copy must look like the video.** It inherits the stage page's type
  (browser defaults), not the notes' type, and its slot uses
  `contain: strict`; without containment, Chrome's print shrinks every page
  to fit the 960px stage.

`tests/video-narration-notes.spec.js` checks every row's picture (its
description as its accessible name) and bullets as written; that every
picture shows the paused video's words in the same places; that each check
follows its section and the answers match; that print shows only the lesson
with no row clipped and three rows to a Letter page; that Chromium's saved
PDF has exactly one page per three rows; and that the button opens the notes
and the print dialog. `scripts/tests/video-narration-notes.test.js` checks
the bullets' form. Look at a saved PDF before committing: print the notes
page to PDF and read a few pages (`pdftoppm` renders them).

## 7. Render, wire, verify

Render with `scripts/render-explainer-narration.py --topic <topic>` (setup and
the espeak-ng path workaround: the `design-pattern-narration` skill).
Listen for abbreviations and symbols, and check doubtful words by their
phonemes ("p.m." needs the spoken form `PM.`; see that skill's section 7). Any edit
to the storyboard, including `visual` text, changes its hash: re-render
(per-cue audio is cached, so unchanged speech is not resynthesized) before
running the tests. Follow "Adding a video narration" in
`docs/video-narration.md`. Follow the Scrum timing and playback tests for every
quiz boundary: at normal speed, at least two seconds pass after `speech_end`
with the completed picture visible before the quiz opens, and playback stops
before the next section's first word. Include the final summary quiz and
check accelerated playback too. Then look at every cue's resting pose in both
themes (contact sheets of the stage page posed with
`window.VideoNarrationStage.seek(t)`), watch the moving moments mid-cue, and
run the topic's node test, its Playwright spec,
`tests/narration-fullscreen.spec.js`, the notes tests (section 6), and
`tests/wcag22-complete-audit.spec.js` filtered to the chapter, both views, and
the notes page.
