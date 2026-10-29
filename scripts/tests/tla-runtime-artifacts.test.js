const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readFile } = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

test('shipped TLA runtime bytecode matches the integrity manifest used by the browser', async () => {
  const manifest = pathToFileURL(path.resolve(__dirname, '../../js/tla/runtime-manifest.mjs'));
  const { ARTIFACTS } = await import(manifest.href);
  for (const artifact of ARTIFACTS) {
    const bytes = await readFile(new URL(artifact.path, manifest));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), artifact.sha256,
      artifact.name + ' must be rebuilt and pinned together with its browser manifest');
  }
});
