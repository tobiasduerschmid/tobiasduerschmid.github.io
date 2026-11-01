const {test}=require('node:test');
const assert=require('node:assert/strict');

test('the coach keeps complete reasoning from earlier exchanges without carrying private lesson data',async()=>{
  const {tutorMessages}=await import('../../js/browser-llm/prompts.mjs');
  const evidence='I inspected the source. '.repeat(10)+'My evidence is the return statement.';
  const history=[{role:'user',content:evidence},{role:'assistant',content:'Which branch reaches it?'},
    {role:'user',content:'I followed the empty-list branch.'},{role:'assistant',content:'What does that change?'}];
  const messages=tutorMessages({instructions:'Keep the task independent.',files:[{path:'original.py',content:'def read(): return 3'}],
    checks:'PRIVATE_CHECK',solution:'PRIVATE_ANSWER'},'How does my earlier evidence apply?',history);
  for(const turn of history)assert.ok(messages.some(m=>m.role===turn.role&&m.content===turn.content));
  assert.doesNotMatch(JSON.stringify(messages),/PRIVATE_CHECK|PRIVATE_ANSWER/);
});

test('coaching prompts offer diagram requests without feeding the model a solved syntax example',async()=>{
  const {tutorMessages}=await import('../../js/browser-llm/prompts.mjs');
  const prompt=tutorMessages({},'Can you draw the call relationships?');
  assert.match(prompt[0].content,/draw_diagram/);
  assert.doesNotMatch(prompt[0].content,/@startuml|Check input.*Valid/s);
});

test('only one supported, bounded diagram request can trigger the drawing generation',async()=>{
  const {parseTutorTurn}=await import('../../js/browser-llm/tutor-session.mjs');
  const request='```tutor-tool\n{"tool":"draw_diagram","type":"sequence","focus":"calls in the learner trace"}\n```';
  const parsed=parseTutorTurn('Which call follows?\n'+request);
  assert.equal(parsed.text,'Which call follows?');
  assert.deepEqual(parsed.diagram,{type:'sequence',focus:'calls in the learner trace'});
  for(const invalid of [request+'\n'+request,request.replace('draw_diagram','run_python'),request.replace('sequence','unknown'),
    request.replace('calls in the learner trace','x'.repeat(241)),request.replace('"type":','"extra":true,"type":'),request.slice(0,-3)]) {
    assert.equal(parseTutorTurn('Which call follows?\n'+invalid).diagram,null);
  }
});

test('diagram drawing gets its own syntax prompt and preserves the complete trusted lesson guidance',async()=>{
  const {diagramMessages}=await import('../../js/browser-llm/tutor-session.mjs');
  const context={instructions:'Do not supply a specification.',files:[{path:'original.py',content:'def first(): return second()'}]};
  const messages=diagramMessages(context,{type:'sequence',focus:'the learner-identified call'},'I traced first calling second.',[],'Which call follows?');
  assert.match(messages[0].content,/Do not supply a specification/);
  assert.match(messages[0].content,/uml-sequence/);
  assert.ok(messages.some(m=>m.content.includes(context.files[0].content)));
  assert.doesNotMatch(JSON.stringify(messages),/```uml-activity/);
});

test('ordinary questions do not invite an irrelevant drawing or expose a copyable tool example',async()=>{
  const {tutorMessages}=await import('../../js/browser-llm/prompts.mjs');
  const text=tutorMessages({},'I think undo means moving backwards. Is that right?')[0].content;
  assert.doesNotMatch(text,/draw_diagram|tutor-tool/);
});

test('declining diagrams and stopping preserve ordinary coaching and pause choices',async()=>{
  const {tutorMessages,wantsTutorDiagram}=await import('../../js/browser-llm/prompts.mjs');
  for(const question of ['No diagrams, just a hint.','Stop drawing diagrams; I want to stop here.','Do not draw another diagram.','No found messages, just a hint.']) {
    assert.equal(wantsTutorDiagram(question),false);
    const messages=tutorMessages({coaching:'source'},question,[]);
    assert.match(messages[0].content,/pause/);assert.doesNotMatch(messages[0].content,/draw_diagram/);
  }
});

test('plain coaching uses one model call; requested diagrams use exactly one additional call',async()=>{
  const {runTutorTurn}=await import('../../js/browser-llm/tutor-session.mjs');
  const replies=['Which call follows?','Which call follows?\n```tutor-tool\n{"tool":"draw_diagram","type":"sequence","focus":"the calls you traced"}\n```',
    '```uml-sequence\n@startuml\nparticipant a: First\nparticipant b: Second\na -> b: call\n@enduml\n```'];
  const prompts=[];
  const generate=async messages=>{prompts.push(messages);return {text:replies.shift(),finishReason:'stop'};};
  const signal=new AbortController().signal;
  const plain=await runTutorTurn({context:{},question:'Where next?',history:[],generate,signal});
  assert.equal(prompts.length,1);assert.equal(plain.text,'Which call follows?');
  const diagram=await runTutorTurn({context:{},question:'Draw those calls?',history:[],generate,signal});
  assert.equal(prompts.length,3);assert.match(diagram.text,/uml-sequence/);
  assert.doesNotMatch(diagram.text,/tutor-tool|draw_diagram/);
  assert.match(prompts[2][0].content,/@startuml/);
});

for(const [type,question,source] of [
  ['class','Show me a class diagram of this program.','class Rover\nclass Controller\nController --> Rover : controls'],
  ['sequence','Show how this program starts, using a found message.','participant rover: navigate\no-> rover: navigate(commands)'],
  ['activity','Draw an activity diagram of the entry point.','(*) --> "Read commands"\n"Read commands" --> (*)']
])test(`source tutor draws a requested ${type} view without requiring a learner-named call`,async()=>{
  const {runTutorTurn}=await import('../../js/browser-llm/tutor-session.mjs');
  const files=[{path:'rover.py',content:'# Current workspace\n'.repeat(40)+'class Rover:\n    pass\n'},
    {path:'controller.py',content:'from rover import Rover\nclass Controller:\n    def __init__(self):\n        self.rover = Rover()\n\ndef navigate(commands):\n    return Controller()\n'}];
  const context={coaching:'source',files,checks:'PRIVATE_CHECK',solution:'PRIVATE_SOLUTION'};
  const diagram='```uml-'+type+'\n@startuml\n'+source+'\n@enduml\n```';
  const replies=['```json\n'+JSON.stringify({tool:'draw_diagram',type,focus:'the requested source view'})+'\n```',diagram];
  const prompts=[];
  const result=await runTutorTurn({context,question,history:[],signal:new AbortController().signal,
    generate:async messages=>{prompts.push(messages);return {text:replies.shift(),finishReason:'stop'};}});
  assert.equal(prompts.length,2);
  for(const messages of prompts) {
    for(const file of files)assert.ok(messages.some(message=>message.content.includes(file.path) && message.content.includes(file.content)),file.path+' must remain complete');
    assert.doesNotMatch(JSON.stringify(messages),/PRIVATE_CHECK|PRIVATE_SOLUTION/);
  }
  assert.ok(result.text.includes(diagram));assert.equal(result.notice,'');
});

test('an unsuitable requested view can explain why without inventing classes or exposing tool syntax',async()=>{
  const {runTutorTurn}=await import('../../js/browser-llm/tutor-session.mjs');
  const reason='This program has functions but no classes. A sequence diagram can show their interactions.';
  const replies=['```json\n{"tool":"draw_diagram","type":"class","focus":"the program structure"}\n```','NO_DIAGRAM: '+reason];
  const result=await runTutorTurn({context:{coaching:'source',files:[{path:'main.py',content:'def start(): return 0'}]},
    question:'Draw a class diagram.',history:[],signal:new AbortController().signal,
    generate:async()=>({text:replies.shift(),finishReason:'stop'})});
  assert.equal(result.text,reason);assert.equal(result.notice,'');
});

test('a model-selected drawing cannot override a learner declining diagrams',async()=>{
  const {runTutorTurn}=await import('../../js/browser-llm/tutor-session.mjs');let calls=0;
  await assert.rejects(runTutorTurn({context:{coaching:'source'},question:'No diagrams, just a hint.',history:[],signal:new AbortController().signal,
    generate:async()=>{calls++;return {text:'```json\n{"tool":"draw_diagram","type":"class","focus":"program"}\n```',finishReason:'stop'};}}),/not requested/i);
  assert.equal(calls,1);
});

test('a failed diagram-only request remains unsuccessful instead of substituting a generic coaching question',async()=>{
  const {runTutorTurn}=await import('../../js/browser-llm/tutor-session.mjs');let calls=0;
  await assert.rejects(runTutorTurn({context:{coaching:'source'},question:'Show a class diagram.',history:[],signal:new AbortController().signal,
    generate:async()=>{if(calls++)throw new Error('drawing unavailable');
      return {text:'```json\n{"tool":"draw_diagram","type":"class","focus":"program structure"}\n```',finishReason:'stop'};}}),/diagram.*unavailable/i);
  assert.equal(calls,2);
});

test('a diagram with ALT fragments has room beyond the former short-answer budget',async()=>{
  const {runTutorTurn}=await import('../../js/browser-llm/tutor-session.mjs');let calls=0;
  const source='@startuml\nparticipant entry: navigate\nparticipant dispatch: process_command\no-> entry: navigate(commands)\nloop each command\nentry -> dispatch: process_command\nalt accepted\ndispatch --> entry: next state\nelse ignored\ndispatch --> entry: same state\nend\nend\n@enduml';
  const result=await runTutorTurn({context:{coaching:'source'},question:'Generate a sequence diagram with ALT fragments.',history:[],signal:new AbortController().signal,
    generate:async(_,options)=>{
      if(calls++) {
        assert.ok(options.maxTokens>=768,'Branching drawings need more than the old 384-token cap');
        return {text:'```uml-sequence\n'+source+'\n```',finishReason:'stop'};
      }
      return {text:'```json\n{"tool":"draw_diagram","type":"sequence","focus":"the requested branches"}\n```',finishReason:'stop'};
    }});
  assert.ok(result.text.includes(source));assert.equal(calls,2);
});

test('an exhausted drawing output budget does not tell the learner to clear the conversation',async()=>{
  const {runTutorTurn}=await import('../../js/browser-llm/tutor-session.mjs');let calls=0;
  await assert.rejects(runTutorTurn({context:{coaching:'source'},question:'Draw a sequence diagram with ALT fragments.',history:[],signal:new AbortController().signal,
    generate:async(_,options)=>calls++
      ? {text:'```uml-sequence\n@startuml\nparticipant a',finishReason:'length',usage:{completion_tokens:options.maxTokens,prompt_tokens:1000}}
      : {text:'```json\n{"tool":"draw_diagram","type":"sequence","focus":"the branches"}\n```',finishReason:'stop'}}),error=>{
        assert.match(error.message,/generation limit/i);assert.doesNotMatch(error.message,/fresh context|recap/i);return true;
      });
});

test('an unavailable optional diagram retains the completed coaching question',async()=>{
  const {runTutorTurn}=await import('../../js/browser-llm/tutor-session.mjs');
  let calls=0;
  const result=await runTutorTurn({context:{},question:'Diagram?',history:[],signal:new AbortController().signal,
    generate:async()=>{if(calls++)throw Object.assign(new Error('context size exceeded'),{name:'InputError'});
      return {text:'Which call follows?\n```tutor-tool\n{"tool":"draw_diagram","type":"sequence","focus":"one call"}\n```',finishReason:'stop'};}});
  assert.equal(calls,2);assert.equal(result.text,'Which call follows?');
  assert.match(result.notice,/diagram.*context|context.*diagram/i);
});

test('stopping a diagram generation discards the entire pending turn',async()=>{
  const {runTutorTurn}=await import('../../js/browser-llm/tutor-session.mjs');
  const controller=new AbortController();let calls=0;
  await assert.rejects(runTutorTurn({context:{},question:'Diagram?',history:[],signal:controller.signal,
    generate:async()=>{if(calls++){controller.abort();return {text:'late',finishReason:'stop'};}
      return {text:'Which call follows?\n```tutor-tool\n{"tool":"draw_diagram","type":"sequence","focus":"one call"}\n```',finishReason:'stop'};}}),{name:'AbortError'});
});

test('losing the shared model host during drawing preserves the retryable failure instead of committing a partial turn',async()=>{
  const {runTutorTurn}=await import('../../js/browser-llm/tutor-session.mjs');
  for(const coaching of ['', 'Which call follows?\n']) {
    let calls=0;
    const error=Object.assign(new Error('The tab hosting the shared model closed. Try again to reload the downloaded model.'),{name:'HostLostError'});
    await assert.rejects(runTutorTurn({context:{},question:'Draw the calls.',history:[],signal:new AbortController().signal,
      generate:async()=>{if(calls++)throw error;
        return {text:coaching+'```tutor-tool\n{"tool":"draw_diagram","type":"sequence","focus":"source calls"}\n```',finishReason:'stop'};}}),
      actual=>actual===error);
    assert.equal(calls,2,'An interrupted drawing must not replay automatically');
  }
});

test('partial replies and context rejection never produce a successful turn or a shortened retry',async()=>{
  const {runTutorTurn}=await import('../../js/browser-llm/tutor-session.mjs');
  const history=[{role:'user',content:'My first evidence'},{role:'assistant',content:'Which branch?'},
    {role:'user',content:'My later observation'},{role:'assistant',content:'What does it support?'}];
  let calls=0;
  await assert.rejects(runTutorTurn({context:{},question:'Compare that?',history,signal:new AbortController().signal,
    generate:async messages=>{calls++;assert.ok(messages.some(m=>m.content==='My first evidence'));
      throw Object.assign(new Error('context size exceeded'),{name:'InputError'});}}),{name:'InputError'});
  assert.equal(calls,1);
  await assert.rejects(runTutorTurn({context:{},question:'Compare that?',history,signal:new AbortController().signal,
    generate:async()=>({text:'A partial response that might mislead',finishReason:'length'})}),{name:'TutorReplyLimitError'});
});

test('code and malformed drawings cannot bypass the separate diagram stage',async()=>{
  const {runTutorTurn}=await import('../../js/browser-llm/tutor-session.mjs');
  await assert.rejects(runTutorTurn({context:{},question:'Write code',history:[],signal:new AbortController().signal,
    generate:async()=>({text:'```python\ndef answer(): return 42\n```',finishReason:'stop'})}),/coaching reply/);
  const outputs=['Which call follows?\n```tutor-tool\n{"tool":"draw_diagram","type":"sequence","focus":"one call"}\n```',
    'Here is the full answer.\n```uml-sequence\n@startuml\nparticipant a: A\na -> a: solve\n@enduml\n```'];
  const result=await runTutorTurn({context:{},question:'Draw?',history:[],signal:new AbortController().signal,
    generate:async()=>({text:outputs.shift(),finishReason:'stop'})});
  assert.equal(result.text,'Which call follows?');
  assert.match(result.notice,/could not draw/);
});

test('the real model’s tool-only request triggers a drawing without displaying internal JSON',async()=>{
  const {runTutorTurn}=await import('../../js/browser-llm/tutor-session.mjs');
  const outputs=['```tutor-tool\n{"tool":"draw_diagram","type":"sequence","focus":"navigate -> process_command"}\n```',
    '```uml-sequence\n@startuml\nparticipant a: navigate\nparticipant b: process_command\na -> b: command\n@enduml\n```'];
  const result=await runTutorTurn({context:{},question:'Show the call I traced.',history:[],signal:new AbortController().signal,
    generate:async()=>({text:outputs.shift(),finishReason:'stop'})});
  assert.match(result.text,/uml-sequence/);assert.doesNotMatch(result.text,/tutor-tool|"focus"/);
  assert.equal(outputs.length,0);
});

test('JSON fences from the local model use the same validated drawing protocol',async()=>{
  const {parseTutorTurn}=await import('../../js/browser-llm/tutor-session.mjs');
  assert.deepEqual(parseTutorTurn('```json\n{"tool":"draw_diagram","type":"sequence","focus":"navigate calls process_command"}\n```').diagram,
    {type:'sequence',focus:'navigate calls process_command'});
});

test('source coaching displays a checked question, never model-authored prose or answers',async()=>{
  const {runTutorTurn}=await import('../../js/browser-llm/tutor-session.mjs');
  const context={coaching:'source'};
  const turn=await runTutorTurn({context,question:'I do not understand Python lists.',history:[],signal:new AbortController().signal,
    generate:async messages=>{
      assert.match(messages[0].content,/Select ONE coaching move/);
      return {text:'```json\n{"move":"resource","function":"","focus":"lists"}\n```',finishReason:'stop'};
    }});
  assert.match(turn.resource.url,/#lists$/);
  await assert.rejects(runTutorTurn({context,question:'Give me the specification.',history:[],signal:new AbortController().signal,
    generate:async()=>({text:'Here is the complete specification...',finishReason:'stop'})}),/valid coaching move/);
});

test('independent transfer rejects a drawing call without starting the next generation',async()=>{
  const {runTutorTurn}=await import('../../js/browser-llm/tutor-session.mjs');
  let calls=0;
  await assert.rejects(runTutorTurn({context:{coaching:'independent'},question:'Draw the algorithm.',history:[],signal:new AbortController().signal,
    generate:async()=>{calls++;return {text:'```tutor-tool\n{"tool":"draw_diagram","type":"sequence","focus":"solution"}\n```',finishReason:'stop'};}}),/independent/i);
  assert.equal(calls,1);
});
