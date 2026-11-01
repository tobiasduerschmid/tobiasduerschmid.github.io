const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

const source='def undo(state, history):\n    """if imaginary: return wrong"""\n    if history:\n        return history.pop()\n    return state\n\ndef start(commands):\n    return commands\n';
const analyzed=spawnSync('python3',[path.join(__dirname,'../../js/python-ast-analyzer.py')],{
  input:JSON.stringify([{filename:'rover.py',content:source}]),encoding:'utf8'});
if(analyzed.status!==0)throw new Error(analyzed.stderr);
const context={coaching:'source',sourceModel:JSON.parse(analyzed.stdout)};
const request=(move,fn='',focus='')=>JSON.stringify({move,function:fn,focus});

test('the optional source outline supplies parsed facts while retaining the entire source',async()=>{
  const {tutorMaterial}=await import('../../js/browser-llm/prompts.mjs');
  const material=tutorMaterial({...context,files:[{path:'rover.py',content:source}]});
  assert.ok(material.includes(source));
  const outline=JSON.parse(material.split('\n').at(-1));
  assert.deepEqual(outline['rover.py'].classes,[]);
  assert.deepEqual(outline['rover.py'].functions.map(fn=>fn.name).sort(),['start','undo']);
  assert.ok(outline['rover.py'].functions.find(fn=>fn.name==='undo').calls.includes('history.pop'));
  assert.doesNotMatch(JSON.stringify(outline),/imaginary|wrong/);
});

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
