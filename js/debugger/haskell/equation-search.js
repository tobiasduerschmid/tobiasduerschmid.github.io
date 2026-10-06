/** Equation-search presentation while Haskell is choosing an equation.
 * The overlay stays through the selection step so the matched equation is
 * visible, then leaves on the following event. Status words stay independent
 * of color: tried, not matched, matched, and not reached.
 */
(function (scope) {
  'use strict';

  const SEARCH_EVENTS = new Set(['call', 'try', 'match', 'reject']);

  function labelFor(status) {
    if (status === 'checking patterns') return 'tried';
    if (status === 'pattern did not match' || status === 'no guard succeeded') return 'not matched';
    if (status === 'patterns matched; checking guards' || status === 'selected') return 'matched';
    return 'not reached';
  }

  function slugFor(status) {
    return labelFor(status).replace(/ /g, '-');
  }

  function active(frame, snap) {
    if (!frame || !snap || frame.call_id !== snap.call_id) return false;
    if (!frame.equations || !frame.equations.length) return false;
    // Keep the list on the selection step itself so the matched equation is visible.
    if (snap.event === 'select') return true;
    if (!SEARCH_EVENTS.has(snap.event)) return false;
    return frame.equations.every(equation => equation.status !== 'selected');
  }

  function argumentsOf(frame) {
    return (frame && frame.arguments || []).filter(argument => argument && argument.repr).map(argument => ({
      repr: argument.repr,
      type: argument.type || '',
    }));
  }

  function coversLine(frame, line) {
    return (frame && frame.equations || []).some(equation => {
      const range = equation.source_focus && equation.source_focus.range;
      return range && range.startLineNumber <= line && line <= range.endLineNumber;
    });
  }

  function anchorLine(frame) {
    let line = frame && frame.line || 1;
    for (const equation of frame && frame.equations || []) {
      const end = equation.source_focus && equation.source_focus.range
        ? equation.source_focus.range.endLineNumber
        : equation.line;
      if (end > line) line = end;
    }
    return line;
  }

  function rows(frame) {
    return (frame && frame.equations || []).map((equation, index) => ({
      index: index + 1,
      header: equation.header,
      line: equation.line,
      label: labelFor(equation.status),
    }));
  }

  /** Decoration descriptors for equations whose source text still matches.
   * `textAt(range)` returns the editor text for that range; omit it in tests.
   */
  function decorations(frame, textAt) {
    const result = [];
    (frame && frame.equations || []).forEach((equation, index) => {
      const focus = equation.source_focus;
      if (!focus || !focus.range || !focus.text) return;
      if (textAt && textAt(focus.range) !== focus.text) return;
      const slug = slugFor(equation.status);
      const label = labelFor(equation.status);
      result.push({
        range: focus.range,
        options: {
          className: 'tvm-eq-search-range tvm-eq-' + slug,
          inlineClassName: 'tvm-eq-search-text tvm-eq-text-' + slug,
          glyphMarginClassName: 'tvm-eq-arrow tvm-eq-arrow-' + slug,
          glyphMarginHoverMessage: {
            value: 'Equation ' + (index + 1) + ' on line ' + equation.line + ' is ' + label + '. ' + equation.header,
          },
          stickiness: 1,
        },
      });
    });
    return result;
  }

  const api = { labelFor, active, coversLine, anchorLine, rows, argumentsOf, decorations };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else scope.SEBookHaskellEquationSearch = api;
})(typeof window !== 'undefined' ? window : globalThis);
