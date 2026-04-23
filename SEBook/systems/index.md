---
title: Systems
layout: sebook
---

# Systems

Real software does not run as one program on one machine. It runs across processes, machines, data centers, and continents; it stores state that must survive restarts and concurrent access; it communicates through networks that can delay, reorder, or lose messages. **Systems** is the study of the concepts every software engineer needs to reason about programs in this larger setting — not to become a distributed-systems researcher, but to make sound choices about the parts of the stack that sit below your application.

This section covers two foundational topics:

# Networking
How computers communicate across networks: the layered model (application / transport / network / link), TCP vs. UDP, DNS, HTTP, TLS, and the operational decisions that follow from each. When to pick which protocol, what each layer does (and does not) guarantee, and how those guarantees shape the applications built on top.

[Read the article](/SEBook/tools/networking.html)

# Data Management
How software stores data reliably: why we use a **DBMS** at all, the **relational model** (tables, primary keys, foreign keys), **SQL** as a declarative query language, the four core **relational-algebra operations** (Join, Selection, Projection, Group-By), **transactions** and the **ACID** guarantees (Atomicity, Consistency, Isolation, Durability), and the **CAP theorem** that governs trade-offs in distributed databases. Also covers the **NoSQL** family of non-relational systems and when to pick one over an RDBMS.

[Read the article](/SEBook/systems/data_management.html)
