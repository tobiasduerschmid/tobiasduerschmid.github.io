const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

function highlight(source, language = 'javascript') {
  const ruby = `
    require 'json'
    require 'liquid'
    require 'rexml/document'
    require_relative '_plugins/code_highlight'
    input = JSON.parse(STDIN.read)
    lines = Object.new.extend(CodeHighlightFilter).highlight_code_lines(input['source'], input['language'])
    puts JSON.generate(lines.map do |line|
      document = REXML::Document.new("<code>#{line}</code>")
      {
        text: REXML::XPath.match(document, '//text()').map(&:value).join,
        tokens: REXML::XPath.match(document, '//span').map { |span| [span.attributes['class'], span.text] },
        tags: REXML::XPath.match(document, '//*').map(&:name)
      }
    end)
  `;
  return JSON.parse(execFileSync('bundle', ['exec', 'ruby', '-e', ruby], {
    cwd: path.resolve(__dirname, '../..'),
    input: JSON.stringify({ source, language }),
    encoding: 'utf8',
  }));
}

test('highlighting preserves code, blank lines, and literal HTML without creating elements', () => {
  const source = 'const text = "<b>&</b>";\n\nconsole.log(text);';
  const lines = highlight(source);
  assert.equal(lines.map((line) => line.text).join('\n'), source);
  assert.ok(lines.flatMap((line) => line.tags).every((tag) => ['code', 'span'].includes(tag)));
  assert.ok(lines[0].tokens.some(([kind, text]) => kind === 'kd' && text === 'const'));
  assert.ok(lines[0].tokens.some(([kind, text]) => kind === 's2' && text === '<b>&</b>'));
});

test('multiline comments stay highlighted across line boundaries', () => {
  const lines = highlight('/* first line\nsecond line */\nconst count = 12;');
  assert.ok(lines[1].tokens.some(([kind, text]) => kind === 'cm' && text.includes('second line')));
  assert.ok(lines[2].tokens.some(([kind, text]) => kind === 'mi' && text === '12'));
});

test('terminal snippets use shell syntax and preserve their commands', () => {
  const source = 'npm install express\necho "$HOME"';
  const lines = highlight(source, 'shell');
  assert.equal(lines.map((line) => line.text).join('\n'), source);
  assert.ok(lines[1].tokens.some(([kind, text]) => kind === 'nv' && text === '$HOME'));
});

test('JSX distinguishes tags, attributes, strings and JavaScript without rendering the tags', () => {
  const source = 'const label = "Like";\nreturn <button className="like">{label}: {0}</button>;';
  const lines = highlight(source, 'jsx');
  assert.equal(lines.map((line) => line.text).join('\n'), source);
  assert.ok(lines.flatMap((line) => line.tags).every((tag) => ['code', 'span'].includes(tag)));
  for (const token of ['nt', 'na', 's', 'mi']) {
    assert.ok(lines[1].tokens.some(([kind]) => kind.startsWith(token)), `Missing JSX ${token} token`);
  }
});
