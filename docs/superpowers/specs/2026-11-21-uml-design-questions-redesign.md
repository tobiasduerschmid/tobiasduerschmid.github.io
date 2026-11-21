# Answering Design Questions with UML — question redesign

Date: 2026-11-21. Status: proposal, for instructor review. Scope: the questions of `_data/tutorials/uml-design-questions.yml` (the part after `# END GENERATED`), the facts and content tests that guard their keys, and one optional runtime field. Supersedes §7.2–§7.4 of `2026-11-20-uml-design-questions-tutorial-design.md` where the two differ; everything else in that spec stands (the loop, the reply card, the deliberate omission, the evidence-check fading, the anti-goals).

**The critique this answers:** "The kinds of questions asked here like which file implements X which function does Y are not really the most interesting questions. They are means to an end. Re-design the activity to have more meaningful questions."

**Outcome in one paragraph.** The codebase and nine of the ten diagrams stay exactly as they are; one diagram gains one fact line in a note. No codebase change is needed. Every challenge now opens with a stakeholder who needs a *decision* (ship or hold, schedule or move, which fix, which change, where a rule lives), and the old locate and trace questions become the steps students take to reach it: pinned evidence in Part A, deep links from diagram labels in Part B, and the per-option feedback. 20 of the 27 challenge questions change; of the 12 knowledge-check questions, one is replaced and one reworded. Every new key was checked against the code by running Headliner's devstack on 2026-11-21 (§5 lists each run); four keys are design judgments, flagged in §7 for the instructor.

---

## 1. Diagnosis

### 1.1 How the classification works

- **Purpose:** *locate* (find where or who), *trace* (follow one execution), *evaluate* (judge a state, a property, or an alternative against a requirement), *decide* (choose what to do).
- **Bloom:** revised taxonomy level (Anderson & Krathwohl 2001).
- **Grep alone:** *yes* if a text search plus reading the hit lines gives the answer; *partly* if search finds some of it and misses a part for a structural reason; *no* otherwise.
- **Diagram value:** *high* if the diagram places facts side by side that the code spreads over three or more files, or shows an absence; *medium* if it scopes the search; *low* if one file answers as fast.

### 1.2 Every current question

| # | Step | Question (id) | Purpose | Bloom | Grep alone | Diagram value | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | headliner quiz | Folder of the automated tests | locate | Remember | yes | none | tool practice; keep, said to be so |
| 2 | headliner quiz | Function that starts every service | locate | Remember | yes | none | tool practice; keep |
| 3 | headliner quiz | File that sets the fake clock's start | locate | Understand | yes (3 candidates) | none | tool practice; keep |
| 4 | event-consumers | Which components receive `trip.confirmed` (`receivers`) | locate | Analyze (low) | partly (wildcards, `@consumes`) | high | **means to an end** |
| 5 | event-consumers | Which component sends another organization `fan_name` (`forwarder`) | locate | Understand | yes (`fan_name` has 6 hits) | low | **means to an end** |
| 6 | event-consumers | Follow-up: who receives `trip.cancelled` (`cancelled`) | locate | Apply | partly | high | **means to an end**, repeated |
| 7 | failed-trips | Why charged and Failed (`cause`) | evaluate (diagnose) | Analyze | no (an absence) | high | meaningful; merge into a consequence question |
| 8 | failed-trips | What the rejection path must add (`undo`) | decide | Evaluate | no | high | meaningful; sharpen into a choice between fixes |
| 9 | failed-trips | Follow-up: when the card is charged (`charged`) | trace | Understand | partly | medium | **means to an end** |
| 10 | failed-trips | Evidence check: what the reject branch does | locate/verify | Understand | yes, once named | n/a | keep: a verification habit, not a design question |
| 11–12 | failed-trips quiz | View for a new scenario (2) | decide | Apply | n/a | n/a | keep (transfer) |
| 13–14 | failed-trips quiz | Why search missed the consumers; why search missed the defect | evaluate | Understand | n/a | n/a | keep (explains the mechanism) |
| 15 | data-model | Which trips the model allows (`ideas`) | evaluate | Analyze | no (4 files) | high | meaningful; keep |
| 16 | data-model | Follow-up: which multiplicity changes (`split-payment`) | locate (in the diagram) | Apply | n/a | medium | **means to an end** |
| 17–20 | outages | Can fans submit while X is down (4) | evaluate | Analyze | no | high | meaningful; compress into the scheduling decision |
| 21 | outages | Contrast: can the package view answer it (`fits`) | evaluate | Evaluate | n/a | n/a | keep |
| 22 | outages | Follow-up: which change keeps fans ordering (`outbox`) | decide | Evaluate | n/a | high | meaningful; keep |
| 23 | outages | Evidence check: does submit wait for the broker | locate/verify | Understand | yes | n/a | keep |
| 24 | checkout-latency | How many external calls (`remote-calls`) | trace (count) | Analyze (low) | partly (loops, decorator) | high | **means to an end** |
| 25 | checkout-latency | Follow-up: which change gets under 2 s (`fix`) | decide | Evaluate | no | high | meaningful; promote to the main question |
| 26–30 | checkout-latency quiz | Binding match, async after reply, `0..1`, socket on the path, loop cost | trace/evaluate | Understand–Apply | n/a | n/a | keep (notation retrieval, component skills) |
| 31 | capstone | Does the system follow the rule (`rule`) | evaluate (conformance) | Evaluate | partly (`_DSN`) | high | meaningful, but without stakes; add them |
| 32 | capstone | Which operations `RidesharePickup` implements (`rideshare`) | locate | Apply | yes (one file) | medium | **means to an end**; reframe as an estimate |
| 33 | capstone | Refund order and whether the tent stays booked (`cancellation`) | trace + evaluate | Analyze | no | high | half trace; make the consequence the question |
| 34 | capstone | Fee per festival or site-wide (`fee`) | locate | Understand | yes | none | the control; keep, phrase as a decision |
| 35 | capstone | Which gateways can fail `cancel()` (`gateways`) | locate | Analyze | partly (`raise` in 2 files) | high | **means to an end** |
| 36 | capstone | Follow-up: who changes if `place()` batches (`batching`) | evaluate (impact) | Analyze | no | high | fine, but replaced by a transfer question |
| 37–38 | capstone | Evidence check: which claim, and does the code agree | evaluate | Evaluate | n/a | n/a | keep |
| 39–43 | capstone plan | Which view per question (5) | decide | Evaluate | n/a | n/a | keep |
| 44–49 | all | Which mechanism hid the answer (6) | evaluate | Understand | n/a | n/a | keep (objective 3) |

### 1.3 The means-to-an-end questions, and their ends

| Question | The end it serves | Why it disappoints on its own |
|---|---|---|
| `receivers`, `cancelled` | Is Jordan's rename safe to ship, and how should it roll out? | The student lists four names and never learns what happens to them. The message asked "who consumes this?", but nobody on a team stops there. |
| `forwarder` | Does the change, or the data, cross a company boundary? | A search for `fan_name` finds it in one hit; the consequence (an external contract, a privacy rule) is in the explanation, not in the task. |
| `charged` | Which compensation does each ordering of capture and booking need? | It asks for a position in a trace. The position matters only for choosing a fix. |
| `split-payment` | What does the feature cost? | It asks the student to point at an association the stem has already described. |
| `remote-calls` | Which change meets the 2-second target, and at what cost? | A count. The distractors are counting slips, so the feedback corrects arithmetic, not design reasoning. |
| `rideshare` | Is the contractor's estimate right? | One file answers it. |
| `gateways` | Where should "this partner cancels by phone" live? | It finds the two overrides and stops before the design question they raise. |

**Pattern.** The scenarios already come from stakeholders, but eight questions answer the stakeholder with an inventory. Research on what developers ask points the other way: the questions they find hard and consequential are about *implications* ("what will break if I change this?", "what happens when this fails?"), with location questions as their sub-steps (Sillito, Murphy & De Volder 2006, 2008; LaToza & Myers 2010; Ko, DeLine & Venolia 2007). The assessment also sits low: 8 of the 26 current challenge questions (plan and mechanism items aside) are at Understand or Apply. In `cs-tutorial-design` terms this is a mild form of the *Liar Assessment*: the grading rewards finding, while the objectives promise judging.

**What is already right, and stays.** The failure diagnosis and its fix, the outage scenarios and the outbox decision, the latency fix, the data-model yes-or-no list, the view contrast, the evidence checks, and the mechanism questions. The redesign moves the rest up to that level.

---

## 2. Design principles for meaningful questions

A question is *meaningful* here when a practitioner would act differently depending on its answer. Seven kinds qualify. For each: the literature, why a diagram's integrated view is needed, and the rule the redesign follows. Evidence grades use the pedagogical-advisor scale (A strong, B supported, C emerging) and are editorial judgments. Sources marked † are standard references cited from memory in this session; check the locator before quoting one to students.

| # | Kind of question | Grounding | Why it needs the integrated view, not grep | Rule |
|---|---|---|---|---|
| P1 | **Impact of a change** ("is it safe to…; what must change if…") | Modifiability scenarios and the cost-of-change argument, SAIP 3rd ed. ch. 7; information hiding, Parnas 1972†; reachability questions, LaToza & Myers 2010 (B); DSA Table 2.6 on data-model impact analysis | Impact is a *set* (everything that depends on the changed thing). Grep finds members that spell the name and misses those bound by wildcard, configuration, or a shared database. Only a complete set supports "safe". | Ask what breaks or what the change costs. Never ask for the member list alone. |
| P2 | **Failure and consistency** ("what happens to the fan's money when…") | Failure analysis over a trace, SAIP ch. 14 and DSA ch. 8; sagas and compensation, Garcia-Molina & Salem 1987†; RDD: every recovery action needs an owner (Wirfs-Brock & McKean 2003) | The answer is a property of a whole interleaving, and the defect is often an absence. A search returns only code that exists. | Ask for the end state of money and bookings, then for the fix that holds in every ordering. |
| P3 | **Quality-attribute scenarios** (availability, latency, modifiability, security) | Six-part scenarios (source, stimulus, environment, artifact, response, response measure), SAIP ch. 4; tactics, SAIP chs. 5, 8, 9 | The response depends on which connectors lie on one path: synchronous or queued, inside a loop or not, across the trust boundary or not. Those facts sit in different files and in configuration. | Give every scenario a response measure (a deadline, 2 seconds, a policy) and ask for the response or the tactic. |
| P4 | **Conformance** (intended versus as-built) | Layers and allowed-to-use cannot be read off code, DSA §2.4; reflexion models, Murphy, Notkin & Sullivan 1995†; C4: keep facts, proposals, and unknowns apart | A rule quantifies over *every* connection. One counterexample anywhere breaks it, so the student needs a view that claims completeness, and must then test that claim. | Tie the rule to a change it is supposed to make cheap, so a violation has a price. |
| P5 | **Responsibility placement** ("where should this rule live, and why") | Roles, responsibilities, contracts, and explicit variation, Wirfs-Brock & McKean 2003; substitutability, Liskov & Wing 1994†; Design by Contract, Meyer 1997† | Placement compares candidates across packages: who holds the information, who already promises what, who calls whom. A hierarchy with its contract shows all the candidates at once. | Offer real alternatives, each with a named cost; the key is the one whose contract every caller can rely on. |
| P6 | **Trade-offs between alternatives** | Sensitivity and trade-off points, ATAM (Kazman, Klein & Clements 2000; SAIP ch. 21) | A trade-off is two qualities meeting at one design decision. Seeing it means holding two views of one element: the latency trace and the failure trace both pass through the capture. | When two fixes meet the target, ask what the faster one gives up. Reuse an earlier task's diagram to answer. |
| P7 | **Diagnosis that needs the whole interaction** | Hard debugging questions span causal chains across modules, Ko et al. 2007 (B); a diagram groups the facts an inference needs, Larkin & Simon 1987 (B) | The symptom (charged and Failed) and the cause (a branch that undoes nothing) are six files and two queues apart. | Start from a symptom the repro script prints; the question is what is true afterwards and what fixes it. |

**Cross-cutting rules.**

1. **Locating becomes a step, not a grade.** Each task names what to pin in Part A. Students still locate and trace; the graded question is what they do with it (component skills before integration, Ambrose et al. 2010).
2. **Distractors are wrong reasoning, not wrong lookups.** Each one is a decision that a plausible partial model produces: "only two consumers spell the event's name", "an unreachable supplier is a rejection". Feedback corrects that model in at most three sentences (quiz-format).
3. **A diagram scopes; the code confirms.** Where a decision needs a fact the view leaves out (which fields a consumer reads), the diagram supplies the complete set and its code links supply the fact. This keeps the first spec's anti-goal: no note states a conclusion.
4. **Calibrated claims.** Correctness on complex tasks is the supported benefit of design models (Arisholm et al. 2006; Dzidek et al. 2008); no text claims speed.
5. **Keys are facts wherever possible.** 16 of the 20 changed keys are outcomes of a devstack run or follow from one by arithmetic. The four judgment keys rest on facts the tests assert, and are listed in §7.

---

## 3. The redesigned activity

Time: orientation 6; five tasks 15 + 17 + 11 + 14 + 15 (with their two knowledge checks); capstone 15. Total about 93 minutes. The view order (component, sequence, class, component, sequence) and the two rounds (request given in steps 2–3, view predicted in steps 4–6) are unchanged.

Conventions below: options are listed in authored order (the challenge runtime does not shuffle); **bold** marks the key; "→" introduces the option's feedback. All `path:line` references were read on 2026-11-21.

### 3.0 Step 1 — The Headliner Codebase (6 min)

The warm-up's objective is tool fluency, so locating is its legitimate end. Two small changes make that honest and useful:

- Instructions, under "Warm up with the tools", add one sentence: "These three questions only practice **Files** and **Search files**. From the next step on, finding a line is a step toward a decision."
- Replace the first question, which no later step uses, with one whose answer step 3 needs:

  **Use Files and `README.md`: which command reproduces support ticket SUP-2291?**
  - **`python3 -m scenarios.failed_trip`**
  - `python3 -m scenarios.slow_group_checkout` → That script reproduces ticket PERF-118, the slow group checkout.
  - `python3 -m pytest` → The tests check Headliner's behavior; they do not replay a support ticket.
  - `python3 devstack.py` → `devstack.py` defines `build_stack()`; the scenarios call it, and it prints nothing itself.

  Explanation: "`README.md` lists both repro scripts. A repro script prints a ticket's symptoms, not its cause." (`README.md:40`)

The `build_stack()` and fake-clock questions stay.

### 3.1 Step 2 — Event Consumers and Change Impact (component; 15 min)

**Stakeholder and decision.** Jordan (OPC team) has a patch ready. The student decides whether it can ship as written, and which rollout is safe.

**Message.**

> **Jordan, OPC team:** Fans keep asking us to print their names in the right order. My patch is two lines in `TripEvents._trip`: it replaces `fan_name` with `given_name` and `family_name`. Can I ship it on Friday, and if not, how should I roll it out?

**Part A scaffold (locate and trace as steps).** `open_file: services/opc/events.py`. Task list:

1. **Scope.** Find every component that receives an event built by `_trip`. Pin the line that proves your least obvious receiver.
2. **Consequence.** For each receiver, open its handler and note what it does with the body.
3. **Decide,** then lock in.

`attempt: {hypothesis: true, evidence_pins: 2, view_wish: true}`.

**Main questions.**

`breaks` (multiple). "Jordan ships the patch as written. Which components raise an error on a trip event they receive afterwards?"

Options (the shared `&t1_components` list, trimmed to eight): Trip Website · OPC · **Notifications** · Loyalty · Warehouse ETL · **Affiliate Relay** · **Support Console** · Shuttle Planner. `correct_indices: [2, 5, 6]`.

- Trip Website → It submits orders and asks the OPC for their status; it consumes no events.
- OPC → It publishes these events; its own queues, `orders.received` and `supplier.answered`, carry other messages.
- Notifications (omitted) → Its handler builds the greeting from `trip['fan_name']`, for all three trip events (`services/notifications/consumers.py:31`).
- Loyalty → It receives `trip.confirmed` but reads only `fan_id` and `total`, so the patch does not touch it.
- Warehouse ETL → It receives every event and copies each field without naming any, so it keeps running; its rows silently change columns, which is a different problem.
- Affiliate Relay (omitted) → Its binding `trip.*` never spells an event's name, and its webhook request copies `fan_name` (`services/affiliates/relay.py:16`).
- Support Console (omitted) → `_trip` builds the body of `trip.cancelled` too, and the console keeps `fan_name` for its follow-up list (`services/support_console/app.py:16`).
- Shuttle Planner → It binds `supplier.shuttle.*`; those events have their own body, without a fan's name.

Explanation: "`_trip` builds the body of all three trip events (`services/opc/events.py:17`–`24`). Three of their consumers read `fan_name` by key. A handler that raises leaves its event at the head of its queue (`infra/broker.py:162`), so fans get no e-mails, partners get no commission reports, and support gets no follow-ups until someone fixes each handler."

`rollout` (single). "Which rollout changes the names without breaking a consumer?"

- Ship the patch; each team fixes its handler when errors appear → Three handlers raise on their first event, and each failed event stays at the head of its queue, so fans get no e-mails in the meantime.
- **Add the two fields and keep `fan_name` until every reader has moved**
- Split the name in `trip.confirmed` only, since Loyalty alone binds that key → Four queues receive `trip.confirmed`: `#` and `trip.*` match it, and Notifications lists it in its own code.
- Update Notifications and Loyalty first: a search for the event finds only them → Affiliate Relay and Support Console read `fan_name` too; the relay passes it to another company, which needs notice before the field goes away.

Explanation: "Adding fields breaks no reader here, because every consumer picks fields by name. Removing `fan_name` is a second, later change, made once each consumer has moved and the affiliate partners have agreed to the new webhook body. This is the expand-then-contract pattern for a shared contract."

**Reply.** Request, summary, and diagram unchanged (`event-consumers.component.uml`). The evidence list keeps its nine binding and protocol entries and adds four *locations*, which name the handler and never the field:

- "Notifications handles the three trip events in `on_trip_event`" → `services/notifications/consumers.py:26`
- "Affiliate Relay builds its webhook request in `on_trip_event`" → `services/affiliates/relay.py:11`
- "Support Console handles `trip.cancelled` in `on_trip_cancelled`" → `services/support_console/app.py:12`
- "`_trip` builds the body of every trip event" → `services/opc/events.py:36`

`left_out` stays: "…and what each consumer does with an event." That omission is now part of the lesson.

**What in the diagram makes the answer visible.** The six `«subscribe»` connectors with their bindings give the *complete* receiver set of any `trip.*` key in one glance: four queues whose pattern matches, and Shuttle Planner, whose pattern cannot. The ball-and-socket from Affiliate Relay to Affiliate Partners, crossing the `Headliner` package frame, shows which receiver has an outside contract. The component labels are code links to the four handlers, so "what does it read?" is one double-click per receiver.

**What in the code hides it.** Bindings in `deploy/broker.toml` and in a decorator; two wildcards; and a payload builder shared by three events, so a consumer of `trip.cancelled` is affected by a patch that Jordan describes as a change to `trip.confirmed`.

**Follow-up (two questions, diagram only).**

`versioned-key` (single). "Jordan's other idea: leave `trip.confirmed` alone and publish the new body under a new routing key, `trip.confirmed.v2`, until everyone has moved. Which components receive `trip.confirmed.v2` today?"

- Every consumer of `trip.confirmed`: the new key starts with the same words → A binding matches whole words, not a prefix: `trip.confirmed` is a different key from `trip.confirmed.v2`.
- Affiliate Relay and Warehouse ETL: both bind with wildcards → `*` stands for exactly one word, and `confirmed.v2` is two, so `trip.*` does not match.
- **Warehouse ETL only**
- None: no binding names `trip.confirmed.v2` → `#` matches any number of words, so Warehouse ETL's queue receives it.

Explanation: "Only `#` matches a three-word key. A versioned key is a workable migration path, but each consumer needs a new binding before it sees the new events, which the diagram lets you check per connector."

`privacy` (single). "Privacy review: a fan's name may leave Headliner only inside that fan's own e-mail or booking. Which component breaks this rule?"

- Notifications → It sends the name to the Mail Relay only inside the body of the fan's own e-mail.
- **Affiliate Relay**
- Warehouse ETL → It keeps the name, but in Headliner's own reporting warehouse; the diagram shows it calling no other organization.
- Support Console → It keeps the name for its follow-up list and calls only the OPC.

Explanation: "Two connectors cross the `Headliner` package: Notifications to the Mail Relay, and Affiliate Relay to the Affiliate Partners. The relay's webhook request carries `fan_name` next to the order total (`services/affiliates/relay.py:16`), although a commission report needs no name."

**Debrief.** `hidden_by`, `find_in_code`, and the mechanism question are unchanged (key: event bindings declared outside the code, with wildcards). `view_shows` becomes: "Every consumer of the `trips` exchange with its binding, in one place, so 'who is affected?' has a complete answer. The view did not say which fields a consumer reads; its labels took you to the four handlers that do. A view scopes the search, and the code confirms." `consolidation_prompt`: "Which receiver would you have missed without the diagram, and what would shipping have cost?"

**Changes.** Codebase: none. Diagram source: none. Links sidecar `event-consumers.links.yml`: point each consumer's label at its handler line instead of its class line (Notifications 26, Affiliate Relay 11, Support Console 12, Loyalty 12, Warehouse ETL 10, Shuttle Planner 12).

### 3.2 Step 3 — Failure Paths in an Order Workflow (sequence; 14 min + 3 min check)

**Stakeholder and decision.** Support has three charged fans with Failed trips. The student decides what is true of the money, and which fix to file.

**Message.**

> **Support team:** Three fans were charged for Neon Nights trips that ended up Failed. One says their glamping tent is still booked. What happens to their money, and what do we ask engineering to fix?

**Part A scaffold.** Run `scenarios/failed_trip.py` (it prints: status failed, $1,136.80 charged, box office and GlampingCo confirmed, shuttle rejected). Then:

1. **Trace.** Follow the order from `PurchaseOrderService.submit` to the supplier's rejection. Pin the line where the card is charged and the line that handles a rejection.
2. **Consequence.** Decide what happens to the money and the bookings afterwards.
3. **Decide** on the fix, then lock in.

`attempt: {hypothesis: true, evidence_pins: 2, view_wish: true}`.

**Main questions.**

`money` (single). "The trip is Failed and Priya's card was charged $1,136.80. What happens to that money?"

- The OPC refunds it as soon as the trip is marked Failed → The rejection path marks the order Failed and publishes `trip.failed`; it calls nothing at the bank.
- It stays captured until Priya cancels the trip under My trips → `CancellationTask.cancel` refuses any order that is not processing or confirmed, so a Failed trip cannot be cancelled (`services/opc/cancellation_task.py:35`).
- **It stays captured: nothing refunds a Failed trip, and it cannot be cancelled**
- It was only reserved: the website validates the card and nothing captures it → The website's check is for an amount of 0; the OPC's workflow captures the full amount right after it takes the order from `orders.received`.

Explanation: "`WorkflowManager.on_order_received` captures, then places the supplier orders (`services/opc/workflow.py:25`). A rejection reaches `InvoiceTask._settle`, which only marks the order Failed and publishes `trip.failed` (`services/opc/invoice_task.py:35`). The only caller of `PaymentTask.refund` is a fan's cancellation, which a Failed order is refused. Only a person at Headliner can return this money."

`fix` (single). "Which fix leaves no fan charged for a Failed trip and no booking open, in whatever order the suppliers answer?"

- Refund the capture when a supplier rejects → The money comes back, but the suppliers that confirmed keep their bookings, like the glamping tent.
- **Refund, and cancel every supplier order not yet rejected**
- Refund, and cancel the supplier orders confirmed so far → A supplier that answers after the rejection still confirms and keeps its booking: the loop over answers goes on after the trip has failed.
- Capture the payment only after the last supplier confirms → No fan is charged for a Failed trip then, but the suppliers that confirmed before the rejection still hold their bookings.

Explanation: "A workflow that fails partway needs one compensating step for each step that may have succeeded, including steps whose outcome is still unknown. When the box office rejects first, the lodging and shuttle confirmations arrive after `trip.failed` and are still recorded (`services/opc/invoice_task.py:27`). `CancellationTask.cancel` already treats `placed` and `confirmed` alike (`services/opc/cancellation_task.py:43`); the rejection path needs the same."

**Reply.** Request and diagram unchanged (`failed-trips.sequence.uml`), with one added fact in the `wf` note (see Changes). Evidence adds:

- "Each supplier answer is recorded on its supplier order" → `services/opc/invoice_task.py:27`
- "The website's card check asks for an amount of 0" → `services/website/payments.py:18`

`files_read` adds `services/website/payments.py`.

**What in the diagram makes the answer visible.** `capture` sits above the placement loop, so every later failure happens after the money has moved. The `alt` sits *inside* `loop [for each supplier answer]`: its reject operand holds `mark_failed()` and `trip.failed` and nothing aimed at `bank` or `supplier[i]`, and the loop frame continues below it, so answers keep arriving after a failure. Reading the frame boundary is what separates the key from "cancel the orders confirmed so far".

**What in the code hides it.** Six files and two queues between the charge and the rejection; a defect that is an absence; and an ordering dependence that the repro script, where the shuttle rejects last, never shows.

**Follow-up** `capture-last` (single). "Mina (product) prefers the other order: move `capture` below the last confirmation, so a rejected trip is never charged. Which new failure does that order of steps allow?"

- **Every supplier confirms, then the capture is declined: bookings nobody paid for**
- The fan waits for every supplier's answer before getting an order id → The reply with the order id goes back before the workflow starts; moving `capture` does not change what the fan waits for.
- The card is charged twice when two suppliers confirm in the same pass → `PaymentTask.capture` returns early once the payment has a `capture_id`.
- The suppliers are asked before the trip order is stored → `Intake.accept` stores the order before it queues it.

Explanation: "The checkout only asks the bank whether the card is open (an amount of 0), so a capture can still be declined. Charging first needs a refund when booking fails; charging last needs cancellations when the charge fails. Either order works only with its compensating steps, and the diagram lets you slide one message and read off what now comes before it."

**Evidence check** (most scaffolded of the three; unchanged key). Prompt: "Before you file the fix: the diagram shows no refund and no cancellation on the reject path. An absence in a diagram is a hypothesis. Open the reject branch in `services/opc/invoice_task.py` and check what it does." Question, options, and feedback as today.

**Debrief.** Unchanged, except `view_shows` ends: "…and the loop frame around the answers shows that a fix must also cover answers that arrive after the failure." Mechanism key unchanged (one workflow spread over work queues and tasks, with a step missing).

**Knowledge check (4 questions).** Unchanged. Its two view-choice questions and two "why did search miss it" questions already target transfer and explanation.

**Changes.** Codebase: none. Diagram `failed-trips.sequence.uml`: append to the `note right of wf` block the fact "Each answer is recorded on its supplier order (services/opc/invoice_task.py:27)." It is a fact with a locator and states no key. `failed-trips.links.yml`: no change.

### 3.3 Step 4 — What the Data Model Allows (class; 11 min)

**Stakeholder and decision.** Mina needs a yes or no per idea for the landing page, then a first estimate for her favorite.

**Message.** Unchanged, plus one sentence: "…And for whichever one we can't sell: how big a change is it?"

**Part A scaffold.** Unchanged task list; pin the line that rules out one idea. `evidence_pins: 1`. `predict_view: true`.

**Main question** `ideas` (multiple). Unchanged: stem, six options, key `[0, 2]`, feedback, explanation. It is already a decision per idea.

**Reply.** Unchanged (`data-model.class.uml`).

**Follow-up** `split-scope` (single; replaces `split-payment`). "Mina's favorite is the split payment. Going by this view, what kind of change is it?"

- A limit to raise, like the cap of 8 attendees → The association ends in exactly one `Payment` object; no number in a validator stands between the model and a second payment.
- A rule to drop from the model's constraints → Neither constraint mentions payments; the limit is the multiplicity 1 at the `Payment` end.
- **One association from 1 to 1..*, plus readers this view omits**
- No model change: one `Payment` can hold two cards → `Payment` has one `card_token` and one `capture_id` (`services/opc/model/orders.py:37`).

Explanation: "`TripOrder.payment` becomes a list, and everything that reads `order.payment` follows: the capture and the refund, the JSON form the Order DB keeps, and the `total` in every trip event. This view covers `services/opc/model` only, so it cannot show who else reads a stored payment. The last step picks that question up."

**What in the diagram makes the answers visible.** Each idea is a check against one multiplicity or one constraint note: `1..8`, `payment 1`, the per-item `attendees 1..*`, the `{…holds a FestivalPass…}` note, `SupplierOrder`'s one trip order. The follow-up reads the *kind* of obstacle off the notation (a bound, a constraint note, or a multiplicity of 1) and reads the view's scope off its package frame.

**What in the code hides it.** Multiplicities in type hints, bounds in `__post_init__`, rules in a third file, across four files.

**Debrief.** Unchanged, with one sentence added to `view_shows`: "A class view of one package shows what the model allows; it does not show who depends on the model from outside." Mechanism key unchanged.

**Changes.** None.

### 3.4 Step 5 — Outages and Synchronous Dependencies (component; 14 min)

**Stakeholder and decision.** Alex (operations) must schedule four maintenance windows around a presale. The scenario in six parts (SAIP ch. 4): source, a planned outage; stimulus, one external system or the broker is down; environment, the Sunset Sessions presale at noon; artifact, the trip-order path; response, fans can or cannot submit; measure, no refused checkout during the presale.

**Message.**

> **Alex, operations:** Maintenance windows on Friday, one at a time: the Bank, the Lodging Provider, the message broker, and the Mail Relay. The Sunset Sessions presale opens at noon. Which windows do I have to move away from the presale, and what happens to orders placed during the others?

**Part A scaffold.** Task list:

1. **Trace** what the Trip Website does when a fan presses **Book now**. Pin each line where the request waits for another system.
2. **Follow** the order into the OPC until the request returns.
3. **Decide,** choose the view you would ask for, and lock in.

`attempt: {hypothesis: true, evidence_pins: 2, view_wish: true}`; `predict_view: true`.

**Main questions** (two replace four).

`windows` (multiple). "Which of the four windows must Alex move away from the presale, because fans cannot submit trip orders during them?"

Options: **Bank** · Lodging Provider · **Message broker** · Mail Relay. `correct_indices: [0, 2]`.

- Bank (omitted) → `@requires_valid_card` asks the bank to validate the card before `submit` runs, so the checkout stops there (`services/website/checkout.py:44`).
- Lodging Provider → The website never calls it; the OPC orders the stay after the fan's request has returned.
- Message broker (omitted) → `Intake.accept` sends the order to `orders.received` inside the submit request, and that call fails while the broker is down (`services/opc/intake.py:21`).
- Mail Relay → Only Notifications calls it, after the OPC has finished; an e-mail that cannot be sent waits in its queue.

`lodging-order` (single). "A fan books during the Lodging Provider's window. What happens to the order and the fan's card?"

- The checkout refuses the order with a try-again message → No part of the checkout calls the Lodging Provider, so the fan's request never notices the outage.
- Accepted and charged; the trip is marked Failed when the stay cannot be placed → Unreachable is not a rejection: `SupplierOrderTask` keeps the order unsent and sends it again every 60 seconds (`services/opc/supplier_task.py:38`).
- Accepted; the card is charged only once the provider is back → The workflow captures the payment before it places any supplier order, reachable or not.
- **Accepted and charged now; the stay is ordered once the provider is back**

Explanation: "The fan's request ends when the order is stored and queued. The workflow then captures the payment and tries each supplier; an order a supplier could not take is sent again every 60 seconds, so the trip completes after the window. The fan's card is charged for a trip that is not yet confirmed, which is worth a line in the confirmation e-mail."

**Reply.** Contrast (`outages-imports.class.uml`, question `fits`), request, diagram (`outages.component.uml`), and evidence: unchanged.

**What in the diagram makes the answer visible.** The Trip Website's five sockets are everything a fan's request waits for directly: `CardService` (Bank), `Quotes` (Box Office), `Capacity` (Experience Provider), `PurchaseOrderService` (OPC), `SQL` (Catalog DB). The OPC's `Publish` socket on the Message Broker is drawn the same way, so the broker joins that path. The Lodging Provider is reached only from the OPC, behind the `«consume»` connector, and the Mail Relay only from Notifications. Each window is one connector to classify.

**What in the code hides it.** Calls by service name resolved from `deploy/services.toml`; a card check inside a decorator; and a broker send that reads like a local method call.

**Follow-up (two questions).**

`unlisted` (single). "The presale carts hold passes, a stay, and a shuttle ride. Which system that is missing from Alex's list would also stop these fans from submitting?"

- Shuttle Provider → Only the OPC calls it, to book the ride, after the fan's request has returned.
- **Box Office**
- Experience Provider → The website checks capacity only for experiences in the cart, and these carts hold none.
- None: the four windows cover every call a fan waits for → The website has five sockets; Alex's list names the owner of only one of them.

Explanation: "Every checkout prices its passes with a `Quotes` call to the Box Office before it submits. Alex asked about four systems; the view shows every system on the path, including the ones nobody thought to ask about."

`outbox` (single). Unchanged: stem, options, key ("Save the message with the order, and send it once the broker is back"), feedback. Add to the explanation: "The price is a second delivery path: a job that sends stored messages, which may send one twice, so the workflow must stay safe to repeat, as `PaymentTask.capture` already is."

**Evidence check.** Unchanged (names the claim; the student finds the file).

**Debrief.** Unchanged. Mechanism key unchanged (connections resolved by service name from configuration).

**Changes.** None.

### 3.5 Step 6 — Latency on the Checkout Path (sequence; 12 min + 3 min check)

**Stakeholder and decision.** Mina has a 2-second target and an 8.4-second checkout. The student decides where the time goes, which change meets the target, and what a faster alternative would give up.

**Message.**

> **Mina, product team:** Checkouts for a group of 5 attendees with 3 experiences at Lakeside Fest take over 8 seconds. Our target is 2 seconds. Which change gets us there?

**Part A scaffold.** Run `scenarios/slow_group_checkout.py` (8.4 s). Then:

1. **Trace** the request from **Book now** to **Order received**. Pin each line where a call to another system sits inside a loop.
2. **Budget.** Find how long each kind of call takes.
3. **Decide,** choose your view, and lock in.

`attempt: {hypothesis: true, evidence_pins: 2, view_wish: true}`; `predict_view: true`.

**Main questions** (the count becomes a step toward a budget; the fix moves up from the follow-up).

`budget` (single). "Where do most of the 8.4 seconds go?"

- In the OPC's submit, which captures the card and places the supplier orders → Submit only stores and queues the order, in 200 milliseconds; the capture and the supplier orders come after the fan has the order id.
- In nine calls of about equal length, spread over the checkout → The nine calls differ: one pass quote takes 1,100 milliseconds, and the card check takes 300.
- **In pass quotes, one per attendee, then capacity checks, one per experience**
- In the bank's card check, which runs once for each attendee → `@requires_valid_card` validates the card once per checkout.

Explanation: "Five pass quotes take 5.5 seconds and three capacity checks take 2.25 seconds: 7.75 of the 8.37. The card check (0.3), the submit (0.2), and six catalog queries (0.12) share the rest."

`fix` (single). "Which change brings this checkout under 2 seconds?"

- One bulk pass quote, and a cached card check → The bulk quote saves 5.1 seconds, but the three capacity checks still run one after another: about 3 seconds in all.
- **One bulk pass quote, and capacity checks in parallel**
- Capacity checks in parallel, and a second OPC worker → Parallel checks save 1.35 seconds, but the five pass quotes still take 5.5, and the OPC already answers submit in 200 milliseconds.
- Pricing moved into the OPC's submit request → The five pass quotes stay remote calls, now made while the website waits for submit: still about 8 seconds.

Explanation: unchanged (about 1.9 seconds).

**Reply.** Unchanged (`checkout-latency.sequence.uml`, its duration notes, its evidence).

**What in the diagram makes the answer visible.** Two `loop` frames on the external lifelines, each with its per-call duration in a note, next to the `{≤ 2 s}` constraint: the budget is two multiplications. The `guard` loop also shows *what the loop is for*: it is the only capacity check before `submit`.

**What in the code hides it.** Remote calls that read like local ones, in loops in two classes; a card check in a decorator; latencies defined in three stub files.

**Follow-up** `trade-off` (single; a trade-off point in ATAM's sense). "Mina counters: keep the bulk quote, and drop the capacity checks from checkout altogether, since the provider answers every booking anyway. That checkout takes about 1 second. What does it give up?"

- Nothing: the OPC checks capacity again before it captures the card → The OPC never asks for capacity; its workflow captures the payment and then places the supplier orders.
- Correct prices: the quote depends on each experience's capacity → Prices come from the Box Office and the catalog; the capacity check only stops a checkout.
- **A sold-out experience then shows up after the capture, as a Failed trip**
- The 2-second target: the OPC's submit would wait for the provider's answer → Submit stores and queues the order; the provider answers later, through the callback service.

Explanation: "`AvailabilityGuard` is the only check that keeps a full experience out of a paid order (`services/website/availability.py:14`). Without it, the provider's rejection arrives after the card has been charged, and step 3 showed what a rejection leaves behind. Running the checks in parallel keeps the protection for 0.9 seconds; dropping them buys those 0.9 seconds with more Failed trips."

**Debrief.** Unchanged, plus one sentence in `view_shows`: "Two traces met at one design decision here: the capacity check costs latency in this view and prevents the failure of step 3's view." Mechanism key unchanged (remote calls that look local, inside loops and a decorator).

**Knowledge check (5 questions).** Four unchanged. The binding question gets a decision frame in a new context, as spaced practice of step 2's follow-up:

"A team versions an event by publishing `order.placed.v2`. A reporting queue is bound to the topic exchange with `order.*`, and an audit queue with `#`. Which queues receive `order.placed.v2`?" Options: **The audit queue only** · Both queues → `*` stands for exactly one word, and `placed.v2` is two. · The reporting queue only → `#` matches any number of words, and `order.*` needs exactly one after `order`. · Neither queue → `#` matches every routing key. Explanation as today.

**Changes.** None.

### 3.6 Step 7 — The Right View for the Question (capstone, plan-first; 15 min)

Five stakeholder questions. For each, the student first chooses the view to request (or one file to read), then decides with the expert's views. Question ids, the best view per question, and the four diagrams are unchanged, so `CAPSTONE_VIEWS` and `REPLY_DIAGRAMS` in the content tests stay as they are.

| id | Stakeholder question (stem) | Options (**key**) and feedback |
|---|---|---|
| `rule` | "Split payments will change how the Order DB stores a `payment`. Headliner's rule says the Trip Website reads order data only through the OPC's `OrderTrackingService`, so only the OPC should have to change. Does the running system keep the rule?" | Yes: every read of order data goes through `OrderTrackingService` → The My trips page, `OrderHistoryPage`, connects to `ORDER_HISTORY_DSN`, the Order DB replica, without the OPC. · **No: one website page reads stored orders from a database directly** · No: the website reads order events from the message broker → The website consumes no queues; the order data it reads without the OPC comes from the Order DB replica. |
| `rideshare` | "Product adds `RidesharePickup`, a new kind of transport. A contractor quotes three operations to write, the three that `TripItem` declares. What does the new class really have to define?" | `price()`, `supplier_kind()`, and `cancellation_deadline()` → `TransportItem` already defines `cancellation_deadline()`, from the ride's departure. · **`price()` and `supplier_kind()`** · Only `price()` → `supplier_kind()` is abstract in `TripItem`, and `TransportItem` does not define it. · None: `TransportItem` implements all three → `TransportItem` defines only `cancellation_deadline()`; it is abstract itself. |
| `cancellation` | "A fan cancels a GlampingCo trip 2 days before check-in. Where do the money and the tent end up?" | Refunded; the tent is cancelled on the job's next run → Within 72 hours of check-in, `GlampingCoGateway.cancel` raises `ManualCancellationRequired` on every run. · Not refunded until GlampingCo confirms; the tent stays booked → The refund happens inside the fan's request, before any supplier is asked. · **Refunded at once; the tent stays booked, and the job retries without end** · The cancellation is refused: check-in is under 72 hours away → The fan's deadline is one day before check-in; the 72-hour rule is GlampingCo's own, inside its gateway. |
| `fee` | "Marketing wants a lower service fee for Desert Bloom only. What does that take today?" | A catalog edit: each festival's row holds its rate → The festival rows hold an id, a name, a start, and a sales date, but no fee. · **A code change: one rate constant applies to every cart** · A Box Office request: the fee arrives with each pass quote → The Box Office quotes pass prices; `TripPricer` adds Headliner's fee on top. |
| `gateways` | "Two more partners that cancel only by phone sign next month. Today such cancellations stay in Cancelling for good. Where should 'this supplier needs a manual cancellation' live?" (single; was multiple) | In each partner's `cancel()`, raising its own exception as today → The contract of `cancel()` allows only `SupplierUnavailable`; a caller written against the contract cannot tell 'phone them' from a crash, so it retries forever. · In `CancellationTask`, as a list of phone-only supplier ids → Then every new partner means editing the task, and a supplier's own rule, like GlampingCo's 72 hours, moves out of its gateway. · **In the `SupplierGateway` contract, as an outcome every caller handles** · In the registry, by mapping those partners to the base gateways → The base gateways cancel through the API, so the OPC would record a cancellation that the partner has not agreed to make. |

Explanations:

- `rule`: "`OrderHistoryPage` opens `ORDER_HISTORY_DSN` (`deploy/website.toml:3`) and reads `row[\"order\"][\"payment\"][\"amount\"]` from the stored order (`services/website/order_history.py:21`). The rule is broken, so the split payment is not an OPC-only change: My trips breaks with it. The agent's diagram left that connection out."
- `rideshare`: as today, plus: "The class view shows what the class owes. It does not show the two places that list item types by name (`services/opc/payloads.py:15` and the website's `_item`), which the estimate also needs."
- `cancellation`: "`CancellationTask.cancel` refunds the card inside the fan's request, then marks the supplier orders cancelling (`services/opc/cancellation_task.py:39`). A job cancels them every 60 seconds. Two days before check-in, GlampingCo's gateway raises; the job logs it and tries again on every run (`services/opc/cancellation_task.py:54`). The fan has the money, GlampingCo still holds and bills the tent, and because the trip never reaches Cancelled, no `trip.cancelled` event tells the Support Console that someone must pick up the phone."
- `fee`: "`SERVICE_FEE_RATE = 0.12` is one constant in `services/website/pricing.py`, applied to every cart. A per-festival fee needs a new catalog column and a code change."
- `gateways`: "The gateway knows its supplier's rules, so the knowledge belongs there; what is missing is a way to say it that the contract permits. If `cancel()` can report 'a person must do this', every gateway states its answer, every caller must handle it, and `CancellationTask` can route such orders to support instead of retrying. Two classes break the contract today: `GlampingCoGateway` and `MeetAndGreetGateway`."

**Plan.** The five entries keep their options, keys, and feedback. Each gets a short `question` so the long stems are not repeated: "What would you ask for to check the rule about order data?" · "…to check the contractor's estimate?" · "…to see where the money and the tent end up?" · "…to see what a per-festival fee takes?" · "…to decide where the manual-cancellation rule should live?" In the `gateways` entry, the feedback for "No diagram: read `services/opc/gateways/base.py`" stays valid: the contract is there, the overrides that break it are in another package.

**Reply.** Unchanged: the four diagrams, the evidence list, the label without "verified against the code", and the deliberate omission of the website's connection to the Order DB replica.

**What in the diagrams makes the answers visible.** `rule`: the website's six sockets; the view claims no other connection (and is wrong, see the evidence check). `rideshare`: each class lists only the operations it defines, so the two missing from `TransportItem` are the answer. `cancellation`: `refund` above the reply to the fan; the scheduler's found message; the `alt` whose second operand returns an exception and leaves the order cancelling; `opt [every supplier order cancelled or rejected]` around `mark_cancelled()`. `gateways`: the contract note on `SupplierGateway.cancel`, the two `raises` dependencies that leave `services::opc::partners` for an exception the contract does not name, and the three levels of the hierarchy, which are the three candidate places for the rule.

**What in the code hides them.** A connection made from a setting outside the client classes; a hierarchy across two packages; a refund and a cancellation split between a request and a scheduled job; a contract stated only in a docstring.

**Evidence check.** Unchanged in structure and keys (`claim`: "That the diagram shows every connection the Trip Website makes"; `complete`: "No: one website page connects to an order database itself"). The stakes are now real: a student who trusted the diagram told Mina the split payment was an OPC-only change. The explanation of `complete` adds: "…so the estimate for the split payment must include the My trips page."

**Follow-up** `transfer` (single; replaces `batching`). The activity ends by choosing a view, and what to check, for a system the student has never seen.

"Your team inherits a food-delivery backend. The product manager asks whether customers can still place orders while the payment provider is down for ten minutes. What do you ask the agent for, and what do you do with its reply?"

- A class diagram of the payment classes; read which ones import the provider's client → Imports show which code uses which, not whether placing an order waits for the provider at run time.
- A sequence diagram of one successful order; if the provider appears in it, orders stop → One successful trace shows the call, but not what the caller does when the call fails.
- **A component diagram of the order path; then check its one decisive connector in the code**
- No diagram: search the code for the provider's name → A search finds the client, but not whether the order request waits for it, or whether a queue sits in between.

Explanation: "Whether an outage stops a request depends on which connectors lie on its path and whether the caller waits. A component view of the path shows that, as it did for Headliner's broker. The answer then rests on one connector, and a diagram can be wrong about one connector, so you open the code behind it."

**Debrief.** `hidden_by`, `find_in_code`, and the mechanism question (key: connections resolved from configuration) are unchanged. `view_shows` adds a closing sentence: "Across the tutorial, the views did not answer the stakeholders' questions for you. They made each decision checkable: a complete set of consumers, an ordering with a missing step, a path with its waits, a hierarchy with its contract." `consolidation_prompt` stays ("When was reading one file faster than asking for a diagram, and why?").

**Changes.** Codebase: none. Diagrams: none.

---

## 4. Alignment

### 4.1 Revised learning objectives

Students will be able to:

1. **Analyze** a multi-service codebase to judge a proposed change, a failure, or a quality target, and rate their confidence. *(was: to answer a design question)*
2. **Use** a class, component, or sequence diagram to make and justify that decision, and check the one claim it rests on against the code.
3. **Explain** which code mechanism hid the evidence: event bindings outside the code, a workflow spread over queues, multiplicities across files, connections resolved from configuration, remote calls in loops and decorators, overrides in another package.
4. **Evaluate** design alternatives that a view makes comparable: rollout plans for a shared event, compensation steps and their order, availability and latency tactics, where a responsibility lives. *(was: Identify design defects)*
5. **Select** the view that best answers a question, or no view, including for a system they have not seen.

Non-goals and anti-goals are unchanged. One addition to the anti-goals: **inventory questions as the graded end.** A question whose key is a list of names or a count must feed a decision asked in the same challenge.

### 4.2 Coverage matrix

Purposes: I impact, F failure and consistency, Q quality-attribute scenario, C conformance, R responsibility placement, T trade-off, D diagnosis, V view selection. Bloom: An Analyze, Ev Evaluate.

| Step | Diagram | Question | Purpose | Bloom | Obj. |
|---|---|---|---|---|---|
| 2 | component (pub-sub) | `breaks` | I | An | 1, 2 |
| 2 | | `rollout` | I, T | Ev | 4 |
| 2 | | `versioned-key` | I (alternative) | Ev | 2, 4 |
| 2 | | `privacy` | Q security, C | Ev | 2 |
| 3 | sequence (trace) | `money` | F, D | An | 1, 2 |
| 3 | | `fix` | F | Ev | 4 |
| 3 | | `capture-last` | T | Ev | 4 |
| 3 | | evidence check | verification | An | 2 |
| 4 | class (data model) | `ideas` | I (what the model permits) | An | 1, 2 |
| 4 | | `split-scope` | I, V (limits of a view) | Ev | 2, 5 |
| 5 | class (contrast), component (C&C) | `fits` | V | Ev | 5 |
| 5 | | `windows` | Q availability | An | 1, 2 |
| 5 | | `lodging-order` | F | An | 1, 2 |
| 5 | | `unlisted` | Q availability | An | 2 |
| 5 | | `outbox` | T (tactic) | Ev | 4 |
| 6 | sequence (performance) | `budget` | Q performance, D | An | 1, 2 |
| 6 | | `fix` | Q performance | Ev | 4 |
| 6 | | `trade-off` | T | Ev | 4 |
| 7 | component | `rule` + evidence check | C, I | Ev | 2 |
| 7 | class | `rideshare` | I (extension cost) | An | 2 |
| 7 | sequence | `cancellation` | F | An | 2 |
| 7 | none | `fee` | I (control) | An | 5 |
| 7 | class | `gateways` | R | Ev | 4 |
| 7 | all | plan ×5, `transfer` | V | Ev | 5 |
| 2–7 | | mechanism ×6 | explanation | Understand | 3 |

Every purpose from §2 appears at least twice and under at least two diagram types, except responsibility placement (once, in the capstone; see §7, question 3). Of the 27 challenge questions outside the plan and mechanism items (the three evidence-check questions of steps 5 and 7 included), 15 are Evaluate and 12 Analyze; none is below Analyze.

### 4.3 How the activity ends with transfer

1. **Within the system:** the capstone plan asks which view fits five new Headliner questions, one of which needs none.
2. **Across tasks:** `rule` reuses step 4's split payment; `trade-off` reuses step 3's failure. Students meet one design from two views, which is what a trade-off point is.
3. **Beyond the system:** `transfer` asks for a view and a verification step in an unfamiliar system, and the two knowledge checks pose view and notation questions about music, delivery, and ticketing apps.
4. **Calibration:** the evidence check on `rule` is the one place where trusting a diagram produces a wrong recommendation to a stakeholder, so the habit "check the decisive connector" ends the activity with a consequence attached.

---

## 5. Assessment validity

### 5.1 Why each key is defensible

"Run" means observed on the devstack on 2026-11-21 with the scenario's own carts; "read" means the cited lines.

| Key | Evidence | Kind |
|---|---|---|
| `breaks` = Notifications, Affiliate Relay, Support Console | Run: delivering a real `trip.*` body with `fan_name` replaced raises `KeyError: 'fan_name'` in exactly these three handlers (Support Console on `trip.cancelled`); Loyalty and Warehouse ETL return normally. Draining then leaves the event queued (`infra/broker.py:162`–`168`). | fact |
| `rollout` = add fields, keep `fan_name` | Run: the same body with the two fields *added* raises in no consumer, for all three events. | fact + judgment (that removal comes later) |
| `versioned-key` = Warehouse ETL only | Run: `topic_matches` is true for `#` only, among the six bindings. | fact |
| `privacy` = Affiliate Relay | Read: `services/affiliates/relay.py:13`–`19` sends `fan_name` to `affiliate_partners`; Notifications' request has `from`, `to`, `subject`, `body` (`services/notifications/mailer.py:14`). Existing fact `external_forwarders`. | fact against a stated policy |
| `money` = stays captured, cannot be cancelled | Run: SUP-2291 trip ends failed, 113680 cents captured, no refund; `website.cancel` answers "HL-1001 is failed and cannot be cancelled". | fact |
| `fix` = refund, cancel every order not yet rejected | Run with the box office rejecting: `trip.failed` is published, then `supplier.lodging.confirmed` and `supplier.shuttle.confirmed`; both bookings end confirmed. So "confirmed so far" misses two bookings, "refund only" misses three, "capture last" leaves bookings open. | fact (premises) + design |
| `capture-last` = confirmed, then capture declined | Read: the card check uses amount 0 (`services/website/payments.py:18`, `services/website/clients.py:27`); capture is idempotent (`services/opc/payment_task.py:16`); submit replies before the workflow runs. The bank stand-in never declines a capture, so the failure itself is reasoned, not run. | judgment |
| `windows` = Bank, broker | Existing facts (`outage_outcome`). | fact |
| `lodging-order` = accepted, charged now, ordered later | Run: with lodging down, the order is processing, 95536 cents are captured, the lodging order is placed and unsent; after restore the trip is confirmed. | fact |
| `unlisted` = Box Office | Run: with `box_office` down the checkout returns the try-again message; with `shuttle` down, or with `experiences` down and no experience in the cart, it returns "Order received". | fact |
| `budget`, `fix` (step 6) | Run: 8.37 s; quotes 5 × 1.1, checks 0.6 + 0.75 + 0.9. Computed: bulk + cached card 2.97; bulk + parallel 1.92; parallel only 7.02. | fact |
| `trade-off` = Failed trip after the capture | Read: the guard is the only pre-submit capacity check (`services/website/availability.py:14`); workflow captures, then places (`services/opc/workflow.py:25`). Run: an experience provider that rejects yields a failed, charged trip. Bulk quote without checks computes to 1.02 s. | fact (premises) + judgment |
| `split-scope` | Read: `payment: Payment` (`services/opc/model/orders.py:50`); readers at `services/opc/payment_task.py:15`, `services/opc/payloads.py:32`, `services/opc/events.py:43`, `services/website/order_history.py:21`. | fact + judgment (limits of the view) |
| `rule`, evidence check | Existing fact `website_reads_order_db`; read `services/website/order_history.py:21` for the `payment` dependence. | fact |
| `cancellation` = refunded, tent booked, endless retry | Run: one refund; supplier statuses cancelled, cancelling, cancelled; GlampingCo booking confirmed; no `trip.cancelled`, no e-mail, no Support Console follow-up; a second cancel is refused. | fact |
| `fee` | Existing fact `service_fee`; the catalog's festival columns (`fixtures/catalog.py:11`). | fact |
| `gateways` = in the contract | Read: contract (`services/opc/gateways/base.py:36`), two overrides (`services/opc/partners/glamping_co.py:18`, `services/opc/partners/meet_and_greet.py:12`), catch-all that retries (`services/opc/cancellation_task.py:54`). Grounded in Liskov & Wing 1994 and Wirfs-Brock & McKean 2003. | judgment |
| `transfer` | View-to-question fit, DSA §3.3 and step 5's own result. | judgment |

### 5.2 Facts the tests will assert

New functions in `scripts/uml_design_questions/facts.py`, written to `facts.json`, each computed by running Headliner, never by parsing its source:

| Fact | Computed how | Guards |
|---|---|---|
| `event_consumers.rename_breaks` (sorted component names) | For each of the three trip keys, deliver an observed body with `fan_name` replaced to each receiving queue on a fresh stack; collect the components whose handler raises | `breaks` |
| `event_consumers.additive_breaks` (expected `[]`) | Same, with the two fields added | `rollout` |
| `event_consumers.receivers["trip.confirmed.v2"]` | `receiving_queues` | `versioned-key` |
| `event_consumers.external_forwarders` (exists) | — | `privacy` |
| `failed_trips.fan_can_cancel` (false), `refunds` (0) | Book SUP-2291's cart with the shuttle rejecting; call `website.cancel` | `money` |
| `failed_trips.confirmed_after_failure` (supplier ids) | Book with the box office rejecting; list supplier orders confirmed after `trip.failed` in the observed event order | `fix` |
| `failed_trips.card_check_amount` (0), `capture_before_first_answer` (exists) | Record the website's `bank.validate` payload | `capture-last` premises |
| `outages.bank`, `.broker`, `.lodging`, `.mail_relay` (exist), `.box_office`, `.shuttle` | `outage_outcome` | `windows`, `unlisted` |
| `outages.experiences_without_experiences` | `outage_outcome` with a cart without experiences | `unlisted` |
| `outages.lodging_charged_while_waiting` (true) | Captured amount > 0 while the lodging order is unsent | `lodging-order` |
| `checkout_latency.variants` (`bulk_cached_card`, `bulk_parallel`, `parallel_only`, `bulk_no_checks`), `.quote_seconds`, `.check_seconds` | From `call_ms`, as `keyed_fix` is computed today | `budget`, `fix`, `trade-off` |
| `checkout_latency.rejected_experience_is_charged_and_failed` | Group cart with the experience supplier rejecting | `trade-off` |
| `capstone.my_trips_reads_stored_payment` | Change the stored order's `payment` to a list in the Order DB; `website.my_trips` raises while `OrderTrackingService.history` answers | `rule`, `split-scope` |
| `capstone.stuck_cancellation` (`refunds: 1`, `tent: "confirmed"`, `trip_cancelled_published: false`, `support_follow_ups: 0`) | Extend `glampingco_48h_stays_booked` | `cancellation` |
| `capstone.cancel_contract_breakers` | Existing `gateway_contracts` | `gateways` feedback |

Content-test assertions (replacing the per-task key tests in `scripts/tests/test_uml_design_questions_content.py`):

- `breaks`: the components named by the correct options equal `rename_breaks`; every receiver of any trip key is offered.
- `rollout`: `additive_breaks == []`, and the key is the one option that contains "keep".
- `versioned-key`: the key names exactly the receivers of `trip.confirmed.v2`.
- `money`: `refunds == 0 and not fan_can_cancel`, and the key is the only option that says "cannot be cancelled".
- `fix`: `confirmed_after_failure` is non-empty (the premise that separates the key from "confirmed so far").
- `windows`: keyed options are exactly the outages with outcome `cannot_submit` among the four; `unlisted`: its key's outcome is `cannot_submit`, and each wrong system's outcome is not.
- `lodging-order`: `lodging_charged_while_waiting` and outcome `finish_afterwards`.
- Step 6 `fix`: for each option, the variant's seconds are under the 2-second target if and only if the option is the key (map options to variants by their two tactics). `trade-off`: `variants.bulk_no_checks < 2` and the rejected-experience fact holds.
- Capstone: existing assertions, plus the two new facts.
- Judgment keys (`capture-last`, `gateways`, `transfer`, the removal half of `rollout`): the tests assert the premises only, and a comment at each test says the choice among alternatives is a reviewed judgment (test-design: pin the spec, no more).

Unchanged guards keep applying to every new question: quiz format and the answer-tell audit (`audit_mcq_tells`), no positional references, no "misconception", no task key in a reply summary or diagram note, keys not gathered at one position, the reading budget of 300 words.

Two design choices follow from those guards. The four handler evidence entries in step 2 name locations and not fields, because an entry such as "Loyalty reads `fan_id` and `total`" would state part of a key. Keys were written short, so that no key is the longest option by more than about 15 characters; task 11 in §6.5 runs the audit to confirm.

---

## 6. Implementation impact

### 6.1 What changes

| Area | Change |
|---|---|
| Tutorial YAML (hand-written part) | Steps 2–7: messages, task lists, `attempt.evidence_pins`, questions, follow-ups, some explanations and debrief sentences, as in §3. Step 1: one sentence, one question. Step 6 quiz: one question. `learning_objectives`: §4.1. `progress_version: 2`, because question ids and meanings change and saved answers would map onto the wrong questions (the tutorial is still excluded from the index, so only pilot records are affected). Pedagogy comments above each step updated to name the decision. |
| Codebase (`tutorial_sources/.../headliner/`) | None. |
| Diagrams | `failed-trips.sequence.uml`: one fact line in the `wf` note. `event-consumers.links.yml`: consumer labels point at handler lines. All else unchanged; regenerate the YAML's generated block. |
| Facts | `facts.py`: the functions of §5.2; `facts.json` regenerated. `diagram_facts.py`: add `services/opc/invoice_task.py:27` to `EVIDENCE` for the new note line. |
| Tests | `test_uml_design_questions_content.py`: `OBJECTIVE_VERBS` (fourth verb "Evaluate"), key tests per §5.2, `test_code_first_challenges_ask_for_a_real_attempt` unchanged (pins ≥ 1 still holds). `test_uml_design_questions_facts.py`: one test per new fact. `tests/uml-design-questions-tutorial.spec.js`: answer fixtures for the new ids. `uml-design-questions-diagrams.test.js`: the new note line. |
| Runtime | None required. One optional field, below. |
| Skill docs | `.agents/skills/tutorial-authoring/SKILL.md` §3.2 only if the optional field ships. |

### 6.2 Optional runtime extension: `attempt.pin_prompt`

*Problem.* Part A now depends on students pinning the right kind of evidence (the least obvious receiver; the charge and the rejection; each wait). The pin control shows only the generic line "Pin at least N…".

*Proposal.* One optional Markdown string:

```yaml
attempt:
  evidence_pins: 2
  pin_prompt: "Pin the line where the card is charged, and the line that handles a rejection."
```

- `normalizeSpec` in `js/tutorial-diagram-challenge-core.js` keeps `attempt.pinPrompt` as a bounded string; no grading or state change.
- `_includes/tutorial-diagram-challenge.html` renders it into a template keyed `attempt:pin_prompt`; `js/tutorial-diagram-challenge.js` shows it above the **Pin this line** button when present, else the current text.
- Tests: one core test (the string survives normalization; absent means default), one Playwright assertion that the prompt is visible in Part A.
- Cost: about 15 lines. Without it, the same sentence lives in each step's task list (as §3 writes it), so the redesign does not wait for this.

No new question type is proposed. Classification-per-row ("breaks, drifts, or safe") was considered for `breaks` and `windows` and rejected: a multiple-select plus per-option feedback carries the same information with the existing grading, comparison panel, and print view.

### 6.3 Fit with features being built now

- **Deep links from diagram labels and `path:line` references.** The redesign leans on them. In step 2 the diagram gives the complete consumer set and each label opens its handler, which is how "who is affected?" becomes "what breaks?". Every explanation and feedback string in §3 cites `path:line` in a form the linker can turn into a link; keep each reference inside one code span.
- **Diagram search and Cmd+F find-in-diagram.** Useful in step 5 (`Quotes`, `Publish`) and the capstone (`cancel`, `raises`). Step 2 offers a teachable miss: a search for `fan_name` in the diagram finds nothing, because the view shows who receives events, not what they read. The debrief sentence in §3.1 says so.
- **Pinch zoom.** `outages.component.uml` is the largest view; `unlisted` asks students to read all five website sockets, so the zoomed-out fit must keep socket labels legible, or the instructions should say to zoom.
- **Instructor mode** (runs the student flow, never locks, shows keys after **Solution**). The answer-key view should let an instructor tell fact keys from judgment keys. No runtime work is needed: each judgment key's `explanation` begins with its premises and names the design principle, and the YAML comment above the question says `# Judgment key: see redesign spec §5.1`. Since instructor mode never locks, an instructor can step through Part A's pins and then both follow-ups in one pass, which is the review path for §7.

### 6.4 Risks

| Risk | Mitigation |
|---|---|
| Decision questions invite "it depends" objections | Stems fix the criterion ("no fan charged… in whatever order", "under 2 seconds", "without breaking a consumer"); each distractor's feedback names the concrete case that defeats it. Four judgment keys go to the instructor (§7). |
| Part A gets longer: step 2 now needs the receivers *and* their handlers | Budget raised to 15 minutes; the 7-minute nudge stays; Part A earns completion credit whatever its correctness. Pilot timing decides (§7, question 2). |
| Step 2's diagram does not show field use, so students may feel it "did not answer" | Intended and said in the debrief: a view scopes, the code confirms. The label links make the confirmation four double-clicks. |
| Cross-step dependence (`trade-off` on step 3, `rule` on step 4) penalizes students who skipped or forgot | Each stem restates what it needs in one clause; explanations cite the earlier step. |
| Other agents are editing the YAML, runtime, and diagram sources now | This spec changes no file but itself. Apply it after their work lands; §3 addresses questions by `id`, not by line. |
| The `fix` key in step 3 is an untested design, since the codebase is read-only | The tests assert the premise that defeats each distractor. If the instructor wants the fix proven, add a test-only patched `InvoiceTask` in `scripts/tests/`, not in Headliner. |

### 6.5 Ordered implementation tasks

1. **Facts first (test-driven).** Add the §5.2 fact functions and their tests in `test_uml_design_questions_facts.py`; regenerate `facts.json`. Each test must fail before its function exists.
2. **Content tests.** Rewrite the key tests per §5.2 and update `OBJECTIVE_VERBS`; run them against the current YAML and confirm they fail for the right reasons.
3. **Diagram and links.** Add the note line to `failed-trips.sequence.uml`; update `event-consumers.links.yml`; add the evidence locator to `diagram_facts.py`; run `build_yaml.py`; run the diagram and links tests.
4. **Step 2** YAML (message, tasks, `breaks`, `rollout`, evidence additions, two follow-ups, debrief).
5. **Step 3** YAML (`money`, `fix`, `capture-last`, evidence additions, debrief sentence).
6. **Step 4** YAML (`split-scope`, message and debrief sentences).
7. **Step 5** YAML (`windows`, `lodging-order`, `unlisted`, `outbox` explanation).
8. **Step 6** YAML (`budget`, `fix` promoted, `trade-off`, one quiz question).
9. **Step 7** YAML (five stems and option sets, plan questions, `transfer`, explanations) and **step 1** (sentence, question).
10. **Top level:** `learning_objectives`, `progress_version: 2`, pedagogy comments, judgment-key comments.
11. **Audits:** `scripts/audit_mcq_tells.py`, the content tests, the reading-budget test; fix option lengths if any key trips the audit.
12. **Playwright:** update answer fixtures in `tests/uml-design-questions-tutorial.spec.js`; run the tutorial spec, the label-size spec, and the WCAG audit for the tutorial and its print page.
13. **Optional:** `attempt.pin_prompt` (§6.2), with its tests and the skill update, then move the pin sentences out of the task lists.
14. **Pilot** with one or two TAs: time Part A per step, and record every option they argue with.

---

## 7. Open questions for the instructor

Defaults are chosen so that work can proceed; each can be reversed by editing one question.

1. **Four judgment keys.** `capture-last` (step 3), the "remove later" half of `rollout` (step 2), `gateways` (capstone), and `transfer` (capstone) are keyed by design reasoning, not by a run. Default: keep them, with explanations that state their premises. If you prefer only fact-keyed grading, the fallbacks are: restore `charged` for `capture-last`; restore the old multiple-select `gateways` ("which classes can fail `cancel()`") and move the placement question into the debrief as an ungraded prompt.
2. **Step 2's length.** It now carries four graded questions and is budgeted at 15 minutes. Default: keep all four. If the pilot runs long, move `privacy` to the capstone's follow-up, where it would join `transfer`.
3. **Responsibility placement appears once.** A second instance could replace `rideshare` (for example, "where should a rule about teens in lodging live?"), but it needs `age_group` drawn on `Attendee` in the data-model diagram and a rule that is clearly local to one item. Default: not now; `rideshare` stays as the extension-cost question that uses the existing trip-items diagram.
4. **Warehouse ETL in `breaks`.** It keeps running while its rows change columns. Default: it is a distractor whose feedback names the silent drift. An alternative is `optional_indices` (accepted either way), if you consider silent schema drift a break.
5. **The stuck cancellation's third harm.** The run shows that no `trip.cancelled` event is published, so neither the fan's e-mail nor the Support Console's follow-up happens. Default: this is in the explanation, not in a key, because the cancellation diagram does not draw the event. Keying it would need one more fact line in `capstone-cancellation.sequence.uml`.
6. **Loyalty points survive a cancellation.** The run shows a fan keeps 955 points after a cancelled trip, because Loyalty binds only `trip.confirmed`. It is a real consistency finding, visible in step 2's diagram, and unused here for time. It would make a good exam or discussion question.

---

## 8. Sources

Books: Bass, Clements & Kazman, *Software Architecture in Practice*, 3rd ed. (2013), chs. 4, 5, 7, 8, 9, 14, 21; Clements et al., *Documenting Software Architectures: Views and Beyond*, 2nd ed. (2011), §§1.3, 2.4, 2.6, 3.3, ch. 8; Wirfs-Brock & McKean, *Object Design: Roles, Responsibilities, and Collaborations* (2003); Anderson & Krathwohl, *A Taxonomy for Learning, Teaching, and Assessing* (2001); Ambrose et al., *How Learning Works* (2010).

Research and reports, as listed with DOIs in §15 of the first spec: Larkin & Simon (1987); Sillito, Murphy & De Volder (2006, 2008); LaToza & Myers (2010); Ko, DeLine & Venolia (2007); Arisholm et al. (2006); Dzidek et al. (2008). Added here: Kazman, Klein & Clements, *ATAM: Method for Architecture Evaluation*, CMU/SEI-2000-TR-004.

† Cited from memory in this session, locators unverified: Parnas (1972), "On the criteria to be used in decomposing systems into modules", CACM 15(12); Liskov & Wing (1994), "A behavioral notion of subtyping", ACM TOPLAS 16(6); Meyer (1997), *Object-Oriented Software Construction*, 2nd ed.; Garcia-Molina & Salem (1987), "Sagas", SIGMOD; Murphy, Notkin & Sullivan (1995), "Software reflexion models", FSE. The "expand, then contract" and "transactional outbox" names are practitioner terms and are used descriptively; no student-facing text depends on a citation for them.

Skills applied: `cs-tutorial-design` (Bloom targeting, component skills before integration, the Liar Assessment, tasks that preserve the assessed decision), `pedagogical-advisor` (target capability → cognitive work → observable evidence → feedback; calibrated evidence grades), `software-architecture` (design, evaluate, and document routes: six-part scenarios, view selection by stakeholder question, risks and trade-off points), `quiz-format` (sparse option feedback, shuffle-safe wording, answer-tell limits), `good-diagrams` (one takeaway per view; no diagram changed without a need), `c4-model` (facts versus proposals; "not drawn" is not "not implemented"), `responsibility-driven-design` (contracts, owners for recovery actions, explicit variation), `maintainable-code` (contract and substitutability arguments in the `gateways` key), `test-design` (fact tests pin the spec and no more; judgment keys assert premises only).
