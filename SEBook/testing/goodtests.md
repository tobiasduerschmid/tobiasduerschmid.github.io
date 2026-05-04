---
title: Writing Good Tests
layout: sebook
---

A good test is a small, executable claim about behavior. It says: given this situation, when this action happens, this observable result should follow. The best tests are boring in the right way: easy to read, hard to misinterpret, and quick to run.

The examples below are language-independent in intent. Python is shown by default, with equivalent Java, C++, and TypeScript for Node.js versions available beside it. The snippets use common test-runner idioms: pytest-style Python, JUnit-style Java, Catch2-style C++, and Node.js `node:test` with `node:assert/strict` for TypeScript.

# Start with Behavior

Write the test from the caller's point of view, not from the implementation's point of view. If the test name mentions a private method, a loop, a temporary variable, or a mock interaction that users would not recognize, pause and ask what behavior the test is really protecting.

Good starting questions:

* What promise does this function, object, endpoint, or workflow make?
* What would a caller observe if that promise were broken?
* What input examples represent the ordinary case, the boundary, and the invalid case?
* What is the simplest observable oracle for the expected behavior?

This is why test design begins with specification and test-data selection rather than with line coverage. Classic testing theory treats test data as evidence for a behavioral claim, not as a way to merely traverse statements {% cite GoodenoughGerhart1975 %}.

# Use the Four-Part Shape

Most readable tests follow the same shape, even when the framework uses different names:

1. **Arrange:** build the relevant fixture.
2. **Act:** execute one behavior.
3. **Assert:** check the observable result.
4. **Clean up:** release external resources if needed.

Meszaros describes this structure as fixture setup, exercise, result verification, and teardown in the xUnit pattern language {% cite Meszaros2007 %}. The value is not ceremony. The value is separation: readers can see what was prepared, what happened, and what was checked.

<div class="inline-language-switcher" data-language-switcher data-default-language="python">
  <div class="inline-language-tabs" role="tablist" aria-label="Discount test code language">
    <button type="button" role="tab" data-language-option="python" aria-selected="true">Python</button>
    <button type="button" role="tab" data-language-option="java" aria-selected="false">Java</button>
    <button type="button" role="tab" data-language-option="cpp" aria-selected="false">C++</button>
    <button type="button" role="tab" data-language-option="ts" aria-selected="false">TypeScript (Node.js)</button>
  </div>

  <div class="inline-language-panel" data-language-panel="java" role="tabpanel" markdown="1">
```java
@Test
void premiumCustomerGetsTenPercentDiscount() {
    Cart cart = cartWith(
        List.of(item("Refactoring", 10_000)),
        customer("premium")
    );

    int total = cart.totalCents();

    assertEquals(9_000, total);
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="cpp" role="tabpanel" markdown="1">
```cpp
TEST_CASE("premium customer gets ten percent discount") {
    Cart cart = cartWith(
        { item("Refactoring", 10'000) },
        customer("premium")
    );

    int total = cart.totalCents();

    REQUIRE(total == 9'000);
}
```
  </div>

  <div class="inline-language-panel is-active" data-language-panel="python" role="tabpanel" markdown="1">
```python
def test_premium_customer_gets_ten_percent_discount():
    cart = cart_with(
        items=[item("Refactoring", price_cents=10_000)],
        customer=customer(tier="premium"),
    )

    total = cart.total_cents()

    assert total == 9_000
```
  </div>

  <div class="inline-language-panel" data-language-panel="ts" role="tabpanel" markdown="1">
```typescript
import { strictEqual } from "node:assert/strict";
import test from "node:test";

test("premium customer gets ten percent discount", () => {
  const cart = cartWith({
    items: [item("Refactoring", { priceCents: 10000 })],
    customer: customer({ tier: "premium" }),
  });

  const total = cart.totalCents();

  strictEqual(total, 9000);
});
```
  </div>
</div>

Notice what the test does not do. It does not inspect a private discount table, assert every intermediate calculation, or combine discounts, tax, shipping, and refunds into one giant scenario. It protects one behavior.

# Make the Assertion Strong

A weak assertion lets broken behavior slip through. These tests execute code, but they barely test anything:

<div class="inline-language-switcher" data-language-switcher data-default-language="python">
  <div class="inline-language-tabs" role="tablist" aria-label="Weak assertion code language">
    <button type="button" role="tab" data-language-option="python" aria-selected="true">Python</button>
    <button type="button" role="tab" data-language-option="java" aria-selected="false">Java</button>
    <button type="button" role="tab" data-language-option="cpp" aria-selected="false">C++</button>
    <button type="button" role="tab" data-language-option="ts" aria-selected="false">TypeScript (Node.js)</button>
  </div>

  <div class="inline-language-panel" data-language-panel="java" role="tabpanel" markdown="1">
```java
@Test
void total() {
    Cart cart = cartWith(List.of(item("Refactoring", 10_000)));
    cart.totalCents();
    assertTrue(true);
}

@Test
void totalIsPositive() {
    Cart cart = cartWith(List.of(item("Refactoring", 10_000)));
    assertTrue(cart.totalCents() > 0);
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="cpp" role="tabpanel" markdown="1">
```cpp
TEST_CASE("total") {
    Cart cart = cartWith({ item("Refactoring", 10'000) });
    cart.totalCents();
    REQUIRE(true);
}

TEST_CASE("total is positive") {
    Cart cart = cartWith({ item("Refactoring", 10'000) });
    REQUIRE(cart.totalCents() > 0);
}
```
  </div>

  <div class="inline-language-panel is-active" data-language-panel="python" role="tabpanel" markdown="1">
```python
def test_total():
    cart = cart_with(items=[item("Refactoring", price_cents=10_000)])
    cart.total_cents()
    assert True


def test_total_is_positive():
    cart = cart_with(items=[item("Refactoring", price_cents=10_000)])
    assert cart.total_cents() > 0
```
  </div>

  <div class="inline-language-panel" data-language-panel="ts" role="tabpanel" markdown="1">
```typescript
import { ok } from "node:assert/strict";
import test from "node:test";

test("total", () => {
  const cart = cartWith({
    items: [item("Refactoring", { priceCents: 10000 })],
  });
  cart.totalCents();
  ok(true);
});

test("total is positive", () => {
  const cart = cartWith({
    items: [item("Refactoring", { priceCents: 10000 })],
  });
  ok(cart.totalCents() > 0);
});
```
  </div>
</div>

The first test has no oracle. The second would pass if the system returned almost any positive wrong answer. A stronger test names the exact behavior:

<div class="inline-language-switcher" data-language-switcher data-default-language="python">
  <div class="inline-language-tabs" role="tablist" aria-label="Strong assertion code language">
    <button type="button" role="tab" data-language-option="python" aria-selected="true">Python</button>
    <button type="button" role="tab" data-language-option="java" aria-selected="false">Java</button>
    <button type="button" role="tab" data-language-option="cpp" aria-selected="false">C++</button>
    <button type="button" role="tab" data-language-option="ts" aria-selected="false">TypeScript (Node.js)</button>
  </div>

  <div class="inline-language-panel" data-language-panel="java" role="tabpanel" markdown="1">
```java
@Test
void totalSumsItemPricesInCents() {
    Cart cart = cartWith(List.of(
        item("Refactoring", 10_000),
        item("Working Effectively", 12_500)
    ));

    assertEquals(22_500, cart.totalCents());
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="cpp" role="tabpanel" markdown="1">
```cpp
TEST_CASE("total sums item prices in cents") {
    Cart cart = cartWith({
        item("Refactoring", 10'000),
        item("Working Effectively", 12'500)
    });

    REQUIRE(cart.totalCents() == 22'500);
}
```
  </div>

  <div class="inline-language-panel is-active" data-language-panel="python" role="tabpanel" markdown="1">
```python
def test_total_sums_item_prices_in_cents():
    cart = cart_with(
        items=[
            item("Refactoring", price_cents=10_000),
            item("Working Effectively", price_cents=12_500),
        ]
    )

    assert cart.total_cents() == 22_500
```
  </div>

  <div class="inline-language-panel" data-language-panel="ts" role="tabpanel" markdown="1">
```typescript
import { strictEqual } from "node:assert/strict";
import test from "node:test";

test("total sums item prices in cents", () => {
  const cart = cartWith({
    items: [
      item("Refactoring", { priceCents: 10000 }),
      item("Working Effectively", { priceCents: 12500 }),
    ],
  });

  strictEqual(cart.totalCents(), 22500);
});
```
  </div>
</div>

When exact answers are hard to know, do not give up on oracles. Use partial oracles, metamorphic relationships, or properties. For example, sorting twice should produce the same result as sorting once; adding an item to a cart should not decrease the subtotal unless the domain explicitly allows credits. The oracle problem is real, but it is a reason to think harder about observable properties, not a reason to write vague tests {% cite Weyuker1982 Barr2015Oracle ClaessenHughes2000QuickCheck %}.

# Choose Inputs Systematically

Happy-path examples are necessary but not enough. For each behavior, ask what input classes matter:

* **Representative valid values:** the normal case.
* **Boundaries:** empty, one, many; minimum, maximum, just below, just above.
* **Invalid values:** malformed input, missing fields, out-of-range values.
* **Exceptional states:** unavailable dependency, duplicate request, permission failure.
* **Regression examples:** inputs that once broke the system.

Coverage can help find missed code, but it cannot tell you whether these behavioral classes were chosen well. Empirical work shows that coverage is not a strong standalone proxy for effectiveness {% cite InozemtsevaHolmes2014Coverage %}.

# Keep Tests Independent and Deterministic

Each test should be able to run alone, in any order, repeatedly. If a test depends on wall-clock time, global state, execution order, random data, or a live network service, make that dependency explicit and controlled.

Common repairs:

* Freeze or inject the clock.
* Seed or replace randomness.
* Use temporary directories and fresh databases.
* Reset shared state after each test.
* Replace external services with controlled fakes for fast tests.
* Wait for observable conditions instead of sleeping for fixed time.

Flaky tests are not a minor nuisance. They undermine regression testing because developers can no longer treat a failure as reliable evidence {% cite Luo2014Flaky %}.

# Prefer One Behavior, Not One Assertion

"One assertion per test" is too rigid. A single behavior may need several assertions to describe one coherent outcome. The better rule is **one reason to fail**.

This is cohesive:

<div class="inline-language-switcher" data-language-switcher data-default-language="python">
  <div class="inline-language-tabs" role="tablist" aria-label="Cohesive checkout test code language">
    <button type="button" role="tab" data-language-option="python" aria-selected="true">Python</button>
    <button type="button" role="tab" data-language-option="java" aria-selected="false">Java</button>
    <button type="button" role="tab" data-language-option="cpp" aria-selected="false">C++</button>
    <button type="button" role="tab" data-language-option="ts" aria-selected="false">TypeScript (Node.js)</button>
  </div>

  <div class="inline-language-panel" data-language-panel="java" role="tabpanel" markdown="1">
```java
@Test
void checkoutRecordsSuccessfulPayment() {
    Receipt receipt = checkout(
        cartWith(List.of(item("Book", 2_000))),
        "tok_ok"
    );

    assertEquals("paid", receipt.status());
    assertEquals(2_000, receipt.totalCents());
    assertNotNull(receipt.confirmationId());
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="cpp" role="tabpanel" markdown="1">
```cpp
TEST_CASE("checkout records successful payment") {
    Receipt receipt = checkout(
        cartWith({ item("Book", 2'000) }),
        "tok_ok"
    );

    REQUIRE(receipt.status == "paid");
    REQUIRE(receipt.totalCents == 2'000);
    REQUIRE_FALSE(receipt.confirmationId.empty());
}
```
  </div>

  <div class="inline-language-panel is-active" data-language-panel="python" role="tabpanel" markdown="1">
```python
def test_checkout_records_successful_payment():
    receipt = checkout(cart_with(items=[item("Book", 2_000)]), payment_token="tok_ok")

    assert receipt.status == "paid"
    assert receipt.total_cents == 2_000
    assert receipt.confirmation_id is not None
```
  </div>

  <div class="inline-language-panel" data-language-panel="ts" role="tabpanel" markdown="1">
```typescript
import { ok, strictEqual } from "node:assert/strict";
import test from "node:test";

test("checkout records successful payment", () => {
  const receipt = checkout(
    cartWith({ items: [item("Book", { priceCents: 2000 })] }),
    { paymentToken: "tok_ok" }
  );

  strictEqual(receipt.status, "paid");
  strictEqual(receipt.totalCents, 2000);
  ok(receipt.confirmationId);
});
```
  </div>
</div>

This is too broad:

<div class="inline-language-switcher" data-language-switcher data-default-language="python">
  <div class="inline-language-tabs" role="tablist" aria-label="Broad checkout test code language">
    <button type="button" role="tab" data-language-option="python" aria-selected="true">Python</button>
    <button type="button" role="tab" data-language-option="java" aria-selected="false">Java</button>
    <button type="button" role="tab" data-language-option="cpp" aria-selected="false">C++</button>
    <button type="button" role="tab" data-language-option="ts" aria-selected="false">TypeScript (Node.js)</button>
  </div>

  <div class="inline-language-panel" data-language-panel="java" role="tabpanel" markdown="1">
```java
@Test
void checkoutEverything() {
    assertEquals("paid", checkout(validCart(), "tok_ok").status());
    assertEquals("rejected", checkout(emptyCart(), "tok_ok").status());
    assertEquals("failed", checkout(validCart(), "tok_declined").status());
    assertTrue(checkout(validCart(), "tok_ok").sendsEmail());
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="cpp" role="tabpanel" markdown="1">
```cpp
TEST_CASE("checkout everything") {
    REQUIRE(checkout(validCart(), "tok_ok").status == "paid");
    REQUIRE(checkout(emptyCart(), "tok_ok").status == "rejected");
    REQUIRE(checkout(validCart(), "tok_declined").status == "failed");
    REQUIRE(checkout(validCart(), "tok_ok").sendsEmail);
}
```
  </div>

  <div class="inline-language-panel is-active" data-language-panel="python" role="tabpanel" markdown="1">
```python
def test_checkout_everything():
    assert checkout(valid_cart(), "tok_ok").status == "paid"
    assert checkout(empty_cart(), "tok_ok").status == "rejected"
    assert checkout(valid_cart(), "tok_declined").status == "failed"
    assert checkout(valid_cart(), "tok_ok").sends_email is True
```
  </div>

  <div class="inline-language-panel" data-language-panel="ts" role="tabpanel" markdown="1">
```typescript
import { strictEqual } from "node:assert/strict";
import test from "node:test";

test("checkout everything", () => {
  strictEqual(checkout(validCart(), { paymentToken: "tok_ok" }).status, "paid");
  strictEqual(checkout(emptyCart(), { paymentToken: "tok_ok" }).status, "rejected");
  strictEqual(checkout(validCart(), { paymentToken: "tok_declined" }).status, "failed");
  strictEqual(checkout(validCart(), { paymentToken: "tok_ok" }).sendsEmail, true);
});
```
  </div>
</div>

When a broad test fails, the failure does not teach enough. Split it by behavior.

# Test Public Contracts, Not Private Machinery

Tests that mirror implementation details become brittle. If refactoring a private helper breaks many tests while user-visible behavior is unchanged, the tests are over-coupled to the design.

Prefer assertions at stable boundaries:

* Return values.
* Public object state.
* Persisted records visible through the repository/API.
* Messages sent to real collaborators at architectural boundaries.
* Domain events or logs when those are part of the contract.

Interaction checks are useful when the interaction itself is the behavior, such as "send exactly one receipt email after payment succeeds". They are harmful when they merely freeze how the current implementation happens to collaborate internally. Use the [Test Doubles](/SEBook/testing/testdoubles.html) vocabulary to distinguish stubs, spies, and mocks before reaching for a mock by habit.

# Refactor Tests Too

Test suites decay when every new test copies a large setup block. Refactor test code with the same seriousness as production code. The classic test-smell literature calls out problems such as excessive setup, eager tests, assertion roulette, and mystery guests {% cite vanDeursen2001RefactoringTestCode %}; empirical work finds that test smells can hurt comprehension and maintenance {% cite Bavota2015TestSmells %}.

Good helper extraction follows one rule: hide noise, not intent.

<div class="inline-language-switcher" data-language-switcher data-default-language="python">
  <div class="inline-language-tabs" role="tablist" aria-label="Helper extraction test code language">
    <button type="button" role="tab" data-language-option="python" aria-selected="true">Python</button>
    <button type="button" role="tab" data-language-option="java" aria-selected="false">Java</button>
    <button type="button" role="tab" data-language-option="cpp" aria-selected="false">C++</button>
    <button type="button" role="tab" data-language-option="ts" aria-selected="false">TypeScript (Node.js)</button>
  </div>

  <div class="inline-language-panel" data-language-panel="java" role="tabpanel" markdown="1">
```java
@Test
void freeShippingStartsAtFiftyDollars() {
    Cart cart = cartWith(List.of(item("Shoes", 5_000)));

    assertEquals(0, shippingCostCents(cart));
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="cpp" role="tabpanel" markdown="1">
```cpp
TEST_CASE("free shipping starts at fifty dollars") {
    Cart cart = cartWith({ item("Shoes", 5'000) });

    REQUIRE(shippingCostCents(cart) == 0);
}
```
  </div>

  <div class="inline-language-panel is-active" data-language-panel="python" role="tabpanel" markdown="1">
```python
def test_free_shipping_starts_at_fifty_dollars():
    cart = cart_with(items=[item("Shoes", price_cents=5_000)])

    assert shipping_cost_cents(cart) == 0
```
  </div>

  <div class="inline-language-panel" data-language-panel="ts" role="tabpanel" markdown="1">
```typescript
import { strictEqual } from "node:assert/strict";
import test from "node:test";

test("free shipping starts at fifty dollars", () => {
  const cart = cartWith({
    items: [item("Shoes", { priceCents: 5000 })],
  });

  strictEqual(shippingCostCents(cart), 0);
});
```
  </div>
</div>

The cart-building helper is useful because the test still reveals the important data: one item priced at fifty dollars. A vague helper such as `standard_cart()` or `standardCart()` would be weaker if readers had to jump elsewhere to discover why the threshold is met.

# Use TDD as a Rhythm

Test-driven development is most helpful when it keeps feedback small:

1. Write down a short list of behaviors.
2. Pick the smallest next behavior.
3. Write a test that fails for the right reason.
4. Write the smallest code that passes.
5. Refactor code and tests while staying green.
6. Repeat.

Beck's original TDD text emphasizes tiny steps and refactoring after green {% cite Beck2002TDD %}. Industrial case studies found large reductions in pre-release defect density in teams using TDD, with an initial development-time increase {% cite Nagappan2008TDD %}. Later process research complicates the slogan: Fucci et al. found quality and productivity were primarily associated with fine granularity and uniform rhythm, not simply with test-first ordering {% cite Fucci2017TDD %}. Qualitative work also shows that developers often skip refactoring, even though refactoring is where much of TDD's design value lives {% cite Romano2017TDD %}.

So the teaching point is not "chant red-green-refactor". The point is: make one behavioral claim, get fast feedback, improve the design, and keep the suite trustworthy.

# A Short Checklist

Before you commit a test, ask:

* Would this test fail if the behavior were broken?
* Does the name say the behavior, not the implementation?
* Is the setup as small as possible?
* Is the assertion specific enough to diagnose failure?
* Did you include boundary and invalid cases where they matter?
* Can this test run alone and in any order?
* Would a reasonable refactoring leave the test intact?
* If this test failed next month, would the failure message help?

If the answer is "no", improve the test before trusting the green bar.
