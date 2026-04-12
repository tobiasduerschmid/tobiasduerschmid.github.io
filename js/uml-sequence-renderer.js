/**
 * UML Sequence Diagram Renderer
 *
 * Custom SVG renderer for UML sequence diagrams.
 *
 * Text format:
 *   @startuml
 *   participant client_1: Client
 *   participant server: LibraryServer
 *
 *   client_1 -> server: GET /book/id
 *   server --> client_1: responseCode=200, book
 *   client_1 ->> server: async message
 *
 *   alt [book found]
 *     server --> client_1: responseCode=200, book
 *   else [else]
 *     server --> client_1: responseCode=404
 *   end
 *   @enduml
 *
 * Arrow types:
 *   ->   Synchronous call (solid, filled arrowhead)
 *   -->  Response / return (dashed, open arrowhead)
 *   ->>  Asynchronous message (solid, open arrowhead)
 *   ->o  Lost message (arrow to filled circle, no receiver)
 *   o->  Found message (from filled circle, no sender)
 *   create -> Name  Create message
 *   destroy Name    Destroy (X mark)
 *
 * Combined fragments: alt/else/end, loop/end, opt/end
 */
(function () {
  'use strict';

  var CFG = {
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    fontSize: 13,
    fontSizeBold: 14,
    fontSizeFragment: 12,
    lineHeight: 20,
    participantPadX: 20,
    participantPadY: 10,
    participantMinW: 100,
    participantGap: 60,
    messageGapY: 40,
    activationW: 12,
    activationOffset: 4,  // horizontal shift per stacking depth level
    lifelineDash: '6,4',
    fragmentPadX: 10,
    fragmentPadY: 6,
    fragmentLabelW: 50,
    fragmentLabelH: 22,
    arrowSize: 10,
    svgPad: 20,
    strokeWidth: 1.5,
    destroySize: 12,
    lostFoundRadius: 6,
    lostFoundGap: 50,
  };

  // ─── Parser ───────────────────────────────────────────────────────

  function parse(text) {
    var lines = text.split('\n');
    var participants = [];      // { id, label }
    var participantMap = {};    // id -> index
    var messages = [];          // Each item: message, fragment start/end, create, destroy
    var autoParticipants = {};  // Track implicitly declared participants

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line === '@startuml' || line === '@enduml') continue;

      // Participant declaration
      var partMatch = line.match(/^participant\s+(.+)$/);
      if (partMatch) {
        var partDecl = partMatch[1].trim();
        var id, label;
        // "id: Label" or "id as Label" or just "id"
        var colonIdx = partDecl.indexOf(':');
        var asIdx = partDecl.indexOf(' as ');
        if (colonIdx !== -1) {
          id = partDecl.substring(0, colonIdx).trim();
          label = partDecl.substring(colonIdx + 1).trim();
        } else if (asIdx !== -1) {
          id = partDecl.substring(0, asIdx).trim();
          label = partDecl.substring(asIdx + 4).trim();
        } else {
          id = partDecl;
          label = partDecl;
        }
        if (!participantMap.hasOwnProperty(id)) {
          participantMap[id] = participants.length;
          participants.push({ id: id, label: label });
        }
        continue;
      }

      // Actor declaration
      var actorMatch = line.match(/^actor\s+(.+)$/);
      if (actorMatch) {
        var actorDecl = actorMatch[1].trim();
        var actorId, actorLabel;
        var ac = actorDecl.indexOf(':');
        var aa = actorDecl.indexOf(' as ');
        if (ac !== -1) {
          actorId = actorDecl.substring(0, ac).trim();
          actorLabel = actorDecl.substring(ac + 1).trim();
        } else if (aa !== -1) {
          actorId = actorDecl.substring(0, aa).trim();
          actorLabel = actorDecl.substring(aa + 4).trim();
        } else {
          actorId = actorDecl;
          actorLabel = actorDecl;
        }
        if (!participantMap.hasOwnProperty(actorId)) {
          participantMap[actorId] = participants.length;
          participants.push({ id: actorId, label: actorLabel, isActor: true });
        }
        continue;
      }

      // Combined fragment: alt, loop, opt, break, par, critical, ref, neg
      var fragMatch = line.match(/^(alt|loop|opt|break|par|critical|ref|neg)\s*(\[.*\])?(.*)$/i);
      if (fragMatch) {
        var fragType = fragMatch[1].toLowerCase();
        var condition = (fragMatch[2] || fragMatch[3] || '').trim();
        if (condition.startsWith('[')) condition = condition.substring(1);
        if (condition.endsWith(']')) condition = condition.substring(0, condition.length - 1);
        messages.push({ type: 'fragment_start', fragType: fragType, condition: condition.trim() });
        continue;
      }

      // Else clause in alt
      var elseMatch = line.match(/^else\s*(\[.*\])?(.*)$/i);
      if (elseMatch) {
        var elseCond = (elseMatch[1] || elseMatch[2] || '').trim();
        if (elseCond.startsWith('[')) elseCond = elseCond.substring(1);
        if (elseCond.endsWith(']')) elseCond = elseCond.substring(0, elseCond.length - 1);
        messages.push({ type: 'fragment_else', condition: elseCond.trim() });
        continue;
      }

      // End fragment
      if (/^end$/i.test(line)) {
        messages.push({ type: 'fragment_end' });
        continue;
      }

      // Activate / deactivate
      var activateMatch = line.match(/^activate\s+(\S+)$/i);
      if (activateMatch) {
        messages.push({ type: 'activate', target: activateMatch[1].trim() });
        continue;
      }
      var deactivateMatch = line.match(/^deactivate\s+(\S+)$/i);
      if (deactivateMatch) {
        messages.push({ type: 'deactivate', target: deactivateMatch[1].trim() });
        continue;
      }

      // Create message
      var createMatch = line.match(/^create\s+(?:participant\s+)?(.+)$/i);
      if (createMatch) {
        var createTarget = createMatch[1].trim();
        messages.push({ type: 'create', target: createTarget });
        continue;
      }

      // Destroy
      var destroyMatch = line.match(/^destroy\s+(.+)$/i);
      if (destroyMatch) {
        messages.push({ type: 'destroy', target: destroyMatch[1].trim() });
        continue;
      }

      // Note (single-line)
      var noteMatch = line.match(/^note\s+(left|right|over)\s+(?:of\s+)?(.+?):\s*(.+)$/i);
      if (noteMatch) {
        messages.push({ type: 'note', position: noteMatch[1].toLowerCase(), target: noteMatch[2].trim(), lines: [noteMatch[3].trim()] });
        continue;
      }
      // Note (multi-line)
      var noteMulti = line.match(/^note\s+(left|right|over)\s+(?:of\s+)?(\S+)\s*$/i);
      if (noteMulti) {
        var noteLines = [];
        for (i++; i < lines.length; i++) {
          var nl = lines[i].trim();
          if (/^end\s*note$/i.test(nl)) break;
          if (nl && nl !== '@enduml') noteLines.push(lines[i].replace(/^\s{0,4}/, ''));
          }
        messages.push({ type: 'note', position: noteMulti[1].toLowerCase(), target: noteMulti[2].trim(), lines: noteLines.length > 0 ? noteLines : [''] });
        continue;
      }

      // Lost message: sender ->o : label
      var lostMatch = line.match(/^(\S+)\s+->o\s*(?::\s*(.*))?$/);
      if (lostMatch) {
        var lostFrom = lostMatch[1];
        var lostLabel = (lostMatch[2] || '').trim();
        ensureParticipant(lostFrom, participants, participantMap, autoParticipants);
        messages.push({ type: 'lost', from: lostFrom, label: lostLabel });
        continue;
      }

      // Found message: o-> receiver : label
      var foundMatch = line.match(/^o->\s+(\S+)\s*(?::\s*(.*))?$/);
      if (foundMatch) {
        var foundTo = foundMatch[1];
        var foundLabel = (foundMatch[2] || '').trim();
        ensureParticipant(foundTo, participants, participantMap, autoParticipants);
        messages.push({ type: 'found', to: foundTo, label: foundLabel });
        continue;
      }

      // Message arrow: from ARROW to : label
      var msgMatch = line.match(/^(\S+)\s+(--?>|--?>>|<--?|<<--?|->\s*\*|->x)\s+(\S+)\s*(?::\s*(.*))?$/);
      if (msgMatch) {
        var from = msgMatch[1];
        var arrow = msgMatch[2];
        var to = msgMatch[3];
        var msgLabel = (msgMatch[4] || '').trim();

        // Ensure participants exist
        ensureParticipant(from, participants, participantMap, autoParticipants);
        ensureParticipant(to, participants, participantMap, autoParticipants);

        // Left-pointing arrows: swap from/to so rendering direction is correct
        var isLeftArrow = arrow === '<--' || arrow === '<-' || arrow === '<<--' || arrow === '<<-';
        if (isLeftArrow) { var tmp = from; from = to; to = tmp; }

        var msgType = 'sync'; // default
        var isDashed = false;
        if (arrow === '-->' || arrow === '<--') { msgType = 'response'; isDashed = true; }
        else if (arrow === '->>' || arrow === '->>') { msgType = 'async'; }
        else if (arrow === '->') { msgType = 'sync'; }

        messages.push({
          type: 'message',
          from: from,
          to: to,
          label: msgLabel,
          msgType: msgType,
          isDashed: isDashed,
        });
        continue;
      }
    }

    return { participants: participants, messages: messages };
  }

  function ensureParticipant(id, participants, participantMap, auto) {
    if (!participantMap.hasOwnProperty(id)) {
      participantMap[id] = participants.length;
      participants.push({ id: id, label: id });
      auto[id] = true;
    }
  }

  // ─── Layout & Render ──────────────────────────────────────────────

  function render(container, text, options) {
    var parsed = parse(text);
    if (!parsed.participants || parsed.participants.length === 0) {
      container.innerHTML = '<div style="padding:20px;color:#888;text-align:center;">No participants to display.</div>';
      return;
    }
    if (!container.classList.contains('uml-class-diagram-container')) {
      container.classList.add('uml-class-diagram-container');
    }

    var colors = UMLShared.getThemeColors(container);
    var svg = generateSequenceSVG(parsed, colors);
    container.innerHTML = svg;
    UMLShared.autoFitSVG(container);
  }

  function generateSequenceSVG(parsed, colors) {
    var participants = parsed.participants;
    var messages = parsed.messages;

    // ── Measure participant boxes ──
    var partWidths = [];
    var partMaxW = 0;
    for (var pi = 0; pi < participants.length; pi++) {
      var part = participants[pi];
      var displayText = (part.id !== part.label) ? (part.id + ': ' + part.label) : part.label;
      var pw = UMLShared.textWidth(displayText, true, CFG.fontSizeBold) + CFG.participantPadX * 2;
      pw = Math.max(pw, CFG.participantMinW);
      partWidths.push(pw);
      partMaxW = Math.max(partMaxW, pw);
    }
    var partH = CFG.participantPadY * 2 + CFG.lineHeight;
    // Expand partH if any actors present (stick figures are taller)
    for (var api = 0; api < participants.length; api++) {
      if (participants[api].isActor) {
        partH = Math.max(partH, UMLShared.ACTOR_H + CFG.fontSizeBold + 8);
        break;
      }
    }

    // ── Compute participant X positions ──
    var partX = []; // center X of each participant
    var curX = CFG.svgPad;
    for (var pi2 = 0; pi2 < participants.length; pi2++) {
      var w = partWidths[pi2];
      partX.push(curX + w / 2);
      curX += w + CFG.participantGap;
    }
    var totalW = curX - CFG.participantGap + CFG.svgPad;

    // ── Process messages to compute Y positions ──
    var curY = CFG.svgPad + partH + 20; // Start below participant boxes
    var msgYs = [];
    var fragmentStack = [];    // Stack of { startY, type, condition, elseYs }
    var fragments = [];        // Completed fragments for rendering
    var createYs = {};         // participant id -> Y where created mid-diagram

    // Helper to find participant index by id
    function findPIdxByName(id) {
      for (var fp = 0; fp < participants.length; fp++) {
        if (participants[fp].id === id) return fp;
      }
      return 0;
    }

    for (var mi = 0; mi < messages.length; mi++) {
      var msg = messages[mi];

      if (msg.type === 'message') {
        msgYs.push(curY);
        curY += CFG.messageGapY;
        // Track which participants are involved in ALL open fragments (not just innermost)
        if (fragmentStack.length > 0) {
          var fpi1 = findPIdxByName(msg.from);
          var fpi2 = findPIdxByName(msg.to);
          for (var fsi = 0; fsi < fragmentStack.length; fsi++) {
            fragmentStack[fsi].minPIdx = Math.min(fragmentStack[fsi].minPIdx, fpi1, fpi2);
            fragmentStack[fsi].maxPIdx = Math.max(fragmentStack[fsi].maxPIdx, fpi1, fpi2);
          }
        }
      } else if (msg.type === 'fragment_start') {
        fragmentStack.push({ startY: curY - 15, fragType: msg.fragType, condition: msg.condition, elseYs: [], minPIdx: Infinity, maxPIdx: -Infinity, depth: fragmentStack.length });
        curY += CFG.fragmentLabelH;
        // Extra space for condition text below the tab
        if (msg.condition) curY += 18;
        msgYs.push(curY);
      } else if (msg.type === 'fragment_else') {
        if (fragmentStack.length > 0) {
          fragmentStack[fragmentStack.length - 1].elseYs.push({ y: curY, condition: msg.condition });
        }
        // Space for the dashed divider line + condition label + gap before next message
        curY += msg.condition ? 30 : 16;
        msgYs.push(curY);
      } else if (msg.type === 'fragment_end') {
        if (fragmentStack.length > 0) {
          var frag = fragmentStack.pop();
          frag.endY = curY + 15;
          fragments.push(frag);
          // Propagate participant coverage to parent fragment
          if (fragmentStack.length > 0) {
            var parentFrag = fragmentStack[fragmentStack.length - 1];
            if (frag.minPIdx < Infinity) {
              parentFrag.minPIdx = Math.min(parentFrag.minPIdx, frag.minPIdx);
            }
            if (frag.maxPIdx > -Infinity) {
              parentFrag.maxPIdx = Math.max(parentFrag.maxPIdx, frag.maxPIdx);
            }
          }
        }
        curY += 20;
        msgYs.push(curY);
      } else if (msg.type === 'lost' || msg.type === 'found') {
        msgYs.push(curY);
        curY += CFG.messageGapY;
        if (fragmentStack.length > 0) {
          var lfIdx = findPIdxByName(msg.from || msg.to);
          for (var fsi2 = 0; fsi2 < fragmentStack.length; fsi2++) {
            fragmentStack[fsi2].minPIdx = Math.min(fragmentStack[fsi2].minPIdx, lfIdx);
            fragmentStack[fsi2].maxPIdx = Math.max(fragmentStack[fsi2].maxPIdx, lfIdx);
          }
        }
      } else if (msg.type === 'activate') {
        msgYs.push(curY);
      } else if (msg.type === 'deactivate') {
        msgYs.push(curY);
      } else if (msg.type === 'destroy') {
        msgYs.push(curY);
        curY += CFG.messageGapY;
      } else if (msg.type === 'note') {
        msgYs.push(curY);
        var noteH = UMLShared.measureNote(msg.lines || [msg.text || '']).height;
        curY += Math.max(noteH + 10, CFG.messageGapY);
      } else if (msg.type === 'create') {
        createYs[msg.target] = curY;
        msgYs.push(curY);
        curY += partH + 10;
      } else {
        msgYs.push(curY);
        curY += CFG.messageGapY / 2;
      }
    }

    // Ensure totalH accounts for all fragment endY values
    var maxFragEnd = 0;
    for (var fhi = 0; fhi < fragments.length; fhi++) {
      if (fragments[fhi].endY > maxFragEnd) maxFragEnd = fragments[fhi].endY;
    }
    var totalH = Math.max(curY, maxFragEnd) + 30; // Bottom padding

    // Add extra horizontal padding when fragments exist so their borders
    // are not clipped at the SVG edge (fragments extend beyond participants)
    if (fragments.length > 0) {
      var extraPad = 25;
      for (var si = 0; si < partX.length; si++) {
        partX[si] += extraPad;
      }
      totalW += extraPad * 2;
    }

    // Expand SVG width if self-message labels extend beyond the right edge
    var selfW = 40;
    var halfAct = CFG.activationW / 2;
    for (var smi = 0; smi < messages.length; smi++) {
      var sm = messages[smi];
      if (sm.type === 'message' && sm.from === sm.to && sm.label) {
        var smIdx = findPIdxByName(sm.from);
        var selfLabelW = UMLShared.textWidth(sm.label, false, CFG.fontSize);
        var selfRightEdge = partX[smIdx] + halfAct + selfW + 6 + selfLabelW + CFG.svgPad;
        if (selfRightEdge > totalW) {
          totalW = selfRightEdge;
        }
      }
    }

    // Expand SVG for lost messages (extend right) and found messages (extend left)
    var hasFoundMsg = false;
    for (var lfmi = 0; lfmi < messages.length; lfmi++) {
      var lfm = messages[lfmi];
      if (lfm.type === 'lost') {
        var lmIdx = findPIdxByName(lfm.from);
        var lostRightEdge = partX[lmIdx] + halfAct + CFG.lostFoundGap + CFG.lostFoundRadius + CFG.svgPad;
        if (lostRightEdge > totalW) totalW = lostRightEdge;
      } else if (lfm.type === 'found') {
        hasFoundMsg = true;
      }
    }
    if (hasFoundMsg) {
      var foundPad = CFG.lostFoundGap + CFG.lostFoundRadius + CFG.svgPad;
      for (var fpi = 0; fpi < partX.length; fpi++) {
        partX[fpi] += foundPad;
      }
      totalW += foundPad;
    }

    // ── Compute activation bars ──
    // Supports both explicit (activate/deactivate) and implicit (sync call activates
    // target, response deactivates source of original call).
    var activationBars = [];
    var activeStarts = {}; // participantId -> [{y, depth} stack]

    function findPIdx(id) {
      for (var p = 0; p < participants.length; p++) {
        if (participants[p].id === id) return p;
      }
      return 0;
    }

    // If the diagram uses any explicit activate/deactivate, disable implicit activation
    // from sync/response arrows (matching PlantUML behaviour — no accidental stacking).
    var hasExplicitActivation = false;
    for (var eai = 0; eai < messages.length; eai++) {
      if (messages[eai].type === 'activate' || messages[eai].type === 'deactivate') {
        hasExplicitActivation = true; break;
      }
    }

    for (var ai = 0; ai < messages.length; ai++) {
      var am = messages[ai];

      if (am.type === 'activate') {
        // Explicit activate
        if (!activeStarts[am.target]) activeStarts[am.target] = [];
        var depthA = activeStarts[am.target].length;
        activeStarts[am.target].push({ y: msgYs[ai], depth: depthA });

      } else if (am.type === 'deactivate') {
        // Explicit deactivate
        if (activeStarts[am.target] && activeStarts[am.target].length > 0) {
          var entryD = activeStarts[am.target].pop();
          activationBars.push({ pIdx: findPIdx(am.target), startY: entryD.y, endY: msgYs[ai], depth: entryD.depth });
        }

      } else if (am.type === 'message' && !hasExplicitActivation) {
        // Implicit activation: only when no explicit activate/deactivate in diagram
        if (am.msgType === 'sync' && am.from !== am.to) {
          if (!activeStarts[am.to]) activeStarts[am.to] = [];
          var depthS = activeStarts[am.to].length;
          activeStarts[am.to].push({ y: msgYs[ai], depth: depthS });
        } else if (am.msgType === 'response' && am.from !== am.to) {
          if (activeStarts[am.from] && activeStarts[am.from].length > 0) {
            var entryR = activeStarts[am.from].pop();
            activationBars.push({ pIdx: findPIdx(am.from), startY: entryR.y, endY: msgYs[ai], depth: entryR.depth });
          }
        }
      }
    }

    // Close any still-open activations at the bottom of the diagram
    for (var openId in activeStarts) {
      while (activeStarts[openId].length > 0) {
        var oEntry = activeStarts[openId].pop();
        activationBars.push({ pIdx: findPIdx(openId), startY: oEntry.y, endY: totalH - 20, depth: oEntry.depth });
      }
    }

    // ── Build SVG ──
    var svg = [];
    svg.push(UMLShared.svgOpen(totalW, totalH, 0, 0, CFG.fontFamily));
    // ── Collect destroy Y positions per participant ──
    var destroyYs = {};
    for (var dsi = 0; dsi < messages.length; dsi++) {
      if (messages[dsi].type === 'destroy') {
        destroyYs[messages[dsi].target] = msgYs[dsi];
      }
    }

    // ── Draw lifelines (dashed vertical lines, adjusted for create/destroy) ──
    var lifelineTop = CFG.svgPad + partH;
    var lifelineBot = totalH - 10;
    for (var li = 0; li < participants.length; li++) {
      var pid = participants[li].id;
      var llTop = createYs.hasOwnProperty(pid) ? createYs[pid] + partH : lifelineTop;
      var llBot = destroyYs.hasOwnProperty(pid) ? destroyYs[pid] : lifelineBot;
      svg.push('<line x1="' + partX[li] + '" y1="' + llTop + '" x2="' + partX[li] + '" y2="' + llBot +
        '" stroke="' + colors.line + '" stroke-width="1" stroke-dasharray="' + CFG.lifelineDash + '"/>');
    }

    // ── Draw activation bars (execution specifications) ──
    // Sort depth ascending so deeper (higher depth) bars are drawn on top
    activationBars.sort(function(a, b) { return (a.depth || 0) - (b.depth || 0); });
    for (var abi = 0; abi < activationBars.length; abi++) {
      var ab = activationBars[abi];
      var abx = partX[ab.pIdx] - CFG.activationW / 2 + (ab.depth || 0) * CFG.activationOffset;
      svg.push('<rect x="' + abx + '" y="' + ab.startY + '" width="' + CFG.activationW +
        '" height="' + (ab.endY - ab.startY) +
        '" fill="' + colors.fill + '" stroke="' + colors.stroke + '" stroke-width="1"/>');
    }

    // ── Draw combined fragments (outer first, inner on top for proper nesting) ──
    var guardSvg = []; // guard condition texts rendered on top of everything
    for (var fi = fragments.length - 1; fi >= 0; fi--) {
      var frag = fragments[fi];
      // Fragment spans only the involved participants (with padding + nesting inset)
      var fragPadH = 20;
      var nestInset = (frag.depth || 0) * 8;
      var fragL, fragR;
      if (frag.minPIdx <= frag.maxPIdx) {
        fragL = partX[frag.minPIdx] - partWidths[frag.minPIdx] / 2 - fragPadH + nestInset;
        fragR = partX[frag.maxPIdx] + partWidths[frag.maxPIdx] / 2 + fragPadH - nestInset;
      } else {
        // No messages in fragment (empty), use full width as fallback
        fragL = CFG.svgPad - 5 + nestInset;
        fragR = totalW - CFG.svgPad + 5 - nestInset;
      }
      // Ensure fragment is wide enough for its label and condition text
      var labelW0 = UMLShared.textWidth(frag.fragType.toUpperCase(), true, CFG.fontSizeFragment) + 16;
      var condW0 = frag.condition ? UMLShared.textWidth('[' + frag.condition + ']', false, CFG.fontSizeFragment) + 20 : 0;
      var minFragW = Math.max(labelW0, condW0) + 20;
      if (fragR - fragL < minFragW) {
        fragR = fragL + minFragW;
      }
      var fragW = fragR - fragL;

      // Fragment border
      svg.push('<rect x="' + fragL + '" y="' + frag.startY + '" width="' + fragW +
        '" height="' + (frag.endY - frag.startY) +
        '" fill="none" stroke="' + colors.line + '" stroke-width="1"/>');

      // Fragment label — pentagon/tab shape with folded corner
      var labelW = UMLShared.textWidth(frag.fragType.toUpperCase(), true, CFG.fontSizeFragment) + 16;
      var lh = CFG.fragmentLabelH;
      var foldSize = 6;
      var lx = fragL, ly = frag.startY;
      // Pentagon: top-left, top-right, fold point, bottom-right, bottom-left
      svg.push('<polygon points="' +
        lx + ',' + ly + ' ' +
        (lx + labelW) + ',' + ly + ' ' +
        (lx + labelW) + ',' + (ly + lh - foldSize) + ' ' +
        (lx + labelW - foldSize) + ',' + (ly + lh) + ' ' +
        lx + ',' + (ly + lh) +
        '" fill="' + colors.headerFill + '" stroke="' + colors.line + '" stroke-width="1"/>');
      svg.push('<text x="' + (lx + 8) + '" y="' + (ly + lh - 7) +
        '" font-size="' + CFG.fontSizeFragment + '" font-weight="bold" fill="' + colors.text + '">' +
        UMLShared.escapeXml(frag.fragType.toUpperCase()) + '</text>');

      // Condition text — deferred to render on top of everything
      if (frag.condition) {
        guardSvg.push('<text x="' + (fragL + 10) + '" y="' + (ly + lh + 14) +
          '" font-size="' + CFG.fontSizeFragment + '" fill="' + colors.text +
          '" stroke="' + colors.fill + '" stroke-width="3" stroke-opacity="0.85" paint-order="stroke">[' +
          UMLShared.escapeXml(frag.condition) + ']</text>');
      }

      // Else divider lines
      for (var ei = 0; ei < frag.elseYs.length; ei++) {
        var ey = frag.elseYs[ei].y;
        svg.push('<line x1="' + fragL + '" y1="' + ey + '" x2="' + fragR + '" y2="' + ey +
          '" stroke="' + colors.line + '" stroke-width="1" stroke-dasharray="6,4"/>');
        if (frag.elseYs[ei].condition) {
          guardSvg.push('<text x="' + (fragL + 10) + '" y="' + (ey + 16) +
            '" font-size="' + CFG.fontSizeFragment + '" fill="' + colors.text +
            '" stroke="' + colors.fill + '" stroke-width="3" stroke-opacity="0.85" paint-order="stroke">[' +
            UMLShared.escapeXml(frag.elseYs[ei].condition) + ']</text>');
        }
      }
    }

    // ── Draw messages ──
    var msgIdx = 0;
    for (var mi2 = 0; mi2 < messages.length; mi2++) {
      var m = messages[mi2];
      var my = msgYs[mi2];

      if (m.type === 'message') {
        var fromIdx = 0, toIdx = 0;
        for (var p = 0; p < participants.length; p++) {
          if (participants[p].id === m.from) fromIdx = p;
          if (participants[p].id === m.to) toIdx = p;
        }
        var x1 = partX[fromIdx];
        var x2 = partX[toIdx];
        var isLeft = x2 < x1;
        var halfAct = CFG.activationW / 2;

        // Offset outgoing sync arrows to start from activation bar edge.
        // Response arrows (dashed) stay at lifeline center.
        if (fromIdx !== toIdx && !m.isDashed) {
          if (isLeft) {
            x1 -= halfAct;
          } else {
            x1 += halfAct;
          }
        }

        // Self-message
        if (fromIdx === toIdx) {
          var selfW = 40;
          var selfX = partX[fromIdx] + halfAct; // start from right edge of activation bar
          svg.push('<polyline points="' + selfX + ',' + my + ' ' + (selfX + selfW) + ',' + my + ' ' +
            (selfX + selfW) + ',' + (my + 20) + ' ' + selfX + ',' + (my + 20) +
            '" fill="none" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth +
            '"' + (m.isDashed ? ' stroke-dasharray="6,4"' : '') + '/>');
          drawMsgArrow(svg, selfX, my + 20, 1, m.msgType, colors);
          if (m.label) {
            svg.push('<text x="' + (selfX + selfW + 6) + '" y="' + (my + 4) +
              '" font-size="' + CFG.fontSize + '" fill="' + colors.text +
              '" stroke="' + colors.fill + '" stroke-width="3" stroke-opacity="0.85" paint-order="stroke">' + UMLShared.escapeXml(m.label) + '</text>');
          }
        } else {
          // Line
          var dashAttr = m.isDashed ? ' stroke-dasharray="6,4"' : '';
          svg.push('<line x1="' + x1 + '" y1="' + my + '" x2="' + x2 + '" y2="' + my +
            '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"' + dashAttr + '/>');

          // Arrowhead at target end
          var arrowDir = isLeft ? 1 : -1;
          drawMsgArrow(svg, x2, my, arrowDir, m.msgType, colors);

          // Label above the line
          if (m.label) {
            var labelX = (x1 + x2) / 2;
            svg.push('<text x="' + labelX + '" y="' + (my - 6) +
              '" text-anchor="middle" font-size="' + CFG.fontSize + '" fill="' + colors.text +
              '" stroke="' + colors.fill + '" stroke-width="3" stroke-opacity="0.85" paint-order="stroke">' +
              UMLShared.escapeXml(m.label) + '</text>');
          }
        }
      } else if (m.type === 'create') {
        // Draw the created participant box at this Y position
        var cIdx = findPIdx(m.target);
        var cpx = partX[cIdx] - partWidths[cIdx] / 2;
        var cpart = participants[cIdx];
        svg.push('<rect x="' + cpx + '" y="' + my + '" width="' + partWidths[cIdx] + '" height="' + partH +
          '" fill="' + colors.headerFill + '" stroke="' + colors.stroke + '" stroke-width="' + CFG.strokeWidth + '"/>');
        var cDispText = (cpart.id !== cpart.label) ? cpart.id + ': ' + cpart.label : cpart.label;
        var cTextY = my + partH / 2 + CFG.fontSize * 0.35;
        svg.push('<text x="' + partX[cIdx] + '" y="' + cTextY +
          '" text-anchor="middle" font-weight="bold" font-size="' + CFG.fontSizeBold + '" fill="' + colors.text + '">' +
          UMLShared.escapeXml(cDispText) + '</text>');
        // Draw dashed arrow from previous sender to the created box
        if (mi2 > 0 && messages[mi2 - 1].type === 'message') {
          var prevMsg = messages[mi2 - 1];
          var senderIdx = findPIdx(prevMsg.from);
          var sx = partX[senderIdx] + CFG.activationW / 2;
          var tx = partX[cIdx] - partWidths[cIdx] / 2;
          var arrowY = my + partH / 2;
          svg.push('<line x1="' + sx + '" y1="' + arrowY + '" x2="' + tx + '" y2="' + arrowY +
            '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '" stroke-dasharray="6,4"/>');
          drawMsgArrow(svg, tx, arrowY, 1, 'sync', colors);
        }
      } else if (m.type === 'destroy') {
        // Draw X mark on the participant
        var dIdx = 0;
        for (var dp = 0; dp < participants.length; dp++) {
          if (participants[dp].id === m.target) { dIdx = dp; break; }
        }
        var dx = partX[dIdx];
        var ds = CFG.destroySize;
        svg.push('<line x1="' + (dx - ds) + '" y1="' + (my - ds) + '" x2="' + (dx + ds) + '" y2="' + (my + ds) +
          '" stroke="' + colors.line + '" stroke-width="2"/>');
        svg.push('<line x1="' + (dx + ds) + '" y1="' + (my - ds) + '" x2="' + (dx - ds) + '" y2="' + (my + ds) +
          '" stroke="' + colors.line + '" stroke-width="2"/>');
      } else if (m.type === 'lost') {
        // Lost message: line from sender to a filled circle
        var lIdx = findPIdx(m.from);
        var lx1 = partX[lIdx] + CFG.activationW / 2;
        var lx2 = lx1 + CFG.lostFoundGap;
        var lr = CFG.lostFoundRadius;
        svg.push('<line x1="' + lx1 + '" y1="' + my + '" x2="' + (lx2 - lr) + '" y2="' + my +
          '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"/>');
        drawMsgArrow(svg, lx2 - lr, my, -1, 'sync', colors);
        svg.push('<circle cx="' + lx2 + '" cy="' + my + '" r="' + lr +
          '" fill="' + colors.line + '" stroke="' + colors.line + '"/>');
        if (m.label) {
          var llabelX = (lx1 + lx2) / 2;
          svg.push('<text x="' + llabelX + '" y="' + (my - 6) +
            '" text-anchor="middle" font-size="' + CFG.fontSize + '" fill="' + colors.text +
            '" stroke="' + colors.fill + '" stroke-width="3" stroke-opacity="0.85" paint-order="stroke">' +
            UMLShared.escapeXml(m.label) + '</text>');
        }
      } else if (m.type === 'found') {
        // Found message: filled circle to receiver
        var fIdx = findPIdx(m.to);
        var fx2 = partX[fIdx] - CFG.activationW / 2;
        var fx1 = fx2 - CFG.lostFoundGap;
        var fr = CFG.lostFoundRadius;
        svg.push('<circle cx="' + fx1 + '" cy="' + my + '" r="' + fr +
          '" fill="' + colors.line + '" stroke="' + colors.line + '"/>');
        svg.push('<line x1="' + (fx1 + fr) + '" y1="' + my + '" x2="' + fx2 + '" y2="' + my +
          '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"/>');
        drawMsgArrow(svg, fx2, my, -1, 'sync', colors);
        if (m.label) {
          var flabelX = (fx1 + fx2) / 2;
          svg.push('<text x="' + flabelX + '" y="' + (my - 6) +
            '" text-anchor="middle" font-size="' + CFG.fontSize + '" fill="' + colors.text +
            '" stroke="' + colors.fill + '" stroke-width="3" stroke-opacity="0.85" paint-order="stroke">' +
            UMLShared.escapeXml(m.label) + '</text>');
        }
      } else if (m.type === 'note') {
        // Draw note box near the target participant
        var noteLines = m.lines || [m.text || ''];
        var nIdx = findPIdx(m.target);
        var noteSize = UMLShared.measureNote(noteLines);
        var noteX, noteY = my;
        var connFromX, connToX;
        if (m.position === 'left') {
          noteX = partX[nIdx] - CFG.activationW / 2 - UMLShared.NOTE_CFG.gap - noteSize.width;
          connFromX = noteX + noteSize.width;
          connToX = partX[nIdx] - CFG.activationW / 2;
        } else if (m.position === 'right') {
          noteX = partX[nIdx] + CFG.activationW / 2 + UMLShared.NOTE_CFG.gap;
          connFromX = noteX;
          connToX = partX[nIdx] + CFG.activationW / 2;
        } else { // over
          noteX = partX[nIdx] - noteSize.width / 2;
          connFromX = null; // no connector for 'over'
          connToX = null;
        }
        var connector = null;
        if (connFromX !== null) {
          connector = { fromX: connFromX, fromY: noteY + noteSize.height / 2,
                        toX: connToX, toY: noteY + noteSize.height / 2 };
        }
        UMLShared.drawNote(svg, noteX, noteY, noteLines, colors, connector);
      }
    }

    // ── Draw participant boxes (top, skip created participants) ──
    drawParticipantBoxes(svg, participants, partX, partWidths, partH, CFG.svgPad, colors, createYs);

    // ── Guard conditions on top of everything ──
    for (var gi = 0; gi < guardSvg.length; gi++) svg.push(guardSvg[gi]);

    svg.push(UMLShared.svgClose());
    return svg.join('\n');
  }

  function drawParticipantBoxes(svg, participants, partX, partWidths, partH, y, colors, createYs) {
    for (var i = 0; i < participants.length; i++) {
      // Skip participants that are created mid-diagram (drawn inline)
      if (createYs && createYs.hasOwnProperty(participants[i].id)) continue;
      var px = partX[i] - partWidths[i] / 2;
      var part = participants[i];
      var displayText = part.label;
      var isInstance = (part.id !== part.label);
      if (isInstance) displayText = part.id + ': ' + part.label;

      if (part.isActor) {
        // Stick figure actor
        UMLShared.drawActorStickFigure(svg, partX[i], y + 2, colors, CFG.strokeWidth);
        var actorTextY = y + UMLShared.ACTOR_H + CFG.fontSizeBold + 2;
        svg.push('<text x="' + partX[i] + '" y="' + actorTextY +
          '" text-anchor="middle" font-weight="bold" font-size="' + CFG.fontSizeBold + '" fill="' + colors.text + '">' +
          UMLShared.escapeXml(displayText) + '</text>');
      } else {
        // Rectangle participant
        svg.push('<rect x="' + px + '" y="' + y + '" width="' + partWidths[i] + '" height="' + partH +
          '" fill="' + colors.headerFill + '" stroke="' + colors.stroke + '" stroke-width="' + CFG.strokeWidth + '"/>');
        var textY = y + partH / 2 + CFG.fontSize * 0.35;
        svg.push('<text x="' + partX[i] + '" y="' + textY +
          '" text-anchor="middle" font-weight="bold" font-size="' + CFG.fontSizeBold + '" fill="' + colors.text + '"' +
          (isInstance ? ' text-decoration="underline"' : '') + '>' +
          UMLShared.escapeXml(displayText) + '</text>');
      }
    }
  }

  function drawMsgArrow(svg, x, y, dir, msgType, colors) {
    // dir: 1 = pointing right, -1 = pointing left
    var as = CFG.arrowSize;
    var hw = as * 0.4;

    if (msgType === 'sync') {
      // Filled triangle
      svg.push('<polygon points="' +
        x + ',' + y + ' ' +
        (x + dir * as) + ',' + (y - hw) + ' ' +
        (x + dir * as) + ',' + (y + hw) +
        '" fill="' + colors.line + '" stroke="none"/>');
    } else {
      // Open arrowhead (async or response)
      svg.push('<polyline points="' +
        (x + dir * as) + ',' + (y - hw) + ' ' +
        x + ',' + y + ' ' +
        (x + dir * as) + ',' + (y + hw) +
        '" fill="none" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"/>');
    }
  }

  // ─── Auto-init ────────────────────────────────────────────────────

  UMLShared.createAutoInit('pre > code.language-uml-sequence', render);

  // ─── Export ────────────────────────────────────────────────────────

  window.UMLSequenceDiagram = {
    render: render,
    parse: parse,
  };

})();
