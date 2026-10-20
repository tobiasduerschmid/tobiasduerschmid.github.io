'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');
const { interchangeableProblems } = require('../../js/parsons-grading.js');

const DATA_DIR = path.resolve(__dirname, '../../_data');

function yamlFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return yamlFiles(full);
    return /\.ya?ml$/.test(entry.name) ? [full] : [];
  });
}

// Quizzes, tutorial steps and narrated explainers nest questions differently,
// so find every object that declares Parsons fields wherever it lives.
function questionsWithParsonsFields(node, found = []) {
  if (Array.isArray(node)) node.forEach((child) => questionsWithParsonsFields(child, found));
  else if (node && typeof node === 'object') {
    if (node.type === 'parsons' || 'interchangeable' in node) found.push(node);
    Object.values(node).forEach((child) => questionsWithParsonsFields(child, found));
  }
  return found;
}

const questions = yamlFiles(DATA_DIR).flatMap((file) =>
  questionsWithParsonsFields(yaml.load(fs.readFileSync(file, 'utf8')))
    .map((question) => ({ file: path.relative(DATA_DIR, file), question })));

test('the data walk reaches the interchangeable declarations it validates', () => {
  assert.ok(questions.some(({ question }) => question.interchangeable));
});

test('every interchangeable declaration belongs to a Parsons question and is well formed', () => {
  const problems = questions.flatMap(({ file, question }) => {
    const label = `${file} (${question.id ?? question.question.slice(0, 60)})`;
    if (question.type !== 'parsons') return [`${label}: interchangeable is only read on Parsons questions`];
    return interchangeableProblems(question.lines.length, question.interchangeable)
      .map((problem) => `${label}: ${problem}`);
  });
  assert.deepEqual(problems, []);
});
