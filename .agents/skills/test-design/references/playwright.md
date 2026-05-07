# Playwright Test Design — Applying the Skill to Web E2E Tests

> Read this when you are about to add, edit, restructure, or delete anything under `tests/*.spec.js` (or any file using `@playwright/test`). The five principles in [`../SKILL.md`](../SKILL.md) are framework-agnostic; this reference translates each one into the Playwright moves that actually make a web e2e test maintainable, deterministic, and spec-pinned. End-to-end tests have an outsized failure-mode surface — they touch a real browser, a real DOM, real timing — so each principle has to be applied with framework-specific care or the tests rot fast.

> ⚠️ **The existing tests under `tests/` predate this skill and are not guaranteed exemplars.** They were written before the principles below were codified, and many of them — to be honest — exhibit the smells this reference catalogs (CSS-class selectors, DOM-tree coupling, ID-based locators that don't go through `getByRole`, `expect.poll` over `evaluate` of internal state). Do **not** use `tests/blog.spec.js`, `tests/c-tutorial.spec.js`, or any other existing spec as "this is how we do it here". Use this reference and `../SKILL.md` as the source of truth. When you touch an existing test, evaluate it against the principles below — and if it fails the refactoring litmus test or the smell catalog, fix it (within the scope of your change) rather than imitating it. When in doubt, the locator hierarchy in §1, the auto-waiting rule in §2, and the smell catalog in §10 are the rules; existing test code is just *what happens to ship today*, not what should ship.

## Why end-to-end tests need their own playbook

A unit test can be brittle in maybe three ways: weak oracle, over-specified oracle, implementation-coupled assertion. A Playwright test inherits all three **and** adds a wider attack surface: unstable selectors that lock down DOM structure rather than behavior, fixed sleeps that race with rendering, network or auth state that bleeds across tests, viewport / locale / font assumptions that flip in CI, animations and hydration delays that look like flakes, full-page screenshots that fail on every harmless layout tweak. This is the *Ice-Cream Cone Antipattern* (Fowler's inverted pyramid) waiting to happen — a wide, slow, brittle e2e layer that the team eventually starts ignoring.

The same two failure modes from [`../SKILL.md`](../SKILL.md) apply. **Liar test:** the user journey is broken, but the assertion is so weak (or so coupled to the wrong DOM node) that the suite stays green. **Brittle test:** a CSS rename, a layout reflow, an analytics field added to a button's `data-*`, or a clean a11y refactor turns the suite red without any user-visible regression. The Playwright-specific moves below are the disciplines that keep both far away.

## 1 — The locator hierarchy: match what the user perceives

Playwright's [official guidance](https://playwright.dev/docs/best-practices) is to *prioritize user-facing attributes over implementation details*. The reason is exactly the refactoring litmus test from the parent skill: a CSS class name (`btn-primary-v2`) is an implementation detail; the user perceives "a button labeled *Save*". A test that asserts on the second survives a refactor that touches the first — and breaks if and only if the user-visible behavior actually changed.

**Priority order for picking a locator** (use the highest one that fits):

| Priority | API | When it's the right tool | Why |
|---|---|---|---|
| 1 | `page.getByRole('button', { name: 'Save' })` | Any element with an ARIA role and an accessible name — buttons, links, form controls, headings, menus, tabs, dialogs, listitems | Reflects how a user *and* assistive tech perceive the element. Doubles as an a11y check (fails if no accessible name). Survives layout / class / DOM-tree refactors. |
| 2 | `page.getByLabel('Email address')` | Form controls associated with a `<label>` | Ties the test to the visible label users read. Indirectly verifies the WCAG 3.3.2 (Labels or Instructions) requirement. |
| 3 | `page.getByPlaceholder(...)` / `page.getByAltText(...)` / `page.getByTitle(...)` | Inputs, images, decorative elements with these attributes | Same logic — these are user-facing attributes. |
| 4 | `page.getByText(/Welcome, Tobias/)` | When the *text itself* is what the spec says the user sees | Strong if the text is part of the contract; brittle if the text is decorative copy that the marketing team rewords every sprint. |
| 5 | `page.getByTestId('quiz-container')` | Components without a natural role / label / text anchor (decorative containers, tutorial-framework wrappers) | Treat `data-testid` as a stable contract you own. Don't rename without grepping the test suite. |
| 6 | `page.locator('.css-class')` / `page.locator('[data-foo="bar"]')` | Last resort, only when role / label / text / testid all fail and the class is part of a *documented* component contract you can cite | Every CSS-class selector raises a yellow flag. Audit it: is the class part of a stability-guaranteed contract documented somewhere, or did someone happen to put it on the element three years ago? If you can't cite the documentation, you're coupling to an accident. |
| 7 | `page.locator('xpath=...')` / nth-child / DOM-tree selectors | Almost never | Couples the test to DOM tree shape. Any reflow or refactor breaks it. |

**Concrete cues that you picked the wrong locator:**

- The selector mentions a numeric class suffix (`.btn-large-v3`, `.modal-2`) — it will be renamed.
- The selector relies on `nth-child(2)` or `:first-child` ordering that the spec doesn't guarantee — reorder the items, the test breaks.
- The selector targets an element by index (`.locator('button').nth(4)`) when there's no semantic reason for the 4th button to be the right one — give the button a role+name and select by that.
- The selector targets a *parent* of the actual interactive element to reach for `.click()` — reach for the interactive element directly so Playwright's actionability checks fire on it.
- The selector includes `>div>div>span.text` — DOM-tree shape coupling. Refactor the production markup to give the target a role, label, or test id.

**Strict mode is your friend.** Playwright locators are strict by default — they throw if the locator matches multiple elements. Embrace this: a strict-mode failure is loud diagnostic feedback that your selector is ambiguous. Don't paper over it with `.first()` / `.nth(0)`; refine the selector.

**Project context — handle existing CSS-class selectors carefully.** The existing test suite leans heavily on class-name selectors (`.tvm-*` tutorial-widget classes, `.blog-post-item`, `.filter-btn[data-category]`, `.category-link`, etc.). These were written before this skill existed; do not assume the class is a stability contract just because a current test references it. When you encounter one:

1. **Check whether the class is documented as stable** somewhere — a CSS file with comments, an architecture doc, the include that emits the markup. If yes, you may keep using it (and add a comment in the test pointing at the documentation). If no, it's *accidental coupling* and you should replace it with `getByRole` / `getByLabel` / `getByText` / `getByTestId`.
2. **Check whether the element should have a semantic role anyway.** Tutorial widgets, blog post lists, filter buttons — most of these have natural ARIA roles (`region`, `list`, `button`). If the production markup doesn't expose them, that is *also* a [`wcag-aa-compliance`](../../wcag-aa-compliance/SKILL.md) gap; fixing the production markup makes the test better *and* the page more accessible. Often the right move is to fix both in one change.
3. **A safe diagnostic question**: would a production developer feel free to rename this class without grep-checking the test suite? If yes, it's accidental — refactor the test. If no, it should be documented as a contract — and if it isn't, the documentation gap is itself a finding worth surfacing.

Don't migrate every legacy CSS selector in unrelated tests "while you're here" (that's the *Boy-Scout-rule mis-applied* — see [`../../maintainable-code/SKILL.md`](../../maintainable-code/SKILL.md) on bundling unrelated changes). Do fix the ones in tests you're already touching for another reason.

## 2 — Auto-waiting: kill every fixed timeout

Playwright's locators come with [actionability checks](https://playwright.dev/docs/actionability) — visible, stable, enabled, receives events, editable (for `.fill`) — and **all `expect(locator).toX(...)` matchers auto-retry until the configured timeout**. This is the framework's most important affordance, and most flaky e2e tests come from people not using it.

| Use this | Don't use this | Why |
|---|---|---|
| `await expect(locator).toBeVisible()` | `await page.waitForTimeout(500); expect(await locator.isVisible()).toBe(true)` | The first auto-retries until the locator is visible (or fails clearly with the locator state at timeout). The second is the worst of all worlds — too short on slow CI, too long on fast machines, no retry. |
| `await expect(locator).toHaveText(/expected/)` | `expect(await locator.textContent()).toBe('expected')` | The first retries until the text matches; the second snapshots the text once and races with rendering. |
| `await expect(locator).toHaveCount(n)` | `expect(await page.locator(...).count()).toBe(n)` | Retries until the count converges. |
| `await expect.poll(async () => await fetchState(), { message: '…' }).toEqual(expected)` | hand-rolled `for(...) { await sleep; check }` loops | Use this for arbitrary async predicates Playwright doesn't have a built-in matcher for. Note: when polling pulls state via `page.evaluate(...)`, that's already a coupling-to-internals smell — prefer polling on a *visible* condition (a locator's text / count / attribute) whenever the state can be observed through the rendered UI. |
| `await expect(page).toHaveURL(/path/)` | `expect(page.url()).toBe('...')` | URL changes after navigation can race; the matcher waits. |
| `await page.waitForLoadState('networkidle')` (sparingly) | `await page.waitForTimeout(2000)` | Both are last-resort tools; prefer waiting on observable UI state. `networkidle` itself can flake under chatty analytics. |

**The one rule: never wait by `waitForTimeout` / `setTimeout` / `sleep`.** Every flaky-test root-cause study {% cite Luo2014Flaky %} finds async/timing as the dominant category (~45%) and every one is fixable by swapping a timeout for a wait-for-condition. (Note the distinction: `test.setTimeout(120_000)` and the `actionTimeout` in `playwright.config.js` are *bounds on how long an operation may run* — entirely different from `page.waitForTimeout(2000)`, which is "sleep for 2 seconds regardless of what's happening". The first kind is fine; the second is what this rule forbids.)

**Avoid `isVisible()` / `isEnabled()` / `isChecked()` as oracles.** These are the *non-retrying* sibling APIs of `expect(...).toBeVisible()` etc. They return a snapshot — useful for branching logic, dangerous as assertions because they don't retry. The Playwright docs explicitly call this out: *"Avoid instant assertions like `isVisible()` which return immediately without waiting."* If you need to branch (`if (await locator.isVisible()) { ... }`), that's the right tool. If you're asserting, use the matcher.

## 3 — Strong oracles in Playwright: web-first assertions

The "no less, no more" rule from the parent skill maps directly onto Playwright's web-first assertions. Every matcher below auto-retries; pick the *most specific one* that captures the spec.

| If the spec says… | Use… | Notes |
|---|---|---|
| The element is on screen | `await expect(locator).toBeVisible()` | Goldilocks for "is shown". Prefer `toHaveText` if the text is also part of the spec. |
| The element shows a specific message | `await expect(locator).toHaveText('Welcome, Tobias')` | Pin the exact string when it's stable; use a regex (`toHaveText(/Welcome,/)`) when the spec is the prefix and the rest is dynamic. |
| The element contains a string somewhere | `await expect(locator).toContainText('save')` | Looser than `toHaveText` — use when the surrounding text might add wording without changing intent. |
| The element has a value (form input) | `await expect(locator).toHaveValue('foo')` | |
| Number of matching elements | `await expect(locator).toHaveCount(3)` | Pins exactly N. |
| The element is checked / disabled / focused | `await expect(locator).toBeChecked()` / `.toBeDisabled()` / `.toBeFocused()` | Each retries; don't roll your own with `.evaluate()`. |
| ARIA / role attributes | `await expect(locator).toHaveAttribute('aria-pressed', 'true')` | Right move when the spec *is* the ARIA state (e.g. a toggle button, a tab's selection). If the visible text changes too (e.g. the button reads "Following" vs "Follow"), prefer `toHaveText`/`toHaveAccessibleName` — the user perceives the text more directly than the attribute. |
| URL after navigation | `await expect(page).toHaveURL(/\/blog\/.*\//)` | Use a regex when the spec is the path shape, not the full URL. |
| Page title | `await expect(page).toHaveTitle(/My Site/)` | |
| The element has a CSS class | `await expect(locator).toHaveClass(/active/)` | Use only when the class *is* part of the contract (e.g. an aria-equivalent visual state with no role). Otherwise prefer the role/aria-state. |

**Field-by-field over full-equality.** Just like in unit tests, when you assert on a returned object (a parsed JSON response from `page.waitForResponse`, an extracted dataset from `page.evaluate`), pin the spec-mandated fields individually rather than `toEqual({entire object including timestamps and IDs})`. Adding an analytics field to the response shouldn't break the test.

**Do not assert on transient internal state.** `page.evaluate(() => window.__internalAppState)` is the e2e equivalent of reading `obj._private` — coupling to implementation, brittle to refactors. If the spec is "the user can see X after Y", verify X through the visible UI. Reserve `page.evaluate` for *test plumbing* (reading the current scroll position, normalizing time before an assertion) — not for substantive oracles.

**The DOM tree is not the spec.** `await expect(page.locator('div.x > div.y > span')).toBeVisible()` pins the DOM hierarchy; refactors that preserve user-visible behavior will break it. The same locator written as `getByRole('region', { name: 'Search results' })` survives every reasonable markup refactor because it asserts on the *accessible structure*, which is part of the WCAG contract this site already commits to ([`../../wcag-aa-compliance/SKILL.md`](../../wcag-aa-compliance/SKILL.md)).

## 4 — Test isolation: context, storage, network, time

> *Each test should be completely isolated from another test and should run independently.* — [Playwright best-practices](https://playwright.dev/docs/best-practices)

Playwright gives every `test()` a fresh `BrowserContext` — equivalent to a fresh incognito window with empty cookies, empty `localStorage`, empty `sessionStorage`, empty cache. Use this; do not subvert it.

**Common isolation failures and fixes:**

| Failure | Fix |
|---|---|
| Test A logs a user in; test B assumes that login | Re-establish state in a `test.beforeEach`, or use Playwright's `storageState` if reusing the same auth across many tests is genuinely needed. Never rely on test order. |
| Test A writes to `localStorage` (e.g. tutorial progress); test B's assertions depend on that data | The fresh context already gives you an empty store. If your test *needs* state, set it up explicitly: `await page.evaluate(() => localStorage.setItem('key', 'val'))` *before* you navigate, or via `context.addInitScript`. |
| Test A modifies a Service Worker / cache; test B sees stale assets | Use a fresh context. If the SW persists across navigations within one test, clear it in teardown. |
| Two tests target the same backend resource and race | This is a backend-isolation problem. For a static-site repo like this, it rarely applies — but if you add tests that touch a shared API, use unique fixtures (per-test resource IDs) or mock the API. |
| Test depends on the *current* date / time / locale | Use `page.clock` (recent Playwright versions) or `await page.addInitScript(() => { Date.now = () => 1736899200000; })`. Never assert against `new Date()`. |
| Test reads `Date.toLocaleString()` without a fixed locale | Set the locale on the project (in `playwright.config.js`) or via `await context.addInitScript(...)`. CI in UTC vs PT will surface differences. |
| Test depends on `Math.random` / generated UUIDs | Stub the randomness via `addInitScript`, or change the assertion to verify the *shape* (e.g. `toMatch(/[0-9a-f-]{36}/)`) rather than the exact value. |

**`test.describe.serial` is a load-bearing decision, not a default.** This tells Playwright "run these tests in declared order, and skip the rest if any earlier one fails". It is appropriate when the test sequence *is* the user journey under test — e.g. a step-by-step tutorial where step 3 is only reachable through steps 1 and 2 — but it sacrifices independence and you should reach for it deliberately, not as a way to share setup. Two consequences to internalize:

1. A failure in step 2 cascades — you don't learn whether step 5 also broke. Either accept that or split into two `describe.serial` groups.
2. The tests must each restore enough shared state in `beforeEach` to be debuggable in isolation. Otherwise reproducing a step-5 failure means stepping through 1–4 by hand.

Use `describe.serial` only for genuine sequential journeys. For independent assertions about a feature, plain `test.describe(...)` (which lets Playwright parallelize / shard) is the right choice.

## 5 — Network mocking: only mock what you don't own

The "don't mock what you don't own" rule from [`../SKILL.md`](../SKILL.md) maps directly onto Playwright's `page.route(...)` API.

| Scenario | What to do |
|---|---|
| Testing your own server's response shape | Hit the real server. The whole point of e2e is to verify the seams between your code and your infrastructure. Mocking your own endpoints turns an e2e test into a fancier unit test. |
| Testing a UI state that depends on a third-party API (Stripe, Google Maps, a payment gateway) | Mock the third-party at the network layer with `page.route('https://api.third-party.com/**', route => route.fulfill({ ... }))`. The third-party is unstable, slow, costs money, and isn't in CI's blast radius. |
| Testing an error state (5xx, timeout, malformed response) | Mock the response — these states are typically unreachable against a healthy real server, and you need them in the suite. |
| Testing latency / slow-network behavior | Use `page.route` to delay the response with `route.continue()` after `await new Promise(r => setTimeout(r, n))`, OR use the Chromium DevTools throttling — but document why the test depends on timing. |
| Recording → replaying real third-party responses | HAR files (`page.routeFromHAR(...)`). Useful when the third-party's response is large and stable; record once, replay forever. |

**The wrap-and-mock pattern from [`../SKILL.md`](../SKILL.md) still applies.** If you find yourself sprinkling `page.route('https://stripe.com/**', ...)` across 30 test files, the integration is too tightly coupled. Have your code talk to an in-house adapter (`/api/payments/...` on your own server, which forwards to Stripe), then let the e2e tests run against the real adapter while the adapter itself is mocked at unit-test time. The blast radius of a Stripe API change drops to one file.

**Don't mock to "speed up" your own code.** If the tests are slow because the real backend is slow, the fix is in the backend (or a faster fake of the backend at your seam), not in spraying `page.route` across e2e tests. Mocked-everything e2e tests verify nothing about the seams that e2e is *for*.

## 6 — Visual regression: tighten the contract or skip the screenshot

`expect(page).toHaveScreenshot()` and `expect(locator).toHaveScreenshot()` are powerful and incredibly easy to misuse. Pixel-diff matchers are *literal* — they fail on every harmless rendering change, and the temptation is always to run `--update-snapshots` reflexively, which silently accepts unintentional regressions.

Apply the parent skill's **"no less, no more"** rule to screenshots:

| Antipattern | Why it's broken | Fix |
|---|---|---|
| `await expect(page).toHaveScreenshot()` (full page, no scoping) | Asserts on every pixel of the entire viewport — header, footer, dynamic timestamps, animations, syntax highlighting changes — none of which are usually the spec. | Scope to a locator: `await expect(page.getByRole('region', { name: '...' })).toHaveScreenshot()`. Pick the smallest region that captures the visual contract. |
| Screenshot is the *only* assertion | A reader can't tell what the screenshot is supposed to verify. Updates become mindless. | Pair the screenshot with at least one targeted text/role assertion that describes what's being checked. The screenshot is the *complement*, not the substitute. |
| Snapshot includes animations or live timers | Pixel-diffs flap on every run. | `await expect(...).toHaveScreenshot({ animations: 'disabled' })` — Playwright pauses CSS animations and freezes the time at the moment of the screenshot. |
| Snapshot includes a clock or generated ID | Same flake. | Mask the dynamic region: `toHaveScreenshot({ mask: [page.locator('.timestamp')] })`. The masked area is filled with a solid color and ignored in the diff. |
| Snapshot taken before fonts loaded | The first render uses fallback fonts, the second uses webfonts — pixel diff. | Use `await page.evaluate(() => document.fonts.ready)` before the screenshot, or set the project to wait on `'networkidle'` for that test. |
| Snapshot taken before hydration / late content | Different DOM at screenshot time vs. expected. | Wait for the observable end-of-load condition (a specific element being visible) *before* the screenshot. |
| Threshold cranked up to mask drift | "Just up the threshold to 0.5 and it'll stop flaking" — and now the test passes when 50% of pixels are wrong. | Don't. Either fix the source of drift (animations, fonts, masks), or replace the screenshot with a structural assertion. |

**For this repo specifically**, visual regression has to coexist with the dark-mode toggle ([`../../light-dark-mode/SKILL.md`](../../light-dark-mode/SKILL.md)). A screenshot baked in light mode will fail any time someone tweaks dark-mode CSS. If you add a visual test, choose one mode deliberately and document the choice — *or* take both and verify them as separate baselines. Alternatively (and usually better), express the property you actually care about as a CSS-property assertion: `await expect(locator).toHaveCSS('background-color', 'rgb(28, 37, 51)')` is more diagnostic than a pixel diff.

**The default**: don't add screenshots. Most things you'd capture in a screenshot can be expressed as text/role/CSS-property assertions, which are diagnostic on failure (the test message names the property; pixel diffs name a pixel coordinate). Reach for `toHaveScreenshot` only when the property *is* visual fidelity (a chart's rendering, a diagram's layout, a syntax-highlighter's theme), and even then, scope tightly and mask aggressively.

## 7 — Console errors and network failures as part of the oracle

A page can render the right UI while spewing JavaScript errors, 404s on critical assets, or unhandled promise rejections — and a "happy path" e2e test that only checks visible elements will report green. For a behavior the project cares about (this site's `wcag-aa-compliance` skill, plus general user-trust quality), console cleanliness *is* part of the spec.

```js
test('blog post renders cleanly', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.message));

  await page.goto('/blog/some-post/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  expect(consoleErrors, 'page must load without JS errors').toEqual([]);
});
```

Two notes:

- The accumulator pattern is a hand-rolled spy ([`../SKILL.md`](../SKILL.md) §5). Pin only the spec-mandated content (errors), not warnings/info — otherwise third-party noise (analytics, framework deprecations) makes the test brittle.
- For network failures, listen on `page.on('response', ...)` and assert that critical requests resolved 2xx. Don't assert on third-party requests — apply Hyrum's Law thinking ([`../SKILL.md`](../SKILL.md) §Hyrum) and only commit to what your spec actually mandates.

The repo provides an `a11yCheckpoint(page, label)` helper in [`tests/a11y-helpers.js`](../../../../tests/a11y-helpers.js) that runs an axe-core sweep at the call site and asserts no WCAG 2.2 AA violations. It is gated by an env flag so it's a no-op in normal runs. When you add a new interactive feature that has multiple visible states (a quiz mid-question, a tutorial step's "passed" panel, a modal open), call `a11yCheckpoint(page, 'feature-state-name')` at each state — the helper makes the a11y oracle run alongside your behavior assertions. This is the same oracle-strength move applied to a different axis: a passing-but-inaccessible state is a Liar test against the project's a11y commitment ([`../../wcag-aa-compliance/SKILL.md`](../../wcag-aa-compliance/SKILL.md)). Read [`tests/a11y-helpers.js`](../../../../tests/a11y-helpers.js) for the helper's API; do not assume any single existing spec is a model for *how* to use it.

## 8 — Soft assertions: rare, deliberate, never the default

[Playwright's `expect.soft(...)`](https://playwright.dev/docs/test-assertions#soft-assertions) records a failure but lets the test continue, gathering all violations before failing the test at the end. This contradicts the parent skill's *one reason to fail* rule on the surface — and it's the right tool exactly where that rule's underlying logic doesn't apply.

**Use `expect.soft` only for read-only, multi-element verification where the failures are independent.** Examples:

- A pre-filled form on load: assert each field's value with `expect.soft` so a single broken field doesn't hide the others.
- A table of computed values: assert each row with `expect.soft` so the test reports all the rows that are wrong, not just the first.
- An a11y sweep across a page: collect all violations, fail once with the full list.

**Don't use `expect.soft` to bundle unrelated behaviors into one test.** That's the *Eager test* smell from [`../SKILL.md`](../SKILL.md), with a softer face. If two assertions could fail for two unrelated production reasons, they belong in two tests so the failure-mode signal is preserved.

**Don't use `expect.soft` to push past flakes.** "The login button is sometimes red, sometimes blue, just `soft` it" — that's the wrong fix; remove the source of variation.

## 9 — Pyramid awareness for Playwright

Playwright is the *top* of the pyramid. From the parent skill: *prefer the lowest level that can verify the behavior*. The diagnostic question to ask before adding a Playwright test:

| Question | If yes |
|---|---|
| Is this verifying pure logic (a calculation, a transformation, a data shape)? | Move it down to a unit test (Jest / pytest / Vitest). Don't spin up a browser to verify `applyDiscount(20, 'student') === 10`. |
| Is this verifying a single component's behavior in isolation? | Move it to a component test (React Testing Library, etc., if the project introduces one). The full Jekyll build + browser context is overkill. |
| Is this verifying that *multiple things across the stack agree* (router + page + JS hydration + CSS + a11y)? | This is what e2e is for. Playwright is the right level. |
| Is this verifying a multi-page user journey (`open tutorial → solve step 1 → progress saves → reload → step 1 still shows as solved`)? | Yes — Playwright. Each step gets its own assertion; consider `describe.serial` if the steps must run in order. |
| Is this verifying responsive / multi-viewport behavior? | Yes — Playwright with `test.use({ ...devices['iPhone 13'] })` or a separate project entry in `playwright.config.js` for the target device. |
| Is this verifying accessibility properties that need rendered DOM (focus order, contrast in real CSS, screen-reader-perceivable structure)? | Yes — Playwright + axe-core. Worth its weight even though it's slow. |

The repo's e2e suite is *intentionally* heavy because most tutorial behavior — code execution in workers, debugger replay, multi-step quiz progress — only manifests in a real browser. That's correct. But every time you're tempted to add a Playwright test for "this function returns the right value", check whether a 50-ms unit test would do the same job.

## 10 — Common Playwright test smells

Apply the parent skill's smell catalog with these Playwright-specific instances:

| Smell | What it looks like in Playwright | Fix |
|---|---|---|
| **Sleep-based wait** | `await page.waitForTimeout(2000); await expect(...).toBeVisible()` | Drop the timeout — `expect(...).toBeVisible()` already waits. |
| **Implementation-coupled selector** | `page.locator('div.btn-primary-v3 > span:nth-child(2)')` | Replace with `getByRole` + accessible name, or `getByText`, or (last resort) `getByTestId` with a stable id you own. |
| **Liar oracle** | `await expect(page.locator(...)).toBeVisible()` for an element that's *always* in the DOM whether the feature works or not (`<body>`, the main app shell). | Pin the user-perceivable behavior, not the wrapper. |
| **Tautological assertion** | `await page.click('#submit'); await expect(page.locator('#submit')).toBeVisible()` (the button is always visible — clicking didn't change anything observable). | Assert on what the click was *supposed* to cause: a confirmation message, a URL change, a list update. |
| **Snapshot dump as the only oracle** | One `await expect(page).toHaveScreenshot()` and nothing else. | Pair with at least one structural assertion; tighten the screenshot scope. |
| **Eager test** | One `test()` clicks through five different features and asserts on each. | Split: one feature per test. Use `test.describe` to group. |
| **Mystery guest** | A test depends on data in `localStorage` that was set by a previous test or by a hand-rolled fixture file. | Set the state explicitly in `beforeEach` via `addInitScript` or `evaluate`. Make the dependency visible. |
| **Excessive setup** | `beforeEach` is 60 lines of navigation, click, fill, click, wait. | This is signaling that the *production code*'s entry point for this state is too deep. Either expose a deeper-link URL the test can `goto` directly, or put the state in `localStorage` via `addInitScript`. |
| **Hardcoded timeouts in matchers** | `await expect(...).toBeVisible({ timeout: 30_000 })` everywhere | A few are fine for genuinely slow operations. A pile of them across the suite is a smell — usually means production code is slow, the wait is on the wrong condition, or you're masking a real flake. Diagnose the source. |
| **Disabled animations only in some tests** | One spec disables animations, another doesn't, both touch the same component. | Set the project default in `playwright.config.js` if the suite is animation-sensitive overall, or scope to the specs that need it. Inconsistency hides bugs. |
| **Selector hidden in a helper with no documentation** | `await myHelpers.theBigButton(page).click()` and the helper picks an element by a 6-step DOM path. | Helpers are fine — even encouraged for repeated arrange logic — but they should *hide noise, not intent*. The helper name should describe the user-visible role; the selector inside should still be a `getByRole` or stable testid. |
| **Test-suite-level retries hiding flakes** | `retries: 2` in `playwright.config.js`, then everyone forgets there are flakes. | Retries are acceptable as a CI safety net (the repo has `retries: process.env.CI ? 1 : 0`), but every retry that succeeds-after-failure should produce a flake report someone reads. Don't crank it up to mask determinism bugs. |

## 11 — A/B comparing Playwright tests against the spec

Use this short audit when reviewing a Playwright test (yours or someone else's):

1. **Read the test's name out loud.** Does it describe a *user-perceivable behavior*? Or does it describe an implementation step (`"button click handler runs"`)? If the latter, rename and rethink.
2. **Read the assertions.** For each assertion, ask: *would the user notice if this assertion were wrong?* If no, the assertion is testing implementation. If yes, is it testing the *right* user-perceivable property — text, state, navigation — or is it pinning DOM tree shape?
3. **Read the locators.** For each locator, ask: *would a screen-reader user perceive this element the same way?* `getByRole` answers yes. `.locator('div.x > span:nth-child(2)')` answers no.
4. **Read the waits.** `waitForTimeout` anywhere? Replace.
5. **Read the setup.** Could the test run alone, in isolation, after a clean checkout? If it depends on test order or shared state, restructure.
6. **Read the tear-down.** Anything written outside the browser context (filesystem, env vars, shared fixtures) that the next test reads?
7. **Run the refactoring litmus test.** Imagine renaming a CSS class, restructuring the DOM, or adding an analytics field to a `data-*` attribute — would this test fail despite no user-visible change? If yes, it's coupled.
8. **Run the mutation litmus test.** Imagine the production code is broken in the smallest plausible way — would this test fail? If no, the oracle is too weak.

## 12 — The "done" checklist for a Playwright test

Before committing any change to `tests/*.spec.js`, walk this list. It's the parent skill's checklist with Playwright-specific edges.

- **Behavior-named.** The test name reads like a one-line user-facing claim (`"clicking a category badge filters the post list"`), not an implementation step.
- **Locator hierarchy respected.** Every locator uses the highest priority that fits — `getByRole` / `getByLabel` / `getByText` / `getByTestId` before raw CSS / XPath. CSS-class selectors are acceptable only when the class is a *documented, stable contract* you control (e.g. a tutorial-framework component class with documented stability) — not when it just happens to be the class on the element today. If you can't point at the documentation that promises the class is stable, treat it as accidental and reach for a higher-priority locator.
- **Auto-waiting only.** No `page.waitForTimeout`. Every wait is a web-first matcher (`toBeVisible`, `toHaveText`, `toHaveCount`, `toHaveURL`) or `expect.poll`.
- **Spec-pinning oracle.** Each assertion checks something a user or a stakeholder cares about — text, state, navigation, visible behavior. No `expect(page.locator('body')).toBeVisible()` filler. No full-DOM `toEqual` dumps. No `expect(page).toHaveScreenshot()` as the only assertion.
- **Determinism: nothing flaky.** Clocks, randomness, locale, time zone, network, viewport, fonts, animations are all controlled. CI's `retries: 1` is a safety net, not a workaround.
- **Isolation respected.** The test uses a fresh context, sets up its own state, doesn't rely on test order. `describe.serial` is used only for genuine sequential journeys, with a comment explaining why.
- **Network mocked only at boundaries you don't own.** Real backend for your own routes; mocks for third-party APIs you don't control.
- **Console clean (where it's part of the spec).** For features the project guards — tutorial pages, blog posts, SEBook chapters — assert the page loads without JS errors.
- **A11y checkpoint added if the feature has visible interactive states.** New tutorial / modal / quiz / popout? Call `a11yCheckpoint(page, 'state-name')` at each state.
- **Pyramid level matches the question.** Pure-logic verification → unit test, not Playwright. Multi-page journey → Playwright.
- **Failure message is diagnostic.** When this test fails next month, the message names the user behavior, the locator, and the gap between expected and actual.
- **Test runs alone, fast(ish), repeatedly.** `npx playwright test path/to/spec.js` works without depending on neighboring specs.

If any check fails, the test is not done — fix it now, while the context is loaded into your head. *Cleanup later almost never happens.*

## Reference and further reading

- **Parent skill**: [`../SKILL.md`](../SKILL.md) — the framework-agnostic principles every test must follow. This file is the Playwright-specific projection.
- **Playwright official docs**: [Best Practices](https://playwright.dev/docs/best-practices), [Locators](https://playwright.dev/docs/locators), [Auto-waiting](https://playwright.dev/docs/actionability), [Test Assertions](https://playwright.dev/docs/test-assertions), [Mock APIs](https://playwright.dev/docs/mock), [Visual Comparisons](https://playwright.dev/docs/test-snapshots).
- **Project infrastructure** (these are *helpers and configuration*, not example tests — read them to understand the API surface, not to copy a test style): [`tests/a11y-helpers.js`](../../../../tests/a11y-helpers.js) exposes the `a11yCheckpoint(page, label)` helper for axe-core sweeps at interactive states. [`playwright.config.js`](../../../../playwright.config.js) sets the project conventions — workers=1 (single Jekyll server), CI retries=1, action timeout 10s, the `webServer` block boots Jekyll on test start.
- **Existing test files in `tests/`**: not endorsed as exemplars. Many predate this skill. When you read or edit them, evaluate them against the principles above; if a test relies on `.css-class > div:nth-child(2)` selectors, full-DOM-text assertions, `page.evaluate(...)` for substantive oracles, or skips the locator hierarchy in §1, that's a *finding to fix in the scope of your change*, not a pattern to imitate.
- **Composes with**: [`../../wcag-aa-compliance/SKILL.md`](../../wcag-aa-compliance/SKILL.md) (every `getByRole` is also an a11y check), [`../../light-dark-mode/SKILL.md`](../../light-dark-mode/SKILL.md) (visual tests must consider both modes), [`../../cookie-storage-tracker/SKILL.md`](../../cookie-storage-tracker/SKILL.md) (tests that exercise persistence must reset state cleanly).
- **External**: Kent C. Dodds' [Testing Implementation Details](https://kentcdodds.com/blog/testing-implementation-details); the Google Testing Blog ["Test Behavior, Not Implementation"](https://testing.googleblog.com/2013/08/testing-on-toilet-test-behavior-not.html); Hyrum Wright's [Hyrum's Law](https://www.hyrumslaw.com/) on the cost of asserting on observable behavior; Luo et al. (2014), *An Empirical Analysis of Flaky Tests* — the canonical taxonomy of flake causes; Meszaros, *xUnit Test Patterns* — for the underlying double / oracle / smell vocabulary this reference uses.
