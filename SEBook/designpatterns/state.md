---
title: State Design Pattern
layout: sebook
---


# Problem 

The core problem the State pattern addresses is when an object's behavior **needs to change dramatically based on its internal state**, and this leads to code that is complex, difficult to maintain, and hard to extend.

If you try to manage state changes using traditional methods, the class containing the state often becomes polluted with large, complex if/else or switch statements that check the current state and execute the appropriate behavior. This results in cluttered code and a violation of the Separation of Concerns design principle, since the code for different states is mixed together and it is hard to see what the behavior of the class is in different states. This also violates the Open/Closed principle, since adding additional states is very hard and requires changes in many different places in the code. 

# Context

An object's behavior depends on its state, and it must change that behavior at runtime. You either have many states already or you might need to add more states later. 

# Solution

Create an **Abstract State class** that defines the interface that all states have. The Context class should not know any state methods besides the methods in the Abstract State so that it is not tempted to implement any state-dependent behavior itself. For each state-dependent method (i.e., for each method that should be implemented differently depending on which state the Context is in) we should define one abstract method in the Abstract State class. 

Create **Concrete State classes** that inherit from the Abstract State and implement the remaining methods. 

The primary interactions should be between the Context and its current State object. Whether Concrete State objects interact with each other depends on the transition design decision discussed below.

## UML Role Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout landscape
class Context {
	- state: State
	+ request(): void
	+ setState(state: State): void
}
interface State {
	+ handle(context: Context): void
}
class ConcreteStateA {
	+ handle(context: Context): void
}
class ConcreteStateB {
	+ handle(context: Context): void
}
Context --> State : delegates to
ConcreteStateA ..|> State
ConcreteStateB ..|> State
ConcreteStateA --> Context : transition via setState
ConcreteStateB --> Context : transition via setState
@enduml'></div>

## UML Example Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout landscape
class GumballMachine {
	- state: State
	+ insertQuarter(): void
	+ turnCrank(): void
	+ releaseBall(): void
	+ setState(state: State): void
}
interface State {
	+ insertQuarter(machine: GumballMachine): void
	+ turnCrank(machine: GumballMachine): void
}
class NoQuarterState
class HasQuarterState
class SoldState
GumballMachine --> State : delegates
NoQuarterState ..|> State
HasQuarterState ..|> State
SoldState ..|> State
NoQuarterState --> GumballMachine : setState(...)
HasQuarterState --> GumballMachine : releaseBall(), setState(...)
SoldState --> GumballMachine : setState(...)
@enduml'></div>

## Sequence Diagram

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
participant customer: Customer
participant machine: GumballMachine
participant noQuarter: NoQuarterState
participant hasQuarter: HasQuarterState
customer -> machine: insertQuarter()
activate machine
machine -> noQuarter: insertQuarter(machine)
activate noQuarter
noQuarter -> machine: setState(hasQuarter)
deactivate noQuarter
customer -> machine: turnCrank()
machine -> hasQuarter: turnCrank(machine)
activate hasQuarter
hasQuarter -> machine: releaseBall()
hasQuarter -> machine: setState(noQuarter)
deactivate hasQuarter
deactivate machine
@enduml'></div>

# Design Decisions

## How to let the state make operations on the context object?
The state-dependent behavior often needs to make changes to the Context. To implement this, the state object can either store a reference to the Context (usually implemented in the Abstract State class) or the context object is passed into the state with every call to a state-dependent method. The stored-reference approach is simpler when states frequently need context data; the parameter-passing approach keeps state objects more reusable across different contexts.

## Who defines state transitions?
This is a critical design decision with significant consequences:
* **Context-driven transitions:** The Context class contains all transition logic (e.g., "if state is NoQuarter and quarter inserted, switch to HasQuarter"). This makes all transitions visible in one place but creates a maintenance bottleneck as states grow.
* **State-driven transitions:** Each Concrete State knows its successor states and triggers transitions itself (e.g., `NoQuarterState.insertQuarter()` calls `context.setState(new HasQuarterState())`). This distributes the logic but makes it harder to see the complete state machine at a glance. It also introduces dependencies between state classes.

In practice, **state-driven transitions** are preferred when states are well-defined and transitions are local. **Context-driven transitions** work better when transitions depend on complex external conditions.

## State object creation: on demand vs. shared
If state objects are **stateless** (they carry behavior but no instance data), they can be shared as flyweight objects or even Singletons, saving memory. If state objects carry **per-context data**, they must be created on demand.

## How to represent a state in which the object is never doing anything (either at initialization time or as a "final" state)

Use the Null Object pattern to create a ["null state"](https://en.wikipedia.org/wiki/Null_object_pattern). This communicates the design intent of "empty behavior" explicitly rather than scattering `null` checks throughout the code.

# The Core Insight: Polymorphism over Conditions

The State pattern embodies the fundamental principle of **polymorphism over conditions**. Instead of writing:
```java
if (state == "noQuarter") { /* behavior A */ }
else if (state == "hasQuarter") { /* behavior B */ }
else if (state == "sold") { /* behavior C */ }
```
...the pattern replaces each branch with a polymorphic object. This is powerful because:
* Adding a new state requires adding a new class, not modifying existing conditional logic (Open/Closed Principle).
* The behavior of each state is cohesive and self-contained, rather than scattered across one giant method.
* The compiler can enforce that every state implements every required method, catching missing cases that a conditional chain silently ignores.

A pedagogically effective way to internalize this insight is the "Before and After" technique: start with the conditional version of a problem, refactor it to use the State pattern, and then try to add a new state to both versions. The difference in effort makes the pattern's value clear.

# State vs. Strategy: Same Structure, Different Intent

The State and Strategy patterns have nearly identical UML class diagrams—a context delegating to an abstract interface with multiple concrete implementations. The difference is entirely in **intent**:
* **State:** The context object's behavior changes *implicitly* as its internal state transitions. The client typically does not choose which state object is active.
* **Strategy:** The client *explicitly* selects which algorithm to use. There are no automatic transitions between strategies.

A useful heuristic: if the concrete implementations *transition between each other* based on internal logic, it is State. If the client *selects* the concrete implementation at configuration time, it is Strategy.

# Flashcards

{% include flashcards.html id="design_pattern_state" %}

# Quiz

{% include quiz.html id="design_pattern_state" %}
