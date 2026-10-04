// @ts-check
const { test, expect } = require('@playwright/test');

for (const theme of ['light', 'dark']) {
  test(`arrow tips and crossing bridges remain precise in ${theme} mode`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/SEBook/tools/python.html');
    if (theme === 'dark') await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
    const lab = page.getByRole('region', { name: 'Object reference lab: Which references survive a copy?', exact: true });
    // The reported case: the original and copied row share the string object,
    // and appending review creates a crossing near a newly highlighted arrowhead.
    const graph = lab.getByRole('region', { name: 'Object reference diagram', exact: true }).locator('.orl-graph');
    for (let i = 0; i < 7; i++) {
      await lab.getByRole('button', { name: 'Forward', exact: true }).click();
      await expect(graph).toHaveAttribute('aria-busy', 'false');
    }
    await expect(graph.locator('.orl-edge-bridge').first()).toBeVisible();
    async function inspect() {
      return graph.evaluate(root => {
        const failures = [], heads = [];
        const paths = [...root.querySelectorAll('.orl-reference-edge, .orl-binding-edge')];
        for (const path of paths) {
          const style = getComputedStyle(path), length = path.getTotalLength();
          const marker = document.getElementById(path.getAttribute('marker-end').match(/#([^)]*)/)[1]);
          const box = marker.querySelector('path').getBBox(), view = marker.viewBox.baseVal;
          const unitScale = marker.markerUnits.baseVal === SVGMarkerElement.SVG_MARKERUNITS_STROKEWIDTH ? parseFloat(style.strokeWidth) : 1;
          const scale = Math.min(marker.markerWidth.baseVal.value / view.width, marker.markerHeight.baseVal.value / view.height) * unitScale;
          const headLength = box.width * scale, headWidth = box.height * scale;
          if (Math.abs((box.x + box.width - marker.refX.baseVal.value) * scale) > 0.1) failures.push('arrowhead overshoots its endpoint');
          const painted = parseFloat(style.strokeDasharray.split(/[ ,]+/)[0]);
          const hiddenShaft = length - painted;
          if (!Number.isFinite(painted) || hiddenShaft < headLength * parseFloat(style.strokeWidth) / headWidth) failures.push('shaft protrudes through pointed tip');
          if (hiddenShaft > headLength) failures.push('shaft is detached from arrowhead');
          if (style.strokeLinecap !== 'butt') failures.push('round cap protrudes at an attachment');
          const matrix = path.getScreenCTM(), end = path.getPointAtLength(length).matrixTransform(matrix);
          const previous = path.getPointAtLength(Math.max(0, length - 0.1)).matrixTransform(matrix);
          const angle = Math.atan2(end.y - previous.y, end.x - previous.x);
          const scaleOnScreen = Math.hypot(matrix.a, matrix.b);
          const dx = Math.cos(angle), dy = Math.sin(angle);
          const base = { x: end.x - dx * headLength * scaleOnScreen, y: end.y - dy * headLength * scaleOnScreen };
          const half = headWidth * scaleOnScreen / 2;
          const corners = [end, { x: base.x - dy * half, y: base.y + dx * half }, { x: base.x + dy * half, y: base.y - dx * half }];
          heads.push({ width: headLength, left: Math.min(...corners.map(p => p.x)), right: Math.max(...corners.map(p => p.x)),
            top: Math.min(...corners.map(p => p.y)), bottom: Math.max(...corners.map(p => p.y)) });
          const target = root.querySelector('[data-object-id="' + path.dataset.targetObject + '"] .orl-object').getBoundingClientRect();
          const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
          const distance = Math.min(...[
            [target.left, clamp(end.y, target.top, target.bottom)],
            [target.right, clamp(end.y, target.top, target.bottom)],
            [clamp(end.x, target.left, target.right), target.top],
            [clamp(end.x, target.left, target.right), target.bottom]
          ].map(([x, y]) => Math.hypot(end.x - x, end.y - y)));
          if (distance > 0.5) failures.push('tip does not meet object border');
        }
        for (const bridge of root.querySelectorAll('.orl-edge-bridge')) {
          const box = bridge.getBoundingClientRect();
          if (heads.some(head => box.left < head.right + 2 && box.right > head.left - 2 && box.top < head.bottom + 2 && box.bottom > head.top - 2)) failures.push('bridge intersects arrowhead clearance');
          const owner = paths.find(path => path.dataset.referenceId === bridge.dataset.referenceId);
          if (!owner || getComputedStyle(owner).strokeWidth !== getComputedStyle(bridge).strokeWidth) failures.push('bridge changes line thickness');
          // Entry/exit tangents should align with the horizontal shaft, not make
          // the sharp joins produced by the old single quadratic arch.
          const length = bridge.getTotalLength();
          if (Math.abs(bridge.getPointAtLength(0.05).y - bridge.getPointAtLength(0).y) > 0.02
              || Math.abs(bridge.getPointAtLength(length - 0.05).y - bridge.getPointAtLength(length).y) > 0.02) failures.push('bridge has a kink at its join');
        }
        if (Math.max(...heads.map(head => head.width)) - Math.min(...heads.map(head => head.width)) > 0.1) failures.push('highlight changes arrowhead size');
        return [...new Set(failures)];
      });
    }
    expect(await inspect()).toEqual([]);
    const owner = await graph.locator('.orl-edge-bridge').first().getAttribute('data-reference-id');
    await graph.evaluate((root, id) => [...root.querySelectorAll('[data-reference-target]')].find(node => node.dataset.referenceId === id).focus(), owner);
    expect(await inspect(), 'keyboard highlighting keeps bridges and arrowheads consistent').toEqual([]);
  });
}
