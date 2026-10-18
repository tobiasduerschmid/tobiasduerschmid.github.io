# Evaluation Suite

The eval suite checks whether an assistant using this package behaves like an evidence-calibrated pedagogical advisor rather than a generic content generator.

## Files
- `test_prompts.jsonl` — representative tasks and adversarial requests.
- `expected_behaviors.md` — cross-case behavioral requirements.
- `red_team_cases.md` — failure patterns and probes.
- `scoring_rubric.md` — 0–4 scoring dimensions.

## Suggested use
1. Run each prompt in a fresh or controlled context with the skill loaded.
2. Save the response.
3. Score it with `scoring_rubric.md`.
4. Check required and prohibited behaviors from the JSONL record.
5. Review low-scoring clusters by task type, not only average score.

A response can be polished and still fail if it lacks alignment, learner diagnosis, evidence calibration, feasible workload, or a defensible assessment inference.
