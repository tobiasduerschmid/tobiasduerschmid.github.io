'use strict';

// `layout wrap <width>` in a sequence diagram breaks lifeline names and message labels between words, so that a
// diagram with sentence-long names stays narrow enough to print its text at 9 pt (REFERENCE.md "Wrapped Names and
// Labels"). C4 dynamic views are drawn this way (routing redesign §9.3 "Print"): the chapter's enroll view must fit
// the Letter landscape column at its own size, because its smallest text (the fragment's 12-unit guards) is 9 pt
// only at a scale of 1.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { before, after, test } = require('node:test');
const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('../chromium-launch-options');
const { openC4Page } = require('./c4-route-views.js');

const ROOT = path.join(__dirname, '../..');
// The printed column of US Letter in landscape: 279.4 mm less the c4-landscape page's 7.5 mm margins, at 96 px/in,
// less the figure's frame, which leaves a drawing 959 of those 999 px (measured by the print gate in
// tests/c4-display.spec.js, which checks the built page).
const FIGURE_FRAME = 40;
const LETTER_LANDSCAPE_DRAWING = Math.floor((279.4 - 2 * 7.5) * 96 / 25.4) - FIGURE_FRAME;
const NINE_POINT_PX = 12;
// Text widths are measured in the page; a line may exceed the wrap width by rounding only.
const TOLERANCE = 0.5;

const LONG_NAMES = [
  'participant coordinator: Registration Coordinator',
  'participant billing: Billing Gateway of the University',
  'coordinator -> billing: asks for the tuition charges of every completed enrollment from',
  'billing --> coordinator: confirms that the charges were recorded',
];

let browser;
let page;
before(async () => {
  browser = await chromium.launch(chromiumLaunchOptions());
  page = await openC4Page(browser);
});
after(async () => { if (browser) await browser.close(); });

/**
 * Draws a sequence diagram and returns its width, its heads (`{ lines, box }`), and its message labels
 * (`{ lines, box, arrowY }`), each line as `{ text, width }`.
 */
function drawSequence(spec) {
  return page.evaluate((text) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    window.UMLSequenceDiagram.render(container, text);
    const svg = container.querySelector('svg');
    const linesOf = (element) => {
      const spans = [...element.querySelectorAll('tspan')];
      return (spans.length ? spans : [element]).map((line) => ({ text: line.textContent, width: line.getComputedTextLength() }));
    };
    const boxOf = (element) => {
      const box = element.getBBox();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    };
    const heads = [...svg.querySelectorAll('text[font-weight="bold"][text-anchor="middle"]')]
      .filter((text) => !text.closest('.uml-sequence-box'))
      .map((text) => {
        const rect = [...svg.querySelectorAll('rect[filter]')].find((candidate) => {
          const x = Number(candidate.getAttribute('x'));
          return Number(text.getAttribute('x')) > x && Number(text.getAttribute('x')) < x + Number(candidate.getAttribute('width'));
        });
        return { lines: linesOf(text), box: boxOf(text), rect: rect && boxOf(rect) };
      });
    const labels = [...svg.querySelectorAll('text[data-layout-route-id]')].map((text) => {
      const arrow = svg.querySelector(`line[data-layout-route-id="${text.getAttribute('data-layout-route-id')}"]`);
      return { lines: linesOf(text), box: boxOf(text), arrowY: arrow ? Number(arrow.getAttribute('y1')) : null };
    });
    const width = Number(svg.getAttribute('viewBox').split(/\s+/)[2]);
    container.remove();
    return { width, heads, labels };
  }, spec);
}

const joined = (lines) => lines.map((line) => line.text).join(' ');

test('without the directive, every lifeline name and message label is one line', async () => {
  const drawn = await drawSequence(['@startuml', ...LONG_NAMES, '@enduml'].join('\n'));
  assert.deepEqual(drawn.heads.map((head) => head.lines.length), [1, 1]);
  assert.deepEqual(drawn.labels.map((label) => label.lines.length), [1, 1]);
});

test('with layout wrap, names and labels break between words into lines no wider than the wrap width', async () => {
  const plain = await drawSequence(['@startuml', ...LONG_NAMES, '@enduml'].join('\n'));
  const wrapped = await drawSequence(['@startuml', 'layout wrap 120', ...LONG_NAMES, '@enduml'].join('\n'));
  assert.deepEqual(wrapped.heads.map((head) => joined(head.lines)), plain.heads.map((head) => joined(head.lines)), 'every word of every name is kept, in order');
  assert.deepEqual(wrapped.labels.map((label) => joined(label.lines)), plain.labels.map((label) => joined(label.lines)), 'every word of every label is kept, in order');
  for (const { lines } of wrapped.heads.concat(wrapped.labels)) {
    assert.ok(lines.length > 1, `"${joined(lines)}" is wrapped`);
    for (const line of lines) assert.ok(line.width <= 120 + TOLERANCE, `"${line.text}" is ${line.width} wide`);
  }
  assert.ok(wrapped.width < plain.width, `the wrapped drawing (${wrapped.width}) is narrower than the plain one (${plain.width})`);
});

test('a wrapped name stays inside its head, and a wrapped label stays above its arrow', async () => {
  const drawn = await drawSequence(['@startuml', 'layout wrap 120', ...LONG_NAMES, '@enduml'].join('\n'));
  for (const { lines, box, rect } of drawn.heads) {
    assert.ok(rect, `"${joined(lines)}" has a head`);
    assert.ok(box.x >= rect.x && box.x + box.width <= rect.x + rect.width, `"${joined(lines)}" fits the head's width`);
    assert.ok(box.y >= rect.y && box.y + box.height <= rect.y + rect.height, `"${joined(lines)}" fits the head's height`);
  }
  for (const { lines, box, arrowY } of drawn.labels) {
    assert.ok(box.y + box.height <= arrowY, `"${joined(lines)}" ends above its arrow at ${arrowY}`);
  }
  const [first, second] = drawn.labels;
  assert.ok(first.box.y + first.box.height <= second.box.y, 'the second label starts below the first arrow');
});

test('a word wider than the wrap width keeps a line of its own', async () => {
  const drawn = await drawSequence(['@startuml', 'layout wrap 40', 'participant a: Registration', 'participant b', 'a -> b: enrolls', '@enduml'].join('\n'));
  assert.deepEqual(drawn.heads[0].lines.map((line) => line.text), ['a:', 'Registration']);
});

test("the chapter's enroll dynamic view fits the Letter landscape column, so its text prints at 9 pt", async () => {
  const model = fs.readFileSync(path.join(ROOT, '_includes/c4-models/course-registration.yml'), 'utf8');
  const printed = await page.evaluate(({ embed, column }) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    window.ArchUMLC4Render.render(container, embed);
    const svg = container.querySelector('svg');
    const width = Number(svg.getAttribute('viewBox').split(/\s+/)[2]);
    const smallest = Math.min(...[...svg.querySelectorAll('text')].filter((text) => text.textContent.trim())
      .map((text) => parseFloat(text.closest('[font-size]').getAttribute('font-size'))));
    container.remove();
    return { width, smallest, scale: Math.min(1, column / width) };
  }, { embed: `view: dynamic enroll\n${model}`, column: LETTER_LANDSCAPE_DRAWING });
  assert.ok(printed.smallest * printed.scale >= NINE_POINT_PX,
    `the ${printed.width}-unit drawing prints its ${printed.smallest}-unit text at ${printed.smallest * printed.scale} px`);
});
