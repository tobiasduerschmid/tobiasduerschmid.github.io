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
	```java
	for (Observer o : observers) {
	    o.update();
	}
	```
end note
note bottom of ConcreteObserver.update
	```java
	observerState = subject.getState();
	```
end note
note left of ConcreteSubject.getState: return subjectState
@enduml'></div>

## UML Example Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
class NewsChannel {
	- _subscribers: list[Subscriber]
	- _latest_post: str
	+ follow(subscriber: Subscriber)
	+ unfollow(subscriber: Subscriber)
	+ publish_post(text: str)
	+ get_latest_post(): str
	- _notify_subscribers()
}
abstract class Subscriber <<ABC>> {
	+ {abstract} update()
}
class MobileApp {
	- _channel: NewsChannel
	+ update()
}
class EmailDigest {
	- _channel: NewsChannel
	+ update()
}
NewsChannel "1" -- "0..*" Subscriber : _subscribers
MobileApp --|> Subscriber
EmailDigest --|> Subscriber
MobileApp --> NewsChannel : _channel
EmailDigest --> NewsChannel : _channel
note right of NewsChannel._notify_subscribers
	```python
	for subscriber in self._subscribers:
	    subscriber.update()
	```
end note
note bottom of MobileApp.update
	```python
	post = self._channel.get_latest_post()
	print(f"[MobileApp] Push notification: {post}")
	```
end note
@enduml'></div>

## Sequence Diagram

This pattern is fundamentally about runtime collaboration, so a sequence diagram is helpful here.

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
participant client: Client
participant channel: NewsChannel
participant app: MobileApp
participant email: EmailDigest
client -> channel: follow(app)
client -> channel: follow(email)
client -> channel: publish_post("New video uploaded!")
activate channel
channel -> channel: _notify_subscribers()
channel -> app: update()
activate app
app -> channel: get_latest_post()
channel --> app: "New video uploaded!"
deactivate app
channel -> email: update()
activate email
email -> channel: get_latest_post()
channel --> email: "New video uploaded!"
deactivate email
deactivate channel
client -> channel: unfollow(email)
client -> channel: publish_post("Live stream starting!")
activate channel
channel -> channel: _notify_subscribers()
channel -> app: update()
activate app
app -> channel: get_latest_post()
channel --> app: "Live stream starting!"
deactivate app
deactivate channel
@enduml'></div>

# Sample Code

This sample code implements the Observer pattern using the News Channel example from the UML diagrams above:

```python
from abc import ABC, abstractmethod


# ==========================================
# OBSERVER INTERFACE
# ==========================================
class Subscriber(ABC):
    """The Observer interface."""
    @abstractmethod
    def update(self):
        pass


# ==========================================
# SUBJECT
# ==========================================
class NewsChannel:
    """The Subject that maintains a list of subscribers and notifies them."""
    def __init__(self):
        self._subscribers: list[Subscriber] = []
        self._latest_post: str = ""

    def follow(self, subscriber: Subscriber):
        if subscriber not in self._subscribers:
            self._subscribers.append(subscriber)

    def unfollow(self, subscriber: Subscriber):
        self._subscribers.remove(subscriber)

    def publish_post(self, text: str):
        self._latest_post = text
        self._notify_subscribers()

    def get_latest_post(self) -> str:
        return self._latest_post

    def _notify_subscribers(self):
        for subscriber in self._subscribers:
            subscriber.update()


# ==========================================
# CONCRETE OBSERVERS
# ==========================================
class MobileApp(Subscriber):
    """A concrete observer that pulls state from the channel on update."""
    def __init__(self, channel: NewsChannel):
        self._channel = channel

    def update(self):
        post = self._channel.get_latest_post()
        print(f"[MobileApp] Push notification: {post}")


class EmailDigest(Subscriber):
    """Another concrete observer with different behavior."""
    def __init__(self, channel: NewsChannel):
        self._channel = channel

    def update(self):
        post = self._channel.get_latest_post()
        print(f"[EmailDigest] New email queued: {post}")


# ==========================================
# CLIENT CODE
# ==========================================
channel = NewsChannel()

app = MobileApp(channel)
email = EmailDigest(channel)

channel.follow(app)
channel.follow(email)

channel.publish_post("New video uploaded!")
# [MobileApp] Push notification: New video uploaded!
# [EmailDigest] New email queued: New video uploaded!

channel.unfollow(email)

channel.publish_post("Live stream starting!")
# [MobileApp] Push notification: Live stream starting!
```

# Design Decisions

## Push vs. Pull Model
This is the most important design decision when tailoring the Observer pattern.

**Push Model:** 
The *Subject* sends the **detailed state information** to the *Observer* as arguments in the `update()` method, even if the *Observer* doesn't need all data. 
This keeps the Observer completely decoupled from the Subject but can be inefficient if large data is passed unnecessarily. Use this when all observers need the same data, or when the Subject's interface should remain hidden from observers.

**Pull Model:** 
The *Subject* sends a **minimal notification**, and the *Observer* is responsible for querying the *Subject* for the specific data it needs. This requires the *Observer* to have a reference back to the *Subject*, slightly increasing coupling, but it is often more efficient. Use this when different observers need different subsets of data.

**Hybrid Model:** The *Subject* pushes the *type* of change (e.g., an event enum or change descriptor), and observers decide whether to pull additional data based on the event type. This balances decoupling with efficiency and is the most common approach in modern frameworks.

## Observer Lifecycle: The Lapsed Listener Problem
A critical but often overlooked decision is how observer registrations are managed over time. If an observer registers with a subject but is never explicitly detached, the subject's reference list keeps the observer alive in memory—even after the observer is otherwise unused. This is the **lapsed listener problem**, a common source of memory leaks. Solutions include:
* **Explicit unsubscribe:** Require observers to detach themselves (disciplined but error-prone).
* **Weak references:** The subject holds weak references to observers, allowing garbage collection (language-dependent).
* **Scoped subscriptions:** Tie the observer's registration to a lifecycle scope that automatically unsubscribes on cleanup (common in modern UI frameworks).

## Notification Trigger
Who triggers the notification? Three options exist:
* **Automatic:** The Subject's setter methods call `notifyObservers()` after every state change. Simple but can cause notification storms if multiple properties are updated in sequence.
* **Client-triggered:** The client explicitly calls `notifyObservers()` after making all desired changes. More efficient but places the burden on the client.
* **Batched/deferred:** Notifications are collected and dispatched after a delay or at a synchronization point, reducing redundant updates.

# Consequences

Applying the Observer pattern yields several important consequences:
* **Loose Coupling:** The subject and observers can vary independently. The subject knows only that its observers implement a given interface—not their concrete types, not how many there are, not what they do with the data.
* **Dynamic Relationships:** Observers can be added and removed at any time during execution, enabling highly flexible architectures.
* **Broadcast Communication:** When the subject changes, all registered observers are notified—the subject does not need to know who they are.
* **Unexpected Updates:** Because observers have no knowledge of each other, a change triggered by one observer can cascade through the system in unexpected ways. A notification chain where observer A's update triggers subject B's notification, which updates observer C, can be very difficult to debug.
* **Inverted Dependency Flow:** An empirical study on reactive programming found that the Observer pattern *inverts the natural dependency flow* in code. Conceptually, data flows from subject to observer, but in the code, observers call the subject to register themselves. This means that when a reader encounters an observer for the first time, there is no sign in the code near the observer of *what* it depends on. This inversion makes program comprehension harder—a critical insight for anyone debugging Observer-based systems.

# Flashcards

{% include flashcards.html id="design_pattern_observer" %}

# Quiz

{% include quiz.html id="design_pattern_observer" %}