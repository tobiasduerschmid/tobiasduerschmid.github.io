---
title: SE Book — Table of Contents
layout: sebook
---

# Welcome to the SE Book
The SE Book brings together material for students in software engineering courses, including [CS 35L](/SEBook/CS35L_bookmarks.html) and [CS 130](/SEBook/CS130_bookmarks.html).

<section id="sebook-search" aria-labelledby="sebook-search-heading" class="sebook-search">
  <h2 id="sebook-search-heading">Search the SE Book</h2>
  <div class="sebook-search-controls">
    <label for="sebook-search-input" class="sebook-search-label">
      Find a section or tutorial
    </label>
    <div class="sebook-search-input-wrap">
      <input
        type="search"
        id="sebook-search-input"
        class="sebook-search-input"
        placeholder="Type to filter section and tutorial titles…"
        autocomplete="off"
        spellcheck="false"
        aria-describedby="sebook-search-hint sebook-search-summary"
        aria-controls="sebook-search-results">
      <button
        type="button"
        id="sebook-search-clear"
        class="sebook-search-clear"
        aria-label="Clear search"
        hidden>
        <span aria-hidden="true">×</span>
      </button>
    </div>
    <p id="sebook-search-hint" class="sebook-search-hint">
      Results filter in real time as you type. Matches are case-insensitive.
    </p>
    <p
      id="sebook-search-summary"
      class="sebook-search-summary"
      role="status"
      aria-live="polite"
      aria-atomic="true"></p>
  </div>

  {% assign all_entries = "" | split: "" %}

  <ul
    id="sebook-search-results"
    class="sebook-search-results"
    aria-label="Section and tutorial titles">
    {% for topic in site.data.sebook_nav.topics %}
      <li
        class="sebook-search-result sebook-search-result--topic"
        data-search-title="{{ topic.name | downcase }}">
        <a href="{{ topic.url }}" class="sebook-search-result-link">
          <span class="sebook-search-result-title">{{ topic.name }}</span>
          <span class="sebook-search-result-kind">Section</span>
        </a>
      </li>
      {% if topic.subtopics %}
        {% for subtopic in topic.subtopics %}
          <li
            class="sebook-search-result sebook-search-result--subtopic"
            data-search-title="{{ subtopic.name | downcase }}">
            <a href="{{ subtopic.url }}" class="sebook-search-result-link">
              <span class="sebook-search-result-title">{{ subtopic.name }}</span>
              <span class="sebook-search-result-kind">{{ topic.name }}</span>
            </a>
          </li>
          {% if subtopic.items %}
            {% for item in subtopic.items %}
              <li
                class="sebook-search-result sebook-search-result--item"
                data-search-title="{{ item.name | downcase }}">
                <a href="{{ item.url }}" class="sebook-search-result-link">
                  <span class="sebook-search-result-title">{{ item.name }}</span>
                  <span class="sebook-search-result-kind">{{ topic.name }} › {{ subtopic.name }}</span>
                </a>
              </li>
            {% endfor %}
          {% endif %}
        {% endfor %}
      {% endif %}
    {% endfor %}
  </ul>

  <p
    id="sebook-search-no-results"
    class="sebook-search-no-results"
    hidden>
    No results found.
  </p>
</section>

## Interactive Tutorials
The SE Book includes a broad set of interactive tutorials that run directly in your browser, with no installation required.
Depending on the topic, you can practice Linux shell scripting in a real Linux VM, explore live UML visualizations of your code, step through programs with a time-travel debugger, inspect Git history through an interactive graph, and work through advanced testing concepts.
Browse the [full list of tutorials](/SEBook/tutorials).

## Work in Progress
Many topics are still a work in progress. 
Please consider only the pages linked in your specific course page and already covered in the lecture as "canon". 

## Practice
To reinforce the concepts from this book, practice regularly in the [SE Gym](/se-gym).

<script>
(function () {
  'use strict';

  function init() {
    var input = document.getElementById('sebook-search-input');
    var clearBtn = document.getElementById('sebook-search-clear');
    var resultsList = document.getElementById('sebook-search-results');
    var noResults = document.getElementById('sebook-search-no-results');
    var summary = document.getElementById('sebook-search-summary');
    if (!input || !resultsList || !noResults || !summary) return;

    var items = Array.prototype.slice.call(
      resultsList.querySelectorAll('.sebook-search-result')
    );
    var totalCount = items.length;

    function setSummary(text) {
      if (summary.textContent !== text) summary.textContent = text;
    }

    function filter(rawQuery) {
      var query = (rawQuery || '').trim().toLowerCase();
      var visible = 0;
      for (var i = 0; i < items.length; i++) {
        var title = items[i].getAttribute('data-search-title') || '';
        var match = query === '' || title.indexOf(query) !== -1;
        items[i].hidden = !match;
        if (match) visible++;
      }

      if (query === '') {
        resultsList.hidden = false;
        noResults.hidden = true;
        setSummary('Showing all ' + totalCount + ' titles.');
      } else if (visible === 0) {
        resultsList.hidden = true;
        noResults.hidden = false;
        setSummary('No results found for "' + rawQuery + '".');
      } else {
        resultsList.hidden = false;
        noResults.hidden = true;
        setSummary(
          visible === 1
            ? '1 title matches "' + rawQuery + '".'
            : visible + ' titles match "' + rawQuery + '".'
        );
      }

      if (clearBtn) clearBtn.hidden = query === '';
    }

    input.addEventListener('input', function () {
      filter(this.value);
    });

    input.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && input.value !== '') {
        event.preventDefault();
        input.value = '';
        filter('');
      }
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        input.value = '';
        filter('');
        input.focus();
      });
    }

    filter('');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</script>
