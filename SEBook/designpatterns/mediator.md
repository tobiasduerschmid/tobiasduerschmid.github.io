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
hub -> sprinkler: skipMorningWatering()
deactivate hub
@enduml'></div>

# Consequences
Applying the Mediator pattern involves significant trade-offs:
*   **Increased Reusability:** Individual objects become more reusable because they make fewer assumptions about the existence of other objects or specific system requirements.
*   **Simplified Maintenance:** Control logic is localized in one component, making it easy to find and update rules without touching the colleague classes.
*   **Extensibility vs. Changeability:** While patterns like **Observer** are great for adding new types of objects (extensibility), the Mediator is specifically designed for changing *existing* behaviors and interactions (changeability).
*   **The "God Class" Risk:** A major drawback is that, without careful design, the Mediator itself can become an overly complex "god class" or a "drunk junk drawer" that is impossible to maintain.
*   **Single Point of Failure:** Because all communication flows through one object, the Mediator represents a single point of failure and a potential security vulnerability.
*   **Complexity Displacement:** It is important to note that the Mediator does not actually remove the inherent complexity of the interactions; it simply provides a structure for centralizing it.
