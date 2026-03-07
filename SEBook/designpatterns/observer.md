---
title: Observer Design Pattern
layout: sebook
---


# Problem 

In software design, you frequently encounter situations where one object's state changes, and several other objects need to be notified of this change so they can update themselves accordingly.

If the dependent objects constantly check the core object for changes (polling), it wastes valuable CPU cycles and resources. Conversely, if the core object is hard-coded to directly update all its dependent objects, the classes become tightly coupled. Every time you need to add or remove a dependent object, you have to modify the core object's code, violating the [Open/Closed Principle](https://tobiasduerschmid.github.io/SEBook/solid.html#open/closed-principle).

The core problem is: **How can a one-to-many dependency between objects be maintained efficiently without making the objects tightly coupled?**

# Context

The Observer pattern is highly applicable in scenarios requiring **distributed event handling** systems or highly decoupled architectures. Common contexts include:

* **User Interfaces (GUI)**: A classic example is the Model-View-Controller (MVC) architecture. When the underlying data (Model) changes, multiple UI components (Views) like charts, tables, or text fields must update simultaneously to reflect the new data.

* **Event Management Systems**: Applications that rely on events—such as user button clicks, incoming network requests, or file system changes—where an unknown number of listeners might want to react to a single event.

* **Social Media/News Feeds**: A system where users (observers) follow a specific creator (subject) and need to be notified instantly when new content is posted.

# Solution

The Observer design pattern solves this by establishing a one-to-many subscription mechanism.

It introduces two main roles: the ***Subject*** (the object sending updates after it has changed) and the ***Observer*** (the object listening to the updates of *Subjects*).

Instead of objects polling the *Subject* or the *Subject* being hard-wired to specific objects, the *Subject* maintains a dynamic list of *Observers*. 
It provides an interface for *Observers* to attach and detach themselves at runtime. 
When the *Subject*'s state changes, it iterates through its list of attached *Observers* and calls a specific notification method (e.g., `update()`) defined in the Observer interface.

This creates a loosely coupled system: the *Subject* only knows that its *Observers* implement a specific interface, not their concrete implementation details.

# Design Decisions

## Push vs. Pull Model: 
**Push Model:** 
The *Subject* sends the **detailed state information** to the *Observer* as arguments in the `update()` method, even if the *Observer* doesn't need all data. 
This keeps the Observer completely decoupled from the Subject but can be inefficient if large data is passed unnecessarily.

**Pull Model:** 
The *Subject* sends a **minimal notification**, and the *Observer* is responsible for querying the *Subject* for the specific data it needs. This requires the *Observer* to have a reference back to the *Subject*, slightly increasing coupling, but it is often more efficient.