---
title: "Python RegEx Simulator & Debugger"
layout: sebook
permalink: /SEBook/tools/regex-simulator.html
regex_simulator: true
---

Try a pattern with Python's `re` engine, inspect each match and captured group, then investigate where a match can start. Add your own positive and negative test cases to check whether the pattern behaves as you expect. Before running, predict which inputs will match.

{% if page.regex_simulator %}
{% include regex-simulator.html %}

<script type="module" src="{{ '/js/regex-simulator.js' | relative_url }}"></script>
{% else %}
[Open the Python RegEx Simulator & Debugger]({{ '/SEBook/tools/regex-simulator.html' | relative_url }}) to experiment with your own patterns and test text.
{% endif %}

## Choose your own test cases

In **Test your own examples**, start with a string you expect to match and one you expect to reject. Add a near miss and the empty string, then explain any surprise before changing the pattern. Change one feature at a time so you can tell what caused the result. A passing suite supports your current examples; it does not prove that the pattern handles every possible input.

Choose the operation that matches your question: **Search for first match** can find a matching substring anywhere; **Match whole string** requires the pattern to cover the entire input. A successful substring search does not establish that the whole input has the intended form.

Use the [RegEx reference guide]({{ '/SEBook/tools/regex.html' | relative_url }}) for syntax, or the [basic RegEx tutorial]({{ '/SEBook/tools/regex-tutorial.html' | relative_url }}) for guided practice.
