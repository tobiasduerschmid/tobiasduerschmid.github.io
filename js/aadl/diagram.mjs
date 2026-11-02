import ELK from '../vendor/elk/0.12.0/elk-api.mjs';
import { projectDiagram } from './diagram-projection.mjs';

const SVG_NS = 'http://www.w3.org/2000/svg';
const WORKER_URL = new URL('../vendor/elk/0.12.0/elk-worker.min.js', import.meta.url);
let mountSequence = 0;

const words = value => String(value ?? '').replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ').toLowerCase();
const locationOf = record => record.sourceLocation ?? (typeof record.source === 'object' ? record.source : null);
const bindingLabel = kind => words(kind).includes('binding') ? words(kind) : `actual ${words(kind)} binding`;
const containmentLabel = component => `inside ${component.parentId?.split('.').at(-1) ?? 'root'}`;

function element(document, tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function svgElement(document, tag, attributes = {}, text) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Mount an explanatory architecture view of a resolved OSATE model.
 * render(model) resolves after layout (or cancellation); it never mutates model.
 * markStale() cancels pending layout and labels any retained figure as previous.
 * clear()/destroy() cancel work; destroy also removes all owned DOM/listeners.
 * Source callbacks receive the bridge's {file,line,column,endLine,endColumn}.
 */
export function mountDiagram(root, { onSourceLocation } = {}) {
  const document = root.ownerDocument;
  const instanceId = `aadl-diagram-${++mountSequence}`;
  const listeners = new AbortController();
  let tableListeners = new AbortController();
  const ui = createShell(root, instanceId);
  let model = null;
  let stale = false;
  let destroyed = false;
  let generation = 0;
  let pending = null;
  let layoutWidth = 0;

  function cancelLayout() {
    generation += 1;
    pending?.cancel();
    pending = null;
  }

  function sourceButton(record, label) {
    const location = locationOf(record);
    if (!location || !onSourceLocation) return document.createTextNode('—');
    const button = element(document, 'button', label);
    button.type = 'button';
    button.disabled = stale;
    button.addEventListener('click', () => onSourceLocation(location), { signal: tableListeners.signal });
    button.dataset.aadlSource = '';
    return button;
  }

  async function draw() {
    cancelLayout();
    const revision = generation;
    tableListeners.abort();
    tableListeners = new AbortController();
    ui.canvas.replaceChildren();
    ui.tables.replaceChildren();
    if (!model || destroyed) return;
    layoutWidth = ui.canvas.clientWidth;
    try {
      const projection = projectDiagram(model, { scopeId: ui.scope.value, view: ui.view.value });
      ui.caption.textContent = caption(projection);
      ui.path.textContent = projection.ancestors.map(component => component.name).join(' / ');
      renderTables(ui.tables, projection, model, sourceButton);
      ui.status.textContent = stale ? 'Previous model; source changed. Instantiate again to update.' : 'Resolved model. Preparing diagram…';
      if (projection.tooLarge) {
        ui.canvas.append(element(document, 'p', 'This scope contains more than seven components. Choose a smaller scope; the model details below include every component and relationship.'));
        ui.details.open = true;
        if (!stale) ui.status.textContent = 'Resolved model. This scope is available in model details.';
        return;
      }
      if (!projection.nodes.length) {
        ui.canvas.append(element(document, 'p', projection.view === 'deployment' ? 'No actual bindings are recorded in this scope.' : 'This component has no subcomponents. Its interface is listed in model details.'));
        ui.details.open = true;
        if (!stale) ui.status.textContent = 'Resolved model. This scope is available in model details.';
        return;
      }
      const metrics = textMetrics(root, ui.canvas);
      const graph = layoutGraph(projection, metrics);
      const request = startLayout(graph);
      pending = request;
      const laidOut = await request.result;
      if (destroyed || revision !== generation || !laidOut) return;
      pending = null;
      ui.canvas.replaceChildren(renderSVG(document, laidOut, projection, metrics, instanceId));
      ui.status.textContent = stale ? 'Previous model; source changed. Instantiate again to update.' : 'Resolved model. Diagram and model details show the same scope.';
    } catch (error) {
      if (destroyed || revision !== generation) return;
      ui.status.textContent = `Diagram unavailable: ${error.message}`;
      ui.canvas.replaceChildren(element(document, 'p', 'Use model details when available. No substitute diagram has been inferred.'));
      ui.details.open = true;
    }
  }

  ui.view.addEventListener('change', draw, { signal: listeners.signal });
  ui.scope.addEventListener('change', draw, { signal: listeners.signal });
  const resize = new ResizeObserver(() => {
    if (model && !destroyed && Math.abs(ui.canvas.clientWidth - layoutWidth) > 1) void draw();
  });
  resize.observe(ui.canvas);

  return {
    async render(nextModel) {
      if (destroyed) return;
      const previousScope = ui.scope.value;
      model = nextModel;
      stale = false;
      root.classList.remove('is-stale');
      const parents = new Set(model.components.map(component => component.parentId));
      ui.scope.replaceChildren(...model.components.filter(component => parents.has(component.id) || component.id === model.rootId)
        .map(component => new Option(component.id === model.rootId ? component.name : component.id, component.id)));
      ui.scope.value = model.components.some(component => component.id === previousScope && parents.has(component.id)) ? previousScope : model.rootId;
      ui.view.disabled = false;
      ui.scope.disabled = false;
      await draw();
    },
    markStale() {
      if (destroyed || !model) return;
      cancelLayout();
      stale = true;
      root.classList.add('is-stale');
      ui.status.textContent = 'Previous model; source changed. Instantiate again to update.';
      for (const button of ui.tables.querySelectorAll('[data-aadl-source]')) button.disabled = true;
    },
    clear() {
      if (destroyed) return;
      cancelLayout();
      tableListeners.abort();
      model = null;
      stale = false;
      root.classList.remove('is-stale');
      ui.canvas.replaceChildren();
      ui.tables.replaceChildren();
      ui.path.textContent = '';
      ui.caption.textContent = '';
      ui.scope.replaceChildren();
      ui.view.disabled = true;
      ui.scope.disabled = true;
      ui.status.textContent = 'Instantiate a model to explore its architecture.';
    },
    destroy() {
      cancelLayout();
      destroyed = true;
      resize.disconnect();
      model = null;
      listeners.abort();
      tableListeners.abort();
      root.replaceChildren();
      root.classList.remove('aadl-diagram', 'is-stale');
    },
  };
}

function createShell(root, instanceId) {
  const document = root.ownerDocument;
  root.classList.add('aadl-diagram');
  const toolbar = element(document, 'div', undefined, 'aadl-diagram__toolbar');
  function select(label, options) {
    const wrapper = element(document, 'div', undefined, 'aadl-diagram__control');
    const labelNode = element(document, 'label', label);
    const control = element(document, 'select');
    control.id = `${instanceId}-${label.replaceAll(' ', '-').toLowerCase()}`;
    labelNode.htmlFor = control.id;
    control.disabled = true;
    for (const [value, name] of options) control.append(new Option(name, value));
    wrapper.append(labelNode, control);
    toolbar.append(wrapper);
    return control;
  }
  const view = select('View', [['logical', 'Communication'], ['deployment', 'Deployment']]);
  const scope = select('Current scope', []);
  const status = element(document, 'p', 'Instantiate a model to explore its architecture.', 'aadl-diagram__status');
  status.setAttribute('role', 'status');
  const path = element(document, 'p', '', 'aadl-diagram__path');
  const figure = element(document, 'figure');
  const caption = element(document, 'figcaption');
  caption.id = `${instanceId}-caption`;
  const canvas = element(document, 'div', undefined, 'aadl-diagram__canvas');
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'region');
  canvas.setAttribute('aria-label', 'Scrollable architecture diagram');
  figure.append(caption, canvas, element(document, 'p', 'The layout follows the available width. Model details lists every component and relationship.', 'aadl-diagram__note aadl-diagram__scroll-help'));
  const details = element(document, 'details', undefined, 'aadl-diagram__details');
  const tables = element(document, 'div');
  details.append(element(document, 'summary', 'Model details'), tables);
  const note = element(document, 'p', 'AADL architecture overview: a simplified view of the resolved model. Shapes explain the architecture; they do not implement the complete standard graphical notation.', 'aadl-diagram__note');
  root.replaceChildren(toolbar, status, path, figure, details, note);
  return { view, scope, status, path, caption, canvas, details, tables };
}

function caption(projection) {
  if (projection.view === 'deployment') return 'Dashed arrows show actual resource bindings. Allocation is separate from the ports that carry data.';
  if (projection.boundaryFeatures.length) return 'The boundary forwards data to and from its children. Port direction is relative to the component that owns the port.';
  return 'Solid arrows show declared connections between components and their features. Communication does not allocate execution to a processor.';
}

function renderTables(root, projection, model, sourceButton) {
  const document = root.ownerDocument;
  const components = new Map(model.components.map(component => [component.id, component]));
  const features = new Map(model.components.flatMap(component => component.features.map(feature => [feature.id, feature])));
  function table(title, headings, rows) {
    const scroll = element(document, 'div', undefined, 'aadl-diagram__table-scroll');
    scroll.tabIndex = 0;
    scroll.setAttribute('role', 'region');
    scroll.setAttribute('aria-label', `Scrollable ${title.toLowerCase()} table`);
    const table = element(document, 'table');
    table.append(element(document, 'caption', title));
    const head = element(document, 'thead');
    const header = element(document, 'tr');
    for (const heading of headings) {
      const cell = element(document, 'th', heading); cell.scope = 'col'; header.append(cell);
    }
    head.append(header);
    const body = element(document, 'tbody');
    for (const row of rows) {
      const tr = element(document, 'tr');
      for (const content of row) {
        const cell = element(document, 'td');
        cell.append(typeof content === 'string' ? document.createTextNode(content) : content);
        tr.append(cell);
      }
      body.append(tr);
    }
    table.append(head, body); scroll.append(table); root.append(scroll);
  }
  table('Components', ['Instance', 'Category', 'Classifier', 'Contained in', 'Source'], projection.nodes.map(component => [
    component.id, words(component.category), component.classifier ?? 'Not specified',
    components.get(component.parentId)?.id ?? 'Root', sourceButton(component, `Source of ${component.name}`),
  ]));
  if (projection.view === 'logical') {
    const featureRows = (owner, feature) => [owner.id, feature.name, words(feature.direction), words(feature.kind), feature.dataClassifier ?? 'Not specified', sourceButton(feature, `Source of ${feature.name}`)];
    if (projection.boundaryFeatures.length) table('Boundary features', ['Owner', 'Feature', 'Direction', 'Kind', 'Data classifier', 'Source'], projection.boundaryFeatures.map(feature => featureRows(projection.scope, feature)));
    table('Component features', ['Owner', 'Feature', 'Direction', 'Kind', 'Data classifier', 'Source'], projection.nodes.flatMap(component => component.features.map(feature => featureRows(component, feature))));
    table(projection.edges.some(edge => edge.kind === 'accessConnection') ? 'Connections' : 'Port connections', ['Connection', 'From', 'To', 'Kind', 'Source'], projection.edges.map(edge => [
      edge.name, edge.source, edge.target, edge.kind === 'accessConnection' ? 'access connection' : words(features.get(edge.source)?.kind ?? 'port') + ' connection', sourceButton(edge, `Source of ${edge.name}`),
    ]));
  } else {
    table('Actual bindings', ['Binding kind', 'Applies to', 'Resolved target', 'Source'], projection.edges.map(edge => [
      bindingLabel(edge.kind), edge.source, edge.target, sourceButton(edge, `Source of binding for ${components.get(edge.source).name}`),
    ]));
  }
}

function textMetrics(root, viewport) {
  const style = root.ownerDocument.defaultView.getComputedStyle(root);
  const size = parseFloat(style.fontSize);
  const canvas = root.ownerDocument.createElement('canvas');
  const context = canvas.getContext('2d');
  context.font = `600 ${size}px ${style.fontFamily}`;
  const viewportStyle = root.ownerDocument.defaultView.getComputedStyle(viewport);
  const available = viewport.clientWidth - parseFloat(viewportStyle.paddingLeft) - parseFloat(viewportStyle.paddingRight);
  return { size, line: size * 1.7, available, vertical: available < size * 50, width: text => Math.ceil(context.measureText(text).width) };
}

function wrapLabel(text, maxWidth, metrics) {
  const lines = [];
  let line = '';
  for (const word of text.match(/[^ _]+[_ ]*|[_ ]+/g) ?? []) {
    if (line && metrics.width(line + word) > maxWidth) { lines.push(line.trimEnd()); line = ''; }
    for (const character of word) {
      if (line && metrics.width(line + character) > maxWidth) { lines.push(line.trimEnd()); line = ''; }
      line += character;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function verticalCard(component, isLogical, width, metrics) {
  const { size, line } = metrics;
  const features = isLogical ? component.features : [];
  const group = output => features.filter(feature => (feature.direction === 'out') === output);
  const rows = output => {
    const ports = group(output);
    const columnWidth = width / Math.max(1, ports.length);
    const labels = ports.map(feature => ({ feature, lines: wrapLabel(`${words(feature.direction)} · ${feature.name}`, columnWidth - size, metrics) }));
    return { labels, height: labels.length ? Math.max(...labels.map(label => label.lines.length)) * line + size : 0, columnWidth };
  };
  const input = rows(false), output = rows(true);
  const name = wrapLabel(component.name, width - size * 2, metrics);
  const category = [words(component.category), ...(!isLogical ? [containmentLabel(component)] : [])]
    .flatMap(text => wrapLabel(text, width - size * 2, metrics));
  const middleHeight = (name.length + category.length) * line + size;
  return { input, output, name, category, middleHeight, height: input.height + middleHeight + output.height };
}

function layoutGraph(projection, metrics) {
  const { size, line, width, vertical } = metrics;
  const isLogical = projection.view === 'logical';
  const cardLimit = Math.max(size * 4, metrics.available - size * 2.4);
  const nodes = projection.nodes.map(component => {
    const features = isLogical ? component.features : [];
    const naturalWidth = Math.max(size * 14, width(component.name) + size * 3,
      isLogical ? 0 : width(containmentLabel(component)) + size * 2,
      ...features.map(feature => width(`${words(feature.direction)} · ${feature.name}`) + size * 3));
    const nodeWidth = vertical ? Math.min(naturalWidth, cardLimit) : naturalWidth;
    const card = vertical ? verticalCard(component, isLogical, nodeWidth, metrics) : null;
    return {
      id: component.id, width: nodeWidth, height: card?.height ?? (isLogical ? 3 + features.length : 4) * line,
      layoutOptions: { 'elk.portConstraints': 'FIXED_POS' },
      ports: vertical ? [card.input, card.output].flatMap((group, index) => group.labels.map(({ feature }, portIndex) => ({
        id: feature.id, width: size * 0.6, height: size * 0.6,
        x: (portIndex + 0.5) * group.columnWidth - size * 0.3,
        y: index ? card.height - size * 0.3 : -size * 0.3,
        layoutOptions: { 'elk.port.side': index ? 'SOUTH' : 'NORTH' },
      }))) : features.map((feature, index) => ({
        id: feature.id, width: size * 0.6, height: size * 0.6,
        x: feature.direction === 'out' ? nodeWidth - size * 0.3 : -size * 0.3,
        y: (2.7 + index) * line,
        layoutOptions: { 'elk.port.side': feature.direction === 'out' ? 'EAST' : 'WEST' },
      })),
    };
  });
  return {
    id: projection.scope.id,
    layoutOptions: {
      'elk.algorithm': 'layered', 'elk.direction': vertical ? 'DOWN' : 'RIGHT', 'elk.edgeRouting': 'ORTHOGONAL',
      'elk.spacing.nodeNode': String(size * 3), 'elk.layered.spacing.nodeNodeBetweenLayers': String(size * 3),
      'elk.portConstraints': 'FIXED_SIDE',
      ...(vertical ? {
        'elk.separateConnectedComponents': 'false', 'elk.layered.layering.strategy': 'COFFMAN_GRAHAM',
        'elk.layered.layering.coffmanGraham.layerBound': '1',
        'elk.layered.nodePlacement.strategy': projection.boundaryFeatures.length ? 'BRANDES_KOEPF' : 'SIMPLE',
      } : {}),
      'elk.padding': vertical
        ? `[top=${line},left=${size * 0.7},bottom=${size * 0.7},right=${size * 0.7}]`
        : `[top=${line * 3},left=${line * 2},bottom=${line * 2},right=${line * 2}]`,
    },
    ports: projection.boundaryFeatures.map(feature => ({
      id: feature.id, width: size * 0.6, height: size * 0.6,
      layoutOptions: { 'elk.port.side': vertical ? (feature.direction === 'out' ? 'SOUTH' : 'NORTH') : (feature.direction === 'out' ? 'EAST' : 'WEST') },
    })),
    children: nodes,
    edges: projection.edges.map(edge => {
      const text = isLogical ? edge.name : bindingLabel(edge.kind);
      const labelWidth = vertical ? Math.min(width(text) + size, cardLimit / 2) : width(text) + size;
      const labelHeight = vertical ? wrapLabel(text, labelWidth - size, metrics).length * line : line;
      return {
      id: edge.id, sources: [edge.source], targets: [edge.target],
      labels: [{ text, width: labelWidth, height: labelHeight }],
      };
    }),
  };
}

function startLayout(graph) {
  const worker = new Worker(WORKER_URL);
  const elk = new ELK({ workerFactory: () => worker });
  let cancel;
  let fail;
  const interrupted = new Promise((resolve, reject) => { cancel = () => resolve(null); fail = reject; });
  const onError = () => fail(new Error('The layout worker could not complete. Model details remain available.'));
  worker.addEventListener('error', onError);
  const timeout = setTimeout(() => fail(new Error('Layout exceeded 15 seconds. Choose a smaller scope.')), 15000);
  // ELK treats external ports correctly on a compound node, not its layout root.
  // This parent exists only for layout; it never becomes a model component.
  const layoutRoot = { id: 'aadl-layout-only-root', layoutOptions: { 'elk.algorithm': 'layered' }, children: [graph] };
  const result = Promise.race([elk.layout(layoutRoot).then(result => result.children[0]), interrupted]).finally(() => {
    clearTimeout(timeout);
    worker.removeEventListener('error', onError);
    elk.terminateWorker();
  });
  return { result, cancel };
}

function renderSVG(document, graph, projection, metrics, instanceId) {
  const { size, line, vertical } = metrics;
  const margin = size * (vertical ? 0.5 : 2);
  const boundaryLabels = vertical ? verticalBoundaryLabels(graph, projection, metrics) : [];
  const boundaryHeight = output => Math.max(0, ...boundaryLabels.filter(label => label.output === output).map(label => label.lines.length * line + size));
  const topMargin = margin + boundaryHeight(false);
  const bottomMargin = margin + boundaryHeight(true);
  const width = graph.width + margin * 2;
  const height = graph.height + topMargin + bottomMargin;
  const svg = svgElement(document, 'svg', { viewBox: `0 0 ${width} ${height}`, width, height, role: 'img', 'aria-labelledby': `${instanceId}-title` });
  svg.append(svgElement(document, 'title', { id: `${instanceId}-title` }, `${projection.scope.name} ${projection.view === 'logical' ? 'communication' : 'deployment'} architecture overview. Full relationships appear in Model details.`));
  const defs = svgElement(document, 'defs');
  const markerId = `${instanceId}-arrow`;
  const marker = svgElement(document, 'marker', { id: markerId, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' });
  marker.append(svgElement(document, 'path', { d: 'M 0 0 L 10 5 L 0 10 z', class: 'aadl-diagram__arrow' }));
  defs.append(marker); svg.append(defs);
  const drawing = svgElement(document, 'g', { transform: `translate(${margin},${topMargin})` });
  svg.append(drawing);
  if (projection.view === 'logical') drawing.append(svgElement(document, 'rect', { x: 0, y: 0, width: graph.width, height: graph.height, rx: size * 0.5, class: 'aadl-diagram__boundary' }));
  const scopeLabel = projection.view === 'deployment' ? `Actual bindings from ${projection.scope.name}` : `${projection.scope.name} · ${words(projection.scope.category)}`;
  // The scope already appears immediately above the figure. Repeating it inside
  // a narrow boundary would put its text across incoming connection paths.
  if (!vertical) appendLabel(drawing, [scopeLabel], { x: size, y: line, class: 'aadl-diagram__scope-label' }, line);
  const edges = new Map(projection.edges.map(edge => [edge.id, edge]));
  for (const edge of graph.edges) {
    for (const section of edge.sections ?? []) {
      const points = [section.startPoint, ...(section.bendPoints ?? []), section.endPoint];
      drawing.append(svgElement(document, 'path', { d: points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' '), class: `aadl-diagram__edge${projection.view === 'deployment' ? ' aadl-diagram__binding' : ''}`, 'marker-end': `url(#${markerId})`, ...(edges.get(edge.id)?.bidirectional ? { 'marker-start': `url(#${markerId})` } : {}) }));
    }
    for (const label of edge.labels ?? []) {
      drawing.append(svgElement(document, 'rect', { x: label.x, y: label.y, width: label.width, height: label.height, class: 'aadl-diagram__label-ground' }));
      appendLabel(drawing, vertical ? wrapLabel(label.text, label.width - size, metrics) : [label.text], { x: label.x + size * 0.5, y: label.y + size * 1.2 }, line);
    }
  }
  const components = new Map(projection.nodes.map(component => [component.id, component]));
  for (const node of graph.children) renderNode(drawing, node, components.get(node.id), projection, metrics);
  const boundaryFeatures = new Map(projection.boundaryFeatures.map(feature => [feature.id, feature]));
  for (const port of graph.ports ?? []) {
    const feature = boundaryFeatures.get(port.id);
    drawing.append(svgElement(document, 'rect', { x: port.x, y: port.y, width: port.width, height: port.height, class: 'aadl-diagram__port' }));
    const output = feature.direction === 'out';
    if (vertical) {
      const label = boundaryLabels.find(label => label.id === port.id);
      appendLabel(drawing, label.lines, { x: label.x, y: output ? graph.height + line : -size - (label.lines.length - 1) * line, 'text-anchor': 'middle', class: 'aadl-diagram__boundary-label' }, line);
    } else {
      drawing.append(svgElement(document, 'text', { x: output ? port.x - size : port.x + size, y: port.y - line * 1.2, 'text-anchor': output ? 'end' : 'start', class: 'aadl-diagram__boundary-label' }, `${words(feature.direction)} · ${feature.name}`));
    }
  }
  return svg;
}

function verticalBoundaryLabels(graph, projection, metrics) {
  return projection.boundaryFeatures.map(feature => {
    const output = feature.direction === 'out';
    const peers = projection.boundaryFeatures.filter(candidate => (candidate.direction === 'out') === output);
    const maxWidth = graph.width / peers.length - metrics.size;
    const port = graph.ports.find(port => port.id === feature.id);
    return { id: feature.id, output, x: Math.max(maxWidth / 2, Math.min(graph.width - maxWidth / 2, port.x + port.width / 2)), lines: wrapLabel(`${words(feature.direction)} · ${feature.name}`, maxWidth, metrics) };
  });
}

function renderNode(drawing, node, component, projection, metrics) {
  const document = drawing.ownerDocument;
  const { size, line } = metrics;
  const group = svgElement(document, 'g', { transform: `translate(${node.x},${node.y})` });
  group.append(svgElement(document, 'rect', { width: node.width, height: node.height, rx: size * 0.4, class: 'aadl-diagram__node' }));
  if (metrics.vertical) {
    renderVerticalCard(group, node, component, projection, metrics);
    drawing.append(group);
    return;
  }
  group.append(svgElement(document, 'text', { x: size, y: line, class: 'aadl-diagram__node-name' }, component.name));
  group.append(svgElement(document, 'text', { x: size, y: line * 2 }, words(component.category)));
  if (projection.view === 'deployment') {
    group.append(svgElement(document, 'text', { x: size, y: line * 3 }, containmentLabel(component)));
  }
  const features = new Map(component.features.map(feature => [feature.id, feature]));
  for (const port of node.ports) {
    const feature = features.get(port.id);
    group.append(svgElement(document, 'rect', { x: port.x, y: port.y, width: port.width, height: port.height, class: 'aadl-diagram__port' }));
    const output = feature.direction === 'out';
    group.append(svgElement(document, 'text', { x: output ? node.width - size : size, y: port.y + size * 0.6, 'text-anchor': output ? 'end' : 'start' }, `${words(feature.direction)} · ${feature.name}`));
  }
  drawing.append(group);
}

function appendLabel(parent, lines, attributes, lineHeight) {
  const text = svgElement(parent.ownerDocument, 'text', attributes);
  for (const [index, value] of lines.entries()) {
    text.append(svgElement(parent.ownerDocument, 'tspan', { x: attributes.x, dy: index ? lineHeight : 0 }, value));
  }
  parent.append(text);
}

function renderVerticalCard(group, node, component, projection, metrics) {
  const { size, line } = metrics;
  const card = verticalCard(component, projection.view === 'logical', node.width, metrics);
  appendLabel(group, card.name, { x: node.width / 2, y: card.input.height + line, 'text-anchor': 'middle', class: 'aadl-diagram__node-name' }, line);
  appendLabel(group, card.category, { x: node.width / 2, y: card.input.height + (card.name.length + 1) * line, 'text-anchor': 'middle' }, line);
  for (const [index, row] of [card.input, card.output].entries()) {
    row.labels.forEach((label, column) => appendLabel(group, label.lines, {
      x: (column + 0.5) * row.columnWidth, 'text-anchor': 'middle',
      y: (index ? card.input.height + card.middleHeight : 0) + line,
    }, line));
  }
  for (const port of node.ports) group.append(svgElement(group.ownerDocument, 'rect', { x: port.x, y: port.y, width: port.width, height: port.height, class: 'aadl-diagram__port' }));
}
