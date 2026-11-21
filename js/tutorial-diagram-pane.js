/**
 * Authored-diagram pane: a TutorialCode prototype mixin (load after
 * js/tutorial-code.js).
 *
 * Adds a Diagram view that shows authored ArchUML diagrams beside the code
 * editor, which stays visible:
 *
 *   showAuthoredDiagrams([{id, label, type, source}], {layout, open})
 *       render and switch to the Diagram view. layout 'split' (default) keeps
 *       the editor beside the pane; 'maximized' gives the pane the whole
 *       workspace until the learner needs code again (a file opens, Run,
 *       project search), which returns to split. open: false loads the
 *       diagrams and enables the view without switching to it.
 *
 * Workspace arrangement while the Diagram view is shown:
 *   maximized  the editor is hidden, the Files sidebar too (wide screens),
 *              and OUTPUT collapses to its bar, so Run stays in view;
 *   split      code beside the diagram; Files becomes a drawer, closed, so
 *              the two share the width.
 * The Editor view restores the workspace as the tutorial built it.
 *   hideAuthoredDiagrams()                             hide, clear, remove view
 *   setDiagramPaneAvailable(available, reason?)        enable or explain why not
 *
 * One pane element is created on first use as a third flex child of
 * .tvm-editor-body, after a keyboard-resizable divider. Several diagrams show
 * as tabs. ArchUML first fits a drawing that overflows the pane and offers
 * its own Fit/Restore control; while it is fitted, a hint says that a click
 * shows the clicked part at reading size (100%, where the smallest text has
 * the paragraph size). The zoom buttons step through ZOOM_LEVELS from the
 * drawing's current size, keep the middle of the view in place, and zoom out
 * into Fit rather than below it. The scrollable drawing is a
 * focusable region named by the diagram's auto-generated description.
 * Class names are this component's own: the live UML viewer owns .tvm-diagram-*.
 */
(function () {
  'use strict';

  var TutorialCode = window.TutorialCode;
  if (!TutorialCode) return;
  var proto = TutorialCode.prototype;

  var DIAGRAM_VIEW = {
    id: 'diagram',
    label: 'Diagram',
    className: 'tvm-view-btn-diagram',
    icon: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
      '<rect x="1" y="2" width="6" height="4" rx="0.8" stroke="currentColor" stroke-width="1.4"/>' +
      '<rect x="9" y="10" width="6" height="4" rx="0.8" stroke="currentColor" stroke-width="1.4"/>' +
      '<path d="M4 6 V12 H9" stroke="currentColor" stroke-width="1.3"/></svg>',
  };
  var DEFAULT_UNAVAILABLE_REASON = 'The diagram appears after you lock in your answer.';
  var MAXIMIZED_CLASS = 'tutorial-diagram-workspace--maximized';
  var RENDERERS = {
    class: 'UMLClassDiagram',
    sequence: 'UMLSequenceDiagram',
    state: 'UMLStateDiagram',
    component: 'UMLComponentDiagram',
    deployment: 'UMLDeploymentDiagram',
    usecase: 'UMLUseCaseDiagram',
    activity: 'UMLActivityDiagram',
  };
  // Zoom levels are shares of the drawing's readable width, where its smallest
  // text has the paragraph size (ArchUML's --uml-readable-width).
  var ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
  var READING_ZOOM = 1;
  var FIT_HINT = 'Click a part of the drawing to read it at full size, or use the + button.';
  var paneCount = 0;

  function paneMarkup(id) {
    return '<div class="tutorial-diagram-pane__bar">' +
        '<p class="tutorial-diagram-pane__title"></p>' +
        '<div class="tutorial-diagram-pane__tabs" role="tablist" aria-label="Diagrams" hidden></div>' +
        '<div class="tutorial-diagram-pane__tools" role="group" aria-label="Diagram view controls">' +
          '<button type="button" class="tutorial-diagram-pane__tool" data-diagram-zoom="out" aria-label="Zoom out"><span aria-hidden="true">−</span></button>' +
          '<span class="tutorial-diagram-pane__zoom">100%</span>' +
          '<button type="button" class="tutorial-diagram-pane__tool" data-diagram-zoom="in" aria-label="Zoom in"><span aria-hidden="true">+</span></button>' +
          '<button type="button" class="tutorial-diagram-pane__tool" data-diagram-zoom="reset">Reset zoom</button>' +
          '<button type="button" class="tutorial-diagram-pane__tool" data-diagram-layout aria-pressed="true">Code beside diagram</button>' +
          '<button type="button" class="tutorial-diagram-pane__tool" data-diagram-fullscreen aria-pressed="false">Full screen</button>' +
        '</div>' +
      '</div>' +
      '<p class="tutorial-diagram-pane__hint">' + FIT_HINT + '</p>' +
      '<p class="tutorial-diagram-pane__status" role="status"></p>' +
      '<div class="tutorial-diagram-pane__panel" id="' + id + '-panel">' +
        '<div class="tutorial-diagram-pane__canvas" tabindex="0" role="region" aria-label="No diagram yet"></div>' +
      '</div>';
  }

  function normalizeDiagrams(diagrams) {
    return (Array.isArray(diagrams) ? diagrams : []).filter(function (diagram) {
      return diagram && typeof diagram.source === 'string';
    }).map(function (diagram, index) {
      return {
        id: diagram.id || 'diagram-' + (index + 1),
        label: diagram.label || 'Diagram ' + (index + 1),
        type: String(diagram.type || 'class').trim().toLowerCase(),
        source: diagram.source,
      };
    });
  }

  function describe(diagram) {
    var describer = window.UMLAutoDescribe;
    var text = describer && typeof describer.describe === 'function'
      ? describer.describe(diagram.type, diagram.source) : '';
    return text || diagram.label;
  }

  function paragraph(className, text) {
    var node = document.createElement('p');
    node.className = className;
    node.textContent = text;
    return node;
  }

  function sourceBlock(source) {
    var pre = document.createElement('pre');
    pre.className = 'tutorial-diagram-pane__source';
    var code = document.createElement('code');
    code.textContent = source;
    pre.appendChild(code);
    return pre;
  }

  function isFitted(state) {
    return state.canvas.classList.contains('uml-fit-fitted');
  }

  function drawingOf(state) {
    return state.canvas.querySelector(':scope > svg');
  }

  // ArchUML writes --uml-readable-width on the SVG as "<w>px" or
  // "max(<w>px, <e>em)", where the em is the SVG's own font size.
  function readableWidth(svg) {
    var value = svg.style.getPropertyValue('--uml-readable-width');
    var px = /([\d.]+)px/.exec(value);
    var em = /([\d.]+)em/.exec(value);
    var width = px ? parseFloat(px[1]) : svg.viewBox.baseVal.width;
    if (em) width = Math.max(width, parseFloat(em[1]) * parseFloat(getComputedStyle(svg).fontSize));
    return width;
  }

  /** The drawing's shown width as a share of its readable width. */
  function drawingScale(svg) {
    var readable = readableWidth(svg);
    return readable > 0 ? svg.getBoundingClientRect().width / readable : 1;
  }

  // ArchUML shows its Fit/Restore control while the drawing overflows the
  // pane or is fitted to it.
  function fitControl(state) {
    var host = state.pane.querySelector('.uml-fit-controls');
    return host && !host.hidden ? host.querySelector('.uml-fit-button') : null;
  }

  /** The share of the readable width at which the whole drawing fits the canvas. */
  function fitScale(state, svg) {
    if (isFitted(state)) return drawingScale(svg);
    var canvas = state.canvas;
    var style = getComputedStyle(canvas);
    var width = canvas.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    var height = canvas.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    var box = svg.viewBox.baseVal;
    var readable = readableWidth(svg);
    return Math.min(width / readable, height * box.width / (readable * box.height));
  }

  function zoomInLevel(svg) {
    var scale = drawingScale(svg);
    var larger = ZOOM_LEVELS.filter(function (level) { return level > scale * 1.01; });
    return larger.length ? larger[0] : null;
  }

  // Zooming out stops above the fitted size: below it, Fit shows more.
  function zoomOutLevel(state, svg) {
    var scale = drawingScale(svg);
    var floor = fitControl(state) ? fitScale(state, svg) * 1.01 : 0;
    var smaller = ZOOM_LEVELS.filter(function (level) { return level < scale * 0.99 && level > floor; });
    return smaller.length ? smaller[smaller.length - 1] : null;
  }

  function setAvailable(button, available) {
    if (available) button.removeAttribute('aria-disabled');
    else button.setAttribute('aria-disabled', 'true');
  }

  function updateZoomControls(state) {
    var svg = drawingOf(state);
    var fitted = !!svg && isFitted(state);
    state.zoomLabel.textContent = fitted ? 'Fit' : Math.round(state.zoom * 100) + '%';
    setAvailable(state.zoomInButton, !!svg && zoomInLevel(svg) !== null);
    setAvailable(state.zoomOutButton, !!svg && !fitted &&
      (zoomOutLevel(state, svg) !== null || !!fitControl(state)));
  }

  function clampShare(value) {
    return Math.min(1, Math.max(0, value));
  }

  /** The drawing point in the middle of the visible canvas, as shares of the drawing's size. */
  function visibleCenter(state, svg) {
    if (isFitted(state)) return { x: 0.5, y: 0.5 };
    var view = state.canvas.getBoundingClientRect();
    var box = svg.getBoundingClientRect();
    return {
      x: clampShare((view.left + state.canvas.clientWidth / 2 - box.left) / box.width),
      y: clampShare((view.top + state.canvas.clientHeight / 2 - box.top) / box.height),
    };
  }

  /** Scroll a drawing point to the middle of the canvas, as far as scrolling allows. */
  function centerOn(state, svg, point) {
    var canvas = state.canvas;
    var view = canvas.getBoundingClientRect();
    var box = svg.getBoundingClientRect();
    canvas.scrollTo({
      left: canvas.scrollLeft + box.left - view.left + point.x * box.width - canvas.clientWidth / 2,
      top: canvas.scrollTop + box.top - view.top + point.y * box.height - canvas.clientHeight / 2,
      behavior: 'instant',
    });
  }

  // ArchUML's Fit view sets the drawing's width itself, so the pane enters
  // and leaves it through ArchUML's control, then puts focus back.
  function toggleFitView(state, focusAfter) {
    var control = fitControl(state);
    if (!control) return;
    control.click();
    if (focusAfter) focusAfter.focus({ preventScroll: true });
  }

  /**
   * Show the drawing at a zoom level with a point (shares of its size; by
   * default the middle of the current view) in the middle of the canvas.
   */
  function applyZoom(state, level, point, focusAfter) {
    var svg = drawingOf(state);
    if (!svg) return;
    var center = point || visibleCenter(state, svg);
    if (isFitted(state)) toggleFitView(state, focusAfter);
    state.zoom = level;
    state.canvas.style.setProperty('--tutorial-diagram-zoom', String(level));
    centerOn(state, svg, center);
    updateZoomControls(state);
  }

  function zoom(state, command, button) {
    var svg = drawingOf(state);
    if (!svg) return;
    if (command === 'reset') {
      applyZoom(state, READING_ZOOM, null, button);
      return;
    }
    var level = command === 'in' ? zoomInLevel(svg) : zoomOutLevel(state, svg);
    if (level !== null) applyZoom(state, level, null, button);
    else if (command === 'out' && !isFitted(state)) toggleFitView(state, button);
  }

  /** A click on a fitted drawing shows the clicked part at reading size. */
  function zoomToClick(state, event) {
    var svg = drawingOf(state);
    if (!svg || !isFitted(state) || !svg.contains(event.target)) return;
    var box = svg.getBoundingClientRect();
    applyZoom(state, READING_ZOOM, {
      x: clampShare((event.clientX - box.left) / box.width),
      y: clampShare((event.clientY - box.top) / box.height),
    }, state.canvas);
  }

  function syncFullscreen(state) {
    var active = document.fullscreenElement === state.pane;
    state.fullscreenButton.setAttribute('aria-pressed', active ? 'true' : 'false');
    state.fullscreenButton.textContent = active ? 'Exit full screen' : 'Full screen';
  }

  function toggleFullscreen(state) {
    var active = document.fullscreenElement === state.pane;
    var request;
    try {
      request = active ? document.exitFullscreen() : state.pane.requestFullscreen();
    } catch (error) {
      request = Promise.reject(error);
    }
    state.status.textContent = '';
    Promise.resolve(request).catch(function () {
      state.status.textContent = active
        ? 'The browser could not exit full screen. Use the browser’s full screen control.'
        : 'The browser could not show the diagram in full screen. It stays beside the code.';
    });
  }

  function exitPaneFullscreen(state) {
    if (document.fullscreenElement === state.pane) document.exitFullscreen().catch(function () {});
  }

  // ArchUML keeps one Fit/Restore state per container and forgets it once
  // that container's control is detached. Each diagram drawn here (a new
  // step, another tab) starts again from Fit, at zoom 100%.
  function resetView(state) {
    var host = state.panel.querySelector('.uml-fit-controls');
    if (host) host.remove();
    state.zoom = 1;
    state.canvas.style.setProperty('--tutorial-diagram-zoom', '1');
  }

  function renderActiveDiagram(state) {
    var diagram = state.diagrams[state.active];
    var canvas = state.canvas;
    resetView(state);
    canvas.replaceChildren();
    if (!diagram) {
      canvas.setAttribute('aria-label', 'No diagram yet');
      canvas.appendChild(paragraph('tutorial-diagram-pane__message', 'No diagram to show yet.'));
      updateZoomControls(state);
      return;
    }
    var renderer = window[RENDERERS[diagram.type]];
    var svg = null;
    if (renderer && typeof renderer.render === 'function') {
      try {
        renderer.render(canvas, diagram.source);
        svg = canvas.querySelector('svg');
      } catch (error) {
        svg = null;
      }
    }
    if (svg) {
      // The region's name carries the text alternative; the drawing is visual.
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      canvas.setAttribute('aria-label', describe(diagram));
    } else {
      canvas.replaceChildren(
        paragraph('tutorial-diagram-pane__message', 'This diagram could not be drawn. Its source follows.'),
        sourceBlock(diagram.source)
      );
      canvas.setAttribute('aria-label', 'Diagram source: ' + diagram.label);
    }
    updateZoomControls(state);
  }

  function syncTabs(state) {
    Array.prototype.forEach.call(state.tabs.children, function (tab, index) {
      var selected = index === state.active;
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      tab.tabIndex = selected ? 0 : -1;
    });
    if (state.diagrams.length > 1) state.panel.setAttribute('aria-labelledby', state.id + '-tab-' + state.active);
  }

  function renderTabs(state) {
    var many = state.diagrams.length > 1;
    state.tabs.replaceChildren();
    state.tabs.hidden = !many;
    state.title.hidden = many;
    state.title.textContent = !many && state.diagrams[0] ? state.diagrams[0].label : '';
    if (!many) {
      state.panel.removeAttribute('role');
      state.panel.removeAttribute('aria-labelledby');
      return;
    }
    state.diagrams.forEach(function (diagram, index) {
      var tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'tutorial-diagram-pane__tab';
      tab.id = state.id + '-tab-' + index;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', state.panel.id);
      tab.textContent = diagram.label;
      state.tabs.appendChild(tab);
    });
    state.panel.setAttribute('role', 'tabpanel');
    syncTabs(state);
  }

  function selectTab(state, index, moveFocus) {
    state.active = index;
    syncTabs(state);
    renderActiveDiagram(state);
    if (moveFocus) state.tabs.children[index].focus();
  }

  /** Arrange the workspace for the current view and layout (see the header). */
  function syncWorkspaceLayout(tutorial, state) {
    var shown = tutorial._currentView === 'diagram';
    state.workspace.classList.toggle(MAXIMIZED_CLASS, shown && state.layout === 'maximized');
    tutorial._setFileNavigatorDrawer(shown);
    var editor = tutorial.editor;
    if (editor) requestAnimationFrame(function () { editor.layout(); });
  }

  function wirePane(tutorial, state, signal) {
    state.pane.addEventListener('click', function (event) {
      var zoomButton = event.target.closest('[data-diagram-zoom]');
      if (zoomButton) zoom(state, zoomButton.getAttribute('data-diagram-zoom'), zoomButton);
      else if (event.target.closest('[data-diagram-fullscreen]')) toggleFullscreen(state);
      else if (event.target.closest('[data-diagram-layout]')) {
        tutorial._setAuthoredDiagramLayout(state.layout === 'split' ? 'maximized' : 'split');
      }
    });
    state.tabs.addEventListener('click', function (event) {
      var tab = event.target.closest('[role="tab"]');
      if (tab) selectTab(state, Array.prototype.indexOf.call(state.tabs.children, tab), false);
    });
    // Tabs pattern with automatic activation: arrows wrap, Home and End jump.
    state.tabs.addEventListener('keydown', function (event) {
      var count = state.diagrams.length;
      var next = null;
      if (event.key === 'ArrowRight') next = (state.active + 1) % count;
      else if (event.key === 'ArrowLeft') next = (state.active - 1 + count) % count;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = count - 1;
      if (next === null || event.altKey || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      selectTab(state, next, true);
    });
    document.addEventListener('fullscreenchange', function () { syncFullscreen(state); }, { signal: signal });
    state.canvas.addEventListener('click', function (event) { zoomToClick(state, event); });
    // ArchUML toggles Fit on the drawing's container; mirror it in the controls.
    var observer = new MutationObserver(function () { updateZoomControls(state); });
    observer.observe(state.canvas, { attributes: true, attributeFilter: ['class'] });
    signal.addEventListener('abort', function () {
      observer.disconnect();
      exitPaneFullscreen(state);
    });
  }

  /** Create the pane, its divider, and the Diagram view button once. */
  proto._ensureAuthoredDiagramPane = function () {
    if (this._authoredDiagram) return this._authoredDiagram;
    var workspace = this.root.querySelector('.tvm-workspace');
    var body = this.root.querySelector('.tvm-editor-body');
    var editorPane = this.root.querySelector('.tvm-editor-pane-left');
    if (!workspace || !body || !editorPane) return null;
    var id = 'tutorial-diagram-pane-' + (++paneCount);
    var divider = document.createElement('div');
    divider.className = 'tutorial-diagram-pane-divider';
    divider.hidden = true;
    var pane = document.createElement('section');
    pane.className = 'tutorial-diagram-pane';
    pane.hidden = true;
    pane.setAttribute('aria-label', 'Diagram');
    pane.innerHTML = paneMarkup(id);
    body.append(divider, pane);
    this._makeDraggable(divider, 'vertical', editorPane, pane);
    divider.setAttribute('aria-label', 'Resize code and diagram panes');
    var button = this._ensureWorkspaceViewButton(DIAGRAM_VIEW);
    var note = document.createElement('span');
    note.className = 'tvm-view-toggle-note';
    note.id = id + '-availability';
    note.hidden = true;
    if (button) button.after(note);
    var state = {
      id: id,
      pane: pane,
      divider: divider,
      editorPane: editorPane,
      button: button,
      note: note,
      title: pane.querySelector('.tutorial-diagram-pane__title'),
      tabs: pane.querySelector('.tutorial-diagram-pane__tabs'),
      zoomLabel: pane.querySelector('.tutorial-diagram-pane__zoom'),
      zoomInButton: pane.querySelector('[data-diagram-zoom="in"]'),
      zoomOutButton: pane.querySelector('[data-diagram-zoom="out"]'),
      fullscreenButton: pane.querySelector('[data-diagram-fullscreen]'),
      layoutButton: pane.querySelector('[data-diagram-layout]'),
      workspace: workspace,
      layout: 'split',
      needsRender: false,
      status: pane.querySelector('.tutorial-diagram-pane__status'),
      panel: pane.querySelector('.tutorial-diagram-pane__panel'),
      canvas: pane.querySelector('.tutorial-diagram-pane__canvas'),
      diagrams: [],
      active: 0,
      zoom: 1,
    };
    this._authoredDiagram = state;
    wirePane(this, state, this._lifecycleEvents.signal);
    return state;
  };

  /**
   * Enable the Diagram view, or disable it with a visible explanation that
   * is also the button's accessible description.
   * @param {boolean} available
   * @param {string} [reason]
   */
  proto.setDiagramPaneAvailable = function (available, reason) {
    var state = this._ensureAuthoredDiagramPane();
    if (!state || !state.button) return;
    state.button.hidden = false;
    if (available) {
      state.button.removeAttribute('aria-disabled');
      state.button.removeAttribute('aria-describedby');
      state.note.textContent = '';
      state.note.hidden = true;
    } else {
      state.button.setAttribute('aria-disabled', 'true');
      state.note.textContent = reason || DEFAULT_UNAVAILABLE_REASON;
      state.note.hidden = false;
      state.button.setAttribute('aria-describedby', state.note.id);
      if (this._currentView === 'diagram') this._setView('editor');
    }
    this._refreshViewToggle();
  };

  /**
   * Show authored diagrams; more than one appear as tabs.
   * @param {{id: string, label: string, type: string, source: string}[]} diagrams
   * @param {{layout?: 'split'|'maximized', open?: boolean}} [options]
   */
  proto.showAuthoredDiagrams = function (diagrams, options) {
    var state = this._ensureAuthoredDiagramPane();
    if (!state) return;
    options = options || {};
    state.diagrams = normalizeDiagrams(diagrams);
    state.active = 0;
    state.zoom = 1;
    state.canvas.style.setProperty('--tutorial-diagram-zoom', '1');
    this.setDiagramPaneAvailable(true);
    renderTabs(state);
    this._setAuthoredDiagramLayout(options.layout === 'maximized' ? 'maximized' : 'split');
    if (options.open === false && this._currentView !== 'diagram') {
      // ArchUML measures its container: draw when the view is first shown.
      state.needsRender = true;
      return;
    }
    // Show the pane before drawing: ArchUML measures its container.
    state.needsRender = false;
    this._setView('diagram');
    renderActiveDiagram(state);
  };

  /**
   * 'maximized' gives the Diagram view the whole workspace; 'split' shows
   * the editor beside (or, at 900px and below, above) the pane.
   */
  proto._setAuthoredDiagramLayout = function (layout) {
    var state = this._authoredDiagram;
    if (!state) return;
    state.layout = layout === 'maximized' ? 'maximized' : 'split';
    state.layoutButton.setAttribute('aria-pressed', state.layout === 'split' ? 'true' : 'false');
    syncWorkspaceLayout(this, state);
  };

  /**
   * The runtime's hook for "the learner wants code" (a file opened, Run,
   * project search): a maximized diagram returns to split, which brings the
   * editor, OUTPUT, and the Files drawer back beside it.
   */
  proto._onCodeRequested = function () {
    var state = this._authoredDiagram;
    if (state && state.layout === 'maximized' && this._currentView === 'diagram') this._setAuthoredDiagramLayout('split');
  };

  /** Hide the pane, discard its diagrams, and remove the Diagram view. */
  proto.hideAuthoredDiagrams = function () {
    var state = this._authoredDiagram;
    if (!state) return;
    exitPaneFullscreen(state);
    if (this._currentView === 'diagram') this._setView('editor');
    state.diagrams = [];
    state.active = 0;
    state.needsRender = false;
    renderTabs(state);
    renderActiveDiagram(state);
    if (state.button) {
      state.button.hidden = true;
      state.button.removeAttribute('aria-disabled');
      state.button.removeAttribute('aria-describedby');
    }
    state.note.textContent = '';
    state.note.hidden = true;
    this._refreshViewToggle();
  };

  /** Called by _setView after every view change. */
  proto._onWorkspaceViewChanged = function (view) {
    var state = this._authoredDiagram;
    if (!state) return;
    var shown = view === 'diagram';
    state.pane.hidden = !shown;
    state.divider.hidden = !shown;
    syncWorkspaceLayout(this, state);
    if (shown && state.needsRender) {
      state.needsRender = false;
      renderActiveDiagram(state);
    }
    if (!shown) {
      // Divider drags size the editor for the split; without the pane the
      // editor fills the row again.
      state.editorPane.style.flex = '';
      state.pane.style.flex = '';
      exitPaneFullscreen(state);
    }
  };
})();
