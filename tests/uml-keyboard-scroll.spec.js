const { test, expect } = require('@playwright/test');

const examples = [
  { name: 'mobile component architecture', url: '/SEBook/uml_component_diagram.html', diagram: /^UML component diagram.*MobileApp/ },
  { name: 'ride matching sequence', url: '/SEBook/uml_sequence_diagram.html', diagram: /^UML sequence diagram.*RiderApp/ },
  { name: 'channel delivery sequence', url: '/SEBook/uml_sequence_diagram.html', diagram: /^UML sequence diagram.*SlackClient/ },
];

for (const example of examples) {
  test(`${example.name} can be scrolled and exited with the keyboard`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(example.url);
    const diagram = page.getByRole('img', { name: example.diagram });
    await expect(diagram).toBeVisible();
    await expect.poll(() => diagram.evaluate(element => element.scrollWidth - element.clientWidth)).toBeGreaterThan(1);
    await expect(diagram).toHaveAttribute('tabindex', '0');

    await diagram.focus();
    await expect(diagram).toBeFocused();
    await expect(diagram).toHaveCSS('outline-style', 'solid');
    await diagram.press('ArrowRight');
    await expect.poll(() => diagram.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
    await diagram.press('Tab');
    await expect(diagram).not.toBeFocused();
  });
}

test('diagram tab stops follow overflow when the viewport changes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/SEBook/uml.html');
  const diagram = page.getByRole('img', { name: /^UML class diagram/ }).first();
  await expect(diagram).toBeVisible();
  await expect.poll(() => diagram.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  await expect(diagram).not.toHaveAttribute('tabindex', '0');

  await page.setViewportSize({ width: 320, height: 900 });
  await expect.poll(() => diagram.evaluate(element => element.scrollWidth - element.clientWidth)).toBeGreaterThan(1);
  await expect(diagram).toHaveAttribute('tabindex', '0');

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(diagram).not.toHaveAttribute('tabindex', '0');
});
