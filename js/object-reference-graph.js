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
    const clearance = options.clearance || 20;
    const laneGap = options.laneGap || 18;
    const byId = new Map(nodes.map(node => [node.id, node]));
    const right = Math.max(0, ...nodes.map(node => node.x + node.width));
    const groups = new Map();
    references.forEach(reference => {
      const target = byId.get(reference.target);
      const source = byId.get(reference.source);
      if (!source || !target) throw new Error('Reference endpoint is missing: ' + reference.id);
      const landing = { x: target.x + target.width, y: target.y + Math.min(20, target.height / 2) };
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

  // Round only inside the reserved orthogonal corridor. Endpoints stay exact,
  // and short segments limit the radius rather than cutting across a card.
  function roundedRoute(points, offsetX = 0) {
    const clean = [];
    points.forEach(point => {
      const last = clean.at(-1), before = clean.at(-2);
      if (last && Math.hypot(point.x - last.x, point.y - last.y) < 0.001) return;
      if (before && Math.abs((last.x - before.x) * (point.y - last.y)
          - (last.y - before.y) * (point.x - last.x)) < 0.001
          && (last.x - before.x) * (point.x - last.x) + (last.y - before.y) * (point.y - last.y) >= 0) clean.pop();
      clean.push(point);
    });
    points = clean;
    const point = p => (p.x - offsetX) + ' ' + p.y;
    let path = 'M ' + point(points[0]);
    for (let index = 1; index < points.length - 1; index += 1) {
      const before = points[index - 1], corner = points[index], after = points[index + 1];
      const incoming = Math.hypot(corner.x - before.x, corner.y - before.y);
      const outgoing = Math.hypot(after.x - corner.x, after.y - corner.y);
      const radius = Math.min(6, incoming / 2, outgoing / 2);
      if (!radius) { path += ' L ' + point(corner); continue; }
      const start = { x: corner.x + (before.x - corner.x) * radius / incoming,
        y: corner.y + (before.y - corner.y) * radius / incoming };
      const end = { x: corner.x + (after.x - corner.x) * radius / outgoing,
        y: corner.y + (after.y - corner.y) * radius / outgoing };
      path += ' L ' + point(start) + ' Q ' + point(corner) + ' ' + point(end);
    }
    return path + ' L ' + point(points[points.length - 1]);
  }

  function paintArrow(path, points) {
    path.setAttribute('d', roundedRoute(points));
    // The marker tip is the logical endpoint. Stop the shaft under the wide
    // part of the head, otherwise even a butt cap protrudes through its tip.
    const length = path.getTotalLength();
    path.setAttribute('stroke-dasharray', Math.max(0, length - 7) + ' ' + (length + 7));
  }

  // Match bends by distance along the line, not array index. Inserting/removing
  // an elbow must not truncate the old shape or teleport part of the connector.
  function interpolateRoute(from, to, progress) {
    if (!from || progress >= 1) return to;
    const parameterize = points => {
      const lengths = [0];
      points.slice(1).forEach((point, i) => lengths.push(lengths[i]
        + Math.hypot(point.x - points[i].x, point.y - points[i].y)));
      const total = lengths.at(-1) || 1;
      return { points, stops: lengths.map(length => length / total) };
    };
    const old = parameterize(from), next = parameterize(to);
    const sample = (route, t) => {
      let i = 1;
      while (i < route.stops.length - 1 && route.stops[i] < t) i += 1;
      const a = route.points[i - 1], b = route.points[i];
      const part = (t - route.stops[i - 1]) / (route.stops[i] - route.stops[i - 1] || 1);
      return { x: a.x + (b.x - a.x) * part, y: a.y + (b.y - a.y) * part };
    };
    return [...new Set([...old.stops, ...next.stops])].sort((a, b) => a - b).map(t => {
      const a = sample(old, t), b = sample(next, t);
      return { x: a.x + (b.x - a.x) * progress, y: a.y + (b.y - a.y) * progress };
    });
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

  // The engine is a local, pinned asset. Embedders still load this one renderer;
  // its dependency cannot silently disappear from an older page's script list.
  const assetRoot = new URL('.', document.currentScript.src);
  let enginePromise;
  function layoutEngine() {
    if (!enginePromise) enginePromise = import(new URL('vendor/elk/0.12.0/elk-api.mjs', assetRoot).href)
      .then(({ default: ELK }) => new ELK({
        workerUrl: new URL('vendor/elk/0.12.0/elk-worker.min.js', assetRoot).href,
        algorithms: ['layered']
      })).catch(error => { enginePromise = null; throw error; });
    return enginePromise;
  }

  const layouts = new Map();
  async function arrange(model) {
    const key = JSON.stringify(model);
    if (!layouts.has(key)) {
      const pending = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Layout timed out.')), 7000);
        layoutEngine().then(engine => engine.layout(model)).then(resolve, reject)
          .finally(() => clearTimeout(timer));
      });
      layouts.set(key, pending);
      pending.catch(() => layouts.delete(key));
      if (layouts.size > 128) layouts.delete(layouts.keys().next().value);
    }
    return layouts.get(key);
  }

  function visibleObjects(step) {
    const hidden = new Set(step.objects.filter(object => INCIDENTAL.has(object.type)).map(object => object.id));
    step.objects.filter(object => object.type.startsWith('class ')).forEach(object => {
      if (object.entries && !object.entries.some(entry => !hidden.has(entry.target))) hidden.add(object.id);
    });
    return step.objects.filter(object => !hidden.has(object.id));
  }

  function makeView(object, bindings, nodes, interactive) {
    const row = element('div', 'orl-object-row');
    row.dataset.objectId = object.id;
    const aliases = element('div', 'orl-aliases');
    bindings.forEach(({ binding, scope }) => {
      const label = element('span', 'orl-binding');
      label.dataset.bindingId = JSON.stringify([scope.id, binding.name]);
      label.append(element('span', 'orl-reference-name', binding.name));
      if (scope.id !== 'global') label.append(element('span', 'orl-scope-label', '(' + scope.name + ')'));
      const slot = element('span', 'orl-name-slot');
      slot.setAttribute('aria-hidden', 'true');
      label.append(slot, element('span', 'sr-only', ' refers to ' + object.id));
      aliases.append(label);
    });
    const card = element('section', 'orl-object');
    card.classList.toggle('orl-scalar', PRIMITIVES.has(object.type));
    card.setAttribute('aria-label', object.id + ': ' + object.type);
    if (interactive) card.tabIndex = -1;
    const title = element('p', 'orl-object-title');
    title.append(element('span', 'orl-object-id', object.id), element('span', 'orl-object-type', object.type));
    card.append(title);
    const entries = element('div', 'orl-entries');
    (object.entries || []).forEach(entry => {
      const target = nodes.get(entry.target);
      if (!target) return;
      const item = element('div', 'orl-entry has-reference');
      item.append(element('span', 'orl-reference-name', entry.label === '__class__' ? 'class' : entry.label));
      const follow = element(interactive ? 'button' : 'span', 'orl-reference-target', '→ ' + entry.target);
      if (interactive) follow.type = 'button';
      follow.dataset.referenceTarget = entry.target;
      follow.dataset.referenceId = object.id + ':' + entry.label;
      follow.setAttribute('aria-label', 'Follow ' + entry.label + ' to ' + entry.target + ': ' + target.type);
      item.append(follow);
      entries.append(item);
    });
    if (entries.childElementCount) card.append(entries);
    else if (object.entries) card.append(element('p', 'orl-empty', 'Empty'));
    if (object.value !== undefined) card.append(element('p', 'orl-value', String(object.value)));
    if (object.note) card.append(element('p', 'orl-empty', object.note));
    // A reserved annotation line keeps change labels from resizing a card.
    card.append(element('div', 'orl-change-status'));
    row.append(aliases, card);
    return { row, aliases, card, objectSignature: JSON.stringify(object),
      signature: JSON.stringify([object, bindings.map(({ binding, scope }) => [binding, scope.id, scope.name])]) };
  }

  /** Measure an inert candidate away from the live scene. Nothing visible is
   * removed or faded while ELK runs, and stale asynchronous results cannot win. */
  function measureScene(host, step, interactive) {
    const objects = visibleObjects(step);
    const nodes = new Map(objects.map(object => [object.id, object]));
    const bindings = new Map(objects.map(object => [object.id, []]));
    step.scopes.forEach(scope => scope.bindings.forEach(binding => {
      bindings.get(binding.target)?.push({ binding, scope });
    }));
    const stage = element('div', 'orl-measure' + (interactive ? '' : ' orl-static-measure'));
    stage.inert = true;
    stage.setAttribute('aria-hidden', 'true');
    const views = new Map(objects.map(object => [object.id, makeView(object, bindings.get(object.id), nodes, interactive)]));
    views.forEach(view => stage.append(view.row));
    host.closest('.object-reference-lab').append(stage);
    const children = [], edges = [];
    views.forEach((view, id) => {
      const bounds = view.row.getBoundingClientRect();
      const card = view.card.getBoundingClientRect();
      view.width = bounds.width;
      view.height = bounds.height;
      view.cardTop = card.top - bounds.top;
      view.namePorts = Array.from(view.aliases.querySelectorAll('.orl-name-slot'), slot => {
        const box = slot.getBoundingClientRect();
        return { id: slot.parentElement.dataset.bindingId,
          x: box.right - bounds.left, y: box.top + box.height / 2 - bounds.top };
      });
      const ports = [{ id: id + ':in', x: 0, y: view.cardTop + 18, width: 0, height: 0,
        layoutOptions: { 'elk.port.side': 'WEST' } }];
      view.ports = new Map();
      view.card.querySelectorAll('[data-reference-target]').forEach(button => {
        const rect = button.getBoundingClientRect();
        const port = { id: button.dataset.referenceId, x: bounds.width,
          y: rect.top + rect.height / 2 - bounds.top, width: 0, height: 0,
          layoutOptions: { 'elk.port.side': 'EAST' } };
        ports.push(port);
        view.ports.set(port.id, { x: rect.right - bounds.left, y: port.y });
        edges.push({ id: port.id, sources: [port.id], targets: [button.dataset.referenceTarget + ':in'] });
      });
      children.push({ id, width: bounds.width, height: bounds.height, ports,
        layoutOptions: { 'elk.portConstraints': 'FIXED_POS' } });
    });
    stage.remove();
    return { views, model: { id: 'references', children, edges, layoutOptions: {
      'elk.algorithm': 'layered', 'elk.direction': 'RIGHT', 'elk.edgeRouting': 'ORTHOGONAL',
      'elk.padding': '[top=14,left=14,bottom=14,right=14]',
      // Two lanes need 20px of card clearance on each side plus 16px between
      // edges. Reserve that space before an append adds a crossing.
      'elk.spacing.nodeNode': '24', 'elk.layered.spacing.nodeNodeBetweenLayers': '56',
      'elk.layered.spacing.edgeNodeBetweenLayers': '20', 'elk.spacing.edgeEdge': '16',
      'elk.layered.spacing.edgeEdgeBetweenLayers': '16',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.mergeEdges': 'true', 'elk.randomSeed': '1'
    } } };
  }

  function seedPositions(model, previous) {
    if (!previous.size) return model;
    // Anchor the object, not the enclosing row: adding a name above a card
    // should consume available space above it instead of pushing the card down.
    const positions = new Map(model.children.filter(node => previous.has(node.id)).map(node => {
      const old = previous.get(node.id);
      return [node.id, { x: old.x, y: old.y + old.cardTop - (node.ports[0].y - 18) }];
    }));
    const known = model.children.filter(node => positions.has(node.id));
    if (!known.length) return model;
    const ports = new Map(model.children.flatMap(node => node.ports.map(port => [port.id, { node, port }])));
    model.children.forEach((node, index) => {
      if (positions.has(node.id)) return;
      const neighbors = model.edges.flatMap(edge => {
        const source = ports.get(edge.sources[0]), target = ports.get(edge.targets[0]);
        if (target.node.id === node.id && positions.has(source.node.id)) {
          const from = positions.get(source.node.id);
          return [{ x: from.x + source.node.width + 36, y: from.y + source.port.y - target.port.y }];
        }
        if (source.node.id === node.id && positions.has(target.node.id)) {
          const to = positions.get(target.node.id);
          return [{ x: to.x - node.width - 36, y: to.y + target.port.y - source.port.y }];
        }
        return [];
      });
      positions.set(node.id, neighbors.length ? {
        x: neighbors.reduce((sum, point) => sum + point.x, 0) / neighbors.length,
        y: neighbors.reduce((sum, point) => sum + point.y, 0) / neighbors.length
      } : { x: 14, y: Math.max(...Array.from(positions.values(), point => point.y)) + 100 + index });
    });
    return { ...model, children: model.children.map(node => {
      const position = positions.get(node.id);
      return { ...node, ...position, layoutOptions: { ...node.layoutOptions,
        'elk.position': '(' + position.x + ',' + position.y + ')' } };
    }), layoutOptions: { ...model.layoutOptions,
      'elk.layered.layering.strategy': 'INTERACTIVE',
      'elk.layered.crossingMinimization.strategy': 'INTERACTIVE',
      'elk.layered.nodePlacement.strategy': 'INTERACTIVE',
      'elk.layered.interactiveReferencePoint': 'TOP_LEFT',
      'elk.layered.crossingMinimization.greedySwitch.type': 'OFF',
      'elk.separateConnectedComponents': 'false'
    } };
  }

  // ELK normalizes each result to its padding. Undo gratuitous whole-diagram
  // translation where there is room, moving routes and nodes as one rigid scene.
  function anchorScene(layout, previous, available) {
    const survivors = layout.children.filter(node => previous.has(node.id));
    if (!survivors.length) return layout;
    const median = values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
    const points = layout.edges.flatMap(edge => edge.sections.flatMap(section =>
      [section.startPoint, ...(section.bendPoints || []), section.endPoint]));
    const minX = Math.min(...layout.children.map(node => node.x), ...points.map(point => point.x));
    const minY = Math.min(...layout.children.map(node => node.y), ...points.map(point => point.y));
    const dx = Math.min(Math.max(14 - minX,
      median(survivors.map(node => previous.get(node.id).x - node.x))), Math.max(0, available - layout.width));
    const dy = Math.max(14 - minY, median(survivors.map(node => {
      const old = previous.get(node.id);
      return old.y + old.cardTop - node.y - (node.ports[0].y - 18);
    })));
    const translate = point => ({ ...point, x: point.x + dx, y: point.y + dy });
    return { ...layout, width: layout.width + dx, height: layout.height + dy,
      children: layout.children.map(translate), edges: layout.edges.map(edge => ({ ...edge,
        sections: edge.sections.map(section => ({ ...section,
          startPoint: translate(section.startPoint), endPoint: translate(section.endPoint),
          bendPoints: section.bendPoints?.map(translate)
        })) })) };
  }

  function placementCost(layout, previous) {
    const survivors = layout.children.filter(node => previous.has(node.id));
    // Existing objects are landmarks. A little spare space is preferable to
    // moving them, but a very tall frozen arrangement should still compact.
    const movement = survivors.reduce((sum, node) => {
      const old = previous.get(node.id);
      return sum + Math.hypot(node.x - old.x, node.y + node.ports[0].y - 18 - old.y - old.cardTop);
    }, 0);
    return movement + 0.15 * (layout.width + layout.height);
  }

  async function incrementalLayout(model, previous, available, direction) {
    const directed = { ...model, layoutOptions: { ...model.layoutOptions, 'elk.direction': direction } };
    const seeded = seedPositions(directed, previous);
    if (!previous.size) return { ...await arrange(directed), kind: direction };
    // Compare constrained placement with a compact, order-preserving alternative.
    // Both retain ELK's obstacle-safe routes; never shift individual cards after routing.
    const compact = { ...seeded, layoutOptions: { ...seeded.layoutOptions,
      'elk.layered.layering.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.crossingMinimization.semiInteractive': 'true',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX'
    } };
    const choices = (await Promise.all([arrange(seeded), arrange(compact)]))
      .map(layout => ({ ...anchorScene(layout, previous, available), kind: direction }));
    choices.sort((a, b) => Number(a.width > available + 1) - Number(b.width > available + 1)
      || placementCost(a, previous) - placementCost(b, previous));
    return choices[0];
  }

  // Bounded insertion sweeps reduce wire length in the narrow fallback. Ties
  // retain trace order; this is a heuristic, never a claim of a global optimum.
  function neighborOrder(model, previous = []) {
    let order = model.children;
    const byId = new Map(order.map(node => [node.id, node]));
    const survivors = previous.filter(id => byId.has(id));
    if (survivors.length) order = [...survivors.map(id => byId.get(id)), ...order.filter(node => !survivors.includes(node.id))];
    const endpoints = model.edges.map(edge => [edge.sources[0].split(':')[0], edge.targets[0].split(':')[0]]);
    const cost = nodes => {
      let y = 0;
      const centers = new Map(nodes.map(node => {
        const center = y + node.height / 2;
        y += node.height + 24;
        return [node.id, center];
      }));
      return endpoints.reduce((sum, [source, target]) => sum + Math.abs(centers.get(source) - centers.get(target)), 0);
    };
    let best = cost(order);
    for (let sweep = 0; sweep < 2; sweep += 1) {
      for (const node of [...order]) {
        if (survivors.includes(node.id)) continue;
        const without = order.filter(item => item !== node);
        for (let at = 0; at <= without.length; at += 1) {
          const candidate = [...without.slice(0, at), node, ...without.slice(at)];
          const value = cost(candidate);
          if (value < best - 1) { order = candidate; best = value; }
        }
      }
    }
    return order;
  }

  /** Narrow layouts use the same identities/ports but a vertical reading order.
   * The deterministic channel fallback also keeps print available if ELK fails. */
  function stackedScene(candidate, width) {
    let y = 14;
    const right = Math.max(...candidate.model.children.map(node => node.width), 0) + 14;
    const children = neighborOrder(candidate.model, candidate.previousOrder).map(node => {
      const result = { ...node, x: right - node.width, y };
      y += node.height + 24;
      return result;
    });
    const nodes = children.map(node => ({ ...node, y: node.y + candidate.views.get(node.id).cardTop,
      height: node.height - candidate.views.get(node.id).cardTop }));
    const references = candidate.model.edges.map(edge => {
      const source = children.find(node => node.ports.some(port => port.id === edge.id));
      const port = source.ports.find(port => port.id === edge.id);
      return { id: edge.id, source: source.id, target: edge.targets[0].slice(0, -3),
        start: { x: source.x + source.width, y: source.y + port.y } };
    });
    const routing = planReferences(nodes, references);
    return { kind: 'stacked', children, width: Math.max(width, right + routing.gutter + 14), height: y - 10,
      edges: routing.routes.map(route => ({ id: route.id, sources: [route.id], targets: [route.target + ':in'],
        sections: [{ startPoint: route.points[0], bendPoints: route.points.slice(1, -1), endPoint: route.points.at(-1) }] })),
      bridges: routing.bridges };
  }

  function crossings(routes) {
    const segments = routes.flatMap(route => route.points.slice(1).map((to, index) =>
      ({ from: route.points[index], to, target: route.target, route })));
    const bridges = new Map();
    segments.filter(edge => Math.abs(edge.from.y - edge.to.y) < 0.01).forEach(horizontal => {
      segments.filter(edge => Math.abs(edge.from.x - edge.to.x) < 0.01).forEach(vertical => {
        if (horizontal.target === vertical.target) return;
        const x = vertical.from.x, y = horizontal.from.y;
        if (x > Math.min(horizontal.from.x, horizontal.to.x) + 6
            && x < Math.max(horizontal.from.x, horizontal.to.x) - 6
            && y > Math.min(vertical.from.y, vertical.to.y) + 6
            && y < Math.max(vertical.from.y, vertical.to.y) - 6) bridges.set(x + ':' + y, { x, y, route: horizontal.route });
      });
    });
    return Array.from(bridges.values());
  }

  class ReferenceGraph {
    constructor(host, { interactive = true } = {}) {
      this.host = host;
      this.interactive = interactive;
      this.prefix = 'orl-graph-' + (++graphNumber);
      this.objects = new Map();
      this.routes = new Map();
      this.bindings = new Map();
      this.scenes = new Map();
      this.version = 0;
      this.frame = 0;
      this.animations = new Set();
      this.listeners = new AbortController();
      this.motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
      const syncMotion = () => {
        if (this.reduceMotion() && (this.frame || this.animations.size)) {
          this.finishMotion();
          this.draw();
        }
      };
      this.motionPreference.addEventListener('change', syncMotion, { signal: this.listeners.signal });
      this.motionObserver = new MutationObserver(syncMotion);
      this.motionObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      this.referenceArrow = this.prefix + '-arrow';
      this.overlay = svgElement('svg', { class: 'orl-reference-edges', 'aria-hidden': 'true' });
      const marker = svgElement('marker', { id: this.referenceArrow, viewBox: '0 0 9 8', refX: 9, refY: 4,
        markerUnits: 'userSpaceOnUse', markerWidth: 9, markerHeight: 8, orient: 'auto-start-reverse' });
      marker.append(svgElement('path', { d: 'M 0 0 L 9 4 L 0 8 z' }));
      const defs = svgElement('defs', {});
      defs.append(marker);
      this.referencePaths = svgElement('g', {});
      this.localPaths = svgElement('g', { class: 'orl-local-edges' });
      this.bridges = svgElement('g', {});
      this.overlay.append(defs, this.referencePaths, this.bridges, this.localPaths);
      this.host.append(this.overlay);
      if (interactive) {
        this.host.addEventListener('click', event => {
          const button = event.target.closest('[data-reference-target]');
          if (button && this.host.contains(button)) this.follow(button.dataset.referenceTarget);
        }, { signal: this.listeners.signal });
        this.host.addEventListener('focusin', event => {
          if (event.target.dataset.referenceId) this.highlight(event.target.dataset.referenceId);
        }, { signal: this.listeners.signal });
      } else this.host.setAttribute('aria-hidden', 'true');
      this.resize = new ResizeObserver(() => {
        if (this.step && host.getBoundingClientRect().width) this.render(this.step);
      });
      this.resize.observe(host.parentElement);
    }

    reset() {
      this.signature = null;
      this.step = null;
      this.layoutKind = null;
      this.version += 1;
      this.finishMotion();
      this.objects.clear();
      this.routes.clear();
      this.bindings.clear();
      this.scenes.clear();
      this.referencePaths.replaceChildren();
      this.localPaths.replaceChildren();
      this.bridges.replaceChildren();
      this.host.replaceChildren(this.overlay);
      this.host.style.removeProperty('height');
      this.host.style.removeProperty('min-width');
    }

    render(step) {
      const newStep = step !== this.step;
      this.step = step;
      const candidate = measureScene(this.host, step, this.interactive);
      const pageWidth = this.host.parentElement.clientWidth || this.host.closest('.object-reference-lab').clientWidth;
      const available = this.interactive ? pageWidth : Math.min(160 * 96 / 25.4, pageWidth || 160 * 96 / 25.4);
      const geometryKey = JSON.stringify([candidate.model, Math.round(available)]);
      const signature = JSON.stringify([geometryKey, Array.from(candidate.views, ([id, view]) => [id, view.signature])]);
      if (this.signature === signature) {
        if (newStep) this.clearChanges();
        return this.ready || Promise.resolve();
      }
      this.signature = signature;
      const saved = this.scenes.get(geometryKey);
      const version = ++this.version;
      this.host.setAttribute('aria-busy', 'true');
      if (saved) {
        this.commit(candidate, saved, this.interactive);
        this.host.setAttribute('aria-busy', 'false');
        return this.ready = Promise.resolve();
      }
      const previous = new Map(Array.from(this.objects, ([id, view]) => [id,
        { x: view.x, y: view.y, cardTop: view.cardTop }]));
      const direction = this.layoutKind === 'DOWN' ? 'DOWN' : 'RIGHT';
      candidate.previousOrder = this.layoutKind === 'stacked'
        ? Array.from(this.objects).sort((a, b) => a[1].y - b[1].y).map(([id]) => id) : [];
      // A synchronous complete fallback is needed for immediate native Print.
      // Interactive views always keep the last completed diagram while waiting.
      if (!this.interactive) this.commit(candidate, stackedScene(candidate, available), false);
      this.ready = (async () => {
        let layout;
        try {
          layout = await incrementalLayout(candidate.model, previous, available, direction);
          if (layout.width > available && candidate.model.children.length > 1) {
            const alternative = await incrementalLayout(candidate.model, previous, available,
              direction === 'RIGHT' ? 'DOWN' : 'RIGHT');
            if (alternative.width < layout.width) layout = alternative;
          }
          if (layout.width > available + 1) layout = stackedScene(candidate, available);
        } catch (error) {
          layout = stackedScene(candidate, available);
          // References remain usable on a failed dependency; the text view is
          // always complete. A future render retries loading instead of caching failure.
          if (version === this.version) this.signature = null;
        }
        if (version !== this.version) return;
        this.scenes.set(geometryKey, layout);
        if (this.scenes.size > 512) this.scenes.delete(this.scenes.keys().next().value);
        this.commit(candidate, layout, this.interactive);
        this.host.setAttribute('aria-busy', 'false');
      })();
      return this.ready;
    }

    commit(candidate, layout, animate) {
      const focused = this.host.contains(document.activeElement) ? document.activeElement : null;
      const focusIdentity = focused?.closest('[data-object-id]')?.dataset.objectId;
      const focusReference = focused?.dataset.referenceId;
      const before = new Map(Array.from(this.objects, ([id, view]) => [id, view.card.getBoundingClientRect()]));
      const previousBindings = this.bindings;
      const bindingBounds = new Map(Array.from(previousBindings, ([id, binding]) => [id, binding.label.getBoundingClientRect()]));
      // Capture the frame actually on screen, including an interrupted transition.
      const previousRoutes = new Map(Array.from(this.routes, ([id, route]) => [id,
        { ...route, points: route.renderedPoints || route.points }]));
      this.finishMotion();
      const live = new Set(layout.children.map(node => node.id));
      this.objects.forEach((view, id) => {
        if (!live.has(id)) { this.resize.unobserve(view.row); view.row.remove(); this.objects.delete(id); }
      });
      this.host.querySelector('.orl-empty-state')?.remove();
      // DOM order follows the diagram's rows, then left to right for keyboard use.
      const ordered = [...layout.children].sort((a, b) => a.y - b.y || a.x - b.x);
      ordered.forEach(node => {
        const next = candidate.views.get(node.id);
        let view = this.objects.get(node.id);
        const change = !view ? 'Added' : view.objectSignature !== next.objectSignature ? 'Changed' : '';
        if (!view) {
          view = next;
          view.card.id = this.prefix + '-' + node.id;
          this.objects.set(node.id, view);
          this.resize.observe(view.row);
        } else if (view.signature !== next.signature) {
          // Preserve the card and row (including focus); replace only content
          // whose semantic state changed. Unchanged steps touch neither.
          view.aliases.replaceChildren(...next.aliases.childNodes);
          view.card.replaceChildren(...next.card.childNodes);
          view.card.className = next.card.className;
          view.card.setAttribute('aria-label', next.card.getAttribute('aria-label'));
          Object.assign(view, { signature: next.signature, objectSignature: next.objectSignature, ports: next.ports, namePorts: next.namePorts,
            cardTop: next.cardTop, width: next.width, height: next.height });
        }
        Object.assign(view, { ports: next.ports, namePorts: next.namePorts, cardTop: next.cardTop,
          width: next.width, height: next.height });
        view.x = node.x; view.y = node.y;
        view.row.style.left = node.x + 'px'; view.row.style.top = node.y + 'px';
        view.row.style.width = node.width + 'px';
        this.markChange(view.card, this.interactive ? change : '');
        this.host.append(view.row);
      });
      this.host.style.height = Math.max(layout.height, 64) + 'px';
      this.host.style.minWidth = layout.width + 'px';
      this.overlay.setAttribute('width', layout.width);
      this.overlay.setAttribute('height', Math.max(layout.height, 64));
      if (!live.size) this.host.append(element('p', 'orl-empty orl-empty-state', 'No data references to show yet.'));
      this.layoutKind = layout.kind;
      this.layoutBridges = layout.bridges;
      this.routes = new Map(layout.edges.map(edge => {
        const section = edge.sections[0];
        const source = layout.children.find(node => node.ports.some(port => port.id === edge.id));
        const local = this.objects.get(source.id).ports.get(edge.id);
        return [edge.id, { id: edge.id, source: source.id, target: edge.targets[0].slice(0, -3),
          points: [{ x: source.x + local.x, y: source.y + local.y }, section.startPoint,
            ...(section.bendPoints || []), section.endPoint] }];
      }));
      this.syncPaths();
      this.routes.forEach(route => {
        const old = previousRoutes.get(route.id);
        const changed = this.interactive && (!old || old.target !== route.target);
        route.path.classList.toggle('is-updated', changed);
        const port = this.objects.get(route.source).card.querySelector('[data-reference-id="' + CSS.escape(route.id) + '"]');
        port.classList.toggle('is-updated', changed);
      });
      this.syncBindings(previousBindings);
      if (focused && document.activeElement !== focused) {
        const view = this.objects.get(focusIdentity);
        const sameReference = view && Array.from(view.card.querySelectorAll('[data-reference-id]'))
          .find(port => port.dataset.referenceId === focusReference);
        if (view) (sameReference || view.card).focus({ preventScroll: true });
      }
      this.draw(1, previousRoutes, previousBindings);
      if (animate && !this.reduceMotion()) {
        this.animate(before, previousRoutes, bindingBounds, previousBindings);
      }
      const scroll = this.host.parentElement;
      if (layout.width > scroll.clientWidth + 1 && scroll.clientWidth) scroll.tabIndex = 0;
      else scroll.removeAttribute('tabindex');
    }

    syncPaths() {
      const existing = new Map(Array.from(this.referencePaths.children, path => [path.dataset.referenceId, path]));
      existing.forEach((path, id) => { if (!this.routes.has(id)) path.remove(); });
      this.routes.forEach(route => {
        let path = existing.get(route.id);
        if (!path) {
          path = svgElement('path', { class: 'orl-reference-edge', 'data-reference-id': route.id,
            'marker-end': 'url(#' + this.referenceArrow + ')' });
          this.referencePaths.append(path);
        }
        path.dataset.sourceObject = route.source;
        path.dataset.targetObject = route.target;
        route.path = path;
      });
    }

    syncBindings(previous) {
      this.bindings = new Map();
      this.objects.forEach((view, target) => {
        view.namePorts.forEach(port => {
          const replacement = Array.from(view.aliases.children).find(label => label.dataset.bindingId === port.id);
          const old = previous.get(port.id);
          const label = old?.label || replacement;
          if (label !== replacement) {
            label.replaceChildren(...replacement.childNodes);
            replacement.replaceWith(label);
          }
          const path = old?.path || svgElement('path', { class: 'orl-edge orl-binding-edge',
            'data-binding-id': port.id, 'marker-end': 'url(#' + this.referenceArrow + ')' });
          path.dataset.targetObject = target;
          const change = this.interactive ? (!old ? 'Added' : old.target !== target ? 'Changed' : '') : '';
          this.markChange(label, change);
          label.title = change ? change + ' reference' : '';
          path.classList.toggle('is-updated', Boolean(change));
          this.localPaths.append(path);
          this.bindings.set(port.id, { label, path, target, port });
        });
      });
      previous.forEach((binding, id) => { if (!this.bindings.has(id)) binding.path.remove(); });
    }

    markChange(node, change) {
      node.classList.toggle('is-updated', Boolean(change));
      node.dataset.change = change.toLowerCase();
      const status = node.querySelector('.orl-change-status');
      if (status) {
        status.replaceChildren();
        if (change) status.append(element('span', 'orl-badge', change));
      }
    }

    clearChanges() {
      this.objects.forEach(view => this.markChange(view.card, ''));
      this.bindings.forEach(binding => { this.markChange(binding.label, ''); binding.label.title = ''; });
      this.host.querySelectorAll('.is-updated').forEach(node => node.classList.remove('is-updated'));
    }

    draw(progress = 1, previousRoutes = this.routes, previousBindings = this.bindings) {
      const bounds = this.host.getBoundingClientRect();
      this.routes.forEach(route => {
        const old = previousRoutes.get(route.id);
        const points = interpolateRoute(old?.points, route.points, progress).map(point => ({ ...point }));
        if (progress < 1) {
          const source = this.objects.get(route.source), target = this.objects.get(route.target);
          const sr = source.card.getBoundingClientRect(), tr = target.card.getBoundingClientRect();
          const port = source.ports.get(route.id);
          points[0] = { x: sr.left - bounds.left + port.x, y: sr.top - bounds.top + port.y - source.cardTop };
          points[1] = { x: sr.right - bounds.left, y: points[0].y };
          const last = route.points.at(-1);
          points[points.length - 1] = { x: tr.left - bounds.left + last.x - target.x,
            y: tr.top - bounds.top + last.y - target.y - target.cardTop };
        }
        route.renderedPoints = points;
        paintArrow(route.path, points);
      });
      this.bridges.replaceChildren();
      if (progress === 1) (this.layoutBridges || crossings(Array.from(this.routes.values()))).forEach(({ x, y, route }) => {
        const owner = route || Array.from(this.routes.values()).find(candidate => candidate.points.some((point, index) => {
          const end = candidate.points[index + 1];
          return end && point.y === y && end.y === y && x > Math.min(point.x, end.x) && x < Math.max(point.x, end.x);
        }));
        const d = `M ${x - 5} ${y} C ${x - 2} ${y} ${x - 3} ${y - 5} ${x} ${y - 5}`
          + ` C ${x + 3} ${y - 5} ${x + 2} ${y} ${x + 5} ${y}`;
        const bridge = svgElement('path', { class: 'orl-edge-bridge', d,
          'data-reference-id': owner?.id || '' });
        bridge.classList.toggle('is-updated', Boolean(owner?.path.classList.contains('is-updated')));
        bridge.classList.toggle('is-selected', Boolean(owner?.path.classList.contains('is-selected')));
        this.bridges.append(svgElement('path', { class: 'orl-edge-bridge-mask', d: `M ${x - 5} ${y} H ${x + 5}` }),
          svgElement('path', { class: 'orl-edge-bridge-mask', d }), bridge);
      });
      this.bindings.forEach((binding, id) => {
        const view = this.objects.get(binding.target);
        let start = { x: view.x + binding.port.x, y: view.y + binding.port.y };
        let end = { x: view.x + view.width - 12, y: view.y + view.cardTop };
        if (progress < 1) {
          const slot = binding.label.querySelector('.orl-name-slot').getBoundingClientRect();
          const card = view.card.getBoundingClientRect();
          start = { x: slot.right - bounds.left, y: slot.top + slot.height / 2 - bounds.top };
          end = { x: card.right - bounds.left - 12, y: card.top - bounds.top };
        }
        const old = previousBindings.get(id);
        // A rebound name keeps its visual identity. Its origin moves with the
        // name; its arrowhead travels from the old landing to the new landing.
        if (progress < 1 && old?.points && old.target !== binding.target) {
          const from = old.points.at(-1);
          end = { x: from.x + (end.x - from.x) * progress, y: from.y + (end.y - from.y) * progress };
        }
        binding.points = [start, { x: end.x, y: start.y }, end];
        paintArrow(binding.path, binding.points);
        binding.path.style.opacity = old ? '1' : String(progress);
      });
    }

    animate(before, previousRoutes, bindingBounds, previousBindings) {
      let moved = false;
      const animateElement = (element, old) => {
        const current = element.getBoundingClientRect();
        const dx = old ? old.left - current.left : 0, dy = old ? old.top - current.top : 8;
        if (Math.abs(dx) + Math.abs(dy) < 0.5) return;
        moved = true;
        const animation = element.animate([
          { transform: `translate(${dx}px, ${dy}px)`, opacity: old ? 1 : 0 },
          { transform: 'translate(0, 0)', opacity: 1 }
        ], { duration: 420, easing: 'linear' });
        this.animations.add(animation);
      };
      this.objects.forEach((view, id) => animateElement(view.card, before.get(id)));
      this.bindings.forEach((binding, id) => animateElement(binding.label, bindingBounds.get(id)));
      const changed = Array.from(this.routes).some(([id, route]) =>
        JSON.stringify(route.points) !== JSON.stringify(previousRoutes.get(id)?.points));
      if (!moved && !changed) return;
      const started = performance.now();
      const tick = () => {
        if (this.reduceMotion()) { this.finishMotion(); this.draw(); return; }
        const t = Math.min(1, (performance.now() - started) / 420);
        this.draw(t, previousRoutes, previousBindings);
        if (t < 1) this.frame = requestAnimationFrame(tick);
        else this.finishMotion();
      };
      tick();
    }

    finishMotion() {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      this.animations.forEach(animation => animation.cancel());
      this.animations.clear();
    }

    reduceMotion() {
      // Either preference is sufficient, including an OS change during playback.
      return this.motionPreference.matches || document.documentElement.classList.contains('prm-reduce')
        || (typeof window.__prefersReducedMotion === 'function' && window.__prefersReducedMotion());
    }

    layout() { return this.step ? this.render(this.step) : Promise.resolve(); }

    highlight(referenceId) {
      this.routes.forEach(route => route.path.classList.toggle('is-selected', route.id === referenceId));
      this.syncBridgeSelection();
    }

    syncBridgeSelection() {
      this.bridges.querySelectorAll('.orl-edge-bridge').forEach(bridge => {
        bridge.classList.toggle('is-selected', Boolean(this.routes.get(bridge.dataset.referenceId)?.path.classList.contains('is-selected')));
      });
    }

    follow(identity) {
      const target = this.objects.get(identity);
      if (!target) return;
      this.objects.forEach((view, id) => view.card.classList.toggle('is-selected', id === identity));
      this.routes.forEach(route => route.path.classList.toggle('is-selected', route.target === identity));
      this.syncBridgeSelection();
      target.card.focus({ preventScroll: true });
      target.card.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    }

    destroy() {
      this.version += 1;
      this.finishMotion();
      this.resize.disconnect();
      this.motionObserver.disconnect();
      this.listeners.abort();
    }
  }

  window.ObjectReferenceGraph = { ReferenceGraph, describeState };
}());
