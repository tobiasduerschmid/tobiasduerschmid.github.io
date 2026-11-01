const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

const source='def undo(state, history):\n    """if imaginary: return wrong"""\n    if history:\n        return history.pop()\n    return state\n\ndef start(commands):\n    return commands\n\ndef navigate(commands):\n    return start(commands)\n';
const analyzed=spawnSync('python3',[path.join(__dirname,'../../js/python-ast-analyzer.py')],{
  input:JSON.stringify([{filename:'rover.py',content:source}]),encoding:'utf8'});
if(analyzed.status!==0)throw new Error(analyzed.stderr);
const context={coaching:'source',sourceModel:JSON.parse(analyzed.stdout)};
const request=(move,fn='',focus='')=>JSON.stringify({move,function:fn,focus});

test('source coaching points to a real parsed statement without reproducing its answer',async()=>{
  const {sourceCoachReply}=await import('../../js/browser-llm/source-coach.mjs');
  const reply=sourceCoachReply('```json\n'+request('inspect','undo','return')+'\n```',context,[]);
  assert.match(reply.text,/undo/);assert.match(reply.text,/rover\.py.*line 4/);
  assert.doesNotMatch(reply.text,/pop|return history|restor|backward/i);
});

test('invented functions and answer-bearing extra fields cannot become advice',async()=>{
  const {sourceCoachReply}=await import('../../js/browser-llm/source-coach.mjs');
  for(const reply of [request('inspect','imaginary','return'),
    JSON.stringify({move:'inspect',function:'undo',focus:'return',answer:'A complete specification'}),
    'The rover always moves backwards.',request('execute','undo','return')]){
    assert.throws(()=>sourceCoachReply(reply,context,[]),/source|coaching|move/i);
  }
});

test('an unusable focus falls back to the verified function without inventing a statement',async()=>{
  const {sourceCoachReply}=await import('../../js/browser-llm/source-coach.mjs');
  for(const focus of ['condition','state']){
    const reply=sourceCoachReply(request('inspect','start',focus),context,[]);
    assert.match(reply.text,/start in rover.py/);assert.match(reply.text,/predict/);
    assert.doesNotMatch(reply.text,/\b(condition|loop|state|return)\b/);
  }
});

test('repeated source questions change the task instead of repeating the same hint',async()=>{
  const {sourceCoachReply}=await import('../../js/browser-llm/source-coach.mjs');
  const initial=sourceCoachReply(request('inspect','undo','return'),context,[]);
  const history=[{role:'user',content:'Here is my prediction'},{role:'assistant',content:initial.text}];
  const next=sourceCoachReply(request('inspect','undo','return'),context,history);
  assert.notEqual(next.text,initial.text);assert.match(next.text,/different input|new input/i);
});

test('missing prerequisites lead to verified course resources without supplying a solution',async()=>{
  const {sourceCoachReply}=await import('../../js/browser-llm/source-coach.mjs');
  const reply=sourceCoachReply(request('resource','','lists'),context,[]);
  assert.equal(reply.resource.url,'/SEBook/tools/python-tutorial/#lists');
  assert.match(reply.text,/pause|TA/);assert.doesNotMatch(reply.text,/pop|last element/);
  const unknown=sourceCoachReply(request('resource','','lists, loops, or functions'),context,[]);
  assert.equal(unknown.resource.url,'/SEBook/tools/python-tutorial/');
  assert.doesNotMatch(unknown.text,/lists, loops, or functions/);
});

test('independent transfer permits general strategies and resources but no source-specific coaching',async()=>{
  const {sourceCoachReply}=await import('../../js/browser-llm/source-coach.mjs');
  const independent={...context,coaching:'independent'};
  assert.throws(()=>sourceCoachReply(request('inspect','undo','return'),independent,[]),/independent/i);
  assert.match(sourceCoachReply(request('reflect'),independent,[]).text,/evidence|prediction/);
  assert.match(sourceCoachReply(request('pause'),independent,[]).text,/stop|pause/);
});

test('source drawings require an explicitly requested, learner-identified call verified in Python AST',async()=>{
  const {sourceDrawingRequest}=await import('../../js/browser-llm/source-diagrams.mjs');
  const request={type:'sequence',focus:'navigate calls start'};
  const pair=sourceDrawingRequest(context,request,'I traced navigate calling start. Draw that call.',[]);
  assert.deepEqual(pair,{caller:'navigate',callee:'start'});
  for(const [question,tool] of [
    ['Tell me the answer.',request],
    ['Draw the whole program.',request],
    ['I traced start calling navigate. Draw it.',{type:'sequence',focus:'start calls navigate'}],
    ['I traced navigate calling start. Draw the full solution.',{type:'activity',focus:'navigate calls start'}]
  ])assert.throws(()=>sourceDrawingRequest(context,tool,question,[]),/diagram|call|relationship/);
});

test('source drawing labels cannot carry solved behavior or extra relationships',async()=>{
  const {validSourceDrawing}=await import('../../js/browser-llm/source-diagrams.mjs');
  const pair={caller:'navigate',callee:'start'};
  const diagram='@startuml\nparticipant a: navigate\nparticipant b: start\na -> b: calls\n@enduml';
  assert.equal(validSourceDrawing(diagram,pair),true);
  for(const wrong of [diagram.replace('b: start','b: undo'),
    diagram.replace('@enduml','b -> a: calls\n@enduml'),diagram.replace('@enduml','note: answer\n@enduml')]){
    assert.equal(validSourceDrawing(wrong,pair),false);
  }
});

test('drawing aliases cannot carry an answer into the source disclosure or conversation',async()=>{
  const {canonicalSourceDrawing}=await import('../../js/browser-llm/source-diagrams.mjs');
  const source='@startuml\nparticipant Undo_returns_last_state: navigate\nparticipant b: start\nUndo_returns_last_state -> b: calls\n@enduml';
  const checked=canonicalSourceDrawing(source,{caller:'navigate',callee:'start'});
  assert.match(checked,/navigate/);assert.match(checked,/start/);
  assert.doesNotMatch(checked,/Undo|returns_last_state/);
});

test('the real model’s simple participants and unchecked label normalize to the verified call map',async()=>{
  const {canonicalSourceDrawing}=await import('../../js/browser-llm/source-diagrams.mjs');
  const source='@startuml\nparticipant navigate\nparticipant start\nnavigate -> start: return history.pop()\n@enduml';
  const checked=canonicalSourceDrawing(source,{caller:'navigate',callee:'start'});
  assert.ok(checked);assert.match(checked,/a -> b: calls/);
  assert.doesNotMatch(checked,/history|pop|return/);
});

test('failed source drawing retains an actionable question without an absent-diagram instruction',async()=>{
  const {runTutorTurn}=await import('../../js/browser-llm/tutor-session.mjs');let calls=0;
  const reply=await runTutorTurn({context,question:'I traced navigate calling start. Draw that call.',history:[],signal:new AbortController().signal,
    generate:async messages=>{if(calls++){assert.doesNotMatch(JSON.stringify(messages),/INVENTED_ARGUMENT/);throw new Error('drawing unavailable');}
      return {text:'```json\n{"tool":"draw_diagram","type":"sequence","focus":"navigate calls start(INVENTED_ARGUMENT)"}\n```',finishReason:'stop'};}});
  assert.equal(calls,2);assert.match(reply.text,/navigate.*start/);assert.match(reply.text,/\?/);
  assert.doesNotMatch(reply.text,/Check the diagram/);assert.match(reply.notice,/unavailable/);
});
