---
title: Singleton Design Pattern
layout: sebook
---

# Context
In software engineering, certain classes represent concepts that should only exist once during the entire execution of a program. The original GoF motivating examples capture this well: a system may have many printers but only one *printer spooler*, only one *file system*, and only one *window manager*. Modern variations include thread pools, caches, dialog boxes, logging objects, and device drivers. In these scenarios, having more than one instance is not just unnecessary but often harmful to the system's integrity. In a UML class diagram, this requirement is explicitly modeled by specifying a multiplicity of "1" in the upper right corner of the class box, indicating the class is intended to be a singleton.

# Problem
The primary problem arises when instantiating more than one of these unique objects leads to incorrect program behavior, resource overuse, or inconsistent results. For instance, accidentally creating two distinct "Earth" objects in a planetary simulation would break the logic of the system. 

While developers might be tempted to use global variables to manage these unique objects, this approach introduces several critical flaws:
*   **High Coupling:** Global variables allow any part of the system to access and potentially mess around with the object, creating a web of dependencies that makes the code hard to maintain.
*   **Lack of Control:** Global variables do not prevent a developer from accidentally calling the constructor multiple times to create a second, distinct instance.
*   **Instantiation Issues:** You may want the flexibility to choose between "eager instantiation" (creating the object at program start) or "lazy instantiation" (creating it only when first requested), which simple global variables do not inherently support.

# Solution
The **Singleton Pattern** solves these issues by ensuring a class has only one instance while providing a controlled, global point of access to it. The solution consists of three main implementation aspects:
1.  **A Private Constructor:** By declaring the constructor `private`, the pattern prevents external classes from ever using the `new` keyword to create an instance.
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
@enduml'></div>

## UML Example Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
layout landscape
class ChocolateBoiler {
	- empty: bool
	- boiled: bool
	- uniqueInstance: ChocolateBoiler {static}
	- ChocolateBoiler()
	+ getInstance(): ChocolateBoiler {static}
	+ fill(): void
	+ boil(): void
	+ drain(): void
}
class CandyMaker
class CleaningCycle
CandyMaker --> ChocolateBoiler : uses
CleaningCycle --> ChocolateBoiler : uses
@enduml'></div>

## Sequence Diagram

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
participant maker: CandyMaker
participant cleaner: CleaningCycle
participant boiler: ChocolateBoiler
maker -> boiler: getInstance()
activate boiler
boiler --> maker: instance
deactivate boiler
cleaner -> boiler: getInstance()
activate boiler
boiler --> cleaner: same instance
deactivate boiler
maker -> boiler: fill()
activate boiler
deactivate boiler
cleaner -> boiler: drain()
activate boiler
deactivate boiler
@enduml'></div>

## Code Example

This example models a process-wide configuration/logger object. Each language has a different idiom for enforcing one instance; the intent is the same: clients do not call the constructor directly.

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
public final class AppConfig {
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

> **Pythonic alternative.** The `__new__` form has a well-known pitfall: Python still calls `__init__` on every `AppConfig()` call, so if the class ever grows an `__init__`, it will silently re-initialize state. The standard Pythonic singleton is just a **module-level instance** — modules are loaded once and cached, so a top-level `config = AppConfig()` in `config.py` is already a singleton, with no metaclass or `__new__` trickery.
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
The Java example above uses **eager instantiation**: the instance is created when the class is first loaded. The JVM guarantees class initialization runs exactly once, so this is automatically thread-safe. The trade-off is that the object is built even if no client ever calls `getInstance()`.

A common alternative is **lazy instantiation**, which only creates the instance on the first call:

```java
// NOT thread-safe — for illustration only
public static AppConfig getInstance() {
    if (instance == null) {            // (1) check
        instance = new AppConfig();    // (2) create
    }
    return instance;
}
```

This naive form is **not thread-safe**: if two threads run `(1)` simultaneously and both see `null`, they will both run `(2)` and create two separate objects. Java offers several ways to fix this:

*   **Synchronized Method:** Adding the `synchronized` keyword to `getInstance()` makes the check-and-create atomic, but introduces lock-acquisition overhead on *every* call, even after the object has been created.
*   **Eager Instantiation:** As shown above. Simple, thread-safe, no synchronization — at the cost of building the object up front.
*   **Double-Checked Locking (DCL):** Check for `null` *before* entering a synchronized block and again *inside* it, so the lock is taken only on the first call. This idiom was [famously broken](https://www.cs.umd.edu/~pugh/java/memoryModel/DoubleCheckedLocking.html) before Java 5: without `volatile`, the JIT can reorder the constructor's writes with the publish of the reference, so another thread can observe the field as non-null while the object is still partially constructed. From Java 5 onward, declaring the instance field `volatile` adds the memory barriers needed to make DCL correct. The pattern is fiddly enough that the next two idioms are usually preferred.
*   **Initialization-on-Demand Holder Idiom (Bill Pugh):** Put the instance in a private static nested class. The JVM only loads the holder class when it is first referenced (lazy), and class initialization is guaranteed thread-safe (no `volatile`, no `synchronized` needed). This is the recommended lazy pattern in Java.

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

*   **Enum Singleton:** Joshua Bloch (*Effective Java*, Item 3) recommends a single-element enum as the most robust singleton in Java: it is concise, thread-safe by construction, and — uniquely — defends against both serialization (deserialization will not produce a second instance) and reflection attacks (the JVM forbids reflective creation of enum values).

```java
public enum AppConfig {
    INSTANCE;
    public void log(String message) {
        System.out.println("[config] " + message);
    }
}
```

> **Other languages.** The table is largely a Java-specific concern. In **C++**, the function-local static "Meyers' Singleton" shown above is thread-safe by the language standard since C++11. In **Python**, the most idiomatic singleton is a **module-level instance** — modules are themselves loaded once and cached, so a top-level `config = AppConfig()` in `config.py` is already a singleton, with none of the `__new__` / `__init__` pitfalls of the class-based form.

# Consequences
Applying the Singleton Pattern results in several important architectural outcomes:
*   **Controlled Access:** The pattern provides a single point of access that can be easily managed and updated.
*   **Resource Efficiency:** It prevents the system from being cluttered with redundant, resource-intensive objects.
*   **The Risk of "Singleitis":** A major drawback is the tendency for developers to overuse the pattern. Using a Singleton just for easy global access can lead to a hard-to-maintain design with high coupling, where it becomes unclear which classes depend on the Singleton and why.
*   **Complexity in Testing:** Singletons are hard to mock during unit testing because they maintain state throughout the lifespan of the application. A `static getInstance()` call is a *hardcoded dependency* — there is no seam where a [test double](/SEBook/testing/testdoubles.html) can be injected, and tests that share the singleton interfere with each other through its retained state. This is one of the main reasons many practitioners — particularly those who practise [test-driven development](/SEBook/testing/tdd.html) — treat the pattern as an anti-pattern.
*   **Single Responsibility Principle Violation:** A Singleton class takes on two responsibilities: doing its real work *and* managing its own lifecycle (enforcing single-instance, controlling creation). These are independent concerns and ideally belong in different places.

# A Pattern with a "Weak Solution"

The Singleton is perhaps the most controversial of all GoF patterns. Buschmann et al. (POSA5) describe it as **"a well-known pattern with a weak solution"**, noting that "the literature that discusses [Singleton's] issues dwarfs the page count of the original pattern description in the Gang-of-Four book." The core problem is that the pattern conflates two separate concerns:
1. **Ensuring a single instance**—a legitimate design constraint.
2. **Providing global access**—a convenience that introduces hidden coupling.

Modern practice separates these concerns. A **dependency injection (DI) container** can manage the *singleton lifetime* (ensuring only one instance exists) while keeping constructors injectable and dependencies explicit. This gives you the same lifecycle guarantee without the testability and coupling problems.

## When Singleton is Acceptable
The Singleton pattern remains acceptable when:
* It controls a true infrastructure resource that *must* be unique (e.g., a hardware driver in an embedded system, the JVM's `Runtime`).
* DI is genuinely unavailable (small scripts, legacy code, plug-ins loaded into a host that doesn't expose a container).
* The instance is **immutable** or otherwise stateless — a read-only configuration loaded at startup, for example, raises none of the test-isolation concerns.

In all other cases, prefer DI with singleton scope. As the maxim goes — *"if your code isn't testable, it isn't a good design"* — and a hardcoded global access point is a direct obstacle to testability.

## When Singleton is an Anti-Pattern
* When the "only one" assumption is actually a *convenience* assumption, not a hard requirement. Many "singletons" later need multiple instances (per-tenant, per-thread, per-test).
* When it is used to create global state—making it impossible to reason about what depends on what.
* When it blocks unit testing by making dependencies invisible and unmockable.

# Related Patterns

The original GoF chapter notes that "many patterns can be implemented using the Singleton pattern" — typically because the pattern needs a single, well-known coordinating object:

*   **Abstract Factory**, **Builder**, and **Prototype** are explicitly cited by GoF as patterns that are often realised as singletons, since an application usually only needs one factory / builder / prototype registry.
*   **Facade** objects, by extension, are frequently singletons — there is usually one front door per subsystem.
*   **Dependency Injection containers** are the modern alternative discussed above: they manage *singleton lifetime* (one instance per scope) without the global access point, so DI subsumes most legitimate uses of the Singleton pattern.

## Flashcards

{% include flashcards.html id="design_pattern_singleton" %}

## Quiz

{% include quiz.html id="design_pattern_singleton" %}
