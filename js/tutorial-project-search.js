/**
 * TutorialProjectSearch — search every file of a tutorial step.
 *
 * search(files, query, options) is a pure function: plain or regular
 * expression queries, optional match case and whole word, at most 500
 * results, and an error message (never an exception) for an invalid regular
 * expression. mount(host, options) renders the Search button and panel: a
 * labelled query field, native option checkboxes, a polite status region
 * with the result count, and results grouped by file whose buttons call
 * options.onOpen(path, line, column). Escape closes the panel and returns
 * focus to the control that opened it.
 *
 * Loaded as a classic script (window.TutorialProjectSearch) and by Node tests
 * (module.exports).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TutorialProjectSearch = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var MAX_RESULTS = 500;
  var PREVIEW_LIMIT = 160;
  var PREVIEW_CONTEXT = 40;
  var SEARCH_DELAY_MS = 150;

  function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function compile(query, options) {
    var source = options.regex ? query : escapeRegExp(query);
    // Identifier characters around the match make it part of a longer word.
    if (options.wholeWord) source = '(?<![A-Za-z0-9_])(?:' + source + ')(?![A-Za-z0-9_])';
    return new RegExp(source, options.matchCase ? 'g' : 'gi');
  }

  function regexErrorMessage(error) {
    var detail = String((error && error.message) || 'unknown error')
      .replace(/^Invalid regular expression: \/[\s\S]*\/[a-z]*: /, '');
    return /^invalid regular expression/i.test(detail) ? detail : 'Invalid regular expression: ' + detail;
  }

  /** Line text to display, trimmed of indentation and shortened around long matches. */
  function previewOf(text, start, length) {
    var indentation = text.length - text.replace(/^\s+/, '').length;
    var from = Math.min(indentation, start);
    var to = text.length;
    var prefix = '';
    var suffix = '';
    if (to - from > PREVIEW_LIMIT) {
      var windowStart = Math.max(from, start - PREVIEW_CONTEXT);
      var windowEnd = Math.min(to, Math.max(start + length, windowStart + PREVIEW_LIMIT));
      if (windowStart > from) prefix = '…';
      if (windowEnd < to) suffix = '…';
      from = windowStart;
      to = windowEnd;
    }
    return {
      preview: prefix + text.slice(from, to) + suffix,
      matchStart: prefix.length + start - from,
      matchLength: length,
    };
  }

  /**
   * @param {{path: string, content: string}[]} files
   * @param {string} query
   * @param {{matchCase?: boolean, wholeWord?: boolean, regex?: boolean}} [options]
   * @returns {{results: {path: string, line: number, column: number, preview: string,
   *            matchStart: number, matchLength: number}[], truncated: boolean, error: string|null}}
   *   One result per occurrence, in file then line order. line and column are
   *   1-based; matchStart/matchLength locate the match within preview.
   */
  function search(files, query, options) {
    options = options || {};
    if (typeof query !== 'string' || query === '') return { results: [], truncated: false, error: null };
    var pattern;
    try {
      pattern = compile(query, options);
    } catch (error) {
      return { results: [], truncated: false, error: regexErrorMessage(error) };
    }
    var results = [];
    var truncated = false;
    scan:
    for (var f = 0; f < (files || []).length; f++) {
      var file = files[f];
      var lines = String(file.content == null ? '' : file.content).split('\n');
      for (var i = 0; i < lines.length; i++) {
        var text = lines[i].replace(/\r$/, '');
        pattern.lastIndex = 0;
        var match;
        while ((match = pattern.exec(text))) {
          if (!match[0].length) { pattern.lastIndex++; continue; }
          if (results.length === MAX_RESULTS) { truncated = true; break scan; }
          var shown = previewOf(text, match.index, match[0].length);
          results.push({
            path: file.path,
            line: i + 1,
            column: match.index + 1,
            preview: shown.preview,
            matchStart: shown.matchStart,
            matchLength: shown.matchLength,
          });
        }
      }
    }
    return { results: results, truncated: truncated, error: null };
  }

  function plural(count, singular, pluralForm) {
    return count + ' ' + (count === 1 ? singular : pluralForm);
  }

  function statusText(outcome, fileCount, query) {
    if (outcome.error) return outcome.error;
    if (!outcome.results.length) return 'No results for “' + query + '”.';
    if (outcome.truncated) {
      return 'Showing the first ' + MAX_RESULTS + ' results in ' + plural(fileCount, 'file', 'files') +
        '. Narrow the search to see the rest.';
    }
    return plural(outcome.results.length, 'result', 'results') + ' in ' + plural(fileCount, 'file', 'files') + '.';
  }

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  var instanceCount = 0;

  /**
   * @param {HTMLElement} host
   * @param {{getFiles: function(): {path: string, content: string}[],
   *          onOpen: function(string, number, number): void}} options
   * @returns {{open: function(): void, close: function(): void, destroy: function(): void}}
   */
  function mount(host, options) {
    options = options || {};
    var getFiles = typeof options.getFiles === 'function' ? options.getFiles : function () { return []; };
    var onOpen = typeof options.onOpen === 'function' ? options.onOpen : function () {};
    var id = 'tutorial-project-search-' + (++instanceCount);
    var groupCount = 0;
    var opener = null;
    var timer = null;

    var toggle = element('button', 'tutorial-project-search__toggle', 'Search files');
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', id);
    toggle.setAttribute('aria-keyshortcuts', 'Control+Shift+F Meta+Shift+F');

    var panel = element('section', 'tutorial-project-search');
    panel.id = id;
    panel.hidden = true;
    panel.setAttribute('aria-label', 'Project search');

    var form = element('form', 'tutorial-project-search__form');
    form.setAttribute('role', 'search');
    form.noValidate = true;
    var label = element('label', 'tutorial-project-search__label', 'Search all files');
    label.htmlFor = id + '-query';
    var input = element('input', 'tutorial-project-search__input');
    input.type = 'search';
    input.id = id + '-query';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('enterkeyhint', 'search');

    var choices = element('fieldset', 'tutorial-project-search__options');
    choices.appendChild(element('legend', 'sr-only', 'Search options'));
    function checkbox(name, text) {
      var wrapper = element('label', 'tutorial-project-search__option');
      var box = element('input');
      box.type = 'checkbox';
      box.name = name;
      wrapper.append(box, document.createTextNode(' ' + text));
      choices.appendChild(wrapper);
      return box;
    }
    var matchCase = checkbox('matchCase', 'Match case');
    var wholeWord = checkbox('wholeWord', 'Whole word');
    var regex = checkbox('regex', 'Regular expression');

    var closeButton = element('button', 'tutorial-project-search__close', 'Close search');
    closeButton.type = 'button';
    form.append(label, input, choices, closeButton);

    var status = element('p', 'tutorial-project-search__status');
    status.id = id + '-status';
    status.setAttribute('role', 'status');
    var results = element('ul', 'tutorial-project-search__results');
    results.setAttribute('aria-label', 'Search results');
    results.hidden = true;
    panel.append(form, status, results);
    host.append(toggle, panel);

    function resultButton(result) {
      var button = element('button', 'tutorial-project-search__match');
      button.type = 'button';
      var line = element('span', 'tutorial-project-search__line');
      line.append(element('span', 'sr-only', 'Line '), document.createTextNode(String(result.line)));
      var preview = element('span', 'tutorial-project-search__preview');
      var end = result.matchStart + result.matchLength;
      preview.append(
        document.createTextNode(result.preview.slice(0, result.matchStart)),
        element('mark', 'tutorial-project-search__hit', result.preview.slice(result.matchStart, end)),
        document.createTextNode(result.preview.slice(end))
      );
      button.append(line, preview);
      button.addEventListener('click', function () { onOpen(result.path, result.line, result.column); });
      return button;
    }

    function render(outcome, query) {
      var byFile = new Map();
      outcome.results.forEach(function (result) {
        if (!byFile.has(result.path)) byFile.set(result.path, []);
        byFile.get(result.path).push(result);
      });
      results.replaceChildren();
      byFile.forEach(function (fileResults, path) {
        var groupId = id + '-file-' + (++groupCount);
        var group = element('li', 'tutorial-project-search__file');
        var heading = element('p', 'tutorial-project-search__file-name');
        heading.id = groupId;
        heading.append(
          element('span', 'tutorial-project-search__path', path),
          element('span', 'tutorial-project-search__count', plural(fileResults.length, 'result', 'results'))
        );
        var list = element('ul', 'tutorial-project-search__matches');
        list.setAttribute('aria-labelledby', groupId);
        fileResults.forEach(function (result) {
          var item = element('li');
          item.appendChild(resultButton(result));
          list.appendChild(item);
        });
        group.append(heading, list);
        results.appendChild(group);
      });
      results.hidden = byFile.size === 0;
      status.textContent = statusText(outcome, byFile.size, query);
      input.setAttribute('aria-invalid', outcome.error ? 'true' : 'false');
      if (outcome.error) input.setAttribute('aria-describedby', status.id);
      else input.removeAttribute('aria-describedby');
    }

    function runSearch() {
      clearTimeout(timer);
      var query = input.value;
      if (!query) {
        results.replaceChildren();
        results.hidden = true;
        status.textContent = '';
        input.setAttribute('aria-invalid', 'false');
        input.removeAttribute('aria-describedby');
        return;
      }
      render(search(getFiles(), query, {
        matchCase: matchCase.checked,
        wholeWord: wholeWord.checked,
        regex: regex.checked,
      }), query);
    }

    function open() {
      if (panel.hidden) {
        var active = document.activeElement;
        opener = active && active !== document.body && !panel.contains(active) ? active : toggle;
        panel.hidden = false;
        toggle.setAttribute('aria-expanded', 'true');
        // Current editor contents, drafts included, may have changed.
        if (input.value) runSearch();
      }
      input.focus();
      input.select();
    }

    function close() {
      if (panel.hidden) return;
      clearTimeout(timer);
      panel.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      var target = opener && opener.isConnected ? opener : toggle;
      opener = null;
      target.focus();
    }

    function onToggleClick() { if (panel.hidden) open(); else close(); }
    function onInput() {
      clearTimeout(timer);
      timer = setTimeout(runSearch, SEARCH_DELAY_MS);
    }
    function onSubmit(event) {
      event.preventDefault();
      runSearch();
    }
    function onKeyDown(event) {
      if (event.key !== 'Escape') return;
      // Also keeps the search field's native Escape from clearing the query.
      event.preventDefault();
      event.stopPropagation();
      close();
    }

    toggle.addEventListener('click', onToggleClick);
    closeButton.addEventListener('click', close);
    input.addEventListener('input', onInput);
    form.addEventListener('submit', onSubmit);
    panel.addEventListener('keydown', onKeyDown);
    [matchCase, wholeWord, regex].forEach(function (box) { box.addEventListener('change', runSearch); });

    function destroy() {
      clearTimeout(timer);
      toggle.remove();
      panel.remove();
    }

    return { open: open, close: close, destroy: destroy };
  }

  return { search: search, mount: mount, MAX_RESULTS: MAX_RESULTS };
});
