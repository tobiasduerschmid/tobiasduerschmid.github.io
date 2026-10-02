const MAX_CASES = 50;
const MAX_CASE_TEXT = 20000;

/**
 * Owns editable, in-memory examples; the caller owns Python execution.
 * onRun handles errors and transport. onChange invalidates any pending request.
 * readRequest throws when the case count or combined text exceeds the limits.
 * render accepts {cases:[{id, matched, passed, error?}], passed, total}.
 */
export function createRegexCases(root, callbacks) {
  return new RegexCases(root, callbacks);
}

class RegexCases {
  constructor(root, { onRun, onChange }) {
    this.root = root;
    this.panel = root.querySelector('#regex-cases');
    this.list = root.querySelector('#regex-case-list');
    this.template = root.querySelector('#regex-case-template');
    this.operation = root.querySelector('#regex-case-operation');
    this.addButton = root.querySelector('#regex-add-case');
    this.runButton = root.querySelector('#regex-run-cases');
    this.status = root.querySelector('#regex-cases-status');
    this.rows = new Map();
    this.nextNumber = 1;
    this.busy = false;
    this.onRun = onRun;
    this.onChange = onChange;
    this.listeners = new AbortController();
    this.bindEvents();
    this.addCase({ text: 'moss', expected: true });
    this.addCase({ text: 'stone', expected: false });
  }

  readRequest() {
    const cases = Array.from(this.rows.values(), row => ({
      id: row.id,
      text: row.text.value,
      expected: row.expectation.value === 'match',
    }));
    if (cases.length === 0 || cases.length > MAX_CASES) {
      throw new Error(`Add between 1 and ${MAX_CASES} test cases before running.`);
    }
    const textLength = cases.reduce((count, testCase) => count + Array.from(testCase.text).length, 0);
    if (textLength > MAX_CASE_TEXT) {
      throw new Error('Test cases exceed 20,000 Unicode code points in total. Shorten or remove a case, then run again.');
    }
    return { cases, operation: this.operation.value };
  }

  setBusy(busy) {
    this.busy = busy;
    this.panel.setAttribute('aria-busy', String(busy));
    for (const control of this.panel.querySelectorAll('textarea, select, button')) {
      control.disabled = busy;
    }
    this.addButton.disabled = busy || this.rows.size >= MAX_CASES;
    this.runButton.disabled = busy || this.rows.size === 0;
  }

  clearResults() {
    for (const row of this.rows.values()) {
      row.result.textContent = 'Not run with the current inputs.';
      delete row.result.dataset.outcome;
    }
    this.status.textContent = this.rows.size
      ? 'Run test cases with the current pattern, flags, and expected outcomes.'
      : 'Add a test case to begin.';
  }

  render(result) {
    for (const outcome of result.cases) {
      const row = this.rows.get(outcome.id);
      const expected = row.expectation.value === 'match' ? 'a match' : 'no match';
      row.result.dataset.outcome = outcome.error ? 'error' : outcome.passed ? 'pass' : 'fail';
      row.result.textContent = outcome.error
        ? `Could not run — ${outcome.error}`
        : `${outcome.passed ? 'Pass' : 'Fail'} — expected ${expected}; actual: ${outcome.matched ? 'match' : 'no match'}.`;
    }
    this.status.textContent = `${result.passed} of ${result.total} test cases passed.`;
  }

  bindEvents() {
    const options = { signal: this.listeners.signal };
    this.panel.addEventListener('input', event => {
      if (event.target.matches('textarea')) this.invalidate();
    }, options);
    this.panel.addEventListener('change', event => {
      if (event.target.matches('select')) this.invalidate();
    }, options);
    this.panel.addEventListener('click', event => this.handleClick(event), options);
  }

  handleClick(event) {
    if (this.busy) return;
    if (event.target === this.addButton) {
      if (this.rows.size >= MAX_CASES) return;
      const row = this.addCase({ text: '', expected: true });
      this.invalidate();
      row.text.focus();
    } else if (event.target === this.runButton) {
      this.onRun();
    } else if (event.target.matches('.regex-case-remove')) {
      this.removeCase(event.target.closest('.regex-case').dataset.caseId);
    }
  }

  addCase(values) {
    const number = this.nextNumber++;
    const row = createCaseRow(this.template, number, values);
    this.rows.set(row.id, row);
    this.list.appendChild(row.element);
    this.setBusy(this.busy);
    return row;
  }

  removeCase(id) {
    const row = this.rows.get(id);
    const remainingRows = Array.from(this.rows.values());
    const index = remainingRows.indexOf(row);
    const focusTarget = remainingRows[index + 1] ?? remainingRows[index - 1];
    row.element.remove();
    this.rows.delete(id);
    this.setBusy(this.busy);
    this.invalidate();
    (focusTarget ? focusTarget.text : this.addButton).focus();
  }

  invalidate() {
    this.clearResults();
    this.onChange();
  }

  destroy() {
    this.listeners.abort();
  }
}

function createCaseRow(template, number, values) {
  const element = template.content.firstElementChild.cloneNode(true);
  const id = `case-${number}`;
  const text = element.querySelector('.regex-case-text');
  const expectation = element.querySelector('.regex-case-expectation');
  const result = element.querySelector('.regex-case-result');
  element.dataset.caseId = id;
  element.querySelector('legend').textContent = `Test case ${number}`;
  connectCaseLabel(element, text, { number, field: 'text' });
  connectCaseLabel(element, expectation, { number, field: 'expectation' });
  text.value = values.text;
  expectation.value = values.expected ? 'match' : 'no-match';
  result.id = `regex-${id}-result`;
  element.querySelector('.regex-case-remove').textContent = `Remove test case ${number}`;
  return { id, element, text, expectation, result };
}

function connectCaseLabel(element, control, { number, field }) {
  control.id = `regex-case-${number}-${field}`;
  const label = element.querySelector(`[data-case-label="${field}"]`);
  label.htmlFor = control.id;
  label.textContent = `Test case ${number} ${field}`;
}
