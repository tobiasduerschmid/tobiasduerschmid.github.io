---
title: 'AADL: Analyzing Software and Hardware Architectures'
layout: sebook
permalink: /SEBook/architecture/aadl
description: 'Model typed interfaces, software structure, deployment, and timing assumptions; use analysis results to make precise architectural claims.'
---

# Purpose

A campus delivery rover measures wheel speed, compares it with a requested speed, and sends commands to a motor drive. A component diagram can show these connections. But can the controller finish before its next deadline? Which processor runs it? How old might a sensor reading be when the motor receives the resulting command?

**{% include abbr.html term="AADL" %} describes an architecture precisely enough for tools to investigate questions like these.** The name expands to Architecture Analysis and Design Language. It models interacting software components, their execution platform, and interfaces to the physical environment. Properties add quantities and policies, such as periods, execution-time ranges, and deployment bindings. Tools analyze the resulting model under explicit assumptions. AADL is standardized by {% include abbr.html term="SAE" %} International. The core revision identified for this chapter is AS5506D, revised in April 2022 {% cite SAE2022AADL %}.

The useful habit is to ask an engineering question, represent the architectural facts needed to answer it, and inspect the evidence. Adding more detail is useful only when it changes the question you can answer.

**Prerequisites:** basic software architecture, interfaces, and programming. No prior AADL or real-time scheduling knowledge is assumed. After this chapter, you should be able to:

- Distinguish a component type, a component implementation, and an instantiated component.
- Read and construct a small architecture with typed ports and hierarchical connections.
- Explain how threads, processes, and processors represent different architectural decisions.
- Attach timing and deployment properties and calculate a simple processor-demand estimate.
- Trace an end-to-end flow and distinguish its latency from processor execution time.
- Evaluate the scope of an analysis result, including missing information and assumptions.

The model-development sequence draws on Chapter 3 of Feiler and Gluch's *Model-Based Engineering with AADL*. Their powerboat autopilot example introduces the same sensor–control–actuator reasoning used in this original rover model {% cite FeilerGluch2012AADL %}.

**Try it:** the [four-step AADL tutorial](/SEBook/architecture/aadl-tutorial) starts with a smaller, complete budget model. It lets you repair an interface, restore missing timing evidence, and compare a requirement with a calculated result.

## Where AADL fits

| Need | AADL's contribution | Additional work still needed |
| --- | --- | --- |
| Communicate system structure | Components, interfaces, containment, connections, and deployment | Select a view that answers the reader's question. |
| Predict timing or capacity problems | Machine-readable timing/resource properties connected to architecture | Obtain credible measurements or estimates and select a suitable analysis. |
| Explore deployment alternatives | Change bindings while retaining software structure | Check processor assumptions and communication effects. |
| Investigate faults or logical contracts | Specialized annexes and analysis tools | Supply fault models or behavioral contracts; the core diagram alone is insufficient. |

AADL is especially useful when runtime and hardware choices affect correctness: embedded control, avionics, robotics, industrial equipment, and other real-time systems. A service architecture concerned mainly with ownership boundaries or product workflows may need a simpler notation. AADL also does not replace a physical model of rover motion, executable control software, or implementation testing. {% cite OSATE2026Capabilities %}

# Model

In AADL, **component** is a broad modeling term. It includes threads, processes, data, processors, and devices; it does not always mean an independently deployable software unit.

Distinguish the three model levels and the declaration that connects them:

| Level | Example | Meaning |
| --- | --- | --- |
| Type | `Motion_Control` | The externally visible interface and applicable properties. |
| Implementation | `Motion_Control.two_tasks` | An architectural realization of that type, including internal subcomponents and connections. |
| Subcomponent declaration | `motion: process Motion_Control.two_tasks;` | A named role in the source implementation selecting a classifier. |
| Instance | The resolved `motion` occurrence in the generated rover instance | A particular model occurrence after instantiation. Its thread has an instance path such as `motion.filter_task`. |

The word **implementation** here means an architectural description. An empty `thread implementation` does not contain an executable filtering algorithm. Multiple implementations can realize the same interface with different internal architectures.

To analyze a deployed system, a tool resolves the selected root implementation into a **system instance model**. This identifies the actual component occurrences, connections, and applicable properties. Two occurrences can use the same classifier while remaining distinct instances with different bindings or property overrides. {% cite FeilerGluch2012AADL OSATE2026Tooling %}

## Component categories

| Family | Categories | Useful distinction |
| --- | --- | --- |
| Software | `thread`, `thread group`, `process`, `data`, `subprogram`, `subprogram group` | A thread is a schedulable execution unit; a process supplies a protected address-space boundary. A subprogram represents callable behavior. |
| Execution platform | `processor`, `virtual processor`, `memory`, `bus`, `virtual bus`, `device` | A processor executes software. A bus models communication infrastructure. A device provides an interface to the environment and can abstract substantial internal machinery. |
| Composition and abstraction | `system`, `abstract` | A system composes architectural parts; an abstract component defers a runtime-category commitment. |

A process is not a processor. Drawing a processor beside a process does not assign its threads to that processor. That requires a binding.

## Syntax you will keep using

AADL identifiers and keywords are case-insensitive. Statements generally end in `;`; `--` starts a line comment. `package` organizes declarations. A package's `public` section exposes classifiers; `with Other_Package;` makes another package available, and `Other_Package::Type` names a classifier from it. A dot in `Type.realization` separates the type and implementation identifiers; in `motion.filter_task`, it navigates containment. A matching `end Name;` closes each declaration.

```aadl
package Rover_Data
public
  data Speed
  end Speed;
end Rover_Data;
```

This declares an architectural data classifier. It does not yet specify a numeric representation, units of speed, or a valid physical range. Those decisions can be added through properties and suitable data modeling conventions. Do not infer that a data type named `Speed` already guarantees nonnegative metres per second.

# Interfaces

A component type lists its interface under `features`. The following excerpt declares two different data classifiers and a thread with an input and output:

```aadl
data Speed
end Speed;

data Drive_Command
end Drive_Command;

thread Speed_Filter
features
  raw_speed: in data port Speed;
  filtered_speed: out data port Speed;
end Speed_Filter;
```

The [complete rover model](/docs/aadl/examples/rover.aadl) places these declarations in one package. Excerpts in this chapter omit their enclosing package when the surrounding declaration is the teaching focus.

## Three port kinds

| Port | Architectural meaning | Rover use |
| --- | --- | --- |
| `data port` | State-like data, normally sampled as the latest available value; it does not promise a queue containing every update. | Current wheel speed. |
| `event port` | An occurrence without a data payload; queue and dispatch behavior depend on the model. | Request to disengage automatic control. |
| `event data port Speed` | An occurrence with an associated data payload. | A queued command carrying a target speed. |

Choosing a port kind changes the modeled communication semantics. It is not merely choosing an arrow style. A data connection alone does not mean that a consumer runs immediately when the producer changes its value. Dispatch protocols, sampling, and connection timing matter.

For the introductory examples, connect the same port kind with compatible data classifiers. AADL has additional connection rules and permitted conversions; this teaching convention is not a claim that every cross-kind connection is illegal. Feature groups and data/bus/subprogram access features extend the interface vocabulary when larger models need them. {% cite OSATE2026Language OSATE2026Properties %}

**Predict:** a sensor publishes ten speed updates before a periodically dispatched controller next reads its data port. Must the controller process ten separate messages? Explain which part of the declaration supports your answer before reading on.

<details markdown="1">
<summary>Compare your reasoning</summary>

A data port does not promise an event queue containing all ten updates. A requirement to preserve individual occurrences calls for different communication semantics and explicit queue/overflow assumptions.

</details>

# Composition

The rover's logical path is wheel encoder → motion-control process → motor drive. Inside the process, filtering and control are separate threads. The operator console provides the target speed through another input. This nesting matters: external connections terminate at process features, and internal connections continue from those boundary features to thread features.

```aadl
process Motion_Control
features
  raw_speed: in data port Speed;
  requested_speed: in data port Speed;
  command: out data port Drive_Command;
end Motion_Control;

process implementation Motion_Control.two_tasks
subcomponents
  filter_task: thread Speed_Filter.basic;
  controller_task: thread Speed_Controller.basic;
connections
  sample_in: port raw_speed -> filter_task.raw_speed;
  filtered: port filter_task.filtered_speed ->
    controller_task.measured_speed;
  target_in: port requested_speed -> controller_task.requested_speed;
  command_out: port controller_task.command -> command;
end Motion_Control.two_tasks;
```

The complete file supplies both thread types and implementations. In `sample_in`, the process's input is the source of an **internal** connection because it carries information into the enclosed thread. `command_out` carries a thread output to the enclosing process output. Do not mechanically apply a sibling-components rule to boundary forwarding.

The labels `sample_in` and `filtered` identify connections; they are not function calls. Matching endpoint names are unnecessary: `filtered_speed` connects to `measured_speed` because their direction, kind, and classifier are compatible.

The root selects the architecture's parts:

```aadl
system implementation Rover.single_cpu
subcomponents
  encoder: device Wheel_Encoder;
  operator_console: device Operator_Console;
  motor: device Motor_Drive;
  motion: process Motion_Control.two_tasks;
  cpu: processor Onboard_CPU;
connections
  sensed_speed: port encoder.measured_speed -> motion.raw_speed;
  target_speed: port operator_console.requested_speed -> motion.requested_speed;
  motor_command: port motion.command -> motor.command;
end Rover.single_cpu;
```

The later properties and flows are present in the complete model. Selecting `Campus_Rover::Rover.single_cpu` instantiates this realization. Selecting another root may yield a different deployment even if many classifier declarations are shared.

The logical view below separates the operator's requested speed from the encoder's measured speed. It uses **UML-style component boxes as a reading aid**, not AADL's standardized graphical notation. The AADL declarations above remain the model; the figure omits thread internals and deployment bindings.

<div class="uml-class-diagram-container"
     data-uml-type="component"
     data-uml-caption="Keep the target value and measured value distinct when tracing the control path."
     data-uml-spec='@startuml
component encoder {
  portout "measured_speed" as measured
}
component operator_console {
  portout "requested_speed" as requested
}
component motion {
  portin "raw_speed" as raw
  portin "requested_speed" as target
  portout "command" as drive
}
component motor {
  portin "command" as motor_command
}
measured --> raw : Speed
requested --> target : Speed
drive --> motor_command : Drive_Command
@enduml'></div>

The connections carry encoder measurements to `motion.raw_speed`, operator requests to `motion.requested_speed`, and `motion.command` to the motor. The process boundary hides the two internal threads; the deployment binding answers a separate question about where those threads execute.

# Deployment

The complete rover example assigns its two threads these properties:

```aadl
-- Speed_Filter
Dispatch_Protocol => Periodic;
Period => 20 ms;
Deadline => 20 ms;
Compute_Execution_Time => 1 ms .. 2 ms;

-- Speed_Controller
Dispatch_Protocol => Periodic;
Period => 20 ms;
Deadline => 20 ms;
Compute_Execution_Time => 2 ms .. 3 ms;
```

These are **property-association excerpts**, placed within the respective thread's `properties` section. For these periodic threads, the period is the dispatch interval. A deadline is a completion requirement relative to the applicable dispatch. `Compute_Execution_Time` is an execution-time range for the modeled processor assumptions; its upper endpoint supplies the {% include abbr.html term="WCET" %} (worst-case execution time) assumption used for computation demand here. It is not a measured result produced merely by writing the property.

The units are part of the value. A tool must normalize `20 ms` and `20000 us` consistently. An omitted property required to justify the claim is **missing evidence**. A tool may nevertheless calculate a number using defaults or only the contributions it can find; the modeler must check completeness.

In the system implementation, explicit bindings assign both threads:

```aadl
properties
  Actual_Processor_Binding => (reference (cpu))
    applies to motion.filter_task;
  Actual_Processor_Binding => (reference (cpu))
    applies to motion.controller_task;
```

`reference (cpu)` identifies an instance in this architecture. `applies to` identifies the component receiving the association. An **allowed** binding constrains permissible choices; an **actual** binding records the selected deployment. Do not interpret an allowed set as a deployment that has already happened. Memory and connection bindings express other allocations. A physical bus-access connection and the binding of a logical port connection to that bus answer different questions. {% cite FeilerGluch2012AADL OSATE2026Properties %}

## A small calculation—and its boundary

For periodic threads on one processor, estimate utilization by adding each thread's worst-case execution time divided by its period:

**U = 2 ms / 20 ms + 3 ms / 20 ms = 0.25.**

Under these assumed worst-case execution times, the two modeled threads demand **25%** of one processor's time. This excludes unmodeled interrupts, overhead, blocking, and other work. The value alone does not establish that every deadline is met.

For a sharper counterexample, consider two independent tasks on a single fully preemptive, fixed-priority processor. The higher-priority task has `C = 2 ms`, `T = D = 10 ms`; the lower-priority task has `C = 6 ms`, `T = 20 ms`, `D = 7 ms`. There is no release jitter, blocking, or execution overhead. Utilization is only `2/10 + 6/20 = 50%`. If both release together, the higher-priority task executes for 2 ms, and the lower-priority task finishes at 8 ms—after its 7 ms deadline.

The second example is a hand-worked scheduling argument under the stated assumptions, not a report produced by the chapter's rover model. Changing an analysis assumption can change which conclusion is justified. A real schedulability tool needs a supported task and scheduler model.

# Flows and Modes

A **connection** links features. A **flow specification** identifies how information passes through a component's interface; a **flow implementation** explains the internal path that realizes it. An **end-to-end flow** composes component flows and connections across the system. A drawn route is not evidence of physical movement or an execution trace.

The rover model declares a source at the encoder, a path through motion control, and a sink at the motor drive:

```aadl
-- In Wheel_Encoder
flows
  sample: flow source measured_speed;

-- In Motion_Control
flows
  control: flow path raw_speed -> command;

-- In Motor_Drive
flows
  apply: flow sink command;
```

The process realization expands its path through the two threads; the root composes the whole route:

```aadl
flows
  speed_response: end to end flow encoder.sample -> sensed_speed ->
    motion.control -> motor_command -> motor.apply;
```

Every adjacent segment must join the previous segment's actual endpoint. A connection with a plausible name that goes to a different port does not complete the route.

## Latency is more than computation

Suppose a conceptual control path allocates up to 4 ms to its sensor, 12 ms to its controller, and 6 ms to its actuator. With connections explicitly assumed to add no delay at this abstraction, the allocation totals **22 ms**, leaving **3 ms** against a 25 ms upper requirement. This is an allocation-level calculation: it does not derive the controller's 12 ms from thread timing.

The complete [abstract-budget model](/docs/aadl/examples/flow-budget.aadl) encodes this separate example. Native OSATE analysis reports **18–22 ms** for it under the recorded configuration; the [verification record](/docs/aadl/verification.md) identifies that tool and its assumptions.

In a runtime model, end-to-end latency can include periodic sampling, dispatch waiting, scheduling response, immediate or delayed communication, transmission, queuing, and device response. Adding only the threads' execution-time upper bounds can omit most of the delay. The model must identify its flow and the analysis configuration must identify which contributions are included. The first rover file intentionally lacks enough device/connection latency assumptions for a complete sensor-to-motor latency claim. {% cite FeilerHansson2007Latency OSATE2026Capabilities %}

**Missing evidence can make a result look better.** In a fresh native run of the budget model, removing the controller's 8–12 ms association produced **10–10 ms** with no warning: only the 4 ms sensor and 6 ms actuator contributed. That smaller result does not demonstrate a faster controller. The exercise's required controller evidence is absent. Check the completeness and provenance of the contributions separately from whether the tool's total satisfies a bound.

An end-to-end `Latency` bound states a requirement; it does not cause the model to meet it. If the bound fails, inspect the contributions. Increasing the bound changes the requirement, so it is not a repair when the requirement is fixed.

## Modes select architectural configurations

Modes can make components, connections, or properties active in particular configurations. This independent fragment illustrates event-driven transitions:

```aadl
system Supervisory_Control
features
  engage: in event port;
  disengage: in event port;
modes
  manual: initial mode;
  automatic: mode;
  manual -[engage]-> automatic;
  automatic -[disengage]-> manual;
end Supervisory_Control;
```

A subcomponent declaration can restrict its activity with `in modes (automatic)`. The [complete modes example](/docs/aadl/examples/modes.aadl) wraps the fragment in a package and supplies a root implementation. The original book uses modes to switch between monitoring and active control. A mode diagram does not by itself specify the controller algorithm or prove that an actuator is safely stopped. Architectural mode reachability and fault-state modeling are also different analyses. {% cite FeilerGluch2012AADL %}

# Analyses

{% include abbr.html term="OSATE" %} is the Open Source AADL Tool Environment. Its ecosystem includes several analyses and extensions; availability depends on the installed tool and version. Check that the chosen tool supports the analysis and model features needed for your question {% cite OSATE2026Capabilities %}.

| Question | Model information needed | Evidence and limitation |
| --- | --- | --- |
| Is the model well formed? | Declarations, imported packages, types, properties, feature references | Diagnostics and successful instantiation; not assurance that the model captures the intended system. |
| Is processor demand plausible? | Active bound tasks, computation demand, periods, processor assumptions | Utilization or resource-budget report; not a universal schedulability test. |
| Can every task meet its deadline? | Supported scheduling policy, priorities, deadlines, execution times, blocking/jitter assumptions | Schedulability result for that model and analysis domain. |
| Can this path meet its latency bound? | Complete flow, component delays, runtime and communication details, analysis options | A calculated range or bound with contributions; inspect missing values and assumptions. |
| Can this bus carry the traffic? | Connection bindings, rates, payload/overhead, capacities, modes | Load/capacity report for the modeled protocol assumptions. |
| Which operational configurations can occur? | Modes, transitions, routed triggers, nested-mode relationships | Reachability results; an unreachable configuration may be intentional. |
| How can faults propagate? | Error Model Annex version 2 ({% include abbr.html term="EMV2" %}) declarations and justified fault assumptions | Fault-propagation and safety-analysis artifacts; topology alone supplies no failure probabilities. |
| Do component contracts establish a system property? | Behavioral assumptions/guarantees and supported solver semantics | {% include abbr.html term="AGREE" %} contract-verification results for those assumptions. |
| Does an architecture satisfy an assurance claim? | Claims, predicates, and supplied evidence | Resolute evaluates an assurance argument; this is distinct from AGREE's behavioral proof obligations. |

The official AADL command-line tooling used for these examples exposes validation, instantiation, latency, bus-load, and mode-reachability commands; it does not expose every desktop analysis {% cite OSATE2026Tooling %}. [AGREE](https://loonwerks.com/tools/agree.html) supplies assume/guarantee reasoning, while [Resolute](https://loonwerks.com/tools/resolute.html) supports architecture assurance arguments.

Other extensions have different jobs: the Behavior Annex adds behavioral descriptions; data-modeling guidance connects architectural data to representations; {% include abbr.html term="ARINC" %} 653 modeling addresses partitioned platforms. {% include abbr.html term="HAMR" %} and Ocarina support code-generation workflows for supported profiles and targets. Do not infer that every AADL model, annex, analysis, and generator interoperates automatically. [HAMR](https://hamr.sireum.org/), [Ocarina](https://ocarina.readthedocs.io/)

## Read a result as a scoped claim

Before accepting a report, identify:

1. **Input:** the source revision, selected root, mode scope, and property provenance.
2. **Method:** the engine/version and analysis options.
3. **Coverage:** what was checked, omitted, unsupported, or bounded.
4. **Outcome:** a completed satisfied/violated requirement, incomplete work, or missing information.
5. **Implication:** what design decision follows—and what still requires measurement, review, or testing.

A report for an older source revision cannot support the current edit. A timeout is not a pass. A missing flow or required contribution must not be treated as evidence of zero latency. Zero diagnostics and a green diagram are not a safety certificate.

# Practice

Answer these before opening the answer notes:

1. Two subcomponents both use `Speed_Filter.basic`. Does changing a binding on one instance necessarily move both? Explain which modeling level is affected.
2. A learner adds a CPU to the root but leaves all processor bindings absent. What is still unknown?
3. A program prints “25% utilization”. What additional information is needed before claiming that all deadlines are met?
4. An end-to-end flow starts at a speed data port but names the connection carrying a disengage event. Why can a good-looking graph still be the wrong model?
5. The analysis fails a fixed latency requirement. Compare reducing computation, changing deployment, and increasing the permitted bound. Which changes preserve the requirement?
6. Transfer the rover's pattern to a greenhouse ventilation controller. Identify sensor, software, actuator, and platform; choose one analysis question and list the assumptions needed to answer it.

<details markdown="1">
<summary>Answer notes</summary>

1. No. The occurrences are separate. An association targeting one instance is different from a classifier-level property shared through its uses; inspect the effective property on each instance.
2. Which processor executes each thread, including whether any allowed set has been resolved into an actual deployment.
3. The task/scheduler model, priorities or scheduling policy, deadlines, execution bounds, and relevant overhead/blocking/jitter assumptions. Utilization alone is insufficient.
4. Flows compose connected endpoints, not approximate visual proximity or similar labels. Trace every source and destination in the resolved model.
5. The first two can preserve the requirement, but their effects need reanalysis. Increasing the bound changes the obligation and is unacceptable when it is fixed.
6. Several architectures are defensible. Assess the correspondence between the physical requirement, chosen architecture, required properties, analysis assumptions, and appropriately limited conclusion.

</details>

## Tutorial

Use the [AADL Architecture and Timing tutorial](/SEBook/architecture/aadl-tutorial) to practice on a complete editable model. Its [print view](/SEBook/architecture/aadl-tutorial/print) keeps the instructions and source available offline. The tutorial's abstract budget model is deliberately separate from the thread-and-processor model used earlier in this chapter.

## Flashcards

{% include flashcards.html id="aadl" %}

## Quiz

{% include quiz.html id="aadl" %}

## Sources and verification

The book material reviewed for this chapter was a **95-page supplied excerpt** containing front matter, Chapter 3 (printed pp. 31–75), and an index—not the complete book. It was published in 2012 with a 2013 copyright notice. The chapter's rover examples are original; the [research notes](/docs/aadl/research.md) document the excerpt boundaries and an apparent connection-reference inconsistency in the book's flow listing. The full paid text of AS5506D was not inspected; its revision metadata was checked against SAE's record.

Language syntax and property definitions were checked against OSATE's `2.20.0-RELEASE` source. Native validation used the official CLI 0.3.0 artifact, which embeds **OSATE 2.21.0-SNAPSHOT**. The [verification record](/docs/aadl/verification.md) gives exact provenance, input hashes, analysis options, successful checks, and the stale-instance failure discovered during repeated runs. It distinguishes native evidence from browser-runtime verification.

For deeper timing treatment, Feiler and Hansson discuss latency and data age across sampling, communication, and partitioning assumptions {% cite FeilerHansson2007Latency %}. The [OSATE documentation](https://osate.org/user/about-osate.html) describes the broader analysis environment. None of these references turns a model result into a measurement of a physical rover.
