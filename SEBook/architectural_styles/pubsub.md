---
title: Publish Subscribe
layout: sebook
---

# Overview

The narrated lesson follows a campus delivery robot from direct calls to a topic, then through the style's four rules and the trade-offs they bring. The sections below go deeper.

{% include narration.html topic="publish_subscribe" %}

## The Essence of Publish-Subscribe
Historically, software components interacted primarily through explicit, synchronous procedure calls—Component A directly invokes a specific method on Component B. However, as systems scaled and became increasingly distributed, this tight coupling proved fragile and difficult to evolve. The *publish-subscribe* architectural style (often referred to as an event-based style or implicit invocation) emerged as a fundamental paradigm shift to resolve this fragility {% cite Garlan1993 %}.

In the publish-subscribe style, components interact via asynchronously announced messages, commonly called *events*. The defining characteristic of this style is extreme decoupling through *obliviousness*. A component takes the role of a *publisher* and announces an event to a *topic*, a named channel that the system's runtime infrastructure manages. Components that depend on these events act as *subscribers* by registering an interest in the topic.

Four constraints give the style its power; the narrated lesson calls them its four rules:
1.  **Publisher ignorance:** A publisher must not rely on the presence or identity of any subscriber. It operates on a "fire and forget" principle.
2.  **Subscriber ignorance:** A subscriber must not rely on the identity of the publisher; it subscribes to the *event*, not to its source.
3.  **One-way propagation:** Information flows strictly from publisher to subscriber. Publishing returns no value; an answer, if there is one, travels as a new event on another topic.
4.  **Asynchronous publishing:** The publisher does not block while its subscribers handle an event. Some event systems notify synchronously instead, and there a slow subscriber does stall the publisher, which is why *Documenting Software Architectures* asks you to record when a publisher can be blocked {% cite Clements2010 %}.

Because the set of event recipients is unknown to the event producer, the correctness of the producer cannot depend on the recipients' actions or availability.

**Publish-subscribe and the Observer pattern.** The Observer design pattern looks similar: a *subject* keeps a list of *observers* and notifies each one, and some books call Observer itself Publisher-Subscriber {% cite Buschmann1996 %}. The difference is one of kind. Observer is a design pattern for objects in an object-oriented program, while publish-subscribe is an architectural style that does not depend on any programming paradigm. In the topic-based form this chapter draws, the topic, not the publisher, keeps the list of subscribers, and it may run in another process or on another machine; in the list-based form, each publisher keeps its own subscription list, much as an Observer subject does {% cite Bass2012 %}.

This is the key difference from direct communication. In direct communication, the sender calls a known receiver and can usually detect that the receiver is unavailable. In publish-subscribe, the sender publishes to a topic and moves on. That buys extensibility - new publishers and subscribers can appear without editing existing components - but it also means the publisher cannot rely on some particular subscriber doing the work.

## Structural Paradigms: Elements and Connectors
Like all architectural styles, publish-subscribe restricts the design vocabulary to a specific set of elements, connectors, and topological constraints.

**The Elements**
The primary components in this style are any independent entities equipped with at least one *publish port* or *subscribe port*. A single component may simultaneously act as both a publisher and a subscriber by possessing ports of both types {% cite Clements2010 %}.

**The Event Bus Connector**
The true "rock star" of this architecture is not the components, but the connector. The *event bus* (or event distributor) is an N-way connector responsible for accepting published events and dispatching them to all registered subscribers. All communications strictly route through this intermediary, preventing direct point-to-point coupling between the application components.

The canonical topology looks like this: publishers above, the topic in the middle, subscribers below. Crucially, **no line ever runs directly between a publisher and a subscriber**, and the topic is the only coupling point. The figure uses the narrated lesson's notation: each component meets its attachment at a port, and the topic is a connector, drawn as a channel without ports. UML has no shape for a connector that joins many components; *Documenting Software Architectures* also allows drawing such a connector as a component stereotyped by its connector type, with a port for each of its roles {% cite Clements2010 %}.

<div class="cnc-figure-wrap" tabindex="0" role="region" aria-label="Publish-subscribe topology figure; scroll sideways on a narrow screen">
<svg class="cnc-figure" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 820 440" role="img" aria-labelledby="pubsub-topology-title pubsub-topology-desc">
  <title id="pubsub-topology-title">Publish-subscribe topology in a component-and-connector view</title>
  <desc id="pubsub-topology-desc">Two publishers, the Obstacle detector and the Laser detector, each attach from a port on their lower edge to the /obstacles topic, drawn as a long channel. Three subscribers, the Planner, the Logger, and the Dashboard, each attach from the channel to a port on their upper edge. Arrows point from the publishers into the topic and from the topic to the subscribers, and no line joins a publisher to a subscriber.</desc>
  <rect class="cnc-frame" x="4" y="4" width="812" height="432" rx="2"/>
  <path class="cnc-tab" d="M4 4 H330 V26 L312 44 H4 Z"/>
  <text x="16" y="31"><tspan class="cnc-mono">cmp</tspan> C&amp;C view: publish-subscribe</text>
  <g aria-hidden="true">
    <rect class="cnc-component" x="95" y="64" width="210" height="56" rx="3"/>
    <rect class="cnc-component" x="335" y="64" width="210" height="56" rx="3"/>
    <rect class="cnc-component" x="70" y="300" width="180" height="56" rx="3"/>
    <rect class="cnc-component" x="320" y="300" width="180" height="56" rx="3"/>
    <rect class="cnc-component" x="570" y="300" width="180" height="56" rx="3"/>
    <path class="cnc-icon" d="M282 68 h16 v14 h-16 Z M278 70.5 h8 v3 h-8 Z M278 76 h8 v3 h-8 Z M522 68 h16 v14 h-16 Z M518 70.5 h8 v3 h-8 Z M518 76 h8 v3 h-8 Z M227 304 h16 v14 h-16 Z M223 306.5 h8 v3 h-8 Z M223 312 h8 v3 h-8 Z M477 304 h16 v14 h-16 Z M473 306.5 h8 v3 h-8 Z M473 312 h8 v3 h-8 Z M727 304 h16 v14 h-16 Z M723 306.5 h8 v3 h-8 Z M723 312 h8 v3 h-8 Z"/>
    <rect class="cnc-channel" x="60" y="184" width="700" height="44" rx="22"/>
    <path class="cnc-line" d="M200 126 V172 M440 126 V172 M160 228 V282 M410 228 V282 M660 228 V282"/>
    <path class="cnc-head" d="M194 172 L206 172 L200 184 Z M434 172 L446 172 L440 184 Z M154 282 L166 282 L160 294 Z M404 282 L416 282 L410 294 Z M654 282 L666 282 L660 294 Z"/>
    <path class="cnc-port" d="M194 114 h12 v12 h-12 Z M434 114 h12 v12 h-12 Z M154 294 h12 v12 h-12 Z M404 294 h12 v12 h-12 Z M654 294 h12 v12 h-12 Z"/>
  </g>
  <text class="cnc-name" x="196" y="107">Obstacle detector</text>
  <text class="cnc-name" x="436" y="107">Laser detector</text>
  <text x="574" y="172"><tspan class="cnc-stereo">«topic»</tspan> <tspan class="cnc-mono">/obstacles</tspan></text>
  <text class="cnc-name" x="156" y="343">Planner</text>
  <text class="cnc-name" x="406" y="343">Logger</text>
  <text class="cnc-name" x="656" y="343">Dashboard</text>
  <g aria-hidden="true">
    <rect class="cnc-component" x="74" y="402" width="24" height="16" rx="2"/>
    <rect class="cnc-channel" x="230" y="402" width="36" height="16" rx="8"/>
    <path class="cnc-line" d="M462 410 H482"/>
    <path class="cnc-head" d="M482 404 L494 410 L482 416 Z"/>
  </g>
  <text x="20" y="416">Key:</text>
  <text x="106" y="416">component</text>
  <text x="274" y="416"><tspan class="cnc-stereo">«topic»</tspan> connector</text>
  <text x="502" y="416">publish or deliver</text>
</svg>
</div>

### CRC Cards: Event Channel

Buschmann et al.'s basic Publisher–Subscriber pattern uses direct subscriptions, as in [Observer](/SEBook/designpatterns/observer.html#crc-cards). Their **Event Channel** variant introduces the intermediary used by this chapter's bus topology {% cite Buschmann1996 %}, pp. 341–342. These Class, Responsibility, Collaborator (CRC) cards summarize that variant at component level, omitting its middleware proxy objects. Responsibilities and collaborators are independent lists, not paired rows.

<pre><code class="diagram-crc">
@startuml
caption: An event channel owns subscription and dispatch, so publishers and subscribers need no direct references to each other.
layout auto
card Publisher {
  responsibility: Detect an event worth publishing
  responsibility: Submit the event to the channel
  collaborator: Event Channel
}
card "Event Channel" as Channel {
  responsibility: Maintain subscriber registrations
  responsibility: Accept published events
  responsibility: Dispatch events to matching subscribers
  collaborator: Publisher
  collaborator: Subscriber
}
card Subscriber {
  responsibility: Register its interests with the channel
  responsibility: Receive events matching those interests
  responsibility: React within its own application role
  collaborator: Event Channel
}
@enduml
</code></pre>

The channel can add buffering, filtering, or delivery policies; the presence of a channel alone does not guarantee reliable delivery or a particular order. The direct pull model discussed below introduces a dependency on the publisher's query interface and therefore has different coupling from this event-channel sketch.

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

**Promoted Qualities: Extensibility, Run-Time Flexibility, Modifiability, and Availability**
Each benefit follows from one of the four constraints:
*   **Extensibility** (publisher ignorance): new subscribers can be added without altering a single line of code in the publisher.
*   **Run-time flexibility** (publisher ignorance): components subscribe and unsubscribe while the system runs, so connections are bound late.
*   **Modifiability: replace a publisher** (subscriber ignorance): any publisher can be replaced by one that sends the same events, and no subscriber changes. The same decoupling lets components be reused in entirely new systems simply by registering them with an existing event bus {% cite Rozanski2011 %}.
*   **Availability: fault isolation** (one-way propagation and asynchronous publishing): a slow or crashed subscriber cannot stall its publisher or the other subscribers.

**Inhibited Qualities: Robustness, Understandability, Testability, and Performance**
*   **Robustness** (publisher ignorance and one-way propagation): a direct call reports a missing receiver, but a publisher never learns who received an event, and delivery is often not guaranteed. If a sender must know that a specific receiver processed the message, strict publish-subscribe is the wrong default. A brake command, payment authorization, or safety-critical shutdown request may require a direct call with acknowledgment, retry, or a stronger messaging protocol.
*   **Understandability** (publisher and subscriber ignorance): a component diagram may show that several components are connected to the same topic, but the diagram alone may not show which publication causes which subscriber action, or whether subscriber actions trigger secondary events. For complex systems, teams often need runtime tracing, topic inventories, contract tests, and live component-and-connector views to recover the causal story.
*   **Testability** (asynchronous publishing): developers have less control over the exact ordering of messages. The non-deterministic arrival of events, combined with the fact that any component might trigger a cascade of secondary events, creates a combinatorial explosion of possible execution paths, so a test that passes once may fail the next time, and debugging becomes highly complex.
*   **Performance: latency** (the topic in between): the event bus adds a layer of indirection that increases latency. Together with uncertain delivery and ordering, this makes publish-subscribe a poor choice for systems with hard real-time deadlines or where strict transactional state sharing is critical.

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
