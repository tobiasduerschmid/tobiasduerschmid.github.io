'use strict';

// Code, dynamic, deployment, and interfaces views are drawn by the ArchUML renderer of their notation inside the C4
// figure container; a YAML error, an unknown view, and an empty model show accessible states (spec §6.3, §6.5, §6.6,
// §7.3).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { before, after, test } = require('node:test');
const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('../chromium-launch-options');

const ARCHUML = path.join(__dirname, '../../js/ArchUML');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ARCHUML, 'c4/manifest.json'), 'utf8'));
const REFERENCE_MODEL = fs.readFileSync(path.join(ARCHUML, 'tests/c4/fixtures/course-registration.yml'), 'utf8');
// The reference model with its interfaces (spec §4.2, J13): the Registration API provides the Enrollment API, which
// the Registration Coordinator handles, and requires the Billing System's Tuition Charges.
const INTERFACES_MODEL = fs.readFileSync(path.join(ARCHUML, 'tests/c4/fixtures/course-registration-interfaces.yml'), 'utf8');
const embed = (selector, model = REFERENCE_MODEL) => `view: ${selector}\n${model}`;
const ZERO_WIDTH_SPACE = '​';

let browser;
before(async () => { browser = await chromium.launch(chromiumLaunchOptions()); });
after(async () => { if (browser) await browser.close(); });

/** A page with the ArchUML bundle and every C4 script the manifest lists, in order. */
async function withC4(run) {
  const page = await browser.newPage();
  try {
    await page.setContent('<!doctype html><html lang="en"><title>C4 delegation test</title><body><div id="diagram"></div></body></html>');
    await page.addScriptTag({ path: path.join(ARCHUML, 'uml-bundle.js') });
    for (const file of MANIFEST.core.concat(MANIFEST.render)) {
      await page.addScriptTag({ path: path.join(ARCHUML, file) });
    }
    await run(page);
  } finally {
    await page.close();
  }
}

/** Renders `text` into #diagram (as a figure container with role="img", the way the bundle builds one). */
function renderEmbed(page, text) {
  return page.evaluate((source) => {
    const container = document.getElementById('diagram');
    window.ArchUMLC4Render.render(container, source);
    return {
      className: container.className,
      childClasses: [...container.children].map((child) => child.className || child.tagName.toLowerCase()),
      innerSvgs: container.querySelectorAll('.c4-uml-view svg').length,
      allSvgs: container.querySelectorAll('svg').length,
    };
  }, text);
}

/** Every drawn text as a reader sees it: the lines of a wrapped text (its tspans) joined by a space. */
const svgTexts = (page) => page.evaluate(() => [...document.querySelectorAll('#diagram svg text')].map((text) => {
  const lines = [...text.querySelectorAll('tspan')];
  return lines.length ? lines.map((line) => line.textContent).join(' ') : text.textContent;
}));

test('the code view renders a UML class diagram with the C4 container kept outside', async () => {
  await withC4(async (page) => {
    const rendered = await renderEmbed(page, embed('code of policy'));
    assert.match(rendered.className, /\buml-c4-diagram-container\b/);
    assert.ok(rendered.childClasses.some((name) => /\bc4-uml-view\b/.test(name)), 'the UML diagram sits in an inner element');
    assert.equal(rendered.innerSvgs, 1);
    assert.equal(rendered.allSvgs, 1, 'the outer container holds no figure besides the inner one');
    assert.ok((await svgTexts(page)).includes('EnrollmentRule'));
    const arrows = await page.evaluate(() => {
      const svg = document.querySelector('#diagram .c4-uml-view svg');
      const triangle = [...svg.querySelectorAll('polygon')].filter((polygon) => polygon.points.length === 3 && polygon.getAttribute('fill') !== 'none');
      return { hollowTriangles: triangle.length, dashedLines: svg.querySelectorAll('line[stroke-dasharray]').length };
    });
    assert.equal(arrows.hollowTriangles, 1, 'one realization arrowhead joins PrerequisiteRule and UnitCapRule to EnrollmentRule');
    assert.ok(arrows.dashedLines >= 3, 'the realization is drawn dashed');
  });
});

test('the dynamic view renders a UML sequence diagram with organization boxes and an alt fragment', async () => {
  await withC4(async (page) => {
    const rendered = await renderEmbed(page, embed('dynamic enroll'));
    assert.match(rendered.className, /\buml-c4-diagram-container\b/);
    assert.equal(rendered.innerSvgs, 1);
    const texts = await svgTexts(page);
    for (const expected of ['Course Registration', 'Registration API', 'ALT', '[eligible]', '[not eligible]',
      'web: Planner Web App', 'coordinator: Registration Coordinator', 'submits the plan to [JSON/HTTPS]']) {
      assert.ok(texts.includes(expected), `${expected} is drawn; drawn: ${JSON.stringify(texts)}`);
    }
    assert.equal(texts.filter((text) => /^\w+: /.test(text)).length, 5, 'five lifelines');
  });
});

test('the deployment view renders nested nodes with container instances', async () => {
  await withC4(async (page) => {
    await renderEmbed(page, embed('deployment production'));
    const geometry = await page.evaluate(() => {
      const boxes = {};
      for (const group of document.querySelectorAll('#diagram svg g[data-layout-id]')) {
        const rect = group.querySelector('rect[data-layout-bounds-id]');
        boxes[group.getAttribute('data-layout-id')] = { x: +rect.getAttribute('x'), y: +rect.getAttribute('y'), width: +rect.getAttribute('width'), height: +rect.getAttribute('height') };
      }
      return { boxes, texts: [...document.querySelectorAll('#diagram svg text')].map((text) => text.textContent) };
    });
    const inside = (inner, outer) => inner.x > outer.x && inner.y > outer.y &&
      inner.x + inner.width < outer.x + outer.width && inner.y + inner.height < outer.y + outer.height;
    const { boxes } = geometry;
    assert.ok(inside(boxes.api, boxes.api_pod) && inside(boxes.api_pod, boxes.campus_cloud), 'the API container sits in the API pod in the Campus cloud');
    assert.ok(inside(boxes.web, boxes.browser) && inside(boxes.browser, boxes.laptop), 'the web container sits in the browser on the laptop');
    assert.ok(geometry.texts.includes('API pod ×3'), 'the instance count is part of the node name');
    assert.equal(geometry.texts.filter((text) => text === '«container»').length, 3);
    assert.ok(geometry.texts.includes('«software system»'));
  });
});

test('deployment link labels stay beside their links', async () => {
  await withC4(async (page) => {
    await renderEmbed(page, embed('deployment production'));
    const placements = await page.evaluate(() => {
      const svg = document.querySelector('#diagram svg');
      const distance = (rect, points) => Math.min(...points.slice(1).map((point, index) => {
        const a = points[index];
        const dx = Math.max(0, rect.x - Math.max(a.x, point.x), Math.min(a.x, point.x) - (rect.x + rect.width));
        const dy = Math.max(0, rect.y - Math.max(a.y, point.y), Math.min(a.y, point.y) - (rect.y + rect.height));
        return Math.hypot(dx, dy);
      }));
      const routes = [...svg.querySelectorAll('polyline[data-layout-route-id]')].map((line) =>
        ({ source: line.getAttribute('data-layout-source'), target: line.getAttribute('data-layout-target'), points: [...line.points].map((p) => ({ x: p.x, y: p.y })) }));
      return [...svg.querySelectorAll('text[font-style="italic"]')].map((text) => {
        const box = text.getBBox();
        return { text: text.textContent, nearest: Math.min(...routes.map((route) => distance(box, route.points))) };
      });
    });
    assert.deepEqual(placements.map((placement) => placement.text).sort(),
      ['AMQP', 'JSON/HTTPS', 'SQL/TCP', 'forwards HTTPS requests to'], 'each path is labelled once, by its technology when it has one');
    for (const placement of placements) {
      assert.ok(placement.nearest <= 30, `"${placement.text}" sits beside a link (${Math.round(placement.nearest)} px away)`);
    }
  });
});

test('the text alternative of a deployment view keeps the descriptions that the drawing leaves out', async () => {
  await withC4(async (page) => {
    const items = await page.evaluate((model) => {
      const core = window.ArchUMLC4;
      return core.describe(core.project(core.load(model), 'deployment production')).sections.flatMap((section) => section.items);
    }, REFERENCE_MODEL);
    assert.ok(items.some((item) => item.includes('submits plans to')), JSON.stringify(items));
  });
});

test('YAML errors, unknown selectors, and empty models render accessible states', async () => {
  const cases = [
    {
      name: 'YAML error',
      text: 'schema: c4-design/1\nsystems: [unclosed\nother: 1\n',
      kind: 'yaml-error', messageClass: 'uml-error-msg',
      message: /^This diagram's source has a YAML error on line \d+\.$/,
    },
    {
      name: 'unknown selector',
      text: embed('containers of nowhere'),
      kind: 'unknown-view', messageClass: 'uml-error-msg',
      message: /“containers of nowhere”.*Valid views: landscape, context of registration, containers of registration, components of api, code of policy, dynamic enroll, deployment production\.$/,
    },
    {
      name: 'empty model',
      text: 'schema: c4-design/1\n',
      kind: 'empty-model', messageClass: 'uml-empty-msg',
      message: /^This model has no people or systems yet\.$/,
    },
  ];
  await withC4(async (page) => {
    for (const { name, text, kind, messageClass, message } of cases) {
      const state = await page.evaluate((source) => {
        const container = document.getElementById('diagram');
        window.ArchUMLC4Render.render(container, source);
        const shown = container.querySelector('[class*="-msg"]');
        return {
          className: container.className, role: container.getAttribute('role'), label: container.getAttribute('aria-label'),
          kind: container.getAttribute('data-c4-state'), messageClass: shown && shown.className, messageText: shown && shown.textContent,
          svgs: container.querySelectorAll('svg').length,
        };
      }, text);
      assert.match(state.className, /\buml-c4-diagram-container\b/, name);
      assert.equal(state.kind, kind, name);
      assert.equal(state.role, 'img', name);
      assert.equal(state.messageClass, messageClass, name);
      assert.match(state.messageText, message, name);
      assert.equal(state.label, state.messageText, `${name}: the accessible name is the message`);
      assert.equal(state.svgs, 0, name);
    }
  });
});

test('the YAML error state names the line of the first error', async () => {
  await withC4(async (page) => {
    await renderEmbed(page, 'schema: c4-design/1\nsystems:\n  a: [broken\nnext: 1\n');
    const label = await page.evaluate(() => document.getElementById('diagram').getAttribute('aria-label'));
    const line = Number(/line (\d+)/.exec(label)[1]);
    assert.ok(line >= 3 && line <= 4, `the error is on line 3 or 4, got ${line}`);
  });
});

test('names containing --> and } cannot inject UML statements', async () => {
  const hostile = REFERENCE_MODEL
    .replace('name: Registration Coordinator', 'name: "Coordinator --> Seat Gateway } @enduml"')
    .replaceAll('asks for an eligibility decision from', 'asks --> for } a decision from');
  await withC4(async (page) => {
    const plain = await renderEmbed(page, embed('dynamic enroll'));
    const plainParticipants = (await svgTexts(page)).filter((text) => /^\w+: /.test(text)).length;
    await renderEmbed(page, embed('dynamic enroll', hostile));
    const texts = await svgTexts(page);
    const readable = texts.map((text) => text.replaceAll(ZERO_WIDTH_SPACE, '').replaceAll('｛', '{').replaceAll('｝', '}'));
    assert.equal(plain.innerSvgs, 1);
    assert.equal(texts.filter((text) => /^\w+: /.test(text)).length, plainParticipants, 'the participant count is unchanged');
    assert.ok(readable.includes('coordinator: Coordinator --> Seat Gateway } @enduml'), JSON.stringify(readable));
    assert.ok(readable.includes('asks --> for } a decision from'), JSON.stringify(readable));
    assert.equal(await page.evaluate(() => document.querySelectorAll('#diagram svg g[data-layout-id], #diagram svg rect').length > 0), true);
  });
});

test('every figure and state carries its source as inert JSON that round-trips', async () => {
  const hostile = '# note: </script><img src=x onerror=alert(1)>\n' + embed('code of policy');
  await withC4(async (page) => {
    for (const text of [hostile, embed('containers of registration'), 'schema: c4-design/1\nsystems: [x\n', 'schema: c4-design/1\n']) {
      const carried = await page.evaluate((source) => {
        const container = document.getElementById('diagram');
        window.ArchUMLC4Render.render(container, source);
        const scripts = container.querySelectorAll('script[type="application/json"][data-c4-source]');
        return { count: scripts.length, raw: scripts[0].textContent, injected: container.querySelectorAll('img').length };
      }, text);
      assert.equal(carried.count, 1);
      assert.ok(!carried.raw.includes('<'), 'the JSON holds no raw <');
      assert.equal(JSON.parse(carried.raw), text);
      assert.equal(carried.injected, 0);
    }
  });
});

test('diagnostics appear only in an embed that opts in, outside the image where assistive technology reads them', async () => {
  const flawed = 'schema: c4-design/1\nsystems:\n  shop:\n    name: Shop\n';
  await withC4(async (page) => {
    // One figure, re-rendered with each text in turn, as a live editor or a theme change re-renders it.
    await page.evaluate(() => {
      document.body.innerHTML = '<figure><div id="diagram" role="img"></div><figcaption>Shop</figcaption></figure>';
    });
    const listed = (source) => page.evaluate((text) => {
      const container = document.getElementById('diagram');
      window.ArchUMLC4Render.render(container, text);
      const figure = container.closest('figure');
      return {
        items: [...figure.querySelectorAll('.c4-diagnostics li')].map((item) => item.textContent),
        insideImage: container.querySelectorAll('.c4-diagnostics').length,
        lists: figure.querySelectorAll('.c4-diagnostics').length,
      };
    }, source);
    assert.deepEqual((await listed(flawed)).items, []);
    const opted = await listed('# diagnostics: true\n' + flawed);
    assert.ok(opted.items.includes('warning: Shop (shop) has no description and no responsibilities, so its box would be empty (line 4)'), JSON.stringify(opted.items));
    assert.equal(opted.insideImage, 0, 'a list inside role="img" would be presentational');
    assert.equal((await listed('# diagnostics: true\n' + flawed)).lists, 1, 'a re-render replaces the list');
    assert.equal((await listed(flawed)).lists, 0, 'a re-render without the directive removes the list');
  });
});

test('a re-render of a container that showed a state reports no stale state', async () => {
  await withC4(async (page) => {
    const stateAfter = (source) => page.evaluate((text) => {
      const container = document.getElementById('diagram');
      window.ArchUMLC4Render.render(container, text);
      return container.getAttribute('data-c4-state');
    }, source);
    assert.equal(await stateAfter('schema: c4-design/1\nsystems: [x\n'), 'yaml-error');
    assert.equal(await stateAfter(embed('containers of registration')), null);
  });
});

// ---- Interfaces views (spec §5.3, §6.6) ------------------------------------------------------------------------

const LEGEND = (scopeName) => 'Ball: an interface the element provides. Socket: an interface it requires. Ball in socket: '
  + `the consumer uses that interface. The subject of this view is ${scopeName}.`;
const DRAWING = '<drawing>';

/**
 * Renders `text` into #diagram and returns what the figure shows from top to bottom: each text paragraph of the C4
 * container outside the drawing, and `DRAWING` where the drawing sits; plus the drawing's texts and its connector
 * labels (whitespace folded), and how many drawings the container holds and where.
 */
function renderInterfacesView(page, text) {
  return page.evaluate(({ source, drawing }) => {
    const container = document.getElementById('diagram');
    window.ArchUMLC4Render.render(container, source);
    const fold = (node) => node.textContent.replace(/\s+/g, ' ').trim();
    const svg = container.querySelector('svg');
    return {
      className: container.className,
      shown: [...container.querySelectorAll('p, svg')].filter((element) => !element.parentElement.closest('svg'))
        .map((element) => (element.tagName.toLowerCase() === 'svg' ? drawing : fold(element))),
      drawingTexts: svg ? [...svg.querySelectorAll('text')].map(fold) : [],
      connectorLabels: svg ? [...svg.querySelectorAll('text.uml-component-connector-label')].map(fold).sort() : [],
      innerSvgs: container.querySelectorAll('.c4-uml-view svg').length,
      allSvgs: container.querySelectorAll('svg').length,
      images: container.querySelectorAll('img').length,
    };
  }, { source: text, drawing: DRAWING });
}

test('the interfaces view renders a UML component diagram inside the C4 container with title, legend, and notes', async () => {
  await withC4(async (page) => {
    const api = await renderInterfacesView(page, embed('interfaces of api', INTERFACES_MODEL));
    assert.match(api.className, /\buml-c4-diagram-container\b/, 'the outer element stays the C4 container');
    assert.equal(api.innerSvgs, 1, 'the component diagram sits in the inner element');
    assert.equal(api.allSvgs, 1, 'the container holds no other drawing');
    assert.deepEqual(api.shown, ['Interface view: Registration API', DRAWING, LEGEND('Registration API')]);
    for (const expected of ['Planner Web App', 'Registration API', 'Billing System', 'Enrollment API', 'Tuition Charges']) {
      assert.ok(api.drawingTexts.includes(expected), `${expected} is drawn; drawn: ${JSON.stringify(api.drawingTexts)}`);
    }
    assert.ok(api.drawingTexts.some((text) => text.includes('Container: Python, FastAPI')), 'the scope box states its C4 type');
    assert.deepEqual(api.connectorLabels,
      ['Enrollment API', 'POST /v1/enrollments', 'Tuition Charges', 'send ChargeRequested to the queue billing.charges'],
      'two assembly connectors, each labelled with its interface and the operation it uses');

    const coordinator = await renderInterfacesView(page, embed('interfaces of coordinator', INTERFACES_MODEL));
    assert.deepEqual(coordinator.shown, ['Interface view: Registration Coordinator', DRAWING, LEGEND('Registration Coordinator'),
      'Enrollment API belongs to Registration API; Registration Coordinator handles its calls.']);
  });
});

test('an element without interfaces shows the empty-state text', async () => {
  await withC4(async (page) => {
    const db = await renderInterfacesView(page, embed('interfaces of db', INTERFACES_MODEL));
    assert.deepEqual(db.shown, ['Interface view: Registration Database', DRAWING,
      'Registration Database provides and uses no described interfaces yet.'], 'the empty-state text replaces the legend');
    assert.ok(db.drawingTexts.includes('Registration Database'), 'the element is drawn alone');
    assert.deepEqual(db.connectorLabels, []);
  });
});

test("the interfaces view's legend line and notes are the legend and notes of the core description", async () => {
  await withC4(async (page) => {
    for (const selector of ['interfaces of api', 'interfaces of coordinator', 'interfaces of db']) {
      const text = embed(selector, INTERFACES_MODEL);
      const described = await page.evaluate((source) => {
        const core = window.ArchUMLC4;
        const { sections } = core.describe(core.project(core.load(source), core.extractEmbed(source).selector));
        return sections.filter((section) => ['Legend', 'Notes'].includes(section.heading)).flatMap((section) => section.items);
      }, text);
      const { shown } = await renderInterfacesView(page, text);
      assert.deepEqual(shown.slice(shown.indexOf(DRAWING) + 1), described, selector);
    }
  });
});

test('names in the title and the notes of an interfaces view are text, never markup', async () => {
  const hostile = INTERFACES_MODEL.replace('name: Registration Coordinator', 'name: "<img src=x onerror=alert(1)> Coordinator"');
  assert.notEqual(hostile, INTERFACES_MODEL);
  await withC4(async (page) => {
    const view = await renderInterfacesView(page, embed('interfaces of coordinator', hostile));
    assert.equal(view.images, 0);
    assert.equal(view.shown[0], 'Interface view: <img src=x onerror=alert(1)> Coordinator');
    assert.equal(view.shown[3], 'Enrollment API belongs to Registration API; <img src=x onerror=alert(1)> Coordinator handles its calls.');
  });
});

test('the reference deployment view routes the browser through the ingress', async () => {
  await withC4(async (page) => {
    await renderEmbed(page, embed('deployment production', INTERFACES_MODEL));
    const paths = await page.evaluate(() => [...document.querySelectorAll('#diagram svg polyline[data-layout-route-id]')]
      .map((line) => `${line.getAttribute('data-layout-source')} -> ${line.getAttribute('data-layout-target')}`));
    assert.ok(paths.includes('browser -> ingress'), JSON.stringify(paths));
    assert.ok(paths.includes('ingress -> api_pod'), JSON.stringify(paths));
    const fromBrowser = paths.filter((pair) => /^(browser|web) -> /.test(pair));
    assert.deepEqual(fromBrowser, ['browser -> ingress'], 'no path leads from the browser straight to the API pod or its container');
  });
});
