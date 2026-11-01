# Local code-reading tutor evaluation

Date: 2026-11-01. Task: improve the Warehouse Rover tutor through actual local
model chats, including a separate diagram generation and full-context recovery.
Model: the existing four-bit Qwen2.5-Coder 3B Instruct, real WebLLM inference in
Chrome on the development Mac laptop. Cached weights were reused; no new model
or large artifact was added to the repository. Raw transcripts remain temporary
local development artifacts, not student data or repository fixtures.

## Method and baseline

Rehearsed learner episodes covered an incorrect undo hypothesis, a correction
supported by source evidence, pressure for a complete specification, a missing
Python prerequisite, repeated difficulty, an explicit drawing request and stopping.
These were authored learner simulations. They reveal product/model failures, not
learning outcomes, retention, transfer or classroom effectiveness.

The initial freeform tutor contradicted itself about undo, wrote a requested
specification, invented the behavior of `history.pop()`, and copied a generic
syntax-card diagram. A second stuck turn became longer and exhausted its output
budget. The original chat also silently retained only the last exchange and cut
messages to 160 characters.

Concise question-only prompts reduced verbosity but repeated learner questions or
invented code conditions. A style example introduced a nonexistent loop. Putting
source in the system message falsely validated the misconception. A literal tool
example was copied into an unrelated response. These approaches were rejected.

## Initial changes and observed behavior

The initial drawing restriction described here was later removed after user
testing showed that it blocked useful requests, including class diagrams. See
the diagram follow-up below; the original observations remain historical evidence.

| Episode | Observation and response |
| --- | --- |
| Undo misconception | The model selected `undo_action` but used an invalid focus value (`state`). The app verified the function and displayed a prediction/evidence question without asserting backward movement. |
| Source-backed correction | The model again selected inspect rather than challenge. Repeat detection changed the displayed task to predicting a different input; it did not demand the same evidence again or claim mastery. |
| Request for a complete specification | The model selected `navigate`; the app displayed a source-reading question. No specification or implementation was shown. |
| Missing prerequisite | The model copied the entire resource-option list instead of choosing one item. The app offered the verified Python tutorial index, allowing the learner to choose a prerequisite or ask a TA. |
| Repeated difficulty | A repeated question became a different-input challenge, then offered a smaller task, prerequisite review or human help. Routing remains limited and generic. |
| Stop request | The model selected pause; the response acknowledged stopping without another question. |
| Diagram request | A dedicated request-generation prompt was needed; the combined move/tool prompt sometimes ignored an explicit visual request. The next generation invented call arguments. Source checks rejected those labels and retained the coaching question; only the verified caller/callee relationship was then passed between stages. In that trial, the next generation returned a simple graph with an unverified `commands` label. The app replaced it with `calls`, canonicalized aliases, and rendered the checked two-participant map with an accessible description/source disclosure. |
| Full context | Four 560-character turns succeeded, with reported input counts of 1,546, 1,696, 1,841 and 1,993 tokens. The fifth was rejected before output. The input draft and visible transcript remained, and the runtime stayed loaded. Start fresh context plus a learner-written recap succeeded at 1,465 input tokens without another model load. |

Normal final coaching turns in these rehearsals took roughly 7–17 seconds,
including source checking/model initialization where applicable. The successful two-generation
drawing trial took about 20 seconds. Other browser tests were running on the
same laptop: these are observed waits, not controlled performance benchmarks.
The constrained response architecture improves the assistance boundary; it does
not make this model a reliable assessor of reasoning.

## Architecture and limits

Warehouse Rover uses structured coaching selection and app-authored questions.
Python's AST supplies function/statement locations. Unknown functions and extra
answer fields are rejected; invalid statement focus falls back to the verified
function. Course links come from an app-owned catalog. The independent mission
permits only general reflection, prerequisite resources and pause.

Drawing is a bounded two-generation protocol. Both calls receive the complete
current source. Source mode now supports all seven renderer types without
requiring a learner-identified relationship or successful AST preflight. An
optional outline adds parsed declarations and call sites as guidance. Focused views and
checking source evidence are prompt recommendations. The model is asked to
ground diagrams in source, honor the requested type, and avoid writing a
specification; these pedagogical and semantic properties are not hard guarantees.
The general Python demo still has a freeform coach with prompt-based boundaries.

## Diagram follow-up

The old gate conflated learning support with assessment: students had to identify
a call before receiving a diagram, and every diagram was restricted to that
single call. It also prevented class diagrams altogether. This was an application
restriction, not missing source in the prompt. Removing it lets students request
an overview to orient themselves before choosing a source-reading question.

The drawing prompt includes ArchUML found-message notation (`o-> receiver: label`)
for an external sender. The accessible description identifies this as a message
from outside the diagram. A requested class view should reflect actual classes;
the model can briefly explain when procedural source has none and suggest another
view. Syntax/size checks, isolated rendering, SVG sanitization, cancellation and
the explicit context-recovery workflow remain in place. No model weights changed
for this drawing correction.

The reported request for `navigate` internals with ALT fragments exposed a second
problem: the 384-token drawing budget was too short. Drawing output now has a
1,024-token budget and the model context is 4,096 tokens. Input/context failures,
known output-budget exhaustion and rendering failures retain the draft; a
diagram-only failure no longer commits a generic coaching question as an answer.
Successful non-diagram coaching can still survive an optional drawing failure.

Actual cached 3B trials demonstrate the distinction between infrastructure and
answer quality. Before the budget change, generic class and found-message
requests exhausted 384 tokens. Afterward, the ALT request completed in about
28 seconds and included an ALT fragment, but invented a condition based on the
demo input and used incorrect participant references. A class request still
invented classes for procedural code; adding the parsed outline reduced one
run's repetition but did not correct that misconception. These are unresolved
3B quality failures, not proof of useful tutoring. The new 7B option has verified
artifact metadata and lifecycle tests, but was not downloaded or evaluated for
answer quality in these trials. Raw trial transcripts remain outside the repo.

Successful turns and all source/guidance remain complete until explicit reset.
No automated model summary or silent history trimming is used. Input rejection
and output exhaustion do not commit partial turns. Native wllama context shifting
is disabled. The pinned llama.cpp source maps ordinary capacity exhaustion to
`STOP_TYPE_LIMIT` and streaming `finish_reason: length`, which the chat rejects
([capacity branch](https://github.com/ggml-org/llama.cpp/blob/46ca246/tools/server/server-context.cpp#L1754-L1760),
[streaming mapping](https://github.com/ggml-org/llama.cpp/blob/46ca246/tools/server/server-task.cpp#L438-L474)).
That is source inspection; the native exhaustion rehearsal above used WebLLM.
The Rover source itself exceeds ONNX's conservative 768-token input cap; clearing
history cannot fix that engine limitation. Processor or compatible WebLLM is
needed for this tutorial's chat.

Model memory is now shared between tabs on the same site origin and browser
storage partition. Requests take turns, while transcripts and drafts stay with
their own chats. Closing the hosting tab interrupts an active turn explicitly;
it does not turn partial coaching or a partial drawing into a successful answer.
The next attempt reloads cached weights. A real cached 3B WebLLM check in two
Chrome tutorial tabs confirmed one inference worker, queued work and separate
completed responses, with no model-file requests. This validates memory sharing,
not improved tutoring quality or measured peak RAM.

## Verification and teaching follow-up

The initial implementation passed 157 focused unit tests and 79 Chrome/Firefox browser checks (77 existing/focused cases plus two source-map cases), including enabled interactive accessibility checks. Those counts describe the initial version, not the follow-up. The whole-site suite was not certified: an earlier broad run encountered missing dependencies/browser executables, sandbox restrictions and missing song assets.

The diagram, 7B and sharing follow-up passed 195 focused unit tests. Its combined
Chrome/Firefox run passed 111 of 112 cases; the remaining test expired its default
five-second assertion while Firefox was still performing real Python source
analysis. After aligning that assertion with the bounded wait used by the other
diagram tests, the affected case passed in both browsers. All 112 distinct cases
therefore have passing results, including interactive accessibility checks; a
second complete 112-case run was not performed after that test-only correction.
The sharing cases exercise real browser locks, channels, caches and workers with
the external inference adapter replaced. The separate real 3B trial above
checks that the vendor engine also works with the shared architecture.

Deterministic tests separately cover full-history/privacy boundaries, recognized
native errors, context/output rejection, parsed source targeting, tool schema,
requested diagram views without preparatory work, found messages, cancellation, optional drawing failure and
explicit recovery. Browser checks replace inference only; source parsing and UML
rendering are real. They exercise both themes, keyboard controls, resource links,
small panes, transfer restrictions and available download controls. Passing those
tests establishes the software contract, not model competence or WCAG compliance
of every unrelated site page.

Use a small student pilot before expanding the tutor's role. Ask learners to
record a prediction before requesting help, justify a conclusion with source
evidence, and complete the unfamiliar queue mission independently. Review whether
hints improve their next explanation, whether misconceptions persist, how often
students need repeated or rejected hints, and the time/access cost of local
inference. Include a later unaided explanation or transfer task. Keep tutor use
optional and preserve lesson/TA alternatives; do not gate completion on model
success or infer learning from satisfaction or generated-code test results.
