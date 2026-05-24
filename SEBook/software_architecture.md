---
title: Software Architecture
layout: sebook
---

# Introduction: Defining the Intangible

## Definitions of Software Architecture

The quest to definitively answer "What is software architecture?" has various answers. The literature reveals that software engineering has not committed to a single, universal definition, but rather a "scatter plot" of over 150 definitions, each highlighting specific aspects of the discipline {% cite Clements2010 %}. However, as the field has matured, a consensus centroid has emerged around two prevailing paradigms: the *structural* and the *decision-based*.

**The Structural Paradigm**
The earliest and most prominent foundational definitions view architecture through a highly structural lens. Dewayne Perry and Alexander Wolf originally proposed that architecture is analogous to building construction, formalized as the formula: **Architecture = {Elements, Form, Rationale}** {% cite Perry1992 %}. This established that architecture consists of processing, data, and connecting elements organized into specific topologies. 

This definition evolved into the modern industry standard, which posits that a software system's architecture is ==**"the set of structures needed to reason about the system, which comprise software elements, relations among them, and properties of both"**== {% cite Bass2012 %}. This structural view insists that architecture is inherently multidimensional. A system is not defined by a single structure, but by a combination of *module structures* (how code is divided), *component-and-connector structures* (how elements interact at runtime), and *allocation structures* (how software maps to hardware and organizational environments) {% cite Bass2012 %}.

**The Decision-Based Paradigm**
Conversely, a different definition reorients architecture away from "drawing boxes and lines" and towards the element of *decision-making*. In this view, software architecture is defined as **"the set of principal design decisions governing a system"** {% cite Taylor2009 %}. An architectural decision is deemed *principal* if its impact is far-reaching. This perspective implies that architecture is not merely the end result, but the culmination of rationale, context, and the compromises made by stakeholders over the historical evolution of the software system.

These two definitions are complementary, but they answer different questions. The structural definition treats architecture as a snapshot: a set of models that can be studied to predict properties of the system. The decision-based definition treats architecture more like a history: the record of consequential choices and the rationale behind them. In practice, useful architecture documentation needs both. A component diagram may show that a payment service publishes events to a broker; an architecture decision record explains *why* the team chose asynchronous events instead of direct calls.

The important point is that architecture is not documentation for its own sake. Architecture is the part of the design we capture so that we can reason about consequences before the full system exists: Will this system meet its latency target? Can we add a new sensor without rewriting the image-processing code? What happens if a node fails? Which teams must coordinate to change this interface?

**Divergent Perspective: The Architecture vs. Design Debate**
A recurring debate within the literature is the precise boundary between *architecture* and *design*. Grady Booch famously noted, "All architecture is design, but not all design is architecture" {% cite Booch2005 %}. However, the industry has historically struggled to define where architecture ends and design begins, often relying on the flawed concept of "detailed design". 

The literature heavily criticizes the notion that architecture is simply design *without detail*. Asserting that architecture represents a "small set of big design decisions" or is restricted to a certain page limit is dismissed as "utter nonsense" {% cite Clements2010 %}. Architectural decisions can be highly detailed—such as mandating specific XML schemas, thread-safety constraints, or network latency limits. 

Instead of differentiating by detail, the literature suggests differentiating by *context and constraint*. Architecture establishes the boundaries and constraints for downstream developers. Any decision that must be bound to achieve the system’s overarching business or quality goals is an *architectural design*. Everything else is left to the discretion of implementers and should simply be termed *nonarchitectural design*, eradicating the phrase "detailed design" entirely.

## Architectural Drivers

Architectures are shaped by **architectural drivers**, also called **architecturally significant requirements**. A requirement becomes architecturally significant when changing it would plausibly change the architecture. These drivers are usually high in both importance and difficulty: they matter to stakeholders, and they cannot be satisfied by a small localized implementation choice.

Three kinds of drivers matter most:

* **High-level functional requirements:** the major capabilities the system must provide. At architecture time, these are broad capabilities such as "the system shall allow users to book flights," not every low-level user story for every screen.
* **Constraints:** business or technical decisions that have already been made and therefore reduce the design space. "The system must use MySQL because the customer standardizes on it" is not a requirement to discover; it is a decision the architecture must live within.
* **Quality attributes:** measurable characteristics of how well the system performs its functions, such as performance, availability, security, interoperability, modifiability, and testability.

The distinction between requirements and constraints is subtle but useful. A requirement says what the system must accomplish. A constraint has already made part of the design decision for us. "Store customer data durably" is a requirement; "store customer data in the organization's existing PostgreSQL cluster" is a constraint.

Attribute-Driven Design (ADD) turns those drivers into an iterative design loop: choose a quality attribute to improve, select a part of the system to refine, sketch candidate designs, analyze the effects on the target quality and on competing qualities, and iterate. The output is not a perfect first architecture. The output is a design that becomes more deliberate each time a driver forces a trade-off.

## Architectural Views

No single diagram can answer every architectural question. Different views expose different structures, and each structure supports different reasoning:

| View | Main elements | Relations | Best for reasoning about |
| --- | --- | --- | --- |
| Module view | Source files, packages, libraries, layers, classes | imports, uses, depends on, allowed-to-use | maintainability, changeability, information hiding |
| Data view | entities, tables, records, schemas | keys, references, ownership | data structure, persistence, semantic consistency |
| Component-and-connector view | independently deployable runtime units, such as processes, services, nodes, brokers | calls, publishes, subscribes, message flows, protocols | runtime communication, deployment, availability, inter-component bottlenecks |
| Behavioral view | objects, components, states, messages over time | temporal order, causal flow, transitions | protocols, complex interactions, performance bottlenecks, race conditions |

The module view and the component-and-connector view are especially easy to confuse. A **module** is a design-time unit of code. A **component** in software architecture is an independently deployable runtime unit: something that can execute for a prolonged period, such as a process, service, worker, or broker. A shared C++ library might appear once in the module view and be compiled into both a client executable and a server executable in the runtime view. That means the two views are related, but they are not the same view.

This distinction matters because each view supports only some claims. A layered module view can justify claims about modifiability or portability because it shows dependency direction. It cannot, by itself, justify claims about availability because modules do not fail independently at runtime. Availability has to be reasoned about from runtime components, deployment, faults, recovery behavior, and monitoring.

## The Dichotomy of Architecture

A profound insight within the study of software systems is that architecture is not a monolithic truth; it experiences an inevitable split over time. Every software system is characterized by a fundamental dichotomy: the architecture it was *supposed* to have, and the architecture it *actually* has.

**Prescriptive vs. Descriptive Architecture**
The architecture that exists in the minds of the architects, or is documented in formal models and UML diagrams, is known as the *prescriptive architecture* (or *target architecture*). This represents the system *as-intended* or *as-conceived*. It acts as the prescription for construction, establishing the rules, constraints, and structural blueprints for the development team.

However, the reality of software engineering is that development teams do not always perfectly execute this prescription. As code is written, a new architecture emerges—the *descriptive architecture* (or *actual architecture*). This is the architecture *as-realized* in the source code and physical build artifacts. 

A common misperception among novices is that the visual diagrams and documentation *are* the architecture. The literature firmly refutes this: representations are merely pictures, whereas the *real* architecture consists of the actual structures present in the implemented source code {% cite EelesCripps2009 %}.

**Architectural Degradation: Drift and Erosion**
In a perfect world, the prescriptive architecture (the plan) and the descriptive architecture (the code) would remain identical. In practice, due to developer sloppiness, tight deadlines, a lack of documentation, or the need to aggressively optimize performance, developers often introduce structural changes directly into the source code without updating the architectural blueprint {% cite Taylor2009 %}.

This discrepancy between the as-intended plan and the as-realized code is known as *architectural degradation*. This degradation manifests in two distinct phenomena:
*   **Architectural Drift:** This occurs when developers introduce new principal design decisions into the source code that are not encompassed by the prescriptive architecture, but which do not explicitly violate any of the architect's established rules {% cite Taylor2009 %}. Drift subtly reduces the clarity of the system over time.
*   **Architectural Erosion:** This occurs when the actual architecture begins to deviate from and directly violate the fundamental rules and constraints of the intended architecture. 

If a system's architecture is allowed to drift and erode without reconciliation, the descriptive and prescriptive architectures diverge completely. When this happens, the system loses its conceptual integrity, technical debt accumulates in the source code, and the system eventually becomes unmaintainable, necessitating a complete architectural recovery or overhaul {% cite Taylor2009 %}.

{% include quiz.html id="software_architecture" %}
