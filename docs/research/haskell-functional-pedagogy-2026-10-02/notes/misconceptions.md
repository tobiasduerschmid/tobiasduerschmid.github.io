# Observed difficulties and misconceptions: research notes

Track completed 2026-10-02. The accompanying [source ledger](misconceptions-sources.json) contains the bibliographic records, methods, denominators, findings, limitations, and inspected sections. Twelve records were screened: eight learner/corpus papers with inspected primary full text, one additional corpus tooling evaluation, and three records requiring full text. This is a targeted evidence map, not a systematic-review prevalence estimate.

## What the evidence supports

The strongest directly observed Haskell difficulty cluster concerns types together with notation: list dimensionality, function application, parentheses/precedence, and the correspondence between signatures and definitions. The useful anchors are [Tirronen et al.](https://doi.org/10.1017/S0956796815000179), [Németh et al.](https://doi.org/10.4204/EPTCS.295.4), and [Wu and Chen](https://doi.org/10.1145/3133929). Their logs and repairs warrant diagnosing these behaviors; they usually do not establish a durable misconception or its prevalence in a wider population.

[Tirronen et al.](https://doi.org/10.1017/S0956796815000179) also supply counterevidence to a generic catalogue: several supposedly difficult FP concepts were not observed as conceptual obstacles in their cohort. Absence in these tasks does not show universal ease. It does mean the report should avoid saying currying, laziness, or a particular recursion model are universally common stumbling blocks.

[Singer and Archibald](https://doi.org/10.4204/EPTCS.270.3) support teaching explicit distinctions between expressions, declarations, and supported REPL input. Their do-block mistakes are useful observations, but neither that corpus nor the other verified studies establishes that IO/monad mental-model errors dominate Haskell learning.

For higher-order composition, [Rivera and Krishnamurthi](https://doi.org/10.1145/3547633) and [Rivera et al.](https://doi.org/10.1145/3501385.3543965) offer complementary Racket evidence. The former makes intermediate pipeline transformations a plausible instructional target; the latter shows that successful planning can coexist with representation-specific recognition errors. Neither tests Haskell-specific currying, laziness, type classes, or an instructional sequencing effect.

## Interpretation and teaching implications

The following are proposed applications of the evidence, not tested intervention effects:

- Diagnose type/application problems with brief contrasting cases: a scalar versus a singleton list, one list versus a nested list, a function value versus its result, and parentheses that change application grouping. Require a prediction and explanation before showing the compiler result.
- Distinguish the task being assessed from the tool accepting it. A successful compilation, copied REPL expression, or repaired error is a narrower outcome than conceptual understanding.
- Test higher-order composition with an explicit intermediate result, then fade that aid. Compare recognition, explanation, planning, and implementation so one successful representation does not conceal another difficulty.
- Probe recursion, laziness, and IO locally before adapting instruction around presumed misconceptions. The present sources cannot supply population-level rankings for them.
- Treat negative transfer as a hypothesis to investigate through explanations and contrasting tasks. Prior imperative experience alone does not demonstrate that an error was caused by it.

## Intervention evidence and cautions

[GeckoGraph](https://doi.org/10.1016/j.cola.2025.101381) measures immediate Haskell task performance with a notation aid. Its final abstract is cautious; subgroup effects and manuscript reporting problems are documented in the ledger. It should motivate a small evaluation, not a claim of established learning gains. Institutional metadata gives publication year 2026 despite the 2025 DOI/copyright. The 2024 preprint should not substitute for the final result.

[Helium](https://doi.org/10.1145/871895.871902) and [Goanna](https://doi.org/10.1007/s10515-026-00656-3) are relevant diagnostic tools. Goanna's corpus accuracy comparison is distinct from a human learning study. Existing positive reactions do not establish retention, independent debugging, or transfer.

## Search and citation provenance

Initial primary-source web searches targeted Haskell learner misconceptions, negative transfer, type errors, Helium, and repair behavior. Exact-title searches located author manuscripts, publisher pages, arXiv proceedings, and published-paper mirrors. Sider Scholar was used for complementary discovery and DOI lookups. Its actual responses exposed thin paper records; broad queries were noisy, and no exhaustive coverage or total count is claimed. Raw complementary records are retained in [misconceptions Sider records](../raw/misconceptions-sider-records.json).

Actual backward paths inspected were Németh to Singer/Helium; Tirronen to Segal/Clack/Chambers/Helium; Wu to shared Haskell corpus literature; and Rivera's structural report to the companion planning work. Goanna's reference list confirms links to Tirronen and Helium. The root agent supplied a direct OpenAlex forward-citation lead from Tirronen to GeckoGraph; this track then independently inspected GeckoGraph's author manuscript and institutional record. These are recorded paths, not a claim that all descendants/references were screened.

## Remaining gaps and exclusions

[Segal's Miranda recursion studies](https://doi.org/10.1007/BF00891962), [Clack and Myers](https://doi.org/10.1007/3-540-60675-0_51), and [Motara](https://doi.org/10.1145/3442481.3442510) remain explicitly limited to abstract/metadata access. Their sample sizes, precise designs, and specific misconception claims were not independently verified. Clack's 1995 conference year differs from its later online release. Miranda/Racket findings must retain their language labels.

Paz and Lapidot's *Emergence of automated assignment conceptions in a functional programming course* (DOI10.1145/1026487.1008044; conference DOI10.1145/1007996.1008044) was a promising negative-transfer lead, but no primary full text or verified sample/language was obtained. Chambers et al.'s *The function, and dysfunction, of information sources in learning functional programming* was also not independently accessed. Neither supplies report-level quantitative evidence in this track. The forward lead *Map, Filter, and Conquer* was not inspected.

Do not reuse the provisional, erroneous message describing missing recursion cases as “17% base case/11% recursive.” The inspected figure reports category counts of sessions; the corrected ledger contains no such learner percentages.

These notes add no browser-facing content or executable code. Validation is JSON parsing, source/access-label review, and whitespace checking; no learning or accessibility outcomes are inferred from repository tests.
