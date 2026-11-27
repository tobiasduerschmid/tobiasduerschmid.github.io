# Study tools for narrated lessons

The shared player supports **Pause and predict**, searchable review, and
question-specific review. The four UML lessons and Observer, State, Strategy,
and MVC also ship editable diagram exercises and paired design comparisons.
Use the same player and cue IDs for all these interactions.

## Learner behavior

- **Pause and predict** is enabled by default in player settings. After the
  prediction's speech and authored pause, playback waits for **Reveal
  explanation**. Seeking elsewhere clears the hold. Turning the mode off
  restores continuous playback through prediction cues. The reader hides the
  following explanation in a disclosure; print shows the answer. The standalone
  reader opens answers for printing and restores the reader's disclosure choices
  afterwards; dedicated print views open them on load.
- **Study tools** pauses playback. Its activity selector opens search/review,
  inspection, practice, or comparisons. Closing it leaves playback paused.
  Native input and button keys do not trigger media shortcuts in this panel.
- **Search and review** searches cue titles, speech, notes, and diagram text.
  Results jump to an exact cue, paused. **Review later** filters a session-local
  list. Viewed steps and answered check questions are separate indicators;
  neither is a claim of mastery.
- **Inspect diagram and code** connects each authored cue's `diagram_focus`
  and code `focus` lines to its explanation. Named buttons provide keyboard
  equivalents to selecting linked diagram labels or source lines. The current
  code language is respected. Unmapped elements do not invent an explanation.
- **Try this example** starts with an editable diagram from the running example.
  Preview draws the draft using ArchUML; it does not grade semantic correctness
  or execute code. A separate worked-solution disclosure contains a self-check
  rubric. Switching activities preserves drafts; reset affects only the selected
  exercise.
- **Compare designs** shows two authored cue frames and a change request. A
  writing field precedes the consequences disclosure. Explain both benefits
  and costs, including circumstances where a simpler design is adequate.
- Quiz feedback with authored metadata offers an exact explanation and a
  return to the same question/feedback. A fresh similar question is graded
  separately; it never replaces the original score. Other lessons retain their
  segment replay when no question-specific metadata is authored.

Drafts, reflections, marks, viewed steps, and answer counts last only while the
page is open. These tools create no browser storage entries. Existing editable
lesson notes remain the place to save writing across visits.

## Companion schema

`_data/explainers/<topic>_study.yml` is optional. The loader validates it against
the compiled story and original quizzes, then exports it as `entry.study` and
`data-narration-study`. It never enters the speech fingerprint.

```yaml
version: 1
reviews:
  roles: # Original quiz scene; list order matches original question order.
    - scene: roles
      cue: subject # Stable teaching cue ID, not a numeric offset.
      retry:
        question: Which role owns a newly registered recipient?
        options: [The Subject, The Observer interface, Another Observer]
        correct_index: 0
        explanation: The Subject owns its registration collection.
        option_feedback:
          1: The interface describes the notification operation.
          2: An Observer owns its reaction, not the other registrations.
exercises:
  - id: add-recipient
    title: Add another recipient
    scene: roles
    cue: subject
    prompt: Extend the diagram with another recipient that follows the same contract.
    type: class # class, sequence, state, or component
    starter: |
      @startuml
      interface Observer
      @enduml
    solution: |
      @startuml
      interface Observer
      class WordCount
      WordCount ..|> Observer
      @enduml
    checks:
      - The new recipient implements the notification contract.
comparisons:
  - id: concrete-or-contract
    title: Concrete widgets or a shared contract
    question: Which dependencies change when another recipient is added?
    before: {scene: conditions, cue: coupled, label: Concrete widget dependencies}
    after: {scene: roles, cue: subject, label: Registered recipients}
    consequences:
      - Registration lets another recipient join without changing the notification loop.
      - The design introduces a contract and registration lifecycle management.
```

These cue names illustrate the format; use real IDs from the target lesson.
Every quiz question needs exactly one review entry when a study companion is
present. Summary items point back to their specific teaching cues. Retry
questions use the same taught distinction in a fresh situation, with balanced,
shuffle-safe options and explanatory feedback. Preserve a meaningful design
decision in exercise starters and prompts; do not put the solution in visible
instructions. Keep rubrics honest about valid alternatives.

## Ownership and checks

- `scripts/narration/study.js` validates authored data and stable references.
- `js/narration-prediction.js` supplies prediction gates to the transport.
- `js/narration-quiz.js` owns question/retry presentation; the player owns jumps.
- `js/narration-study.js` owns session review/search/inspection state.
  Entering full screen closes and hides Study tools, leaving lesson navigation
  and playback available. The tools return on exit; session drafts are retained.
- `js/narration-practice.js` owns exercise drafts and comparisons.
- `js/narration-study-view.js` presents reader frames and diagram drafts.
- `_includes/narration-study*.html` and `css/narration-study.css` own markup and
  presentation. Reader/print practice uses the same authored material.

Run `node scripts/narration.js check`, the narration-spec/study unit tests, and
the study and prediction/review Playwright tests. Exercise every authored starter
and solution through the real renderer. Check summary-question review, keyboard
focus after inspection, language switching, empty searches, retained drafts,
opt-out/reveal/seek at prediction boundaries, mobile fullscreen in both themes,
and printed answers. Report the actual accessibility audit coverage.
