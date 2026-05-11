/**
 * GDB/MI3 output parser.
 *
 * Pure, framework-free: takes chunks of gdb's MI output (as they arrive from
 * the v86 serial stream), buffers partial lines, and emits structured
 * records the caller can consume one at a time. No DOM, no network, no
 * timers — fully unit-testable under `node --test` without any browser.
 *
 * Reference: GDB documentation, "GDB/MI Output Syntax". Implemented for MI3
 * (the protocol version `tutorial-gdb` launches with `--interpreter=mi3`).
 *
 *   output      ::= ( out-of-band-record )* [ result-record ] "(gdb)" nl
 *   record      ::= [token] ( "^" result-class | "*" | "=" | "+" ) async-or-result
 *   stream      ::= ( "~" | "@" | "&" ) c-string
 *
 * Records emitted by `feed(text)`:
 *
 *   { kind: 'result',  token, class, data }    // `^done|running|connected|error|exit`
 *   { kind: 'exec',    token, class, data }    // `*stopped|running`
 *   { kind: 'notify',  token, class, data }    // `=thread-created`, etc.
 *   { kind: 'status',  token, class, data }    // `+download` etc. (rare)
 *   { kind: 'console',         text }          // `~"..."` gdb's own output
 *   { kind: 'target',          text }          // `@"..."` inferior tty (rare in MI)
 *   { kind: 'log',             text }          // `&"..."` gdb log/diagnostic
 *   { kind: 'prompt'                   }       // `(gdb)` ready for next cmd
 *   { kind: 'raw',             text }          // anything that wasn't MI; in
 *                                              //   practice this is inferior
 *                                              //   stdout/stderr leaking onto
 *                                              //   the same stream.
 *
 * `token` is a non-negative integer used to correlate `-command` requests
 * with their `^result` responses, or `null` if the upstream record carried
 * none. `class` is the GDB-defined result/async class ("done", "stopped",
 * "library-loaded", …). `data` is a plain object with the parsed key/value
 * pairs from the trailing `, key=value, key=value …` portion of a record;
 * values are recursively decoded c-strings / tuples / lists.
 */

'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var mod = factory();
    root.SEBookGdbMiParser = mod;
    root.GdbMiParser = mod.GdbMiParser;  // legacy alias for ad-hoc console use
  }
}(typeof self !== 'undefined' ? self : this, function () {

  // ---------------- value parser -----------------------------------------

  // Decodes a single MI value at position `pos` in `s`. Returns
  // `{ value, next }`. MI values are: c-string ("..."), tuple ({k=v,...}),
  // or list ([v,v,...] / [k=v,k=v,...]).
  function parseValue(s, pos) {
    var ch = s.charAt(pos);
    if (ch === '"') return parseCString(s, pos);
    if (ch === '{') return parseTuple(s, pos);
    if (ch === '[') return parseList(s, pos);
    // Defensive: an unquoted bareword shouldn't appear per the grammar, but
    // some gdb versions emit `frame={..., line="3"}` with line as a string,
    // not a number — so we don't need a bareword branch. If we hit one,
    // treat it as a token until comma/}/].
    var end = pos;
    while (end < s.length && ',}]'.indexOf(s.charAt(end)) === -1) end++;
    return { value: s.slice(pos, end), next: end };
  }

  function parseCString(s, pos) {
    if (s.charAt(pos) !== '"') throw new Error('expected " at ' + pos);
    var out = '';
    var i = pos + 1;
    while (i < s.length) {
      var ch = s.charAt(i);
      if (ch === '"') return { value: out, next: i + 1 };
      if (ch === '\\') {
        var esc = s.charAt(i + 1);
        switch (esc) {
          case 'n': out += '\n'; i += 2; break;
          case 't': out += '\t'; i += 2; break;
          case 'r': out += '\r'; i += 2; break;
          case '\\': out += '\\'; i += 2; break;
          case '"': out += '"'; i += 2; break;
          case '0': out += '\0'; i += 2; break;
          // Numeric octal escape \NNN — gdb uses this for non-ASCII bytes.
          default:
            if (esc >= '0' && esc <= '7') {
              var j = i + 1;
              var oct = '';
              while (j < s.length && j < i + 4 && s.charAt(j) >= '0' && s.charAt(j) <= '7') {
                oct += s.charAt(j); j++;
              }
              out += String.fromCharCode(parseInt(oct, 8));
              i = j;
            } else {
              out += esc; i += 2;
            }
        }
      } else {
        out += ch; i++;
      }
    }
    // Unterminated c-string: the line was truncated. The caller must keep
    // the trailing fragment in the buffer and retry after more input.
    throw new IncompleteRecord('unterminated c-string starting at ' + pos);
  }

  function parseTuple(s, pos) {
    if (s.charAt(pos) !== '{') throw new Error('expected { at ' + pos);
    var i = pos + 1;
    var out = {};
    if (s.charAt(i) === '}') return { value: out, next: i + 1 };
    while (i < s.length) {
      var keyEnd = s.indexOf('=', i);
      if (keyEnd === -1) throw new IncompleteRecord('tuple missing = at ' + i);
      var key = s.slice(i, keyEnd);
      var v = parseValue(s, keyEnd + 1);
      addKey(out, key, v.value);
      i = v.next;
      if (s.charAt(i) === ',') { i++; continue; }
      if (s.charAt(i) === '}') return { value: out, next: i + 1 };
      throw new IncompleteRecord('tuple parse error at ' + i);
    }
    throw new IncompleteRecord('unterminated tuple');
  }

  function parseList(s, pos) {
    if (s.charAt(pos) !== '[') throw new Error('expected [ at ' + pos);
    var i = pos + 1;
    if (s.charAt(i) === ']') return { value: [], next: i + 1 };
    // A list can be either values or key=value pairs. Probe the first item.
    var firstKey = peekKey(s, i);
    if (firstKey === null) {
      // value list
      var arr = [];
      while (i < s.length) {
        var v = parseValue(s, i);
        arr.push(v.value);
        i = v.next;
        if (s.charAt(i) === ',') { i++; continue; }
        if (s.charAt(i) === ']') return { value: arr, next: i + 1 };
        throw new IncompleteRecord('list parse error at ' + i);
      }
    } else {
      // results list — preserves duplicate keys (gdb emits multiple
      // `frame={...}` entries inside `frames=[...]`, etc.) so we model
      // this as an array of {key, value} pairs.
      var pairs = [];
      while (i < s.length) {
        var k = peekKey(s, i);
        if (k === null) throw new IncompleteRecord('expected key at ' + i);
        var kv = parseValue(s, i + k.length + 1);
        pairs.push({ key: k, value: kv.value });
        i = kv.next;
        if (s.charAt(i) === ',') { i++; continue; }
        if (s.charAt(i) === ']') return { value: pairs, next: i + 1 };
        throw new IncompleteRecord('list parse error at ' + i);
      }
    }
    throw new IncompleteRecord('unterminated list');
  }

  function peekKey(s, pos) {
    var i = pos;
    while (i < s.length && /[A-Za-z0-9_\-]/.test(s.charAt(i))) i++;
    if (i > pos && s.charAt(i) === '=') return s.slice(pos, i);
    return null;
  }

  // Tuples can legally repeat the same key (rare, but `bkpt={...}` inside a
  // `BreakpointTable=...,body=[...]` is the classic case). We accumulate
  // repeats as arrays.
  function addKey(obj, key, value) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (Array.isArray(obj[key])) obj[key].push(value);
      else obj[key] = [obj[key], value];
    } else {
      obj[key] = value;
    }
  }

  // Sentinel error thrown when parsing runs off the end of the input.
  // The Parser uses this signal to keep the fragment in its line buffer.
  function IncompleteRecord(msg) {
    var e = new Error(msg);
    e.incomplete = true;
    return e;
  }

  // ---------------- record parser ----------------------------------------

  var RESULT_CHARS = { '^': 'result', '*': 'exec', '=': 'notify', '+': 'status' };
  var STREAM_CHARS = { '~': 'console', '@': 'target', '&': 'log' };

  function parseRecord(line) {
    // Extract optional decimal token prefix.
    var i = 0;
    var token = null;
    while (i < line.length && line.charAt(i) >= '0' && line.charAt(i) <= '9') i++;
    if (i > 0) {
      token = parseInt(line.slice(0, i), 10);
    }
    var marker = line.charAt(i);
    if (RESULT_CHARS[marker]) {
      var rest = line.slice(i + 1);
      // class is everything up to the first comma; the rest is `,k=v,...`
      var commaIx = rest.indexOf(',');
      var klass, data;
      if (commaIx === -1) {
        klass = rest;
        data = {};
      } else {
        klass = rest.slice(0, commaIx);
        data = parseTuple('{' + rest.slice(commaIx + 1) + '}', 0).value;
      }
      return { kind: RESULT_CHARS[marker], token: token, class: klass, data: data };
    }
    if (STREAM_CHARS[marker]) {
      // Token isn't legal on stream records per the grammar; treat any
      // preceding digits as part of the stream and rewind.
      i = 0;
      marker = line.charAt(0);
      var str = parseCString(line, 1);
      return { kind: STREAM_CHARS[marker], text: str.value };
    }
    if (line === '(gdb)' || line === '(gdb) ') {
      return { kind: 'prompt' };
    }
    // Not an MI record at all — almost always the inferior's stdout
    // leaking onto the same serial stream as gdb.
    return { kind: 'raw', text: line };
  }

  // ---------------- streaming wrapper ------------------------------------

  function GdbMiParser() {
    this._buf = '';
  }

  // Append `text` to the internal buffer and return all complete records
  // that became parseable as a result. Only partial *trailing* fragments
  // (no newline yet) stay buffered. MI's grammar disallows literal NLs
  // inside records, so a newline always terminates a record and a line
  // that doesn't parse is downgraded to `raw` (almost always inferior
  // stdout leaking onto the same stream).
  GdbMiParser.prototype.feed = function (text) {
    this._buf += text;
    var out = [];
    while (true) {
      var nl = this._buf.indexOf('\n');
      if (nl === -1) break;
      var line = this._buf.slice(0, nl);
      this._buf = this._buf.slice(nl + 1);
      // Strip trailing \r so CRLF terminators don't survive into the record.
      if (line.length && line.charAt(line.length - 1) === '\r') {
        line = line.slice(0, -1);
      }
      if (line.length === 0) continue;
      try {
        out.push(parseRecord(line));
      } catch (e) {
        // Malformed record (including unterminated c-strings — gdb is not
        // supposed to emit those mid-line per the grammar). Surface as
        // raw so downstream can decide what to do; the next record's
        // newline will let us resume cleanly.
        out.push({ kind: 'raw', text: line });
      }
    }
    return out;
  };

  // Drop any pending state (e.g., when a gdb session is killed and a fresh
  // one is starting). Returns the discarded fragment for diagnostics.
  GdbMiParser.prototype.reset = function () {
    var dropped = this._buf;
    this._buf = '';
    return dropped;
  };

  return { GdbMiParser: GdbMiParser, _parseRecord: parseRecord, _parseValue: parseValue };
}));
