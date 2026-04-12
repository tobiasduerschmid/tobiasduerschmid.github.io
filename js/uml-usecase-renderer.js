/**
 * UML Use Case Diagram Renderer
 *
 * Text format:
 *   @startuml
 *   actor User
 *   actor Admin
 *   usecase "Login" as UC1
 *   usecase "Register" as UC2
 *   usecase "Manage Users" as UC3
 *
 *   rectangle "My System" {
 *     UC1
 *     UC2
 *     UC3
 *   }
 *
 *   User -- UC1
 *   User -- UC2
 *   Admin -- UC1
 *   Admin -- UC3
 *   UC1 ..> UC3 : <<include>>
 *   UC2 ..> UC1 : <<extend>>
 *   Admin --|> User
 *   @enduml
 *
 * Notation:
 *   actor Name                Stick figure actor
 *   usecase "Label" as Alias  Use case ellipse
 *   rectangle "Name" { ... }  System boundary containing use cases
 *   A -- B                    Association (solid, no arrowhead)
 *   A --> B                   Directed association (solid, filled arrowhead)
 *   A ..> B : label           Dependency (dashed, open arrowhead, label)
 *   A --|> B                  Generalization (solid, hollow triangle)
 *   layout horizontal         Left-to-right layout (also: left-to-right, LR)
 *   layout vertical           Top-to-bottom layout (also: top-to-bottom, TB)
 */
(function () {
  'use strict';

  var CFG = {
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    fontSize: 14,
    fontSizeBold: 15,
    lineHeight: 22,
    actorW: 60,
    actorLabelGap: 6,
    ellipsePadX: 30,
    ellipsePadY: 16,
    ellipseMinW: 100,
    ellipseMinH: 44,
    sysPadX: 40,
    sysPadY: 40,
    sysTitlePadY: 24,
    sysRx: 8,
    gapX: 100,
    gapY: 60,
    arrowSize: 10,
    strokeWidth: 1.5,
    svgPad: 30,
    labelBgPad: 4,
  };

  // ─── Parser ───────────────────────────────────────────────────────

  function parse(text) {
    var lines = text.split('\n');
    var actors = {};       // id -> { id, name }
    var usecases = {};     // id -> { id, name, alias }
    var systems = [];      // [{ name, members: [id, ...] }]
    var relationships = [];
    var notes = [];
    var direction = 'LR';

    var inSystem = null;
    var braceDepth = 0;

    // Build a reverse lookup from alias to id
    var aliasToId = {};

    function resolveId(ref) {
      // Try alias first, then direct id
      return aliasToId[ref] || ref;
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line === '@startuml' || line === '@enduml') continue;

      // Layout directive
      var layoutMatch = line.match(/^layout\s+(horizontal|vertical|left-to-right|top-to-bottom|LR|TB)$/i);
      if (layoutMatch && inSystem === null) {
        var val = layoutMatch[1].toLowerCase();
        direction = (val === 'vertical' || val === 'top-to-bottom' || val === 'tb') ? 'TB' : 'LR';
        continue;
      }

      // Inside a system boundary block
      if (inSystem !== null) {
        for (var ci = 0; ci < line.length; ci++) {
          if (line[ci] === '{') braceDepth++;
          if (line[ci] === '}') braceDepth--;
        }
        if (braceDepth <= 0) {
          inSystem = null;
          braceDepth = 0;
          continue;
        }
        // Use case declaration inside system
        var ucInner = line.match(/^usecase\s+"([^"]+)"\s+as\s+(\S+)/);
        if (ucInner) {
          var ucId = ucInner[2];
          usecases[ucId] = { id: ucId, name: ucInner[1] };
          aliasToId[ucId] = ucId;
          systems[systems.length - 1].members.push(ucId);
          continue;
        }
        // Bare alias reference inside system (e.g. just "UC1")
        var bareRef = line.match(/^(\S+)\s*$/);
        if (bareRef) {
          var refId = resolveId(bareRef[1]);
          if (usecases[refId]) {
            systems[systems.length - 1].members.push(refId);
          } else {
            // May be a use case declared later or by name
            systems[systems.length - 1].members.push(bareRef[1]);
          }
          continue;
        }
        continue;
      }

      // Note
      var noteIdx = UMLShared.parseNoteLine(line, lines, i, notes);
      if (noteIdx >= 0) { i = noteIdx; continue; }

      // Actor declaration
      var actorMatch = line.match(/^actor\s+"?([^"]+?)"?\s*(?:as\s+(\S+))?\s*$/);
      if (actorMatch) {
        var aName = actorMatch[1].trim();
        var aId = actorMatch[2] || aName;
        actors[aId] = { id: aId, name: aName };
        aliasToId[aId] = aId;
        if (actorMatch[2]) aliasToId[actorMatch[2]] = aId;
        continue;
      }

      // Use case declaration
      var ucMatch = line.match(/^usecase\s+"([^"]+)"\s+as\s+(\S+)/);
      if (ucMatch) {
        var ucId2 = ucMatch[2];
        usecases[ucId2] = { id: ucId2, name: ucMatch[1] };
        aliasToId[ucId2] = ucId2;
        continue;
      }
      // Use case without alias: usecase "Name"
      var ucNoAlias = line.match(/^usecase\s+"([^"]+)"\s*$/);
      if (ucNoAlias) {
        var ucName = ucNoAlias[1];
        usecases[ucName] = { id: ucName, name: ucName };
        aliasToId[ucName] = ucName;
        continue;
      }

      // System boundary: rectangle "Name" { ... }
      var sysMatch = line.match(/^rectangle\s+"([^"]+)"\s*\{/);
      if (sysMatch) {
        systems.push({ name: sysMatch[1], members: [] });
        braceDepth = 1;
        // Check for immediate close on same line
        if (line.indexOf('}') !== -1 && line.indexOf('}') > line.indexOf('{')) {
          braceDepth = 0;
        } else {
          inSystem = systems[systems.length - 1];
        }
        continue;
      }

      // Relationships (order matters: longer patterns first)
      // Generalization: A --|> B
      var genMatch = line.match(/^(\S+)\s+--\|>\s+(\S+)\s*$/);
      if (genMatch) {
        relationships.push({
          from: genMatch[1],
          to: genMatch[2],
          type: 'generalization',
          label: '',
        });
        continue;
      }

      // Include/Extend: A ..> B : <<include>>  or  A ..> B : <<extend>>
      var dottedMatch = line.match(/^(\S+)\s+\.\.>\s+(\S+)\s*(?::\s*(.*))?$/);
      if (dottedMatch) {
        relationships.push({
          from: dottedMatch[1],
          to: dottedMatch[2],
          type: 'dependency',
          label: dottedMatch[3] ? dottedMatch[3].trim() : '',
        });
        continue;
      }

      // Directed association: A --> B
      var directedMatch = line.match(/^(\S+)\s+-->\s+(\S+)\s*(?::\s*(.*))?$/);
      if (directedMatch) {
        relationships.push({
          from: directedMatch[1],
          to: directedMatch[2],
          type: 'directed',
          label: directedMatch[3] ? directedMatch[3].trim() : '',
        });
        continue;
      }

      // Association: A -- B
      var assocMatch = line.match(/^(\S+)\s+--\s+(\S+)\s*(?::\s*(.*))?$/);
      if (assocMatch) {
        relationships.push({
          from: assocMatch[1],
          to: assocMatch[2],
          type: 'association',
          label: assocMatch[3] ? assocMatch[3].trim() : '',
        });
        continue;
      }
    }

    // Resolve system members that were bare aliases not yet defined at parse time
    for (var si = 0; si < systems.length; si++) {
      var resolved = [];
      for (var mi = 0; mi < systems[si].members.length; mi++) {
        var mid = resolveId(systems[si].members[mi]);
        if (resolved.indexOf(mid) === -1) resolved.push(mid);
      }
      systems[si].members = resolved;
    }

    // Convert to arrays
    var actorList = [];
    for (var ak in actors) actorList.push(actors[ak]);
    var usecaseList = [];
    for (var uk in usecases) usecaseList.push(usecases[uk]);

    return {
      actors: actorList,
      usecases: usecaseList,
      systems: systems,
      relationships: relationships,
      notes: notes,
      direction: direction,
      actorMap: actors,
      usecaseMap: usecases,
      aliasToId: aliasToId,
    };
  }

  // ─── Measurement ──────────────────────────────────────────────────

  function measureActor(a) {
    var labelW = UMLShared.textWidth(a.name, false, CFG.fontSize);
    var w = Math.max(CFG.actorW, labelW + 10);
    var h = UMLShared.ACTOR_H + CFG.actorLabelGap + CFG.lineHeight;
    return { width: Math.ceil(w), height: Math.ceil(h) };
  }

  function measureUseCase(uc) {
    var textW = UMLShared.textWidth(uc.name, false, CFG.fontSize);
    var w = Math.max(CFG.ellipseMinW, textW + CFG.ellipsePadX * 2);
    var h = Math.max(CFG.ellipseMinH, CFG.fontSize + CFG.ellipsePadY * 2);
    return { width: Math.ceil(w), height: Math.ceil(h) };
  }

  // ─── Layout ───────────────────────────────────────────────────────

  function computeLayout(parsed) {
    var actors = parsed.actors;
    var usecases = parsed.usecases;
    var relationships = parsed.relationships;
    if (actors.length === 0 && usecases.length === 0) {
      return { entries: {}, width: 0, height: 0, offsetX: 0, offsetY: 0 };
    }

    var entries = {};

    // Measure all elements
    for (var ai = 0; ai < actors.length; ai++) {
      var a = actors[ai];
      var aBox = measureActor(a);
      entries[a.id] = { type: 'actor', data: a, box: aBox, x: 0, y: 0 };
    }
    for (var ui = 0; ui < usecases.length; ui++) {
      var uc = usecases[ui];
      var ucBox = measureUseCase(uc);
      entries[uc.id] = { type: 'usecase', data: uc, box: ucBox, x: 0, y: 0 };
    }

    // Build nodes and edges for layout engine
    var layoutNodes = [];
    var layoutEdges = [];
    for (var eid in entries) {
      var e = entries[eid];
      layoutNodes.push({ id: eid, width: e.box.width, height: e.box.height });
    }
    for (var ri = 0; ri < relationships.length; ri++) {
      var rel = relationships[ri];
      var fromId = parsed.aliasToId[rel.from] || rel.from;
      var toId = parsed.aliasToId[rel.to] || rel.to;
      if (!entries[fromId] || !entries[toId]) continue;
      var edgeType = 'navigable';
      if (rel.type === 'generalization') edgeType = 'generalization';
      else if (rel.type === 'dependency') edgeType = 'dependency';
      layoutEdges.push({ source: fromId, target: toId, type: edgeType, data: rel });
    }

    var result = window.UMLAdvancedLayout.compute(layoutNodes, layoutEdges, {
      gapX: CFG.gapX,
      gapY: CFG.gapY,
      direction: parsed.direction || 'LR',
    });

    // Map positions back
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var nid in result.nodes) {
      if (!entries[nid]) continue;
      entries[nid].x = result.nodes[nid].x;
      entries[nid].y = result.nodes[nid].y;
      minX = Math.min(minX, entries[nid].x);
      minY = Math.min(minY, entries[nid].y);
      maxX = Math.max(maxX, entries[nid].x + entries[nid].box.width);
      maxY = Math.max(maxY, entries[nid].y + entries[nid].box.height);
    }

    return {
      entries: entries,
      width: maxX - minX,
      height: maxY - minY,
      offsetX: -minX,
      offsetY: -minY,
      layoutResult: result,
    };
  }

  // ─── SVG Renderer ─────────────────────────────────────────────────

  function generateSVG(layout, parsed, colors) {
    var entries = layout.entries;
    var relationships = parsed.relationships;

    // ── Compute system boundary boxes ──
    var systemBoxes = [];
    for (var si = 0; si < parsed.systems.length; si++) {
      var sys = parsed.systems[si];
      var sMinX = Infinity, sMinY = Infinity, sMaxX = -Infinity, sMaxY = -Infinity;
      var hasMember = false;
      for (var mi = 0; mi < sys.members.length; mi++) {
        var mid = parsed.aliasToId[sys.members[mi]] || sys.members[mi];
        var me = entries[mid];
        if (!me) continue;
        hasMember = true;
        sMinX = Math.min(sMinX, me.x);
        sMinY = Math.min(sMinY, me.y);
        sMaxX = Math.max(sMaxX, me.x + me.box.width);
        sMaxY = Math.max(sMaxY, me.y + me.box.height);
      }
      if (hasMember) {
        var titleW = UMLShared.textWidth(sys.name, true, CFG.fontSizeBold);
        var boxW = Math.max(sMaxX - sMinX + CFG.sysPadX * 2, titleW + CFG.sysPadX * 2);
        systemBoxes.push({
          name: sys.name,
          x: sMinX - CFG.sysPadX,
          y: sMinY - CFG.sysPadY - CFG.sysTitlePadY,
          width: boxW,
          height: sMaxY - sMinY + CFG.sysPadY * 2 + CFG.sysTitlePadY,
        });
      }
    }

    // Expand SVG bounds for system boxes
    var extraLeft = 0, extraRight = 0, extraTop = 0, extraBottom = 0;
    for (var sbi = 0; sbi < systemBoxes.length; sbi++) {
      var sb = systemBoxes[sbi];
      if (sb.x < -layout.offsetX) extraLeft = Math.max(extraLeft, -layout.offsetX - sb.x + CFG.svgPad);
      var sbr = sb.x + sb.width - layout.width + layout.offsetX;
      if (sbr > 0) extraRight = Math.max(extraRight, sbr + CFG.svgPad);
      if (sb.y < -layout.offsetY) extraTop = Math.max(extraTop, -layout.offsetY - sb.y + CFG.svgPad);
      var sbb = sb.y + sb.height - layout.height + layout.offsetY;
      if (sbb > 0) extraBottom = Math.max(extraBottom, sbb + CFG.svgPad);
    }

    // ── Pre-compute note positions ──
    var notePositions = [];
    if (parsed.notes) {
      var noteGap = UMLShared.NOTE_CFG.gap;
      for (var npi = 0; npi < parsed.notes.length; npi++) {
        var pn = parsed.notes[npi];
        var tgtId = parsed.aliasToId[pn.target] || pn.target;
        var tgtE = entries[tgtId];
        if (!tgtE) continue;
        var ns = UMLShared.measureNote(pn.lines);
        var nx, ny;
        var tx = tgtE.x, ty = tgtE.y, tw = tgtE.box.width, th = tgtE.box.height;
        if (pn.position === 'right') { nx = tx + tw + noteGap; ny = ty; }
        else if (pn.position === 'left') { nx = tx - ns.width - noteGap; ny = ty; }
        else if (pn.position === 'top') { nx = tx; ny = ty - ns.height - noteGap; }
        else { nx = tx; ny = ty + th + noteGap; }
        notePositions.push({ note: pn, x: nx, y: ny, w: ns.width, h: ns.height, tx: tx, ty: ty, tw: tw, th: th });
      }
    }
    for (var nbi = 0; nbi < notePositions.length; nbi++) {
      var npb = notePositions[nbi];
      if (npb.x < -layout.offsetX) extraLeft = Math.max(extraLeft, -layout.offsetX - npb.x + CFG.svgPad);
      var nr = npb.x + npb.w - (layout.width - layout.offsetX);
      if (nr > 0) extraRight = Math.max(extraRight, nr + CFG.svgPad);
      if (npb.y < -layout.offsetY) extraTop = Math.max(extraTop, -layout.offsetY - npb.y + CFG.svgPad);
      var nb = npb.y + npb.h - (layout.height - layout.offsetY);
      if (nb > 0) extraBottom = Math.max(extraBottom, nb + CFG.svgPad);
    }

    var ox = layout.offsetX + CFG.svgPad + extraLeft;
    var oy = layout.offsetY + CFG.svgPad + extraTop;
    var svgW = layout.width + CFG.svgPad * 2 + extraLeft + extraRight;
    var svgH = layout.height + CFG.svgPad * 2 + extraTop + extraBottom;

    var svg = [];
    var labelSvg = [];
    svg.push(UMLShared.svgOpen(svgW, svgH, ox, oy, CFG.fontFamily));

    // ── Draw system boundaries (behind everything) ──
    for (var sbi2 = 0; sbi2 < systemBoxes.length; sbi2++) {
      var sbox = systemBoxes[sbi2];
      svg.push('<rect x="' + sbox.x + '" y="' + sbox.y + '" width="' + sbox.width + '" height="' + sbox.height +
        '" rx="' + CFG.sysRx + '" ry="' + CFG.sysRx +
        '" fill="' + colors.fill + '" stroke="' + colors.stroke + '" stroke-width="' + CFG.strokeWidth + '"/>');
      // System title
      svg.push('<text x="' + (sbox.x + sbox.width / 2) + '" y="' + (sbox.y + CFG.sysTitlePadY - 6) +
        '" text-anchor="middle" font-weight="bold" font-size="' + CFG.fontSizeBold + '" fill="' + colors.text + '">' +
        UMLShared.escapeXml(sbox.name) + '</text>');
    }

    // ── Draw relationships ──
    for (var ri = 0; ri < relationships.length; ri++) {
      var rel = relationships[ri];
      var fromId = parsed.aliasToId[rel.from] || rel.from;
      var toId = parsed.aliasToId[rel.to] || rel.to;
      var fromE = entries[fromId];
      var toE = entries[toId];
      if (!fromE || !toE) continue;

      var fromCx = fromE.x + fromE.box.width / 2;
      var fromCy = fromE.y + fromE.box.height / 2;
      var toCx = toE.x + toE.box.width / 2;
      var toCy = toE.y + toE.box.height / 2;

      // Compute intersection points with element boundaries
      var p1 = clipToElement(fromE, fromCx, fromCy, toCx, toCy);
      var p2 = clipToElement(toE, toCx, toCy, fromCx, fromCy);

      var isDashed = rel.type === 'dependency';
      var dashAttr = isDashed ? ' stroke-dasharray="6,4"' : '';

      // Draw line
      svg.push('<line x1="' + p1.x + '" y1="' + p1.y + '" x2="' + p2.x + '" y2="' + p2.y +
        '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"' + dashAttr + '/>');

      // Arrowhead at target
      var adx = p2.x - p1.x, ady = p2.y - p1.y;
      var alen = Math.sqrt(adx * adx + ady * ady);
      if (alen > 0) { adx /= alen; ady /= alen; }

      if (rel.type === 'directed') {
        drawFilledArrow(svg, p2.x, p2.y, -adx, -ady, colors.line);
      } else if (rel.type === 'dependency') {
        drawOpenArrow(svg, p2.x, p2.y, -adx, -ady, colors.line);
      } else if (rel.type === 'generalization') {
        drawHollowTriangle(svg, p2.x, p2.y, -adx, -ady, colors);
      }
      // 'association' has no arrowhead

      // Label
      if (rel.label) {
        var lx = (p1.x + p2.x) / 2;
        var ly = (p1.y + p2.y) / 2 - 8;
        labelSvg.push('<text x="' + lx + '" y="' + ly +
          '" text-anchor="middle" font-size="' + CFG.fontSize + '" fill="' + colors.text +
          '" stroke="' + colors.fill + '" stroke-width="4" stroke-opacity="0.85" stroke-linejoin="round" paint-order="stroke">' +
          UMLShared.escapeXml(rel.label) + '</text>');
      }
    }

    // ── Draw use case ellipses ──
    for (var eid in entries) {
      var e = entries[eid];
      if (e.type !== 'usecase') continue;
      var cx = e.x + e.box.width / 2;
      var cy = e.y + e.box.height / 2;
      var rx = e.box.width / 2;
      var ry = e.box.height / 2;
      svg.push('<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry +
        '" fill="' + colors.fill + '" stroke="' + colors.stroke + '" stroke-width="' + CFG.strokeWidth + '"/>');
      svg.push('<text x="' + cx + '" y="' + (cy + CFG.fontSize * 0.35) +
        '" text-anchor="middle" font-size="' + CFG.fontSize + '" fill="' + colors.text + '">' +
        UMLShared.escapeXml(e.data.name) + '</text>');
    }

    // ── Draw actors ──
    for (var eid2 in entries) {
      var e2 = entries[eid2];
      if (e2.type !== 'actor') continue;
      var aCx = e2.x + e2.box.width / 2;
      var aTopY = e2.y;
      UMLShared.drawActorStickFigure(svg, aCx, aTopY, colors, CFG.strokeWidth);
      // Label below stick figure
      var labelY = aTopY + UMLShared.ACTOR_H + CFG.actorLabelGap + CFG.fontSize * 0.75;
      svg.push('<text x="' + aCx + '" y="' + labelY +
        '" text-anchor="middle" font-size="' + CFG.fontSize + '" fill="' + colors.text + '">' +
        UMLShared.escapeXml(e2.data.name) + '</text>');
    }

    // ── Draw labels on top ──
    for (var li = 0; li < labelSvg.length; li++) {
      svg.push(labelSvg[li]);
    }

    // ── Draw notes ──
    for (var ni = 0; ni < notePositions.length; ni++) {
      var np2 = notePositions[ni];
      var cF, cT;
      if (np2.note.position === 'right') {
        cF = { x: np2.x, y: np2.y + np2.h / 2 };
        cT = { x: np2.tx + np2.tw, y: np2.ty + np2.th / 2 };
      } else if (np2.note.position === 'left') {
        cF = { x: np2.x + np2.w, y: np2.y + np2.h / 2 };
        cT = { x: np2.tx, y: np2.ty + np2.th / 2 };
      } else if (np2.note.position === 'top') {
        cF = { x: np2.x + np2.w / 2, y: np2.y + np2.h };
        cT = { x: np2.tx + np2.tw / 2, y: np2.ty };
      } else {
        cF = { x: np2.x + np2.w / 2, y: np2.y };
        cT = { x: np2.tx + np2.tw / 2, y: np2.ty + np2.th };
      }
      UMLShared.drawNote(svg, np2.x, np2.y, np2.note.lines, colors, {
        fromX: cF.x, fromY: cF.y, toX: cT.x, toY: cT.y,
      });
    }

    svg.push(UMLShared.svgClose());
    return svg.join('\n');
  }

  // ─── Geometry Helpers ─────────────────────────────────────────────

  /**
   * Clip a line from (cx,cy) toward (tx,ty) to the boundary of the element.
   * Returns the intersection point on the element edge.
   */
  function clipToElement(entry, cx, cy, tx, ty) {
    if (entry.type === 'usecase') {
      return clipToEllipse(cx, cy, entry.box.width / 2, entry.box.height / 2, tx, ty);
    }
    // Actor: approximate as a rectangle
    return clipToRect(entry.x, entry.y, entry.box.width, entry.box.height, cx, cy, tx, ty);
  }

  /**
   * Clip a line from ellipse center (cx,cy) to point (tx,ty) to the ellipse boundary.
   */
  function clipToEllipse(cx, cy, rx, ry, tx, ty) {
    var dx = tx - cx;
    var dy = ty - cy;
    if (dx === 0 && dy === 0) return { x: cx + rx, y: cy };
    var angle = Math.atan2(dy, dx);
    return {
      x: cx + rx * Math.cos(angle),
      y: cy + ry * Math.sin(angle),
    };
  }

  /**
   * Clip a line from inside rect at (cx,cy) toward (tx,ty) to the rectangle boundary.
   */
  function clipToRect(rx, ry, rw, rh, cx, cy, tx, ty) {
    var dx = tx - cx;
    var dy = ty - cy;
    if (dx === 0 && dy === 0) return { x: cx, y: cy };

    var halfW = rw / 2;
    var halfH = rh / 2;
    var rcx = rx + halfW;
    var rcy = ry + halfH;

    // Parametric intersection with rect edges
    var t = Infinity;
    // Right edge
    if (dx > 0) t = Math.min(t, (rcx + halfW - cx) / dx);
    // Left edge
    if (dx < 0) t = Math.min(t, (rcx - halfW - cx) / dx);
    // Bottom edge
    if (dy > 0) t = Math.min(t, (rcy + halfH - cy) / dy);
    // Top edge
    if (dy < 0) t = Math.min(t, (rcy - halfH - cy) / dy);

    if (t === Infinity) t = 0;
    return { x: cx + dx * t, y: cy + dy * t };
  }

  // ─── Arrow Drawing ────────────────────────────────────────────────

  /**
   * Filled arrowhead (for directed association).
   */
  function drawFilledArrow(svg, x, y, ux, uy, color) {
    var as = CFG.arrowSize;
    var hw = as * 0.35;
    var px = -uy, py = ux;
    svg.push('<polygon points="' +
      x + ',' + y + ' ' +
      (x + ux * as + px * hw) + ',' + (y + uy * as + py * hw) + ' ' +
      (x + ux * as - px * hw) + ',' + (y + uy * as - py * hw) +
      '" fill="' + color + '" stroke="none"/>');
  }

  /**
   * Open arrowhead (for dependency / include / extend).
   */
  function drawOpenArrow(svg, x, y, ux, uy, color) {
    var as = CFG.arrowSize;
    var hw = as * 0.35;
    var px = -uy, py = ux;
    svg.push('<polyline points="' +
      (x + ux * as + px * hw) + ',' + (y + uy * as + py * hw) + ' ' +
      x + ',' + y + ' ' +
      (x + ux * as - px * hw) + ',' + (y + uy * as - py * hw) +
      '" fill="none" stroke="' + color + '" stroke-width="' + CFG.strokeWidth + '"/>');
  }

  /**
   * Hollow triangle arrowhead (for generalization).
   */
  function drawHollowTriangle(svg, x, y, ux, uy, colors) {
    var as = CFG.arrowSize * 1.2;
    var hw = as * 0.45;
    var px = -uy, py = ux;
    svg.push('<polygon points="' +
      x + ',' + y + ' ' +
      (x + ux * as + px * hw) + ',' + (y + uy * as + py * hw) + ' ' +
      (x + ux * as - px * hw) + ',' + (y + uy * as - py * hw) +
      '" fill="' + colors.fill + '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"/>');
  }

  // ─── Public API ───────────────────────────────────────────────────

  function render(container, text) {
    var parsed = parse(text);
    if (parsed.actors.length === 0 && parsed.usecases.length === 0) {
      container.innerHTML = '<div style="padding:20px;color:#888;text-align:center;">No elements to display.</div>';
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

  UMLShared.createAutoInit('pre > code.language-uml-usecase', render);
  window.UMLUseCaseDiagram = { render: render, parse: parse };
})();
