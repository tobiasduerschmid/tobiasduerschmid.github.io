/* Formatting, clipboard and serialization boundary for student-authored notes.
   Only semantic text markup crosses into storage or the printable document. */
(function () {
  'use strict';
  const allowedTags = ['p', 'div', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'ul', 'ol', 'li'];

  function clean(html) {
    const fragment = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: allowedTags, ALLOWED_ATTR: [],
      ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false, RETURN_DOM_FRAGMENT: true,
    });
    const container = document.createElement('div');
    container.append(fragment);
    for (const [source, target] of [['b', 'strong'], ['i', 'em'], ['strike', 's']]) {
      container.querySelectorAll(source).forEach(node => {
        const replacement = document.createElement(target);
        replacement.append(...node.childNodes);
        node.replaceWith(replacement);
      });
    }
    return container.textContent.trim() ? container.innerHTML : '';
  }

  function plainText(text) {
    const container = document.createElement('div');
    container.textContent = text;
    return container.innerHTML;
  }

  function fromStored(entry, version) {
    if (version === 1 && typeof entry === 'string') return plainText(entry);
    if (version === 2 && entry && typeof entry.html === 'string') return clean(entry.html);
    throw new Error('Unsupported saved note');
  }

  function commandFor(event) {
    if ((!event.ctrlKey && !event.metaKey) || event.altKey || event.isComposing) return null;
    if (event.shiftKey) {
      if (event.code === 'Digit7') return ['insertOrderedList', 'Numbered list'];
      if (event.code === 'Digit8') return ['insertUnorderedList', 'Bulleted list'];
      return null;
    }
    return { b: ['bold', 'Bold'], i: ['italic', 'Italic'], u: ['underline', 'Underline'] }[event.key.toLowerCase()];
  }

  // Native editing commands preserve selection and browser undo/redo history.
  // Keep this deprecated API isolated until an undo-preserving replacement exists.
  function execute(command, value = null) {
    document.execCommand('styleWithCSS', false, false);
    document.execCommand(command, false, value);
  }

  function mount(field, onChange, announce) {
    field.contentEditable = 'true';
    field.closest('[data-notes-input]').hidden = false;
    field.addEventListener('input', onChange);
    field.addEventListener('keydown', event => {
      const command = commandFor(event);
      if (!command) return;
      const selection = window.getSelection();
      if (!selection || !field.contains(selection.anchorNode) || !field.contains(selection.focusNode)) return;
      event.preventDefault();
      execute(command[0]);
      onChange();
      announce(`${command[1]} ${document.queryCommandState(command[0]) ? 'on' : 'off'}.`);
    });
    field.addEventListener('paste', event => {
      event.preventDefault();
      const html = event.clipboardData.getData('text/html');
      execute('insertHTML', html ? clean(html) : plainText(event.clipboardData.getData('text/plain')));
      onChange();
    });
    // Dropping arbitrary document fragments bypasses the controlled paste path.
    field.addEventListener('drop', event => event.preventDefault());
  }

  window.NarrationNoteRichText = { clean, fromStored, mount };
})();
