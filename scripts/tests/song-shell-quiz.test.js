const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const yaml = require('js-yaml');

const song = yaml.load(fs.readFileSync(path.resolve(__dirname, '../../_data/songs/small_tools_one_job_each.yml'), 'utf8'));
const questions = song.sections.find((section) => section.id === 'quiz').lines;

test('the displayed shell answers execute the operations asked about', async (t) => {
  const examples = [
    [2, {}, (cwd, output) => assert.equal(fs.realpathSync(output.trim()), fs.realpathSync(cwd))],
    [3, { 'old.txt': 'keep me' }, (cwd) => {
      assert.equal(fs.readFileSync(path.join(cwd, 'new.txt'), 'utf8'), 'keep me');
      assert.equal(fs.existsSync(path.join(cwd, 'old.txt')), false);
    }],
    [4, { 'notes.txt': 'old old\nunchanged\n' }, (cwd, output) => {
      assert.equal(output, 'new new\nunchanged\n');
      assert.equal(fs.readFileSync(path.join(cwd, 'notes.txt'), 'utf8'), 'old old\nunchanged\n');
    }],
    [5, { 'photos/nested/a.jpg': 'photo' }, (cwd) => assert.equal(fs.readFileSync(path.join(cwd, 'backup/nested/a.jpg'), 'utf8'), 'photo')],
    [6, { 'app.log': 'OK\nERROR one\nINFO two\nERROR three\n' }, (_cwd, output) => assert.equal(output, 'ERROR one\nERROR three\n')],
    [7, { 'names.txt': 'B\nA\nB\nC\nA\n' }, (_cwd, output) => assert.equal(output, 'A\nB\nC\n')],
    [8, { 'file.txt': 'one two\nthree\nfour five\n' }, (_cwd, output) => assert.match(output, /^\s*3\s+file\.txt\s*$/)],
    [9, { 'hello.sh': '#!/bin/sh\nprintf hello' }, (cwd) => assert.equal(execFileSync('./hello.sh', { cwd, encoding: 'utf8' }), 'hello')],
    [10, { 'hello.sh': '#!/bin/sh\nprintf hello' }, (_cwd, output) => assert.equal(output, 'hello')],
  ];
  for (const [number, files, verify] of examples) {
    const question = questions.find((entry) => entry.id === `quiz-${number}`);
    await t.test(question.text, () => {
      const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'shell-quiz-'));
      try {
        for (const [name, contents] of Object.entries(files)) {
          const target = path.join(cwd, name);
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.writeFileSync(target, contents, { mode: number === 10 ? 0o700 : 0o600 });
        }
        assert.equal(typeof question.answer_code, 'string');
        verify(cwd, execFileSync('/bin/bash', ['--noprofile', '--norc', '-c', question.answer_code], { cwd, encoding: 'utf8' }));
      } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
    });
  }
});
