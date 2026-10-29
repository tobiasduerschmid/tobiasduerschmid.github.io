import { assess as assessOutcome, snapshot as validateWorkspace } from './model.mjs';

const FIELDS = new Set(['status', 'reason', 'invariant', 'property', 'model_config']);

function validateExpectation(expectation) {
  if (!expectation || Array.isArray(expectation) || typeof expectation !== 'object' ||
      Object.keys(expectation).some(key => !FIELDS.has(key))) {
    throw new Error('A tla test accepts status, reason, invariant, property, and model_config.');
  }
  // Keep the existing outcome contract in one place.
  assessOutcome({ status: 'incomplete' }, { status: expectation.status, reason: expectation.reason });
  for (const key of ['invariant', 'property', 'model_config']) {
    if (expectation[key] !== undefined && (typeof expectation[key] !== 'string' || !expectation[key].trim())) {
      throw new Error('A tla test ' + key + ' must be nonempty text.');
    }
  }
  if (expectation.invariant !== undefined && expectation.property !== undefined) {
    throw new Error('A tla test must choose either invariant or property, not both.');
  }
  if ((expectation.invariant !== undefined || expectation.property !== undefined) && expectation.model_config === undefined) {
    throw new Error('A tla test with invariant or property requires an instructor-authored model_config.');
  }
}

function unusedHarnessName(files) {
  let suffix = '';
  let index = 2;
  while (Object.hasOwn(files, 'SEBookTutorialCheck' + suffix + '.tla') ||
         Object.hasOwn(files, 'SEBookTutorialCheck' + suffix + '.cfg')) suffix = String(index++);
  return 'SEBookTutorialCheck' + suffix;
}

/**
 * Build a fresh checker request from a validated learner snapshot and trusted
 * YAML expectation. Instructor configuration replaces the selected learner
 * configuration; an invariant or temporal property becomes a real TLA+ module
 * checked by TLC.
 * Source/configuration syntax is interpreted only by the official tools.
 */
export function buildCheck(source, expectation) {
  validateExpectation(expectation);
  const request = structuredClone(source);
  request.operation = 'check';
  if (expectation.model_config === undefined) return request;

  const name = unusedHarnessName(request.files);
  const config = name + '.cfg';
  const expression = expectation.invariant ?? expectation.property;
  const checkKind = expectation.invariant !== undefined ? 'INVARIANT' : 'PROPERTY';
  if (expression !== undefined) {
    const module = source.entry.slice(0, -4);
    if (!/^[A-Za-z_][A-Za-z_0-9]*$/.test(module)) {
      throw new Error('A property check requires an entry filename that is a TLA+ module identifier.');
    }
    request.entry = name + '.tla';
    request.files[request.entry] = '---- MODULE ' + name + ' ----\nEXTENDS ' + module +
      '\n\nSEBookProperty == (\n' + expression + '\n)\n====\n';
  }
  request.files[config] = expectation.model_config.trimEnd() + '\n' +
    (expression === undefined ? '' : checkKind + ' SEBookProperty\n');
  request.config = config;
  // Do not let a workspace flag disable an instructor's deadlock check. TLC
  // still honors CHECK_DEADLOCK FALSE when the instructor writes it explicitly.
  request.checkDeadlock = true;
  validateWorkspace(request.files, { run_file: request.entry, tla: { config_file: config } });
  return request;
}

/** A tool error or interrupted run supplies no grading evidence. */
export function assess(result, expectation) {
  validateExpectation(expectation);
  if (!result || !['complete', 'counterexample', 'error', 'incomplete'].includes(result.status)) return null;
  return assessOutcome(result, { status: expectation.status, reason: expectation.reason });
}

const violation = reason => ({ invariant: 'an invariant violation', liveness: 'a repeating behavior that violates a temporal property',
  deadlock: 'a deadlock, where no next step is enabled' }[reason] || 'a property violation');

/** Plain-text feedback for the shared test-results panel; callers escape it. */
export function feedback(result, expectation) {
  const passed = assess(result, expectation);
  const diagnostic = (result?.diagnostics || []).find(item => typeof item.message === 'string' && item.message.trim())?.message;
  if (result?.status === 'error') return 'The check could not run. ' +
    (diagnostic || 'Review the model and configuration for errors, then run Test My Work again.');
  if (result?.status === 'incomplete') {
    const message = {
      cancelled: 'The check was stopped.', stale: 'The model changed during the check.',
      'time-limit': 'The check reached the browser time limit.', 'state-limit': 'The check reached the state limit.',
      'startup-timeout': 'The browser runtime did not become ready in time.',
    }[result.reason] || diagnostic || 'The check did not finish.';
    return message + ' No pass or failure was recorded. Run Test My Work again after addressing the interruption.';
  }
  if (passed === null) return 'No usable checker result was returned. Run Test My Work again.';
  if (passed) return result.status === 'counterexample'
    ? 'The checker found ' + violation(result.reason) + ', as expected. Inspect the behavior below to explain it.'
    : expectation.invariant ? 'The instructor-defined invariant holds in every reachable state of this configured model.'
      : expectation.property ? 'The instructor-defined temporal property holds for every behavior of this configured model.'
      : 'No violation was found in this configured model.';
  if (result.status === 'complete') return 'No violation was found, but this exercise expects ' +
    violation(expectation.reason) + '. Review the model and the exercise instructions.';
  return 'The checker found ' + violation(result.reason) + ', but this check expects ' +
    (expectation.status === 'complete' ? 'no violation' : violation(expectation.reason)) +
    '. Inspect the counterexample states below and review the step that caused the mismatch.';
}
