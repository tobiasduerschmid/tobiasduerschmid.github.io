---
title: Architectural Tactics
layout: sebook
---

# Architectural Tactics
{: #architectural-tactics-overview }

Architectural styles describe the dominant shape of a system: pipe-and-filter, layered, publish-subscribe, client-server, and so on. **Architectural tactics** are smaller design moves that an architect uses to improve one quality attribute inside that larger shape.

Think of tactics as the architect's quality-attribute toolbox. A style says, "organize this subsystem as independent filters connected by pipes." A tactic says, "add a watchdog and timeout so failed components are detected quickly," or "add a cache so repeated requests avoid expensive reacquisition."

Tactics are useful because they make quality attributes concrete. Instead of saying "make it available," the architect can ask: What failure do we need to detect? How quickly? What recovery action happens after detection? What performance cost are we willing to pay for that detection?

## Tactics vs. Styles

| Concept | Scope | Example | Main question |
| --- | --- | --- | --- |
| Architectural style | Shapes the gross structure of a subsystem or whole system | publish-subscribe, layered, pipe-and-filter | What element types, connector types, and constraints dominate this design? |
| Architectural tactic | Improves a target quality attribute through a reusable design move | heartbeat, ping-echo, caching, redundancy | Which quality scenario improves, and what qualities does the tactic trade away? |

A system usually combines both. A robot might use publish-subscribe as its communication style, then apply heartbeat to detect failed components and caching to avoid repeatedly recomputing expensive map data.

# Availability Tactics

Availability is the ability of a system to mask, detect, repair, or recover from faults. Many availability tactics start with the same problem: before a system can recover from a failed component, it has to notice the failure.

## Ping-Echo

**Goal:** detect that a component, process, node, or service has stopped responding before the fault escalates into a visible failure.

**Solution:** a watchdog periodically sends an asynchronous request, the **ping**, to each monitored component. A healthy component replies with an **echo**. If the watchdog does not receive the echo before a timeout, it activates a recovery mechanism, such as restarting the component, routing around it, or starting a replacement instance.

**Quality impact:**

* **Promotes availability:** the system can detect failed components and trigger recovery.
* **Inhibits performance:** pings and echoes consume network bandwidth, processing cycles, and queue capacity.
* **Simplifies monitored components:** most of the logic lives in the watchdog; a monitored component only needs to answer the ping.

Ping-echo is a good fit when the watchdog controls the monitoring schedule and when the extra request-response traffic is acceptable.

## Heartbeat

**Goal:** detect that a component, process, node, or service has stopped working.

**Solution:** each monitored component periodically sends a **heartbeat** message to a watchdog. If the watchdog does not receive a heartbeat before a timeout, it activates recovery.

**Quality impact:**

* **Promotes availability:** the system can infer failure from silence.
* **Inhibits performance:** heartbeat messages consume resources, though usually fewer messages than ping-echo because there is no request-response pair.
* **Complicates monitored components:** every monitored component needs a heartbeat routine and must keep sending heartbeats even while doing its normal work.

Heartbeat is a good fit when monitored components already have their own control loop, or when reducing monitoring traffic matters more than keeping monitored components simple.

## Ping-Echo vs. Heartbeat

| Tactic | Who initiates the message? | Message pattern | Main benefit | Main cost |
| --- | --- | --- | --- | --- |
| Ping-echo | Watchdog | watchdog ping, component echo | simple monitored components | more messages and centralized monitoring work |
| Heartbeat | Monitored component | component heartbeat | fewer messages and easy passive monitoring | heartbeat logic inside every monitored component |

Both tactics need carefully chosen timeout values. A timeout that is too short creates false positives and unnecessary recovery. A timeout that is too long lets failures remain hidden.

## Redundancy

Redundancy improves availability by ensuring that another component can take over when one component fails.

* **Active redundancy:** multiple replicas run at the same time. If one fails, another already-running replica can continue service quickly. This improves recovery time but costs more CPU, memory, and coordination.
* **Cold spare:** a backup component is available but not running the workload until failure occurs. This saves resources but recovery is slower because the spare must be started, warmed up, or synchronized.

Redundancy is rarely enough on its own. The system still needs detection, failover, state synchronization, and tests that prove the recovery path actually works.

# Performance Tactic: Caching

**Goal:** avoid expensive reacquisition or recomputation of a resource.

**Solution:** store a local copy of a resource in a fast-access cache. When a later request asks for the same resource, the system serves the cached copy instead of asking the slower provider again.

**Quality impact:**

* **Promotes performance:** repeated requests can avoid slow network calls, database reads, file-system access, or expensive computation.
* **May improve availability:** cached data can sometimes let a system keep serving degraded responses when the source is temporarily unavailable.
* **Inhibits consistency and modifiability:** the system now has to decide when cached data is stale, how invalidation works, and which components are responsible for cache correctness.
* **Consumes memory or storage:** a cache trades space for time.

A good caching requirement names the scenario and the measure. "Use caching" is not a quality requirement. "When the product catalog receives repeated requests for the same item within a 10-minute window, at least 90% of those requests are served from cache and p95 response time stays below 100 ms" is a quality requirement that caching might satisfy.

# Choosing a Tactic

Use tactics after the quality attribute scenario is specific enough to judge them. A practical sequence is:

1. State the quality scenario and measure.
2. Identify the failure, delay, change, or risk that blocks the measure.
3. Choose a tactic that directly addresses that blocker.
4. Name the qualities the tactic will likely inhibit.
5. Add observability so the team can verify the tactic works in production-like conditions.

For example, a team trying to improve availability might start with this scenario: "If one perception worker crashes while the robot is operating, the system detects the crash within 2 seconds and starts a replacement worker within 5 seconds." Ping-echo, heartbeat, or process supervision could all be candidate tactics. The right choice depends on the runtime style, the acceptable monitoring traffic, and how much logic the team wants inside each worker.

Tactics do not remove trade-offs. They make trade-offs inspectable.

# Architectural Tactics Quiz and Flashcards
{: #architectural-tactics-review-and-practice }

Use these flashcards and quiz questions to practice distinguishing tactics from styles, matching tactics to quality scenarios, and naming the costs of ping-echo, heartbeat, redundancy, and caching.

{% include flashcards.html id="architectural_tactics" %}

{% include quiz.html id="architectural_tactics" %}
