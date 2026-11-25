---
title: Module Blood Groups
layout: sebook
---

Some modules move to a new project in an afternoon; others stay welded to the system they were written for. *Module blood groups*, also called software categories, explain the difference with one question: what does this code know? {% cite SiederslebenDenert2000Informationssysteme Siedersleben2004Softwarearchitektur %}

{% include narration.html topic="blood_groups" %}

# Two Questions

Ask two yes-or-no questions about any piece of code {% cite Siedersleben1999Segregating %}:

1. **Does it know the application domain?** Domain code uses the business's own words and rules: rides, riders, parking zones, prices.
2. **Does it know a technology?** Technology code depends on at least one concrete technical API: a map SDK, a payment API, a database driver, a GUI toolkit.

*Knowing* means depending: if that rule or that API changed, this code would have to change too. The two answers give four groups, and every piece of code, from a function to a whole component, belongs to exactly one of them.

| What the code knows | No technology | A technology |
|---|---|---|
| **No domain** | **0**: neutral | **T**: technology |
| **The domain** | **A**: application | **AT**: both |

# The Four Groups

The group decides where code can be reused, because every assumption about a technology limits reuse to that technology, and every assumption about the domain limits reuse to that domain.

| Group | Knows | Example from a scooter-rental app | Reusable |
|---|---|---|---|
| **0** | Neither | Point-in-polygon geometry, a sorted list, a state machine | Everywhere, but useless on its own |
| **A** | The domain only | The pricing and parking rules | Wherever the same rules apply, on any technology |
| **T** | A technology only | A payment client that charges any amount to any card | Wherever the same technology runs, in any application |
| **AT** | Both | An `end_ride()` that mixes parking rules with map, payment, and Bluetooth calls | Almost nowhere: only where the rules *and* the technologies match |

Group A is the code the business is paid for. Group T is unavoidable, because no program runs in thin air. Group AT is easy to write, which is why every codebase has some, but it changes whenever the business *or* the technology changes: the larger a design's share of AT code, the lower its quality {% cite Siedersleben1999Segregating %}.

## An AT function and its separation

This function is group AT. Its parking rule even speaks the map provider's terms, so switching map providers means rewriting the rule too:

```python
def end_ride(ride):
    spot = mapsdk.locate(ride.scooter.tracker)
    if not mapsdk.inside(spot, PARKING_ZONES):
        return mapsdk.toast("No parking here")
    price = 1.00 + 0.30 * ride.minutes()
    if ride.rider.is_student:
        price = price * 0.8
    payapi.charge(ride.rider.card, round(price * 100))
    bluetooth.write(ride.scooter.lock, LOCK)
```

Separated, the rules become group A. They state what they need through interfaces they own (`Payments`, `Locator`, `Locks`), and they use a group 0 `inside()` for the geometry. Each technology plugs in through a thin adapter:

```python
class RideRules:  # group A
    def __init__(self, locator, payments, locks):
        self.locator, self.payments, self.locks = locator, payments, locks

    def price(self, ride):
        cost = 1.00 + 0.30 * ride.minutes
        return cost * 0.8 if ride.rider.is_student else cost

    def end_ride(self, ride):
        spot = self.locator.position(ride.scooter)  # a plain Point
        if not any(inside(spot, zone) for zone in PARKING_ZONES):
            raise NotInParkingZone()
        self.payments.charge(ride.rider, self.price(ride))
        self.locks.lock(ride.scooter)


class PayApiPayments:  # a thin adapter: it translates, never decides
    def charge(self, rider, amount):
        payapi.charge(rider.card, round(amount * 100))
```

# Mixing Rules

The groups combine the way blood types are inherited: a module gets every letter its parts have {% cite SiederslebenDenert2000Informationssysteme %}.

- **A + A = A** and **T + T = T.**
- **0 + X = X.** Zero adds no letter, so neutral code mixes into any group without changing it.
- **A + T = AT.** One technology call inside a rule turns the whole rule into AT.
- **AT + anything = AT.** AT never dilutes back into A or T; only separating the parts removes it.

Mixing also sneaks in through interfaces. A T module whose operations return SDK objects, accept SQL strings, report HTTP status codes, or raise the provider's error types makes every caller depend on that technology. Interfaces between groups should speak neutral or domain words instead, such as a plain point or a `ScooterNotFound` error.

# Design Rules

1. **Minimize AT, maximize 0.** Separate technological concerns from application concerns: rules in A modules, each technology in its own T module, and general ideas in 0 modules. Keep one technology per T module and one topic per A module.
2. **Avoid dependencies from large, complex A modules to T modules.** Invert the dependency: the A module declares what it needs in its own words, such as `Payments.charge(rider, amount)`, and each technology plugs in behind that interface.
3. **Keep adapters thin.** An adapter knows both sides, so it is AT. It should only translate, never decide. This mild, schematic kind of AT has its own letter, **R** for *representation*, and tools can often generate it {% cite SiederslebenDenert2000Informationssysteme %}.
4. **Keep frameworks at arm's length.** A domain class that inherits from a framework class is married to that framework. For a large, complex domain class, let a thin record class extend the framework and keep the rules in a plain class.

# Testing a Design

Replay likely changes against a design and count what each one touches {% cite SiederslebenDenert2000Informationssysteme %}:

| Change | Should touch only |
|---|---|
| A technology change, such as a new map provider or database product | Group T, plus that technology's thin adapters |
| A rule change, such as a new discount or parking zone | Group A |
| A change in how data is stored or shown, such as a table or screen layout | The R translators |

When each change lands in one small place, the design is ready for change and for reuse. Modules that know no technology are also easier to test, because their tests need no SDK, database, or user interface.

## When not to separate

Separation pays off where change and reuse are likely: large rule sets, and technology that keeps changing. Neutral code such as strings, lists, or geometry needs no wrapper, because it changes with neither the business nor the technology; hiding even the string class behind an interface is overdoing it {% cite Siedersleben2004Softwarearchitektur %}. For a weekend script, a little AT is fine.

# Practice

1. Pick a project you have worked on. Which module is its largest AT module, and which domain rules and which technology does it know?
2. Your team switches to a different database product. Which files of your project would change, and what does that tell you about their groups?
3. Think of code you reused from one project in another. Which group was it, and what let it move?
