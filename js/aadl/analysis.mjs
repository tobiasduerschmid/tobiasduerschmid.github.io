/** Interpret native latency evidence for this tutorial's explicit budget profile. */
export function hasLatencyRange(latency) {
  return latency?.present === true && Number.isFinite(latency.minimumMs) && Number.isFinite(latency.maximumMs)
    && latency.minimumMs >= 0 && latency.maximumMs >= latency.minimumMs;
}

function missingContributions(model, flow) {
  if (!flow || !flow.elements?.length) return ['A nonempty resolved end-to-end flow is required.'];
  const elements = new Map([...model.flows, ...model.connections].map(element => [element.id, element]));
  const missing = [];
  for (const id of flow.elements) {
    const element = elements.get(id);
    if (!element || !hasLatencyRange(element.latency)) missing.push('Explicit latency contribution for ' + (element?.name || id));
    if (['source', 'path', 'sink'].includes(element?.kind) && model.components.some(component => component.parentId === element.contextId)) {
      missing.push('Expanded timing evidence for composite ' + element.contextId);
    }
  }
  return missing;
}

/** Raw values remain available when coverage is incomplete; no zero-cost inference. */
export function latencyEvidence(result) {
  if (result.status !== 'complete' || !result.model) return [];
  const flows = new Map((result.model.flows || []).map(flow => [flow.id, flow]));
  return (result.analyses || []).filter(analysis => analysis.kind === 'latency').flatMap(analysis =>
    (analysis.results || []).map(native => {
      const flow = flows.get(native.elementId);
      const missing = missingContributions(result.model, flow);
      const mode = typeof native.values?.[0] === 'string' ? native.values[0] : '';
      if (mode) missing.push('Mode-specific timing evidence is outside this static explicit budget profile.');
      const numeric = Number.isFinite(native.minimumMs) && Number.isFinite(native.maximumMs);
      const completed = analysis.status === 'complete' && ['SUCCESS', 'FAILURE'].includes(native.resultType);
      const complete = completed && numeric && missing.length === 0;
      const bounded = hasLatencyRange(flow?.latency) && Number.isFinite(native.minimumRequirementMs) && Number.isFinite(native.maximumRequirementMs);
      let finding = 'inconclusive';
      if (complete && !bounded) finding = 'not_applicable';
      if (complete && bounded) finding = native.minimumMs >= native.minimumRequirementMs && native.maximumMs <= native.maximumRequirementMs ? 'satisfied' : 'violated';
      return { ...native, name: flow?.name || native.elementId, mode, complete, missing, finding, assumptions: analysis.assumptions, source: flow?.sourceLocation };
    }));
}
