/**
 * Select one view from an already resolved OSATE model. Never parses source or
 * infers bindings. Returned records retain semantic IDs; input is not mutated.
 * Unknown scopes/endpoints throw so an incomplete projection cannot look valid.
 */
export function projectDiagram(model, { scopeId = model.rootId, view = 'logical' } = {}) {
  const components = new Map(model.components.map(component => [component.id, component]));
  const scope = components.get(scopeId);
  if (!scope) throw new RangeError(`Unknown diagram scope: ${scopeId}`);
  const ancestors = ancestry(scope, components);
  const content = view === 'deployment'
    ? deployment(model, scope, components)
    : logical(model, scope);
  return { view, scope, ancestors, ...content, tooLarge: content.nodes.length > 7 };
}

function ancestry(component, components) {
  const chain = [];
  const visited = new Set();
  for (let current = component; current; current = components.get(current.parentId)) {
    if (visited.has(current.id)) throw new RangeError('Cyclic component containment');
    visited.add(current.id);
    chain.unshift(current);
  }
  return chain;
}

function logical(model, scope) {
  const nodes = model.components.filter(component => component.parentId === scope.id);
  if ([scope, ...nodes].some(component => component.features.some(feature => feature.features?.length))) {
    throw new RangeError('Feature groups are not supported by this architecture view yet. The resolved model is still available to analyses.');
  }
  const boundaryFeatures = scope.features;
  const featureIds = new Set([scope, ...nodes].flatMap(component => component.features.map(feature => feature.id)));
  const componentIds = new Set(nodes.map(component => component.id));
  const edges = new Map();
  for (const connection of model.connections) {
    // Segment contexts preserve process boundaries hidden by complete leaf-to-leaf
    // instance connections. Drawing both would duplicate the same communication.
    const segments = connection.segments.length ? connection.segments : [connection];
    for (const segment of segments.filter(candidate => candidate.contextId === scope.id)) {
      const endpointKnown = id => featureIds.has(id) || (connection.kind === 'accessConnection' && componentIds.has(id));
      if (!endpointKnown(segment.source) || !endpointKnown(segment.target)) {
        throw new RangeError(`Connection endpoint is outside the resolved scope: ${segment.name ?? connection.id}`);
      }
      const key = JSON.stringify([segment.id, segment.source, segment.target]);
      edges.set(key, { ...segment, id: segment.id ?? key, name: segment.name ?? connection.name ?? '', kind: connection.kind ?? 'portConnection', bidirectional: connection.bidirectional ?? false });
    }
  }
  return { nodes, boundaryFeatures, edges: [...edges.values()] };
}

function deployment(model, scope, components) {
  const subtree = new Set(model.components
    .filter(component => ancestry(component, components).some(parent => parent.id === scope.id))
    .map(component => component.id));
  const bindings = model.bindings.filter(binding => subtree.has(binding.sourceId));
  const nodeIds = new Set(bindings.flatMap(binding => [binding.sourceId, binding.targetId]));
  for (const id of nodeIds) {
    if (!components.has(id)) throw new RangeError(`Binding endpoint is unresolved: ${id}`);
  }
  return {
    nodes: model.components.filter(component => nodeIds.has(component.id)),
    boundaryFeatures: [],
    edges: bindings.map(binding => ({
      ...binding,
      id: JSON.stringify([binding.sourceId, binding.targetId, binding.kind]),
      name: binding.kind,
      source: binding.sourceId,
      target: binding.targetId,
    })),
  };
}
