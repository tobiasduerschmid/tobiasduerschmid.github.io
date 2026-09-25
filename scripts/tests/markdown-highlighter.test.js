const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const ruby = [
  'module Jekyll; module Hooks; def self.register(*); end; end; end',
  "require File.expand_path('_plugins/markdown_highlighter.rb', Dir.pwd)",
  'print MarkdownHighlighter.process(STDIN.read)',
].join('; ');

function render(html) {
  return execFileSync('bundle', ['exec', 'ruby', '-e', ruby], {
    cwd: root,
    input: html,
    encoding: 'utf8',
  });
}

test('a lone equality operator does not highlight later HTML sections', () => {
  for (const unmatched of ['==.', '==unclosed text']) {
    for (const separator of ['\n', '']) {
      const html = `<p>Reuse the Playlist after checking ${unmatched}</p>` + separator +
        '<p>Later prose remains intact.</p>' + separator +
        '<p>==valid highlight==</p>';
      const output = render(html);

      assert.ok(output.includes(`<p>Reuse the Playlist after checking ${unmatched}</p>`));
      assert.match(output, /<p>Later prose remains intact\.<\/p>/);
      assert.match(output, /<p><mark>valid highlight<\/mark><\/p>/);
      assert.doesNotMatch(output, /<mark>.*<p>/s);
    }
  }
});

test('highlighting still supports inline emphasis', () => {
  assert.equal(
    render('<p>==this is <em>emphasized</em>==</p>'),
    '<p><mark>this is <em>emphasized</em></mark></p>',
  );
});

test('highlighting can wrap inline code without highlighting delimiters inside code', () => {
  assert.equal(
    render('<p>==Use <code>x</code> here== and <code>==literal==</code></p>'),
    '<p><mark>Use <code>x</code> here</mark> and <code>==literal==</code></p>',
  );
});
