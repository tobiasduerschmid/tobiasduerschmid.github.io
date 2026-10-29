(function (global) {
  'use strict';

  let nextViewId = 0;
  const BUSY_PHASES = new Set(['loading', 'checking', 'working', 'parsing']);
  const VERDICTS = {
    complete: ['No violation found in this model', 'The selected properties hold for the explored model. This does not prove correctness for larger bounds or a different configuration.'],
    counterexample: ['A behavior breaks a checked property', 'Follow the states below to see how the model reaches the problem.'],
    incomplete: ['The check is incomplete', 'No conclusion is available for the full model. Reduce the model size or run the check again.'],
    error: ['The model could not be checked', 'Read the message below, correct the specification or configuration, and try again.'],
    stopped: ['Stopped before completion', 'An interrupted check does not establish that the properties hold.'],
    parsed: ['The specification is ready to check', 'Syntax checking does not check whether the model satisfies its properties.']
  };

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(label, action, index) {
    const node = element('button', 'tla-button', label);
    node.type = 'button';
    node.dataset.action = action;
    node.dataset.focusKey = action + (index === undefined ? '' : ':' + index);
    if (index !== undefined) node.dataset.index = String(index);
    return node;
  }

  function disclosure(label) {
    const node = element('details', 'tla-details');
    node.append(element('summary', '', label));
    return node;
  }

  function actionCard(label, action, description) {
    const card = element('div', 'tla-action-card');
    const control = button(label, action);
    card.append(control, element('p', '', description));
    return { card, control };
  }

  function createShell(root, id) {
    const workspace = element('section', 'tla-workspace');
    workspace.setAttribute('aria-label', 'Model checking and exploration');
    const title = element('h3', '', 'Try the model');
    const intro = element('p', 'tla-intro', 'A state is one snapshot of the variables. A behavior is a sequence of states connected by allowed steps.');
    const check = actionCard('Check every reachable state', 'check', 'Search all behaviors of this configured model for a broken property.');
    const explore = actionCard('Explore one behavior', 'explore', 'Choose each next step yourself. Exploring one behavior is not a full check.');
    const actions = element('div', 'tla-actions');
    actions.append(check.card, explore.card);
    const toolbar = element('div', 'tla-toolbar');
    const parse = button('Check syntax / translate PlusCal', 'parse');
    const stop = button('Stop', 'stop');
    toolbar.append(parse, stop);
    const translationHint = element('p', 'tla-hint', 'PlusCal is translated to TLA+ automatically before checking or exploring.');
    const progress = element('p', 'tla-progress');
    progress.setAttribute('role', 'status');
    progress.setAttribute('aria-atomic', 'true');
    const stale = element('p', 'tla-notice', 'The source has changed. These results describe an earlier version; run again to check your edits.');
    stale.setAttribute('role', 'status');
    const result = element('section', 'tla-result');
    const verdict = element('h4', 'tla-verdict');
    verdict.setAttribute('aria-live', 'polite');
    verdict.setAttribute('aria-atomic', 'true');
    const summary = element('p');
    const scope = element('p', 'tla-scope');
    const diagnostics = element('ul', 'tla-diagnostics');
    result.append(verdict, summary, scope, diagnostics);
    const trace = createTrace(id);
    const choices = element('section', 'tla-choices');
    const choicesHeading = element('h4', '', 'What can happen next?');
    const choicesHint = element('p', 'tla-hint');
    const choiceScope = element('p', 'tla-notice');
    const choiceList = element('ul', 'tla-choice-list');
    choices.append(choicesHeading, choicesHint, choiceScope, choiceList);
    const evaluation = createEvaluation(id);
    const details = createDetails();
    workspace.append(title, intro, actions, toolbar, translationHint, progress, stale, result, trace.section, choices, evaluation.details, details.section);
    root.append(workspace);
    return { workspace, check: check.control, explore: explore.control, parse, stop, progress, stale,
      result, verdict, summary, scope, diagnostics, trace, choices, choicesHeading, choicesHint, choiceScope, choiceList, evaluation, details };
  }

  function createTrace(id) {
    const section = element('section', 'tla-trace');
    const heading = element('h4', '', 'Follow the behavior');
    const truncated = element('p', 'tla-notice');
    const navigation = element('div', 'tla-toolbar');
    const back = button('Back', 'back');
    const next = button('Next', 'next');
    const position = element('span', 'tla-position');
    position.setAttribute('role', 'status');
    position.setAttribute('aria-atomic', 'true');
    navigation.append(back, position, next);
    const jumpLabel = element('label', 'tla-jump', 'Jump to state ');
    const jump = element('select');
    jump.dataset.action = 'jump';
    jump.dataset.focusKey = 'jump';
    jumpLabel.append(jump);
    const sequence = element('ol', 'tla-sequence');
    sequence.setAttribute('aria-label', 'States in this behavior');
    const sequenceHint = element('p', 'tla-hint');
    const loop = element('p', 'tla-notice');
    const stateHeading = element('h4', 'tla-state-heading');
    stateHeading.tabIndex = -1;
    const location = element('div', 'tla-source');
    const changedLabel = element('label', 'tla-filter');
    const changed = element('input');
    changed.type = 'checkbox';
    changed.id = id + '-changed';
    changed.dataset.action = 'changed';
    changedLabel.append(changed, document.createTextNode(' Show only changed variables'));
    const table = element('table', 'tla-variables');
    const caption = element('caption', '', 'Variables in the selected state');
    const header = element('thead');
    const headers = element('tr');
    ['Variable', 'Value'].forEach(text => {
      const cell = element('th', '', text);
      cell.scope = 'col';
      headers.append(cell);
    });
    header.append(headers);
    const body = element('tbody');
    table.append(caption, header, body);
    section.append(heading, truncated, navigation, jumpLabel, sequence, sequenceHint, loop, stateHeading, location, changedLabel, table);
    return { section, heading, truncated, back, next, position, jump, sequence, sequenceHint, loop, stateHeading, location, changed, changedLabel, body };
  }

  function createEvaluation(id) {
    const details = disclosure('Watch an operator');
    const form = element('form', 'tla-evaluation-form');
    const label = element('label', '', 'Operator name');
    const input = element('input');
    input.type = 'text';
    input.id = id + '-expression';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.required = true;
    input.placeholder = 'TypeOK';
    label.htmlFor = input.id;
    const hint = element('p', 'tla-hint', 'Enter the name of a defined operator with no parameters, such as TypeOK. Its value is evaluated in this state. This does not check the operator over all behaviors.');
    hint.id = id + '-expression-hint';
    input.setAttribute('aria-describedby', hint.id);
    const evaluate = button('Evaluate', 'evaluate');
    evaluate.type = 'submit';
    const output = element('pre', 'tla-evaluation-result');
    output.setAttribute('role', 'status');
    output.setAttribute('aria-atomic', 'true');
    form.append(label, input, evaluate, hint, output);
    details.append(form);
    return { details, form, input, evaluate, output };
  }

  function createDetails() {
    const section = element('div', 'tla-run-details');
    const statistics = disclosure('Run details');
    const stats = element('dl', 'tla-statistics');
    statistics.append(stats);
    const generated = disclosure('Generated TLA+');
    generated.classList.add('tla-generated');
    const generatedText = element('pre', 'tla-code');
    generated.append(element('p', '', 'The PlusCal translator produces this specification for the checker. Edit the PlusCal source, then translate again.'), generatedText);
    const raw = disclosure('Tool output');
    const outputTruncated = element('p', 'tla-notice', 'The tool output was shortened. Some messages are not shown.');
    const output = element('pre', 'tla-code');
    raw.append(outputTruncated, output);
    const terms = disclosure('What do these terms mean?');
    const definitions = element('dl', 'tla-definitions');
    const glossary = [
      ['State', 'The values of all variables at one point.'],
      ['Step / action', 'A rule that allows the model to move from one state to another.'],
      ['Invariant', 'A condition that should hold in every reachable state.'],
      ['Counterexample', 'A behavior that violates a checked property. It explains how the property can fail.'],
      ['Deadlock', 'A state with no allowed next step. Whether this is an error depends on whether the model is meant to finish there.'],
      ['Liveness', 'A requirement that something eventually happens. A repeating loop can show why it never happens.'],
      ['Model bounds', 'The finite choices in the configuration, such as two processes or a queue of length three. A successful check applies to this model.']
    ];
    glossary.forEach(([term, meaning]) => definitions.append(element('dt', '', term), element('dd', '', meaning)));
    terms.append(definitions);
    const attribution = element('p', 'tla-attribution');
    const cheerpj = element('a', '', 'CheerpJ');
    cheerpj.href = 'https://cheerpj.com';
    const tools = element('a', '', 'TLA+ tools');
    tools.href = 'https://github.com/tlaplus/tlaplus';
    attribution.append(document.createTextNode('Java runs in your browser with '), cheerpj,
      document.createTextNode('; model checking uses the '), tools, document.createTextNode('.'));
    section.append(statistics, generated, raw, terms, attribution);
    return { section, statistics, stats, generated, generatedText, raw, outputTruncated, output };
  }

  function renderVerdict(ui, state) {
    const result = state.result;
    ui.result.hidden = !result;
    if (!result) return;
    const [title, explanation] = state.mode === 'explore' && result.status === 'complete'
      ? ['Exploring one behavior', 'Choose an allowed next step below. Other choices may lead to different outcomes; exploration is not a completed check.']
      : (VERDICTS[result.status] || ['Result available', 'Review the result and its scope below.']);
    ui.result.dataset.outcome = result.status;
    ui.verdict.textContent = result.title || title;
    ui.summary.textContent = result.summary || explanation;
    ui.scope.textContent = result.scope || (state.mode === 'explore' ? '' : 'Scope: this specification, its configuration, and the selected properties.');
    ui.scope.hidden = !ui.scope.textContent;
    ui.diagnostics.replaceChildren();
    (result.diagnostics || []).forEach((diagnostic, index) => {
      const item = element('li');
      item.append(element('p', '', diagnostic.message));
      if (diagnostic.location) {
        const source = button('Show source for this message', 'diagnostic', index);
        source.disabled = state.stale === true;
        item.append(source);
      }
      ui.diagnostics.append(item);
    });
  }

  function renderSequence(ui, states, selectedIndex, unavailable) {
    ui.position.textContent = 'State ' + (selectedIndex + 1) + ' of ' + states.length;
    ui.back.disabled = unavailable || selectedIndex === 0;
    ui.next.disabled = unavailable || selectedIndex >= states.length - 1;
    ui.jump.disabled = unavailable;
    ui.jump.replaceChildren(...states.map((state, index) => {
      const option = element('option', '', 'State ' + (index + 1) + (state.action ? ': ' + state.action : ''));
      option.value = String(index);
      return option;
    }));
    ui.jump.value = String(selectedIndex);
    const first = Math.max(0, Math.min(selectedIndex - 4, states.length - 9));
    const last = Math.min(states.length, first + 9);
    ui.sequence.start = first + 1;
    ui.sequence.replaceChildren();
    for (let index = first; index < last; index += 1) {
      const item = element('li');
      const control = button('State ' + (index + 1), 'select', index);
      control.disabled = unavailable;
      if (index === selectedIndex) control.setAttribute('aria-current', 'step');
      item.append(control);
      ui.sequence.append(item);
    }
    ui.sequenceHint.hidden = states.length <= 9;
    ui.sequenceHint.textContent = 'Showing states ' + (first + 1) + '–' + last + '. Use Jump to state to reach any state.';
  }

  function renderVariables(ui, current, previous, onlyChanged) {
    const previousValues = new Map((previous ? previous.variables : []).map(value => [value.name, value.value]));
    ui.replaceChildren();
    current.variables.forEach(variable => {
      const changed = previous && (variable.changed !== undefined ? variable.changed : previousValues.get(variable.name) !== variable.value);
      if (onlyChanged && previous && !changed) return;
      const row = element('tr', changed ? 'tla-variable-changed' : '');
      const name = element('th', '', variable.name);
      name.scope = 'row';
      name.append(element('span', 'tla-change', previous ? (changed ? 'Changed' : 'Unchanged') : 'Initial value'));
      const value = element('td');
      value.append(element('pre', 'tla-value', variable.value));
      if (variable.type) value.append(element('span', 'tla-value-type', variable.type));
      if (changed && previousValues.has(variable.name)) {
        const old = disclosure('Previous value');
        old.append(element('pre', 'tla-value', previousValues.get(variable.name)));
        value.append(old);
      }
      row.append(name, value);
      ui.append(row);
    });
    if (!ui.children.length) {
      const row = element('tr');
      const cell = element('td', '', onlyChanged ? 'No variables changed in this step.' : 'This state has no variables.');
      cell.colSpan = 2;
      row.append(cell);
      ui.append(row);
    }
  }

  function renderTrace(ui, state, unavailable) {
    const states = state.result ? (state.result.trace || []) : [];
    const index = state.selectedIndex || 0;
    ui.section.hidden = !states.length;
    if (!states.length) return;
    const current = states[index];
    renderSequence(ui, states, index, unavailable);
    ui.heading.textContent = state.mode === 'explore' ? 'Your chosen behavior' : 'Follow the behavior';
    ui.truncated.hidden = !state.result.traceTruncated;
    ui.truncated.textContent = 'Only the first ' + states.length + ' states are shown. The violating state or repeating cycle may lie beyond this view.';
    ui.stateHeading.textContent = 'State ' + (index + 1) + (current.action ? ' · ' + current.action : index === 0 ? ' · Start' : '');
    ui.location.replaceChildren();
    if (current.location) {
      const source = button('Show this step in the source', 'source');
      source.disabled = unavailable;
      ui.location.append(source);
    }
    ui.changedLabel.hidden = index === 0;
    const loopTo = state.result.loopTo;
    ui.loop.hidden = !Number.isInteger(loopTo) || state.result.traceTruncated === true;
    ui.loop.textContent = Number.isInteger(loopTo)
      ? 'Repeating behavior: after state ' + states.length + ', return to state ' + (loopTo + 1) + '. This loop can repeat forever.' : '';
    renderVariables(ui.body, current, states[index - 1], ui.changed.checked);
  }

  function renderChoices(ui, state, unavailable) {
    const choices = state.choices || [];
    const hasState = state.result && state.result.trace && state.result.trace.length;
    ui.choices.hidden = state.mode !== 'explore' || (!hasState && !choices.length && !state.explorationReady);
    ui.choicesHeading.textContent = state.sessionExpired ? 'Restart exploration' : hasState ? 'What can happen next?' : 'Choose a starting state';
    ui.choicesHint.textContent = state.sessionExpired ? 'This exploration session ended. Select Explore one behavior to restart.' : choices.length
      ? (hasState ? 'Each choice is an allowed step. Predict what will change, then choose one.' : 'Each choice satisfies the initial-state rule. Choose where this behavior begins.')
      : (!hasState ? 'No starting states are available within this configuration.'
        : state.excludedChoiceCount ? 'No next steps remain within the configured model constraints.'
          : state.choicesIncomplete ? 'Next-step generation did not finish.'
            : 'No next steps are available here. Go Back to try another choice, or check the model to investigate termination and deadlock.');
    const notes = [];
    if (state.excludedChoiceCount) notes.push(state.excludedChoiceCount + ' choices were excluded by the model constraints in the configuration.');
    if (state.choicesIncomplete) notes.push('Only part of the choice list is available. Other choices may exist. Reduce the model bounds and restart to see the complete list.');
    ui.choiceScope.textContent = notes.join(' ');
    ui.choiceScope.hidden = !notes.length;
    ui.choiceList.replaceChildren(...choices.map((choice, index) => {
      const item = element('li');
      const control = button('Choose ' + choice.label, 'choose', index);
      control.disabled = unavailable;
      item.append(control);
      if (choice.description) item.append(element('p', 'tla-hint', choice.description));
      return item;
    }));
  }

  function renderDetails(ui, result) {
    const stats = result ? (result.stats || {}) : {};
    ui.stats.replaceChildren();
    Object.entries(stats).forEach(([label, value]) => ui.stats.append(element('dt', '', label), element('dd', '', String(value))));
    ui.statistics.hidden = !Object.keys(stats).length;
    ui.generatedText.textContent = result ? (result.generatedSource || '') : '';
    ui.generated.hidden = !ui.generatedText.textContent;
    ui.output.textContent = result ? (result.output || '') : '';
    ui.outputTruncated.hidden = !result || !result.outputTruncated;
    ui.raw.hidden = !ui.output.textContent;
  }

  /**
   * Mount a presentation-only workspace. The controller owns execution and selection.
   * Callbacks: onCheck(), onExplore(), onParse(), onStop(), onSelectState(index),
   * onNextState(choiceIndex), onBack(), onEvaluate(expression), onSourceLocation(location).
   * Callbacks handle their own asynchronous errors and update the view with render().
   *
   * render({phase,mode,message?,stale?,selectedIndex?,choices?,evaluation?,canEvaluate?,result?})
   * Result: {status,title?,summary?,scope?,diagnostics?:[{message,location?}],stats?,
   * output?,outputTruncated?,generatedSource?,trace?:[{action?,location?,variables:[{name,value,type?,changed?}]}],loopTo?,traceTruncated?}.
   * value is upstream TLA+ text, never coerced JSON. Trace and loop indices are zero-based.
   * Choices: [{label,description?}]. Evaluation: {expression?,value?,error?}.
   * Opaque source locations are forwarded unchanged. Missing callbacks hide optional actions.
   */
  function mount(root, callbacks) {
    const ui = createShell(root, 'tla-view-' + (++nextViewId));
    const events = new AbortController();
    let state = { phase: 'idle', mode: 'check' };
    let destroyed = false;
    let pendingRunFocus = null;

    const focusControl = key => Array.from(ui.workspace.querySelectorAll('[data-focus-key]'))
      .find(node => node.dataset.focusKey === key);

    function render(nextState) {
      if (destroyed) return;
      state = nextState;
      const active = document.activeElement;
      const focusKey = ui.workspace.contains(active) ? active.dataset.focusKey : null;
      const busy = BUSY_PHASES.has(state.phase) || state.busy === true;
      const unavailable = busy || state.stale === true;
      if (busy && !pendingRunFocus && [ui.check, ui.explore, ui.parse].includes(active)) pendingRunFocus = focusKey;
      ui.check.disabled = busy;
      ui.explore.disabled = busy;
      ui.parse.disabled = busy;
      ui.parse.hidden = !callbacks.onParse;
      ui.stop.hidden = !busy;
      ui.stale.hidden = !state.stale;
      ui.progress.textContent = state.message || (busy ? 'Working… You can stop this run.' : '');
      renderVerdict(ui, state);
      renderTrace(ui.trace, state, unavailable);
      renderChoices(ui, state, unavailable);
      renderDetails(ui.details, state.result);
      const hasState = Boolean(state.result && state.result.trace && state.result.trace.length);
      ui.evaluation.details.hidden = !callbacks.onEvaluate || !hasState || state.canEvaluate === false;
      ui.evaluation.input.disabled = unavailable;
      ui.evaluation.evaluate.disabled = unavailable;
      ui.evaluation.output.textContent = state.evaluation ? (state.evaluation.error || state.evaluation.value || '') : '';
      ui.evaluation.input.setAttribute('aria-invalid', state.evaluation && state.evaluation.error ? 'true' : 'false');
      if (focusKey && !active.isConnected) {
        const replacement = focusControl(focusKey);
        if (replacement && !replacement.disabled) replacement.focus();
        else if (hasState) ui.trace.stateHeading.focus();
      }
      if (!busy && pendingRunFocus) {
        const control = focusControl(pendingRunFocus);
        pendingRunFocus = null;
        if (control && !control.disabled && !control.hidden &&
            (document.activeElement === document.body || document.activeElement === control)) control.focus({ preventScroll: true });
      }
    }

    function dispatch(event) {
      const control = event.target.closest('button[data-action]');
      if (!control || !ui.workspace.contains(control) || control.disabled) return;
      const index = Number(control.dataset.index);
      const handlers = {
        check: () => callbacks.onCheck(), explore: () => callbacks.onExplore(),
        parse: () => callbacks.onParse(), stop: () => callbacks.onStop(),
        back: () => callbacks.onBack(), next: () => callbacks.onSelectState((state.selectedIndex || 0) + 1),
        select: () => callbacks.onSelectState(index), choose: () => callbacks.onNextState(index),
        source: () => callbacks.onSourceLocation(state.result.trace[state.selectedIndex || 0].location),
        diagnostic: () => callbacks.onSourceLocation(state.result.diagnostics[index].location)
      };
      if (handlers[control.dataset.action]) handlers[control.dataset.action]();
    }

    // Disabling an active run button can move browser focus to body. Restore it
    // only while the learner has not deliberately focused something else.
    document.addEventListener('focusin', event => {
      if (pendingRunFocus && event.target !== document.body && event.target !== focusControl(pendingRunFocus)) pendingRunFocus = null;
    }, { signal: events.signal });
    ui.workspace.addEventListener('click', dispatch, { signal: events.signal });
    ui.trace.jump.addEventListener('change', () => callbacks.onSelectState(Number(ui.trace.jump.value)), { signal: events.signal });
    ui.trace.changed.addEventListener('change', () => render(state), { signal: events.signal });
    ui.evaluation.form.addEventListener('submit', event => {
      event.preventDefault();
      const expression = ui.evaluation.input.value.trim();
      if (expression && !ui.evaluation.evaluate.disabled) callbacks.onEvaluate(expression);
    }, { signal: events.signal });
    render(state);
    return {
      render,
      markStale() { render({ ...state, stale: true }); },
      destroy() { destroyed = true; events.abort(); ui.workspace.remove(); }
    };
  }

  global.SEBookTLAView = Object.freeze({ mount });
})(typeof window !== 'undefined' ? window : globalThis);
