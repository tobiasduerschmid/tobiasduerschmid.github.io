'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { before, after, test } = require('node:test');
const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('../chromium-launch-options');
const { analyzeJavaSources } = require('../../js/uml-analyzer-java.js');
const { analyzeCppSources } = require('../../js/uml-analyzer-cpp.js');
require('../../js/uml-analyzer-python.js');
require('../../js/uml-analyzer-js.js');

const compilerContext = vm.createContext({ console, define(_name, _dependencies, factory) { factory(() => {}); } });
vm.runInContext(fs.readFileSync(path.join(__dirname,
  '../../js/vendor/monaco-editor/0.44.0/min/vs/language/typescript/tsWorker.js'), 'utf8'), compilerContext);

const fixtures = [
  {
    language: 'Python',
    infer: () => global.analyzePythonSources({ 'office.py': 'class Person:\n    pass\nclass Office:\n    primary: Person | None\n    backups: list[Person]\n' }),
  },
  {
    language: 'Python navigable ownership',
    infer: () => global.analyzePythonSources({ 'office.py': `class Person:
    pass
class Office:
    def __init__(self, primary: Person | None):
        self.primary: Person | None = primary
        self.backups: list[Person] = []
    def add_backup(self):
        self.backups.append(Person())
` }),
  },
  {
    language: 'TypeScript',
    infer: () => global.analyzeJSSources({ 'office.ts': 'class Person {} class Office { primary: Person | null; backups: Person[]; }' }, compilerContext.ts),
  },
  {
    language: 'Java',
    infer: () => analyzeJavaSources({ 'Office.java': 'class Person {} class Office { java.util.Optional<Person> primary; java.util.List<Person> backups; }' }),
  },
  {
    language: 'C++',
    infer: () => analyzeCppSources({ 'office.cpp': 'struct Person {}; struct Office { Person* primary; std::vector<Person*> backups; };' }),
  },
];

let browser;
before(async () => { browser = await chromium.launch(chromiumLaunchOptions()); });
after(async () => { if (browser) await browser.close(); });

async function withDiagram(source, theme, run) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  try {
    await page.setContent('<!doctype html><html lang="en"><head><title>Inferred UML relationship roles</title></head>' +
      '<body class="diagnostic-uml-page"><main><h1>Distinct relationship roles</h1><div id="diagram"></div></main></body></html>');
    for (const file of ['css/diagnostic-pages.css', 'css/uml-diagram.css']) {
      await page.addStyleTag({ path: path.join(__dirname, '../..', file) });
    }
    for (const file of ['js/ArchUML/uml-bundle.js', 'js/uml-auto-describe.js']) {
      await page.addScriptTag({ path: path.join(__dirname, '../..', file) });
    }
    await page.evaluate(async ({ source, theme }) => {
      document.documentElement.classList.toggle('dark-mode', theme === 'dark');
      await document.fonts.ready;
      const container = document.getElementById('diagram');
      window.UMLClassDiagram.render(container, source);
      window.UMLAutoDescribe.apply(container, 'class', source);
    }, { source, theme });
    await page.getByRole('img').waitFor({ state: 'visible' });
    await run(page);
    assert.deepEqual(errors, [], 'Inferred diagrams must render without browser errors');
  } finally {
    await page.close();
  }
}

async function renderedLabels(page, labels) {
  return page.getByRole('img').evaluate(image => {
    const svg = image.tagName.toLowerCase() === 'svg' ? image : image.querySelector('svg');
    return Array.from(svg.querySelectorAll('text'), text => {
      const box = text.getBoundingClientRect();
      return { text: text.textContent.trim(), left: box.left, right: box.right, top: box.top, bottom: box.bottom };
    });
  }).then(texts => texts.filter(text => labels.includes(text.text)));
}

function assertSeparateLabels(labels) {
  for (let first = 0; first < labels.length; first++) {
    const a = labels[first];
    assert.ok(a.right > a.left && a.bottom > a.top, `${a.text} must occupy visible space`);
    for (let second = first + 1; second < labels.length; second++) {
      const b = labels[second];
      const overlap = Math.min(a.right, b.right) > Math.max(a.left, b.left) &&
        Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top);
      assert.equal(overlap, false, `Relationship labels must not overlap: ${JSON.stringify([a, b])}`);
    }
  }
}

for (const fixture of fixtures) {
  for (const theme of ['light', 'dark']) {
    test(`${fixture.language} inferred roles remain visible and described with their own cardinalities in ${theme} mode`, async () => {
      const result = fixture.infer();
      assert.deepEqual(result.errors, []);
      await withDiagram(result.classDiagram, theme, async page => {
        const labels = await renderedLabels(page, ['primary', 'backups']);
        assert.deepEqual(labels.map(label => label.text).sort(), ['backups', 'primary']);
        assertSeparateLabels(labels);
        const imageText = await page.getByRole('img').textContent();
        assert.match(imageText, /0\.\.1/);
        assert.match(imageText, /\*/);
        const description = await page.getByRole('img').getAttribute('aria-label');
        assert.match(description, /Office (?:references|aggregates|composes) Person with multiplicity (?:one|unspecified) to zero or one labeled "primary"/);
        assert.match(description, /Office (?:references|aggregates|composes) Person with multiplicity (?:one|unspecified) to zero or more labeled "backups"/);
        const verbose = await page.evaluate(source => window.UMLAutoDescribe.describeVerbose('class', source), result.classDiagram);
        const relationships = verbose.sections.find(section => section.heading === 'Relationships').items;
        assert.equal(relationships.filter(item => /labeled "primary"/.test(item)).length, 1);
        assert.equal(relationships.filter(item => /labeled "backups"/.test(item)).length, 1);
        if (fixture.language === 'TypeScript' && theme === 'light' && process.env.UML_ROLE_SCREENSHOT) {
          await page.screenshot({ path: process.env.UML_ROLE_SCREENSHOT, fullPage: true });
        }
      });
    });
  }
}

const chapter = fs.readFileSync(path.join(__dirname, '../../SEBook/uml_class_diagram.md'), 'utf8')
  .replace(/^> ?/gm, '');
for (const [owner, roles] of [['MotherBoard', ['primaryIDE', 'secondaryIDE']],
  ['Division', ['division', 'employees']]]) {
  const source = [...chapter.matchAll(/@startuml\b([\s\S]*?)@enduml/g)]
    .find(match => match[1].includes(`class ${owner}`))[1];
  for (const theme of ['light', 'dark']) {
    test(`${owner} chapter relationships stay separate and accessible in ${theme} mode`, async () => {
      await withDiagram(source, theme, async page => {
        const labels = await renderedLabels(page, roles);
        assert.deepEqual(labels.map(label => label.text).sort(), roles.slice().sort());
        assertSeparateLabels(labels);
        const description = await page.getByRole('img').getAttribute('aria-label');
        for (const role of roles) assert.ok(description.includes(`labeled "${role}"`));
        if (owner === 'Division') {
          assert.ok(description.includes('Division references Employee with multiplicity unspecified to zero or more labeled "employees"'));
          assert.doesNotMatch(description, /Division composes Employee/);
        }
        if (process.env.UML_CHAPTER_SCREENSHOT && owner === 'MotherBoard' && theme === 'light') {
          await page.screenshot({ path: process.env.UML_CHAPTER_SCREENSHOT, fullPage: true });
        }
      });
    });
  }
}

for (const theme of ['light', 'dark']) {
  test(`union alternatives survive rendering and text descriptions in ${theme} mode`, async () => {
    const result = global.analyzeJSSources({
      'pets.ts': 'class Cat {} class Dog {} type Pet = Cat | Dog; class Household { pet: Pet | null; }',
    }, compilerContext.ts);
    assert.deepEqual(result.errors, []);
    await withDiagram(result.classDiagram, theme, async page => {
      const labels = await renderedLabels(page, ['pet (alternative)']);
      assert.equal(labels.length, 2, 'Both union alternatives need an independently visible relationship');
      assertSeparateLabels(labels);
      const description = await page.getByRole('img').getAttribute('aria-label');
      for (const target of ['Cat', 'Dog']) {
        assert.ok(description.includes(`Household references ${target} with multiplicity one to zero or one labeled "pet (alternative)"`),
          `The text alternative must describe the optional ${target} relationship`);
      }
    });
  });
}
