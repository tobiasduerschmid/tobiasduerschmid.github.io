const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const root = path.resolve(__dirname, '../..');
const vendor = path.join(root, 'js/vendor/smalltalk');

test('Smalltalk distribution verifies every artifact and upstream license notice', async () => {
  const { verifyDistribution } = await import('../smalltalk/build-image.mjs');
  const manifest = await verifyDistribution(vendor);
  assert.equal(manifest.squeakJS.version, '1.3.3');
  assert.equal(manifest.image.build, 22104);
  assert.equal(manifest.refactoringBrowser.version, '3.1');
  assert.match(fs.readFileSync(path.join(vendor, 'licenses/SqueakJS-LICENSE'), 'utf8'), /MIT License/);
  assert.match(fs.readFileSync(path.join(vendor, 'licenses/Squeak-LICENSE'), 'utf8'), /Apache License/);
  assert.ok(manifest.artifacts.some(asset => asset.kind === 'sources'));
  assert.ok(manifest.artifacts.some(asset => asset.kind === 'image'));
  assert.equal(manifest.artifacts.filter(asset => asset.kind === 'package').length, 15);
  assert.ok(!manifest.artifacts.some(asset => asset.path === 'rb-spelling.dat'));
  assert.ok(!fs.existsSync(path.join(vendor, 'rb-spelling.dat')));
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'scripts/smalltalk/inputs.json'))).spellingDictionary, undefined);
});

test('Smalltalk verification rejects deliberately corrupted declared bytes', async t => {
  const { verifyDistribution } = await import('../smalltalk/build-image.mjs');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'smalltalk-corrupt-'));
  t.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
  fs.cpSync(vendor, scratch, { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(path.join(scratch, 'manifest.json')));
  const image = manifest.artifacts.find(asset => asset.kind === 'image');
  fs.appendFileSync(path.join(scratch, image.path), Buffer.from([0]));
  await assert.rejects(verifyDistribution(scratch), /SHA-256 mismatch.*sebook.image/);
});
