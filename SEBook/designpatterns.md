---
title: Design Patterns
layout: sebook
---



# State

## Problem 

The core problem the State pattern addresses is when an object's behavior **needs to change dramatically based on its internal state**, and this leads to code that is complex, difficult to maintain, and hard to extend.

If you try to manage state changes using traditional methods, the class containing the state often becomes polluted with large, complex if/else or switch statements that check the current state and execute the appropriate behavior. This results in cluttered code and a violation of the Separation of Concerns design principle, since the code different states is mixed together and it is hard to see what the behavior of the class is in different states. This also violates the Open/Closed principle, since adding additional states is very hard and requires changes in many different places in the code. 

## Context

An object's behavior depends on its state, and it must change that behavior at runtime. You either have many states already or you might need to add more states later. 

## Solution

Create an **Abstract State class** that defines the interface that all states have. The Context class should not know any state methods besides the methods in the Abstract State so that it is not tempted to implement any state-dependent behavior itself. For each state-dependent method (i.e., for each method that should be implemented differently depending on which state the Context is in) we should define one abstract method in the Abstract State class. 

Create **Concrete State classes** that inherit from the Abstract State and implement the remaining methods. 




The only interactions that should be allows are interactions between the Context and Concrete States. There are no interaction among Concrete States objects.

## Details / Design Decisions:

### How to let the state make operations on the context object?
The state-dependent behavior often needs to make changes to the Context. To implement this, the state object can either store a reference to the Context (usually implemented in the Abstract State class) or the context object is passed into the state with every call to a state-dependent method.  

### How to represent a state in which the object is never doing anything (either at initialization time or as a "final" state)

Use the Null Object pattern to create a ["null state"](https://en.wikipedia.org/wiki/Null_object_pattern)


# Observer

## Problem 

## Context

## Solution

The Observer design pattern solves this by establishing a one-to-many subscription mechanism.

It introduces two main roles: the ***Subject*** (the object sending updates after it has changed) and the ***Observer*** (the object listening to the updates of *Subjects*).

Instead of objects polling the *Subject* or the *Subject* being hard-wired to specific objects, the *Subject* maintains a dynamic list of *Observers*. 
It provides an interface for *Observers* to attach and detach themselves at runtime. 
When the *Subject*'s state changes, it iterates through its list of attached *Observers* and calls a specific notification method (e.g., `update()`) defined in the Observer interface.

This creates a loosely coupled system: the *Subject* only knows that its *Observers* implement a specific interface, not their concrete implementation details.

## Details / Design Decisions:

### Push vs. Pull Model: 
**Push Model:** 
The *Subject* sends the **detailed state information** to the *Observer* as arguments in the `update()` method, even if the *Observer* doesn't need all data. 
This keeps the Observer completely decoupled from the Subject but can be inefficient if large data is passed unnecessarily.

**Pull Model:** 
The *Subject* sends a **minimal notification**, and the *Observer* is responsible for querying the *Subject* for the specific data it needs. This requires the *Observer* to have a reference back to the *Subject*, slightly increasing coupling, but it is often more efficient.