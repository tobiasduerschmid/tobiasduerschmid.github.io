(function (scope) {
  'use strict';
  let nextId = 0;
  /** Owns transient workspace layout only; views, editors and the image stay mounted. */
  function mount({ root, outputPanel }) {
    const lifetime = new AbortController();
    const header = outputPanel.querySelector('.tvm-output-header');
    const actions = header.querySelector('.tvm-output-actions');
    const body = document.createElement('div');
    body.className = 'smalltalk-dock-content'; body.id = 'smalltalk-dock-' + (++nextId);
    // Recovery announcements must remain exposed even with the visual dock shut.
    for (const child of [...outputPanel.children]) {
      if (child !== header && !child.matches('.sr-only[role], .sr-only[aria-live]')) body.append(child);
    }
    outputPanel.append(body);
    outputPanel.setAttribute('role', 'region'); outputPanel.setAttribute('aria-label', 'Output and live terminal');
    const output = body.querySelector('.tvm-output-container');
    const terminal = body.querySelector('section');
    const outputActions = [...actions.querySelectorAll('.tvm-clear-btn, .tvm-output-popout-btn')];
    output.id = body.id + '-output'; terminal.id = body.id + '-terminal';
    const views = document.createElement('div'); views.className = 'smalltalk-dock-views';
    views.setAttribute('role', 'group'); views.setAttribute('aria-label', 'Dock view');
    const terminalControl = control('Live terminal', () => selectView('terminal'));
    const outputControl = control('Run output', () => selectView('output'));
    terminalControl.setAttribute('aria-controls', terminal.id); outputControl.setAttribute('aria-controls', output.id);
    views.append(terminalControl, outputControl); header.querySelector('span').replaceWith(views);
    let collapsed = false, expanded = false, focused = false;
    function control(text, action) {
      const node = document.createElement('button'); node.type = 'button'; node.textContent = text;
      node.addEventListener('click', action, { signal: lifetime.signal }); return node;
    }
    function selectView(name) {
      const hiding = name === 'terminal' ? output : terminal;
      if (hiding.contains(document.activeElement)) (name === 'terminal' ? terminalControl : outputControl).focus();
      terminal.hidden = name !== 'terminal'; output.hidden = name !== 'output';
      outputActions.forEach(button => { button.hidden = name !== 'output'; });
      terminalControl.setAttribute('aria-pressed', String(name === 'terminal'));
      outputControl.setAttribute('aria-pressed', String(name === 'output'));
    }
    function showOutput() {
      selectView('output'); focused = false; collapsed = false; render();
    }
    const collapse = control('Collapse', () => {
      if (focused) { focused = false; collapsed = false; }
      else collapsed = !collapsed;
      render();
    });
    collapse.setAttribute('aria-controls', body.id);
    const expand = control('Expand', () => { focused = false; collapsed = false; expanded = !expanded; render(); });
    collapse.className = expand.className = 'smalltalk-dock-control';
    expand.setAttribute('aria-controls', body.id);
    const focusControl = control('Focus source editor', () => { focused = !focused; render(); });
    focusControl.className = 'smalltalk-focus-source';
    actions.append(collapse, expand);
    function render() {
      const hidden = focused || collapsed;
      if (hidden && body.contains(document.activeElement)) collapse.focus();
      body.hidden = hidden;
      root.classList.toggle('smalltalk-dock-collapsed', hidden);
      root.classList.toggle('smalltalk-dock-expanded', expanded && !hidden);
      root.classList.toggle('smalltalk-source-focus', focused);
      collapse.textContent = hidden ? 'Show' : 'Collapse';
      collapse.setAttribute('aria-label', hidden ? 'Show output and terminal' : 'Collapse output and terminal');
      collapse.setAttribute('aria-expanded', String(!hidden));
      expand.textContent = expanded ? 'Restore' : 'Expand';
      expand.setAttribute('aria-label', expanded ? 'Restore output and terminal size' : 'Expand output and terminal');
      expand.setAttribute('aria-pressed', String(expanded));
      focusControl.setAttribute('aria-pressed', String(focused));
      focusControl.textContent = focused ? 'Restore layout' : 'Focus source editor';
    }
    function revealDetails() {
      selectView('terminal');
      if (focused) focused = false;
      collapsed = false; expanded = true; render();
    }
    body.addEventListener('toggle', event => {
      if (event.target instanceof HTMLDetailsElement && event.target.open) revealDetails();
    }, { capture: true, signal: lifetime.signal });
    selectView('terminal'); render();
    return { focusControl, revealDetails, showOutput, dispose() {
      lifetime.abort(); collapse.remove(); expand.remove(); focusControl.remove();
      terminal.hidden = false; output.hidden = false;
      outputActions.forEach(button => { button.hidden = false; });
      const label = document.createElement('span'); label.textContent = 'Output / terminal'; views.replaceWith(label);
      root.classList.remove('smalltalk-dock-collapsed', 'smalltalk-dock-expanded', 'smalltalk-source-focus');
      body.replaceWith(...body.childNodes);
    } };
  }
  scope.SEBookSmalltalk.Layout = { mount };
})(window);
