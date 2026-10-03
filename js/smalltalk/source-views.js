(function (scope) {
  'use strict';
  const api = scope.SEBookSmalltalk;
  let mountId = 0;
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(text, action) {
    const node = element('button', '', text); node.type = 'button';
    node.addEventListener('click', action); return node;
  }
  function entityLabel(target) {
    return [target.kind, target.path || target.packageName, target.className, target.className && (target.side || 'instance') + ' side', target.selector || target.protocol].filter(Boolean).join(' \u00b7 ');
  }

  /** Presents durable source through Workspace; open focuses the view, dispose releases its editor/subscription. */
  function mount({ root, workspace, createEditor, onClose, onDetachFile }) {
    const id = 'smalltalk-source-views-' + (++mountId);
    const view = element('section', 'smalltalk-source-views'); view.setAttribute('aria-label', 'Browser source views'); view.tabIndex = -1; view.hidden = true;
    let disposed = false, mode = 'files', selectedTarget = null, busy = false, downloadURL = null;
    const controls = element('div', 'smalltalk-toolbar');
    const tabs = [['files', 'Source files'], ['changes', 'Accepted changes'], ['drafts', 'Saved drafts']].map(([key, label]) => {
      const control = button(label, () => { mode = key; selectedTarget = null; status.textContent = ''; refresh(); view.focus(); });
      controls.append(control); return { key, control };
    });
    controls.append(button('Browse image', () => { view.hidden = true; onClose(); }));
    const heading = element('h3', '', 'Source files'); const explanation = element('p');
    const list = element('ul', 'smalltalk-source-view-list');
    const source = element('section', 'smalltalk-saved-source'); source.setAttribute('aria-label', 'Selected saved source');
    const sourceHeading = element('h4'); const state = element('p');
    const editorHost = element('div', 'smalltalk-source-editor'); editorHost.inert = true;
    const preview = element('pre', 'smalltalk-source-preview');
    const resource = element('pre'); resource.hidden = true;
    const editingControls = element('div', 'smalltalk-toolbar');
    const accept = button('Accept file', () => acceptFile()); accept.classList.add('smalltalk-action-primary');
    const revert = button('Revert draft', revertDraft);
    const downloadDraft = button('Download draft source', () => {
      const draft = selectedDraft(); if (draft) download(draft.source, 'recovered-draft.st', 'text/plain');
    });
    editingControls.append(accept, revert, downloadDraft);
    const detach = onDetachFile && button('Detach source file', () => onDetachFile(selectedTarget.path));
    if (detach) editingControls.append(detach);
    source.append(sourceHeading, state, editorHost, preview, resource, editingControls);
    const changeSource = element('pre', 'smalltalk-accepted-source'); changeSource.tabIndex = 0; changeSource.setAttribute('role', 'region'); changeSource.setAttribute('aria-label', 'Accepted native change source');
    const exportControl = button('Export accepted program', () => download(JSON.stringify(workspace.snapshot(), null, 2) + '\n', 'accepted-program.json', 'application/json'));
    const exportControls = element('div', 'smalltalk-toolbar'); exportControls.append(exportControl);
    const status = element('p', 'smalltalk-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-label', 'Source view status'); status.id = id + '-status';
    view.append(controls, heading, explanation, list, source, changeSource, exportControls, status); root.append(view);
    const editor = createEditor({ element: editorHost, value: '', language: 'smalltalk', ariaLabel: 'Smalltalk file or saved draft source', onChange: editSource });
    const unsubscribe = workspace.subscribe(event => {
      if (!disposed && ['program', 'drafts'].includes(event.type)) refresh();
    });
    function selectedDraft() { return selectedTarget && workspace.getDrafts().find(draft => api.entityKey(draft.target) === api.entityKey(selectedTarget)); }
    function selectedFile() { return selectedTarget && selectedTarget.kind === 'file' && workspace.snapshot().files.find(file => file.path === selectedTarget.path); }
    function select(target) { selectedTarget = { ...target }; status.textContent = ''; refresh(); source.focus(); }
    source.tabIndex = -1;
    function refresh() {
      if (disposed) return;
      const focusedChoice = list.contains(document.activeElement) ? document.activeElement.dataset.sourceChoice : null;
      const program = workspace.snapshot(); const drafts = workspace.getDrafts();
      view.classList.toggle('is-accepted-change-view', mode === 'changes');
      tabs.forEach(({ key, control }) => control.setAttribute('aria-pressed', String(key === mode)));
      heading.textContent = { files: 'Source files', changes: 'Accepted changes', drafts: 'Saved drafts' }[mode];
      explanation.textContent = {
        files: 'Authored files load in this order, followed by accepted native changes. Select a file to review its draft. Accept uses its existing source format.',
        changes: 'Durable accepted code only. Export includes authored files and native changes; unfinished drafts and live objects are excluded.',
        drafts: 'Saved source can be copied or downloaded for deliberate recovery. Its original target may have been renamed or removed; it has not been rebased.'
      }[mode];
      list.replaceChildren();
      if (mode === 'files') program.files.forEach(file => addChoice(file.path, { kind: 'file', path: file.path }));
      if (mode === 'drafts') drafts.forEach(draft => addChoice(entityLabel(draft.target), draft.target));
      if (mode === 'changes') program.changes.entries.forEach(entry => {
        list.append(element('li', '', entityLabel(entry.entity) + ' \u00b7 ' + (entry.after === null ? 'removed' : entry.before === null ? 'added' : 'changed')));
      });
      if (!list.children.length) list.append(element('li', '', mode === 'drafts' ? 'No saved drafts.' : mode === 'changes' ? 'No accepted native changes.' : 'No authored files.'));
      changeSource.hidden = mode !== 'changes'; changeSource.textContent = program.changes.source || 'No accepted native change source.';
      source.hidden = mode === 'changes' || !selectedTarget;
      if (!source.hidden) refreshSelected(program);
      if (focusedChoice) restoreChoiceFocus(focusedChoice);
    }
    function addChoice(label, target) {
      const entry = element('li'); const control = button(label, () => select(target));
      control.dataset.sourceChoice = api.entityKey(target);
      control.setAttribute('aria-pressed', String(!!selectedTarget && api.entityKey(target) === api.entityKey(selectedTarget)));
      entry.append(control); list.append(entry);
    }
    function restoreChoiceFocus(identity) {
      const choice = Array.from(list.querySelectorAll('button')).find(control => control.dataset.sourceChoice === identity);
      const tab = tabs.find(({ key }) => key === mode).control;
      const destination = [choice, tab, view].find(control => control && !control.disabled && !control.closest('[inert]') && control.getClientRects().length && getComputedStyle(control).visibility === 'visible');
      if (destination) destination.focus();
    }
    function refreshSelected(program) {
      const draft = selectedDraft(); const file = selectedFile();
      if (!draft && !file) {
        selectedTarget = null; source.hidden = true; editorHost.inert = true;
        editor.setValue(''); preview.textContent = ''; resource.textContent = ''; return;
      }
      if (detach) detach.hidden = !file;
      const resourceFile = file && file.kind === 'resource';
      const value = draft ? draft.source : file.content;
      sourceHeading.textContent = entityLabel(selectedTarget);
      state.textContent = file ? file.kind + (file.format ? ' \u00b7 ' + file.format : '') + ' \u00b7 ' : '';
      state.textContent += draft ? 'Unaccepted draft \u00b7 base revision ' + draft.baseRevision : 'Accepted file \u00b7 revision ' + program.revision;
      if (draft && draft.baseRevision !== program.revision) state.textContent += ' \u00b7 Stale: accepted code changed. Keep or download this source for review; its base revision is preserved.';
      if (resourceFile) state.textContent += ' \u00b7 Resources are data, not executable Smalltalk source; editing is unavailable here.';
      else if (!file) state.textContent += ' \u00b7 Recovery source only. Use the image Browser for a target that still exists, or download this draft before adapting it.';
      const editable = !resourceFile;
      editorHost.hidden = !editable; editorHost.inert = busy || !editable;
      resource.hidden = editable; resource.textContent = editable ? '' : value;
      if (editor.getValue() !== value.replace(/\r\n?/g, '\n')) editor.setValue(value);
      preview.hidden = !editable; preview.textContent = editable ? value : '';
      accept.disabled = busy || !file || file.kind !== 'source' || !draft || draft.baseRevision !== program.revision;
      revert.disabled = busy || !draft; downloadDraft.disabled = !draft;
    }
    function editSource(value) {
      if (!selectedTarget || disposed || busy) return;
      const file = selectedFile(); if (file && file.kind !== 'source') return;
      const draft = selectedDraft();
      if (file && value === file.content.replace(/\r\n?/g, '\n')) workspace.revertDraft(selectedTarget);
      else workspace.setDraft({ target: selectedTarget, baseRevision: draft ? draft.baseRevision : workspace.snapshot().revision, source: value });
    }
    async function acceptFile() {
      const draft = selectedDraft(); const file = selectedFile();
      if (!draft || !file || accept.disabled) return;
      const hadFocus = document.activeElement === accept;
      busy = true; refresh(); status.textContent = 'Compiling file…';
      try {
        await workspace.commit({ baseRevision: draft.baseRevision, action: 'acceptFile', params: { target: draft.target, file: { ...file, content: draft.source } } });
        if (!disposed) status.textContent = 'Accepted file. Live code and fresh replay use this accepted program.';
      } catch (error) {
        if (!disposed) status.textContent = 'Source error: ' + (error.message || String(error)) + ' Draft retained; edit it or revert to accepted source.';
      } finally {
        busy = false;
        if (!disposed) {
          refresh();
          if (hadFocus && [document.body, document.documentElement].includes(document.activeElement)) (accept.disabled ? view : accept).focus();
        }
      }
    }
    function revertDraft() {
      if (!selectedTarget || busy) return;
      const ownedFocus = document.activeElement === revert;
      workspace.revertDraft(selectedTarget); refresh(); status.textContent = 'Draft reverted; accepted code is unchanged.';
      if (ownedFocus) view.focus();
    }
    function download(content, filename, type) {
      if (downloadURL) URL.revokeObjectURL(downloadURL);
      downloadURL = URL.createObjectURL(new Blob([content], { type }));
      const link = element('a'); link.href = downloadURL; link.download = filename;
      view.append(link); link.click(); link.remove();
    }
    refresh();
    return { open({ path } = {}) { if (path) { mode = 'files'; selectedTarget = { kind: 'file', path }; } view.hidden = false; refresh(); view.focus(); }, dispose() {
      disposed = true; unsubscribe(); editor.dispose(); if (downloadURL) URL.revokeObjectURL(downloadURL); view.remove();
    } };
  }
  api.SourceViews = { mount };
})(window);
