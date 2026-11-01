// @ts-check
const {test,expect}=require('@playwright/test');
const {auditInteractiveState}=require('./a11y-helpers');

test.setTimeout(90000);
const tutorialURL='/SEBook/tools/python-specification-tutorial';
const assistant=page=>page.getByRole('region',{name:'Specification assistant',exact:true});

async function waitForAssistant(page) {
  await expect(page.getByRole('heading',{name:'Specification assistant',exact:true})).toBeVisible({timeout:60000});
  await expect(assistant(page).getByRole('button',{name:'Download model',exact:true})).toBeEnabled({timeout:15000});
}

async function open(page,buffers=10) {
  const requests=[],errors=[];
  page.on('request',request=>{if(request.url().includes('huggingface.co'))requests.push(request.url());});
  page.on('pageerror',error=>errors.push(error.message));
  // The browser's graphics API is the external boundary. No inference is faked.
  await page.addInitScript(buffers=>{
    Object.defineProperty(navigator,'deviceMemory',{configurable:true,value:8});
    Object.defineProperty(navigator,'gpu',{configurable:true,value:{requestAdapter:async()=>({
      features:new Set(['shader-f16']),
      limits:{maxBufferSize:1073741824,maxStorageBufferBindingSize:1073741824,
        maxStorageBuffersPerShaderStage:buffers,maxComputeWorkgroupStorageSize:32768},
      requestDevice:async()=>({destroy(){}})
    })}});
  },buffers);
  // An unexpected download fails locally instead of fetching gigabytes in a test.
  await page.route('https://huggingface.co/**',route=>route.abort());
  await page.goto(tutorialURL);
  await waitForAssistant(page);
  await assistant(page).getByText('Model & storage',{exact:true}).press('Enter');
  return {requests,errors};
}

test('7B explains its download and memory requirements and needs explicit opt-in even when the browser reports 8 GB',async({page})=>{
  await page.setViewportSize({width:320,height:900});
  const {requests,errors}=await open(page);
  const model=page.getByLabel('Model size',{exact:true});
  const download=assistant(page).getByRole('button',{name:'Download model',exact:true});
  await expect(model).toHaveValue('3b');
  await model.selectOption('7b');
  await expect(assistant(page).getByText(/Model download: 4\.29 GB/)).toBeVisible();
  await expect(assistant(page).getByText(/at least 16 GB.*about 6 GB/)).toBeVisible();
  await expect(download).toBeDisabled();
  await expect(page.getByLabel('Run the model using').getByRole('option',{name:'Processor — broad compatibility'})).toBeDisabled();
  const memory=page.getByLabel('Device memory for 7B',{exact:true});
  await memory.selectOption('16');
  await expect(download).toBeEnabled();
  await memory.focus();
  await expect(memory).toBeFocused();
  expect(await memory.evaluate(element=>parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
  expect(await assistant(page).evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
  await auditInteractiveState(page,'Optional 7B model controls',{include:'[aria-labelledby="tutorial-llm-heading"]'});
  expect(requests).toEqual([]);
  await page.reload();
  await waitForAssistant(page);
  await assistant(page).getByText('Model & storage',{exact:true}).press('Enter');
  await expect(model).toHaveValue('3b');
  await model.selectOption('7b');
  await expect(memory).toHaveValue('');
  await expect(download).toBeDisabled();
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});

test('a nine-buffer browser explains the 7B incompatibility and can return to 3B',async({page})=>{
  const {requests,errors}=await open(page,9);
  const model=page.getByLabel('Model size',{exact:true});
  await model.selectOption('7b');
  await expect(assistant(page).getByRole('status')).toContainText('allows 9 storage buffers');
  await expect(assistant(page).getByRole('status')).toContainText('requires 10');
  await page.getByLabel('Device memory for 7B',{exact:true}).selectOption('16');
  await expect(assistant(page).getByRole('button',{name:'Download model',exact:true})).toBeDisabled();
  await model.selectOption('3b');
  await expect(assistant(page).getByRole('button',{name:'Download model',exact:true})).toBeEnabled();
  await expect(page.getByLabel('Run the model using').getByRole('option',{name:'Processor — broad compatibility'})).toBeEnabled();
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});

test('a 7B download reports its size, can be cancelled, and deletes its partial files without losing the specification',async({page})=>{
  const {errors}=await open(page);
  const specification=page.getByLabel('Your specification',{exact:true});
  await specification.fill('Keep my specification while I manage the optional model.');
  await page.getByLabel('Model size',{exact:true}).selectOption('7b');
  await page.getByLabel('Device memory for 7B',{exact:true}).selectOption('16');
  let releaseResponse;
  const heldResponse=new Promise(resolve=>{releaseResponse=resolve;});
  const config=await page.evaluate(async()=>{
    const {ARTIFACTS}=await import('/js/browser-llm/catalog.mjs');
    return ARTIFACTS.mlc7b.assets.find(asset=>asset.url.endsWith('/mlc-chat-config.json'));
  });
  // Finish one tiny file, then hold the next remote response until cancellation.
  // No model weights or inference runtime are downloaded.
  await page.route('https://huggingface.co/mlc-ai/Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC/**',async route=>{
    if(route.request().url()===config.url) {
      await route.fulfill({body:' '.repeat(config.bytes),contentType:'application/json'});
    } else {
      await heldResponse;
      await route.abort().catch(()=>{});
    }
  });
  try {
    await assistant(page).getByRole('button',{name:'Download model',exact:true}).click();
    const progress=page.getByRole('progressbar',{name:'Model download',exact:true});
    await expect(progress).toHaveAttribute('max','4291435425');
    await expect(progress).toHaveAttribute('value',String(config.bytes));
    await assistant(page).getByRole('button',{name:'Cancel',exact:true}).click();
    releaseResponse();
    await expect(assistant(page).getByRole('status')).toContainText('Cancelled');
    await expect(progress).toBeHidden();
    await expect(assistant(page).getByRole('button',{name:'Download model',exact:true})).toBeEnabled();
    expect(await page.evaluate(async config=>!!await caches.match(config.url,{cacheName:config.cache}),config)).toBe(true);
    await assistant(page).getByRole('button',{name:'Delete downloaded model',exact:true}).click();
    await expect(assistant(page).getByRole('status')).toContainText('Downloaded model deleted');
    expect(await page.evaluate(async config=>!!await caches.match(config.url,{cacheName:config.cache}),config)).toBe(false);
    await expect(specification).toHaveValue('Keep my specification while I manage the optional model.');
    expect(errors).toEqual([]);
  } finally {releaseResponse();}
});
