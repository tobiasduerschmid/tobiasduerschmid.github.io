/**
 * "Open in the C4 editor" links under C4 figures (spec §6.5, Ruling 12).
 *
 * Every C4 figure carries its source as `<script type="application/json" data-c4-source>` holding a JSON string,
 * whether the build prerendered it or the page rendered it live. On a page whose
 * `<meta name="archuml-c4-editor" content="<editor URL>">` names the editor, this script places a link after each
 * figure's image container that opens the editor in a new tab with the model in the URL fragment
 * (`#c4=<base64url UTF-8>&view=<selector>`), so nothing is stored. Figures inside an editor are skipped.
 * Live figures appear (and re-render) after this script runs, so a MutationObserver keeps the links current.
 *
 * A figure that asks the reader to predict, find, or choose something gets no link, because the editor would give
 * the answer away (its Problems panel names a flawed figure's faults; it shows an interface card whole): a card shown
 * with its syntactic view only (`# panels: syntax`), a deliberately flawed figure (one with an authored
 * `# description:`, the marker the diagrams skill reserves for find-the-flaw figures), and any figure inside a quiz.
 */
(function (global) {
  'use strict';

  var SOURCE_SELECTOR = 'script[type="application/json"][data-c4-source]';
  var LINK_CLASS = 'c4-editor-link';
  var LINK_TEXT = 'Open in the C4 editor';
  var NEW_TAB_NOTE = ' (opens a new tab)';
  // Embed directives the figure markup adds before the model (c4-view.html): comment lines naming a caption,
  // description, panels, or diagnostics, and the top-level `view:` line. The editor gets the view separately.
  var DIRECTIVE_LINE = /^#\s*(caption|description|panels|diagnostics)\s*:\s*(.*?)\s*$/;
  var VIEW_LINE = /^view[ \t]*:[ \t]*(.*?)[ \t]*$/;
  var QUIZ_SELECTOR = '.quiz-container';

  /** UTF-8 text as base64url without padding (RFC 4648 §5). */
  function toBase64Url(text) {
    var bytes = new TextEncoder().encode(text);
    var binary = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /** A selector written in YAML may be quoted; returns it unquoted. */
  function unquote(value) {
    var quoted = /^(['"])(.*)\1$/.exec(value);
    return quoted ? quoted[2] : value;
  }

  /**
   * Splits a figure's source into the model text and its view selector: leading embed directives are dropped and
   * the top-level `view:` line is taken out. Returns `{ text, view }` (`view` is null when the figure names none).
   */
  function splitFigureSource(source) {
    var lines = source.split('\n');
    var view = null;
    var leading = true;
    var kept = lines.filter(function (line) {
      if (leading && DIRECTIVE_LINE.test(line)) return false;
      if (line.trim() !== '') leading = false;
      var match = VIEW_LINE.exec(line);
      if (match && view === null) {
        view = unquote(match[1]) || null;
        return false;
      }
      return true;
    });
    return { text: kept.join('\n'), view: view };
  }

  /** The leading embed directives of a figure's source, by name (`{ panels: 'syntax', description: '…' }`). */
  function leadingDirectives(source) {
    var directives = {};
    var lines = source.split('\n');
    for (var index = 0; index < lines.length; index++) {
      var match = DIRECTIVE_LINE.exec(lines[index]);
      if (match) directives[match[1]] = match[2];
      else if (lines[index].trim() !== '') break;
    }
    return directives;
  }

  /** Whether the editor would give away what the figure's page asks the reader to work out (see the header). */
  function withholdsAnswer(container, source) {
    var directives = leadingDirectives(source);
    return directives.panels === 'syntax' || Boolean(directives.description) || container.closest(QUIZ_SELECTOR) !== null;
  }

  /** The editor URL with the figure's model and view in the fragment. */
  function editorHref(editorUrl, source) {
    var parts = splitFigureSource(source);
    var fragment = 'c4=' + toBase64Url(parts.text);
    if (parts.view) fragment += '&view=' + encodeURIComponent(parts.view);
    return editorUrl + '#' + fragment;
  }

  function linkAfter(container) {
    var next = container.nextElementSibling;
    return next && next.classList.contains(LINK_CLASS) ? next : null;
  }

  /** Adds or refreshes the link for one source element; returns nothing. */
  function linkFigure(sourceElement, editorUrl) {
    var container = sourceElement.parentElement;
    if (!container || container.closest('[data-c4-editor], .c4-editor')) return;
    var source;
    try {
      source = JSON.parse(sourceElement.textContent);
    } catch (error) {
      return; // Not a figure source this script understands; the figure itself is unaffected.
    }
    if (typeof source !== 'string') return;
    var paragraph = linkAfter(container);
    if (withholdsAnswer(container, source)) {
      if (paragraph) paragraph.remove();
      return;
    }
    var href = editorHref(editorUrl, source);
    if (!paragraph) {
      paragraph = document.createElement('p');
      paragraph.className = LINK_CLASS;
      var anchor = document.createElement('a');
      anchor.target = '_blank';
      anchor.rel = 'noopener';
      anchor.append(LINK_TEXT);
      var note = document.createElement('span');
      note.className = LINK_CLASS + '__note';
      note.textContent = NEW_TAB_NOTE;
      anchor.append(note);
      paragraph.append(anchor);
      container.after(paragraph);
    }
    var link = paragraph.querySelector('a');
    if (link.getAttribute('href') !== href) link.setAttribute('href', href);
  }

  function linkAll(scope, editorUrl) {
    if (scope.matches && scope.matches(SOURCE_SELECTOR)) linkFigure(scope, editorUrl);
    if (scope.querySelectorAll) scope.querySelectorAll(SOURCE_SELECTOR).forEach(function (element) { linkFigure(element, editorUrl); });
  }

  /**
   * Whether C4 figures can still appear: a live figure starts as a `[data-uml-type="c4"]` container (the renderer
   * adds its source element when it draws), and a page may also load the C4 renderer (`c4-scripts.html`). Both are
   * in the parsed document by the time this runs.
   */
  function rendersC4Live() {
    return document.querySelector('[data-uml-type="c4"], script[src*="/ArchUML/c4/"]') !== null;
  }

  function start() {
    var meta = document.querySelector('meta[name="archuml-c4-editor"]');
    if (!meta || !meta.content) return;
    var editorUrl = meta.content;
    linkAll(document, editorUrl);
    // Most SEBook pages carry the meta but no C4 figure; they need no observer.
    if (!rendersC4Live()) return;
    new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) linkAll(node, editorUrl);
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  global.SebookC4EditorLink = {
    splitFigureSource: splitFigureSource, editorHref: editorHref, toBase64Url: toBase64Url, leadingDirectives: leadingDirectives,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window);
