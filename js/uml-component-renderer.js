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
 *     provide "name" as alias    Provided interface (lollipop ○)
 *     require "name" as alias    Required interface (socket arc)
 *   }
 *   A --> B : label              Assembly connector (solid arrow)
 *   alias --> alias : label      Connector via port aliases (squares on boundary)
 *   provide --> require : label  Joined ball-and-socket assembly (○))
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
    portPad: 40,    // min vertical pitch between ports (must fit port square + label text below)
    labelBgPad: 4,
    ifaceRadius: 9,   // radius of lollipop circle / socket arc
    ifaceStick: 20,   // length of line from component edge to interface symbol center
  };

  // ─── Parser ───────────────────────────────────────────────────────

  // Parse a single port line: (portin|portout|port) ["name"] [as alias]
  // Returns { name, alias, direction } or null.
  function parsePortLine(line) {
    var m = line.match(/^(portin|portout|port|provide|require)\s+"([^"]+)"(?:\s+as\s+(\S+))?/) ||
            line.match(/^(portin|portout|port|provide|require)\s+(\S+?)(?:\s+as\s+(\S+))?$/);
    if (!m) return null;
    var kw = m[1], displayName = m[2], alias = m[3] || displayName;
    var direction, kind = null;
    if (kw === 'portin') direction = 'in';
    else if (kw === 'portout') direction = 'out';
    else if (kw === 'provide') { direction = 'out'; kind = 'provide'; }
    else if (kw === 'require') { direction = 'in'; kind = 'require'; }
    else direction = null;
    return { name: displayName, alias: alias, direction: direction, kind: kind };
  }

  function parse(text) {
    var lines = text.split('\n');
    var components = [];
    var componentMap = {};
    var connectors = [];
    var portAliasMap = {}; // alias → { comp: componentName, name: displayName }

    var direction = 'LR'; // Component diagrams default to left-to-right

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line === '@startuml' || line === '@enduml') continue;

      // Layout directive
      var layoutMatch = line.match(/^layout\s+(horizontal|vertical|left-to-right|top-to-bottom|LR|TB)$/i);
      if (layoutMatch) {
        var val = layoutMatch[1].toLowerCase();
        direction = (val === 'horizontal' || val === 'left-to-right' || val === 'lr') ? 'LR' : 'TB';
        continue;
      }

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
              var portRe = /(portin|portout|port|provide|require)\s+(?:"([^"]+)"|(\w+))(?:\s+as\s+(\w+))?/g;
              var pm;
              while ((pm = portRe.exec(inlineBody[1])) !== null) {
                var kw = pm[1], displayName = pm[2] || pm[3], alias = pm[4] || displayName;
                var direction, kind2 = null;
                if (kw === 'portin') direction = 'in';
                else if (kw === 'portout') direction = 'out';
                else if (kw === 'provide') { direction = 'out'; kind2 = 'provide'; }
                else if (kw === 'require') { direction = 'in'; kind2 = 'require'; }
                else direction = null;
                var portEntry = { name: displayName, alias: alias, direction: direction, kind: kind2 };
                ports.push(portEntry);
                portAliasMap[alias] = { comp: cName, name: displayName, kind: kind2 };
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
                portAliasMap[portLine.alias] = { comp: cName, name: portLine.name, kind: portLine.kind || null };
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

    return { components: components, connectors: connectors, direction: direction };
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
      var hasPorts = leftPorts.length > 0 || rightPorts.length > 0;
      var maxSidePorts = Math.max(leftPorts.length, rightPorts.length);

      // Measure port label widths for internal placement
      var portLblFs = CFG.fontSize - 1;
      var maxLeftLblW = 0, maxRightLblW = 0;
      var portLabelByAlias0 = {};
      for (var pli = 0; pli < c.ports.length; pli++) {
        portLabelByAlias0[c.ports[pli].alias] = c.ports[pli].name;
      }
      for (var lli = 0; lli < leftPorts.length; lli++) {
        var lbl = portLabelByAlias0[leftPorts[lli]] || leftPorts[lli];
        maxLeftLblW = Math.max(maxLeftLblW, UMLShared.textWidth(lbl, false, portLblFs));
      }
      for (var rli = 0; rli < rightPorts.length; rli++) {
        var rbl = portLabelByAlias0[rightPorts[rli]] || rightPorts[rli];
        maxRightLblW = Math.max(maxRightLblW, UMLShared.textWidth(rbl, false, portLblFs));
      }

      var w, h;
      if (hasPorts) {
        // Width: must fit name+icon row OR left-labels + gap + right-labels row
        var nameRowW = nameW + CFG.padX + CFG.iconW + 16;
        var portRowW = maxLeftLblW + maxRightLblW + CFG.portSize * 2 + 50;
        w = Math.max(CFG.compMinW, nameRowW, portRowW);
        // Height: name area at top + port rows below
        var nameAreaH = CFG.lineHeight + CFG.padY;
        h = nameAreaH + maxSidePorts * CFG.portPad + CFG.padY;
        h = Math.max(h, CFG.compMinH);
      } else {
        w = Math.max(CFG.compMinW, nameW + CFG.padX * 2 + CFG.iconW);
        h = CFG.compMinH;
      }

      entries[c.name] = {
        comp: c,
        box: { width: Math.ceil(w), height: h },
        x: 0, y: 0,
        leftPorts: leftPorts,
        rightPorts: rightPorts,
        portPositions: {},
        hasPorts: hasPorts,
      };
      layoutNodes.push({ id: c.name, width: Math.ceil(w), height: h, data: c });
    }

    for (var ci = 0; ci < connectors.length; ci++) {
      var conn = connectors[ci];
      layoutEdges.push({ source: conn.from, target: conn.to, type: conn.type, data: conn });
    }

    // Port labels are inside the component box, so gaps only need to fit connector labels
    var maxLabelW = 0;
    for (var ci3 = 0; ci3 < connectors.length; ci3++) {
      if (connectors[ci3].label) {
        maxLabelW = Math.max(maxLabelW, UMLShared.textWidth(connectors[ci3].label, false, CFG.fontSize));
      }
    }
    // Add extra gap when interface symbols (lollipop/socket) are present
    var hasIface = false;
    for (var ci_ig = 0; ci_ig < components.length && !hasIface; ci_ig++)
      for (var pi_ig = 0; pi_ig < components[ci_ig].ports.length; pi_ig++)
        if (components[ci_ig].ports[pi_ig].kind) { hasIface = true; break; }
    var ifaceGapExtra = hasIface ? (CFG.ifaceStick + CFG.ifaceRadius) * 2 : 0;
    var effectiveGapX = Math.max(CFG.gapX, maxLabelW + 40 + ifaceGapExtra);
    var effectiveGapY = CFG.gapY;

    var result = window.UMLAdvancedLayout.compute(layoutNodes, layoutEdges, { gapX: effectiveGapX, gapY: effectiveGapY, direction: parsed.direction || 'LR' });

    for (var n in result.nodes) {
      if (!entries[n]) continue;
      entries[n].x = result.nodes[n].x;
      entries[n].y = result.nodes[n].y;
    }

    // ── Reorder ports to minimize crossing lines ──
    // Sort ports by the angle from this component to their connection partner.
    // Ports connecting to targets above-right get negative angles (sorted to top),
    // ports connecting below-right get positive angles (sorted to bottom).
    var portTargetPos = {};  // right-port alias → { x, y } of target center
    var portSourcePos = {};  // left-port alias → { x, y } of source center
    for (var ri = 0; ri < connectors.length; ri++) {
      var rc = connectors[ri];
      if (rc.fromPort && entries[rc.from] && entries[rc.to]) {
        var rte = entries[rc.to];
        portTargetPos[rc.fromPort] = { x: rte.x, y: rte.y + rte.box.height / 2 };
      }
      if (rc.toPort && entries[rc.from] && entries[rc.to]) {
        var rse = entries[rc.from];
        portSourcePos[rc.toPort] = { x: rse.x + rse.box.width, y: rse.y + rse.box.height / 2 };
      }
    }
    for (var sn in entries) {
      var se = entries[sn];
      var seCY = se.y + se.box.height / 2;
      // Right ports: sort by angle to target
      var seRightX = se.x + se.box.width;
      se.rightPorts.sort(function(a, b) {
        var pa = portTargetPos[a], pb = portTargetPos[b];
        if (!pa && !pb) return 0;
        if (!pa) return 1;
        if (!pb) return -1;
        var angleA = Math.atan2(pa.y - seCY, Math.max(1, pa.x - seRightX));
        var angleB = Math.atan2(pb.y - seCY, Math.max(1, pb.x - seRightX));
        return angleA - angleB;
      });
      // Left ports: sort by angle from source
      var seLeftX = se.x;
      se.leftPorts.sort(function(a, b) {
        var pa = portSourcePos[a], pb = portSourcePos[b];
        if (!pa && !pb) return 0;
        if (!pa) return 1;
        if (!pb) return -1;
        var angleA = Math.atan2(pa.y - seCY, Math.max(1, seLeftX - pa.x));
        var angleB = Math.atan2(pb.y - seCY, Math.max(1, seLeftX - pb.x));
        return angleA - angleB;
      });
    }

    // Compute port positions (after x,y are finalized and ports are reordered)
    var portHalf = CFG.portSize / 2;
    var nameAreaH = CFG.lineHeight + CFG.padY;
    for (var en in entries) {
      var e = entries[en];
      var bx = e.x, by = e.y, bw = e.box.width, bh = e.box.height;

      var portLabelByAlias = {};
      var portKindByAlias = {};
      for (var pni = 0; pni < e.comp.ports.length; pni++) {
        var p = e.comp.ports[pni];
        portLabelByAlias[p.alias] = p.name;
        if (p.kind) portKindByAlias[p.alias] = p.kind;
      }

      // Port area starts below the name row (or uses full height if no ports flag)
      var portTop = e.hasPorts ? by + nameAreaH : by;
      var portAreaH = bh - (e.hasPorts ? nameAreaH : 0);

      for (var lpi2 = 0; lpi2 < e.leftPorts.length; lpi2++) {
        var lpn = e.leftPorts[lpi2];
        var pcy = portTop + portAreaH * (lpi2 + 1) / (e.leftPorts.length + 1);
        var lpK = portKindByAlias[lpn] || null;
        e.portPositions[lpn] = {
          x: bx - portHalf, y: pcy - portHalf,
          cx: bx, cy: pcy,
          connX: bx - portHalf, connY: pcy,
          side: 'left',
          kind: lpK,
          label: portLabelByAlias[lpn] !== undefined ? portLabelByAlias[lpn] : lpn,
        };
      }

      for (var rpi2 = 0; rpi2 < e.rightPorts.length; rpi2++) {
        var rpn = e.rightPorts[rpi2];
        var pcy2 = portTop + portAreaH * (rpi2 + 1) / (e.rightPorts.length + 1);
        var rpK = portKindByAlias[rpn] || null;
        e.portPositions[rpn] = {
          x: bx + bw - portHalf, y: pcy2 - portHalf,
          cx: bx + bw, cy: pcy2,
          connX: bx + bw + portHalf, connY: pcy2,
          side: 'right',
          kind: rpK,
          label: portLabelByAlias[rpn] !== undefined ? portLabelByAlias[rpn] : rpn,
        };
      }
    }

    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var en2 in entries) {
      var e2 = entries[en2];
      var leftOH = 0, rightOH = 0;
      for (var pn2 in e2.portPositions) {
        var pp2 = e2.portPositions[pn2];
        var pext = (pp2.kind === 'provide') ? CFG.ifaceStick + CFG.ifaceRadius + 2 :
                   (pp2.kind === 'require') ? CFG.ifaceStick + CFG.ifaceRadius + 2 : portHalf;
        if (pp2.side === 'left') leftOH = Math.max(leftOH, pext);
        else rightOH = Math.max(rightOH, pext);
      }
      minX = Math.min(minX, e2.x - leftOH);
      minY = Math.min(minY, e2.y);
      maxX = Math.max(maxX, e2.x + e2.box.width + rightOH);
      maxY = Math.max(maxY, e2.y + e2.box.height);
    }

    return {
      entries: entries,
      width: maxX - minX + 20,
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
    // Build port kind map for interface detection
    var portKindMap = {};
    for (var pki = 0; pki < parsed.components.length; pki++) {
      var pkComp = parsed.components[pki];
      for (var pkpi = 0; pkpi < pkComp.ports.length; pkpi++) {
        if (pkComp.ports[pkpi].kind)
          portKindMap[pkComp.ports[pkpi].alias] = pkComp.ports[pkpi].kind;
      }
    }

    // Identify joined ports (assembly connectors between provide/require)
    var joinedPorts = {};
    for (var jci = 0; jci < connectors.length; jci++) {
      var jc = connectors[jci];
      if (jc.type !== 'assembly') continue;
      var jfk = jc.fromPort ? portKindMap[jc.fromPort] : null;
      var jtk = jc.toPort ? portKindMap[jc.toPort] : null;
      if ((jfk === 'provide' && jtk === 'require') || (jfk === 'require' && jtk === 'provide')) {
        if (jc.fromPort) joinedPorts[jc.fromPort] = true;
        if (jc.toPort) joinedPorts[jc.toPort] = true;
      }
    }

    // Collect component bounding boxes as obstacles (with interface extensions)
    var obstaclePad = 12;
    var obstacles = [];
    for (var obn in entries) {
      var obe = entries[obn];
      var obLeftExt = 0, obRightExt = 0;
      for (var obpn in obe.portPositions) {
        var obpp = obe.portPositions[obpn];
        if (obpp.kind) {
          var ife = CFG.ifaceStick + CFG.ifaceRadius + 4;
          if (obpp.side === 'left') obLeftExt = Math.max(obLeftExt, ife);
          else obRightExt = Math.max(obRightExt, ife);
        }
      }
      obstacles.push({
        x1: obe.x - obstaclePad - obLeftExt,
        y1: obe.y - obstaclePad,
        x2: obe.x + obe.box.width + obstaclePad + obRightExt,
        y2: obe.y + obe.box.height + obstaclePad,
        name: obn
      });
    }

    // ── Draw connectors ──
    var placedLabels = []; // Track placed label positions for overlap avoidance
    for (var ci = 0; ci < connectors.length; ci++) {
      var conn = connectors[ci];
      var fromE = entries[conn.from];
      var toE = entries[conn.to];
      if (!fromE || !toE) continue;

      var isDash = conn.type === 'dependency';
      var dAttr = isDash ? ' stroke-dasharray="8,4"' : '';

      // Detect joined assembly (provide ↔ require via assembly connector)
      var fpPos = conn.fromPort && fromE.portPositions[conn.fromPort] ? fromE.portPositions[conn.fromPort] : null;
      var tpPos = conn.toPort && toE.portPositions[conn.toPort] ? toE.portPositions[conn.toPort] : null;
      var fromKind = fpPos ? fpPos.kind : null;
      var toKind = tpPos ? tpPos.kind : null;
      var isJoinedAssembly = conn.type === 'assembly' &&
        ((fromKind === 'provide' && toKind === 'require') || (fromKind === 'require' && toKind === 'provide'));

      // Start point and exit direction
      var x1, y1, dir1;
      if (fpPos) {
        y1 = fpPos.connY;
        dir1 = fpPos.side;
        if (isJoinedAssembly) {
          // Joined: start at component edge
          x1 = fpPos.cx;
        } else if (fpPos.kind === 'provide') {
          // Disjoined: start at lollipop tip
          x1 = fpPos.side === 'right' ? fpPos.cx + CFG.ifaceStick + CFG.ifaceRadius :
                                         fpPos.cx - CFG.ifaceStick - CFG.ifaceRadius;
        } else if (fpPos.kind === 'require') {
          x1 = fpPos.side === 'right' ? fpPos.cx + CFG.ifaceStick :
                                         fpPos.cx - CFG.ifaceStick;
        } else {
          x1 = fpPos.connX;
        }
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
      if (tpPos) {
        y2 = tpPos.connY;
        dir2 = tpPos.side;
        if (isJoinedAssembly) {
          x2 = tpPos.cx;
        } else if (tpPos.kind === 'provide') {
          x2 = tpPos.side === 'right' ? tpPos.cx + CFG.ifaceStick + CFG.ifaceRadius :
                                         tpPos.cx - CFG.ifaceStick - CFG.ifaceRadius;
        } else if (tpPos.kind === 'require') {
          x2 = tpPos.side === 'right' ? tpPos.cx + CFG.ifaceStick :
                                         tpPos.cx - CFG.ifaceStick;
        } else {
          x2 = tpPos.connX;
        }
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
      var margin = 20;

      var points;
      // Compute extension points: ensure we go far enough past the component
      // (including port labels) before turning, so lines visibly exit from the port.
      // Use the expanded obstacle bounds for the source/target components.
      var fromObs = null, toObs = null;
      for (var obi = 0; obi < obstacles.length; obi++) {
        if (obstacles[obi].name === conn.from) fromObs = obstacles[obi];
        if (obstacles[obi].name === conn.to) toObs = obstacles[obi];
      }

      var ext1X = x1, ext1Y = y1;
      if (dir1 === 'right') ext1X = fromObs ? Math.max(x1 + margin, fromObs.x2 + margin) : x1 + margin;
      else if (dir1 === 'left') ext1X = fromObs ? Math.min(x1 - margin, fromObs.x1 - margin) : x1 - margin;
      else if (dir1 === 'bottom') ext1Y = fromObs ? Math.max(y1 + margin, fromObs.y2 + margin) : y1 + margin;
      else if (dir1 === 'top') ext1Y = fromObs ? Math.min(y1 - margin, fromObs.y1 - margin) : y1 - margin;

      var ext2X = x2, ext2Y = y2;
      if (dir2 === 'right') ext2X = toObs ? Math.max(x2 + margin, toObs.x2 + margin) : x2 + margin;
      else if (dir2 === 'left') ext2X = toObs ? Math.min(x2 - margin, toObs.x1 - margin) : x2 - margin;
      else if (dir2 === 'bottom') ext2Y = toObs ? Math.max(y2 + margin, toObs.y2 + margin) : y2 + margin;
      else if (dir2 === 'top') ext2Y = toObs ? Math.min(y2 - margin, toObs.y1 - margin) : y2 - margin;

      // All cases: build initial route, then always check for obstacles.

      if (isH1 && isH2) {
        // Both horizontal exits — try direct line first
        if (Math.abs(y1 - y2) < 2) {
          points = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
        } else {
          // S-shape: exit horizontal → vertical channel → enter horizontal
          var midX = (ext1X + ext2X) / 2;
          if ((dir1 === 'right' && dir2 === 'left' && ext1X > ext2X) ||
              (dir1 === 'left' && dir2 === 'right' && ext1X < ext2X)) {
            midX = (dir1 === 'right') ? Math.max(ext1X, ext2X) : Math.min(ext1X, ext2X);
          }
          midX += (ci % 5) * 12 - 24; // Jitter to prevent identical overlaps
          // Clamp to corridor so the vertical segment stays between the two components
          // and doesn't get pushed back inside the source or target obstacle zone.
          if (dir1 === 'right' && dir2 === 'left' && ext1X <= ext2X) {
            midX = Math.min(Math.max(midX, ext1X), ext2X);
          } else if (dir1 === 'left' && dir2 === 'right' && ext2X <= ext1X) {
            midX = Math.min(Math.max(midX, ext2X), ext1X);
          }
          midX = findClearX(Math.min(y1, y2), Math.max(y1, y2), midX, obstacles, skipN);
          points = [
            { x: x1, y: y1 }, { x: midX, y: y1 },
            { x: midX, y: y2 }, { x: x2, y: y2 }
          ];
        }
        // If the route hits obstacles (common for same-Y routes through components),
        // detour above or below via a clear horizontal channel.
        if (routeHitsObstacle(points, obstacles, skipN)) {
          var detourY = findClearY(Math.min(x1, x2), Math.max(x1, x2), y1 - 50, obstacles, skipN);
          points = [
            { x: x1, y: y1 }, { x: ext1X, y: y1 },
            { x: ext1X, y: detourY },
            { x: ext2X, y: detourY },
            { x: ext2X, y: y2 }, { x: x2, y: y2 }
          ];
          // If still blocked, try below
          if (routeHitsObstacle(points, obstacles, skipN)) {
            detourY = findClearY(Math.min(x1, x2), Math.max(x1, x2), Math.max(y1, y2) + 50, obstacles, skipN);
            points = [
              { x: x1, y: y1 }, { x: ext1X, y: y1 },
              { x: ext1X, y: detourY },
              { x: ext2X, y: detourY },
              { x: ext2X, y: y2 }, { x: x2, y: y2 }
            ];
          }
        }
      } else if (!isH1 && !isH2) {
        // Both vertical exits
        if (Math.abs(x1 - x2) < 2) {
          points = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
        } else {
          var midY = (ext1Y + ext2Y) / 2;
          if ((dir1 === 'bottom' && dir2 === 'top' && ext1Y > ext2Y) ||
              (dir1 === 'top' && dir2 === 'bottom' && ext1Y < ext2Y)) {
            midY = (dir1 === 'bottom') ? Math.max(ext1Y, ext2Y) : Math.min(ext1Y, ext2Y);
          }
          midY += (ci % 5) * 12 - 24; // Jitter to prevent identical overlaps
          midY = findClearY(Math.min(x1, x2), Math.max(x1, x2), midY, obstacles, skipN);
          points = [
            { x: x1, y: y1 }, { x: x1, y: midY },
            { x: x2, y: midY }, { x: x2, y: y2 }
          ];
        }
        if (routeHitsObstacle(points, obstacles, skipN)) {
          var detourX = findClearX(Math.min(y1, y2), Math.max(y1, y2), x1 - 50, obstacles, skipN);
          points = [
            { x: x1, y: y1 }, { x: x1, y: ext1Y },
            { x: detourX, y: ext1Y },
            { x: detourX, y: ext2Y },
            { x: x2, y: ext2Y }, { x: x2, y: y2 }
          ];
        }
      } else if (isH1 && !isH2) {
        // Horizontal exit → vertical entry — L-shape
        points = [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }];
        if (routeHitsObstacle(points, obstacles, skipN)) {
          points = [{ x: x1, y: y1 }, { x: ext1X, y: y1 }, { x: ext1X, y: y2 }, { x: x2, y: y2 }];
        }
      } else {
        // Vertical exit → horizontal entry — L-shape
        points = [{ x: x1, y: y1 }, { x: x1, y: y2 }, { x: x2, y: y2 }];
        if (routeHitsObstacle(points, obstacles, skipN)) {
          points = [{ x: x1, y: y1 }, { x: x1, y: ext1Y }, { x: x2, y: ext1Y }, { x: x2, y: y2 }];
        }
      }

      // Final obstacle check — if still blocked, find clear channel
      if (routeHitsObstacle(points, obstacles, skipN)) {
        if (isH1) {
          var detourYf = findClearY(Math.min(x1, x2), Math.max(x1, x2),
            Math.min(y1, y2) - 50, obstacles, skipN);
          points = [
            { x: x1, y: y1 }, { x: ext1X, y: y1 },
            { x: ext1X, y: detourYf },
            { x: ext2X, y: detourYf },
            { x: ext2X, y: y2 }, { x: x2, y: y2 }
          ];
        } else {
          var detourXf = findClearX(Math.min(y1, y2), Math.max(y1, y2),
            Math.min(x1, x2) - 50, obstacles, skipN);
          points = [
            { x: x1, y: y1 }, { x: x1, y: ext1Y },
            { x: detourXf, y: ext1Y },
            { x: detourXf, y: ext2Y },
            { x: x2, y: ext2Y }, { x: x2, y: y2 }
          ];
        }
      }

      // Simplify collinear points
      points = simplifyRoute(points);

      if (isJoinedAssembly) {
        // ── Ball-and-socket: prefer the longest horizontal segment ──
        var bsSi = 0, bsSLen = 0, bsFoundH = false;
        for (var bsi = 0; bsi < points.length - 1; bsi++) {
          var bsSegIsH = Math.abs(points[bsi+1].y - points[bsi].y) < 1;
          var bsl = Math.abs(points[bsi+1].x - points[bsi].x) + Math.abs(points[bsi+1].y - points[bsi].y);
          if (bsSegIsH && (!bsFoundH || bsl > bsSLen)) {
            bsSi = bsi; bsSLen = bsl; bsFoundH = true;
          } else if (!bsFoundH && bsl > bsSLen) {
            bsSi = bsi; bsSLen = bsl;
          }
        }
        var bsSeg0 = points[bsSi], bsSeg1 = points[bsSi + 1];
        var bsMx = (bsSeg0.x + bsSeg1.x) / 2;
        var bsMy = (bsSeg0.y + bsSeg1.y) / 2;
        var bsR = CFG.ifaceRadius;
        var bsIsH = Math.abs(bsSeg1.y - bsSeg0.y) < 1;

        // Compute ball/socket positions and split points for the line gap
        var ballCx, ballCy, socketCx, socketCy, gapStart, gapEnd;
        if (bsIsH) {
          var fromIsLeft = bsSeg0.x < bsSeg1.x;
          var ballOnLeft = (fromKind === 'provide') ? fromIsLeft : !fromIsLeft;
          ballCx = ballOnLeft ? bsMx - bsR / 2 : bsMx + bsR / 2;
          ballCy = bsMy;
          socketCx = ballOnLeft ? bsMx + bsR / 2 : bsMx - bsR / 2;
          socketCy = bsMy;
          if (ballOnLeft) {
            gapStart = { x: ballCx - bsR, y: bsMy };
            gapEnd = { x: socketCx + bsR, y: bsMy };
          } else {
            gapStart = { x: socketCx - bsR, y: bsMy };
            gapEnd = { x: ballCx + bsR, y: bsMy };
          }
        } else {
          var fromIsTop = bsSeg0.y < bsSeg1.y;
          var ballOnTop = (fromKind === 'provide') ? fromIsTop : !fromIsTop;
          ballCx = bsMx;
          ballCy = ballOnTop ? bsMy - bsR / 2 : bsMy + bsR / 2;
          socketCx = bsMx;
          socketCy = ballOnTop ? bsMy + bsR / 2 : bsMy - bsR / 2;
          if (ballOnTop) {
            gapStart = { x: bsMx, y: ballCy - bsR };
            gapEnd = { x: bsMx, y: socketCy + bsR };
          } else {
            gapStart = { x: bsMx, y: socketCy - bsR };
            gapEnd = { x: bsMx, y: ballCy + bsR };
          }
        }

        // Draw polyline in two parts: before and after the ball-and-socket gap
        var pts1 = '', pts2 = '';
        for (var pi = 0; pi <= bsSi; pi++) {
          if (pi > 0) pts1 += ' ';
          pts1 += points[pi].x + ',' + points[pi].y;
        }
        pts1 += ' ' + gapStart.x + ',' + gapStart.y;
        pts2 = gapEnd.x + ',' + gapEnd.y;
        for (var pi2 = bsSi + 1; pi2 < points.length; pi2++) {
          pts2 += ' ' + points[pi2].x + ',' + points[pi2].y;
        }
        svg.push('<polyline points="' + pts1 +
          '" fill="none" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"/>');
        svg.push('<polyline points="' + pts2 +
          '" fill="none" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"/>');

        // Draw ball (filled circle)
        svg.push('<circle cx="' + ballCx + '" cy="' + ballCy + '" r="' + bsR +
          '" fill="' + colors.fill + '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"/>');
        // Draw socket arc
        if (bsIsH) {
          var socketSweep = (ballCx < socketCx) ? '1' : '0';
          svg.push('<path d="M' + socketCx + ',' + (socketCy - bsR) + ' A' + bsR + ',' + bsR +
            ' 0 0,' + socketSweep + ' ' + socketCx + ',' + (socketCy + bsR) +
            '" fill="none" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"/>');
        } else {
          var vSweep = (ballCy < socketCy) ? '1' : '0';
          svg.push('<path d="M' + (socketCx - bsR) + ',' + socketCy + ' A' + bsR + ',' + bsR +
            ' 0 0,' + vSweep + ' ' + (socketCx + bsR) + ',' + socketCy +
            '" fill="none" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"/>');
        }
      } else {
        // Draw full polyline for non-joined connectors
        var pStr = '';
        for (var pi = 0; pi < points.length; pi++) {
          if (pi > 0) pStr += ' ';
          pStr += points[pi].x + ',' + points[pi].y;
        }
        svg.push('<polyline points="' + pStr +
          '" fill="none" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"' + dAttr + '/>');
      }

      if (!isJoinedAssembly && conn.type !== 'link') {
        // Arrowhead at destination
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

      // Connector label — placed on the longest segment, with overlap avoidance
      if (conn.label) {
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
        // Nudge label until it doesn't overlap any previously placed label
        var lblW = UMLShared.textWidth(conn.label, false, CFG.fontSize);
        var lblH = CFG.fontSize + 6;
        // Compute the actual bounding box edges based on anchor
        // For "middle": center at lx; for "start": left edge at lx
        var lblLeft = (lAnchor === 'middle') ? lx - lblW / 2 : lx;
        var lblRight = lblLeft + lblW;
        for (var nudge = 0; nudge < 8; nudge++) {
          var hasOverlap = false;
          for (var pli = 0; pli < placedLabels.length; pli++) {
            var pl = placedLabels[pli];
            // Check actual bounding box overlap
            if (lblRight + 6 > pl.left && lblLeft - 6 < pl.right &&
                ly + 2 > pl.top && ly - lblH - 2 < pl.bottom) {
              hasOverlap = true;
              break;
            }
          }
          if (!hasOverlap) break;
          // Shift away from the collision
          if (lSegIsH) {
            ly -= lblH;
          } else {
            ly += lblH;
          }
        }
        placedLabels.push({
          left: lblLeft, right: lblRight,
          top: ly - lblH, bottom: ly + 2,
          x: lx, y: ly
        });
        svg.push('<text x="' + lx + '" y="' + ly +
          '" text-anchor="' + lAnchor + '" font-size="' + CFG.fontSize + '" fill="' + colors.text +
          '" stroke="' + colors.fill + '" stroke-width="4" stroke-opacity="0.85" stroke-linejoin="round" paint-order="stroke" font-style="italic">' +
          UMLShared.escapeXml(conn.label) + '</text>');
      }
    }

    // ── Draw component boxes ──
    var nameAreaH2 = CFG.lineHeight + CFG.padY;
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

      if (e.hasPorts) {
        // Name at top-left when component has ports
        svg.push('<text x="' + (bx + CFG.padX) + '" y="' + (by + CFG.padY + CFG.fontSizeBold * 0.35 + 2) +
          '" font-weight="bold" font-size="' + CFG.fontSizeBold + '" fill="' + colors.text + '">' +
          UMLShared.escapeXml(e.comp.name) + '</text>');

      } else {
        // Centered name when no ports
        svg.push('<text x="' + (bx + (bw - CFG.iconW - 8) / 2) + '" y="' + (by + bh / 2 + CFG.fontSize * 0.35) +
          '" text-anchor="middle" font-weight="bold" font-size="' + CFG.fontSizeBold + '" fill="' + colors.text + '">' +
          UMLShared.escapeXml(e.comp.name) + '</text>');
      }

      // ── Draw ports (squares, lollipops, sockets) and labels ──
      var portHalf2 = CFG.portSize / 2;
      var portLblFs2 = CFG.fontSize - 1;
      for (var pname in e.portPositions) {
        var pp = e.portPositions[pname];
        var plText = pp.label !== undefined ? pp.label : pname;

        if (pp.kind === 'provide' || pp.kind === 'require') {
          // ── Interface port: lollipop (provide) or socket (require) ──
          if (!joinedPorts[pname]) {
            // Standalone interface — draw extending from component edge
            var ifR = CFG.ifaceRadius;
            var ifS = CFG.ifaceStick;
            var ifCx, ifCy = pp.cy;

            if (pp.side === 'right') {
              ifCx = pp.cx + ifS;
              // Stick line from component edge
              svg.push('<line x1="' + pp.cx + '" y1="' + ifCy + '" x2="' + ifCx + '" y2="' + ifCy +
                '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"/>');
              if (pp.kind === 'provide') {
                // Lollipop: circle at end of stick
                svg.push('<circle cx="' + ifCx + '" cy="' + ifCy + '" r="' + ifR +
                  '" fill="' + colors.fill + '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"/>');
              } else {
                // Socket: `(` arc opening right (toward provider)
                svg.push('<path d="M' + ifCx + ',' + (ifCy - ifR) + ' A' + ifR + ',' + ifR +
                  ' 0 0,0 ' + ifCx + ',' + (ifCy + ifR) +
                  '" fill="none" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"/>');
              }
            } else {
              ifCx = pp.cx - ifS;
              svg.push('<line x1="' + pp.cx + '" y1="' + ifCy + '" x2="' + ifCx + '" y2="' + ifCy +
                '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"/>');
              if (pp.kind === 'provide') {
                svg.push('<circle cx="' + ifCx + '" cy="' + ifCy + '" r="' + ifR +
                  '" fill="' + colors.fill + '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"/>');
              } else {
                // Socket: `)` arc opening left
                svg.push('<path d="M' + ifCx + ',' + (ifCy - ifR) + ' A' + ifR + ',' + ifR +
                  ' 0 0,1 ' + ifCx + ',' + (ifCy + ifR) +
                  '" fill="none" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"/>');
              }
            }
            // Label below the interface symbol
            svg.push('<text x="' + ifCx + '" y="' + (ifCy + ifR + portLblFs2 + 2) +
              '" text-anchor="middle" font-size="' + portLblFs2 + '"' +
              ' font-style="italic" fill="' + colors.text +
              '" stroke="' + colors.fill + '" stroke-width="3" paint-order="stroke">' +
              UMLShared.escapeXml(plText) + '</text>');
          }
          // Joined ports: no standalone symbol drawn (ball-and-socket is on the connector)
          // but still draw the label inside the component
          if (joinedPorts[pname]) {
            var jpLabelX, jpAnchor;
            if (pp.side === 'left') {
              jpLabelX = bx + portHalf2 + 6;
              jpAnchor = 'start';
            } else {
              jpLabelX = bx + bw - portHalf2 - 6;
              jpAnchor = 'end';
            }
            svg.push('<text x="' + jpLabelX + '" y="' + (pp.cy + portLblFs2 * 0.35) +
              '" text-anchor="' + jpAnchor + '" font-size="' + portLblFs2 + '"' +
              ' font-style="italic" fill="' + colors.text + '">' +
              UMLShared.escapeXml(plText) + '</text>');
          }
        } else {
          // ── Regular port: square straddling the component boundary ──
          svg.push('<rect x="' + pp.x + '" y="' + pp.y +
            '" width="' + CFG.portSize + '" height="' + CFG.portSize +
            '" fill="' + colors.fill + '" stroke="' + colors.stroke +
            '" stroke-width="' + CFG.strokeWidth + '"/>');

          // Port label inside the box, next to the port
          var plLabelX, plAnchor;
          if (pp.side === 'left') {
            plLabelX = bx + portHalf2 + 6;
            plAnchor = 'start';
          } else {
            plLabelX = bx + bw - portHalf2 - 6;
            plAnchor = 'end';
          }
          svg.push('<text x="' + plLabelX + '" y="' + (pp.cy + portLblFs2 * 0.35) +
            '" text-anchor="' + plAnchor + '" font-size="' + portLblFs2 + '"' +
            ' font-style="italic" fill="' + colors.text + '">' +
            UMLShared.escapeXml(plText) + '</text>');
        }
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
