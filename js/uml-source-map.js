/**
 * Source provenance for inferred UML. An analyzer tags each emitted diagram
 * line with the source range it came from, then resolves the finished text
 * into clean syntax plus a parallel array: sources[i] is the range of line i,
 * or null. Ranges are { file, startLine, endLine } with 1-based, inclusive
 * lines. A tag travels inside its line while generators split, branch and
 * reorder lines, so provenance cannot drift from the line it describes.
 * The tag is a NUL character and an index; generated UML never contains NUL.
 */
(function (global) {
  'use strict';

  const TAG = '\u0000';
  const TAG_PATTERN = /\u0000(\d+)$/;

  function range(file, startLine, endLine) {
    if (!file || !(startLine >= 1)) return null;
    return { file, startLine, endLine: endLine >= startLine ? endLine : startLine };
  }

  /** One map per generated diagram. */
  function createSourceMap() {
    const ranges = [];
    return {
      /** Returns line, tagged with source when that is a known range. */
      tag(line, source) {
        if (!source) return line;
        ranges.push(source);
        return line + TAG + (ranges.length - 1);
      },
      /** Removes every tag: { text, sources } with one entry per line of text. */
      resolve(text) {
        const sources = [];
        const lines = String(text || '').split('\n').map(line => {
          const match = line.match(TAG_PATTERN);
          sources.push(match ? ranges[Number(match[1])] || null : null);
          return match ? line.slice(0, match.index) : line;
        });
        return { text: lines.join('\n'), sources: text ? sources : [] };
      }
    };
  }

  /** offset -> 1-based line number in source. */
  function lineLocator(source) {
    const starts = [0];
    for (let i = 0; i < source.length; i++) if (source.charCodeAt(i) === 10) starts.push(i + 1);
    return offset => {
      let low = 0, high = starts.length - 1;
      while (low < high) {
        const mid = (low + high + 1) >>> 1;
        if (starts[mid] <= offset) low = mid;
        else high = mid - 1;
      }
      return low + 1;
    };
  }

  const api = { createSourceMap, lineLocator, range };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.UMLSourceMap = api;
})(typeof window !== 'undefined' ? window : globalThis);
