/**
 * UML Activity Diagram Renderer
 *
 * Text format:
 *   @startuml
 *   (*) --> "Receive Order"
 *   "Receive Order" --> "Validate Payment"
 *   if "Payment Valid?" then
 *     --> [yes] "Process Order"
 *   else
 *     --> [no] "Reject Order"
 *   endif
 *   "Process Order" --> "Ship Order"
 *   "Reject Order" --> (*)
 *   "Ship Order" --> (*)
 *   @enduml
 *
 * Notation:
 *   (*)              Initial node (source) / Final node (target)
 *   "Name"           Action node (rounded rectangle)
 *   if/else/endif    Decision/merge diamond
 *   fork/endfork     Fork/join bars
 *   |LaneName|       Swimlane assignment
 *   --> [guard] ...  Guard condition on control flow
 *   note left/right of Target : text   Note annotation
 */
(function () {
  'use strict';

  var CFG = {
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    fontSize: 14,
    fontSizeBold: 15,
    lineHeight: 22,
    padX: 20,
    padY: 10,
    actionMinW: 120,
    actionRx: 12,
    initialR: 8,
    finalR: 6,
    finalRingR: 11,
    diamondSize: 18,
    forkBarH: 4,
    forkBarMinW: 60,
    gapX: 80,
    gapY: 70,
    arrowSize: 10,
    strokeWidth: 1.5,
    svgPad: 30,
    labelBgPad: 4,
    laneHeaderH: 32,
    lanePadX: 20,
  };

  // ─── Parser ───────────────────────────────────────────────────────

  function parse(text) {
    var lines = text.split('\n');
    var nodes = {};       // id -> { id, type, label, lane }
    var edges = [];       // { from, to, guard }
    var notes = [];
    var lanes = [];       // ordered lane names
    var laneSet = {};     // name -> true
    var currentLane = null;
    var currentNode = null;
    var direction = 'TB';

    var actionCount = 0;
    var decisionCount = 0;
    var forkCount = 0;
    var finalCount = 0;
    var mergeCount = 0;

    // Decision stack for if/else/endif nesting
    var decisionStack = [];

    function ensureNode(id, type, label) {
      if (!nodes[id]) {
        nodes[id] = { id: id, type: type || 'action', label: label || id, lane: currentLane };
      }
      return nodes[id];
    }

    function actionId(label) {
      // Use a stable ID based on the label text
      var candidate = 'action_' + label.replace(/[^a-zA-Z0-9]/g, '_');
      if (!nodes[candidate]) return candidate;
      // If collision, append counter
      actionCount++;
      return candidate + '_' + actionCount;
    }

    function findNodeByLabel(label) {
      for (var k in nodes) {
        if (nodes[k].label === label) return nodes[k];
      }
      return null;
    }

    function getOrCreateAction(label) {
      var existing = findNodeByLabel(label);
      if (existing) {
        // Update lane if we are in a new lane context
        if (currentLane && !existing.lane) existing.lane = currentLane;
        return existing;
      }
      var id = actionId(label);
      var n = ensureNode(id, 'action', label);
      n.lane = currentLane;
      return n;
    }

    function addEdge(fromId, toId, guard) {
      edges.push({ from: fromId, to: toId, guard: guard || '' });
    }

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

      // Note
      var noteIdx = UMLShared.parseNoteLine(line, lines, i, notes);
      if (noteIdx >= 0) { i = noteIdx; continue; }

      // Swimlane: |LaneName|
      var laneMatch = line.match(/^\|([^|]+)\|$/);
      if (laneMatch) {
        currentLane = laneMatch[1].trim();
        if (!laneSet[currentLane]) {
          laneSet[currentLane] = true;
          lanes.push(currentLane);
        }
        continue;
      }

      // Fork
      if (/^fork$/i.test(line)) {
        forkCount++;
        var forkId = 'fork_' + forkCount;
        ensureNode(forkId, 'fork', '');
        nodes[forkId].lane = currentLane;
        if (currentNode) {
          addEdge(currentNode, forkId);
        }
        // Push fork context: collect branches until endfork
        decisionStack.push({ type: 'fork', forkId: forkId, branches: [], currentBranch: null });
        currentNode = forkId;
        continue;
      }

      // Endfork
      if (/^end\s*fork$/i.test(line)) {
        var forkCtx = null;
        for (var fi = decisionStack.length - 1; fi >= 0; fi--) {
          if (decisionStack[fi].type === 'fork') {
            forkCtx = decisionStack.splice(fi, 1)[0];
            break;
          }
        }
        if (forkCtx) {
          forkCount++;
          var joinId = 'join_' + forkCount;
          ensureNode(joinId, 'join', '');
          nodes[joinId].lane = currentLane;
          // Connect all branch endpoints to the join bar
          for (var bi = 0; bi < forkCtx.branches.length; bi++) {
            var branchEnd = forkCtx.branches[bi];
            if (branchEnd) addEdge(branchEnd, joinId);
          }
          currentNode = joinId;
        }
        continue;
      }

      // if "Condition?" then
      var ifMatch = line.match(/^if\s+"([^"]+)"\s+then$/i);
      if (ifMatch) {
        decisionCount++;
        var decId = 'decision_' + decisionCount;
        ensureNode(decId, 'decision', ifMatch[1]);
        nodes[decId].lane = currentLane;
        if (currentNode) {
          addEdge(currentNode, decId);
        }
        decisionStack.push({
          type: 'decision',
          decisionId: decId,
          thenEnd: null,
          elseEnd: null,
          inThen: true,
        });
        currentNode = decId;
        continue;
      }

      // else
      if (/^else$/i.test(line)) {
        var decCtx = null;
        for (var di = decisionStack.length - 1; di >= 0; di--) {
          if (decisionStack[di].type === 'decision') {
            decCtx = decisionStack[di];
            break;
          }
        }
        if (decCtx) {
          decCtx.thenEnd = currentNode;
          decCtx.inThen = false;
          currentNode = decCtx.decisionId;
        }
        continue;
      }

      // endif
      if (/^endif$/i.test(line)) {
        var decCtx2 = null;
        var decIdx = -1;
        for (var di2 = decisionStack.length - 1; di2 >= 0; di2--) {
          if (decisionStack[di2].type === 'decision') {
            decCtx2 = decisionStack[di2];
            decIdx = di2;
            break;
          }
        }
        if (decCtx2) {
          if (decCtx2.inThen) {
            decCtx2.thenEnd = currentNode;
          } else {
            decCtx2.elseEnd = currentNode;
          }
          // Create implicit merge node
          mergeCount++;
          var mergeId = 'merge_' + mergeCount;
          ensureNode(mergeId, 'merge', '');
          nodes[mergeId].lane = currentLane;
          // Connect then-branch end and else-branch end to merge
          if (decCtx2.thenEnd && !isFinalNode(decCtx2.thenEnd)) {
            addEdge(decCtx2.thenEnd, mergeId);
          }
          if (decCtx2.elseEnd && !isFinalNode(decCtx2.elseEnd)) {
            addEdge(decCtx2.elseEnd, mergeId);
          }
          currentNode = mergeId;
          decisionStack.splice(decIdx, 1);
        }
        continue;
      }

      // Transition line: --> [guard] "Name"  (continuation from currentNode)
      var contMatch = line.match(/^-->\s*(?:\[([^\]]*)\]\s*)?"([^"]+)"$/);
      if (contMatch) {
        var guard = contMatch[1] || '';
        var targetLabel = contMatch[2];
        var targetNode = getOrCreateAction(targetLabel);
        if (currentNode) {
          addEdge(currentNode, targetNode.id, guard);
        }
        // If inside a fork context, record branch endpoint
        var topCtx = decisionStack.length > 0 ? decisionStack[decisionStack.length - 1] : null;
        if (topCtx && topCtx.type === 'fork') {
          topCtx.branches.push(targetNode.id);
          // Don't update currentNode — each fork branch is independent
        } else {
          currentNode = targetNode.id;
        }
        continue;
      }

      // Continuation to final: --> [guard] (*)
      var contFinalMatch = line.match(/^-->\s*(?:\[([^\]]*)\]\s*)?\(\*\)$/);
      if (contFinalMatch) {
        var fGuard = contFinalMatch[1] || '';
        finalCount++;
        var fId = '__final__' + finalCount;
        ensureNode(fId, 'final', '');
        nodes[fId].lane = currentLane;
        if (currentNode) {
          addEdge(currentNode, fId, fGuard);
        }
        // Inside fork, record branch endpoint
        var topCtx2 = decisionStack.length > 0 ? decisionStack[decisionStack.length - 1] : null;
        if (topCtx2 && topCtx2.type === 'fork') {
          topCtx2.branches.push(fId);
        }
        continue;
      }

      // Full transition: (*) --> "Name"
      var initialMatch = line.match(/^\(\*\)\s*-->\s*(?:\[([^\]]*)\]\s*)?"([^"]+)"$/);
      if (initialMatch) {
        if (!nodes['__initial__']) {
          ensureNode('__initial__', 'initial', '');
          nodes['__initial__'].lane = currentLane;
        }
        var tgt = getOrCreateAction(initialMatch[2]);
        addEdge('__initial__', tgt.id, initialMatch[1] || '');
        currentNode = tgt.id;
        continue;
      }

      // Full transition: "Name" --> (*)
      var toFinalMatch = line.match(/^"([^"]+)"\s*-->\s*(?:\[([^\]]*)\]\s*)?\(\*\)$/);
      if (toFinalMatch) {
        var srcNode = getOrCreateAction(toFinalMatch[1]);
        finalCount++;
        var ffId = '__final__' + finalCount;
        ensureNode(ffId, 'final', '');
        nodes[ffId].lane = currentLane;
        addEdge(srcNode.id, ffId, toFinalMatch[2] || '');
        currentNode = ffId;
        continue;
      }

      // Full transition: "From" --> [guard] "To"
      var transMatch = line.match(/^"([^"]+)"\s*-->\s*(?:\[([^\]]*)\]\s*)?"([^"]+)"$/);
      if (transMatch) {
        var fromNode = getOrCreateAction(transMatch[1]);
        var toNode = getOrCreateAction(transMatch[3]);
        addEdge(fromNode.id, toNode.id, transMatch[2] || '');
        currentNode = toNode.id;
        continue;
      }

      // Full transition: (*) --> (*) — edge case, initial to final directly
      var initFinalMatch = line.match(/^\(\*\)\s*-->\s*\(\*\)$/);
      if (initFinalMatch) {
        if (!nodes['__initial__']) {
          ensureNode('__initial__', 'initial', '');
          nodes['__initial__'].lane = currentLane;
        }
        finalCount++;
        var dfId = '__final__' + finalCount;
        ensureNode(dfId, 'final', '');
        nodes[dfId].lane = currentLane;
        addEdge('__initial__', dfId);
        currentNode = dfId;
        continue;
      }
    }

    // Convert to array
    var nodeList = [];
    for (var k in nodes) nodeList.push(nodes[k]);

    return { nodes: nodeList, edges: edges, notes: notes, lanes: lanes, direction: direction };
  }

  function isFinalNode(id) {
    return id && id.indexOf('__final__') === 0;
  }

  // ─── Layout ───────────────────────────────────────────────────────

  function measureNode(n) {
    if (n.type === 'initial') return { width: CFG.initialR * 2, height: CFG.initialR * 2 };
    if (n.type === 'final') return { width: CFG.finalRingR * 2 + 4, height: CFG.finalRingR * 2 + 4 };
    if (n.type === 'decision' || n.type === 'merge') {
      if (n.type === 'decision' && n.label) {
        var tw = UMLShared.textWidth(n.label, false, CFG.fontSize);
        var ds = Math.max(CFG.diamondSize, (tw + 16) / 1.41);
        return { width: Math.ceil(ds * 2), height: Math.ceil(ds * 2) };
      }
      return { width: CFG.diamondSize * 2, height: CFG.diamondSize * 2 };
    }
    if (n.type === 'fork' || n.type === 'join') {
      return { width: CFG.forkBarMinW, height: CFG.forkBarH };
    }

    // Action node
    var nameW = UMLShared.textWidth(n.label, true, CFG.fontSizeBold);
    var width = Math.max(CFG.actionMinW, nameW + CFG.padX * 2);
    var height = CFG.padY * 2 + CFG.lineHeight;
    return { width: Math.ceil(width), height: Math.ceil(height) };
  }

  function computeLayout(parsed) {
    var nodeList = parsed.nodes;
    var edgeList = parsed.edges;
    if (nodeList.length === 0) return { entries: {}, width: 0, height: 0, offsetX: 0, offsetY: 0 };

    var entries = {};

    // Measure all nodes
    for (var i = 0; i < nodeList.length; i++) {
      var n = nodeList[i];
      var box = measureNode(n);
      entries[n.id] = { node: n, box: box, x: 0, y: 0 };
    }

    // Build layout input
    var layoutNodes = [];
    var layoutEdges = [];
    for (var li = 0; li < nodeList.length; li++) {
      var le = entries[nodeList[li].id];
      layoutNodes.push({ id: nodeList[li].id, width: le.box.width, height: le.box.height });
    }
    for (var ei = 0; ei < edgeList.length; ei++) {
      layoutEdges.push({ source: edgeList[ei].from, target: edgeList[ei].to, type: 'navigable' });
    }

    var result = window.UMLAdvancedLayout.compute(layoutNodes, layoutEdges, {
      gapX: CFG.gapX,
      gapY: CFG.gapY,
      direction: parsed.direction || 'TB',
    });

    // Map coords back
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var nm in result.nodes) {
      if (!entries[nm]) continue;
      entries[nm].x = result.nodes[nm].x;
      entries[nm].y = result.nodes[nm].y;
      minX = Math.min(minX, entries[nm].x);
      minY = Math.min(minY, entries[nm].y);
      maxX = Math.max(maxX, entries[nm].x + entries[nm].box.width);
      maxY = Math.max(maxY, entries[nm].y + entries[nm].box.height);
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

  function generateSVG(layout, parsed, colors) {
    var entries = layout.entries;
    var edgeList = parsed.edges;
    var lanes = parsed.lanes;

    // ── Compute swimlane boundaries ──
    var laneInfo = null;
    if (lanes.length > 0) {
      laneInfo = computeSwimlaneBounds(entries, lanes, layout);
    }

    // ── Compute note positions ──
    var notePositions = [];
    if (parsed.notes) {
      var noteGap = UMLShared.NOTE_CFG.gap;
      for (var npi = 0; npi < parsed.notes.length; npi++) {
        var pn = parsed.notes[npi];
        var tgt = resolveTarget(pn.target, entries);
        if (!tgt) continue;
        var ns = UMLShared.measureNote(pn.lines);
        var nx, ny;
        if (pn.position === 'right') { nx = tgt.x + tgt.w + noteGap; ny = tgt.y; }
        else if (pn.position === 'left') { nx = tgt.x - ns.width - noteGap; ny = tgt.y; }
        else if (pn.position === 'top') { nx = tgt.x; ny = tgt.y - ns.height - noteGap; }
        else { nx = tgt.x; ny = tgt.y + tgt.h + noteGap; }
        notePositions.push({ note: pn, x: nx, y: ny, w: ns.width, h: ns.height, tx: tgt.x, ty: tgt.y, tw: tgt.w, th: tgt.h });
      }
    }

    // ── Compute extra space for notes ──
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

    // ── Extra space for swimlane headers ──
    var laneExtraTop = 0;
    if (laneInfo) {
      laneExtraTop = CFG.laneHeaderH;
    }

    var ox = layout.offsetX + CFG.svgPad + noteExtraL;
    var oy = layout.offsetY + CFG.svgPad + noteExtraT + laneExtraTop;
    var svgW = layout.width + CFG.svgPad * 2 + noteExtraL + noteExtraR;
    var svgH = layout.height + CFG.svgPad * 2 + noteExtraT + noteExtraB + laneExtraTop;

    // Widen for swimlanes if needed
    if (laneInfo) {
      var lanesRight = laneInfo.totalWidth - layout.width;
      if (lanesRight > 0) svgW += lanesRight;
    }

    var svg = [];
    var labelSvg = [];
    svg.push(UMLShared.svgOpen(svgW, svgH, ox, oy, CFG.fontFamily));

    // ── Draw swimlanes (behind everything) ──
    if (laneInfo) {
      var laneTopY = -layout.offsetY - laneExtraTop;
      var laneBotY = layout.height - layout.offsetY + CFG.svgPad / 2;
      var laneH = laneBotY - laneTopY;
      var laneColors = ['#f0f4fa', '#e8edf5'];

      for (var li = 0; li < laneInfo.lanes.length; li++) {
        var ln = laneInfo.lanes[li];
        var laneColor = laneColors[li % laneColors.length];
        // Lane background
        svg.push('<rect x="' + ln.x + '" y="' + laneTopY + '" width="' + ln.width + '" height="' + laneH +
          '" fill="' + laneColor + '" stroke="' + colors.stroke + '" stroke-width="0.5" opacity="0.5"/>');
        // Lane header
        svg.push('<rect x="' + ln.x + '" y="' + laneTopY + '" width="' + ln.width + '" height="' + CFG.laneHeaderH +
          '" fill="' + colors.headerFill + '" stroke="' + colors.stroke + '" stroke-width="' + CFG.strokeWidth + '"/>');
        svg.push('<text x="' + (ln.x + ln.width / 2) + '" y="' + (laneTopY + CFG.laneHeaderH / 2 + CFG.fontSize * 0.35) +
          '" text-anchor="middle" font-weight="bold" font-size="' + CFG.fontSizeBold + '" fill="' + colors.text + '">' +
          UMLShared.escapeXml(ln.name) + '</text>');
      }
    }

    // ── Pre-compute distributed exit points ──
    var customExits = {};
    var maxBoundsX = 0;
    for (var en0 in entries) {
      maxBoundsX = Math.max(maxBoundsX, entries[en0].x + entries[en0].box.width);
    }
    var routeMarginX = maxBoundsX + CFG.gapX * 0.4;

    var downByFrom = {};
    for (var ti0 = 0; ti0 < edgeList.length; ti0++) {
      var tr0 = edgeList[ti0];
      if (!entries[tr0.from] || !entries[tr0.to] || tr0.from === tr0.to) continue;
      var fe0 = entries[tr0.from], te0 = entries[tr0.to];
      if ((te0.y + te0.box.height / 2) > (fe0.y + fe0.box.height / 2)) {
        if (!downByFrom[tr0.from]) downByFrom[tr0.from] = [];
        downByFrom[tr0.from].push(ti0);
      }
    }
    for (var fname in downByFrom) {
      var dgroup = downByFrom[fname];
      if (dgroup.length < 2) continue;
      var fe = entries[fname];
      dgroup.sort(function (a, b) {
        var ta = edgeList[a], tb = edgeList[b];
        var cxa = entries[ta.to] ? entries[ta.to].x + entries[ta.to].box.width / 2 : 0;
        var cxb = entries[tb.to] ? entries[tb.to].x + entries[tb.to].box.width / 2 : 0;
        return cxa - cxb;
      });
      for (var dgi = 0; dgi < dgroup.length; dgi++) {
        var exitX = fe.x + fe.box.width * (dgi + 1) / (dgroup.length + 1);
        customExits[dgroup[dgi]] = { x: exitX, y: fe.y + fe.box.height };
      }
    }

    // ── Draw edges ──
    for (var ti = 0; ti < edgeList.length; ti++) {
      var tr = edgeList[ti];
      var fromE = entries[tr.from];
      var toE = entries[tr.to];
      if (!fromE || !toE) continue;

      var fromCx = fromE.x + fromE.box.width / 2;
      var fromCy = fromE.y + fromE.box.height / 2;
      var toCx = toE.x + toE.box.width / 2;
      var toCy = toE.y + toE.box.height / 2;

      var x1, y1, x2, y2;
      var dx = toCx - fromCx, dy = toCy - fromCy;
      var isBackEdge = false;
      var isHorizontal = false;

      if (customExits[ti]) {
        x1 = customExits[ti].x; y1 = customExits[ti].y;
        x2 = toCx; y2 = toE.y;
      } else if (dy < -10) {
        // Back-edge going upward
        x1 = fromE.x + fromE.box.width; y1 = fromCy;
        x2 = toE.x + toE.box.width; y2 = toCy;
        isBackEdge = true;
      } else if (Math.abs(dy) >= Math.abs(dx) * 0.5) {
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
        isHorizontal = true;
      }

      var points;
      if (isBackEdge && !customExits[ti]) {
        var dynamicMargin = routeMarginX + (ti * 12);
        points = [
          { x: x1, y: y1 },
          { x: dynamicMargin, y: y1 },
          { x: dynamicMargin, y: y2 },
          { x: x2, y: y2 },
        ];
      } else if (!isHorizontal && Math.abs(x1 - x2) < 2) {
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

      // Guard label
      if (tr.guard) {
        var glx, gly, glAnchor = 'middle';
        var guardText = '[' + tr.guard + ']';
        if (points.length === 4) {
          var seg1Len = Math.abs(points[1].x - points[0].x) + Math.abs(points[1].y - points[0].y);
          var seg2Len = Math.abs(points[2].x - points[1].x) + Math.abs(points[2].y - points[1].y);
          var seg3Len = Math.abs(points[3].x - points[2].x) + Math.abs(points[3].y - points[2].y);
          var bestSeg;
          if (seg1Len >= seg2Len && seg1Len >= seg3Len) bestSeg = 0;
          else if (seg2Len >= seg3Len) bestSeg = 1;
          else bestSeg = 2;
          var lSeg0 = points[bestSeg], lSeg1 = points[bestSeg + 1];
          var lSegIsH = Math.abs(lSeg1.y - lSeg0.y) < 1;
          if (lSegIsH) {
            glx = (lSeg0.x + lSeg1.x) / 2;
            gly = lSeg0.y - 8;
          } else {
            glx = lSeg0.x + 8;
            gly = (lSeg0.y + lSeg1.y) / 2;
            glAnchor = 'start';
          }
        } else {
          var lp0 = points[0], lp1 = points[1];
          glx = (lp0.x + lp1.x) / 2;
          gly = (lp0.y + lp1.y) / 2;
          if (Math.abs(lp1.y - lp0.y) < 1) {
            gly -= 10;
          } else {
            glx += 10; glAnchor = 'start';
          }
        }
        labelSvg.push('<text x="' + glx + '" y="' + gly +
          '" text-anchor="' + glAnchor + '" font-size="' + CFG.fontSize + '" fill="' + colors.text +
          '" stroke="' + colors.fill + '" stroke-width="4" stroke-opacity="0.85" stroke-linejoin="round" paint-order="stroke">' +
          UMLShared.escapeXml(guardText) + '</text>');
      }
    }

    // ── Draw nodes ──
    for (var en in entries) {
      var e = entries[en];
      var n = e.node;
      var cx = e.x + e.box.width / 2;
      var cy = e.y + e.box.height / 2;

      if (n.type === 'initial') {
        svg.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + CFG.initialR +
          '" fill="' + colors.line + '" stroke="none"/>');
      } else if (n.type === 'final') {
        svg.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + CFG.finalRingR +
          '" fill="none" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"/>');
        svg.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + CFG.finalR +
          '" fill="' + colors.line + '" stroke="none"/>');
      } else if (n.type === 'decision' || n.type === 'merge') {
        // Diamond shape
        var dh = e.box.height / 2;
        var dw = e.box.width / 2;
        svg.push('<polygon points="' +
          cx + ',' + (cy - dh) + ' ' + (cx + dw) + ',' + cy + ' ' +
          cx + ',' + (cy + dh) + ' ' + (cx - dw) + ',' + cy +
          '" fill="' + colors.headerFill + '" stroke="' + colors.stroke +
          '" stroke-width="' + CFG.strokeWidth + '"/>');
        // Decision condition text inside diamond
        if (n.type === 'decision' && n.label) {
          svg.push('<text x="' + cx + '" y="' + (cy + CFG.fontSize * 0.35) +
            '" text-anchor="middle" font-size="' + (CFG.fontSize - 1) + '" fill="' + colors.text + '">' +
            UMLShared.escapeXml(n.label) + '</text>');
        }
      } else if (n.type === 'fork' || n.type === 'join') {
        // Thick horizontal bar
        svg.push('<rect x="' + e.x + '" y="' + e.y + '" width="' + e.box.width + '" height="' + e.box.height +
          '" rx="2" ry="2" fill="' + colors.line + '" stroke="none"/>');
      } else {
        // Action node: rounded rectangle
        svg.push('<rect x="' + e.x + '" y="' + e.y + '" width="' + e.box.width + '" height="' + e.box.height +
          '" rx="' + CFG.actionRx + '" ry="' + CFG.actionRx +
          '" fill="' + colors.headerFill + '" stroke="' + colors.stroke + '" stroke-width="' + CFG.strokeWidth + '"/>');
        // Action name centered
        svg.push('<text x="' + cx + '" y="' + (cy + CFG.fontSize * 0.35) +
          '" text-anchor="middle" font-weight="bold" font-size="' + CFG.fontSizeBold + '" fill="' + colors.text + '">' +
          UMLShared.escapeXml(n.label) + '</text>');
      }
    }

    // ── Draw edge labels on top ──
    for (var lsi = 0; lsi < labelSvg.length; lsi++) {
      svg.push(labelSvg[lsi]);
    }

    // ── Draw notes ──
    for (var ni = 0; ni < notePositions.length; ni++) {
      var np2 = notePositions[ni];
      var cF, cT;
      if (np2.note.position === 'right') { cF = { x: np2.x, y: np2.y + np2.h / 2 }; cT = { x: np2.tx + np2.tw, y: np2.ty + np2.th / 2 }; }
      else if (np2.note.position === 'left') { cF = { x: np2.x + np2.w, y: np2.y + np2.h / 2 }; cT = { x: np2.tx, y: np2.ty + np2.th / 2 }; }
      else if (np2.note.position === 'top') { cF = { x: np2.x + np2.w / 2, y: np2.y + np2.h }; cT = { x: np2.tx + np2.tw / 2, y: np2.ty }; }
      else { cF = { x: np2.x + np2.w / 2, y: np2.y }; cT = { x: np2.tx + np2.tw / 2, y: np2.ty + np2.th }; }
      UMLShared.drawNote(svg, np2.x, np2.y, np2.note.lines, colors, { fromX: cF.x, fromY: cF.y, toX: cT.x, toY: cT.y });
    }

    svg.push(UMLShared.svgClose());
    return svg.join('\n');
  }

  // ─── Swimlane Helpers ─────────────────────────────────────────────

  function computeSwimlaneBounds(entries, lanes, layout) {
    if (lanes.length === 0) return null;

    // Group nodes by lane
    var laneNodes = {};
    for (var li = 0; li < lanes.length; li++) {
      laneNodes[lanes[li]] = [];
    }
    for (var eid in entries) {
      var e = entries[eid];
      if (e.node.lane && laneNodes[e.node.lane]) {
        laneNodes[e.node.lane].push(e);
      }
    }

    // Compute each lane's x-extent from its nodes
    var laneExtents = [];
    var prevRight = -layout.offsetX - CFG.lanePadX;
    for (var i = 0; i < lanes.length; i++) {
      var lName = lanes[i];
      var nodeGroup = laneNodes[lName];
      if (nodeGroup.length === 0) {
        // Empty lane: give it a minimum width
        var minW = UMLShared.textWidth(lName, true, CFG.fontSizeBold) + CFG.lanePadX * 2;
        laneExtents.push({ name: lName, minX: prevRight, maxX: prevRight + minW });
        prevRight = prevRight + minW;
        continue;
      }
      var lMinX = Infinity, lMaxX = -Infinity;
      for (var j = 0; j < nodeGroup.length; j++) {
        lMinX = Math.min(lMinX, nodeGroup[j].x - CFG.lanePadX);
        lMaxX = Math.max(lMaxX, nodeGroup[j].x + nodeGroup[j].box.width + CFG.lanePadX);
      }
      // Ensure lane is wide enough for its header
      var headerW = UMLShared.textWidth(lName, true, CFG.fontSizeBold) + CFG.lanePadX * 2;
      var laneW = lMaxX - lMinX;
      if (laneW < headerW) {
        var extra = (headerW - laneW) / 2;
        lMinX -= extra;
        lMaxX += extra;
      }
      laneExtents.push({ name: lName, minX: lMinX, maxX: lMaxX });
      prevRight = lMaxX;
    }

    // Build lane rects
    var result = [];
    for (var k = 0; k < laneExtents.length; k++) {
      var ext = laneExtents[k];
      result.push({
        name: ext.name,
        x: ext.minX,
        width: ext.maxX - ext.minX,
      });
    }

    var totalWidth = 0;
    for (var t = 0; t < result.length; t++) {
      totalWidth = Math.max(totalWidth, result[t].x + result[t].width);
    }

    return { lanes: result, totalWidth: totalWidth - result[0].x };
  }

  // ─── Note Target Resolution ───────────────────────────────────────

  function resolveTarget(target, entries) {
    // Target can be a node ID or a quoted label
    var cleanTarget = target.replace(/^"|"$/g, '');
    // Try direct ID match
    if (entries[cleanTarget]) {
      var e = entries[cleanTarget];
      return { x: e.x, y: e.y, w: e.box.width, h: e.box.height };
    }
    // Try label match
    for (var k in entries) {
      if (entries[k].node.label === cleanTarget) {
        var e2 = entries[k];
        return { x: e2.x, y: e2.y, w: e2.box.width, h: e2.box.height };
      }
    }
    return null;
  }

  // ─── Public API ───────────────────────────────────────────────────

  function render(container, text) {
    var parsed = parse(text);
    if (!parsed.nodes || parsed.nodes.length === 0) {
      container.innerHTML = '<div style="padding:20px;color:#888;text-align:center;">No activities to display.</div>';
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

  UMLShared.createAutoInit('pre > code.language-uml-activity', render);
  window.UMLActivityDiagram = { render: render, parse: parse };
})();
