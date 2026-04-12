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
 *   layout horizontal    Left-to-right layout (also: left-to-right, LR)
 *   layout vertical      Top-to-bottom layout (also: top-to-bottom, TB) [default]
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
    var notes = [];
    var currentNode = null;
    var braceDepth = 0;
    var direction = 'TB';

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line === '@startuml' || line === '@enduml') continue;

      // Layout directive
      var layoutMatch = line.match(/^layout\s+(horizontal|vertical|left-to-right|top-to-bottom|LR|TB)$/i);
      if (layoutMatch && !currentNode) {
        var val = layoutMatch[1].toLowerCase();
        direction = (val === 'horizontal' || val === 'left-to-right' || val === 'lr') ? 'LR' : 'TB';
        continue;
      }

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

      // Note
      var noteIdx = UMLShared.parseNoteLine(line, lines, i, notes);
      if (noteIdx >= 0) { i = noteIdx; continue; }

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

    return { nodes: nodes, links: links, notes: notes, direction: direction };
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

    var result = window.UMLAdvancedLayout.compute(layoutNodes, layoutEdges, { gapX: effectiveGapX, gapY: CFG.gapY, direction: parsed.direction || 'TB' });

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

    // Expand bounds to account for link labels that may extend beyond nodes
    var maxLabelH = 0, maxLabelWHalf = 0;
    for (var dli = 0; dli < links.length; dli++) {
      if (links[dli].label) {
        var dlW = UMLShared.textWidth(links[dli].label, false, CFG.fontSize);
        maxLabelWHalf = Math.max(maxLabelWHalf, dlW / 2 + 10);
        maxLabelH = Math.max(maxLabelH, CFG.fontSize + 16);
      }
    }
    minX -= maxLabelWHalf;
    minY -= maxLabelH;
    maxX += maxLabelWHalf;
    maxY += maxLabelH;

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

    // Resolve note target — supports dotted paths to sub-elements
    function resolveTarget(target) {
      var parts = target.split('.');
      var entry = entries[parts[0]];
      if (!entry) return null;
      return { x: entry.x, y: entry.y, w: entry.box.width, h: entry.box.height };
    }

    // Pre-compute note positions for SVG bounds expansion
    var notePositions = [];
    if (parsed.notes) {
      var noteGap = UMLShared.NOTE_CFG.gap;
      for (var npi = 0; npi < parsed.notes.length; npi++) {
        var pn = parsed.notes[npi]; var tgt = resolveTarget(pn.target); if (!tgt) continue;
        var ns = UMLShared.measureNote(pn.lines);
        var nx, ny, tx = tgt.x, ty = tgt.y, tw = tgt.w, th = tgt.h;
        if (pn.position === 'right') { nx = tx + tw + noteGap; ny = ty; }
        else if (pn.position === 'left') { nx = tx - ns.width - noteGap; ny = ty; }
        else if (pn.position === 'top') { nx = tx; ny = ty - ns.height - noteGap; }
        else { nx = tx; ny = ty + th + noteGap; }
        notePositions.push({ note: pn, x: nx, y: ny, w: ns.width, h: ns.height, tx: tx, ty: ty, tw: tw, th: th });
      }
    }
    var noteExtraL = 0, noteExtraR = 0, noteExtraT = 0, noteExtraB = 0;
    for (var nbi = 0; nbi < notePositions.length; nbi++) {
      var npb = notePositions[nbi];
      if (npb.x < -layout.offsetX) noteExtraL = Math.max(noteExtraL, -layout.offsetX - npb.x + CFG.svgPad);
      var nr = npb.x + npb.w - (layout.width - layout.offsetX);
      if (nr > 0) noteExtraR = Math.max(noteExtraR, nr + CFG.svgPad);
      if (npb.y < -layout.offsetY) noteExtraT = Math.max(noteExtraT, -layout.offsetY - npb.y + CFG.svgPad);
      var nb = npb.y + npb.h - (layout.height - layout.offsetY);
      if (nb > 0) noteExtraB = Math.max(noteExtraB, nb + CFG.svgPad);
    }

    var ox = layout.offsetX + CFG.svgPad + noteExtraL;
    var oy = layout.offsetY + CFG.svgPad + noteExtraT;
    var svgW = layout.width + CFG.svgPad * 2 + noteExtraL + noteExtraR;
    var svgH = layout.height + CFG.svgPad * 2 + noteExtraT + noteExtraB;

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

    // ── Obstacle-aware routing helpers ──
    var obPad = 10;
    var obstacles = [];
    for (var obn in entries) {
      var obe = entries[obn];
      obstacles.push({
        x1: obe.x - obPad,
        y1: obe.y - CFG.node3dDepth - obPad,
        x2: obe.x + obe.box.width + CFG.node3dDepth + obPad,
        y2: obe.y + obe.box.height + obPad,
        name: obn
      });
    }

    function vSegHitsObs(x, yMin, yMax, skipNames) {
      for (var i = 0; i < obstacles.length; i++) {
        var ob = obstacles[i];
        if (skipNames && (skipNames[ob.name])) continue;
        if (x > ob.x1 && x < ob.x2 && yMax > ob.y1 && yMin < ob.y2) return true;
      }
      return false;
    }

    function hSegHitsObs(y, xMin, xMax, skipNames) {
      for (var i = 0; i < obstacles.length; i++) {
        var ob = obstacles[i];
        if (skipNames && (skipNames[ob.name])) continue;
        if (y > ob.y1 && y < ob.y2 && xMax > ob.x1 && xMin < ob.x2) return true;
      }
      return false;
    }

    function findClearX(yMin, yMax, preferX, skipNames) {
      if (!vSegHitsObs(preferX, yMin, yMax, skipNames)) return preferX;
      for (var d = 10; d < 800; d += 10) {
        if (!vSegHitsObs(preferX + d, yMin, yMax, skipNames)) return preferX + d;
        if (!vSegHitsObs(preferX - d, yMin, yMax, skipNames)) return preferX - d;
      }
      return preferX;
    }

    function findClearY(xMin, xMax, preferY, skipNames) {
      if (!hSegHitsObs(preferY, xMin, xMax, skipNames)) return preferY;
      for (var d = 10; d < 800; d += 10) {
        if (!hSegHitsObs(preferY + d, xMin, xMax, skipNames)) return preferY + d;
        if (!hSegHitsObs(preferY - d, xMin, xMax, skipNames)) return preferY - d;
      }
      return preferY;
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

      // Skip names for obstacle checking (don't avoid source/target)
      var skipN = {};
      skipN[lk.from] = true;
      skipN[lk.to] = true;

      var x1, y1, x2, y2;
      var exitDir; // 'top', 'bottom', 'left', 'right'
      var entryDir;
      if (Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx > 0) { x1 = fromE.x + fromE.box.width; y1 = fromCy; x2 = toE.x; y2 = toCy; exitDir = 'right'; entryDir = 'left'; }
        else { x1 = fromE.x; y1 = fromCy; x2 = toE.x + toE.box.width; y2 = toCy; exitDir = 'left'; entryDir = 'right'; }
      } else {
        // For vertical links, try to use the same X for both endpoints to avoid angles
        // Pick the X that is clear of obstacles, preferring mid between the two
        var sharedX = (fromCx + toCx) / 2;
        var yTop = Math.min(fromE.y + fromE.box.height, toE.y) ;
        var yBot = Math.max(fromE.y + fromE.box.height, toE.y);
        if (!vSegHitsObs(sharedX, yTop, yBot, skipN)) {
          fromCx = sharedX;
          toCx = sharedX;
        } else if (!vSegHitsObs(fromCx, yTop, yBot, skipN)) {
          toCx = fromCx;
        } else if (!vSegHitsObs(toCx, yTop, yBot, skipN)) {
          fromCx = toCx;
        }
        if (dy > 0) { x1 = fromCx; y1 = fromE.y + fromE.box.height; x2 = toCx; y2 = toE.y; exitDir = 'bottom'; entryDir = 'top'; }
        else { x1 = fromCx; y1 = fromE.y; x2 = toCx; y2 = toE.y + toE.box.height; exitDir = 'top'; entryDir = 'bottom'; }
      }

      var points;
      if (Math.abs(x1 - x2) < 2 && Math.abs(y1 - y2) < 2) {
        points = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
      } else if (exitDir === 'bottom' || exitDir === 'top') {
        // Vertical link
        if (Math.abs(x1 - x2) < 2) {
          // Straight vertical — check if it passes through an obstacle
          var vTop = Math.min(y1, y2), vBot = Math.max(y1, y2);
          if (!vSegHitsObs(x1, vTop, vBot, skipN)) {
            points = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
          } else {
            // Need to route around — find clear X for vertical channel
            var clearX = findClearX(vTop, vBot, x1, skipN);
            points = [{ x: x1, y: y1 }, { x: x1, y: (y1 + y2) / 2 }, { x: clearX, y: (y1 + y2) / 2 }, { x: clearX, y: y2 }];
          }
        } else {
          // Different X — use Z-route with obstacle-aware midY
          var midY = (y1 + y2) / 2;
          var xMin = Math.min(x1, x2), xMax = Math.max(x1, x2);
          midY = findClearY(xMin, xMax, midY, skipN);
          points = [{ x: x1, y: y1 }, { x: x1, y: midY }, { x: x2, y: midY }, { x: x2, y: y2 }];
        }
      } else {
        // Horizontal link
        if (Math.abs(y1 - y2) < 2) {
          points = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
        } else {
          var midX = (x1 + x2) / 2;
          var hTop = Math.min(y1, y2), hBot = Math.max(y1, y2);
          midX = findClearX(hTop, hBot, midX, skipN);
          points = [{ x: x1, y: y1 }, { x: midX, y: y1 }, { x: midX, y: y2 }, { x: x2, y: y2 }];
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

      // Label — placed on the longest segment, shifted to avoid overlapping nodes
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
        var labelW = UMLShared.textWidth(lk.label, false, CFG.fontSize);
        var labelH = CFG.fontSize;
        if (isH) {
          ly -= 8;
        } else {
          lx += 10; lAnchor = 'start';
        }
        // Check if label overlaps any node and shift if needed
        var lblLeft = (lAnchor === 'middle') ? lx - labelW / 2 : lx;
        var lblRight = lblLeft + labelW;
        var lblTop = ly - labelH;
        var lblBot = ly + 4;
        var labelShifted = false;
        for (var lni = 0; lni < obstacles.length; lni++) {
          var lob = obstacles[lni];
          if (lblRight > lob.x1 && lblLeft < lob.x2 && lblBot > lob.y1 && lblTop < lob.y2) {
            // Label overlaps this node — try placing on opposite side of the line
            if (!isH) {
              // Vertical segment: try left side instead
              lx = lp0.x - 10; lAnchor = 'end';
              lblLeft = lx - labelW; lblRight = lx;
              // Check again
              var stillHits = false;
              for (var lni2 = 0; lni2 < obstacles.length; lni2++) {
                var lob2 = obstacles[lni2];
                if (lblRight > lob2.x1 && lblLeft < lob2.x2 && lblBot > lob2.y1 && lblTop < lob2.y2) {
                  stillHits = true; break;
                }
              }
              if (stillHits) {
                // Both sides blocked — place above/below the segment midpoint, offset further right
                lx = lob.x2 + 10; lAnchor = 'start';
              }
            } else {
              // Horizontal segment: try below instead of above
              ly = lp0.y + labelH + 4;
            }
            labelShifted = true;
            break;
          }
        }
        svg.push('<text x="' + lx + '" y="' + ly +
          '" text-anchor="' + lAnchor + '" font-size="' + CFG.fontSize + '" fill="' + colors.text +
          '" stroke="' + colors.fill + '" stroke-width="4" stroke-opacity="0.85" stroke-linejoin="round" paint-order="stroke" font-style="italic">' +
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

    // ── Draw notes (using pre-computed positions) ──
    for (var ni = 0; ni < notePositions.length; ni++) {
      var np2 = notePositions[ni]; var cF, cT;
      if (np2.note.position === 'right') { cF = { x: np2.x, y: np2.y + np2.h / 2 }; cT = { x: np2.tx + np2.tw, y: np2.ty + np2.th / 2 }; }
      else if (np2.note.position === 'left') { cF = { x: np2.x + np2.w, y: np2.y + np2.h / 2 }; cT = { x: np2.tx, y: np2.ty + np2.th / 2 }; }
      else if (np2.note.position === 'top') { cF = { x: np2.x + np2.w / 2, y: np2.y + np2.h }; cT = { x: np2.tx + np2.tw / 2, y: np2.ty }; }
      else { cF = { x: np2.x + np2.w / 2, y: np2.y }; cT = { x: np2.tx + np2.tw / 2, y: np2.ty + np2.th }; }
      UMLShared.drawNote(svg, np2.x, np2.y, np2.note.lines, colors, { fromX: cF.x, fromY: cF.y, toX: cT.x, toY: cT.y });
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
    UMLShared.autoFitSVG(container);
  }

  // ─── Auto-init ────────────────────────────────────────────────────

  UMLShared.createAutoInit('pre > code.language-uml-deployment', render);

  window.UMLDeploymentDiagram = { render: render, parse: parse };
})();
