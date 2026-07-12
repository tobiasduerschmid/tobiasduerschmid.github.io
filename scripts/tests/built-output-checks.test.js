const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '../..');

const CHECKS = [
  {
    script: 'scripts/check_references.sh',
    marker: '(missing reference)',
    failureText: 'Found missing references',
  },
  {
    script: 'scripts/check_quizzes.sh',
    marker: 'data not found for ID',
    failureText: 'Found missing quiz & flashcard data',
  },
];

function makeBuiltSite() {
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'sebook-built-output-'));
  fs.mkdirSync(path.join(workdir, '_site/blog'), { recursive: true });
  fs.mkdirSync(path.join(workdir, '_site/SEBook'), { recursive: true });
  fs.writeFileSync(path.join(workdir, '_site/blog/index.html'), '<p>Built page</p>');
  fs.writeFileSync(path.join(workdir, '_site/SEBook/index.html'), '<p>Built page</p>');
  return workdir;
}

function runCheck(relativeScript, workdir, env = process.env) {
  return spawnSync('bash', [path.join(repositoryRoot, relativeScript)], {
    cwd: workdir,
    env,
    encoding: 'utf8',
  });
}

for (const check of CHECKS) {
  test(`${check.script} distinguishes clean, invalid, incomplete, and unreadable builds`, t => {
    const workdir = makeBuiltSite();
    t.after(() => fs.rmSync(workdir, { recursive: true, force: true }));

    const clean = runCheck(check.script, workdir);
    assert.equal(clean.status, 0, clean.stderr || clean.stdout);

    fs.writeFileSync(path.join(workdir, '_site/blog/broken.html'), check.marker);
    const invalid = runCheck(check.script, workdir);
    assert.equal(invalid.status, 1);
    assert.match(invalid.stdout, new RegExp(check.failureText));
    fs.rmSync(path.join(workdir, '_site/blog/broken.html'));

    fs.rmSync(path.join(workdir, '_site/SEBook'), { recursive: true });
    const incomplete = runCheck(check.script, workdir);
    assert.equal(incomplete.status, 1);
    assert.match(incomplete.stderr, /expected built output directory/);
    fs.mkdirSync(path.join(workdir, '_site/SEBook'), { recursive: true });

    const binDir = path.join(workdir, 'bin');
    fs.mkdirSync(binDir);
    const failingGrep = path.join(binDir, 'grep');
    fs.writeFileSync(failingGrep, '#!/bin/sh\nexit 2\n', { mode: 0o755 });
    const unreadable = runCheck(check.script, workdir, {
      ...process.env,
      PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}`,
    });
    assert.equal(unreadable.status, 2);
    assert.match(unreadable.stderr, /could not scan/);
  });
}
