/** Request/result boundary only. AADL syntax and semantics belong to OSATE. */
const MAX_FILES = 20;
const MAX_SOURCE_BYTES = 256 * 1024;
const ROOT_NAME = /^(?:[A-Za-z][A-Za-z0-9_]*::)*[A-Za-z][A-Za-z0-9_]*\.[A-Za-z][A-Za-z0-9_]*$/;
const FILE_NAME = /^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.aadl$/i;

/** Capture a complete, independent workspace. Throws for unsupported host input. */
export function snapshot(files, step = {}, defaults = {}) {
  const entries = Object.entries(files);
  if (!entries.length || entries.length > MAX_FILES) throw new Error('The workspace needs between 1 and 20 AADL files.');
  const names = new Set();
  let bytes = 0;
  for (const [name, source] of entries) {
    if (!FILE_NAME.test(name) || typeof source !== 'string' || names.has(name.toLowerCase())) {
      throw new Error('Use distinct relative .aadl file paths without traversal or case-only duplicates.');
    }
    names.add(name.toLowerCase());
    bytes += new TextEncoder().encode(source).length;
  }
  if (bytes > MAX_SOURCE_BYTES) throw new Error('This browser workspace supports at most 256 KiB of source.');
  const root = String(step.aadl?.root ?? defaults.root ?? '').trim();
  if (!ROOT_NAME.test(root)) throw new Error('Choose a root implementation such as Rover_Budget::Loop.budget.');
  return { version: 1, root, files: Object.fromEntries(entries) };
}

/** Exact source identity includes every file and the selected root, not file order. */
export function sameSnapshot(left, right) {
  if (left.root !== right.root || left.version !== right.version) return false;
  const names = Object.keys(left.files);
  return names.length === Object.keys(right.files).length && names.every(name => left.files[name] === right.files[name]);
}

function requireString(value, label) {
  if (typeof value !== 'string' || !value) throw new Error('Invalid AADL result: missing ' + label + '.');
}

function collectFeatures(entries, features) {
  for (const feature of entries) {
    requireString(feature.id, 'feature id');
    requireString(feature.name, 'feature name');
    if (features.has(feature.id)) throw new Error('Duplicate AADL feature id.');
    features.add(feature.id);
    if (feature.features?.length) collectFeatures(feature.features, features);
  }
}

function validateContainment(model) {
  const parents = new Map(model.components.map(component => [component.id, component.parentId]));
  if (parents.get(model.rootId) != null) throw new Error('The model root must have no parent.');
  for (const component of model.components) {
    const visited = new Set();
    let id = component.id;
    while (id !== model.rootId) {
      if (visited.has(id)) throw new Error('The model contains a containment cycle.');
      visited.add(id);
      id = parents.get(id);
      if (!parents.has(id)) throw new Error('The model containment does not reach its root.');
    }
  }
}

function validateProjection(model) {
  if (!model || !Array.isArray(model.components) || !Array.isArray(model.connections) || !Array.isArray(model.bindings)) {
    throw new Error('A completed AADL result needs a resolved model.');
  }
  if (model.components.length > 200 || model.connections.length > 500) throw new Error('The resolved model exceeds the browser display limit.');
  const components = new Set();
  const features = new Set();
  for (const component of model.components) {
    requireString(component.id, 'component id');
    requireString(component.name, 'component name');
    requireString(component.category, 'component category');
    if (components.has(component.id) || !Array.isArray(component.features)) throw new Error('Invalid AADL component identity or features.');
    components.add(component.id);
    collectFeatures(component.features, features);
  }
  if (!components.has(model.rootId)) throw new Error('The model root does not identify a component.');
  for (const component of model.components) {
    if (component.parentId != null && !components.has(component.parentId)) throw new Error('The model has an unresolved parent component.');
  }
  validateContainment(model);
  for (const connection of model.connections) {
    const resolves = id => features.has(id) || (connection.kind === 'accessConnection' && components.has(id));
    for (const segment of [connection, ...(connection.segments || [])]) {
      if (!resolves(segment.source) || !resolves(segment.target)) throw new Error('The model has an unresolved connection endpoint.');
      if (segment.contextId && !components.has(segment.contextId)) throw new Error('The model has an unresolved connection context.');
    }
  }
  for (const binding of model.bindings) {
    if (!components.has(binding.sourceId) || !components.has(binding.targetId)) throw new Error('The model has an unresolved binding target.');
  }
}

/** Validate the JVM boundary before any renderer or exercise consumes its result. */
export function validateResult(result) {
  if (!result || result.version !== 1 || !['complete', 'invalid', 'error', 'incomplete'].includes(result.status)) {
    throw new Error('Unsupported AADL runtime protocol version or status.');
  }
  if (!Array.isArray(result.diagnostics)) throw new Error('Invalid AADL runtime diagnostics.');
  for (const diagnostic of result.diagnostics) requireString(diagnostic.message, 'diagnostic message');
  if (result.status === 'complete') validateProjection(result.model);
  if (result.analyses != null && !Array.isArray(result.analyses)) throw new Error('Invalid AADL analysis result list.');
  return result;
}

export function interrupted(reason, message) {
  return { version: 1, status: 'incomplete', reason, diagnostics: [{ severity: 'info', message }], analyses: [] };
}
