import { interrupted, sameSnapshot } from './model.mjs';

/** Coordinate source revisions and execution; neither the view nor the client grades. */
export function createAADLController({ client, getSnapshot, view, debounceMs = 1200, onResult = () => {}, onBusyChange = () => {} }) {
  let generation = 0;
  let timer;
  let progressTimer;
  let loadingSince = 0;
  let loadingDetail = {};
  let destroyed = false;
  let state = { phase: 'idle', busy: false, stale: false, result: null };

  function render(changes) {
    if (destroyed) return;
    const wasBusy = state.busy;
    state = { ...state, ...changes };
    if (!state.busy || state.phase !== 'loading') clearInterval(progressTimer);
    view.render(state);
    if (wasBusy !== state.busy) onBusyChange(state.busy);
  }

  client.onPhase = (phase, detail = {}) => {
    clearInterval(progressTimer);
    if (phase === 'loading') {
      if (Number.isFinite(detail.elapsedMs)) loadingSince = Date.now() - detail.elapsedMs;
      loadingDetail = detail;
      const update = () => render({ phase, busy: true, message: startupMessage(loadingDetail, Date.now() - loadingSince) });
      update();
      progressTimer = setInterval(update, 15000);
    } else render({ phase, busy: true, message: phase === 'waiting'
      ? 'Finishing the previous check. Your latest model is queued; the engine will stay loaded.'
      : phase === 'analyzing' ? 'Analyzing the current architecture…' : 'Validating and resolving the current architecture…' });
  };

  function supersedePending() {
    clearTimeout(timer);
    clearInterval(progressTimer);
    generation++;
    client.supersede();
  }

  function markStale() {
    supersedePending();
    render({ phase: 'stale', stale: true, busy: false, message: 'Source changed. Previous results do not describe the current model.' });
  }

  function schedule() {
    if (destroyed) return;
    markStale();
    timer = setTimeout(() => { run('validate'); }, debounceMs);
  }

  async function run(operation = 'analyze') {
    if (!['validate', 'analyze'].includes(operation)) throw new Error('Unsupported AADL operation.');
    if (destroyed) return interrupted('disposed', 'The architecture workspace has closed.');
    supersedePending();
    const token = generation;
    let captured;
    try {
      captured = getSnapshot();
      loadingSince = Date.now();
      render({ phase: 'loading', operation, busy: true, root: captured.root, message: 'Preparing the current architecture…' });
      const result = await client.execute({ ...captured, operation });
      if (destroyed || generation !== token) return interrupted('canceled', 'The operation was superseded.');
      let current = false;
      try { current = sameSnapshot(captured, getSnapshot()); }
      catch { /* An invalid edited root cannot match the completed request. */ }
      if (!current) { markStale(); return interrupted('stale', 'The files changed while this operation was running.'); }
      render({ phase: result.status === 'complete' ? 'complete' : result.status, result, stale: false, busy: false, message: '' });
      onResult(result);
      return result;
    } catch (error) {
      const result = { version: 1, status: 'error', diagnostics: [{ severity: 'error', message: error.message }], analyses: [] };
      if (!destroyed && generation === token) render({ phase: 'error', result, busy: false, message: error.message });
      return result;
    }
  }

  function stop() {
    supersedePending();
    client.cancel();
    render({ phase: 'incomplete', busy: false, stale: true, message: 'Stopped. No new analysis conclusion is available.' });
  }

  function reset() {
    supersedePending();
    client.cancel();
    const wasBusy = state.busy;
    state = { phase: 'idle', busy: false, stale: false, result: null };
    view.clear();
    if (wasBusy) onBusyChange(false);
  }

  function destroy() {
    reset();
    destroyed = true;
    client.destroy();
    view.destroy();
  }

  return { run, schedule, markStale, stop, reset, destroy };
}

function startupMessage(detail, elapsedMs) {
  const stages = {
    runtime: 'Starting the browser Java runtime',
    language: 'Loading the AADL language',
    services: 'Initializing OSATE',
  };
  const stage = detail.stage === 'download'
    ? `Loading AADL tools (${detail.completed} of ${detail.total} verified)`
    : stages[detail.stage] || 'Starting OSATE in your browser';
  const seconds = Math.max(0, Math.floor(elapsedMs / 1000));
  return `${stage}… ${seconds} s elapsed. First startup usually takes about a minute. You can keep editing; the latest model will run when ready.`;
}
