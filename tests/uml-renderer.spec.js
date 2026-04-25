// @ts-check
const { test, expect } = require('@playwright/test');

/** @typedef {{ x: number, y: number, width: number, height: number }} BoxRect */

test.describe('UML renderer regressions', () => {
  test('sequence activations are explicit only', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!/** @type {any} */ (window).UMLSequenceDiagram);

    const stats = await page.evaluate(() => {
      function activationRects(svg) {
        return Array.from(svg.querySelectorAll('rect')).filter((rect) => {
          const w = Number(rect.getAttribute('width'));
          const h = Number(rect.getAttribute('height'));
          return Math.abs(w - 12) < 0.1 && h > 1;
        });
      }

      function render(src) {
        const host = document.createElement('div');
        host.style.width = '900px';
        host.style.position = 'absolute';
        host.style.left = '-10000px';
        document.body.appendChild(host);
        /** @type {{ render: (container: HTMLElement, text: string) => void }} */ (
          /** @type {any} */ (window).UMLSequenceDiagram
        ).render(host, src);
        const svg = host.querySelector('svg');
        const count = svg ? activationRects(svg).length : -1;
        document.body.removeChild(host);
        return count;
      }

      return {
        implicit: render(`@startuml
participant a: A
participant b: B
a -> b: call()
b --> a: done
@enduml`),
        explicit: render(`@startuml
participant a: A
participant b: B
a -> b: call()
activate b
b --> a: done
deactivate b
@enduml`)
      };
    });

    expect(stats.implicit).toBe(0);
    expect(stats.explicit).toBe(1);
  });

  test('short sequence activations close before following fragments', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!/** @type {any} */ (window).UMLSequenceDiagram);

    const stats = await page.evaluate(() => {
      const host = document.createElement('div');
      host.style.width = '900px';
      host.style.position = 'absolute';
      host.style.left = '-10000px';
      document.body.appendChild(host);

      /** @type {{ render: (container: HTMLElement, text: string) => void }} */ (
        /** @type {any} */ (window).UMLSequenceDiagram
      ).render(host, `@startuml
participant a: A
participant b: B
a -> b: setup()
activate b
deactivate b
loop [items]
a -> b: process()
activate b
b --> a: ok
deactivate b
end
@enduml`);

      const svg = host.querySelector('svg');
      if (!svg) {
        document.body.removeChild(host);
        return { firstBottom: null, fragmentTop: null };
      }

      const rects = Array.from(svg.querySelectorAll('rect'));
      const activations = rects
        .filter((rect) => Math.abs(Number(rect.getAttribute('width')) - 12) < 0.1 && Number(rect.getAttribute('height')) > 1)
        .map((rect) => ({
          y: Number(rect.getAttribute('y')),
          height: Number(rect.getAttribute('height')),
        }))
        .sort((a, b) => a.y - b.y);

      const fragmentFrames = rects
        .filter((rect) => rect.getAttribute('fill') === 'none' && Number(rect.getAttribute('width')) > 60)
        .map((rect) => ({ y: Number(rect.getAttribute('y')), height: Number(rect.getAttribute('height')) }))
        .sort((a, b) => a.y - b.y);

      const first = activations[0];
      const frame = fragmentFrames[0];
      document.body.removeChild(host);

      return {
        firstBottom: first ? first.y + first.height : null,
        fragmentTop: frame ? frame.y : null,
      };
    });

    expect(stats.firstBottom).not.toBeNull();
    expect(stats.fragmentTop).not.toBeNull();
    expect(stats.firstBottom).toBeLessThan(stats.fragmentTop);
  });

  test('self-message activations start at the receive occurrence', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!/** @type {any} */ (window).UMLSequenceDiagram);

    const stats = await page.evaluate(() => {
      const host = document.createElement('div');
      host.style.width = '700px';
      host.style.position = 'absolute';
      host.style.left = '-10000px';
      document.body.appendChild(host);

      /** @type {{ render: (container: HTMLElement, text: string) => void }} */ (
        /** @type {any} */ (window).UMLSequenceDiagram
      ).render(host, `@startuml
participant remote: RemoteControl
remote -> remote: remember command
activate remote
deactivate remote
@enduml`);

      const svg = host.querySelector('svg');
      if (!svg) {
        document.body.removeChild(host);
        return { activationY: null, receiveY: null };
      }

      const activation = Array.from(svg.querySelectorAll('rect')).find((rect) => {
        const w = Number(rect.getAttribute('width'));
        const h = Number(rect.getAttribute('height'));
        return Math.abs(w - 12) < 0.1 && h > 1;
      });
      const selfPolyline = Array.from(svg.querySelectorAll('polyline')).find((polyline) => {
        const points = (polyline.getAttribute('points') || '').trim().split(/\s+/);
        return points.length === 4;
      });
      const points = selfPolyline ? (selfPolyline.getAttribute('points') || '').trim().split(/\s+/) : [];
      const receive = points.length === 4 ? points[3].split(',') : [];

      const result = {
        activationY: activation ? Number(activation.getAttribute('y')) : null,
        receiveY: receive.length === 2 ? Number(receive[1]) : null,
      };
      document.body.removeChild(host);
      return result;
    });

    expect(stats.activationY).not.toBeNull();
    expect(stats.receiveY).not.toBeNull();
    expect(Math.abs(stats.activationY - stats.receiveY)).toBeLessThan(0.1);
  });

  test('compact self-message activations reserve room before fragments', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!/** @type {any} */ (window).UMLSequenceDiagram);

    const stats = await page.evaluate(() => {
      const host = document.createElement('div');
      host.style.width = '700px';
      host.style.position = 'absolute';
      host.style.left = '-10000px';
      document.body.appendChild(host);

      /** @type {{ render: (container: HTMLElement, text: string) => void }} */ (
        /** @type {any} */ (window).UMLSequenceDiagram
      ).render(host, `@startuml
layout compact
participant processor: Processor
participant bot: Bot
processor -> processor: _log_start(count)
activate processor
deactivate processor
loop [for post in posts]
  alt [bot._is_announcement(post)]
    processor -> bot: broadcast(post)
    activate bot
    deactivate bot
  end
end
@enduml`);

      const svg = host.querySelector('svg');
      if (!svg) {
        document.body.removeChild(host);
        return { activationHeight: null, activationBottom: null, fragmentTop: null };
      }

      const rects = Array.from(svg.querySelectorAll('rect'));
      const activations = rects
        .filter((rect) => Math.abs(Number(rect.getAttribute('width')) - 12) < 0.1 && Number(rect.getAttribute('height')) > 1)
        .map((rect) => ({
          y: Number(rect.getAttribute('y')),
          height: Number(rect.getAttribute('height')),
        }))
        .sort((a, b) => a.y - b.y);
      const fragmentFrames = rects
        .filter((rect) => rect.getAttribute('fill') === 'none' && Number(rect.getAttribute('width')) > 60)
        .map((rect) => ({ y: Number(rect.getAttribute('y')), height: Number(rect.getAttribute('height')) }))
        .sort((a, b) => a.y - b.y);

      const activation = activations[0];
      const frame = fragmentFrames[0];
      const result = {
        activationHeight: activation ? activation.height : null,
        activationBottom: activation ? activation.y + activation.height : null,
        fragmentTop: frame ? frame.y : null,
      };
      document.body.removeChild(host);
      return result;
    });

    expect(stats.activationHeight).toBeGreaterThanOrEqual(6);
    expect(stats.activationHeight).toBeLessThanOrEqual(10);
    expect(stats.activationBottom).toBeLessThan(stats.fragmentTop);
  });

  test('nested self-message activation before loop closes before the loop frame', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!/** @type {any} */ (window).UMLSequenceDiagram);

    const stats = await page.evaluate(() => {
      const host = document.createElement('div');
      host.style.width = '900px';
      host.style.position = 'absolute';
      host.style.left = '-10000px';
      document.body.appendChild(host);

      /** @type {{ render: (container: HTMLElement, text: string) => void }} */ (
        /** @type {any} */ (window).UMLSequenceDiagram
      ).render(host, `@startuml
layout landscape
participant Main as : Main
participant bot: DiscordBot
participant channel: Channel

activate Main
Main -> bot: run_digest(channel, posts)
activate bot
bot -> channel: get_subscriber_count()
activate channel
channel --> bot: count: int
deactivate channel
bot -> bot: _log_start(count)
activate bot
deactivate bot
loop [for post in posts]
  alt [bot._is_announcement(post)]
    bot -> channel: broadcast(post)
    activate channel
    deactivate channel
  else [else]
    bot -> bot: _log_skip(post)
    activate bot
    deactivate bot
  end
end
deactivate bot
deactivate Main
@enduml`);

      const svg = host.querySelector('svg');
      if (!svg) {
        document.body.removeChild(host);
        return { innerBottom: null, innerHeight: null, loopTop: null, outerBottom: null };
      }

      const rects = Array.from(svg.querySelectorAll('rect'));
      const activations = rects
        .filter((rect) => Math.abs(Number(rect.getAttribute('width')) - 12) < 0.1 && Number(rect.getAttribute('height')) > 1)
        .map((rect) => ({
          x: Number(rect.getAttribute('x')),
          y: Number(rect.getAttribute('y')),
          height: Number(rect.getAttribute('height')),
        }));
      const fragmentFrames = rects
        .filter((rect) => rect.getAttribute('fill') === 'none' && Number(rect.getAttribute('width')) > 80)
        .map((rect) => ({ y: Number(rect.getAttribute('y')), height: Number(rect.getAttribute('height')) }))
        .sort((a, b) => a.y - b.y);
      const loopFrame = fragmentFrames[0];

      const logText = Array.from(svg.querySelectorAll('text')).find((text) => text.textContent.trim() === '_log_start(count)');
      const logBox = logText ? /** @type {SVGGraphicsElement} */ (logText).getBBox() : null;
      const loopTop = loopFrame ? loopFrame.y : null;
      const candidates = activations
        .filter((activation) => logBox && activation.y >= logBox.y - 4 && loopTop != null && activation.y < loopTop)
        .sort((a, b) => b.x - a.x);
      const inner = candidates[0];
      const outer = activations
        .filter((activation) => loopTop != null && activation.y < loopTop && activation.y + activation.height > loopTop)
        .sort((a, b) => b.height - a.height)[0];

      const result = {
        innerBottom: inner ? inner.y + inner.height : null,
        innerHeight: inner ? inner.height : null,
        loopTop,
        outerBottom: outer ? outer.y + outer.height : null,
      };
      document.body.removeChild(host);
      return result;
    });

    expect(stats.innerBottom).not.toBeNull();
    expect(stats.loopTop).not.toBeNull();
    expect(stats.innerHeight).toBeLessThanOrEqual(10);
    expect(stats.innerBottom).toBeLessThan(stats.loopTop);
    expect(stats.outerBottom).toBeGreaterThan(stats.loopTop);
  });

  test('activations started inside opt fragments end inside the opt frame', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!/** @type {any} */ (window).UMLSequenceDiagram);

    const stats = await page.evaluate(() => {
      const host = document.createElement('div');
      host.style.width = '800px';
      host.style.position = 'absolute';
      host.style.left = '-10000px';
      document.body.appendChild(host);

      /** @type {{ render: (container: HTMLElement, text: string) => void }} */ (
        /** @type {any} */ (window).UMLSequenceDiagram
      ).render(host, `@startuml
participant Main as : Main
participant bot: DiscordBot
participant channel: Channel
Main -> bot: welcome(user)
activate bot
opt [not bot._is_subscribed(user)]
  bot -> channel: send_welcome(user)
  activate channel
  deactivate channel
end
deactivate bot
@enduml`);

      const svg = host.querySelector('svg');
      if (!svg) {
        document.body.removeChild(host);
        return { innerBottom: null, optBottom: null };
      }

      const rects = Array.from(svg.querySelectorAll('rect'));
      const activations = rects
        .filter((rect) => Math.abs(Number(rect.getAttribute('width')) - 12) < 0.1 && Number(rect.getAttribute('height')) > 1)
        .map((rect) => ({
          y: Number(rect.getAttribute('y')),
          height: Number(rect.getAttribute('height')),
        }))
        .sort((a, b) => a.y - b.y);
      const frame = rects
        .filter((rect) => rect.getAttribute('fill') === 'none' && Number(rect.getAttribute('width')) > 80)
        .map((rect) => ({ y: Number(rect.getAttribute('y')), height: Number(rect.getAttribute('height')) }))
        .sort((a, b) => a.y - b.y)[0];
      const inner = activations[1];
      const result = {
        innerBottom: inner ? inner.y + inner.height : null,
        optBottom: frame ? frame.y + frame.height : null,
      };
      document.body.removeChild(host);
      return result;
    });

    expect(stats.innerBottom).not.toBeNull();
    expect(stats.optBottom).not.toBeNull();
    expect(stats.innerBottom).toBeLessThan(stats.optBottom);
  });

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

      // Arrow tips are intentionally offset from the polyline endpoint by
      // ~1.725px (= strokeWidth * 0.75 + 0.6) so the arrow body sits on
      // the polyline instead of extending beyond the box edge. Both
      // tolerances below accommodate that shift.
      const tipAxialTol = 2.5;       // along the arrow's axial direction
      const tipLateralTol = 0.75;    // perpendicular to the arrow (should be exact)
      let matchedCount = 0;
      let orthogonalMatches = 0;
      let alignedCount = 0;
      for (const marker of openArrows) {
        const tip = marker.points[1];
        const armMid = {
          x: (marker.points[0].x + marker.points[2].x) / 2,
          y: (marker.points[0].y + marker.points[2].y) / 2,
        };
        const markerLen = Math.hypot(armMid.x - tip.x, armMid.y - tip.y) || 1;
        const markerVector = {
          x: (armMid.x - tip.x) / markerLen,
          y: (armMid.y - tip.y) / markerLen,
        };
        const isVerticalArrow = Math.abs(marker.points[0].y - marker.points[2].y) < 0.5;
        let matchedAt = null;
        const matchedRoute = orthogonalRoutes.find((route) => {
          const endPoint = route.points[route.points.length - 1];
          const startPoint = route.points[0];
          const matchEnd = isVerticalArrow
            ? Math.abs(endPoint.x - tip.x) <= tipLateralTol && Math.abs(endPoint.y - tip.y) <= tipAxialTol
            : Math.abs(endPoint.y - tip.y) <= tipLateralTol && Math.abs(endPoint.x - tip.x) <= tipAxialTol;
          const matchStart = isVerticalArrow
            ? Math.abs(startPoint.x - tip.x) <= tipLateralTol && Math.abs(startPoint.y - tip.y) <= tipAxialTol
            : Math.abs(startPoint.y - tip.y) <= tipLateralTol && Math.abs(startPoint.x - tip.x) <= tipAxialTol;
          if (matchEnd) matchedAt = 'end';
          else if (matchStart) matchedAt = 'start';
          const matchPoint = matchEnd || matchStart;
          return matchPoint;
        });
        if (matchedRoute) {
          matchedCount += 1;
          orthogonalMatches += 1;
          const routeVector = matchedAt === 'start'
            ? {
                x: matchedRoute.points[1].x - matchedRoute.points[0].x,
                y: matchedRoute.points[1].y - matchedRoute.points[0].y,
              }
            : {
                x: matchedRoute.points[matchedRoute.points.length - 2].x - matchedRoute.points[matchedRoute.points.length - 1].x,
                y: matchedRoute.points[matchedRoute.points.length - 2].y - matchedRoute.points[matchedRoute.points.length - 1].y,
              };
          const routeLen = Math.hypot(routeVector.x, routeVector.y) || 1;
          const dot =
            markerVector.x * (routeVector.x / routeLen) +
            markerVector.y * (routeVector.y / routeLen);
          if (dot > 0.9) alignedCount += 1;
        }
      }

      document.body.removeChild(host);
      return {
        markerCount: openArrows.length,
        matchedCount,
        orthogonalMatches,
        alignedCount,
      };
    });

    expect(stats.markerCount).toBeGreaterThan(0);
    expect(stats.matchedCount).toBe(stats.markerCount);
    expect(stats.orthogonalMatches).toBe(stats.markerCount);
    expect(stats.alignedCount).toBe(stats.markerCount);
  });

  test('class relationship crossings use visible bridges when lanes cannot separate', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!/** @type {any} */ (window).UMLClassDiagram);

    const stats = await page.evaluate(() => {
      const src = `@startuml
layout landscape
interface SmartHomeMediator {
  +notify(sender: Object, event: String): void
}
class SmartHomeHub
class AlarmClock {
  -mediator: SmartHomeMediator
}
class CoffeeMaker {
  -mediator: SmartHomeMediator
}
class Calendar {
  -mediator: SmartHomeMediator
  +isWeekday(): bool
}
class Sprinkler {
  -mediator: SmartHomeMediator
}
SmartHomeHub ..|> SmartHomeMediator
AlarmClock --> SmartHomeMediator
CoffeeMaker --> SmartHomeMediator
Calendar --> SmartHomeMediator
Sprinkler --> SmartHomeMediator
SmartHomeHub --> CoffeeMaker : commands
SmartHomeHub --> Calendar : queries
SmartHomeHub --> Sprinkler : commands
@enduml`;

      const host = document.createElement('div');
      host.style.width = '1200px';
      host.style.position = 'absolute';
      host.style.left = '-10000px';
      document.body.appendChild(host);
      /** @type {{ render: (container: HTMLElement, text: string) => void }} */ (
        /** @type {any} */ (window).UMLClassDiagram
      ).render(host, src);

      const svg = host.querySelector('svg');
      if (!svg) {
        document.body.removeChild(host);
        return { hasSvg: false, crossingCount: 0, bridgeCount: 0 };
      }

      /** @param {SVGPolylineElement} polyline */
      function parsePoints(polyline) {
        return (polyline.getAttribute('points') || '')
          .trim()
          .split(/\s+/)
          .map((pair) => pair.split(',').map(Number))
          .filter((pair) => pair.length === 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
          .map((pair) => ({ x: pair[0], y: pair[1] }));
      }

      /** @param {{x:number,y:number}[]} points */
      function isOrthogonal(points) {
        return points.length >= 2 && points.every((point, index) => {
          if (index === 0) return true;
          const prev = points[index - 1];
          return Math.abs(point.x - prev.x) <= 0.5 || Math.abs(point.y - prev.y) <= 0.5;
        });
      }

      /** @param {{x:number,y:number}} a0 @param {{x:number,y:number}} a1 @param {{x:number,y:number}} b0 @param {{x:number,y:number}} b1 */
      function segmentsCross(a0, a1, b0, b1) {
        const ah = Math.abs(a0.y - a1.y) < 1;
        const av = Math.abs(a0.x - a1.x) < 1;
        const bh = Math.abs(b0.y - b1.y) < 1;
        const bv = Math.abs(b0.x - b1.x) < 1;
        const tol = 2;
        if (ah && bv) {
          const x1 = Math.min(a0.x, a1.x);
          const x2 = Math.max(a0.x, a1.x);
          const y1 = Math.min(b0.y, b1.y);
          const y2 = Math.max(b0.y, b1.y);
          return b0.x > x1 + tol && b0.x < x2 - tol && a0.y > y1 + tol && a0.y < y2 - tol;
        }
        if (av && bh) {
          const y1 = Math.min(a0.y, a1.y);
          const y2 = Math.max(a0.y, a1.y);
          const x1 = Math.min(b0.x, b1.x);
          const x2 = Math.max(b0.x, b1.x);
          return a0.x > x1 + tol && a0.x < x2 - tol && b0.y > y1 + tol && b0.y < y2 - tol;
        }
        return false;
      }

      const routes = Array.from(svg.querySelectorAll('polyline'))
        .map((polyline) => parsePoints(/** @type {SVGPolylineElement} */ (polyline)))
        .filter((points) => points.length >= 2 && isOrthogonal(points));
      let crossingCount = 0;
      for (let i = 0; i < routes.length; i++) {
        for (let j = i + 1; j < routes.length; j++) {
          for (let a = 0; a < routes[i].length - 1; a++) {
            for (let b = 0; b < routes[j].length - 1; b++) {
              if (segmentsCross(routes[i][a], routes[i][a + 1], routes[j][b], routes[j][b + 1])) crossingCount += 1;
            }
          }
        }
      }

      const bridgeCount = Array.from(svg.querySelectorAll('line')).filter((line) => {
        const strokeWidth = Number(line.getAttribute('stroke-width') || 0);
        const stroke = line.getAttribute('stroke') || '';
        return strokeWidth > 4 && stroke !== '#444';
      }).length;

      document.body.removeChild(host);
      return { hasSvg: true, crossingCount, bridgeCount };
    });

    expect(stats.hasSvg).toBe(true);
    expect(stats.crossingCount === 0 || stats.bridgeCount >= stats.crossingCount).toBe(true);
  });

  test('class associations avoid intermediate class boxes', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!/** @type {any} */ (window).UMLClassDiagram);

    const stats = await page.evaluate(() => {
      const src = `@startuml
layout landscape
class Model
interface Observer {
  +update(model: Model): void
}
class View {
  +update(model: Model): void
  +render(): void
}
class Controller {
  +handleInput(): void
}
Model "1" -- "*" Observer : notifies >
View ..|> Observer
View --> Model : reads
View --> Controller : delegates input
Controller --> Model : updates
@enduml`;

      const host = document.createElement('div');
      host.style.width = '900px';
      host.style.position = 'absolute';
      host.style.left = '-10000px';
      document.body.appendChild(host);
      /** @type {{ render: (container: HTMLElement, text: string) => void }} */ (
        /** @type {any} */ (window).UMLClassDiagram
      ).render(host, src);

      const svg = host.querySelector('svg');
      if (!svg) {
        document.body.removeChild(host);
        return { hasSvg: false, hits: [] };
      }

      /** @param {Element} el */
      function box(el) {
        const b = /** @type {SVGGraphicsElement} */ (el).getBBox();
        return { l: b.x, r: b.x + b.width, t: b.y, b: b.y + b.height, w: b.width, h: b.height, text: el.textContent?.trim() };
      }

      /** @param {string} label */
      function classBox(label) {
        const text = Array.from(svg.querySelectorAll('text')).find((node) => node.textContent.trim() === label);
        if (!text) return null;
        const tb = box(text);
        let best = null;
        let bestArea = -1;
        Array.from(svg.querySelectorAll('rect')).forEach((rect) => {
          const rb = box(rect);
          const contains =
            tb.l >= rb.l - 1 &&
            tb.r <= rb.r + 1 &&
            tb.t >= rb.t - 24 &&
            tb.b <= rb.b + 72;
          if (!contains) return;
          const area = rb.w * rb.h;
          if (area > bestArea) {
            bestArea = area;
            best = { ...rb, label };
          }
        });
        return best;
      }

      /** @param {SVGPolylineElement} polyline */
      function parsePoints(polyline) {
        return (polyline.getAttribute('points') || '')
          .trim()
          .split(/\s+/)
          .map((pair) => pair.split(',').map(Number))
          .filter((pair) => pair.length === 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
          .map((pair) => ({ x: pair[0], y: pair[1] }));
      }

      /** @param {{x:number,y:number}[]} points */
      function isOrthogonal(points) {
        if (points.length < 2) return false;
        return points.every((point, index) => {
          if (index === 0) return true;
          const prev = points[index - 1];
          return Math.abs(prev.x - point.x) < 1 || Math.abs(prev.y - point.y) < 1;
        });
      }

      /** @param {{x:number,y:number}} a @param {{x:number,y:number}} b @param {{l:number,r:number,t:number,b:number,label:string}} rect */
      function segmentHitsInterior(a, b, rect) {
        const pad = 2;
        if (Math.abs(a.x - b.x) < 1) {
          const y1 = Math.min(a.y, b.y);
          const y2 = Math.max(a.y, b.y);
          return a.x > rect.l + pad && a.x < rect.r - pad && y2 > rect.t + pad && y1 < rect.b - pad;
        }
        if (Math.abs(a.y - b.y) < 1) {
          const x1 = Math.min(a.x, b.x);
          const x2 = Math.max(a.x, b.x);
          return a.y > rect.t + pad && a.y < rect.b - pad && x2 > rect.l + pad && x1 < rect.r - pad;
        }
        return true;
      }

      const classBoxes = ['Model', 'Observer', 'View', 'Controller']
        .map((label) => classBox(label))
        .filter(Boolean);
      const routes = Array.from(svg.querySelectorAll('polyline'))
        .map((polyline) => parsePoints(/** @type {SVGPolylineElement} */ (polyline)))
        .filter(isOrthogonal);

      const hits = [];
      for (let ri = 0; ri < routes.length; ri++) {
        for (let pi = 0; pi < routes[ri].length - 1; pi++) {
          for (const rect of classBoxes) {
            if (segmentHitsInterior(routes[ri][pi], routes[ri][pi + 1], rect)) {
              hits.push({ route: ri, segment: pi, box: rect.label });
            }
          }
        }
      }

      document.body.removeChild(host);
      return { hasSvg: true, hits };
    });

    expect(stats.hasSvg).toBe(true);
    expect(stats.hits).toEqual([]);
  });

  test('class association label markers render as route-oriented triangles', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!/** @type {any} */ (window).UMLClassDiagram);

    const stats = await page.evaluate(() => {
      const host = document.createElement('div');
      host.style.width = '900px';
      host.style.position = 'absolute';
      host.style.left = '-10000px';
      document.body.appendChild(host);

      /** @type {{ render: (container: HTMLElement, text: string) => void }} */ (
        /** @type {any} */ (window).UMLClassDiagram
      ).render(host, `@startuml
layout landscape
class Source
class Target
Source -- Target : reads <
@enduml`);

      const svg = host.querySelector('svg');
      if (!svg) {
        document.body.removeChild(host);
        return { hasSvg: false };
      }

      /** @param {SVGPolylineElement} polyline */
      function parsePolyline(polyline) {
        return (polyline.getAttribute('points') || '')
          .trim()
          .split(/\s+/)
          .map((pair) => pair.split(',').map(Number))
          .filter((pair) => pair.length === 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
          .map((pair) => ({ x: pair[0], y: pair[1] }));
      }

      /** @param {SVGPolygonElement} polygon */
      function parsePolygon(polygon) {
        return (polygon.getAttribute('points') || '')
          .trim()
          .split(/\s+/)
          .map((pair) => pair.split(',').map(Number))
          .filter((pair) => pair.length === 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
          .map((pair) => ({ x: pair[0], y: pair[1] }));
      }

      /** @param {{x:number,y:number}[]} points @param {{x:number,y:number}} placement */
      function routeDirectionAt(points, placement) {
        let best = null;
        let bestDist = Infinity;
        for (let i = 0; i < points.length - 1; i++) {
          const p0 = points[i];
          const p1 = points[i + 1];
          const len = Math.abs(p1.x - p0.x) + Math.abs(p1.y - p0.y);
          if (len < 1) continue;

          let closestX;
          let closestY;
          let dir;
          if (Math.abs(p1.y - p0.y) < 1) {
            closestX = Math.max(Math.min(p0.x, p1.x), Math.min(Math.max(p0.x, p1.x), placement.x));
            closestY = p0.y;
            dir = p1.x >= p0.x ? 'right' : 'left';
          } else {
            closestX = p0.x;
            closestY = Math.max(Math.min(p0.y, p1.y), Math.min(Math.max(p0.y, p1.y), placement.y));
            dir = p1.y >= p0.y ? 'down' : 'up';
          }

          const dist = Math.abs(placement.x - closestX) + Math.abs(placement.y - closestY) - len * 0.001;
          if (dist < bestDist) {
            bestDist = dist;
            best = dir;
          }
        }
        return best;
      }

      /** @param {{x:number,y:number}[]} points */
      function triangleDirection(points) {
        const minX = Math.min(...points.map((p) => p.x));
        const maxX = Math.max(...points.map((p) => p.x));
        const minY = Math.min(...points.map((p) => p.y));
        const maxY = Math.max(...points.map((p) => p.y));
        const xRange = maxX - minX;
        const yRange = maxY - minY;
        if (xRange >= yRange) {
          const maxCount = points.filter((p) => Math.abs(p.x - maxX) < 0.1).length;
          return maxCount === 1 ? 'right' : 'left';
        }
        const maxCount = points.filter((p) => Math.abs(p.y - maxY) < 0.1).length;
        return maxCount === 1 ? 'down' : 'up';
      }

      const texts = Array.from(svg.querySelectorAll('text')).map((node) => (node.textContent || '').trim());
      const label = Array.from(svg.querySelectorAll('text')).find((node) => (node.textContent || '').trim() === 'reads');
      const triangle = svg.querySelector('polygon.uml-association-label-direction');
      const route = svg.querySelector('polyline');

      if (!label || !triangle || !route) {
        document.body.removeChild(host);
        return {
          hasSvg: true,
          hasLabel: !!label,
          hasTriangle: !!triangle,
          hasRoute: !!route,
          hasTextMarker: texts.some((text) => text.includes('<') || text.includes('>'))
        };
      }

      const labelBox = /** @type {SVGGraphicsElement} */ (label).getBBox();
      const routePoints = parsePolyline(/** @type {SVGPolylineElement} */ (route));
      const trianglePoints = parsePolygon(/** @type {SVGPolygonElement} */ (triangle));
      const labelCenter = { x: labelBox.x + labelBox.width / 2, y: labelBox.y + labelBox.height / 2 };

      document.body.removeChild(host);
      return {
        hasSvg: true,
        hasLabel: true,
        hasTriangle: true,
        hasRoute: true,
        hasTextMarker: texts.some((text) => text.includes('<') || text.includes('>')),
        routeDirection: routeDirectionAt(routePoints, labelCenter),
        triangleDirection: triangleDirection(trianglePoints)
      };
    });

    expect(stats.hasSvg).toBe(true);
    expect(stats.hasLabel).toBe(true);
    expect(stats.hasTriangle).toBe(true);
    expect(stats.hasRoute).toBe(true);
    expect(stats.hasTextMarker).toBe(false);
    expect(stats.triangleDirection).toBe(stats.routeDirection);
  });

  test('label direction cues render as triangles across diagram renderers', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!/** @type {any} */ (window).UMLClassDiagram);

    const stats = await page.evaluate(() => {
      const cases = [
        {
          renderer: 'UMLSequenceDiagram',
          label: 'sequence',
          source: `@startuml
participant A
participant B
A -> B : sends <
@enduml`
        },
        {
          renderer: 'UMLStateDiagram',
          label: 'state',
          source: `@startuml
state A
state B
A --> B : moves >
@enduml`
        },
        {
          renderer: 'UMLComponentDiagram',
          label: 'component',
          source: `@startuml
component A
component B
A --> B : calls <
@enduml`
        },
        {
          renderer: 'UMLDeploymentDiagram',
          label: 'deployment',
          source: `@startuml
node A
node B
A --> B : ships >
@enduml`
        },
        {
          renderer: 'UMLUseCaseDiagram',
          label: 'usecase',
          source: `@startuml
actor User
usecase "Login"
User -- Login : starts <
@enduml`
        },
        {
          renderer: 'UMLActivityDiagram',
          label: 'activity',
          source: `@startuml
(*) --> [go >] "Run"
"Run" --> (*)
@enduml`
        },
        {
          renderer: 'UMLFreeformDiagram',
          label: 'freeform',
          source: `@startuml
box "A" as A
box "B" as B
A --> B : flows <
@enduml`
        }
      ];

      return cases.map((item) => {
        const host = document.createElement('div');
        host.style.width = '900px';
        host.style.position = 'absolute';
        host.style.left = '-10000px';
        document.body.appendChild(host);

        /** @type {{ render: (container: HTMLElement, text: string) => void }} */ (
          /** @type {any} */ (window)[item.renderer]
        ).render(host, item.source);

        const svg = host.querySelector('svg');
        if (!svg) {
          document.body.removeChild(host);
          return { label: item.label, hasSvg: false };
        }

        const texts = Array.from(svg.querySelectorAll('text')).map((node) => (node.textContent || '').trim());
        const triangleCount = svg.querySelectorAll('polygon.uml-label-direction, polygon.uml-association-label-direction').length;
        document.body.removeChild(host);
        return {
          label: item.label,
          hasSvg: true,
          triangleCount,
          hasTextMarker: texts.some((text) => text.includes('<') || text.includes('>'))
        };
      });
    });

    expect(stats.every((item) => item.hasSvg), JSON.stringify(stats)).toBe(true);
    expect(stats.every((item) => item.triangleCount >= 1), JSON.stringify(stats)).toBe(true);
    expect(stats.every((item) => !item.hasTextMarker), JSON.stringify(stats)).toBe(true);
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
      // Only audit UML diagram sections — git-graph sections (G1/G2/G3) live
      // in the same page but aren't UML output, so their geometry rules differ.
      const sections = Array.from(document.querySelectorAll('h2'))
        .filter((heading) => {
          const title = heading.textContent.trim();
          // Exclude git-graph diagrams (titled with "G<number>.")
          if (/^G\d+\./.test(title)) return false;
          const container = heading.nextElementSibling;
          // Only headings whose next sibling renders into a UML diagram container
          return container && container.querySelector && container.querySelector('div[class$="diagram-container"], svg');
        })
        .map((heading) => {
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
        umlHeadingCount: sections.length,
        umlSvgCount: sections.filter((s) => s.hasSvg).length,
        sections,
      };
    });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(stats.umlSvgCount).toBe(stats.umlHeadingCount);

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

  test('component layout keeps API back-edge routes outside components and compact', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!/** @type {any} */ (window).UMLComponentDiagram);

    const stats = await page.evaluate(() => {
      const src = `@startuml
layout landscape
!theme plain
left to right direction
skinparam componentStyle uml2
skinparam nodesep 20
skinparam ranksep 150
gateway -[hidden]r- auth
auth -[hidden]r- users
users -[hidden]r- clubs
clubs -[hidden]r- events
events -[hidden]r- notifications
component users {
  portin "/users" as users_port
}
component clubs {
  portin "/clubs" as clubs_port
}
component events {
  portin "/events" as events_port
}
component notifications {
  portin "/notifications" as notifications_port
}
notifications --> users_port : "patch /users/unsubscribe/{userId}"
notifications --> events_port : "get /events/template-data/{templateId}"
auth --> clubs_port : "get /clubs/roles/{clubId}/{userId}"
auth --> users_port : "post /users"
gateway --> users_port : "get /users"
gateway --> clubs_port : "get /clubs"
clubs --> events_port : "post /events"
events --> notifications_port : "post /notifications/event-update"
events --> clubs_port : "delete /clubs/event-reference/{eventId}"
@enduml`;

      const host = document.createElement('div');
      host.style.width = '1200px';
      host.style.position = 'absolute';
      host.style.left = '-10000px';
      document.body.appendChild(host);
      /** @type {{ render: (container: HTMLElement, text: string) => void }} */ (
        /** @type {any} */ (window).UMLComponentDiagram
      ).render(host, src);

      const svg = host.querySelector('svg');
      if (!svg) {
        document.body.removeChild(host);
        return { hasSvg: false };
      }

      /** @param {Element} el */
      function box(el) {
        const b = /** @type {SVGGraphicsElement} */ (el).getBBox();
        return { l: b.x, r: b.x + b.width, t: b.y, b: b.y + b.height, w: b.width, h: b.height, text: el.textContent?.trim() };
      }

      /** @param {SVGPolylineElement} polyline */
      function parsePoints(polyline) {
        return (polyline.getAttribute('points') || '')
          .trim()
          .split(/\s+/)
          .map((pair) => pair.split(',').map(Number))
          .filter((pair) => pair.length === 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
          .map((pair) => ({ x: pair[0], y: pair[1] }));
      }

      /** @param {{x:number,y:number}} p0 @param {{x:number,y:number}} p1 @param {{l:number,r:number,t:number,b:number}} rect */
      function segmentHitsRectInterior(p0, p1, rect) {
        const pad = 1.5;
        const r = { l: rect.l + pad, r: rect.r - pad, t: rect.t + pad, b: rect.b - pad };
        if (Math.abs(p0.x - p1.x) < 1) {
          const y1 = Math.min(p0.y, p1.y);
          const y2 = Math.max(p0.y, p1.y);
          return p0.x > r.l && p0.x < r.r && y2 > r.t && y1 < r.b;
        }
        if (Math.abs(p0.y - p1.y) < 1) {
          const x1 = Math.min(p0.x, p1.x);
          const x2 = Math.max(p0.x, p1.x);
          return p0.y > r.t && p0.y < r.b && x2 > r.l && x1 < r.r;
        }
        return true;
      }

      /** @param {{x:number,y:number}} a0 @param {{x:number,y:number}} a1 @param {{x:number,y:number}} b0 @param {{x:number,y:number}} b1 */
      function crosses(a0, a1, b0, b1) {
        const ah = Math.abs(a0.y - a1.y) < 1;
        const av = Math.abs(a0.x - a1.x) < 1;
        const bh = Math.abs(b0.y - b1.y) < 1;
        const bv = Math.abs(b0.x - b1.x) < 1;
        if (ah && bv) {
          const x1 = Math.min(a0.x, a1.x), x2 = Math.max(a0.x, a1.x);
          const y1 = Math.min(b0.y, b1.y), y2 = Math.max(b0.y, b1.y);
          return b0.x > x1 + 2 && b0.x < x2 - 2 && a0.y > y1 + 2 && a0.y < y2 - 2;
        }
        if (av && bh) {
          const y1 = Math.min(a0.y, a1.y), y2 = Math.max(a0.y, a1.y);
          const x1 = Math.min(b0.x, b1.x), x2 = Math.max(b0.x, b1.x);
          return a0.x > x1 + 2 && a0.x < x2 - 2 && b0.y > y1 + 2 && b0.y < y2 - 2;
        }
        return false;
      }

      /** @param {{l:number,r:number,t:number,b:number}} a @param {{l:number,r:number,t:number,b:number}} b @param {number} pad */
      function rectsOverlap(a, b, pad) {
        return a.r + pad > b.l && a.l - pad < b.r && a.b + pad > b.t && a.t - pad < b.b;
      }

      const componentBoxes = Array.from(svg.querySelectorAll('rect.uml-component-box')).map(box);
      const labels = Array.from(svg.querySelectorAll('text.uml-component-connector-label')).map(box);
      const componentOrderNames = ['gateway', 'auth', 'users', 'clubs', 'events', 'notifications'];
      const componentLabelCenters = {};
      for (const labelBox of Array.from(svg.querySelectorAll('text')).map(box)) {
        if (componentOrderNames.includes(labelBox.text)) {
          componentLabelCenters[labelBox.text] = (labelBox.l + labelBox.r) / 2;
        }
      }
      const routes = Array.from(svg.querySelectorAll('polyline'))
        .map((polyline) => parsePoints(/** @type {SVGPolylineElement} */ (polyline)))
        .filter((points) => points.length >= 2);

      let componentHits = 0;
      let crossings = 0;
      let trackOverlap = 0;
      const labelRouteHits = [];
      let longBackEdgeTopDetours = 0;
      let maxLongBackEdgeExtra = 0;
      let diagonalSegments = 0;
      const segments = [];
      const componentTop = Math.min(...componentBoxes.map((rect) => rect.t));
      for (let ri = 0; ri < routes.length; ri++) {
        const points = routes[ri];
        const first = points[0];
        const last = points[points.length - 1];
        const longBackEdge = first.x - last.x > 600;
        if (longBackEdge) {
          let routeLen = 0;
          for (let pi = 0; pi < points.length - 1; pi++) {
            routeLen += Math.abs(points[pi + 1].x - points[pi].x) + Math.abs(points[pi + 1].y - points[pi].y);
          }
          const directLen = Math.abs(first.x - last.x) + Math.abs(first.y - last.y);
          maxLongBackEdgeExtra = Math.max(maxLongBackEdgeExtra, routeLen - directLen);
        }
        for (let pi = 0; pi < points.length - 1; pi++) {
          if (Math.abs(points[pi].x - points[pi + 1].x) >= 1 &&
              Math.abs(points[pi].y - points[pi + 1].y) >= 1) {
            diagonalSegments++;
          }
          for (const rect of componentBoxes) {
            if (segmentHitsRectInterior(points[pi], points[pi + 1], rect)) componentHits++;
          }
          if (longBackEdge && Math.abs(points[pi].y - points[pi + 1].y) < 1) {
            const span = Math.abs(points[pi + 1].x - points[pi].x);
            if (points[pi].y < componentTop - 1 && span > 40) longBackEdgeTopDetours++;
          }
          segments.push({ ri, p0: points[pi], p1: points[pi + 1] });
        }
      }
      for (let i = 0; i < segments.length; i++) {
        for (let j = i + 1; j < segments.length; j++) {
          if (segments[i].ri !== segments[j].ri && crosses(segments[i].p0, segments[i].p1, segments[j].p0, segments[j].p1)) crossings++;
          if (segments[i].ri !== segments[j].ri) {
            const a0 = segments[i].p0, a1 = segments[i].p1;
            const b0 = segments[j].p0, b1 = segments[j].p1;
            const ah = Math.abs(a0.y - a1.y) < 1;
            const av = Math.abs(a0.x - a1.x) < 1;
            const bh = Math.abs(b0.y - b1.y) < 1;
            const bv = Math.abs(b0.x - b1.x) < 1;
            if (ah && bh && Math.abs(a0.y - b0.y) < 6) {
              const overlap = Math.min(Math.max(a0.x, a1.x), Math.max(b0.x, b1.x)) -
                Math.max(Math.min(a0.x, a1.x), Math.min(b0.x, b1.x));
              if (overlap > 6) trackOverlap += overlap;
            } else if (av && bv && Math.abs(a0.x - b0.x) < 6) {
              const overlap = Math.min(Math.max(a0.y, a1.y), Math.max(b0.y, b1.y)) -
                Math.max(Math.min(a0.y, a1.y), Math.min(b0.y, b1.y));
              if (overlap > 6) trackOverlap += overlap;
            }
          }
        }
      }

      /** @param {{l:number,r:number,t:number,b:number}} rect @param {{x:number,y:number}} p0 @param {{x:number,y:number}} p1 */
      function labelHitsSegment(rect, p0, p1) {
        const pad = 4;
        if (Math.abs(p0.y - p1.y) < 1) {
          const x1 = Math.min(p0.x, p1.x);
          const x2 = Math.max(p0.x, p1.x);
          return p0.y >= rect.t - pad && p0.y <= rect.b + pad &&
            x2 > rect.l - pad && x1 < rect.r + pad;
        }
        if (Math.abs(p0.x - p1.x) < 1) {
          const y1 = Math.min(p0.y, p1.y);
          const y2 = Math.max(p0.y, p1.y);
          return p0.x >= rect.l - pad && p0.x <= rect.r + pad &&
            y2 > rect.t - pad && y1 < rect.b + pad;
        }
        return false;
      }

      let labelOverlaps = 0;
      for (let li = 0; li < labels.length; li++) {
        for (const rect of componentBoxes) {
          if (rectsOverlap(labels[li], rect, 2)) labelOverlaps++;
        }
        for (let lj = li + 1; lj < labels.length; lj++) {
          if (rectsOverlap(labels[li], labels[lj], 4)) labelOverlaps++;
        }
        for (const segment of segments) {
          if (labelHitsSegment(labels[li], segment.p0, segment.p1)) {
            labelRouteHits.push({
              label: labels[li].text,
              route: segment.ri,
              l: Math.round(labels[li].l),
              t: Math.round(labels[li].t),
              r: Math.round(labels[li].r),
              b: Math.round(labels[li].b),
              x1: Math.round(segment.p0.x),
              y1: Math.round(segment.p0.y),
              x2: Math.round(segment.p1.x),
              y2: Math.round(segment.p1.y),
            });
          }
        }
      }

      const viewBox = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number);
      const sourceOrderViolations = [];
      for (let i = 0; i < componentOrderNames.length - 1; i++) {
        const left = componentOrderNames[i];
        const right = componentOrderNames[i + 1];
        if (Number.isFinite(componentLabelCenters[left]) &&
            Number.isFinite(componentLabelCenters[right]) &&
            componentLabelCenters[left] >= componentLabelCenters[right]) {
          sourceOrderViolations.push({
            left,
            right,
            leftX: Math.round(componentLabelCenters[left]),
            rightX: Math.round(componentLabelCenters[right]),
          });
        }
      }
      document.body.removeChild(host);
      return {
        hasSvg: true,
        componentHits,
        crossings,
        trackOverlap,
        longBackEdgeTopDetours,
        maxLongBackEdgeExtra,
        labelOverlaps,
        labelRouteHits,
        diagonalSegments,
        sourceOrderViolations,
        width: viewBox[2],
        height: viewBox[3],
      };
    });

    expect(stats.hasSvg).toBe(true);
    expect(stats.diagonalSegments).toBe(0);
    expect(stats.componentHits).toBe(0);
    expect(stats.crossings).toBe(0);
    expect(stats.trackOverlap).toBe(0);
    expect(stats.longBackEdgeTopDetours).toBeLessThanOrEqual(1);
    expect(stats.maxLongBackEdgeExtra).toBeLessThanOrEqual(380);
    expect(stats.labelOverlaps).toBe(0);
    expect(stats.labelRouteHits).toEqual([]);
    expect(stats.sourceOrderViolations).toEqual([]);
    expect(stats.width).toBeLessThan(2100);
    expect(stats.height).toBeLessThan(650);
  });

  test('component connector labels stay readable for parallel edges and interface pairs', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!/** @type {any} */ (window).UMLComponentDiagram);

    const stats = await page.evaluate(() => {
      /** @param {string} src */
      function render(src) {
        const host = document.createElement('div');
        host.style.width = '1200px';
        host.style.position = 'absolute';
        host.style.left = '-10000px';
        document.body.appendChild(host);
        /** @type {{ render: (container: HTMLElement, text: string) => void }} */ (
          /** @type {any} */ (window).UMLComponentDiagram
        ).render(host, src);
        return host;
      }

      /** @param {Element} el */
      function box(el) {
        const b = /** @type {SVGGraphicsElement} */ (el).getBBox();
        return { l: b.x, r: b.x + b.width, t: b.y, b: b.y + b.height };
      }

      /** @param {{l:number,r:number,t:number,b:number}} a @param {{l:number,r:number,t:number,b:number}} b @param {number} pad */
      function rectsOverlap(a, b, pad) {
        return a.r + pad > b.l && a.l - pad < b.r && a.b + pad > b.t && a.t - pad < b.b;
      }

      const parallelHost = render(`@startuml
component Client
component LibraryServer
Client --> LibraryServer : GET Book
Client --> LibraryServer : POST Book
@enduml`);
      const parallelSvg = parallelHost.querySelector('svg');
      const parallelTexts = Array.from(parallelSvg.querySelectorAll('text'));
      const getLabel = parallelTexts.find((text) => text.textContent.trim() === 'GET Book');
      const postLabel = parallelTexts.find((text) => text.textContent.trim() === 'POST Book');
      const routeYs = Array.from(parallelSvg.querySelectorAll('polyline'))
        .filter((polyline) => polyline.getAttribute('stroke') === '#444')
        .map((polyline) => (polyline.getAttribute('points') || '').trim().split(/\s+/)[0].split(',').map(Number)[1])
        .sort((a, b) => a - b);
      const getBox = getLabel ? box(getLabel) : null;
      const postBox = postLabel ? box(postLabel) : null;
      const parallelOk = !!getBox && !!postBox &&
        !rectsOverlap(getBox, postBox, 4) &&
        routeYs.length === 2 &&
        getBox.b < routeYs[0] - 2 &&
        postBox.t > routeYs[1] + 2;
      document.body.removeChild(parallelHost);

      const ifaceHost = render(`@startuml
component WebApp {
  provide "UserAPI" as wa_api
  require "DataStore" as wa_ds
}
component Database {
  provide "DataStore" as db_ds
}
component MobileApp {
  require "UserAPI" as ma_api
}
wa_api ..> ma_api : REST
db_ds ..> wa_ds : JDBC
@enduml`);
      const ifaceSvg = ifaceHost.querySelector('svg');
      const ifaceTexts = Array.from(ifaceSvg.querySelectorAll('text'));
      const userApiLabels = ifaceTexts.filter((text) => text.textContent.trim() === 'UserAPI');
      const dataStoreLabels = ifaceTexts.filter((text) => text.textContent.trim() === 'DataStore');
      const circles = Array.from(ifaceSvg.querySelectorAll('circle')).filter((circle) => Number(circle.getAttribute('r')) > 2);
      const ifaceLabelsClearSymbols = userApiLabels.concat(dataStoreLabels).every((label) => {
        const labelBox = box(label);
        return circles.every((circle) => {
          const cx = Number(circle.getAttribute('cx'));
          const cy = Number(circle.getAttribute('cy'));
          const r = Number(circle.getAttribute('r'));
          return !rectsOverlap(labelBox, { l: cx - r, r: cx + r, t: cy - r, b: cy + r }, 4);
        });
      });
      document.body.removeChild(ifaceHost);

      const microHost = render(`@startuml
component APIGateway
component UserService
component OrderService
component PaymentService
component NotificationService

APIGateway --> UserService : /api/users
APIGateway --> OrderService : /api/orders
OrderService --> PaymentService : processPayment
OrderService ..> NotificationService : sendConfirmation
PaymentService ..> NotificationService : sendReceipt
@enduml`);
      const microSvg = microHost.querySelector('svg');
      const microTexts = Array.from(microSvg.querySelectorAll('text'));
      const microRects = Array.from(microSvg.querySelectorAll('rect.uml-component-box')).map((rect) => ({ rect, box: box(rect) }));
      function componentBox(label) {
        const text = microTexts.find((node) => node.textContent.trim() === label);
        if (!text) return null;
        const tb = box(text);
        const candidates = microRects.filter((item) =>
          tb.l >= item.box.l - 1 &&
          tb.r <= item.box.r + 1 &&
          tb.t >= item.box.t - 24 &&
          tb.b <= item.box.b + 24
        );
        return candidates.sort((a, b) => (a.box.r - a.box.l) * (a.box.b - a.box.t) - (b.box.r - b.box.l) * (b.box.b - b.box.t))[0]?.box || null;
      }
      const apiUsersLabel = microTexts.find((text) => text.textContent.trim() === '/api/users');
      const apiOrdersLabel = microTexts.find((text) => text.textContent.trim() === '/api/orders');
      const sendConfirmationLabel = microTexts.find((text) => text.textContent.trim() === 'sendConfirmation');
      const gatewayBox = componentBox('APIGateway');
      const userServiceBox = componentBox('UserService');
      const orderServiceBox = componentBox('OrderService');
      const apiUsersBox = apiUsersLabel ? box(apiUsersLabel) : null;
      const apiOrdersBox = apiOrdersLabel ? box(apiOrdersLabel) : null;
      const microLabelsClear = !!gatewayBox && !!userServiceBox && !!orderServiceBox && !!apiUsersBox && !!apiOrdersBox &&
        apiUsersBox.l > gatewayBox.r + 10 &&
        apiUsersBox.r < userServiceBox.l - 10 &&
        apiOrdersBox.l > gatewayBox.r + 10 &&
        apiOrdersBox.r < orderServiceBox.l - 10;
      const sendConfirmationSingleLine = !!sendConfirmationLabel &&
        sendConfirmationLabel.querySelectorAll('tspan').length === 0 &&
        sendConfirmationLabel.textContent.trim() === 'sendConfirmation';
      document.body.removeChild(microHost);

      return {
        parallelOk,
        userApiCount: userApiLabels.length,
        dataStoreCount: dataStoreLabels.length,
        ifaceLabelsClearSymbols,
        microLabelsClear,
        sendConfirmationSingleLine,
      };
    });

    expect(stats.parallelOk).toBe(true);
    expect(stats.userApiCount).toBe(1);
    expect(stats.dataStoreCount).toBe(1);
    expect(stats.ifaceLabelsClearSymbols).toBe(true);
    expect(stats.microLabelsClear).toBe(true);
    expect(stats.sendConfirmationSingleLine).toBe(true);
  });

  test('component port routing avoids unnecessary empty U-loops between neighboring ports', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!/** @type {any} */ (window).UMLComponentDiagram);

    const results = await page.evaluate(() => {
      /** @param {string} src */
      function render(src) {
        const host = document.createElement('div');
        host.style.width = '1400px';
        host.style.position = 'absolute';
        host.style.left = '-10000px';
        document.body.appendChild(host);
        /** @type {{ render: (container: HTMLElement, text: string) => void }} */ (
          /** @type {any} */ (window).UMLComponentDiagram
        ).render(host, src);
        return host;
      }

      /** @param {SVGPolylineElement} polyline */
      function parsePoints(polyline) {
        return (polyline.getAttribute('points') || '')
          .trim()
          .split(/\s+/)
          .map((pair) => pair.split(',').map(Number))
          .filter((pair) => pair.length === 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
          .map((pair) => ({ x: pair[0], y: pair[1] }));
      }

      /** @param {{x:number,y:number}[]} points */
      function routeLength(points) {
        let length = 0;
        for (let i = 0; i < points.length - 1; i++) {
          length += Math.abs(points[i + 1].x - points[i].x) + Math.abs(points[i + 1].y - points[i].y);
        }
        return length;
      }

      /** @param {string} src */
      function inspect(src) {
        const host = render(src);
        const svg = host.querySelector('svg');
        if (!svg) {
          document.body.removeChild(host);
          return { hasSvg: false, loops: [] };
        }

        const routes = Array.from(svg.querySelectorAll('polyline'))
          .map((polyline, index) => ({ index, points: parsePoints(/** @type {SVGPolylineElement} */ (polyline)) }))
          .filter((route) => route.points.length >= 2);
        const loops = [];
        const avoidableEndpointDoglegs = [];
        const terminalRailCrowding = [];
        const componentBoxes = Array.from(svg.querySelectorAll('rect.uml-component-box')).map((rect, index) => {
          const b = /** @type {SVGGraphicsElement} */ (rect).getBBox();
          return { index, l: b.x, r: b.x + b.width, t: b.y, b: b.y + b.height };
        });
        const portSquares = Array.from(svg.querySelectorAll('rect'))
          .filter((rect) =>
            !rect.classList.contains('uml-component-box') &&
            Math.abs(Number(rect.getAttribute('width')) - 10) < 0.1 &&
            Math.abs(Number(rect.getAttribute('height')) - 10) < 0.1
          )
          .map((rect) => {
            const b = /** @type {SVGGraphicsElement} */ (rect).getBBox();
            return { l: b.x, r: b.x + b.width, t: b.y, b: b.y + b.height };
          });
        const detachedEndpoints = [];
        const wrongPortSideAttachments = [];
        const routeComplexityViolations = [];
        const outerLoopViolations = [];

        /** @param {{x:number,y:number}} point */
        function touchingPort(point) {
          const pad = 8;
          return portSquares.find((rect) =>
            point.x >= rect.l - pad &&
            point.x <= rect.r + pad &&
            point.y >= rect.t - pad &&
            point.y <= rect.b + pad
          ) || null;
        }

        /** @param {{x:number,y:number}} point */
        function endpointTouchesPort(point) {
          return !!touchingPort(point);
        }

        /** @param {{l:number,r:number,t:number,b:number}} port */
        function semanticPortSide(port) {
          const pad = 2.5;
          for (const componentBox of componentBoxes) {
            if (Math.abs(port.l - componentBox.l) <= pad &&
                port.b >= componentBox.t - pad &&
                port.t <= componentBox.b + pad) return 'left';
            if (Math.abs(port.r - componentBox.r) <= pad &&
                port.b >= componentBox.t - pad &&
                port.t <= componentBox.b + pad) return 'right';
          }
          return null;
        }

        /** @param {{x:number,y:number}} point @param {number} routeIndex @param {'first'|'last'} end */
        function recordWrongPortSideAttachment(point, routeIndex, end) {
          const port = touchingPort(point);
          if (!port) return;
          const side = semanticPortSide(port);
          if (!side) return;
          const expectedX = side === 'left' ? port.l : port.r;
          const onDeclaredSide = Math.abs(point.x - expectedX) <= 2.5 &&
            point.y >= port.t - 2 &&
            point.y <= port.b + 2;
          if (!onDeclaredSide) {
            wrongPortSideAttachments.push({
              route: routeIndex,
              end,
              side,
              point: { x: Math.round(point.x), y: Math.round(point.y) },
              port: {
                l: Math.round(port.l),
                r: Math.round(port.r),
                t: Math.round(port.t),
                b: Math.round(port.b),
              },
            });
          }
        }

        /** @param {{x:number,y:number}} a0 @param {{x:number,y:number}} a1 @param {{x:number,y:number}} b0 @param {{x:number,y:number}} b1 */
        function segmentsCross(a0, a1, b0, b1) {
          const ah = Math.abs(a0.y - a1.y) < 1;
          const av = Math.abs(a0.x - a1.x) < 1;
          const bh = Math.abs(b0.y - b1.y) < 1;
          const bv = Math.abs(b0.x - b1.x) < 1;
          if (ah && bv) {
            return b0.x > Math.min(a0.x, a1.x) + 2 &&
              b0.x < Math.max(a0.x, a1.x) - 2 &&
              a0.y > Math.min(b0.y, b1.y) + 2 &&
              a0.y < Math.max(b0.y, b1.y) - 2;
          }
          if (av && bh) {
            return a0.x > Math.min(b0.x, b1.x) + 2 &&
              a0.x < Math.max(b0.x, b1.x) - 2 &&
              b0.y > Math.min(a0.y, a1.y) + 2 &&
              b0.y < Math.max(a0.y, a1.y) - 2;
          }
          return false;
        }

        /** @param {{index:number,points:{x:number,y:number}[]}[]} routes */
        function routeCrossingCount(routes) {
          let crossings = 0;
          for (let i = 0; i < routes.length; i++) {
            for (let j = i + 1; j < routes.length; j++) {
              for (let ai = 0; ai < routes[i].points.length - 1; ai++) {
                for (let bi = 0; bi < routes[j].points.length - 1; bi++) {
                  if (segmentsCross(routes[i].points[ai], routes[i].points[ai + 1], routes[j].points[bi], routes[j].points[bi + 1])) {
                    crossings++;
                  }
                }
              }
            }
          }
          return crossings;
        }

        /** @param {{x:number,y:number}[]} points */
        function bendCount(points) {
          let bends = 0;
          let last = '';
          for (let i = 0; i < points.length - 1; i++) {
            const dx = Math.abs(points[i + 1].x - points[i].x);
            const dy = Math.abs(points[i + 1].y - points[i].y);
            const dir = dx >= dy ? 'h' : 'v';
            if (dx < 1 && dy < 1) continue;
            if (last && dir !== last) bends++;
            last = dir;
          }
          return bends;
        }

        /** @param {{x:number,y:number}[]} points @param {'source'|'target'} end */
        function endpointDogleg(points, end) {
          if (points.length < 4) return null;
          const slice = end === 'source'
            ? points.slice(0, 4)
            : points.slice(points.length - 4);
          const [p0, p1, p2, p3] = slice;
          const firstIsH = Math.abs(p0.y - p1.y) < 1;
          const secondIsV = Math.abs(p1.x - p2.x) < 1;
          const thirdIsH = Math.abs(p2.y - p3.y) < 1;
          if (!firstIsH || !secondIsV || !thirdIsH) return null;
          const firstLen = Math.abs(p1.x - p0.x);
          const verticalLen = Math.abs(p2.y - p1.y);
          const thirdLen = Math.abs(p3.x - p2.x);
          const terminalLen = end === 'source' ? firstLen : thirdLen;
          const laneLen = end === 'source' ? thirdLen : firstLen;
          if (verticalLen <= 44 && terminalLen <= 58 && laneLen >= 70) {
            return {
              verticalLen: Math.round(verticalLen),
              terminalLen: Math.round(terminalLen),
              laneLen: Math.round(laneLen),
            };
          }
          return null;
        }

        /** @param {{x:number,y:number}[]} points @param {'source'|'target'} end */
        function terminalRailTooClose(points, end) {
          if (points.length < 4) return null;
          const slice = end === 'source'
            ? points.slice(0, 4)
            : points.slice(points.length - 4);
          const [p0, p1, p2, p3] = slice;
          const firstIsH = Math.abs(p0.y - p1.y) < 1;
          const secondIsV = Math.abs(p1.x - p2.x) < 1;
          const thirdIsH = Math.abs(p2.y - p3.y) < 1;
          if (!firstIsH || !secondIsV || !thirdIsH) return null;
          const firstLen = Math.abs(p1.x - p0.x);
          const verticalLen = Math.abs(p2.y - p1.y);
          const thirdLen = Math.abs(p3.x - p2.x);
          const terminalLen = end === 'source' ? firstLen : thirdLen;
          const laneLen = end === 'source' ? thirdLen : firstLen;
          if (verticalLen > 12 && laneLen > 90 && terminalLen < 62) {
            return {
              verticalLen: Math.round(verticalLen),
              terminalLen: Math.round(terminalLen),
              laneLen: Math.round(laneLen),
            };
          }
          return null;
        }

        /** @param {{x:number,y:number}} p0 @param {{x:number,y:number}} p1 @param {{l:number,r:number,t:number,b:number}} rect */
        function segmentDistanceToRect(p0, p1, rect) {
          let dx = 0;
          let dy = 0;
          if (Math.abs(p0.y - p1.y) < 1) {
            const x1 = Math.min(p0.x, p1.x);
            const x2 = Math.max(p0.x, p1.x);
            dx = x2 < rect.l ? rect.l - x2 : (x1 > rect.r ? x1 - rect.r : 0);
            dy = p0.y < rect.t ? rect.t - p0.y : (p0.y > rect.b ? p0.y - rect.b : 0);
          } else if (Math.abs(p0.x - p1.x) < 1) {
            const y1 = Math.min(p0.y, p1.y);
            const y2 = Math.max(p0.y, p1.y);
            dx = p0.x < rect.l ? rect.l - p0.x : (p0.x > rect.r ? p0.x - rect.r : 0);
            dy = y2 < rect.t ? rect.t - y2 : (y1 > rect.b ? y1 - rect.b : 0);
          }
          if (dx === 0 && dy === 0) return 0;
          if (dx === 0) return dy;
          if (dy === 0) return dx;
          return Math.hypot(dx, dy);
        }

        /** @param {{x:number,y:number}} point @param {{l:number,r:number,t:number,b:number}} rect */
        function pointTouchesComponent(point, rect) {
          const pad = 10;
          const onVertical = Math.abs(point.x - rect.l) <= pad || Math.abs(point.x - rect.r) <= pad;
          const inY = point.y >= rect.t - pad && point.y <= rect.b + pad;
          const onHorizontal = Math.abs(point.y - rect.t) <= pad || Math.abs(point.y - rect.b) <= pad;
          const inX = point.x >= rect.l - pad && point.x <= rect.r + pad;
          return (onVertical && inY) || (onHorizontal && inX);
        }

        /** @param {{index:number,points:{x:number,y:number}[]}[]} routes */
        function wireHaloViolations(routes) {
          const segments = [];
          for (const route of routes) {
            for (let i = 0; i < route.points.length - 1; i++) {
              const p0 = route.points[i];
              const p1 = route.points[i + 1];
              if (Math.abs(p0.y - p1.y) < 1) {
                segments.push({
                  route: route.index,
                  i,
                  kind: 'h',
                  y: p0.y,
                  x1: Math.min(p0.x, p1.x),
                  x2: Math.max(p0.x, p1.x),
                  len: Math.abs(p1.x - p0.x),
                });
              } else if (Math.abs(p0.x - p1.x) < 1) {
                segments.push({
                  route: route.index,
                  i,
                  kind: 'v',
                  x: p0.x,
                  y1: Math.min(p0.y, p1.y),
                  y2: Math.max(p0.y, p1.y),
                  len: Math.abs(p1.y - p0.y),
                });
              }
            }
          }

          const violations = [];
          const halo = 16;
          const overlap = (a1, a2, b1, b2) => Math.min(a2, b2) - Math.max(a1, b1);
          for (let i = 0; i < segments.length; i++) {
            for (let j = i + 1; j < segments.length; j++) {
              const a = segments[i];
              const b = segments[j];
              if (a.route === b.route || a.len < 24 || b.len < 24) continue;
              if (a.kind === 'h' && b.kind === 'h') {
                const shared = overlap(a.x1, a.x2, b.x1, b.x2);
                const gap = Math.abs(a.y - b.y);
                if (shared > 8 && gap > 0.5 && gap < halo) {
                  violations.push({ routes: [a.route, b.route], kind: 'h', gap: Math.round(gap), overlap: Math.round(shared) });
                }
              } else if (a.kind === 'v' && b.kind === 'v') {
                const shared = overlap(a.y1, a.y2, b.y1, b.y2);
                const gap = Math.abs(a.x - b.x);
                if (shared > 8 && gap > 0.5 && gap < halo) {
                  violations.push({ routes: [a.route, b.route], kind: 'v', gap: Math.round(gap), overlap: Math.round(shared) });
                }
              }
            }
          }
          return violations;
        }

        const componentClearanceViolations = [];
        const componentTop = Math.min(...componentBoxes.map((rect) => rect.t));
        const componentBottom = Math.max(...componentBoxes.map((rect) => rect.b));
        for (const route of routes) {
          const first = route.points[0];
          const last = route.points[route.points.length - 1];
          if (!endpointTouchesPort(first)) detachedEndpoints.push({ index: route.index, end: 'first' });
          if (!endpointTouchesPort(last)) detachedEndpoints.push({ index: route.index, end: 'last' });
          recordWrongPortSideAttachment(first, route.index, 'first');
          recordWrongPortSideAttachment(last, route.index, 'last');
          const sourceDogleg = endpointDogleg(route.points, 'source');
          if (sourceDogleg) avoidableEndpointDoglegs.push({ index: route.index, end: 'source', ...sourceDogleg });
          const targetDogleg = endpointDogleg(route.points, 'target');
          if (targetDogleg) avoidableEndpointDoglegs.push({ index: route.index, end: 'target', ...targetDogleg });
          const sourceRail = terminalRailTooClose(route.points, 'source');
          if (sourceRail) terminalRailCrowding.push({ index: route.index, end: 'source', ...sourceRail });
          const targetRail = terminalRailTooClose(route.points, 'target');
          if (targetRail) terminalRailCrowding.push({ index: route.index, end: 'target', ...targetRail });
          const xs = route.points.map((point) => point.x);
          const ys = route.points.map((point) => point.y);
          const length = routeLength(route.points);
          const direct = Math.abs(first.x - last.x) + Math.abs(first.y - last.y);
          const extra = length - direct;
          const bends = bendCount(route.points);
          const longBackEdge = Math.abs(first.x - last.x) > 650;
          const runaway = Math.max(
            Math.max(...ys) - Math.max(first.y, last.y),
            Math.min(first.y, last.y) - Math.min(...ys)
          );
          const componentFieldEscape = Math.max(
            componentTop - Math.min(...ys),
            Math.max(...ys) - componentBottom
          );
          const localConnection = Math.abs(first.x - last.x) < 260 && direct < 300;
          if (localConnection && extra > 160 && runaway > 90) {
            loops.push({
              index: route.index,
              extra: Math.round(extra),
              runaway: Math.round(runaway),
              endpointSpan: Math.round(Math.abs(first.x - last.x)),
              routeWidth: Math.round(Math.max(...xs) - Math.min(...xs)),
            });
          }
          if ((!longBackEdge && bends > 4) ||
              (longBackEdge && bends > 6) ||
              (!longBackEdge && route.points.length > 6) ||
              (longBackEdge && route.points.length > 8) ||
              (!longBackEdge && extra > 280) ||
              (longBackEdge && extra > 420)) {
            routeComplexityViolations.push({
              index: route.index,
              points: route.points.length,
              bends,
              extra: Math.round(extra),
              longBackEdge,
            });
          }
          if (!longBackEdge && componentFieldEscape > 110) {
            outerLoopViolations.push({
              index: route.index,
              escape: Math.round(componentFieldEscape),
              minY: Math.round(Math.min(...ys)),
              maxY: Math.round(Math.max(...ys)),
            });
          }
          for (let pi = 0; pi < route.points.length - 1; pi++) {
            for (const rect of componentBoxes) {
              const endpointBox = pointTouchesComponent(first, rect) || pointTouchesComponent(last, rect);
              if (endpointBox) continue;
              const distance = segmentDistanceToRect(route.points[pi], route.points[pi + 1], rect);
              if (distance < 16) {
                componentClearanceViolations.push({
                  route: route.index,
                  segment: pi,
                  component: rect.index,
                  distance: Math.round(distance),
                });
              }
            }
          }
        }

        document.body.removeChild(host);
        return {
          hasSvg: true,
          loops,
          detachedEndpoints,
          wrongPortSideAttachments,
          avoidableEndpointDoglegs,
          terminalRailCrowding,
          crossings: routeCrossingCount(routes),
          routeComplexityViolations,
          outerLoopViolations,
          componentClearanceViolations,
          wireHaloViolations: wireHaloViolations(routes),
        };
      }

      const gateway = inspect(`@startuml
component Gateway {
  portout "out1" as g_out1
  portout "out2" as g_out2
}
component Auth {
  portin "in" as a_in
  portout "out1" as a_out1
  portout "out2" as a_out2
}
component Users {
  portin "/users" as u_p1
  portin "/users" as u_p2
  portin "/users/unsubscribe/{userId}" as u_p3
}
component Clubs {
  portin "/clubs" as c_p1
  portin "/clubs/event-reference/{eventId}" as c_p2
  portin "/clubs/roles/{clubId}/{userId}" as c_p3
  portout "out1" as c_out1
}
component Events {
  portin "/events" as e_p1
  portin "/events/template-data/{templateId}" as e_p2
  portout "out1" as e_out1
  portout "out2" as e_out2
}
component Notifications {
  portin "/notifications/event-update" as n_p1
  portout "out1" as n_out1
  portout "out2" as n_out2
}
g_out1 --> c_p1 : POST
g_out2 --> u_p2 : POST
a_out1 --> u_p1 : GET
a_out2 --> c_p3 : GET
c_out1 --> e_p1 : GET
e_out1 --> c_p2 : GET
e_out2 --> n_p1 : POST
n_out1 --> e_p2 : GET
n_out2 --> u_p3 : POST
@enduml`);

      const adjacentBackEdge = inspect(`@startuml
left to right direction
component Notifications {
  portout "out1" as n_out1
  portin "/notifications/event-update" as n_in
  portout "out2" as n_out2
}
component Templates {
  portin "/templates/template-data/{templateId}" as t_in
  portout "out2" as t_out2
}
n_out1 --> t_in : GET
t_out2 --> n_in : POST
@enduml`);

      return { gateway, adjacentBackEdge };
    });

    for (const [name, result] of Object.entries(results)) {
      expect(result.hasSvg, `${name} rendered`).toBe(true);
      expect(result.loops, `${name} unnecessary loops`).toEqual([]);
      expect(result.detachedEndpoints, `${name} port endpoints`).toEqual([]);
      expect(result.wrongPortSideAttachments, `${name} declared port side attachments`).toEqual([]);
      expect(result.avoidableEndpointDoglegs, `${name} avoidable endpoint doglegs`).toEqual([]);
      expect(result.terminalRailCrowding, `${name} terminal rail crowding`).toEqual([]);
      expect(result.crossings, `${name} avoidable route crossings`).toBe(0);
      expect(result.routeComplexityViolations, `${name} route complexity`).toEqual([]);
      expect(result.outerLoopViolations, `${name} outer loop escapes`).toEqual([]);
      expect(result.componentClearanceViolations, `${name} component clearance`).toEqual([]);
      expect(result.wireHaloViolations, `${name} wire halo violations`).toEqual([]);
    }
  });

  test('component port ordering swaps side ports to avoid avoidable crossings', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!/** @type {any} */ (window).UMLComponentDiagram);

    const stats = await page.evaluate(() => {
      const host = document.createElement('div');
      host.style.width = '1100px';
      host.style.position = 'absolute';
      host.style.left = '-10000px';
      document.body.appendChild(host);
      /** @type {{ render: (container: HTMLElement, text: string) => void }} */ (
        /** @type {any} */ (window).UMLComponentDiagram
      ).render(host, `@startuml
left to right direction
component Auth {
  portout "out1" as auth_out1
  portout "out2" as auth_out2
}
component Clubs {
  portin "/clubs/top" as clubs_top
  portin "/clubs/bottom" as clubs_bottom
}
auth_out1 --> clubs_bottom : GET
auth_out2 --> clubs_top : GET
@enduml`);

      const svg = host.querySelector('svg');
      if (!svg) {
        document.body.removeChild(host);
        return { hasSvg: false, crossings: -1, out1Y: null, out2Y: null };
      }

      function parsePoints(polyline) {
        return (polyline.getAttribute('points') || '')
          .trim()
          .split(/\s+/)
          .map((pair) => pair.split(',').map(Number))
          .filter((pair) => pair.length === 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
          .map((pair) => ({ x: pair[0], y: pair[1] }));
      }

      function labelY(textValue) {
        const text = Array.from(svg.querySelectorAll('text'))
          .find((node) => (node.textContent || '').trim() === textValue);
        if (!text) return null;
        const b = /** @type {SVGGraphicsElement} */ (text).getBBox();
        return b.y + b.height / 2;
      }

      function segmentsCross(a0, a1, b0, b1) {
        const aH = Math.abs(a0.y - a1.y) < 1;
        const aV = Math.abs(a0.x - a1.x) < 1;
        const bH = Math.abs(b0.y - b1.y) < 1;
        const bV = Math.abs(b0.x - b1.x) < 1;
        if (aH && bV) {
          const ax1 = Math.min(a0.x, a1.x);
          const ax2 = Math.max(a0.x, a1.x);
          const by1 = Math.min(b0.y, b1.y);
          const by2 = Math.max(b0.y, b1.y);
          return b0.x > ax1 + 2 && b0.x < ax2 - 2 && a0.y > by1 + 2 && a0.y < by2 - 2;
        }
        if (aV && bH) {
          return segmentsCross(b0, b1, a0, a1);
        }
        return false;
      }

      const routes = Array.from(svg.querySelectorAll('polyline'))
        .map((polyline) => parsePoints(/** @type {SVGPolylineElement} */ (polyline)))
        .filter((points) => points.length >= 2);
      let crossings = 0;
      for (let i = 0; i < routes.length; i++) {
        for (let j = i + 1; j < routes.length; j++) {
          for (let ai = 0; ai < routes[i].length - 1; ai++) {
            for (let bi = 0; bi < routes[j].length - 1; bi++) {
              if (segmentsCross(routes[i][ai], routes[i][ai + 1], routes[j][bi], routes[j][bi + 1])) crossings++;
            }
          }
        }
      }

      const result = {
        hasSvg: true,
        crossings,
        out1Y: labelY('out1'),
        out2Y: labelY('out2'),
      };
      document.body.removeChild(host);
      return result;
    });

    expect(stats.hasSvg).toBe(true);
    expect(stats.crossings).toBe(0);
    expect(stats.out2Y).toBeLessThan(stats.out1Y);
  });

  test('component layout fits labels and favors straight facing-port routes', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!/** @type {any} */ (window).UMLComponentDiagram);

    const stats = await page.evaluate(() => {
      const host = document.createElement('div');
      host.style.width = '1200px';
      host.style.position = 'absolute';
      host.style.left = '-10000px';
      document.body.appendChild(host);
      /** @type {{ render: (container: HTMLElement, text: string) => void }} */ (
        /** @type {any} */ (window).UMLComponentDiagram
      ).render(host, `@startuml
component Frontend {
  portout "httpOut" as f_out
}
component Backend {
  portin "httpIn" as b_in
  portout "dbOut" as b_dbout
  portout "eventOut" as b_eventout
}
component Database {
  portin "dbIn" as db_in
}
component EventBus {
  portin "eventIn" as eb_in
}
f_out --> b_in : HTTP / JSON
b_dbout --> db_in : SQL
b_eventout --> eb_in : publish
@enduml`);

      const svg = host.querySelector('svg');
      if (!svg) {
        document.body.removeChild(host);
        return { hasSvg: false };
      }

      /** @param {SVGPolylineElement} polyline */
      function parsePoints(polyline) {
        return (polyline.getAttribute('points') || '')
          .trim()
          .split(/\s+/)
          .map((pair) => pair.split(',').map(Number))
          .filter((pair) => pair.length === 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
          .map((pair) => ({ x: pair[0], y: pair[1] }));
      }

      /** @param {Element} el */
      function box(el) {
        const b = /** @type {SVGGraphicsElement} */ (el).getBBox();
        return { l: b.x, r: b.x + b.width, t: b.y, b: b.y + b.height };
      }

      /** @param {{x:number,y:number}} p0 @param {{x:number,y:number}} p1 @param {{l:number,r:number,t:number,b:number}} rect */
      function segmentDistanceToRect(p0, p1, rect) {
        let dx = 0;
        let dy = 0;
        if (Math.abs(p0.y - p1.y) < 1) {
          const x1 = Math.min(p0.x, p1.x);
          const x2 = Math.max(p0.x, p1.x);
          dx = x2 < rect.l ? rect.l - x2 : (x1 > rect.r ? x1 - rect.r : 0);
          dy = p0.y < rect.t ? rect.t - p0.y : (p0.y > rect.b ? p0.y - rect.b : 0);
        } else if (Math.abs(p0.x - p1.x) < 1) {
          const y1 = Math.min(p0.y, p1.y);
          const y2 = Math.max(p0.y, p1.y);
          dx = p0.x < rect.l ? rect.l - p0.x : (p0.x > rect.r ? p0.x - rect.r : 0);
          dy = y2 < rect.t ? rect.t - y2 : (y1 > rect.b ? y1 - rect.b : 0);
        }
        if (dx === 0 && dy === 0) return 0;
        if (dx === 0) return dy;
        if (dy === 0) return dx;
        return Math.hypot(dx, dy);
      }

      /** @param {{x:number,y:number}} point @param {{l:number,r:number,t:number,b:number}} rect */
      function pointTouchesRect(point, rect) {
        const pad = 8;
        const onVertical = Math.abs(point.x - rect.l) <= pad || Math.abs(point.x - rect.r) <= pad;
        const inY = point.y >= rect.t - pad && point.y <= rect.b + pad;
        const onHorizontal = Math.abs(point.y - rect.t) <= pad || Math.abs(point.y - rect.b) <= pad;
        const inX = point.x >= rect.l - pad && point.x <= rect.r + pad;
        return (onVertical && inY) || (onHorizontal && inX);
      }

      const viewBox = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number);
      const labelsOutsideViewBox = Array.from(svg.querySelectorAll('text'))
        .filter((text) => (text.textContent || '').trim().length > 0)
        .map((text) => ({ text: (text.textContent || '').trim(), ...box(text) }))
        .filter((label) =>
          label.l < viewBox[0] - 0.5 ||
          label.r > viewBox[0] + viewBox[2] + 0.5 ||
          label.t < viewBox[1] - 0.5 ||
          label.b > viewBox[1] + viewBox[3] + 0.5
        )
        .map((label) => label.text);

      /** @param {{l:number,r:number,t:number,b:number}} a @param {{l:number,r:number,t:number,b:number}} b @param {number} pad */
      function rectsOverlap(a, b, pad) {
        return a.r + pad > b.l && a.l - pad < b.r && a.b + pad > b.t && a.t - pad < b.b;
      }

      const routes = Array.from(svg.querySelectorAll('polyline'))
        .map((polyline) => parsePoints(/** @type {SVGPolylineElement} */ (polyline)))
        .filter((points) => points.length >= 2);
      const straightHorizontalRoutes = routes.filter((points) =>
        points.length === 2 && Math.abs(points[0].y - points[1].y) < 1
      ).length;
      const maxRoutePoints = Math.max(...routes.map((points) => points.length));

      const componentBoxes = Array.from(svg.querySelectorAll('rect.uml-component-box')).map((rect) => box(rect));
      const connectorLabelBoxHits = [];
      const connectorLabels = Array.from(svg.querySelectorAll('text.uml-component-connector-label'))
        .map((text) => ({ text: (text.textContent || '').trim(), ...box(text) }));
      for (const label of connectorLabels) {
        for (const rect of componentBoxes) {
          if (rectsOverlap(label, rect, 2)) connectorLabelBoxHits.push(label.text);
        }
      }

      let closeNonEndpointSegments = 0;
      for (const points of routes) {
        for (let i = 0; i < points.length - 1; i++) {
          for (const rect of componentBoxes) {
            const distance = segmentDistanceToRect(points[i], points[i + 1], rect);
            const endpointTouch = pointTouchesRect(points[i], rect) || pointTouchesRect(points[i + 1], rect);
            if (distance < 16 && !endpointTouch) closeNonEndpointSegments++;
          }
        }
      }

      document.body.removeChild(host);
      return {
        hasSvg: true,
        labelsOutsideViewBox,
        routeCount: routes.length,
        straightHorizontalRoutes,
        maxRoutePoints,
        connectorLabelBoxHits,
        closeNonEndpointSegments,
        width: viewBox[2],
        height: viewBox[3],
      };
    });

    expect(stats.hasSvg).toBe(true);
    expect(stats.labelsOutsideViewBox).toEqual([]);
    expect(stats.routeCount).toBe(3);
    expect(stats.straightHorizontalRoutes).toBeGreaterThanOrEqual(2);
    expect(stats.maxRoutePoints).toBeLessThanOrEqual(4);
    expect(stats.connectorLabelBoxHits).toEqual([]);
    expect(stats.closeNonEndpointSegments).toBe(0);
  });

  test('component routing keeps clear facing-port links short and corner-free', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!/** @type {any} */ (window).UMLComponentDiagram);

    const stats = await page.evaluate(() => {
      const host = document.createElement('div');
      host.style.width = '1000px';
      host.style.position = 'absolute';
      host.style.left = '-10000px';
      document.body.appendChild(host);
      /** @type {{ render: (container: HTMLElement, text: string) => void }} */ (
        /** @type {any} */ (window).UMLComponentDiagram
      ).render(host, `@startuml
left to right direction
component Auth {
  portout "out1" as auth_out1
  portout "out2" as auth_out2
}
component Users {
  portin "/users" as users_in
  portin "/sessions" as sessions_in
}
auth_out1 --> users_in : GET /users
auth_out2 --> sessions_in : POST /sessions
@enduml`);

      const svg = host.querySelector('svg');
      if (!svg) {
        document.body.removeChild(host);
        return { hasSvg: false };
      }

      function parsePoints(polyline) {
        return (polyline.getAttribute('points') || '')
          .trim()
          .split(/\s+/)
          .map((pair) => pair.split(',').map(Number))
          .filter((pair) => pair.length === 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
          .map((pair) => ({ x: pair[0], y: pair[1] }));
      }

      function routeLength(points) {
        let length = 0;
        for (let i = 0; i < points.length - 1; i++) {
          length += Math.abs(points[i + 1].x - points[i].x) + Math.abs(points[i + 1].y - points[i].y);
        }
        return length;
      }

      function bends(points) {
        let total = 0;
        for (let i = 1; i < points.length - 1; i++) {
          const prev = points[i - 1];
          const cur = points[i];
          const next = points[i + 1];
          const incomingHorizontal = Math.abs(prev.y - cur.y) < 1;
          const outgoingHorizontal = Math.abs(cur.y - next.y) < 1;
          if (incomingHorizontal !== outgoingHorizontal) total++;
        }
        return total;
      }

      const routes = Array.from(svg.querySelectorAll('polyline'))
        .map((polyline) => parsePoints(/** @type {SVGPolylineElement} */ (polyline)))
        .filter((points) => points.length >= 2);

      const summaries = routes.map((points) => {
        const first = points[0];
        const last = points[points.length - 1];
        const direct = Math.abs(first.x - last.x) + Math.abs(first.y - last.y);
        return {
          points: points.length,
          bends: bends(points),
          extra: Math.round(routeLength(points) - direct),
          horizontal: Math.abs(first.y - last.y) < 1,
        };
      });

      document.body.removeChild(host);
      return { hasSvg: true, routeCount: routes.length, summaries };
    });

    expect(stats.hasSvg).toBe(true);
    expect(stats.routeCount).toBe(2);
    expect(stats.summaries).toEqual([
      { points: 2, bends: 0, extra: 0, horizontal: true },
      { points: 2, bends: 0, extra: 0, horizontal: true },
    ]);
  });

  test('component side anchors straighten when a legal side shift removes corners', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!/** @type {any} */ (window).UMLComponentDiagram);

    const stats = await page.evaluate(() => {
      const host = document.createElement('div');
      host.style.width = '1200px';
      host.style.position = 'absolute';
      host.style.left = '-10000px';
      document.body.appendChild(host);
      /** @type {{ render: (container: HTMLElement, text: string) => void }} */ (
        /** @type {any} */ (window).UMLComponentDiagram
      ).render(host, `@startuml
left to right direction
component "Legacy Module" #FF8888 crosshatch as Legacy
component "Deprecated API" #EEEEEE dotted as Deprecated
component "Active Service" #AADDFF grid as Active
component "New Module" #88DD88 as New
Legacy --> Active
Deprecated --> Active
Active --> New
@enduml`);

      const svg = host.querySelector('svg');
      if (!svg) {
        document.body.removeChild(host);
        return { hasSvg: false, straightIncoming: 0, tinyDoglegs: 0 };
      }

      function parsePoints(polyline) {
        return (polyline.getAttribute('points') || '')
          .trim()
          .split(/\s+/)
          .map((pair) => pair.split(',').map(Number))
          .filter((pair) => pair.length === 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
          .map((pair) => ({ x: pair[0], y: pair[1] }));
      }

      const routes = Array.from(svg.querySelectorAll('polyline'))
        .map((polyline) => parsePoints(/** @type {SVGPolylineElement} */ (polyline)))
        .filter((points) => points.length >= 2);
      let straightIncoming = 0;
      let tinyDoglegs = 0;
      for (const points of routes) {
        const first = points[0];
        const last = points[points.length - 1];
        if (first.x < last.x && points.length === 2 && Math.abs(first.y - last.y) < 1) straightIncoming++;
        if (points.length === 4 &&
            Math.abs(points[0].y - points[1].y) < 1 &&
            Math.abs(points[1].x - points[2].x) < 1 &&
            Math.abs(points[2].y - points[3].y) < 1 &&
            Math.abs(points[1].y - points[2].y) <= 8) {
          tinyDoglegs++;
        }
      }

      document.body.removeChild(host);
      return { hasSvg: true, straightIncoming, tinyDoglegs };
    });

    expect(stats.hasSvg).toBe(true);
    expect(stats.straightIncoming).toBeGreaterThanOrEqual(1);
    expect(stats.tinyDoglegs).toBe(0);
  });

  test('component interface labels do not overlap component boxes', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!/** @type {any} */ (window).UMLComponentDiagram);

    const stats = await page.evaluate(() => {
      const host = document.createElement('div');
      host.style.width = '900px';
      host.style.position = 'absolute';
      host.style.left = '-10000px';
      document.body.appendChild(host);
      /** @type {{ render: (container: HTMLElement, text: string) => void }} */ (
        /** @type {any} */ (window).UMLComponentDiagram
      ).render(host, `@startuml
component Order {
  provide "OrderItems" as o_items
  provide "CustomerInfo" as o_cust
}
component Warehouse {
  require "OrderItems" as w_items
}
component CRM {
  require "CustomerInfo" as crm_cust
}
o_items --> w_items
o_cust --> crm_cust
@enduml`);

      const svg = host.querySelector('svg');
      if (!svg) {
        document.body.removeChild(host);
        return { hasSvg: false, labelCount: 0, hits: [] };
      }

      /** @param {Element} el */
      function box(el) {
        const b = /** @type {SVGGraphicsElement} */ (el).getBBox();
        return { l: b.x, r: b.x + b.width, t: b.y, b: b.y + b.height, text: el.textContent.trim() };
      }

      /** @param {{l:number,r:number,t:number,b:number}} a @param {{l:number,r:number,t:number,b:number}} b @param {number} pad */
      function overlaps(a, b, pad) {
        return a.r + pad > b.l && a.l - pad < b.r && a.b + pad > b.t && a.t - pad < b.b;
      }

      const componentBoxes = Array.from(svg.querySelectorAll('rect.uml-component-box')).map(box);
      const labels = Array.from(svg.querySelectorAll('text'))
        .filter((text) => ['OrderItems', 'CustomerInfo'].includes(text.textContent.trim()))
        .map(box);
      const hits = [];
      for (const label of labels) {
        for (const componentBox of componentBoxes) {
          if (overlaps(label, componentBox, 2)) {
            hits.push({ label: label.text, component: componentBox.text });
          }
        }
      }

      document.body.removeChild(host);
      return { hasSvg: true, labelCount: labels.length, hits };
    });

    expect(stats.hasSvg).toBe(true);
    expect(stats.labelCount).toBe(2);
    expect(stats.hits).toEqual([]);
  });

  test('component joined assembly notation stays on component interfaces instead of mid-wire', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!/** @type {any} */ (window).UMLComponentDiagram);

    const stats = await page.evaluate(() => {
      const host = document.createElement('div');
      host.style.width = '900px';
      host.style.position = 'absolute';
      host.style.left = '-10000px';
      document.body.appendChild(host);
      /** @type {{ render: (container: HTMLElement, text: string) => void }} */ (
        /** @type {any} */ (window).UMLComponentDiagram
      ).render(host, `@startuml
component Order {
  provide "OrderItems" as o_items
  provide "CustomerInfo" as o_cust
}
component Warehouse {
  require "OrderItems" as w_items
}
component CRM {
  require "CustomerInfo" as crm_cust
}
o_items --> w_items
o_cust --> crm_cust
@enduml`);

      const svg = host.querySelector('svg');
      if (!svg) {
        document.body.removeChild(host);
        return { hasSvg: false };
      }

      /** @param {Element} el */
      function box(el) {
        const b = /** @type {SVGGraphicsElement} */ (el).getBBox();
        return { l: b.x, r: b.x + b.width, t: b.y, b: b.y + b.height };
      }

      /** @param {SVGPolylineElement} polyline */
      function parsePoints(polyline) {
        return (polyline.getAttribute('points') || '')
          .trim()
          .split(/\s+/)
          .map((pair) => pair.split(',').map(Number))
          .filter((pair) => pair.length === 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
          .map((pair) => ({ x: pair[0], y: pair[1] }));
      }

      /** @param {{x:number,y:number}} p @param {{l:number,r:number,t:number,b:number}} rect */
      function distanceToRect(p, rect) {
        const dx = p.x < rect.l ? rect.l - p.x : (p.x > rect.r ? p.x - rect.r : 0);
        const dy = p.y < rect.t ? rect.t - p.y : (p.y > rect.b ? p.y - rect.b : 0);
        return Math.hypot(dx, dy);
      }

      /** @param {{x:number,y:number}} p @param {{x:number,y:number}} a @param {{x:number,y:number}} b */
      function distanceToSegment(p, a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len2 = dx * dx + dy * dy;
        if (!len2) return Math.hypot(p.x - a.x, p.y - a.y);
        const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
        return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
      }

      /** @param {{x:number,y:number}} a @param {{x:number,y:number}} b */
      function pointDistance(a, b) {
        return Math.hypot(a.x - b.x, a.y - b.y);
      }

      const componentBoxes = Array.from(svg.querySelectorAll('rect.uml-component-box')).map(box);
      const providedBalls = Array.from(svg.querySelectorAll('circle'))
        .map((circle) => ({
          x: Number(circle.getAttribute('cx')),
          y: Number(circle.getAttribute('cy')),
          r: Number(circle.getAttribute('r')),
        }))
        .filter((circle) => circle.r >= 8 && circle.r <= 18);
      const requiredSockets = Array.from(svg.querySelectorAll('path'))
        .filter((path) => /A\d+(?:\.\d+)?,\d+(?:\.\d+)?/.test(path.getAttribute('d') || ''))
        .map((path) => {
          const b = box(path);
          return { ...b, x: (b.l + b.r) / 2, y: (b.t + b.b) / 2 };
        });
      const rawPolylines = Array.from(svg.querySelectorAll('polyline'))
        .map((polyline) => parsePoints(/** @type {SVGPolylineElement} */ (polyline)))
        .filter((points) => points.length >= 2);
      const routes = rawPolylines.filter((points) => {
        const xs = points.map((point) => point.x);
        const ys = points.map((point) => point.y);
        return Math.max(...xs) - Math.min(...xs) > 30 || Math.max(...ys) - Math.min(...ys) > 30;
      });
      const routeEndpoints = routes.flatMap((points) => [points[0], points[points.length - 1]]);

      const floatingBalls = providedBalls.filter((ball) =>
        Math.min(...componentBoxes.map((componentBox) => distanceToRect(ball, componentBox))) > 48
      );
      const floatingSockets = requiredSockets.filter((socket) =>
        Math.min(...componentBoxes.map((componentBox) => distanceToRect(socket, componentBox))) > 48
      );

      const midWireBalls = providedBalls.filter((ball) => {
        const onRoute = routes.some((points) =>
          points.slice(0, -1).some((point, index) => distanceToSegment(ball, point, points[index + 1]) <= ball.r + 2)
        );
        const endpointDistance = Math.min(...routeEndpoints.map((endpoint) => pointDistance(ball, endpoint)));
        return onRoute && endpointDistance > 48;
      });
      const midWireSockets = requiredSockets.filter((socket) => {
        const onRoute = routes.some((points) =>
          points.slice(0, -1).some((point, index) => distanceToSegment(socket, point, points[index + 1]) <= 14)
        );
        const endpointDistance = Math.min(...routeEndpoints.map((endpoint) => pointDistance(socket, endpoint)));
        return onRoute && endpointDistance > 48;
      });

      const endpointSymbolMisses = routeEndpoints.filter((endpoint) => {
        const touchesBall = providedBalls.some((ball) => pointDistance(endpoint, ball) <= ball.r + 4);
        const touchesSocket = requiredSockets.some((socket) =>
          endpoint.x >= socket.l - 4 &&
          endpoint.x <= socket.r + 4 &&
          endpoint.y >= socket.t - 4 &&
          endpoint.y <= socket.b + 4
        );
        return !touchesBall && !touchesSocket;
      }).map((endpoint) => ({ x: Math.round(endpoint.x), y: Math.round(endpoint.y) }));

      const openPolylineArrowheads = rawPolylines.filter((points) => {
        if (points.length !== 3) return false;
        const xs = points.map((point) => point.x);
        const ys = points.map((point) => point.y);
        return Math.max(...xs) - Math.min(...xs) <= 24 && Math.max(...ys) - Math.min(...ys) <= 24;
      }).length;
      const arrowheads = Array.from(svg.querySelectorAll('polygon')).length + openPolylineArrowheads;
      document.body.removeChild(host);
      return {
        hasSvg: true,
        routeCount: routes.length,
        providedBallCount: providedBalls.length,
        requiredSocketCount: requiredSockets.length,
        arrowheads,
        floatingBalls: floatingBalls.map((ball) => ({ x: Math.round(ball.x), y: Math.round(ball.y) })),
        floatingSockets: floatingSockets.map((socket) => ({ x: Math.round(socket.x), y: Math.round(socket.y) })),
        midWireBalls: midWireBalls.map((ball) => ({ x: Math.round(ball.x), y: Math.round(ball.y) })),
        midWireSockets: midWireSockets.map((socket) => ({ x: Math.round(socket.x), y: Math.round(socket.y) })),
        endpointSymbolMisses,
      };
    });

    expect(stats.hasSvg).toBe(true);
    expect(stats.routeCount).toBeGreaterThanOrEqual(2);
    expect(stats.providedBallCount).toBe(2);
    expect(stats.requiredSocketCount).toBe(2);
    expect(stats.arrowheads).toBe(0);
    expect(stats.floatingBalls).toEqual([]);
    expect(stats.floatingSockets).toEqual([]);
    expect(stats.midWireBalls).toEqual([]);
    expect(stats.midWireSockets).toEqual([]);
    expect(stats.endpointSymbolMisses).toEqual([]);
  });

  test('component dashed style applies to components, ports, connectors, and standalone ports', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!/** @type {any} */ (window).UMLComponentDiagram);

    const stats = await page.evaluate(() => {
      const host = document.createElement('div');
      host.style.width = '900px';
      host.style.position = 'absolute';
      host.style.left = '-10000px';
      document.body.appendChild(host);
      /** @type {{ render: (container: HTMLElement, text: string) => void }} */ (
        /** @type {any} */ (window).UMLComponentDiagram
      ).render(host, `@startuml
component Source dashed {
  portout "events" as events dashed
}
component Target
port "External Topic" as external dashed

events --> external dashed : publish
Source --> Target dashed : sync
@enduml`);

      const svg = host.querySelector('svg');
      if (!svg) {
        document.body.removeChild(host);
        return { hasSvg: false };
      }

      const isDashed = (el) => el.getAttribute('stroke-dasharray') === '8,4';
      const componentBoxes = Array.from(svg.querySelectorAll('rect.uml-component-box'));
      const dashedComponentBoxes = componentBoxes.filter(isDashed).length;
      const dashedPortSquares = Array.from(svg.querySelectorAll('rect'))
        .filter((rect) =>
          !rect.classList.contains('uml-component-box') &&
          Math.abs(Number(rect.getAttribute('width')) - 10) < 0.1 &&
          Math.abs(Number(rect.getAttribute('height')) - 10) < 0.1 &&
          isDashed(rect)
        ).length;
      const dashedRoutes = Array.from(svg.querySelectorAll('polyline'))
        .filter((polyline) => polyline.getAttribute('stroke') === '#444' && isDashed(polyline))
        .length;
      const labels = Array.from(svg.querySelectorAll('text')).map((text) => text.textContent.trim());
      const externalLabel = Array.from(svg.querySelectorAll('text'))
        .find((text) => text.textContent.trim() === 'External Topic');
      const externalLabelBox = externalLabel ? /** @type {SVGGraphicsElement} */ (externalLabel).getBBox() : null;
      const standaloneLabelGap = externalLabelBox
        ? Math.min(...Array.from(svg.querySelectorAll('rect'))
            .filter((rect) =>
              !rect.classList.contains('uml-component-box') &&
              Math.abs(Number(rect.getAttribute('width')) - 10) < 0.1 &&
              Math.abs(Number(rect.getAttribute('height')) - 10) < 0.1 &&
              isDashed(rect)
            )
            .map((rect) => {
              const b = /** @type {SVGGraphicsElement} */ (rect).getBBox();
              const verticalOverlap = Math.min(externalLabelBox.y + externalLabelBox.height, b.y + b.height) -
                Math.max(externalLabelBox.y, b.y);
              if (verticalOverlap <= 0) return Number.POSITIVE_INFINITY;
              if (b.x + b.width <= externalLabelBox.x) return externalLabelBox.x - (b.x + b.width);
              if (externalLabelBox.x + externalLabelBox.width <= b.x) return b.x - (externalLabelBox.x + externalLabelBox.width);
              return 0;
            }))
        : 0;

      document.body.removeChild(host);
      return {
        hasSvg: true,
        componentBoxCount: componentBoxes.length,
        dashedComponentBoxes,
        dashedPortSquares,
        dashedRoutes,
        hasStandalonePortLabel: labels.includes('External Topic'),
        standaloneLabelGap,
      };
    });

    expect(stats.hasSvg).toBe(true);
    expect(stats.componentBoxCount).toBe(2);
    expect(stats.dashedComponentBoxes).toBeGreaterThanOrEqual(1);
    expect(stats.dashedPortSquares).toBeGreaterThanOrEqual(2);
    expect(stats.dashedRoutes).toBeGreaterThanOrEqual(2);
    expect(stats.hasStandalonePortLabel).toBe(true);
    expect(stats.standaloneLabelGap).toBeGreaterThanOrEqual(14);
  });

  test('UMLLayoutCore exposes the new staged primitives', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!/** @type {any} */ (window).UMLLayoutCore);

    const api = await page.evaluate(() => {
      const core = /** @type {any} */ (window).UMLLayoutCore;
      return {
        hasMeasure: typeof core.measureEdgeRequirement === 'function',
        hasMinGaps: typeof core.computeMinGaps === 'function',
        hasDetect: typeof core.detectOverlaps === 'function',
        hasRepair: typeof core.repairOverlaps === 'function',
        hasOrient: typeof core.pickOrientation === 'function',
        hasAspect: typeof core.containerAspect === 'function',
        hasAnalyze: typeof core.analyzeHierarchy === 'function'
      };
    });

    expect(api).toEqual({
      hasMeasure: true, hasMinGaps: true, hasDetect: true, hasRepair: true,
      hasOrient: true, hasAspect: true, hasAnalyze: true
    });
  });

  test('compact-mode class diagrams keep every box overlap-free', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!/** @type {any} */ (window).UMLClassDiagram);

    const stats = await page.evaluate(() => {
      // Busy diagram in compact mode — the specific case that used to produce
      // cross-row overlaps before cross-layer repair landed.
      const src = `@startuml
layout compact
class Customer {
  - id: int
  - firstName: String
  - lastName: String
  + placeOrder()
  + cancelOrder()
}
class Order {
  - orderId: int
  - date: Date
  + calculateTotal()
  + addItem(Item)
  + removeItem(Item)
}
class Item {
  - sku: String
  - price: double
}
class Address {
  - street: String
  - city: String
  - zip: String
}
class Payment {
  - amount: double
  - method: String
  + authorize()
}
class Invoice {
  - number: String
  - total: double
}
Customer "1" *-- "0..*" Order : places
Order "1" *-- "1..*" Item : contains
Customer "1" o-- "1..*" Address : has
Order "1" --> "1" Payment : paidBy
Order "1" --> "1" Invoice : generates
Payment ..> Invoice : references
@enduml`;

      const host = document.createElement('div');
      host.style.width = '1400px';
      host.style.height = '800px';
      host.style.position = 'absolute';
      host.style.left = '-10000px';
      document.body.appendChild(host);
      /** @type {any} */ (window).UMLClassDiagram.render(host, src);

      const svg = host.querySelector('svg');
      if (!svg) { document.body.removeChild(host); return { pairs: 0, overlaps: 0 }; }

      // Identify class boxes by finding the text nodes for the class names
      // and deriving each box from the outermost rect that *contains* it.
      const names = ['Customer', 'Order', 'Item', 'Address', 'Payment', 'Invoice'];
      const texts = Array.from(svg.querySelectorAll('text'));
      const rects = Array.from(svg.querySelectorAll('rect'));
      const classRects = [];
      for (const name of names) {
        const txt = texts.find((t) => t.textContent.trim() === name);
        if (!txt) continue;
        const tb = txt.getBBox();
        let best = null;
        let bestArea = Infinity;
        for (const r of rects) {
          const rb = r.getBBox();
          const contains =
            tb.x >= rb.x - 0.5 && tb.x + tb.width <= rb.x + rb.width + 0.5 &&
            tb.y >= rb.y - 0.5 && tb.y + tb.height <= rb.y + rb.height + 0.5;
          if (!contains) continue;
          const area = rb.width * rb.height;
          if (area < bestArea) { bestArea = area; best = rb; }
        }
        if (best) classRects.push({ name, x: best.x, y: best.y, w: best.width, h: best.height });
      }

      let overlaps = 0;
      const pairs = [];
      for (let i = 0; i < classRects.length; i++) {
        for (let j = i + 1; j < classRects.length; j++) {
          const a = classRects[i], b = classRects[j];
          const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
          const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
          if (ox > 2 && oy > 2) {
            overlaps++;
            pairs.push(`${a.name} vs ${b.name}`);
          }
        }
      }

      document.body.removeChild(host);
      return { classCount: classRects.length, overlaps, pairs };
    });

    expect(stats.classCount).toBeGreaterThanOrEqual(5);
    expect(stats.overlaps, `Overlapping pairs: ${(stats.pairs || []).join(', ')}`).toBe(0);
  });

  test('UMLLayoutCore.repairOverlaps resolves a known cross-layer overlap', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!/** @type {any} */ (window).UMLLayoutCore);

    const result = await page.evaluate(() => {
      const core = /** @type {any} */ (window).UMLLayoutCore;
      // Two boxes overlap diagonally — the kind of case the old band-based
      // nudger missed because the boxes weren't in the same vertical band.
      const nodes = [
        { id: 'A', x: 0,  y: 0,  width: 120, height: 60 },
        { id: 'B', x: 60, y: 20, width: 120, height: 60 }
      ];
      const before = core.detectOverlaps(nodes, 0).length;
      const repairResult = core.repairOverlaps(nodes, { padding: 4, maxIter: 20 });
      const after = core.detectOverlaps(nodes, 0).length;
      return { before, after, converged: repairResult.converged };
    });

    expect(result.before).toBeGreaterThan(0);
    expect(result.after).toBe(0);
    expect(result.converged).toBe(true);
  });

  test('UMLLayoutCore.repairOverlaps respects Y-axis locks (hierarchy preservation)', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!/** @type {any} */ (window).UMLLayoutCore);

    const result = await page.evaluate(() => {
      const core = /** @type {any} */ (window).UMLLayoutCore;
      // Both Y positions locked — repair must separate only along X.
      const nodes = [
        { id: 'A', x: 0,  y: 100, width: 100, height: 60 },
        { id: 'B', x: 40, y: 100, width: 100, height: 60 }
      ];
      const originalYs = nodes.map((n) => n.y);
      core.repairOverlaps(nodes, {
        padding: 4, maxIter: 20,
        lockY: { A: true, B: true }
      });
      return {
        yChangedA: Math.abs(nodes[0].y - originalYs[0]) > 0.01,
        yChangedB: Math.abs(nodes[1].y - originalYs[1]) > 0.01,
        remaining: core.detectOverlaps(nodes, 0).length
      };
    });

    expect(result.yChangedA).toBe(false);
    expect(result.yChangedB).toBe(false);
    expect(result.remaining).toBe(0);
  });

  test('UMLLayoutCore.pickOrientation follows container aspect', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!/** @type {any} */ (window).UMLLayoutCore);

    const result = await page.evaluate(() => {
      const core = /** @type {any} */ (window).UMLLayoutCore;
      return {
        landscape: core.pickOrientation({ containerAspect: 1.78, preference: 'compact' }).direction,
        portrait: core.pickOrientation({ containerAspect: 0.6, preference: 'compact' }).direction,
        square: core.pickOrientation({ containerAspect: 1.0, preference: 'compact' }).direction,
        lockedWins: core.pickOrientation({
          containerAspect: 0.6, preference: 'compact',
          userDirection: 'LR', directionLocked: true
        }).direction,
        hierarchyPrefersTB: core.pickOrientation({
          containerAspect: 1.78, preference: 'compact', hasHierarchy: true
        }).direction
      };
    });

    expect(result.landscape).toBe('LR');
    expect(result.portrait).toBe('TB');
    expect(result.lockedWins).toBe('LR');
    expect(result.hierarchyPrefersTB).toBe('TB');
  });

  test('UMLLayoutCore tolerates hostile inputs', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!/** @type {any} */ (window).UMLLayoutCore);

    const outcome = await page.evaluate(() => {
      const core = /** @type {any} */ (window).UMLLayoutCore;
      try {
        // Hostile inputs: NaN, Infinity, missing fields, undefined edges.
        const nodes = [
          { id: 'A', x: NaN, y: 0, width: 100, height: 50 },
          { id: 'B', x: 50, y: Infinity, width: 100, height: 50 },
          { id: 'C', x: 100, y: 100, width: 0, height: 0 },
          { id: 'D', x: 200, y: 200, width: 100, height: 50 }
        ];
        const overlaps = core.detectOverlaps(nodes, 0);
        const gaps = core.computeMinGaps(
          [null, undefined, {}, { label: 'hi', source: 'A', target: 'B' }],
          null, {}
        );
        const orient = core.pickOrientation({
          containerAspect: NaN, preference: null, userDirection: null
        });
        const measured = core.measureEdgeRequirement(null);
        const aspect = core.containerAspect(null);
        const repair = core.repairOverlaps(null);
        return {
          detectReturnsArray: Array.isArray(overlaps),
          gapsFinite: isFinite(gaps.minX) && isFinite(gaps.minY),
          orientValid: orient.direction === 'TB' || orient.direction === 'LR',
          measuredFinite: isFinite(measured.minX) && isFinite(measured.minY),
          aspectNull: aspect === null,
          repairOk: repair && typeof repair.converged === 'boolean'
        };
      } catch (e) {
        return { error: String(e) };
      }
    });

    expect(outcome).toEqual({
      detectReturnsArray: true,
      gapsFinite: true,
      orientValid: true,
      measuredFinite: true,
      aspectNull: true,
      repairOk: true
    });
  });

  test('layout landscape produces landscape (aspect > 1) for every diagram type', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!(/** @type {any} */ (window)).UMLClassDiagram);

    const results = await page.evaluate(() => {
      function render(type, body) {
        const w = /** @type {any} */ (window);
        const renderer = {
          class: w.UMLClassDiagram, seq: w.UMLSequenceDiagram,
          state: w.UMLStateDiagram, comp: w.UMLComponentDiagram,
          usecase: w.UMLUseCaseDiagram, activity: w.UMLActivityDiagram,
          deployment: w.UMLDeploymentDiagram
        }[type];
        const h = document.createElement('div');
        h.style.width = '1200px';
        h.style.position = 'absolute';
        h.style.left = '-10000px';
        document.body.appendChild(h);
        renderer.render(h, '@startuml\nlayout landscape\n' + body + '\n@enduml');
        const svg = h.querySelector('svg');
        const [,, w2, h2] = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number);
        document.body.removeChild(h);
        return { w: w2, h: h2, aspect: w2 / h2 };
      }
      return {
        classFlat: render('class', 'class A\nclass B\nclass C\nclass D\nclass E\nA -- B\nA -- C\nB -- D\nC -- E'),
        state: render('state', '[*] --> A\nA --> B\nB --> C\nC --> D\nD --> [*]'),
        comp: render('comp', 'component A\ncomponent B\ncomponent C\ncomponent D\nA --> B\nB --> C\nC --> D'),
        activity: render('activity', '(*) --> "One"\n"One" --> "Two"\n"Two" --> "Three"\n"Three" --> (*)')
      };
    });

    for (const [name, dim] of Object.entries(results)) {
      expect(dim.w, `${name} landscape width`).toBeGreaterThan(0);
      expect(dim.h, `${name} landscape height`).toBeGreaterThan(0);
      expect(dim.aspect, `${name} aspect should be > 1 for landscape`).toBeGreaterThan(1);
    }
  });

  test('layout portrait produces portrait (aspect < 1) for every diagram type', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!(/** @type {any} */ (window)).UMLClassDiagram);

    const results = await page.evaluate(() => {
      function render(type, body) {
        const w = /** @type {any} */ (window);
        const renderer = {
          class: w.UMLClassDiagram, seq: w.UMLSequenceDiagram,
          state: w.UMLStateDiagram, comp: w.UMLComponentDiagram,
          usecase: w.UMLUseCaseDiagram, activity: w.UMLActivityDiagram,
          deployment: w.UMLDeploymentDiagram
        }[type];
        const h = document.createElement('div');
        h.style.width = '1200px';
        h.style.position = 'absolute';
        h.style.left = '-10000px';
        document.body.appendChild(h);
        renderer.render(h, '@startuml\nlayout portrait\n' + body + '\n@enduml');
        const svg = h.querySelector('svg');
        const [,, w2, h2] = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number);
        document.body.removeChild(h);
        return { w: w2, h: h2, aspect: w2 / h2 };
      }
      return {
        classFlat: render('class', 'class A\nclass B\nclass C\nclass D\nclass E\nA -- B\nA -- C\nB -- D\nC -- E'),
        classHier: render('class', 'class Animal\nclass Dog\nclass Cat\nclass Mammal\nclass Bird\nDog --|> Mammal\nCat --|> Mammal\nMammal --|> Animal\nBird --|> Animal'),
        state: render('state', '[*] --> A\nA --> B\nB --> C\nC --> D\nD --> [*]'),
        comp: render('comp', 'component A\ncomponent B\ncomponent C\ncomponent D\nA --> B\nB --> C\nC --> D'),
        activity: render('activity', '(*) --> "One"\n"One" --> "Two"\n"Two" --> "Three"\n"Three" --> (*)')
      };
    });

    for (const [name, dim] of Object.entries(results)) {
      expect(dim.w, `${name} portrait width`).toBeGreaterThan(0);
      expect(dim.h, `${name} portrait height`).toBeGreaterThan(0);
      expect(dim.aspect, `${name} aspect should be < 1 for portrait`).toBeLessThan(1);
    }
  });

  test('compact mode produces a visibly smaller footprint than default', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!(/** @type {any} */ (window)).UMLClassDiagram);

    const ratios = await page.evaluate(() => {
      function area(type, directive, body) {
        const w = /** @type {any} */ (window);
        const renderer = {
          class: w.UMLClassDiagram, seq: w.UMLSequenceDiagram,
          state: w.UMLStateDiagram, comp: w.UMLComponentDiagram
        }[type];
        const h = document.createElement('div');
        h.style.width = '1200px';
        h.style.position = 'absolute';
        h.style.left = '-10000px';
        document.body.appendChild(h);
        const src = '@startuml\n' + (directive ? directive + '\n' : '') + body + '\n@enduml';
        renderer.render(h, src);
        const svg = h.querySelector('svg');
        const [,, w2, h2] = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number);
        document.body.removeChild(h);
        return w2 * h2;
      }
      const classBody = 'class A\nclass B\nclass C\nclass D\nA -- B\nA -- C\nB -- D';
      const seqBody = 'participant A\nparticipant B\nparticipant C\nA -> B : x\nB -> C : y\nC --> B : z\nB --> A : w';
      const stateBody = '[*] --> A\nA --> B\nB --> C\nC --> [*]';
      return {
        class: area('class', '', classBody) / area('class', 'layout compact', classBody),
        seq:   area('seq', '', seqBody)     / area('seq', 'layout compact', seqBody),
        state: area('state', '', stateBody) / area('state', 'layout compact', stateBody)
      };
    });

    // Every diagram type should be at least 10% smaller in compact mode.
    expect(ratios.class, 'class compact/normal area ratio').toBeGreaterThan(1.10);
    expect(ratios.seq, 'sequence compact/normal area ratio').toBeGreaterThan(1.15);
    expect(ratios.state, 'state compact/normal area ratio').toBeGreaterThan(1.10);
  });

  test('state notes and transition labels avoid nodes, routes, and each other', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!(/** @type {any} */ (window)).UMLStateDiagram);

    const stats = await page.evaluate(() => {
      /** @param {string} src */
      function render(src) {
        const host = document.createElement('div');
        host.style.width = '760px';
        host.style.position = 'absolute';
        host.style.left = '-10000px';
        document.body.appendChild(host);
        /** @type {{ render: (container: HTMLElement, text: string) => void }} */ (
          /** @type {any} */ (window).UMLStateDiagram
        ).render(host, src);
        return host;
      }

      /** @param {Element} el */
      function box(el) {
        const b = /** @type {SVGGraphicsElement} */ (el).getBBox();
        return { l: b.x, r: b.x + b.width, t: b.y, b: b.y + b.height, text: el.textContent.trim() };
      }

      /** @param {{l:number,r:number,t:number,b:number}} a @param {{l:number,r:number,t:number,b:number}} b @param {number} pad */
      function overlaps(a, b, pad) {
        return a.r + pad > b.l && a.l - pad < b.r && a.b + pad > b.t && a.t - pad < b.b;
      }

      /** @param {SVGPolylineElement} polyline */
      function parsePoints(polyline) {
        return (polyline.getAttribute('points') || '')
          .trim()
          .split(/\s+/)
          .map((pair) => pair.split(',').map(Number))
          .filter((pair) => pair.length === 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
          .map((pair) => ({ x: pair[0], y: pair[1] }));
      }

      /** @param {{l:number,r:number,t:number,b:number}} rect @param {{x:number,y:number}} a @param {{x:number,y:number}} b @param {number} pad */
      function rectHitsSegment(rect, a, b, pad) {
        if (Math.abs(a.y - b.y) < 1) {
          const x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x);
          return a.y >= rect.t - pad && a.y <= rect.b + pad && x2 > rect.l - pad && x1 < rect.r + pad;
        }
        if (Math.abs(a.x - b.x) < 1) {
          const y1 = Math.min(a.y, b.y), y2 = Math.max(a.y, b.y);
          return a.x >= rect.l - pad && a.x <= rect.r + pad && y2 > rect.t - pad && y1 < rect.b + pad;
        }
        return false;
      }

      /** @param {{x:number,y:number}} a0 @param {{x:number,y:number}} a1 @param {{x:number,y:number}} b0 @param {{x:number,y:number}} b1 */
      function segmentsCross(a0, a1, b0, b1) {
        const ah = Math.abs(a0.y - a1.y) < 1;
        const av = Math.abs(a0.x - a1.x) < 1;
        const bh = Math.abs(b0.y - b1.y) < 1;
        const bv = Math.abs(b0.x - b1.x) < 1;
        if (ah && bv) {
          const x1 = Math.min(a0.x, a1.x), x2 = Math.max(a0.x, a1.x);
          const y1 = Math.min(b0.y, b1.y), y2 = Math.max(b0.y, b1.y);
          return b0.x > x1 + 2 && b0.x < x2 - 2 && a0.y > y1 + 2 && a0.y < y2 - 2;
        }
        if (av && bh) {
          const y1 = Math.min(a0.y, a1.y), y2 = Math.max(a0.y, a1.y);
          const x1 = Math.min(b0.x, b1.x), x2 = Math.max(b0.x, b1.x);
          return a0.x > x1 + 2 && a0.x < x2 - 2 && b0.y > y1 + 2 && b0.y < y2 - 2;
        }
        return false;
      }

      /** @param {string[]} expectedLabels @param {string} src */
      function inspect(src, expectedLabels) {
        const host = render(src);
        const svg = host.querySelector('svg');
        const viewBox = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number);
        const rootTransform = svg.querySelector('g[transform]')?.getAttribute('transform') || '';
        const translate = rootTransform.match(/translate\(([-\d.]+),([-\d.]+)\)/);
        const tx = translate ? Number(translate[1]) : 0;
        const ty = translate ? Number(translate[2]) : 0;
        const stateRects = Array.from(svg.querySelectorAll('rect'))
          .filter((rect) => !rect.classList.contains('uml-note-box'))
          .map(box);
        const circles = Array.from(svg.querySelectorAll('circle'))
          .map((circle) => {
            const cx = Number(circle.getAttribute('cx'));
            const cy = Number(circle.getAttribute('cy'));
            const r = Number(circle.getAttribute('r'));
            return { l: cx - r, r: cx + r, t: cy - r, b: cy + r, text: '' };
          });
        const nodes = stateRects.concat(circles);
        const labels = Array.from(svg.querySelectorAll('text'))
          .filter((text) => expectedLabels.includes(text.textContent.trim()))
          .map(box);
        const noteBoxes = Array.from(svg.querySelectorAll('polygon.uml-note-box')).map(box);
        const routes = Array.from(svg.querySelectorAll('polyline'))
          .filter((polyline) => !polyline.classList.contains('uml-note-fold'))
          .map((polyline) => parsePoints(/** @type {SVGPolylineElement} */ (polyline)));

        let labelOverlaps = 0;
        let labelNodeHits = 0;
        let labelOutOfBounds = 0;
        for (let i = 0; i < labels.length; i++) {
          const transformed = {
            l: labels[i].l + tx,
            r: labels[i].r + tx,
            t: labels[i].t + ty,
            b: labels[i].b + ty,
          };
          if (transformed.l < -1 || transformed.t < -1 || transformed.r > viewBox[2] + 1 || transformed.b > viewBox[3] + 1) {
            labelOutOfBounds++;
          }
          for (let j = i + 1; j < labels.length; j++) {
            if (overlaps(labels[i], labels[j], 2)) labelOverlaps++;
          }
          for (const node of nodes) {
            if (overlaps(labels[i], node, 3)) labelNodeHits++;
          }
        }

        let noteNodeHits = 0;
        let noteRouteHits = 0;
        let noteLabelHits = 0;
        for (const note of noteBoxes) {
          for (const node of nodes) {
            if (overlaps(note, node, 4)) noteNodeHits++;
          }
          for (const label of labels) {
            if (overlaps(note, label, 4)) noteLabelHits++;
          }
          for (const route of routes) {
            for (let i = 0; i < route.length - 1; i++) {
              if (rectHitsSegment(note, route[i], route[i + 1], 4)) noteRouteHits++;
            }
          }
        }

        const routeSegments = [];
        for (let ri = 0; ri < routes.length; ri++) {
          for (let pi = 0; pi < routes[ri].length - 1; pi++) {
            routeSegments.push({ ri, a: routes[ri][pi], b: routes[ri][pi + 1] });
          }
        }
        let routeCrossings = 0;
        for (let i = 0; i < routeSegments.length; i++) {
          for (let j = i + 1; j < routeSegments.length; j++) {
            if (routeSegments[i].ri !== routeSegments[j].ri &&
                segmentsCross(routeSegments[i].a, routeSegments[i].b, routeSegments[j].a, routeSegments[j].b)) {
              routeCrossings++;
            }
          }
        }

        document.body.removeChild(host);
        return {
          labelCount: labels.length,
          labelOverlaps,
          labelNodeHits,
          labelOutOfBounds,
          routeCrossings,
          noteNodeHits,
          noteRouteHits,
          noteLabelHits,
        };
      }

      const note = inspect(`@startuml
layout portrait
[*] --> Idle : init()
Idle --> Processing : startJob [queueNotEmpty]
Processing --> Done : complete
Done --> [*]
Processing --> Error : exception
Error --> Idle : retry
note right of Processing: Max 3 retries allowed
@enduml`, ['init()', 'startJob [queueNotEmpty]', 'complete', 'exception', 'retry']);

      const vending = inspect(`@startuml
layout portrait
[*] --> Idle
Idle --> AcceptingMoney : selectProduct
AcceptingMoney --> Dispensing : [sufficientFunds] / startDispense()
AcceptingMoney --> Idle : cancel / returnMoney()
Dispensing --> Idle : complete / resetMachine()
state AcceptingMoney {
  entry / displayPrice()
  do / countInsertedCoins()
}
state Dispensing {
  entry / activateMotor()
  exit / stopMotor()
}
@enduml`, ['selectProduct', '[sufficientFunds] / startDispense()', 'cancel / returnMoney()', 'complete / resetMachine()']);

      const order = inspect(`@startuml
layout portrait
[*] --> Created : Order Placed
Created --> Paid : payment_received
Created --> Cancelled : cancel_order [withinWindow]
Paid --> Shipped : ship_order
Paid --> Refunded : refund_requested / processRefund()
Shipped --> Delivered : delivery_confirmed
Cancelled --> [*]
Refunded --> [*]
@enduml`, ['Order Placed', 'payment_received', 'cancel_order [withinWindow]', 'ship_order', 'refund_requested / processRefund()', 'delivery_confirmed']);

      return { note, vending, order };
    });

    for (const [name, result] of Object.entries(stats)) {
      expect(result.labelOverlaps, `${name} label overlaps`).toBe(0);
      expect(result.labelNodeHits, `${name} labels on nodes`).toBe(0);
      expect(result.labelOutOfBounds, `${name} clipped labels`).toBe(0);
      expect(result.routeCrossings, `${name} route crossings`).toBe(0);
      expect(result.noteNodeHits, `${name} notes on nodes`).toBe(0);
      expect(result.noteRouteHits, `${name} notes on transition routes`).toBe(0);
      expect(result.noteLabelHits, `${name} notes on labels`).toBe(0);
    }
  });

  test('state transitions from different sources do not merge at target stems', async ({ page }) => {
    await page.goto('/test-uml.html');
    await page.waitForFunction(() => !!(/** @type {any} */ (window)).UMLStateDiagram);

    const stats = await page.evaluate(() => {
      const host = document.createElement('div');
      host.style.width = '760px';
      host.style.position = 'absolute';
      host.style.left = '-10000px';
      document.body.appendChild(host);
      /** @type {{ render: (container: HTMLElement, text: string) => void }} */ (
        /** @type {any} */ (window).UMLStateDiagram
      ).render(host, `@startuml
layout portrait
[*] --> Idle
Failed --> Idle : reset
Done --> [*]
@enduml`);

      const svg = host.querySelector('svg');
      if (!svg) {
        document.body.removeChild(host);
        return { hasSvg: false, sharedTargetStems: 0, targetStemXs: [] };
      }

      function parsePoints(polyline) {
        return (polyline.getAttribute('points') || '')
          .trim()
          .split(/\s+/)
          .map((pair) => pair.split(',').map(Number))
          .filter((pair) => pair.length === 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
          .map((pair) => ({ x: pair[0], y: pair[1] }));
      }

      const idleText = Array.from(svg.querySelectorAll('text')).find((text) => text.textContent.trim() === 'Idle');
      const idleBox = idleText ? /** @type {SVGGraphicsElement} */ (idleText).getBBox() : null;
      const stateRects = Array.from(svg.querySelectorAll('rect'))
        .filter((rect) => !rect.classList.contains('uml-note-box'))
        .map((rect) => {
          const box = /** @type {SVGGraphicsElement} */ (rect).getBBox();
          return { l: box.x, r: box.x + box.width, t: box.y, b: box.y + box.height };
        });
      const idleRect = idleBox
        ? stateRects.find((rect) => idleBox.x >= rect.l && idleBox.x + idleBox.width <= rect.r && idleBox.y >= rect.t && idleBox.y + idleBox.height <= rect.b)
        : null;
      const targetStemXs = [];
      if (idleRect) {
        const routes = Array.from(svg.querySelectorAll('polyline'))
          .map((polyline) => parsePoints(/** @type {SVGPolylineElement} */ (polyline)))
          .filter((points) => points.length >= 2);
        for (const points of routes) {
          const last = points[points.length - 1];
          const prev = points[points.length - 2];
          const entersIdleTop = Math.abs(last.y - idleRect.t) < 1 &&
            last.x >= idleRect.l - 1 && last.x <= idleRect.r + 1 &&
            Math.abs(last.x - prev.x) < 1;
          if (entersIdleTop) targetStemXs.push(Math.round(last.x));
        }
      }

      let sharedTargetStems = 0;
      for (let i = 0; i < targetStemXs.length; i++) {
        for (let j = i + 1; j < targetStemXs.length; j++) {
          if (Math.abs(targetStemXs[i] - targetStemXs[j]) < 12) sharedTargetStems++;
        }
      }

      document.body.removeChild(host);
      return { hasSvg: true, sharedTargetStems, targetStemXs };
    });

    expect(stats.hasSvg).toBe(true);
    expect(stats.targetStemXs.length).toBeGreaterThanOrEqual(2);
    expect(stats.sharedTargetStems).toBe(0);
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
