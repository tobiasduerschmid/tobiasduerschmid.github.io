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
    portPad: 34,    // min vertical pitch between ports (must fit port square + label text)
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

      // Widen component to fit port labels (centered on boundary, so half extends inward)
      var portLabelFs = CFG.fontSize - 1;
      for (var pli = 0; pli < c.ports.length; pli++) {
        var plw = UMLShared.textWidth(c.ports[pli].name, false, portLabelFs);
        w = Math.max(w, plw + CFG.padX * 2);
      }

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
    // Account for port labels extending past the component boundary
    var maxPortOverhang = 0;
    for (var ci4 = 0; ci4 < components.length; ci4++) {
      for (var pi4 = 0; pi4 < components[ci4].ports.length; pi4++) {
        var plw2 = UMLShared.textWidth(components[ci4].ports[pi4].name, false, CFG.fontSize - 1);
        var overhang = plw2 / 2 - entries[components[ci4].name].box.width / 2;
        if (overhang > maxPortOverhang) maxPortOverhang = overhang;
      }
    }
    var effectiveGapX = Math.max(CFG.gapX, maxLabelW + 30, maxPortOverhang * 2 + 20);

    // Component diagrams use left-to-right layout (ports flow right→left).
    // The layout engine is top-to-bottom, so swap dimensions before layout
    // and swap coordinates back after to achieve LR orientation.
    for (var swi = 0; swi < layoutNodes.length; swi++) {
      var tmpDim = layoutNodes[swi].width;
      layoutNodes[swi].width = layoutNodes[swi].height;
      layoutNodes[swi].height = tmpDim;
    }

    var result = window.UMLAdvancedLayout.compute(layoutNodes, layoutEdges, { gapX: CFG.gapY, gapY: effectiveGapX });

    for (var n in result.nodes) {
      if (!entries[n]) continue;
      // Swap X↔Y back to convert TB→LR
      entries[n].x = result.nodes[n].y;
      entries[n].y = result.nodes[n].x;
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
    var portLabelFs2 = CFG.fontSize - 1;
    for (var en2 in entries) {
      var e2 = entries[en2];
      var hasPorts = e2.leftPorts.length > 0 || e2.rightPorts.length > 0;
      // Account for port labels extending past component boundaries
      var leftOverhang = e2.leftPorts.length > 0 ? CFG.portSize : 0;
      var rightOverhang = e2.rightPorts.length > 0 ? CFG.portSize : 0;
      for (var pn2 in e2.portPositions) {
        var pp2 = e2.portPositions[pn2];
        var plw3 = UMLShared.textWidth(pp2.label || pn2, false, portLabelFs2) / 2;
        if (pp2.side === 'left') {
          leftOverhang = Math.max(leftOverhang, plw3 - e2.box.width / 2 + CFG.portSize);
        } else {
          rightOverhang = Math.max(rightOverhang, plw3 - e2.box.width / 2 + CFG.portSize);
        }
      }
      minX = Math.min(minX, e2.x - leftOverhang);
      minY = Math.min(minY, e2.y);
      maxX = Math.max(maxX, e2.x + e2.box.width + rightOverhang);
      maxY = Math.max(maxY, e2.y + e2.box.height + (hasPorts ? portLabelFs2 + 8 : 0));
    }

    // Add extra space for connector labels that may extend past rightmost/bottom components
    var maxLabelExtra = 0;
    for (var cli = 0; cli < connectors.length; cli++) {
      if (connectors[cli].label) {
        maxLabelExtra = Math.max(maxLabelExtra, UMLShared.textWidth(connectors[cli].label, false, CFG.fontSize) + 20);
      }
    }

    return {
      entries: entries,
      width: maxX - minX + maxLabelExtra,
      height: maxY - minY,
      offsetX: -minX,
      offsetY: -minY,
      layoutResult: result
    };
  }

  // ─── Obstacle-aware orthogonal routing helpers ─────────────────────

  // Check if a route (array of {x,y} points forming orthogonal segments)
  // intersects any obstacle rect, skipping obstacles named in skipNames.
  function routeHitsObstacle(points, obstacles, skipNames) {
    for (var i = 0; i < points.length - 1; i++) {
      var p0 = points[i], p1 = points[i + 1];
      if (Math.abs(p0.x - p1.x) < 1) {
        // Vertical segment
        var yMin = Math.min(p0.y, p1.y), yMax = Math.max(p0.y, p1.y);
        for (var j = 0; j < obstacles.length; j++) {
          var ob = obstacles[j];
          if (skipNames && skipNames[ob.name]) continue;
          if (p0.x > ob.x1 && p0.x < ob.x2 && yMax > ob.y1 && yMin < ob.y2) return true;
        }
      } else {
        // Horizontal segment
        var xMin = Math.min(p0.x, p1.x), xMax = Math.max(p0.x, p1.x);
        for (var j2 = 0; j2 < obstacles.length; j2++) {
          var ob2 = obstacles[j2];
          if (skipNames && skipNames[ob2.name]) continue;
          if (p0.y > ob2.y1 && p0.y < ob2.y2 && xMax > ob2.x1 && xMin < ob2.x2) return true;
        }
      }
    }
    return false;
  }

  // Find nearest clear X for a vertical segment in [yMin,yMax]
  function findClearX(yMin, yMax, preferX, obstacles, skipNames) {
    for (var j = 0; j < obstacles.length; j++) {
      var ob = obstacles[j];
      if (skipNames && skipNames[ob.name]) continue;
      if (preferX > ob.x1 && preferX < ob.x2 && yMax > ob.y1 && yMin < ob.y2) {
        // Hit — search outward
        for (var d = 10; d < 800; d += 10) {
          var tryR = preferX + d, tryL = preferX - d;
          var hitR = false, hitL = false;
          for (var k = 0; k < obstacles.length; k++) {
            if (skipNames && skipNames[obstacles[k].name]) continue;
            var o = obstacles[k];
            if (tryR > o.x1 && tryR < o.x2 && yMax > o.y1 && yMin < o.y2) hitR = true;
            if (tryL > o.x1 && tryL < o.x2 && yMax > o.y1 && yMin < o.y2) hitL = true;
          }
          if (!hitR) return tryR;
          if (!hitL) return tryL;
        }
      }
    }
    return preferX;
  }

  // Find nearest clear Y for a horizontal segment in [xMin,xMax]
  function findClearY(xMin, xMax, preferY, obstacles, skipNames) {
    for (var j = 0; j < obstacles.length; j++) {
      var ob = obstacles[j];
      if (skipNames && skipNames[ob.name]) continue;
      if (preferY > ob.y1 && preferY < ob.y2 && xMax > ob.x1 && xMin < ob.x2) {
        for (var d = 10; d < 800; d += 10) {
          var tryD = preferY + d, tryU = preferY - d;
          var hitD = false, hitU = false;
          for (var k = 0; k < obstacles.length; k++) {
            if (skipNames && skipNames[obstacles[k].name]) continue;
            var o = obstacles[k];
            if (tryD > o.y1 && tryD < o.y2 && xMax > o.x1 && xMin < o.x2) hitD = true;
            if (tryU > o.y1 && tryU < o.y2 && xMax > o.x1 && xMin < o.x2) hitU = true;
          }
          if (!hitD) return tryD;
          if (!hitU) return tryU;
        }
      }
    }
    return preferY;
  }

  // Remove redundant collinear points from a route
  function simplifyRoute(pts) {
    if (pts.length <= 2) return pts;
    var out = [pts[0]];
    for (var i = 1; i < pts.length - 1; i++) {
      var prev = out[out.length - 1], cur = pts[i], next = pts[i + 1];
      var sameX = Math.abs(prev.x - cur.x) < 1 && Math.abs(cur.x - next.x) < 1;
      var sameY = Math.abs(prev.y - cur.y) < 1 && Math.abs(cur.y - next.y) < 1;
      if (!sameX && !sameY) out.push(cur);
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
      // For LR layout, strongly prefer horizontal exits (right/left) over vertical
      var x1, y1, dir1;
      if (conn.fromPort && fromE.portPositions[conn.fromPort]) {
        var fp = fromE.portPositions[conn.fromPort];
        x1 = fp.connX; y1 = fp.connY;
        dir1 = fp.side;
      } else {
        var fcx = fromE.x + fromE.box.width / 2;
        var fcy = fromE.y + fromE.box.height / 2;
        var tcx = toE.x + toE.box.width / 2;
        var tcy = toE.y + toE.box.height / 2;
        var dx = tcx - fcx, dy = tcy - fcy;
        // Prefer horizontal: only use vertical if dx is near zero
        if (Math.abs(dx) > 5) {
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
        dir2 = tp.side;
      } else {
        var fcx2 = fromE.x + fromE.box.width / 2;
        var fcy2 = fromE.y + fromE.box.height / 2;
        var tcx2 = toE.x + toE.box.width / 2;
        var tcy2 = toE.y + toE.box.height / 2;
        var dx2 = tcx2 - fcx2, dy2 = tcy2 - fcy2;
        if (Math.abs(dx2) > 5) {
          x2 = dx2 > 0 ? toE.x : toE.x + toE.box.width;
          y2 = tcy2;
          dir2 = dx2 > 0 ? 'right' : 'left';
        } else {
          x2 = tcx2;
          y2 = dy2 > 0 ? toE.y : toE.y + toE.box.height;
          dir2 = dy2 > 0 ? 'bottom' : 'top';
        }
      }

      // Skip source and target when checking obstacles
      var skipN = {};
      skipN[conn.from] = true;
      skipN[conn.to] = true;

      var isH1 = (dir1 === 'left' || dir1 === 'right');
      var isH2 = (dir2 === 'left' || dir2 === 'right');
      var margin = 15;

      var points;
      // Compute extension points: ensure we go far enough in the port's
      // direction before turning, so lines visibly exit/enter from the port side.
      var ext1X = x1, ext1Y = y1;
      if (dir1 === 'right') ext1X = Math.max(x1 + margin, fromE.x + fromE.box.width + CFG.portSize + margin);
      else if (dir1 === 'left') ext1X = Math.min(x1 - margin, fromE.x - CFG.portSize - margin);
      else if (dir1 === 'bottom') ext1Y = Math.max(y1 + margin, fromE.y + fromE.box.height + margin);
      else if (dir1 === 'top') ext1Y = Math.min(y1 - margin, fromE.y - margin);

      var ext2X = x2, ext2Y = y2;
      if (dir2 === 'right') ext2X = Math.max(x2 + margin, toE.x + toE.box.width + CFG.portSize + margin);
      else if (dir2 === 'left') ext2X = Math.min(x2 - margin, toE.x - CFG.portSize - margin);
      else if (dir2 === 'bottom') ext2Y = Math.max(y2 + margin, toE.y + toE.box.height + margin);
      else if (dir2 === 'top') ext2Y = Math.min(y2 - margin, toE.y - margin);

      // Case 1: nearly aligned and same direction — direct line
      if (Math.abs(x1 - x2) < 2 && !isH1 && !isH2) {
        points = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
      } else if (Math.abs(y1 - y2) < 2 && isH1 && isH2) {
        points = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
      }
      // Case 2: both horizontal exits (e.g. right port → left port)
      else if (isH1 && isH2) {
        if (Math.abs(y1 - y2) < 2) {
          points = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
        } else {
          // Route: exit horizontal → vertical channel → enter horizontal
          var midX = (ext1X + ext2X) / 2;
          // If ports face the same way or the extensions overlap, pick a clear channel
          if ((dir1 === 'right' && dir2 === 'left' && ext1X > ext2X) ||
              (dir1 === 'left' && dir2 === 'right' && ext1X < ext2X)) {
            // Extensions don't meet — use the further-out one as channel
            midX = (dir1 === 'right') ? Math.max(ext1X, ext2X) : Math.min(ext1X, ext2X);
          }
          midX = findClearX(Math.min(y1, y2), Math.max(y1, y2), midX, obstacles, skipN);
          points = [
            { x: x1, y: y1 }, { x: midX, y: y1 },
            { x: midX, y: y2 }, { x: x2, y: y2 }
          ];
        }
      }
      // Case 3: both vertical exits (bottom→top or top→bottom)
      else if (!isH1 && !isH2) {
        if (Math.abs(x1 - x2) < 2) {
          points = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
        } else {
          var midY = (ext1Y + ext2Y) / 2;
          if ((dir1 === 'bottom' && dir2 === 'top' && ext1Y > ext2Y) ||
              (dir1 === 'top' && dir2 === 'bottom' && ext1Y < ext2Y)) {
            midY = (dir1 === 'bottom') ? Math.max(ext1Y, ext2Y) : Math.min(ext1Y, ext2Y);
          }
          midY = findClearY(Math.min(x1, x2), Math.max(x1, x2), midY, obstacles, skipN);
          points = [
            { x: x1, y: y1 }, { x: x1, y: midY },
            { x: x2, y: midY }, { x: x2, y: y2 }
          ];
        }
      }
      // Case 4: horizontal exit → vertical entry — L-shape
      else if (isH1 && !isH2) {
        // Go horizontal to target X, then vertical to target
        points = [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }];
        if (routeHitsObstacle(points, obstacles, skipN)) {
          // Blocked — use extension + Z-shape
          points = [{ x: x1, y: y1 }, { x: ext1X, y: y1 }, { x: ext1X, y: y2 }, { x: x2, y: y2 }];
        }
      }
      // Case 5: vertical exit → horizontal entry — L-shape
      else {
        points = [{ x: x1, y: y1 }, { x: x1, y: y2 }, { x: x2, y: y2 }];
        if (routeHitsObstacle(points, obstacles, skipN)) {
          points = [{ x: x1, y: y1 }, { x: x1, y: ext1Y }, { x: x2, y: ext1Y }, { x: x2, y: y2 }];
        }
      }

      // Final obstacle check — if still blocked, find clear channel
      if (routeHitsObstacle(points, obstacles, skipN)) {
        if (isH1) {
          var cX = findClearX(Math.min(y1, y2), Math.max(y1, y2), ext1X, obstacles, skipN);
          points = [{ x: x1, y: y1 }, { x: cX, y: y1 }, { x: cX, y: y2 }, { x: x2, y: y2 }];
        } else {
          var cY = findClearY(Math.min(x1, x2), Math.max(x1, x2), ext1Y, obstacles, skipN);
          points = [{ x: x1, y: y1 }, { x: x1, y: cY }, { x: x2, y: cY }, { x: x2, y: y2 }];
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

      // Connector label — placed on the longest segment, above for horizontal, beside for vertical
      if (conn.label) {
        // Find the longest segment that isn't too short
        var bestSi = 0, bestSLen = 0;
        for (var lsi = 0; lsi < points.length - 1; lsi++) {
          var sl = Math.abs(points[lsi+1].x - points[lsi].x) + Math.abs(points[lsi+1].y - points[lsi].y);
          if (sl > bestSLen) { bestSLen = sl; bestSi = lsi; }
        }
        var lSeg0 = points[bestSi], lSeg1 = points[bestSi + 1];
        var lSegIsH = Math.abs(lSeg1.y - lSeg0.y) < 1;
        var lx = (lSeg0.x + lSeg1.x) / 2;
        var ly = (lSeg0.y + lSeg1.y) / 2;
        var lAnchor = 'middle';
        if (lSegIsH) {
          ly -= 10;
        } else {
          lx += 10; lAnchor = 'start';
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
