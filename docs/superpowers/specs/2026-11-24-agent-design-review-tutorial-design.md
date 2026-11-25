# Reviewing an AI Agent's Design with UML — tutorial design

Date: 2026-11-24. Status: approved by request (the user asked to design and
then build it in one message). Sources: CS 35L Fall 2026 lecture slides
L01–L19 (Box folder), especially L14 "Agentic SWE" slides 50–72; the
Fall 2025 and Spring 2026 exams; the SEBook CS 35L chapters.

## 1. Intent

L14 ends with a claim and a drill. The claim (slides 51–53): an agent writes
code faster than anyone can read it, so "in a generative world, judge the
design instead of the code". The drill (slides 59–72): seven design reviews.
Each shows a user story, the agent's UML diagram, and a "Find the flaw"
prompt with a concrete *Given:* scenario; the answer slide names the flaw,
the fix, and a "Lesson Learned" principle with an *Ask:* question.

The lecture can only run a few of these reviews, all on small diagrams. This
tutorial gives students repeated, spaced practice of the same skill on
**realistic** designs: the kind of diagram an agent actually returns when
asked "before you write code, show me a diagram". Each design is mostly
sound and contains **one objective flaw** that violates a concept taught in
the course: a scenario from the story's own acceptance criteria fails.

Students write their review as a free-text comment, the way they would in a
real design review. The local, in-browser language model (the one built for
the specification exercises) reads the comment against an authored answer key
and reports how **correct** it is (did it find the flaw, is the fix right) and
how **convincing** it is (does it trace the Given scenario to a concrete
failure of the story, pointing at the diagram). A knowledge check follows
every step.

## 2. Goals, non-goals, anti-goals

Goals

- Practice the L14 review loop (story → diagram → trace a scenario → name
  the flaw, its consequence, and a fix) on 9 realistic agent designs.
- Cover most lecture topics: each review targets one lecture concept, and
  the knowledge checks reach the remaining topics and space earlier ones.
- Free-text answers with formative feedback from the local model on two
  axes, correctness and convincingness, with feedback that coaches without
  giving the answer away.
- Fully usable without the model: write, compare with the expert review,
  self-assess. The model is an optional, on-device aid.
- WCAG 2.2 AA, light and dark mode, a light print view.

Non-goals

- Grading for credit. The model's reading is formative and never gates.
- Teaching the underlying concepts from scratch; the tutorial assumes the
  lectures and links back to the SEBook chapters.
- Teaching UML notation (other tutorials do that).

Anti-goals (a failure even if it works)

- Strawman diagrams with one obviously absurd box. Every design must look
  like a competent agent's answer, with good decisions around the flaw.
- Flaws that are matters of taste. Each flaw must break a stated story or
  acceptance criterion in a concrete scenario, with a lecture concept that
  explains why.
- Model feedback that states false facts, praises a wrong answer
  confidently, or reveals the answer before the student has tried.
- Rewarding keyword stuffing ("UDP transaction zero-trust") over reasoning.

## 3. Constraints

- Model: Qwen2.5-Coder 3B Instruct, 4-bit, on the student's device
  (`js/browser-llm/`). 4,096-token context; the ONNX path (Firefox
  graphics) rejects templated inputs above 768 tokens. Greedy decoding
  (temperature 0). One request at a time across tabs. The download (1.74 GB)
  is explicit and optional. `docs/local-tutor-evaluation.md` records that
  this model invents claims and is "not a reliable assessor of reasoning"
  when it writes free-form feedback.
- Runtime: `TutorialCode` (`js/tutorial-code.js`). The add-on currently
  mounts only on `backend: pyodide`.
- Storage: no new storage keys. Drafts and outcomes live in the tutorial's
  existing progress record.
- Audience: UCLA CS 35L sophomores; Gen-Z register; fun domains.
- Length: about 110 minutes across 9 steps (each step lists
  `estimated_minutes`).

## 4. Approaches considered

1. **Extend the diagram challenge** (`diagram_challenge`) with a free-text
   question. Rejected: its state machine is built around answering from the
   code first and locking in before the diagram appears; here the diagram is
   the artifact from the start, and there is no code.
2. **A new `design_review` step widget on a diagram-only workspace, with the
   model used as a classifier against an authored key** (chosen). The model
   answers three narrow yes/partly/no questions, each with a quote from the
   student's comment. The app verifies the quote, sanity-checks it against
   authored concept signals, and shows authored coaching text. This follows
   the "structured selection, app-authored wording" lesson of the Warehouse
   Rover tutor.
3. **Let the model write the feedback** (free-form judge). Rejected: the
   3B model invents facts, flatters, and leaks the answer (observed in the
   rover evaluation); its prose cannot be checked.
4. **Keyword/regex grading only.** Rejected as the primary signal: it rewards
   keyword lists and misses paraphrases. Kept as a guard: a "yes" whose quote
   carries none of the concept's signal words is downgraded to "partly".

## 5. The learner's experience of a step

Left column (instructions), top to bottom:

1. *Why this matters* + 🎯 objectives (project template).
2. The review card: the developer's request to the agent, the user story with
   its acceptance criteria, and the agent's reply (a short message that
   summarises its decisions, as agents do).
3. **Given:** the scenario to trace (as on the L14 slides).
4. The review box: "Your review comment", with a three-part prompt
   (Flaw · What goes wrong · Fix), a live word count, and two actions:
   **Check my review** (local model) and **Compare with the expert review**
   (available once the comment has at least 20 words).
5. Model feedback, when checked: two ratings in words and icons
   (Correctness: Not yet / Close / Correct; Convincingness: Not yet /
   Partly / Convincing), then one coaching line per unmet criterion, from an
   authored three-rung ladder (attempt 1 orients, 2 diagnoses, 3 scaffolds),
   plus targeted notes for known wrong claims. A standing caveat says the
   model can misread a comment.
6. After **Compare**: "Lesson learned: <principle>" with its definition and
   *Ask:* question (the L14 slide format), the expert's Flaw/Fix, a
   self-check ("My comment named the flaw / traced the Given scenario /
   proposed a fix that removes the cause"), and buttons that open the
   annotated diagram (a teaching callout on the flaw) and, where useful, the
   fixed design.
7. The model panel (download, engine, storage) sits under the review box.

Right side (workspace): the agent's diagram(s) in the authored-diagram pane,
maximized, with zoom, Fit, find, and full screen. Several diagrams appear as
tabs (the capstone shows two views; the flaw needs both).

Next opens the knowledge check once the step's review is complete
(compared with the expert review). The model's rating never gates.

## 6. The model judge

Module `js/browser-llm/design-review-judge.mjs` (pure, unit tested).

Per check, three short generations, each ≤ 48 output tokens:

| Criterion | Axis | Question to the model |
| --- | --- | --- |
| `flaw` | correctness | Does the comment identify this flaw (element + what is wrong)? |
| `consequence` | convincingness | Does it explain what goes wrong in the Given scenario, cause → effect on the story? |
| `fix` | correctness | Does it propose a change that removes this cause (key fix or an accepted alternative)? |

Each prompt holds the authored key for that criterion (≤ 400 characters),
plausible wrong claims ("not the flaw"), and the comment (≤ 1,200
characters), and fits the 768-token ONNX limit. The reply format is
`VERDICT: YES|PARTLY|NO` and `QUOTE: <words copied from the comment>`.

Deterministic post-processing:

- A YES or PARTLY needs a quote found in the comment (normalized; small
  differences tolerated). Otherwise it becomes NO.
- A YES whose quote and comment contain none of the criterion's authored
  signal patterns becomes PARTLY.
- Specificity (convincingness): does the comment name a diagram element
  relevant to the flaw (authored `anchors`)? Pure string matching.
- Ratings: Correctness = Correct (flaw YES and fix YES), Close (one of them
  YES or both PARTLY), Not yet (flaw NO). Convincingness = Convincing
  (consequence YES and an anchor named), Partly (consequence PARTLY, or YES
  without an anchor), Not yet (consequence NO).
- Feedback text is authored per scenario; the model's words are never shown
  except the verified quotes ("The assistant read this as your flaw: …").
- Known wrong claims are matched with authored patterns and answered with
  authored notes (shown only when the flaw is not YES).

Errors (no engine, input too long, cancellation, host lost) leave the draft
untouched and say what to do; the compare path always remains.

Limits stated in the UI and docs: a small model can misread a comment, a
check is formative, and passing it is not proof of understanding.
Evaluation: a labelled set of comments per scenario (correct, paraphrased,
partial, wrong claim, negated mention, keyword list, off-topic) is run
through the real model before release (§10).

## 7. Runtime integration

- `backend: none`: a TutorialCode backend with no runtime (`_initBackend`
  resolves at once; no Run, no OUTPUT). Steps without files show only the
  diagram pane: the pane gets a `codeless` option that hides the Editor view
  button and the "Code beside diagram" toggle.
- `design_review` step field, rendered server-side by
  `_includes/tutorial-design-review.html` (JSON spec plus pre-rendered
  Markdown templates, the diagram-challenge pattern), mounted by
  `js/tutorial-design-review.js` (`DesignReview.initFrom/destroyWithin`),
  rules in `js/tutorial-design-review-core.js` (record sanitizing, word
  counts, `isPassed`). Styles in `css/tutorial-design-review.css`.
- Records: `designReviews` in `tutorial-progress-<id>`, keyed by
  `_draftStepKey`; `{v, draft, checks:[{at, ratings}], revealed,
  revealedDraft, selfCheck}`. Reset Step clears the step's record; Delete
  saved progress clears all.
- Gating: `_stepGateSatisfied` treats a review like a diagram challenge:
  under `require_tests` the step needs a passed review (compared with the
  expert review after writing at least `min_words` words).
- Model add-on: `mountTutorialModel` accepts `backend: none`; Python actions
  stay Python-only. The panel's title becomes "Review assistant" on review
  steps and the panel moves into the widget. The add-on exposes
  `reviewDesign({spec, review, signal, onStage})` and announces itself to the
  widget (`tvm:llm-ready`).
- Instructions popout: the review card and the current comment, read-only,
  with "Write and check your review in the main tutorial window".
- Print: story, criteria, request, reply, Given, each diagram as an ArchUML
  block, a writing area; the key, lesson, and fixed diagram in the
  instructor-only block.

## 8. Content

See §9 for the scenario table. Every step follows: Why this matters → 🎯 →
(review card from the widget) → knowledge check. Every step names its
CS 35L concept in the title, the opener, and the task, and gives the
lecture's review question before the student writes, so the practice is
applying that concept. Telling concepts apart is left to the knowledge
checks, which mix in earlier topics. The case keeps only the claims that bear
on the concept (at most 190 words: request, story, criteria, reply, Given).
Pedagogy: the first step is a worked example with a partially written comment
to complete (fading), steps 2 and 3 give sentence starters in the concept's
terms, and the capstone shows two views with a shorter coaching ladder.

## 9. Scenarios

Ten reviews, each with one objective flaw that the Given scenario makes
visible. The tutorial YAML holds the final wording, keys, and quizzes.

| # | Scenario | Diagram | Course concept (lesson principle) | Support |
| --- | --- | --- | --- | --- |
| 1 | Late-night food-truck pre-orders | class | Information hiding: Stripe types leak through `PaymentGateway` (Hide What Is Likely to Change) | worked example, flaw sentence given |
| 2 | CS 35L midterm scores | sequence | Stateless HTTP and sessions: one server-wide `currentStudent` (Every Request Must Identify Its User) | sentence starters |
| 3 | Dorm laundry alerts | sequence | Test doubles: a stub cannot observe an indirect output (Verify Indirect Outputs With a Spy or Mock) | sentence starters |
| 4 | UCLA Radio weekly top 10 | component | Shell pipelines: warnings on stdout are counted as plays (Keep Diagnostics Out of the Data Stream) | concept-named task |
| 5 | Powell study-room booking | sequence | Database isolation: check-then-insert race (Let the Database Serialize Competing Writes) | concept-named task |
| 6 | Rate My Dining Hall | component | Security: stored XSS past a client-side editor (Never Render Another User's Text as Code) | concept-named task |
| 7 | Rose Bowl mobile tickets | class | Reuse: a 16-bit counter from a 600-seat theater (Check a Reused Part's Assumptions in the New Context) | concept-named task |
| 8 | Nightly game-jam release bot | sequence | Git: a bot squashes and force-pushes shared `main` (Never Rewrite Shared History) | concept-named task |
| 9 | Dorm-lounge karaoke machine | sequence | C memory: one buffer with two owners, use after free and double free (Give Every Allocation Exactly One Owner) | concept-named task |
| 10 | Bruin Monopoly on the lounge TV | class + sequence | Separation of concerns and Observer: game rules call React views (Separate the Domain Logic From the UI) | learner picks the view |

Each knowledge check has four questions: the step's concept, a transfer item
that asks for the fix in a new design, and spaced retrieval of an earlier
step or another lecture topic (CAP, least privilege, Make prerequisites,
Scrum, semantic dependencies, UDP absolute positions).

## 10. Verification

- `node --test` units: judge prompts (size, content, no hidden text beyond
  the key), parsing, quote verification, signal guard, ratings, coaching
  ladder; core record sanitizing and `isPassed`; YAML content checks (every
  review has a key, signals, anchors, coach ladders, lesson; anchors occur in
  the diagram source; quizzes follow the project rules).
- Playwright with a stubbed inference adapter: write → check → feedback →
  compare → gate → knowledge check; reload restores the draft; Reset Step;
  no model (self-assessment path); keyboard only; axe in light and dark;
  320 px reflow; print view.
- Real model (with the user's permission, since it downloads 1.74 GB, or in
  a browser that already caches it): the labelled comment set per scenario;
  report agreement and the misreadings before claiming accuracy.
