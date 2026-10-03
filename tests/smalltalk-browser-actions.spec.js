const features = require('./helpers/smalltalk-features');
const {test,expect:standardExpect}=require('@playwright/test');
const expect=standardExpect.configure({timeout:30000});
const {mountSmalltalkFixture,withSmalltalk}=require('./helpers/smalltalk-runtime');
const {a11yCheckpoint}=require('./a11y-helpers');
test.setTimeout(240000);
const emptyProgram={version:1,stepKey:'browser-create',revision:0,files:[],changes:{version:1,source:'',entries:[]},runCommand:null};
async function applyPreview(page) {
  await page.getByRole('button',{name:'Preview refactoring',exact:true}).click();
  await expect(page.getByRole('region',{name:'Native change preview',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Apply refactoring',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Native Smalltalk refactoring',exact:true})).toBeHidden();
}
test('Browser creates a first class in an empty package, adds a method, and removes accepted definitions',async({page})=>{
  test.skip(!features.refactorings, 'Native refactorings are deferred; their implementation is retained for future activation.');
  const cleanup=await mountSmalltalkFixture(page,{program:emptyProgram,views:['browser','refactorings']});
  let accepted;
  try {
    await page.getByRole('button',{name:'Create package',exact:true}).click();
    await page.getByLabel('New package name',{exact:true}).fill('SEBook-Created-Package');
    await page.getByRole('button',{name:'Save package',exact:true}).click();
    await expect(page.getByRole('listbox',{name:'Packages',exact:true})).toHaveValue('SEBook-Created-Package');
    await expect(page.getByRole('listbox',{name:'Classes',exact:true})).toBeDisabled();
    await page.getByRole('button',{name:'Add class',exact:true}).click();
    await expect(page.getByLabel('Superclass name',{exact:true})).toHaveValue('Object');
    await expect(page.getByLabel('Package name',{exact:true})).toHaveValue('SEBook-Created-Package');
    await page.getByLabel('New class name',{exact:true}).fill('SEBookCreatedFromBrowser');
    await a11yCheckpoint(page,'empty-package-create-class',{feature:'smalltalk-browser'});
    await applyPreview(page);
    await expect(page.getByRole('listbox',{name:'Classes',exact:true})).toHaveValue('SEBookCreatedFromBrowser');
    await page.getByRole('button',{name:'Add method',exact:true}).click();
    await page.getByRole('dialog',{name:'Native Smalltalk refactoring',exact:true}).getByRole('textbox',{name:'Method source',exact:true}).fill('sebookBrowserAnswer ^ 42');
    await applyPreview(page);
    await expect(page.getByRole('listbox',{name:'Methods',exact:true})).toHaveValue('sebookBrowserAnswer');
    const live=await page.evaluate(()=>window.smalltalkFixtureWorkspace.evaluate('SEBookCreatedFromBrowser new sebookBrowserAnswer'));
    expect(live.error).toBeNull();expect(live.value.text).toBe('42');
    accepted=await page.evaluate(()=>window.smalltalkFixtureWorkspace.snapshot());
    await page.getByRole('button',{name:'Remove method',exact:true}).click();
    await applyPreview(page);
    await expect(page.getByRole('status',{name:'Compilation status',exact:true})).toContainText('Method removed');
    expect((await page.evaluate(()=>window.smalltalkFixtureWorkspace.evaluate('SEBookCreatedFromBrowser includesSelector: #sebookBrowserAnswer'))).value.booleanValue).toBe(false);
    await page.getByRole('button',{name:'Remove class',exact:true}).click();
    await applyPreview(page);
    await expect(page.getByRole('status',{name:'Compilation status',exact:true})).toContainText('Class removed');
    expect((await page.evaluate(()=>window.smalltalkFixtureWorkspace.evaluate('Smalltalk includesKey: #SEBookCreatedFromBrowser'))).value.booleanValue).toBe(false);
    await a11yCheckpoint(page,'browser-definitions-removed',{feature:'smalltalk-browser'});
  } catch(error) { error.message += '\nBrowser state: ' + await page.getByRole('region',{name:'Smalltalk System Browser',exact:true}).innerText(); throw error; } finally {await cleanup();}
  const replay=await withSmalltalk(page,async(host,accepted)=>host.withFreshSession(async session=>{
    await host.loadProgram(session,accepted);return host.request(session,'evaluate',{source:"SEBookCreatedFromBrowser new sebookBrowserAnswer = 42 and: [SEBookCreatedFromBrowser category = 'SEBook-Created-Package']",bindings:'isolated'});
  }),accepted);
  expect(replay.error).toBeNull();expect(replay.value.booleanValue).toBe(true);
});

test('Printed Browser source is exposed once while the editing control is hidden',async({page,browserName})=>{
  await page.goto('/robots.txt');await page.setContent('<!doctype html><html lang="en"><head><title>Browser print fixture</title></head><body><main><h1>Print Browser</h1><div id="root"></div></main></body></html>');
  for(const url of ['/css/smalltalk-browser.css','/css/print-light.css']) await page.addStyleTag({url});
  for(const url of ['/js/smalltalk/protocol.js','/js/smalltalk/workspace.js','/js/smalltalk/source-views.js','/js/smalltalk/browser.js']) await page.addScriptTag({url});
  await page.evaluate(async()=>{
    const workspace={snapshot:()=>({revision:0,files:[],changes:{source:'',entries:[]}}),getDrafts:()=>[],subscribe:()=>()=>{},browse:async query=>({revision:0,items:[],nextOffset:null,...(query.kind==='source'?{source:'printedAnswer ^ 42'}:{})})};
    const browser=window.SEBookSmalltalk.Browser.mount({root:document.getElementById('root'),workspace,createEditor({element,value,ariaLabel}){const input=document.createElement('textarea');input.value=value;input.setAttribute('aria-label',ariaLabel);element.append(input);return{getValue:()=>input.value,setValue:value=>{input.value=value;},dispose:()=>input.remove()};}});
    await browser.ready;await browser.navigate({kind:'method',className:'PrintCounter',side:'instance',selector:'printedAnswer',packageName:'Print-Example'});
  });
  await page.evaluate(()=>document.documentElement.classList.add('dark-mode'));
  await page.emulateMedia({media:'print'});
  await expect(page.getByRole('textbox',{name:'Smalltalk method source',includeHidden:true})).toBeHidden();
  const source=page.getByText('printedAnswer ^ 42',{exact:true}).filter({visible:true});
  await expect(source).toHaveCount(1);await expect(source).toMatchAriaSnapshot('- text: printedAnswer ^ 42');
  const colors = await source.evaluate(node => {
    let surface = node;
    while (surface.parentElement && getComputedStyle(surface).backgroundColor === 'rgba(0, 0, 0, 0)') surface = surface.parentElement;
    return [getComputedStyle(node).color, getComputedStyle(surface).backgroundColor];
  });
  expect(colors[0].match(/\d+/g).map(Number).every(channel => channel < 60)).toBe(true);
  expect(colors[1]).toBe('rgb(255, 255, 255)');
  if(browserName==='chromium') {const session=await page.context().newCDPSession(page);try{const tree=await session.send('Accessibility.getFullAXTree');expect(tree.nodes.filter(node=>!node.ignored&&node.role?.value==='StaticText'&&node.name?.value==='printedAnswer ^ 42')).toHaveLength(1);}finally{await session.detach();}}
});


test('Native Browser variable references navigate inherited methods and both method sides', async ({page}) => {
  const content = require('node:fs').readFileSync(require('node:path').join(__dirname,'fixtures/smalltalk/browser-references.st'),'utf8');
  const program = {...emptyProgram,files:[{path:'/references.st',kind:'source',format:'filein',content}]};
  const cleanup = await mountSmalltalkFixture(page,{program,views:['browser']});
  try {
    await page.getByLabel('Search packages',{exact:true}).fill('SEBook-Reference-Tests');
    await page.getByRole('region',{name:'Packages',exact:true}).getByRole('button',{name:'Search',exact:true}).click();
    await page.getByRole('listbox',{name:'Packages',exact:true}).selectOption({label:'SEBook-Reference-Tests'});
    await page.getByRole('listbox',{name:'Classes',exact:true}).selectOption({label:'SEBookReferenceChild'});
    await page.getByText('More browsing queries',{exact:true}).click();
    await page.getByRole('button',{name:'Variable references',exact:true}).click();
    const results=page.getByRole('region',{name:'Native query results',exact:true});
    await results.getByRole('button',{name:'References to slot (instance)',exact:true}).click();
    await expect(results).toContainText('SEBookReferenceBase declaration hierarchy');
    await expect(results.getByRole('button',{name:'SEBookReferenceOther>>otherSlot',exact:true})).toHaveCount(0);
    await results.getByRole('button',{name:'SEBookReferenceChild>>childSlot:',exact:true}).click();
    await expect(page.getByRole('listbox',{name:'Methods',exact:true})).toHaveValue('childSlot:');
    await expect(page.getByRole('region',{name:'Method source',exact:true})).toContainText('slot := value');
    await page.getByRole('button',{name:'Back',exact:true}).click();
    await expect(page.getByRole('region',{name:'Method source',exact:true})).toContainText('SEBookReferenceBase subclass: #SEBookReferenceChild');
    await page.getByRole('button',{name:'Forward',exact:true}).click();
    await expect(page.getByRole('listbox',{name:'Methods',exact:true})).toHaveValue('childSlot:');
    await page.getByRole('button',{name:'Variable references',exact:true}).click();
    await results.getByRole('button',{name:'References to Shared (class)',exact:true}).click();
    await expect(results).toContainText('SEBookReferenceBase binding');
    await results.getByRole('button',{name:'SEBookReferenceChild class>>classShared',exact:true}).click();
    await expect(page.getByRole('radio',{name:'Class',exact:true})).toBeChecked();
    await expect(page.getByRole('listbox',{name:'Protocols',exact:true})).toHaveValue('accessing');
    await expect(page.getByRole('listbox',{name:'Methods',exact:true})).toHaveValue('classShared');
    await expect(page.getByRole('region',{name:'Method source',exact:true})).toContainText('classShared ^ Shared');
    await a11yCheckpoint(page,'inherited-variable-references',{feature:'smalltalk-browser'});
  } catch(error) { error.message += '\nBrowser state: ' + await page.getByRole('region',{name:'Smalltalk System Browser',exact:true}).innerText(); throw error; } finally {await cleanup();}
});

test('Native Senders and Hierarchy journeys preserve class definitions, comments, and history', async ({page}) => {
  const content=require('node:fs').readFileSync(require('node:path').join(__dirname,'fixtures/smalltalk/browser-references.st'),'utf8');
  const cleanup=await mountSmalltalkFixture(page,{program:{...emptyProgram,files:[{path:'/references.st',kind:'source',format:'filein',content}]},views:['browser']});
  try {
    await page.evaluate(()=>window.smalltalkFixtureBrowser.navigate({kind:'method',className:'SEBookReferenceBase',side:'instance',selector:'baseSlot'}));
    await page.getByRole('button',{name:'Senders',exact:true}).click();
    const results=page.getByRole('region',{name:'Native query results',exact:true});
    await expect(results.getByRole('status',{name:'Query status',exact:true})).toContainText('results on this page.');
    await results.getByRole('button',{name:'SEBookReferenceChild>>readBase',exact:true}).click();
    await expect(page.getByRole('region',{name:'Method source',exact:true})).toContainText('readBase ^ self baseSlot');
    await page.getByText('More browsing queries',{exact:true}).click();
    await page.getByRole('button',{name:'Hierarchy',exact:true}).click();
    await results.getByRole('button',{name:'SEBookReferenceBase',exact:true}).click();
    await expect(page.getByRole('region',{name:'Method source',exact:true})).toContainText('Object subclass: #SEBookReferenceBase');
    await page.getByRole('button',{name:'Back',exact:true}).click();
    await expect(page.getByRole('listbox',{name:'Methods',exact:true})).toHaveValue('readBase');
    await page.getByRole('button',{name:'Class comment',exact:true}).click();
    await expect(page.getByRole('region',{name:'Method source',exact:true})).toContainText('A child for native Browser navigation.');
    await page.getByRole('button',{name:'Class definition',exact:true}).click();
    await expect(page.getByRole('region',{name:'Method source',exact:true})).toContainText('SEBookReferenceBase subclass: #SEBookReferenceChild');
    await page.getByRole('radio',{name:'Class',exact:true}).check();
    await page.getByRole('listbox',{name:'Methods',exact:true}).selectOption({label:'classShared'});
    await expect(page.getByRole('region',{name:'Method source',exact:true})).toContainText('classShared ^ Shared');
  } catch(error) { error.message += '\nBrowser state: ' + await page.getByRole('region',{name:'Smalltalk System Browser',exact:true}).innerText(); throw error; } finally {await cleanup();}
});

test('Refactoring inputs use native defaults while explicit empty and false options take precedence',async({page})=>{
  test.skip(!features.refactorings, 'Native refactorings are deferred; their implementation is retained for future activation.');
  await page.goto('/robots.txt');await page.setContent('<!doctype html><html lang="en"><head><title>Native catalog defaults</title></head><body><main><h1>Native catalog defaults</h1><div id="root"></div></main></body></html>');
  for(const url of ['/js/smalltalk/protocol.js','/js/smalltalk/refactoring-view.js']) await page.addScriptTag({url});
  await page.evaluate(async()=>{
    const workspace={snapshot:()=>({revision:0}),subscribe:()=>()=>{}};
    const inputs=[{name:'text',label:'Text parameter',type:'text',required:false,default:'native text'},
      {name:'flag',label:'Boolean parameter',type:'boolean',required:true,default:true},
      {name:'list',label:'List parameter',type:'string-list',required:true,default:['native entry']}];
    const refactorings={historyState:()=>({canUndo:false,canRedo:false}),catalog:async()=>[{action:'example',label:'Example native action',applicable:true,options:{inputs}}]};
    const view=window.SEBookSmalltalk.RefactoringView.mount({root:document.getElementById('root'),workspace,refactorings});
    window.openDefaultFixture=options=>view.open({action:'example',target:{kind:'class',className:'Example',side:'instance'},options});
    await window.openDefaultFixture({});
  });
  await expect(page.getByLabel('Text parameter',{exact:true})).toHaveValue('native text');
  await expect(page.getByLabel('Boolean parameter',{exact:true})).toBeChecked();
  await expect(page.getByLabel('List parameter',{exact:true})).toHaveValue('native entry');
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.evaluate(()=>window.openDefaultFixture({text:'',flag:false,list:[]}));
  await expect(page.getByLabel('Text parameter',{exact:true})).toHaveValue('');
  await expect(page.getByLabel('Boolean parameter',{exact:true})).not.toBeChecked();
  await expect(page.getByLabel('List parameter',{exact:true})).toHaveValue('');
});

async function mountPackagePresentation(page, withDeferredFacade = false) {
  await page.goto('/robots.txt');
  await page.setContent('<!doctype html><html lang="en"><head><title>Package focus</title></head><body><main><h1>Package focus</h1><button type="button">Outside Browser</button><div id="root"></div></main></body></html>');
  for(const url of ['/js/smalltalk/protocol.js','/js/smalltalk/workspace.js','/js/smalltalk/source-views.js','/js/smalltalk/browser.js']) await page.addScriptTag({url});
  // Only completion timing is controlled here; native creation/replay has separate real-image coverage.
  await page.evaluate(async withDeferredFacade=>{
    const workspace={snapshot:()=>({revision:0,files:[],changes:{source:'',entries:[]}}),getDrafts:()=>[],subscribe:()=>()=>{},
      browse:async()=>({revision:0,items:[],nextOffset:null}),commit:()=>new Promise(resolve=>{window.finishPackageCreation=resolve;})};
    const browser=window.SEBookSmalltalk.Browser.mount({root:document.getElementById('root'),workspace,...(withDeferredFacade ? {refactorings:{}} : {}),
      createEditor({element,value,ariaLabel}){const input=document.createElement('textarea');input.value=value;input.setAttribute('aria-label',ariaLabel);element.append(input);return{getValue:()=>input.value,setValue:value=>{input.value=value;},dispose:()=>input.remove()};}});
    await browser.ready;
  }, withDeferredFacade);
}

test('Deferred refactorings leave ordinary Browser controls available without mounting history',async({page})=>{
  test.skip(features.refactorings, 'This checks the deferred capability presentation.');
  // No RefactoringView is loaded: even a supplied facade must remain unused.
  await mountPackagePresentation(page, true);
  for(const name of ['Refactor','Add class','Add method','Remove class','Remove method','Undo refactoring','Redo refactoring']) {
    await expect(page.getByRole('button',{name,exact:true})).toHaveCount(0);
  }
  await expect(page.getByRole('region',{name:'Native refactoring history',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Create package',exact:true})).toBeEnabled();
  await expect(page.getByRole('button',{name:'Accept',exact:true})).toBeVisible();
  await page.getByText('More browsing queries',{exact:true}).click();
  await expect(page.getByRole('button',{name:'Versions',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Variable references',exact:true})).toBeVisible();
});

test('Package creation completion preserves keyboard focus moved outside the Browser',async({page})=>{
  await mountPackagePresentation(page);
  await page.getByRole('button',{name:'Create package',exact:true}).click();
  await page.getByLabel('New package name',{exact:true}).fill('SEBook-Focus');
  await page.getByRole('button',{name:'Save package',exact:true}).click();
  const outside=page.getByRole('button',{name:'Outside Browser',exact:true});await outside.focus();
  await page.evaluate(()=>window.finishPackageCreation());
  await expect(page.getByRole('status',{name:'Compilation status',exact:true})).toContainText('Package created');
  await expect(outside).toBeFocused();
});


test('Package creation returns focus to its trigger when the form still owns focus',async({page})=>{
  await mountPackagePresentation(page);
  await page.getByRole('button',{name:'Create package',exact:true}).click();
  await page.getByLabel('New package name',{exact:true}).fill('SEBook-Focus');
  await page.getByRole('button',{name:'Save package',exact:true}).click();
  await page.evaluate(()=>window.finishPackageCreation());
  await expect(page.getByRole('status',{name:'Compilation status',exact:true})).toContainText('Package created');
  await expect(page.getByRole('button',{name:'Create package',exact:true})).toBeFocused();
});

test('Browser creates an ordinary package that survives accepted-source replay',async({page})=>{
  const cleanup=await mountSmalltalkFixture(page,{program:emptyProgram,views:['browser']});
  let accepted;
  try {
    await page.getByRole('button',{name:'Create package',exact:true}).click();
    await page.getByLabel('New package name',{exact:true}).fill('SEBook-Ordinary-Package');
    await page.getByRole('button',{name:'Save package',exact:true}).click();
    await expect(page.getByRole('status',{name:'Compilation status',exact:true})).toHaveText('Package created.');
    await expect(page.getByRole('listbox',{name:'Packages',exact:true})).toHaveValue('SEBook-Ordinary-Package');
    await expect(page.getByRole('listbox',{name:'Classes',exact:true})).toBeDisabled();
    accepted=await page.evaluate(()=>window.smalltalkFixtureWorkspace.snapshot());
    expect(accepted.revision).toBe(1);
    await a11yCheckpoint(page,'ordinary-package-created',{feature:'smalltalk-browser'});
  } finally {await cleanup();}
  const replay=await withSmalltalk(page,async(host,accepted)=>host.withFreshSession(async session=>{
    await host.loadProgram(session,accepted);
    return host.request(session,'browse',{kind:'packages',search:'SEBook-Ordinary-Package',offset:0,limit:100});
  }),accepted);
  expect(replay.items.map(item=>item.target)).toEqual([{kind:'package',packageName:'SEBook-Ordinary-Package'}]);
});
