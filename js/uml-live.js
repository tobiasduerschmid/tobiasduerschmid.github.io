/**
 * Source-to-UML pipeline shared by tutorials and chapter labs.
 * Each client owns its worker queues and SVG measurements. Call dispose when
 * its owner unmounts. Analysis reads source; it never executes learner code.
 */
(function (global) {
  'use strict';

  const scriptURL = document.currentScript.src;
  const assetURL = name => new URL(name, scriptURL).href;
  const scriptLoads = new Map();
  const renderers = { class: 'UMLClassDiagram', sequence: 'UMLSequenceDiagram' };
  const analyzers = {
    python: { file: 'uml-analyzer-python.js', name: 'analyzePythonSources' },
    java: { file: 'uml-analyzer-java.js', name: 'analyzeJavaSources' },
    cpp: { file: 'uml-analyzer-cpp.js', name: 'analyzeCppSources' },
    js: { file: 'uml-analyzer-js.js', name: 'analyzeJSSources' }
  };

  function supersededError() {
    return Object.assign(new Error('UML request superseded.'), { umlSuperseded: true });
  }

  function loadScript(url) {
    if (!scriptLoads.has(url)) {
      const loading = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = () => {
          script.remove();
          reject(new Error('Could not load the UML analyzer. Try again.'));
        };
        document.head.appendChild(script);
      }).catch(error => { scriptLoads.delete(url); throw error; });
      scriptLoads.set(url, loading);
    }
    return scriptLoads.get(url);
  }

  /** One in-flight and one newest queued request per operation, per owner. */
  function createWorkerQueue() {
    let worker = null;
    let unavailable = typeof Worker === 'undefined';
    let disposed = false;
    let nextId = 0;
    const slots = {
      analyze: { active: null, queued: null, cache: null },
      render: { active: null, queued: null, cache: null }
    };
    const replies = { analysis: 'analyze', renderResult: 'render' };

    function stop(error) {
      if (worker) worker.terminate();
      worker = null;
      Object.values(slots).forEach(slot => {
        for (const request of [slot.active, slot.queued]) {
          if (!request) continue;
          clearTimeout(request.timer);
          request.reject(error);
        }
        slot.active = slot.queued = slot.cache = null;
      });
    }

    function fail(error) {
      unavailable = true;
      stop(error);
    }

    function timeout() {
      const error = Object.assign(new Error('UML generation timed out. Edit the code or try again.'), { umlTimeout: true });
      // Preserve only the newest queued edits; never repeat the stalled input
      // on the main thread, where it would freeze the editor as well.
      const queued = Object.values(slots).map(slot => {
        const request = slot.queued;
        slot.queued = null;
        return { slot, request };
      });
      stop(error);
      for (const { slot, request } of queued) {
        if (request) dispatch(slot, request);
      }
    }

    function ensureWorker() {
      if (disposed) throw supersededError();
      if (unavailable) throw new Error('UML worker is unavailable.');
      if (worker) return worker;
      const activeWorker = new Worker(assetURL('uml-worker.js'));
      worker = activeWorker;
      worker.onmessage = event => {
        if (worker !== activeWorker) return;
        const message = event.data;
        const slot = slots[replies[message.type]];
        if (!slot || !slot.active || slot.active.id !== message.id) return;
        const request = slot.active;
        slot.active = null;
        clearTimeout(request.timer);
        if (message.ok) {
          const value = message.type === 'analysis' ? message.result : message.svg;
          slot.cache = { key: request.key, value };
          request.resolve(value);
        } else {
          request.reject(new Error(message.error || 'UML generation failed.'));
        }
        const next = slot.queued;
        slot.queued = null;
        if (next) dispatch(slot, next);
      };
      worker.onerror = event => {
        if (worker === activeWorker) fail(new Error(event.message || 'UML worker failed.'));
      };
      worker.onmessageerror = () => {
        if (worker === activeWorker) fail(new Error('Could not read the UML worker response.'));
      };
      return worker;
    }

    function dispatch(slot, request) {
      try {
        const activeWorker = ensureWorker();
        request.id = ++nextId;
        slot.active = request;
        request.timer = setTimeout(timeout, 10000);
        activeWorker.postMessage({ ...request.payload, id: request.id });
      } catch (error) {
        fail(error);
        request.reject(error);
      }
    }

    function submit(kind, payload) {
      if (disposed) return Promise.reject(supersededError());
      if (unavailable) return Promise.reject(new Error('UML worker is unavailable.'));
      const slot = slots[kind];
      // Exact keys avoid returning another source's diagram after a hash collision.
      const key = JSON.stringify(payload);
      if (slot.cache && slot.cache.key === key) return Promise.resolve(slot.cache.value);
      const duplicate = [slot.active, slot.queued].find(request => request && request.key === key);
      if (duplicate) return duplicate.promise;
      let resolve, reject;
      const promise = new Promise((accept, decline) => { resolve = accept; reject = decline; });
      const request = { key, payload, promise, resolve, reject };
      if (slot.active) {
        if (slot.queued) slot.queued.reject(supersededError());
        slot.queued = request;
      } else {
        dispatch(slot, request);
      }
      return promise;
    }

    return {
      submit,
      dispose() { disposed = true; stop(supersededError()); }
    };
  }

  function snapshotContainer(element) {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const names = ['bg', 'stroke', 'text', 'fill', 'header-fill', 'line',
      'secondary-line', 'secondary-fill', 'label-fill', 'label-stroke'];
    return {
      cssVars: Object.fromEntries(names.map(name => ['--uml-' + name, style.getPropertyValue('--uml-' + name).trim()])),
      container: {
        width: rect.width || element.clientWidth || 800,
        height: rect.height || element.clientHeight || 600,
        clientWidth: element.clientWidth || rect.width || 800
      }
    };
  }

  function withClassLayout(syntax, preference) {
    if (!syntax || !preference) return syntax;
    const lines = syntax.replace(/\r\n?/g, '\n').split('\n')
      .filter(line => !/^\s*layout\s+/i.test(line));
    let position = lines.findIndex(line => line.trim());
    if (position < 0) position = 0;
    if (lines[position] && lines[position].trim() === '@startuml') position++;
    lines.splice(position, 0, 'layout ' + preference);
    return lines.join('\n');
  }

  function createRenderSurface(target, type) {
    const surface = document.createElement('div');
    surface.className = target.className;
    surface.classList.add('uml-render-staging');
    surface.setAttribute('aria-hidden', 'true');
    surface.style.cssText = target.style.cssText;
    surface.style.width = (target.getBoundingClientRect().width || target.clientWidth || 800) + 'px';
    target.parentElement.appendChild(surface);
    global.UMLShared.prepareDiagramContainer(surface, type);
    return surface;
  }

  /**
   * analyze({language, sources, options?}) resolves to classDiagram,
   * sequenceDiagram and errors. render({type, syntax, target, isCurrent?, readOnly?})
   * commits an accessible SVG only while the caller's revision is current.
   * Errors reject; superseded/disposed work has umlSuperseded=true.
   * Tutorial-specific TypeScript loading can be supplied through settings.
   */
  function createClient(settings = {}) {
    const queue = createWorkerQueue();
    const measurer = createTextMeasurer();
    let disposed = false;

    async function analyzeOnMainThread({ language, sources, options }) {
      const analyzer = analyzers[language];
      if (language === 'js' && !global.ts) {
        if (settings.loadTypeScript) await settings.loadTypeScript();
        else await loadScript(assetURL('vendor/typescript/5.9.3/typescript.min.js'));
      }
      if (!global[analyzer.name]) await loadScript(settings[language + 'AnalyzerPath'] || assetURL(analyzer.file));
      if (disposed) throw supersededError();
      return global[analyzer.name](sources, language === 'js' ? global.ts : options || {});
    }

    async function analyze(request) {
      if (request.language === 'typescript') request = { ...request, language: 'js' };
      if (!Object.hasOwn(analyzers, request.language)) throw new Error('Unsupported UML source language.');
      if (disposed) throw supersededError();
      try {
        return await queue.submit('analyze', { type: 'analyze', lang: request.language,
          sources: request.sources, options: request.options || {} });
      } catch (error) {
        if (error.umlSuperseded || error.umlTimeout || disposed) throw error;
        return analyzeOnMainThread(request);
      }
    }

    async function render({ type, syntax, target, isCurrent = () => true, readOnly = false }) {
      const current = () => !disposed && isCurrent();
      if (!current()) return false;
      const renderer = global[renderers[type]];
      if (!renderer) throw new Error('UML renderer is unavailable. Reload the page to try again.');
      // Stage both worker and fallback output. The visible SVG stays intact
      // throughout analysis/rendering, including when a newer edit supersedes it.
      const surface = createRenderSurface(target, type);
      try {
        let svg;
        try {
          svg = await queue.submit('render', { type: 'renderDiagram', diagramType: type,
            syntax, ...snapshotContainer(surface), measurements: measurer.measure(type, syntax) });
        } catch (error) {
          if (error.umlSuperseded || !current()) return false;
          if (error.umlTimeout) throw error;
          renderer.render(surface, syntax);
          svg = surface.innerHTML;
        }
        if (!current()) return false;
        global.UMLShared.prepareDiagramContainer(target, type);
        // Read-only hosts use the renderer's keyboard-scroll management;
        // tutorial editors retain their own region role and focus policy.
        if (readOnly) target.setAttribute('role', 'img');
        target.innerHTML = svg;
        global.UMLShared.autoFitSVG(target);
        global.UMLShared.applySvgAccessibility(target, type, syntax);
        return true;
      } finally {
        surface.remove();
      }
    }

    return {
      analyze, render,
      dispose() { disposed = true; queue.dispose(); measurer.dispose(); }
    };
  }

  function createTextMeasurer() {
    let host = null;
    let textNode = null;
    let previousMeasurements = {};

    function prepare(fontFamily) {
      if (!host) {
        host = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        host.classList.add('uml-measure-host');
        host.setAttribute('aria-hidden', 'true');
        host.setAttribute('focusable', 'false');
        textNode = document.createElementNS(host.namespaceURI, 'text');
        host.append(textNode);
        document.body.append(host);
      }
      // CSS inheritance matches the bundle's SVG metrics; a font-family SVG
      // attribute instead can produce different glyph widths in Chromium.
      host.style.fontFamily = fontFamily;
    }

    function measure(type, syntax) {
      const renderer = global[renderers[type]];
      const parsed = renderer.parse(syntax);
      const base = global.UMLShared.BASE_CFG;
      prepare(base.fontFamily);
      const measurements = {};

      function measureText(text, bold, size) {
        if (text == null || text === '') return;
        // Compact class layouts may increase their type by up to four pixels.
        for (let bump = 0; bump <= (type === 'class' ? 4 : 0); bump++) {
          const fontSize = size + bump;
          const key = (bold ? 'B' : 'R') + '|' + fontSize + '|' + base.fontFamily + '|' + text;
          if (measurements[key] !== undefined) continue;
          // Retain only the previous diagram's metrics. Ordinary edits reuse
          // unchanged labels without growing a cache for every typed prefix.
          if (previousMeasurements[key] !== undefined) {
            measurements[key] = previousMeasurements[key];
            continue;
          }
          textNode.setAttribute('font-size', String(fontSize));
          if (bold) textNode.setAttribute('font-weight', 'bold');
          else textNode.removeAttribute('font-weight');
          textNode.textContent = text;
          // SVG and Canvas disagree in opposite directions across engines.
          measurements[key] = Math.max(textNode.getComputedTextLength(),
            global.UMLShared.textWidth(text, bold, fontSize, base.fontFamily));
        }
      }

      for (const model of parsed.classes || []) {
        measureText(model.name, true, base.fontSizeBold);
        const stereotype = model.stereotype || { abstract: 'abstract', interface: 'interface', enum: 'enumeration' }[model.type];
        if (stereotype) measureText('«' + stereotype + '»', false, base.fontSize - 1);
        for (const member of [...(model.attributes || []), ...(model.methods || [])]) {
          measureText(member.text, false, base.fontSize);
        }
      }
      for (const relation of parsed.relationships || []) {
        for (const text of [relation.label, relation.fromMult, relation.toMult]) {
          measureText(text, false, base.fontSize - 1);
        }
      }
      previousMeasurements = measurements;
      return measurements;
    }

    return { measure, dispose() { if (host) host.remove(); host = textNode = null; previousMeasurements = {}; } };
  }

  global.UMLLive = { createClient, withClassLayout, isSuperseded: error => !!(error && error.umlSuperseded) };
})(window);
