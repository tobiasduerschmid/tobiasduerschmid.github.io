import { mountDiagram } from './diagram.mjs';
import { latencyEvidence } from './analysis.mjs';

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function region(name) {
  const node = element('section');
  node.setAttribute('aria-label', name);
  node.append(element('h3', name));
  return node;
}

const range = (minimum, maximum) => Number.isFinite(minimum) && Number.isFinite(maximum)
  ? `${minimum}–${maximum} ms` : 'Unavailable';
const findings = { satisfied: 'Satisfied', violated: 'Violated', inconclusive: 'Inconclusive', not_applicable: 'No bound to check' };
const assumptionNames = {
  asynchronousSystem: 'Asynchronous system', disableQueuingLatency: 'Queuing latency disabled',
  bestCaseEmptyQueue: 'Empty queue in best case', majorFrameDelay: 'Major-frame delay', worstCaseDeadline: 'Deadline in worst case',
};

/** Present resolved engine evidence. Invalid/current source never inherits an old success. */
export function mountAADLView(root, { onStop = () => {}, onRootChange = () => {}, onSourceLocation } = {}) {
  root.classList.add('aadl-workspace');
  const ui = createShell(root);
  const diagram = mountDiagram(ui.diagram, { onSourceLocation });
  const listeners = new AbortController();
  let displayedModel = null;
  let displayedRoot = '';
  ui.stop.addEventListener('click', () => {
    onStop();
    ui.update.focus();
  }, { signal: listeners.signal });
  ui.rootForm.addEventListener('submit', event => {
    event.preventDefault();
    onRootChange(ui.root.value.trim());
  }, { signal: listeners.signal });

  function render(state) {
    if (state.root && state.root !== displayedRoot) {
      displayedRoot = state.root;
      ui.root.value = state.root;
    }
    ui.status.textContent = state.message || statusText(state);
    ui.stop.hidden = !state.busy;
    const current = !state.stale && state.phase === 'complete' && state.result?.model;
    if (current && state.result.model !== displayedModel) {
      displayedModel = state.result.model;
      void diagram.render(displayedModel);
    } else if (displayedModel && (state.stale || (!state.busy && !current))) diagram.markStale();
    renderDiagnostics(ui.diagnostics, state.result?.diagnostics || [], !state.stale && !state.busy ? onSourceLocation : null);
    renderAnalysis(ui.analysis, current ? state.result : null, state.operation);
  }

  function clear() {
    displayedModel = null;
    displayedRoot = '';
    diagram.clear();
    render({ phase: 'idle' });
  }

  clear();
  return { render, clear, destroy() { listeners.abort(); diagram.destroy(); root.replaceChildren(); } };
}

function createShell(root) {
  const rootForm = element('form', undefined, 'aadl-workspace__root');
  const label = element('label', 'Root implementation');
  const input = element('input');
  input.type = 'text';
  input.autocomplete = 'off';
  input.spellcheck = false;
  label.append(input);
  const update = element('button', 'Update root');
  update.type = 'submit';
  rootForm.append(label, update);
  const status = element('p', undefined, 'aadl-workspace__status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const stop = element('button', 'Stop model update');
  stop.type = 'button';
  stop.hidden = true;
  const diagnostics = region('Model diagnostics');
  const diagram = element('div');
  const analysis = region('Latency evidence');
  root.append(rootForm, status, stop, diagnostics, diagram, analysis);
  return { rootForm, root: input, update, status, stop, diagnostics, diagram, analysis };
}

function statusText(state) {
  if (state.phase === 'complete') return 'OSATE resolved the current model.';
  if (state.phase === 'invalid') return 'The current model contains errors. Correct them to update the architecture.';
  if (state.phase === 'error') return 'The engine could not finish. No analysis conclusion is available.';
  if (state.phase === 'incomplete') return 'The operation did not finish. No analysis conclusion is available.';
  return 'Edit the specification to update its architecture. Choose Analyze model to compute latency.';
}

function resetRegion(root, title) {
  root.replaceChildren(element('h3', title));
}

function renderDiagnostics(root, diagnostics, onSourceLocation) {
  resetRegion(root, 'Model diagnostics');
  root.hidden = diagnostics.length === 0;
  const list = element('ul');
  for (const diagnostic of diagnostics) {
    const item = element('li', `${diagnostic.severity || 'info'}: ${diagnostic.message}`);
    if (diagnostic.file && diagnostic.line && onSourceLocation) {
      const button = element('button', `${diagnostic.file}:${diagnostic.line}`);
      button.type = 'button';
      button.addEventListener('click', () => onSourceLocation(diagnostic));
      item.append(' ', button);
    }
    list.append(item);
  }
  root.append(list);
}

function renderAnalysis(root, result, operation) {
  resetRegion(root, 'Latency evidence');
  const evidence = result ? latencyEvidence(result) : [];
  if (!evidence.length) {
    root.append(element('p', result && operation === 'analyze'
      ? 'OSATE produced no end-to-end latency result for this root. Add a resolved end-to-end flow with timing evidence.'
      : 'No current latency result. Choose Analyze model after the architecture resolves.'));
    return;
  }
  root.append(element('p', 'This explicit budget profile requires a stated latency for every leaf flow and connection. It does not establish schedulability or physical response time.'));
  for (const flow of evidence) {
    const card = element('article', undefined, 'aadl-workspace__finding');
    card.append(element('h4', `${flow.name}: ${findings[flow.finding]}`));
    if (flow.mode) card.append(element('p', `System operation mode: ${flow.mode}`));
    card.append(element('p', `OSATE computed ${range(flow.minimumMs, flow.maximumMs)}. Stated bound: ${range(flow.minimumRequirementMs, flow.maximumRequirementMs)}.`));
    if (flow.missing.length) {
      card.append(element('p', 'Missing evidence prevents a supported timing conclusion:'));
      const list = element('ul');
      for (const missing of flow.missing) list.append(element('li', missing));
      card.append(list);
    }
    if (flow.message) card.append(element('p', flow.message));
    renderNativeDetails(card, flow);
    root.append(card);
  }
}

function renderNativeDetails(root, flow) {
  const details = element('details');
  details.append(element('summary', 'OSATE contributors and assumptions'));
  const content = element('div');
  const contributors = element('ul');
  for (const contribution of flow.contributors || []) {
    const values = contribution.values || [];
    contributors.append(element('li', `${contribution.elementId}: ${range(values[0], values[1])}${values[6] ? ' (' + values[6] + ')' : ''}`));
  }
  if (contributors.childElementCount) content.append(contributors);
  const assumptions = element('ul');
  for (const [name, value] of Object.entries(flow.assumptions || {})) {
    assumptions.append(element('li', `${assumptionNames[name] || name}: ${value ? 'yes' : 'no'}`));
  }
  content.append(assumptions);
  for (const diagnostic of flow.diagnostics || []) content.append(element('p', diagnostic.message));
  details.append(content);
  root.append(details);
}
