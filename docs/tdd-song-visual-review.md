# TDD song visual and timing review

Reviewed 15 October 2026 against the full-visual version at `29b9f084`.

The main issue was transient text: some explanations arrived near the end of a lyric, then vanished at the next scene. The useful examples should stay. This revision introduces supporting text earlier, holds related material together, and keeps word-timed gestures and highlights. The original soundtrack, lyric timing, beat map, dancer engine, and dance-event timing are preserved.

The instructional judgment follows the multimedia principles of signaling, spatial/temporal contiguity, and managing essential processing. Longer holds give viewers time to connect code with its result; concise annotations reduce competing prose. These principles inform the edit, but the timing measurements below are not evidence that every learner can understand the material in one viewing. See Mayer's chapters on [reducing extraneous processing](https://www.cambridge.org/core/books/cambridge-handbook-of-multimedia-learning/principles-for-reducing-extraneous-processing-in-multimedia-learning/F29A19FCD34C542806F736E0661C05F5) and [managing essential processing](https://www.cambridge.org/core/books/abs/cambridge-handbook-of-multimedia-learning/principles-for-managing-essential-processing-in-multimedia-learning/A9E77D0172F905AC957689D1771E2888).

## Complete sequence

| Section | Supporting visuals retained | Adjustment or judgment |
| --- | --- | --- |
| Introduction | Invitation, couple, first stack test | Bubbles enter with their lyric lines. The complete test holds for about 8.4 seconds. Couple slightly larger. |
| Verse 1: rules | Test before code, caller interface, unfinished test, batch, giant hop, small steps | Caller interface arrives earlier; both methods hold about 6.6 seconds. Batch remains visible. The hop label has about 3.3 seconds and sits below the batch. |
| Verse 2: testing the test | Missing class versus typo, terminals, suspicious green result | Both error examples remain. Typo code and its concise explanation arrive earlier; the explanation holds about 6.8 seconds. |
| Chorus 1 | Complete red/green/refactor walkthrough and dancing couple | Larger, brighter cycle labels; larger couple with revised floor positions. Complete test appears together. Refactoring change appears earlier. |
| Verse 3: minimal implementation | Minimal code, unnecessary features, parking ideas on the test list | Keep the concrete comparison and all three deferred ideas. Finish writing the list before it appears so its text holds for about 3.8 seconds. |
| Verse 4: refactoring | Definition, old/new `pop`, black-box outputs, duplicate setup/fixture, repeated test runs | Title is **Refactoring**; lecture credit removed. Definition holds about 26 seconds. Old `pop` gets roughly five seconds before replacement; new version holds about 5.6. Fixture holds about 5.9 seconds. |
| Chorus 2 | Push example, test result, refactoring, couple | Same presentation improvements as chorus 1; retain this distinct example. |
| Verse 5: assertions | Arrange/act/assert stack animation, buggy pop, weak test, behavior/private-detail comparison | Use the instrumental gap to introduce the weak test earlier. Keep both assertions in the rename comparison; remove only constructor boilerplate. Empty-result label holds about 3.2 seconds. |
| Verse 6: cases | Empty/one/several stacks, boundary number line, invalid/valid tea orders, outcome assertions | Keep all cases. Tea inputs and responses remain while the two outcome checks appear beneath them; input examples hold about 7.4–7.7 seconds. |
| Verse 7: reliable tests | Fast feedback, frequent/late runs, fresh fixtures, shuffled order, repeat runs, flaky noise | Introduce comparisons earlier; shorten annotations. Slow only the flaky status flipping, from 0.55 to 1 second between changes, to reduce visual noise. Dance speed is unaffected. |
| Verse 8: regressions | Fence, reproduction test, fix, terminal, musical staff | Hold the reproduction/fix/results through the following lyric, giving the final green result more time. Keep the staff transition. |
| Bridge | Pyramid, unit test, integration gears, browser flow, solos, bug-revealing beam, Dijkstra quote, rules, tower and rocket | Retain every visual analogy. Quote appears with the beam and is complete for about 10.8 seconds. Rules and task examples arrive earlier. Shorten the accuracy annotation. |
| Final chorus | Peek example, private rename, couple, dip and fireworks | Keep the third worked example and original finale motion. Apply the same larger cycle/couple layout. |
| Outro | Named tests, final dance, test list, student cameo | Keep the full ending. Finish writing all three list items before the list appears; it holds about 4.5 seconds. Couple slightly larger. |

## Verification

- Full Jekyll build and JavaScript syntax checks passed.
- 22 focused unit checks passed for beat maps, scenes, described audio, captions, and frame scheduling.
- 11 targeted browser checks passed for the TDD player, transcript, original/described captions, media delivery, and avatar behavior.
- Scoped accessibility suite: 9 checks passed; no automated findings on the chapter/player across light/dark mode, keyboard focus, and mobile reflow. This is not a full manual WCAG conformance certification.
- Inspected rendered frames across the sequence, including the enlarged cycle, definition, fixture, private rename, tea assertions, regression result, bridge, and outro.
- Sampled the entire 346.4-second sequence at 0.1-second intervals: 123 teaching/status elements; no sampled root box outside the 960-pixel stage width or the reserved teaching area. This check does not establish comprehension or detect every possible overlap between moving artwork and child text.
- Seven representative backward seeks reconstructed identical visible dancer poses. Original choreography timing and dancer implementation were retained.
- Live Chromium playback at 1×: 164 sampled animation frames followed native audio time with less than 1 ms measured difference. Pause froze the pose, backward seek reconstructed it, all enlarged cycle labels fit, and the described track held its selected picture. This verifies clock synchronization, not a universal perceptual assessment of every dance step.
- The initial temporary static server lacked HTTP byte-range support and reset native seeks to zero. The review preview now uses Jekyll's server; native seeking passed there. No player code was changed to work around the server.
- Regenerated audio description and its captions/timing after the definition wording changed. Sung lyrics and original audio are unchanged.

Readability remains a design judgment, especially for the four-second private-detail comparison. It now shows only the field rename and two assertions; the existing pause, seek, playback-speed controls, transcript, and described track remain available for closer study.
