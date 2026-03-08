---
title: Quality Attributes
layout: sebook
---

While functionality describes exactly *what* a software system does, quality attributes describe *how well* the system performs those functions. 
Quality attributes measure the overarching "goodness" of an architecture along specific dimensions, encompassing critical properties such as extensibility, availability, security, performance, robustness, interoperability, and testability.

Important quality attributes include:

* **[Interoperability](/SEBook/quality_attributes/interoperability.html)**: the degree to which two or more systems or components can usefully exchange meaningful information via interfaces in a particular context. 

* **[Testability](/SEBook/quality_attributes/testability.html)**: degree to which a system or component can be tested via **runtime observation**, determining how hard it is to write effective tests for a piece of software.

# Chapter: Mastering Quality Attributes in Software Architecture

In the world of software engineering, functionality describes what a system does, but **quality attributes measure the "goodness" of a design** by describing how well the system performs those functions. While a system might technically fulfill its requirements, its ultimate success depends on dimensions such as **extensibility, availability, security, performance, robustness, interoperability, and testability**.

# The Architectural Foundation: "Load-Bearing Walls"
Quality attributes are often described as the **load-bearing walls of a software system**. Just as the structural integrity of a building depends on walls that cannot be easily moved once construction is finished, early architectural decisions strongly impact the possible qualities of a system. Because quality attributes are typically **cross-cutting concerns** spread throughout the codebase, they are extremely difficult to "add in later" if they were not considered early in the design process.

# Categorizing Quality Attributes
Quality attributes can be broadly divided into two categories based on when they manifest and who they impact:

*   **Design-Time Attributes:** These include qualities like **extensibility, changeability, reusability, and testability**. These attributes primarily impact developers and designers, and while the end-user may not see them directly, they determine how quickly and safely the system can evolve.
*   **Run-Time Attributes:** these include qualities like **performance, availability, and scalability**. These attributes are experienced directly by the user while the program is executing.

# Specifying Quality Requirements
To design a system effectively, quality requirements must be **measurable and precise** rather than broad or abstract. A high-quality specification requires two parts: a **scenario** and a **metric**.

*   **The Scenario:** This describes the specific conditions or environment to which the system must respond, such as the arrival of a certain type of request or a specific environmental deviation.
*   **The Metric:** This provides a concrete measure of "goodness". These can be **hard thresholds** (e.g., "response time < 1s") or **soft goals** (e.g., "minimize effort as much as possible").

For example, a robust specification for a Mars rover would not just say it should be "robust," but that it must "function normally and send back all information under extreme weather conditions".

# Trade-offs and Synergies
A fundamental reality of software design is that **you cannot always maximize all quality attributes simultaneously**; they frequently conflict with one another.

*   **Common Conflicts:** Enhancing **security** through encryption often decreases **performance** due to the extra processing required. Similarly, ensuring high **reliability** (such as through TCP's message acknowledgments) can reduce **performance** compared to faster but unreliable protocols like UDP.
*   **Synergies:** In some cases, attributes support each other. High **performance** can improve **usability** by providing faster response times for interactive systems. Furthermore, **testability and changeability** often synergize, as modular designs that are easy to change also tend to be easier to isolate for testing.
