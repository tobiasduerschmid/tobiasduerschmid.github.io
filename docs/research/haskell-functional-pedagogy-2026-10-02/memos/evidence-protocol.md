# Evidence extraction and appraisal protocol

## Claim classes

- **Direct Haskell evidence:** a study of Haskell learners, their work, explanations, errors, or outcomes.
- **Adjacent functional programming evidence:** another functional language or mixed-language setting; explain the transfer boundary.
- **CS education evidence:** programming instruction without a Haskell-specific test.
- **General learning science:** evidence about learning processes; application to Haskell is an instructional inference.
- **Tutorial exemplar:** an observable design choice in a learning resource; popularity and existence are not effectiveness evidence.
- **Proposed design:** a recommendation derived from the synthesis, to be tested with learners.

Keep relevance separate from methodological strength: a rigorous study in another setting can be indirect, while a small Haskell interview study can supply direct evidence of a particular mental model.

## Per-source extraction

Record stable identifier, title, authors, year, venue, source URL, discovery query or snowball seed, and access date. Record whether the annotation comes from full text, selected full-text sections, abstract, metadata, or direct inspection of a tutorial.

For research, extract question, population and prior experience, language, study design, sample size where verified, task, comparison condition, intervention duration, measures, follow-up interval, findings, limitations, and supportable claims. Leave unavailable fields null rather than reconstructing them from the title. Distinguish author-stated limitations from reviewer inferences.

For tutorials, record intended audience, sequence, examples, independent exercises, feedback, assessment, tooling, and limitations visible from the inspected pages. Do not claim a complete platform audit from inspecting a chapter.

## Appraisal rules

1. Distinguish a conceptual misconception from a syntax slip, missing knowledge, confusing compiler output, tool friction, or a rational strategy under an unusual task.
2. Do not call a misconception common without a denominator, a documented recurring pattern, or converging evidence. A plausible error is a diagnostic hypothesis until student evidence supports it.
3. Separate correct output, immediate task completion, retention, explanation quality, near transfer, and far transfer.
4. Do not treat satisfaction, engagement, completion, or passing visible tests as proof of learning.
5. Do not convert uncontrolled before/after differences into causal intervention effects.
6. Record instructor, cohort, prior-language, task-difficulty, feedback, novelty, and self-selection confounds.
7. Check exact numerical findings in the primary source. Report uncertainty and null findings alongside positive results.
8. Verify Haskell semantics against authoritative documentation, separately from empirical claims about students.
9. Treat automated discovery summaries as leads; cite and annotate the underlying research.
10. Mark unavailable full texts and partial inspections explicitly. Do not characterize an access failure as proof that a paper is paywalled.

## Synthesis requirements

Each substantial recommendation should connect a learning objective, a documented or hypothesized difficulty, an instructional response, the evidence supporting that response, and a way to evaluate learning. Mark recommendations whose Haskell-specific effectiveness remains untested. Avoid universal rankings of paradigms, tutorials, visualizations, or teaching sequences.
