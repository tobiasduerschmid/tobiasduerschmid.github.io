const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');

function render(tutorial) {
  return JSON.parse(execFileSync('bundle', ['exec', 'ruby', '-e', `
    require 'jekyll'
    require 'json'
    require_relative '_plugins/tutorial_quiz_markdown'
    site = Jekyll::Site.new(Jekyll.configuration('quiet' => true))
    template = Liquid::Template.parse('{{ tutorial | with_quiz_markdown | jsonify }}')
    puts template.render!({ 'tutorial' => JSON.parse(STDIN.read) }, registers: { site: site })
  `], { cwd: root, input: JSON.stringify(tutorial), encoding: 'utf8' }));
}

const examples = [
  ['python', 'def greet():\n    return "hello"', /class="k">def</],
  ['javascript', 'const text = "hello";', /class="kd">const</],
  ['java', 'public class Timer {}', /class="kd">public</],
  ['cpp', '#include <vector>\nint count = 1;', /class="cp">#include/],
];

test('quiz code fences use their declared language, including options, explanations, and feedback', () => {
  const snippets = examples.map(([language, source]) => '```' + language + '\n' + source + '\n```');
  const question = { question: snippets[0], options: [snippets[1]], explanation: snippets[2], option_feedback: { 0: snippets[3] } };
  const source = { title: 'Quiz', steps: [{ quiz: { questions: [question] } }, { title: 'No quiz' }] };
  const rendered = render(source);
  assert.deepEqual(rendered.steps[0].quiz.questions, [question], 'authoring and grading data stays unchanged');
  assert.deepEqual(rendered.steps[1], source.steps[1]);
  for (let index = 0; index < snippets.length; index++) {
    assert.match(rendered.steps[0].quiz.renderedMarkdown[snippets[index]], examples[index][2]);
  }
});

test('unlabeled code remains plain and source HTML remains escaped', () => {
  const plain = '```\nplain <tag>\n```';
  const python = '```python\ntext = "<script>alert(1)</script>"\n```';
  const quiz = render({ steps: [{ quiz: { questions: [{ question: plain, explanation: python }] } }] }).steps[0].quiz;
  assert.match(quiz.renderedMarkdown[plain], /plain &lt;tag&gt;/);
  assert.doesNotMatch(quiz.renderedMarkdown[plain], /<span/);
  assert.doesNotMatch(quiz.renderedMarkdown[python], /<script>/);
  assert.match(quiz.renderedMarkdown[python], /&lt;script&gt;/);
});

test('shared quiz rendering preserves highlighted content through shuffling and retains its Markdown fallback', () => {
  const sandbox = { window: {}, navigator: { platform: 'Linux' } };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/tutorial-quiz.js'), 'utf8'), sandbox);
  const texts = ['Question', 'Option', 'Explanation', 'Feedback'];
  const renderedMarkdown = Object.fromEntries(texts.map(text => [text, '<code><span>' + text + '</span></code>']));
  const html = sandbox.window.SebookQuiz.buildHTML({ stepIndex: 0,
    quiz: { renderedMarkdown, questions: [{ question: texts[0], options: [texts[1], 'Fallback'], correct_index: 0,
      explanation: texts[2], option_feedback: { 0: texts[3] } }] },
    renderMarkdown: text => '<em>' + text + '</em>',
  });
  for (const text of texts) assert.ok(html.includes(renderedMarkdown[text]), text);
  assert.ok(html.includes('<em>Fallback</em>'));
});
