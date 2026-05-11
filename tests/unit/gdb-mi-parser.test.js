// Unit tests for js/debugger/gdb-mi-parser.js — pure Node, no Playwright.
//
// Run from the repo root with: `node --test tests/unit/gdb-mi-parser.test.js`.
//
// The spec we're pinning, from the GDB manual's MI output grammar:
//   - Records arrive line-terminated, optionally with a leading decimal
//     token used to correlate `-command` requests with their `^result`.
//   - The marker character (`^*=+~@&`) tells you the record kind.
//   - The trailing payload is a comma-separated list of `key=value` pairs
//     where each value is a c-string, a tuple (`{...}`), or a list (`[...]`).
//   - `(gdb)\n` is the ready-prompt; everything else that isn't one of the
//     above is a `raw` line (in practice, inferior stdout leaking through).
//
// Test design notes (per .agents/skills/test-design/SKILL.md):
//   - Each test names a behavior, not an implementation detail.
//   - Oracles pin exact decoded values — no `not.toBeUndefined()` weakness.
//   - Partitions: each MI record kind gets one test; each value-kind
//     (c-string / tuple / list-of-values / list-of-results) gets one;
//     edge cases (token, empty payload, malformed line, CRLF, split feeds,
//     embedded escapes, octal escapes, inferior raw output) each get one.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { GdbMiParser, _parseRecord, _parseValue } = require('../../js/debugger/gdb-mi-parser.js');

// ---------- record kinds -------------------------------------------------

test('parses a ^done result record with no payload', () => {
  assert.deepEqual(_parseRecord('^done'), {
    kind: 'result', token: null, class: 'done', data: {},
  });
});

test('parses a tokened ^running result record', () => {
  assert.deepEqual(_parseRecord('17^running'), {
    kind: 'result', token: 17, class: 'running', data: {},
  });
});

test('parses a *stopped exec-async record with a frame tuple and reason', () => {
  const rec = _parseRecord('*stopped,reason="breakpoint-hit",frame={file="main.c",line="42",func="main"},thread-id="1"');
  assert.equal(rec.kind, 'exec');
  assert.equal(rec.class, 'stopped');
  assert.equal(rec.data.reason, 'breakpoint-hit');
  assert.deepEqual(rec.data.frame, { file: 'main.c', line: '42', func: 'main' });
  assert.equal(rec.data['thread-id'], '1');
});

test('parses a =thread-created notify record', () => {
  const rec = _parseRecord('=thread-created,id="1",group-id="i1"');
  assert.equal(rec.kind, 'notify');
  assert.equal(rec.class, 'thread-created');
  assert.equal(rec.data.id, '1');
  assert.equal(rec.data['group-id'], 'i1');
});

test('parses a +download status-async record', () => {
  const rec = _parseRecord('+download,section="text"');
  assert.equal(rec.kind, 'status');
  assert.equal(rec.class, 'download');
  assert.equal(rec.data.section, 'text');
});

test('parses console (~), target (@), and log (&) stream records into their text', () => {
  assert.deepEqual(_parseRecord('~"hello\\n"'), { kind: 'console', text: 'hello\n' });
  assert.deepEqual(_parseRecord('@"prog output"'), { kind: 'target', text: 'prog output' });
  assert.deepEqual(_parseRecord('&"warning: foo"'), { kind: 'log', text: 'warning: foo' });
});

test('recognises the (gdb) ready prompt', () => {
  assert.deepEqual(_parseRecord('(gdb)'), { kind: 'prompt' });
  assert.deepEqual(_parseRecord('(gdb) '), { kind: 'prompt' });
});

test('classifies a non-MI line as raw (inferior stdout leakage)', () => {
  assert.deepEqual(_parseRecord('hello from main()'), { kind: 'raw', text: 'hello from main()' });
});

// ---------- value parsing ------------------------------------------------

test('parses an empty tuple', () => {
  assert.deepEqual(_parseValue('{}', 0), { value: {}, next: 2 });
});

test('parses an empty list', () => {
  assert.deepEqual(_parseValue('[]', 0), { value: [], next: 2 });
});

test('parses a list of c-string values', () => {
  assert.deepEqual(_parseValue('["a","b","c"]', 0), { value: ['a', 'b', 'c'], next: 13 });
});

test('parses a list of key=value pairs (preserves duplicate keys)', () => {
  // Mirrors gdb's `frames=[frame={...},frame={...}]`.
  const out = _parseValue('[frame={level="0"},frame={level="1"}]', 0).value;
  assert.deepEqual(out, [
    { key: 'frame', value: { level: '0' } },
    { key: 'frame', value: { level: '1' } },
  ]);
});

test('decodes standard c-string escapes', () => {
  assert.equal(_parseValue('"a\\nb\\tc\\rd\\\\e\\"f"', 0).value, 'a\nb\tc\rd\\e"f');
});

test('decodes octal byte escapes in c-strings', () => {
  // \303\244 is UTF-8 for ä; we decode byte-by-byte (gdb sends raw bytes).
  const v = _parseValue('"\\303\\244"', 0).value;
  assert.equal(v, String.fromCharCode(0o303) + String.fromCharCode(0o244));
});

test('duplicate keys inside a tuple accumulate into an array', () => {
  // Synthetic but matches gdb's `BreakpointTable={...,body={bkpt={...},bkpt={...}}}`.
  const v = _parseValue('{bkpt={number="1"},bkpt={number="2"}}', 0).value;
  assert.deepEqual(v.bkpt, [{ number: '1' }, { number: '2' }]);
});

// ---------- streaming wrapper -------------------------------------------

test('emits records as soon as a newline arrives; buffers partial trailing lines', () => {
  const p = new GdbMiParser();
  // Feed half a record — nothing emitted yet.
  assert.deepEqual(p.feed('^running'), []);
  // Complete the record + start a new one.
  const out1 = p.feed('\n*stopped');
  assert.deepEqual(out1, [{ kind: 'result', token: null, class: 'running', data: {} }]);
  // Finish the partial second record.
  const out2 = p.feed(',reason="exited-normally"\n');
  assert.equal(out2.length, 1);
  assert.equal(out2[0].kind, 'exec');
  assert.equal(out2[0].class, 'stopped');
  assert.equal(out2[0].data.reason, 'exited-normally');
});

test('handles CRLF line terminators (the v86 serial stream uses them)', () => {
  const p = new GdbMiParser();
  const out = p.feed('^done\r\n(gdb)\r\n');
  assert.deepEqual(out, [
    { kind: 'result', token: null, class: 'done', data: {} },
    { kind: 'prompt' },
  ]);
});

test('a malformed line is surfaced as raw without halting the stream', () => {
  const p = new GdbMiParser();
  // `^done,bogus` (key with no `=value`) violates the result-record grammar.
  const out = p.feed('^done,bogus\n^done\n');
  assert.equal(out.length, 2);
  assert.equal(out[0].kind, 'raw');
  assert.equal(out[1].kind, 'result');
  assert.equal(out[1].class, 'done');
});

test('multiple records in a single feed are returned in order', () => {
  const p = new GdbMiParser();
  const chunk = [
    '=thread-group-added,id="i1"',
    '~"Reading symbols from main..."',
    '^done',
    '(gdb)',
    '',
  ].join('\n');
  const out = p.feed(chunk);
  assert.equal(out.length, 4);
  assert.equal(out[0].kind, 'notify');
  assert.equal(out[1].kind, 'console');
  assert.equal(out[2].kind, 'result');
  assert.equal(out[3].kind, 'prompt');
});

test('reset() clears the partial buffer and returns the discarded fragment', () => {
  const p = new GdbMiParser();
  p.feed('^running');         // no newline → buffered
  assert.equal(p.reset(), '^running');
  // After reset, fresh input parses cleanly.
  const out = p.feed('^done\n');
  assert.deepEqual(out, [{ kind: 'result', token: null, class: 'done', data: {} }]);
});

// ---------- realistic transcripts ---------------------------------------

test('correlates a tokened command with its tokened ^done result', () => {
  // Real gdb session: send `42-break-insert main`, parse the response.
  const p = new GdbMiParser();
  const out = p.feed('42^done,bkpt={number="1",type="breakpoint",disp="keep",enabled="y",addr="0x080483ed",func="main",file="hello.c",line="3"}\n(gdb)\n');
  assert.equal(out.length, 2);
  assert.equal(out[0].kind, 'result');
  assert.equal(out[0].token, 42);
  assert.equal(out[0].class, 'done');
  assert.equal(out[0].data.bkpt.number, '1');
  assert.equal(out[0].data.bkpt.line, '3');
  assert.equal(out[0].data.bkpt.file, 'hello.c');
  assert.equal(out[1].kind, 'prompt');
});

test('parses a stopped-at-breakpoint transcript with frame + args', () => {
  const p = new GdbMiParser();
  // Real transcript fragment from gdb on Linux i386.
  const out = p.feed('*stopped,reason="breakpoint-hit",disp="keep",bkptno="1",frame={addr="0x080483f0",func="main",args=[{name="argc",value="1"},{name="argv",value="0xffffd784"}],file="hello.c",fullname="/tutorial/hello.c",line="3"},thread-id="1",stopped-threads="all",core="0"\n');
  assert.equal(out.length, 1);
  const rec = out[0];
  assert.equal(rec.kind, 'exec');
  assert.equal(rec.class, 'stopped');
  assert.equal(rec.data.reason, 'breakpoint-hit');
  assert.equal(rec.data.frame.line, '3');
  assert.equal(rec.data.frame.file, 'hello.c');
  // `args` is `[{name=...,value=...},{name=...,value=...}]` — a list of
  // value-tuples, not a list of key/value pairs. The shape distinction
  // matters because a JS consumer iterates `args` as objects.
  assert.deepEqual(rec.data.frame.args, [
    { name: 'argc', value: '1' },
    { name: 'argv', value: '0xffffd784' },
  ]);
});
