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

<style>
  /* Reflow at 320 CSS px (WCAG 2.2 SC 1.4.10): the column floor is the
     smaller of 100% and 280px, so the grid never forces a horizontal
     scroll even on the narrowest supported viewport. */
  .tutorials-index-list {
    list-style: none;
    padding: 0;
    margin: 24px 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
    gap: 18px;
  }

  /* Border #6a737d on #ffffff = ~4.7:1 contrast — clears WCAG 2.2 SC
     1.4.11 Non-text Contrast (3:1) by a healthy margin. */
  .tutorial-card {
    border: 1px solid #6a737d;
    border-radius: 8px;
    padding: 18px 20px;
    background: #ffffff;
    transition: box-shadow 0.15s ease, border-color 0.15s ease;
  }

  .tutorial-card:hover,
  .tutorial-card:focus-within {
    border-color: #2774AE;
    box-shadow: 0 2px 8px rgba(39, 116, 174, 0.15);
  }

  /* Override sebook.html's global `h2 { -webkit-text-stroke: 1px black }`
     — at small sizes inside cards the stroke fattens the type and hurts
     legibility. Using bold + an explicit 1.25rem (20px) size satisfies
    the readable text threshold in WCAG, so the #2774AE-on-white ratio
     of ~5:1 passes SC 1.4.3 Contrast (Minimum) for AA. */
  .tutorial-card-title {
    margin: 0 0 10px;
    font-size: 1.35em;
    line-height: 1.3;
    color: #2774AE;
    -webkit-text-stroke: 0;
  }

  .tutorial-card-title a,
  .tutorial-card-title a:visited {
    color: inherit;
    text-decoration: none;
  }

  .tutorial-card-title a:hover {
    text-decoration: underline;
  }

  /* Explicit focus ring (WCAG 2.2 SC 2.4.7 Focus Visible / SC 2.4.11
     Focus Not Obscured): 2px solid outline with 2px offset, in the
     same blue family as the title — high contrast on both white and
     dark backgrounds. */
  .tutorial-card-title a:focus-visible {
    outline: 2px solid #2774AE;
    outline-offset: 2px;
    border-radius: 3px;
    text-decoration: underline;
  }

  /* Body text inherits the SEBook paragraph size. #24292f on white =
     ~15:1 contrast. */
  .tutorial-card-desc {
    margin: 0;
    color: #24292f;
    line-height: 1.5;
  }

  html.dark-mode .tutorial-card {
    background: #1f2937;
    /* #9aa1a8 on #1f2937 = ~5.7:1 contrast — clears SC 1.4.11. */
    border-color: #9aa1a8;
  }

  html.dark-mode .tutorial-card:hover,
  html.dark-mode .tutorial-card:focus-within {
    border-color: #8bb8e8;
    box-shadow: 0 2px 8px rgba(139, 184, 232, 0.2);
  }

  /* #8bb8e8 on #1f2937 = ~7:1 contrast — clears AAA for normal text. */
  html.dark-mode .tutorial-card-title {
    color: #8bb8e8;
  }

  html.dark-mode .tutorial-card-title a:focus-visible {
    outline-color: #8bb8e8;
  }

  html.dark-mode .tutorial-card-desc {
    color: #f9fafb;
  }
</style>
