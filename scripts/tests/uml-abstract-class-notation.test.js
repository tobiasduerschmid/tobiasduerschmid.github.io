'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('../chromium-launch-options');

const bundlePath = path.join(__dirname, '../../js/ArchUML/uml-bundle.js');

// UML 2.5.1 (9.2.4) shows an abstract classifier by its italic name and,
// alternatively or in addition, the property {abstract} after or below the
// name. It defines no «abstract» keyword.
async function headerTexts(page, spec) {
  return page.evaluate(text => {
    const host = document.getElementById('diagram');
    host.replaceChildren();
    window.UMLClassDiagram.render(host, text);
    return Array.from(host.querySelectorAll('svg text'), node => ({
      text: node.textContent.trim(),
      y: Number(node.getAttribute('y')),
      italic: node.getAttribute('font-style') === 'italic',
    }));
  }, spec);
}

test('abstract classes show an italic name with {abstract} below it, never «abstract»', async () => {
  const browser = await chromium.launch(chromiumLaunchOptions());
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html lang="en"><title>Abstract class notation</title><body><div id="diagram"></div></body></html>');
    await page.addScriptTag({ path: bundlePath });

    const abstract = await headerTexts(page, '@startuml\nabstract class Channel {\n  # name: String\n}\n@enduml');
    const name = abstract.find(entry => entry.text === 'Channel');
    const property = abstract.find(entry => entry.text === '{abstract}');
    assert.ok(name && name.italic, 'the abstract class name is italic');
    assert.ok(property, 'the property {abstract} is shown');
    assert.ok(property.y > name.y, '{abstract} sits below the name');
    assert.ok(abstract.every(entry => !entry.text.includes('«abstract»')), 'no «abstract» keyword');

    // A class with its own stereotype keeps that keyword and its italic name.
    const stereotyped = await headerTexts(page, '@startuml\nabstract class Subscriber <<ABC>>\n@enduml');
    assert.deepEqual(stereotyped.map(entry => entry.text), ['«ABC»', 'Subscriber']);
    assert.ok(stereotyped.find(entry => entry.text === 'Subscriber').italic);

    // The property takes the line the keyword used, so headers keep their height.
    const height = spec => page.evaluate(text => {
      const host = document.getElementById('diagram');
      host.replaceChildren();
      window.UMLClassDiagram.render(host, text);
      return host.querySelector('svg').viewBox.baseVal.height;
    }, spec);
    assert.equal(await height('@startuml\nabstract class Shape\n@enduml'), await height('@startuml\ninterface Shape\n@enduml'));
  } finally {
    await browser.close();
  }
});
