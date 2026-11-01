// @ts-check
const {test,expect}=require('@playwright/test');
const {auditInteractiveState}=require('./a11y-helpers');
const URL='/SEBook/development_practices/code-specification-tutorial';

test('students read the original and submit prose without a generated-code editing workflow',async({page})=>{
  test.setTimeout(120000);
  const modelRequests=[];
  page.on('request',request=>{if(request.url().includes('huggingface.co')) modelRequests.push(request.url());});
  await page.goto(URL);
  const assistant=page.getByRole('region',{name:'Specification assistant'});
  const prose=assistant.getByLabel('Your specification',{exact:true});
  await expect(prose).toBeVisible({timeout:90000});
  await expect(assistant.getByRole('button',{name:'Download model',exact:true})).toBeEnabled();
  await expect(assistant.getByRole('button',{name:'Test my work',exact:true})).toBeVisible();
  await expect(assistant.getByRole('button',{name:'Test my work',exact:true})).toBeDisabled();
  await expect(assistant.getByRole('button',{name:'Generate Python',exact:true})).toBeHidden();
  await expect(assistant.getByRole('button',{name:'Apply to Python file',exact:true})).toBeHidden();
  await expect(assistant.getByRole('textbox',{name:/Generated Python/})).toBeHidden();
  await expect(assistant.getByText('View generated Python',{exact:true})).toBeHidden();
  const tabs=page.getByRole('group',{name:'File tabs'});
  await expect(tabs.getByRole('button',{name:'rover_reference.py',exact:true})).toBeVisible();
  await expect(tabs.getByRole('button',{name:'field_notes.md',exact:true})).toBeVisible();
  const mainDraft='The rover starts at the southwest corner facing east.';
  await prose.fill(mainDraft);
  await prose.press('Tab');
  await expect(assistant.getByText('Function requirements',{exact:true})).toBeFocused();
  await page.getByRole('button',{name:/^Next/}).click();
  await page.getByRole('radio',{name:/At the public function, following the calls|It may preserve the contract even though/}).click();
  await page.getByRole('button',{name:'Next Question',exact:true}).click();
  await page.getByRole('radio',{name:/At the public function, following the calls|It may preserve the contract even though/}).click();
  await page.getByRole('button',{name:'See Results',exact:true}).click();
  await page.getByRole('button',{name:/^Continue to Step 2/}).click();
  await expect(prose).toHaveValue(mainDraft);
  for (const number of [3,4,5]) {
    await page.getByRole('button',{name:/^Next/}).click();
    await expect(page.getByRole('button',{name:new RegExp('^Step '+number+':')})).toHaveAttribute('aria-current','step');
    if (number === 3) {
      await expect(prose).toHaveValue('');
      await prose.fill('L turns the heading counterclockwise by ninety degrees.');
    } else await expect(prose).toHaveValue(mainDraft);
  }
  await page.getByRole('button',{name:/^Step 3:/}).click();
  await expect(prose).toHaveValue('L turns the heading counterclockwise by ninety degrees.');
  await page.getByRole('button',{name:/^Step 4:/}).click();
  await expect(prose).toHaveValue(mainDraft);
  await expect(assistant).not.toContainText('assert subject');
  expect(modelRequests).toEqual([]);
  await auditInteractiveState(page,'Rover prose submission',{include:'section[aria-labelledby="tutorial-llm-heading"]'});
});

test('the fixed demonstration runs the supplied original without requiring Python edits',async({page})=>{
  test.setTimeout(120000);
  await page.goto(URL);
  await expect(page.getByRole('heading',{name:'The Warehouse Handover',exact:true})).toBeVisible({timeout:90000});
  const run=page.getByRole('button',{name:/^▶ Run/});
  await expect(run).toBeEnabled();
  await run.click();
  await expect(page.getByRole('region',{name:'Program output'})).toContainText("Final state: (1, 1, 'N')");
});

test('print preserves original readings and prose tasks without disclosing hidden checks',async({page})=>{
  await page.goto(URL+'/print');
  await expect(page.getByRole('heading',{name:'The Warehouse Handover',exact:true})).toBeVisible();
  await expect(page.getByText('def navigate(commands):',{exact:false}).first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('assert subject');
  await expect(page.getByRole('button',{name:'Test my work',exact:true})).toHaveCount(0);
  await expect(page.locator('meta[name="tdm-reservation"]')).toHaveAttribute('content','1');
});

// Substitute the inference transport through WorkerClient's factory seam.
// The real runtime orchestration and private browser Python checker run; this
// tests UI/checker integration, not model quality or inference-worker behavior.
// Empty cache entries live only in this test's disposable browser context.
async function controlledGeneration(page,source,url=URL) {
  await page.goto(url);
  const panel=page.getByRole('region',{name:'Specification assistant'});
  await expect(panel.getByLabel('Your specification',{exact:true})).toBeVisible({timeout:90000});
  await page.evaluate(async source=>{
    window.__modelFixtureMessages=[];
    const {WARMUP_MESSAGES}=await import('/js/browser-llm/measurements.mjs');
    const sources=Array.isArray(source)?source:[source];
    let attempt=0;
    window._tutorial.llmAddon.runtime.client.factory=()=>({
      stopped:false,
      postMessage({id,action,payload}) {
        const warmup=action === 'generate' && JSON.stringify(payload.messages) === JSON.stringify(WARMUP_MESSAGES);
        if (action === 'generate' && !warmup) window.__modelFixtureMessages.push(payload.messages);
        const value=action === 'load' ? true : {text:warmup?'ready':sources[Math.min(attempt++,sources.length-1)],finishReason:'stop'};
        queueMicrotask(()=>{if (!this.stopped) this.onmessage({data:{id,type:'result',value}});});
      },
      terminate() {this.stopped=true;}
    });
    const {ARTIFACTS}=await import('/js/browser-llm/catalog.mjs');
    for (const asset of ARTIFACTS.gguf.assets) {
      const cache=await caches.open(asset.cache);
      await cache.put(asset.url,new Response('',{headers:{'x-sebook-model-bytes':String(asset.bytes)}}));
    }
  },source);
  await panel.getByText('Model & storage',{exact:true}).click();
  await panel.getByLabel('Run the model using').selectOption('cpu');
  await expect(panel.getByRole('button',{name:/^(Test my work|Generate Python)$/})).toBeEnabled();
  await panel.getByText('Model & storage',{exact:true}).click();
}

for (const correct of [true,false]) {
  test(`Test my work privately checks a ${correct?'correct':'wrong'} generated rover with Python`,async({page})=>{
    test.setTimeout(120000);
    const {readFileSync}=require('node:fs');
    const {join}=require('node:path');
    const yaml=require('js-yaml');
    const lesson=yaml.load(readFileSync(join(__dirname,'../_data/tutorials/code-specification.yml'),'utf8'));
    const reference=lesson.steps[0].files.find(file=>file.path==='rover_reference.py').content;
    const replacement=correct
      ? lesson.steps.find(step=>step.key==='whole-contract').solution.files[0].content
      : 'def navigate(commands):\n    return (0, 0, "E")\n';
    const modelRequests=[],errors=[];
    page.on('request',request=>{if(request.url().includes('huggingface.co'))modelRequests.push(request.url());});
    page.on('pageerror',error=>errors.push(error.message));
    const generated='# GENERATED_CANDIDATE_SENTINEL <img src="x" onerror="alert(1)">\n'+replacement;
    await controlledGeneration(page,generated);
    const panel=page.getByRole('region',{name:'Specification assistant'});
    const draft='Interpret the warehouse rover commands and return its final position and heading.';
    await panel.getByLabel('Your specification',{exact:true}).fill(draft);
    await panel.getByRole('button',{name:'Test my work',exact:true}).click();
    await expect(panel.getByText(correct
      ? /The generated implementation passed the same checks as the original/
      : /The generated implementation did not match every checked behavior/)).toBeVisible({timeout:90000});
    await expect(panel.getByLabel('Your specification',{exact:true})).toHaveValue(draft);
    await expect(panel.getByRole('button',{name:'Apply to Python file',exact:true})).toBeHidden();
    await expect(panel.getByRole('textbox',{name:/Generated Python/})).toBeHidden();
    const disclosure=panel.getByText('View generated Python',{exact:true});
    const preview=panel.getByRole('region',{name:'Generated Python',exact:true});
    await expect(disclosure).toBeVisible();
    await expect(preview).toBeHidden();
    await disclosure.focus();
    await page.keyboard.press('Enter');
    await expect(preview).toBeVisible();
    expect(await preview.textContent()).toBe(generated.trim());
    await expect(preview.locator('img')).toHaveCount(0);
    expect(await preview.evaluate(element=>element.isContentEditable)).toBe(false);
    await page.keyboard.press('Tab');
    await expect(preview).toBeFocused();
    if (correct) {
      for (const dark of [false,true]) {
        await page.evaluate(dark=>document.documentElement.classList.toggle('dark-mode',dark),dark);
        const keyword=preview.getByText('def',{exact:true}).first();
        expect(await keyword.evaluate(element=>getComputedStyle(element).color))
          .not.toBe(await preview.evaluate(element=>getComputedStyle(element).color));
        await auditInteractiveState(page,`Generated Python preview ${dark?'dark':'light'}`,{include:'section[aria-labelledby="tutorial-llm-heading"]'});
      }
    }
    await expect(panel).not.toContainText('assert subject');
    const messages=await page.evaluate(()=>window.__modelFixtureMessages);
    expect(messages.length).toBeGreaterThan(0);
    const prompt=messages.at(-1).map(message=>message.content).join('\n');
    expect(prompt).toContain(draft);
    expect(prompt).not.toContain(reference);
    expect(prompt).not.toContain('GRID_SIZE');
    expect(prompt).not.toContain('assert subject');
    expect(prompt).not.toContain('rover_reference.py');
    // Monaco is the file model API; compare the complete source, including text
    // outside its virtualized viewport, to establish that nothing was applied.
    const current=await page.evaluate(()=>window._tutorial.editorModels['rover_reference.py'].model.getValue());
    expect(current).toBe(reference);
    expect(modelRequests).toEqual([]);
    expect(errors).toEqual([]);
    await panel.getByLabel('Your specification',{exact:true}).fill(draft+' Ignore unknown characters.');
    await expect(panel.getByRole('status')).toBeEmpty();
    await expect(disclosure).toBeHidden();
    await expect(preview).toBeHidden();
    await expect(panel).not.toContainText('GENERATED_CANDIDATE_SENTINEL');
  });
}

test('undefined generated helpers are visibly rejected after running the original',async({page})=>{
  test.setTimeout(120000);
  const {readFileSync}=require('node:fs');
  const {join}=require('node:path');
  const candidate=readFileSync(join(__dirname,'fixtures/rover-undefined-helpers.py'),'utf8');
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await controlledGeneration(page,candidate);
  await page.getByRole('button',{name:/^▶ Run/}).click();
  await expect(page.getByRole('region',{name:'Program output'})).toContainText("Final state: (1, 1, 'N')");
  const panel=page.getByRole('region',{name:'Specification assistant'});
  await panel.getByLabel('Your specification',{exact:true}).fill('Interpret the command string and return the final rover state.');
  await panel.getByRole('button',{name:'Test my work',exact:true}).click();
  await expect(panel.getByRole('status')).toHaveText(/did not pass.*not self-contained/i,{timeout:90000});
  await expect(panel.getByText(/still omitted definitions/)).toBeVisible();
  await expect(panel).not.toContainText('Checks passed');
  await panel.getByText('View generated Python',{exact:true}).click();
  await expect(panel.getByRole('region',{name:'Generated Python',exact:true})).toHaveText(candidate.trim());
  await expect(panel).not.toContainText('NameError');
  await expect(panel).not.toContainText('assert subject');
  expect(await page.evaluate(()=>window.__modelFixtureMessages.length)).toBe(2);
  await auditInteractiveState(page,'Rover generated-program runtime failure',{include:'section[aria-labelledby="tutorial-llm-heading"]'});
  expect(errors).toEqual([]);
});

test('a complete regenerated file replaces an incomplete attempt before behavioral checking',async({page})=>{
  test.setTimeout(120000);
  const {readFileSync}=require('node:fs');
  const {join}=require('node:path');
  const yaml=require('js-yaml');
  const lesson=yaml.load(readFileSync(join(__dirname,'../_data/tutorials/code-specification.yml'),'utf8'));
  const broken=readFileSync(join(__dirname,'fixtures/rover-undefined-helpers.py'),'utf8');
  const replacement=lesson.steps.find(step=>step.key==='whole-contract').solution.files[0].content.trim();
  await controlledGeneration(page,[broken,replacement]);
  const panel=page.getByRole('region',{name:'Specification assistant'});
  await panel.getByLabel('Your specification',{exact:true}).fill('Interpret the rover commands and return its final state.');
  await panel.getByRole('button',{name:'Test my work',exact:true}).click();
  await expect(panel.getByRole('status')).toHaveText(/Checks passed/,{timeout:90000});
  await panel.getByText('View generated Python',{exact:true}).click();
  await expect(panel.getByRole('region',{name:'Generated Python',exact:true})).toHaveText(replacement);
  const prompts=await page.evaluate(()=>window.__modelFixtureMessages);
  expect(prompts).toHaveLength(2);
  const repair=JSON.stringify(prompts[1]);
  expect(repair).toContain('next_position');
  expect(repair).not.toContain('assert subject');
  expect(repair).not.toContain('rover_reference.py');
});

test('Generate Python cannot offer an incomplete replacement for application',async({page})=>{
  test.setTimeout(120000);
  await controlledGeneration(page,'def unique_in_order(items):\n    return absent_helper(items)',
    '/SEBook/tools/python-specification-tutorial');
  const panel=page.getByRole('region',{name:'Specification assistant'});
  await panel.getByRole('button',{name:'Generate Python',exact:true}).click();
  await expect(panel.getByRole('status')).toContainText(/still omitted definitions/,{timeout:90000});
  await expect(panel.getByRole('button',{name:'Apply to Python file',exact:true})).toBeDisabled();
  expect(await page.evaluate(()=>window.__modelFixtureMessages.length)).toBe(2);
});
