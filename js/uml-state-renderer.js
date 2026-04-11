/**
 * UML State Machine Diagram Renderer
 *
 * Text format:
 *   @startuml
 *   [*] --> Idle : powerOn()
 *   Idle --> CombatMode : threatDetected [sysCheckOK] / deployUI()
 *   CombatMode --> Idle : threatNeutralized / retractWeapons()
 *   EmergencyPower --> [*] : manualOverride()
 *
 *   state Idle {
 *     entry / initSensors()
 *   }
 *   @enduml
 *
 * Notation:
 *   [*]           Initial pseudo-state (filled circle) / Final pseudo-state (bullseye)
 *   state Name {} State with internal actions (entry/exit/do)
 *   A --> B : lbl Transition with Event [Guard] / Effect
 */
(function () {
  'use strict';

  var CFG = {
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    fontSize: 14,
    fontSizeBold: 15,
    fontSizeAction: 12,
    lineHeight: 22,
    padX: 20,
    padY: 10,
    stateMinW: 120,
    stateRx: 12,
    initialR: 8,
    finalR: 6,
    finalRingR: 11,
    gapX: 80,
    gapY: 70,
    arrowSize: 10,
    strokeWidth: 1.5,
    svgPad: 30,
    selfLoopW: 50,
    selfLoopH: 30,
    labelBgPad: 4,
  };

  // ─── Parser ───────────────────────────────────────────────────────

  function parse(text) {
    var lines = text.split('\n');
    var states = {};       // name -> { name, type, entryAction, exitAction, doActivity }
    var transitions = [];
    var notes = [];
    var inState = null;
    var braceDepth = 0;
    var direction = 'TB';

    // Ensure [*] pseudo-states exist
    function ensureState(name) {
      if (!states[name]) {
        var type = 'state';
        if (name === '[*]') type = 'pseudo'; // resolved later per usage
        states[name] = { name: name, type: type, entryAction: '', exitAction: '', doActivity: '' };
      }
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line === '@startuml' || line === '@enduml') continue;

      // Layout directive
      var layoutMatch = line.match(/^layout\s+(horizontal|vertical|left-to-right|top-to-bottom|LR|TB)$/i);
      if (layoutMatch && inState === null) {
        var val = layoutMatch[1].toLowerCase();
        direction = (val === 'horizontal' || val === 'left-to-right' || val === 'lr') ? 'LR' : 'TB';
        continue;
      }

      // Inside a state block
      if (inState !== null) {
        for (var ci = 0; ci < line.length; ci++) {
          if (line[ci] === '{') braceDepth++;
          if (line[ci] === '}') braceDepth--;
        }
        if (braceDepth <= 0) {
          inState = null;
          braceDepth = 0;
          continue;
        }
        // Parse internal actions
        var entryMatch = line.match(/^entry\s*\/\s*(.+)$/i);
        if (entryMatch) { states[inState].entryAction = entryMatch[1].trim(); continue; }
        var exitMatch = line.match(/^exit\s*\/\s*(.+)$/i);
        if (exitMatch) { states[inState].exitAction = exitMatch[1].trim(); continue; }
        var doMatch = line.match(/^do\s*\/\s*(.+)$/i);
        if (doMatch) { states[inState].doActivity = doMatch[1].trim(); continue; }
        // Sub-transitions inside composite state
        var subTrans = line.match(/^(\S+)\s+-->\s+((?:\[[^\]]*\]\s*)?)(\S+)((?:\s*\/[^:]*)?)\s*(?::\s*(.*))?$/);
        if (subTrans) {
          var sf = subTrans[1], sg = subTrans[2] ? subTrans[2].trim() : '', st = subTrans[3];
          var sa = subTrans[4] ? subTrans[4].trim() : '', se = subTrans[5] ? subTrans[5].trim() : '';
          ensureState(sf); ensureState(st);
          states[sf].parent = inState; states[st].parent = inState;
          states[inState].isComposite = true;
          var slp = []; if (se) slp.push(se); if (sg) slp.push(sg); if (sa) slp.push(sa);
          transitions.push({ from: sf, to: st, label: slp.join(' '), parent: inState });
          continue;
        }
        continue;
      }

      // Note
      var noteIdx = UMLShared.parseNoteLine(line, lines, i, notes);
      if (noteIdx >= 0) { i = noteIdx; continue; }

      // Choice pseudostate: state Name <<choice>>
      var choiceMatch = line.match(/^state\s+(\S+)\s+<<choice>>\s*$/);
      if (choiceMatch) {
        var cName = choiceMatch[1];
        ensureState(cName);
        states[cName].type = 'choice';
        continue;
      }

      // State declaration: state Name { ... }
      var stateMatch = line.match(/^state\s+(\S+)\s*\{?/);
      if (stateMatch) {
        var sName = stateMatch[1];
        ensureState(sName);
        if (line.indexOf('{') !== -1) {
          braceDepth = 1;
          if (line.indexOf('}') !== -1 && line.indexOf('}') > line.indexOf('{')) {
            braceDepth = 0;
          } else {
            inState = sName;
          }
        }
        continue;
      }

      // Transition: From --> [guard?] To [/ action?] [: event]
      // Also handles standard: From --> To : event [guard] / action
      var transRe = line.match(/^(\S+)\s+-->\s+((?:\[[^\]]*\]\s*)?)(\S+)((?:\s*\/[^:]*)?)\s*(?::\s*(.*))?$/);
      if (transRe) {
        var from = transRe[1];
        var preGuard = transRe[2] ? transRe[2].trim() : '';
        var to = transRe[3];
        var preAction = transRe[4] ? transRe[4].trim() : '';
        var eventLabel = transRe[5] ? transRe[5].trim() : '';
        var labelParts = [];
        if (eventLabel) labelParts.push(eventLabel);
        if (preGuard) labelParts.push(preGuard);
        if (preAction) labelParts.push(preAction);
        var label = labelParts.join(' ');
        ensureState(from);
        ensureState(to);
        transitions.push({ from: from, to: to, label: label });
        continue;
      }
    }

    // Classify [*] as initial or final based on usage
    // [*] as source → it's an initial state; [*] as target → it's a final state
    var initialNames = {};
    var finalNames = {};
    var initialCount = 0;
    var finalCount = 0;
    for (var t = 0; t < transitions.length; t++) {
      if (transitions[t].from === '[*]') {
        var iName = '__initial__' + initialCount;
        initialNames[t] = iName;
        if (!states[iName]) states[iName] = { name: iName, type: 'initial', entryAction: '', exitAction: '', doActivity: '' };
        initialCount++;
      }
      if (transitions[t].to === '[*]') {
        var fName = '__final__' + finalCount;
        finalNames[t] = fName;
        if (!states[fName]) states[fName] = { name: fName, type: 'final', entryAction: '', exitAction: '', doActivity: '' };
        finalCount++;
      }
    }
    // Replace [*] references in transitions
    for (var t2 = 0; t2 < transitions.length; t2++) {
      if (initialNames[t2] !== undefined) transitions[t2].from = initialNames[t2];
      if (finalNames[t2] !== undefined) transitions[t2].to = finalNames[t2];
    }
    // Remove the generic [*] placeholder
    delete states['[*]'];

    // Convert to array
    var stateList = [];
    for (var sn in states) stateList.push(states[sn]);

    return { states: stateList, transitions: transitions, notes: notes, direction: direction };
  }

  // ─── Text Measurement (delegated to UMLShared) ────────────────────

  // ─── Layout ───────────────────────────────────────────────────────

  function measureState(s) {
    if (s.type === 'initial') return { width: CFG.initialR * 2, height: CFG.initialR * 2 };
    if (s.type === 'final') return { width: CFG.finalRingR * 2 + 4, height: CFG.finalRingR * 2 + 4 };
    if (s.type === 'choice') return { width: 30, height: 30 };

    var nameW = UMLShared.textWidth(s.name, true, CFG.fontSizeBold);
    var hasActions = s.entryAction || s.exitAction || s.doActivity;
    var actionLines = 0;
    if (s.entryAction) actionLines++;
    if (s.exitAction) actionLines++;
    if (s.doActivity) actionLines++;

    var actionMaxW = 0;
    if (s.entryAction) actionMaxW = Math.max(actionMaxW, UMLShared.textWidth('entry / ' + s.entryAction, false, CFG.fontSizeAction));
    if (s.exitAction) actionMaxW = Math.max(actionMaxW, UMLShared.textWidth('exit / ' + s.exitAction, false, CFG.fontSizeAction));
    if (s.doActivity) actionMaxW = Math.max(actionMaxW, UMLShared.textWidth('do / ' + s.doActivity, false, CFG.fontSizeAction));

    var width = Math.max(CFG.stateMinW, nameW + CFG.padX * 2, actionMaxW + CFG.padX * 2);
    var height = CFG.padY * 2 + CFG.lineHeight;
    if (hasActions) height += 4 + actionLines * 16; // divider + action lines

    return { width: Math.ceil(width), height: Math.ceil(height), hasActions: hasActions, actionLines: actionLines };
  }

  function computeLayout(parsed) {
    var stateList = parsed.states;
    var transitions = parsed.transitions;
    if (stateList.length === 0) return { entries: {}, width: 0, height: 0, offsetX: 0, offsetY: 0 };

    var entries = {};

    // Identify composite states and their children
    var childOf = {}; // stateName -> parentName
    var compositeChildren = {}; // parentName -> [childName]
    for (var ci = 0; ci < stateList.length; ci++) {
      if (stateList[ci].parent) {
        childOf[stateList[ci].name] = stateList[ci].parent;
        if (!compositeChildren[stateList[ci].parent]) compositeChildren[stateList[ci].parent] = [];
        compositeChildren[stateList[ci].parent].push(stateList[ci].name);
      }
    }

    // Measure all states (children get measured individually)
    for (var i = 0; i < stateList.length; i++) {
      var s = stateList[i];
      var box = measureState(s);
      entries[s.name] = { state: s, box: box, x: 0, y: 0 };
    }

    // For composite states, run sub-layout to compute their size
    var compositeHeaderH = CFG.padY * 2 + CFG.lineHeight + 4; // header + divider
    var compositePad = 20;
    for (var pName in compositeChildren) {
      var kids = compositeChildren[pName];
      var subNodes = [], subEdges = [];
      for (var ki = 0; ki < kids.length; ki++) {
        var kEntry = entries[kids[ki]];
        subNodes.push({ id: kids[ki], width: kEntry.box.width, height: kEntry.box.height });
      }
      for (var ti = 0; ti < transitions.length; ti++) {
        if (transitions[ti].parent === pName) {
          subEdges.push({ source: transitions[ti].from, target: transitions[ti].to, type: 'navigable' });
        }
      }
      if (subNodes.length > 0) {
        var subResult = window.UMLAdvancedLayout.compute(subNodes, subEdges, { gapX: CFG.gapX * 0.7, gapY: CFG.gapY * 0.7, direction: parsed.direction || 'TB' });
        // Compute sub-bounding box
        var sMinX = Infinity, sMinY = Infinity, sMaxX = -Infinity, sMaxY = -Infinity;
        for (var sn in subResult.nodes) {
          var snr = subResult.nodes[sn];
          sMinX = Math.min(sMinX, snr.x); sMinY = Math.min(sMinY, snr.y);
          sMaxX = Math.max(sMaxX, snr.x + entries[sn].box.width);
          sMaxY = Math.max(sMaxY, snr.y + entries[sn].box.height);
        }
        var subW = sMaxX - sMinX + compositePad * 2;
        var subH = sMaxY - sMinY + compositePad * 2;
        var compositeW = Math.max(subW, UMLShared.textWidth(pName, true, CFG.fontSizeBold) + CFG.padX * 2);
        var compositeH = compositeHeaderH + subH;
        entries[pName].box = { width: Math.ceil(compositeW), height: Math.ceil(compositeH), hasActions: false, actionLines: 0 };
        entries[pName].subLayout = subResult;
        entries[pName].subOffset = { x: -sMinX + compositePad, y: compositeHeaderH - sMinY + compositePad };
        entries[pName].subBounds = { w: subW, h: subH };
      }
    }

    // Top-level layout: only non-child states
    var layoutNodes = [];
    var layoutEdges = [];
    for (var li = 0; li < stateList.length; li++) {
      if (childOf[stateList[li].name]) continue; // skip children
      var le = entries[stateList[li].name];
      layoutNodes.push({ id: stateList[li].name, width: le.box.width, height: le.box.height });
    }
    for (var t = 0; t < transitions.length; t++) {
      var tr = transitions[t];
      if (tr.parent) continue; // skip sub-transitions
      layoutEdges.push({ source: tr.from, target: tr.to, type: 'navigable', data: tr });
    }

    var result = window.UMLAdvancedLayout.compute(layoutNodes, layoutEdges, { gapX: CFG.gapX, gapY: CFG.gapY, direction: parsed.direction || 'TB' });

    // Map coords back for top-level states
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var sn2 in result.nodes) {
      if (!entries[sn2]) continue;
      entries[sn2].x = result.nodes[sn2].x;
      entries[sn2].y = result.nodes[sn2].y;
      minX = Math.min(minX, entries[sn2].x);
      minY = Math.min(minY, entries[sn2].y);
      maxX = Math.max(maxX, entries[sn2].x + entries[sn2].box.width);
      maxY = Math.max(maxY, entries[sn2].y + entries[sn2].box.height);
    }

    // Position children inside their composite parents
    for (var pn in compositeChildren) {
      var pe = entries[pn];
      if (!pe.subLayout) continue;
      var off = pe.subOffset;
      var ckids = compositeChildren[pn];
      for (var cki = 0; cki < ckids.length; cki++) {
        var ck = ckids[cki];
        var sr = pe.subLayout.nodes[ck];
        if (sr) {
          entries[ck].x = pe.x + off.x + sr.x;
          entries[ck].y = pe.y + off.y + sr.y;
        }
      }
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
    var transitions = parsed.transitions;
    // Pre-compute distributed exit points to avoid overlapping lines from same source
    var customExits = {};  // ti -> {x, y}

    // Compute max bounds for back-edge routing
    var maxBoundsX = 0;
    for (var en0 in entries) {
      maxBoundsX = Math.max(maxBoundsX, entries[en0].x + entries[en0].box.width);
    }
    var routeMarginX = maxBoundsX + CFG.gapX * 0.4;

    // Group downward transitions by source state
    var downByFrom = {};
    for (var ti0 = 0; ti0 < transitions.length; ti0++) {
      var tr0 = transitions[ti0];
      if (!entries[tr0.from] || !entries[tr0.to] || tr0.from === tr0.to) continue;
      var fe0 = entries[tr0.from], te0 = entries[tr0.to];
      if ((te0.y + te0.box.height / 2) > (fe0.y + fe0.box.height / 2)) {
        if (!downByFrom[tr0.from]) downByFrom[tr0.from] = [];
        downByFrom[tr0.from].push(ti0);
      }
    }
    // Distribute exit X positions for groups with multiple downward transitions
    for (var fname in downByFrom) {
      var dgroup = downByFrom[fname];
      if (dgroup.length < 2) continue;
      var fe = entries[fname];
      // Sort by destination center X
      dgroup.sort(function(a, b) {
        var ta = transitions[a], tb = transitions[b];
        var cxa = entries[ta.to] ? entries[ta.to].x + entries[ta.to].box.width / 2 : 0;
        var cxb = entries[tb.to] ? entries[tb.to].x + entries[tb.to].box.width / 2 : 0;
        return cxa - cxb;
      });
      for (var dgi = 0; dgi < dgroup.length; dgi++) {
        var exitX = fe.x + fe.box.width * (dgi + 1) / (dgroup.length + 1);
        customExits[dgroup[dgi]] = { x: exitX, y: fe.y + fe.box.height };
      }
    }

    // Compute extra space needed for back-edge routes, self-loops, and labels
    var extraRight = 0;
    for (var pt = 0; pt < transitions.length; pt++) {
      var ptr = transitions[pt];
      var pfe = entries[ptr.from], pte = entries[ptr.to];
      if (!pfe || !pte) continue;
      if (ptr.from === ptr.to) {
        var slRight = pfe.x + pfe.box.width + CFG.selfLoopW;
        if (ptr.label) slRight += 4 + UMLShared.textWidth(ptr.label, false, CFG.fontSize);
        extraRight = Math.max(extraRight, slRight - maxBoundsX);
      } else {
        var pfcy = pfe.y + pfe.box.height / 2;
        var ptcy = pte.y + pte.box.height / 2;
        if (ptcy < pfcy - 10) {
          var beRight = routeMarginX;
          if (ptr.label) beRight += 8 + UMLShared.textWidth(ptr.label, false, CFG.fontSize) + CFG.labelBgPad * 2;
          extraRight = Math.max(extraRight, beRight - maxBoundsX);
        }
      }
    }

    // Group upward (back-edge) transitions by target state to stagger entry Y coordinates
    var backEdgeByTo = {};
    for (var bti = 0; bti < transitions.length; bti++) {
      var btr = transitions[bti];
      if (!entries[btr.from] || !entries[btr.to] || btr.from === btr.to) continue;
      var bfe = entries[btr.from], bte = entries[btr.to];
      if ((bte.y + bte.box.height / 2) < (bfe.y + bfe.box.height / 2) - 10) {
        if (!backEdgeByTo[btr.to]) backEdgeByTo[btr.to] = [];
        backEdgeByTo[btr.to].push(bti);
      }
    }
    var customEntries = {}; // bti -> { x, y }
    for (var bname in backEdgeByTo) {
      var bgroup = backEdgeByTo[bname];
      if (bgroup.length < 2) continue;
      var btarget = entries[bname];
      bgroup.sort(function(a, b) {
        var fa = entries[transitions[a].from], fb = entries[transitions[b].from];
        var cya = fa ? fa.y + fa.box.height / 2 : 0;
        var cyb = fb ? fb.y + fb.box.height / 2 : 0;
        return cya - cyb;
      });
      for (var bgi = 0; bgi < bgroup.length; bgi++) {
        var bfrac = (bgi + 1) / (bgroup.length + 1);
        customEntries[bgroup[bgi]] = {
          x: btarget.x + btarget.box.width,
          y: btarget.y + btarget.box.height * bfrac
        };
      }
    }

    // Resolve note target — supports StateName or StateName.entry/exit/do
    function resolveTarget(target) {
      var parts = target.split('.');
      var entry = entries[parts[0]];
      if (!entry) return null;
      var box = entry.box;
      if (parts.length < 2 || !box.hasActions) {
        return { x: entry.x, y: entry.y, w: box.width, h: box.height };
      }
      var sub = parts[1].toLowerCase();
      var headerH = CFG.padY * 2 + CFG.lineHeight;
      var actionIdx = -1;
      for (var ai = 0; ai < box.actionLines.length; ai++) {
        if (box.actionLines[ai].toLowerCase().indexOf(sub) !== -1) { actionIdx = ai; break; }
      }
      if (actionIdx >= 0) {
        var ay = entry.y + headerH + 4 + actionIdx * CFG.fontSizeAction * 1.6;
        return { x: entry.x, y: ay, w: box.width, h: CFG.fontSizeAction * 1.6 };
      }
      return { x: entry.x, y: entry.y, w: box.width, h: box.height };
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
    var svgW = layout.width + extraRight + CFG.svgPad * 2 + noteExtraL + noteExtraR;
    var svgH = layout.height + CFG.svgPad * 2 + noteExtraT + noteExtraB;

    var svg = [];
    var labelSvg = []; // Transition labels rendered after states so they appear on top
    svg.push(UMLShared.svgOpen(svgW, svgH, ox, oy, CFG.fontFamily));

    // ── Draw transitions (behind states) ──
    for (var ti = 0; ti < transitions.length; ti++) {
      var tr = transitions[ti];
      var fromE = entries[tr.from];
      var toE = entries[tr.to];
      if (!fromE || !toE) continue;

      // Self-transition
      if (tr.from === tr.to) {
        var sx = fromE.x + fromE.box.width;
        var sy = fromE.y + fromE.box.height / 2 - 10;
        var lw = CFG.selfLoopW, lh = CFG.selfLoopH;
        svg.push('<path d="M ' + sx + ' ' + sy + ' C ' + (sx + lw) + ' ' + (sy - lh) + ' ' +
          (sx + lw) + ' ' + (sy + lh + 20) + ' ' + sx + ' ' + (sy + 20) +
          '" fill="none" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"/>');
        // Arrowhead
        drawArrow(svg, sx, sy + 20, -1, 0, colors.line);
        if (tr.label) {
          labelSvg.push('<text x="' + (sx + lw + 4) + '" y="' + (sy + 10) +
            '" font-size="' + CFG.fontSize + '" fill="' + colors.text +
            '" stroke="' + colors.fill + '" stroke-width="4" stroke-opacity="0.85" stroke-linejoin="round" paint-order="stroke">' + UMLShared.escapeXml(tr.label) + '</text>');
        }
        continue;
      }

      var fromCx = fromE.x + fromE.box.width / 2;
      var fromCy = fromE.y + fromE.box.height / 2;
      var toCx = toE.x + toE.box.width / 2;
      var toCy = toE.y + toE.box.height / 2;

      // Determine exit/entry points
      var x1, y1, x2, y2;
      var dx = toCx - fromCx, dy = toCy - fromCy;
      var isBackEdge = false;
      var isHorizontal = false;

      // Use pre-computed distributed exit point if available
      if (customExits[ti]) {
        x1 = customExits[ti].x; y1 = customExits[ti].y;
        x2 = toCx; y2 = toE.y;
      } else if (dy < -10) {
        // Back-edge going upward: route via right margin to avoid crossing
        x1 = fromE.x + fromE.box.width; y1 = fromCy;
        if (customEntries[ti]) {
          x2 = customEntries[ti].x; y2 = customEntries[ti].y;
        } else {
          x2 = toE.x + toE.box.width; y2 = toCy;
        }
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
        // Back-edge via right margin
        // Apply an offset based on transitioning index to avoid overlapping routes
        var dynamicMargin = routeMarginX + (ti * 12);
        points = [
          { x: x1, y: y1 },
          { x: dynamicMargin, y: y1 },
          { x: dynamicMargin, y: y2 },
          { x: x2, y: y2 }
        ];
      } else if (!isHorizontal && Math.abs(x1 - x2) < 2) {
        // Straight vertical
        points = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
      } else if (isHorizontal && Math.abs(y1 - y2) < 2) {
        // Straight horizontal
        points = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
      } else {
        if (isHorizontal) {
          // Z-route along horizontal axis (enters sideways at 90 degrees)
          var midX = (x1 + x2) / 2;
          points = [{ x: x1, y: y1 }, { x: midX, y: y1 }, { x: midX, y: y2 }, { x: x2, y: y2 }];
        } else {
          // Z-route along vertical axis (enters top/bottom at 90 degrees)
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

      // Transition label with background
      if (tr.label) {
        var lx, ly, lAnchor = 'middle';
        if (points.length === 4) {
          // Z-routes: label on the longest segment for best readability
          var seg1Len = Math.abs(points[1].x - points[0].x) + Math.abs(points[1].y - points[0].y);
          var seg2Len = Math.abs(points[2].x - points[1].x) + Math.abs(points[2].y - points[1].y);
          var seg3Len = Math.abs(points[3].x - points[2].x) + Math.abs(points[3].y - points[2].y);
          var bestSeg, bestSegLen;
          if (seg1Len >= seg2Len && seg1Len >= seg3Len) { bestSeg = 0; bestSegLen = seg1Len; }
          else if (seg2Len >= seg3Len) { bestSeg = 1; bestSegLen = seg2Len; }
          else { bestSeg = 2; bestSegLen = seg3Len; }
          var lSeg0 = points[bestSeg], lSeg1 = points[bestSeg + 1];
          var lSegIsH = Math.abs(lSeg1.y - lSeg0.y) < 1;

          if (lSegIsH) {
            lx = (lSeg0.x + lSeg1.x) / 2;
            ly = lSeg0.y - 8;
            if (downByFrom[tr.from] && downByFrom[tr.from].length > 1) {
              var dIdx = downByFrom[tr.from].indexOf(ti);
              if (dIdx > 0) ly += dIdx * (CFG.fontSize + 4);
            }
          } else {
            // Vertical segment — place label to the right, staggered by Y
            // for back-edges routed on same side
            lx = lSeg0.x + 8;
            lAnchor = 'start';
            if (isBackEdge) {
              // Place near the top of the vertical segment (close to exit)
              ly = Math.min(lSeg0.y, lSeg1.y) + CFG.fontSize + 4;
            } else {
              ly = (lSeg0.y + lSeg1.y) / 2;
            }
          }
        } else {
          // Direct line
          var lp0 = points[0], lp1 = points[1];
          lx = (lp0.x + lp1.x) / 2;
          ly = (lp0.y + lp1.y) / 2;
          if (Math.abs(lp1.y - lp0.y) < 1) {
             ly -= 10;
          } else {
             lx += 10; lAnchor = 'start';
          }
        }
        // Check if label would overlap any state box and shift if needed
        var lblW = UMLShared.textWidth(tr.label, false, CFG.fontSize);
        var lblL = (lAnchor === 'middle') ? lx - lblW / 2 : (lAnchor === 'start' ? lx : lx - lblW);
        var lblR = lblL + lblW;
        var lblT = ly - CFG.fontSize;
        var lblB = ly + 4;
        for (var lsi in entries) {
          var lse = entries[lsi];
          var seL = lse.x - 4, seR = lse.x + lse.box.width + 4;
          var seT = lse.y - 4, seB = lse.y + lse.box.height + 4;
          if (lblR > seL && lblL < seR && lblB > seT && lblT < seB) {
            // Overlaps a state — shift right of the state
            lx = seR + 8;
            lAnchor = 'start';
            break;
          }
        }
        labelSvg.push('<text x="' + lx + '" y="' + ly +
          '" text-anchor="' + lAnchor + '" font-size="' + CFG.fontSize + '" fill="' + colors.text +
          '" stroke="' + colors.fill + '" stroke-width="4" stroke-opacity="0.85" stroke-linejoin="round" paint-order="stroke">' +
          UMLShared.escapeXml(tr.label) + '</text>');
      }
    }

    // ── Draw composite state backgrounds first ──
    for (var cen in entries) {
      var ce = entries[cen];
      if (!ce.state.isComposite) continue;
      // Large rounded rectangle
      svg.push('<rect x="' + ce.x + '" y="' + ce.y + '" width="' + ce.box.width + '" height="' + ce.box.height +
        '" rx="' + CFG.stateRx + '" ry="' + CFG.stateRx +
        '" fill="' + colors.fill + '" stroke="' + colors.stroke + '" stroke-width="' + CFG.strokeWidth + '"/>');
      // Header with name
      var chY = ce.y + CFG.padY + CFG.lineHeight * 0.75;
      svg.push('<text x="' + (ce.x + CFG.padX) + '" y="' + chY +
        '" font-weight="bold" font-size="' + CFG.fontSizeBold + '" fill="' + colors.text + '">' +
        UMLShared.escapeXml(ce.state.name) + '</text>');
      // Divider line
      var cdY = ce.y + CFG.padY * 2 + CFG.lineHeight;
      svg.push('<line x1="' + ce.x + '" y1="' + cdY + '" x2="' + (ce.x + ce.box.width) + '" y2="' + cdY +
        '" stroke="' + colors.stroke + '" stroke-width="1"/>');
    }

    // ── Draw states (non-composite) ──
    for (var en in entries) {
      var e = entries[en];
      var s = e.state;
      if (s.isComposite) continue; // already drawn above
      var cx = e.x + e.box.width / 2;
      var cy = e.y + e.box.height / 2;

      if (s.type === 'initial') {
        svg.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + CFG.initialR +
          '" fill="' + colors.line + '" stroke="none"/>');
      } else if (s.type === 'final') {
        svg.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + CFG.finalRingR +
          '" fill="none" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"/>');
        svg.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + CFG.finalR +
          '" fill="' + colors.line + '" stroke="none"/>');
      } else if (s.type === 'choice') {
        // Diamond (rotated square)
        var dh = e.box.width / 2;
        svg.push('<polygon points="' +
          cx + ',' + (cy - dh) + ' ' + (cx + dh) + ',' + cy + ' ' +
          cx + ',' + (cy + dh) + ' ' + (cx - dh) + ',' + cy +
          '" fill="' + colors.headerFill + '" stroke="' + colors.stroke +
          '" stroke-width="' + CFG.strokeWidth + '"/>');
      } else {
        // Regular state: rounded rectangle
        svg.push('<rect x="' + e.x + '" y="' + e.y + '" width="' + e.box.width + '" height="' + e.box.height +
          '" rx="' + CFG.stateRx + '" ry="' + CFG.stateRx +
          '" fill="' + colors.headerFill + '" stroke="' + colors.stroke + '" stroke-width="' + CFG.strokeWidth + '"/>');

        // State name (centered in top area)
        var nameY = e.y + CFG.padY + CFG.lineHeight * 0.75;
        svg.push('<text x="' + cx + '" y="' + nameY +
          '" text-anchor="middle" font-weight="bold" font-size="' + CFG.fontSizeBold + '" fill="' + colors.text + '">' +
          UMLShared.escapeXml(s.name) + '</text>');

        // Internal actions
        if (e.box.hasActions) {
          var divY = e.y + CFG.padY * 2 + CFG.lineHeight;
          svg.push('<line x1="' + e.x + '" y1="' + divY + '" x2="' + (e.x + e.box.width) + '" y2="' + divY +
            '" stroke="' + colors.stroke + '" stroke-width="1"/>');

          var actionY = divY + 14;
          if (s.entryAction) {
            svg.push('<text x="' + (e.x + CFG.padX / 2) + '" y="' + actionY +
              '" font-size="' + CFG.fontSizeAction + '" fill="' + colors.text + '">entry / ' +
              UMLShared.escapeXml(s.entryAction) + '</text>');
            actionY += 16;
          }
          if (s.exitAction) {
            svg.push('<text x="' + (e.x + CFG.padX / 2) + '" y="' + actionY +
              '" font-size="' + CFG.fontSizeAction + '" fill="' + colors.text + '">exit / ' +
              UMLShared.escapeXml(s.exitAction) + '</text>');
            actionY += 16;
          }
          if (s.doActivity) {
            svg.push('<text x="' + (e.x + CFG.padX / 2) + '" y="' + actionY +
              '" font-size="' + CFG.fontSizeAction + '" fill="' + colors.text + '">do / ' +
              UMLShared.escapeXml(s.doActivity) + '</text>');
          }
        }
      }
    }

    // ── Draw transition labels on top of everything ──
    for (var li = 0; li < labelSvg.length; li++) {
      svg.push(labelSvg[li]);
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

  // ─── Public API ───────────────────────────────────────────────────

  function render(container, text) {
    var parsed = parse(text);
    if (!parsed.states || parsed.states.length === 0) {
      container.innerHTML = '<div style="padding:20px;color:#888;text-align:center;">No states to display.</div>';
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

  UMLShared.createAutoInit('pre > code.language-uml-state', render);
  window.UMLStateDiagram = { render: render, parse: parse };
})();
