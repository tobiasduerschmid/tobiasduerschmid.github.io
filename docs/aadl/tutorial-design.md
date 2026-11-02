# AADL tutorial design

**Status: proposed learning design.** The repository does not currently have an AADL tutorial backend. This document specifies a future tutorial; it does not add a runnable tutorial, new YAML fields, or a claim that the analyses have been implemented. Read it with the [chapter draft](chapter-draft.md), [backend design](backend-design.md), and [research and source review](research.md).

The tutorial teaches learners to turn a small architectural requirement into an AADL model, inspect a generated view of that model, and interpret analysis results without claiming more than the evidence supports. A successful analysis is one source of feedback. It is not, by itself, evidence that the model adequately represents the system or that a learner can explain the design.

## Audience and scope

The intended audience is an undergraduate who can read code, identify inputs and outputs, and follow a simple component diagram. No prior AADL, real-time scheduling, formal verification, or control engineering is assumed. Links to the book's [software architecture chapter](../../SEBook/software_architecture.md), [quality attributes chapter](../../SEBook/quality_attributes.md), and [UML component diagrams](../../SEBook/uml_component_diagram.md) provide optional preparation.

The guided example is a **small powerboat speed assistant**, following the progression in the supplied Feiler and Gluch excerpt. Its pilot interface supplies a requested speed and a disengage event; a sensor supplies measured speed; controller software produces a throttle command. Later lessons expose the controller's threads, deployment, timing, and operating modes. These are illustrative architectural models, not designs or parameter recommendations for an operational vehicle.

The final transfer task is a **campus delivery rover** with an obstacle sensor, controller, and stop actuator. Changing the domain makes learners select and justify the same modeling concepts rather than reproduce names from the worked example. The transfer model remains small: it does not introduce navigation, robotics algorithms, or error-model annex syntax.

The core path is **nine lessons, approximately 90 minutes**, with an optional break after lesson 5. Times are planning estimates that require a learner pilot. Free navigation and optional checks follow the existing TLA+/PlusCal tutorial policy; a learner may move on without the system recording a check as passed. There is no countdown or test cooldown. A later five-minute retrieval task is additional to the 90 minutes.

The user's preferred delivery is **entirely in the browser**. Learners should not need an OSATE installation or send their models to a hosted analysis service. The backend design investigates running official OSATE locally through a browser Java runtime; this remains a feasibility gate. Slow or unavailable startup must preserve the readable lesson, source, and explicitly labeled reference reports. Such reports support inspection and explanation, but cannot award current-model analysis credit. Do not silently substitute a simplified parser or a remote service when the official engine is unavailable.

## Learning objectives and evidence

By the end of the tutorial, learners should be able to do the following with the language reference available:

| Objective | Observable learner work | Evidence source | Limit of automatic feedback |
| --- | --- | --- | --- |
| **Select** an architectural question that AADL can help answer. | Distinguish an interface, deployment, or timing question from a control-algorithm correctness claim. | Opening diagnosis and final evidence statement. | A structurally valid model does not establish that the question was worth modeling. |
| **Construct** component interfaces using appropriate categories and port kinds. | Represent a sampled value, notification, and payload-bearing event in their appropriate contexts. | Lessons 2–3; transfer model. | Presence of a port alone does not establish its intended real-world meaning. |
| **Assemble** a hierarchical model while distinguishing types, implementations, and instances. | Connect features across a system/process boundary and explain the resulting instance path. | Lessons 3–4; generated structure plus explanation. | A rendered diagram proves neither a legal complete model nor an executable controller. |
| **Specify** software deployment and the properties required for an analysis. | Bind threads to a processor and distinguish a connection from a deployment binding. | Lesson 5; semantic model checks. | A valid binding does not prove physical feasibility or timing adequacy. |
| **Interpret** resource and timing results under stated assumptions. | Calculate a utilization contribution, inspect a reported budget, and state what further scheduling information is needed. | Lesson 6; numerical check and judgment item. | Utilization below 100% alone is not a general schedulability guarantee. |
| **Model** an end-to-end requirement as a connected flow and evaluate its budget. | Identify source, path, sink, and connections; compare the required bound with the analyzed bound. | Lesson 7; flow result and explanation. | Summed abstract latency budgets do not establish sampled-data response time or physical stopping distance. |
| **Analyze** mode-dependent structure and **justify** a small design change. | Identify active components/connections per mode; repair a design without deleting required behavior or weakening its requirement. | Lessons 8–9; capstone artifact and rationale. | Passing structural checks cannot prove safe switching, complete behavior, or implementation conformance. |

The first and last objectives include independent reasoning. The others include tool-assisted modeling. Record these separately in any pilot; do not substitute clicks, time spent, repeated passes, or confidence for learning evidence.

## Nine-lesson sequence

PRIMM is adapted to modeling: **Predict** a structural or analytical consequence, **Run** the relevant validation/analysis action, **Investigate** its evidence, **Modify** one decision, and eventually **Make** a new model. The word “Run” does not imply executing the modeled controller. Student controls should use precise labels such as **Validate model** and **Analyze latency**.

| Lesson and stable proposed key | Time | Main student work and scaffold | Assessment and feedback |
| --- | ---: | --- | --- |
| **1. Architectural Questions** — `architectural-questions` | 7 min | Inspect a complete, small speed-assistant model. Predict which of three claims can be investigated from its ports and structure; reveal the derived diagram and explain the boundary of the model. Full worked example with a short author think-aloud. | Ungraded diagnosis: “The diagram connects the sensor to the controller; does that establish that the boat will stop in time?” Feedback separates represented communication, timing inputs, and physical behavior. |
| **2. Component Interfaces** — `component-interfaces` | 9 min | Distinguish continuous/sampleable information from discrete notification. Predict the consequence of changing a port kind, then repair one mismatched interface. Type/implementation skeletons and the unaffected ports are supplied. | Separate checks for the required feature, direction, and compatible connection; a transfer question uses a payload-bearing event. Feedback points to the conflicting endpoint and the communication contract. |
| **3. Hierarchical Composition** — `hierarchical-composition` | 10 min | Assemble supplied device and process classifiers into a system implementation. Predict the effect of a renamed local instance versus a changed classifier. Complete two connections, then explain one instance path. Faded worked example. | Check actual endpoint identities and direction, including boundary delegation. Accept equivalent connection labels and formatting. A declared but unconnected component does not meet the requirement. |
| **4. Runtime Containment** — `runtime-containment` | 9 min | Open the controller process and study a supplied two-thread decomposition: measurement processing and control law. Complete its boundary-to-thread wiring. Contrast a process boundary with a schedulable thread. | Check a continuous sensor-to-command path through both required threads, and no reversed endpoint. A reasoning item asks why the process is not itself the scheduled task. |
| **5. Deployment Bindings** — `deployment-bindings` | 9 min | Inspect supplied processor, memory, and bus declarations. Predict whether a port connection allocates execution; add a thread-to-processor binding and inspect its resolved instance target. Hardware source is supplied, so the new decision is allocation. | Separate criteria for complete required allocation, a legal target, and preservation of communication. Revisit type/implementation/instance identity from lesson 3. Explain allowed versus actual binding without requiring an allocation-search algorithm. |
| **6. Timing Budgets** — `timing-budgets` | 11 min | Calculate the processor demand of the supplied periodic threads, compare with the report, then evaluate a changed execution-time estimate. The reference example has periods 50 ms and upper execution times 2 ms and 5 ms: utilization is 14%. Classify a low-utilization deadline-miss counterexample. | Check units, resolved properties, and the chosen budget independently. A judgment item requires identifying missing scheduling assumptions. If the selected runtime lacks a scheduling plugin, provide an explicitly labeled reference report; do not label utilization as schedulability. |
| **7. End-to-End Flows** — `end-to-end-flows` | 11 min | Trace a requested-speed update from pilot interface to throttle. Complete a flow from supplied source/path/sink declarations, predict its upper budget, and assess a tightened requirement. Earlier connections are reused. | Check continuity and the fixed deadline separately. Distinguish disconnected, over-budget, incomplete, and completed outcomes. Explanation identifies which segment dominates and which assumptions justify the calculation. |
| **8. Operating Modes** — `operating-modes` | 9 min | Compare monitoring and controlling configurations. Predict which thread and connection become active after a named event, then repair one wrongly restricted element. The mode declarations and transitions are initially supplied. | Check per-mode membership and the required path in each configuration. A short question distinguishes architecture modes from a complete algorithmic state machine or a guarantee of an instantaneous safe transition. |
| **9. Rover Transfer** — `rover-transfer` | 15 min | Complete a fresh, small rover model from a structural skeleton and a written contract. Choose an interface, wire the path, assign the provided execution resource, and meet a fixed abstract flow budget. Finish with an evidence statement; no worked rover solution is visible before the attempt. | Small criteria give partial progress; the rubric below assesses modeling and interpretation separately. Include a changed sensor-latency estimate after the first result. The learner revises the design or reports that the requirement is no longer met, rather than editing the requirement. |

Every authored lesson will use a Title-Cased noun-phrase title, a `# Pedagogy:` author comment, the shared “Why this matters” and “🎯 You will learn to” headings, and 1–3 local objectives. Full solutions belong only in the existing solution reveal. These are authoring commitments, not new runtime fields.

## Copy-ready sample lesson: Component Interfaces

The following is proposed learner-facing instruction text for lesson 2. Its complete starter workspace must be supplied and validated before publication.

### Why this matters

An interface tells other components what information they can receive and what kind of communication to expect. Choosing the right port kind helps distinguish a value that can be sampled from an occurrence that must be noticed.

### 🎯 You will learn to

- Select a port kind from a communication requirement.
- Diagnose incompatible endpoints without changing the requirement.

### The speed assistant's inputs

The pilot can set a target speed or disengage automatic control. The sensor publishes a measured speed. The controller uses these inputs to produce a throttle command.

Use these contracts for this lesson:

- **Measured speed:** the latest available value is useful; this lesson does not require delivery of every intermediate measurement.
- **Disengage:** each occurrence is a notification, with no attached payload.
- **Requested speed:** a value supplied by the pilot, represented here as a data port.

The starter connects these three inputs. Your task is to audit the interfaces against their communication contracts before relying on the diagram.

### Your task

1. **Predict:** before editing, choose what the validator should report: compatible endpoints, an incompatible feature/connection, or a missing component. Identify the two endpoint declarations supporting your choice.
2. **Inspect:** select **Validate model**. Follow the diagnostic to its source, and compare its reason with your prediction.
3. **Repair:** make the disengage connection satisfy the stated communication contract. Preserve its direction and the other interfaces. A matching name is not sufficient; compare the feature kinds too.
4. **Check:** validate again and use **Test My Work** to inspect each criterion. The diagram will update from the latest successfully analyzed source. If it says **Out of date**, it still describes an earlier version.
5. **Explain:** a diagnostic event now needs to carry an error code with each occurrence. Which port kind would express that new contract, and why would the sampled-value model be different?

Successful validation checks this model's rules. It does not establish a delivery deadline, event-queue capacity, or correct controller behavior.

### Assessment and hint contract for this sample

These are author-facing requirements, kept outside the learner instruction text:

- **Criterion: notification interface.** The resolved model contains the required input/output notification features and the required path. Do not award credit for a matching identifier inside a comment or an unused declaration.
- **Criterion: connection compatibility.** The connection resolves to the required instances and directions, with compatible feature kinds and declared classifiers where relevant.
- **Criterion: preserved inputs.** Measured-speed and requested-speed inputs remain connected according to the exercise contract. This prevents deletion of the failing path from appearing to repair it.
- **Reasoning evidence:** the learner's final answer distinguishes event data from sampled data. A language-valid file does not establish this explanation.
- **Hint: “What crosses this boundary?”** For an untouched/missing attempt, ask whether the requirement describes a current value or an occurrence.
- **Hint: “Compare both endpoints.”** For a partial attempt, direct the learner to inspect the declared feature kind and direction at both ends, not their spelling.
- **Hint: “A notification without a payload.”** For a developed but still incompatible attempt, ask which of the previously taught port kinds carries this meaning, leaving the choice and edit to the learner.

Hints must be selected from the current attempt where the implemented condition system permits reliable matching. Diagnostic/source patterns guide advice only; grades come from resolved model semantics. Tests should accept at least two equivalent correct formulations and reject reversed direction, a different port kind, and a deleted required connection.

## Copy-ready sample lesson: End-to-End Flows

The following is proposed learner-facing instruction text for lesson 7. The example uses a deliberately simple **abstract latency-budget model**; it does not calculate periodic sampling or scheduling delays.

### Why this matters

A locally fast component can still belong to a slow chain. An end-to-end flow identifies the path relevant to a requirement so that an analysis can connect its parts and report their combined contribution.

### 🎯 You will learn to

- Assemble a continuous end-to-end flow from its declared segments.
- Compare an analyzed bound with a requirement while stating the calculation's assumptions.

### The request-to-command requirement

For this exercise, a requested-speed change travels from the pilot interface, through the controller, to the throttle actuator. Its **required abstract upper latency bound is 35 ms**. That requirement is fixed.

The starter already declares the components, their connections, and these segment budgets:

| Segment | Supplied latency budget |
| --- | --- |
| Pilot interface source | 5 ms |
| Controller path | 10–20 ms |
| Throttle actuator sink | 8 ms |

The exercise treats the two connecting links as having zero additional transport latency. That is an explicit simplification, not a default assumption for real buses. Use the supplied segment budgets; do not reduce them to obtain a passing result.

### Your task

1. **Predict:** before opening the latency result, calculate the upper path budget. Decide whether the requirement is met and record how much margin remains.
2. **Trace:** follow the requested-speed port through the current component view. Identify its source flow, connecting link, controller flow path, second link, and sink flow. The pilot's disengage event is a different path.
3. **Complete:** finish the end-to-end flow using those supplied elements. Preserve the fixed requirement and component budgets.
4. **Analyze:** select **Analyze latency**. Compare its listed segments and upper bound with your calculation. If the flow is disconnected or the tool cannot complete the analysis, identify that result without treating it as a met deadline.
5. **Evaluate:** the requirement is tightened to 30 ms in a separate supplied variant. Does the same architecture still meet the abstract budget? Name a segment whose implementation estimate would need investigation, and state what evidence would be needed before changing it.

This report concerns the declared abstract path budget. It does not include an unmodeled sensor-sampling delay, scheduler interference, or the time a physical boat takes to slow down.

### Assessment and hint contract for this sample

- **Criterion: continuous requested-speed flow.** Resolve the intended source, controller path, sink, and intervening connections from the official semantic/instance model. A valid flow along the disengage or control-on event is not the requested path.
- **Criterion: fixed requirement.** Evaluate against the instructor-owned 35 ms requirement, independently of any editable displayed property. The correct reference upper sum is 33 ms, giving 2 ms margin under the exercise's stated assumptions.
- **Criterion: preserved segment contract.** Reject deleted segments, changed fixed budgets, or an alternative root that omits the required path. Do not require a particular end-to-end-flow identifier.
- **Criterion: changed requirement.** The same 33 ms bound exceeds the supplied 30 ms variant by 3 ms. “Requirement not met” is the correct exercise evidence; a green tool status is not always the desired answer.
- **Hint: “Start with the requirement's input.”** Orient an untouched/missing attempt toward the requested-speed port and its source flow.
- **Hint: “Follow one continuous path.”** For a partial attempt, ask the learner to compare each connection's receiving feature with the next flow segment's incoming feature.
- **Hint: “Locate the first broken join.”** For a developed disconnected attempt, offer a worksheet with columns “previous output / connection / next input”; leave its endpoints and final declaration for the learner to derive.

Verify boundary comparisons at the requirement, just below it, and just above it with independently authored fixtures. Incomplete/tool-error/stale outcomes remain **not checked**. The simple sum should agree with the selected analysis's documented semantics; if that plugin performs a different latency analysis, change the exercise or use a clearly labeled reference result rather than force a misleading numerical match.

## Capstone contract and rubric

The rover task supplies classifiers for an obstacle sensor, a controller process with its thread, one processor, and a stop actuator. It supplies fixed component timing estimates and an explicit end-to-end requirement. Learners receive a structural skeleton, not the completed connections, port-kind choice, binding, or flow. The contract requires a connected obstacle-to-stop path and a correctly allocated controller. It states whether the obstacle message is a notification with a payload, so students must choose the corresponding interface representation.

After the first attempt, provide a changed sensor-latency estimate that consumes the original margin. A correct response may be “the requirement is no longer met.” The task does not reward weakening a requirement or silently replacing measured/assumed inputs. Learners submit the model and a short claim using this frame:

> Under **[declared assumptions]**, analysis **[name/version]** of **[model revision and root]** reports **[result]** for **[requirement]**. This supports **[scoped conclusion]**. It does not establish **[one relevant remaining obligation]**.

Use the following rubric for feedback or a small formative assignment. Automatic checks supply evidence for the first three rows; the final two require review or a separate reasoning response.

| Criterion | 2 — supported | 1 — partial | 0 — missing or contradictory |
| --- | --- | --- | --- |
| Interface meaning | Port kind and direction match the message contract; the learner can justify the choice. | Model is plausible but one distinction is unexplained or inconsistent. | Wrong communication meaning or required feature absent. |
| Composition and deployment | Required path resolves through the intended instances; controller execution has the required valid binding. | Some required structure resolves; one path/binding remains incomplete. | Components are merely declared, disconnected, or allocated to an invalid target. |
| Analysis contract | Required root, fixed assumptions, units, and path are retained; result is current and complete for the claimed analysis. | Inputs are mostly correct but a material assumption or completeness condition is missing. | Claim relies on stale/incomplete output, weakened requirements, or omitted required behavior. |
| Evidence interpretation | Conclusion names scope and limits; distinguishes abstract latency, scheduling, and physical response. | Correct pass/fail interpretation with an incomplete limit statement. | Treats a valid diagram or budget calculation as proof of physical safety or implementation correctness. |
| Changed requirement/estimate | Predicts the consequence, checks it, and justifies a revision or an unmet-requirement report. | Detects the change but cannot justify the response. | Hides the failure by deleting structure or changing the fixed contract. |

Do not combine the model score with the explanation into an opaque “mastery” badge. A 10-point total is an optional instructor reporting convenience, not a validated measurement scale or a required runtime field.

## Visual, accessibility, and print requirements

The visual workspace must derive its structure from the same resolved model revision used for validation. It must distinguish a **declarative view** from an **instance view**. It must label containment, port connections, and processor bindings differently; a dotted generic arrow cannot stand for all three. Any simplified notation must be identified as a projection rather than described as the complete standard AADL graphical notation.

Five figures earn a place in the sequence:

1. **System view:** four components and their directed features; takeaway: an interface declaration and a connection make different commitments.
2. **Controller interior:** process boundary and two threads; takeaway: boundary ports delegate to internal runtime components.
3. **Deployment view:** threads, processor, and explicit bindings; takeaway: communication topology does not specify execution allocation.
4. **Flow overlay:** one selected end-to-end path with per-segment budgets; takeaway: the requirement follows a specific path, not every arrow in the model.
5. **Mode comparison:** the same layout in monitoring and controlling; takeaway: active architecture changes while the underlying declarations remain.

These should be derived from verified model data or be clearly labeled explanatory figures. Do not encode AADL-looking text into ArchUML and present its rendering as AADL parsing or validation. ArchUML can illustrate a conceptual relationship when labeled accordingly; it is not the AADL semantic engine. Keep no more than one hierarchy level in a view, apart from the explicitly shown containing boundary. Use stable positions for comparisons where practical, without making layout part of the grade.

Each diagram needs a concise accessible name and a complete structured text alternative: component category/name, containment, features and direction/kind, endpoint pairs, binding targets, selected flow segments, active mode, and applicable limitations. A list/tree/table alternative must support the learning task without requiring sight or spatial navigation. Selecting a diagnostic or element may move to source only through an explicit learner action; automatic refresh must preserve focus and editor selection.

Keyboard access, visible focus, 24-pixel minimum targets, paragraph-size labels, narrow-screen reflow, both themes, reduced motion, and sufficient contrast are release requirements. Color must not be the only indication of port kind, active mode, status, or violation. Keep readable diagram labels at their intrinsic size with accessible scrolling rather than shrinking the text to fit. Rendering and narration must not announce every edit or every unchanged stale state.

The print tutorial must contain instructions, all relevant source/configuration files, static diagrams or equivalent structural tables, analysis assumptions and example reports, and the usual knowledge checks. Solutions remain hidden unless instructor mode is requested. Print uses the light palette even after a dark live session. A printed report must identify its source/model revision and analysis scope; pending source must never print beside an older unlabeled result. If there is no current completed result, print “Not analyzed for this revision” and retain readable source. Browser snapshots are verification artifacts, not repository deliverables.

## Feedback, freshness, and grading contract

**Automatic visualization and explicit analysis have different jobs.** A short debounced validation may refresh the visual model. Heavier analysis is requested explicitly. A learner predicts a change before editing because editing can reveal the new structural result automatically. When the prediction is about an initial generated view or report, that answer-bearing view starts behind a deliberate reveal; merely opening the lesson must not disclose it.

Every operation captures all model files, chosen root classifier, selected mode/configuration, tool version, analysis settings, and the lesson identity. Completion is accepted only for that snapshot. Edits, Reset, Solution, navigation, changed root/mode, Stop, and destruction invalidate pending operations and completion credit. Old results may remain for comparison only when labeled **Out of date**. Late diagnostics, source selections, figures, and grades must not overwrite a newer revision or another lesson.

Represent outcomes explicitly: **valid/invalid model**, **requirement met/not met**, **incomplete**, **not applicable**, **unsupported**, and **tool error** are different. No findings, empty output, a zero exit code without a completed result, or a parse-only result must be interpreted as analysis success. Missing required properties are missing evidence. The UI should give the source location and useful recovery action without turning internal stack traces into the primary lesson feedback.

Assessment should use instructor-owned requirements against the learner's current resolved instance model. Match semantic roles, categories, directions, classifier compatibility, resolved values/units, and actual path continuity. Preserve names only when they are part of the published interface contract. Comments, unused declarations, formatting, node positions, and connection-label spelling cannot satisfy or fail a semantic requirement. Check anti-vacuity conditions: required devices, threads, paths, operating modes, and deployment remain present. Constraints on which supplied estimates may be edited must be explicit in the learner contract.

Each check reports one meaningful criterion. Verify model answers, two equivalent correct alternatives, a partial solution, and plausible mistakes such as a reversed connection, wrong port kind, deleted path, missing binding, wrong units, wrong root, and weakened deadline. A useful check should reject the intended fault while accepting an internal refactor. This is formative educational feedback, not a tamper-proof examination system.

## Source map and evidence calibration

The supplied PDF is a 2012 Feiler/Gluch book excerpt. Its chapter 3 material is the technical and sequencing source below. Printed page numbers are the reliable citation labels; parenthetical PDF page numbers are one-based positions in the supplied file.

| Proposed material | Supplied excerpt | Use and adaptation |
| --- | --- | --- |
| Lessons 1–3: categories, interfaces, type/implementation, top-level composition | §3.1.1–3.1.2, pp. 32–37 (PDF pp. 23–28) | Preserve the concrete speed-control problem and increasing detail. Author smaller, complete, checked examples rather than reproduce large listings. |
| Lesson 4: process and threads | §3.1.3, pp. 38–40 (PDF pp. 29–31) | Keep the measurement-processing/control-law split; teach containment before allocation. |
| Lesson 5: platform and binding | §3.1.4–3.1.6, pp. 40–45 (PDF pp. 31–36) | Supply much of the platform declaration; distinguish physical connections, allowed bindings, and actual bindings. Current tool behavior requires separate verification. |
| Lesson 6: timing inputs and utilization | §3.1.7, pp. 45–47 (PDF pp. 36–38) | Retain the transparent 14% arithmetic as one example; explicitly separate utilization from schedulability. Historical plugin claims are not current feature guarantees. |
| Lesson 7: abstract flow latency | §3.4, pp. 55–58 (PDF pp. 46–49) | Reuse the conceptual source/path/sink progression and explain abstract budgets. Verify all connections and the analysis semantics independently. |
| Lesson 8: monitoring and controlling modes | §3.3, pp. 51–55 (PDF pp. 42–46) | Move this after the initial latency lesson to keep the first quantitative path in one configuration. Then revisit which paths are active per mode. |
| Optional chapter extension: abstract models and refinement | §3.5, pp. 58–69 (PDF pp. 49–60) | Explain later refinement without adding it to the core tutorial's initial syntax load. |

**Source issue to resolve in executable examples:** Listing 3-15 on printed p. 57 declares the end-to-end path through `EC5`, although that connection carries `control_on`, while its source/path features use `set_speed`. The nearby prose names `EC4`, the disengage connection. The matching declared connection is `DC3`. This is an observed internal inconsistency in the supplied excerpt. Do not copy either inconsistent spelling into a model or use the printed output as its test oracle.

The instructional sequence is **original design synthesis** informed by the repository's pedagogy playbooks. Worked examples and fading motivate the move from complete model to repair, completion, and transfer. Retrieval motivates revisiting types/instances in lesson 5 and asking for an independent final claim. Representation choices apply signaling, segmentation, and spatial contiguity. These general principles do not establish that this specific AADL tutorial improves learning, that the example appeals to every learner, or that 90 minutes is sufficient.

The source mapping establishes what technical material informed the design, not causal evidence for the sequence. Quantitative claims in the older skills about universal working-memory capacities, retention multipliers, or optimal spacing intervals are not needed for this design and should not be copied into the chapter as guarantees.

After a learner pilot, revise timing, vocabulary, and scaffolding using observed errors and independent performance. A practical pilot should distinguish: completion with hints, ability to explain a fresh model, and transfer after a delay. A later five-minute task can ask learners to identify an unbound thread and reject an unjustified latency claim in a new greenhouse-monitoring model. That is a proposed retention check, not an already measured outcome.

## Repository integration plan

No production integration is made by this design document. The proposed file map is:

| File or surface | Future responsibility |
| --- | --- |
| `SEBook/architecture/aadl.md` | Static chapter using the shared `sebook` layout. Ten or fewer short H1 labels; quiz/flashcards under one Practice section; automatic bibliography. |
| `SEBook/architecture/aadl-tutorial.md` and `aadl-tutorial/print.md` | Required live/print page pair referencing the same future tutorial data key. |
| `_data/tutorials/aadl.yml` | Nine lessons, stable keys, ordinary file drafts, model solutions, optional checks, and knowledge checks using the shared schema. An AADL-specific schema must not be authored as if already supported. |
| `_data/quizzes/aadl.yml`, `_data/flashcards/aadl.yml` | Aligned retrieval and transfer items after the chapter. Follow the quiz and flashcard skills when writing them. |
| `_data/sebook_nav.yml` | Add AADL under Software Architecture, beside the quality-attribute and architecture material. `SEBook/all.md` uses this navigation; do not add an unrelated manual aggregator list. |
| `SEBook/software_architecture.md` | Add a specific link near Architectural Views. Explain that AADL's component categories are broader than that chapter's independently deployable-unit wording. |
| `_bibliography/references.bib`, `_data/glossary.yml` | Verified bibliographic entries and the introduced AADL/OSATE/WCET terms. The inspected glossary currently has none of those entries. |
| Future `js/aadl/` modules and `js/tutorial-aadl.js` | Reusable engine-facing model/transport/controller/view/assessment boundaries plus thin tutorial integration, detailed in the backend design. Reuse shared file, progress, reset, hint, and quiz ownership. |
| Future named CSS/include modules | Shared chapter/tutorial presentation and readable no-JavaScript/print fallbacks; no page-local static style blocks. |
| Future tests and `docs/aadl/` updates | Official-tool content fixtures, equivalent/wrong-answer checks, freshness/lifecycle tests, accessible live/print checks, and maintained technical/source documentation. |

Do not add this tutorial to `_data/CS130_nav.yml` automatically: that is a course curriculum decision, and its present structure differs from the general book navigation. The tutorial index needs no manual entry once the real YAML and live page exist. The chapter can be published before a backend, using static verified examples and an accurately labeled future tutorial link only when its destination exists.

For implementation, the closest inspected precedents are `js/tutorial-tla.js` and `js/tla/controller.mjs` for snapshot freshness and independent trusted checks, `js/compiler-tutorial-adapter.js` for declarative semantic expectations, and `docs/compiler-lab.md` for one reusable chapter/tutorial view. The existing adapters do not supply AADL semantics. The tutorial-authoring skill must be updated in the same future change that introduces an actual backend, schema, or runtime behavior.
