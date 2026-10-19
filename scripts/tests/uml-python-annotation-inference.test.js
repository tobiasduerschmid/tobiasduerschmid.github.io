'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
require('../../js/uml-analyzer-python.js');

function inferField(annotation) {
  const result = global.analyzePythonSources({
    'model.py': `class Item:\n    pass\n\nclass Box:\n    value: ${annotation}\n`,
  });
  assert.deepEqual(result.errors, []);
  return result.classDiagram;
}

for (const annotation of [
  'Optional[Item]', 'Item | None', 'None | Item', 'Union[Item, None]',
  'typing.Optional[Item]', 'typing.Union[None, Item]', '"Item | None"', 'Union["Item", "None"]',
  'Item | list[str]', 'Union[Item, list[str]]', 'Union[Optional[Item], int]',
]) {
  test(`${annotation} describes an optional Item reference`, () => {
    assert.match(inferField(annotation), /^Box --> "0\.\.1" Item$/m);
  });
}

for (const annotation of [
  'list[Item]', 'typing.List[Item]', 'collections.abc.Sequence[Item]',
  'Optional[list[Item]]', 'list[Item] | None', 'typing.Optional[typing.List[Item]]',
  '"list[Item]"', 'tuple[Item, ...]', 'typing.Tuple[Item, ...]',
  'typing.Dict[str, Item]',
]) {
  test(`${annotation} keeps collection multiplicity for its Item relationship`, () => {
    assert.match(inferField(annotation), /^Box --> "\*" Item$/m);
  });
}

test('a required Item reference remains mandatory', () => {
  assert.match(inferField('Item'), /^Box --> "1" Item$/m);
});

test('a quoted expression outside the supported type syntax does not fabricate a relationship', () => {
  const diagram = inferField('"lookup(\'Item\')"');
  assert.doesNotMatch(diagram, /^Box .*-->.* Item$/m);
});

test('an unrelated module Optional type is not treated as typing.Optional', () => {
  assert.doesNotMatch(inferField('domain.Optional[Item]'), /^Box .*-->.* Item$/m);
});

for (const annotation of ['...', '"..."', 'Optional[', 'Union[Item,', 'list[']) {
  test(`an incomplete or unknown annotation ${annotation} does not crash inference`, () => {
    const diagram = inferField(annotation);
    assert.match(diagram, /class Box \{/);
  });
}
