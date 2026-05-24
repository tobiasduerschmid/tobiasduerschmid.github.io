---
title: Scrum
layout: sebook
---

While many organizations claim to be "Agile", the ==vast majority — historically reported around 60–80% in the annual *State of Agile* surveys — implement the Scrum framework or a Scrum/Kanban hybrid==. 

# Scrum Theory
Scrum is a management framework built on the philosophy of *Empiricism*. This philosophy asserts that in complex environments like software development, we cannot rely on detailed upfront predictions. Instead, knowledge comes from experience, and decisions must be based on what is actually observed and measured in a "real" product.

To make empiricism actionable, Scrum rests on three core pillars:

* **Transparency**: Significant aspects of the process must be visible to everyone responsible for the outcome. "The work is on the wall", meaning stakeholders and developers alike should see exactly where the project stands via Scrum's three artifacts — the *Product Backlog*, *Sprint Backlog*, and *Increment* — typically displayed on a shared task board.
* **Inspection**: The team must frequently and diligently check their progress toward the Sprint Goal to detect undesirable variances.
* **Adaptation**: If inspection reveals that the process or product is unacceptable, the team must adjust immediately to minimize further issues. It is important to realize that Scrum is not a fixed process but one designed to be tailored to a team's specific domain and needs.

# Scrum Roles
Scrum defines three specific roles — called *accountabilities* in the 2020 Scrum Guide {% cite ScrumGuide2020 %} — that are intentionally designed to exist in tension to ensure both speed and quality:

* **The Product Owner** (The Value Navigator): This role is responsible for maximizing the value of the product resulting from the team’s work. They "own" the product vision, prioritize the backlog, and typically communicate requirements through user stories.
* **The Developers** (The Builders): Developers in Scrum are meant to be cross-functional and self-organizing. This means they possess all the skills needed—UI, backend, testing—to create a usable increment without depending on outside teams. They are responsible for adhering to a Definition of Done to ensure internal quality.
* **The Scrum Master** (The Coach): Misunderstood as a "project manager", the Scrum Master is actually a servant-leader. Their primary objective is to maximize team effectiveness by removing "impediments" (blockers like legal delays or missing licenses) and coaching the team on Scrum values.

# Scrum Artifacts
Scrum manages work through three primary artifacts:

* **Product Backlog**: An emergent, ordered list of everything needed to improve the product.
* **Sprint Backlog**: A subset of items selected for the current iteration, coupled with an actionable plan for delivery.
* **The Increment**: A concrete, verified stepping stone toward the Product Goal. An increment is only "born" once a backlog item meets the team's Definition of Done—a checklist of quality measures like functional testing, documentation, and performance benchmarks.

# Scrum Events
The framework follows a specific rhythm of time-boxed events:

* **The Sprint**: A timeboxed period of one month or less (typically 1–4 weeks) that contains all the other Scrum events. Sprints are fixed-length and start immediately after the previous one ends.
* **Sprint Planning**: The entire team collaborates to define why the sprint is valuable (the goal), what can be done, and how it will be built.
* **Daily Standup** (Daily Scrum): A 15-minute event where Developers inspect progress toward the Sprint Goal and adjust their plan for the next day. (Earlier versions of Scrum prescribed three questions — what was done, what will be done, and obstacles — but the 2020 Scrum Guide removed this prescription, leaving the Developers free to choose whatever structure works for them.)
* **Sprint Review**: A working session at the end of the sprint where stakeholders provide feedback on the working increment. A good review includes live demos, not just slides.
* **Sprint Retrospective**: The team reflects on their process and identifies ways to increase future quality and effectiveness.

The sprint is a closed feedback loop: every event feeds the next, and the retrospective loops the team back into the next planning session.

<div class="uml-class-diagram-container" data-uml-type="state" data-uml-spec='@startuml
[*] --> SprintPlanning : sprint begins
SprintPlanning : define goal and select items
SprintPlanning --> Development : sprint backlog ready
Development : build the increment
Development --> DailyStandup : every 24 hours
DailyStandup : 15-min sync, surface blockers
DailyStandup --> Development : continue work
Development --> SprintReview : last day of sprint
SprintReview : demo increment, collect feedback
SprintReview --> SprintRetrospective : feedback captured
SprintRetrospective : inspect process, commit one improvement
SprintRetrospective --> SprintPlanning : next sprint
@enduml'></div>

The retrospective's arrow back to planning is the engine of empiricism: each cycle the team inspects both the *product* (in review) and the *process* (in retro), and adapts before the next sprint starts.

# Scaling Scrum with SAFe
When a product is too massive for a single Scrum Team (typically 10 or fewer people, per the 2020 Scrum Guide), organizations often use the Scaled Agile Framework (SAFe). SAFe introduces the Agile Release Train (ART)—a "team of teams" that synchronizes their sprints. It operates on Program Increments (PI), typically lasting 8–12 weeks, which align multiple teams toward quarterly goals. While SAFe provides predictability for Fortune 500 companies, critics sometimes call it "Scrum-but-for-managers" because it can reduce individual team autonomy through heavy planning requirements.

## Practice

{% include quiz.html id="scrum" %}

{% include flashcards.html id="scrum" %}
