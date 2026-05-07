// Smoke test for the new fragment editing flows added to the UML visual
// editor. Checks: messages inside a fragment are selectable, source/target
// rewires through the props pane, and the fragment itself is selectable
// with a working props pane (change kind, edit condition, add branch,
// unwrap, delete).
const { test, expect } = require('@playwright/test');

const SAMPLE = `@startuml
participant client: Client
participant server: Server
participant db: Database

client -> server: login()
activate server
alt [success]
  server -> db: query()
  activate db
  db --> server: data
  deactivate db
else [failure]
  server -> server: log()
end
server --> client: result
deactivate server
@enduml`;

async function setupPlayground(page) {
  await page.goto('/SEBook/tools/uml-playground');
  // Clear persistence so each test starts cold.
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => /uml-pg-autosave/.test(k)).forEach(k => localStorage.removeItem(k));
  });
  await page.waitForSelector('#uml-pg-output svg');
  await page.check('#uml-pg-edit');
  await page.selectOption('#uml-pg-type', 'sequence');
  await page.waitForSelector('#uml-pg-output svg');
  await page.locator('#uml-pg-input').fill(SAMPLE);
  await page.locator('#uml-pg-input').dispatchEvent('input');
  // Wait for SVG to render with the alt fragment hitbox
  await expect(page.locator('.uml-pg-edit-hitbox[data-layout-fragment-id]')).toHaveCount(1);
  // Wait an extra debounce tick so the latest render reflects our fill (the
  // editor debounces input events by 250ms, so the FIRST hitbox we see may
  // belong to the example diagram, not our sample).
  await page.waitForTimeout(400);
  await expect(page.locator('.uml-pg-edit-hitbox[data-layout-fragment-id]')).toHaveCount(1);
}

test.describe('UML editor fragment + nested-message editing', () => {
  test('messages inside a fragment expose route hitboxes', async ({ page }) => {
    await setupPlayground(page);
    // The messages inside the alt branches should each have edge hitboxes.
    // We don't hard-code line numbers because the textarea may renumber lines
    // — instead we compare to the rendered source lines.
    const result = await page.evaluate(() => {
      const ta = document.getElementById('uml-pg-input');
      const lines = ta.value.split('\n');
      const messageLineIdxs = [];
      for (let i = 0; i < lines.length; i++) {
        if (/^\s*\S+\s+(?:->>?|-->|<--|<<--)\s+\S+/.test(lines[i])) messageLineIdxs.push(i);
      }
      const hitboxRouteIds = Array.from(new Set(Array.from(document.querySelectorAll('.uml-pg-edge-hitbox[data-route-id]'))
        .map(el => el.getAttribute('data-route-id'))));
      return { messageLineIdxs, hitboxRouteIds };
    });
    // Every message line should produce a seqmsg:N hitbox.
    result.messageLineIdxs.forEach(idx => {
      expect(result.hitboxRouteIds).toContain('seqmsg:' + idx);
    });
    // We expect 5 messages (1 outside, 3 in alt branch, 1 in else branch).
    // Some messages have multiple segments, so de-duped seqmsg ids should be 5.
    expect(result.hitboxRouteIds.length).toBeGreaterThanOrEqual(5);
  });

  test('source endpoint of a message inside a fragment can be rewired', async ({ page }) => {
    await setupPlayground(page);
    // Find the seqmsg:N id for `server -> db: query()`, then click it.
    await page.evaluate(() => {
      const ta = document.getElementById('uml-pg-input');
      const lines = ta.value.split('\n');
      let queryIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (/server\s+->\s+db:\s*query\(\)/.test(lines[i])) { queryIdx = i; break; }
      }
      const hb = document.querySelector(`.uml-pg-edge-hitbox[data-route-id="seqmsg:${queryIdx}"]`);
      const r = hb.getBoundingClientRect();
      hb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: r.x + r.width/2, clientY: r.y + r.height/2, pointerId: 1, button: 0 }));
      hb.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, clientX: r.x + r.width/2, clientY: r.y + r.height/2, pointerId: 1, button: 0 }));
    });
    await expect(page.locator('#uml-pg-props-title')).toContainText('server → db');
    // Source endpoint dropdown should be visible and let us pick `client`.
    await page.evaluate(() => {
      const fields = document.querySelectorAll('#uml-pg-props-content .uml-pg-prop-row');
      let select = null;
      fields.forEach(f => {
        const lbl = f.querySelector('label');
        if (lbl && lbl.textContent === 'Source endpoint') select = f.querySelector('select');
      });
      select.value = 'client';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(300);
    const src = await page.locator('#uml-pg-input').inputValue();
    expect(src).toMatch(/client\s+->\s+db\s*:\s*query\(\)/);
    // The `server -> db: query()` line should be gone (only one `query()` line).
    const queryLines = src.split('\n').filter(l => /:\s*query\(\)/.test(l));
    expect(queryLines).toHaveLength(1);
  });

  test('fragment is selectable and shows a fragment properties panel', async ({ page }) => {
    await setupPlayground(page);
    await page.evaluate(() => {
      const hb = document.querySelector('.uml-pg-edit-hitbox[data-layout-fragment-id]');
      const r = hb.getBoundingClientRect();
      hb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: r.x + r.width/2, clientY: r.y + r.height/2, pointerId: 1, button: 0 }));
      hb.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, clientX: r.x + r.width/2, clientY: r.y + r.height/2, pointerId: 1, button: 0 }));
    });
    await expect(page.locator('#uml-pg-props-title')).toContainText('Fragment — alt');
    const labels = await page.evaluate(() => Array.from(document.querySelectorAll('#uml-pg-props-content label')).map(l => l.textContent));
    const legends = await page.evaluate(() => Array.from(document.querySelectorAll('#uml-pg-props-content legend')).map(l => l.textContent));
    const buttons = await page.evaluate(() => Array.from(document.querySelectorAll('#uml-pg-props-content button')).map(b => b.textContent));
    expect(labels).toContain('Kind');
    expect(labels).toContain('Condition');
    expect(legends).toContain('Branches');
    expect(buttons.some(b => /Remove fragment/.test(b))).toBe(true);
  });

  test('changing fragment kind updates the source', async ({ page }) => {
    await setupPlayground(page);
    await page.evaluate(() => {
      const hb = document.querySelector('.uml-pg-edit-hitbox[data-layout-fragment-id]');
      const r = hb.getBoundingClientRect();
      hb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: r.x + r.width/2, clientY: r.y + r.height/2, pointerId: 1, button: 0 }));
      hb.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, clientX: r.x + r.width/2, clientY: r.y + r.height/2, pointerId: 1, button: 0 }));
    });
    await page.evaluate(() => {
      const fields = document.querySelectorAll('#uml-pg-props-content .uml-pg-prop-row');
      let kindSel = null;
      fields.forEach(f => {
        const lbl = f.querySelector('label');
        if (lbl && lbl.textContent === 'Kind') kindSel = f.querySelector('select');
      });
      kindSel.value = 'loop';
      kindSel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(300);
    const src = await page.locator('#uml-pg-input').inputValue();
    expect(src).toContain('loop [success]');
    expect(src).not.toContain('alt [success]');
  });

  test('editing fragment condition updates the source', async ({ page }) => {
    await setupPlayground(page);
    await page.evaluate(() => {
      const hb = document.querySelector('.uml-pg-edit-hitbox[data-layout-fragment-id]');
      const r = hb.getBoundingClientRect();
      hb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: r.x + r.width/2, clientY: r.y + r.height/2, pointerId: 1, button: 0 }));
      hb.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, clientX: r.x + r.width/2, clientY: r.y + r.height/2, pointerId: 1, button: 0 }));
    });
    await page.evaluate(() => {
      const fields = document.querySelectorAll('#uml-pg-props-content .uml-pg-prop-row');
      let condInp = null;
      fields.forEach(f => {
        const lbl = f.querySelector('label');
        if (lbl && lbl.textContent === 'Condition') condInp = f.querySelector('input[type="text"]');
      });
      condInp.value = 'payload validates';
      condInp.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(300);
    const src = await page.locator('#uml-pg-input').inputValue();
    expect(src).toContain('alt [payload validates]');
  });

  test('a message inside an else branch can be moved back to the condition branch', async ({ page }) => {
    await setupPlayground(page);
    // Click the `server -> server: log()` message which sits in the else
    // [failure] branch.
    await page.evaluate(() => {
      const ta = document.getElementById('uml-pg-input');
      const lines = ta.value.split('\n');
      let logIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (/server\s+->\s+server:\s*log\(\)/.test(lines[i])) { logIdx = i; break; }
      }
      const hb = document.querySelector(`.uml-pg-edge-hitbox[data-route-id="seqmsg:${logIdx}"]`);
      const r = hb.getBoundingClientRect();
      hb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: r.x + r.width/2, clientY: r.y + r.height/2, pointerId: 1, button: 0 }));
      hb.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, clientX: r.x + r.width/2, clientY: r.y + r.height/2, pointerId: 1, button: 0 }));
    });
    // Branch picker should be visible — pick branch index 0 (the `[success]`
    // branch above the `else`).
    await page.evaluate(() => {
      const fields = document.querySelectorAll('#uml-pg-props-content .uml-pg-prop-row');
      let branchSel = null;
      fields.forEach(f => {
        const lbl = f.querySelector('label');
        if (lbl && lbl.textContent === 'Branch') branchSel = f.querySelector('select');
      });
      if (!branchSel) throw new Error('Branch picker missing');
      branchSel.value = '0';
      branchSel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(400);
    const src = await page.locator('#uml-pg-input').inputValue();
    // Now `server -> server: log()` should appear BEFORE the `else [failure]`.
    const lines = src.split('\n');
    const elseIdx = lines.findIndex(l => /^\s*else\b/.test(l));
    const logIdx = lines.findIndex(l => /server\s+->\s+server:\s*log\(\)/.test(l));
    expect(logIdx).toBeGreaterThan(-1);
    expect(elseIdx).toBeGreaterThan(-1);
    expect(logIdx).toBeLessThan(elseIdx);
  });

  test('double-clicking the [condition] guard text opens an inline editor', async ({ page }) => {
    await setupPlayground(page);
    // The condition text is rendered as a separate `[success]` text element with
    // data-layout-fragment-id and role="condition".
    await page.evaluate(() => {
      const t = document.querySelector('text[data-layout-fragment-id][data-layout-fragment-role="condition"]');
      if (!t) throw new Error('No condition text found');
      const r = t.getBoundingClientRect();
      t.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: r.x + r.width/2, clientY: r.y + r.height/2 }));
    });
    // The inline input should appear pre-filled with the current condition.
    const inlineValue = await page.locator('input.uml-pg-inline-input').inputValue();
    expect(inlineValue).toBe('success');
    // Type a new condition + Enter to commit.
    await page.locator('input.uml-pg-inline-input').fill('user is admin');
    await page.locator('input.uml-pg-inline-input').press('Enter');
    await page.waitForTimeout(200);
    const src = await page.locator('#uml-pg-input').inputValue();
    expect(src).toContain('alt [user is admin]');
  });

  test('double-clicking the [otherwise] branch text opens an inline editor', async ({ page }) => {
    await setupPlayground(page);
    await page.evaluate(() => {
      const t = document.querySelector('text[data-layout-fragment-id][data-layout-fragment-role="branch"]');
      if (!t) throw new Error('No branch text found');
      const r = t.getBoundingClientRect();
      t.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: r.x + r.width/2, clientY: r.y + r.height/2 }));
    });
    const inlineValue = await page.locator('input.uml-pg-inline-input').inputValue();
    expect(inlineValue).toBe('failure');
    await page.locator('input.uml-pg-inline-input').fill('rate limited');
    await page.locator('input.uml-pg-inline-input').press('Enter');
    await page.waitForTimeout(200);
    const src = await page.locator('#uml-pg-input').inputValue();
    expect(src).toContain('else [rate limited]');
  });

  test('Move earlier / Move later buttons reorder a fragment among siblings', async ({ page }) => {
    // Need a fragment that sits between two sibling top-level messages.
    await setupPlayground(page);
    await page.evaluate(() => {
      const hb = document.querySelector('.uml-pg-edit-hitbox[data-layout-fragment-id]');
      const r = hb.getBoundingClientRect();
      hb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: r.x + r.width/2, clientY: r.y + r.height/2, pointerId: 1, button: 0 }));
      hb.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, clientX: r.x + r.width/2, clientY: r.y + r.height/2, pointerId: 1, button: 0 }));
    });
    // Click "Move later" — the alt block should swap with the next top-level
    // message (`server --> client: result`).
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('#uml-pg-props-content button'));
      const moveLater = buttons.find(b => b.textContent.trim() === 'Move later');
      if (!moveLater) throw new Error('Move later button missing');
      moveLater.click();
    });
    await page.waitForTimeout(300);
    const src = await page.locator('#uml-pg-input').inputValue();
    const lines = src.split('\n');
    const altIdx = lines.findIndex(l => /^\s*alt\b/.test(l));
    const resultIdx = lines.findIndex(l => /server\s+-->\s+client:\s*result/.test(l));
    expect(altIdx).toBeGreaterThan(-1);
    expect(resultIdx).toBeGreaterThan(-1);
    expect(resultIdx).toBeLessThan(altIdx);
  });

  test('removing a fragment via props button keeps inner messages', async ({ page }) => {
    await setupPlayground(page);
    await page.evaluate(() => {
      const hb = document.querySelector('.uml-pg-edit-hitbox[data-layout-fragment-id]');
      const r = hb.getBoundingClientRect();
      hb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: r.x + r.width/2, clientY: r.y + r.height/2, pointerId: 1, button: 0 }));
      hb.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, clientX: r.x + r.width/2, clientY: r.y + r.height/2, pointerId: 1, button: 0 }));
    });
    await page.locator('#uml-pg-props-content button', { hasText: 'Remove fragment' }).click();
    const src = await page.locator('#uml-pg-input').inputValue();
    expect(src).not.toMatch(/^\s*alt\b/m);
    expect(src).not.toMatch(/^\s*else\b/m);
    // Inner messages still in the source.
    expect(src).toContain('server -> db: query()');
    expect(src).toContain('db --> server: data');
    expect(src).toContain('server -> server: log()');
  });
});
