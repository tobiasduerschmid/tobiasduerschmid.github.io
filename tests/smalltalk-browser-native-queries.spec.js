const features = require('./helpers/smalltalk-features');
const { test, expect } = require('@playwright/test');
const { withSmalltalk } = require('./helpers/smalltalk-runtime');
test.setTimeout(180000);
const source = require('node:fs').readFileSync(require('node:path').join(__dirname, 'fixtures/smalltalk/browser-references.st'), 'utf8');
const program = {version:1,stepKey:'references',revision:0,files:[{path:'/references.st',kind:'source',format:'filein',content:source}],changes:{version:1,source:'',entries:[]},runCommand:null};
test('Native variable references follow inherited declarations and actual class-variable bindings', async ({ page }) => {
  const result = await withSmalltalk(page, async (host, program) => {
    const session = await host.openSession('live'); await host.loadProgram(session, program);
    const target = {kind:'class',className:'SEBookReferenceChild',side:'instance'};
    const browse = (kind, extra={}) => host.request(session, 'browse', {kind,target,offset:0,limit:100,...extra}, {expectedRevision:0});
    return {
      variables: await browse('variables'),
      instance: await browse('variableReferences',{variable:{kind:'instance',name:'slot'}}),
      classSlots: await browse('variableReferences',{target:{...target,side:'class'},variable:{kind:'instance',name:'classSlot'}}),
      shared: await browse('variableReferences',{variable:{kind:'class',name:'Shared'}}),
      filtered: await browse('variableReferences',{variable:{kind:'class',name:'Shared'},search:'classShared'}),
    };
  }, program);
  const targets = answer => answer.items.map(item => [item.target.className,item.target.side,item.target.selector]).sort();
  expect(targets(result.instance)).toEqual([['SEBookReferenceBase','instance','baseSlot'],['SEBookReferenceChild','instance','childSlot:']]);
  expect(targets(result.classSlots)).toEqual([['SEBookReferenceBase','class','baseClassSlot'],['SEBookReferenceChild','class','childClassSlot']]);
  expect(targets(result.shared)).toEqual([['SEBookReferenceBase','instance','baseShared'],['SEBookReferenceChild','class','classShared'],['SEBookReferenceChild','instance','childShared']]);
  expect(targets(result.filtered)).toEqual([['SEBookReferenceChild','class','classShared']]);
  expect(result.variables.items.find(item => item.variable?.name === 'slot')).toMatchObject({variable:{kind:'instance',name:'slot'},declaringClass:{className:'SEBookReferenceBase',side:'instance'}});
  expect(result.variables.items.find(item => item.variable?.name === 'Shared')).toMatchObject({variable:{kind:'class',name:'Shared'},declaringClass:{className:'SEBookReferenceBase',side:'instance'}});
  expect(result.instance.scope).toMatch(/SEBookReferenceBase.*hierarchy/);
  expect(result.shared.scope).toMatch(/binding/);
});
module.exports = { referenceProgram: program };

test('An empty package offers native class creation defaults and exports replayable source', async ({ page }) => {
  test.skip(!features.refactorings, 'Native refactorings are deferred; their implementation is retained for future activation.');
  const { installSmalltalk } = require('./helpers/smalltalk-runtime');
  await installSmalltalk(page);
  for (const url of ['/js/smalltalk/workspace.js','/js/smalltalk/refactorings.js']) await page.addScriptTag({url});
  const result = await page.evaluate(async () => {
    const api = window.SEBookSmalltalk;
    const runtime = await api.RuntimeHost.create({manifestURL:'/js/vendor/smalltalk/manifest.json'});
    const workspace = await api.Workspace.create({runtime,program:{version:1,stepKey:'empty',revision:0,files:[],changes:{version:1,source:'',entries:[]},runCommand:null}});
    try {
      const refactorings = api.Refactorings.create(workspace);
      await workspace.commit({baseRevision:0,action:'createPackage',params:{name:'SEBook-New-Package'}});
      const target = {kind:'package',packageName:'SEBook-New-Package'};
      const action = (await refactorings.catalog(target)).find(entry=>entry.action==='addClass');
      const options = Object.fromEntries(action.options.inputs.filter(input=>Object.hasOwn(input,'default')).map(input=>[input.name,input.default]));
      const preview = await refactorings.prepare({action:'addClass',target,options:{...options,newName:'SEBookCreatedInEmptyPackage'}});
      const before = await workspace.evaluate("Smalltalk includesKey: #SEBookCreatedInEmptyPackage");
      await refactorings.apply(preview);
      const accepted = workspace.snapshot();
      const source = await workspace.browse({kind:'source',target:{kind:'class',className:'SEBookCreatedInEmptyPackage',side:'instance'},offset:0,limit:1});
      const replay = await runtime.withFreshSession(async session=>{
        await runtime.loadProgram(session,accepted);
        return runtime.request(session,'evaluate',{source:"SEBookCreatedInEmptyPackage superclass = Object and: [SEBookCreatedInEmptyPackage category = 'SEBook-New-Package']",bindings:'isolated'});
      });
      return {action,before,source,replay,accepted};
    } finally {workspace.dispose();runtime.dispose();}
  });
  expect(result.action.applicable).toBe(true);
  expect(result.action.options.inputs.find(input=>input.name==='superclassName').default).toBe('Object');
  expect(result.action.options.inputs.find(input=>input.name==='category').default).toBe('SEBook-New-Package');
  expect(result.before.value.booleanValue).toBe(false);
  expect(result.source.source).toContain('Object subclass: #SEBookCreatedInEmptyPackage');
  expect(result.replay.error).toBeNull(); expect(result.replay.value.booleanValue).toBe(true);
  expect(result.accepted.changes.source).toContain('SEBook-New-Package');
});
