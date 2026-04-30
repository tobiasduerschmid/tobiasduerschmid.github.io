// @ts-check
const { test, expect } = require('@playwright/test');

const PLAYGROUND_URL = '/SEBook/tools/uml-playground';

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
  await page.selectOption('#uml-pg-edit-mode', mode);
}

async function dragLocatorCenter(page, locator, dx, dy) {
  const box = await locator.boundingBox();
  expect(box, 'drag target should have a bounding box').not.toBeNull();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + dx, cy + dy, { steps: 6 });
  await page.mouse.up();
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
      for (const el of Array.from(svg.querySelectorAll('[data-layout-id]'))) {
        if (el.closest('defs') || el.closest('.uml-pg-edit-layer')) continue;
        if (el.getAttribute('data-layout-id') !== id) continue;
        if (tagFilter && !tagFilter(el)) continue;
        const b = el.getBBox();
        box = union(box, { x: b.x, y: b.y, width: b.width, height: b.height });
      }
      if (!box) return null;
      return {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        cx: box.x + box.width / 2,
        cy: box.y + box.height / 2,
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
    expect(after.sourceEndpoint.x).toBeCloseTo(after.sourcePort.x + after.sourcePort.width, 1);
    expect(after.sourceEndpoint.y).toBeCloseTo(after.sourcePort.cy, 1);
    expect(after.targetEndpoint.x).toBeCloseTo(after.targetPort.x, 1);
    expect(after.targetEndpoint.y).toBeCloseTo(after.targetPort.cy, 1);

    const source = await page.locator('#uml-pg-input').inputValue();
    expect(source).toMatch(/component\s+Frontend\s+@pos\(\d+,\s*\d+\)/);
  });

  test('dragging component ports stays on the component outline and reroutes connectors', async ({ page }) => {
    await openPlayground(page);
    await selectDiagram(page, 'component');
    await page.uncheck('#uml-pg-snap');
    await selectEditMode(page, 'nodes');

    const before = await componentConnectionInfo(page);
    expect(before, 'component route should expose port endpoints').not.toBeNull();

    const portHandle = page.locator('.uml-pg-edit-hitbox[data-layout-id="Backend.b_in"]');
    await expect(portHandle).toHaveCount(1);
    await dragLocatorCenter(page, portHandle, 90, -34);

    const after = await componentConnectionInfo(page);
    expect(after, 'component route should survive port drag').not.toBeNull();
    expect(after.targetPort.cx).toBeCloseTo(after.targetComponent.x, 1);
    expect(after.targetPort.cy).toBeLessThan(before.targetPort.cy - 20);
    expect(after.targetEndpoint.x).toBeCloseTo(after.targetPort.x, 1);
    expect(after.targetEndpoint.y).toBeCloseTo(after.targetPort.cy, 1);
    expect(after.points).not.toEqual(before.points);

    const source = await page.locator('#uml-pg-input').inputValue();
    expect(source).toContain('node "Backend.b_in" x=');
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
});
