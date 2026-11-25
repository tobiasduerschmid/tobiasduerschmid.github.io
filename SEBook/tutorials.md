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

    Rows sort by title, except that a follow-up tutorial whose page sets
    `index_after: <parent key>` sorts right after that parent: its sort key
    is the parent's title, the separator, then "~" (which sorts after every
    other printable ASCII character) and its own title. Because that key
    contains the separator, each row is read from its end (`reverse`):
    key, url, description, title.
  {% endcomment %}
  {% assign tutorial_pages = site.html_pages | where: "layout", "tutorial" %}
  {% assign rows = "" | split: "" %}
  {% for entry in site.data.tutorials %}
    {% assign key = entry[0] %}
    {% assign data = entry[1] %}
    {% unless data.exclude_from_index %}
      {% assign page_match = tutorial_pages | where: "tutorial", key | first %}
      {% if page_match %}
        {% assign sort_key = data.title %}
        {% if page_match.index_after %}
          {% assign followed = site.data.tutorials[page_match.index_after] %}
          {% if followed %}
            {% capture sort_key %}{{ followed.title }}|||~{{ data.title }}{% endcapture %}
          {% endif %}
        {% endif %}
        {% capture row %}{{ sort_key }}|||{{ data.title }}|||{{ data.description }}|||{{ page_match.url }}|||{{ key }}{% endcapture %}
        {% assign rows = rows | push: row %}
      {% endif %}
    {% endunless %}
  {% endfor %}
  {% assign rows = rows | sort %}

  <ul class="tutorials-index-list">
    {% for row in rows %}
      {% assign parts = row | split: "|||" | reverse %}
      <li class="tutorial-card">
        <h2 class="tutorial-card-title">
          <a href="{{ parts[1] | relative_url }}">{{ parts[3] }}</a>
        </h2>
        {% if parts[2] and parts[2] != "" %}
          <p class="tutorial-card-desc">{{ parts[2] }}</p>
        {% endif %}
      </li>
    {% endfor %}
  </ul>

  {% if rows.size == 0 %}
    <p>No tutorials are currently published.</p>
  {% endif %}
</div>
