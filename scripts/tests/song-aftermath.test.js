const test = require('node:test');
const assert = require('node:assert/strict');
const { progress, arcFlight, contactFlight, projectile, floorContactTime } = require('../../js/song-video/teammate-aftermath');
const close = (actual, wanted) => assert.ok(Math.abs(actual - wanted) < 1e-7, `${actual} != ${wanted}`);

test('an event is absent before its cue and remains settled after its duration', () => {
  for (const [time, wanted] of [[-20,0],[9.999,0],[10,0],[10.5,.25],[12,1],[200,1]]) close(progress(time,10,2),wanted);
});

test('a tossed sheet leaves its source and reaches its supporting surface without hovering or overshooting', () => {
  const path = { from:[20,40], to:[120,80], duration:2, arc:30 };
  assert.deepEqual(arcFlight(path,-1),[20,40]);
  assert.deepEqual(arcFlight(path,0),[20,40]);
  assert.deepEqual(arcFlight(path,1),[70,30]);
  assert.deepEqual(arcFlight(path,2),[120,80]);
  assert.deepEqual(arcFlight(path,20),[120,80]);
  const before=arcFlight(path,1.999);
  assert.ok(before[1]<80,'the sheet is above its support immediately before landing');
});

test('free flight preserves release position and velocity before gravity acts', () => {
  const launch = { position:[600,200], velocity:[-180,-100], gravity:400 };
  assert.deepEqual(projectile(launch,0),[600,200]);
  assert.deepEqual(projectile(launch,.5),[510,200]);
  const dt=1e-5, p=projectile(launch,dt);
  assert.ok(Math.abs((p[0]-600)/dt+180)<.01);
  assert.ok(Math.abs((p[1]-200)/dt+100)<.01);
});

test('an aimed discard preserves its hand velocity and descends into the bin', () => {
  const path = { from: [660,230], to: [330,378], velocity: [-350,-80], landingVelocity: [-20,220], duration: 1.25 };
  assert.deepEqual(contactFlight(path,0), path.from);
  assert.deepEqual(contactFlight(path,2), path.to);
  const p = contactFlight(path,1e-5);
  path.velocity.forEach((v,i) => assert.ok(Math.abs((p[i]-path.from[i])/1e-5-v)<.01));
  assert.ok(contactFlight(path,1.24)[1]<path.to[1], 'approaches the opening from above');
});

test('fragment floor contact is the positive crossing even with an initial upward bounce', () => {
  const fall={position:[0,100],velocity:[25,-20],gravity:400};
  const at=floorContactTime(fall,400);
  assert.ok(at>0);
  close(projectile(fall,at)[1],400);
  assert.ok(projectile(fall,at-.001)[1]<400);
});

test('direct and reverse sampling produce identical trajectories', () => {
  const path={from:[200,40],to:[330,388],duration:1.8,arc:95};
  const forward=[0,.6,1.2,1.8,8].map(t=>arcFlight(path,t));
  for(const i of [4,1,3,0,2]) assert.deepEqual(arcFlight(path,[0,.6,1.2,1.8,8][i]),forward[i]);
});
