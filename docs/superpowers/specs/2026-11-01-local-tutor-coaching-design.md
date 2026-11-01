# Local tutor coaching and context recovery

The Warehouse Rover tutorial asks learners to recover behavior from source and
write their own specification. The local Qwen2.5-Coder 3B tutor must support that
reasoning without writing the specification. This work responds to the user's
request to evaluate real conversations, improve pedagogy, handle full context,
and make diagram drawing a separate model generation requested like a tool.

## Observed baseline

Real WebLLM chats on the development laptop copied the generic syntax-card
diagram, contradicted themselves about undo, supplied a requested specification,
and invented a false trace when the learner lacked a prerequisite. The second
stuck turn exhausted its output allowance instead of simplifying the task.
Separately, the architecture silently retained only the last exchange and cut
each message to 160 characters. These are simulated learner episodes, not
observations of student learning.

## Approaches and decision

Prompt-only changes are small but cannot repair silently lost conversation or
separate diagram work. Automatic summarization could retain more turns, but this
small model could turn incorrect advice into a persistent summary and adds
latency. Further trials showed that prompt changes alone still invented source conditions.
The implementation therefore uses structured move selection for Warehouse Rover:
Python AST checks source targets and authored questions replace freeform behavioral
claims. Complete conversation turns, an explicit learner-written recap at a context
boundary, and a bounded drawing stage complete the architecture. This is a reversible engineering choice within the
user's requested improvements, not a user selection among surveyed alternatives.

## Behavior

- In source mode the model selects inspect, contrast, challenge, resource, reflect
  or pause. App-authored questions refer only to parsed source locations. An invalid
  focus falls back to the verified function; unknown functions/answer fields are
  rejected. Repeated questions change to a different-input challenge or resource
  choice. This does not grade understanding or guarantee helpful routing.
- Independent transfer permits only reflection, resources and pause.
- Main prompts contain no ArchUML example. A validated `draw_diagram` request
  triggers one second generation with the relevant grammar. Source mode requires
  an explicit visual request plus one learner-identified, AST-verified direct call.
  Only its two-participant sequence with a `calls` arrow is accepted; aliases are
  canonicalized before disclosure/history. Model arrow labels are replaced with the fixed label `calls`.
  General mode retains all supported types with prompt-based semantic boundaries.
- Complete successful exchanges remain in memory. Source files and instructor
  guidance are never clipped. No invented summary or silent conversation reset.
- The fixed 2048-token model context and ONNX 768-token input ceiling remain.
  Native validation handles exact limits; no approximate token meter is claimed.
  Disable wllama context shifting. On input or output/context exhaustion preserve
  the transcript and unsent question, show an actionable explanation, and offer
  an explicit fresh context with the learner's own recap. Keep source/guidance.
- A failed optional diagram must leave the coach's useful text available. Only
  complete valid diagram output renders; a second failure does not trigger an
  unbounded repair loop. Stop/reset/navigation invalidate both stages.

## Constraints and evidence

Same model, engines, memory allocation and download consent; no large repository
assets, extra inference service, permanent chat/profile storage or grading gate.
Do not change specification generation or conceptual grading prompts. Keep
paragraph-size controls, keyboard access, both themes and existing print behavior.
Tests verify context integrity, tool dispatch, failure/cancellation and UI recovery;
real chats separately evaluate answer boundaries, accuracy, adaptation and burden.
Report remaining model failures candidly. No simulated dialogue establishes learning
gains, retention or transfer; those require a student pilot.
