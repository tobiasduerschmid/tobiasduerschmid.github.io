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
        '<span class="tvm-debug-status"></span>' +
        '<button class="tvm-debug-step" data-cmd="continue" title="Continue (F5)"><i class="fa fa-play"></i></button>' +
        '<button class="tvm-debug-step" data-cmd="next"     title="Step Over (F10)"><i class="fa fa-forward-step"></i></button>' +
        '<button class="tvm-debug-step" data-cmd="step"     title="Step Into (F11)"><i class="fa fa-arrow-down"></i></button>' +
        '<button class="tvm-debug-step" data-cmd="return"   title="Step Out (Shift+F11)"><i class="fa fa-arrow-up"></i></button>' +
        '<span class="tvm-debug-divider"></span>' +
        '<button class="tvm-debug-step" data-cmd="back"     title="Step Back (Shift+F10)"><i class="fa fa-backward-step"></i></button>' +
        '<span class="tvm-debug-divider"></span>' +
        '<button class="tvm-debug-step" data-cmd="stop"     title="Stop (Shift+F5)"><i class="fa fa-stop"></i></button>';
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
      // Step Back & Stop are always available during a session.
      var alwaysOn = (cmd === 'back' || cmd === 'stop');
      b.disabled = !alwaysOn && disabled;
    }
    var statusEl = rootEl.querySelector('.tvm-debug-status');
    if (statusEl) {
      statusEl.textContent = session.status || '';
      statusEl.title = session.status || '';
    }
  }

  // -- Combined view shell --------------------------------------------------

  function buildCombinedShell(rootEl, helpers) {
    if (!rootEl || rootEl.dataset.shellBuilt) return;
    rootEl.dataset.shellBuilt = '1';
    var sections = [
      { key: 'watch',   label: 'Watch',       icon: 'fa-eye',                empty: 'Start debugging to see watches.' },
      { key: 'stack',   label: 'Call Stack',  icon: 'fa-layer-group',        empty: 'Start debugging to see the call stack.' },
      { key: 'vars',    label: 'Variables',   icon: 'fa-list',               empty: 'Start debugging to see variables.' },
      { key: 'history', label: 'History',     icon: 'fa-clock-rotate-left',  empty: 'Start debugging to navigate execution history.' },
    ];
    rootEl.innerHTML = sections.map(function (s) {
      var collapsed = helpers.getSectionCollapsed(s.key);
      return '<section class="tvm-dbg-section' + (collapsed ? ' collapsed' : '') +
             '" data-section="' + s.key + '">' +
             '<header class="tvm-dbg-section-head" data-section="' + s.key + '">' +
             '<span class="tvm-dbg-section-chevron">▾</span>' +
             '<i class="fa ' + s.icon + '"></i>' +
             '<span class="tvm-dbg-section-title">' + s.label + '</span>' +
             '</header>' +
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
    renderCallStack(findSectionBody(rootEl, 'stack'), state, dispatch, helpers);
    renderVariables(findSectionBody(rootEl, 'vars'), state, dispatch, helpers);
    renderHistory(findSectionBody(rootEl, 'history'), state, dispatch, helpers);
  }

  // -- Variables ------------------------------------------------------------

  function renderVariables(view, state, dispatch, helpers) {
    if (!view) return;
    helpers = defaultHelpers(helpers);
    var hi = state.historyIdx;
    if (hi == null || hi < 0 || !state.history || !state.history[hi]) {
      view.innerHTML = '<div class="tvm-debug-empty">Start debugging to see variables.</div>';
      return;
    }
    var snap = state.history[hi];
    var frameIdx = (state.selectedFrameIdx != null && state.selectedFrameIdx >= 0)
      ? state.selectedFrameIdx
      : (snap.stack.length - 1);
    var frame = snap.stack[frameIdx];
    if (!frame) { view.innerHTML = '<div class="tvm-debug-empty">No frame.</div>'; return; }
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
    view.innerHTML = html;
    wireExpanders(view);
    wireSubsectionToggles(view, helpers);
    wireVarEdits(view, dispatch);
  }

  function renderSubsection(key, label, contentHtml, helpers) {
    var collapsed = helpers.getSubsectionCollapsed(key);
    return '<div class="tvm-debug-subsection' + (collapsed ? ' collapsed' : '') +
           '" data-subsection="' + key + '">' +
           '<div class="tvm-debug-subsection-head">' +
           '<span class="tvm-debug-subsection-chevron">▾</span>' +
           '<span class="tvm-debug-subsection-title">' + label + '</span>' +
           '</div>' +
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
        aliasBadge = ' <span class="tvm-debug-alias" title="Same object as ' +
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
    var typeHtml = '<span class="tvm-debug-var-type">' + helpers.escape(val.type || val.kind || '') + '</span>';
    var editAttr = editKey ? ' data-edit-key="' + helpers.escape(editKey) + '" title="Click to edit"' : '';
    var valueHtml = '<span class="tvm-debug-var-value' + (editKey ? ' tvm-debug-var-editable' : '') + '"' + editAttr +
                    '>' + helpers.escape(val.repr || val.preview || '') + '</span>';
    var hasChildren = val.kind === 'collection' || (val.kind === 'object' && val.attrs && Object.keys(val.attrs).length);
    var expander = hasChildren
      ? '<span class="tvm-debug-expander" data-expanded="false">▶</span>'
      : '<span class="tvm-debug-expander-spacer"></span>';
    var row = '<div class="tvm-debug-var-row" style="padding-left:' + (depth * 14) + 'px">' +
              expander + nameHtml + typeHtml + valueHtml + (aliasBadge || '') + '</div>';
    if (hasChildren) {
      var childHtml = renderChildren(val, depth + 1, helpers);
      row += '<div class="tvm-debug-var-children" style="display:none">' + childHtml + '</div>';
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
          ex.textContent = expanded ? '▶' : '▼';
          var children = ex.parentElement.nextElementSibling;
          if (children && children.classList.contains('tvm-debug-var-children')) {
            children.style.display = expanded ? 'none' : 'block';
          }
        });
      })(expanders[i]);
    }
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
    valueEl.replaceWith(input);
    input.focus();
    input.select();
    var done = false;
    function commit() {
      if (done) return; done = true;
      var expr = input.value;
      var unchanged = expr === originalText;
      if (!unchanged) {
        valueEl.textContent = expr;
        valueEl.classList.add('tvm-debug-var-edit-pending');
        valueEl.setAttribute('title', 'Applying edit… (was: ' + originalText + ')');
      }
      input.replaceWith(valueEl);
      if (!unchanged) {
        dispatch({ type: 'editVariable', scope: scope, frameIdx: frameIdx, name: name, expr: expr });
      }
    }
    function cancel() { if (done) return; done = true; input.replaceWith(valueEl); }
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
    input.addEventListener('blur', commit);
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

  // -- Call stack -----------------------------------------------------------

  function renderCallStack(view, state, dispatch, helpers) {
    if (!view) return;
    helpers = defaultHelpers(helpers);
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
      var f = snap.stack[i];
      var cls = 'tvm-debug-frame' + (i === selectedIdx ? ' active' : '');
      rows.push('<div class="' + cls + '" data-frame-idx="' + i + '">' +
                '<span class="tvm-debug-frame-fn">' + helpers.escape(f.function) + '</span>' +
                '<span class="tvm-debug-frame-loc">' + helpers.escape(helpers.basename(f.file)) + ':' + f.line + '</span>' +
                '</div>');
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
  }

  // -- Watch ----------------------------------------------------------------

  function renderWatch(view, state, dispatch, helpers) {
    if (!view) return;
    helpers = defaultHelpers(helpers);
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
                '<button class="tvm-debug-watch-remove" data-i="' + i + '" title="Remove">×</button>' +
                '</div>');
    }
    view.innerHTML =
      '<div class="tvm-debug-watch-list">' + rows.join('') + '</div>' +
      '<div class="tvm-debug-watch-add">' +
      '<input type="text" class="tvm-debug-watch-input" placeholder="Add a Python expression to watch (e.g. len(items))" />' +
      '<button class="tvm-debug-watch-add-btn">+ Add</button>' +
      '</div>' +
      (watches.length === 0 ? '<div class="tvm-debug-empty">Watches are evaluated on every step. Avoid expressions with side effects.</div>' : '');

    var input = view.querySelector('.tvm-debug-watch-input');
    var addBtn = view.querySelector('.tvm-debug-watch-add-btn');
    function add() {
      var expr = (input.value || '').trim();
      if (!expr) return;
      dispatch({ type: 'addWatch', expr: expr });
      input.value = '';
    }
    if (addBtn) addBtn.addEventListener('click', add);
    if (input) input.addEventListener('keydown', function (e) { if (e.key === 'Enter') add(); });
    var removeBtns = view.querySelectorAll('.tvm-debug-watch-remove');
    for (var i2 = 0; i2 < removeBtns.length; i2++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var idx = +btn.getAttribute('data-i');
          dispatch({ type: 'removeWatch', idx: idx });
        });
      })(removeBtns[i2]);
    }
  }

  // -- History --------------------------------------------------------------

  function renderHistory(view, state, dispatch, helpers) {
    if (!view) return;
    helpers = defaultHelpers(helpers);
    var hi = state.historyIdx;
    if (hi == null || hi < 0 || !state.history || state.history.length === 0) {
      view.innerHTML = '<div class="tvm-debug-empty">Start debugging to navigate execution history.</div>';
      return;
    }
    var n = state.history.length;
    var html = '<div class="tvm-debug-history-controls">' +
      '<input type="range" class="tvm-debug-history-slider" min="0" max="' + (n - 1) + '" value="' + hi + '">' +
      '<span class="tvm-debug-history-pos">' + (hi + 1) + ' / ' + n + '</span>' +
      (hi === state.liveIdx
        ? '<span class="tvm-debug-history-live">● live</span>'
        : '<span class="tvm-debug-history-rewound">⏮ rewound</span>') +
      '</div>';
    html += '<div class="tvm-debug-history-list">';
    var start = Math.max(0, hi - 50);
    var end = Math.min(n, start + 100);
    for (var i = start; i < end; i++) {
      var s = state.history[i];
      var marker = (i === hi) ? ' active' : '';
      var ev = s.event === 'call' ? '↳' : s.event === 'return' ? '↰' : s.event === 'exception' ? '⚠' : '·';
      html += '<div class="tvm-debug-history-item' + marker + '" data-i="' + i + '">' +
              '<span class="tvm-debug-history-i">' + (i + 1) + '</span>' +
              '<span class="tvm-debug-history-ev">' + ev + '</span>' +
              '<span class="tvm-debug-history-loc">' + helpers.escape(helpers.basename(s.file)) + ':' + s.line + '</span>' +
              '</div>';
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
  }

  window.SEBookDebuggerUI = {
    renderToolbar: renderToolbar,
    renderDebugView: renderDebugView,
    renderVariables: renderVariables,
    renderCallStack: renderCallStack,
    renderWatch: renderWatch,
    renderHistory: renderHistory,
    buildCombinedShell: buildCombinedShell,
    findSectionBody: findSectionBody,
  };
})();
