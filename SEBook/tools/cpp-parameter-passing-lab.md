---
title: "C++ Parameter Passing Lab"
layout: sebook
program_output_labs: true
---

Use this lab to **predict which caller values a function can change**, explain
what gets copied, and distinguish a runtime parameter from macro substitution.
You should already be able to read C++ variables, functions, `std::string`,
`&`, and `*`. The examples run in your browser; no compiler installation is needed.

# Read the Boxes

The diagrams use the same binding model as *Data Palooza* and *Function Palooza*.
They describe logical storage and sharing, rather than physical stack or heap
placement. The diagram format is shared with the [Python labs](/SEBook/tools/python.html#objects){: .sebook-reading-link}.

| Binding | What the diagram shows | What assignment does |
| --- | --- | --- |
| Value | A name inside its own storage box | Replaces that storage's value |
| Reference | An alias name inside the same storage box as another name | Assigns to the shared object |
| Object reference / pointer | A separate small pointer box beside each name, with an arrow | Redirects that pointer; writing through it changes its target |

For each example:

1. **Predict** the output and the storage or pointer slot that changes.
2. Use **Forward** to inspect the marked operation and **Back** to compare states.
3. Open **Explain the prepared example** after checking your prediction.
4. Predict the suggested variation, edit the code, and inspect the new trace.

**Reference details** describes the same identities and relationships in text.
The **What the trace shows** disclosure explains supported tracing constructs.
Edits retrace automatically; **Restore original code** returns to the prepared example.
Printing includes the source, recorded states, and explanations.

# Copies and Aliases

## Pass by value

Start with a string so you can compare both mutation (`+=`) and assignment (`=`).
Focus on the caller and parameter while the function is active, not only on the
final output.

{% include object-reference-lab.html example="cpp_value_parameter" editor="inline" %}

## Pass by reference

Only the parameter declaration changes in this comparison. A reference is an
alias for an object; assigning through it does not change which object it names.
The diagram therefore gives it an alias label on the shared storage box.
[C++ reference rules](https://eel.is/c++draft/dcl.ref){: .sebook-reading-link}

{% include object-reference-lab.html example="cpp_reference_parameter" editor="inline" %}

# Pointer Parameters

The slides call the separate-pointer model **object reference semantics**.
C++ expresses it here by passing a pointer **by value**. Keep two questions apart:
can the function change its local pointer, and can it change the pointed-to object?

{% include object-reference-lab.html example="cpp_pointer_parameter" editor="inline" %}

The caller's `selected` and the parameter `label` each get a pointer box.
They can point to the same object without being the same variable.

# Copy-In and Copy-Out

Value-result passing conceptually copies an argument into local storage and
copies the final local value back at return. This lab makes the two copies
explicit, leaving a visible pause before copy-out so you can inspect the caller.
**This is a simulation using ordinary C++, not an additional native C++ parameter mode.**

{% include object-reference-lab.html example="cpp_copy_in_out" editor="inline" %}

For a further check, imagine two local results that both copy back to `quota`.
Write the two assignments in both orders. Explain why an implementation of
value-result passing needs a rule for overlapping destinations.

# Macro Expansion

A function-like macro substitutes tokens before compilation. It does not bind
runtime parameter variables. Expanded statements appear at the invocation's
source line in the trace; several steps can therefore highlight the same line.
[C++ macro argument substitution](https://eel.is/c++draft/cpp.subst){: .sebook-reading-link}

## Grouping expressions

{% include object-reference-lab.html example="cpp_macro_precedence" editor="inline" %}

## Evaluating an argument twice

This example repeats its argument in **separate statements**, whose effects are
sequenced. Avoid predicting a number for `SQUARE(++count)`: its expansion modifies
`count` twice without sequencing, which is undefined behavior in C++. Parentheses
do not fix that problem. [C++ execution and sequencing rules](https://eel.is/c++draft/intro.execution){: .sebook-reading-link}

{% include object-reference-lab.html example="cpp_macro_repeated_evaluation" editor="inline" %}

## Capturing a name

{% include object-reference-lab.html example="cpp_macro_capture" editor="inline" %}

# Transfer to Python

Python argument binding uses the separate-reference model. The callee gets its
own name referring to the argument object. Mutating a shared list and rebinding
the local name have different effects, just as changing a pointed-to object and
redirecting a local C++ pointer do. Python has no C++-style `&` parameter declaration.

{% include object-reference-lab.html example="parameter_rebinding" editor="inline" %}

## Explain and repair

Before checking the earlier explanations, answer these from the diagrams:

1. Two names have equal string values. What in the diagram tells you whether
   their values occupy distinct storage or share one identity?
2. A function should append to the caller's string. Which of `std::string`,
   `std::string&`, and `std::string*` permit that, and what operation does each require?
3. A function should read a string without making a value copy and without
   modifying it through that parameter. Write and test an appropriate signature.
4. Replace the `SWAP` macro with a function that swaps two caller integers.
   Test distinct arguments, then pass the same integer twice. Explain the aliasing.
5. In the Python example, make a local list copy before mutation. Predict which
   caller-visible effect disappears, then check your prediction.

For each repair, justify your choice with **storage identity, copying, and the
operation performed**, rather than only citing the printed output.
