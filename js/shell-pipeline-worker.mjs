import { createShell } from './shell-pipeline-runtime.mjs';
import { checkSolution } from './shell-pipeline-grading.mjs';

self.onmessage = async ({ data }) => {
  try {
    let result;
    if (data.action === 'initialize') result = null;
    else if (data.action === 'run') {
      const shell = createShell({ files: data.files, manuals: data.manuals });
      const output = await shell.exec(data.command, { rawScript: true });
      result = { stdout: output.stdout, stderr: output.stderr, exitCode: output.exitCode };
    } else if (data.action === 'check') result = await checkSolution({ ...data, createShell });
    else throw new Error('Unknown shell request: ' + data.action);
    self.postMessage({ id: data.id, result });
  } catch (error) {
    self.postMessage({ id: data.id, error: error.message });
  }
};
