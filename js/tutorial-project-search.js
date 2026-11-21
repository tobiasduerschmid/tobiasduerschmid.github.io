/**
 * TutorialProjectSearch — search every file of a tutorial step, and the
 * diagrams the learner has unlocked in the Diagram pane.
 *
 * search(entries, query, options) is a pure function: plain or regular
 * expression queries, optional match case and whole word, at most 500
 * results, and an error message (never an exception) for an invalid regular
 * expression. An entry is a file {path, content} or a diagram {path, content:
 * ArchUML source, kind: 'diagram', diagramId, label}; a diagram is searched
 * only in the text its drawing shows (diagramText). textMatches applies the
 * same rules to one string, such as an SVG label.
 *
 * mount(host, options) renders the Search button and panel: a labelled query
 * field, native option checkboxes, a polite status region with the result
 * count, and results grouped by file, then by diagram. A file result calls
 * options.onOpen(path, line, column); a diagram result calls
 * options.onOpenDiagram(diagramId, query, searchOptions). options.onReset()
 * runs whenever the query or its options change or the panel closes, so
 * whatever an earlier result showed can be cleared. Escape closes the panel
 * and returns focus to the control that opened it.
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

  // ArchUML keywords that introduce an element; the rest of the line is its
  // name (and stereotype), which the drawing shows.
  var DECLARATION = /^(?:abstract\s+class|class|interface|enum|component|participant|actor|package|box|node|database|queue|portin|portout|port|provide|require|usecase|state|boundary|control|entity|collections|artifact|cloud|frame|folder|rectangle)\s+(.*)$/;
  var FRAGMENT = /^(?:loop|alt|else|opt|par|break|critical|group)\s+(.*)$/;
  var STRUCTURE = /^(?:[{}]|end(?:\s+box)?|activate\s.*|deactivate\s.*|destroy\s.*|create\s.*|autonumber.*)$/;
  var NOTE_START = /^note\s+(?:(?:top|bottom|left|right)\s+of|over)\s+[^:]*?(?::\s*(.*))?$/;
  // A connector: its ends, optional quoted multiplicities, an arrow, and an
  // optional `: label`.
  var RELATION = /^\S+?(?:\s+"([^"]*)")?\s*[-.<>|*o#x\\/]*[-.][-.<>|*o#x\\/]*\s*(?:"([^"]*)"\s+)?\S+?\s*(?::\s*(.*))?$/;
  var MEMBER = /^([+\-#~])\s*(?:\{\w+\}\s*)*(.+)$/;

  function readableName(text) {
    return text.replace(/\s+as\s+[\w.]+\s*\{?\s*$/, '').replace(/\s*\{\s*$/, '')
      .replace(/<<([^>]*)>>/g, '«$1»').replace(/"/g, '').trim();
  }

  /** One line of ArchUML outside notes, as the drawing shows it ('' for pure syntax). */
  function drawnText(line) {
    if (!line || line.charAt(0) === '@' || STRUCTURE.test(line)) return '';
    var match = DECLARATION.exec(line);
    if (match) return readableName(match[1]);
    if ((match = FRAGMENT.exec(line))) return match[1].trim();
    if ((match = MEMBER.exec(line))) return match[1] + match[2].trim();
    // A connector or message shows only its multiplicities and label.
    if ((match = RELATION.exec(line))) {
      return [match[1], match[2], match[3] && readableName(match[3])].filter(Boolean).join(' ');
    }
    return line.replace(/"/g, '');
  }

  /**
   * The text an ArchUML source's drawing shows, one line per source line so
   * line numbers stay aligned: names, stereotypes, members, message and
   * connector labels, guards, and notes. Markers (@startuml, @enduml), the
   * @layout block, keywords, aliases, and structure lines become blank.
   * @param {string} source
   * @returns {string}
   */
  function diagramText(source) {
    var inLayout = false;
    var inNote = false;
    return String(source == null ? '' : source).split('\n').map(function (raw) {
      var line = raw.replace(/\r$/, '').trim();
      if (line === '@layout') { inLayout = true; return ''; }
      if (line === '@endlayout') { inLayout = false; return ''; }
      if (inLayout) return '';
      if (inNote) {
        if (line === 'end note') { inNote = false; return ''; }
        return line;
      }
      var note = NOTE_START.exec(line);
      if (note) {
        if (note[1] === undefined) inNote = true;
        return note[1] ? note[1].trim() : '';
      }
      return drawnText(line);
    }).join('\n');
  }

  /**
   * Whether text contains a match for query under the search options. An
   * empty query or an invalid regular expression matches nothing.
   * @param {string} text
   * @param {string} query
   * @param {{matchCase?: boolean, wholeWord?: boolean, regex?: boolean}} [options]
   */
  function textMatches(text, query, options) {
    if (typeof query !== 'string' || query === '') return false;
    var pattern;
    try {
      pattern = compile(query, options || {});
    } catch (error) {
      return false;
    }
    var match = pattern.exec(String(text));
    return !!match && match[0].length > 0;
  }

  /**
   * @param {{path: string, content: string, kind?: 'diagram', diagramId?: string, label?: string}[]} files
   * @param {string} query
   * @param {{matchCase?: boolean, wholeWord?: boolean, regex?: boolean}} [options]
   * @returns {{results: {path: string, line: number, column: number, preview: string,
   *            matchStart: number, matchLength: number, kind?: 'diagram', diagramId?: string,
   *            label?: string}[], truncated: boolean, error: string|null}}
   *   One result per occurrence, in entry then line order. line and column are
   *   1-based; matchStart/matchLength locate the match within preview. A
   *   diagram's results carry its kind, diagramId, and label.
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
      var isDiagram = file.kind === 'diagram';
      var content = String(file.content == null ? '' : file.content);
      var lines = (isDiagram ? diagramText(content) : content).split('\n');
      for (var i = 0; i < lines.length; i++) {
        var text = lines[i].replace(/\r$/, '');
        pattern.lastIndex = 0;
        var match;
        while ((match = pattern.exec(text))) {
          if (!match[0].length) { pattern.lastIndex++; continue; }
          if (results.length === MAX_RESULTS) { truncated = true; break scan; }
          var shown = previewOf(text, match.index, match[0].length);
          var result = {
            path: file.path,
            line: i + 1,
            column: match.index + 1,
            preview: shown.preview,
            matchStart: shown.matchStart,
            matchLength: shown.matchLength,
          };
          if (isDiagram) {
            result.kind = 'diagram';
            result.diagramId = file.diagramId;
            result.label = file.label;
          }
          results.push(result);
        }
      }
    }
    return { results: results, truncated: truncated, error: null };
  }

  function plural(count, singular, pluralForm) {
    return count + ' ' + (count === 1 ? singular : pluralForm);
  }

  /** "2 files", "1 diagram", or "2 files and 1 diagram". */
  function placesText(fileCount, diagramCount) {
    var places = [];
    if (fileCount || !diagramCount) places.push(plural(fileCount, 'file', 'files'));
    if (diagramCount) places.push(plural(diagramCount, 'diagram', 'diagrams'));
    return places.join(' and ');
  }

  function statusText(outcome, fileCount, diagramCount, query) {
    if (outcome.error) return outcome.error;
    if (!outcome.results.length) return 'No results for “' + query + '”.';
    if (outcome.truncated) {
      return 'Showing the first ' + MAX_RESULTS + ' results in ' + placesText(fileCount, diagramCount) +
        '. Narrow the search to see the rest.';
    }
    return plural(outcome.results.length, 'result', 'results') + ' in ' + placesText(fileCount, diagramCount) + '.';
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
   * @param {{getFiles: function(): {path: string, content: string, kind?: 'diagram',
   *            diagramId?: string, label?: string}[],
   *          onOpen: function(string, number, number): void,
   *          onOpenDiagram?: function(string, string, {matchCase: boolean, wholeWord: boolean, regex: boolean}): void,
   *          onReset?: function(): void}} options
   * @returns {{open: function(): void, close: function(): void, destroy: function(): void}}
   */
  function mount(host, options) {
    options = options || {};
    var getFiles = typeof options.getFiles === 'function' ? options.getFiles : function () { return []; };
    var onOpen = typeof options.onOpen === 'function' ? options.onOpen : function () {};
    var onOpenDiagram = typeof options.onOpenDiagram === 'function' ? options.onOpenDiagram : function () {};
    var onReset = typeof options.onReset === 'function' ? options.onReset : function () {};
    var lastSearch = { query: '', options: {} };
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
      var isDiagram = result.kind === 'diagram';
      var button = element('button', 'tutorial-project-search__match');
      button.type = 'button';
      var preview = element('span', 'tutorial-project-search__preview');
      var end = result.matchStart + result.matchLength;
      preview.append(
        document.createTextNode(result.preview.slice(0, result.matchStart)),
        element('mark', 'tutorial-project-search__hit', result.preview.slice(result.matchStart, end)),
        document.createTextNode(result.preview.slice(end))
      );
      if (isDiagram) {
        // A diagram has no lines to show; its label text is the result.
        button.appendChild(preview);
        button.addEventListener('click', function () {
          onOpenDiagram(result.diagramId, lastSearch.query, lastSearch.options);
        });
        return button;
      }
      var line = element('span', 'tutorial-project-search__line');
      line.append(element('span', 'sr-only', 'Line '), document.createTextNode(String(result.line)));
      button.append(line, preview);
      button.addEventListener('click', function () { onOpen(result.path, result.line, result.column); });
      return button;
    }

    /** A group's heading: a file's path, or "Diagram:" and the diagram's label. */
    function groupHeading(first, count, groupId) {
      var isDiagram = first.kind === 'diagram';
      var heading = element('p', 'tutorial-project-search__file-name' +
        (isDiagram ? ' tutorial-project-search__file-name--diagram' : ''));
      heading.id = groupId;
      if (isDiagram) heading.appendChild(element('span', 'tutorial-project-search__kind', 'Diagram:'));
      heading.append(
        element('span', 'tutorial-project-search__path', isDiagram ? first.label : first.path),
        element('span', 'tutorial-project-search__count', plural(count, 'result', 'results'))
      );
      return heading;
    }

    function render(outcome, query) {
      // Files first, then diagrams, each in the order search returned them.
      var groups = new Map();
      outcome.results.forEach(function (result) {
        var key = (result.kind === 'diagram' ? 'diagram\u0000' + result.diagramId : 'file\u0000' + result.path);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(result);
      });
      var fileCount = 0;
      var diagramCount = 0;
      results.replaceChildren();
      groups.forEach(function (groupResults) {
        var isDiagram = groupResults[0].kind === 'diagram';
        if (isDiagram) diagramCount++;
        else fileCount++;
        var groupId = id + '-file-' + (++groupCount);
        var group = element('li', 'tutorial-project-search__file' + (isDiagram ? ' tutorial-project-search__file--diagram' : ''));
        var list = element('ul', 'tutorial-project-search__matches');
        list.setAttribute('aria-labelledby', groupId);
        groupResults.forEach(function (result) {
          var item = element('li');
          item.appendChild(resultButton(result));
          list.appendChild(item);
        });
        group.append(groupHeading(groupResults[0], groupResults.length, groupId), list);
        results.appendChild(group);
      });
      results.hidden = groups.size === 0;
      status.textContent = statusText(outcome, fileCount, diagramCount, query);
      input.setAttribute('aria-invalid', outcome.error ? 'true' : 'false');
      if (outcome.error) input.setAttribute('aria-describedby', status.id);
      else input.removeAttribute('aria-describedby');
    }

    function runSearch() {
      clearTimeout(timer);
      onReset();
      var query = input.value;
      lastSearch = {
        query: query,
        options: { matchCase: matchCase.checked, wholeWord: wholeWord.checked, regex: regex.checked },
      };
      if (!query) {
        results.replaceChildren();
        results.hidden = true;
        status.textContent = '';
        input.setAttribute('aria-invalid', 'false');
        input.removeAttribute('aria-describedby');
        return;
      }
      render(search(getFiles(), query, lastSearch.options), query);
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
      onReset();
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

  return {
    search: search,
    diagramText: diagramText,
    textMatches: textMatches,
    mount: mount,
    MAX_RESULTS: MAX_RESULTS,
  };
});
