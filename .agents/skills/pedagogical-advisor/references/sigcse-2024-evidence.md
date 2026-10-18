# SIGCSE TS 2024: selected evidence and teaching adaptations

Checked **2026-09-05**. Four additional primary papers from the **55th ACM Technical Symposium on Computer Science Education (SIGCSE TS 2024)**. This targeted supplement is not a systematic proceedings review. `CS-AI-005` in `cs-ai-evidence-2026.md` already covers *Prompt Problems*; do not count it again. CHI, ICER, Learning @ Scale, and SIGCSE Virtual papers retain their actual venues.

## Contents

- SIG24-01: contextual error explanations
- SIG24-02: tiered formative feedback
- SIG24-03: course-specific assistants and answer audits
- SIG24-04: instruction before proof practice
- Original implementation moves
- Search and access log

## SIG24-01 — Contextual error explanations help repair; learning requires separate evidence

**Wang, Mitchell, & Piech (2024). A Large Scale RCT on Effective Error Messages in CS1. SIGCSE TS 2024.** [DOI](https://doi.org/10.1145/3626252.3630764); [author PDF](https://sierrawang.github.io/A_Large_Scale_RCT_on_Effective_Error_Messages_in_CS1___Camera_Ready.pdf).

- **Access/design:** full author methods/results inspected, PDF pp. 2–5. Six initially randomized message conditions in Code in Place; 8,762 enrolled, but analysis retained **5,707 who never switched conditions**. GPT used `text-davinci-003`.
- **Outcome:** body results report repeated errors in 31.4% of runs with GPT-default versus 40.8% with standard messages; approximately 1.58 versus 1.88 runs to resolve an error. These are assisted repair outcomes. No consistent course error-rate advantage or independent retention benefit was established.
- **Limits/inference:** B for bounded repair evidence, C for causal interpretation after postassignment exclusions. Abstract and body disagree on enrollment and headline relative reductions; use labeled body figures. “Additional attempts” subtracts the necessary first attempt; do not report that percentage as reduction in total attempts. Nonsignificant demographic differences do not establish universal equity.

## SIG24-02 — Tiered feedback is a draft to validate

**Nguyen & Allan (2024). Using GPT-4 to Provide Tiered, Formative Code Feedback. SIGCSE TS 2024.** [DOI](https://doi.org/10.1145/3626252.3630960); [official abstract](https://sigcse2024.sigcse.org/details/sigcse-ts-2024-Papers-1/43/Using-GPT-4-to-Provide-Tiered-Formative-Code-Feedback).

- **Access/design:** official abstract and author publication record inspected; ACM full-text retrieval failed. Experience report generating feedback on **113 submissions to four problems** in an Algorithms and Data Structures course. This is a submission count, not 113 independent participants.
- **Outcome:** prompts combined examples with instructions addressing conceptual understanding, syntax, complexity, and actionable questions. Instructor/tutor ratings found the feedback generally accurate and hints useful; performance varied across problems. The inspected evidence does not demonstrate student uptake or learning gains.
- **Limits/inference:** C for feedback preparation; D for causal learning improvement. Exact rating distribution, rater agreement, student denominator, and feedback-use outcomes remain unverified. Validate against the actual submission and a checked solution before release; do not treat plausible complexity commentary as correct merely because other feedback is useful.

## SIG24-03 — Audit assistant answers separately from student satisfaction

**Liu, Zenke, Liu, Holmes, Thornton, & Malan (2024). Teaching CS50 with AI: Leveraging Generative Artificial Intelligence in Computer Science Education. SIGCSE TS 2024.** [DOI](https://doi.org/10.1145/3626252.3630938); [author PDF](https://cs.harvard.edu/malan/publications/V1fp0567-liu.pdf).

- **Access/design:** full author implementation/results inspected, PDF pp. 2–6. Course-specific explanation, style, and chatbot tools: approximately 70 summer students, then online and roughly 500 campus students. Deployment report with nonanonymous surveys, not randomized learning evaluation.
- **Outcome:** a senior staff member separate from development reviewed **64 summer forum answers**: 22/25 curricular answers and 30/39 administrative answers were correct. Student feedback was favorable; neither survey approval nor answer accuracy measures independent learning.
- **Limits/inference:** C for deployment and audit design. Small answer denominators, one course, nonanonymous surveys, evolving tools. Distinguish course size, survey responses, and reviewed answers. Unendorsed autumn answers were not necessarily wrong. The aspirational 1:1 teaching ratio is not evidence of equivalence to a human tutor.

## SIG24-04 — Do not replace prerequisite instruction with an interactive tool

**Poulsen, Gertner, Chen, Cosman, West, & Herman (2024). Disentangling the Learning Gains from Reading a Book Chapter and Completing Proof Blocks Problems. SIGCSE TS 2024.** [DOI](https://doi.org/10.1145/3626252.3630831); [official abstract](https://sigcse2024.sigcse.org/details/sigcse-ts-2024-Papers-1/14/Disentangling-the-Learning-Gains-from-Reading-a-Book-Chapter-and-Completing-Proof-Blo).

- **Access/design:** official abstract and institutional publication record inspected; ACM full text returned 403. Three-group randomized trial comparing chapter reading, Proof Blocks practice, and their combination. **Sample size, exact assessment timing, effect sizes, allocation, and attrition were unavailable.**
- **Outcome:** authors report the smallest gains from Proof Blocks alone; reading plus practice was marginally better than reading alone, with added-example exposure an unresolved explanation.
- **Limits/inference:** C pending full-method appraisal. This is non-AI evidence about this proof-learning sequence, not evidence against active learning generally. It supports checking prerequisite knowledge before substituting tool-mediated practice for explanatory instruction; it does not establish that passive reading is universally superior or that AI-generated puzzles reproduce these results.

## Original implementation moves — design proposals, not tested intervention packages

These moves translate the evidence into instructor actions. Their complete sequences and timings are **original adaptations**. Evaluate them locally; do not attribute the package, a named framework, or an expected learning effect to the papers.

1. **Repair a debugging lab (SIG24-01).** Input: a faulty program, observed error, target concept. Deliver: verified hint, learner's predicted cause, smallest repair, and a fresh unaided error task next class. Record immediate repair attempts separately from later diagnosis accuracy. Escalate to a human when the hint conflicts with execution.
2. **Prepare formative feedback (SIG24-02).** Input: submission, task, rubric, checked solution. Deliver a short evidence table: student's idea, verified issue, next action, guiding question. Check correctness before syntax/style refinements. Require a revision note identifying which feedback was used and a test showing its consequence.
3. **Evaluate a course assistant (SIG24-03).** Build a small held-out set of concept, code, administrative, and ambiguous questions from current course materials. Report correct/checked counts by category; preserve source dates. Route unresolved policy questions to staff. Pair satisfaction feedback with an independent student task before claiming learning value.
4. **Improve a proof or algorithm worksheet (SIG24-04).** Diagnose the missing prerequisite, add one worked explanation, then a partially completed example and an independent variant. Match examples and time when comparing revisions. Record rationale accuracy, not just successful reordering; provide an accessible text alternative to drag-and-drop interaction.

## Search and access log

All actions below occurred on **2026-09-05**. Discovery results were screened for venue and task relevance; study claims above rely on primary papers or official author/venue records. Only the two named author PDFs were inspected in full-text form; the other two appraisals are explicitly abstract-limited. The project PDFs were already covered by the parent update and were not re-read for this focused conference supplement.

| Service | Actual query/action | Coverage or access note |
|---|---|---|
| Sider Scholar / OpenAlex | `SIGCSE 2024 generative AI code explanations feedback`; dates 2023-01-01 through 2024-12-31; 25 results | Broad discovery; substantial cross-venue material. Venue names checked independently. |
| Sider Scholar / OpenAlex | `Disentangling Learning Gains Reading Book Chapter Completing Proof Blocks Problems`; 25 results | Target paper found; suggested PDF was ACM, which did not yield full text. Most other hits were irrelevant. |
| Web engine 2 | `site.sigcse2024.sigcse.org ChatGPT explanations feedback`; `SIGCSE 2024 Generative AI code explanations students study`; `SIGCSE 2024 worked examples Parsons study learning` | Official program pages supplied primary abstracts and DOIs. |
| Web engine 1 | `"A Large Scale RCT on Effective Error Messages in CS1" pdf`; `"Using GPT-4 to Provide Tiered" pdf`; `"Disentangling the Learning Gains" pdf` | Author RCT PDF found. Engine reported rewriting a query; noisy results are not a recall measure. |
| Web engine 2 | `"Disentangling the Learning Gains" Poulsen pdf`; `"Using GPT-4 to Provide Tiered" Nguyen Allan pdf`; `"Teaching CS50 with AI" Harvard pdf` | Harvard full PDF found; feedback author record verified but linked to inaccessible ACM PDF. |
| Web engine 2 | `"Disentangling" "Proof" site:sethpoulsen.org`; `Seth Poulsen Disentangling 2024 publication`; `"3626252.3630831" pdf` | First query empty; subsequent queries found official/institutional metadata, not an accessible full text. |
| Primary access | Wang author camera-ready PDF; Harvard CS50 author PDF; official SIGCSE pages; Ha Nguyen and Hongxuan Chen author publication pages; Illinois Experts metadata | Two full-text appraisals, two abstract-level appraisals. ACM PDF attempts for feedback and Proof Blocks failed; no full-method claims inferred from those failures. |

No contemporary model ranking, comprehensive proceedings coverage, or independently demonstrated transfer of these interventions to all classrooms is claimed.
