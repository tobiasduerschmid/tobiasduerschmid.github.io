# WCAG 2.2 AA deep audit — September 25, 2026

This audit covers the built site, its interactive learning flows, and print output. It records evidence and repairs; it is not a WCAG conformance certification. Automated tools cannot determine every success criterion, and a complete assistive-technology evaluation remains necessary.

## Scope and method

The shared build inventory accounts for 216 HTML outputs: 214 user-facing pages and two internal execution documents (`haskell-runtime-frame.html` and `vm/snapshot/`). All 216 documents are included in the final audit scope; the two runtime documents are separately grouped and tested rather than excluded. The screen inventory previously missed 22 pages and the print inventory missed 16.

The screen sweep checks light and dark themes, rendered semantics, contrast, real keyboard focus traversal, 320-pixel reflow, and WCAG text-spacing overrides. The print sweep checks every user-facing page under a saved dark preference. Interactive checkpoints inspect the actual states reached by tutorial, quiz, gym, editor, tooltip, and settings tests. Source inspection identifies candidates for human review; a matching string is not proof of accessibility.

Reports preserve an atomic checkpoint after each page, record navigation failures, and distinguish “no automated findings” from conformance. The criterion matrix lists all 55 Level A/AA criteria without presenting them as automatically verified.

## Findings and root causes

| Area | Cause | Repair and regression evidence |
| --- | --- | --- |
| Audit coverage | Hand-maintained page/spec lists omitted outputs and interactive flows; essential axe rules were disabled in dynamic states. | Derive page/spec inventories, enable state checks in both themes, and add positive/negative oracle fixtures. |
| Audit classification | Class-based skip-link checks and a scrollability check misclassified valid semantic bypass links and native controls. | Check landmark relationships and actual focusability; retain regression fixtures for valid and invalid cases. |
| Skip navigation | The smooth-scroll handler canceled native anchor focus. | Exclude skip links from smoothing; exercise Tab → Enter → main focus across page families. |
| Tutorial switches | `display:none` removed visible Auto-save and Dark mode switches from the tab order and accessibility tree. | Preserve native checkbox semantics and keyboard operation, with a visible focus ring on the switch track. |
| Code-editor escape | The accessible instructions promised Escape would leave Monaco, but no exit command existed. | Share an Escape command across main and detached editors; preserve Monaco's suggestion/find dismissal before leaving. |
| Detached editor startup | Multiple snapshots arriving before Monaco loaded each queued editor creation, producing duplicate textareas and ambiguous keyboard focus. | Serialize initialization and retain the latest snapshot; reproduce the race with a deferred loader instead of masking it with retries. |
| Diagram toolbar | Bootstrap moved `title` text into an internal tooltip attribute, leaving icon glyphs as accessible names. | Explicit accessible labels for every generated diagram control. |
| Tutorial reflow | Long inline code identifiers could not break at narrow widths or with increased spacing. | Allow inline instruction code to wrap while retaining preformatted code scrolling. |
| Transitional contrast | Foreground/background interpolation and quiz-card opacity fades produced unreadable intermediate frames. | Change paired colors together and remove the text-opacity entrance effect; retain unrelated motion. |
| Tutorial feedback | Light-theme success, informational, and error colors were below the required contrast. | Correct shared light-theme tokens; inspect actual test and error states. |
| Make dependency graph | Header and empty-state code reused colors intended for graph nodes; task text was undersized. | Readable 16px text, wrapping headers and empty guidance, and contrasting message colors; renderer regression covers both themes at 320px. |
| SQL results | NULL and empty-result colors had no light-theme override, and table text was undersized. | Add contrasting light-theme message colors and use 16px table text. |
| SQL editor name | Separate backend-to-language and backend-to-label mappings both omitted SQL, so the editor announced itself as Shell. | Use one paired language/label mapping including SQL; reproduce the incorrect accessible name before applying the fix. |
| Regex exercises | Dark highlighted matches and light primary buttons had insufficient contrast; an empty Parsons bank had an ARIA label without a supporting role. | Correct colors and give the bank a group role in both renderers. |
| Print output | Citation, heading, language-switcher, and shared button styles leaked dark or yellow colors onto white paper. | Centralize light print palettes and correct selectors for components reused outside the Gym. |
| Diagnostic galleries | VM-specific dark styles leaked through a shared stylesheet; pages lacked responsive metadata and usable bypass/scroll regions. | Scope styles by page responsibility, add landmarks and keyboard access, support narrow headings, and load the shared print policy. |
| UML homework help | A flex row could not shrink its help text beside the dismiss button at 320px. | Wrap the banner and help-list items while retaining the intended visible help. |
| Runtime documents | The VM snapshot page lacked responsive metadata, a main landmark, a live status, and a keyboard-accessible log. | Preserve the runtime protocol while adding semantic structure, a named focusable log, 16px text, and light print output. Give the Haskell frame an explicit light print canvas while preserving its existing runtime structure. |
| Portfolio | Muted headings lacked contrast and a four-cell button layout overflowed under text spacing. | Correct muted colors and allow comparison controls to wrap without shrinking text. |
| Carousel focus | Auto-advance could hide a slide while its comparison image still held keyboard focus. | Reproduce with the browser clock, then pause rotation on keyboard interaction until the user explicitly resumes it. |
| Project navigation | The shared navigation include read an ambient project variable instead of its supplied title, producing an empty link on AVA. | Render the explicit include title, with a compatibility fallback. |
| Writing guide | An examples list and text were direct children of another list. | Keep the examples inside the relevant parent list item. |
| Combined textbook | A lone Python equality operator was matched with a later highlight delimiter across rendered sections, corrupting content and producing low-contrast highlighted summaries. | Constrain highlight parsing to inline content and add malformed-delimiter regressions. |
| Detached graph | A scrollable graph region remained focusable behind the disconnected overlay. | Keep the region inert and hidden from accessibility APIs until a graph arrives, then expose a named keyboard-scrollable region. |
| Gallery alternatives | Numbered image alternatives did not describe the scene or pencil effect. | Describe all eight inspected images and preserve the scene description when comparing with the original photograph. |
| Embedded media | YouTube players exposed invalid ARIA and unnamed controls in their own documents. | Replace embedded players with descriptive external links while retaining in-page visual descriptions. Remove the SlideShare frame while retaining its descriptive link; update the storage inventory. |

## Manual evidence

Manual browser inspection checked keyboard bypass and focus, settings state/feedback, tooltip dismissal, diagram names, Monaco exit behavior, gallery comparison descriptions, and narrow-screen controls. Portfolio comparison buttons remain 17px and fit a 320px viewport in light and dark themes. The Make graph header and live SQL result tables, including NULL values, were visually checked at normal zoom in both themes. German paragraphs in the portfolio retain explicit `lang="de"` markup. Diagnostic diagrams were inspected under print emulation to verify the dark inversion filter is removed.

The gallery alternatives were written after inspecting the actual images. Linked external video caption accuracy and audio-description equivalence have not been certified. No screen-reader listening session was performed; DOM and accessibility-tree inspection are recorded separately from assistive-technology testing.

## Verification results

Completed verification:

- **216/216 HTML outputs** have completed screen and print records with **zero automated findings**. The [per-URL coverage inventory](wcag22-deep-audit-2026-09-25-coverage.json) records the source reports and their hashes.
- **451/451 affected interactive tests passed** across 20 complete specs, including all previously skipped serial states (44.7 minutes).
- **246 unit tests passed**, with zero failures, skips, or cancellations (`npm run test:unit`).
- **9/9 accessibility-helper regressions passed**. Representative home, SEBook, blog, and Regex states passed in both themes; a real quiz review flow and both navigation contrast regressions passed after the final helper change.
- The final SQL accessible-name and query-execution checks passed (2/2), as did all four editor Escape regressions after repairing the popup initialization race. Both deterministic popup race regressions failed against the old runtime and passed the fix; they are included in the unit total. Fresh screen checks of SQL and both editor popouts reported zero findings.
- Both carousel focus/auto-advance regressions passed. Focused keyboard bypass, editor Escape, diagram naming, graph-popout, switch, and Make graph regressions also passed.
- The supplemental run initially passed 141 of 150 tests. Its Haskell contrast failure was repaired and verified in the 451-test run; the eight timing failures passed with their original limits after reducing simultaneous browser/build work. No timeout or retry was relaxed.
- The source inventory found authored-source candidates for **36 manual/flow criteria**. This is an inventory result, not verification of those criteria.

Coverage is assembled from completed page records and focused checks after repairs. Interrupted multi-page runs contribute only fully completed page records; their unvisited or partial pages are covered by subsequent runs. The two combined textbooks received full screen and print verification. Their rendered HTML was byte-identical between the final two builds.

Browser checks use an isolated Jekyll build and a local Playwright configuration with automatic build cleanup disabled. Each served build remains immutable throughout its active runs. To reproduce the audit on a normal clean checkout, run `WCAG_AUDIT_FULL_SWEEP=1 make audit-a11y` and `make audit-a11y-interactive`.

## Interpretation of criterion coverage

The generated screen report lists every one of the 55 A/AA success criteria for every audited URL. Its automated result applies to the implemented checks and observed states. The following complementary evidence prevents that matrix from being mistaken for a blanket conformance claim:

| Criteria | Additional evidence or remaining judgment |
| --- | --- |
| 1.1.1 | Actual gallery images inspected and alternatives rewritten; diagram names and textual structures inspected. Complete equivalence of all complex diagrams still needs specialist review. |
| 1.2.1–1.2.5, 1.4.2 | Embedded third-party player defects removed through descriptive external links. Caption accuracy, complete audiovisual equivalence, and external audio description remain unverified. |
| 1.3.1–1.3.5 | Landmark/list/control semantics and responsive layouts checked. Reading sequence, sensory instructions, and input-purpose appropriateness need contextual judgment beyond DOM validation. |
| 1.4.1, 1.4.3, 1.4.11 | Both themes and real feedback states checked; toggle focus rings measured. CSS-filtered diagrams are explicitly retained for visual review. |
| 1.4.4, 1.4.10, 1.4.12 | Narrow 320px layouts and WCAG text-spacing overrides exercised; affected controls visually inspected at normal zoom. This does not substitute for every browser/OS zoom combination. |
| 1.4.5 | Images inspected for the repaired gallery; all instructional images of text still require content-level review. |
| 1.4.13 | Tooltips tested for keyboard access, persistence, hoverability, and Escape dismissal. |
| 2.1.1, 2.1.2, 2.1.4 | Native keyboard traversal, switches, named controls, and Monaco escape tested; project shortcut reference updated. |
| 2.2.1, 2.2.2, 2.3.1 | Source and flow candidates reviewed; automated coverage cannot establish every timing or flashing condition. Carousel focus/auto-advance has a deterministic regression covering the previously hidden focused slide. |
| 2.4.1–2.4.7, 2.4.11 | Bypass behavior and focus tested with real keyboard events; link purpose, titles, names, visible focus, and obscuration checked. Complete user-journey order remains a manual consideration. |
| 2.5.1–2.5.4, 2.5.7, 2.5.8 | Control names and target sizes checked in interactive states; gallery comparison supports keyboard use. Every drag/gesture workflow still needs end-to-end assistive-technology review. |
| 3.1.1, 3.1.2 | Document languages checked; German portfolio passages retain explicit language markup. Full language-of-parts review is contextual. |
| 3.2.1–3.2.4, 3.2.6 | Settings and tutorial flows inspected for predictable state/focus behavior; complete consistency across all journeys remains a manual judgment. |
| 3.3.1–3.3.4, 3.3.7, 3.3.8 | Real validation, error, and persistence flows exercised where present. Applicability and adequacy of financial/legal/authentication criteria require contextual review, not keyword matches. |
| 4.1.2, 4.1.3 | Accessible names/states and live-status markup inspected; no screen-reader announcement listening session was performed. |

## Limits

The interactive helper checks non-color hover and focus cues for color-distinguished text links without moving focus or scrolling. If an already active link prevents safe inspection of its default style, it emits a separate manual-review notice; it does not invent a conformance result.

A clean automated result does not settle media equivalence, reading and focus order in every state, the rendered contrast of CSS-filtered diagrams, the usability of complex SVG diagrams with a screen reader, or every criterion that depends on human judgment. External destinations are linked resources, and their accessibility is not certified by this site's tests. The report therefore retains `manualReviewRequired: true` and `conformance.status: not-determined` when automated checks pass.

References: [WCAG 2.2 conformance requirements](https://www.w3.org/TR/WCAG22/#conformance-reqs) and [WAI guidance on evaluation tools](https://www.w3.org/WAI/test-evaluate/tools/selecting/).
