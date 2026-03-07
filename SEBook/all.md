---
title: SE Book
layout: sebook-combined
---

{% capture userstories %}{% include_relative userstories.md %}{% endcapture %}
{{ userstories | markdownify }}


{% capture designprinciples %}{% include_relative designprinciples.md %}{% endcapture %}
{{ designprinciples | markdownify }}

{% capture solid %}{% include_relative designprinciples/solid.md %}{% endcapture %}
{{ solid | markdownify }}

{% capture informationhiding %}{% include_relative designprinciples/informationhiding.md %}{% endcapture %}
{{ informationhiding | markdownify }}

{% capture uml %}{% include_relative uml.md %}{% endcapture %}
{{ uml | markdownify }}

{% capture designpatterns %}{% include_relative designpatterns.md %}{% endcapture %}
{{ designpatterns | markdownify }}

{% capture state %}{% include_relative designpatterns/state.md %}{% endcapture %}
{{ state | markdownify }}

{% capture observer %}{% include_relative designpatterns/observer.md %}{% endcapture %}
{{ observer | markdownify }}
