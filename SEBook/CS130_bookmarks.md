---
title: CS 130 Bookmarks
layout: sebook
---


<div id="cs130-bookmarks" class="course-bookmarks">
  <p class="course-bookmarks-intro">Pages from the SEBook covered in CS 130 Software Engineering.</p>

  {% for topic in site.data.CS130_nav.topics %}
  <div class="course-bookmarks-topic-group">
    <a href="{{ topic.url }}" class="course-bookmarks-topic-link">
      <i class="fa-solid fa-book-open"></i>
      {{ topic.name }}
    </a>
    {% if topic.subtopics %}
    <ul class="course-bookmarks-subtopic-list">
      {% for subtopic in topic.subtopics %}
      <li><a href="{{ subtopic.url }}">{{ subtopic.name }}</a></li>
      {% endfor %}
    </ul>
    {% endif %}
  </div>
  {% endfor %}
</div>
