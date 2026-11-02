import { hasLatencyRange, latencyEvidence } from './analysis.mjs';

const equalName = (left, right) => typeof left === 'string' && left.toLowerCase() === right.toLowerCase();
const rangeIs = (value, minimum, maximum) => hasLatencyRange(value) && Math.abs(value.minimumMs - minimum) < 1e-9 && Math.abs(value.maximumMs - maximum) < 1e-9;
const outcome = (passed, message) => ({ passed, message });

function budgetPath(model) {
  const root = model.components.find(component => component.id === model.rootId);
  if (root?.category !== 'system' || !equalName(root.classifier, 'Rover_Budget::Loop.budget')) return null;
  const part = name => model.components.find(component => component.parentId === root.id && equalName(component.name, name));
  const sensor = part('sensor');
  const control = part('control');
  const actuator = part('actuator');
  if (sensor?.category !== 'device' || control?.category !== 'system' || actuator?.category !== 'device') return null;
  const response = model.flows.find(flow => flow.contextId === root.id && flow.kind === 'end-to-end' && equalName(flow.name, 'response'));
  if (response?.elements?.length !== 5) return null;
  const flow = id => model.flows.find(candidate => candidate.id === id);
  const connection = id => model.connections.find(candidate => candidate.id === id);
  const [sourceId, firstId, pathId, secondId, sinkId] = response.elements;
  const source = flow(sourceId), path = flow(pathId), sink = flow(sinkId);
  const first = connection(firstId), second = connection(secondId);
  if (source?.kind !== 'source' || source.contextId !== sensor.id || path?.kind !== 'path' || path.contextId !== control.id
      || sink?.kind !== 'sink' || sink.contextId !== actuator.id) return null;
  if (first?.source !== source.target || first?.target !== path.source || second?.source !== path.target || second?.target !== sink.source) return null;
  if (!hasTypedPort(sensor, source.target, 'out', 'Speed') || !hasTypedPort(control, path.source, 'in', 'Speed')
      || !hasTypedPort(control, path.target, 'out', 'Drive_Command') || !hasTypedPort(actuator, sink.source, 'in', 'Drive_Command')) return null;
  return { source, path, sink, first, second, response };
}

function hasTypedPort(component, id, direction, classifier) {
  const feature = component.features.find(candidate => candidate.id === id);
  return feature?.kind === 'dataPort' && feature.direction === direction
    && equalName(feature.dataClassifier, 'Rover_Budget::' + classifier);
}

function hasRequiredBudgets(path) {
  return rangeIs(path.source.latency, 4, 4) && rangeIs(path.path.latency, 8, 12)
    && rangeIs(path.sink.latency, 6, 6) && rangeIs(path.first.latency, 0, 0) && rangeIs(path.second.latency, 0, 0);
}

/** Grade the fixed three-part lesson model, using resolved evidence only. */
export function assess(result, specification) {
  if (specification.fixture !== 'rover-budget-v1' || !['connected-flow', 'complete-budget', 'tight-bound'].includes(specification.criterion)) {
    throw new Error('Unknown AADL exercise criterion.');
  }
  if (['error', 'incomplete'].includes(result.status)) return outcome(null, 'The check did not complete. Test your current model again.');
  if (result.status !== 'complete') return outcome(false, 'Resolve the AADL diagnostics before checking this architectural requirement.');
  const path = budgetPath(result.model);
  if (!path) return outcome(false, 'Preserve the sensor → control → actuator response flow, device/system roles, and incoming/outgoing data ports carrying Speed and Drive_Command.');
  if (specification.criterion === 'connected-flow') return outcome(true, 'The required response flow is connected through valid component interfaces.');
  if (specification.required_upper_bound_ms !== undefined && !rangeIs(path.response.latency, 0, specification.required_upper_bound_ms)) {
    return outcome(false, `Keep the supplied end-to-end requirement at 0–${specification.required_upper_bound_ms} ms for this exercise.`);
  }
  if (!hasRequiredBudgets(path)) return outcome(false, 'Use the supplied sensor 4 ms, controller 8–12 ms, actuator 6 ms, and explicit zero-delay connection evidence.');
  const evidence = latencyEvidence(result).find(row => row.elementId === path.response.id);
  if (!evidence?.complete || evidence.minimumMs !== 18 || evidence.maximumMs !== 22) return outcome(false, 'A complete OSATE analysis must account for the supplied contributions and report 18–22 ms.');
  if (specification.criterion === 'complete-budget') return outcome(true, 'The supplied timing contributions are present and OSATE accounts for the complete 18–22 ms path.');
  if (!rangeIs(path.response.latency, 0, 22) || evidence.finding !== 'satisfied') return outcome(false, 'State the tightest supported upper bound: 22 ms, with a 0 ms lower requirement. Keep all supplied contributor evidence unchanged.');
  return outcome(true, 'The 22 ms bound is satisfied at equality under the explicit budget assumptions.');
}
