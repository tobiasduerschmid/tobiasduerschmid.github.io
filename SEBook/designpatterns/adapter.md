---
title: Adapter Design Pattern
layout: sebook
---

# Context
In software construction, we frequently encounter situations where an existing system needs to collaborate with a third-party library, a vendor class, or legacy code. However, these external components often have interfaces that do not match the specific "Target" interface our system was designed to use.

A classic real-world analogy is the power outlet adapter. If you take a US laptop to London, the laptop’s plug (the client) expects a US power interface, but the wall outlet (the adaptee) provides a European interface. To make them work together, you need an adapter that translates the interface of the wall outlet into one the laptop can plug into. In software, the Adapter pattern acts as this "middleman", allowing classes to work together that otherwise couldn't due to incompatible interfaces.

# Problem
The primary challenge occurs when we want to use an existing class, but its interface does not match the one we need. This typically happens for several reasons:
*   **Legacy Code:** We have code written a long time ago that we don’t want to (or can’t) change, but it must fit into a new, more modern architecture.
*   **Vendor Lock-in:** We are using a vendor class that we cannot modify, yet its method names or parameters don't align with our system's requirements.
*   **Syntactic and Semantic Mismatches:** Two interfaces might differ in syntax (e.g., `getDistance()` in inches vs. `getLength()` in meters) or semantics (e.g., a method that performs a similar action but with different side effects).

Without an adapter, we would be forced to rewrite our existing system code to accommodate every new vendor or legacy class, which violates the **Open/Closed Principle** and creates tight coupling.

# Solution
The **Adapter Pattern** solves this by creating a class that converts the interface of an "Adaptee" class into the "Target" interface that the "Client" expects. 

According to the **course material**, there are four key roles in this structure:
1.  **Target:** The interface the Client wants to use (e.g., a `Duck` interface with `quack()` and `fly()`).
2.  **Adaptee:** The existing class with the incompatible interface that needs adapting (e.g., a `WildTurkey` class that `gobble()`s instead of `quack()`s).
3.  **Adapter:** The class that realizes the Target interface while holding a reference to an instance of the Adaptee. 
4.  **Client:** The class that interacts only with the Target interface, remaining completely oblivious to the fact that it is actually communicating with an Adaptee through the Adapter.

In the "Turkey that wants to be a Duck" example, we create a `TurkeyAdapter` that implements the `Duck` interface. When the client calls `quack()` on the adapter, the adapter internally calls `gobble()` on the wrapped turkey object. This syntactic translation effectively hides the underlying implementation from the client.

# Consequences
Applying the Adapter pattern results in several significant architectural trade-offs:
*   **Loose Coupling:** It decouples the client from the legacy or vendor code. The client only knows the Target interface, allowing the Adaptee to evolve independently without breaking the client code.
*   **Information Hiding:** It follows the Information Hiding principle by concealing the "secret" that the system is using a legacy component.
*   **Single vs. Multiple Adapters:** In languages like Java, we typically use "Object Adapters" via composition (wrapping the adaptee). In languages like C++, "Class Adapters" can be created using multiple inheritance to inherit from both the Target and the Adaptee.
*   **Flexibility vs. Complexity:** While adapters make a system more flexible, they add a layer of indirection that can make it harder to trace the execution flow of the program since the client doesn't know which object is actually receiving the signal.
