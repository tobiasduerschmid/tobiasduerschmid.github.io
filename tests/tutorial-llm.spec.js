// @ts-check
const {test,expect}=require('@playwright/test');
const http=require('node:http');
const {auditInteractiveState}=require('./a11y-helpers');
const {textContrast}=require('./print-helpers');
const {setEditorContent}=require('./tutorial-helpers');
const URL='/SEBook/tools/python-specification-tutorial';
const correct='def unique_in_order(items):\n    return list(dict.fromkeys(items))\n';
async function open(page) {
  await page.goto(URL);
  await expect(page.getByRole('heading',{name:'Specification assistant',exact:true})).toBeVisible({timeout:90000});
  await expect(page.getByRole('button',{name:'Download model',exact:true})).toBeEnabled({timeout:15000});
}
function status(page) {return page.getByRole('region',{name:'Specification assistant'}).getByRole('status');}

test('tutor requests include step guidance and fresh files, including a step without a specification exercise',async({page})=>{
  await open(page);
  const first=await page.evaluate(async()=>{
    const tutorial=window._tutorial,addon=tutorial.llmAddon,requests=[];
    // Stub only inference: capture the actual production prompt without weights.
    addon.runtime.generate=async messages=>{requests.push(messages);return {text:'Consider the ordering.',finishReason:'stop'};};
    addon.plan.cached=true;
    await addon.askTutor('Why?',[],()=>{});
    tutorial.editorModels['solution.py'].model.setValue('# CURRENT_EDIT\ndef unique_in_order(items): return items');
    addon.plan.cached=true;
    await addon.askTutor('What now?',[{role:'user',content:'Why?'},{role:'assistant',content:'Consider ordering.'}],()=>{});
    return {requests,instructions:tutorial.steps[0].ai_tutor_instructions};
  });
  for(const request of first.requests) expect(request.some(m=>m.role==='system'&&m.content.includes(first.instructions))).toBe(true);
  expect(first.requests[1].some(m=>m.content.includes('CURRENT_EDIT'))).toBe(true);
  await page.getByRole('button',{name:'Next →',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Transfer the reasoning',exact:true})).toBeVisible();
  const second=await page.evaluate(async()=>{
    const tutorial=window._tutorial,addon=tutorial.llmAddon;let request;
    addon.runtime.generate=async messages=>{request=messages;return {text:'Explain your example.',finishReason:'stop'};};
    addon.plan.cached=true;await addon.askTutor('Help?',[],()=>{});
    return {request,instructions:tutorial.steps[1].ai_tutor_instructions,source:tutorial.editorModels['reflection.py'].model.getValue()};
  });
  expect(second.request.some(m=>m.role==='system'&&m.content.includes(second.instructions))).toBe(true);
  expect(second.request.some(m=>m.content.includes('reflection.py')&&m.content.includes(second.source))).toBe(true);
  expect(JSON.stringify(second.request)).not.toContain('CURRENT_EDIT');
  expect(JSON.stringify(second.request)).not.toContain(first.instructions);
});

test('YAML enables local tutor, requires explicit download, and can disable it',async({page})=>{
  const requests=[];page.on('request',r=>{if(r.url().includes('huggingface.co'))requests.push(r.url());});
  await open(page);
  await page.getByText('AI tutor',{exact:true}).click();
  await page.getByLabel('Ask the AI tutor').fill('How should I think about duplicates?');
  await page.getByRole('button',{name:'Send',exact:true}).click();
  await expect(page.locator('.tvm-tutor-local').getByRole('status')).toContainText('Download the model');
  for(const dark of [false,true]) {
    const theme=page.getByLabel('Toggle dark mode');
    if(await theme.isChecked()!==dark) await theme.press('Space');
    for(const name of ['Send','Reset chat']) {
      const button=page.getByRole('button',{name,exact:true});
      await page.mouse.move(0,0);
      await expect.poll(()=>textContrast(button)).toBeGreaterThanOrEqual(4.5);
      await button.hover();
      await expect.poll(()=>textContrast(button)).toBeGreaterThanOrEqual(4.5);
    }
    await page.getByRole('button',{name:'Reset chat',exact:true}).focus();
    await page.keyboard.press('Space');
    await expect(page.getByLabel('Ask the AI tutor')).toBeFocused();
    await expect(page.getByRole('log',{name:'Tutor conversation'})).toBeEmpty();
    await auditInteractiveState(page,'Local tutor '+(dark?'dark':'light'),{include:'.tutorial-llm'});
  }
  expect(requests).toEqual([]);
  await page.evaluate(()=>{window._tutorial.config.ai_tutor=false;window._tutorial.llmAddon.setStep();});
  await expect(page.getByText('AI tutor',{exact:true})).toHaveCount(0);
});

test('tutor uses automatic cached loading and Stop reply cancels initialization',async({page,context})=>{
  await open(page);
  await cachedModelMetadata(page);
  let vendorRequest;
  await context.route('https://cdn.jsdelivr.net/npm/@wllama/**',route=>{vendorRequest=route;});
  try {
    await page.getByText('AI tutor',{exact:true}).click();
    await page.getByLabel('Ask the AI tutor').fill('What does preserving order mean?');
    await page.getByRole('button',{name:'Send',exact:true}).click();
    await expect(page.getByTestId('model-loading-indicator')).toBeVisible();
    await expect.poll(()=>!!vendorRequest).toBe(true);
    await page.getByRole('button',{name:'Stop reply',exact:true}).click();
    await expect(page.getByTestId('model-loading-indicator')).toBeHidden();
    await expect(page.getByRole('button',{name:'Send',exact:true})).toBeEnabled();
    await expect(page.locator('.tvm-tutor-local').getByRole('status')).toContainText('stopped');
  } finally {await vendorRequest?.abort().catch(()=>{});}
});

async function cachedModelMetadata(page) {
  // Cache metadata is sufficient for the UI lifecycle fixture. Vendor loading
  // is held at its network boundary below; these entries are not real weights.
  await page.evaluate(async()=>{
    const {ARTIFACTS}=await import('/js/browser-llm/catalog.mjs');
    for (const asset of ARTIFACTS.gguf.assets) {
      const cache=await caches.open(asset.cache);
      await cache.put(asset.url,new Response('',{headers:{'x-sebook-model-bytes':String(asset.bytes)}}));
    }
  });
  await page.getByText('Model & storage',{exact:true}).click();
  await page.getByLabel('Run the model using').selectOption('cpu');
  await expect(page.getByRole('button',{name:'Generate Python',exact:true})).toBeEnabled();
  await page.getByText('Model & storage',{exact:true}).click();
}

test('a downloaded model loads when Generate is used, with a cancellable spinner',async({page,context})=>{
  const requests=[];page.on('request',r=>{if(r.url().includes('huggingface.co'))requests.push(r.url());});
  await open(page);
  await cachedModelMetadata(page);
  await expect(page.getByRole('button',{name:'Load downloaded model',exact:true})).toHaveCount(0);
  let vendorRequest;
  await context.route('https://cdn.jsdelivr.net/npm/@wllama/**',route=>{vendorRequest=route;});
  try {
    await page.getByRole('button',{name:'Generate Python',exact:true}).click();
    await expect(page.getByTestId('model-loading-indicator')).toBeVisible();
    await expect(status(page)).toContainText(/Loading .*into memory/);
    await expect(page.getByRole('progressbar',{name:'Model download'})).toBeHidden();
    await expect.poll(()=>!!vendorRequest).toBe(true);
    await auditInteractiveState(page,'Preparing cached model',{include:'.tutorial-llm'});
    await page.emulateMedia({reducedMotion:'reduce'});
    await expect(page.getByTestId('model-loading-indicator')).toHaveCSS('animation-name','none');
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
    await expect(page.getByTestId('model-loading-indicator')).toBeHidden();
    await expect(page.getByRole('button',{name:'Generate Python',exact:true})).toBeEnabled();
    await expect(page.getByRole('button',{name:'Apply to Python file',exact:true})).toBeDisabled();
    expect(requests).toEqual([]);
  } finally {await vendorRequest?.abort().catch(()=>{});}
});

test('evicted model data returns to explicit download without a background transfer',async({page})=>{
  const requests=[];page.on('request',r=>{if(r.url().includes('huggingface.co'))requests.push(r.url());});
  await open(page);
  await cachedModelMetadata(page);
  await page.evaluate(()=>caches.delete('sebook-llm-gguf-v1'));
  await page.getByRole('button',{name:'Generate Python',exact:true}).click();
  await expect(status(page)).toContainText('no longer downloaded');
  await expect(page.getByTestId('model-loading-indicator')).toBeHidden();
  await expect(page.getByRole('button',{name:'Download model',exact:true})).toBeEnabled();
  expect(requests).toEqual([]);
});

for (const dark of [false,true]) {
  test(`assistant buttons stay readable in every interaction state (${dark?'dark':'light'})`,async({page})=>{
    await open(page);
    await page.getByText('Model & storage',{exact:true}).click();
    const theme=page.getByLabel('Toggle dark mode');
    if ((await theme.isChecked())!==dark) await theme.press('Space');
    for (const name of ['Download model','Check Python','Delete downloaded model','Unload from memory']) {
      const button=page.getByRole('button',{name,exact:true});
      await page.mouse.move(0,0);
      await expect.poll(()=>textContrast(button),{message:`${name}: resting text contrast`}).toBeGreaterThanOrEqual(4.5);
      await button.hover();
      await expect.poll(()=>textContrast(button),{message:`${name}: hovered text contrast`}).toBeGreaterThanOrEqual(4.5);
      await page.mouse.down();
      try {
        await expect.poll(()=>textContrast(button),{message:`${name}: pressed text contrast`}).toBeGreaterThanOrEqual(4.5);
      } finally {
        await page.mouse.move(0,0);
        await page.mouse.up();
      }
      if (await button.isEnabled()) {
        await button.focus();
        await page.keyboard.press('ArrowRight');
        await expect.poll(()=>textContrast(button),{message:`${name}: focused text contrast`}).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
}

test('writing and manual checking are available before setup; engine and storage controls are disclosed on demand',async({page})=>{
  const requests=[];page.on('request',r=>{if(r.url().includes('huggingface.co'))requests.push(r.url());});
  await open(page);
  await expect(page.getByLabel('Your specification',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Check Python',exact:true})).toBeEnabled();
  await expect(page.getByRole('button',{name:'Generate Python',exact:true})).toBeHidden();
  await expect(page.getByLabel('Run the model using')).toBeHidden();
  await page.getByText('Model & storage',{exact:true}).press('Enter');
  await expect(page.getByLabel('Run the model using')).toBeVisible();
  await expect(page.getByRole('button',{name:'Delete downloaded model',exact:true})).toBeVisible();
  await page.getByText('Model & storage',{exact:true}).press('Enter');
  await expect(page.getByLabel('Run the model using')).toBeHidden();
  expect(requests).toEqual([]);
});

test('capability checks fetch no model; manual checks distinguish mismatches, syntax, and passing Python',async({page})=>{
  test.setTimeout(120000);
  const modelRequests=[];page.on('request',r=>{if(r.url().includes('huggingface.co'))modelRequests.push(r.url());});
  await open(page);
  await page.getByRole('button',{name:'Check Python',exact:true}).click();
  await expect(status(page)).toContainText('Check finished');
  await expect(page.getByText(/The implementation did not satisfy every check/)).toContainText('order of the returned values');
  const panel=page.getByRole('region',{name:'Specification assistant'});
  await expect(panel).not.toContainText('[7, -8, 2]');
  await expect(panel).not.toContainText('assert subject');
  await setEditorContent(page,'def unique_in_order(:');
  await page.getByRole('button',{name:'Check Python',exact:true}).click();
  await expect(panel.getByText(/The Python file has a syntax error/)).toBeVisible();
  await setEditorContent(page,correct);
  await page.getByRole('button',{name:'Check Python',exact:true}).click();
  await expect(panel.getByText(/The implementation passed these checks/)).toBeVisible();
  expect(modelRequests).toEqual([]);
});

test('deleting during a real streamed transfer stops the writer and preserves tutorial work, also from another tab',async({page,context})=>{
  test.setTimeout(120000);
  // The external network fixture transfers only 512 KiB, irrespective of the
  // real model's declared size; keep this test independent of host disk quota.
  await page.addInitScript(()=>{navigator.storage.estimate=async()=>({quota:8e9,usage:0});});
  let response;
  const server=http.createServer((req,res)=>{
    response=res;
    res.writeHead(206,{'Content-Type':'application/octet-stream','Content-Length':'33554432','Content-Range':req.headers.range.replace('=', ' ')+'/2104932800','Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'Content-Range','Cross-Origin-Resource-Policy':'cross-origin','Access-Control-Allow-Private-Network':'true'});
    res.write(Buffer.alloc(512*1024));
    // Remain in flight until the student cancels. No fixed-duration sleeps.
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  try {
    await context.route('https://huggingface.co/**',route=>route.fulfill({status:307,headers:{location:'http://127.0.0.1:'+port+'/model','access-control-allow-origin':'*'}}));
    await open(page);
    await setEditorContent(page,correct);
    await page.getByText('Model & storage',{exact:true}).click();
    await page.getByLabel('Run the model using').selectOption('cpu');
    await expect(page.getByRole('button',{name:'Download model',exact:true})).toBeEnabled();
    await page.getByRole('button',{name:'Download model',exact:true}).click();
    const progress=page.getByRole('progressbar',{name:'Model download'});
    await expect(progress).toBeVisible();
    await expect.poll(()=>progress.evaluate(el=>el.value)).toBeGreaterThan(0);
    await page.getByRole('button',{name:'Delete downloaded model',exact:true}).click();
    await expect(status(page)).toContainText('Downloaded model deleted');
    await expect(progress).toBeHidden();
    expect(await page.evaluate(()=>window._tutorial.editorModels['solution.py'].model.getValue())).toBe(correct);
    expect(await page.evaluate(()=>caches.keys())).not.toEqual(expect.arrayContaining(['sebook-llm-gguf-v1']));
    await page.getByRole('button',{name:'Download model',exact:true}).click();
    await expect(progress).toBeVisible();
    await expect.poll(()=>progress.evaluate(el=>el.value)).toBeGreaterThan(0);
    const storagePage=await context.newPage();
    await storagePage.goto('/cookies/');
    await storagePage.getByRole('button',{name:'Delete downloaded language model',exact:true}).click();
    await expect(storagePage.getByText('Downloaded language model deleted; tutorial work preserved',{exact:true})).toBeVisible();
    await expect(progress).toBeHidden();
    expect(await page.evaluate(()=>window._tutorial.editorModels['solution.py'].model.getValue())).toBe(correct);
    expect(await page.evaluate(()=>caches.keys())).not.toEqual(expect.arrayContaining(['sebook-llm-gguf-v1']));
  } finally {response?.destroy();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('controls are keyboard operable, readable in both themes, and reflow at narrow width',async({page})=>{
  test.setTimeout(120000);await open(page);
  const specification=page.getByLabel('Your specification',{exact:true});
  await specification.focus();await page.keyboard.type('Keep the first occurrence in order.');
  await expect(specification).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByText('Function requirements',{exact:true})).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button',{name:'Download model',exact:true})).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button',{name:'Check Python',exact:true})).toBeFocused();
  await page.keyboard.press('Enter');await expect(status(page)).toContainText('Check finished');
  await auditInteractiveState(page,'Python specification assistant',{include:'.tutorial-llm'});
  await page.getByText('Model & storage',{exact:true}).click();
  await auditInteractiveState(page,'Python specification model settings',{include:'.tutorial-llm'});
  await page.setViewportSize({width:320,height:700});
  const sizes=await specification.evaluate(el=>({font:parseFloat(getComputedStyle(el).fontSize),width:el.getBoundingClientRect().width,viewport:innerWidth}));
  expect(sizes.font).toBeGreaterThanOrEqual(16);expect(sizes.width).toBeLessThanOrEqual(sizes.viewport);
});

test('print includes the public specification and omits hidden checks and runtime controls',async({page})=>{
  await page.goto(URL+'/print');
  await expect(page.getByRole('heading',{name:'Specification practice'})).toBeVisible();
  await expect(page.getByText('Remove repeated values from a list of integers.',{exact:false})).toBeVisible();
  await expect(page.getByRole('button',{name:'Download model',exact:true})).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('assert subject');
  await page.emulateMedia({media:'print'});
  await expect(page.locator('meta[name="tdm-reservation"]')).toHaveAttribute('content','1');
});


test('leaving a step immediately cancels an unbounded Python check and preserves its draft',async({page})=>{
  test.setTimeout(120000);await open(page);
  const source='def unique_in_order(items):\n    while True: pass\n';
  await setEditorContent(page,source);
  // Observe the real worker boundary without replacing Python execution.
  await page.evaluate(()=>{
    const worker=window._tutorial._worker,post=worker.postMessage.bind(worker);
    worker.postMessage=(message,...rest)=>{
      if(message.captureOutput) window.llmCheckSent=true;
      return post(message,...rest);
    };
  });
  await page.getByRole('button',{name:'Check Python',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>!!window.llmCheckSent)).toBe(true);
  await page.getByRole('button',{name:'Next →',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Transfer the reasoning',exact:true})).toBeVisible({timeout:7000});
  await expect(status(page)).not.toContainText('Checking the current Python file');
  await page.getByRole('button',{name:/^Step 1:/}).click();
  await expect(page.getByLabel('Your specification',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>window._tutorial.editorModels['solution.py'].model.getValue())).toBe(source);
  await setEditorContent(page,correct);
  await page.getByRole('button',{name:'Check Python',exact:true}).click();
  await expect(status(page)).toContainText('Checks passed');
});


test('Firefox graphics limits are explained before any download and unavailable modes are disabled',async({page})=>{
  test.setTimeout(120000);
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,'userAgent',{value:'Mozilla/5.0 Firefox/145.0',configurable:true});
    Object.defineProperty(WebAssembly,'Suspending',{value:undefined,configurable:true});
    Object.defineProperty(navigator,'gpu',{value:{requestAdapter:async()=>({
      features:new Set(['shader-f16']),
      limits:{maxBufferSize:1<<30,maxStorageBufferBindingSize:1<<30,maxComputeWorkgroupStorageSize:32768,maxStorageBuffersPerShaderStage:9},
      requestDevice:async()=>({destroy(){}})
    })},configurable:true});
  });
  const requests=[];page.on('request',r=>{if(r.url().includes('huggingface.co'))requests.push(r.url());});
  await open(page);
  await page.getByText('Model & storage',{exact:true}).click();
  await expect(page.getByText(/Selected: Graphics acceleration \(ONNX\)/)).toBeVisible();
  await expect(page.getByText(/For Firefox graphics, choose Graphics — ONNX/)).toBeVisible();
  const engines=page.getByLabel('Run the model using');
  await expect(engines.locator('option[value="webllm-gpu"]')).toBeDisabled();
  await expect(engines.locator('option[value="wllama-gpu"]')).toBeDisabled();
  await expect(engines.locator('option[value="onnx-gpu"]')).toBeEnabled();
  await expect(engines.locator('option[value="cpu"]')).toBeEnabled();
  expect(requests).toEqual([]);
});
