/** Shared asynchronous preview/check lifecycle for the legacy regex tutorials. */
(function () {
  'use strict';

  if (window.RegexTutorialPython) return;

  function checkMatches(matches, test) {
    if ((matches.length > 0) !== test.shouldMatch) return false;
    if (test.expectedMatches && (matches.length !== test.expectedMatches.length ||
      matches.some((match, index) => match.text !== test.expectedMatches[index]))) return false;
    if (test.matchCount !== undefined && matches.length !== test.matchCount) return false;
    if (test.firstMatch !== undefined && (!matches.length || matches[0].text !== test.firstMatch)) return false;
    if (test.namedGroups) {
      const groups = new Map(matches.length ? matches[0].groups.map(group => [group.name, group.text]) : []);
      if (Object.keys(test.namedGroups).some(name => groups.get(name) !== test.namedGroups[name])) return false;
    }
    return true;
  }

  function create({ exercises, highlightText, onChecked }) {
    const client = window.PythonRegexClient.create();
    const definitions = new Map(exercises.map(exercise => [exercise.id, exercise]));
    const pending = new Map();

    function view(exId) {
      const root = document.getElementById('ex-' + exId);
      return { input: root.querySelector('.rt-input'), sample: root.querySelector('.rt-sample'),
        tests: root.querySelector('.rt-tests'), result: root.querySelector('.rt-result'),
        error: root.querySelector('.rt-error'), check: root.querySelector('.rt-btn-check'),
        stop: root.querySelector('.rt-btn-stop') };
    }

    function setBusy(elements, checking, busy) {
      const focused = document.activeElement;
      if (busy && checking && focused === elements.check) {
        elements.stop.hidden = false;
        elements.stop.focus();
      }
      elements.check.disabled = busy && checking;
      if (!busy && focused === elements.stop) elements.check.focus();
      elements.stop.hidden = !busy;
      elements.tests.setAttribute('aria-busy', String(busy));
      if (elements.sample) elements.sample.setAttribute('aria-busy', String(busy));
    }

    function clearPreview(exercise, elements) {
      elements.error.textContent = '';
      elements.result.textContent = '';
      elements.result.className = 'rt-result';
      elements.input.setAttribute('aria-invalid', 'false');
      if (elements.sample) elements.sample.textContent = exercise.sampleText;
      for (const row of elements.tests.querySelectorAll('.rt-test')) {
        row.className = 'rt-test';
        row.querySelector('.rt-test-icon').textContent = '●';
      }
    }

    function cancel(exId) {
      const run = pending.get(exId);
      if (!run) return;
      pending.delete(exId);
      clearTimeout(run.timer);
      run.controller.abort();
      setBusy(view(exId), run.checking, false);
    }

    function start(exId, checking) {
      if (!definitions.has(exId)) return;
      cancel(exId);
      const exercise = definitions.get(exId);
      const elements = view(exId);
      clearPreview(exercise, elements);
      const pattern = elements.input.value;
      if (!pattern) {
        if (checking) {
          elements.result.textContent = 'Please enter a Python regex pattern.';
          elements.result.className = 'rt-result rt-result-fail';
          elements.input.setAttribute('aria-invalid', 'true');
        }
        return;
      }
      const run = { exercise, pattern, checking, controller: new AbortController(), timer: null };
      pending.set(exId, run);
      setBusy(elements, checking, true);
      elements.result.textContent = checking ? 'Checking with Python re…' : 'Updating matches with Python re…';
      if (checking) void evaluate(run);
      else run.timer = setTimeout(function () { void evaluate(run); }, 200);
    }

    function renderMatches(run, elements, results) {
      const sampleCount = run.exercise.sampleText === null ? 0 : 1;
      if (elements.sample) elements.sample.innerHTML = highlightText(run.exercise.sampleText, results[0]);
      const tests = run.exercise.tests.concat(run.checking ? run.exercise.hiddenTests || [] : []);
      const outcomes = tests.map(function (test, index) {
        const matches = results[index + sampleCount];
        return { matched: matches.length > 0, passed: checkMatches(matches, test),
          groupNames: matches.length ? matches[0].groups.map(group => group.name).filter(Boolean) : [] };
      });
      elements.tests.querySelectorAll('.rt-test').forEach(function (row, index) {
        const passed = outcomes[index].passed;
        row.className = 'rt-test ' + (passed ? 'rt-test-pass' : 'rt-test-fail');
        row.querySelector('.rt-test-icon').textContent = passed ? '✓' : '✗';
      });
      return outcomes;
    }

    async function evaluate(run) {
      const exId = run.exercise.id;
      const tests = run.exercise.tests.concat(run.checking ? run.exercise.hiddenTests || [] : []);
      const texts = run.exercise.sampleText === null ? [] : [run.exercise.sampleText];
      try {
        const results = await client.findAll(run.pattern, texts.concat(tests.map(test => test.input)),
          { signal: run.controller.signal });
        if (pending.get(exId) !== run) return;
        const elements = view(exId);
        const outcomes = renderMatches(run, elements, results);
        elements.result.textContent = '';
        if (run.checking) onChecked(run.exercise, outcomes);
      } catch (error) {
        if (pending.get(exId) !== run || error.name === 'AbortError') return;
        const elements = view(exId);
        elements.result.textContent = '';
        elements.error.textContent = 'Python re: ' + error.message;
        elements.input.setAttribute('aria-invalid', String(error.name === 'PythonRegexError'));
      } finally {
        if (pending.get(exId) === run) {
          pending.delete(exId);
          setBusy(view(exId), run.checking, false);
        }
      }
    }

    function stop(exId) {
      if (!definitions.has(exId)) return;
      const elements = view(exId);
      cancel(exId);
      elements.result.textContent = 'Stopped. Edit the pattern or choose Check Answer to try again.';
    }

    window.addEventListener('pagehide', function () {
      for (const exId of pending.keys()) {
        cancel(exId);
        view(exId).result.textContent = 'Stopped. Edit the pattern or choose Check Answer to try again.';
      }
      client.destroy();
    });

    return { preview: exId => start(exId, false), check: exId => start(exId, true), stop };
  }

  window.RegexTutorialPython = { create };
})();
