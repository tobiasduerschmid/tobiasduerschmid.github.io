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
  video", or "full screen / mobile / dark mode looks wrong in the video". Covers the lesson type,
  example, narrative arc, one visual style, overlap and theme rules, animation timing, full screen
  and mobile, quizzes, rendering, and verification. Architecture: docs/video-narration.md.
---

# Authoring video narrations

A video narration is a 12 to 15 minute, Kokoro-voiced lesson that plays like a
video, with a knowledge check after each section. It shares its transport,
checks, and reading and print views with the design-pattern lessons. Read
[`docs/video-narration.md`](../../../docs/video-narration.md) for the
architecture, and [`design-pattern-narration`](../design-pattern-narration/SKILL.md)
for rules both lesson types share (cue length, predictions, pronunciation,
section-end silence, no history or attribution in speech).

If you only remember ten things:

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
    users, never "the system".

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

## 2. Animation

Write the choreography against narration words: `begin(line)`, `end(line)`,
and `at(line, word)` (`song.mark`). Words are lowercase without punctuation or
apostrophes ("Hopper's" is `hoppers`); hyphenated words split ("built-in" is
`built`, `in`); repeats are `word2`, `word3`. A misspelled mark stops the stage
from building.

- One `picture(from, to)` per cue, or one spanning consecutive cues that share
  a picture (a temple that gains a pillar per cue, a board that fills in). The
  resting pose (0.3 s before a cue ends) must show that cue's whole picture,
  because it is the still image when motion is off.
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

## 3. No overlaps

- No line runs behind text. A label on a line sits in a gap between two line
  segments (the bracket), never on a background mask, which some browsers
  paint under the line.
- A stamp or sticker that judges a card sits beside or below the words it
  judges, never over them.
- Moving pieces end where they cover nothing; if an object leaves ("the Scrum
  Master takes it"), let it leave and say so with a sticker.
- Every word stays inside the stage at every resting pose; long stickers are
  the usual culprits, so keep them short.
- `tests/<topic>-narration.spec.js` has an overlap test that poses every cue
  and fails on text over text, text covered by a later piece, or text off the
  stage. List an intended overlap (a card zooming over a board) in its
  allowlist with the reason.

## 4. Light and dark mode

The frame mirrors the embedding page's `dark-mode` class
(`js/video-narration-stage.js`), and the player's chrome (the picture's
background while it loads, full screen, captions) uses the narration tokens.
In stage CSS, paint surfaces, lines, and text only with the `--vn-*` tokens
and the re-pointed song tokens (`--text`, `--muted`) from
`css/video-narration-stage.css`; never a raw color, except paper pieces and
devices that are the same object in both modes (a card, a phone) and bright
fills with dark ink (stickers, flags). Accents used as text or lines use their
`-ink` tokens, which darken in light mode. Check both themes: every text keeps
4.5:1 against its own background, and the wall stays faint behind it.

Always check contrast in light **and** dark mode, never one theme alone: the
spec's contrast test poses every cue in both themes and measures each text
against what is painted behind it, and screenshots of both themes go in the
review. A token that passes on the wall can fail on a structure (the light
gold ink failed at 4.07:1 on the temple's roof). After a theme change, reload
the page with the cache bypassed: a frame can keep a stale stylesheet and show
light surfaces with dark-mode text.

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
320px wide. iPhone Safari has no element full screen, so the player hides the
button there; everything else must work by touch (tap the picture to play,
double-tap a side to skip).

## 6. Render, wire, verify

Render with `scripts/render-explainer-narration.py --topic <topic>` (setup and
the espeak-ng path workaround: the `design-pattern-narration` skill).
Listen for abbreviations and symbols, and check doubtful words by their
phonemes ("p.m." needs the spoken form `PM.`; see that skill's section 7). Any edit
to the storyboard, including `visual` text, changes its hash: re-render
(per-cue audio is cached, so unchanged speech is not resynthesized) before
running the tests. Follow "Adding a video narration" in
`docs/video-narration.md`. Then look at every cue's resting pose in both
themes (contact sheets of the stage page posed with
`window.VideoNarrationStage.seek(t)`), watch the moving moments mid-cue, and
run the topic's node test, its Playwright spec,
`tests/narration-fullscreen.spec.js`, and `tests/wcag22-complete-audit.spec.js`
filtered to the chapter and both views.
