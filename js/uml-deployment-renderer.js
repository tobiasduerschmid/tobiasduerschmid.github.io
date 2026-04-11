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
    fontSize: 14,
    fontSizeBold: 15,
    fontSizeComp: 13,
    lineHeight: 22,
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

  // ─── Layout ───────────────────────────────────────────────────────

  function computeLayout(parsed) {
    var nodes = parsed.nodes;
    var links = parsed.links;
    if (nodes.length === 0) return { entries: {}, width: 0, height: 0, offsetX: 0, offsetY: 0 };

    var entries = {};
    var layoutNodes = [];
    var layoutEdges = [];

    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var nameW = UMLShared.textWidth(n.name, true, CFG.fontSizeBold);
      var compMaxW = 0;
      for (var c = 0; c < n.components.length; c++) {
        compMaxW = Math.max(compMaxW, UMLShared.textWidth(n.components[c], false, CFG.fontSizeComp) + CFG.compIconW + CFG.compPadX * 2 + 8);
      }
      var w = Math.max(CFG.nodeMinW, nameW + CFG.nodePadX * 2, compMaxW + CFG.nodePadX * 2);
      var h = CFG.nodePadY + CFG.lineHeight + 8; // name area
      if (n.components.length > 0) {
        h += n.components.length * (CFG.compH + CFG.compGapY) + CFG.nodePadY;
      } else {
        h = Math.max(h + CFG.nodePadY, CFG.nodeMinH);
      }
      entries[n.name] = { node: n, box: { width: Math.ceil(w), height: Math.ceil(h) }, x: 0, y: 0 };
      layoutNodes.push({ id: n.name, width: Math.ceil(w), height: Math.ceil(h), data: n });
    }

    for (var li = 0; li < links.length; li++) {
      var lk = links[li];
      layoutEdges.push({ source: lk.from, target: lk.to, type: lk.type, data: lk });
    }

    // Compute link label widths for gap sizing
    var maxLabelW = 0;
    for (var li = 0; li < links.length; li++) {
      if (links[li].label) maxLabelW = Math.max(maxLabelW, UMLShared.textWidth(links[li].label, false, CFG.fontSize));
    }
    var effectiveGapX = Math.max(CFG.gapX, maxLabelW + 40);

    var result = window.UMLAdvancedLayout.compute(layoutNodes, layoutEdges, { gapX: effectiveGapX, gapY: CFG.gapY });

    for (var nm in result.nodes) {
      if (!entries[nm]) continue;
      entries[nm].x = result.nodes[nm].x;
      entries[nm].y = result.nodes[nm].y;
    }

    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var en in entries) {
      var e = entries[en];
      minX = Math.min(minX, e.x); minY = Math.min(minY, e.y - CFG.node3dDepth);
      maxX = Math.max(maxX, e.x + e.box.width + CFG.node3dDepth);
      maxY = Math.max(maxY, e.y + e.box.height);
    }

    return { 
      entries: entries, 
      width: maxX - minX, 
      height: maxY - minY, 
      offsetX: -minX, 
      offsetY: -minY,
      layoutResult: result 
    };
  }

  // ─── SVG Renderer ─────────────────────────────────────────────────

  function generateSVG(layout, parsed, colors) {
    var entries = layout.entries;
    var links = parsed.links;
    var ox = layout.offsetX + CFG.svgPad;
    var oy = layout.offsetY + CFG.svgPad;
    var svgW = layout.width + CFG.svgPad * 2;
    var svgH = layout.height + CFG.svgPad * 2;

    var svg = [];
    svg.push(UMLShared.svgOpen(svgW, svgH, ox, oy, CFG.fontFamily));
    // ── Pre-compute distributed exit/entry points ──
    var exitsByFrom = {}, entriesByTo = {};
    for (var pli = 0; pli < links.length; pli++) {
      var plk = links[pli];
      if (!entries[plk.from] || !entries[plk.to]) continue;
      if (!exitsByFrom[plk.from]) exitsByFrom[plk.from] = [];
      exitsByFrom[plk.from].push(pli);
      if (!entriesByTo[plk.to]) entriesByTo[plk.to] = [];
      entriesByTo[plk.to].push(pli);
    }
    var distExitX = {}, distEntryX = {};
    for (var efn in exitsByFrom) {
      var efg = exitsByFrom[efn];
      if (efg.length < 2) continue;
      var efe = entries[efn];
      efg.sort(function(a, b) {
        var ta = entries[links[a].to], tb = entries[links[b].to];
        if (!ta || !tb) return 0;
        return (ta.x + ta.box.width / 2) - (tb.x + tb.box.width / 2);
      });
      for (var efi = 0; efi < efg.length; efi++) {
        distExitX[efg[efi]] = efe.x + efe.box.width * (efi + 1) / (efg.length + 1);
      }
    }
    for (var etn in entriesByTo) {
      var etg = entriesByTo[etn];
      if (etg.length < 2) continue;
      var ete = entries[etn];
      etg.sort(function(a, b) {
        var fa = entries[links[a].from], fb = entries[links[b].from];
        if (!fa || !fb) return 0;
        return (fa.x + fa.box.width / 2) - (fb.x + fb.box.width / 2);
      });
      for (var eti = 0; eti < etg.length; eti++) {
        distEntryX[etg[eti]] = ete.x + ete.box.width * (eti + 1) / (etg.length + 1);
      }
    }

    // ── Draw links ──
    for (var li = 0; li < links.length; li++) {
      var lk = links[li];
      var fromE = entries[lk.from], toE = entries[lk.to];
      if (!fromE || !toE) continue;

      var isDash = lk.type === 'dependency';
      var dAttr = isDash ? ' stroke-dasharray="8,4"' : '';

      var origFromCx = fromE.x + fromE.box.width / 2;
      var origToCx = toE.x + toE.box.width / 2;
      var fromCy = fromE.y + fromE.box.height / 2;
      var toCy = toE.y + toE.box.height / 2;
      var dx = origToCx - origFromCx, dy = toCy - fromCy;
      var fromCx = (distExitX[li] !== undefined) ? distExitX[li] : origFromCx;
      var toCx = (distEntryX[li] !== undefined) ? distEntryX[li] : origToCx;

      var x1, y1, x2, y2;
      var isHorizontal = false;
      if (Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx > 0) { x1 = fromE.x + fromE.box.width; y1 = fromCy; x2 = toE.x; y2 = toCy; }
        else { x1 = fromE.x; y1 = fromCy; x2 = toE.x + toE.box.width; y2 = toCy; }
        isHorizontal = true;
      } else {
        if (dy > 0) { x1 = fromCx; y1 = fromE.y + fromE.box.height; x2 = toCx; y2 = toE.y; }
        else { x1 = fromCx; y1 = fromE.y; x2 = toCx; y2 = toE.y + toE.box.height; }
        isHorizontal = false;
      }

      var points;
      if (!isHorizontal && Math.abs(x1 - x2) < 2) {
        points = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
      } else if (isHorizontal && Math.abs(y1 - y2) < 2) {
        points = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
      } else {
        if (isHorizontal) {
          var midX = (x1 + x2) / 2;
          points = [{ x: x1, y: y1 }, { x: midX, y: y1 }, { x: midX, y: y2 }, { x: x2, y: y2 }];
        } else {
          var midY = (y1 + y2) / 2;
          points = [{ x: x1, y: y1 }, { x: x1, y: midY }, { x: x2, y: midY }, { x: x2, y: y2 }];
        }
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
        var lAnchor = 'middle';
        if (isH) { ly -= 8; } else { lx += 10; lAnchor = 'start'; }
        svg.push('<text x="' + lx + '" y="' + ly +
          '" text-anchor="' + lAnchor + '" font-size="' + CFG.fontSize + '" fill="' + colors.text +
          '" stroke="' + colors.fill + '" stroke-width="4" stroke-linejoin="round" paint-order="stroke" font-style="italic">' +
          UMLShared.escapeXml(lk.label) + '</text>');
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
        nameAttrs + '>' + UMLShared.escapeXml(n.name) + '</text>');

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
          UMLShared.escapeXml(compName) + '</text>');

        compY += CFG.compH + CFG.compGapY;
      }
    }

    svg.push(UMLShared.svgClose());
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
    var colors = UMLShared.getThemeColors(container);
    var layout = computeLayout(parsed);
    container.innerHTML = generateSVG(layout, parsed, colors);
  }

  // ─── Auto-init ────────────────────────────────────────────────────

  UMLShared.createAutoInit('pre > code.language-uml-deployment', render);

  window.UMLDeploymentDiagram = { render: render, parse: parse };
})();
