# Additional misconception and learning-study snowballing

Access date: 2026-10-02. Bounded backward and forward pass from Tirronen (2015), Németh (2019), and the two Rivera (2022) papers. The accompanying `snowball-misconceptions-sources.json` records exact queries, bibliographic metadata, methods, locations, access limits, and citation edges. Four new sources have primary full text; the fifth is an access-gap record. These are additions to the original misconception notes, not a replacement corpus.

## New primary evidence

- [Map, Filter, and Conquer (2025)](https://people.inf.ethz.ch/~sverrirt/pdf/mapfilterconquer2025.pdf): 27-person crossover comparing Algot and Python. Lower effort and faster task completion support a scaffolding claim. Concept questions showed no significant difference; the error difference was also nonsignificant after excluding Python syntax errors. Haskell learning and later transfer were not measured.
- [Teaching types with a cognitively effective worked example format (2015)](https://www.cambridge.org/core/services/aop-cambridge-core/content/view/D793285CAC3FDC1FAB3B1C846EEEFF54/S0956796814000021a.pdf/teaching-types-with-a-cognitively-effective-worked-example-format.pdf): direct Haskell evidence from an exploratory repeated single-subject study. Individual type-variable scope, currying, and application/abstraction difficulties suggest diagnostic prompts and worked derivations. Improvement and maintenance were mixed; sample accounting and additional individual correction limit efficacy claims.
- [Developing Behavioral Concepts of Higher-Order Functions (2021)](https://cs.brown.edu/~sk/Publications/Papers/Published/kf-devel-beh-concept-hofs/paper.pdf): Racket/Pyret behavioral classification study, with 64–83 responses per stage. Filter/take-while distinctions motivate contrasting examples and explanation prompts. Recognition results do not establish coding competence; changing samples prevent a matched retention estimate. Suggested instructional changes were not causal comparisons.
- [Observations on the Design of Program Planning Notations for Students (2024)](https://cs.brown.edu/people/sk/Publications/Papers/Published/rkf-obs-design-prog-plan-notations/paper.pdf): novice-course experience report challenging a blanket recommendation for visual planning blocks. Students often preferred flexible written plans. Show the practical benefit of planning and support composition explicitly; cohort and task changes preclude a causal comparison of notations.

## Citation paths and screening

Backward primary bibliographies led from Tirronen (2015) to the worked-type study, and from both Rivera papers to the behavioral-concepts study. Forward OpenAlex searches led to Map, Filter, and Conquer from Tirronen and both Rivera seeds; its references independently confirm all three edges. Rivera planning also led forward to the 2024 notation report, whose text and bibliography explicitly identify the earlier study.

Németh's backward references returned already-covered Singer, Helium, and Ask-Elle papers. Its forward query returned zero indexed works; that is an index-coverage result, not evidence of no citations. The Tirronen and Rivera searches returned 56, 3, and 10 indexed works respectively. Metadata-only candidates and broad handbook chapters are not counted as learner studies.

The 2014 type-system paper was reached through Tirronen's forward citation to Wu (2017), then Wu's primary reference list. Its methods, language, and sample remain unverified. Paz–Lapidot (2004) was also searched directly and forward; no primary full text was obtained. Neither abstract lead establishes misconception prevalence or causal negative transfer.

## Use in the synthesis

Keep Haskell observations separate from adjacent functional-language studies. Distinguish syntax-protected tool performance, behavioral recognition, and actual program construction. Treat planning recommendations and worked-type examples as promising designs with explicit evidential limits. Reuse the ledger's concise annotations when drafting the report to respect cumulative per-source summary budgets.
