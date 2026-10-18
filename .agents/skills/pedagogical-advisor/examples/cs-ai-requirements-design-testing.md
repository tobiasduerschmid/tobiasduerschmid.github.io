# Worked Mini-Unit: Requirements, Design, and Testing with AI

## Contents

- Context and targets
- Common case packet: student-facing
- Session 1 — Requirements that can guide and challenge AI
- Session 2 — Design from invariants and failure cases
- Session 3 — Tests as evidence and requirement evolution
- Practice, assessment, and feedback
- Workload and delivery variants
- Evidence rationale

**Status:** Original teaching synthesis, not a named or validated research framework. The sequence illustrates evidence-informed practices; it is not an established intervention with a known effect size. Check the current AI/CS evidence notes before claiming that this combination improves learning.

## Context and targets

Three 75-minute undergraduate software-engineering sessions, separated by at least one day when the timetable permits. Assumed preparation: functions, collections, unit tests, HTTP request/response basics, and introductory database transactions. Pair work is followed by individual checks. Students can use a provided static AI-output packet; no paid account or live model is required.

By the end, students should independently be able to:

1. Turn an ambiguous stakeholder request into testable requirements while identifying unconfirmed assumptions.
2. Explain a design decision using an invariant, failure scenario, and tradeoff.
3. Derive tests from requirements, explain the oracle, and expose a plausible defect.
4. Evaluate an AI-generated artifact with external criteria and revise it with justified changes.
5. Propagate a changed requirement through design and tests.

The case concerns a **campus equipment reservation service**. Keep scope small: one-hour slots, one item per reservation, authenticated students, and fictional accounts only. A modular monolith and an in-memory test model are sufficient. Production security and legal requirements are outside this exercise's claims, though authorization is included in the teaching specification.

## Common case packet: student-facing

### Stakeholder's initial request

> Students should reserve equipment quickly and fairly. A student can book an available item for a slot, see their own bookings, and cancel one. The system must not lose bookings if the network is unreliable. We expect about 500 students to try to reserve equipment when booking opens.

### Authoritative clarification card

The instructor plays the stakeholder. Release these answers during session 1; after that they are the specification used by every group.

- An `item_id` identifies one physical item. A slot is a fixed one-hour interval represented by a UTC start time; only predefined slot IDs can be booked.
- At most one **active** reservation exists for an item and slot. Cancellation releases that item and slot.
- Booking requests have a client-generated `request_id`, scoped to the authenticated student's account. **Only a successful booking binds the request ID.** The binding of student, request ID, item, slot, and reservation identity commits atomically with reservation creation. Once bound, repeating that request ID with the same item and slot returns its original reservation identity and current status without creating another reservation, even after cancellation. Reusing a bound ID for different parameters returns a request-conflict error.
- An explicitly rejected booking attempt, such as unavailable slot, invalid slot, or the later exercise's reservation-cap rejection, creates neither a reservation nor a request-ID binding. The same unbound ID may subsequently be retried with the same or different parameters and is evaluated as a new attempt. This is a **success-only binding contract**, not durable caching of every response. A timeout is not an explicit rejection: the success and binding may already have committed.
- For concurrent requests using the same student and request ID, at most one binding can commit. Identical parameters can produce two successful responses containing the same reservation identity. Different parameters cannot both create reservations under that ID; after one binds successfully, the other receives a request-conflict error.
- A cancelled reservation ID is never reused for a different booking. A fresh request ID is required to make a new booking after cancellation.
- The service derives ownership from the authenticated student. Only that owner can view or cancel their reservation. Knowing its ID is insufficient. For this exercise an unauthorized request returns a generic denied/not-found response with no reservation details.
- Cancellation is idempotent: an owner can repeat it safely and receive the cancelled state. A request from another student has no effect.
- “Fairly” is unresolved; do not silently choose a queue, lottery, or first-come rule. For the exercise, whichever competing request commits first may win. This is a concurrency rule, not a claim about fairness.
- A performance target is a **candidate requiring stakeholder confirmation**: 95% of booking responses within two seconds during a five-minute test of 100 booking requests/second, on a specified test deployment with a specified distribution of items/slots and conflict rate. The original “500 students” statement alone does not determine request rate or a service-level objective.

### Flawed model-output packet

This output is instructor-authored to resemble common plausible errors. It is not evidence about any particular model's current behavior.

**Proposed requirements**

1. The service shall be fast and fair.
2. Every request shall create a new reservation ID.
3. A student shall cancel a reservation by supplying its ID.

**Proposed design**

```text
reserve(student, request_id, item, slot):
    if no active reservation exists for (item, slot):
        reservation = insert_reservation(student, item, slot)
        return reservation
    return unavailable

cancel(student, reservation_id):
    delete reservation with reservation_id
    return success
```

**Proposed tests**

```text
reserve a free item/slot -> success
list the student's reservations -> contains the new reservation
cancel the reservation -> success
```

## Session 1 — Requirements that can guide and challenge AI

| Minutes | Instructor and learner action | Visible learning evidence |
|---|---|---|
| 0–5 | Individual diagnostic: “What can ‘must not lose bookings’ mean? Give two distinct failure cases.” | Initial distinctions; no model assistance |
| 5–13 | Model one requirement: separate a stakeholder goal, an assumption, a rule, and an acceptance example | Annotated worked example |
| 13–23 | Pairs write five clarification questions; instructor answers using the card | Prioritized questions and marked assumptions |
| 23–33 | Individual draft, then pair comparison: write retry and ownership requirements | Student-owned initial requirements |
| 33–45 | Reveal model-output packet; pairs locate contradictions and revise it | Before/after table with reasons |
| 45–60 | Build four acceptance scenarios including one invalid action and one replay | Inputs, preconditions, expected result, and state invariant |
| 60–69 | Exchange specifications; peers try to implement literally and identify one ambiguity | Concrete ambiguity report and revision |
| 69–75 | Individual exit: explain why “500 users and 99% accuracy” is insufficient to specify performance | Explanation with a measurable candidate and its assumptions |

### Copy-ready student task

> Produce a one-page specification containing: (a) four named requirements covering exclusive booking, replay, ownership, and cancellation; (b) four acceptance scenarios; (c) two unresolved stakeholder decisions; and (d) a table of two accepted or rejected model suggestions with your reasons. Use the clarification card as the authority. Mark proposed assumptions rather than presenting them as approved requirements. You have 25 minutes across the drafting and acceptance-scenario activities; use the separate 12-minute model-critique activity for the suggestion table.

### Expected responses and teaching decisions

- **Exclusive booking:** at most one active reservation for `(item, slot)` after any completed operation. “No duplicates on screen” is insufficient because display filtering can hide conflicting records.
- **Replay:** a response lost after commit followed by an identical retry returns the same reservation identity; active reservation count remains one. A replay after cancellation returns that same identity as cancelled, without booking again.
- **Rejected attempt:** if request R returns unavailable, R remains unbound. After the occupied slot is released, retrying R can create a reservation. Before any successful binding, R can also be used with different parameters without a request-conflict error. After binding, changed parameters conflict.
- **Ownership:** student B cannot cancel student A's reservation even with its ID; state is unchanged. The authenticated identity, not a submitted owner field, determines the actor.
- **Cancellation:** owner's repeated cancellation returns a cancelled result without reviving or duplicating records; the slot becomes available for a new request.
- **Open decisions:** fairness policy and confirmed performance target are defensible examples; UTC slot semantics and ownership are already clarified and should not remain open.

Hinge question: **“A request times out. Does that show the reservation failed?”** Expected: no; commit may have happened and only the response been lost. If students conflate timeout with failure, trace the two possible timelines before moving on. Do not award full credit for merely adding the word “idempotent”; require observable behavior.

## Session 2 — Design from invariants and failure cases

| Minutes | Instructor and learner action | Visible learning evidence |
|---|---|---|
| 0–7 | Retrieve retry and ownership requirements individually; compare to card | Corrected retrieval response |
| 7–17 | Model a lost-response timeline and one reservation state transition | Trace with request, commit, and response separated |
| 17–32 | Pairs interleave two calls in the flawed check-then-insert design | A concrete race that creates two active reservations |
| 32–47 | Complete a partially worked component/state design | Responsibility allocation and transaction boundary |
| 47–60 | Use AI or a supplied alternative to challenge the design; accept/reject one suggestion | Decision record with criterion and tradeoff |
| 60–70 | Individual change: cancel, rebook with a new request, then replay the old request | Correct state/result trace |
| 70–75 | Exit: defend one correctness mechanism and name its cost or limitation | Short independent design rationale |

### Copy-ready student task

> Create a compact design with three responsibilities: request/authentication handling, reservation rules, and storage. Identify where ownership is checked, how request IDs map to durable outcomes, and how competing reservations cannot both commit. Draw or tabulate the state transitions. Write a 150-word decision record comparing your mechanism with the proposed check-then-insert design. Explain a failure your design prevents and one tradeoff. A component count or architectural pattern name earns no credit without the reasoning.

### Worked solution outline

Request handling validates the authenticated actor and request syntax. For an already bound request ID, the service compares normalized parameters and either returns its reservation's current state or a request-conflict error before rechecking availability or a later reservation cap. For an unbound ID, it validates the predefined slot and booking rules. On success, it atomically records the request ID, owner, normalized parameters, and reservation identity with reservation creation; an explicit rejection leaves no binding. Storage must coordinate both uniqueness of `(student, request_id)` bindings and exclusivity of active reservations for `(item, slot)`. A persistent constraint, an appropriate transaction/locking strategy, or an equivalent justified mechanism enforces these invariants. A simple single-process lock can illustrate them in the lab, but students must state that it is insufficient across multiple independently executing service processes unless coordination is shared.

Cancellation authorizes the owner and transitions an active record to cancelled rather than destroying the request history. An owner replay returns the original reservation with its current state. A new request can create a different active reservation for the released slot. Replaying the old cancelled request cannot cancel or claim the new reservation.

Do not treat “use a transaction” as a complete explanation. Students should identify the operations that must be atomic and how the chosen constraint or isolation mechanism prevents both requests succeeding. Do not impose microservices: a small module boundary can isolate policy and storage with substantially less coordination overhead in this case.

Misconception check: **“If each call validates that the slot is free, can two calls both succeed?”** Expected interleaving: A reads free; B reads free; A inserts; B inserts. A correct explanation identifies the gap between the check and protected write. If students only say “race condition,” ask them to supply the states.

## Session 3 — Tests as evidence and requirement evolution

| Minutes | Instructor and learner action | Visible learning evidence |
|---|---|---|
| 0–7 | Individual retrieval: name two failures the packet's three tests miss | Requirement-linked failures |
| 7–17 | Model a requirement → oracle → test → defect chain | One complete example |
| 17–32 | Pairs design missing tests before seeing or generating more implementation | Preconditions, operation, result, post-state |
| 32–47 | Run or manually trace tests against the flawed and repaired models | Failure evidence; no invented execution claims |
| 47–59 | Critique AI-proposed tests; select one additional useful test and reject one redundant or misleading test | Selection reasoning linked to a risk |
| 59–69 | Individual requirement change: maximum two active reservations per student | Impact map and new boundary/concurrency tests |
| 69–75 | Exit: explain what a passing suite supports and one important behavior it does not establish | Calibrated assurance claim |

### Copy-ready student task

> Submit a table of six tests. For each, identify the requirement, setup, operation, expected response and stored state, and the defect it would expose. At least one must check replay, one authorization, one cancellation/rebooking, and one competing request scenario. Derive your expected results from the clarification card before consulting generated implementation. Report execution only for tests you actually ran; label a trace or proposed test accordingly.

### Answer key: candidate tests

| Test | Setup and operation | Oracle and likely defect exposed |
|---|---|---|
| Identical retry after lost response | Reserve with request R; suppress response; repeat R with same parameters | Same reservation identity; exactly one active record. Exposes missing replay handling |
| Same request ID, different parameters | Successful R for item A; repeat R for item B | Request-conflict error; no new record. Exposes unsafe request-ID reuse |
| Retry after an explicit rejection | Slot is occupied; R returns unavailable; owner releases the slot; retry R for the same slot | R was unbound after rejection; retry can create and bind one reservation. Exposes wrongly caching unavailable outcomes under this contract |
| Changed parameters after rejection | R for occupied item A returns unavailable; use R for a free item B | R is still unbound, so the new attempt can succeed for B without a request-conflict error. Exposes binding an unsuccessful attempt |
| Unauthorized cancellation | A owns reservation X; B submits cancel X | Denied/not-found; X remains active; no details disclosed. Exposes missing ownership check |
| Cancellation then new booking | Owner cancels X; a fresh request books that slot | X stays cancelled; new identity Y is active. Exposes stale availability or identity reuse |
| Old replay after rebooking | After previous test, replay original request for X | Returns X as cancelled; Y unchanged. Exposes replay that creates a new booking or targets current slot occupant |
| Two competing fresh bookings | Two **distinct, previously unbound request IDs** target the same free item/slot; force both calls to reach the free-slot decision before either writes, or exercise the production constraint with a controlled integration test; no cancellation occurs during the test | At most one booking succeeds and one active reservation exists. The losing request remains unbound. Exposes check-then-insert race |
| Concurrent identical replay | Two calls by the same student use the **same** previously unbound request ID and parameters for one free slot; no other operation intervenes | Both may return success, but they contain the same reservation identity and only one active record exists. Exposes treating response count as reservation count or failing to coordinate request-ID binding |

A sequential unit test cannot by itself demonstrate concurrent safety. A nondeterministic stress test may miss a race. A controlled interleaving of a model illustrates the failure; testing the actual storage mechanism is a separate obligation when claiming the implementation is safe. High line coverage does not establish that assertions represent the correct requirements. A test generated from faulty code can reproduce the same mistaken assumption.

### Change-request answer key

New rule: **A student may have at most two active reservations at any moment, across all items and slots.** Cancellation releases one allowance. Identical request replay does not consume a new allowance.

- **Requirements:** add boundary behavior at counts 0, 1, and 2; keep replay semantics; reject a fresh booking at the limit without binding its request ID. That unbound request may succeed after cancellation frees an allowance.
- **Design:** enforce the per-student cap atomically with creation as well as slot exclusivity. A separate unprotected `count < 2` check introduces another race. An item-slot lock alone does not coordinate bookings on different slots by the same student.
- **Tests:** a third distinct active booking is rejected and its request ID stays unbound; cancel then retry that rejected request can succeed; replay of a **previously successful, bound** request at the cap returns its original reservation identity and current state without consuming another allowance; two simultaneous fresh requests with **distinct, unbound request IDs** for different free slots by a student with one active reservation yield at most one additional active reservation.
- **Tradeoff:** the additional coordination may affect throughput. State this as a hypothesis to measure; do not invent latency results.

## Practice, assessment, and feedback

**Between sessions:** session 1 → 2: 20-minute specification revision plus a five-minute retrieval exercise the next day; session 2 → 3: 25-minute design/test preparation plus a five-minute retrieval exercise; after session 3: 35-minute revision and a five-minute delayed check in the following week. This is a planning estimate of 95 minutes beyond the 225 class minutes; pilot and adjust for learner preparation. Make the final delayed check part of the next class if external workload is already high.

Use the delayed check to test transfer to **appointment booking** with two seats per slot. Ask students to identify which invariant changes, which retry/ownership rules can remain, and one test that must change. Remove access to the worked case and AI for this short sample while applying established accommodations. Passing the equipment example does not by itself show this transfer.

| Criterion | Points | Strong evidence |
|---|---:|---|
| Requirements and ambiguity management | 5 | Observable behavior, correct authority, explicit unresolved decisions |
| Design reasoning | 5 | Invariant, concrete failure, effective mechanism, justified tradeoff |
| Tests and oracles | 5 | Independent requirement basis, edge cases, limitations understood |
| Individual evolution and transfer | 5 | Correct change propagation and independent explanation |

Assess AI evaluation within these four criteria through the student's justified decisions, not through prompt length, expensive model access, or polished output. Use pair products for formative comparison and individual checks for claims about individual capability. Return one consequential revision request per pair and common class feedback; students annotate the resulting change. Inspect weaker and stronger samples to check whether feedback actually changed reasoning.

## Workload and delivery variants

- **Preparation:** provide the case, clarification card, flawed packet, partially worked design, and answer key. A manual trace pathway avoids tool setup becoming a prerequisite for the core lesson.
- **Large class:** use pairs with one shared artifact, collect individual exit responses, and sample them before the next session. Whole-class feedback should address observed patterns, with additional help for persistent gaps. A three-minute review of 120 pair submissions requires six staff hours for one pass before administration; select fewer checkpoints or shorter criterion-focused feedback if this exceeds capacity.
- **Novice learners:** teach the lost-response timeline and atomic update idea with state tables before introducing database terminology. Defer implementation concurrency to a later lab if prerequisites are missing.
- **Advanced learners:** implement deterministic concurrency tests against the actual chosen data store and justify isolation/constraint behavior using current primary documentation.
- **Accessibility:** provide text equivalents of diagrams and code as selectable text; allow typed or spoken explanations according to the target and established accommodations; allow the static packet in place of live AI interaction.
- **AI availability:** live tools may propose requirements, alternatives, and tests after an initial student attempt. Treat every output as untrusted content to inspect. Students log only consequential uses and decisions; do not require private or exhaustive chat histories.

## Evidence rationale

Retrieval and spaced follow-up draw on `Dunlosky2013` and `Cepeda2006`; worked/completion examples and scaffold fading on `Atkinson2000` and `Sweller2019`; structured student explanation and comparison on `ChiWylie2014`; actionable feedback and revision on `Wisniewski2020`. Consult `Franklin2025` and the package's updated AI/CS evidence for domain-specific context. These sources support underlying practices under relevant conditions; they do not establish the effectiveness of this exact mini-unit, its timings, or its AI-use sequence. Evaluate delayed independent performance, error detection, workload, and access locally.
