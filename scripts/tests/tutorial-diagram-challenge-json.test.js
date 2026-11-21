// A diagram challenge reaches js/tutorial-diagram-challenge.js as JSON inside
// <script type="application/json"> elements rendered by
// _includes/tutorial-diagram-challenge.html (the challenge) and
// _includes/tutorial-diagram-challenge-results-data.html (results-card rows).
// Authored text may contain markup such as `</script>` or `<!--`; it must
// arrive unchanged and must not end the script element early.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');

/** Render a Liquid template with Jekyll's include tag and filters. */
function render(template, variables) {
  return execFileSync('bundle', ['exec', 'ruby', '-e', `
    require 'jekyll'
    require 'json'
    site = Jekyll::Site.new(Jekyll.configuration('quiet' => true, 'disable_disk_cache' => true))
    input = JSON.parse(STDIN.read)
    puts Liquid::Template.parse(input['template']).render!(input['variables'], registers: { site: site })
  `], { cwd: root, input: JSON.stringify({ template, variables }), encoding: 'utf8' });
}

/** What an HTML parser puts in the script element: the text up to the first `</script`. */
function scriptText(html, attribute) {
  const match = html.match(new RegExp(`<script type="application/json" ${attribute}>([\\s\\S]*?)</script`, 'i'));
  assert.ok(match, `the page has a script element with ${attribute}`);
  return match[1];
}

const MARKUP = 'Ends with </script><b>bold</b>, opens <!-- a comment, and joins A & B';

const challenge = {
  questions: [{ id: 'which', type: 'single', question: MARKUP, options: [MARKUP, 'Plain text'], correct_index: 1 }],
  follow_up: [{ id: 'after', type: 'single', question: MARKUP, options: ['Yes', 'No'], correct_index: 0 }],
};

test('the challenge reaches the widget unchanged, whatever markup its text contains', () => {
  const html = render('{% include tutorial-diagram-challenge.html step=step index=0 %}',
    { step: { key: 'markup', diagram_challenge: challenge } });
  const text = scriptText(html, 'data-diagram-challenge-spec');

  assert.doesNotMatch(text, /[<>&]/, '<, >, and & travel escaped');
  assert.deepEqual(JSON.parse(text), challenge);
});

test('the results-card rows reach the widget unchanged, whatever markup their text contains', () => {
  const tutorial = { steps: [{ key: 'markup', title: MARKUP, diagram_challenge: challenge }] };
  const html = render('{% include tutorial-diagram-challenge-results-data.html tutorial=tutorial %}', { tutorial });
  const text = scriptText(html, 'data-diagram-challenge-results');
  const rows = JSON.parse(text).filter(Boolean);

  assert.doesNotMatch(text, /[<>&]/, '<, >, and & travel escaped');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, MARKUP);
  assert.deepEqual(rows[0].spec, challenge);
});
