---
title: "UML Sequence Diagrams"
layout: sebook
---
# Unlocking System Behavior with UML Sequence Diagrams

## Introduction: The "Who, What, and When" of Systems

Imagine walking into a coffee shop. You place an order with the barista, the barista sends the ticket to the kitchen, the kitchen makes the coffee, and finally, the barista hands it to you. This entire process is a *sequence of interactions* happening over *time*.

In software engineering, we need a way to visualize these step-by-step interactions between different parts of a system. This is exactly what **Unified Modeling Language (UML) Sequence Diagrams** do. They show us *who* is talking to *whom*, *what* they are saying, and in *what order*.

### Learning Objectives

By the end of this chapter, you will be able to:

1.  Identify the core components of a sequence diagram: Lifelines and Messages.
2.  Differentiate between synchronous, asynchronous, and return messages.
3.  Model conditional logic using **ALT** and **OPT** fragments.
4.  Model repetitive behavior using **LOOP** fragments.

-----

## Part 1: The Basics – Lifelines and Messages

To manage your cognitive load, we will start with just the two most fundamental building blocks: the entities communicating, and the communications themselves.

### 1\. Lifelines (The "Who")

A lifeline represents an individual participant in the interaction. It is drawn as a box at the top (with the participant's name) and a dashed vertical line extending downwards. Time flows from top to bottom along this dashed line.

### 2\. Messages (The "What")

Messages are the communications between lifelines. They are drawn as horizontal arrows. UML 2 distinguishes three main arrow styles (sources: Fowler, *UML Distilled*, ch. 4; Rumbaugh, Jacobson & Booch, *The Unified Modeling Language Reference Manual*):

  * **Synchronous Message** <span class="uml-sym" data-diagram="sequence" data-sym="->"></span> — solid line with **filled (triangular) arrowhead**. The sender blocks until the receiver responds, like calling a method and waiting for it to return.
  * **Asynchronous Message** <span class="uml-sym" data-diagram="sequence" data-sym="->>"></span> — solid line with **open (stick) arrowhead**. The sender fires the message and continues immediately, like putting an event on a queue or sending an HTTP POST without awaiting the response.
  * **Return Message** <span class="uml-sym" data-diagram="sequence" data-sym="-->"></span> — **dashed** line with open arrowhead. Represents control (and often a value) returning to the original caller. Return arrows are optional in UML 2: include them when the returned value is important, omit them when a synchronous call obviously returns.

> **⚠ Common mistake:** Students often confuse the filled vs. open arrowhead, treating both as synchronous. The rule: **filled = blocks, open = fires-and-forgets**. Remember it as "filled is full commitment; open lets go."

### Visualizing the Basics: A Simple ATM Login

Let's look at the sequence of a user inserting a card into an ATM.

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
participant customer: Customer
participant atm: ATM
participant bank: Bank Server
customer -> atm: (1) insertCard()
atm -> bank: (2) verifyCard()
bank --> atm: (3) cardValid()
atm --> customer: (4) promptPIN()
@enduml'></div>

**Notice the flow of time:** Message 1 happens first, then 2, 3, and 4. The vertical dimension is strictly used to represent the passage of time.

> **Stop and Think (Retrieval Practice):** If the ATM sent an alert to your phone about a login attempt but didn't wait for you to reply before proceeding, what type of message arrow would represent that alert? *(Think about your answer before reading on).*

<details>
<summary><i>Reveal Answer</i></summary>
An asynchronous message, represented by an open/stick arrowhead, because the ATM does not wait for a response.
</details>

-----

## Part 1.5: Activation Bars and Object Naming

Now that you understand the basic elements, let's add two important details that appear in real-world sequence diagrams.

### Activation Bars (Execution Specifications)

An **activation bar** (also called an execution specification) is a thin rectangle drawn on a lifeline. It represents the period during which an object is **actively performing an action or behavior**---for example, executing a method. Activation bars can be nested across actors and within a single actor (e.g., when an object calls one of its own methods).

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
participant passenger: Passenger
participant station: Station
participant train: Train
passenger -> station: pushButton()
activate station
station -> train: addStop()
activate train
deactivate train
deactivate station
train -> train: openDoors()
activate train
passenger -> station: pushButton(S)
activate station
station -> train: closeDoors()
activate train
deactivate train
deactivate station
deactivate train
@enduml'></div>

The blue bars show when each object is actively processing. Notice how the `Station` is active from when it receives `pushButton()` until the `Train` finishes processing `addStop()`.

### Object Naming Convention

Lifelines in sequence diagrams represent specific **object instances**, not classes. The standard naming convention is:

`objectName : ClassName`

- If the specific object name matters: <span class="uml-sym" data-diagram="sequence" data-sym="head-named" data-label="myCart : ShoppingCart"></span>
- If only the class matters: <span class="uml-sym" data-diagram="sequence" data-sym="head-anon" data-label=": ShoppingCart"></span> (anonymous instance)
- Multiple instances of the same class get distinct names: <span class="uml-sym" data-diagram="sequence" data-sym="head-multi" data-label="server[i] : Server"></span>

This is different from class diagrams, which show classes in general. Sequence diagrams show **one particular scenario** of interactions between concrete instances.

### Consistency with Class Diagrams

When you draw both a class diagram and a sequence diagram for the same system, they must be **consistent**:
- Every message arrow in the sequence diagram must correspond to a method defined in the receiving object's class (or a superclass).
- The method names, parameter types, and return types must match between the two diagrams.

---

## Part 2: Adding Logic – Combined Fragments

Real-world systems rarely follow a single, straight path. Things go wrong, conditions change, and actions repeat. UML uses **Combined Fragments** to enclose portions of the sequence diagram and apply logic to them.

Fragments are drawn as large boxes surrounding the relevant messages, with a tag in the top-left corner declaring the type of logic, such as <span class="uml-sym" data-diagram="sequence" data-sym="frag-opt"></span>, <span class="uml-sym" data-diagram="sequence" data-sym="frag-alt"></span>, <span class="uml-sym" data-diagram="sequence" data-sym="frag-loop"></span>, or <span class="uml-sym" data-diagram="sequence" data-sym="frag-ref"></span>.

Common fragment syntax in sequence diagrams:

- Optional behavior: <span class="uml-sym" data-diagram="sequence" data-sym="frag-opt"></span>
- Alternatives with guarded branches: <span class="uml-sym" data-diagram="sequence" data-sym="frag-alt"></span>
- Repetition: <span class="uml-sym" data-diagram="sequence" data-sym="frag-loop"></span>
- Parallel branches: <span class="uml-sym" data-diagram="sequence" data-sym="frag-par"></span>
- Early exit: <span class="uml-sym" data-diagram="sequence" data-sym="frag-break"></span>
- Critical region: <span class="uml-sym" data-diagram="sequence" data-sym="frag-critical"></span>
- Interaction reference: <span class="uml-sym" data-diagram="sequence" data-sym="frag-ref"></span>

### 1\. The OPT Fragment (Optional Behavior) <span class="uml-sym" data-diagram="sequence" data-sym="frag-opt"></span>

The `opt` fragment is equivalent to an `if` statement without an `else`. The messages inside the box only occur *if* a specific condition (called a guard) is true.

**Scenario:** A customer is buying an item. *If* they have a loyalty account, they receive a discount.

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
participant checkout: Checkout System
participant pricing: Pricing Engine
checkout -> pricing: calculateTotal()
opt [hasLoyaltyAccount == true]
  checkout -> pricing: applyDiscount()
  pricing --> checkout: discountApplied()
end
pricing --> checkout: finalTotal()
@enduml'></div>

*Notice the `[hasLoyaltyAccount == true]` text. This is the **guard condition**. If it evaluates to false, the sequence skips the entire box.*

### 2\. The ALT Fragment (Alternative Behaviors) <span class="uml-sym" data-diagram="sequence" data-sym="frag-alt"></span>

The `alt` fragment is equivalent to an `if-else` or `switch` statement. The box is divided by a dashed horizontal line. The sequence will execute *only one* of the divided sections based on which guard condition is true.

**Scenario:** Verifying a user's password.

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
participant system: System
participant db: Database
system -> db: checkPassword()
alt [password is correct]
  db --> system: loginSuccess()
else [password is incorrect]
  db --> system: loginFailed()
end
@enduml'></div>

### 3\. The LOOP Fragment (Repetitive Behavior) <span class="uml-sym" data-diagram="sequence" data-sym="frag-loop"></span>

The `loop` fragment represents a `for` or `while` loop. The messages inside the box are repeated as long as the guard condition remains true, or for a specified number of times.

**Scenario:** Pinging a server until it wakes up (maximum 3 times).

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
participant app: App
participant server: Server
loop [up to 3 times]
  app -> server: ping()
  server --> app: ack()
end
@enduml'></div>

-----

## Part 3: Putting It All Together (Interleaved Practice)

To truly understand how these elements work, we must view them interacting in a complex system. Combining different concepts requires you to interleave your knowledge, which strengthens your mental model.

**The Scenario: A Smart Home Alarm System**

1.  The user arms the system.
2.  The system checks all windows.
3.  It loops through every window.
4.  *If* a window is open (ALT), it warns the user. *Else*, it locks it.
5.  *Optionally* (OPT), if the user has SMS alerts on, it texts them.

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
participant user: User
participant hub: Alarm Hub
participant sensors: Window Sensors
participant sms: SMS API
user -> hub: armSystem()
loop [for each window]
  hub -> sensors: getStatus()
  sensors --> hub: statusData()
  alt [status == "Open"]
    hub --> user: warn()
  else [status == "Closed"]
    hub -> sensors: lock()
  end
end
opt [smsEnabled == true]
  hub -> sms: sendText("Armed")
end
@enduml'></div>

-----

## Part 4: Combined Fragment Reference

The three fragments above (opt, alt, loop) are the most common, but UML defines additional fragment operators:

| Fragment | Meaning | Code Equivalent |
|----------|---------|-----------------|
| <span class="uml-sym" data-diagram="sequence" data-sym="frag-alt"></span> **ALT** | Alternative branches (mutual exclusion) | `if-else` / `switch` |
| <span class="uml-sym" data-diagram="sequence" data-sym="frag-opt"></span> **OPT** | Optional execution if guard is true | `if` (no else) |
| <span class="uml-sym" data-diagram="sequence" data-sym="frag-loop"></span> **LOOP** | Repeat while guard is true | `while` / `for` loop |
| <span class="uml-sym" data-diagram="sequence" data-sym="frag-par"></span> **PAR** | Parallel execution of fragments | Concurrent threads |
| <span class="uml-sym" data-diagram="sequence" data-sym="frag-critical"></span> **CRITICAL** | Critical region (only one thread at a time) | `synchronized` block |
| <span class="uml-sym" data-diagram="sequence" data-sym="frag-break"></span> **BREAK** | Early exit from the enclosing interaction | `break` / early return |
| <span class="uml-sym" data-diagram="sequence" data-sym="frag-ref"></span> **REF** | Reference to another sequence diagram by name | Function / subroutine call |

> **When to use `ref`:** When a shared interaction (e.g., login, authentication, checkout) appears in many sequence diagrams, draw it *once* as its own diagram and reference it from others with a `ref` frame. This is the sequence-diagram equivalent of factoring out a function.

---

## Part 5: From Code to Diagram

Translating between code and sequence diagrams is a critical skill. Let's work through a progression of examples.

### Example 1: Simple Method Calls

```java
public class Register {
    public void method(Sale s) {
        s.makePayment(cashTendered);
    }
}
public class Sale {
    public void makePayment(int amount) {
        Payment p = new Payment(amount);
        p.authorize();
    }
}
```

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
participant register: Register
participant sale: Sale
participant payment: Payment
register -> sale: makePayment(cashTendered)
activate sale
sale -> payment: create(cashTendered)
activate payment
deactivate payment
sale -> payment: authorize()
activate payment
deactivate payment
deactivate sale
@enduml'></div>

Notice how the `new Payment(amount)` constructor call in Java becomes a `create` message in the sequence diagram. The `Payment` object appears at the point in the timeline when it is created.

### Example 2: Loops in Code and Diagrams

```java
public class A {
    List items = null;
    public void noName(B b) {
        b.makeNewSale();
        for (Item item : getItems()) {
            b.enterItem(item.getID(), quantity);
            total = total + b.total;
            description = b.desc;
        }
        b.endSale();
    }
}
```

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
participant a: A
participant b: B
a -> b: makeNewSale()
loop [more items]
  a -> b: enterItem(itemID, quantity)
  b --> a: description, total
end
a -> b: endSale()
@enduml'></div>

The `for` loop in code maps directly to a `loop` fragment. The guard condition `[more items]` is a Boolean expression that describes when the loop continues.

### Example 3: Alt Fragment to Code

Given this sequence diagram:

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
participant a: A
participant b: B
participant c: C
a -> a: doX(x)
alt [x < 10]
  a -> b: calculate()
else [else]
  a -> c: calculate()
end
@enduml'></div>

The equivalent Java code is:

```java
public class A {
    public void doX(int x) {
        if (x < 10) {
            b.calculate();
        } else {
            c.calculate();
        }
    }
}
```

> **Concept Check (Generation):** Try translating this code into a sequence diagram before checking the answer:
> ```java
> public class OrderProcessor {
>     public void process(Order order, Inventory inv) {
>         if (inv.checkStock(order.getItemId())) {
>             inv.reserve(order.getItemId());
>             order.confirm();
>         } else {
>             order.reject("Out of stock");
>         }
>     }
> }
> ```
>
> <details>
> <summary><i>Reveal Answer</i></summary>
>
> <div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
> participant proc: OrderProcessor
> participant inv: Inventory
> participant order: Order
> proc -> inv: checkStock(itemId)
> inv --> proc: inStock
> alt [inStock == true]
>   proc -> inv: reserve(itemId)
>   proc -> order: confirm()
> else [inStock == false]
>   proc -> order: reject("Out of stock")
> end
> @enduml'></div>
> </details>

---

## Real-World Examples

These examples show sequence diagrams for real systems. For each diagram, trace through the arrows top-to-bottom and narrate what is happening *before* reading the walkthrough.

---

### Example 1: Google Sign-In — OAuth2 Login Flow

**Scenario:** When you click "Sign in with Google," three systems exchange a precise sequence of messages. This diagram shows that flow — it illustrates how return messages carry data back and why the *ordering* of messages matters.

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
participant B: Browser
participant A: AppBackend
participant G: GoogleOAuth
B -> A: GET /login
A --> B: 302 redirect to accounts.google.com
B -> G: GET /authorize (clientId, scope)
G --> B: 200 auth form
B -> G: POST /authorize (credentials)
G --> B: 302 redirect with authCode
B -> A: GET /callback?code=authCode
A -> G: POST /token (authCode, clientSecret)
G --> A: accessToken
A --> B: 200 session cookie
@enduml'></div>

**What the UML notation captures:**

1. **Three lifelines, one flow:** `Browser`, `AppBackend`, and `GoogleOAuth` are the three participants. The browser intermediates between your app and Google — this is why OAuth feels like a redirect chain.
2. **Solid arrows (synchronous calls):** Every `->` means the sender blocks and waits for a response before continuing. The browser sends a request and waits for the redirect before proceeding.
3. **Dashed arrows (return messages):** The `-->` arrows carry responses back — the auth code, the access token, the session cookie. Return messages always flow back to the caller.
4. **Top-to-bottom = time:** Reading vertically, you reconstruct the complete OAuth handshake in order. Swapping any two messages would break the protocol — the diagram makes those ordering dependencies visible.

---

### Example 2: DoorDash — Placing a Food Order

**Scenario:** When a user submits an order, the app charges their card and notifies the restaurant. But what if the payment fails? This diagram uses an `alt` fragment to model both the success and failure paths explicitly.

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
participant app: MobileApp
participant os: OrderService
participant pg: PaymentGateway
participant rest: Restaurant
app -> os: submitOrder(items, paymentInfo)
os -> pg: charge(amount, card)
alt [payment approved]
  pg --> os: transactionId
  os -> rest: notifyNewOrder(items)
  rest --> os: estimatedTime
  os --> app: confirmed(orderId, eta)
else [payment declined]
  pg --> os: declineReason
  os --> app: error(declineReason)
end
@enduml'></div>

**What the UML notation captures:**

1. **`alt` fragment (if/else):** The dashed horizontal line inside the box divides the two branches. Only one branch executes at runtime. When you see `alt`, think `if/else`.
2. **Guard conditions in `[ ]`:** `[payment approved]` and `[payment declined]` are boolean guards — they must be mutually exclusive so exactly one branch fires.
3. **Different paths, different participants:** In the success branch, the flow continues to `Restaurant`. In the failure branch, it returns immediately to the app. The diagram makes both paths equally visible — no "happy path bias."
4. **Why `alt` and not `opt`?** An `opt` fragment has only one branch (if, no else). Because we have two explicit outcomes — success and failure — `alt` is the correct choice.

---

### Example 3: GitHub Actions — CI/CD Pipeline Trigger

**Scenario:** A developer pushes code, GitHub triggers a build, tests run, and deployment happens only if tests pass. This diagram uses `opt` for conditional deployment and a self-call for internal processing.

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
participant dev: Developer
participant gh: GitHub
participant build: BuildService
participant deploy: DeployService
dev -> gh: git push origin main
gh -> build: triggerBuild(commitSha)
build -> build: runTests()
build --> gh: testResults
opt [all tests passed]
  build -> deploy: deployToStaging(artifact)
  deploy --> build: stagingUrl
end
gh --> dev: notify(testResults)
@enduml'></div>

**What the UML notation captures:**

1. **Self-call (`build -> build`):** A message from a lifeline back to itself models an internal call — `BuildService` running its own test suite. The arrow loops back to the same column.
2. **`opt` fragment (if, no else):** Deployment only happens if all tests pass. There is no "else" branch — on failure the flow skips the `opt` block and continues to the notification.
3. **Return after the fragment:** `gh --> dev: notify(testResults)` executes regardless of whether deployment occurred — it is outside the `opt` box, at the outer sequence level.
4. **Activation ordering:** `build` runs `runTests()` before returning `testResults` to `gh`. Top-to-bottom ordering guarantees tests complete before GitHub is notified.

---

### Example 4: Uber — Real-Time Driver Matching

**Scenario:** When a rider requests a trip, the matching service offers the ride to drivers until one accepts. This diagram shows a `loop` fragment combined with an `alt` inside — the most powerful combination in sequence diagrams.

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
participant rider: RiderApp
participant match: MatchingService
participant driver: DriverApp
participant notif: NotificationService
rider -> match: requestRide(location, rideType)
loop [no driver accepted]
  match -> driver: offerRide(request)
  alt [driver accepts]
    driver --> match: accepted
  else [driver declines or timeout]
    driver --> match: declined
  end
end
match -> notif: notifyRider(driverId, eta)
notif --> rider: driverAssigned(eta)
@enduml'></div>

**What the UML notation captures:**

1. **`loop` fragment:** The matching service repeats the offer-cycle until a driver accepts. `loop` models iteration — equivalent to a `while` loop. In practice this loop has a timeout (e.g., 3 attempts before cancellation), which would be the loop guard condition.
2. **Nested `alt` inside `loop`:** Each iteration of the loop has its own if/else: did the driver accept or decline? Nesting fragments is valid and common — it directly mirrors nested control flow in code.
3. **Flow continues after the loop:** Once a driver accepts, execution exits the `loop` and the notification is sent. Messages *outside* a fragment are unconditional.
4. **`DriverApp` as a participant:** The driver's mobile app is a first-class lifeline. This shows that sequence diagrams can include mobile clients, web clients, and backend services on equal footing.

---

### Example 5: Slack — Real-Time Message Delivery

**Scenario:** When you send a Slack message, it is persisted, then broadcast to all subscribers of that channel. This diagram shows the fan-out delivery pattern using a `loop` fragment.

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
participant client: SlackClient
participant ws: WebSocketGateway
participant msg: MessageService
participant notif: NotificationService
client -> ws: sendMessage(channelId, text)
ws -> msg: persist(channelId, text, userId)
msg --> ws: messageId
ws -> notif: broadcastToChannel(channelId, message)
loop [for each online subscriber]
  notif -> ws: deliver(userId, message)
  ws --> client: messageReceived
end
ws --> client: ack(messageId)
@enduml'></div>

**What the UML notation captures:**

1. **Sequence before the loop:** `persist` and get `messageId` happen exactly once — before the broadcast. The diagram makes this ordering explicit: a message is saved before it is delivered to anyone.
2. **`loop` for fan-out delivery:** Each online subscriber receives their own delivery call. In a channel with 200 members, the loop body executes 200 times. The diagram abstracts this into a single readable fragment.
3. **`ack` after the loop:** The sender receives their acknowledgement (`ack(messageId)`) only after the broadcast completes. This is outside the loop — it is unconditional and happens once.
4. **`WebSocketGateway` as the central hub:** All messages flow in and out through the gateway. The diagram shows this hub topology clearly — every arrow touches `ws`, revealing it as the architectural bottleneck. This is a useful architectural insight visible only in the sequence diagram.

---

## Chapter Summary

Sequence diagrams are a powerful tool to understand the dynamic, time-based behavior of a system.

  * **Lifelines** and **Messages** establish the basic timeline of communication.
  * **OPT fragments** handle "maybe" scenarios (if).
  * **ALT fragments** handle "either/or" scenarios (if/else).
  * **LOOP fragments** handle repetitive scenarios (while/for).

By mastering these fragments, you can model nearly any procedural logic within an object-oriented system before writing a single line of code.

### End of Chapter Exercises (Retrieval Practice)

To solidify your learning, attempt these questions without looking back at the text.

1.  What is the key difference between an `ALT` fragment and an `OPT` fragment?
2.  If you needed to model a user trying to enter a password 3 times before being locked out, which fragment would you use as the outer box, and which fragment would you use inside it?
3.  Draw a simple sequence diagram (using pen and paper) of yourself ordering a book online. Include one `OPT` fragment representing applying a promo code.

## Interactive Practice

Test your knowledge with these retrieval practice exercises. These diagrams are rendered dynamically to ensure you can recognize UML notation in any context.

### Knowledge Quiz
{% include quiz.html id="uml_sequence_diagram_examples" %}

### Retrieval Flashcards
{% include flashcards.html id="uml_sequence_diagram_examples" %}

*Pedagogical Tip: If you find these challenging, it's a good sign! Effortful retrieval is exactly what builds durable mental models. Try coming back to these tomorrow to benefit from [spacing and interleaving](/blog/evidence-based-study-tips-for-college-students/).*