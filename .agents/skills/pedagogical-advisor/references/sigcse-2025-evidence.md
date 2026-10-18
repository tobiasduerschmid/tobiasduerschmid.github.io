# SIGCSE TS 2025: selected evidence and teaching moves

Checked **2026-09-05**. These four additions supplement CS-AI-008–010 in `references/cs-ai-evidence-2026.md`; they do not replace those studies. All four were verified as **SIGCSE Technical Symposium 2025 Papers**, not nearby CHI, ICER, or ITiCSE contributions. This is targeted coverage, not a systematic review. B/C/D are claim-specific editorial judgments, as defined in `SKILL.md`.

## SIG25-01 — TA review of AI feedback needs its own verification

**Ahmed, Sahai, Leong, & Karkare (2025). Feasibility Study of Augmenting Teaching Assistants with AI for CS1 Programming Feedback.** [DOI](https://doi.org/10.1145/3641554.3701972); [full author PDF](https://www.comp.nus.edu.sg/~bleong/publications/sigcse25-AI-augmented%20TAs.pdf).

- **Design/access:** full PDF §§3–5 and Table 1 inspected. Randomized intervention in one three-hour C lab; 185 students enrolled in the study. Actual Q2 help-seekers: 5 default-AI-assisted, 11 Socratic-AI-assisted, 13 manual-TA. Non-help-seekers were self-selected; this was not a complete AI × task controlled trial.
- **Result:** manual-TA help required fewer submission attempts than default hybrid help (p=.012); Socratic hybrid service was slower than manual service (p=.03). TAs retained erroneous AI content despite review opportunities. No independent learning or retention test.
- **Interpretation:** B for observed feedback-process failures; C for generalization; D for ranking learning benefits. Small help-seeking groups, one lab, GPT-4T, possible manual-group contamination, and answer disclosure limit comparisons. Completion speed does not establish learning. Human review must produce evidence of checking, not merely an approval click.

## SIG25-02 — Assisted grades and independent capability require different evidence

**Ramirez Osorio, Zavaleta Bernuy, Simion, & Liut (2025). Understanding the Impact of Using Generative AI Tools in a Database Course.** [DOI](https://doi.org/10.1145/3641554.3701785); [official abstract](https://sigcse2025.sigcse.org/details/sigcse-ts-2025-Papers/3/Understanding-the-Impact-of-Using-Generative-AI-Tools-in-a-Database-Course); [author-uploaded full text](https://www.researchgate.net/publication/389105528_Understanding_the_Impact_of_Using_Generative_AI_Tools_in_a_Database_Course).

- **Design/access:** author-uploaded text, §§3–6/Table 1, inspected. Observational study in a third-year databases course: 226 enrolled; 120 reported ChatGPT, 12 another GenAI, 71 none, and 23 did not respond. AI was permitted for one deadlock-prevention question.
- **Result:** pooled AI users scored higher on that question (p=.005). Differences on the remaining assignment and course grades were **not statistically significant**; the small other-GenAI group had higher course means, unlike the ChatGPT group.
- **Interpretation:** B for bounded associations; D for causal learning benefit or harm. Self-selection, nonanonymous self-report, one question, and missing responses matter. Course grades are not a clean independent transfer measure. Do not repeat the abstract's broad lower-performance language as demonstrated learning loss.

## SIG25-03 — Distractors are an instructional choice, not a proven upgrade

**Poulsen, Chen, Gertner, Cosman, West, & Herman (2025). Measuring the Impact of Distractors on Student Learning Gains while Using Proof Blocks.** [DOI](https://doi.org/10.1145/3641554.3701787); [official abstract](https://sigcse2025.sigcse.org/details/sigcse-ts-2025-Papers/5/Measuring-the-Impact-of-Distractors-on-Student-Learning-Gains-while-Using-Proof-Bloc); [inspected author preprint](https://arxiv.org/html/2311.00792v1).

- **Design/access:** official 2025 abstract plus 2023-labeled author preprint §§3–6; final-version methods not reconciled. Three-arm randomized lab study: induction Proof Blocks with distractors, without distractors, or off-topic blocks; all read induction material. Preprint reports 253 eligible consenting starters and 201 delayed-test completers (66/72/63 respectively).
- **Result:** one-week proof-writing posttest means favored distractors, then no distractors, then off-topic practice; no between-group difference was statistically significant.
- **Interpretation:** C for an inconclusive comparison; D for superiority or equivalence. Repeated identical test problems, attrition, one setting, and version uncertainty constrain inference. The test assesses delayed proof writing but not novel far transfer. Do not prescribe more distractors merely to make practice harder, or describe the numerical ordering as a demonstrated benefit.

## SIG25-04 — AI familiarity can obscure what a learner understands

**Ebert & Kramarczuk (2025). Leveraging Undergraduate Perspectives to Redefine AI Literacy.** [DOI](https://doi.org/10.1145/3641554.3701916); [official abstract](https://sigcse2025.sigcse.org/details/sigcse-ts-2025-Papers/55/Leveraging-Undergraduate-Perspectives-to-Redefine-AI-Literacy).

- **Design/access:** official abstract inspected; ACM full text returned 403. Explanatory sequential mixed-methods study: computing-undergraduate AI-literacy survey followed by focus groups. Sample, instruments, and analysis details not verified here.
- **Result:** authors describe a mismatch between familiarity with AI applications and understanding of AI principles, which the survey conflated. They recommend assessing confidence and competence separately.
- **Interpretation:** C for a curricular assessment concern; D for prevalence estimates, validated diagnostic cutoffs, or causal teaching benefits. Do not claim this study established a reliable performance test or improved learning through a particular curriculum. Use student perspectives to choose useful tasks; inspect actual reasoning and verification behavior before inferring mastery from self-ratings.

## Practical implementation moves — original design synthesis

These are proposed teaching routines informed by the studies, not experimentally validated packages. Durations are planning estimates. Pair them with the relevant task workflow and adapt to prerequisites and access.

1. **TA feedback clinic (SIG25-01; 20 minutes).** Supply three anonymized buggy submissions, verified failing inputs, and draft AI feedback containing a plausible error. TAs first diagnose independently, then keep/edit/reject each feedback claim with a test or trace. Release one actionable next step. Debrief missed errors; sample real feedback next week. Track verification errors and service time separately from students' subsequent unaided debugging.
2. **Database assignment repair (SIG25-02).** Add an AI-assisted comparison of deadlock-prevention strategies requiring one verified schedule example and an explicit tradeoff. Follow with an individual, fresh schedule under changed assumptions; students explain their decision. Grade assisted evaluation and independent reasoning separately. Provide a common saved AI response for students without tool access. Compare with prior preparation before interpreting group differences.
3. **Distractor decision (SIG25-03).** Choose a documented misconception, such as assuming the induction claim before establishing the inductive step. Add at most one plausible erroneous line initially; ask students why it fails and supply corrective feedback. If confusion overwhelms reasoning, remove the distractor and model the distinction. Check a new proof-writing task later; neither puzzle difficulty nor block-order accuracy is sufficient evidence of transfer.
4. **AI-literacy diagnostic (SIG25-04; 10 minutes).** Collect confidence separately for operating a tool, explaining its limitations, and checking its output. Give a short plausible but flawed answer; require a verification plan and an accept/revise/reject decision grounded in supplied evidence. Use mismatches to choose coaching, not to label students. Repeat with a new domain example after instruction; keep tool fluency separate from judgment.

## Search log and access limits

Actual searches on 2026-09-05:

| Service | Query/action | Outcome |
|---|---|---|
| SciSpace | `Which empirical papers at the 2025 ACM SIGCSE Technical Symposium measure how generative AI affects programming students' independent learning, debugging, or assessment performance?` | Ten semantic results; venue/year precision was poor, including adjacent venues and later 2025 records. Used for discovery only; none counted as verified SIGCSE evidence merely from retrieval. |
| SciSpace | `What did the SIGCSE 2025 study 'Feasibility Study of Augmenting Teaching Assistants with AI for CS1 Programming Feedback' find about student task performance and human review of AI feedback?` | Ten related results; exact target was not retrieved. Primary author PDF supplied evidence. |
| Web engine 2 | `site:sigcse2025.sigcse.org "Papers" "learning" "AI"`; `site:sigcse2025.sigcse.org "Papers" "Parsons"`; `site:sigcse2025.sigcse.org "Papers" "randomized"` | Official venue discovery; screened relevance and contribution type. |
| Web engine 2 | `"Feasibility Study of Augmenting Teaching Assistants" pdf`; `"Measuring the Impact of Distractors" pdf`; `"Understanding the Impact of Using Generative AI Tools" pdf` | Located TA author PDF and Proof Blocks author preprint; database full text required follow-up. |
| Web engine 2 | `"Leveraging Undergraduate Perspectives" pdf`; `"Understanding the Impact" "Database Course" Ramirez pdf` | Found literacy abstract and database author upload. No literacy full text. |
| Web engine 1 | `"Leveraging Undergraduate Perspectives to Redefine AI Literacy"` | Verified publisher DOI and official venue; full methods remained inaccessible. |
| Web engine 2 | `"3701787" pdf`; `"Proof Blocks" "Distractors" "201"` | Poor retrieval; did not resolve final Proof Blocks methods. Used official 2025 abstract plus explicitly labeled preprint. |
| Primary-source reading | TA author PDF §§3–5; database author upload §§3–6/Table 1; Proof Blocks preprint §§3–6 and official venue abstract; AI-literacy official abstract | Actual methods/outcome distinctions preserved above. No pooled effects, exhaustive counts, or full-text claims for inaccessible papers. |

Maintain these cautions when citing: TA lab enrollment exceeds analyzed help-seeking groups; database assisted-score association is not a causal learning estimate; Proof Blocks null differences are not equivalence; literacy survey findings do not validate a new diagnostic. Prioritize full final methods when a consequential adoption decision depends on unresolved details.
