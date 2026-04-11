---
title: UML
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

Messages are the communications between lifelines. They are drawn as horizontal arrows.

  * **Synchronous Message (Solid arrowhead):** The sender waits for a response before doing anything else (like calling someone on the phone and waiting for them to answer).
  * **Asynchronous Message (Open/stick arrowhead):** The sender sends the message and immediately moves on to other tasks (like sending a text message).
  * **Return Message (Dashed line with open arrow):** The response to a previous message.

### Visualizing the Basics: A Simple ATM Login

Let's look at the sequence of a user inserting a card into an ATM.

<div id="uml-sd-atm" class="uml-class-diagram-container"></div>
<script>(function(){
  var spec = `@startuml
participant customer: Customer
participant atm: ATM
participant bank: Bank Server
customer -> atm: (1) insertCard()
atm -> bank: (2) verifyCard()
bank --> atm: (3) cardValid()
atm --> customer: (4) promptPIN()
@enduml`;
  function render() {
    var el = document.getElementById('uml-sd-atm');
    if (!el) return;
    if (window.UMLSequenceDiagram) { window.UMLSequenceDiagram.render(el, spec); return; }
    setTimeout(render, 80);
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', render) : render();
})();</script>

**Notice the flow of time:** Message 1 happens first, then 2, 3, and 4. The vertical dimension is strictly used to represent the passage of time.

> **Stop and Think (Retrieval Practice):** \> If the ATM sent an alert to your phone about a login attempt but didn't wait for you to reply before proceeding, what type of message arrow would represent that alert? *(Think about your answer before reading on).*
>
> \<details\>
> \<summary\>\<i\>Reveal Answer\</i\>\</summary\>
> An asynchronous message, represented by an open/stick arrowhead (-\>), because the ATM does not wait for a response.
> \</details\>

-----

## Part 2: Adding Logic – Combined Fragments

Real-world systems rarely follow a single, straight path. Things go wrong, conditions change, and actions repeat. UML uses **Combined Fragments** to enclose portions of the sequence diagram and apply logic to them.

Fragments are drawn as large boxes surrounding the relevant messages, with a "tag" in the top-left corner declaring the type of logic (e.g., `opt`, `alt`, `loop`).

### 1\. The OPT Fragment (Optional Behavior)

The `opt` fragment is equivalent to an `if` statement without an `else`. The messages inside the box only occur *if* a specific condition (called a guard) is true.

**Scenario:** A customer is buying an item. *If* they have a loyalty account, they receive a discount.

<div id="uml-sd-opt" class="uml-class-diagram-container"></div>
<script>(function(){
  var spec = `@startuml
participant checkout: Checkout System
participant pricing: Pricing Engine
checkout -> pricing: calculateTotal()
opt [hasLoyaltyAccount == true]
  checkout -> pricing: applyDiscount()
  pricing --> checkout: discountApplied()
end
pricing --> checkout: finalTotal()
@enduml`;
  function render() {
    var el = document.getElementById('uml-sd-opt');
    if (!el) return;
    if (window.UMLSequenceDiagram) { window.UMLSequenceDiagram.render(el, spec); return; }
    setTimeout(render, 80);
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', render) : render();
})();</script>

*Notice the `[hasLoyaltyAccount == true]` text. This is the **guard condition**. If it evaluates to false, the sequence skips the entire box.*

### 2\. The ALT Fragment (Alternative Behaviors)

The `alt` fragment is equivalent to an `if-else` or `switch` statement. The box is divided by a dashed horizontal line. The sequence will execute *only one* of the divided sections based on which guard condition is true.

**Scenario:** Verifying a user's password.

<div id="uml-sd-alt" class="uml-class-diagram-container"></div>
<script>(function(){
  var spec = `@startuml
participant system: System
participant db: Database
system -> db: checkPassword()
alt [password is correct]
  db --> system: loginSuccess()
else [password is incorrect]
  db --> system: loginFailed()
end
@enduml`;
  function render() {
    var el = document.getElementById('uml-sd-alt');
    if (!el) return;
    if (window.UMLSequenceDiagram) { window.UMLSequenceDiagram.render(el, spec); return; }
    setTimeout(render, 80);
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', render) : render();
})();</script>

### 3\. The LOOP Fragment (Repetitive Behavior)

The `loop` fragment represents a `for` or `while` loop. The messages inside the box are repeated as long as the guard condition remains true, or for a specified number of times.

**Scenario:** Pinging a server until it wakes up (maximum 3 times).

<div id="uml-sd-loop" class="uml-class-diagram-container"></div>
<script>(function(){
  var spec = `@startuml
participant app: App
participant server: Server
loop [up to 3 times]
  app -> server: ping()
  server --> app: ack()
end
@enduml`;
  function render() {
    var el = document.getElementById('uml-sd-loop');
    if (!el) return;
    if (window.UMLSequenceDiagram) { window.UMLSequenceDiagram.render(el, spec); return; }
    setTimeout(render, 80);
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', render) : render();
})();</script>

-----

## Part 3: Putting It All Together (Interleaved Practice)

To truly understand how these elements work, we must view them interacting in a complex system. Combining different concepts requires you to interleave your knowledge, which strengthens your mental model.

**The Scenario: A Smart Home Alarm System**

1.  The user arms the system.
2.  The system checks all windows.
3.  It loops through every window.
4.  *If* a window is open (ALT), it warns the user. *Else*, it locks it.
5.  *Optionally* (OPT), if the user has SMS alerts on, it texts them.

<div id="uml-sd-alarm" class="uml-class-diagram-container"></div>
<script>(function(){
  var spec = `@startuml
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
@enduml`;
  function render() {
    var el = document.getElementById('uml-sd-alarm');
    if (!el) return;
    if (window.UMLSequenceDiagram) { window.UMLSequenceDiagram.render(el, spec); return; }
    setTimeout(render, 80);
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', render) : render();
})();</script>

-----

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