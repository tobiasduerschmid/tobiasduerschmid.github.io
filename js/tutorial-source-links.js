/**
 * TutorialSourceLinks — turn `path:line` references to project files into
 * controls that open the file at that line.
 *
 * findSourceReferences(text, isProjectFile) is pure: every `path:line` or
 * `path:line:column` inside a text whose path is a project file, with its
 * position. parseSourceReference(text, isProjectFile) accepts only a text
 * that is exactly one such reference (a code span such as
 * `services/opc/invoice_task.py:35`).
 *
 * linkSourceReferences(root, isProjectFile, onOpen) replaces each such code
 * span under root with a button that keeps the code styling, is named
 * "Open <path> at line <line>", and calls onOpen(path, line, column). Code
 * inside pre blocks, links, buttons, and labels stays as it is; a path that
 * is not a project file stays plain code.
 *
 * Loaded as a classic script (window.TutorialSourceLinks) and by Node tests
 * (module.exports).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TutorialSourceLinks = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  // A relative path of word characters, dots, dashes, and slashes that ends
  // in a file extension, then :line and an optional :column. The lookbehind
  // keeps a reference from starting inside a longer word or path.
  var REFERENCE = /(?<![\w./-])([\w-][\w.-]*(?:\/[\w.-]+)*\.[A-Za-z0-9]+):(\d+)(?::(\d+))?(?![\w:])/g;
  var BUTTON_CLASS = 'tutorial-source-link';

  function reference(match, isProjectFile) {
    var path = match[1];
    var line = Number(match[2]);
    if (line < 1 || !isProjectFile(path)) return null;
    return {
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
      path: path,
      line: line,
      column: match[3] ? Math.max(1, Number(match[3])) : 1,
    };
  }

  /**
   * @param {string} text
   * @param {function(string): boolean} isProjectFile
   * @returns {{start: number, end: number, text: string, path: string, line: number, column: number}[]}
   */
  function findSourceReferences(text, isProjectFile) {
    var found = [];
    var source = String(text == null ? '' : text);
    REFERENCE.lastIndex = 0;
    var match;
    while ((match = REFERENCE.exec(source))) {
      var ref = reference(match, isProjectFile);
      if (ref) found.push(ref);
    }
    return found;
  }

  /** The reference that a text is exactly (trimmed), or null. */
  function parseSourceReference(text, isProjectFile) {
    var trimmed = String(text == null ? '' : text).trim();
    var refs = findSourceReferences(trimmed, isProjectFile);
    return refs.length === 1 && refs[0].start === 0 && refs[0].end === trimmed.length ? refs[0] : null;
  }

  /**
   * @param {ParentNode} root  an element or fragment of rendered Markdown
   * @param {function(string): boolean} isProjectFile
   * @param {function(string, number, number): void} onOpen
   * @returns {number} how many code spans became buttons
   */
  function linkSourceReferences(root, isProjectFile, onOpen) {
    if (!root || typeof root.querySelectorAll !== 'function') return 0;
    var count = 0;
    Array.prototype.forEach.call(root.querySelectorAll('code'), function (code) {
      if (code.closest('pre, a, button, label, summary, .' + BUTTON_CLASS)) return;
      var ref = parseSourceReference(code.textContent, isProjectFile);
      if (!ref) return;
      var button = code.ownerDocument.createElement('button');
      button.type = 'button';
      button.className = BUTTON_CLASS;
      button.setAttribute('aria-label', 'Open ' + ref.path + ' at line ' + ref.line +
        (ref.column > 1 ? ', column ' + ref.column : ''));
      code.replaceWith(button);
      button.appendChild(code);
      button.addEventListener('click', function () { onOpen(ref.path, ref.line, ref.column); });
      count++;
    });
    return count;
  }

  return {
    findSourceReferences: findSourceReferences,
    parseSourceReference: parseSourceReference,
    linkSourceReferences: linkSourceReferences,
  };
});
