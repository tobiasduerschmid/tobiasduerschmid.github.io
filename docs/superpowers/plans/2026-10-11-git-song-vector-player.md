# Git song vector player implementation plan

> Use the Superpowers execution, test-driven-development and verification workflows. The user approved implementation of the preceding feasibility recommendation.

**Goal:** Render the existing Git song live with scalable SVG/HTML graphics and audio. Following the user's player refinements, integrate both audio tracks into one player and remove the raster video players.

**Architecture:** Share the authored timeline, artwork, and choreography between the offline exporter and a same-origin player frame. Each graph owns a scoped deterministic clock; its transition is retained while time moves forward and rebuilt only on discontinuous seeks. The player uses native media time as its authority. Captions overlay the picture at unscaled text size; transport controls and audio-track selection sit directly below it.

**Tech stack:** Native SVG, HTML media, Web Animations, Jekyll, Playwright, Node test runner. No new production dependencies.

**Spec:** The user's approved recommendation in this chat: persistent graphs; audio-driven timing; portable path animation; responsive layout and packaged assets; captions and preserved audio description.

## Global constraints

- Preserve the existing song, lyric timing, visual meaning, audio description, and transcript. Offer audio downloads as fallback; keep MP4 files as independent export artifacts.
- No autoplay or new persisted state. The optional character may read the existing saved Gym appearance. Native semantic controls, paragraph-size UI, visible focus, light/dark/print support, and training opt-out on new HTML pages.
- Never replace chapter-global timers. Rendering must stop while paused/hidden and recover at the current audio time.
- No claim of physical mobile or screen-reader validation without actual access.

## Review focus

- Repeated playback and backward/forward seeking must not retain replaced graphs or depend on previous seek history.
- Audio rejection, load failure, and unsupported animation features must leave audio downloads and the full transcript reachable.
- Touch input, resize, text spacing, and keyboard access must preserve control readability.
- Hidden-tab recovery, buffering, and ended playback must not leave an animation loop running independently of audio.
- All shared source paths must work in both the Jekyll output and offline render stage.

## Tasks

1. [x] Publish one shared scene source under js/song-video and css/song-video-stage.css; extract SongScene.build(stage, storyboard, songId), keep offline stage working, package audio and fonts locally. Update source-path tests and documentation.
2. [x] Write regressions for independent clocks and bounded graph retention; implement retained GraphTrack transitions, scoped GitGraph scheduling, disposal, and portable SVG path interpolation. Verify forward and backward poses and existing graph behavior.
3. [x] Build the accessible player page/layout, native audio transport and captions, responsive scene fitting, reduced-motion option, and chapter integration. Integrate both audio tracks and replace the chapter's raster players. Add behavior tests before implementation.
4. [x] Build Jekyll and run targeted unit/browser/accessibility checks across installed browser engines, performance/retention probes, visual light/dark/mobile/print inspection, then independent code review. Fix findings and report actual verification limits below.

## Interfaces

- Shared `SongScene.build(stage, storyboard, songId)` creates one scene per frame and returns `{ seek(t), duration, dispose() }`; `SongScene.loadFonts()` waits for locally hosted typography.
- `GraphTrack(panel, keyframes, {speed})` exposes `pose(t)` and `dispose()`; owns its scheduling. It must never install page-global timer replacements.
- Player layout serializes trusted storyboard JSON into `#song-data`; loads shared scripts followed by `js/song-video/player.js`. Choreography registers `SongChoreographies.snapshots_and_pointers`.
- Storyboard gains `player: /assets/song-player/snapshots-and-pointers.html`; soundtrack becomes `assets/audio/snapshots-and-pointers.m4a` (repository-relative for exporter).

## Progress

- Created isolated worktree from committed Git-song branch. Original worktree's uncommitted networking-song changes are untouched.
- Feasibility evidence: desktop Chrome samples ~60fps; existing exporter retained 35,104 nodes after 600 transition frames and failed live resize. These are regression targets, not performance promises.

## Initial implementation verification on 2026-10-11

- Jekyll final build succeeded (78 seconds) into an isolated temporary destination.
- All 22 song unit tests passed, including scheduling, scoped clocks, scene disposal, captions, and the described cut.
- Final Chrome/WebKit matrix: 57/57 passed (29 Chrome, 28 WebKit). Includes real media playback, seeking, replay, hidden-tab recovery, reduced-motion choice, mobile reflow, failed resources, mutual exclusion between playback versions, and print-state restoration.
- Firefox 146: 19/19 non-playback checks passed, including SVG transitions and deterministic seeking. Nine native-playback tests remain unverified: the installed runtime stalls on both plain AAC and generated PCM WAV without any site scripts, including headed mode. No production workaround, browser preferences, or silent test skips were added.
- Graph-specific tests passed in Chrome, Firefox, and WebKit. Existing shared graph accessibility, ID allocation, and live-update regressions: 4/4 passed.
- Interactive accessibility checkpoints: 16/16 passed in light/dark mode. The scoped WCAG audit of the Git chapter and standalone player returned zero automated findings; its audit and keyboard regressions passed 9/9. Fixed the audit to inspect the actual focused control within same-origin frames, including clipping and reverse traversal, instead of falsely reporting its parent iframe as lacking a focus ring.
- All six training-opt-out checks passed, including metadata on every built page.
- Visually inspected desktop light/dark, 320px mobile, print, and representative exported frames. The shared offline exporter produced stills at 18.6, 61.5, and 185.3 seconds. A temporary source copy with a real local YAML dependency avoided the isolated worktree's dependency symlink being blocked by the export server's path containment check.
- At eightfold Chrome CPU throttling, native audio advanced 5.047 seconds in 5.071 wall seconds at playbackRate 1; visual updates were skipped. This is a local sample, not a physical-device performance guarantee.
- Graph garbage-collection probe: retained DOM count stayed at 66 through 0, 600, 1200, and 1800 poses of the regression fixture.
- Independent review findings fixed: nested source errors now expose fallback; zero-time seeks reset captions/descriptions; end-of-song text takes precedence over WebKit's lingering final cue. Falling commit anchors are independent of prior rendered frames.
- `git diff --check` passed. No commits, pushes, or publication.

The broad repository unit-suite attempt reported 1,017 passes and 41 environment failures (missing bundled Chromium, Ruby 2.6 instead of the required 3.3, and sandbox file/loopback restrictions). It is not a passing full-suite result. Physical phones, audible continuity on real slow hardware, screen readers, and full manual WCAG conformance were not certified in this environment.

## Player refinements and final verification

- Removed the decorative equalizer and replaced the Time Stone with an engraved gold setting and faceted emerald, using lightweight SVG gradients and paths. Replaced the hash boxes' CSS borders with rounded inset outlines. The reported corner seams were not reproducible locally before the change; the alternate outline paints cleanly in Chrome, Firefox, WebKit, and the in-app preview.
- Added larger, toggleable overlay captions and integrated play/pause, seek, back/forward 10 seconds, mute, and supported-platform fullscreen controls. Controls wrap at narrow widths and enlarged text settings. Symbolic skip signs are separate from the accessible names; the standalone controls do not rely on native title tooltips.
- Extracted the existing audio-described recording's AAC stream without re-encoding, and added the exact narration-hold timing manifest. Both tracks share the same controls. Switching preserves song position and paused/playing state; failed-load recovery retains position and cancels delayed automatic playback after a pause request.
- Removed both raster video players from the Git chapter and live player. Audio downloads, a no-JavaScript native audio control, and the full transcript remain available.
- Final Jekyll build succeeded in 49.348 seconds. All 31 song unit tests passed. All 54 playback/content checks passed across Chrome (28) and WebKit (26); the final control-label adjustment passed another 9 targeted checks across those engines. The eight interactive accessibility scenarios passed in both engines, with each scenario checking light and dark mode.
- The scoped canonical WCAG audit of the Git chapter, player, and glossary returned zero automated findings; its nine audit/keyboard checks passed. All six training-opt-out checks passed. Browser checks include normal-speed audio under eightfold CPU throttling, caption and narration timing, failed-resource recovery, enlarged mobile controls, and print behavior.
- Manually inspected the live Time Stone, enlarged captions, audio-described narration, both skip directions, and rounded hash outline in the in-app browser. Saved the final preview at `/tmp/git-song-player-final.jpg`.
- Firefox native audio playback and physical-device/screen-reader behavior remain subject to the limitations above. No commits, pushes, or publication were requested or performed.

For the locally installed WebKit/Firefox builds, set `PLAYWRIGHT_BROWSERS_PATH=/tmp/git-song-playwright-browsers`. The interactive accessibility flag is `A11Y_INTERACTIVE_CHECKS=1`.

### UI consolidation

The chapter now owns one “Full transcript” disclosure. The standalone transcript link is hidden only after its host confirms that disclosure exists. Live visual descriptions appear only in lyrics-only mode or animation failure; repeated audio-description instructions and transcript headings were removed. A fast-frame startup race exposed by Chromium testing was fixed by sending host context when the deferred embed script initializes as well as on frame events. The startup scenario passed three repeats in each engine; transcript content, print, reduced-motion, fallback, and no-JavaScript checks also passed. The scoped accessibility audit passed all nine checks with zero findings.

At the user's request, removed the “Sing It Back” section, its questions and answers, and the introductory prediction/link that pointed to it. Basic and Advanced Git practice remain in place.

### Visual polish and saved student cameos

The user initially approved three student-at-laptop cameos and explicitly requires the
fully customized human, customized Bruin, and Prof hero. Reuse the saved hero
renderer as an asynchronous enhancement; adapt only the MV copy to a seated
pose, with a laptop fallback for missing or unavailable saved appearance. Do
not write saved preferences or delay playback. Keep one instance, remove
independent animations, and pose it using the existing audio clock.

Confetti keeps its existing celebration cues and bounded count, with seeded
paper shapes, shaded faces, staggered launches, flutter and tumble. Its layer
sits behind educational content and excludes the caption reserve. Backdrop
auroras use soft radial gradients instead of blur filters; terminals,
stations and snapshot cards receive restrained depth and edge highlights.

Verify repeated seeking, no retained particles, missing/blocked avatar data,
each supported hero kind, reduced-motion mode, captions, normal-speed media
playback, representative light/dark/mobile views, and the scoped accessibility
audit.

Validation: the 31 song unit tests pass. Nineteen Chromium/WebKit transport,
caption, narration, reduced-motion, hidden-page, mobile/enlarged-text, print,
and CPU-throttling regressions pass. Fourteen new artwork/appearance/fallback
checks pass across Chromium and WebKit, followed by both optional-template
failure cases and refreshed checks of all three saved hero variants. The
Firefox renderer-only cases pass for all three heroes and deterministic
confetti; its previously documented native-media limitation remains.

A separate 8× CPU-throttling check delivers the real saved-avatar template
after playback starts, verifies that elapsed audio follows wall time within
0.5 seconds at playbackRate 1, and then exercises student plus confetti
rendering at the finale. It passes. The shared template can take several
seconds to prepare under this artificial slowdown; the laptop fallback and
native soundtrack stay available throughout.

The scoped canonical WCAG audit passes all nine checks with zero automated
findings across the Git chapter, standalone player, cookies and settings.
Reviewed light/dark player views and saved custom-human, customized-Bruin,
and Prof screenshots. Independent review caught and fixed lab-coat sleeve
colors. Visual review also removed the cropped Gym aura. The user's photo
reference specifies a frontal laptop with its rear lid facing the viewer,
screen and keyboard facing the student, and typing hands hidden behind the
lid. Further feedback requires a smaller, lower lid exposing more of the
student, recognizable laptop thickness, and subtle eyes/head/arm motion.
Those motions must use the same absolute song clock, preserve each hero's
fitted features/accessories, and remain still under reduced motion. The saved
hero configuration and Gym template are unchanged. The final lid is about
164×80 rather than 196×96; the head nods and tilts gently, pupils glance toward
the screen, existing eyelid artwork blinks, and the arms alternate small
typing movements behind the lid. Gaze transforms preserve direct-child iris
selectors and the original element transforms.

The excess space under status filenames was a shared graph measurement bug:
the transformed screen height was written back as a CSS layout height. Both
workbench reservation and height pinning now use layout height. The regression
first reproduced a 57.78px panel becoming 115.56px at 2× scale; all 27 graph
checks then passed in Chromium, Firefox, and WebKit, including resized and
backward-seek states. The three existing graph accessibility/ID checks pass.
The full-screen preview confirms the panel fits its filename rows.

Confetti now uses slender ribbons and tickets, restrained paper colors,
staggered launches across a wider area, varied lift and air resistance, and
depth variation. It keeps the 46-piece cap. The eight Chromium/WebKit artwork
checks and four Firefox renderer checks pass. Reviewed early, peak, and
falling poses of both final-chorus and merge celebrations at narrow width.

One 8× CPU test reported a five-second audio/wall-clock discrepancy. Two
isolated native-media traces did not reproduce it: audio continued at rate 1
without waiting or pause events, within milliseconds of wall time. It remains
an unexplained test outlier rather than evidence of an application pause.
The traces did reveal a long synchronous avatar preparation task. Profiling
at the same 8× slowdown attributed 77.5% of the profiled span to SVG ID
uniquification, primarily repeating an all-ID regular-expression scan for
each attribute. A focused lookup-based rewrite removes that repeated work
while retaining separate IDs and local paint/geometry references.

The lookup-based rewrite reduced SVG ID preparation from 8,302 ms to 112 ms
(98.7%) in the same 8× CPU profiling setup. The complete hydration long task
fell from 9,965 ms to 1,275 ms (87.2%); elapsed audio remained within about
1 ms of elapsed wall time. The unchanged throttled regression passes. Six
reference-isolation tests pass across Chromium, Firefox, and WebKit, and all
twelve final avatar art/motion checks pass in Chromium and WebKit. This
measures avatar preparation, not a promise about network download speed.

The user's final requests add the student between the local and remote
repositories during push/fetch/pull, increase caption text from 1.25em to
1.4em, and add mobile fullscreen with an optional native landscape lock.
When locking is unsupported, the player surface rotates inside the visible
viewport; when native fullscreen is unsupported, the host expands the same
iframe without reloading media. Focus, Escape, background isolation, safe
areas, and scroll restoration are part of the fallback contract. Browser
APIs cannot guarantee physical OS rotation or hide unsupported browser chrome.
The user explicitly requested committing and pushing the completed work.

Final validation for publication: Jekyll built successfully in 95.936 seconds;
all 31 song unit tests and 53 Chrome/WebKit player/content checks passed.
Separate engine runs also exited cleanly (27 Chrome and 26 WebKit checks).
The final scoped Git chapter/player accessibility audit passed all nine
checks with zero automated findings. The prior expanded scope also covered
cookies, settings and shortcuts, and all six training-opt-out checks passed.
Long audio-description captions fit the rotated mobile player in WebKit.

The remotes cameo appears for push/fetch/pull, then leaves before the wider
rejected-push graphs at 176.16 seconds; all three saved hero types were
visually checked at 169 and 174 seconds, and absent at 178 seconds, in Chrome
and WebKit. A Firefox test initially took native fullscreen into a real
1366×768 landscape viewport because its lazy iframe replaced the document
containing the capability mock. The player was correctly unrotated there.
The test now applies and verifies the unavailable API on the loaded document,
then asserts that the intended fallback dialog actually opens.

Some simultaneous Chromium test workers lingered during shutdown after their
assertions completed; isolated reruns completed normally. This did not require
production changes. Physical-phone and Firefox native-audio verification
limits remain as documented above.

The corrected fullscreen matrix passed all 13 cases with clean exits:
seven Chromium, three Firefox, and three WebKit. The six final saved-avatar
cases also passed in Chromium/WebKit. The final scoped accessibility rerun
exited cleanly with nine passes and zero findings. The reviewed work is being
committed on `codex/git-song-vector-player` for the user's requested push.
