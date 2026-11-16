const test = require('node:test');
const assert = require('node:assert/strict');
const { progress, arcFlight, projectile, floorContactTime, bounceHeight } = require('../../js/song-video/teammate-aftermath');
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

test('free flight cannot steer sideways or change gravity between contacts', () => {
  for (const velocity of [[-400,14], [150,-80], [-425,-410], [160,0]]) {
    const path = { position:[680,205], velocity, gravity:460 };
    const points = [0,.1,.2,.3,.4].map(t => projectile(path,t));
    for (let i=1;i<points.length-1;i++) {
      close(points[i+1][0]-2*points[i][0]+points[i-1][0],0);
      close((points[i+1][1]-2*points[i][1]+points[i-1][1])/.01,460);
    }
  }
});

test('a small rebound leaves and returns to its contact under the same gravity', () => {
  for (const duration of [.2,.24,.28]) {
    close(bounceHeight(-1,duration),0);
    close(bounceHeight(0,duration),0);
    close(bounceHeight(duration,duration),0);
    close(bounceHeight(duration+1,duration),0);
    assert.ok(bounceHeight(duration/2,duration)>0);
    const t=duration/2, dt=.01;
    close((bounceHeight(t-dt,duration)-2*bounceHeight(t,duration)+bounceHeight(t+dt,duration))/(dt*dt),-460);
  }
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
