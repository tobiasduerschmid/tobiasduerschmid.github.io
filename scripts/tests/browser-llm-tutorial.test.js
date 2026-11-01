const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const modules=Promise.all([import('../../js/browser-llm/prompts.mjs'),import('../../js/browser-llm/checks.mjs')]);
const exercise={file:'solution.py',interface:'Define unique(items).',specification:'Remove duplicate values.',checks:[
  {category:'duplicates',command:'assert subject["unique"]([7,7]) == [7]'},
  {category:'ordering',command:'assert subject["unique"]([9,2,9]) == [9,2]'}]};
test('feedback prompts contain only public inputs and approved conceptual categories',async()=>{
  const [{feedbackMessages}]=await modules;
  const prompt=JSON.stringify(feedbackMessages(exercise.specification,exercise.interface,['ordering','unknown: SECRET CASE']));
  assert.ok(prompt.includes('ordering'));
  for(const hidden of [exercise.checks[0].command,exercise.checks[1].command,'[9,2,9]','SECRET CASE']) assert.ok(!prompt.includes(hidden));
});
test('incomplete or empty generation cannot be applied',async()=>{
  const [{pythonFromResult}]=await modules;
  assert.equal(pythonFromResult({text:'```python\ndef unique(items):\n    return items\n```',finishReason:'stop'}),'def unique(items):\n    return items');
  assert.throws(()=>pythonFromResult({text:'def unique(',finishReason:'length'}),/incomplete/i);
  assert.throws(()=>pythonFromResult({text:' ',finishReason:'stop'}),/empty/i);
});
test('hidden checks return conceptual outcomes without source, test values, or raw errors',async()=>{
  const [, {checkProgram}]=await modules;
  const run=source=>{
    const result=spawnSync('python3',['-c',checkProgram(source,exercise)],{encoding:'utf8',timeout:3000});
    assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);
  };
  assert.deepEqual(run('def unique(items):\n return list(dict.fromkeys(items))'),{status:'checked',failed:[]});
  assert.deepEqual(run('def unique(items):\n return sorted(set(items))'),{status:'checked',failed:['ordering']});
  assert.deepEqual(run('def unique(:'),{status:'syntax',failed:[]});
  assert.deepEqual(run('raise AssertionError(\"PROGRAM ERROR\")'),{status:'runtime',failed:[]});
  assert.deepEqual(run('raise RuntimeError("SECRET VALUE")'),{status:'runtime',failed:[]});
  assert.deepEqual(run('print("SECRET VALUE")\ndef unique(items):\n raise SystemExit(9)'),{status:'runtime',failed:[]});
});

test('demo checks accept independent correct algorithms and reject plausible requirement mistakes',async()=>{
  const [, {checkProgram}]=await modules;
  const fs=require('node:fs'),yaml=require('js-yaml');
  const config=yaml.load(fs.readFileSync(require('node:path').join(__dirname,'../../_data/tutorials/python-specification.yml'),'utf8'));
  const exercise=config.steps[0].llm;
  const run=source=>JSON.parse(spawnSync('python3',['-c',checkProgram(source,exercise)],{encoding:'utf8',timeout:3000}).stdout);
  for(const source of [
    'def unique_in_order(items):\n return list(dict.fromkeys(items))',
    'def unique_in_order(items):\n result=[]\n for value in items:\n  if value not in result: result.append(value)\n return result'
  ]) assert.deepEqual(run(source),{status:'checked',failed:[]});
  assert.ok(run('def unique_in_order(items):\n return sorted(set(items))').failed.includes('ordering'));
  assert.ok(run('def unique_in_order(items):\n return items.copy()').failed.includes('duplicates'));
  assert.ok(run('def unique_in_order(items):\n items[:]=dict.fromkeys(items)\n return items').failed.includes('mutation'));
  assert.ok(run('def unique_in_order(items):\n return None if not items else list(dict.fromkeys(items))').failed.includes('boundaries'));
});
