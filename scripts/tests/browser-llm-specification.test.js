const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const modules=Promise.all([import('../../js/browser-llm/specification-exercise.mjs'),import('../../js/browser-llm/checks.mjs'),import('../../js/browser-llm/python-completeness.mjs')]);
const exercise={mode:'specification',file:'original.py',interface:'Define unique(items). Return a list; do not print.',checks:[
  {category:'duplicates',command:'assert subject["unique"]([17,17]) == [17]'},
  {category:'ordering',command:'assert subject["unique"]([9,2,9]) == [9,2]'}]};
const snapshot=Object.freeze({file:'original.py',source:'ORIGINAL SOURCE MUST NEVER REACH THE MODEL'});
const specification='Keep the first occurrence of each value in its original order. Leave the input unchanged.';
const correct='def unique(items):\n return list(dict.fromkeys(items))';

async function trial(generate,overrides={}) {
  const [{checkSpecification},{checkProgram},{inspectionProgram}]=await modules;
  const controller=new AbortController();
  const python=code=>{
    const result=spawnSync('python3',['-c',code],{encoding:'utf8',timeout:3000});
    assert.equal(result.status,0,result.stderr);
    return JSON.parse(result.stdout);
  };
  return checkSpecification({specification,exercise,snapshot,signal:controller.signal,isCurrent:()=>true,onPhase:()=>{},
    generate,
    inspect:async source=>python(inspectionProgram(source)),
    runChecks:async candidate=>python(checkProgram(candidate.source,exercise)),...overrides});
}

test('a prose submission checks a private implementation without exposing or replacing the reference',async()=>{
  let inspected;
  const result=await trial(async messages=>{
    const prompt=JSON.stringify(messages);
    assert.ok(prompt.includes(specification));
    assert.ok(prompt.includes(exercise.interface));
    assert.ok(!prompt.includes(snapshot.source));
    for(const check of exercise.checks) assert.ok(!prompt.includes(check.command));
    return {text:correct,finishReason:'stop'};
  },{onGenerated:source=>{inspected=source;}});
  assert.deepEqual(result,{status:'checked',failed:[]});
  assert.equal(inspected,correct,'The optional inspection must show the implementation being checked');
  assert.equal(snapshot.source,'ORIGINAL SOURCE MUST NEVER REACH THE MODEL');
  assert.ok(!JSON.stringify(result).includes('def unique'));
});

test('the generated candidate, rather than the original, determines the conceptual mismatch',async()=>{
  const result=await trial(async()=>({text:'def unique(items):\n return sorted(set(items))',finishReason:'stop'}));
  assert.deepEqual(result,{status:'checked',failed:['ordering']});
  const [{specificationFeedback}]=await modules;
  const feedback=specificationFeedback(result);
  assert.match(feedback,/order/i);
  assert.match(feedback,/model may have made a mistake/);
  assert.ok(!feedback.includes('[9,2,9]'));
});

test('incomplete generation does not execute partial Python or blame the prose',async()=>{
  const result=await trial(async()=>({text:correct,finishReason:'length'}),{
    onGenerated:()=>assert.fail('An unfinished implementation must not be presented as the checked program'),
    runChecks:()=>assert.fail('An unfinished implementation must not execute')});
  const [{specificationFeedback}]=await modules;
  assert.equal(result.status,'generation');
  assert.match(specificationFeedback(result),/specification has not been assessed/);
});

test('missing helper definitions trigger one full regeneration using only public information',async()=>{
  const prompts=[];
  let inspected;
  const result=await trial(async messages=>{
    prompts.push(messages);
    return {text:prompts.length===1 ? 'def unique(items):\n return remove_repeats(items)' : correct,finishReason:'stop'};
  },{onGenerated:source=>{inspected=source;}});
  assert.deepEqual(result,{status:'checked',failed:[]});
  assert.equal(inspected,correct);
  assert.equal(prompts.length,2);
  const repair=JSON.stringify(prompts[1]);
  assert.match(repair,/remove_repeats/);
  assert.match(repair,/complete replacement/);
  assert.ok(repair.includes(specification));
  assert.ok(!repair.includes(snapshot.source));
  for (const check of exercise.checks) assert.ok(!repair.includes(check.command));
});

test('a model that keeps omitting a helper stops after one retry without running hidden checks',async()=>{
  let attempts=0;
  const result=await trial(async()=>{attempts++;return {text:'def unique(items):\n return absent(items)',finishReason:'stop'};},
    {runChecks:()=>assert.fail('An incomplete candidate must not reach behavioral checks')});
  assert.equal(attempts,2);
  assert.equal(result.status,'incomplete');
  assert.ok(!JSON.stringify(result).includes('absent'),'Result feedback must contain no generated source');
});

test('editing during the repair attempt discards it before validation or testing',async()=>{
  let current=true,attempts=0;
  const result=await trial(async()=>{
    if (++attempts===2) current=false;
    return {text:attempts===1?'def unique(items):\n return absent(items)':correct,finishReason:'stop'};
  },{isCurrent:()=>current,onGenerated:()=>assert.fail('A stale repair must not be displayed'),
    runChecks:()=>assert.fail('A stale repair must not be tested')});
  assert.equal(attempts,2);
  assert.equal(result,null);
});

for(const invalidation of ['cancel','edit']) {
  test(`${invalidation} during generation discards the candidate before execution`,async()=>{
    const controller=new AbortController();let current=true;
    const result=await trial(async()=>{
      if(invalidation==='cancel') controller.abort(); else current=false;
      return {text:correct,finishReason:'stop'};
    },{signal:controller.signal,isCurrent:()=>current,
      onGenerated:()=>assert.fail('Stale generation must not be displayed'),
      runChecks:()=>assert.fail('Stale generation must not execute')});
    assert.equal(result,null);
  });
}

test('a changed submission does not receive feedback from checks already in flight',async()=>{
  let current=true;
  const result=await trial(async()=>({text:correct,finishReason:'stop'}),{
    isCurrent:()=>current,runChecks:async()=>{current=false;return {status:'checked',failed:[]};}
  });
  assert.equal(result,null);
});

test('check announcements distinguish a pass, a failed program, and an unassessed draft',async()=>{
  const [{specificationStatus}]=await modules;
  assert.match(specificationStatus({status:'checked',failed:[]}),/^Checks passed/);
  for (const result of [
    {status:'checked',failed:['ordering']},
    {status:'syntax',failed:[]},
    {status:'incomplete',failed:[]},
    {status:'runtime',failed:[]}
  ]) assert.match(specificationStatus(result),/^Did not pass:/);
  for (const status of ['generation','unavailable']) {
    assert.match(specificationStatus({status,failed:[]}),/^Not checked:/);
  }
});
