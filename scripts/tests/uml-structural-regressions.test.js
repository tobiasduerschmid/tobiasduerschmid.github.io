'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { before, after, test } = require('node:test');
const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('../chromium-launch-options');

let browser;
before(async () => { browser = await chromium.launch(chromiumLaunchOptions()); });
after(async () => { if (browser) await browser.close(); });

async function withRenderer(run) {
  const page = await browser.newPage();
  try {
    await page.setContent('<!doctype html><html lang="en"><title>UML structural renderer</title><body><div id="diagram"></div></body></html>');
    await page.addScriptTag({ path: path.join(__dirname, '../../js/ArchUML/uml-bundle.js') });
    await run(page);
  } finally { await page.close(); }
}

test('recursive class associations connect distinct border points and display labels and both multiplicities', async () => {
  await withRenderer(async (page) => {
    const result = await page.evaluate(() => {
      const container = document.getElementById('diagram');
      window.UMLClassDiagram.render(container, 'class Person\nPerson "0..1" -- "*" Person : manages');
      const svg = container.querySelector('svg');
      const route = svg.querySelector('[data-layout-route-id]');
      return { text: svg.textContent, points: route ? [...route.points].map(p => ({x:p.x,y:p.y})) : [] };
    });
    assert.ok(result.points.length >= 4, 'a recursive association needs a visible loop outside the class');
    assert.notDeepEqual(result.points[0], result.points.at(-1), 'the two association ends must be distinct');
    const length = result.points.slice(1).reduce((n,p,i) => n + Math.hypot(p.x-result.points[i].x,p.y-result.points[i].y),0);
    assert.ok(length > 60, 'loop must have space for endpoint markers and a label');
    assert.match(result.text, /manages/);
    assert.match(result.text, /0\.\.1/);
    assert.match(result.text, /\*/);
  });
});

test('class associations retain independent navigation markers at each end', async () => {
  await withRenderer(async (page) => {
    const values = await page.evaluate(() => ['x-->', '<--x', '*x-->', 'o<--x'].map(op => {
      const parsed = window.UMLClassDiagram.parse('class A\nclass B\nA '+op+' B');
      return parsed.relationships[0] || null;
    }));
    for (const [i, pair] of [['non-navigable','navigable'],['navigable','non-navigable'],['non-navigable','navigable'],['navigable','non-navigable']].entries()) {
      assert.ok(values[i], 'mixed navigation markers must parse');
      assert.equal(values[i].fromNavigability,pair[0]);
      assert.equal(values[i].toNavigability,pair[1]);
    }
  });
});

test('a source cross and composition diamond remain separate and readable', async () => {
  await withRenderer(async (page) => {
    const result = await page.evaluate(() => {
      const container=document.getElementById('diagram');
      window.UMLClassDiagram.render(container,'class Folder\nFolder *x--> Folder : children');
      const svg=container.querySelector('svg');
      const diamond=[...svg.querySelectorAll('polygon')].find(el=>el.points.numberOfItems===4);
      const crosses=[...svg.querySelectorAll('line')].filter(el=>Math.abs(el.x1.baseVal.value-el.x2.baseVal.value)>1 && Math.abs(el.y1.baseVal.value-el.y2.baseVal.value)>1);
      const box=el=>{const b=el.getBBox();return {x:b.x,y:b.y,width:b.width,height:b.height};};
      return {diamond:diamond?box(diamond):null,crosses:crosses.map(box)};
    });
    assert.ok(result.diamond,'composition keeps its diamond');
    assert.equal(result.crosses.length,2,'the source end has an explicit X marker');
    const d=result.diamond;
    for(const c of result.crosses) assert.ok(c.x>=d.x+d.width || c.x+c.width<=d.x || c.y>=d.y+d.height || c.y+c.height<=d.y,'the cross must not overlap the diamond');
  });
});

test('deployment declarations retain element kinds, aliases, stereotypes, and forward child references', async () => {
  await withRenderer(async (page) => {
    const result = await page.evaluate(() => window.UMLDeploymentDiagram.parse('App ..> web : <<deploy>>\nnode "Web Server" as web <<device>> {\n artifact "app.war" as App\n component "Application runtime" as Runtime\n}\nartifact "settings.xml" as Config'));
    assert.deepEqual(result.nodes.map(n=>n.name), ['web'], 'a declared artifact must not become an implicit node');
    assert.deepEqual(result.nodes[0].components, ['App','Runtime'], 'legacy child ID list remains available');
    assert.ok(Array.isArray(result.elements), 'typed deployment elements are exposed by the public parser');
    assert.deepEqual(result.elements.map(e=>[e.name,e.label,e.kind,e.parentId,e.stereotype]), [
      ['web','Web Server','node',null,'device'],
      ['App','app.war','artifact','web',''],
      ['Runtime','Application runtime','component','web',''],
      ['Config','settings.xml','artifact',null,''],
    ]);
  });
});

test('deployment names that match texture keywords remain valid identifiers', async () => {
  await withRenderer(async (page) => {
    const result=await page.evaluate(()=>window.UMLDeploymentDiagram.parse('node solid\ncomponent dotted\nartifact striped'));
    assert.deepEqual(result.elements.map(e=>e.name),['solid','dotted','striped']);
    assert.ok(result.elements.every(e=>!e.texture),'a standalone identifier is not an outline style');
  });
});

test('quoted deployment punctuation never splits labels or changes containment', async () => {
  await withRenderer(async (page) => {
    const sources=[
      'node Host {\n artifact "config}.xml" as Config\n component Other\n}',
      'node Host { artifact "part;part.jar" as App; component Runtime }',
      'node "Host {one}" as Host { artifact "the \\"};\\" file" as App; component Runtime }',
    ];
    const results=await page.evaluate(sources=>sources.map(text=>window.UMLDeploymentDiagram.parse(text)),sources);
    assert.deepEqual(results[0].elements.map(e=>[e.name,e.label,e.parentId]),[
      ['Host','Host',null],['Config','config}.xml','Host'],['Other','Other','Host'],
    ]);
    assert.deepEqual(results[1].elements.map(e=>[e.name,e.label,e.parentId]),[
      ['Host','Host',null],['App','part;part.jar','Host'],['Runtime','Runtime','Host'],
    ]);
    assert.deepEqual(results[2].elements.map(e=>[e.name,e.label,e.parentId]),[
      ['Host','Host {one}',null],['App','the "};" file','Host'],['Runtime','Runtime','Host'],
    ]);
  });
});

test('deployment child stereotypes fit inside their rectangles', async () => {
  await withRenderer(async (page) => {
    const result=await page.evaluate(()=>{
      const container=document.getElementById('diagram');
      window.UMLDeploymentDiagram.render(container,'node Host {\n component Runtime <<aDeliberatelyLongRuntimeStereotype>>\n}');
      const svg=container.querySelector('svg');
      const child=svg.querySelector('[data-layout-id="Runtime"]');
      const box=window.UMLShared.renderedLayoutBox(svg,'Runtime');
      const stereotype=[...child.querySelectorAll('text')].find(t=>t.textContent.includes('aDeliberatelyLongRuntimeStereotype'));
      const label=stereotype.getBBox();
      return {box,label:{x:label.x,y:label.y,width:label.width,height:label.height}};
    });
    assert.ok(result.label.x>=result.box.x && result.label.x+result.label.width<=result.box.x+result.box.width+1,'the stereotype must be measured when sizing its child rectangle');
  });
});

test('deployment communication lines preserve arrow semantics and independent dashed styling', async () => {
  await withRenderer(async (page) => {
    const results = await page.evaluate(() => ['--','-->','..>'].flatMap(op => ['', ' dashed'].map(style => {
      const container = document.getElementById('diagram');
      const source = 'node A\nnode B\nA '+op+' B'+style+' : HTTP';
      const parsed = window.UMLDeploymentDiagram.parse(source);
      window.UMLDeploymentDiagram.render(container, source);
      const svg = container.querySelector('svg');
      const route = svg.querySelector('[data-layout-route-id]');
      const openMarkers = [...svg.querySelectorAll('polyline')].filter(el=>!el.hasAttribute('data-layout-route-id') && el.points.numberOfItems===3);
      const filledMarkers = [...svg.querySelectorAll('polygon')].filter(el=>el.points.numberOfItems===3);
      return {op,style,link:parsed.links[0]||null,route:!!route,dash:route?.getAttribute('stroke-dasharray'),openMarkers:openMarkers.length,filledMarkers:filledMarkers.length,text:svg.textContent};
    })));
    for (const result of results) {
      assert.ok(result.link, `${result.op}${result.style} must remain a relationship`);
      assert.equal(result.link.arrow,result.op);
      assert.equal(result.link.dashed,result.op==='..>' || !!result.style);
      assert.ok(result.route, 'each rendered relationship exposes a route');
      assert.equal(!!result.dash,result.link.dashed);
      assert.equal(result.openMarkers,result.op==='--'?0:1,'directed communication uses an open arrowhead');
      assert.equal(result.filledMarkers,0,'communication paths do not use filled triangle arrowheads');
      assert.match(result.text,/HTTP/);
    }
  });
});

test('deployment artifacts have distinct notation and connections terminate on the actual child', async () => {
  await withRenderer(async (page) => {
    const result = await page.evaluate(() => {
      const container = document.getElementById('diagram');
      window.UMLDeploymentDiagram.render(container, 'node "Web Server" as web <<device>> {\n artifact "app.war" as App\n}\nnode DB\nApp ..> DB : reads\nartifact "settings.xml" as Config\nConfig ..> web : <<deploy>>');
      const svg = container.querySelector('svg');
      const box = id=>window.UMLShared.renderedLayoutBox(svg,id);
      const route = svg.querySelector('[data-layout-source="App"]');
      return {text:svg.textContent,app:box('App'),web:box('web'),config:box('Config'),start:route?{x:route.points[0].x,y:route.points[0].y}:null,artifactText:svg.querySelector('[data-layout-id="App"]')?.textContent,configText:svg.querySelector('[data-layout-id="Config"]')?.textContent};
    });
    assert.match(result.text,/Web Server/);
    assert.match(result.text,/«device»/);
    assert.match(result.artifactText||'',/«artifact».*app\.war/s);
    assert.match(result.configText||'',/«artifact».*settings\.xml/s);
    assert.ok(result.app && result.web && result.config,'all deployment elements must have independent selectable geometry');
    assert.ok(result.app.x>result.web.x && result.app.y>result.web.y,'App stays inside its declared node');
    assert.ok(result.start,'child relationships remain visible');
    const p=result.start,b=result.app,tolerance=1;
    const onBorder=((Math.abs(p.x-b.x)<tolerance || Math.abs(p.x-b.x-b.width)<tolerance) && p.y>=b.y && p.y<=b.y+b.height) || ((Math.abs(p.y-b.y)<tolerance || Math.abs(p.y-b.y-b.height)<tolerance) && p.x>=b.x && p.x<=b.x+b.width);
    assert.ok(onBorder,'relationship starts on the artifact border, not on the parent or an invented node');
  });
});

test('standalone deployment artifacts render without requiring a hardware node', async () => {
  await withRenderer(async (page) => {
    await page.evaluate(() => window.UMLDeploymentDiagram.render(document.getElementById('diagram'),'artifact "app.war" as App'));
    assert.equal(await page.locator('#diagram svg').count(),1);
    assert.match(await page.locator('#diagram').textContent(),/«artifact».*app\.war/s);
  });
});

test('deployment labels render at paragraph size and fit their element rectangles', async () => {
  await withRenderer(async (page) => {
    const result=await page.evaluate(()=>{
      const container=document.getElementById('diagram');
      window.UMLDeploymentDiagram.render(container,'node "Web Server" as web <<device>> {\n artifact "configuration.properties" as App\n component Runtime\n}\ncomponent "External application" as External');
      const svg=container.querySelector('svg');
      const texts=[...svg.querySelectorAll('[data-layout-id] text')];
      return {sizes:texts.map(t=>parseFloat(getComputedStyle(t).fontSize)),overflows:texts.filter(t=>{
        const b=t.getBBox(),id=t.closest('[data-layout-id]').getAttribute('data-layout-id');
        const box=window.UMLShared.renderedLayoutBox(svg,id);
        return b.x<box.x || b.x+b.width>box.x+box.width+1 || b.y<box.y || b.y+b.height>box.y+box.height+1;
      }).map(t=>t.textContent)};
    });
    assert.ok(result.sizes.every(n=>n>=20),'deployment element text is at least paragraph size');
    assert.deepEqual(result.overflows,[],'labels fit their element shapes');
  });
});

test('saved deployment node positions carry contained elements and their connector endpoints', async () => {
  await withRenderer(async (page) => {
    const result = await page.evaluate(() => {
      const container = document.getElementById('diagram');
      window.UMLDeploymentDiagram.render(container,'node Host {\n artifact "app.war" as App\n}\nnode DB\nApp --> DB\n@layout schema=1\nnode Host x=400 y=300\n@endlayout');
      const svg=container.querySelector('svg');
      const route=svg.querySelector('[data-layout-source="App"]');
      return {host:window.UMLShared.renderedLayoutBox(svg,'Host'),app:window.UMLShared.renderedLayoutBox(svg,'App'),start:route?{x:route.points[0].x,y:route.points[0].y}:null};
    });
    assert.ok(result.host && result.app && result.start);
    assert.equal(Math.round(result.host.x),400);
    assert.equal(Math.round(result.host.y),300);
    assert.ok(result.app.x>=result.host.x && result.app.y>=result.host.y);
    assert.ok(result.start.x>=result.app.x-1 && result.start.x<=result.app.x+result.app.width+1);
    assert.ok(result.start.y>=result.app.y-1 && result.start.y<=result.app.y+result.app.height+1);
  });
});

test('deployment relationship IDs identify their source lines for visual editing', async () => {
  await withRenderer(async (page) => {
    const ids = await page.evaluate(() => {
      const source='@startuml\nnode A\nnode B\n\nA -- B : first\nA ..> B : second\n@enduml';
      const container=document.getElementById('diagram');
      window.UMLDeploymentDiagram.render(container,source);
      return [...container.querySelectorAll('[data-layout-route-id]')].map(el=>el.getAttribute('data-layout-route-id'));
    });
    assert.deepEqual(ids,['rel:4','rel:5'],'selecting or editing a connector must resolve the correct source statement');
  });
});

test('self inheritance drafts do not prevent class rendering', { timeout: 10000 }, async () => {
  await withRenderer(async (page) => {
    for (const op of ['--|>','..|>']) {
      const result=await page.evaluate(op=>{
        const container=document.getElementById('diagram');
        const source='class Draft\nDraft '+op+' Draft';
        const parsed=window.UMLClassDiagram.parse(source);
        window.UMLClassDiagram.render(container,source);
        return {retained:parsed.relationships.length,svg:!!container.querySelector('svg'),text:container.textContent};
      },op);
      assert.equal(result.retained,1,'invalid drafts remain in the parsed source for correction');
      assert.ok(result.svg,'invalid self inheritance must not crash or hang diagram editing');
      assert.match(result.text,/Draft/);
    }
  });
});

test('deployment rendering exposes aliased elements and containment to assistive technology', async () => {
  await withRenderer(async (page) => {
    await page.addScriptTag({path:path.join(__dirname,'../../js/uml-auto-describe.js')});
    await page.evaluate(()=>{
      const code=document.createElement('code');
      code.className='language-uml-deployment';
      code.textContent='node "Web Server" as web <<device>> {\n artifact "app.war" as App\n}';
      const pre=document.createElement('pre');pre.appendChild(code);
      document.getElementById('diagram').appendChild(pre);
      window.UMLShared.renderAll();
    });
    assert.equal(await page.getByRole('img',{name:/Web Server.*app\.war/}).count(),1);
    const verbose=await page.locator('[data-uml-verbose="true"]').textContent();
    assert.match(verbose,/Web Server.*contains.*app\.war/);
  });
});
