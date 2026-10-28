/**
 * SEBookDebuggerUI — pure render functions for the debugger panel.
 *
 * Each function takes (rootEl, state, dispatch, helpers) and writes the
 * relevant section's HTML + wires its event listeners. No `this`. Used by
 * both the main window controller and the popped-out debugger window.
 *
 * `state` is the materialized DebuggerSync state.
 * `dispatch(action)` sends an action request — locally on main, over the
 *   channel on a popout. The renderer doesn't care which.
 * `helpers` is a small bag of utilities and per-context overrides:
 *   { escape, basename, getSubsectionCollapsed, setSubsectionCollapsed,
 *     getSectionCollapsed, setSectionCollapsed, isVarScopeEditable }
 *
 * Sections:
 *   - renderToolbar(rootEl, state, dispatch, helpers)        — the step buttons + status
 *   - renderDebugView(rootEl, state, dispatch, helpers)     — the combined view (4 sections)
 *   - renderVariables / renderCallStack / renderWatch / renderHistory — individual section bodies
 *
 * The combined view is built once into the root, then individual section
 * renderers update their bodies when their slice changes (or always — for
 * simplicity, renderDebugView calls all four). Section collapse state is
 * persisted via helpers.getSectionCollapsed / helpers.setSectionCollapsed
 * (typically backed by localStorage with a per-tutorial key).
 */
(function () {
  'use strict';

  var UNCHANGED = 'UNCHANGED';
  const pendingVariableFocus = new WeakMap();

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function basename(p) {
    if (!p) return '';
    var i = p.lastIndexOf('/');
    return i >= 0 ? p.substring(i + 1) : p;
  }
  function debugManagerIcon(name) {
    var svg = "<svg class='tvm-debug-manager-svg' xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>";
    if (name === 'playData') {
      return svg + "<polygon points='5,4 15,12 5,20' fill='currentColor'/>" +
        "<circle cx='17.5' cy='12' r='3.3' fill='none' stroke='currentColor' stroke-width='2.2'/>" +
        "<circle cx='17.5' cy='12' r='1.2' fill='currentColor'/></svg>";
    }
    if (name === 'backData') {
      return svg + "<polygon points='19,4 9,12 19,20' fill='currentColor'/>" +
        "<circle cx='6.5' cy='12' r='3.3' fill='none' stroke='currentColor' stroke-width='2.2'/>" +
        "<circle cx='6.5' cy='12' r='1.2' fill='currentColor'/></svg>";
    }
    if (name === 'plus') {
      return svg + "<path d='M12 5v14M5 12h14' fill='none' stroke='currentColor' stroke-width='2.6' stroke-linecap='round'/></svg>";
    }
    if (name === 'edit') {
      return svg + "<path d='M5 16.5 15.7 5.8a2.1 2.1 0 0 1 3 3L8 19.5H5z' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linejoin='round'/>" +
        "<path d='m14 7.5 2.5 2.5' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round'/></svg>";
    }
    if (name === 'trash') {
      return svg + "<path d='M6 7h12M10 7V5h4v2M8 10l.7 9h6.6L16 10' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/></svg>";
    }
    if (name === 'dataWatch') {
      return svg + "<circle cx='8.5' cy='12' r='4' fill='none' stroke='currentColor' stroke-width='2.2'/>" +
        "<circle cx='8.5' cy='12' r='1.35' fill='currentColor'/>" +
        "<path d='M14 7h5M14 12h5M14 17h5' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round'/></svg>";
    }
    if (name === 'playException') {
      return svg + "<polygon points='5,4 15,12 5,20' fill='currentColor'/>" +
        "<path d='M 18,5.5 L 18,13' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round'/>" +
        "<circle cx='18' cy='17' r='1.4' fill='currentColor'/></svg>";
    }
    if (name === 'backException') {
      return svg + "<polygon points='19,4 9,12 19,20' fill='currentColor'/>" +
        "<path d='M 6,5.5 L 6,13' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round'/>" +
        "<circle cx='6' cy='17' r='1.4' fill='currentColor'/></svg>";
    }
    return '';
  }
  function debugToolbarIcon(name) {
    var svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' aria-hidden='true'>";
    if (name === 'play') {
      return svg + "<polygon points='5,3 21,12 5,21' fill='currentColor'/></svg>";
    }
    if (name === 'stop') {
      return svg + "<rect x='4' y='4' width='16' height='16' rx='1.5' fill='currentColor'/></svg>";
    }
    if (name === 'over') {
      return svg + "<path d='M 3,16 Q 12,2 20,14' fill='none' stroke='currentColor' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/>" +
        "<polygon points='20,14 23,9 16,11' fill='currentColor'/>" +
        "<circle cx='12' cy='21' r='2.4' fill='currentColor'/></svg>";
    }
    if (name === 'into') {
      return svg + "<line x1='12' y1='2' x2='12' y2='14' stroke='currentColor' stroke-width='3' stroke-linecap='round'/>" +
        "<polygon points='12,17 6,10 18,10' fill='currentColor'/>" +
        "<rect x='5' y='20' width='14' height='2.5' rx='1' fill='currentColor'/></svg>";
    }
    if (name === 'out') {
      return svg + "<rect x='5' y='20' width='14' height='2.5' rx='1' fill='currentColor'/>" +
        "<line x1='12' y1='10' x2='12' y2='18' stroke='currentColor' stroke-width='3' stroke-linecap='round'/>" +
        "<polygon points='12,4 6,11 18,11' fill='currentColor'/></svg>";
    }
    if (name === 'back') {
      return svg + "<path d='M 21,16 Q 12,2 4,14' fill='none' stroke='currentColor' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/>" +
        "<polygon points='4,14 1,9 8,11' fill='currentColor'/>" +
        "<circle cx='12' cy='21' r='2.4' fill='currentColor'/></svg>";
    }
    if (name === 'backContinue') {
      return svg + "<polygon points='19,4 7,12 19,20' fill='currentColor'/>" +
        "<circle cx='6' cy='12' r='3' fill='currentColor'/></svg>";
    }
    if (name === 'backOut') {
      return svg + "<rect x='5' y='20' width='14' height='2.5' rx='1' fill='currentColor'/>" +
        "<line x1='12' y1='10' x2='12' y2='18' stroke='currentColor' stroke-width='3' stroke-linecap='round'/>" +
        "<polygon points='12,4 6,11 18,11' fill='currentColor'/>" +
        "<path d='M 18,7 H 7' fill='none' stroke='currentColor' stroke-width='2.4' stroke-linecap='round'/>" +
        "<polygon points='7,7 12,3.5 12,10.5' fill='currentColor'/></svg>";
    }
    return '';
  }
  function defaultHelpers(h) {
    h = h || {};
    return {
      escape: h.escape || escapeHtml,
      basename: h.basename || basename,
      getSubsectionCollapsed: h.getSubsectionCollapsed || function () { return false; },
      setSubsectionCollapsed: h.setSubsectionCollapsed || function () {},
      getSectionCollapsed: h.getSectionCollapsed || function () { return false; },
      setSectionCollapsed: h.setSectionCollapsed || function () {},
      isVarScopeEditable: h.isVarScopeEditable || function () { return false; },
    };
  }

  /** Capture local drafts and focus before replacing a panel's markup.
   * Stable data-debug-focus keys identify controls. data-debug-draft="true"
   * keeps an unsent value; "focus" keeps it only while that field is active.
   */
  function capturePanelInteraction(view) {
    const active = view.ownerDocument.activeElement;
    const focused = view.contains(active) ? active : null;
    const drafts = {};
    view.querySelectorAll('[data-debug-draft][data-debug-focus]').forEach(function (field) {
      if (field.dataset.debugDraft === 'true' || field === focused) {
        drafts[field.dataset.debugFocus] = field.value;
      }
    });
    return {
      key: focused && focused.dataset.debugFocus,
      drafts: drafts,
      selectionStart: focused && focused.selectionStart,
      selectionEnd: focused && focused.selectionEnd,
      selectionDirection: focused && focused.selectionDirection,
    };
  }

  /** Restore a captured panel without moving focus from another panel.
   * The optional fallback is used only when the focused control disappeared.
   */
  function restorePanelInteraction(view, snapshot, fallbackSelector) {
    if (!snapshot) return;
    let focused = null;
    view.querySelectorAll('[data-debug-focus]').forEach(function (control) {
      const key = control.dataset.debugFocus;
      if (Object.prototype.hasOwnProperty.call(snapshot.drafts, key)) {
        const value = snapshot.drafts[key];
        if (control.tagName !== 'SELECT' || Array.from(control.options).some(function (option) { return option.value === value; })) {
          control.value = value;
        }
      }
      if (key === snapshot.key) focused = control;
    });
    if (!snapshot.key) return;
    if (!isAvailableControl(focused)) focused = fallbackSelector && view.querySelector(fallbackSelector);
    if (!isAvailableControl(focused)) {
      focused = Array.from(view.querySelectorAll('[data-debug-focus]')).find(isAvailableControl);
    }
    if (!focused) return;
    focused.focus({ preventScroll: true });
    if (typeof snapshot.selectionStart === 'number' && focused.setSelectionRange &&
        (focused.type === 'text' || focused.tagName === 'TEXTAREA')) {
      focused.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd, snapshot.selectionDirection);
    }
  }

  function isAvailableControl(control) {
    return !!control && !control.disabled && !control.closest('[inert]') &&
      control.getClientRects().length > 0 && getComputedStyle(control).visibility !== 'hidden';
  }

  /** Retain a focused value button only when replay temporarily empties the
   * variable panel. Deliberate pointer/focus navigation cancels the request.
   */
  function retainVariableFocus(view, snapshot) {
    if (!snapshot.key || !snapshot.key.startsWith('variable:')) return;
    clearPendingVariableFocus(view);
    const controller = new AbortController();
    const doc = view.ownerDocument;
    pendingVariableFocus.set(view, { snapshot: snapshot, controller: controller });
    doc.addEventListener('pointerdown', function () { clearPendingVariableFocus(view); }, { signal: controller.signal, capture: true });
    doc.addEventListener('focusin', function (event) {
      if (event.target !== doc.body && !view.contains(event.target)) clearPendingVariableFocus(view);
    }, { signal: controller.signal, capture: true });
  }

  function clearPendingVariableFocus(view) {
    const pending = pendingVariableFocus.get(view);
    if (!pending) return;
    pending.controller.abort();
    pendingVariableFocus.delete(view);
  }

  /** Restore a current interaction, or its retained value after replay. A
   * pending value waits until editable again; it never focuses a fallback.
   */
  function restoreVariableFocus(view, snapshot, fallbackSelector) {
    if (snapshot.key) {
      clearPendingVariableFocus(view);
      restorePanelInteraction(view, snapshot, fallbackSelector);
      return;
    }
    const pending = pendingVariableFocus.get(view);
    if (!pending) return;
    const ready = Array.from(view.querySelectorAll('[data-debug-focus]')).some(function (control) {
      return control.dataset.debugFocus === pending.snapshot.key && isAvailableControl(control);
    });
    if (ready) {
      clearPendingVariableFocus(view);
      restorePanelInteraction(view, pending.snapshot);
    }
  }

  /** Shared keyboard-operable breakpoint entry for the main and popout views. */
  function breakpointFormHTML(state, helpers) {
    helpers = defaultHelpers(helpers);
    const files = state.filesAvailable || [];
    const selected = files.indexOf(state.activeFile) >= 0 ? state.activeFile : files[0];
    const disabled = files.length ? '' : ' disabled';
    return '<form class="tvm-debug-breakpoint-form">' +
      '<label class="tvm-debug-breakpoint-field"><span>Breakpoint file</span>' +
      '<select class="tvm-debug-breakpoint-file" data-debug-focus="breakpoint-file" data-debug-draft="true" required' + disabled + '>' +
      files.map(function (path) {
        return '<option value="' + helpers.escape(path) + '"' + (path === selected ? ' selected' : '') + '>' + helpers.escape(path) + '</option>';
      }).join('') + '</select></label>' +
      '<label class="tvm-debug-breakpoint-field tvm-debug-breakpoint-line-field"><span>Breakpoint line</span>' +
      '<input class="tvm-debug-breakpoint-line" data-debug-focus="breakpoint-line" data-debug-draft="true" type="number" min="1" step="1" required value="1"' + disabled + '></label>' +
      '<button type="submit" class="tvm-debug-breakpoint-add" data-debug-focus="breakpoint-add"' + disabled + '>Add breakpoint</button></form>';
  }

  /** Wire one freshly mounted form, after restoring local draft values. */
  function wireBreakpointForm(view, state, dispatch) {
    const form = view.querySelector('.tvm-debug-breakpoint-form');
    if (!form) return;
    const file = form.querySelector('.tvm-debug-breakpoint-file');
    const line = form.querySelector('.tvm-debug-breakpoint-line');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const lineNumber = line.valueAsNumber;
      if (!(state.filesAvailable || []).includes(file.value) || !Number.isSafeInteger(lineNumber) || lineNumber < 1) return;
      dispatch({ type: 'addBreakpoint', path: file.value, line: lineNumber });
    });
  }

  function watchpointRemovePreferenceKey(tutorialId) {
    return 'tutorial-debug-watchpoint-remove-choice-' + (tutorialId || 'default');
  }

  function getWatchpointRemovePreference(tutorialId) {
    try {
      var choice = localStorage.getItem(watchpointRemovePreferenceKey(tutorialId));
      return (choice === 'watch' || choice === 'delete') ? choice : null;
    } catch (e) {
      return null;
    }
  }

  function setWatchpointRemovePreference(tutorialId, choice) {
    try {
      if (choice === 'watch' || choice === 'delete') {
        localStorage.setItem(watchpointRemovePreferenceKey(tutorialId), choice);
      }
    } catch (e) { /* localStorage unavailable */ }
  }

  function showRemoveWatchpointDialog(watchpoint, view) {
    var old = document.querySelector('.tvm-bp-dialog-backdrop');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    return new Promise(function (resolve) {
      var done = false;
      var previousFocus = document.activeElement;
      const returnFocus = capturePanelInteraction(view);
      var backdrop = document.createElement('div');
      backdrop.className = 'tvm-bp-dialog-backdrop';
      backdrop.setAttribute('role', 'presentation');

      var dialog = document.createElement('dialog');
      dialog.className = 'tvm-bp-dialog tvm-watchpoint-remove-dialog';
      dialog.setAttribute('aria-labelledby', 'tvm-wp-remove-dialog-title');

      var header = document.createElement('div');
      header.className = 'tvm-bp-dialog-header';
      var marker = document.createElement('span');
      marker.className = 'tvm-bp-dialog-marker tvm-bp-dialog-marker-watchpoint';
      marker.innerHTML = debugManagerIcon('dataWatch');
      header.appendChild(marker);

      var titleWrap = document.createElement('div');
      titleWrap.className = 'tvm-bp-dialog-title-wrap';
      var title = document.createElement('h3');
      title.id = 'tvm-wp-remove-dialog-title';
      title.className = 'tvm-bp-dialog-title';
      title.textContent = 'Remove Data Watchpoint';
      var loc = document.createElement('div');
      loc.className = 'tvm-bp-dialog-location';
      loc.textContent = watchpoint && watchpoint.expr ? watchpoint.expr : '';
      titleWrap.appendChild(title);
      titleWrap.appendChild(loc);
      header.appendChild(titleWrap);

      var body = document.createElement('div');
      body.className = 'tvm-bp-dialog-body';
      var prompt = document.createElement('div');
      prompt.className = 'tvm-bp-dialog-copy';
      prompt.textContent = 'Do you want to keep this expression as a normal watch?';
      body.appendChild(prompt);
      var rememberLabel = document.createElement('label');
      rememberLabel.className = 'tvm-bp-dialog-check';
      var remember = document.createElement('input');
      remember.type = 'checkbox';
      var rememberText = document.createElement('span');
      rememberText.textContent = "Don't ask again";
      rememberLabel.appendChild(remember);
      rememberLabel.appendChild(rememberText);
      body.appendChild(rememberLabel);

      var actions = document.createElement('div');
      actions.className = 'tvm-bp-dialog-actions';
      var cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'tvm-bp-dialog-btn tvm-bp-dialog-cancel';
      cancel.textContent = 'Cancel';
      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'tvm-bp-dialog-btn tvm-bp-dialog-clear';
      del.textContent = 'Delete';
      var keep = document.createElement('button');
      keep.type = 'button';
      keep.className = 'tvm-bp-dialog-btn tvm-bp-dialog-save';
      keep.textContent = 'Turn into Watch';
      actions.appendChild(cancel);
      actions.appendChild(del);
      actions.appendChild(keep);

      dialog.appendChild(header);
      dialog.appendChild(body);
      dialog.appendChild(actions);
      backdrop.appendChild(dialog);
      (document.fullscreenElement || document.body).appendChild(backdrop);

      function close(result) {
        if (done) return;
        done = true;
        dialog.close();
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        if (previousFocus && previousFocus.isConnected) previousFocus.focus();
        else restorePanelInteraction(view, returnFocus, '.tvm-debug-watchpoint-input');
        resolve(result);
      }
      function choice(which) {
        close({ choice: which, remember: !!remember.checked });
      }
      dialog.addEventListener('cancel', function (event) {
        event.preventDefault();
        close(null);
      });
      dialog.addEventListener('keydown', function (event) {
        // Native buttons keep their Enter/Space meaning. The modal owns Tab
        // and Escape, so debugger shortcuts must not handle these events.
        event.stopPropagation();
        if (event.key !== 'Tab') return;
        const first = remember;
        const last = keep;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      });
      dialog.addEventListener('click', function (event) {
        if (event.target !== dialog) return;
        const bounds = dialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom) close(null);
      });
      cancel.addEventListener('click', function () { close(null); });
      del.addEventListener('click', function () { choice('delete'); });
      keep.addEventListener('click', function () { choice('watch'); });
      dialog.showModal();
      cancel.focus();
    });
  }

  // -- Step toolbar ---------------------------------------------------------

  /**
   * Build the step toolbar in `rootEl` if not already built; update button
   * disabled state and status text on every call.
   */
  function renderToolbar(rootEl, state, dispatch, helpers) {
    if (!rootEl) return;
    helpers = defaultHelpers(helpers);
    if (!rootEl.dataset.toolbarBuilt) {
      rootEl.dataset.toolbarBuilt = '1';
      rootEl.classList.add('tvm-debug-toolbar');
      rootEl.innerHTML =
        '<span class="tvm-debug-status" role="status" aria-live="polite" aria-atomic="true"></span>' +
        '<button class="tvm-debug-step" data-cmd="continue" data-original-title="Continue (F5)" aria-label="Continue">' + debugToolbarIcon('play') + '</button>' +
        '<button class="tvm-debug-step" data-cmd="next"     data-original-title="Step Over (F10)" aria-label="Step Over">' + debugToolbarIcon('over') + '</button>' +
        '<button class="tvm-debug-step" data-cmd="step"     data-original-title="Step Into (F11)" aria-label="Step Into">' + debugToolbarIcon('into') + '</button>' +
        '<button class="tvm-debug-step" data-cmd="return"   data-original-title="Step Out (Shift+F11)" aria-label="Step Out">' + debugToolbarIcon('out') + '</button>' +
        '<span class="tvm-debug-divider"></span>' +
        '<button class="tvm-debug-step" data-cmd="back"     data-original-title="Step Back (Shift+F10)" aria-label="Step Back">' + debugToolbarIcon('back') + '</button>' +
        '<button class="tvm-debug-step" data-cmd="backContinue" data-original-title="Run Back to Breakpoint (Alt+Shift+F5)" aria-label="Run Back to Breakpoint">' + debugToolbarIcon('backContinue') + '</button>' +
        '<button class="tvm-debug-step" data-cmd="backOut"  data-original-title="Step Back Out (Alt+Shift+F10)" aria-label="Step Back Out">' + debugToolbarIcon('backOut') + '</button>' +
        '<span class="tvm-debug-divider"></span>' +
        '<button class="tvm-debug-step" data-cmd="stop"     data-original-title="Stop (Shift+F5)" aria-label="Stop">' + debugToolbarIcon('stop') + '</button>';
      var btns = rootEl.querySelectorAll('.tvm-debug-step');
      for (var i = 0; i < btns.length; i++) {
        (function (btn) {
          btn.addEventListener('click', function () {
            var cmd = btn.getAttribute('data-cmd');
            dispatch({ type: 'step', cmd: cmd });
          });
        })(btns[i]);
      }
    }
    var session = state.session || {};
    rootEl.style.display = session.active ? 'flex' : 'none';
    var disabled = !!session.stepButtonsDisabled;
    var btns = rootEl.querySelectorAll('.tvm-debug-step');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      var cmd = b.getAttribute('data-cmd');
      // Reverse-time controls and Stop are always available during a session.
      var alwaysOn = (cmd === 'back' || cmd === 'backContinue' || cmd === 'backWatch' || cmd === 'backOut' ||
                      cmd === 'exceptionBack' || cmd === 'exceptionForward' || cmd === 'stop');
      b.disabled = !alwaysOn && disabled;
    }
    var statusEl = rootEl.querySelector('.tvm-debug-status');
    if (statusEl) {
      statusEl.textContent = session.status || '';
      if (session.status) statusEl.setAttribute('data-original-title', session.status);
      else statusEl.removeAttribute('data-original-title');
      statusEl.removeAttribute('title');
    }
  }

  // -- Combined view shell --------------------------------------------------

  function buildCombinedShell(rootEl, helpers) {
    if (!rootEl || rootEl.dataset.shellBuilt) return;
    rootEl.dataset.shellBuilt = '1';
    var sections = [
      { key: 'stack',   label: 'Call Stack',  icon: 'fa-layer-group',        empty: 'Start debugging to see the call stack.' },
      { key: 'vars',    label: 'Variables',   icon: 'fa-list',               empty: 'Start debugging to see variables.' },
      { key: 'watch',   label: 'Watch',       icon: 'fa-eye',                empty: 'Start debugging to see watches.' },
      { key: 'breakpoints', label: 'Breakpoints', icon: 'fa-circle-dot',     empty: 'Add breakpoints or data watchpoints.' },
      { key: 'history', label: 'History',     icon: 'fa-clock-rotate-left',  empty: 'Start debugging to navigate execution history.' },
    ];
    rootEl.innerHTML = sections.map(function (s) {
      var collapsed = helpers.getSectionCollapsed(s.key);
      return '<section class="tvm-dbg-section' + (collapsed ? ' collapsed' : '') +
             '" data-section="' + s.key + '" aria-label="' + s.label + '">' +
             '<button type="button" class="tvm-dbg-section-head" data-section="' + s.key + '" aria-expanded="' + !collapsed + '">' +
             '<span class="tvm-dbg-section-chevron" aria-hidden="true">▾</span>' +
             '<i class="fa ' + s.icon + '" aria-hidden="true"></i>' +
             '<span class="tvm-dbg-section-title">' + s.label + '</span>' +
             '</button>' +
             '<div class="tvm-dbg-section-body" data-section="' + s.key + '">' +
             '<div class="tvm-debug-empty">' + s.empty + '</div>' +
             '</div>' +
             '</section>';
    }).join('');
    rootEl.addEventListener('click', function (e) {
      var head = e.target && e.target.closest && e.target.closest('.tvm-dbg-section-head');
      if (!head) return;
      var section = head.parentElement;
      if (!section) return;
      var key = section.getAttribute('data-section');
      var nowCollapsed = !section.classList.contains('collapsed');
      section.classList.toggle('collapsed', nowCollapsed);
      head.setAttribute('aria-expanded', String(!nowCollapsed));
      helpers.setSectionCollapsed(key, nowCollapsed);
    });
  }

  function findSectionBody(rootEl, key) {
    if (!rootEl) return null;
    return rootEl.querySelector('.tvm-dbg-section-body[data-section="' + key + '"]');
  }

  function renderDebugView(rootEl, state, dispatch, helpers) {
    helpers = defaultHelpers(helpers);
    buildCombinedShell(rootEl, helpers);
    renderWatch(findSectionBody(rootEl, 'watch'), state, dispatch, helpers);
    renderBreakpoints(findSectionBody(rootEl, 'breakpoints'), state, dispatch, helpers);
    renderCallStack(findSectionBody(rootEl, 'stack'), state, dispatch, helpers);
    renderVariables(findSectionBody(rootEl, 'vars'), state, dispatch, helpers);
    renderHistory(findSectionBody(rootEl, 'history'), state, dispatch, helpers);
  }

  // -- Variables ------------------------------------------------------------


  function renderHaskellBindings(frame, snap, frameIdx, helpers) {
    function section(key, label, dict, scope, empty) {
      const hasNames = dict && Object.keys(dict).length;
      const body = hasNames
        ? renderVarTable({}, snap, frameIdx, scope, dict, helpers)
        : '<p class="tvm-debug-language-note">' + empty + '</p>';
      return renderSubsection(key, label, body, helpers);
    }
    return section('argument-bindings', 'Argument bindings', frame.locals, 'argument-bindings',
        'None yet. A matched pattern adds the names bound from the arguments.') +
      section('haskell-locals', 'Local bindings', frame.local_bindings, 'local-bindings',
        'None in this equation.');
  }

  function renderVariables(view, state, dispatch, helpers) {
    if (!view) return;
    helpers = defaultHelpers(helpers);
    const expandedValues = captureExpandedVariables(view);
    const interaction = capturePanelInteraction(view);
    const viewRoot = view.closest('.tvm-debug-view');
    if (viewRoot) viewRoot.classList.toggle('tvm-debug-haskell', state.backend === 'haskell');
    var hi = state.historyIdx;
    if (hi == null || hi < 0 || !state.history || !state.history[hi]) {
      retainVariableFocus(view, interaction);
      view.innerHTML = '<div class="tvm-debug-empty">' +
        (state.backend === 'haskell' ? 'Start debugging to see bindings.' : 'Start debugging to see variables.') +
        '</div>';
      return;
    }
    var snap = state.history[hi];
    var frameIdx = (state.selectedFrameIdx != null && state.selectedFrameIdx >= 0)
      ? state.selectedFrameIdx
      : (snap.stack.length - 1);
    var frame = snap.stack[frameIdx];
    if (!frame) { view.innerHTML = '<div class="tvm-debug-empty">No frame.</div>'; return; }
    if (state.backend === 'haskell') {
      view.innerHTML = renderHaskellBindings(frame, snap, frameIdx, helpers);
      wireSubsectionToggles(view, helpers);
      restoreVariableFocus(view, interaction, '.tvm-debug-subsection-head');
      return;
    }
    var html = renderSubsection('locals', 'Locals · ' + helpers.escape(frame.function),
      renderVarTable(state, snap, frameIdx, 'locals', frame.locals, helpers), helpers);
    if (frame.globals) {
      html += renderSubsection('globals', 'Globals',
        renderVarTable(state, snap, frameIdx, 'globals', frame.globals, helpers), helpers);
    }
    if (snap.exception) {
      html = '<div class="tvm-debug-exception">⚠️ ' + helpers.escape(snap.exception.type) + ': ' +
             helpers.escape(snap.exception.message) + '</div>' + html;
    }
    if (snap.event === 'return' && snap.return_value) {
      html = '<div class="tvm-debug-return">→ returned ' +
             helpers.escape(snap.return_value.repr || '') + '</div>' + html;
    }
    if (state.backend === 'prolog') {
      html = '<p class="tvm-debug-language-note">Resolution goals and query bindings show the current search state.</p>' + html;
    }
    view.innerHTML = html;
    wireExpanders(view);
    restoreExpandedVariables(view, expandedValues);
    wireSubsectionToggles(view, helpers);
    wireVarEdits(view, dispatch);
    restoreVariableFocus(view, interaction, '.tvm-debug-subsection-head');
  }

  function renderSubsection(key, label, contentHtml, helpers) {
    var collapsed = helpers.getSubsectionCollapsed(key);
    return '<div class="tvm-debug-subsection' + (collapsed ? ' collapsed' : '') +
           '" data-subsection="' + key + '">' +
           '<button type="button" class="tvm-debug-subsection-head" data-debug-focus="subsection:' + helpers.escape(key) + '" aria-expanded="' + !collapsed + '">' +
           '<span class="tvm-debug-subsection-chevron" aria-hidden="true">▾</span>' +
           '<span class="tvm-debug-subsection-title">' + label + '</span>' +
           '</button>' +
           '<div class="tvm-debug-subsection-body">' + contentHtml + '</div>' +
           '</div>';
  }

  function wireSubsectionToggles(view, helpers) {
    var heads = view.querySelectorAll('.tvm-debug-subsection-head');
    for (var i = 0; i < heads.length; i++) {
      (function (head) {
        head.addEventListener('click', function () {
          var sub = head.parentElement;
          if (!sub) return;
          var key = sub.getAttribute('data-subsection');
          var nowCollapsed = !sub.classList.contains('collapsed');
          sub.classList.toggle('collapsed', nowCollapsed);
          head.setAttribute('aria-expanded', String(!nowCollapsed));
          helpers.setSubsectionCollapsed(key, nowCollapsed);
        });
      })(heads[i]);
    }
  }

  function renderVarTable(state, snap, frameIdx, scope, dict, helpers) {
    if (!dict || !Object.keys(dict).length) {
      return '<div class="tvm-debug-empty-row">(no ' + scope + ')</div>';
    }
    var rows = [];
    var seenOids = {};
    var keys = Object.keys(dict).sort();
    var editable = helpers.isVarScopeEditable(snap, frameIdx, scope, state);
    for (var i = 0; i < keys.length; i++) {
      var name = keys[i];
      var resolved = (dict[name] === UNCHANGED)
        ? resolveVarLocal(state, snap, frameIdx, scope, name)
        : dict[name];
      if (!resolved) continue;
      var oid = resolved.oid;
      var aliasBadge = '';
      if (oid && seenOids[oid]) {
        aliasBadge = ' <span class="tvm-debug-alias" data-original-title="Same object as ' +
                     helpers.escape(seenOids[oid]) + ' (oid ' + oid + ')">↔ ' +
                     helpers.escape(seenOids[oid]) + '</span>';
      } else if (oid) {
        seenOids[oid] = name;
      }
      var editKey = editable ? (scope + '|' + frameIdx + '|' + name) : '';
      rows.push(renderVarRow(name, resolved, aliasBadge, 0, editKey, helpers));
    }
    return '<div class="tvm-debug-vars">' + rows.join('') + '</div>';
  }

  function renderVarRow(name, val, aliasBadge, depth, editKey, helpers) {
    if (!val) return '';
    var nameHtml = '<span class="tvm-debug-var-name">' + helpers.escape(name) + '</span>';
    var typeHtml = '<span class="tvm-debug-var-type">' + helpers.escape(val.type || (val.kind === 'primitive' ? '' : val.kind) || '') + '</span>';
    var editAttr = editKey ? ' type="button" data-edit-key="' + helpers.escape(editKey) + '" data-debug-focus="variable:' + helpers.escape(editKey) + '" aria-label="' + helpers.escape('Edit ' + name + ': ' + (val.repr || val.preview || '') + (val.note ? ' (' + val.note + ')' : '')) + '"' : '';
    var valueHtml = '<' + (editKey ? 'button' : 'span') + ' class="tvm-debug-var-value' + (editKey ? ' tvm-debug-var-editable' : '') + '"' + editAttr +
                    '>' + helpers.escape(val.repr || val.preview || '') +
                    (val.note ? ' <span class="tvm-debug-var-type">(' + helpers.escape(val.note) + ')</span>' : '') + '</' + (editKey ? 'button' : 'span') + '>';
    var hasChildren = val.kind === 'collection' || (val.kind === 'object' && val.attrs && Object.keys(val.attrs).length);
    var expander = hasChildren
      ? '<button type="button" class="tvm-debug-expander" data-expanded="false" aria-expanded="false" aria-label="Expand ' + helpers.escape(name) + '">▶</button>'
      : '<span class="tvm-debug-expander-spacer"></span>';
    var row = '<div class="tvm-debug-var-row" style="padding-left:' + (depth * 14) + 'px">' +
              expander + nameHtml + typeHtml + valueHtml + (aliasBadge || '') + '</div>';
    if (hasChildren) {
      var childHtml = renderChildren(val, depth + 1, helpers);
      row += '<div class="tvm-debug-var-children" hidden>' + childHtml + '</div>';
    }
    return row;
  }

  function renderChildren(val, depth, helpers) {
    if (val.kind === 'collection') {
      var rows = [];
      if (val.type === 'dict') {
        for (var i = 0; i < val.children.length; i++) {
          var entry = val.children[i];
          rows.push(renderVarRow(entry.key, entry.value, '', depth, '', helpers));
        }
      } else {
        for (var k = 0; k < val.children.length; k++) {
          rows.push(renderVarRow('[' + k + ']', val.children[k], '', depth, '', helpers));
        }
      }
      if (val.truncated) rows.push('<div class="tvm-debug-truncated" style="padding-left:' + (depth * 14) + 'px">… +' + (val.len - val.children.length) + ' more</div>');
      return rows.join('');
    } else if (val.kind === 'object' && val.attrs) {
      var keys = Object.keys(val.attrs).sort();
      var out = [];
      for (var j = 0; j < keys.length; j++) {
        out.push(renderVarRow(keys[j], val.attrs[keys[j]], '', depth, '', helpers));
      }
      return out.join('');
    }
    return '';
  }

  function wireExpanders(view) {
    var expanders = view.querySelectorAll('.tvm-debug-expander');
    for (var i = 0; i < expanders.length; i++) {
      (function (ex) {
        ex.addEventListener('click', function () {
          var expanded = ex.getAttribute('data-expanded') === 'true';
          ex.setAttribute('data-expanded', !expanded);
          ex.setAttribute('aria-expanded', String(!expanded));
          ex.setAttribute('aria-label', ex.getAttribute('aria-label').replace(/^(Expand|Collapse) /, expanded ? 'Expand ' : 'Collapse '));
          ex.textContent = expanded ? '▶' : '▼';
          var children = ex.parentElement.nextElementSibling;
          if (children && children.classList.contains('tvm-debug-var-children')) {
            children.hidden = expanded;
          }
        });
      })(expanders[i]);
    }
  }

  function tagVariableExpanders(view) {
    view.querySelectorAll('.tvm-debug-expander').forEach(function (control) {
      const names = [];
      let row = control.parentElement;
      while (row) {
        names.unshift(row.querySelector('.tvm-debug-var-name').textContent);
        const children = row.parentElement.closest('.tvm-debug-var-children');
        row = children ? children.previousElementSibling : null;
      }
      const subsection = control.closest('[data-subsection]');
      control.dataset.debugFocus = 'expand:' + subsection.dataset.subsection + ':' + JSON.stringify(names);
    });
  }

  /** Capture expanded value paths before replacing variable rows. Call before
   * capturePanelInteraction so the focused expander has its stable path key.
   */
  function captureExpandedVariables(view) {
    tagVariableExpanders(view);
    return new Set(Array.from(view.querySelectorAll('.tvm-debug-expander[data-expanded="true"]'))
      .map(function (control) { return control.dataset.debugFocus; }));
  }

  /** Restore after wiring expander buttons, before restoring panel focus. */
  function restoreExpandedVariables(view, expanded) {
    tagVariableExpanders(view);
    view.querySelectorAll('.tvm-debug-expander').forEach(function (control) {
      if (expanded.has(control.dataset.debugFocus) && control.getAttribute('data-expanded') !== 'true') control.click();
    });
  }

  function wireVarEdits(view, dispatch) {
    var editables = view.querySelectorAll('.tvm-debug-var-editable');
    for (var k = 0; k < editables.length; k++) {
      (function (el) {
        el.addEventListener('click', function () { startInlineEdit(el, dispatch); });
      })(editables[k]);
    }
  }

  function startInlineEdit(valueEl, dispatch) {
    var key = valueEl.getAttribute('data-edit-key');
    if (!key) return;
    var parts = key.split('|');
    var scope = parts[0], frameIdx = +parts[1], name = parts[2];
    var originalText = valueEl.textContent;
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'tvm-debug-var-edit-input';
    input.value = originalText;
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('aria-label', 'New value for ' + name);
    valueEl.replaceWith(input);
    input.focus();
    input.select();
    var done = false;
    function commit(restoreFocus) {
      if (done) return; done = true;
      var expr = input.value;
      var unchanged = expr === originalText;
      if (!unchanged) {
        valueEl.textContent = expr;
        valueEl.setAttribute('aria-label', 'Edit ' + name + ': ' + expr);
        valueEl.classList.add('tvm-debug-var-edit-pending');
        valueEl.setAttribute('data-original-title', 'Applying edit… (was: ' + originalText + ')');
        valueEl.removeAttribute('title');
      }
      input.replaceWith(valueEl);
      if (restoreFocus) valueEl.focus({ preventScroll: true });
      if (!unchanged) {
        dispatch({ type: 'editVariable', scope: scope, frameIdx: frameIdx, name: name, expr: expr });
      }
    }
    function cancel() {
      if (done) return;
      done = true;
      input.replaceWith(valueEl);
      valueEl.focus({ preventScroll: true });
    }
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); commit(true); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); }
    });
    input.addEventListener('blur', function () {
      setTimeout(function () { if (input.isConnected) commit(false); }, 0);
    });
  }

  function resolveVarLocal(state, snap, frameIdx, scope, name) {
    var idx = state.historyIdx;
    var callId = snap.stack[frameIdx] && snap.stack[frameIdx].call_id;
    while (idx >= 0) {
      var s = state.history[idx];
      if (!s || !s.stack) { idx--; continue; }
      var f = null;
      for (var i = s.stack.length - 1; i >= 0; i--) {
        if (s.stack[i].call_id === callId) { f = s.stack[i]; break; }
      }
      if (f) {
        var d = f[scope];
        if (d && Object.prototype.hasOwnProperty.call(d, name)) {
          var v = d[name];
          if (v !== UNCHANGED) return v;
        }
      }
      idx--;
    }
    return null;
  }

  function displayFrameForSnapshot(snap, frameIdx) {
    if (!snap || !snap.stack) return null;
    var frame = snap.stack[frameIdx];
    if (!frame) return null;
    var topIdx = snap.stack.length - 1;
    if (frameIdx === topIdx && snap.watchpoint_origin) {
      var copy = {};
      for (var k in frame) copy[k] = frame[k];
      copy.file = snap.watchpoint_origin.file || frame.file;
      copy.line = snap.watchpoint_origin.line || frame.line;
      return copy;
    }
    return frame;
  }

  function displayLocationForSnapshot(snap) {
    var origin = snap && snap.watchpoint_origin;
    return {
      file: (origin && origin.file) || (snap && snap.file),
      line: (origin && origin.line) || (snap && snap.line),
    };
  }

  // -- Call stack -----------------------------------------------------------

  function renderCallStack(view, state, dispatch, helpers) {
    if (!view) return;
    helpers = defaultHelpers(helpers);
    const interaction = capturePanelInteraction(view);
    var hi = state.historyIdx;
    if (hi == null || hi < 0 || !state.history || !state.history[hi]) {
      view.innerHTML = '<div class="tvm-debug-empty">Start debugging to see the call stack.</div>';
      return;
    }
    var snap = state.history[hi];
    var rows = [];
    var selectedIdx = (state.selectedFrameIdx != null && state.selectedFrameIdx >= 0)
      ? state.selectedFrameIdx
      : (snap.stack.length - 1);
    for (var i = snap.stack.length - 1; i >= 0; i--) {
      var f = displayFrameForSnapshot(snap, i);
      var cls = 'tvm-debug-frame' + (i === selectedIdx ? ' active' : '');
      rows.push('<button type="button" class="' + cls + '" data-debug-focus="frame:' + i + '" data-frame-idx="' + i + '" aria-pressed="' + (i === selectedIdx) + '">' +
                '<span class="tvm-debug-frame-fn">' + helpers.escape(f.invocation || f.function) + '</span>' +
                '<span class="tvm-debug-frame-loc">' + helpers.escape(helpers.basename(f.file)) + ':' + f.line + '</span>' +
                '</button>');
    }
    view.innerHTML = '<div class="tvm-debug-stack">' + rows.join('') + '</div>';
    var frames = view.querySelectorAll('.tvm-debug-frame');
    for (var j = 0; j < frames.length; j++) {
      (function (frame) {
        frame.addEventListener('click', function () {
          var idx = +frame.getAttribute('data-frame-idx');
          dispatch({ type: 'setSelectedFrameIdx', idx: idx });
        });
      })(frames[j]);
    }
    restorePanelInteraction(view, interaction, '.tvm-debug-frame.active');
  }

  // -- Watch ----------------------------------------------------------------

  function renderWatch(view, state, dispatch, helpers) {
    if (!view) return;
    helpers = defaultHelpers(helpers);
    const interaction = capturePanelInteraction(view);
    if (state.backend === 'haskell') {
      view.innerHTML = '<p class="tvm-debug-language-note">Hover a pattern name in the source to see its type and value. While an equation is being chosen, the editor lists the arguments and every equation.</p>';
      return;
    }
    var isProlog = state.backend === 'prolog';
    var snap = (state.historyIdx != null && state.historyIdx >= 0 && state.history)
      ? state.history[state.historyIdx]
      : null;
    var watches = state.watches || [];
    var rows = [];
    for (var i = 0; i < watches.length; i++) {
      var expr = watches[i];
      var v = snap && snap.watches ? snap.watches[expr] : null;
      var valStr = v
        ? (v.error
            ? '<span class="tvm-debug-watch-error">' + helpers.escape(v.error) + '</span>'
            : helpers.escape(v.repr || v.preview || ''))
        : '<span class="tvm-debug-watch-na">—</span>';
      rows.push('<div class="tvm-debug-watch-row">' +
                '<span class="tvm-debug-watch-expr">' + helpers.escape(expr) + '</span>' +
                '<span class="tvm-debug-watch-arrow">→</span>' +
                '<span class="tvm-debug-watch-val">' + valStr + '</span>' +
                '<button type="button" class="tvm-debug-watch-action tvm-debug-watch-promote" data-debug-focus="watch-promote:' + helpers.escape(expr) + '" data-i="' + i + '" data-original-title="Watch for data value changes" aria-label="Watch for data value changes: ' + helpers.escape(expr) + '">' + debugManagerIcon('dataWatch') + '</button>' +
                '<button type="button" class="tvm-debug-watch-action tvm-debug-watch-remove" data-debug-focus="watch-remove:' + helpers.escape(expr) + '" data-i="' + i + '" data-original-title="Remove" aria-label="Remove watch: ' + helpers.escape(expr) + '">' + debugManagerIcon('trash') + '</button>' +
                '</div>');
    }
    view.innerHTML =
      '<div class="tvm-debug-watch-list">' + rows.join('') + '</div>' +
      '<form class="tvm-debug-watch-add">' +
      '<input type="text" class="tvm-debug-watch-input" data-debug-focus="watch-expression" data-debug-draft="true" placeholder="' + (isProlog ? 'Query variable (e.g. X)' : 'Add a Python expression to watch (e.g. len(items))') + '" aria-label="' + (isProlog ? 'Query variable to watch' : 'Watch expression') + '" />' +
      '<button type="submit" class="tvm-debug-watch-add-btn" data-debug-focus="watch-add">+ Add</button>' +
      '</form>' +
      (isProlog ? '<p class="tvm-debug-language-note">Watch a named variable from your query. Arbitrary Prolog goals are not evaluated.</p>' :
        (watches.length === 0 ? '<div class="tvm-debug-empty">Watches are evaluated on every step. Avoid expressions with side effects.</div>' : ''));

    var input = view.querySelector('.tvm-debug-watch-input');
    function add(event) {
      event.preventDefault();
      var expr = (input.value || '').trim();
      if (!expr) return;
      input.value = '';
      dispatch({ type: 'addWatch', expr: expr });
    }
    view.querySelector('.tvm-debug-watch-add').addEventListener('submit', add);
    var removeBtns = view.querySelectorAll('.tvm-debug-watch-remove');
    for (var i2 = 0; i2 < removeBtns.length; i2++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var idx = +btn.getAttribute('data-i');
          dispatch({ type: 'removeWatch', idx: idx });
        });
      })(removeBtns[i2]);
    }
    var promoteBtns = view.querySelectorAll('.tvm-debug-watch-promote');
    for (var p = 0; p < promoteBtns.length; p++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var idx = +btn.getAttribute('data-i');
          dispatch({ type: 'promoteWatchToWatchpoint', idx: idx });
        });
      })(promoteBtns[p]);
    }
    restorePanelInteraction(view, interaction, '.tvm-debug-watch-input');
  }

  // -- Breakpoint manager --------------------------------------------------

  function renderBreakpoints(view, state, dispatch, helpers) {
    if (!view) return;
    helpers = defaultHelpers(helpers);
    const interaction = capturePanelInteraction(view);
    var snap = (state.historyIdx != null && state.historyIdx >= 0 && state.history)
      ? state.history[state.historyIdx]
      : null;
    var bpRows = [];
    var breakpoints = state.breakpoints || {};
    Object.keys(breakpoints).sort().forEach(function (path) {
      var lines = Object.keys(breakpoints[path] || {}).map(function (n) { return +n; }).sort(function (a, b) { return a - b; });
      lines.forEach(function (line) {
        var info = breakpoints[path][line] || {};
        var cond = info.condition
          ? '<span class="tvm-debug-manager-condition">when ' + helpers.escape(info.condition) + '</span>'
          : (info.hitCount ? '' : '<span class="tvm-debug-manager-muted">unconditional</span>');
        var hits = info.hitCount
          ? '<span class="tvm-debug-manager-hitcount">after ' + info.hitCount + ' hits</span>'
          : '';
        var err = info.condError
          ? '<span class="tvm-debug-manager-error">' + helpers.escape(info.condError) + '</span>'
          : '';
        bpRows.push(
          '<div class="tvm-debug-manager-row tvm-debug-manager-code-row">' +
          '<span class="tvm-debug-manager-dot"></span>' +
          '<span class="tvm-debug-manager-main">' +
          '<span class="tvm-debug-manager-title">' + helpers.escape(helpers.basename(path)) + ':' + line + '</span>' +
          cond + hits + err +
          '</span>' +
          (state.backend === 'haskell' ? '' : '<button class="tvm-debug-manager-icon" data-bp-edit="1" data-path="' + helpers.escape(path) + '" data-line="' + line + '" data-original-title="Edit condition" aria-label="Edit condition">' + debugManagerIcon('edit') + '</button>') +
          '<button class="tvm-debug-manager-icon tvm-debug-manager-danger" data-bp-remove="1" data-path="' + helpers.escape(path) + '" data-line="' + line + '" data-original-title="Remove breakpoint" aria-label="Remove breakpoint">' + debugManagerIcon('trash') + '</button>' +
          '</div>'
        );
      });
    });

    var watchpoints = state.watchpoints || [];
    var wpRows = watchpoints.map(function (wp) {
      var v = snap && snap.watches ? snap.watches[wp.expr] : null;
      var disabled = wp.enabled === false;
      var toggleLabel = disabled ? 'Enable data watchpoint' : 'Disable data watchpoint';
      return '<div class="tvm-debug-manager-row tvm-debug-manager-watchpoint-row' + (disabled ? ' disabled' : '') + '">' +
        '<label class="tvm-debug-manager-toggle" data-original-title="' + toggleLabel + '">' +
        '<input type="checkbox" aria-label="' + toggleLabel + '" data-wp-toggle="' + helpers.escape(wp.id) + '"' + (disabled ? '' : ' checked') + '>' +
        '<span></span><em class="sr-only">' + toggleLabel + '</em>' +
        '</label>' +
        '<span class="tvm-debug-manager-main">' +
        '<span class="tvm-debug-manager-title">' + helpers.escape(wp.expr) + '</span>' +
        '<span class="tvm-debug-manager-value">' + renderWatchValue(v, helpers) + '</span>' +
        '</span>' +
        '<button class="tvm-debug-manager-icon" data-wp-run="' + helpers.escape(wp.id) + '" data-original-title="Run to this data value change" aria-label="Run to this data value change">' + debugManagerIcon('playData') + '</button>' +
        '<button class="tvm-debug-manager-icon" data-wp-back="' + helpers.escape(wp.id) + '" data-original-title="Run back to this data value change" aria-label="Run back to this data value change">' + debugManagerIcon('backData') + '</button>' +
        '<button class="tvm-debug-manager-icon tvm-debug-manager-danger" data-wp-remove="' + helpers.escape(wp.id) + '" data-original-title="Remove data watchpoint" aria-label="Remove data watchpoint">' + debugManagerIcon('trash') + '</button>' +
        '</div>';
    });
    var watchpointControls =
      '<form class="tvm-debug-manager-add tvm-debug-watchpoint-add">' +
      '<input type="text" class="tvm-debug-watchpoint-input" data-debug-focus="watchpoint-expression" data-debug-draft="true" placeholder="' + (state.backend === 'prolog' ? 'Query variable (e.g. X)' : 'Break when expression changes value') + '" aria-label="' + (state.backend === 'prolog' ? 'Query variable for data watchpoint' : 'Data watchpoint expression') + '" />' +
      '<button type="submit" class="tvm-debug-watchpoint-add-btn" data-debug-focus="watchpoint-add">' + debugManagerIcon('plus') + '<span>Add Data Watchpoint</span></button>' +
      '</form>' +
      '<div class="tvm-debug-manager-actions">' +
      '<button class="tvm-debug-manager-run" data-wp-run-all="1">' + debugManagerIcon('playData') + '<span>Run to Data Change</span></button>' +
      '<button class="tvm-debug-manager-run" data-wp-back-all="1">' + debugManagerIcon('backData') + '<span>Run Back to Data Change</span></button>' +
      '</div>';

    var exceptionBps = state.exceptionBreakpoints || [];
    var ebRows = exceptionBps.map(function (eb) {
      var disabled = eb.enabled === false;
      var typeAttr = helpers.escape(eb.type || '');
      var modeAll = eb.mode === 'all';
      var toggleLabel = disabled ? 'Enable exception breakpoint' : 'Disable exception breakpoint';
      return '<div class="tvm-debug-manager-row tvm-debug-manager-exception-row' + (disabled ? ' disabled' : '') + '" data-exc-bp="' + eb.id + '">' +
        '<label class="tvm-debug-manager-toggle" data-original-title="' + toggleLabel + '">' +
        '<input type="checkbox" aria-label="' + toggleLabel + '" data-exc-toggle="' + eb.id + '"' + (disabled ? '' : ' checked') + '>' +
        '<span></span><em class="sr-only">' + toggleLabel + '</em>' +
        '</label>' +
        '<span class="tvm-debug-manager-main">' +
        '<input type="text" class="tvm-debug-manager-exc-type" placeholder="Any exception type" data-original-title="Exception type filter" aria-label="Exception type filter" value="' + typeAttr + '" data-exc-type="' + eb.id + '" spellcheck="false" autocomplete="off">' +
        '<span class="tvm-debug-manager-exc-modes">' +
        '<label><input type="radio" name="exc-mode-' + eb.id + '" value="uncaught" data-exc-mode="' + eb.id + '"' + (modeAll ? '' : ' checked') + '>Uncaught</label>' +
        '<label><input type="radio" name="exc-mode-' + eb.id + '" value="all" data-exc-mode="' + eb.id + '"' + (modeAll ? ' checked' : '') + '>All raised</label>' +
        '</span>' +
        '</span>' +
        '<button class="tvm-debug-manager-icon" data-exc-run="' + eb.id + '" data-original-title="Run to this exception" aria-label="Run to this exception">' + debugManagerIcon('playException') + '</button>' +
        '<button class="tvm-debug-manager-icon" data-exc-back="' + eb.id + '" data-original-title="Run back to this exception" aria-label="Run back to this exception">' + debugManagerIcon('backException') + '</button>' +
        '<button class="tvm-debug-manager-icon tvm-debug-manager-danger" data-exc-remove="' + eb.id + '" data-original-title="Remove exception breakpoint" aria-label="Remove exception breakpoint">' + debugManagerIcon('trash') + '</button>' +
        '</div>';
    });
    var exceptionControls =
      '<div class="tvm-debug-manager-actions">' +
      '<button class="tvm-debug-manager-run" data-exc-add="1">' + debugManagerIcon('plus') + '<span>Add Exception Breakpoint</span></button>' +
      '<button class="tvm-debug-manager-run" data-exc-run-all="1">' + debugManagerIcon('playException') + '<span>Run to Exception</span></button>' +
      '<button class="tvm-debug-manager-run" data-exc-back-all="1">' + debugManagerIcon('backException') + '<span>Run Back to Exception</span></button>' +
      '</div>';

    view.innerHTML =
      '<div class="tvm-debug-manager">' +
      renderBreakpointGroup('manager-code-breakpoints', 'Code Breakpoints',
        (bpRows.length ? bpRows.join('') : '<div class="tvm-debug-empty-row">No code breakpoints.</div>') + breakpointFormHTML(state, helpers), helpers) +
      (state.backend === 'haskell' ? '' : renderBreakpointGroup('manager-data-watchpoints', 'Data Watchpoints',
        (wpRows.length ? wpRows.join('') : '<div class="tvm-debug-empty-row">No data watchpoints.</div>') + watchpointControls, helpers)) +
      (state.backend === 'prolog' || state.backend === 'haskell' ? '' : renderBreakpointGroup('manager-exception-breakpoints', 'Exception Breakpoints',
        (ebRows.length ? ebRows.join('') : '<div class="tvm-debug-empty-row">No exception breakpoints.</div>') + exceptionControls, helpers)) +
      '</div>';

    var input = view.querySelector('.tvm-debug-watchpoint-input');
    const addForm = view.querySelector('.tvm-debug-watchpoint-add');
    function add(event) {
      event.preventDefault();
      var expr = (input && input.value || '').trim();
      if (!expr) return;
      if (input) input.value = '';
      dispatch({ type: 'addWatchpoint', expr: expr });
    }
    if (addForm) addForm.addEventListener('submit', add);
    tagManagerControls(view);
    wireManagerButtons(view, state, dispatch);
    wireBreakpointGroups(view, helpers);
    restorePanelInteraction(view, interaction, '.tvm-debug-breakpoint-file');
    wireBreakpointForm(view, state, dispatch);
  }

  function tagManagerControls(view) {
    const attributes = ['bp-edit', 'bp-remove', 'wp-toggle', 'wp-run', 'wp-back', 'wp-remove', 'wp-run-all', 'wp-back-all',
      'exc-toggle', 'exc-type', 'exc-mode', 'exc-run', 'exc-back', 'exc-remove', 'exc-add', 'exc-run-all', 'exc-back-all', 'manager-group-toggle'];
    attributes.forEach(function (attribute) {
      view.querySelectorAll('[data-' + attribute + ']').forEach(function (control) {
        let identity = control.getAttribute('data-' + attribute);
        let prefix = attribute;
        if (attribute === 'bp-edit' || attribute === 'bp-remove') {
          prefix = attribute === 'bp-edit' ? 'breakpoint-edit' : 'breakpoint-remove';
          identity = control.dataset.path + ':' + control.dataset.line;
        }
        if (attribute === 'exc-mode') identity += ':' + control.value;
        if (attribute === 'exc-type') {
          prefix = 'exception-type';
          control.dataset.debugDraft = 'focus';
        }
        control.dataset.debugFocus = prefix + ':' + identity;
      });
    });
  }

  function renderBreakpointGroup(key, label, bodyHtml, helpers) {
    var collapsed = helpers.getSubsectionCollapsed(key);
    return '<section class="tvm-debug-manager-group' + (collapsed ? ' collapsed' : '') + '" data-manager-group="' + helpers.escape(key) + '">' +
      '<button type="button" class="tvm-debug-manager-heading" data-manager-group-toggle="' + helpers.escape(key) + '" aria-expanded="' + !collapsed + '">' +
      '<span class="tvm-debug-manager-chevron" aria-hidden="true">▾</span>' +
      '<span>' + helpers.escape(label) + '</span>' +
      '</button>' +
      '<div class="tvm-debug-manager-group-body">' + bodyHtml + '</div>' +
      '</section>';
  }

  function wireBreakpointGroups(view, helpers) {
    var heads = view.querySelectorAll('[data-manager-group-toggle]');
    for (var i = 0; i < heads.length; i++) {
      (function (head) {
        head.addEventListener('click', function () {
          var key = head.getAttribute('data-manager-group-toggle');
          var group = head.closest && head.closest('.tvm-debug-manager-group');
          if (!group) return;
          var nowCollapsed = !group.classList.contains('collapsed');
          group.classList.toggle('collapsed', nowCollapsed);
          head.setAttribute('aria-expanded', String(!nowCollapsed));
          helpers.setSubsectionCollapsed(key, nowCollapsed);
        });
      })(heads[i]);
    }
  }

  function renderWatchValue(v, helpers) {
    if (!v) return '<span class="tvm-debug-watch-na">—</span>';
    if (v.error) return '<span class="tvm-debug-watch-error">' + helpers.escape(v.error) + '</span>';
    return helpers.escape(v.repr || v.preview || '');
  }

  function wireManagerButtons(view, state, dispatch) {
    var editBtns = view.querySelectorAll('[data-bp-edit]');
    for (var i = 0; i < editBtns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          dispatch({ type: 'editBreakpointCondition', path: btn.getAttribute('data-path'), line: +btn.getAttribute('data-line') });
        });
      })(editBtns[i]);
    }
    var removeBtns = view.querySelectorAll('[data-bp-remove]');
    for (var j = 0; j < removeBtns.length; j++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          dispatch({ type: 'removeBreakpoint', path: btn.getAttribute('data-path'), line: +btn.getAttribute('data-line') });
        });
      })(removeBtns[j]);
    }
    var toggles = view.querySelectorAll('[data-wp-toggle]');
    for (var k = 0; k < toggles.length; k++) {
      (function (el) {
        el.addEventListener('change', function () { dispatch({ type: 'toggleWatchpoint', id: el.getAttribute('data-wp-toggle') }); });
      })(toggles[k]);
    }
    var runBtns = view.querySelectorAll('[data-wp-run]');
    for (var r = 0; r < runBtns.length; r++) {
      (function (btn) {
        btn.addEventListener('click', function () { dispatch({ type: 'runToWatchpoint', id: btn.getAttribute('data-wp-run') }); });
      })(runBtns[r]);
    }
    var backBtns = view.querySelectorAll('[data-wp-back]');
    for (var b = 0; b < backBtns.length; b++) {
      (function (btn) {
        btn.addEventListener('click', function () { dispatch({ type: 'runBackToWatchpoint', id: btn.getAttribute('data-wp-back') }); });
      })(backBtns[b]);
    }
    var wpRemoveBtns = view.querySelectorAll('[data-wp-remove]');
    for (var w = 0; w < wpRemoveBtns.length; w++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-wp-remove');
          var tutorialId = state && state.tutorialId;
          var pref = getWatchpointRemovePreference(tutorialId);
          function send(choice, remember) {
            if (remember) setWatchpointRemovePreference(tutorialId, choice);
            dispatch({ type: 'removeWatchpoint', id: id, choice: choice });
          }
          if (pref) {
            send(pref, false);
            return;
          }
          var watchpoints = (state && state.watchpoints) || [];
          var wp = null;
          for (var wi = 0; wi < watchpoints.length; wi++) {
            if (String(watchpoints[wi].id) === String(id)) {
              wp = watchpoints[wi];
              break;
            }
          }
          showRemoveWatchpointDialog(wp, view).then(function (result) {
            if (!result || !result.choice) return;
            send(result.choice, !!result.remember);
          });
        });
      })(wpRemoveBtns[w]);
    }
    var runAll = view.querySelector('[data-wp-run-all]');
    if (runAll) runAll.addEventListener('click', function () { dispatch({ type: 'runToWatchpoint' }); });
    var backAll = view.querySelector('[data-wp-back-all]');
    if (backAll) backAll.addEventListener('click', function () { dispatch({ type: 'runBackToWatchpoint' }); });

    var excToggles = view.querySelectorAll('[data-exc-toggle]');
    for (var et = 0; et < excToggles.length; et++) {
      (function (el) {
        el.addEventListener('change', function () { dispatch({ type: 'toggleExceptionBreakpoint', id: el.getAttribute('data-exc-toggle') }); });
      })(excToggles[et]);
    }
    var excTypes = view.querySelectorAll('[data-exc-type]');
    for (var ety = 0; ety < excTypes.length; ety++) {
      (function (el) {
        let committedValue = el.value;
        function commit(value) {
          if (value === committedValue) return;
          committedValue = value;
          dispatch({ type: 'editExceptionBreakpoint', id: el.getAttribute('data-exc-type'), exceptionType: committedValue });
        }
        el.addEventListener('blur', function (event) {
          const value = el.value;
          const nextControl = event.relatedTarget;
          // A microtask can run before native Tab focus settles. Wait until
          // the focus/click sequence finishes; ignore blur caused by redraw.
          setTimeout(function () {
            if (el.isConnected || nextControl) commit(value);
          }, 0);
        });
        el.addEventListener('keydown', function (event) {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            commit(el.value);
          }
        });
      })(excTypes[ety]);
    }
    var excModes = view.querySelectorAll('[data-exc-mode]');
    for (var em = 0; em < excModes.length; em++) {
      (function (el) {
        el.addEventListener('change', function () {
          if (!el.checked) return;
          dispatch({ type: 'editExceptionBreakpoint', id: el.getAttribute('data-exc-mode'), mode: el.value });
        });
      })(excModes[em]);
    }
    var excRunBtns = view.querySelectorAll('[data-exc-run]');
    for (var er = 0; er < excRunBtns.length; er++) {
      (function (btn) {
        btn.addEventListener('click', function () { dispatch({ type: 'runToExceptionBreakpoint', id: btn.getAttribute('data-exc-run') }); });
      })(excRunBtns[er]);
    }
    var excBackBtns = view.querySelectorAll('[data-exc-back]');
    for (var eb2 = 0; eb2 < excBackBtns.length; eb2++) {
      (function (btn) {
        btn.addEventListener('click', function () { dispatch({ type: 'runBackToExceptionBreakpoint', id: btn.getAttribute('data-exc-back') }); });
      })(excBackBtns[eb2]);
    }
    var excRemoveBtns = view.querySelectorAll('[data-exc-remove]');
    for (var ex = 0; ex < excRemoveBtns.length; ex++) {
      (function (btn) {
        btn.addEventListener('click', function () { dispatch({ type: 'removeExceptionBreakpoint', id: btn.getAttribute('data-exc-remove') }); });
      })(excRemoveBtns[ex]);
    }
    var excAddBtn = view.querySelector('[data-exc-add]');
    if (excAddBtn) excAddBtn.addEventListener('click', function () { dispatch({ type: 'addExceptionBreakpoint' }); });
    var excRunAllBtn = view.querySelector('[data-exc-run-all]');
    if (excRunAllBtn) excRunAllBtn.addEventListener('click', function () { dispatch({ type: 'runToExceptionBreakpoint' }); });
    var excBackAllBtn = view.querySelector('[data-exc-back-all]');
    if (excBackAllBtn) excBackAllBtn.addEventListener('click', function () { dispatch({ type: 'runBackToExceptionBreakpoint' }); });
  }

  // -- History --------------------------------------------------------------

  function renderHistory(view, state, dispatch, helpers) {
    if (!view) return;
    helpers = defaultHelpers(helpers);
    var focused = view.contains(document.activeElement) ? document.activeElement : null;
    var focusSlider = focused && focused.classList.contains('tvm-debug-history-slider');
    var focusedItem = focused && focused.classList.contains('tvm-debug-history-item') ? focused.getAttribute('data-i') : null;
    var hi = state.historyIdx;
    if (hi == null || hi < 0 || !state.history || state.history.length === 0) {
      view.innerHTML = '<div class="tvm-debug-empty">Start debugging to navigate execution history.</div>';
      return;
    }
    var n = state.history.length;
    var recorded = (state.backend === 'prolog' || state.backend === 'haskell') && !(state.session && state.session.active);
    var html = '<div class="tvm-debug-history-controls">' +
      '<input type="range" class="tvm-debug-history-slider" min="0" max="' + (n - 1) + '" value="' + hi + '" data-original-title="Execution history position" aria-label="Execution history position">' +
      '<span class="tvm-debug-history-pos">' + (hi + 1) + ' / ' + n + '</span>' +
      (hi === state.liveIdx
        ? '<span class="tvm-debug-history-live">● ' + (recorded ? 'recorded' : 'live') + '</span>'
        : '<span class="tvm-debug-history-rewound">⏮ rewound</span>') +
      '</div>';
    html += '<div class="tvm-debug-history-list">';
    var start = Math.max(0, hi - 50);
    var end = Math.min(n, start + 100);
    for (var i = start; i < end; i++) {
      var s = state.history[i];
      var loc = displayLocationForSnapshot(s);
      var marker = (i === hi) ? ' active' : '';
      var ev = s.event === 'call' ? '↳' : s.event === 'return' ? '↰' : s.event === 'exception' ? '⚠' : '·';
      html += '<button type="button" class="tvm-debug-history-item' + marker + '" data-i="' + i + '" aria-pressed="' + (i === hi) + '">' +
              '<span class="tvm-debug-history-i">' + (i + 1) + '</span>' +
              '<span class="tvm-debug-history-ev" aria-hidden="true">' + ev + '</span>' +
              '<span class="tvm-debug-history-loc">' + helpers.escape(helpers.basename(loc.file)) + ':' + loc.line + '</span>' +
              (s.description ? '<span class="tvm-debug-history-description">' + helpers.escape(s.description) + '</span>' : '') +
              '</button>';
    }
    html += '</div>';
    view.innerHTML = html;
    var slider = view.querySelector('.tvm-debug-history-slider');
    if (slider) slider.addEventListener('input', function () {
      dispatch({ type: 'setHistoryIdx', idx: +slider.value });
    });
    var items = view.querySelectorAll('.tvm-debug-history-item');
    for (var k = 0; k < items.length; k++) {
      (function (it) {
        it.addEventListener('click', function () {
          dispatch({ type: 'setHistoryIdx', idx: +it.getAttribute('data-i') });
        });
      })(items[k]);
    }
    // Seeking replaces the history markup; keep keyboard navigation on the
    // same control so consecutive arrow keys continue moving through it.
    if (focusSlider && slider) slider.focus({ preventScroll: true });
    else if (focusedItem != null) {
      for (var j = 0; j < items.length; j++) {
        if (items[j].getAttribute('data-i') === focusedItem) {
          items[j].focus({ preventScroll: true });
          break;
        }
      }
    }
  }

  window.SEBookDebuggerUI = {
    capturePanelInteraction: capturePanelInteraction,
    restorePanelInteraction: restorePanelInteraction,
    retainVariableFocus: retainVariableFocus,
    restoreVariableFocus: restoreVariableFocus,
    captureExpandedVariables: captureExpandedVariables,
    restoreExpandedVariables: restoreExpandedVariables,
    breakpointFormHTML: breakpointFormHTML,
    wireBreakpointForm: wireBreakpointForm,
    renderToolbar: renderToolbar,
    renderDebugView: renderDebugView,
    renderVariables: renderVariables,
    renderCallStack: renderCallStack,
    renderWatch: renderWatch,
    renderBreakpoints: renderBreakpoints,
    renderHistory: renderHistory,
    buildCombinedShell: buildCombinedShell,
    findSectionBody: findSectionBody,
  };
})();
