# Review and Repair Actual Teaching Materials

Use for slides, speaker notes, handouts, worksheets, lab instructions, LMS pages, question banks, assignments, rubrics, or a mixed teaching pack. Combine with `03_analysis-and-critique.md` and the relevant design workflow; this file supplies the artifact inspection and repair steps.

## 1. Inspect the material before judging it

1. Open the supplied artifact. Record its version and the actual scope inspected. A filename, thumbnail, or prior conversation is not the content.
2. Use the appropriate presentation, document, spreadsheet, or PDF workflow when available. Read extracted text and inspect visual rendering where placement, diagrams, equations, tables, reading order, or density affect interpretation. Include speaker notes, solution keys, hidden slides, and rubric sheets only when accessible and relevant; distinguish them from student-visible content.
3. Use stable locators: slide number **and title**; PDF page **and printed page if different**; section heading and paragraph opening; question ID; rubric row and performance band. Record which version the locator refers to.
4. If only an excerpt is available, review that excerpt and identify the uninspected scope. Do not claim a full-deck, full-course, or accessibility audit from partial content.
5. Extract the likely learning goal, prerequisite knowledge, student action, success criterion, time demand, and AI condition. Distinguish observed information from inferred intent. Proceed with reasonable assumptions where the user has left ordinary details open.

For long artifacts, first inspect the complete structure, then every high-stakes item and a purposeful sample of lower-stakes pages. State the coverage. Expand only when a detected pattern warrants it or the user requests an exhaustive review.

## 2. Diagnose the learning bottleneck

Trace the student journey: **encounter → interpret → attempt → receive feedback → revise or transfer**. Find the first point where a student is likely to lose the intended learning opportunity.

| Look for | Diagnostic question | Concrete evidence |
|---|---|---|
| Goal and assessment | Would succeeding here demonstrate the target capability? | Task demand compared with stated outcome and rubric |
| Prior knowledge | Is a necessary concept assumed before it is introduced or checked? | Unexplained notation, skipped step, diagnostic response |
| Explanations and examples | Can a novice see the decision and why it works? | Missing intermediate state, unexplained branch, only a finished answer |
| Cognitive work | What must each learner produce or decide? | Prediction, explanation, trace, comparison, test, or revision |
| Feedback | What changes after the response? | Answer key, decision rule, next attempt, correction task |
| Access and usability | Does a feature obstruct the intended task? | Unreadable label, color-only encoding, image-only code, missing alternative text |
| Workload | Can the required action fit its allotted time? | Steps, reading burden, tooling, pilot timing |
| AI evidence | Can the product distinguish student judgment from generated fluency? | Verification artifact and individual demonstration tied to the outcome |

Check technical accuracy independently of pedagogical quality. Recompute an answer, trace code, test an example, or verify a cited claim when needed. A beautifully scaffolded wrong example is still wrong. Distinguish an educational design judgment from a disciplinary uncertainty that requires a source or specialist check.

## 3. Write findings as repair instructions

Each important finding needs:

`Locator → observed issue → likely learning consequence → exact repair → verification`

Add priority, confidence, and evidence basis when they help the decision. Use the existing P0–P3 scale. Do not inflate stylistic preferences into validity failures. Preserve effective features explicitly, and select the few repairs with the greatest expected learning benefit within the available preparation time.

Example:

> **P1; slide 12, “Retries”; high confidence in the gap.** The diagram shows a lost response followed by a repeated request, but does not show the database state. Students can interpret a retry as a second reservation. Add state snapshots before and after the timeout, and ask “Which identifier tells the server these are the same operation?” Allow 60 seconds of individual prediction and 90 seconds of comparison. Reveal the persisted request identifier only after responses. Verify with a new scenario in which the response is lost after a successful commit.

The exact timings in a repair are planning choices, not established attention-span rules. An activity must include its prompt, expected response, likely wrong response, debrief, and what to do next. “Add active learning” is not a repair.

## 4. Produce the smallest sufficient change

Choose the lowest effective revision rung from `05_improvement-and-revision.md`.

- **Slide:** provide replacement title, displayed text, diagram instructions or revised visual, speaker notes, learner prompt, and reveal sequence as needed. Keep necessary detail in notes or a handout when it overwhelms the display.
- **Handout/LMS page:** rewrite the exact confusing passage, provide a short example or response space, make the submission and next action explicit, and preserve navigable structure.
- **Assignment/lab:** reconcile outcomes, instructions, starter files, constraints, tests, deliverables, rubric, solution, and AI rules. Check edge cases and acceptable alternatives.
- **Question/exam:** solve the item first, repair ambiguity and scoring criteria together, and check that the revised version elicits the intended inference without accidental cues.
- **Rubric:** replace vague adjectives with observable distinctions; accept diverse successful approaches; test a strong, weak, and borderline sample against the descriptors.

Respect the requested base file, slide master, template, theme, numbering, visual identity, speaker voice, and explicit content constraints. When the user requests exact template fidelity, edit the base artifact and reuse its layouts rather than approximating them. Apply changes already authorized; do not create a new approval requirement for routine reversible edits.

For tradeoffs, offer an implementable minimum repair and a fuller redesign. Quantify what the new activity replaces so student and staff time do not silently grow. Do not change grades, deadlines, institutional rules, or accommodation arrangements in a draft as if those decisions had already been made.

## 5. Validate the revised deliverable

Use checks appropriate to the file and consequence:

1. Reopen the written artifact; verify that the requested changes actually appear.
2. Inspect affected pages/slides visually and inspect neighboring pages if reflow or layout changes can affect them. For broad layout changes, render the whole artifact. Look for clipping, overlap, illegible text, broken tables, diagrams, equations, and answer reveals.
3. Check instructional coherence: examples match explanations; prompts have usable keys; instructions match rubric and submission format; timing adds up; prerequisite terms precede use.
4. Check substantive correctness with a solution, calculation, executable check, or trace appropriate to the material. Use meaningful tests of boundary conditions where code or calculations are central.
5. Check basic accessibility features available in the file: readable contrast and size, text alternatives for meaningful visuals, logical reading order, captions/transcripts where needed, and non-color cues. Do not call a limited inspection a compliance certification.
6. Report what was validated and any material remaining limitation. If tools cannot write or render the artifact, deliver an exact edit map or replacement material and say the file itself has not been revised or visually verified.

## Output

Use `../templates/material-review.md` for substantial reviews. For a small repair, return the revised artifact or passage and a concise explanation. A review should make the next teaching action obvious, not merely enumerate criticisms.

## Evidence boundary

The workflow is an original operational synthesis. Its instructional rationale draws on `Ambrose2010`, `Atkinson2000`, `Sweller2019`, `Dunlosky2013`, and `Wisniewski2020` in `../references/bibliography.md`; these sources do not validate this exact inspection sequence. The specific repair remains a design hypothesis to check with learner responses and implementation evidence.
