---
title: SE Book
layout: sebook-combined
---

{% capture userstories %}{% include_relative userstories.md %}{% endcapture %}
{{ userstories | markdownify }}

{% capture solid %}{% include_relative solid.md %}{% endcapture %}
{{ solid | markdownify }}

{% capture uml %}{% include_relative uml.md %}{% endcapture %}
{{ uml | markdownify }}

{% capture designpatterns %}{% include_relative designpatterns.md %}{% endcapture %}
{{ designpatterns | markdownify }}
