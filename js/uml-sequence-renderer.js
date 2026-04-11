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
    lifelineDash: '6,4',
    fragmentPadX: 10,
    fragmentPadY: 6,
    fragmentLabelW: 50,
    fragmentLabelH: 22,
    arrowSize: 10,
    svgPad: 20,
    strokeWidth: 1.5,
    destroySize: 12,
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

      // Combined fragment: alt, loop, opt, break, par, critical
      var fragMatch = line.match(/^(alt|loop|opt|break|par|critical)\s*(\[.*\])?(.*)$/i);
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

      // Note
      var noteMatch = line.match(/^note\s+(left|right|over)\s+(?:of\s+)?(.+?):\s*(.+)$/i);
      if (noteMatch) {
        messages.push({ type: 'note', position: noteMatch[1].toLowerCase(), target: noteMatch[2].trim(), text: noteMatch[3].trim() });
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

    for (var mi = 0; mi < messages.length; mi++) {
      var msg = messages[mi];

      if (msg.type === 'message') {
        msgYs.push(curY);
        curY += CFG.messageGapY;
      } else if (msg.type === 'fragment_start') {
        fragmentStack.push({ startY: curY - 15, fragType: msg.fragType, condition: msg.condition, elseYs: [] });
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
          frag.endY = curY + 10;
          fragments.push(frag);
        }
        curY += 12;
        msgYs.push(curY);
      } else if (msg.type === 'activate') {
        msgYs.push(curY);
      } else if (msg.type === 'deactivate') {
        msgYs.push(curY);
      } else if (msg.type === 'destroy') {
        msgYs.push(curY);
        curY += CFG.messageGapY;
      } else if (msg.type === 'note') {
        msgYs.push(curY);
        curY += CFG.messageGapY;
      } else {
        msgYs.push(curY);
        curY += CFG.messageGapY / 2;
      }
    }

    var totalH = curY + 20; // Bottom padding

    // ── Compute activation bars ──
    // Supports both explicit (activate/deactivate) and implicit (sync call activates
    // target, response deactivates source of original call).
    var activationBars = [];
    var activeStarts = {}; // participantId -> [startY stack]

    function findPIdx(id) {
      for (var p = 0; p < participants.length; p++) {
        if (participants[p].id === id) return p;
      }
      return 0;
    }

    for (var ai = 0; ai < messages.length; ai++) {
      var am = messages[ai];

      if (am.type === 'activate') {
        // Explicit activate
        if (!activeStarts[am.target]) activeStarts[am.target] = [];
        activeStarts[am.target].push(msgYs[ai]);

      } else if (am.type === 'deactivate') {
        // Explicit deactivate
        if (activeStarts[am.target] && activeStarts[am.target].length > 0) {
          var startAY = activeStarts[am.target].pop();
          activationBars.push({ pIdx: findPIdx(am.target), startY: startAY, endY: msgYs[ai] });
        }

      } else if (am.type === 'message') {
        if (am.msgType === 'sync' && am.from !== am.to) {
          // Sync call → activate the target at this message's Y
          if (!activeStarts[am.to]) activeStarts[am.to] = [];
          activeStarts[am.to].push(msgYs[ai]);
        } else if (am.msgType === 'response' && am.from !== am.to) {
          // Response → deactivate the sender (who was activated by an earlier sync call)
          if (activeStarts[am.from] && activeStarts[am.from].length > 0) {
            var rStartY = activeStarts[am.from].pop();
            activationBars.push({ pIdx: findPIdx(am.from), startY: rStartY, endY: msgYs[ai] });
          }
        }
      }
    }

    // Close any still-open activations at the bottom of the diagram
    for (var openId in activeStarts) {
      while (activeStarts[openId].length > 0) {
        var oStartY = activeStarts[openId].pop();
        activationBars.push({ pIdx: findPIdx(openId), startY: oStartY, endY: totalH - 20 });
      }
    }

    // ── Build SVG ──
    var svg = [];
    svg.push(UMLShared.svgOpen(totalW, totalH, 0, 0, CFG.fontFamily));
    // ── Draw lifelines (dashed vertical lines) ──
    var lifelineTop = CFG.svgPad + partH;
    var lifelineBot = totalH - 10;
    for (var li = 0; li < participants.length; li++) {
      svg.push('<line x1="' + partX[li] + '" y1="' + lifelineTop + '" x2="' + partX[li] + '" y2="' + lifelineBot +
        '" stroke="' + colors.line + '" stroke-width="1" stroke-dasharray="' + CFG.lifelineDash + '"/>');
    }

    // ── Draw activation bars (execution specifications) ──
    for (var abi = 0; abi < activationBars.length; abi++) {
      var ab = activationBars[abi];
      var abx = partX[ab.pIdx] - CFG.activationW / 2;
      svg.push('<rect x="' + abx + '" y="' + ab.startY + '" width="' + CFG.activationW +
        '" height="' + (ab.endY - ab.startY) +
        '" fill="' + colors.fill + '" stroke="' + colors.stroke + '" stroke-width="1"/>');
    }

    // ── Draw combined fragments ──
    for (var fi = 0; fi < fragments.length; fi++) {
      var frag = fragments[fi];
      // Fragment spans the full width of all participants with generous padding
      var fragL = CFG.svgPad - 5;
      var fragR = totalW - CFG.svgPad + 5;
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

      // Condition text — on the line below the label tab
      if (frag.condition) {
        svg.push('<text x="' + (fragL + 10) + '" y="' + (ly + lh + 14) +
          '" font-size="' + CFG.fontSizeFragment + '" fill="' + colors.text + '">[' +
          UMLShared.escapeXml(frag.condition) + ']</text>');
      }

      // Else divider lines
      for (var ei = 0; ei < frag.elseYs.length; ei++) {
        var ey = frag.elseYs[ei].y;
        svg.push('<line x1="' + fragL + '" y1="' + ey + '" x2="' + fragR + '" y2="' + ey +
          '" stroke="' + colors.line + '" stroke-width="1" stroke-dasharray="6,4"/>');
        if (frag.elseYs[ei].condition) {
          svg.push('<text x="' + (fragL + 10) + '" y="' + (ey + 16) +
            '" font-size="' + CFG.fontSizeFragment + '" fill="' + colors.text + '">[' +
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
            var selfLabelW = UMLShared.textWidth(m.label, false, CFG.fontSize);
            svg.push('<rect x="' + (selfX + selfW + 4) + '" y="' + (my - 7) +
              '" width="' + (selfLabelW + 6) + '" height="' + 14 +
              '" fill="' + colors.fill + '" stroke="none" opacity="0.85"/>');
            svg.push('<text x="' + (selfX + selfW + 6) + '" y="' + (my + 4) +
              '" font-size="' + CFG.fontSize + '" fill="' + colors.text + '">' + UMLShared.escapeXml(m.label) + '</text>');
          }
        } else {
          // Line
          var dashAttr = m.isDashed ? ' stroke-dasharray="6,4"' : '';
          svg.push('<line x1="' + x1 + '" y1="' + my + '" x2="' + x2 + '" y2="' + my +
            '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"' + dashAttr + '/>');

          // Arrowhead at target end
          var arrowDir = isLeft ? 1 : -1;
          drawMsgArrow(svg, x2, my, arrowDir, m.msgType, colors);

          // Label above the line with background
          if (m.label) {
            var labelX = (x1 + x2) / 2;
            var labelW = UMLShared.textWidth(m.label, false, CFG.fontSize);
            var labelBgPad = 4;
            svg.push('<rect x="' + (labelX - labelW / 2 - labelBgPad) + '" y="' + (my - 16) +
              '" width="' + (labelW + labelBgPad * 2) + '" height="' + 14 +
              '" fill="' + colors.fill + '" stroke="none" opacity="0.85"/>');
            svg.push('<text x="' + labelX + '" y="' + (my - 6) +
              '" text-anchor="middle" font-size="' + CFG.fontSize + '" fill="' + colors.text + '">' +
              UMLShared.escapeXml(m.label) + '</text>');
          }
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
      }
    }

    // ── Draw participant boxes (top only) ──
    drawParticipantBoxes(svg, participants, partX, partWidths, partH, CFG.svgPad, colors);

    svg.push(UMLShared.svgClose());
    return svg.join('\n');
  }

  function drawParticipantBoxes(svg, participants, partX, partWidths, partH, y, colors) {
    for (var i = 0; i < participants.length; i++) {
      var px = partX[i] - partWidths[i] / 2;
      var part = participants[i];

      svg.push('<rect x="' + px + '" y="' + y + '" width="' + partWidths[i] + '" height="' + partH +
        '" fill="' + colors.headerFill + '" stroke="' + colors.stroke + '" stroke-width="' + CFG.strokeWidth + '"/>');

      // Display label — if id differs from label, show "id: Label" (instance notation, underlined)
      var displayText = part.label;
      var isInstance = (part.id !== part.label);
      if (isInstance) {
        displayText = part.id + ': ' + part.label;
      }

      var textY = y + partH / 2 + CFG.fontSize * 0.35;
      svg.push('<text x="' + partX[i] + '" y="' + textY +
        '" text-anchor="middle" font-weight="bold" font-size="' + CFG.fontSizeBold + '" fill="' + colors.text + '"' +
        (isInstance ? ' text-decoration="underline"' : '') + '>' +
        UMLShared.escapeXml(displayText) + '</text>');
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
