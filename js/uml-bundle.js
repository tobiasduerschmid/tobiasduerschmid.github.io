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
      // Use SVG's own coordinate mapping to get the true bounding box
      var bbox = svg.getBBox();
      var p = pad || 10;
      var vx = Math.floor(bbox.x - p);
      var vy = Math.floor(bbox.y - p);
      var vw = Math.ceil(bbox.width + p * 2);
      var vh = Math.ceil(bbox.height + p * 2);
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

    // ─── Drawing Utilities ───────────────────────────────────────
    drawArrow: function(svg, x, y, ux, uy, color, size, sw) {
      var as = size || BASE_CFG.arrowSize;
      var strw = sw || BASE_CFG.strokeWidth;
      var hw = as * 0.35;
      var px = -uy, py = ux;
      svg.push('<polygon points="' +
        x + ',' + y + ' ' +
        (x + ux * as + px * hw) + ',' + (y + uy * as + py * hw) + ' ' +
        (x + ux * as - px * hw) + ',' + (y + uy * as - py * hw) +
        '" fill="' + color + '" stroke="none"/>');
    },

    drawOpenArrow: function(svg, x, y, ux, uy, color, size, sw) {
      var as = size || BASE_CFG.arrowSize;
      var strw = sw || BASE_CFG.strokeWidth;
      var hw = as * 0.4;
      var px = -uy, py = ux;
      svg.push('<polyline points="' +
        (x + ux * as + px * hw) + ',' + (y + uy * as + py * hw) + ' ' +
        x + ',' + y + ' ' +
        (x + ux * as - px * hw) + ',' + (y + uy * as - py * hw) +
        '" fill="none" stroke="' + color + '" stroke-width="' + strw + '"/>');
    },

    drawHollowTriangle: function(svg, x, y, ux, uy, colors, size, sw) {
      var as = (size || BASE_CFG.arrowSize) * 1.2;
      var strw = sw || BASE_CFG.strokeWidth;
      var hw = as * 0.45;
      var px = -uy, py = ux;
      svg.push('<polygon points="' +
        x + ',' + y + ' ' +
        (x + ux * as + px * hw) + ',' + (y + uy * as + py * hw) + ' ' +
        (x + ux * as - px * hw) + ',' + (y + uy * as - py * hw) +
        '" fill="' + colors.fill + '" stroke="' + colors.line + '" stroke-width="' + strw + '"/>');
    },

    drawDiamond: function(svg, x, y, ux, uy, color, filled, bgColor, size, sw) {
      var dh = size || 14;
      var dw = (size || 10) / 2;
      var strw = sw || BASE_CFG.strokeWidth;
      var px = -uy, py = ux;

      var p1x = x, p1y = y;
      var p2x = x + ux * dh / 2 + px * dw, p2y = y + uy * dh / 2 + py * dw;
      var p3x = x + ux * dh, p3y = y + uy * dh;
      var p4x = x + ux * dh / 2 - px * dw, p4y = y + uy * dh / 2 - py * dw;

      svg.push('<polygon points="' +
        p1x + ',' + p1y + ' ' + p2x + ',' + p2y + ' ' +
        p3x + ',' + p3y + ' ' + p4x + ',' + p4y +
        '" fill="' + (filled ? color : (bgColor || '#fff')) + '" stroke="' + color + '" stroke-width="' + strw + '"/>');
    },

    resolveNodeTarget: function(targetName, entries) {
      if (!targetName) return null;
      var cleanTarget = targetName.replace(/^"|"$/g, '').split('.')[0];
      // Search by ID
      if (entries[cleanTarget]) {
        var e = entries[cleanTarget];
        return { x: e.x, y: e.y, w: e.box.width, h: e.box.height };
      }
      // Search by Label
      for (var k in entries) {
        var ent = entries[k];
        if ((ent.node && ent.node.label === cleanTarget) ||
            (ent.state && ent.state.name === cleanTarget) ||
            (ent.comp && ent.comp.name === cleanTarget)) {
          return { x: ent.x, y: ent.y, w: ent.box.width, h: ent.box.height };
        }
      }
      return null;
    },

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
/**
 * Advanced Algorithmic Foundations for UML Visualization
 * Layout Engine utilizing Sugiyama Framework, Barycenter Heuristics,
 * and Orthogonal Edge Routing with Overlap Removal.
 */
(function() {
  'use strict';

  var LayoutEngine = {};

  /**
   * Main entry point for advanced layout.
   * @param {Array} nodes - [{ id: 'A', width: 100, height: 50, data: {} }]
   * @param {Array} edges - [{ source: 'A', target: 'B', type: 'generalization', weight: 1, data: {} }]
   * @param {Object} options - { gapX, gapY, useOrthogonal }
   * @returns {Object} { nodes: { id: {x, y, width, height, data} }, edges: [ { points: [{x,y}], data } ] }
   */
  LayoutEngine.compute = function(nodes, edges, options) {
    var gapX = options.gapX || 60;
    var gapY = options.gapY || 80;
    var direction = options.direction || 'TB'; // 'TB' (top-to-bottom) or 'LR' (left-to-right)

    // For LR layout, transpose the problem: swap width↔height and gaps,
    // compute as TB, then swap coordinates back.
    if (direction === 'LR') {
      var swappedNodes = [];
      for (var si = 0; si < nodes.length; si++) {
        swappedNodes.push({ id: nodes[si].id, width: nodes[si].height, height: nodes[si].width, data: nodes[si].data });
      }
      nodes = swappedNodes;
      var tmpGap = gapX;
      gapX = gapY;
      gapY = tmpGap;
    }

    // 1. Build Adjacency & Find Components
    var adj = {}, inDegree = {}, outDegree = {};
    var nodeMap = {};
    nodes.forEach(function(n) {
      adj[n.id] = [];
      inDegree[n.id] = 0;
      outDegree[n.id] = 0;
      nodeMap[n.id] = n;
    });

    // Determine direction based on edge type
    var directedEdges = [];
    edges.forEach(function(e) {
      if (!nodeMap[e.source] || !nodeMap[e.target]) return;
      var src = e.source, tgt = e.target;

      // Inheritance: target is upper, source is lower
      if (e.type === 'generalization' || e.type === 'realization') {
        src = e.target; tgt = e.source;
      } else if (e.type === 'composition' || e.type === 'aggregation') { // owner upper, owned lower
        src = e.source; tgt = e.target;
      } else if (e.type === 'dependency' || e.type === 'navigable') {
        src = e.source; tgt = e.target;
      }

      if (src === tgt) return;
      
      // Directed edge
      adj[src].push(tgt);
      inDegree[tgt]++;
      outDegree[src]++;
      
      directedEdges.push({ orig: e, src: src, tgt: tgt });
    });

    // 2. Cycle Removal (DFS)
    var visited = {}, recStack = {};
    function dfs(u) {
      visited[u] = true;
      recStack[u] = true;
      var newAdj = [];
      for (var i = 0; i < adj[u].length; i++) {
        var v = adj[u][i];
        if (!visited[v]) {
          dfs(v);
          newAdj.push(v);
        } else if (recStack[v]) {
          // cycle detected! Reverse the edge virtually
          adj[v].push(u);
          inDegree[u]++;
          inDegree[v]--;
        } else {
          newAdj.push(v);
        }
      }
      adj[u] = newAdj;
      recStack[u] = false;
    }
    nodes.forEach(function(n) { if (!visited[n.id]) dfs(n.id); });

    // 3. Layer Assignment (Longest Path)
    var layers = {};
    var roots = [];
    nodes.forEach(function(n) { if (inDegree[n.id] === 0) roots.push(n.id); });
    if (roots.length === 0 && nodes.length > 0) roots.push(nodes[0].id); // fallback
    
    var queue = [].concat(roots);
    roots.forEach(function(r) { layers[r] = 0; });
    while (queue.length > 0) {
      var u = queue.shift();
      adj[u].forEach(function(v) {
        var newLayer = (layers[u] || 0) + 1;
        if (layers[v] === undefined || newLayer > layers[v]) {
          layers[v] = newLayer;
          queue.push(v);
        }
      });
    }
    nodes.forEach(function(n) { if (layers[n.id] === undefined) layers[n.id] = 0; });

    // 4. Dummy Node Insertion
    var layerMax = 0;
    var layerGroups = [];
    nodes.forEach(function(n) {
      var l = layers[n.id];
      layerMax = Math.max(layerMax, l);
      if (!layerGroups[l]) layerGroups[l] = [];
      layerGroups[l].push(n.id);
    });

    var dummyNodes = {}; // id -> { layer, src, tgt, orig }
    var origEdgesMap = {}; // hash -> orig edge
    directedEdges.forEach(function(de) {
      var s = de.src, t = de.tgt;
      var sl = layers[s], tl = layers[t];
      origEdgesMap[s + '->' + t] = de.orig;
      
      if (tl - sl > 1) {
        var prev = s;
        for (var l = sl + 1; l < tl; l++) {
          var dummyId = '--dummy--' + s + '->' + t + '--' + l;
          dummyNodes[dummyId] = { id: dummyId, width: 2, height: 2, src: de.src, tgt: de.tgt, orig: de.orig };
          if (!layerGroups[l]) layerGroups[l] = [];
          layerGroups[l].push(dummyId);
          
          Object.defineProperty(dummyNodes, dummyId, { value: dummyNodes[dummyId], enumerable: true }); // make sure it's accessible
          
          adj[prev].push(dummyId);
          adj[dummyId] = [];
          
          // Remove old edge to t? Wait, adj only has end targets originally
          prev = dummyId;
        }
        adj[prev].push(t);
        
        // Remove s->t from adj[s]
        var idx = adj[s].indexOf(t);
        if (idx !== -1) adj[s].splice(idx, 1);
      }
    });

    // 5. Crossing Minimization (Barycenter)
    var pos = {};
    layerGroups.forEach(function(g, l) {
      if (!g) return;
      g.forEach(function(u, i) { pos[u] = i; });
    });

    for (var pass = 0; pass < 6; pass++) {
      if (pass % 2 === 0) { // Forward
        for (var l = 1; l <= layerMax; l++) {
          if (!layerGroups[l] || !layerGroups[l-1]) continue;
          var g = layerGroups[l];
          var bary = {};
          g.forEach(function(u) {
            var sum = 0, count = 0;
            // find predecessors in l-1
            layerGroups[l-1].forEach(function(v) {
              if (adj[v] && adj[v].indexOf(u) !== -1) {
                sum += pos[v]; count++;
              }
            });
            bary[u] = count > 0 ? sum / count : pos[u];
          });
          g.sort(function(a,b) { return bary[a] - bary[b]; });
          g.forEach(function(u, i) { pos[u] = i; });
        }
      } else { // Backward
        for (var l = layerMax - 1; l >= 0; l--) {
          if (!layerGroups[l] || !layerGroups[l+1]) continue;
          var g = layerGroups[l];
          var bary = {};
          g.forEach(function(u) {
            var sum = 0, count = 0;
            if (adj[u]) {
              adj[u].forEach(function(v) {
                if (pos[v] !== undefined) {
                  sum += pos[v]; count++;
                }
              });
            }
            bary[u] = count > 0 ? sum / count : pos[u];
          });
          g.sort(function(a,b) { return bary[a] - bary[b]; });
          g.forEach(function(u, i) { pos[u] = i; });
        }
      }
    }

    // 6. X-Coordinate Assignment (Simple packing)
    var coords = {}; // id -> {x, y, w, h}
    var currentY = 0;
    for (var l = 0; l <= layerMax; l++) {
      if (!layerGroups[l]) continue;
      var currentX = 0;
      var layerH = 0;
      layerGroups[l].forEach(function(u) {
        var w = nodeMap[u] ? nodeMap[u].width : 2;
        var h = nodeMap[u] ? nodeMap[u].height : 2;
        coords[u] = { x: currentX, y: currentY, w: w, h: h, cy: currentY + h/2 };
        currentX += w + gapX;
        layerH = Math.max(layerH, h);
      });
      
      // Center the layer based on the previous layer's center of mass to create nicer trees
      if (l > 0 && layerGroups[l-1]) {
        var idealX = 0, idealCount = 0;
        layerGroups[l].forEach(function(u) {
           layerGroups[l-1].forEach(function(v) {
             if (adj[v] && adj[v].indexOf(u) !== -1) {
               idealX += coords[v].x + coords[v].w/2;
               idealCount++;
             }
           });
        });
        if (idealCount > 0) {
          idealX /= idealCount;
          var layerCentX = (coords[layerGroups[l][0]].x + coords[layerGroups[l][layerGroups[l].length-1]].x + coords[layerGroups[l][layerGroups[l].length-1]].w) / 2;
          var shift = idealX - layerCentX;
          layerGroups[l].forEach(function(u) { coords[u].x += shift; });
        }
      }

      var cMaxY = currentY + layerH;
      layerGroups[l].forEach(function(u) {
         coords[u].y = currentY; // Top aligned
      });
      currentY = cMaxY + gapY;
    }

    // Ensure no overlapping horizontally if shifted (Overlap removal)
    for (var l = 0; l <= layerMax; l++) {
      if (!layerGroups[l]) continue;
      var g = layerGroups[l];
      for (var i = 1; i < g.length; i++) {
        var prev = coords[g[i-1]], cur = coords[g[i]];
        if (cur.x < prev.x + prev.w + gapX) {
          var shift = (prev.x + prev.w + gapX) - cur.x;
          for (var j = i; j < g.length; j++) {
            coords[g[j]].x += shift;
          }
        }
      }
    }

    // 7. Route Edges
    var resultNodes = {};
    var resultEdges = [];
    
    nodes.forEach(function(n) {
      resultNodes[n.id] = { x: coords[n.id].x, y: coords[n.id].y, width: coords[n.id].w, height: coords[n.id].h, data: n.data };
    });

    // Resolve dummy nodes into edge segments
    edges.forEach(function(e) {
      // Find route through dummies
      var route = [];
      var s = e.source, t = e.target;
      var actualS = s, actualT = t;
      var isReversed = false;
      
      // Directed edge resolution
      if (e.type === 'generalization' || e.type === 'realization') {
        actualS = e.target; actualT = e.source; isReversed = true;
      } else if (e.type === 'composition' || e.type === 'aggregation') {
        actualS = e.source; actualT = e.target;
      } else if (e.type === 'dependency' || e.type === 'navigable') {
        actualS = e.source; actualT = e.target; 
      }
      
      var c1 = coords[actualS], c2 = coords[actualT];
      if (!c1 || !c2) return;
      
      // Starting point at bottom of actualS
      var currentPos = actualS;
      route.push({ x: c1.x + c1.w/2, y: c1.y + c1.h });
      
      // Trace dummy nodes
      var sl = layers[actualS], tl = layers[actualT];
      if (tl - sl > 1) {
        for (var ll = sl + 1; ll < tl; ll++) {
           var dummyId = '--dummy--' + actualS + '->' + actualT + '--' + ll;
           var dCoord = coords[dummyId];
           if (dCoord) {
             route.push({ x: dCoord.x + 1, y: dCoord.y + 1 });
           }
        }
      }
      
      route.push({ x: c2.x + c2.w/2, y: c2.y });
      
      if (isReversed) {
        route.reverse(); // If reversed, the edge visibly goes from `s` to `t`, so we flip the points back.
      }
      
      // Orthogonalize
      var orthoRoute = [];
      for (var i = 0; i < route.length - 1; i++) {
        var p1 = route[i], p2 = route[i+1];
        orthoRoute.push({x: p1.x, y: p1.y});
        
        // Midpoint orthogonal bend
        if (p1.x !== p2.x && p1.y !== p2.y) {
           var midY = (p1.y + p2.y) / 2;
           orthoRoute.push({x: p1.x, y: midY});
           orthoRoute.push({x: p2.x, y: midY});
        }
      }
      orthoRoute.push(route[route.length-1]);
      
      // Simplification of route
      var finalRoute = [orthoRoute[0]];
      for (var i = 1; i < orthoRoute.length - 1; i++) {
        var prev = finalRoute[finalRoute.length - 1];
        var curr = orthoRoute[i];
        var next = orthoRoute[i+1];
        if (Math.abs(prev.x - curr.x) < 1 && Math.abs(curr.x - next.x) < 1) continue;
        if (Math.abs(prev.y - curr.y) < 1 && Math.abs(curr.y - next.y) < 1) continue;
        finalRoute.push(curr);
      }
      finalRoute.push(orthoRoute[orthoRoute.length-1]);

      resultEdges.push({ source: e.source, target: e.target, points: finalRoute, data: e });
    });

    // For LR layout, swap coordinates back: x↔y, width↔height
    if (direction === 'LR') {
      var lrNodes = {};
      for (var lrn in resultNodes) {
        var rn = resultNodes[lrn];
        lrNodes[lrn] = { x: rn.y, y: rn.x, width: rn.height, height: rn.width, data: rn.data };
      }
      for (var lre = 0; lre < resultEdges.length; lre++) {
        var pts = resultEdges[lre].points;
        for (var lrp = 0; lrp < pts.length; lrp++) {
          var tmpXY = pts[lrp].x;
          pts[lrp].x = pts[lrp].y;
          pts[lrp].y = tmpXY;
        }
      }
      return { nodes: lrNodes, edges: resultEdges };
    }

    return { nodes: resultNodes, edges: resultEdges };
  };

  window.UMLAdvancedLayout = LayoutEngine;
})();
/**
 * UML Class Diagram Renderer
 *
 * Custom SVG renderer for UML class diagrams with proper shared-target
 * inheritance arrows and full UML notation support.
 *
 * Text format:
 *   @startuml
 *   class Animal { +name: str; +speak() }
 *   abstract class Shape { -color: int; +{abstract} area(): double }
 *   interface Drawable { +draw() }
 *   Dog --|> Animal
 *   Circle ..|> Drawable
 *   Zoo *-- Animal : contains
 *   @enduml
 *
 * Relationship tokens:
 *   --|>  Generalization (solid, hollow triangle)
 *   ..|>  Realization (dashed, hollow triangle)
 *   --    Association (solid)
 *   -->   Navigable association (solid, open arrow)
 *   *--   Composition (solid, filled diamond)
 *   o--   Aggregation (solid, hollow diamond)
 *   ..>   Dependency (dashed, open arrow)
 */
(function () {
  'use strict';

  // ─── Configuration ────────────────────────────────────────────────

  var CFG = {
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    fontSize: 14,
    fontSizeBold: 15,
    fontSizeStereotype: 13,
    lineHeight: 22,
    padX: 14,
    padY: 6,
    gapX: 60,
    gapY: 80,
    triangleH: 14,
    triangleW: 14,
    diamondH: 14,
    diamondW: 10,
    arrowSize: 10,
    strokeWidth: 1.5,
    minBoxWidth: 100,
    svgPad: 30,
    junctionGap: 20,
    labelOffset: 8,
    multOffset: 14,
  };

  // ─── Parser ───────────────────────────────────────────────────────

  /**
   * Parse UML class diagram text format into structured data.
   * @param {string} text - The diagram specification
   * @returns {{ classes: Array, relationships: Array }}
   */
  function parse(text) {
    var lines = text.split('\n');
    var classes = [];
    var relationships = [];
    var classMap = {};
    var notes = [];
    var inClass = null;
    var braceDepth = 0;
    var direction = 'TB';

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line === '@startuml' || line === '@enduml') continue;

      // Layout directive
      var layoutMatch = line.match(/^layout\s+(horizontal|vertical|left-to-right|top-to-bottom|LR|TB)$/i);
      if (layoutMatch && inClass === null) {
        var val = layoutMatch[1].toLowerCase();
        direction = (val === 'horizontal' || val === 'left-to-right' || val === 'lr') ? 'LR' : 'TB';
        continue;
      }

      // If we're inside a class body
      if (inClass !== null) {
        // Count braces
        for (var ci = 0; ci < line.length; ci++) {
          if (line[ci] === '{') braceDepth++;
          if (line[ci] === '}') braceDepth--;
        }
        if (braceDepth <= 0) {
          inClass = null;
          braceDepth = 0;
          continue;
        }
        // Parse member line
        var member = parseMember(line);
        if (member) {
          if (member.isMethod) {
            inClass.methods.push(member);
          } else {
            inClass.attributes.push(member);
          }
        }
        continue;
      }

      // Note
      var noteIdx = UMLShared.parseNoteLine(line, lines, i, notes);
      if (noteIdx >= 0) { i = noteIdx; continue; }

      // Try to parse class declaration
      var cls = parseClassDecl(line);
      if (cls) {
        // Check if this line also contains opening brace
        if (line.indexOf('{') !== -1) {
          braceDepth = 1;
          // Check if closing brace is on same line
          if (line.indexOf('}') !== -1 && line.indexOf('}') > line.indexOf('{')) {
            // Single-line class: extract body
            var bodyStart = line.indexOf('{') + 1;
            var bodyEnd = line.lastIndexOf('}');
            var body = line.substring(bodyStart, bodyEnd).trim();
            if (body) {
              var parts = body.split(';');
              for (var p = 0; p < parts.length; p++) {
                var m = parseMember(parts[p].trim());
                if (m) {
                  if (m.isMethod) cls.methods.push(m);
                  else cls.attributes.push(m);
                }
              }
            }
            braceDepth = 0;
          } else {
            inClass = cls;
          }
        }
        classes.push(cls);
        classMap[cls.name] = cls;
        continue;
      }

      // Try to parse relationship
      var rel = parseRelationship(line);
      if (rel) {
        relationships.push(rel);
        continue;
      }
    }

    return { classes: classes, relationships: relationships, notes: notes, direction: direction };
  }

  /**
   * Parse a class declaration line.
   * Supports: class Name, abstract class Name, interface Name,
   *           class Name <<stereotype>>
   */
  function parseClassDecl(line) {
    // Remove trailing { if present
    var cleanLine = line.replace(/\s*\{.*$/, '').trim();

    var classType = 'class';
    var name = '';
    var stereotype = null;

    // Extract stereotype <<...>> if present
    var stereoMatch = cleanLine.match(/<<([^>]+)>>/);
    if (stereoMatch) {
      stereotype = stereoMatch[1];
      cleanLine = cleanLine.replace(/\s*<<[^>]+>>/, '').trim();
    }

    if (/^abstract\s+class\s+/.test(cleanLine)) {
      classType = 'abstract';
      name = cleanLine.replace(/^abstract\s+class\s+/, '').trim();
    } else if (/^interface\s+/.test(cleanLine)) {
      classType = 'interface';
      name = cleanLine.replace(/^interface\s+/, '').trim();
    } else if (/^enum\s+/.test(cleanLine)) {
      classType = 'enum';
      name = cleanLine.replace(/^enum\s+/, '').trim();
    } else if (/^class\s+/.test(cleanLine)) {
      classType = 'class';
      name = cleanLine.replace(/^class\s+/, '').trim();
    } else {
      return null;
    }

    if (!name) return null;

    return {
      name: name,
      type: classType,
      stereotype: stereotype,
      attributes: [],
      methods: [],
    };
  }

  /**
   * Parse a member line (attribute or method).
   * Format: [visibility] [{modifier}] name[(params)] [: Type]
   */
  function parseMember(line) {
    line = line.trim();
    if (!line || line === '{' || line === '}') return null;

    var visibility = '';
    var isAbstract = false;
    var isStatic = false;

    // Extract visibility prefix
    if (/^[+\-#~]/.test(line)) {
      visibility = line[0];
      line = line.substring(1).trim();
    }

    // Extract modifiers {abstract}, {static}
    var modMatch = line.match(/^\{(\w+)\}\s*/);
    if (modMatch) {
      var mod = modMatch[1].toLowerCase();
      if (mod === 'abstract') isAbstract = true;
      if (mod === 'static') isStatic = true;
      line = line.substring(modMatch[0].length);
    }

    // Determine if method (has parentheses)
    var isMethod = line.indexOf('(') !== -1;

    return {
      text: (visibility ? visibility : '') + line,
      visibility: visibility,
      isMethod: isMethod,
      isAbstract: isAbstract,
      isStatic: isStatic,
    };
  }

  // Relationship patterns ordered by specificity
  var REL_PATTERNS = [
    { token: '--|>', type: 'generalization' },
    { token: '..|>', type: 'realization' },
    { token: '*--', type: 'composition' },
    { token: 'o--', type: 'aggregation' },
    { token: '-->', type: 'navigable' },
    { token: '..>', type: 'dependency' },
    { token: '--',  type: 'association' },
  ];

  /**
   * Parse a relationship line.
   * Format: From [mult] token [mult] To [: label]
   */
  function parseRelationship(line) {
    for (var r = 0; r < REL_PATTERNS.length; r++) {
      var pat = REL_PATTERNS[r];
      var idx = line.indexOf(' ' + pat.token + ' ');
      if (idx === -1) continue;

      var leftPart = line.substring(0, idx).trim();
      var rightPart = line.substring(idx + pat.token.length + 2).trim();

      // Extract label after ':'
      var label = '';
      var colonIdx = rightPart.lastIndexOf(' : ');
      if (colonIdx !== -1) {
        label = rightPart.substring(colonIdx + 3).trim();
        rightPart = rightPart.substring(0, colonIdx).trim();
      }

      // Extract multiplicities from brackets
      var fromMult = '';
      var toMult = '';

      // Check left side for quoted multiplicity (single or double quotes)
      var leftMultMatch = leftPart.match(/^(.+?)\s+['"]([^'"]+)['"]$/);
      if (leftMultMatch) {
        leftPart = leftMultMatch[1].trim();
        fromMult = leftMultMatch[2];
      }

      // Check right side for quoted multiplicity (single or double quotes)
      var rightMultMatch = rightPart.match(/^['"]([^'"]+)['"]\s+(.+)$/);
      if (rightMultMatch) {
        toMult = rightMultMatch[1];
        rightPart = rightMultMatch[2].trim();
      }

      // Also support bracket syntax: A [1] -- [*] B
      if (!fromMult) {
        var leftBracketMatch = leftPart.match(/^(.+?)\s+\[([^\]]+)\]$/);
        if (leftBracketMatch) {
          leftPart = leftBracketMatch[1].trim();
          fromMult = leftBracketMatch[2];
        }
      }
      if (!toMult) {
        var rightBracketMatch = rightPart.match(/^\[([^\]]+)\]\s+(.+)$/);
        if (rightBracketMatch) {
          toMult = rightBracketMatch[1];
          rightPart = rightBracketMatch[2].trim();
        }
      }

      return {
        from: leftPart,
        to: rightPart,
        type: pat.type,
        label: label,
        fromMult: fromMult,
        toMult: toMult,
      };
    }
    return null;
  }

  // ─── Text Measurement (uses UMLShared.textWidth) ──────────────────

  // ─── Layout ───────────────────────────────────────────────────────

  /**
   * Measure a class box.
   * Returns { width, height, nameH, stereotypeH, attrH, methH }
   */
  function measureBox(cls) {
    var hasStereotype = cls.type === 'abstract' || cls.type === 'interface' || cls.type === 'enum' || cls.stereotype;
    var stereotypeText = '';
    if (cls.stereotype) stereotypeText = '\u00AB' + cls.stereotype + '\u00BB';
    else if (cls.type === 'abstract') stereotypeText = '\u00ABabstract\u00BB';
    else if (cls.type === 'interface') stereotypeText = '\u00ABinterface\u00BB';
    else if (cls.type === 'enum') stereotypeText = '\u00ABenumeration\u00BB';

    var stereotypeH = hasStereotype ? CFG.lineHeight : 0;
    var nameH = CFG.padY * 2 + CFG.lineHeight + stereotypeH;

    var nameW = UMLShared.textWidth(cls.name, true, CFG.fontSizeBold);
    if (hasStereotype) {
      nameW = Math.max(nameW, UMLShared.textWidth(stereotypeText, false, CFG.fontSizeStereotype));
    }

    var attrMaxW = 0;
    for (var a = 0; a < cls.attributes.length; a++) {
      attrMaxW = Math.max(attrMaxW, UMLShared.textWidth(cls.attributes[a].text, false));
    }
    var attrH = cls.attributes.length > 0 ? CFG.padY * 2 + cls.attributes.length * CFG.lineHeight : 0;

    var methMaxW = 0;
    for (var m = 0; m < cls.methods.length; m++) {
      methMaxW = Math.max(methMaxW, UMLShared.textWidth(cls.methods[m].text, false));
    }
    var methH = cls.methods.length > 0 ? CFG.padY * 2 + cls.methods.length * CFG.lineHeight : 0;

    var width = Math.max(CFG.minBoxWidth, nameW + CFG.padX * 2, attrMaxW + CFG.padX * 2, methMaxW + CFG.padX * 2);
    // Round up to even number for crisp centering
    width = Math.ceil(width / 2) * 2;
    var height = nameH + attrH + methH;

    return {
      width: width,
      height: height,
      nameH: nameH,
      stereotypeH: stereotypeH,
      attrH: attrH,
      methH: methH,
      stereotypeText: stereotypeText,
    };
  }


  /**
   * Compute layout positions for all class boxes using AdvancedAlgorithmic framework.
   */
  function computeLayout(parsed) {
    var classes = parsed.classes;
    var relationships = parsed.relationships;
    if (classes.length === 0) return { entries: {}, width: 0, height: 0, offsetX: 0, offsetY: 0 };

    var entries = {};
    var layoutNodes = [];
    var layoutEdges = [];

    // Measure boxes & construct layout input
    for (var i = 0; i < classes.length; i++) {
      var cls = classes[i];
      var box = measureBox(cls);
      entries[cls.name] = {
        cls: cls,
        box: box,
        x: 0,
        y: 0
      };
      layoutNodes.push({ id: cls.name, width: box.width, height: box.height, data: cls });
    }

    // Construct edge input
    for (var r = 0; r < relationships.length; r++) {
      var rel = relationships[r];
      layoutEdges.push({ source: rel.from, target: rel.to, type: rel.type, data: rel });
    }

    // Use advanced constraints engine
    var effectiveGapX = CFG.gapX;
    for (var rg = 0; rg < relationships.length; rg++) {
      var rgRel = relationships[rg];
      var neededW = 0;
      if (rgRel.label) {
        neededW = Math.max(neededW, UMLShared.textWidth(rgRel.label, false, CFG.fontSizeStereotype) + 40);
      }
      var multW = 0;
      if (rgRel.fromMult) multW += UMLShared.textWidth(rgRel.fromMult, false, CFG.fontSizeStereotype) + 12;
      if (rgRel.toMult) multW += UMLShared.textWidth(rgRel.toMult, false, CFG.fontSizeStereotype) + 12;
      neededW = Math.max(neededW, multW + 20);
      effectiveGapX = Math.max(effectiveGapX, neededW);
    }

    var result = window.UMLAdvancedLayout.compute(layoutNodes, layoutEdges, { gapX: effectiveGapX, gapY: CFG.gapY, direction: parsed.direction || 'TB' });

    // Read back positions
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var n in result.nodes) {
      if (!entries[n]) continue;
      entries[n].x = result.nodes[n].x;
      entries[n].y = result.nodes[n].y;
      
      minX = Math.min(minX, entries[n].x);
      minY = Math.min(minY, entries[n].y);
      maxX = Math.max(maxX, entries[n].x + entries[n].box.width);
      maxY = Math.max(maxY, entries[n].y + entries[n].box.height);
    }

    return {
      entries: entries,
      width: maxX - minX,
      height: maxY - minY,
      offsetX: -minX,
      offsetY: -minY,
      layoutResult: result // passthrough edge route if ever needed by generateSVG
    };
  }

  // ─── SVG Renderer ─────────────────────────────────────────────────



  /**
   * Generate full SVG string from layout and relationships.
   */
  function generateSVG(layout, parsed, colors) {
    var entries = layout.entries;
    var relationships = parsed.relationships;

    // Resolve note target — supports ClassName or ClassName.memberName

    // Pre-compute note positions so SVG bounds can be expanded
    var notePositions = [];
    if (parsed.notes) {
      var noteGap = UMLShared.NOTE_CFG.gap;
      for (var npi = 0; npi < parsed.notes.length; npi++) {
        var pn = parsed.notes[npi];
        var tgt = UMLShared.resolveNodeTarget(pn.target, entries);
        if (!tgt) continue;
        var ns = UMLShared.measureNote(pn.lines);
        var nx, ny;
        var tx = tgt.x, ty = tgt.y, tw = tgt.w, th = tgt.h;
        if (pn.position === 'right') { nx = tx + tw + noteGap; ny = ty; }
        else if (pn.position === 'left') { nx = tx - ns.width - noteGap; ny = ty; }
        else if (pn.position === 'top') { nx = tx; ny = ty - ns.height - noteGap; }
        else { nx = tx; ny = ty + th + noteGap; }
        notePositions.push({ note: pn, x: nx, y: ny, w: ns.width, h: ns.height,
          tx: tx, ty: ty, tw: tw, th: th });
      }
    }

    // Expand SVG bounds to fit notes
    var extraLeft = 0, extraRight = 0, extraTop = 0, extraBottom = 0;
    for (var nbi = 0; nbi < notePositions.length; nbi++) {
      var np = notePositions[nbi];
      var minNX = np.x - CFG.svgPad;
      var maxNX = np.x + np.w + CFG.svgPad;
      var minNY = np.y - CFG.svgPad;
      var maxNY = np.y + np.h + CFG.svgPad;
      if (minNX < -layout.offsetX) extraLeft = Math.max(extraLeft, -layout.offsetX - minNX);
      if (maxNX > layout.width - layout.offsetX) extraRight = Math.max(extraRight, maxNX - (layout.width - layout.offsetX));
      if (minNY < -layout.offsetY) extraTop = Math.max(extraTop, -layout.offsetY - minNY);
      if (maxNY > layout.height - layout.offsetY) extraBottom = Math.max(extraBottom, maxNY - (layout.height - layout.offsetY));
    }

    var ox = layout.offsetX + CFG.svgPad + extraLeft;
    var oy = layout.offsetY + CFG.svgPad + extraTop;
    var svgW = layout.width + CFG.svgPad * 2 + extraLeft + extraRight;
    var svgH = layout.height + CFG.svgPad * 2 + extraTop + extraBottom;

    var svg = [];
    svg.push(UMLShared.svgOpen(svgW, svgH, ox, oy, CFG.fontFamily));

    // ── Draw relationships ──
    var decorSvg = []; // arrowhead decorations drawn after class boxes

    // Group generalization/realization by target for shared-target rendering
    var inheritGroups = {};  // target -> { type, children: [] }
    var otherRels = [];
    var hasInheritAtBottom = {}; // classes that have inheritance triangle at bottom
    var hasInheritAtTop = {};   // classes that have inheritance arrow entering at top

    for (var r = 0; r < relationships.length; r++) {
      var rel = relationships[r];
      if (!entries[rel.from] || !entries[rel.to]) continue;

      if (rel.type === 'generalization' || rel.type === 'realization') {
        var key = rel.to + ':' + rel.type;
        if (!inheritGroups[key]) {
          inheritGroups[key] = { target: rel.to, type: rel.type, children: [], label: rel.label };
        }
        inheritGroups[key].children.push(rel.from);
        hasInheritAtBottom[rel.to] = true;
        hasInheritAtTop[rel.from] = true;
      } else {
        otherRels.push(rel);
      }
    }

    // Pre-compute per-child offsets: when a child has multiple parent groups
    // (e.g. generalization AND realization), offset connection points on the
    // child's top edge so lines don't overlap.
    var childParentCount = {};  // childName -> total number of parent groups
    var childParentIdx = {};    // groupKey + ':' + childName -> index for this group
    var groupKeys = [];
    for (var gk0 in inheritGroups) groupKeys.push(gk0);
    for (var gki = 0; gki < groupKeys.length; gki++) {
      var grp = inheritGroups[groupKeys[gki]];
      for (var gci = 0; gci < grp.children.length; gci++) {
        var cname = grp.children[gci];
        if (!childParentCount[cname]) childParentCount[cname] = 0;
        childParentIdx[groupKeys[gki] + ':' + cname] = childParentCount[cname];
        childParentCount[cname]++;
      }
    }

    // Helper: get the X offset for a child's connection point to a specific group
    var inheritPortSpacing = 20;
    function childConnX(childEntry, childName, groupKey) {
      var total = childParentCount[childName] || 1;
      var idx = childParentIdx[groupKey + ':' + childName] || 0;
      var cx = childEntry.x + childEntry.box.width / 2;
      if (total <= 1) return cx;
      // Spread connection points evenly around center
      var span = (total - 1) * inheritPortSpacing;
      return cx - span / 2 + idx * inheritPortSpacing;
    }

    // Draw inheritance/realization with shared-target style
    for (var gk in inheritGroups) {
      var group = inheritGroups[gk];
      var parentEntry = entries[group.target];
      var isDashed = group.type === 'realization';
      var dashAttr = isDashed ? ' stroke-dasharray="8,4"' : '';

      var parentCx = parentEntry.x + parentEntry.box.width / 2;
      var parentBot = parentEntry.y + parentEntry.box.height;

      // Hollow triangle at parent bottom (deferred to draw on top of class boxes)
      var triTop = parentBot;
      var triBot = parentBot + CFG.triangleH;
      decorSvg.push('<polygon points="' +
        parentCx + ',' + triTop + ' ' +
        (parentCx - CFG.triangleW / 2) + ',' + triBot + ' ' +
        (parentCx + CFG.triangleW / 2) + ',' + triBot +
        '" fill="' + colors.fill + '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"/>');

      if (group.children.length === 1) {
        // Single child: orthogonal (90-degree) routing
        var child = entries[group.children[0]];
        var childCx = childConnX(child, group.children[0], gk);
        var childTop = child.y;
        if (Math.abs(parentCx - childCx) < 1) {
          // Aligned: single vertical line
          svg.push('<line x1="' + parentCx + '" y1="' + triBot + '" x2="' + childCx + '" y2="' + childTop +
            '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"' + dashAttr + '/>');
        } else {
          // Not aligned: vertical from triangle, horizontal jog, vertical to child
          var junctionY = (triBot + childTop) / 2;
          svg.push('<line x1="' + parentCx + '" y1="' + triBot + '" x2="' + parentCx + '" y2="' + junctionY +
            '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"' + dashAttr + '/>');
          svg.push('<line x1="' + parentCx + '" y1="' + junctionY + '" x2="' + childCx + '" y2="' + junctionY +
            '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"' + dashAttr + '/>');
          svg.push('<line x1="' + childCx + '" y1="' + junctionY + '" x2="' + childCx + '" y2="' + childTop +
            '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"' + dashAttr + '/>');
        }
      } else {
        // Multiple children: shared-target
        var childTops = [];
        var childCxArr = [];
        for (var ci = 0; ci < group.children.length; ci++) {
          var ch = entries[group.children[ci]];
          childCxArr.push(childConnX(ch, group.children[ci], gk));
          childTops.push(ch.y);
        }
        var minChildTop = Math.min.apply(null, childTops);
        var junctionY = (triBot + minChildTop) / 2;

        // Trunk: triangle bottom to junction
        svg.push('<line x1="' + parentCx + '" y1="' + triBot + '" x2="' + parentCx + '" y2="' + junctionY +
          '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"' + dashAttr + '/>');

        // Horizontal bar at junction
        var leftCx = Math.min.apply(null, childCxArr);
        var rightCx = Math.max.apply(null, childCxArr);
        svg.push('<line x1="' + leftCx + '" y1="' + junctionY + '" x2="' + rightCx + '" y2="' + junctionY +
          '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"' + dashAttr + '/>');

        // Vertical stems from junction to each child
        for (var ci2 = 0; ci2 < group.children.length; ci2++) {
          var ch2 = entries[group.children[ci2]];
          var cx = childCxArr[ci2];
          svg.push('<line x1="' + cx + '" y1="' + junctionY + '" x2="' + cx + '" y2="' + ch2.y +
            '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"' + dashAttr + '/>');
        }
      }
    }

    // Pre-compute port offsets: when multiple edges exit from the same side of a box,
    // assign port indices sorted by target X to minimize crossings
    var exitPortCounts = {}; // "className:side" -> count
    var exitPortIdx = {};    // edgeIndex -> portIndex
    var exitGroups = {};     // "className:side" -> [{idx, targetCx}]
    for (var epi = 0; epi < otherRels.length; epi++) {
      var epRel = otherRels[epi];
      if (!entries[epRel.from] || !entries[epRel.to]) continue;
      var epFrom = entries[epRel.from];
      var epTo = entries[epRel.to];
      var epFromCx = epFrom.x + epFrom.box.width / 2;
      var epToCx = epTo.x + epTo.box.width / 2;
      var epSide = (hasInheritAtBottom[epRel.from]) ? 'bottom' :
        (Math.abs(epToCx - epFromCx) >
         Math.abs(epTo.y + epTo.box.height/2 - epFrom.y - epFrom.box.height/2) * 0.6) ?
        ((epToCx > epFromCx) ? 'right' : 'left') :
        ((epTo.y > epFrom.y) ? 'bottom' : 'top');
      var epKey = epRel.from + ':' + epSide;
      if (!exitGroups[epKey]) exitGroups[epKey] = [];
      exitGroups[epKey].push({ idx: epi, targetCx: epToCx });
    }
    // Sort each group by target X and assign port indices
    for (var gk in exitGroups) {
      var grp = exitGroups[gk];
      grp.sort(function(a, b) { return a.targetCx - b.targetCx; });
      exitPortCounts[gk] = grp.length;
      for (var gi = 0; gi < grp.length; gi++) {
        exitPortIdx[grp[gi].idx] = gi;
      }
    }

    // Draw other relationships with orthogonal (right-angle) routing
    for (var oi = 0; oi < otherRels.length; oi++) {
      var orel = otherRels[oi];
      var fromE = entries[orel.from];
      var toE = entries[orel.to];
      if (!fromE || !toE) continue;

      var isDash = orel.type === 'dependency';
      var dAttr = isDash ? ' stroke-dasharray="8,4"' : '';

      // Compute orthogonal route, with port offset for multiple edges from same side
      var portOffset = exitPortIdx[oi] * 16;
      var route = computeOrthogonalRoute(fromE, toE, hasInheritAtBottom[orel.from], hasInheritAtTop[orel.to], portOffset, entries, orel.from, orel.to);
      var pathPoints = route.points; // array of {x,y}

      // Build polyline points string
      var pointsStr = '';
      for (var pi3 = 0; pi3 < pathPoints.length; pi3++) {
        if (pi3 > 0) pointsStr += ' ';
        pointsStr += pathPoints[pi3].x + ',' + pathPoints[pi3].y;
      }

      // Draw main polyline
      svg.push('<polyline points="' + pointsStr +
        '" fill="none" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"' + dAttr + '/>');

      // Determine direction at each end for decorations
      var p0 = pathPoints[0], p1 = pathPoints[1];
      var pLast = pathPoints[pathPoints.length - 1], pPrev = pathPoints[pathPoints.length - 2];

      // Direction FROM start (away from source box)
      var startDx = p1.x - p0.x, startDy = p1.y - p0.y;
      var startLen = Math.sqrt(startDx * startDx + startDy * startDy);
      if (startLen > 0) { startDx /= startLen; startDy /= startLen; }

      // Direction INTO end (arriving at target box)
      var endDx = pLast.x - pPrev.x, endDy = pLast.y - pPrev.y;
      var endLen = Math.sqrt(endDx * endDx + endDy * endDy);
      if (endLen > 0) { endDx /= endLen; endDy /= endLen; }

      // Source decorations (deferred to draw on top of class boxes)
      if (orel.type === 'composition') {
        UMLShared.drawDiamond(decorSvg, p0.x, p0.y, startDx, startDy, -startDy, startDx, colors.line, true, colors.fill);
      } else if (orel.type === 'aggregation') {
        UMLShared.drawDiamond(decorSvg, p0.x, p0.y, startDx, startDy, -startDy, startDx, colors.line, false, colors.fill);
      }

      // Target decorations (deferred to draw on top of class boxes)
      if (orel.type === 'navigable' || orel.type === 'dependency') {
        UMLShared.drawOpenArrow(decorSvg, pLast.x, pLast.y, -endDx, -endDy, endDy, -endDx, colors.line);
      }

      // Determine if the first/last segment is horizontal or vertical
      var isFirstHoriz = (Math.abs(startDy) < 0.1);
      var isLastHoriz = (Math.abs(endDy) < 0.1);

      // Draw label at midpoint of the longest segment
      if (orel.label) {
        // Find the longest segment for label placement
        var bestSegIdx = 0, bestSegLen = 0;
        for (var si = 0; si < pathPoints.length - 1; si++) {
          var segLen = Math.abs(pathPoints[si+1].x - pathPoints[si].x) + Math.abs(pathPoints[si+1].y - pathPoints[si].y);
          if (segLen > bestSegLen) { bestSegLen = segLen; bestSegIdx = si; }
        }
        var seg0 = pathPoints[bestSegIdx], seg1 = pathPoints[bestSegIdx + 1];
        var labelX = (seg0.x + seg1.x) / 2;
        var labelY = (seg0.y + seg1.y) / 2;
        var isMidHoriz = Math.abs(seg1.y - seg0.y) < 1;
        if (isMidHoriz) {
          labelY -= 8;
        } else {
          labelX -= 12;
        }
        svg.push('<text x="' + labelX + '" y="' + labelY + '" text-anchor="middle" ' +
          'font-size="' + CFG.fontSizeStereotype + '" fill="' + colors.text + '" ' +
          'stroke="' + colors.fill + '" stroke-width="4" stroke-opacity="0.85" stroke-linejoin="round" paint-order="stroke" ' +
          'font-style="italic">' + UMLShared.escapeXml(orel.label) + '</text>');
      }

      // Draw multiplicities near their respective endpoints, well clear of the box
      if (orel.fromMult) {
        var fmx, fmy;
        if (isFirstHoriz) {
          // Horizontal exit: place multiplicity above the line, near source box edge
          fmx = p0.x + startDx * 6;
          fmy = p0.y - 8;
        } else {
          // Vertical exit: place to the right of the lifeline
          fmx = p0.x + 8;
          fmy = p0.y + startDy * 14;
        }
        svg.push('<text x="' + fmx + '" y="' + fmy + '" ' +
          'font-size="' + CFG.fontSizeStereotype + '" fill="' + colors.text + '" ' +
          'stroke="' + colors.fill + '" stroke-width="4" stroke-opacity="0.85" stroke-linejoin="round" paint-order="stroke">' +
          UMLShared.escapeXml(orel.fromMult) + '</text>');
      }
      if (orel.toMult) {
        var tmx, tmy;
        if (isLastHoriz) {
          // Horizontal entry: place multiplicity above the line, near target box edge
          tmx = pLast.x - endDx * 6;
          tmy = pLast.y - 8;
          // Anchor toward the target box
          var tmAnchor = (endDx > 0) ? 'end' : 'start';
        } else {
          tmx = pLast.x + 8;
          tmy = pLast.y - endDy * 14;
          tmAnchor = 'start';
        }
        svg.push('<text x="' + tmx + '" y="' + tmy + '" text-anchor="' + (tmAnchor || 'start') + '" ' +
          'font-size="' + CFG.fontSizeStereotype + '" fill="' + colors.text + '" ' +
          'stroke="' + colors.fill + '" stroke-width="4" stroke-opacity="0.85" stroke-linejoin="round" paint-order="stroke">' +
          UMLShared.escapeXml(orel.toMult) + '</text>');
      }
    }

    // ── Draw class boxes (on top of lines) ──

    for (var en in entries) {
      var e = entries[en];
      var cls = e.cls;
      var box = e.box;
      var x = e.x, y = e.y;
      var isInterface = cls.type === 'interface';
      var boxDash = '';  // All class boxes use solid borders (including interfaces)

      // Header compartment
      svg.push('<rect x="' + x + '" y="' + y + '" width="' + box.width + '" height="' + box.nameH +
        '" fill="' + colors.headerFill + '" stroke="none"/>');

      // Attribute compartment (if non-empty)
      if (box.attrH > 0) {
        svg.push('<rect x="' + x + '" y="' + (y + box.nameH) + '" width="' + box.width + '" height="' + box.attrH +
          '" fill="' + colors.fill + '" stroke="none"/>');
      }

      // Method compartment (if non-empty)
      if (box.methH > 0) {
        svg.push('<rect x="' + x + '" y="' + (y + box.nameH + box.attrH) + '" width="' + box.width + '" height="' + box.methH +
          '" fill="' + colors.fill + '" stroke="none"/>');
      }

      // Overall border
      svg.push('<rect x="' + x + '" y="' + y + '" width="' + box.width + '" height="' + box.height +
        '" fill="none" stroke="' + colors.stroke + '" stroke-width="' + CFG.strokeWidth + '"' + boxDash + '/>');

      // Compartment dividers (only between non-empty sections)
      if (box.attrH > 0 || box.methH > 0) {
        svg.push('<line x1="' + x + '" y1="' + (y + box.nameH) + '" x2="' + (x + box.width) + '" y2="' + (y + box.nameH) +
          '" stroke="' + colors.stroke + '" stroke-width="' + CFG.strokeWidth + '"' + boxDash + '/>');
      }
      if (box.attrH > 0 && box.methH > 0) {
        svg.push('<line x1="' + x + '" y1="' + (y + box.nameH + box.attrH) + '" x2="' + (x + box.width) + '" y2="' + (y + box.nameH + box.attrH) +
          '" stroke="' + colors.stroke + '" stroke-width="' + CFG.strokeWidth + '"' + boxDash + '/>');
      }

      // Stereotype text
      var textCx = x + box.width / 2;
      if (box.stereotypeText) {
        var stereoY = y + CFG.padY + CFG.lineHeight * 0.75;
        svg.push('<text x="' + textCx + '" y="' + stereoY + '" text-anchor="middle" ' +
          'font-size="' + CFG.fontSizeStereotype + '" fill="' + colors.text + '">' +
          UMLShared.escapeXml(box.stereotypeText) + '</text>');
      }

      // Class name
      var nameY = y + CFG.padY + box.stereotypeH + CFG.lineHeight * 0.75;
      var isAbstract = cls.type === 'abstract';
      svg.push('<text x="' + textCx + '" y="' + nameY + '" text-anchor="middle" ' +
        'font-weight="bold" font-size="' + CFG.fontSizeBold + '" ' +
        (isAbstract ? 'font-style="italic" ' : '') +
        'fill="' + colors.text + '">' + UMLShared.escapeXml(cls.name) + '</text>');

      // Attributes
      var attrBaseY = y + box.nameH + CFG.padY;
      for (var ai = 0; ai < cls.attributes.length; ai++) {
        var attr = cls.attributes[ai];
        var attrY = attrBaseY + (ai + 0.75) * CFG.lineHeight;
        var attrStyle = '';
        if (attr.isAbstract) attrStyle += 'font-style:italic;';
        if (attr.isStatic) attrStyle += 'text-decoration:underline;';
        svg.push('<text x="' + (x + CFG.padX) + '" y="' + attrY + '" ' +
          'font-size="' + CFG.fontSize + '" fill="' + colors.text + '"' +
          (attrStyle ? ' style="' + attrStyle + '"' : '') + '>' +
          UMLShared.escapeXml(attr.text) + '</text>');
      }

      // Methods
      var methBaseY = y + box.nameH + box.attrH + CFG.padY;
      for (var mi = 0; mi < cls.methods.length; mi++) {
        var meth = cls.methods[mi];
        var methY = methBaseY + (mi + 0.75) * CFG.lineHeight;
        var methStyle = '';
        if (meth.isAbstract) methStyle += 'font-style:italic;';
        if (meth.isStatic) methStyle += 'text-decoration:underline;';
        svg.push('<text x="' + (x + CFG.padX) + '" y="' + methY + '" ' +
          'font-size="' + CFG.fontSize + '" fill="' + colors.text + '"' +
          (methStyle ? ' style="' + methStyle + '"' : '') + '>' +
          UMLShared.escapeXml(meth.text) + '</text>');
      }
    }

    // ── Draw arrowhead decorations on top of class boxes ──
    for (var di = 0; di < decorSvg.length; di++) svg.push(decorSvg[di]);

    // ── Draw notes (using pre-computed positions) ──
    for (var ni = 0; ni < notePositions.length; ni++) {
      var np2 = notePositions[ni];
      var connFrom, connTo;
      if (np2.note.position === 'right') {
        connFrom = { x: np2.x, y: np2.y + np2.h / 2 };
        connTo = { x: np2.tx + np2.tw, y: np2.ty + np2.th / 2 };
      } else if (np2.note.position === 'left') {
        connFrom = { x: np2.x + np2.w, y: np2.y + np2.h / 2 };
        connTo = { x: np2.tx, y: np2.ty + np2.th / 2 };
      } else if (np2.note.position === 'top') {
        connFrom = { x: np2.x + np2.w / 2, y: np2.y + np2.h };
        connTo = { x: np2.tx + np2.tw / 2, y: np2.ty };
      } else {
        connFrom = { x: np2.x + np2.w / 2, y: np2.y };
        connTo = { x: np2.tx + np2.tw / 2, y: np2.ty + np2.th };
      }
      UMLShared.drawNote(svg, np2.x, np2.y, np2.note.lines, colors,
        { fromX: connFrom.x, fromY: connFrom.y, toX: connTo.x, toY: connTo.y });
    }

    svg.push(UMLShared.svgClose());
    return svg.join('\n');
  }

  /**
   * Compute orthogonal (Manhattan) route between two class boxes.
   * Prefers straight lines when boxes are aligned vertically or horizontally.
   * Uses right-angle bends only when necessary.
   * Returns { points: [{x,y}, ...] } with only horizontal/vertical segments.
   */
  function computeOrthogonalRoute(fromE, toE, avoidFromBottom, avoidToTop, portOffset, allEntries, fromId, toId) {
    portOffset = portOffset || 0;
    var fromCx = fromE.x + fromE.box.width / 2;
    var fromCy = fromE.y + fromE.box.height / 2 + portOffset;
    var fromL = fromE.x, fromR = fromE.x + fromE.box.width;
    var fromT = fromE.y, fromB = fromE.y + fromE.box.height;

    var toCx = toE.x + toE.box.width / 2;
    var toCy = toE.y + toE.box.height / 2;
    var toL = toE.x, toR = toE.x + toE.box.width;
    var toT = toE.y, toB = toE.y + toE.box.height;

    // Check if boxes overlap horizontally (can use vertical straight line)
    var hOverlap = fromL < toR && fromR > toL;
    // Check if boxes overlap vertically (can use horizontal straight line)
    var vOverlap = fromT < toB && fromB > toT;

    var points;

    // If we must avoid bottom of source (inheritance triangle there),
    // exit from the bottom edge at an offset X (avoiding the triangle center),
    // or from the side if target is not below.
    if (avoidFromBottom && !vOverlap) {
      var triW = CFG.triangleW;
      var diamondLen = CFG.diamondH * 2; // total length of diamond along edge direction
      var portGap = diamondLen + 8; // spacing between connection points
      if (toCy > fromCy) {
        // Target is below: exit from bottom edge at triangle base, offset X to avoid triangle
        var exitBottomX;
        var baseOffset = triW + 8 + portOffset * portGap / 16;
        if (toCx >= fromCx) {
          exitBottomX = fromCx + baseOffset;
        } else {
          exitBottomX = fromCx - baseOffset;
        }
        // Clamp to box edges
        exitBottomX = Math.max(fromL + 4, Math.min(fromR - 4, exitBottomX));
        // Diamond starts at Shape's bottom edge (not at triangle base)
        var exitBottomY = fromB; // diamond touches the class border
        var routeStartY = exitBottomY + diamondLen; // route continues from diamond tip
        // Stagger horizontal runs by port index to prevent crossings
        var horizY = routeStartY + (portOffset / 16) * 12 + 4;
        points = [
          { x: exitBottomX, y: exitBottomY },
          { x: exitBottomX, y: horizY },
          { x: toCx, y: horizY },
          { x: toCx, y: toT }
        ];
      } else {
        // Target is at same level or above: exit from the side
        var exitSide = (toCx > fromCx) ? 'right' : 'left';
        var exitX = (exitSide === 'right') ? fromR : fromL;
        var exitY = fromCy + portOffset;
        var midY = (exitY + toT) / 2;
        points = [
          { x: exitX, y: exitY },
          { x: exitX, y: midY },
          { x: toCx, y: midY },
          { x: toCx, y: toT }
        ];
      }
      // fall through to obstacle avoidance below
    } else if (hOverlap && !avoidFromBottom) {
      // Boxes overlap horizontally — use vertical straight line
      var overlapL = Math.max(fromL, toL);
      var overlapR = Math.min(fromR, toR);
      var connX = (overlapL + overlapR) / 2;

      if (fromCy < toCy) {
        points = [{ x: connX, y: fromB }, { x: connX, y: toT }];
      } else {
        points = [{ x: connX, y: fromT }, { x: connX, y: toB }];
      }
    } else if (hOverlap && avoidFromBottom) {
      // Horizontal overlap but must avoid bottom — use right side exit
      var exitX2 = fromR;
      var bypassX = Math.max(fromR, toR) + 20;
      if (fromCy < toCy) {
        points = [
          { x: exitX2, y: fromCy },
          { x: bypassX, y: fromCy },
          { x: bypassX, y: toCy },
          { x: toR, y: toCy }
        ];
      } else {
        points = [
          { x: exitX2, y: fromCy },
          { x: bypassX, y: fromCy },
          { x: bypassX, y: toCy },
          { x: toR, y: toCy }
        ];
      }
    } else if (vOverlap) {
      // Boxes overlap vertically — use horizontal straight line
      var overlapT = Math.max(fromT, toT);
      var overlapB = Math.min(fromB, toB);
      var connY = (overlapT + overlapB) / 2;

      if (fromCx < toCx) {
        points = [{ x: fromR, y: connY }, { x: toL, y: connY }];
      } else {
        points = [{ x: fromL, y: connY }, { x: toR, y: connY }];
      }
    } else {
      // No overlap — need an L-shaped or Z-shaped route
      var dx = toCx - fromCx;
      var dy = toCy - fromCy;

      if (Math.abs(dy) >= Math.abs(dx)) {
        // Primarily vertical separation — exit from bottom/top, bend horizontally
        if (dy > 0) {
          var midY = (fromB + toT) / 2;
          points = [
            { x: fromCx, y: fromB },
            { x: fromCx, y: midY },
            { x: toCx, y: midY },
            { x: toCx, y: toT }
          ];
        } else {
          var midY2 = (fromT + toB) / 2;
          points = [
            { x: fromCx, y: fromT },
            { x: fromCx, y: midY2 },
            { x: toCx, y: midY2 },
            { x: toCx, y: toB }
          ];
        }
      } else {
        // Primarily horizontal separation — exit from side, enter target from nearest edge
        // If target is also below/above, prefer entering from top/bottom (perpendicular)
        if (dx > 0) {
          if (dy > 10 && fromB < toT) {
            // Target is right and below: exit right, then enter from top
            points = [
              { x: fromR, y: fromCy },
              { x: toCx, y: fromCy },
              { x: toCx, y: toT }
            ];
          } else if (dy < -10 && fromT > toB) {
            // Target is right and above: exit right, then enter from bottom
            points = [
              { x: fromR, y: fromCy },
              { x: toCx, y: fromCy },
              { x: toCx, y: toB }
            ];
          } else {
            // Same vertical level: enter from left side
            var midX = (fromR + toL) / 2;
            points = [
              { x: fromR, y: fromCy },
              { x: midX, y: fromCy },
              { x: midX, y: toCy },
              { x: toL, y: toCy }
            ];
          }
        } else {
          if (dy > 10 && fromB < toT) {
            points = [
              { x: fromL, y: fromCy },
              { x: toCx, y: fromCy },
              { x: toCx, y: toT }
            ];
          } else if (dy < -10 && fromT > toB) {
            points = [
              { x: fromL, y: fromCy },
              { x: toCx, y: fromCy },
              { x: toCx, y: toB }
            ];
          } else {
            var midX2 = (fromL + toR) / 2;
            points = [
              { x: fromL, y: fromCy },
              { x: midX2, y: fromCy },
              { x: midX2, y: toCy },
              { x: toR, y: toCy }
            ];
          }
        }
      }

      // Simplify: remove redundant intermediate points on same axis
      points = simplifyPath(points);
    }

    // ── Obstacle avoidance: reroute segments that pass through other class boxes ──
    if (allEntries && points.length >= 2) {
      var pad = 12;
      var obstacles = [];
      for (var obn in allEntries) {
        if (obn === fromId || obn === toId) continue;
        var ob = allEntries[obn];
        obstacles.push({ l: ob.x - pad, t: ob.y - pad, r: ob.x + ob.box.width + pad, b: ob.y + ob.box.height + pad });
      }
      // Check each segment and reroute if needed (one pass)
      var newPoints = [points[0]];
      for (var si = 0; si < points.length - 1; si++) {
        var p1 = points[si], p2 = points[si + 1];
        var rerouted = false;
        for (var obi = 0; obi < obstacles.length; obi++) {
          var ob2 = obstacles[obi];
          if (segmentIntersectsBox(p1, p2, ob2)) {
            // Reroute around the obstacle: go around the closer side
            var goRight = (p1.x + p2.x) / 2 >= (ob2.l + ob2.r) / 2;
            var bypassX = goRight ? ob2.r : ob2.l;
            if (p1.x === p2.x) {
              // Vertical segment hitting a box: jog horizontally around it
              newPoints.push({ x: p1.x, y: Math.min(p1.y, ob2.t) });
              newPoints.push({ x: bypassX, y: Math.min(p1.y, ob2.t) });
              newPoints.push({ x: bypassX, y: Math.max(p2.y, ob2.b) });
              newPoints.push({ x: p2.x, y: Math.max(p2.y, ob2.b) });
            } else {
              // Horizontal segment hitting a box: jog vertically around it
              var goDown = (p1.y + p2.y) / 2 >= (ob2.t + ob2.b) / 2;
              var bypassY = goDown ? ob2.b : ob2.t;
              newPoints.push({ x: Math.min(p1.x, ob2.l), y: p1.y });
              newPoints.push({ x: Math.min(p1.x, ob2.l), y: bypassY });
              newPoints.push({ x: Math.max(p2.x, ob2.r), y: bypassY });
              newPoints.push({ x: Math.max(p2.x, ob2.r), y: p2.y });
            }
            rerouted = true;
            break;
          }
        }
        if (!rerouted) {
          newPoints.push(p2);
        } else {
          newPoints.push(p2);
        }
      }
      points = simplifyPath(newPoints);
    }

    // Force all segments to be strictly horizontal or vertical
    points = orthogonalize(points);

    return { points: points };
  }

  /**
   * Convert any diagonal segment into an L-shaped pair of H/V segments.
   */
  function orthogonalize(points) {
    if (points.length <= 1) return points;
    var result = [points[0]];
    for (var i = 1; i < points.length; i++) {
      var prev = result[result.length - 1];
      var cur = points[i];
      if (prev.x !== cur.x && prev.y !== cur.y) {
        // Diagonal — insert a bend point (horizontal first, then vertical)
        result.push({ x: cur.x, y: prev.y });
      }
      result.push(cur);
    }
    return simplifyPath(result);
  }

  /**
   * Check if a line segment (p1→p2) intersects a rectangle {l, t, r, b}.
   */
  function segmentIntersectsBox(p1, p2, box) {
    // Segment bounding box must overlap the obstacle box
    var sMinX = Math.min(p1.x, p2.x), sMaxX = Math.max(p1.x, p2.x);
    var sMinY = Math.min(p1.y, p2.y), sMaxY = Math.max(p1.y, p2.y);
    if (sMaxX <= box.l || sMinX >= box.r || sMaxY <= box.t || sMinY >= box.b) return false;
    // For axis-aligned segments (orthogonal), bbox overlap means intersection
    if (p1.x === p2.x || p1.y === p2.y) return true;
    // For diagonal segments, do full Liang-Barsky clip test
    return true;
  }

  /**
   * Remove redundant points in an orthogonal path
   * (consecutive points on the same horizontal or vertical line).
   */
  function simplifyPath(points) {
    if (points.length <= 2) return points;
    var result = [points[0]];
    for (var i = 1; i < points.length - 1; i++) {
      var prev = result[result.length - 1];
      var curr = points[i];
      var next = points[i + 1];
      // Skip if all three are on the same horizontal or vertical line
      if ((prev.x === curr.x && curr.x === next.x) ||
          (prev.y === curr.y && curr.y === next.y)) {
        continue;
      }
      result.push(curr);
    }
    result.push(points[points.length - 1]);
    return result;
  }

  /**
   * Draw a diamond (filled or hollow) at position (x,y) pointing along (ux,uy).
   */

  /**
   * Draw an open arrowhead at position (x,y) pointing along (ux,uy).
   */

  // ─── Public API ───────────────────────────────────────────────────

  /**
   * Render a UML class diagram from text format into a container element.
   * @param {HTMLElement} container - Target DOM element
   * @param {string} text - Diagram specification in the custom text format
   * @param {Object} [options] - Optional overrides
   */
  function render(container, text, options) {
    var parsed = parse(text);
    renderFromData(container, parsed, options);
  }

  /**
   * Render a UML class diagram from pre-parsed data into a container element.
   * @param {HTMLElement} container - Target DOM element
   * @param {Object} parsed - Output from parse()
   * @param {Object} [options] - Optional overrides
   */
  function renderFromData(container, parsed, options) {
    if (!parsed.classes || parsed.classes.length === 0) {
      container.innerHTML = '<div style="padding:20px;color:#888;text-align:center;">No classes to display.</div>';
      return;
    }

    // Ensure container has the CSS class for theming
    if (!container.classList.contains('uml-class-diagram-container')) {
      container.classList.add('uml-class-diagram-container');
    }

    var colors = UMLShared.getThemeColors(container);
    colors.bg = window.getComputedStyle(container).getPropertyValue('--uml-bg').trim() || 'transparent';
    var layout = computeLayout(parsed);
    var svgStr = generateSVG(layout, parsed, colors);
    container.innerHTML = svgStr;
    UMLShared.autoFitSVG(container);
  }

  // ─── Auto-init for SEBook pages ───────────────────────────────────

  /**
   * Extract raw diagram text from a <code> element.
   * Uses innerHTML so that <<stereotype>> notation written in raw HTML
   * (where the browser parses <stereotype> as an element) is recovered
   * correctly instead of being silently dropped by textContent.
   */
  function extractCodeText(el) {
    var html = el.innerHTML;
    // Browser may parse <<Foo>> as: &lt; + <Foo> element + &gt; + …
    // Restore element tag names as literal text, then decode entities.
    html = html
      .replace(/<\/[a-zA-Z][a-zA-Z0-9]*\s*>/g, '')                         // drop </tag>
      .replace(/<([a-zA-Z][a-zA-Z0-9]*)(?:\s[^>]*)?>/g, '<$1>')            // <tag attrs> → <tag>
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); // decode entities
    return html;
  }

  UMLShared.createAutoInit('pre > code.language-uml-class', render, { extractText: extractCodeText });

  // ─── Export ────────────────────────────────────────────────────────

  window.UMLClassDiagram = {
    render: render,
    renderFromData: renderFromData,
    parse: parse,
  };

})();
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
    lostFoundGap: 60,
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

    var lastMsgY = curY; // tracks the Y of the most recent message, for activate/deactivate anchoring
    for (var mi = 0; mi < messages.length; mi++) {
      var msg = messages[mi];

      if (msg.type === 'message') {
        lastMsgY = curY;
        msgYs.push(curY);
        curY += CFG.messageGapY;
        // Track which participants are involved in ALL open fragments (not just innermost)
        if (fragmentStack.length > 0) {
          var fpi1 = findPIdxByName(msg.from);
          var fpi2 = findPIdxByName(msg.to);
          for (var fsi = 0; fsi < fragmentStack.length; fsi++) {
            fragmentStack[fsi].minPIdx = Math.min(fragmentStack[fsi].minPIdx, fpi1, fpi2);
            fragmentStack[fsi].maxPIdx = Math.max(fragmentStack[fsi].maxPIdx, fpi1, fpi2);
            fragmentStack[fsi].lastMsgY = curY;
          }
        }
      } else if (msg.type === 'fragment_start') {
        fragmentStack.push({ startY: curY - 15, fragType: msg.fragType, condition: msg.condition, elseYs: [], minPIdx: Infinity, maxPIdx: -Infinity, depth: fragmentStack.length, lastMsgY: curY });
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
          frag.endY = frag.lastMsgY + 20;
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
        curY = frag ? frag.endY + CFG.messageGapY / 2 : curY + 20;
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
        msgYs.push(lastMsgY); // bar starts at the preceding message's Y
      } else if (msg.type === 'deactivate') {
        msgYs.push(lastMsgY); // bar ends at the preceding message's Y
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
    var maxFoundGap = 0;
    for (var lfmi = 0; lfmi < messages.length; lfmi++) {
      var lfm = messages[lfmi];
      if (lfm.type === 'lost' || lfm.type === 'found') {
        var ltw = lfm.label ? UMLShared.textWidth(lfm.label, false, CFG.fontSize) : 0;
        var reqGap = Math.max(CFG.lostFoundGap, ltw + 20);

        if (lfm.type === 'lost') {
          var lmIdx = findPIdxByName(lfm.from);
          var lostRightEdge = partX[lmIdx] + halfAct + reqGap + CFG.lostFoundRadius + CFG.svgPad;
          if (lostRightEdge > totalW) totalW = lostRightEdge;
        } else {
          maxFoundGap = Math.max(maxFoundGap, reqGap);
        }
      }
    }
    if (maxFoundGap > 0) {
      var foundPad = maxFoundGap + CFG.lostFoundRadius + CFG.svgPad;
      for (var fpiOuter = 0; fpiOuter < partX.length; fpiOuter++) {
        partX[fpiOuter] += foundPad;
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
    // Helper to find the connection point X (lifeline center or activation bar edge)
    function getEdgeX(pIdx, y, side) {
      if (pIdx === undefined) return 0;
      var center = partX[pIdx];
      var bestDepth = -1;
      for (var k = 0; k < activationBars.length; k++) {
        var ab = activationBars[k];
        // Include start/end Y exactly to handle start/stop of activations
        // Add a tiny epsilon to handle edge cases of messages exactly at activation start/end
        if (ab.pIdx === pIdx && y >= ab.startY - 0.1 && y <= ab.endY + 0.1) {
          if (ab.depth > bestDepth) bestDepth = ab.depth;
        }
      }
      if (bestDepth === -1) return center;
      var abx = center - CFG.activationW / 2 + bestDepth * CFG.activationOffset;
      return (side === 'right') ? (abx + CFG.activationW) : abx;
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
        var isLeft = partX[toIdx] < partX[fromIdx];
        var x1 = getEdgeX(fromIdx, my, isLeft ? 'left' : 'right');
        var x2 = getEdgeX(toIdx, my, isLeft ? 'right' : 'left');

        // Self-message
        if (fromIdx === toIdx) {
          var selfW = 40;
          var selfX = getEdgeX(fromIdx, my, 'right');
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
          var sx = getEdgeX(senderIdx, my + partH / 2, 'right');
          var tx = partX[cIdx] - partWidths[cIdx] / 2;
          var arrowY = my + partH / 2;
          svg.push('<line x1="' + sx + '" y1="' + arrowY + '" x2="' + tx + '" y2="' + arrowY +
            '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '" stroke-dasharray="6,4"/>');
          drawMsgArrow(svg, tx, arrowY, -1, 'sync', colors);
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
        var ltw2 = m.label ? UMLShared.textWidth(m.label, false, CFG.fontSize) : 0;
        var lgap = Math.max(CFG.lostFoundGap, ltw2 + 20);
        var lx1 = getEdgeX(lIdx, my, 'right');
        var lx2 = lx1 + lgap;
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
        var ftw = m.label ? UMLShared.textWidth(m.label, false, CFG.fontSize) : 0;
        var fgap = Math.max(CFG.lostFoundGap, ftw + 20);
        var fx2 = getEdgeX(fIdx, my, 'left');
        var fx1 = fx2 - fgap;
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
          noteX = getEdgeX(nIdx, my, 'left') - UMLShared.NOTE_CFG.gap - noteSize.width;
          connFromX = noteX + noteSize.width;
          connToX = getEdgeX(nIdx, my, 'left');
        } else if (m.position === 'right') {
          noteX = getEdgeX(nIdx, my, 'right') + UMLShared.NOTE_CFG.gap;
          connFromX = noteX;
          connToX = getEdgeX(nIdx, my, 'right');
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
    // dir: -1 = pointing right, 1 = pointing left
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


    // Pre-compute note positions for SVG bounds expansion
    var notePositions = [];
    if (parsed.notes) {
      var noteGap = UMLShared.NOTE_CFG.gap;
      for (var npi = 0; npi < parsed.notes.length; npi++) {
        var pn = parsed.notes[npi]; var tgt = UMLShared.resolveNodeTarget(pn.target, entries); if (!tgt) continue;
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
    var placedLabels = []; // { l, r, t, b } bounding boxes for collision avoidance
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
        UMLShared.drawArrow(svg, sx, sy + 20, -1, 0, colors.line);
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

      // Force all segments to be strictly horizontal or vertical
      for (var oi = 1; oi < points.length; oi++) {
        var pp = points[oi - 1], pc = points[oi];
        if (pp.x !== pc.x && pp.y !== pc.y) {
          points.splice(oi, 0, { x: pc.x, y: pp.y });
          oi++;
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
      UMLShared.drawArrow(svg, pLast.x, pLast.y, -adx, -ady, colors.line);

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
        // Check if label overlaps any previously placed label and nudge
        lblW = UMLShared.textWidth(tr.label, false, CFG.fontSize);
        lblL = (lAnchor === 'middle') ? lx - lblW / 2 : (lAnchor === 'start' ? lx : lx - lblW);
        lblR = lblL + lblW; lblT = ly - CFG.fontSize; lblB = ly + 4;
        for (var pli = 0; pli < placedLabels.length; pli++) {
          var pl = placedLabels[pli];
          if (lblR > pl.l && lblL < pl.r && lblB > pl.t && lblT < pl.b) {
            ly = pl.b + CFG.fontSize + 2; // nudge below the colliding label
            lblT = ly - CFG.fontSize; lblB = ly + 4;
          }
        }
        placedLabels.push({ l: lblL, r: lblR, t: lblT, b: lblB });

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
    UMLShared.autoFitSVG(container);
  }

  // ─── Auto-init ────────────────────────────────────────────────────

  UMLShared.createAutoInit('pre > code.language-uml-state', render);
  window.UMLStateDiagram = { render: render, parse: parse };
})();
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
    var notes = [];
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

      // Note
      var noteIdx = UMLShared.parseNoteLine(line, lines, i, notes);
      if (noteIdx >= 0) { i = noteIdx; continue; }

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

    return { components: components, connectors: connectors, notes: notes, direction: direction };
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

    // Expand bounds to account for connector labels that may extend beyond components
    var maxLabelH = 0, maxLabelWHalf = 0;
    for (var cli = 0; cli < connectors.length; cli++) {
      if (connectors[cli].label) {
        var clW = UMLShared.textWidth(connectors[cli].label, false, CFG.fontSize);
        maxLabelWHalf = Math.max(maxLabelWHalf, clW / 2 + 10);
        maxLabelH = Math.max(maxLabelH, CFG.fontSize + 16);
      }
    }
    minX -= maxLabelWHalf;
    minY -= maxLabelH;
    maxX += maxLabelWHalf;
    maxY += maxLabelH;

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

    // Resolve note target — supports dotted paths to sub-elements

    // Pre-compute note positions for SVG bounds expansion
    var notePositions = [];
    if (parsed.notes) {
      var noteGap = UMLShared.NOTE_CFG.gap;
      for (var npi = 0; npi < parsed.notes.length; npi++) {
        var pn = parsed.notes[npi]; var tgt = UMLShared.resolveNodeTarget(pn.target, entries); if (!tgt) continue;
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
    var svgW = layout.width + CFG.svgPad * 2 + noteExtraL + noteExtraR;
    var svgH = layout.height + CFG.svgPad * 2 + noteExtraT + noteExtraB;

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
          dir2 = dx2 > 0 ? 'left' : 'right'; // entry side: line approaches from the left when target is right
        } else {
          x2 = tcx2;
          y2 = dy2 > 0 ? toE.y : toE.y + toE.box.height;
          dir2 = dy2 > 0 ? 'top' : 'bottom'; // entry side: line approaches from top when target is below
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

      // Detect backward HH: exit direction opposes the direction to target
      var isBackwardHH = isH1 && isH2 &&
        ((dir1 === 'right' && x2 < x1) || (dir1 === 'left' && x2 > x1));

      if (isH1 && isH2) {
        if (isBackwardHH) {
          // Backward connection: try a short local U-shape first,
          // routing above or below the bounding box of just source+target.
          var localMinY = Math.min(
            fromObs ? fromObs.y1 : y1, toObs ? toObs.y1 : y2
          );
          var localMaxY = Math.max(
            fromObs ? fromObs.y2 : y1, toObs ? toObs.y2 : y2
          );
          var backJitter = (ci % 5) * 10;
          var tryAboveY = localMinY - 20 - backJitter;
          var tryBelowY = localMaxY + 20 + backJitter;
          var clearAbove = findClearY(Math.min(ext1X, ext2X), Math.max(ext1X, ext2X), tryAboveY, obstacles, skipN);
          var clearBelow = findClearY(Math.min(ext1X, ext2X), Math.max(ext1X, ext2X), tryBelowY, obstacles, skipN);
          // Pick whichever stays closest to the diagram (smallest absolute distance from source)
          var distAbove = Math.abs(y1 - clearAbove);
          var distBelow = Math.abs(y1 - clearBelow);
          var backDetourY = distAbove <= distBelow ? clearAbove : clearBelow;
          points = [
            { x: x1, y: y1 }, { x: ext1X, y: y1 },
            { x: ext1X, y: backDetourY },
            { x: ext2X, y: backDetourY },
            { x: ext2X, y: y2 }, { x: x2, y: y2 }
          ];
        } else if (Math.abs(y1 - y2) < 2) {
          // Same-Y direct line (only for forward connections)
          points = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
        } else {
          // S-shape: exit horizontal → vertical channel → enter horizontal
          var midX;
          // Place midX based on Y direction so upward/downward routes naturally separate.
          // Upward connections exit near source; downward connections arrive near target.
          if ((dir1 === 'right' && dir2 === 'left' && ext1X > ext2X) ||
              (dir1 === 'left' && dir2 === 'right' && ext1X < ext2X)) {
            // Backward: route via the far side
            midX = (dir1 === 'right') ? Math.max(ext1X, ext2X) : Math.min(ext1X, ext2X);
          } else {
            var frac = (y2 < y1) ? 0.25 : (y2 > y1) ? 0.75 : 0.5;
            midX = ext1X + (ext2X - ext1X) * frac;
          }
          midX += (ci % 3) * 14 - 14; // small per-connection jitter for same-direction routes
          // Clamp to corridor so the vertical segment stays between the two components
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

      // Post-routing validation: check intermediate segments against obstacles,
      // skipping source and target (they necessarily border those boxes).
      if (points.length >= 4) {
        var intermediateHit = false;
        for (var vi = 1; vi < points.length - 2; vi++) {
          var vp0 = points[vi], vp1 = points[vi + 1];
          var vIsH = Math.abs(vp0.y - vp1.y) < 2;
          var vIsV = Math.abs(vp0.x - vp1.x) < 2;
          for (var vj = 0; vj < obstacles.length; vj++) {
            var vo = obstacles[vj];
            if (skipN && skipN[vo.name]) continue;
            if (vIsV && vp0.x > vo.x1 && vp0.x < vo.x2) {
              var vyMin = Math.min(vp0.y, vp1.y), vyMax = Math.max(vp0.y, vp1.y);
              if (vyMax > vo.y1 && vyMin < vo.y2) { intermediateHit = true; break; }
            } else if (vIsH && vp0.y > vo.y1 && vp0.y < vo.y2) {
              var vxMin = Math.min(vp0.x, vp1.x), vxMax = Math.max(vp0.x, vp1.x);
              if (vxMax > vo.x1 && vxMin < vo.x2) { intermediateHit = true; break; }
            }
          }
          if (intermediateHit) break;
        }
        if (intermediateHit && isH1 && isH2) {
          // Find the widest clear vertical corridor between ext1X and ext2X
          // by collecting all obstacle X intervals that overlap [vyLo, vyHi].
          var vxL = Math.min(ext1X, ext2X), vxR = Math.max(ext1X, ext2X);
          var vyLo = Math.min(y1, y2), vyHi = Math.max(y1, y2);
          // Build sorted list of blocked X intervals in that Y band
          var vBlocked = [];
          for (var vbj = 0; vbj < obstacles.length; vbj++) {
            var vbo = obstacles[vbj];
            if (skipN && skipN[vbo.name]) continue;
            if (vbo.x2 > vxL && vbo.x1 < vxR && vyHi > vbo.y1 && vyLo < vbo.y2) {
              vBlocked.push({ a: Math.max(vbo.x1, vxL), b: Math.min(vbo.x2, vxR) });
            }
          }
          vBlocked.sort(function(a, b) { return a.a - b.a; });
          // Find widest gap
          var vGapStart = vxL, vBestGapW = 0, vBestMidX = null;
          for (var vgi2 = 0; vgi2 < vBlocked.length; vgi2++) {
            var vgapW = vBlocked[vgi2].a - vGapStart;
            if (vgapW > vBestGapW) { vBestGapW = vgapW; vBestMidX = (vGapStart + vBlocked[vgi2].a) / 2; }
            if (vBlocked[vgi2].b > vGapStart) vGapStart = vBlocked[vgi2].b;
          }
          var vTrailGap = vxR - vGapStart;
          if (vTrailGap > vBestGapW) { vBestMidX = (vGapStart + vxR) / 2; }

          if (vBestMidX !== null) {
            points = [
              { x: x1, y: y1 }, { x: vBestMidX, y: y1 },
              { x: vBestMidX, y: y2 }, { x: x2, y: y2 }
            ];
          } else {
            // No gap — route above/below the local bounding box
            var vLocalMinY = Math.min(fromObs ? fromObs.y1 : y1, toObs ? toObs.y1 : y2);
            var vLocalMaxY = Math.max(fromObs ? fromObs.y2 : y1, toObs ? toObs.y2 : y2);
            var vDetourAbove = findClearY(vxL, vxR, vLocalMinY - 20 - (ci % 3) * 10, obstacles, skipN);
            var vDetourBelow = findClearY(vxL, vxR, vLocalMaxY + 20 + (ci % 3) * 10, obstacles, skipN);
            var vDetourY = (Math.abs(y1 - vDetourAbove) <= Math.abs(y1 - vDetourBelow)) ? vDetourAbove : vDetourBelow;
            points = [
              { x: x1, y: y1 }, { x: ext1X, y: y1 },
              { x: ext1X, y: vDetourY },
              { x: ext2X, y: vDetourY },
              { x: ext2X, y: y2 }, { x: x2, y: y2 }
            ];
          }
          points = simplifyRoute(points);
        }
      }

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
    UMLShared.autoFitSVG(container);
  }

  // ─── Auto-init ────────────────────────────────────────────────────

  UMLShared.createAutoInit('pre > code.language-uml-component', render);

  window.UMLComponentDiagram = { render: render, parse: parse };
})();
/**
 * UML Deployment Diagram Renderer
 *
 * Maps components to hardware nodes (servers, devices).
 *
 * Text format:
 *   @startuml
 *   node WebServer {
 *     component AppServer
 *     component Logger
 *   }
 *   node DatabaseServer {
 *     component MySQL
 *   }
 *   node ClientDevice {
 *     component WebBrowser
 *   }
 *
 *   WebServer --> DatabaseServer : TCP/IP
 *   ClientDevice --> WebServer : HTTPS
 *   @enduml
 *
 * Notation:
 *   node Name { ... }    Node (3D box / cube) containing components
 *   component Name       Component inside a node
 *   A --> B : label      Communication link between nodes
 *   A ..> B : label      Dependency
 *   layout horizontal    Left-to-right layout (also: left-to-right, LR)
 *   layout vertical      Top-to-bottom layout (also: top-to-bottom, TB) [default]
 */
(function () {
  'use strict';

  var CFG = {
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    fontSize: 14,
    fontSizeBold: 15,
    fontSizeComp: 13,
    lineHeight: 22,
    nodePadX: 20,
    nodePadY: 14,
    nodeMinW: 160,
    nodeMinH: 60,
    node3dDepth: 12,
    compH: 26,
    compPadX: 10,
    compIconW: 14,
    compIconH: 10,
    compIconTabW: 6,
    compIconTabH: 3,
    compGapY: 6,
    gapX: 100,
    gapY: 80,
    arrowSize: 10,
    strokeWidth: 1.5,
    svgPad: 30,
    labelBgPad: 4,
  };

  // ─── Parser ───────────────────────────────────────────────────────

  function parse(text) {
    var lines = text.split('\n');
    var nodes = [];
    var nodeMap = {};
    var links = [];
    var notes = [];
    var currentNode = null;
    var braceDepth = 0;
    var direction = 'TB';

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line === '@startuml' || line === '@enduml') continue;

      // Layout directive
      var layoutMatch = line.match(/^layout\s+(horizontal|vertical|left-to-right|top-to-bottom|LR|TB)$/i);
      if (layoutMatch && !currentNode) {
        var val = layoutMatch[1].toLowerCase();
        direction = (val === 'horizontal' || val === 'left-to-right' || val === 'lr') ? 'LR' : 'TB';
        continue;
      }

      // Inside a node block
      if (currentNode !== null) {
        for (var ci = 0; ci < line.length; ci++) {
          if (line[ci] === '{') braceDepth++;
          if (line[ci] === '}') braceDepth--;
        }
        if (braceDepth <= 0) {
          currentNode = null;
          braceDepth = 0;
          continue;
        }
        // Component inside node
        var compMatch = line.match(/^component\s+(\S+)/);
        if (compMatch) {
          nodeMap[currentNode].components.push(compMatch[1]);
        }
        // Artifact inside node
        var artMatch = line.match(/^artifact\s+(\S+)/);
        if (artMatch) {
          nodeMap[currentNode].components.push(artMatch[1]);
        }
        continue;
      }

      // Node declaration
      var nodeMatch = line.match(/^node\s+(\S+)\s*\{?/);
      if (nodeMatch) {
        var nName = nodeMatch[1];
        if (!nodeMap[nName]) {
          // Support instance notation: "instanceName:TypeName" (underlined per UML spec Fig 9-3)
          var isInstance = nName.indexOf(':') !== -1;
          nodeMap[nName] = { name: nName, isInstance: isInstance, components: [] };
          nodes.push(nodeMap[nName]);
        }
        if (line.indexOf('{') !== -1) {
          braceDepth = 1;
          if (line.indexOf('}') !== -1 && line.indexOf('}') > line.indexOf('{')) {
            braceDepth = 0;
          } else {
            currentNode = nName;
          }
        }
        continue;
      }

      // Note
      var noteIdx = UMLShared.parseNoteLine(line, lines, i, notes);
      if (noteIdx >= 0) { i = noteIdx; continue; }

      // Link: A --> B : label  or  A ..> B : label
      var linkMatch = line.match(/^(\S+)\s+(-->|\.\.>|--)\s+(\S+)\s*(?::\s*(.*))?$/);
      if (linkMatch) {
        var from = linkMatch[1], arrow = linkMatch[2], to = linkMatch[3];
        var label = (linkMatch[4] || '').trim();
        // Ensure nodes exist
        if (!nodeMap[from]) { nodeMap[from] = { name: from, isInstance: from.indexOf(':') !== -1, components: [] }; nodes.push(nodeMap[from]); }
        if (!nodeMap[to]) { nodeMap[to] = { name: to, isInstance: to.indexOf(':') !== -1, components: [] }; nodes.push(nodeMap[to]); }
        var type = arrow === '..>' ? 'dependency' : 'link';
        links.push({ from: from, to: to, type: type, label: label });
        continue;
      }
    }

    return { nodes: nodes, links: links, notes: notes, direction: direction };
  }

  // ─── Layout ───────────────────────────────────────────────────────

  function computeLayout(parsed) {
    var nodes = parsed.nodes;
    var links = parsed.links;
    if (nodes.length === 0) return { entries: {}, width: 0, height: 0, offsetX: 0, offsetY: 0 };

    var entries = {};
    var layoutNodes = [];
    var layoutEdges = [];

    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var nameW = UMLShared.textWidth(n.name, true, CFG.fontSizeBold);
      var compMaxW = 0;
      for (var c = 0; c < n.components.length; c++) {
        compMaxW = Math.max(compMaxW, UMLShared.textWidth(n.components[c], false, CFG.fontSizeComp) + CFG.compIconW + CFG.compPadX * 2 + 8);
      }
      var w = Math.max(CFG.nodeMinW, nameW + CFG.nodePadX * 2, compMaxW + CFG.nodePadX * 2);
      var h = CFG.nodePadY + CFG.lineHeight + 8; // name area
      if (n.components.length > 0) {
        h += n.components.length * (CFG.compH + CFG.compGapY) + CFG.nodePadY;
      } else {
        h = Math.max(h + CFG.nodePadY, CFG.nodeMinH);
      }
      entries[n.name] = { node: n, box: { width: Math.ceil(w), height: Math.ceil(h) }, x: 0, y: 0 };
      layoutNodes.push({ id: n.name, width: Math.ceil(w), height: Math.ceil(h), data: n });
    }

    for (var li = 0; li < links.length; li++) {
      var lk = links[li];
      layoutEdges.push({ source: lk.from, target: lk.to, type: lk.type, data: lk });
    }

    // Compute link label widths for gap sizing
    var maxLabelW = 0;
    for (var li = 0; li < links.length; li++) {
      if (links[li].label) maxLabelW = Math.max(maxLabelW, UMLShared.textWidth(links[li].label, false, CFG.fontSize));
    }
    var effectiveGapX = Math.max(CFG.gapX, maxLabelW + 40);

    var result = window.UMLAdvancedLayout.compute(layoutNodes, layoutEdges, { gapX: effectiveGapX, gapY: CFG.gapY, direction: parsed.direction || 'TB' });

    for (var nm in result.nodes) {
      if (!entries[nm]) continue;
      entries[nm].x = result.nodes[nm].x;
      entries[nm].y = result.nodes[nm].y;
    }

    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var en in entries) {
      var e = entries[en];
      minX = Math.min(minX, e.x); minY = Math.min(minY, e.y - CFG.node3dDepth);
      maxX = Math.max(maxX, e.x + e.box.width + CFG.node3dDepth);
      maxY = Math.max(maxY, e.y + e.box.height);
    }

    // Expand bounds to account for link labels that may extend beyond nodes
    var maxLabelH = 0, maxLabelWHalf = 0;
    for (var dli = 0; dli < links.length; dli++) {
      if (links[dli].label) {
        var dlW = UMLShared.textWidth(links[dli].label, false, CFG.fontSize);
        maxLabelWHalf = Math.max(maxLabelWHalf, dlW / 2 + 10);
        maxLabelH = Math.max(maxLabelH, CFG.fontSize + 16);
      }
    }
    minX -= maxLabelWHalf;
    minY -= maxLabelH;
    maxX += maxLabelWHalf;
    maxY += maxLabelH;

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
    var links = parsed.links;

    // Resolve note target — supports dotted paths to sub-elements

    // Pre-compute note positions for SVG bounds expansion
    var notePositions = [];
    if (parsed.notes) {
      var noteGap = UMLShared.NOTE_CFG.gap;
      for (var npi = 0; npi < parsed.notes.length; npi++) {
        var pn = parsed.notes[npi]; var tgt = UMLShared.resolveNodeTarget(pn.target, entries); if (!tgt) continue;
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
    var svgW = layout.width + CFG.svgPad * 2 + noteExtraL + noteExtraR;
    var svgH = layout.height + CFG.svgPad * 2 + noteExtraT + noteExtraB;

    var svg = [];
    svg.push(UMLShared.svgOpen(svgW, svgH, ox, oy, CFG.fontFamily));
    // ── Pre-compute distributed exit/entry points ──
    var exitsByFrom = {}, entriesByTo = {};
    for (var pli = 0; pli < links.length; pli++) {
      var plk = links[pli];
      if (!entries[plk.from] || !entries[plk.to]) continue;
      if (!exitsByFrom[plk.from]) exitsByFrom[plk.from] = [];
      exitsByFrom[plk.from].push(pli);
      if (!entriesByTo[plk.to]) entriesByTo[plk.to] = [];
      entriesByTo[plk.to].push(pli);
    }
    var distExitX = {}, distEntryX = {};
    for (var efn in exitsByFrom) {
      var efg = exitsByFrom[efn];
      if (efg.length < 2) continue;
      var efe = entries[efn];
      efg.sort(function(a, b) {
        var ta = entries[links[a].to], tb = entries[links[b].to];
        if (!ta || !tb) return 0;
        return (ta.x + ta.box.width / 2) - (tb.x + tb.box.width / 2);
      });
      for (var efi = 0; efi < efg.length; efi++) {
        distExitX[efg[efi]] = efe.x + efe.box.width * (efi + 1) / (efg.length + 1);
      }
    }
    for (var etn in entriesByTo) {
      var etg = entriesByTo[etn];
      if (etg.length < 2) continue;
      var ete = entries[etn];
      etg.sort(function(a, b) {
        var fa = entries[links[a].from], fb = entries[links[b].from];
        if (!fa || !fb) return 0;
        return (fa.x + fa.box.width / 2) - (fb.x + fb.box.width / 2);
      });
      for (var eti = 0; eti < etg.length; eti++) {
        distEntryX[etg[eti]] = ete.x + ete.box.width * (eti + 1) / (etg.length + 1);
      }
    }

    // ── Obstacle-aware routing helpers ──
    var obPad = 10;
    var obstacles = [];
    for (var obn in entries) {
      var obe = entries[obn];
      obstacles.push({
        x1: obe.x - obPad,
        y1: obe.y - CFG.node3dDepth - obPad,
        x2: obe.x + obe.box.width + CFG.node3dDepth + obPad,
        y2: obe.y + obe.box.height + obPad,
        name: obn
      });
    }

    function vSegHitsObs(x, yMin, yMax, skipNames) {
      for (var i = 0; i < obstacles.length; i++) {
        var ob = obstacles[i];
        if (skipNames && (skipNames[ob.name])) continue;
        if (x > ob.x1 && x < ob.x2 && yMax > ob.y1 && yMin < ob.y2) return true;
      }
      return false;
    }

    function hSegHitsObs(y, xMin, xMax, skipNames) {
      for (var i = 0; i < obstacles.length; i++) {
        var ob = obstacles[i];
        if (skipNames && (skipNames[ob.name])) continue;
        if (y > ob.y1 && y < ob.y2 && xMax > ob.x1 && xMin < ob.x2) return true;
      }
      return false;
    }

    function findClearX(yMin, yMax, preferX, skipNames) {
      if (!vSegHitsObs(preferX, yMin, yMax, skipNames)) return preferX;
      for (var d = 10; d < 800; d += 10) {
        if (!vSegHitsObs(preferX + d, yMin, yMax, skipNames)) return preferX + d;
        if (!vSegHitsObs(preferX - d, yMin, yMax, skipNames)) return preferX - d;
      }
      return preferX;
    }

    function findClearY(xMin, xMax, preferY, skipNames) {
      if (!hSegHitsObs(preferY, xMin, xMax, skipNames)) return preferY;
      for (var d = 10; d < 800; d += 10) {
        if (!hSegHitsObs(preferY + d, xMin, xMax, skipNames)) return preferY + d;
        if (!hSegHitsObs(preferY - d, xMin, xMax, skipNames)) return preferY - d;
      }
      return preferY;
    }

    // ── Draw links ──
    for (var li = 0; li < links.length; li++) {
      var lk = links[li];
      var fromE = entries[lk.from], toE = entries[lk.to];
      if (!fromE || !toE) continue;

      var isDash = lk.type === 'dependency';
      var dAttr = isDash ? ' stroke-dasharray="8,4"' : '';

      var origFromCx = fromE.x + fromE.box.width / 2;
      var origToCx = toE.x + toE.box.width / 2;
      var fromCy = fromE.y + fromE.box.height / 2;
      var toCy = toE.y + toE.box.height / 2;
      var dx = origToCx - origFromCx, dy = toCy - fromCy;
      var fromCx = (distExitX[li] !== undefined) ? distExitX[li] : origFromCx;
      var toCx = (distEntryX[li] !== undefined) ? distEntryX[li] : origToCx;

      // Skip names for obstacle checking (don't avoid source/target)
      var skipN = {};
      skipN[lk.from] = true;
      skipN[lk.to] = true;

      var x1, y1, x2, y2;
      var exitDir; // 'top', 'bottom', 'left', 'right'
      var entryDir;
      if (Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx > 0) { x1 = fromE.x + fromE.box.width; y1 = fromCy; x2 = toE.x; y2 = toCy; exitDir = 'right'; entryDir = 'left'; }
        else { x1 = fromE.x; y1 = fromCy; x2 = toE.x + toE.box.width; y2 = toCy; exitDir = 'left'; entryDir = 'right'; }
      } else {
        // For vertical links, try to use the same X for both endpoints to avoid angles
        // Pick the X that is clear of obstacles, preferring mid between the two
        var sharedX = (fromCx + toCx) / 2;
        var yTop = Math.min(fromE.y + fromE.box.height, toE.y) ;
        var yBot = Math.max(fromE.y + fromE.box.height, toE.y);
        if (!vSegHitsObs(sharedX, yTop, yBot, skipN)) {
          fromCx = sharedX;
          toCx = sharedX;
        } else if (!vSegHitsObs(fromCx, yTop, yBot, skipN)) {
          toCx = fromCx;
        } else if (!vSegHitsObs(toCx, yTop, yBot, skipN)) {
          fromCx = toCx;
        }
        if (dy > 0) { x1 = fromCx; y1 = fromE.y + fromE.box.height; x2 = toCx; y2 = toE.y; exitDir = 'bottom'; entryDir = 'top'; }
        else { x1 = fromCx; y1 = fromE.y; x2 = toCx; y2 = toE.y + toE.box.height; exitDir = 'top'; entryDir = 'bottom'; }
      }

      var points;
      if (Math.abs(x1 - x2) < 2 && Math.abs(y1 - y2) < 2) {
        points = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
      } else if (exitDir === 'bottom' || exitDir === 'top') {
        // Vertical link
        if (Math.abs(x1 - x2) < 2) {
          // Straight vertical — check if it passes through an obstacle
          var vTop = Math.min(y1, y2), vBot = Math.max(y1, y2);
          if (!vSegHitsObs(x1, vTop, vBot, skipN)) {
            points = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
          } else {
            // Need to route around — find clear X for vertical channel
            var clearX = findClearX(vTop, vBot, x1, skipN);
            points = [{ x: x1, y: y1 }, { x: x1, y: (y1 + y2) / 2 }, { x: clearX, y: (y1 + y2) / 2 }, { x: clearX, y: y2 }];
          }
        } else {
          // Different X — use Z-route with obstacle-aware midY
          var midY = (y1 + y2) / 2;
          var xMin = Math.min(x1, x2), xMax = Math.max(x1, x2);
          midY = findClearY(xMin, xMax, midY, skipN);
          points = [{ x: x1, y: y1 }, { x: x1, y: midY }, { x: x2, y: midY }, { x: x2, y: y2 }];
        }
      } else {
        // Horizontal link
        if (Math.abs(y1 - y2) < 2) {
          points = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
        } else {
          var midX = (x1 + x2) / 2;
          var hTop = Math.min(y1, y2), hBot = Math.max(y1, y2);
          midX = findClearX(hTop, hBot, midX, skipN);
          points = [{ x: x1, y: y1 }, { x: midX, y: y1 }, { x: midX, y: y2 }, { x: x2, y: y2 }];
        }
      }

      var pStr = '';
      for (var pi = 0; pi < points.length; pi++) { if (pi > 0) pStr += ' '; pStr += points[pi].x + ',' + points[pi].y; }
      svg.push('<polyline points="' + pStr + '" fill="none" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"' + dAttr + '/>');

      // Arrowhead
      var pLast = points[points.length - 1], pPrev = points[points.length - 2];
      var adx = pLast.x - pPrev.x, ady = pLast.y - pPrev.y;
      var alen = Math.sqrt(adx * adx + ady * ady);
      if (alen > 0) { adx /= alen; ady /= alen; }
      var as = CFG.arrowSize, hw = as * 0.35, px = -ady, py = adx;
      if (isDash) {
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
          '" fill="' + colors.line + '"/>');
      }

      // Label — placed on the longest segment, shifted to avoid overlapping nodes
      if (lk.label) {
        var bestIdx = 0, bestLen = 0;
        for (var si = 0; si < points.length - 1; si++) {
          var segLen = Math.abs(points[si+1].x - points[si].x) + Math.abs(points[si+1].y - points[si].y);
          if (segLen > bestLen) { bestLen = segLen; bestIdx = si; }
        }
        var lp0 = points[bestIdx], lp1 = points[bestIdx + 1];
        var lx = (lp0.x + lp1.x) / 2, ly = (lp0.y + lp1.y) / 2;
        var isH = Math.abs(lp1.y - lp0.y) < 1;
        var lAnchor = 'middle';
        var labelW = UMLShared.textWidth(lk.label, false, CFG.fontSize);
        var labelH = CFG.fontSize;
        if (isH) {
          ly -= 8;
        } else {
          lx += 10; lAnchor = 'start';
        }
        // Check if label overlaps any node and shift if needed
        var lblLeft = (lAnchor === 'middle') ? lx - labelW / 2 : lx;
        var lblRight = lblLeft + labelW;
        var lblTop = ly - labelH;
        var lblBot = ly + 4;
        var labelShifted = false;
        for (var lni = 0; lni < obstacles.length; lni++) {
          var lob = obstacles[lni];
          if (lblRight > lob.x1 && lblLeft < lob.x2 && lblBot > lob.y1 && lblTop < lob.y2) {
            // Label overlaps this node — try placing on opposite side of the line
            if (!isH) {
              // Vertical segment: try left side instead
              lx = lp0.x - 10; lAnchor = 'end';
              lblLeft = lx - labelW; lblRight = lx;
              // Check again
              var stillHits = false;
              for (var lni2 = 0; lni2 < obstacles.length; lni2++) {
                var lob2 = obstacles[lni2];
                if (lblRight > lob2.x1 && lblLeft < lob2.x2 && lblBot > lob2.y1 && lblTop < lob2.y2) {
                  stillHits = true; break;
                }
              }
              if (stillHits) {
                // Both sides blocked — place above/below the segment midpoint, offset further right
                lx = lob.x2 + 10; lAnchor = 'start';
              }
            } else {
              // Horizontal segment: try below instead of above
              ly = lp0.y + labelH + 4;
            }
            labelShifted = true;
            break;
          }
        }
        svg.push('<text x="' + lx + '" y="' + ly +
          '" text-anchor="' + lAnchor + '" font-size="' + CFG.fontSize + '" fill="' + colors.text +
          '" stroke="' + colors.fill + '" stroke-width="4" stroke-opacity="0.85" stroke-linejoin="round" paint-order="stroke" font-style="italic">' +
          UMLShared.escapeXml(lk.label) + '</text>');
      }
    }

    // ── Draw nodes (3D cube style) ──
    for (var en in entries) {
      var e = entries[en];
      var n = e.node;
      var bx = e.x, by = e.y, bw = e.box.width, bh = e.box.height;
      var d = CFG.node3dDepth;

      // 3D effect: top face (parallelogram)
      svg.push('<polygon points="' +
        bx + ',' + by + ' ' +
        (bx + d) + ',' + (by - d) + ' ' +
        (bx + bw + d) + ',' + (by - d) + ' ' +
        (bx + bw) + ',' + by +
        '" fill="' + colors.headerFill + '" stroke="' + colors.stroke + '" stroke-width="' + CFG.strokeWidth + '"/>');

      // 3D effect: right face (parallelogram)
      svg.push('<polygon points="' +
        (bx + bw) + ',' + by + ' ' +
        (bx + bw + d) + ',' + (by - d) + ' ' +
        (bx + bw + d) + ',' + (by + bh - d) + ' ' +
        (bx + bw) + ',' + (by + bh) +
        '" fill="' + colors.headerFill + '" stroke="' + colors.stroke + '" stroke-width="' + CFG.strokeWidth + '" opacity="0.8"/>');

      // Front face (main rectangle)
      svg.push('<rect x="' + bx + '" y="' + by + '" width="' + bw + '" height="' + bh +
        '" fill="' + colors.fill + '" stroke="' + colors.stroke + '" stroke-width="' + CFG.strokeWidth + '"/>');

      // Node name (top area) — bold for classifier, underlined for instance (name:Type per UML spec Fig 9-3)
      var nameAttrs = ' font-size="' + CFG.fontSizeBold + '" fill="' + colors.text + '"';
      if (n.isInstance) {
        nameAttrs += ' text-decoration="underline"';
      } else {
        nameAttrs += ' font-weight="bold"';
      }
      svg.push('<text x="' + (bx + CFG.nodePadX) + '" y="' + (by + CFG.nodePadY + CFG.lineHeight * 0.75) + '"' +
        nameAttrs + '>' + UMLShared.escapeXml(n.name) + '</text>');

      // Components inside the node
      var compY = by + CFG.nodePadY + CFG.lineHeight + 8;
      for (var c = 0; c < n.components.length; c++) {
        var compName = n.components[c];
        var compW = bw - CFG.nodePadX * 2;
        var cx = bx + CFG.nodePadX;

        // Component rectangle
        svg.push('<rect x="' + cx + '" y="' + compY + '" width="' + compW + '" height="' + CFG.compH +
          '" fill="' + colors.headerFill + '" stroke="' + colors.stroke + '" stroke-width="1"/>');

        // Component icon (small rect with tabs)
        var ix = cx + compW - CFG.compIconW - 6;
        var iy = compY + (CFG.compH - CFG.compIconH) / 2;
        svg.push('<rect x="' + ix + '" y="' + iy + '" width="' + CFG.compIconW + '" height="' + CFG.compIconH +
          '" fill="' + colors.fill + '" stroke="' + colors.stroke + '" stroke-width="0.8"/>');
        svg.push('<rect x="' + (ix - CFG.compIconTabW / 2) + '" y="' + (iy + 1) +
          '" width="' + CFG.compIconTabW + '" height="' + CFG.compIconTabH +
          '" fill="' + colors.fill + '" stroke="' + colors.stroke + '" stroke-width="0.8"/>');
        svg.push('<rect x="' + (ix - CFG.compIconTabW / 2) + '" y="' + (iy + CFG.compIconH - CFG.compIconTabH - 1) +
          '" width="' + CFG.compIconTabW + '" height="' + CFG.compIconTabH +
          '" fill="' + colors.fill + '" stroke="' + colors.stroke + '" stroke-width="0.8"/>');

        // Component name
        svg.push('<text x="' + (cx + CFG.compPadX) + '" y="' + (compY + CFG.compH / 2 + CFG.fontSizeComp * 0.35) +
          '" font-size="' + CFG.fontSizeComp + '" fill="' + colors.text + '">' +
          UMLShared.escapeXml(compName) + '</text>');

        compY += CFG.compH + CFG.compGapY;
      }
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

  // ─── Public API ───────────────────────────────────────────────────

  function render(container, text) {
    var parsed = parse(text);
    if (!parsed.nodes || parsed.nodes.length === 0) {
      container.innerHTML = '<div style="padding:20px;color:#888;text-align:center;">No nodes to display.</div>';
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

  UMLShared.createAutoInit('pre > code.language-uml-deployment', render);

  window.UMLDeploymentDiagram = { render: render, parse: parse };
})();
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
        UMLShared.drawOpenArrow(svg, p2.x, p2.y, -adx, -ady, colors.line);
      } else if (rel.type === 'generalization') {
        UMLShared.drawHollowTriangle(svg, p2.x, p2.y, -adx, -ady, colors);
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

  /**
   * Hollow triangle arrowhead (for generalization).
   */

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
    // Pending branch endpoints from endif (to connect to next node instead of merge diamond)
    var pendingMergeEnds = [];

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

    // After endif, pending branch endpoints need to connect to the next
    // node that currentNode connects to.  Call this whenever we create
    // an edge from currentNode to some target.
    function flushPendingMergeEnds(targetId) {
      if (pendingMergeEnds.length > 0) {
        for (var pm = 0; pm < pendingMergeEnds.length; pm++) {
          addEdge(pendingMergeEnds[pm], targetId);
        }
        pendingMergeEnds = [];
      }
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
          flushPendingMergeEnds(forkId);
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
          flushPendingMergeEnds(decId);
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
          // Instead of creating a merge diamond, collect pending
          // branch endpoints so the next node receives their edges.
          var pendingEnds = [];
          if (decCtx2.thenEnd && !isFinalNode(decCtx2.thenEnd)) {
            pendingEnds.push(decCtx2.thenEnd);
          }
          if (decCtx2.elseEnd && !isFinalNode(decCtx2.elseEnd)) {
            pendingEnds.push(decCtx2.elseEnd);
          }
          // Use the first pending end as currentNode (for the next
          // transition line) and stash the rest to be connected later.
          if (pendingEnds.length > 0) {
            currentNode = pendingEnds[0];
            for (var pe = 1; pe < pendingEnds.length; pe++) {
              pendingMergeEnds.push(pendingEnds[pe]);
            }
          }
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
          flushPendingMergeEnds(targetNode.id);
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
          flushPendingMergeEnds(fId);
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

    // Map coords back (Y positions from Sugiyama, X will be overridden for swimlanes)
    for (var nm in result.nodes) {
      if (!entries[nm]) continue;
      entries[nm].x = result.nodes[nm].x;
      entries[nm].y = result.nodes[nm].y;
    }

    // ── Override X positions for swimlane columns ──
    if (parsed.lanes && parsed.lanes.length > 0) {
      var lanes = parsed.lanes;
      var laneMinW = 180;

      // Compute the minimum width needed for each lane
      var laneWidths = [];
      for (var lw = 0; lw < lanes.length; lw++) {
        var maxNodeW = 0;
        for (var nid in entries) {
          if (entries[nid].node.lane === lanes[lw]) {
            maxNodeW = Math.max(maxNodeW, entries[nid].box.width);
          }
        }
        var headerW = UMLShared.textWidth(lanes[lw], true, CFG.fontSizeBold) + CFG.lanePadX * 2;
        laneWidths.push(Math.max(laneMinW, maxNodeW + CFG.lanePadX * 2, headerW));
      }

      // Compute lane column X positions (left edge of each lane)
      var laneXStarts = [];
      var curX = 0;
      for (var lx = 0; lx < lanes.length; lx++) {
        laneXStarts.push(curX);
        curX += laneWidths[lx];
      }

      // Build a lane index lookup
      var laneIndex = {};
      for (var idx = 0; idx < lanes.length; idx++) {
        laneIndex[lanes[idx]] = idx;
      }

      // Override X for each node: center within its lane column
      for (var nid2 in entries) {
        var ent = entries[nid2];
        var laneName = ent.node.lane;
        if (laneName && laneIndex[laneName] !== undefined) {
          var li2 = laneIndex[laneName];
          var laneCenterX = laneXStarts[li2] + laneWidths[li2] / 2;
          ent.x = laneCenterX - ent.box.width / 2;
        }
      }
    }

    // Compute bounding box after any swimlane overrides
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var nm2 in entries) {
      minX = Math.min(minX, entries[nm2].x);
      minY = Math.min(minY, entries[nm2].y);
      maxX = Math.max(maxX, entries[nm2].x + entries[nm2].box.width);
      maxY = Math.max(maxY, entries[nm2].y + entries[nm2].box.height);
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
        var tgt = UMLShared.resolveNodeTarget(pn.target, entries);
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

      // Force all segments to be strictly horizontal or vertical
      for (var oi = 1; oi < points.length; oi++) {
        var pp = points[oi - 1], pc = points[oi];
        if (pp.x !== pc.x && pp.y !== pc.y) {
          points.splice(oi, 0, { x: pc.x, y: pp.y });
          oi++;
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
      UMLShared.drawArrow(svg, pLast.x, pLast.y, -adx, -ady, colors.line);

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
    UMLShared.autoFitSVG(container);
  }

  // ─── Auto-init ────────────────────────────────────────────────────

  UMLShared.createAutoInit('pre > code.language-uml-activity', render);
  window.UMLActivityDiagram = { render: render, parse: parse };
})();
/**
 * UML Notation Symbol Renderer
 *
 * Renders small inline SVG icons for individual UML notation symbols.
 *
 * Usage — specify diagram type via data-diagram:
 *
 *   Class diagram symbols (data-diagram="class"):
 *     <span class="uml-sym" data-diagram="class" data-sym="--|>"></span>   Generalization
 *     <span class="uml-sym" data-diagram="class" data-sym="..|>"></span>   Realization
 *     <span class="uml-sym" data-diagram="class" data-sym="--"></span>     Association
 *     <span class="uml-sym" data-diagram="class" data-sym="-->"></span>    Navigable association
 *     <span class="uml-sym" data-diagram="class" data-sym="*--"></span>    Composition
 *     <span class="uml-sym" data-diagram="class" data-sym="o--"></span>    Aggregation
 *     <span class="uml-sym" data-diagram="class" data-sym="..>"></span>    Dependency
 *
 *   Sequence diagram symbols (data-diagram="sequence"):
 *     <span class="uml-sym" data-diagram="sequence" data-sym="->"></span>   Synchronous call
 *     <span class="uml-sym" data-diagram="sequence" data-sym="-->"></span>  Return / response
 *     <span class="uml-sym" data-diagram="sequence" data-sym="->>"></span>  Asynchronous message
 *
 *   State diagram symbols (data-diagram="state"):
 *     <span class="uml-sym" data-diagram="state" data-sym="-->"></span>    Transition
 *     <span class="uml-sym" data-diagram="state" data-sym="[*]"></span>    Initial / final pseudo-state
 */
(function () {
  'use strict';

  var W = 80, H = 24, CY = 12, PAD = 4;

  function getColors(el) {
    var cs = window.getComputedStyle(el);
    var get = function (prop, fb) {
      var v = cs.getPropertyValue(prop).trim();
      return v || fb;
    };
    return {
      line: get('--uml-line', '#444'),
      fill: get('--uml-fill', '#fff'),
    };
  }

  function ln(x1, x2, c, dash) {
    return '<line x1="' + x1 + '" y1="' + CY + '" x2="' + x2 + '" y2="' + CY +
      '" stroke="' + c + '" stroke-width="1.5"' + (dash ? ' stroke-dasharray="5,3"' : '') + '/>';
  }

  function openArrow(ax, c) {
    return '<polyline points="' + (ax - 10) + ',' + (CY - 6) + ' ' + ax + ',' + CY + ' ' +
      (ax - 10) + ',' + (CY + 6) + '" fill="none" stroke="' + c + '" stroke-width="1.5"/>';
  }

  function filledArrow(ax, c) {
    return '<polygon points="' + ax + ',' + CY + ' ' + (ax - 10) + ',' + (CY - 5) + ' ' +
      (ax - 10) + ',' + (CY + 5) + '" fill="' + c + '" stroke="none"/>';
  }

  function hollowTriangle(c, fill) {
    var tx = W - PAD, tb = tx - 14;
    return '<polygon points="' + tx + ',' + CY + ' ' + tb + ',' + (CY - 7) + ' ' + tb + ',' + (CY + 7) +
      '" fill="' + fill + '" stroke="' + c + '" stroke-width="1.5"/>';
  }

  function diamond(filled, c, fill) {
    var dx = PAD, cx = dx + 7, ex = dx + 14;
    return '<polygon points="' + dx + ',' + CY + ' ' + cx + ',' + (CY - 6) + ' ' + ex + ',' + CY + ' ' + cx + ',' + (CY + 6) +
      '" fill="' + (filled ? c : fill) + '" stroke="' + c + '" stroke-width="1.5"/>';
  }

  var SYMBOLS = {
    class: {
      '--|>': function (c) {
        return ln(PAD, W - PAD - 14, c.line, false) + hollowTriangle(c.line, c.fill);
      },
      '..|>': function (c) {
        return ln(PAD, W - PAD - 14, c.line, true) + hollowTriangle(c.line, c.fill);
      },
      '--': function (c) {
        return ln(PAD, W - PAD, c.line, false);
      },
      '-->': function (c) {
        return ln(PAD, W - PAD, c.line, false) + openArrow(W - PAD, c.line);
      },
      '*--': function (c) {
        return diamond(true, c.line, c.fill) + ln(PAD + 14, W - PAD, c.line, false);
      },
      'o--': function (c) {
        return diamond(false, c.line, c.fill) + ln(PAD + 14, W - PAD, c.line, false);
      },
      '..>': function (c) {
        return ln(PAD, W - PAD, c.line, true) + openArrow(W - PAD, c.line);
      },
    },
    sequence: {
      '->': function (c) {
        return ln(PAD, W - PAD, c.line, false) + filledArrow(W - PAD, c.line);
      },
      '-->': function (c) {
        return ln(PAD, W - PAD, c.line, true) + openArrow(W - PAD, c.line);
      },
      '->>': function (c) {
        return ln(PAD, W - PAD, c.line, false) + openArrow(W - PAD, c.line);
      },
    },
    state: {
      '-->': function (c) {
        return ln(PAD, W - PAD, c.line, false) + filledArrow(W - PAD, c.line);
      },
      '[*]': function (c) {
        return '<circle cx="' + (PAD + 8) + '" cy="' + CY + '" r="8" fill="' + c.line + '"/>';
      },
      '[*]-->': function (c) {
        return '<circle cx="' + (PAD + 8) + '" cy="' + CY + '" r="8" fill="' + c.line + '"/>' +
          ln(PAD + 16, W - PAD, c.line, false) + filledArrow(W - PAD, c.line);
      },
    },
  };

  function renderOne(el) {
    var diagram = el.getAttribute('data-diagram') || 'class';
    var sym = el.getAttribute('data-sym') || '';
    var diagSymbols = SYMBOLS[diagram];
    if (!diagSymbols || !diagSymbols[sym]) return;
    var colors = getColors(el);
    var inner = diagSymbols[sym](colors);
    el.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H +
      '" viewBox="0 0 ' + W + ' ' + H + '" style="vertical-align:middle;overflow:visible;">' +
      inner + '</svg>';
  }

  function renderAll() {
    var els = document.querySelectorAll('.uml-sym[data-sym]');
    for (var i = 0; i < els.length; i++) renderOne(els[i]);
  }

  new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      if (muts[i].attributeName === 'class') { setTimeout(renderAll, 50); return; }
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderAll);
  } else {
    renderAll();
  }

  window.UMLNotation = { render: renderOne, renderAll: renderAll };
})();
