/**
 * UML Shared Utilities
 *
 * Common functions and configuration shared across all UML diagram renderers.
 * Must be loaded BEFORE any individual renderer script.
 */
(function () {
  'use strict';

  // ─── Base Configuration ─────────────────────────────────────────

  var BASE_CFG = {
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    fontSize: 14,
    fontSizeBold: 15,
    lineHeight: 22,
    arrowSize: 10,
    strokeWidth: 1.5,
    svgPad: 30,
    labelBgPad: 4,
  };

  // ─── Text Measurement ───────────────────────────────────────────

  var _ctx = null;
  function textWidth(text, bold, fontSize, fontFamily) {
    if (!_ctx) _ctx = document.createElement('canvas').getContext('2d');
    var fs = fontSize || BASE_CFG.fontSize;
    var ff = fontFamily || BASE_CFG.fontFamily;
    _ctx.font = (bold ? 'bold ' : '') + fs + 'px ' + ff;
    return _ctx.measureText(text).width;
  }

  // ─── XML Escaping ───────────────────────────────────────────────

  function escapeXml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ─── Theme Colors ───────────────────────────────────────────────

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

  // ─── SVG Wrapper ────────────────────────────────────────────────

  function svgOpen(w, h, ox, oy, fontFamily) {
    var ff = fontFamily || BASE_CFG.fontFamily;
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" ' +
      'viewBox="0 0 ' + w + ' ' + h + '" ' +
      'style="font-family: ' + ff + '; max-width: none;">' +
      '<g transform="translate(' + ox + ',' + oy + ')">';
  }

  function svgClose() {
    return '</g></svg>';
  }

  // ─── Auto-Init Factory ─────────────────────────────────────────

  /**
   * Creates an autoInit function for a UML renderer.
   * @param {string} selector  CSS selector for code blocks (e.g. 'pre > code.language-uml-state')
   * @param {function} renderFn  The render(container, text) function
   * @param {object} [opts]  Options
   * @param {function} [opts.extractText]  Custom text extraction (default: el.textContent)
   * @returns {{ init: function, diagrams: Array }}
   */
  function createAutoInit(selector, renderFn, opts) {
    var diagrams = [];
    var extractText = (opts && opts.extractText) || function (el) { return el.textContent; };

    function init() {
      var blocks = document.querySelectorAll(selector);
      for (var i = 0; i < blocks.length; i++) {
        var codeEl = blocks[i];
        var pre = codeEl.parentElement;
        var text = extractText(codeEl);
        var container = document.createElement('div');
        container.className = 'uml-class-diagram-container';
        pre.parentElement.replaceChild(container, pre);
        renderFn(container, text);
        diagrams.push({ container: container, text: text });
      }
      var observer = new MutationObserver(function (mutations) {
        for (var m = 0; m < mutations.length; m++) {
          if (mutations[m].attributeName === 'class') {
            setTimeout(function () {
              for (var d = 0; d < diagrams.length; d++) renderFn(diagrams[d].container, diagrams[d].text);
            }, 50);
            break;
          }
        }
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }

    return { diagrams: diagrams };
  }

  // ─── Note Drawing ───────────────────────────────────────────────

  var NOTE_CFG = {
    padX: 14,
    padY: 10,
    foldSize: 10,
    fontSize: 13,
    codeFontSize: 12,
    lineHeight: 18,
    codeFont: "'Consolas','Monaco','Courier New',monospace",
    connectorDash: '1,5',
    circleR: 3,
    gap: 20,
  };

  /**
   * Draw a dog-eared note rectangle (folded top-right corner).
   */
  function drawNoteBox(svg, x, y, w, h, colors) {
    var f = NOTE_CFG.foldSize;
    // Main body polygon (6 points: skip the top-right corner for the fold)
    svg.push('<polygon points="' +
      x + ',' + y + ' ' +
      (x + w - f) + ',' + y + ' ' +
      (x + w) + ',' + (y + f) + ' ' +
      (x + w) + ',' + (y + h) + ' ' +
      x + ',' + (y + h) +
      '" fill="' + colors.fill + '" stroke="' + colors.line + '" stroke-width="1"/>');
    // Fold triangle
    svg.push('<polyline points="' +
      (x + w - f) + ',' + y + ' ' +
      (x + w - f) + ',' + (y + f) + ' ' +
      (x + w) + ',' + (y + f) +
      '" fill="none" stroke="' + colors.line + '" stroke-width="1"/>');
  }

  /**
   * Draw a dotted connector line with a small circle at the target attachment point.
   */
  function drawNoteConnector(svg, fromX, fromY, toX, toY, colors) {
    svg.push('<line x1="' + fromX + '" y1="' + fromY + '" x2="' + toX + '" y2="' + toY +
      '" stroke="' + colors.line + '" stroke-width="1" stroke-linecap="round" stroke-dasharray="' + NOTE_CFG.connectorDash + '"/>');
    svg.push('<circle cx="' + toX + '" cy="' + toY + '" r="' + NOTE_CFG.circleR +
      '" fill="' + colors.fill + '" stroke="' + colors.line + '" stroke-width="1"/>');
  }

  /**
   * Measure a multi-line note. Handles fenced code blocks (```lang ... ```).
   * Returns { width, height, segments } where segments describe code vs text regions.
   */
  function measureNote(lines) {
    var maxW = 0;
    var inCode = false;
    var codeLang = '';
    var visibleLines = 0;
    var segments = []; // { type: 'text'|'code', lang, startLine, endLine }
    var segStart = 0;

    for (var i = 0; i < lines.length; i++) {
      var trimmed = lines[i].trim();
      if (trimmed.indexOf('```') === 0) {
        if (!inCode) {
          // End any preceding text segment
          if (i > segStart) segments.push({ type: 'text', startLine: segStart, endLine: i });
          codeLang = trimmed.substring(3).trim();
          inCode = true;
          segStart = i + 1;
        } else {
          // End code segment
          segments.push({ type: 'code', lang: codeLang, startLine: segStart, endLine: i });
          inCode = false;
          segStart = i + 1;
        }
        continue; // ``` markers are not rendered
      }
      var lw;
      if (inCode) {
        lw = textWidth(lines[i], false, NOTE_CFG.codeFontSize, NOTE_CFG.codeFont);
      } else {
        lw = textWidth(lines[i], false, NOTE_CFG.fontSize);
      }
      if (lw > maxW) maxW = lw;
      visibleLines++;
    }
    // Close any remaining segment
    if (segStart < lines.length) {
      segments.push({ type: inCode ? 'code' : 'text', lang: codeLang, startLine: segStart, endLine: lines.length });
    }
    // If no fenced blocks detected, single text segment
    if (segments.length === 0) {
      segments.push({ type: 'text', startLine: 0, endLine: lines.length });
      visibleLines = lines.length;
    }

    return {
      width: Math.ceil(maxW) + NOTE_CFG.padX * 2 + NOTE_CFG.foldSize,
      height: visibleLines * NOTE_CFG.lineHeight + NOTE_CFG.padY * 2,
      segments: segments,
    };
  }

  /**
   * Draw a complete note with text, dog-eared box, and connector.
   * @param {Array} svg - SVG output array
   * @param {number} noteX - top-left X of note box
   * @param {number} noteY - top-left Y of note box
   * @param {Array<string>} lines - text lines
   * @param {object} colors - theme colors
   * @param {object} [connector] - { fromX, fromY, toX, toY } for the dotted line
   * @returns {{ width: number, height: number }}
   */
  /**
   * Render a note text line with inline formatting:
   *   `code`  → monospace font
   *   $math$  → italic (LaTeX-style)
   * Returns SVG text element with tspan children for mixed formatting.
   */
  function renderNoteLine(line, x, y, fontSize, colors) {
    // Split on backtick and dollar-sign delimited segments
    var parts = [];
    var re = /(`[^`]+`|\$[^$]+\$)/g;
    var lastIdx = 0;
    var match;
    while ((match = re.exec(line)) !== null) {
      if (match.index > lastIdx) {
        parts.push({ text: line.substring(lastIdx, match.index), style: 'normal' });
      }
      var raw = match[0];
      if (raw[0] === '`') {
        parts.push({ text: raw.substring(1, raw.length - 1), style: 'code' });
      } else {
        parts.push({ text: raw.substring(1, raw.length - 1), style: 'math' });
      }
      lastIdx = re.lastIndex;
    }
    if (lastIdx < line.length) {
      parts.push({ text: line.substring(lastIdx), style: 'normal' });
    }
    if (parts.length === 0) parts.push({ text: line, style: 'normal' });

    // If no formatting, emit simple text
    if (parts.length === 1 && parts[0].style === 'normal') {
      return '<text x="' + x + '" y="' + y + '" font-size="' + fontSize + '" fill="' + colors.text + '">' +
        escapeXml(parts[0].text) + '</text>';
    }

    // Mixed formatting: use tspan children
    var out = '<text x="' + x + '" y="' + y + '" font-size="' + fontSize + '" fill="' + colors.text + '">';
    for (var p = 0; p < parts.length; p++) {
      var part = parts[p];
      if (part.style === 'code') {
        out += '<tspan font-family="\'Consolas\',\'Monaco\',\'Courier New\',monospace" fill="' + colors.text +
          '" style="font-size:' + (fontSize - 1) + 'px">' + escapeXml(part.text) + '</tspan>';
      } else if (part.style === 'math') {
        out += '<tspan font-style="italic">' + escapeXml(part.text) + '</tspan>';
      } else {
        out += escapeXml(part.text);
      }
    }
    out += '</text>';
    return out;
  }

  // ─── Syntax Highlighting ──────────────────────────────────────

  var SYNTAX_COLORS = {
    keyword: '#0033b3',
    string: '#067d17',
    comment: '#8c8c8c',
    number: '#1750eb',
    builtin: '#871094',
    decorator: '#9e880d',
  };

  var LANG_KEYWORDS = {
    python: ['def','class','if','elif','else','for','while','return','import','from','as','in','not','and','or','is',
             'with','try','except','finally','raise','pass','break','continue','yield','lambda','global','nonlocal','assert','del'],
    java: ['public','private','protected','static','final','abstract','class','interface','extends','implements',
           'new','return','if','else','for','while','do','switch','case','break','continue','try','catch','finally',
           'throw','throws','void','import','package','this','super'],
    javascript: ['function','const','let','var','return','if','else','for','while','do','switch','case','break',
                 'continue','try','catch','finally','throw','new','class','extends','import','export','default',
                 'async','await','yield','this','typeof','instanceof'],
  };
  LANG_KEYWORDS.js = LANG_KEYWORDS.javascript;
  LANG_KEYWORDS.py = LANG_KEYWORDS.python;
  LANG_KEYWORDS.cpp = ['auto','bool','break','case','catch','char','class','const','constexpr','continue',
    'default','delete','do','double','dynamic_cast','else','enum','explicit','extern','false','float','for',
    'friend','goto','if','inline','int','long','mutable','namespace','new','noexcept','nullptr','operator',
    'override','private','protected','public','register','return','short','signed','sizeof','static',
    'static_cast','struct','switch','template','this','throw','true','try','typedef','typeid','typename',
    'union','unsigned','using','virtual','void','volatile','while'];
  LANG_KEYWORDS.c = LANG_KEYWORDS.cpp;

  var LANG_BUILTINS = {
    python: ['True','False','None','self','cls','print','len','range','int','str','float','list','dict','set',
             'tuple','type','super','isinstance','hasattr','getattr','setattr','enumerate','zip','map','filter','sorted','open'],
    java: ['System','String','Integer','Boolean','Object','List','Map','Set','null','true','false',
           'Override','Deprecated','ArrayList','HashMap','HashSet','Optional','Stream','Collections'],
    javascript: ['console','document','window','Math','JSON','Array','Object','String','Number','Boolean',
                 'Promise','null','undefined','true','false','NaN','Infinity'],
    cpp: ['std','cout','cin','endl','string','vector','map','set','pair','unique_ptr','shared_ptr',
          'make_unique','make_shared','nullptr','size_t','uint8_t','int32_t'],
  };
  LANG_BUILTINS.js = LANG_BUILTINS.javascript;
  LANG_BUILTINS.py = LANG_BUILTINS.python;
  LANG_BUILTINS.c = LANG_BUILTINS.cpp;

  function tokenizeLine(line, lang) {
    var keywords = LANG_KEYWORDS[lang] || [];
    var builtins = LANG_BUILTINS[lang] || [];
    var tokens = [];
    var i = 0;
    var commentChar = (lang === 'python' || lang === 'py') ? '#' : '//';

    while (i < line.length) {
      // Whitespace — use non-breaking spaces for SVG indentation
      if (line[i] === ' ' || line[i] === '\t') {
        var ws = '';
        while (i < line.length && (line[i] === ' ' || line[i] === '\t')) {
          ws += (line[i] === '\t') ? '    ' : ' ';
          i++;
        }
        tokens.push({ text: ws, type: 'ws' });
        continue;
      }
      // Comment
      if (line.substring(i, i + commentChar.length) === commentChar) {
        tokens.push({ text: line.substring(i), type: 'comment' });
        break;
      }
      // String
      if (line[i] === '"' || line[i] === "'") {
        var q = line[i], s = q; i++;
        while (i < line.length && line[i] !== q) {
          if (line[i] === '\\' && i + 1 < line.length) { s += line[i] + line[i + 1]; i += 2; }
          else { s += line[i]; i++; }
        }
        if (i < line.length) { s += line[i]; i++; }
        tokens.push({ text: s, type: 'string' });
        continue;
      }
      // Decorator (Python)
      if (line[i] === '@' && (lang === 'python' || lang === 'py')) {
        var dec = '@'; i++;
        while (i < line.length && /\w/.test(line[i])) { dec += line[i]; i++; }
        tokens.push({ text: dec, type: 'decorator' });
        continue;
      }
      // Word
      if (/[a-zA-Z_]/.test(line[i])) {
        var word = '';
        while (i < line.length && /\w/.test(line[i])) { word += line[i]; i++; }
        if (keywords.indexOf(word) !== -1) tokens.push({ text: word, type: 'keyword' });
        else if (builtins.indexOf(word) !== -1) tokens.push({ text: word, type: 'builtin' });
        else tokens.push({ text: word, type: 'ident' });
        continue;
      }
      // Number
      if (/\d/.test(line[i])) {
        var num = '';
        while (i < line.length && /[\d.]/.test(line[i])) { num += line[i]; i++; }
        tokens.push({ text: num, type: 'number' });
        continue;
      }
      // Operator/punctuation
      tokens.push({ text: line[i], type: 'op' });
      i++;
    }
    return tokens;
  }

  function renderCodeLine(line, lang, x, y, fontSize, colors) {
    var tokens = tokenizeLine(line, lang);
    if (tokens.length === 0) {
      return '<text x="' + x + '" y="' + y + '" font-size="' + fontSize +
        '" font-family="' + NOTE_CFG.codeFont + '" fill="' + colors.text + '"> </text>';
    }
    var out = '<text x="' + x + '" y="' + y + '" font-size="' + fontSize +
      '" font-family="' + NOTE_CFG.codeFont + '" fill="' + colors.text +
      '" xml:space="preserve">';
    for (var t = 0; t < tokens.length; t++) {
      var tk = tokens[t];
      var col = SYNTAX_COLORS[tk.type];
      if (col) {
        out += '<tspan fill="' + col + '">' + escapeXml(tk.text) + '</tspan>';
      } else {
        out += escapeXml(tk.text);
      }
    }
    out += '</text>';
    return out;
  }

  // ─── Draw Note ──────────────────────────────────────────────────

  function drawNote(svg, noteX, noteY, lines, colors, connector) {
    var size = measureNote(lines);
    drawNoteBox(svg, noteX, noteY, size.width, size.height, colors);

    var textX = noteX + NOTE_CFG.padX;
    var textY = noteY + NOTE_CFG.padY + NOTE_CFG.fontSize;
    var visIdx = 0; // visible line index (skips ``` markers)

    for (var si = 0; si < size.segments.length; si++) {
      var seg = size.segments[si];
      for (var li = seg.startLine; li < seg.endLine; li++) {
        var ly = textY + visIdx * NOTE_CFG.lineHeight;
        if (seg.type === 'code') {
          svg.push(renderCodeLine(lines[li], seg.lang, textX, ly, NOTE_CFG.codeFontSize, colors));
        } else {
          svg.push(renderNoteLine(lines[li], textX, ly, NOTE_CFG.fontSize, colors));
        }
        visIdx++;
      }
    }

    if (connector) {
      drawNoteConnector(svg, connector.fromX, connector.fromY, connector.toX, connector.toY, colors);
    }
    return size;
  }

  /**
   * Parse note lines from a diagram's line array.
   * Handles both single-line and multi-line notes.
   * @param {string} line - current line
   * @param {Array<string>} allLines - all lines in the diagram
   * @param {number} lineIdx - current index
   * @param {Array} notesArray - output array to push notes into
   * @returns {number} new lineIdx (advanced past multi-line block), or -1 if not a note
   */
  function parseNoteLine(line, allLines, lineIdx, notesArray) {
    // Single-line: note left of Foo: text here
    var single = line.match(/^note\s+(left|right|top|bottom|over)\s+(?:of\s+)?(\S+)\s*:\s*(.+)$/i);
    if (single) {
      notesArray.push({
        position: single[1].toLowerCase(),
        target: single[2].trim(),
        lines: [single[3].trim()],
      });
      return lineIdx;
    }
    // Multi-line start: note left of Foo
    var multi = line.match(/^note\s+(left|right|top|bottom|over)\s+(?:of\s+)?(\S+)\s*$/i);
    if (multi) {
      var noteLines = [];
      var j = lineIdx + 1;
      while (j < allLines.length) {
        var nl = allLines[j].trim();
        if (/^end\s*note$/i.test(nl)) break;
        if (nl && nl !== '@enduml') noteLines.push(allLines[j].replace(/^\s{0,4}/, ''));
        j++;
      }
      notesArray.push({
        position: multi[1].toLowerCase(),
        target: multi[2].trim(),
        lines: noteLines.length > 0 ? noteLines : [''],
      });
      return j; // skip past "end note"
    }
    return -1; // not a note line
  }

  // ─── SVG Auto-Fit ───────────────────────────────────────────

  /**
   * After rendering SVG into a container, expand the viewBox to fit all content.
   * Call this after setting container.innerHTML = svgString.
   */
  function autoFitSVG(container, pad) {
    var svg = container.querySelector('svg');
    if (!svg) return;
    var g = svg.querySelector('g');
    if (!g) return;
    try {
      // getBBox returns local coordinates; we need to account for the <g> transform
      var bbox = g.getBBox();
      var transform = g.getAttribute('transform') || '';
      var tx = 0, ty = 0;
      var tMatch = transform.match(/translate\(\s*([\d.e+-]+)\s*,\s*([\d.e+-]+)\s*\)/);
      if (tMatch) { tx = parseFloat(tMatch[1]); ty = parseFloat(tMatch[2]); }
      var p = pad || 10;
      // Compute viewBox in SVG root coordinate space
      var actualX = bbox.x + tx;
      var actualY = bbox.y + ty;
      var vx = Math.min(0, actualX) - p;
      var vy = Math.min(0, actualY) - p;
      var vw = Math.max(actualX + bbox.width, parseFloat(svg.getAttribute('width')) || 0) - vx + p;
      var vh = Math.max(actualY + bbox.height, parseFloat(svg.getAttribute('height')) || 0) - vy + p;
      svg.setAttribute('width', Math.ceil(vw));
      svg.setAttribute('height', Math.ceil(vh));
      svg.setAttribute('viewBox', Math.floor(vx) + ' ' + Math.floor(vy) + ' ' + Math.ceil(vw) + ' ' + Math.ceil(vh));
    } catch (e) { /* getBBox can fail on hidden elements */ }
  }

  // ─── Actor Stick Figure ──────────────────────────────────────

  /**
   * Draw an actor stick figure centered at (cx, topY).
   * Returns the total height of the figure (excluding label text).
   */
  function drawActorStickFigure(svg, cx, topY, colors, sw) {
    var headR = 10;
    var bodyLen = 18;
    var armSpan = 16;
    var armY = 8;
    var legLen = 14;
    var legSpan = 12;
    var strokeW = sw || 1.5;

    var headCy = topY + headR;
    var bodyTop = headCy + headR;
    var bodyBot = bodyTop + bodyLen;
    var armBaseY = bodyTop + armY;

    svg.push('<circle cx="' + cx + '" cy="' + headCy + '" r="' + headR +
      '" fill="none" stroke="' + colors.stroke + '" stroke-width="' + strokeW + '"/>');
    svg.push('<line x1="' + cx + '" y1="' + bodyTop + '" x2="' + cx + '" y2="' + bodyBot +
      '" stroke="' + colors.stroke + '" stroke-width="' + strokeW + '"/>');
    svg.push('<line x1="' + (cx - armSpan) + '" y1="' + armBaseY + '" x2="' + (cx + armSpan) + '" y2="' + armBaseY +
      '" stroke="' + colors.stroke + '" stroke-width="' + strokeW + '"/>');
    svg.push('<line x1="' + cx + '" y1="' + bodyBot + '" x2="' + (cx - legSpan) + '" y2="' + (bodyBot + legLen) +
      '" stroke="' + colors.stroke + '" stroke-width="' + strokeW + '"/>');
    svg.push('<line x1="' + cx + '" y1="' + bodyBot + '" x2="' + (cx + legSpan) + '" y2="' + (bodyBot + legLen) +
      '" stroke="' + colors.stroke + '" stroke-width="' + strokeW + '"/>');
    return bodyBot + legLen - topY; // total height
  }

  var ACTOR_H = 10 + 10 + 18 + 14; // headR + headR + bodyLen + legLen = 52

  // ─── Export ─────────────────────────────────────────────────────

  window.UMLShared = {
    BASE_CFG: BASE_CFG,
    NOTE_CFG: NOTE_CFG,
    textWidth: textWidth,
    escapeXml: escapeXml,
    getThemeColors: getThemeColors,
    svgOpen: svgOpen,
    svgClose: svgClose,
    createAutoInit: createAutoInit,
    drawNote: drawNote,
    measureNote: measureNote,
    drawNoteConnector: drawNoteConnector,
    parseNoteLine: parseNoteLine,
    drawActorStickFigure: drawActorStickFigure,
    ACTOR_H: ACTOR_H,
    autoFitSVG: autoFitSVG,
    renderAll: function() {
      var RENDERERS = {
        class:      function () { return window.UMLClassDiagram; },
        sequence:   function () { return window.UMLSequenceDiagram; },
        state:      function () { return window.UMLStateDiagram; },
        component:  function () { return window.UMLComponentDiagram; },
        deployment: function () { return window.UMLDeploymentDiagram; },
        usecase:    function () { return window.UMLUseCaseDiagram; },
        activity:   function () { return window.UMLActivityDiagram; },
      };

      // 1. Process data-uml-type attributes
      var els = document.querySelectorAll('[data-uml-type]');
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el.dataset.umlRendered) continue;
        var type = el.getAttribute('data-uml-type');
        var spec = el.getAttribute('data-uml-spec');
        var getR = RENDERERS[type];
        if (!getR || !spec) continue;
        var R = getR();
        if (R) {
          R.render(el, spec);
          el.dataset.umlRendered = 'true';
        }
      }

      // 2. Process Markdown fenced code blocks (e.g., ```uml-class)
      for (var key in RENDERERS) {
        var selector = 'pre > code.language-uml-' + key;
        var blocks = document.querySelectorAll(selector);
        for (var j = 0; j < blocks.length; j++) {
          var codeEl = blocks[j];
          var pre = codeEl.parentElement;
          if (pre.dataset.umlRendered) continue;

          var R2 = RENDERERS[key]();
          if (R2) {
            var text = codeEl.textContent;
            var container = document.createElement('div');
            container.className = 'uml-' + key + '-diagram-container';
            pre.parentElement.replaceChild(container, pre);
            R2.render(container, text);
            container.dataset.umlRendered = 'true';
          }
        }
      }

      if (window.UMLNotation) window.UMLNotation.renderAll();
    }
  };
})();
