---
title: CS 35L Bookmarks
layout: sebook
---


<div id="cs35l-bookmarks" class="course-bookmarks">
  <p class="course-bookmarks-intro">Pages from the SEBook covered in CS 35L Software Construction.</p>

  {% for topic in site.data.CS35L_nav.topics %}
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
