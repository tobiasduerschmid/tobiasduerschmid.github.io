import { workspaceFiles, workspacePath } from './shell-pipeline-runtime.mjs';

function countRows(output) {
  if (output === '') return [];
  return output.replace(/\n$/, '').split('\n').map(line => {
    const match = /^[ \t]*(\d+)[ \t]+(\S+)[ \t]*$/.exec(line);
    if (!match || !Number.isSafeInteger(Number(match[1]))) return null;
    return { count: Number(match[1]), value: match[2] };
  });
}

/** Compare authored output contracts without prescribing a shell implementation. */
export function assessOutput(actual, expected, comparison = 'exact') {
  if (comparison === 'exact') return actual === expected;
  if (!['count-lines', 'ranked-counts'].includes(comparison)) throw new Error('Unknown shell output comparison: ' + comparison);
  const rows = countRows(actual);
  const expectedRows = countRows(expected);
  if (expectedRows.some(row => row === null)) throw new Error('Expected count output must contain one count and value per line.');
  if (rows.some(row => row === null) || rows.length !== expectedRows.length) return false;
  if (comparison === 'ranked-counts') {
    if (rows.some((row, index) => index > 0 && row.count > rows[index - 1].count)) return false;
    const byValue = (a, b) => a.value < b.value ? -1 : a.value > b.value ? 1 : a.count - b.count;
    rows.sort(byValue);
    expectedRows.sort(byValue);
  }
  return rows.every((row, index) => row.value === expectedRows[index].value && row.count === expectedRows[index].count);
}

/** One check owns one fresh filesystem, including its fixture overrides. */
export async function checkSolution({ command, files, manuals, check, createShell }) {
  if (!check || typeof check.expected_stdout !== 'string') throw new Error('A shell_pipeline check needs expected_stdout text.');
  for (const key of Object.keys(check)) {
    if (!['files', 'expected_stdout', 'comparison', 'preserve_files'].includes(key)) throw new Error('Unknown shell_pipeline expectation: ' + key);
  }
  if (check.files !== undefined && (!check.files || typeof check.files !== 'object' || Array.isArray(check.files))) {
    throw new Error('Shell fixture files must map paths to text.');
  }
  const initialFiles = { ...workspaceFiles(files), ...workspaceFiles(check.files) };
  const preserve = check.preserve_files || [];
  if (!Array.isArray(preserve)) throw new Error('preserve_files must be a list of file paths.');
  const paths = preserve.map(workspacePath);
  for (const path of paths) {
    if (!Object.hasOwn(initialFiles, path)) throw new Error('A preserved file is missing from the check: ' + path);
  }
  const shell = createShell({ files: initialFiles, manuals });
  const result = await shell.exec(command, { rawScript: true });
  let sourceUnchanged = true;
  for (const path of paths) {
    try { sourceUnchanged = sourceUnchanged && await shell.readFile(path) === initialFiles[path]; }
    catch { sourceUnchanged = false; }
  }
  const matches = assessOutput(result.stdout, check.expected_stdout, check.comparison);
  const passed = result.exitCode === 0 && result.stderr === '' && sourceUnchanged && matches;
  const diagnostic = !sourceUnchanged ? 'A required input file was changed or removed.'
    : result.exitCode !== 0 ? 'The command exited with status ' + result.exitCode + '.\n' + result.stderr
    : result.stderr ? 'The command wrote to standard error:\n' + result.stderr
    : !matches ? 'Output differs from the expected result.\nExpected:\n' + check.expected_stdout + '\nReceived:\n' + result.stdout
    : '';
  return { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode, sourceUnchanged, passed, diagnostic };
}
