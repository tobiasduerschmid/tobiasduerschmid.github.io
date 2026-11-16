# My Teammate Stage Aftermath Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all six mistakes visibly cause persistent stage damage, with detailed artwork, restrained early clutter, and a larger final scorch.

**Architecture:** A song-specific aftermath controller owns persistent SVG artwork and absolute-time motion. Existing choreography supplies sung-word cues and source/hand attachments. A small cast API extension supports authored actions with held props and deterministic attachment sampling; other songs retain their defaults.

**Tech Stack:** Existing JavaScript/SVG/CSS song engine, Node behavioral tests, Playwright rendering, Jekyll, existing macOS audio-description pipeline. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-15-my-teammate-stage-aftermath-design.md`

## Global Constraints

- User explicitly approved starting implementation with the current six-incident design; do not request another approval for the plan or execution method.
- Six residue groups persist through scene changes and the finale. The first five are compact; the final exhaust scorch is substantially larger.
- Every addition has a visible cause, continuous movement/contact, settling, and persistence.
- The permanent paper bin is present from the opening. Preserve singers, diagrams, captions, existing face/hand improvements, and the four restored commits.
- Absolute song time determines state; direct/reverse seeks and reduced motion reconstruct the correct result without playback history.
- No new 3D dependency, camera shake, or giant paper trails. The explicitly requested final build lights pulse slowly and remain steady under reduced motion.
- Source, documentation, and intentional media deliverables only in commits. Preserve all pre-existing dirty changes; do not stage whole shared files indiscriminately.
- WCAG 2.2 AA, both page themes, visual transcript, and described audio remain coherent.

## Review Focus

1. Direct seek beyond a prop release must reconstruct its release transform without stale frame caches.
2. The clipboard, palette, and mug each have one owner; hand position, rotation, scale/reflection, and velocity agree at release.
3. Scene disposal and reverse seeks must not erase, duplicate, or respawn residue or any released hand prop.
4. Foreground cast and teaching panels must not permanently conceal the far-right paint impact; large scorch stays behind readable surfaces.
5. Permanent left furniture, reduced motion, and source prop scale must preserve grounded reports/packages and continuous contacts. The old package rocks flat on the floor after its slight impact dent.

---

### Task 1: Persistent aftermath artwork and state

**Files:** Create `js/song-video/teammate-aftermath-art.js`, `js/song-video/teammate-aftermath.js`, `css/song-video-aftermath.css`, `scripts/tests/song-aftermath.test.js`. Modify the existing song asset manifest/loader where this song's dependencies are declared.

**Interfaces:** `TeammateAftermathArt.create(svgRoot)` returns named SVG groups for bin back/front, report, paint, coffee/drips/fragments, and scorch/exhaust/flames, plus absolute-time flame and drip updaters. The controller reuses the actual clipboard, palette, mug, and old package artwork. `TeammateAftermath.create({content, cues})` creates song-specific persistent layers and returns the controller. Cue names: story, dependency, tests, palette, coffee, secrets. `controller.update(time, attachments)` evaluates the entire state; `attachments` supplies deterministic world transforms when required. Pure interpolation/ballistic helpers are exported for Node tests.

- [x] Write Node tests for clamped event phases, boundary values, ballistic continuity/contact, and deterministic seek order.
- [x] Run `node --test scripts/tests/song-aftermath.test.js`: six behavioral tests pass.
- [x] Implement artwork and CSS: shaded bin, discarded clipboard, reused old package with a slight dent, creased red-cross report, far-right paint splatter with its fallen palette, wall coffee, ceramic fragments, and broad textured scorch with small muted flames that slowly grow within it. Use fixed bounded groups, no per-frame node creation; settled clutter becomes subdued gradually over about three seconds by reducing saturation, contrast, and brightness while remaining fully opaque and visible. Mug fragments settle between the bin and package near (420, 414).
- [x] Implement absolute-time motion and reduced-motion outcomes; keep wall/floor/foreground layers explicit.
- [x] Run aftermath unit tests and JavaScript syntax checks.
- [x] Complete final rendered-artwork inspection at normal player size.

### Task 2: Connect all six visible causes to choreography

**Files:** Modify `js/song-video/songs/it_works_on_my_machine.js`, `js/song-video/opera-cast.js`, and only necessary source-prop APIs in `js/song-video/machine-kit.js`. Create `tests/song-aftermath.spec.js`.

**Interfaces:** Extend `OperaCast.figure` with explicit authored held-prop action support and deterministic attachment sampling at a requested song time. Existing `node`, `where`, and `handPoint` remain compatible. The song creates aftermath before cast, then registers its updater after cast so attachments include the final posed/leveled hands. Reuse live source geometry rather than independent end-point guesses.

- [x] Write renderer regressions: one added group per cause, all six survive finale and backward seeks, bin present initially, released clipboard/palette/mug never respawn, reduced motion yields canonical states, the package rests flat, and the PM phone clears the bin.
- [x] Run targeted tests before integration and confirm they fail for absent aftermath; verify geometry/overlap oracles with temporary negative controls.
- [x] Connect the six visible causes: PM throws their held left-hand clipboard into the bin on “wrong” (42.0); old transfers 1.4.2 drops from its actual laptop-picture position during the Build Engineer's “new” (65.84), lands with a slight dent, and rocks flat at the smaller upstage position near (520, 414); failure visual ejects the already-crumpled red-cross report; UI throws their held right-hand palette onto the far-right wall on “overnight” (167.72), leaving paint and the fallen palette; backend throws the left-hand mug beside the clock on “gone” (211.6); rocket exhaust deposits a much larger wall scorch, followed by small muted flames that slowly grow and spread within the same sixth group until the curtain falls. Keep the UI cane in the left hand and clear it for the finale. The meeting tear and overnight-mail box retain their original transient behavior.
- [x] Establish the permanent left desk and bin, retain the original right intro desk, remove duplicate refrain furniture, and preserve the original laptop sequence.
- [x] Add deterministic release-sampling and ownership regressions, including a fresh reduced-motion scene and backward seeks.
- [x] Run final built-site arm/held-prop regressions after the last geometry changes.
- [x] Render anticipation, release, flight extrema, impact, settling, and scene boundaries; fix visible anomalies and review continuous playback.

### Task 3: Accessible descriptions, media, and final review

**Files:** Modify `_data/songs/it_works_on_my_machine.yml`, corresponding described audio/timing/captions in `assets/audio/`, and `assets/song-playlist/it_works_on_my_machine.webp`. Update `_data/song_library.yml` only if the thumbnail time changes.

**Interfaces:** Existing YAML `visual` and section `narration` fields feed the transcript and the existing renderer; no player-schema changes.

- [x] Update opening, six causal actions, finale, and outro descriptions to match implemented behavior, preserving lyrics and timing.
- [x] Run `node scripts/song-video/render.js it_works_on_my_machine` and regenerate the thumbnail from a reviewed settled frame.
- [x] Run caption/described-cut/virtual-clock unit tests, new aftermath tests, and relevant existing song/prop/accessibility tests against the rebuilt site.
- [x] Review complete-cast frames in both page themes, reduced motion, and a narrow player. Check no diagram/caption/face obstruction and inspect final accumulation.
- [x] Request a fresh independent review of the actual change. Resolve material findings and re-run affected checks.
- [x] Prepare the final implementation and verification summary; keep unrelated working-tree changes separate. The user explicitly requested committing the completed changes.


### Final user refinements

- [x] Derive the bin rim, shell, mesh, and hoops from a coherent tapered-cylinder projection; verify clipboard/rim occlusion.
- [x] Align the painted laptop base and pickup/return contacts with the tabletop; nine focused checks pass across three browsers.
- [x] Keep residue opaque while saturation, contrast, and brightness ease over 3.2 s.
- [x] Morph rooted flame tips and inner shapes, and grow/spread the fire until the curtain fully closes.
- [x] Lengthen paint and coffee drips continuously downward while fixing their splash heads and widths.
- [x] Finish focused flame/drip regression checks and latest media/build verification.

Verification: the broad browser baseline passed 120/120 checks before the last refinements. The final effects passed 54/54 checks, and the laptop changes passed 9/9 focused checks across Chromium, Firefox, and WebKit. The final Node group passed 25/25 checks. Light/dark player scans at 1280 px and 320 px found no axe violations; reduced motion starts paused. The final Jekyll build succeeded, described audio/captions were regenerated, the 640×360 thumbnail was updated, and the served assets were verified against source. Final frame review covered flame morphs, continuing growth, elongated drips, bin projection, and tabletop contact.

### Final CI and acting refinements

- [x] Add one persistent, softly eased cheek-blush step per revelation; keep the rest of the skin unchanged and preserve head-turn projection.
- [x] Accumulate one failed build check per technical issue, starting with dependencies; remove later all-green board resets.
- [x] Show “CI tests running” and six unlit ellipses for three seconds, then “CI Build failed” exactly one second before “Strange”. Pulse all six red lights gently, retaining solid crosses; reduced motion keeps them steady.
- [x] Mute flame brightness and saturation while preserving opaque paint and gradual growth.
- [x] Pass nine focused browser checks across Chromium, Firefox, and WebKit, including reverse seeks, reduced motion, and unchanged base complexion.
- [x] Inspect actual-player frames for each blush step, waiting/result transitions, the final chorus, and the muted late flames.
- [x] Refresh described audio, final thumbnail, built player, and affected regression checks before committing. The CI/acting pass completed 27 focused browser checks across three engines, 27 unique Node checks, and light/dark accessibility scans at wide and narrow sizes without axe violations.

### Attention through stage lighting

- [x] Couple each singer's painted luminosity and chroma to the existing follow-spot cues; ease transitions and preserve opaque artwork.
- [x] Keep the lead at or above half-strength key light throughout, including the CI reveal and other singers' solos.
- [x] Keep his full light and follow spot on during solo endings and gaps (including 1:31). Dim only for another speaker or an explicit competing reveal.
- [x] Brighten half light toward full light; keep the resting supporting cast at least half lit, including the 4:08 exchange, sleep scene, and final lineup.
- [x] Hold full light on every speaker slightly before and after their lines, and on the lead's startled hands-up reactions. Use one continuous cone per actor, suppressed outside their stage presence.
- [x] Quiet the window, furniture, floor, and proscenium; preserve teaching-text contrast and keep captions/controls outside lighting effects.
- [x] Accentuate the clock's lyric cues and each new failed build check. Shift emphasis to the final CI wait/result, then bring up the answering ensemble.
- [x] Let the fixes tally recede after its lyric so it does not compete with the final failure.
- [x] Strengthen full-light brightness, chroma, contrast, and feathered cones; preserve richer color in quiet areas without flattening the visual hierarchy.
- [x] Verify all singer handoffs, final CI emphasis, direct/reverse seeks, reduced motion, and browser rendering. Nine lighting checks pass across Chromium, Firefox, and WebKit, covering the pre/post-line hold for every sung/spoken line. Fix the Build Engineer's early exit so her final phrase remains visible. Latest light/dark scans at 1280 px and 320 px find no axe violations; reduced motion starts paused.
- [x] Review solo/dialogue/finale frames in the real player, refresh the thumbnail, and prepare only the intended sources and deliverables for the requested commit. Review includes the hands-up reaction, sleeping teammate, dark and light complexions, the spoken outro cone, and the full ensemble. The embedded storyboard and 17 served assets match source. The local preview now preserves audio range responses when seeking; this server-only workaround stays outside the repository.
