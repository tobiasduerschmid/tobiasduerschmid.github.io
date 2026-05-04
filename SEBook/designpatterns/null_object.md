---
title: Null Object Design Pattern
layout: sebook
---

# Problem

Many systems have a collaborator that is *usually* present but sometimes legitimately absent. A logging service writes to an audit log — but a guest user has no audit log. A permission service grants rights based on the user's role — but anonymous visitors have no role at all. A view in a Smalltalk MVC application uses a controller to gather user input — but a read-only view never accepts input {% cite Woolf1998 %}.

If we represent the absent collaborator with `null`, the using code drowns in defensive checks:

```java
class AccountView {
    private AuditLog auditLog;            // may be null for guests
    private Permissions permissions;      // may be null for anonymous

    void onUpdate(Change change) {
        if (auditLog != null) {
            auditLog.record(change);
        }
        if (permissions != null && permissions.canEdit()) {
            applyChange(change);
        }
        // every collaborator the view touches needs another guard
    }
}
```

Every call site has to remember the check. Forgetting one yields a `NullPointerException` (or a SIGSEGV in C++, an `AttributeError` in Python). The conditional logic obscures the actual business rule, and reviewers must verify each guard wherever the field is read.

The core problem is: **how can a client treat an absent collaborator the same way it treats a real one — without scattering null checks throughout the code, and without inventing one-off "is this thing null?" methods on every consumer?**

# Context

The Null Object pattern {% cite Woolf1998 %} applies when:

* **An object already requires a collaborator.** Null Object does not introduce the collaboration — it makes use of one that already exists. If the collaborator did not exist, you would not need a stand-in for it.
* **Some collaborator instances should legitimately *do nothing*.** The "do nothing" behavior is a real, valid, business-meaningful response — not an error or an absence of information.
* **Clients should ignore the difference between a real collaborator and a do-nothing one.** Without this requirement, there is nothing to encapsulate; clients are free to test the special case themselves.
* **The "do nothing" behavior is reusable.** Multiple clients want the same do-nothing behavior, or you expect to add more in the future.
* **All of the do-nothing logic fits in a single class.** If the collaborator's interface mixes operations that should *all* sometimes do nothing with operations that must *never* do nothing, splitting that out into one Null Object class is awkward {% cite Woolf1998 %}.

Common applications include guest users with empty permission sets, no-op loggers in test fixtures, leaf nodes returning empty iterators, no-op formatters for raw output, no-op animations when motion is disabled, and read-only controllers in MVC.

# Solution

The **Null Object pattern** introduces a class that implements the same interface as the real collaborator but whose methods do nothing meaningful — return defaults, ignore arguments, or skip work entirely. Clients call the Null Object exactly as they call a real one, and the do-nothing behavior is encapsulated in one named place.

Bobby Woolf, who first wrote up the pattern, frames the intent precisely: provide a surrogate for another object that shares the same interface but does nothing, encapsulating *how to do nothing* and hiding the details from collaborators {% cite Woolf1998 %}.

The pattern involves four roles:

1. **Client:** the object that requires a collaborator. The Client holds a reference to an `AbstractObject` and calls operations on it without knowing or caring whether the receiver is real or null.
2. **AbstractObject:** the interface (or abstract class) that declares the operations the Client expects. Both the real and null collaborators conform to this interface.
3. **RealObject:** a concrete implementation of `AbstractObject` whose operations carry out useful behavior.
4. **NullObject:** a concrete implementation of `AbstractObject` whose operations *do nothing*. Some methods may return a "null result" (an empty list, `false`, `0`, an empty string) where the interface demands a return value.

The key insight is that **absence of behavior is itself a kind of behavior**, and it deserves its own named, polymorphic implementation rather than a sentinel `null` reference scattered through call sites.

## UML Role Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
class Client {
	- collaborator: AbstractObject
	+ doWork(): void
}
abstract class AbstractObject {
	+ {abstract} request(): void
}
class RealObject {
	+ request(): void
}
class NullObject {
	+ request(): void
}
Client o--> AbstractObject : collaborator
RealObject --|> AbstractObject
NullObject --|> AbstractObject
note right of NullObject
	do nothing
end note
note right of Client.doWork
	```java
	collaborator.request();
	// no null check needed
	```
end note
@enduml'></div>

**Figure:** Client holds an `AbstractObject` reference and calls `request()` uniformly. `RealObject` performs work; `NullObject` silently does nothing. The Client has no idea which one it holds.

## UML Example Diagram

Consider an audit-logging interface. A `BankTransfer` always tries to log every transaction, but in tests we want to suppress the log output, and for internal system transfers we deliberately omit logging. Instead of guarding every call site with `if (logger != null)`, we introduce a `SilentLogger` Null Object. The `BankTransfer` calls `logger.log(...)` uniformly; the `SilentLogger` simply drops every entry on the floor.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
class BankTransfer {
	- logger: AuditLogger
	+ transfer(amount: Money, to: Account): void
}
interface AuditLogger {
	+ log(entry: String): void
	+ entries(): List<String>
}
class FileAuditLogger {
	- path: Path
	+ log(entry: String): void
	+ entries(): List<String>
}
class SilentLogger {
	+ log(entry: String): void
	+ entries(): List<String>
}
BankTransfer o--> AuditLogger : logger
FileAuditLogger ..|> AuditLogger
SilentLogger ..|> AuditLogger
note bottom of SilentLogger
	log(): do nothing
	entries(): return empty list
end note
@enduml'></div>

**Figure:** `BankTransfer` only ever sees the `AuditLogger` interface; whether the real `FileAuditLogger` or the `SilentLogger` is wired in is a configuration decision made elsewhere.

## Sequence Diagram

This sequence shows that the call site looks identical regardless of which logger is wired in. The Null Object accepts the message and returns immediately — no exception, no special case, no work performed.

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
participant client: BankTransfer
participant real: FileAuditLogger
participant nullLog: SilentLogger
client -> real: log("transfer 100 to acct 5")
activate real
real --> client
deactivate real
client -> nullLog: log("transfer 100 to acct 5")
activate nullLog
nullLog --> client
deactivate nullLog
@enduml'></div>

**Figure:** the client makes the same call in both cases. The Null Object responds by doing nothing — the design intent of "no audit trail here" is encoded in the type of the collaborator, not in a missing reference.

# Code Example

This example shows the **before** version with scattered `null` checks and the **after** version using the Null Object pattern across four languages. Notice how the call site in `BankTransfer.transfer()` gets shorter, the design intent of "no logging needed" gets a *name* (`SilentLogger`), and adding a new audit destination later does not require revisiting any guarded call site.

> **Teaching example:** These snippets are intentionally small. They show one reasonable mapping of the pattern roles, not a drop-in architecture. In production, always tailor the pattern to the concrete context: lifecycle, ownership, error handling, concurrency, dependency injection, language idioms, and team conventions.

## Before: scattered null checks

<div class="inline-language-switcher" data-language-switcher data-default-language="java">
  <div class="inline-language-tabs" role="tablist" aria-label="Null Object before-version code language">
    <button type="button" role="tab" data-language-option="java" aria-selected="true">Java</button>
    <button type="button" role="tab" data-language-option="cpp" aria-selected="false">C++</button>
    <button type="button" role="tab" data-language-option="python" aria-selected="false">Python</button>
    <button type="button" role="tab" data-language-option="ts" aria-selected="false">TypeScript</button>
  </div>

  <div class="inline-language-panel is-active" data-language-panel="java" role="tabpanel" markdown="1">
```java
final class BankTransfer {
    private final AuditLogger logger;        // may be null

    BankTransfer(AuditLogger logger) {
        this.logger = logger;
    }

    void transfer(int amount, String to) {
        if (logger != null) {                // forget this and you crash
            logger.log("transfer " + amount + " to " + to);
        }
        // ... do the actual transfer ...
    }
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="cpp" role="tabpanel" markdown="1">
```cpp
class BankTransfer {
public:
    explicit BankTransfer(AuditLogger* logger) : logger_(logger) {}

    void transfer(int amount, const std::string& to) {
        if (logger_) {                       // forget this and you crash
            logger_->log("transfer " + std::to_string(amount) + " to " + to);
        }
        // ... do the actual transfer ...
    }

private:
    AuditLogger* logger_;                    // may be nullptr
};
```
  </div>

  <div class="inline-language-panel" data-language-panel="python" role="tabpanel" markdown="1">
```python
class BankTransfer:
    def __init__(self, logger: AuditLogger | None) -> None:
        self._logger = logger                # may be None

    def transfer(self, amount: int, to: str) -> None:
        if self._logger is not None:         # forget this and you crash
            self._logger.log(f"transfer {amount} to {to}")
        # ... do the actual transfer ...
```
  </div>

  <div class="inline-language-panel" data-language-panel="ts" role="tabpanel" markdown="1">
```typescript
class BankTransfer {
  constructor(private readonly logger: AuditLogger | null) {}

  transfer(amount: number, to: string): void {
    if (this.logger !== null) {              // forget this and you crash
      this.logger.log(`transfer ${amount} to ${to}`);
    }
    // ... do the actual transfer ...
  }
}
```
  </div>
</div>

## After: Null Object

<div class="inline-language-switcher" data-language-switcher data-default-language="java">
  <div class="inline-language-tabs" role="tablist" aria-label="Null Object after-version code language">
    <button type="button" role="tab" data-language-option="java" aria-selected="true">Java</button>
    <button type="button" role="tab" data-language-option="cpp" aria-selected="false">C++</button>
    <button type="button" role="tab" data-language-option="python" aria-selected="false">Python</button>
    <button type="button" role="tab" data-language-option="ts" aria-selected="false">TypeScript</button>
  </div>

  <div class="inline-language-panel is-active" data-language-panel="java" role="tabpanel" markdown="1">
```java
import java.util.Collections;
import java.util.List;

interface AuditLogger {
    void log(String entry);
    List<String> entries();
}

final class FileAuditLogger implements AuditLogger {
    private final java.util.List<String> recorded = new java.util.ArrayList<>();

    public void log(String entry) {
        recorded.add(entry);
        // ... and persist to disk ...
    }

    public List<String> entries() {
        return List.copyOf(recorded);
    }
}

final class SilentLogger implements AuditLogger {
    static final SilentLogger INSTANCE = new SilentLogger();
    private SilentLogger() {}

    public void log(String entry) {
        // do nothing
    }

    public List<String> entries() {
        return Collections.emptyList();      // null-result return
    }
}

final class BankTransfer {
    private final AuditLogger logger;        // never null

    BankTransfer(AuditLogger logger) {
        this.logger = logger;
    }

    void transfer(int amount, String to) {
        logger.log("transfer " + amount + " to " + to);
        // ... do the actual transfer ...
    }
}

public class Demo {
    public static void main(String[] args) {
        new BankTransfer(new FileAuditLogger()).transfer(100, "acct 5");
        new BankTransfer(SilentLogger.INSTANCE).transfer(200, "acct 9");
    }
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="cpp" role="tabpanel" markdown="1">
```cpp
#include <iostream>
#include <string>
#include <vector>

struct AuditLogger {
    virtual ~AuditLogger() = default;
    virtual void log(const std::string& entry) = 0;
    virtual std::vector<std::string> entries() const = 0;
};

class FileAuditLogger : public AuditLogger {
public:
    void log(const std::string& entry) override {
        recorded_.push_back(entry);
        // ... and persist to disk ...
    }
    std::vector<std::string> entries() const override { return recorded_; }

private:
    std::vector<std::string> recorded_;
};

class SilentLogger : public AuditLogger {
public:
    static SilentLogger& instance() {
        static SilentLogger inst;
        return inst;
    }
    void log(const std::string&) override { /* do nothing */ }
    std::vector<std::string> entries() const override { return {}; }

private:
    SilentLogger() = default;
};

class BankTransfer {
public:
    explicit BankTransfer(AuditLogger& logger) : logger_(logger) {}

    void transfer(int amount, const std::string& to) {
        logger_.log("transfer " + std::to_string(amount) + " to " + to);
        // ... do the actual transfer ...
    }

private:
    AuditLogger& logger_;                    // never null
};

int main() {
    FileAuditLogger file;
    BankTransfer(file).transfer(100, "acct 5");
    BankTransfer(SilentLogger::instance()).transfer(200, "acct 9");
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="python" role="tabpanel" markdown="1">
```python
from abc import ABC, abstractmethod


class AuditLogger(ABC):
    @abstractmethod
    def log(self, entry: str) -> None:
        pass

    @abstractmethod
    def entries(self) -> list[str]:
        pass


class FileAuditLogger(AuditLogger):
    def __init__(self) -> None:
        self._recorded: list[str] = []

    def log(self, entry: str) -> None:
        self._recorded.append(entry)
        # ... and persist to disk ...

    def entries(self) -> list[str]:
        return list(self._recorded)


class SilentLogger(AuditLogger):
    """Null Object: implements AuditLogger by doing nothing."""

    def log(self, entry: str) -> None:
        pass  # do nothing

    def entries(self) -> list[str]:
        return []  # null-result return


# Stateless — share a single instance.
SILENT_LOGGER = SilentLogger()


class BankTransfer:
    def __init__(self, logger: AuditLogger) -> None:
        self._logger = logger                # never None

    def transfer(self, amount: int, to: str) -> None:
        self._logger.log(f"transfer {amount} to {to}")
        # ... do the actual transfer ...


BankTransfer(FileAuditLogger()).transfer(100, "acct 5")
BankTransfer(SILENT_LOGGER).transfer(200, "acct 9")
```
  </div>

  <div class="inline-language-panel" data-language-panel="ts" role="tabpanel" markdown="1">
```typescript
interface AuditLogger {
  log(entry: string): void;
  entries(): readonly string[];
}

class FileAuditLogger implements AuditLogger {
  private readonly recorded: string[] = [];

  log(entry: string): void {
    this.recorded.push(entry);
    // ... and persist to disk ...
  }

  entries(): readonly string[] {
    return [...this.recorded];
  }
}

class SilentLogger implements AuditLogger {
  static readonly INSTANCE = new SilentLogger();
  private constructor() {}

  log(_entry: string): void {
    /* do nothing */
  }

  entries(): readonly string[] {
    return [];                               // null-result return
  }
}

class BankTransfer {
  constructor(private readonly logger: AuditLogger) {} // never null

  transfer(amount: number, to: string): void {
    this.logger.log(`transfer ${amount} to ${to}`);
    // ... do the actual transfer ...
  }
}

new BankTransfer(new FileAuditLogger()).transfer(100, "acct 5");
new BankTransfer(SilentLogger.INSTANCE).transfer(200, "acct 9");
```
  </div>
</div>

The "after" version is shorter at the call site, harder to misuse (no forgotten guard can crash the program), and gives the do-nothing behavior a name (`SilentLogger`) that announces design intent.

# Design Decisions

## Should the Null Object be a Singleton?

A Null Object usually carries no instance data — its whole point is to *not* hold or change anything. So a single shared instance is enough; multiple instances would be indistinguishable {% cite Woolf1998 %}. Implementing it as a [Singleton](/SEBook/designpatterns/singleton.html) (or a module-level constant in Python, a `static` reference in Java/C++) avoids needless allocation and signals statelessness.

If the same `AbstractObject` interface needs many configurable Null Objects (e.g. one that always returns "0", another that always returns the empty string), use the [Flyweight](https://en.wikipedia.org/wiki/Flyweight_pattern) pattern instead — share intrinsic behavior, parameterize extrinsic state {% cite Woolf1998 %}.

## Should the Null Object be a separate class or a special instance of the Real Object?

Strict Null Object is a sibling of `RealObject` under a common `AbstractObject` interface. This adds one extra class per `AbstractObject` family. As Woolf notes, you can sometimes dodge this by making the Null Object a **special instance** of `RealObject` whose fields hold null values — for example, a Composite whose children list is empty already behaves like a leaf {% cite Woolf1998 %}.

The trade-off:

* **Separate class:** the do-nothing behavior is named, discoverable, and cannot accidentally drift toward real behavior.
* **Special instance:** fewer classes, but the "this is the null one" knowledge has to live somewhere and is easy to lose.

Prefer a separate class when the do-nothing behavior is itself a reusable concept that other parts of the codebase will benefit from naming.

## What if different clients disagree on what "do nothing" means?

If some clients want the Null Object to return `0` and others want it to throw, you don't have one Null Object — you have several {% cite Woolf1998 %}. Either model them as separate Null Object classes (one per do-nothing semantics) or parameterize a single Null Object class with the values to return. Avoid trying to force one Null Object to satisfy contradictory expectations; the resulting class becomes a thinly disguised Real Object with a "mode" field — at which point you have rebuilt the conditional logic the pattern was meant to remove.

## Null Object is not a Proxy, and does not transform into a Real Object

It is tempting to think of a Null Object as a placeholder that "will become real later". It does not {% cite Woolf1998 %}. A Null Object always does nothing; that is its single job. If your stand-in needs to transform into a real collaborator on first use, you are reaching for the [Proxy pattern](https://en.wikipedia.org/wiki/Proxy_pattern), not Null Object — Proxy controls access to a real subject and may instantiate it lazily. Null Object replaces the real subject permanently.

## Does this collaborator need a Null Object at all? (Watch for masked bugs)

The Null Object pattern silently swallows every operation it receives. That is exactly what you want when "do nothing" is a valid response — and exactly what you do *not* want when "do nothing" hides a bug. If a billing system's logger were silently a `SilentLogger` in production because of a misconfigured DI binding, you might lose months of audit trail before noticing. Mitigate this risk by:

* Logging at startup which collaborator was wired in (`"Audit logger: SilentLogger"` is conspicuous in a production log).
* Making the Null Object's name say what it does — `SilentLogger`, `NoopValidator`, `EmptyPermissions` — never `DefaultLogger`.
* Reserving Null Object for cases where do-nothing is a legitimate domain decision, not a fallback for "we couldn't construct the real one".

# Variants

## Singleton Null Object

Because Null Objects are typically stateless, the standard implementation is to expose a single shared instance — `SilentLogger.INSTANCE` in Java, a module-level constant in Python {% cite Woolf1998 %}. This is the **Singleton Null Object** compound, called out explicitly in Woolf's Implementation discussion. It saves allocations and makes it obvious that the object has no per-call identity.

## Parameterized Null Object (Flyweight Null Object)

When several Null Objects of the same type need slightly different "null results" (e.g., one returns `""`, another returns `"N/A"`), the Null Object can take constructor parameters. To avoid one class per parameter combination, share intrinsic behavior across instances and parameterize extrinsic state — the [Flyweight](https://en.wikipedia.org/wiki/Flyweight_pattern) pattern fits naturally here {% cite Woolf1998 %}.

## Null Iterator

A frequently used special case: a leaf node in a tree is asked for an iterator over its (non-existent) children, and returns a `NullIterator` whose `hasNext()` always returns `false` {% cite Gamma1995 %}. Clients iterate uniformly over leaves and composites, with no special case for "this node has no children". `Collections.emptyIterator()` in Java and `iter([])` in Python encode the same idea in standard libraries.

## Null State and Null Strategy (pattern compounds)

When the State or Strategy roles include a "do absolutely nothing" alternative, the do-nothing class is a Null Object superimposed on State or Strategy. See [Pattern Compounds](#related-patterns) below.

# Consequences

Applying the Null Object pattern yields the following consequences {% cite Woolf1998 %}:

**Benefits**

* **Client code stays simple.** Clients call the same operation regardless of which collaborator is wired in. No `if (x != null)` guards, no `Optional.ifPresent(...)` chains, no try/catch around `NullPointerException`. The call site reads as the actual business operation.
* **Do-nothing behavior is encapsulated and reusable.** The "do nothing" implementation lives in one named class. Multiple clients automatically share the same do-nothing behavior, and changing what "do nothing" means is a one-place edit.
* **Design intent is named.** A class called `SilentLogger` says what it is. A `null` reference does not. New developers reading the wiring see the design choice spelled out.
* **Defines a class hierarchy of real and null variants.** Anywhere the Client expects an `AbstractObject`, both the Real and Null variants are interchangeable — a textbook application of [Liskov substitutability](/SEBook/designprinciples/solid.html#liskov-substitution-principle-lsp).

**Liabilities**

* **Can mask real bugs.** Because the Null Object swallows operations silently, a misconfiguration that wires it in unexpectedly may go unnoticed. The `SilentLogger`-in-production risk above is real — and worse the more invisible the do-nothing behavior is.
* **Class proliferation.** Every `AbstractObject` family that needs a Null Object adds at least one more class (the Null Object itself, plus possibly the `AbstractObject` extracted just to host it) {% cite Woolf1998 %}.
* **Hard to mix do-nothing into several collaborators.** The Null Object only helps when all the do-nothing behavior lives behind one collaborator interface. If "do nothing" should sometimes mean "skip step A on Collaborator-1 and step B on Collaborator-2," you cannot drop one Null Object in.
* **Clients cannot agree on do-nothing semantics.** If different clients want the Null Object to behave differently, you end up with multiple Null Object subclasses or a parameterized one — losing some of the simplicity the pattern was meant to offer {% cite Woolf1998 %}.
* **Inappropriate when the absence must be observable.** Monitoring, metrics, or auditing systems may *need* to distinguish "the operation was skipped" from "the operation succeeded with no effect". A Null Object hides the distinction by definition. In that case, leave the `null`/`Optional` and check it explicitly.

# When to use, and when not to

Per Woolf's Applicability {% cite Woolf1998 %}, use Null Object when **all** of the following hold:

* The collaboration already exists and is non-optional in the client's design.
* "Do nothing" is a real domain response, not an error.
* You want clients to be unaware of which kind of collaborator they hold.
* The do-nothing behavior is reusable across multiple clients (or you can foresee future clients needing it).
* All do-nothing behavior fits in one class.

Skip the Null Object when:

* **You only have one client and one call site.** A single null-check is simpler than a new class hierarchy.
* **The absence carries information that the client must act on.** If "no logger" means "skip metrics emission too", the absence is data; do not hide it.
* **`null` and "do nothing" are different things.** A search returning "no result found" is not the same as a search returning the empty list of results that happen to match nothing. Match the type to the meaning.
* **The collaborator must transform into a real one later.** That's a [Proxy](https://en.wikipedia.org/wiki/Proxy_pattern), not a Null Object.
* **Modern language facilities already cover the case.** Languages with `Optional<T>` / `Maybe T` types, exhaustive pattern matching, or non-nullable types make the conditional shorter and the type-checker enforce it. The benefit of Null Object shrinks accordingly. (See *Related Patterns* below.)

# Related Patterns

The Null Object frequently combines with — or competes with — other patterns:

* **[Singleton](/SEBook/designpatterns/singleton.html).** Because Null Objects are typically stateless, the canonical implementation is one shared instance — a Singleton Null Object {% cite Woolf1998 %}. The compound is so common that "Null Object" implicitly suggests a Singleton in most codebases.
* **[Strategy](/SEBook/designpatterns/strategy.html) — Null Strategy.** A ConcreteStrategy whose implementation does nothing is a Null Object playing the Strategy role. The SimUDuck example uses `FlyNullObject` (called `FlyNoWay` in *Head First Design Patterns*) so that `RubberDuck` can `setFlyBehavior(new FlyNullObject())` without overriding `fly()` to do nothing {% cite FreemanRobson2020 %}. See [Strategy → Null Strategy](/SEBook/designpatterns/strategy.html#optional-strategy-with-default-behavior).
* **[State](/SEBook/designpatterns/state.html) — Null State.** A ConcreteState whose operations all do nothing or return null results represents a "nothing happens here" stage in the state machine — a not-yet-logged-in state, an initialized-but-not-started state, or a final terminated state {% cite Woolf1998 %}. See [State → null state](/SEBook/designpatterns/state.html#how-to-represent-a-state-in-which-the-object-is-never-doing-anything-either-at-initialization-time-or-as-a-final-state).
* **Special Case** (Fowler's *Patterns of Enterprise Application Architecture*). Special Case is a generalization of Null Object for any "exceptional" instance that needs uniform handling — `MissingCustomer`, `UnknownPerson`, etc. Null Object is the special case where the special case literally does nothing {% cite Fowler2002PoEAA %}.
* **Optional / Maybe / Option types.** In ML-family and modern languages (Haskell `Maybe`, Rust `Option`, Java `Optional`, Swift `Optional`), the type system encodes "may or may not be there" and forces the client to handle both arms. This addresses the same problem (avoid `null`-related crashes) at a *different* level — at the type, not at the polymorphic dispatch. The two are complementary, not competing: an `Optional<AuditLogger>` whose empty case is filled by a `SilentLogger` gives both the type-level guarantee and the do-nothing implementation.
* **[Iterator](https://en.wikipedia.org/wiki/Iterator_pattern) — Null Iterator.** The classic worked example: `Collections.emptyIterator()`, `iter([])` in Python, `std::ranges::empty_view` in C++. A leaf node returns a Null Iterator instead of `null`, and clients iterate uniformly {% cite Gamma1995 %}.
* **[Decorator](https://en.wikipedia.org/wiki/Decorator_pattern) — different intent.** A Decorator wraps another object to add behavior; it must always have a real wrappee. There is no "Null Decorator" — the pattern requires something to decorate. (This is the reason the [Pattern Compounds discussion](/SEBook/designpatterns.html#communicating-design-intent-and-context-tailoring) explicitly notes there is no Null Decorator.)
* **Proxy — easily confused.** A Proxy stands in for a real subject and may forward calls to it (lazily, remotely, with access checks). A Null Object replaces the real subject permanently. If your stand-in might "wake up" and start doing real work, it is a Proxy, not a Null Object {% cite Woolf1998 %}.

# Common Examples

| Domain | AbstractObject | Real | Null Object |
|---|---|---|---|
| Auditing | `AuditLogger` | `FileAuditLogger`, `KafkaAuditLogger` | `SilentLogger` |
| Authorization | `Permissions` | `RoleBasedPermissions` | `EmptyPermissions` (denies everything) or `GuestPermissions` (allows nothing requiring auth) |
| MVC controllers | `Controller` | `TextController` | `NoController` (read-only views) {% cite Woolf1998 %} |
| Iteration | `Iterator<T>` | `ListIterator`, `TreeIterator` | `NullIterator` / `Collections.emptyIterator()` |
| Animation | `Animator` | `EaseInOutAnimator` | `InstantAnimator` (no-op for `prefers-reduced-motion`) |
| Locking | `Lock` | `Mutex`, `RWLock` | `NullLock` for single-threaded use {% cite Woolf1998 %} |
| Layout | `LayoutManager` | `BoxLayout`, `GridLayout` | `NullLayout` (each child uses its preferred size) {% cite Woolf1998 %} |
| Strategy | `FlyBehavior` | `FlyWithWings`, `FlyRocketPowered` | `FlyNullObject` for non-flying ducks {% cite FreemanRobson2020 %} |

# Practical Guidance

* **Name the class for what it does, not what it is.** `SilentLogger` and `EmptyPermissions` are more honest than `NullLogger` and `DefaultPermissions`. The reader needs to understand the *behavior* at a glance — "default" implies "what you usually want", which is precisely what a Null Object usually is *not*.
* **Log which collaborator was wired in.** A one-line startup log (`"Audit logger: SilentLogger (no audit trail will be written)"`) catches misconfigurations before they cause months of silent damage.
* **Don't reach for it when you have only one client.** A lone `if (x != null)` is not a smell worth fixing with a class hierarchy. Wait until two or three call sites repeat the same guard.
* **Pair with `Optional`/`Maybe` rather than replacing them.** In typed languages, returning `Optional<AuditLogger>` from your factory and then resolving the empty case to a `SilentLogger` at the wiring boundary keeps the type honest *and* keeps the call site clean.
* **Don't use Null Object to silence a real exception.** If a missing file *is* an error, throw. Null Object replaces "absence is the design"; it does not paper over "absence means we screwed up".

## Flashcards

{% include flashcards.html id="design_pattern_null_object" %}

## Quiz

{% include quiz.html id="design_pattern_null_object" %}
