---
title: Mediator Design Pattern
layout: sebook
---

# Context
In complex software systems, we often encounter a "family" of objects that must work together to achieve a high-level goal. A classic scenario is Bob’s Java-enabled smart home. In this system, various appliances like an alarm clock, a coffee maker, a calendar, and a garden sprinkler must coordinate their behaviors. For instance, when the alarm goes off, the coffee maker should start brewing, but only if it is a weekday according to the calendar.

# Problem
When these objects communicate directly, several architectural challenges arise:
*   **Many-to-Many Complexity:** As the number of objects grows, the number of direct inter-communications increases exponentially (N*N), leading to a tangled web of dependencies.
*   **Low Reusability:** Because the coffee pot must "know" about the alarm clock and the calendar to function within Bob's specific rules, it becomes impossible to reuse that coffee pot code in a different home that lacks a sprinkler or a specialized calendar.
*   **Scattered Logic:** The "rules" of the system (e.g., "no coffee on weekends") are spread across multiple classes, making it difficult to find where to make changes when those rules evolve.
*   **Inappropriate Intimacy:** Objects spend too much time delving into each other's private data or specific method names just to coordinate a simple task.

# Solution
The **Mediator Pattern** solves this by encapsulating many-to-many communication dependencies within a single "Mediator" object. Instead of objects talking to each other directly, they only communicate with the Mediator.

The objects (often called "colleagues") tell the Mediator when their state changes. The Mediator then contains all the complex control logic and coordination rules to tell the other objects how to respond. For example, the alarm clock simply tells the Mediator "I've been snoozed," and the Mediator checks the calendar and decides whether to trigger the coffee maker. This reduces the communication structure from N-to-N complex dependencies to a simpler N-to-1 structure.

## UML Role Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout landscape
interface Mediator {
	+ notify(sender: Colleague, event: String): void
}
abstract class Colleague {
	- mediator: Mediator
}
class ConcreteMediator
class ColleagueA
class ColleagueB
ConcreteMediator ..|> Mediator
ColleagueA --|> Colleague
ColleagueB --|> Colleague
Colleague --> Mediator
ConcreteMediator --> ColleagueA : coordinates
ConcreteMediator --> ColleagueB : coordinates
@enduml'></div>

## UML Example Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout landscape
interface SmartHomeMediator {
	+ notify(sender: Object, event: String): void
}
class SmartHomeHub
class AlarmClock {
	- mediator: SmartHomeMediator
}
class CoffeeMaker {
	- mediator: SmartHomeMediator
}
class Calendar {
	- mediator: SmartHomeMediator
	+ isWeekday(): bool
}
class Sprinkler {
	- mediator: SmartHomeMediator
}
SmartHomeHub ..|> SmartHomeMediator
AlarmClock --> SmartHomeMediator
CoffeeMaker --> SmartHomeMediator
Calendar --> SmartHomeMediator
Sprinkler --> SmartHomeMediator
SmartHomeHub --> CoffeeMaker : commands
SmartHomeHub --> Calendar : queries
SmartHomeHub --> Sprinkler : commands
@enduml'></div>

## Sequence Diagram

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
participant alarm: AlarmClock
participant hub: SmartHomeHub
participant calendar: Calendar
participant coffee: CoffeeMaker
participant sprinkler: Sprinkler
alarm -> hub: notify(this, "alarmRang")
activate hub
hub -> calendar: isWeekday()
activate calendar
calendar --> hub: true
deactivate calendar
hub -> coffee: brew()
activate coffee
deactivate coffee
hub -> sprinkler: skipMorningWatering()
activate sprinkler
deactivate sprinkler
deactivate hub
@enduml'></div>

# Code Example

This example keeps the smart-home devices reusable. The alarm, calendar, coffee maker, and sprinkler do not call each other directly; the hub owns the coordination rule.

> **Teaching example:** These snippets are intentionally small. They show one reasonable mapping of the pattern roles, not a drop-in architecture. In production, always tailor the pattern to the concrete context: lifecycle, ownership, error handling, concurrency, dependency injection, language idioms, and team conventions.

<div class="inline-language-switcher" data-language-switcher data-default-language="java">
  <div class="inline-language-tabs" role="tablist" aria-label="Mediator code language">
    <button type="button" role="tab" data-language-option="java" aria-selected="true">Java</button>
    <button type="button" role="tab" data-language-option="cpp" aria-selected="false">C++</button>
    <button type="button" role="tab" data-language-option="python" aria-selected="false">Python</button>
    <button type="button" role="tab" data-language-option="ts" aria-selected="false">TypeScript</button>
  </div>

  <div class="inline-language-panel is-active" data-language-panel="java" role="tabpanel" markdown="1">
```java
interface SmartHomeMediator {
    void notify(Object sender, String event);
}

final class Calendar {
    boolean isWeekday() {
        return true;
    }
}

final class CoffeeMaker {
    void brew() {
        System.out.println("Brewing coffee");
    }
}

final class Sprinkler {
    void skipMorningWatering() {
        System.out.println("Skipping sprinklers");
    }
}

final class AlarmClock {
    private final SmartHomeMediator mediator;

    AlarmClock(SmartHomeMediator mediator) {
        this.mediator = mediator;
    }

    void ring() {
        mediator.notify(this, "alarmRang");
    }
}

final class SmartHomeHub implements SmartHomeMediator {
    private final Calendar calendar = new Calendar();
    private final CoffeeMaker coffeeMaker = new CoffeeMaker();
    private final Sprinkler sprinkler = new Sprinkler();

    public void notify(Object sender, String event) {
        if ("alarmRang".equals(event) && calendar.isWeekday()) {
            coffeeMaker.brew();
            sprinkler.skipMorningWatering();
        }
    }
}

public class Demo {
    public static void main(String[] args) {
        SmartHomeHub hub = new SmartHomeHub();
        AlarmClock alarm = new AlarmClock(hub);
        alarm.ring();
    }
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="cpp" role="tabpanel" markdown="1">
```cpp
#include <iostream>
#include <string>

struct SmartHomeMediator {
    virtual ~SmartHomeMediator() = default;
    virtual void notify(void* sender, const std::string& event) = 0;
};

class Calendar {
public:
    bool isWeekday() const { return true; }
};

class CoffeeMaker {
public:
    void brew() const { std::cout << "Brewing coffee\n"; }
};

class Sprinkler {
public:
    void skipMorningWatering() const { std::cout << "Skipping sprinklers\n"; }
};

class AlarmClock {
public:
    explicit AlarmClock(SmartHomeMediator& mediator) : mediator_(mediator) {}

    void ring() {
        mediator_.notify(this, "alarmRang");
    }

private:
    SmartHomeMediator& mediator_;
};

class SmartHomeHub : public SmartHomeMediator {
public:
    void notify(void*, const std::string& event) override {
        if (event == "alarmRang" && calendar_.isWeekday()) {
            coffeeMaker_.brew();
            sprinkler_.skipMorningWatering();
        }
    }

private:
    Calendar calendar_;
    CoffeeMaker coffeeMaker_;
    Sprinkler sprinkler_;
};

int main() {
    SmartHomeHub hub;
    AlarmClock alarm(hub);
    alarm.ring();
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="python" role="tabpanel" markdown="1">
```python
from abc import ABC, abstractmethod


class SmartHomeMediator(ABC):
    @abstractmethod
    def notify(self, sender: object, event: str) -> None:
        pass


class Calendar:
    def is_weekday(self) -> bool:
        return True


class CoffeeMaker:
    def brew(self) -> None:
        print("Brewing coffee")


class Sprinkler:
    def skip_morning_watering(self) -> None:
        print("Skipping sprinklers")


class AlarmClock:
    def __init__(self, mediator: SmartHomeMediator) -> None:
        self._mediator = mediator

    def ring(self) -> None:
        self._mediator.notify(self, "alarmRang")


class SmartHomeHub(SmartHomeMediator):
    def __init__(self) -> None:
        self.calendar = Calendar()
        self.coffee_maker = CoffeeMaker()
        self.sprinkler = Sprinkler()

    def notify(self, sender: object, event: str) -> None:
        if event == "alarmRang" and self.calendar.is_weekday():
            self.coffee_maker.brew()
            self.sprinkler.skip_morning_watering()


hub = SmartHomeHub()
alarm = AlarmClock(hub)
alarm.ring()
```
  </div>

  <div class="inline-language-panel" data-language-panel="ts" role="tabpanel" markdown="1">
```typescript
enum SmartHomeEvent {
  AlarmRang = "alarmRang",
}

interface SmartHomeMediator {
  notify(sender: object, event: SmartHomeEvent): void;
}

class Calendar {
  isWeekday(): boolean { return true; }
}

class CoffeeMaker {
  brew(): void { console.log("Brewing coffee"); }
}

class Sprinkler {
  skipMorningWatering(): void { console.log("Skipping sprinklers"); }
}

class AlarmClock {
  constructor(private readonly mediator: SmartHomeMediator) {}

  ring(): void {
    this.mediator.notify(this, SmartHomeEvent.AlarmRang);
  }
}

class SmartHomeHub implements SmartHomeMediator {
  private readonly calendar = new Calendar();
  private readonly coffeeMaker = new CoffeeMaker();
  private readonly sprinkler = new Sprinkler();

  notify(sender: object, event: SmartHomeEvent): void {
    if (event === SmartHomeEvent.AlarmRang && this.calendar.isWeekday()) {
      this.coffeeMaker.brew();
      this.sprinkler.skipMorningWatering();
    }
  }
}

const hub = new SmartHomeHub();
const alarm = new AlarmClock(hub);
alarm.ring();
```
  </div>
</div>

# Consequences
Applying the Mediator pattern involves significant trade-offs:
*   **Increased Reusability:** Individual objects become more reusable because they make fewer assumptions about the existence of other objects or specific system requirements.
*   **Simplified Maintenance:** Control logic is localized in one component, making it easy to find and update rules without touching the colleague classes.
*   **The "God Class" Risk:** A major drawback is that, without careful design, the Mediator itself can become an overly complex "god class" that is impossible to maintain. The Mediator does not actually remove the inherent complexity of the interactions—it simply provides a structure for centralizing it. If the coordination logic is genuinely complex, the Mediator will be genuinely complex.
*   **Single Point of Failure:** Because all communication flows through one object, the Mediator represents a single point of failure and a potential performance bottleneck.

# Observer vs. Mediator: Distributed vs. Centralized

These two behavioral patterns are frequently confused because both deal with communication between objects. The key distinction is **where the coordination logic lives**:

| Aspect | **[Observer](/SEBook/designpatterns/observer.html)** | **Mediator** |
|---|---|---|
| **Communication** | One-to-many: subject broadcasts, observers decide how to react | Many-to-many: colleagues report events, mediator decides what to do |
| **Intelligence** | *Distributed*: each observer contains its own reaction logic | *Centralized*: the mediator contains all coordination logic |
| **Coupling** | Subject knows only the Observer interface; observers are independent of each other | Colleagues know only the Mediator interface; all rules live in one place |
| **Best for** | **Extensibility**: adding new types of observers without changing the subject | **Changeability**: modifying coordination rules without touching the colleagues |
| **Risk** | Notification storms; cascading updates; hard-to-predict interaction order | God class; single point of failure; complexity displacement |

A useful heuristic: if the objects need to react *independently* to a change (each observer does its own thing), use **Observer**. If the objects need to be *coordinated* (the response depends on the collective state of multiple objects), use **Mediator**.

In practice, the two patterns are often **combined**: colleagues use Observer-style notifications to inform the mediator, and the mediator uses direct method calls to coordinate the response. This composition—sometimes called a "Managed Observer" (Mikkonen, 1998)—gives you the loose coupling of Observer with the centralized coordination of Mediator.

# Design Decisions

## Event-Based vs. Direct Method Calls
* **Event-based:** Colleagues emit named events (strings or enums), and the mediator matches events to responses. More flexible and decoupled, but harder to trace in a debugger.
* **Direct method calls:** The mediator has typed methods for each coordination scenario (e.g., `onAlarmRang()`, `onCalendarUpdated()`). Easier to understand but tightly couples the mediator to the specific set of colleagues.

## Scope of Mediation
* **Per-conversation mediator:** A new mediator is created for each interaction session (common in chat applications or wizard-style UIs).
* **Global mediator:** A single mediator manages all interactions in a subsystem (the smart home example). Simpler but increases the risk of the god class problem.

# Flashcards

{% include flashcards.html id="design_pattern_mediator" %}

# Quiz

{% include quiz.html id="design_pattern_mediator" %}
