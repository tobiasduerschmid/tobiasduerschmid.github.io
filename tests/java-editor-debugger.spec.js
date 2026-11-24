const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

test('Java rename follows the interface across files and Debug enters its implementation', async ({page}) => {
  test.setTimeout(180000);
  await page.goto('/SEBook/tools/java-tutorial');
  const debug = page.getByRole('button',{name:'Start debugger',exact:true});
  await page.getByRole('button',{name:/Output$/}).first().click();
  await expect(debug).toBeVisible({timeout:60000});
  await page.evaluate(async () => {
    const tutorial = window._tutorial;
    const index = tutorial.steps.findIndex(step => step.run_file === 'ShapeDemo.java');
    await tutorial.loadStep(index);
    await tutorial.applySolution();
    tutorial._setActiveFile('Shape.java');
    const editor = tutorial.editor;
    const offset = editor.getModel().getValue().indexOf('getArea') + 2;
    editor.setPosition(editor.getModel().getPositionAt(offset));
    editor.focus();
  });
  await page.keyboard.press('F2');
  const rename = page.getByRole('textbox',{name:/Rename input/});
  await expect(rename).toBeVisible({timeout:90000});
  await rename.fill('areaOfShape');
  await rename.press('Enter');
  await expect.poll(() => page.evaluate(() => Object.keys(window._tutorial.editorModels).filter(path =>
    window._tutorial.editorModels[path].model.getValue().includes('areaOfShape')).sort())).toEqual([
    'Circle.java','Rectangle.java','Shape.java','ShapeDemo.java',
  ]);

  await page.evaluate(() => {
    const t = window._tutorial;
    t._setActiveFile('ShapeDemo.java');
    const m = t.editor.getModel();
    t.editor.setPosition(m.getPositionAt(m.getValue().indexOf('areaOfShape') + 2));
    t.editor.focus();
  });
  // Complete a method on the statically typed Shape parameter.
  await page.evaluate(() => {
    const editor = window._tutorial.editor;
    const model = editor.getModel();
    editor.setPosition(model.getPositionAt(model.getValue().indexOf('areaOfShape')));
    editor.trigger('keyboard','editor.action.triggerSuggest',{});
  });
  await expect(page.getByRole('option',{name:/areaOfShape/}).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    const editor = window._tutorial.editor;
    editor.setPosition(editor.getModel().getPositionAt(editor.getModel().getValue().indexOf('areaOfShape')+2));
    editor.focus();
  });
  await page.keyboard.press('F12');
  await expect.poll(() => page.evaluate(() => window._tutorial.editor.getModel().uri.path)).toBe('/Shape.java');

  // The page already verified the matching bridge during editing. A detached
  // debugger JVM must keep working if that release disappears before Debug.
  await page.route('**/sebook-java-bridge.jar', route => route.fulfill({status:410,body:'Release replaced'}));
  // Launch from the open interface. The step's runnable class is in another file.
  await page.evaluate(() => {
    const t = window._tutorial;
    const source = t.editorModels['Circle.java'].model.getValue();
    const line = source.slice(0,source.indexOf('return Math.PI')).split('\n').length;
    t._debuggerCtl.toggleBreakpoint('Circle.java',line);
  });
  await page.getByRole('button',{name:/Output$/}).first().click();
  await debug.click();
  const resume = page.getByRole('button',{name:'Continue',exact:true});
  await expect(resume).toBeEnabled({timeout:90000});
  await expect(page.locator('.tvm-debug-view-dbg-combined')).toContainText('ShapeDemo.main');
  await resume.click();
  await expect(page.locator('.tvm-debug-view-dbg-combined')).toContainText('Circle.areaOfShape');
  const inspect = page.getByRole('button',{name:'Expand this',exact:true});
  await inspect.click();
  await expect(page.locator('.tvm-debug-view-dbg-combined .tvm-debug-var-name').filter({hasText:/^radius$/}).first()).toBeVisible();
  await a11yCheckpoint(page,'Java debugger paused with an expanded object',{
    feature:'java-tutorial',include:'.tvm-debug-toolbar, .tvm-debug-view-dbg-combined',
  });
  const stepOut = page.getByRole('button',{name:'Step Out',exact:true});
  await stepOut.click();
  await expect.poll(() => page.evaluate(() => {
    const d = window._tutorial._debuggerCtl;
    return d.paused && d.history[d.historyIdx]?.stack.at(-1)?.function;
  })).toBe('ShapeDemo.printShape');
  await resume.click();
  await expect(debug).toBeVisible({timeout:30000});
  await expect(page.locator('.tvm-output-view')).toContainText('Circle');
});

test('Java inspector evaluates a conditional array watch and distinguishes handled and escaped exceptions', async ({page}) => {
  test.setTimeout(120000);
  await page.goto('/java-runtime-frame.html', {waitUntil:'domcontentloaded'});
  const result = await page.evaluate(async () => {
    const {JavaWorkspace} = await import('/js/java/workspace.mjs');
    const workspace = new JavaWorkspace();
    const code = [
      'class Main { public static void main(String[] args) {',
      '  int[] items = {2, 3};',
      '  int total = items[0];',
      '  try { total = items[4]; } catch (RuntimeException e) { total = 1; }',
      '  throw new IllegalArgumentException("end");',
      '} }',
    ].join('\n');
    const stops = [];
    try {
      const result = await workspace.debug({files:{'Main.java':code},entry:'Main.java',
        watches:['items[1]'],breakpoints:[{file:'/tutorial/Main.java',line:3,condition:'items[1] == 3'}],
        exceptionBreakpoints:[{mode:'all',type:'ArrayIndexOutOfBoundsException'},{mode:'uncaught',type:'IllegalArgumentException'}],
        onPause(event) {
          if (event.type !== 'paused') return;
          const snap = event.snapshots.at(-1);
          stops.push([snap.line,snap.exception?.phase || 'line',snap.watches['items[1]']?.repr]);
          workspace.debugCommand(1);
        },
      });
      return {exitCode:result.exitCode,stderr:result.stderr,stops};
    } finally { workspace.destroy(); }
  });
  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain('IllegalArgumentException: end');
  expect(result.stops).toContainEqual([3,'line','3']);
  expect(result.stops).toContainEqual([4,'catch','3']);
  expect(result.stops.some(([,phase]) => phase === 'uncaught')).toBe(true);
});

test('Java rename preserves same-arity overloads and refuses a legal field capture', async ({page}) => {
  test.setTimeout(120000);
  await page.goto('/java-runtime-frame.html', {waitUntil:'domcontentloaded'});
  const plans = await page.evaluate(async () => {
    const {JavaWorkspace} = await import('/js/java/workspace.mjs');
    const {renamePlan} = await import('/js/java/editor.mjs');
    const workspace = new JavaWorkspace();
    const files = {
      'Calc.java': 'class Calc { int value; int pick(int n) { return n + value; } String pick(String n) { return n; } }',
      'Main.java': 'class Main { int number = new Calc().pick(1); String text = new Calc().pick("x"); }',
    };
    try {
      const analyze = source => workspace.analyze({files:source});
      const original = await analyze(files);
      const at = (path,token) => original.bindings.find(s => s.file === path && s.start === files[path].indexOf(token));
      const narrow = await renamePlan(files,original,at('Calc.java','pick(int'),'sum',analyze);
      const captured = await renamePlan(files,original,at('Calc.java','n) { return n + value'),'value',analyze);
      return {
        changed:narrow.edits.map(s => files[s.file].slice(s.start,s.start+6)).sort(),
        capture:captured.rejectReason,
        unsafeEdits:captured.edits,
      };
    } finally { workspace.destroy(); }
  });
  expect(plans.changed).toEqual(['pick(1','pick(i']);
  expect(plans.capture).toMatch(/declaration a reference uses/);
  expect(plans.unsafeEdits).toEqual([]);
});
