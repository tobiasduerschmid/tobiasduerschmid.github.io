---
title: CS 130 Bookmarks
layout: sebook
---

<style>
  #cs130-bookmarks {
    max-width: 700px;
    margin: 0 auto;
    padding: 0 0 40px 0;
  }

  .cs130-topic-group {
    margin-bottom: 8px;
    border: 1px solid #e1e4e8;
    border-radius: 8px;
    overflow: hidden;
  }

  .cs130-topic-link {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: #f8f9fa;
    color: #2774AE;
    font-weight: 600;
    font-size: 1em;
    text-decoration: none;
    transition: background 0.15s;
  }

  .cs130-topic-link:hover {
    background: #eef3f8;
    text-decoration: none;
    color: #1a5a9f;
  }

  .cs130-topic-link i {
    font-size: 0.9em;
    color: #2774AE;
    flex-shrink: 0;
  }

  .cs130-subtopic-list {
    list-style: none;
    margin: 0;
    padding: 0;
    border-top: 1px solid #e1e4e8;
  }

  .cs130-subtopic-list li {
    border-bottom: 1px solid #f0f0f0;
  }

  .cs130-subtopic-list li:last-child {
    border-bottom: none;
  }

  .cs130-subtopic-list a {
    display: block;
    padding: 9px 16px 9px 40px;
    color: #2774AE;
    text-decoration: none;
    font-size: 0.95em;
    transition: background 0.15s;
  }

  .cs130-subtopic-list a:hover {
    background: #f0f4f8;
    text-decoration: none;
  }

  html.dark-mode .cs130-topic-link {
    background: #1e2a35;
    color: #FFD100;
  }

  html.dark-mode .cs130-topic-link i {
    color: #FFD100;
  }

  html.dark-mode .cs130-topic-link:hover {
    background: #25343f;
    color: #FFD100;
  }

  html.dark-mode .cs130-topic-group {
    border-color: #3a4a5a;
  }

  html.dark-mode .cs130-subtopic-list {
    border-top-color: #3a4a5a;
  }

  html.dark-mode .cs130-subtopic-list li {
    border-bottom-color: #2a3a4a;
  }

  html.dark-mode .cs130-subtopic-list a {
    color: #FFD100;
  }

  html.dark-mode .cs130-subtopic-list a:hover {
    background: #25343f;
    color: #FFD100;
  }
</style>

<div id="cs130-bookmarks">
  <p style="color:#666; margin-bottom:20px;">Pages from the SEBook covered in CS 130 Software Engineering.</p>

  {% for topic in site.data.CS130_nav.topics %}
  <div class="cs130-topic-group">
    <a href="{{ topic.url }}" class="cs130-topic-link">
      <i class="fa-solid fa-book-open"></i>
      {{ topic.name }}
    </a>
    {% if topic.subtopics %}
    <ul class="cs130-subtopic-list">
      {% for subtopic in topic.subtopics %}
      <li><a href="{{ subtopic.url }}">{{ subtopic.name }}</a></li>
      {% endfor %}
    </ul>
    {% endif %}
  </div>
  {% endfor %}
</div>
