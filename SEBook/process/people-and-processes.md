---
title: People and Processes
layout: sebook
---

# Learning Goals

Software process is not a menu of branded ceremonies. It is a set of decisions about how people will learn, coordinate, design, build, review, and change a system. By the end of this chapter, you should be able to:

* Explain the difference between agile, plan-driven, and risk-driven construction.
* Identify the human factors that make software design a group activity.
* Decide when rational analysis, experienced intuition, or a combination of both is appropriate.
* Tailor a construction process to the risks of a specific domain.

> Self-check: before reading further, name one design decision in your current project that would be expensive to reverse later. That is a candidate for risk-driven attention.

# Process Fit

A process fits when its assumptions match the project. Waterfall-style, plan-driven construction assumes that requirements can be known early and that the cost of late feedback is acceptable. Agile construction assumes that short feedback loops are possible and valuable: the team can build a working increment, show it to stakeholders, and let the next iteration change direction. The Agile Manifesto's values are a reaction against processes that let plans, contracts, documents, and tools dominate the people building and using the software {% cite AgileManifesto2001 %}.

Those two extremes are useful teaching cases, but most real projects need a middle position: **risk-driven design**. The key question is not "How much design should we do up front?" in the abstract. The better question is "Which decisions are expensive to reverse, and which ones can safely wait?" Fairbanks frames this as doing just enough architecture for the risks that matter {% cite Fairbanks2010 %}.

## Plan-Driven

Plan-driven processes put more effort into requirements analysis, architecture, design documentation, reviews, and verification before construction. They fit domains where:

* requirements are unusually stable;
* external regulation requires documented evidence;
* the cost of failure is high;
* software updates after release are difficult or impossible;
* many teams must coordinate before integration.

Plan-driven work is not automatically bad. It becomes harmful when it treats uncertain requirements as settled facts or delays feedback until the system is too expensive to change.

## Agile

Agile processes put more effort into frequent delivery, customer feedback, and adaptation. They fit domains where:

* requirements are expected to change;
* working software can be released or demoed frequently;
* users or customers can give feedback;
* the cost of changing direction is manageable;
* the team can keep quality high through tests, reviews, and refactoring.

Agile work is not "no design". The Agile principles explicitly say that continuous attention to technical excellence and good design enhances agility. If each iteration makes future change harder, the team is borrowing from later iterations.

## Risk-Driven

Risk-driven design asks the team to invest design effort where the cost of being wrong is high. Hard-to-change decisions usually include:

* programming languages and major frameworks;
* target platforms and deployment environments;
* component boundaries and connectors;
* public APIs and data models;
* quality-attribute strategies for performance, security, reliability, privacy, usability, and testability.

Small-scale choices that are easy to refactor can wait. Large-scale choices that force expensive rewrites deserve earlier modeling, discussion, prototypes, and review.

# Risk-Driven Design

Risk-driven design is both technical and social. The technical part is identifying decisions that could lock the system into a costly direction. The social part is making sure the right people see those risks before implementation hides them inside code.

A practical risk-driven routine looks like this:

1. Sketch the relevant system structure: major components, data flow, APIs, deployment nodes, or user workflow.
2. Ask each stakeholder to identify risks silently first, so the first loud voice does not anchor the room.
3. Put the risks next to the part of the system they affect.
4. Discuss which risks are highest priority.
5. Decide what evidence would reduce the risk: a design note, prototype, benchmark, threat model, review, test plan, or formal analysis.

This is the core idea behind collaborative risk-storming: diagrams are not final answers; they are shared surfaces for finding risks together {% cite BrownRiskStorming %}.

## Architecture Enables Late Decisions

A good architecture does not make every decision early. It makes the expensive decisions explicit and creates boundaries that let cheaper decisions wait. This is why [Information Hiding](/SEBook/designprinciples/informationhiding.html), [SOLID](/SEBook/designprinciples/solid.html), low coupling, and high cohesion matter for process, not just code style.

For example, a payment interface might be worth designing early because many parts of the system will depend on it. The specific provider implementation can often wait if the interface hides provider details. A button label, a helper function name, or the exact order of fields in an internal object can usually wait because it is cheap to change.

## Keep a Technical Debt Backlog

Feature backlogs describe user-visible functionality. They do not automatically capture design work that protects future change. A healthy agile project also maintains a **technical debt backlog**: refactorings, documentation gaps, design cleanups, performance experiments, testability improvements, and architectural changes that make future work cheaper.

Teams can handle technical debt in different ways:

* include one or two design/debt items in every iteration;
* dedicate a short hardening iteration after a risky release;
* assign an architect or rotating design lead to maintain the debt backlog;
* require a short design note before changing a hard-to-reverse boundary.

The point is not to make process heavier. The point is to make the cost of future change visible while the team can still choose what to do about it.

# Human Decisions

Software construction is a collaborative activity. The "ivory tower architect" failure happens when design decisions are made in isolation, handed down to implementers, and judged only by internal elegance. Those designs can look coherent on paper while failing against the current codebase, deployment constraints, team knowledge, or domain reality.

Better process brings the affected people into the decision:

* include implementers in important design discussions;
* consult domain experts before encoding domain assumptions;
* ask teammates to present alternatives, not just objections;
* keep design leaders close to the current codebase;
* record the rationale for decisions that future maintainers will need to understand.

Studies of architecture decision-making emphasize that many important design decisions are group decisions, not solitary acts of genius {% cite RekhaMuccini2018 Tang2017HumanAspects %}.

## Rational and Intuitive Reasoning

Rational decision-making means explicitly identifying options, evaluation criteria, trade-offs, and reasons. It is useful when:

* the decision needs justification;
* non-experts need guidance;
* the problem is structured enough to compare options;
* the decision is hard to reverse;
* the team needs a record for future maintainers.

Intuitive decision-making means using experienced judgment under uncertainty. It is useful when:

* time pressure is real;
* decision makers have deep experience in the domain;
* the information is incomplete;
* the problem is hard to formalize;
* a good-enough decision is more valuable than a slow optimal one.

The lesson is not "always be rational" or "trust your gut". The stronger practice is to combine both. Expert intuition can generate a promising option quickly; rational review can expose assumptions, alternatives, and risks before the team commits {% cite PowerWirfsBrock2019 Pretorius2021 %}.

## Bounded Rationality

Software designers are boundedly rational. They cannot enumerate every possible design, predict every future requirement, or optimize every trade-off. In practice, designers often **satisfice**: they choose an option that is good enough for the known constraints, then adapt as evidence changes {% cite TangVliet2015 %}.

Bounded rationality changes how we should design processes:

* avoid pretending the first plan is complete;
* reduce cognitive load with small design artifacts and clear decision records;
* use reviews to catch assumptions, not to certify perfection;
* revisit hard decisions when new evidence appears;
* make it normal to replace a decision whose assumptions have expired.

The process should help humans make better decisions under limits. It should not pretend those limits do not exist.

# Domain Examples

Different domains need different balances of upfront design, iteration, documentation, review, and formal evaluation. Bass, Clements, and Kazman use the contrast between small buildings and skyscrapers to make the point: when many people coordinate over a long time and failure is costly, the design process becomes more explicit {% cite Bass2012 %}. Software has the same pressure.

## Web-Based Social Products

Fast-moving web products often prioritize usability, changeability, scalability, and responsiveness to usage data. The process usually leans agile: frequent releases, monitoring, A/B tests, peer review, automated tests, and rapid reaction to competitors or public feedback.

But "small upfront design" is not "no upfront design". Hard-to-change choices still deserve attention: service boundaries, data models, privacy architecture, client-server interfaces, deployment strategy, and rollback mechanisms. Facebook's engineering culture has been described as perpetual development supported by peer review, automated testing, and personal responsibility {% cite Feitelson2013Facebook %}.

## Large Engineering Organizations

Large organizations can still be agile, but they often need lightweight design artifacts to scale communication. A short design document can state goals, non-goals, context, interface sketches, data models, alternatives, and the rationale for the chosen option. That document is not a Waterfall spec. It is a discussion artifact for decisions that affect multiple people or systems {% cite Ubl2020DesignDocs %}.

The process fit is risk-driven: write design docs before major decisions, discuss them asynchronously when possible, review the parts that are expensive to reverse, and avoid ceremony for small changes.

## Spacecraft and Safety-Critical Software

Spacecraft, avionics, medical devices, and other safety-critical systems have different economics. Failure can be catastrophic, software updates may be constrained, and verification evidence matters. These domains need more plan-driven and risk-driven work: detailed design documents, formal reviews, traceability, independent verification and validation, and specialized analysis for mission-critical components.

NASA's software guidance for detailed design requires projects to develop, record, and maintain a software design detailed enough for coding, compiling, and testing. Flight-software case studies also show the value of design-for-verification and model checking when subtle faults are costly {% cite NASASWE058 Markosian2007NASA %}.

## Startups

Startups face a different risk profile. Early risk often centers on time-to-market and whether anyone wants the product. A startup may rationally accept shortcuts to reach a minimum viable product, rely heavily on reuse, and design while coding. That process can be appropriate when the biggest question is business survival.

After the product starts working, the risk changes. Onboarding new developers, scaling the system, protecting data, and extending the product become more important. At that point, paying down selected technical debt and clarifying the architecture can be the difference between growth and collapse. Startup process research describes this shift toward combining lightweight agile practices with stronger engineering discipline as the company matures {% cite Tegegne2019Startups %}.

# Team Playbook

For a CS 35L project team, a full formal architecture process would be too heavy. A no-process approach is also risky. A practical fit is a small, explicit process:

1. Maintain a feature backlog of user-visible work.
2. Maintain a technical debt backlog of design and quality work.
3. Write a short design note before changing a hard-to-reverse boundary such as a data model, API, storage format, or concurrency model.
4. Invite the implementers and the most relevant domain expert into decisions before coding begins.
5. Use code review for design feedback, not just style correction.
6. Hold a short retrospective after each milestone and commit one process improvement.

The guiding question is: **What evidence do we need before this decision becomes expensive to change?** If the evidence is cheap, get it. If the decision is cheap, defer it. If the decision is expensive and the evidence is unavailable, make the assumption visible and record when to revisit it.

# Practice This

Use the flashcards to retrieve the main distinctions, then use the quiz to practice matching process choices to domain risks and team situations.

{% include flashcards.html id="process_people_tailoring" %}

{% include quiz.html id="process_people_tailoring" %}
