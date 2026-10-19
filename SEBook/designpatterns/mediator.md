---
title: Mediator Design Pattern
layout: sebook
---

# Context
In complex software systems, we often encounter a "family" of objects that must work together to achieve a high-level goal. A classic scenario is Bob's Java-enabled smart home. In this system, various appliances like an alarm clock, a coffee maker, a calendar, and a garden sprinkler must coordinate their behaviors. For instance, when the alarm goes off, the coffee maker should start brewing, but only if it is a weekday according to the calendar.

The original GoF motivating example is a different domain: a font dialog box where widgets (a list box of font families, an entry field for the font name, and OK/Cancel buttons) must coordinate. Selecting a font in the list box updates the entry field; certain buttons enable only when text is present. The same pattern applies — the smart home is just a more relatable framing of the same underlying coordination problem.

# Problem
When these objects communicate directly, several architectural challenges arise:
*   **Many-to-Many Complexity:** If every object communicates directly with every other object, the number of possible links grows quadratically (O(N²)). Actual systems may have fewer links; the problem is tangled coordination, not the object count alone.
*   **Low Reusability:** If the coffee maker contains Bob's alarm and calendar rules, reusing it in another home requires carrying or changing those dependencies.
*   **Scattered Logic:** The "rules" of the system (e.g., "no coffee on weekends") are spread across multiple classes, making it difficult to find where to make changes when those rules evolve.
*   **Inappropriate Intimacy:** Objects spend too much time delving into each other's private data or specific method names just to coordinate a simple task.

# Solution
The **Mediator Pattern** solves this by encapsulating many-to-many communication dependencies within a single "Mediator" object. Instead of objects talking to each other directly, they only communicate with the Mediator.

The objects (often called "colleagues") report relevant events to the Mediator, which owns the coordination rules. Here, the alarm reports "alarm rang"; the hub checks the calendar and, on weekdays, starts coffee and skips watering. Routing a fully connected group through one mediator can reduce communication links from O(N²) to O(N). This counts links, not execution time: the coordination work still exists {% cite Gamma1995 %}.

## UML Role Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout landscape
interface Mediator {
	+ notify(sender: Colleague, event: String)
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
callout top of text "Mediator" : Mediator: the interface colleagues report events to
callout bottom of text "ConcreteMediator" : Concrete mediator: holds the coordination logic
callout top of text "Colleague" : Colleague: knows the mediator, not other colleagues
@enduml'></div>

## UML Example Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout landscape
interface SmartHomeMediator {
	+ notify(sender: Object, event: String)
}
class SmartHomeHub
class AlarmClock {
	- mediator: SmartHomeMediator
	+ ring()
}
class CoffeeMaker {
	+ brew()
}
class Calendar {
	+ isWeekday(): Boolean
}
class Sprinkler {
	+ skipMorningWatering()
}
SmartHomeHub ..|> SmartHomeMediator
AlarmClock --> SmartHomeMediator
SmartHomeHub --> CoffeeMaker : commands
SmartHomeHub --> Calendar : queries
SmartHomeHub --> Sprinkler : commands
callout top of text "SmartHomeHub" : Concrete mediator: holds the morning routine logic
callout bottom of text "AlarmClock" : Colleague: reports to the hub instead of calling devices
callout bottom of text "CoffeeMaker" : Colleague: knows nothing about the alarm clock
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
callout right of text "notify(this, \"alarmRang\")" : The colleague reports what happened, not what others should do
callout right of text "isWeekday()" : The mediator gathers the facts it needs
callout right of text "brew()" : The mediator decides which colleagues react
callout right of text "skipMorningWatering()" : No colleague calls another directly
@enduml'></div>

# Code Example

This example keeps the smart-home devices reusable. The alarm, calendar, coffee maker, and sprinkler do not call each other directly; the hub owns the coordination rule. `Calendar` deliberately returns a fixed weekday result so the sample has deterministic output. The alarm reports events; the other devices only answer queries or receive commands, so not every colleague needs a reference back to the mediator.

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
The GoF lists five consequences of the Mediator pattern; the first four are benefits and the fifth is the central trade-off:

*   **It limits subclassing.** A mediator localizes behavior that would otherwise be distributed among several colleague classes. Coordination can change by replacing, configuring, or subclassing the mediator without creating matching subclasses of every colleague, provided their interfaces remain sufficient.
*   **It decouples colleagues.** Individual objects become more reusable because they make fewer assumptions about the existence of other objects or specific system requirements. You can vary and reuse Colleague and Mediator classes independently.
*   **It simplifies object protocols.** A mediator replaces many-to-many interactions with one-to-many interactions between the mediator and its colleagues. One-to-many relationships are easier to understand, maintain, and extend.
*   **It abstracts how objects cooperate.** Making mediation an independent concept and encapsulating it in an object lets you focus on how objects interact apart from their individual behavior. That can help clarify how objects interact in a system.
*   **It centralizes control — the "God Class" risk.** The Mediator pattern trades complexity of interaction for complexity in the mediator. Because a mediator encapsulates protocols, it can become more complex than any individual colleague — the Mediator does not actually remove the inherent complexity of the interactions; it just provides a structure for centralizing it. This can make the mediator itself a monolith that is hard to maintain.

Beyond GoF, one engineering concern is worth flagging in production systems:

*   **Single point of failure / performance bottleneck.** Because all communication flows through one object, a global mediator can become a reliability and performance hot spot. (This is an engineering observation, not a GoF consequence.)

# Observer vs. Mediator

These two behavioral patterns are frequently confused because both deal with communication between objects. The key distinction is **where the coordination logic lives**:

| Aspect | **[Observer](/SEBook/designpatterns/observer.html)** | **Mediator** |
|---|---|---|
| **Communication** | A subject notifies registered observers | Many-to-many coordination is routed through colleague–mediator links |
| **Intelligence** | *Distributed*: each observer contains its own reaction logic | *Centralized*: the mediator contains all coordination logic |
| **Coupling** | Subject depends on the notification contract; observers need not know one another | Mediated peer dependencies move into the coordinator; unrelated dependencies may remain |
| **Best for** | **Extensibility**: adding new types of observers without changing the subject | **Changeability**: modifying coordination rules without touching the colleagues |
| **Risk** | Notification storms; cascading updates; hard-to-predict interaction order | God class; single point of failure; complexity displacement |

A useful heuristic: if the objects need to react *independently* to a change (each observer does its own thing), use **Observer**. If the objects need to be *coordinated* (the response depends on the collective state of multiple objects), use **Mediator**.

In practice, the two patterns are often **combined**: colleagues use Observer-style notifications to inform the mediator, and the mediator uses direct method calls to coordinate the response. This composition gives you the loose coupling of Observer with the centralized coordination of Mediator. The GoF Related Patterns section explicitly notes: "Colleagues can communicate with the mediator using the Observer pattern." GoF also describes the `ChangeManager` from the Observer chapter as a Mediator instance — the same idea seen from the other direction.

# Façade vs. Mediator

Mediator is also frequently confused with [Façade](/SEBook/designpatterns/facade.html), because both put a single object in front of a group of others. The distinction is about **direction and awareness**:

| Aspect | **Façade** | **Mediator** |
|---|---|---|
| **Direction** | External clients call into the façade, which forwards to subsystem objects that need not know it exists. | The mediator coordinates peer objects. Event-reporting colleagues notify it, and it calls the participants needed for the response. |
| **Goal** | Hide the complexity of a subsystem behind a simpler interface for outside use. | Coordinate the interactions among a set of peer objects so they don't have to know each other. |
| **Subsystem awareness** | Subsystem classes need no dependency on the façade. | Event-reporting colleagues know the mediation contract. Passive participants can expose ordinary operations without knowing the mediator. |

If clients outside a module need a simple way in, that's a Façade. If peers inside a module need a way to coordinate without referring to each other, that's a Mediator.

# Design Decisions

## Event-Based vs. Direct Method Calls
* **Event-based:** Colleagues report named events (strings, enums, or typed event objects), and the mediator selects a response. A generic event method can ease extension, but string events may lose compiler checks. The sample still delivers these events through synchronous method calls.
* **Scenario-specific methods:** The mediator exposes operations such as `onAlarmRang()`. These make supported interactions explicit. Both variants depend on a coordination contract; event names do not remove that dependency.

## Scope of Mediation
* **Per-conversation mediator:** A new mediator is created for each interaction session (common in chat applications or wizard-style UIs).
* **Global mediator:** A single mediator manages all interactions in a subsystem (the smart home example). Simpler but increases the risk of the god class problem.

## Abstract Mediator vs. Concrete-Only
GoF notes that the abstract `Mediator` class is sometimes optional. If colleagues only ever work with one concrete mediator, you can skip the abstract layer. The abstract class earns its keep when colleagues need to be reusable across multiple ConcreteMediator subclasses — the abstract coupling is what makes that reuse possible.

## Flashcards

{% include flashcards.html id="design_pattern_mediator" %}

## Quiz

{% include quiz.html id="design_pattern_mediator" %}
