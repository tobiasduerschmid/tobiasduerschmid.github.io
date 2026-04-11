/**
 * UML Deployment Diagram Renderer
 *
 * Maps components to hardware nodes (servers, devices).
 *
 * Text format:
 *   @startuml
 *   node WebServer {
 *     component AppServer
 *     component Logger
 *   }
 *   node DatabaseServer {
 *     component MySQL
 *   }
 *   node ClientDevice {
 *     component WebBrowser
 *   }
 *
 *   WebServer --> DatabaseServer : TCP/IP
 *   ClientDevice --> WebServer : HTTPS
 *   @enduml
 *
 * Notation:
 *   node Name { ... }    Node (3D box / cube) containing components
 *   component Name       Component inside a node
 *   A --> B : label      Communication link between nodes
 *   A ..> B : label      Dependency
 */
(function () {
  'use strict';

  var CFG = {
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    fontSize: 13,
    fontSizeBold: 14,
    fontSizeComp: 12,
    lineHeight: 20,
    nodePadX: 20,
    nodePadY: 14,
    nodeMinW: 160,
    nodeMinH: 60,
    node3dDepth: 12,
    compH: 26,
    compPadX: 10,
    compIconW: 14,
    compIconH: 10,
    compIconTabW: 6,
    compIconTabH: 3,
    compGapY: 6,
    gapX: 100,
    gapY: 80,
    arrowSize: 10,
    strokeWidth: 1.5,
    svgPad: 30,
    labelBgPad: 4,
  };

  // ─── Parser ───────────────────────────────────────────────────────

  function parse(text) {
    var lines = text.split('\n');
    var nodes = [];
    var nodeMap = {};
    var links = [];
    var currentNode = null;
    var braceDepth = 0;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line === '@startuml' || line === '@enduml') continue;

      // Inside a node block
      if (currentNode !== null) {
        for (var ci = 0; ci < line.length; ci++) {
          if (line[ci] === '{') braceDepth++;
          if (line[ci] === '}') braceDepth--;
        }
        if (braceDepth <= 0) {
          currentNode = null;
          braceDepth = 0;
          continue;
        }
        // Component inside node
        var compMatch = line.match(/^component\s+(\S+)/);
        if (compMatch) {
          nodeMap[currentNode].components.push(compMatch[1]);
        }
        // Artifact inside node
        var artMatch = line.match(/^artifact\s+(\S+)/);
        if (artMatch) {
          nodeMap[currentNode].components.push(artMatch[1]);
        }
        continue;
      }

      // Node declaration
      var nodeMatch = line.match(/^node\s+(\S+)\s*\{?/);
      if (nodeMatch) {
        var nName = nodeMatch[1];
        if (!nodeMap[nName]) {
          // Support instance notation: "instanceName:TypeName" (underlined per UML spec Fig 9-3)
          var isInstance = nName.indexOf(':') !== -1;
          nodeMap[nName] = { name: nName, isInstance: isInstance, components: [] };
          nodes.push(nodeMap[nName]);
        }
        if (line.indexOf('{') !== -1) {
          braceDepth = 1;
          if (line.indexOf('}') !== -1 && line.indexOf('}') > line.indexOf('{')) {
            braceDepth = 0;
          } else {
            currentNode = nName;
          }
        }
        continue;
      }

      // Link: A --> B : label  or  A ..> B : label
      var linkMatch = line.match(/^(\S+)\s+(-->|\.\.>|--)\s+(\S+)\s*(?::\s*(.*))?$/);
      if (linkMatch) {
        var from = linkMatch[1], arrow = linkMatch[2], to = linkMatch[3];
        var label = (linkMatch[4] || '').trim();
        // Ensure nodes exist
        if (!nodeMap[from]) { nodeMap[from] = { name: from, isInstance: from.indexOf(':') !== -1, components: [] }; nodes.push(nodeMap[from]); }
        if (!nodeMap[to]) { nodeMap[to] = { name: to, isInstance: to.indexOf(':') !== -1, components: [] }; nodes.push(nodeMap[to]); }
        var type = arrow === '..>' ? 'dependency' : 'link';
        links.push({ from: from, to: to, type: type, label: label });
        continue;
      }
    }

    return { nodes: nodes, links: links };
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

  function computeLayout(parsed) {
    var nodes = parsed.nodes;
    var links = parsed.links;
    if (nodes.length === 0) return { entries: {}, width: 0, height: 0 };

    var entries = {};
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var nameW = textWidth(n.name, true, CFG.fontSizeBold);
      var compMaxW = 0;
      for (var c = 0; c < n.components.length; c++) {
        compMaxW = Math.max(compMaxW, textWidth(n.components[c], false, CFG.fontSizeComp) + CFG.compIconW + CFG.compPadX * 2 + 8);
      }
      var w = Math.max(CFG.nodeMinW, nameW + CFG.nodePadX * 2, compMaxW + CFG.nodePadX * 2);
      var h = CFG.nodePadY + CFG.lineHeight + 8; // name area
      if (n.components.length > 0) {
        h += n.components.length * (CFG.compH + CFG.compGapY) + CFG.nodePadY;
      } else {
        h = Math.max(h + CFG.nodePadY, CFG.nodeMinH);
      }
      entries[n.name] = { node: n, box: { width: Math.ceil(w), height: Math.ceil(h) }, x: 0, y: 0 };
    }

    // Compute link label widths for gap sizing
    var maxLabelW = 0;
    for (var li = 0; li < links.length; li++) {
      if (links[li].label) maxLabelW = Math.max(maxLabelW, textWidth(links[li].label, false, CFG.fontSize));
    }
    var effectiveGapX = Math.max(CFG.gapX, maxLabelW + 40);

    // Build directed graph for layering
    var children = {}, parents = {};
    for (var cn in entries) { children[cn] = []; parents[cn] = []; }
    for (var li2 = 0; li2 < links.length; li2++) {
      var lk = links[li2];
      if (entries[lk.from] && entries[lk.to]) {
        if (children[lk.from].indexOf(lk.to) === -1) { children[lk.from].push(lk.to); parents[lk.to].push(lk.from); }
      }
    }

    var roots = [];
    for (var cn2 in entries) { if (parents[cn2].length === 0) roots.push(cn2); }
    if (roots.length === 0) roots = [nodes[0].name];

    // BFS layer assignment
    var layers = {}, visited = {}, queue = [];
    for (var ri = 0; ri < roots.length; ri++) { layers[roots[ri]] = 0; visited[roots[ri]] = true; queue.push(roots[ri]); }
    while (queue.length > 0) {
      var nd = queue.shift();
      var kids = children[nd];
      for (var ki = 0; ki < kids.length; ki++) {
        var kid = kids[ki], nl = (layers[nd] || 0) + 1;
        if (!visited[kid]) { visited[kid] = true; layers[kid] = nl; queue.push(kid); }
        else if (nl > layers[kid]) { layers[kid] = nl; queue.push(kid); }
      }
    }
    for (var cn3 in entries) { if (layers[cn3] === undefined) layers[cn3] = 0; }

    // Group and position by layer
    var layerGroups = {}, maxLayer = 0;
    for (var cn4 in entries) { var l = layers[cn4]; if (!layerGroups[l]) layerGroups[l] = []; layerGroups[l].push(cn4); maxLayer = Math.max(maxLayer, l); }

    var curY = 0;
    for (var ly = 0; ly <= maxLayer; ly++) {
      var group = layerGroups[ly]; if (!group) continue;
      var curX = 0;
      for (var gi = 0; gi < group.length; gi++) {
        entries[group[gi]].x = curX;
        entries[group[gi]].y = curY;
        curX += entries[group[gi]].box.width + effectiveGapX;
      }
      var maxH = 0;
      for (var gi2 = 0; gi2 < group.length; gi2++) maxH = Math.max(maxH, entries[group[gi2]].box.height);
      curY += maxH + CFG.gapY;
    }

    // Center layers
    var maxLayerW = 0;
    for (var ly2 = 0; ly2 <= maxLayer; ly2++) {
      var g = layerGroups[ly2]; if (!g) continue;
      var le = entries[g[g.length - 1]];
      maxLayerW = Math.max(maxLayerW, le.x + le.box.width);
    }
    for (var ly3 = 0; ly3 <= maxLayer; ly3++) {
      var g2 = layerGroups[ly3]; if (!g2) continue;
      var le2 = entries[g2[g2.length - 1]];
      var off = (maxLayerW - (le2.x + le2.box.width)) / 2;
      for (var gi3 = 0; gi3 < g2.length; gi3++) entries[g2[gi3]].x += off;
    }

    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var en in entries) {
      var e = entries[en];
      minX = Math.min(minX, e.x); minY = Math.min(minY, e.y);
      maxX = Math.max(maxX, e.x + e.box.width + CFG.node3dDepth);
      maxY = Math.max(maxY, e.y + e.box.height + CFG.node3dDepth);
    }

    return { entries: entries, width: maxX - minX, height: maxY - minY, offsetX: -minX, offsetY: -minY };
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
    var links = parsed.links;
    var ox = layout.offsetX + CFG.svgPad;
    var oy = layout.offsetY + CFG.svgPad;
    var svgW = layout.width + CFG.svgPad * 2;
    var svgH = layout.height + CFG.svgPad * 2;

    var svg = [];
    svg.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + svgW + '" height="' + svgH + '" ');
    svg.push('viewBox="0 0 ' + svgW + ' ' + svgH + '" style="font-family: ' + CFG.fontFamily + '; max-width: none;">');
    svg.push('<g transform="translate(' + ox + ',' + oy + ')">');

    // ── Draw links ──
    for (var li = 0; li < links.length; li++) {
      var lk = links[li];
      var fromE = entries[lk.from], toE = entries[lk.to];
      if (!fromE || !toE) continue;

      var isDash = lk.type === 'dependency';
      var dAttr = isDash ? ' stroke-dasharray="8,4"' : '';

      var fromCx = fromE.x + fromE.box.width / 2, fromCy = fromE.y + fromE.box.height / 2;
      var toCx = toE.x + toE.box.width / 2, toCy = toE.y + toE.box.height / 2;
      var dx = toCx - fromCx, dy = toCy - fromCy;

      var x1, y1, x2, y2;
      if (Math.abs(dx) > Math.abs(dy) * 0.5) {
        if (dx > 0) { x1 = fromE.x + fromE.box.width; y1 = fromCy; x2 = toE.x; y2 = toCy; }
        else { x1 = fromE.x; y1 = fromCy; x2 = toE.x + toE.box.width; y2 = toCy; }
      } else {
        if (dy > 0) { x1 = fromCx; y1 = fromE.y + fromE.box.height; x2 = toCx; y2 = toE.y; }
        else { x1 = fromCx; y1 = fromE.y; x2 = toCx; y2 = toE.y + toE.box.height; }
      }

      var points;
      if (Math.abs(x1 - x2) < 2 || Math.abs(y1 - y2) < 2) {
        points = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
      } else {
        var midY = (y1 + y2) / 2;
        points = [{ x: x1, y: y1 }, { x: x1, y: midY }, { x: x2, y: midY }, { x: x2, y: y2 }];
      }

      var pStr = '';
      for (var pi = 0; pi < points.length; pi++) { if (pi > 0) pStr += ' '; pStr += points[pi].x + ',' + points[pi].y; }
      svg.push('<polyline points="' + pStr + '" fill="none" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"' + dAttr + '/>');

      // Arrowhead
      var pLast = points[points.length - 1], pPrev = points[points.length - 2];
      var adx = pLast.x - pPrev.x, ady = pLast.y - pPrev.y;
      var alen = Math.sqrt(adx * adx + ady * ady);
      if (alen > 0) { adx /= alen; ady /= alen; }
      var as = CFG.arrowSize, hw = as * 0.35, px = -ady, py = adx;
      if (isDash) {
        svg.push('<polyline points="' +
          (pLast.x - adx * as + px * hw) + ',' + (pLast.y - ady * as + py * hw) + ' ' +
          pLast.x + ',' + pLast.y + ' ' +
          (pLast.x - adx * as - px * hw) + ',' + (pLast.y - ady * as - py * hw) +
          '" fill="none" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"/>');
      } else {
        svg.push('<polygon points="' +
          pLast.x + ',' + pLast.y + ' ' +
          (pLast.x - adx * as + px * hw) + ',' + (pLast.y - ady * as + py * hw) + ' ' +
          (pLast.x - adx * as - px * hw) + ',' + (pLast.y - ady * as - py * hw) +
          '" fill="' + colors.line + '"/>');
      }

      // Label
      if (lk.label) {
        var bestIdx = 0, bestLen = 0;
        for (var si = 0; si < points.length - 1; si++) {
          var segLen = Math.abs(points[si+1].x - points[si].x) + Math.abs(points[si+1].y - points[si].y);
          if (segLen > bestLen) { bestLen = segLen; bestIdx = si; }
        }
        var lp0 = points[bestIdx], lp1 = points[bestIdx + 1];
        var lx = (lp0.x + lp1.x) / 2, ly = (lp0.y + lp1.y) / 2;
        var isH = Math.abs(lp1.y - lp0.y) < 1;
        if (isH) ly -= 8; else lx += 10;
        var lw = textWidth(lk.label, false, CFG.fontSize);
        svg.push('<rect x="' + (lx - lw / 2 - CFG.labelBgPad) + '" y="' + (ly - 12) +
          '" width="' + (lw + CFG.labelBgPad * 2) + '" height="16" fill="' + colors.fill + '" opacity="0.85"/>');
        svg.push('<text x="' + lx + '" y="' + ly +
          '" text-anchor="middle" font-size="' + CFG.fontSize + '" fill="' + colors.text + '" font-style="italic">' +
          escapeXml(lk.label) + '</text>');
      }
    }

    // ── Draw nodes (3D cube style) ──
    for (var en in entries) {
      var e = entries[en];
      var n = e.node;
      var bx = e.x, by = e.y, bw = e.box.width, bh = e.box.height;
      var d = CFG.node3dDepth;

      // 3D effect: top face (parallelogram)
      svg.push('<polygon points="' +
        bx + ',' + by + ' ' +
        (bx + d) + ',' + (by - d) + ' ' +
        (bx + bw + d) + ',' + (by - d) + ' ' +
        (bx + bw) + ',' + by +
        '" fill="' + colors.headerFill + '" stroke="' + colors.stroke + '" stroke-width="' + CFG.strokeWidth + '"/>');

      // 3D effect: right face (parallelogram)
      svg.push('<polygon points="' +
        (bx + bw) + ',' + by + ' ' +
        (bx + bw + d) + ',' + (by - d) + ' ' +
        (bx + bw + d) + ',' + (by + bh - d) + ' ' +
        (bx + bw) + ',' + (by + bh) +
        '" fill="' + colors.headerFill + '" stroke="' + colors.stroke + '" stroke-width="' + CFG.strokeWidth + '" opacity="0.8"/>');

      // Front face (main rectangle)
      svg.push('<rect x="' + bx + '" y="' + by + '" width="' + bw + '" height="' + bh +
        '" fill="' + colors.fill + '" stroke="' + colors.stroke + '" stroke-width="' + CFG.strokeWidth + '"/>');

      // Node name (top area) — bold for classifier, underlined for instance (name:Type per UML spec Fig 9-3)
      var nameAttrs = ' font-size="' + CFG.fontSizeBold + '" fill="' + colors.text + '"';
      if (n.isInstance) {
        nameAttrs += ' text-decoration="underline"';
      } else {
        nameAttrs += ' font-weight="bold"';
      }
      svg.push('<text x="' + (bx + CFG.nodePadX) + '" y="' + (by + CFG.nodePadY + CFG.lineHeight * 0.75) + '"' +
        nameAttrs + '>' + escapeXml(n.name) + '</text>');

      // Components inside the node
      var compY = by + CFG.nodePadY + CFG.lineHeight + 8;
      for (var c = 0; c < n.components.length; c++) {
        var compName = n.components[c];
        var compW = bw - CFG.nodePadX * 2;
        var cx = bx + CFG.nodePadX;

        // Component rectangle
        svg.push('<rect x="' + cx + '" y="' + compY + '" width="' + compW + '" height="' + CFG.compH +
          '" fill="' + colors.headerFill + '" stroke="' + colors.stroke + '" stroke-width="1"/>');

        // Component icon (small rect with tabs)
        var ix = cx + compW - CFG.compIconW - 6;
        var iy = compY + (CFG.compH - CFG.compIconH) / 2;
        svg.push('<rect x="' + ix + '" y="' + iy + '" width="' + CFG.compIconW + '" height="' + CFG.compIconH +
          '" fill="' + colors.fill + '" stroke="' + colors.stroke + '" stroke-width="0.8"/>');
        svg.push('<rect x="' + (ix - CFG.compIconTabW / 2) + '" y="' + (iy + 1) +
          '" width="' + CFG.compIconTabW + '" height="' + CFG.compIconTabH +
          '" fill="' + colors.fill + '" stroke="' + colors.stroke + '" stroke-width="0.8"/>');
        svg.push('<rect x="' + (ix - CFG.compIconTabW / 2) + '" y="' + (iy + CFG.compIconH - CFG.compIconTabH - 1) +
          '" width="' + CFG.compIconTabW + '" height="' + CFG.compIconTabH +
          '" fill="' + colors.fill + '" stroke="' + colors.stroke + '" stroke-width="0.8"/>');

        // Component name
        svg.push('<text x="' + (cx + CFG.compPadX) + '" y="' + (compY + CFG.compH / 2 + CFG.fontSizeComp * 0.35) +
          '" font-size="' + CFG.fontSizeComp + '" fill="' + colors.text + '">' +
          escapeXml(compName) + '</text>');

        compY += CFG.compH + CFG.compGapY;
      }
    }

    svg.push('</g>');
    svg.push('</svg>');
    return svg.join('\n');
  }

  // ─── Public API ───────────────────────────────────────────────────

  function render(container, text) {
    var parsed = parse(text);
    if (!parsed.nodes || parsed.nodes.length === 0) {
      container.innerHTML = '<div style="padding:20px;color:#888;text-align:center;">No nodes to display.</div>';
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
    var blocks = document.querySelectorAll('pre > code.language-uml-deployment');
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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoInit);
  else autoInit();

  window.UMLDeploymentDiagram = { render: render, parse: parse };
})();
