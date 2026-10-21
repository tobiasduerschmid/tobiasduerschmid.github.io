// @ts-check
const { test, expect } = require('@playwright/test');
const { selectAllInMonaco } = require('./helpers/monaco-keyboard');
const { a11yCheckpoint } = require('./a11y-helpers');

const studentSource = `class Student {
    private name;

    constructor(name: string) {
        this.name = name;
    }

    displayName() {
        return this.name;
    }
}
`;

/** Use the compiler and standard libraries loaded by the production worker. */
async function analyzeEdits(page, sourceVersions) {
  await page.goto('/robots.txt');
  const responses = await page.evaluate(async versions => {
    const worker = new Worker('/js/uml-worker.js');
    try {
      const results = [];
      for (const [index, sources] of versions.entries()) {
        results.push(await new Promise((resolve, reject) => {
          worker.onmessage = event => resolve(event.data);
          worker.onerror = event => reject(new Error(event.message));
          worker.postMessage({ type: 'analyze', id: index + 1, lang: 'js', sources, options: {} });
        }));
      }
      return results;
    } finally {
      worker.terminate();
    }
  }, sourceVersions);
  for (const response of responses) {
    expect(response.ok, response.error).toBe(true);
    expect(response.result.errors).toEqual([]);
  }
  return responses.map(response => response.result.classDiagram);
}

async function infer(page, source) {
  const [diagram] = await analyzeEdits(page, [{ 'model.ts': source }]);
  return diagram;
}

test('a typed constructor argument determines an unannotated field and getter return', async ({ page }) => {
  const diagram = await infer(page, studentSource);
  expect(diagram).toMatch(/^  -name: string$/m);
  expect(diagram).toMatch(/^  \+displayName\(\): string$/m);
});

test('standard library calls carry their inferred types into fields and returns', async ({ page }) => {
  const diagram = await infer(page, `class Label {
    private value;
    constructor(value: string) {
        this.value = value.trim().toUpperCase();
    }
    read() { return this.value; }
    characters() { return this.value.split(""); }
}`);
  expect(diagram).toMatch(/^  -value: string$/m);
  expect(diagram).toMatch(/^  \+read\(\): string$/m);
  expect(diagram).toMatch(/^  \+characters\(\): string\[\]$/m);
});

for (const dynamicType of ['any', 'unknown']) {
  test(`${dynamicType} input leaves inferred field and getter types blank`, async ({ page }) => {
    const diagram = await infer(page, `class Label {
    private value;
    constructor(value: ${dynamicType}) { this.value = value; }
    read() { return this.value; }
}`);
    expect(diagram).toMatch(/^  -value$/m);
    expect(diagram).toMatch(/^  \+read\(\)$/m);
  });
}

test('unresolved collection element types are not advertised as confirmed types', async ({ page }) => {
  const diagram = await infer(page, `class Collection {
    private values;
    constructor(value: unknown) { this.values = [value]; }
    read() { return this.values; }
}`);
  expect(diagram).toMatch(/^  -values$/m);
  expect(diagram).toMatch(/^  \+read\(\)$/m);
});

test('a constructor value with an unresolved result leaves inferred member types blank', async ({ page }) => {
  const diagram = await infer(page, `class Factory {
    private factory;
    constructor(factory: new () => unknown) { this.factory = factory; }
    read() { return this.factory; }
}`);
  expect(diagram).toMatch(/^  -factory$/m);
  expect(diagram).toMatch(/^  \+read\(\)$/m);
});

test('nullable branch alternatives are retained for the field and getter', async ({ page }) => {
  const diagram = await infer(page, `class Label {
    private value;
    constructor(name: string, enabled: boolean) {
        if (enabled) this.value = name;
        else this.value = null;
    }
    read() { return this.value; }
}`);
  expect(diagram).toMatch(/^  -value: (?:string \| null|null \| string)$/m);
  expect(diagram).toMatch(/^  \+read\(\): (?:string \| null|null \| string)$/m);
});

test('explicit field and return annotations retain their source spelling', async ({ page }) => {
  const diagram = await infer(page, `class Label {
    private value: string | number;
    private dynamic: any;
    constructor(value: string) { this.value = value; this.dynamic = value; }
    read(): string | number { return this.value; }
    dynamicRead(): any { return this.dynamic; }
}`);
  expect(diagram).toMatch(/^  -value: string \| number$/m);
  expect(diagram).toMatch(/^  -dynamic: any$/m);
  expect(diagram).toMatch(/^  \+read\(\): string \| number$/m);
  expect(diagram).toMatch(/^  \+dynamicRead\(\): any$/m);
});

test('editing the supplied source updates inferred field and return types', async ({ page }) => {
  const [strings, numbers] = await analyzeEdits(page, [
    { 'model.ts': studentSource },
    { 'model.ts': studentSource.replace('name: string', 'name: number') }
  ]);
  expect(strings).toMatch(/^  -name: string$/m);
  expect(strings).toMatch(/^  \+displayName\(\): string$/m);
  expect(numbers).toMatch(/^  -name: number$/m);
  expect(numbers).toMatch(/^  \+displayName\(\): number$/m);
});

test('imported types update across edits and disappear when a source file is removed', async ({ page }) => {
  const model = `import { readValue } from './helper';
class Label {
    private value = readValue();
    read() { return this.value; }
}`;
  const [strings, numbers, missing] = await analyzeEdits(page, [
    { 'model.ts': model, 'helper.ts': 'export function readValue(): string { return "one"; }' },
    { 'model.ts': model, 'helper.ts': 'export function readValue(): number { return 1; }' },
    { 'model.ts': model }
  ]);
  expect(strings).toMatch(/^  -value: string$/m);
  expect(strings).toMatch(/^  \+read\(\): string$/m);
  expect(numbers).toMatch(/^  -value: number$/m);
  expect(numbers).toMatch(/^  \+read\(\): number$/m);
  expect(missing).toMatch(/^  -value$/m);
  expect(missing).toMatch(/^  \+read\(\)$/m);
});

test('the live chapter TypeScript tab shows inferred types without changing source', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/SEBook/uml_class_diagram.html');
  const lab = page.getByRole('region', { name: 'UML code lab: Member visibility', exact: true });
  await lab.getByRole('tab', { name: 'TypeScript', exact: true }).click();
  const editor = lab.getByRole('textbox', { name: /^TypeScript code/ });
  await editor.focus();
  await selectAllInMonaco(editor);
  await editor.evaluate((element, source) => {
    const instance = window.monaco.editor.getEditors().find(candidate => candidate.getDomNode().contains(element));
    instance.trigger('keyboard', 'paste', { text: source });
  }, studentSource);

  const diagram = lab.getByRole('img');
  await expect(diagram).toContainText('-name: string', { timeout: 15_000 });
  await expect(diagram).toContainText('displayName(): string');
  await expect(editor).toBeFocused();
  await expect(lab.locator('[data-uml-source]')).toHaveValue(studentSource);
  const design = lab.getByRole('button', { name: 'Design focus', exact: true });
  await design.focus();
  await design.press('Space');
  await expect(diagram).toContainText('name: String');
  await expect(diagram).toContainText('displayName(): String');
  await expect(design).toBeFocused();
  await a11yCheckpoint(page, 'Inferred TypeScript types in the design view', { include: '.uml-code-lab' });

  await lab.getByRole('button', { name: 'Implementation details', exact: true }).click();
  await expect(diagram).toContainText('-name: string');
  await expect(diagram).toContainText('displayName(): string');
  await expect(lab.locator('[data-uml-source]')).toHaveValue(studentSource);
  expect(errors).toEqual([]);
});
