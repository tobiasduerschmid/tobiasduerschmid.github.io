import {generationMessages,pythonFromResult} from './prompts.mjs';

// Allow helper definitions within the existing 2,048-token context.
const IMPLEMENTATION_TOKENS = 1024;
const MAX_ATTEMPTS = 2;

/** Generate a standalone candidate, retrying once for source-only problems.
 * inspect must analyze only this candidate, never execute hidden checks.
 * Behavioral correctness is checked separately after this gate succeeds.
 */
export async function generateStandalonePython({specification,contract,generate,inspect,signal,isCurrent,onPhase}) {
  const current = () => !signal.aborted && isCurrent();
  let problem;
  for (let attempt=0;attempt<MAX_ATTEMPTS;attempt++) {
    if (!current()) return null;
    onPhase(attempt ? 'repairing' : 'generating');
    const generated = await generate(generationMessages(specification,contract,problem),{signal,maxTokens:IMPLEMENTATION_TOKENS});
    if (!current()) return null;
    let source;
    try { source = pythonFromResult(generated); }
    catch { problem = {status:'generation'}; continue; }
    onPhase('validating');
    const report = await inspect(source,signal);
    if (!current() || !report) return null;
    if (report.status === 'complete') return {status:'complete',source};
    if (!['syntax','incomplete'].includes(report.status)) return {status:'unavailable'};
    problem = {...report,source};
  }
  return problem;
}

export function generationProblem(result) {
  if (result.status === 'incomplete') return 'The model still omitted definitions or depended on another file after one retry. No self-contained program was produced. Keep your specification and try again.';
  if (result.status === 'syntax') return 'The model still produced invalid Python after one retry. Keep your specification and try again.';
  if (result.status === 'generation') return 'The model did not finish a complete Python file after one retry. Keep your specification and try again.';
  return 'Python could not validate the generated file. Wait for Python to be ready, then try again.';
}

export const GENERATION_PHASES = Object.freeze({
  generating:'Generating a complete Python program locally…',
  validating:'Checking the generated file for missing definitions…',
  repairing:'The model left an incomplete file. Generating one complete replacement…'
});
