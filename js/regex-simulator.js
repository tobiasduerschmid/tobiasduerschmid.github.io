import { createRegexView } from './regex-simulator-view.js';
import { createRegexCases } from './regex-simulator-cases.js';

const EXAMPLES = {
  words: { pattern: String.raw`\b(?P<word>moss|fern)\b`, text: 'moss fern mossy' },
  greedy: { pattern: String.raw`\[.*\]`, text: '[fern] [moss]' },
  lazy: { pattern: String.raw`\[.*?\]`, text: '[fern] [moss]' },
  groups: { pattern: '(?P<label>[a-z]+):(?P<state>on|off)', text: 'lamp:on fan:off' },
  empty: { pattern: '(?=fern)', text: 'fern moss fern' },
};
const STARTUP_LIMIT_MS = 30000;
const EXECUTION_LIMIT_MS = 2000;

function initializeSimulator(root) {
  const find = id => root.querySelector(`#regex-${id}`);
  const view = createRegexView(root);
  const cases = createRegexCases(root, { onRun: runCases, onChange: invalidateCases });
  let worker = null;
  let workerReady = false;
  let pending = null;
  let requestId = 0;
  let watchdog;

  function status(message) {
    find('status').textContent = message;
  }

  function setBusy(busy) {
    find('run').disabled = busy;
    find('stop').disabled = !busy;
    cases.setBusy(busy);
  }

  function destroyWorker() {
    clearTimeout(watchdog);
    if (worker) worker.terminate();
    worker = null;
    workerReady = false;
    pending = null;
    setBusy(false);
  }

  function stop(message) {
    destroyWorker();
    view.clear();
    cases.clearResults();
    status(message);
  }

  function startWatchdog(isReady) {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      const message = isReady
        ? 'Stopped after 2 seconds. Try shorter text or simplify repeated groups, then run again.'
        : 'The simulator did not become ready within 30 seconds. Run again to retry.';
      stop(message);
      view.showError({ message });
    }, isReady ? EXECUTION_LIMIT_MS : STARTUP_LIMIT_MS);
  }

  function receive(message) {
    if (message.type === 'ready') {
      workerReady = true;
      if (pending) {
        status(pending.request.action === 'test' ? 'Running test cases…' : 'Running pattern…');
        startWatchdog(true);
      }
      return;
    }
    if (!pending || message.id !== pending.id) return;
    if (message.type === 'fatal') {
      stop('The simulator could not start. Run again to retry.');
      view.showError({ message: message.message });
      return;
    }
    if (message.type !== 'result') return;
    clearTimeout(watchdog);
    const completed = pending;
    pending = null;
    setBusy(false);
    if (!message.result.ok) {
      view.showError(message.result.error);
      status('Could not run. Check the error message.');
      return;
    }
    if (completed.request.action === 'test') {
      cases.render(message.result);
      status(`${message.result.passed} of ${message.result.total} test cases passed.`);
    } else {
      status(view.render(message.result, completed.request, completed.label));
    }
  }

  function getWorker() {
    if (worker) return worker;
    const created = new Worker(root.dataset.workerUrl);
    worker = created;
    created.addEventListener('message', event => {
      if (worker === created) receive(event.data);
    });
    created.addEventListener('error', event => {
      if (worker !== created) return;
      event.preventDefault();
      stop('The simulator stopped. Run again to retry.');
      view.showError({ message: event.message || 'Unable to start the simulator. Reload the page or try again.' });
    });
    return created;
  }

  function readPattern() {
    return {
      pattern: find('pattern').value,
      flags: Array.from(root.querySelectorAll('input[name="regex-flag"]:checked'), input => input.value),
    };
  }

  function execute(request, label) {
    if (pending) return;
    view.clear();
    try {
      const activeWorker = getWorker();
      pending = { id: ++requestId, request, label };
      setBusy(true);
      const runningMessage = request.action === 'test' ? 'Running test cases…' : 'Running pattern…';
      status(workerReady ? runningMessage : 'Preparing simulator…');
      startWatchdog(workerReady);
      activeWorker.postMessage({ type: 'run', id: pending.id, request: pending.request });
    } catch (error) {
      stop('Could not start the simulator. Run again to retry.');
      view.showError({ message: error.message });
    }
  }

  function run(event) {
    event.preventDefault();
    execute({
      action: 'analyze',
      ...readPattern(),
      text: find('text').value,
      operation: find('operation').value,
      replacement: find('replacement').value,
    }, find('operation').selectedOptions[0].textContent);
  }

  function runCases() {
    try {
      const request = { action: 'test', ...readPattern(), ...cases.readRequest() };
      cases.clearResults();
      execute(request);
    } catch (error) {
      view.showError({ message: error.message });
      status('Could not run test cases. Check the error message.');
    }
  }

  function invalidateCases() {
    if (pending?.request.action === 'test') destroyWorker();
    view.clearError();
    cases.clearResults();
    status('Test cases changed. Run test cases to check them.');
  }

  function invalidate(clearCases = false) {
    if (pending) destroyWorker();
    view.clear();
    if (clearCases) cases.clearResults();
    find('replacement-field').hidden = find('operation').value !== 'sub';
    status('Inputs changed. Run pattern to update the results.');
  }

  function loadExample() {
    const example = EXAMPLES[find('example').value];
    find('pattern').value = example.pattern;
    find('text').value = example.text;
    find('operation').value = 'finditer';
    find('replacement').value = find('example').value === 'groups' ? String.raw`\g<label>` : '<plant>';
    for (const flag of root.querySelectorAll('input[name="regex-flag"]')) flag.checked = false;
    invalidate(true);
    status('Example loaded. Predict what will match, then run the pattern.');
  }

  find('form').addEventListener('submit', run);
  find('pattern').addEventListener('input', () => invalidate(true));
  for (const id of ['text', 'replacement']) find(id).addEventListener('input', () => invalidate());
  find('operation').addEventListener('change', () => invalidate());
  for (const flag of root.querySelectorAll('input[name="regex-flag"]')) flag.addEventListener('change', () => invalidate(true));
  find('stop').addEventListener('click', () => stop('Stopped. Your inputs are unchanged. Run again when ready.'));
  find('load-example').addEventListener('click', loadExample);
  find('probe-first').addEventListener('click', () => view.step('first'));
  find('probe-prev').addEventListener('click', () => view.step(-1));
  find('probe-next').addEventListener('click', () => view.step(1));
  window.addEventListener('pagehide', () => {
    if (pending) stop('Stopped when leaving the page. Run again when ready.');
    else destroyWorker();
  });
}

const root = document.getElementById('regex-simulator');
if (root) initializeSimulator(root);
