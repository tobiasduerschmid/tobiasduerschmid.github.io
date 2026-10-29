const { test, expect } = require('@playwright/test');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

async function renderDiagram(page, { attribute, inline } = {}) {
  await page.setContent('<html lang="en"><head><title>Diagram captions</title></head><body><main><h1>Observer collaboration</h1></main></body></html>');
  await page.evaluate(({ attribute, inline }) => {
    const diagram = document.createElement('div');
    diagram.setAttribute('data-uml-type', 'class');
    diagram.setAttribute('data-uml-spec', [
      '@startuml', inline ? 'caption: ' + inline : '',
      'class Subject', 'interface Observer', 'Subject --> Observer : notifies', '@enduml',
    ].join('\n'));
    if (attribute !== undefined) diagram.setAttribute('data-uml-caption', attribute);
    document.querySelector('main').appendChild(diagram);
  }, { attribute, inline });
  await page.addScriptTag({ path: path.join(root, 'js/ArchUML/uml-bundle.js') });
  await page.addScriptTag({ path: path.join(root, 'js/uml-auto-describe.js') });
  await page.evaluate(() => window.UMLShared.renderAll());
  const figure = page.getByRole('figure');
  await expect(figure.getByRole('img', { name: /Subject.*Observer/ })).toBeVisible();
  return figure;
}

for (const example of [
  { name: 'attribute captions are visible', attribute: 'The model owns state; views own reactions.', expected: 'The model owns state; views own reactions.' },
  { name: 'attribute captions override source captions', attribute: 'This caption belongs to the containing lesson.', inline: 'This caption belongs to the reusable source.', expected: 'This caption belongs to the containing lesson.' },
  { name: 'source captions remain visible without an attribute', inline: 'The notification contract separates the objects.', expected: 'The notification contract separates the objects.' },
  { name: 'blank attributes preserve source captions', attribute: '  ', inline: 'A source caption still supplies context.', expected: 'A source caption still supplies context.' },
]) {
  test(example.name, async ({ page }) => {
    const figure = await renderDiagram(page, example);
    await expect(figure.getByText(example.expected, { exact: true })).toBeVisible();
    if (example.inline && example.inline !== example.expected) {
      await expect(figure.getByText(example.inline, { exact: true })).toHaveCount(0);
    }
    await page.emulateMedia({ media: 'print' });
    await expect(figure.getByText(example.expected, { exact: true })).toBeVisible();
  });
}

test('a diagram without an authored caption retains its structural description', async ({ page }) => {
  const figure = await renderDiagram(page);
  await expect(figure.getByRole('img')).toHaveAccessibleName(/Subject.*Observer/);
  await expect(figure.getByText('UML class diagram', { exact: true })).toHaveCount(0);
});
