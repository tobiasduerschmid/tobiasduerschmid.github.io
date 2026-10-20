'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  MAX_ACCEPTED_ORDERS, interchangeableProblems, gradeParsonsOrder,
} = require('../../js/parsons-grading.js');

// c.yml: the two struct fields are independent; the braces are not.
const RECTANGLE = {
  lines: ['typedef struct {', '    double width;', '    double height;', '} Rectangle;'],
  interchangeable: [[[1], [2]]],
};

// c.yml: open-and-check stays together; the two declarations may move.
const NUMBERED_PRINT = {
  lines: [
    'FILE *fp = fopen("input.txt", "r");',
    'if (fp == NULL) { perror("open"); return 1; }',
    'char buf[256];',
    'int n = 1;',
    'while (fgets(buf, sizeof(buf), fp) != NULL) {',
    '    printf("%d: %s", n++, buf);',
    '}',
    'fclose(fp);',
  ],
  interchangeable: [[[0, 1], [2], [3]]],
};

// java.yml shape: whole types may swap, and so may members inside each type.
const SHAPES = {
  lines: [
    'public interface Shape {',
    '    double getArea();',
    '    double getPerimeter();',
    '}',
    'public class Circle implements Shape {',
    '    private double radius;',
    '    @Override',
    '    public double getArea() { return Math.PI * radius * radius; }',
    '}',
  ],
  interchangeable: [[[0, 1, 2, 3], [4, 5, 6, 7, 8]], [[1], [2]], [[5], [6, 7]]],
};

const pick = (solution, indices) => indices.map((index) => solution.lines[index]);

test('the authored order and every swap of interchangeable lines are accepted', () => {
  assert.equal(gradeParsonsOrder(RECTANGLE, pick(RECTANGLE, [0, 1, 2, 3])).correct, true);
  assert.equal(gradeParsonsOrder(RECTANGLE, pick(RECTANGLE, [0, 2, 1, 3])).correct, true);
});

test('lines outside every group keep their authored position', () => {
  assert.equal(gradeParsonsOrder(RECTANGLE, pick(RECTANGLE, [1, 0, 2, 3])).correct, false);
  assert.equal(gradeParsonsOrder(RECTANGLE, pick(RECTANGLE, [0, 1, 3, 2])).correct, false);
});

test('without interchangeable groups only the authored order is accepted', () => {
  const fixed = { lines: RECTANGLE.lines };
  assert.equal(gradeParsonsOrder(fixed, pick(RECTANGLE, [0, 1, 2, 3])).correct, true);
  assert.equal(gradeParsonsOrder(fixed, pick(RECTANGLE, [0, 2, 1, 3])).correct, false);
});

test('a multi-line block moves as a unit and may not be split', () => {
  assert.equal(gradeParsonsOrder(NUMBERED_PRINT, pick(NUMBERED_PRINT, [3, 2, 0, 1, 4, 5, 6, 7])).correct, true);
  assert.equal(gradeParsonsOrder(NUMBERED_PRINT, pick(NUMBERED_PRINT, [2, 0, 1, 3, 4, 5, 6, 7])).correct, true);
  // The declarations may not separate fopen from its NULL check.
  assert.equal(gradeParsonsOrder(NUMBERED_PRINT, pick(NUMBERED_PRINT, [0, 2, 1, 3, 4, 5, 6, 7])).correct, false);
});

test('nested groups combine: types swap while members swap inside them', () => {
  const classFirst = pick(SHAPES, [4, 6, 7, 5, 8, 0, 2, 1, 3]);
  assert.equal(gradeParsonsOrder(SHAPES, classFirst).correct, true);
  // An annotation must stay on the method it annotates.
  const detached = pick(SHAPES, [0, 1, 2, 3, 4, 6, 5, 7, 8]);
  assert.equal(gradeParsonsOrder(SHAPES, detached).correct, false);
});

test('identical fragments are interchangeable because answers compare by text', () => {
  const pipeline = {
    lines: ["grep -v '^#' config.txt", '|', "grep -v '^$'", '|', 'sort'],
    interchangeable: [[[1, 2], [3, 4]]],
  };
  const sortFirst = ["grep -v '^#' config.txt", '|', 'sort', '|', "grep -v '^$'"];
  assert.equal(gradeParsonsOrder(pipeline, sortFirst).correct, true);
  const pipesTogether = ["grep -v '^#' config.txt", '|', '|', 'sort', "grep -v '^$'"];
  assert.equal(gradeParsonsOrder(pipeline, pipesTogether).correct, false);
});

test('a placed distractor or a missing line rejects the answer', () => {
  const withDistractor = ['class Rectangle {', '    double height;', '    double width;', '} Rectangle;'];
  assert.deepEqual(gradeParsonsOrder(RECTANGLE, withDistractor), {
    correct: false, lineCorrect: [false, true, true, true],
  });
  const extraLine = pick(RECTANGLE, [0, 1, 2, 3]).concat('class Rectangle {');
  assert.deepEqual(gradeParsonsOrder(RECTANGLE, extraLine), {
    correct: false, lineCorrect: [true, true, true, true, false],
  });
  assert.deepEqual(gradeParsonsOrder(RECTANGLE, pick(RECTANGLE, [0, 2, 1])), {
    correct: false, lineCorrect: [true, true, true],
  });
});

test('line feedback follows the closest accepted order, not only the authored one', () => {
  // Declarations moved first (allowed), but the loop body is above its header.
  const placed = pick(NUMBERED_PRINT, [2, 0, 1, 3, 5, 4, 6, 7]);
  assert.deepEqual(gradeParsonsOrder(NUMBERED_PRINT, placed), {
    correct: false, lineCorrect: [true, true, true, true, false, false, true, true],
  });
});

test('a malformed declaration is ignored, so only the authored order is accepted', (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const nonAdjacent = { lines: RECTANGLE.lines, interchangeable: [[[1], [3]]] };
  assert.equal(gradeParsonsOrder(nonAdjacent, pick(RECTANGLE, [0, 3, 2, 1])).correct, false);
  assert.equal(gradeParsonsOrder(nonAdjacent, pick(RECTANGLE, [0, 1, 2, 3])).correct, true);
  assert.equal(warn.mock.callCount(), 2);
});

test('well-formed declarations have no problems', () => {
  assert.deepEqual(interchangeableProblems(4, undefined), []);
  assert.deepEqual(interchangeableProblems(4, null), []);
  assert.deepEqual(interchangeableProblems(RECTANGLE.lines.length, RECTANGLE.interchangeable), []);
  assert.deepEqual(interchangeableProblems(SHAPES.lines.length, SHAPES.interchangeable), []);
});

for (const [name, groups, location] of [
  ['a declaration that is not a list', 'lines 1 and 2', /list of groups/],
  ['a group with one block', [[[1]]], /group 0/],
  ['a block that skips a line', [[[0], [1, 3]]], /group 0/],
  ['a block with a non-integer index', [[['1'], [2]]], /group 0/],
  ['a block past the last line', [[[4], [5, 6]]], /group 0/],
  ['blocks that are not adjacent', [[[0], [1]], [[2], [4]]], /group 1/],
  ['groups that cross each other', [[[0], [1]], [[1], [2]]], /groups 0 and 1/],
  ['the same group twice', [[[1], [2]], [[1], [2]]], /groups 0 and 1/],
]) {
  test(`${name} is reported with its location`, () => {
    assert.match(interchangeableProblems(6, groups).join('\n'), location);
  });
}

test(`declarations may allow at most ${MAX_ACCEPTED_ORDERS} orders`, () => {
  const singleLineBlocks = (count) => [Array.from({ length: count }, (_, line) => [line])];
  assert.deepEqual(interchangeableProblems(7, singleLineBlocks(7)), []);
  assert.match(interchangeableProblems(8, singleLineBlocks(8)).join('\n'), /limit/);
});
