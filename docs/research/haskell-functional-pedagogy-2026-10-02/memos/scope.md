# Haskell and functional programming education review scope

Prepared 2 October 2026. Status: approved by the user for end-to-end execution; subsequent phase checkpoints waived.

## Purpose and questions

Produce a substantial Markdown research report to inform digital Haskell tutorial design.

1. What misconceptions and learning difficulties do students encounter in Haskell and functional programming, and which have direct empirical support?
2. Which teaching approaches improve conceptual understanding, retention, transfer, debugging, and independent programming?
3. How should these findings inform tutorial sequencing, exercises, feedback, assessment, and accessible digital interactions?
4. What can established Haskell tutorials contribute, and what claims about their effectiveness remain untested?

## Proposed boundaries

- Main audience: university students who know an imperative or object-oriented language and are learning Haskell. Include first-language learners as a separately identified comparison group.
- Time: foundational literature through 2 October 2026, with recent work sought explicitly; no lower year cutoff.
- Language: English-language sources and accessible English abstracts; acknowledge language bias.
- Include empirical studies, reviews, learning-science syntheses, teaching experience reports, dissertations, and authoritative tutorials. Keep these evidence categories separate.
- Cover expressions and immutable bindings, recursion and structural thinking, algebraic data types and pattern matching, types and polymorphism, higher-order functions and currying, laziness, effects and IO, monads, debugging, and paradigm transfer.
- Include related functional languages only where the conceptual or instructional connection to Haskell is explicit; mark transfer as an inference.
- Exclude unrelated uses of “functional,” language implementation papers without educational relevance, and unsupported online claims used as prevalence evidence.

## Search strategy

Use OpenAlex through Sider Scholar as the primary bibliographic backend, supplemented by SciSpace semantic searches. Verify key papers against publisher pages, author manuscripts, institutional repositories, or full text. Review tutorial materials at their official sources.

Initial concise OpenAlex query families:

- Haskell misconceptions students
- Haskell teaching learning
- functional programming misconceptions
- functional programming education recursion
- Haskell type errors novice
- lazy evaluation teaching
- functional programming tutors feedback
- programming worked examples subgoals
- PRIMM programming education
- programming retrieval practice feedback

SciSpace question families:

- What misconceptions and conceptual difficulties do students encounter when learning Haskell and functional programming?
- Which teaching interventions improve students' understanding of functional programming, recursion, types, and lazy evaluation?
- How can digital programming tutorials use worked examples, prediction, feedback, and retrieval practice to improve learning and transfer?

Search in relevance order and add recent-date searches to reduce citation-age bias. Screen a bounded, documented result set rather than claim exhaustive coverage. Aim for approximately 30–50 substantively annotated sources, adjusted to evidence availability. Record actual queries and returned counts; do not treat indexing counts as screened counts.

## Screening and snowballing

Deduplicate by DOI, OpenAlex ID, and normalized title. Record include, borderline, and exclude decisions with reasons. Separate direct Haskell evidence, adjacent CS education evidence, general learning science, and tutorial exemplars. Pursue backward references and forward citations from particularly relevant empirical papers and reviews. Record seed-to-candidate links and full-text availability. Do not infer study details from AI-generated summaries.

## Planned deliverables

- Main Markdown report, with an evidence-strength map, misconception taxonomy, teaching recommendations, comparison of tutorial exemplars, concrete digital tutorial blueprint, assessment plan, limitations, and linked references.
- Search log and raw connector/API results where retrievable.
- Screening and full-text status records.
- Structured annotated bibliography and BibTeX export.

## Workflow choice requiring confirmation

The invoked lit-search skill requests user checkpoints between phases. The user may instead authorize an end-to-end review under this scope, with uncertain inclusions labeled explicitly, inaccessible full text reported, and no further phase approvals. That authorization would override the skill's routine pauses without changing evidence standards.
