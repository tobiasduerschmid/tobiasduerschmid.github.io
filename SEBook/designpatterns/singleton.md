---
title: Singleton Design Pattern
layout: sebook
---

# Context
Some applications need one coordinating object within a defined scope. GoF motivates Singleton with resources such as a printer spooler or a window manager {% cite Gamma1995 %}. These examples illustrate a design constraint, not a universal rule: applications may legitimately need several pools, caches, loggers, or device drivers. First identify the scope and the failure that a second instance would cause. One object per process, tenant, or test are different requirements.

# Problem
The primary problem arises when instantiating more than one of these unique objects leads to incorrect program behavior, resource overuse, or inconsistent results. For instance, two controllers for the same exclusive device could issue conflicting commands. Two independent simulations, however, may each need their own Earth object; a class-wide restriction would prevent that legitimate use.

While developers might be tempted to use global variables to manage these unique objects, this approach introduces several critical flaws:
*   **High Coupling:** Global variables allow any part of the system to access and potentially mess around with the object, creating a web of dependencies that makes the code hard to maintain.
*   **Lack of Control:** Global variables do not prevent a developer from accidentally calling the constructor multiple times to create a second, distinct instance.
*   **Lifecycle Decisions:** The program must still decide when to create the shared object and who owns its lifetime. A global variable alone does not specify either policy.

# Solution
The **Singleton Pattern** combines single-instance control with a global access point. It can control construction, but it retains the coupling associated with global access. A common Java-style implementation uses three elements:
1.  **A Private Constructor:** By declaring the constructor `private`, the pattern prevents ordinary external constructor calls. Other languages enforce or express this restriction differently.
2.  **A Static Field:** The class maintains a private static variable (often named `uniqueInstance`) to hold its own single instance.
3.  **A Static Access Method:** A public static method, typically named `getInstance()`, serves as the sole gateway to the object.

## UML Role Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
layout landscape
class Singleton {
	- uniqueInstance: Singleton {static}
	- Singleton()
	+ getInstance(): Singleton {static}
	+ operation(): void
}
class ClientA
class ClientB
ClientA --> Singleton : getInstance()
ClientB --> Singleton : getInstance()
callout right of text "uniqueInstance" : Static field: the one instance belongs to the class
callout right of text "Singleton()" : Private constructor: no client can call new
callout right of text "getInstance(): Singleton" : Global access point: always returns the same instance
@enduml'></div>

## UML Example Diagram

Both callers obtain the same `AppConfig` used in the code below. The class controls access; the returned object provides the logging operation.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
layout landscape
class AppConfig {
	- INSTANCE: AppConfig {static}
	- AppConfig()
	+ getInstance(): AppConfig {static}
	+ log(message: String): void
}
class ClientA
class ClientB
ClientA ..> AppConfig : obtains instance
ClientB ..> AppConfig : obtains instance
callout right of text "INSTANCE" : Singleton role: AppConfig holds its own unique instance
@enduml'></div>

## Sequence Diagram

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
participant firstClient: ClientA
participant secondClient: ClientB
participant AppConfig
participant config: AppConfig
firstClient -> AppConfig: getInstance()
AppConfig --> firstClient: config
secondClient -> AppConfig: getInstance()
AppConfig --> secondClient: same config
firstClient -> config: log("first message")
secondClient -> config: log("second message")
callout bottom of text "AppConfig" : Class as participant: getInstance() is a static call on the class
callout right of text "config" : Returns the single instance created when the class loads
callout right of text "same config" : A second request creates nothing new
callout right of text "log(\"second message\")" : Both clients now share one object and its state
@enduml'></div>

## Code Example

This small `AppConfig` example uses logging to make shared identity visible. Java, C++, and TypeScript callers request the instance through an accessor. Python intercepts ordinary construction in `__new__`, so its callers still write `AppConfig()`. These examples demonstrate identity sharing; they do not establish a need for a global logger. Save the Java example below as `Demo.java`.

> **Teaching example:** These snippets are intentionally small. They show one reasonable mapping of the pattern roles, not a drop-in architecture. In production, always tailor the pattern to the concrete context: lifecycle, ownership, error handling, concurrency, dependency injection, language idioms, and team conventions.

<div class="inline-language-switcher" data-language-switcher data-default-language="java">
  <div class="inline-language-tabs" role="tablist" aria-label="Singleton code language">
    <button type="button" role="tab" data-language-option="java" aria-selected="true">Java</button>
    <button type="button" role="tab" data-language-option="cpp" aria-selected="false">C++</button>
    <button type="button" role="tab" data-language-option="python" aria-selected="false">Python</button>
    <button type="button" role="tab" data-language-option="ts" aria-selected="false">TypeScript</button>
  </div>

  <div class="inline-language-panel is-active" data-language-panel="java" role="tabpanel" markdown="1">
```java
final class AppConfig {
    private static final AppConfig INSTANCE = new AppConfig();

    private AppConfig() {}

    public static AppConfig getInstance() {
        return INSTANCE;
    }

    public void log(String message) {
        System.out.println("[config] " + message);
    }
}

public class Demo {
    public static void main(String[] args) {
        AppConfig first = AppConfig.getInstance();
        AppConfig second = AppConfig.getInstance();
        first.log("same instance: " + (first == second));
    }
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="cpp" role="tabpanel" markdown="1">
```cpp
#include <iostream>
#include <string>

class AppConfig {
public:
    static AppConfig& instance() {
        static AppConfig config;
        return config;
    }

    AppConfig(const AppConfig&) = delete;
    AppConfig& operator=(const AppConfig&) = delete;

    void log(const std::string& message) const {
        std::cout << "[config] " << message << "\n";
    }

private:
    AppConfig() = default;
};

int main() {
    AppConfig& first = AppConfig::instance();
    AppConfig& second = AppConfig::instance();
    first.log(&first == &second ? "same instance" : "different instances");
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="python" role="tabpanel" markdown="1">
```python
from __future__ import annotations


class AppConfig:
    _instance: AppConfig | None = None

    def __new__(cls) -> AppConfig:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def log(self, message: str) -> None:
        print(f"[config] {message}")


first = AppConfig()
second = AppConfig()
first.log(f"same instance: {first is second}")
```

> **Pythonic alternative.** The `__new__` form has a well-known pitfall: Python still calls `__init__` on every `AppConfig()` call, so if the class ever grows an `__init__`, it will silently re-initialize state. A **module-level instance** is often a simpler way to share an ordinary object. Normal imports reuse the module cached in `sys.modules`; they do not prevent calling the object's class again, reloading the module, or running another interpreter. The unsynchronized `__new__` example also does not provide a concurrent-construction guarantee. It illustrates the identity idea for sequential calls.
  </div>

  <div class="inline-language-panel" data-language-panel="ts" role="tabpanel" markdown="1">
```typescript
class AppConfig {
  private static instance: AppConfig | undefined;

  private constructor() {}

  static getInstance(): AppConfig {
    AppConfig.instance ??= new AppConfig();
    return AppConfig.instance;
  }

  log(message: string): void {
    console.log(`[config] ${message}`);
  }
}

const first = AppConfig.getInstance();
const second = AppConfig.getInstance();
first.log(`same instance: ${first === second}`);
```
  </div>
</div>

## Refining the Solution: Thread Safety and Performance
The Java example initializes its instance in a static field initializer, during **class initialization**, not merely class loading or necessarily program startup. Successful class initialization safely publishes the instance to other threads. It is eager relative to other uses that initialize `AppConfig`; if the class is never initialized, the object is never created. See the [Java Language Specification on initialization](https://docs.oracle.com/javase/specs/jls/se25/html/jls-12.html#jls-12.4.1).

A common alternative is **lazy instantiation**, which only creates the instance on the first call:

```java
// Alternative field and accessor inside AppConfig; NOT thread-safe
private static AppConfig instance;

public static AppConfig getInstance() {
    if (instance == null) {            // (1) check
        instance = new AppConfig();    // (2) create
    }
    return instance;
}
```

This naive form is **not thread-safe**: if two threads run `(1)` simultaneously and both see `null`, they will both run `(2)` and create two separate objects. Java offers several ways to fix this:

*   **Synchronized Method:** Adding the `synchronized` keyword to `getInstance()` makes the check-and-create atomic, but introduces lock-acquisition overhead on *every* call, even after the object has been created.
*   **Eager Instantiation:** As shown above. Uses the JVM's class-initialization synchronization, with no explicit lock in the accessor. The object is created whenever the enclosing class is initialized.
*   **Double-Checked Locking (DCL):** Check for `null` *before* entering a synchronized block and again *inside* it, so calls after initialization avoid the explicit lock. Concurrent calls during initialization may still enter the synchronized block. This idiom was [famously broken](https://www.cs.umd.edu/~pugh/java/memoryModel/DoubleCheckedLocking.html) before Java 5: without `volatile`, the JIT can reorder the constructor's writes with the publish of the reference, so another thread can observe the field as non-null while the object is still partially constructed. From Java 5 onward, declaring the instance field `volatile` adds the memory barriers needed to make DCL correct. The pattern is fiddly enough that the next two idioms are usually preferred.
*   **Initialization-on-Demand Holder Idiom (Bill Pugh):** Put the instance in a private static nested class. Reading `Holder.INSTANCE` triggers initialization of the holder class (lazy), and the JVM synchronizes that initialization. The accessor needs no explicit `volatile` or `synchronized`.

```java
public final class AppConfig {
    private AppConfig() {}
    private static class Holder {
        static final AppConfig INSTANCE = new AppConfig();
    }
    public static AppConfig getInstance() {
        return Holder.INSTANCE;
    }
}
```

*   **Enum Singleton:** Joshua Bloch (*Effective Java*, Item 3) recommends a single-element enum as the most robust singleton in Java: it is concise, thread-safe by construction, and defends against both serialization (deserialization will not produce a second instance) and reflection attacks (the JVM forbids reflective creation of enum values).

```java
public enum AppConfig {
    INSTANCE;
    public void log(String message) {
        System.out.println("[config] " + message);
    }
}
```

> **Other languages.** The preceding idioms are Java-specific. In **C++**, the function-local static "Meyers' Singleton" shown above is thread-safe by the language standard since C++11. In **Python**, normal imports share a cached module, so a module-level object is often sufficient for shared access; it does not enforce one instance of its class. In **TypeScript**, `private` restricts typed callers at compile time, and separate workers or module copies can still have separate instances.

Safe creation does **not** make later operations on mutable state thread-safe. Singleton scope also stops at the relevant runtime boundary: Java class loaders, separate processes, and separate interpreters can have their own instances. Enforcing one controller across processes requires a separate coordination mechanism.

# Consequences
Applying the Singleton Pattern results in several important architectural outcomes:
*   **Controlled Access:** The pattern provides a single point of access that can be easily managed and updated.
*   **Resource Sharing:** A single managed object can avoid duplicate expensive setup. This benefit depends on a real sharing requirement; a long-lived singleton can also retain resources longer than needed.
*   **The Risk of "Singleitis":** A major drawback is the tendency for developers to overuse the pattern. Using a Singleton just for easy global access can lead to a hard-to-maintain design with high coupling, where it becomes unclear which classes depend on the Singleton and why.
*   **Complexity in Testing:** Singletons are hard to mock during unit testing because they maintain state throughout the lifespan of the application. A `static getInstance()` call is a *hardcoded dependency* — there is no seam where a [test double](/SEBook/testing/testdoubles.html) can be injected, and tests that mutate the same singleton can interfere through retained state. This is one of the main reasons many practitioners — particularly those who practise [test-driven development](/SEBook/testing/tdd.html) — treat the pattern as an anti-pattern.
*   **Lifecycle Coupling:** A class that implements its service and manages its own instance policy ties those concerns together. If they change independently, separating setup from the service reduces reasons to modify the same class.

# A Pattern with a "Weak Solution"

A central architectural criticism is that Singleton bundles two separate decisions:
1. **Ensuring a single instance**—a legitimate design constraint.
2. **Providing global access**—a convenience that introduces hidden coupling.

These decisions can be separated with **dependency injection (DI)**: application setup creates one ordinary object and passes that same object to its consumers. A DI container can automate a lifetime policy, but no framework is required. A container-managed singleton normally means one instance per configured container or scope; it does not forbid constructing another instance elsewhere. Explicit injection improves substitution and makes dependencies visible, while shared mutable state still requires an appropriate isolation policy.

## When Singleton is Acceptable
Consider Singleton when a well-defined single-instance constraint and a well-known access point are both needed, and the cost of global coupling is acceptable. A fixed host API or a small closed application may make that trade-off reasonable. Check how consumers will be tested and how the lifetime ends.

Immutable or stateless instances avoid shared-state mutation, but callers can still need different configuration values or substitutes in tests. Prefer creating and passing one ordinary instance when that meets the requirement; the absence of a DI framework is not a reason to use Singleton.

## When Singleton is an Anti-Pattern
* When the "only one" assumption is actually a *convenience* assumption, not a hard requirement. Many "singletons" later need multiple instances (per-tenant, per-thread, per-test).
* When it is used to create global state—making dependencies harder to discover from interfaces.
* When it blocks unit testing by hardcoding access and obstructing ordinary substitution.

# Related Patterns

The original GoF chapter notes that "many patterns can be implemented using the Singleton pattern" — typically because the pattern needs a single, well-known coordinating object:

*   **Abstract Factory**, **Builder**, and **Prototype** are cited by GoF as patterns that can use Singleton. This is a possible combination, not a lifecycle rule. In particular, a mutable builder like the vacation planner needs a separate construction session per product or an explicit reset and concurrency policy.
*   **Facade** objects can provide a well-known subsystem entry point, but that interface role does not require a unique instance.
*   **Dependency injection** separates object provisioning from use. Manual setup or a container can share one object among consumers without requiring those consumers to call a global accessor.

## Flashcards

{% include flashcards.html id="design_pattern_singleton" %}

## Quiz

{% include quiz.html id="design_pattern_singleton" %}
