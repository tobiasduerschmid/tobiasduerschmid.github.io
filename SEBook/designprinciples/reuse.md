---
title: Design with Reuse
layout: sebook
---

# Design with Reuse

Software reuse means designing a solution so that useful parts can serve more than one context without being copied and re-edited by hand. Reuse is not just a matter of saving typing. Its real value is that shared behavior can be improved, tested, and documented in one place.

Good reuse starts with a stable responsibility. A module that hides a clear decision, exposes a small interface, and depends on few accidental details is much easier to reuse than code that only happens to work in one screen, one assignment, or one data shape.

## Why Reuse Matters

Reuse helps a team when it reduces repeated reasoning, not merely repeated code.

| Reuse goal | Design pressure |
|---|---|
| Avoid duplicated fixes | Put shared behavior behind one tested implementation. |
| Support multiple clients | Keep the public interface small and explicit. |
| Allow independent change | Hide implementation decisions that callers do not need. |
| Preserve readability | Reuse concepts, not tangled convenience shortcuts. |

Poor reuse has the opposite effect. A shared helper with too many parameters, hidden global state, or caller-specific branches becomes harder to change than two straightforward implementations. The goal is not to make everything generic. The goal is to recognize the parts of the design that are genuinely stable across contexts.

## Reuse and Other Design Principles

Design with reuse builds directly on the other design principles in this chapter:

* [Separation of Concerns](/SEBook/designprinciples/soc.html) helps identify which part of the system is reusable and which part is specific to the current UI, workflow, or environment.
* [Information Hiding](/SEBook/designprinciples/informationhiding.html) lets callers depend on what a component promises, not how it happens to work internally.
* [SOLID](/SEBook/designprinciples/solid.html) gives object-oriented techniques for extension, substitution, and dependency control when reuse spans multiple implementations.

## A Practical Test

Before extracting reusable code, ask three questions:

1. **What decision is this module hiding?** If the answer is vague, the abstraction is probably premature.
2. **Who will depend on this interface?** Reuse across real clients is more trustworthy than reuse imagined for a hypothetical future.
3. **What should be allowed to change later?** A reusable component should protect callers from likely internal change, not freeze the first implementation forever.

The best reusable designs are boring at the boundary: clear names, small inputs, predictable outputs, and no surprising dependencies.
