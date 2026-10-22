/** Analyze syntax without executing student commands or expanding their words. */
export function analyzePipeline(command, createShell) {
  if (command.length > 16384) return { state: 'unsupported' };
  let ast;
  try { ast = createShell({ files: {} }).transform(command).ast; }
  catch { return { state: 'syntax-error' }; }
  if (!ast.statements.length) return { state: 'empty' };
  // A script, function, or nested expression needs data-flow analysis before
  // we can safely describe its stages. Fall back to ordinary task feedback.
  if (ast.statements.length !== 1) return { state: 'unsupported' };
  const statement = ast.statements[0];
  if (statement.deferredError) return { state: 'syntax-error' };
  if (statement.background || statement.pipelines.length !== 1) return { state: 'unsupported' };
  const pipeline = statement.pipelines[0];
  if (pipeline.negated || pipeline.pipeStderr?.some(Boolean)) return { state: 'unsupported' };
  const names = [];
  for (const stage of pipeline.commands) {
    if (stage.type === 'SimpleCommand' && !stage.name && !stage.assignments.length && !stage.redirections.length) return { state: 'syntax-error' };
    if (stage.type !== 'SimpleCommand' || !stage.name) return { state: 'unsupported' };
    const name = literalWord(stage.name.parts);
    if (name === null || !/^[a-zA-Z0-9_./-]+$/.test(name)) return { state: 'unsupported' };
    names.push(name.split('/').pop());
  }
  return { state: 'pipeline', commands: names.join(' | ') };
}

function literalWord(parts) {
  let text = '';
  for (const part of parts) {
    const value = part.type === 'DoubleQuoted' ? literalWord(part.parts)
      : ['Literal', 'SingleQuoted', 'Escaped'].includes(part.type) ? part.value : null;
    if (value === null) return null;
    text += value;
  }
  return text;
}

/** Conditions select advice only; they never participate in grading. */
export function matchesPipelineHint(condition, analysis) {
  if (!analysis) return false;
  const state = /^pipeline_state:\s*(\S+)$/.exec(condition);
  if (state) return analysis.state === state[1];
  const pattern = /^pipeline_matches:\s*(.+)$/.exec(condition);
  if (!pattern || analysis.state !== 'pipeline') return false;
  try { return new RegExp(pattern[1]).test(analysis.commands); }
  catch { return false; }
}
