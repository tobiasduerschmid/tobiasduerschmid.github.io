// @ts-check
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { test, expect } = require('@playwright/test');

const tutorial = yaml.load(fs.readFileSync(path.join(__dirname,
  '../_data/tutorials/uml-class-diagram-python.yml'), 'utf8'));

function targetDiagram(instructions) {
  const diagrams = [...instructions.matchAll(/<div\b([^>]*?)data-uml-spec=(["'])(@startuml[\s\S]*?@enduml)\s*\2/g)];
  const target = diagrams.find(match => match[1].includes('inferred-target')) || diagrams.at(-1);
  expect(target, 'The exercise must publish a target diagram').toBeTruthy();
  return target[3].replaceAll('&quot;', '"');
}

function classMembers(diagram) {
  return Object.fromEntries([...diagram.matchAll(/\b(?:class|interface)\s+(\w+)\s*\{([\s\S]*?)^\s*\}/gm)]
    .map(([, name, body]) => [name, body.split('\n').map(line => line.trim()).filter(Boolean)
      .map(line => line.replace(/\s+/g, '').replace(/^([+#-])(\{(?:abstract|static)\})/, '$2$1')).sort()]));
}

for (const step of tutorial.steps.filter(step => step.solution?.files)) {
  test(`Python class tutorial ${step.key}: target members match its inferred solution`, async ({ page }) => {
    const sources = Object.fromEntries(step.solution.files.map(file => [file.path, file.content]));
    const options = {
      hideVisibility: (step.uml_hide || []).includes('visibility'),
      hideMultiplicity: (step.uml_hide || []).includes('multiplicity'),
    };
    // The production worker supplies the same real type inference used by the
    // tutorial. A plain same-origin document avoids starting unrelated editors.
    await page.goto('/robots.txt');
    const response = await page.evaluate(async request => {
      const worker = new Worker('/js/uml-worker.js');
      try {
        return await new Promise((resolve, reject) => {
          worker.onmessage = event => resolve(event.data);
          worker.onerror = event => reject(new Error(event.message));
          worker.postMessage({ type: 'analyze', id: 1, lang: 'python', ...request });
        });
      } finally {
        worker.terminate();
      }
    }, { sources, options });
    expect(response.ok, response.error).toBe(true);
    expect(response.result.errors).toEqual([]);
    const target = classMembers(targetDiagram(step.instructions));
    expect(Object.keys(target).length, 'The exercise must publish class members').toBeGreaterThan(0);
    expect(classMembers(response.result.classDiagram),
      'Target labels must use the same source names and inferred types as Implementation details').toEqual(target);
  });
}
