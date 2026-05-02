---
title: Tutorials
layout: sebook
permalink: /SEBook/tutorials
---

# Tutorials

Hands-on, in-browser tutorials covering languages, tools, design patterns,
testing, and other software-engineering topics. Each tutorial runs in your
browser — no install required — and saves your progress locally.

<div class="tutorials-index" role="list">
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
      <li class="tutorial-card" role="listitem">
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

<style>
  .tutorials-index-list {
    list-style: none;
    padding: 0;
    margin: 24px 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 16px;
  }

  .tutorial-card {
    border: 1px solid #d0d7de;
    border-radius: 8px;
    padding: 16px 18px;
    background: #ffffff;
    transition: box-shadow 0.15s ease, border-color 0.15s ease;
  }

  .tutorial-card:hover,
  .tutorial-card:focus-within {
    border-color: #2774AE;
    box-shadow: 0 2px 8px rgba(39, 116, 174, 0.15);
  }

  .tutorial-card-title {
    margin: 0 0 8px;
    font-size: 1.15rem;
    line-height: 1.3;
    color: #2774AE;
    -webkit-text-stroke: 0;
  }

  .tutorial-card-title a {
    color: inherit;
    text-decoration: none;
  }

  .tutorial-card-title a:hover,
  .tutorial-card-title a:focus {
    text-decoration: underline;
  }

  .tutorial-card-desc {
    margin: 0;
    color: #24292f;
    font-size: 0.95rem;
    line-height: 1.5;
  }

  html.dark-mode .tutorial-card {
    background: #1f2937;
    border-color: #4b5563;
  }

  html.dark-mode .tutorial-card:hover,
  html.dark-mode .tutorial-card:focus-within {
    border-color: #8bb8e8;
    box-shadow: 0 2px 8px rgba(139, 184, 232, 0.2);
  }

  html.dark-mode .tutorial-card-title {
    color: #8bb8e8;
  }

  html.dark-mode .tutorial-card-desc {
    color: #f9fafb;
  }
</style>
