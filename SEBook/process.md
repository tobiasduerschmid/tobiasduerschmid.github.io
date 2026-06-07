---
title: Software Process
layout: sebook
---

# Agile
For decades, software development was dominated by the Waterfall model, a sequential process where each phase—requirements, design, implementation, verification, and maintenance—had to be completed entirely before the next began. This "Big Upfront Design" approach assumed that requirements were stable and that designers could predict every challenge before a single line of code was written. However, this led to significant industry frustrations: projects were frequently delayed, and because customer feedback arrived only at the very end of the multi-year cycle, teams often delivered products that no longer met the user's changing needs.

In Waterfall, feedback from the customer only appears at the very end — after months or years of work:

<div class="uml-class-diagram-container" data-uml-type="state" data-uml-spec='@startuml
[*] --> Requirements
Requirements --> Design : sign-off
Design --> Implementation : sign-off
Implementation --> Testing : code complete
Testing --> Maintenance : release
Maintenance --> [*]
note right of Testing
  Customer sees working
  software for the FIRST time
  here — often months or
  years after Requirements.
end note
@enduml'></div>

Agile inverts this: the team delivers a small working increment every one to four weeks and lets customer feedback reshape each subsequent iteration — the feedback loop closes in weeks, not years.

## Agile Manifesto
In 2001, a group of software experts met in Utah to address these failures, resulting in the Agile Manifesto. Rather than a rigid rulebook, the manifesto proposed a shift in values: 
* Individuals and interactions over processes and tools
* Working software over comprehensive documentation
* Customer collaboration over contract negotiation
* Responding to change over following a plan
While the authors acknowledged value in the items on the right, they insisted that the items on the left were more critical for success in complex environments.

## Core Principles
The heart of Agility lies in **iterative and incremental development**. Instead of one long cycle, work is broken into short, time-boxed periods—often called Sprints—typically lasting one to four weeks. At the end of each sprint, the team delivers a "Working Increment" of the product, which is demonstrated to the customer to gather rapid feedback. This ensures the team is always building the "right" system and can pivot if requirements evolve.
Key principles supporting this include:
* **Customer Satisfaction**: Delivering valuable software early and continuously.
* **Simplicity**: The art of maximizing the amount of work not done.
* **Technical Excellence**: Continuous attention to good design to enhance long-term agility.
* **Self-Organizing Teams**: Empowering developers to decide how to best organize their own work rather than acting as "coding monkeys".

## Common Agile Processes
The most common agile processes include:
* **[Scrum](/SEBook/process/scrum.html)**: The most popular framework using roles like Scrum Master, Product Owner, and Developers.
* **[Extreme Programming (XP)](/SEBook/process/xp.html)**: Focused on technical excellence through "extreme" versions of good practices, such as Test-Driven Development (TDD), Pair Programming, Continuous Integration, and Collective Code Ownership
* **Lean Software Development**: Derived from Toyota’s manufacturing principles, Lean focuses on eliminating waste

Process choice is also a design decision. [People and Processes](/SEBook/process/people-and-processes.html) explains how to adapt agile, plan-driven, and risk-driven practices to the human constraints and domain risks of a project.

# Practice This

Use the flashcards to retrieve the process vocabulary, then use the quiz to decide which process assumptions fit realistic project contexts.

{% include flashcards.html id="process_agile" %}

{% include quiz.html id="process_agile" %}
