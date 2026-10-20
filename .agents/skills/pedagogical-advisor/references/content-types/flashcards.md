# Flashcards: optional hints that preserve the task

Use this guide when creating, revising, or reviewing `_data/flashcards/*.yml`, including cards embedded in SEBook chapters and combined course decks or served in SE Gym. These are project authoring guidelines, not a claim that the new hint feature has been measured to improve learning.

## Decide for each question

Read the actual question, answer, and explanation before choosing a hint. Identify the cognitive work being assessed and the easier concepts the learner is expected to know from the relevant SEBook chapter, earlier chapters, or tutorials. Inspect those prerequisite materials; do not infer familiarity merely from the topic name or difficulty label.

- **Use a hint when it opens a useful next step.** Cue a known principle, a representation, a tracing strategy, a boundary case, a comparison, or a small thought experiment. The learner must still apply it to obtain and justify the answer.
- **Omit the hint for pure basic retrieval when help would supply the target.** Bare definitions, acronyms, command/API names, syntax tokens, historical facts, and memorized lists usually belong here. A scenario wrapped around “which command?” can still be simple retrieval. Do not add a placeholder or a generic encouragement to fill the field.
- **Judge the work, not the label.** A `basic` prediction can benefit from a tracing cue; an `advanced` obscure-fact question may have no useful non-revealing hint. Neither difficulty nor Bloom metadata is an automatic selection rule.
- **Check the item first.** If a helpful hint requires untaught knowledge, assumes an ambiguous contract, or conceals an incorrect answer, surface the prerequisite/item issue. Do not repair it by revealing the solution through a hint.

## Write bounded help

Prefer one or two concise sentences naming a concrete action. Make the hint specific enough to reduce unproductive search without doing the central reasoning for the learner. Ground it in simpler, already taught concepts, rather than introducing a more advanced technique than the question requires.

For code, suggest tracking bindings, object identity, calls, scope, or the next executed statement without printing the output or supplying the completed code. For design, suggest tracing a dependency, changing one requirement, or testing a contract without naming the sought pattern. For construction tasks, suggest a decomposition or counterexample without providing the full command, regex, or algorithm.

Do not copy or lightly paraphrase `answer:` or `explanation:`. Do not name a term the card asks students to retrieve, provide the decisive fact for a yes/no question, eliminate all meaningful alternatives, or hand over all intermediate results. Avoid “think carefully,” “remember the chapter,” or repeating the prompt without an actionable cue. Keep source locators and instructor rationale in review notes, not in student hint text. Avoid links to the exact worked solution.

Examples:

| Card target | Suitable decision |
| --- | --- |
| Recall the regex token for one or more repetitions | Omit: a symbol clue would largely reveal the target. |
| Construct a regex accepting exactly 3 or 6 hex digits | Cue separation of the character set from permitted lengths; ask the learner to reject a 4-digit counterexample. Do not supply the regex. |
| Predict mutation versus rebinding | Suggest drawing variable-to-object references and updating them statement by statement. Do not draw the final graph or state the output. |
| Diagnose a brittle test | Suggest imagining a behavior-preserving internal refactor and asking whether the test should still pass. Leave diagnosis and repair to the learner. |

## Store and render

Add an optional, non-empty Markdown string named `hint` to the individual source card:

```yaml
cards:
  - id: stable-existing-id
    question: "Predict the result of this object update..."
    hint: >-
      Draw which object each name refers to before the call.
      Follow assignments one at a time and distinguish changes to a name from changes to its object.
    answer: "The answer belongs here, separate from the hint."
    explanation: "The full explanation belongs here."
```

Omit `hint` entirely when it is not useful. Keep existing IDs, question/answer content, and difficulty metadata stable when only adding hints. Composite decks inherit hints from source cards; do not duplicate cards to attach hints. Plain prose and inline code generally suffice; do not add diagrams or complex markup merely for a hint.

The shared flashcard include and SE Gym show **Hint** only for cards with authored hints. It expands independently of **Show Answer**, can be collapsed, does not assess or advance the card, and resets for a new attempt, review, restart, or resumed workout. Hints are optional assistance; do not infer unaided mastery from an assisted response. Do not change grading or persistence to penalize help use without a separate product decision. Print shows authored hints with a Hint label alongside the existing printed study material.

## Review before delivery

For each included hint, answer:

1. Which inspected prerequisite does it activate?
2. What useful action can a stuck learner take after reading it?
3. What substantive reasoning or retrieval must the learner still do?
4. Could the learner answer by copying the hint or exploiting a giveaway?
5. Does it remain correct for the question's stated assumptions?

Remove or revise a hint that fails these checks. For a large bank, keep a compact review record of source material, selected card IDs, and reasons for omitted categories; review every question in the requested scope, not only cards labeled difficult. Do not use a target percentage or automatically generate template hints by difficulty or question wording.

Validate YAML, preserve source card IDs and non-hint fields, and inspect Markdown rendering. Runtime changes also require chapter/composite/Gym coverage, missing-hint behavior, independent answer and scoring behavior, keyboard/ARIA disclosure state, reset behavior, light/dark readability, narrow-screen reflow, and coherent print. Follow the repository accessibility and test-design skills for those checks. Automated checks cannot establish pedagogical quality or full manual accessibility conformance.
