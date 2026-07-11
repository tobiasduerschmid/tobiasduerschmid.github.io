/**
 * UML analysis + rendering worker.
 *
 * Two responsibilities:
 *   (1) Run the pure-JS UML analyzers (Python / Java / JS-TS) — produces
 *       PlantUML-style diagram syntax strings.
 *   (2) Run the ArchUML renderer (uml-bundle.js) to turn that syntax into
 *       an SVG **string**. The main thread injects the string into the DOM
 *       and runs the small post-render fit pass.
 *
 * The renderer was originally main-thread because it uses canvas
 * `measureText` for layout and relies on a few CSS-variable lookups on its
 * container. We can move it to a worker because:
 *   - `OffscreenCanvas` exposes a 2D context with `measureText` in workers.
 *   - The two DOM-touching utilities (`getThemeColors`, `containerAspect`)
 *     are easy to satisfy by passing pre-resolved values from the main
 *     thread and shimming `getComputedStyle` + the container's
 *     `getBoundingClientRect`.
 *   - `generateSVG` returns a string that the bundle assigns via
 *     `container.innerHTML = svgStr` — we just capture that assignment and
 *     post the string back.
 *   - `autoFitSVG` does need real DOM (querySelector + getBBox); the worker
 *     stubs it to a no-op and the main thread invokes the real one after
 *     injecting the SVG.
 *
 * Inbound messages (main → worker):
 *   { type: 'analyze',       id, lang, sources, options }
 *   { type: 'renderDiagram', id, diagramType, syntax, cssVars, container }
 *
 * Outbound messages:
 *   { type: 'analysis',     id, ok, result | error }
 *   { type: 'renderResult', id, ok, svg    | error }
 *
 * `cssVars`: pre-resolved values for --uml-* properties.
 * `container`: { width, height, clientWidth } — geometry the bundle uses
 *              for layout aspect ratio.
 */
'use strict';

var BASE = self.location.href;
function resolve(rel) { return new URL(rel, BASE).href; }

// ─── DOM shim ──────────────────────────────────────────────────────────
// The bundle reads `window` at top level (`window.UMLClassDiagram = …`),
// uses `window.getComputedStyle` for theme colors, `document.createElement`
// for its measurement canvas, and reads geometry off the container. We give
// it just enough to run; nothing else is exposed.

self.window = self;

// Per-render override slot: the message handler stuffs the message's
// `cssVars` and `container` here so getComputedStyle / containerAspect
// return per-call values.
var renderCtx = { cssVars: {}, container: { width: 800, height: 600, clientWidth: 800 } };

self.getComputedStyle = function () {
  return {
    getPropertyValue: function (name) {
      var v = renderCtx.cssVars[name];
      return v == null ? '' : v;
    },
  };
};
self.window.getComputedStyle = self.getComputedStyle;

function makeFakeElement() {
  var captured = '';
  var attrs = {};
  var el = {
    style: { setProperty: function () {} },
    classList: {
      add: function () {}, remove: function () {},
      toggle: function () {}, contains: function () { return false; },
    },
    hidden: false,
    children: [],
    appendChild: function () { return null; },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    getBoundingClientRect: function () {
      return {
        width: renderCtx.container.width,
        height: renderCtx.container.height,
        top: 0, left: 0,
        right: renderCtx.container.width,
        bottom: renderCtx.container.height,
      };
    },
    clientWidth: 0,   // re-read from renderCtx via Object.defineProperty below
    clientHeight: 0,
    parentElement: null,
    getAttribute: function (k) { return attrs[k] == null ? null : attrs[k]; },
    setAttribute: function (k, v) { attrs[k] = String(v); },
    removeAttribute: function (k) { delete attrs[k]; },
    hasAttribute: function (k) { return Object.prototype.hasOwnProperty.call(attrs, k); },
  };
  Object.defineProperty(el, 'innerHTML', {
    get: function () { return captured; },
    set: function (v) { captured = v; },
  });
  Object.defineProperty(el, 'clientWidth', {
    get: function () { return renderCtx.container.clientWidth || renderCtx.container.width; },
  });
  Object.defineProperty(el, 'clientHeight', {
    get: function () { return renderCtx.container.height; },
  });
  return el;
}

// Auto-init in the bundle scans the page for `pre > code.language-uml-*`
// blocks; in worker context there's nothing to find. Return an empty list.
function fakeNodeList() {
  var arr = [];
  arr.item = function (i) { return arr[i] || null; };
  return arr;
}

self.document = {
  createElement: function (tag) {
    if (String(tag).toLowerCase() === 'canvas') {
      return new OffscreenCanvas(0, 0);
    }
    return makeFakeElement();
  },
  createElementNS: function (_ns, _tag) { return makeFakeElement(); },
  querySelector: function () { return null; },
  querySelectorAll: function () { return fakeNodeList(); },
  getElementById: function () { return null; },
  getElementsByTagName: function () { return fakeNodeList(); },
  getElementsByClassName: function () { return fakeNodeList(); },
  documentElement: makeFakeElement(),
  body: makeFakeElement(),
  head: makeFakeElement(),
  addEventListener: function () {},
  removeEventListener: function () {},
  // MutationObserver target — the bundle observes document.body for visibility.
  // Constructor is provided below; observe() is a no-op since nothing mutates.
};

// Bundle uses MutationObserver to re-fit when hidden diagrams become visible.
self.MutationObserver = self.MutationObserver || function () {
  return { observe: function () {}, disconnect: function () {}, takeRecords: function () { return []; } };
};

// Some bundle code paths call requestAnimationFrame to chain layout passes.
// Use a setTimeout-based shim — NOT a microtask. A microtask shim can cascade
// into a synchronous tight loop (rAF inside rAF), starving the message loop
// and inflating render time by 3-5x for diagrams that re-fit recursively.
// 16ms matches the bundle's own non-rAF fallback at uml-bundle.js:718.
self.requestAnimationFrame = self.requestAnimationFrame || function (cb) {
  return setTimeout(cb, 16);
};
self.cancelAnimationFrame = self.cancelAnimationFrame || function (id) { clearTimeout(id); };

// ─── Lazy loaders ──────────────────────────────────────────────────────
var loaded = { python: false, java: false, jsts: false, bundle: false };

function ensureAnalyzer(lang) {
  if (lang === 'python' && !loaded.python) {
    importScripts(resolve('uml-analyzer-python.js'));
    loaded.python = true;
  } else if (lang === 'java' && !loaded.java) {
    importScripts(resolve('uml-analyzer-java.js'));
    loaded.java = true;
  } else if (lang === 'js' && !loaded.jsts) {
    if (!self.SEBookWorkerScriptIntegrity) {
      importScripts('/js/vendor/worker-script-integrity.js');
    }
    self.SEBookWorkerScriptIntegrity.importDependency('typescript');
    importScripts(resolve('uml-analyzer-js.js'));
    loaded.jsts = true;
  }
}

function ensureBundle() {
  if (loaded.bundle) return;
  importScripts(resolve('ArchUML/uml-bundle.js'));
  // autoFitSVG measures the live SVG with getBBox — only meaningful on the
  // main thread. Stub it; the main thread runs the real one after innerHTML.
  if (self.UMLShared && typeof self.UMLShared.autoFitSVG === 'function') {
    self.UMLShared.autoFitSVG = function () {};
  }
  loaded.bundle = true;
}

// ─── Message dispatch ──────────────────────────────────────────────────
self.onmessage = function (event) {
  var msg = event.data || {};
  if (msg.type === 'analyze') {
    handleAnalyze(msg);
  } else if (msg.type === 'renderDiagram') {
    handleRender(msg);
  }
};

function handleAnalyze(msg) {
  var id = msg.id, lang = msg.lang;
  var sources = msg.sources || {}, options = msg.options || {};
  try {
    ensureAnalyzer(lang);
    var result;
    if (lang === 'python')      result = self.analyzePythonSources(sources, options);
    else if (lang === 'java')   result = self.analyzeJavaSources(sources);
    else if (lang === 'js')     result = self.analyzeJSSources(sources, self.ts);
    else throw new Error('Unknown UML language: ' + lang);
    self.postMessage({ type: 'analysis', id: id, ok: true, result: result });
  } catch (err) {
    self.postMessage({ type: 'analysis', id: id, ok: false, error: (err && err.message) || String(err) });
  }
}

function handleRender(msg) {
  var id = msg.id;
  var origTextWidth = null;
  try {
    ensureBundle();
    renderCtx.cssVars = msg.cssVars || {};
    renderCtx.container = msg.container || { width: 800, height: 600, clientWidth: 800 };

    // Install a measurement override: prefer values measured on the main thread
    // (they reflect the actual rendered font), fall back to the worker's
    // OffscreenCanvas measureText for keys not in the table. Critical for
    // Firefox where the worker's font-fallback can resolve `system-ui` to a
    // different font from the document.
    if (msg.measurements && self.UMLShared && typeof self.UMLShared.textWidth === 'function') {
      origTextWidth = self.UMLShared.textWidth;
      var BASE = self.UMLShared.BASE_CFG || {};
      var measurements = msg.measurements;
      self.UMLShared.textWidth = function (text, bold, fontSize, fontFamily) {
        var fs = fontSize || BASE.fontSize;
        var ff = fontFamily || BASE.fontFamily;
        var key = (bold ? 'B' : 'R') + '|' + fs + '|' + (ff || '') + '|' + (text || '');
        if (measurements[key] !== undefined) return measurements[key];
        return origTextWidth.call(this, text, bold, fontSize, fontFamily);
      };
    }

    var RENDERERS = {
      class:    self.UMLClassDiagram,
      sequence: self.UMLSequenceDiagram,
    };
    var R = RENDERERS[msg.diagramType];
    if (!R || typeof R.render !== 'function') {
      throw new Error('Unknown diagram type: ' + msg.diagramType);
    }
    var fake = makeFakeElement();
    R.render(fake, msg.syntax);
    self.postMessage({ type: 'renderResult', id: id, ok: true, svg: fake.innerHTML });
  } catch (err) {
    self.postMessage({ type: 'renderResult', id: id, ok: false, error: (err && err.message) || String(err) });
  } finally {
    if (origTextWidth && self.UMLShared) self.UMLShared.textWidth = origTextWidth;
  }
}
