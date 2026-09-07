const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

for (const slug of ['haskell', 'haskell-functions', 'haskell-data']) {
  test(`${slug} declares executable exercises with valid knowledge checks`, () => {
    const config = yaml.load(fs.readFileSync(path.resolve(__dirname, '../../_data/tutorials', `${slug}.yml`), 'utf8'));
    assert.equal(config.backend, 'haskell');
    assert.equal(config.require_tests, true);
    assert.ok(config.learning_objectives.length >= 4 && config.learning_objectives.length <= 8);
    for (const [index, step] of config.steps.entries()) {
      const label = `${slug} step ${index + 1}: ${step.title}`;
      assert.match(step.instructions, /^### Why this matters\n/, label);
      assert.ok(step.instructions.includes('### 🎯 You will learn to'), label);
      assert.ok(step.files.some((file) => file.path === step.run_file), label);
      assert.ok(step.solution.files.some((file) => file.path === step.run_file), label);
      for (const file of [...step.files, ...step.solution.files]) {
        assert.doesNotMatch(file.path, /^(?:\/|\.\/)|(?:^|\/)\.\.(?:\/|$)/,
          `${label}: Haskell editor paths are relative to the tutorial workspace`);
      }
      assert.ok(step.tests.length > 0, label);
      for (const gate of step.tests) {
        assert.ok(gate.command.trim().length > 0, label);
        assert.doesNotMatch(gate.command.trim(), /[\r\n]/, `${label}: Boolean gates must fit on one line`);
        assert.ok(gate.hints.length >= 3, label);
      }
      assert.equal(step.quiz.title, `Step ${index + 1} — Knowledge Check`, label);
      assert.equal(step.quiz.min_score, 0.8, label);
      assert.ok(step.quiz.questions.length > 0, label);
      for (const question of step.quiz.questions) {
        assert.ok(['basic', 'intermediate', 'advanced', 'expert'].includes(question.difficulty), label);
        assert.ok(question.explanation, label);
        if (question.type === 'parsons') {
          assert.ok(question.lines.length >= 4 && question.lines.length <= 14, label);
          continue;
        }
        assert.ok(question.options.length >= 2, label);
        const required = question.type === 'multiple' ? question.correct_indices : [question.correct_index];
        for (const answer of required) {
          assert.ok(Number.isInteger(answer) && answer >= 0 && answer < question.options.length, label);
        }
        assert.ok(!Array.isArray(question.option_feedback), label);
        for (const [answer, feedback] of Object.entries(question.option_feedback || {})) {
          assert.ok(/^\d+$/.test(answer) && Number(answer) < question.options.length, label);
          assert.ok(!(question.optional_indices || []).includes(Number(answer)), label);
          assert.doesNotMatch(feedback, /misconception/i, label);
        }
        assert.doesNotMatch(question.explanation, /\b(?:option|choice|answer) [A-D]\b|the (?:first|second|third|last) (?:option|choice|answer)/i, label);
      }
    }
  });
}
