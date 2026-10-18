# Validation record — 2026-09-05

This records limited observed checks, not universal reliability or proof of improved student learning.

## Behavioral forward tasks

Two fresh-context agents received the skill location and realistic teaching requests, without the author's intended answer or diagnosis. Neither was asked to repeat an expected output. They read the skill and applicable supporting resources and produced usable answers; their outputs were reviewed by the package author.

| Task | Observed result | Judgment and limits |
|---|---|---|
| Repair a supplied five-slide testing lesson, 180 students, 50 minutes, two TAs, no extra marking | Preserved five-slide order; replaced correctness overclaim; produced exact slide text, instructor timings, individual/group work, boundary-test exercise and correct key; independent exit task; sampled live checks and self-correction | Meets sampled acceptance criteria. The agent reported executed example checks. Input was text, so this was not a PPTX rendering test or real classroom trial. |
| Respond to proposal to require AI everywhere, remove tracing, grade only apps; evaluate universal “double learning” claim | Recommended selective assistance and retained tracing; supplied a coherent 30-minute activity, correct trace/change/test keys, assisted/independent criteria, accessible alternatives, delayed sample, and balanced study table with outcome/version limits | Meets sampled acceptance criteria. Timings/weights were labeled design choices. Evidence/subject content were checked to the accessible-source scope; no actual student-learning outcome was collected. |

No claim is made that all 46 stored behavioral prompts were executed. The 30 original and 16 additional cases remain a future regression resource. Review judgments are editorial, not psychometrically validated scores.

## Independent worked-example review

A separate agent reviewed the requirements/design/testing reservation mini-unit. Review found undefined failed-request replay semantics, a 27-versus-25-minute discrepancy, and ambiguous request identity in a concurrency test. Repairs define success-only atomic binding, rejection/retry semantics, preserved successful identity after cancellation, distinct-ID competition versus same-ID replay, and consistent timings. The author checked a reference state model; concurrency expectations were reviewed logically, not executed under concurrent load. Each session totals 75 minutes and outside work totals 95 minutes. This is a classroom design example, not production-ready reservation software.

## Utility and structure checks

- Skill frontmatter validator passed on the actual edited personal-skill directory.
- Twelve alignment-utility regression tests passed, covering policy-text false assurance, scoped independent evidence, duplicate IDs, malformed input, and CLI behavior.
- Updated sample produces zero critical findings and zero warnings; one keyword suggestion remains. This is structural lint of declared plans, not evidence of assessment validity.
- The utility maintainer validated schema syntax and sample conformance, including whitespace-only observation rejection.
- Package validation checks files, JSON/JSONL, YAML, local links, manifest, and hashes. Final strict validation passed for 129 files with zero warnings. No full behavioral guarantee follows from structural success. Installation normalizes UI metadata and regenerates its icon; those two managed files remain in the manifest but are excluded from content checksums.

## Source and format scope

All 16 supplied PDFs received identity and targeted passage inspection with 1-based attachment locators; full-book reading is not claimed. The extended-corpus references were checked for page-number bounds. External ledgers record abstract-only and other retrieval limits. No copyrighted full PDFs or extracted book text are packaged. Elicit API access was unavailable; Sider Scholar and SciSpace were used and primary records checked.

The package has no newly rendered PPTX, DOCX, or PDF deliverable. Artifact-editing workflows are instructions for future use with available file tools, not evidence that every format has been executed in this update.

## Version 2.1.0 focused SIGCSE follow-up

- Added eight source cards and eight explicitly original implementation moves; targeted coverage is five SIGCSE TS 2024 and seven SIGCSE TS 2025 papers when existing cards are included once.
- A separate reviewer checked the two supplements for internal consistency, venue/year accounting, denominator distinctions, evidence calibration, and the boundary between study results and proposed adaptations; no material defect was found. This review was not a new full-text replication or systematic proceedings review.
- Connected the additions to the main task router, computing teaching decisions, evidence-update workflow, source map, and coverage records. Preserved the Proof Blocks final-publication versus inspected-preprint limitation.
- Skill frontmatter and strict package validation passed for 131 files with zero warnings. Changes are references, routing, teaching guidance, and metadata; the earlier behavioral tasks and 12 utility tests were not rerun for this follow-up.

## Version 2.2.0 supplied-review integration

- Reconciled every review ID 1–43 exactly once: 15 reused reports, nine selected research additions, 18 background/design/hold leads, and one integrity notice. These are review dispositions, not independent-trial counts.
- Checked selected primary sources with actual access recorded. Preserved the stronger existing database-course appraisal; flagged inconsistent AI-versus-human performance reporting in Fan et al.; retained the distinction between absolute delayed scores and a drop from assisted practice.
- Reviewed five original teaching routines for usable prompts, decision branches, answer criteria, and limits. Corrected a local workflow link and stated the nonempty-interval prerequisite in the overlap example. No new utility code or schemas were changed.
- Frontmatter validation and strict package validation passed for 135 files with zero warnings; directory counts and review-ID coverage were checked. The earlier 12 utility tests and full stored behavioral suite were not rerun.

One fresh-context forward task used the skill to design a 40-minute CS1 subset-generation lab for 120 students/two TAs and interpret supplied assisted/delayed group means. The saved answer was reviewed: its schedule totaled 40 minutes; student instructions and instructor keys were separated; it supplied adaptive rescue, an explanation-to-agent activity, correct aliasing/state/restoration criteria, independent checks, and a bounded comparison plan. It correctly distinguished a 20-point assisted-to-delayed drop from a two-point delayed group difference and did not infer forgetting, harm, or equivalence from means alone. A separate content check reported executed subset/size-filter examples against combinations for input lengths 0–6. Burden estimates and classroom effects were not tested; this was one text-based scenario, not a rendered artifact or a real learner trial.
