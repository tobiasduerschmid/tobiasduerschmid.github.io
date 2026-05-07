// @ts-check
const fs = require('fs');
const { webcrypto } = require('crypto');
const { test, expect } = require('@playwright/test');

const PLAYGROUND_URL = '/SEBook/tools/uml-playground';
const UML_EDITOR_URL = '/SEBook/tools/uml-editor';
const MONOPOLY_TUTORIAL_URL = '/SEBook/designpatterns/monopoly-state-pattern-uml-homework';

// Tutorials namespace their UML drafts so the global UML playground autosave
// can't bleed into them. Key shape matches the storage_key parameter that
// _layouts/tutorial.html passes into the uml-editor include.
const MONOPOLY_TUTORIAL_SLUG = 'monopoly-state-pattern-uml';
function tutorialAutosaveKey(diagramType) {
  return 'uml-pg-autosave-' + MONOPOLY_TUTORIAL_SLUG + '-' + diagramType;
}

const NODE_EDIT_TYPES = [
  'class',
  'sequence',
  'state',
  'component',
  'deployment',
  'usecase',
  'activity',
  'er',
  'venn',
  'gitgraph',
];

const ROUTE_EDIT_TYPES = [
  'class',
  'sequence',
  'state',
  'component',
  'deployment',
  'usecase',
  'activity',
  'er',
  'gitgraph',
];

const CUSTOM_POSITION_CLASS_DIAGRAM = `@startuml
layout square
abstract class Animal @pos(-20, 30) { +name: str; +{abstract} speak(): str }
class Dog @pos(217, 228) { +breed: str; +speak(): str }
class Cat @pos(30, 228) { +indoor: bool; +speak(): str }
interface Trainable @pos(216, 30) { +train(cmd: str): bool }
Dog --|> Animal
Cat --|> Animal
Dog ..|> Trainable
@enduml`;

const MONOPOLY_CLASS_ROLE_VARIATION_DIAGRAM = `@startuml
class Player { +do_turn(); +change_state(state: PlayerState); }
interface PlayerState { +do_turn(player: Player); }
class NormalMode { +do_turn(player: Player); }
class PrisonState { +do_turn(player: Player); }
class BankruptcyMode { +do_turn(player: Player); }
PlayerState --o Player : currentState
PlayerState <|.. NormalMode
PlayerState <|.. PrisonState
PlayerState <|.. BankruptcyMode
@enduml`;

async function openPlayground(page) {
  await page.goto(PLAYGROUND_URL);
  await page.waitForSelector('#uml-pg-output svg');
  await page.check('#uml-pg-edit');
}

async function selectDiagram(page, type) {
  await page.selectOption('#uml-pg-type', type);
  await page.waitForSelector('#uml-pg-output svg');
}

async function selectEditMode(page, mode) {
  const modeSelect = page.locator('#uml-pg-edit-mode');
  if (await modeSelect.count()) {
    await modeSelect.selectOption(mode);
  }
}

async function openMonopolyTutorialStep(page, stepIndex, classSource = MONOPOLY_CLASS_ROLE_VARIATION_DIAGRAM) {
  await page.goto(MONOPOLY_TUTORIAL_URL);
  await page.waitForSelector('#uml-pg-output');
  await page.evaluate(({ index, source, classKey, stateKey, sequenceKey }) => {
    localStorage.removeItem(stateKey);
    localStorage.removeItem(sequenceKey);
    localStorage.setItem(classKey, source);
    const textarea = document.getElementById('uml-pg-input');
    if (textarea) textarea.value = source;
    window._tutorial._stepsUnlocked.add(index);
    window._tutorial.loadStep(index);
    localStorage.setItem(classKey, source);
  }, {
    index: stepIndex,
    source: classSource,
    classKey: tutorialAutosaveKey('class'),
    stateKey: tutorialAutosaveKey('state'),
    sequenceKey: tutorialAutosaveKey('sequence'),
  });
}

async function setUmlSource(page, source) {
  await page.locator('#uml-pg-input').evaluate((el, value) => {
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, source);
}

async function openGeneratedPythonWorkspace(page) {
  const popupPromise = page.waitForEvent('popup');
  await page.locator('#uml-pg-generate-python').click();
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');
  await popup.waitForFunction(() => Boolean(window.__archUmlGeneratedPythonCode), null, { timeout: 30000 });
  const pythonText = await popup.evaluate(() => window.__archUmlGeneratedPythonCode);
  return { popup, pythonText };
}

async function expectTutorHint(page, text) {
  const panel = page.locator('.tvm-tutor-chat');
  await expect(panel).toBeVisible();
  const header = panel.getByRole('button', { name: 'Hints', exact: true });
  if (await panel.evaluate((el) => el.classList.contains('collapsed'))) {
    await header.click();
  }
  await expect(panel.locator('.tvm-tutor-hint').filter({ hasText: text })).toBeVisible();
}

async function dragLocatorCenter(page, locator, dx, dy) {
  await expect(locator).toHaveCount(1, { timeout: 2_000 });
  await locator.evaluate((el) => el.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
  await expect
    .poll(() => locator.boundingBox(), {
      timeout: 2_000,
      message: 'drag target should have a bounding box',
    })
    .not.toBeNull();
  const box = await locator.boundingBox();
  if (!box) throw new Error('drag target should have a bounding box');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + dx, cy + dy, { steps: 6 });
  await page.mouse.up();
}

async function previewPointOutsideSvg(page) {
  return page.evaluate(() => {
    const preview = document.querySelector('#uml-pg-preview-pane').getBoundingClientRect();
    const svg = document.querySelector('#uml-pg-output svg')?.getBoundingClientRect();
    const pad = 28;
    const candidates = [
      { x: preview.right - pad, y: preview.top + pad },
      { x: preview.left + pad, y: preview.top + pad },
      { x: preview.right - pad, y: preview.bottom - pad },
      { x: preview.left + pad, y: preview.bottom - pad },
    ];
    const visibleCandidates = candidates.filter((pt) =>
      pt.x >= 0 && pt.x <= window.innerWidth && pt.y >= 0 && pt.y <= window.innerHeight
    );
    const usableCandidates = visibleCandidates.length ? visibleCandidates : candidates;
    if (!svg) return candidates[0];
    return usableCandidates.find((pt) =>
      pt.x < svg.left || pt.x > svg.right || pt.y < svg.top || pt.y > svg.bottom
    ) || { x: preview.left + preview.width / 2, y: preview.top + preview.height / 2 };
  });
}

async function previewBlankPoint(page) {
  return page.evaluate(() => {
    const preview = document.querySelector('#uml-pg-preview-pane').getBoundingClientRect();
    const pad = 36;
    const candidates = [
      { x: preview.right - pad, y: preview.top + pad },
      { x: preview.left + pad, y: preview.top + pad },
      { x: preview.right - pad, y: preview.bottom - pad },
      { x: preview.left + pad, y: preview.bottom - pad },
      { x: preview.left + preview.width / 2, y: preview.top + preview.height / 2 },
    ].filter((pt) => pt.x >= 0 && pt.x <= window.innerWidth && pt.y >= 0 && pt.y <= window.innerHeight);
    const blocked = Array.from(document.querySelectorAll('.uml-pg-edit-hitbox, .uml-pg-edit-a11y-target'))
      .map((el) => el.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);
    return candidates.find((pt) => !blocked.some((rect) =>
      pt.x >= rect.left && pt.x <= rect.right && pt.y >= rect.top && pt.y <= rect.bottom
    )) || { x: preview.left + pad, y: preview.top + pad };
  });
}

function parseSvgViewBox(svgText) {
  const match = svgText.match(/\bviewBox="([^"]+)"/);
  if (!match) throw new Error('downloaded SVG should include a viewBox');
  const parts = match[1].trim().split(/[\s,]+/).map(Number);
  if (parts.length < 4 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error(`invalid SVG viewBox: ${match[1]}`);
  }
  return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
}

async function decryptUmlPayload(payloadText, password) {
  const payload = JSON.parse(payloadText);
  const encoder = new TextEncoder();
  const keyMaterial = await webcrypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const key = await webcrypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: Buffer.from(payload.crypto.salt, 'base64'),
      iterations: payload.crypto.iterations,
      hash: payload.crypto.hash,
    },
    keyMaterial,
    { name: payload.crypto.algorithm, length: payload.crypto.keyLength },
    false,
    ['decrypt'],
  );
  const plaintext = await webcrypto.subtle.decrypt(
    { name: payload.crypto.algorithm, iv: Buffer.from(payload.crypto.iv, 'base64') },
    key,
    Buffer.from(payload.ciphertext, 'base64'),
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}

async function currentLayoutMetadata(page) {
  const source = await page.locator('#uml-pg-input').inputValue();
  return page.evaluate((text) => window.UMLShared.extractLayoutMetadata(text).layout, source);
}

async function gitRouteEndpointFor(page, id) {
  return page.evaluate((commitId) => {
    const svg = document.querySelector('#uml-pg-output svg');
    const routes = window.UMLShared.collectEditableRoutes(svg);
    const route = routes.find((item) => item.source === commitId || item.target === commitId);
    if (!route) return null;
    const endpointIndex = route.source === commitId ? 0 : route.points.length - 1;
    const endpoint = route.points[endpointIndex];
    return {
      source: route.source,
      target: route.target,
      endpoint: { x: endpoint.x, y: endpoint.y },
      d: route.element.getAttribute('d'),
    };
  }, id);
}

async function routeInfoFor(page, routeId) {
  return page.evaluate((id) => {
    const svg = document.querySelector('#uml-pg-output svg');
    const routes = window.UMLShared.collectEditableRoutes(svg);
    const route = routes.find((item) => item.id === id);
    if (!route) return null;
    return {
      id: route.id,
      points: route.points.map((p) => ({ x: p.x, y: p.y })),
      d: route.element.getAttribute('d'),
      tag: route.element.tagName.toLowerCase(),
    };
  }, routeId);
}

async function statePseudoRouteFor(page) {
  return page.evaluate(() => {
    const svg = document.querySelector('#uml-pg-output svg');
    const routes = window.UMLShared.collectEditableRoutes(svg);
    const circles = Array.from(svg.querySelectorAll('circle'))
      .filter((el) => !el.closest('defs') && !el.closest('.uml-pg-edit-layer'))
      .map((el) => {
        const b = el.getBBox();
        return {
          x: b.x + b.width / 2,
          y: b.y + b.height / 2,
          r: Math.max(b.width, b.height) / 2,
        };
      })
      .filter((c) => c.r <= 14);

    function touchesPseudo(point) {
      return circles.some((c) => Math.hypot(point.x - c.x, point.y - c.y) <= c.r + 18);
    }

    for (const route of routes) {
      const first = route.points[0];
      const last = route.points[route.points.length - 1];
      const hasHandle = !!svg.querySelector(`.uml-pg-edge-hitbox[data-layout-id="${route.id}"]`);
      if (hasHandle && (touchesPseudo(first) || touchesPseudo(last))) {
        return {
          id: route.id,
          points: route.points.map((p) => ({ x: p.x, y: p.y })),
        };
      }
    }
    return null;
  });
}

async function stateRegularRouteFor(page) {
  return page.evaluate(() => {
    const svg = document.querySelector('#uml-pg-output svg');
    const routes = window.UMLShared.collectEditableRoutes(svg);
    const circles = Array.from(svg.querySelectorAll('circle'))
      .filter((el) => !el.closest('defs') && !el.closest('.uml-pg-edit-layer'))
      .map((el) => {
        const b = el.getBBox();
        return {
          x: b.x + b.width / 2,
          y: b.y + b.height / 2,
          r: Math.max(b.width, b.height) / 2,
        };
      })
      .filter((c) => c.r <= 14);

    function touchesPseudo(point) {
      return circles.some((c) => Math.hypot(point.x - c.x, point.y - c.y) <= c.r + 18);
    }

    for (const route of routes) {
      const first = route.points[0];
      const last = route.points[route.points.length - 1];
      const hasHandle = !!svg.querySelector(`.uml-pg-edge-hitbox[data-layout-id="${route.id}"]`);
      if (hasHandle && !touchesPseudo(first) && !touchesPseudo(last)) {
        return {
          id: route.id,
          points: route.points.map((p) => ({ x: p.x, y: p.y })),
        };
      }
    }
    return null;
  });
}

async function nodeHitboxBox(page, id) {
  return page.evaluate((layoutId) => {
    const el = document.querySelector(`.uml-pg-edit-hitbox[data-layout-id="${layoutId}"]`);
    if (!el) return null;
    const b = el.getBBox();
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  }, id);
}

async function renderedLayoutBox(page, id) {
  return page.evaluate((layoutId) => {
    const svg = document.querySelector('#uml-pg-output svg');
    if (!svg) return null;
    let parts = Array.from(svg.querySelectorAll('[data-layout-bounds-id]'))
      .filter((el) => {
        if (el.closest('defs') || el.closest('.uml-pg-edit-layer')) return false;
        return el.getAttribute('data-layout-bounds-id') === layoutId;
      });
    if (!parts.length) {
      parts = Array.from(svg.querySelectorAll('[data-layout-id]')).filter((el) => {
        if (el.closest('defs') || el.closest('.uml-pg-edit-layer')) return false;
        return el.getAttribute('data-layout-id') === layoutId;
      });
    }
    if (!parts.length) return null;

    function svgBox(el) {
      const rect = el.getBoundingClientRect();
      const pt1 = svg.createSVGPoint();
      pt1.x = rect.left;
      pt1.y = rect.top;
      const pt2 = svg.createSVGPoint();
      pt2.x = rect.right;
      pt2.y = rect.bottom;
      const ctm = svg.getScreenCTM().inverse();
      const a = pt1.matrixTransform(ctm);
      const b = pt2.matrixTransform(ctm);
      return {
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        width: Math.abs(a.x - b.x),
        height: Math.abs(a.y - b.y),
      };
    }

    return parts.map(svgBox).reduce((box, next) => {
      if (!box) return next;
      const x1 = Math.min(box.x, next.x);
      const y1 = Math.min(box.y, next.y);
      const x2 = Math.max(box.x + box.width, next.x + next.width);
      const y2 = Math.max(box.y + box.height, next.y + next.height);
      return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
    }, null);
  }, id);
}

async function componentConnectionInfo(page, sourceId = 'Frontend.f_out', targetId = 'Backend.b_in') {
  return page.evaluate(({ sourceId, targetId }) => {
    const svg = document.querySelector('#uml-pg-output svg');
    const routes = window.UMLShared.collectEditableRoutes(svg);
    const route = routes.find((item) => item.source === sourceId && item.target === targetId);

    function union(a, b) {
      if (!a) return b;
      const x1 = Math.min(a.x, b.x);
      const y1 = Math.min(a.y, b.y);
      const x2 = Math.max(a.x + a.width, b.x + b.width);
      const y2 = Math.max(a.y + a.height, b.y + b.height);
      return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
    }

    function dataBox(id, tagFilter) {
      let box = null;
      let side = null;
      for (const el of Array.from(svg.querySelectorAll('[data-layout-id]'))) {
        if (el.closest('defs') || el.closest('.uml-pg-edit-layer')) continue;
        if (el.getAttribute('data-layout-id') !== id) continue;
        if (tagFilter && !tagFilter(el)) continue;
        const b = el.getBBox();
        box = union(box, { x: b.x, y: b.y, width: b.width, height: b.height });
        side = el.getAttribute('data-port-side') || side;
      }
      if (!box) return null;
      return {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        cx: box.x + box.width / 2,
        cy: box.y + box.height / 2,
        side,
      };
    }

    if (!route) return null;
    const points = route.points.map((p) => ({ x: p.x, y: p.y }));
    return {
      source: route.source,
      target: route.target,
      points,
      sourceEndpoint: points[0],
      targetEndpoint: points[points.length - 1],
      sourcePort: dataBox(sourceId, (el) => el.tagName.toLowerCase() === 'rect'),
      targetPort: dataBox(targetId, (el) => el.tagName.toLowerCase() === 'rect'),
      sourceComponent: dataBox(sourceId.split('.')[0], (el) => el.classList.contains('uml-component-box')),
      targetComponent: dataBox(targetId.split('.')[0], (el) => el.classList.contains('uml-component-box')),
    };
  }, { sourceId, targetId });
}

async function componentPortInfo(page, id) {
  return page.evaluate((layoutId) => {
    const svg = document.querySelector('#uml-pg-output svg');
    const [componentId] = layoutId.split('.');

    function union(a, b) {
      if (!a) return b;
      const x1 = Math.min(a.x, b.x);
      const y1 = Math.min(a.y, b.y);
      const x2 = Math.max(a.x + a.width, b.x + b.width);
      const y2 = Math.max(a.y + a.height, b.y + b.height);
      return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
    }

    function dataBox(id, tagFilter) {
      let box = null;
      let side = null;
      for (const el of Array.from(svg.querySelectorAll('[data-layout-id]'))) {
        if (el.closest('defs') || el.closest('.uml-pg-edit-layer')) continue;
        if (el.getAttribute('data-layout-id') !== id) continue;
        if (tagFilter && !tagFilter(el)) continue;
        const b = el.getBBox();
        box = union(box, { x: b.x, y: b.y, width: b.width, height: b.height });
        side = el.getAttribute('data-port-side') || side;
      }
      if (!box) return null;
      return {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        cx: box.x + box.width / 2,
        cy: box.y + box.height / 2,
        side,
      };
    }

    const port = dataBox(layoutId, (el) => el.tagName.toLowerCase() === 'rect');
    const component = dataBox(componentId, (el) => el.classList.contains('uml-component-box'));
    return port && component ? { ...port, component } : null;
  }, id);
}

async function componentLabelInfo(page, id = 'label:edge-0') {
  return page.evaluate((layoutId) => {
    const svg = document.querySelector('#uml-pg-output svg');
    const label = svg.querySelector(`[data-layout-kind="edge-label"][data-layout-id="${layoutId}"]`);
    if (!label) return null;
    const b = label.getBBox();
    return {
      id: layoutId,
      text: label.textContent.replace(/\s+/g, ' ').trim(),
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
      cx: b.x + b.width / 2,
      cy: b.y + b.height / 2,
    };
  }, id);
}

function expectEndpointTouchesPort(endpoint, port) {
  expect(endpoint.x).toBeGreaterThanOrEqual(port.x - 2);
  expect(endpoint.x).toBeLessThanOrEqual(port.x + port.width + 2);
  expect(endpoint.y).toBeGreaterThanOrEqual(port.y - 2);
  expect(endpoint.y).toBeLessThanOrEqual(port.y + port.height + 2);
}

test.describe('ArchUML visual layout metadata', () => {
  test('parses and strips node and edge overrides without disturbing diagram code', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!window.UMLShared);

    const result = await page.evaluate(() => {
      const src = `@startuml
@layout schema=2 renderer="archuml-visual-editor"
node "Animal" x=120 y=80
edge "edge-0" points="10,20 30,20 30,60"
@endlayout
abstract class Animal @pos(120, 80) {
  +name: str
}
class Dog @pos(320, 140)
Dog --|> Animal
@enduml`;

      const extracted = window.UMLShared.extractLayoutMetadata(src);
      return {
        text: extracted.text,
        schema: extracted.layout.schema,
        renderer: extracted.layout.renderer,
        animal: extracted.layout.positions.Animal,
        dog: extracted.layout.positions.Dog,
        route: extracted.layout.routes['edge-0'],
      };
    });
    expect(result.text).not.toContain('@layout');
    expect(result.text).not.toContain('@pos');
    expect(result.text).toContain('abstract class Animal {');
    expect(result.schema).toBe(2);
    expect(result.renderer).toBe('archuml-visual-editor');
    expect(result.animal).toEqual({ x: 120, y: 80 });
    expect(result.dog).toEqual({ x: 320, y: 140 });
    expect(result.route.points).toEqual([
      { x: 10, y: 20 },
      { x: 30, y: 20 },
      { x: 30, y: 60 },
    ]);
  });

  test('normal renderers replay saved edge routes', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!window.UMLClassDiagram && !!window.UMLShared);

    const points = await page.evaluate(() => {
      const host = document.createElement('div');
      host.style.width = '900px';
      document.body.appendChild(host);

      window.UMLClassDiagram.render(host, `@startuml
@layout schema=1 renderer="archuml-visual-editor"
edge "edge-0" points="44,44 144,44 144,104"
@endlayout
class A
class B
A --> B
@enduml`);

      const svg = host.querySelector('svg');
      const routes = window.UMLShared.collectEditableRoutes(svg);
      const route = routes[0] ? routes[0].points.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })) : [];
      document.body.removeChild(host);
      return route;
    });

    expect(points).toEqual([
      { x: 44, y: 44 },
      { x: 144, y: 44 },
      { x: 144, y: 104 },
    ]);
  });

  test('normal component renderer replays saved connector label positions', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!window.UMLComponentDiagram && !!window.UMLShared);

    const labelBox = await page.evaluate(() => {
      const host = document.createElement('div');
      host.style.width = '900px';
      document.body.appendChild(host);

      window.UMLComponentDiagram.render(host, `@startuml
@layout schema=1 renderer="archuml-visual-editor"
node "label:edge-0" x=72 y=88
@endlayout
component Frontend {
  portout "httpOut" as f_out
}
component Backend {
  portin "httpIn" as b_in
}
f_out --> b_in : REST / JSON
@enduml`);

      const svg = host.querySelector('svg');
      const label = svg.querySelector('[data-layout-kind="edge-label"][data-layout-id="label:edge-0"]');
      const rect = label.getBoundingClientRect();
      const pt1 = svg.createSVGPoint();
      pt1.x = rect.left;
      pt1.y = rect.top;
      const pt2 = svg.createSVGPoint();
      pt2.x = rect.right;
      pt2.y = rect.bottom;
      const ctm = svg.getScreenCTM().inverse();
      const a = pt1.matrixTransform(ctm);
      const b = pt2.matrixTransform(ctm);
      document.body.removeChild(host);
      return {
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        text: label.textContent.replace(/\s+/g, ' ').trim(),
      };
    });

    expect(labelBox.text).toContain('REST / JSON');
    expect(labelBox.x).toBeCloseTo(72, 0);
    expect(labelBox.y).toBeCloseTo(88, 0);
  });

  test('normal renderers replay saved positions for data-backed diagrams', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!window.UMLVennDiagram && !!window.UMLGitGraphDiagram && !!window.UMLShared);

    const positions = await page.evaluate(() => {
      function layoutBox(container, id) {
        const svg = container.querySelector('svg');
        const parts = Array.from(svg.querySelectorAll('[data-layout-id]')).filter((el) => el.getAttribute('data-layout-id') === id);
        let box = null;
        for (const el of parts) {
          const rect = el.getBoundingClientRect();
          const pt1 = svg.createSVGPoint();
          pt1.x = rect.left;
          pt1.y = rect.top;
          const pt2 = svg.createSVGPoint();
          pt2.x = rect.right;
          pt2.y = rect.bottom;
          const ctm = svg.getScreenCTM().inverse();
          const a = pt1.matrixTransform(ctm);
          const b = pt2.matrixTransform(ctm);
          const next = {
            x: Math.min(a.x, b.x),
            y: Math.min(a.y, b.y),
            width: Math.abs(a.x - b.x),
            height: Math.abs(a.y - b.y),
          };
          if (!box) box = next;
          else {
            const x1 = Math.min(box.x, next.x);
            const y1 = Math.min(box.y, next.y);
            const x2 = Math.max(box.x + box.width, next.x + next.width);
            const y2 = Math.max(box.y + box.height, next.y + next.height);
            box = { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
          }
        }
        return box ? { x: Math.round(box.x), y: Math.round(box.y) } : null;
      }

      const vennHost = document.createElement('div');
      vennHost.style.width = '900px';
      document.body.appendChild(vennHost);
      window.UMLVennDiagram.render(vennHost, `@startuml
@layout schema=1 renderer="archuml-visual-editor"
node "Frontend" x=120 y=90
@endlayout
set Frontend
set Backend
Frontend : React
Backend : Django
Frontend & Backend : SvelteKit
@enduml`);

      const gitHost = document.createElement('div');
      gitHost.style.width = '900px';
      document.body.appendChild(gitHost);
      window.UMLGitGraphDiagram.render(gitHost, `@startuml
@layout schema=1 renderer="archuml-visual-editor"
node "A" x=210 y=70
@endlayout
branch main:
  A "Initial commit"
  B "Second commit"
head main
@enduml`);

      const result = {
        venn: layoutBox(vennHost, 'Frontend'),
        git: layoutBox(gitHost, 'A'),
      };
      document.body.removeChild(vennHost);
      document.body.removeChild(gitHost);
      return result;
    });

    expect(positions.venn.x).toBeCloseTo(120, 0);
    expect(positions.venn.y).toBeCloseTo(90, 0);
    expect(positions.git.x).toBeCloseTo(210, 0);
    expect(positions.git.y).toBeCloseTo(70, 0);
  });

  test('normal GitGraph renderer moves connected edge endpoints with commit positions', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!window.UMLGitGraphDiagram && !!window.UMLShared);

    const result = await page.evaluate(() => {
      function renderedCenter(svg, el) {
        const rect = el.getBoundingClientRect();
        const pt1 = svg.createSVGPoint();
        pt1.x = rect.left;
        pt1.y = rect.top;
        const pt2 = svg.createSVGPoint();
        pt2.x = rect.right;
        pt2.y = rect.bottom;
        const ctm = svg.getScreenCTM().inverse();
        const a = pt1.matrixTransform(ctm);
        const b = pt2.matrixTransform(ctm);
        return {
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
        };
      }

      const host = document.createElement('div');
      host.style.width = '900px';
      document.body.appendChild(host);
      window.UMLGitGraphDiagram.render(host, `@startuml
@layout schema=1 renderer="archuml-visual-editor"
node "A" x=260 y=90
@endlayout
branch main:
  A "Initial commit"
  B "Second commit"
head main
@enduml`);

      const svg = host.querySelector('svg');
      const circle = svg.querySelector('circle.git-graph-node[data-layout-id="A"]');
      const route = window.UMLShared.collectEditableRoutes(svg).find((item) => item.target === 'A');
      const endpoint = route.points[route.points.length - 1];
      const center = renderedCenter(svg, circle);
      document.body.removeChild(host);
      return {
        source: route.source,
        target: route.target,
        endpoint,
        center,
        dx: endpoint.x - center.x,
        dy: endpoint.y - center.y,
      };
    });

    expect(result.source).toBe('B');
    expect(result.target).toBe('A');
    expect(Math.abs(result.dx)).toBeLessThan(2);
    expect(Math.abs(result.dy)).toBeLessThan(45);
  });

  test('normal GitGraph renderer anchors branch labels to moved commits unless labels are manual', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!window.UMLGitGraphDiagram && !!window.UMLShared);

    const result = await page.evaluate(() => {
      const source = `@startuml
branch main:
  A "Initial commit"
  B "Second commit"
branch feature from A:
  F "Feature start"
  H "Feature tip"
head main
@enduml`;

      function render(text) {
        const host = document.createElement('div');
        host.style.width = '900px';
        document.body.appendChild(host);
        window.UMLGitGraphDiagram.render(host, text);
        return host;
      }

      function box(host, id) {
        const svg = host.querySelector('svg');
        let parts = Array.from(svg.querySelectorAll('[data-layout-bounds-id]'))
          .filter((el) => el.getAttribute('data-layout-bounds-id') === id);
        if (!parts.length) {
          parts = Array.from(svg.querySelectorAll('[data-layout-id]'))
            .filter((el) => el.getAttribute('data-layout-id') === id);
        }

        function svgBox(el) {
          const rect = el.getBoundingClientRect();
          const pt1 = svg.createSVGPoint();
          pt1.x = rect.left;
          pt1.y = rect.top;
          const pt2 = svg.createSVGPoint();
          pt2.x = rect.right;
          pt2.y = rect.bottom;
          const ctm = svg.getScreenCTM().inverse();
          const a = pt1.matrixTransform(ctm);
          const b = pt2.matrixTransform(ctm);
          return {
            x: Math.min(a.x, b.x),
            y: Math.min(a.y, b.y),
            width: Math.abs(a.x - b.x),
            height: Math.abs(a.y - b.y),
          };
        }

        return parts.map(svgBox).reduce((acc, item) => {
          if (!acc) return item;
          const x1 = Math.min(acc.x, item.x);
          const y1 = Math.min(acc.y, item.y);
          const x2 = Math.max(acc.x + acc.width, item.x + item.width);
          const y2 = Math.max(acc.y + acc.height, item.y + item.height);
          return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
        }, null);
      }

      const auto = render(source);
      const moved = render(source.replace('@startuml', '@startuml\n@layout schema=1 renderer="archuml-visual-editor"\nnode "H" x=430 y=88\n@endlayout'));
      const manual = render(source.replace('@startuml', '@startuml\n@layout schema=1 renderer="archuml-visual-editor"\nnode "H" x=430 y=88\nnode "branch:feature" x=70 y=132\n@endlayout'));

      const output = {
        autoCommit: box(auto, 'H'),
        autoLabel: box(auto, 'branch:feature'),
        movedCommit: box(moved, 'H'),
        movedLabel: box(moved, 'branch:feature'),
        manualLabel: box(manual, 'branch:feature'),
      };
      document.body.removeChild(auto);
      document.body.removeChild(moved);
      document.body.removeChild(manual);
      return output;
    });

    const commitDx = result.movedCommit.x - result.autoCommit.x;
    const commitDy = result.movedCommit.y - result.autoCommit.y;
    expect(result.movedLabel.x - result.autoLabel.x).toBeCloseTo(commitDx, 0);
    expect(result.movedLabel.y - result.autoLabel.y).toBeCloseTo(commitDy, 0);
    expect(result.manualLabel.x).toBeCloseTo(70, 0);
    expect(result.manualLabel.y).toBeCloseTo(132, 0);
  });
});

test.describe('UML playground visual editor', () => {
  test('UML Editor starts empty and exposes only UML diagram types', async ({ page }) => {
    await page.goto(UML_EDITOR_URL);
    await page.waitForSelector('#uml-pg-edit');

    const options = await page.locator('#uml-pg-type option').evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('value'))
    );
    expect(options).toEqual([
      'class',
      'sequence',
      'state',
      'component',
      'deployment',
      'usecase',
      'activity',
    ]);
    await expect(page.locator('#uml-pg-input')).toHaveValue('@startuml\n@enduml');
    await expect(page.locator('.uml-pg-model-empty')).toBeVisible();
    await expect(page.locator('#uml-pg-reset-example')).toHaveText(/Empty/);
    await expect(page.locator('link[href$="git-graph.css"]')).toHaveCount(0);

    await page.selectOption('#uml-pg-type', 'sequence');
    await expect(page.locator('#uml-pg-input')).toHaveValue('@startuml\n@enduml');
    await expect(page.locator('.uml-pg-sequence-empty')).toBeVisible();

    await page.locator('#uml-pg-input').evaluate((el) => {
      el.value = '@startuml\nclass A\n@enduml';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const autosaved = await page.evaluate(() => localStorage.getItem('uml-pg-autosave-class'));
    expect(autosaved).toBeNull();
  });

  test('UML editor exposes accessible regions, live feedback, and readable controls', async ({ page }) => {
    await page.goto(UML_EDITOR_URL);
    await page.waitForSelector('#uml-pg-edit');
    await page.waitForSelector('#uml-pg-palette-elements .uml-pg-tool-btn');
    await page.waitForSelector('#uml-pg-palette-relations .uml-pg-tool-btn[data-tool-spec="depend"]');

    await expect(page.locator('#uml-pg-editor-pane')).toHaveAttribute('role', 'region');
    await expect(page.locator('#uml-pg-input')).toHaveAttribute('aria-describedby', /uml-pg-source-help/);
    await expect(page.locator('#uml-pg-input')).toHaveAttribute('aria-controls', /uml-pg-output/);
    await expect(page.locator('#uml-pg-preview-pane')).toHaveAttribute('role', 'region');
    await expect(page.locator('#uml-pg-preview-pane')).toHaveAttribute('aria-describedby', /uml-pg-preview-help/);
    await expect(page.locator('#uml-pg-palette')).toHaveAttribute('role', 'region');
    await expect(page.locator('#uml-pg-sequence-model')).toHaveAttribute('role', 'region');
    await expect(page.locator('#uml-pg-autosave')).toHaveAttribute('role', 'status');
    await expect(page.locator('#uml-pg-autosave')).toHaveAttribute('aria-atomic', 'true');
    await expect(page.locator('#uml-pg-status')).toHaveAttribute('role', 'status');
    await expect(page.locator('#uml-pg-status')).toHaveAttribute('aria-atomic', 'true');
    await expect(page.locator('#uml-pg-tool-status')).toHaveAttribute('role', 'status');
    await expect(page.locator('#uml-pg-tool-status')).toHaveAttribute('aria-atomic', 'true');
    await expect(page.locator('#uml-pg-error')).toHaveAttribute('role', 'alert');

    const sizes = await page.evaluate(() => {
      function size(selector) {
        return Number.parseFloat(window.getComputedStyle(document.querySelector(selector)).fontSize);
      }
      return {
        wrap: size('#uml-playground-wrap'),
        source: size('#uml-pg-input'),
        type: size('#uml-pg-type'),
        button: size('#uml-pg-reset-example'),
        paletteTool: size('#uml-pg-palette-elements .uml-pg-tool-btn'),
      };
    });
    expect(sizes.source).toBeGreaterThanOrEqual(sizes.wrap - 0.1);
    expect(sizes.type).toBeGreaterThanOrEqual(sizes.wrap - 0.1);
    expect(sizes.button).toBeGreaterThanOrEqual(sizes.wrap - 0.1);
    expect(sizes.paletteTool).toBeGreaterThanOrEqual(sizes.wrap - 0.1);

    const dependencyTool = page.locator('#uml-pg-palette-relations .uml-pg-tool-btn[data-tool-spec="depend"]');
    await dependencyTool.click();
    await expect(page.locator('#uml-pg-tool-status')).toContainText('Click the source element');
  });

  test('live editor uses a roomy canvas while SVG export keeps tight bounds', async ({ page }) => {
    await page.goto(UML_EDITOR_URL);
    await page.waitForSelector('.uml-pg-model-empty');

    await page.locator('.uml-pg-model-empty').getByRole('button', { name: '+ Class' }).click();
    await page.waitForSelector('#uml-pg-output svg');

    const metrics = await page.evaluate(() => {
      const svg = document.querySelector('#uml-pg-output svg');
      const hitbox = svg.querySelector('.uml-pg-edit-hitbox[data-layout-id="Class"]');
      const viewBox = svg.viewBox.baseVal;
      const box = hitbox.getBBox();
      return {
        viewBoxWidth: viewBox.width,
        viewBoxHeight: viewBox.height,
        hitboxWidth: box.width,
        hitboxHeight: box.height,
        exportViewBox: svg.getAttribute('data-uml-pg-export-viewbox'),
      };
    });

    expect(metrics.viewBoxWidth).toBeGreaterThanOrEqual(960);
    expect(metrics.viewBoxHeight).toBeGreaterThanOrEqual(620);
    expect(metrics.hitboxWidth / metrics.viewBoxWidth).toBeLessThan(0.45);
    expect(metrics.hitboxHeight / metrics.viewBoxHeight).toBeLessThan(0.45);
    expect(metrics.exportViewBox).toMatch(/\S/);

    const downloadPromise = page.waitForEvent('download');
    await page.locator('#uml-pg-download').click();
    const download = await downloadPromise;
    const path = await download.path();
    expect(path, 'download should produce a local SVG file').not.toBeNull();
    const svgText = fs.readFileSync(path, 'utf8');
    const exportedBox = parseSvgViewBox(svgText);

    expect(exportedBox.width).toBeLessThan(metrics.viewBoxWidth);
    expect(exportedBox.height).toBeLessThan(metrics.viewBoxHeight);
    expect(svgText).not.toContain('data-uml-pg-export');
    expect(svgText).not.toContain('data-uml-pg-editor-canvas');
  });

  test('UML export downloads encrypted source with the fixed course password', async ({ page }) => {
    await page.goto(UML_EDITOR_URL);
    await page.waitForSelector('#uml-pg-edit');
    const source = '@startuml\nclass Player\n@enduml';
    await page.locator('#uml-pg-input').evaluate((el, value) => {
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, source);

    await expect(page.locator('#uml-pg-export-password')).toHaveCount(0);
    await expect(page.locator('#uml-pg-export-modal')).toHaveCount(0);

    const downloadPromise = page.waitForEvent('download');
    await page.locator('#uml-pg-export-source').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('class.uml');
    const path = await download.path();
    expect(path, 'download should produce a local UML file').not.toBeNull();
    const payloadText = fs.readFileSync(path, 'utf8');
    const payload = JSON.parse(payloadText);
    expect(payload.crypto.keyLength).toBe(128);

    const decrypted = await decryptUmlPayload(payloadText, '4-amigos');
    expect(decrypted).toEqual({
      diagramType: 'class',
      archuml: source,
    });
  });

  test('Python generation combines class structure and sequence behavior', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'class');
    await setUmlSource(page, `@startuml
class Application { +db: Database; +login(username: str, password: str): str }
class Database { +queryUser(username: str): dict }
Application --> Database : db
@enduml`);

    await selectDiagram(page, 'sequence');
    await setUmlSource(page, `@startuml
actor user: User
participant app: Application
participant db: Database
user -> app: login(username, password)
activate app
app -> db: queryUser(username)
activate db
db --> app: userData
deactivate db
alt [valid credentials]
  app --> user: token
else [invalid]
  app --> user: error 401
end
deactivate app
@enduml`);

    const { popup, pythonText } = await openGeneratedPythonWorkspace(page);

    await popup.waitForFunction(() => {
      return Boolean(window.__archUmlGeneratedPythonTutorial)
        && window.__archUmlGeneratedPythonTutorial.config.backend === 'pyodide'
        && window.__archUmlGeneratedPythonTutorial.debuggerEnabled === true;
    }, null, { timeout: 30000 });
    await expect(popup.locator('#generated-python-title')).toHaveText('Generated Python Tutorial');
    await expect(popup.locator('.tvm-run-btn')).toBeVisible();
    await expect(popup.locator('.tvm-output-panel')).toBeVisible();
    await popup.waitForFunction(() => {
      const tutorial = window.__archUmlGeneratedPythonTutorial;
      const diagrams = tutorial && tutorial._umlLastDiagrams;
      return Boolean(tutorial && tutorial._umlDiagramEnabled && tutorial._umlPositionRight
        && diagrams && /class\s+Application/.test(diagrams.classDiagram || ''));
    }, null, { timeout: 30000 });
    await expect(popup.locator('.tvm-right-tab[data-panel="uml"]')).toBeVisible();
    await popup.locator('.tvm-right-tab[data-panel="uml"]').click();
    await expect(popup.locator('.tvm-right-tab[data-panel="uml"]')).toHaveClass(/active/);
    await expect(popup.locator('.tvm-uml-right-view')).toBeVisible();
    await expect(popup.locator('.tvm-diagram-content svg')).toBeVisible();

    expect(pythonText).toContain('class Application:');
    expect(pythonText).toContain('class Database:');
    expect(pythonText).toContain('def login(self, username: str, password: str) -> str:');
    expect(pythonText).toContain('userData = self.db.queryUser(username)  # response: userData');
    expect(pythonText).toContain('if _condition("valid credentials"):');
    expect(pythonText).toContain('elif _condition("invalid"):');
    expect(pythonText).toContain('return _response("token")');
    expect(pythonText).toContain('def run_sequence() -> None:');
    await popup.close();
  });

  test('Python generation preserves sequence diagram constructs', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'class');
    await setUmlSource(page, `@startuml
class Controller { +service: Service; +worker: Worker; +orchestrate(): None; +audit(): str }
class Service { +fetch(): str; +validate(): bool; +cleanup(): None }
class Worker { +start(): None }
Controller --> Service : service
Controller --> Worker : worker
@enduml`);

    await selectDiagram(page, 'sequence');
    await setUmlSource(page, `@startuml
actor user: User
participant controller: Controller
participant service: Service
participant worker: Worker
user -> controller: orchestrate()
activate controller
o-> controller: wake()
note over controller
  entry note
end note
controller -> controller: audit()
controller --> controller: audited
controller -> service: fetch()
service --> controller: payload
opt [has cache]
  controller -> service: validate()
  service --> controller: ok
end
loop [each item]
  controller ->> worker: start()
end
par [primary]
  controller -> service: validate()
  service --> controller: primaryOk
else [secondary]
  controller -> service: validate()
  service --> controller: secondaryOk
end
critical [single writer]
  controller -> service: cleanup()
  service --> controller: cleaned
end
ref [AuthHandshake]
  controller -> service: validate()
  service --> controller: authOk
end
neg [invalid state]
  controller ->o: cannot deliver
end
break [fatal]
  controller -> service: cleanup()
  service --> controller: aborted
end
create worker
destroy worker
deactivate controller
@enduml`);

    const { popup, pythonText } = await openGeneratedPythonWorkspace(page);

    expect(pythonText).toContain('# Found message to controller: wake()');
    expect(pythonText).toContain('# Note: entry note');
    expect(pythonText).toContain('audited = self.audit()  # response: audited');
    expect(pythonText).toContain('payload = self.service.fetch()  # response: payload');
    expect(pythonText).toContain('if _condition("has cache"):');
    expect(pythonText).toContain('for _ in _loop("each item"):');
    expect(pythonText).toContain('self.worker.start()  # async message');
    expect(pythonText).toContain('with _parallel_branch("primary"):');
    expect(pythonText).toContain('with _parallel_branch("secondary"):');
    expect(pythonText).toContain('with _critical_section("single writer"):');
    expect(pythonText).toContain('with _interaction_ref("AuthHandshake"):');
    expect(pythonText).toContain('if _forbidden_trace("invalid state"):');
    expect(pythonText).toContain('# Lost message from controller: cannot deliver');
    expect(pythonText).toContain('if _condition("fatal"):');
    expect(pythonText).toContain('worker = Worker()  # create lifeline');
    expect(pythonText).toContain('# Destroy lifeline worker');
    expect(pythonText).not.toContain('Unsupported sequence fragment');
    await popup.close();
  });

  test('dark mode styles apply from the document element class', async ({ page }) => {
    await page.goto(PLAYGROUND_URL);
    await page.waitForSelector('#uml-pg-edit');

    const styles = await page.evaluate(() => {
      document.documentElement.classList.add('dark-mode');

      function read(selector) {
        const el = document.querySelector(selector);
        const style = window.getComputedStyle(el);
        return {
          background: style.backgroundColor,
          color: style.color,
          borderColor: style.borderColor,
        };
      }

      return {
        toolbar: read('#uml-playground-toolbar'),
        select: read('#uml-pg-type'),
        textarea: read('#uml-pg-input'),
        preview: read('#uml-pg-preview-pane'),
        resetDisabled: read('#uml-pg-reset-one'),
      };
    });

    expect(styles.toolbar.background).toBe('rgb(30, 44, 62)');
    expect(styles.select.background).toBe('rgb(36, 51, 71)');
    expect(styles.select.color).toBe('rgb(208, 224, 240)');
    expect(styles.textarea.background).toBe('rgb(20, 30, 43)');
    expect(styles.preview.background).toBe('rgb(26, 37, 53)');
    expect(styles.resetDisabled.background).toBe('rgb(27, 38, 53)');
    expect(styles.resetDisabled.color).toBe('rgb(113, 131, 153)');
  });

  test('SVG export omits visual edit overlays for custom-position diagrams', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'class');
    await page.locator('#uml-pg-input').fill(CUSTOM_POSITION_CLASS_DIAGRAM);
    await page.waitForFunction(() => {
      const svg = document.querySelector('#uml-pg-output svg');
      return !!svg && svg.textContent.includes('Trainable');
    });

    await expect(page.locator('.uml-pg-edit-layer .uml-pg-edit-hitbox')).toHaveCount(4);

    const downloadPromise = page.waitForEvent('download');
    await page.locator('#uml-pg-download').click();
    const download = await downloadPromise;
    const path = await download.path();
    expect(path, 'download should produce a local SVG file').not.toBeNull();
    const svgText = fs.readFileSync(path, 'utf8');

    expect(svgText).toContain('Animal');
    expect(svgText).toContain('Trainable');
    expect(svgText).toContain('fill="#d0ddef"');
    expect(svgText).toContain('stroke="#4060a0"');
    expect(svgText).not.toContain('uml-pg-edit-layer');
    expect(svgText).not.toContain('uml-pg-edit-hitbox');
    expect(svgText).not.toContain('uml-pg-editing');
  });

  test('exposes element handles for every playground diagram type', async ({ page }) => {
    await openPlayground(page);

    const counts = {};
    for (const type of NODE_EDIT_TYPES) {
      await selectDiagram(page, type);
      await selectEditMode(page, 'nodes');
      counts[type] = await page.locator('.uml-pg-edit-hitbox').count();
    }

    for (const type of NODE_EDIT_TYPES) {
      expect(counts[type], `${type} should expose at least one movable element`).toBeGreaterThan(0);
    }
  });

  test('exposes line handles for every route-based diagram type', async ({ page }) => {
    await openPlayground(page);

    const counts = {};
    for (const type of ROUTE_EDIT_TYPES) {
      await selectDiagram(page, type);
      await selectEditMode(page, 'lines');
      counts[type] = await page.locator('.uml-pg-edge-hitbox').count();
    }

    for (const type of ROUTE_EDIT_TYPES) {
      expect(counts[type], `${type} should expose at least one editable route`).toBeGreaterThan(0);
    }
  });

  test('sequence empty state can add lifelines from the diagram and palette', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'sequence');

    await page.locator('#uml-pg-input').fill('@startuml\n@enduml');
    await page.locator('#uml-pg-input').dispatchEvent('input');

    await expect(page.locator('.uml-pg-sequence-empty')).toBeVisible();
    await page.locator('.uml-pg-sequence-empty').getByRole('button', { name: '+ Participant' }).click();
    await expect(page.locator('.uml-pg-edit-hitbox[data-layout-id="p"]')).toHaveCount(1);
    await expect(page.locator('#uml-pg-input')).toHaveValue(/participant p: Participant/);

    await page.locator('#uml-pg-input').fill('@startuml\n@enduml');
    await page.locator('#uml-pg-input').dispatchEvent('input');
    await expect(page.locator('.uml-pg-sequence-empty')).toBeVisible();
    await page.locator('#uml-pg-palette-elements .uml-pg-tool-btn[data-tool-spec="actor"]').click();
    await expect(page.locator('.uml-pg-edit-hitbox[data-layout-id="actor"]')).toHaveCount(1);
    await expect(page.locator('#uml-pg-input')).toHaveValue(/actor actor: Actor/);
  });

  test('sequence canvas adds editable participants with valid default labels', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'sequence');

    await page.locator('#uml-pg-palette-elements .uml-pg-tool-btn[data-tool-spec="participant"]').click();
    await expect(page.locator('#uml-pg-palette-elements .uml-pg-tool-btn[data-tool-spec="participant"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#uml-pg-output svg').click({ position: { x: 24, y: 24 }, force: true });
    await expect(page.locator('#uml-pg-input')).toHaveValue(/participant p: Participant/);
    await expect(page.locator('#uml-pg-input')).not.toHaveValue(/participant p: p\b/);
    await expect(page.locator('.uml-pg-edit-hitbox[data-layout-id="p"]')).toHaveCount(1);

    await page.locator('.uml-pg-edit-hitbox[data-layout-id="p"]').evaluate((el) => {
      const r = el.getBoundingClientRect();
      el.dispatchEvent(new MouseEvent('dblclick', {
        bubbles: true,
        cancelable: true,
        clientX: r.left + r.width / 2,
        clientY: r.top + r.height / 2,
      }));
    });
    await page.locator('.uml-pg-inline-input').fill('svc: Service');
    await page.locator('.uml-pg-inline-input').press('Enter');

    await expect(page.locator('#uml-pg-input')).toHaveValue(/participant svc: Service/);
    await expect(page.locator('#uml-pg-input')).toHaveValue(/user -> app: login/);
    await expect(page.locator('.uml-pg-edit-hitbox[data-layout-id="svc"]')).toHaveCount(1);
  });

  test('sequence plus handle creates editable participants with valid default labels', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'sequence');
    await setUmlSource(page, `@startuml
actor user: User @pos(260, 0)
participant app: Application @pos(460, 0)
user -> app: login()
@enduml`);

    const handle = page.getByRole('button', { name: /Extend a relation from app: Application/ });
    await expect(handle).toBeVisible();
    await handle.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
    const start = await handle.boundingBox();
    const target = await page.locator('#uml-pg-output svg').evaluate((svg) => {
      const svgRect = svg.getBoundingClientRect();
      const previewRect = document.querySelector('#uml-pg-preview-pane')?.getBoundingClientRect() || svgRect;
      const visible = {
        left: Math.max(svgRect.left, previewRect.left, 0) + 24,
        top: Math.max(svgRect.top, previewRect.top, 0) + 24,
        right: Math.min(svgRect.right, previewRect.right, window.innerWidth) - 24,
        bottom: Math.min(svgRect.bottom, previewRect.bottom, window.innerHeight) - 24,
      };
      const appRect = document.querySelector('.uml-pg-edit-hitbox[data-layout-id="app"]')?.getBoundingClientRect();
      const blocked = Array.from(document.querySelectorAll('.uml-pg-edit-hitbox, .uml-pg-edit-a11y-target, .uml-pg-edge-hitbox'))
        .map((el) => el.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0);
      const clamp = (pt) => ({
        x: Math.min(Math.max(pt.x, visible.left), visible.right),
        y: Math.min(Math.max(pt.y, visible.top), visible.bottom),
      });
      const candidates = appRect ? [
        { x: appRect.right + 180, y: appRect.top + appRect.height / 2 },
        { x: appRect.right + 180, y: appRect.bottom + 120 },
        { x: appRect.left + appRect.width / 2, y: appRect.bottom + 180 },
        { x: visible.right, y: visible.top },
        { x: visible.right, y: visible.bottom },
      ].map(clamp) : [
        { x: visible.right, y: visible.top },
        { x: visible.right, y: visible.bottom },
        { x: visible.left, y: visible.bottom },
      ];
      return candidates.find((pt) =>
        pt.x >= visible.left && pt.x <= visible.right &&
        pt.y >= visible.top && pt.y <= visible.bottom &&
        !blocked.some((rect) =>
          pt.x >= rect.left && pt.x <= rect.right && pt.y >= rect.top && pt.y <= rect.bottom
        )) || { x: visible.right, y: visible.top };
    });
    if (!start) throw new Error('extend handle should have a box');
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    await expect(page.locator('.uml-pg-extend-line')).toHaveCount(1);
    await page.mouse.move(target.x, target.y, { steps: 8 });
    await page.mouse.up();

    await expect(page.getByRole('menu', { name: 'Pick an element type to create' })).toBeVisible();
    await page.getByRole('menuitem', { name: /Participant/ }).click();
    await expect(page.locator('#uml-pg-input')).toHaveValue(/participant p: Participant/);
    await expect(page.locator('#uml-pg-input')).not.toHaveValue(/participant p: p\b/);
    await expect(page.locator('.uml-pg-edit-hitbox[data-layout-id="p"]')).toHaveCount(1);

    await page.keyboard.press('Escape');
    await page.locator('.uml-pg-edit-hitbox[data-layout-id="p"]').evaluate((el) => {
      const r = el.getBoundingClientRect();
      el.dispatchEvent(new MouseEvent('dblclick', {
        bubbles: true,
        cancelable: true,
        clientX: r.left + r.width / 2,
        clientY: r.top + r.height / 2,
      }));
    });
    await page.locator('.uml-pg-inline-input').fill('worker: Worker');
    await page.locator('.uml-pg-inline-input').press('Enter');

    await expect(page.locator('#uml-pg-input')).toHaveValue(/participant worker: Worker/);
    await expect(page.locator('.uml-pg-edit-hitbox[data-layout-id="worker"]')).toHaveCount(1);
  });

  test('sequence palette can add target markers and single-ended messages', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'sequence');

    await page.locator('#uml-pg-palette-elements .uml-pg-tool-btn[data-tool-spec="activate"]').click();
    await page.locator('.uml-pg-edit-a11y-target[data-layout-id="user"]').press('Enter');
    await expect(page.locator('#uml-pg-input')).toHaveValue(/activate user/);

    await page.locator('#uml-pg-palette-relations .uml-pg-tool-btn[data-tool-spec="lost"]').click();
    await page.locator('.uml-pg-edit-a11y-target[data-layout-id="user"]').press('Enter');
    await expect(page.locator('#uml-pg-input')).toHaveValue(/user ->o : lost/);

    await page.locator('#uml-pg-palette-relations .uml-pg-tool-btn[data-tool-spec="found"]').click();
    await page.locator('.uml-pg-edit-a11y-target[data-layout-id="app"]').press('Enter');
    await expect(page.locator('#uml-pg-input')).toHaveValue(/o-> app : found/);
    await expect(page.locator('.uml-pg-edit-hitbox[data-layout-id="o"]')).toHaveCount(0);

    await page.locator('#uml-pg-palette-relations .uml-pg-tool-btn[data-tool-spec="lost"]').click();
    await page.locator('.uml-pg-edit-a11y-target[data-layout-id="app"]').click({ force: true });
    await expect(page.locator('#uml-pg-input')).toHaveValue(/app ->o : lost/);

    const foundTool = page.locator('#uml-pg-palette-relations .uml-pg-tool-btn[data-tool-spec="found"]');
    const userTarget = page.locator('.uml-pg-edit-hitbox[data-layout-id="user"]');
    await foundTool.dragTo(userTarget);
    await expect(page.locator('#uml-pg-input')).toHaveValue(/o-> user : found/);
  });

  test('renaming sequence heads parses instance and class labels', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'sequence');
    await page.locator('#uml-pg-input').evaluate((el) => {
      el.value = `@startuml
actor user: User
participant app: Application
user -> app: request()
app --> user: response()
@enduml`;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForSelector('.uml-pg-edit-hitbox[data-layout-id="app"]');

    await page.locator('.uml-pg-edit-hitbox[data-layout-id="app"]').evaluate((el) => {
      const r = el.getBoundingClientRect();
      el.dispatchEvent(new MouseEvent('dblclick', {
        bubbles: true,
        cancelable: true,
        clientX: r.left + r.width / 2,
        clientY: r.top + r.height / 2,
      }));
    });
    await page.locator('.uml-pg-inline-input').fill('svc : OrderService');
    await page.locator('.uml-pg-inline-input').press('Enter');

    await expect(page.locator('#uml-pg-input')).toHaveValue(/participant svc: OrderService/);
    await expect(page.locator('#uml-pg-input')).toHaveValue(/user -> svc: request\(\)/);
    await expect(page.locator('#uml-pg-input')).toHaveValue(/svc --> user: response\(\)/);
    await expect(page.locator('#uml-pg-input')).not.toHaveValue(/participant app: svc: OrderService/);
    await expect(page.locator('.uml-pg-edit-hitbox[data-layout-id="svc"]')).toHaveCount(1);
  });

  test('sequence call labels can be edited from properties and inline labels', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'sequence');
    await page.locator('#uml-pg-input').evaluate((el) => {
      el.value = `@startuml
actor user: User
participant app: Application
user -> app: request()
app --> user: response()
@enduml`;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page.locator('.uml-pg-edge-hitbox[data-route-id="seqmsg:3"]')).toHaveCount(1);

    await page.locator('.uml-pg-edge-hitbox[data-route-id="seqmsg:3"]').evaluate((el) => {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });
    await page.locator('#uml-pg-props-content').getByLabel('Label').fill('submitOrder()');
    await page.locator('#uml-pg-props-content').getByLabel('Label').press('Enter');
    await expect(page.locator('#uml-pg-input')).toHaveValue(/user -> app : submitOrder\(\)/);
    await expect(page.locator('#uml-pg-input')).not.toHaveValue(/request\(\)/);

    await page.locator('#uml-pg-output svg text[data-layout-route-id="seqmsg:4"]').evaluate((el) => {
      const r = el.getBoundingClientRect();
      el.dispatchEvent(new MouseEvent('dblclick', {
        bubbles: true,
        cancelable: true,
        clientX: r.left + r.width / 2,
        clientY: r.top + r.height / 2,
      }));
    });
    await page.locator('.uml-pg-inline-input').fill('ok');
    await page.locator('.uml-pg-inline-input').press('Enter');
    await expect(page.locator('#uml-pg-input')).toHaveValue(/app --> user : ok/);
    await expect(page.locator('#uml-pg-input')).not.toHaveValue(/response\(\)/);
  });

  test('sequence call tools can be dragged between lifelines and onto themselves', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'sequence');
    await page.locator('#uml-pg-editor-pane').evaluate((el) => {
      el.style.flex = '0 0 180px';
    });
    await setUmlSource(page, `@startuml
actor user: User @pos(300, 0)
participant app: Application @pos(500, 0)
participant db: Database @pos(700, 0)
user -> app: first()
app --> user: second()
@enduml`);
    await expect(page.locator('.uml-pg-edge-hitbox[data-route-id="seqmsg:4"]')).toHaveCount(1);

    await page.locator('#uml-pg-palette-relations .uml-pg-tool-btn[data-tool-spec="sync"]').click();
    await expect(page.locator('#uml-pg-palette-relations .uml-pg-tool-btn[data-tool-spec="sync"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#uml-pg-output svg').evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
    const userBox = await page.locator('.uml-pg-edit-hitbox[data-layout-id="user"]').boundingBox();
    const appBox = await page.locator('.uml-pg-edit-hitbox[data-layout-id="app"]').boundingBox();
    const firstRouteBox = await page.locator('.uml-pg-edge-hitbox[data-route-id="seqmsg:4"]').boundingBox();
    const secondRouteBox = await page.locator('.uml-pg-edge-hitbox[data-route-id="seqmsg:5"]').boundingBox();
    if (!userBox || !appBox || !firstRouteBox || !secondRouteBox) {
      throw new Error('sequence lifeline and message handles should have boxes');
    }
    const betweenMessages = {
      sourceX: userBox.x + userBox.width / 2,
      targetX: appBox.x + appBox.width / 2,
      y: (firstRouteBox.y + firstRouteBox.height / 2 + secondRouteBox.y + secondRouteBox.height / 2) / 2,
    };
    await page.mouse.move(betweenMessages.sourceX, betweenMessages.y);
    await page.mouse.down();
    await expect(page.locator('.uml-pg-extend-line')).toHaveCount(1);
    await page.mouse.move(betweenMessages.targetX, betweenMessages.y, { steps: 8 });
    await page.mouse.up();

    let source = await page.locator('#uml-pg-input').inputValue();
    expect(source).toContain('user -> app : message()');
    expect(source.indexOf('user -> app: first()')).toBeLessThan(source.indexOf('user -> app : message()'));
    expect(source.indexOf('user -> app : message()')).toBeLessThan(source.indexOf('app --> user: second()'));

    const selfAppBox = await page.locator('.uml-pg-edit-hitbox[data-layout-id="app"]').boundingBox();
    const lastRouteBox = await page.locator('.uml-pg-edge-hitbox[data-route-id="seqmsg:6"]').boundingBox();
    if (!selfAppBox || !lastRouteBox) throw new Error('sequence self-message handles should have boxes');
    const selfDrop = {
      x: selfAppBox.x + selfAppBox.width / 2,
      startY: lastRouteBox.y + lastRouteBox.height / 2 + 28,
      endY: lastRouteBox.y + lastRouteBox.height / 2 + 68,
    };
    await page.mouse.move(selfDrop.x, selfDrop.startY);
    await page.mouse.down();
    await page.mouse.move(selfDrop.x, selfDrop.endY, { steps: 8 });
    await page.mouse.up();

    source = await page.locator('#uml-pg-input').inputValue();
    expect(source).toContain('app -> app : message()');
  });

  test('sequence call tools can create self-messages by dropping in the loop area', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'sequence');
    await setUmlSource(page, `@startuml
actor user: User @pos(300, 0)
participant app: Application @pos(500, 0)
participant db: Database @pos(700, 0)
user -> app: first()
app --> user: second()
@enduml`);
    await expect(page.locator('.uml-pg-edge-hitbox[data-route-id="seqmsg:5"]')).toHaveCount(1);

    await page.locator('#uml-pg-palette-relations .uml-pg-tool-btn[data-tool-spec="sync"]').click();
    await expect(page.locator('#uml-pg-palette-relations .uml-pg-tool-btn[data-tool-spec="sync"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#uml-pg-output svg').evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
    const appBox = await page.locator('.uml-pg-edit-hitbox[data-layout-id="app"]').boundingBox();
    const lastRouteBox = await page.locator('.uml-pg-edge-hitbox[data-route-id="seqmsg:5"]').boundingBox();
    if (!appBox || !lastRouteBox) throw new Error('sequence lifeline and message handles should have boxes');
    const start = {
      x: appBox.x + appBox.width / 2,
      y: lastRouteBox.y + lastRouteBox.height / 2 + 28,
    };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await expect(page.locator('.uml-pg-extend-line')).toHaveCount(1);
    await page.mouse.move(start.x + 82, start.y + 44, { steps: 8 });
    await page.mouse.up();

    const source = await page.locator('#uml-pg-input').inputValue();
    expect(source).toContain('app -> app : message()');
    expect(source.indexOf('app --> user: second()')).toBeLessThan(source.indexOf('app -> app : message()'));
  });

  test('sequence messages can be reordered by dragging and from properties', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'sequence');
    await setUmlSource(page, `@startuml
actor user: User
participant app: Application
participant db: Database
user -> app: first()
app -> db: second()
db --> app: third()
@enduml`);
    await expect(page.locator('.uml-pg-edge-hitbox[data-route-id="seqmsg:6"]')).toHaveCount(1);

    const move = await page.evaluate(() => {
      const svg = document.querySelector('#uml-pg-output svg');
      const boxFor = (selector) => svg.querySelector(selector).getBoundingClientRect();
      const first = boxFor('.uml-pg-edge-hitbox[data-route-id="seqmsg:4"]');
      const third = boxFor('.uml-pg-edge-hitbox[data-route-id="seqmsg:6"]');
      return {
        y: third.top + third.height / 2,
        targetY: first.top + first.height / 2 - 36,
      };
    });
    await dragLocatorCenter(
      page,
      page.locator('.uml-pg-edge-hitbox[data-route-id="seqmsg:6"]').first(),
      0,
      move.targetY - move.y
    );

    let source = await page.locator('#uml-pg-input').inputValue();
    expect(source.indexOf('db --> app: third()')).toBeLessThan(source.indexOf('user -> app: first()'));
    expect(source).not.toContain('edge "seqmsg:');

    await page.getByRole('button', { name: 'Move later' }).click();
    source = await page.locator('#uml-pg-input').inputValue();
    expect(source.indexOf('user -> app: first()')).toBeLessThan(source.indexOf('db --> app: third()'));
    expect(source.indexOf('db --> app: third()')).toBeLessThan(source.indexOf('app -> db: second()'));
  });

  test('sequence self-messages reorder in the ArchUML source when dragged', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'sequence');
    await setUmlSource(page, `@startuml
actor user: User
participant app: Application
participant db: Database
user -> app: first()
app -> app: self()
app -> db: second()
@enduml`);
    await page.waitForFunction(() => {
      const svg = document.querySelector('#uml-pg-output svg');
      return Boolean(svg && svg.textContent.includes('self()') && svg.textContent.includes('second()') &&
        document.querySelector('.uml-pg-edge-hitbox[data-route-id="seqmsg:6"]'));
    });
    await expect(page.locator('.uml-pg-edge-hitbox[data-route-id="seqmsg:5"]')).toHaveCount(3);

    const move = await page.evaluate(() => {
      const svg = document.querySelector('#uml-pg-output svg');
      const boxFor = (selector) => svg.querySelector(selector).getBoundingClientRect();
      const self = boxFor('.uml-pg-edge-hitbox[data-route-id="seqmsg:5"]');
      const second = boxFor('.uml-pg-edge-hitbox[data-route-id="seqmsg:6"]');
      return {
        y: self.top + self.height / 2,
        targetY: second.top + second.height / 2 + 36,
      };
    });
    await dragLocatorCenter(
      page,
      page.locator('.uml-pg-edge-hitbox[data-route-id="seqmsg:5"]').first(),
      0,
      move.targetY - move.y
    );

    const source = await page.locator('#uml-pg-input').inputValue();
    expect(source.indexOf('app -> db: second()')).toBeLessThan(source.indexOf('app -> app: self()'));
    expect(source).not.toContain('edge "seqmsg:');
  });

  test('class empty state can add model elements from the diagram and palette', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'class');

    await page.locator('#uml-pg-input').fill('@startuml\n@enduml');
    await page.locator('#uml-pg-input').dispatchEvent('input');

    await expect(page.locator('.uml-pg-model-empty')).toBeVisible();
    await page.locator('.uml-pg-model-empty').getByRole('button', { name: '+ Class' }).click();
    await expect(page.locator('.uml-pg-edit-hitbox[data-layout-id="Class"]')).toHaveCount(1);
    await expect(page.locator('#uml-pg-input')).toHaveValue(/class Class/);

    await page.locator('#uml-pg-input').fill('@startuml\n@enduml');
    await page.locator('#uml-pg-input').dispatchEvent('input');
    await expect(page.locator('.uml-pg-model-empty')).toBeVisible();
    await page.locator('#uml-pg-palette-elements .uml-pg-tool-btn[data-tool-spec="interface"]').click();
    await expect(page.locator('.uml-pg-edit-hitbox[data-layout-id="IFace"]')).toHaveCount(1);
    await expect(page.locator('#uml-pg-input')).toHaveValue(/interface IFace/);
  });

  test('element tools can place on the whole preview surface, not only inside the SVG box', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'class');

    const point = await previewBlankPoint(page);
    await page.locator('#uml-pg-palette-elements .uml-pg-tool-btn[data-tool-spec="class"]').click();
    await page.mouse.click(point.x, point.y);

    await expect(page.locator('#uml-pg-input')).toHaveValue(/class Class @pos\(/);
    await expect(page.locator('.uml-pg-edit-hitbox[data-layout-id="Class"]')).toHaveCount(1);
  });

  test('element tools can place across the preview after zooming out', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'class');

    await page.locator('#uml-pg-zoom-out').click();
    await page.locator('#uml-pg-zoom-out').click();
    const point = await previewBlankPoint(page);
    await page.locator('#uml-pg-palette-elements .uml-pg-tool-btn[data-tool-spec="class"]').click();
    await page.mouse.click(point.x, point.y);

    await expect(page.locator('#uml-pg-input')).toHaveValue(/class Class @pos\(/);
  });

  test('class labels and notes edit with valid class-diagram source', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'class');

    await page.locator('#uml-pg-palette-elements .uml-pg-tool-btn[data-tool-spec="note"]').click();
    await page.locator('.uml-pg-edit-a11y-target[data-layout-id="Animal"]').press('Enter');
    await expect(page.locator('#uml-pg-input')).toHaveValue(/note right of Animal: New note/);
    const noteHandle = page.locator('.uml-pg-edit-hitbox[data-layout-id^="note:"]');
    await expect(noteHandle).toHaveCount(1);

    const noteBefore = await noteHandle.boundingBox();
    await dragLocatorCenter(page, noteHandle, 60, 35);
    const noteAfter = await noteHandle.boundingBox();
    if (!noteBefore || !noteAfter) throw new Error('note handle should have a box before and after dragging');
    expect(noteAfter.x).toBeGreaterThan(noteBefore.x + 25);
    await expect(page.locator('#uml-pg-input')).toHaveValue(/node "note:\d+" x=\d+ y=\d+/);

    await page.locator('.uml-pg-edit-hitbox[data-layout-id="Animal"]').evaluate((el) => {
      const r = el.getBoundingClientRect();
      el.dispatchEvent(new MouseEvent('dblclick', {
        bubbles: true,
        cancelable: true,
        clientX: r.left + r.width / 2,
        clientY: r.top + r.height / 2,
      }));
    });
    await page.locator('.uml-pg-inline-input').fill('Mammal');
    await page.locator('.uml-pg-inline-input').press('Enter');
    await expect(page.locator('#uml-pg-input')).toHaveValue(/abstract class Mammal/);
    await expect(page.locator('#uml-pg-input')).toHaveValue(/Dog --\|> Mammal/);
    await expect(page.locator('#uml-pg-input')).not.toHaveValue(/as Animal/);
  });

  test('state empty state can add states and start transitions', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'state');

    await page.locator('#uml-pg-input').fill('@startuml\n@enduml');
    await page.locator('#uml-pg-input').dispatchEvent('input');

    await expect(page.locator('.uml-pg-model-empty')).toBeVisible();
    await page.locator('.uml-pg-model-empty').getByRole('button', { name: '+ State' }).click();
    await expect(page.locator('.uml-pg-edit-hitbox[data-layout-id="State"]')).toHaveCount(1);
    await expect(page.locator('#uml-pg-input')).toHaveValue(/state State/);

    await page.locator('#uml-pg-input').fill('@startuml\n@enduml');
    await page.locator('#uml-pg-input').dispatchEvent('input');
    await expect(page.locator('.uml-pg-model-empty')).toBeVisible();
    await page.locator('#uml-pg-palette-elements .uml-pg-tool-btn[data-tool-spec="initial"]').click();
    await expect(page.locator('.uml-pg-edit-hitbox[data-layout-id="New"]')).toHaveCount(1);
    await expect(page.locator('#uml-pg-input')).toHaveValue(/\[\*\] --> New/);
  });

  test('state transition labels edit in place as transitions', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'state');
    await page.locator('#uml-pg-input').fill('@startuml\nA --> B : oldEvent\n@enduml');
    await page.locator('#uml-pg-input').dispatchEvent('input');

    await page.locator('.uml-pg-edge-hitbox').first().evaluate((el) => {
      const r = el.getBoundingClientRect();
      el.dispatchEvent(new MouseEvent('dblclick', {
        bubbles: true,
        cancelable: true,
        clientX: r.left + r.width / 2,
        clientY: r.top + r.height / 2,
      }));
    });
    await page.locator('.uml-pg-inline-input').fill('newEvent');
    await page.locator('.uml-pg-inline-input').press('Enter');
    await expect(page.locator('#uml-pg-input')).toHaveValue(/A --> B : newEvent/);
  });

  test('class diagram element overlays align with rendered boxes', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'class');
    await selectEditMode(page, 'nodes');

    const alignment = await page.evaluate(() => {
      const svg = document.querySelector('#uml-pg-output svg');
      const hitboxes = Array.from(svg.querySelectorAll('.uml-pg-edit-hitbox'));
      const shapes = Array.from(svg.querySelectorAll('rect,circle,ellipse,polygon,path')).filter(
        (el) => !el.closest('.uml-pg-edit-layer') && !el.closest('defs')
      );

      return hitboxes.map((hitbox) => {
        const b = hitbox.getBBox();
        const cx = b.x + b.width / 2;
        const cy = b.y + b.height / 2;
        const containing = shapes.filter((shape) => {
          try {
            const sb = shape.getBBox();
            return cx >= sb.x - 1 && cx <= sb.x + sb.width + 1 && cy >= sb.y - 1 && cy <= sb.y + sb.height + 1;
          } catch (_) {
            return false;
          }
        }).length;
        return { id: hitbox.getAttribute('data-layout-id'), containing };
      });
    });

    expect(alignment.length).toBe(4);
    for (const item of alignment) {
      expect(item.containing, `${item.id} overlay should be centered on rendered geometry`).toBeGreaterThan(0);
    }
  });

  test('dragging component boxes and sequence lifelines emits ArchUML positions', async ({ page }) => {
    await openPlayground(page);

    await selectDiagram(page, 'component');
    await selectEditMode(page, 'nodes');
    await dragLocatorCenter(page, page.locator('.uml-pg-edit-hitbox').first(), 35, 20);
    let source = await page.locator('#uml-pg-input').inputValue();
    expect(source).toMatch(/component\s+\S+.*@pos\(\d+,\s*\d+\)/);

    await page.reload();
    await page.waitForSelector('#uml-pg-output svg');
    await page.check('#uml-pg-edit');
    await selectDiagram(page, 'sequence');
    await selectEditMode(page, 'nodes');
    const initialTop = Math.round(Number(await page.locator('.uml-pg-edit-hitbox').nth(1).getAttribute('y')));
    await dragLocatorCenter(page, page.locator('.uml-pg-edit-hitbox').nth(1), 40, 35);
    source = await page.locator('#uml-pg-input').inputValue();

    const sequencePos = source.match(/participant\s+app: Application\s+@pos\((\d+),\s*(\d+)\)/);
    expect(sequencePos, source).not.toBeNull();
    expect(Number(sequencePos[2])).toBe(initialTop);
  });

  test('dragging component boxes keeps port connectors attached after rerender', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'component');
    await page.uncheck('#uml-pg-snap');
    await selectEditMode(page, 'nodes');

    const before = await componentConnectionInfo(page);
    expect(before, 'component route should expose port endpoints').not.toBeNull();

    await dragLocatorCenter(page, page.locator('.uml-pg-edit-hitbox[data-layout-id="Frontend"]'), 75, 35);

    const after = await componentConnectionInfo(page);
    expect(after, 'component route should survive component drag').not.toBeNull();
    expect(after.sourceComponent.x).toBeGreaterThan(before.sourceComponent.x + 50);
    expect(after.sourcePort.cx).toBeGreaterThan(before.sourcePort.cx + 50);
    expectEndpointTouchesPort(after.sourceEndpoint, after.sourcePort);
    expectEndpointTouchesPort(after.targetEndpoint, after.targetPort);

    const source = await page.locator('#uml-pg-input').inputValue();
    expect(source).toMatch(/component\s+Frontend\s+@pos\(\d+,\s*\d+\)/);
  });

  test('dragging component ports stays on the component outline and reroutes connectors', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'component');
    await page.uncheck('#uml-pg-snap');
    await selectEditMode(page, 'nodes');

    const before = await componentConnectionInfo(page, 'Backend.b_eventout', 'EventBus.eb_in');
    expect(before, 'component route should expose port endpoints').not.toBeNull();

    const portHandle = page.locator('.uml-pg-edit-hitbox[data-layout-id="Backend.b_eventout"]');
    await expect(portHandle).toHaveCount(1);
    await dragLocatorCenter(page, portHandle, 38, -34);

    const after = await componentConnectionInfo(page, 'Backend.b_eventout', 'EventBus.eb_in');
    expect(after, 'component route should survive port drag').not.toBeNull();
    expect(after.sourcePort.side).toBe('right');
    expect(after.sourcePort.cy).toBeLessThan(before.sourcePort.cy - 20);
    expectEndpointTouchesPort(after.sourceEndpoint, after.sourcePort);
    expectEndpointTouchesPort(after.targetEndpoint, after.targetPort);
    expect(after.points).not.toEqual(before.points);

    const source = await page.locator('#uml-pg-input').inputValue();
    expect(source).toContain('node "Backend.b_eventout" x=');
  });

  test('dragging component ports can move to another edge and reroute connectors', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'component');
    await page.uncheck('#uml-pg-snap');
    await selectEditMode(page, 'nodes');

    const before = await componentConnectionInfo(page);
    expect(before, 'component route should expose port endpoints').not.toBeNull();
    const portHandle = page.locator('.uml-pg-edit-hitbox[data-layout-id="Backend.b_in"]');
    await dragLocatorCenter(page, portHandle, 90, -34);

    const after = await componentConnectionInfo(page);
    expect(after, 'component route should survive cross-edge port drag').not.toBeNull();
    expect(after.targetPort.side).toBe('top');
    expect(Math.abs(after.targetPort.cy - after.targetComponent.y)).toBeLessThanOrEqual(2);
    expectEndpointTouchesPort(after.targetEndpoint, after.targetPort);
    expect(after.points).not.toEqual(before.points);

    const source = await page.locator('#uml-pg-input').inputValue();
    expect(source).toContain('node "Backend.b_in" x=');
  });

  test('dragging component ports can swap order on the same edge', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'component');
    await page.uncheck('#uml-pg-snap');
    await selectEditMode(page, 'nodes');

    const dbBefore = await componentPortInfo(page, 'Backend.b_dbout');
    const eventBefore = await componentPortInfo(page, 'Backend.b_eventout');
    expect(dbBefore, 'dbOut port should be visible').not.toBeNull();
    expect(eventBefore, 'eventOut port should be visible').not.toBeNull();
    expect(dbBefore.side).toBe('right');
    expect(eventBefore.side).toBe('right');
    expect(eventBefore.cy).toBeGreaterThan(dbBefore.cy);

    await dragLocatorCenter(page, page.locator('.uml-pg-edit-hitbox[data-layout-id="Backend.b_eventout"]'), 38, -50);

    const dbAfter = await componentPortInfo(page, 'Backend.b_dbout');
    const eventAfter = await componentPortInfo(page, 'Backend.b_eventout');
    const eventRoute = await componentConnectionInfo(page, 'Backend.b_eventout', 'EventBus.eb_in');
    expect(dbAfter.side).toBe('right');
    expect(eventAfter.side).toBe('right');
    expect(eventAfter.cy).toBeLessThan(dbAfter.cy);
    expectEndpointTouchesPort(eventRoute.sourceEndpoint, eventRoute.sourcePort);

    const source = await page.locator('#uml-pg-input').inputValue();
    expect(source).toContain('node "Backend.b_eventout" x=');
  });

  test('dragging component connector labels emits label positions and replays them', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'component');
    await page.uncheck('#uml-pg-snap');
    await selectEditMode(page, 'nodes');

    const labelHandle = page.locator('.uml-pg-edit-hitbox[data-layout-id="label:edge-0"]');
    await expect(labelHandle).toHaveCount(1);
    const before = await componentLabelInfo(page, 'label:edge-0');
    expect(before, 'connector label should expose a movable handle').not.toBeNull();

    await dragLocatorCenter(page, labelHandle, 46, -24);

    const after = await componentLabelInfo(page, 'label:edge-0');
    expect(after.text).toContain('REST / JSON');
    expect(after.x).toBeGreaterThan(before.x + 30);
    expect(after.y).toBeLessThan(before.y - 10);

    const source = await page.locator('#uml-pg-input').inputValue();
    expect(source).toContain('node "label:edge-0" x=');

    await page.locator('#uml-pg-reset-one').click();
    const resetSource = await page.locator('#uml-pg-input').inputValue();
    expect(resetSource).not.toContain('node "label:edge-0" x=');
  });

  test('dragging line segments emits route metadata and reset selected removes it', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'class');
    await selectEditMode(page, 'lines');

    const handleCount = await page.locator('.uml-pg-edge-hitbox').count();
    expect(handleCount).toBeGreaterThan(0);
    await dragLocatorCenter(page, page.locator('.uml-pg-edge-hitbox').first(), 0, 35);
    let source = await page.locator('#uml-pg-input').inputValue();
    expect(source).toMatch(/@layout schema=1 renderer="archuml-visual-editor"/);
    expect(source).toMatch(/edge "edge-\d+" points="/);

    await page.locator('#uml-pg-reset-one').click();
    source = await page.locator('#uml-pg-input').inputValue();
    expect(source).not.toMatch(/edge "edge-\d+" points="/);
  });

  test('selected relations can be inverted from the properties pane', async ({ page }) => {
    await page.goto(UML_EDITOR_URL);
    await page.waitForSelector('#uml-pg-edit');
    await page.check('#uml-pg-edit');
    const baseSource = `@startuml
class A
class B
A --> B : calls
@enduml`;
    await page.locator('#uml-pg-input').evaluate((el, value) => {
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, baseSource);
    await page.waitForFunction(() => {
      const svg = document.querySelector('#uml-pg-output svg');
      return !!svg && svg.textContent.includes('calls') && document.querySelectorAll('.uml-pg-edge-hitbox').length > 0;
    });
    const routeId = await page.locator('.uml-pg-edge-hitbox').first().getAttribute('data-layout-id');
    expect(routeId).toBeTruthy();
    const escapedRouteId = routeId.replace(/"/g, '\\"');

    const sourceWithRoute = `@startuml
@layout schema=1 renderer="archuml-visual-editor"
edge "${escapedRouteId}" points="10,20 30,20 30,60 50,60"
@endlayout
class A
class B
A --> B : calls
@enduml`;
    await page.locator('#uml-pg-input').evaluate((el, value) => {
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, sourceWithRoute);
    await page.waitForFunction(() => {
      const svg = document.querySelector('#uml-pg-output svg');
      return !!svg && svg.textContent.includes('calls') && document.querySelectorAll('.uml-pg-edge-hitbox').length > 0;
    });
    const routeHandle = page.locator('.uml-pg-edge-hitbox').first();
    await expect(routeHandle).toHaveCount(1);

    await routeHandle.evaluate((el) => {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });
    await page.locator('#uml-pg-props-content').getByRole('button', { name: 'Invert direction' }).click();

    const expectedRouteId = routeId.replace(/^edge:([^|]+)\|([^|]+)$/, 'edge:$2|$1');
    const source = await page.locator('#uml-pg-input').inputValue();
    expect(source).toContain('B --> A : calls');
    expect(source).toContain(`edge "${expectedRouteId}" points="50,60 30,60 30,20 10,20"`);
  });

  [
    { label: 'aggregation', op: 'o--' },
    { label: 'composition', op: '*--' },
  ].forEach(({ label, op }) => {
    test(`selected ${label} relations can be inverted and deleted`, async ({ page }) => {
      const escapedOp = op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      await page.goto(UML_EDITOR_URL);
      await page.waitForSelector('#uml-pg-edit');
      await page.check('#uml-pg-edit');
      await page.locator('#uml-pg-input').evaluate((el, value) => {
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }, `@startuml
class A
class B
A ${op} B : owns
@enduml`);
      await page.waitForFunction(() => {
        const svg = document.querySelector('#uml-pg-output svg');
        return !!svg && svg.textContent.includes('owns') && document.querySelectorAll('.uml-pg-edge-hitbox').length > 0;
      });

      await page.locator('.uml-pg-edge-hitbox').first().evaluate((el) => {
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      });
      await page.locator('#uml-pg-props-content').getByRole('button', { name: 'Invert direction' }).click();
      await expect(page.locator('#uml-pg-input')).toHaveValue(new RegExp(`B ${escapedOp} A : owns`));

      await page.locator('.uml-pg-edge-hitbox').first().evaluate((el) => {
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }));
      });
      await expect(page.locator('#uml-pg-input')).not.toHaveValue(new RegExp(`\\b[AB] ${escapedOp} [AB] : owns`));
    });
  });

  [
    { label: 'aggregation', reverseOp: '--o', canonicalOp: 'o--' },
    { label: 'composition', reverseOp: '--*', canonicalOp: '*--' },
  ].forEach(({ label, reverseOp, canonicalOp }) => {
    test(`target-side ${label} markers can be recognized and inverted`, async ({ page }) => {
      const escapedCanonicalOp = canonicalOp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      await page.goto(UML_EDITOR_URL);
      await page.waitForSelector('#uml-pg-edit');
      await page.check('#uml-pg-edit');
      await page.locator('#uml-pg-input').evaluate((el, value) => {
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }, `@startuml
class A
class B
A ${reverseOp} B : owns
@enduml`);
      await page.waitForFunction(() => {
        const svg = document.querySelector('#uml-pg-output svg');
        return !!svg && svg.textContent.includes('owns') && document.querySelectorAll('.uml-pg-edge-hitbox').length > 0;
      });

      await page.locator('.uml-pg-edge-hitbox').first().evaluate((el) => {
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      });
      await expect(page.locator('#uml-pg-props-content').getByLabel('Type')).toHaveValue(label === 'aggregation' ? 'aggregate' : 'compose');
      await page.locator('#uml-pg-props-content').getByRole('button', { name: 'Invert direction' }).click();
      await expect(page.locator('#uml-pg-input')).toHaveValue(new RegExp(`A ${escapedCanonicalOp} B : owns`));

      await page.locator('.uml-pg-edge-hitbox').first().evaluate((el) => {
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }));
      });
      await expect(page.locator('#uml-pg-input')).not.toHaveValue(/\b[AB]\s+(?:o--|\*--|--o|--\*)\s+[AB]\s*:\s*owns/);
    });
  });

  test('left-arrow generalization syntax is parsed as an invertible generalization', async ({ page }) => {
    await page.goto(UML_EDITOR_URL);
    await page.waitForSelector('#uml-pg-edit');
    await page.check('#uml-pg-edit');
    await page.locator('#uml-pg-input').evaluate((el) => {
      el.value = `@startuml
class Parent
class Child
Parent <|-- Child
@enduml`;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForFunction(() => {
      const svg = document.querySelector('#uml-pg-output svg');
      return !!svg && svg.textContent.includes('Parent') && document.querySelectorAll('.uml-pg-edge-hitbox').length > 0;
    });

    await page.locator('.uml-pg-edge-hitbox').first().evaluate((el) => {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });
    await expect(page.locator('#uml-pg-props-content').getByLabel('Type')).toHaveValue('gen');
    await page.locator('#uml-pg-props-content').getByRole('button', { name: 'Invert direction' }).click();

    const source = await page.locator('#uml-pg-input').inputValue();
    expect(source).toContain('Parent --|> Child');
    expect(source).not.toContain('Parent <|-- Child');
  });

  test('selected class relations can edit multiplicities and navigability', async ({ page }) => {
    await page.goto(UML_EDITOR_URL);
    await page.waitForSelector('#uml-pg-edit');
    await page.check('#uml-pg-edit');
    await page.locator('#uml-pg-input').evaluate((el) => {
      el.value = `@startuml
class Customer
class Order
Customer -- Order : places
@enduml`;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForFunction(() => {
      const svg = document.querySelector('#uml-pg-output svg');
      return !!svg && svg.textContent.includes('places') && document.querySelectorAll('.uml-pg-edge-hitbox').length > 0;
    });

    await page.locator('.uml-pg-edge-hitbox').first().evaluate((el) => {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });
    await expect(page.locator('#uml-pg-props-content').getByLabel('Type')).toHaveValue('plain');

    await page.locator('#uml-pg-props-content').getByLabel('Source multiplicity / cardinality').fill('1');
    await page.locator('#uml-pg-props-content').getByLabel('Source multiplicity / cardinality').press('Enter');
    await expect(page.locator('#uml-pg-input')).toHaveValue(/Customer "1" -- Order : places/);

    await page.locator('#uml-pg-props-content').getByLabel('Target multiplicity / cardinality').fill('0..*');
    await page.locator('#uml-pg-props-content').getByLabel('Target multiplicity / cardinality').press('Enter');
    await expect(page.locator('#uml-pg-input')).toHaveValue(/Customer "1" -- "0\.\.\*" Order : places/);

    await page.locator('#uml-pg-props-content').getByLabel('Navigability').selectOption('bidirectional');
    await expect(page.locator('#uml-pg-input')).toHaveValue(/Customer "1" <--> "0\.\.\*" Order : places/);
    await expect(page.locator('#uml-pg-props-content').getByLabel('Navigability')).toHaveValue('bidirectional');

    await page.locator('#uml-pg-props-content').getByLabel('Navigability').selectOption('nonnav');
    await expect(page.locator('#uml-pg-input')).toHaveValue(/Customer "1" --x "0\.\.\*" Order : places/);
    await expect(page.locator('#uml-pg-props-content').getByLabel('Type')).toHaveValue('assoc');
    await expect(page.locator('#uml-pg-props-content').getByLabel('Navigability')).toHaveValue('nonnav');
  });

  test('class relation properties resolve the selected relation after hierarchy routes', async ({ page }) => {
    await page.goto(UML_EDITOR_URL);
    await page.waitForSelector('#uml-pg-edit');
    await page.check('#uml-pg-edit');
    await page.locator('#uml-pg-input').evaluate((el) => {
      el.value = `@startuml
class Player
abstract class PlayerState
class NormalTurnState
NormalTurnState --|> PlayerState
Player -- PlayerState : current
@enduml`;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForSelector('.uml-pg-edge-hitbox[data-layout-id="rel:5"]', { state: 'attached' });

    await page.locator('.uml-pg-edge-hitbox[data-layout-id="rel:5"]').first().evaluate((el) => {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });

    await expect(page.locator('#uml-pg-props-content').getByLabel('Type')).toHaveValue('plain');
    await expect(page.locator('#uml-pg-props-content').getByLabel('Source multiplicity / cardinality')).toBeVisible();
    await expect(page.locator('#uml-pg-props-content').getByLabel('Target multiplicity / cardinality')).toBeVisible();
    await expect(page.locator('#uml-pg-props-content').getByLabel('Navigability')).toBeVisible();

    await page.locator('#uml-pg-props-content').getByLabel('Navigability').selectOption('navigable');
    await expect(page.locator('#uml-pg-input')).toHaveValue(/Player --> PlayerState : current/);
    await expect(page.locator('#uml-pg-props-content').getByLabel('Type')).toHaveValue('assoc');
  });

  test('selected aggregation relations keep type while changing navigability', async ({ page }) => {
    await page.goto(UML_EDITOR_URL);
    await page.waitForSelector('#uml-pg-edit');
    await page.check('#uml-pg-edit');
    await page.locator('#uml-pg-input').evaluate((el) => {
      el.value = `@startuml
class Team
class Player
Team o-- Player : roster
@enduml`;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForFunction(() => {
      const svg = document.querySelector('#uml-pg-output svg');
      return !!svg && svg.textContent.includes('roster') && document.querySelectorAll('.uml-pg-edge-hitbox').length > 0;
    });

    await page.locator('.uml-pg-edge-hitbox').first().evaluate((el) => {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });
    await expect(page.locator('#uml-pg-props-content').getByLabel('Type')).toHaveValue('aggregate');

    await page.locator('#uml-pg-props-content').getByLabel('Navigability').selectOption('navigable');
    await expect(page.locator('#uml-pg-input')).toHaveValue(/Team o--> Player : roster/);
    await expect(page.locator('#uml-pg-props-content').getByLabel('Type')).toHaveValue('aggregate');
    await expect(page.locator('#uml-pg-props-content').getByLabel('Navigability')).toHaveValue('navigable');

    await page.locator('#uml-pg-props-content').getByLabel('Navigability').selectOption('bidirectional');
    await expect(page.locator('#uml-pg-input')).toHaveValue(/Team o<--> Player : roster/);
    await expect(page.locator('#uml-pg-props-content').getByLabel('Type')).toHaveValue('aggregate');
    await expect(page.locator('#uml-pg-props-content').getByLabel('Navigability')).toHaveValue('bidirectional');
  });

  test('selected relations can be rewired from the properties pane', async ({ page }) => {
    await page.goto(UML_EDITOR_URL);
    await page.waitForSelector('#uml-pg-edit');
    await page.check('#uml-pg-edit');
    const baseSource = `@startuml
class A
class B
class C
A --> B : calls
@enduml`;
    await page.locator('#uml-pg-input').evaluate((el, value) => {
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, baseSource);
    await page.waitForFunction(() => {
      const svg = document.querySelector('#uml-pg-output svg');
      return !!svg && svg.textContent.includes('calls') && document.querySelectorAll('.uml-pg-edge-hitbox').length > 0;
    });
    const routeId = await page.locator('.uml-pg-edge-hitbox').first().getAttribute('data-layout-id');
    expect(routeId).toBeTruthy();
    const escapedRouteId = routeId.replace(/"/g, '\\"');
    const sourceWithRoute = `@startuml
@layout schema=1 renderer="archuml-visual-editor"
edge "${escapedRouteId}" points="10,20 30,20 30,60 50,60"
@endlayout
class A
class B
class C
A --> B : calls
@enduml`;
    await page.locator('#uml-pg-input').evaluate((el, value) => {
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, sourceWithRoute);
    await page.waitForFunction(() => {
      const svg = document.querySelector('#uml-pg-output svg');
      return !!svg && svg.textContent.includes('calls') && document.querySelectorAll('.uml-pg-edge-hitbox').length > 0;
    });
    const routeHandle = page.locator('.uml-pg-edge-hitbox').first();
    await expect(routeHandle).toHaveCount(1);

    await routeHandle.evaluate((el) => {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });
    await page.locator('#uml-pg-props-content').getByLabel('Target endpoint').selectOption('C');

    const source = await page.locator('#uml-pg-input').inputValue();
    expect(source).toContain('A --> C : calls');
    expect(source).not.toContain('A --> B : calls');
    expect(source).not.toContain('points="10,20 30,20 30,60 50,60"');
  });

  test('dragging an already selected relation tool connects without reopening the chooser', async ({ page }) => {
    await page.goto(UML_EDITOR_URL);
    await page.waitForSelector('#uml-pg-edit');
    await page.check('#uml-pg-edit');
    await page.locator('#uml-pg-input').evaluate((el) => {
      el.value = `@startuml
class Animal @pos(80, 110)
class Dog @pos(330, 110)
@enduml`;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForSelector('.uml-pg-edit-hitbox[data-layout-id="Animal"]');
    await page.waitForSelector('.uml-pg-edit-hitbox[data-layout-id="Dog"]');

    const dependencyTool = page.locator('#uml-pg-palette-relations .uml-pg-tool-btn[data-tool-spec="depend"]');
    await dependencyTool.click();
    await expect(dependencyTool).toHaveAttribute('aria-pressed', 'true');

    const handle = page.getByRole('button', { name: 'Extend a relation from Animal', exact: true });
    const target = page.locator('.uml-pg-edit-hitbox[data-layout-id="Dog"]');
    await handle.hover({ force: true });
    const handleBox = await handle.boundingBox();
    const targetBox = await target.boundingBox();
    if (!handleBox || !targetBox) throw new Error('relation drag handle and target should have boxes');

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 8 });
    await page.mouse.up();

    await expect(page.locator('.uml-pg-relation-chooser')).toHaveCount(0);
    await expect(page.locator('#uml-pg-input')).toHaveValue(/Animal \.\.> Dog/);
    await expect(dependencyTool).toHaveAttribute('aria-pressed', 'true');
  });

  test('dragging state-machine pseudo-state routes keeps endpoints anchored', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'state');
    await page.uncheck('#uml-pg-snap');
    await selectEditMode(page, 'lines');

    const before = await statePseudoRouteFor(page);
    expect(before, 'state diagram should expose an editable initial/final route').not.toBeNull();

    const handle = page.locator(`.uml-pg-edge-hitbox[data-layout-id="${before.id}"]`).first();
    const segment = await handle.evaluate((el) => ({
      x1: Number(el.getAttribute('x1')),
      y1: Number(el.getAttribute('y1')),
      x2: Number(el.getAttribute('x2')),
      y2: Number(el.getAttribute('y2')),
    }));
    const horizontal = Math.abs(segment.x2 - segment.x1) >= Math.abs(segment.y2 - segment.y1);
    await dragLocatorCenter(page, handle, horizontal ? 0 : 36, horizontal ? 36 : 0);

    const after = await routeInfoFor(page, before.id);
    expect(after, 'edited route should still be discoverable').not.toBeNull();
    expect(after.points.length).toBeGreaterThan(before.points.length);
    expect(after.points[0].x).toBeCloseTo(before.points[0].x, 1);
    expect(after.points[0].y).toBeCloseTo(before.points[0].y, 1);
    expect(after.points[after.points.length - 1].x).toBeCloseTo(before.points[before.points.length - 1].x, 1);
    expect(after.points[after.points.length - 1].y).toBeCloseTo(before.points[before.points.length - 1].y, 1);

    const source = await page.locator('#uml-pg-input').inputValue();
    expect(source).toContain(`edge "${before.id}" points="`);
  });

  test('dragging state-machine regular transitions keeps endpoints anchored', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'state');
    await page.uncheck('#uml-pg-snap');
    await selectEditMode(page, 'lines');

    const before = await stateRegularRouteFor(page);
    expect(before, 'state diagram should expose an editable regular transition route').not.toBeNull();

    const handle = page.locator(`.uml-pg-edge-hitbox[data-layout-id="${before.id}"]`).first();
    const segment = await handle.evaluate((el) => ({
      x1: Number(el.getAttribute('x1')),
      y1: Number(el.getAttribute('y1')),
      x2: Number(el.getAttribute('x2')),
      y2: Number(el.getAttribute('y2')),
    }));
    const horizontal = Math.abs(segment.x2 - segment.x1) >= Math.abs(segment.y2 - segment.y1);
    await dragLocatorCenter(page, handle, horizontal ? 0 : 32, horizontal ? 32 : 0);

    const after = await routeInfoFor(page, before.id);
    expect(after, 'edited regular transition should still be discoverable').not.toBeNull();
    expect(after.points[0].x).toBeCloseTo(before.points[0].x, 1);
    expect(after.points[0].y).toBeCloseTo(before.points[0].y, 1);
    expect(after.points[after.points.length - 1].x).toBeCloseTo(before.points[before.points.length - 1].x, 1);
    expect(after.points[after.points.length - 1].y).toBeCloseTo(before.points[before.points.length - 1].y, 1);
    expect(
      after.points.length !== before.points.length ||
      after.points.some((p, idx) => {
        const old = before.points[idx];
        return old && (Math.abs(p.x - old.x) > 1 || Math.abs(p.y - old.y) > 1);
      })
    ).toBe(true);

    const source = await page.locator('#uml-pg-input').inputValue();
    expect(source).toContain(`edge "${before.id}" points="`);
  });

  test('state transition handles stay aligned with live routes during node drag', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'state');
    await page.uncheck('#uml-pg-snap');
    await selectEditMode(page, 'nodes');
    await page.locator('#uml-pg-input').evaluate((el) => {
      el.value = `@startuml
state A
state B
A --> B : go
@enduml`;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForSelector('.uml-pg-edit-hitbox[data-layout-id="A"]');
    await expect(page.locator('.uml-pg-edge-hitbox')).toHaveCount(1);

    const aHandle = page.locator('.uml-pg-edit-hitbox[data-layout-id="A"]');
    const box = await aHandle.boundingBox();
    if (!box) throw new Error('state A handle should have a box');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 95, cy + 45, { steps: 8 });

    const alignment = await page.evaluate(() => {
      const svg = document.querySelector('#uml-pg-output svg');
      if (!svg) return null;
      const movedBoxEl = svg.querySelector('.uml-pg-edit-hitbox[data-layout-id="A"]');
      const handle = svg.querySelector('.uml-pg-edge-hitbox');
      if (!movedBoxEl || !handle) return null;
      const routes = window.UMLShared.collectEditableRoutes(svg);
      const route = routes.find((item) => item.id === handle.getAttribute('data-route-id'));
      if (!route) return null;

      const movedBox = {
        x: Number(movedBoxEl.getAttribute('x')),
        y: Number(movedBoxEl.getAttribute('y')),
        width: Number(movedBoxEl.getAttribute('width')),
        height: Number(movedBoxEl.getAttribute('height')),
      };
      const pad = 14;
      const endpointTouchesMovedState = [route.points[0], route.points[route.points.length - 1]].some((point) =>
        point.x >= movedBox.x - pad &&
        point.x <= movedBox.x + movedBox.width + pad &&
        point.y >= movedBox.y - pad &&
        point.y <= movedBox.y + movedBox.height + pad
      );

      const idx = Number(handle.getAttribute('data-segment-index'));
      let p1 = route.points[idx];
      let p2 = route.points[idx + 1];
      if (handle.getAttribute('data-locked-endpoints') === 'true' && route.points.length === 4 && idx === 0) {
        p1 = route.points[1];
        p2 = route.points[2];
      }
      if (!p1 || !p2) return null;

      return {
        endpointTouchesMovedState,
        x1Delta: Math.abs(Number(handle.getAttribute('x1')) - p1.x),
        y1Delta: Math.abs(Number(handle.getAttribute('y1')) - p1.y),
        x2Delta: Math.abs(Number(handle.getAttribute('x2')) - p2.x),
        y2Delta: Math.abs(Number(handle.getAttribute('y2')) - p2.y),
      };
    });

    await page.mouse.up();

    expect(alignment, 'state route and handle should be inspectable while dragging').not.toBeNull();
    expect(alignment.endpointTouchesMovedState).toBe(true);
    expect(alignment.x1Delta).toBeLessThan(0.5);
    expect(alignment.y1Delta).toBeLessThan(0.5);
    expect(alignment.x2Delta).toBeLessThan(0.5);
    expect(alignment.y2Delta).toBeLessThan(0.5);
  });

  test('dragging a class re-attaches a persisted association route to its new edge', async ({ page }) => {
    // Regression: previously, when a node was moved and a connected route had
    // been dragged earlier (so it had explicit `points=` overrides), the
    // saved overrides kept the old endpoint coordinates. After re-render,
    // applyLayoutRoutes overrode the freshly-computed endpoints with the
    // stale points, leaving the association detached from the moved class.
    await openPlayground(page);
    await selectDiagram(page, 'class');
    await page.uncheck('#uml-pg-snap');
    await selectEditMode(page, 'nodes');
    await page.locator('#uml-pg-input').evaluate((el) => {
      el.value = `@startuml
class Foo @pos(100, 100)
class Bar @pos(400, 250)
Foo --> Bar
@enduml`;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForSelector('.uml-pg-edit-hitbox[data-layout-id="Foo"]');
    await page.waitForSelector('.uml-pg-edit-hitbox[data-layout-id="Bar"]');

    // Build a route override whose endpoints actually touch each class so
    // proximity-based detection picks them up as connected to Foo / Bar.
    const setup = await page.evaluate(() => {
      const svg = document.querySelector('#uml-pg-output svg');
      const fooBox = svg.querySelector('.uml-pg-edit-hitbox[data-layout-id="Foo"]');
      const barBox = svg.querySelector('.uml-pg-edit-hitbox[data-layout-id="Bar"]');
      const fx = Number(fooBox.getAttribute('x'));
      const fy = Number(fooBox.getAttribute('y'));
      const fw = Number(fooBox.getAttribute('width'));
      const fh = Number(fooBox.getAttribute('height'));
      const bx = Number(barBox.getAttribute('x'));
      const by = Number(barBox.getAttribute('y'));
      const bh = Number(barBox.getAttribute('height'));
      return {
        fooRightEdge: { x: fx + fw, y: fy + fh / 2 },
        barLeftEdge: { x: bx, y: by + bh / 2 },
      };
    });

    const startPoints = [
      `${setup.fooRightEdge.x},${setup.fooRightEdge.y}`,
      `${setup.fooRightEdge.x + 60},${setup.fooRightEdge.y}`,
      `${setup.fooRightEdge.x + 60},${setup.barLeftEdge.y}`,
      `${setup.barLeftEdge.x},${setup.barLeftEdge.y}`,
    ].join(' ');

    await page.locator('#uml-pg-input').evaluate((el, points) => {
      el.value = `@layout schema=1 renderer="archuml-visual-editor"
edge "edge-0" points="${points}"
@endlayout
@startuml
class Foo @pos(100, 100)
class Bar @pos(400, 250)
Foo --> Bar
@enduml`;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, startPoints);
    await page.waitForFunction(() => {
      const svg = document.querySelector('#uml-pg-output svg');
      if (!svg) return false;
      const routes = window.UMLShared.collectEditableRoutes(svg);
      return routes.some((r) => r.id === 'edge-0');
    });

    // Drag Foo. After mouse.up, the source is rewritten and the diagram
    // re-renders; the assertion runs against the post-render state.
    await dragLocatorCenter(page, page.locator('.uml-pg-edit-hitbox[data-layout-id="Foo"]'), 80, 35);

    const after = await page.evaluate(() => {
      const svg = document.querySelector('#uml-pg-output svg');
      const fooBox = svg.querySelector('.uml-pg-edit-hitbox[data-layout-id="Foo"]');
      const barBox = svg.querySelector('.uml-pg-edit-hitbox[data-layout-id="Bar"]');
      const routes = window.UMLShared.collectEditableRoutes(svg);
      const route = routes.find((r) => r.id === 'edge-0');
      if (!fooBox || !barBox || !route) return null;
      const f = {
        x: Number(fooBox.getAttribute('x')),
        y: Number(fooBox.getAttribute('y')),
        w: Number(fooBox.getAttribute('width')),
        h: Number(fooBox.getAttribute('height')),
      };
      const b = {
        x: Number(barBox.getAttribute('x')),
        y: Number(barBox.getAttribute('y')),
        w: Number(barBox.getAttribute('width')),
        h: Number(barBox.getAttribute('height')),
      };
      const first = route.points[0];
      const last = route.points[route.points.length - 1];
      const pad = 4;
      const inFoo = (p) => p.x >= f.x - pad && p.x <= f.x + f.w + pad && p.y >= f.y - pad && p.y <= f.y + f.h + pad;
      const inBar = (p) => p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad;
      return {
        firstTouchesFoo: inFoo(first),
        lastTouchesBar: inBar(last),
        first,
        last,
        foo: f,
        bar: b,
      };
    });

    expect(after, 'route + boxes should still be present after drag').not.toBeNull();
    const debug = JSON.stringify(after);
    expect(after.firstTouchesFoo, `firstTouchesFoo failed; ${debug}`).toBe(true);
    expect(after.lastTouchesBar, `lastTouchesBar failed; ${debug}`).toBe(true);

    // The persisted source should reflect the shifted endpoint.
    const source = await page.locator('#uml-pg-input').inputValue();
    expect(source).toMatch(/edge "edge-0" points="/);
  });

  test('dragging a sequence lifeline re-attaches a persisted message route', async ({ page }) => {
    // Regression for the same bug applied to sequence diagrams: when a
    // lifeline is moved horizontally and a previously-dragged message has
    // a saved seqmsg route override, the persisted endpoints have to
    // shift with the lifeline so the message line stays attached.
    await openPlayground(page);
    await selectDiagram(page, 'sequence');
    await page.uncheck('#uml-pg-snap');
    await selectEditMode(page, 'nodes');
    await page.locator('#uml-pg-input').evaluate((el) => {
      el.value = `@startuml
participant Alice
participant Bob
Alice -> Bob : hello
@enduml`;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForSelector('.uml-pg-edit-hitbox[data-layout-id="Alice"]');
    await page.waitForSelector('.uml-pg-edit-hitbox[data-layout-id="Bob"]');

    // Capture the message route's current rendered endpoints, then write
    // them back as a persisted override. The override is identical to the
    // current rendering, so without the bug fix it would be invisible —
    // until a lifeline moves, at which point the stale override leaks.
    const initial = await page.evaluate(() => {
      const svg = document.querySelector('#uml-pg-output svg');
      const routes = window.UMLShared.collectEditableRoutes(svg);
      const msg = routes.find((r) => /^seqmsg:/.test(r.id || ''));
      return msg ? { id: msg.id, points: msg.points.map((p) => ({ x: p.x, y: p.y })) } : null;
    });
    expect(initial, 'sequence message route should exist').not.toBeNull();

    const msgPoints = initial.points.map((p) => `${p.x},${p.y}`).join(' ');
    await page.locator('#uml-pg-input').evaluate((el, args) => {
      el.value = `@layout schema=1 renderer="archuml-visual-editor"
edge "${args.id}" points="${args.pts}"
@endlayout
@startuml
participant Alice
participant Bob
Alice -> Bob : hello
@enduml`;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, { id: initial.id, pts: msgPoints });
    await page.waitForFunction(() => {
      const svg = document.querySelector('#uml-pg-output svg');
      return svg && window.UMLShared.collectEditableRoutes(svg).some((r) => /^seqmsg:/.test(r.id || ''));
    });

    // Drag Alice (a lifeline — axis 'x', horizontal-only) by ~40 px right.
    await dragLocatorCenter(page, page.locator('.uml-pg-edit-hitbox[data-layout-id="Alice"]'), 40, 0);

    const after = await page.evaluate(() => {
      const svg = document.querySelector('#uml-pg-output svg');
      const aliceBox = svg.querySelector('.uml-pg-edit-hitbox[data-layout-id="Alice"]');
      const bobBox = svg.querySelector('.uml-pg-edit-hitbox[data-layout-id="Bob"]');
      const routes = window.UMLShared.collectEditableRoutes(svg);
      const msg = routes.find((r) => /^seqmsg:/.test(r.id || ''));
      if (!aliceBox || !bobBox || !msg) return null;
      const aCx = Number(aliceBox.getAttribute('x')) + Number(aliceBox.getAttribute('width')) / 2;
      const bCx = Number(bobBox.getAttribute('x')) + Number(bobBox.getAttribute('width')) / 2;
      return {
        aliceCenterX: aCx,
        bobCenterX: bCx,
        msgFirst: msg.points[0],
        msgLast: msg.points[msg.points.length - 1],
      };
    });

    expect(after, 'message and lifelines should be inspectable after drag').not.toBeNull();
    // The message starts at Alice's lifeline center and ends at Bob's.
    // (Either endpoint may be source — both arrangements are valid since the
    // SVG line direction is determined by left-vs-right placement.)
    const ax = after.aliceCenterX;
    const bx = after.bobCenterX;
    const fx = after.msgFirst.x;
    const lx = after.msgLast.x;
    const tol = 1.5;
    const onAlice = (px) => Math.abs(px - ax) <= tol;
    const onBob = (px) => Math.abs(px - bx) <= tol;
    expect(
      (onAlice(fx) && onBob(lx)) || (onAlice(lx) && onBob(fx)),
      `message endpoints (${fx}, ${lx}) should sit on lifeline centers (${ax}, ${bx})`,
    ).toBe(true);
  });

  test('reset selected returns a node to its auto-layout position while neighbors stay fixed', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'class');
    await page.uncheck('#uml-pg-snap');
    await selectEditMode(page, 'nodes');

    const baselineAnimal = await nodeHitboxBox(page, 'Animal');
    expect(baselineAnimal).not.toBeNull();

    await dragLocatorCenter(page, page.locator('.uml-pg-edit-hitbox[data-layout-id="Animal"]'), 85, 40);
    await dragLocatorCenter(page, page.locator('.uml-pg-edit-hitbox[data-layout-id="Dog"]'), -35, 25);

    await page.locator('.uml-pg-edit-hitbox[data-layout-id="Animal"]').click();
    await page.locator('#uml-pg-reset-one').click();

    const resetAnimal = await nodeHitboxBox(page, 'Animal');
    expect(resetAnimal.x).toBeCloseTo(baselineAnimal.x, 0);
    expect(resetAnimal.y).toBeCloseTo(baselineAnimal.y, 0);

    const source = await page.locator('#uml-pg-input').inputValue();
    const animalPos = source.match(/abstract class Animal\s+@pos\((\d+),\s*(\d+)\)/);
    const dogPos = source.match(/class Dog\s+@pos\((\d+),\s*(\d+)\)/);
    expect(animalPos, source).not.toBeNull();
    expect(dogPos, source).not.toBeNull();
    expect(Number(animalPos[1])).toBeCloseTo(Math.round(baselineAnimal.x), 0);
    expect(Number(animalPos[2])).toBeCloseTo(Math.round(baselineAnimal.y), 0);
  });

  test('dragging GitGraph commits moves connected lines live and after rerender', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'gitgraph');
    await page.uncheck('#uml-pg-snap');
    await selectEditMode(page, 'nodes');

    const before = await gitRouteEndpointFor(page, 'F');
    expect(before).not.toBeNull();

    const handle = page.locator('.uml-pg-edit-hitbox[data-layout-id="F"]');
    await expect(handle).toHaveCount(1);
    await handle.scrollIntoViewIfNeeded();
    const box = await handle.boundingBox();
    expect(box, 'GitGraph commit F should have a drag handle').not.toBeNull();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 70, cy + 30, { steps: 6 });

    const during = await gitRouteEndpointFor(page, 'F');
    expect(Math.abs(during.endpoint.x - before.endpoint.x)).toBeGreaterThan(20);
    expect(Math.abs(during.endpoint.y - before.endpoint.y)).toBeGreaterThan(8);

    await page.mouse.up();
    await page.waitForSelector('#uml-pg-output svg');

    const after = await gitRouteEndpointFor(page, 'F');
    expect(Math.abs(after.endpoint.x - before.endpoint.x)).toBeGreaterThan(20);
    expect(Math.abs(after.endpoint.y - before.endpoint.y)).toBeGreaterThan(8);

    const source = await page.locator('#uml-pg-input').inputValue();
    expect(source).toMatch(/F\s+"Add tokenizer"\s+@pos\(\d+,\s*\d+\)/);
  });

  test('dragging GitGraph branch tips moves their branch labels as anchored elements', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'gitgraph');
    await page.uncheck('#uml-pg-snap');
    await selectEditMode(page, 'nodes');

    const beforeCommit = await nodeHitboxBox(page, 'H');
    const beforeLabel = await nodeHitboxBox(page, 'branch:feature/parser');
    expect(beforeCommit).not.toBeNull();
    expect(beforeLabel).not.toBeNull();

    await dragLocatorCenter(page, page.locator('.uml-pg-edit-hitbox[data-layout-id="H"]'), 55, 28);

    const afterCommit = await nodeHitboxBox(page, 'H');
    const afterLabel = await nodeHitboxBox(page, 'branch:feature/parser');
    expect(afterCommit.x - beforeCommit.x).toBeGreaterThan(35);
    expect(afterCommit.y - beforeCommit.y).toBeGreaterThan(15);
    expect(afterLabel.x - beforeLabel.x).toBeCloseTo(afterCommit.x - beforeCommit.x, 0);
    expect(afterLabel.y - beforeLabel.y).toBeCloseTo(afterCommit.y - beforeCommit.y, 0);

    const layout = await currentLayoutMetadata(page);
    expect(layout.positions.H, 'the moved commit should be fixed in generated ArchUML').toBeTruthy();
    expect(
      layout.positions['branch:feature/parser'],
      'a label that only followed its commit should remain anchored, not become manual'
    ).toBeUndefined();
  });

  test('GitGraph branch labels are individually movable and then stay manual', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'gitgraph');
    await page.uncheck('#uml-pg-snap');
    await selectEditMode(page, 'nodes');

    const labelHandle = page.locator('.uml-pg-edit-hitbox[data-layout-id="branch:feature/parser"]');
    await expect(labelHandle).toHaveCount(1);

    const beforeLabel = await nodeHitboxBox(page, 'branch:feature/parser');
    await dragLocatorCenter(page, labelHandle, -42, 22);
    const movedLabel = await nodeHitboxBox(page, 'branch:feature/parser');
    expect(movedLabel.x).toBeLessThan(beforeLabel.x - 25);
    expect(movedLabel.y).toBeGreaterThan(beforeLabel.y + 10);

    const manualLayout = await currentLayoutMetadata(page);
    const manualLabelPosition = manualLayout.positions['branch:feature/parser'];
    expect(manualLabelPosition, 'moving a branch label itself should emit a manual label position').toBeTruthy();

    await dragLocatorCenter(page, page.locator('.uml-pg-edit-hitbox[data-layout-id="H"]'), 58, 0);
    const afterCommitDragLabel = await nodeHitboxBox(page, 'branch:feature/parser');
    expect(afterCommitDragLabel.x).toBeCloseTo(movedLabel.x, 0);
    expect(afterCommitDragLabel.y).toBeCloseTo(movedLabel.y, 0);

    const afterCommitLayout = await currentLayoutMetadata(page);
    expect(afterCommitLayout.positions['branch:feature/parser'].x).toBeCloseTo(manualLabelPosition.x, 0);
    expect(afterCommitLayout.positions['branch:feature/parser'].y).toBeCloseTo(manualLabelPosition.y, 0);
  });

  test('reset selected GitGraph branch label removes only its manual override and reanchors it', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'gitgraph');
    await page.uncheck('#uml-pg-snap');
    await selectEditMode(page, 'nodes');

    const labelHandle = page.locator('.uml-pg-edit-hitbox[data-layout-id="branch:feature/parser"]');
    await expect(labelHandle).toHaveCount(1);
    await dragLocatorCenter(page, labelHandle, -38, 18);

    let layout = await currentLayoutMetadata(page);
    expect(layout.positions['branch:feature/parser']).toBeTruthy();

    await page.locator('.uml-pg-edit-hitbox[data-layout-id="branch:feature/parser"]').click();
    await page.locator('#uml-pg-reset-one').click();
    layout = await currentLayoutMetadata(page);
    expect(layout.positions['branch:feature/parser']).toBeUndefined();

    const beforeCommit = await nodeHitboxBox(page, 'H');
    const beforeLabel = await nodeHitboxBox(page, 'branch:feature/parser');
    await dragLocatorCenter(page, page.locator('.uml-pg-edit-hitbox[data-layout-id="H"]'), 48, 24);
    const afterCommit = await nodeHitboxBox(page, 'H');
    const afterLabel = await nodeHitboxBox(page, 'branch:feature/parser');

    expect(afterCommit.x - beforeCommit.x).toBeGreaterThan(30);
    expect(afterLabel.x - beforeLabel.x).toBeCloseTo(afterCommit.x - beforeCommit.x, 0);
    expect(afterLabel.y - beforeLabel.y).toBeCloseTo(afterCommit.y - beforeCommit.y, 0);

    layout = await currentLayoutMetadata(page);
    expect(layout.positions.H).toBeTruthy();
    expect(layout.positions['branch:feature/parser']).toBeUndefined();
  });

  test('reset all removes visual layout metadata after mixed node and line edits', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'class');
    await selectEditMode(page, 'nodes');
    await dragLocatorCenter(page, page.locator('.uml-pg-edit-hitbox').first(), 30, 20);
    await selectEditMode(page, 'lines');
    await dragLocatorCenter(page, page.locator('.uml-pg-edge-hitbox').first(), 0, 30);

    let source = await page.locator('#uml-pg-input').inputValue();
    expect(source).toContain('@pos(');
    expect(source).toContain('@layout schema=1');

    await page.locator('#uml-pg-reset-layout').click();
    source = await page.locator('#uml-pg-input').inputValue();
    expect(source).not.toContain('@pos(');
    expect(source).not.toContain('@layout');
    expect(source).not.toContain('@endlayout');
  });

  test('use case actor handles do not collide with use case ellipses that share substring labels', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'usecase');
    await selectEditMode(page, 'nodes');

    const boxes = await page.evaluate(() => {
      const svg = document.querySelector('#uml-pg-output svg');
      const out = {};
      Array.from(svg.querySelectorAll('.uml-pg-edit-hitbox')).forEach((h) => {
        out[h.getAttribute('data-layout-id')] = {
          x: Number(h.getAttribute('x')),
          y: Number(h.getAttribute('y')),
          w: Number(h.getAttribute('width')),
          h: Number(h.getAttribute('height')),
        };
      });
      return out;
    });

    // The default usecase example has UC4 = "Manage Users", which contains
    // the substring "User". Without the exact-match preference fix, the
    // User actor's hitbox would land on top of the UC4 ellipse.
    expect(boxes.User, 'User actor handle should exist').toBeTruthy();
    expect(boxes.UC4, 'Manage Users handle should exist').toBeTruthy();
    const userCenterX = boxes.User.x + boxes.User.w / 2;
    const userCenterY = boxes.User.y + boxes.User.h / 2;
    const insideUC4 =
      userCenterX >= boxes.UC4.x &&
      userCenterX <= boxes.UC4.x + boxes.UC4.w &&
      userCenterY >= boxes.UC4.y &&
      userCenterY <= boxes.UC4.y + boxes.UC4.h;
    expect(insideUC4, 'User actor handle should not sit inside the UC4 ellipse').toBe(false);
  });

  test('activity diagram exposes handles for nodes that only appear as transition targets', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'activity');
    await selectEditMode(page, 'nodes');

    const ids = await page.evaluate(() => {
      const svg = document.querySelector('#uml-pg-output svg');
      return Array.from(svg.querySelectorAll('.uml-pg-edit-hitbox'))
        .map((h) => h.getAttribute('data-layout-id'));
    });

    // "Validate Payment" appears only as the target of a transition
    // (`"Receive Order" --> "Validate Payment"`), never as a source —
    // exactly the case that the single-quoted-token regex used to miss.
    expect(ids).toContain('Receive Order');
    expect(ids).toContain('Validate Payment');
    expect(ids).toContain('Process Order');
    expect(ids).toContain('Reject Order');
    expect(ids).toContain('Ship Order');
  });

  test('UML tutorial uses the standard instruction chrome and a draggable splitter', async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('uml-pg-help-dismissed'));
    await page.goto(MONOPOLY_TUTORIAL_URL);
    await page.waitForSelector('#uml-pg-output');

    const instructions = page.locator('.tvm-instructions-panel');
    const workspace = page.locator('.tvm-workspace.tvm-uml-editor-workspace');
    const splitter = page.locator('.tvm-hsplitter');

    await expect(instructions).toBeVisible();
    await expect(workspace).toBeVisible();
    await expect(page.locator('.tvm-step-nav .tvm-step-btn')).toHaveCount(3);
    await expect(page.locator('.tvm-step-controls .tvm-btn-test')).toBeVisible();
    await expect(page.locator('.tvm-step-controls .tvm-btn-clear-model')).toBeVisible();
    await expect(page.locator('.tvm-step-controls .tvm-btn-next')).toBeVisible();
    await expect(page.locator('.tvm-step-controls .tvm-btn-next')).toBeEnabled();
    await expect(page.locator('.tvm-step-controls .tvm-btn-next')).not.toHaveAttribute('title', 'Pass all tests to continue');
    await expect(page.locator('#uml-pg-export-source')).toBeVisible();
    await expect(page.locator('#uml-pg-copy-source')).toBeHidden();
    await expect(page.locator('#uml-pg-editor-pane')).toBeHidden();
    await expect(splitter).toHaveAttribute('role', 'separator');
    await expect(page.locator('.uml-pg-syntax-help')).toHaveCount(0);

    const tips = page.locator('#uml-pg-help-banner');
    await expect(tips).toBeVisible();
    await page.getByRole('button', { name: /Got it/ }).click();
    await expect(tips).toBeHidden();

    const beforeBox = await instructions.boundingBox();
    const splitterBox = await splitter.boundingBox();
    const controlsBox = await page.locator('.tvm-step-controls-bar').boundingBox();
    const controlButtonBoxes = await page.locator('.tvm-step-controls .tvm-btn').evaluateAll((buttons) => {
      return buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      });
    });
    if (!beforeBox || !splitterBox) throw new Error('splitter and panel should have layout boxes');
    if (!controlsBox) throw new Error('controls should have a layout box');
    expect(Math.round(beforeBox.width)).toBeGreaterThanOrEqual(210);
    expect(Math.round(beforeBox.width)).toBeLessThanOrEqual(260);
    for (const box of controlButtonBoxes) {
      expect(box.left).toBeGreaterThanOrEqual(controlsBox.x);
      expect(box.right).toBeLessThanOrEqual(controlsBox.x + controlsBox.width + 1);
      expect(box.top).toBeGreaterThanOrEqual(controlsBox.y);
      expect(box.bottom).toBeLessThanOrEqual(controlsBox.y + controlsBox.height + 1);
    }

    const x = splitterBox.x + splitterBox.width / 2;
    const y = splitterBox.y + splitterBox.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 100, y, { steps: 6 });
    await page.mouse.up();

    await expect.poll(async () => {
      const box = await instructions.boundingBox();
      return box ? Math.round(box.width) : 0;
    }).toBeGreaterThan(Math.round(beforeBox.width + 60));
  });

  test('UML tutorial keeps the sequence model count screen-reader only', async ({ page }) => {
    await openMonopolyTutorialStep(page, 2);

    const sequenceModel = page.locator('#uml-pg-sequence-model');
    await expect(sequenceModel.locator('summary')).toHaveCount(0);
    await expect(sequenceModel.locator('.uml-pg-sr-only')).toContainText(/Sequence model: 0 lifelines, 0 timeline items/);
    await expect(sequenceModel.locator('.uml-pg-sequence-model-actions')).toBeVisible();
  });

  test('UML tutorial removes all model elements after confirmation', async ({ page }) => {
    const classKey = tutorialAutosaveKey('class');
    const stateKey = tutorialAutosaveKey('state');
    const sequenceKey = tutorialAutosaveKey('sequence');
    await page.addInitScript(({ classKey, stateKey, sequenceKey }) => {
      localStorage.removeItem(classKey);
      localStorage.removeItem(stateKey);
      localStorage.removeItem(sequenceKey);
    }, { classKey, stateKey, sequenceKey });
    await page.goto(MONOPOLY_TUTORIAL_URL);
    await page.waitForSelector('#uml-pg-output');

    await setUmlSource(page, `@startuml
class Player
class NormalTurnState
Player --> NormalTurnState
@enduml`);

    const clearButton = page.getByRole('button', { name: 'Remove All Elements', exact: true });
    await clearButton.click();
    const dialog = page.getByRole('dialog', { name: /Remove all UML elements from this step/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();

    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(clearButton).toBeFocused();
    await expect(page.locator('#uml-pg-input')).toHaveValue(/class Player/);

    await clearButton.click();
    await dialog.getByRole('button', { name: 'Remove Elements', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('#uml-pg-input')).toHaveValue('@startuml\n@enduml');
    await expect(page.locator('.tvm-test-panel')).toHaveCount(0);
    await expect.poll(async () => {
      return page.evaluate((key) => localStorage.getItem(key), classKey);
    }).toBe('@startuml\n@enduml');
  });

  test('UML tutorial instructions render diagrams created in previous steps', async ({ page }) => {
    await openMonopolyTutorialStep(page, 1);

    const classPreview = page.locator('.tvm-previous-diagram-card[data-uml-preview-type="class"]');
    await expect(page.locator('.tvm-previous-diagrams')).toBeVisible();
    await expect(page.locator('.tvm-previous-diagram-card')).toHaveCount(1);
    await expect(classPreview).toContainText('Class Diagram');
    await expect(classPreview.locator('svg')).toBeVisible();

    const stateSource = `@startuml
state NormalMode
state PrisonState
state BankruptcyMode
NormalMode --> PrisonState : bad roll
PrisonState --> NormalMode : fee paid
NormalMode --> BankruptcyMode : cash gone
@enduml`;
    await setUmlSource(page, stateSource);
    await page.evaluate(({ source, key }) => {
      localStorage.setItem(key, source);
      window._tutorial._stepsUnlocked.add(2);
      window._tutorial.loadStep(2);
    }, { source: stateSource, key: tutorialAutosaveKey('state') });

    const statePreview = page.locator('.tvm-previous-diagram-card[data-uml-preview-type="state"]');
    await expect(page.locator('.tvm-previous-diagram-card')).toHaveCount(2);
    await expect(classPreview.locator('svg')).toBeVisible();
    await expect(statePreview).toContainText('State Diagram');
    await expect(statePreview.locator('svg')).toBeVisible();
  });

  test('UML tutorial accepts reversed generalization syntax for class relation assertions', async ({ page }) => {
    await page.goto(MONOPOLY_TUTORIAL_URL);
    await page.waitForSelector('#uml-pg-output');

    await page.locator('#uml-pg-input').evaluate((el) => {
      el.value = `@startuml
class Player { +takeTurn(); +setState(state: PlayerState); }
abstract class PlayerState { + {abstract} takeTurn(player: Player); }
class NormalTurnState { +takeTurn(player: Player); }
class InJailState { +takeTurn(player: Player); }
class BankruptState { +takeTurn(player: Player); }
Player o-- PlayerState : currentState
PlayerState <|-- NormalTurnState
PlayerState <|-- InJailState
PlayerState <|-- BankruptState
@enduml`;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await page.getByRole('button', { name: /Test My Work/ }).click();
    await expect(page.locator('.tvm-test-summary.all-pass')).toContainText('All 5 tests passed');
    await expect(page.locator('.tvm-btn-next')).toBeEnabled();
  });

  test('UML tutorial accepts concrete state and turn-operation naming variations', async ({ page }) => {
    await page.goto(MONOPOLY_TUTORIAL_URL);
    await page.waitForSelector('#uml-pg-output');

    await page.locator('#uml-pg-input').evaluate((el) => {
      el.value = `@startuml
class Player { +do_turn(); +state_change(state: PlayerState); }
interface PlayerState { +do_turn(player: Player); }
class normalBehavior { +do_turn(player: Player); }
class PrisonState { +do_turn(player: Player); }
class BankruptcyMode { +do_turn(player: Player); }
PlayerState --o Player : currentState
PlayerState <|.. normalBehavior
PlayerState <|.. PrisonState
PlayerState <|.. BankruptcyMode
@enduml`;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await page.getByRole('button', { name: /Test My Work/ }).click();
    await expect(page.locator('.tvm-test-summary.all-pass')).toContainText('All 5 tests passed');
    await expect(page.locator('.tvm-btn-next')).toBeEnabled();
  });

  test('UML tutorial shows naming hints for vague class and operation names', async ({ page }) => {
    await page.goto(MONOPOLY_TUTORIAL_URL);
    await page.waitForSelector('#uml-pg-output');

    await page.locator('#uml-pg-input').evaluate((el) => {
      el.value = `@startuml
class Player { +doTurn(); +setState(state: PlayerState); }
abstract class PlayerState { +duTurn(player: Player); }
class RegularMode
class PrisonState
class BankruptcyMode
Player o-- PlayerState : currentState
RegularMode --|> PlayerState
PrisonState --|> PlayerState
BankruptcyMode --|> PlayerState
@enduml`;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await page.getByRole('button', { name: /Test My Work/ }).click();
    await expect(page.locator('.tvm-test-summary.partial')).toBeVisible();
    await expectTutorHint(page, 'Concrete state class names should expose their Monopoly role');
    await expectTutorHint(page, "state abstraction's operation should name the turn behavior");
  });

  test('UML tutorial does not show naming hints when matching elements are missing', async ({ page }) => {
    await page.goto(MONOPOLY_TUTORIAL_URL);
    await page.waitForSelector('#uml-pg-output');

    await page.locator('#uml-pg-input').evaluate((el) => {
      el.value = '@startuml\n@enduml';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await page.getByRole('button', { name: /Test My Work/ }).click();
    await expect(page.locator('.tvm-test-summary.partial')).toBeVisible();
    await expect(page.locator('.tvm-tutor-chat')).toHaveCount(0);
  });

  test('UML tutorial rejects ownership diamonds on the state abstraction side', async ({ page }) => {
    await page.goto(MONOPOLY_TUTORIAL_URL);
    await page.waitForSelector('#uml-pg-output');

    await page.locator('#uml-pg-input').evaluate((el) => {
      el.value = `@startuml
class Player { +takeTurn(); +setState(state: PlayerState); }
abstract class PlayerState { + {abstract} takeTurn(player: Player); }
class NormalTurnState { +takeTurn(player: Player); }
class InJailState { +takeTurn(player: Player); }
class BankruptState { +takeTurn(player: Player); }
Player --o PlayerState : currentState
PlayerState <|-- NormalTurnState
PlayerState <|-- InJailState
PlayerState <|-- BankruptState
@enduml`;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await page.getByRole('button', { name: /Test My Work/ }).click();
    await expect(page.locator('.tvm-test-summary.partial')).toContainText(/4\s*\/\s*5 tests passed/);
    await expect(page.locator('.tvm-test-item.fail .tvm-test-desc')).toContainText('Player owns or aggregates its current state');
    await expect(page.locator('.tvm-btn-next')).toBeEnabled();
  });

  test('UML tutorial accepts PlayerState turn operation declared on an abstract class', async ({ page }) => {
    await page.goto(MONOPOLY_TUTORIAL_URL);
    await page.waitForSelector('#uml-pg-output');

    await page.locator('#uml-pg-input').evaluate((el) => {
      el.value = `@startuml
class Player { +takeTurn(); +setState(state: PlayerState); }
abstract class PlayerState { +takeTurn(player: Player); }
class NormalTurnState { +takeTurn(player: Player); }
class InJailState { +takeTurn(player: Player); }
class BankruptState { +takeTurn(player: Player); }
Player o-- PlayerState : currentState
PlayerState <|-- NormalTurnState
PlayerState <|-- InJailState
PlayerState <|-- BankruptState
@enduml`;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await page.getByRole('button', { name: /Test My Work/ }).click();
    await expect(page.locator('.tvm-test-summary.all-pass')).toContainText('All 5 tests passed');
    await expect(page.locator('.tvm-btn-next')).toBeEnabled();
  });

  test('UML tutorial rejects class attributes used where operations need argument lists', async ({ page }) => {
    await page.goto(MONOPOLY_TUTORIAL_URL);
    await page.waitForSelector('#uml-pg-output');

    await page.locator('#uml-pg-input').evaluate((el) => {
      el.value = `@startuml
class Player { +takeTurn; +setState: PlayerState; }
abstract class PlayerState { +takeTurn(player: Player); }
class NormalTurnState { +takeTurn; }
class InJailState { +takeTurn; }
class BankruptState { +takeTurn; }
Player o-- PlayerState : currentState
PlayerState <|-- NormalTurnState
PlayerState <|-- InJailState
PlayerState <|-- BankruptState
@enduml`;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await page.getByRole('button', { name: /Test My Work/ }).click();
    await expect(page.locator('.tvm-test-summary.partial')).toContainText(/3\s*\/\s*5 tests passed/);
    await expect(page.locator('.tvm-test-item.fail .tvm-test-desc').filter({ hasText: 'Operations support the later sequence diagram' })).toBeVisible();
    await expect(page.locator('.tvm-test-item.fail .tvm-test-desc').filter({ hasText: 'Concrete states implement abstract operations' })).toBeVisible();
    await expect(page.locator('.tvm-btn-next')).toBeEnabled();
  });

  test('UML tutorial rejects concrete states that omit abstract operations', async ({ page }) => {
    await page.goto(MONOPOLY_TUTORIAL_URL);
    await page.waitForSelector('#uml-pg-output');

    await page.locator('#uml-pg-input').evaluate((el) => {
      el.value = `@startuml
class Player { +takeTurn(); +setState(state: PlayerState); }
abstract class PlayerState { +takeTurn(player: Player); }
class NormalTurnState { +takeTurn(player: Player); }
class InJailState
class BankruptState { +takeTurn(player: Player); }
Player o-- PlayerState : currentState
PlayerState <|-- NormalTurnState
PlayerState <|-- InJailState
PlayerState <|-- BankruptState
@enduml`;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await page.getByRole('button', { name: /Test My Work/ }).click();
    await expect(page.locator('.tvm-test-summary.partial')).toContainText(/4\s*\/\s*5 tests passed/);
    await expect(page.locator('.tvm-test-item.fail .tvm-test-desc')).toContainText('Concrete states implement abstract operations');
    await expect(page.locator('.tvm-test-item.fail')).toContainText('InJailState.takeTurn');
    await expect(page.locator('.tvm-btn-next')).toBeEnabled();
  });

  test('UML tutorial rejects a concrete PlayerState class', async ({ page }) => {
    await page.goto(MONOPOLY_TUTORIAL_URL);
    await page.waitForSelector('#uml-pg-output');

    await page.locator('#uml-pg-input').evaluate((el) => {
      el.value = `@startuml
class Player { +takeTurn(); +setState(state: PlayerState); }
class PlayerState { + {abstract} takeTurn(player: Player); }
class NormalTurnState
class InJailState
class BankruptState
Player o-- PlayerState : currentState
PlayerState <|-- NormalTurnState
PlayerState <|-- InJailState
PlayerState <|-- BankruptState
@enduml`;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await page.getByRole('button', { name: /Test My Work/ }).click();
    await expect(page.locator('.tvm-test-summary.partial')).toContainText(/3\s*\/\s*5 tests passed/);
    await expect(page.locator('.tvm-test-item.fail .tvm-test-desc').filter({ hasText: 'State-pattern classes are present' })).toHaveCount(1);
    await expect(page.locator('.tvm-btn-next')).toBeEnabled();
  });

  test('UML tutorial rejects interface states connected with generalization', async ({ page }) => {
    await page.goto(MONOPOLY_TUTORIAL_URL);
    await page.waitForSelector('#uml-pg-output');

    await page.locator('#uml-pg-input').evaluate((el) => {
      el.value = `@startuml
class Player { +takeTurn(); +setState(state: PlayerState); }
interface PlayerState { +takeTurn(player: Player); }
class NormalTurnState { +takeTurn(player: Player); }
class InJailState { +takeTurn(player: Player); }
class BankruptState { +takeTurn(player: Player); }
Player o-- PlayerState : currentState
PlayerState <|-- NormalTurnState
PlayerState <|-- InJailState
PlayerState <|-- BankruptState
@enduml`;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await page.getByRole('button', { name: /Test My Work/ }).click();
    await expect(page.locator('.tvm-test-summary.partial')).toContainText(/4\s*\/\s*5 tests passed/);
    await expect(page.locator('.tvm-test-item.fail .tvm-test-desc')).toContainText('Concrete states implement the state abstraction');
    await expect(page.locator('.tvm-btn-next')).toBeEnabled();
  });

  test('UML tutorial state diagram reuses class-diagram state names and allows optional jail bankruptcy', async ({ page }) => {
    await openMonopolyTutorialStep(page, 1);

    await setUmlSource(page, `@startuml
state NormalMode
state PrisonState
state BankruptcyMode
NormalMode --> PrisonState : bad roll
PrisonState --> NormalMode : fee paid
NormalMode --> BankruptcyMode : cash gone
@enduml`);

    await page.getByRole('button', { name: /Test My Work/ }).click();
    await expect(page.locator('.tvm-test-summary.all-pass')).toContainText('All 2 tests passed');
    await expect(page.locator('.tvm-btn-next')).toBeEnabled();
  });

  test('UML tutorial state diagram rejects renamed states that drift from the class diagram', async ({ page }) => {
    await openMonopolyTutorialStep(page, 1);

    await setUmlSource(page, `@startuml
state NormalTurnState
state InJailState
state BankruptState
NormalTurnState --> InJailState : bad roll
InJailState --> NormalTurnState : fee paid
NormalTurnState --> BankruptState : cash gone
@enduml`);

    await page.getByRole('button', { name: /Test My Work/ }).click();
    await expect(page.locator('.tvm-test-summary.partial')).toContainText(/0\s*\/\s*2 tests passed/);
    await expect(page.locator('.tvm-test-item.fail .tvm-test-desc').filter({ hasText: 'States reuse the concrete state class names' })).toHaveCount(1);
    await expectTutorHint(page, 'State nodes should reuse the concrete state class names');
    await expect(page.locator('.tvm-btn-next')).toBeEnabled();
  });

  test('UML tutorial state diagram rejects transition labels shorter than four characters', async ({ page }) => {
    await openMonopolyTutorialStep(page, 1);

    await setUmlSource(page, `@startuml
state NormalMode
state PrisonState
state BankruptcyMode
NormalMode --> PrisonState : go
PrisonState --> NormalMode : fee paid
NormalMode --> BankruptcyMode : cash gone
@enduml`);

    await page.getByRole('button', { name: /Test My Work/ }).click();
    await expect(page.locator('.tvm-test-summary.partial')).toContainText(/1\s*\/\s*2 tests passed/);
    await expect(page.locator('.tvm-test-item.fail .tvm-test-desc')).toContainText('State transitions are labeled and consistent');
    await expectTutorHint(page, 'Transition labels should describe the condition or event');
    await expect(page.locator('.tvm-btn-next')).toBeEnabled();
  });

  test('UML tutorial state diagram checks optional jail bankruptcy label when present', async ({ page }) => {
    await openMonopolyTutorialStep(page, 1);

    await setUmlSource(page, `@startuml
state NormalMode
state PrisonState
state BankruptcyMode
NormalMode --> PrisonState : bad roll
PrisonState --> NormalMode : fee paid
NormalMode --> BankruptcyMode : cash gone
PrisonState --> BankruptcyMode : no
@enduml`);

    await page.getByRole('button', { name: /Test My Work/ }).click();
    await expect(page.locator('.tvm-test-summary.partial')).toContainText(/1\s*\/\s*2 tests passed/);
    await expect(page.locator('.tvm-test-item.fail .tvm-test-desc')).toContainText('State transitions are labeled and consistent');
    await expect(page.locator('.tvm-btn-next')).toBeEnabled();
  });

  test('UML tutorial sequence diagram accepts typed state objects and snake_case method calls', async ({ page }) => {
    await openMonopolyTutorialStep(page, 2);

    await setUmlSource(page, `@startuml
participant player: Player
participant normal_state: NormalMode
participant prison_state: PrisonState
player -> normal_state: do_turn(player)
normal_state -> player: change_state(prison_state)
player -> prison_state: do_turn(player)
@enduml`);

    await page.getByRole('button', { name: /Test My Work/ }).click();
    await expect(page.locator('.tvm-test-summary.all-pass')).toContainText('All 5 tests passed');
  });

  test('UML tutorial sequence diagram ignores return labels when checking class operations', async ({ page }) => {
    await openMonopolyTutorialStep(page, 2);

    await setUmlSource(page, `@startuml
participant player: Player
participant normal_state: NormalMode
participant prison_state: PrisonState
player -> normal_state: do_turn(player)
normal_state --> player: response
normal_state -> player: change_state(prison_state)
player --> normal_state: response
player -> prison_state: do_turn(player)
prison_state --> player: response
@enduml`);

    await page.getByRole('button', { name: /Test My Work/ }).click();
    await expect(page.locator('.tvm-test-summary.all-pass')).toContainText('All 5 tests passed');
    await expect(page.locator('.tvm-test-item.fail .tvm-test-desc')).toHaveCount(0);
  });

  test('UML tutorial sequence diagram rejects only one concrete state object', async ({ page }) => {
    await openMonopolyTutorialStep(page, 2);

    await setUmlSource(page, `@startuml
participant player: Player
participant normal_state: NormalMode
player -> normal_state: do_turn(player)
normal_state -> player: change_state(normal_state)
@enduml`);

    await page.getByRole('button', { name: /Test My Work/ }).click();
    await expect(page.locator('.tvm-test-summary.partial')).toContainText(/2\s*\/\s*5 tests passed/);
    await expect(page.locator('.tvm-test-item.fail .tvm-test-desc').filter({ hasText: 'Player and concrete state objects are shown' })).toBeVisible();
    await expect(page.locator('.tvm-test-item.fail .tvm-test-desc').filter({ hasText: 'Player talks to each state and changes state between calls' })).toBeVisible();
    await expect(page.locator('.tvm-test-summary.all-pass')).toHaveCount(0);
  });

  test('UML tutorial sequence diagram rejects missing state-change call between state calls', async ({ page }) => {
    await openMonopolyTutorialStep(page, 2);

    await setUmlSource(page, `@startuml
participant player: Player
participant normal_state: NormalMode
participant prison_state: PrisonState
player -> normal_state: do_turn(player)
player -> prison_state: do_turn(player)
@enduml`);

    await page.getByRole('button', { name: /Test My Work/ }).click();
    await expect(page.locator('.tvm-test-summary.partial')).toContainText(/3\s*\/\s*5 tests passed/);
    await expect(page.locator('.tvm-test-item.fail .tvm-test-desc').filter({ hasText: 'Player talks to each state and changes state between calls' })).toBeVisible();
    await expect(page.locator('.tvm-test-summary.all-pass')).toHaveCount(0);
  });

  test('UML tutorial sequence diagram requires state-change arguments to name the next state object', async ({ page }) => {
    await openMonopolyTutorialStep(page, 2);

    await setUmlSource(page, `@startuml
participant player: Player
participant normal_state: NormalMode
participant prison_state: PrisonState
player -> normal_state: do_turn(player)
normal_state -> player: change_state(normal_state)
player -> prison_state: do_turn(player)
@enduml`);

    await page.getByRole('button', { name: /Test My Work/ }).click();
    await expect(page.locator('.tvm-test-summary.partial')).toContainText(/4\s*\/\s*5 tests passed/);
    await expect(page.locator('.tvm-test-item.fail .tvm-test-desc')).toContainText('State-change call passes the next state object');
    await expectTutorHint(page, 'state-changing call should pass the lifeline');
    await expect(page.locator('.tvm-test-summary.all-pass')).toHaveCount(0);
  });

  test('UML tutorial sequence diagram rejects receiver prefixes and missing argument lists', async ({ page }) => {
    await openMonopolyTutorialStep(page, 2);

    await setUmlSource(page, `@startuml
participant player: Player
participant normal_state: NormalMode
participant prison_state: PrisonState
player -> normal_state: do_turn(player)
normal_state -> player: change_state(prison_state)
player -> prison_state: do_turn(player)
player -> prison_state: prison_state.helper
@enduml`);

    await page.getByRole('button', { name: /Test My Work/ }).click();
    await expect(page.locator('.tvm-test-summary.partial')).toContainText(/4\s*\/\s*5 tests passed/);
    await expect(page.locator('.tvm-test-item.fail .tvm-test-desc')).toContainText('Sequence calls use method-call labels');
    await expectTutorHint(page, 'methodName(arguments)');
    await expect(page.locator('.tvm-test-summary.all-pass')).toHaveCount(0);
  });

  test('UML tutorial sequence diagram rejects method calls missing from the class diagram', async ({ page }) => {
    await openMonopolyTutorialStep(page, 2);

    await setUmlSource(page, `@startuml
participant player: Player
participant normal_state: NormalMode
participant prison_state: PrisonState
player -> normal_state: do_turn(player)
normal_state -> player: change_state(prison_state)
player -> prison_state: do_turn(player)
player -> prison_state: teleport(player)
@enduml`);

    await page.getByRole('button', { name: /Test My Work/ }).click();
    await expect(page.locator('.tvm-test-summary.partial')).toContainText(/4\s*\/\s*5 tests passed/);
    await expect(page.locator('.tvm-test-item.fail .tvm-test-desc')).toContainText('Sequence method calls exist in the class diagram');
    await expectTutorHint(page, 'Read each arrow as a method call on the receiving lifeline');
    await expect(page.locator('.tvm-test-summary.all-pass')).toHaveCount(0);
  });
});
