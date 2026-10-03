(function (scope) {
  'use strict';
  const api = scope.SEBookSmalltalk;
  let nextId = 0;
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(label, action) {
    const control = element('button', '', label); control.type = 'button';
    control.addEventListener('click', () => { Promise.resolve(action()).catch(() => {}); }); return control;
  }
  const entityLabel = entity => [entity.packageName, entity.className, entity.side, entity.selector].filter(Boolean).join(' · ');

  /** Native catalog presentation only. The facade owns native preview tokens and mutations. */
  function mount({ root, workspace, refactorings, onApplied = async () => {} }) {
    const id = 'smalltalk-refactor-' + (++nextId);
    let disposed = false, generation = 0, busy = false, optionsChanged = false, recovered = false, operation = null, request = null, catalog = [], fields = [], preview = null, trigger = null;
    const toolbar = element('div', 'smalltalk-toolbar');
    const historyStatus = element('p', 'smalltalk-status'); historyStatus.setAttribute('role', 'status'); historyStatus.setAttribute('aria-label', 'Refactoring history');
    const undo = button('Undo refactoring', () => mutateHistory('undo'));
    const redo = button('Redo refactoring', () => mutateHistory('redo')); toolbar.append(undo, redo);
    const historyRegion = element('section', 'smalltalk-refactoring-history'); historyRegion.setAttribute('aria-label', 'Native refactoring history'); historyRegion.append(toolbar, historyStatus); root.append(historyRegion);
    const dialog = element('dialog', 'smalltalk-refactoring-dialog'); dialog.setAttribute('aria-labelledby', id + '-title');
    const title = element('h2', '', 'Native Smalltalk refactoring'); title.id = id + '-title';
    const context = element('p'); const revision = element('p');
    const form = element('form'); form.noValidate = true;
    const actionLabel = element('label', '', 'Refactoring action'); actionLabel.htmlFor = id + '-action';
    const actions = element('select'); actions.id = actionLabel.htmlFor;
    const guidance = element('p'); guidance.id = id + '-guidance'; actions.setAttribute('aria-describedby', guidance.id);
    const unavailable = element('details', 'smalltalk-unavailable-refactorings'); const unavailableList = element('ul');
    unavailable.append(element('summary', '', 'Unavailable refactoring actions'), unavailableList); unavailable.hidden = true;
    const inputs = element('div', 'smalltalk-refactoring-options');
    const status = element('p', 'smalltalk-status'); status.id = id + '-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-label', 'Refactoring status');
    const changes = element('section', 'smalltalk-refactoring-preview'); changes.setAttribute('aria-label', 'Native change preview'); changes.hidden = true;
    const previewButton = button('Preview refactoring', () => {}); previewButton.type = 'submit';
    const apply = button('Apply refactoring', applyPreview); apply.classList.add('smalltalk-action-primary'); apply.disabled = true;
    const cancel = button('Cancel', close);
    const controls = element('div', 'smalltalk-toolbar'); controls.append(previewButton, apply, cancel);
    form.append(actionLabel, actions, guidance, unavailable, inputs, status, changes, controls); dialog.append(title, context, revision, form); root.append(dialog);
    form.addEventListener('submit', event => { event.preventDefault(); if (!busy) void prepare(); });
    // Native modal behavior makes background inert; this also keeps Tab inside page controls.
    dialog.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const controls = [...dialog.querySelectorAll('button, input, textarea, select')].filter(node => !node.disabled && !node.hidden && node.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    dialog.addEventListener('cancel', event => { event.preventDefault(); void close(); });
    actions.addEventListener('change', () => { void chooseAction(); });
    const unsubscribe = workspace.subscribe(event => {
      if (event.type === 'history') updateHistory();
      if (event.type === 'runtime' && event.detail.type === 'recovered' && busy && dialog.open) recovered = true;
      if (event.type === 'program' && dialog.open) updateRevision();
    });
    updateHistory();

    function selectedAction() { return catalog.find(entry => entry.action === actions.value); }
    function updateHistory() {
      const state = refactorings.historyState(); undo.disabled = busy || !state.canUndo; redo.disabled = busy || !state.canRedo;
      historyStatus.textContent = state.reason || (state.canUndo ? 'Undo is available for the latest refactoring in this session.' : state.canRedo ? 'Redo is available in this session.' : 'No refactoring history in this session.');
    }
    function updateRevision() {
      const current = workspace.snapshot().revision;
      revision.textContent = 'Base revision ' + (preview ? preview.baseRevision : request.baseRevision) + ' · current revision ' + current;
      if (preview && current !== preview.baseRevision) {
        status.textContent = 'Accepted source changed. This preview is stale; cancel and open a new preview to review the current code.';
        apply.disabled = true;
      }
    }
    function setBusy(value) {
      busy = value; actions.disabled = value; fields.forEach(field => { field.control.disabled = value; });
      const entry = selectedAction();
      previewButton.disabled = value || !entry || !entry.applicable || !!request.selectionError && !!entry.options.selection;
      apply.disabled = value || optionsChanged || !preview || preview.baseRevision !== workspace.snapshot().revision; cancel.disabled = value && operation === 'apply';
      dialog.setAttribute('aria-busy', String(value)); updateHistory();
    }
    function failure(error) {
      if (disposed) return;
      status.textContent = (error.code === 'STALE_REVISION' ? 'Accepted source changed. Cancel and open a new preview. ' : 'Refactoring failed: ') + (error.message || String(error)) + (recovered ? ' Recovery restored the image and reset live handles. Inspect objects again before continuing.' : '');
      apply.disabled = true;
    }
    async function abandonPreview() {
      const old = preview; preview = null; apply.disabled = true; changes.hidden = true; changes.replaceChildren();
      if (old) await refactorings.cancel(old);
    }
    function addField(input, values) {
      const field = element('div', 'smalltalk-refactoring-field');
      const label = element('label', '', input.label);
      const control = element(input.type === 'source' || input.type.endsWith('-list') ? 'textarea' : 'input');
      control.id = id + '-input-' + input.name; label.htmlFor = control.id;
      const value = Object.prototype.hasOwnProperty.call(values, input.name) ? values[input.name] : input.default;
      if (input.type === 'boolean') { control.type = 'checkbox'; control.checked = value === true; }
      else { control.value = Array.isArray(value) ? value.join('\n') : value ?? ''; control.required = !!input.required && !input.type.endsWith('-list'); }
      const help = element('p'); help.id = control.id + '-help';
      if (input.required && input.type !== 'boolean' && !input.type.endsWith('-list')) help.textContent = 'Required.';
      if (input.type.endsWith('-list')) help.textContent = input.type === 'integer-list' ? 'Enter whole numbers separated by commas or new lines. Leave empty for an empty list.' : 'Enter one value per line. Leave empty for an empty list.';
      control.setAttribute('aria-describedby', help.id + ' ' + status.id);
      control.addEventListener('input', () => { if (preview) { optionsChanged = true; apply.disabled = true; status.textContent = 'Options changed. Preview again before applying.'; } });
      field.append(label, control, help); inputs.append(field); fields.push({ input, control });
    }
    async function chooseAction() {
      const current = ++generation; operation = 'options'; setBusy(true);
      try { await abandonPreview(); } catch (error) { failure(error); }
      if (disposed || current !== generation || !dialog.open) return;
      fields = []; inputs.replaceChildren(); status.textContent = '';
      const entry = selectedAction();
      if (entry) {
        guidance.textContent = !entry.applicable ? entry.reason : entry.options.selection ? entry.options.selection.label + '. ' + (request.selectionError || ('Selected source range ' + request.selection.start + '–' + request.selection.end + '.')) : 'Review the native changes before applying.';
        entry.options.inputs.forEach(input => addField(input, request.action === entry.action ? request.options || {} : {}));
      }
      operation = null; setBusy(false);
    }
    function readOptions() {
      const options = {};
      for (const { input, control } of fields) {
        control.removeAttribute('aria-invalid');
        if (input.type === 'boolean') { options[input.name] = control.checked; continue; }
        const value = control.value;
        if (input.type === 'integer-list') {
          const values = value.trim() ? value.split(/[,\n]/).map(each => each.trim()) : [];
          if (values.some(each => !/^-?\d+$/.test(each) || !Number.isSafeInteger(Number(each)))) return invalid(control, input.label + ': enter whole numbers separated by commas or new lines.');
          options[input.name] = values.map(Number);
        } else if (input.type === 'string-list') options[input.name] = value.trim() ? value.split(/\r?\n/).map(each => each.trim()).filter(Boolean) : [];
        else {
          if (input.required && !value.trim()) return invalid(control, input.label + ' is required. Enter a value before previewing.');
          options[input.name] = value;
        }
      }
      return options;
    }
    function invalid(control, message) { control.setAttribute('aria-invalid', 'true'); status.textContent = message; control.focus(); return null; }
    function renderMessages(label, messages) {
      changes.append(element('h3', '', label)); const list = element('ul');
      messages.forEach(message => list.append(element('li', '', message))); changes.append(list);
    }
    function renderPreview() {
      changes.hidden = false; changes.replaceChildren();
      renderMessages('Warnings', preview.warnings); renderMessages('Consequences', preview.consequences);
      changes.append(element('p', '', 'If Apply fails, recovery restores the image and resets live handles. Inspect objects again after recovery.'));
      preview.changes.entries.forEach(entry => {
        const section = element('section'); section.setAttribute('aria-label', entityLabel(entry.entity));
        section.append(element('h3', '', entityLabel(entry.entity)), element('p', '', 'Before'), element('pre', '', entry.before === null ? '(definition absent)' : entry.before), element('p', '', 'After'), element('pre', '', entry.after === null ? '(definition removed)' : entry.after)); changes.append(section);
      });
      updateRevision();
    }
    async function prepare() {
      if (busy || !selectedAction()?.applicable) return;
      const options = readOptions(); if (!options) return;
      const current = ++generation; recovered = false; operation = 'prepare'; setBusy(true); status.textContent = 'Preparing native preview…';
      try {
        await abandonPreview();
        if (disposed || current !== generation || !dialog.open) return;
        if (request.baseRevision !== workspace.snapshot().revision) throw api.runtimeError('STALE_REVISION', 'The selected source revision changed.');
        const prepared = await refactorings.prepare({ action: actions.value, target: request.target, options, ...(selectedAction().options.selection ? { selection: request.selection } : {}) });
        if (disposed || current !== generation || !dialog.open) { await refactorings.cancel(prepared).catch(() => {}); return; }
        if (prepared.baseRevision !== request.baseRevision || prepared.baseRevision !== workspace.snapshot().revision) { await refactorings.cancel(prepared); throw api.runtimeError('STALE_REVISION', 'The source changed while preparing this selection.'); }
        preview = prepared;
        optionsChanged = false; renderPreview(); status.textContent = 'Preview ready. Review every changed definition, warning and consequence.';
      } catch (error) { if (current === generation) failure(error); }
      finally { if (!disposed && current === generation) { operation = null; setBusy(false); } }
    }
    async function applyPreview() {
      if (busy || apply.disabled || !preview) return;
      const submitted = preview, current = ++generation;
      recovered = false; operation = 'apply'; setBusy(true); status.textContent = 'Applying native changes…';
      try {
        await refactorings.apply(submitted);
        if (disposed || current !== generation) return;
        preview = null;
        await onApplied({ request, preview: submitted });
        if (disposed || current !== generation) return;
        operation = null; setBusy(false);
        historyStatus.textContent = 'Refactoring applied once. Undo is available in this session.';
        finishClose();
      } catch (error) {
        if (!disposed && current === generation) { failure(error); preview = null; }
      } finally {
        if (!disposed && current === generation) { operation = null; setBusy(false); }
      }
    }
    async function mutateHistory(action) {
      if (busy) return;
      const control = action === 'undo' ? undo : redo, ownedFocus = document.activeElement === control;
      busy = true; updateHistory();
      let errorMessage = null;
      try { await refactorings[action](); }
      catch (error) { errorMessage = 'History change failed: ' + (error.message || String(error)); }
      finally {
        busy = false;
        if (!disposed) {
          updateHistory(); if (errorMessage) historyStatus.textContent = errorMessage;
          if (ownedFocus && [control, document.body, document.documentElement].includes(document.activeElement)) {
            const destination = [control, action === 'undo' ? redo : undo, root].find(node => node.isConnected && !node.disabled);
            if (destination) destination.focus();
          }
        }
      }
    }
    function finishClose() {
      generation++; dialog.close();
      if (trigger && trigger.isConnected && !trigger.disabled) trigger.focus();
      else if (root.isConnected) root.focus();
    }
    async function close() {
      if (operation === 'apply') return;
      const abandoned = preview; preview = null; changes.hidden = true;
      operation = null; setBusy(false); finishClose();
      // Pending Prepare owns its eventual token and cancels it after generation mismatch.
      // An already rendered token is canceled through this view's original facade.
      if (abandoned) {
        try { await refactorings.cancel(abandoned); }
        catch (error) { if (!disposed) historyStatus.textContent = 'Preview cancellation failed: ' + (error.message || String(error)); }
      }
    }
    return {
      async open(nextRequest) {
        if (disposed || busy || dialog.open) return;
        trigger = document.activeElement; optionsChanged = false; request = { selection: { start: 0, end: 0 }, ...nextRequest, baseRevision: nextRequest.baseRevision ?? workspace.snapshot().revision };
        if (!request.selection || request.selection.start === request.selection.end) request.selectionError = request.selectionError || 'Select a nonempty source range, then open Refactor again.';
        dialog.showModal(); context.textContent = entityLabel(request.target); revision.textContent = 'Base revision ' + request.baseRevision;
        operation = 'catalog'; setBusy(true); status.textContent = 'Loading native catalog…';
        const current = ++generation;
        try {
          catalog = await refactorings.catalog(request.target);
          if (disposed || current !== generation) return;
          actions.replaceChildren(...catalog.map(entry => { const option = new Option(entry.label + (entry.applicable ? '' : ' — unavailable'), entry.action); option.disabled = !entry.applicable; return option; }));
          unavailableList.replaceChildren(...catalog.filter(entry => !entry.applicable).map(entry => element('li', '', entry.label + ': ' + entry.reason))); unavailable.hidden = !unavailableList.children.length;
          actions.value = request.action || catalog.find(entry => entry.applicable)?.action || '';
          await chooseAction(); if (!disposed && dialog.open) actions.focus();
        } catch (error) { if (!disposed && current === generation) { failure(error); operation = null; setBusy(false); } }
      },
      dispose() { disposed = true; generation++; unsubscribe(); if (dialog.open) dialog.close(); if (preview) void refactorings.cancel(preview).catch(() => {}); dialog.remove(); historyRegion.remove(); },
    };
  }
  api.RefactoringView = { mount };
})(window);
