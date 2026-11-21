/**
 * Authored-diagram pane: a TutorialCode prototype mixin (load after
 * js/tutorial-code.js).
 *
 * Adds a Diagram view that shows authored ArchUML diagrams beside the code
 * editor, which stays visible:
 *
 *   showAuthoredDiagrams([{id, label, type, source, links}], {layout, open})
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
 *   authoredDiagramSearchEntries()                     the loaded diagrams, for
 *                                                      project search
 *   revealDiagramText(diagramId, query, options)       show a search hit
 *   clearDiagramTextHighlights()                       remove the hit marks
 *
 * Code links: a diagram's optional links [{text, path, line}] turn every
 * label whose text equals a link's text into a linked label (underlined,
 * pointer cursor). Double-clicking it calls revealSource(path, line), which
 * returns a maximized diagram to split view beside the code; a single click
 * on it never zooms. The drawing is hidden from assistive technology, so a
 * "Code links" disclosure under it offers one button per link that does the
 * same.
 *
 * Find in diagram: Ctrl/Cmd+F with focus in the pane (or in the workspace
 * outside the code editor and text fields while the Diagram view is shown)
 * opens a find bar for the shown drawing. Every matching label is framed,
 * the current one more strongly; Enter and Shift+Enter (or Next/Previous
 * match) move between them at reading size, and Escape closes the bar and
 * returns focus. Ctrl/Cmd+Shift+F stays project search.
 *
 * Pinch zoom: wheel events with ctrlKey over the drawing (trackpad pinches,
 * Ctrl/Cmd+wheel) zoom continuously around the pointer, between Fit and the
 * largest zoom step, instead of zooming the page.
 *
 * Search hits: revealDiagramText shows the Diagram view on that diagram's
 * tab, frames every label that matches the query (an outline and a fill
 * behind the text), and shows the first at reading size. The marks go when
 * the search changes or closes, or another diagram is drawn.
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
  var FIT_HINT_WITH_LINKS = 'Click a part of the drawing to read it at full size; double-click an underlined name to open its code.';
  var LINK_CLASS = 'tutorial-diagram-pane__link';
  var HIT_CLASS = 'tutorial-diagram-pane__text-hit';
  var HIT_BOX_CLASS = 'tutorial-diagram-pane__hit-box';
  var HIT_BOX_PADDING = 3;
  var CURRENT_HIT_CLASS = 'tutorial-diagram-pane__hit-box--current';
  var SVG_NS = 'http://www.w3.org/2000/svg';
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
      '<div class="tutorial-diagram-pane__find" role="search" aria-label="Find in diagram" hidden>' +
        '<label class="tutorial-diagram-pane__find-label" for="' + id + '-find">Find in diagram</label>' +
        '<input class="tutorial-diagram-pane__find-input" type="search" id="' + id + '-find" autocomplete="off" spellcheck="false" enterkeyhint="search">' +
        '<label class="tutorial-diagram-pane__find-option"><input type="checkbox" data-diagram-find-case> Match case</label>' +
        '<button type="button" class="tutorial-diagram-pane__tool" data-diagram-find="previous">Previous match</button>' +
        '<button type="button" class="tutorial-diagram-pane__tool" data-diagram-find="next">Next match</button>' +
        '<button type="button" class="tutorial-diagram-pane__tool" data-diagram-find="close">Close find</button>' +
        '<p class="tutorial-diagram-pane__find-status" role="status"></p>' +
      '</div>' +
      '<p class="tutorial-diagram-pane__hint">' + FIT_HINT + '</p>' +
      '<p class="tutorial-diagram-pane__status" role="status"></p>' +
      '<div class="tutorial-diagram-pane__panel" id="' + id + '-panel">' +
        '<div class="tutorial-diagram-pane__canvas" tabindex="0" role="region" aria-label="No diagram yet" aria-keyshortcuts="Control+F Meta+F"></div>' +
        '<details class="tutorial-diagram-pane__links" hidden>' +
          '<summary class="tutorial-diagram-pane__links-summary">Code links</summary>' +
          '<p class="tutorial-diagram-pane__links-hint">Each button opens the code behind a name in the drawing, as a double-click on the underlined name does.</p>' +
          '<ul class="tutorial-diagram-pane__links-list"></ul>' +
        '</details>' +
      '</div>';
  }

  /** Valid code links of a diagram: {text, path, line} with a 1-based line. */
  function normalizeLinks(links) {
    return (Array.isArray(links) ? links : []).filter(function (link) {
      return link && typeof link.text === 'string' && link.text.trim() &&
        typeof link.path === 'string' && link.path && Number(link.line) >= 1;
    }).map(function (link) {
      return { text: link.text.trim(), path: link.path, line: Math.floor(Number(link.line)) };
    });
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
        links: normalizeLinks(diagram.links),
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

  /** Leave Fit if needed and size the drawing at a zoom level. */
  function setZoom(state, level, focusAfter) {
    if (isFitted(state)) toggleFitView(state, focusAfter);
    state.zoom = level;
    state.canvas.style.setProperty('--tutorial-diagram-zoom', String(level));
  }

  /**
   * Show the drawing at a zoom level with a point (shares of its size; by
   * default the middle of the current view) in the middle of the canvas.
   */
  function applyZoom(state, level, point, focusAfter) {
    var svg = drawingOf(state);
    if (!svg) return;
    var center = point || visibleCenter(state, svg);
    setZoom(state, level, focusAfter);
    centerOn(state, svg, center);
    updateZoomControls(state);
  }

  // A pinch (or Ctrl/Cmd+wheel) step scales by exp(-deltaY * PINCH_RATE);
  // one mouse-wheel notch is capped so it zooms by at most about 1.6×.
  var PINCH_RATE = 0.01;
  var PINCH_MAX_DELTA = 50;
  var WHEEL_LINE_PX = 16;

  /**
   * Pinch zoom: wheel events with ctrlKey (trackpad pinches, Ctrl/Cmd+wheel)
   * zoom continuously around the pointer, between Fit and the largest zoom
   * step; the point under the pointer stays put. Other wheel events scroll.
   */
  function pinchZoom(state, event) {
    var svg = drawingOf(state);
    if (!event.ctrlKey || !svg) return;
    event.preventDefault();
    var delta = event.deltaY * (event.deltaMode === 1 ? WHEEL_LINE_PX : 1);
    delta = Math.max(-PINCH_MAX_DELTA, Math.min(PINCH_MAX_DELTA, delta));
    var fitted = isFitted(state);
    var scale = fitted ? drawingScale(svg) : state.zoom;
    var hasFit = !!fitControl(state);
    var floor = hasFit ? fitScale(state, svg) : ZOOM_LEVELS[0];
    var ceiling = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
    var level = Math.min(ceiling, Math.max(floor, scale * Math.exp(-delta * PINCH_RATE)));
    if (hasFit && level <= floor * 1.001) {
      // Zooming out ends in Fit, as the Zoom out button does.
      if (!fitted) toggleFitView(state, state.canvas);
      updateZoomControls(state);
      return;
    }
    if (level === scale && !fitted) return;
    var anchor = pinchAnchor(state, svg, event);
    setZoom(state, level, state.canvas);
    keepAnchor(state, svg, anchor);
    updateZoomControls(state);
    // ArchUML may adjust the layout once the drawing starts to overflow
    // (its Fit control appears); put the point back after that settles.
    cancelAnimationFrame(state.pinchFrame);
    state.pinchFrame = requestAnimationFrame(function () { keepAnchor(state, svg, anchor); });
  }

  var PINCH_GESTURE_MS = 400;
  var PINCH_POINTER_SLOP_PX = 4;

  /**
   * The drawing point a pinch holds under the pointer: the point under it when
   * the gesture began, so that steps where scrolling could not keep it (the
   * drawing still smaller than the pane) are made up once it can.
   */
  function pinchAnchor(state, svg, event) {
    var previous = state.pinch;
    var now = Date.now();
    if (previous && now - previous.time < PINCH_GESTURE_MS &&
        Math.abs(previous.clientX - event.clientX) <= PINCH_POINTER_SLOP_PX &&
        Math.abs(previous.clientY - event.clientY) <= PINCH_POINTER_SLOP_PX) {
      previous.time = now;
      return previous;
    }
    var box = svg.getBoundingClientRect();
    state.pinch = {
      time: now,
      clientX: event.clientX,
      clientY: event.clientY,
      x: clampShare((event.clientX - box.left) / box.width),
      y: clampShare((event.clientY - box.top) / box.height),
    };
    return state.pinch;
  }

  /** Scroll so the anchor's drawing point is under its pointer position, as far as scrolling allows. */
  function keepAnchor(state, svg, anchor) {
    var box = svg.getBoundingClientRect();
    state.canvas.scrollBy({
      left: box.left + anchor.x * box.width - anchor.clientX,
      top: box.top + anchor.y * box.height - anchor.clientY,
      behavior: 'instant',
    });
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

  /** A drawing label's text as matched against links and searches. */
  function labelText(node) {
    return node.textContent.replace(/\s+/g, ' ').trim();
  }

  function linkedLabel(target) {
    return target && target.closest ? target.closest('.' + LINK_CLASS) : null;
  }

  /**
   * A click on a fitted drawing shows the clicked part at reading size. A
   * click on a linked label is the first half of its double-click, so it
   * does not zoom.
   */
  function zoomToClick(state, event) {
    var svg = drawingOf(state);
    if (!svg || !isFitted(state) || !svg.contains(event.target) || linkedLabel(event.target)) return;
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

  /** The text nodes of the drawing's labels, in document order. */
  function labelTextNodes(svg) {
    var nodes = [];
    Array.prototype.forEach.call(svg.querySelectorAll('text'), function (label) {
      var walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) nodes.push(walker.currentNode);
    });
    return nodes;
  }

  /**
   * Make each `path:line` of a project file inside a label (a diagram note's
   * citation) a linked tspan of its own, and return the references as links,
   * one per distinct target, after the authored ones (from index `first`).
   */
  function linkSourceReferences(state, svg, first) {
    var api = window.TutorialSourceLinks;
    var tutorial = state.tutorial;
    if (!api || !tutorial || typeof tutorial.hasProjectFile !== 'function') return [];
    var isProjectFile = function (path) { return tutorial.hasProjectFile(path); };
    var found = [];
    var byTarget = new Map();
    labelTextNodes(svg).forEach(function (node) {
      var refs = api.findSourceReferences(node.nodeValue, isProjectFile);
      if (!refs.length) return;
      refs.forEach(function (ref) {
        var key = ref.path + ':' + ref.line + ':' + ref.column;
        if (!byTarget.has(key)) {
          byTarget.set(key, first + found.length);
          found.push({ text: ref.text, path: ref.path, line: ref.line, column: ref.column, reference: true });
        }
        ref.index = byTarget.get(key);
      });
      splitReferences(node, refs);
    });
    return found;
  }

  /** Wrap each reference of a text node in a linked tspan, last first so offsets hold. */
  function splitReferences(node, refs) {
    for (var i = refs.length - 1; i >= 0; i--) {
      var ref = refs[i];
      var part = node.splitText(ref.start);
      part.splitText(ref.end - ref.start);
      var span = document.createElementNS(SVG_NS, 'tspan');
      span.setAttribute('class', LINK_CLASS);
      span.setAttribute('data-diagram-link', String(ref.index));
      part.parentNode.replaceChild(span, part);
      span.appendChild(part);
    }
  }

  function linkButton(link, index) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'tutorial-diagram-pane__link-button';
    button.setAttribute('data-diagram-link', String(index));
    var target = document.createElement('code');
    target.className = 'tutorial-diagram-pane__link-target';
    target.textContent = link.reference ? link.text : link.path + ':' + link.line;
    if (link.reference) {
      // A citation from a note: its own text says where it goes.
      button.setAttribute('aria-label', 'Open ' + link.path + ' at line ' + link.line);
      button.appendChild(target);
      return button;
    }
    var name = document.createElement('span');
    name.className = 'tutorial-diagram-pane__link-name';
    name.textContent = link.text;
    var arrow = document.createElement('span');
    arrow.className = 'tutorial-diagram-pane__link-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '→';
    // The arrow is decorative; the name reads "Notifications, opens services/…:25".
    button.setAttribute('aria-label', link.text + ', opens ' + link.path + ':' + link.line);
    button.append(name, arrow, target);
    return button;
  }

  /**
   * Mark each label that a link names and each `path:line` citation of a
   * project file, and list them all under the drawing (state.shownLinks).
   */
  function renderLinks(state, diagram, svg) {
    var authored = diagram && svg ? diagram.links : [];
    state.linksList.replaceChildren();
    var byText = new Map();
    authored.forEach(function (link, index) { if (!byText.has(link.text)) byText.set(link.text, index); });
    if (svg) {
      Array.prototype.forEach.call(svg.querySelectorAll('text'), function (node) {
        var index = byText.get(labelText(node));
        if (index === undefined) return;
        node.classList.add(LINK_CLASS);
        node.setAttribute('data-diagram-link', String(index));
      });
    }
    var links = svg ? authored.concat(linkSourceReferences(state, svg, authored.length)) : [];
    state.shownLinks = links;
    state.links.hidden = !links.length;
    state.hint.textContent = links.length ? FIT_HINT_WITH_LINKS : FIT_HINT;
    links.forEach(function (link, index) {
      var item = document.createElement('li');
      item.appendChild(linkButton(link, index));
      state.linksList.appendChild(item);
    });
  }

  function openLink(tutorial, state, index) {
    var link = (state.shownLinks || [])[index];
    if (!link) return;
    state.status.textContent = '';
    if (typeof tutorial.revealSource !== 'function' || !tutorial.revealSource(link.path, link.line, link.column)) {
      state.status.textContent = link.path + ' is not part of this step.';
    }
  }

  /** The labels of the shown drawing that match a query, in document order. */
  function matchingLabels(state, query, options) {
    var svg = drawingOf(state);
    if (!svg) return [];
    var search = window.TutorialProjectSearch;
    // Without project search on the page, a plain substring match.
    var matches = search ? search.textMatches : function (text, wanted, settings) {
      if (!wanted) return false;
      return settings && settings.matchCase ? text.indexOf(wanted) !== -1
        : text.toLowerCase().indexOf(wanted.toLowerCase()) !== -1;
    };
    return Array.prototype.filter.call(svg.querySelectorAll('text'), function (node) {
      return matches(labelText(node), query, options);
    });
  }

  /** Show a label at reading size in the middle of the canvas. */
  function zoomToLabel(state, node, focusAfter) {
    var svg = drawingOf(state);
    if (svg) applyZoom(state, READING_ZOOM, pointOf(svg, node), focusAfter);
  }

  function clearHits(state) {
    Array.prototype.forEach.call(state.canvas.querySelectorAll('.' + HIT_BOX_CLASS), function (box) { box.remove(); });
    Array.prototype.forEach.call(state.canvas.querySelectorAll('.' + HIT_CLASS), function (node) { node.classList.remove(HIT_CLASS); });
  }

  /** Frame a label: a rectangle behind it, in the label's own coordinates. */
  function markHit(node) {
    // Bold first: the frame must fit the label as it is shown.
    node.classList.add(HIT_CLASS);
    var box = node.getBBox();
    var frame = document.createElementNS(SVG_NS, 'rect');
    frame.setAttribute('class', HIT_BOX_CLASS);
    frame.setAttribute('x', String(box.x - HIT_BOX_PADDING));
    frame.setAttribute('y', String(box.y - HIT_BOX_PADDING));
    frame.setAttribute('width', String(box.width + 2 * HIT_BOX_PADDING));
    frame.setAttribute('height', String(box.height + 2 * HIT_BOX_PADDING));
    frame.setAttribute('rx', '2');
    var transform = node.getAttribute('transform');
    if (transform) frame.setAttribute('transform', transform);
    node.parentNode.insertBefore(frame, node);
  }

  /** The middle of a label, as shares of the drawing's size. */
  function pointOf(svg, node) {
    var box = svg.getBoundingClientRect();
    var label = node.getBoundingClientRect();
    return {
      x: clampShare((label.left + label.width / 2 - box.left) / box.width),
      y: clampShare((label.top + label.height / 2 - box.top) / box.height),
    };
  }

  function renderActiveDiagram(state) {
    var diagram = state.diagrams[state.active];
    var canvas = state.canvas;
    resetView(state);
    canvas.replaceChildren();
    state.status.textContent = '';
    if (!diagram) {
      canvas.setAttribute('aria-label', 'No diagram yet');
      canvas.appendChild(paragraph('tutorial-diagram-pane__message', 'No diagram to show yet.'));
      renderLinks(state, null, null);
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
    renderLinks(state, diagram, svg);
    updateZoomControls(state);
    if (state.find && !state.find.bar.hidden) refreshFind(state, false);
  }

  // ----- Find in diagram (Ctrl/Cmd+F) -----------------------------------------

  /** Mark every match of the find query, the current one more strongly. */
  function refreshFind(state, zoomToCurrent) {
    var find = state.find;
    clearHits(state);
    state.status.textContent = '';
    var query = find.input.value;
    find.matches = query ? matchingLabels(state, query, { matchCase: find.matchCase.checked }) : [];
    if (find.current >= find.matches.length) find.current = 0;
    find.matches.forEach(markHit);
    showCurrentMatch(state, zoomToCurrent);
  }

  function showCurrentMatch(state, zoomToCurrent) {
    var find = state.find;
    Array.prototype.forEach.call(state.canvas.querySelectorAll('.' + CURRENT_HIT_CLASS), function (box) {
      box.classList.remove(CURRENT_HIT_CLASS);
    });
    if (!find.input.value) {
      find.status.textContent = '';
      return;
    }
    if (!find.matches.length) {
      find.status.textContent = 'No matches';
      return;
    }
    var node = find.matches[find.current];
    node.previousElementSibling.classList.add(CURRENT_HIT_CLASS);
    find.status.textContent = (find.current + 1) + ' of ' + find.matches.length;
    if (zoomToCurrent) zoomToLabel(state, node, find.input);
  }

  function stepFind(state, step) {
    var find = state.find;
    if (!find.matches.length) return;
    find.current = (find.current + step + find.matches.length) % find.matches.length;
    showCurrentMatch(state, true);
  }

  function openFind(state) {
    var find = state.find;
    if (find.bar.hidden) {
      var active = document.activeElement;
      find.opener = active && active !== document.body && !find.bar.contains(active) ? active : null;
      find.bar.hidden = false;
      if (find.input.value) refreshFind(state, true);
    }
    find.input.focus();
    find.input.select();
  }

  function closeFind(state) {
    var find = state.find;
    if (find.bar.hidden) return;
    find.bar.hidden = true;
    find.matches = [];
    find.status.textContent = '';
    clearHits(state);
    var target = find.opener && find.opener.isConnected ? find.opener : state.canvas;
    find.opener = null;
    target.focus({ preventScroll: true });
  }

  function isFindShortcut(event) {
    return (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey &&
      (event.code === 'KeyF' || String(event.key).toLowerCase() === 'f');
  }

  /**
   * Whether Ctrl/Cmd+F belongs to the diagram find bar: focus in the pane,
   * or the Diagram view shown with focus elsewhere in the workspace. The code
   * editor keeps its own find, a text field outside the pane and the rest of
   * the page keep the browser's.
   */
  function ownsFindShortcut(tutorial, state, target) {
    if (!target || !target.closest) return false;
    if (state.pane.contains(target)) return true;
    if (tutorial._currentView !== 'diagram' || !target.closest('.tvm-workspace')) return false;
    return !target.closest('.monaco-editor, input, textarea, select, [contenteditable="true"], dialog[open]');
  }

  function wireFind(tutorial, state, signal) {
    var bar = state.pane.querySelector('.tutorial-diagram-pane__find');
    var find = state.find = {
      bar: bar,
      input: bar.querySelector('.tutorial-diagram-pane__find-input'),
      matchCase: bar.querySelector('[data-diagram-find-case]'),
      status: bar.querySelector('.tutorial-diagram-pane__find-status'),
      matches: [],
      current: 0,
      opener: null,
    };
    tutorial.root.addEventListener('keydown', function (event) {
      if (!isFindShortcut(event) || state.pane.hidden || !ownsFindShortcut(tutorial, state, event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      openFind(state);
    }, { signal: signal });
    find.input.addEventListener('input', function () {
      find.current = 0;
      refreshFind(state, true);
    });
    find.matchCase.addEventListener('change', function () {
      find.current = 0;
      refreshFind(state, true);
    });
    bar.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        // Also keeps the search field's native Escape from clearing the query.
        event.preventDefault();
        event.stopPropagation();
        closeFind(state);
      } else if (event.key === 'Enter' && event.target === find.input) {
        event.preventDefault();
        stepFind(state, event.shiftKey ? -1 : 1);
      }
    });
    bar.addEventListener('click', function (event) {
      var control = event.target.closest('[data-diagram-find]');
      if (!control) return;
      var command = control.getAttribute('data-diagram-find');
      if (command === 'close') closeFind(state);
      else stepFind(state, command === 'next' ? 1 : -1);
    });
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
    state.canvas.addEventListener('wheel', function (event) { pinchZoom(state, event); }, { passive: false });
    wireFind(tutorial, state, signal);
    state.canvas.addEventListener('dblclick', function (event) {
      var label = linkedLabel(event.target);
      if (!label) return;
      event.preventDefault();
      openLink(tutorial, state, Number(label.getAttribute('data-diagram-link')));
    });
    state.linksList.addEventListener('click', function (event) {
      var button = event.target.closest('button[data-diagram-link]');
      if (button) openLink(tutorial, state, Number(button.getAttribute('data-diagram-link')));
    });
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
      tutorial: this,
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
      hint: pane.querySelector('.tutorial-diagram-pane__hint'),
      links: pane.querySelector('.tutorial-diagram-pane__links'),
      linksList: pane.querySelector('.tutorial-diagram-pane__links-list'),
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

  /**
   * The diagrams the learner can see in the Diagram pane, as project-search
   * entries. Empty until a diagram is loaded (for a challenge, after
   * lock-in), so search never reveals a locked diagram.
   * @returns {{path: string, content: string, kind: 'diagram', diagramId: string, label: string}[]}
   */
  proto.authoredDiagramSearchEntries = function () {
    var state = this._authoredDiagram;
    if (!state) return [];
    return state.diagrams.map(function (diagram) {
      return { path: 'diagram:' + diagram.id, content: diagram.source, kind: 'diagram', diagramId: diagram.id, label: diagram.label };
    });
  };

  /**
   * Show a project-search hit: the Diagram view (in its current layout) on
   * the diagram's tab, every label that matches the query framed, and the
   * first at reading size. Returns false when no loaded diagram has the id.
   * @param {string} diagramId
   * @param {string} query
   * @param {{matchCase?: boolean, wholeWord?: boolean, regex?: boolean}} [options]
   */
  proto.revealDiagramText = function (diagramId, query, options) {
    var state = this._authoredDiagram;
    var index = state ? state.diagrams.findIndex(function (diagram) { return diagram.id === diagramId; }) : -1;
    if (index === -1) return false;
    // Search lives in the Files sidebar, which the Diagram view folds into a
    // closed drawer; keep it open so the learner can go on to the next result.
    var sidebar = this._fileSidebarEl;
    var filesOpen = !!(sidebar && sidebar.open);
    if (this._currentView !== 'diagram') {
      if (index !== state.active) {
        state.active = index;
        syncTabs(state);
        state.needsRender = true;
      }
      this._setView('diagram');
    } else if (index !== state.active) {
      selectTab(state, index, false);
    }
    if (filesOpen) sidebar.open = true;
    // Project search takes over the marks from an open find bar.
    if (!state.find.bar.hidden) {
      state.find.bar.hidden = true;
      state.find.status.textContent = '';
    }
    clearHits(state);
    if (!drawingOf(state)) return true;
    var hits = matchingLabels(state, query, options);
    hits.forEach(markHit);
    var label = state.diagrams[index].label;
    state.status.textContent = hits.length
      ? (hits.length === 1 ? '1 label' : hits.length + ' labels') + ' marked in ' + label + '.'
      : 'No label in ' + label + ' matches; the text is in a part the drawing does not show.';
    if (hits.length) zoomToLabel(state, hits[0], state.canvas);
    // Focus on the drawing lets the arrow keys scroll around the hit.
    state.canvas.focus({ preventScroll: true });
    return true;
  };

  /**
   * Remove the marks of an earlier search hit and the note that announced
   * them. Marks of an open find bar are the bar's own and stay.
   */
  proto.clearDiagramTextHighlights = function () {
    var state = this._authoredDiagram;
    if (!state) return;
    state.status.textContent = '';
    if (!state.find.bar.hidden) return;
    clearHits(state);
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
    if (!shown && state.find && !state.find.bar.hidden) {
      state.find.bar.hidden = true;
      state.find.status.textContent = '';
      clearHits(state);
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
