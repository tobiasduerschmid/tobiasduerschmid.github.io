---
title: Information Hiding
layout: sebook
---

# Background and Motivation

## What You Should Be Able to Do

By the end of this chapter, you should be able to:

* Explain why Information Hiding is a response to the problem of **software complexity**, not just a style rule about `private` fields.
* Identify design decisions that are **difficult** or **likely to change**, and decide whether each one belongs in a hidden implementation or a visible interface contract.
* Distinguish a Parnas-style **module** from a class, file, runtime process, or call graph node.
* Inspect an interface as a set of **permitted assumptions**, and remove names, types, return values, ordering guarantees, flags, and error details that reveal more than clients need.
* Refactor a leaky design, such as services that know about `PayPal`, into a design where one module owns the volatile decision behind a stable abstraction.
* Use coupling, cohesion, module depth, the Single Choice principle, and change impact analysis to evaluate whether a design actually hides information well.
* Document a design decision with a module-guide entry: primary secret, secondary secrets, stable interface, forbidden assumptions, and likely changes absorbed.

## A Motivating Story: The PayPal Tangle

Imagine you joined a team building an online store. The first sprint went well: you shipped checkout, refunds, and a wallet. But you used PayPal directly everywhere — `OrderService`, `RefundService`, and `WalletService` each call `PayPal.charge(...)`, `PayPal.refund(...)`, `paypal.authenticate(...)`, and so on. Every service knows that **PayPal exists**, knows how to authenticate to PayPal, and constructs PayPal-specific objects like `PayPalCharge`.

<div class="inline-language-switcher" data-language-switcher data-default-language="java">
  <div class="inline-language-tabs" role="tablist" aria-label="Leaky PayPal services code language">
    <button type="button" role="tab" data-language-option="java" aria-selected="true">Java</button>
    <button type="button" role="tab" data-language-option="cpp" aria-selected="false">C++</button>
    <button type="button" role="tab" data-language-option="python" aria-selected="false">Python</button>
    <button type="button" role="tab" data-language-option="ts" aria-selected="false">TypeScript</button>
  </div>

  <div class="inline-language-panel is-active" data-language-panel="java" role="tabpanel" markdown="1">
```java
class Order {
    int total() { return 0; }
}

class PayPalAccount {
    void authenticate() { }
    String accountToken() { return ""; }
}

class PayPalCharge {
    boolean wasSuccessful() { return true; }
}

class PayPalRefund { }
class PayPalPaymentMethod { }

class PayPal {
    static PayPalCharge charge(String token, int amount) {
        return new PayPalCharge();
    }

    static PayPalRefund refund(String token, int amount) {
        return new PayPalRefund();
    }

    static PayPalPaymentMethod createPaymentMethod(String token) {
        return new PayPalPaymentMethod();
    }
}

class OrderService {
    public void checkout(Order order, PayPalAccount paypal) {
        paypal.authenticate();
        PayPalCharge charge = PayPal.charge(paypal.accountToken(), order.total());
        if (charge.wasSuccessful()) {
            // more business logic that depends on the 'charge' object ...
        } else { /* error handling */ }
    }
}

class RefundService {
    public void refund(Order order, PayPalAccount paypal) {
        paypal.authenticate();
        PayPalRefund refund = PayPal.refund(paypal.accountToken(), order.total());
        // more business logic that depends on the 'refund' object ...
    }
}

class WalletService {
    public void addPaymentMethod(PayPalAccount paypal) {
        paypal.authenticate();
        PayPalPaymentMethod payment = PayPal.createPaymentMethod(paypal.accountToken());
        // more business logic that depends on the 'payment' object ...
    }
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="cpp" role="tabpanel" markdown="1">
```cpp
#include <string>

class Order {
public:
    int total() const { return 0; }
};

class PayPalAccount {
public:
    void authenticate() { }
    std::string accountToken() const { return ""; }
};

class PayPalCharge {
public:
    bool wasSuccessful() const { return true; }
};

class PayPalRefund { };
class PayPalPaymentMethod { };

class PayPal {
public:
    static PayPalCharge charge(const std::string& token, int amount) {
        return {};
    }

    static PayPalRefund refund(const std::string& token, int amount) {
        return {};
    }

    static PayPalPaymentMethod createPaymentMethod(const std::string& token) {
        return {};
    }
};

class OrderService {
public:
    void checkout(const Order& order, PayPalAccount& paypal) {
        paypal.authenticate();
        PayPalCharge charge = PayPal::charge(paypal.accountToken(), order.total());
        if (charge.wasSuccessful()) {
            // more business logic that depends on the charge object ...
        } else { /* error handling */ }
    }
};

class RefundService {
public:
    void refund(const Order& order, PayPalAccount& paypal) {
        paypal.authenticate();
        PayPalRefund refund = PayPal::refund(paypal.accountToken(), order.total());
        // more business logic that depends on the refund object ...
    }
};

class WalletService {
public:
    void addPaymentMethod(PayPalAccount& paypal) {
        paypal.authenticate();
        PayPalPaymentMethod payment = PayPal::createPaymentMethod(paypal.accountToken());
        // more business logic that depends on the payment object ...
    }
};
```
  </div>

  <div class="inline-language-panel" data-language-panel="python" role="tabpanel" markdown="1">
```python
class Order:
    def total(self) -> int:
        return 0


class PayPalAccount:
    def authenticate(self) -> None:
        pass

    def account_token(self) -> str:
        return ""


class PayPalCharge:
    def was_successful(self) -> bool:
        return True


class PayPalRefund:
    pass


class PayPalPaymentMethod:
    pass


class PayPal:
    @staticmethod
    def charge(token: str, amount: int) -> PayPalCharge:
        return PayPalCharge()

    @staticmethod
    def refund(token: str, amount: int) -> PayPalRefund:
        return PayPalRefund()

    @staticmethod
    def create_payment_method(token: str) -> PayPalPaymentMethod:
        return PayPalPaymentMethod()


class OrderService:
    def checkout(self, order: Order, paypal: PayPalAccount) -> None:
        paypal.authenticate()
        charge = PayPal.charge(paypal.account_token(), order.total())
        if charge.was_successful():
            # more business logic that depends on the charge object ...
            pass
        else:
            # error handling
            pass


class RefundService:
    def refund(self, order: Order, paypal: PayPalAccount) -> None:
        paypal.authenticate()
        refund = PayPal.refund(paypal.account_token(), order.total())
        # more business logic that depends on the refund object ...


class WalletService:
    def add_payment_method(self, paypal: PayPalAccount) -> None:
        paypal.authenticate()
        payment = PayPal.create_payment_method(paypal.account_token())
        # more business logic that depends on the payment object ...
```
  </div>

  <div class="inline-language-panel" data-language-panel="ts" role="tabpanel" markdown="1">
```typescript
class Order {
  total(): number {
    return 0;
  }
}

class PayPalAccount {
  authenticate(): void { }

  accountToken(): string {
    return "";
  }
}

class PayPalCharge {
  wasSuccessful(): boolean {
    return true;
  }
}

class PayPalRefund { }
class PayPalPaymentMethod { }

class PayPal {
  static charge(token: string, amount: number): PayPalCharge {
    return new PayPalCharge();
  }

  static refund(token: string, amount: number): PayPalRefund {
    return new PayPalRefund();
  }

  static createPaymentMethod(token: string): PayPalPaymentMethod {
    return new PayPalPaymentMethod();
  }
}

class OrderService {
  checkout(order: Order, paypal: PayPalAccount): void {
    paypal.authenticate();
    const charge = PayPal.charge(paypal.accountToken(), order.total());
    if (charge.wasSuccessful()) {
      // more business logic that depends on the charge object ...
    } else { /* error handling */ }
  }
}

class RefundService {
  refund(order: Order, paypal: PayPalAccount): void {
    paypal.authenticate();
    const refund = PayPal.refund(paypal.accountToken(), order.total());
    // more business logic that depends on the refund object ...
  }
}

class WalletService {
  addPaymentMethod(paypal: PayPalAccount): void {
    paypal.authenticate();
    const payment = PayPal.createPaymentMethod(paypal.accountToken());
    // more business logic that depends on the payment object ...
  }
}
```
  </div>
</div>

The PayPal **decision** is duplicated across all three services. Each service authenticates to PayPal, calls a PayPal-specific function, and consumes a PayPal-specific result type. Visually, the dependencies look like this:

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
class OrderService {
    + checkout(order, paypal)
}
class RefundService {
    + refund(order, paypal)
}
class WalletService {
    + addPaymentMethod(paypal)
}
class PayPal <<external API>> {
    + authenticate(...)
    + charge(token, amount)
    + refund(token, amount)
    + createPaymentMethod(token)
}
note bottom of PayPal
  PayPalDecision is
  duplicated everywhere
end note
OrderService ..> PayPal
RefundService ..> PayPal
WalletService ..> PayPal
@enduml'></div>

Three services, three direct dependencies on the PayPal SDK. The "secret" — *which payment provider we use* — is not a secret at all; every service knows it. Two months later, the CFO walks in:

> *"Visa is offering us better rates. Marketing wants Apple Pay for the mobile launch. Legal wants us to add Stripe for the EU rollout because PayPal won't sign their data-processing addendum. How long?"*

You open your editor, search for `PayPal`, and your heart sinks. The string `PayPal` appears in dozens of files — services, tests, error messages, retry logic, even logging. None of those files were *about* payment providers, but every one of them now needs to be edited. You estimate three weeks for the change, two more for regression testing, and a non-trivial probability that something subtle will break in production.

This is not a *coding problem*. This is a **design problem**. The team violated a design principle that has been known for over fifty years: a single difficult, likely-to-change design decision — *which payment provider we use* — was scattered across the entire codebase instead of being **hidden** inside a single module behind a robust interface. Every service "knew the secret". So every service had to be rewritten when the secret changed.

The principle that fixes this is called **Information Hiding**. The fix looks like this:

<div class="inline-language-switcher" data-language-switcher data-default-language="java">
  <div class="inline-language-tabs" role="tablist" aria-label="Hidden payment gateway code language">
    <button type="button" role="tab" data-language-option="java" aria-selected="true">Java</button>
    <button type="button" role="tab" data-language-option="cpp" aria-selected="false">C++</button>
    <button type="button" role="tab" data-language-option="python" aria-selected="false">Python</button>
    <button type="button" role="tab" data-language-option="ts" aria-selected="false">TypeScript</button>
  </div>

  <div class="inline-language-panel is-active" data-language-panel="java" role="tabpanel" markdown="1">
```java
class Order { }
class PaymentDetails { }
class ChargeResult { }
class RefundResult { }
class PaymentMethod { }

// 1. Define a vendor-neutral interface — the only contract clients see.
interface PaymentGateway {
    ChargeResult charge(Order order, PaymentDetails payment);
    RefundResult refund(Order order, PaymentDetails payment);
    PaymentMethod createPaymentMethod(PaymentDetails payment);
}

// 2. ONE module hides the PayPal decision.
class PayPalGateway implements PaymentGateway {
    // PayPalDecision lives here — and ONLY here.
    public ChargeResult charge(Order order, PaymentDetails payment) {
        return new ChargeResult();
    }

    public RefundResult refund(Order order, PaymentDetails payment) {
        return new RefundResult();
    }

    public PaymentMethod createPaymentMethod(PaymentDetails payment) {
        return new PaymentMethod();
    }
}

// 3. Services depend on the abstraction, never on PayPal.
class OrderService {
    private final PaymentGateway gateway;

    OrderService(PaymentGateway gateway) {
        this.gateway = gateway;
    }

    public void checkout(Order order, PaymentDetails payment) {
        gateway.charge(order, payment);
        // more business logic ...
    }
}

class RefundService {
    private final PaymentGateway gateway;

    RefundService(PaymentGateway gateway) {
        this.gateway = gateway;
    }

    public void refund(Order order, PaymentDetails payment) {
        gateway.refund(order, payment);
        // more business logic ...
    }
}

class WalletService {
    private final PaymentGateway gateway;

    WalletService(PaymentGateway gateway) {
        this.gateway = gateway;
    }

    public void addPaymentMethod(PaymentDetails payment) {
        gateway.createPaymentMethod(payment);
        // more business logic ...
    }
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="cpp" role="tabpanel" markdown="1">
```cpp
class Order { };
class PaymentDetails { };
class ChargeResult { };
class RefundResult { };
class PaymentMethod { };

// 1. Define a vendor-neutral interface — the only contract clients see.
class PaymentGateway {
public:
    virtual ~PaymentGateway() = default;
    virtual ChargeResult charge(const Order& order, const PaymentDetails& payment) = 0;
    virtual RefundResult refund(const Order& order, const PaymentDetails& payment) = 0;
    virtual PaymentMethod createPaymentMethod(const PaymentDetails& payment) = 0;
};

// 2. ONE module hides the PayPal decision.
class PayPalGateway : public PaymentGateway {
public:
    // PayPalDecision lives here — and ONLY here.
    ChargeResult charge(const Order& order, const PaymentDetails& payment) override {
        return {};
    }

    RefundResult refund(const Order& order, const PaymentDetails& payment) override {
        return {};
    }

    PaymentMethod createPaymentMethod(const PaymentDetails& payment) override {
        return {};
    }
};

// 3. Services depend on the abstraction, never on PayPal.
class OrderService {
public:
    explicit OrderService(PaymentGateway& gateway) : gateway(gateway) { }

    void checkout(const Order& order, const PaymentDetails& payment) {
        gateway.charge(order, payment);
        // more business logic ...
    }

private:
    PaymentGateway& gateway;
};

class RefundService {
public:
    explicit RefundService(PaymentGateway& gateway) : gateway(gateway) { }

    void refund(const Order& order, const PaymentDetails& payment) {
        gateway.refund(order, payment);
        // more business logic ...
    }

private:
    PaymentGateway& gateway;
};

class WalletService {
public:
    explicit WalletService(PaymentGateway& gateway) : gateway(gateway) { }

    void addPaymentMethod(const PaymentDetails& payment) {
        gateway.createPaymentMethod(payment);
        // more business logic ...
    }

private:
    PaymentGateway& gateway;
};
```
  </div>

  <div class="inline-language-panel" data-language-panel="python" role="tabpanel" markdown="1">
```python
from typing import Protocol


class Order:
    pass


class PaymentDetails:
    pass


class ChargeResult:
    pass


class RefundResult:
    pass


class PaymentMethod:
    pass


# 1. Define a vendor-neutral interface — the only contract clients see.
class PaymentGateway(Protocol):
    def charge(self, order: Order, payment: PaymentDetails) -> ChargeResult: ...
    def refund(self, order: Order, payment: PaymentDetails) -> RefundResult: ...
    def create_payment_method(self, payment: PaymentDetails) -> PaymentMethod: ...


# 2. ONE module hides the PayPal decision.
class PayPalGateway:
    # PayPalDecision lives here — and ONLY here.
    def charge(self, order: Order, payment: PaymentDetails) -> ChargeResult:
        return ChargeResult()

    def refund(self, order: Order, payment: PaymentDetails) -> RefundResult:
        return RefundResult()

    def create_payment_method(self, payment: PaymentDetails) -> PaymentMethod:
        return PaymentMethod()


# 3. Services depend on the abstraction, never on PayPal.
class OrderService:
    def __init__(self, gateway: PaymentGateway) -> None:
        self._gateway = gateway

    def checkout(self, order: Order, payment: PaymentDetails) -> None:
        self._gateway.charge(order, payment)
        # more business logic ...


class RefundService:
    def __init__(self, gateway: PaymentGateway) -> None:
        self._gateway = gateway

    def refund(self, order: Order, payment: PaymentDetails) -> None:
        self._gateway.refund(order, payment)
        # more business logic ...


class WalletService:
    def __init__(self, gateway: PaymentGateway) -> None:
        self._gateway = gateway

    def add_payment_method(self, payment: PaymentDetails) -> None:
        self._gateway.create_payment_method(payment)
        # more business logic ...
```
  </div>

  <div class="inline-language-panel" data-language-panel="ts" role="tabpanel" markdown="1">
```typescript
class Order { }
class PaymentDetails { }
class ChargeResult { }
class RefundResult { }
class PaymentMethod { }

// 1. Define a vendor-neutral interface — the only contract clients see.
interface PaymentGateway {
  charge(order: Order, payment: PaymentDetails): ChargeResult;
  refund(order: Order, payment: PaymentDetails): RefundResult;
  createPaymentMethod(payment: PaymentDetails): PaymentMethod;
}

// 2. ONE module hides the PayPal decision.
class PayPalGateway implements PaymentGateway {
  // PayPalDecision lives here — and ONLY here.
  charge(order: Order, payment: PaymentDetails): ChargeResult {
    return new ChargeResult();
  }

  refund(order: Order, payment: PaymentDetails): RefundResult {
    return new RefundResult();
  }

  createPaymentMethod(payment: PaymentDetails): PaymentMethod {
    return new PaymentMethod();
  }
}

// 3. Services depend on the abstraction, never on PayPal.
class OrderService {
  constructor(private readonly gateway: PaymentGateway) { }

  checkout(order: Order, payment: PaymentDetails): void {
    this.gateway.charge(order, payment);
    // more business logic ...
  }
}

class RefundService {
  constructor(private readonly gateway: PaymentGateway) { }

  refund(order: Order, payment: PaymentDetails): void {
    this.gateway.refund(order, payment);
    // more business logic ...
  }
}

class WalletService {
  constructor(private readonly gateway: PaymentGateway) { }

  addPaymentMethod(payment: PaymentDetails): void {
    this.gateway.createPaymentMethod(payment);
    // more business logic ...
  }
}
```
  </div>
</div>

The **decision** to use PayPal is hidden in one module (`PayPalGateway`). Other services don't know that PayPal exists — they only know `PaymentGateway`. The class diagram below makes the new structure obvious:

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
class OrderService {
    + checkout(order, payment)
}
class RefundService {
    + refund(order, payment)
}
class WalletService {
    + addPaymentMethod(payment)
}
interface PaymentGateway {
    + charge(order, payment): ChargeResult
    + refund(order, payment): RefundResult
    + createPaymentMethod(payment): PaymentMethod
}
class PayPalGateway {
    + charge(order, payment)
    + refund(order, payment)
    + createPaymentMethod(payment)
}
class PayPal <<external API>> {
    + authenticate(...)
    + charge(token, amount)
    + refund(token, amount)
    + createPaymentMethod(token)
}
note right of PayPalGateway
  PayPalDecision lives
  in ONLY this class
end note
OrderService ..> PaymentGateway
RefundService ..> PaymentGateway
WalletService ..> PaymentGateway
PayPalGateway ..|> PaymentGateway
PayPalGateway ..> PayPal
@enduml'></div>

When the CFO swaps providers, you write a new `StripeGateway implements PaymentGateway`, change a single line of dependency-injection wiring, and ship. The three services do not change at all — the diagram simply gains a second box (`StripeGateway`) hanging off the same interface.

## The Principle

> *"difficult design decisions or design decisions which are likely to change"*
>
> — David L. Parnas, *On the Criteria To Be Used in Decomposing Systems into Modules*, Communications of the ACM, December 1972

In modern phrasing, the Information Hiding principle says:

> **Design decisions that are likely to change independently should be the *secrets* of separate modules. The interfaces between modules should reveal as little as possible — only assumptions considered unlikely to change.**

Two halves are doing work here. *"Difficult or likely-to-change decisions"* is the **what**: identify volatility before you decompose. *"Hide [...] from the others"* is the **how**: make the volatile decision visible to exactly one module, and let the rest of the system reach it only through a stable interface.

The fix in our PayPal story is one module — `PaymentGateway` — that is the **only** code in the system allowed to know that PayPal exists. Every other service depends on `PaymentGateway`, never on PayPal. When the CFO swaps providers, exactly one module changes.

## Where the Principle Comes From: A Brief History

### The Software Crisis

By the mid-1960s, software had quietly become more complex than the hardware that ran it. **Margaret Hamilton**, lead software engineer for the Apollo missions, famously observed that *"the software was more complex [than the hardware] for the manned missions".* In 1968 the NATO conference on software engineering crystallized the **"Software Crisis"** — the recognition that software projects were systematically late, over budget, and failing to meet specifications. Brooks would later capture the same lament in *The Mythical Man-Month*.

That crisis did not disappear; it scaled. The Apollo Guidance Computer software was on the order of 145,000 lines of code. Modern cars can contain more than 100 million lines. The engineers building today's systems are not a thousand times smarter than the engineers of the 1960s. The only way this works is architectural: we build systems so that no one person has to understand every part at once.

A central question came out of that conference: *how do you decompose a large program so that complexity does not bury the team?* For most of the 1960s the answer was: **break the program into the steps of a flowchart, and make each step a module**. This is the natural impulse — it mirrors how humans describe procedures. But it scales badly: when a step's *details* change, every step that depended on those details breaks too.

### Why Connections Grow Faster Than Modules

Adding a module does not just add one more thing to understand. It also adds possible relationships with every module already present. The number of possible pairwise relationships grows as `n * (n - 1) / 2`:

| Modules | Possible pairwise relationships |
|---:|---:|
| 4 | 6 |
| 8 | 28 |
| 16 | 120 |

Real systems do not use every possible relationship, and they should not. But the growth pattern explains why unmanaged designs turn painful so quickly. A system with too many unplanned dependencies becomes a **Big Ball of Mud**: low maintainability, low understandability, and high fragility. Small changes force edits across many modules, and a change that looked local produces bugs somewhere else. Information Hiding is one of the main ways we keep the actual dependency graph much smaller than the possible one.

### David Parnas, 1972, and the KWIC Example

Four years after the NATO conference, **David L. Parnas** published a short, sharp paper titled *On the Criteria To Be Used in Decomposing Systems into Modules* {% cite Parnas1972 %}. He took a tiny example program — the **KWIC (Key Word In Context) index** — and decomposed it two ways.

The KWIC system itself is small: it accepts an ordered set of lines, where each line is a sequence of words. Any line can be *circularly shifted* by repeatedly removing the first word and appending it to the end. The system outputs all circular shifts of all lines, sorted alphabetically. This is not just a toy — Unix's "permuted" index for the `man` pages is essentially a real-world KWIC.

Parnas decomposed it two ways:

| Decomposition | Module = ... | When the data structure changes ... |
|---|---|---|
| **Conventional** | one step of the flowchart (read input, shift, alphabetize, print) | almost every module changes, because each step *knows* the shared data structure |
| **Information-hiding** | one *design decision* (e.g., "how lines are stored", "how shifting is implemented") | only the one module that owns the decision changes |

He then traced several plausible changes through both designs: changes to the **processing algorithm** (shift each line as it is read, vs. shift all lines at once, vs. shift lazily on demand); changes to the **data representation** (how lines are stored, whether circular shifts are stored explicitly or as pairs of *(line, offset)*); enhancements to **function** (filter out shifts starting with noise words like "a" and "an"; allow interactive deletion); changes to **performance** (space and time); and changes to **reuse**. The information-hiding decomposition absorbed each change inside one module; the conventional one rippled across most of the system.

Parnas's conclusion was startling at the time:

* Both decompositions *worked*, but the information-hiding one was dramatically easier to change, easier to understand independently, and easier to develop in parallel.
* The mistake of the conventional decomposition was that it treated the *processing sequence* as the criterion for splitting modules — a criterion that exposed every shared assumption to every module.
* The right criterion is: **what design decisions does this module hide?** A module that hides a decision *no one else needs to know* is a good module. A module whose existence cannot be justified by any hidden decision is a bad module.
* A practical test for hiding: imagine **two design alternatives, A and B**, for some volatile decision (e.g., shift-on-read vs. shift-on-demand). If you can design the module's interface so that **both A and B are implementable behind the same API**, you have hidden the decision well — you can switch later without rewriting the clients.

This paper is one of the most cited papers in all of software engineering. Many of the principles you will meet later — encapsulation, abstract data types, object-oriented design, layered architecture, dependency inversion, microservices — are direct descendants of this single argument.

### 1985: Making Information Hiding Work at Real Scale

The 1972 KWIC example explains the criterion. The 1985 paper *The Modular Structure of Complex Systems* shows what happens when the idea is applied to a real, constrained system: the A-7E aircraft's Operational Flight Program {% cite ParnasClementsWeiss1985 %}. That program had hard real-time constraints, tight memory limits, hardware interfaces, pilot-display behavior, physical models, and many arbitrary details that had to be precisely right. It was not a classroom toy.

Parnas, Clements, and Weiss found that information hiding remained practical, but only with an extra design artifact: a **module guide**. At a dozen modules, a careful designer may remember where each secret lives. At hundreds of modules, that hope breaks. Maintainers need a map organized around the secrets, not just a directory tree or API reference. Their concise description is worth remembering: **"The module guide tells you which module(s) will require a change."**

A module guide is therefore different from ordinary API documentation:

| Document | Main question it answers |
|---|---|
| **Module guide** | Which module owns this design decision, and which module should change if the decision changes? |
| **Module specification** | How do clients use this module, and what behavior does it promise? |
| **Implementation notes** | How does the module currently keep its promise internally? |

The paper also separates three structures that beginners often collapse into one:

* **Module structure:** work assignments and hidden secrets — what this chapter is mostly about.
* **Uses structure:** which programs require the presence of which other programs to execute.
* **Process structure:** the run-time decomposition into concurrent activities or processes.

Those structures can cut across each other. A module is not necessarily one class, one process, one package, or one deployment unit. A module is a responsibility boundary around a secret. In the A-7E redesign, the top-level module guide grouped secrets into **hardware-hiding**, **behavior-hiding**, and **software-decision** modules. That move is a useful model for modern systems too: separate decisions imposed by the platform, decisions imposed by required behavior, and decisions made internally by software designers.

### 1994: Information Hiding Slows Software Aging

Parnas later connected information hiding to the long-term health of software in his 1994 invited talk *Software Aging* {% cite Parnas1994SoftwareAging %}. The opening line is deliberately blunt: **"Programs, like people, get old."** His point is not that bits decay. Software ages because the world around it changes, and because repeated changes can damage the original design.

He names two distinct causes:

1. **Lack of movement.** A product can age even if nobody touches it. Users, hardware, operating systems, interfaces, regulations, and competitors move on. A program that was excellent in 1998 can be obsolete in 2026 because the environment changed around it.
2. **Ignorant surgery.** A product can also age because people change it without understanding its original design concept. Each change adds an exception, bypass, duplicated assumption, or undocumented special case. Eventually, "nobody understands the modified product."

Information hiding is preventive medicine for both causes. You cannot predict every future change, but you can predict **classes** of change: storage engines change, vendors change, hardware changes, UI expectations change, data formats change, algorithms change. Parnas's advice is to estimate which classes are likely over the product's lifetime and confine each one to a small amount of code. His compact slogan is: **"Designing for change is designing for success."**

The second lesson from *Software Aging* is about documentation and review. If the secret a module hides is not recorded, future maintainers cannot preserve it. They may accidentally route around the boundary and restart the aging process. Parnas states the professional standard sharply: **"If it's not documented, it's not done."** Good design documentation is not ceremony after coding; it is part of the design medium itself.

# The Mechanics: Modules, Secrets, and Interfaces

## The Anatomy of a Module: Interface and Secret

A **module** is an independent unit of work. Parnas defined it as *"a work assignment given to a programmer or programming team"* — something one engineer (or one small team) can develop, test, and reason about in isolation. In practice a module can be a function, a class, a package, a library, a microservice, or even an entire team-owned subsystem. The granularity does not matter; what matters is the rule below.

Every module has **two parts**:

| Part | What it is | Who sees it | Stability |
|---|---|---|---|
| **Interface** | The stable contract describing *what* the module does | Visible to every client | Should change rarely |
| **Implementation (the secret)** | The code that fulfills the contract: data structures, algorithms, libraries used, sequence of internal steps | Hidden inside the module | Free to change at any time |

Picture an iceberg: the small tip above water is the interface. The vast bulk below water is the implementation — the secret. The whole point is that the implementation can be *anything you want*, so long as the interface keeps its promises.

A familiar analogy: a **wall power outlet**. The interface is the standard two- or three-prong socket and the guaranteed voltage and frequency. The implementation — solar panels, a coal plant, a nuclear reactor, a wind turbine — is hidden. Your laptop charger doesn't know, doesn't care, and cannot be broken by a change in the power source. The grid can swap solar in at noon and switch to gas at midnight without you ever rewriting your charger.

## Common Secrets Worth Hiding

Parnas's paper was deliberately abstract, but five decades of practice have produced a recognizable list of *categories* of decisions that are almost always worth hiding. Use this as a checklist when you decompose a system:

* **Data structures and data formats.** Whether names are stored as a `String`, a normalized `Person` record, an array of glyphs, or a row in a database. Whether IDs are integers or UUIDs.
* **Storage location.** Whether information lives in memory, on a local disk, in a SQL database, in S3, in Redis, or behind a third-party API.
* **Algorithms and computational steps.** A* vs. Dijkstra for routing. Quicksort vs. mergesort. Greedy vs. dynamic-programming for an optimization. Which AI model is used. Whether results are cached.
* **External dependencies — libraries, frameworks, vendors.** Axios vs. Fetch. MongoDB vs. Postgres vs. Supabase. PayPal vs. Stripe vs. Braintree. OpenGL vs. Vulkan.
* **Hardware and platform details.** CPU word size, byte ordering, screen resolution, file-path separators, OS-specific APIs.
* **Network protocols.** REST vs. gRPC, JSON vs. Protobuf, HTTP/1.1 vs. HTTP/2 — *as a transport detail*. (Whether the protocol is **stateful or stateless**, however, is often part of the interface; see below.)
* **Internal sequence of operations.** Whether a request is processed in two passes or one, whether validation runs before or after enrichment.

A useful question to ask while designing: *"If I can imagine a future where this decision changes, can I draw a circle around exactly the modules that would have to change"?* If the circle is small (ideally one module), the secret is well hidden. If the circle is large, the system has a structural problem you will pay for later.

## Interfaces Are Permission to Assume

An interface does not merely hide code. It gives clients **permission to assume** certain facts. Every public name, type, return shape, exception, ordering guarantee, flag, status code, score scale, and data field tells clients something they may build on. Once clients build on it, that fact is no longer private.

Parnas made this point in his module-specification paper: a specification should give users what they need to use a module correctly, and **"nothing more"** {% cite Parnas1972ModuleSpecification %}. That is stricter than "make the code compile." A precise interface can still be too revealing.

| Leaky contract | What clients learn | Safer contract |
|---|---|---|
| `search_bm25(query) -> list[(sqlite_row, bm25_score, posting_bucket)]` | The ranking algorithm, score scale, storage row shape, and tie-break mechanism | `search(query) -> SearchPage`, with domain-level `SearchHit` values and an opaque cursor |
| `DatabaseWrapper.execute_sql(sql)` | The application stores data in SQL tables and lets callers know table and column names | `UserDirectory.find_by_email(email) -> UserProfile`, with storage details hidden |
| `quote_monthly_compound_loan(principal, rate, months)` | The compounding policy is fixed into the public operation name | `quote(LoanTerms) -> RepaymentQuote`, with calculation policy owned by the quote module |
| `load_users_sorted_by_internal_id()` | The representation has an internal ID and callers may rely on that order | `list_users(order: UserOrder)`, exposing only domain orders clients genuinely need |

This is also why one part of Parnas's improved KWIC design was still a design error: the circular-shift module specified an ordering that clients did not need. The interface was correct, but it revealed more than necessary and restricted future implementations. The design question is therefore not *"Can I expose this accurately?"* but *"Should any client be allowed to depend on this?"*

The inverse mistake is hiding information that callers genuinely need. Whether a protocol is stateful, whether a request can be rate-limited, whether an operation can fail with a retryable error, and whether a payment method is offered to users are usually contract facts. Hide implementation details; expose the stable facts clients need to use the module correctly.

## Why Information Hiding Matters: Concrete Benefits

Information Hiding is not an aesthetic. It produces measurable outcomes that teams care about.

1. **Local change.** When a hidden decision changes, exactly one module needs to be edited. The change does not ripple through the codebase, does not require a merge across teams, and does not need a full regression sweep — only the one module's tests need to pass.
2. **Local reasoning.** A developer reading `OrderService` does not need to load PayPal's API, retry logic, or webhook semantics into their head. They only need the contract of `PaymentGateway`. Studies of professional developers find that **program comprehension consumes ~58% of their time** *(Xia et al., 2017, IEEE TSE)* — every byte of detail you can keep out of a reader's head is real, recurring time saved.
3. **Parallel work.** If `PaymentGateway`'s interface is fixed in week 1, two developers can work in parallel: one builds the PayPal implementation behind the interface; another builds `OrderService` against the interface, using a fake. Neither blocks the other.
4. **Independent testability.** A module whose dependencies are abstracted behind interfaces can be tested with stubs and fakes. You do not need a real PayPal account to test `OrderService` — you supply a `FakePaymentGateway` that records what it was asked to do.
5. **Replaceability.** When a vendor raises prices, a library is deprecated, or a database hits a scaling wall, the swap is bounded. The blast radius of "we're changing payment providers" is one module instead of one codebase.
6. **Slower software aging.** Long-lived software changes because successful products attract users, feature requests, new platforms, and new regulations. Information Hiding keeps those changes from eroding the whole structure. A hidden secret can be repaired, replaced, or documented without turning one maintenance edit into system-wide surgery.

The mirror-image of these benefits is the cost of *failing* to hide information: the **Big Ball of Mud** {% cite Foote1997BigBallOfMud %}, where unmanaged complexity leaves every module knowing every other module's secrets, and a one-line business change requires touching dozens of files. This is the modern face of the 1968 software crisis.

## Why Good Modularity May Feel Harder at First

Students sometimes report that the leaky version is "easier to understand" because it has fewer files, fewer abstractions, and all the details are visible in one place. That reaction is real. A better modular design can add first-read cost: you must learn the abstraction before you can see the hidden implementation.

That is why Information Hiding should be evaluated under **change**, not only under first-glance readability. In a controlled study of 40 CS and software-engineering students, Tempero, Blincoe, and Lottridge found that students working with the higher-modularity design were more likely to complete a modification task successfully, while immediate understanding trended lower for that design {% cite TemperoBlincoeLottridge2023Modularity %}. The lesson is not "make code harder." The lesson is that the payoff appears when the system must evolve. A teaching example or code review that never asks "what changes next?" will often miss the value of hiding.

## Deep Modules vs. Shallow Modules

A modern extension of Parnas's idea, due to **John Ousterhout** in *A Philosophy of Software Design* {% cite Ousterhout2021PSD %}, is the distinction between **deep** and **shallow** modules.

<div class="deep-module-diagram-wrap">
<svg class="deep-module-diagram" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Side-by-side comparison: a deep module has a small interface above a large hidden implementation, while a shallow module has a wide interface above a tiny implementation and hides little." viewBox="0 0 820 360" width="100%">
  <title>Deep and shallow module comparison</title>
  <defs>
    <filter id="ih-node-shadow" x="-14%" y="-14%" width="144%" height="156%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="2.5" stdDeviation="2.6" flood-color="#000" flood-opacity="0.22"/>
    </filter>
  </defs>

  <!-- Panel A: Deep Module -->
  <text x="170" y="28" text-anchor="middle" font-size="18" font-weight="700" fill="#1d8348">Deep module ✓</text>

  <rect x="120" y="50" width="100" height="38" rx="6" ry="6" fill="#dbe8f8" stroke="#4060a0" stroke-width="1.5" filter="url(#ih-node-shadow)"/>
  <text x="170" y="74" text-anchor="middle" font-size="14" fill="#222" font-weight="600">interface</text>

  <rect x="60" y="100" width="220" height="220" rx="6" ry="6" fill="#dbe8f8" stroke="#4060a0" stroke-width="1.5" filter="url(#ih-node-shadow)"/>
  <text x="170" y="200" text-anchor="middle" font-size="14" fill="#222" font-weight="600">implementation</text>
  <text x="170" y="222" text-anchor="middle" font-size="12" fill="#555">(hides a LOT of complexity:</text>
  <text x="170" y="240" text-anchor="middle" font-size="12" fill="#555">data structures, algorithms,</text>
  <text x="170" y="258" text-anchor="middle" font-size="12" fill="#555">libraries, edge cases…)</text>

  <text x="295" y="73" font-size="12" fill="#1d8348" font-style="italic">small</text>
  <text x="295" y="88" font-size="12" fill="#1d8348" font-style="italic">interface</text>
  <text x="295" y="208" font-size="12" fill="#1d8348" font-style="italic">deep</text>
  <text x="295" y="223" font-size="12" fill="#1d8348" font-style="italic">impl.</text>

  <!-- Vertical separator -->
  <line x1="395" y1="40" x2="395" y2="340" stroke="#ccc" stroke-width="1" stroke-dasharray="4 4"/>

  <!-- Panel B: Shallow Module (centered around x=590) -->
  <text x="590" y="28" text-anchor="middle" font-size="18" font-weight="700" fill="#c0392b">Shallow module ✗</text>

  <rect x="450" y="50" width="280" height="60" rx="6" ry="6" fill="#dbe8f8" stroke="#4060a0" stroke-width="1.5" filter="url(#ih-node-shadow)"/>
  <text x="590" y="78" text-anchor="middle" font-size="14" fill="#222" font-weight="600">interface</text>
  <text x="590" y="96" text-anchor="middle" font-size="12" fill="#555">(many methods, lots of detail exposed)</text>

  <rect x="540" y="120" width="100" height="50" rx="6" ry="6" fill="#dbe8f8" stroke="#4060a0" stroke-width="1.5" filter="url(#ih-node-shadow)"/>
  <text x="590" y="150" text-anchor="middle" font-size="14" fill="#222" font-weight="600">impl.</text>

  <text x="745" y="74" font-size="12" fill="#c0392b" font-style="italic">large</text>
  <text x="745" y="89" font-size="12" fill="#c0392b" font-style="italic">interface</text>
  <text x="650" y="143" font-size="12" fill="#c0392b" font-style="italic">tiny</text>
  <text x="650" y="158" font-size="12" fill="#c0392b" font-style="italic">impl.</text>

  <text x="590" y="220" text-anchor="middle" font-size="13" fill="#555">Hides little. Reader pays the cost</text>
  <text x="590" y="240" text-anchor="middle" font-size="13" fill="#555">of a wide interface and gets</text>
  <text x="590" y="260" text-anchor="middle" font-size="13" fill="#555">almost no abstraction in return.</text>
</svg>
</div>

* A **deep module** hides a *lot* of complexity behind a *small* interface. Examples: the file system (`open`, `read`, `write`, `close` — and behind it, hundreds of thousands of lines that handle disks, caching, journaling, permissions, network mounts); a garbage collector (`new` — and a sophisticated runtime behind it); a TCP socket.
* A **shallow module** exposes a wide interface that hides little. Pass-through getters and setters, classes whose methods one-to-one delegate to another class, "service" classes with twenty methods that each do one trivial thing. The reader pays the cost of learning a new interface but gains almost no abstraction.

Deep modules are the *goal* of Information Hiding. Each method on the interface should "buy" the reader a meaningful chunk of hidden complexity. Shallow modules — even if every field is `private` — give you the worst of both worlds: more vocabulary to learn, and no actual hiding.

A simple heuristic: **the bigger the difference between the interface size and the implementation size, the deeper the module**. Deep modules are valuable. Shallow modules are tax.

## Coupling and Cohesion: The Metrics of Hiding

Information Hiding is the *principle*; **coupling** and **cohesion** are the *metrics* that measure how well you applied it.

* **Coupling** = the strength of dependencies *between* modules. **Lower is better.** Two modules are tightly coupled if a small change in one usually requires changes in the other.
* **Cohesion** = the strength of dependencies *within* a module. **Higher is better.** A cohesive module's methods all serve a single, focused purpose.

When secrets are well hidden, coupling drops (because clients only know the interface) and cohesion rises (because everything in a module exists to support that one hidden decision). When secrets leak, the opposite happens.

| Aspect | High Coupling, Low Cohesion (bad) | Low Coupling, High Cohesion (good) |
|---|---|---|
| **Change** | Ripples through many modules | Stays inside one module |
| **Understanding** | You must load many modules into memory at once | You can reason about one module in isolation |
| **Testing** | Hard to test in isolation; needs many real dependencies | Easy to test with fakes |
| **Reuse** | Cannot extract one part without dragging others along | Modules are self-contained and portable |

### Not All Dependencies Are Obvious

Coupling has two flavors, and the second is the dangerous one:

* **Syntactic dependency:** Module A *won't compile* without Module B — it imports B, names B's types, calls B's methods. Easy for a tool to detect.
* **Semantic dependency:** Module A *won't function correctly* without Module B, even though A doesn't name B. A and B might both implement the same hidden assumption — for example, two modules that both assume "phone numbers are stored as 10-digit strings without formatting". If you change the assumption in one, the other silently breaks.

Semantic coupling is the reason "we'll just refactor it later" is so often wrong: the syntactic coupling is gone but the *shared assumptions* are still scattered. Information Hiding fights both — but semantic coupling only goes away when the shared assumption *itself* lives in exactly one place.

## Information Hiding ≠ Encapsulation ≠ "Make It Private"

This is the most common misconception about Information Hiding, and it is worth lingering on.

> **"If I make all my fields and methods `private`, I'm doing information hiding".**

No. *Visibility modifiers* (`private`, `protected`, `public`) are a small **language tool** that *helps you* hide things. **Information Hiding is the broader design principle** of choosing what should be hidden in the first place. You can violate Information Hiding while having no `public` fields anywhere:

<div class="inline-language-switcher" data-language-switcher data-default-language="java">
  <div class="inline-language-tabs" role="tablist" aria-label="Private fields still leak vendor code language">
    <button type="button" role="tab" data-language-option="java" aria-selected="true">Java</button>
    <button type="button" role="tab" data-language-option="cpp" aria-selected="false">C++</button>
    <button type="button" role="tab" data-language-option="python" aria-selected="false">Python</button>
    <button type="button" role="tab" data-language-option="ts" aria-selected="false">TypeScript</button>
  </div>

  <div class="inline-language-panel is-active" data-language-panel="java" role="tabpanel" markdown="1">
```java
// Every field is private. The class is still leaking PayPal as a "secret".
class OrderService {
    private final PayPalClient paypal;          // <-- the secret is in the field type
    private PayPalAuthToken token;              // <-- and in this type

    OrderService(PayPalClient paypal) {
        this.paypal = paypal;
    }

    public PayPalCharge checkout(Order order, PayPalAccount account) {
        token = paypal.authenticate(account);
        return paypal.charge(order.total(), token);
    }
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="cpp" role="tabpanel" markdown="1">
```cpp
// Every field is private. The class is still leaking PayPal as a "secret".
class OrderService {
public:
    explicit OrderService(PayPalClient& paypal) : paypal(paypal) { }

    PayPalCharge checkout(const Order& order, const PayPalAccount& account) {
        token = paypal.authenticate(account);
        return paypal.charge(order.total(), token);
    }

private:
    PayPalClient& paypal;   // <-- the secret is in the field type
    PayPalAuthToken token;  // <-- and in this type
};
```
  </div>

  <div class="inline-language-panel" data-language-panel="python" role="tabpanel" markdown="1">
```python
# Naming a field with a leading underscore is only a convention.
# The class is still leaking PayPal as a "secret".
class OrderService:
    def __init__(self, paypal: "PayPalClient") -> None:
        self._paypal = paypal          # <-- the secret is in the field type
        self._token: "PayPalAuthToken | None" = None

    def checkout(self, order: "Order", account: "PayPalAccount") -> "PayPalCharge":
        self._token = self._paypal.authenticate(account)
        return self._paypal.charge(order.total(), self._token)
```
  </div>

  <div class="inline-language-panel" data-language-panel="ts" role="tabpanel" markdown="1">
```typescript
// Every field is private. The class is still leaking PayPal as a "secret".
class OrderService {
  private token?: PayPalAuthToken; // <-- the secret is in this type

  constructor(
    private readonly paypal: PayPalClient, // <-- and in the field type
  ) { }

  checkout(order: Order, account: PayPalAccount): PayPalCharge {
    const token = this.paypal.authenticate(account);
    this.token = token;
    return this.paypal.charge(order.total(), token);
  }
}
```
  </div>
</div>

`private` did not save us. The PayPal decision is still woven into `OrderService`'s **interface** — the parameter types and return types of its public methods. Anyone who calls `checkout` learns that PayPal exists. The fix is to invent a `PaymentGateway` abstraction and let the *interface* of `OrderService` mention only that abstraction.

A better way to remember the distinction:

| Term | What it means |
|---|---|
| **Information Hiding** | A *design principle*: identify volatile decisions and hide each one inside one module. |
| **Encapsulation** | A *language mechanism*: bundle data and the operations on it into a single unit (a class). |
| **Access modifiers** (`private`, `protected`, `public`) | A *language tool*: restrict who can call which member. Used as one of many tools to enforce encapsulation. |
| **Abstraction** | A *thinking technique*: reason about something using only the properties relevant to your purpose. The interface of a hidden module is an abstraction. |

You need all four in the toolbox. The principle (Information Hiding) tells you *what* to do; the mechanisms (encapsulation, access modifiers, abstraction) help you *enforce* it.

# Applying and Evaluating Information Hiding

## How Information Hiding Relates to Other Concepts

Students often confuse Information Hiding with neighboring ideas. Drawing the distinctions sharpens your ability to apply each.

| Concept | What it says | Relationship to Information Hiding |
|---|---|---|
| **[Separation of Concerns](/SEBook/designprinciples/soc.html)** | Divide the system into distinct sections, each addressing a separate concern. | SoC tells you *which* aspects to separate; Information Hiding tells you *how* to protect each separated decision behind a stable interface. |
| **Modularity** | Split a system into independent work units. | Modularity is the act of splitting; Information Hiding is the *criterion* for splitting well (split along volatile decisions). |
| **Encapsulation** | Bundle data and operations into a single unit. | The language mechanism most often used to enforce Information Hiding. You can encapsulate without hiding (everything `public`); you can hide without language-level encapsulation (a Python module with leading-underscore conventions). |
| **Abstraction** | Reason about something via only its essential properties. | A module's interface *is* an abstraction; Information Hiding is what makes the abstraction trustworthy. |
| **[Single Responsibility (SRP)](/SEBook/designprinciples/solid.html)** | A class should have one reason to change. | SRP is Information Hiding restated for the *class* level — one class hides one secret, so it has one reason to change. |
| **[Dependency Inversion (DIP)](/SEBook/designprinciples/solid.html)** | High-level policy depends on abstractions; details depend on those abstractions. | DIP is the *mechanism* most commonly used to keep secrets hidden across architectural layers. |
| **Low Coupling / High Cohesion** | Modules should depend on each other little, and contain related things. | The metrics by which you measure whether Information Hiding succeeded. |
| **[Open/Closed Principle (OCP)](/SEBook/designprinciples/solid.html#openclosed-principle-ocp)** | Open for extension, closed for modification. | When secrets are well hidden, *adding* a new variant (e.g., `StripeGateway`) extends the system without modifying any existing module — the OCP payoff. |

A useful slogan, attributed to Robert C. Martin: **"Gather together the things that change for the same reasons. Separate those things that change for different reasons".** That single sentence captures Information Hiding, SRP, and SoC simultaneously.

## Mechanisms for Hiding

Knowing what to hide is one skill; knowing the *moves* to actually hide it is another. The recurring mechanisms:

1. **Interfaces and abstract types.** Define a contract (`PaymentGateway`) and write all clients against it; let one concrete class (`PayPalGateway`) implement it. The decision "we use PayPal" lives in exactly one file plus the dependency-injection wiring.
2. **Dependency Inversion.** Don't reach down into low-level modules from high-level ones. Define the abstraction the high-level module *needs* and let the low-level module implement it. (See [DIP](/SEBook/designprinciples/solid.html).)
3. **[Facade pattern](/SEBook/designpatterns/facade.html).** Wrap a complex subsystem behind a simple interface; clients see only the facade. Common when a third-party library is itself a tangled mess.
4. **[Adapter pattern](/SEBook/designpatterns/adapter.html).** Wrap an external API in your own interface so the rest of the code is insulated from its quirks.
5. **Repository / Gateway pattern.** Hide the storage decision (SQL? NoSQL? in-memory?) behind a domain-shaped interface (`OrderRepository.findById(id)`).
6. **Modules, packages, namespaces.** The crudest mechanism — putting things in different files and folders — already provides a unit of hiding, especially when paired with strong language-level visibility.
7. **Access modifiers.** `private`, `protected`, internal-only modules in Rust/Go/Swift, JavaScript closures. The enforcement layer that prevents accidental leakage.
8. **Abstract data types (ADTs).** Define a type by its operations, not its representation. Liskov and Zilles's account of ADTs is a direct way to operationalize Parnas's principle: clients use the type's operations while the representation stays inaccessible {% cite LiskovZilles1974ADT %}.

You will rarely use only one of these. A good design typically composes several: an `OrderService` depends on a `PaymentGateway` interface (mechanism 1 + 2); the concrete `PayPalGateway` is a facade (3) over the messy PayPal SDK; the SDK is itself adapted (4) so swapping it out is bounded; the whole thing lives in a `payments/` package whose exports are restricted (6 + 7).

## Single Choice Principle: Hide the Exhaustive List

The **Single Choice principle** is a focused version of Information Hiding for designs with a fixed set of alternatives. It says:

> If a system must choose among several alternatives, only one module should know the exhaustive list of those alternatives.

If `OrderService`, `RefundService`, `WalletService`, and `AnalyticsService` all contain a switch over `"paypal"`, `"stripe"`, and `"apple-pay"`, then every one of those modules knows the payment-provider list. Adding `"openai-pay"` becomes a four-module edit. That is a leaked design decision.

The usual fix is **polymorphism**: define one abstract operation (`PaymentGateway.charge`, `PaymentGateway.refund`) and let each provider implement it. Callers invoke the operation; they do not switch on the provider. One factory, dependency-injection module, or configuration boundary may still know the exhaustive list, but the rest of the system does not. The choice is made in one place.

## Change Impact Analysis: Evaluating Whether Your Design Hides Well

Information Hiding is verified by *simulating change*. The procedure, used in industry as **change impact analysis**:

1. **List the changes that could plausibly happen.** New payment providers. New currencies. A migration from SQL to NoSQL. A change in regulatory requirements. Brainstorm widely; the discipline of listing forces realism.
2. **Estimate the likelihood of each.** Some are inevitable (libraries get deprecated); some are speculative (a 10× traffic spike).
3. **For each likely change, count the modules that would have to change.** Ideally **one**. If many, the secret is leaking.
4. **Redesign until no change is both *highly likely* and *highly expensive*.** You will not eliminate every tail risk — but you should not be one likely change away from a re-architecture.

This is also the procedure to apply when **reviewing** somebody else's design: open the code, pick a plausible future change, and trace what would have to be edited. A well-hidden design lights up one module; a poorly-hidden one lights up the whole tree.

## Design Docs: Recording the Reasoning

Information Hiding helps you delay decisions because a hidden implementation can change after the interface is stable. But you still need a disciplined way to decide what to hide, what to expose, and what trade-offs you are accepting. A practical design process is:

1. **Identify requirements.** Use user stories for functional behavior, then add quality attributes such as maintainability, security, performance, reliability, availability, and testability.
2. **Generate several alternatives.** Do not fall in love with the first design. For novice designers especially, producing multiple options reliably improves the final choice because it exposes trade-offs that a single design hides.
3. **Evaluate the alternatives.** Ask how each option handles the likely changes. Which modules change if the database changes? Which if the payment provider changes? Which if security requirements tighten?
4. **Choose and document the trade-off.** Most real designs are not "best at everything". They sacrifice one quality to protect another.
5. **Delay decisions when evidence is missing.** If you do not yet know which storage engine or AI model you need, design an interface that lets that decision remain hidden until better information arrives.

Industry teams often capture this reasoning in a **design doc**. A useful design doc usually includes:

| Section | What it records |
|---|---|
| **Context and scope** | The background facts and boundaries of the problem |
| **Goals and non-goals** | Requirements, quality attributes, and deliberately excluded concerns |
| **Proposed design** | The chosen architecture, APIs, data model, and module responsibilities |
| **Alternatives and trade-offs** | The options considered, why they were rejected, and what risks remain |

This is not bureaucracy for its own sake. It creates organizational memory. Six months later, when a teammate asks why `PaymentGateway` exists, the design doc should answer: which decision it hides, which alternatives were considered, and which future changes the boundary was meant to absorb.

For larger systems, add the **module-guide** layer from Parnas, Clements, and Weiss {% cite ParnasClementsWeiss1985 %}. A normal API reference tells a caller how to use `PaymentGateway`. A module guide tells a maintainer that "payment-provider choice" is the secret of the gateway module, that order/refund/wallet services are not allowed to depend on provider SDKs, and that a provider migration should start at that module. The guide protects the design intent after the original designers have moved on.

A compact module-guide card is often enough for a class project or design review:

| Field | Question it answers |
|---|---|
| **Module** | What work assignment or responsibility boundary are we naming? |
| **Primary secret** | What externally meaningful, likely-to-change decision is this module supposed to hide? |
| **Secondary secrets** | What additional implementation decisions did we make while realizing the primary secret? |
| **Stable interface** | What are clients allowed to assume? |
| **Forbidden assumptions** | What must clients not know, even if they could discover it by reading the implementation? |
| **Likely absorbed changes** | Which future changes should stay local to this module? |
| **Non-absorbed changes** | Which changes would legitimately require changing the interface or neighboring modules? |
| **Fuzzy or restricted boundary** | Which helper module, adapter, or internal API may know part of the secret, and why? |

The card is useful because it forces the central Parnas question into writing: *who is allowed to know what?* A vague entry like "Payment module handles payments" is almost useless. A strong entry says "payment-provider protocol and response mapping" is the primary secret, retry and idempotency details are secondary secrets, provider SDK types are forbidden outside the gateway, and a provider migration should not touch order checkout.

## A Five-Step Method for Applying Information Hiding

When you are designing (or reviewing) a module, run this checklist:

1. **List the secrets.** What design decisions does this module own? Whether it stores its data as an array vs. a tree; which library it uses; the algorithm; the data format. If you cannot list any secret, the module probably should not exist on its own.
2. **Verify each secret is owned in *exactly one* place.** If two modules both "know" the secret, they are semantically coupled. Pick one.
3. **Inspect the interface for leaks.** Read every public method signature, return value, event, exception, status code, ordering guarantee, flag, and test helper. Does any name or type reveal a vendor, database, library, file format, score scale, table name, storage row, algorithm, lifecycle rule, timing assumption, or low-level data structure? If yes, the secret has leaked into the contract.
4. **Simulate a likely change.** Pick a realistic future change and trace what would need to be edited. If the answer is more than this module, redesign.
5. **Check for shallowness and payoff.** Is the implementation behind the interface non-trivial? A thin adapter can be worthwhile if it centralizes a volatile vendor, storage engine, or exhaustive choice list. But if the module is a pass-through with no plausible variation to protect, merge it back into its caller — you have added an interface without buying hiding.

## When NOT to Apply Information Hiding (Trade-offs Are Real)

Like every design principle, mindless application of Information Hiding produces its own pain.

* **Throwaway scripts.** A 50-line cron job does not need a `PaymentGateway` abstraction in front of a `print` statement. Hiding decisions you will never change is wasted ceremony.
* **Single-variant systems with stable scope.** If there will be exactly one database forever — and you are sure of it — a thin abstraction over it is overhead.
* **Premature abstraction.** Inventing a `PaymentGateway` when you know exactly one provider, in a domain you don't yet understand, will usually draw the seam in the wrong place. Wait for the second variant to materialize, then *refactor to* the abstraction. (See *Refactoring to Patterns*, Kerievsky 2004.)
* **Performance-critical inner loops.** Indirection has a cost — usually negligible, but occasionally measurable in tight loops or microservices boundaries. Sometimes you fuse layers deliberately for speed and comment loudly about why.
* **When the "secret" is actually part of the contract.** If callers genuinely need to know the property (e.g., whether a network protocol is stateful), hiding it produces mysterious bugs. Hiding the wrong thing is worse than hiding nothing.

The SE maxim: **the right number of abstractions is the smallest number that lets the system change gracefully.** Beyond that number, every extra layer is a tax paid in indirection, file count, and cognitive load.

## Anti-Patterns: What Poor Information Hiding Looks Like

Recognizing failure is half the skill.

* **Vendor name in the interface.** `OrderService.checkoutWithPayPal(...)`, `UserRepository.saveToMongo(...)`, `Logger.logToSplunk(...)`. The vendor is now part of the contract. Renaming the method when you switch vendors won't help — you'll have to rewrite every caller.
* **Returning the implementation type.** A repository method that returns `MySQLResultSet` instead of `List<Order>`. Every caller now depends on MySQL.
* **Leaky abstractions.** A "database-agnostic" `Repository` interface whose methods accept raw SQL fragments as strings. The interface pretends to hide the database; the parameters say otherwise.
* **Exposed mutable internals.** Returning a reference to an internal `List` instead of an immutable view. Callers can now mutate the module's state without going through its interface.
* **God classes.** A single class with thirty fields and a hundred methods. By construction, it cannot have a small set of secrets — it has too many.
* **Shallow modules.** A "service" class whose every method is a one-line pass-through to another class. The reader pays the cost of two interfaces and gets the abstraction value of one.
* **Conditional types in clients.** `if (paymentProvider == "paypal") { ... } else if (paymentProvider == "stripe") { ... }` scattered across the code. The provider is supposed to be hidden — but every site that branches on it is implicitly knowing the secret. Replace with polymorphism.
* **Documentation as a substitute for hiding.** A long comment explaining "this method is fragile because internally it depends on the order being stored as a list, please don't change it". If a secret has to be documented to clients, it has not been hidden.
* **Repeated exhaustive switches.** The same `switch` or `if/else` ladder over provider types, file formats, user roles, or states appears in multiple modules. Replace the scattered choice logic with one choice point plus polymorphic implementations.

## Predict-Before-You-Read: Spot the Violation

For each snippet, silently identify *which secret is leaking* before reading the analysis.

**Snippet A — "private" is not enough**
```java
class OrderService {
    private final PayPalClient paypal;
    private PayPalAuthToken token;

    OrderService(PayPalClient paypal) {
        this.paypal = paypal;
    }

    public PayPalCharge checkout(Order o, PayPalAccount acc) {
        token = paypal.authenticate(acc);
        return paypal.charge(o.getTotal(), token);
    }
}
```
> *Analysis:* The fields are `private`, but the field type and the public method signature still name `PayPalClient`, `PayPalAccount`, and `PayPalCharge`. The PayPal decision has leaked into the contract — every caller of `checkout` now compiles against PayPal. Replace with a `PaymentGateway` abstraction that exposes only neutral types.

**Snippet B — leaky storage**
```python
import sqlite3


class UserRepository:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection
        self.connection.row_factory = sqlite3.Row

    def find_by_email(self, email: str) -> list[sqlite3.Row]:
        return self.connection.execute(
            "SELECT * FROM users WHERE email=?", (email,)
        ).fetchall()  # returns a list of sqlite3.Row
```
> *Analysis:* The method signature looks abstract, but the *return value* is a `sqlite3.Row` — a SQLite-specific type. Every caller is now coupled to SQLite. Map to a domain object (`User`) before returning.

**Snippet C — clean**
```python
from typing import Protocol


class PaymentGateway(Protocol):
    def charge(self, order: Order, payment: PaymentDetails) -> ChargeResult: ...
    def refund(self, charge_id: ChargeId) -> RefundResult: ...

class OrderService:
    def __init__(self, gateway: PaymentGateway) -> None:
        self._gateway = gateway
    def checkout(self, order: Order, payment: PaymentDetails) -> ChargeResult:
        return self._gateway.charge(order, payment)
```
> *Analysis:* The vendor name appears nowhere in `OrderService`. Swapping providers means writing a new `PaymentGateway` implementation and changing the dependency-injection wiring; no service code is touched. The secret is hidden in exactly one place — the concrete gateway implementation.

## Common Misconceptions

* **"Make it `private` and you're done".** Visibility modifiers are *one* tool. Private fields whose *types* expose the vendor still leak. (See snippet A above.)
* **"Information Hiding is the same as Encapsulation".** Encapsulation is a *mechanism*; Information Hiding is the *principle that decides what to encapsulate*. You can encapsulate the wrong things.
* **"More layers = more hiding".** Stacking facades on facades is shallow-module-ism. Each layer must hide *something* — otherwise it just adds vocabulary.
* **"Hide everything".** Some decisions belong in the contract (statefulness, error behavior, rate limits). Hiding them produces silent failures or unusable APIs.
* **"Once decided, the secrets list never changes".** Reality: as the system evolves, what was once stable becomes volatile (e.g., "we will always be on AWS"). Re-evaluate the secrets when the change pressure arrives.
* **"Microservices automatically hide information".** A microservice with a 50-method REST API exposing every internal field is a distributed God Class. Service boundaries do not magically produce small interfaces; you still have to design them.

## Summary

* **Information Hiding** decomposes a system by *design decisions*, not by processing steps. Each module owns one likely-to-change decision and hides it from the rest of the system.
* Coined by **Parnas** {% cite Parnas1972 %} in response to the **Software Crisis**, it is the foundational principle behind modern modularity, encapsulation, abstract data types, and most of OOP.
* Parnas, Clements, and Weiss later showed that information hiding needs a **module guide** at complex-system scale: a document organized around secrets so maintainers can find the modules affected by a change.
* Software ages when its environment changes or when poorly understood maintenance damages the original design. Information Hiding slows that aging by keeping likely changes local and documented.
* Every module has a stable **interface** (the public contract) and a hidden **implementation** (the secret). Clients depend on the interface; the implementation is free to change.
* An interface is permission to assume. Public names, types, return values, errors, ordering guarantees, flags, and data shapes should expose stable, intentional information only.
* Common secrets include data structures, storage, algorithms, libraries, hardware, and processing sequence. Some things — statefulness, rate limits, exception behavior — belong in the interface.
* **Deep modules** hide a lot of complexity behind a small interface. **Shallow modules** add overhead without value.
* Coupling and cohesion are the *metrics* by which Information Hiding is measured. Low coupling, high cohesion = secrets are well hidden.
* The **Single Choice principle** says only one module should know the exhaustive list of alternatives; repeated switches over the same choices are leaked design decisions.
* Good design work generates and evaluates multiple alternatives, records trade-offs in design docs, names primary and secondary secrets in a module-guide card, and delays implementation decisions when the interface can stay stable.
* Information Hiding is *not* the same as `private`. Visibility modifiers are tools; Information Hiding is the principle that tells you *what* to hide.
* Verify a design with **change impact analysis**: simulate plausible changes and count the modules that would need to change. Good modularity may not feel cheaper on first read; its value becomes visible when the system evolves.
* Don't over-apply: throwaway scripts, single-variant systems, and hot inner loops sometimes pay the cost of hiding without enjoying the benefit.

# Further Reading and Practice

## Further Reading

* David L. Parnas. ["On the Criteria To Be Used in Decomposing Systems into Modules"](https://dl.acm.org/doi/10.1145/361598.361623). *Communications of the ACM*, 15(12), 1053–1058. December 1972. — *The original paper. Short, sharp, and one of the most-cited papers in software engineering.*
* David L. Parnas. ["A Technique for Software Module Specification with Examples"](https://dl.acm.org/doi/10.1145/361598.361626). *Communications of the ACM*, 15(5), 330–336. May 1972. — *Explains why specifications should give clients enough information to use a module correctly, and no unnecessary details.*
* David L. Parnas, Paul C. Clements, and David M. Weiss. ["The Modular Structure of Complex Systems"](https://doi.org/10.1109/TSE.1985.232209). *IEEE Transactions on Software Engineering*, SE-11(3), 259–266. March 1985. — *Shows how information hiding scales when paired with a module guide.*
* David L. Parnas. ["Software Aging"](https://doi.org/10.1109/ICSE.1994.296790). *Proceedings of the 16th International Conference on Software Engineering*, 279–287. 1994. — *Connects information hiding, documentation, and reviews to the long-term health of software products.*
* Barbara H. Liskov and Stephen N. Zilles. ["Programming with Abstract Data Types"](https://doi.org/10.1145/800233.807045). *Proceedings of the ACM SIGPLAN Symposium on Very High Level Languages*, 50–59. 1974. — *The classic bridge from information hiding to data abstraction.*
* William R. Cook. ["On Understanding Data Abstraction, Revisited"](https://doi.org/10.1145/1640089.1640133). *OOPSLA*, 557–572. 2009. — *Clarifies why abstract data types and objects are related but not the same idea.*
* Ewan Tempero, Kelly Blincoe, and Danielle M. Lottridge. ["An Experiment on the Effects of Modularity on Code Modification and Understanding"](https://doi.org/10.1145/3576123.3576138). *ACE '23*, 105–112. 2023. — *A useful empirical warning that students may need explicit support seeing modularity's change payoff.*
* John K. Ousterhout. *A Philosophy of Software Design* (2nd ed.). Yaknyam Press, 2021. — *The contemporary treatment. Coined the deep / shallow module distinction.*
* Robert C. Martin. *Clean Architecture: A Craftsman's Guide to Software Structure and Design*. Prentice Hall, 2017. — *Connects Information Hiding to SRP, DIP, and modern architecture.*
* Frederick P. Brooks Jr. *The Mythical Man-Month* (Anniversary ed.). Addison-Wesley, 1995. — *The classic essays on the Software Crisis and "No Silver Bullet".*
* Brian Foote and Joseph Yoder. ["Big Ball of Mud".](http://www.laputan.org/mud/) Proceedings of the 4th Pattern Languages of Programs Conference, 1997. — *What systems look like when Information Hiding is abandoned.*
* Xin Xia, Lingfeng Bao, David Lo, Zhenchang Xing, Ahmed E. Hassan, Shanping Li. ["Measuring Program Comprehension: A Large-Scale Field Study with Professionals".](https://doi.org/10.1109/TSE.2017.2734091) *IEEE Transactions on Software Engineering*, 44(10), 951–976, 2018. — *Source for the "developers spend ~58% of their time on program comprehension" finding.*
* Joshua Kerievsky. *Refactoring to Patterns*. Addison-Wesley, 2004. — *On evolving abstractions only when the change pressure proves you need them.*

## Practice

Test your understanding below. The flashcards and quiz turn the chapter's core prompts into retrieval practice: naming module secrets, spotting leaky `private` fields, deciding what belongs in an interface, identifying Single Choice violations, and explaining design trade-offs.

{% include flashcards.html id="design_principle_information_hiding" %}

{% include quiz.html id="design_principle_information_hiding" %}

*Pedagogical tip: Try to **explain** each concept out loud — to a teammate, a rubber duck, or your imaginary future self — before peeking at the answer. The "generation effect" strengthens memory more than re-reading ever will.*
