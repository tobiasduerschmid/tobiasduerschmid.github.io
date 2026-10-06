# Bounded OpenAlex supplement: Haskell debugger pedagogy

Research date: 2026-10-06. This is a focused implementation search, not a systematic review. The user explicitly requested a bounded search, overriding the literature-search skill's full-survey phase gates.

## Search provenance

Three direct OpenAlex `/works` queries, 12 relevance-ranked records per query, no pagination and no citation expansion. Raw responses and exact query URLs are cached as gzip-compressed JSON beside this note:

- `haskell-beginners.json.gz`: `Haskell beginners mistakes`; total API matches 335, first 12 inspected.
- `haskell-teaching-debugger.json.gz`: `Haskell teaching debugger`; total 623, first 12 inspected.
- `functional-programming-misconceptions.json.gz`: `functional programming misconceptions`; total 83,870, first 12 inspected.

The broad third query returned many irrelevant uses of “functional” and “misconceptions”; its count is not a count of relevant studies. Relevant results included Tirronen et al. (2015), Singer and Archibald (2018), Olmer et al. (2014), Németh et al. (2019), Chitil's Heat (2008), and Segal (1995). Németh et al. adds a directly relevant error-analysis study to the sources already located through other services. Heat's PDF timed out and Segal's full text was not inspected; neither supports findings below.

## Selected primary-source checks

### Pedro Vasconcelos (2025), Teaching Introductory Functional Programming Using Haskelite

Access: primary author manuscript, HTML; inspected §§2.2–5 and relevant §7 paragraphs. [Manuscript](https://arxiv.org/html/2508.03640v1).

The tool pairs expression steps with equation/primitive justifications. Its classroom report discusses ordered guards, recursive cases, folds, and lazy lists. §5 recommends small examples and clear messages for unsupported syntax; it also cautions against using operational traces as the only way to understand programs. §7 identifies semantic difficulties in skipping functions under lazy evaluation. §4 includes 14 voluntary forum respondents and six anonymous questionnaire responses, with an uncontrolled year-to-year pass-rate comparison. These are design experience and perceived usefulness, not causal evidence of learning gains.

Design inference: keep a concise current-expression cue alongside a reason and enough enclosing context; retain user-controlled stepping. Do not obtain a cleaner display by forcing deferred values or pretending nested lazy computations execute in conventional stack order.

### Tirronen, Uusi-Mäkelä, and Isomöttönen (2015), Understanding beginners' mistakes with Haskell

Access: publisher PDF; inspected §§3, 6.1.1, 6.3, 7.1–7.2. [DOI](https://doi.org/10.1017/S0956796815000179).

This single-course observational analysis identifies confusion about function-application grouping and precedence, omitted cases, and general patterns shadowing later base cases. §7.1 explicitly reports that some claimed recursion misconceptions were not observed and that laziness did not cause major early-course difficulties; explicitly lazy functions were harder later. A tracer should therefore address inspectable program behavior without claiming that all beginners possess the same misconception.

Design inference: highlight the precise parsed subexpression and the selected guard/pattern; preserve the source equation so a learner can explain why this case applies. Treat precedence and compilation failures separately: a runtime tracer cannot evaluate an ill-typed program into correctness.

### Singer and Archibald (2018), Functional Baby Talk

Access: primary manuscript PDF; inspected §3 error analysis and §4 limitations. [Paper](https://arxiv.org/pdf/1805.05126), DOI 10.4204/EPTCS.270.3.

The analysis covers 161K learner interactions from one MOOC. It identifies parenthesis, local-binding, do-block, and range-syntax problems, but some failures reflect limitations of the restricted REPL. Its analysis misses semantic errors in expressions that parse and type-check.

Design inference: distinguish an unsupported tracer construct from invalid Haskell. Keep local bindings near their source context; do not infer that source highlighting alone remedies syntax, type, or IO misconceptions.

### Németh, Choi, Makihara, and Iida (2019), Investigating Compilation Errors of Students Learning Haskell

Access: primary manuscript PDF; inspected §§3, 4.1.2, and 5. [Paper](https://arxiv.org/pdf/1906.11450), DOI 10.4204/EPTCS.295.4. OpenAlex W2954564487.

The single-course study includes more than 120 first-year undergraduates and separately analyzes the earlier Functional Baby Talk dataset. §4.1.2 identifies confusion between lists and elements or nested lists, missing function arguments, and misgrouped applications. Some apparent type errors originate in valid but unintended syntax. Classification relies on the first author's judgment; this is descriptive error evidence, not a tracer intervention.

Design inference: preserve the syntactic extent of the application being processed, make available arguments/bindings inspectable, and distinguish a function value from an evaluated scalar. A useful learning check is whether students can explain the highlighted application and predict the next demanded expression without running it.

## Implementation priority

The strongest immediate design fit is an exact source span plus a short semantic explanation. Deferred work must remain visibly distinct from an obtained value. A completed trace may retain its last event for inspection, but its focus must be labeled as a recorded result, not “currently evaluating.” These are original design choices informed by the sources; the sources do not directly test this particular UI.

## Concise tutorial replacement candidates

These are original wording suggestions for replacing existing generic explanations or run-and-observe prompts, not extra tutorial sections. No tutorial YAML was inspected for this supplement; select the matching existing location and verify that its final word count does not grow.

| Concept area | Candidate replacement | Evidence informing the choice |
| --- | --- | --- |
| Foundations: application grouping | “Identify the function and its arguments. Predict which subexpression the debugger will process first, then explain the highlight.” | Tirronen §6.1.1; Németh §4.1.2: grouping difficulties. |
| Foundations: local bindings | “Explain what each local name denotes. Follow the highlighted expression and check which bindings it uses.” | Singer and Archibald §3: local-binding difficulties; this is a proposed explanation activity. |
| Functions: ordered equations and guards | “Which equation or guard succeeds first? Use the trace to explain why later alternatives are skipped.” | Tirronen §6.3; Haskelite §3: case order and guards. |
| Functions: recursion and folds | “Predict the empty-case value. Trace one nonempty input and explain how that value contributes to the result.” | Haskelite §3: recursive base values and folds. |
| Data: list patterns | “After matching `(x:xs)`, identify the element and the remaining list. Predict the shape of the next result.” | Németh §4.1.2: list/element and list-dimension confusion. |
| Data: lazy consumption | “Predict how much of the list the result needs. Step through that demand; identify what remains unevaluated.” | Haskelite §3: lazy list evaluation. This is a capability target, not a prevalence claim about misconceptions. |

For an observable learning check, ask for the prediction and reason before revealing the next trace event. One short explanation plus an editable example can replace a longer exposition; no extra quiz or mandatory dialog is needed.
