// @ts-check
const { test, expect } = require('@playwright/test');

/** @typedef {{ x: number, y: number, width: number, height: number }} BoxRect */

test.describe('UML renderer regressions', () => {
  test('free class nudging keeps neighboring class boxes separated', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForSelector('div[class$="diagram-container"] > svg');
    await page.waitForFunction(() => !!/** @type {any} */ (window).UMLClassDiagram);

    const stats = await page.evaluate(() => {
      const src = `@startuml
abstract class Content {
  # title: String
  # rating: String
  {abstract} + play(): void
}
class Movie {
  - duration: int
  + play(): void
}
class TVShow {
  + play(): void
}
class Season {
  - seasonNumber: int
}
class Episode {
  - episodeNumber: int
  - duration: int
  + play(): void
}
class Genre {
  - name: String
}
Movie --|> Content
TVShow --|> Content
TVShow "1" *-- "1..*" Season : contains
Season "1" *-- "1..*" Episode : contains
Content "0..*" -- "1..*" Genre : classifiedBy
@enduml`;

      const classRenderer = /** @type {{ render: (container: HTMLElement, text: string) => void }} */ (
        /** @type {any} */ (window).UMLClassDiagram
      );

      const host = document.createElement('div');
      host.style.width = '1200px';
      host.style.position = 'absolute';
      host.style.left = '-10000px';
      document.body.appendChild(host);
      classRenderer.render(host, src);

      const svg = host.querySelector('svg');
      if (!svg) {
        document.body.removeChild(host);
        return { tvShow: null, genre: null, gap: null };
      }
      const texts = Array.from(svg.querySelectorAll('text'));
      const rects = Array.from(svg.querySelectorAll('rect'));

      /** @param {string} label
       *  @returns {BoxRect | null}
       */
      function classRect(label) {
        const textNode = texts.find((node) => node.textContent.trim() === label);
        if (!textNode) return null;
        const textBox = textNode.getBBox();
        let bestArea = Number.POSITIVE_INFINITY;
        /** @type {BoxRect | null} */
        let bestRect = null;

        rects.forEach((rect) => {
          const rectBox = rect.getBBox();
          const contains =
            textBox.x >= rectBox.x - 0.5 &&
            textBox.x + textBox.width <= rectBox.x + rectBox.width + 0.5 &&
            textBox.y >= rectBox.y - 0.5 &&
            textBox.y + textBox.height <= rectBox.y + rectBox.height + 0.5;
          if (!contains) return;
          const area = rectBox.width * rectBox.height;
          if (area < bestArea) {
            bestArea = area;
            bestRect = { x: rectBox.x, y: rectBox.y, width: rectBox.width, height: rectBox.height };
          }
        });

        return bestRect;
      }

      /** @type {BoxRect | null} */
      const tvShow = classRect('TVShow');
      /** @type {BoxRect | null} */
      const genre = classRect('Genre');
      document.body.removeChild(host);

      if (!tvShow || !genre) {
        return { tvShow, genre, gap: null };
      }

      return {
        tvShow,
        genre,
        gap: genre.x - (tvShow.x + tvShow.width),
      };
    });

    expect(stats.tvShow).not.toBeNull();
    expect(stats.genre).not.toBeNull();
    expect(stats.gap).not.toBeNull();
    expect(stats.gap).toBeGreaterThanOrEqual(8);
  });

  test('off-center inherited source multiplicities stay near their endpoint lane', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForSelector('div[class$="diagram-container"] > svg');
    await page.waitForFunction(() => !!/** @type {any} */ (window).UMLClassDiagram);

    const stats = await page.evaluate(() => {
      const src = `@startuml
abstract class Content {
  # title: String
  # rating: String
  {abstract} + play(): void
}
class Movie {
  - duration: int
  + play(): void
}
class TVShow {
  + play(): void
}
class Season {
  - seasonNumber: int
}
class Episode {
  - episodeNumber: int
  - duration: int
  + play(): void
}
class Genre {
  - name: String
}
Movie --|> Content
TVShow --|> Content
TVShow "1" *-- "1..*" Season : contains
Season "1" *-- "1..*" Episode : contains
Content "0..*" -- "1..*" Genre : classifiedBy
@enduml`;

      const classRenderer = /** @type {{ render: (container: HTMLElement, text: string) => void }} */ (
        /** @type {any} */ (window).UMLClassDiagram
      );

      const host = document.createElement('div');
      host.style.width = '1200px';
      host.style.position = 'absolute';
      host.style.left = '-10000px';
      document.body.appendChild(host);
      classRenderer.render(host, src);

      const svg = host.querySelector('svg');
      if (!svg) {
        document.body.removeChild(host);
        return { foundRoute: false, foundMultiplicity: false, foundLabel: false };
      }

      /** @param {SVGPolylineElement} polyline */
      function parsePoints(polyline) {
        const raw = polyline.getAttribute('points') || '';
        return raw
          .trim()
          .split(/\s+/)
          .map((pair) => pair.split(',').map(Number))
          .filter((pair) => pair.length === 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
          .map((pair) => ({ x: pair[0], y: pair[1] }));
      }

      const tol = 1;
      const route = Array.from(svg.querySelectorAll('polyline'))
        .map((polyline) => parsePoints(/** @type {SVGPolylineElement} */ (polyline)))
        .find((points) =>
          points.length === 4 &&
          Math.abs(points[0].x - points[1].x) <= tol &&
          Math.abs(points[1].y - points[2].y) <= tol &&
          Math.abs(points[2].x - points[3].x) <= tol
        );

      const texts = Array.from(svg.querySelectorAll('text'));
      const multiplicity = texts.find((node) => node.textContent.trim() === '0..*');
      const label = texts.find((node) => node.textContent.trim() === 'classifiedBy');

      if (!route || !multiplicity || !label) {
        document.body.removeChild(host);
        return {
          foundRoute: !!route,
          foundMultiplicity: !!multiplicity,
          foundLabel: !!label,
        };
      }

      const multBox = multiplicity.getBBox();
      const labelBox = label.getBBox();
      document.body.removeChild(host);

      return {
        foundRoute: true,
        foundMultiplicity: true,
        foundLabel: true,
        elbowY: route[1].y,
        multiplicityCenterY: multBox.y + multBox.height / 2,
        labelCenterY: labelBox.y + labelBox.height / 2,
      };
    });

    expect(stats.foundRoute).toBe(true);
    expect(stats.foundMultiplicity).toBe(true);
    expect(stats.foundLabel).toBe(true);
    expect(Math.abs(stats.multiplicityCenterY - stats.elbowY)).toBeLessThanOrEqual(16);
    expect(stats.multiplicityCenterY).toBeLessThan(stats.labelCenterY);
  });

  test('mirrored inherited source multiplicities stay near their endpoint lane', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForSelector('div[class$="diagram-container"] > svg');
    await page.waitForFunction(() => !!/** @type {any} */ (window).UMLClassDiagram);

    const stats = await page.evaluate(() => {
      const src = `@startuml
abstract class Content {
  {abstract} + play(): void
}
class Genre {
  - name: String
}
class Movie {
  + play(): void
}
class TVShow {
  + play(): void
}
Movie --|> Content
TVShow --|> Content
Content "0..*" -- "1..*" Genre : classifiedBy
@enduml`;

      const classRenderer = /** @type {{ render: (container: HTMLElement, text: string) => void }} */ (
        /** @type {any} */ (window).UMLClassDiagram
      );

      const host = document.createElement('div');
      host.style.width = '1200px';
      host.style.position = 'absolute';
      host.style.left = '-10000px';
      document.body.appendChild(host);
      classRenderer.render(host, src);

      const svg = host.querySelector('svg');
      if (!svg) {
        document.body.removeChild(host);
        return { foundRoute: false, foundMultiplicity: false, foundLabel: false };
      }

      /** @param {SVGPolylineElement} polyline */
      function parsePoints(polyline) {
        const raw = polyline.getAttribute('points') || '';
        return raw
          .trim()
          .split(/\s+/)
          .map((pair) => pair.split(',').map(Number))
          .filter((pair) => pair.length === 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
          .map((pair) => ({ x: pair[0], y: pair[1] }));
      }

      const tol = 1;
      const route = Array.from(svg.querySelectorAll('polyline'))
        .map((polyline) => parsePoints(/** @type {SVGPolylineElement} */ (polyline)))
        .find((points) =>
          points.length === 3 &&
          Math.abs(points[0].y - points[1].y) <= tol &&
          Math.abs(points[1].x - points[2].x) <= tol
        );

      const texts = Array.from(svg.querySelectorAll('text'));
      const multiplicity = texts.find((node) => node.textContent.trim() === '0..*');
      const label = texts.find((node) => node.textContent.trim() === 'classifiedBy');

      if (!route || !multiplicity || !label) {
        document.body.removeChild(host);
        return {
          foundRoute: !!route,
          foundMultiplicity: !!multiplicity,
          foundLabel: !!label,
        };
      }

      const multBox = multiplicity.getBBox();
      const labelBox = label.getBBox();
      document.body.removeChild(host);

      return {
        foundRoute: true,
        foundMultiplicity: true,
        foundLabel: true,
        elbowY: route[0].y,
        multiplicityCenterY: multBox.y + multBox.height / 2,
        labelCenterY: labelBox.y + labelBox.height / 2,
      };
    });

    expect(stats.foundRoute).toBe(true);
    expect(stats.foundMultiplicity).toBe(true);
    expect(stats.foundLabel).toBe(true);
    expect(Math.abs(stats.multiplicityCenterY - stats.elbowY)).toBeLessThanOrEqual(16);
    expect(stats.multiplicityCenterY).toBeLessThan(stats.labelCenterY);
  });

  test('class relation shafts reach open-arrow tips with orthogonal approach', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForSelector('div[class$="diagram-container"] > svg');
    await page.waitForFunction(() => !!/** @type {any} */ (window).UMLClassDiagram);

    const stats = await page.evaluate(() => {
      const src = `@startuml
layout landscape
interface Mediator {
  + notify(sender: Object, event: String): void
}
class Hub
class AlarmClock {
  - mediator: Mediator
}
class CoffeeMaker {
  - mediator: Mediator
}
AlarmClock --> Mediator
CoffeeMaker --> Mediator
Hub --> CoffeeMaker
@enduml`;

      const classRenderer = /** @type {{ render: (container: HTMLElement, text: string) => void }} */ (
        /** @type {any} */ (window).UMLClassDiagram
      );

      const host = document.createElement('div');
      host.style.width = '1400px';
      host.style.position = 'absolute';
      host.style.left = '-10000px';
      document.body.appendChild(host);
      classRenderer.render(host, src);

      const svg = host.querySelector('svg');
      if (!svg) {
        document.body.removeChild(host);
        return { markerCount: 0, matchedCount: 0, orthogonalMatches: 0 };
      }

      /** @param {SVGPolylineElement} polyline */
      function parsePoints(polyline) {
        const raw = polyline.getAttribute('points') || '';
        return raw
          .trim()
          .split(/\s+/)
          .map((pair) => pair.split(',').map(Number))
          .filter((pair) => pair.length === 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
          .map((pair) => ({ x: pair[0], y: pair[1] }));
      }

      /** @param {{ x: number, y: number }[]} points */
      function isOrthogonal(points) {
        if (points.length < 2) return false;
        return points.every((point, index) => {
          if (index === 0) return true;
          const prev = points[index - 1];
          return Math.abs(point.x - prev.x) <= 0.5 || Math.abs(point.y - prev.y) <= 0.5;
        });
      }

      const polylines = Array.from(svg.querySelectorAll('polyline')).map((polyline) => ({
        points: parsePoints(/** @type {SVGPolylineElement} */ (polyline)),
      }));

      const orthogonalRoutes = polylines.filter((item) => item.points.length >= 2 && isOrthogonal(item.points));

      const openArrows = polylines.filter((item) => {
        if (item.points.length !== 3) return false;
        if (isOrthogonal(item.points)) return false;
        return true;
      });

      const tipTol = 1.5;
      let matchedCount = 0;
      let orthogonalMatches = 0;
      for (const marker of openArrows) {
        const tip = marker.points[1];
        const isVerticalArrow = Math.abs(marker.points[0].y - marker.points[2].y) < 0.5;
        const matchedRoute = orthogonalRoutes.find((route) => {
          const endPoint = route.points[route.points.length - 1];
          const startPoint = route.points[0];
          const matchEnd = isVerticalArrow
            ? Math.abs(endPoint.x - tip.x) <= 0.75 && Math.abs(endPoint.y - tip.y) <= tipTol
            : Math.abs(endPoint.y - tip.y) <= 0.75 && Math.abs(endPoint.x - tip.x) <= tipTol;
          const matchStart = isVerticalArrow
            ? Math.abs(startPoint.x - tip.x) <= 0.75 && Math.abs(startPoint.y - tip.y) <= tipTol
            : Math.abs(startPoint.y - tip.y) <= 0.75 && Math.abs(startPoint.x - tip.x) <= tipTol;
          const matchPoint = matchEnd || matchStart;
          return matchPoint;
        });
        if (matchedRoute) {
          matchedCount += 1;
          orthogonalMatches += 1;
        }
      }

      document.body.removeChild(host);
      return {
        markerCount: openArrows.length,
        matchedCount,
        orthogonalMatches,
      };
    });

    expect(stats.markerCount).toBeGreaterThan(0);
    expect(stats.matchedCount).toBe(stats.markerCount);
    expect(stats.orthogonalMatches).toBe(stats.markerCount);
  });

  test('targeted diagrams avoid tiny avoidable endpoint doglegs', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForSelector('div[class$="diagram-container"] > svg');

    const stats = await page.evaluate(() => {
      /** @param {SVGPolylineElement} polyline */
      function parsePoints(polyline) {
        const raw = polyline.getAttribute('points') || '';
        return raw
          .trim()
          .split(/\s+/)
          /** @param {string} pair */
          .map((pair) => pair.split(',').map(Number))
          /** @param {number[]} pair */
          .filter((pair) => pair.length === 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
          /** @param {[number, number]} pair */
          .map((pair) => {
            const [x, y] = pair;
            return { x, y };
          });
      }

      /** @param {{ x: number, y: number }[]} points */
      function hasTinyDogleg(points) {
        if (!points || points.length !== 4) return false;
        const [p0, p1, p2, p3] = points;
        const tol = 1;

        const h1 = Math.abs(p1.y - p0.y) <= tol;
        const v = Math.abs(p2.x - p1.x) <= tol;
        const h2 = Math.abs(p3.y - p2.y) <= tol;
        if (h1 && v && h2) {
          const middle = Math.abs(p2.y - p1.y);
          return middle > 0.3 && middle <= 12;
        }

        const v1 = Math.abs(p1.x - p0.x) <= tol;
        const h = Math.abs(p2.y - p1.y) <= tol;
        const v2 = Math.abs(p3.x - p2.x) <= tol;
        if (v1 && h && v2) {
          const middle = Math.abs(p2.x - p1.x);
          return middle > 0.3 && middle <= 12;
        }

        return false;
      }

      /** @param {string} title */
      function sectionDoglegs(title) {
        const heading = Array.from(document.querySelectorAll('h2')).find((node) => node.textContent.trim() === title);
        const container = heading && heading.nextElementSibling;
        const svg = container && container.querySelector ? container.querySelector('svg') : null;
        if (!svg) return null;

        return Array.from(svg.querySelectorAll('polyline'))
          /** @param {Element} polyline */
          .map(parsePoints)
          .filter((points) => hasTinyDogleg(points))
          .length;
      }

      return {
        train: sectionDoglegs('6. Train System (from Lecture)'),
        microservices: sectionDoglegs('28. Microservices Deployment')
      };
    });

    expect(stats.train).toBe(0);
    expect(stats.microservices).toBe(0);
  });

  test('test-uml renders every diagram without invalid SVG geometry', async ({ page }) => {
    /** @type {string[]} */
    const pageErrors = [];
    /** @type {string[]} */
    const consoleErrors = [];

    page.on('pageerror', (error) => {
      pageErrors.push(String(error));
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/test-uml.html');
    await page.waitForSelector('div[class$="diagram-container"] > svg');

    const stats = await page.evaluate(() => {
      const sections = Array.from(document.querySelectorAll('h2')).map((heading) => {
        const container = heading.nextElementSibling;
        const svg = container && container.querySelector ? container.querySelector('svg') : null;
        const viewBox = svg ? (svg.getAttribute('viewBox') || '') : '';
        const outer = svg ? svg.outerHTML : '';
        const shapeCount = svg
          ? svg.querySelectorAll('line, polyline, path, rect, circle, ellipse, text, polygon').length
          : 0;

        return {
          title: heading.textContent.trim(),
          hasSvg: !!svg,
          viewBox,
          shapeCount,
          hasInvalidCoords: svg ? /NaN|undefined/.test(outer) : true,
        };
      });

      return {
        headingCount: document.querySelectorAll('h2').length,
        svgCount: document.querySelectorAll('div[class$="diagram-container"] > svg').length,
        sections,
      };
    });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(stats.svgCount).toBe(stats.headingCount);

    const missing = stats.sections.filter((section) => !section.hasSvg).map((section) => section.title);
    const invalid = stats.sections
      .filter((section) => {
        if (!section.hasSvg) return false;
        if (!section.shapeCount) return true;
        if (section.hasInvalidCoords) return true;
        return !/^-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?\s+\d+(?:\.\d+)?\s+\d+(?:\.\d+)?$/.test(section.viewBox);
      })
      .map((section) => section.title);

    expect(missing, `Missing SVG output for: ${missing.join(', ')}`).toEqual([]);
    expect(invalid, `Invalid SVG geometry for: ${invalid.join(', ')}`).toEqual([]);
  });

  test('state example keeps the context, interface, and center state visually aligned', async ({ page }) => {
    await page.goto('/SEBook/designpatterns/state.html');
    await page.waitForSelector('.uml-class-diagram-container svg');

    const centers = await page.evaluate(() => {
      const svg = document.querySelectorAll('.uml-class-diagram-container svg')[1];
      if (!svg) return null;

      const texts = Array.from(svg.querySelectorAll('text'));
      const rects = Array.from(svg.querySelectorAll('rect'));

      /** @param {string} label */
      function rectCenter(label) {
        const textNode = texts.find((node) => node.textContent.trim() === label);
        if (!textNode) return null;
        const textBox = textNode.getBBox();
        let bestArea = Number.POSITIVE_INFINITY;
        let bestCenter = null;
        rects.forEach((rect) => {
          const rectBox = rect.getBBox();
          const contains =
            textBox.x >= rectBox.x &&
            textBox.x + textBox.width <= rectBox.x + rectBox.width &&
            textBox.y >= rectBox.y &&
            textBox.y + textBox.height <= rectBox.y + rectBox.height;
          if (!contains) return;
          const area = rectBox.width * rectBox.height;
          if (area < bestArea) {
            bestArea = area;
            bestCenter = rectBox.x + rectBox.width / 2;
          }
        });
        return bestCenter;
      }

      return {
        machine: rectCenter('GumballMachine'),
        state: rectCenter('State'),
        hasQuarter: rectCenter('HasQuarterState'),
      };
    });

    expect(centers).not.toBeNull();
    if (!centers || centers.machine == null || centers.state == null || centers.hasQuarter == null) {
      throw new Error('Expected GumballMachine, State, and HasQuarterState boxes in the rendered UML example.');
    }
    expect(Math.abs(centers.machine - centers.state)).toBeLessThanOrEqual(12);
    expect(Math.abs(centers.machine - centers.hasQuarter)).toBeLessThanOrEqual(12);
  });
});