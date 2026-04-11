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
