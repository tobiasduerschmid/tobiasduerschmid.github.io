---
name: test-design
description: >-
  Project rule that every test you write, edit, restructure, or delete must capture **the spec** of the system under test — no less, no more — and stay green under any reasonable internal refactor. USE THIS SKILL EVERY SINGLE TIME you create, modify, review, or remove anything that lives in a test file or that is reached by a test runner — any `*.spec.js` / `*.spec.ts` / `*.test.js` / `*.test.ts` / `test_*.py` / `*_test.py` / `*Test.java` / `*Tests.cs` / `*.t` / `*.feature` (Cucumber/Gherkin) / `*.spec.cjs` / `*.spec.mjs` / `*.spec.tsx` under `tests/`, `spec/`, `__tests__/`, `cypress/e2e/`, `playwright/`, or `e2e/`; any function/method named `test`, `it`, `describe`, `context`, `specify`, `expect`, `def test_*`, `@Test`, `@ParameterizedTest`, `[Test]`, `[Fact]`, `[Theory]`, `[TestMethod]`, or any `assert` / `assertEquals` / `assertThat` / `should` / `expect(...)` / `chai.expect(...)` / `pytest.approx` / `pytest.raises` call site; any test fixture (`@pytest.fixture`, `beforeEach`, `before(...)`, `setUp`, `@BeforeEach`, `@BeforeAll`, `conftest.py`, `factory_boy`, `Faker`); any test double (`unittest.mock`, `jest.mock`, `vi.mock`, `sinon.spy`, `sinon.stub`, `Mockito`, `Moq`, `MagicMock`, `Mock()`, `@patch`, `monkeypatch`, `fakeredis`, `nock`, `msw`); any Playwright / Cypress / Selenium / WebdriverIO interaction (`page.goto`, `page.locator`, `page.getByRole`, `page.getByText`, `page.getByLabel`, `cy.get`, `cy.visit`, `expect.poll`, `await expect(...).toHaveText(...)`, `await expect(...).toBeVisible()`); any property-based test (`hypothesis`, `fast-check`, `QuickCheck`, `jqwik`, `Hedgehog`); any snapshot assertion (`toMatchSnapshot`, `toMatchInlineSnapshot`, `__snapshots__/`); any mutation-testing config (`stryker.conf`, `pitest`, `mutmut`, `cosmic-ray`); any CI test config (`playwright.config.js`, `jest.config.js`, `pytest.ini`, `pyproject.toml [tool.pytest]`, `vitest.config.ts`, `karma.conf.js`); any test helper / page object / fixture builder; any change to test selection, ordering, parallelism, retries, timeouts, sleeps, or wait helpers. Trigger on requests like "add a test for X", "write tests", "fix this flaky test", "the test is failing — make it pass", "improve test coverage", "add an assertion", "refactor these tests", "this test broke after my change", "mock the X service", "stub the clock", "verify this is called", "speed up the test suite", "this test is brittle", "tighten this assertion", "loosen this assertion", "review my tests", "is this a good test", "the snapshot needs updating", "skip this test for now", "expand the regression suite", or any task whose output ends up under `tests/` or `spec/`. The job of a test is to give **trustworthy evidence** about a behavior the user, the spec, or a stakeholder cares about — *not* to lock down the current implementation, *not* to drive coverage numbers up, and *not* to satisfy "we have a test for that". A test that breaks under a clean internal refactor is a *brittle* test (false negative for behavior, false positive for the suite). A test that passes when the function is broken is a *liar* test. Both are bugs in the test, not the code. The grounding for this skill comes from the SEBook chapters [`SEBook/testing/testquality.md`](../../../SEBook/testing/testquality.md), [`SEBook/testing/goodtests.md`](../../../SEBook/testing/goodtests.md), [`SEBook/testing/testdoubles.md`](../../../SEBook/testing/testdoubles.md), [`SEBook/testing/tdd.md`](../../../SEBook/testing/tdd.md), [`SEBook/quality_attributes/testability.md`](../../../SEBook/quality_attributes/testability.md), and the in-browser tutorials `_data/tutorials/testing-foundations.yml`, `_data/tutorials/test-doubles.yml`, `_data/tutorials/tdd.yml` — augmented with insights from Meszaros (xUnit Test Patterns), Beck (TDD), Fowler (test pyramid, contract testing), Martin (Clean Code ch. 9 — F.I.R.S.T.), Inozemtseva & Holmes (coverage ≠ effectiveness), Just et al. (mutation–real-fault correlation), Luo et al. (flaky-test taxonomy), Kent C. Dodds (testing implementation details), Hyrum's Law (all observable behavior is contracted), and the Google Testing Blog. This is not optional advice — a brittle suite is worse than no suite, because it punishes correct refactors and trains the team to ignore the red bar.
---

# Test Design

> *A test suite is good when it gives trustworthy evidence about the behaviors and risks that matter. That is a stronger standard than "the tests pass" or "coverage is high".* — [`SEBook/testing/testquality.md`](../../../SEBook/testing/testquality.md)

> *The more your tests resemble the way your software is used, the more confidence they can give you.* — Kent C. Dodds, *Testing Implementation Details*

> *A test is not just input plus execution. It also needs an oracle: a way to decide whether the observed behavior is correct.* — Weyuker (1982), via [`SEBook/testing/testquality.md`](../../../SEBook/testing/testquality.md)

## Why this skill exists

Tests have one job: **be trustworthy evidence about a behavior someone cares about**. The two ways a test can fail at this job have nothing to do with whether it currently passes:

1. **The test passes when the system is broken** — a *liar test*. The assertion is too weak, the input doesn't probe the partition, the mock returns whatever the assertion expects, or the test is tautological. A regression ships and the green bar lied.
2. **The test fails when the system is correct** — a *brittle test*. A pure internal refactor (rename a private field, swap a sort algorithm, inline a helper, add a non-spec field to a returned dict) leaves user-visible behavior unchanged but breaks the test for the wrong reason. The team learns to "just update the test" — and when a real bug shows up they update through it, too.

Brittle and liar tests are *bugs in the test*, not in the code. Both reduce the suite's signal-to-noise ratio. Over time, both train developers to mistrust the bar — and a mistrusted bar is functionally identical to no bar at all. {% cite Luo2014Flaky %} found that flaky tests damage the social contract of testing; the same is true of every kind of false positive and false negative.

This skill is the project rule for staying out of both failure modes. It applies to **every test you write or change** — Playwright `*.spec.js` end-to-end tests, Jest unit tests, pytest backend tests, mutation tests, property-based tests, snapshot tests, contract tests. The framework changes; the design discipline does not.

## The five principles

These are the load-bearing ideas. Almost every concrete rule below is an instance of one of them.

### 1. Test behavior, not implementation

A test is implementation-coupled when it would break under a refactor that preserves observable behavior — a rename of a private field, an algorithm swap (bubble → quick), a helper inlined or split, a new internal collaborator added. The classic diagnosis from [`SEBook/testing/goodtests.md`](../../../SEBook/testing/goodtests.md): *"if refactoring a private helper breaks many tests while user-visible behavior is unchanged, the tests are over-coupled to the design."*

The **refactoring litmus test**: would a pure internal refactor leave this test green? If not, it is asserting on the wrong thing.

Concrete cues that you are about to write an implementation-coupled test:

- The test reaches into a leading-underscore attribute (`obj._tracks`, `service._cache`), a private method, or an internal data structure. *Use the public API the spec exposes — `obj.titles()` not `obj._tracks[0].title`.* If the spec needs you to observe internal state, add a public read accessor and assert through that.
- The assertion mentions a private helper by name (`spy_filter.assert_called_once()` for an internal function). Mock at architectural boundaries — HTTP, DB, clock, queue — not at every internal function call edge inside your own module.
- The test asserts on a CSS class name, internal `data-*` attribute, internal route shape, or DOM tree shape that is not part of the user-facing or accessibility-tree contract. Prefer accessible-name and role assertions (see the Playwright section below).
- The test diffs an entire returned object when the spec only mandates some fields. Field-by-field equality on spec-mandated fields beats `==` on the whole dict whenever the producer might add internal/analytical fields later.

The two failure modes to internalize: a test that is too coupled to implementation produces *false negatives* under refactoring (the test fails when the code is fine) **and** can produce *false positives* when the implementation is wrong but the assertion checks the wrong thing. Kent C. Dodds frames this as the two reasons to avoid implementation details: tests break when they should not, and tests do not break when they should.

### 2. The oracle's job is "exactly the spec — no less, no more"

A test is `setup + action + oracle`. The **oracle** is the assertion that decides pass/fail. Choose its strength deliberately:

- **Too weak** (a *liar oracle*): `assert result is not None`, `assert isinstance(result, dict)`, `assert "name" in result`, `assert result.total > 0`, `assert spy.calls.length >= 0`. These pass for almost any wrong implementation. The test reports green and verifies almost nothing.
- **Too strong** (an *over-specified oracle*): `assert result == {entire dict including timestamps and internal IDs}`, `assert log_lines == [exact strings the SUT happens to emit today]`, `assert spy.calls == [(user_id, gold, request_id_uuid, timestamp_ns)]`. These break on every harmless change — adding an unrelated field, reformatting a log message, switching a UUID library — and train the team to "just update the assertion".
- **Goldilocks**: `assert result == 22_500`, `assert receipt.status == "paid"`, `assert spy.calls == [("u1", 100)]`. Pin the spec, ignore the rest. From [`SEBook/testing/goodtests.md`](../../../SEBook/testing/goodtests.md): *"weak assertions let broken behavior slip through … strong oracles win up to a ceiling — the spec."*

The right oracle sits *exactly on the spec*. Strong is not always better; it has a ceiling. Anything beyond that ceiling is brittleness in disguise.

```
weak oracle    --|-- right oracle (the spec) --|--    over-specified
(misses bugs)              (catches bugs,                (breaks on
                            survives refactors)        clean refactors)
```

When you cannot articulate an exact value oracle (the function is non-deterministic, the output space is huge, or the right answer is "any element of a set"), do not silently fall back to `is not None`. Reach for one of the named alternatives — exception oracle, state oracle, interaction oracle (with a Goldilocks tuple), property oracle for an invariant, metamorphic oracle (`f(g(x))` should equal `h(f(x))`). The oracle problem {% cite Weyuker1982 %} is real, but it is a reason to think harder, not a reason to write vague tests.

### 3. Pick inputs systematically — partitions, then boundaries

These are two independent dimensions of test design (see [`_data/tutorials/testing-foundations.yml`](../../../_data/tutorials/testing-foundations.yml) Step 5):

- **Equivalence partitioning** — group inputs that should produce *the same kind of behavior* (categorical: `"student" / "family" / other`; numeric: `< 0 / 0 / 1..N / overflow`). One representative per partition for the *middle*. Skipping a partition is how production bugs ship green.
- **Boundary value analysis** — at every transition between partitions on an *ordered* domain, pin the just-below value and the just-at / just-above value. Off-by-one bugs (`>` vs `>=`, `<` vs `<=`) live exclusively at the boundary. Quartile sampling does not catch them.

A test can have a strong oracle on a useless input (`is not None` on the boundary), or a weak oracle on a great input (`assert result == 9000` on the middle of a partition). **The whole goal is the cross-product**: meaningful input + spec-pinning oracle. Evaluate each axis separately when you write a new test.

Categories of inputs to consider for any non-trivial behavior:

- Representative valid values (the normal case).
- Boundaries: empty / one / many; minimum / maximum / just-below / just-above.
- Invalid values: malformed input, missing fields, out-of-range values.
- Exceptional states: unavailable dependency, duplicate request, permission failure, partial / corrupted data.
- Regression examples: inputs that once broke the system. *Every escaped bug should add a regression test that would have caught it.*

[Coverage tools](https://web.dev/articles/ta-strategies) are useful for finding code paths you forgot — they are not useful as a quality target. {% cite InozemtsevaHolmes2014Coverage %} found coverage has only low-to-moderate correlation with test-suite effectiveness once suite size is controlled. **Use coverage as a map, not a grade.**

### 4. Determinism is non-negotiable

A test that "sometimes passes" is functionally equivalent to no test — developers learn to rerun, and a real failure gets dismissed as "flake". {% cite Luo2014Flaky %} catalogued the recurring causes; every one of them is a controllable design issue, not bad luck:

| Source of non-determinism | What to do |
|---|---|
| Wall clock (`Date.now()`, `datetime.now()`, `time.time()`) | Inject a clock; in tests, freeze it. Never compare against `today` from the OS. |
| Randomness (`Math.random`, `random.choice`, UUIDs) | Seed the RNG, or inject the random source. Don't assert on uuids — assert that *some* id was generated. |
| Network / external services (HTTP, payment gateways, GDS) | Stub at the architectural boundary; in CI fast tests, never let a real socket open. |
| File system / global cwd / environment | Use temporary directories and explicit env. Tests must not leak state to disk that subsequent tests read. |
| Shared in-memory state (singletons, class-level caches, module globals) | Reset between tests, or restructure the production code so the state is per-instance. |
| Test order dependence (test B passes only after test A) | Each test must run alone. If it doesn't, the dependency is a test-suite bug, not a feature. |
| Concurrency / async (race between SUT and oracle) | Wait on **observable conditions**, not on `sleep(...)`. Playwright's `expect.poll(...)`, `expect(locator).toHaveText(...)`, and built-in auto-waiting beat any fixed timeout. |
| DOM rendering delays (React, Next.js hydration) | Same as above — assert on the visible state with auto-retrying matchers. |
| Unstable selectors (CSS classes that change on rebuild, generated IDs) | Select by role + accessible name (see Playwright section). |

Empirical research finds that ~45% of flaky tests come from async/timing, ~20% from concurrency, ~12% from order dependence — **every flaky test has a deterministic root cause**. The fix is always to remove the assumption, never to add a retry loop.

### 5. The right number of test doubles is sometimes zero

A test double (Dummy / Stub / Spy / Mock / Fake — Meszaros' taxonomy in [`SEBook/testing/testdoubles.md`](../../../SEBook/testing/testdoubles.md)) is a *tool you reach for when a real collaborator would make the test flaky, slow, or unable to verify the right thing.* It is **not a default**. It is **not a sign of professionalism**. It is **not a coverage strategy**.

Decide *before* writing the test:

```
What does the SUT actually depend on?
├── Pure function (input → output, no I/O, no clock, no state) → no double. Just call it.
├── Calls a clock / random / HTTP / DB / queue (slow / flaky / unavailable):
│   ├── You need to control the input it receives → Stub
│   ├── You need to verify a fire-and-forget outbound call → Spy or Mock
│   └── It's a stateful round-trip across many calls → Fake (e.g. in-memory DB)
└── Third-party library you don't own → wrap it in an Adapter; double the Adapter, not the third-party.
```

Two project-level antipatterns to recognize on sight:

- **Over-mocking.** Every internal helper is mocked; the test asserts only on the mocks. From [`_data/tutorials/test-doubles.yml`](../../../_data/tutorials/test-doubles.yml) Step 6: *"Mocks should sit at architectural boundaries (HTTP, DB, clock, notifier) — not at every internal helper."* The hard line is between *your module's internals* and *the unpredictable world*. Mocking across the former couples the test to choreography; mocking across the latter is the whole point.
- **Tautological mocks.** The mock is configured to return X, the SUT returns whatever the mock returned, the test asserts X. The whole loop never touches production logic. Same shape as a Liar test — green, verifies nothing.

If reaching for a mock feels obligatory, ask: *can I rewrite the production code so the SUT receives a value or a function instead of looking it up?* Dependency injection at construction or call time turns most mocks into a one-line stub or removes them entirely.

## The two dimensions of test design

A good test gets **both** of these right:

```
DIMENSION 1 — input choice           DIMENSION 2 — oracle strength
(what to feed the SUT)               (how to decide pass/fail)

  representative          boundary       weak (liar)        right (spec)        over-specified
  middle of partition     just-above    `is not None`      `== expected`       `== full internal struct`
  invalid                 just-below    `isinstance(...)`   custom matcher
  empty / zero            transition    `> 0`               property holds
                                        `len >= 0`
```

A weak oracle on a boundary input still passes when the boundary bug ships. A strong oracle on a useless input (the middle of one partition) misses the four bugs at the partition transitions. **Evaluate each axis explicitly when you write a test.**

## Strong oracles by return shape

The framework changes; the rule does not — *pin exactly what the spec says, no more, no less*. This table lists the canonical strong-oracle form for the most common return types in this codebase.

| If the function… | Reach for… |
|---|---|
| Returns a primitive (int, string, bool) | `assert result == expected` (exact value). For booleans, `is True` / `is False` is even tighter — only `True` itself satisfies it. |
| Returns a float computed by arithmetic | `assert result == pytest.approx(expected)` / `expect(result).toBeCloseTo(expected)` — `==` is fine for terminating decimals but bites on `0.1 + 0.2`. |
| Returns a dict / object with multiple fields | Field-by-field on **spec-mandated** fields only. Don't full-equality the whole object unless the spec promises *exactly* that shape (rare). Adding a non-spec analytics field shouldn't break tests. |
| Returns a list (order matters) | `assert result == [a, b, c]`. |
| Returns a list (order independent) | `assert sorted(result) == sorted(expected)` or `assert set(result) == set(expected)`. Don't pin an order the spec doesn't promise. |
| Should raise an exception | `pytest.raises(SpecificError, match="msg substring")` / `expect(() => fn()).toThrow(/msg/)`. Pin the *type* and a stable substring of the message; do not pin the full stack trace. |
| Returns `None` and mutates collaborator (fire-and-forget) | Spy or Mock. Pin the call: `spy.calls == [(spec_arg_1, spec_arg_2)]` — not the timestamp, not the request id, not the metadata blob. |
| Returns `None` and mutates own state | Public-API state oracle: `obj.observable_property == expected` after the call, never `obj._private == ...`. |
| Has an invariant that should hold for many inputs | Property-based test: `for any input in domain, predicate(f(input))`. Use `hypothesis` (Python) or `fast-check` (JS). |
| Has no exact oracle (output is "any valid X") | Metamorphic oracle: relate two runs (e.g., sorting twice equals sorting once; serializing then deserializing yields the original; adding then removing leaves total unchanged). |
| Renders user-visible UI | `expect(page.getByRole(...)).toHaveText(...)` / `toBeVisible()`. Assert what a user would see, not what the DOM tree happens to be today. |

## Test smell catalog — when to STOP and rewrite

These are the conditions under which "just shipping the test" is the wrong move. The catalog draws on Meszaros' *xUnit Test Patterns* {% cite Meszaros2007 %}, van Deursen et al.'s test-smell taxonomy {% cite vanDeursen2001RefactoringTestCode %}, Bavota et al.'s empirical work {% cite Bavota2015TestSmells %}, and the SEBook chapters above. When you notice any of these in code you wrote or are reviewing, pause and rewrite.

| Smell | What it looks like | Why it's a bug | Fix |
|---|---|---|---|
| **Liar test / weak oracle** | `assert result is not None`, `assert len(spy.calls) >= 0`, `assert isinstance(result, dict)` | Passes for almost any wrong implementation. Falsely green. | Pin an exact value or property the spec mandates. |
| **Tautological test** | Mock returns `X`; assertion checks `X`; SUT just passes through. | The loop never touches production logic. | Either test the production logic without a mock, or fix the assertion to check what the *production code does to the mock's return value*. |
| **Over-specified oracle** | `assert returned_dict == {whole dict including internal/timestamp fields}`, `assert spy.calls == [(arg, timestamp, request_id, metadata)]` | Breaks on harmless refactors that touch non-spec fields. | Field-by-field on spec-mandated fields only. Drop the rest. |
| **Brittle / implementation-coupled test** | `obj._tracks[0].title`, `service._cache.invalidate.assert_called()`, `page.locator('.btn-primary-v2-large')` | Pure refactors break the test. False alarms train the team to ignore the bar. | Test through the public API. For UI, prefer `getByRole` + accessible name over CSS classes. |
| **Mystery Guest** | The test loads `data/orders.csv` from disk, or hits a remote service, without making the dependency visible. | A reader can't tell what the test depends on. The dependency may also be flaky. | Build the fixture in the test (or a clearly-named factory) so the test reads as a self-contained spec. |
| **Excessive Setup** | 40 lines of Arrange before a single Assert. | The *production code* is signaling too many dependencies. *Hiding* the setup in a `setup_world()` helper makes it worse. | Listen to the signal — refactor the production code to reduce coupling. Then the test shrinks naturally. |
| **Eager test** | One test method exercises five unrelated production methods and asserts on all of them. | When it fails, you don't know which behavior broke. One reason to fail per test is a much better rule than one assertion per test. | Split by behavior. Multiple asserts that describe *one coherent outcome* are fine. |
| **Assertion Roulette** | Many bare `assert`s with no context, no message, in a long test. When one fails, the message is "AssertionError" with no clue which behavior broke. | Empirically, this is the most common test smell {% cite Bavota2015TestSmells %}. | Either split into per-behavior tests, or use assertion messages / matchers that name the behavior. |
| **Conditional Test Logic** | `if`/`for`/`try` *inside* the test method, gating which assertion runs. | Two tests masquerading as one; failure mode is invisible until both branches break. | Split into two tests, one per branch. |
| **Magic Number / String** | `assert result == 1729` with no explanation of where 1729 came from. | The next maintainer can't tell whether to update it on a refactor or treat it as a bug. | Compute the expected value in the test from the spec inputs (`assert price * 0.5 == half_off_price`), or name the constant. |
| **Liar comment** | The test name says one thing, the assertion checks another. | The reader trusts the name; the bug ships through the gap. | Rename the test to match what it actually checks, or fix the assertion to match the name. The two must agree. |
| **Over-mocked test** | Every internal helper of the SUT is patched; the test asserts only on canned return values. | Verifies orchestration, not behavior. Renaming an internal breaks the test. | Mock at architectural boundaries only. Internal helpers belong to the SUT's own module — leave them real. |
| **Mocking what you don't own** | `@patch('requests.get')` scattered across 30 test files. | Tests break when `requests` ships a new version. The mock surface is unstable. | Wrap the third-party in an Adapter your code owns; mock the Adapter. |
| **Snapshot dump as the only assertion** | `expect(largeOutput).toMatchSnapshot()` and nothing else. | A reader can't tell which property of the output the test guards. Updates are mindless. | Use snapshots as a *complement* to targeted assertions — never as a substitute. Keep snapshots small (< ~20 lines) and exclude dynamic content. |
| **Sleep-based wait** | `time.sleep(2)` / `await page.waitForTimeout(2000)` before the assertion. | Either too short (flake) or too long (slow suite). Always wrong. | Wait on an *observable condition*: `expect(locator).toHaveText(...)` / `expect.poll(...)` / `await waitFor(() => ...)`. |
| **Disabled / skipped without an issue link** | `@pytest.mark.skip("flaky")` or `test.skip(...)` with no follow-up. | Skipped tests rot. The "we'll fix it later" never happens. | Either fix the test now, delete it, or link to the tracking issue and a date by which it has to come back green. |
| **Test that depends on local time zone** | `datetime.now().date()`, `Date.toLocaleString()` without a fixed locale. | Passes in PT, fails in UTC, fails in CET. Classic CI flake. | Use UTC everywhere. Inject the locale if locale-aware behavior is the spec. |
| **Tautological regression** | A test added solely to push coverage up, asserting nothing the spec mandates. | Wastes time, gives false confidence. | Either delete, or add a real spec the test pins. |

When a test fails, the failure should *teach* — name the behavior, name the input, name the difference between expected and actual. If the failure message is "AssertionError" with no context, the test is also a documentation bug.

## Project-specific guidance — Playwright tests in this repo

> 📘 **Deep dive: [`references/playwright.md`](references/playwright.md).** When you are about to write or change a Playwright test, read the full Playwright reference — it covers locator hierarchy, auto-waiting, web-first assertions, test isolation, network mocking, visual regression, console-error oracles, soft assertions, the Playwright-specific smell catalog, and the audit checklist for reviewing e2e tests. The summary below is the load-bearing minimum; the reference is the working manual.

> ⚠️ **The existing `tests/*.spec.js` files predate this skill.** They were written before these principles were codified and many of them exhibit the smells described below — CSS-class selectors instead of `getByRole`, DOM-tree-coupled locators, `page.evaluate(...)` reaching into internal state, etc. **Do not treat existing tests as templates.** When you touch one, evaluate it against the rules below and fix what you broke or what you're inheriting; don't imitate it. The principles in this skill, not the existing test corpus, are the source of truth.

Most of the tests in `tests/*.spec.js` are Playwright end-to-end tests against the built site. Two project-specific consequences:

**Selector strategy — match how a real user perceives the page, not how the markup happens to be wired today.**

| Prefer | Avoid |
|---|---|
| `page.getByRole('button', { name: 'Save' })` | `page.locator('button.save-btn-primary')` |
| `page.getByLabel('Email address')` | `page.locator('input[name="email"]')` |
| `page.getByText('Welcome, Tobias')` (when the text is the spec) | `page.locator('.greeting span:nth-child(2)')` |
| `page.getByTestId(...)` for elements without a natural role | `page.locator('div > div > .target')` |

`getByRole` doubles as an accessibility check (it fails if the element has no accessible name) and survives layout refactors. `getByLabel` ties the test to the visible form label, which is also part of the spec because the WCAG skill mandates labeled controls. The `wcag-aa-compliance` and `light-dark-mode` skills depend on this — when a test asserts via role/label, it indirectly verifies that the element *has* a role and a label, which is an a11y win.

Reach for `getByTestId` only when no role/label/text is appropriate (e.g. a decorative container the test must scroll into view). Treat `data-testid` as a stable contract; don't rename without checking which tests use it.

**Wait strategy — let Playwright auto-wait, never `waitForTimeout`.**

| Prefer | Avoid |
|---|---|
| `await expect(locator).toBeVisible()` | `await page.waitForTimeout(1000); expect(locator).toBeVisible();` |
| `await expect(locator).toHaveText(/pattern/)` | manual polling loops |
| `await expect.poll(async () => fetchState(), { message: '...' }).toBe(...)` | sleep-then-check |
| `await page.waitForLoadState('networkidle')` (sparingly) | `setTimeout` on top of a sleep |

Reach for `expect.poll(...)` only when the value can't be expressed via a built-in matcher; even then, prefer polling on a *visible* condition (a locator's text / count / attribute) over polling against `page.evaluate(...)` of internal state. Fixed sleeps are deterministic only in the sense that they are deterministically wrong: too short on a slow machine, too long on a fast one.

**Test names — name the behavior the user would notice, not the implementation step.**

| Good (behavior-named) | Bad (implementation-named) |
|---|---|
| `quiz shows correct feedback when wrong answer is selected` | `option_feedback handler runs onClick` |
| `tutorial step 3 unlocks after step 2 is completed` | `step.advance() called once` |
| `dark-mode toggle persists across page navigation` | `localStorage.setItem called with theme` |

A failing-test message should read like a one-line bug report — *exactly* the words you'd put at the top of a regression issue.

**Test scope — match the level on the test pyramid.**

The repo uses Playwright for end-to-end tests, but most behavior is also testable at lower levels (unit / integration). Prefer the lowest level that can verify the behavior:

- A formula or transformation (XP calculation, badge selection): unit-level pytest / Jest test, no browser.
- A widget's internal logic (quiz shuffle, code-editor key bindings): unit/integration test, no full page load.
- A user journey across multiple pages or widgets (open tutorial → complete step → see progress): Playwright end-to-end.

Slow Playwright suites cost CI time; over-using e2e for things a unit test could verify is the *Ice-Cream Cone Antipattern* (Fowler's inverted pyramid). When you're tempted to add a Playwright test for a pure function, write the unit test instead.

## What "done" looks like

Before declaring a test (or test edit) finished, run this self-check. It is the synthesis of *Clean Code* ch. 9 (F.I.R.S.T.: Fast, Independent, Repeatable, Self-validating, Timely), Meszaros' four-phase pattern, and the SEBook test-quality rubric.

- **Behavior named, not implementation.** The test name reads like a one-line bug report. A future reader can tell *what user-facing claim* the test guards without opening the body.
- **Spec-pinning oracle.** Every assertion checks something the spec actually mandates — no weaker, no stronger. No `is not None`. No full-equality on dicts that contain non-spec fields.
- **Refactoring litmus passed.** A pure internal refactor (rename private field, swap algorithm, inline a helper, add an internal field, restructure markup without changing accessible semantics) would leave the test green.
- **Input choice considered both axes.** A representative for each partition + the boundaries where partitions transition. For categorical domains, one test per category. For numeric ranges, just-below / just-at / just-above each boundary.
- **AAA shape.** The test has a visible Arrange (build the fixture), Act (do the one thing), Assert (check the one thing). If a teardown is needed, it's explicit. The reader can scan and see what was prepared, what happened, and what was checked.
- **Determinism: nothing the OS or the network controls.** Clocks, randomness, network, file system, locale, time zone, shared state, and execution order are all controlled inside the test. No `sleep(...)`. Waits are on observable conditions.
- **Doubles only where they earn their keep.** No mock for a pure function. Mocks at architectural boundaries, not at every internal helper. Goldilocks assertions on spy call lists — pin what the spec mandates, ignore the rest.
- **One reason to fail.** Multiple `assert`s are fine if they describe one coherent outcome. If the test could fail for two unrelated reasons, split it.
- **Self-validating.** The test produces pass / fail without manual inspection. No print statements as evidence. No "look at the screenshot."
- **Independent.** The test runs alone, in any order, repeatedly, after a clean checkout. If you sort the test files alphabetically and re-run, every test still passes.
- **Diagnostic on failure.** When this test fails next month, the failure message names the behavior, the input, and the gap between expected and actual — not just "AssertionError".
- **Smaller than the change it gates.** If the test file is larger than the production file under test, the test is doing too much (or testing the wrong layer of the pyramid).

If any check fails, the test is not done — fix it now, while the context is loaded into your head. *Cleanup later almost never happens.*

## Pyramid awareness — match the test to the question

Different levels of the pyramid answer different questions; using the wrong level is its own design smell.

- **Unit** (a pure function or a single class in isolation): for *logic correctness*. Fast (<10ms), no I/O, no clock, no DOM. Most of the suite should live here.
- **Integration** (a small group of collaborators, real where cheap, faked where slow): for *contract correctness between components*.
- **Contract** (verify a fake matches the real provider, à la Pact): for *fakes don't drift from reality*. Particularly important for service boundaries.
- **End-to-end** (Playwright, a real browser, the built site): for *user journeys cross multiple boundaries correctly*. Few of these — they're slow and they fail for many reasons.
- **Property-based** (`hypothesis`, `fast-check`): for *invariants that should hold across a large input space*. Especially good for: optimization rewrites (compare to a slow brute-force oracle), idempotency, round-trip serialize/deserialize, ordering preservation, stateful machines.
- **Mutation** (`stryker`, `pitest`, `mutmut`): for *diagnosing where the suite's assertions are too weak*. Use as a periodic audit, not a CI gate. Surviving mutants ask: is this assertion too weak? Did we forget a boundary? Is this branch dead?

Match the test to the question. A unit test cannot tell you whether two services agree on a contract; an end-to-end test cannot tell you whether your sort algorithm is `O(n log n)`; a property-based test cannot tell you whether the user can complete checkout.

## Hyrum's Law — be deliberate about what you commit to

> *With a sufficient number of users of an API, it does not matter what you promise in the contract — all observable behaviors of your system will be depended on by somebody.* — Hyrum Wright

Every assertion in your test is a public commitment that *this* observable behavior is part of the contract. Future engineers will treat it as load-bearing. Therefore: only assert on things you intend to maintain.

If a test asserts on a log line's exact wording, you have committed to that wording. If a test asserts on the order of items in a hash-map iteration, you have committed to that order. If a test asserts on a UUID's format, you have committed to that format. **Make these commitments deliberately**: pick the smallest assertion that captures the spec, and let everything else stay implementation-detail.

The corollary: when you are about to weaken an assertion (drop a field from a dict equality, switch from full-string match to substring match), ask whether the dropped property was actually part of the spec. If yes, the assertion is still needed — find a less brittle form. If no, the over-specification was the bug; weakening is the fix.

## Reference index

The deeper material — read these when you hit an edge case the table above doesn't cover:

- **[`references/playwright.md`](references/playwright.md)** — *Read first when you are about to write or change anything in `tests/*.spec.js`.* Translates each of the five principles into Playwright-specific moves: locator hierarchy (`getByRole` → `getByLabel` → … → CSS), auto-waiting and web-first assertions, test isolation across browser contexts, `page.route` mocking discipline, visual-regression brittleness traps, console-error oracles, soft assertions, the Playwright-specific smell catalog, and the e2e review checklist.
- **[`SEBook/testing/testquality.md`](../../../SEBook/testing/testquality.md)** — Oracle strength, mutation testing, fault-revealing power, flakiness, the test-quality rubric. The canonical chapter for "is this suite any good?".
- **[`SEBook/testing/goodtests.md`](../../../SEBook/testing/goodtests.md)** — Per-test recipe: AAA shape, strong assertions, systematic input selection, determinism, the short checklist before you commit. *"A good test is a small, executable claim about behavior."*
- **[`SEBook/testing/testdoubles.md`](../../../SEBook/testing/testdoubles.md)** — The Stub / Spy / Mock distinctions; controlling indirect inputs vs verifying indirect outputs; when verification happens.
- **[`SEBook/testing/tdd.md`](../../../SEBook/testing/tdd.md)** — Red-Green-Refactor as a rhythm; small steps; technical-debt management. The discipline TDD imposes on test design.
- **[`SEBook/quality_attributes/testability.md`](../../../SEBook/quality_attributes/testability.md)** — Controllability and observability; designing production code so it can be tested at all. *Often the right fix for a brittle test is in the production code.*
- **[`_data/tutorials/testing-foundations.yml`](../../../_data/tutorials/testing-foundations.yml)** — The interactive tutorial students do. The Step 3 "Liar test" pattern, Step 4 "brittle vs over-specified", Step 5 "two dimensions" diagram. Read this if you want to *see* the failure modes in compileable code.
- **[`_data/tutorials/test-doubles.yml`](../../../_data/tutorials/test-doubles.yml)** — Steps 1–6 walk the SUT-collaborator-seam pattern, the Goldilocks oracle on a spy, the over-mocking smell, and the "no double" decision.
- **External**: Meszaros, *xUnit Test Patterns* (the canonical taxonomy); Beck, *Test-Driven Development by Example*; Fowler's [practical-test-pyramid](https://martinfowler.com/articles/practical-test-pyramid.html); Kent C. Dodds' [testing-implementation-details](https://kentcdodds.com/blog/testing-implementation-details); the Google Testing Blog ["Test Behavior, Not Implementation"](https://testing.googleblog.com/2013/08/testing-on-toilet-test-behavior-not.html); Hyrum Wright's [Hyrum's Law](https://www.hyrumslaw.com/); the [Playwright best-practices](https://playwright.dev/docs/best-practices) page on `getByRole` and auto-waiting; [testsmells.org](https://testsmells.org/pages/testsmells.html) for the empirical taxonomy.

## How this skill composes with the rest of the project

- **`maintainable-code/`** — A test that is hard to write almost always points at a production-code design problem. When you are tempted to mock five collaborators, read [`maintainable-code/SKILL.md`](../maintainable-code/SKILL.md) first; the dependency-inversion fix often deletes the mocks entirely.
- **`wcag-aa-compliance/`** — Every Playwright test that uses `getByRole` or `getByLabel` is also an accessibility check. Conversely, an a11y violation will make a role-based test fail; that signal is correct, not noise.
- **`tutorial-authoring/`** — The interactive tutorials *are* tests of student understanding; they have their own validator-grader format documented separately. The principles in this skill (strong oracles, mutation-style validation, no liar tests) apply to validators too — the grader script that runs after each tutorial step *is* an oracle, and it has the same failure modes.
- **`light-dark-mode/`** — Visual regression tests and snapshot tests must not fail solely because dark mode shifted a color. If you write a screenshot test, scope it tightly and consider running it in both modes (or only one, with the other tested via CSS-property assertions).
- **`cookie-storage-tracker/`** — Tests that exercise persistence (cookies, `localStorage`, IndexedDB) must reset the store between tests, or the test order becomes load-bearing — see Determinism above.

When two skills appear to conflict (rare), the more specific project rule wins, but **document the trade-off in the change** rather than silently violating one. There is almost always a structuring choice that satisfies both.

## The summary

A test's job is **trustworthy evidence about a behavior someone cares about**. Get there by:

1. Naming the *behavior*, not the implementation.
2. Picking the *spec-pinning* oracle — no less, no more.
3. Probing each *partition* and each *boundary*.
4. Removing every source of *non-determinism* the test author controls.
5. Using a test double *only when* a real collaborator would make the test flaky, slow, or unable to verify the right thing.

Slow down. Pin the spec. Refuse the liar. Refuse the over-spec. Then ship.
