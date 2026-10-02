# Additional tutor and teaching snowballing

Accessed 2 October 2026. Research notes; no implementation changes. Five additions were checked against the existing 31 research annotations by DOI and title. These are a bounded citation search, not an exhaustive review. Original design proposals below are separate from source summaries.

## Citation paths and search coverage

“Backward” means the seed cites the candidate; “forward” means the candidate cites the seed. Saved OpenAlex requests/results are in `data/raw/snowball-*.json`; their retrieved counts are indexing results, not counts of primary texts read.

| Seed | Backward retrieval | Forward retrieval | Primary citation verification and decisions |
| --- | --- | --- | --- |
| Ask-Elle 2017, 10.1007/s40593-015-0080-x | 40 records; targeted title/metadata screening plus primary bibliography | 98 records; targeted title/metadata screening | Selected Ladder 2025; its §2.2 and reference [2] explicitly cite Ask-Elle. After publisher/Utrecht/technical-report fetch failures, the existing review's Royal Holloway manuscript was recovered; §8 and References inspected. Earlier tutor versions are not independent replications. |
| Olmer et al. 2014, 10.4204/EPTCS.170.4 | 21 indexed records; primary reference list inspected | 3 records | Selected Haskelite 2024; §6 and reference [16] explicitly cite Olmer. Haskelite 2025 is already annotated; the remaining microcontroller-expression tutor is outside functional-programming scope. |
| Haskelite 2025, 10.4204/EPTCS.424.3 | 15 returned indexed records; primary reference list inspected | 0 returned records | Selected Tunnell Wilson et al. 2018 ([18]) and Stepping OCaml 2019 ([8]). Haskelite 2024 is also cited ([17]). Zero returned forward records means no indexed candidates in this snapshot, not proof of no citations. |
| Chapman 2025, 10.1017/S0956796824000182 | 31 returned indexed records; primary reference list inspected | 1 returned record | Selected Hameer/Pientka 2019, verified in References and §2 discussion. Ramsey 2014 and HtDP are additional leads. The retrieved 2026 edited-volume/review result was not selected: weak topical relevance, no new verified Haskell learning outcome. |

The relation Haskelite 2025 → Tunnell Wilson 2018 was verified in the primary bibliography even where bibliographic resolution differs. An OpenAlex HtDP match carrying DOI `10.14507/er.v0.173` is a review, not the textbook; use the primary [HtDP second edition](https://htdp.org/2024-11-6/Book/index.html). Do not merge that review DOI into the book record.

## Five new primary-source annotations

### ST01 — Tunnell Wilson, Fisler and Krishnamurthi (2018)

Backward from Haskelite 2025 reference [18]. [Author-hosted paper](https://cs.brown.edu/people/sk/Publications/Papers/Published/tfk-eval-trace-rec-subst-nm/paper.pdf), DOI [10.1145/3159450.3159479](https://doi.org/10.1145/3159450.3159479); selected full-text methods/results inspected. **Adjacent FP empirical evidence:** 19 learners in an introductory summer course completed five paper quizzes, moving from Pyret substitution to Python environments. Traces were coded for soundness, completeness, result, retained context, and shortcuts. On one tree problem, 10/15 got the answer right, but only 1/15 produced a sound, complete trace. Copying caused errors; an unbound-variable task exposed scope misunderstandings. The later Python comparison used a newly introduced model, so does not establish substitution's causal superiority. No retention/transfer test. Pyret's strict substitution order cannot simply serve as Haskell's lazy machine.

### ST02 — Hameer and Pientka (2019)

Backward from Chapman 2025 References and §2. [Author-hosted paper](https://www.cs.mcgill.ca/~ahamee2/learn-ocaml-icfp19.pdf), DOI [10.1145/3341719](https://doi.org/10.1145/3341719); selected full-text §§2–4 inspected. **Adjacent FP teaching experience:** nine Learn-OCaml homework assignments in a second-year programming-languages course exposed limits of output-only grading. Authors observed students using grader trial-and-error instead of independent testing. They added checks of student-written tests against correct solutions and instructor mutants, plus style feedback. Infinite lazy structures required bounded or task-specific comparison and meaningful counterexample display. These are observed implementation/course lessons and proposed remedies; improved independent learning from the extensions was not established. OCaml's explicit lazy lists differ from Haskell's default laziness, while the feedback and test-design issues transfer plausibly.

### ST03 — Furukawa, Cong and Asai (2019)

Backward from Haskelite 2025 reference [8]. [Primary manuscript](https://arxiv.org/html/1906.11422), DOI [10.4204/EPTCS.295.2](https://doi.org/10.4204/EPTCS.295.2); full-text classroom/evaluation sections inspected. **Adjacent FP observational evaluation:** approximately 40 second-year CS students per year, all after C, attended 15 OCaml labs. Comparison of 2016–2018 correct-submission times favored later versions on several tasks, but one 2018 recursion task was slower; 2017 versus 2018 aggregate difference was nonsignificant. Both supported constructs and instructor encouragement changed. Cohorts differed and initial class comments varied. These are task-completion times, usage, and self-reported usefulness, not retention or causal learning gains. Scope coverage sustained later use; 38/42 students answered the 2018 survey. Strict OCaml order requires adaptation to lazy Haskell.

### ST04 — Vasconcelos and Marques (2024)

Forward from Olmer 2014; backward from Haskelite 2025 reference [17]. [Primary manuscript](https://arxiv.org/html/2407.11831), DOI [10.1145/3677999.3678274](https://doi.org/10.1145/3677999.3678274); selected full-text semantics, related work, and conclusions inspected. **Direct Haskell educational tool design:** Haskelite traces a lazy calculus while preserving equation alternatives, matching failures, guards, and shared computation through a heap. Its discussion explicitly distinguishes Olmer's innermost/outermost rewriting from lazy evaluation. This supplies a technical basis for choosing what an educational trace represents. The paper's educational assessment was still underway; no completed learner-outcome study is reported. Technical semantic correspondence and usability aspirations must remain separate from evidence of comprehension, retention, or transfer.

### ST05 — Kumamoto, Cong and Masuhara (2025), Ladder

Forward from Ask-Elle 2017, confirmed in §2.2 and reference [2]. [Author-hosted paper](https://prg.is.titech.ac.jp/papers/pdf/splashe2025ladder.pdf), DOI [10.1145/3758317.3759682](https://doi.org/10.1145/3758317.3759682); selected full-text §§3–6 and bibliography inspected. **Adjacent FP feasibility study:** an LLM guides Scala 3 design recipes through natural-language responses and code generation. 42 students participated, 38 consented, and 33 usable logs supported interaction analysis. The intended testing step was unimplemented. Questionnaire concerns included tedious dialogue (16 responses) and uncertainty about learning without writing code (10). Logs showed missed problems and answer-giving despite pedagogical guardrails. One perimeter task and self-report establish feasibility/problems, not learning gains; long-term educational evaluation is future work. Primary paper denominators take precedence over simplified author slides.

## Original design proposals arising from the additions

These are proposed Haskell tutorial designs, not effects demonstrated by the sources.

- Pair a predicted result with one required justification step. Score result, substitution/binding correctness, and preserved pending computation separately; use short traces to limit copying burden. Compare later independent explanations and novel tree tasks, not just visible test passing.
- Ask learners to supply expected outputs and discriminating tests before submitting an implementation. Give bounded counterexamples for infinite structures and explain which demand was tested. Evaluate independent debugging and test quality when the grader is unavailable.
- State whether a trace uses substitution, call-by-need sharing, or a simplified pedagogical model. Let students explain why a subexpression is demanded before revealing the next step. Validate examples against the selected machine and GHC behavior separately.
- Fade dialogue and code generation into completion and independent coding. Permit grouped answers and explicit revisiting of data definitions. Evaluate a new unaided design problem after support removal; satisfaction and dialogue completion are secondary measures.

## Other leads, exclusions and access limits

- **Ramsey 2014:** Chapman backward; [author PDF](https://www.cs.tufts.edu/~nr/pubs/htdp.pdf), DOI [10.1145/2628136.2628137](https://doi.org/10.1145/2628136.2628137). Search-indexed author text describes a reflective HtDP case and review/refactor extension, explicitly without controlled experiments or quantitative measurement. Repeated direct PDF fetches failed; retained as a primary-author abstract/partial-text lead, not a completed full-text annotation.
- **Haskelite 2023:** Haskelite 2025 backward [16], DOI [10.4230/OASIcs.ICPEC.2023.12](https://doi.org/10.4230/OASIcs.ICPEC.2023.12). Primary Dagstuhl metadata inspected; 2024 paper chosen for detailed semantic comparison. These versions are related implementations, not independent replications.
- **2026 hybrid Ask-Elle thesis:** [Chalmers record](https://odr.chalmers.se/items/abcc3a1f-f693-4c85-8d84-4c3c5d0c9c74/full), Arash Amiry and Nils Bengtsson Svanstedt. Primary repository abstract only; PDF download failed. Promising topical update, but its exact citation to the 2017 seed and learning-study details were not verified, so **not a confirmed snowball addition**. Do not equate validated code or rated hints with learning gains.
- **FPTutor 2023:** exact-title queries did not identify a verified primary source in this bounded search. No record or citation relation invented.
- **Ask-Elle backward bibliography:** [author manuscript](https://pure.royalholloway.ac.uk/ws/files/25913698/compilation.pdf), pp. 32–36. Includes Gerdes et al. 2010/2012 earlier tutor work, Jeuring et al. 2014 diagnosis, Helium 2003 (already included), and Lisp-tutor studies. `FPTutor` is also the older Ask-Elle application path in this manuscript; that name alone does not identify a separate 2023 study.
- **Olmer backward alternatives:** WHAT (López et al. 2002, DOI 10.1007/3-540-46148-5_8), WinHIPE (Pareja-Flores et al. 2007, DOI 10.1145/1273039.1273042), and Millwood's stepeval were visible in the primary reference list. Not selected for annotation; no verified learning-effect assertion.
- **Ask-Elle forward exclusions:** general code-refactoring, logic-conversion and language-environment papers were screened as outside the Haskell/FP instructional focus. The 2026 middle-school AI education article that cites Chapman was excluded for the same reason.
- Failed fetches indicate access limits of this review, not proven paywalls. Exact OpenAlex requests and date filters are preserved in raw JSON. Publisher cited-by displays differed between fetches; indexed counts can lag and change.

## Exact supplementary web queries

Search-result counts were not separately extracted; source-level verifications above are the auditable screened subset. Queries supplemented the saved OpenAlex backward/forward requests:

1. `"s40593-015-0080-x"`
2. `"EPTCS.170.4"`
3. `"FPTutor" Haskell 2023`
4. `"Experiences of early assessment" references`
5. `FPTutor functional programming tutor 2023`
6. `"Evaluating Haskell expressions in a tutoring environment" arxiv`
7. `"Ask-Elle" "FPTutor"`
8. `"Evaluating Haskell expressions" "2023"`
9. `"Teaching Introductory Functional Programming Using Haskelite" citations`
10. `"Experiences of early assessment to teach functional programming" -site:cambridge.org -site:researchgate.net`
11. `"FPTutor"`
12. `"Ask-Elle" "2017" programming sketches`
13. `"Ask-Elle" "Gerdes" filetype:pdf`
14. `"Evaluating the Tracing of Recursion in the Substitution Notional Machine"`
15. `"An Interactive Learning Environment for Program Design" 3759682`
16. `"Teaching the art of functional programming using automated grading"`
17. `"An Interactive Learning Environment for Program Design"`
18. `"Trustworthy AI Feedback" Ask-Elle PDF`
19. `"On teaching How to design programs" Ramsey pdf`
20. `"Kouta Kumamoto" "Program Design"`
21. `"3759682" pdf`
22. `"Stepping OCaml" 2019 tutor`
23. `"On Teaching How to Design Programs" "data examples"`
