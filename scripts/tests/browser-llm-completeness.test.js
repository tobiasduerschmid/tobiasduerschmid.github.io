const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');

async function inspect(source) {
  const {inspectionProgram}=await import('../../js/browser-llm/python-completeness.mjs');
  const run=spawnSync('python3',['-c',inspectionProgram(source)],{encoding:'utf8',timeout:3000});
  assert.ifError(run.error);
  assert.equal(run.status,0,run.stderr);
  return JSON.parse(run.stdout);
}

test('all omitted rover helpers are identified before any command needs to execute',async()=>{
  const source=readFileSync(join(__dirname,'../../tests/fixtures/rover-undefined-helpers.py'),'utf8');
  const result=await inspect(source);
  assert.equal(result.status,'incomplete');
  assert.deepEqual(result.missingNames,['next_position','reset_session','turn_heading','undo_action']);
});

test('legitimate helpers, closures, callbacks, recursion, constants and standard-library aliases are accepted',async t=>{
  const programs={
    'helpers defined after their callers':'def f(x): return helper(x) + OFFSET\ndef helper(x): return abs(x)\nOFFSET = 2',
    closures:'def f(values):\n def helper(x): return x + len(values)\n return [helper(v) for v in values]',
    callbacks:'def f(items, key): return sorted(items, key=key)',
    recursion:'def f(n): return 1 if n == 0 else n * f(n-1)',
    'import aliases':'import math as m\nfrom collections import Counter as C\ndef f(items): return m.floor(len(C(items)))',
    'class methods':'class Rover:\n def move(self, x): return self.turn(x)\n def turn(self, x): return x\ndef f(x): return Rover().move(x)',
    'explicit global assignment':'def initialize():\n global position\n position = 0\ndef f():\n initialize()\n return position'
  };
  for(const [name,source] of Object.entries(programs)) await t.test(name,async()=>{
    assert.equal((await inspect(source)).status,'complete');
  });
});

test('names bound in an unrelated scope do not supply a missing global helper',async()=>{
  const result=await inspect('def unrelated():\n def absent(): return 1\n return absent()\ndef f(): return absent()');
  assert.equal(result.status,'incomplete');
  assert.deepEqual(result.missingNames,['absent']);
});

test('tutorial-file and third-party imports cannot make an incomplete replacement self-contained',async()=>{
  const result=await inspect('from rover_reference import navigate\nimport numpy as np\nfrom .helper import turn');
  assert.equal(result.status,'incomplete');
  assert.deepEqual(result.externalImports,['.helper','numpy','rover_reference']);
});

test('inspection does not execute generated Python or expose its exception text',async()=>{
  assert.equal((await inspect('raise RuntimeError("must never execute")')).status,'complete');
  assert.equal((await inspect('def incomplete(')).status,'syntax');
});
