# Exams and Quizzes

This file covers summative and formative assessments: midterm and final exams,
quizzes, placement tests, licensing/certification-style instruments, standardized
tests, oral exams. The defining feature is that the artifact is being used to
make a judgment about what the learner has learned — with consequences attached.

Exams are the highest-stakes pedagogical artifact you'll typically be asked about.
Two things that are easy to miss: (1) exams *teach* what the course values, not
just what the instructor says; if the exam doesn't match the stated objectives,
the hidden curriculum is whatever the exam tests. (2) Bad exam design doesn't
just produce bad grades — it produces invalid decisions about whether learning
happened, which downstream affects who continues, who's certified, who gets
remediation.

## What makes an exam work

1. **Construct validity** — the exam measures what it claims to measure. If the
   objective is "apply concept X to novel situations," the exam items actually
   require application to novel situations, not just definition recall.
2. **Alignment with the course's stated objectives** — every objective is
   assessed; nothing outside the objectives is assessed; the Bloom levels
   assessed match the Bloom levels taught.
3. **Reliability** — results are consistent. A student with the same knowledge
   should get roughly the same score regardless of form, grader, or occasion.
   This requires enough items per construct, clear criteria, and
   well-functioning items.
4. **Fair and accessible** — the exam doesn't privilege students with
   language, cultural, or access advantages unrelated to the construct.
   Necessary accommodations are built in by design, not added as an
   afterthought.
5. **Difficulty calibrated** — the exam as a whole lands in a range that's
   challenging but not demoralizing. Individual items span a range of
   difficulty so the exam discriminates across the ability continuum.
6. **Items are well-constructed** — for each item type, evidence-based
   guidelines are followed (see `assessment/item-writing.md`).
7. **The feedback the exam generates is useful** — both to the learner
   (what do I need to work on) and the instructor (what did my class master,
   where are the collective gaps).
8. **If high-stakes: robust to random error, gaming, and cheating** —
   multiple forms, secure distribution, proctoring where appropriate. If
   not robust to these, the construct validity claim fails.
9. **Pedagogically coherent with the course.** Formative quizzes support
   learning (retrieval practice, feedback); summative exams support judgment.
   An exam that tries to do both usually does both badly.

## The most common problems

- **Bloom-level mismatch.** The course taught conceptual understanding and
  application; the exam asks for definition recall. Or the reverse — the
  course taught foundations and the exam asks for synthesis the class
  wasn't prepared for.
- **Objective coverage holes.** Some objectives are assessed heavily (because
  easy to write items for); others not at all. The exam score under- or
  over-represents the objectives.
- **Item-writing violations.** Implausible distractors, answers that are
  "too long to be wrong," "all of the above" and "none of the above" used
  lazily, negatively-worded stems that trip up ESL students. See
  `assessment/item-writing.md` for the standard catalog.
- **Cueing across items.** The answer to one item is given away by the
  content of another. Occurs especially on long exams with related content.
- **Length/time mismatch.** Exam nominally 60 minutes, actually requires
  90 for a prepared student. Time pressure is a construct-irrelevant variance
  source.
- **Reading load dominating.** For content that isn't testing reading, dense
  prose stems can make the exam a reading test first and a content test
  second, disadvantaging ESL students and those with reading disabilities.
- **High-stakes with low-reliability.** Small number of items, ambiguous
  grading, no rubric. A student's fate hinges on a handful of judgments that
  might shift on re-grading.
- **No/poor feedback.** The graded exam returns with a number and no
  indication of where the gaps are. The learning opportunity is wasted.
- **Poor item analysis practice.** Items that don't discriminate (everyone
  gets them right or wrong; or the high-scorers get them wrong and the
  low-scorers get them right — "inverse" items) are kept on future forms
  without revision.
- **"Gotcha" items.** Items designed to trip up students on technicalities
  rather than assess understanding. These generate anxiety and can be invalid.
- **Unfair timing in online exams.** Automated systems that punish students
  for poor internet connections or old hardware. Accessibility
  misalignments not caught.
- **Alignment erosion over time.** An exam that was well-aligned 10 years
  ago is still in use, but the course it's assessing has changed.
- **Overweighting high-stakes.** A single final determining most of a
  grade, with no low-stakes retrieval practice throughout the term, is
  both motivationally damaging and pedagogically suboptimal.
- **AI-era concerns.** For take-home or unproctored exams, consider whether
  the items' cognitive demand still has to be done by the learner. If
  an LLM does the whole exam in 2 minutes, the scores don't measure what
  they claim to measure.

## Diagnostic checklist

**Validity — does the exam measure what it claims?**
- Is there a clear specification (blueprint) showing which objectives are
  assessed, by how many items, at what Bloom level?
- Can each item be traced to a specific objective?
- Does the item actually require the cognitive process the objective
  specifies (application vs. recall vs. analysis)?
- Are there items outside the objectives? If so, why are they there?
  → `design/learning-objectives.md`, `design/bloom-taxonomy.md`,
  `design/backward-design.md`, `assessment/assessment-principles.md`

**Reliability — are scores stable across form, grader, occasion?**
- Are there enough items per construct? (A single item per objective makes
  the subscore for that objective very noisy.)
- For constructed-response items, is there a rubric? Is it concrete enough
  that two graders would agree?
- For selected-response items, is there documentation and would an item
  analysis show them performing?
  → `assessment/assessment-principles.md`

**Item quality**
- For MCQs: are stems clear and focused? Are distractors plausible and
  grounded in real misconceptions? Are all options homogeneous in form/length?
  Are "all/none of the above" minimized? Are negatively-worded items minimized?
- For short-answer: is the target response unambiguous? Are alternative
  acceptable answers enumerated for the grader?
- For essay: is there a rubric? Are the criteria weighted in alignment with
  what the exam is trying to measure?
  → `assessment/item-writing.md`

**Difficulty and discrimination**
- Does the exam have items spanning a range of difficulties?
- Will it discriminate — distinguish learners who've mastered the material
  from those who haven't — or are all items at one level?
- Is the overall score distribution likely to be reasonable? (A good exam
  often produces a mean around 70-80%, not 50% or 95%.)
- Are there known "trick" items or items with low historical discrimination
  that should be revised or cut?
  → `assessment/assessment-principles.md`

**Fairness and accessibility**
- Does the exam privilege students with particular cultural, linguistic, or
  experiential backgrounds in ways unrelated to the construct?
- Are accommodations built in where possible (extra time flexibility,
  accessible formats, low reading load where reading isn't the construct)?
- For online exams: is the platform accessible? Are the time limits humane
  if a student has a momentary connectivity issue?
  → `design/universal-design.md`

**Time and cognitive load**
- Is the time realistic? Has anyone run through the exam at student pace?
- Is the total cognitive load (reading + thinking + writing) achievable for
  the target audience in the time given?
- Are early items reasonably accessible (so test anxiety doesn't snowball)?

**Consequences and scaffolding**
- If high-stakes: is the exam weighted reasonably in the course? Is there
  low-stakes retrieval practice throughout the term?
- If formative: is it actually formative — does the feedback serve learning?
  Or is it mini-summative masquerading as formative?
- Is there a plan for how students learn from the exam afterward? (Exam
  wrappers, item-by-item review, redo opportunities for mastery.)
  → `practices/feedback.md`, `practices/effective-techniques.md`

**Cheating and integrity** (for high-stakes unproctored contexts)
- If the exam can be completed by an LLM in minutes: what's the plan?
  (In-class components, proctoring, oral follow-up, process-focused
  artifacts, etc. Avoid only-punitive responses.)
- Are there multiple forms or randomized items where appropriate?
- Is the integrity policy clear to students, with examples?

## Which theory files to read

For most exam tasks, load:

1. **`assessment/assessment-principles.md`** — validity, reliability, fairness,
   formative vs. summative, item analysis. The foundation file.
2. **`assessment/item-writing.md`** — concrete guidelines for specific item
   types. Essential for critique of actual items.
3. **`design/bloom-taxonomy.md`** — for mapping items to cognitive levels
   and checking alignment to objectives.
4. **`design/learning-objectives.md`** and **`design/backward-design.md`** —
   for the alignment side of validity.

Usually also:
- **`practices/feedback.md`** — for how exam feedback should be designed
  and returned to serve further learning.
- **`practices/effective-techniques.md`** — especially for formative quizzing
  (retrieval practice, spacing). If the exam is part of a course-long
  assessment system, this is central.

Situational pulls:
- For a formative quiz designed to *teach*: `practices/effective-techniques.md`
  is the primary file. The quiz is then really a retrieval practice intervention.
- For a writing or essay exam: add attention to rubric design in
  `assessment/assessment-principles.md`.
- For a diverse class or when designing for equity: `design/universal-design.md`.
- For a high-stakes standardized or certification exam: add attention to
  reliability and documentation. Consider psychometric analysis.

For practical implementation — how to weight components, set policies, handle
grade disputes, calibrate multiple graders, and structure the course to minimize
academic dishonesty — load **`practical/grading-and-integrity.md`**. It addresses
the operational side of assessment that the principles files don't.

## Output format

For critique of an existing exam, structure as:

```
## Overall assessment
[Validity/reliability summary. Is this exam doing what it claims to do?
Compared to typical course exams at this level, where does it sit?]

## Strengths
[What's working — well-aligned items, good difficulty range, clear rubric,
whatever applies]

## Validity concerns (objectives-to-items alignment)
[Specific items that don't match their targeted objective; objectives that
are under-assessed or over-assessed; Bloom-level mismatches]

## Item-level issues
[Specific items with item-writing problems — by item number — with specific
fixes suggested]

## Reliability and fairness
[Concerns about consistency, rubric clarity, accessibility]

## Structural issues
[Overall exam-level issues — length, difficulty curve, time, weighting]

## Recommended revisions
[Prioritized: high-impact first]
```

For designing a new exam:

```
## Exam blueprint
[Table showing objective × Bloom level × number of items × points]

## Item types chosen and why
[Which format for which construct]

## Draft items, organized by objective
## Rubric (for any constructed-response items)
## Time estimate and structure (opener, harder middle, doable closer)
## Feedback plan (how students get useful information from their performance)
## Followup plan (how does learning continue after the exam)
```

## When the "exam" is actually a formative quiz

Worth separating: a *formative quiz* whose primary purpose is learning is
a different beast than a *summative exam* whose primary purpose is judgment.

Formative quizzing is one of the most powerful pedagogical tools we have
(Dunlosky et al. rate practice testing as *high-utility*, one of only two
such in their evaluation). If what's being designed is a formative quiz,
the priorities shift:

- Stakes should be low (or zero) — the point is retrieval, not judgment.
- Items can be simpler and more focused — they exist to exercise memory.
- Feedback is immediate and process-oriented.
- Spacing matters: quizzes should revisit earlier material, not just the
  current week.
- Frequency matters: short, frequent quizzes beat one long one.

For this case, lead with `practices/effective-techniques.md` rather than
the assessment files.
