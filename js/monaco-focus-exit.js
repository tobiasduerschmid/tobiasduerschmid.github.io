// Escape leaves a tutorial Monaco editor after Monaco's own dismissible UI
// (suggestions, find, parameter hints, rename, or snippets) has closed.
(function () {
  'use strict';

  var exitWhen = 'editorTextFocus && !suggestWidgetVisible && !findWidgetVisible && !parameterHintsVisible && !renameInputVisible && !inSnippetMode';
  var focusableSelector = 'a[href], button, input, select, textarea, [tabindex]';

  function isAvailable(element) {
    return element.tabIndex >= 0 && !element.disabled &&
      !element.closest('[inert], [aria-hidden="true"]') &&
      element.getClientRects().length > 0 &&
      window.getComputedStyle(element).visibility !== 'hidden';
  }

  function attach(editor) {
    editor.addCommand(monaco.KeyCode.Escape, function () {
      var editorNode = editor.getDomNode();
      if (!editorNode) return;

      // Continue in document order so the next Tab does not re-enter Monaco.
      var controls = document.querySelectorAll(focusableSelector);
      for (var i = 0; i < controls.length; i++) {
        var control = controls[i];
        if (!isAvailable(control) || editorNode.contains(control)) continue;
        if (editorNode.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING) {
          control.focus();
          if (document.activeElement === control) return;
        }
      }

      // A standalone editor may be the last control on the page.
      document.body.tabIndex = -1;
      document.body.focus();
    }, exitWhen);
  }

  window.SebookMonacoFocusExit = { attach: attach };
})();
