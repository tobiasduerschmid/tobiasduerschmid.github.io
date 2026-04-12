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

## UML Role Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
interface Subject {
	+ attach(observer: Observer): void
	+ detach(observer: Observer): void
	+ notifyObservers(): void
}
interface Observer {
	+ update(): void
}
class ConcreteSubject {
	- subjectState: String
	+ getState(): String
	+ setState(value: String): void
}
class ConcreteObserver {
	- subject: ConcreteSubject
	- observerState: String
	+ update(): void
}
ConcreteSubject ..|> Subject
ConcreteObserver ..|> Observer
Subject "1" -- "0..*" Observer : observers
ConcreteObserver --> ConcreteSubject : subject
note right of Subject.notifyObservers
	for each o in observers {
		o.update()
	}
end note
note bottom of ConcreteObserver.update
	observerState =
	subject.getState()
end note
note bottom of ConcreteSubject.getState: getState() returns subjectState
@enduml'></div>

## UML Example Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
class NewsChannel {
	- latestPost: String
	- subscribers: List<Subscriber>
	+ follow(subscriber: Subscriber): void
	+ unfollow(subscriber: Subscriber): void
	+ publishPost(text: String): void
	+ getLatestPost(): String
}
interface Subscriber {
	+ update(): void
}
class MobileApp {
	- channel: NewsChannel
	+ update(): void
}
class EmailDigest {
	- channel: NewsChannel
	+ update(): void
}
NewsChannel "1" -- "0..*" Subscriber : subscribers
MobileApp ..|> Subscriber
EmailDigest ..|> Subscriber
MobileApp --> NewsChannel : channel
EmailDigest --> NewsChannel : channel
note right of NewsChannel.publishPost
	publishPost() updates
	all subscribers
end note
note bottom of EmailDigest.update
	Concrete subscribers pull only
	the state they need
end note
@enduml'></div>

## Sequence Diagram

This pattern is fundamentally about runtime collaboration, so a sequence diagram is helpful here.

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
participant creator: ContentCreator
participant channel: NewsChannel
participant app: MobileApp
participant email: EmailDigest
creator -> channel: publishPost("New video")
activate channel
channel -> app: update()
activate app
app -> channel: getLatestPost()
channel --> app: latestPost
deactivate app
channel -> email: update()
activate email
email -> channel: getLatestPost()
channel --> email: latestPost
deactivate email
deactivate channel
@enduml'></div>

# Design Decisions

## Push vs. Pull Model: 
**Push Model:** 
The *Subject* sends the **detailed state information** to the *Observer* as arguments in the `update()` method, even if the *Observer* doesn't need all data. 
This keeps the Observer completely decoupled from the Subject but can be inefficient if large data is passed unnecessarily.

**Pull Model:** 
The *Subject* sends a **minimal notification**, and the *Observer* is responsible for querying the *Subject* for the specific data it needs. This requires the *Observer* to have a reference back to the *Subject*, slightly increasing coupling, but it is often more efficient.