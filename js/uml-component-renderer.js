/**
 * UML Component Diagram Renderer
 *
 * Text format:
 *   @startuml
 *   component Client
 *   component Backend {
 *     port httpIn
 *     port dbOut
 *   }
 *
 *   Client --> Backend.httpIn : REST
 *   Backend.dbOut --> Database.dbIn : SQL
 *   Client ..> Logger : uses
 *   @enduml
 *
 * Notation:
 *   component Name          Component box (no ports)
 *   component Name {        Component with named ports
 *     port portName
 *   }
 *   A --> B : label         Assembly connector (solid arrow)
 *   A.port --> B.port       Connector via named ports (squares on boundary)
 *   A ..> B : label         Dependency (dashed arrow)
 *   A -- B : label          Plain link
 */
(function () {
  'use strict';

  var CFG = {
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    fontSize: 13,
    fontSizeBold: 14,
    lineHeight: 20,
    padX: 24,
    padY: 14,
    compMinW: 130,
    compMinH: 50,
    iconW: 20,
    iconH: 14,
    iconTabW: 8,
    iconTabH: 4,
    gapX: 110,
    gapY: 80,
    arrowSize: 10,
    strokeWidth: 1.5,
    svgPad: 30,
    portSize: 10,   // port square side length (straddles boundary, half in/half out)
    portPad: 22,    // min vertical pitch between ports
    labelBgPad: 4,
  };

  // ─── Parser ───────────────────────────────────────────────────────

  function parse(text) {
    var lines = text.split('\n');
    var components = [];
    var componentMap = {};
    var connectors = [];

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line === '@startuml' || line === '@enduml') continue;

      // Component declaration with optional port block
      var compMatch = line.match(/^component\s+(\S+)(?:\s*\{)?/);
      if (compMatch) {
        var cName = compMatch[1];
        var ports = [];

        if (line.indexOf('{') !== -1) {
          if (line.indexOf('}') !== -1) {
            // Inline: component Foo { port p1 port p2 }
            var inlineBody = line.match(/\{([^}]*)\}/);
            if (inlineBody) {
              var portRe = /port\s+(\S+)/g;
              var pm;
              while ((pm = portRe.exec(inlineBody[1])) !== null) {
                ports.push(pm[1]);
              }
            }
          } else {
            // Multi-line block: read until }
            for (i++; i < lines.length; i++) {
              var pline = lines[i].trim();
              if (pline === '}') break;
              var portMatch = pline.match(/^port\s+(\S+)/);
              if (portMatch) ports.push(portMatch[1]);
            }
          }
        }

        if (!componentMap.hasOwnProperty(cName)) {
          componentMap[cName] = components.length;
          components.push({ name: cName, ports: ports });
        }
        continue;
      }

      // Connector: supports "CompName.portName" on either end
      var connMatch = line.match(/^(\S+)\s+(-->|\.\.>|--)\s+(\S+)\s*(?::\s*(.*))?$/);
      if (connMatch) {
        var fromFull = connMatch[1], arrow = connMatch[2], toFull = connMatch[3];
        var label = (connMatch[4] || '').trim();

        var fromParts = fromFull.split('.');
        var toParts = toFull.split('.');
        var from = fromParts[0], fromPort = fromParts[1] || null;
        var to = toParts[0], toPort = toParts[1] || null;

        if (!componentMap.hasOwnProperty(from)) {
          componentMap[from] = components.length;
          components.push({ name: from, ports: [] });
        }
        if (!componentMap.hasOwnProperty(to)) {
          componentMap[to] = components.length;
          components.push({ name: to, ports: [] });
        }

        var type = 'assembly';
        if (arrow === '..>') type = 'dependency';
        else if (arrow === '--') type = 'link';

        connectors.push({ from: from, fromPort: fromPort, to: to, toPort: toPort, type: type, label: label });
        continue;
      }
    }

    return { components: components, connectors: connectors };
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
    var components = parsed.components;
    var connectors = parsed.connectors;
    if (components.length === 0) return { entries: {}, width: 0, height: 0, offsetX: 0, offsetY: 0 };

    // Determine port sides: fromPort → right (outgoing), toPort → left (incoming)
    var portSides = {};
    for (var ci = 0; ci < connectors.length; ci++) {
      var conn = connectors[ci];
      if (conn.fromPort && !portSides[conn.from + '.' + conn.fromPort]) {
        portSides[conn.from + '.' + conn.fromPort] = 'right';
      }
      if (conn.toPort && !portSides[conn.to + '.' + conn.toPort]) {
        portSides[conn.to + '.' + conn.toPort] = 'left';
      }
    }

    var entries = {};
    for (var i = 0; i < components.length; i++) {
      var c = components[i];

      // Assign ports to sides
      var leftPorts = [], rightPorts = [];
      for (var pi = 0; pi < c.ports.length; pi++) {
        var pname = c.ports[pi];
        var side = portSides[c.name + '.' + pname] || 'right';
        if (side === 'left') leftPorts.push(pname);
        else rightPorts.push(pname);
      }

      // Component width only needs to fit name + icon; port labels render outside
      var nameW = textWidth(c.name, true, CFG.fontSizeBold);
      var w = Math.max(CFG.compMinW, nameW + CFG.padX * 2 + CFG.iconW);

      var maxSidePorts = Math.max(leftPorts.length, rightPorts.length);
      var h = maxSidePorts > 0
        ? Math.max(CFG.compMinH, maxSidePorts * CFG.portPad + CFG.portPad)
        : CFG.compMinH;

      entries[c.name] = {
        comp: c,
        box: { width: Math.ceil(w), height: h },
        x: 0, y: 0,
        leftPorts: leftPorts,
        rightPorts: rightPorts,
        portPositions: {},
      };
    }

    // Build directed graph for layering
    var children = {}, parents = {};
    for (var cn in entries) { children[cn] = []; parents[cn] = []; }
    for (var ci2 = 0; ci2 < connectors.length; ci2++) {
      var conn2 = connectors[ci2];
      if (entries[conn2.from] && entries[conn2.to]) {
        if (children[conn2.from].indexOf(conn2.to) === -1) {
          children[conn2.from].push(conn2.to);
          parents[conn2.to].push(conn2.from);
        }
      }
    }

    // Find roots (nodes with no incoming edges)
    var roots = [];
    for (var cn2 in entries) {
      if (parents[cn2].length === 0) roots.push(cn2);
    }
    if (roots.length === 0) roots = [components[0].name];

    // BFS layer assignment
    var layers = {}, visited = {}, queue = [];
    for (var ri = 0; ri < roots.length; ri++) {
      layers[roots[ri]] = 0; visited[roots[ri]] = true; queue.push(roots[ri]);
    }
    while (queue.length > 0) {
      var node = queue.shift();
      var kids = children[node];
      for (var ki = 0; ki < kids.length; ki++) {
        var kid = kids[ki];
        var nl = (layers[node] || 0) + 1;
        if (!visited[kid]) { visited[kid] = true; layers[kid] = nl; queue.push(kid); }
        else if (nl > layers[kid]) { layers[kid] = nl; queue.push(kid); }
      }
    }
    for (var cn3 in entries) { if (layers[cn3] === undefined) layers[cn3] = 0; }

    // Gap accounts for connector labels AND port labels on both sides
    var maxLabelW = 0;
    for (var ci3 = 0; ci3 < connectors.length; ci3++) {
      if (connectors[ci3].label) {
        maxLabelW = Math.max(maxLabelW, textWidth(connectors[ci3].label, false, CFG.fontSize));
      }
    }
    var maxPortLabelW = 0;
    for (var en0 in entries) {
      var e0 = entries[en0];
      var allPorts0 = e0.leftPorts.concat(e0.rightPorts);
      for (var pi0 = 0; pi0 < allPorts0.length; pi0++) {
        maxPortLabelW = Math.max(maxPortLabelW, textWidth(allPorts0[pi0], false, CFG.fontSize - 1));
      }
    }
    var effectiveGapX = Math.max(CFG.gapX, maxLabelW + 40, maxPortLabelW * 2 + 24);

    // Group by layer and position
    var layerGroups = {}, maxLayer = 0;
    for (var cn4 in entries) {
      var l = layers[cn4];
      if (!layerGroups[l]) layerGroups[l] = [];
      layerGroups[l].push(cn4);
      maxLayer = Math.max(maxLayer, l);
    }

    // ── Sugiyama barycenter crossing minimization ──────────────────────
    // Sort nodes within each column by the average position of their
    // neighbours in the adjacent column, alternating forward/backward.
    var posInLayer = {};
    for (var bpl = 0; bpl <= maxLayer; bpl++) {
      var bpg = layerGroups[bpl]; if (!bpg) continue;
      for (var bpi = 0; bpi < bpg.length; bpi++) posInLayer[bpg[bpi]] = bpi;
    }
    for (var bcPass = 0; bcPass < 4; bcPass++) {
      if (bcPass % 2 === 0) {
        // Forward: sort column l by avg position of predecessors in column l-1
        for (var bcFl = 1; bcFl <= maxLayer; bcFl++) {
          var bcFg = layerGroups[bcFl]; if (!bcFg || bcFg.length < 2) continue;
          var bcF = {};
          for (var bcFi = 0; bcFi < bcFg.length; bcFi++) {
            var bcFn = bcFg[bcFi]; var bcSum = 0, bcCnt = 0;
            for (var bcCi = 0; bcCi < connectors.length; bcCi++) {
              var bcCn = connectors[bcCi];
              if (bcCn.to === bcFn && layers[bcCn.from] === bcFl - 1) {
                bcSum += posInLayer[bcCn.from]; bcCnt++;
              }
            }
            bcF[bcFn] = bcCnt > 0 ? bcSum / bcCnt : posInLayer[bcFn];
          }
          bcFg.sort(function (a, b) { return bcF[a] - bcF[b]; });
          for (var bcFi2 = 0; bcFi2 < bcFg.length; bcFi2++) posInLayer[bcFg[bcFi2]] = bcFi2;
        }
      } else {
        // Backward: sort column l by avg position of successors in column l+1
        for (var bcBl = maxLayer - 1; bcBl >= 0; bcBl--) {
          var bcBg = layerGroups[bcBl]; if (!bcBg || bcBg.length < 2) continue;
          var bcB = {};
          for (var bcBi = 0; bcBi < bcBg.length; bcBi++) {
            var bcBn = bcBg[bcBi]; var bcBSum = 0, bcBCnt = 0;
            for (var bcBCi = 0; bcBCi < connectors.length; bcBCi++) {
              var bcBCn = connectors[bcBCi];
              if (bcBCn.from === bcBn && layers[bcBCn.to] === bcBl + 1) {
                bcBSum += posInLayer[bcBCn.to]; bcBCnt++;
              }
            }
            bcB[bcBn] = bcBCnt > 0 ? bcBSum / bcBCnt : posInLayer[bcBn];
          }
          bcBg.sort(function (a, b) { return bcB[a] - bcB[b]; });
          for (var bcBi2 = 0; bcBi2 < bcBg.length; bcBi2++) posInLayer[bcBg[bcBi2]] = bcBi2;
        }
      }
    }

    // Horizontal layout: each layer is a column (left-to-right), items stack top-to-bottom within
    var curX = 0;
    for (var col = 0; col <= maxLayer; col++) {
      var group = layerGroups[col];
      if (!group) continue;
      var curY = 0;
      for (var gi = 0; gi < group.length; gi++) {
        entries[group[gi]].x = curX;
        entries[group[gi]].y = curY;
        curY += entries[group[gi]].box.height + CFG.gapY;
      }
      var maxW = 0;
      for (var gi2 = 0; gi2 < group.length; gi2++) maxW = Math.max(maxW, entries[group[gi2]].box.width);
      curX += maxW + effectiveGapX;
    }

    // Center each column vertically relative to the tallest column
    var maxColH = 0;
    for (var col2 = 0; col2 <= maxLayer; col2++) {
      var g = layerGroups[col2]; if (!g) continue;
      var lastE = entries[g[g.length - 1]];
      maxColH = Math.max(maxColH, lastE.y + lastE.box.height);
    }
    for (var col3 = 0; col3 <= maxLayer; col3++) {
      var g2 = layerGroups[col3]; if (!g2) continue;
      var lastE2 = entries[g2[g2.length - 1]];
      var colH = lastE2.y + lastE2.box.height;
      var off = (maxColH - colH) / 2;
      for (var gi3 = 0; gi3 < g2.length; gi3++) entries[g2[gi3]].y += off;
    }

    // Compute port positions (after x,y are finalized)
    var portHalf = CFG.portSize / 2;
    for (var en in entries) {
      var e = entries[en];
      var bx = e.x, by = e.y, bw = e.box.width, bh = e.box.height;

      // Left ports: distributed evenly along left edge, straddling the boundary
      for (var lpi2 = 0; lpi2 < e.leftPorts.length; lpi2++) {
        var lpn = e.leftPorts[lpi2];
        var pcy = by + bh * (lpi2 + 1) / (e.leftPorts.length + 1);
        e.portPositions[lpn] = {
          // Square top-left corner (straddles boundary)
          x: bx - portHalf, y: pcy - portHalf,
          // Center of the port square (on the boundary)
          cx: bx, cy: pcy,
          // Outer connector attachment point
          connX: bx - CFG.portSize, connY: pcy,
          side: 'left',
        };
      }

      // Right ports: distributed evenly along right edge, straddling the boundary
      for (var rpi2 = 0; rpi2 < e.rightPorts.length; rpi2++) {
        var rpn = e.rightPorts[rpi2];
        var pcy2 = by + bh * (rpi2 + 1) / (e.rightPorts.length + 1);
        e.portPositions[rpn] = {
          x: bx + bw - portHalf, y: pcy2 - portHalf,
          cx: bx + bw, cy: pcy2,
          connX: bx + bw + CFG.portSize, connY: pcy2,
          side: 'right',
        };
      }
    }

    // Bounding box: include port squares and port label text outside component
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    var portLabelFs = CFG.fontSize - 1;
    for (var en2 in entries) {
      var e2 = entries[en2];
      var maxLeftLW2 = 0;
      for (var lbpi = 0; lbpi < e2.leftPorts.length; lbpi++) {
        maxLeftLW2 = Math.max(maxLeftLW2, textWidth(e2.leftPorts[lbpi], false, portLabelFs));
      }
      var maxRightLW2 = 0;
      for (var rbpi = 0; rbpi < e2.rightPorts.length; rbpi++) {
        maxRightLW2 = Math.max(maxRightLW2, textWidth(e2.rightPorts[rbpi], false, portLabelFs));
      }
      // Port labels are now above the port, so extend bounds upward and
      // still account for port squares protruding to the sides
      var allPorts2 = e2.leftPorts.concat(e2.rightPorts);
      var maxPortLW2 = 0;
      for (var abpi = 0; abpi < allPorts2.length; abpi++) {
        maxPortLW2 = Math.max(maxPortLW2, textWidth(allPorts2[abpi], false, portLabelFs));
      }
      minX = Math.min(minX, e2.x - (e2.leftPorts.length > 0 ? CFG.portSize : 0));
      minY = Math.min(minY, e2.y);
      maxX = Math.max(maxX, e2.x + e2.box.width + (e2.rightPorts.length > 0 ? CFG.portSize : 0));
      maxY = Math.max(maxY, e2.y + e2.box.height + (allPorts2.length > 0 ? portLabelFs + 8 : 0));
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
    var connectors = parsed.connectors;
    var ox = layout.offsetX + CFG.svgPad;
    var oy = layout.offsetY + CFG.svgPad;
    var svgW = layout.width + CFG.svgPad * 2;
    var svgH = layout.height + CFG.svgPad * 2;

    var svg = [];
    svg.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + svgW + '" height="' + svgH + '" ');
    svg.push('viewBox="0 0 ' + svgW + ' ' + svgH + '" ');
    svg.push('style="font-family: ' + CFG.fontFamily + '; max-width: none;">');
    svg.push('<g transform="translate(' + ox + ',' + oy + ')">');

    // ── Draw connectors ──
    for (var ci = 0; ci < connectors.length; ci++) {
      var conn = connectors[ci];
      var fromE = entries[conn.from];
      var toE = entries[conn.to];
      if (!fromE || !toE) continue;

      var isDash = conn.type === 'dependency';
      var dAttr = isDash ? ' stroke-dasharray="8,4"' : '';

      // Start point: port outer attachment or component boundary
      var x1, y1, x2, y2;
      if (conn.fromPort && fromE.portPositions[conn.fromPort]) {
        var fp = fromE.portPositions[conn.fromPort];
        x1 = fp.connX; y1 = fp.connY;
      } else {
        var fcx = fromE.x + fromE.box.width / 2;
        var fcy = fromE.y + fromE.box.height / 2;
        var tcx = toE.x + toE.box.width / 2;
        var tcy = toE.y + toE.box.height / 2;
        var dx = tcx - fcx, dy = tcy - fcy;
        if (Math.abs(dx) > Math.abs(dy) * 0.5) {
          x1 = dx > 0 ? fromE.x + fromE.box.width : fromE.x;
          y1 = fcy;
        } else {
          x1 = fcx;
          y1 = dy > 0 ? fromE.y + fromE.box.height : fromE.y;
        }
      }

      // End point: port outer attachment or component boundary
      if (conn.toPort && toE.portPositions[conn.toPort]) {
        var tp = toE.portPositions[conn.toPort];
        x2 = tp.connX; y2 = tp.connY;
      } else {
        var fcx2 = fromE.x + fromE.box.width / 2;
        var fcy2 = fromE.y + fromE.box.height / 2;
        var tcx2 = toE.x + toE.box.width / 2;
        var tcy2 = toE.y + toE.box.height / 2;
        var dx2 = tcx2 - fcx2, dy2 = tcy2 - fcy2;
        if (Math.abs(dx2) > Math.abs(dy2) * 0.5) {
          x2 = dx2 > 0 ? toE.x : toE.x + toE.box.width;
          y2 = tcy2;
        } else {
          x2 = tcx2;
          y2 = dy2 > 0 ? toE.y : toE.y + toE.box.height;
        }
      }

      // Orthogonal route: horizontal Z-shape matches left-to-right layout
      var points;
      if (Math.abs(x1 - x2) < 2 || Math.abs(y1 - y2) < 2) {
        points = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
      } else {
        var midX = (x1 + x2) / 2;
        points = [{ x: x1, y: y1 }, { x: midX, y: y1 }, { x: midX, y: y2 }, { x: x2, y: y2 }];
      }

      var pStr = '';
      for (var pi = 0; pi < points.length; pi++) {
        if (pi > 0) pStr += ' ';
        pStr += points[pi].x + ',' + points[pi].y;
      }
      svg.push('<polyline points="' + pStr +
        '" fill="none" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"' + dAttr + '/>');

      // Arrowhead at destination
      if (conn.type !== 'link') {
        var pLast = points[points.length - 1], pPrev = points[points.length - 2];
        var adx = pLast.x - pPrev.x, ady = pLast.y - pPrev.y;
        var alen = Math.sqrt(adx * adx + ady * ady);
        if (alen > 0) { adx /= alen; ady /= alen; }
        var as = CFG.arrowSize, hw = as * 0.35;
        var px = -ady, py = adx;
        if (conn.type === 'dependency') {
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
            '" fill="' + colors.line + '" stroke="none"/>');
        }
      }

      // Connector label
      if (conn.label) {
        var lx, ly, lAnchor;
        if (points.length === 4) {
          // Z-route: label above the last horizontal segment (approaching the
          // destination), well clear of both the vertical bend line and any
          // port labels near the endpoints.
          var hSeg0 = points[2], hSeg1 = points[3];
          lx = (hSeg0.x + hSeg1.x) / 2;
          ly = hSeg0.y - 10;
          lAnchor = 'middle';
        } else {
          // Direct line: label above the midpoint with enough clearance
          lx = (points[0].x + points[1].x) / 2;
          ly = (points[0].y + points[1].y) / 2 - 12;
          lAnchor = 'middle';
        }
        var lw = textWidth(conn.label, false, CFG.fontSize);
        var bgX = lAnchor === 'middle' ? lx - lw / 2 - CFG.labelBgPad : lx - CFG.labelBgPad;
        svg.push('<rect x="' + bgX + '" y="' + (ly - 12) +
          '" width="' + (lw + CFG.labelBgPad * 2) + '" height="16" fill="' + colors.fill + '" opacity="0.9"/>');
        svg.push('<text x="' + lx + '" y="' + ly +
          '" text-anchor="' + lAnchor + '" font-size="' + CFG.fontSize + '" fill="' + colors.text + '" font-style="italic">' +
          escapeXml(conn.label) + '</text>');
      }
    }

    // ── Draw component boxes ──
    for (var en in entries) {
      var e = entries[en];
      var bx = e.x, by = e.y, bw = e.box.width, bh = e.box.height;

      // Main rectangle
      svg.push('<rect x="' + bx + '" y="' + by + '" width="' + bw + '" height="' + bh +
        '" fill="' + colors.headerFill + '" stroke="' + colors.stroke + '" stroke-width="' + CFG.strokeWidth + '"/>');

      // Component icon (top-right): small rectangle with two tabs
      var ix = bx + bw - CFG.iconW - 8;
      var iy = by + 6;
      svg.push('<rect x="' + ix + '" y="' + iy + '" width="' + CFG.iconW + '" height="' + CFG.iconH +
        '" fill="' + colors.fill + '" stroke="' + colors.stroke + '" stroke-width="1"/>');
      svg.push('<rect x="' + (ix - CFG.iconTabW / 2) + '" y="' + (iy + 2) + '" width="' + CFG.iconTabW + '" height="' + CFG.iconTabH +
        '" fill="' + colors.fill + '" stroke="' + colors.stroke + '" stroke-width="1"/>');
      svg.push('<rect x="' + (ix - CFG.iconTabW / 2) + '" y="' + (iy + CFG.iconH - CFG.iconTabH - 2) + '" width="' + CFG.iconTabW + '" height="' + CFG.iconTabH +
        '" fill="' + colors.fill + '" stroke="' + colors.stroke + '" stroke-width="1"/>');

      // Component name (centered, left of icon)
      svg.push('<text x="' + (bx + (bw - CFG.iconW - 8) / 2) + '" y="' + (by + bh / 2 + CFG.fontSize * 0.35) +
        '" text-anchor="middle" font-weight="bold" font-size="' + CFG.fontSizeBold + '" fill="' + colors.text + '">' +
        escapeXml(e.comp.name) + '</text>');

      // ── Draw port squares and labels ──
      var portHalf = CFG.portSize / 2;
      for (var pname in e.portPositions) {
        var pp = e.portPositions[pname];

        // Port square straddling the component boundary
        svg.push('<rect x="' + pp.x + '" y="' + pp.y +
          '" width="' + CFG.portSize + '" height="' + CFG.portSize +
          '" fill="' + colors.fill + '" stroke="' + colors.stroke +
          '" stroke-width="' + CFG.strokeWidth + '"/>');

        // Port label below the port square (connection labels go above)
        svg.push('<text x="' + pp.cx + '" y="' + (pp.cy + portHalf + (CFG.fontSize - 1) + 1) +
          '" text-anchor="middle" font-size="' + (CFG.fontSize - 1) + '"' +
          ' font-style="italic" fill="' + colors.text + '">' + escapeXml(pname) + '</text>');
      }
    }

    svg.push('</g>');
    svg.push('</svg>');
    return svg.join('\n');
  }

  // ─── Public API ───────────────────────────────────────────────────

  function render(container, text) {
    var parsed = parse(text);
    if (!parsed.components || parsed.components.length === 0) {
      container.innerHTML = '<div style="padding:20px;color:#888;text-align:center;">No components to display.</div>';
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
    var blocks = document.querySelectorAll('pre > code.language-uml-component');
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

  window.UMLComponentDiagram = { render: render, parse: parse };
})();
