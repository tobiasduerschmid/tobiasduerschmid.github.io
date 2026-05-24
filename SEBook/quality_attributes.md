---
title: Quality Attributes
layout: sebook
---

While functionality describes exactly *what* a software system does, quality attributes describe *how well* the system performs those functions. 
Quality attributes measure the overarching "goodness" of an architecture along specific dimensions, encompassing critical properties such as extensibility, availability, security, performance, robustness, interoperability, and testability.

You may hear these called **non-functional requirements**, but that phrase can be misleading. A quality attribute is not unrelated to functionality. It is usually a measurable expectation attached to a specific function or scenario. "Search" is functionality. "During peak load, 95% of search requests return within 200 ms" is a performance quality attribute for that functionality.

Important quality attributes include:

* **[Interoperability](/SEBook/quality_attributes/interoperability.html)**: the degree to which two or more systems or components can usefully exchange meaningful information via interfaces in a particular context. 

* **[Testability](/SEBook/quality_attributes/testability.html)**: degree to which a system or component can be tested via **runtime observation**, determining how hard it is to write effective tests for a piece of software.

Other common quality attributes include:

* **Modifiability:** the ease with which a class of changes can be made to a system, often measured by development time or by which modules must not be touched.
* **Extensibility:** a subtype of modifiability focused on adding new functionality with low effort and low risk of mistakes.
* **Availability:** the ability of a system to mask or repair faults, often measured by uptime, mean time to repair, or mean time between failures.
* **Performance:** the ability to meet timing requirements under specified demand, measured by latency, throughput, jitter, deadline miss rate, or resource usage.
* **Security:** the ability to protect confidentiality, integrity, availability, and accountability against specific threats.
* **Portability:** the ease with which the system can run in a different environment, such as another operating system, cloud provider, or hardware platform.

# The Architectural Foundation: "Load-Bearing Walls"
Quality attributes are often described as the **load-bearing walls of a software system**. Just as the structural integrity of a building depends on walls that cannot be easily moved once construction is finished, early architectural decisions strongly impact the possible qualities of a system. Because quality attributes are typically **cross-cutting concerns** spread throughout the codebase, they are extremely difficult to "add in later" if they were not considered early in the design process.

Detailed features are more like furniture: you can often add, remove, or rearrange them after the basic structure exists. Load-bearing qualities are different. If a system was built with synchronous in-process calls everywhere, making it highly available across multiple data centers is not a one-line patch. If a system was built around global mutable state, making it testable later requires structural redesign, not just more test files.

# Categorizing Quality Attributes
Quality attributes can be broadly divided into two categories based on when they manifest and who they impact:

*   **Design-Time Attributes:** These include qualities like **extensibility, changeability, reusability, and testability**. These attributes primarily impact developers and designers, and while the end-user may not see them directly, they determine how quickly and safely the system can evolve.
*   **Run-Time Attributes:** these include qualities like **performance, availability, and scalability**. These attributes are experienced directly by the user while the program is executing.

# Specifying Quality Requirements
To design a system effectively, quality requirements must be **measurable and precise** rather than broad or abstract. A high-quality specification requires two parts: a **scenario** and a **metric**.

*   **The Scenario:** This describes the specific conditions or environment to which the system must respond, such as the arrival of a certain type of request or a specific environmental deviation.
*   **The Metric:** This provides a concrete measure of "goodness". These can be **hard thresholds** (e.g., "response time < 1s") or **soft goals** (e.g., "minimize effort as much as possible").

For example, a robust specification for a Mars rover would not just say it should be "robust", but that it must "continue scientific measurements during a 72-hour dust storm that reduces solar input by 60%, transmit a beacon every 6 hours, and resume full operations within 1 hour after normal solar input returns."

## Good Quality-Attribute Specifications

The following examples show the pattern. Notice that good specifications do not always use the same kind of number. Runtime qualities often use latency, throughput, or uptime. Design-time qualities often use development time, number of modules touched, or dependency boundaries that must not be crossed.

| Quality | Weak specification | Better specification |
| --- | --- | --- |
| Performance | "Search should be fast." | "During the Friday-evening peak load of 10,000 concurrent users, 95% of product-search requests return results within 200 ms and 99% return within 500 ms." |
| Availability | "The service should be highly available." | "For any rolling 30-day window, the checkout API maintains at least 99.95% successful responses, excluding scheduled maintenance announced at least 48 hours in advance." |
| Extensibility | "Adding new sensors should be easy." | "Adding a new depth sensor requires implementing one sensor adapter and must not require changes to components that process depth images." |
| Modifiability | "The rules engine should be flexible." | "Changing a tax rule for one state can be completed by one developer in less than one day and must not require changes to payment authorization or invoice rendering." |
| Testability | "Payment code should be easy to test." | "A developer can run deterministic tests for payment authorization outcomes, including declined cards and network timeouts, without contacting the real payment provider." |
| Interoperability | "Hospitals should exchange records." | "When Hospital A sends an HL7 patient-discharge message to Hospital B, at least 99.9% of required fields are parsed and interpreted with the same units, codes, and timestamp semantics." |
| Security | "User accounts should be secure." | "After 5 failed login attempts for one account within 10 minutes, further attempts are rate-limited for 15 minutes and the event is recorded in the audit log within 5 seconds." |
| Scalability | "The system should scale." | "When read traffic increases from 1,000 to 20,000 requests per minute, the service can add replicas without downtime and keep p95 read latency below 300 ms." |
| Robustness | "The robot should handle bad data." | "If a camera publishes 10 consecutive malformed frames, the perception component discards those frames, reports the fault within 1 second, and continues processing valid lidar input." |
| Portability | "The app should run anywhere." | "Moving the service from AWS to GCP requires replacing cloud-storage and secret-management adapters only; domain and API modules remain unchanged." |

Two of these examples are deliberately softer than a pure pass/fail threshold. "Must not require changes to components that process depth images" is a structural boundary rather than a time measurement. "Minimize changes to existing preprocessing components" can also be acceptable when the team is optimizing a direction rather than enforcing a hard threshold. The key is that the statement still guides architectural decisions.

## Common Specification Smells

Watch for these failure patterns:

* **Adjective-only requirements:** "fast," "robust," "secure," "usable," and "scalable" do not mean the same thing to every stakeholder.
* **Metrics without scenarios:** "respond within 200 ms" is incomplete unless it says under what load, for which request, and with which data size.
* **Scenarios without metrics:** "during a network outage" names the condition but not what counts as success.
* **System-wide blanket claims:** "every request must complete within 1 second" is usually wrong. Architecture work needs the specific requests that matter.
* **Implementation disguised as requirement:** "Use Kafka for scalability" chooses a solution before stating the quality scenario it is supposed to satisfy.

# Trade-offs and Synergies
A fundamental reality of software design is that **you cannot always maximize all quality attributes simultaneously**; they frequently conflict with one another.

*   **Common Conflicts:** Enhancing **security** through encryption often decreases **performance** due to the extra processing required. Similarly, ensuring high **reliability** (such as through TCP's message acknowledgments) can reduce **performance** compared to faster but unreliable protocols like UDP.
*   **Synergies:** In some cases, attributes support each other. High **performance** can improve **usability** by providing faster response times for interactive systems. Furthermore, **testability and changeability** often synergize, as modular designs that are easy to change also tend to be easier to isolate for testing.

Because trade-offs are unavoidable, architecture work is partly the discipline of prioritizing. A system cannot be "maximally secure, maximally fast, maximally cheap, maximally portable, and maximally easy to change" all at once. A good architecture identifies the few quality attributes that are load-bearing for this system, then accepts and documents the costs paid on other dimensions.

# Architectural Tactics

Architectural styles shape the dominant structure of a system. **Architectural tactics** are smaller reusable design moves that improve a particular quality attribute inside that structure. For example, a publish-subscribe system might use the heartbeat tactic to detect failed subscribers, and a layered web application might use caching to reduce request latency.

Common tactics include:

* **Ping-echo** for availability: a watchdog pings monitored components and expects an echo before a timeout.
* **Heartbeat** for availability: monitored components periodically send "I am alive" messages to a watchdog.
* **Active redundancy** for availability: multiple replicas run at the same time so one can take over when another fails.
* **Cold spare** for availability: a backup component stays inactive until a failure requires recovery.
* **Caching** for performance: a fast local copy prevents repeated expensive retrieval of the same resource.

The useful question is not "which tactic is best?" but "which tactic improves the target quality scenario, and what does it cost?" Ping-echo and heartbeat both improve availability by detecting failures, but both consume network and processing resources. Caching improves performance when requests repeat, but it introduces invalidation and stale-data risks. See [Architectural Tactics](/SEBook/architectural_tactics.html) for the detailed comparison.
