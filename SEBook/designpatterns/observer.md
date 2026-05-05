---
title: Observer Design Pattern
layout: sebook
---

> **Want hands-on practice?** Try the [Interactive Observer Pattern Tutorial](/SEBook/designpatterns/observer-tutorial.html) — experience the pain of tight coupling first, then refactor into Observer step by step with live UML diagrams, debugging challenges, and quizzes.

# Problem 

In software design, you frequently encounter situations where one object's state changes, and several other objects need to be notified of this change so they can update themselves accordingly. As the *Gang of Four* (GoF — the four authors of *Design Patterns* {% cite Gamma1995 %}) describe it, this is a common side-effect of partitioning a system into a collection of cooperating classes: you need to maintain consistency between related objects, but you don't want to achieve that consistency by making the classes tightly coupled, because that reduces their reusability.

The classic motivating example (GoF Observer chapter) is a graphical user interface toolkit that separates presentation from the underlying application data: a spreadsheet view and a bar chart can both depict the same numerical data using different presentations. The two views don't know about each other, yet they must *behave* as though they do — when the user edits a value in the spreadsheet, the bar chart must reflect the change immediately, and vice versa. There is no reason to limit the number of dependents to two; any number of different views may want to display the same data.

If the dependent objects constantly check the core object for changes (polling), it wastes valuable CPU cycles and resources. Conversely, if the core object is hard-coded to directly update all its dependent objects, the classes become tightly coupled. Every time you need to add or remove a dependent object, you have to modify the core object's code, violating the [Open/Closed Principle](/SEBook/designprinciples/solid.html#openclosed-principle-ocp).

The core problem is: **How can a one-to-many dependency between objects be maintained efficiently without making the objects tightly coupled?**

> **Intent (GoF):** *"Define a one-to-many dependency between objects so that when one object changes state, all its dependents are notified and updated automatically."*
>
> **Also Known As:** *Dependents, Publish-Subscribe* (the GoF Observer chapter explicitly lists both as alternative names; POSA1 {% cite Buschmann1996 %} documents the related pattern under the name *Publisher-Subscriber*, with *Observer* and *Dependents* as aliases).

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
Subject "1" -- "*" Observer : observers
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
NewsChannel "1" -- "*" Subscriber : _subscribers
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
	print(f"[MobileApp] {self._channel.get_latest_post()}")
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
activate channel
deactivate channel
client -> channel: follow(email)
activate channel
deactivate channel
client -> channel: publish_post("New video uploaded!")
activate channel
channel -> channel: _notify_subscribers()
activate channel
channel -> app: update()
activate app
app -> channel: get_latest_post()
activate channel
channel --> app: "New video uploaded!"
deactivate channel
deactivate app
channel -> email: update()
activate email
email -> channel: get_latest_post()
activate channel
channel --> email: "New video uploaded!"
deactivate channel
deactivate email
deactivate channel
deactivate channel
client -> channel: unfollow(email)
activate channel
deactivate channel
client -> channel: publish_post("Live stream starting!")
activate channel
channel -> channel: _notify_subscribers()
activate channel
channel -> app: update()
activate app
app -> channel: get_latest_post()
activate channel
channel --> app: "Live stream starting!"
deactivate channel
deactivate app
deactivate channel
deactivate channel
@enduml'></div>

# Code Example

This sample implements the pull-style News Channel example from the diagrams. The subject sends a simple notification; each observer asks the subject for the latest post.

> **Teaching example:** These snippets are intentionally small. They show one reasonable mapping of the pattern roles, not a drop-in architecture. In production, always tailor the pattern to the concrete context: lifecycle, ownership, error handling, concurrency, dependency injection, language idioms, and team conventions.

<div class="inline-language-switcher" data-language-switcher data-default-language="java">
  <div class="inline-language-tabs" role="tablist" aria-label="Observer code language">
    <button type="button" role="tab" data-language-option="java" aria-selected="true">Java</button>
    <button type="button" role="tab" data-language-option="cpp" aria-selected="false">C++</button>
    <button type="button" role="tab" data-language-option="python" aria-selected="false">Python</button>
    <button type="button" role="tab" data-language-option="ts" aria-selected="false">TypeScript</button>
  </div>

  <div class="inline-language-panel is-active" data-language-panel="java" role="tabpanel" markdown="1">
```java
import java.util.ArrayList;
import java.util.List;

interface Subscriber {
    void update();
}

final class NewsChannel {
    private final List<Subscriber> subscribers = new ArrayList<>();
    private String latestPost = "";

    void follow(Subscriber subscriber) {
        subscribers.add(subscriber);
    }

    void unfollow(Subscriber subscriber) {
        subscribers.remove(subscriber);
    }

    void publishPost(String text) {
        latestPost = text;
        subscribers.forEach(Subscriber::update);
    }

    String getLatestPost() {
        return latestPost;
    }
}

final class MobileApp implements Subscriber {
    private final NewsChannel channel;

    MobileApp(NewsChannel channel) {
        this.channel = channel;
    }

    public void update() {
        System.out.println("[MobileApp] " + channel.getLatestPost());
    }
}

final class EmailDigest implements Subscriber {
    private final NewsChannel channel;

    EmailDigest(NewsChannel channel) {
        this.channel = channel;
    }

    public void update() {
        System.out.println("[EmailDigest] " + channel.getLatestPost());
    }
}

public class Demo {
    public static void main(String[] args) {
        NewsChannel channel = new NewsChannel();
        Subscriber app = new MobileApp(channel);
        Subscriber email = new EmailDigest(channel);
        channel.follow(app);
        channel.follow(email);
        channel.publishPost("New video uploaded!");
        channel.unfollow(email);
        channel.publishPost("Live stream starting!");
    }
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="cpp" role="tabpanel" markdown="1">
```cpp
#include <algorithm>
#include <iostream>
#include <string>
#include <utility>
#include <vector>

struct Subscriber {
    virtual ~Subscriber() = default;
    virtual void update() = 0;
};

class NewsChannel {
public:
    void follow(Subscriber& subscriber) {
        subscribers_.push_back(&subscriber);
    }

    void unfollow(Subscriber& subscriber) {
        subscribers_.erase(
            std::remove(subscribers_.begin(), subscribers_.end(), &subscriber),
            subscribers_.end());
    }

    void publishPost(std::string text) {
        latestPost_ = std::move(text);
        for (auto* subscriber : subscribers_) {
            subscriber->update();
        }
    }

    const std::string& latestPost() const {
        return latestPost_;
    }

private:
    std::vector<Subscriber*> subscribers_;
    std::string latestPost_;
};

class MobileApp : public Subscriber {
public:
    explicit MobileApp(const NewsChannel& channel) : channel_(channel) {}

    void update() override {
        std::cout << "[MobileApp] " << channel_.latestPost() << "\n";
    }

private:
    const NewsChannel& channel_;
};

class EmailDigest : public Subscriber {
public:
    explicit EmailDigest(const NewsChannel& channel) : channel_(channel) {}

    void update() override {
        std::cout << "[EmailDigest] " << channel_.latestPost() << "\n";
    }

private:
    const NewsChannel& channel_;
};

int main() {
    NewsChannel channel;
    MobileApp app(channel);
    EmailDigest email(channel);
    channel.follow(app);
    channel.follow(email);
    channel.publishPost("New video uploaded!");
    channel.unfollow(email);
    channel.publishPost("Live stream starting!");
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="python" role="tabpanel" markdown="1">
```python
from abc import ABC, abstractmethod


class Subscriber(ABC):
    @abstractmethod
    def update(self) -> None:
        pass


class NewsChannel:
    def __init__(self) -> None:
        self._subscribers: list[Subscriber] = []
        self._latest_post = ""

    def follow(self, subscriber: Subscriber) -> None:
        self._subscribers.append(subscriber)

    def unfollow(self, subscriber: Subscriber) -> None:
        self._subscribers.remove(subscriber)

    def publish_post(self, text: str) -> None:
        self._latest_post = text
        for subscriber in self._subscribers:
            subscriber.update()

    def get_latest_post(self) -> str:
        return self._latest_post


class MobileApp(Subscriber):
    def __init__(self, channel: NewsChannel) -> None:
        self._channel = channel

    def update(self) -> None:
        print(f"[MobileApp] {self._channel.get_latest_post()}")


class EmailDigest(Subscriber):
    def __init__(self, channel: NewsChannel) -> None:
        self._channel = channel

    def update(self) -> None:
        print(f"[EmailDigest] {self._channel.get_latest_post()}")


channel = NewsChannel()
app = MobileApp(channel)
email = EmailDigest(channel)
channel.follow(app)
channel.follow(email)
channel.publish_post("New video uploaded!")
channel.unfollow(email)
channel.publish_post("Live stream starting!")
```
  </div>

  <div class="inline-language-panel" data-language-panel="ts" role="tabpanel" markdown="1">
```typescript
interface Subscriber {
  update(): void;
}

class NewsChannel {
  private subscribers: Subscriber[] = [];
  private latestPost = "";

  follow(subscriber: Subscriber): void {
    this.subscribers.push(subscriber);
  }

  unfollow(subscriber: Subscriber): void {
    this.subscribers = this.subscribers.filter((item) => item !== subscriber);
  }

  publishPost(text: string): void {
    this.latestPost = text;
    this.subscribers.forEach((subscriber) => subscriber.update());
  }

  getLatestPost(): string {
    return this.latestPost;
  }
}

class MobileApp implements Subscriber {
  constructor(private readonly channel: NewsChannel) {}

  update(): void {
    console.log(`[MobileApp] ${this.channel.getLatestPost()}`);
  }
}

class EmailDigest implements Subscriber {
  constructor(private readonly channel: NewsChannel) {}

  update(): void {
    console.log(`[EmailDigest] ${this.channel.getLatestPost()}`);
  }
}

const channel = new NewsChannel();
const app = new MobileApp(channel);
const email = new EmailDigest(channel);
channel.follow(app);
channel.follow(email);
channel.publishPost("New video uploaded!");
channel.unfollow(email);
channel.publishPost("Live stream starting!");
```
  </div>
</div>

# Design Decisions

## Push vs. Pull Model
This is the most important design decision when tailoring the Observer pattern.

**Push Model:** 
The *Subject* sends the **detailed state information** to the *Observer* as arguments in the `update()` method, even if the *Observer* doesn't need all data. 
The *Observer* doesn't need a reference back to the *Subject*, but it does become coupled to the *Subject*'s data format — which can compromise *Observer* reusability across different *Subjects*. It can also be inefficient if large data is passed unnecessarily. Use this when all observers need the same data, or when the Subject's interface should remain hidden from observers.

**Pull Model:** 
The *Subject* sends a **minimal notification**, and the *Observer* is responsible for querying the *Subject* for the specific data it needs. This requires the *Observer* to have a reference back to the *Subject*, slightly increasing coupling. It can be more efficient than push when different observers need different subsets of data (each pulls only what it uses), but less efficient when every observer would consume the same payload that push could deliver in one call. Use this when different observers need different subsets of data, or when the data is expensive to compute and not all observers will use it.

**Hybrid Model:** The *Subject* pushes the *type* of change (e.g., an event enum or change descriptor), and observers decide whether to pull additional data based on the event type. This balances decoupling with efficiency and is the most common approach in modern frameworks.

## Observer Lifecycle: The Lapsed Listener Problem
A critical but often overlooked decision is how observer registrations are managed over time. If an observer registers with a subject but is never explicitly detached, the subject's reference list keeps the observer alive in memory—even after the observer is otherwise unused. This is the **lapsed listener problem**, a common source of memory leaks. Solutions include:
* **Explicit unsubscribe:** Require observers to detach themselves (disciplined but error-prone).
* **Weak references:** The subject holds weak references to observers, allowing garbage collection (language-dependent).
* **Scoped subscriptions:** Tie the observer's registration to a lifecycle scope that automatically unsubscribes on cleanup (common in modern UI frameworks).

## Notification Trigger
Who triggers the notification? GoF (Implementation issue #3, "Who triggers the update?") frames the same trade-off, listing two options; modern practice adds a third:
* **Automatic:** The Subject's setter methods call `notifyObservers()` after every state change. Simple — clients don't have to remember to call notify — but consecutive state changes cause consecutive notifications, which may be inefficient.
* **Client-triggered:** The client explicitly calls `notifyObservers()` after making all desired changes. The client can wait until a series of state changes is complete, avoiding needless intermediate updates, but clients carry the responsibility and may forget.
* **Batched/deferred:** Notifications are collected and dispatched after a delay or at a synchronization point, reducing redundant updates.

## Self-Consistency Before Notification
GoF (Implementation issue #5) warns that a *Subject* must be in a self-consistent state before calling notify, because observers will query the subject for its current state during their update. This is easy to violate when a subclass operation calls an inherited operation that triggers the notification *before* the subclass has finished its own state update. A standard fix is to send notifications from a Template Method in the abstract Subject — define a primitive operation for subclasses to override, and make `Notify()` the last step of the template method, so the object is guaranteed to be self-consistent when subclasses override Subject operations.

## Observing Multiple Subjects
GoF (Implementation issue #2) notes that an observer may depend on more than one subject (e.g., a spreadsheet cell that draws from several data sources). In that case, the `update()` operation needs to tell the observer *which* subject changed — typically by passing the subject as a parameter (`update(Subject* changedSubject)`). The pull style naturally supports this; a pure push style with no subject identity makes it harder.

## Dangling References to Deleted Subjects
GoF (Implementation issue #4) flags a subtle ownership bug: if a subject is deleted while observers still hold references to it, those references dangle. One remedy is to have the subject notify its observers as it is destroyed, so they can null out their references. This is the dual of the lapsed-listener problem above and matters most in languages without garbage collection.

## Specifying Modifications of Interest (Aspects)
GoF (Implementation issue #7) discusses extending the registration interface so observers can subscribe only to *specific* events of interest (e.g., `Subject::Attach(Observer*, Aspect& interest)`). This avoids waking up every observer on every change and is the conceptual ancestor of typed event handlers in modern frameworks (e.g., separate listener interfaces per event type, or topic-based publish-subscribe).

## Encapsulating Complex Update Semantics (ChangeManager)
When the dependency graph between subjects and observers is intricate — e.g., observers depend on multiple subjects and you must avoid duplicate updates when several change at once — GoF (Implementation issue #9) recommends introducing a separate **ChangeManager** object that maps subjects to observers, defines an update strategy, and dispatches updates on the subject's behalf. GoF cite two specializations: a `SimpleChangeManager` that always updates every observer, and a `DAGChangeManager` that handles directed acyclic graphs of dependencies and ensures each observer is updated only once per change event. The ChangeManager is itself an instance of the [Mediator](/SEBook/designpatterns/mediator.html) pattern and is typically a [Singleton](/SEBook/designpatterns/singleton.html).

# Consequences

Applying the Observer pattern yields several important consequences. The first three are the canonical GoF benefits (Consequences §1–§3); the remaining items capture liabilities GoF flag and one widely observed comprehension issue.
* **Abstract coupling between Subject and Observer (loose coupling):** The subject knows only that its observers conform to a simple interface — not their concrete classes. Because Subject and Observer aren't tightly coupled, they can also belong to different layers of abstraction in the system: a lower-level subject can notify a higher-level observer without violating the layering.
* **Support for broadcast communication:** Unlike an ordinary request, the notification a subject sends needn't specify its receiver — it is broadcast automatically to every observer that subscribed. The subject doesn't care how many interested objects exist; it is up to each observer to handle or ignore a notification.
* **Dynamic Relationships:** Observers can be added and removed at any time during execution, enabling highly flexible architectures.
* **Unexpected updates:** Because observers have no knowledge of each other's presence, a seemingly innocuous operation on the subject can cause a cascade of updates to observers and their dependent objects. The simple `update()` protocol carries no information about *what* changed, so observers may have to work hard to deduce the changes — a frequent source of subtle bugs that are hard to track down.
* **Inverted dependency flow makes comprehension harder:** Conceptually, data flows from subject to observer, but in the *code* the observer calls the subject to register itself. When a reader encounters an observer for the first time, there is no sign near the observer of *what* it depends on — the wiring lives elsewhere. This inversion is widely cited as a comprehension hazard for Observer-based systems and is one reason modern reactive frameworks try to make the dependency graph explicit at the call site.

# Known Uses

GoF cite the following examples; the pattern is far more pervasive today, but these are the historical anchors:

* **Smalltalk Model/View/Controller (MVC):** the first and best-known use. Smalltalk's `Model` plays the role of Subject and `View` is the base class for observers. Smalltalk, ET++, and the THINK class library put Subject and Observer interfaces in the root class `Object`, making the dependency mechanism available to every object in the system.
* **InterViews, the Andrew Toolkit, and Unidraw** all employ the pattern in their UI frameworks. InterViews defines `Observer` and `Observable` classes explicitly; Andrew calls them "view" and "data object"; Unidraw splits graphical editor objects into View (observers) and Subject parts.
* **Java's standard library:** `java.util.Observer` / `java.util.Observable` provided a built-in implementation. *Caveat for modern code:* both have since been deprecated in modern JDKs because `Observable` is a class (forcing single inheritance) with `protected` methods that require subclassing rather than composition — Head First Design Patterns' "dark side of `java.util.Observable`" section in Chapter 2 lays out exactly these criticisms. Modern Java code typically uses `java.beans.PropertyChangeListener`, the Flow API publishers, or a third-party reactive library instead.
* **Swing and JavaBeans:** the listener model in `JButton`/`AbstractButton` (`addActionListener`, etc.) is a typed-event variant of Observer; `PropertyChangeListener` plays a similar role at the bean level.

# Related Patterns

* **[Mediator](/SEBook/designpatterns/mediator.html):** GoF note that the *ChangeManager* described under Implementation is itself a Mediator — it sits between subjects and observers and encapsulates complex update semantics so neither side has to know about the other directly.
* **[Singleton](/SEBook/designpatterns/singleton.html):** A *ChangeManager* is typically unique and globally accessible, making Singleton a natural choice for its lifecycle.
* **Template Method:** A common technique for keeping subjects self-consistent before notifying (Implementation issue #5) is to put `Notify()` as the final step of a template method in the abstract Subject, with the state-changing primitive operation overridden in subclasses.
* **POSA1's Publisher-Subscriber:** documents the same pattern at a coarser, architectural granularity — for example as a *Gatekeeper* or as an *Event Channel* between processes — and is the conceptual root of message-broker and pub/sub middleware.
