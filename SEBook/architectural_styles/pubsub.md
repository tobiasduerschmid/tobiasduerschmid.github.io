---
title: Publish Subscribe
layout: sebook
---

# Overview


## The Essence of Publish-Subscribe
Historically, software components interacted primarily through explicit, synchronous procedure calls—Component A directly invokes a specific method on Component B. However, as systems scaled and became increasingly distributed, this tight coupling proved fragile and difficult to evolve. The *publish-subscribe* architectural style (often referred to as an event-based style or implicit invocation) emerged as a fundamental paradigm shift to resolve this fragility {% cite Garlan1993 %}.

In the publish-subscribe style, components interact via asynchronously announced messages, commonly called *events*. The defining characteristic of this style is extreme decoupling through *obliviousness*. A dedicated component takes the role of the *publisher* (or subject) and announces an event to the system's runtime infrastructure. Components that depend on these changes act as *subscribers* (or observers) by registering an interest in specific events. 

The core invariant—the "law of physics" for this style—is dual ignorance:
1.  **Publisher Ignorance:** The publisher does not know the identity, location, or even the existence of any subscribers. It operates on a "fire and forget" principle.
2.  **Subscriber Ignorance:** Subscribers depend entirely on the occurrence of the *event*, not on the specific identity of the publisher that generated it. 

Because the set of event recipients is unknown to the event producer, the correctness of the producer cannot depend on the recipients' actions or availability.

This is the key difference from direct communication. In direct communication, the sender calls a known receiver and can usually detect that the receiver is unavailable. In publish-subscribe, the sender publishes to a topic and moves on. That buys extensibility - new publishers and subscribers can appear without editing existing components - but it also means the publisher cannot rely on some particular subscriber doing the work.

## Structural Paradigms: Elements and Connectors
Like all architectural styles, publish-subscribe restricts the design vocabulary to a specific set of elements, connectors, and topological constraints.

**The Elements**
The primary components in this style are any independent entities equipped with at least one *publish port* or *subscribe port*. A single component may simultaneously act as both a publisher and a subscriber by possessing ports of both types {% cite Clements2010 %}.

**The Event Bus Connector**
The true "rock star" of this architecture is not the components, but the connector. The *event bus* (or event distributor) is an N-way connector responsible for accepting published events and dispatching them to all registered subscribers. All communications strictly route through this intermediary, preventing direct point-to-point coupling between the application components.

The canonical topology looks like this — publishers on one side, the topic in the middle, subscribers on the other. Crucially, **no arrow ever crosses directly between a publisher and a subscriber**:

<div class="uml-class-diagram-container" data-uml-type="component" data-uml-spec='@startuml
component Publisher1
component Publisher2
component Topic
component Subscriber1
component Subscriber2
component Subscriber3
Publisher1 --> Topic : publish(event)
Publisher2 --> Topic : publish(event)
Topic --> Subscriber1 : notify
Topic --> Subscriber2 : notify
Topic --> Subscriber3 : notify
note bottom of Topic
  Publisher and Subscriber
  never reference each other —
  the topic is the only coupling point.
end note
@enduml'></div>

**Behavioral Variation: Push vs. Pull Models**
When an event occurs, how does the state information propagate to the subscribers? The literature details two distinct behavioral variations:
*   **The Push Model:** The publisher sends all relevant changed data along with the event notification. This creates a rigid dynamic behavior but is highly efficient if subscribers almost always need the detailed information.
*   **The Pull Model:** The publisher sends a minimal notification simply stating that an event occurred. The subscriber is then responsible for explicitly querying the publisher to retrieve the specific data it needs. This offers greater flexibility but incurs the overhead of additional round-trip messages {% cite Buschmann1996 %}. 

## Topologies and Variations
While the platonic ideal of publish-subscribe describes a simple bus, embodied implementations in modern distributed systems take several specialized forms:

1.  **List-Based Publish-Subscribe:** In this tighter topology, every publisher maintains its own explicit registry of subscribers. While this reduces the decoupling slightly, it is highly efficient and eliminates the single point of failure that a centralized bus might introduce in a distributed system.
2.  **Broadcast-Based Publish-Subscribe:** Publishers broadcast events to the entire network. Subscribers passively listen and filter incoming messages to determine if they are of interest. This offers the loosest coupling but can be highly inefficient due to the massive volume of discarded messages.
3.  **Content-Based Publish-Subscribe:** Unlike traditional "topic-based" routing (where subscribers listen to predefined channels), content-based routing evaluates the actual attributes of the event payload. Events are delivered only if their internal data matches dynamic, subscriber-defined pattern rules {% cite Bass2012 %}.
4.  **The Event Channel (Gatekeeper) Variant:** Popularized by distributed middleware (like CORBA and enterprise service buses), this introduces a heavy proxy layer. To publishers, the event channel appears as a subscriber; to subscribers, it appears as a publisher. This allows the channel to buffer messages, filter data, and implement complex Quality of Service (QoS) delivery policies without burdening the application components.

##  System Evolution: Quality Attribute Trade-offs
The publish-subscribe style is a strategic tool for architects precisely because it drastically manipulates a system's quality attributes, heavily favoring adaptability at the cost of determinism.

**Promoted Qualities: Modifiability and Reusability**
The primary benefit of this style is extreme *modifiability* and *evolvability*. Because producers and consumers are decoupled, new subscribers can be added to the system dynamically at runtime without altering a single line of code in the publisher. It provides strong support for *reusability*, as components can be integrated into entirely new systems simply by registering them to an existing event bus {% cite Rozanski2011 %}.

**Inhibited Qualities: Predictability, Performance, and Testability**
*   **Performance Overhead:** The event bus adds a layer of indirection that fundamentally increases latency. 
*   **Lack of Determinism:** Because communication is asynchronous, developers have less control over the exact ordering of messages, and delivery is often not guaranteed. Consequently, publish-subscribe is generally an inappropriate choice for systems with hard real-time deadlines or where strict transactional state sharing is critical.
*   **Testability and Reasoning:** Publish-subscribe systems are notoriously difficult to reason about and test. The non-deterministic arrival of events, combined with the fact that any component might trigger a cascade of secondary events, creates a combinatorial explosion of possible execution paths, making debugging highly complex.
*   **Robustness for mandatory work:** If a sender must know that a specific receiver processed the message, strict publish-subscribe is the wrong default. A brake command, payment authorization, or safety-critical shutdown request may require direct acknowledgment, retry, or a stronger messaging protocol.

Publish-subscribe can also inhibit **understandability**. A component diagram may show that several components are connected to the same topic, but the diagram alone may not show which publication causes which subscriber action, or whether subscriber actions trigger secondary events. For complex systems, teams often need runtime tracing, topic inventories, contract tests, and live component-and-connector views to recover the causal story.

## Real-World Topic Bugs

Robotics systems commonly use publish-subscribe middleware. The Robot Operating System (ROS), MQTT, DDS, and Apache Kafka all impose variants of this style. By adopting one of these frameworks, a team also inherits the quality-attribute trade-offs of the style.

A real Autoware.AI bug illustrates the risk. Autoware.AI is an open-source self-driving-car framework that uses ROS topics. One commit renamed a topic inconsistently: one component published to a new topic name while other components still subscribed to the old topic name. The code compiled, the components still existed, and each local implementation looked reasonable. At runtime, however, the intended message flow was broken because publishers and subscribers were silently attached to different named channels.

This bug is hard because publish-subscribe intentionally removes direct references. The publisher does not know which subscribers should exist, and a subscriber may simply receive no messages without throwing a local error. That is the same decoupling that makes the style extensible. It is also why strict topic naming, schema registries, integration tests, and runtime observability matter in publish-subscribe systems.

##  Divergent Perspectives and Architectural Smells
A synthesis of the literature reveals critical debates and warnings regarding the implementation of this style.

**The "Wide Coupling" Smell**
While publish-subscribe is lauded for decoupling components, researchers have identified a hidden architectural bad smell: *wide coupling*. If an event bus is implemented too generically (e.g., using a single `receive(Message m)` method where subscribers must cast objects to specific types), a false dependency graph emerges. Every subscriber appears coupled to every publisher on the bus. If a publisher changes its data format, a maintenance engineer cannot easily trace which subscribers will break, effectively destroying the understandability the style was meant to provide {% cite Garcia2009 %}.

**The Illusion of Obliviousness vs. Developer Intent**
There is a divergent perspective regarding the "obliviousness" constraint. While components at runtime are technically ignorant of each other, the human developer designing the system is not. Fairbanks cautions against losing design intent: a developer intentionally creates a "New Employee" publisher specifically because they know the "Order Computer" subscriber needs it. If architectural diagrams only show components loosely attached to a bus, the critical "who-talks-to-who" business logic is entirely obscured {% cite Fairbanks2010 %}. 

**The CAP Theorem and Eventual Consistency**
In modern cloud and Service-Oriented Architectures (SOA), publish-subscribe is often used to replicate data and trigger updates across distributed databases. This forces architects into the trade-offs of the *CAP Theorem* (Consistency, Availability, Partition tolerance). Because synchronous, guaranteed delivery over a network is prone to failure, architects often configure publish-subscribe connectors for "best effort" asynchronous delivery. This means the system must embrace *eventual consistency*—accepting that different subscribers will hold stale or inconsistent data for a bounded period of time in exchange for higher system availability and lower latency.


## Production Variations and Quality of Service

Production publish-subscribe frameworks offer knobs that relax or strengthen the pure style:

* **Topic-based routing:** subscribers register for named channels such as `market.quotes.NASDAQ`. This is simple and fast, but topic names become part of the architecture.
* **Content-based routing:** subscribers express predicates over event contents, such as `company == "TELCO" and price < 100`. This is more expressive, but matching costs more at the broker.
* **Durable subscriptions:** the broker stores messages while a subscriber is disconnected and delivers them later. This improves reliability but adds storage cost and stale-message concerns.
* **Delivery guarantees:** frameworks often distinguish "at most once," "at least once," and "exactly once" delivery. Stronger guarantees reduce message loss but increase latency, coordination, and duplicate-handling complexity.

These variations are not just middleware configuration. They are architectural decisions because they change the system's quality profile. A high-frequency telemetry stream may accept occasional loss for lower latency. A billing workflow may need stronger delivery guarantees and idempotent consumers even if that costs throughput.

## Framework Examples

Common publish-subscribe technologies include:

* **DDS (Data Distribution Service):** used in ROS 2 and other real-time distributed systems.
* **MQTT:** a lightweight protocol for low-bandwidth, unreliable, or resource-constrained IoT environments.
* **Apache Kafka:** a high-throughput event-streaming platform built around durable logs and partitioned topics.
* **RabbitMQ:** message-oriented middleware that supports flexible routing and queue-based delivery.

The framework does not remove the architectural trade-off. It packages one version of the trade-off so that teams can use it consistently.

# Publish-Subscribe Quiz and Flashcards
{: #publish-subscribe-review-and-practice }

Use these flashcards and quiz questions to check whether you can reason about publisher/subscriber ignorance, event-bus trade-offs, routing variants, delivery guarantees, topic bugs, and the observability needed to make publish-subscribe systems understandable.

{% include flashcards.html id="architectural_style_pubsub" %}

{% include quiz.html id="architectural_style_pubsub" %}
