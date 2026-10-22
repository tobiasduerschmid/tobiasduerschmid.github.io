import { Bash, defineCommand, getCommandNames } from './vendor/just-bash/3.6.0/browser.mjs';

const unavailableCommands = new Set(['gzip', 'gunzip', 'zcat', 'tar', 'zstd', 'unzstd', 'zstdcat', 'xz', 'unxz', 'xzcat', 'bzip2', 'bunzip2', 'bzcat']);
const commands = getCommandNames().filter(name => !unavailableCommands.has(name));

/** Tutorial file names are relative to the student's virtual home. */
export function workspacePath(path) {
  if (typeof path !== 'string' || !path || path.includes('\0')) throw new Error('Shell file paths must be nonempty strings.');
  const parts = (path.startsWith('/') ? path : '/home/student/' + path).split('/');
  const normalized = [];
  for (const part of parts) {
    if (part === '..') normalized.pop();
    else if (part && part !== '.') normalized.push(part);
  }
  return '/' + normalized.join('/');
}

export function workspaceFiles(files = {}) {
  return Object.fromEntries(Object.entries(files).map(([path, content]) => {
    if (typeof content !== 'string') throw new Error('Shell files must contain text: ' + path);
    return [workspacePath(path), content];
  }));
}

/** A fresh shell with an in-memory filesystem. No network or host filesystem. */
export function createShell({ files, manuals = {} }) {
  const man = defineCommand('man', async (args, context) => {
    const name = args[0];
    if (args.length !== 1) return { stdout: '', stderr: 'Usage: man COMMAND\nTry man sed or man awk.\n', exitCode: 2 };
    if (Object.hasOwn(manuals, name)) return { stdout: manuals[name], stderr: '', exitCode: 0 };
    if (commands.includes(name)) return context.exec(`${name} --help`);
    return { stdout: '', stderr: `man: no lab manual for ${name}. Use the chapter reference for shell builtins.\n`, exitCode: 1 };
  });
  return new Bash({
    files: workspaceFiles(files),
    cwd: '/home/student',
    env: { HOME: '/home/student', LC_ALL: 'C' },
    commands,
    customCommands: [man],
    executionLimitProfile: 'hardened',
    executionLimits: {
      maxExecutionTimeMs: 2000,
      maxCommandCount: 1000,
      maxLoopIterations: 10000,
      maxSourceBytes: 16384,
      maxOutputSize: 32768,
      maxFileSystemBytes: 1048576,
      maxInputBytes: 1048576,
      maxStringLength: 1048576,
    },
  });
}
