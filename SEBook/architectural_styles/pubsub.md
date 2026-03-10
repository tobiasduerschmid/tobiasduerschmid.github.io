---
title: Publish Subscribe
layout: sebook
---

# Overview


## The Essence of Publish-Subscribe
Historically, software components interacted primarily through explicit, synchronous procedure calls—Component A directly invokes a specific method on Component B. However, as systems scaled and became increasingly distributed, this tight coupling proved fragile and difficult to evolve. The *publish-subscribe* architectural style (often referred to as an event-based style or implicit invocation) emerged as a fundamental paradigm shift to resolve this fragility.

In the publish-subscribe style, components interact via asynchronously announced messages, commonly called *events*. The defining characteristic of this style is extreme decoupling through *obliviousness*. A dedicated component takes the role of the *publisher* (or subject) and announces an event to the system's runtime infrastructure. Components that depend on these changes act as *subscribers* (or observers) by registering an interest in specific events. 

The core invariant—the "law of physics" for this style—is dual ignorance:
1.  **Publisher Ignorance:** The publisher does not know the identity, location, or even the existence of any subscribers. It operates on a "fire and forget" principle.
2.  **Subscriber Ignorance:** Subscribers depend entirely on the occurrence of the *event*, not on the specific identity of the publisher that generated it. 

Because the set of event recipients is unknown to the event producer, the correctness of the producer cannot depend on the recipients' actions or availability.

## Structural Paradigms: Elements and Connectors
Like all architectural styles, publish-subscribe restricts the design vocabulary to a specific set of elements, connectors, and topological constraints.

**The Elements**
The primary components in this style are any independent entities equipped with at least one *publish port* or *subscribe port*. A single component may simultaneously act as both a publisher and a subscriber by possessing ports of both types.

**The Event Bus Connector**
The true "rock star" of this architecture is not the components, but the connector. The *event bus* (or event distributor) is an N-way connector responsible for accepting published events and dispatching them to all registered subscribers. All communications strictly route through this intermediary, preventing direct point-to-point coupling between the application components.

**Behavioral Variation: Push vs. Pull Models**
When an event occurs, how does the state information propagate to the subscribers? The literature details two distinct behavioral variations:
*   **The Push Model:** The publisher sends all relevant changed data along with the event notification. This creates a rigid dynamic behavior but is highly efficient if subscribers almost always need the detailed information.
*   **The Pull Model:** The publisher sends a minimal notification simply stating that an event occurred. The subscriber is then responsible for explicitly querying the publisher to retrieve the specific data it needs. This offers greater flexibility but incurs the overhead of additional round-trip messages. 

## Topologies and Variations
While the platonic ideal of publish-subscribe describes a simple bus, embodied implementations in modern distributed systems take several specialized forms:

1.  **List-Based Publish-Subscribe:** In this tighter topology, every publisher maintains its own explicit registry of subscribers. While this reduces the decoupling slightly, it is highly efficient and eliminates the single point of failure that a centralized bus might introduce in a distributed system.
2.  **Broadcast-Based Publish-Subscribe:** Publishers broadcast events to the entire network. Subscribers passively listen and filter incoming messages to determine if they are of interest. This offers the loosest coupling but can be highly inefficient due to the massive volume of discarded messages.
3.  **Content-Based Publish-Subscribe:** Unlike traditional "topic-based" routing (where subscribers listen to predefined channels), content-based routing evaluates the actual attributes of the event payload. Events are delivered only if their internal data matches dynamic, subscriber-defined pattern rules.
4.  **The Event Channel (Gatekeeper) Variant:** Popularized by distributed middleware (like CORBA and enterprise service buses), this introduces a heavy proxy layer. To publishers, the event channel appears as a subscriber; to subscribers, it appears as a publisher. This allows the channel to buffer messages, filter data, and implement complex Quality of Service (QoS) delivery policies without burdening the application components.

##  System Evolution: Quality Attribute Trade-offs
The publish-subscribe style is a strategic tool for architects precisely because it drastically manipulates a system's quality attributes, heavily favoring adaptability at the cost of determinism.

**Promoted Qualities: Modifiability and Reusability**
The primary benefit of this style is extreme *modifiability* and *evolvability*. Because producers and consumers are decoupled, new subscribers can be added to the system dynamically at runtime without altering a single line of code in the publisher. It provides strong support for *reusability*, as components can be integrated into entirely new systems simply by registering them to an existing event bus.

**Inhibited Qualities: Predictability, Performance, and Testability**
*   **Performance Overhead:** The event bus adds a layer of indirection that fundamentally increases latency. 
*   **Lack of Determinism:** Because communication is asynchronous, developers have less control over the exact ordering of messages, and delivery is often not guaranteed. Consequently, publish-subscribe is generally an inappropriate choice for systems with hard real-time deadlines or where strict transactional state sharing is critical.
*   **Testability and Reasoning:** Publish-subscribe systems are notoriously difficult to reason about and test. The non-deterministic arrival of events, combined with the fact that any component might trigger a cascade of secondary events, creates a combinatorial explosion of possible execution paths, making debugging highly complex.

##  Divergent Perspectives and Architectural Smells
A synthesis of the literature reveals critical debates and warnings regarding the implementation of this style.

**The "Wide Coupling" Smell**
While publish-subscribe is lauded for decoupling components, researchers have identified a hidden architectural bad smell: *wide coupling*. If an event bus is implemented too generically (e.g., using a single `receive(Message m)` method where subscribers must cast objects to specific types), a false dependency graph emerges. Every subscriber appears coupled to every publisher on the bus. If a publisher changes its data format, a maintenance engineer cannot easily trace which subscribers will break, effectively destroying the understandability the style was meant to provide.

**The Illusion of Obliviousness vs. Developer Intent**
There is a divergent perspective regarding the "obliviousness" constraint. While components at runtime are technically ignorant of each other, the human developer designing the system is not. Fairbanks cautions against losing design intent: a developer intentionally creates a "New Employee" publisher specifically because they know the "Order Computer" subscriber needs it. If architectural diagrams only show components loosely attached to a bus, the critical "who-talks-to-who" business logic is entirely obscured. 

**The CAP Theorem and Eventual Consistency**
In modern cloud and Service-Oriented Architectures (SOA), publish-subscribe is often used to replicate data and trigger updates across distributed databases. This forces architects into the trade-offs of the *CAP Theorem* (Consistency, Availability, Partition tolerance). Because synchronous, guaranteed delivery over a network is prone to failure, architects often configure publish-subscribe connectors for "best effort" asynchronous delivery. This means the system must embrace *eventual consistency*—accepting that different subscribers will hold stale or inconsistent data for a bounded period of time in exchange for higher system availability and lower latency.

***

### References
*   Bass, L., Clements, P., & Kazman, R. (2012). *Software Architecture in Practice, 3rd Edition*. Addison-Wesley.
*   Buschmann, F., Meunier, R., Rohnert, H., Sommerlad, P., & Stal, M. (1996). *Pattern-Oriented Software Architecture: A System of Patterns, Volume 1*. John Wiley & Sons.
*   Clements, P. et al. (2010). *Documenting Software Architectures: Views and Beyond, 2nd Edition*. Addison-Wesley.
*   Fairbanks, G. (2010). *Just Enough Software Architecture: A Risk-Driven Approach*. Marshall & Brainerd.
*   Garcia, J. et al. (n.d.). *Identifying architectural bad smells*.
*   Garlan, D., & Shaw, M. (1993). *An Introduction to Software Architecture*. Carnegie Mellon University.
*   Garlan, D., Khersonsky, S., & Kim, J. S. (2003). *Model Checking Publish-Subscribe Systems*. Proceedings of the 10th International SPIN Workshop on Model Checking of Software.
*   Rozanski, N., & Woods, E. (2011). *Software Systems Architecture: Working With Stakeholders Using Viewpoints and Perspectives*. Addison-Wesley.