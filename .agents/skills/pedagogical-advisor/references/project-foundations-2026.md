# Project foundations: verified passages and teaching decisions

## Contents

- PF01 — National Research Council, *How People Learn*
- PF02 — Stanislas Dehaene, *How We Learn*
- PF03 — Freeman et al., active learning in undergraduate STEM
- PF04 — Ambrose et al., *How Learning Works*
- PF05 — Brown, Roediger, and McDaniel, *Make It Stick*
- PF06 — John Hattie, *Visible Learning*
- PF07 — Barbara Gross Davis, *Tools for Teaching*
- PF08 — Dunlosky et al., effective learning techniques
- Cross-source rules for the advisor
- Ready-to-use consultation prompts

Updated 2026-09-05. Read this alongside `project-corpus-synthesis.md`; this document adds an auditable, passage-level layer for project attachments 01–08. It does not claim that these whole books were read. All eight PDFs were made searchable by text extraction; identity pages and the selected passages listed below were inspected. Extracted book text is not part of this skill.

**Locator convention:** PDF pages are **1-based pages in the supplied attachment**, including covers and front matter. Print pages are included only where visible in the inspected text. Do not silently substitute a different edition's pagination. The reflowed Dehaene ebook has no reliable print-page mapping. PF01–PF08 are local source identifiers, not independent studies. A book citing another project source does not create an additional replication.

**Use evidence at the right level.** NRC, Ambrose, Dehaene, and Brown et al. synthesize research; Davis is a practical handbook; Hattie aggregates meta-analyses; Freeman and Dunlosky provide research syntheses with explicit methods and outcomes. A recipe below is an **advisor-designed application** of a supported principle unless explicitly identified as an example in the source. Its exact timing, prompts, scoring, and AI adaptation have not thereby been experimentally validated. Prefer primary/current research for effect estimates, causal claims, or new AI implementations.

## PF01 — National Research Council, *How People Learn*

**Verified identity.** *How People Learn: Brain, Mind, Experience, and School*, expanded edition (2000), National Academy Press. Editors John D. Bransford, Ann L. Brown, and Rodney R. Cocking, with additional material edited by M. Suzanne Donovan, John D. Bransford, and James W. Pellegrino. Title and copyright: PDF pp. 2–3; ISBN 0-309-07036-8. The repeated 2004 download/copyright footer is not this edition's publication year.

**Inspected scope.** Identity and prefatory material; key findings and teaching implications, PDF pp. 25–30 (print pp. 14–19); selected transfer examples/discussion, PDF pp. 65–67, 71, 74 (print pp. 54–56, 60, 63); selected learning-environment and assessment passages, PDF pp. 144, 146, 150–151 (print pp. 133, 135, 139–140). The rest of the 385-page attachment was not substantively reviewed for this update.

| Teaching decision | How to act | Conditions and likely misuse |
|---|---|---|
| Diagnose the learner's model before explaining. | Ask for a prediction, a reason, and a confidence judgment. Sort explanations into plausible models; respond to the model that produced the answer. Recheck using a changed example. | A correct multiple-choice answer alone may conceal faulty reasoning; one counterexample may not replace a durable misconception. Basis: PDF pp. 25–27. |
| Teach the conditions for using knowledge. | Pair examples sharing a deep structure with a superficially similar nonexample. Require learners to identify the cue that determines whether the principle applies. | Do not equate completing a familiar exercise with transfer. Verify adequate initial learning before attributing a transfer failure to inability. Basis: PDF pp. 66–67, 71, 74. |
| Embed metacognition in a disciplinary action. | Model how a historian tests a source, a programmer localizes a fault, or a mathematician checks an assumption; then fade the prompts. | Generic exhortations to “think critically” do not supply the domain knowledge or conditional strategies needed. Basis: PDF pp. 27–30. |
| Make assessment feed the next learning attempt. | Elicit an observable explanation, use it to select feedback or reteaching, and require an aligned revision. | Activity completion is not evidence of understanding. Multiple-choice items can assess understanding when constructed for that claim; open responses are not automatically superior. Basis: PDF pp. 150–151. |

**Practice recipe: transfer clinic, 15 minutes.** Show a solved worked example, then two unfamiliar cases: one governed by the same principle and one sharing only its surface vocabulary. Students classify independently, justify their classifications, compare with a partner, and revise after an instructor explanation. End with a third individual case. For CS, contrast two caching proposals that differ in consistency requirements. Record whether the learner can name the requirement that makes a cached answer unsafe. This CS adaptation is a design inference, not a result tested in the NRC book.

**AI extension.** An AI assistant may generate candidate contrasts, but a competent instructor must verify which properties actually determine the answer. Keep the learner's initial classification and final independent transfer response visible. Broad “AI literacy” without domain knowledge is unlikely to substitute for the knowledge organization described here; that is an inference from learning/transfer principles, not an AI trial.

## PF02 — Stanislas Dehaene, *How We Learn*

**Verified identity.** *How We Learn: The New Science of Education and the Brain*, Stanislas Dehaene (2020). Cover visually inspected at PDF p. 1; author identity at PDF p. 7; publication metadata at PDF p. 655: first published in the US by Viking and in Great Britain by Allen Lane in 2020; based partly on *Apprendre!* (2018); ebook ISBN 978-0-241-36647-9. **This attachment is not Benedict Carey's similarly titled book.**

**Inspected scope.** Cover, contents, author and publication pages; four-pillar overview, PDF pp. 293–294; selected active-engagement/discovery discussion, PDF pp. 343, 351–354; error-feedback chapter opening and selected passages, PDF pp. 382, 398–401; transition to consolidation and chapter opening, PDF pp. 417–420. This is targeted inspection of a 655-page reflowed ebook, not a complete reading. No print-page numbers are asserted.

| Teaching decision | How to act | Conditions and likely misuse |
|---|---|---|
| Require the learner to do the target thinking. | Ask learners to commit to a prediction, explanation, or solution choice before observing the answer. Use the result to focus the next explanation. | Watching an engaging demonstration or an AI think aloud is not evidence that the learner performed the same cognitive work. Physical activity alone is not the criterion. Basis: PDF pp. 293–294, 351–353. |
| Supply guidance that matches prerequisite knowledge. | Give novices a model and checkpoints; introduce constrained exploration where they can interpret the result. | The book's criticism of discovery learning should not be expanded into a rejection of every inquiry/project method. Distinguish minimally guided discovery from scaffolded inquiry; inspect the relevant intervention evidence. Basis: PDF pp. 353–354, read as an argument with boundaries. |
| Make error feedback informative and emotionally usable. | Identify the exact mismatch, provide a repair cue, and allow another attempt. Separate information about the work from judgments about the person. | A score alone rarely identifies what to change. “Wrong” plus a solution dump can still omit the learner's mistaken assumption. Immediate detail is not always best when detecting one's own error is itself the target; see PF04. Basis: PDF pp. 398–401. |
| Plan for durable fluency across encounters. | Revisit essential operations across sessions and check whether learners can execute them accurately while solving a more complex task. | Neural explanations do not establish a classroom effect size. Do not turn the book's broad statements about overlearning into “more repetition is always best,” or use neuroscience to prescribe a universal study schedule. Basis: PDF pp. 293–294, 417–420; cross-check PF08 for scheduling evidence. |

**Practice recipe: diagnose before hinting.** The learner predicts a short program's output and explains one state change. If incorrect, ask them to trace the relevant variable on a second input; then provide a targeted hint or worked step if they remain stuck. Have them repair the first trace and solve a new trace without help. The AI tutor must distinguish its hypothesis about the misconception from an observed fact, and stop guessing when the student's work is insufficient to diagnose it.

**Temporal boundary.** The book's comparisons between human brains and “current machines” describe its writing period. They cannot support claims about 2026 model capabilities. Neither its neuroscience framing nor its reference to Freeman provides a separate causal demonstration that an AI tutor improves learning.

## PF03 — Freeman et al., active learning in undergraduate STEM

**Verified identity.** Scott Freeman, Sarah L. Eddy, Miles McDonough, Michelle K. Smith, Nnadozie Okoroafor, Hannah Jordt, and Mary Pat Wenderoth (2014), *Active learning increases student performance in science, engineering, and mathematics*. *PNAS* 111(23), 8410–8415. DOI: `10.1073/pnas.1319030111`. Identity, abstract and main estimates: PDF p. 1 (print p. 8410).

**Inspected scope.** Full abstract/main overview and discussion/methods/reference pages: PDF pp. 1, 4–6; selected results passages on PDF pp. 2–3. The six-page main paper was text-extracted; supporting information and individual constituent studies were not inspected.

**What the estimates actually describe.** The synthesis reports 225 studies: 158 examination/concept-inventory comparisons and 67 failure-rate comparisons. Mean examination effect was Hedges' g ≈ 0.47. The lecture-versus-active-learning failure **odds ratio** was 1.95; the reported **risk ratio** was approximately 1.5. Raw average failure rates were 33.8% versus 21.8%, a 12-percentage-point difference. These are distinct quantities, not interchangeable “percentage improvements.” The approximately six-point examination-score interpretation was illustrated using three introductory courses, not a guaranteed gain for a new course. See PDF pp. 1, 4–5 (print pp. 8410, 8413–8414).

| Teaching decision | How to act | Conditions and likely misuse |
|---|---|---|
| Replace selected exposition time with purposeful student reasoning. | Choose a difficult learning outcome; add an individual attempt, structured discussion or comparison, feedback, and a second attempt. | The included treatment family was very broad; merely placing students in groups does not implement a specified mechanism. This paper does not imply eliminating useful explanation. |
| Match the evaluation to the learning claim. | For conceptual change, include items that expose conceptual errors; for procedural performance, sample relevant problems. Retain equivalent assessment standards when comparing course versions. | A satisfaction rating or a harder/easier new exam cannot establish the effect reported here. Concept-inventory effects and instructor-written exam effects differed. |
| Start with a feasible implementation and measure it. | Record task quality, student participation, actual time spent, and an independent learning measure. Improve the activity based on observed responses. | The authors could not estimate an optimal activity type or dose. Their data do not justify a mandatory percent of active class time, an exact cycle length, or assuming that more activity is always better. |

**Practice recipe: lecture repair.** Select one explanation that students traditionally hear but fail to use. Replace six to eight minutes with a two-option decision problem, individual written justification, comparison of conflicting justifications, an instructor synthesis, and a new individual decision. The duration is a feasible design choice, not a meta-analytic finding. In CS requirements engineering, compare two acceptance criteria and ask which allows a testable pass/fail decision and why.

**Research boundary.** Eligible studies were completed/published before January 1, 2010 (PDF p. 5). The failure dataset lacked randomized designs (PDF p. 4). Quasirandom clustering was adjusted using an assumed ICC drawn from K–12 mathematics because included studies did not report it (PDF p. 5). The synthesis supports a strong practical preference for structured active learning in undergraduate STEM, while leaving substantial uncertainty about which implementation is best for a particular topic and group.

## PF04 — Ambrose et al., *How Learning Works*

**Verified identity.** Susan A. Ambrose, Michael W. Bridges, Michele DiPietro, Marsha C. Lovett, and Marie K. Norman (2010), *How Learning Works: Seven Research-Based Principles for Smart Teaching*, first edition, Jossey-Bass. Title/copyright: PDF pp. 5–6; ISBN 978-0-470-48410-4.

**Inspected scope.** Front matter; selected prior-knowledge discussion, PDF pp. 49–52 (print pp. 23–26); mastery/component-skill discussion, PDF pp. 119–121, 137–140 (print pp. 93–95, 111–114); feedback discussion, PDF pp. 167–170 (print pp. 141–144); exam-wrapper appendix, PDF pp. 277–280 (print pp. 251–254). Remaining portions of the 328-page book were not substantively reviewed here.

| Teaching decision | How to act | Conditions and likely misuse |
|---|---|---|
| Diagnose missing components, failed integration, and failed transfer separately. | Decompose the target performance; give one component probe, one integrated task, and one changed-context task. Choose scaffolding based on the failure pattern. | More practice of isolated components will not necessarily fix coordinating them. Expert instructors can omit steps novices need. Basis: PDF pp. 119–121, 138–140. |
| Make feedback a contract for the next attempt. | Select one or two consequential issues, link each to a criterion, and reserve a revision or similar task on which the student can use it. | Exhaustive comments can overwhelm; feedback about one genre may not transfer automatically to a different genre. Basis: PDF pp. 167–170. |
| Time hints according to what the learner should learn. | If self-debugging is a goal, first let learners inspect and attempt a repair; intervene after persistent non-detection or unsuccessful repair. | Always-immediate correction can remove the opportunity to learn error detection. The cited spreadsheet study supports this conditional point, not unrestricted delay of all feedback. Basis: PDF p. 169 (print p. 143), discussing Mathan & Koedinger (2005). |
| Close the reflection loop before the next assessment. | After an exam, have students categorize an actual error and choose a concrete strategy change. Return the reflection before the next exam and inspect whether they used the strategy. | An exam wrapper is a practical design tool; this appendix does not alone establish a universal causal effect. Avoid grading personal disclosure or treating self-report as proof of strategy use. Basis: PDF pp. 277–280. |

**Practice recipe: assignment bottleneck repair.** A student's architecture report names patterns correctly but cannot justify a design. Probe separately: recognize a quality attribute, compare two patterns under that constraint, and defend the selection in a changed scenario. Model only the missing step, then require a complete revised argument. Feedback: “Your choice addresses availability; the stated latency constraint remains untested. Add a measurement or bound, then reconsider the choice.” Verify that this criterion is appropriate to the supplied task before using it.

**AI extension.** Turn off automatic full-solution correction where independent diagnosis is the learning outcome. Use a hint ladder with a visible escalation rule, followed by a new task without hints. This is a pedagogical inference from feedback-timing research; it is not direct evidence about a particular LLM tutor.

## PF05 — Brown, Roediger, and McDaniel, *Make It Stick*

**Verified identity.** Peter C. Brown, Henry L. Roediger III, and Mark A. McDaniel (2014), *Make It Stick: The Science of Successful Learning*, Belknap Press of Harvard University Press. Title/copyright: PDF pp. 4–5; ISBN 978-0-674-72901-8.

**Inspected scope.** Identity/contents; practical student guidance, PDF pp. 215–221, 225 (print pp. 200–206, 210); selected teacher guidance, PDF pp. 240–243 (print pp. 225–228). Remaining portions of the 328-page book were not substantively reviewed for this update. Treat the book as a research-informed translation with illustrative stories, not a meta-analysis.

| Teaching decision | How to act | Conditions and likely misuse |
|---|---|---|
| Replace recognition of an answer with producing it. | Require an actual written, spoken, sketched, or executed response before checking a solution. Correct errors and revisit them later. | Looking at a question and thinking “I know this” is not the same performance. A generated flashcard is not retrieval until the learner answers it. Basis: PDF pp. 216–218, 225. |
| Build a cumulative practice calendar. | Mix a few prior learning targets into later quizzes and homework; revisit mastered items after longer gaps. | The book's day/week/month suggestions are examples, not a validated universal spacing algorithm. Adapt to forgetting, task complexity, and the needed retention horizon. Basis: PDF pp. 218–220, 242. |
| Use interleaving to practice choosing a method. | Once learners can perform individual types with basic guidance, mix confusable problem types and ask why each method fits. | Randomly switching topics is not necessarily useful discrimination practice; do not remove all initial focused practice from novices. Basis: PDF pp. 220–221; cross-check PF08. |
| Calibrate confidence against delayed independent performance. | Before a quiz, collect a prediction; after the attempt, compare predicted with actual success and select the next study action. | Subjective struggle does not establish learning; enjoyable fluency does not establish durable mastery. Difficulty is desirable only when it promotes the target learning. Basis: PDF pp. 225, 240–243. |

**Practice recipe: weekly retrieval-and-repair packet.** Include two recent concepts, two older concepts, and one choice among confusable methods. Students answer before opening the key, mark confidence, correct one error with an explanation, and identify which item to revisit. Subsequent packets change context while sampling the same underlying learning targets. Counts are a workload-aware design example, not an evidence-derived prescription.

**AI extension.** Let AI generate candidate questions from verified course material and draft answer rationales. Review correctness, ambiguity, target alignment, and inadvertent clues before release. Require student-produced answers; AI-produced summaries or reflections do not demonstrate that the student retrieved or calibrated anything.

## PF06 — John Hattie, *Visible Learning*

**Verified identity.** John A. C. Hattie, *Visible Learning: A Synthesis of Over 800 Meta-Analyses Relating to Achievement*, Routledge. PDF p. 5 says first published 2009 and copyright 2009; the same page says this Taylor & Francis e-Library edition was published in 2008. Record this version distinction instead of inferring the publication year from the filename. Ebook ISBN 978-0-203-88733-2. Audience description on PDF p. 2 emphasizes school-aged students.

**Inspected scope.** Identity/overview; meta-analysis limitations, PDF pp. 21–22 (print pp. 10–11); feedback definition, variability, levels and instructional boundaries, PDF pp. 184–189 (print pp. 173–178); formative evaluation discussion, PDF p. 192 (print p. 181). Remaining portions of the 389-page attachment were not substantively reviewed here.

| Teaching decision | How to act | Conditions and likely misuse |
|---|---|---|
| Treat student work as feedback to the teacher. | Before a lesson, name the misconception or performance gap you will look for and the instructional change each observation would trigger. | Administering an exit ticket without inspecting and responding to it does not complete the formative cycle. Student opinions are useful but distinct from evidence of learning. Basis: PDF pp. 184, 192. |
| Match feedback to task, process, or self-regulation. | Identify the target criterion, locate the present gap, and give an actionable next move at the appropriate level. Ask the student to interpret and act on the comment. | Generic praise carries little task information. If the learner has no initial understanding, provide instruction before expecting feedback alone to repair it. Basis: PDF pp. 185–189. |
| Compare interventions by relevant evidence and feasibility. | Inspect population, comparison, outcome, timescale, implementation, uncertainty, and local constraints before selecting a technique. | **Never prescribe from the rank order or a universal d = 0.40 cutoff.** Correlational influences, interventions, different outcomes, and heterogeneous meta-analyses are not a common menu of interchangeable causal effects. The book itself discusses moderators and historical evidence at PDF pp. 21–22; this skill applies a stricter causal-appraisal rule. |

**Practice recipe: feedback audit.** Sample several comments on an assignment. For each, identify the intended criterion, the student's observed gap, the requested action, and where the student can use it. Repair comments with no actionable step. If several students lack the same prerequisite, schedule a short explanation and another practice attempt instead of producing longer individual comments.

**Disagreement handling.** Do not accept every categorical sentence as a rule. For example, the assertion at PDF p. 189 that repeated testing is effective only if it provides feedback to teachers is too restrictive as a general claim: PF08 reviews learning benefits of student practice testing. Retain both functions—retrieval can help the learner, and assessment evidence can guide the teacher—without conflating them. Do not report a Hattie feedback average as the expected effect of an AI feedback tool.

## PF07 — Barbara Gross Davis, *Tools for Teaching*

**Verified identity.** Barbara Gross Davis (1993), *Tools for Teaching*, first edition, Jossey-Bass. Author and copyright: PDF pp. 2, 4; ISBN 1-55542-568-2. Contents inspected at PDF pp. 6–8. This is the first edition, not a later update.

**Inspected scope.** Identity/contents; questioning, PDF pp. 106–108 (print pp. 86–88); group design, PDF pp. 167–170 (print pp. 147–150); fast feedback, PDF pp. 364–369 (print pp. 345–350; PDF p. 367 lacks a visible print-page number in the extraction). Remaining portions of the 449-page handbook were not substantively reviewed for this update.

| Teaching decision | How to act | Conditions and likely misuse |
|---|---|---|
| Ask a question that displays understanding. | Replace “Does this make sense?” with a prediction, explanation, comparison, or application. Give silent processing time and use a follow-up probe. | Silence may reflect language processing, uncertainty, access barriers, or question ambiguity; do not infer laziness. Waiting is a participation design choice, not a rigid stopwatch rule. Basis: PDF pp. 106–108. |
| Teach collaboration as a capability. | Explain the task, completion criteria, roles, contribution expectations, conflict-handling method, and how work will be evaluated. Use a small initial task to practice the process. | Dividing labor can leave members unfamiliar with each other's learning targets. Add an individual explanation or application when individual competence matters. Basis: PDF pp. 167–170; also PF04. |
| Collect feedback on changes you can make. | Ask specific questions about pace, clarity, workload, and learning obstacles early enough to act. Pair reported experiences with a small performance check. | End-of-course ratings arrive too late for current students. Preference data do not by themselves prove which approach produces durable learning. Basis: PDF pp. 364–366. |
| Tell students how their feedback changed the course. | Sort suggestions into act now, revise next offering, and retain with explanation; report the decision and reassess the changed practice. | Soliciting comments and then disappearing closes no loop. Do not promise changes you cannot implement. Basis: PDF pp. 368–369. |

**Practice recipe: seven-minute course repair check.** Collect one concrete obstacle to learning and one example of what helped; also ask students to solve a short application of the week's central idea. Cluster obstacles, inspect incorrect applications, choose one feasible change, and explain the decision next class. Recheck the relevant learning outcome after implementation. This modern recipe draws on the handbook; it is not an experimental estimate.

**Historical boundary.** Adapt technology examples to the present without copying obsolete workload promises. Check current institution-specific accessibility and policy requirements separately. Do not retain the book's historical learning-style matching ideas as accepted evidence. “Learning preferences” can inform participation choices without becoming diagnoses that prescribe visual/auditory/kinesthetic instruction.

## PF08 — Dunlosky et al., effective learning techniques

**Verified identity.** John Dunlosky, Katherine A. Rawson, Elizabeth J. Marsh, Mitchell J. Nathan, and Daniel T. Willingham (2013), *Improving Students' Learning With Effective Learning Techniques: Promising Directions From Cognitive and Educational Psychology*. *Psychological Science in the Public Interest* 14(1), 4–58. DOI: `10.1177/1529100612453266`. Identity: PDF p. 1 (print p. 4).

**Inspected scope.** Summary and review framework, PDF pp. 1–4; selected elaborative-interrogation discussion, PDF pp. 5–8; practice-testing/transfer/implementation passages, PDF pp. 26, 29–32 (print pp. 29, 32–35); selected distributed-practice passages, PDF p. 36 (print p. 39); interleaving conclusions and synthesis, PDF pp. 40–43 (print pp. 43–46). The 55-page article was text-extracted; not every technique section or cited primary study was read.

**Interpret the ratings correctly.** Table 4, PDF p. 42 (print p. 45), rates practice testing and distributed practice high utility; elaborative interrogation, self-explanation, and interleaving moderate utility; the remaining reviewed techniques low utility. “Utility” is a judgment about evidence and generalizability available in 2013, not an effect-size ranking and not a ban on a technique's useful niche applications. The table distinguishes positive, negative, qualified, and insufficient evidence; do not turn insufficient evidence into proof of no effect.

| Teaching decision | How to act | Conditions and likely misuse |
|---|---|---|
| Make practice testing include genuine retrieval and corrective information. | Have learners answer before seeing the key, then compare and correct; revisit important targets across sessions. | Attractive incorrect multiple-choice alternatives can be retained when no corrective feedback follows. Feedback improves robustness, especially after errors; it need not always be instantaneous. Basis: PDF p. 32. |
| Distribute practice through the course structure. | Put prior concepts in later tasks and give students a manageable schedule rather than only advice to “space your studying.” | Time-on-task, retention interval, prior knowledge, and course constraints matter. A spacing effect does not identify one optimum calendar for every domain. Basis: PDF pp. 32, 36, 42–43. |
| Introduce individual problem types before mixing them. | Provide initial instruction/practice; then interleave types learners must learn to distinguish and require a reason for method selection. | Interleaving has boundary conditions and null results; very complex unfamiliar tasks may require more initial guidance. Basis: PDF pp. 40–41. |
| Teach students to choose and monitor strategies. | Connect each learning goal with an appropriate study action and demonstrate how to judge success using performance, including a delayed attempt when feasible. | Blanket dismissal of rereading obscures its role in first comprehension or checking a retrieval error. Repeated passive review is a weak default for durable independent recall; self-explanation also requires enough knowledge to avoid elaborating an error. Basis: PDF pp. 3–8, 26, 42–43. |

**Practice recipe: redesign a study guide.** Convert a list of covered topics into a small bank of independent recall, explanation, and application prompts with verified answers. Label when to revisit each target; add a cumulative mixed section after the types have been taught. Ask learners to record errors and confidence, then solve a parallel item later. Use completion data to improve access and uptake, but use performance on new or delayed items to assess learning.

**AI extension.** An AI coach should ask for the learner's answer, offer calibrated corrective feedback, and schedule another attempt. It should not praise completion of an AI-generated summary as evidence of understanding. An assisted answer and a later independent answer must be stored or reported as different outcomes.

## Cross-source rules for the advisor

1. **Diagnose before prescribing.** A failure may reflect missing knowledge, an inaccurate model, weak coordination, poor method selection, inability to act on feedback, or an access/workload barrier. Select a discriminating probe before recommending more of the same activity.
2. **Name the protected cognitive action.** In an AI-enabled task, state what the student must personally retrieve, interpret, decide, verify, or explain. Then identify what the tool can do without removing that learning opportunity.
3. **Make every major recommendation operational.** Give the instructor the prompt or artifact change, the learner action, an expected response or quality criterion, a feedback/repair step, and an independent check. State timings as adjustable design estimates.
4. **Preserve productive disagreement.** Dehaene's preference for rapid error information and Ambrose's self-correction example imply conditional timing. Hattie's feedback-to-teacher emphasis and Dunlosky's self-testing evidence describe complementary mechanisms. Resolve the task's objective rather than declaring one author universally right.
5. **Do not count duplicated evidence twice.** Dehaene's active-learning discussion refers to work represented by PF03; research cited in several textbooks remains the same evidence. Books provide translation and design breadth, not automatic independent replications.
6. **Measure more than smooth assisted performance.** Separate immediate practice, delayed retention, transfer, confidence calibration, participation/access, and instructor workload. A proposal can improve one while worsening another.
7. **Keep historical and AI evidence separate.** These foundations justify mechanisms and design hypotheses. To claim that a particular AI technique works, consult a current primary study with an appropriate comparison and a learning outcome; report uncertainty and context.

## Ready-to-use consultation prompts

- “Inspect this lecture for places students can listen successfully while never doing the target thinking. Propose three precise replacements, expected responses, and follow-up checks.”
- “Determine whether these wrong answers indicate missing prerequisites, misconceptions, failed integration, or failed transfer. Give me a short diagnostic and a different repair for each plausible cause.”
- “Repair this feedback so a student can act on it in ten minutes, then show how I will know the underlying capability improved.”
- “Turn this study guide into a cumulative retrieval schedule with verified prompts, corrections, and transfer questions; preserve the course workload budget.”
- “Review this AI tutor's hint policy against the goal of independent debugging. Specify when to wait, when to hint, when to teach, and how to check learning after help is removed.”
- “Audit our team project for individual learning, teach the required collaboration skills, and add a feasible individual demonstration without duplicating the whole project.”
- “Use student comments and actual work to select one course change this week. Explain what evidence would support keeping, revising, or abandoning it.”
