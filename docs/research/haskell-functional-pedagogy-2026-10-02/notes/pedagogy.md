# Pedagogy evidence track

Prepared 2 October 2026 under the approved scope and evidence protocol. Twelve sources were extracted: eleven empirical papers and one conceptual synthesis. Eleven have selected full-text inspection; P11 has abstract/metadata access only. None tests the current Haskell tutorial or establishes Haskell-specific effectiveness. No live tutorial was audited or edited.

The structured extraction, exact queries, discovery links, access levels and supporting locations are in [pedagogy-sources.json](pedagogy-sources.json). Web discovery was followed by author/institutional/publisher verification. Batched results do not supply defensible per-query screened counts; this is a bounded track, not a systematic-review census.

## Findings to preserve

| Source | Crucial distinction |
| --- | --- |
| [P01: PRIMM](https://eprints.gla.ac.uk/229013/) | Teacher-supported school Python evidence; self-paced university transfer remains untested. |
| [P02: subgoals](https://doi.org/10.1186/s40594-020-00222-7) | Formative benefits did not produce a significant average-exam gain. |
| [P03: fading](https://escholarship.org/uc/item/81b9j9hs) | Near-transfer improvement did not establish far transfer. |
| [P04: retrieval](https://doi.org/10.1111/j.1467-9280.2006.01693.x) | Immediate fluency and delayed recall can favor different treatments. |
| [P05: spacing](https://doi.org/10.1111/j.1467-9280.2008.02209.x) | Optimal gaps depend on intended retention; avoid universal percentages. |
| [P06: null feedback](https://doi.org/10.1145/2591708.2591748), [P07: positive feedback](https://doi.org/10.1080/08993408.2016.1225464) | Enhancement effects depend on intervention and context; error frequency is not mastery. |
| [P08: GPT-4](https://arxiv.org/abs/2409.18661) | Preference, correctness of advice and successful use are distinct outcomes. |
| [P09: transfer](https://eprints.gla.ac.uk/230934/) | Distinguish syntax resemblance from semantic equivalence; Haskell remains an inference. |
| [P10: notional machines](https://doi.org/10.1145/2483710.2483713) | Conceptual rationale for explicit execution models, not an intervention effect estimate. |
| [P11: simulation](https://doi.org/10.1080/08993408.2013.807962) | Visual participation can lack conceptual meaning; abstract-only details remain provisional. |
| [P12: incentive RCTs](https://doi.org/10.1038/s41539-025-00322-5) | Instructor-level replication measured practice behavior; comparable exam outcomes were unavailable. |

P01 reports r=.13 but interprets it incorrectly as 13% explained variance; retain the statistic without that interpretation. P07 is an original author manuscript; historical-cohort and compiler-ID caveats matter. P12 randomized 199 students but analyzed 143 after exclusions.

## Proposed implications for Haskell — hypotheses to evaluate

Name the intended reasoning and assess it separately from compilation or final output. Candidate sequences include annotated type derivation → constraint completion → independent derivation, and complete structural recursion → missing-branch completion → independent traversal. Neither sequence is established as effective for this Haskell course.

Require predictions before execution and explanations before revealing hints. Use controlled contrasts where one semantic feature changes, then assess the relationship on new input and data shapes. Measure independent construction as well as comprehension, including delayed tasks.

For execution displays, require learners to interpret each object and connect it to source semantics. Haskell's non-strict evaluation needs an appropriate model; importing imperative line-order reasoning can mislead. Accessible text alternatives are a project requirement, not a measured learning effect in this track.

Feedback should identify the applicable rule, relevant evidence and a next reasoning step. Evaluate subsequent independent repair. More friendly prose or longer explanations do not guarantee effective use. Incentives for returning across days are candidates for evaluation; distinguish spacing, practice volume, time and understanding.

## Limits and follow-up

Query 20 sought recent retrieval/spacing evidence; P08 and P12 cover 2024–2025. The 2019 retrieval tool, Naps visualization work and later fading/self-explanation papers remain candidates, not additional independent confirmations. Exact snowball links are recorded in JSON.

Local skills supplied search leads, not verified results. No Haskell-specific type-error intervention was extracted here; that belongs to the direct-Haskell track. No verbatim quotations. These two files use fewer than 200 source-derived words per source; preserve the remaining budget when incorporating annotations into the main report rather than repeating findings.
