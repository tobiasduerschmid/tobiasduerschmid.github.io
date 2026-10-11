'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { before, after, test } = require('node:test');
const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('../chromium-launch-options');

let browser;
before(async () => {
  browser = await chromium.launch(chromiumLaunchOptions());
});
after(async () => { if (browser) await browser.close(); });

async function withRenderer(run) {
  const page = await browser.newPage();
  try {
    await page.setContent('<!doctype html><html lang="en"><title>CRC test</title><body><div id="diagram"></div></body></html>');
    await page.addScriptTag({ path: path.join(__dirname, '../../js/ArchUML/uml-bundle.js') });
    await run(page);
  } finally {
    await page.close();
  }
}

test('CRC source retains independent responsibility and collaborator lists, aliases, and source ranges', async () => {
  await withRenderer(async (page) => {
    const source = '@startuml\n@layout schema=1\nnode Cart x=10 y=20\n@endlayout\ncard "Shopping cart" as Cart {\n responsibility: Know products; quantities {and prices}\n responsibility: Store the literal @pos(5,6) string\n collaborator: Catalog\n}\ncard Catalog {\n}\n@enduml';
    const result = await page.evaluate((text) => window.UMLCRCDiagram.parse(text), source);
    assert.equal(result.cards.length, 2);
    assert.equal(result.cards[0].id, 'Cart');
    assert.equal(result.cards[0].name, 'Shopping cart');
    assert.deepEqual(result.cards[0].responsibilities, ['Know products; quantities {and prices}', 'Store the literal @pos(5,6) string']);
    assert.deepEqual(result.cards[0].collaborators, ['Catalog']);
    assert.equal(result.cards[0].startLine, 4);
    assert.equal(result.cards[0].endLine, 8);
    assert.deepEqual(result.cards[1].responsibilities, []);
    assert.deepEqual(result.cards[1].collaborators, []);
  });
});

for (const [label, source, message] of [
  ['unclosed card', 'card Cart {\n responsibility: Track items', /line 1.*clos/i],
  ['unknown entry', 'card Cart {\n method: addItem\n}', /line 2.*responsibility.*collaborator/i],
  ['empty entry', 'card Cart {\n responsibility: \n}', /line 2.*text/i],
  ['duplicate ID', 'card Cart {\n}\ncard Cart {\n}', /line 3.*duplicate.*Cart/i],
]) {
  test(`CRC source reports a useful error for ${label}`, async () => {
    await withRenderer(async (page) => {
      const error = await page.evaluate((text) => {
        try { window.UMLCRCDiagram.parse(text); return null; }
        catch (problem) { return problem.message; }
      }, source);
      assert.match(error, message);
    });
  });
}

test('CRC rendering safely displays prose, wraps long entries, and grows the card to contain it', async () => {
  await withRenderer(async (page) => {
    const result = await page.evaluate(() => {
      const container = document.getElementById('diagram');
      const text = 'card "<Cart & orders>" as Cart {\n responsibility: ' + 'Know selected products and calculate their totals '.repeat(8) + '\n collaborator: <img src=x onerror=alert(1)>\n}';
      window.UMLCRCDiagram.render(container, text);
      const svg = container.querySelector('svg');
      const group = svg.querySelector('[data-layout-id="Cart"]');
      const card = group.querySelector('rect');
      const cardBox = card.getBBox();
      const texts = [...group.querySelectorAll('text')];
      return {
        text: texts.map((node) => node.textContent).join(' '),
        unsafeElements: container.querySelectorAll('img, script').length,
        labelCount: texts.length,
        overflow: texts.filter((node) => {
          const box = node.getBBox();
          return box.x < cardBox.x || box.y < cardBox.y || box.x + box.width > cardBox.x + cardBox.width + 1 || box.y + box.height > cardBox.y + cardBox.height + 1;
        }).map((node) => node.textContent),
        fontSizes: texts.map((node) => parseFloat(getComputedStyle(node).fontSize)),
      };
    });
    assert.match(result.text, /<Cart & orders>/);
    assert.match(result.text, /Responsibilities.*Collaborators/s);
    assert.match(result.text, /<img src=x onerror=alert\(1\)>/);
    assert.equal(result.unsafeElements, 0);
    assert.ok(result.labelCount > 10, 'long responsibility text should wrap');
    assert.deepEqual(result.overflow, [], 'all displayed text must fit inside its card');
    assert.ok(result.fontSizes.every((size) => size >= 20), 'card text is paragraph size');
  });
});

test('CRC cards honor saved positions through the shared layout geometry contract', async () => {
  await withRenderer(async (page) => {
    const boxes = await page.evaluate(() => {
      const container = document.getElementById('diagram');
      window.UMLCRCDiagram.render(container, 'card "Shopping cart" as "Cart" @pos(120,80) {\n responsibility: Treat prose as Cart @pos(5,6) literally\n}\ncard Catalog {\n}\n@layout schema=1\nnode Catalog x=800 y=300\n@endlayout');
      const svg = container.querySelector('svg');
      return ['Cart', 'Catalog'].map((id) => window.UMLShared.renderedLayoutBox(svg, id));
    });
    assert.equal(Math.round(boxes[0].x), 120);
    assert.equal(Math.round(boxes[0].y), 80);
    assert.equal(Math.round(boxes[1].x), 800);
    assert.equal(Math.round(boxes[1].y), 300);
  });
});

test('CRC cards obey horizontal and vertical layout directives without overlapping', async () => {
  await withRenderer(async (page) => {
    const layouts = await page.evaluate(() => {
      const container = document.getElementById('diagram');
      return ['horizontal', 'vertical'].map((mode) => {
        window.UMLCRCDiagram.render(container, 'layout ' + mode + '\ncard Cart {\n}\ncard Catalog {\n}');
        const svg = container.querySelector('svg');
        return ['Cart', 'Catalog'].map((id) => window.UMLShared.renderedLayoutBox(svg, id));
      });
    });
    const [horizontal, vertical] = layouts;
    assert.equal(horizontal[0].y, horizontal[1].y);
    assert.ok(horizontal[0].x + horizontal[0].width < horizontal[1].x);
    assert.equal(vertical[0].x, vertical[1].x);
    assert.ok(vertical[0].y + vertical[0].height < vertical[1].y);
  });
});

test('CRC public HTML and Markdown embedding conventions all render accessible cards', async () => {
  await withRenderer(async (page) => {
    await page.evaluate(() => {
      const container = document.getElementById('diagram');
      container.innerHTML = '<pre><code class="diagram-crc">card First {\n}</code></pre>' +
        '<pre><code class="language-crc">card Second {\n}</code></pre>' +
        '<div data-uml-type="crc" data-uml-spec="card Third {&#10;}"></div>';
      window.UMLShared.renderAll();
    });
    assert.equal(await page.getByRole('img', { name: /First/ }).count(), 1);
    assert.equal(await page.getByRole('img', { name: /Second/ }).count(), 1);
    assert.equal(await page.getByRole('img', { name: /Third/ }).count(), 1);
    assert.equal(await page.locator('#diagram pre').count(), 0);
  });
});

test('CRC empty diagrams keep the editor creation surface available', async () => {
  await withRenderer(async (page) => {
    await page.evaluate(() => window.UMLCRCDiagram.render(document.getElementById('diagram'), '@startuml\n@enduml'));
    assert.match(await page.locator('#diagram').innerText(), /No CRC cards/);
    assert.equal(await page.locator('.uml-empty-msg').count(), 1);
  });
});
