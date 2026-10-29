# Narrated diagram case studies

`_includes/narrated-case-study.html` presents a case as diagram snapshots, short
narration cues, and decisions. `js/narrated-case-study.js` adapts the existing
`NarratedExplainer` media transport and `SebookQuiz` question renderer; it does
not introduce another playback clock, grader, or persistence mechanism.

Use a static SEBook page with `static_uml: true`, load
`css/narrated-explainer.css` and `css/narrated-case-study.css`, then load
`css/print-light.css` last. Insert:

```liquid
{% include narrated-case-study.html topic='therac25' %}
```

The include reads `_data/explainers/<topic>.yml` and the matching
`<topic>_timing.json` produced by `scripts/render-explainer-narration.py`.
Generate audio after the storyboard is final: the manifest's source hash must
match the complete YAML file. Load the page through Jekyll so audio seeking
supports byte-range requests.

## Storyboard contract

```yaml
title: A case-study title
description: What the learner will investigate.
audio: /assets/audio/example.mp3
captions: /assets/narration/example.vtt
script: /assets/narration/example.txt
voice: af_heart
speed: 0.95
pronunciations: {}
diagrams:
  first_evidence:
    type: component # ArchUML component, sequence, or state
    label: Short accessible figure name
    description: Complete textual reading of the relationships and evidence.
    caption: What this snapshot establishes, with any scope limits.
    source: |
      @startuml
      component "Input" as Input
      component "Shared state" as State
      Input --> State : records selection
      @enduml
scenes:
  - id: observation
    label: Observe
    title: What can we infer from the symptom?
    purpose: Separate an observation from an explanation.
    evidence: Teaching reconstruction based on published history.
    sources:
      - title: Descriptive source title
        url: https://example.org/source
    diagram: first_evidence
    cues:
      - text: The spoken narration, also shown verbatim as text.
        step: Inspect the observation
        note: A short, complementary interpretation.
        visual: The evidence currently shown in the diagram.
        pause_after: 0.55
      - text: Which observation would distinguish the explanations?
        step: Make a prediction
        note: Choose a test before seeing its result.
        visual: The same evidence, without the next result.
        prediction: true
    checkpoint:
      question: Which action gives discriminating evidence?
      options:
        - Reproduce the relevant sequence while varying one condition.
        - Treat one successful attempt as proof of correctness.
      correct_index: 0
      explanation: Explain why the action answers the causal question.
      option_feedback:
        1: One successful attempt does not rule out a timing-dependent failure.
```

`cue.diagram` may override `scene.diagram`. Every cue must resolve to one
diagram. A scene may omit a checkpoint; narration then continues through the
boundary. `scene.takeaway` is optional and is hidden on a prediction cue. Avoid
putting a solution in *any* earlier cue, caption, note, or takeaway of the scene
that asks the question. Put the next evidence in the next scene, after the
decision. Source links and evidence-status text are shown near each scene's
figure and repeated in the readable version.

Checkpoints are single-answer questions using the existing quiz fields. Provide
feedback for each incorrect option. Avoid referring to option letters: the quiz
engine shuffles choices. All prose fields above are plain text in the reading
version; do not depend on inline Markdown formatting. Diagram sources are
authoring data, never student code exercises.

## Interaction contract

- **Next step** and **Previous step** pause audio and move one cue at a time.
  At the last cue, **Choose next action** opens that scene's decision. The
  next scene stays hidden until explicit continuation or review navigation.
- During playback, each checkpoint pauses the media clock. An incorrect answer
  shows its own feedback and the explanation. The existing quiz supports retry,
  deliberate continuation, or an explicitly labeled skip. Continuing resumes
  narration only if playback opened the checkpoint; silent study stays silent.
- Scene selection, the seek slider, and previous/next scene controls remain
  available for review. This is guided practice, not a locked assessment.
- **Review this scene** returns to the evidence without discarding the current
  answer feedback. No new custom key bindings are added; the shared quiz's
  documented keys work only while it has focus.
- **Read at my own pace** pauses audio and opens the full transcript. It warns
  that later findings appear there. Answers require opening a native details
  element. Without JavaScript, the full reading version and native audio player
  remain available. Printing shows the full reading version, including answers,
  in light mode. Printing restores the earlier disclosure state afterward.

The reading include is the source of static ArchUML geometry for the player.
The adapter clones the current cue's figure and rewrites its identifiers, so
seeking does not require replaying prior frames. Only the visible cue changes;
there are no timed transitions beyond the existing audio clock. Reduced-motion
users therefore receive the same evidence and controls.

## Verification

After building the site and generating narration, run the focused case-study
browser tests with interactive accessibility checks:

```sh
A11Y_INTERACTIVE_CHECKS=1 PLAYWRIGHT_SERVE_BUILT_SITE=1 npx playwright test tests/narrated-case-study.spec.js --project=chromium
```

Also run the narration-source/timing tests for the topic and the scoped complete
page audit. Inspect a component, sequence, and state scene at normal text size
on desktop and a narrow viewport in both themes. Check the current narration,
decision feedback, focus order, diagram descriptions, no-JavaScript reading,
and print output. Keep screenshots and reports outside the repository.
