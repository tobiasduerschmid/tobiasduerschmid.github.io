# Answering Design Questions with UML — tutorial design

Date: 2026-11-20. Status: approved 2026-11-21, with the §14 defaults. Scope: a new CS 130 tutorial, a reusable *diagram challenge* step type, navigation for multi-file steps, and ArchUML notation additions. Exemplar diagrams live in `2026-11-20-uml-design-questions-tutorial-kit/diagrams/`.

## 1. Intent

CS 130 students can read and draw class, sequence, and component diagrams, but only for small examples. This tutorial lets them *feel* what the diagrams are for: answering design questions about a system too large to hold in your head. Every task runs the same loop:

1. **From the code.** A realistic question arrives: what a change affects, which outage stops sales, why some orders end up charged *and* failed. Students answer from the code alone, using a file tree and project-wide search. They rate their confidence and lock in the answer.
2. **With the diagram.** They get the diagram that an AI coding agent produces when asked for the right view of this code. They revise their answer, then answer one new question with the same diagram.
3. **Compare.** They see both answers and both times side by side, what the code hid and why, and how to find it in code next time.

The diagrams are pre-generated while the tutorial is authored: the authoring agent writes each one from the finished Headliner code for its request (§10). They are static content in the tutorial, and nothing is generated while students work. They look like what a good agent infers: scoped to the request, abstracted, and annotated with file-and-line evidence. They are **not** the tutorial runtime's live auto-inferred UML (`uml_diagram: true` stays off). They follow the notation of the course books, *Documenting Software Architectures: Views and Beyond* (DSA, 2nd ed.) and *Software Architecture in Practice* (SAIP, 3rd ed.). Every notation element is used for its modeling intent (§8.1).

## 2. Learners and setting

- CS 130 juniors and seniors; about 90 minutes of homework.
- Prerequisites: UML Class Diagrams in Python and UML Sequence Diagrams in Python tutorials; the Component Diagrams, Publish-Subscribe, and Layered Style chapters; course readings in DSA and SAIP; Python dataclasses, abstract base classes, and decorators.
- Placement: CS 130 navigation under UML, after Component Diagrams; linked from the Practice sections of the class, sequence, and component diagram chapters.

## 3. Objectives

Students will be able to:

1. **Analyze** a multi-service codebase to answer a design question (change impact, failure behavior, extension point, interaction order, latency) and rate their confidence.
2. **Use** a class, component, or sequence diagram to answer the same kind of question, and check one claim their answer depends on against the code.
3. **Explain** which code mechanism hid an answer: event bindings outside the code, inheritance across packages, asynchronous work queues, configuration-resolved connections, decorators, or multiplicities spread across files. Explain why a view brings these pieces together.
4. **Identify** design defects that a view makes visible: a subclass that breaks its interface contract, a missing compensation step, a synchronous dependency on the request path, a remote call inside a loop, an architecture-rule violation.
5. **Select** the view that best answers a question (class, component, sequence, or none) and justify the choice.

**Non-goals:** drawing UML (earlier tutorials teach it); deployment, state, and activity views; full architecture documentation packages; go-to-definition tooling; prompt engineering.

**Anti-goals:**
- **A contrast won by bad tooling.** If the code-only phase hurts because the editor cannot search, students learn "this editor is bad", not "views help".
- **Diagrams that state the answer.** Notes report facts the notation cannot show. They never draw the conclusion the task asks for.
- **Toy or sloppy code.** Non-locality must come from realistic good design (services, queues, interfaces, configuration), not obfuscation.
- **Overclaiming.** The tutorial never claims diagrams make work faster in general (§5.3).
- **Unbounded struggle.** The code-only phase has a soft budget of 7 minutes.

## 4. Approaches

| Approach | What it is | Trade-off |
|---|---|---|
| A. Existing features only | Two steps per task (code-only answer file checked only for completeness, then a diagram in the instructions) | Fastest to ship; no time comparison; students can edit the first answer after the reveal; tabs limit the system to about 12 files; diagrams squeezed into the instruction pane |
| **B. Diagram challenge + project navigation (chosen)** | One step per task: lock in a code-only answer, reveal the agent diagram beside the code, revise, compare | New runtime step type, persistence field, print and popout support, tests; reusable for later architecture tutorials |
| C. Standalone reading lab | Purpose-built code browser with build-time cross-references, outside the tutorial runtime | Best code navigation, but duplicates progress, print, and popout machinery and sits outside the tutorial index |

The user chose B: it is the only option where the comparison is real (locked answer, measured time) and it stays inside the tutorial system. Go-to-definition can be added later by reusing the vendored basedpyright.

## 5. What each diagram type is for

### 5.1 Use cases from the books

Locators are printed page and PDF page for DSA; section and PDF page for SAIP (the supplied SAIP PDF has no printed page numbers).

| View (UML diagram) | Questions it answers best | Book basis | Tutorial tasks |
|---|---|---|---|
| Module views (**class diagram**) — generalization style | Where does a new variant plug in? Which classes vary under a stable parent? Which subclasses inherit a behavior? | DSA §2.3.3, pp. 83–84 (PDF 125–126); PetStore events across packages, Fig. 2.15, p. 86 (PDF 128) | T2, capstone Q-b |
| Module views (**class diagram**) — data model style | What can the data represent? What ripples when a data rule changes? | DSA Table 2.6, p. 111 (PDF 153); §2.6.3, p. 115 (PDF 157) | T4 |
| C&C views (**component diagram**) — publish-subscribe | Who consumes an event? Can a consumer be added without changing producers? How are events dispatched? | DSA §4.4.1 and advice box, pp. 175–176 (PDF 217–218) | T1 |
| C&C views (**component diagram**) — client-server, SOA, availability | What runs, how components interact, which interactions are on a request's path, what happens when one service fails | DSA §3.3, p. 136 (PDF 178); bank example §3.1, pp. 124–126 (PDF 166–168); §4.3.1, p. 164 (PDF 206); SOA view of Adventure Builder, Fig. 4.5, p. 173 (PDF 215) | T5 |
| C&C views (**component diagram**) — conformance | Does the as-built system follow an allowed-to-use rule? | Layers cannot be read off code, DSA §2.4.1, p. 88 (PDF 130); DSM conformance, pp. 101–102 (PDF 143–144) | capstone Q-a |
| Behavior (**sequence diagram**) — trace | In what order do components interact in one scenario, sync or async, with which alternatives and loops? | DSA §8.3.1, Figs. 8.4–8.5, pp. 297–299 (PDF 339–341) | T3, T6, capstone Q-c |
| Behavior — failure analysis | What can go wrong at each step of a scenario, and is it detected, prevented, or recovered? A hard transaction bug spanning modules | SAIP §14.3 (PDF 284–285); DSA margin tip, p. 307 (PDF 349) | T3 |
| Behavior — performance | Will a scenario meet its latency budget? Where are remote calls and loops? | SAIP §18.3 (PDF 361); DSA §8.2.2, pp. 291–293 (PDF 333–335); time constraint in Fig. 8.5 | T6 |

What each view **cannot** answer (the tutorial says so where it matters): class diagrams show no behavior, timing, or data flow (DSA App. A, pp. 436–438, PDF 478–480); a module view says nothing about runtime performance or reliability (DSA §1.3, p. 60, PDF 102); a sequence diagram is one trace, not complete behavior (DSA §8.2.3, pp. 293–295, PDF 335–337); no diagram inferred from code answers *why* a decision was made (§5.3).

### 5.2 Why code hides these answers

DSA quotes Gamma et al.: an object-oriented program's runtime structure is "largely independent" of its code structure (p. 23, PDF 65). Module-to-component mappings are many-to-many (DSA pp. 29–32, PDF 71–74). Each task hides its answer behind one realistic mechanism, and the debrief names it:

| Mechanism | Where it lives in Headliner | Task |
|---|---|---|
| Event bindings declared outside the code, with wildcard semantics | `deploy/broker.toml` plus `@consumes()` decorators | T1 |
| Inheritance across packages; overrides that change a contract | `services/opc/partners/` extending `services/opc/gateways/` | T2 |
| Asynchronous work queues; behavior spread over tasks; a missing step | `services/opc/` intake → workflow → tasks → callbacks | T3 |
| Multiplicities in type hints and validators across files | `services/opc/model/` | T4 |
| Connections resolved by service name from configuration; a "publish" that is a network call | `deploy/services.toml`, `services/opc/intake.py` | T5 |
| Remote calls that look like local calls, inside loops and decorators | `services/website/pricing.py`, `availability.py`, `payments.py` | T6 |

### 5.3 What the research supports, and what the tutorial must not claim

Evidence grades: A replicated/strong, B supported/conditional, C emerging, D insufficient/contested. These are editorial judgments, not formal grades. Full citations are in §15.

| Claim | Evidence | Grade | Design consequence |
|---|---|---|---|
| A diagram's advantage is computational: it puts the facts an inference needs next to each other, so search and recognition get cheaper | Larkin & Simon 1987 | B | Every diagram is scoped so the facts its question needs sit together |
| The hard questions about code concern connected structure: how control reaches a point, what a change affects, how subsystems connect | Sillito et al. 2006/2008; LaToza & Myers 2010; Ko et al. 2007 | B | Every task question is about connected code |
| Component diagrams help only when their elements map directly onto the question; a big-picture view alone did not help | Haitzer & Zdun 2013 | C | Each diagram answers its request, not "the whole system" |
| UML documentation improved correctness on complex maintenance tasks, not speed; no benefit on simple tasks | Arisholm et al. 2006; Dzidek et al. 2008 | B | Correctness is the primary comparison; times are secondary. The capstone includes a question where no diagram is needed |
| Design-level models help comprehension; analysis models and reverse-engineered "everything" diagrams do not | Scanniello et al. 2014, 2018; Fernández-Sáez et al. 2013, 2015 | B/C | Diagrams are abstracted, design-level, purpose-built |
| Benefit grows with expertise; novices can be slowed down; consistent conventions narrow the gap | Gravino et al. 2015; Torchiano et al. 2017; Ricca et al. 2010 | B | Every diagram has a key; a notation reference is always one click away |
| Diagram size has understandability thresholds; level-of-detail results are mixed | Stevanetic et al. 2014; Störrle 2014; Fernández-Sáez et al. 2016 | C/D | Hard size ceilings (§8.2); no claimed optimum |
| LLMs recover classes much better than relationships, omit components, and get message order wrong sometimes | Shehata et al. 2024; Campanello et al. 2025; Abdelmalek et al. 2026; De Luca et al. 2026 (preprint) | C | Reply cards cite evidence; the debrief teaches checking the one relation an answer depends on; "missing from the diagram" never means "missing from the code" |
| Struggling first, then receiving an expert representation, aids transfer when the reveal builds on the attempt and contrasts cases | Schwartz & Bransford 1998; Kapur 2008; Sinha & Kapur 2021 (g ≈ 0.36); Loibl et al. 2017; Alfieri et al. 2013 | B | Commit before reveal; the comparison panel builds on the student's own answer; the phase is time-boxed |
| Instruction first wins when element interactivity is very high for novices | Ashman et al. 2020 | B (conditional) | Orientation step and notation reference come first; budget nudges stop flailing |
| Developers mostly sketch informally to understand code; formal UML is rare in industry | Cherubini et al. 2007; Petre 2013; Baltes & Diehl 2014 | A | The tutorial presents diagrams as on-demand thinking tools, not mandated documentation |
| No study yet shows that AI-generated diagrams improve developer comprehension | Gap identified November 2026 | D | No such claim anywhere in the tutorial |

**Claims to avoid in student-facing text:** "diagrams make maintenance faster"; "diagrams always help"; "industry relies on UML"; "AI agents reliably produce diagrams like these"; any claim that lab results transfer unchanged to large industrial systems.

## 6. The running system: Headliner

### 6.1 Story and book mapping

**Headliner** sells festival weekends as trip packages: a festival pass, a place to sleep (campsite, glamping tent, or hotel), shuttle rides, and add-on experiences (sunrise yoga, silent disco, artist meet-and-greets). Headliner owns none of these. Like the books' Adventure Builder, it orders each part from a supplier through web services, charges the fan through a bank, and coordinates everything in an Order Processing Center (OPC). The festival theme keeps it fun. The architecture keeps it close to the readings, which use the same SOA view, multi-tier website, and order processing (DSA Fig. 4.5, Fig. 4.8, Fig. 8.5).

| Adventure Builder (DSA) | Headliner |
|---|---|
| Consumer Web site + Catalog DB | Trip Website + Catalog DB |
| OPC with OpcPurchaseOrderService, OpcOrderTrackingService, Web Service Broker | OPC with PurchaseOrderService, OrderTrackingService, SupplierCallbackService |
| Bank: CreditCardService | Bank: CardService |
| Airline, Lodging, Activity providers | Box Office, Lodging, Shuttle, and Experience providers |
| User's e-mail client (SMTP) | Mail Relay (SMTP) |
| — | Message broker (`orders` queues; `trips` topic exchange) and its consumers: Notifications, Loyalty, Warehouse ETL, Affiliate Relay (forwards to influencer partners), Support Console, Shuttle Planner |

Fun data (not mechanisms): festival names (Desert Bloom, Neon Nights, Lakeside Fest, Sunset Sessions), artists, experiences, attendee names.

### 6.2 Runtime architecture (as built)

| Component (stereotype) | Ports (named interaction points) | Main connectors |
|---|---|---|
| TripWebsite «WebApplication» | fan HTTPS; clients for catalog, bank, providers, OPC | SQL to CatalogDB; HTTPS to Bank (card validation), BoxOffice (pass quotes), ExperienceProvider (capacity), OPC PurchaseOrderService; **SQL to the OrderDB replica** (order history, the capstone violation) |
| OPC «BackendService» | PurchaseOrderService, OrderTrackingService, SupplierCallbackService; supplier client; publisher | SQL to OrderDB; AMQP publish to `orders` and `trips`; HTTPS to Bank (capture, refund) and to the four providers |
| OrderDB, CatalogDB «Database» | sql | — |
| MessageBroker «MessageBroker»; `trips` exchange «TopicExchange» | publish, consume | `orders.received`, `supplier.answered` queues; `trips` topic exchange |
| Notifications, Loyalty, WarehouseETL, AffiliateRelay, ShuttlePlanner «BackendService»; SupportConsole «WebApplication» | events | AMQP consume from the broker; Notifications → MailRelay (SMTP); AffiliateRelay → AffiliatePartners (HTTPS webhook) |
| Bank, BoxOffice, LodgingProvider, ShuttleProvider, ExperienceProvider, MailRelay, AffiliatePartners «ExternalSystem» | their service endpoints | — |

Stereotypes come from a small user-defined profile, *Headliner architecture*, named in each diagram's key. Names are capitalized, as UML 2.5.1 §12.3.4 recommends. They deliberately avoid the UML Standard Profile names: «Service» there means "a stateless, functional component", and «Entity» applies only to components (§22.3, Table 22.1). Headliner's own components sit inside a UML package `Headliner` (§12.2.4); external systems sit outside it.

### 6.3 Repository layout

The repository is a services monorepo with a development harness, as real teams run locally. `devstack.py` boots every service in one process for tests and repro scripts. Services find each other by name through `deploy/services.toml` and exchange messages through the in-process broker, so the import graph does **not** show the runtime connections. This is the point of the C&C tasks. External organizations are deterministic stand-ins with switchable outages and simulated latency on a fake clock.

| Path | Contents |
|---|---|
| `README.md` | What Headliner is, the services with one-line responsibilities, how to run tests. No diagrams and no relationships |
| `devstack.py` | Composition root: reads `deploy/*.toml`, starts services, registers consumers, starts schedulers |
| `deploy/services.toml`, `deploy/broker.toml`, `deploy/website.toml` | Service addresses; exchanges, queues, and bindings; website settings, including `ORDER_HISTORY_DSN` pointing at the Order DB replica |
| `platform/` (`http.py`, `broker.py`, `db.py`, `clock.py`, `scheduler.py`) | Shared runtime library: service calls by name, topic exchange with `*` (one word) and `#` (any words) semantics, table store, fake clock |
| `services/website/` (`app.py`, `checkout.py`, `pricing.py`, `availability.py`, `payments.py`, `order_history.py`, `clients.py`) | Trip Website |
| `services/opc/` (`api.py`, `intake.py`, `workflow.py`, `payment_task.py`, `supplier_task.py`, `invoice_task.py`, `cancellation_task.py`, `events.py`) | Order Processing Center |
| `services/opc/gateways/` (`base.py`, `box_office.py`, `lodging.py`, `shuttle.py`, `experiences.py`) | SupplierGateway interface and implementations |
| `services/opc/partners/` (`glamping_co.py`, `meet_and_greet.py`, `vip_shuttle.py`) | Partner-specific gateways that extend the base gateways |
| `services/opc/model/` (`orders.py`, `items.py`, `suppliers.py`, `rules.py`) | Trip-order data model |
| `services/notifications/`, `services/loyalty/`, `services/reporting/`, `services/affiliates/`, `services/support_console/`, `services/shuttle_planner/` | Event consumers |
| `stubs/` (`bank.py`, `box_office.py`, `lodging.py`, `shuttle.py`, `experiences.py`, `mail_relay.py`, `affiliate_partners.py`) | Systems run by other organizations |
| `tests/`, `scenarios/` | Passing test suite; runnable repro scripts for the bug tasks (`failed_trip.py`, `slow_group_checkout.py`) |

Target size: about 55 files, 2,000–2,400 lines of source, short files (20–90 lines).

### 6.4 Code rules

- Idiomatic Python 3.12 (Pyodide 0.27): dataclasses, ABCs, type hints, docstrings where a real team writes them. TOML via `tomllib` (standard library; no new Pyodide packages).
- Clean, well-named code. Difficulty comes from size and distribution, never from obfuscation or dead code.
- Every Part A answer can be found with the file tree and search in about 7 minutes by a careful student. Repro scripts show symptoms only and never print the answer.
- All seeded defects coexist in one codebase; the code does not change between steps. Files are read-only.

## 7. Tasks

### 7.1 Overview

Round 1 gives students the agent request. Round 2 first asks which view they would request. The capstone has students plan the request themselves.

| Step | Key | Title | View | Kind | Code mechanism | Minutes |
|---|---|---|---|---|---|---|
| 1 | `headliner` | The Headliner Codebase | — | orientation + neutral tool warm-up quiz | — | 6 |
| 2 | `event-consumers` | Event Consumers and Change Impact | component | design question | bindings outside code, wildcards | 13 |
| 3 | `failed-trips` | Failure Paths in an Order Workflow | sequence | bug | async queues, missing step | 14 + 3 quiz |
| 4 | `data-model` | What the Data Model Allows | class | design question | multiplicities across files | 13 |
| 5 | `outages` | Outages and Synchronous Dependencies | module view, then component | design question + view contrast | configuration-resolved calls | 15 |
| 6 | `checkout-latency` | Latency on the Checkout Path | sequence | bug | remote calls in loops | 13 + 3 quiz |
| 7 | `choose-the-view` | The Right View for the Question | all + none | capstone (5 questions) | view selection | 15 |

View order C, S, K, C, S: steps 2–3 give the request; steps 4–6 ask students to predict the view first. Total about 95 minutes. Task 2 of the earlier six-task draft (the gateway hierarchy) was cut on 2026-11-21 to fit the time; its content moved to capstone Q-e.

Each step opens with `### Why this matters` (1–2 standalone sentences about the transferable skill) and `### 🎯 You will learn to` (1–3 Bloom-verb bullets), per tutorial-authoring §1. The scenario arrives as a short message from a teammate.

### 7.2 Task blueprints

Every task specifies the Part A questions with key, the hiding mechanism, the agent's request, the diagram's content, the notes (facts with evidence), the follow-up question answered with the diagram only, and the debrief. Option feedback is written for every tempting wrong option and never uses the word "misconception".

#### T1 — Event Consumers and Change Impact (component, publish-subscribe)

- **Message (OPC developer):** "We're splitting `fan_name` into `given_name` and `family_name` in `trip.confirmed`. Fans on the Japan tour asked for proper name order. Before I ship, who consumes this event?"
- **Q1 (multiple):** Which components receive `trip.confirmed`? Options: Trip Website, OPC, Notifications, Loyalty, Warehouse ETL, Affiliate Relay, Support Console, Shuttle Planner, Catalog DB, Bank. **Key:** Notifications, Loyalty, Warehouse ETL, Affiliate Relay.
- **Q2 (single):** Which of them passes the event to another organization? **Key:** Affiliate Relay (influencer partners' webhook, so the schema change affects an external contract).
- **Hidden by:** bindings live in two places, `deploy/broker.toml` (Loyalty `trip.confirmed`, Warehouse ETL `#`, Affiliate Relay `trip.*`, Support Console `trip.cancelled`, Shuttle Planner `supplier.shuttle.*`) and `@consumes()` decorators in `services/notifications/consumers.py`. Searching for the text `trip.confirmed` finds only the publisher, Notifications, and Loyalty.
- **Request:** "Draw a UML component diagram of who publishes to and consumes from the `trips` exchange, with each binding key."
- **Diagram:** exemplar `event-consumers.component.target.uml`.
  - The `Headliner` package contains the OPC «BackendService», which uses the broker's `Publish` interface through ball and socket.
  - The `trips` «TopicExchange» stands in for a rich connector (DSA §3.4.3).
  - Each consumer has an `events` port, joined to the exchange by a plain connector labeled `«subscribe» {binding = "…"}`.
  - AffiliatePartners «ExternalSystem» sits outside the package; AffiliateRelay reaches it through the partners' `Webhook` interface.
- **Notes:** binding sources with file and line; `*` matches one word and `#` matches any number (`platform/broker.py`).
- **Follow-up (multiple):** Which components receive `trip.cancelled`? **Key:** Notifications, Warehouse ETL, Affiliate Relay, Support Console.
- **Debrief:** implicit invocation, with bindings outside the code. *Find it in code next time:* list every binding (`[[bindings]]` and `consumes(`), then match each pattern. *The view* puts every consumer of one exchange in one place.

#### T2 — removed (2026-11-21)

Cut to fit the time budget. The `SupplierGateway` hierarchy and its contract-breaking overrides remain in the codebase and are assessed in capstone Q-e. Keys and diagrams below that mention T2 refer to Q-e.

#### T3 — Failure Paths in an Order Workflow (sequence, trace)

- **Message (support escalation):** "Three fans were charged for Neon Nights trips that ended up Failed. One says their glamping tent is still booked."
- **Run:** `scenarios/failed_trip.py` prints the symptom (a captured payment, status Failed, supplier bookings still open) without the cause.
- **Q1 (single), explanation.** **Key:** the card is captured before suppliers answer, and the rejection path only marks the order Failed. It neither refunds the capture nor cancels the suppliers that already confirmed. Distractors: a bank double capture on retry; the website charging again on reload; late supplier answers being ignored.
- **Q2 (multiple):** What must the rejection path add? **Key:** refund the capture; cancel the supplier orders that already confirmed. Distractors: resend the rejected order to another supplier; email the fan (already happens via `trip.failed`).
- **Hidden by:** the workflow spans `api.py`, `intake.py`, the broker, `workflow.py`, `payment_task.py`, `supplier_task.py`, the callback endpoint, and `invoice_task.py`. The defect is an *absence*, which search cannot find.
- **Request:** "Draw a UML sequence diagram of a trip order from submission until every supplier has answered, including the rejection path."
- **Diagram:** exemplar `failed-trips.sequence.uml` (renders today):
  - seven instance lifelines, with OPC and «external» organization boxes;
  - synchronous submission with replies; asynchronous queue handoffs and callbacks;
  - two `loop` fragments and an `alt` on the supplier's decision;
  - a key note.

  The reject operand shows `mark_failed()` and the asynchronous `publish(trip.failed)`, so the "email the fan" distractor stays consistent. It shows no refund and no cancellation. The confirm operand's guard is `[last supplier order confirmed]`; a confirmation while others are still pending changes nothing, and a note says so.
- **Graded evidence check (first of three, scaffolded):** "The diagram shows no refund on the reject path. Absence in a diagram is a hypothesis: open the reject branch in the code and confirm that nothing else happens." The question names what to check.
- **Notes:** which messages travel through the broker (`deploy/broker.toml`); retry policy of the supplier calls. No note mentions the missing steps.
- **Follow-up (single):** When is the card charged relative to the first supplier confirmation? **Key:** before any supplier confirms.
- **Debrief:** asynchronous handoffs; behavior distributed across tasks; a missing compensation step. *Find it in code:* follow the queue names from producer to consumer, then read each branch for what it undoes. *The view* lays one scenario out in time order, so a branch with a missing message stands out.

#### T4 — What the Data Model Allows (class, data model)

- **Message (product):** "Big festival weekend. Before we put anything on the landing page: which of these can we sell without changing the data model?"
- **Q1 (multiple), allowed today.** Options: (1) a fan buys a trip for three friends and doesn't go; (2) ten friends in one trip order; (3) two friends share a tent and a third gets a cabin; (4) splitting the payment across two cards; (5) a meet-and-greet for an attendee without a festival pass; (6) one shuttle supplier order shared by two trip orders. **Key:** (1) and (3).
- **Hidden by:** multiplicities in type hints (`payment: Payment` versus `list[...]`), `__post_init__` validators (at most 8 attendees), and `rules.py` constraints, across four files.
- **Request:** "Draw a UML class diagram of the trip-order data model in services/opc/model: multiplicities, composition, and the constraints the code enforces."
- **Diagram:**
  - Classes (no stereotypes, since «Entity» applies only to components): Fan, TripOrder, Attendee, Payment, TripItem {abstract} with FestivalPass, LodgingStay, Experience, TransportItem {abstract}, ShuttleRide, plus SupplierOrder.
  - Composition from TripOrder to Attendee (1..8), TripItem (1..*), and SupplierOrder (1..*).
  - Associations: Fan–TripOrder with role `buyer` (1 to 0..*), TripOrder–Payment (1), TripItem–Attendee (1..* each way), SupplierOrder–TripItem (1..*).
  - Constraint note `{every attendee of an Experience holds a FestivalPass}`.
  - Eleven classes, at the size of DSA Fig. 2.14. TransportItem appears here so capstone Q-b builds on a class students have seen.
- **Follow-up (single):** To let each attendee pay their own share, which multiplicity must change? **Key:** TripOrder–Payment, from 1 to 1..*.
- **Debrief:** multiplicities are scattered across type hints and validators; the data model view gathers them (DSA Table 2.6). *Find it in code:* write down each field's multiplicity as you read the model files.

#### T5 — Outages and Synchronous Dependencies (component, C&C)

- **Message (ops):** "Maintenance windows on Friday, one at a time: Bank, Lodging Provider, message broker, Mail Relay. The Sunset Sessions presale opens at noon. For each window, can fans still submit trip orders?"
- **Q1–Q4 (single each).** Options for every outage: *fans cannot submit*; *fans can submit and the OPC finishes the orders afterwards*; *orders submit and complete, only emails wait*. **Key:** Bank: cannot submit (the website validates the card before submitting). Lodging Provider: submit, finish afterwards. Message broker: **cannot submit** (OPC intake publishes during the request). Mail Relay: only emails wait.
- **Hidden by:** the `@requires_valid_card` decorator; `api.submit` → `intake.accept` → `broker.publish`, a network call with no outbox; service names resolved from `deploy/services.toml`.
- **Request:** "Draw a UML component diagram of the runtime path of a trip order: every component and external system involved, each connector's protocol, and whether the fan waits for it."
- **Diagram:**
  - Inside the `Headliner` package: TripWebsite, OPC, OrderDB, CatalogDB, MessageBroker, Notifications. Outside it, as «ExternalSystem»: Bank, BoxOffice, LodgingProvider, ShuttleProvider, ExperienceProvider, MailRelay.
  - Synchronous call-return is drawn as ball and socket, socket on the caller: TripWebsite → Bank `CardService`, TripWebsite → OPC `PurchaseOrderService`, OPC → MessageBroker `Publish` (the trap: publishing is a call the fan waits for), OPC → OrderDB `sql`.
  - Queued messaging is drawn as plain connectors with `«consume»`: MessageBroker to OPC's workflow, and MessageBroker to Notifications.
  - The key says that ball and socket means the caller waits, and a «consume» connector means the message is processed later. Line style carries no extra meaning.
  - Twelve components.
- **Follow-up (single):** Which single change keeps fans ordering while the broker is down? **Key:** store the order and an outbox entry in one Order DB transaction and publish afterwards. Distractors: retry the publish in the request; host the broker on the OPC's machine; have the website publish directly.
- **Debrief:** connections are resolved by name from configuration; a call named "publish" is still a request-path dependency. *Find it in code:* from the website endpoint, list every client call made before the response. *The view* separates the fan's path from queued work. Ties to SAIP availability tactics.

#### T6 — Latency on the Checkout Path (sequence, performance)

- **Message (product):** "Checkouts for a group of 5 attendees with 3 experiences at Lakeside Fest take over 8 seconds. Our target is 2 seconds."
- **Run:** `scenarios/slow_group_checkout.py` prints the total time on the fake clock. Latencies are non-uniform, so the time does not reveal the call count: bank validation 300 ms, each pass quote 1,100 ms, capacity checks 600/750/900 ms, OPC submit 200 ms; about 8.4 s in total.
- **Q1 (single):** How many calls to other organizations' systems (the bank and the providers) happen before the fan sees "Order received"? Options: 3, 8, 9, 10. **Key:** 9 (1 card validation, 5 pass quotes, 3 capacity checks). Each distractor reflects a specific miss: 3 ignores the loops, 8 misses the decorator's bank call, 10 counts the internal OPC call.
- **Diagram addition:** per-call durations appear as evidence-linked notes, so the follow-up can be answered from the diagram. The fact tests compute the post-fix time (one bulk quote of about 400 ms plus parallel capacity checks of about 900 ms, under 2 s).
- **Hidden by:** a per-attendee loop in `pricing.py` (the Box Office API accepts bulk quotes); a per-experience loop in `availability.py`; card validation in a decorator; client calls that look local.
- **Request:** "Draw a UML sequence diagram of a group checkout on the Trip Website, from Book now until the fan sees Order received, including calls to external systems and loops. Mark the 2-second response target."
- **Diagram:** eight lifelines (`fan: Fan`, `checkout: CheckoutController`, `pricer: TripPricer`, `guard: AvailabilityGuard`, `po: PurchaseOrderService`, and «external» `bank: Bank`, `boxOffice: BoxOffice`, `experiences: ExperienceProvider`); `loop [for each attendee]` and `loop [for each experience]` around the remote calls; a duration-constraint note `{response ≤ 2 s}`.
- **Follow-up (single):** Which change gets this checkout under 2 seconds? **Key:** one bulk pass quote, and capacity checks in parallel. Distractors: cache the card validation; more OPC workers; move pricing into the OPC.
- **Debrief:** remote calls inside loops in different classes. *The view* shows the loop frames on the external lifelines; DSA §8.2.2 on local versus remote calls.

### 7.3 Capstone — The Right View for the Question (`mode: plan-first`)

Part A: for each of five questions, students choose what to ask for. Each question offers a class diagram of X, a component diagram of Y, a sequence diagram of Z, or *no diagram: read file F*. They lock in their choices. Part B shows the expert's view for each question, and students answer.

| Question | Best view | Answer |
|---|---|---|
| Q-a: Rule: the Trip Website reads order data only through OrderTrackingService. Does the running system follow it? | Component diagram of the website's runtime connections | No: the order-history page reads the Order DB replica over SQL (`deploy/website.toml` `ORDER_HISTORY_DSN`) |
| Q-b: A new `RidesharePickup` extends `TransportItem`. Which operations must it implement? | Class diagram of the TripItem hierarchy | `price()` and `supplier_kind()`; `TransportItem` supplies `cancellation_deadline()` |
| Q-c: A fan cancels a GlampingCo trip 2 days before check-in. Does the refund come before or after the supplier cancellations, and can the tent stay booked? | Sequence diagram of trip cancellation | Refund first (synchronous with the bank), then queued cancellations; GlampingCo's override raises, so yes |
| Q-d: Is the service fee configured per festival or for the whole site? | No diagram: read `services/website/pricing.py` | Whole site: one constant, `SERVICE_FEE_RATE = 0.12` |
| Q-e: Fans who cancel trips with some partners get stuck in "Cancelling" while the partner is online. Which gateway classes can fail `cancel()` like this, and which classes would change if `ExperienceGateway.place()` started batching? | Class diagram of the `SupplierGateway` hierarchy across packages (`opc::gateways`, `opc::partners`) | `GlampingCoGateway` (within 72 h of check-in) and `MeetAndGreetGateway` (always); `ExperienceGateway` and `MeetAndGreetGateway` |

Q-d is the control question. Experiments found no diagram benefit for questions answerable from local code (§5.3), so students practice deciding when not to reach for a diagram.

**Deliberate error (decision 1).** The Q-a reply omits the Trip Website → Order DB replica connector. This is a realistic agent omission, because the connection is configured only through `ORDER_HISTORY_DSN` in `deploy/website.toml`. After answering Q-a, students get one graded **evidence question**: "Your answer relies on the diagram showing every connection the website makes. Check where the order-history page gets its data (`services/website/order_history.py`). Does the code agree with the diagram?" **Key:** no; the page reads the Order DB replica directly, so the rule is broken. Students may then revise Q-a.

The debrief names the error type and the research on omitted relationships (§5.3). It also states the rule: absent from a diagram does not mean absent from the code. The view choice still counts as correct, because the component view was the right request and its reply was incomplete. The fact tests list this omission as the one intended exception. No other diagram contains a deliberate error, and the reply card's label for this one diagram omits "verified against the code".

The step ends with the **results card** (§9.1).

### 7.4 Knowledge checks

Titles `Step N — Knowledge Check`; `min_score: 0.8`; quiz-format rules; never instruct students to run a snippet.

- **Step 1 (3 questions, tool warm-up):** Which file wires service names to addresses? Where are broker bindings declared? Which module schedules the supplier retries? Answered by using the file tree and search.
- **Step 3 (4 questions):** view–question fit in new contexts (2); why a text search missed consumers (wildcards plus configuration); why the missing refund could not be found by search (an absence).
- **Step 6 (5 questions, spaced):** which events a binding `order.*` receives (T1); what an asynchronous message after the reply means (T3); what a multiplicity 0..1 allows (T4); what a synchronous connector on the request path implies for availability (T5); what a loop frame around a remote call implies for latency (T6).

## 8. The agent diagrams

### 8.1 Notation contract

**Component diagrams** conform to OMG UML 2.5.1 (§11.2.4 connectors, §11.3.4 ports, §11.6.4 components, §12.2.4 packages, §12.3.4 stereotypes). They follow DSA App. A.3 (pp. 438–442, PDF 480–484) wherever DSA's UML advice and the UML spec agree. DSA's informal figures (Figs. 3.1 and 4.5) supply the content, not the notation.

| Element | Use it for | Never use it for |
|---|---|---|
| Component (box with the component icon, which stands in for «component», §11.6.4) | A runtime unit: a deployed service, application, database, broker, or external system. Each type runs once here, so components are shown as types with capitalized names | A code module, class, or package |
| Stereotype from the *Headliner architecture* profile («WebApplication», «BackendService», «Database», «MessageBroker», «TopicExchange», «ExternalSystem») | The component's kind. Shown in plain face, centered above the name; several stereotypes go in one pair, comma-separated (§9.2.4, §12.3.4). UML draws every component as the same box, so stereotypes carry the distinction (DSA pp. 145–146) | Decoration; Standard Profile names with a different meaning (`Service`, `Entity`) |
| Port (small square on the border, §11.3.4) | A named interaction point: a provided service endpoint (`PurchaseOrderService`), a role (`events`), or a client role | A method, an event topic, a data field |
| Provided and required interfaces joined ball-and-socket (assembly, §11.2.4) | Synchronous call-return: the socket side calls, the ball side answers. Also database access | Messaging |
| Connector line, no arrowheads (§11.2.4: "drawn using similar notation to that for Association") | Messaging through the broker, with a stereotype and property string, for example `«subscribe» {binding = "trip.*"}` | Showing direction with arrowheads; code imports |
| Dependency (dashed arrow, optional «use») | Overview "depends on" without wiring detail (§11.6.5, Fig. 11.39) | Runtime messaging |
| Component standing in for a rich connector | The `trips` exchange, which has its own properties (DSA §3.4.3) | — |
| Package (folder with tab, name in the tab when members are drawn inside, §12.2.4) | Headliner's own components versus external systems | Runtime grouping that is not ownership; dashed "scope" rectangles (not UML) |
| Key, as a Comment (note symbol, §7.4.4) | Notation version and the profile's stereotypes, with what synchronous and asynchronous mean in this view | Redefining UML line styles |

**Class diagrams** follow DSA §2.3 (generalization), §2.6 (data model), and App. A.2:

| Element | Use it for | Never use it for |
|---|---|---|
| Class or «interface» | A Python class or ABC | A runtime service |
| Package frame | A Python package (DSA Fig. 2.15) | Runtime grouping |
| Generalization | `class B(A)` | — |
| Realization | Implementing an ABC's interface | — |
| Association with multiplicities | A field holding references, with how many | A method call |
| Composition | The whole controls the part's lifetime | Merely holding a reference |
| «use» dependency | A uses relation | Ownership |
| `{abstract}`, italic names | Abstract classes and operations | — |
| Constraint `{…}` in a note | An invariant a validator enforces | — |
| Members | Only those the request needs (DSA: one style per diagram) | Full member dumps |

**Sequence diagrams** follow DSA §8.3.1 and App. A.5 and the project's diagrams skill (UML 2.5.1, clause 17):

| Element | Use it for | Never use it for |
|---|---|---|
| Lifeline `name: Type`, `: Type`, `x[i]: Type` | An instance of a component or object from the structural views | A class |
| Synchronous `->` with reply `-->` | A request whose sender waits | Queue messages, events |
| Asynchronous `->>` | Queue messages, callbacks, fire-and-forget | Replies |
| `alt` / `opt` with guards | Branches on data available before the fragment | Repeating a call in each branch |
| `loop [for each …]` | Repetition | — |
| `par` | Concurrent activity | — |
| `ref` | Only as an interaction use with no messages inside (DSA Fig. 8.5). ArchUML cannot draw this yet; until it can, show the messages directly | Hiding messages inside a box that also shows them |
| Organization box, «external» | Lifelines owned by other organizations | — |
| Duration constraint `{≤ 2 s}` | A timing requirement (a note until ArchUML supports constraints) | — |
| Self-message | An operation of the receiver | A field assignment (use a note) |

### 8.2 Style rules

1. **One request, one view, one takeaway.** The scope is exactly what the request asks for; the reply card lists what was left out (DSA §6.2).
2. **Key on every diagram.** It names the notation (UML 2.5), line styles, and stereotypes.
3. **Notes report facts, not conclusions.** A note may state a schedule, a retry policy, a wildcard rule, a fail-open threshold, a contract, or where a binding is declared, always with `file:line`. It never states what the task asks.
4. **Labels attach unambiguously.** Per-endpoint names go on ports; after layout, every connector label must sit on its own path. Dense fan-outs mis-place labels in the automatic layout (verified in rendering trials), so tune them with manual positions.
5. **Size ceilings.** The good-diagrams soft caps (≤ 7 classes, ≤ 5 lifelines) are exceeded on purpose: the tutorial depicts a large system at the books' own figure sizes (DSA Fig. 2.14: 11 classes; Fig. 8.5: 7 lifelines; Fig. 4.5: 11 components and 7 service endpoints). Hard ceilings are 10 classifiers, 8 lifelines, and 14 components. Each diagram must stay readable at the diagram pane's width with the Fit control.
6. **Straight edges** where possible, no overlapping readables, readable text at 100 % in both themes and print.
7. **Instances in sequence diagrams.** Several objects of one type are instances of that one type (`supplier[i]: SupplierProvider`), never invented per-object types.

### 8.3 The reply card

Each diagram arrives as an agent reply:

- **You asked:** the request, verbatim.
- **Summary:** 1–2 sentences describing the view, not the answer.
- **The diagram**, with key.
- **Evidence:** notes as buttons that open the file at the line in the editor.
- **Files read** and **Left out.**
- A visible label: *Prepared in advance by an AI coding agent from this repository's code and verified against the code.* Add "and reviewed by course staff" only after the instructor has signed off on that diagram.

The debrief adds the calibrated-trust habit: agents recover classes more reliably than relationships, so before relying on a diagram at work, open the evidence for the one connection your answer depends on. *Absent from the diagram* does not mean *absent from the code*.

### 8.4 Exemplars

- `failed-trips.sequence.uml`: T3's diagram; renders today. Checked visually: instance lifelines, organization boxes, sync versus async arrows, two loops, `alt`. The reject operand contains only `mark_failed()`.
- `event-consumers.component.target.uml`: T1's diagram in target syntax. It needs the ArchUML additions in §9.4. Today, stereotypes detach ports and `rectangle` frames are ignored (verified).

## 9. Runtime fit

### 9.1 The diagram challenge step block

A new module `js/tutorial-diagram-challenge.js` with `css/tutorial-diagram-challenge.css`. It renders inside the instruction pane after the step's Markdown.

```yaml
diagram_challenge:
  mode: code-first            # code-first | plan-first (capstone)
  budget_minutes: 7           # soft nudge only; never a time limit
  min_score: 0.8              # Part B plus follow-up, to complete the step
  predict_view: false         # true from step 4 on: Part A also asks which view to request
  attempt:                    # Part A attempt requirements (§16, review C1)
    hypothesis: true          # one free-text sentence, written before any option is shown
    evidence_pins: 1          # minimum number of pinned path:line locations ("Pin this line")
    view_wish: true           # one sentence: what would you want a view to show?
  questions:                  # quiz-schema subset: single | multiple (no ordering questions in this release)
    - id: receivers
      type: multiple
      question: "..."
      options: ["..."]
      correct_indices: [2, 3, 4, 5]
      option_feedback: {0: "..."}
  plan: []                    # plan-first only: one view choice per question
  reply:
    contrast:                 # optional (T5): a poorly fitting view shown first
      request: "..."
      diagram: {id: imports, type: class, source: "..."}
      question: {id: fits, type: single, question: "Can this view answer the outage question?", options: ["..."], correct_index: 1}
    request: "..."
    summary: "..."
    diagrams:                 # one per task; the capstone has three
      - id: events
        type: component
        source: |
          @startuml
          ...
          @enduml
    evidence:
      - text: "Warehouse ETL binds # (every event)"
        ref: deploy/broker.toml:31
    files_read: ["..."]
    left_out: "..."
  follow_up:
    - id: cancelled
      type: multiple
      question: "..."
      options: ["..."]
      correct_indices: [2, 4, 5, 6]
  evidence_check:             # optional graded check (T3, T5, capstone): absence is a hypothesis
    claim_question: {...}     # capstone only: "Which claim does your answer depend on that this diagram cannot prove?"
    prompt: "..."             # what to check in the code (T3 names it; T5 names the claim; capstone names neither)
    question: {id: verified, type: single, question: "...", options: ["..."], correct_index: 0}
  debrief:
    hidden_by: "..."
    find_in_code: "..."
    view_shows: "..."
    consolidation_prompt: "What did the diagram put side by side that you had to search for?"   # required one-sentence answer
    mechanism_question: {id: mechanism, type: single, question: "Which mechanism hid the answer in the code?", options: ["..."], correct_index: 0}
```

Scoring: Part B's **first** attempt feeds the comparison; later attempts only practice. `min_score` covers Part B's latest attempt, the follow-up, the evidence check, and the mechanism question. A Part A attempt that meets `attempt` earns completion credit whatever its correctness.

**States:** `exploring` → `locked` → `follow-up` → `done`.

1. **Exploring.** The form shows the questions, a confidence choice (guessing / fairly sure / sure), and, in round 2, the view prediction. **Lock in my answer** becomes enabled when every question is answered. It opens the shared confirmation dialog: "Lock in? You will see the agent's diagram next, and this answer cannot change afterwards." At the budget, a polite status message suggests locking in the best answer; nothing is interrupted.
2. **Locked.** Part A answers become read-only. The reply card appears, and the diagram opens in the diagram pane (§9.2). The questions return, prefilled with the Part A answers. **Check** grades them and shows correct/incorrect per question, without explanations yet.
3. **Follow-up.** One new question, timed separately: the cleanest measure of how fast the view answers a fresh question.
4. **Done.** The comparison panel shows Part A versus Part B versus key per question (found, missed, extra), option feedback, times, confidence calibration, and the debrief. In round 2 it also shows the view prediction versus the expert's choice. The panel prompts: *what did the diagram put side by side that you had to search for?*

**Timing.** Active time only: the step must be current and the document visible. Times are stored to the tenth of a second, survive reloads, and are shown only on the comparison panel. There is no visible running clock.

**Scoring and gating.** Part B plus the follow-up must reach `min_score` to complete the step, which records `stepsPassed` and unlocks Next under `require_tests: true`. Part B may be retried; Part A never changes. **Reset Step** clears the record after confirmation and restarts Part A. Instructor mode shows keys and all panels.

**Results card (capstone).** A table per task: from the code (correct, time, confidence), with the diagram (correct, time), the follow-up (correct, time), and the mechanism that hid the answer. One honest sentence: the second answer also benefited from the first search, and the follow-up times are the cleaner comparison. The card has an accessible table, survives reload, and prints.

**Persistence.** The existing progress record gains `diagramChallenges: {"key:<stepKey>": {v, state, a: {answers, confidence, view, seconds}, b: {answers, seconds, attempts, score}, f: {answers, seconds, attempts, score}}}`. No new storage key. Update `/cookies/`, tutorial-authoring §4.7, and SE Gym import and export (whole-record passthrough).

**Popouts.** Version 1: the instructions popout shows the challenge read-only with "Answer in the main window". Full synchronization is later work.

**Print.** Each step prints the scenario, the questions, then the reply card labeled "shown after you lock in": diagram, key, and evidence list. Keys and debriefs print only in instructor mode. The codebase prints once, at step 1 (`print_unchanged_files: false`). The results card prints from the final step when a record exists.

**Accessibility (WCAG 2.2 AA):**
- Native fieldsets, legends, radios, and checkboxes.
- Ordering questions use the existing keyboard Parsons interaction, so no dragging is required.
- Polite live announcements for lock-in, check, and results.
- Focus moves to the reply heading after lock-in and to the results heading after check.
- No time limits, so criterion 2.2.1 does not apply; the budget nudge is a status message.
- Diagrams carry the auto-generated description, plus the evidence list as text.
- Targets at least 24 × 24 px; focus never hidden behind sticky panes.
- Reflow at 320 px; contrast in both themes; print in light mode.

### 9.2 The diagram pane

- A **Diagram** view beside **Editor** in the workspace, following the existing view-toggle pattern (`git_graph`, `make_dag`).
- It is disabled, with an explanation, until lock-in.
- Default layout is split, code and diagram side by side, so evidence links and the diagram are visible together. It stacks on narrow screens.
- Reuses ArchUML rendering with the shared Fit/Restore control, zoom buttons, full screen for the pane, and keyboard scrolling.
- The capstone shows its diagrams as tabs.
- Evidence buttons open the file tab, reveal the line, and decorate it briefly.

### 9.3 Navigation for multi-file steps

- **`file_tree: true`** (tutorial or step): a folder-structure file navigator replaces the linear tab selector as the way to find files, like an IDE explorer.
  - **Tree:** a panel left of the editor showing the step's files as nested, collapsible folders (`services/opc/partners/…`, `deploy/…`), including non-code files. Top-level folders start expanded and deeper ones collapsed. The open file's path expands and its row is highlighted.
  - **Tabs:** with the tree on, the tab strip lists only the files the student has opened (plus `open_file`), with close buttons, so it stays short.
  - **Accessibility:** the WAI-ARIA treeview pattern: `role="tree"`/`treeitem`, `aria-expanded`, `aria-selected`, roving tabindex. Up/Down move; Right/Left expand, collapse, or move to child or parent; Home/End jump; Enter or Space opens a file. Add these keys to `/shortcuts/`.
  - **State:** expansion state lasts for the page session only. Search results and evidence links expand the path to the file they open. On narrow screens the tree collapses into a disclosure above the editor.
  - **Rollout:** ships opt-in to avoid breaking existing tutorial tests. A follow-up task enables it for the existing multi-folder tutorials (for example `repo-debugging`) after updating their tests.
- **`project_search: true`:** a search panel with match case, whole word, and regular expression options. It searches all step files, including TOML and Markdown. Results are grouped by file with line numbers and highlighted matches; a result button opens the file at the line. The count is announced; at most 500 results. Opened with a button and with Ctrl/Cmd+Shift+F (add to `/shortcuts/`).
- **`readonly: true`** (file or step): Monaco read-only, so evidence line numbers stay valid. Run and tests still work.

### 9.4 ArchUML additions (submodule `js/ArchUML`)

| Addition | Syntax | Needed for |
|---|---|---|
| Component stereotypes, with or without port blocks: plain face, centered above the name, several in one comma-separated pair, author's capitalization kept (UML §9.2.4, §12.3.4) | `component OPC <<BackendService>> { portin ... }` | every component diagram (required) |
| Package frames in component diagrams (UML §12.2.4): folder tab, name in the tab when members are drawn inside, solid outline; connectors and dependencies may cross | `package Headliner { component ... }` | T1, T5, capstone Q-a (required) |
| Package frames in class diagrams (same shape; `::` qualified names; nesting) | `package opc::partners { class ... }` | T2, capstone Q-b (required) |
| Connector labels with stereotypes and property strings (UML §11.2.4) | `a -- b : «subscribe» {binding = "trip.*"}` | T1, T5 (required) |
| Empty interaction use | `ref over a, b : CapturePayment` | sequence diagrams (optional) |
| Duration constraint between two messages | `{≤ 2 s}` | T6 (optional; a note meanwhile) |

Each addition needs renderer tests, the auto-describer (`js/uml-auto-describe.js`) mentioning stereotypes and frames, the visual editor tolerating the syntax, and light, dark, and print checks. Per CLAUDE.md, these are fixed in place in the submodule. The final summary must tell the user that two repositories need commits.

### 9.5 Files to add or touch

- New: `js/tutorial-diagram-challenge.js`, `css/tutorial-diagram-challenge.css`, `js/tutorial-file-tree.js`, `js/tutorial-project-search.js` plus CSS, `_data/tutorials/uml-design-questions.yml`, `SEBook/tools/uml-design-questions.md`, `SEBook/tools/uml-design-questions/print.md`.
- Touch: `js/tutorial-code.js` (step hooks, Diagram view, gating, persistence, Reset Step), `_layouts/tutorial.html`, `_layouts/print-tutorial.html`, `tutorial-instructions-popup.html`, `_data/CS130_nav.yml`, three UML chapters (Practice links), `/cookies/`, `/shortcuts/`, `.agents/skills/tutorial-authoring/SKILL.md` (§3.1, §3.2, §4.4, §4.7, §4.8).

## 10. Content pipeline and verification

- **Pre-generated diagrams.** After the Headliner code is final, the authoring agent writes all nine diagrams (six tasks plus three capstone views) from the code, one per request, following §8.1–8.2. They are stored as `.uml` sources and inlined into the YAML as static content. No diagram is generated at runtime, and the runtime needs no model or agent integration. The fact tests below verify every diagram against the code. Record the instructor's sign-off per diagram before the label may mention course staff.
- **Source of truth.** The Headliner tree and diagram sources live in `tutorial_sources/uml-design-questions/` (excluded from the Jekyll build). A generator writes the shared step files into the tutorial YAML once, through YAML anchors, and inlines the diagram sources. A test fails when the YAML and the source tree differ.
- **Facts, keys, and diagrams agree by construction.** `scripts/uml_design_questions/facts.py` boots the devstack and extracts:
  - bindings per exchange and the receivers of each topic;
  - the gateway hierarchy, with overrides and the exceptions they raise;
  - model multiplicities, checked by constructing invalid objects;
  - traced call orders for the T3, T6, and cancellation scenarios;
  - external calls before the response, per outage.

  Answer keys are generated from these facts. A Node test parses every diagram with ArchUML's parser and asserts that its elements and relations match the facts. A third test checks that every `file:line` reference points at a line containing the named symbol.
- **Notation lint.** Lifelines are instances; no reply follows an asynchronous message; no port name ends in `()`; every diagram has a key; size ceilings hold.
- **Label audit.** A Playwright script measures each rendered connector label's distance to its own path versus other paths and fails on ambiguity. A manual review covers the rest.
- **Codebase tests.** pytest under CPython in CI and inside Pyodide in Playwright.
- **Runtime tests (Playwright):**
  - diagram-challenge flow: lock, reveal, retry, gating, reload persistence, Reset, timer pausing when hidden, keyboard-only use, popout read-only, print;
  - file tree and search;
  - WCAG audit, light and dark mode, print light.
- **Content tests:** step structure, reading budget (≤ 300 words per step before the challenge), quiz format, pedagogy comments.
- **Pilot:** one or two TAs time Part A per task before release; adjust budgets and distractors if Part A takes over 8 minutes or is trivially fast.

## 11. Pedagogical review

**Time budget.** About 95 minutes: orientation 6, five tasks 68 (13–15 each, including the Part A attempt requirements and debriefs), knowledge checks 6, capstone with results card 15.

**PRIMM mapping:**
- *Predict:* the Part A answer with confidence, a prediction about the system's behavior.
- *Run:* the repro scripts in T3 and T6.
- *Investigate:* the diagram and its evidence.
- *Modify:* the follow-up fixes in T3, T5, and T6.
- *Make:* planning the request in the capstone.

**Fading.** Round 1 gives the request. Round 2 asks for the view prediction first. The capstone has students plan the view, including when to use none.

**Desirable difficulties:**
- *Interleaving:* view types interleave.
- *Spacing:* the knowledge checks revisit earlier tasks.
- *Generation:* the struggle-then-reveal loop.

The literature's conditions are met. The code-only phase is bounded and supported by real tools. The reveal builds on the student's own committed answer. The comparison makes the contrast explicit. Orientation and the notation reference come first, because element interactivity is high (§5.3).

**Metacognition.** Confidence ratings, plus a calibration line on the results card ("sure" but missed items).

**Cognitive load:**
- One system for every task, so the domain is learned once.
- README orientation; tree and search tools.
- Read-only code; scoped diagrams with keys.
- Notes as facts.
- Short instructions.

**AI-era framing.** Agents can draw any view in seconds. The human skills are choosing the view, reading it, and checking the claim an answer depends on. Agent diagrams are as-built recoveries; intended rules come from people (capstone Q-a).

**Residual risks:**
- Students may skim Part A and lock in early to reach the diagram, which weakens the contrast. *Mitigation:* nothing is forced; the results card shows Part A's score and time, and the follow-up time is the clean comparison either way.
- The code may make some answers too easy to find. *Mitigation:* the pilot timing.
- Diagram density may overwhelm. *Mitigation:* the hard ceilings, Fit, and full screen.
- The ArchUML additions are a dependency for three diagrams. *Mitigation:* build them first.

## 12. Calls made for this design (please check)

1. The running system is **Headliner**, festival trips modeled on Adventure Builder. You asked for book-like, realistic, and a bit more fun.
2. Python services monorepo with an in-process devstack; deterministic stand-ins for other organizations.
3. Code is read-only; Run is available for the two repro scripts.
4. Soft budget of 7 minutes; no time limit; no visible clock; times shown only on comparison panels.
5. Part B is prefilled with Part A answers; completion needs Part B plus follow-up ≥ 0.8; Part B retries allowed.
6. Diagrams exceed the good-diagrams soft caps, up to hard ceilings justified by the books' figure sizes.
7. Notes never state conclusions. Diagrams are pre-generated by the authoring agent from the finished code and stored as static content; nothing is generated live. The reply-card label says exactly that, and it mentions course staff only after sign-off.
8. The capstone includes a control question that needs no diagram.
9. Students practice checking a diagram against the code through one deliberate, realistic error in a capstone diagram, caught with a graded evidence question (§14, decision 1).
10. Instructions popout shows the challenge read-only in version 1.
11. ArchUML additions land in the submodule.

## 13. Left to the builder

Exact code and line numbers; wording of instructions, options, feedback, and debriefs within these blueprints; final diagram layout (manual positions); component naming in the diagram pane's tabs; Playwright selectors; the exact budget-nudge threshold within 6–8 minutes.

## 14. Decisions (approved 2026-11-21: option (a) and one release)

1. **Checking a diagram against the code.** Objective 2 asks students to check a claim. But every diagram here is correct, so a check can only confirm it, which risks teaching that checking is pointless. Options:
   - (a) One capstone reply contains a realistic agent mistake, such as a wrong binding key or a missing connector. A graded question asks students to open the evidence for the relation their answer depends on and say whether the code agrees. The debrief reveals the planted error.
   - (b) A graded "which evidence line confirms your answer?" question in every task, with no planted error.
   - (c) Debrief advice only; objective 2 drops its checking clause.

   **Proposed default: (a).** It is the only option where checking can change an answer. The planted error is pre-generated like every other diagram and listed as an intended exception in the fact tests.
2. **Release date and pilot.** When must the tutorial be live for CS 130, and when can the TA pilot run? A near date means shipping in stages and deferring the optional pieces: empty `ref` frames, duration constraints, ordering questions, popout synchronization, and printing the results card.

   **Proposed default:** one release with no fixed date. The ArchUML additions are built first; the pilot runs before the tutorial is linked from the CS 130 navigation.

## 16. Revisions after the pedagogy review and the UML conformance check (2026-11-21)

These supersede earlier text where the two conflict.

**Part A is a real attempt (review C1).**
- Before any options appear, students write a one-sentence hypothesis. Generating it comes before recognizing an option.
- They pin at least one piece of evidence with **Pin this line**, which records the editor's current `path:line`.
- They write one sentence on what they would want a view to show.
- Only then do the options and the confidence choice appear.
- A genuine attempt earns small completion credit; correctness does not.

**The comparison is honest (review C2).**
- The comparison uses Part B's *first* attempt; retries only practice.
- The panel and the results card lead with correctness (found, missed, extra) and show times as a secondary line labeled "your experience, not an experiment".
- No ratio or speed-up is shown, times can be hidden, and nothing claims that follow-up times are a controlled comparison.

**Consolidation (review M1).** The panel requires one sentence answering "What did the diagram put side by side that you had to search for?", plus a graded one-click question naming the mechanism that hid the answer (objective 3). §5.3 and §11 now describe the loop as an *experienced contrast with retrieval practice*. They no longer claim that the productive-failure conditions are met: students learned the notations earlier, and the loop does not ask them to invent a representation. The evidence grade drops to C (Chen et al. 2015, 2019; Sinha & Kapur 2021: instruction first wins for domain-general skills; abstracts only).

**A single rule about absences, faded (review C3, M7).** An absence in a diagram is a hypothesis; confirm it in the code. Graded evidence checks:
- T3: the question tells students what to check.
- T5: the question names the claim; students find the file.
- Capstone: students first answer "Which claim does your answer depend on that this diagram cannot prove?", then check it in the code. The question names no file.

**Debriefs.**
- T1 answers "Why ask for a diagram instead of asking the agent the question?" A view can be reused (the follow-up shows it), inspected, and checked one relation at a time.
- T2's debrief states the defect precisely: an exception that the interface contract does not permit. It says honestly that an IDE's *find implementations* would speed up the code-only search, and that the diagram still shows the whole hierarchy at once.
- T5's view-prediction feedback calls a sequence diagram "defensible, but one trace per outage". The results card notes that earlier diagrams stay available.

**Capstone (review M7).**
- Five questions: a second sequence question about the cancellation order joins the four, so elimination no longer works.
- The control question sounds architectural: "Is the service fee configured per festival or for the whole site?" (answer: one constant in `services/website/pricing.py`).

**Small fixes.**
- The warm-up quiz uses neutral targets: where tests live, which file starts the devstack, where the fake clock is set.
- The diagram pane opens maximized and switches to split view when an evidence link opens a file.
- Every question can be answered from the diagram's text alternative plus its evidence list.
- Sequence diagrams carry a key and keep activations consistent.
- The component exemplar adds evidence for AMQP from `deploy/broker.toml`.

**UML conformance (user request).**
- Every diagram conforms to OMG UML 2.5.1 (§8.1 and §9.4 above).
- The informal dashed scope frame is replaced by a UML package.
- Stereotypes come from a capitalized user profile that avoids Standard Profile names.
- Call-return is drawn as ball and socket, messaging as plain connectors with stereotypes and property strings; component diagrams never use solid arrowheads.
- Data-model classes carry no «entity».
- Sequence organization boxes remain the documented ArchUML extension (ActivityPartition-style lanes).

**Decided 2026-11-21: cut T2.** The time goes to the debriefs, a 15-minute capstone, and a view-versus-view contrast in T5. Before the component view, the reply first shows the module view an agent draws when asked for "the dependencies between Headliner's Python packages". That view shows the real imports: only OPC imports the broker client, and the website imports nothing from OPC because it calls OPC by service name. So it cannot tell whether a broker outage stops a fan's checkout. Imports do not reveal runtime connections (DSA §1.3). Students answer "Can this view answer the outage question?" before the component view appears (`reply.contrast`, §9.1).

## 15. Sources

Books: Clements et al., *Documenting Software Architectures: Views and Beyond*, 2nd ed. (2011); Bass, Clements & Kazman, *Software Architecture in Practice*, 3rd ed. (2013). Research (access level as verified on 2026-11-20; abstracts only unless noted):

- Larkin & Simon (1987), *Cognitive Science* 11(1), doi:10.1111/j.1551-6708.1987.tb00863.x (full text)
- Sillito, Murphy & De Volder (2006), FSE, doi:10.1145/1181775.1181779 (full text); (2008) IEEE TSE 34(4), doi:10.1109/TSE.2008.26
- LaToza & Myers (2010), ICSE, doi:10.1145/1806799.1806829
- Ko, DeLine & Venolia (2007), ICSE, doi:10.1109/ICSE.2007.45
- Arisholm, Briand, Hove & Labiche (2006), IEEE TSE 32(6), doi:10.1109/TSE.2006.59 (technical-report full text)
- Dzidek, Arisholm & Briand (2008), IEEE TSE 34(3), doi:10.1109/TSE.2008.15
- Scanniello et al. (2014), ACM TOSEM 23(2), doi:10.1145/2491912; (2018), EMSE 23(5), doi:10.1007/s10664-017-9591-4
- Gravino, Scanniello & Tortora (2015), JVLC 28, doi:10.1016/j.jvlc.2014.12.004
- Torchiano et al. (2017), JVLC 41, doi:10.1016/j.jvlc.2017.06.002
- Ricca et al. (2010), IEEE TSE 36(1), doi:10.1109/TSE.2009.69
- Fernández-Sáez et al. (2013), EASE, doi:10.1145/2460999.2461008 (full text); (2015), IST 57, doi:10.1016/j.infsof.2014.05.014 (full text); (2016), EMSE 21(1), doi:10.1007/s10664-014-9354-4
- Haitzer & Zdun (2013), ECSA, doi:10.1007/978-3-642-39031-9_6 (preprint excerpts)
- Stevanetic, Javed & Zdun (2014), WICSA Companion, doi:10.1145/2578128.2578230; Störrle (2014), MODELS, doi:10.1007/978-3-319-11653-2_32 (secondary summary)
- Cherubini, Venolia, DeLine & Ko (2007), CHI, doi:10.1145/1240624.1240714 (full text); Petre (2013), ICSE, doi:10.1109/ICSE.2013.6606618; Baltes & Diehl (2014), FSE, doi:10.1145/2635868.2635891
- Shehata et al. (2024), VISSOFT, doi:10.1109/VISSOFT64034.2024.00031; Campanello et al. (2025), JOT 24(2), doi:10.5381/jot.2025.24.2.a14; Abdelmalek et al. (2026), Procedia CS 292, doi:10.1016/j.procs.2026.09.342; De Luca et al. (2026), SSRN preprint 6381011
- Schwartz & Bransford (1998), *Cognition and Instruction* 16(4), doi:10.1207/s1532690xci1604_4; Kapur (2008), *Cognition and Instruction* 26(3), doi:10.1080/07370000802212669; Sinha & Kapur (2021), RER 91(5), doi:10.3102/00346543211019105; Loibl, Roll & Rummel (2017), EPR 29(4), doi:10.1007/s10648-016-9379-x; Alfieri, Nokes-Malach & Schunn (2013), *Educational Psychologist* 48(2), doi:10.1080/00461520.2013.775712; Ashman, Kalyuga & Sweller (2020), EPR 32(1), doi:10.1007/s10648-019-09500-5
