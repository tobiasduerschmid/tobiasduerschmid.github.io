/*
 * Study Schedule — SEBook course study planner.
 *
 * Wires up the "Schedule Study" button (rendered by _includes/study_schedule.html)
 * to a modal, validates the chosen number of days (4–14), and generates a
 * per-day plan from the list of tutorials and gym quizzes embedded in the page.
 *
 * Exposes a single global object `StudySchedule` with the pure schedule
 * generator and the validation helper, so Playwright tests can exercise the
 * scheduling logic without driving the DOM.
 */
(function () {
  'use strict';

  var MIN_DAYS = 4;
  var MAX_DAYS = 14;

  /**
   * Validate a requested number of days.
   * @param {*} value — any input.
   * @returns {{ ok: true, days: number } | { ok: false, reason: string }}
   */
  function validateDays(value) {
    var n = Number(value);
    if (!Number.isFinite(n) || Math.floor(n) !== n) {
      return { ok: false, reason: 'Please enter a whole number of days.' };
    }
    if (n < MIN_DAYS) {
      return { ok: false, reason: 'Study plans must run for at least ' + MIN_DAYS + ' days.' };
    }
    if (n > MAX_DAYS) {
      return { ok: false, reason: 'Study plans cannot exceed ' + MAX_DAYS + ' days (two weeks).' };
    }
    return { ok: true, days: n };
  }

  /**
   * Split an ordered list of items into `days` buckets while keeping order.
   * Earlier days receive an extra item when the list does not divide evenly.
   *
   * @param {Array} items — list of items to distribute.
   * @param {number} days — bucket count (validated by caller).
   * @returns {Array<Array>} an array of `days` arrays. Trailing buckets may be empty
   *          if `items.length < days`, but the function still returns one bucket
   *          per requested day so the UI can render the schedule.
   */
  function buildSchedule(items, days) {
    var schedule = [];
    for (var d = 0; d < days; d++) schedule.push([]);
    if (!Array.isArray(items) || items.length === 0 || days <= 0) return schedule;

    var base = Math.floor(items.length / days);
    var remainder = items.length % days;
    var cursor = 0;
    for (var i = 0; i < days; i++) {
      var size = base + (i < remainder ? 1 : 0);
      for (var k = 0; k < size; k++) {
        schedule[i].push(items[cursor++]);
      }
    }
    return schedule;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderSchedule(target, schedule) {
    var html = '<h3>Your Study Plan</h3>';
    for (var i = 0; i < schedule.length; i++) {
      var dayItems = schedule[i];
      html += '<div class="study-schedule__day" data-day-index="' + i + '">';
      html += '<h4>Day ' + (i + 1) + '</h4>';
      if (dayItems.length === 0) {
        html += '<p><em>Rest day — review previous material.</em></p>';
      } else {
        html += '<ul>';
        for (var j = 0; j < dayItems.length; j++) {
          var item = dayItems[j];
          var badgeClass = item.type === 'gym'
            ? 'study-schedule__type-badge study-schedule__type-badge--gym'
            : 'study-schedule__type-badge';
          var badgeLabel = item.type === 'gym' ? 'Gym' : 'Tutorial';
          html += '<li data-item-type="' + escapeHtml(item.type) + '">';
          html += '<span class="' + badgeClass + '">' + badgeLabel + '</span>';
          html += '<a href="' + escapeHtml(item.url) + '">' + escapeHtml(item.title) + '</a>';
          html += '</li>';
        }
        html += '</ul>';
      }
      html += '</div>';
    }
    target.innerHTML = html;
    target.hidden = false;
  }

  function readPlanData() {
    var script = document.getElementById('study-schedule-data');
    if (!script) return null;
    try {
      return JSON.parse(script.textContent || script.innerText || '');
    } catch (e) {
      return null;
    }
  }

  function showError(errorEl, message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }
  function clearError(errorEl) {
    errorEl.textContent = '';
    errorEl.hidden = true;
  }

  // --- Modal plumbing ------------------------------------------------------
  var lastFocusedBeforeModal = null;

  function openModal(modal) {
    lastFocusedBeforeModal = document.activeElement;
    modal.hidden = false;
    var input = document.getElementById('study-schedule-days');
    if (input) input.focus();
    document.addEventListener('keydown', onModalKeydown, true);
  }

  function closeModal(modal) {
    modal.hidden = true;
    document.removeEventListener('keydown', onModalKeydown, true);
    if (lastFocusedBeforeModal && typeof lastFocusedBeforeModal.focus === 'function') {
      lastFocusedBeforeModal.focus();
    }
  }

  function onModalKeydown(e) {
    if (e.key === 'Escape' || e.keyCode === 27) {
      var modal = document.getElementById('study-schedule-modal');
      if (modal && !modal.hidden) {
        e.preventDefault();
        closeModal(modal);
      }
    }
  }

  function init() {
    var openBtn = document.getElementById('schedule-study-btn');
    var modal = document.getElementById('study-schedule-modal');
    var form = document.getElementById('study-schedule-form');
    var input = document.getElementById('study-schedule-days');
    var errorEl = document.getElementById('study-schedule-error');
    var output = document.getElementById('study-plan-output');

    // The include only renders when plan data is present. If any of these
    // pieces are missing, the page isn't a study-schedule page — bail out.
    if (!openBtn || !modal || !form || !input || !errorEl || !output) return;

    openBtn.addEventListener('click', function () {
      clearError(errorEl);
      openModal(modal);
    });

    // Close handlers — buttons / backdrop carry `data-close-modal`.
    modal.addEventListener('click', function (e) {
      var target = e.target;
      while (target && target !== modal) {
        if (target.hasAttribute && target.hasAttribute('data-close-modal')) {
          closeModal(modal);
          return;
        }
        target = target.parentNode;
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var result = validateDays(input.value);
      if (!result.ok) {
        showError(errorEl, result.reason);
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        return;
      }
      input.removeAttribute('aria-invalid');
      clearError(errorEl);

      var data = readPlanData();
      if (!data || !Array.isArray(data.items)) {
        showError(errorEl, 'Could not load study plan data.');
        return;
      }

      var schedule = buildSchedule(data.items, result.days);
      renderSchedule(output, schedule);
      closeModal(modal);

      // Move focus into the freshly rendered plan so assistive tech reads it.
      var planHeading = output.querySelector('h3');
      if (planHeading) {
        planHeading.setAttribute('tabindex', '-1');
        planHeading.focus();
      }
    });
  }

  // Public surface for tests / other modules.
  window.StudySchedule = {
    MIN_DAYS: MIN_DAYS,
    MAX_DAYS: MAX_DAYS,
    validateDays: validateDays,
    buildSchedule: buildSchedule
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
