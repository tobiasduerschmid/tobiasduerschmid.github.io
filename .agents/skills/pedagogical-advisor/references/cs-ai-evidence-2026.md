# Computing education and generative AI: evidence update

## Contents

- Interpret the evidence before using it
- CS-AI-001
- CS-AI-002
- CS-AI-003
- CS-AI-004
- CS-AI-005
- CS-AI-006
- CS-AI-007
- CS-AI-008
- CS-AI-009
- CS-AI-010
- CS-AI-011
- CS-AI-012
- CS-AI-013
- CS-AI-014
- Search log and coverage limits

Searched and checked: **2026-09-05**. Scope: selected primary studies from 2023–2026 relevant to teaching programming, AI use, feedback, assessment, and material preparation. This is a targeted evidence update, not a systematic review or a claim to have read every SIGCSE, ITiCSE, ICER, or TOCE paper. The recipes in `knowledge/24_computing-education-and-ai.md` are design adaptations, not interventions all validated as complete packages.

For additional relevant earlier findings, read `references/sigcse-2024-evidence.md` (four new papers) and `references/sigcse-2025-evidence.md` (four new papers). The existing 2024 Prompt Problems card (CS-AI-005) and 2025 cards CS-AI-008–010 remain here and are counted once. The teaching-decision map in `knowledge/24_computing-education-and-ai.md` connects both supplements to concrete tasks.

## Interpret the evidence before using it

- Separate **assisted task performance**, **immediate unaided performance**, **delayed retention**, **transfer**, **calibration**, **student reports**, and **generated-material quality**. Improvements in one do not establish improvements in the others.
- Peer review is a publication property, not a guarantee of causal identification. A classroom deployment or qualitative study can explain use and failure modes without estimating learning effects.
- A nonsignificant difference does not establish equivalence or absence of harm. A significant correlation in one condition and a nonsignificant correlation in another do not themselves establish a difference between correlations.
- Keep model, interface, hints, time budget, learner expertise, and assessment conditions attached to a result. Do not transfer a 2023 model-specific effect size to a current assistant.
- Evidence grades below concern the **specific claim**: B = supported in a bounded setting; C = emerging or design-oriented; D = insufficient for the proposed learning-effect claim. No entry here warrants a universal “AI improves learning” claim.

## CS-AI-001

**Kazemitabaar et al. (2023). Studying the effect of AI Code Generators on Supporting Novice Learners in Introductory Programming. CHI 2023.** [DOI](https://doi.org/10.1145/3544548.3580919); [author version](https://arxiv.org/abs/2302.07427).

- **Design/access:** controlled study; 69 learners aged 10–17; Codex access versus no access during 45 Python authoring tasks, each followed by manual modification. Abstract and author publication inspected.
- **Outcome:** assisted authoring completion and scores improved. No significant overall advantage on later evaluation was established; a prior-knowledge interaction favored better-prepared learners on retention. The evaluation included a one-week interval.
- **Inference:** B for improved assisted authoring in this design; C for learning implications. Do not present the authoring score ratio as a learning gain or a nonsignificant posttest as proof that unrestricted AI cannot harm learning.
- **Limits/use:** children, short introductory tasks, older model, structured modification practice. Use as motivation to assess both assisted production and subsequent independent modification.

## CS-AI-002

**Liffiton, Sheese, Savelka, & Denny (2023). CodeHelp: Using Large Language Models with Guardrails for Scalable Support in Programming Classes. Koli Calling 2023.** [DOI](https://doi.org/10.1145/3631802.3631830); [author version](https://arxiv.org/abs/2308.06921); [authors' tool references](https://codehelp.app/).

- **Design/access:** 12-week deployment in a first-year computer/data science course of 52 students; logs, perceptions, instructor reflections. Author abstract inspected; venue verified through authors' publication list.
- **Outcome:** students valued availability and error help. The system tried to provide assistance without directly disclosing solutions.
- **Inference:** C for feasible help design; D for causal learning improvement. There was no randomized learning comparator reported in the inspected evidence.
- **Limits/use:** local deployment, self-selection, perceptions. Design a hint/escalation ladder and keep human help available; do not claim that merely withholding code ensures learning.

## CS-AI-003

**Kazemitabaar et al. (2024). CodeAid: Evaluating a Classroom Deployment of an LLM-based Programming Assistant that Balances Student and Educator Needs. CHI 2024.** [DOI](https://doi.org/10.1145/3613904.3642773); [full author text](https://arxiv.org/html/2401.11314v2).

- **Design/access:** semester deployment in a class with approximately 700 students; 22 student interviews and eight educator interviews. Full-text methods inspected. The 700 is class size, not an experimental sample randomly assigned to conditions. Of 8,132 logged uses, 7,003 remained after consent filtering; a filtered sample of 1,750 was thematically analyzed.
- **Outcome:** usability, help-seeking, response quality, and tradeoffs involving pseudocode, explanations, documentation, and student control.
- **Inference:** C for assistant design; D for causal learning gains. No controlled retention outcome was established.
- **Limits/use:** changing tool over the semester, survey/usage selection, one course. Provide course context, trustworthy documentation, and ways to question/correct help; audit actual responses, not only prompt instructions.

## CS-AI-004

**Prather et al. (2024). The Widening Gap: The Benefits and Harms of Generative AI for Novice Programmers. ICER 2024.** [DOI](https://doi.org/10.1145/3632620.3671116); [author abstract](https://arxiv.org/abs/2405.17739); [institutional publication record](https://research.aalto.fi/en/publications/the-widening-gap-the-benefits-and-harms-of-generative-ai-for-novi/).

- **Design/access:** 21 lab sessions using observation, interviews, and eye tracking; replication/extension of earlier novice problem-solving research. Primary abstract and venue record inspected.
- **Outcome:** 20 of 21 completed the problem, but successful completion coexisted with different planning, monitoring, and error-evaluation behavior. Some struggling students overestimated their competence.
- **Inference:** B for an observed failure-mode account; C for generalization; no causal estimate of population-wide widening inequality.
- **Limits/use:** small qualitative sample, one task, no randomized AI/no-AI learning comparison. Diagnose understanding with a new prediction, modification, or explanation; completion alone is weak evidence of student capability.

## CS-AI-005

**Denny et al. (2024). Prompt Problems: A New Programming Exercise for the Generative AI Era. SIGCSE TS 2024.** [DOI](https://doi.org/10.1145/3626252.3630909); [full author PDF](https://juholeinonen.com/assets/pdf/denny2024prompt.pdf).

- **Design/access:** experience report; optional participation by 58/414 CS1 students and 182/444 CS2 students who attempted at least one problem. Full PDF inspected, especially sections 4–6.
- **Outcome:** prompt attempts, generated-code test success, and student perceptions. Students translated a problem representation into a natural-language specification evaluated through generated code.
- **Inference:** C for a teachable activity design; D for claims that it improves durable computational thinking. No controlled learning comparison.
- **Limits/use:** strong self-selection and progression filters; success can exploit incomplete tests or model assumptions. Assess the student's specification and examples directly; supplement test-passing with counterexamples and an independent modification task.

## CS-AI-006

**Hou, Wu, Wang, & Ericson (2024). CodeTailor: LLM-Powered Personalized Parsons Puzzles for Engaging Support While Learning Programming. Learning @ Scale 2024.** [DOI](https://doi.org/10.1145/3657604.3662032); [full author text](https://arxiv.org/html/2401.12125v3).

- **Design/access:** within-subjects study, 18 novices; personalized Parsons help versus direct generated solution; immediate unsupported posttest. Full-text outcome definitions/results inspected.
- **Outcome:** higher self-reported engagement and a higher *scaffolding apply rate*, which measures reuse of elements a student initially needed help with. Overall posttest score did **not** significantly differ (p=.789); scaffolding apply rate differed (p=.041).
- **Inference:** C, promising support-specific reuse; not proof of superior total learning or delayed retention.
- **Limits/use:** small sample, constrained tasks, short exposure, specialized derived outcome. A personalized reorder task may be an alternative when syntax stalls a novice; follow it with a fresh independent problem and check the target concept, not only puzzle completion.

## CS-AI-007

**Kazemitabaar, Huang, Suh, Henley, & Grossman (2025). Exploring the Design Space of Cognitive Engagement Techniques with AI-Generated Code for Enhanced Learning. IUI 2025.** [DOI](https://doi.org/10.1145/3708359.3712104); [full prepublication text](https://arxiv.org/html/2410.08922v1); [authors' project](https://majeedkazemi.github.io/code-engagement-techniques/).

- **Design/access:** between-subjects study N=82; refined, counterbalanced within-subjects study N=42. Full author text sections 4–7 inspected; IUI publication verified. Compared engagement techniques and direct code/explanation; assessed immediate isomorphic tasks without AI.
- **Outcome:** neither study demonstrated significant overall posttest differences. Study 2 p=.150. Lead-and-Reveal showed a significant perceived/actual ability correlation; this is a promising calibration signal, **not** a demonstrated between-condition correlation difference. It took longer than baseline.
- **Inference:** C for process design/calibration; insufficient to claim superior learning. Avoid repeating abstract-level “most effective” wording as a learning-effect conclusion.
- **Limits/use:** algorithm-heavy tasks, brief exposure, no delayed retention; data-structures learners, not complete beginners. Try a short next-step-before-code scaffold and measure its learning benefit and time cost locally.

## CS-AI-008

**Hassan, Chen, Denny, & Zilles (2025). On Teaching Novices Computational Thinking by Utilizing Large Language Models Within Assessments. SIGCSE TS 2025.** [official conference abstract](https://sigcse2025.sigcse.org/details/sigcse-ts-2025-Papers/52/On-Teaching-Novices-Computational-Thinking-by-Utilizing-Large-Language-Models-Within-).

- **Design/access:** qualitative think-aloud study with 17 introductory students using a chatbot, execution tools, and a PythonTutor-style debugger for Explain-in-Plain-English questions. Official abstract inspected; full methods not retrieved in this update.
- **Outcome:** examples of useful strategy guidance and later independent reuse, alongside answer seeking, unapplied feedback, and prompting difficulty. Interviewer intervention sometimes resolved difficulties.
- **Inference:** C for actionable design hypotheses; not a controlled learning effect.
- **Limits/use:** interviewer support is part of the observed environment. Teach learners to predict, choose informative inputs, execute, and revise their explanation; don't assume an unattended chatbot produces the same outcomes.

## CS-AI-009

**Koutcheme et al. (2025). Evaluating Language Models for Generating and Judging Programming Feedback. SIGCSE TS 2025.** [DOI](https://doi.org/10.1145/3641554.3701791); [full author PDF](https://juholeinonen.com/assets/pdf/koutcheme2025evaluating.pdf); [accepted author version](https://arxiv.org/abs/2407.04873).

- **Design/access:** model-output evaluation on 57 Python programs with eight generators, yielding 456 feedback outputs; expert annotation and model-based judging. Full PDF methods inspected. These are outputs, not 456 student participants.
- **Outcome:** quality of feedback generation and automatic evaluation for specified models/benchmark; no learner intervention.
- **Inference:** B for bounded technical feasibility; D for learner gains, grading validity, or current model rankings.
- **Limits/use:** small benchmark and model/version dependence. Use execution and human rubric checks when validating feedback. An LLM judging another LLM's response is not an independent answer key or evidence that a student learned.

## CS-AI-010

**Kannam, Yang, Dharm, & Lin (2025). Code Interviews: Design and Evaluation of a More Authentic Assessment for Introductory Programming Assignments. SIGCSE TS 2025.** [DOI](https://doi.org/10.1145/3641554.3701806); [official abstract](https://sigcse2025.sigcse.org/details/sigcse-ts-2025-Papers/66/Code-Interviews-Design-and-Evaluation-of-a-More-Authentic-Assessment-for-Introductor); [author version](https://arxiv.org/abs/2410.01010).

- **Design/access:** action research/experience report; TA sections conducted interviews for five major weekly take-home assignments, varying question and grouping choices. Official abstract inspected; participant denominator not established here.
- **Outcome:** more discussion of work, peer-learning opportunities, mixed stress effects, scalability and displacement of TA guidance time.
- **Inference:** C for assessment design; not a demonstrated causal learning benefit or universal integrity solution.
- **Limits/use:** workload and accessibility matter. Pilot short explanation-and-change interviews with criteria shared in advance; preserve equivalent accommodation routes and separate feedback time from verification time.

## CS-AI-011

**Tran, Gao, Lombard, Yu, Jiang, & Yeh (2026). Pacing for Mastery: Optimizing LLM Interactions for Learning. SIGCSE TS 2026.** [DOI](https://doi.org/10.1145/3770762.3772501); [official conference abstract](https://sigcse2026.sigcse.org/details/sigcse-ts-2026-Papers/2/Pacing-for-Mastery-Optimizing-LLM-Interactions-for-Learning).

- **Design/access:** classroom comparison of Fast, Medium, and Slow assistants; **abstract-only** appraisal. N, allocation, attrition, exact testing conditions, effect sizes, and retention interval were unavailable. ACM full-text retrieval returned 403; OpenAlex lookup failed.
- **Outcome:** authors report learning advantages for slower Socratic interaction, particularly with less prior knowledge, and loss of initial fast-assistant gains on retention.
- **Inference:** C with incomplete appraisal. Report as authors' finding, not established general policy or an effect-size estimate. “Slow” is a pedagogical interaction design, not evidence to delay network responses artificially.
- **Limits/use:** cannot separate pacing from other design differences using the abstract. Promising reason to pilot scaffolding that elicits a learner response before the next hint; retrieve full methods before making consequential comparative claims.

## CS-AI-012

**Yu, Wu, Cha, Shah, & Lau (2026). Improving LLM-Generated Educational Content: A Case Study on Prototyping, Prompt Engineering, and Evaluating a Tool for Generating Programming Problems for Data Science. SIGCSE TS 2026.** [DOI](https://doi.org/10.1145/3770762.3772619); [full author PDF](https://lau.ucsd.edu/pubs/2026_contentgen_SIGCSE.pdf).

- **Design/access:** ContentGen case study; 91 course-derived test cases, three prompt versions, 297 generated question/answer pairs including revisions; six usability participants, three faculty and three TAs. Full PDF inspected, sections 5–7.
- **Outcome:** structured context/instructions improved correctness, contextual fit, and coherence; instructor usability. No student learning measurement.
- **Inference:** B for local material-generation improvement; C for portability.
- **Limits/use:** two courses, model/task specificity; main raters were assigned by prompt version, leaving potential rater/version confounding despite calibration. Provide a verified course summary and explicit allowed constructs; judge learning alignment separately from runnable code. Validate drafts before live use.

## CS-AI-013

**Fernandez et al. (2026). A 'watch your replay videos' Reflection Assignment on Comparing Programming without versus with Generative AI: Learning about Programming, Critical AI Use and Limitations, and Reflection. SIGCSE TS 2026.** [DOI](https://doi.org/10.1145/3770762.3772668); [official abstract](https://sigcse2026.sigcse.org/details/sigcse-ts-2026-Papers/151/A-watch-your-replay-videos-reflection-assignment-on-comparing-programming-without-v); [inspected 2025 author preprint](https://arxiv.org/html/2507.17226v1).

- **Design/access:** qualitative thematic analysis of reflections in an online software-engineering course; 39 enrolled, 36 active near term end. The inspected text contains differing denominators for submissions/demographics; a precise analysis N is not asserted here. Published venue verified; methods taken from preprint, not final-version reconciliation.
- **Outcome:** student-articulated insights/goals about planning, debugging, help seeking, and AI use. No randomized comparator, objective gain estimate, or verified long-term behavior change.
- **Inference:** C for structured reflection design. The named DEAL framework is adapted from Ash & Clayton; do not attribute its invention to this skill or paper.
- **Limits/use:** fixed no-AI-then-AI sequence and different project stages confound causal comparison. Use evidence-backed reflection as formative practice; a follow-up task is needed to check whether intentions become behavior.

## CS-AI-014

**Rahe & Maalej (2025). How Do Programming Students Use Generative AI? Proceedings of the ACM on Software Engineering / FSE 2025.** [DOI](https://doi.org/10.1145/3715762); [author version](https://arxiv.org/abs/2501.10091).

- **Design/access:** exploratory monitored exercise with 37 programming students; 23 chose to use ChatGPT. Author abstract and publication metadata inspected.
- **Outcome:** general-concept help and direct solution requests; observed repeated wrong-code/fix-request cycles. The task deliberately required comprehension beyond what the chatbot could solve directly.
- **Inference:** B for a documented use pattern in this setting; C for generalization. It is not a randomized estimate that AI causes learning loss.
- **Limits/use:** self-selection and deliberately difficult task. Teach a stop-and-diagnose rule when two fixes fail: reproduce the failure, state an expected result, inspect evidence, then decide what help to request.

## Search log and coverage limits

All searches below occurred on 2026-09-05. Search outputs were used for discovery; claims above were checked against author papers, official venue pages, or institutional author records.

| Service | Actual query/action | Result/limitation |
|---|---|---|
| Elicit | `What randomized or controlled studies from SIGCSE ITiCSE ICER ACM TOCE evaluate effects of LLM programming assistants on novice learning, unaided retention and overreliance?`; minYear 2023, maxYear 2026, maxResults 20 | Account returned `api_access_denied`: plan does not include API access. No Elicit results or synthesis were available. |
| Sider Scholar / OpenAlex | `CodeAid CodeHelp programming learning`; 25 results | Successful discovery; off-topic and review results screened informally. |
| Sider Scholar / OpenAlex | `SIGCSE generative AI learning`; dates 2025-01-01 to 2026-09-05; 25 results | Successful; limited venue precision and indexing coverage. |
| Sider Scholar / OpenAlex | `AI programming randomized learning Parsons`; dates 2023-01-01 to 2026-09-05; 25 results | Successful; considerable irrelevant retrieval, therefore not a recall estimate. |
| Sider Scholar / OpenAlex | DOI lookup `10.1145/3770762.3772501` | 404; official SIGCSE page and ACM DOI record used instead. |
| Web engine 2 | `CodeHelp controlled experiment learning novice programming SIGCSE 2024 2025`; `SIGCSE 2025 AI novices learning overreliance Prather Kazemitabaar`; `Prompt Problems programming education SIGCSE 2024 Denny` | Discovered venue records and primary author copies. |
| Web engine 1 | `CodeHelp Liffiton Sheese Savelka Denny 2024 learning programming`; `"Pacing for Mastery"`; `"The Widening Gap" novice programmers 2024 learning` | Verified venue and primary source coverage beyond engine 2. |
| Web engine 2 | Exact-title searches for Cognitive Engagement Techniques, Studying the effect of AI Code Generators, CodeTailor, How Do Programming Students Use Generative AI, Evaluating Language Models for Generating and Judging Programming Feedback | Retrieved primary PDFs/author versions; checked outcome measures before synthesis. |
| Web engine 2 | Exact-title/DOI searches for Pacing for Mastery, Improving LLM-Generated Educational Content, and watch your replay videos | Located three actual SIGCSE 2026 contributions; ContentGen full author PDF and replay preprint accessible; Pacing full text inaccessible. |

No pooled effect, systematic screening count, publication-bias correction, or exhaustive 2026 venue coverage is claimed. SciSpace research is handled in the broader package update; this file does not claim SciSpace retrieval. Current study coverage is strongest for SIGCSE/ICER and adjacent CHI, IUI, Koli Calling, Learning @ Scale, and FSE. More targeted TOCE/ITiCSE intervention and ICER 2026 screening remains a useful next update. Some search-index dates were inconsistent with document dates; the document or official venue date took precedence. Cite published DOI and identify the inspected author-version date when final full text was unavailable.
