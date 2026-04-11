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
    var layoutNodes = [];
    var layoutEdges = [];

    for (var i = 0; i < components.length; i++) {
      var c = components[i];
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

      var nameW = UMLShared.textWidth(c.name, true, CFG.fontSizeBold);
      var w = Math.max(CFG.compMinW, nameW + CFG.padX * 2 + CFG.iconW);
      var maxSidePorts = Math.max(leftPorts.length, rightPorts.length);
      var h = maxSidePorts > 0 ? Math.max(CFG.compMinH, maxSidePorts * CFG.portPad + CFG.portPad) : CFG.compMinH;

      entries[c.name] = {
        comp: c,
        box: { width: Math.ceil(w), height: h },
        x: 0, y: 0,
        leftPorts: leftPorts,
        rightPorts: rightPorts,
        portPositions: {},
      };
      layoutNodes.push({ id: c.name, width: Math.ceil(w), height: h, data: c });
    }

    for (var ci = 0; ci < connectors.length; ci++) {
      var conn = connectors[ci];
      layoutEdges.push({ source: conn.from, target: conn.to, type: conn.type, data: conn });
    }

    var maxLabelW = 0;
    for (var ci3 = 0; ci3 < connectors.length; ci3++) {
      if (connectors[ci3].label) {
        maxLabelW = Math.max(maxLabelW, UMLShared.textWidth(connectors[ci3].label, false, CFG.fontSize));
      }
    }
    var effectiveGapX = Math.max(CFG.gapX, maxLabelW + 30);

    var result = window.UMLAdvancedLayout.compute(layoutNodes, layoutEdges, { gapX: effectiveGapX, gapY: CFG.gapY });

    for (var n in result.nodes) {
      if (!entries[n]) continue;
      entries[n].x = result.nodes[n].x;
      entries[n].y = result.nodes[n].y;
    }

    // Compute port positions (after x,y are finalized)
    var portHalf = CFG.portSize / 2;
    for (var en in entries) {
      var e = entries[en];
      var bx = e.x, by = e.y, bw = e.box.width, bh = e.box.height;

      var portLabelByAlias = {};
      for (var pni = 0; pni < e.comp.ports.length; pni++) {
        var p = e.comp.ports[pni];
        portLabelByAlias[p.alias] = p.name;
      }

      for (var lpi2 = 0; lpi2 < e.leftPorts.length; lpi2++) {
        var lpn = e.leftPorts[lpi2];
        var pcy = by + bh * (lpi2 + 1) / (e.leftPorts.length + 1);
        e.portPositions[lpn] = {
          x: bx - portHalf, y: pcy - portHalf,
          cx: bx, cy: pcy,
          connX: bx - portHalf, connY: pcy,
          side: 'left',
          label: portLabelByAlias[lpn] !== undefined ? portLabelByAlias[lpn] : lpn,
        };
      }

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

    return { 
      entries: entries, 
      width: maxX - minX, 
      height: maxY - minY, 
      offsetX: -minX, 
      offsetY: -minY,
      layoutResult: result
    };
  }

  // ─── Obstacle-aware orthogonal routing helpers ─────────────────────

  // Check if vertical segment at x spanning [yMin,yMax] intersects any obstacle rect
  function vSegHitsBox(x, yMin, yMax, obstacles) {
    for (var i = 0; i < obstacles.length; i++) {
      var ob = obstacles[i];
      if (x > ob.x1 && x < ob.x2 && yMax > ob.y1 && yMin < ob.y2) return true;
    }
    return false;
  }

  // Check if horizontal segment at y spanning [xMin,xMax] intersects any obstacle rect
  function hSegHitsBox(y, xMin, xMax, obstacles) {
    for (var i = 0; i < obstacles.length; i++) {
      var ob = obstacles[i];
      if (y > ob.y1 && y < ob.y2 && xMax > ob.x1 && xMin < ob.x2) return true;
    }
    return false;
  }

  // Find nearest clear X for a vertical segment in [yMin,yMax]
  function findClearX(yMin, yMax, preferX, obstacles) {
    if (!vSegHitsBox(preferX, yMin, yMax, obstacles)) return preferX;
    for (var d = 10; d < 600; d += 10) {
      if (!vSegHitsBox(preferX + d, yMin, yMax, obstacles)) return preferX + d;
      if (!vSegHitsBox(preferX - d, yMin, yMax, obstacles)) return preferX - d;
    }
    return preferX;
  }

  // Find nearest clear Y for a horizontal segment in [xMin,xMax]
  function findClearY(xMin, xMax, preferY, obstacles) {
    if (!hSegHitsBox(preferY, xMin, xMax, obstacles)) return preferY;
    for (var d = 10; d < 600; d += 10) {
      if (!hSegHitsBox(preferY + d, xMin, xMax, obstacles)) return preferY + d;
      if (!hSegHitsBox(preferY - d, xMin, xMax, obstacles)) return preferY - d;
    }
    return preferY;
  }

  // Remove redundant collinear points from a route
  function simplifyRoute(pts) {
    if (pts.length <= 2) return pts;
    var out = [pts[0]];
    for (var i = 1; i < pts.length - 1; i++) {
      var prev = out[out.length - 1], cur = pts[i], next = pts[i + 1];
      // Skip if collinear (same x or same y as both neighbours)
      var sameX = Math.abs(prev.x - cur.x) < 1 && Math.abs(cur.x - next.x) < 1;
      var sameY = Math.abs(prev.y - cur.y) < 1 && Math.abs(cur.y - next.y) < 1;
      if (!sameX && !sameY) out.push(cur);
      else if (!sameX && !sameY) out.push(cur);
      else { /* skip collinear */ }
    }
    out.push(pts[pts.length - 1]);
    return out;
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
    // Collect all component bounding boxes as obstacles (with padding)
    var obstaclePad = 8;
    var obstacles = [];
    for (var obn in entries) {
      var obe = entries[obn];
      obstacles.push({
        x1: obe.x - obstaclePad,
        y1: obe.y - obstaclePad,
        x2: obe.x + obe.box.width + obstaclePad,
        y2: obe.y + obe.box.height + obstaclePad,
        name: obn
      });
    }

    // ── Draw connectors ──
    for (var ci = 0; ci < connectors.length; ci++) {
      var conn = connectors[ci];
      var fromE = entries[conn.from];
      var toE = entries[conn.to];
      if (!fromE || !toE) continue;

      var isDash = conn.type === 'dependency';
      var dAttr = isDash ? ' stroke-dasharray="8,4"' : '';

      // Start point and exit direction
      var x1, y1, dir1;
      if (conn.fromPort && fromE.portPositions[conn.fromPort]) {
        var fp = fromE.portPositions[conn.fromPort];
        x1 = fp.connX; y1 = fp.connY;
        dir1 = fp.side; // 'left' or 'right'
      } else {
        var fcx = fromE.x + fromE.box.width / 2;
        var fcy = fromE.y + fromE.box.height / 2;
        var tcx = toE.x + toE.box.width / 2;
        var tcy = toE.y + toE.box.height / 2;
        var dx = tcx - fcx, dy = tcy - fcy;
        if (Math.abs(dx) > Math.abs(dy) * 0.5) {
          x1 = dx > 0 ? fromE.x + fromE.box.width : fromE.x;
          y1 = fcy;
          dir1 = dx > 0 ? 'right' : 'left';
        } else {
          x1 = fcx;
          y1 = dy > 0 ? fromE.y + fromE.box.height : fromE.y;
          dir1 = dy > 0 ? 'bottom' : 'top';
        }
      }

      // End point and entry direction
      var x2, y2, dir2;
      if (conn.toPort && toE.portPositions[conn.toPort]) {
        var tp = toE.portPositions[conn.toPort];
        x2 = tp.connX; y2 = tp.connY;
        dir2 = tp.side; // 'left' or 'right'
      } else {
        var fcx2 = fromE.x + fromE.box.width / 2;
        var fcy2 = fromE.y + fromE.box.height / 2;
        var tcx2 = toE.x + toE.box.width / 2;
        var tcy2 = toE.y + toE.box.height / 2;
        var dx2 = tcx2 - fcx2, dy2 = tcy2 - fcy2;
        if (Math.abs(dx2) > Math.abs(dy2) * 0.5) {
          x2 = dx2 > 0 ? toE.x : toE.x + toE.box.width;
          y2 = tcy2;
          dir2 = dx2 > 0 ? 'right' : 'left';
        } else {
          x2 = tcx2;
          y2 = dy2 > 0 ? toE.y : toE.y + toE.box.height;
          dir2 = dy2 > 0 ? 'bottom' : 'top';
        }
      }

      // Obstacle-aware orthogonal routing
      var margin = 15;
      var isHorz1 = (dir1 === 'left' || dir1 === 'right');
      var isHorz2 = (dir2 === 'left' || dir2 === 'right');

      // Extension points: move away from component boundary in the exit/entry direction
      var ex1 = x1 + (dir1 === 'right' ? margin : dir1 === 'left' ? -margin : 0);
      var ey1 = y1 + (dir1 === 'bottom' ? margin : dir1 === 'top' ? -margin : 0);
      var ex2 = x2 + (dir2 === 'right' ? margin : dir2 === 'left' ? -margin : 0);
      var ey2 = y2 + (dir2 === 'bottom' ? margin : dir2 === 'top' ? -margin : 0);

      var points;
      if (Math.abs(x1 - x2) < 2 && Math.abs(y1 - y2) < 2) {
        points = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
      } else if (Math.abs(x1 - x2) < 2 || Math.abs(y1 - y2) < 2) {
        // Nearly aligned: direct line
        points = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
      } else if (isHorz1 && isHorz2) {
        // Both horizontal exits (e.g. right port → left port)
        var yMin = Math.min(ey1, ey2), yMax = Math.max(ey1, ey2);
        var preferX = (ex1 + ex2) / 2;
        var clearX = findClearX(yMin, yMax, preferX, obstacles);
        points = [
          { x: x1, y: y1 }, { x: ex1, y: y1 },
          { x: clearX, y: y1 }, { x: clearX, y: y2 },
          { x: ex2, y: y2 }, { x: x2, y: y2 }
        ];
      } else if (!isHorz1 && !isHorz2) {
        // Both vertical exits (e.g. bottom → top)
        var xMin = Math.min(ex1, ex2), xMax = Math.max(ex1, ex2);
        var preferY = (ey1 + ey2) / 2;
        var clearY = findClearY(xMin, xMax, preferY, obstacles);
        points = [
          { x: x1, y: y1 }, { x: x1, y: ey1 },
          { x: x1, y: clearY }, { x: x2, y: clearY },
          { x: x2, y: ey2 }, { x: x2, y: y2 }
        ];
      } else {
        // Mixed: one horizontal, one vertical — L-shape
        if (isHorz1) {
          // Horizontal exit, vertical entry: go horizontal then vertical
          points = [
            { x: x1, y: y1 }, { x: ex1, y: y1 },
            { x: x2, y: y1 }, { x: x2, y: y2 }
          ];
        } else {
          // Vertical exit, horizontal entry: go vertical then horizontal
          points = [
            { x: x1, y: y1 }, { x: x1, y: ey1 },
            { x: x1, y: y2 }, { x: x2, y: y2 }
          ];
        }
      }

      // Simplify collinear points
      points = simplifyRoute(points);

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
          // Z-route: label above the *first* horizontal segment (approaching from the
          // source), well clear of both the vertical bend line and any
          // destination port labels.
          var hSeg0 = points[0], hSeg1 = points[1];
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
