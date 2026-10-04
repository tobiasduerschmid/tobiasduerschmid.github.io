# Smalltalk runtime validation

This record describes the 2026-10-03 candidate on macOS 26.6.2 (25G83), ARM64. It separates observed results from remaining release checks. **Native refactorings are retained for future work and disabled in this release.** The verified protocol exports `SEBookSmalltalk.FEATURES.refactorings = false`; changing it requires rebuilding and verifying the distribution. Native refactoring classes remaining in the image do not make those operations available in the GUI or protocol. Expensive trusted-code guard initialization is also inactive.

The active scope is the System Browser, ordinary class/method source acceptance, queries, Versions, live terminal and Inspector, Run, independent fresh checks, source views and popouts. Refactoring controls, refactoring-backed Add/Remove actions and the rename lesson are deferred. No compound structural-exclusion guarantee is made for unrestricted terminal or raw-file execution.

## Browser search follow-up, 2026-10-03

The updated distribution manifest SHA-256 is
`26575d097f74e96068e8eee70b78ca2bae07d80e58afccc4e82f0b3b50bbc5d6`.
The native image was rebuilt with image-wide method search, and all 37 artifacts
verify. The image is now 54,231,280 bytes and its changes archive is 1,460,947 bytes;
the initial-release transfer measurements below describe the previous build.

This follow-up adds image-wide class/method search, the `*` all-protocol view,
selected-class reactivation by click or Enter, and theme-aware control styling.
A native query trace caught an older navigation overwriting a newer image-wide
search with scoped results. Navigation now retains the newer search's scope.

The final unit run passed 727/727. A focused Chromium rerun passed the method-search
regression, all-protocol navigation and mounted live-workspace behavior with
`A11Y_INTERACTIVE_CHECKS=1`. Its accessibility checkpoints covered the all-methods
view and the mounted workspace in light, narrow dark and print states. These are
automated checks, not a manual screen-reader or full-site conformance claim.
The focused six-case matrix has passing evidence in Chromium, Firefox and WebKit
across the initial run and targeted reruns. WebKit's native listbox test now clicks
the visible row through its owning listbox because individual option hit-testing
is unavailable. The initial WebKit workspace run could not find Program output
after clicking Run; its isolated traced rerun passed, including enabled
accessibility checkpoints. That intermittent failure has not been assigned a
confirmed cause, so this is not a claim of a clean single-pass matrix.
The preview used current frontend and rebuilt native assets at port 4209 with the
isolated tutorial HTML from the original release build.

## Initial release identity and reproducibility

The manifest SHA-256 is `f6ad2996d2efb1be5cbe3473e7928e8dcd170b88ba56aa53f494d48277480c27`. The runtime pins SqueakJS 1.3.3 at `284b7dacd385cfd3258c6337d41fc875459816ea`, Squeak 6 build 22104, and Refactoring Browser 3.1 inputs. `node scripts/smalltalk/build-image.mjs --verify` verified all 37 distributed artifacts. All six served adapter hashes matched the manifest on the coherent local preview at port 4198. The existing preview at port 4000 was verified earlier but was no longer listening at the final check. Integrity checking remains enabled. Build inputs and licenses are described in [the runtime README](../scripts/smalltalk/README.md). Git attributes preserve exact distribution/adapter bytes and treat offset-addressed image/source archives as binary. Authored-file whitespace checks pass; original whitespace in the hash-pinned upstream JavaScript is retained unchanged.

The isolated final HTML render took 109.186 seconds. The earlier isolated `make test-check` completed the Jekyll build, reference and quiz checks (68.358-second build); these are separate runs. Neither cleaned the user's shared preview. Task-specific checks use the coherent final rendered HTML, current frontend and the manifest above. The separate generic accessibility sweep uses an isolated copy and explicitly excludes Smalltalk for its own ready-state checks.

```sh
npm run test:unit
make test-check
node scripts/smalltalk/build-image.mjs --verify
npx playwright test --config=playwright.smalltalk.config.js
A11Y_INTERACTIVE_CHECKS=1 npx playwright test --config=playwright.smalltalk.config.js \
  tests/smalltalk-responsive-separator.spec.js tests/smalltalk-release-readiness.spec.js
WCAG_AUDIT_FULL_SWEEP=1 make audit-a11y
make audit-a11y-interactive
```

`playwright.smalltalk.config.js` imports the existing server and shared settings, discovers `smalltalk-*.spec.js`, and declares Chromium, Firefox and WebKit explicitly. A local Chrome executable override applies only to Chromium. Existing cases use the production capability helper to skip deferred refactoring behavior; those skips are not passes. The full three-engine suite has not been represented as completed merely because the config discovers it.

## Transfer size and timings

These are fresh measurements of the candidate files. Gzip columns sum each file compressed separately at level 6; they estimate a possible encoded transfer, not the observed HTTP response. The local Python preview serves these files without content encoding, so its actual body transfer uses the raw sizes. Small adapters and the manifest are additional.

| Boot asset | Raw bytes | Gzip-6 bytes |
| --- | ---: | ---: |
| Image | 54,055,512 | 15,598,144 |
| Sources | 54,972,153 | 10,399,423 |
| Changes | 1,459,993 | 229,535 |
| JavaScript runtime | 728,548 | 151,161 |
| Total | 111,216,206 | 26,378,263 |

A single representative public Host API sample on the same candidate, installed Google Chrome under headless Playwright at local port 4203, used an empty program and normal operation deadlines:

| Operation | Observed milliseconds |
| --- | ---: |
| Live image boot | 1,512.3 |
| Live program load | 6,781.6 |
| Warm evaluation | 42.3 |
| Independent fresh image boot | 1,460.4 |
| Fresh program load | 7,532.3 |
| Fresh evaluation | 70.9 |

The final tutorial journey separately observed 17,126 ms navigation-to-ready, 151 ms warm Run, 165 ms terminal evaluation, 5,918 ms live Accept and 8,217 ms for three independent checks. These are the Task 9 owner's single-sample browser observations, not a statistical benchmark. The focused readiness spec also attaches its own per-engine timing observations when a reporter retains attachments.

These are single samples, not percentile or network-performance promises. A valid steady-state memory measurement was not obtained. Image bytes do not measure resident memory: the page buffers assets and every worker expands its own image. No RAM-reduction claim is supported.

## Verification evidence and limits

The final unit suite passed **715/715**, with no skips or cancellations, in 5.030 seconds immediately before the requested commit. Its existing loopback-server and browser tests require local-network permission and `PLAYWRIGHT_BROWSERS_PATH` pointing to the installed managed browsers. An initial invocation without those prerequisites failed eight environment-dependent cases; the corrected invocation passed the entire suite. Distribution verification passed all 37 artifacts.

| Area | Completed evidence |
| --- | --- |
| Native runtime | All 53 distinct active cases have passing evidence across the original 44 passes, three corrected fixture reruns and six remaining cases. |
| Tutorial | All 25 distinct active cases have passing evidence across a combined 23-pass run and a targeted three-case rerun, with one overlapping case. |
| Popups and Inspector | Seven popup journeys, two existing session cases and four final Inspector cases passed. The compact-main detach/accept/live-state/return-focus journey additionally passed in 19.3 seconds. |
| Responsive separator | Chromium, Firefox and WebKit passed measured percentages, keyboard resizing and retained focus across targeted runs. |
| Layout behavior | Four distinct real-page journeys passed across targeted runs: laptop geometry, narrow reflow, keyboard layout changes with print, and compact search/queries/source views/package focus return. |
| Cross-engine mounted runtime | Chromium, Firefox and WebKit passed native evaluation, warm Run, retained bindings and light/narrow-dark/print accessibility checkpoints on the final presentation in 14.8, 32.4 and 34.2 seconds respectively. |

Cross-run coverage is not one clean full-suite command. The three native fixtures were corrected to use ordinary file acceptance instead of submitting arbitrary do-it expressions through the class-definition acceptance API; atomicity, recovery, revision and live-object assertions remain. Tutorial readiness waits now observe enabled controls during native initialization, without extending ordinary evaluation deadlines or changing expected results. Refactoring-only cases are explicitly skipped, not counted as passes.

The reduced native deactivation smoke passed in 20.2 seconds: the feature is off, trusted-code guard state is absent, six refactoring protocol calls are refused, and live/fresh state remains independent. These results validate deactivation and ordinary execution, not the deferred enabled-refactoring implementation. One earlier installed-Chrome raw-file/terminal-notification command passed its assertion but hung during teardown and was interrupted; it is not a clean command pass.

The generic accessibility sweep completed 103 pages with zero findings, then was deliberately interrupted after a large page took 1,491,591 ms and the aggregate chapter began. This is partial evidence, **not a full-site pass**. Eighteen generic accessibility checks also passed. The Smalltalk page audit waits for the real mounted Browser and terminal, not a loading screen. After the layout correction, print and authored-source audits passed. The screen audit found a 23-pixel pagination target; its 24-pixel minimum correction passed all three targeted screen checks in 27.5 seconds with zero findings across the tutorial and print routes.

Automated keyboard, focus-return, visible target size, 320-pixel reflow, 200%-equivalent viewport and focused/collapsed print checks have current passing observations. VoiceOver and a complete manual review of all 55 criteria were not performed; automated findings alone do not establish full WCAG conformance. Access to the user's existing browser tab was blocked by browser policy; visual review used fresh-context test screenshots. An unrelated tracked export, `notes/End-To-End Testing Concepts.html`, lacks the required AI-training reservation metadata and remains reported without editing that note.

## Workspace usability correction

A user screenshot exposed a usability defect that contrast checks did not detect. At 1710×858, only 54 pixels of the method editor were visible; at 1366×768 and 1280×720, no source-editor pixels were initially visible. The Browser's intrinsic 568–601-pixel height exceeded its 60% allocation, and a roughly 602-pixel terminal was placed in a 266–338-pixel pane. All measurements use CSS pixels from the rendered native tutorial.

The right pane now gives the Browser the remaining height above a compact 204-pixel Output / terminal dock. Collapse/Show and Expand/Restore change that allocation without replacing editors or the live image. Focus source editor also hides instructions and browser lists, with a visible Restore layout action. The instruction pane defaults to 30% width. Search, secondary Browser tools and terminal history/help use native disclosures; query results temporarily replace the list grid. A short compact success status keeps the latest terminal result fully visible even after Run adds program output beside it. Narrow or short viewports use document flow, and print exposes instructions and output even when the screen layout is focused or collapsed.

| Engine | Visible source rows at 1280×720 | Visible source rows at 1366×768 |
| --- | ---: | ---: |
| Chromium | 11 | 13 |
| Firefox | 11 | 13 |
| WebKit | 10 | 11 |

The final populated-output geometry run passed all three engines in 1.4 minutes. It executes Run, then returns focus and the pointer to the source editor and waits for the contextual Run tooltip to close before measuring; intentional tooltips are not treated as permanent layout loss. These counts intersect the actual editor surface with viewport and clipping ancestors, then hit-test for overlays. Text remains at least 17 pixels. Tests also require two terminal expression lines, visible Accept/Evaluate/latest-result controls, and at least 20 source lines in focus mode. Both themes are measured. Keyboard layout changes preserve the exact draft and a retained counter; accepting the edited method changes that same object's subsequent behavior. Closed-tools package Cancel and successful native Save return focus to the visible Browser tools disclosure. Independent code review approved the layout, focus, target-size, post-Run status and theme corrections. WebKit exposed delayed inherited color transitions after the global theme marker disappeared: surfaces had reached dark colors while nested labels were still near black. Smalltalk Browser/Inspector text and surfaces now switch together during the theme change; other site transitions are unchanged. The existing contrast checks passed without adding a wait or weakening their oracle.

## Preserved native catalog and deferred coverage

The native image retains the upstream package closure and 25 catalog classes. The executable [native fixtures](../tests/fixtures/smalltalk/refactoring-cases.json) contain 31 cases covering these 24 distinct operations; the [Smalltalk fixture source](../tests/fixtures/smalltalk/refactoring-catalog.st) supplies the image-side examples. The matrix is preserved for later activation; **every entry below is deferred for this release**, not certified by current capability skips.

| Operation family | Retained operation identifiers |
| --- | --- |
| Rename | `renameClass`, `renameMethod`, `renameInstanceVariable`, `renameClassVariable`, `renameTemporary`, `renameArgument` |
| Extract and inline | `extractMethod`, `extractTemporary`, `inlineMethod`, `inlineTemporary` |
| Move | `moveMethod`, `moveVariable` |
| Hierarchy | `pullUpMethod`, `pushDownMethod`, `pullUpVariable`, `pushDownVariable` |
| Parameters | `addParameter`, `removeParameter`, `reorderParameters` |
| Creation/removal | `addClass`, `removeClass`, `addMethod`, `removeMethod` |
| Accessors | `createAccessors` |
| Unavailable prerequisite | `splitClass`: retained-instance migration, assignment results and inverse-layout behavior are not proven |

The preserved suites cover preview/refusal, source and behavioral postconditions, native object/alias state, Undo/Redo and fresh replay where applicable. They retain specific safeguards for argument evaluation order, removed effectful arguments, temporary inlining and ordered instance slots. Native split-class remains unavailable rather than claiming those properties from scheduling isolation alone.

Historical framework evidence includes eight selected upstream SUnit tests passing in 19.131 seconds against the earlier framework image. The full upstream SUnit suite was not completed, and those selected tests were not rerun on this final disabled candidate. Earlier catalog runs used different candidate manifests and required fixture corrections; they must not be combined into a single final all-green run. The guarded refactoring release gate, full native catalog gate and final enabled-refactoring browser integration are explicitly deferred.

## Initialization deadline contract

The Host assigns each `loadProgram` initialization the existing `bootMs` budget
(default 120,000 ms), because loading definitions and building the source baseline
precede ordinary interaction. Asset acquisition and image boot also each have that
finite startup budget. Ordinary foreground operations retain 30,000 ms; explicit
Run/check retains 60,000 ms. Stop and cancellation remain available during loading.
This policy change does not alter the VM, native image, verified adapters, or global
limit defaults. The normal-deadline Firefox mounted release case passed in 32.0 seconds after
this correction. The earlier diagnostic-only 120-second request override is not
counted as production evidence.
