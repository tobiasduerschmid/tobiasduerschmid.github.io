---
title: Tutorials
layout: sebook
permalink: /SEBook/tutorials
---

# Tutorials

Hands-on, in-browser tutorials covering languages, tools, design patterns,
testing, and other software-engineering topics. Each tutorial runs in your
browser — no install required — and saves your progress locally.

<div class="tutorials-index">
  {% comment %}
    Build a sorted list of (title, description, url) triples by joining each
    `_data/tutorials/<key>.yml` entry to the `.md` page that references it
    via `tutorial: <key>` front matter and uses `layout: tutorial`. Pages with
    `layout: print-tutorial` also reference the same key — we exclude them so
    each tutorial appears once.
  {% endcomment %}
  {% assign tutorial_pages = site.html_pages | where: "layout", "tutorial" %}
  {% assign rows = "" | split: "" %}
  {% for entry in site.data.tutorials %}
    {% assign key = entry[0] %}
    {% assign data = entry[1] %}
    {% unless data.exclude_from_index %}
      {% assign page_match = tutorial_pages | where: "tutorial", key | first %}
      {% if page_match %}
        {% capture row %}{{ data.title }}|||{{ data.description }}|||{{ page_match.url }}|||{{ key }}{% endcapture %}
        {% assign rows = rows | push: row %}
      {% endif %}
    {% endunless %}
  {% endfor %}
  {% assign rows = rows | sort %}

  <ul class="tutorials-index-list">
    {% for row in rows %}
      {% assign parts = row | split: "|||" %}
      <li class="tutorial-card">
        <h2 class="tutorial-card-title">
          <a href="{{ parts[2] | relative_url }}">{{ parts[0] }}</a>
        </h2>
        {% if parts[1] and parts[1] != "" %}
          <p class="tutorial-card-desc">{{ parts[1] }}</p>
        {% endif %}
      </li>
    {% endfor %}
  </ul>

  {% if rows.size == 0 %}
    <p>No tutorials are currently published.</p>
  {% endif %}
</div>
