'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../..');
const QUIZ_ENGINE = /<script[^>]*\/js\/tutorial-quiz\.js/;
const GRADER = /<script[^>]*\/js\/parsons-grading\.js/;

// tutorial-quiz.js grades Parsons answers through window.ParsonsGrading, so a
// page that loads the engine without the grader cannot check those answers.
test('every page that loads the tutorial quiz engine loads the Parsons grader before it', () => {
  const sources = execFileSync('git', ['ls-files', '*.html', '*.md'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(Boolean);
  const hosts = sources.filter((file) => QUIZ_ENGINE.test(fs.readFileSync(path.join(ROOT, file), 'utf8')));
  assert.ok(hosts.length > 0);
  const missing = hosts.filter((file) => {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const grader = source.search(GRADER);
    return grader < 0 || grader > source.search(QUIZ_ENGINE);
  });
  assert.deepEqual(missing, []);
});
