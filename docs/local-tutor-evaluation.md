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

## Changes and observed behavior

| Episode | Observation and response |
| --- | --- |
| Undo misconception | The model selected `undo_action` but used an invalid focus value (`state`). The app verified the function and displayed a prediction/evidence question without asserting backward movement. |
| Source-backed correction | The model again selected inspect rather than challenge. Repeat detection changed the displayed task to predicting a different input; it did not demand the same evidence again or claim mastery. |
| Request for a complete specification | The model selected `navigate`; the app displayed a source-reading question. No specification or implementation was shown. |
| Missing prerequisite | The model copied the entire resource-option list instead of choosing one item. The app offered the verified Python tutorial index, allowing the learner to choose a prerequisite or ask a TA. |
| Repeated difficulty | A repeated question became a different-input challenge, then offered a smaller task, prerequisite review or human help. Routing remains limited and generic. |
| Stop request | The model selected pause; the response acknowledged stopping without another question. |
| Diagram request | A dedicated request-generation prompt was needed; the combined move/tool prompt sometimes ignored an explicit visual request. The next generation invented call arguments. Source checks rejected those labels and retained the coaching question; only the verified caller/callee relationship is now passed between stages. In the final real trial, the next generation returned a simple graph with an unverified `commands` label. The app replaced it with `calls`, canonicalized aliases, and rendered the checked two-participant map with an accessible description/source disclosure. |
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

Drawing is a bounded two-generation protocol. Source mode accepts one
learner-identified direct call verified in the AST, then checks a two-participant
sequence diagram with one `calls` arrow. Extra participants, relationships and diagram statements are rejected; aliases
and arrow labels are replaced with app-owned values before disclosure/history. This
supports small call maps. It deliberately does not attempt semantic validation
of arbitrary state machines, solved traces or full algorithms. The general
Python demo still has a freeform coach with weaker, prompt-based boundaries.

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

## Verification and teaching follow-up

All 157 focused unit tests and 79 Chrome/Firefox browser checks passed (77 existing/focused cases plus two source-map cases), including enabled interactive accessibility checks. The whole-site suite was not certified: an earlier broad run encountered missing dependencies/browser executables, sandbox restrictions and missing song assets.

Deterministic tests separately cover full-history/privacy boundaries, recognized
native errors, context/output rejection, parsed source targeting, tool schema,
answer-bearing labels and aliases, cancellation, optional drawing failure and
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
