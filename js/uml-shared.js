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
    fontSize: 13,
    fontSizeBold: 14,
    lineHeight: 20,
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

  // ─── Export ─────────────────────────────────────────────────────

  window.UMLShared = {
    BASE_CFG: BASE_CFG,
    textWidth: textWidth,
    escapeXml: escapeXml,
    getThemeColors: getThemeColors,
    svgOpen: svgOpen,
    svgClose: svgClose,
    createAutoInit: createAutoInit,
  };
})();
