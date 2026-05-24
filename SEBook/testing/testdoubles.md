---
title: Test Doubles
layout: sebook
---

## Why test doubles exist

Imagine you push a green PR on April 28 that asserts the daily-event-day function returns `True` for `"2026-04-28"`. CI is green. You sleep. The next morning — without anyone editing the code — CI turns red. The hidden collaborator was the wall clock; the test never really verified the function's behavior, it verified that *today happens to equal the hardcoded date*.

That is the recurring problem test doubles exist to solve: **a collaborator the test cannot control or observe makes the test flaky, slow, or unable to verify the right thing.** Wall clocks, HTTP services, databases, message queues, payment gateways, email senders, random number generators — each one quietly turns a deterministic unit test into something else.

A **test double** is any object that stands in for a real dependency during a test. Borrowed from the film-industry stunt double, the metaphor is exact: the double looks like the real thing from the system's perspective, but the test gets to choose what it does.

Two pieces of vocabulary from Meszaros that we use throughout this chapter:

* **SUT** — *System Under Test*. The unit (function, class, or small group of collaborators) you actually want to verify.
* **DOC** — *Depended-On Component*. A component the SUT calls into; replacing it with a test double is what lets the SUT be tested in isolation.

## Four questions before you reach for a double

Before naming any specific kind of double, ask the four questions that decide which one fits. Every test double answers exactly one of these:

| Question the test is asking | What the double provides | Typical role |
|---|---|---|
| "What should this collaborator return so I can drive the SUT down a specific branch?" | **Control** over indirect input | Stub |
| "Did the SUT actually call this collaborator, and with what arguments?" | **Observation** of indirect output | Spy |
| "Does the SUT follow the expected collaboration protocol — call this once, with these args, before that one?" | **Verification** of interaction | Mock Object |
| "I need a working-but-cheap replacement that behaves like the real collaborator across many calls." | **Substitution** with simpler behavior | Fake |

The first three are about *what direction of data* the test cares about — values flowing *into* the SUT (indirect input) versus actions flowing *out* of it (indirect output). Substitution (the fourth) is about *how much state* the test needs the collaborator to manage. Get the question right and the kind of double falls out.

## The taxonomy — five named doubles, one umbrella

Gerard Meszaros's canonical taxonomy in *xUnit Test Patterns* (2007) {% cite meszaros2007xunit %} identifies five kinds of test double — *Dummy*, *Fake*, *Stub*, *Spy*, and *Mock*. The umbrella name **Test Double** covers all five; the five names below it are roles, each tagged for a different test-design problem.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
class TestDouble <<abstract>> {
  replaces a real dependency
}
class Dummy {
  fills a parameter
  never actually used
}
class Stub {
  controls indirect inputs
  feeds canned values INTO the SUT
}
class Fake {
  working implementation
  with shortcuts unsuitable
  for production
}
class Spy {
  records indirect outputs
  verify AFTER execution
}
class MockObject {
  expects indirect outputs
  verify DURING execution
}
Dummy --|> TestDouble
Stub --|> TestDouble
Fake --|> TestDouble
Spy --|> TestDouble
MockObject --|> TestDouble
@enduml'></div>

The three with the most subtle distinctions are Stub, Spy, and Mock — covered in depth below. *Dummies* (objects passed but never used — a parameter required by a signature you don't care about) and *Fakes* (working implementations with shortcuts unsuitable for production — for example, an in-memory database) are simpler but worth knowing exist. The three core kinds differ along two axes: *which direction of data flow they control* (indirect input vs. indirect output) and *when verification happens* (after the fact vs. during execution).

Keep this map in mind as you read: each section below deepens one of the three branches.

## The verbatim teaching sentence

Before any code, lock in one sentence — it solves the single biggest source of confusion in Python testing:

> **`Mock` is a tool class; stub, spy, and mock are test-design *roles*. Same in Python, JavaScript, and Java — the role is what matters; the class name is just syntax.**

Python's `unittest.mock.Mock` is a configurable object that can play *any* of the three roles depending on what the test does with it. Setting `mock.return_value = ...` makes it a stub. Asserting `mock.method.assert_called_once_with(...)` makes it a spy. Conflating the *class name* "Mock" with the *Meszaros role* "Mock Object" is the most common reason people say "I added a mock" when they really mean "I added a stub." The role is determined by what the test *does* with the object, not by which class instantiated it.

## Test Stub

A **Test Stub** {% cite meszaros2007xunit %} is an object that replaces a real component so the test can control the **indirect inputs** of the SUT. Indirect inputs are the values returned to the SUT by another component whose services it uses — return values, output parameters, exceptions. By replacing the real DOC with a Test Stub, the test establishes a control point that forces the SUT down specific execution paths it might not otherwise take (the rare error branch, the timeout path, the empty-result case, the unreachable edge condition). During the test setup phase, the stub is configured to respond to calls from the SUT with highly specific values.

A hand-rolled stub in Python is just a class with a hard-coded method:

```python
class FrozenClock:
    """A stub clock — always returns the datetime it was constructed with."""
    def __init__(self, fixed_dt):
        self._fixed_dt = fixed_dt

    def now(self):
        return self._fixed_dt
```

The framework-generated equivalent is one line:

```python
clock = Mock()
clock.now.return_value = datetime(2026, 4, 28, 12, 0)
```

Same role; less typing. While Test Stubs perfectly address the injection of inputs, they inherently ignore the indirect outputs of the SUT. To observe outputs, we must shift to a different class of test double.

## Test Spy

When the behavior of the SUT includes actions that cannot be observed through its public interface — sending a message on a network channel, writing a record to a database, dispatching a push notification — we refer to these actions as **indirect outputs**. To verify these indirect outputs, we use a **Test Spy** {% cite meszaros2007xunit %}.

A Test Spy is a more capable version of a Test Stub that serves as an observation point by quietly recording all method calls made to it by the SUT during execution. Like a Test Stub, a Test Spy may need to provide values back to the SUT to allow execution to continue, but its defining characteristic is its ability to capture the SUT's indirect outputs and save them for later verification by the test.

The use of a Test Spy facilitates a technique called **procedural behavior verification**. The testing lifecycle using a spy looks like this:

1. The test installs the Test Spy in place of the DOC.
2. The SUT is exercised.
3. The test retrieves the recorded information from the Test Spy (often via a *Retrieval Interface*).
4. The test uses standard assertion methods to compare the actual values passed to the spy against the expected values.

A software engineer should reach for a Test Spy when the assertions should remain clearly visible within the test method itself, or when they cannot predict the values of all attributes of the SUT's interactions ahead of time. Because a Test Spy does not fail the test at the first deviation from expected behavior, it allows tests to gather more execution data and include highly detailed diagnostic information in assertion failure messages.

The interesting test-design move with a spy is rarely *writing* it (a class with a list and an `append` call) — it is **how much of each call to pin**. Pinning too little produces a *Liar test* that always passes; pinning too much produces a *brittle test* that breaks under harmless refactors. The Goldilocks assertion pins exactly what the spec mandates, no more and no less.

## Mock Object

A **Mock Object** {% cite meszaros2007xunit %}, like a Test Spy, acts as an observation point to verify the indirect outputs of the SUT. However, a Mock Object operates using a fundamentally different paradigm known as **expected behavior specification**. Instead of waiting until after the SUT executes to verify the outputs procedurally, a Mock Object is configured *before* the SUT is exercised with the exact method calls and arguments it should expect to receive. The Mock Object essentially acts as an active verification engine during the execution phase. As the SUT executes and calls the Mock Object, the mock dynamically compares the actual arguments received against its programmed expectations. If an unexpected call occurs, or if the arguments do not match, the Mock Object fails the test immediately.

Fowler's distinction between *classical* and *mockist* testing styles {% cite fowler2007MocksArentStubs %} maps onto this difference: classical tests prefer real collaborators and observe the SUT's *state*; mockist tests specify the *interactions* between the SUT and its collaborators up front. Neither style is universally correct. Mocks fit best when the interaction *is* the contract — "the payment gateway must be charged exactly once for the order total" — and worst when they merely freeze the implementation's current call shape.

## Fake Object

A **Fake Object** {% cite meszaros2007xunit %} is a working implementation of the same interface as the real DOC, but with shortcuts that make it unsuitable for production — no durability, no concurrency safety, no transactional guarantees, no remote calls. The canonical example is an in-memory repository standing in for a database-backed one:

```python
class FakeUserRepository:
    """In-memory implementation of UserRepository — for tests only."""
    def __init__(self):
        self._users = {}

    def save(self, user):
        self._users[user.id] = user

    def find_by_id(self, user_id):
        return self._users.get(user_id)
```

A Fake earns its keep when the SUT round-trips with the collaborator across multiple calls — write a user, look it up, update its email, look it up again. Modeling that sequence with stubs would require coordinating multiple `return_value` mappings, each one fragile and easy to misalign. The Fake just stores and retrieves; the test reads as if it were running against the real repository.

### The Fake's recurring risk — drift, and the contract test that defends against it

Every Fake is a *promise* that it behaves enough like the real collaborator for the SUT's tests to be meaningful. That promise can silently break the moment the real collaborator's behavior diverges (a new uniqueness constraint, a different error class, a transactional rollback the Fake doesn't simulate). The defense is a **contract test** — a single shared test that both the Fake and the real implementation must pass:

```python
def user_repo_contract(repo):
    """Behavioral contract that BOTH FakeUserRepository and the real
    Postgres-backed UserRepository must satisfy."""
    user = User(id="u1", email="ada@example.com")
    repo.save(user)
    assert repo.find_by_id("u1") == user
    assert repo.find_by_id("does-not-exist") is None
```

Run that test against the Fake (fast, every commit) and against the real repository (slower, on a schedule). When they diverge, you find out immediately.

## Dummy Object

A **Dummy Object** {% cite meszaros2007xunit %} is the lightest double — it fills a parameter slot but is never actually used by the SUT. Reach for it when the SUT's signature requires a collaborator the *particular test* doesn't care about (the SUT takes a logger but this test ignores logging; the constructor needs a notifier but this code path doesn't notify). The minimum-viable-double rule says: start with a Dummy and escalate only when the test needs the double to *do* something.

## When NOT to use a double

A test double is a tool you reach for when a real collaborator would make the test flaky, slow, or unable to verify the right thing. It is not a default. It is not a sign of professionalism. It is not a coverage strategy. **The right number of doubles for many tests is zero.**

A useful heuristic from {% cite fowler2007MocksArentStubs %} and the empirical mocking literature: use a real collaborator when it is fast, deterministic, locally available, and free of dangerous side effects. Reach for a double when the collaboration is *awkward* — slow, nondeterministic, expensive, dangerous, or unable to be put into the state the test needs.

Three antipatterns to recognize on sight:

| Antipattern | Symptom | Why it happens | Fix |
|---|---|---|---|
| **Over-mocking** | Every internal helper is mocked; the test asserts only on the mocks. | "Isolation feels safe; more mocks = more tested." | Mock at the *architectural boundary* (HTTP, DB, clock), not at every internal function. |
| **Mocking what you don't own** | A third-party library's API is mocked directly, scattered across many tests. | The library is brittle and the team doesn't want to wait for real responses. | Wrap the third-party in your own thin *Adapter* class; double the Adapter. The third-party's internals stay invisible to your tests. |
| **Coverage chasing** | Every line of the SUT runs in some test, but assertions are weak or mocked-on-mocks. | Coverage is misread as a quality signal. | Stronger oracles, real collaborators where possible, fewer tests that test more meaningfully. *Coverage is not correctness.* |

## A small decision rubric

| If the SUT… | Reach for… |
|---|---|
| …is a pure function — same input always yields same output, no collaborators | **No double** |
| …calls a clock, a remote service, or any non-deterministic source | **Stub** |
| …needs to verify a fire-and-forget outbound call (e.g., `notifier.send(...)`) | **Spy** or **Mock** |
| …needs to round-trip with a stateful collaborator (write then read) | **Fake** |
| …calls a third-party library you don't own | **Adapter** wrapper → double the adapter |
| …is just simple math, string, or list manipulation | **No double** (don't make work) |
| …already uses a fake or adapter, and you need confidence it still matches the real collaborator | **Contract / integration check** against the real boundary |

## Test-double smells

Real codebases are full of tests that *look* productive but verify almost nothing. Naming the smells trains the eye to spot them in code review.

| Smell | What it looks like | Why it hurts |
|---|---|---|
| **The Mockery** | A test with so many mocks that nearly every line of the SUT is replaced. | The test verifies orchestration, not behavior; pure refactors break it. |
| **Counting on Spies** | The test pins `assert_called_once_with(...)` after every internal call. | Couples the test to the SUT's call sequence; refactoring becomes brittle. |
| **Unnecessary Stubs** | Stubs configured for calls the SUT does not make in this path. | Adds maintenance burden; misleads readers about what the test exercises. |
| **Mystery Guest** | The test reads from an external file, fixture, or database not visible in the test method. | Reader cannot tell from the test alone what was set up or why. |
| **Eager Test** | A single test exercises many behaviors of the SUT at once. | When it fails, the failure does not localize which behavior broke. |
| **Assertion Roulette** | Many unexplained assertions in one test, none with messages. | A failure tells you the test broke; figuring out *which* assertion requires reading the code. |

## What a doubled test does *not* prove

Every test double trades reality for control. That is usually the right trade in a unit test, but it leaves a gap: a stub might not match the real API, a fake might drift from the real database, an adapter mock cannot prove the third-party service still accepts your actual request. A professional test plan says all three halves out loud:

* **This unit test proves:** the SUT behaves correctly given a controlled collaborator.
* **This unit test does not prove:** the real collaborator still speaks the same contract.
* **Complementary check:** a contract test, sandbox integration test, or adapter-level test that exercises the real boundary at lower frequency.

## Apply what you've read

Build the skill in the [Test Doubles Tutorial](/SEBook/tools/test-doubles-tutorial), which takes you through six steps in a Python sandbox: introducing a seam, hand-rolling a stub, hand-rolling a spy, recognizing the same roles inside `unittest.mock`, navigating the "patch where the SUT looks up the name" pitfall, and deciding when *not* to use a double at all.

## Practice

{% include flashcards.html id="testdoubles" %}

{% include quiz.html id="testdoubles" %}
