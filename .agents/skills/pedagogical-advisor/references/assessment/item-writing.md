# Item Writing

How individual test items are written determines how much of what you
measure is the construct you care about and how much is construct-
irrelevant noise — reading speed, test-taking savvy, familiarity with
the instructor's phrasing, or luck. Poor item writing is one of the
most common (and most fixable) threats to assessment validity.

The most influential guidance on item writing comes from Haladyna,
Downing, and Rodriguez (2002), whose review of textbooks and empirical
studies produced a consolidated set of guidelines. Rodriguez's (2005)
meta-analysis further examined which guidelines hold up under empirical
scrutiny — most do, with a few important refinements.

This file covers:
- Multiple-choice items (MCQs), where the guidance is densest
- Short-answer and fill-in-the-blank
- Essay and constructed-response
- True-false
- Matching and extended matching
- General principles that apply across formats

## Multiple-Choice Items

MCQs dominate large-scale testing because they can be scored cheaply
and reliably. They can assess high levels of cognition when well-
constructed, but most poorly-written MCQs reduce to memorized recall
or test-taking technique.

An MCQ has three parts:
- **Stem**: the question or prompt
- **Key**: the correct answer
- **Distractors**: the incorrect options

Good MCQ construction focuses on each of these.

### Stem construction

**Put the main idea in the stem, not the options.** The stem should
pose a clear, complete question before the learner reads the options.
A reader should be able to answer the question with the options
covered.

Bad:
> The mitochondrion:
> a) produces ATP
> b) contains DNA
> c) divides independently of the cell
> d) all of the above

Better:
> Which of the following is true of the mitochondrion?
> a) It produces ATP *and* has its own DNA.
> b) It contains DNA but does not produce ATP.
> ...

Even better — ask a specific question:
> Why does damage to mitochondrial DNA tend to accumulate more
> rapidly than nuclear DNA damage?

The third version measures reasoning; the first measures recognition
of a list.

**Avoid negatively-worded stems** ("Which of the following is NOT...").
If negation is necessary, bold or capitalize the negative word. But
prefer positive phrasing — negatives increase cognitive load without
measuring anything real, and are especially unfair to non-native
speakers.

**Keep the stem clear and concise.** Avoid unnecessary clinical
details, backstory, or flavor text unless the scenario itself is what
the item measures. For clinical vignettes or case-based items, the
scenario is part of the construct — but incidental verbosity adds
reading load, not measurement.

**Don't include irrelevant cueing in the stem.** Grammatical
agreement between stem and key ("an ___" with only one option starting
with a vowel) is a classic cue. So is length asymmetry (see below).

### Distractor quality

**Distractors must be plausible.** A common MCQ failure mode: the key
is the only option that could plausibly be right, because the
distractors are obviously wrong to anyone with moderate knowledge.
The effective number of options collapses from four to two, sharply
reducing discrimination.

Good distractors come from:
- **Common misconceptions**: wrong answers that reflect typical errors
  in student reasoning
- **Plausible-but-wrong applications**: using a related formula,
  swapping similar terms, applying a procedure to the wrong context
- **Partial knowledge**: answers that would come from understanding
  some but not all of the relevant content

Misconception-based distractors also give the item *diagnostic* value:
if many learners pick distractor B, that pattern tells you something
about the thinking they're bringing.

**Keep distractor length comparable to the key.** Rodriguez's
meta-analysis confirms the "too-long-to-be-wrong" phenomenon: if the
key is noticeably longer or more qualified than the distractors
(because the author wanted to make sure it was technically correct),
test-wise students can pick it without content knowledge.

**Keep distractors homogeneous in form.** All options should be
parallel in structure and category. Mixing grammatical categories
(nouns and phrases) or content levels (specific terms and broad
concepts) cues learners toward the odd one out.

**Avoid "All of the above" and "None of the above."** These options
degrade item quality:
- "All of the above" allows learners to pick it by confirming any two
  options — they don't need to evaluate all four.
- "None of the above" can be correct when the item author couldn't
  generate four plausible options, but it fails to test whether the
  learner can identify *the correct answer* — only whether they
  recognize the listed ones as wrong.

Rodriguez's meta-analysis found that items with "all of the above"
tend to be easier than equivalent items without it.

### Number of options

**Three well-written options are generally as good as four or five.**
This is one of Rodriguez's most-cited findings. Authors often strain
to generate a fourth or fifth distractor, resulting in an implausible
option that no learner picks — which adds no information but consumes
reading time. Three plausible options often works better than four,
one of which is dead weight.

This doesn't mean always use three — but it does mean don't force a
fourth distractor just to fill a slot.

### Option ordering

**Keys should be distributed roughly evenly across positions.** Check
the key distribution across a test; if 60% of keys are option C,
test-wise learners pick up on that pattern. Random ordering (or
alphabetical, if options are words) avoids positional cues.

For numerical options, **order by magnitude**. This reduces cognitive
load without compromising the item.

### Cross-item cueing

Items should be independent. Common cueing failures:
- **One item gives away another**: the stem of question 7 reveals
  what the answer to question 4 must be.
- **Definitional give-aways**: question 2 asks for a definition of
  term X; question 11 uses term X as if its meaning were known, but
  the phrasing signals the answer.
- **Grammatical inconsistency** between stems and keys within an item
  set.

Proofread the full item set, not just individual items.

## Short-Answer and Fill-in-the-Blank

Short-answer items avoid the recognition bias of MCQs — the learner
must *produce* the answer, not pick it from a list. This shifts the
cognitive demand from recognition to recall, which is often closer to
what objectives actually target.

Guidelines:

**Make the required response clear.** "Name the capital of France"
is clearer than "The capital of France is ____."

**Blank only key terms.** Fill-in-the-blank items where the blank is a
minor word or one of several equally-good completions become guessing
games. Blank the term that represents the construct.

**Anticipate alternative correct answers.** "Who developed the theory
of natural selection?" could legitimately be answered "Darwin,"
"Charles Darwin," "Darwin and Wallace," or "Wallace." Scoring rubrics
should specify which of these count.

**Constrain the response space.** "Explain the causes of World War I"
as a short answer has no clear constraint. "List three factors that
historians commonly cite as contributing to the outbreak of World War
I" does. Constrained prompts are fairer and more reliably scored.

## Essay and Constructed-Response

Essays can assess synthesis, argumentation, and extended reasoning that
no selected-response format can. They also have the highest
reliability risk of any item format: scoring is slower, more
subjective, and more vulnerable to rater drift.

Guidelines:

**Align the prompt with the objective.** If the objective is
"evaluate competing interpretations," the prompt should ask for
evaluation, not summary. Vague prompts ("discuss...") allow learners
to write what they know rather than what was asked.

**Specify the scope.** Page length, time limit, and required elements
should be explicit. "Analyze the causes of the French Revolution"
invites infinite variation; "In 400–600 words, analyze *three*
political factors contributing to the outbreak of the French
Revolution, with specific reference to at least two primary-source
examples from the course readings" narrows the task enough to be
reliably scored.

**Use a rubric.** Scoring an essay without a rubric produces
unreliable and often unfair grades. See `assessment-principles.md`
for rubric design.

**Score anonymously and by item, not by learner.** Anonymization
reduces halo effects. Scoring all responses to item 1 before moving
to item 2 reduces drift across items.

**Calibrate raters if multiple.** When more than one person grades,
sample a set of responses, have all raters score them independently,
discuss discrepancies, and re-calibrate. Without this, inter-rater
reliability can be very low.

## True-False Items

True-false items are vulnerable to several weaknesses:
- 50% guessing baseline
- Often testable through memorized statements rather than understanding
- Absolute qualifiers ("always," "never") signal false; qualifiers
  ("usually," "often") signal true

They have their place for efficiency in large item banks, but for
most instructional purposes, three-option MCQs or short-answer items
will measure more validly.

If using true-false:
- Avoid absolute qualifiers and tentative qualifiers that cue the
  answer
- Focus each item on a single proposition (not compound)
- Balance the number of true and false items across the test
- Consider requiring justification for false items (turning it into a
  modified-true-false format, which is harder to guess)

## Matching and Extended Matching

Traditional matching (two columns, one-to-one pairings) is efficient
for testing many associations at once but suffers from cueing as
options are eliminated.

**Extended matching** (one list of options, multiple stems that can
share or repeat options) is a stronger format common in medical
education. A list of 15–20 diagnoses is used to answer six vignettes;
the same diagnosis may be correct for more than one vignette or for
none. This reduces process-of-elimination effects.

Guidelines:
- Keep the list of options homogeneous (all diagnoses, all authors,
  all chemical compounds — not a mix)
- Make clear whether options can be used more than once or not at all
- Use more options than stems to prevent eliminate-to-answer strategies

## General Principles Across All Formats

**Items should assess understanding, not trickery.** An item that
requires a learner to notice a buried qualifier, an obscure synonym,
or an ambiguous phrasing is measuring attention-to-detail, not the
construct. When writing an item, check: if a learner *understands the
material fully*, can they answer this item correctly without
lucky-guessing?

**Use the Bloom matrix to align item level with objective.**
Recognition-level items assess lower-order thinking; application and
analysis items require well-constructed scenarios or novel contexts.
If an objective is at Apply level, items asking only for recall don't
measure it. See `design/bloom-taxonomy.md`.

**Don't copy verbatim from instructional materials.** When an item's
phrasing matches the textbook or lecture verbatim, you measure
recognition of that phrasing — not understanding. Paraphrase the
content in items, or use novel scenarios the learner hasn't seen.

**Pilot items when possible.** Item analysis — p-values (difficulty),
point-biserial correlations (discrimination), distractor frequency —
reveals which items are working and which aren't. Items that
high-scorers get wrong more often than low-scorers (negative
discrimination) are almost certainly flawed and should be revised or
cut.

**Review items with a second set of eyes.** Authors are blind to
ambiguities in their own items. A colleague reading an item with no
context is far more likely to catch where it could be misread.

## What To Look For When Critiquing Assessment

### Stem quality (for MCQs)
- Is the question in the stem, not the options?
- Is the stem clear and free of unnecessary verbiage?
- Is negative phrasing avoided (or flagged if used)?
- Is there grammatical cueing between stem and key?

### Distractor quality
- Are all distractors plausible to someone with partial knowledge?
- Are distractors based on common misconceptions, or on random wrong
  answers?
- Is the key notably longer, more specific, or more qualified than
  distractors?
- Is "all of the above" or "none of the above" present?

### Cross-item quality
- Do any items give away answers to others?
- Are keys distributed roughly evenly across positions?
- Is the test blueprint balanced — does the item count per topic
  match the emphasis of the course?

### Alignment
- Does the Bloom level of the items match the stated objectives?
- Are any objectives assessed by zero items?
- Are items phrased in ways the learner has encountered before
  (recognition) or in novel form (understanding)?

### Constructed-response quality
- Is the prompt scope clearly bounded?
- Is there a rubric?
- If multiple graders, is there a calibration process?

## Red Flags

- **Most keys are option C**: positional bias
- **Keys are reliably the longest option**: length cue
- **Distractors include "silly" options** (jokes, irrelevancies):
  effective options reduced to two
- **Vocabulary in items exceeds the course's reading level**:
  construct-irrelevant variance
- **Item phrasing matches lecture/textbook verbatim**: measuring
  recognition, not understanding
- **Items testing only recall when the course claims higher-order
  skills**: construct under-representation
- **Essays without rubrics**: low reliability and fairness
- **"Discuss..." or "What do you think about..." prompts**: under-
  specified; invite off-task responses
- **No item analysis performed on previously-used items**: flawed items
  reproduced term after term

## Summary

**Every item format has strengths and weaknesses.** MCQs efficient,
reliable, but vulnerable to cueing and recognition bias. Short-answer
shifts to recall. Essay measures synthesis but taxes reliability.
Choose format to match construct.

**For MCQs**: question in the stem; plausible misconception-based
distractors; three well-crafted options often beats four with filler;
avoid "all of the above" and negative phrasing; watch for length and
positional cues.

**For constructed response**: constrain scope, use a rubric, grade
anonymously and by item, calibrate raters.

**Across formats**: align item level with objective, paraphrase rather
than quote instructional material, review with a second reader, pilot
when possible and do item analysis.

**The goal of item writing is to make it as easy as possible for a
learner with the intended understanding to demonstrate it, and as hard
as possible for a learner without it to guess right.** Every cue,
every ambiguity, every filler option chips away at both.

## References

- Haladyna, T. M., Downing, S. M., & Rodriguez, M. C. (2002). A
  review of multiple-choice item-writing guidelines for classroom
  assessment. *Applied Measurement in Education*, 15(3), 309–333.
- Rodriguez, M. C. (2005). Three options are optimal for multiple-
  choice items: A meta-analysis of 80 years of research. *Educational
  Measurement: Issues and Practice*, 24(2), 3–13.
- Downing, S. M. (2005). The effects of violating standard item
  writing principles on tests and students. *Advances in Health
  Sciences Education*, 10(2), 133–143.

See also `assessment-principles.md` for validity, reliability, and
rubric design; `design/bloom-taxonomy.md` for aligning item level
with objective.
