---
title: Software Architecture
layout: sebook
---

# Introduction: Defining the Intangible

## Definitions of Software Architecture

The quest to definitively answer "What is software architecture?" has various, different answers. The literature reveals that software engineering have not committed to a single, universal definition, but rather a "scatter plot" of over 150 definitions, each highlighting specific aspects of the discipline {% cite Clements2010 %}. However, as the field has matured, a consensus centroid has emerged around two prevailing paradigms: the *structural* and the *decision-based*.

**The Structural Paradigm**
The earliest and most prominent foundational definitions view architecture through a highly structural lens. Dewayne Perry and Alexander Wolf originally proposed that architecture is analogous to building construction, formalized as the formula: **Architecture = {Elements, Form, Rationale}** {% cite Perry1992 %}. This established that architecture consists of processing, data, and connecting elements organized into specific topologies. 

This definition evolved into the modern industry standard, which posits that a software system's architecture is **"the set of structures needed to reason about the system, which comprise software elements, relations among them, and properties of both"** {% cite Bass2012 %}. This structural view insists that architecture is inherently multidimensional. A system is not defined by a single structure, but by a combination of *module structures* (how code is divided), *component-and-connector structures* (how elements interact at runtime), and *allocation structures* (how software maps to hardware and organizational environments) {% cite Bass2012 %}.

**The Decision-Based Paradigm**
Conversely, a different definition reorients architecture away from "drawing boxes and lines" and towards the element of *decision-making*. In this view, software architecture is defined as **"the set of principal design decisions governing a system"** {% cite Taylor2009 %}. An architectural decision is deemed *principal* if its impact is far-reaching. This perspective implies that architecture is not merely the end result, but the culmination of rationale, context, and the compromises made by stakeholders over the historical evolution of the software system.

**Divergent Perspective: The Architecture vs. Design Debate**
A recurring debate within the literature is the precise boundary between *architecture* and *design*. Grady Booch famously noted, "All architecture is design, but not all design is architecture" {% cite Booch2005 %}. However, the industry has historically struggled to define where architecture ends and design begins, often relying on the flawed concept of "detailed design". 

The literature heavily criticizes the notion that architecture is simply design *without detail*. Asserting that architecture represents a "small set of big design decisions" or is restricted to a certain page limit is dismissed as "utter nonsense" {% cite Clements2010 %}. Architectural decisions can be highly detailed—such as mandating specific XML schemas, thread-safety constraints, or network latency limits. 

Instead of differentiating by detail, the literature suggests differentiating by *context and constraint*. Architecture establishes the boundaries and constraints for downstream developers. Any decision that must be bound to achieve the system’s overarching business or quality goals is an *architectural design*. Everything else is left to the discretion of implementers and should simply be termed *nonarchitectural design*, eradicating the phrase "detailed design" entirely.

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

