# The Broken Build - Game and Learning Design

## Product promise

The Broken Build is a quest-based practice game for Software Construction. The learner arrives as a young student whose appearance is derived from the saved SE Gym hero avatar. A campus software network has failed in several interacting ways. Restoring it requires authentic requirements, automation, version-control, networking, user-interface, modeling, data, testing, debugging, security, reuse, native-code, build, AI-supervision, interoperability, maintainability, review, and process decisions.

The world is not a reward layer wrapped around a quiz bank. Every visible repair corresponds to evidence that a learner can predict, analyze, repair, explain, or transfer a course skill. There is no leaderboard, life counter, speed gate, or purchasable advantage.

## Audience and prerequisites

The primary audience is an upper-division undergraduate with prior programming experience but uneven software-construction experience. Learners are expected to recognize basic control flow and functions. The game teaches or revisits the operational models needed for shell, Python, Git, JavaScript, React, relational data, testing, C, and Make.

The app assumes no high-end graphics hardware, pointer device, hearing, color perception, or ability to tolerate motion. The three-dimensional world is an enhancement over the complete semantic mission interface.

## Enduring understandings

After the full arc, a learner should be able to:

1. Turn stakeholder needs into observable contracts and meaningful evidence.
2. Select and compose tools by their operating model rather than by memorized slogans.
3. Explain system state across files, Git history, network layers, user-interface state, and persistent data.
4. Localize change and failure through boundaries, information hiding, models, tests, and debugging evidence.
5. Evaluate security, reuse, AI assistance, interoperability, and process through explicit risks and trade-offs.
6. Integrate these skills during an unfamiliar incident and defend the order of intervention.

These objectives target Apply, Analyze, Evaluate, and Create. Recall is used only as a component skill inside a more meaningful task.

## Narrative and motivation

The learner is preparing a campus research showcase when a coupled software failure darkens eight districts. Repairing a mission relights the corresponding part of the WebGL world. The narrative supports three motivation needs:

- **Autonomy:** every non-capstone mission remains selectable. Prerequisites are recommendations, not arbitrary walls. The learner can pause animation, hide the world, request a hint, revisit completed work, or continue into deeper SEBook practice.
- **Competence:** early missions provide short, concrete successes. Later missions integrate more elements. Feedback explains the reasoning gap and always permits another attempt.
- **Relatedness:** the learner is framed as a trusted teammate restoring systems for other students, not as an isolated test taker. The language normalizes debugging, revision, and incomplete first attempts.

Progress is represented by systems restored and review evidence, not points. Hint use never removes progress or shames the learner; it schedules an earlier revisit because the memory trace needs more practice.

## Learning loop

Every mission uses some or all of this loop:

1. **Brief:** name the user-visible failure and the mission objective.
2. **Predict:** commit to an expected result or first diagnosis before revelation.
3. **Inspect or run:** observe code, logs, messages, models, or simulated system state.
4. **Repair:** make one bounded change or decision.
5. **Verify:** receive immediate behavior-focused feedback from a deterministic evaluator.
6. **Explain:** articulate why the repair works and which assumption mattered.
7. **Transfer:** revisit the same deep structure in a different surface context.

This implements PRIMM, retrieval practice, worked-example fading, and the generation effect. Earlier skills reappear inside later missions: acceptance criteria become tests; tests become debugging and Git-bisect oracles; security shapes reuse and AI review; interfaces connect networking, data, interoperability, and complexity.

## World and quest structure

The production catalog contains 27 missions across eight districts:

| District | Course evidence practiced |
| --- | --- |
| Briefing Bay | User stories, acceptance criteria, requirements versus implementation |
| Automation Works | Shell pipelines, streams, encoding, Python names and types |
| History and Network Nexus | Git snapshots, transport trade-offs, asynchronous execution |
| Interface and Modeling Studio | React state, Observer lifecycle, model views, SOLID reasoning |
| Data and Reliability Vault | Relational operations, transactions, test design, debugging, Git recovery |
| Security and Supply Forge | Trust boundaries, injection defense, reuse, C resources, Make, AI supervision |
| Architecture Council | Semantic APIs, information hiding, code comprehension, clean code, review, process |
| Integration Core | A cumulative incident response and design-defense capstone |

The capstone becomes playable after 20 missions. Its named prerequisites remain visible so a learner can deliberately fill a gap rather than encounter a silent lock.

## Mini-game system

Mission content is immutable data. React rendering and evaluation are selected by a discriminated `kind` field. The initial registry supports five reusable mechanics:

- **Choice:** one decision with option-specific feedback aimed at the reasoning behind each distractor.
- **Select many:** build an exact evidence, defense, or decision set; selecting every plausible-looking option does not pass.
- **Ordering:** reconstruct a process, event timeline, query pipeline, build chain, or incident response. Move-up and move-down buttons provide a non-drag interaction.
- **Matching:** map scenarios to models, transports, contracts, resources, or process strategies with labeled native selects.
- **Text entry:** enter a small command or expression when production behavior has a finite, defensible set of equivalent forms.

New mechanics implement one rendering component, one evaluator branch, and focused tests. Quest data never imports React, Three.js, browser storage, or framework components.

Future mechanics that fit this boundary include a Git graph manipulator, a relation-table query builder, a safe debugger trace player, an API message simulator, a C memory-lifetime board, and a code-review annotation surface. Each must expose an equivalent semantic control path and a deterministic evaluator before it enters the catalog.

## Scaffolding and adaptive review

The first attempt presents the mission without its answer. A learner can reveal one conceptual hint. Correct feedback includes a self-explanation prompt rather than immediately rushing onward.

Completed challenges enter a local spaced-review schedule. Review intervals grow from one to three, seven, and fourteen days after successful retrieval. A failed review keeps the original completion but shortens the next interval. The app records attempts, hint use, completion time, and review level only in the learner's browser.

No algorithm claims that completion equals mastery. Completion means the learner produced the required evidence for one bounded challenge. District and course mastery require varied transfer tasks, deeper linked tutorials, and the integrated capstone.

## Avatar design

The avatar adapter reads the existing `se-gym-hero-avatar` record without changing it. The WebGL student maps these saved parameters to procedural geometry:

- hero kind controls human or Bruin head geometry;
- skin, hair, eye, suit, cape, and accent colors use saved palette values;
- hair style adjusts procedural hair silhouette and volume, including short, long, textured, spiked, and bald families;
- body type adjusts proportions within safe visual bounds;
- outfit style selects the saved suit palette and whether the simplified world avatar carries a cape.

Invalid or unavailable records fall back to the established SE Gym defaults. The game links back to the SE Gym customizer rather than creating a competing avatar editor or schema.

## Accessibility and inclusive interaction

The semantic interface is the authoritative game surface. The WebGL canvas is decorative and hidden from the accessibility tree because all district names, progress, mission states, and actions exist in HTML.

Production requirements include:

- native buttons, radios, checkboxes, selects, progress, and textarea controls;
- complete keyboard operation with no custom single-key shortcuts;
- no drag-only, pointer-only, color-only, or timed mission;
- visible focus indicators and targets of at least 24 by 24 CSS pixels;
- text and user input at paragraph size or larger;
- `role="status"` feedback that does not steal focus;
- a pause control for continuing motion and automatic pause when reduced motion is active;
- a text-only world option and automatic fallback when WebGL is unavailable;
- responsive reflow at 320 CSS pixels without horizontal page scrolling;
- paired light/dark presentation through the site design tokens;
- a print view that removes the canvas and retains objectives, mission text, and progress;
- no audio, flashing, or essential animation.

Automated accessibility checks cover initial, incorrect-feedback, correct-feedback, reset-confirmation, text-world, and WebGL-fallback states. Keyboard and screen-reader spot checks remain part of release verification.

## Technical architecture

The sub-app is a private npm workspace under `apps/software-construction-quest`. Vite produces a fixed entry module plus hashed lazy WebGL chunks under `assets/software-construction-quest`. Jekyll remains responsible for the page title, canonical URL, theme initialization, skip link, footer, and unified privacy notice.

Dependency direction is inward:

- `domain` owns challenge contracts, evaluation, progress, and review scheduling;
- `content` owns the lecture-derived immutable quest catalog;
- `adapters` translate browser storage, SE Gym avatar data, and WebGL capability;
- React components render domain state and forward learner actions;
- the Three.js scene consumes read-only progress/avatar view models and contains no learning rules.

The Three.js chunk is lazy-loaded only when supported and enabled. Graphics use capped device-pixel ratio, procedural geometry, no remote textures, no external fonts, and a paused on-demand render loop. A scene failure leaves the semantic mission interface operational.

## Security, privacy, and integrity

The application is static and requires no account, backend, analytics, or third-party API. It never evaluates learner-provided JavaScript, shell, Python, SQL, or C. Text-entry challenges use narrow normalized-answer contracts; richer future coding missions must reuse sandboxed tutorial workers rather than `eval` or dynamic function construction.

React renders all course strings as text. There is no `dangerouslySetInnerHTML`. Persisted data is schema-normalized at the boundary. Corrupt or future-version progress falls back safely without affecting the existing avatar record.

The single new key, `software-construction-quest-progress`, is documented and deletable from the site's storage inventory. The in-app reset uses a reversible confirmation step.

## Performance and resilience targets

- The mission interface renders before the WebGL chunk finishes loading.
- Failure to create a WebGL context shows the text world without losing functionality.
- Canvas device-pixel ratio is capped at 1.5.
- Motion can be paused; the render loop switches to on-demand while paused.
- No remote asset is required for gameplay.
- Production builds emit source maps and deterministic static assets.
- A JavaScript error boundary isolates scene failures from the mission interface.
- All domain evaluators and progress transitions are deterministic and unit tested.

## Course-source decisions

The catalog is derived from all PDFs supplied for the Spring 2026 course. Overlapping files are treated as revisions:

- `L18_Process.pdf` and `L19_Process.pdf` are substantively the same process lecture; they support one mission set.
- `L17_CleanCode.pdf` is updated and embedded in `L18_Code_Review.pdf`; the game uses the newer design-by-contract framing while retaining the earlier file as provenance.
- `L19_Summary.pdf` and `L20_Summary.pdf` support one cumulative finale, with the newer top-down comprehension and Bruins Assemble framing.
- `L15_ManagingComplexity.pdf` and `L16_ManagingComplexity.pdf` are revisions of the same managing-complexity material and support one district arc.
- `L15_Interoperability.pdf` and the API half of `L17_Code_Comprehension_API_Design.pdf` jointly support the semantic-interface mission.

Every quest entry carries its source filename and physical PDF page range, so future authors can re-check the educational claim without reverse-engineering the game copy.

## Production acceptance criteria

The feature is ready to ship when:

1. All 27 missions render, submit, retry, complete, persist, reset, and reload correctly.
2. Every supplied lecture theme appears in the traceable catalog and the overlap decisions above remain documented.
3. Domain unit tests and behavior-level Playwright tests pass without fixed sleeps.
4. The Jekyll production build generates and includes the app bundle before deployment.
5. The app passes targeted WCAG 2.2 AA checks in its important interaction states.
6. Light mode, dark mode, reduced motion, paused motion, text-only mode, WebGL fallback, print, desktop, and 320-pixel reflow are verified.
7. Progress and avatar data remain local, documented, deletable, and resilient to corruption.
8. A reasonable internal refactor of React components or Three.js geometry does not break domain or user-behavior tests.
