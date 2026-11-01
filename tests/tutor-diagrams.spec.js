const {test,expect}=require('@playwright/test');
const {auditInteractiveState}=require('./a11y-helpers');
const URL='/SEBook/tools/python-specification-tutorial/';
const examples={
  class:'class Catalog\nclass Item\nCatalog --> Item : contains',
  sequence:'participant student: Student\nparticipant tutor: Tutor\nstudent -> tutor: ask',
  state:'[*] --> Ready\nReady --> Done : finish\nDone --> [*]',
  activity:'(*) --> "Read input"\n"Read input" --> "Check input"\n"Check input" --> (*)',
  component:'component Client\ncomponent Service\nClient --> Service : request',
  deployment:'node Client\nnode Server\nClient --> Server : request',
  usecase:'actor Student\nusecase "Ask question" as Ask\nStudent --> Ask'
};

async function openChat(page,reply) {
  await page.goto(URL);
  await expect(page.getByText('AI tutor',{exact:true})).toBeVisible({timeout:90000});
  // A deterministic model-output boundary: real chat UI, worker, ArchUML,
  // sanitizer, accessibility and styles, without downloading model weights.
  await page.evaluate(async reply=>{
    const {renderTutorReply}=await import('/js/browser-llm/tutor-diagrams.mjs');
    window._tutorial.llmAddon.chat.destroy();
    window.diagramChat=TutorChat.createLocal(document.querySelector('.tutorial-llm'),async()=>reply,()=>{},renderTutorReply);
  },reply);
  await page.getByText('AI tutor',{exact:true}).click();
  await page.getByLabel('Ask the AI tutor').fill('Explain this with a diagram');
  await page.getByRole('button',{name:'Send',exact:true}).click();
  await expect(page.getByRole('button',{name:'Send',exact:true})).toBeEnabled();
}

for(const [type,source] of Object.entries(examples)) {
  test(`tutor renders an accessible ${type} diagram and preserves source`,async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await openChat(page,'Follow the labeled relationship.\n```uml-'+type+'\n@startuml\n'+source+'\n@enduml\n```');
    const diagram=page.locator('.tvm-tutor-diagram-canvas');
    await expect(diagram.locator('svg')).toBeVisible();
    await expect(diagram).toHaveAttribute('aria-label',new RegExp(type==='usecase'?'use case':type,'i'));
    await page.getByText('Diagram source (ArchUML)',{exact:true}).press('Enter');
    await expect(page.locator('.tvm-tutor-diagram pre')).toContainText(source);
    expect(errors).toEqual([]);
  });
}

test('a found message renders with an accessible external-sender description',async({page})=>{
  const source='@startuml\nparticipant rover: navigate\no-> rover: navigate(commands)\n@enduml';
  await openChat(page,'```uml-sequence\n'+source+'\n```');
  const diagram=page.getByRole('log').getByRole('img',{name:/sequence diagram/i});
  await expect(diagram).toBeVisible();
  await expect(diagram).toHaveAttribute('aria-label',/found message from outside the diagram to rover/i);
  await page.getByText('Diagram source (ArchUML)',{exact:true}).press('Enter');
  await expect(page.getByRole('log').getByText(source,{exact:true})).toBeVisible();
});

test('diagrams remain readable in both themes and narrow panes',async({page})=>{
  await openChat(page,'A request passes from Client to Service.\n```uml-component\n@startuml\n'+examples.component+'\n@enduml\n```');
  for(const dark of [false,true]) {
    const toggle=page.getByLabel('Toggle dark mode');
    if(await toggle.isChecked()!==dark) await toggle.press('Space');
    await expect(page.locator('.tutorial-llm')).toHaveCSS('background-color',dark?'rgb(32, 38, 46)':'rgb(255, 255, 255)');
    await auditInteractiveState(page,'Tutor diagram '+(dark?'dark':'light'),{include:'.tutorial-llm'});
  }
  await page.setViewportSize({width:390,height:844});
  const diagram=page.locator('.tvm-tutor-diagram-canvas');
  await expect(diagram.locator('svg')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  const svg=diagram.locator('svg');
  const fontSize=await svg.locator('text').first().evaluate(el=>{
    const scale=el.getScreenCTM().a;
    return parseFloat(getComputedStyle(el).fontSize)*scale;
  });
  expect(fontSize).toBeGreaterThanOrEqual(16);
});

test('invalid diagrams retain explanation and source without running markup',async({page})=>{
  await openChat(page,'<img src=x onerror="window.injected=true">\n```uml-class\n@startuml\nnot a diagram\n@enduml\n```');
  await expect(page.getByRole('log')).toContainText('Diagram unavailable');
  await expect(page.getByRole('log')).toContainText('<img src=x');
  await expect(page.getByRole('log').locator('img')).toHaveCount(0);
  expect(await page.evaluate(()=>window.injected)).toBeUndefined();
  await expect(page.locator('.tvm-tutor-diagram pre')).toBeVisible();
});

test('SVG sanitization drops executable content and external resources',async({page})=>{
  await page.goto(URL);
  await expect(page.getByText('AI tutor',{exact:true})).toBeVisible({timeout:90000});
  const result=await page.evaluate(async()=>{
    const {sanitizedDiagram}=await import('/js/browser-llm/tutor-diagrams.mjs');
    const fragment=sanitizedDiagram('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><foreignObject>Bad</foreignObject><image href="https://example.com/a"/><a href="javascript:alert(1)"><text>Safe label</text></a><text>Kept text</text></svg>',DOMPurify);
    const host=document.createElement('div');host.append(fragment);
    return host.innerHTML;
  });
  expect(result).toContain('Kept text');
  expect(result).not.toMatch(/script|onload|foreignObject|<image|href=/i);
});

for(const fenced of [true,false]) {
  test(`reported class reply renders ${fenced?'with a generic UML fence':'without a fence'}`,async({page})=>{
    const source='@startuml\nclass A {\n +unique_in_order(items: List[int]) → List[int]\n}\nclass B {\n +remove_repeated_values(items: list[int]) → list[int]\n}\nA → B : remove_repeated_values\n@enduml';
    await openChat(page,'Explanation.\n'+(fenced?'```uml\n'+source+'\n```':source)+'\n**Takeaway:** Follow the relationship.');
    await expect(page.locator('.tvm-tutor-diagram-canvas svg')).toBeVisible();
    await expect(page.locator('.tvm-tutor-diagram-canvas')).toHaveAttribute('aria-label',/A.*B/);
    await expect(page.getByRole('log')).toContainText('Takeaway');
  });
}

test('a drawing request runs a separate generation and renders its result without tool JSON',async({page})=>{
  await page.goto(URL);
  await expect(page.getByText('AI tutor',{exact:true})).toBeVisible({timeout:90000});
  await page.evaluate(()=>{
    const addon=window._tutorial.llmAddon;
    addon.plan.cached=true;window.modelRequests=[];
    // Only inference is controlled; production prompt construction, tool dispatch,
    // chat lifecycle, diagram renderer and sanitizer all run normally.
    addon.runtime.generate=async(messages)=>{
      window.modelRequests.push(messages);
      return {finishReason:'stop',text:window.modelRequests.length===1
        ? '```tutor-tool\n{"tool":"draw_diagram","type":"activity","focus":"the source-reading steps identified by the learner"}\n```'
        : '```uml-activity\n@startuml\n(*) --> "Inspect unique_in_order"\n"Inspect unique_in_order" --> "Compare prediction"\n"Compare prediction" --> (*)\n@enduml\n```'};
    };
  });
  await page.getByText('AI tutor',{exact:true}).click();
  await page.getByLabel('Ask the AI tutor').fill('Draw the two source-reading steps I identified.');
  await page.getByRole('button',{name:'Send',exact:true}).click();
  await expect(page.getByRole('button',{name:'Send',exact:true})).toBeEnabled();
  await expect(page.locator('.tvm-tutor-diagram-canvas svg')).toBeVisible();
  await expect(page.getByRole('log')).not.toContainText('tutor-tool');
  const requests=await page.evaluate(()=>window.modelRequests);
  expect(requests).toHaveLength(2);
  expect(requests[0][0].content).not.toContain('@startuml');
  expect(requests[1][0].content).toContain('uml-activity');
});

test('Stop reply cancels a pending drawing generation and suppresses its late result',async({page})=>{
  await page.goto(URL);
  await expect(page.getByText('AI tutor',{exact:true})).toBeVisible({timeout:90000});
  await page.evaluate(()=>{
    const addon=window._tutorial.llmAddon;addon.plan.cached=true;let calls=0;
    addon.runtime.generate=async()=>{
      if(calls++)return new Promise(resolve=>{window.finishDrawing=resolve;});
      return {finishReason:'stop',text:'Which relationship would you check?\n```tutor-tool\n{"tool":"draw_diagram","type":"activity","focus":"the learner observation"}\n```'};
    };
  });
  await page.getByText('AI tutor',{exact:true}).click();
  await page.getByLabel('Ask the AI tutor').fill('Can you draw the relationship I found?');
  await page.getByRole('button',{name:'Send',exact:true}).click();
  await expect(page.locator('.tvm-tutor-local').getByRole('status')).toContainText('separate local generation');
  await page.getByRole('button',{name:'Stop reply',exact:true}).click();
  await page.evaluate(()=>window.finishDrawing({finishReason:'stop',text:'STALE DRAWING'}));
  await expect(page.getByRole('log')).not.toContainText('STALE');
  await expect(page.getByRole('log')).not.toContainText('Which relationship would you check?');
  await expect(page.getByLabel('Ask the AI tutor')).toBeEnabled();
});
