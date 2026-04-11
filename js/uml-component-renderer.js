/**
 * UML Component Diagram Renderer
 *
 * Text format:
 *   @startuml
 *   component Client
 *   component Backend {
 *     portin "httpIn" as b_in
 *     portout "dbOut" as b_dbout
 *   }
 *
 *   Client --> b_in : REST
 *   b_dbout --> db_in : SQL
 *   Client ..> Logger : uses
 *   @enduml
 *
 * Notation:
 *   component Name               Component box (no ports)
 *   component Name {             Component with directional ports
 *     portin "name" as alias     Incoming port placed on the left edge
 *     portout "name" as alias    Outgoing port placed on the right edge
 *   }
 *   A --> B : label              Assembly connector (solid arrow)
 *   alias --> alias : label      Connector via port aliases (squares on boundary)
 *   A ..> B : label              Dependency (dashed arrow)
 *   A -- B : label               Plain link
 */
(function () {
  'use strict';

  var CFG = {
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    fontSize: 14,
    fontSizeBold: 15,
    lineHeight: 22,
    padX: 24,
    padY: 14,
    compMinW: 130,
    compMinH: 50,
    iconW: 20,
    iconH: 14,
    iconTabW: 8,
    iconTabH: 4,
    gapX: 60,
    gapY: 50,
    arrowSize: 10,
    strokeWidth: 1.5,
    svgPad: 30,
    portSize: 10,   // port square side length (straddles boundary, half in/half out)
    portPad: 22,    // min vertical pitch between ports
    labelBgPad: 4,
  };

  // ─── Parser ───────────────────────────────────────────────────────

  // Parse a single port line: (portin|portout|port) ["name"] [as alias]
  // Returns { name, alias, direction } or null.
  function parsePortLine(line) {
    var m = line.match(/^(portin|portout|port)\s+"([^"]+)"(?:\s+as\s+(\S+))?/) ||
            line.match(/^(portin|portout|port)\s+(\S+?)(?:\s+as\s+(\S+))?$/);
    if (!m) return null;
    var kw = m[1], displayName = m[2], alias = m[3] || displayName;
    var direction = kw === 'portin' ? 'in' : (kw === 'portout' ? 'out' : null);
    return { name: displayName, alias: alias, direction: direction };
  }

  function parse(text) {
    var lines = text.split('\n');
    var components = [];
    var componentMap = {};
    var connectors = [];
    var portAliasMap = {}; // alias → { comp: componentName, name: displayName }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line === '@startuml' || line === '@enduml') continue;

      // Component declaration with optional port block
      var compMatch = line.match(/^component\s+(\S+)(?:\s*\{)?/);
      if (compMatch) {
        var cName = compMatch[1];
        var ports = []; // { name, alias, direction }

        if (line.indexOf('{') !== -1) {
          if (line.indexOf('}') !== -1) {
            // Inline: component Foo { portout "p1" as a1 portin "p2" as a2 }
            var inlineBody = line.match(/\{([^}]*)\}/);
            if (inlineBody) {
              var portRe = /(portin|portout|port)\s+(?:"([^"]+)"|(\w+))(?:\s+as\s+(\w+))?/g;
              var pm;
              while ((pm = portRe.exec(inlineBody[1])) !== null) {
                var kw = pm[1], displayName = pm[2] || pm[3], alias = pm[4] || displayName;
                var direction = kw === 'portin' ? 'in' : (kw === 'portout' ? 'out' : null);
                var portEntry = { name: displayName, alias: alias, direction: direction };
                ports.push(portEntry);
                portAliasMap[alias] = { comp: cName, name: displayName };
              }
            }
          } else {
            // Multi-line block: read until }
            for (i++; i < lines.length; i++) {
              var pline = lines[i].trim();
              if (pline === '}') break;
              var portLine = parsePortLine(pline);
              if (portLine) {
                ports.push(portLine);
                portAliasMap[portLine.alias] = { comp: cName, name: portLine.name };
              }
            }
          }
        }

        if (!componentMap.hasOwnProperty(cName)) {
          componentMap[cName] = components.length;
          components.push({ name: cName, ports: ports });
        }
        continue;
      }

      // Connector: alias --> alias  or  Comp.port --> Comp.port  or  Comp --> Comp
      var connMatch = line.match(/^(\S+)\s+(-->|\.\.>|--)\s+(\S+)\s*(?::\s*(.*))?$/);
      if (connMatch) {
        var fromToken = connMatch[1], arrow = connMatch[2], toToken = connMatch[3];
        var label = (connMatch[4] || '').trim();

        // Resolve from: alias map → dot notation → bare component
        var from, fromPort = null;
        if (portAliasMap.hasOwnProperty(fromToken)) {
          from = portAliasMap[fromToken].comp;
          fromPort = fromToken;
        } else {
          var fromParts = fromToken.split('.');
          from = fromParts[0];
          fromPort = fromParts[1] || null;
        }

        // Resolve to: alias map → dot notation → bare component
        var to, toPort = null;
        if (portAliasMap.hasOwnProperty(toToken)) {
          to = portAliasMap[toToken].comp;
          toPort = toToken;
        } else {
          var toParts = toToken.split('.');
          to = toParts[0];
          toPort = toParts[1] || null;
        }

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

  // ─── Layout ───────────────────────────────────────────────────────

  function computeLayout(parsed) {
    var components = parsed.components;
    var connectors = parsed.connectors;
    if (components.length === 0) return { entries: {}, width: 0, height: 0, offsetX: 0, offsetY: 0 };

    // Fallback port sides for `port` keyword (no explicit direction) — inferred from connection usage
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

      // Assign ports to sides: portin → left, portout → right, port → infer from connections
      var leftPorts = [], rightPorts = [];
      for (var pi = 0; pi < c.ports.length; pi++) {
        var port = c.ports[pi];
        var alias = port.alias;
        if (port.direction === 'in') {
          leftPorts.push(alias);
        } else if (port.direction === 'out') {
          rightPorts.push(alias);
        } else {
          var side = portSides[c.name + '.' + alias] || 'right';
          if (side === 'left') leftPorts.push(alias);
          else rightPorts.push(alias);
        }
      }

      // Component width only needs to fit name + icon; port labels render outside
      var nameW = UMLShared.textWidth(c.name, true, CFG.fontSizeBold);
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

    // Gap accounts for connector labels (port labels are below, not in the gap)
    var maxLabelW = 0;
    for (var ci3 = 0; ci3 < connectors.length; ci3++) {
      if (connectors[ci3].label) {
        maxLabelW = Math.max(maxLabelW, UMLShared.textWidth(connectors[ci3].label, false, CFG.fontSize));
      }
    }
    var effectiveGapX = Math.max(CFG.gapX, maxLabelW + 30);

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

      // Build alias → display label map for this component's ports
      var portLabelByAlias = {};
      for (var pni = 0; pni < e.comp.ports.length; pni++) {
        var p = e.comp.ports[pni];
        portLabelByAlias[p.alias] = p.name;
      }

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
          connX: bx - portHalf, connY: pcy,
          side: 'left',
          label: portLabelByAlias[lpn] !== undefined ? portLabelByAlias[lpn] : lpn,
        };
      }

      // Right ports: distributed evenly along right edge, straddling the boundary
      for (var rpi2 = 0; rpi2 < e.rightPorts.length; rpi2++) {
        var rpn = e.rightPorts[rpi2];
        var pcy2 = by + bh * (rpi2 + 1) / (e.rightPorts.length + 1);
        e.portPositions[rpn] = {
          x: bx + bw - portHalf, y: pcy2 - portHalf,
          cx: bx + bw, cy: pcy2,
          connX: bx + bw + portHalf, connY: pcy2,
          side: 'right',
          label: portLabelByAlias[rpn] !== undefined ? portLabelByAlias[rpn] : rpn,
        };
      }
    }

    // Bounding box: port squares protrude to the sides, labels extend below
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    var portLabelFs = CFG.fontSize - 1;
    for (var en2 in entries) {
      var e2 = entries[en2];
      var hasPorts = e2.leftPorts.length > 0 || e2.rightPorts.length > 0;
      minX = Math.min(minX, e2.x - (e2.leftPorts.length > 0 ? CFG.portSize : 0));
      minY = Math.min(minY, e2.y);
      maxX = Math.max(maxX, e2.x + e2.box.width + (e2.rightPorts.length > 0 ? CFG.portSize : 0));
      maxY = Math.max(maxY, e2.y + e2.box.height + (hasPorts ? portLabelFs + 8 : 0));
    }

    return { entries: entries, width: maxX - minX, height: maxY - minY, offsetX: -minX, offsetY: -minY };
  }

  // ─── SVG Renderer ─────────────────────────────────────────────────

  function generateSVG(layout, parsed, colors) {
    var entries = layout.entries;
    var connectors = parsed.connectors;
    var ox = layout.offsetX + CFG.svgPad;
    var oy = layout.offsetY + CFG.svgPad;
    var svgW = layout.width + CFG.svgPad * 2;
    var svgH = layout.height + CFG.svgPad * 2;

    var svg = [];
    svg.push(UMLShared.svgOpen(svgW, svgH, ox, oy, CFG.fontFamily));
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
        svg.push('<text x="' + lx + '" y="' + ly +
          '" text-anchor="' + lAnchor + '" font-size="' + CFG.fontSize + '" fill="' + colors.text +
          '" stroke="' + colors.fill + '" stroke-width="4" stroke-linejoin="round" paint-order="stroke" font-style="italic">' +
          UMLShared.escapeXml(conn.label) + '</text>');
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
        UMLShared.escapeXml(e.comp.name) + '</text>');

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
          ' font-style="italic" fill="' + colors.text + '">' +
          UMLShared.escapeXml(pp.label !== undefined ? pp.label : pname) + '</text>');
      }
    }

    svg.push(UMLShared.svgClose());
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
    var colors = UMLShared.getThemeColors(container);
    var layout = computeLayout(parsed);
    container.innerHTML = generateSVG(layout, parsed, colors);
  }

  // ─── Auto-init ────────────────────────────────────────────────────

  UMLShared.createAutoInit('pre > code.language-uml-component', render);

  window.UMLComponentDiagram = { render: render, parse: parse };
})();
