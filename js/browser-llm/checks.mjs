import {CATEGORIES} from './prompts.mjs';

// Only this Python runner receives hidden commands. Its returned JSON contains
// allowlisted categories; exceptions, assertion text, and printed values stay private.
export function checkProgram(source,exercise) {
  if (!exercise.checks?.length || exercise.checks.length > 20 || exercise.checks.some(check=>
    !Object.hasOwn(CATEGORIES,check.category) || typeof check.command !== 'string')) {
    throw new Error('This exercise has an invalid check configuration.');
  }
  const payload = JSON.stringify(JSON.stringify({source,checks:exercise.checks}));
  return `import json as _llm_json, contextlib as _llm_contextlib

def _llm_check():
    data = _llm_json.loads(${payload})
    failed = []
    class Quiet:
        def write(self, text): return len(text)
        def flush(self): pass
    with _llm_contextlib.redirect_stdout(Quiet()), _llm_contextlib.redirect_stderr(Quiet()):
        try:
            compiled = compile(data['source'], '<student-program>', 'exec')
        except SyntaxError:
            return {'status': 'syntax', 'failed': []}
        for check in data['checks']:
            try:
                subject = {'__name__': '__llm_student__'}
                exec(compiled, subject)
                exec(check['command'], {'subject': subject})
            except AssertionError as error:
                trace = error.__traceback__
                while trace:
                    if trace.tb_frame.f_code.co_filename == '<student-program>':
                        return {'status': 'runtime', 'failed': []}
                    trace = trace.tb_next
                if check['category'] not in failed: failed.append(check['category'])
            except BaseException:
                return {'status': 'runtime', 'failed': []}
    return {'status': 'checked', 'failed': failed}
print(_llm_json.dumps(_llm_check()))
`;
}
