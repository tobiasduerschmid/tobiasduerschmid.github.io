/** Object-reference diagrams. Identity comes from the trace, never from values.
 * The graph is a visual supplement to the lab's complete Reference details.
 */
(function () {
  'use strict';
  // Layout and painting are one deployable component. Keeping the pure
  // planner here prevents an older embedding page from loading a renderer
  // whose new routing dependency is missing. The Node export tests the same
  // planner the browser executes, without a DOM or a second implementation.
  /** Route vertically disjoint cards with unobstructed right-facing slot ports.
   * Each visible reference retains a path. Vertical travel stays outside all
   * cards; only references to the same target may share a bus. The returned
   * gutter is part of the layout contract, not optional decorative padding.
   * See docs/object-reference-layout.md for constraints and research rationale.
   */
  function planReferences(nodes, references, options = {}) {
    const clearance = options.clearance || 12;
    const laneGap = options.laneGap || 18;
    const byId = new Map(nodes.map(node => [node.id, node]));
    const right = Math.max(0, ...nodes.map(node => node.x + node.width));
    const groups = new Map();
    references.forEach(reference => {
      const target = byId.get(reference.target);
      const source = byId.get(reference.source);
      if (!source || !target) throw new Error('Reference endpoint is missing: ' + reference.id);
      const landing = { x: target.x + target.width + 2, y: target.y + Math.min(20, target.height / 2) };
      if (!groups.has(target.id)) groups.set(target.id, { target: target.id, landing, references: [] });
      groups.get(target.id).references.push(reference);
    });
    const buses = Array.from(groups.values());
    buses.forEach(bus => {
      const positions = [bus.landing.y, ...bus.references.map(reference => reference.start.y)];
      bus.top = Math.min(...positions);
      bus.bottom = Math.max(...positions);
    });
    // Nest shorter buses inside longer ones. This keeps simple cycles and
    // nested sharing crossing-free instead of putting the outer loop inside.
    buses.sort((a, b) => (a.bottom - a.top) - (b.bottom - b.top) || a.top - b.top || a.target.localeCompare(b.target));
    const lanes = [];
    const routes = [];
    buses.forEach(bus => {
      let lane = lanes.findIndex(intervals => intervals.every(interval =>
        interval.bottom + clearance < bus.top || bus.bottom + clearance < interval.top));
      if (lane === -1) { lane = lanes.length; lanes.push([]); }
      lanes[lane].push(bus);
      const railX = right + clearance + lane * laneGap;
      bus.references.forEach(reference => {
        const points = [reference.start, { x: railX, y: reference.start.y },
          { x: railX, y: bus.landing.y }, bus.landing];
        routes.push({ ...reference, points });
      });
    });
    const bridges = [];
    const seen = new Set();
    routes.forEach(horizontalRoute => {
      routes.forEach(verticalRoute => {
        if (horizontalRoute.target === verticalRoute.target) return;
        const vertical = [verticalRoute.points[1], verticalRoute.points[2]];
        const x = vertical[0].x;
        [[horizontalRoute.points[0], horizontalRoute.points[1]],
          [horizontalRoute.points[2], horizontalRoute.points[3]]].forEach(horizontal => {
          const y = horizontal[0].y;
          // Only same-target buses intentionally join. An independent bus
          // endpoint on another shaft is still an ambiguous T intersection.
          if (x <= Math.min(horizontal[0].x, horizontal[1].x)
              || x >= Math.max(horizontal[0].x, horizontal[1].x)
              || y < Math.min(vertical[0].y, vertical[1].y)
              || y > Math.max(vertical[0].y, vertical[1].y)) return;
          const key = x + ':' + y;
          if (!seen.has(key)) { bridges.push({ x, y }); seen.add(key); }
        });
      });
    });
    return { routes, bridges, gutter: lanes.length ? clearance * 2 + (lanes.length - 1) * laneGap : 0 };
  }


  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { plan: planReferences };
    return;
  }
  if (window.ObjectReferenceGraph) return;
  const SVG = 'http://www.w3.org/2000/svg';
  let graphNumber = 0;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function svgElement(tag, attributes) {
    const node = document.createElementNS(SVG, tag);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  }

  function objectTitle(object) {
    return object.id + ' · ' + object.type;
  }

  function describeObject(object) {
    const parts = [objectTitle(object)];
    if (object.value !== undefined) parts.push(String(object.value));
    (object.entries || []).forEach(entry => parts.push(entry.label + ' → ' + entry.target));
    if (object.note) parts.push(object.note);
    return parts.join('; ');
  }

  /** Plain text is shared by the accessible state view and printed history. */
  function describeState(step) {
    const lines = [];
    step.scopes.forEach(scope => {
      lines.push(scope.name + ': ' + (scope.bindings.length
        ? scope.bindings.map(binding => binding.name + ' → ' + binding.target).join('; ')
        : 'no names bound'));
    });
    step.objects.forEach(object => lines.push(describeObject(object)));
    if (!step.objects.length) lines.push('No objects are reachable from the displayed names yet.');
    if (step.note) lines.push(step.note);
    return lines.join('\n');
  }

  const PRIMITIVES = new Set(['str', 'bytes', 'int', 'float', 'complex', 'bool', 'NoneType']);
  const INCIDENTAL = new Set(['function', 'builtin_function_or_method', 'method', 'module']);

  /** The compact view changes presentation only; describeState retains every
   * recorded identity, scope, and edge for the text and print alternatives. */
  class ReferenceGraph {
    constructor(host, { interactive = true } = {}) {
      this.host = host;
      this.interactive = interactive;
      this.prefix = 'orl-graph-' + (++graphNumber);
      this.objects = new Map();
      this.previous = new Map();
      this.previousBindings = new Map();
      this.selected = null;
      this.gutter = 0;
      this.frame = 0;
      this.listeners = new AbortController();
      this.referenceArrow = this.prefix + '-reference-arrow';
      this.overlay = svgElement('svg', { class: 'orl-reference-edges', 'aria-hidden': 'true' });
      this.overlay.classList.toggle('is-static', !interactive);
      const marker = svgElement('marker', {
        id: this.referenceArrow, viewBox: '0 0 10 10', refX: 9, refY: 5,
        markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse'
      });
      marker.append(svgElement('path', { d: 'M 0 0 L 10 5 L 0 10 z' }));
      const defs = svgElement('defs', {});
      defs.append(marker);
      this.referencePaths = svgElement('g', {});
      this.overlay.append(defs, this.referencePaths);
      this.host.append(this.overlay);
      if (interactive) {
        this.host.removeAttribute('aria-hidden');
        this.host.addEventListener('click', event => {
          const button = event.target.closest('[data-reference-target]');
          if (button && this.host.contains(button)) this.follow(button.dataset.referenceTarget);
        }, { signal: this.listeners.signal });
        this.host.addEventListener('focusin', event => {
          if (event.target.dataset.referenceId) this.highlight(event.target.dataset.referenceId);
        }, { signal: this.listeners.signal });
        this.resizeObserver = new ResizeObserver(() => this.drawEdges());
        this.resizeObserver.observe(host);
      } else {
        this.host.setAttribute('aria-hidden', 'true');
      }
    }

    reset() {
      cancelAnimationFrame(this.frame);
      this.objects.clear();
      this.previous.clear();
      this.previousBindings.clear();
      this.selected = null;
      this.gutter = 0;
      this.host.style.setProperty('--orl-route-gutter', '0px');
      this.referencePaths.replaceChildren();
      this.host.replaceChildren(this.overlay);
    }

    render(step) {
      this.nodes = new Map(step.objects.map(object => [object.id, object]));
      // Methods and runtime namespaces distract from data sharing. A class
      // remains visible when it actually contributes data attributes.
      this.hidden = new Set(step.objects.filter(object => INCIDENTAL.has(object.type)).map(object => object.id));
      step.objects.filter(object => object.type.startsWith('class ')).forEach(object => {
        if (object.entries && !object.entries.some(entry => !this.hidden.has(entry.target))) this.hidden.add(object.id);
      });
      const aliases = new Map();
      const atoms = element('div', 'orl-atoms');
      const currentBindings = new Map();
      step.scopes.forEach(scope => scope.bindings.forEach(binding => {
        const target = this.nodes.get(binding.target);
        if (!target || this.hidden.has(target.id)) return;
        const key = scope.id + ':' + binding.name;
        currentBindings.set(key, binding.target);
        const label = this.bindingLabel(binding, scope, key);
        if (PRIMITIVES.has(target.type)) {
          label.append(element('span', 'orl-inline-arrow', '→'), this.primitive(target));
          atoms.append(label);
        } else {
          const slot = element('span', 'orl-name-slot');
          slot.setAttribute('aria-hidden', 'true');
          label.append(slot, element('span', 'sr-only', ' refers to ' + target.id));
          if (!aliases.has(target.id)) aliases.set(target.id, []);
          aliases.get(target.id).push(label);
        }
      }));
      const visible = step.objects.filter(object => !PRIMITIVES.has(object.type) && !this.hidden.has(object.id));
      // Stable identity order avoids reordering survivors when a name moves.
      visible.sort((left, right) => Number(left.id.slice(1)) - Number(right.id.slice(1)));
      const live = new Set(visible.map(object => object.id));
      this.objects.forEach((view, id) => {
        if (!live.has(id)) { view.row.remove(); this.objects.delete(id); }
      });
      this.host.querySelector('.orl-atoms')?.remove();
      this.host.querySelector('.orl-empty-state')?.remove();
      if (atoms.childElementCount) this.host.prepend(atoms);
      visible.forEach(object => this.renderObject(object, aliases.get(object.id) || []));
      if (!visible.length && !atoms.childElementCount) {
        this.host.append(element('p', 'orl-empty orl-empty-state', 'No data references to show yet.'));
      }
      this.previous = new Map(step.objects.map(object => [object.id, JSON.stringify(object)]));
      this.previousBindings = currentBindings;
      if (!live.has(this.selected)) this.selected = null;
      cancelAnimationFrame(this.frame);
      if (this.interactive) this.frame = requestAnimationFrame(() => this.drawEdges());
    }

    bindingLabel(binding, scope, key) {
      const label = element('span', 'orl-binding');
      label.append(element('span', 'orl-reference-name', binding.name));
      if (scope.id !== 'global') label.append(element('span', 'orl-scope-label', '(' + scope.name + ')'));
      const previous = this.previousBindings.get(key);
      label.classList.toggle('is-changed', previous !== undefined && previous !== binding.target);
      return label;
    }

    primitive(object) {
      return element('span', 'orl-primitive', String(object.value));
    }

    createObject(object) {
      const row = element('div', 'orl-object-row');
      row.dataset.objectId = object.id;
      const svg = svgElement('svg', { class: 'orl-local-edges', 'aria-hidden': 'true' });
      const markerId = this.prefix + '-' + object.id + '-arrow';
      const marker = svgElement('marker', {
        id: markerId, viewBox: '0 0 10 10', refX: 9, refY: 5,
        markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse'
      });
      marker.append(svgElement('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: 'orl-arrowhead' }));
      const defs = svgElement('defs', {});
      defs.append(marker);
      const paths = svgElement('g', {});
      svg.append(defs, paths);
      const aliases = element('div', 'orl-aliases');
      const card = element('section', 'orl-object');
      card.id = this.prefix + '-' + object.id;
      if (this.interactive) card.tabIndex = -1;
      row.append(svg, aliases, card);
      const view = { row, aliases, card, svg, paths, markerId };
      this.objects.set(object.id, view);
      return view;
    }

    renderObject(object, aliases) {
      const view = this.objects.get(object.id) || this.createObject(object);
      this.host.append(view.row);
      view.aliases.replaceChildren(...aliases);
      view.row.classList.toggle('has-aliases', aliases.length > 0);
      view.card.setAttribute('aria-label', object.id + ': ' + object.type);
      const previous = this.previous.get(object.id);
      const changed = previous !== undefined && previous !== JSON.stringify(object);
      view.card.classList.toggle('is-new', previous === undefined);
      view.card.classList.toggle('is-changed', changed);
      view.card.classList.toggle('is-selected', this.selected === object.id);
      const title = element('p', 'orl-object-title');
      title.append(element('span', 'orl-object-id', object.id), element('span', 'orl-object-type', object.type));
      if (changed) title.append(element('span', 'orl-badge', 'changed'));
      view.card.replaceChildren(title);
      const entries = element('div', 'orl-entries');
      entries.classList.toggle('orl-sequence', object.type === 'list' || object.type === 'tuple');
      (object.entries || []).forEach(entry => {
        const target = this.nodes.get(entry.target);
        if (!target || this.hidden.has(entry.target)) return;
        const row = element('div', 'orl-entry');
        row.append(element('span', 'orl-reference-name', entry.label === '__class__' ? 'class' : entry.label));
        if (PRIMITIVES.has(target.type)) row.append(this.primitive(target));
        else {
          row.classList.add('has-reference');
          const follow = element(this.interactive ? 'button' : 'span', 'orl-reference-target', '→ ' + entry.target);
          if (this.interactive) follow.type = 'button';
          follow.dataset.referenceTarget = entry.target;
          follow.dataset.referenceId = object.id + ':' + entry.label;
          follow.setAttribute('aria-label', 'Follow ' + entry.label + ' to ' + entry.target + ': ' + target.type);
          row.append(follow);
        }
        entries.append(row);
      });
      if (entries.childElementCount) view.card.append(entries);
      else if (object.entries) view.card.append(element('p', 'orl-empty', 'Empty'));
      if (object.value !== undefined) view.card.append(element('p', 'orl-value', String(object.value)));
      if (object.note) view.card.append(element('p', 'orl-empty', object.note));
      if (this.interactive && (changed || previous === undefined) && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        view.card.animate([{ opacity: 0.55 }, { opacity: 1 }], { duration: 220 });
      }
    }

    follow(identity) {
      const target = this.objects.get(identity);
      if (!target) return;
      this.selected = identity;
      this.objects.forEach((view, id) => view.card.classList.toggle('is-selected', id === identity));
      this.referencePaths.querySelectorAll('.orl-reference-edge').forEach(path => {
        path.classList.toggle('is-selected', path.dataset.targetObject === identity);
      });
      target.card.focus({ preventScroll: true });
      target.card.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    }

    /** Measure a static snapshot synchronously after its print layout is visible.
     * Gutter reservation can change card wrapping, so remeasure until stable.
     * Each pass can add at most one of the finite target-object routing lanes. */
    layout() {
      cancelAnimationFrame(this.frame);
      if (!this.host.getBoundingClientRect().width) return;
      for (let pass = 0; pass <= this.objects.size; pass += 1) {
        if (this.drawEdges()) break;
      }
    }

    drawEdges() {
      if (!this.host.getBoundingClientRect().width) return true;
      // Alias arrows stay local to their object; member arrows are routed in
      // the reserved exterior gutter by drawReferences below.
      this.objects.forEach(view => {
        const bounds = view.row.getBoundingClientRect();
        const card = view.card.getBoundingClientRect();
        view.svg.setAttribute('width', bounds.width);
        view.svg.setAttribute('height', bounds.height);
        view.paths.replaceChildren();
        const slots = Array.from(view.aliases.querySelectorAll('.orl-name-slot'));
        const aliases = view.aliases.getBoundingClientRect();
        if (slots.length && aliases.bottom <= card.top) {
          // A shared rail stays outside the labels when aliases stack. Branches
          // merge here instead of sending diagonal lines through other names.
          const railX = aliases.right - bounds.left - 4;
          const railY = (aliases.bottom + card.top) / 2 - bounds.top;
          const targetX = card.left + card.width / 2 - bounds.left;
          const targetY = card.top - bounds.top - 2;
          const starts = slots.map(slot => {
            const source = slot.getBoundingClientRect();
            return [source.right - bounds.left, source.top + source.height / 2 - bounds.top];
          });
          starts.forEach(([x, y]) => view.paths.append(svgElement('path', {
            class: 'orl-edge', d: 'M ' + x + ' ' + y + ' H ' + railX
          })));
          view.paths.append(svgElement('path', {
            class: 'orl-edge',
            d: 'M ' + railX + ' ' + Math.min(...starts.map(point => point[1]))
              + ' V ' + railY + ' H ' + targetX + ' V ' + targetY,
            'marker-end': 'url(#' + view.markerId + ')'
          }));
          return;
        }
        slots.forEach(slot => {
          const source = slot.getBoundingClientRect();
          const horizontal = source.right <= card.left;
          const x1 = (horizontal ? source.right : source.left + source.width / 2) - bounds.left;
          const y1 = (horizontal ? source.top + source.height / 2 : source.bottom) - bounds.top;
          const x2 = (horizontal ? card.left - 2 : card.left + card.width / 2) - bounds.left;
          const y2 = (horizontal ? card.top + card.height / 2 : card.top - 2) - bounds.top;
          const middleX = (x1 + x2) / 2;
          const middleY = (y1 + y2) / 2;
          const curve = horizontal
            ? [middleX, y1, middleX, y2, x2, y2]
            : [x1, middleY, x2, middleY, x2, y2];
          view.paths.append(svgElement('path', {
            class: 'orl-edge', d: 'M ' + x1 + ' ' + y1 + ' C ' + curve.join(' '),
            'marker-end': 'url(#' + view.markerId + ')'
          }));
        });
      });
      return this.drawReferences();
    }

    highlight(referenceId) {
      this.referencePaths.querySelectorAll('.orl-reference-edge').forEach(path => {
        path.classList.toggle('is-selected', path.dataset.referenceId === referenceId);
      });
    }

    drawReferences() {
      const bounds = this.host.getBoundingClientRect();
      if (!bounds.width) return true;
      const nodes = Array.from(this.objects, ([id, view]) => {
        const rect = view.card.getBoundingClientRect();
        return { id, x: rect.left - bounds.left, y: rect.top - bounds.top,
          width: rect.width, height: rect.height };
      });
      const references = Array.from(this.host.querySelectorAll('[data-reference-target]'), button => {
        const rect = button.getBoundingClientRect();
        return { id: button.dataset.referenceId,
          source: button.closest('.orl-object-row').dataset.objectId,
          target: button.dataset.referenceTarget,
          start: { x: rect.right - bounds.left, y: rect.top + rect.height / 2 - bounds.top } };
      });
      const routing = planReferences(nodes, references);
      // Keep gutter width stable while stepping; a reset starts fresh.
      if (routing.gutter > this.gutter) {
        this.gutter = routing.gutter;
        this.host.style.setProperty('--orl-route-gutter', this.gutter + 'px');
        cancelAnimationFrame(this.frame);
        if (this.interactive) this.frame = requestAnimationFrame(() => this.drawEdges());
        return false;
      }
      // A print page can narrow after beforeprint without dispatching resize.
      // Static ports are right-aligned, so their small SVG keeps a right-edge
      // coordinate origin instead of retaining the screen viewport's width.
      const left = this.interactive || !routing.routes.length ? 0
        : Math.min(...routing.routes.flatMap(route => route.points.map(point => point.x))) - 2;
      this.overlay.setAttribute('width', bounds.width - left);
      this.overlay.setAttribute('height', bounds.height);
      this.referencePaths.replaceChildren();
      routing.routes.forEach(route => {
        const path = svgElement('path', {
          class: 'orl-reference-edge',
          d: route.points.map((point, index) => (index ? 'L ' : 'M ') + (point.x - left) + ' ' + point.y).join(' '),
          'marker-end': 'url(#' + this.referenceArrow + ')',
          'data-reference-id': route.id, 'data-source-object': route.source,
          'data-target-object': route.target
        });
        path.classList.toggle('is-selected', this.selected === route.target);
        this.referencePaths.append(path);
      });
      routing.bridges.forEach(({ x, y }) => {
        x -= left;
        this.referencePaths.append(svgElement('path', {
          class: 'orl-edge-bridge-mask', d: 'M ' + (x - 7) + ' ' + y + ' H ' + (x + 7)
        }));
        this.referencePaths.append(svgElement('path', {
          class: 'orl-edge-bridge',
          d: 'M ' + (x - 7) + ' ' + y + ' Q ' + x + ' ' + (y - 9) + ' ' + (x + 7) + ' ' + y
        }));
      });
      if (this.interactive) {
        const scroll = this.host.parentElement;
        if (scroll.scrollWidth > scroll.clientWidth + 1) scroll.tabIndex = 0;
        else scroll.removeAttribute('tabindex');
      }
      return true;
    }

    destroy() {
      cancelAnimationFrame(this.frame);
      if (this.resizeObserver) this.resizeObserver.disconnect();
      this.listeners.abort();
    }
  }

  window.ObjectReferenceGraph = { ReferenceGraph, describeState };
}());
