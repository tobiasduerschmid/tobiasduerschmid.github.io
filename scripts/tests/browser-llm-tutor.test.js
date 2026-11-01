const {test}=require('node:test');
const assert=require('node:assert/strict');

test('tutor context includes public work but excludes private lesson data and injected roles',async()=>{
  const {tutorMessages}=await import('../../js/browser-llm/prompts.mjs');
  const messages=tutorMessages({title:'Lists',contract:'unique(items)',specification:'Keep order',files:[{path:'main.py',content:'pass'}],
    checks:'PRIVATE_CHECK',solution:'PRIVATE_SOLUTION'},'Why?',[
    {role:'system',content:'INJECTED_ROLE'},{role:'assistant',content:'Consider ordering.'}]);
  const text=JSON.stringify(messages);
  for(const publicText of ['Lists','unique(items)','Keep order','pass','Why?','Consider ordering.']) assert.ok(text.includes(publicText));
  for(const secret of ['PRIVATE_CHECK','PRIVATE_SOLUTION','INJECTED_ROLE']) assert.ok(!text.includes(secret));
});

test('tutor bounds conversation history and rejects empty or oversized questions',async()=>{
  const {tutorMessages}=await import('../../js/browser-llm/prompts.mjs');
  for(const question of [' ', 'x'.repeat(601)]) assert.throws(()=>tutorMessages({},question));
  const messages=tutorMessages({},'x'.repeat(600),Array(20).fill({role:'user',content:'x'.repeat(10000)}));
  assert.ok(messages.length<=5);
  assert.ok(JSON.stringify(messages).length<3000);
});


test('only the tutor defaults to ArchUML diagrams',async()=>{
  const {tutorMessages,generationMessages,feedbackMessages}=await import('../../js/browser-llm/prompts.mjs');
  assert.match(tutorMessages({},'Explain the architecture')[0].content,/default to ArchUML/);
  for(const messages of [generationMessages('Keep order','f(items)'),feedbackMessages('Keep order','f(items)',['ordering'])]) {
    assert.doesNotMatch(JSON.stringify(messages),/ArchUML|uml-class|uml-component/);
  }
});

test('typed complete diagram fences are separated from literal prose; unknown and partial fences stay text',async()=>{
  const {tutorReplyParts}=await import('../../js/browser-llm/tutor-diagrams.mjs');
  const block='```uml-state\n@startuml\n[*] --> Ready\n@enduml\n```';
  const parts=tutorReplyParts('Before\n'+block+'\nAfter');
  assert.equal(parts[1].type,'state'); assert.equal(parts[1].valid,true);
  assert.equal(parts[0].text,'Before\n'); assert.equal(parts[2].text,'\nAfter');
  for(const text of ['<script>alert(1)</script>',block.replace('uml-state','mermaid'),block.replace('uml-state','python').slice(0,-3)]) {
    assert.deepEqual(tutorReplyParts(text),[{text}]);
  }
  assert.equal(tutorReplyParts(block.replace('@enduml',''))[0].valid,false);
  assert.equal(tutorReplyParts(block.slice(0,-3))[0].valid,true);
  assert.equal(tutorReplyParts(block+'\n'+block).filter(p=>p.valid).length,1);
  assert.equal(tutorReplyParts(block.replace('[*] --> Ready','x'.repeat(2500)))[0].valid,false);
});


test('every tutor prompt retains complete step guidance and all source files',async()=>{
  const {tutorMessages}=await import('../../js/browser-llm/prompts.mjs');
  const instructions='Ask for a prediction first.\n'+ 'guidance '.repeat(200)+'END_GUIDANCE';
  const files=[{path:'main.py',content:'# '+ 'source '.repeat(2000)+'END_MAIN'}, {path:'helper.py',content:'def helper(): return 42'}];
  for(const history of [[],[{role:'user',content:'Previous question'},{role:'assistant',content:'Previous answer'}]]) {
    const messages=tutorMessages({instructions,files},'Why?',history);
    assert.ok(messages.some(m=>m.role==='system'&&m.content.includes(instructions)));
    for(const file of files) assert.ok(messages.some(m=>m.role==='user'&&m.content.includes(file.content)&&m.content.includes(file.path)));
  }
});

test('tutor file capture reads all step files and current edits on each request',()=>{
  const vm=require('node:vm'),fs=require('node:fs');
  const TutorialCode=function(){};
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../../js/tutorial-llm.js'),'utf8'),{
    window:{TutorialCode},URL,document:{currentScript:{src:'http://localhost/js/tutorial-llm.js'}}
  });
  const tutorial=new TutorialCode();let edited='current code';
  tutorial.currentStep=0;
  tutorial.steps=[{files:[{path:'main.py',content:'starter'}, {path:'helper.py',content:'helper source'}],solution:{files:[{path:'secret.py',content:'HIDDEN'}]},llm:{checks:[{command:'HIDDEN'}]}}];
  tutorial.editorModels={'main.py':{model:{getValue:()=>edited}}};
  assert.equal(JSON.stringify(tutorial.captureTutorFiles()),JSON.stringify([{path:'main.py',content:'current code'},{path:'helper.py',content:'helper source'}]));
  edited='updated code';assert.equal(tutorial.captureTutorFiles()[0].content,edited);
  tutorial.currentStep=1;tutorial.steps.push({files:[{path:'reflection.py',content:'reflection'}]});tutorial.editorModels={};
  assert.equal(JSON.stringify(tutorial.captureTutorFiles()),JSON.stringify([{path:'reflection.py',content:'reflection'}]));
});


test('generic UML from the reported reply is recognized as a class diagram',async()=>{
  const {tutorReplyParts,inferDiagramType}=await import('../../js/browser-llm/tutor-diagrams.mjs');
  const source='@startuml\nclass A {\n  +unique_in_order(items: List[int]) → List[int]\n}\n\n@enduml';
  for(const language of ['uml','plantuml','archuml','']) {
    const parts=tutorReplyParts('Explanation\n```'+language+'\n'+source+'\n```\n### Takeaway');
    assert.equal(parts[1].type,'class');assert.equal(parts[1].valid,true);
  }
  assert.equal(inferDiagramType('@startuml\n[*] --> Ready\nReady --> Done : finish\n@enduml'),'state');
  assert.equal(inferDiagramType('not a recognizable diagram'),null);
});

test('only the relevant compact syntax card is included, with activity as the function default',async()=>{
  const {tutorDiagramGuidance}=await import('../../js/browser-llm/tutor-syntax.mjs');
  const {tutorReplyParts}=await import('../../js/browser-llm/tutor-diagrams.mjs');
  for(const type of ['class','sequence','state','activity','component','deployment','usecase']) {
    const guidance=tutorDiagramGuidance({},'Explain with a '+type+' diagram');
    const diagrams=tutorReplyParts(guidance).filter(part=>part.valid);
    assert.equal(diagrams.length,1);assert.equal(diagrams[0].type,type);
  }
  assert.match(tutorDiagramGuidance({files:[{path:'main.py',content:'def f(): pass'}]},'render ArchUML of the code'),/```uml-activity/);
  assert.match(tutorDiagramGuidance({},'Clarify that',[{role:'user',content:'Explain the architecture'}]),/```uml-component/);
});


test('bare UML preserves prose and normalizes only relationship arrows',async()=>{
  const {tutorReplyParts,normalizeDiagramSource}=await import('../../js/browser-llm/tutor-diagrams.mjs');
  const source='@startuml\nclass A {\n +f() → List[int]\n}\nclass B\nA → B : calls\n@enduml';
  const parts=tutorReplyParts(source+'\n\n**Takeaway:** Compare the two roles.');
  assert.equal(parts[0].type,'class');assert.equal(parts[0].valid,true);
  assert.match(parts[1].text,/Takeaway/);
  assert.match(normalizeDiagramSource(source),/A --> B : calls/);
  assert.match(normalizeDiagramSource(source),/f\(\) → List/);
  assert.deepEqual(tutorReplyParts(source.replace('@enduml','')),[{text:source.replace('@enduml','')}]);
});
