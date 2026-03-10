---
title: Interoperability
layout: sebook
---

Interoperability is defined as the degree to which two or more systems or components can usefully exchange meaningful information via interfaces in a particular context.

# Motivation
In the modern software landscape, systems are rarely "islands"; they must interact with external services to function effectively

Interoperability is a fundamental business enabler that allows organizations to **use existing services rather than reinventing the wheel**. By interfacing with external providers, a system can leverage specialized functionality for email delivery, cloud storage, payment processing, analytics, and complex mapping services. Furthermore, interoperability **increases the usability of services** for the end-user; for instance, a patient can have their electronic medical records (EMR) seamlessly transferred between different hospitals and doctors, providing a level of care that would be impossible with fragmented data.

From a technical perspective, interoperability is the glue that supports **cross-platform solutions**. It simplifies communication between separately developed systems, such as mobile applications, Internet of Things (IoT) devices, and microservices architectures. 


# Specifying Interoperability Requirements
To design effectively for interoperability, requirements must be specified using two components: a **scenario** and a **metric**. 
*   **The Scenario:** This must describe the specific systems that should collaborate and the types of data they are expected to exchange.
*   **The Metric:** The most common measure is the **percentage of data exchanged correctly**.


# Syntactic vs Semantic Interoperability

To master interoperability, an engineer must distinguish between its two fundamental dimensions: syntactic and semantic. Syntactic interoperability is the ability to successfully exchange data structures. It relies on common data formats, such as XML, JSON, or YAML, and shared transport protocols, such as HTTP(S). 
When two systems can parse each other's data packets and validate them against a schema, they have achieved syntactic interoperability.

However, a major lesson in software architecture is that syntactic interoperability is not enough. 
Semantic interoperability requires that the exchanged data be interpreted in exactly the same way by all participating systems. 
Without a shared interpretation, the system will fail even if the data is transmitted flawlessly. 
For example, if a client system sends a product price as a decimal value formatted perfectly in XML, but assumes the price excludes tax while the receiving server assumes the price includes tax, the resulting discrepancy represents a severe semantic failure. 
An even more catastrophic example occurred with the Mars Climate Orbiter, where a spacecraft was lost because one component sent thrust commands in US customary units (pounds of force) while the receiving interface expected Standard International units (Newtons).

To achieve true semantic interoperability, engineers must rigorously define the semantics of shared data. This is done by documenting the interface with a semantic view that details the purpose of the actions, expected coordinate systems, units of measurement, side-effects, and error-handling conditions. Furthermore, systems should rely on shared dictionaries, standardized terminologies.


# Architectural Tactics and Patterns
When systems must interact but possess incompatible interfaces, the **Adapter design pattern** is the primary solution. An adapter component acts as a translator, sitting between two systems to convert data formats (syntactic translation) or map different meanings and units (semantic translation). This approach allows the systems to interoperate without requiring changes to their core business logic.

In modern **microservices** architectures, interoperability is managed through **Bounded Contexts**. Each service handles its own data model for an entity, and interfaces are kept minimal—often sharing only a unique identifier like a User ID—to separate concerns and reduce the complexity of interactions.

# Trade-offs
Interoperability often **conflicts with changeability**. Standardized interfaces are inherently difficult to update because a change to the interface cannot be localized to a single system; it requires **all participating systems to update** their implementations simultaneously. 

The GDS case study highlights this dilemma. Because the GDS interface is highly standardized, it struggled to adapt to the business model of **Southwest Airlines**, which does not use traditional seat assignments. Updating the GDS standard to support Southwest would have required every booking system and airline in the world to change their software, creating a massive implementation hurdle.

# "Practical Interoperability"
In a real-world setting, a design for interoperability is evaluated based on its likelihood of adoption, which involves two conflicting measures:
1.  **Implementation Effort:** The more complex an interface is, the less likely it is to be adopted due to the high cost of implementation across all systems.
2.  **Variability:** An interface that supports a wide variety of use cases and potential extensions is more likely to be adopted.

Successful interoperable design requires finding the "sweet spot" where the interface provides enough variability to be useful while remaining simple enough to minimize adoption costs.