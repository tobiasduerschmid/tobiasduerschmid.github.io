/**
 * UML State Machine Diagram Renderer
 *
 * Text format:
 *   @startuml
 *   [*] --> Idle : powerOn()
 *   Idle --> CombatMode : threatDetected [sysCheckOK] / deployUI()
 *   CombatMode --> Idle : threatNeutralized / retractWeapons()
 *   EmergencyPower --> [*] : manualOverride()
 *
 *   state Idle {
 *     entry / initSensors()
 *   }
 *   @enduml
 *
 * Notation:
 *   [*]           Initial pseudo-state (filled circle) / Final pseudo-state (bullseye)
 *   state Name {} State with internal actions (entry/exit/do)
 *   A --> B : lbl Transition with Event [Guard] / Effect
 */
(function () {
  'use strict';

  var CFG = {
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    fontSize: 13,
    fontSizeBold: 14,
    fontSizeAction: 11,
    lineHeight: 20,
    padX: 20,
    padY: 10,
    stateMinW: 120,
    stateRx: 12,
    initialR: 8,
    finalR: 6,
    finalRingR: 11,
    gapX: 80,
    gapY: 70,
    arrowSize: 10,
    strokeWidth: 1.5,
    svgPad: 30,
    selfLoopW: 50,
    selfLoopH: 30,
    labelBgPad: 4,
  };

  // ─── Parser ───────────────────────────────────────────────────────

  function parse(text) {
    var lines = text.split('\n');
    var states = {};       // name -> { name, type, entryAction, exitAction, doActivity }
    var transitions = [];
    var inState = null;
    var braceDepth = 0;

    // Ensure [*] pseudo-states exist
    function ensureState(name) {
      if (!states[name]) {
        var type = 'state';
        if (name === '[*]') type = 'pseudo'; // resolved later per usage
        states[name] = { name: name, type: type, entryAction: '', exitAction: '', doActivity: '' };
      }
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line === '@startuml' || line === '@enduml') continue;

      // Inside a state block
      if (inState !== null) {
        for (var ci = 0; ci < line.length; ci++) {
          if (line[ci] === '{') braceDepth++;
          if (line[ci] === '}') braceDepth--;
        }
        if (braceDepth <= 0) {
          inState = null;
          braceDepth = 0;
          continue;
        }
        // Parse internal actions
        var entryMatch = line.match(/^entry\s*\/\s*(.+)$/i);
        if (entryMatch) { states[inState].entryAction = entryMatch[1].trim(); continue; }
        var exitMatch = line.match(/^exit\s*\/\s*(.+)$/i);
        if (exitMatch) { states[inState].exitAction = exitMatch[1].trim(); continue; }
        var doMatch = line.match(/^do\s*\/\s*(.+)$/i);
        if (doMatch) { states[inState].doActivity = doMatch[1].trim(); continue; }
        continue;
      }

      // State declaration: state Name { ... }
      var stateMatch = line.match(/^state\s+(\S+)\s*\{?/);
      if (stateMatch) {
        var sName = stateMatch[1];
        ensureState(sName);
        if (line.indexOf('{') !== -1) {
          braceDepth = 1;
          if (line.indexOf('}') !== -1 && line.indexOf('}') > line.indexOf('{')) {
            braceDepth = 0;
          } else {
            inState = sName;
          }
        }
        continue;
      }

      // Transition: From --> To : label
      var transMatch = line.match(/^(\S+)\s+-->\s+(\S+)\s*(?::\s*(.*))?$/);
      if (transMatch) {
        var from = transMatch[1];
        var to = transMatch[2];
        var label = (transMatch[3] || '').trim();
        ensureState(from);
        ensureState(to);
        transitions.push({ from: from, to: to, label: label });
        continue;
      }
    }

    // Classify [*] as initial or final based on usage
    // [*] as source → it's an initial state; [*] as target → it's a final state
    var initialNames = {};
    var finalNames = {};
    var initialCount = 0;
    var finalCount = 0;
    for (var t = 0; t < transitions.length; t++) {
      if (transitions[t].from === '[*]') {
        var iName = '__initial__' + initialCount;
        initialNames[t] = iName;
        if (!states[iName]) states[iName] = { name: iName, type: 'initial', entryAction: '', exitAction: '', doActivity: '' };
        initialCount++;
      }
      if (transitions[t].to === '[*]') {
        var fName = '__final__' + finalCount;
        finalNames[t] = fName;
        if (!states[fName]) states[fName] = { name: fName, type: 'final', entryAction: '', exitAction: '', doActivity: '' };
        finalCount++;
      }
    }
    // Replace [*] references in transitions
    for (var t2 = 0; t2 < transitions.length; t2++) {
      if (initialNames[t2] !== undefined) transitions[t2].from = initialNames[t2];
      if (finalNames[t2] !== undefined) transitions[t2].to = finalNames[t2];
    }
    // Remove the generic [*] placeholder
    delete states['[*]'];

    // Convert to array
    var stateList = [];
    for (var sn in states) stateList.push(states[sn]);

    return { states: stateList, transitions: transitions };
  }

  // ─── Text Measurement ─────────────────────────────────────────────

  var _ctx = null;
  function textWidth(text, bold, fontSize) {
    if (!_ctx) _ctx = document.createElement('canvas').getContext('2d');
    var fs = fontSize || CFG.fontSize;
    _ctx.font = (bold ? 'bold ' : '') + fs + 'px ' + CFG.fontFamily;
    return _ctx.measureText(text).width;
  }

  function escapeXml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ─── Layout ───────────────────────────────────────────────────────

  function measureState(s) {
    if (s.type === 'initial') return { width: CFG.initialR * 2 + 4, height: CFG.initialR * 2 + 4 };
    if (s.type === 'final') return { width: CFG.finalRingR * 2 + 4, height: CFG.finalRingR * 2 + 4 };

    var nameW = textWidth(s.name, true, CFG.fontSizeBold);
    var hasActions = s.entryAction || s.exitAction || s.doActivity;
    var actionLines = 0;
    if (s.entryAction) actionLines++;
    if (s.exitAction) actionLines++;
    if (s.doActivity) actionLines++;

    var actionMaxW = 0;
    if (s.entryAction) actionMaxW = Math.max(actionMaxW, textWidth('entry / ' + s.entryAction, false, CFG.fontSizeAction));
    if (s.exitAction) actionMaxW = Math.max(actionMaxW, textWidth('exit / ' + s.exitAction, false, CFG.fontSizeAction));
    if (s.doActivity) actionMaxW = Math.max(actionMaxW, textWidth('do / ' + s.doActivity, false, CFG.fontSizeAction));

    var width = Math.max(CFG.stateMinW, nameW + CFG.padX * 2, actionMaxW + CFG.padX * 2);
    var height = CFG.padY * 2 + CFG.lineHeight;
    if (hasActions) height += 4 + actionLines * 16; // divider + action lines

    return { width: Math.ceil(width), height: Math.ceil(height), hasActions: hasActions, actionLines: actionLines };
  }

  function computeLayout(parsed) {
    var stateList = parsed.states;
    var transitions = parsed.transitions;
    if (stateList.length === 0) return { entries: {}, width: 0, height: 0 };

    var entries = {};
    for (var i = 0; i < stateList.length; i++) {
      var s = stateList[i];
      entries[s.name] = { state: s, box: measureState(s), x: 0, y: 0 };
    }

    // Build adjacency for BFS layer assignment
    var children = {};
    for (var sn in entries) children[sn] = [];
    for (var t = 0; t < transitions.length; t++) {
      if (entries[transitions[t].from] && entries[transitions[t].to]) {
        if (children[transitions[t].from].indexOf(transitions[t].to) === -1) {
          children[transitions[t].from].push(transitions[t].to);
        }
      }
    }

    // Find initial states as roots
    var roots = [];
    for (var sn2 in entries) {
      if (entries[sn2].state.type === 'initial') roots.push(sn2);
    }
    if (roots.length === 0) roots = [stateList[0].name]; // fallback

    // BFS layer assignment (handles cycles by only visiting each node once)
    var layers = {};
    var visited = {};
    var queue = [];
    for (var ri = 0; ri < roots.length; ri++) {
      layers[roots[ri]] = 0;
      visited[roots[ri]] = true;
      queue.push(roots[ri]);
    }
    while (queue.length > 0) {
      var node = queue.shift();
      var kids = children[node];
      for (var ki = 0; ki < kids.length; ki++) {
        var kid = kids[ki];
        if (!visited[kid]) {
          visited[kid] = true;
          layers[kid] = (layers[node] || 0) + 1;
          queue.push(kid);
        }
        // Skip already-visited nodes to avoid infinite loops in cycles
      }
    }
    // Assign unvisited
    for (var sn3 in entries) {
      if (layers[sn3] === undefined) layers[sn3] = 0;
    }

    // Group by layer
    var layerGroups = {};
    var maxLayer = 0;
    for (var sn4 in entries) {
      var l = layers[sn4];
      if (!layerGroups[l]) layerGroups[l] = [];
      layerGroups[l].push(sn4);
      maxLayer = Math.max(maxLayer, l);
    }

    // Position: center each layer horizontally
    var curY = 0;
    for (var ly = 0; ly <= maxLayer; ly++) {
      var group = layerGroups[ly];
      if (!group) continue;
      var totalW = 0;
      for (var gi = 0; gi < group.length; gi++) {
        totalW += entries[group[gi]].box.width;
        if (gi < group.length - 1) totalW += CFG.gapX;
      }
      var curX = 0;
      // Center the whole layer
      for (var gi2 = 0; gi2 < group.length; gi2++) {
        var e = entries[group[gi2]];
        e.x = curX;
        e.y = curY;
        curX += e.box.width + CFG.gapX;
      }
      // Find max height in this layer
      var maxH = 0;
      for (var gi3 = 0; gi3 < group.length; gi3++) {
        maxH = Math.max(maxH, entries[group[gi3]].box.height);
      }
      curY += maxH + CFG.gapY;
    }

    // Center layers relative to widest
    var maxLayerW = 0;
    for (var ly2 = 0; ly2 <= maxLayer; ly2++) {
      var g = layerGroups[ly2];
      if (!g) continue;
      var lastE = entries[g[g.length - 1]];
      var layerW = lastE.x + lastE.box.width;
      maxLayerW = Math.max(maxLayerW, layerW);
    }
    for (var ly3 = 0; ly3 <= maxLayer; ly3++) {
      var g2 = layerGroups[ly3];
      if (!g2) continue;
      var lastE2 = entries[g2[g2.length - 1]];
      var layerW2 = lastE2.x + lastE2.box.width;
      var offsetX = (maxLayerW - layerW2) / 2;
      for (var gi4 = 0; gi4 < g2.length; gi4++) {
        entries[g2[gi4]].x += offsetX;
      }
    }

    // Compute bounds
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var en in entries) {
      var e2 = entries[en];
      minX = Math.min(minX, e2.x); minY = Math.min(minY, e2.y);
      maxX = Math.max(maxX, e2.x + e2.box.width); maxY = Math.max(maxY, e2.y + e2.box.height);
    }

    return {
      entries: entries,
      width: maxX - minX,
      height: maxY - minY,
      offsetX: -minX,
      offsetY: -minY,
    };
  }

  // ─── SVG Renderer ─────────────────────────────────────────────────

  function getThemeColors(container) {
    var cs = window.getComputedStyle(container);
    var get = function (prop, fb) { return cs.getPropertyValue(prop).trim() || fb; };
    return {
      stroke: get('--uml-stroke', '#4060a0'),
      text: get('--uml-text', '#222'),
      fill: get('--uml-fill', '#fff'),
      headerFill: get('--uml-header-fill', '#d0ddef'),
      line: get('--uml-line', '#444'),
    };
  }

  function generateSVG(layout, parsed, colors) {
    var entries = layout.entries;
    var transitions = parsed.transitions;
    var ox = layout.offsetX + CFG.svgPad;
    var oy = layout.offsetY + CFG.svgPad;
    var svgW = layout.width + CFG.svgPad * 2;
    var svgH = layout.height + CFG.svgPad * 2;

    var svg = [];
    svg.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + svgW + '" height="' + svgH + '" ');
    svg.push('viewBox="0 0 ' + svgW + ' ' + svgH + '" ');
    svg.push('style="font-family: ' + CFG.fontFamily + '; max-width: none;">');
    svg.push('<g transform="translate(' + ox + ',' + oy + ')">');

    // ── Draw transitions (behind states) ──
    for (var ti = 0; ti < transitions.length; ti++) {
      var tr = transitions[ti];
      var fromE = entries[tr.from];
      var toE = entries[tr.to];
      if (!fromE || !toE) continue;

      // Self-transition
      if (tr.from === tr.to) {
        var sx = fromE.x + fromE.box.width;
        var sy = fromE.y + fromE.box.height / 2 - 10;
        var lw = CFG.selfLoopW, lh = CFG.selfLoopH;
        svg.push('<path d="M ' + sx + ' ' + sy + ' C ' + (sx + lw) + ' ' + (sy - lh) + ' ' +
          (sx + lw) + ' ' + (sy + lh + 20) + ' ' + sx + ' ' + (sy + 20) +
          '" fill="none" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"/>');
        // Arrowhead
        drawArrow(svg, sx, sy + 20, -1, 0, colors.line);
        if (tr.label) {
          svg.push('<text x="' + (sx + lw + 4) + '" y="' + (sy + 10) +
            '" font-size="' + CFG.fontSize + '" fill="' + colors.text + '">' + escapeXml(tr.label) + '</text>');
        }
        continue;
      }

      var fromCx = fromE.x + fromE.box.width / 2;
      var fromCy = fromE.y + fromE.box.height / 2;
      var toCx = toE.x + toE.box.width / 2;
      var toCy = toE.y + toE.box.height / 2;

      // Determine exit/entry points
      var x1, y1, x2, y2;
      var dx = toCx - fromCx, dy = toCy - fromCy;

      if (Math.abs(dy) >= Math.abs(dx) * 0.5) {
        // Vertical connection
        if (dy > 0) {
          x1 = fromCx; y1 = fromE.y + fromE.box.height;
          x2 = toCx; y2 = toE.y;
        } else {
          x1 = fromCx; y1 = fromE.y;
          x2 = toCx; y2 = toE.y + toE.box.height;
        }
      } else {
        // Horizontal connection
        if (dx > 0) {
          x1 = fromE.x + fromE.box.width; y1 = fromCy;
          x2 = toE.x; y2 = toCy;
        } else {
          x1 = fromE.x; y1 = fromCy;
          x2 = toE.x + toE.box.width; y2 = toCy;
        }
      }

      // Draw orthogonal route
      var points;
      if (Math.abs(x1 - x2) < 2) {
        // Straight vertical
        points = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
      } else if (Math.abs(y1 - y2) < 2) {
        // Straight horizontal
        points = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
      } else {
        // Z-route
        var midY = (y1 + y2) / 2;
        points = [{ x: x1, y: y1 }, { x: x1, y: midY }, { x: x2, y: midY }, { x: x2, y: y2 }];
      }

      var pStr = '';
      for (var pi = 0; pi < points.length; pi++) {
        if (pi > 0) pStr += ' ';
        pStr += points[pi].x + ',' + points[pi].y;
      }
      svg.push('<polyline points="' + pStr +
        '" fill="none" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"/>');

      // Arrowhead at target
      var pLast = points[points.length - 1];
      var pPrev = points[points.length - 2];
      var adx = pLast.x - pPrev.x, ady = pLast.y - pPrev.y;
      var alen = Math.sqrt(adx * adx + ady * ady);
      if (alen > 0) { adx /= alen; ady /= alen; }
      drawArrow(svg, pLast.x, pLast.y, -adx, -ady, colors.line);

      // Transition label with background
      if (tr.label) {
        var bestIdx = 0, bestLen = 0;
        for (var si = 0; si < points.length - 1; si++) {
          var segLen = Math.abs(points[si+1].x - points[si].x) + Math.abs(points[si+1].y - points[si].y);
          if (segLen > bestLen) { bestLen = segLen; bestIdx = si; }
        }
        var lp0 = points[bestIdx], lp1 = points[bestIdx + 1];
        var lx = (lp0.x + lp1.x) / 2;
        var ly = (lp0.y + lp1.y) / 2;
        var isHoriz = Math.abs(lp1.y - lp0.y) < 1;
        var lw2 = textWidth(tr.label, false, CFG.fontSize);
        if (isHoriz) {
          ly -= 8;
        } else {
          lx += 10;
        }
        // Background rect
        svg.push('<rect x="' + (lx - lw2 / 2 - CFG.labelBgPad) + '" y="' + (ly - 12) +
          '" width="' + (lw2 + CFG.labelBgPad * 2) + '" height="' + 16 +
          '" fill="' + colors.fill + '" stroke="none" opacity="0.85"/>');
        svg.push('<text x="' + lx + '" y="' + ly +
          '" text-anchor="middle" font-size="' + CFG.fontSize + '" fill="' + colors.text + '">' +
          escapeXml(tr.label) + '</text>');
      }
    }

    // ── Draw states ──
    for (var en in entries) {
      var e = entries[en];
      var s = e.state;
      var cx = e.x + e.box.width / 2;
      var cy = e.y + e.box.height / 2;

      if (s.type === 'initial') {
        svg.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + CFG.initialR +
          '" fill="' + colors.line + '" stroke="none"/>');
      } else if (s.type === 'final') {
        svg.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + CFG.finalRingR +
          '" fill="none" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"/>');
        svg.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + CFG.finalR +
          '" fill="' + colors.line + '" stroke="none"/>');
      } else {
        // Regular state: rounded rectangle
        svg.push('<rect x="' + e.x + '" y="' + e.y + '" width="' + e.box.width + '" height="' + e.box.height +
          '" rx="' + CFG.stateRx + '" ry="' + CFG.stateRx +
          '" fill="' + colors.headerFill + '" stroke="' + colors.stroke + '" stroke-width="' + CFG.strokeWidth + '"/>');

        // State name (centered in top area)
        var nameY = e.y + CFG.padY + CFG.lineHeight * 0.75;
        svg.push('<text x="' + cx + '" y="' + nameY +
          '" text-anchor="middle" font-weight="bold" font-size="' + CFG.fontSizeBold + '" fill="' + colors.text + '">' +
          escapeXml(s.name) + '</text>');

        // Internal actions
        if (e.box.hasActions) {
          var divY = e.y + CFG.padY * 2 + CFG.lineHeight;
          svg.push('<line x1="' + e.x + '" y1="' + divY + '" x2="' + (e.x + e.box.width) + '" y2="' + divY +
            '" stroke="' + colors.stroke + '" stroke-width="1"/>');

          var actionY = divY + 14;
          if (s.entryAction) {
            svg.push('<text x="' + (e.x + CFG.padX / 2) + '" y="' + actionY +
              '" font-size="' + CFG.fontSizeAction + '" fill="' + colors.text + '">entry / ' +
              escapeXml(s.entryAction) + '</text>');
            actionY += 16;
          }
          if (s.exitAction) {
            svg.push('<text x="' + (e.x + CFG.padX / 2) + '" y="' + actionY +
              '" font-size="' + CFG.fontSizeAction + '" fill="' + colors.text + '">exit / ' +
              escapeXml(s.exitAction) + '</text>');
            actionY += 16;
          }
          if (s.doActivity) {
            svg.push('<text x="' + (e.x + CFG.padX / 2) + '" y="' + actionY +
              '" font-size="' + CFG.fontSizeAction + '" fill="' + colors.text + '">do / ' +
              escapeXml(s.doActivity) + '</text>');
          }
        }
      }
    }

    svg.push('</g>');
    svg.push('</svg>');
    return svg.join('\n');
  }

  function drawArrow(svg, x, y, ux, uy, color) {
    var as = CFG.arrowSize;
    var hw = as * 0.35;
    var px = -uy, py = ux;
    svg.push('<polygon points="' +
      x + ',' + y + ' ' +
      (x + ux * as + px * hw) + ',' + (y + uy * as + py * hw) + ' ' +
      (x + ux * as - px * hw) + ',' + (y + uy * as - py * hw) +
      '" fill="' + color + '" stroke="none"/>');
  }

  // ─── Public API ───────────────────────────────────────────────────

  function render(container, text) {
    var parsed = parse(text);
    if (!parsed.states || parsed.states.length === 0) {
      container.innerHTML = '<div style="padding:20px;color:#888;text-align:center;">No states to display.</div>';
      return;
    }
    if (!container.classList.contains('uml-class-diagram-container')) {
      container.classList.add('uml-class-diagram-container');
    }
    var colors = getThemeColors(container);
    var layout = computeLayout(parsed);
    container.innerHTML = generateSVG(layout, parsed, colors);
  }

  // ─── Auto-init ────────────────────────────────────────────────────

  var _diagrams = [];

  function autoInit() {
    var blocks = document.querySelectorAll('pre > code.language-uml-state');
    for (var i = 0; i < blocks.length; i++) {
      var pre = blocks[i].parentElement;
      var text = blocks[i].textContent;
      var container = document.createElement('div');
      container.className = 'uml-class-diagram-container';
      pre.parentElement.replaceChild(container, pre);
      render(container, text);
      _diagrams.push({ container: container, text: text });
    }
    var observer = new MutationObserver(function (mutations) {
      for (var m = 0; m < mutations.length; m++) {
        if (mutations[m].attributeName === 'class') {
          setTimeout(function () {
            for (var d = 0; d < _diagrams.length; d++) render(_diagrams[d].container, _diagrams[d].text);
          }, 50);
          break;
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }

  window.UMLStateDiagram = { render: render, parse: parse };
})();
