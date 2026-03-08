---
title: Interoperability
layout: sebook
---

Interoperability is defined as the degree to which two or more systems or components can usefully exchange meaningful information via interfaces in a particular context.

# Motivation
In the modern software landscape, systems are rarely "islands"; they must interact with external services to function effectively


# Syntactic vs Semantic Interoperability

To master interoperability, an engineer must distinguish between its two fundamental dimensions: syntactic and semantic. Syntactic interoperability is the ability to successfully exchange data structures. It relies on common data formats, such as XML, JSON, or YAML, and shared transport protocols, such as HTTP(S). 
When two systems can parse each other's data packets and validate them against a schema, they have achieved syntactic interoperability.

However, a major lesson in software architecture is that syntactic interoperability is not enough. 
Semantic interoperability requires that the exchanged data be interpreted in exactly the same way by all participating systems. 
Without a shared interpretation, the system will fail even if the data is transmitted flawlessly. 
For example, if a client system sends a product price as a decimal value formatted perfectly in XML, but assumes the price excludes tax while the receiving server assumes the price includes tax, the resulting discrepancy represents a severe semantic failure. 
An even more catastrophic example occurred with the Mars Climate Orbiter, where a spacecraft was lost because one component sent thrust commands in US customary units (pounds of force) while the receiving interface expected Standard International units (Newtons).

To achieve true semantic interoperability, engineers must rigorously define the semantics of shared data. This is done by documenting the interface with a semantic view that details the purpose of the actions, expected coordinate systems, units of measurement, side-effects, and error-handling conditions. Furthermore, systems should rely on shared dictionaries, standardized terminologies.