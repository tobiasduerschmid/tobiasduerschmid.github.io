(function (scope) {
  'use strict';
  const api = scope.SEBookSmalltalk;
  let mountId = 0;
  const paneKinds = ['packages', 'classes', 'protocols', 'methods'];
  const paneNames = ['Packages', 'Classes', 'Protocols', 'Methods'];
  const sameEntity = (left, right) => !!left && !!right && api.entityKey(left) === api.entityKey(right);
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

  /** The view owns navigation and editor presentation; Workspace owns all Smalltalk semantics. */
  function mount({ root, workspace, createEditor, refactorings, onDetach, onDetachFile, compact = false, focusControl }) {
    const id = 'smalltalk-browser-' + (++mountId);
    const view = element('section', 'smalltalk-browser'); view.setAttribute('aria-label', 'Smalltalk System Browser'); view.tabIndex = -1;
    root.append(view);
    let disposed = false, navigationGeneration = 0, queryGeneration = 0;
    let target = null, sourceTarget = null, acceptedSource = '', nativeSource = '', sourceRevision = 0, editingBusy = false;
    let history = [], historyIndex = -1;
    const panes = [];
    const heading = element('h2', '', 'System Browser'); view.append(heading);
    const navigation = element('div', 'smalltalk-toolbar');
    const back = button('Back', () => travel(-1)); const forward = button('Forward', () => travel(1));
    const breadcrumb = element('p', 'smalltalk-breadcrumb', 'Choose a package to browse the image.');
    navigation.append(back, forward);
    const detach = onDetach && button('Detach System Browser', () => onDetach(target && { ...target }));
    if (detach) navigation.append(detach); view.append(navigation, breadcrumb);
    const mobileNavigation = element('nav', 'smalltalk-pane-navigation'); mobileNavigation.setAttribute('aria-label', 'Browser panes');
    const grid = element('div', 'smalltalk-browser-panes');
    // Fieldset's anonymous layout differs between engines; the compact group
    // keeps its visible caption in the same flex row with equivalent semantics.
    const sideGroup = element(compact ? 'div' : 'fieldset', 'smalltalk-side');
    const sideCaption = element(compact ? 'span' : 'legend', 'smalltalk-side-caption', 'Method side');
    sideGroup.append(sideCaption);
    if (compact) { sideCaption.id = id + '-side-caption'; sideGroup.setAttribute('role', 'group'); sideGroup.setAttribute('aria-labelledby', sideCaption.id); }
    let side = 'instance';
    for (const name of ['instance', 'class']) {
      const label = element('label'); const radio = element('input'); radio.type = 'radio'; radio.name = id + '-side'; radio.value = name;
      radio.checked = name === side; label.append(radio, document.createTextNode(name === 'instance' ? ' Instance' : ' Class'));
      radio.addEventListener('change', () => {
        side = name;
        if (target && target.className) run(navigate({ kind: 'class', className: target.className, packageName: target.packageName, side }));
      }); sideGroup.append(label);
    }
    const header = element('div', 'smalltalk-browser-header'); header.append(heading, navigation, sideGroup); view.prepend(header);
    view.append(mobileNavigation, grid);
    const creationToolbar = element('div', 'smalltalk-toolbar smalltalk-creation-toolbar');
    const createPackage = button('Create package', () => {
      packageForm.hidden = false; packageRevision = workspace.snapshot().revision; packageName.focus();
    });
    const creationButtons = [];
    for (const [label, action] of [['Add class', 'addClass'], ['Add method', 'addMethod'], ['Remove class', 'removeClass'], ['Remove method', 'removeMethod']]) {
      const control = button(label, () => run(openDefinitionAction(action))); control.disabled = true;
      creationButtons.push({ control, action });
      if (api.FEATURES.refactorings) creationToolbar.append(control);
    }
    creationToolbar.prepend(createPackage); view.append(creationToolbar);
    const packageForm = element('form', 'smalltalk-package-form'); packageForm.hidden = true;
    const packageLabel = element('label', '', 'New package name'), packageName = element('input');
    packageName.id = id + '-new-package'; packageLabel.htmlFor = packageName.id; packageName.required = true;
    const savePackage = button('Save package', () => {}); savePackage.type = 'submit';
    function focusPackageOrigin() {
      const closedTools = createPackage.closest('details:not([open])');
      (closedTools ? closedTools.querySelector('summary') : createPackage).focus();
    }
    const cancelPackage = button('Cancel package creation', () => { packageForm.hidden = true; focusPackageOrigin(); });
    const packageStatus = element('p', 'smalltalk-status'); packageStatus.setAttribute('role', 'status'); packageStatus.setAttribute('aria-label', 'Package status');
    let packageRevision = 0;
    packageForm.append(packageLabel, packageName, savePackage, cancelPackage, packageStatus); view.append(packageForm);
    packageForm.addEventListener('submit', event => { event.preventDefault(); run(saveNewPackage()); });
    paneKinds.forEach((kind, index) => {
      const section = element('section', 'smalltalk-browser-pane' + (index === 0 ? ' is-current-pane' : ''));
      section.setAttribute('aria-label', paneNames[index]);
      const form = element('form', 'smalltalk-pane-search');
      const searchLabel = element('label', '', 'Search ' + kind); const search = element('input'); search.type = 'search';
      search.id = id + '-' + kind + '-search'; searchLabel.htmlFor = search.id;
      const searchButton = button('Search', () => {}); searchButton.type = 'submit'; form.append(searchLabel, search, searchButton);
      const listLabel = element('label', '', paneNames[index]); const list = element('select', 'smalltalk-pane-list');
      list.id = id + '-' + kind; listLabel.htmlFor = list.id; list.size = 3;
      const next = button('Next', () => run(loadPane(index, panes[index].parent, panes[index].nextOffset)));
      next.classList.add('smalltalk-pane-next');
      next.setAttribute('aria-label', 'Next ' + kind);
      next.hidden = true;
      const pane = { kind, section, search, list, next, items: [], parent: null, nextOffset: null, request: 0 };
      panes.push(pane); form.addEventListener('submit', event => { event.preventDefault(); run(loadPane(index, pane.parent)); });
      list.addEventListener('change', () => {
        const item = pane.items.find(entry => entry.id === list.value);
        if (item && item.target) run(navigate(item.target));
      });
      const paneHeader = element('div', 'smalltalk-pane-header'); paneHeader.append(listLabel, next);
      if (compact) {
        const nextIcon = element('span', '', '›'); nextIcon.setAttribute('aria-hidden', 'true'); next.replaceChildren(nextIcon);
        const searchDetails = element('details', 'smalltalk-pane-search-disclosure');
        const summary = element('summary', '', 'Search'); summary.setAttribute('aria-label', 'Search ' + kind);
        searchDetails.append(summary, form); paneHeader.append(searchDetails); section.append(paneHeader, list);
      } else section.append(paneHeader, form, list);
      grid.append(section);
      mobileNavigation.append(button(paneNames[index], () => showPane(index)));
      clearPane(index, index ? 'Choose ' + paneNames[index - 1].toLowerCase() + ' first.' : 'Loading packages…');
    });
    const queryToolbar = element('div', 'smalltalk-toolbar smalltalk-query-toolbar'); queryToolbar.setAttribute('aria-label', 'Native browsing queries');
    const queryDetails = element('details', 'smalltalk-query-disclosure'); queryDetails.append(element('summary', '', 'More browsing queries'));
    const secondaryQueries = element('div', 'smalltalk-toolbar'); queryDetails.append(secondaryQueries);
    const queryButtons = [];
    for (const [label, kind] of [['Senders', 'senders'], ['Implementors', 'implementors'], ['Hierarchy', 'hierarchy'], ['Variable references', 'variables'], ['Versions', 'versions']]) {
      const control = button(label, () => run(query(kind, label))); control.disabled = true; queryButtons.push({ control, kind });
      (['senders', 'implementors'].includes(kind) ? queryToolbar : secondaryQueries).append(control);
    }
    const definition = button('Class definition', () => run(openClassSource('class')));
    const comment = button('Class comment', () => run(openClassSource('comment'))); definition.disabled = true; comment.disabled = true;
    const sourceViewsButton = button('Source views', () => {
      queryGeneration++;
      [header, grid, mobileNavigation, queryToolbar, creationToolbar, packageForm, sourceRegion, queryRegion, navigation, sideGroup, breadcrumb].forEach(node => { node.hidden = true; });
      sourceViews.open();
    });
    secondaryQueries.append(definition, comment, sourceViewsButton); queryToolbar.append(queryDetails); view.append(queryToolbar);
    if (compact) {
      const tools = element('details', 'smalltalk-browser-tools'); tools.append(element('summary', '', 'Browser tools'), creationToolbar, queryToolbar);
      if (detach) tools.append(detach);
      header.append(tools);
    }
    const queryRegion = element('section', 'smalltalk-query-results'); queryRegion.setAttribute('aria-label', 'Native query results'); queryRegion.tabIndex = -1; queryRegion.hidden = true;
    const queryTitle = element('h3'); const queryList = element('ul'); const queryStatus = element('p'); queryStatus.setAttribute('role', 'status'); queryStatus.setAttribute('aria-label', 'Query status');
    let queryOrigin = null, querySessionTarget = null, querySessionVariable = null;
    const queryClose = button('Close query results', () => {
      const ownedFocus = queryRegion.contains(document.activeElement);
      queryRegion.hidden = true; queryGeneration++; if (compact) grid.hidden = false;
      const destination = [queryOrigin, sourceRegion, view].find(node => node && !node.disabled &&
        !node.closest('[inert], details:not([open])') && node.getClientRects().length > 0 && getComputedStyle(node).visibility === 'visible');
      if (ownedFocus && destination) destination.focus();
    });
    const queryNext = button('Next results', () => run(query(queryRegion.dataset.kind, queryTitle.textContent, { offset: Number(queryRegion.dataset.offset) })));
    queryRegion.append(queryTitle, queryClose, queryStatus, queryList, queryNext); view.append(queryRegion);
    const sourceRegion = element('section', 'smalltalk-source'); sourceRegion.setAttribute('aria-label', 'Method source'); sourceRegion.tabIndex = -1;
    const sourceHeading = element('h3', '', 'Method source'); const sourceState = element('p', 'smalltalk-source-state', 'Select a method, class definition, or class comment.');
    const editorHost = element('div', 'smalltalk-source-editor'); editorHost.inert = true;
    const sourcePreview = element('pre', 'smalltalk-source-preview');
    const compilation = element('p', 'smalltalk-status'); compilation.setAttribute('role', 'status'); compilation.setAttribute('aria-label', 'Compilation status');
    const editingToolbar = element('div', 'smalltalk-toolbar');
    const accept = button('Accept', () => run(acceptSource())); const revert = button('Revert', () => run(revertSource())); accept.classList.add('smalltalk-action-primary'); accept.disabled = true; revert.disabled = true;
    const refactor = button('Refactor', () => run(openRefactoring())); refactor.disabled = true;
    editingToolbar.append(accept, revert);
    if (focusControl) editingToolbar.append(focusControl);
    if (api.FEATURES.refactorings) editingToolbar.append(refactor);
    const sourceHeader = element('div', 'smalltalk-source-header'); sourceHeader.append(sourceHeading, sourceState, editingToolbar);
    sourceRegion.append(sourceHeader, editorHost, sourcePreview, compilation); view.append(sourceRegion);
    const editor = createEditor({ element: editorHost, value: '', language: 'smalltalk', ariaLabel: 'Smalltalk method source', onChange: changedSource });
    const sourceViews = api.SourceViews.mount({ root: view, workspace, createEditor, onDetachFile, onClose() {
      [header, grid, mobileNavigation, queryToolbar, creationToolbar, sourceRegion, navigation, sideGroup, breadcrumb].forEach(node => { node.hidden = false; });
      sourceViewsButton.focus();
    } });
    const refactoringView = api.FEATURES.refactorings && refactorings && api.RefactoringView.mount({ root: view, workspace, refactorings, onApplied: refactoringApplied });
    const unsubscribe = workspace.subscribe(event => {
      if (event.type === 'drafts' && sourceTarget && !editingBusy) {
        const draft = workspace.getDrafts().find(entry => sameEntity(entry.target, sourceTarget));
        if (draft && editor.getValue() !== draft.source.replace(/\r\n?/g, '\n')) {
          editor.setValue(draft.source); sourcePreview.textContent = draft.source;
        } else if (!draft) {
          if (sourceRevision === workspace.snapshot().revision) {
            if (editor.getValue() !== acceptedSource) editor.setValue(acceptedSource);
            sourcePreview.textContent = acceptedSource;
          } else {
            // The removed draft may refer to a renamed/deleted native target.
            // loadSource consults current drafts again when its reply arrives.
            sourceRegion.setAttribute('aria-busy', 'true'); updateSourceState();
            sourceState.textContent = 'Loading accepted source…';
            run(refreshSource()); return;
          }
        }
      }
      if (event.type === 'drafts' || event.type === 'program') updateSourceState();
      if (event.type === 'program' && sourceTarget && !editingBusy) run(refreshSource());
    });
    updateHistory();
    const ready = loadPane(0).catch(showError);

    function run(promise) { promise.catch(showError); }
    function showError(error) { if (!disposed) compilation.textContent = 'Compilation error: ' + (error.message || String(error)); }
    function showPane(index) { panes.forEach((pane, position) => pane.section.classList.toggle('is-current-pane', position === index)); }
    function clearPane(index, message) {
      const pane = panes[index]; pane.request++; pane.items = []; pane.list.replaceChildren(new Option(message, '')); pane.list.disabled = true; pane.next.hidden = true;
    }
    async function loadPane(index, parent, offset = 0) {
      const pane = panes[index]; const request = ++pane.request; pane.parent = parent;
      const result = await workspace.browse({ kind: pane.kind, ...(parent ? { target: parent } : {}), search: pane.search.value, offset, limit: 100 });
      if (disposed || request !== pane.request) return;
      const ownedFocus = document.activeElement === pane.next;
      const selectedId = offset ? pane.list.value : '';
      pane.items = offset ? [...new Map(pane.items.concat(result.items).map(item => [item.id, item])).values()] : result.items;
      pane.list.replaceChildren(...pane.items.map(item => new Option(item.label, item.id)));
      if (!pane.items.length) pane.list.append(new Option('No matching ' + pane.kind, ''));
      pane.list.disabled = !pane.items.length; pane.list.value = selectedId;
      pane.nextOffset = result.nextOffset; pane.next.hidden = result.nextOffset === null;
      if (ownedFocus && pane.next.hidden) (pane.list.disabled ? view : pane.list).focus();
    }
    function selectPane(index, selectedTarget) {
      const pane = panes[index]; let item = pane.items.find(entry => sameEntity(entry.target, selectedTarget));
      if (!item && selectedTarget && selectedTarget.kind === ['package', 'class', 'protocol', 'method'][index]) {
        const label = selectedTarget.selector || selectedTarget.protocol || selectedTarget.className || selectedTarget.packageName;
        if (label) { item = { id: label, label, target: { ...selectedTarget } }; pane.items.unshift(item); pane.list.prepend(new Option(label, label)); pane.list.disabled = false; }
      }
      if (item) pane.list.value = item.id;
    }
    async function navigate(nextTarget, { record = true } = {}) {
      const generation = ++navigationGeneration;
      editorHost.inert = true; sourceRegion.setAttribute('aria-busy', 'true'); sourceTarget = null; updateSourceState();
      const previousTarget = target;
      target = Object.fromEntries(Object.entries(nextTarget).filter(([, value]) => value !== undefined));
      if (target.className && !target.packageName) {
        const classes = await workspace.browse({ kind: 'classes', search: target.className, offset: 0, limit: 100 });
        if (disposed || generation !== navigationGeneration) return;
        const classItem = classes.items.find(item => item.target && item.target.className === target.className);
        if (classItem) target = { ...classItem.target, ...target };
      }
      if (target.kind === 'method' && previousTarget && target.className === previousTarget.className && !target.protocol && previousTarget.protocol) target.protocol = previousTarget.protocol;
      side = target.side || side;
      sideGroup.querySelectorAll('input').forEach(radio => { radio.checked = radio.value === side; });
      if (record) { history = history.slice(0, historyIndex + 1); history.push({ ...target }); historyIndex = history.length - 1; updateHistory(); }
      breadcrumb.textContent = [target.packageName, target.className, target.className && side + ' side', target.protocol, target.selector].filter(Boolean).join(' → ');
      updateQueryButtons();
      const packageItem = panes[0].items.find(item => item.id === panes[0].list.value);
      const knownClass = panes[1].items.some(item => sameEntity(item.target, { kind: 'class', className: target.className, side: 'instance' }));
      const packageScope = target.packageName ? { kind: 'package', packageName: target.packageName } : knownClass && packageItem ? packageItem.target : null;
      const scopeTargets = [packageScope,
        target.className ? { kind: 'class', className: target.className, ...(target.packageName ? { packageName: target.packageName } : {}), side } : null,
        target.protocol ? { kind: 'protocol', className: target.className, side, protocol: target.protocol } : target.className ? { kind: 'class', className: target.className, side } : null];
      if (scopeTargets[0]) selectPane(0, scopeTargets[0]);
      for (let index = 1; index < 4; index++) {
        const parent = scopeTargets[index - 1];
        if (!parent && index === 1 && target.className) { await loadPane(index); selectPane(index, scopeTargets[index]); continue; }
        if (!parent) { clearPane(index, 'Choose ' + paneNames[index - 1].toLowerCase() + ' first.'); continue; }
        await loadPane(index, parent);
        if (disposed || generation !== navigationGeneration) return;
        selectPane(index, index === 3 ? target : scopeTargets[index]);
      }
      const chosenPane = { package: 1, class: 2, protocol: 3, method: 3 }[target.kind]; showPane(chosenPane === undefined ? 0 : chosenPane);
      if (['method', 'class', 'comment'].includes(target.kind)) await loadSource(target, generation);
      else { sourceTarget = null; acceptedSource = ''; editor.setValue(''); sourcePreview.textContent = ''; sourceRegion.removeAttribute('aria-busy'); updateSourceState(); }
    }
    async function loadSource(nextTarget, generation = navigationGeneration) {
      const result = await workspace.browse({ kind: 'source', target: nextTarget, offset: 0, limit: 1 });
      if (disposed || generation !== navigationGeneration) return;
      sourceTarget = { ...nextTarget }; nativeSource = result.source || ''; acceptedSource = nativeSource.replace(/\r\n?/g, '\n'); sourceRevision = result.revision;
      const draft = workspace.getDrafts().find(entry => sameEntity(entry.target, sourceTarget));
      const value = draft ? draft.source : acceptedSource; editor.setValue(value); sourcePreview.textContent = value; editorHost.inert = false; sourceRegion.removeAttribute('aria-busy');
      sourceHeading.textContent = nextTarget.kind === 'method' ? 'Method source' : nextTarget.kind === 'class' ? 'Class definition' : 'Class comment';
      updateSourceState();
    }
    async function refreshSource() {
      const selected = { ...sourceTarget }, generation = navigationGeneration;
      try { await loadSource(selected, generation); }
      catch (error) {
        if (disposed || generation !== navigationGeneration) return;
        const retainedDraft = workspace.getDrafts().find(entry => sameEntity(entry.target, selected));
        if (error.code === 'PRECONDITION_FAILED' && retainedDraft) {
          sourceTarget = selected; editor.setValue(retainedDraft.source); sourcePreview.textContent = retainedDraft.source;
          editorHost.inert = false; sourceRegion.removeAttribute('aria-busy'); updateSourceState();
          compilation.textContent = 'Accepted source changed. This draft keeps its original target for recovery; Accept cannot overwrite the renamed or removed definition.';
        } else if (error.code === 'PRECONDITION_FAILED' && selected.kind === 'method') {
          await navigate({ ...selected, kind: 'class', selector: undefined, protocol: undefined });
          compilation.textContent = 'The selected method was removed. Browse its class to choose current source.';
        } else if (error.code === 'PRECONDITION_FAILED' && ['class', 'comment'].includes(selected.kind)) await navigate({ kind: 'package', packageName: selected.packageName });
        else throw error;
      }
    }
    function changedSource(value) {
      if (!sourceTarget || disposed) return;
      sourcePreview.textContent = value;
      const existing = workspace.getDrafts().find(entry => sameEntity(entry.target, sourceTarget));
      if (value === acceptedSource) workspace.revertDraft(sourceTarget);
      else workspace.setDraft({ target: sourceTarget, baseRevision: existing ? existing.baseRevision : sourceRevision, source: value });
    }
    function updateSourceState() {
      const draft = sourceTarget && workspace.getDrafts().find(entry => sameEntity(entry.target, sourceTarget));
      const revision = workspace.snapshot().revision;
      sourceState.textContent = sourceRegion.getAttribute('aria-busy') === 'true' && !sourceTarget ? 'Loading selected source…' : sourceTarget ? (draft ? 'Unaccepted draft' : 'Accepted source') + ' · revision ' + revision + (draft && draft.baseRevision !== revision ? ' · Accepted code changed; this draft needs review.' : '') : 'Select a method, class definition, or class comment.';
      accept.disabled = editingBusy || !sourceTarget || !draft; revert.disabled = editingBusy || !draft;
      refactor.disabled = !refactoringView || editingBusy || !sourceTarget || !!draft || sourceRegion.getAttribute('aria-busy') === 'true';
      updateCreationButtons(!!draft);
      if (draft && api.FEATURES.refactorings) sourceState.textContent += ' · Accept or Revert before refactoring accepted source.';
    }
    // Monaco normalizes EOLs. Map its UTF-16 boundary into the exact retained native source.
    // This representation map has no knowledge of Smalltalk syntax.
    function nativeOffset(offset) {
      let visible = 0;
      for (let native = 0; native < nativeSource.length; native++) {
        if (visible === offset) return native;
        if (nativeSource[native] === '\r' && nativeSource[native + 1] === '\n') native++;
        visible++;
      }
      if (visible === offset) return nativeSource.length;
      throw api.runtimeError('PRECONDITION_FAILED', 'Selection does not match the accepted source. Reload the method.');
    }
    async function openRefactoring() {
      if (refactor.disabled) return;
      if (editor.getValue() !== acceptedSource || sourceRevision !== workspace.snapshot().revision) throw api.runtimeError('STALE_REVISION', 'Accept or Revert this source before refactoring.');
      const selection = editor.getSelection ? editor.getSelection() : { start: 0, end: 0 };
      await refactoringView.open({ target: { ...sourceTarget }, baseRevision: sourceRevision,
        selection: { start: nativeOffset(selection.start), end: nativeOffset(selection.end) },
        ...(selection.start === selection.end ? { selectionError: 'Select a nonempty range in the accepted method, then open Refactor again.' } : {}),
      });
    }
    function updateCreationButtons(hasDraft) {
      const unavailable = !refactoringView || editingBusy || hasDraft || sourceRegion.getAttribute('aria-busy') === 'true';
      creationButtons.forEach(({ control, action }) => {
        control.disabled = unavailable || !target || (action === 'addClass' ? !target.packageName && !target.className : action === 'removeMethod' ? target.kind !== 'method' : !target.className);
      });
    }
    async function saveNewPackage() {
      const name = packageName.value.trim(); if (!name || savePackage.disabled) return;
      const hadFocus = packageForm.contains(document.activeElement);
      savePackage.disabled = true; cancelPackage.disabled = true; packageStatus.textContent = 'Creating package…';
      try {
        await workspace.commit({ baseRevision: packageRevision, action: 'createPackage', params: { name } });
        if (disposed) return;
        panes[0].search.value = name; await loadPane(0); if (disposed) return;
        await navigate({ kind: 'package', packageName: name }); if (disposed) return;
        const ownedFocus = packageForm.contains(document.activeElement) ||
          (hadFocus && [document.body, document.documentElement].includes(document.activeElement));
        packageForm.hidden = true; compilation.textContent = 'Package created.';
        if (ownedFocus) focusPackageOrigin();
      } catch (error) { if (!disposed) packageStatus.textContent = 'Package creation failed: ' + error.message; }
      finally { if (!disposed) { savePackage.disabled = false; cancelPackage.disabled = false; } }
    }
    async function openDefinitionAction(action) {
      const control = creationButtons.find(entry => entry.action === action).control; if (control.disabled) return;
      const selected = target.className ? { kind: action === 'removeMethod' ? 'method' : 'class', className: target.className,
        packageName: target.packageName, side: ['addClass', 'removeClass'].includes(action) ? 'instance' : target.side || side,
        ...(action === 'removeMethod' ? { selector: target.selector } : {}), ...(target.protocol ? { protocol: target.protocol } : {}) } : { ...target };
      await refactoringView.open({ action, target: Object.fromEntries(Object.entries(selected).filter(([, value]) => value !== undefined)), baseRevision: workspace.snapshot().revision });
    }
    async function refactoringApplied({ request, preview }) {
      // Destination identity is taken from the native preview, never inferred by editing text.
      const available = preview.changes.entries.filter(entry => entry.after !== null);
      const candidates = available.filter(entry => entry.entity.className === request.target.className);
      const destination = request.action === 'addClass' ? available.find(entry => entry.before === null && entry.entity.kind === 'class') :
        candidates.find(entry => sameEntity(entry.entity, request.target)) || candidates.find(entry => entry.before === null && entry.entity.side === request.target.side) || candidates.find(entry => entry.before === null);
      if (destination) {
        try { await navigate(destination.entity); }
        catch (error) { if (error.code === 'PRECONDITION_FAILED') await navigate({ kind: 'package', packageName: request.target.packageName }); else throw error; }
      }
      else if (request.target.kind === 'method') await navigate({ ...request.target, kind: 'class', selector: undefined, protocol: undefined });
      else await navigate({ kind: 'package', packageName: request.target.packageName });
      if (!disposed) compilation.textContent = request.action === 'removeMethod' ? 'Method removed from the live image.' : request.action === 'removeClass' ? 'Class removed from the live image.' : 'Native changes accepted. Live objects now use this code.';
    }
    async function acceptSource() {
      const draft = workspace.getDrafts().find(entry => sameEntity(entry.target, sourceTarget)); if (!draft) return;
      const hadFocus = document.activeElement === accept;
      editingBusy = true; updateSourceState(); compilation.textContent = 'Compiling…';
      try {
        const action = { method: 'acceptMethod', class: 'acceptClass', comment: 'acceptComment' }[sourceTarget.kind];
        await workspace.commit({ baseRevision: draft.baseRevision, action, params: { target: draft.target, source: draft.source, ...(draft.target.kind === 'method' ? { protocol: draft.target.protocol || 'as yet unclassified' } : {}) } });
        if (!disposed) { if (sameEntity(sourceTarget, draft.target)) await loadSource(draft.target); compilation.textContent = 'Accepted. Live objects now use this code.'; }
      } catch (error) { showError(error); }
      finally { editingBusy = false; if (!disposed) { updateSourceState();
        if (hadFocus && [document.body, document.documentElement].includes(document.activeElement)) (accept.disabled ? sourceRegion : accept).focus();
      } }
    }
    async function revertSource() { if (!sourceTarget) return; workspace.revertDraft(sourceTarget); await refreshSource(); compilation.textContent = 'Draft reverted to accepted source.'; }
    function updateHistory() { back.disabled = historyIndex <= 0; forward.disabled = historyIndex >= history.length - 1; }
    function travel(direction) { historyIndex += direction; updateHistory(); run(navigate(history[historyIndex], { record: false })); }
    function updateQueryButtons() {
      queryButtons.forEach(({ control, kind }) => { control.disabled = !target || (['senders', 'implementors', 'versions'].includes(kind) ? !target.selector : !target.className); });
      definition.disabled = !target.className; comment.disabled = !target.className;
    }
    async function openClassSource(kind) { await navigate({ ...target, kind, selector: undefined, protocol: undefined }); }
    let selectedVersion = null;
    const versionRegion = element('section', 'smalltalk-version-preview'); versionRegion.setAttribute('aria-label', 'Selected method version'); versionRegion.hidden = true;
    const versionHeading = element('h3'); const versionSource = element('pre'); const versionState = element('p');
    const restoreVersion = button('Restore version', () => run(restoreSelectedVersion())); restoreVersion.classList.add('smalltalk-action-primary'); restoreVersion.disabled = true;
    versionRegion.append(versionHeading, versionState, versionSource, restoreVersion); queryRegion.insertBefore(versionRegion, queryNext);
    async function restoreSelectedVersion() {
      if (!selectedVersion || restoreVersion.disabled) return;
      const submitted = selectedVersion; restoreVersion.disabled = true; queryStatus.textContent = 'Restoring native method source…';
      try {
        if (workspace.getDrafts().some(draft => sameEntity(draft.target, submitted.target))) throw api.runtimeError('PRECONDITION_FAILED', 'Accept or Revert the current method draft before restoring a version.');
        await workspace.commit({ baseRevision: submitted.revision, action: 'restoreVersion', params: { target: submitted.target, source: submitted.source, protocol: submitted.target.protocol || 'as yet unclassified' } });
        if (disposed) return;
        await navigate(submitted.target); queryStatus.textContent = 'Version restored as a new edit. Existing versions remain available; query Versions again to refresh.';
        versionState.textContent = 'Restored as a new accepted edit at revision ' + workspace.snapshot().revision + '.';
      } catch (error) {
        if (disposed) return;
        queryStatus.textContent = 'Version restore failed: ' + (error.message || String(error)) + '. Query Versions again to review current history.';
      }
      if (!disposed && [document.body, document.documentElement].includes(document.activeElement)) queryRegion.focus();
    }
    async function query(kind, label, { offset = 0, variable = null, originTarget = null } = {}) {
      if (!offset && kind !== 'variableReferences') queryOrigin = queryButtons.find(entry => entry.kind === kind).control;
      const generation = ++queryGeneration;
      const queryTarget = offset ? querySessionTarget : originTarget || { ...target }; querySessionTarget = queryTarget;
      querySessionVariable = offset ? querySessionVariable : variable; queryRegion.hidden = false; queryTitle.textContent = label;
      if (compact) {
        const tools = queryToolbar.closest('details.smalltalk-browser-tools');
        const ownsFocus = tools.contains(document.activeElement);
        grid.hidden = true; tools.open = false;
        if (ownsFocus) queryRegion.focus();
      }
      queryStatus.textContent = 'Searching the image…'; if (!offset) { queryNext.hidden = true; selectedVersion = null; versionRegion.hidden = true; restoreVersion.disabled = true; }
      const result = await workspace.browse({ kind, target: kind === 'variableReferences' ? { kind: 'class', className: queryTarget.className, side: queryTarget.side || side } : queryTarget, ...(querySessionVariable ? { variable: querySessionVariable } : {}), offset, limit: 100 });
      if (disposed || generation !== queryGeneration) return;
      const ownedFocus = document.activeElement === queryNext;
      let firstAction = null;
      if (!offset) queryList.replaceChildren();
      result.items.forEach(item => {
        const entry = element('li');
        if (kind === 'variables' && item.variable) {
          const action = button('References to ' + item.label, () => run(query('variableReferences', 'References to ' + item.label, { variable: item.variable, originTarget: queryTarget })));
          if (!firstAction) firstAction = action; entry.append(action);
        } else if (kind === 'versions') {
          const action = button('Select version ' + item.label, () => {
            selectedVersion = { target: { ...queryTarget }, revision: result.revision, source: item.detail, id: item.id };
            versionRegion.hidden = false; versionHeading.textContent = 'Version ' + item.label;
            versionSource.textContent = item.detail; versionState.textContent = 'Native ChangeSet source · captured revision ' + result.revision + '. Restore compiles this method as a new edit.' + (api.FEATURES.refactorings ? ' This ends refactoring Undo history.' : '') + ' Native history may be incomplete; unavailable prior versions cannot be restored.';
            restoreVersion.disabled = typeof item.detail !== 'string';
          });
          if (!firstAction) firstAction = action; entry.append(action);
        } else if (item.target) {
          const action = button(item.label, () => run(navigate(item.target)));
          if (!firstAction) firstAction = action;
          entry.append(action);
        }
        else entry.append(element('p', '', item.label));
        if (item.detail) entry.append(element('pre', 'smalltalk-query-detail', item.detail)); queryList.append(entry);
      });
      queryStatus.textContent = result.items.length ? result.items.length + ' results on this page.' + (kind === 'versions' ? ' Native ChangeSet history may be incomplete; unavailable prior versions cannot be restored.' : '') : kind === 'versions' ? 'No native versions available. Unavailable history cannot be restored.' : 'No results.';
      if (result.scope) queryStatus.textContent += ' ' + result.scope;
      queryRegion.dataset.kind = kind; queryRegion.dataset.offset = result.nextOffset; queryNext.hidden = result.nextOffset === null;
      if (ownedFocus && queryNext.hidden) (firstAction || queryRegion).focus();
    }
    return { ready, navigate, dispose() {
      disposed = true; navigationGeneration++; queryGeneration++; panes.forEach(pane => pane.request++); unsubscribe(); sourceViews.dispose(); if (refactoringView) refactoringView.dispose(); editor.dispose(); view.remove();
    } };
  }
  api.Browser = { mount };
})(window);
