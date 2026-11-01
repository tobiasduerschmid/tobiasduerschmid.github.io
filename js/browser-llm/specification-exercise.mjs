import {generateStandalonePython,generationProblem} from './program-generation.mjs';

const REVIEW_QUESTIONS = Object.freeze({
  'input-contract':'Which inputs are accepted or ignored, and how are they normalized?',
  duplicates:'What happens when several records refer to the same item or person?',
  ordering:'How does processing order affect the result or state, and how are competing choices resolved?',
  boundaries:'What happens at the limits and when there is nothing to return?',
  'output-contract':'What exactly is returned, and should the function print anything?',
  mutation:'Must the input stay unchanged, and must separate calls remain independent?'
});

/** Generate and check a private candidate without changing the learner's files.
 * Only the public interface and student prose reach the model. Stale or
 * cancelled work returns null. Completed source is available for optional
 * inspection; check results contain only status and conceptual categories.
 */
export async function checkSpecification({specification,exercise,snapshot,signal,isCurrent,generate,inspect,runChecks,onPhase,onGenerated=()=>{}}) {
  const current = () => !signal.aborted && isCurrent(snapshot);
  const generated = await generateStandalonePython({specification,contract:exercise.interface,
    signal,isCurrent:current,generate,inspect,onPhase});
  if (!current() || !generated) return null;
  if (generated.source) onGenerated(generated.source);
  if (generated.status !== 'complete') return {status:generated.status,failed:[]};
  onPhase('checking');
  const result = await runChecks({...snapshot,source:generated.source},exercise,signal);
  return current() ? result : null;
}

export function specificationFeedback(result) {
  if (result.status === 'incomplete') return generationProblem(result)+' Your specification has not been assessed.';
  if (result.status === 'generation') return 'The model did not finish a usable implementation. Your specification has not been assessed. Keep your draft and use source evidence or instructor review to continue.';
  if (result.status === 'syntax' || result.status === 'runtime') return 'The generated program did not pass: it could not run successfully. This does not establish a problem with your specification. Keep your draft and use source evidence or instructor review; no Python repair is required. Continuing the tutorial does not count as passing this check.';
  if (result.status !== 'checked') return 'The checks could not finish. Your specification has not been assessed. Keep your draft and try again when Python is ready.';
  if (!result.failed.length) return 'The generated implementation passed the same checks as the original. This supports your specification, but does not prove it complete or unambiguous. Explain one rule using evidence from the original, then invent a case that could distinguish two interpretations.';
  const questions = [...new Set(result.failed)].filter(key=>Object.hasOwn(REVIEW_QUESTIONS,key)).map(key=>REVIEW_QUESTIONS[key]);
  return 'The generated implementation did not match every checked behavior. Use these questions to review your prose against the original:\n\n'+questions.join('\n\n')+'\n\nIf those rules are already explicit, keep them: the model may have made a mistake. You can continue the lesson without changing Python or getting a passing model result.';
}

export function specificationStatus(result) {
  if (result.status === 'checked') return result.failed.length
    ? 'Did not pass: the generated Python did not match every checked behavior.'
    : 'Checks passed. Read the reflection prompt below.';
  const messages = {
    syntax:'Did not pass: the generated Python has a syntax error.',
    runtime:'Did not pass: the generated Python could not run.',
    incomplete:'Did not pass: the generated Python is not self-contained.',
    generation:'Not checked: the model did not finish a usable implementation.'
  };
  return messages[result.status] ?? 'Not checked: Python could not finish the checks.';
}
