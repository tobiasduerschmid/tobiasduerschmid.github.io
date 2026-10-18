# Research coverage and provenance for version 2

Update date: 2026-09-05. This is a focused teaching-skill expansion, not an exhaustive systematic review. The package retains its previous evidence base and adds inspected-source layers, practical workflows, and behavioral checks. A date cutoff means the search was performed then; it does not mean every earlier paper was retrieved or every older claim was revalidated.

## Project corpus

All **16 supplied PDFs** were text-extracted and selectively inspected for identity, relevant chapters, and actionable passages. Exact 1-based attachment page references and inspection scope are recorded in:

- `references/project-foundations-2026.md`: PF01–PF08, NRC, Dehaene, Freeman, Ambrose, Make It Stick, Hattie, Davis, Dunlosky.
- `references/project-extended-2026.md`: sources 09–16, cognitive load, competence/motivation, constructivist classrooms, GenAI in CS, Woolfolk, Bain, Sawyer, Spitzer.

These are original passage-level syntheses, not full-book reproductions or claims of complete reading. No extracted book text or supplied PDFs are distributed inside the skill. The sixteenth source, Spitzer, is newly added to the original fifteen-source map. Historical neuroscience and educational frameworks do not serve as direct AI-intervention efficacy evidence. Books that cite the same studies are not independent replications.

## External evidence added

| Evidence file | Coverage | Important access limits |
|---|---|---|
| `references/cs-ai-evidence-2026.md` | 14 selected studies, 2023–2026: SIGCSE, ICER, CHI, IUI, Koli Calling, Learning @ Scale, FSE; includes 3 SIGCSE 2026 contributions | Some official abstracts only; replay-reflection methods use a 2025 author preprint; no exhaustive 2026 proceedings screening |
| `references/ai-learning-evidence-2026.md` | 8 empirical study lineages plus UNESCO competency framework, 2024–2026; positive, null, and adverse outcomes | Some publisher abstracts only, prereview working papers and inaccessible supplements; version-specific samples retained |
| `references/sigcse-2024-evidence.md` | 4 additional SIGCSE TS 2024 papers: contextual error messages, tiered feedback, CS50 assistant, proof-learning sequence | Two full author PDFs; two official abstracts with missing methods stated |
| `references/sigcse-2025-evidence.md` | 4 additional SIGCSE TS 2025 papers: TA augmentation, databases, Proof Blocks distractors, AI literacy | Two full texts; one official abstract plus earlier author preprint with version uncertainty; one abstract only |
| `references/cs-review-evidence-2026.md` | 6 selected additional reports from the supplied AI–CS review: flipped preparation, teachable agents, ICER comparisons, pairing, database agents | One institutional abstract; five targeted full texts/manuscripts, including unreconciled final/preprint methods and reported internal conflicts |
| `references/review-reliability-2026.md` | 3 evidence cards: CS1 performance/learning, historical help seeking, STEM synthesis; plus 1 retraction notice | CS1 institutional abstract/report; targeted help-seeking and accepted-manuscript passages; current publisher notice |
| `references/computing-foundations.md` | 3 complementary sources: CS1 subgoals, PRIMM, Parsons review | Parsons full methods not appraised; older non-AI evidence must not be sold as direct evidence for AI adaptations |

These are **43 evidence/source cards**, including frameworks/reviews and preprints as explicitly labeled, plus **one separate integrity notice**; not 43 replicated randomized interventions. Source files contain persistent URLs, study design, population, comparison, outcome, interpretation limits, and actual search actions. Do not add their effect estimates or count preprint/publication versions as independent studies.

Conference-year coverage is **5 selected SIGCSE TS 2024 papers** (CS-AI-005 plus SIG24-01–04), **7 selected SIGCSE TS 2025 papers** (CS-AI-008–010 plus SIG25-01–04), and **3 selected SIGCSE TS 2026 contributions** (CS-AI-011–013). Publication venue/year is distinguished from preprint and indexing dates. The two new supplements include eight original implementation moves; these are proposals rather than validated intervention packages.

## Supplied literature-review integration (version 2.2)

Inspected `AI_CS_Learning_Evidence_Package.zip`: its narrative synthesis, canonical JSON database, bibliography/access information, scope, and search/screening-count documentation. The mapping in `references/literature-review-crosswalk.md` covers all 43 review records: 15 reused cards, 9 selected research additions, 18 background/design/discovery or hold records, and 1 retraction notice. These disposition counts describe the supplied review only; they are separate from the total evidence-card count above. The raw ZIP and third-party full papers are not bundled in the skill.

The update verified selected new claims against primary sources, without claiming to rerun the review's searches or freshly read all originals. It preserves better existing full-text appraisals where the review relied on abstracts, notably the database-course grade comparison. Source-specific new access and actual retrieval actions appear in the two new evidence files. The companion CHI/Koli reports sharing a participant cohort remain linked, and reviews are not counted as independent replications of their included trials. Secondary-only leads remain visibly limited and linked for later retrieval.

Five selectable routines in `procedures/20_ai-learning-support-and-pilots.md` translate the findings into adaptive help, student explanations to agents, peer/AI roles, implementation checks, and local evaluation. Their sequences, prompts, examples, and timing are original design choices. They do not inherit causal validation from the studies motivating them.

## Services and fallback

- **Sider Scholar:** used successfully for three initial targeted academic discovery queries and two SIGCSE 2024 follow-ups; selected DOI lookups failed, prompting primary-source follow-up.
- **SciSpace:** used for two initial broad intervention/competency searches, a targeted publication follow-up, and two SIGCSE 2025 follow-ups.
- **Elicit:** attempted; connected account denied API access. No Elicit results are claimed.
- **Web:** primary publisher, author repository, institutional, official conference, and working-paper records verified discoveries. Stronger search was used to fill primary-source/recency gaps. Metadata and index “peer-reviewed” labels did not override the inspected document's status.

The query strings, windows, and retrieval limits are in the corresponding evidence files. Searches were targeted, so no PRISMA flow, exhaustive screening denominator, pooled estimate, or publication-bias assessment is claimed. Unavailable texts were not replaced by invented sample sizes or causal claims.

## Changes in evidence interpretation

- Separate assisted production, independent performance, delayed retention, transfer, self-report, and material quality.
- Guarded help can mitigate an observed harm without demonstrating a positive independent learning effect.
- Promising positive AI tutoring results concern instructional bundles with prepared content, interfaces, pacing, and context; bare-chatbot effects are not interchangeable.
- Include contrary/null findings. A nonsignificant result is not equivalence; significance in one subgroup and not another does not prove an interaction.
- Keep advisor-designed recipes, mnemonics, timings, rubrics, and thresholds visibly distinct from validated frameworks and studied interventions.
- Treat current model capabilities, policy, accessibility standards, and institutional rules as needing current verification when relevant.

## Maintenance priorities

Prioritize verified full methods for abstract-only studies; targeted ICER 2026, ITiCSE and TOCE interventions; multi-institution replications; delayed independent transfer; outcomes for less-prepared learners; costs/access and feedback fidelity; and reproducible evidence about AI-assisted requirements, architecture, and testing education. Search new negative findings and corrections as well as positive reports. Replace a weaker source with a stronger version only after checking what actually changed.

Structural file checks and sampled behavioral evaluations are documented in `evals/validation-2026-09-05.md`. They support package integrity and limited demonstrated behavior, not a guarantee that any agent will be universally expert or correct.
