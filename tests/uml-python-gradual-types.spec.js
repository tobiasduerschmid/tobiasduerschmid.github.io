// @ts-check
const { test, expect } = require('@playwright/test');
const { selectAllInMonaco } = require('./helpers/monaco-keyboard');
const { a11yCheckpoint } = require('./a11y-helpers');

const studentSource = `class Student:
    def __init__(self, name: str) -> None:
        self._name = name

    def display_name(self):
        return self._name
`;

/** Exercise the production browser worker, including its real inference library. */
async function analyzeResponses(page, sourceVersions) {
  // A same-origin document without chapter widgets keeps these worker contract
  // tests independent from unrelated editor initialization.
  await page.goto('/robots.txt');
  return page.evaluate(async versions => {
    const worker = new Worker('/js/uml-worker.js');
    const results = [];
    try {
      for (const [index, sources] of versions.entries()) {
        results.push(await new Promise((resolve, reject) => {
          worker.onmessage = event => resolve(event.data);
          worker.onerror = event => reject(new Error(event.message));
          worker.postMessage({ type: 'analyze', id: index + 1, lang: 'python', sources, options: {} });
        }));
      }
      return results;
    } finally {
      worker.terminate();
    }
  }, sourceVersions);
}

async function analyzeEdits(page, sourceVersions) {
  const responses = await analyzeResponses(page, sourceVersions);
  for (const response of responses) {
    expect(response.ok, response.error).toBe(true);
    expect(response.result.errors).toEqual([]);
  }
  return responses.map(response => response.result.classDiagram);
}

async function infer(page, source) {
  const [diagram] = await analyzeEdits(page, [{ 'model.py': source }]);
  return diagram;
}

test('a typed constructor argument determines its field and unannotated getter return', async ({ page }) => {
  const diagram = await infer(page, studentSource);
  expect(diagram).toMatch(/^  #_name: str$/m);
  expect(diagram).toMatch(/^  \+display_name\(\): str$/m);
});

test('local aliases carry parameter types into fields', async ({ page }) => {
  const diagram = await infer(page, `class Student:
    def __init__(self, name: str):
        first = name
        saved = first
        self._name = saved
`);
  expect(diagram).toMatch(/^  #_name: str$/m);
});

test('annotated locals carry a known type into fields', async ({ page }) => {
  const diagram = await infer(page, `class Student:
    def __init__(self, name: str):
        saved: str = name
        self._name = saved
`);
  expect(diagram).toMatch(/^  #_name: str$/m);
});

test('an unresolved call is not presented as a confirmed field type', async ({ page }) => {
  const diagram = await infer(page, `class Student:
    def __init__(self, source):
        name: str = source()
        self._name = name
`);
  expect(diagram).toMatch(/^  #_name$/m);
});

test('a reassigned local supplies its current type to a field', async ({ page }) => {
  const diagram = await infer(page, `class Label:
    def __init__(self, name: str, count: int):
        value = name
        value = count
        self._value = value
`);
  expect(diagram).toMatch(/^  #_value: int$/m);
});

test('an explicit field annotation remains authoritative', async ({ page }) => {
  const diagram = await infer(page, `class Label:
    def __init__(self, name: str):
        self._value: object = name
`);
  expect(diagram).toMatch(/^  #_value: object$/m);
});

test('unannotated inputs do not acquire a concrete type from a neighboring field', async ({ page }) => {
  const diagram = await infer(page, `class Label:
    def __init__(self, name: str, value):
        self._name = name
        self._value = value
`);
  expect(diagram).toMatch(/^  #_name: str$/m);
  expect(diagram).toMatch(/^  #_value$/m);
});

test('Any input remains dynamic through a field and its getter', async ({ page }) => {
  const diagram = await infer(page, `from typing import Any
class Label:
    def __init__(self, value: Any):
        self._value = value
    def read(self):
        return self._value
`);
  expect(diagram).toMatch(/^  #_value$/m);
  expect(diagram).toMatch(/^  \+read\(\)$/m);
});

test('type aliases cannot hide unresolved field or getter types', async ({ page }) => {
  for (const declaration of [
    'from typing import Any\ntype Hidden = list[Any]',
    'type Hidden = list[MissingType]',
    'from typing import Any, TypeAlias\nHidden: TypeAlias = str | list[Any]',
    'from typing import Any\ntype Hidden = str | list[Hidden] | dict[str, Any]',
  ]) {
    const diagram = await infer(page, `${declaration}
class Label:
    def __init__(self, value: Hidden):
        self._value = value
    def read(self):
        return self._value
`);
    expect(diagram).toMatch(/^  #_value$/m);
    expect(diagram).toMatch(/^  \+read\(\)$/m);
  }
});

test('known type aliases preserve complete types including generic arguments', async ({ page }) => {
  const diagram = await infer(page, `type Items[T] = list[T]
class Label:
    def __init__(self, value: Items[str]):
        self._value = value
    def read(self):
        return self._value
`);
  expect(diagram).toMatch(/^  #_value: (?:Items|list)\[str\]$/m);
  expect(diagram).toMatch(/^  \+read\(\): (?:Items|list)\[str\]$/m);
});

test('same-name type aliases in separate modules do not share ambiguity', async ({ page }) => {
  const [diagram] = await analyzeEdits(page, [{
    'known.py': `type Value = str
class Known:
    def __init__(self, value: Value):
        self._known = value
    def read_known(self):
        return self._known
`,
    'unknown.py': `from typing import Any
type Value = list[Any]
class Unresolved:
    def __init__(self, value: Value):
        self._unknown = value
    def read_unknown(self):
        return self._unknown
`,
  }]);
  expect(diagram).toMatch(/^  #_known: (?:Value|str)$/m);
  expect(diagram).toMatch(/^  \+read_known\(\): (?:Value|str)$/m);
  expect(diagram).toMatch(/^  #_unknown$/m);
  expect(diagram).toMatch(/^  \+read_unknown\(\)$/m);
});

test('colliding class names leave inferred nominal types unspecified without hiding explicit aliases or literals', async ({ page }) => {
  const [diagram] = await analyzeEdits(page, [{
    'sales.py': 'class Item:\n    pass\n',
    'warehouse.py': 'class Item:\n    pass\n',
    'main.py': `from sales import Item as SalesItem
from warehouse import Item as WarehouseItem
class Order:
    def __init__(self, sales: SalesItem, warehouse: WarehouseItem, name: str):
        first = sales
        second = warehouse
        self._sale = first
        self._stock = second
        self._items = [first]
        self._name = name
    def read(self):
        return self._sale
    def read_items(self):
        return self._items
    def declared(self) -> SalesItem:
        return self._sale
    def display_name(self):
        return self._name
    def marker(self):
        return 'Item'
`,
  }]);
  for (const field of ['_sale', '_stock', '_items']) {
    expect(diagram).toMatch(new RegExp('^  #' + field + '$', 'm'));
  }
  expect(diagram).toMatch(/^  \+read\(\)$/m);
  expect(diagram).toMatch(/^  \+read_items\(\)$/m);
  expect(diagram).toMatch(/^  \+declared\(\): SalesItem$/m);
  expect(diagram).toMatch(/^  #_name: str$/m);
  expect(diagram).toMatch(/^  \+display_name\(\): str$/m);
  expect(diagram).toMatch(/^  \+marker\(\): Literal\[['"]Item['"]\]$/m);
});

test('a branch with an unresolved alternative leaves the field and return type blank', async ({ page }) => {
  const diagram = await infer(page, `class Choice:
    def __init__(self, flag: bool, known: str, unresolved):
        if flag:
            value = known
        else:
            value = unresolved
        self._value = value
    def read(self):
        return self._value
`);
  expect(diagram).toMatch(/^  #_value$/m);
  expect(diagram).toMatch(/^  \+read\(\)$/m);
});

test('a collection with unresolved element types leaves the field and return type blank', async ({ page }) => {
  const diagram = await infer(page, `class Collection:
    def __init__(self, value):
        self._values = [value]
    def read(self):
        return self._values
`);
  expect(diagram).toMatch(/^  #_values$/m);
  expect(diagram).toMatch(/^  \+read\(\)$/m);
});

test('both branch alternatives are retained in a field type', async ({ page }) => {
  const diagram = await infer(page, `class Choice:
    def __init__(self, flag: bool, label: str, count: int):
        if flag:
            value = label
        else:
            value = count
        self._value = value
`);
  expect(diagram).toMatch(/^  #_value: (?:str \| int|int \| str)$/m);
});

test('field and getter types retain writes from different methods', async ({ page }) => {
  const diagram = await infer(page, `class Choice:
    def __init__(self, value: str):
        self._value = value
    def set_count(self, value: int):
        self._value = value
    def read(self):
        return self._value
`);
  expect(diagram).toMatch(/^  #_value: (?:str \| int|int \| str)$/m);
  expect(diagram).toMatch(/^  \+read\(\): (?:str \| int|int \| str)$/m);
});

test('nullable fields and unannotated returns retain None', async ({ page }) => {
  const diagram = await infer(page, `class Label:
    def __init__(self, value: str | None):
        self._value = value
    def read(self):
        return self._value
`);
  expect(diagram).toMatch(/^  #_value: (?:str \| None|None \| str)$/m);
  expect(diagram).toMatch(/^  \+read\(\): (?:str \| None|None \| str)$/m);
});

test('method return inference includes a path that returns no value', async ({ page }) => {
  const diagram = await infer(page, `class Label:
    def read(self, available: bool, value: str):
        if available:
            return value
`);
  expect(diagram).toMatch(/^  \+read\(available: bool, value: str\): (?:str \| None|None \| str)$/m);
});

test('inference follows helper calls through their inferred returns', async ({ page }) => {
  const diagram = await infer(page, `def clean_name(name: str):
    return name.strip()
class Student:
    def __init__(self, name: str):
        self._name = clean_name(name)
    def display_name(self):
        return self._name
`);
  expect(diagram).toMatch(/^  #_name: str$/m);
  expect(diagram).toMatch(/^  \+display_name\(\): str$/m);
});

test('identically named method parameters retain their own types', async ({ page }) => {
  const diagram = await infer(page, `class Label:
    def set_name(self, value: str):
        self._name = value
    def set_count(self, value: int):
        self._count = value
`);
  expect(diagram).toMatch(/^  #_name: str$/m);
  expect(diagram).toMatch(/^  #_count: int$/m);
});

test('a property setter does not replace the getter type with None', async ({ page }) => {
  const diagram = await infer(page, `class Label:
    def __init__(self, value: str):
        self._value = value
    @property
    def value(self):
        return self._value
    @value.setter
    def value(self, value: str) -> None:
        self._value = value
`);
  expect(diagram).toMatch(/^  \+value: str$/m);
});

test('a custom-decorated method does not advertise the original body return type', async ({ page }) => {
  const diagram = await infer(page, `def discard(fn):
    def wrapped(*args, **kwargs):
        return None
    return wrapped
class Label:
    @discard
    def read(self):
        return 'hello'
`);
  expect(diagram).toMatch(/^  \+read\(\)$/m);
});

test('a decorator with an unresolved result leaves the method return blank', async ({ page }) => {
  const diagram = await infer(page, `def decorate(fn):
    return unknown(fn)
class Label:
    @decorate
    def read(self):
        return 'hello'
`);
  expect(diagram).toMatch(/^  \+read\(\)$/m);
});

test('a callable parameter does not become the enclosing constructor return type', async ({ page }) => {
  const diagram = await infer(page, `from collections.abc import Callable
class Label:
    def __init__(self, callback: Callable[[str], int]):
        self._callback = callback
    def read(self):
        return self._callback('x')
`);
  expect(diagram).toMatch(/^  \+__init__\(callback: Callable\[\[str\], int\]\): None$/m);
  expect(diagram).toMatch(/^  \+read\(\): int$/m);
});

test('a changed inference-library asset reports failure without returning a diagram', async ({ page }) => {
  await page.route('**/js/vendor/browser-basedpyright/1.40.2/pyright.worker.js', route => route.fulfill({
    contentType: 'text/javascript', body: 'throw new Error("This altered library must not execute");'
  }));
  const [response] = await analyzeResponses(page, [{ 'model.py': studentSource }]);
  expect(response.ok).toBe(false);
  expect(response.error).toMatch(/integrity check failed/i);
  expect(response.result).toBeUndefined();
});

test('editing and removing an imported source does not reuse its previous inferred types', async ({ page }) => {
  const model = `from helper import read_value
class Label:
    def __init__(self):
        self._value = read_value()
    def read(self):
        return self._value
`;
  const [strings, numbers, missing] = await analyzeEdits(page, [
    { 'model.py': model, 'helper.py': 'def read_value() -> str:\n    return "label"\n' },
    { 'model.py': model, 'helper.py': 'def read_value() -> int:\n    return 1\n' },
    { 'model.py': model }
  ]);
  expect(strings).toMatch(/^  #_value: str$/m);
  expect(strings).toMatch(/^  \+read\(\): str$/m);
  expect(numbers).toMatch(/^  #_value: int$/m);
  expect(numbers).toMatch(/^  \+read\(\): int$/m);
  expect(missing).toMatch(/^  #_value$/m);
  expect(missing).toMatch(/^  \+read\(\)$/m);
});

test('the live chapter shows inferred fields and returns in both diagram views', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/SEBook/uml_class_diagram.html');
  const lab = page.getByRole('region', { name: 'UML code lab: Member visibility', exact: true });
  const editor = lab.getByRole('textbox', { name: /^Python code/ });
  await editor.focus();
  await selectAllInMonaco(editor);
  await editor.evaluate((element, source) => {
    const instance = window.monaco.editor.getEditors().find(candidate => candidate.getDomNode().contains(element));
    instance.trigger('keyboard', 'paste', { text: source });
  }, studentSource);

  const diagram = lab.getByRole('img');
  await expect(diagram).toContainText('_name: str', { timeout: 15_000 });
  await expect(diagram).toContainText('display_name(): str');
  await expect(editor).toBeFocused();
  const design = lab.getByRole('button', { name: 'Design focus', exact: true });
  await design.focus();
  await design.press('Space');
  await expect(diagram).toContainText('name: String');
  await expect(diagram).toContainText('display_name(): String');
  await expect(design).toBeFocused();
  await a11yCheckpoint(page, 'Inferred Python types in the design view', { include: '.uml-code-lab' });

  await lab.getByRole('button', { name: 'Implementation details', exact: true }).click();
  await expect(diagram).toContainText('_name: str');
  await expect(diagram).toContainText('display_name(): str');
  expect(errors).toEqual([]);
});
