/**
 * The SEBook host adapter for the C4 editor (spec §3.4, §10).
 *
 * ArchUML's editor never touches storage, files, the clipboard, or site globals; this file supplies them. It mounts
 * `ArchUMLC4Editor` on every `[data-c4-editor]` element that `_includes/c4-editor.html` writes, with a host that
 * downloads through Blobs, opens files through `<input type="file">`, copies through the clipboard, confirms through
 * `SebookConfirmation`, and edits YAML in Monaco (through `SEBookMonaco`) over a labelled textarea.
 *
 * The standalone page (`/SEBook/tools/c4-editor`, `standalone: true`) adds what only that page has: one browser
 * draft (`c4-editor-draft`, listed on /cookies/), the "Open in the C4 editor" fragment handoff
 * (`#c4=<base64url UTF-8>&view=<selector>`, written by js/c4-editor-link.js), the example chooser, and the profile
 * switch. Chapter embeds keep their edits in memory only.
 *
 * Public API: `SebookC4EditorSite.initFrom(root)` mounts the editors inside `root` (the page calls it once);
 * `destroyWithin(root)` destroys them and puts the no-JavaScript fallback back.
 */
(function (global) {
  'use strict';

  const DRAFT_KEY = 'c4-editor-draft';
  const DRAFT_VERSION = 1;
  // Typing in the YAML tab already waits 250 ms; this delay batches the writes of a burst of form edits.
  const DRAFT_WRITE_DELAY_MS = 400;
  const SOURCE_EDITOR_LANGUAGE = 'yaml';

  // Where the editor links pattern and style names (spec §3.4 `links`): the SEBook chapters that teach them.
  const SEBOOK_LINKS = Object.freeze({
    patterns: {
      'Strategy': '/SEBook/designpatterns/strategy.html',
      'State': '/SEBook/designpatterns/state.html',
      'Observer': '/SEBook/designpatterns/observer.html',
      'Command': '/SEBook/designpatterns/command.html',
      'Adapter': '/SEBook/designpatterns/adapter.html',
      'Facade': '/SEBook/designpatterns/facade.html',
      'Composite': '/SEBook/designpatterns/composite.html',
      'Singleton': '/SEBook/designpatterns/singleton.html',
      'Factory Method': '/SEBook/designpatterns/factory_method.html',
      'Abstract Factory': '/SEBook/designpatterns/abstract_factory.html',
      'Builder': '/SEBook/designpatterns/builder.html',
      'Mediator': '/SEBook/designpatterns/mediator.html',
      'Visitor': '/SEBook/designpatterns/visitor.html',
      'MVC': '/SEBook/designpatterns/mvc.html',
    },
    styles: {
      'layers': '/SEBook/architectural_styles/layers.html',
      'pipes-and-filters': '/SEBook/architectural_styles/pipes_and_filters.html',
      'publish-subscribe': '/SEBook/architectural_styles/pubsub.html',
    },
    glossary: {},
  });

  const TEXT = Object.freeze({
    restored: (time) => `Restored your draft from ${time}. It is kept in this browser only.`,
    storageUnavailable: 'This browser does not let the page keep a draft, so your edits stay in this tab only. '
      + 'Use Download YAML to keep your work.',
    storageFull: 'The draft could not be saved because this browser\'s storage is full or blocked. Your edits stay in '
      + 'this tab only; use Download YAML to keep your work.',
    otherTabSaved: 'Another tab saved a newer C4 editor draft. This tab keeps its own model; your next edit here '
      + 'replaces that draft.',
    otherTabRemoved: 'The saved draft was deleted in another tab or on the storage page. Edit here to save a new one.',
    loadOtherDraft: 'Open the newer draft',
    handoffUnreadable: 'The link did not carry a model this page can read, so the editor opened as usual.',
    replaced: 'The model from the link replaced your draft.',
    kept: 'Kept your draft.',
    downloadedThenReplaced: 'Downloaded your draft as c4-editor-draft.yml, then replaced it with the model from the link.',
    exampleLoaded: (label) => `Loaded the example: ${label}.`,
    profileChanged: (label) => `Switched to the ${label} profile.`,
    copyFailed: 'The browser did not allow copying to the clipboard.',
    mountFailed: 'The C4 editor could not start, so the model is shown as a figure and as YAML below.',
  });

  const mounted = new Map(); // embed element → { destroy }
  let sourceEditorCount = 0;

  // ---- The fragment handoff ----------------------------------------------------------------------------------

  /** Text from base64url UTF-8 (RFC 4648 §5, with or without padding); throws on input that is not. */
  function fromBase64Url(value) {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }

  /**
   * Reads `#c4=<base64url>&view=<selector>`. Returns null when the fragment carries no model, `{ error }` when it
   * carries one that cannot be decoded, and `{ text, view }` otherwise (`view` is null when absent).
   */
  function readHandoff(hash) {
    const params = new URLSearchParams(String(hash || '').replace(/^#/, ''));
    if (!params.has('c4')) return null;
    try {
      return { text: fromBase64Url(params.get('c4')), view: params.get('view') || null };
    } catch (error) {
      return { error };
    }
  }

  /** Removes the handoff from the address, so a reload restores the draft instead of asking again. */
  function forgetHandoff(win) {
    win.history.replaceState(win.history.state, '', win.location.pathname + win.location.search);
  }

  // ---- The browser draft -------------------------------------------------------------------------------------

  /**
   * The one standalone-page draft in `localStorage` under `c4-editor-draft`: `{version: 1, text, savedAt, view}`.
   * Every access is guarded, because storage can be blocked (a SecurityError on access) or full (on write).
   * `read()` → `{ available, record }` (`record` is null when there is no readable draft); `write(text, view)` →
   * true when stored; `isOwnKey(key)` tells a `storage` event about this draft from others.
   */
  function createDraftStore(win, now) {
    function storage() {
      return win.localStorage; // Throws a SecurityError where the browser blocks storage.
    }

    function parse(raw) {
      if (raw === null) return null;
      try {
        const record = JSON.parse(raw);
        const valid = record && record.version === DRAFT_VERSION && typeof record.text === 'string';
        return valid ? record : null;
      } catch (error) {
        return null; // A damaged entry is treated as no draft; the next edit replaces it.
      }
    }

    return {
      read() {
        try {
          return { available: true, record: parse(storage().getItem(DRAFT_KEY)) };
        } catch (error) {
          return { available: false, record: null };
        }
      },
      write(text, view) {
        try {
          const record = { version: DRAFT_VERSION, text, savedAt: new Date(now()).toISOString(), view: view || null };
          storage().setItem(DRAFT_KEY, JSON.stringify(record));
          return true;
        } catch (error) {
          return false;
        }
      },
      parse,
      isOwnKey: (key) => key === DRAFT_KEY,
    };
  }

  /** "9 November, 14:05" in the reader's locale. */
  function describeTime(isoText) {
    const date = new Date(isoText);
    if (Number.isNaN(date.getTime())) return 'an earlier visit';
    return date.toLocaleString(undefined, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  }

  // ---- Host capabilities ---------------------------------------------------------------------------------------

  /** Saves `text` as a file named `filename` through a temporary Blob URL. */
  function downloadText(doc, text, filename, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const anchor = doc.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.hidden = true;
    doc.body.append(anchor);
    anchor.click();
    anchor.remove();
    // The download has started once click() returns; the URL can go after this task.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  /** A file name for a view: "components of api" → "c4-components-of-api.svg". */
  function svgFileName(view) {
    const slug = String(view || 'view').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `c4-${slug || 'view'}.svg`;
  }

  /** An SVG document that a browser opens on its own: the root needs the SVG namespace. */
  function standaloneSvg(svgText) {
    return /^<svg\b[^>]*\bxmlns=/.test(svgText) ? svgText : svgText.replace(/^<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  /** Resolves `{ text, name }` for a chosen file, or null when the reader cancels. */
  function pickTextFile(doc) {
    return new Promise((resolve, reject) => {
      const input = doc.createElement('input');
      input.type = 'file';
      input.accept = '.yml,.yaml,text/yaml,application/yaml,text/plain';
      input.hidden = true;
      const finish = (value, error) => {
        input.remove();
        if (error) reject(error);
        else resolve(value);
      };
      input.addEventListener('cancel', () => finish(null));
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        if (!file) return finish(null);
        return file.text().then((text) => finish({ text, name: file.name }), (error) => finish(null, error));
      });
      doc.body.append(input);
      input.click();
    });
  }

  function copyToClipboard(win, text) {
    const clipboard = win.navigator.clipboard;
    if (!clipboard || typeof clipboard.writeText !== 'function') return Promise.reject(new Error(TEXT.copyFailed));
    return clipboard.writeText(text).catch(() => { throw new Error(TEXT.copyFailed); });
  }

  /**
   * The host object for one editor (spec §3.4). `listeners`: `onTextChange(text, info)` and `onViewChange(view)`
   * from the embed's controller. Confirmations use the site's dialog (`SebookConfirmation`, which every SEBook
   * layout loads after this script, so it is looked up when a confirmation is needed).
   */
  function createSiteHost(win, listeners) {
    const doc = win.document;
    const host = {
      onTextChange: listeners.onTextChange,
      onViewChange: listeners.onViewChange,
      openFile: () => pickTextFile(doc),
      saveFile(text) {
        downloadText(doc, text, 'design.yml', 'text/yaml');
        return Promise.resolve();
      },
      exportSvg(svgText, info) {
        downloadText(doc, standaloneSvg(svgText), svgFileName(info && info.view), 'image/svg+xml');
        return Promise.resolve();
      },
      copyText: (text) => copyToClipboard(win, text),
      createSourceEditor: (container, options) => createSiteSourceEditor(win, container, options),
      confirm: (request) => win.SebookConfirmation.confirm(request),
      undo: 'editor',
    };
    return host;
  }

  // ---- The YAML source editor: a labelled textarea, upgraded to Monaco when it loads -------------------------

  /** `text` with `{ offset, length, text }` splices applied, the last first so earlier offsets stay valid. */
  function applySplices(text, edits) {
    return edits.slice().sort((a, b) => b.offset - a.offset)
      .reduce((result, edit) => result.slice(0, edit.offset) + edit.text + result.slice(edit.offset + edit.length), text);
  }

  /** The offset of 1-based `line` and `column` in `text`. */
  function offsetOf(text, line, column) {
    const lines = text.split('\n');
    const before = lines.slice(0, line - 1).reduce((total, current) => total + current.length + 1, 0);
    return Math.min(text.length, before + Math.max(0, column - 1));
  }

  /**
   * 'undo' for Ctrl/Cmd+Z, 'redo' for Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y, null for any other key: the keys the editor's
   * canvas uses for its history (c4-editor-mount.js), so the YAML tab and the drawing share one undo stack.
   */
  function historyCommandFor(event) {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return null;
    const key = event.key.toLowerCase();
    if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
    if (key === 'y') return 'redo';
    return null;
  }

  /**
   * A SourceEditor handle (spec §3.4: `getValue, setValue, applyEdits, revealRange, setMarkers, focus,
   * onDidChange, dispose`). It starts as a labelled textarea with the problems listed under it, so the YAML is
   * editable at once and without Monaco; when `SEBookMonaco` loads, Monaco takes the textarea's place and the
   * problem list stays as the accessible summary of the markers. Writes from the editor never fire `onDidChange`.
   *
   * One undo stack (spec §3.4, site host): when `options.undo` and `options.redo` are given, the history keys in
   * this source editor run them instead of the textarea's or Monaco's own undo, and the editor's writes go into
   * Monaco without entering Monaco's undo stack; Monaco's own Undo and Redo commands also run the editor's.
   */
  function createSiteSourceEditor(win, container, options) {
    const doc = win.document;
    sourceEditorCount += 1;
    const id = `c4-site-source-${sourceEditorCount}`;
    const wrapper = doc.createElement('div');
    wrapper.className = 'c4-editor-site-source';
    const label = doc.createElement('label');
    label.className = 'c4-editor-site-source__label';
    label.htmlFor = id;
    label.textContent = options.label || 'YAML source';
    const field = doc.createElement('textarea');
    field.id = id;
    field.className = 'c4-editor-site-source__text';
    field.rows = 20;
    field.wrap = 'off';
    field.spellcheck = false;
    field.setAttribute('autocapitalize', 'off');
    field.setAttribute('autocomplete', 'off');
    field.readOnly = Boolean(options.readOnly);
    field.value = options.value || '';
    const monacoHost = doc.createElement('div');
    monacoHost.className = 'c4-editor-site-source__monaco';
    monacoHost.hidden = true;
    const problems = doc.createElement('ul');
    problems.className = 'c4-editor-site-source__problems';
    problems.id = `${id}-problems`;
    problems.setAttribute('aria-label', 'Problems in the YAML');
    problems.hidden = true;
    wrapper.append(label, field, monacoHost, problems);
    container.append(wrapper);

    const changeListeners = new Set();
    let monacoEditor = null;
    let monacoSubscriptions = [];
    let markers = [];
    let writing = false;
    let disposed = false;
    // Monaco's text before its latest change, so a change from Monaco's own undo stack can be taken back.
    let shownText = '';
    const notify = () => { if (!writing) changeListeners.forEach((listener) => listener()); };
    field.addEventListener('input', notify);

    // Capturing on the wrapper runs before the textarea's and Monaco's own key handling, for both of them.
    function routeHistoryKeys(event) {
      const command = historyCommandFor(event);
      if (command === null || typeof options[command] !== 'function') return;
      event.preventDefault();
      event.stopPropagation();
      options[command]();
    }
    wrapper.addEventListener('keydown', routeHistoryKeys, true);

    function writeQuietly(write) {
      writing = true;
      try { write(); } finally { writing = false; }
    }

    function showMarkers() {
      const items = markers.map((marker, index) => {
        const item = doc.createElement('li');
        item.id = `${id}-problem-${index}`;
        item.textContent = `Line ${marker.range.start.line}: ${marker.message}`;
        return item;
      });
      problems.replaceChildren(...items);
      problems.hidden = items.length === 0;
      if (items.length > 0) field.setAttribute('aria-describedby', items.map((item) => item.id).join(' '));
      else field.removeAttribute('aria-describedby');
      if (markers.some((marker) => marker.severity === 'error')) field.setAttribute('aria-invalid', 'true');
      else field.removeAttribute('aria-invalid');
      if (monacoEditor) win.monaco.editor.setModelMarkers(monacoEditor.getModel(), 'c4-editor', markers.map(monacoMarker));
    }

    function monacoMarker(marker) {
      const severities = win.monaco.MarkerSeverity;
      const severity = { error: severities.Error, warning: severities.Warning }[marker.severity] || severities.Info;
      const { start, end } = marker.range;
      return { severity, message: marker.message, startLineNumber: start.line, startColumn: start.col,
        endLineNumber: (end || start).line, endColumn: (end || start).col };
    }

    /** Paragraph-sized text in the site's light or dark theme. */
    function monacoAppearance() {
      const fontSize = parseFloat(win.getComputedStyle(wrapper).fontSize) || 16;
      const theme = doc.documentElement.classList.contains('dark-mode') ? 'vs-dark' : 'vs';
      return { fontSize, lineHeight: Math.ceil(fontSize * 1.5), theme };
    }

    /**
     * Monaco's own Undo and Redo commands (reached without the routed keys, for example through `trigger`) step the
     * editor's history too: Monaco's change is taken back quietly and the editor's command runs instead, so the reader
     * never meets a second history. Other changes are the reader's typing.
     */
    function onMonacoChange(event) {
      const command = event.isUndoing ? 'undo' : (event.isRedoing ? 'redo' : null);
      if (command !== null && !writing && typeof options[command] === 'function') {
        const model = monacoEditor.getModel();
        const before = shownText;
        writeQuietly(() => model.applyEdits([{ range: model.getFullModelRange(), text: before }]));
        options[command]();
        return;
      }
      shownText = monacoEditor.getValue();
      notify();
    }

    /** Replaces the textarea with Monaco, keeping the text, the markers, and focus. */
    function upgrade(monaco) {
      if (disposed || !monaco || monacoEditor) return;
      const hadFocus = doc.activeElement === field;
      monacoHost.hidden = false;
      monacoEditor = monaco.editor.create(monacoHost, Object.assign({
        value: field.value, language: SOURCE_EDITOR_LANGUAGE, readOnly: field.readOnly,
        ariaLabel: `${label.textContent}. Press Escape to leave the editor.`,
        accessibilitySupport: 'auto', automaticLayout: true, minimap: { enabled: false },
        scrollBeyondLastLine: false, tabSize: 2, insertSpaces: true, detectIndentation: false,
        quickSuggestions: false, fixedOverflowWidgets: true,
      }, monacoAppearance()));
      if (win.SebookMonacoFocusExit) win.SebookMonacoFocusExit.attach(monacoEditor);
      const themeObserver = new win.MutationObserver(() => monacoEditor.updateOptions(monacoAppearance()));
      themeObserver.observe(doc.documentElement, { attributes: true, attributeFilter: ['class'] });
      shownText = monacoEditor.getValue();
      monacoSubscriptions = [monacoEditor.onDidChangeModelContent(onMonacoChange), { dispose: () => themeObserver.disconnect() }];
      // Monaco carries the name (its ariaLabel), so the textarea leaves the page and its <label> becomes a caption:
      // a label without its control, or a hidden control without its label, would only confuse assistive technology.
      field.remove();
      const caption = doc.createElement('p');
      caption.className = label.className;
      caption.id = `${id}-label`;
      caption.textContent = label.textContent;
      label.replaceWith(caption);
      showMarkers();
      if (hadFocus) monacoEditor.focus();
    }

    if (win.SEBookMonaco && typeof win.SEBookMonaco.loadLanguages === 'function') {
      // Without Monaco the textarea stays: a failed load changes nothing the reader relies on.
      win.SEBookMonaco.loadLanguages([SOURCE_EDITOR_LANGUAGE]).then(upgrade, () => {});
    }

    // `applyEdits` changes Monaco's model without an undo entry; `pushEditOperations` would record the editor's write
    // on Monaco's own stack, a second history that Monaco's Undo command could replay out of step with the editor.
    return {
      getValue: () => (monacoEditor ? monacoEditor.getValue() : field.value),
      setValue(text) {
        writeQuietly(() => {
          if (monacoEditor) {
            const model = monacoEditor.getModel();
            model.applyEdits([{ range: model.getFullModelRange(), text }]);
          } else {
            const { selectionStart, selectionEnd } = field;
            field.value = text;
            field.setSelectionRange(Math.min(selectionStart, text.length), Math.min(selectionEnd, text.length));
          }
        });
      },
      applyEdits(edits) {
        writeQuietly(() => {
          if (monacoEditor) {
            const model = monacoEditor.getModel();
            const operations = edits.map((edit) => {
              const start = model.getPositionAt(edit.offset);
              const end = model.getPositionAt(edit.offset + edit.length);
              return { range: new win.monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column), text: edit.text };
            });
            model.applyEdits(operations);
          } else {
            const mapOffset = (offset) => edits.reduce((mapped, edit) => {
              if (mapped <= edit.offset) return mapped;
              if (mapped >= edit.offset + edit.length) return mapped + edit.text.length - edit.length;
              return edit.offset + edit.text.length;
            }, offset);
            const start = mapOffset(field.selectionStart);
            const end = mapOffset(field.selectionEnd);
            field.value = applySplices(field.value, edits);
            field.setSelectionRange(start, end);
          }
        });
      },
      revealRange(range) {
        if (monacoEditor) {
          const position = { lineNumber: range.start.line, column: range.start.col };
          monacoEditor.setPosition(position);
          monacoEditor.revealPositionInCenter(position);
          return;
        }
        const offset = offsetOf(field.value, range.start.line, range.start.col);
        field.setSelectionRange(offset, offset);
        const lineHeight = parseFloat(win.getComputedStyle(field).lineHeight) || 0;
        field.scrollTop = Math.max(0, (range.start.line - 3) * lineHeight);
      },
      setMarkers(next) {
        markers = next.slice();
        showMarkers();
      },
      focus: () => (monacoEditor ? monacoEditor.focus() : field.focus()),
      onDidChange(listener) {
        changeListeners.add(listener);
        return { dispose: () => changeListeners.delete(listener) };
      },
      dispose() {
        disposed = true;
        changeListeners.clear();
        field.removeEventListener('input', notify);
        wrapper.removeEventListener('keydown', routeHistoryKeys, true);
        monacoSubscriptions.forEach((subscription) => subscription.dispose());
        if (monacoEditor) monacoEditor.dispose();
        wrapper.remove();
      },
    };
  }

  // ---- One embed ---------------------------------------------------------------------------------------------

  function readConfig(embed) {
    const script = embed.querySelector('script[type="application/json"][data-c4-editor-config]');
    return JSON.parse(script.textContent);
  }

  /**
   * Mounts the editor of one embed and returns `{ destroy }`. The embed's fallback (figure and YAML) leaves the
   * page while the editor is mounted; a mount that fails puts it back with a message.
   */
  function mountEmbed(embed, win) {
    const doc = win.document;
    const config = readConfig(embed);
    const fallback = embed.querySelector('[data-c4-editor-fallback]');
    const fallbackPlace = doc.createComment('c4 editor fallback');
    const root = doc.createElement('div');
    root.className = 'c4-editor-embed__editor';
    fallback.replaceWith(fallbackPlace);
    fallbackPlace.after(root);

    function restoreFallback() {
      root.remove();
      fallbackPlace.replaceWith(fallback);
    }

    try {
      const controller = config.standalone
        ? createStandalonePage(embed, root, config, win)
        : createInMemoryEmbed(root, config, win);
      return {
        destroy() {
          controller.destroy();
          restoreFallback();
        },
      };
    } catch (error) {
      restoreFallback();
      const message = doc.createElement('p');
      message.className = 'c4-editor-embed__error';
      message.setAttribute('role', 'alert');
      message.textContent = TEXT.mountFailed;
      fallback.prepend(message);
      throw error;
    }
  }

  /** The editor's mount options for this embed, around `text`, `view`, and `profile`. */
  function mountOptions(config, settings, host) {
    return {
      text: settings.text,
      view: settings.view || undefined,
      profile: settings.profile,
      size: config.size || 'regular',
      sourceEditor: true,
      links: SEBOOK_LINKS,
      host,
    };
  }

  /** A chapter embed: edits stay in memory (spec §10). */
  function createInMemoryEmbed(root, config, win) {
    const host = createSiteHost(win, { onTextChange() {}, onViewChange() {} });
    const editor = global.ArchUMLC4Editor.mount(root, mountOptions(config, config, host));
    return { destroy: () => editor.destroy() };
  }

  // ---- The standalone page -----------------------------------------------------------------------------------

  /**
   * The standalone editor page: which text opens (a link's model, the draft, or the course-registration example),
   * when the draft is written (a moment after each edit, and never while the reader still has to choose what
   * happens to an existing draft), the notices, the handoff choice, the examples, and the profile switch.
   */
  function createStandalonePage(embed, root, config, win) {
    const doc = win.document;
    const drafts = createDraftStore(win, () => Date.now());
    const ui = standaloneElements(embed);
    const listeners = new AbortController();
    const on = (target, type, handler) => target.addEventListener(type, handler, { signal: listeners.signal });

    let editor = null;
    let profile = config.profile || 'novice';
    let currentView = config.view || null;
    let baseline = config.text; // The text last loaded on purpose; an edit away from it is work to keep.
    let savingAllowed = true; // False while the handoff choice is open, and once storage has failed.
    let pendingWrite = null;
    let handoffChoice = null;

    const host = createSiteHost(win, {
      onTextChange(text) {
        if (savingAllowed) scheduleWrite();
      },
      onViewChange(view) {
        currentView = view;
      },
    });

    function mount(text, view) {
      if (editor) editor.destroy();
      editor = global.ArchUMLC4Editor.mount(root, mountOptions(config, { text, view, profile }, host));
      currentView = view || null;
    }

    function scheduleWrite() {
      win.clearTimeout(pendingWrite);
      pendingWrite = win.setTimeout(writeNow, DRAFT_WRITE_DELAY_MS);
    }

    function writeNow() {
      win.clearTimeout(pendingWrite);
      pendingWrite = null;
      if (!editor || !savingAllowed) return;
      if (!drafts.write(editor.getText(), currentView)) {
        savingAllowed = false;
        notify(TEXT.storageFull);
      }
    }

    /** A pending write lands before the page goes away, so the last edit is never lost to the debounce. */
    function flushPendingWrite() {
      if (pendingWrite !== null) writeNow();
    }

    function notify(message, action) {
      ui.notice.replaceChildren();
      const text = doc.createElement('p');
      text.className = 'c4-editor-embed__notice-text';
      text.textContent = message;
      ui.notice.append(text);
      if (action) {
        const button = doc.createElement('button');
        button.type = 'button';
        button.className = 'c4-editor-embed__button';
        button.textContent = action.label;
        // The button stays usable after a Cancel, so a click is ignored only while its own request is open.
        let running = false;
        button.addEventListener('click', () => {
          if (running) return;
          running = true;
          Promise.resolve(action.run(button)).finally(() => { running = false; });
        });
        ui.notice.append(button);
      }
    }

    function hasUnsavedWork() {
      return editor !== null && editor.getText() !== baseline;
    }

    /** Asks before `text` replaces work in the editor; resolves true when the reader agrees or nothing is lost. */
    function confirmReplacing(request) {
      if (!hasUnsavedWork()) return Promise.resolve(true);
      return Promise.resolve(host.confirm(request)).then(Boolean);
    }

    // -- Opening: link, draft, or example --

    function open() {
      const stored = drafts.read();
      const handoff = readHandoff(win.location.hash);
      if (handoff) forgetHandoff(win);
      if (!stored.available) {
        savingAllowed = false;
        notify(TEXT.storageUnavailable);
      }
      if (handoff && !handoff.error) {
        openHandoff(handoff, stored.record);
        return;
      }
      if (stored.record) {
        baseline = stored.record.text;
        mount(stored.record.text, stored.record.view);
        notify(handoff ? `${TEXT.handoffUnreadable} ${TEXT.restored(describeTime(stored.record.savedAt))}`
          : TEXT.restored(describeTime(stored.record.savedAt)));
        return;
      }
      mount(config.text, config.view);
      if (handoff) notify(TEXT.handoffUnreadable);
    }

    /** A link's model opens at once; if a different draft exists, nothing is saved until the reader chooses. */
    function openHandoff(handoff, draft) {
      baseline = handoff.text;
      mount(handoff.text, handoff.view);
      if (!draft || draft.text === handoff.text || !savingAllowed) return;
      savingAllowed = false;
      handoffChoice = draft;
      ui.handoff.hidden = false;
    }

    /** Keeping the draft discards edits made to the link's model, so that choice asks first when there are any. */
    function chooseHandoff(choice, trigger) {
      const draft = handoffChoice;
      if (!draft) return;
      const agreed = choice !== 'keep' ? Promise.resolve(true) : confirmReplacing({
        title: 'Keep your draft?',
        message: 'Your draft replaces the model from the link, together with the edits you made to it. Download YAML '
          + 'first to keep those edits.',
        confirmLabel: 'Keep draft',
        cancelLabel: 'Go back',
        trigger,
      });
      agreed.then((confirmed) => {
        // The choice may have been settled by another click while the dialog was open.
        if (confirmed && handoffChoice === draft) settleHandoff(choice, draft);
      });
    }

    function settleHandoff(choice, draft) {
      handoffChoice = null;
      ui.handoff.hidden = true;
      savingAllowed = true;
      if (choice === 'keep') {
        baseline = draft.text;
        mount(draft.text, draft.view);
        notify(TEXT.kept);
      } else {
        if (choice === 'download') downloadText(doc, draft.text, 'c4-editor-draft.yml', 'text/yaml');
        writeNow();
        notify(choice === 'download' ? TEXT.downloadedThenReplaced : TEXT.replaced);
      }
      ui.focusTarget.focus();
    }

    // -- Another tab --

    function onStorage(event) {
      // `localStorage.clear()` (the storage page's "Delete everything") reports no key at all.
      if (event.key === null) {
        if (!drafts.read().record) notify(TEXT.otherTabRemoved);
        return;
      }
      if (!drafts.isOwnKey(event.key)) return;
      if (event.newValue === null) {
        notify(TEXT.otherTabRemoved);
        return;
      }
      const record = drafts.parse(event.newValue);
      if (!record) return;
      notify(TEXT.otherTabSaved, {
        label: TEXT.loadOtherDraft,
        run: (trigger) => confirmReplacing({
          title: 'Open the newer draft?',
          message: 'The draft from the other tab replaces the model in this tab. Download YAML first to keep this tab\'s model.',
          confirmLabel: 'Open the newer draft',
          cancelLabel: 'Keep this tab\'s model',
          trigger,
        }).then((confirmed) => {
          if (!confirmed) return;
          baseline = record.text;
          mount(record.text, record.view);
          notify(TEXT.restored(describeTime(record.savedAt)));
          // The notice no longer has the button that had focus; focus moves to the first control that stays.
          ui.focusTarget.focus();
        }),
      });
    }

    // -- Examples and profile --

    function fillExamples() {
      (config.examples || []).forEach((example) => {
        const option = doc.createElement('option');
        option.value = example.id;
        option.textContent = example.label;
        ui.exampleSelect.append(option);
      });
      ui.profileSelect.value = profile;
      ui.controls.hidden = false;
    }

    function loadChosenExample(event) {
      const example = (config.examples || []).find((candidate) => candidate.id === ui.exampleSelect.value);
      if (!example) return;
      confirmReplacing({
        title: 'Load the example?',
        message: 'The example replaces the model in the editor. Your saved draft keeps your current model until you edit '
          + 'the example. Download YAML first if you want a file of your model.',
        confirmLabel: 'Load example',
        cancelLabel: 'Keep my model',
        trigger: event.currentTarget,
      }).then((confirmed) => {
        if (!confirmed) return;
        baseline = example.text;
        mount(example.text, null);
        notify(TEXT.exampleLoaded(example.label));
      });
    }

    function switchProfile() {
      const option = ui.profileSelect.selectedOptions[0];
      profile = ui.profileSelect.value;
      mount(editor.getText(), currentView);
      notify(TEXT.profileChanged(option.textContent.split(':')[0].toLowerCase()));
    }

    function destroy() {
      flushPendingWrite();
      listeners.abort();
      if (editor) editor.destroy();
      editor = null;
      ui.controls.hidden = true;
      ui.handoff.hidden = true;
      ui.notice.replaceChildren();
      ui.exampleSelect.replaceChildren();
    }

    fillExamples();
    on(ui.loadExample, 'click', loadChosenExample);
    on(ui.profileSelect, 'change', switchProfile);
    ui.handoffButtons.forEach((button) => on(button, 'click', () => chooseHandoff(button.dataset.c4EditorHandoffChoice, button)));
    on(win, 'storage', onStorage);
    on(win, 'pagehide', flushPendingWrite);
    try {
      open();
    } catch (error) {
      // An editor that cannot start leaves no page controls or listeners behind; mountEmbed shows the fallback.
      destroy();
      throw error;
    }

    return { destroy };
  }

  function standaloneElements(embed) {
    const find = (selector) => embed.querySelector(selector);
    return {
      controls: find('[data-c4-editor-controls]'),
      exampleSelect: find('[data-c4-editor-example]'),
      loadExample: find('[data-c4-editor-load-example]'),
      profileSelect: find('[data-c4-editor-profile]'),
      notice: find('[data-c4-editor-notice]'),
      handoff: find('[data-c4-editor-handoff]'),
      handoffButtons: [...embed.querySelectorAll('[data-c4-editor-handoff-choice]')],
      // After the handoff choice, focus moves to the first control that stays, the example list.
      get focusTarget() { return find('[data-c4-editor-example]'); },
    };
  }

  // ---- Page entry points ---------------------------------------------------------------------------------------

  /** Mounts every editor embed inside `scope` that is not mounted yet. */
  function initFrom(scope) {
    const embeds = scope.matches && scope.matches('[data-c4-editor]') ? [scope] : [...scope.querySelectorAll('[data-c4-editor]')];
    embeds.forEach((embed) => {
      if (mounted.has(embed)) return;
      try {
        mounted.set(embed, mountEmbed(embed, global));
      } catch (error) {
        global.console.error(error);
      }
    });
  }

  /** Destroys every editor inside `scope` and puts each embed's fallback back. */
  function destroyWithin(scope) {
    [...mounted.keys()].filter((embed) => scope === embed || scope.contains(embed)).forEach((embed) => {
      mounted.get(embed).destroy();
      mounted.delete(embed);
    });
  }

  global.SebookC4EditorSite = {
    initFrom,
    destroyWithin,
    readHandoff,
    createDraftStore,
    /** The host's `createSourceEditor` capability (spec §3.4) for this window. */
    createSourceEditor: (container, options) => createSiteSourceEditor(global, container, options),
  };

  // Deferred, after the editor scripts and uml-bundle.js: the document is parsed, so the embeds mount before the
  // page's diagram renderer would draw the fallback figures.
  if (global.ArchUMLC4Editor) {
    if (global.document.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', () => initFrom(global.document));
    else initFrom(global.document);
  }
})(window);
