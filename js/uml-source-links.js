/**
 * Links an inferred UML diagram to the code it came from. The analyzers give
 * each diagram line a source range (see uml-source-map.js); this module finds
 * the rendered SVG elements of those lines, lets a click on one reveal its
 * range, and lists the same links as buttons for keyboard and screen-reader
 * users. Hosts own the editor: they pass onReveal(source) and, optionally,
 * canReveal(source). highlightEditor() is the shared Monaco highlight.
 */
(function (global) {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const CLICK_SLOP = 5; // px a press may move and still count as a click, not a pan
  const states = new WeakMap(); // diagram target → its current links and listeners
  let activeHighlight = null;
  let announcer = null; // one page-level live region; a viewer's own panel may be hidden
  let announceTimer = null;

  // ── Source alignment ────────────────────────────────────────────────

  /**
   * Sources follow lines when a host inserts or removes lines (such as a
   * `layout` directive) between analysis and rendering. Matching is by
   * longest common subsequence of identical lines; a line with no partner
   * has no source.
   */
  function alignSources(fromSyntax, sources, toSyntax) {
    if (!sources || !sources.length) return [];
    if (fromSyntax === toSyntax) return sources.slice();
    const from = String(fromSyntax || '').split('\n');
    const to = String(toSyntax || '').split('\n');
    const aligned = new Array(to.length).fill(null);
    if (from.length * to.length > 4e6) return aligned;
    const width = to.length + 1;
    const lengths = new Uint16Array((from.length + 1) * width);
    for (let i = from.length - 1; i >= 0; i--) {
      for (let j = to.length - 1; j >= 0; j--) {
        lengths[i * width + j] = from[i] === to[j] ? lengths[(i + 1) * width + j + 1] + 1
          : Math.max(lengths[(i + 1) * width + j], lengths[i * width + j + 1]);
      }
    }
    for (let i = 0, j = 0; i < from.length && j < to.length;) {
      if (from[i] === to[j]) { aligned[j] = sources[i] || null; i++; j++; }
      else if (lengths[(i + 1) * width + j] >= lengths[i * width + j + 1]) i++;
      else j++;
    }
    return aligned;
  }

  // ── What each linked line means ─────────────────────────────────────

  const RELATIONS = [
    [/--\|>/, 'inherits from'], [/\.\.\|>/, 'realizes'], [/\.\.>/, 'depends on'], [/--|\.\./, 'is associated with']
  ];

  function normalizeMember(text) {
    return String(text).replace(/\{\w+\}/g, '').replace(/\s+/g, '');
  }

  /** Entries for every line with a source: { index, kind, owner?, label, source }. */
  function describe(type, syntax, sources) {
    const entries = [];
    let owner = null;
    const participants = [];
    String(syntax || '').split('\n').forEach((raw, index) => {
      const line = raw.trim();
      const source = sources[index] || null;
      if (type === 'class') {
        const header = line.match(/^(?:abstract\s+)?(?:class|interface|enum)\s+([\w.$:]+)/);
        if (header) {
          owner = /\{\s*$/.test(line) ? header[1] : null;
          if (source) entries.push({ index, kind: 'class', name: header[1], label: 'Class ' + header[1], source });
          return;
        }
        if (line === '}') { owner = null; return; }
        if (!source) return;
        if (owner) {
          entries.push({ index, kind: 'member', owner, text: line, label: owner + ' member ' + line, source });
          return;
        }
        const relation = line.match(/^([\w.$:]+)(?:\s+"[^"]*")?\s+(\S+)\s+(?:"[^"]*"\s+)?([\w.$:]+)/);
        if (relation) {
          const verb = RELATIONS.find(([pattern]) => pattern.test(relation[2]));
          entries.push({ index, kind: 'relation', label: relation[1] + ' ' + (verb ? verb[1] : 'relates to') + ' ' + relation[3], source });
        }
        return;
      }
      // `participant Main as : Main` is an anonymous instance; `participant car: Car` a named one.
      const participant = line.match(/^participant\s+(\S+?)(?:\s+as\s*:\s*(.*)|\s*:\s*(.*))?$/);
      if (participant) {
        participants.push(index);
        const name = participant[2] !== undefined ? ': ' + participant[2]
          : participant[3] !== undefined ? participant[1] + ': ' + participant[3] : participant[1];
        if (source) entries.push({ index, kind: 'participant', participant: participants.length - 1, label: 'Lifeline ' + name, source });
        return;
      }
      if (!source) return;
      const message = line.match(/^(\S+)\s+(--?>>?)\s+(\S+?)\s*:\s*(.*)$/);
      if (!message) return;
      const [, from, arrow, to, text] = message;
      const label = text === '<<create>>' ? from + ' creates ' + to
        : (arrow.startsWith('--') ? 'Reply ' : 'Call ') + from + ' to ' + to + ': ' + text;
      entries.push({ index, kind: 'message', label, source });
    });
    return entries;
  }

  function sourceText(source) {
    return source.file + (source.endLine > source.startLine
      ? ', lines ' + source.startLine + '–' + source.endLine : ', line ' + source.startLine);
  }

  // ── Finding the rendered elements ───────────────────────────────────

  function number(element, name) {
    return parseFloat(element.getAttribute(name)) || 0;
  }

  /** The class box's rectangles, and the texts drawn inside it. */
  function classParts(svg, name) {
    const bounds = svg.querySelector('[data-layout-bounds-id="' + CSS.escape(name) + '"]');
    if (!bounds) return null;
    const shadow = bounds.parentNode.matches('g[filter]') ? bounds.parentNode : null;
    const layer = shadow ? shadow.parentNode : bounds.parentNode;
    const x = number(bounds, 'x'), y = number(bounds, 'y');
    const right = x + number(bounds, 'width'), bottom = y + number(bounds, 'height');
    const texts = Array.from(layer.children).filter(element => element.localName === 'text' &&
      number(element, 'x') >= x && number(element, 'x') <= right &&
      number(element, 'y') >= y && number(element, 'y') <= bottom);
    return { box: shadow || bounds, texts };
  }

  /** Header rectangle, name and lifeline of each sequence participant, in lane order. */
  function participantParts(svg) {
    return Array.from(svg.querySelectorAll('line.uml-sequence-lifeline'), lifeline => {
      const x = number(lifeline, 'x1'), top = number(lifeline, 'y1');
      const siblings = Array.from(lifeline.parentNode.children);
      const header = siblings.find(element => element.localName === 'rect' &&
        number(element, 'x') <= x && x <= number(element, 'x') + number(element, 'width') &&
        Math.abs(number(element, 'y') + number(element, 'height') - top) < 1);
      const name = header && siblings.find(element => element.localName === 'text' &&
        Math.abs(number(element, 'x') - x) < 1 && number(element, 'y') >= number(header, 'y') && number(element, 'y') <= top);
      return [lifeline, header, name].filter(Boolean);
    });
  }

  /** A wide, invisible copy of a thin line, so it is a comfortable click target. */
  function hitArea(element) {
    if (!['line', 'polyline', 'path'].includes(element.localName)) return null;
    const copy = element.cloneNode(false);
    for (const name of Array.from(copy.attributes)) {
      if (!['x1', 'y1', 'x2', 'y2', 'points', 'd', 'transform'].includes(name.name)) copy.removeAttribute(name.name);
    }
    copy.setAttribute('class', 'uml-source-link-hit');
    // Invisible even where the stylesheet is absent, such as an exported SVG.
    copy.setAttribute('fill', 'none');
    copy.setAttribute('stroke', 'transparent');
    element.after(copy);
    return copy;
  }

  /** entryIndex → rendered elements, for entries the SVG shows. */
  function locateElements(svg, type, entries) {
    const found = new Map();
    const add = (entryIndex, elements) => {
      const present = elements.filter(Boolean);
      if (!present.length) return;
      found.set(entryIndex, (found.get(entryIndex) || []).concat(present));
    };
    const byIndex = new Map(entries.map((entry, position) => [entry.index, position]));
    const routePrefix = type === 'class' ? 'rel:' : 'seqmsg:';
    svg.querySelectorAll('[data-layout-route-id^="' + routePrefix + '"]').forEach(element => {
      const position = byIndex.get(Number(element.getAttribute('data-layout-route-id').slice(routePrefix.length)));
      if (position !== undefined) add(position, [element, hitArea(element)]);
    });
    if (type === 'class') {
      const classes = new Map();
      entries.forEach((entry, position) => {
        const name = entry.kind === 'class' ? entry.name : entry.kind === 'member' ? entry.owner : null;
        if (!name) return;
        if (!classes.has(name)) classes.set(name, { header: null, members: [] });
        if (entry.kind === 'class') classes.get(name).header = position;
        else classes.get(name).members.push(position);
      });
      classes.forEach((links, name) => {
        const parts = classParts(svg, name);
        if (!parts) return;
        const unmatched = new Set(parts.texts);
        for (const position of links.members) {
          const wanted = normalizeMember(entries[position].text);
          const matches = parts.texts.filter(text => normalizeMember(text.textContent) === wanted);
          if (matches.length === 1) { add(position, matches); unmatched.delete(matches[0]); }
        }
        if (links.header !== null) add(links.header, [parts.box, ...unmatched]);
      });
    } else {
      const lanes = participantParts(svg);
      entries.forEach((entry, position) => {
        if (entry.kind === 'participant' && lanes[entry.participant]) {
          const [lifeline, ...rest] = lanes[entry.participant];
          add(position, [lifeline, hitArea(lifeline), ...rest]);
        }
      });
    }
    return found;
  }

  // ── Pointer interaction ─────────────────────────────────────────────

  function screenBox(element, svg) {
    const box = element.getBBox();
    const matrix = svg.getScreenCTM().inverse().multiply(element.getScreenCTM());
    const corners = [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]]
      .map(([x, y]) => new DOMPoint(x, y).matrixTransform(matrix));
    const xs = corners.map(point => point.x), ys = corners.map(point => point.y);
    return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
  }

  /** Outlines every part of one linked element, under the pointer or for a focused list button. */
  function showOutline(state, position) {
    if (state.outline && state.outlinePosition === position) return;
    hideOutline(state);
    const svg = state.target.querySelector('svg');
    const elements = state.elements.get(position);
    if (!svg || !elements || !svg.getScreenCTM()) return;
    let boxes;
    // An element that is not rendered has no box (Firefox throws).
    try { boxes = elements.filter(element => !element.classList.contains('uml-source-link-hit')).map(element => screenBox(element, svg)); }
    catch { return; }
    const pad = 3;
    const outline = document.createElementNS(SVG_NS, 'rect');
    outline.setAttribute('class', 'uml-source-link-outline');
    outline.setAttribute('x', Math.min(...boxes.map(box => box.left)) - pad);
    outline.setAttribute('y', Math.min(...boxes.map(box => box.top)) - pad);
    outline.setAttribute('width', Math.max(...boxes.map(box => box.right)) - Math.min(...boxes.map(box => box.left)) + pad * 2);
    outline.setAttribute('height', Math.max(...boxes.map(box => box.bottom)) - Math.min(...boxes.map(box => box.top)) + pad * 2);
    svg.append(outline);
    state.outline = outline;
    state.outlinePosition = position;
  }

  function hideOutline(state) {
    if (state.outline) state.outline.remove();
    state.outline = null;
    state.outlinePosition = null;
  }

  function linkedPosition(state, event) {
    const element = event.target.closest && event.target.closest('[data-uml-source-link]');
    return element && state.target.contains(element) ? Number(element.getAttribute('data-uml-source-link')) : null;
  }

  function listen(state) {
    const events = new AbortController();
    const options = { signal: events.signal };
    let press = null;
    state.target.addEventListener('pointerdown', event => { press = { x: event.clientX, y: event.clientY }; }, options);
    state.target.addEventListener('click', event => {
      const position = linkedPosition(state, event);
      const moved = press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > CLICK_SLOP;
      press = null;
      if (position === null || moved) return;
      reveal(state, position);
    }, options);
    state.target.addEventListener('pointerover', event => {
      const position = linkedPosition(state, event);
      if (position === null) hideOutline(state);
      else showOutline(state, position);
    }, options);
    state.target.addEventListener('pointerleave', () => hideOutline(state), options);
    return events;
  }

  /**
   * Created on first use, so pages whose diagrams are never clicked carry no
   * extra live region. The text arrives a moment after the region (and after
   * clearing), so a new region and a repeated message are both announced.
   */
  function announce(text) {
    if (!announcer || !announcer.isConnected) {
      announcer = document.createElement('p');
      announcer.className = 'uml-source-links-status';
      announcer.setAttribute('role', 'status');
      document.body.append(announcer);
    }
    const region = announcer;
    region.textContent = '';
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => { region.textContent = text; }, 100);
  }

  function reveal(state, position) {
    const entry = state.entries[position];
    if (!entry || state.onReveal(entry.source, entry) === false) return;
    announce('Highlighted ' + sourceText(entry.source) + ': ' + entry.label + '.');
  }

  // ── Keyboard list ───────────────────────────────────────────────────

  function locationList(host) {
    let panel = Array.from(host.children).find(element => element.classList.contains('uml-source-links'));
    if (panel) return panel;
    panel = document.createElement('details');
    panel.className = 'uml-source-links';
    panel.append(document.createElement('summary'), document.createElement('ul'));
    host.append(panel);
    return panel;
  }

  function renderList(state, host) {
    const panel = locationList(host);
    const list = panel.querySelector('ul');
    // A re-render must not drop the keyboard focus of a learner in the list.
    const focused = list.contains(document.activeElement) ? document.activeElement.textContent : null;
    // Every linked line is listed, including ones the drawing does not expose
    // as their own element (a merged inheritance tree, say).
    panel.hidden = !state.entries.length;
    panel.querySelector('summary').textContent = 'Code locations (' + state.entries.length + ')';
    list.replaceChildren(...state.entries.map((entry, position) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = entry.label + ' — ' + sourceText(entry.source);
      button.addEventListener('click', () => reveal(state, position));
      // Sighted keyboard users see which drawn element the focused link names.
      button.addEventListener('focus', () => showOutline(state, position));
      button.addEventListener('blur', () => hideOutline(state));
      item.append(button);
      return item;
    }));
    if (focused !== null) {
      const same = Array.from(list.querySelectorAll('button')).find(button => button.textContent === focused);
      (same || panel.querySelector('summary')).focus({ preventScroll: true });
    }
  }

  // ── Public entry points ─────────────────────────────────────────────

  /**
   * Link the SVG just rendered into target. syntax is the rendered text;
   * sources belong to sourceSyntax (default: syntax). Replaces any earlier
   * links on target. Returns { entries, destroy }.
   */
  function link(target, { type, syntax, sourceSyntax = syntax, sources = [], onReveal, canReveal = () => true, listHost = null }) {
    unlink(target);
    const aligned = alignSources(sourceSyntax, sources, syntax);
    const entries = describe(type, syntax, aligned).filter(entry => canReveal(entry.source));
    const svg = target.querySelector('svg');
    const elements = svg ? locateElements(svg, type, entries) : new Map();
    elements.forEach((parts, position) => parts.forEach(element => {
      element.setAttribute('data-uml-source-link', position);
      element.classList.add('uml-source-link');
    }));
    const state = { target, entries, elements, onReveal, outline: null, outlinePosition: null };
    if (listHost) renderList(state, listHost);
    state.events = listen(state);
    states.set(target, state);
    return { entries, destroy: () => unlink(target) };
  }

  function unlink(target) {
    const state = states.get(target);
    if (!state) return;
    state.events.abort();
    hideOutline(state);
    states.delete(target);
  }

  /** Remove a target's keyboard list, for a host that shows no diagram. */
  function clearList(host) {
    const panel = host && Array.from(host.children).find(element => element.classList.contains('uml-source-links'));
    if (panel) panel.hidden = true;
  }

  function clearHighlight() {
    if (!activeHighlight) return;
    activeHighlight.decorations.clear();
    activeHighlight.listener.dispose();
    activeHighlight = null;
  }

  /**
   * Mark source's lines in a Monaco editor showing its file, scroll them into
   * view, and clear the mark on the next highlight or edit. The mark is a
   * gutter bar and a frame above and below the lines: shapes, so it does not
   * rely on color alone, and no tint, so token colors keep their contrast.
   */
  function highlightEditor(editor, monaco, source) {
    clearHighlight();
    const model = editor.getModel();
    const last = model.getLineCount();
    const start = Math.min(Math.max(1, source.startLine), last);
    const end = Math.min(Math.max(start, source.endLine), last);
    const edge = (line, className) => ({ range: new monaco.Range(line, 1, line, 1), options: { isWholeLine: true, className } });
    const decorations = editor.createDecorationsCollection([{
      range: new monaco.Range(start, 1, end, model.getLineMaxColumn(end)),
      options: { isWholeLine: true, className: 'uml-source-highlight-line', linesDecorationsClassName: 'uml-source-highlight-gutter' }
    }, edge(start, 'uml-source-highlight-start'), edge(end, 'uml-source-highlight-end')]);
    activeHighlight = { decorations, listener: editor.onDidChangeModelContent(clearHighlight) };
    editor.revealLinesInCenterIfOutsideViewport(start, end);
    // A content-sized editor does not scroll itself: bring the lines into the
    // page's view once Monaco has drawn the mark (it draws on a later frame).
    const highlight = activeHighlight;
    let frames = 0;
    (function scrollToMark() {
      if (activeHighlight !== highlight) return;
      const mark = editor.getDomNode() && editor.getDomNode().querySelector('.uml-source-highlight-gutter');
      if (mark) mark.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      else if (++frames < 10) requestAnimationFrame(scrollToMark);
    })();
  }

  /** Select source's lines in a plain textarea, the editor's no-Monaco fallback. */
  function highlightTextarea(textarea, source) {
    const lines = textarea.value.split('\n');
    const start = Math.min(Math.max(1, source.startLine), lines.length) - 1;
    const end = Math.min(Math.max(start + 1, source.endLine), lines.length);
    const offset = count => lines.slice(0, count).reduce((total, line) => total + line.length + 1, 0);
    textarea.focus({ preventScroll: true });
    textarea.setSelectionRange(offset(start), offset(end) - 1);
    textarea.scrollIntoView({ block: 'nearest' });
  }

  const api = { alignSources, describe, link, unlink, clearList, highlightEditor, highlightTextarea, clearHighlight, sourceText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.UMLSourceLinks = api;
})(typeof window !== 'undefined' ? window : globalThis);
