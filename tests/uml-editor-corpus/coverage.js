'use strict';
/**
 * Which write sites a gesture of the corpus runs (plan Task 10, the write-site map; spec 2026-11-12
 * §3.5): the assignments to textarea.value in the editor's inline script that ran while the gesture's
 * page was open, keyed as scripts/tests/fixtures/uml-editor-write-sites.json keys them.
 *
 * Every write is an expression statement, and V8 can break at the start of a statement. So before the
 * page opens, the runner (UML_CORPUS_MODE=coverage) sets a conditional breakpoint at each write of the
 * built page's editor script through a DevTools session of the page. The condition hands the write's
 * key to a binding and is false, so the page never stops: a write ran exactly when its condition ran.
 * V8 block coverage, used first, cannot decide this. In a function that returns early from an `if`, a
 * later `||`, `&&`, `??`, or `?:` ends V8's uncounted range, and the code after it counts as run
 * although the function returned (Task 10, fix round 1).
 *
 * The built script, the Liquid already rendered, is parsed with the source-structure helper, so each
 * write has the key it has in the include. The offsets of the built script and of the include differ
 * after the Liquid tag, so a write is located only in the built page and reported by its key. One file
 * per gesture is written under a folder outside the repository; gesturesByWriteSite reads them back.
 */

const fs = require('node:fs');
const path = require('node:path');
const { includeScript, parse, assignmentsTo } = require('../../scripts/tests/helpers/uml-editor-script');

const WRITE_TARGET = 'textarea.value';
const HIT_BINDING = '__umlCorpusWriteSiteRan';
// Line breaks other than "\n": V8 or the HTML parser would start a line where a count of "\n" does not.
const OTHER_LINE_BREAK = /[\r\u2028\u2029]/;

// ---------- where the writes are ----------

/** The offset at which each line of `text` starts; "\n" ends a line. */
function lineStartsOf(text) {
  const starts = [0];
  for (let index = text.indexOf('\n'); index !== -1; index = text.indexOf('\n', index + 1)) starts.push(index + 1);
  return starts;
}

/** The 0-based line and column of `offset`. */
function locationAt(lineStarts, offset) {
  const lineNumber = lineStarts.findLastIndex((start) => start <= offset);
  return { lineNumber, columnNumber: offset - lineStarts[lineNumber] };
}

/**
 * The write sites of a built page's editor script: `[{ key, lineNumber, columnNumber }]` in source
 * order, where each write's statement starts in the page. Lines and columns are 0-based and counted
 * from the page's first line, as V8 locates a point of an inline script. Refuses a page that holds a
 * line break other than "\n" before the script ends, and a script that still holds a Liquid tag.
 */
function writeSitesOfBuiltPage(html) {
  const { code, liquid } = includeScript(html);
  if (liquid.length) throw new Error('coverage: the editor script still holds a Liquid tag, so this is not a built page');
  const scriptStart = html.indexOf(code);
  if (OTHER_LINE_BREAK.test(html.slice(0, scriptStart + code.length))) {
    throw new Error('coverage: the page holds a line break other than "\\n" before its editor script ends, so V8 would number its lines apart');
  }
  const lineStarts = lineStartsOf(html);
  return assignmentsTo(parse(code), WRITE_TARGET)
    .map((site) => ({ key: site.key, ...locationAt(lineStarts, scriptStart + site.start) }));
}

// ---------- which writes ran ----------

/** A breakpoint condition that reports `key` and never stops the page. */
function conditionReporting(key) {
  return `${HIT_BINDING}(${JSON.stringify(key)}), false`;
}

function placeText({ lineNumber, columnNumber }) {
  return `line ${lineNumber + 1}, column ${columnNumber + 1}`;
}

/** The listeners that collect what a recording sees into `seen` (`ran`, `locations`, `problems`). */
function recordingListeners(devtools, seen) {
  return {
    'Runtime.bindingCalled': ({ name, payload }) => {
      if (name === HIT_BINDING) seen.ran.add(payload);
    },
    'Debugger.breakpointResolved': ({ breakpointId, location }) => {
      seen.locations.set(breakpointId, [...(seen.locations.get(breakpointId) || []), location]);
    },
    // With the debugger on, a `debugger` statement anywhere on the page would hold the page.
    'Debugger.paused': () => {
      devtools.send('Debugger.resume').catch((error) => seen.problems.push(`a paused page could not be resumed: ${error.message}`));
    },
  };
}

/**
 * Sets the conditional breakpoint of `site`; resolves to its id. The page has not loaded the script
 * yet, so V8 places the breakpoint when it does, and Debugger.breakpointResolved says where.
 */
async function setWriteBreakpoint(devtools, url, site) {
  const { breakpointId } = await devtools.send('Debugger.setBreakpointByUrl', {
    url, lineNumber: site.lineNumber, columnNumber: site.columnNumber, condition: conditionReporting(site.key),
  });
  return breakpointId;
}

/** The keys of the sites that ran, in source order; throws when a breakpoint never took or took off its write. */
function writesThatRan(sites, breakpointIds, seen, url) {
  const problems = [...seen.problems];
  const untaken = [];
  sites.forEach((site, index) => {
    const taken = seen.locations.get(breakpointIds[index]) || [];
    if (taken.length === 0) untaken.push(site.key);
    for (const location of taken) {
      if (location.lineNumber !== site.lineNumber || location.columnNumber !== site.columnNumber) {
        problems.push(`${site.key}: its breakpoint took at ${placeText(location)}, not at its write at ${placeText(site)}`);
      }
    }
  });
  if (untaken.length === sites.length) problems.unshift(`the page's editor script never loaded at ${url}`);
  else if (untaken.length) problems.push(`breakpoints that never took: ${untaken.join(', ')}`);
  if (problems.length) throw new Error(`coverage: the run cannot tell which writes ran:\n- ${problems.join('\n- ')}`);
  return sites.filter((site) => seen.ran.has(site.key)).map((site) => site.key);
}

/**
 * Starts recording which of `sites` (writeSitesOfBuiltPage) run on the page at `url`. `devtools` is a
 * DevTools protocol session of that page: Playwright's CDPSession, or anything with its `send`, `on`,
 * and `off`. Call it before the page opens; its breakpoints hold across the page's reloads. Resolves to
 * `{ stop }`. `stop()` ends the recording and resolves to the keys of the sites that ran, in source
 * order. It throws instead when a breakpoint never took, or took anywhere but at its write, because the
 * run then shows nothing about that write: V8 moves a breakpoint it cannot place, as inside a function
 * that nothing refers to, to the next statement it can break at, whose runs would pass for the write's.
 */
async function startWriteSiteRecording(devtools, { url, sites }) {
  const seen = { ran: new Set(), locations: new Map(), problems: [] };
  const listeners = Object.entries(recordingListeners(devtools, seen));
  for (const [event, listener] of listeners) devtools.on(event, listener);
  // A binding reaches the page's scripts only while the Runtime domain is on (Chromium).
  await devtools.send('Runtime.enable');
  await devtools.send('Runtime.addBinding', { name: HIT_BINDING });
  await devtools.send('Debugger.enable');
  const breakpointIds = await Promise.all(sites.map((site) => setWriteBreakpoint(devtools, url, site)));
  return {
    async stop() {
      // Each reply follows the events sent before it, so every hit and placement is in by now.
      await devtools.send('Debugger.disable');
      await devtools.send('Runtime.removeBinding', { name: HIT_BINDING });
      await devtools.send('Runtime.disable');
      for (const [event, listener] of listeners) devtools.off(event, listener);
      return writesThatRan(sites, breakpointIds, seen, url);
    },
  };
}

// ---------- one file per gesture ----------

function coverageFileOf(directory, gesture) {
  return path.join(directory, gesture.family, `${gesture.id}.json`);
}

/** Writes what one gesture executed: `<directory>/<family>/<id>.json`, `{ id, family, executed }`. */
function writeGestureCoverage(directory, gesture, executed) {
  const file = coverageFileOf(directory, gesture);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify({ id: gesture.id, family: gesture.family, executed }, null, 2)}\n`);
}

/**
 * For each write-site key, the ids of the gestures that executed it, in the order of `gestures`.
 * Throws when a gesture has no coverage file in `directory`, so a partial run cannot pass for a full one.
 */
function gesturesByWriteSite(directory, gestures) {
  const byKey = {};
  for (const gesture of gestures) {
    const file = coverageFileOf(directory, gesture);
    if (!fs.existsSync(file)) throw new Error(`coverage: no coverage recorded for ${gesture.family}/${gesture.id} in ${directory}`);
    for (const key of JSON.parse(fs.readFileSync(file, 'utf8')).executed) {
      (byKey[key] = byKey[key] || []).push(gesture.id);
    }
  }
  return byKey;
}

module.exports = { writeSitesOfBuiltPage, startWriteSiteRecording, writeGestureCoverage, gesturesByWriteSite };
