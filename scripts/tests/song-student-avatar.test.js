const test = require('node:test');
const assert = require('node:assert/strict');
const { wardrobe } = require('../../js/song-video/student-avatar');

/** A renderer the test drives: each look it is asked for arrives on delivery. */
function renderer() {
  const pending = [];
  let requested = null;
  let requests = 0;
  return {
    renew: () => new Promise((resolve) => {
      requests += 1;
      pending.push(resolve);
      requested?.();
    }),
    get requests() { return requests; },
    async deliver(look) {
      if (!pending.length) await new Promise((resolve) => { requested = resolve; });
      pending.shift()(look);
      // A delivered look is stocked by promise callbacks, all run before any timer.
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
  };
}

/** A character dressed by `looks`, and every look it has been given. */
function character(looks, appearance, appearances) {
  const worn = [];
  return { worn, dress: looks.dresser((look) => worn.push(look), appearance, appearances) };
}

test('without renewal, every appearance keeps the first look', () => {
  const { worn, dress } = character(wardrobe('saved hero'), false);
  for (const appearance of [true, true, false, true, false, 'cue 1', 'cue 2']) dress(appearance);
  assert.deepEqual(worn, ['saved hero']);
});

test('with renewal, a look stays while its character remains on stage', { timeout: 2000 }, async () => {
  const looks = renderer();
  const { worn, dress } = character(wardrobe('first', looks.renew), true);
  await looks.deliver('second');
  for (let frame = 0; frame < 3; frame++) dress(true);
  assert.deepEqual(worn, ['first']);
});

test('looks for the planned appearances, and a spare, are rendered before any is needed', { timeout: 2000 }, async () => {
  const looks = renderer();
  const { worn, dress } = character(wardrobe('first', looks.renew), null, 2);
  for (const look of ['second', 'third', 'spare']) await looks.deliver(look);
  for (const appearance of ['cue 1', null, 'cue 2', null]) dress(appearance);
  assert.equal(looks.requests, 3, 'playback within the plan renders nothing more');
  dress('cue 1');
  assert.deepEqual(worn, ['first', 'second', 'third', 'spare']);
});

test('with renewal, every return to the stage takes a new look', { timeout: 2000 }, async () => {
  const looks = renderer();
  const { worn, dress } = character(wardrobe('first', looks.renew), false);
  for (const look of ['second', 'third']) {
    await looks.deliver(look);
    dress(true);
    dress(false);
  }
  assert.deepEqual(worn, ['first', 'second', 'third']);
});

test('a new cue is a new appearance, even with no frame off stage between', { timeout: 2000 }, async () => {
  const looks = renderer();
  const { worn, dress } = character(wardrobe('first', looks.renew), 'cue 1');
  await looks.deliver('second');
  dress('cue 1');
  dress('cue 2');
  assert.deepEqual(worn, ['first', 'second']);
});

test('while no new look is ready, a return repeats the last until one is', { timeout: 2000 }, async () => {
  const looks = renderer();
  const { worn, dress } = character(wardrobe('first', looks.renew), false);
  // Failed renders leave nothing new; an appearance without a look asks again.
  await looks.deliver(null);
  await looks.deliver(null);
  dress(true);
  dress(false);
  await looks.deliver('second');
  dress(true);
  assert.deepEqual(worn, ['first', 'second']);
});
