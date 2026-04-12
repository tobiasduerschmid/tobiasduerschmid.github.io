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




The only interactions that should be allowed are interactions between the Context and Concrete States. There are no interactions among Concrete State objects.

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
The state-dependent behavior often needs to make changes to the Context. To implement this, the state object can either store a reference to the Context (usually implemented in the Abstract State class) or the context object is passed into the state with every call to a state-dependent method.  

## How to represent a state in which the object is never doing anything (either at initialization time or as a "final" state)

Use the Null Object pattern to create a ["null state"](https://en.wikipedia.org/wiki/Null_object_pattern)

