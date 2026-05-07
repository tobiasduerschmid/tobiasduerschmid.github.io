# JavaScript & TypeScript — language-specific traps and idioms

> Companion to `clean-code.md`, `design-principles.md`, and `refactoring.md`. The other references describe principles that hold in every language; this one is the **JavaScript-and-TypeScript translation layer**, plus the JS-specific traps that the principles alone do not warn you about.

Read this whenever you are about to write or edit any `.js`, `.mjs`, `.cjs`, `.jsx`, `.ts`, or `.tsx` file — *especially* when working with `this`, async code, modules, mutable state, or framework code (React/Vue/Svelte/Angular). Synthesised from Ryan McDermott's *clean-code-javascript*, the Airbnb and Google JS style guides, MDN, *You Don't Know JS* (Simpson), the TypeScript handbook, and the typescript-eslint and eslint-plugin-import rule catalogs.

## Table of contents

1. [Why JavaScript needs its own reference](#why-javascript-needs-its-own-reference)
2. [Variables and scope](#variables-and-scope)
3. [Functions, `this`, and arrow functions](#functions-this-and-arrow-functions)
4. [Equality, coercion, and types](#equality-coercion-and-types)
5. [Mutation and immutability](#mutation-and-immutability)
6. [Async/await and Promises](#asyncawait-and-promises)
7. [Modules and boundaries](#modules-and-boundaries)
8. [Functional patterns: when, and when not](#functional-patterns-when-and-when-not)
9. [TypeScript essentials](#typescript-essentials)
10. [Testing JS code](#testing-js-code)
11. [Browser / DOM / framework concerns](#browser--dom--framework-concerns)
12. [Defensive coding done badly](#defensive-coding-done-badly)
13. [Linting — the high-leverage rules](#linting--the-high-leverage-rules)

---

## Why JavaScript needs its own reference

JavaScript was designed in ten days, accreted through three decades, and now powers more code in production than any other language. The result is a language whose surface looks like Java but whose semantics are full of historically-conditioned traps — silent type coercion, three different scoping rules, function-context that changes with the call site, and an asynchronous model retrofitted twice (callbacks, then Promises, then `async/await`). Most of the maintainability principles in the other references apply unchanged. But a JS-only set of pitfalls causes specific bugs that no amount of "small functions, good names, separate concerns" will prevent unless you also know about them.

The principles below are organised by where each one bites readers and maintainers, with cross-references to the language-agnostic references. If a row in the SKILL.md trigger table sent you here for a language-agnostic reason (e.g. "this function is too long"), read the relevant clean-code/refactoring section *first*; this file is for the JS-specific overlay.

---

## Variables and scope

**`const` by default; `let` when you must reassign; never `var`.** This is not a stylistic preference — `var` is function-scoped and hoisted as `undefined`, which is a different language than `let`/`const`. The classic broken example:

```js
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i));   // prints 3, 3, 3
}
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i));   // prints 0, 1, 2
}
```

`let`/`const` are block-scoped and live in a *Temporal Dead Zone* until their declaration line — accessing them before that line throws a `ReferenceError`, which is the helpful behaviour. `var`'s `undefined` masks the bug.

**`const` does not mean immutable.** It means the *binding* cannot be reassigned. `const arr = []; arr.push(1)` is perfectly legal. People are surprised by this often enough that "`const` makes it immutable" is the most common JS misconception in code review. If you need real immutability, see [Mutation and immutability](#mutation-and-immutability).

**Hoisting still bites function expressions.** A `function foo()` *declaration* is fully hoisted (callable above the line). A `var foo = function () {}` or `const foo = function () {}` is not — calling `foo()` above the line is a `TypeError` (var) or `ReferenceError` (const). When in doubt, declare before use, top-down.

---

## Functions, `this`, and arrow functions

`this` is JavaScript's single biggest paper cut. In a regular function, `this` is determined by *the call site*, not the definition site:

```js
const obj = { name: "x", greet() { return this.name; } };
obj.greet();           // "x" — `this` is obj
const f = obj.greet;
f();                   // undefined.name → TypeError (strict mode) — `this` is undefined
[obj].forEach(o => o.greet());          // works
[obj].forEach(obj.greet);               // breaks — receiver is the array element passed positionally
```

**Arrow functions capture `this` lexically.** They have no own `this`, no `arguments`, cannot be used with `new`, and ignore `.call/.apply/.bind` for `this`. Use them whenever you want the surrounding `this` (callbacks inside methods, event handlers in classes via class-field syntax). Use a regular function whenever the function *is* a method or constructor — the receiver-as-`this` is the point.

**Class methods passed as callbacks lose `this` unless bound.** Three idiomatic fixes, in order of preference:

```js
class Btn {
  // 1. Class-field arrow — `this` is captured at instance construction
  handleClick = () => { this.fire(); };

  // 2. Wrap at call site — explicit, no per-instance memory cost
  bind() { el.addEventListener("click", () => this.handleClick()); }

  // 3. Bind in constructor — older pattern, more boilerplate
  constructor() { this.handleClick = this.handleClick.bind(this); }
}
```

**Forgetting `new` on a constructor function** is a classic source of pollution: `function User(name) { this.name = name }` called as `User("Bob")` sets `this` to `globalThis` (or throws in strict mode) and silently leaks `name` onto the global object. ES6 `class` syntax throws `TypeError: Class constructor User cannot be invoked without 'new'`, which is one of the reasons to prefer it.

**Default parameters beat short-circuit defaults.** `function fn(name = "Bob")` is correct; `name = name || "Bob"` is broken because `||` triggers on every falsy value — including `0`, `""`, `false`, `null`. The whole point of `0` in a count or `""` in a title is that it's a *valid* value the caller passed. Default-parameter syntax only fires for `undefined`, which is the actual contract. (See also [`??` vs `||`](#defensive-coding-done-badly).)

**Destructure parameter objects** to fake named arguments:

```js
// Long parameter list — see clean-code.md "Functions"
createMenu(title, body, buttonText, cancellable);

// Destructured options object — readable at the call site, defaults inline
function createMenu({ title, body, buttonText = "OK", cancellable = false }) { … }
createMenu({ title: "Save?", body: "Unsaved changes", cancellable: true });
```

This is the JS substitute for Python's keyword arguments — without it, function calls with 4+ booleans become unreadable.

---

## Equality, coercion, and types

**`===` and `!==`, never `==` and `!=`.** The single permitted exception is `x == null`, which is the idiomatic way to test "null *or* undefined" in one expression. Every other coercion comparison is a maintenance hazard:

```js
0   == "";    // true
0   == false; // true
""  == false; // true
[]  == false; // true
[]  == ![];   // true (yes, really)
null == undefined; // true — the only useful case
```

**`typeof null === "object"`.** Always. So `typeof x === "object"` does not test "x is an object". For null, write `x === null` (or `x == null` for either-null-or-undefined). For arrays, `Array.isArray(x)` — never `x instanceof Array`, which breaks across realms (iframes, worker boundaries).

**`Array.prototype.sort()` is lexicographic by default.** `[10, 1, 2].sort()` returns `[1, 10, 2]`. This is one of the most common silent bugs in JS. Always pass a comparator:

```js
arr.sort((a, b) => a - b);             // ascending numeric
arr.sort((a, b) => a.name.localeCompare(b.name));   // human-readable string sort
```

**`JSON.stringify` silently destroys types.** `Date`s become ISO strings (and don't round-trip through `parse`). `Map`, `Set`, `WeakMap` become `{}`. `BigInt` throws. `undefined`, functions, and symbols are dropped from objects and become `null` in arrays. `Infinity` and `NaN` become `null`. Class instances lose their prototype.

If your boundary is JSON, validate at the boundary with a schema library (Zod, valibot, ajv) — don't let "JSON object that maybe has the right keys" propagate into the domain.

**Floating-point is IEEE 754 doubles.** `0.1 + 0.2 === 0.3` is `false`; integers above `Number.MAX_SAFE_INTEGER` (2⁵³ − 1) silently lose precision. For 64-bit IDs from databases, use `BigInt` or string serialisation. For monetary calculations, use minor units (cents, pence) or a decimal library.

---

## Mutation and immutability

**Mutating a parameter is action-at-a-distance.** JS passes objects and arrays by reference. `function addId(user) { user.id = 1; }` quietly modifies the caller's object — a bug that does not show up until two unrelated tests share a fixture. Either clone (`{ ...user, id: 1 }`) or name the mutation in the function name (`assignIdInPlace(user)`). The lint rule `no-param-reassign` with `{ props: true }` enforces this.

**Spread is shallow.** `{ ...obj }` and `[...arr]` clone one level. Nested objects are still shared:

```js
const a = { tags: ["x"] };
const b = { ...a };
b.tags.push("y");      // mutates a.tags too — both are still ["x", "y"]
```

For deep clones use `structuredClone(obj)` (built in to modern Node and browsers; doesn't handle functions or DOM nodes, but handles Map/Set/Date/RegExp/typed arrays). Avoid `JSON.parse(JSON.stringify(...))` — it has all the type-loss issues from the previous section.

**`Object.assign(target, source)` mutates `target`.** Always pass a fresh object: `Object.assign({}, a, b)`. Better: prefer `{ ...a, ...b }` everywhere, which makes mutation impossible by syntax.

**Real immutability options.** `Object.freeze(obj)` is shallow — nested objects are still mutable, and in non-strict mode mutations silently succeed (the failure is invisible). For deep structural sharing, use Immer (write "mutating" code on a draft, get a frozen output) — it's the standard inside Redux Toolkit and is the lowest-friction way to keep React/Redux state immutable without writing nested spreads.

**Mutating React/Vue state in place is poison.** `props.items.push(x)` does not trigger re-render and corrupts the parent. Always replace: `setItems([...items, x])` or use the framework's reducer/composable. This is one of the most common bug classes in framework code and is caught by `react/no-direct-mutation-state` and similar.

---

## Async/await and Promises

This is where most subtle JS bugs live, because the language's two execution models (sync and microtask-queue async) leak into each other.

**Always await — or explicitly return — every Promise.** A Promise that escapes without `await`, `.then`, or `.catch` is a *floating Promise*: if it rejects, the rejection becomes an `unhandledRejection` event that crashes Node by default in modern versions. The rule that catches this is `@typescript-eslint/no-floating-promises` — turn it on and resolve every warning.

```js
// Wrong — fire-and-forget. If save() rejects, the user sees no error,
// the function returns immediately, the test passes.
function onSave() { save(); }

// Right — await it, propagate failure
async function onSave() { await save(); }

// Also right — if you genuinely don't care, mark it so reviewers know
function onSave() { void save(); }
```

**`async function` returns a Promise.** `if (validate(x)) { … }` where `validate` is async is *always* truthy — Promises are objects. The lint rule `@typescript-eslint/no-misused-promises` catches passing async functions to APIs that expect sync (`useEffect(async () => …)`, `array.filter(async pred)`, etc.).

**Loops with `await` run serially.** This is sometimes what you want (rate-limited API), sometimes not (independent fetches that could parallelise):

```js
// Serial — N round trips
for (const id of ids) {
  results.push(await fetchOne(id));
}

// Parallel — one round-trip's worth of latency
const results = await Promise.all(ids.map(fetchOne));

// Parallel, don't fail-fast
const settled = await Promise.allSettled(ids.map(fetchOne));
```

**`forEach` ignores async returns.** `arr.forEach(async x => await save(x))` does not wait for the saves; the function returns immediately and the saves continue in the background. Use `for…of` with `await`, or `Promise.all(arr.map(...))`.

**`try/catch` only catches what you `await`.** `try { return fetchSomething() } catch (e) { … }` does *not* catch a rejection — the catch sees only the synchronous throw of trying to *call* `fetchSomething`. Either `await` the result or chain `.catch`.

**The async-constructor problem.** `class Foo { async constructor() {} }` is a syntax error — constructors can't be async. The idiom is a static factory:

```js
class Repository {
  private constructor(private db) {}
  static async open(url) {
    const db = await Database.connect(url);
    return new Repository(db);
  }
}
```

This is a contract change for callers (`new Repository()` becomes `await Repository.open()`), so introduce it deliberately, not on autopilot.

**Don't wrap an existing Promise in `new Promise`.** `new Promise(res => fetch(url).then(res))` adds a layer that swallows rejections. Just `return fetch(url)`. The explicit Promise constructor is for adapting a callback API; if you already have a Promise, return it.

**Cancellation via `AbortController`.** Long-running async work without cancellation leaks. `fetch(url, { signal: ctrl.signal })`, then `ctrl.abort()` when the user navigates away or the React component unmounts. In `useEffect`, return a cleanup that calls `abort()`.

---

## Modules and boundaries

**Prefer named exports over default exports.** Default exports break refactor (the importer picks any name, so renaming the original doesn't propagate), break grep (imports may use any local name), and confuse re-exports. Named exports keep the symbol's identity stable across the codebase. The rule `import/no-default-export` enforces this. The historical exception is React components (frameworks expect a default export from page files in some routers), but inside a library, named is the safer default.

**ESM and CommonJS interop is full of sharp edges.** A package shipped as CJS can be imported from ESM, but only the default export comes through cleanly; named imports may fail with "Named export not found". The simplest survival strategy: pick one (ESM for new code) and stay there.

**Circular imports are a smell.** In CJS, the second module to load sees a partially-populated exports object; in ESM, the access throws TDZ. The fix is almost never "make the dependency lazy" (which papers over the cycle); it is to identify which module owns the shared concept and move the type/value there. Lint with `import/no-cycle`.

**Barrel files (`index.js` re-exports) are tempting and almost always wrong.** They introduce circular dependencies, defeat tree-shaking unless every re-exported module is side-effect-free, and obscure where things actually live. Re-export at *package* boundaries (the public API of a library); inside a package, import from the source file.

---

## Functional patterns: when, and when not

`map`, `filter`, `reduce`, `flatMap`, `find`, `some`, `every` are first-class and well-supported. Prefer them when the operation is genuinely a transformation; the resulting code reads as a pipeline of intent rather than a bookkeeping loop.

But: a `reduce` that takes a mental compiler to read is worse than an explicit `for…of`. Kent C. Dodds's heuristic is the right one — *if the reduce is harder to read than the for, write the for*. The same applies to currying, `pipe`/`compose`, point-free style: use them when they shorten the code *and* make the intent clearer; do not use them as a virtue signal.

**`for…of` wins** when you need: early termination (`break`), `await` inside the loop (don't use `forEach`), or accumulating into an external sink with a name that's clearer than "reduce". `for…in` is for object keys but iterates the prototype chain — prefer `Object.keys`/`entries`.

**Pure functions are the cheap maintainability win.** A function that takes inputs, returns outputs, and reads/writes nothing else is the easiest thing in software to test, refactor, parallelise, and reason about. The natural shape of utility code is a layer of pure functions plus a thin shell that owns the I/O. (Cross-reference: this is the JS expression of the Dependency Rule from `architecture.md` — pure logic in the centre, I/O at the edges.)

---

## TypeScript essentials

If the file ends in `.ts` or `.tsx`, the principles below dominate the JS-only ones — most JS traps are caught at compile time *if you let the compiler help*.

**Turn on `strict` in `tsconfig.json`.** Without `"strict": true`, most of TypeScript's value evaporates. This single flag enables `strictNullChecks` (forces you to handle `null`/`undefined`), `noImplicitAny` (refuses untyped parameters), `strictFunctionTypes`, and others. Add `"noUncheckedIndexedAccess": true` so `arr[i]` is typed `T | undefined` — the standard config silently lies and types it as `T`.

**Ban `any`. Use `unknown` instead.** `any` is contagious — every value derived from an `any` is `any`, which silently disables checking through long chains. `unknown` forces the consumer to narrow before use, which is the actual contract anyway. Treat every `any` as a code smell that needs a comment justifying it (and aim to delete it). Treat every `as` cast the same way: `as` is an escape hatch where you tell the compiler "trust me", and every one is a bug waiting to happen — grep for `as ` is a maintainability audit.

**Discriminated unions make impossible states unrepresentable.** Instead of `{ loading: bool, data?: T, error?: Error }` (which allows nonsense like `{ loading: true, data: x, error: e }`):

```ts
type State<T> =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; data: T }
  | { kind: "err"; error: Error };
```

Combined with `switch (state.kind)` and a `never`-typed default, the compiler becomes an exhaustiveness checker — adding a new variant fails every consumer that needs updating.

**Branded types prevent string-soup mistakes.** `function transfer(from: UserId, to: UserId)` taking two raw strings cannot tell that the call `transfer(productId, userId)` is wrong. Branding lifts the distinction into the type system:

```ts
type UserId    = string & { readonly __brand: "UserId" };
type ProductId = string & { readonly __brand: "ProductId" };
function asUserId(s: string): UserId { /* validate */ return s as UserId; }
```

Now `transfer(productId, userId)` is a compile error.

**`satisfies` (TS 4.9+) keeps literal types narrow.** `const cfg: Config = {...}` widens; `const cfg = {...} satisfies Config` validates the shape but preserves the literal types — so consumers can rely on `cfg.kind === "user"` narrowing to a specific variant.

**Prefer narrowing (`typeof`, `in`, custom predicates) over `as`.** A `value is User` predicate that the compiler has to verify is safer than `value as User`, which the compiler accepts on faith.

---

## Testing JS code

**Module mocks (`jest.mock`, `vi.mock`) are convenient and global.** They hijack the module registry; one bad test leaks across the suite. Prefer dependency injection — pass the dependency as an argument — so tests can supply a fake without globally rewriting modules. (See `clean-code.md` § Tests, and the Dependency Inversion principle in `design-principles.md`.)

**Fake timers leak across tests.** `vi.useFakeTimers()` / `jest.useFakeTimers()` must be paired with `useRealTimers()` in `afterEach`, or the next test inherits frozen time and fails for unrelated reasons.

**Async tests must `await` every Promise.** Returning a Promise from a test is fine; firing a Promise without awaiting is the same floating-Promise bug as in production code, except now the test passes regardless of whether the assertion held.

**Don't test framework internals.** A test that asserts on the structure of a React component tree, the exact CSS classes a Vue component renders, or the private fields of a Redux store is testing implementation. Test through the *user-visible* behaviour (Testing Library's `getByRole`, `getByText`) and the test survives every refactor that doesn't change behaviour.

---

## Browser / DOM / framework concerns

**`element.innerHTML = userInput` is XSS.** Use `textContent` for text. If you must accept HTML, sanitise with DOMPurify. The same applies to `dangerouslySetInnerHTML` in React — every use is a security review item.

**Event listeners must be removable.** Anonymous inline handlers (`el.addEventListener("click", () => …)`) cannot be removed, which leaks memory in long-lived pages and double-fires when components remount. Two patterns:

```js
// Keep the handler reference
const onClick = () => handle();
el.addEventListener("click", onClick);
el.removeEventListener("click", onClick);

// Or use AbortController for one-shot cleanup of a whole group
const ctrl = new AbortController();
el.addEventListener("click",  onClick,  { signal: ctrl.signal });
el.addEventListener("keydown", onKey,    { signal: ctrl.signal });
ctrl.abort();   // removes both
```

The `AbortController` pattern is the cleanest answer for React `useEffect` cleanups — one `abort()` cancels in-flight `fetch` calls and removes every listener that subscribed to the signal.

**Business logic does not live in UI components.** A React component receives data, renders it, and forwards events. Logic — eligibility rules, pricing, transformation — lives in pure functions or framework-agnostic stores (custom hooks, composables, services). The test for this: if you replaced React with Vue tomorrow, how much code would you have to rewrite? If the answer is "most of the codebase", logic has bled into the view layer (this is the same Dependency Rule violation as a domain importing the ORM — see `architecture.md`).

---

## Defensive coding done badly

The general rule from `clean-code.md` (validate at the boundary, trust inside) holds in JS. But JS has its own defensive idioms that look helpful and aren't:

**`if (typeof x === "undefined")` everywhere** is paranoia. If `x` is a function parameter, it's the caller's responsibility to provide it; in TypeScript, the type already says so. Validate at the system boundary (HTTP handler, queue consumer, file parser) with a schema library and trust the types after that.

**`?.` (optional chaining) misuse.** `user?.name` is right when `user` is legitimately optional. `obj?.foo?.bar?.baz?.qux` is usually wrong — by the time four `?.`s deep, the null masks the bug, and you don't know which level was missing. If the data shape is supposed to be nested and present, validate it once at the entry and stop nullable-propagating internally. The lint rule `@typescript-eslint/no-unnecessary-condition` flags `?.` on values the type system says are always defined.

**`??` vs `||`.** They look similar and are not. `x ?? d` returns `d` only when `x` is `null` or `undefined`. `x || d` returns `d` for every falsy value — `0`, `""`, `false`, `NaN`. `const port = config.port || 3000` overrides an explicit `0`, which is a bug; `const port = config.port ?? 3000` is correct. Default to `??` and use `||` only when "any falsy" is genuinely the contract.

**Empty `catch` blocks.** `try { … } catch {}` silently swallows every failure and is the JS twin of Python's `except: pass`. Either you can recover (handle the specific error class), or you can't (let it propagate). Logging a swallowed error is *not* recovery — it just delays the bug to the next layer.

---

## Linting — the high-leverage rules

The rules below catch real bugs (not style). Turn them on, fail CI on warnings, and resolve every one — not by sprinkling `eslint-disable`, but by fixing the underlying issue. Cross-reference: this is the JS expression of `clean-code.md` § Tests as first-class code — the linter is part of the test suite.

| Rule | What it catches |
|---|---|
| `eqeqeq` | `==` instead of `===` (silent coercion bugs) |
| `no-var` / `prefer-const` | `var` (function-scoped, hoisted as undefined) and unnecessary `let` |
| `no-shadow` | Inner-scope variable hides outer one (silent renaming bug) |
| `no-param-reassign` (`{ props: true }`) | Mutating function parameters (action-at-a-distance) |
| `consistent-return` | A function sometimes returns, sometimes doesn't |
| `no-unused-vars` (and TS variant) | Dead code from incomplete refactor |
| `@typescript-eslint/no-floating-promises` | Unawaited Promise (the biggest bug-catcher in async code) |
| `@typescript-eslint/no-misused-promises` | Async function passed where sync expected (`useEffect(async)`, `if(asyncFn())`) |
| `@typescript-eslint/no-unnecessary-condition` | `?.` on always-defined values (hiding bugs) |
| `@typescript-eslint/no-explicit-any` | `any` is contagious; flag every use |
| `import/no-cycle` | Circular imports |
| `import/no-default-export` | Default exports break refactor and grep |
| `react-hooks/exhaustive-deps` | Stale closures in React effects (the most common React bug) |

A practical starting config: `eslint:recommended` + `@typescript-eslint/recommended-type-checked` + `eslint-plugin-import` recommended + `eslint-config-prettier` to disable stylistic rules so Prettier formats and ESLint focuses on correctness.

---

## Cross-references

- For the language-agnostic principles these traps are special cases of: [`clean-code.md`](clean-code.md), [`design-principles.md`](design-principles.md).
- For *which* refactoring to apply once you've spotted the smell: [`refactoring.md`](refactoring.md).
- For the dependency-direction question (domain vs framework, business logic vs UI): [`architecture.md`](architecture.md).
- For the pause-before-changing-code protocol: [`decision-protocol.md`](decision-protocol.md).
