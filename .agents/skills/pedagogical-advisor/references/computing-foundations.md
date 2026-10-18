# Computing education foundations for the AI update

Selected primary/research-synthesis sources checked 2026-09-05. These sources predate general-purpose GenAI; their application to AI-assisted instruction is design inference. Pair them with `references/cs-ai-evidence-2026.md`.

## CS-F01 — Subgoal-labeled worked examples

Margulieux, Morrison, and Decker (2020), *Reducing withdrawal and failure rates in introductory programming with subgoal labeled worked examples*, International Journal of STEM Education 7, 19. [Full article](https://doi.org/10.1186/s40594-020-00222-7).

**Access/design:** Main abstract, research context/design, and results inspected on publisher full text. Semester-long quasi-experiment across CS1 sections, 265 students; subgoal instruction versus typical instruction with common curriculum and assessments.

**Finding:** Better formative quiz performance, fewer withdrawals/failures, but no significant average summative-exam advantage. Evidence B for bounded CS1 implementation; do not turn early performance into a general retention claim. Nonrandom section assignment and single setting limit causal interpretation.

**Use:** Make the purpose of code steps visible; check whether learners can select and explain a subgoal on a new problem. Exact scaffolding/fading and AI adaptations require local evaluation.

## CS-F02 — PRIMM

Sentance, Waite, and Kallia (2019), *Teaching computer programming with PRIMM: a sociocultural perspective*, Computer Science Education 29(2–3), 136–176. [DOI](https://doi.org/10.1080/08993408.2019.1608781); [author-hosted full paper](https://primmportal.com/wp-content/uploads/2020/10/teaching-computer-programming-with-primm-a-sociocultural-perspective.pdf).

**Access/design:** Abstract, methods and results inspected; PDF pp. 17–24. Non-equivalent classroom comparison in 13 schools; 493 pupils in intervention, 180 controls recruited (ages 11–14); not all classes entered quantitative analysis. PRIMM means Predict, Run, Investigate, Modify, Make.

**Finding:** Posttest advantage and positive teacher reports. Evidence B/conditional for this school implementation; undergraduate/AI use is extrapolation. No random assignment; control groups existed in only some schools. The paper's interpretation of r=.13 as 13% variance is incorrect; do not propagate that statement or infer causality from it.

**Use:** Develop comprehension before independent construction; adapt stages to the target and expertise. Do not conflate this learning-outcome study with the related SIGCSE teacher-experience report.

## CS-F03 — Parsons problems

Ericson et al. (2022), *Parsons Problems and Beyond: Systematic Literature Review and Empirical Study Designs*, ITiCSE Working Group Reports, 191–234. [DOI](https://doi.org/10.1145/3571785.3574127); [author working-group site](https://iticse22-parsons-problems.github.io/); [author-institution record](https://research.aalto.fi/en/publications/parsons-problems-and-beyond-systematic-literature-review-and-empi/).

**Access/design:** Author working-group overview and institutional abstract/metadata inspected; full review methods/results not appraised in this update. Review of reorder-code problems and study-design questions, not one uniform intervention.

**Inference:** Use as an entry point for evidence and design variants; no pooled effect or universal superiority asserted. Choosing Parsons support for a novice who is blocked by syntax is a design hypothesis that must be followed by actual writing/modification evidence. Puzzle completion alone does not establish independent programming.

## Original instructional application

For a loop-accumulation task, show a short correct example with purpose labels, ask learners to predict a trace, then remove one decision and have them complete it. If syntax prevents progress, offer reorderable lines. Finish with an independently written change that alters a boundary condition. The instructor verifies both the code and oracle. The combined sequence and its AI-assistance rules are original design synthesis, not a package tested in these three sources.

## Search log

2026-09-05, web engine 2: PRIMM evaluation programming teaching 2019 Sentance Waite Kallia study 493 pupils; Parsons problems systematic review computing education 2022 Ericson primary; subgoal labeled worked examples introductory programming semester study Margulieux Morrison Decker 2020. Opened publisher/author documents and inspected methods/results where available. Engine 1 with a one-year recency filter also searched SIGCSE 2026 and ICER 2026 AI-learning material; official venue pages informed the wider update, but conference programs alone supplied no efficacy claims.
