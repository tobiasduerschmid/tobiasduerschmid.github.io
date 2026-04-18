/**
 * FSCommandLab — interactive before/after demo cards for filesystem commands.
 *
 * Structural mirror of js/git-command-lab.js. Each card shows a folder-tree
 * rendered by window.UMLFolderTreeDiagram (from js/ArchUML/uml-bundle.js) plus
 * a button labelled with a shell command. Clicking animates to the next state
 * via a crossfade between two stacked tree slots.
 *
 * State format:
 *   { tree: "project/\n  src/\n    app.js",  // ArchUML indentation syntax
 *     cwd:  "project/src",                   // optional — gets "(you are here)"
 *     output: "..." }                        // optional — stdout shown below
 *
 * Usage — single-step card:
 *   <div data-fs-command-lab>
 *     <script type="application/json">
 *       { "command": "mkdir docs",
 *         "description": "Create a new folder.",
 *         "before": { "tree": "project/\n  src/" },
 *         "after":  { "tree": "project/\n  docs/\n  src/" } }
 *     </script>
 *   </div>
 *
 * Usage — multi-step card:
 *   <div data-fs-command-lab-multi>
 *     <script type="application/json">
 *       { "description": "Build up a project.",
 *         "initialState": { "tree": "project/" },
 *         "steps": [
 *           { "command": "mkdir src", "state": { "tree": "project/\n  src/" } },
 *           ...
 *         ] }
 *     </script>
 *   </div>
 */
(function () {
  'use strict';

  // Minimal markdown → HTML for lab-card descriptions. Supports **bold**,
  // *italic*, `code`, and blank-line paragraph breaks.
  function mdToHtml(md) {
    if (!md) return '';
    var paragraphs = String(md).split(/\n\s*\n/);
    return paragraphs.map(function (para) {
      var html = para
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>');
      return '<p>' + html + '</p>';
    }).join('');
  }

  // ---------------------------------------------------------------------------
  // injectCwdAnnotation — rewrites a tree text so the row whose full path
  // equals `cwd` carries a "(you are here)" annotation. Keeps any existing
  // annotation by composing them. Pure function so it's easy to reason about.
  //
  // Matching rule: path is the concatenation of ancestor names (with the
  // trailing '/' stripped) joined by '/'.  Top-level rows have depth 0, so
  // their name alone is their path.
  // ---------------------------------------------------------------------------
  function injectCwdAnnotation(text, cwd) {
    if (!cwd) return text;
    var lines = String(text).split('\n');
    var indentUnit = 0;
    var stack = [];        // bare names along the ancestor path
    var matched = false;

    // First pass: detect indent unit (first non-zero lead).
    for (var j = 0; j < lines.length; j++) {
      var t = lines[j].trim();
      if (!t || t === '@startuml' || t === '@enduml') continue;
      var lead = leadingWidth(lines[j]);
      if (lead > 0) { indentUnit = lead; break; }
    }

    var out = lines.map(function (raw) {
      var trimmed = raw.trim();
      if (!trimmed || trimmed === '@startuml' || trimmed === '@enduml') return raw;

      var lead = leadingWidth(raw);
      var depth = indentUnit > 0 ? Math.floor(lead / indentUnit) : 0;

      // Pop stack to current depth.
      stack = stack.slice(0, depth);

      var content = trimmed;
      var existingAnnot = '';
      var m = content.match(/^(.+?)\s+(?:←|<-|#|\/\/)\s+(.+)$/);
      if (m) {
        content = m[1].trim();
        existingAnnot = m[2].trim();
      }
      var bare = content.replace(/\/$/, '');
      stack.push(bare);

      if (matched) return raw;
      var currentPath = stack.join('/');
      if (currentPath !== cwd) return raw;

      matched = true;
      var annot = '(you are here)';
      if (existingAnnot) annot += ' — ' + existingAnnot;
      var indent = raw.substring(0, raw.length - raw.replace(/^[ \t]+/, '').length);
      return indent + content + ' ← ' + annot;
    });

    if (!matched && typeof console !== 'undefined' && console.warn) {
      console.warn('FSCommandLab: cwd "' + cwd + '" did not match any row in tree text');
    }
    return out.join('\n');
  }

  function leadingWidth(raw) {
    var w = 0;
    for (var k = 0; k < raw.length; k++) {
      if (raw.charAt(k) === ' ') w++;
      else if (raw.charAt(k) === '\t') w += 4;
      else break;
    }
    return w;
  }

  // ---------------------------------------------------------------------------
  // extractPathsAndAnnotations — parse a tree text into an ordered list of
  // { path, annotation } entries. Used to diff old vs. new state so we can
  // highlight rows that are new or whose annotation changed.
  // ---------------------------------------------------------------------------
  function extractPathsAndAnnotations(text) {
    if (!window.UMLFolderTreeDiagram || !window.UMLFolderTreeDiagram.parse) {
      return { rows: [], map: {} };
    }
    var parsed = window.UMLFolderTreeDiagram.parse(text);
    if (!parsed || !parsed.rows) return { rows: [], map: {} };
    var stack = [];
    var rows = [];
    var map = {};
    parsed.rows.forEach(function (row) {
      stack = stack.slice(0, row.depth);
      var bare = String(row.name || '').replace(/\/$/, '');
      stack.push(bare);
      var path = stack.join('/');
      rows.push({ path: path, annotation: row.annotation || '' });
      map[path] = row.annotation || '';
    });
    return { rows: rows, map: map };
  }

  // Return indices (in new) of rows that should burst. Structural changes —
  // create, delete, move, rename — produce a new path in the new tree and
  // always burst. The "(you are here)" cwd marker arriving at a row also
  // bursts (so `cd` is visually obvious), but the row it *leaves* does not.
  // Other pure annotation changes (e.g. a submodule pin label flipping)
  // aren't bursted, per design.
  function computeChangedIndices(oldText, newText) {
    if (oldText == null) return [];
    var oldInfo = extractPathsAndAnnotations(oldText);
    var newInfo = extractPathsAndAnnotations(newText);
    var out = [];
    newInfo.rows.forEach(function (entry, i) {
      if (!(entry.path in oldInfo.map)) {
        out.push(i);
        return;
      }
      var wasCwd = /\(you are here\)/.test(oldInfo.map[entry.path]);
      var isCwd  = /\(you are here\)/.test(entry.annotation);
      if (isCwd && !wasCwd) out.push(i);
    });
    return out;
  }

  // Post-render, animate a drop-shadow "burst" on every changed row — the
  // row's text + icon shapes flash with the same yellow/white glow, peak
  // timing, and luminance as git-graph's label-burst.
  //
  // Driven by requestAnimationFrame rather than CSS @keyframes because
  // Chromium doesn't interpolate CSS `filter` animations on inline SVG
  // <text> / child elements reliably — but setting `filter` via inline
  // style on any SVG element works. So we run the frame loop in JS and
  // write the interpolated inline filter on each element ourselves.
  var BURST_DURATION_MS = 1000;
  var BURST_RISE_END    = 0.22;   // finish rising to peak at 22% of duration (~220ms)
  var BURST_FALL_START  = 0.45;   // hold at peak until 45% (~225ms plateau)

  function startRowBurst(elements) {
    if (!elements.length) return;
    var start = (window.performance && performance.now) ? performance.now() : Date.now();

    // 60fps tick via setInterval. requestAnimationFrame would be ideal but
    // stalls in headless CDP sessions; setInterval runs regardless.
    var timer = setInterval(function () {
      var nowT = (window.performance && performance.now) ? performance.now() : Date.now();
      var p = (nowT - start) / BURST_DURATION_MS;
      if (p >= 1) {
        elements.forEach(function (el) { el.style.filter = ''; });
        clearInterval(timer);
        return;
      }
      // Fast rise → plateau at peak → ease-out fall. The plateau keeps the
      // glow visible long enough to register as a flash even on fast reads.
      var intensity;
      if (p < BURST_RISE_END) {
        intensity = p / BURST_RISE_END;
      } else if (p < BURST_FALL_START) {
        intensity = 1;
      } else {
        var q = (p - BURST_FALL_START) / (1 - BURST_FALL_START);
        intensity = 1 - (q * q);
      }
      // Tight, bright glow: small radius so it stays close to the row and
      // won't be clipped by any outer SVG filter bitmap; full opacity so
      // it reads clearly against both light and dark backgrounds.
      var innerR = (4 * intensity).toFixed(2);
      var outerR = (9 * intensity).toFixed(2);
      var innerA = (1 * intensity).toFixed(3);
      var outerA = (1 * intensity).toFixed(3);
      var filter = 'drop-shadow(0 0 ' + innerR + 'px rgba(255,255,255,' + innerA + ')) ' +
                   'drop-shadow(0 0 ' + outerR + 'px rgba(255,200,28,' + outerA + '))';
      elements.forEach(function (el) { el.style.filter = filter; });
    }, 16);
  }

  function applyRowBursts(slotEl, changedIndices) {
    if (!changedIndices || !changedIndices.length) return;
    var svg = slotEl.querySelector('svg');
    if (!svg) return;
    var texts = Array.prototype.slice.call(svg.querySelectorAll('text'));
    if (texts.length === 0) return;

    // Group texts by y value so same-row name + annotation texts animate together.
    var byY = {};
    texts.forEach(function (t) {
      var y = Math.round(parseFloat(t.getAttribute('y') || '0'));
      (byY[y] = byY[y] || []).push(t);
    });
    var ys = Object.keys(byY).map(Number).sort(function (a, b) { return a - b; });
    if (ys.length === 0) return;

    var rowH = ys.length >= 2 ? (ys[1] - ys[0]) : 24;

    changedIndices.forEach(function (idx) {
      if (idx >= ys.length) return;
      var textY = ys[idx];
      var rowTexts = byY[textY];
      if (!rowTexts.length) return;

      var yMid = textY - 5;
      var rowTop = yMid - rowH / 2;
      var rowBottom = yMid + rowH / 2;
      var parent = rowTexts[0].parentNode;

      // Pull in icon shapes within the row's vertical bounds. Tree connectors
      // span multiple rows (tall bboxes) and get excluded by the height cap.
      var iconEls = [];
      Array.prototype.forEach.call(parent.children, function (el) {
        var tag = el.tagName;
        if (tag !== 'rect' && tag !== 'polygon' && tag !== 'polyline') return;
        try {
          var bb = el.getBBox();
          if (bb.height > 0 &&
              bb.y >= rowTop - 1 &&
              bb.y + bb.height <= rowBottom + 1 &&
              bb.height <= rowH) {
            iconEls.push(el);
          }
        } catch (e) { /* disconnected element; skip */ }
      });

      startRowBurst(rowTexts.concat(iconEls));
    });
  }

  // ---------------------------------------------------------------------------
  // Tree animation controller.  Owns a wrapper with two absolutely-positioned
  // "slot" divs; crossfades between them by toggling an --active class.  Each
  // slot gets a fresh UMLFolderTreeDiagram.render on state change, and rows
  // that are new or whose annotation changed get a yellow burst highlight
  // (matching the git-graph label-burst aesthetic).
  // ---------------------------------------------------------------------------
  function TreeAnimator(wrapper) {
    var slotA = document.createElement('div');
    slotA.className = 'fs-command-lab__tree-slot fs-command-lab__tree-slot--active';
    var slotB = document.createElement('div');
    slotB.className = 'fs-command-lab__tree-slot';
    wrapper.appendChild(slotA);
    wrapper.appendChild(slotB);

    var current = slotA;
    var other = slotB;
    var initialized = false;
    var previousText = null;

    function renderInitial(text) {
      window.UMLFolderTreeDiagram.render(current, text);
      previousText = text;
      initialized = true;
    }

    function renderTransition(text) {
      window.UMLFolderTreeDiagram.render(other, text);

      // Highlight rows that changed vs. the previously-rendered state.
      var changed = computeChangedIndices(previousText, text);
      applyRowBursts(other, changed);

      // Swap which slot contributes to layout height. We do NOT lock or
      // animate the wrapper's height — the tree stays steady; content below
      // it snaps rather than slides.
      current.classList.remove('fs-command-lab__tree-slot--active');
      other.classList.add('fs-command-lab__tree-slot--active');

      var tmp = current; current = other; other = tmp;
      previousText = text;
    }

    return {
      render: function (text) {
        if (!initialized) renderInitial(text);
        else renderTransition(text);
      },
    };
  }

  // ---------------------------------------------------------------------------
  // buildTreeText — composes the tree text to hand to UMLFolderTreeDiagram,
  // applying cwd injection.  Used by both live rendering and the print slots.
  // ---------------------------------------------------------------------------
  function buildTreeText(state) {
    if (!state) return '';
    var text = state.tree || '';
    if (state.cwd) text = injectCwdAnnotation(text, state.cwd);
    return text;
  }

  function renderOutputInto(el, output) {
    if (output != null && output !== '') {
      el.textContent = output;
      el.classList.add('fs-command-lab__output--visible');
    } else {
      el.textContent = '';
      el.classList.remove('fs-command-lab__output--visible');
    }
  }

  // Measure the tallest (tree + output) height across all states. Used to
  // lock the tree wrapper's min-height so switching states never changes
  // the page layout around the card. Combining tree and output into one
  // measurement lets the output sit flush against the tree with no gap
  // while still holding a single stable outer height.
  function measureMaxTreeHeight(states) {
    if (!states.length) return 0;
    var tempTree = document.createElement('div');
    tempTree.style.cssText =
      'position: absolute; left: -9999px; top: -9999px; ' +
      'visibility: hidden; width: auto; height: auto;';
    document.body.appendChild(tempTree);

    var tempOut = document.createElement('pre');
    tempOut.className = 'fs-command-lab__output fs-command-lab__output--visible';
    tempOut.style.cssText =
      'position: absolute; left: -9999px; top: -9999px; ' +
      'visibility: hidden; max-height: none; opacity: 1;';
    document.body.appendChild(tempOut);

    var maxH = 0;
    try {
      states.forEach(function (state) {
        if (!state) return;
        window.UMLFolderTreeDiagram.render(tempTree, buildTreeText(state));
        var h = tempTree.offsetHeight;
        if (state.output) {
          tempOut.textContent = state.output;
          h += tempOut.offsetHeight;
        }
        if (h > maxH) maxH = h;
      });
    } finally {
      if (tempTree.parentNode) tempTree.parentNode.removeChild(tempTree);
      if (tempOut.parentNode) tempOut.parentNode.removeChild(tempOut);
    }
    return maxH;
  }

  // ---------------------------------------------------------------------------
  // Single-step card: play button toggles between `before` and `after`.
  // ---------------------------------------------------------------------------
  function makeCard(container, spec) {
    container.innerHTML = '';
    container.classList.add('fs-command-lab');

    var row = document.createElement('div');
    row.className = 'fs-command-lab__row';
    container.appendChild(row);

    var caption = document.createElement('div');
    caption.className = 'fs-command-lab__caption';

    if (spec.description) {
      var desc = document.createElement('div');
      desc.className = 'fs-command-lab__desc';
      desc.innerHTML = mdToHtml(spec.description);
      caption.appendChild(desc);
    }

    if (caption.children.length) row.appendChild(caption);

    var action = document.createElement('div');
    action.className = 'fs-command-lab__action';
    row.appendChild(action);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fs-command-lab__btn';
    var icon = document.createElement('span');
    icon.className = 'fs-command-lab__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '\u25B6';
    var cmdEl = document.createElement('code');
    cmdEl.className = 'fs-command-lab__cmd';
    cmdEl.textContent = spec.command;
    btn.appendChild(icon);
    btn.appendChild(cmdEl);
    action.appendChild(btn);

    var treeWrap = document.createElement('div');
    treeWrap.className = 'fs-command-lab__tree';
    action.appendChild(treeWrap);

    var maxH = measureMaxTreeHeight([spec.before, spec.after]);
    if (maxH > 0) treeWrap.style.minHeight = maxH + 'px';

    // Lock wrapper to the taller of before/after so toggling doesn't shift
    // the page above or below.
    var maxH = measureMaxTreeHeight([spec.before, spec.after]);
    if (maxH > 0) treeWrap.style.minHeight = maxH + 'px';

    var animator = TreeAnimator(treeWrap);

    // Output lives inside the tree wrapper, after the slots, so it sits
    // flush against the tree (no flex gap between them) and stays within
    // the wrapper's locked min-height.
    var output = document.createElement('pre');
    output.className = 'fs-command-lab__output';
    treeWrap.appendChild(output);

    animator.render(buildTreeText(spec.before));
    renderOutputInto(output, spec.before && spec.before.output);

    var applied = false;
    function update() {
      var state = applied ? spec.after : spec.before;
      animator.render(buildTreeText(state));
      renderOutputInto(output, state && state.output);
      if (applied) {
        icon.textContent = '\u21BA';
        cmdEl.textContent = 'Undo ' + spec.command;
        btn.classList.add('fs-command-lab__btn--undo');
      } else {
        icon.textContent = '\u25B6';
        cmdEl.textContent = spec.command;
        btn.classList.remove('fs-command-lab__btn--undo');
      }
    }

    btn.addEventListener('click', function () {
      applied = !applied;
      update();
    });

    var controller = {
      animator: animator,
      button: btn,
      reset: function () { applied = false; update(); },
    };
    container._fcl = controller;
    return controller;
  }

  function readSpec(el, attr) {
    var raw = el.getAttribute(attr);
    if (raw && raw.trim() && raw.trim()[0] === '{') return JSON.parse(raw);
    var script = el.querySelector('script[type="application/json"]');
    if (script) return JSON.parse(script.textContent);
    throw new Error('No spec JSON found for ' + attr + ' element');
  }

  function initFrom(root) {
    if (!window.UMLFolderTreeDiagram) {
      setTimeout(function () { initFrom(root); }, 30);
      return;
    }
    var nodes = (root || document).querySelectorAll('[data-fs-command-lab]');
    Array.prototype.forEach.call(nodes, function (el) {
      if (el.getAttribute('data-fcl-init')) return;
      el.setAttribute('data-fcl-init', '1');
      try {
        makeCard(el, readSpec(el, 'data-fs-command-lab'));
      } catch (e) {
        console.error('FSCommandLab init failed:', e, el);
      }
    });
  }

  function openModal(spec) {
    var prev = document.getElementById('fs-command-lab-modal');
    if (prev) prev.remove();

    var overlay = document.createElement('div');
    overlay.id = 'fs-command-lab-modal';
    overlay.className = 'fs-command-lab-modal-overlay';

    var modal = document.createElement('div');
    modal.className = 'fs-command-lab-modal';

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'fs-command-lab-modal__close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = '&times;';
    modal.appendChild(closeBtn);

    var cardHost = document.createElement('div');
    modal.appendChild(cardHost);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    function close() {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', onKey);

    function tryRender() {
      if (!window.UMLFolderTreeDiagram) { setTimeout(tryRender, 30); return; }
      if (spec.steps) makeMultiCard(cardHost, spec);
      else makeCard(cardHost, spec);
    }
    tryRender();

    return { close: close };
  }

  // ---------------------------------------------------------------------------
  // Multi-step card — walks through a sequence of commands, each with its own
  // resulting tree state. The button always shows the *next* command; after
  // the last step it becomes "↺ Restart".
  // ---------------------------------------------------------------------------

  function makeMultiCard(container, spec) {
    container.innerHTML = '';
    container.classList.add('fs-command-lab', 'fs-command-lab--multi');

    var steps = spec.steps;
    var stepIdx = -1;           // -1 = initial state (before any command)

    var row = document.createElement('div');
    row.className = 'fs-command-lab__row';
    container.appendChild(row);

    var caption = document.createElement('div');
    caption.className = 'fs-command-lab__caption';
    row.appendChild(caption);

    var descEl = document.createElement('div');
    descEl.className = 'fs-command-lab__desc';
    caption.appendChild(descEl);

    var progressEl = document.createElement('div');
    progressEl.className = 'fs-command-lab__step-progress';
    caption.appendChild(progressEl);

    var action = document.createElement('div');
    action.className = 'fs-command-lab__action';
    row.appendChild(action);

    var btnGroup = document.createElement('div');
    btnGroup.className = 'fs-command-lab__btn-group';
    action.appendChild(btnGroup);

    var backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'fs-command-lab__btn-back';
    backBtn.setAttribute('aria-label', 'Previous step');
    var backIcon = document.createElement('span');
    backIcon.className = 'fs-command-lab__icon';
    backIcon.setAttribute('aria-hidden', 'true');
    backIcon.textContent = '\u2190';
    var backLabel = document.createElement('span');
    backLabel.className = 'fs-command-lab__btn-back-label';
    backLabel.textContent = 'Back';
    backBtn.appendChild(backIcon);
    backBtn.appendChild(backLabel);
    btnGroup.appendChild(backBtn);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fs-command-lab__btn';
    var icon = document.createElement('span');
    icon.className = 'fs-command-lab__icon';
    icon.setAttribute('aria-hidden', 'true');
    var cmdEl = document.createElement('code');
    cmdEl.className = 'fs-command-lab__cmd';
    btn.appendChild(icon);
    btn.appendChild(cmdEl);
    btnGroup.appendChild(btn);

    var treeWrap = document.createElement('div');
    treeWrap.className = 'fs-command-lab__tree';
    action.appendChild(treeWrap);

    // Lock wrapper height to the tallest state in the walkthrough so walking
    // the sequence doesn't shift surrounding content as the tree grows and
    // shrinks.
    var allStates = [spec.initialState];
    for (var si0 = 0; si0 < steps.length; si0++) allStates.push(steps[si0].state);
    var maxH = measureMaxTreeHeight(allStates);
    if (maxH > 0) treeWrap.style.minHeight = maxH + 'px';

    // Lock wrapper height to the tallest state in the walkthrough so walking
    // the sequence doesn't shift surrounding content as the tree grows and
    // shrinks.
    var allStates = [spec.initialState];
    for (var si0 = 0; si0 < steps.length; si0++) allStates.push(steps[si0].state);
    var maxH = measureMaxTreeHeight(allStates);
    if (maxH > 0) treeWrap.style.minHeight = maxH + 'px';

    var animator = TreeAnimator(treeWrap);

    // Output lives inside the tree wrapper, after the slots, so it sits
    // flush against the tree rather than being separated by flex gap.
    var output = document.createElement('pre');
    output.className = 'fs-command-lab__output';
    treeWrap.appendChild(output);

    // Print section: all steps pre-rendered as static folder trees. Hidden on
    // screen; revealed via @media print.
    var printSection = document.createElement('div');
    printSection.className = 'fs-command-lab__print-steps';
    container.appendChild(printSection);

    var effectiveDescs = [];
    var runningDesc = spec.description || '';
    effectiveDescs.push(runningDesc);
    for (var pi = 0; pi < steps.length; pi++) {
      if (steps[pi].description) runningDesc = steps[pi].description;
      effectiveDescs.push(runningDesc);
    }

    function addPrintStep(label, state, descText, isInitial) {
      var stepEl = document.createElement('div');
      stepEl.className = 'fs-command-lab__print-step';

      var labelEl = document.createElement('div');
      labelEl.className = 'fs-command-lab__print-step-label' +
        (isInitial ? ' fs-command-lab__print-step-label--initial' : '');
      if (isInitial) {
        labelEl.textContent = label;
      } else {
        var codeEl = document.createElement('code');
        codeEl.textContent = label;
        labelEl.appendChild(codeEl);
      }
      stepEl.appendChild(labelEl);

      if (descText) {
        var descDiv = document.createElement('div');
        descDiv.className = 'fs-command-lab__print-step-desc';
        descDiv.innerHTML = mdToHtml(descText);
        stepEl.appendChild(descDiv);
      }

      var treeDiv = document.createElement('div');
      treeDiv.className = 'fs-command-lab__tree-static';
      window.UMLFolderTreeDiagram.render(treeDiv, buildTreeText(state));
      stepEl.appendChild(treeDiv);

      if (state && state.output) {
        var outEl = document.createElement('pre');
        outEl.className = 'fs-command-lab__output fs-command-lab__output--visible';
        outEl.textContent = state.output;
        stepEl.appendChild(outEl);
      }

      printSection.appendChild(stepEl);
    }

    addPrintStep('Initial state', spec.initialState, effectiveDescs[0], true);
    for (var si = 0; si < steps.length; si++) {
      addPrintStep(steps[si].command, steps[si].state, effectiveDescs[si + 1], false);
    }

    function update() {
      var isInitial = (stepIdx === -1);
      var isLast    = (stepIdx === steps.length - 1);

      descEl.innerHTML = mdToHtml(effectiveDescs[stepIdx + 1]);

      progressEl.textContent =
        'Step\u00A0' + (isInitial ? 0 : stepIdx + 1) + '\u00A0of\u00A0' + steps.length;

      if (isLast) {
        icon.textContent = '\u21BA';
        cmdEl.textContent = 'Restart';
        btn.classList.add('fs-command-lab__btn--restart');
      } else {
        icon.textContent = '\u25B6';
        cmdEl.textContent = steps[stepIdx + 1].command;
        btn.classList.remove('fs-command-lab__btn--restart');
      }

      backBtn.disabled = isInitial;

      var state = isInitial ? spec.initialState : steps[stepIdx].state;
      animator.render(buildTreeText(state));
      renderOutputInto(output, state && state.output);
    }

    btn.addEventListener('click', function () {
      stepIdx = (stepIdx === steps.length - 1) ? -1 : stepIdx + 1;
      update();
    });

    backBtn.addEventListener('click', function () {
      if (stepIdx > -1) {
        stepIdx--;
        update();
      }
    });

    update();

    var controller = {
      animator: animator,
      button: btn,
      reset: function () { stepIdx = -1; update(); },
    };
    container._fcl = controller;
    return controller;
  }

  function initFromMulti(root) {
    if (!window.UMLFolderTreeDiagram) {
      setTimeout(function () { initFromMulti(root); }, 30);
      return;
    }
    var nodes = (root || document).querySelectorAll('[data-fs-command-lab-multi]');
    Array.prototype.forEach.call(nodes, function (el) {
      if (el.getAttribute('data-fcl-multi-init')) return;
      el.setAttribute('data-fcl-multi-init', '1');
      try {
        makeMultiCard(el, readSpec(el, 'data-fs-command-lab-multi'));
      } catch (e) {
        console.error('FSCommandLab multi-step init failed:', e, el);
      }
    });
  }

  // Reset any cards that have been toggled so print output is coherent.
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeprint', function () {
      document.querySelectorAll('.fs-command-lab').forEach(function (el) {
        if (el._fcl && el._fcl.reset) el._fcl.reset();
      });
    });

    // Re-render every card's tree when dark mode toggles — the SVG bakes in
    // its fill/stroke colours at generation time, so a live theme change
    // needs a fresh render for the right palette (and to avoid the outer
    // invert filter that uml-diagram.css would otherwise apply).
    if (typeof MutationObserver !== 'undefined' && document.documentElement) {
      var lastDark = document.documentElement.classList.contains('dark-mode');
      new MutationObserver(function () {
        var nowDark = document.documentElement.classList.contains('dark-mode');
        if (nowDark === lastDark) return;
        lastDark = nowDark;
        document.querySelectorAll('.fs-command-lab').forEach(function (el) {
          if (el._fcl && el._fcl.reset) el._fcl.reset();
        });
      }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    }
  }

  window.FSCommandLab = {
    create:          makeCard,
    initFrom:        initFrom,
    openModal:       openModal,
    createMulti:     makeMultiCard,
    initFromMulti:   initFromMulti,
    injectCwdAnnotation: injectCwdAnnotation,   // exposed for tests
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initFrom(document);
      initFromMulti(document);
    });
  } else {
    initFrom(document);
    initFromMulti(document);
  }
})();
