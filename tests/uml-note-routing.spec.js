const { test, expect } = require('@playwright/test');
const path = require('node:path');

const observerRoles = `@startuml
layout horizontal
interface Subject {
  + attach(observer: Observer): void
  + detach(observer: Observer): void
  + notifyObservers(): void
}
interface Observer {
  + update(): void
}
class ConcreteSubject {
  - subjectState: String
  + getState(): String
  + setState(value: String): void
}
class ConcreteObserver {
  - subject: ConcreteSubject
  - observerState: String
  + update(): void
}
ConcreteSubject ..|> Subject
ConcreteObserver ..|> Observer
Subject "1" -- "*" Observer : observers
ConcreteObserver --> ConcreteSubject : subject
note right of Subject.notifyObservers
  \`\`\`java
  for (Observer o : observers) {
      o.update();
  }
  \`\`\`
end note
note bottom of ConcreteObserver.update
  \`\`\`java
  observerState = subject.getState();
  \`\`\`
end note
note left of ConcreteSubject.getState: return subjectState
@enduml`;

async function noteGeometry(page) {
  await page.setContent('<main><div id="diagram"></div></main>');
  await page.addScriptTag({ path: path.join(__dirname, '../js/ArchUML/uml-bundle.js') });
  await page.evaluate((source) => {
    window.UMLClassDiagram.render(document.getElementById('diagram'), source);
  }, observerRoles);
  await expect(page.getByRole('img')).toBeVisible();
  return page.getByRole('img').evaluate((svg) => {
    const texts = [...svg.querySelectorAll('text')];
    const subjectName = texts.find((text) => text.textContent.trim() === 'Subject').getBBox();
    const subject = [...svg.querySelectorAll('rect')].map((rect) => rect.getBBox())
      .filter((rect) => subjectName.x >= rect.x && subjectName.x + subjectName.width <= rect.x + rect.width &&
        subjectName.y >= rect.y && subjectName.y + subjectName.height <= rect.y + rect.height)
      .sort((a, b) => b.width * b.height - a.width * a.height)[0];
    const method = texts.find((text) => text.textContent.includes('notifyObservers()')).getBBox();
    // Notes have no individual accessible role; inspect the visible SVG
    // connector geometry after selecting the diagram through its image role.
    const routes = [...svg.querySelectorAll('.uml-note-connector')].map((element) =>
      element.tagName.toLowerCase() === 'line'
        ? [{ x: Number(element.getAttribute('x1')), y: Number(element.getAttribute('y1')) },
          { x: Number(element.getAttribute('x2')), y: Number(element.getAttribute('y2')) }]
        : [...element.points].map(({ x, y }) => ({ x, y })));
    return {
      routes,
      subject: { left: subject.x, right: subject.x + subject.width, top: subject.y, bottom: subject.y + subject.height },
      method: { top: method.y, bottom: method.y + method.height },
    };
  });
}

test('a displaced member note approaches its named row without tracing the class border', async ({ page }) => {
  const { routes, subject, method } = await noteGeometry(page);
  expect(routes).toHaveLength(3);
  const route = routes.find((points) => {
    const endpoint = points.at(-1);
    return Math.abs(endpoint.x - subject.right) < 8 && endpoint.y >= method.top && endpoint.y <= method.bottom;
  });
  expect(route, 'the note remains attached beside notifyObservers').toBeDefined();
  const endpoint = route.at(-1);
  const approach = route.at(-2);
  expect(Math.abs(approach.y - endpoint.y), 'a member note approaches its row horizontally').toBeLessThan(0.01);
  expect(approach.x - endpoint.x, 'the final leader approaches from outside the class').toBeGreaterThanOrEqual(4);
  const borderRuns = route.slice(1).filter((point, index) => {
    const previous = route[index];
    const overlap = Math.min(point.y, previous.y) < subject.bottom && Math.max(point.y, previous.y) > subject.top;
    return Math.abs(point.x - subject.right) < 1 && Math.abs(previous.x - subject.right) < 1 &&
      overlap && Math.abs(point.y - previous.y) > 8;
  });
  expect(borderRuns, 'a note leader must remain distinguishable from the class outline').toEqual([]);
});

test('member note leaders contain no retraced segments', async ({ page }) => {
  const { routes } = await noteGeometry(page);
  expect(routes).toHaveLength(3);
  const reversals = [];
  for (const route of routes) {
    for (let i = 1; i < route.length - 1; i++) {
      const before = route[i - 1], point = route[i], after = route[i + 1];
      const first = { x: point.x - before.x, y: point.y - before.y };
      const second = { x: after.x - point.x, y: after.y - point.y };
      const collinear = Math.abs(first.x * second.y - first.y * second.x) < 0.01;
      if (collinear && first.x * second.x + first.y * second.y < -0.01) reversals.push([before, point, after]);
    }
  }
  expect(reversals, 'leaders should not double back over the line they just drew').toEqual([]);
});
