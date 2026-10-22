---
title: "Let the Object Decide: An Object-Oriented Programming Song"
layout: sebook
---

<link rel="stylesheet" href="/css/song-video.css">
<link rel="stylesheet" href="/css/print-light.css">

**Start with the song.** *Let the Object Decide* is a six-minute music video about object-oriented programming. It starts with a city simulation that stores every vehicle as a row of numbers and grows one giant type switch. Then it follows the ideas that replaced the switch:

* Simula turned records into objects with **state and code inside**.
* Alan Kay pictured objects that only talk through **messages**.
* The same message gets **different moves**, down to the C++ vtable that makes it work.
* A square is a rectangle in math but not a safe subclass in code (**Liskov**).
* Objects have a **price**.

It ends with a five-question "red flag or green flag?" quiz that pauses before each answer. Captions are on by default.

Before you press play, predict: a city simulation stores every vehicle as a table row with a `type` code, and the update, drawing, and braking code each switch on that code. The mayor wants ambulances. Which code has to change?

{% include song-video.html song=site.data.songs.let_the_object_decide id="oop-song" %}

# The Five Rules

The song collects five rules on its rule card. Each one comes with the condition that keeps it true:

1. **State and code inside.** An object bundles the data that describes one thing with the code that acts on it. Other code uses its public methods, not its fields.
2. **Send a message.** Ask the object to act (`car->brake()`) instead of reaching in and changing its state (`car->speed = 0`). A getter and a setter for every field is a struct in a trench coat: callers still depend on the representation.
3. **The object decides.** The receiver's class picks which code runs, so a loop over `Vehicle*` runs each vehicle's own `move()`. In C++ this is true for `virtual` methods: the call looks up the object's vtable at run time. For a non-virtual method, the compiler picks the code from the static type.
4. **Keep the promise.** A subclass may decide *how* to respond, but it must keep what the parent promises, with the same messages and the same meaning (the Liskov substitution principle). If it cannot, don't inherit. Share an interface, or hold an object inside and delegate to it.
5. **Use where it fits.** Objects suit things with state that act. A plain calculation can stay a plain function. With objects, a new kind of thing is one new class, but a new operation touches every class.

# Try It Without the Music

Answer these without replaying the song, then check your reasoning.

> **1.** Three places in a bank app run `account.balance -= 100;`. What can go wrong, and what would you change?
>
> <details>
> <summary><i>Reveal Answer</i></summary>
> Any caller can bypass the account's rules, such as an overdraft check or logging, and each caller may repeat those rules inconsistently. Send a message instead, <code>account.withdraw(100)</code>, so <code>Account</code> enforces its rules in one place.
> </details>

> **2.** A drawing app stores shapes as structs with a `kind` field, and `area()`, `draw()`, and `save()` each switch on `kind`. Redesign it with objects. Then compare both designs when you (a) add a `Triangle` and (b) add an `exportSvg()` operation.
>
> <details>
> <summary><i>Reveal Answer</i></summary>
> Declare an interface <code>Shape</code> with <code>area()</code>, <code>draw()</code>, and <code>save()</code>, and let <code>Circle</code>, <code>Rect</code>, and <code>Polygon</code> implement it.
> (a) Adding <code>Triangle</code>: before, you edit all three switches; after, you write one new class, plus the line that creates triangles.
> (b) Adding <code>exportSvg()</code>: before, you write one new function with one switch; after, you add it to <code>Shape</code> and to every class.
> Each design makes a different change cheap.
> </details>

> **3.** A teammate writes `class Circle : public Ellipse` and inherits `setRadii(rx, ry)`. Can a `Circle` stand in for an `Ellipse`?
>
> <details>
> <summary><i>Reveal Answer</i></summary>
> Not if a circle must keep <code>rx == ry</code>. Calling <code>setRadii(10, 20)</code> either breaks the circle or ignores <code>ry</code>. Either way, code that trusted <code>Ellipse</code> breaks. Two fixes: let both implement a shared <code>Shape</code> interface, or make shapes immutable (no setters), in which case a circle can be an ellipse.
> </details>

> **4.** In C++, `Vehicle* v = new Ambulance;` then `v->move(); v->plate();`. `move` is `virtual`, `plate` is not, and `Ambulance` redefines both. Which version of each runs, and when is that decided?
>
> <details>
> <summary><i>Reveal Answer</i></summary>
> <code>Ambulance::move</code> runs, chosen at run time through the object's vtable. <code>Vehicle::plate</code> runs, chosen at compile time from the static type <code>Vehicle*</code>.
> </details>
