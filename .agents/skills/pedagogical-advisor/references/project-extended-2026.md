# Project-source extension: verified editions and actionable use (2026-09-05)

## Contents

- Scope and evidence discipline
- P09 — Cognitive Load Theory
- P10 — Handbook of Competence and Motivation
- P11 — In Search of Understanding
- P12 — Generative AI in Computer Science Education
- P13 — Educational Psychology
- P14 — What the Best College Teachers Do
- P15 — The Cambridge Handbook of the Learning Sciences
- P16 — The Mind within the Net
- Cross-source decisions that should change the agent's output

Read this file when designing examples, scaffolding, feedback, motivation supports, assessment, teacher development, or AI-supported CS teaching. It extends `project-corpus-synthesis.md` with edition-specific provenance and operational decisions for project sources 09–16.

## Scope and evidence discipline

- The eight supplied PDFs were extracted to text. Identity/front matter, contents, and selected relevant passages were inspected; this is **targeted inspection, not a claim of cover-to-cover reading**. Search hits and extracted but unread pages do not count as inspected evidence.
- All page references below are **1-based PDF page numbers in the supplied attachment**. Printed pagination differs. In particular, the Spitzer attachment is a concatenation of chapter PDFs and has changing offsets; never infer a page location from one global offset.
- The procedures below are the skill author's design adaptations unless explicitly identified as a procedure in the source. A book's description of a technique is not proof that the complete adapted workflow improves learning.
- Distinguish experimental/review evidence, textbook synthesis, qualitative design insight, case-study feasibility, and historical computational analogy. For a precise effect, a current capability claim, or a consequential local change, inspect the underlying primary research and its comparator, population, outcome, and limitations.
- Do not copy lengthy excerpts, republish the PDFs, convert outdated examples into present-day rules, or treat all project sources as equally authoritative.

## P09 — Cognitive Load Theory

**Verified identity:** Jan L. Plass, Roxana Moreno, and Roland Brünken (editors), *Cognitive Load Theory*, Cambridge University Press, 2010. Title/editor page: PDF 5; copyright/publication: PDF 6; contents: PDF 7–8. Attachment: `09-Cognitive-Load-Theory-staibabussalamsula.ac_.id_.pdf` (287 PDF pages).

**Inspection:** front matter; introduction PDF 15–17; selected passages from Renkl and Atkinson, “Learning from Worked-Out Examples and Problem Solving,” PDF 103–104, 106, 110, 114–116; Mayer and Moreno's multimedia chapter, PDF 143, 146, 149–151, 153, 155. This is a research handbook reflecting the evidence and terminology of its publication period.

| Decision trigger | Actionable design move | Evidence/limit |
|---|---|---|
| Novices can follow a demonstration but cannot solve the next problem | Prepare two complementary worked examples. At decisive steps ask the learner to name the principle and explain why it applies. Follow with a completion problem and then an independent problem. | Examples, self-explanation, and fading: PDF 103–104, 106, 110, 114. Success copying a procedure is weaker evidence than successful explanation and application. Do not assume that every type of worked example or live-coding demonstration has the same effect. |
| A class contains very different prior knowledge | Diagnose the relevant subskill with a short next-step task; offer a worked step for the learner who needs it and an independent challenge for the learner who can already explain it. Recheck and fade supports by component. | Expertise reversal and adaptation: PDF 106, 116. The adaptation depends on observed task performance, not a fixed “weak/strong student” label or assumed general intelligence. |
| A diagram, slide, video, or AI explanation is difficult to follow | Remove irrelevant decoration; place labels near referents; synchronize explanation with the relevant visual event; add headings/cues; divide a complex explanation into controllable segments. | Coherence, signaling, temporal contiguity, segmentation: PDF 149, 151, 153, 155. Preserve scientifically necessary complexity and test whether learners can use the explanation. “Shorter” is not automatically better. |
| Someone invokes multimedia redundancy to remove accessible text | Separate unnecessary duplicate prose from useful access support. Retain captions/transcripts, technical vocabulary, and learner control; simplify layout around them. | PDF 150–151 explicitly recognizes exceptions for hearing access, additional-language learners, and technical terms. Never treat a laboratory redundancy result as a reason to remove accommodation. |

**CS/AI translation:** Give the model a verified solution and ask it to draft (a) one conceptual explanation prompt, (b) a partially completed variant, and (c) a fresh transfer task. Check all three manually or by appropriate execution, then assess the student without the completed example visible. AI-generated explanations alone do not establish that students learned the strategy.

## P10 — Handbook of Competence and Motivation

**Verified identity:** Andrew J. Elliot, Carol S. Dweck, and David S. Yeager (editors), *Handbook of Competence and Motivation: Theory and Application*, second edition, Guilford Press, 2017. Title/edition: PDF 5; copyright: PDF 6; contents: PDF 13–16. Attachment: `10-Handbook-of-Competence-and-Motivation_-Theory-and-Application.pdf` (737 PDF pages).

**Inspection:** selected material from Wigfield, Rosenzweig, and Eccles, “Achievement Values” (PDF 138–143, 145–146); Ryan and Moller, self-determination theory (PDF 232, 234, 236–238); Walton and Brady, “The Many Questions of Belonging” (PDF 288, 300). This is a multi-author theoretical and research synthesis; it is not one intervention study.

| Decision trigger | Actionable design move | Evidence/limit |
|---|---|---|
| Students avoid a task the instructor considers valuable | Diagnose separately: expected success, personal value, effort/time costs, competing commitments, financial/tool access, and exposure to embarrassment. Address the observed barrier with one concrete change and monitor uptake. | Cost dimensions: PDF 138–140; motivational distinctions: PDF 234, 236. Avoid diagnosing a student's psychology from silence or lateness. Cost associations are not, by themselves, causal intervention estimates. |
| Students ask “Why learn this if AI does it?” | After a concrete task, invite a brief connection to a goal, interest, community, or situation the student chooses. Offer examples if needed, then have students generate their own connection. Pair relevance with a manageable success experience. | Utility-value interventions and moderators: PDF 141–143, 145. Merely telling low-confidence students that a skill is crucial can backfire in some studies. The AI framing is a reasoned adaptation, not a tested treatment in this 2017 book. |
| An assignment permits either no agency or unlimited choice | Offer a bounded choice of topic/data/context while keeping the learning target, quality criteria, and accessible resources clear. Give informational feedback on the work and the next attainable challenge. | Autonomy as ownership rather than absence of structure, plus competence support: PDF 232, 234, 237–238. Choice overload and missing prerequisite knowledge can undermine the intended support. |
| Participation or help-seeking is uneven | Inspect the actual cues in the setting: whose examples count, whether questions receive respectful responses, how group roles are allocated, and whether help is realistically available. Remove concrete exclusion before relying on reassurance. | Belonging as an inference about self and setting: PDF 288; examples of targeted interventions: PDF 300. Do not guarantee that a brief belonging/mindset message closes an achievement gap; effects depend on population, context, timing, and a supportive environment. |

**Useful output:** a motivation diagnosis table containing the observed behavior, two competing explanations, a low-burden way to distinguish them, a targeted design change, and a follow-up indicator. Report uncertainty and avoid clinical or personality labels.

## P11 — In Search of Understanding

**Verified identity:** Jacqueline Grennon Brooks and Martin G. Brooks, *In Search of Understanding: The Case for Constructivist Classrooms*, with a new introduction, ASCD, 1999; copyright 1993 and 1999. Title: PDF 2; edition/copyright: PDF 3; contents: PDF 4. Attachment: `11-In-Search-of-Understanding-The-Case-for-Constructivist-Classrooms.pdf` (143 PDF pages).

**Inspection:** selected passages on students' perspectives (PDF 72–75), assessment in teaching (PDF 97–98, 101), and teacher practice (PDF 113–114). Treat classroom narratives as design insight, not controlled causal estimates.

| Decision trigger | Actionable design move | Evidence/limit |
|---|---|---|
| Students can give the correct answer but their reasoning is unknown | Request a prediction plus explanation before the reveal. Ask for reasoning after both correct and incorrect responses, so a follow-up question does not signal “you are wrong.” | PDF 72–74. A prediction is a brief diagnostic move, not a requirement to withhold all explanation until students discover a principle. |
| A student says “I don't know” during office hours | Ask what they tried, identify one usable element, and offer the smallest specific cue that allows a new attempt. Observe the response before making a stronger inference about ability or effort. | The supported strategy changes in the case on PDF 97–98. One narrative cannot establish that low self-esteem causes a particular student's difficulty. |
| Feedback consists of judgments with no path forward | Describe the work, identify the decision or claim that needs evidence, and ask for a revision that resolves it. Example: “Your requirement names speed; specify the workload and response-time threshold, then show how you would check it.” | Nonjudgmental description and questioning: PDF 101. Be explicit about an actual error or unmet criterion when needed; neutrality must not become evasiveness. |
| Discussion reproduces the instructor's view immediately | Collect an initial individual interpretation, compare alternative explanations, then supply evidence, modeling, or a counterexample and ask students to revise. | Eliciting understanding and dialogue: PDF 113–114. The short individual phase protects diagnostic evidence; the complete sequence is an adaptation. Constructivism does not imply minimally guided instruction for novices. |

**Source cautions:** The book contains broad claims favoring inquiry and examples of student-designed experiments. Do not adopt every example as sound experimental design, infer that multiple-choice questions cannot probe understanding, or remove disciplinary correctness from assessment.

## P12 — Generative AI in Computer Science Education

**Verified identity:** Diana Franklin, Paul Denny, David A. Gonzalez-Maldonado, and Minh Tran, *Generative AI in Computer Science Education: Challenges and Opportunities*, Cambridge Elements in Generative AI in Education, first published online April 2025. Title/authors: PDF 3; copyright and DOI: PDF 4; date: PDF 5; contents: PDF 6. DOI: https://doi.org/10.1017/9781009581738. Attachment: `12-Generative-AI-in-Computer-Science-Education.pdf` (82 PDF pages).

**Inspection:** selected source discussions and procedures at PDF 21–22, 31–33, 35–36, 40–41, 47–48, 51–52, 56–64. This is a short research-informed synthesis with heterogeneous underlying studies. “Helpful,” “engaging,” successful task completion, and a favorable course survey are not interchangeable with delayed independent learning.

| Decision trigger | Actionable design move | Evidence/limit |
|---|---|---|
| An instructor needs more practice problems or context variants | Fix the concept, required operations, constraints, scaffolds, solution, rubric, and target difficulty. Generate variants; solve each, inspect edge cases and language demands, then pilot before high-stakes use. | The distinction between validated hand-coded equivalents and proposed GenAI expansion is explicit at PDF 31–32. Do not label generated tasks psychometrically equivalent because they share a template. |
| A course permits AI but students do not know what they must learn | For every outcome state what students should do independently, with learning support, and with professional AI assistance. Include an independent sample of foundations plus an assisted authentic task. | CS1-LLM principles and confusion: PDF 60–61; assessment design: PDF 62–63. This is feasible course design from a case study, not proof that its exact allocation is optimal for all CS1 courses. |
| Students can generate running code but cannot account for it | Ask for a behavioral specification, a prediction on a boundary input, a high-level explanation, and a modification justified against tests. Use prompt-to-code or explanation-to-code exercises as formative practice; independently sample comprehension. | Prompt Problems/EiPE: PDF 57–59; decomposition and explanation evidence: PDF 62–63. Passing generated-code tests does not alone validate the learner's explanation: the model may fill gaps, and the test set may be incomplete. |
| AI is being used as a tutor or feedback assistant | Ground it in the actual task, rubric, and verified materials; request one prioritized diagnosis/cue at a time, a learner response, then adaptation. Review a sample for correctness, overwhelming detail, answer leakage, and alignment. | Virtual TA limitations and oversight: PDF 35; test-generation/feedback tradeoffs: PDF 36; misuse/illusion of competence: PDF 52. The complete bounded-help protocol is an adaptation and requires local learning evaluation. |

**Additional operational constraints:** The course case used decomposition diagrams and a short function explanation video, with reported grading of roughly 10–15 minutes per project (PDF 62–63). Treat this as a workload example, not a promised throughput. Offer an equivalent accessible explanation format when video is not part of the construct. Process evidence should be proportionate: PDF 51 notes privacy/stress concerns with surveillance. Neither an AI detector nor a paste event establishes misconduct. Update before making present-day claims about a model, tool, or detector.

**Useful extensions for this user's course:** requirements clarification, behavioral specification, architectural tradeoffs, testing oracles, code review, debugging, and controlled change are suitable candidate capabilities. Their prioritization for a generative-AI software engineering course is a curriculum judgment to be linked to current disciplinary evidence and course prerequisites, not attributed wholesale to this source.

## P13 — Educational Psychology

**Verified identity:** Anita Woolfolk, *Educational Psychology*, thirteenth edition, Global Edition, Pearson, 2016. Title/edition: PDF 1 and 3; copyright: PDF 4. Attachment: `13-Educational-Psychology-by-Anita-Woolfolk.pdf` (722 PDF pages).

**Inspection:** title/contents (PDF 1, 3–4, 15–17, 22, 26–27); selected assessment chapter material (PDF 596–598, 600–601, 604–606, 610–613). It is a textbook synthesis with many K–12 and edition-specific policy examples.

| Decision trigger | Actionable design move | Evidence/limit |
|---|---|---|
| An exam is being written or reviewed | Start with the intended inference and match item format to the capability. Use cases/application choices for breadth where suitable; use production or performance when production or performance is the target. Check ambiguity, irrelevant reading load, timing, and scoring. | PDF 601, 604–606. Multiple choice can assess application and analysis, but recognizing a correct design is not the same as producing and defending one. |
| A rubric uses “excellent/good/poor” without guidance | Replace labels with observable distinctions on worthwhile skills. Score contrasting examples, identify disagreements, refine descriptors, and have students practice using the same criteria before revision. | Skill-focused rubric construction: PDF 610–612. Do not overfit descriptors to superficial requirements of one assignment. |
| Grades appear precise but judgments are unstable | Treat a score as a sample of performance. Inspect task coverage, rater disagreement, ambiguous criteria, and conditions of performance before interpreting small score differences or making a placement decision. | Measurement error: PDF 601; performance-assessment limits: PDF 612–613. Do not invent confidence intervals or reliability coefficients without appropriate data/design. A rubric alone does not establish validity. |
| A polished portfolio or AI-assisted product dominates assessment | Require a small, purposeful selection of work with a rationale, evidence of revision, and a linked demonstration of the target competence. Check whether access to tools, time, or external help affects appearance more than learning. | Portfolio/self-reflection guidance: PDF 610; bias and generalization: PDF 613. Add another task when the intended claim extends beyond a single artifact. |

**Do not import uncritically:** PDF 612 includes historical oral-presentation examples scoring posture and eye contact. Such behaviors should not become generic quality requirements: assess communication of the intended content, respect disability and cultural variation, and require a behavior only when it is defensibly part of the learning target. Nor should the text's historical standardized-testing policies or numerical reliability conventions become universal rules.

## P14 — What the Best College Teachers Do

**Verified identity:** Ken Bain, *What the Best College Teachers Do*, Harvard University Press, 2004. Title: PDF 4; copyright: PDF 5; contents: PDF 8. Attachment: `14-WhatTheBestCollegeTeachersDo.pdf` (218 PDF pages).

**Inspection:** selected planning passages (PDF 60–62), natural critical learning environment (PDF 111–116), and study-method appendix (PDF 192–193, 195). PDF 195 identifies 63 selected teachers, with predominantly qualitative evidence and differing depth of observation. This supports rich design hypotheses, not a population-average causal effect or a ranking of all teaching methods.

| Decision trigger | Actionable design move | Evidence/limit |
|---|---|---|
| A course outline is a list of topics | State one consequential question or capability, the reasoning students need, the prior conception likely to obstruct it, and the evidence that would show progress. Select content that serves those decisions. | Planning questions: PDF 60–62. The question must be learnable within the course and cannot substitute for concrete objectives and assessment. |
| A lesson is accurate but intellectually passive | Introduce a consequential decision, give students enough evidence to make a defensible attempt, require a choice with reasons, provide feedback, and allow another attempt. | Critical learning environment: PDF 111–114. Explanations and lectures can be part of this environment; provocative framing alone does not produce learning. |
| A case study is entertaining but not instructional | Make the disciplinary evidence and criteria essential to resolving the case. Return critiques that send learners back to an evidence gap, rather than rewarding a persuasive story alone. | Authentic investigative cases and revision: PDF 115–116. Rich simulations can be expensive; a short paper case can carry the same intended reasoning demand. |
| The instructor wants to evaluate teaching quality | Combine alignment/material review, observed classroom interaction, student work, and student experience. Ask what learners can now reason about and what evidence remains weak; revise one component. | Multi-source inquiry described at PDF 192–193, 195. Student satisfaction and reputation alone are not learning measures, and selection of exemplary teachers can introduce bias. |

**CS example:** “Should this service accept a retry after a timeout?” can organize work on requirements, idempotence, state, failure modes, and tests. Students specify a decision, examine traces, revise their design, and identify the next unresolved question. This example is authored for the skill, not from Bain.

## P15 — The Cambridge Handbook of the Learning Sciences

**Verified identity:** R. Keith Sawyer (editor), *The Cambridge Handbook of the Learning Sciences*, second edition, Cambridge University Press, 2014. Title/edition: PDF 5; copyright: PDF 6; contents: PDF 7–10. Attachment: `15-The-Cambridge-Handbook-of-the-Learning-Sciences-Autor-R.-Keith-Sawyer-.pdf` (802 PDF pages).

**Inspection:** selected passages from Reiser and Tabak, “Scaffolding” (PDF 70–74); Collins and Kapur, “Cognitive Apprenticeship” (PDF 135, 137–139); Pellegrino, assessment (PDF 259, 261–263, 269). Some surrounding bibliography pages were also checked. The handbook contains multiple theoretical traditions; a chapter's argument must not be relabeled as consensus of every contributor.

| Decision trigger | Actionable design move | Evidence/limit |
|---|---|---|
| An authentic project overwhelms novices | Identify what is making the task inaccessible: sensemaking, strategy/coordination, or articulation/reflection. Provide a scaffold for that bottleneck while preserving the target decision for the learner. Specify how and when support will fade. | Scaffolding mechanisms: PDF 71–74. A scaffold should enable learning as well as current performance. Automating the target reasoning can remove the learning opportunity. |
| Students see expert answers but not expert decisions | Model a bounded task with a concise public rationale, coach a learner attempt, ask learners to articulate the strategy, compare alternatives, and increase task variety and independence. | Cognitive apprenticeship: PDF 137–139. Model the reasons relevant to the learner; do not flood them with every expert detail or portray a polished AI narrative as a faithful record of how an expert actually reasoned. |
| A new assessment has an attractive format but uncertain meaning | Write three linked statements: the competence model, the response/behavior the task will elicit, and how that observation supports the intended inference. Look for alternative explanations of success and add evidence only where needed. | Assessment triangle: PDF 261–263. AI assistance changes what a successful product can establish about the learner; update the inference accordingly. |
| One test is expected to diagnose errors, certify mastery, and evaluate a program | State the primary purpose and select the necessary grain of evidence. Use short diagnostic probes for instruction and broader, defensible task sampling for summative claims; align their competence definitions. | Purposes/proximity: PDF 259, 261, 269. A broad standardized score is usually too coarse for a precise next teaching move; a scaffolded classroom task may be insufficient for a broad independent-competence claim. |

**Reusable assessment prompt:** “What must the learner know or be able to do? What would we observe if they did? What else could produce that observation? What is the smallest additional task that would distinguish those explanations?” The wording is an adaptation of the framework, not a quotation.

## P16 — The Mind within the Net

**Identity and file limits:** Manfred Spitzer, *The Mind within the Net: Models of Learning, Thinking, and Acting*, MIT Press (original 1999; publisher's paperback edition dated 2000). Attachment: `16-The-Mind-within-the-Net.pdf` (346 PDF pages). The attachment **does not include title or copyright front matter**: PDF 1 begins Chapter 1, “Introduction.” MIT Press chapter-download footers contain electronic ISBN `9780262284165`; chapter sequence and bibliographic records corroborate the identity. Therefore do not claim that the original publication year was read on a title page in this PDF.

**External identity checks (2026-09-05):** publisher title/author/description and paperback date: https://mitpress.mit.edu/9780262692366/the-mind-within-the-net/ ; electronic ISBN and 1999 bibliographic record: https://search.worldcat.org/fr/title/The-mind-within-the-net-%3A-models-of-learning-thinking-and-acting/oclc/42331028 . These checks identify the book; they do not validate its educational recommendations.

**Inspection:** PDF 1–5 and 15; selected passages on learning/model plausibility PDF 57–60, generalization PDF 127–130, model limitations PDF 290 and 292, and the author's educational extrapolations PDF 306–307; chapter-start scans across the attachment. This is a historical introduction to connectionist/computational models and clinical applications, **not a classroom intervention evidence source**.

| Decision trigger | Constructive use | Boundary |
|---|---|---|
| An explanation equates an LLM, a toy network, and a learner's brain | Use the book to introduce why a model selectively represents a phenomenon; list the intended mapping, omitted features, and evidence that would test the mapping. | Differences between computers and brains and model abstraction: PDF 15, 290, 292. Similar outputs do not establish identical learning processes. |
| Students learn AI or modeling and need to distinguish fit from generalization | Build an original small example comparing a model's fit on observed data with prediction on held-out examples. Ask what evidence would favor each explanation. | Generalization illustration: PDF 127–128. Its value here is teaching a modeling concept, not proving a classroom learning method from network behavior. |
| A proposed teaching technique is justified only with neurons, plasticity, or a computational analogy | Request a separate bridge: behavioral mechanism, instructional implementation, student outcome, and relevant human study. Until that bridge exists, label the classroom claim a hypothesis and select supported instructional methods. | Model limits: PDF 290–292; broad educational extrapolations: PDF 306–307. The bridge is an evidence safeguard developed for this skill. |

**Exclude from recommendations:** Do not import the book's old causal speculation about autism at PDF 129, developmental prescriptions, clinical advice, or simple claims about media producing violence at PDF 307 as current established facts. Its “examples instead of rules” prescription at PDF 306 does not justify removing explicit conceptual instruction. Use contemporary behavioral/educational evidence for a teaching decision. Do not cite a biological learning rate to set a revision interval, infer fixed learner capacity from neural-network size, or use this source to diagnose students.

## Cross-source decisions that should change the agent's output

1. **When the user asks for critique, provide a repair.** Identify the precise learning obstacle, produce revised wording/activity/item, and name the observation that would test whether the repair helped.
2. **When generating with AI, verify both the artifact and the learning inference.** Code running, a fluent explanation, or a polished presentation answers only part of the evaluation question.
3. **Adapt assistance to the target.** Keep the target reasoning with the learner, support irrelevant prerequisites as needed, and assess independence on an appropriate fresh task.
4. **Use measurement modestly.** No single artifact or rubric licenses a sweeping claim about a student. Interpret evidence at the granularity and under the conditions actually sampled.
5. **Treat motivation and access as properties of a situation to investigate.** Seek competing explanations and concrete environmental improvements before assigning dispositions to students.
6. **Preserve tensions instead of pretending the books agree on everything.** Explicit modeling and guided inquiry can coexist; authenticity and measurement quality both matter; accessibility and productive effort both matter. Make the instructional choice conditional on expertise, task, evidence, and resources.
