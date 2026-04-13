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

  function parseLayoutDirective(line) {
    var layoutMatch = line.match(/^layout\s+(.+)$/i);
    if (!layoutMatch) return null;

    var value = layoutMatch[1].trim().toLowerCase();
    if (value === 'horizontal' || value === 'left-to-right' || value === 'lr') {
      return { direction: 'LR', layoutPreference: null };
    }
    if (value === 'vertical' || value === 'top-to-bottom' || value === 'tb') {
      return { direction: 'TB', layoutPreference: null };
    }
    if (value === 'square' || value === 'landscape' || value === 'portrait' || value === 'auto' || value === 'default' || value === 'none') {
      return {
        direction: null,
        layoutPreference: (value === 'default' || value === 'none') ? 'auto' : value
      };
    }
    return null;
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
      'style="font-family: ' + ff + '; max-width: 100%; height: auto;">' +
      '<g transform="translate(' + ox + ',' + oy + ')">';
  }

  function svgClose() {
    return '</g></svg>';
  }

  function expandBounds(bounds, node, svg) {
    if (!node || !node.getBBox) return false;
    try {
      var bbox = node.getBBox();
      if (!bbox || !isFinite(bbox.x) || !isFinite(bbox.y) || !isFinite(bbox.width) || !isFinite(bbox.height)) {
        return false;
      }
      var ctm = node.getScreenCTM ? node.getScreenCTM() : null;
      var svgCtm = svg && svg.getScreenCTM ? svg.getScreenCTM() : null;
      if (!ctm || !svgCtm) return false;
      var rel = svgCtm.inverse().multiply(ctm);
      var corners = [
        { x: bbox.x, y: bbox.y },
        { x: bbox.x + bbox.width, y: bbox.y },
        { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
        { x: bbox.x, y: bbox.y + bbox.height }
      ];
      for (var i = 0; i < corners.length; i++) {
        var pt = corners[i];
        var tx = rel.a * pt.x + rel.c * pt.y + rel.e;
        var ty = rel.b * pt.x + rel.d * pt.y + rel.f;
        if (tx < bounds.minX) bounds.minX = tx;
        if (ty < bounds.minY) bounds.minY = ty;
        if (tx > bounds.maxX) bounds.maxX = tx;
        if (ty > bounds.maxY) bounds.maxY = ty;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function collectSvgBounds(svg, g) {
    if (!svg || !g) return null;
    var bounds = {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity
    };
    var measured = false;
    var nodes = g.querySelectorAll('*');
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var tag = node.tagName ? node.tagName.toLowerCase() : '';
      if (!tag || tag === 'defs' || tag === 'marker' || tag === 'script' || tag === 'style' || tag === 'title' || tag === 'desc') {
        continue;
      }
      if (expandBounds(bounds, node, svg)) measured = true;
    }
    if (!measured) {
      measured = expandBounds(bounds, g, svg);
    }
    return measured ? bounds : null;
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
    var refitQueued = false;
    var settleTimer = null;
    var settlePasses = 0;
    var visibilityMutationObserver = null;
    var visibilityObserver = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(function (entries) {
          for (var i = 0; i < entries.length; i++) {
            if (!entries[i].isIntersecting) continue;
            autoFitSVG(entries[i].target);
            var svg = entries[i].target.querySelector('svg');
            if (!isPlaceholderAutoFit(svg)) visibilityObserver.unobserve(entries[i].target);
          }
        }, { rootMargin: '200px 0px' })
      : null;

    function getDiagramContainers() {
      return document.querySelectorAll(
        '.uml-class-diagram-container,' +
        '.uml-sequence-diagram-container,' +
        '.uml-state-diagram-container,' +
        '.uml-component-diagram-container,' +
        '.uml-deployment-diagram-container,' +
        '.uml-usecase-diagram-container,' +
        '.uml-activity-diagram-container'
      );
    }

    function startSettleLoop() {
      if (settleTimer) return;
      settlePasses = 0;
      settleTimer = setInterval(function () {
        settlePasses++;
        var remaining = 0;
        var containers = getDiagramContainers();
        for (var d = 0; d < containers.length; d++) {
          var container = containers[d];
          if (!container || !container.isConnected) continue;
          autoFitSVG(container);
          var svg = container.querySelector('svg');
          if (isPlaceholderAutoFit(svg)) remaining++;
        }
        if (remaining === 0 || settlePasses >= 8) {
          clearInterval(settleTimer);
          settleTimer = null;
        }
      }, 400);
    }

    function refitAll() {
      refitQueued = false;
      var containers = getDiagramContainers();
      for (var d = 0; d < containers.length; d++) {
        if (containers[d] && containers[d].isConnected) {
          autoFitSVG(containers[d]);
        }
      }
    }

    function queueRefitAll() {
      if (refitQueued || typeof window === 'undefined') return;
      refitQueued = true;
      var raf = window.requestAnimationFrame || function (cb) { return setTimeout(cb, 16); };
      raf(function () {
        raf(refitAll);
      });
    }

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
        if (visibilityObserver) visibilityObserver.observe(container);
      }
      queueRefitAll();
      startSettleLoop();

      if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
        document.fonts.ready.then(queueRefitAll).catch(function () {});
      }
      window.addEventListener('load', queueRefitAll, { once: true });

      if (!visibilityMutationObserver && document.body) {
        visibilityMutationObserver = new MutationObserver(function () {
          setTimeout(function () {
            queueRefitAll();
            startSettleLoop();
          }, 60);
        });
        visibilityMutationObserver.observe(document.body, {
          subtree: true,
          attributes: true,
          attributeFilter: ['class', 'style', 'open', 'hidden']
        });
      }

      var observer = new MutationObserver(function (mutations) {
        for (var m = 0; m < mutations.length; m++) {
          if (mutations[m].attributeName === 'class') {
            setTimeout(function () {
              for (var d = 0; d < diagrams.length; d++) {
                renderFn(diagrams[d].container, diagrams[d].text);
                if (visibilityObserver) visibilityObserver.observe(diagrams[d].container);
              }
              queueRefitAll();
              startSettleLoop();
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
    svg.push('<polygon class="uml-note-box" points="' +
      x + ',' + y + ' ' +
      (x + w - f) + ',' + y + ' ' +
      (x + w) + ',' + (y + f) + ' ' +
      (x + w) + ',' + (y + h) + ' ' +
      x + ',' + (y + h) +
      '" fill="' + colors.fill + '" stroke="' + colors.line + '" stroke-width="1"/>');
    // Fold triangle
    svg.push('<polyline class="uml-note-fold" points="' +
      (x + w - f) + ',' + y + ' ' +
      (x + w - f) + ',' + (y + f) + ' ' +
      (x + w) + ',' + (y + f) +
      '" fill="none" stroke="' + colors.line + '" stroke-width="1"/>');
  }

  /**
   * Draw a dotted connector line with a small circle at the target attachment point.
   */
  function drawNoteConnector(svg, fromX, fromY, toX, toY, colors) {
    svg.push('<line class="uml-note-connector" x1="' + fromX + '" y1="' + fromY + '" x2="' + toX + '" y2="' + toY +
      '" stroke="' + colors.line + '" stroke-width="1" stroke-linecap="round" stroke-dasharray="' + NOTE_CFG.connectorDash + '"/>');
    svg.push('<circle class="uml-note-anchor" cx="' + toX + '" cy="' + toY + '" r="' + NOTE_CFG.circleR +
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
  function isPlaceholderAutoFit(svg) {
    if (!svg) return false;
    return svg.getAttribute('viewBox') === '-24 -24 48 48' &&
      svg.getAttribute('width') === '48' &&
      svg.getAttribute('height') === '48' &&
      !!svg.querySelector('g > *');
  }

  function applyAutoFitSVG(container, pad) {
    var svg = container.querySelector('svg');
    if (!svg) return false;
    var g = svg.querySelector('g');
    if (!g) return false;
    try {
      // Flush layout so SVG transforms are current before measuring bounds.
      svg.getBoundingClientRect();

      // Measure descendant nodes individually. A root <g>.getBBox() can miss
      // transformed descendants in dense component/class layouts, which clips
      // long routes and port labels when the viewBox is recomputed.
      var bounds = collectSvgBounds(svg, g);
      if (!bounds) return false;
      var minX = bounds.minX;
      var minY = bounds.minY;
      var maxX = bounds.maxX;
      var maxY = bounds.maxY;

      var p = pad || 24;
      var vx = Math.floor(minX - p);
      var vy = Math.floor(minY - p);
      var vw = Math.ceil((maxX - minX) + p * 2);
      var vh = Math.ceil((maxY - minY) + p * 2);
      svg.setAttribute('width', Math.ceil(vw));
      svg.setAttribute('height', Math.ceil(vh));
      svg.setAttribute('viewBox', Math.floor(vx) + ' ' + Math.floor(vy) + ' ' + Math.ceil(vw) + ' ' + Math.ceil(vh));
      return true;
    } catch (e) { /* getBBox can fail on hidden elements */ }
    return false;
  }

  function autoFitSVG(container, pad) {
    applyAutoFitSVG(container, pad);
    var svg = container && container.querySelector ? container.querySelector('svg') : null;
    if (!isPlaceholderAutoFit(svg)) {
      if (container && container.removeAttribute) container.removeAttribute('data-uml-autofit-retries');
      return;
    }

    var retries = Number(container.getAttribute('data-uml-autofit-retries') || '0');
    if (retries >= 2) return;

    container.setAttribute('data-uml-autofit-retries', String(retries + 1));
    setTimeout(function () {
      applyAutoFitSVG(container, pad);
      var retriedSvg = container.querySelector('svg');
      if (isPlaceholderAutoFit(retriedSvg)) {
        autoFitSVG(container, pad);
      } else {
        container.removeAttribute('data-uml-autofit-retries');
      }
    }, retries === 0 ? 120 : 360);
  }

  function resolveNodeTarget(targetName, entries) {
    if (!targetName) return null;

    var cleanTarget = targetName.replace(/^"|"$/g, '').trim();
    var dotIdx = cleanTarget.indexOf('.');
    var baseTarget = dotIdx === -1 ? cleanTarget : cleanTarget.substring(0, dotIdx).trim();
    var memberTarget = dotIdx === -1 ? '' : cleanTarget.substring(dotIdx + 1).trim();

    function rectForEntry(entry) {
      return entry ? { x: entry.x, y: entry.y, w: entry.box.width, h: entry.box.height } : null;
    }

    function resolveMemberRect(entry, memberName) {
      if (!entry || !entry.noteTargets || !memberName) return null;
      if (entry.noteTargets[memberName]) return entry.noteTargets[memberName];

      var lower = memberName.toLowerCase();
      for (var key in entry.noteTargets) {
        if (Object.prototype.hasOwnProperty.call(entry.noteTargets, key) && key.toLowerCase() === lower) {
          return entry.noteTargets[key];
        }
      }
      return null;
    }

    function matchesEntry(entry, name) {
      return (entry.node && entry.node.label === name) ||
        (entry.state && entry.state.name === name) ||
        (entry.comp && entry.comp.name === name) ||
        (entry.cls && entry.cls.name === name);
    }

    if (entries[baseTarget]) {
      return resolveMemberRect(entries[baseTarget], memberTarget) || rectForEntry(entries[baseTarget]);
    }
    for (var entryKey in entries) {
      if (!Object.prototype.hasOwnProperty.call(entries, entryKey)) continue;
      var ent = entries[entryKey];
      if (matchesEntry(ent, baseTarget)) {
        return resolveMemberRect(ent, memberTarget) || rectForEntry(ent);
      }
    }
    return null;
  }

  function makeRect(x, y, w, h) {
    return {
      x: x,
      y: y,
      w: w,
      h: h,
      left: x,
      right: x + w,
      top: y,
      bottom: y + h
    };
  }

  function normalizeRect(rect) {
    if (!rect) return null;
    if (typeof rect.left === 'number' && typeof rect.right === 'number' &&
        typeof rect.top === 'number' && typeof rect.bottom === 'number') {
      return makeRect(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top);
    }
    if (typeof rect.x === 'number' && typeof rect.y === 'number') {
      var rw = typeof rect.w === 'number' ? rect.w : rect.width;
      var rh = typeof rect.h === 'number' ? rect.h : rect.height;
      if (typeof rw === 'number' && typeof rh === 'number') {
        return makeRect(rect.x, rect.y, rw, rh);
      }
    }
    return null;
  }

  function rectsOverlap(a, b, pad) {
    var ra = normalizeRect(a);
    var rb = normalizeRect(b);
    var gap = pad || 0;
    if (!ra || !rb) return false;
    return ra.right + gap > rb.left && ra.left - gap < rb.right &&
      ra.bottom + gap > rb.top && ra.top - gap < rb.bottom;
  }

  function rectOverlapArea(a, b, pad) {
    var ra = normalizeRect(a);
    var rb = normalizeRect(b);
    var gap = pad || 0;
    if (!ra || !rb) return 0;
    var left = Math.max(ra.left - gap, rb.left);
    var right = Math.min(ra.right + gap, rb.right);
    var top = Math.max(ra.top - gap, rb.top);
    var bottom = Math.min(ra.bottom + gap, rb.bottom);
    if (right <= left || bottom <= top) return 0;
    return (right - left) * (bottom - top);
  }

  function uniqueRounded(values) {
    var out = [];
    var seen = {};
    for (var i = 0; i < values.length; i++) {
      var v = Math.round(values[i]);
      if (!seen[v]) {
        seen[v] = true;
        out.push(values[i]);
      }
    }
    return out;
  }

  function placeNoteRect(targetRect, noteSize, position, obstacles, placedRects, options) {
    var target = normalizeRect(targetRect);
    if (!target) return { x: 0, y: 0 };

    var noteW = typeof noteSize.width === 'number' ? noteSize.width : noteSize.w;
    var noteH = typeof noteSize.height === 'number' ? noteSize.height : noteSize.h;
    var opts = options || {};
    var gap = typeof opts.gap === 'number' ? opts.gap : NOTE_CFG.gap;
    var slideStep = typeof opts.slideStep === 'number' ? opts.slideStep : 18;
    var maxSlides = typeof opts.maxSlides === 'number' ? opts.maxSlides : 8;
    var distanceStep = typeof opts.distanceStep === 'number' ? opts.distanceStep : 18;
    var distanceLevels = typeof opts.distanceLevels === 'number' ? opts.distanceLevels : 4;
    var overlapPad = typeof opts.overlapPad === 'number' ? opts.overlapPad : 6;
    var allObstacles = obstacles || [];
    var allPlaced = placedRects || [];

    var slides = [0];
    for (var si = 1; si <= maxSlides; si++) {
      slides.push(-si * slideStep, si * slideStep);
    }
    var distances = [0];
    for (var di = 1; di <= distanceLevels; di++) {
      distances.push(di * distanceStep);
    }

    function candidateScore(rect, travelCost) {
      var overlapCount = 0;
      var overlapArea = 0;
      for (var oi = 0; oi < allObstacles.length; oi++) {
        if (rectsOverlap(rect, allObstacles[oi], overlapPad)) {
          overlapCount++;
          overlapArea += rectOverlapArea(rect, allObstacles[oi], overlapPad);
        }
      }
      for (var pi = 0; pi < allPlaced.length; pi++) {
        if (rectsOverlap(rect, allPlaced[pi], overlapPad + 2)) {
          overlapCount++;
          overlapArea += rectOverlapArea(rect, allPlaced[pi], overlapPad + 2);
        }
      }
      return overlapCount * 100000000 + overlapArea + travelCost;
    }

    var best = null;

    function consider(x, y, travelCost) {
      var rect = makeRect(x, y, noteW, noteH);
      var score = candidateScore(rect, travelCost);
      if (!best || score < best.score) {
        best = { x: x, y: y, score: score };
      }
    }

    if (position === 'left' || position === 'right') {
      var sideBases = uniqueRounded([
        target.y,
        target.y + target.h / 2 - noteH / 2,
        target.y + target.h - noteH
      ]);
      for (var distIdx = 0; distIdx < distances.length; distIdx++) {
        var dist = distances[distIdx];
        var noteX = position === 'right'
          ? target.x + target.w + gap + dist
          : target.x - noteW - gap - dist;
        for (var baseIdx = 0; baseIdx < sideBases.length; baseIdx++) {
          for (var slideIdx = 0; slideIdx < slides.length; slideIdx++) {
            consider(noteX, sideBases[baseIdx] + slides[slideIdx], dist * 6 + Math.abs(slides[slideIdx]) + baseIdx * 10);
          }
        }
      }
    } else if (position === 'top' || position === 'bottom') {
      var topBases = uniqueRounded([
        target.x,
        target.x + target.w / 2 - noteW / 2,
        target.x + target.w - noteW
      ]);
      for (var distIdx2 = 0; distIdx2 < distances.length; distIdx2++) {
        var dist2 = distances[distIdx2];
        var noteY = position === 'top'
          ? target.y - noteH - gap - dist2
          : target.y + target.h + gap + dist2;
        for (var baseIdx2 = 0; baseIdx2 < topBases.length; baseIdx2++) {
          for (var slideIdx2 = 0; slideIdx2 < slides.length; slideIdx2++) {
            consider(topBases[baseIdx2] + slides[slideIdx2], noteY, dist2 * 6 + Math.abs(slides[slideIdx2]) + baseIdx2 * 10);
          }
        }
      }
    } else {
      var baseX = target.x + target.w / 2 - noteW / 2;
      var baseY = target.y;
      var overOffsets = [
        { dx: 0, dy: 0 },
        { dx: 0, dy: -slideStep }, { dx: 0, dy: slideStep },
        { dx: -slideStep, dy: 0 }, { dx: slideStep, dy: 0 },
        { dx: 0, dy: -slideStep * 2 }, { dx: 0, dy: slideStep * 2 },
        { dx: -slideStep * 2, dy: 0 }, { dx: slideStep * 2, dy: 0 },
        { dx: -slideStep, dy: -slideStep }, { dx: slideStep, dy: -slideStep },
        { dx: -slideStep, dy: slideStep }, { dx: slideStep, dy: slideStep },
        { dx: 0, dy: -noteH - gap / 2 }, { dx: 0, dy: noteH + gap / 2 }
      ];
      for (var oi2 = 0; oi2 < overOffsets.length; oi2++) {
        var off = overOffsets[oi2];
        consider(baseX + off.dx, baseY + off.dy, Math.abs(off.dx) + Math.abs(off.dy));
      }
    }

    return best ? { x: best.x, y: best.y } : { x: target.x, y: target.y };
  }

  function computeAnchoredNotes(notes, entries, extraObstacles, options) {
    var notePositions = [];
    if (!notes || !entries) return notePositions;

    var entryObstacles = [];
    for (var key in entries) {
      var entry = entries[key];
      if (entry && entry.box) {
        entryObstacles.push({ x: entry.x, y: entry.y, w: entry.box.width, h: entry.box.height, name: key });
      }
    }
    var staticObstacles = entryObstacles.slice();
    if (extraObstacles && extraObstacles.length) {
      for (var oi = 0; oi < extraObstacles.length; oi++) staticObstacles.push(extraObstacles[oi]);
    }
    var placedRects = [];

    for (var ni = 0; ni < notes.length; ni++) {
      var note = notes[ni];
      var target = resolveNodeTarget(note.target, entries);
      if (!target) continue;
      var size = measureNote(note.lines);
      var usableObstacles = [];
      for (var si = 0; si < staticObstacles.length; si++) {
        var obstacle = staticObstacles[si];
        var sameAsTarget = typeof obstacle.x === 'number' && obstacle.x === target.x && obstacle.y === target.y &&
          ((obstacle.w === target.w && obstacle.h === target.h) || (obstacle.width === target.w && obstacle.height === target.h));
        if (!sameAsTarget) usableObstacles.push(obstacle);
      }
      var placed = placeNoteRect(target, size, note.position, usableObstacles, placedRects, options);
      var rect = { x: placed.x, y: placed.y, w: size.width, h: size.height };
      notePositions.push({
        note: note,
        x: placed.x,
        y: placed.y,
        w: size.width,
        h: size.height,
        tx: target.x,
        ty: target.y,
        tw: target.w,
        th: target.h
      });
      placedRects.push(rect);
    }
    return notePositions;
  }

  function intervalGap(a1, a2, b1, b2) {
    if (a2 < b1) return b1 - a2;
    if (b2 < a1) return a1 - b2;
    return 0;
  }

  function rectDistance(a, b) {
    var ra = normalizeRect(a);
    var rb = normalizeRect(b);
    if (!ra || !rb) return Infinity;
    var dx = intervalGap(ra.left, ra.right, rb.left, rb.right);
    var dy = intervalGap(ra.top, ra.bottom, rb.top, rb.bottom);
    if (dx === 0 && dy === 0) return 0;
    if (dx === 0) return dy;
    if (dy === 0) return dx;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function obstacleToRect(obstacle) {
    if (!obstacle) return null;
    if (typeof obstacle.x1 === 'number' && typeof obstacle.y1 === 'number' &&
        typeof obstacle.x2 === 'number' && typeof obstacle.y2 === 'number') {
      return makeRect(obstacle.x1, obstacle.y1, obstacle.x2 - obstacle.x1, obstacle.y2 - obstacle.y1);
    }
    return normalizeRect(obstacle);
  }

  function segmentDistanceToRect(segment, rect) {
    var rr = normalizeRect(rect);
    if (!rr) return Infinity;
    var dx, dy;
    if (segment.isH) {
      dx = intervalGap(rr.left, rr.right, segment.x1, segment.x2);
      dy = intervalGap(rr.top, rr.bottom, segment.y, segment.y);
    } else {
      dx = intervalGap(rr.left, rr.right, segment.x, segment.x);
      dy = intervalGap(rr.top, rr.bottom, segment.y1, segment.y2);
    }
    if (dx === 0 && dy === 0) return 0;
    if (dx === 0) return dy;
    if (dy === 0) return dx;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function buildOrthogonalSegments(points) {
    var segments = [];
    if (!points || points.length < 2) return segments;
    for (var si = 0; si < points.length - 1; si++) {
      var p0 = points[si], p1 = points[si + 1];
      var length = Math.abs(p1.x - p0.x) + Math.abs(p1.y - p0.y);
      if (length < 8) continue;
      if (Math.abs(p1.y - p0.y) < 1) {
        segments.push({
          segmentIndex: si,
          isH: true,
          length: length,
          x1: Math.min(p0.x, p1.x),
          x2: Math.max(p0.x, p1.x),
          y: p0.y
        });
      } else if (Math.abs(p1.x - p0.x) < 1) {
        segments.push({
          segmentIndex: si,
          isH: false,
          length: length,
          x: p0.x,
          y1: Math.min(p0.y, p1.y),
          y2: Math.max(p0.y, p1.y)
        });
      }
    }
    return segments;
  }

  function makeLabelRect(x, y, labelW, labelH, anchor) {
    var left = anchor === 'middle' ? x - labelW / 2 : (anchor === 'end' ? x - labelW : x);
    return {
      left: left,
      right: left + labelW,
      top: y - labelH,
      bottom: y + 4
    };
  }

  function labelRectHitsObstacles(rect, obstacles, pad) {
    for (var i = 0; i < obstacles.length; i++) {
      var obstacleRect = obstacleToRect(obstacles[i]);
      if (obstacleRect && rectsOverlap(rect, obstacleRect, pad)) return true;
    }
    return false;
  }

  function labelRectHitsPlacedLabels(rect, placedLabels, pad) {
    for (var i = 0; i < placedLabels.length; i++) {
      if (rectsOverlap(rect, placedLabels[i], pad)) return true;
    }
    return false;
  }

  function labelRectHitsSegments(rect, segments, skipSegmentIndex, pad) {
    var gap = pad || 0;
    for (var i = 0; i < segments.length; i++) {
      var segment = segments[i];
      if (skipSegmentIndex === segment.segmentIndex) continue;
      if (segment.isH) {
        if (segment.y >= rect.top - gap && segment.y <= rect.bottom + gap &&
            segment.x2 > rect.left - gap && segment.x1 < rect.right + gap) {
          return true;
        }
      } else if (segment.x >= rect.left - gap && segment.x <= rect.right + gap &&
                 segment.y2 > rect.top - gap && segment.y1 < rect.bottom + gap) {
        return true;
      }
    }
    return false;
  }

  function minLabelClearance(rect, obstacles, placedLabels, ownSegments, skipSegmentIndex, otherSegments) {
    var min = Infinity;
    for (var i = 0; i < obstacles.length; i++) {
      var obstacleRect = obstacleToRect(obstacles[i]);
      if (obstacleRect) min = Math.min(min, rectDistance(rect, obstacleRect));
    }
    for (var j = 0; j < placedLabels.length; j++) {
      min = Math.min(min, rectDistance(rect, placedLabels[j]));
    }
    for (var k = 0; k < ownSegments.length; k++) {
      if (ownSegments[k].segmentIndex === skipSegmentIndex) continue;
      min = Math.min(min, segmentDistanceToRect(ownSegments[k], rect));
    }
    for (var m = 0; m < otherSegments.length; m++) {
      min = Math.min(min, segmentDistanceToRect(otherSegments[m], rect));
    }
    return isFinite(min) ? min : 120;
  }

  function placeOrthogonalLabel(label, points, obstacles, placedLabels, options) {
    var opts = options || {};
    var fontSize = opts.fontSize || 14;
    var labelW = textWidth(label, false, fontSize);
    var labelH = fontSize + 6;
    var segments = buildOrthogonalSegments(points);
    var fractions = opts.fractions || [0.5, 0.35, 0.65, 0.22, 0.78];
    var otherSegments = opts.otherSegments || [];

    if (!segments.length) return null;

    segments.sort(function(a, b) {
      if (a.isH !== b.isH) return a.isH ? -1 : 1;
      if (b.length !== a.length) return b.length - a.length;
      return a.segmentIndex - b.segmentIndex;
    });

    var best = null;
    var bestSoft = null;

    for (var gi = 0; gi < segments.length; gi++) {
      var segment = segments[gi];
      var placements = segment.isH
        ? (opts.horizontalPlacements || [
            { anchor: 'middle', dx: 0, dy: -10, penalty: 0 },
            { anchor: 'middle', dx: 0, dy: labelH + 4, penalty: 8 }
          ])
        : (opts.verticalPlacements || [
            { anchor: 'start', dx: 10, dy: 0, penalty: 2 },
            { anchor: 'end', dx: -10, dy: 0, penalty: 6 }
          ]);

      for (var pi = 0; pi < placements.length; pi++) {
        var placement = placements[pi];
        for (var fi = 0; fi < fractions.length; fi++) {
          var fraction = fractions[fi];
          var lx, ly;
          if (segment.isH) {
            lx = segment.x1 + (segment.x2 - segment.x1) * fraction + placement.dx;
            ly = segment.y + placement.dy;
          } else {
            lx = segment.x + placement.dx;
            ly = segment.y1 + (segment.y2 - segment.y1) * fraction + placement.dy;
          }

          var rect = makeLabelRect(lx, ly, labelW, labelH, placement.anchor);
          if (labelRectHitsObstacles(rect, obstacles, opts.obstaclePad || 6)) continue;
          if (labelRectHitsPlacedLabels(rect, placedLabels, opts.labelPad || 8)) continue;

          var hitsSegments = labelRectHitsSegments(rect, segments, segment.segmentIndex, opts.segmentPad || 3) ||
            labelRectHitsSegments(rect, otherSegments, null, opts.segmentPad || 3);
          var clearance = minLabelClearance(rect, obstacles, placedLabels, segments, segment.segmentIndex, otherSegments);
          var score = segment.length * 2 + (segment.isH ? 24 : 0) + Math.min(clearance, 80) -
            Math.abs(fraction - 0.5) * 30 - placement.penalty;

          if (typeof opts.scoreCandidate === 'function') {
            score += opts.scoreCandidate(segment, placement, fraction, rect) || 0;
          }

          var candidate = {
            x: lx,
            y: ly,
            anchor: placement.anchor,
            rect: rect,
            score: score
          };

          if (hitsSegments) {
            candidate.score -= 40;
            if (!bestSoft || candidate.score > bestSoft.score) bestSoft = candidate;
          } else if (!best || candidate.score > best.score) {
            best = candidate;
          }
        }
      }
    }

    if (best) return best;
    if (bestSoft) return bestSoft;

    var fallbackSeg = segments[0];
    var fallbackAnchor = fallbackSeg.isH ? 'middle' : 'start';
    var fallbackX = fallbackSeg.isH ? (fallbackSeg.x1 + fallbackSeg.x2) / 2 : fallbackSeg.x + 10;
    var fallbackY = fallbackSeg.isH ? fallbackSeg.y - 10 : (fallbackSeg.y1 + fallbackSeg.y2) / 2;
    return {
      x: fallbackX,
      y: fallbackY,
      anchor: fallbackAnchor,
      rect: makeLabelRect(fallbackX, fallbackY, labelW, labelH, fallbackAnchor),
      score: -Infinity
    };
  }

  var ORTHO_ROUTE_LANE_STEP = 14;
  var ORTHO_ROUTE_LANE_CLEARANCE = 6;
  var ORTHO_ROUTE_TRACK_MIN_LEN = 24;
  var ORTHO_ROUTE_BEND_PENALTY = 42;

  function rangesOverlap(a1, a2, b1, b2, minOverlap) {
    var overlap = Math.min(Math.max(a1, a2), Math.max(b1, b2)) -
      Math.max(Math.min(a1, a2), Math.min(b1, b2));
    return overlap > (minOverlap || 0);
  }

  function hSegHitsOccupied(y, xMin, xMax, occupied) {
    if (!occupied) return false;
    for (var i = 0; i < occupied.h.length; i++) {
      var seg = occupied.h[i];
      if (Math.abs(seg.y - y) < ORTHO_ROUTE_LANE_CLEARANCE &&
          rangesOverlap(xMin, xMax, seg.x1, seg.x2, 6)) {
        return true;
      }
    }
    return false;
  }

  function vSegHitsOccupied(x, yMin, yMax, occupied) {
    if (!occupied) return false;
    for (var i = 0; i < occupied.v.length; i++) {
      var seg = occupied.v[i];
      if (Math.abs(seg.x - x) < ORTHO_ROUTE_LANE_CLEARANCE &&
          rangesOverlap(yMin, yMax, seg.y1, seg.y2, 6)) {
        return true;
      }
    }
    return false;
  }

  function simplifyOrthogonalPath(points) {
    if (!points || points.length <= 2) return points || [];

    function isBetween(a, b, c) {
      var min = Math.min(a, c) - 0.5;
      var max = Math.max(a, c) + 0.5;
      return b >= min && b <= max;
    }

    var result = [points[0]];
    for (var i = 1; i < points.length - 1; i++) {
      var prev = result[result.length - 1];
      var curr = points[i];
      var next = points[i + 1];
      if ((Math.abs(prev.x - curr.x) < 0.5 && Math.abs(curr.x - next.x) < 0.5 && isBetween(prev.y, curr.y, next.y)) ||
          (Math.abs(prev.y - curr.y) < 0.5 && Math.abs(curr.y - next.y) < 0.5 && isBetween(prev.x, curr.x, next.x))) {
        continue;
      }
      result.push(curr);
    }
    result.push(points[points.length - 1]);
    return result;
  }

  function measureOrthogonalRoute(points) {
    var total = 0;
    if (!points) return total;
    for (var i = 0; i < points.length - 1; i++) {
      total += Math.abs(points[i + 1].x - points[i].x) + Math.abs(points[i + 1].y - points[i].y);
    }
    return total;
  }

  function countOrthogonalBends(points) {
    if (!points || points.length < 3) return 0;
    var bends = 0;
    for (var i = 1; i < points.length - 1; i++) {
      var prev = points[i - 1];
      var curr = points[i];
      var next = points[i + 1];
      var dir1 = Math.abs(curr.x - prev.x) > Math.abs(curr.y - prev.y) ? 'H' : 'V';
      var dir2 = Math.abs(next.x - curr.x) > Math.abs(next.y - curr.y) ? 'H' : 'V';
      if (dir1 !== dir2) bends++;
    }
    return bends;
  }

  function countRouteCrossings(points, occupied) {
    if (!points || !occupied) return 0;
    var crossings = 0;
    for (var i = 0; i < points.length - 1; i++) {
        var p0 = points[i], p1 = points[i + 1];
        if (Math.abs(p0.y - p1.y) < 1) { // horizontal segment
            var xMin = Math.min(p0.x, p1.x), xMax = Math.max(p0.x, p1.x);
            for (var j = 0; j < occupied.v.length; j++) {
                var vseg = occupied.v[j];
                if (vseg.x > xMin + 2 && vseg.x < xMax - 2 && p0.y > vseg.y1 + 2 && p0.y < vseg.y2 - 2) crossings++;
            }
        } else if (Math.abs(p0.x - p1.x) < 1) { // vertical segment
            var yMin = Math.min(p0.y, p1.y), yMax = Math.max(p0.y, p1.y);
            for (var k = 0; k < occupied.h.length; k++) {
                var hseg = occupied.h[k];
                if (hseg.y > yMin + 2 && hseg.y < yMax - 2 && p0.x > hseg.x1 + 2 && p0.x < hseg.x2 - 2) crossings++;
            }
        }
    }
    return crossings;
  }

  function routeHitsObstacle(points, obstacles, skipNames, occupied) {
    if (!points) return true;
    for (var i = 0; i < points.length - 1; i++) {
      var p0 = points[i], p1 = points[i + 1];
      if (Math.abs(p0.x - p1.x) < 1) {
        var yMin = Math.min(p0.y, p1.y), yMax = Math.max(p0.y, p1.y);
        for (var j = 0; j < obstacles.length; j++) {
          var obRect = obstacleToRect(obstacles[j]);
          if (!obRect) continue;
          if (skipNames && obstacles[j].name && skipNames[obstacles[j].name]) continue;
          if (p0.x > obRect.left && p0.x < obRect.right && yMax > obRect.top && yMin < obRect.bottom) return true;
        }
        if (vSegHitsOccupied(p0.x, yMin, yMax, occupied)) return true;
      } else if (Math.abs(p0.y - p1.y) < 1) {
        var xMin = Math.min(p0.x, p1.x), xMax = Math.max(p0.x, p1.x);
        for (var j2 = 0; j2 < obstacles.length; j2++) {
          var obRect2 = obstacleToRect(obstacles[j2]);
          if (!obRect2) continue;
          if (skipNames && obstacles[j2].name && skipNames[obstacles[j2].name]) continue;
          if (p0.y > obRect2.top && p0.y < obRect2.bottom && xMax > obRect2.left && xMin < obRect2.right) return true;
        }
        if (hSegHitsOccupied(p0.y, xMin, xMax, occupied)) return true;
      } else {
        return true;
      }
    }
    return false;
  }

  function findClearX(yMin, yMax, preferX, obstacles, skipNames, occupied) {
    function isBlocked(candidateX) {
      for (var j = 0; j < obstacles.length; j++) {
        var obRect = obstacleToRect(obstacles[j]);
        if (!obRect) continue;
        if (skipNames && obstacles[j].name && skipNames[obstacles[j].name]) continue;
        if (candidateX > obRect.left && candidateX < obRect.right && yMax > obRect.top && yMin < obRect.bottom) return true;
      }
      return vSegHitsOccupied(candidateX, yMin, yMax, occupied);
    }

    if (!isBlocked(preferX)) return preferX;
    for (var d = ORTHO_ROUTE_LANE_STEP; d < 1600; d += ORTHO_ROUTE_LANE_STEP) {
      if (!isBlocked(preferX + d)) return preferX + d;
      if (!isBlocked(preferX - d)) return preferX - d;
    }
    return preferX;
  }

  function findClearY(xMin, xMax, preferY, obstacles, skipNames, occupied) {
    function isBlocked(candidateY) {
      for (var j = 0; j < obstacles.length; j++) {
        var obRect = obstacleToRect(obstacles[j]);
        if (!obRect) continue;
        if (skipNames && obstacles[j].name && skipNames[obstacles[j].name]) continue;
        if (candidateY > obRect.top && candidateY < obRect.bottom && xMax > obRect.left && xMin < obRect.right) return true;
      }
      return hSegHitsOccupied(candidateY, xMin, xMax, occupied);
    }

    if (!isBlocked(preferY)) return preferY;
    for (var d = ORTHO_ROUTE_LANE_STEP; d < 1600; d += ORTHO_ROUTE_LANE_STEP) {
      if (!isBlocked(preferY + d)) return preferY + d;
      if (!isBlocked(preferY - d)) return preferY - d;
    }
    return preferY;
  }

  function reserveOrthogonalRoute(points, occupied) {
    if (!occupied || !points) return;
    for (var i = 0; i < points.length - 1; i++) {
      var p0 = points[i], p1 = points[i + 1];
      if (Math.abs(p0.x - p1.x) < 1) {
        var y1 = Math.min(p0.y, p1.y), y2 = Math.max(p0.y, p1.y);
        if ((y2 - y1) >= ORTHO_ROUTE_TRACK_MIN_LEN) occupied.v.push({ x: p0.x, y1: y1, y2: y2 });
      } else if (Math.abs(p0.y - p1.y) < 1) {
        var x1 = Math.min(p0.x, p1.x), x2 = Math.max(p0.x, p1.x);
        if ((x2 - x1) >= ORTHO_ROUTE_TRACK_MIN_LEN) occupied.h.push({ y: p0.y, x1: x1, x2: x2 });
      }
    }
  }

  function spreadRouteToFreeLanes(points, obstacles, skipNames, occupied) {
    if (!occupied || !points || points.length < 4) return points;

    var adjusted = [];
    for (var i = 0; i < points.length; i++) adjusted.push({ x: points[i].x, y: points[i].y });

    for (var pass = 0; pass < 2; pass++) {
      var moved = false;
      for (var si = 1; si < adjusted.length - 2; si++) {
        var p0 = adjusted[si], p1 = adjusted[si + 1];
        if (Math.abs(p0.y - p1.y) < 1) {
          var xMin = Math.min(p0.x, p1.x), xMax = Math.max(p0.x, p1.x);
          if (hSegHitsOccupied(p0.y, xMin, xMax, occupied)) {
            var clearY = findClearY(xMin, xMax, p0.y, obstacles, skipNames, occupied);
            if (Math.abs(clearY - p0.y) >= 1) {
              adjusted[si].y = clearY;
              adjusted[si + 1].y = clearY;
              moved = true;
            }
          }
        } else if (Math.abs(p0.x - p1.x) < 1) {
          var yMin = Math.min(p0.y, p1.y), yMax = Math.max(p0.y, p1.y);
          if (vSegHitsOccupied(p0.x, yMin, yMax, occupied)) {
            var clearX = findClearX(yMin, yMax, p0.x, obstacles, skipNames, occupied);
            if (Math.abs(clearX - p0.x) >= 1) {
              adjusted[si].x = clearX;
              adjusted[si + 1].x = clearX;
              moved = true;
            }
          }
        }
      }
      adjusted = simplifyOrthogonalPath(adjusted);
      if (!moved) break;
    }

    return adjusted;
  }

  function uniqueSortedNumbers(values) {
    var sorted = values.slice().sort(function(a, b) { return a - b; });
    var out = [];
    for (var i = 0; i < sorted.length; i++) {
      var value = sorted[i];
      if (!isFinite(value)) continue;
      if (!out.length || Math.abs(value - out[out.length - 1]) > 0.5) out.push(value);
    }
    return out;
  }

  function findCoordinateIndex(coords, value) {
    for (var i = 0; i < coords.length; i++) {
      if (Math.abs(coords[i] - value) < 0.75) return i;
    }
    return -1;
  }

  function pointInsideObstacle(x, y, obstacles, skipNames) {
    for (var i = 0; i < obstacles.length; i++) {
      var obstacle = obstacles[i];
      if (skipNames && obstacle.name && skipNames[obstacle.name]) continue;
      var rect = obstacleToRect(obstacle);
      if (!rect) continue;
      if (x > rect.left && x < rect.right && y > rect.top && y < rect.bottom) return true;
    }
    return false;
  }

  function createPriorityQueue() {
    var heap = [];

    function swap(i, j) {
      var temp = heap[i];
      heap[i] = heap[j];
      heap[j] = temp;
    }

    function bubbleUp(index) {
      while (index > 0) {
        var parent = Math.floor((index - 1) / 2);
        if (heap[parent].f <= heap[index].f) break;
        swap(parent, index);
        index = parent;
      }
    }

    function bubbleDown(index) {
      while (true) {
        var left = index * 2 + 1;
        var right = left + 1;
        var smallest = index;
        if (left < heap.length && heap[left].f < heap[smallest].f) smallest = left;
        if (right < heap.length && heap[right].f < heap[smallest].f) smallest = right;
        if (smallest === index) break;
        swap(index, smallest);
        index = smallest;
      }
    }

    return {
      push: function(item) {
        heap.push(item);
        bubbleUp(heap.length - 1);
      },
      pop: function() {
        if (!heap.length) return null;
        var first = heap[0];
        var last = heap.pop();
        if (heap.length) {
          heap[0] = last;
          bubbleDown(0);
        }
        return first;
      },
      isEmpty: function() {
        return heap.length === 0;
      }
    };
  }

  function buildOrthogonalGraph(xs, ys, obstacles, skipNames, occupied) {
    var nodes = [];
    var nodeMap = {};
    var rows = {};
    var cols = {};

    for (var xi = 0; xi < xs.length; xi++) {
      for (var yi = 0; yi < ys.length; yi++) {
        var x = xs[xi], y = ys[yi];
        if (pointInsideObstacle(x, y, obstacles, skipNames)) continue;
        var key = xi + ':' + yi;
        var nodeIndex = nodes.length;
        nodes.push({ x: x, y: y, xi: xi, yi: yi });
        nodeMap[key] = nodeIndex;
        if (!rows[yi]) rows[yi] = [];
        if (!cols[xi]) cols[xi] = [];
        rows[yi].push(nodeIndex);
        cols[xi].push(nodeIndex);
      }
    }

    var adjacency = [];
    for (var ni = 0; ni < nodes.length; ni++) adjacency.push([]);

    function connect(aIdx, bIdx, dir) {
      var a = nodes[aIdx], b = nodes[bIdx];
      var p0 = { x: a.x, y: a.y };
      var p1 = { x: b.x, y: b.y };
      if (routeHitsObstacle([p0, p1], obstacles, skipNames, occupied)) return;
      var cost = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      adjacency[aIdx].push({ to: bIdx, dir: dir, cost: cost });
      adjacency[bIdx].push({ to: aIdx, dir: dir, cost: cost });
    }

    for (var rowKey in rows) {
      var row = rows[rowKey];
      row.sort(function(a, b) { return nodes[a].x - nodes[b].x; });
      for (var ri = 0; ri < row.length - 1; ri++) connect(row[ri], row[ri + 1], 'H');
    }
    for (var colKey in cols) {
      var col = cols[colKey];
      col.sort(function(a, b) { return nodes[a].y - nodes[b].y; });
      for (var ci = 0; ci < col.length - 1; ci++) connect(col[ci], col[ci + 1], 'V');
    }

    return { nodes: nodes, nodeMap: nodeMap, adjacency: adjacency };
  }

  function findOrthogonalGridPath(start, end, obstacles, skipNames, occupied, options) {
    var opts = options || {};
    var clearance = opts.clearance != null ? opts.clearance : 14;
    var bendPenalty = opts.bendPenalty != null ? opts.bendPenalty : ORTHO_ROUTE_BEND_PENALTY;
    var extraXs = opts.extraXs || [];
    var extraYs = opts.extraYs || [];
    var xs = [start.x, end.x];
    var ys = [start.y, end.y];

    for (var exi = 0; exi < extraXs.length; exi++) xs.push(extraXs[exi]);
    for (var eyi = 0; eyi < extraYs.length; eyi++) ys.push(extraYs[eyi]);

    for (var oi = 0; oi < obstacles.length; oi++) {
      var obstacle = obstacles[oi];
      if (skipNames && obstacle.name && skipNames[obstacle.name]) continue;
      var rect = obstacleToRect(obstacle);
      if (!rect) continue;
      xs.push(rect.left - clearance, rect.right + clearance);
      ys.push(rect.top - clearance, rect.bottom + clearance);
    }

    xs = uniqueSortedNumbers(xs);
    ys = uniqueSortedNumbers(ys);

    var graph = buildOrthogonalGraph(xs, ys, obstacles, skipNames, occupied);
    var startXi = findCoordinateIndex(xs, start.x);
    var startYi = findCoordinateIndex(ys, start.y);
    var endXi = findCoordinateIndex(xs, end.x);
    var endYi = findCoordinateIndex(ys, end.y);
    var startKey = startXi + ':' + startYi;
    var endKey = endXi + ':' + endYi;
    var startIndex = graph.nodeMap[startKey];
    var endIndex = graph.nodeMap[endKey];
    if (startIndex === undefined || endIndex === undefined) return null;

    var queue = createPriorityQueue();
    var startState = startIndex + ':N';
    var dist = {};
    var prev = {};
    dist[startState] = 0;
    queue.push({ state: startState, nodeIndex: startIndex, dir: 'N', f: Math.abs(start.x - end.x) + Math.abs(start.y - end.y) });

    while (!queue.isEmpty()) {
      var current = queue.pop();
      if (!current) break;
      if (current.nodeIndex === endIndex) {
        var stateCursor = current.state;
        var path = [];
        while (stateCursor) {
          var stateParts = stateCursor.split(':');
          var nodeIdx = parseInt(stateParts[0], 10);
          path.push({ x: graph.nodes[nodeIdx].x, y: graph.nodes[nodeIdx].y });
          stateCursor = prev[stateCursor];
        }
        path.reverse();
        return simplifyOrthogonalPath(path);
      }

      if (current.f - (Math.abs(graph.nodes[current.nodeIndex].x - end.x) + Math.abs(graph.nodes[current.nodeIndex].y - end.y)) > (dist[current.state] || 0) + 0.001) {
        continue;
      }

      var neighbors = graph.adjacency[current.nodeIndex];
      for (var ni = 0; ni < neighbors.length; ni++) {
        var edge = neighbors[ni];
        var nextState = edge.to + ':' + edge.dir;
        var bendCost = current.dir !== 'N' && current.dir !== edge.dir ? bendPenalty : 0;
        var corridorPenalty = edge.dir === 'H'
          ? Math.abs(graph.nodes[current.nodeIndex].y - end.y) * 0.05
          : Math.abs(graph.nodes[current.nodeIndex].x - end.x) * 0.05;
        var candidateDist = dist[current.state] + edge.cost + bendCost + corridorPenalty;
        if (dist[nextState] === undefined || candidateDist + 0.01 < dist[nextState]) {
          dist[nextState] = candidateDist;
          prev[nextState] = current.state;
          var heuristic = Math.abs(graph.nodes[edge.to].x - end.x) + Math.abs(graph.nodes[edge.to].y - end.y);
          queue.push({
            state: nextState,
            nodeIndex: edge.to,
            dir: edge.dir,
            f: candidateDist + heuristic
          });
        }
      }
    }

    return null;
  }

  function extendAnchor(anchor, fallbackStub) {
    var stub = anchor && anchor.stub != null ? anchor.stub : (fallbackStub != null ? fallbackStub : 18);
    var point = { x: anchor.x, y: anchor.y };
    var outer = { x: point.x, y: point.y };
    if (anchor.side === 'left') outer.x -= stub;
    else if (anchor.side === 'right') outer.x += stub;
    else if (anchor.side === 'top') outer.y -= stub;
    else if (anchor.side === 'bottom') outer.y += stub;
    return { point: point, outer: outer };
  }

  function buildSimpleOrthogonalFallback(start, end) {
    var horizontalFirst = simplifyOrthogonalPath([
      { x: start.x, y: start.y },
      { x: end.x, y: start.y },
      { x: end.x, y: end.y }
    ]);
    var verticalFirst = simplifyOrthogonalPath([
      { x: start.x, y: start.y },
      { x: start.x, y: end.y },
      { x: end.x, y: end.y }
    ]);
    return measureOrthogonalRoute(horizontalFirst) <= measureOrthogonalRoute(verticalFirst)
      ? horizontalFirst
      : verticalFirst;
  }

  function routeOrthogonalConnector(startAnchor, endAnchor, obstacles, options) {
    var opts = options || {};
    var skipNames = opts.skipNames || null;
    var occupied = opts.occupied || null;
    var start = extendAnchor(startAnchor, opts.stub);
    var end = extendAnchor(endAnchor, opts.stub);
    var tried = [];
    var path = null;
    var attempts = [
      { occupied: occupied, clearance: opts.clearance != null ? opts.clearance : 14 },
      { occupied: occupied, clearance: 8 },
      { occupied: null, clearance: opts.clearance != null ? opts.clearance : 14 },
      { occupied: null, clearance: 6 }
    ];

    for (var ai = 0; ai < attempts.length; ai++) {
      var attempt = attempts[ai];
      var key = String(!!attempt.occupied) + ':' + attempt.clearance;
      if (tried.indexOf(key) >= 0) continue;
      tried.push(key);
      path = findOrthogonalGridPath(start.outer, end.outer, obstacles, skipNames, attempt.occupied, {
        clearance: attempt.clearance,
        bendPenalty: opts.bendPenalty,
        extraXs: opts.extraXs,
        extraYs: opts.extraYs
      });
      if (path) {
        occupied = attempt.occupied;
        break;
      }
    }

    if (!path) path = buildSimpleOrthogonalFallback(start.outer, end.outer);

    var points = [start.point];
    for (var pi = 0; pi < path.length; pi++) {
      if (!points.length || Math.abs(points[points.length - 1].x - path[pi].x) > 0.5 || Math.abs(points[points.length - 1].y - path[pi].y) > 0.5) {
        points.push({ x: path[pi].x, y: path[pi].y });
      }
    }
    if (!points.length || Math.abs(points[points.length - 1].x - end.point.x) > 0.5 || Math.abs(points[points.length - 1].y - end.point.y) > 0.5) {
      points.push(end.point);
    }

    points = simplifyOrthogonalPath(points);
    points = spreadRouteToFreeLanes(points, obstacles, skipNames, occupied);
    points = simplifyOrthogonalPath(points);

    return {
      points: points,
      length: measureOrthogonalRoute(points),
      bends: countOrthogonalBends(points)
    };
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
    parseLayoutDirective: parseLayoutDirective,
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
    buildOrthogonalSegments: buildOrthogonalSegments,
    placeOrthogonalLabel: placeOrthogonalLabel,
    simplifyOrthogonalPath: simplifyOrthogonalPath,
    measureOrthogonalRoute: measureOrthogonalRoute,
    countOrthogonalBends: countOrthogonalBends,
    countRouteCrossings: countRouteCrossings,
    routeHitsObstacle: routeHitsObstacle,
    findClearX: findClearX,
    findClearY: findClearY,
    reserveOrthogonalRoute: reserveOrthogonalRoute,
    spreadRouteToFreeLanes: spreadRouteToFreeLanes,
    routeOrthogonalConnector: routeOrthogonalConnector,

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

    drawCrossMarker: function(svg, x, y, ux, uy, color, size, sw) {
      var cs = size || BASE_CFG.arrowSize;
      var strw = sw || BASE_CFG.strokeWidth;
      var half = cs * 0.44;
      var offset = cs * 0.52;
      var cx = x + ux * offset;
      var cy = y + uy * offset;
      var px = -uy, py = ux;
      var d1x = ux + px, d1y = uy + py;
      var d2x = ux - px, d2y = uy - py;
      var d1len = Math.sqrt(d1x * d1x + d1y * d1y) || 1;
      var d2len = Math.sqrt(d2x * d2x + d2y * d2y) || 1;
      d1x /= d1len; d1y /= d1len;
      d2x /= d2len; d2y /= d2len;
      svg.push('<line x1="' + (cx - d1x * half) + '" y1="' + (cy - d1y * half) + '" x2="' + (cx + d1x * half) + '" y2="' + (cy + d1y * half) +
        '" stroke="' + color + '" stroke-width="' + strw + '"/>');
      svg.push('<line x1="' + (cx - d2x * half) + '" y1="' + (cy - d2y * half) + '" x2="' + (cx + d2x * half) + '" y2="' + (cy + d2y * half) +
        '" stroke="' + color + '" stroke-width="' + strw + '"/>');
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

    resolveNodeTarget: resolveNodeTarget,
    rectsOverlap: rectsOverlap,
    placeNoteRect: placeNoteRect,
    computeAnchoredNotes: computeAnchoredNotes,

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
  function computeLayoutBounds(result) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    var hasNode = false;
    for (var id in result.nodes) {
      if (!result.nodes.hasOwnProperty(id)) continue;
      var node = result.nodes[id];
      hasNode = true;
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.width);
      maxY = Math.max(maxY, node.y + node.height);
    }
    if (!hasNode) return { width: 0, height: 0, area: 0, aspect: 1 };

    var width = Math.max(1, maxX - minX);
    var height = Math.max(1, maxY - minY);
    return {
      width: width,
      height: height,
      area: width * height,
      aspect: width / height
    };
  }

  function buildLayoutCandidates(gapX, gapY, direction, layoutPreference, directionLocked) {
    var candidates = [];
    var seen = {};
    var otherDirection = direction === 'LR' ? 'TB' : 'LR';

    function addCandidate(candidateDirection, candidateGapX, candidateGapY) {
      var gx = Math.max(24, Math.round(candidateGapX));
      var gy = Math.max(24, Math.round(candidateGapY));
      var key = candidateDirection + '|' + gx + '|' + gy;
      if (seen[key]) return;
      seen[key] = true;
      candidates.push({ direction: candidateDirection, gapX: gx, gapY: gy });
    }

    if (!layoutPreference) {
      addCandidate(direction, gapX, gapY);
      return candidates;
    }

    if (directionLocked) {
      if (layoutPreference === 'square') {
        addCandidate(direction, gapX, gapY);
        addCandidate(direction, gapX * 1.08, gapY * 0.92);
        addCandidate(direction, gapX * 0.92, gapY * 1.08);
        return candidates;
      }

      if (layoutPreference === 'landscape') {
        addCandidate(direction, gapX, gapY);
        addCandidate(direction, gapX * 1.15, gapY * 0.9);
        addCandidate(direction, gapX * 1.3, gapY * 0.8);
        return candidates;
      }

      if (layoutPreference === 'portrait') {
        addCandidate(direction, gapX, gapY);
        addCandidate(direction, gapX * 0.9, gapY * 1.15);
        addCandidate(direction, gapX * 0.8, gapY * 1.3);
        return candidates;
      }

      addCandidate(direction, gapX, gapY);
      addCandidate(direction, gapX * 0.95, gapY * 1.05);
      addCandidate(direction, gapX * 1.05, gapY * 0.95);
      return candidates;
    }

    if (layoutPreference === 'square') {
      addCandidate(direction, gapX, gapY);
      addCandidate('TB', gapX * 1.1, gapY * 0.9);
      addCandidate('TB', gapX * 0.9, gapY * 1.1);
      addCandidate('LR', gapX * 1.1, gapY * 0.9);
      addCandidate('LR', gapX * 0.9, gapY * 1.1);
      return candidates;
    }

    if (layoutPreference === 'landscape') {
      addCandidate('LR', gapX, gapY);
      addCandidate('LR', gapX * 1.15, gapY * 0.9);
      addCandidate('LR', gapX * 1.3, gapY * 0.8);
      addCandidate('TB', gapX * 1.25, gapY * 0.85);
      addCandidate(direction, gapX, gapY);
      return candidates;
    }

    if (layoutPreference === 'portrait') {
      addCandidate('TB', gapX, gapY);
      addCandidate('TB', gapX * 0.9, gapY * 1.15);
      addCandidate('TB', gapX * 0.8, gapY * 1.3);
      addCandidate('LR', gapX * 0.85, gapY * 1.25);
      addCandidate(direction, gapX, gapY);
      return candidates;
    }

    addCandidate(direction, gapX, gapY);
    addCandidate(otherDirection, gapX, gapY);
    addCandidate('TB', gapX * 0.95, gapY * 1.05);
    addCandidate('LR', gapX * 1.05, gapY * 0.95);
    return candidates;
  }

  function scoreLayoutCandidate(bounds, layoutPreference, candidate, fallbackDirection) {
    var targetAspect = 1.2;
    var aspectWeight = 55;

    if (layoutPreference === 'square') {
      targetAspect = 1;
      aspectWeight = 120;
    } else if (layoutPreference === 'landscape') {
      targetAspect = 1.6;
      aspectWeight = 120;
    } else if (layoutPreference === 'portrait') {
      targetAspect = 0.625;
      aspectWeight = 120;
    }

    var score = Math.abs(Math.log(Math.max(bounds.aspect, 0.01) / targetAspect)) * aspectWeight;
    score += Math.log(Math.max(bounds.area, 1)) * 2.5;
    score += Math.log(Math.max(bounds.width, bounds.height) + 1) * 3;

    if (layoutPreference === 'landscape' && candidate.direction !== 'LR') score += 35;
    if (layoutPreference === 'portrait' && candidate.direction !== 'TB') score += 35;
    if (layoutPreference === 'auto' && candidate.direction !== fallbackDirection) score += 4;

    return score;
  }

  function targetAspectForPreference(layoutPreference, direction) {
    if (layoutPreference === 'square') return 1;
    if (layoutPreference === 'landscape') return 1.6;
    if (layoutPreference === 'portrait') return 0.625;
    return direction === 'LR' ? 1.6 : 0.8;
  }

  function findWeaklyConnectedComponents(nodes, edges) {
    var nodeMap = {};
    var neighbors = {};
    nodes.forEach(function(n) {
      nodeMap[n.id] = n;
      neighbors[n.id] = [];
    });

    edges.forEach(function(e) {
      if (!nodeMap[e.source] || !nodeMap[e.target] || e.source === e.target) return;
      neighbors[e.source].push(e.target);
      neighbors[e.target].push(e.source);
    });

    var visited = {};
    var components = [];
    nodes.forEach(function(node) {
      if (visited[node.id]) return;

      var stack = [node.id];
      var componentIds = {};
      var componentNodes = [];
      visited[node.id] = true;

      while (stack.length) {
        var current = stack.pop();
        componentIds[current] = true;
        componentNodes.push(nodeMap[current]);

        var currentNeighbors = neighbors[current] || [];
        for (var i = 0; i < currentNeighbors.length; i++) {
          var next = currentNeighbors[i];
          if (visited[next]) continue;
          visited[next] = true;
          stack.push(next);
        }
      }

      var componentEdges = edges.filter(function(edge) {
        return componentIds[edge.source] && componentIds[edge.target];
      });
      components.push({ nodes: componentNodes, edges: componentEdges });
    });

    return components;
  }

  function normalizeLayoutResult(result) {
    var minX = Infinity, minY = Infinity;
    var maxX = -Infinity, maxY = -Infinity;
    var hasNode = false;
    var normalizedNodes = {};

    for (var id in result.nodes) {
      if (!Object.prototype.hasOwnProperty.call(result.nodes, id)) continue;
      var node = result.nodes[id];
      hasNode = true;
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.width);
      maxY = Math.max(maxY, node.y + node.height);
    }

    if (!hasNode) {
      return {
        nodes: {},
        edges: result.edges ? result.edges.slice() : [],
        width: 0,
        height: 0,
        direction: result.direction || 'TB'
      };
    }

    for (var nodeId in result.nodes) {
      if (!Object.prototype.hasOwnProperty.call(result.nodes, nodeId)) continue;
      var original = result.nodes[nodeId];
      normalizedNodes[nodeId] = {
        x: original.x - minX,
        y: original.y - minY,
        width: original.width,
        height: original.height,
        data: original.data
      };
    }

    var normalizedEdges = (result.edges || []).map(function(edge) {
      return {
        source: edge.source,
        target: edge.target,
        data: edge.data,
        points: (edge.points || []).map(function(point) {
          return { x: point.x - minX, y: point.y - minY };
        })
      };
    });

    return {
      nodes: normalizedNodes,
      edges: normalizedEdges,
      width: Math.max(0, maxX - minX),
      height: Math.max(0, maxY - minY),
      direction: result.direction || 'TB'
    };
  }

  function packDisconnectedLayouts(layouts, gapX, gapY, direction, layoutPreference) {
    if (!layouts.length) return { nodes: {}, edges: [], direction: direction };
    if (layouts.length === 1) {
      return {
        nodes: layouts[0].nodes,
        edges: layouts[0].edges,
        direction: layouts[0].direction || direction
      };
    }

    var targetAspect = targetAspectForPreference(layoutPreference, direction);

    function buildPacking(itemsPerRow) {
      var rows = [];
      for (var start = 0; start < layouts.length; start += itemsPerRow) {
        var rowItems = layouts.slice(start, start + itemsPerRow);
        var rowWidth = 0;
        var rowHeight = 0;
        for (var ri = 0; ri < rowItems.length; ri++) {
          if (ri > 0) rowWidth += gapX;
          rowWidth += rowItems[ri].width;
          rowHeight = Math.max(rowHeight, rowItems[ri].height);
        }
        rows.push({ items: rowItems, width: rowWidth, height: rowHeight });
      }

      var totalWidth = 0;
      var totalHeight = 0;
      var raggedness = 0;
      for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        totalWidth = Math.max(totalWidth, rows[rowIndex].width);
        if (rowIndex > 0) totalHeight += gapY;
        totalHeight += rows[rowIndex].height;
      }
      for (var raggedIndex = 0; raggedIndex < rows.length; raggedIndex++) {
        raggedness += totalWidth - rows[raggedIndex].width;
      }

      return {
        rows: rows,
        width: Math.max(1, totalWidth),
        height: Math.max(1, totalHeight),
        aspect: Math.max(1, totalWidth) / Math.max(1, totalHeight),
        area: Math.max(1, totalWidth) * Math.max(1, totalHeight),
        raggedness: raggedness
      };
    }

    function scorePacking(packing) {
      var score = Math.abs(Math.log(Math.max(packing.aspect, 0.01) / targetAspect)) * 135;
      score += Math.log(Math.max(packing.area, 1)) * 2.5;
      score += Math.log(Math.max(packing.width, packing.height) + 1) * 3;
      score += packing.raggedness * 0.025;
      score += (packing.rows.length - 1) * 3;

      if (layoutPreference === 'portrait') score += packing.width * 0.025;
      if (layoutPreference === 'landscape') score += packing.height * 0.025;
      if (layoutPreference === 'square') score += Math.abs(packing.width - packing.height) * 0.035;

      return score;
    }

    var bestPacking = null;
    for (var itemsPerRow = 1; itemsPerRow <= layouts.length; itemsPerRow++) {
      var candidatePacking = buildPacking(itemsPerRow);
      var candidateScore = scorePacking(candidatePacking);
      if (!bestPacking || candidateScore < bestPacking.score - 0.01 ||
          (Math.abs(candidateScore - bestPacking.score) <= 0.01 && candidatePacking.area < bestPacking.area)) {
        bestPacking = {
          rows: candidatePacking.rows,
          width: candidatePacking.width,
          height: candidatePacking.height,
          area: candidatePacking.area,
          score: candidateScore
        };
      }
    }

    var packedNodes = {};
    var packedEdges = [];
    var currentY = 0;

    for (var rowIndex = 0; rowIndex < bestPacking.rows.length; rowIndex++) {
      var row = bestPacking.rows[rowIndex];
      var currentX = Math.round((bestPacking.width - row.width) / 2);
      for (var itemIndex = 0; itemIndex < row.items.length; itemIndex++) {
        var item = row.items[itemIndex];
        var offsetY = currentY + Math.round((row.height - item.height) / 2);

        for (var packedId in item.nodes) {
          if (!Object.prototype.hasOwnProperty.call(item.nodes, packedId)) continue;
          var packedNode = item.nodes[packedId];
          packedNodes[packedId] = {
            x: packedNode.x + currentX,
            y: packedNode.y + offsetY,
            width: packedNode.width,
            height: packedNode.height,
            data: packedNode.data
          };
        }

        for (var edgeIndex = 0; edgeIndex < item.edges.length; edgeIndex++) {
          var packedEdge = item.edges[edgeIndex];
          packedEdges.push({
            source: packedEdge.source,
            target: packedEdge.target,
            data: packedEdge.data,
            points: (packedEdge.points || []).map(function(point) {
              return { x: point.x + currentX, y: point.y + offsetY };
            })
          });
        }

        currentX += item.width + gapX;
      }
      currentY += row.height + gapY;
    }

    return { nodes: packedNodes, edges: packedEdges, direction: direction };
  }

  function computeDirectedLayout(nodes, edges, gapX, gapY, direction, layoutPreference) {
    var components = findWeaklyConnectedComponents(nodes, edges);
    if (components.length > 1) {
      var componentLayouts = components.map(function(component) {
        return normalizeLayoutResult(
          computeDirectedLayout(component.nodes, component.edges, gapX, gapY, direction, layoutPreference)
        );
      });
      return packDisconnectedLayouts(componentLayouts, gapX, gapY, direction, layoutPreference);
    }

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
      if (e.layerParticipates === false || (e.data && e.data.layerParticipates === false)) return;
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

    // 5. Crossing Minimization (Barycenter + Median, best-of-N)
    var pos = {};
    layerGroups.forEach(function(g, l) {
      if (!g) return;
      g.forEach(function(u, i) { pos[u] = i; });
    });

    // Count edge crossings between two adjacent layers
    function countCrossings(l1, l2) {
      if (!l1 || !l2) return 0;
      var c = 0;
      for (var i = 0; i < l1.length; i++) {
        for (var j = i + 1; j < l1.length; j++) {
          var t1 = adj[l1[i]] ? adj[l1[i]].filter(function(v) { return l2.indexOf(v) !== -1; }) : [];
          var t2 = adj[l1[j]] ? adj[l1[j]].filter(function(v) { return l2.indexOf(v) !== -1; }) : [];
          for (var ti = 0; ti < t1.length; ti++)
            for (var tj = 0; tj < t2.length; tj++)
              if (pos[t1[ti]] > pos[t2[tj]]) c++;
        }
      }
      return c;
    }
    function totalCrossings() {
      var t = 0;
      for (var l = 0; l < layerMax; l++)
        if (layerGroups[l] && layerGroups[l+1]) t += countCrossings(layerGroups[l], layerGroups[l+1]);
      return t;
    }

    // Median of neighbor positions
    function medianOf(neighbors) {
      if (neighbors.length === 0) return -1;
      var ps = neighbors.map(function(v) { return pos[v]; }).sort(function(a,b) { return a - b; });
      if (ps.length % 2 === 1) return ps[Math.floor(ps.length / 2)];
      return (ps[Math.floor(ps.length / 2) - 1] + ps[Math.floor(ps.length / 2)]) / 2;
    }

    // Save best ordering found
    var bestPos = {}; for (var bp0 in pos) bestPos[bp0] = pos[bp0];
    var bestCrossings = totalCrossings();
    var bestOrders = [];
    for (var bl0 = 0; bl0 <= layerMax; bl0++)
      bestOrders[bl0] = layerGroups[bl0] ? layerGroups[bl0].slice() : null;

    for (var pass = 0; pass < 16; pass++) {
      var useMedian = pass >= 8; // barycenter first 8, median next 8
      if (pass % 2 === 0) { // Forward sweep
        for (var l = 1; l <= layerMax; l++) {
          if (!layerGroups[l] || !layerGroups[l-1]) continue;
          var g = layerGroups[l];
          var score = {};
          g.forEach(function(u) {
            var preds = [];
            layerGroups[l-1].forEach(function(v) {
              if (adj[v] && adj[v].indexOf(u) !== -1) preds.push(v);
            });
            if (useMedian) {
              var m = medianOf(preds);
              score[u] = m >= 0 ? m : pos[u];
            } else {
              var sum = 0;
              for (var pi = 0; pi < preds.length; pi++) sum += pos[preds[pi]];
              score[u] = preds.length > 0 ? sum / preds.length : pos[u];
            }
          });
          g.sort(function(a,b) { return score[a] - score[b]; });
          g.forEach(function(u, i) { pos[u] = i; });
        }
      } else { // Backward sweep
        for (var l = layerMax - 1; l >= 0; l--) {
          if (!layerGroups[l] || !layerGroups[l+1]) continue;
          var g = layerGroups[l];
          var score = {};
          g.forEach(function(u) {
            var succs = adj[u] ? adj[u].filter(function(v) { return pos[v] !== undefined; }) : [];
            if (useMedian) {
              var m = medianOf(succs);
              score[u] = m >= 0 ? m : pos[u];
            } else {
              var sum = 0;
              for (var si = 0; si < succs.length; si++) sum += pos[succs[si]];
              score[u] = succs.length > 0 ? sum / succs.length : pos[u];
            }
          });
          g.sort(function(a,b) { return score[a] - score[b]; });
          g.forEach(function(u, i) { pos[u] = i; });
        }
      }
      // Keep best
      var cur = totalCrossings();
      if (cur < bestCrossings) {
        bestCrossings = cur;
        for (var bpi in pos) bestPos[bpi] = pos[bpi];
        for (var bli = 0; bli <= layerMax; bli++)
          bestOrders[bli] = layerGroups[bli] ? layerGroups[bli].slice() : null;
      }
    }
    // Restore best ordering
    for (var ri in bestPos) pos[ri] = bestPos[ri];
    for (var rli = 0; rli <= layerMax; rli++)
      if (bestOrders[rli]) layerGroups[rli] = bestOrders[rli];

    // 6. X-Coordinate Assignment (per-node priority alignment)
    //    Phase 1: initial packing (left-to-right, compute sizes)
    //    Phase 2: top-down per-node alignment under parent centers
    //    Phase 3: overlap removal (forward pass)
    var coords = {}; // id -> {x, y, w, h}
    var currentY = 0;

    // Phase 1: initial left-to-right packing + Y assignment
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
      var cMaxY = currentY + layerH;
      layerGroups[l].forEach(function(u) {
         coords[u].y = currentY;
      });
      currentY = cMaxY + gapY;
    }

    // Phase 2: per-node ideal X based on parent centers (top-down)
    for (var l = 1; l <= layerMax; l++) {
      if (!layerGroups[l] || !layerGroups[l-1]) continue;
      layerGroups[l].forEach(function(u) {
        var parentCxs = [];
        layerGroups[l-1].forEach(function(v) {
          if (adj[v] && adj[v].indexOf(u) !== -1) {
            parentCxs.push(coords[v].x + coords[v].w / 2);
          }
        });
        if (parentCxs.length > 0) {
          var avgCx = parentCxs.reduce(function(s, v) { return s + v; }, 0) / parentCxs.length;
          coords[u].x = avgCx - coords[u].w / 2;
        }
      });
    }

    // Phase 3: overlap removal (forward pass, enforces min gap)
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

    // 6b. Symmetry Enhancement (gentle, order-preserving nudge)
    //     Nudge nodes toward the center of their connected neighbors
    //     without ever reordering nodes within a layer.
    function nudgeRange(nodeId, layer) {
      // Returns [minX, maxX] this node can move to without reordering
      var g = layerGroups[layer];
      if (!g) return null;
      var idx = g.indexOf(nodeId);
      if (idx === -1) return null;
      var lo = idx > 0 ? coords[g[idx - 1]].x + coords[g[idx - 1]].w + gapX : -Infinity;
      var hi = idx < g.length - 1 ? coords[g[idx + 1]].x - coords[nodeId].w - gapX : Infinity;
      return [lo, hi];
    }
    for (var symPass = 0; symPass < 3; symPass++) {
      // Bottom-up: nudge parent toward center of children
      for (var l = layerMax - 1; l >= 0; l--) {
        if (!layerGroups[l]) continue;
        layerGroups[l].forEach(function(u) {
          if (!adj[u] || adj[u].length === 0) return;
          var childCxs = [];
          adj[u].forEach(function(v) { if (coords[v]) childCxs.push(coords[v].x + coords[v].w / 2); });
          if (childCxs.length === 0) return;
          var target = childCxs.reduce(function(s, v) { return s + v; }, 0) / childCxs.length - coords[u].w / 2;
          var range = nudgeRange(u, l);
          if (!range) return;
          coords[u].x = Math.max(range[0], Math.min(range[1], target));
        });
      }
      // Top-down: nudge child toward center under parents
      for (var l = 1; l <= layerMax; l++) {
        if (!layerGroups[l] || !layerGroups[l-1]) continue;
        layerGroups[l].forEach(function(u) {
          var parentCxs = [];
          layerGroups[l-1].forEach(function(v) {
            if (adj[v] && adj[v].indexOf(u) !== -1) parentCxs.push(coords[v].x + coords[v].w / 2);
          });
          if (parentCxs.length === 0) return;
          var target = parentCxs.reduce(function(s, v) { return s + v; }, 0) / parentCxs.length - coords[u].w / 2;
          var range = nudgeRange(u, l);
          if (!range) return;
          coords[u].x = Math.max(range[0], Math.min(range[1], target));
        });
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
      return { nodes: lrNodes, edges: resultEdges, direction: 'LR' };
    }

    return { nodes: resultNodes, edges: resultEdges, direction: 'TB' };
  }

  LayoutEngine.compute = function(nodes, edges, options) {
    options = options || {};
    var gapX = options.gapX || 60;
    var gapY = options.gapY || 80;
    var direction = options.direction || 'TB';
    var layoutPreference = options.layoutPreference || null;
    var directionLocked = !!options.directionLocked;

    if (!layoutPreference) {
      return computeDirectedLayout(nodes, edges, gapX, gapY, direction, null);
    }

    var candidates = buildLayoutCandidates(gapX, gapY, direction, layoutPreference, directionLocked);
    var best = null;
    for (var ci = 0; ci < candidates.length; ci++) {
      var candidate = candidates[ci];
      var result = computeDirectedLayout(nodes, edges, candidate.gapX, candidate.gapY, candidate.direction, layoutPreference);
      var bounds = computeLayoutBounds(result);
      var score = scoreLayoutCandidate(bounds, layoutPreference, candidate, direction);
      if (!best || score < best.score - 0.01 || (Math.abs(score - best.score) <= 0.01 && bounds.area < best.bounds.area)) {
        best = { result: result, bounds: bounds, score: score };
      }
    }

    return best ? best.result : computeDirectedLayout(nodes, edges, gapX, gapY, direction, layoutPreference);
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
 *   <-->  Bidirectional navigable association (solid, two open arrows)
 *   --x   Non-navigable association (solid, X marker)
 *   x--x  Non-navigable association on both ends (solid, two X markers)
 *   *--   Composition (solid, filled diamond)
 *   *-->  Composition with navigable target
 *   *<--> Composition with bidirectional navigability
 *   *--x  Composition with non-navigable target
 *   o--   Aggregation (solid, hollow diamond)
 *   o-->  Aggregation with navigable target
 *   o<--> Aggregation with bidirectional navigability
 *   o--x  Aggregation with non-navigable target
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
    var layoutPreference = null;
    var directionLocked = false;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line === '@startuml' || line === '@enduml') continue;

      // Layout directive
      var layoutDirective = UMLShared.parseLayoutDirective(line);
      if (layoutDirective && inClass === null) {
        if (layoutDirective.direction) {
          direction = layoutDirective.direction;
          layoutPreference = null;
          directionLocked = true;
        } else {
          layoutPreference = layoutDirective.layoutPreference;
        }
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

    // Auto-upgrade: generalization targeting an interface becomes realization,
    // BUT only when the source is a class (not another interface).
    // Interface-extends-interface is generalization (solid line), per UML spec.
    for (var ri2 = 0; ri2 < relationships.length; ri2++) {
      var rel2 = relationships[ri2];
      if (rel2.type === 'generalization' && classMap[rel2.to] && classMap[rel2.to].type === 'interface') {
        var fromCls = classMap[rel2.from];
        if (!fromCls || fromCls.type !== 'interface') {
          rel2.type = 'realization';
        }
      }
    }

    return {
      classes: classes,
      relationships: relationships,
      notes: notes,
      direction: direction,
      layoutPreference: layoutPreference,
      directionLocked: directionLocked
    };
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
    var memberName = '';
    if (isMethod) {
      memberName = line.split('(')[0].trim();
    } else {
      memberName = line.split(':')[0].trim();
    }

    return {
      text: (visibility ? visibility : '') + line,
      name: memberName,
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

    // Composition / Aggregation (diamond at source by default)
    { token: '*<-->', type: 'composition', navigability: 'bidirectional' },
    { token: '*-->', type: 'composition', navigability: 'navigable' },
    { token: '*--x', type: 'composition', navigability: 'non-navigable' },
    { token: '*--', type: 'composition', navigability: 'unspecified' },
    { token: 'o<-->', type: 'aggregation', navigability: 'bidirectional' },
    { token: 'o-->', type: 'aggregation', navigability: 'navigable' },
    { token: 'o--x', type: 'aggregation', navigability: 'non-navigable' },
    { token: 'o--', type: 'aggregation', navigability: 'unspecified' },

    // Reverse aliases (diamond at target side)
    { token: '<-->*', type: 'composition', navigability: 'bidirectional', reverse: true },
    { token: '<--*', type: 'composition', navigability: 'navigable', reverse: true },
    { token: 'x--*', type: 'composition', navigability: 'non-navigable', reverse: true },
    { token: '--*', type: 'composition', navigability: 'unspecified', reverse: true },
    { token: '<-->o', type: 'aggregation', navigability: 'bidirectional', reverse: true },
    { token: '<--o', type: 'aggregation', navigability: 'navigable', reverse: true },
    { token: 'x--o', type: 'aggregation', navigability: 'non-navigable', reverse: true },
    { token: '--o', type: 'aggregation', navigability: 'unspecified', reverse: true },

    // Tolerant aliases for mixed marker spelling seen in examples
    { token: '*<-->x', type: 'composition', navigability: 'non-navigable' },
    { token: 'ox-->', type: 'aggregation', navigability: 'non-navigable' },

    // Association / Dependency
    { token: '<-->', type: 'association', navigability: 'bidirectional' },
    { token: 'x--x', type: 'association', navigability: 'non-navigable-both' },
    { token: '-->', type: 'navigable' },
    { token: '<--', type: 'navigable', reverse: true },
    { token: '--x', type: 'association', navigability: 'non-navigable' },
    { token: 'x--', type: 'association', navigability: 'non-navigable', reverse: true },
    { token: '..>', type: 'dependency' },
    { token: '--',  type: 'association', navigability: 'unspecified' },
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

      var fromName = leftPart;
      var toName = rightPart;
      if (pat.reverse) {
        var tmpName = fromName;
        fromName = toName;
        toName = tmpName;
        var tmpMult = fromMult;
        fromMult = toMult;
        toMult = tmpMult;
      }

      return {
        from: fromName,
        to: toName,
        type: pat.type,
        navigability: pat.navigability || (pat.type === 'navigable' ? 'navigable' : 'unspecified'),
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

  function buildMemberNoteTargets(entry) {
    if (!entry || !entry.cls || !entry.box) return {};

    var cls = entry.cls;
    var box = entry.box;
    var targets = {};
    var rowInset = 4;
    var attrBaseY = entry.y + box.nameH + CFG.padY;
    var methBaseY = entry.y + box.nameH + box.attrH + CFG.padY;

    for (var ai = 0; ai < cls.attributes.length; ai++) {
      var attr = cls.attributes[ai];
      if (!attr || !attr.name) continue;
      targets[attr.name] = {
        x: entry.x + rowInset,
        y: attrBaseY + ai * CFG.lineHeight,
        w: Math.max(10, box.width - rowInset * 2),
        h: CFG.lineHeight
      };
    }

    for (var mi = 0; mi < cls.methods.length; mi++) {
      var meth = cls.methods[mi];
      if (!meth || !meth.name) continue;
      targets[meth.name] = {
        x: entry.x + rowInset,
        y: methBaseY + mi * CFG.lineHeight,
        w: Math.max(10, box.width - rowInset * 2),
        h: CFG.lineHeight
      };
    }

    return targets;
  }

  function pushOrthogonalSegment(segments, x1, y1, x2, y2) {
    var length = Math.abs(x2 - x1) + Math.abs(y2 - y1);
    if (length < 4) return;
    if (Math.abs(y2 - y1) < 1) {
      segments.push({
        segmentIndex: segments.length,
        isH: true,
        length: length,
        x1: Math.min(x1, x2),
        x2: Math.max(x1, x2),
        y: y1
      });
    } else if (Math.abs(x2 - x1) < 1) {
      segments.push({
        segmentIndex: segments.length,
        isH: false,
        length: length,
        x: x1,
        y1: Math.min(y1, y2),
        y2: Math.max(y1, y2)
      });
    }
  }

  function segmentObstacleRect(segment, pad) {
    var inset = typeof pad === 'number' ? pad : 10;
    if (!segment) return null;
    if (segment.isH) {
      return {
        x: segment.x1 - inset,
        y: segment.y - inset,
        w: Math.max(1, segment.x2 - segment.x1) + inset * 2,
        h: inset * 2
      };
    }
    return {
      x: segment.x - inset,
      y: segment.y1 - inset,
      w: inset * 2,
      h: Math.max(1, segment.y2 - segment.y1) + inset * 2
    };
  }

  function pointObstacleRect(x, y, pad) {
    var inset = typeof pad === 'number' ? pad : 10;
    return {
      x: x - inset,
      y: y - inset,
      w: inset * 2,
      h: inset * 2
    };
  }


  /**
   * Compute layout positions for all class boxes using AdvancedAlgorithmic framework.
   */
  function computeLayout(parsed) {
    var classes = parsed.classes;
    var relationships = parsed.relationships;
    if (classes.length === 0) return { entries: {}, width: 0, height: 0, offsetX: 0, offsetY: 0 };

    var hasHierarchyEdges = relationships.some(function(rel) {
      return rel.type === 'generalization' || rel.type === 'realization';
    });

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
      layoutEdges.push({
        source: rel.from,
        target: rel.to,
        type: rel.type,
        data: rel,
        layerParticipates: !hasHierarchyEdges || rel.type === 'generalization' || rel.type === 'realization'
      });
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

    var layoutPreference = parsed.layoutPreference || null;
    var effectiveDirection = parsed.direction || 'TB';
    if (hasHierarchyEdges) {
      // UML inheritance hierarchies should read top-to-bottom regardless of
      // footprint preference, so keep the hierarchy vertical and use spacing
      // changes rather than rotating the graph sideways.
      effectiveDirection = 'TB';
    }

    var effectiveGapY = CFG.gapY;
    if (hasHierarchyEdges && layoutPreference === 'landscape') {
      effectiveGapX = Math.max(effectiveGapX, Math.round(effectiveGapX * 1.35));
      effectiveGapY = Math.max(36, Math.round(CFG.gapY * 0.82));
    } else if (hasHierarchyEdges && layoutPreference === 'portrait') {
      effectiveGapX = Math.max(36, Math.round(effectiveGapX * 0.82));
      effectiveGapY = Math.max(CFG.gapY, Math.round(CFG.gapY * 1.3));
    } else if (hasHierarchyEdges && layoutPreference === 'square') {
      effectiveGapX = Math.max(effectiveGapX, Math.round(effectiveGapX * 1.08));
      effectiveGapY = Math.max(40, Math.round(CFG.gapY * 0.92));
    }

    var result = window.UMLAdvancedLayout.compute(layoutNodes, layoutEdges, {
      gapX: effectiveGapX,
      gapY: effectiveGapY,
      direction: effectiveDirection,
      layoutPreference: hasHierarchyEdges ? null : layoutPreference,
      directionLocked: !hasHierarchyEdges && !!parsed.directionLocked
    });

    // Read back positions
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var n in result.nodes) {
      if (!entries[n]) continue;
      entries[n].x = result.nodes[n].x;
      entries[n].y = result.nodes[n].y;
      if (entries[n].cls) entries[n].noteTargets = buildMemberNoteTargets(entries[n]);
      
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

    var svg = [];
    var labelSvg = [];
    var placedLabels = [];
    var placedRouteSegments = [];
    var classOccupiedSegments = { h: [], v: [] };
    var noteRouteSegments = [];
    var noteMarkerObstacles = [];
    var classObstacles = [];
    for (var obstacleName in entries) {
      if (!Object.prototype.hasOwnProperty.call(entries, obstacleName)) continue;
      var obstacleEntry = entries[obstacleName];
      classObstacles.push({
        x1: obstacleEntry.x,
        y1: obstacleEntry.y,
        x2: obstacleEntry.x + obstacleEntry.box.width,
        y2: obstacleEntry.y + obstacleEntry.box.height
      });
    }

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

    function reserveClassHierarchySegment(x1, y1, x2, y2) {
      UMLShared.reserveOrthogonalRoute([
        { x: x1, y: y1 },
        { x: x2, y: y2 }
      ], classOccupiedSegments);
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
      noteMarkerObstacles.push({
        x: parentCx - CFG.triangleW / 2 - 6,
        y: triTop - 4,
        w: CFG.triangleW + 12,
        h: CFG.triangleH + 10
      });
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
          pushOrthogonalSegment(noteRouteSegments, parentCx, triBot, childCx, childTop);
          reserveClassHierarchySegment(parentCx, triBot, childCx, childTop);
        } else {
          // Not aligned: vertical from triangle, horizontal jog, vertical to child
          var junctionY = (triBot + childTop) / 2;
          svg.push('<line x1="' + parentCx + '" y1="' + triBot + '" x2="' + parentCx + '" y2="' + junctionY +
            '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"' + dashAttr + '/>');
          svg.push('<line x1="' + parentCx + '" y1="' + junctionY + '" x2="' + childCx + '" y2="' + junctionY +
            '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"' + dashAttr + '/>');
          svg.push('<line x1="' + childCx + '" y1="' + junctionY + '" x2="' + childCx + '" y2="' + childTop +
            '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"' + dashAttr + '/>');
          pushOrthogonalSegment(noteRouteSegments, parentCx, triBot, parentCx, junctionY);
          pushOrthogonalSegment(noteRouteSegments, parentCx, junctionY, childCx, junctionY);
          pushOrthogonalSegment(noteRouteSegments, childCx, junctionY, childCx, childTop);
          reserveClassHierarchySegment(parentCx, triBot, parentCx, junctionY);
          reserveClassHierarchySegment(parentCx, junctionY, childCx, junctionY);
          reserveClassHierarchySegment(childCx, junctionY, childCx, childTop);
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
        pushOrthogonalSegment(noteRouteSegments, parentCx, triBot, parentCx, junctionY);
        reserveClassHierarchySegment(parentCx, triBot, parentCx, junctionY);

        // Horizontal bar at junction
        var leftCx = Math.min.apply(null, childCxArr.concat([parentCx]));
        var rightCx = Math.max.apply(null, childCxArr.concat([parentCx]));
        svg.push('<line x1="' + leftCx + '" y1="' + junctionY + '" x2="' + rightCx + '" y2="' + junctionY +
          '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"' + dashAttr + '/>');
        pushOrthogonalSegment(noteRouteSegments, leftCx, junctionY, rightCx, junctionY);
        reserveClassHierarchySegment(leftCx, junctionY, rightCx, junctionY);

        // Vertical stems from junction to each child
        for (var ci2 = 0; ci2 < group.children.length; ci2++) {
          var ch2 = entries[group.children[ci2]];
          var cx = childCxArr[ci2];
          svg.push('<line x1="' + cx + '" y1="' + junctionY + '" x2="' + cx + '" y2="' + ch2.y +
            '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"' + dashAttr + '/>');
          pushOrthogonalSegment(noteRouteSegments, cx, junctionY, cx, ch2.y);
          reserveClassHierarchySegment(cx, junctionY, cx, ch2.y);
        }
      }
    }

    var hierarchyRouteObstacles = [];
    for (var hri = 0; hri < noteRouteSegments.length; hri++) {
      var hierarchyObstacle = segmentObstacleRect(noteRouteSegments[hri], 10);
      if (hierarchyObstacle) hierarchyRouteObstacles.push(hierarchyObstacle);
    }

    // Pre-compute port offsets: when multiple edges exit from the same side of a box,
    // assign port indices sorted by target X to minimize crossings
    var exitPortCounts = {}; // "className:side" -> count
    var exitPortIdx = {};    // edgeIndex -> portIndex
    var exitGroups = {};     // "className:side" -> [{idx, targetCx}]
    var entryPortCounts = {}; // "className:side" -> count
    var entryPortIdx = {};    // edgeIndex -> portIndex
    var entryGroups = {};     // "className:side" -> [{idx, sourceCx}]
    for (var epi = 0; epi < otherRels.length; epi++) {
      var epRel = otherRels[epi];
      if (!entries[epRel.from] || !entries[epRel.to]) continue;
      var epFrom = entries[epRel.from];
      var epTo = entries[epRel.to];
      var epFromCx = epFrom.x + epFrom.box.width / 2;
      var epFromCy = epFrom.y + epFrom.box.height / 2;
      var epToCx = epTo.x + epTo.box.width / 2;
      var epToCy = epTo.y + epTo.box.height / 2;
      var epSide = routeSourceSideForRelation(epFrom, epTo, epRel.type, hasInheritAtBottom[epRel.from]);
      var epKey = epRel.from + ':' + epSide;
      if (!exitGroups[epKey]) exitGroups[epKey] = [];
      exitGroups[epKey].push({ idx: epi, targetCx: epToCx, targetCy: epToCy, sourceCx: epFromCx, sourceCy: epFromCy });

      var entrySide = (hasInheritAtTop[epRel.to]) ? 'top' :
        (Math.abs(epToCx - epFromCx) >
         Math.abs(epToCy - epFromCy) * 1.0) ?
        ((epFromCx > epToCx) ? 'right' : 'left') :
        ((epFromCy > epToCy) ? 'bottom' : 'top');
      var entryKey = epRel.to + ':' + entrySide;
      if (!entryGroups[entryKey]) entryGroups[entryKey] = [];
      entryGroups[entryKey].push({ idx: epi, sourceCx: epFromCx, sourceCy: epFromCy, targetCx: epToCx, targetCy: epToCy });
    }
    // Sort each group by the axis-appropriate target coordinate and assign port indices.
    // For top/bottom exits: sort by target X (left-to-right port order).
    // For left/right exits: sort by target Y (top-to-bottom port order).
    for (var gk in exitGroups) {
      var grp = exitGroups[gk];
      var isVerticalExit = gk.indexOf(':left') !== -1 || gk.indexOf(':right') !== -1;
      grp.sort(function(a, b) { return isVerticalExit ? (a.targetCy - b.targetCy) : (a.targetCx - b.targetCx); });
      exitPortCounts[gk] = grp.length;
      for (var gi = 0; gi < grp.length; gi++) {
        exitPortIdx[grp[gi].idx] = gi;
      }
    }
    // Sort each target-entry group and assign entry port indices
    for (var egk in entryGroups) {
      var egrp = entryGroups[egk];
      if (egk.indexOf(':left') !== -1 || egk.indexOf(':right') !== -1) {
        egrp.sort(function(a, b) { return a.sourceCy - b.sourceCy; });
      } else {
        egrp.sort(function(a, b) { return a.sourceCx - b.sourceCx; });
      }
      entryPortCounts[egk] = egrp.length;
      for (var egi = 0; egi < egrp.length; egi++) {
        entryPortIdx[egrp[egi].idx] = egi;
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
      var sourceSide = routeSourceSideForRelation(fromE, toE, orel.type, hasInheritAtBottom[orel.from]);
      var srcKey = orel.from + ':' + sourceSide;
      var srcCount = exitPortCounts[srcKey] || 1;
      var srcPortSpacing = srcCount > 1 ? 22 : 16;
      var srcCentered = ((exitPortIdx[oi] || 0) - (srcCount - 1) / 2) * srcPortSpacing;

      var tgtSide = routeEntrySide(fromE, toE, hasInheritAtTop[orel.to]);
      var tgtKey = orel.to + ':' + tgtSide;
      var tgtCount = entryPortCounts[tgtKey] || 1;
      var tgtPortSpacing = tgtCount > 1 ? 24 : 14;
      var tgtCentered = ((entryPortIdx[oi] || 0) - (tgtCount - 1) / 2) * tgtPortSpacing;
      // Don't hard-restrict composition/aggregation to a single side — let the
      // router explore all sides so it can avoid crossings and obstacles.
      var restrictSourceSide = false;

      var route = computeOrthogonalRoute(
        fromE,
        toE,
        hasInheritAtBottom[orel.from],
        hasInheritAtTop[orel.to],
        srcCentered,
        entries,
        orel.from,
        orel.to,
        tgtCentered,
        tgtSide,
        sourceSide,
        hasInheritAtTop[orel.from],
        hasInheritAtBottom[orel.to],
        classOccupiedSegments,
        hierarchyRouteObstacles,
        restrictSourceSide
      );
      var pathPoints = route.points; // array of {x,y}
      // Apply reanchor only when route actually exits from top/bottom
      if ((orel.type === 'composition' || orel.type === 'aggregation') && pathPoints.length >= 2) {
        var actualExitSide = classEdgeForPoint(pathPoints[0], fromE, sourceSide);
        if (actualExitSide === 'top' || actualExitSide === 'bottom') {
          pathPoints = reanchorWholePartRouteStart(pathPoints, fromE, actualExitSide);
        }
      }
      // Eliminate tiny H-V-H doglegs: when the middle vertical segment is ≤ 6px,
      // snap the shorter end to the longer end's Y for a cleaner straight-through look.
      if (pathPoints.length === 4) {
        var cdg0 = pathPoints[0], cdg1 = pathPoints[1], cdg2 = pathPoints[2], cdg3 = pathPoints[3];
        var cdgH1 = Math.abs(cdg1.y - cdg0.y) < 1;
        var cdgV  = Math.abs(cdg2.x - cdg1.x) < 1;
        var cdgH2 = Math.abs(cdg3.y - cdg2.y) < 1;
        var cdgVLen = Math.abs(cdg2.y - cdg1.y);
        if (cdgH1 && cdgV && cdgH2 && cdgVLen > 0.3 && cdgVLen <= 6) {
          // Snap to the Y of the longer horizontal segment
          var cdgFirstLen = Math.abs(cdg1.x - cdg0.x);
          var cdgThirdLen = Math.abs(cdg3.x - cdg2.x);
          var cdgSnapY = cdgFirstLen >= cdgThirdLen ? cdg0.y : cdg3.y;
          pathPoints = [{ x: cdg0.x, y: cdgSnapY }, { x: cdg3.x, y: cdgSnapY }];
        }
        // V-H-V pattern
        var cdgV1 = Math.abs(cdg1.x - cdg0.x) < 1;
        var cdgH  = Math.abs(cdg2.y - cdg1.y) < 1;
        var cdgV2 = Math.abs(cdg3.x - cdg2.x) < 1;
        var cdgHLen = Math.abs(cdg2.x - cdg1.x);
        if (cdgV1 && cdgH && cdgV2 && cdgHLen > 0.3 && cdgHLen <= 6) {
          var cdgFirstVLen = Math.abs(cdg1.y - cdg0.y);
          var cdgThirdVLen = Math.abs(cdg3.y - cdg2.y);
          var cdgSnapX = cdgFirstVLen >= cdgThirdVLen ? cdg0.x : cdg3.x;
          pathPoints = [{ x: cdgSnapX, y: cdg0.y }, { x: cdgSnapX, y: cdg3.y }];
        }
      }

      var routeSegments = UMLShared.buildOrthogonalSegments(pathPoints);

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
      var actualSourceSide = classEdgeForPoint(p0, fromE, sourceSide);
      var actualTargetSide = classEdgeForPoint(pLast, toE, tgtSide);
      var sourceVector = classSideVector(actualSourceSide);
      var targetVector = classSideVector(actualTargetSide);

      // Direction FROM start (away from source box)
      var startDx = sourceVector.x;
      var startDy = sourceVector.y;
      if (startDx === 0 && startDy === 0) {
        startDx = p1.x - p0.x;
        startDy = p1.y - p0.y;
        var startLen = Math.sqrt(startDx * startDx + startDy * startDy);
        if (startLen > 0) { startDx /= startLen; startDy /= startLen; }
      }

      // Direction FROM end (away from target box)
      var endDx = targetVector.x;
      var endDy = targetVector.y;
      if (endDx === 0 && endDy === 0) {
        endDx = pPrev.x - pLast.x;
        endDy = pPrev.y - pLast.y;
        var endLen = Math.sqrt(endDx * endDx + endDy * endDy);
        if (endLen > 0) { endDx /= endLen; endDy /= endLen; }
      }

      // Source decorations (deferred to draw on top of class boxes)
      if (orel.type === 'composition') {
        UMLShared.drawDiamond(decorSvg, p0.x, p0.y, startDx, startDy, colors.line, true, colors.fill);
        noteMarkerObstacles.push(pointObstacleRect(p0.x + startDx * CFG.diamondH / 2, p0.y + startDy * CFG.diamondH / 2, CFG.diamondH));
      } else if (orel.type === 'aggregation') {
        UMLShared.drawDiamond(decorSvg, p0.x, p0.y, startDx, startDy, colors.line, false, colors.fill);
        noteMarkerObstacles.push(pointObstacleRect(p0.x + startDx * CFG.diamondH / 2, p0.y + startDy * CFG.diamondH / 2, CFG.diamondH));
      }

      if (orel.navigability === 'bidirectional') {
        var sourceArrowX = p0.x;
        var sourceArrowY = p0.y;
        if (orel.type === 'composition' || orel.type === 'aggregation') {
          var markerOffset = 16;
          sourceArrowX += startDx * markerOffset;
          sourceArrowY += startDy * markerOffset;
        }
        UMLShared.drawOpenArrow(decorSvg, sourceArrowX, sourceArrowY, startDx, startDy, colors.line);
        noteMarkerObstacles.push(pointObstacleRect(sourceArrowX, sourceArrowY, CFG.arrowSize + 6));
      } else if (orel.navigability === 'non-navigable-both') {
        UMLShared.drawCrossMarker(decorSvg, p0.x, p0.y, startDx, startDy, colors.line);
        noteMarkerObstacles.push(pointObstacleRect(p0.x, p0.y, CFG.arrowSize + 6));
      }

      // Target decorations (deferred to draw on top of class boxes)
      if (orel.type === 'dependency' || orel.type === 'navigable' || orel.navigability === 'navigable' || orel.navigability === 'bidirectional') {
        UMLShared.drawOpenArrow(decorSvg, pLast.x, pLast.y, endDx, endDy, colors.line);
        noteMarkerObstacles.push(pointObstacleRect(pLast.x, pLast.y, CFG.arrowSize + 6));
      } else if (orel.navigability === 'non-navigable' || orel.navigability === 'non-navigable-both') {
        UMLShared.drawCrossMarker(decorSvg, pLast.x, pLast.y, endDx, endDy, colors.line);
        noteMarkerObstacles.push(pointObstacleRect(pLast.x, pLast.y, CFG.arrowSize + 6));
      }

      // Determine if the first/last segment is horizontal or vertical
      var isFirstHoriz = (Math.abs(startDy) < 0.1);
      var isLastHoriz = (Math.abs(endDy) < 0.1);
      var horizMultLane = Math.max(5, Math.round(CFG.labelOffset * 0.75));

      // Place relationship labels away from boxes and previously routed edges.
      if (orel.label) {
        var labelPlacement = UMLShared.placeOrthogonalLabel(orel.label, pathPoints, classObstacles, placedLabels, {
          fontSize: CFG.fontSizeStereotype,
          otherSegments: placedRouteSegments,
          scoreCandidate: function(segment, placement) {
            var bonus = segment.isH ? 10 : -4;
            if (placement.anchor === 'middle') bonus += 2;
            if ((segment.segmentIndex === 0 && orel.fromMult) ||
                (segment.segmentIndex === pathPoints.length - 2 && orel.toMult)) {
              bonus -= 10;
            }
            return bonus;
          }
        });
        if (labelPlacement) {
          placedLabels.push(labelPlacement.rect);
          labelSvg.push('<text x="' + labelPlacement.x + '" y="' + labelPlacement.y +
            '" text-anchor="' + labelPlacement.anchor + '" font-size="' + CFG.fontSizeStereotype + '" fill="' + colors.text + '" ' +
            'stroke="' + colors.fill + '" stroke-width="4" stroke-opacity="0.85" stroke-linejoin="round" paint-order="stroke" font-style="italic">' +
            UMLShared.escapeXml(orel.label) + '</text>');
        }
      }

      // Draw multiplicities near their respective endpoints, well clear of the box
      if (orel.fromMult) {
        var fmx, fmy, fmAnchor = 'start';
        if (isFirstHoriz) {
          // Horizontal exit: place multiplicity above the line, near source box edge
          fmx = p0.x + startDx * 6;
          fmy = p0.y - horizMultLane;
          fmAnchor = (startDx < 0) ? 'end' : 'start';
        } else {
          // Vertical exit: place to the right of the lifeline
          // If there's an inheritance triangle at the bottom, offset further to avoid overlap
          var fromInheritOffset = (startDy > 0 && hasInheritAtBottom[orel.from]) ? CFG.triangleH + CFG.junctionGap + 4 : 0;
          var fromCx0 = fromE.x + fromE.box.width / 2;
          var fromSideBias = (p0.x < fromCx0 - 1) ? -1 : ((p0.x > fromCx0 + 1) ? 1 : 0);
          if (fromSideBias === 0) fromSideBias = (toE.x + toE.box.width / 2 >= fromCx0) ? 1 : -1;
          var fromLabelOffset = srcCount > 1 ? (18 + Math.abs(srcCentered)) : 8;
          fmx = p0.x + fromSideBias * fromLabelOffset;
          fmy = p0.y + startDy * 14 + fromInheritOffset;
          fmAnchor = (fromSideBias < 0) ? 'end' : 'start';
        }
        svg.push('<text x="' + fmx + '" y="' + fmy + '" text-anchor="' + fmAnchor + '" ' +
          'font-size="' + CFG.fontSizeStereotype + '" fill="' + colors.text + '" ' +
          'stroke="' + colors.fill + '" stroke-width="4" stroke-opacity="0.85" stroke-linejoin="round" paint-order="stroke">' +
          UMLShared.escapeXml(orel.fromMult) + '</text>');
      }
      if (orel.toMult) {
        var tmx, tmy;
        if (isLastHoriz) {
          // Horizontal entry: place multiplicity above the line, near target box edge
          tmx = pLast.x + endDx * 6;
          tmy = pLast.y - horizMultLane;
          // Anchor toward the target box
          var tmAnchor = (endDx < 0) ? 'end' : 'start';
        } else {
          var prevSegStart = pathPoints.length >= 3 ? pathPoints[pathPoints.length - 3] : null;
          var prevSegIsHoriz = prevSegStart && Math.abs(prevSegStart.y - pPrev.y) < 1;
          if (tgtCount > 1 && prevSegIsHoriz) {
            tmx = (prevSegStart.x + pPrev.x) / 2;
            tmy = pPrev.y - horizMultLane;
            tmAnchor = 'middle';
          } else {
            var toCx0 = toE.x + toE.box.width / 2;
            var toSideBias = (pLast.x < toCx0 - 1) ? -1 : ((pLast.x > toCx0 + 1) ? 1 : 0);
            if (toSideBias === 0) toSideBias = (fromE.x + fromE.box.width / 2 <= toCx0) ? -1 : 1;
            var toLabelOffset = tgtCount > 1 ? (18 + Math.abs(tgtCentered)) : 8;
            tmx = pLast.x + toSideBias * toLabelOffset;
            tmy = pLast.y + endDy * 14;
            tmAnchor = (toSideBias < 0) ? 'end' : 'start';
          }
        }
        svg.push('<text x="' + tmx + '" y="' + tmy + '" text-anchor="' + (tmAnchor || 'start') + '" ' +
          'font-size="' + CFG.fontSizeStereotype + '" fill="' + colors.text + '" ' +
          'stroke="' + colors.fill + '" stroke-width="4" stroke-opacity="0.85" stroke-linejoin="round" paint-order="stroke">' +
          UMLShared.escapeXml(orel.toMult) + '</text>');
      }

      UMLShared.reserveOrthogonalRoute(pathPoints, classOccupiedSegments);
      placedRouteSegments = placedRouteSegments.concat(routeSegments);
      noteRouteSegments = noteRouteSegments.concat(routeSegments);
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

    // ── Draw relationship labels on top of lines and class boxes ──
    for (var lsi = 0; lsi < labelSvg.length; lsi++) svg.push(labelSvg[lsi]);

    var noteObstacles = [];
    for (var noi = 0; noi < placedLabels.length; noi++) noteObstacles.push(placedLabels[noi]);
    for (var nri = 0; nri < noteRouteSegments.length; nri++) {
      var routeObstacle = segmentObstacleRect(noteRouteSegments[nri], 12);
      if (routeObstacle) noteObstacles.push(routeObstacle);
    }
    for (var nmi = 0; nmi < noteMarkerObstacles.length; nmi++) noteObstacles.push(noteMarkerObstacles[nmi]);

    var notePositions = UMLShared.computeAnchoredNotes(parsed.notes, entries, noteObstacles, {
      gap: 22,
      slideStep: 20,
      distanceLevels: 5,
      overlapPad: 10
    });

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
    svg.unshift(UMLShared.svgOpen(svgW, svgH, ox, oy, CFG.fontFamily));

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

  function classClamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function classCenterLaneClearance(offset) {
    return CFG.triangleW + CFG.diamondW + 16 + Math.min(28, Math.round(Math.abs(offset || 0) * 1.1));
  }

  function pushUniqueSide(order, side) {
    if (order.indexOf(side) < 0) order.push(side);
  }

  function buildClassPreferredSideOrder(fromE, toE, role, preferredSide, ignorePreferred) {
    var order = [];
    var fromCx = fromE.x + fromE.box.width / 2;
    var fromCy = fromE.y + fromE.box.height / 2;
    var toCx = toE.x + toE.box.width / 2;
    var toCy = toE.y + toE.box.height / 2;
    var dx = toCx - fromCx;
    var dy = toCy - fromCy;

    if (preferredSide && !ignorePreferred) pushUniqueSide(order, preferredSide);

    if (Math.abs(dx) > Math.abs(dy) * 0.8) {
      if (role === 'source') {
        pushUniqueSide(order, dx >= 0 ? 'right' : 'left');
        pushUniqueSide(order, dy >= 0 ? 'bottom' : 'top');
        pushUniqueSide(order, dy >= 0 ? 'top' : 'bottom');
      } else {
        pushUniqueSide(order, dx >= 0 ? 'left' : 'right');
        pushUniqueSide(order, dy >= 0 ? 'top' : 'bottom');
        pushUniqueSide(order, dy >= 0 ? 'bottom' : 'top');
      }
    } else {
      if (role === 'source') {
        pushUniqueSide(order, dy >= 0 ? 'bottom' : 'top');
        pushUniqueSide(order, dx >= 0 ? 'right' : 'left');
        pushUniqueSide(order, dx >= 0 ? 'left' : 'right');
      } else {
        pushUniqueSide(order, dy >= 0 ? 'top' : 'bottom');
        pushUniqueSide(order, dx >= 0 ? 'left' : 'right');
        pushUniqueSide(order, dx >= 0 ? 'right' : 'left');
      }
    }

    pushUniqueSide(order, 'top');
    pushUniqueSide(order, 'right');
    pushUniqueSide(order, 'bottom');
    pushUniqueSide(order, 'left');
    return order;
  }

  function buildClassSidePositions(entry, side, preferredCoord, slotOffset, avoidCenter, biasCoord) {
    var horizontalSide = side === 'top' || side === 'bottom';
    var min = horizontalSide ? entry.x + 12 : entry.y + 12;
    var max = horizontalSide ? entry.x + entry.box.width - 12 : entry.y + entry.box.height - 12;
    var center = horizontalSide ? entry.x + entry.box.width / 2 : entry.y + entry.box.height / 2;
    var span = Math.max(0, max - min);
    // When multiple edges share the same side (slotOffset != 0), prefer spreading
    // around the box center rather than biasing all toward the other end's center.
    // This prevents different endpoint decorations (arrows, × markers) from overlapping.
    var preferred = slotOffset !== 0
      ? classClamp(center + slotOffset, min, max)
      : classClamp(preferredCoord, min, max);
    var biasDir = biasCoord >= center ? 1 : -1;
    if (!isFinite(biasDir) || biasDir === 0) biasDir = slotOffset >= 0 ? 1 : -1;
    var exclusion = avoidCenter ? classCenterLaneClearance(slotOffset) : 0;
    var positions = [];

    function normalize(value) {
      var clamped = classClamp(value, min, max);
      if (avoidCenter && Math.abs(clamped - center) < exclusion) {
        clamped = classClamp(center + biasDir * exclusion, min, max);
      }
      return clamped;
    }

    function push(value) {
      var normalized = normalize(value);
      for (var i = 0; i < positions.length; i++) {
        if (Math.abs(positions[i] - normalized) < 0.75) return;
      }
      positions.push(normalized);
    }

    push(preferred);
    push(center + slotOffset * 0.9);
    push(preferred - 24);
    push(preferred + 24);
    push(min + span * 0.25);
    push(min + span * 0.75);

    positions.sort(function(a, b) {
      return Math.abs(a - preferred) - Math.abs(b - preferred);
    });
    return positions.slice(0, 4);
  }

  function buildClassAnchorCandidates(entry, otherEntry, sideOrder, slotOffset, options) {
    var opts = options || {};
    var otherCx = otherEntry.x + otherEntry.box.width / 2;
    var otherCy = otherEntry.y + otherEntry.box.height / 2;
    var candidates = [];

    for (var si = 0; si < sideOrder.length && si < 4; si++) {
      var side = sideOrder[si];
      var horizontalSide = side === 'top' || side === 'bottom';
      var preferredCoord = horizontalSide ? otherCx : otherCy;
      var biasCoord = horizontalSide ? otherCx : otherCy;
      var avoidCenter = (side === 'top' && opts.avoidTop) || (side === 'bottom' && opts.avoidBottom);
      var positions = buildClassSidePositions(entry, side, preferredCoord, slotOffset, avoidCenter, biasCoord);
      var min = horizontalSide ? entry.x + 12 : entry.y + 12;
      var max = horizontalSide ? entry.x + entry.box.width - 12 : entry.y + entry.box.height - 12;
      var clampedPreferred = slotOffset !== 0
        ? classClamp(entry[horizontalSide ? 'x' : 'y'] + (horizontalSide ? entry.box.width : entry.box.height) / 2 + slotOffset, min, max)
        : classClamp(preferredCoord, min, max);

      for (var pi = 0; pi < positions.length; pi++) {
        var pos = positions[pi];
        candidates.push({
          x: horizontalSide ? pos : (side === 'left' ? entry.x : entry.x + entry.box.width),
          y: horizontalSide ? (side === 'top' ? entry.y : entry.y + entry.box.height) : pos,
          side: side,
          stub: opts.stub,
          penalty: si * 26 + pi * 4 + Math.abs(pos - clampedPreferred) * 0.5
        });
      }
    }

    return candidates;
  }

  function classEdgeForPoint(point, entry, fallback) {
    if (!point || !entry || !entry.box) return fallback;
    var tol = 1.5;
    var left = entry.x;
    var right = entry.x + entry.box.width;
    var top = entry.y;
    var bottom = entry.y + entry.box.height;
    if (Math.abs(point.y - top) <= tol && point.x >= left - tol && point.x <= right + tol) return 'top';
    if (Math.abs(point.y - bottom) <= tol && point.x >= left - tol && point.x <= right + tol) return 'bottom';
    if (Math.abs(point.x - left) <= tol && point.y >= top - tol && point.y <= bottom + tol) return 'left';
    if (Math.abs(point.x - right) <= tol && point.y >= top - tol && point.y <= bottom + tol) return 'right';
    return fallback;
  }

  function classSideVector(side) {
    if (side === 'left') return { x: -1, y: 0 };
    if (side === 'right') return { x: 1, y: 0 };
    if (side === 'top') return { x: 0, y: -1 };
    if (side === 'bottom') return { x: 0, y: 1 };
    return { x: 0, y: 0 };
  }

  /**
   * Compute orthogonal (Manhattan) route between two class boxes using the
   * shared obstacle-aware router and multi-anchor candidate scoring.
   */
  function computeOrthogonalRoute(fromE, toE, avoidFromBottom, avoidToTop, portOffset, allEntries, fromId, toId, targetEntryOffset, targetEntrySide, sourceSide, avoidFromTop, avoidToBottom, occupiedSegments, extraObstacleRects, restrictSourceSide) {
    portOffset = portOffset || 0;
    targetEntryOffset = targetEntryOffset || 0;
    avoidFromTop = !!avoidFromTop;
    avoidToBottom = !!avoidToBottom;
    var fromCx = fromE.x + fromE.box.width / 2;
    var fromCy = fromE.y + fromE.box.height / 2;
    var toCx = toE.x + toE.box.width / 2;
    var toCy = toE.y + toE.box.height / 2;
    var dxAbs = Math.abs(toCx - fromCx);
    var dyAbs = Math.abs(toCy - fromCy);
    var stub = Math.max(18, CFG.junctionGap + 8);
    var obstacles = [];
    var skipNames = {};
    skipNames[fromId] = true;
    skipNames[toId] = true;

    if (allEntries) {
      for (var obn in allEntries) {
        if (!Object.prototype.hasOwnProperty.call(allEntries, obn) || obn === fromId || obn === toId) continue;
        var ob = allEntries[obn];
        obstacles.push({
          x1: ob.x - 12,
          y1: ob.y - 12,
          x2: ob.x + ob.box.width + 12,
          y2: ob.y + ob.box.height + 12,
          name: obn
        });
      }
    }

    if (extraObstacleRects && extraObstacleRects.length) {
      for (var eoi = 0; eoi < extraObstacleRects.length; eoi++) {
        obstacles.push(extraObstacleRects[eoi]);
      }
    }

    var sourceOrder = restrictSourceSide
      ? [sourceSide]
      : buildClassPreferredSideOrder(
          fromE,
          toE,
          'source',
          sourceSide,
          avoidFromBottom && sourceSide === 'bottom'
        );
    var useStrictTarget = (dyAbs > dxAbs * 1.2 || dxAbs > dyAbs * 1.2);
    var targetOrder = useStrictTarget
      ? [targetEntrySide]
      : buildClassPreferredSideOrder(
          fromE,
          toE,
          'target',
          targetEntrySide,
          avoidToTop && targetEntrySide === 'top'
        );

    var sourceCandidates = buildClassAnchorCandidates(fromE, toE, sourceOrder, portOffset, {
      avoidTop: avoidFromTop,
      avoidBottom: avoidFromBottom,
      stub: stub
    });
    var targetCandidates = buildClassAnchorCandidates(toE, fromE, targetOrder, targetEntryOffset, {
      avoidTop: avoidToTop,
      avoidBottom: avoidToBottom,
      stub: stub
    });

    var best = null;
    for (var si2 = 0; si2 < sourceCandidates.length; si2++) {
      var sourceCandidate = sourceCandidates[si2];
      for (var ti = 0; ti < targetCandidates.length; ti++) {
        var targetCandidate = targetCandidates[ti];
        var routed = UMLShared.routeOrthogonalConnector(sourceCandidate, targetCandidate, obstacles, {
          skipNames: skipNames,
          occupied: occupiedSegments,
          stub: stub,
          bendPenalty: 46,
          extraXs: [fromCx, toCx],
          extraYs: [fromCy, toCy]
        });
        var points = enforceOrthogonalEndpointApproach(routed.points, fromE, toE, sourceCandidate.side, targetCandidate.side);
        points = UMLShared.simplifyOrthogonalPath(points);

        if (UMLShared.routeHitsObstacle(points, obstacles, skipNames, null)) continue;

        var crosses = UMLShared.countRouteCrossings(points, occupiedSegments);
        var occupiedPenalty = crosses * 5000;

        // Penalize routes where intermediate segments pass through source or
        // target boxes (the "route behind class" problem).  Skip the first
        // and last segments which legitimately touch the box edge.
        var selfHitPenalty = 0;
        if (points.length > 2) {
          var fromBox = { l: fromE.x - 2, t: fromE.y - 2, r: fromE.x + fromE.box.width + 2, b: fromE.y + fromE.box.height + 2 };
          var toBox = { l: toE.x - 2, t: toE.y - 2, r: toE.x + toE.box.width + 2, b: toE.y + toE.box.height + 2 };
          for (var shi = 0; shi < points.length - 1; shi++) {
            // Skip first segment (touches source) and last segment (touches target)
            if (shi === 0 || shi === points.length - 2) continue;
            if (segmentIntersectsBox(points[shi], points[shi + 1], fromBox)) selfHitPenalty += 50000;
            if (segmentIntersectsBox(points[shi], points[shi + 1], toBox)) selfHitPenalty += 50000;
          }
          // Also penalize the first segment if it immediately enters the source box
          // (e.g., exits left but goes right into the box)
          if (points.length >= 3) {
            var p0sh = points[0], p1sh = points[1];
            var afterFirst = points[2];
            // Check if p1 is inside source box (not just on the edge)
            if (p1sh.x > fromBox.l + 4 && p1sh.x < fromBox.r - 4 &&
                p1sh.y > fromBox.t + 4 && p1sh.y < fromBox.b - 4) {
              selfHitPenalty += 50000;
            }
            // Check if last second-to-last point is inside target box
            var pBeforeLast = points[points.length - 2];
            if (pBeforeLast.x > toBox.l + 4 && pBeforeLast.x < toBox.r - 4 &&
                pBeforeLast.y > toBox.t + 4 && pBeforeLast.y < toBox.b - 4) {
              selfHitPenalty += 50000;
            }
          }
        }

        // Penalize detours: routes whose total length is far greater than
        // the straight-line distance between endpoints (route efficiency).
        var routeLen = UMLShared.measureOrthogonalRoute(points);
        var directDist = Math.abs(points[0].x - points[points.length - 1].x) +
                         Math.abs(points[0].y - points[points.length - 1].y);
        var detourPenalty = 0;
        if (directDist > 0) {
          var efficiency = routeLen / directDist;
          // Penalize routes that are more than 2x the direct distance
          if (efficiency > 2.0) detourPenalty = (efficiency - 2.0) * 200;
        }

        var score = routeLen +
          UMLShared.countOrthogonalBends(points) * 48 +
          sourceCandidate.penalty + targetCandidate.penalty + occupiedPenalty +
          selfHitPenalty + detourPenalty;

        if (!best || score + 0.01 < best.score) {
          best = {
            score: score,
            points: points
          };
        }
      }
    }

    if (!best) {
      var fallbackSource = sourceCandidates[0] || { x: fromE.x + fromE.box.width, y: fromCy, side: 'right', stub: stub };
      var fallbackTarget = targetCandidates[0] || { x: toE.x, y: toCy, side: 'left', stub: stub };
      if (!sourceCandidates.length && !targetCandidates.length && toCx < fromCx) {
        fallbackSource = { x: fromE.x, y: fromCy, side: 'left', stub: stub };
        fallbackTarget = { x: toE.x + toE.box.width, y: toCy, side: 'right', stub: stub };
      }
      var fallbackRoute = UMLShared.routeOrthogonalConnector(fallbackSource, fallbackTarget, obstacles, {
        skipNames: skipNames,
        occupied: occupiedSegments,
        stub: stub,
        bendPenalty: 46,
        extraXs: [fromCx, toCx],
        extraYs: [fromCy, toCy]
      });
      best = {
        points: enforceOrthogonalEndpointApproach(fallbackRoute.points, fromE, toE, fallbackSource.side, fallbackTarget.side)
      };
    }

    return { points: best.points };
  }

  function enforceOrthogonalEndpointApproach(points, fromE, toE, sourceSide, targetSide) {
    if (!points || points.length < 3) return points;

    var tol = 1.5;
    var outwardGap = Math.max(16, CFG.diamondH + 4, CFG.arrowSize + 4);

    function needsVertical(side) {
      return side === 'top' || side === 'bottom';
    }

    function needsHorizontal(side) {
      return side === 'left' || side === 'right';
    }

    function buildStubPoint(side, entry, point) {
      if (!entry || !entry.box) return point;
      if (side === 'left') return { x: entry.x - outwardGap, y: point.y };
      if (side === 'right') return { x: entry.x + entry.box.width + outwardGap, y: point.y };
      if (side === 'top') return { x: point.x, y: entry.y - outwardGap };
      if (side === 'bottom') return { x: point.x, y: entry.y + entry.box.height + outwardGap };
      return point;
    }

    function startsOutward(anchor, next, side) {
      if (!anchor || !next) return true;
      if (side === 'left') return Math.abs(next.y - anchor.y) <= tol && next.x <= anchor.x - tol;
      if (side === 'right') return Math.abs(next.y - anchor.y) <= tol && next.x >= anchor.x + tol;
      if (side === 'top') return Math.abs(next.x - anchor.x) <= tol && next.y <= anchor.y - tol;
      if (side === 'bottom') return Math.abs(next.x - anchor.x) <= tol && next.y >= anchor.y + tol;
      return true;
    }

    function endsOutward(prev, anchor, side) {
      if (!anchor || !prev) return true;
      if (side === 'left') return Math.abs(prev.y - anchor.y) <= tol && prev.x <= anchor.x - tol;
      if (side === 'right') return Math.abs(prev.y - anchor.y) <= tol && prev.x >= anchor.x + tol;
      if (side === 'top') return Math.abs(prev.x - anchor.x) <= tol && prev.y <= anchor.y - tol;
      if (side === 'bottom') return Math.abs(prev.x - anchor.x) <= tol && prev.y >= anchor.y + tol;
      return true;
    }

    function rebuildStart(pointsIn, side, entry) {
      if (!pointsIn || pointsIn.length < 2) return pointsIn;
      if (startsOutward(pointsIn[0], pointsIn[1], side)) return pointsIn;

      var stub = buildStubPoint(side, entry, pointsIn[0]);
      var rebuilt = [pointsIn[0], stub];
      var turnIndex = 1;

      if (needsHorizontal(side)) {
        while (turnIndex < pointsIn.length && Math.abs(pointsIn[turnIndex].y - pointsIn[0].y) <= tol) turnIndex++;
        if (turnIndex < pointsIn.length) {
          rebuilt.push({ x: stub.x, y: pointsIn[turnIndex].y });
        }
      } else {
        while (turnIndex < pointsIn.length && Math.abs(pointsIn[turnIndex].x - pointsIn[0].x) <= tol) turnIndex++;
        if (turnIndex < pointsIn.length) {
          rebuilt.push({ x: pointsIn[turnIndex].x, y: stub.y });
        }
      }

      return rebuilt.concat(pointsIn.slice(turnIndex));
    }

    function rebuildEnd(pointsIn, side, entry) {
      if (!pointsIn || pointsIn.length < 2) return pointsIn;
      var lastIndex = pointsIn.length - 1;
      if (endsOutward(pointsIn[lastIndex - 1], pointsIn[lastIndex], side)) return pointsIn;

      var end = pointsIn[lastIndex];
      var stub = buildStubPoint(side, entry, end);
      var rebuilt = [];
      var turnIndex = lastIndex - 1;

      if (needsHorizontal(side)) {
        while (turnIndex >= 0 && Math.abs(pointsIn[turnIndex].y - end.y) <= tol) turnIndex--;
        rebuilt = pointsIn.slice(0, turnIndex + 1);
        if (turnIndex >= 0) {
          rebuilt.push({ x: pointsIn[turnIndex].x, y: stub.y });
        }
      } else {
        while (turnIndex >= 0 && Math.abs(pointsIn[turnIndex].x - end.x) <= tol) turnIndex--;
        rebuilt = pointsIn.slice(0, turnIndex + 1);
        if (turnIndex >= 0) {
          rebuilt.push({ x: stub.x, y: pointsIn[turnIndex].y });
        }
      }
      rebuilt.push(stub);
      rebuilt.push(end);
      return rebuilt;
    }

    var adjusted = points.slice();
  var actualSourceSide = classEdgeForPoint(adjusted[0], fromE, sourceSide);
  var actualTargetSide = classEdgeForPoint(adjusted[adjusted.length - 1], toE, targetSide);

    adjusted = rebuildStart(adjusted, actualSourceSide, fromE);
    adjusted = rebuildEnd(adjusted, actualTargetSide, toE);

    return simplifyPath(orthogonalize(adjusted));
  }

  function routeSide(fromE, toE, avoidFromBottom) {
    if (avoidFromBottom) return 'bottom';
    var fromCx = fromE.x + fromE.box.width / 2;
    var fromCy = fromE.y + fromE.box.height / 2;
    var toCx = toE.x + toE.box.width / 2;
    var toCy = toE.y + toE.box.height / 2;
    if (Math.abs(toCx - fromCx) > Math.abs(toCy - fromCy) * 0.6) {
      return (toCx > fromCx) ? 'right' : 'left';
    }
    return (toCy > fromCy) ? 'bottom' : 'top';
  }

  function routeSourceSideForRelation(fromE, toE, relationType, avoidFromBottom) {
    if (relationType === 'composition' || relationType === 'aggregation') {
      var fromCx = fromE.x + fromE.box.width / 2;
      var fromCy = fromE.y + fromE.box.height / 2;
      var toCx = toE.x + toE.box.width / 2;
      var toCy = toE.y + toE.box.height / 2;
      var dx = toCx - fromCx;
      var dy = toCy - fromCy;

      var targetBottom = toE.y + toE.box.height;
      var targetTop = toE.y;
      var verticalGap = Math.abs(dy);
      var horizontalGap = Math.abs(dx);

      // Prefer horizontal exit when horizontal displacement is significant —
      // this avoids unnecessary vertical detours for composition diamonds.
      if (Math.abs(dx) > Math.abs(dy) * 0.7) {
        return dx >= 0 ? 'right' : 'left';
      }

      if (targetBottom <= fromE.y + 8 && verticalGap >= horizontalGap * 0.6) return 'top';
      if (!avoidFromBottom) {
        if (targetTop >= fromE.y + fromE.box.height - 8 && verticalGap >= horizontalGap * 0.6) return 'bottom';
      }
    }
    return routeSide(fromE, toE, avoidFromBottom);
  }

  function routeEntrySide(fromE, toE, avoidToTop) {
    if (avoidToTop) return 'top';
    var fromCx = fromE.x + fromE.box.width / 2;
    var fromCy = fromE.y + fromE.box.height / 2;
    var toCx = toE.x + toE.box.width / 2;
    var toCy = toE.y + toE.box.height / 2;
    if (Math.abs(toCx - fromCx) > Math.abs(toCy - fromCy) * 1.0) {
      return (fromCx > toCx) ? 'right' : 'left';
    }
    return (fromCy > toCy) ? 'bottom' : 'top';
  }

  function reanchorWholePartRouteStart(points, entry, desiredSide) {
    if (!points || points.length < 2) return points;
    if (desiredSide !== 'top' && desiredSide !== 'bottom') return points;

    var boundaryY = desiredSide === 'top' ? entry.y : (entry.y + entry.box.height);
    var minX = entry.x - 1;
    var maxX = entry.x + entry.box.width + 1;
    if (Math.abs(points[0].y - boundaryY) > 1 || Math.abs(points[1].y - boundaryY) > 1) return points;
    if (points[1].x < minX || points[1].x > maxX) return points;

    var outsideIndex = -1;
    for (var i = 1; i < points.length; i++) {
      var point = points[i];
      if (desiredSide === 'top' && point.y < entry.y - 1) {
        outsideIndex = i;
        break;
      }
      if (desiredSide === 'bottom' && point.y > entry.y + entry.box.height + 1) {
        outsideIndex = i;
        break;
      }
    }

    if (outsideIndex === -1) return points;

    var exitPoint = points[outsideIndex];
    var rebuilt = [{ x: exitPoint.x, y: boundaryY }].concat(points.slice(outsideIndex));
    return UMLShared.simplifyOrthogonalPath(rebuilt);
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

  UMLShared.createAutoInit('pre > code.language-uml-class', render, { type: 'class', extractText: extractCodeText });

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

  function computeSequenceSpacing(participants) {
    var metrics = {
      participantPadX: CFG.participantPadX,
      participantMinW: CFG.participantMinW,
      participantGap: CFG.participantGap,
    };
    var count = participants.length || 0;
    if (count <= 5) return metrics;

    var widestLabel = 0;
    var totalLabelWidth = 0;
    for (var i = 0; i < participants.length; i++) {
      var part = participants[i];
      var displayText = (part.id !== part.label) ? (part.id + ': ' + part.label) : part.label;
      var labelWidth = UMLShared.textWidth(displayText, true, CFG.fontSizeBold);
      widestLabel = Math.max(widestLabel, labelWidth);
      totalLabelWidth += labelWidth;
    }

    var averageLabelWidth = totalLabelWidth / count;
    var density = Math.max(0, count - 5);
    var gapReduction = Math.min(24, density * 4);
    var padReduction = Math.min(8, Math.round(density * 1.5));

    if (averageLabelWidth > 120 || widestLabel > 180) gapReduction = Math.min(30, gapReduction + 6);
    if (averageLabelWidth < 96 && count >= 7) gapReduction += 4;

    metrics.participantGap = Math.max(28, CFG.participantGap - gapReduction);
    metrics.participantPadX = Math.max(12, CFG.participantPadX - padReduction);

    if (count >= 8) metrics.participantMinW = Math.max(88, CFG.participantMinW - 8);
    else if (count >= 6) metrics.participantMinW = Math.max(92, CFG.participantMinW - 4);

    return metrics;
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
    var spacing = computeSequenceSpacing(participants);

    // ── Measure participant boxes ──
    var partWidths = [];
    var partMaxW = 0;
    for (var pi = 0; pi < participants.length; pi++) {
      var part = participants[pi];
      var displayText = (part.id !== part.label) ? (part.id + ': ' + part.label) : part.label;
      var pw = UMLShared.textWidth(displayText, true, CFG.fontSizeBold) + spacing.participantPadX * 2;
      pw = Math.max(pw, spacing.participantMinW);
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
      curX += w + spacing.participantGap;
    }
    var totalW = curX - spacing.participantGap + CFG.svgPad;

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
        // Advance only to box center — the following <<create>> message aligns here
        curY += partH / 2;
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

    var sequenceNoteObstacles = [];
    var deferredSequenceNotes = [];

    function pushSequenceRectObstacle(x, y, w, h) {
      sequenceNoteObstacles.push({ x: x, y: y, w: w, h: h });
    }

    function pushSequenceLabelObstacle(text, x, y, anchor) {
      if (!text) return;
      var labelW = UMLShared.textWidth(text, false, CFG.fontSize);
      var labelH = CFG.fontSize + 8;
      var left = anchor === 'middle' ? x - labelW / 2 : (anchor === 'end' ? x - labelW : x);
      pushSequenceRectObstacle(left - 4, y - CFG.fontSize - 4, labelW + 8, labelH);
    }

    for (var pbi = 0; pbi < participants.length; pbi++) {
      if (createYs && createYs.hasOwnProperty(participants[pbi].id)) continue;
      pushSequenceRectObstacle(partX[pbi] - partWidths[pbi] / 2, CFG.svgPad, partWidths[pbi], partH);
    }
    for (var abo = 0; abo < activationBars.length; abo++) {
      var obstacleBar = activationBars[abo];
      pushSequenceRectObstacle(
        partX[obstacleBar.pIdx] - CFG.activationW / 2 + (obstacleBar.depth || 0) * CFG.activationOffset,
        obstacleBar.startY,
        CFG.activationW,
        obstacleBar.endY - obstacleBar.startY
      );
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
        var x2;
        // Create messages: arrow points to the participant box edge (UML 2.0 G179)
        if (createYs.hasOwnProperty(m.to) && my <= createYs[m.to] + partH) {
          x2 = isLeft
            ? partX[toIdx] + partWidths[toIdx] / 2   // right edge of box
            : partX[toIdx] - partWidths[toIdx] / 2;  // left edge of box
        } else {
          x2 = getEdgeX(toIdx, my, isLeft ? 'right' : 'left');
        }

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
            var selfLabelX = selfX + selfW + 6;
            var selfLabelY = my + 4;
            svg.push('<text x="' + selfLabelX + '" y="' + selfLabelY +
              '" font-size="' + CFG.fontSize + '" fill="' + colors.text +
              '" stroke="' + colors.fill + '" stroke-width="3" stroke-opacity="0.85" paint-order="stroke">' + UMLShared.escapeXml(m.label) + '</text>');
            pushSequenceLabelObstacle(m.label, selfLabelX, selfLabelY, 'start');
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
            var labelY = my - 6;
            svg.push('<text x="' + labelX + '" y="' + labelY +
              '" text-anchor="middle" font-size="' + CFG.fontSize + '" fill="' + colors.text +
              '" stroke="' + colors.fill + '" stroke-width="3" stroke-opacity="0.85" paint-order="stroke">' +
              UMLShared.escapeXml(m.label) + '</text>');
            pushSequenceLabelObstacle(m.label, labelX, labelY, 'middle');
          }
        }
      } else if (m.type === 'create') {
        // Mark participant as created mid-diagram.
        // The box is drawn inline; the following message provides the visual arrow.
        // Per UML 2.0: create messages are dashed arrows to the lifeline head (G179).
        var cIdx = findPIdx(m.target);
        var cpx = partX[cIdx] - partWidths[cIdx] / 2;
        var cpart = participants[cIdx];
        svg.push('<rect x="' + cpx + '" y="' + my + '" width="' + partWidths[cIdx] + '" height="' + partH +
          '" fill="' + colors.headerFill + '" stroke="' + colors.stroke + '" stroke-width="' + CFG.strokeWidth + '"/>');
        pushSequenceRectObstacle(cpx, my, partWidths[cIdx], partH);
        var cDispText = (cpart.id !== cpart.label) ? cpart.id + ': ' + cpart.label : cpart.label;
        var cTextY = my + partH / 2 + CFG.fontSize * 0.35;
        svg.push('<text x="' + partX[cIdx] + '" y="' + cTextY +
          '" text-anchor="middle" font-weight="bold" font-size="' + CFG.fontSizeBold + '" fill="' + colors.text + '">' +
          UMLShared.escapeXml(cDispText) + '</text>');
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
          var lostLabelY = my - 6;
          svg.push('<text x="' + llabelX + '" y="' + lostLabelY +
            '" text-anchor="middle" font-size="' + CFG.fontSize + '" fill="' + colors.text +
            '" stroke="' + colors.fill + '" stroke-width="3" stroke-opacity="0.85" paint-order="stroke">' +
            UMLShared.escapeXml(m.label) + '</text>');
          pushSequenceLabelObstacle(m.label, llabelX, lostLabelY, 'middle');
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
          var foundLabelY = my - 6;
          svg.push('<text x="' + flabelX + '" y="' + foundLabelY +
            '" text-anchor="middle" font-size="' + CFG.fontSize + '" fill="' + colors.text +
            '" stroke="' + colors.fill + '" stroke-width="3" stroke-opacity="0.85" paint-order="stroke">' +
            UMLShared.escapeXml(m.label) + '</text>');
          pushSequenceLabelObstacle(m.label, flabelX, foundLabelY, 'middle');
        }
      } else if (m.type === 'note') {
        var noteLines = m.lines || [m.text || ''];
        var nIdx = findPIdx(m.target);
        var noteSize = UMLShared.measureNote(noteLines);
        var targetRect;
        if (m.position === 'left') {
          targetRect = { x: getEdgeX(nIdx, my, 'left') - 1, y: my - 6, w: 2, h: 12 };
        } else if (m.position === 'right') {
          targetRect = { x: getEdgeX(nIdx, my, 'right') - 1, y: my - 6, w: 2, h: 12 };
        } else {
          targetRect = { x: partX[nIdx] - partWidths[nIdx] / 2, y: my - 6, w: partWidths[nIdx], h: 12 };
        }
        deferredSequenceNotes.push({
          position: m.position,
          targetIdx: nIdx,
          targetY: my,
          targetRect: targetRect,
          lines: noteLines,
          size: noteSize
        });
      }
    }

    var placedSequenceNotes = [];
    for (var sni = 0; sni < deferredSequenceNotes.length; sni++) {
      var sequenceNote = deferredSequenceNotes[sni];
      var notePlacement = UMLShared.placeNoteRect(
        sequenceNote.targetRect,
        sequenceNote.size,
        sequenceNote.position,
        sequenceNoteObstacles,
        placedSequenceNotes,
        { slideStep: 16, maxSlides: 10, distanceLevels: 6 }
      );
      var connector = null;
      if (sequenceNote.position === 'left') {
        connector = {
          fromX: notePlacement.x + sequenceNote.size.width,
          fromY: notePlacement.y + sequenceNote.size.height / 2,
          toX: getEdgeX(sequenceNote.targetIdx, sequenceNote.targetY, 'left'),
          toY: sequenceNote.targetY
        };
      } else if (sequenceNote.position === 'right') {
        connector = {
          fromX: notePlacement.x,
          fromY: notePlacement.y + sequenceNote.size.height / 2,
          toX: getEdgeX(sequenceNote.targetIdx, sequenceNote.targetY, 'right'),
          toY: sequenceNote.targetY
        };
      } else if (sequenceNote.position === 'top') {
        connector = {
          fromX: notePlacement.x + sequenceNote.size.width / 2,
          fromY: notePlacement.y + sequenceNote.size.height,
          toX: partX[sequenceNote.targetIdx],
          toY: sequenceNote.targetY
        };
      } else if (sequenceNote.position === 'bottom') {
        connector = {
          fromX: notePlacement.x + sequenceNote.size.width / 2,
          fromY: notePlacement.y,
          toX: partX[sequenceNote.targetIdx],
          toY: sequenceNote.targetY
        };
      }
      UMLShared.drawNote(svg, notePlacement.x, notePlacement.y, sequenceNote.lines, colors, connector);
      var placedNoteRect = { x: notePlacement.x, y: notePlacement.y, w: sequenceNote.size.width, h: sequenceNote.size.height };
      placedSequenceNotes.push(placedNoteRect);
      sequenceNoteObstacles.push(placedNoteRect);
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

  UMLShared.createAutoInit('pre > code.language-uml-sequence', render, { type: 'sequence' });

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
    gapY: 55,
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
    var layoutPreference = null;

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
      var layoutDirective = UMLShared.parseLayoutDirective(line);
      if (layoutDirective && inState === null) {
        if (layoutDirective.direction) {
          direction = layoutDirective.direction;
          layoutPreference = null;
        } else {
          layoutPreference = layoutDirective.layoutPreference;
        }
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
          if (!states[iName]) {
            states[iName] = {
              name: iName,
              type: 'initial',
              entryAction: '',
              exitAction: '',
              doActivity: '',
              parent: transitions[t].parent || null
            };
          } else if (transitions[t].parent && !states[iName].parent) {
            states[iName].parent = transitions[t].parent;
          }
        initialCount++;
      }
      if (transitions[t].to === '[*]') {
        var fName = '__final__' + finalCount;
        finalNames[t] = fName;
          if (!states[fName]) {
            states[fName] = {
              name: fName,
              type: 'final',
              entryAction: '',
              exitAction: '',
              doActivity: '',
              parent: transitions[t].parent || null
            };
          } else if (transitions[t].parent && !states[fName].parent) {
            states[fName].parent = transitions[t].parent;
          }
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

    return { states: stateList, transitions: transitions, notes: notes, direction: direction, layoutPreference: layoutPreference };
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
        var subResult = window.UMLAdvancedLayout.compute(subNodes, subEdges, {
          gapX: CFG.gapX * 0.7,
          gapY: CFG.gapY * 0.7,
          direction: parsed.direction || 'TB',
          layoutPreference: parsed.layoutPreference || null
        });
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

    var result = window.UMLAdvancedLayout.compute(layoutNodes, layoutEdges, {
      gapX: CFG.gapX,
      gapY: CFG.gapY,
      direction: parsed.direction || 'TB',
      layoutPreference: parsed.layoutPreference || null
    });

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
    var routeMarginX = maxBoundsX + CFG.gapX * 0.25;

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
    var notePositions = UMLShared.computeAnchoredNotes(parsed.notes, entries);
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
    var placedLabels = [];
    var placedRouteSegments = [];
    var stateObstacles = [];
    for (var sen in entries) {
      var se0 = entries[sen];
      stateObstacles.push({ x: se0.x, y: se0.y, w: se0.box.width, h: se0.box.height });
    }
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
          var loopLabelX = sx + lw + 4;
          var loopLabelY = sy + 10;
          labelSvg.push('<text x="' + loopLabelX + '" y="' + loopLabelY +
            '" font-size="' + CFG.fontSize + '" fill="' + colors.text +
            '" stroke="' + colors.fill + '" stroke-width="4" stroke-opacity="0.85" stroke-linejoin="round" paint-order="stroke">' + UMLShared.escapeXml(tr.label) + '</text>');
          placedLabels.push({
            left: loopLabelX,
            right: loopLabelX + UMLShared.textWidth(tr.label, false, CFG.fontSize),
            top: loopLabelY - CFG.fontSize - 2,
            bottom: loopLabelY + 4
          });
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
        var dynamicMargin = routeMarginX + (ti * 10);
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
      var routeSegments = UMLShared.buildOrthogonalSegments(points);

      // Transition label with background
      if (tr.label) {
        var labelPlacement = UMLShared.placeOrthogonalLabel(tr.label, points, stateObstacles, placedLabels, {
          fontSize: CFG.fontSize,
          otherSegments: placedRouteSegments,
          scoreCandidate: function(segment, placement) {
            var bonus = segment.isH ? 8 : -4;
            if (placement.anchor === 'middle') bonus += 2;
            if (isBackEdge) bonus += segment.isH ? 18 : -12;
            return bonus;
          }
        });
        if (labelPlacement) {
          placedLabels.push(labelPlacement.rect);
          labelSvg.push('<text x="' + labelPlacement.x + '" y="' + labelPlacement.y +
            '" text-anchor="' + labelPlacement.anchor + '" font-size="' + CFG.fontSize + '" fill="' + colors.text +
            '" stroke="' + colors.fill + '" stroke-width="4" stroke-opacity="0.85" stroke-linejoin="round" paint-order="stroke">' +
            UMLShared.escapeXml(tr.label) + '</text>');
        }
      }
      placedRouteSegments = placedRouteSegments.concat(routeSegments);
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

  UMLShared.createAutoInit('pre > code.language-uml-state', render, { type: 'state' });
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
    ifaceSocketRadius: 13,
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
    var layoutPreference = null;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line === '@startuml' || line === '@enduml') continue;

      // Layout directive
      var layoutDirective = UMLShared.parseLayoutDirective(line);
      if (layoutDirective) {
        if (layoutDirective.direction) {
          direction = layoutDirective.direction;
          layoutPreference = null;
        } else {
          layoutPreference = layoutDirective.layoutPreference;
        }
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

    return { components: components, connectors: connectors, notes: notes, direction: direction, layoutPreference: layoutPreference };
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
      var portOrderIndex = {};
      for (var pi = 0; pi < c.ports.length; pi++) {
        var port = c.ports[pi];
        var alias = port.alias;
        portOrderIndex[alias] = pi;
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
        portOrderIndex: portOrderIndex,
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

    var result = window.UMLAdvancedLayout.compute(layoutNodes, layoutEdges, {
      gapX: effectiveGapX,
      gapY: effectiveGapY,
      direction: parsed.direction || 'LR',
      layoutPreference: parsed.layoutPreference || null
    });
    var actualDirection = result.direction || parsed.direction || 'LR';

    for (var n in result.nodes) {
      if (!entries[n]) continue;
      entries[n].x = result.nodes[n].x;
      entries[n].y = result.nodes[n].y;
    }

    if (actualDirection === 'LR' && connectors.length > 0) {
      var inCounts = {}, outCounts = {};
      for (var ec in entries) {
        inCounts[ec] = 0;
        outCounts[ec] = 0;
      }
      for (var cci = 0; cci < connectors.length; cci++) {
        var cc = connectors[cci];
        if (!entries[cc.from] || !entries[cc.to] || cc.from === cc.to) continue;
        outCounts[cc.from] = (outCounts[cc.from] || 0) + 1;
        inCounts[cc.to] = (inCounts[cc.to] || 0) + 1;
      }

      var columnItems = [];
      for (var cn in entries) columnItems.push(cn);
      columnItems.sort(function(a, b) {
        if (Math.abs(entries[a].x - entries[b].x) > 1) return entries[a].x - entries[b].x;
        return entries[a].y - entries[b].y;
      });

      var columnThreshold = Math.max(24, effectiveGapX * 0.3);
      var columns = [];
      for (var cni = 0; cni < columnItems.length; cni++) {
        var name = columnItems[cni];
        var entry = entries[name];
        var lastColumn = columns.length ? columns[columns.length - 1] : null;
        if (!lastColumn || Math.abs(entry.x - lastColumn.refX) > columnThreshold) {
          columns.push({ refX: entry.x, names: [name] });
        } else {
          lastColumn.names.push(name);
        }
      }

      function columnWidth(column) {
        var width = 0;
        for (var wi = 0; wi < column.names.length; wi++) {
          width = Math.max(width, entries[column.names[wi]].box.width);
        }
        return width;
      }

      function scoreColumnOrder(order) {
        var colIndex = {};
        for (var oi = 0; oi < order.length; oi++) {
          for (var oni = 0; oni < order[oi].names.length; oni++) {
            colIndex[order[oi].names[oni]] = oi;
          }
        }

        var score = 0;
        for (var si = 0; si < connectors.length; si++) {
          var conn = connectors[si];
          var fromCol = colIndex[conn.from];
          var toCol = colIndex[conn.to];
          if (fromCol === undefined || toCol === undefined) continue;
          var span = Math.abs(toCol - fromCol);
          if (conn.from !== conn.to) score += span;
          if (fromCol > toCol) score += 1.25;
          if (fromCol === toCol && conn.from !== conn.to) score += 0.75;
        }
        return score;
      }

      var fixedPrefix = 0;
      while (fixedPrefix < columns.length) {
        var prefixColumn = columns[fixedPrefix];
        var allSourceOnly = true;
        for (var pfi = 0; pfi < prefixColumn.names.length; pfi++) {
          if ((inCounts[prefixColumn.names[pfi]] || 0) > 0) {
            allSourceOnly = false;
            break;
          }
        }
        if (!allSourceOnly) break;
        fixedPrefix++;
      }

      if (columns.length > fixedPrefix + 1) {
        var optimizedColumns = columns.slice();
        var movableColumns = columns.slice(fixedPrefix);

        if (movableColumns.length <= 7) {
          var bestOrder = columns.slice();
          var bestScore = scoreColumnOrder(bestOrder);

          function searchColumnOrders(prefixOrder, remaining) {
            if (!remaining.length) {
              var fullOrder = columns.slice(0, fixedPrefix).concat(prefixOrder);
              var fullScore = scoreColumnOrder(fullOrder);
              if (fullScore + 0.01 < bestScore) {
                bestOrder = fullOrder;
                bestScore = fullScore;
              }
              return;
            }

            for (var ri2 = 0; ri2 < remaining.length; ri2++) {
              var nextPrefix = prefixOrder.concat([remaining[ri2]]);
              var nextRemaining = remaining.slice(0, ri2).concat(remaining.slice(ri2 + 1));
              searchColumnOrders(nextPrefix, nextRemaining);
            }
          }

          searchColumnOrders([], movableColumns);
          optimizedColumns = bestOrder;
        } else {
          var improved = true;
          while (improved) {
            improved = false;
            var currentScore = scoreColumnOrder(optimizedColumns);
            for (var swapIdx = fixedPrefix; swapIdx < optimizedColumns.length - 1; swapIdx++) {
              var candidate = optimizedColumns.slice();
              var tmp = candidate[swapIdx];
              candidate[swapIdx] = candidate[swapIdx + 1];
              candidate[swapIdx + 1] = tmp;
              var candidateScore = scoreColumnOrder(candidate);
              if (candidateScore + 0.01 < currentScore) {
                optimizedColumns = candidate;
                currentScore = candidateScore;
                improved = true;
              }
            }
          }
        }

        var cursorX = 0;
        for (var oci = 0; oci < optimizedColumns.length; oci++) {
          var column = optimizedColumns[oci];
          var colW = columnWidth(column);
          for (var oni2 = 0; oni2 < column.names.length; oni2++) {
            var colEntry = entries[column.names[oni2]];
            colEntry.x = cursorX + (colW - colEntry.box.width) / 2;
          }
          cursorX += colW + effectiveGapX;
        }
      }
    }

    // ── Place ports to minimize crossings and avoidable bends ──
    var desiredPortY = {};
    function portKey(compName, alias) {
      return compName + '.' + alias;
    }
    function pushDesiredPortY(compName, alias, y) {
      var key = portKey(compName, alias);
      if (!desiredPortY[key]) desiredPortY[key] = [];
      desiredPortY[key].push(y);
    }
    function averagePortY(key) {
      var values = desiredPortY[key];
      if (!values || !values.length) return null;
      var total = 0;
      for (var vi = 0; vi < values.length; vi++) total += values[vi];
      return total / values.length;
    }
    function defaultPortSide(compName, portDef) {
      if (portDef.kind === 'provide') return 'left';
      if (portDef.kind === 'require') return 'right';
      if (portDef.direction === 'in') return 'left';
      if (portDef.direction === 'out') return 'right';
      return portSides[compName + '.' + portDef.alias] || 'right';
    }
    function chooseInitialPortSide(entry, portDef, partnerCenterX) {
      var preferred = defaultPortSide(entry.comp.name, portDef);
      if (partnerCenterX === null || partnerCenterX === undefined) return preferred;
      var centerX = entry.x + entry.box.width / 2;
      if (partnerCenterX < centerX - 18) return 'left';
      if (partnerCenterX > centerX + 18) return 'right';
      return preferred;
    }
    function rebuildDesiredPortY(useActualPartnerPorts) {
      desiredPortY = {};
      for (var ri = 0; ri < connectors.length; ri++) {
        var rc = connectors[ri];
        if (!entries[rc.from] || !entries[rc.to]) continue;

        var fromEntry = entries[rc.from];
        var toEntry = entries[rc.to];
        var fromPartnerY = toEntry.y + toEntry.box.height / 2;
        var toPartnerY = fromEntry.y + fromEntry.box.height / 2;

        if (useActualPartnerPorts && rc.fromPort && rc.toPort &&
            fromEntry.portPositions[rc.fromPort] && toEntry.portPositions[rc.toPort]) {
          var sharedPairY = (fromEntry.portPositions[rc.fromPort].cy + toEntry.portPositions[rc.toPort].cy) / 2;
          pushDesiredPortY(rc.from, rc.fromPort, sharedPairY);
          pushDesiredPortY(rc.to, rc.toPort, sharedPairY);
          continue;
        }

        if (useActualPartnerPorts && rc.toPort && toEntry.portPositions[rc.toPort]) {
          fromPartnerY = toEntry.portPositions[rc.toPort].cy;
        }
        if (useActualPartnerPorts && rc.fromPort && fromEntry.portPositions[rc.fromPort]) {
          toPartnerY = fromEntry.portPositions[rc.fromPort].cy;
        }

        if (rc.fromPort) pushDesiredPortY(rc.from, rc.fromPort, fromPartnerY);
        if (rc.toPort) pushDesiredPortY(rc.to, rc.toPort, toPartnerY);
      }
    }

    for (var pn in entries) {
      var pe = entries[pn];
      var newLeftPorts = [];
      var newRightPorts = [];
      for (var pidx = 0; pidx < pe.comp.ports.length; pidx++) {
        var portDef = pe.comp.ports[pidx];
        var partnerCenterX = null;
        for (var cpi = 0; cpi < connectors.length; cpi++) {
          var connHint = connectors[cpi];
          if (connHint.from === pn && connHint.fromPort === portDef.alias && entries[connHint.to]) {
            partnerCenterX = entries[connHint.to].x + entries[connHint.to].box.width / 2;
            break;
          }
          if (connHint.to === pn && connHint.toPort === portDef.alias && entries[connHint.from]) {
            partnerCenterX = entries[connHint.from].x + entries[connHint.from].box.width / 2;
            break;
          }
        }
        var side = chooseInitialPortSide(pe, portDef, partnerCenterX);
        if (side === 'left') newLeftPorts.push(portDef.alias);
        else newRightPorts.push(portDef.alias);
      }
      pe.leftPorts = newLeftPorts;
      pe.rightPorts = newRightPorts;
    }

    // Compute port positions (after x,y are finalized and ports are reordered)
    var portHalf = CFG.portSize / 2;
    var nameAreaH = CFG.lineHeight + CFG.padY;
    function computeOrderedPortCenters(entry, sidePorts, portTop, portAreaH) {
      var centers = {};
      if (!sidePorts.length) return centers;
      var lower = portTop + portHalf + 4;
      var upper = portTop + portAreaH - portHalf - 4;
      if (sidePorts.length === 1) {
        var onlyKey = portKey(entry.comp.name, sidePorts[0]);
        var onlyDesiredY = averagePortY(onlyKey);
        centers[sidePorts[0]] = onlyDesiredY === null ? (lower + upper) / 2 : Math.max(lower, Math.min(upper, onlyDesiredY));
        return centers;
      }
      var span = Math.max(0, upper - lower);
      var desired = [];
      for (var i2 = 0; i2 < sidePorts.length; i2++) {
        var currentKey = portKey(entry.comp.name, sidePorts[i2]);
        var fallback = lower + span * (i2 / (sidePorts.length - 1));
        var sampleY = averagePortY(currentKey);
        desired.push(sampleY === null ? fallback : Math.max(lower, Math.min(upper, sampleY)));
      }
      var minGap = span / Math.max(1, sidePorts.length - 1);
      minGap = Math.min(minGap, Math.max(CFG.portSize + 8, CFG.portPad * 0.72));
      var actual = desired.slice();
      for (var pass = 0; pass < 4; pass++) {
        actual[0] = Math.max(lower, Math.min(actual[0], upper - minGap * (sidePorts.length - 1)));
        for (var ai = 1; ai < actual.length; ai++) actual[ai] = Math.max(actual[ai], actual[ai - 1] + minGap);
        actual[actual.length - 1] = Math.min(upper, actual[actual.length - 1]);
        for (var bi = actual.length - 2; bi >= 0; bi--) actual[bi] = Math.min(actual[bi], actual[bi + 1] - minGap);
      }
      if (actual[0] < lower - 0.5 || actual[actual.length - 1] > upper + 0.5) {
        actual = [];
        for (var ei2 = 0; ei2 < sidePorts.length; ei2++) actual.push(lower + span * (ei2 / (sidePorts.length - 1)));
      }
      for (var ci2 = 0; ci2 < sidePorts.length; ci2++) centers[sidePorts[ci2]] = actual[ci2];
      return centers;
    }
    function groupKey(compName, side) {
      return compName + ':' + side;
    }
    function optimizePortConnectionGraphOrder() {
      var portNeighbors = {};
      var groupPositions = {};
      var groups = [];
      var processedGroups = {};
      var stableTieThreshold = Math.max(8, CFG.portPad * 0.35);

      function pushNeighbor(fromPortKey, toPortKey, toGroupKey) {
        if (!portNeighbors[fromPortKey]) portNeighbors[fromPortKey] = [];
        portNeighbors[fromPortKey].push({ portKey: toPortKey, groupKey: toGroupKey });
      }

      function portTopForEntry(entry) {
        return entry.hasPorts ? entry.y + nameAreaH : entry.y;
      }

      function portAreaHeightForEntry(entry) {
        return entry.box.height - (entry.hasPorts ? nameAreaH : 0);
      }

      function computeGroupCenters(entry, side, ports) {
        return computeOrderedPortCenters(entry, ports, portTopForEntry(entry), portAreaHeightForEntry(entry));
      }

      function buildProvisionalPortCenters() {
        var provisional = {};
        for (var provisionalName in entries) {
          var provisionalEntry = entries[provisionalName];
          var provisionalLeft = computeGroupCenters(provisionalEntry, 'left', provisionalEntry.leftPorts);
          var provisionalRight = computeGroupCenters(provisionalEntry, 'right', provisionalEntry.rightPorts);
          for (var pli = 0; pli < provisionalEntry.leftPorts.length; pli++) {
            var leftAlias = provisionalEntry.leftPorts[pli];
            provisional[portKey(provisionalName, leftAlias)] = provisionalLeft[leftAlias];
          }
          for (var pri = 0; pri < provisionalEntry.rightPorts.length; pri++) {
            var rightAlias = provisionalEntry.rightPorts[pri];
            provisional[portKey(provisionalName, rightAlias)] = provisionalRight[rightAlias];
          }
        }
        return provisional;
      }

      function updateProvisionalGroupCenters(provisionalCenters, group) {
        var provisionalEntry = entries[group.compName];
        var orderedPorts = group.side === 'left' ? provisionalEntry.leftPorts : provisionalEntry.rightPorts;
        var centers = computeGroupCenters(provisionalEntry, group.side, orderedPorts);
        for (var ci = 0; ci < orderedPorts.length; ci++) {
          var alias = orderedPorts[ci];
          provisionalCenters[portKey(group.compName, alias)] = centers[alias];
        }
      }

      for (var entryName in entries) {
        var entry = entries[entryName];
        if (entry.leftPorts.length) {
          var leftKey = groupKey(entryName, 'left');
          groupPositions[leftKey] = entry.x;
          groups.push({ compName: entryName, side: 'left', key: leftKey, x: entry.x });
        }
        if (entry.rightPorts.length) {
          var rightKey = groupKey(entryName, 'right');
          groupPositions[rightKey] = entry.x + entry.box.width;
          groups.push({ compName: entryName, side: 'right', key: rightKey, x: entry.x + entry.box.width });
        }
      }

      for (var ci4 = 0; ci4 < connectors.length; ci4++) {
        var conn4 = connectors[ci4];
        if (!conn4.fromPort || !conn4.toPort) continue;
        var fromEntry4 = entries[conn4.from];
        var toEntry4 = entries[conn4.to];
        if (!fromEntry4 || !toEntry4) continue;

        var fromSide = fromEntry4.leftPorts.indexOf(conn4.fromPort) >= 0 ? 'left' : 'right';
        var toSide = toEntry4.leftPorts.indexOf(conn4.toPort) >= 0 ? 'left' : 'right';
        var fromPortKey = portKey(conn4.from, conn4.fromPort);
        var toPortKey = portKey(conn4.to, conn4.toPort);
        pushNeighbor(fromPortKey, toPortKey, groupKey(conn4.to, toSide));
        pushNeighbor(toPortKey, fromPortKey, groupKey(conn4.from, fromSide));
      }

      groups.sort(function(a, b) {
        if (Math.abs(a.x - b.x) > 1) return a.x - b.x;
        if (a.side !== b.side) return a.side === 'left' ? -1 : 1;
        return a.compName < b.compName ? -1 : 1;
      });

      var provisionalCenters = buildProvisionalPortCenters();

      function buildPortRankMap() {
        var ranks = {};
        for (var name in entries) {
          var currentEntry = entries[name];
          for (var li = 0; li < currentEntry.leftPorts.length; li++) {
            ranks[portKey(name, currentEntry.leftPorts[li])] = li;
          }
          for (var ri = 0; ri < currentEntry.rightPorts.length; ri++) {
            ranks[portKey(name, currentEntry.rightPorts[ri])] = ri;
          }
        }
        return ranks;
      }

      function getGroupPorts(group) {
        var currentEntry = entries[group.compName];
        return group.side === 'left' ? currentEntry.leftPorts.slice() : currentEntry.rightPorts.slice();
      }

      function setGroupPorts(group, orderedPorts) {
        var currentEntry = entries[group.compName];
        if (group.side === 'left') currentEntry.leftPorts = orderedPorts;
        else currentEntry.rightPorts = orderedPorts;
      }

      function orderCost(entry, side, candidate, desiredYMap) {
        var candidateCenters = computeGroupCenters(entry, side, candidate);
        var score = 0;
        for (var i = 0; i < candidate.length; i++) {
          var alias = candidate[i];
          if (desiredYMap.hasOwnProperty(alias)) {
            score += Math.abs(candidateCenters[alias] - desiredYMap[alias]);
          }
          score += ((entry.portOrderIndex[alias] || 0) * 0.001);
        }
        // Penalize crossings: if port A is above port B in the candidate order
        // but A's desired Y is below B's desired Y, the connector lines will cross.
        // Apply a large penalty per crossing to strongly discourage them.
        for (var ai = 0; ai < candidate.length - 1; ai++) {
          var aAlias = candidate[ai];
          if (!desiredYMap.hasOwnProperty(aAlias)) continue;
          for (var bi = ai + 1; bi < candidate.length; bi++) {
            var bAlias = candidate[bi];
            if (!desiredYMap.hasOwnProperty(bAlias)) continue;
            // Crossing: port ai is above port bi in layout, but desired Y says opposite
            if (desiredYMap[aAlias] > desiredYMap[bAlias] + stableTieThreshold) {
              score += 500;
            }
            if (Math.abs(desiredYMap[aAlias] - desiredYMap[bAlias]) >= stableTieThreshold) continue;
            if ((entry.portOrderIndex[aAlias] || 0) > (entry.portOrderIndex[bAlias] || 0)) {
              score += stableTieThreshold * 0.75;
            }
          }
        }
        return score;
      }

      for (var gi = 0; gi < groups.length; gi++) {
        var group = groups[gi];
        var entry = entries[group.compName];
        var currentPorts = getGroupPorts(group);
        if (currentPorts.length < 2) continue;

        var portRanks = buildPortRankMap();
        var desiredYMap = {};
        var desiredCount = 0;

        for (var pi3 = 0; pi3 < currentPorts.length; pi3++) {
          var alias = currentPorts[pi3];
          var neighbors = portNeighbors[portKey(group.compName, alias)] || [];
          var total = 0;
          var count = 0;
          for (var ni = 0; ni < neighbors.length; ni++) {
            var neighbor = neighbors[ni];
            if (!processedGroups[neighbor.groupKey]) continue;
            if (provisionalCenters[neighbor.portKey] !== undefined) {
              total += provisionalCenters[neighbor.portKey];
              count++;
              continue;
            }
            if (portRanks[neighbor.portKey] === undefined) continue;
            var fallbackPortY = averagePortY(neighbor.portKey);
            if (fallbackPortY === null) continue;
            total += fallbackPortY;
            count++;
          }
          if (count > 0) {
            desiredYMap[alias] = total / count;
            desiredCount++;
            continue;
          }

          var globalDesiredY = averagePortY(portKey(group.compName, alias));
          if (globalDesiredY !== null) {
            desiredYMap[alias] = globalDesiredY;
            desiredCount++;
          }
        }

        if (!desiredCount) {
          processedGroups[group.key] = true;
          updateProvisionalGroupCenters(provisionalCenters, group);
          continue;
        }

        var ordered = currentPorts.slice();
        ordered.sort(function(a, b) {
          var ay = desiredYMap.hasOwnProperty(a) ? desiredYMap[a] : Number.POSITIVE_INFINITY;
          var by = desiredYMap.hasOwnProperty(b) ? desiredYMap[b] : Number.POSITIVE_INFINITY;
          if (Math.abs(ay - by) > stableTieThreshold) return ay - by;
          return (entry.portOrderIndex[a] || 0) - (entry.portOrderIndex[b] || 0);
        });
        var improved = true;
        while (improved) {
          improved = false;
          for (var swapIdx = 0; swapIdx < ordered.length - 1; swapIdx++) {
            var currentScore = orderCost(entry, group.side, ordered, desiredYMap);
            var swapped = ordered.slice();
            var temp = swapped[swapIdx];
            swapped[swapIdx] = swapped[swapIdx + 1];
            swapped[swapIdx + 1] = temp;
            var swappedScore = orderCost(entry, group.side, swapped, desiredYMap);
            if (swappedScore + 0.01 < currentScore) {
              ordered = swapped;
              improved = true;
            }
          }
        }

        setGroupPorts(group, ordered);
        processedGroups[group.key] = true;
        updateProvisionalGroupCenters(provisionalCenters, group);
      }
    }

    rebuildDesiredPortY(false);
    for (var layoutPass = 0; layoutPass < 3; layoutPass++) {
      optimizePortConnectionGraphOrder();

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

        e.portPositions = {};

        var portTop = e.hasPorts ? by + nameAreaH : by;
        var portAreaH = bh - (e.hasPorts ? nameAreaH : 0);
        var leftCenters = computeOrderedPortCenters(e, e.leftPorts, portTop, portAreaH);
        var rightCenters = computeOrderedPortCenters(e, e.rightPorts, portTop, portAreaH);

        for (var lpi2 = 0; lpi2 < e.leftPorts.length; lpi2++) {
          var lpn = e.leftPorts[lpi2];
          var pcy = leftCenters[lpn];
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
          var pcy2 = rightCenters[rpn];
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

      if (layoutPass < 2) rebuildDesiredPortY(true);
    }

    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    var portLabelFs = CFG.fontSize - 1;
    for (var en2 in entries) {
      var e2 = entries[en2];
      minX = Math.min(minX, e2.x);
      minY = Math.min(minY, e2.y);
      maxX = Math.max(maxX, e2.x + e2.box.width);
      maxY = Math.max(maxY, e2.y + e2.box.height);

      for (var pn2 in e2.portPositions) {
        var pp2 = e2.portPositions[pn2];
        if (pp2.kind === 'provide' || pp2.kind === 'require') {
          var sideFactor = pp2.side === 'left' ? -1 : 1;
          var symbolRadius = pp2.kind === 'require' ? CFG.ifaceSocketRadius : CFG.ifaceRadius;
          var ifaceCenterX = pp2.cx + sideFactor * (CFG.ifaceStick + symbolRadius);
          var ifaceRadius = symbolRadius + 2;
          // Labels are centered below the symbol
          var ifaceLabelHalf = UMLShared.textWidth(pp2.label || pn2, false, portLabelFs) / 2 + 4;
          minX = Math.min(minX, ifaceCenterX - Math.max(symbolRadius, ifaceLabelHalf));
          maxX = Math.max(maxX, ifaceCenterX + Math.max(symbolRadius, ifaceLabelHalf));
          minY = Math.min(minY, pp2.cy - symbolRadius);
          maxY = Math.max(maxY, pp2.cy + symbolRadius + portLabelFs + 6);
        } else {
          minX = Math.min(minX, pp2.x);
          minY = Math.min(minY, pp2.y);
          maxX = Math.max(maxX, pp2.x + CFG.portSize);
          maxY = Math.max(maxY, pp2.y + CFG.portSize);
        }
      }
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
      height: maxY - minY + 20,
      offsetX: -minX,
      offsetY: -minY,
      layoutResult: result
    };
  }

  // ─── Obstacle-aware orthogonal routing helpers ─────────────────────

  var ROUTE_LANE_STEP = 14;
  var ROUTE_LANE_CLEARANCE = 6;
  var ROUTE_TRACK_MIN_LEN = 24;
  var COMPONENT_SIDE_ANCHOR_PAD = 10;

  function rangesOverlap(a1, a2, b1, b2, minOverlap) {
    var overlap = Math.min(Math.max(a1, a2), Math.max(b1, b2)) -
      Math.max(Math.min(a1, a2), Math.min(b1, b2));
    return overlap > (minOverlap || 0);
  }

  function hSegHitsOccupied(y, xMin, xMax, occupied) {
    if (!occupied) return false;
    for (var i = 0; i < occupied.h.length; i++) {
      var seg = occupied.h[i];
      if (Math.abs(seg.y - y) < ROUTE_LANE_CLEARANCE &&
          rangesOverlap(xMin, xMax, seg.x1, seg.x2, 6)) {
        return true;
      }
    }
    return false;
  }

  function vSegHitsOccupied(x, yMin, yMax, occupied) {
    if (!occupied) return false;
    for (var i = 0; i < occupied.v.length; i++) {
      var seg = occupied.v[i];
      if (Math.abs(seg.x - x) < ROUTE_LANE_CLEARANCE &&
          rangesOverlap(yMin, yMax, seg.y1, seg.y2, 6)) {
        return true;
      }
    }
    return false;
  }

  // Check if a route (array of {x,y} points forming orthogonal segments)
  // intersects any obstacle rect, skipping obstacles named in skipNames.
  function routeHitsObstacle(points, obstacles, skipNames, occupied) {
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
        if (vSegHitsOccupied(p0.x, yMin, yMax, occupied)) return true;
      } else {
        // Horizontal segment
        var xMin = Math.min(p0.x, p1.x), xMax = Math.max(p0.x, p1.x);
        for (var j2 = 0; j2 < obstacles.length; j2++) {
          var ob2 = obstacles[j2];
          if (skipNames && skipNames[ob2.name]) continue;
          if (p0.y > ob2.y1 && p0.y < ob2.y2 && xMax > ob2.x1 && xMin < ob2.x2) return true;
        }
        if (hSegHitsOccupied(p0.y, xMin, xMax, occupied)) return true;
      }
    }
    return false;
  }

  // Find nearest clear X for a vertical segment in [yMin,yMax]
  function findClearX(yMin, yMax, preferX, obstacles, skipNames, occupied) {
    function isBlocked(candidateX) {
      for (var j = 0; j < obstacles.length; j++) {
        var ob = obstacles[j];
        if (skipNames && skipNames[ob.name]) continue;
        if (candidateX > ob.x1 && candidateX < ob.x2 && yMax > ob.y1 && yMin < ob.y2) return true;
      }
      return vSegHitsOccupied(candidateX, yMin, yMax, occupied);
    }

    if (!isBlocked(preferX)) return preferX;
    for (var d = ROUTE_LANE_STEP; d < 1600; d += ROUTE_LANE_STEP) {
      var tryR = preferX + d, tryL = preferX - d;
      if (!isBlocked(tryR)) return tryR;
      if (!isBlocked(tryL)) return tryL;
    }
    return preferX;
  }

  // Find nearest clear Y for a horizontal segment in [xMin,xMax]
  function findClearY(xMin, xMax, preferY, obstacles, skipNames, occupied) {
    function isBlocked(candidateY) {
      for (var j = 0; j < obstacles.length; j++) {
        var ob = obstacles[j];
        if (skipNames && skipNames[ob.name]) continue;
        if (candidateY > ob.y1 && candidateY < ob.y2 && xMax > ob.x1 && xMin < ob.x2) return true;
      }
      return hSegHitsOccupied(candidateY, xMin, xMax, occupied);
    }

    if (!isBlocked(preferY)) return preferY;
    for (var d = ROUTE_LANE_STEP; d < 1600; d += ROUTE_LANE_STEP) {
      var tryD = preferY + d, tryU = preferY - d;
      if (!isBlocked(tryD)) return tryD;
      if (!isBlocked(tryU)) return tryU;
    }
    return preferY;
  }

  function reserveRoute(points, occupied) {
    if (!occupied) return;
    for (var i = 0; i < points.length - 1; i++) {
      var p0 = points[i], p1 = points[i + 1];
      if (Math.abs(p0.x - p1.x) < 1) {
        var y1 = Math.min(p0.y, p1.y), y2 = Math.max(p0.y, p1.y);
        if ((y2 - y1) >= ROUTE_TRACK_MIN_LEN) {
          occupied.v.push({ x: p0.x, y1: y1, y2: y2 });
        }
      } else if (Math.abs(p0.y - p1.y) < 1) {
        var x1 = Math.min(p0.x, p1.x), x2 = Math.max(p0.x, p1.x);
        if ((x2 - x1) >= ROUTE_TRACK_MIN_LEN) {
          occupied.h.push({ y: p0.y, x1: x1, x2: x2 });
        }
      }
    }
  }

  function spreadRouteToFreeLanes(points, obstacles, skipNames, occupied) {
    if (!occupied || points.length < 4) return points;

    var adjusted = [];
    for (var i = 0; i < points.length; i++) adjusted.push({ x: points[i].x, y: points[i].y });

    for (var pass = 0; pass < 2; pass++) {
      var moved = false;
      for (var si = 1; si < adjusted.length - 2; si++) {
        var p0 = adjusted[si], p1 = adjusted[si + 1];
        if (Math.abs(p0.y - p1.y) < 1) {
          var xMin = Math.min(p0.x, p1.x), xMax = Math.max(p0.x, p1.x);
          if (hSegHitsOccupied(p0.y, xMin, xMax, occupied)) {
            var clearY = findClearY(xMin, xMax, p0.y, obstacles, skipNames, occupied);
            if (Math.abs(clearY - p0.y) >= 1) {
              adjusted[si].y = clearY;
              adjusted[si + 1].y = clearY;
              moved = true;
            }
          }
        } else if (Math.abs(p0.x - p1.x) < 1) {
          var yMin = Math.min(p0.y, p1.y), yMax = Math.max(p0.y, p1.y);
          if (vSegHitsOccupied(p0.x, yMin, yMax, occupied)) {
            var clearX = findClearX(yMin, yMax, p0.x, obstacles, skipNames, occupied);
            if (Math.abs(clearX - p0.x) >= 1) {
              adjusted[si].x = clearX;
              adjusted[si + 1].x = clearX;
              moved = true;
            }
          }
        }
      }
      adjusted = simplifyRoute(adjusted);
      if (!moved) break;
    }

    return adjusted;
  }

  function getPreferredComponentSides(fromE, toE) {
    var fromCx = fromE.x + fromE.box.width / 2;
    var fromCy = fromE.y + fromE.box.height / 2;
    var toCx = toE.x + toE.box.width / 2;
    var toCy = toE.y + toE.box.height / 2;
    var dx = toCx - fromCx;
    var dy = toCy - fromCy;

    if (Math.abs(dx) > 5) {
      return {
        fromSide: dx > 0 ? 'right' : 'left',
        toSide: dx > 0 ? 'left' : 'right',
        fromCx: fromCx,
        fromCy: fromCy,
        toCx: toCx,
        toCy: toCy
      };
    }

    return {
      fromSide: dy > 0 ? 'bottom' : 'top',
      toSide: dy > 0 ? 'top' : 'bottom',
      fromCx: fromCx,
      fromCy: fromCy,
      toCx: toCx,
      toCy: toCy
    };
  }

  function buildComponentSideAnchors(connectors, entries) {
    var exitGroups = {};
    var entryGroups = {};

    function pushGroup(groupMap, key, item) {
      if (!groupMap[key]) groupMap[key] = [];
      groupMap[key].push(item);
    }

    function sortGroup(items) {
      items.sort(function(a, b) {
        if (a.primary !== b.primary) return a.primary - b.primary;
        if (a.secondary !== b.secondary) return a.secondary - b.secondary;
        return a.index - b.index;
      });
    }

    function assignAnchors(groupMap) {
      var assigned = {};

      for (var key in groupMap) {
        var splitAt = key.lastIndexOf(':');
        var compName = key.substring(0, splitAt);
        var side = key.substring(splitAt + 1);
        var compEntry = entries[compName];
        if (!compEntry) continue;

        var items = groupMap[key];
        sortGroup(items);

        var isVerticalSide = (side === 'left' || side === 'right');
        var axisStart = isVerticalSide ? compEntry.y + COMPONENT_SIDE_ANCHOR_PAD : compEntry.x + COMPONENT_SIDE_ANCHOR_PAD;
        var axisEnd = isVerticalSide ? compEntry.y + compEntry.box.height - COMPONENT_SIDE_ANCHOR_PAD : compEntry.x + compEntry.box.width - COMPONENT_SIDE_ANCHOR_PAD;

        if (axisEnd < axisStart) {
          var axisCenter = isVerticalSide ? compEntry.y + compEntry.box.height / 2 : compEntry.x + compEntry.box.width / 2;
          axisStart = axisCenter;
          axisEnd = axisCenter;
        }

        var span = axisEnd - axisStart;
        for (var i = 0; i < items.length; i++) {
          var pos;
          if (items.length === 1 || span <= 0) {
            pos = (axisStart + axisEnd) / 2;
          } else {
            pos = axisStart + span * (i / (items.length - 1));
          }

          assigned[items[i].index] = isVerticalSide
            ? {
                x: side === 'left' ? compEntry.x : compEntry.x + compEntry.box.width,
                y: pos,
                side: side
              }
            : {
                x: pos,
                y: side === 'top' ? compEntry.y : compEntry.y + compEntry.box.height,
                side: side
              };
        }
      }

      return assigned;
    }

    for (var ci = 0; ci < connectors.length; ci++) {
      var conn = connectors[ci];
      if (conn.fromPort || conn.toPort) continue;

      var fromE = entries[conn.from];
      var toE = entries[conn.to];
      if (!fromE || !toE) continue;

      var pref = getPreferredComponentSides(fromE, toE);
      var exitKey = conn.from + ':' + pref.fromSide;
      var entryKey = conn.to + ':' + pref.toSide;
      var exitPrimary = (pref.fromSide === 'left' || pref.fromSide === 'right') ? pref.toCy : pref.toCx;
      var exitSecondary = (pref.fromSide === 'left' || pref.fromSide === 'right') ? pref.toCx : pref.toCy;
      var entryPrimary = (pref.toSide === 'left' || pref.toSide === 'right') ? pref.fromCy : pref.fromCx;
      var entrySecondary = (pref.toSide === 'left' || pref.toSide === 'right') ? pref.fromCx : pref.fromCy;

      pushGroup(exitGroups, exitKey, { index: ci, primary: exitPrimary, secondary: exitSecondary });
      pushGroup(entryGroups, entryKey, { index: ci, primary: entryPrimary, secondary: entrySecondary });
    }

    return {
      exits: assignAnchors(exitGroups),
      entries: assignAnchors(entryGroups)
    };
  }

  function makeLabelRect(x, y, labelW, labelH, anchor) {
    var left = anchor === 'middle' ? x - labelW / 2 : (anchor === 'end' ? x - labelW : x);
    return {
      left: left,
      right: left + labelW,
      top: y - labelH,
      bottom: y + 4
    };
  }

  function rectsOverlap(a, b, pad) {
    var gap = pad || 0;
    return a.right + gap > b.left && a.left - gap < b.right &&
      a.bottom + gap > b.top && a.top - gap < b.bottom;
  }

  function obstacleToRect(obstacle) {
    return {
      left: obstacle.x1,
      right: obstacle.x2,
      top: obstacle.y1,
      bottom: obstacle.y2
    };
  }

  function intervalGap(a1, a2, b1, b2) {
    if (a2 < b1) return b1 - a2;
    if (b2 < a1) return a1 - b2;
    return 0;
  }

  function rectDistance(a, b) {
    var dx = intervalGap(a.left, a.right, b.left, b.right);
    var dy = intervalGap(a.top, a.bottom, b.top, b.bottom);
    if (dx === 0 && dy === 0) return 0;
    if (dx === 0) return dy;
    if (dy === 0) return dx;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function segmentDistanceToRect(segment, rect) {
    var dx, dy;
    if (segment.isH) {
      dx = intervalGap(rect.left, rect.right, segment.x1, segment.x2);
      dy = intervalGap(rect.top, rect.bottom, segment.y, segment.y);
    } else {
      dx = intervalGap(rect.left, rect.right, segment.x, segment.x);
      dy = intervalGap(rect.top, rect.bottom, segment.y1, segment.y2);
    }
    if (dx === 0 && dy === 0) return 0;
    if (dx === 0) return dy;
    if (dy === 0) return dx;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function buildComponentRouteSegments(routes) {
    var segments = [];
    for (var ri = 0; ri < routes.length; ri++) {
      var route = routes[ri];
      for (var si = 0; si < route.points.length - 1; si++) {
        var p0 = route.points[si], p1 = route.points[si + 1];
        if (Math.abs(p0.y - p1.y) < 1) {
          segments.push({
            routeIndex: route.routeIndex,
            segmentIndex: si,
            isH: true,
            x1: Math.min(p0.x, p1.x),
            x2: Math.max(p0.x, p1.x),
            y: p0.y
          });
        } else if (Math.abs(p0.x - p1.x) < 1) {
          segments.push({
            routeIndex: route.routeIndex,
            segmentIndex: si,
            isH: false,
            x: p0.x,
            y1: Math.min(p0.y, p1.y),
            y2: Math.max(p0.y, p1.y)
          });
        }
      }
    }
    return segments;
  }

  function labelRectHitsObstacles(rect, obstacles, pad) {
    for (var i = 0; i < obstacles.length; i++) {
      if (rectsOverlap(rect, obstacleToRect(obstacles[i]), pad)) return true;
    }
    return false;
  }

  function labelRectHitsPlacedLabels(rect, placedLabels, pad) {
    for (var i = 0; i < placedLabels.length; i++) {
      if (rectsOverlap(rect, placedLabels[i], pad)) return true;
    }
    return false;
  }

  function labelRectHitsSegments(rect, routeSegments, routeIndex, segmentIndex, pad) {
    var gap = pad || 0;
    for (var i = 0; i < routeSegments.length; i++) {
      var segment = routeSegments[i];
      if (segment.routeIndex === routeIndex && segment.segmentIndex === segmentIndex) continue;
      if (segment.isH) {
        if (segment.y >= rect.top - gap && segment.y <= rect.bottom + gap &&
            segment.x2 > rect.left - gap && segment.x1 < rect.right + gap) {
          return true;
        }
      } else if (segment.x >= rect.left - gap && segment.x <= rect.right + gap &&
                 segment.y2 > rect.top - gap && segment.y1 < rect.bottom + gap) {
        return true;
      }
    }
    return false;
  }

  function minLabelClearance(rect, obstacles, placedLabels, routeSegments, routeIndex, segmentIndex) {
    var min = Infinity;
    for (var i = 0; i < obstacles.length; i++) {
      min = Math.min(min, rectDistance(rect, obstacleToRect(obstacles[i])));
    }
    for (var j = 0; j < placedLabels.length; j++) {
      min = Math.min(min, rectDistance(rect, placedLabels[j]));
    }
    for (var k = 0; k < routeSegments.length; k++) {
      var segment = routeSegments[k];
      if (segment.routeIndex === routeIndex && segment.segmentIndex === segmentIndex) continue;
      min = Math.min(min, segmentDistanceToRect(segment, rect));
    }
    return isFinite(min) ? min : 120;
  }

  function placeComponentConnectorLabel(label, points, routeIndex, obstacles, placedLabels, routeSegments, cfg, options) {
    var opts = options || {};
    var labelW = UMLShared.textWidth(label, false, cfg.fontSize);
    var labelH = cfg.fontSize + 6;
    var segments = [];
    for (var si = 0; si < points.length - 1; si++) {
      var p0 = points[si], p1 = points[si + 1];
      var length = Math.abs(p1.x - p0.x) + Math.abs(p1.y - p0.y);
      if (length < 8) continue;
      segments.push({
        segmentIndex: si,
        isH: Math.abs(p1.y - p0.y) < 1,
        length: length,
        x1: Math.min(p0.x, p1.x),
        x2: Math.max(p0.x, p1.x),
        y1: Math.min(p0.y, p1.y),
        y2: Math.max(p0.y, p1.y),
        x: p0.x,
        y: p0.y
      });
    }

    segments.sort(function(a, b) {
      if (a.isH !== b.isH) return a.isH ? -1 : 1;
      if (b.length !== a.length) return b.length - a.length;
      return a.segmentIndex - b.segmentIndex;
    });

    var fractions = [0.5, 0.35, 0.65, 0.22, 0.78];
    var best = null;
    var bestSoft = null;

    for (var gi = 0; gi < segments.length; gi++) {
      var segment = segments[gi];
      var placements = segment.isH
        ? [
            { anchor: 'middle', dx: 0, dy: -10, penalty: 0, vSide: 'above' },
            { anchor: 'middle', dx: 0, dy: labelH + 4, penalty: 8, vSide: 'below' }
          ]
        : [
            { anchor: 'start', dx: 10, dy: 0, penalty: 2 },
            { anchor: 'end', dx: -10, dy: 0, penalty: 6 }
          ];

      for (var pi = 0; pi < placements.length; pi++) {
        var placement = placements[pi];
        for (var fi = 0; fi < fractions.length; fi++) {
          var fraction = fractions[fi];
          var lx, ly;
          if (segment.isH) {
            lx = segment.x1 + (segment.x2 - segment.x1) * fraction + placement.dx;
            ly = segment.y + placement.dy;
          } else {
            lx = segment.x + placement.dx;
            ly = segment.y1 + (segment.y2 - segment.y1) * fraction + placement.dy;
          }

          var rect = makeLabelRect(lx, ly, labelW, labelH, placement.anchor);
          if (labelRectHitsObstacles(rect, obstacles, 6)) continue;
          if (labelRectHitsPlacedLabels(rect, placedLabels, 8)) continue;
          var hitsSegments = labelRectHitsSegments(rect, routeSegments, routeIndex, segment.segmentIndex, 3);

          var clearance = minLabelClearance(rect, obstacles, placedLabels, routeSegments, routeIndex, segment.segmentIndex);
          var score = segment.length * 2 + (segment.isH ? 24 : 0) + Math.min(clearance, 80) -
            Math.abs(fraction - 0.5) * 30 - placement.penalty;

          if (segment.isH && opts.preferredVerticalSide) {
            if (placement.vSide === opts.preferredVerticalSide) score += 18;
            else score -= 18;
          }

          var candidate = {
            x: lx,
            y: ly,
            anchor: placement.anchor,
            rect: rect,
            score: score
          };

          if (hitsSegments) {
            candidate.score -= 40;
            if (!bestSoft || candidate.score > bestSoft.score) {
              bestSoft = candidate;
            }
          } else if (!best || candidate.score > best.score) {
            best = {
              x: lx,
              y: ly,
              anchor: placement.anchor,
              rect: rect,
              score: score
            };
          }
        }
      }
    }

    if (best) return best;
    if (bestSoft) return bestSoft;
    if (!segments.length) return null;

    var fallbackSeg = segments[0];
    var fallbackAnchor = fallbackSeg.isH ? 'middle' : 'start';
    var fallbackX = fallbackSeg.isH ? (fallbackSeg.x1 + fallbackSeg.x2) / 2 : fallbackSeg.x + 10;
    var fallbackY = fallbackSeg.isH
      ? (opts.preferredVerticalSide === 'below' ? fallbackSeg.y + labelH + 4 : fallbackSeg.y - 10)
      : (fallbackSeg.y1 + fallbackSeg.y2) / 2;
    return {
      x: fallbackX,
      y: fallbackY,
      anchor: fallbackAnchor,
      rect: makeLabelRect(fallbackX, fallbackY, labelW, labelH, fallbackAnchor),
      score: -Infinity
    };
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
    var notePositions = UMLShared.computeAnchoredNotes(parsed.notes, entries);
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
    var labelSvg = [];
    var placedLabels = [];
    var placedRouteSegments = [];
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

    var occupiedSegments = { h: [], v: [] };
    var componentSideAnchors = buildComponentSideAnchors(connectors, entries);
    var portUsageCount = {};
    function componentPortUsageKey(compName, alias) {
      return compName + '.' + alias;
    }
    for (var puci = 0; puci < connectors.length; puci++) {
      var puc = connectors[puci];
      if (puc.fromPort) portUsageCount[componentPortUsageKey(puc.from, puc.fromPort)] = (portUsageCount[componentPortUsageKey(puc.from, puc.fromPort)] || 0) + 1;
      if (puc.toPort) portUsageCount[componentPortUsageKey(puc.to, puc.toPort)] = (portUsageCount[componentPortUsageKey(puc.to, puc.toPort)] || 0) + 1;
    }

    function snapshotPortPosition(pos) {
      return pos ? { y: pos.y, cy: pos.cy, connY: pos.connY } : null;
    }

    function restorePortPosition(pos, snapshot) {
      if (!pos || !snapshot) return;
      pos.y = snapshot.y;
      pos.cy = snapshot.cy;
      pos.connY = snapshot.connY;
    }

    function getPortMovementBounds(entry, alias) {
      var pos = entry && entry.portPositions ? entry.portPositions[alias] : null;
      if (!pos || (pos.side !== 'left' && pos.side !== 'right')) return null;
      if ((portUsageCount[componentPortUsageKey(entry.comp.name, alias)] || 0) !== 1) return null;

      var sidePorts = pos.side === 'left' ? entry.leftPorts : entry.rightPorts;
      var portIdx = sidePorts.indexOf(alias);
      if (portIdx < 0) return null;

      var headerHeight = CFG.lineHeight + CFG.padY;
      var portTop = entry.hasPorts ? entry.y + headerHeight : entry.y;
      var portAreaH = entry.box.height - (entry.hasPorts ? headerHeight : 0);
      var halfPort = CFG.portSize / 2;
      var lower = portTop + halfPort + 4;
      var upper = portTop + portAreaH - halfPort - 4;
      var minGap = Math.max(CFG.portSize + 8, CFG.portPad * 0.72);

      if (portIdx > 0) {
        var prevAlias = sidePorts[portIdx - 1];
        var prevPos = entry.portPositions[prevAlias];
        if (prevPos) lower = Math.max(lower, prevPos.cy + minGap);
      }
      if (portIdx < sidePorts.length - 1) {
        var nextAlias = sidePorts[portIdx + 1];
        var nextPos = entry.portPositions[nextAlias];
        if (nextPos) upper = Math.min(upper, nextPos.cy - minGap);
      }
      if (upper < lower) return null;

      return {
        pos: pos,
        lower: lower,
        upper: upper,
        halfPort: halfPort
      };
    }

    function movePortPositionToY(entry, alias, targetY) {
      var bounds = getPortMovementBounds(entry, alias);
      if (!bounds) return null;

      var pos = bounds.pos;
      var newY = Math.max(bounds.lower, Math.min(bounds.upper, targetY));
      if (Math.abs(newY - pos.cy) < 0.75) return null;

      var snapshot = snapshotPortPosition(pos);
      pos.cy = newY;
      pos.connY = newY;
      pos.y = newY - bounds.halfPort;
      return snapshot;
    }

    function clampComponentPortY(entry, alias, targetY) {
      var bounds = getPortMovementBounds(entry, alias);
      if (!bounds) return null;
      return Math.max(bounds.lower, Math.min(bounds.upper, targetY));
    }

    function componentEndpointX(pos, isJoinedAssembly) {
      if (!pos) return null;
      if (isJoinedAssembly) return pos.cx;
      if (pos.kind === 'provide') {
        return pos.side === 'right' ? pos.cx + CFG.ifaceStick + CFG.ifaceRadius : pos.cx - CFG.ifaceStick - CFG.ifaceRadius;
      }
      if (pos.kind === 'require') {
        return pos.side === 'right' ? pos.cx + CFG.ifaceStick : pos.cx - CFG.ifaceStick;
      }
      return pos.connX;
    }

    function buildComponentEndpointCandidates(entry, alias, pos, sideAnchor, otherEntry, otherPos, isJoinedAssembly, role) {
      var candidates = [];
      var stub = 20;

      function pushCandidate(candidate) {
        for (var i = 0; i < candidates.length; i++) {
          if (Math.abs(candidates[i].x - candidate.x) < 0.75 &&
              Math.abs(candidates[i].y - candidate.y) < 0.75 &&
              candidates[i].side === candidate.side) {
            return;
          }
        }
        candidates.push(candidate);
      }

      if (pos) {
        var preferredY = otherPos ? otherPos.cy : (otherEntry ? otherEntry.y + otherEntry.box.height / 2 : pos.cy);
        var desiredY = clampComponentPortY(entry, alias, preferredY);
        var candidateYs = [pos.cy];
        if (desiredY !== null) {
          candidateYs.push(desiredY);
          candidateYs.push((pos.cy + desiredY) / 2);
        }

        for (var yi = 0; yi < candidateYs.length; yi++) {
          var candidateY = desiredY === null ? pos.cy : clampComponentPortY(entry, alias, candidateYs[yi]);
          if (candidateY === null) candidateY = pos.cy;
          pushCandidate({
            x: componentEndpointX(pos, isJoinedAssembly),
            y: candidateY,
            side: pos.side,
            stub: stub,
            movePenalty: Math.abs(candidateY - pos.cy) * 0.5,
            apply: Math.abs(candidateY - pos.cy) > 0.75 ? function(entryRef, aliasRef, targetYRef) {
              return function() { movePortPositionToY(entryRef, aliasRef, targetYRef); };
            }(entry, alias, candidateY) : null
          });
        }
        return candidates;
      }

      if (sideAnchor) {
        pushCandidate({
          x: sideAnchor.x,
          y: sideAnchor.y,
          side: sideAnchor.side,
          stub: stub,
          movePenalty: 0,
          apply: null
        });
        if (otherEntry && (sideAnchor.side === 'left' || sideAnchor.side === 'right')) {
          var preferredAnchorY = Math.max(entry.y + COMPONENT_SIDE_ANCHOR_PAD, Math.min(entry.y + entry.box.height - COMPONENT_SIDE_ANCHOR_PAD, otherEntry.y + otherEntry.box.height / 2));
          pushCandidate({
            x: sideAnchor.x,
            y: preferredAnchorY,
            side: sideAnchor.side,
            stub: stub,
            movePenalty: Math.abs(preferredAnchorY - sideAnchor.y) * 0.18,
            apply: null
          });
        }
        if (otherEntry && (sideAnchor.side === 'top' || sideAnchor.side === 'bottom')) {
          var preferredAnchorX = Math.max(entry.x + COMPONENT_SIDE_ANCHOR_PAD, Math.min(entry.x + entry.box.width - COMPONENT_SIDE_ANCHOR_PAD, otherEntry.x + otherEntry.box.width / 2));
          pushCandidate({
            x: preferredAnchorX,
            y: sideAnchor.y,
            side: sideAnchor.side,
            stub: stub,
            movePenalty: Math.abs(preferredAnchorX - sideAnchor.x) * 0.18,
            apply: null
          });
        }
        return candidates;
      }

      if (otherEntry) {
        var pref = getPreferredComponentSides(entry, otherEntry);
        var side = role === 'target' ? pref.toSide : pref.fromSide;
        var fallbackX = side === 'left' ? entry.x : side === 'right' ? entry.x + entry.box.width : entry.x + entry.box.width / 2;
        var fallbackY = side === 'top' ? entry.y : side === 'bottom' ? entry.y + entry.box.height : entry.y + entry.box.height / 2;
        pushCandidate({ x: fallbackX, y: fallbackY, side: side, stub: stub, movePenalty: 0, apply: null });
      }

      return candidates;
    }

    function applySourceLaneSmoothing(points, newY) {
      var updated = [];
      for (var i = 0; i < points.length; i++) updated.push({ x: points[i].x, y: points[i].y });
      updated[0].y = newY;
      if (updated.length > 1) updated[1].y = newY;
      return simplifyRoute(updated);
    }

    function applyTargetLaneSmoothing(points, newY) {
      var updated = [];
      for (var i = 0; i < points.length; i++) updated.push({ x: points[i].x, y: points[i].y });
      updated[updated.length - 1].y = newY;
      if (updated.length > 1) updated[updated.length - 2].y = newY;
      return simplifyRoute(updated);
    }

    function refineRouteEndpoints(conn, points, fpPos, tpPos, skipNames) {
      if (!points || points.length < 2) return points;

      function tryCandidate(entry, alias, targetY, applyToPoints) {
        if (!entry || !alias) return null;
        var snapshot = movePortPositionToY(entry, alias, targetY);
        if (!snapshot) return null;
        var candidate = applyToPoints(points, entry.portPositions[alias].cy);
        // Check against box obstacles only (not occupied segments) — small port
        // movements to eliminate cosmetic doglegs should not be blocked by
        // nearby occupied lanes from other connectors.
        if (routeHitsObstacle(candidate, obstacles, skipNames, null)) {
          restorePortPosition(entry.portPositions[alias], snapshot);
          return null;
        }
        return candidate;
      }

      // Snap nearly horizontal links to the same Y when one endpoint can move slightly.
      // Handles both direct 2-point links and 4-point H-V-H doglegs with tiny V segments.
      var effectiveDy = 0;
      var isNearlyHorizontal = false;
      if (fpPos && tpPos) {
        if (points.length === 2) {
          effectiveDy = points[1].y - points[0].y;
          isNearlyHorizontal = Math.abs(effectiveDy) > 0.5 && Math.abs(effectiveDy) <= 8 &&
            Math.abs(points[1].x - points[0].x) > 24;
        } else if (points.length === 4) {
          // H-V-H dogleg: check if the V segment is tiny
          var hvhP0 = points[0], hvhP1 = points[1], hvhP2 = points[2], hvhP3 = points[3];
          var hvhFirstH = Math.abs(hvhP1.y - hvhP0.y) < 1;
          var hvhSecondV = Math.abs(hvhP2.x - hvhP1.x) < 1;
          var hvhThirdH = Math.abs(hvhP3.y - hvhP2.y) < 1;
          var hvhVLen = Math.abs(hvhP2.y - hvhP1.y);
          if (hvhFirstH && hvhSecondV && hvhThirdH && hvhVLen > 0.5 && hvhVLen <= 8) {
            effectiveDy = hvhP3.y - hvhP0.y;
            isNearlyHorizontal = true;
          }
        }
      }
      if (isNearlyHorizontal) {
        var bestDirect = null;
        var midY = (fpPos.cy + tpPos.cy) / 2;
        var directCandidates = [
          { entry: entries[conn.from], alias: conn.fromPort, targetY: tpPos.cy, apply: applySourceLaneSmoothing, move: Math.abs(tpPos.cy - fpPos.cy) },
          { entry: entries[conn.to], alias: conn.toPort, targetY: fpPos.cy, apply: applyTargetLaneSmoothing, move: Math.abs(fpPos.cy - tpPos.cy) },
          { entry: entries[conn.from], alias: conn.fromPort, targetY: midY, apply: applySourceLaneSmoothing, move: Math.abs(midY - fpPos.cy) },
          { entry: entries[conn.to], alias: conn.toPort, targetY: midY, apply: applyTargetLaneSmoothing, move: Math.abs(midY - tpPos.cy) }
        ];
        for (var dci = 0; dci < directCandidates.length; dci++) {
          var directCandidate = directCandidates[dci];
          var directPoints = tryCandidate(directCandidate.entry, directCandidate.alias, directCandidate.targetY, directCandidate.apply);
          if (!directPoints) continue;
          if (!bestDirect || directCandidate.move < bestDirect.move) {
            bestDirect = { points: directPoints, move: directCandidate.move };
          }
        }
        if (bestDirect) return bestDirect.points;
      }

      // Remove H-V-H doglegs near a source port by moving the port onto the horizontal lane.
      // Two tiers: very tiny vertical jogs (≤6px) are always removed regardless of
      // surrounding segment lengths; larger ones use stricter thresholds.
      if (fpPos && points.length >= 4) {
        var p0 = points[0], p1 = points[1], p2 = points[2], p3 = points[3];
        var firstIsH = Math.abs(p1.y - p0.y) < 1;
        var secondIsV = Math.abs(p2.x - p1.x) < 1;
        var thirdIsH = Math.abs(p3.y - p2.y) < 1;
        var firstLen = Math.abs(p1.x - p0.x) + Math.abs(p1.y - p0.y);
        var secondLen = Math.abs(p2.x - p1.x) + Math.abs(p2.y - p1.y);
        var thirdLen = Math.abs(p3.x - p2.x) + Math.abs(p3.y - p2.y);
        if (firstIsH && secondIsV && thirdIsH && secondLen <= 18 &&
            (secondLen <= 6 || (firstLen <= 36 && thirdLen >= 80))) {
          var sourceSmoothed = tryCandidate(entries[conn.from], conn.fromPort, p2.y, applySourceLaneSmoothing);
          if (sourceSmoothed) return sourceSmoothed;
        }
      }

      // Remove H-V-H doglegs near a target port by moving the target port onto the horizontal lane.
      if (tpPos && points.length >= 4) {
        var t3 = points[points.length - 4];
        var t2 = points[points.length - 3];
        var t1 = points[points.length - 2];
        var t0 = points[points.length - 1];
        var tailFirstIsH = Math.abs(t2.y - t3.y) < 1;
        var tailSecondIsV = Math.abs(t1.x - t2.x) < 1;
        var tailThirdIsH = Math.abs(t0.y - t1.y) < 1;
        var tailFirstLen = Math.abs(t2.x - t3.x) + Math.abs(t2.y - t3.y);
        var tailSecondLen = Math.abs(t1.x - t2.x) + Math.abs(t1.y - t2.y);
        var tailThirdLen = Math.abs(t0.x - t1.x) + Math.abs(t0.y - t1.y);
        if (tailFirstIsH && tailSecondIsV && tailThirdIsH && tailSecondLen <= 18 &&
            (tailSecondLen <= 6 || (tailThirdLen <= 36 && tailFirstLen >= 80))) {
          var targetSmoothed = tryCandidate(entries[conn.to], conn.toPort, t2.y, applyTargetLaneSmoothing);
          if (targetSmoothed) return targetSmoothed;
        }
      }

      return points;
    }

    // ── Draw connectors ──
    var placedLabels = [];
    var connectorRoutes = [];
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
        var exitAnchor = componentSideAnchors.exits[ci];
        if (exitAnchor) {
          x1 = exitAnchor.x;
          y1 = exitAnchor.y;
          dir1 = exitAnchor.side;
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
        var entryAnchor = componentSideAnchors.entries[ci];
        if (entryAnchor) {
          x2 = entryAnchor.x;
          y2 = entryAnchor.y;
          dir2 = entryAnchor.side;
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
      }

      // Skip source and target when checking obstacles
      var skipN = {};
      skipN[conn.from] = true;
      skipN[conn.to] = true;
      var sourceCandidates = buildComponentEndpointCandidates(fromE, conn.fromPort, fpPos, exitAnchor, toE, tpPos, isJoinedAssembly, 'source');
      var targetCandidates = buildComponentEndpointCandidates(toE, conn.toPort, tpPos, entryAnchor, fromE, fpPos, isJoinedAssembly, 'target');
      if (!sourceCandidates.length) sourceCandidates.push({ x: x1, y: y1, side: dir1, stub: 20, movePenalty: 0, apply: null });
      if (!targetCandidates.length) targetCandidates.push({ x: x2, y: y2, side: dir2, stub: 20, movePenalty: 0, apply: null });

      var bestRoute = null;
      for (var sci = 0; sci < sourceCandidates.length; sci++) {
        var sourceCandidate = sourceCandidates[sci];
        for (var tci = 0; tci < targetCandidates.length; tci++) {
          var targetCandidate = targetCandidates[tci];
          var routed = UMLShared.routeOrthogonalConnector(sourceCandidate, targetCandidate, obstacles, {
            skipNames: skipN,
            occupied: occupiedSegments,
            stub: 20,
            bendPenalty: 38,
            extraXs: [fromE.x + fromE.box.width / 2, toE.x + toE.box.width / 2],
            extraYs: [fromE.y + fromE.box.height / 2, toE.y + toE.box.height / 2]
          });
          var candidatePoints = UMLShared.simplifyOrthogonalPath(routed.points);
          if (UMLShared.routeHitsObstacle(candidatePoints, obstacles, skipN, null)) continue;

          var bends = UMLShared.countOrthogonalBends(candidatePoints);
          var crosses = UMLShared.countRouteCrossings(candidatePoints, occupiedSegments);
          var score = UMLShared.measureOrthogonalRoute(candidatePoints) + bends * 36 +
            sourceCandidate.movePenalty + targetCandidate.movePenalty +
            crosses * 5000;
          if (isJoinedAssembly && bends > 3) score += 12;

          if (!bestRoute || score + 0.01 < bestRoute.score) {
            bestRoute = {
              score: score,
              points: candidatePoints,
              source: sourceCandidate,
              target: targetCandidate
            };
          }
        }
      }

      if (!bestRoute) {
        bestRoute = {
          score: 0,
          points: UMLShared.routeOrthogonalConnector(sourceCandidates[0], targetCandidates[0], obstacles, {
            skipNames: skipN,
            occupied: null,
            stub: 20,
            bendPenalty: 38
          }).points,
          source: sourceCandidates[0],
          target: targetCandidates[0]
        };
      }

      if (bestRoute.source.apply) bestRoute.source.apply();
      if (bestRoute.target.apply) bestRoute.target.apply();
      if (conn.fromPort && fromE.portPositions[conn.fromPort]) fpPos = fromE.portPositions[conn.fromPort];
      if (conn.toPort && toE.portPositions[conn.toPort]) tpPos = toE.portPositions[conn.toPort];

      var points = refineRouteEndpoints(conn, bestRoute.points, fpPos, tpPos, skipN);
      points = UMLShared.simplifyOrthogonalPath(points);

      // Post-process: eliminate tiny H-V-H doglegs by snapping the port with the
      // smaller displacement directly to the other end's Y.
      if (points.length === 4) {
        var dg0 = points[0], dg1 = points[1], dg2 = points[2], dg3 = points[3];
        var dgH1 = Math.abs(dg1.y - dg0.y) < 1;
        var dgV  = Math.abs(dg2.x - dg1.x) < 1;
        var dgH2 = Math.abs(dg3.y - dg2.y) < 1;
        var dgVLen = Math.abs(dg2.y - dg1.y);
        if (dgH1 && dgV && dgH2 && dgVLen > 0.3 && dgVLen <= 10) {
          // Pick the endpoint whose port moves less
          var moveSourceDy = Math.abs(dg3.y - dg0.y);
          var moveToSource = moveSourceDy;  // move target to source Y
          var moveToTarget = moveSourceDy;  // move source to target Y
          // Try snapping source to target Y (source moves)
          var snapY = dg3.y;
          var snapEntry = entries[conn.from];
          var snapAlias = conn.fromPort;
          // Or snap target to source Y (target moves less if source is further)
          if (fpPos && tpPos) {
            var srcMoveDist = Math.abs(dg3.y - fpPos.cy);
            var tgtMoveDist = Math.abs(dg0.y - tpPos.cy);
            if (tgtMoveDist < srcMoveDist) {
              snapY = dg0.y;
              snapEntry = entries[conn.to];
              snapAlias = conn.toPort;
            }
          }
          if (snapEntry && snapAlias && snapEntry.portPositions && snapEntry.portPositions[snapAlias]) {
            var snapPos = snapEntry.portPositions[snapAlias];
            var snapBounds = getPortMovementBounds(snapEntry, snapAlias);
            // Allow snap if within bounds OR if the dogleg is tiny (cosmetic jog ≤ 6px)
            var canSnap = dgVLen <= 6 || (snapBounds && snapY >= snapBounds.lower && snapY <= snapBounds.upper);
            if (canSnap) {
              var straightLine = [{ x: dg0.x, y: snapY }, { x: dg3.x, y: snapY }];
              if (!routeHitsObstacle(straightLine, obstacles, skipN, null)) {
                // Directly update the port position
                snapPos.cy = snapY;
                snapPos.connY = snapY;
                snapPos.y = snapY - CFG.portSize / 2;
                points = straightLine;
                if (conn.fromPort && fromE.portPositions[conn.fromPort]) fpPos = fromE.portPositions[conn.fromPort];
                if (conn.toPort && toE.portPositions[conn.toPort]) tpPos = toE.portPositions[conn.toPort];
              }
            }
          }
        }
      }
      if (UMLShared.routeHitsObstacle(points, obstacles, skipN, occupiedSegments)) {
        points = UMLShared.routeOrthogonalConnector(bestRoute.source, bestRoute.target, obstacles, {
          skipNames: skipN,
          occupied: null,
          stub: 20,
          bendPenalty: 38,
          extraXs: [fromE.x + fromE.box.width / 2, toE.x + toE.box.width / 2],
          extraYs: [fromE.y + fromE.box.height / 2, toE.y + toE.box.height / 2]
        }).points;
        points = refineRouteEndpoints(conn, points, fpPos, tpPos, skipN);
        points = UMLShared.simplifyOrthogonalPath(points);
      }

      UMLShared.reserveOrthogonalRoute(points, occupiedSegments);

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
        var ballR = CFG.ifaceRadius;
        var socketR = CFG.ifaceSocketRadius;
        var bsIsH = Math.abs(bsSeg1.y - bsSeg0.y) < 1;

        // Compute concentric ball/socket positions and split points for the line gap.
        // The socket and lollipop must share the same center so the assembly reads
        // as a single combined symbol rather than two nearby shapes.
        var ballCx, ballCy, socketCx, socketCy, gapStart, gapEnd;
        if (bsIsH) {
          var fromIsLeft = bsSeg0.x < bsSeg1.x;
          var ballOnLeft = (fromKind === 'provide') ? fromIsLeft : !fromIsLeft;
          ballCx = bsMx;
          ballCy = bsMy;
          socketCx = bsMx;
          socketCy = bsMy;
          if (ballOnLeft) {
            gapStart = { x: ballCx - ballR, y: bsMy };
            gapEnd = { x: socketCx + socketR, y: bsMy };
          } else {
            gapStart = { x: socketCx - socketR, y: bsMy };
            gapEnd = { x: ballCx + ballR, y: bsMy };
          }
        } else {
          var fromIsTop = bsSeg0.y < bsSeg1.y;
          var ballOnTop = (fromKind === 'provide') ? fromIsTop : !fromIsTop;
          ballCx = bsMx;
          ballCy = bsMy;
          socketCx = bsMx;
          socketCy = bsMy;
          if (ballOnTop) {
            gapStart = { x: bsMx, y: ballCy - ballR };
            gapEnd = { x: bsMx, y: socketCy + socketR };
          } else {
            gapStart = { x: bsMx, y: socketCy - socketR };
            gapEnd = { x: bsMx, y: ballCy + ballR };
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
        svg.push('<circle cx="' + ballCx + '" cy="' + ballCy + '" r="' + ballR +
          '" fill="' + colors.fill + '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"/>');
        // Draw socket arc
        if (bsIsH) {
          var socketSweep = ballOnLeft ? '1' : '0';
          svg.push('<path d="M' + socketCx + ',' + (socketCy - socketR) + ' A' + socketR + ',' + socketR +
            ' 0 0,' + socketSweep + ' ' + socketCx + ',' + (socketCy + socketR) +
            '" fill="none" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"/>');
        } else {
          var vSweep = ballOnTop ? '1' : '0';
          svg.push('<path d="M' + (socketCx - socketR) + ',' + socketCy + ' A' + socketR + ',' + socketR +
            ' 0 0,' + vSweep + ' ' + (socketCx + socketR) + ',' + socketCy +
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

      connectorRoutes.push({ routeIndex: ci, conn: conn, points: points });
    }

    var componentRouteSegments = buildComponentRouteSegments(connectorRoutes);
    function preferredLabelVerticalSide(conn) {
      var fromEntry = entries[conn.from];
      var toEntry = entries[conn.to];
      if (!fromEntry || !toEntry) return null;

      var fromY = conn.fromPort && fromEntry.portPositions[conn.fromPort]
        ? fromEntry.portPositions[conn.fromPort].cy
        : fromEntry.y + fromEntry.box.height / 2;
      var toY = conn.toPort && toEntry.portPositions[conn.toPort]
        ? toEntry.portPositions[conn.toPort].cy
        : toEntry.y + toEntry.box.height / 2;
      var routeY = (fromY + toY) / 2;

      var fromCenterY = fromEntry.y + fromEntry.box.height / 2;
      var toCenterY = toEntry.y + toEntry.box.height / 2;
      var centerY = (fromCenterY + toCenterY) / 2;

      if (routeY < centerY - 6) return 'above';
      if (routeY > centerY + 6) return 'below';
      return null;
    }

    for (var cri = 0; cri < connectorRoutes.length; cri++) {
      var routeInfo = connectorRoutes[cri];
      if (!routeInfo.conn.label) continue;
      // Skip connector label when source or target is a standalone lollipop port —
      // the lollipop already renders its own label at the symbol, so a connector
      // label would double up and overlap it.
      var lConn = routeInfo.conn;
      var lFromE = entries[lConn.from], lToE = entries[lConn.to];
      var lFromPP = lFromE && lConn.fromPort && lFromE.portPositions[lConn.fromPort];
      var lToPP = lToE && lConn.toPort && lToE.portPositions[lConn.toPort];
      if ((lFromPP && (lFromPP.kind === 'provide' || lFromPP.kind === 'require') && !joinedPorts[lConn.fromPort]) ||
          (lToPP && (lToPP.kind === 'provide' || lToPP.kind === 'require') && !joinedPorts[lConn.toPort])) {
        continue;
      }
      var labelPlacement = placeComponentConnectorLabel(
        routeInfo.conn.label,
        routeInfo.points,
        routeInfo.routeIndex,
        obstacles,
        placedLabels,
        componentRouteSegments,
        CFG,
        { preferredVerticalSide: preferredLabelVerticalSide(routeInfo.conn) }
      );
      if (!labelPlacement) continue;
      placedLabels.push(labelPlacement.rect);
      svg.push('<text x="' + labelPlacement.x + '" y="' + labelPlacement.y +
        '" class="uml-component-connector-label" text-anchor="' + labelPlacement.anchor + '" font-size="' + CFG.fontSize + '" fill="' + colors.text +
        '" stroke="' + colors.fill + '" stroke-width="4" stroke-opacity="0.85" stroke-linejoin="round" paint-order="stroke" font-style="italic">' +
        UMLShared.escapeXml(routeInfo.conn.label) + '</text>');
    }

    // ── Draw component boxes ──
    var nameAreaH2 = CFG.lineHeight + CFG.padY;
    for (var en in entries) {
      var e = entries[en];
      var bx = e.x, by = e.y, bw = e.box.width, bh = e.box.height;

      // Main rectangle
      svg.push('<rect class="uml-component-box" x="' + bx + '" y="' + by + '" width="' + bw + '" height="' + bh +
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
            var ifR = pp.kind === 'require' ? CFG.ifaceSocketRadius : CFG.ifaceRadius;
            var ifS = CFG.ifaceStick;
            var ifCx, ifCy = pp.cy;
            var labelX, labelY, labelAnchor;

            if (pp.side === 'right') {
              ifCx = pp.cx + ifS + ifR;
              // Stick line from component edge
              svg.push('<line x1="' + pp.cx + '" y1="' + ifCy + '" x2="' + (ifCx - ifR) + '" y2="' + ifCy +
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
              // Label centered below the symbol (avoids collision with the opposing port's label)
              labelX = ifCx;
              labelAnchor = 'middle';
              labelY = ifCy + ifR + portLblFs2 + 2;
            } else {
              ifCx = pp.cx - ifS - ifR;
              svg.push('<line x1="' + pp.cx + '" y1="' + ifCy + '" x2="' + (ifCx + ifR) + '" y2="' + ifCy +
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
              // Label centered below the symbol (avoids collision with the opposing port's label)
              labelX = ifCx;
              labelAnchor = 'middle';
              labelY = ifCy + ifR + portLblFs2 + 2;
            }
            svg.push('<text x="' + labelX + '" y="' + labelY +
              '" text-anchor="' + labelAnchor + '" font-size="' + portLblFs2 + '"' +
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

  function adjustRenderedComponentLabels(container) {
    var svg = container.querySelector('svg');
    if (!svg) return;

    var labelEls = Array.prototype.slice.call(svg.querySelectorAll('text.uml-component-connector-label'));
    if (!labelEls.length) return;

    function plainBox(box) {
      return {
        left: box.x,
        right: box.x + box.width,
        top: box.y,
        bottom: box.y + box.height
      };
    }

    var componentBoxes = Array.prototype.slice.call(svg.querySelectorAll('rect.uml-component-box')).map(function(el) {
      return plainBox(el.getBBox());
    });
    var settledLabels = [];

    for (var li = 0; li < labelEls.length; li++) {
      var labelEl = labelEls[li];
      var baseX = parseFloat(labelEl.getAttribute('x') || '0');
      var baseY = parseFloat(labelEl.getAttribute('y') || '0');
      var offsets = [
        { dx: 0, dy: 0 },
        { dx: -12, dy: 0 }, { dx: 12, dy: 0 },
        { dx: 0, dy: -10 }, { dx: 0, dy: 10 },
        { dx: -24, dy: 0 }, { dx: 24, dy: 0 },
        { dx: -36, dy: 0 }, { dx: 36, dy: 0 },
        { dx: 0, dy: -20 }, { dx: 0, dy: 20 },
        { dx: -24, dy: -10 }, { dx: 24, dy: -10 },
        { dx: -24, dy: 10 }, { dx: 24, dy: 10 }
      ];
      var placed = null;

      for (var oi = 0; oi < offsets.length; oi++) {
        var offset = offsets[oi];
        labelEl.setAttribute('x', baseX + offset.dx);
        labelEl.setAttribute('y', baseY + offset.dy);
        var bbox = plainBox(labelEl.getBBox());
        var blocked = false;

        for (var bi = 0; bi < componentBoxes.length; bi++) {
          if (rectsOverlap(bbox, componentBoxes[bi], 2)) {
            blocked = true;
            break;
          }
        }
        if (blocked) continue;

        for (var si = 0; si < settledLabels.length; si++) {
          if (rectsOverlap(bbox, settledLabels[si], 6)) {
            blocked = true;
            break;
          }
        }
        if (blocked) continue;

        placed = bbox;
        break;
      }

      if (!placed) {
        labelEl.setAttribute('x', baseX);
        labelEl.setAttribute('y', baseY);
        placed = plainBox(labelEl.getBBox());
      }
      settledLabels.push(placed);
    }
  }

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
    adjustRenderedComponentLabels(container);
    UMLShared.autoFitSVG(container);
  }

  // ─── Auto-init ────────────────────────────────────────────────────

  UMLShared.createAutoInit('pre > code.language-uml-component', render, { type: 'component' });

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
 *   layout square        Bias the layout toward a balanced footprint
 *   layout landscape     Bias the layout toward a wider footprint
 *   layout portrait      Bias the layout toward a taller footprint
 *   layout auto          Let the layout engine choose the most compact fit
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
    gapY: 55,
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
    var layoutPreference = null;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line === '@startuml' || line === '@enduml') continue;

      // Layout directive
      var layoutDirective = UMLShared.parseLayoutDirective(line);
      if (layoutDirective && !currentNode) {
        if (layoutDirective.direction) {
          direction = layoutDirective.direction;
          layoutPreference = null;
        } else {
          layoutPreference = layoutDirective.layoutPreference;
        }
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

    return { nodes: nodes, links: links, notes: notes, direction: direction, layoutPreference: layoutPreference };
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

    var result = window.UMLAdvancedLayout.compute(layoutNodes, layoutEdges, {
      gapX: effectiveGapX,
      gapY: CFG.gapY,
      direction: parsed.direction || 'TB',
      layoutPreference: parsed.layoutPreference || null
    });

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
    var notePositions = UMLShared.computeAnchoredNotes(parsed.notes, entries);
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
    var labelSvg = [];
    var placedLabels = [];
    var placedRouteSegments = [];
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
    var distExitY = {}, distEntryY = {};
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

      var efgByY = efg.slice().sort(function(a, b) {
        var ta = entries[links[a].to], tb = entries[links[b].to];
        if (!ta || !tb) return 0;
        return (ta.y + ta.box.height / 2) - (tb.y + tb.box.height / 2);
      });
      for (var efyi = 0; efyi < efgByY.length; efyi++) {
        distExitY[efgByY[efyi]] = efe.y + efe.box.height * (efyi + 1) / (efgByY.length + 1);
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

      var etgByY = etg.slice().sort(function(a, b) {
        var fa = entries[links[a].from], fb = entries[links[b].from];
        if (!fa || !fb) return 0;
        return (fa.y + fa.box.height / 2) - (fb.y + fb.box.height / 2);
      });
      for (var etyi = 0; etyi < etgByY.length; etyi++) {
        distEntryY[etgByY[etyi]] = ete.y + ete.box.height * (etyi + 1) / (etgByY.length + 1);
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

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function uniqueAnchorValues(values) {
      var out = [];
      for (var i = 0; i < values.length; i++) {
        if (values[i] == null || !isFinite(values[i])) continue;
        if (!out.length || Math.abs(values[i] - out[out.length - 1]) > 0.5) out.push(values[i]);
      }
      return out;
    }

    function buildDeploymentPreferredSideOrder(sourceEntry, targetEntry, isSource) {
      var sourceCx = sourceEntry.x + sourceEntry.box.width / 2;
      var sourceCy = sourceEntry.y + sourceEntry.box.height / 2;
      var targetCx = targetEntry.x + targetEntry.box.width / 2;
      var targetCy = targetEntry.y + targetEntry.box.height / 2;
      var dx = targetCx - sourceCx;
      var dy = targetCy - sourceCy;
      var primaryH = dx >= 0 ? (isSource ? 'right' : 'left') : (isSource ? 'left' : 'right');
      var secondaryH = dx >= 0 ? (isSource ? 'left' : 'right') : (isSource ? 'right' : 'left');
      var primaryV = dy >= 0 ? (isSource ? 'bottom' : 'top') : (isSource ? 'top' : 'bottom');
      var secondaryV = dy >= 0 ? (isSource ? 'top' : 'bottom') : (isSource ? 'bottom' : 'top');

      if (Math.abs(dx) > Math.abs(dy) * 1.15) return [primaryH, primaryV, secondaryV, secondaryH];
      if (Math.abs(dy) > Math.abs(dx) * 1.15) return [primaryV, primaryH, secondaryH, secondaryV];
      return [primaryH, primaryV, secondaryH, secondaryV];
    }

    function buildDeploymentAnchorCandidates(entry, side, preferredCoord) {
      var left = entry.x;
      var right = entry.x + entry.box.width;
      var top = entry.y;
      var bottom = entry.y + entry.box.height;
      var centerX = left + entry.box.width / 2;
      var centerY = top + entry.box.height / 2;
      var anchors = [];
      var values;

      if (side === 'top' || side === 'bottom') {
        var insetX = Math.max(16, Math.min(32, entry.box.width * 0.18));
        values = uniqueAnchorValues([
          preferredCoord != null ? clamp(preferredCoord, left + insetX, right - insetX) : centerX,
          centerX,
          centerX - entry.box.width * 0.28,
          centerX + entry.box.width * 0.28
        ]);
        for (var xi = 0; xi < values.length; xi++) {
          anchors.push({
            x: clamp(values[xi], left + insetX, right - insetX),
            y: side === 'top' ? top : bottom,
            side: side
          });
        }
        return anchors;
      }

      var insetY = Math.max(16, Math.min(28, entry.box.height * 0.18));
      values = uniqueAnchorValues([
        preferredCoord != null ? clamp(preferredCoord, top + insetY, bottom - insetY) : centerY,
        centerY,
        centerY - entry.box.height * 0.26,
        centerY + entry.box.height * 0.26
      ]);
      for (var yi = 0; yi < values.length; yi++) {
        anchors.push({
          x: side === 'left' ? left : right,
          y: clamp(values[yi], top + insetY, bottom - insetY),
          side: side
        });
      }
      return anchors;
    }

    // ── Draw links ──
    var occupiedSegments = { h: [], v: [] };
    for (var li = 0; li < links.length; li++) {
      var lk = links[li];
      var fromE = entries[lk.from], toE = entries[lk.to];
      if (!fromE || !toE) continue;

      var isDash = lk.type === 'dependency';
      var dAttr = isDash ? ' stroke-dasharray="8,4"' : '';

      var sourceCenterX = fromE.x + fromE.box.width / 2;
      var sourceCenterY = fromE.y + fromE.box.height / 2;
      var targetCenterX = toE.x + toE.box.width / 2;
      var targetCenterY = toE.y + toE.box.height / 2;

      var skipN = {};
      skipN[lk.from] = true;
      skipN[lk.to] = true;

      var sourceSideOrder = buildDeploymentPreferredSideOrder(fromE, toE, true);
      var targetSideOrder = buildDeploymentPreferredSideOrder(fromE, toE, false);
      var sourcePreferredX = distExitX[li] !== undefined ? distExitX[li] : sourceCenterX;
      var targetPreferredX = distEntryX[li] !== undefined ? distEntryX[li] : targetCenterX;
      var sourcePreferredY = distExitY[li] !== undefined ? distExitY[li] : sourceCenterY;
      var targetPreferredY = distEntryY[li] !== undefined ? distEntryY[li] : targetCenterY;
      var sourceCandidates = [];
      var targetCandidates = [];
      var routeExtraXs = [sourceCenterX, targetCenterX, sourcePreferredX, targetPreferredX];
      var routeExtraYs = [sourceCenterY, targetCenterY, sourcePreferredY, targetPreferredY];

      for (var ssi = 0; ssi < sourceSideOrder.length; ssi++) {
        var sourceSide = sourceSideOrder[ssi];
        var sourceAnchors = buildDeploymentAnchorCandidates(
          fromE,
          sourceSide,
          (sourceSide === 'top' || sourceSide === 'bottom') ? sourcePreferredX : sourcePreferredY
        );
        for (var sai = 0; sai < sourceAnchors.length; sai++) {
          sourceCandidates.push({ anchor: sourceAnchors[sai], sideRank: ssi, anchorRank: sai });
        }
      }

      for (var tsi = 0; tsi < targetSideOrder.length; tsi++) {
        var targetSide = targetSideOrder[tsi];
        var targetAnchors = buildDeploymentAnchorCandidates(
          toE,
          targetSide,
          (targetSide === 'top' || targetSide === 'bottom') ? targetPreferredX : targetPreferredY
        );
        for (var tai = 0; tai < targetAnchors.length; tai++) {
          targetCandidates.push({ anchor: targetAnchors[tai], sideRank: tsi, anchorRank: tai });
        }
      }

      var bestRoute = null;
      for (var sci = 0; sci < sourceCandidates.length; sci++) {
        var sourceCandidate = sourceCandidates[sci];
        for (var tci = 0; tci < targetCandidates.length; tci++) {
          var targetCandidate = targetCandidates[tci];
          var routed = UMLShared.routeOrthogonalConnector(sourceCandidate.anchor, targetCandidate.anchor, obstacles, {
            skipNames: skipN,
            occupied: occupiedSegments,
            clearance: 10,
            bendPenalty: 44,
            extraXs: routeExtraXs,
            extraYs: routeExtraYs
          });
          if (!routed || !routed.points || routed.points.length < 2) continue;

          var crosses = UMLShared.countRouteCrossings(routed.points, occupiedSegments);
          var score = routed.length + routed.bends * 40 + crosses * 5000;
          score += sourceCandidate.sideRank * 28 + targetCandidate.sideRank * 28;
          score += sourceCandidate.anchorRank * 6 + targetCandidate.anchorRank * 6;

          if (!bestRoute || score < bestRoute.score - 0.5 ||
              (Math.abs(score - bestRoute.score) <= 0.5 && routed.bends < bestRoute.bends) ||
              (Math.abs(score - bestRoute.score) <= 0.5 && routed.bends === bestRoute.bends && routed.length < bestRoute.length)) {
            bestRoute = {
              points: routed.points,
              score: score,
              bends: routed.bends,
              length: routed.length
            };
          }
        }
      }

      var points = bestRoute ? bestRoute.points : UMLShared.routeOrthogonalConnector(
        buildDeploymentAnchorCandidates(fromE, sourceSideOrder[0], sourceSideOrder[0] === 'top' || sourceSideOrder[0] === 'bottom' ? sourcePreferredX : sourcePreferredY)[0],
        buildDeploymentAnchorCandidates(toE, targetSideOrder[0], targetSideOrder[0] === 'top' || targetSideOrder[0] === 'bottom' ? targetPreferredX : targetPreferredY)[0],
        obstacles,
        {
          skipNames: skipN,
          extraXs: routeExtraXs,
          extraYs: routeExtraYs
        }
      ).points;
      UMLShared.reserveOrthogonalRoute(points, occupiedSegments);

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
      var routeSegments = UMLShared.buildOrthogonalSegments(points);

      // Label — obstacle-aware placement over orthogonal routes
      if (lk.label) {
        var labelPlacement = UMLShared.placeOrthogonalLabel(lk.label, points, obstacles, placedLabels, {
          fontSize: CFG.fontSize,
          otherSegments: placedRouteSegments,
          scoreCandidate: function(segment) {
            return segment.isH ? 10 : -4;
          }
        });
        if (labelPlacement) {
          placedLabels.push(labelPlacement.rect);
          labelSvg.push('<text x="' + labelPlacement.x + '" y="' + labelPlacement.y +
            '" text-anchor="' + labelPlacement.anchor + '" font-size="' + CFG.fontSize + '" fill="' + colors.text +
            '" stroke="' + colors.fill + '" stroke-width="4" stroke-opacity="0.85" stroke-linejoin="round" paint-order="stroke" font-style="italic">' +
            UMLShared.escapeXml(lk.label) + '</text>');
        }
      }
      placedRouteSegments = placedRouteSegments.concat(routeSegments);
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

    // ── Draw labels on top ──
    for (var lli = 0; lli < labelSvg.length; lli++) {
      svg.push(labelSvg[lli]);
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

  UMLShared.createAutoInit('pre > code.language-uml-deployment', render, { type: 'deployment' });

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
 *   layout square             Bias the layout toward a balanced footprint
 *   layout landscape          Bias the layout toward a wider footprint
 *   layout portrait           Bias the layout toward a taller footprint
 *   layout auto               Let the layout engine choose the most compact fit
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
    var layoutPreference = null;

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
      var layoutDirective = UMLShared.parseLayoutDirective(line);
      if (layoutDirective && inSystem === null) {
        if (layoutDirective.direction) {
          direction = layoutDirective.direction;
          layoutPreference = null;
        } else {
          layoutPreference = layoutDirective.layoutPreference;
        }
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
      layoutPreference: layoutPreference,
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

  function useCaseRelLabelKind(rel) {
    var normalized = (rel.label || '').toLowerCase().replace(/\s+/g, '');
    if (normalized === '<<include>>') return 'include';
    if (normalized === '<<extend>>') return 'extend';
    return rel.type;
  }

  function entryCenterX(entry) {
    return entry.x + entry.box.width / 2;
  }

  function entryCenterY(entry) {
    return entry.y + entry.box.height / 2;
  }

  function setEntryCenterX(entry, centerX) {
    entry.x = centerX - entry.box.width / 2;
  }

  function setEntryCenterY(entry, centerY) {
    entry.y = centerY - entry.box.height / 2;
  }

  function spreadEntriesVertically(entries, ids, gap) {
    if (ids.length < 2) return;
    ids.sort(function(a, b) {
      return entryCenterY(entries[a]) - entryCenterY(entries[b]);
    });
    for (var i = 1; i < ids.length; i++) {
      var prev = entries[ids[i - 1]];
      var current = entries[ids[i]];
      var minTop = prev.y + prev.box.height + gap;
      if (current.y < minTop) current.y = minTop;
    }
  }

  function applyUseCaseLayoutConventions(entries, parsed) {
    var includeGroups = {};
    var extendGroups = {};
    var usecaseGeneralizations = {};
    var actorGeneralizations = {};
    var actorAssociations = {};

    function pushUnique(map, key, value) {
      if (!map[key]) map[key] = [];
      if (map[key].indexOf(value) === -1) map[key].push(value);
    }

    for (var i = 0; i < parsed.relationships.length; i++) {
      var rel = parsed.relationships[i];
      var fromId = parsed.aliasToId[rel.from] || rel.from;
      var toId = parsed.aliasToId[rel.to] || rel.to;
      var fromEntry = entries[fromId];
      var toEntry = entries[toId];
      if (!fromEntry || !toEntry) continue;

      var kind = useCaseRelLabelKind(rel);
      if (kind === 'include' && fromEntry.type === 'usecase' && toEntry.type === 'usecase') {
        pushUnique(includeGroups, toId, fromId);
        continue;
      }
      if (kind === 'extend' && fromEntry.type === 'usecase' && toEntry.type === 'usecase') {
        pushUnique(extendGroups, toId, fromId);
        continue;
      }
      if (kind === 'generalization') {
        if (fromEntry.type === 'usecase' && toEntry.type === 'usecase') {
          pushUnique(usecaseGeneralizations, toId, fromId);
        } else if (fromEntry.type === 'actor' && toEntry.type === 'actor') {
          pushUnique(actorGeneralizations, toId, fromId);
        }
        continue;
      }
      if ((kind === 'association' || kind === 'directed') && fromEntry.type !== toEntry.type) {
        if (fromEntry.type === 'actor' && toEntry.type === 'usecase') pushUnique(actorAssociations, fromId, toId);
        if (toEntry.type === 'actor' && fromEntry.type === 'usecase') pushUnique(actorAssociations, toId, fromId);
      }
    }

    for (var includeTarget in includeGroups) {
      var includeSources = includeGroups[includeTarget];
      var targetEntry = entries[includeTarget];
      if (!targetEntry || !includeSources.length) continue;
      var rightMost = -Infinity;
      var sumCenterY = 0;
      for (var si = 0; si < includeSources.length; si++) {
        var sourceEntry = entries[includeSources[si]];
        rightMost = Math.max(rightMost, sourceEntry.x + sourceEntry.box.width);
        sumCenterY += entryCenterY(sourceEntry);
      }
      targetEntry.x = rightMost + CFG.gapX * 0.7;
      setEntryCenterY(targetEntry, sumCenterY / includeSources.length);
    }

    for (var extendBase in extendGroups) {
      var extenders = extendGroups[extendBase];
      var baseEntry = entries[extendBase];
      if (!baseEntry || !extenders.length) continue;
      extenders.sort(function(a, b) {
        return entryCenterY(entries[a]) - entryCenterY(entries[b]);
      });
      for (var ei = 0; ei < extenders.length; ei++) {
        var extenderEntry = entries[extenders[ei]];
        setEntryCenterX(extenderEntry, entryCenterX(baseEntry));
        extenderEntry.y = baseEntry.y + baseEntry.box.height + CFG.gapY * 0.8 +
          ei * (extenderEntry.box.height + CFG.gapY * 0.45);
      }
    }

    for (var usecaseParent in usecaseGeneralizations) {
      var usecaseChildren = usecaseGeneralizations[usecaseParent];
      var parentEntry = entries[usecaseParent];
      if (!parentEntry || !usecaseChildren.length) continue;
      usecaseChildren.sort(function(a, b) {
        return entryCenterY(entries[a]) - entryCenterY(entries[b]);
      });
      for (var ugi = 0; ugi < usecaseChildren.length; ugi++) {
        var childEntry = entries[usecaseChildren[ugi]];
        setEntryCenterX(childEntry, entryCenterX(parentEntry));
        childEntry.y = parentEntry.y + parentEntry.box.height + CFG.gapY * 0.8 +
          ugi * (childEntry.box.height + CFG.gapY * 0.45);
      }
    }

    for (var actorParent in actorGeneralizations) {
      var actorChildren = actorGeneralizations[actorParent];
      var actorParentEntry = entries[actorParent];
      if (!actorParentEntry || !actorChildren.length) continue;
      actorChildren.sort(function(a, b) {
        return entryCenterY(entries[a]) - entryCenterY(entries[b]);
      });
      for (var agi = 0; agi < actorChildren.length; agi++) {
        var actorChildEntry = entries[actorChildren[agi]];
        setEntryCenterX(actorChildEntry, entryCenterX(actorParentEntry));
        actorChildEntry.y = actorParentEntry.y + actorParentEntry.box.height + CFG.gapY * 0.55 +
          agi * (actorChildEntry.box.height + CFG.gapY * 0.3);
      }
    }

    var actorIds = [];
    for (var actorId in actorAssociations) {
      var actorEntry = entries[actorId];
      var associatedUsecases = actorAssociations[actorId];
      if (!actorEntry || !associatedUsecases.length) continue;
      var leftMost = Infinity;
      var totalCenterY = 0;
      for (var ai = 0; ai < associatedUsecases.length; ai++) {
        var usecaseEntry = entries[associatedUsecases[ai]];
        leftMost = Math.min(leftMost, usecaseEntry.x);
        totalCenterY += entryCenterY(usecaseEntry);
      }
      actorEntry.x = leftMost - actorEntry.box.width - CFG.gapX * 0.7;
      setEntryCenterY(actorEntry, totalCenterY / associatedUsecases.length);
      actorIds.push(actorId);
    }

    spreadEntriesVertically(entries, actorIds, 18);

    // Resolve actor–usecase collisions: an actor placed to the left of its use case
    // may land on top of another use case that sits between them (e.g. when an
    // include chain places the target use case to the right of an intermediate one).
    // Push the colliding actor further left (or to the right if that is closer).
    var gap = CFG.gapX * 0.5;
    for (var colActorId in entries) {
      var colActor = entries[colActorId];
      if (!colActor || colActor.type !== 'actor') continue;
      for (var colUcId in entries) {
        var colUc = entries[colUcId];
        if (!colUc || colUc.type !== 'usecase') continue;
        // Check overlap (with a small margin)
        var overlapX = colActor.x + colActor.box.width > colUc.x + gap &&
                       colActor.x < colUc.x + colUc.box.width - gap;
        var overlapY = colActor.y + colActor.box.height > colUc.y + gap &&
                       colActor.y < colUc.y + colUc.box.height - gap;
        if (overlapX && overlapY) {
          // Choose side: push left past the use case's left edge
          colActor.x = colUc.x - colActor.box.width - gap * 2;
        }
      }
    }

    // Ensure all actors are outside system boundaries (actors may be on left or right)
    if (parsed.systems && parsed.systems.length > 0) {
      var sysBounds = [];
      for (var syi = 0; syi < parsed.systems.length; syi++) {
        var sys = parsed.systems[syi];
        var sMinX = Infinity, sMinY = Infinity, sMaxX = -Infinity, sMaxY = -Infinity;
        var hasUsecaseMember = false;
        for (var smi = 0; smi < sys.members.length; smi++) {
          var smid = parsed.aliasToId[sys.members[smi]] || sys.members[smi];
          var sme = entries[smid];
          if (!sme || sme.type !== 'usecase') continue;
          hasUsecaseMember = true;
          sMinX = Math.min(sMinX, sme.x - CFG.sysPadX);
          sMinY = Math.min(sMinY, sme.y - CFG.sysPadY);
          sMaxX = Math.max(sMaxX, sme.x + sme.box.width + CFG.sysPadX);
          sMaxY = Math.max(sMaxY, sme.y + sme.box.height + CFG.sysPadY);
        }
        if (hasUsecaseMember) {
          sysBounds.push({ minX: sMinX, minY: sMinY, maxX: sMaxX, maxY: sMaxY });
        }
      }
      for (var actorCheckId in entries) {
        var actorCheckEntry = entries[actorCheckId];
        if (!actorCheckEntry || actorCheckEntry.type !== 'actor') continue;
        for (var sbi2 = 0; sbi2 < sysBounds.length; sbi2++) {
          var sb = sysBounds[sbi2];
          if (actorCheckEntry.x + actorCheckEntry.box.width > sb.minX &&
              actorCheckEntry.x < sb.maxX &&
              actorCheckEntry.y + actorCheckEntry.box.height > sb.minY &&
              actorCheckEntry.y < sb.maxY) {
            // Determine side based on actor center vs system center
            var aCenterX = actorCheckEntry.x + actorCheckEntry.box.width / 2;
            var sCenterX = (sb.minX + sb.maxX) / 2;
            if (aCenterX <= sCenterX) {
              actorCheckEntry.x = sb.minX - actorCheckEntry.box.width - CFG.gapX * 0.7;
            } else {
              actorCheckEntry.x = sb.maxX + CFG.gapX * 0.7;
            }
          }
        }
      }
      // Re-spread all actors vertically after boundary adjustments
      var allActorIds = [];
      for (var reSpreadId in entries) {
        if (entries[reSpreadId] && entries[reSpreadId].type === 'actor') allActorIds.push(reSpreadId);
      }
      spreadEntriesVertically(entries, allActorIds, 18);
    }
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
      layoutPreference: parsed.layoutPreference || null,
    });

    // Map positions back
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var nid in result.nodes) {
      if (!entries[nid]) continue;
      entries[nid].x = result.nodes[nid].x;
      entries[nid].y = result.nodes[nid].y;
    }

    applyUseCaseLayoutConventions(entries, parsed);

    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var entryId in entries) {
      var positionedEntry = entries[entryId];
      minX = Math.min(minX, positionedEntry.x);
      minY = Math.min(minY, positionedEntry.y);
      maxX = Math.max(maxX, positionedEntry.x + positionedEntry.box.width);
      maxY = Math.max(maxY, positionedEntry.y + positionedEntry.box.height);
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
      var useCaseNoteObstacles = [];
      for (var entryId in entries) {
        var useCaseEntry = entries[entryId];
        useCaseNoteObstacles.push({ x: useCaseEntry.x, y: useCaseEntry.y, w: useCaseEntry.box.width, h: useCaseEntry.box.height, name: entryId });
      }
      var placedUseCaseNotes = [];
      for (var npi = 0; npi < parsed.notes.length; npi++) {
        var pn = parsed.notes[npi];
        var tgtId = parsed.aliasToId[pn.target] || pn.target;
        var tgtE = entries[tgtId];
        if (!tgtE) continue;
        var ns = UMLShared.measureNote(pn.lines);
        var useCaseTarget = { x: tgtE.x, y: tgtE.y, w: tgtE.box.width, h: tgtE.box.height };
        var usableObstacles = [];
        for (var uoi = 0; uoi < useCaseNoteObstacles.length; uoi++) {
          var uob = useCaseNoteObstacles[uoi];
          if (!(uob.x === useCaseTarget.x && uob.y === useCaseTarget.y && uob.w === useCaseTarget.w && uob.h === useCaseTarget.h)) {
            usableObstacles.push(uob);
          }
        }
        var placed = UMLShared.placeNoteRect(useCaseTarget, ns, pn.position, usableObstacles, placedUseCaseNotes);
        notePositions.push({ note: pn, x: placed.x, y: placed.y, w: ns.width, h: ns.height, tx: useCaseTarget.x, ty: useCaseTarget.y, tw: useCaseTarget.w, th: useCaseTarget.h });
        placedUseCaseNotes.push({ x: placed.x, y: placed.y, w: ns.width, h: ns.height });
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
    var placedLabels = [];
    var placedRouteSegments = [];
    var activityObstacles = [];
    for (var aen in entries) {
      var ae0 = entries[aen];
      activityObstacles.push({ x: ae0.x, y: ae0.y, w: ae0.box.width, h: ae0.box.height });
    }
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
        var lineDx = p2.x - p1.x;
        var lineDy = p2.y - p1.y;
        var isMostlyVertical = Math.abs(lineDx) < Math.abs(lineDy);
        var lx = (p1.x + p2.x) / 2;
        var ly = (p1.y + p2.y) / 2 - (isMostlyVertical ? 2 : 8);
        var labelAnchor = 'middle';
        if (isMostlyVertical) {
          lx += 16;
          labelAnchor = 'start';
        }
        labelSvg.push('<text x="' + lx + '" y="' + ly +
          '" text-anchor="' + labelAnchor + '" font-size="' + CFG.fontSize + '" fill="' + colors.text +
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

  UMLShared.createAutoInit('pre > code.language-uml-usecase', render, { type: 'usecase' });
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
    diamondSize: 14,
    forkBarH: 4,
    forkBarMinW: 60,
    gapX: 80,
    gapY: 50,
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
    var layoutPreference = null;

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
      var layoutDirective = UMLShared.parseLayoutDirective(line);
      if (layoutDirective) {
        if (layoutDirective.direction) {
          direction = layoutDirective.direction;
          layoutPreference = null;
        } else {
          layoutPreference = layoutDirective.layoutPreference;
        }
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

    return { nodes: nodeList, edges: edges, notes: notes, lanes: lanes, direction: direction, layoutPreference: layoutPreference };
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
      layoutPreference: parsed.layoutPreference || null,
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
    var notePositions = UMLShared.computeAnchoredNotes(parsed.notes, entries);

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
    var placedLabels = [];
    var placedRouteSegments = [];
    var activityObstacles = [];
    for (var aen in entries) {
      var ae0 = entries[aen];
      activityObstacles.push({ x: ae0.x, y: ae0.y, w: ae0.box.width, h: ae0.box.height });
    }
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
    var routeMarginX = maxBoundsX + CFG.gapX * 0.25;

    var downByFrom = {};
    var decisionByFrom = {};
    for (var ti0 = 0; ti0 < edgeList.length; ti0++) {
      var tr0 = edgeList[ti0];
      if (!entries[tr0.from] || !entries[tr0.to] || tr0.from === tr0.to) continue;
      var fe0 = entries[tr0.from], te0 = entries[tr0.to];
      if ((te0.y + te0.box.height / 2) > (fe0.y + fe0.box.height / 2)) {
        if (fe0.node.type === 'decision' || fe0.node.type === 'merge') {
          if (!decisionByFrom[tr0.from]) decisionByFrom[tr0.from] = [];
          decisionByFrom[tr0.from].push(ti0);
          continue;
        }
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
    for (var dname in decisionByFrom) {
      var diamondGroup = decisionByFrom[dname];
      var de = entries[dname];
      if (!de) continue;
      diamondGroup.sort(function(a, b) {
        var ta = edgeList[a], tb = edgeList[b];
        var cxa = entries[ta.to] ? entries[ta.to].x + entries[ta.to].box.width / 2 : 0;
        var cxb = entries[tb.to] ? entries[tb.to].x + entries[tb.to].box.width / 2 : 0;
        return cxa - cxb;
      });
      var dcx = de.x + de.box.width / 2;
      var dcy = de.y + de.box.height / 2;
      for (var dgi2 = 0; dgi2 < diamondGroup.length; dgi2++) {
        var edgeIdx = diamondGroup[dgi2];
        var edge = edgeList[edgeIdx];
        var target = entries[edge.to];
        if (!target) continue;
        var tcx = target.x + target.box.width / 2;
        var tcy = target.y + target.box.height / 2;
        var ddx = tcx - dcx;
        var ddy = tcy - dcy;
        if (Math.abs(ddx) > Math.abs(ddy) * 0.65) {
          customExits[edgeIdx] = ddx >= 0
            ? { x: de.x + de.box.width, y: dcy, side: 'right' }
            : { x: de.x, y: dcy, side: 'left' };
        } else {
          customExits[edgeIdx] = ddy >= 0
            ? { x: dcx, y: de.y + de.box.height, side: 'bottom' }
            : { x: dcx, y: de.y, side: 'top' };
        }
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
        if (customExits[ti].side === 'left' || customExits[ti].side === 'right') {
          x2 = toCx;
          y2 = Math.abs(dy) >= Math.abs(dx) * 0.5 ? (dy > 0 ? toE.y : toE.y + toE.box.height) : toCy;
          isHorizontal = true;
        } else {
          x2 = toCx; y2 = toE.y;
        }
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
      if (customExits[ti] && (customExits[ti].side === 'left' || customExits[ti].side === 'right') && Math.abs(y1 - y2) >= 2) {
        points = [
          { x: x1, y: y1 },
          { x: x2, y: y1 },
          { x: x2, y: y2 }
        ];
      } else if (isBackEdge && !customExits[ti]) {
        var dynamicMargin = routeMarginX + (ti * 10);
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
      var routeSegments = UMLShared.buildOrthogonalSegments(points);

      // Guard label
      if (tr.guard) {
        var guardText = '[' + tr.guard + ']';
        var guardPlacement = UMLShared.placeOrthogonalLabel(guardText, points, activityObstacles, placedLabels, {
          fontSize: CFG.fontSize,
          otherSegments: placedRouteSegments,
          fractions: [0.5, 0.38, 0.62],
          scoreCandidate: function(segment) {
            var bonus = segment.isH ? 12 : -6;
            if (customExits[ti] && (customExits[ti].side === 'left' || customExits[ti].side === 'right') && segment.segmentIndex === 0) {
              bonus += 22;
            }
            return bonus;
          }
        });
        if (guardPlacement) {
          placedLabels.push(guardPlacement.rect);
          labelSvg.push('<text x="' + guardPlacement.x + '" y="' + guardPlacement.y +
            '" text-anchor="' + guardPlacement.anchor + '" font-size="' + CFG.fontSize + '" fill="' + colors.text +
            '" stroke="' + colors.fill + '" stroke-width="4" stroke-opacity="0.85" stroke-linejoin="round" paint-order="stroke">' +
            UMLShared.escapeXml(guardText) + '</text>');
        }
      }
      placedRouteSegments = placedRouteSegments.concat(routeSegments);
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

  UMLShared.createAutoInit('pre > code.language-uml-activity', render, { type: 'activity' });
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
 *     <span class="uml-sym" data-diagram="class" data-sym="<-->"></span>   Bidirectional navigable association
 *     <span class="uml-sym" data-diagram="class" data-sym="--x"></span>    Non-navigable association
 *     <span class="uml-sym" data-diagram="class" data-sym="x--x"></span>   Non-navigable association on both ends
 *     <span class="uml-sym" data-diagram="class" data-sym="*--"></span>    Composition
 *     <span class="uml-sym" data-diagram="class" data-sym="*-->"></span>   Composition + navigable target
 *     <span class="uml-sym" data-diagram="class" data-sym="*<-->"></span>  Composition + bidirectional navigability
 *     <span class="uml-sym" data-diagram="class" data-sym="*--x"></span>   Composition + non-navigable target
 *     <span class="uml-sym" data-diagram="class" data-sym="o--"></span>    Aggregation
 *     <span class="uml-sym" data-diagram="class" data-sym="o-->"></span>   Aggregation + navigable target
 *     <span class="uml-sym" data-diagram="class" data-sym="o<-->"></span>  Aggregation + bidirectional navigability
 *     <span class="uml-sym" data-diagram="class" data-sym="o--x"></span>   Aggregation + non-navigable target
 *     <span class="uml-sym" data-diagram="class" data-sym="..>"></span>    Dependency
 *     <span class="uml-sym" data-diagram="class" data-sym="box" data-label="Customer"></span> Class box with custom label
 *
 *   Sequence diagram symbols (data-diagram="sequence"):
 *     <span class="uml-sym" data-diagram="sequence" data-sym="->"></span>   Synchronous call
 *     <span class="uml-sym" data-diagram="sequence" data-sym="-->"></span>  Return / response
 *     <span class="uml-sym" data-diagram="sequence" data-sym="->>"></span>  Asynchronous message
 *     <span class="uml-sym" data-diagram="sequence" data-sym="head-named"></span>  Named instance lifeline head
 *     <span class="uml-sym" data-diagram="sequence" data-sym="head-anon"></span>   Anonymous instance lifeline head
 *     <span class="uml-sym" data-diagram="sequence" data-sym="head-multi"></span>  Multi-object lifeline head
 *     <span class="uml-sym" data-diagram="sequence" data-sym="frag-opt"></span>    opt fragment
 *     <span class="uml-sym" data-diagram="sequence" data-sym="frag-alt"></span>    alt fragment
 *     <span class="uml-sym" data-diagram="sequence" data-sym="frag-loop"></span>   loop fragment
 *     <span class="uml-sym" data-diagram="sequence" data-sym="frag-par"></span>    par fragment
 *     <span class="uml-sym" data-diagram="sequence" data-sym="frag-break"></span>  break fragment
 *     <span class="uml-sym" data-diagram="sequence" data-sym="frag-critical"></span> critical fragment
 *     <span class="uml-sym" data-diagram="sequence" data-sym="frag-ref"></span>    ref fragment
 *
 *   State diagram symbols (data-diagram="state"):
 *     <span class="uml-sym" data-diagram="state" data-sym="-->"></span>    Transition
 *     <span class="uml-sym" data-diagram="state" data-sym="[*]"></span>    Initial state
 *     <span class="uml-sym" data-diagram="state" data-sym="regular"></span> Regular state
 *     <span class="uml-sym" data-diagram="state" data-sym="final"></span>  Final state
 *
 *   Component diagram symbols (data-diagram="component"):
 *     <span class="uml-sym" data-diagram="component" data-sym="portin"></span>   Incoming port
 *     <span class="uml-sym" data-diagram="component" data-sym="portout"></span>  Outgoing port
 *     <span class="uml-sym" data-diagram="component" data-sym="provide"></span>  Provided interface
 *     <span class="uml-sym" data-diagram="component" data-sym="require"></span>  Required interface
 *     <span class="uml-sym" data-diagram="component" data-sym="-->"></span>      Assembly connector
 *     <span class="uml-sym" data-diagram="component" data-sym="..>"></span>      Dependency
 *     <span class="uml-sym" data-diagram="component" data-sym="--"></span>       Plain link
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
      stroke: get('--uml-stroke', '#4060a0'),
      line: get('--uml-line', '#444'),
      fill: get('--uml-fill', '#fff'),
      headerFill: get('--uml-header-fill', '#d0ddef'),
      text: get('--uml-text', '#222'),
    };
  }

  function getTypography(el) {
    var cs = window.getComputedStyle(el);
    var size = parseFloat(cs.fontSize);
    if (!isFinite(size) || size <= 0) size = 16;
    return {
      fontSize: size,
      fontFamily: cs.fontFamily || 'Arial, sans-serif'
    };
  }

  function escapeXml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function approxTextWidth(text, fontSize) {
    return Math.max(fontSize * 2.2, String(text).length * fontSize * 0.62);
  }

  function ln(x1, x2, c, dash) {
    return '<line x1="' + x1 + '" y1="' + CY + '" x2="' + x2 + '" y2="' + CY +
      '" stroke="' + c + '" stroke-width="1.5"' + (dash ? ' stroke-dasharray="5,3"' : '') + '/>';
  }

  function openArrow(ax, c) {
    return '<polyline points="' + (ax - 10) + ',' + (CY - 6) + ' ' + ax + ',' + CY + ' ' +
      (ax - 10) + ',' + (CY + 6) + '" fill="none" stroke="' + c + '" stroke-width="1.5"/>';
  }

  function openArrowLeft(ax, c) {
    return '<polyline points="' + (ax + 10) + ',' + (CY - 6) + ' ' + ax + ',' + CY + ' ' +
      (ax + 10) + ',' + (CY + 6) + '" fill="none" stroke="' + c + '" stroke-width="1.5"/>';
  }

  function filledArrow(ax, c) {
    return '<polygon points="' + ax + ',' + CY + ' ' + (ax - 10) + ',' + (CY - 5) + ' ' +
      (ax - 10) + ',' + (CY + 5) + '" fill="' + c + '" stroke="none"/>';
  }

  function crossMarker(ax, c) {
    var cx = ax - 6;
    return '<line x1="' + (cx - 6) + '" y1="' + (CY - 6) + '" x2="' + (cx + 6) + '" y2="' + (CY + 6) +
      '" stroke="' + c + '" stroke-width="1.5"/>' +
      '<line x1="' + (cx - 6) + '" y1="' + (CY + 6) + '" x2="' + (cx + 6) + '" y2="' + (CY - 6) +
      '" stroke="' + c + '" stroke-width="1.5"/>';
  }

  function crossMarkerLeft(ax, c) {
    var cx = ax + 6;
    return '<line x1="' + (cx - 6) + '" y1="' + (CY - 6) + '" x2="' + (cx + 6) + '" y2="' + (CY + 6) +
      '" stroke="' + c + '" stroke-width="1.5"/>' +
      '<line x1="' + (cx - 6) + '" y1="' + (CY + 6) + '" x2="' + (cx + 6) + '" y2="' + (CY - 6) +
      '" stroke="' + c + '" stroke-width="1.5"/>';
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

  function portBox(x, c, fill) {
    return '<rect x="' + x + '" y="' + (CY - 5) + '" width="10" height="10" fill="' + fill + '" stroke="' + c + '" stroke-width="1.5"/>';
  }

  function componentEdge(x, c) {
    return '<line x1="' + x + '" y1="' + (CY - 9) + '" x2="' + x + '" y2="' + (CY + 9) + '" stroke="' + c + '" stroke-width="1.5"/>';
  }

  function lollipop(x, lineColor, fill, radius, stickLen) {
    var r = radius || 9;
    var stick = stickLen || 20;
    var cx = x + stick + r;
    return '<line x1="' + x + '" y1="' + CY + '" x2="' + (cx - r) + '" y2="' + CY + '" stroke="' + lineColor + '" stroke-width="1.5"/>' +
      '<circle cx="' + cx + '" cy="' + CY + '" r="' + r + '" fill="' + fill + '" stroke="' + lineColor + '" stroke-width="1.5"/>';
  }

  function socketLeft(x, lineColor, radius, stickLen) {
    var r = radius || 13;
    var stick = stickLen || 20;
    var cx = x + stick + r;
    return '<line x1="' + x + '" y1="' + CY + '" x2="' + (cx - r) + '" y2="' + CY + '" stroke="' + lineColor + '" stroke-width="1.5"/>' +
      '<path d="M' + cx + ',' + (CY - r) + ' A' + r + ',' + r + ' 0 0,0 ' + cx + ',' + (CY + r) + '" fill="none" stroke="' + lineColor + '" stroke-width="1.5"/>';
  }

  function socketRight(x, lineColor, radius, stickLen) {
    var r = radius || 13;
    var stick = stickLen || 20;
    var cx = x;
    var edgeX = cx + r + stick;
    return '<path d="M' + cx + ',' + (CY - r) + ' A' + r + ',' + r + ' 0 0,1 ' + cx + ',' + (CY + r) + '" fill="none" stroke="' + lineColor + '" stroke-width="1.5"/>' +
      '<line x1="' + (cx + r) + '" y1="' + CY + '" x2="' + edgeX + '" y2="' + CY + '" stroke="' + lineColor + '" stroke-width="1.5"/>';
  }

  function objectHead(label, c, opts) {
    var options = opts || {};
    var fontSize = options.fontSize || 16;
    var fontFamily = options.fontFamily || 'Arial, sans-serif';
    var padX = Math.max(10, fontSize * 0.65);
    var headH = Math.max(24, fontSize * 1.45);
    var tailH = Math.max(10, fontSize * 0.7);
    var x = 2;
    var y = 1.5;
    var w = Math.max(96, approxTextWidth(label, fontSize) + padX * 2);
    var h = headH;
    var totalH = y + h + tailH + 1.5;
    var cx = x + w / 2;
    var textY = y + h / 2 + fontSize * 0.33;
    var svg = '';
    if (options.multi) {
      svg += '<rect x="' + (x + 6) + '" y="' + (y + 3) + '" width="' + w + '" height="' + h + '" fill="' + c.headerFill + '" stroke="' + c.stroke + '" stroke-width="1.2" opacity="0.7"/>';
    }
    svg += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + c.headerFill + '" stroke="' + c.stroke + '" stroke-width="1.5"/>';
    svg += '<text x="' + cx + '" y="' + textY + '" text-anchor="middle" font-weight="bold" font-size="' + fontSize + '" fill="' + c.text + '" font-family="' + fontFamily + '"' +
      (options.underline ? ' text-decoration="underline"' : '') + '>' + escapeXml(label) + '</text>';
    svg += '<line x1="' + cx + '" y1="' + (y + h) + '" x2="' + cx + '" y2="' + totalH + '" stroke="' + c.line + '" stroke-width="1.5" stroke-dasharray="4,3"/>';
    return { inner: svg, width: w + (options.multi ? 8 : 2), height: totalH + 1 };
  }

  function classBox(label, c, opts) {
    var options = opts || {};
    var fontSize = options.fontSize || 16;
    var fontFamily = options.fontFamily || 'Arial, sans-serif';
    var padX = Math.max(12, fontSize * 0.75);
    var nameH = Math.max(24, fontSize * 1.5);
    var w = Math.max(100, approxTextWidth(label, fontSize) + padX * 2);
    var h = nameH;
    var textY = 1.5 + h / 2;
    var svg = '<rect x="1.5" y="1.5" width="' + w + '" height="' + h + '" fill="' + c.headerFill + '" stroke="' + c.stroke + '" stroke-width="1.5"/>';
    svg += '<text x="' + (w / 2 + 1.5) + '" y="' + textY + '" text-anchor="middle" dominant-baseline="middle" font-weight="bold" font-size="' + fontSize + '" fill="' + c.text + '" font-family="' + fontFamily + '">' + escapeXml(label) + '</text>';
    return { inner: svg, width: w + 3, height: h + 3 };
  }

  function fragmentBox(label, c, opts) {
    var options = opts || {};
    var x = 4;
    var y = 2;
    var w = 72;
    var h = 20;
    var foldSize = 4;
    var labelW = Math.max(34, Math.min(56, 18 + label.length * 7.6));
    var labelH = 14;
    var svg = '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="none" stroke="' + c.line + '" stroke-width="1"/>';
    svg += '<polygon points="' + x + ',' + y + ' ' + (x + labelW) + ',' + y + ' ' + (x + labelW) + ',' + (y + labelH - foldSize) + ' ' + (x + labelW - foldSize) + ',' + (y + labelH) + ' ' + x + ',' + (y + labelH) + '" fill="' + c.headerFill + '" stroke="' + c.line + '" stroke-width="1"/>';
    svg += '<text x="' + (x + 6) + '" y="' + (y + 10.8) + '" font-size="9.6" font-weight="bold" fill="' + c.text + '" font-family="Arial, sans-serif">' + label.toUpperCase() + '</text>';
    if (options.divider) {
      svg += '<line x1="' + x + '" y1="' + (y + 15) + '" x2="' + (x + w) + '" y2="' + (y + 15) + '" stroke="' + c.line + '" stroke-width="1" stroke-dasharray="4,3"/>';
    }
    return svg;
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
      '<-->': function (c) {
        return ln(PAD, W - PAD, c.line, false) + openArrowLeft(PAD, c.line) + openArrow(W - PAD, c.line);
      },
      '--x': function (c) {
        return ln(PAD, W - PAD, c.line, false) + crossMarker(W - PAD, c.line);
      },
      'x--x': function (c) {
        return ln(PAD, W - PAD, c.line, false) + crossMarkerLeft(PAD, c.line) + crossMarker(W - PAD, c.line);
      },
      '*--': function (c) {
        return diamond(true, c.line, c.fill) + ln(PAD + 14, W - PAD, c.line, false);
      },
      '*-->': function (c) {
        return diamond(true, c.line, c.fill) + ln(PAD + 14, W - PAD, c.line, false) + openArrow(W - PAD, c.line);
      },
      '*<-->': function (c) {
        return diamond(true, c.line, c.fill) + ln(PAD + 14, W - PAD, c.line, false) + openArrowLeft(PAD + 16, c.line) + openArrow(W - PAD, c.line);
      },
      '*--x': function (c) {
        return diamond(true, c.line, c.fill) + ln(PAD + 14, W - PAD, c.line, false) + crossMarker(W - PAD, c.line);
      },
      'o--': function (c) {
        return diamond(false, c.line, c.fill) + ln(PAD + 14, W - PAD, c.line, false);
      },
      'o-->': function (c) {
        return diamond(false, c.line, c.fill) + ln(PAD + 14, W - PAD, c.line, false) + openArrow(W - PAD, c.line);
      },
      'o<-->': function (c) {
        return diamond(false, c.line, c.fill) + ln(PAD + 14, W - PAD, c.line, false) + openArrowLeft(PAD + 16, c.line) + openArrow(W - PAD, c.line);
      },
      'o--x': function (c) {
        return diamond(false, c.line, c.fill) + ln(PAD + 14, W - PAD, c.line, false) + crossMarker(W - PAD, c.line);
      },
      '..>': function (c) {
        return ln(PAD, W - PAD, c.line, true) + openArrow(W - PAD, c.line);
      },
      'box': function (c, el) {
        var t = getTypography(el);
        var label = el.getAttribute('data-label') || 'Customer';
        return classBox(label, c, { fontSize: t.fontSize, fontFamily: t.fontFamily });
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
      'head-named': function (c, el) {
        var t = getTypography(el);
        var label = el.getAttribute('data-label') || 'objectName : ClassName';
        return objectHead(label, c, { underline: true, fontSize: t.fontSize, fontFamily: t.fontFamily });
      },
      'head-anon': function (c, el) {
        var t = getTypography(el);
        var label = el.getAttribute('data-label') || ': ClassName';
        return objectHead(label, c, { underline: true, fontSize: t.fontSize, fontFamily: t.fontFamily });
      },
      'head-multi': function (c, el) {
        var t = getTypography(el);
        var label = el.getAttribute('data-label') || 'primary : Server';
        return objectHead(label, c, { underline: true, multi: true, fontSize: t.fontSize, fontFamily: t.fontFamily });
      },
      'frag-opt': function (c) {
        return fragmentBox('opt', c);
      },
      'frag-alt': function (c) {
        return fragmentBox('alt', c, { divider: true });
      },
      'frag-loop': function (c) {
        return fragmentBox('loop', c);
      },
      'frag-par': function (c) {
        return fragmentBox('par', c, { divider: true });
      },
      'frag-break': function (c) {
        return fragmentBox('break', c);
      },
      'frag-critical': function (c) {
        return fragmentBox('critical', c);
      },
      'frag-ref': function (c) {
        return fragmentBox('ref', c);
      },
    },
    state: {
      '-->': function (c) {
        return ln(PAD, W - PAD, c.line, false) + filledArrow(W - PAD, c.line);
      },
      '[*]': function (c) {
        return '<circle cx="' + (PAD + 8) + '" cy="' + CY + '" r="8" fill="' + c.line + '"/>';
      },
      'regular': function (c) {
        return '<rect x="' + (PAD + 4) + '" y="' + (CY - 7) + '" width="34" height="14" rx="6" ry="6" fill="' + c.headerFill + '" stroke="' + c.stroke + '" stroke-width="1.5"/>';
      },
      'final': function (c) {
        return '<circle cx="' + (PAD + 10) + '" cy="' + CY + '" r="10" fill="' + c.fill + '" stroke="' + c.line + '" stroke-width="1.5"/>' +
          '<circle cx="' + (PAD + 10) + '" cy="' + CY + '" r="5.5" fill="' + c.line + '"/>';
      },
      '[*]-->': function (c) {
        return '<circle cx="' + (PAD + 8) + '" cy="' + CY + '" r="8" fill="' + c.line + '"/>' +
          ln(PAD + 16, W - PAD, c.line, false) + filledArrow(W - PAD, c.line);
      },
    },
    component: {
      'portin': function (c) {
        var edgeX = W - PAD - 12;
        var boxX = edgeX - 5;
        var arrowTipX = boxX;
        return componentEdge(edgeX, c.stroke) +
          portBox(boxX, c.stroke, c.fill) +
          '<line x1="' + PAD + '" y1="' + CY + '" x2="' + (arrowTipX - 8) + '" y2="' + CY + '" stroke="' + c.line + '" stroke-width="1.5"/>' +
          filledArrow(arrowTipX, c.line);
      },
      'portout': function (c) {
        var edgeX = PAD + 12;
        var boxX = edgeX - 5;
        var arrowTipX = W - PAD;
        return componentEdge(edgeX, c.stroke) +
          portBox(boxX, c.stroke, c.fill) +
          '<line x1="' + (boxX + 10) + '" y1="' + CY + '" x2="' + (arrowTipX - 10) + '" y2="' + CY + '" stroke="' + c.line + '" stroke-width="1.5"/>' +
          filledArrow(arrowTipX, c.line);
      },
      'provide': function (c) {
        return lollipop(PAD + 6, c.line, c.fill, 9, 20);
      },
      'require': function (c) {
        return socketRight(PAD + 8, c.line, 13, 20);
      },
      '--': function (c) {
        return ln(PAD, W - PAD, c.line, false);
      },
      '-->': function (c) {
        return ln(PAD, W - PAD, c.line, false) + openArrow(W - PAD, c.line);
      },
      '..>': function (c) {
        return ln(PAD, W - PAD, c.line, true) + openArrow(W - PAD, c.line);
      },
    },
  };

  function renderOne(el) {
    var diagram = el.getAttribute('data-diagram') || 'class';
    var sym = el.getAttribute('data-sym') || '';
    var diagSymbols = SYMBOLS[diagram];
    if (!diagSymbols || !diagSymbols[sym]) return;
    var colors = getColors(el);
    var rendered = diagSymbols[sym](colors, el);
    var inner = rendered && typeof rendered === 'object' ? rendered.inner : rendered;
    var width = rendered && typeof rendered === 'object' && rendered.width ? rendered.width : W;
    var height = rendered && typeof rendered === 'object' && rendered.height ? rendered.height : H;
    el.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height +
      '" viewBox="0 0 ' + width + ' ' + height + '" style="vertical-align:middle;overflow:visible;">' +
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
