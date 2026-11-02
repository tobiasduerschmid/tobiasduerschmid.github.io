const test = require('node:test');
const assert = require('node:assert/strict');

// Official OSATE result; provenance and source hashes are beside the fixture.
const { readFileSync } = require('node:fs');
const fixture = JSON.parse(readFileSync(require('node:path').join(__dirname, 'fixtures/aadl-rover-result.json'), 'utf8'));
const rover = () => structuredClone(fixture.model);
const budget = JSON.parse(readFileSync(require('node:path').join(__dirname, 'fixtures/aadl-budget-result.json'), 'utf8')).model;
const access = JSON.parse(readFileSync(require('node:path').join(__dirname, 'fixtures/aadl-access-result.json'), 'utf8')).model;

const projection = import('../../js/aadl/diagram-projection.mjs');

test('root communication preserves process boundary ports and hides its threads', async () => {
  const { projectDiagram } = await projection;
  const view = projectDiagram(rover());
  assert.deepEqual(view.nodes.map(node => node.id).sort(), [
    'Rover_single_cpu_Instance.cpu', 'Rover_single_cpu_Instance.encoder', 'Rover_single_cpu_Instance.motion', 'Rover_single_cpu_Instance.motor', 'Rover_single_cpu_Instance.operator_console',
  ]);
  assert.deepEqual(view.edges.map(edge => [edge.name, edge.source, edge.target]).sort(), [
    ['motor_command', 'Rover_single_cpu_Instance.motion.command', 'Rover_single_cpu_Instance.motor.command'],
    ['sensed_speed', 'Rover_single_cpu_Instance.encoder.measured_speed', 'Rover_single_cpu_Instance.motion.raw_speed'],
    ['target_speed', 'Rover_single_cpu_Instance.operator_console.requested_speed', 'Rover_single_cpu_Instance.motion.requested_speed'],
  ]);
});

test('opening motion retains input-to-input and output-to-output boundary forwarding', async () => {
  const { projectDiagram } = await projection;
  const view = projectDiagram(rover(), { scopeId: 'Rover_single_cpu_Instance.motion' });
  assert.deepEqual(view.nodes.map(node => node.name).sort(), ['controller_task', 'filter_task']);
  assert.deepEqual(view.boundaryFeatures.map(port => port.name).sort(), ['command', 'raw_speed', 'requested_speed']);
  assert.deepEqual(view.edges.map(edge => [edge.name, edge.source, edge.target]).sort(), [
    ['command_out', 'Rover_single_cpu_Instance.motion.controller_task.command', 'Rover_single_cpu_Instance.motion.command'],
    ['filtered', 'Rover_single_cpu_Instance.motion.filter_task.filtered_speed', 'Rover_single_cpu_Instance.motion.controller_task.measured_speed'],
    ['sample_in', 'Rover_single_cpu_Instance.motion.raw_speed', 'Rover_single_cpu_Instance.motion.filter_task.raw_speed'],
    ['target_in', 'Rover_single_cpu_Instance.motion.requested_speed', 'Rover_single_cpu_Instance.motion.controller_task.requested_speed'],
  ]);
  assert.deepEqual(view.ancestors.map(component => component.id), ['Rover_single_cpu_Instance', 'Rover_single_cpu_Instance.motion']);
});

test('deployment shows actual bound threads and the external processor without inventing process allocation', async () => {
  const { projectDiagram } = await projection;
  const view = projectDiagram(rover(), { scopeId: 'Rover_single_cpu_Instance.motion', view: 'deployment' });
  assert.deepEqual(view.nodes.map(node => node.id).sort(), ['Rover_single_cpu_Instance.cpu', 'Rover_single_cpu_Instance.motion.controller_task', 'Rover_single_cpu_Instance.motion.filter_task']);
  assert.deepEqual(view.edges.map(edge => [edge.source, edge.target, edge.kind]).sort(), [
    ['Rover_single_cpu_Instance.motion.controller_task', 'Rover_single_cpu_Instance.cpu', 'processor'],
    ['Rover_single_cpu_Instance.motion.filter_task', 'Rover_single_cpu_Instance.cpu', 'processor'],
  ]);
  assert.equal(view.nodes.find(node => node.name === 'cpu').parentId, 'Rover_single_cpu_Instance');
  assert.deepEqual(view.boundaryFeatures, []);
});

test('a shared connection segment appears once even when multiple complete connections reference it', async () => {
  const { projectDiagram } = await projection;
  const model = rover();
  model.connections.push({ ...model.connections[0], id: 'second-flow-reference' });
  assert.equal(projectDiagram(model).edges.filter(edge => edge.name === 'sensed_speed').length, 1);
});

test('unresolved visible endpoints fail visibly rather than silently losing an edge', async () => {
  const { projectDiagram } = await projection;
  const model = rover();
  model.connections[0].segments[0].target = 'missing.feature';
  assert.throws(() => projectDiagram(model), /endpoint/i);
});

test('a valid access connection retains its component endpoint and access kind', async () => {
  const { projectDiagram } = await projection;
  const view = projectDiagram(access);
  assert.deepEqual(view.edges.map(edge => [edge.source, edge.target, edge.kind]), [
    ['Top_impl_Instance.link', 'Top_impl_Instance.sensor.link', 'accessConnection'],
  ]);
});

test('views above seven components retain all table records but request a smaller visual scope', async () => {
  const { projectDiagram } = await projection;
  const model = rover();
  for (const name of ['a', 'b', 'c']) model.components.push({ id: `Rover_single_cpu_Instance.${name}`, parentId: 'Rover_single_cpu_Instance', name, category: 'device', classifier: 'Device', features: [] });
  const before = structuredClone(model);
  const view = projectDiagram(model);
  assert.equal(view.nodes.length, 8);
  assert.equal(view.tooLarge, true);
  assert.deepEqual(model, before);
});

test('feature groups are reported explicitly instead of displaying a partial port graph', async () => {
  const { projectDiagram } = await projection;
  const model = rover();
  model.components[1].features[0].features.push({ id: 'Rover_single_cpu_Instance.encoder.group.member', name: 'member', direction: 'out', kind: 'dataPort', features: [] });
  assert.throws(() => projectDiagram(model), /feature groups/i);
});

// Component integration uses the real local ELK worker and real browser DOM.
// No Jekyll build or runtime/OSATE substitute is needed for this renderer boundary.
test.describe('AADL diagram browser component', () => {
  const { chromium, expect } = require('@playwright/test');
  const { createServer } = require('node:http');
  const { readFile } = require('node:fs/promises');
  const path = require('node:path');
  let browser, server, url;

  test.before(async () => {
    const root = path.resolve(__dirname, '../..');
    server = createServer(async (request, response) => {
      if (request.url === '/') {
        response.setHeader('Content-Type', 'text/html');
        response.end('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Diagram test</title><link rel="stylesheet" href="/css/aadl-diagram.css"></head><body><main><h1>AADL diagram</h1><div id="diagram"></div></main></body></html>');
        return;
      }
      const pathname = new URL(request.url, 'http://localhost').pathname;
      if (!/^\/(js\/aadl\/|js\/vendor\/elk\/0\.12\.0\/|css\/aadl-diagram\.css$)/.test(pathname) || pathname.includes('..')) {
        response.writeHead(404).end(); return;
      }
      try {
        const content = await readFile(path.join(root, pathname));
        response.setHeader('Content-Type', pathname.endsWith('.css') ? 'text/css' : 'text/javascript');
        response.end(content);
      } catch {
        response.writeHead(404).end();
      }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true });
  });

  test.after(async () => {
    await browser?.close();
    await new Promise(resolve => server?.close(resolve));
  });

  async function mount(t, width = 1440) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    t.after(() => context.close());
    await page.goto(url);
    await page.evaluate(async () => {
      const { mountDiagram } = await import('/js/aadl/diagram.mjs');
      window.diagram = mountDiagram(document.getElementById('diagram'));
    });
    return page;
  }

  test('scope and deployment controls expose the same relationships in diagram and tables', async t => {
    const page = await mount(t);
    await page.evaluate(model => window.diagram.render(model), rover());
    await expect(page.getByRole('img', { name: /rover.*communication/i })).toBeVisible();
    await page.getByText('Model details', { exact: true }).click();
    await expect(page.getByRole('table', { name: 'Port connections' }).getByRole('row')).toHaveCount(4);
    await page.getByLabel('Current scope').selectOption('Rover_single_cpu_Instance.motion');
    await expect(page.getByRole('img', { name: /motion.*communication/i })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Port connections' }).getByRole('row')).toHaveCount(5);
    await expect(page.getByRole('table', { name: 'Boundary features' })).toContainText('raw_speed');
    await page.getByLabel('View', { exact: true }).selectOption('deployment');
    await expect(page.getByRole('img', { name: /motion.*deployment/i })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Actual bindings' }).getByRole('row')).toHaveCount(3);
    await expect(page.getByRole('table', { name: 'Actual bindings' })).toContainText('actual processor binding');
    await expect(page.getByRole('table', { name: 'Port connections' })).toHaveCount(0);
  });

  for (const width of [600, 320]) {
    test(`the complete sensor-control-actuator architecture fits a ${width}px pane at paragraph size`, async t => {
      const page = await mount(t, width);
      await page.evaluate(model => {
        document.body.style.font = '20px Arial';
        return window.diagram.render(model);
      }, budget);
      const figure = page.getByRole('img');
      await expect(figure).toBeVisible();
      const geometry = await figure.evaluate(svg => {
        const canvas = svg.parentElement;
        const labels = [...svg.querySelectorAll('text')].map(text => ({ name: text.textContent, box: text.getBoundingClientRect() }));
        const overlapping = labels.flatMap((a, index) => labels.slice(index + 1).filter(b =>
          a.box.left < b.box.right && b.box.left < a.box.right && a.box.top < b.box.bottom && b.box.top < a.box.bottom
        ).map(b => [a.name, b.name]));
        return {
          width: svg.getBoundingClientRect().width, available: canvas.clientWidth,
          names: [...svg.querySelectorAll('.aadl-diagram__node-name')].map(text => text.textContent).sort(),
          edgeCount: svg.querySelectorAll('.aadl-diagram__edge').length,
          font: parseFloat(getComputedStyle(svg.querySelector('text')).fontSize), overlapping,
        };
      });
      assert.ok(geometry.width <= geometry.available, `Diagram width ${geometry.width} exceeds pane ${geometry.available}`);
      assert.deepEqual(geometry.names, ['actuator', 'control', 'sensor']);
      assert.equal(geometry.edgeCount, 2);
      assert.ok(geometry.font >= 20);
      assert.deepEqual(geometry.overlapping, []);
    });
  }

  test('resizing the pane relayouts the current model without requesting a new engine result', async t => {
    const page = await mount(t);
    await page.evaluate(model => window.diagram.render(model), budget);
    await page.setViewportSize({ width: 320, height: 900 });
    await expect.poll(() => page.getByRole('img').evaluate(svg => svg.getBoundingClientRect().width <= svg.parentElement.clientWidth)).toBe(true);
    await expect(page.getByRole('status')).toContainText('Resolved model.');
  });

  test('a bus access link renders its component endpoint and is named as access in the equivalent table', async t => {
    const page = await mount(t, 600);
    await page.evaluate(model => window.diagram.render(model), access);
    await expect(page.getByRole('img')).toBeVisible();
    await page.getByText('Model details', { exact: true }).click();
    await expect(page.getByRole('table', { name: /connections/i })).toContainText('access connection');
    await expect(page.getByRole('table', { name: /connections/i })).toContainText('Top_impl_Instance.link');
  });

  test('editing while layout is pending never presents the result as current', async t => {
    const page = await mount(t);
    await page.evaluate(async model => {
      const pending = window.diagram.render(model);
      window.diagram.markStale();
      await pending;
    }, rover());
    await expect(page.getByRole('status')).toContainText(/source changed/i);
    await expect(page.getByRole('img')).toHaveCount(0);
  });

  test('a newer render wins over an earlier pending layout', async t => {
    const page = await mount(t);
    const latest = rover(); latest.components[0].name = 'latest_rover';
    await page.evaluate(async ({ first, latest }) => {
      await Promise.all([window.diagram.render(first), window.diagram.render(latest)]);
    }, { first: rover(), latest });
    await expect(page.getByRole('img', { name: /latest_rover.*communication/i })).toBeVisible();
    await expect(page.getByRole('img')).toHaveCount(1);
  });

  test('destroying a pending layout leaves the mount empty', async t => {
    const page = await mount(t);
    await page.evaluate(async model => {
      const pending = window.diagram.render(model);
      window.diagram.destroy();
      await pending;
    }, rover());
    await expect(page.getByRole('img')).toHaveCount(0);
    await expect(page.getByLabel('View', { exact: true })).toHaveCount(0);
  });

  test('process boundary labels remain separate from connection labels', async t => {
    const page = await mount(t);
    await page.evaluate(model => window.diagram.render(model), rover());
    await page.getByLabel('Current scope').selectOption('Rover_single_cpu_Instance.motion');
    const diagram = page.getByRole('img', { name: /motion.*communication/i });
    await expect(diagram).toBeVisible();
    const overlaps = await diagram.evaluate(svg => {
      const labels = [...svg.querySelectorAll('text')].map(node => ({ text: node.textContent, box: node.getBoundingClientRect() }));
      const overlaps = [];
      for (let i = 0; i < labels.length; i += 1) for (let j = i + 1; j < labels.length; j += 1) {
        const a = labels[i], b = labels[j];
        if (a.box.left < b.box.right && b.box.left < a.box.right && a.box.top < b.box.bottom && b.box.top < a.box.bottom) overlaps.push([a.text, b.text]);
      }
      return overlaps;
    });
    assert.deepEqual(overlaps, [], 'Every label must remain readable without another label over it');
  });

  test('narrow process views retain readable input boundary labels inside the figure', async t => {
    const page = await mount(t, 600);
    await page.evaluate(model => { document.body.style.font = '20px Arial'; return window.diagram.render(model); }, rover());
    await page.getByLabel('Current scope').selectOption('Rover_single_cpu_Instance.motion');
    const figure = page.getByRole('img', { name: /motion.*communication/i });
    await expect(figure).toBeVisible();
    const problems = await figure.evaluate(svg => {
      const bounds = svg.getBoundingClientRect();
      const labels = [...svg.querySelectorAll('.aadl-diagram__boundary-label')].map(text => ({ text: text.textContent, box: text.getBoundingClientRect() }));
      return labels.flatMap((label, index) => [
        ...(label.box.left < bounds.left || label.box.right > bounds.right || label.box.top < bounds.top || label.box.bottom > bounds.bottom ? [`Clipped ${label.text}`] : []),
        ...labels.slice(index + 1).filter(other => label.box.left < other.box.right && other.box.left < label.box.right && label.box.top < other.box.bottom && other.box.top < label.box.bottom).map(other => `Overlapping ${label.text} and ${other.text}`),
      ]);
    });
    assert.deepEqual(problems, []);
  });

  test('long containment labels stay inside their deployment component', async t => {
    const page = await mount(t);
    const model = rover();
    model.components.find(component => component.name === 'cpu').parentId = 'a_longer_rover_system_instance_name';
    await page.evaluate(model => window.diagram.render(model), model);
    await page.getByLabel('View', { exact: true }).selectOption('deployment');
    const diagram = page.getByRole('img', { name: /deployment/i });
    await expect(diagram).toBeVisible();
    const clipped = await diagram.evaluate(svg => [...svg.querySelectorAll('text')].filter(text => text.textContent.startsWith('inside ')).filter(text => {
      const label = text.getBoundingClientRect();
      const card = text.parentElement.querySelector('rect').getBoundingClientRect();
      return label.right > card.right || label.bottom > card.bottom;
    }).map(text => text.textContent));
    assert.deepEqual(clipped, [], 'Containment labels must fit their component card');
  });

  test('stale source links cannot navigate using outdated line positions', async t => {
    const page = await mount(t);
    await page.evaluate(async model => {
      window.diagram.destroy();
      const { mountDiagram } = await import('/js/aadl/diagram.mjs');
      window.diagram = mountDiagram(document.getElementById('diagram'), { onSourceLocation(location) { document.title = `${location.file}:${location.line}`; } });
      await window.diagram.render(model);
    }, rover());
    await page.getByText('Model details', { exact: true }).click();
    const source = page.getByRole('button', { name: 'Source of encoder', exact: true });
    await source.click();
    await expect(page).toHaveTitle('rover.aadl:96');
    await page.evaluate(() => window.diagram.markStale());
    await expect(source).toBeDisabled();
    await expect(page.getByRole('img')).toHaveCount(1);
    await expect(page.getByRole('status')).toContainText('Previous model');
  });

  test('clear cancels pending work and allows a fresh model to be displayed', async t => {
    const page = await mount(t);
    await page.evaluate(async model => {
      const pending = window.diagram.render(model);
      window.diagram.clear();
      await pending;
    }, rover());
    await expect(page.getByRole('img')).toHaveCount(0);
    await expect(page.getByLabel('Current scope')).toBeDisabled();
    await page.evaluate(model => window.diagram.render(model), rover());
    await expect(page.getByRole('img', { name: /rover.*communication/i })).toBeVisible();
  });

  test('an empty deployment view finishes with an explicit no-bindings message', async t => {
    const page = await mount(t);
    const model = rover(); model.bindings = [];
    await page.evaluate(model => window.diagram.render(model), model);
    await page.getByLabel('View', { exact: true }).selectOption('deployment');
    await expect(page.getByText('No actual bindings are recorded in this scope.')).toBeVisible();
    await expect(page.getByRole('status')).not.toContainText('Preparing');
  });

  test('light and dark diagrams reflow at 320px and expose readable light-print tables', async t => {
    const { default: AxeBuilder } = require('@axe-core/playwright');
    const page = await mount(t);
    await page.setViewportSize({ width: 320, height: 900 });
    await page.evaluate(() => { document.body.style.fontSize = '22px'; });
    await page.evaluate(model => window.diagram.render(model), rover());
    await page.getByText('Model details', { exact: true }).click();
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => document.documentElement.classList.toggle('dark-mode', theme === 'dark'), theme);
      const audit = await new AxeBuilder({ page }).include('#diagram').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      assert.deepEqual(audit.violations.map(issue => [issue.id, issue.nodes.map(node => node.failureSummary)]), [], `${theme} diagram must pass the automated accessibility checks`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${theme} mode must not overflow the page`);
      await expect(page.getByLabel('View', { exact: true })).toHaveCSS('font-size', '22px');
    }
    await page.getByText('Model details', { exact: true }).click();
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByRole('table', { name: 'Port connections' })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Port connections' })).toHaveCSS('color', 'rgb(23, 45, 66)');
    await expect(page.getByLabel('View', { exact: true })).not.toBeVisible();
  });
});
