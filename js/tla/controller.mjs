import { displayResult, displayState, sameSnapshot } from './model.mjs';
import './view.js';

const START_OPERATIONS = new Set(['check', 'parse', 'explore-init']);
const interrupted = reason => ({ version: 1, status: 'incomplete', reason, diagnostics: [] });
const failed = error => ({ version: 1, status: 'error', reason: 'workspace-error', diagnostics: [{ message: error.message || String(error) }] });

function describeChoice(state) {
  const preview = (state.values || []).map(value => value.name + ' = ' + value.text).join('; ');
  return preview.length > 180 ? preview.slice(0, 180) + '…' : preview;
}

function initialChoices(result) {
  return (result.states || []).map((state, index) => ({
    id: state.id, label: 'Starting state ' + (index + 1), state,
    withinConstraints: state.withinConstraints,
  }));
}

/**
 * Coordinate a tutorial snapshot with one engine session. This module does not
 * interpret TLA+ or reconstruct states from text: state IDs belong to the engine.
 *
 * getSnapshot() returns a validated model.snapshot(...) request. run(operation,
 * overrideRequest?) may execute an instructor assessment against that snapshot;
 * freshness always compares the learner's original files. The returned promise
 * resolves a wire result suitable for grading; stale/cancelled results are always
 * incomplete. onCheck/onOperation may route UI actions through the tutorial's
 * shared run transaction. createView is the presentation boundary (injectable in
 * controller tests). reset retains the controller; destroy releases its client.
 */
export function createTLAController({ root, client, getSnapshot, onSourceLocation,
  onBusyChange = () => {}, onCheck, onOperation, createView = globalThis.SEBookTLAView.mount }) {
  let generation = 0;
  let destroyed = false;
  let busy = false;
  let request;
  let wireResult;
  let path = [];
  let selectedIndex = 0;
  let choices = [];
  let explorationActive = false;
  let viewState = { phase: 'idle', mode: 'check' };
  const nextByState = new Map();

  const view = createView(root, {
    onCheck: () => onCheck ? onCheck() : run('check'),
    onExplore: () => onOperation ? onOperation('explore-init') : run('explore-init'),
    onParse: () => onOperation ? onOperation('parse') : run('parse'),
    onStop: stop, onSelectState: selectState, onNextState: chooseState,
    onBack: () => selectState(selectedIndex - 1), onEvaluate: evaluate,
    onSourceLocation,
  });

  function render(changes) {
    if (destroyed) return;
    viewState = { ...viewState, ...changes };
    view.render(viewState);
  }

  function setBusy(value) {
    if (busy === value) return;
    busy = value;
    onBusyChange(value);
  }

  client.onPhase = phase => {
    if (!busy || destroyed) return;
    const message = phase === 'loading'
      ? 'Loading the model-checking tools in your browser. The first load can take a little while.'
      : viewState.mode === 'explore' ? 'Finding the allowed choices…' : phase === 'checking'
        ? 'Checking the configured model. You can stop this run.' : 'Preparing the specification…';
    render({ phase, message });
  };

  function snapshotIsCurrent() {
    try { return sameSnapshot(request, getSnapshot()); }
    catch { return false; } // An invalid edited workspace cannot match a completed run.
  }

  async function execute(operation, parameters = {}) {
    const token = ++generation;
    setBusy(true);
    render({ phase: operation === 'check' ? 'checking' : 'working', busy: true, message: 'Working… You can stop this run.' });
    let result;
    try { result = await client.execute({ ...request, ...parameters, operation }); }
    catch (error) { result = failed(error); }
    if (destroyed || token !== generation) return interrupted('cancelled');
    if (!snapshotIsCurrent()) {
      markStale();
      return interrupted('stale');
    }
    setBusy(false);
    render({ busy: false, message: '' });
    return result;
  }

  async function run(operation, overrideRequest) {
    if (!START_OPERATIONS.has(operation)) throw new TypeError('Unsupported TLA+ workspace operation: ' + operation);
    if (destroyed) return interrupted('disposed');
    reset();
    let parameters;
    try {
      request = structuredClone(getSnapshot());
      parameters = structuredClone(overrideRequest || {});
    }
    catch (error) {
      const result = failed(error);
      render({ phase: 'error', result: { status: 'error', diagnostics: result.diagnostics } });
      return result;
    }
    render({ mode: operation === 'explore-init' ? 'explore' : 'check' });
    const result = await execute(operation, parameters);
    if (['cancelled', 'stale'].includes(result.reason) || destroyed) return result;
    wireResult = result;
    if (operation === 'explore-init' && (result.states || result.choices || result.sessionExpired)) {
      explorationActive = !result.sessionExpired;
      showExploration(result, initialChoices(result));
    } else {
      const displayed = displayResult(result, { ...request, ...parameters });
      if (overrideRequest) displayed.scope = 'Instructor-defined property and configuration checked against your current files. This result applies to this finite model.';
      render({ phase: result.status === 'error' ? 'error' : 'complete', result: displayed, canEvaluate: false });
    }
    return result;
  }

  function showExploration(result, allChoices) {
    if (result.sessionExpired) explorationActive = false;
    choices = allChoices.filter(choice => choice.withinConstraints !== false);
    const displayed = displayResult({ ...wireResult, ...result, trace: undefined }, request);
    displayed.trace = path.map((state, index) => displayState(state, path[index - 1]));
    displayed.title = path.length ? 'Exploring one behavior' : 'Choose where the behavior begins';
    displayed.summary = 'These are choices for one behavior. Exploring them does not establish that the model satisfies its properties.';
    const failedInvariants = (path[selectedIndex]?.invariants || []).filter(invariant => !invariant.holds);
    if (failedInvariants.length) {
      displayed.status = 'counterexample';
      displayed.title = 'A checked invariant fails in this state';
      displayed.summary = failedInvariants.map(invariant => invariant.name).join(', ') + ' is false in the selected state. Inspect the changed variables to understand why.';
    }
    if (result.status === 'error') {
      displayed.title = 'Exploration could not continue';
      displayed.summary = 'Review the message below. You can restart exploration after correcting the problem.';
    }
    if (result.sessionExpired) {
      choices = [];
      displayed.title = 'The exploration session ended';
      displayed.summary = 'The runtime is no longer available for these states. Select Explore one behavior to start a new session.';
    }
    render({
      phase: 'exploring', mode: 'explore', result: displayed, selectedIndex,
      choices: choices.map(choice => ({ label: choice.label, description: describeChoice(choice.state) })),
      excludedChoiceCount: allChoices.length - choices.length,
      choicesIncomplete: result.status === 'incomplete' && !result.sessionExpired, explorationReady: true,
      sessionExpired: result.sessionExpired === true,
      canEvaluate: explorationActive && path.length > 0 && result.status !== 'error',
      evaluation: undefined,
    });
  }

  async function chooseState(index) {
    if (busy || !explorationActive || viewState.stale || !choices[index]) return;
    if (!snapshotIsCurrent()) { markStale(); return; }
    const choice = choices[index];
    const state = { ...choice.state, action: choice.state.action || choice.label, location: choice.location || choice.state.location };
    path = path.slice(0, selectedIndex + 1);
    path.push(state);
    selectedIndex = path.length - 1;
    choices = [];
    showExploration(wireResult, []);
    await loadChoices(state);
  }

  async function loadChoices(state) {
    const cached = nextByState.get(state.id);
    if (cached) { showExploration(cached, cached.choices || []); return; }
    const result = await execute('explore-next', { stateId: state.id });
    if (['cancelled', 'stale'].includes(result.reason) || destroyed) return;
    nextByState.set(state.id, result);
    showExploration(result, result.choices || []);
  }

  async function selectState(index) {
    if (busy || viewState.stale || index < 0) return;
    const length = explorationActive ? path.length : (viewState.result?.trace || []).length;
    if (index >= length) return;
    if (!snapshotIsCurrent()) { markStale(); return; }
    selectedIndex = index;
    if (explorationActive) await loadChoices(path[index]);
    else render({ selectedIndex });
  }

  async function evaluate(operator) {
    if (busy || !explorationActive || viewState.stale || !path[selectedIndex]) return;
    if (!snapshotIsCurrent()) { markStale(); return; }
    const result = await execute('evaluate', { stateId: path[selectedIndex].id, operator });
    if (['cancelled', 'stale'].includes(result.reason) || destroyed) return;
    if (result.sessionExpired) { showExploration(result, []); return; }
    const evaluation = result.status === 'complete' && result.value
      ? { expression: operator, value: result.value.text }
      : { expression: operator, error: (result.diagnostics || []).map(item => item.message).join('\n') || 'The operator could not be evaluated.' };
    render({ phase: 'exploring', evaluation });
  }

  function stop() {
    generation += 1;
    client.cancel();
    setBusy(false);
    explorationActive = false;
    choices = [];
    render({ phase: 'stopped', busy: false, message: 'Stopped. No conclusion is available for the complete model.', choices: [], canEvaluate: false, sessionExpired: true,
      result: { ...viewState.result, status: 'stopped', title: 'Stopped before completion', summary: 'The check or exploration was interrupted. Start a new run to continue.' } });
  }

  function markStale() {
    if (destroyed || !request) return;
    generation += 1;
    client.cancel();
    setBusy(false);
    explorationActive = false;
    render({ phase: 'complete', busy: false, message: '', stale: true, canEvaluate: false });
  }

  function reset() {
    generation += 1;
    client.cancel();
    setBusy(false);
    request = wireResult = undefined;
    explorationActive = false;
    path = [];
    choices = [];
    selectedIndex = 0;
    nextByState.clear();
    viewState = { phase: 'idle', mode: 'check' };
    render(viewState);
  }

  function destroy() {
    if (destroyed) return;
    reset();
    destroyed = true;
    client.destroy();
    client.onPhase = () => {};
    view.destroy();
  }

  return Object.freeze({ run, stop, reset, markStale, destroy });
}
