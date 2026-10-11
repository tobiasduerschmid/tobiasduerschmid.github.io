const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const files = ['test-uml.html',
  ...fs.readdirSync(path.join(root, 'SEBook')).filter((name) => /^uml.*\.md$/.test(name)).map((name) => `SEBook/${name}`),
  ...fs.readdirSync(path.join(root, 'SEBook/designpatterns')).filter((name) => name.endsWith('.md')).map((name) => `SEBook/designpatterns/${name}`)];
const renderers = { class: 'UMLClassDiagram', component: 'UMLComponentDiagram', state: 'UMLStateDiagram',
  deployment: 'UMLDeploymentDiagram', sequence: 'UMLSequenceDiagram', activity: 'UMLActivityDiagram', usecase: 'UMLUseCaseDiagram' };

function authoredDiagrams(file) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const diagrams = [];
  for (const match of source.matchAll(/<code\b[^>]*class=["']language-uml-(\w+)["'][^>]*>([\s\S]*?)<\/code>/g)) {
    if (renderers[match[1]]) diagrams.push({ type: match[1], source: match[2] });
  }
  for (const match of source.matchAll(/<div\b[^>]*\bdata-uml-spec=(["'])([\s\S]*?)\1[^>]*>/g)) {
    const type = match[0].match(/data-uml-type=["']([^"']+)["']/)?.[1] || 'class';
    if (renderers[type]) diagrams.push({ type, source: match[2] });
  }
  return diagrams;
}

for (const file of files) {
  const diagrams = authoredDiagrams(file);
  if (!diagrams.length) continue;
  test(`${file}: current renderer keeps authored diagram labels distinct`, async ({ page }) => {
    await page.setContent('<main><div id="diagram"></div></main>');
    await page.addStyleTag({ path: path.join(root, 'css/uml-diagram.css') });
    await page.addScriptTag({ path: path.join(root, 'js/ArchUML/uml-bundle.js') });
    const failures = [];
    for (const [index, diagram] of diagrams.entries()) {
      const result = await page.evaluate(({ diagram, renderer }) => {
        const decoder = document.createElement('textarea');
        decoder.innerHTML = diagram.source;
        // Markdown blockquote prefixes are removed by Jekyll before rendering.
        const source = decoder.value.replace(/^\s*> ?/gm, '');
        const container = document.getElementById('diagram');
        window[renderer].render(container, source);
        const svg = container.querySelector('svg');
        if (!svg) return [{ error: container.textContent }];
        const scale = svg.getScreenCTM().a;
        const texts = [...svg.querySelectorAll('text')].map((text) => ({ label: text.textContent, box: text.getBoundingClientRect() }));
        const overlaps = [];
        for (let first = 0; first < texts.length; first++) {
          for (let second = first + 1; second < texts.length; second++) {
            const a = texts[first].box, b = texts[second].box;
            const width = (Math.min(a.right, b.right) - Math.max(a.left, b.left)) / scale;
            const height = (Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) / scale;
            if (width > 1 && height > 1) overlaps.push({ first: texts[first].label, second: texts[second].label });
          }
        }
        return overlaps;
      }, { diagram, renderer: renderers[diagram.type] });
      if (result.length) failures.push({ diagram: index + 1, type: diagram.type, issues: result });
    }
    expect(failures, 'Visible labels must remain distinct across the authored corpus').toEqual([]);
  });
}
