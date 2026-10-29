/** The tutorial owns files; the engine owns TLA+ semantics. This module owns their wire contract. */
export const LIMITS = Object.freeze({ fileBytes: 1024 * 1024, fileCount: 64, maxStates: 100000, maxTimeMs: 30000 });

export function snapshot(files, step, defaults = {}) {
  const settings = { ...defaults, ...step.tla };
  const entry = step.run_file || 'Model.tla';
  const config = settings.config_file || entry.replace(/\.tla$/, '.cfg');
  const copy = Object.create(null);
  let size = 0;
  for (const [name, content] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
    if (!/^[A-Za-z_][A-Za-z_0-9.-]*\.(tla|cfg)$/.test(name) || name.includes('..')) {
      throw new Error('TLA+ workspaces accept named .tla modules and .cfg configurations in one folder: ' + name);
    }
    if (typeof content !== 'string') throw new Error('File content must be text: ' + name);
    size += new TextEncoder().encode(content).length;
    copy[name] = content;
  }
  if (Object.keys(copy).length > LIMITS.fileCount || size > LIMITS.fileBytes) {
    throw new Error('This browser workspace is limited to 64 files and 1 MiB of source. Reduce the model files.');
  }
  if (!Object.hasOwn(copy, entry)) throw new Error('The entry module is missing: ' + entry);
  if (!Object.hasOwn(copy, config)) throw new Error('The model configuration is missing: ' + config);
  if (!entry.endsWith('.tla') || !config.endsWith('.cfg')) throw new Error('Choose a .tla entry and a .cfg configuration.');
  return {
    files: copy, entry, config,
    translatePlusCal: Object.entries(copy).some(([name, text]) => name.endsWith('.tla') && /--(?:fair\s+)?algorithm\b/.test(text)),
    checkDeadlock: settings.check_deadlock !== false,
    maxStates: LIMITS.maxStates,
    maxTimeMs: LIMITS.maxTimeMs,
  };
}

export function sameSnapshot(left, right) { return JSON.stringify(left) === JSON.stringify(right); }

export function validateResult(value) {
  if (!value || value.version !== 1 || !['complete', 'counterexample', 'incomplete', 'error'].includes(value.status)) {
    throw new Error('The TLA+ engine returned an unsupported result. Reload the tutorial to use matching runtime files.');
  }
  return value;
}

export function displayState(state, previous) {
  const before = new Map((previous?.values || []).map(value => [value.name, value.type + ':' + value.text]));
  return {
    action: state.action || 'Initial state', location: state.location,
    variables: (state.values || []).map(value => ({
      name: value.name, value: value.text, type: value.type,
      changed: !!previous && before.get(value.name) !== value.type + ':' + value.text,
    })),
  };
}

export function displayResult(result, request) {
  const states = result.trace?.states || [];
  return {
    status: result.reason === 'parsed' && result.status === 'complete' ? 'parsed' : result.status,
    violation: result.status === 'counterexample' ? result.reason : undefined,
    stats: result.stats,
    scope: `${request.entry} with ${request.config}. Limits: ${request.maxStates.toLocaleString()} states and ${request.maxTimeMs / 1000} seconds. Results apply to the constants, constraints, and properties in this configuration.`,
    diagnostics: (result.diagnostics || []).map(diagnostic => ({
      message: diagnostic.message,
      location: diagnostic.location || (diagnostic.file ? diagnostic : undefined),
    })),
    trace: states.map((state, index) => displayState(state, states[index - 1])),
    loopTo: result.trace?.loopIndex,
    traceTruncated: result.trace?.truncated === true,
    outputTruncated: result.outputTruncated === true,
    generatedSource: Object.values(result.generatedFiles || {}).join('\n\n'),
    output: result.output,
  };
}

/** An interrupted run can never satisfy an authored expectation. */
export function assess(result, expectation) {
  if (!expectation || !['complete', 'counterexample'].includes(expectation.status) ||
      Object.keys(expectation).some(key => !['status', 'reason'].includes(key)) ||
      (expectation.reason !== undefined && typeof expectation.reason !== 'string')) {
    throw new Error('A tla test needs status: complete or counterexample, with an optional reason.');
  }
  if (['error', 'incomplete'].includes(result.status)) return null;
  return result.status === expectation.status && (!expectation.reason || result.reason === expectation.reason);
}
