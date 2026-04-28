---
title: State Design Pattern
layout: sebook
---


# Problem 

The core problem the State pattern addresses is when an object's behavior **needs to change dramatically based on its internal state**, and this leads to code that is complex, difficult to maintain, and hard to extend.

If you try to manage state changes using traditional methods, the class containing the state often becomes polluted with large, complex if/else or switch statements that check the current state and execute the appropriate behavior. This results in cluttered code and a violation of the [Separation of Concerns](/SEBook/designprinciples/soc.html) design principle, since the code for different states is mixed together and it is hard to see what the behavior of the class is in different states. This also violates the [Open/Closed principle](/SEBook/designprinciples/solid.html#openclosed-principle-ocp), since adding additional states is very hard and requires changes in many different places in the code. 

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
actor customer: Customer
participant machine: GumballMachine
participant noQuarter: NoQuarterState
participant hasQuarter: HasQuarterState
customer -> machine: insertQuarter()
activate machine
machine -> noQuarter: insertQuarter(machine)
activate noQuarter
noQuarter -> machine: setState(hasQuarter)
activate machine
deactivate machine
deactivate noQuarter
deactivate machine
customer -> machine: turnCrank()
activate machine
machine -> hasQuarter: turnCrank(machine)
activate hasQuarter
hasQuarter -> machine: releaseBall()
activate machine
deactivate machine
hasQuarter -> machine: setState(noQuarter)
activate machine
deactivate machine
deactivate hasQuarter
deactivate machine
@enduml'></div>

# Code Example

This example removes the conditional state checks from `GumballMachine`. The context delegates each action to the current state object, and the state object performs the transition.

> **Teaching example:** These snippets are intentionally small. They show one reasonable mapping of the pattern roles, not a drop-in architecture. In production, always tailor the pattern to the concrete context: lifecycle, ownership, error handling, concurrency, dependency injection, language idioms, and team conventions.

<div class="inline-language-switcher" data-language-switcher data-default-language="java">
  <div class="inline-language-tabs" role="tablist" aria-label="State code language">
    <button type="button" role="tab" data-language-option="java" aria-selected="true">Java</button>
    <button type="button" role="tab" data-language-option="cpp" aria-selected="false">C++</button>
    <button type="button" role="tab" data-language-option="python" aria-selected="false">Python</button>
    <button type="button" role="tab" data-language-option="ts" aria-selected="false">TypeScript</button>
  </div>

  <div class="inline-language-panel is-active" data-language-panel="java" role="tabpanel" markdown="1">
```java
interface State {
    void insertQuarter(GumballMachine machine);
    void turnCrank(GumballMachine machine);
}

final class NoQuarterState implements State {
    public void insertQuarter(GumballMachine machine) {
        System.out.println("You inserted a quarter");
        machine.setState(machine.hasQuarterState());
    }

    public void turnCrank(GumballMachine machine) {
        System.out.println("Insert a quarter first");
    }
}

final class HasQuarterState implements State {
    public void insertQuarter(GumballMachine machine) {
        System.out.println("Quarter already inserted");
    }

    public void turnCrank(GumballMachine machine) {
        machine.releaseBall();
        machine.setState(machine.noQuarterState());
    }
}

final class GumballMachine {
    private final State noQuarter = new NoQuarterState();
    private final State hasQuarter = new HasQuarterState();
    private State state = noQuarter;

    void insertQuarter() {
        state.insertQuarter(this);
    }

    void turnCrank() {
        state.turnCrank(this);
    }

    void setState(State state) {
        this.state = state;
    }

    State noQuarterState() { return noQuarter; }
    State hasQuarterState() { return hasQuarter; }

    void releaseBall() {
        System.out.println("A gumball comes rolling out");
    }
}

public class Demo {
    public static void main(String[] args) {
        GumballMachine machine = new GumballMachine();
        machine.insertQuarter();
        machine.turnCrank();
    }
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="cpp" role="tabpanel" markdown="1">
```cpp
#include <iostream>

class GumballMachine;

struct State {
    virtual ~State() = default;
    virtual void insertQuarter(GumballMachine& machine) = 0;
    virtual void turnCrank(GumballMachine& machine) = 0;
};

class NoQuarterState : public State {
public:
    void insertQuarter(GumballMachine& machine) override;
    void turnCrank(GumballMachine&) override {
        std::cout << "Insert a quarter first\n";
    }
};

class HasQuarterState : public State {
public:
    void insertQuarter(GumballMachine&) override {
        std::cout << "Quarter already inserted\n";
    }
    void turnCrank(GumballMachine& machine) override;
};

class GumballMachine {
public:
    GumballMachine() : state_(&noQuarter_) {}

    void insertQuarter() { state_->insertQuarter(*this); }
    void turnCrank() { state_->turnCrank(*this); }
    void setState(State& state) { state_ = &state; }
    State& noQuarterState() { return noQuarter_; }
    State& hasQuarterState() { return hasQuarter_; }

    void releaseBall() const {
        std::cout << "A gumball comes rolling out\n";
    }

private:
    NoQuarterState noQuarter_;
    HasQuarterState hasQuarter_;
    State* state_;
};

void NoQuarterState::insertQuarter(GumballMachine& machine) {
    std::cout << "You inserted a quarter\n";
    machine.setState(machine.hasQuarterState());
}

void HasQuarterState::turnCrank(GumballMachine& machine) {
    machine.releaseBall();
    machine.setState(machine.noQuarterState());
}

int main() {
    GumballMachine machine;
    machine.insertQuarter();
    machine.turnCrank();
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="python" role="tabpanel" markdown="1">
```python
from __future__ import annotations

from abc import ABC, abstractmethod


class State(ABC):
    @abstractmethod
    def insert_quarter(self, machine: GumballMachine) -> None:
        pass

    @abstractmethod
    def turn_crank(self, machine: GumballMachine) -> None:
        pass


class NoQuarterState(State):
    def insert_quarter(self, machine: GumballMachine) -> None:
        print("You inserted a quarter")
        machine.state = machine.has_quarter

    def turn_crank(self, machine: GumballMachine) -> None:
        print("Insert a quarter first")


class HasQuarterState(State):
    def insert_quarter(self, machine: GumballMachine) -> None:
        print("Quarter already inserted")

    def turn_crank(self, machine: GumballMachine) -> None:
        machine.release_ball()
        machine.state = machine.no_quarter


class GumballMachine:
    def __init__(self) -> None:
        self.no_quarter = NoQuarterState()
        self.has_quarter = HasQuarterState()
        self.state = self.no_quarter

    def insert_quarter(self) -> None:
        self.state.insert_quarter(self)

    def turn_crank(self) -> None:
        self.state.turn_crank(self)

    def release_ball(self) -> None:
        print("A gumball comes rolling out")


machine = GumballMachine()
machine.insert_quarter()
machine.turn_crank()
```
  </div>

  <div class="inline-language-panel" data-language-panel="ts" role="tabpanel" markdown="1">
```typescript
interface State {
  insertQuarter(machine: GumballMachine): void;
  turnCrank(machine: GumballMachine): void;
}

class NoQuarterState implements State {
  insertQuarter(machine: GumballMachine): void {
    console.log("You inserted a quarter");
    machine.setState(machine.hasQuarterState());
  }

  turnCrank(): void {
    console.log("Insert a quarter first");
  }
}

class HasQuarterState implements State {
  insertQuarter(): void {
    console.log("Quarter already inserted");
  }

  turnCrank(machine: GumballMachine): void {
    machine.releaseBall();
    machine.setState(machine.noQuarterState());
  }
}

class GumballMachine {
  private readonly noQuarter = new NoQuarterState();
  private readonly hasQuarter = new HasQuarterState();
  private state: State = this.noQuarter;

  insertQuarter(): void {
    this.state.insertQuarter(this);
  }

  turnCrank(): void {
    this.state.turnCrank(this);
  }

  setState(state: State): void {
    this.state = state;
  }

  noQuarterState(): State {
    return this.noQuarter;
  }

  hasQuarterState(): State {
    return this.hasQuarter;
  }

  releaseBall(): void {
    console.log("A gumball comes rolling out");
  }
}

const machine = new GumballMachine();
machine.insertQuarter();
machine.turnCrank();
```
  </div>
</div>

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

The State and [Strategy](/SEBook/designpatterns/strategy.html) patterns have nearly identical UML class diagrams—a context delegating to an abstract interface with multiple concrete implementations. The difference is entirely in **intent**:
* **State:** The context object's behavior changes *implicitly* as its internal state transitions. The client typically does not choose which state object is active.
* **Strategy:** The client *explicitly* selects which algorithm to use. There are no automatic transitions between strategies.

A useful heuristic: if the concrete implementations *transition between each other* based on internal logic, it is State. If the client *selects* the concrete implementation at configuration time, it is Strategy.

# Flashcards

{% include flashcards.html id="design_pattern_state" %}

# Quiz

{% include quiz.html id="design_pattern_state" %}
