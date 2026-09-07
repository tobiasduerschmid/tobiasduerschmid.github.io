const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { gunzipSync } = require('node:zlib');

const root = path.resolve(__dirname, '../..');
const compiler = 'js/vendor/yowasp-clang/22.0.0-git20542-10';
const runtime = 'js/vendor/browser-wasi-shim/0.4.2';
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function filesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const name = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(name) : [name];
  });
}

test('C++ dependency release manifests cover every served file with matching hashes', () => {
  for (const relative of [compiler, runtime]) {
    const directory = path.join(root, relative);
    const manifest = fs.readFileSync(path.join(directory, 'SHA256SUMS'), 'utf8').trim().split('\n');
    const checked = [];
    for (const line of manifest) {
      const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
      assert.ok(match, `Malformed manifest entry: ${line}`);
      assert.equal(sha256(fs.readFileSync(path.join(directory, match[2]))), match[1], match[2]);
      checked.push(match[2]);
    }
    const actual = filesUnder(directory).map(file => path.relative(directory, file).split(path.sep).join('/'));
    assert.deepEqual(checked.sort(), actual.filter(file => file !== 'SHA256SUMS').sort());
  }
});

test('compressed compiler assets preserve the original pinned npm compiler and standard library bytes', () => {
  // Original SHA-256 values from the SHA-512-verified @yowasp/clang archive.
  const upstream = {
    'gen/llvm-resources.tar': '79eef0c336fe55cf03ff8f5b42b784c8168f929a3603138b2c6301f4601e4c86',
    'gen/llvm.core.wasm': '24fbed474c7b5b4968fd73fc4827440b93fb351c1b6264516130300eff3e7bf5',
    'gen/llvm.core2.wasm': '960c326eb9b5db7aedbc169540421587a2d3f3ff987e93d6ad5b4da43430ffd4',
    'gen/llvm.core3.wasm': '63680c043192abac4700bbda6a78e4c19b139fa086b1e872d1c6915d37a428a8',
    'gen/llvm.core4.wasm': 'f544dc9cc46f88a0f22d1b839a4fb0853dce2d6e231d880bd19754c59a5a234d',
  };
  for (const [name, expected] of Object.entries(upstream)) {
    assert.equal(sha256(gunzipSync(fs.readFileSync(path.join(root, compiler, `${name}.gz`)))), expected, name);
  }
});

test('upstream license notices retain their verified content and source metadata', () => {
  const expectedSources = fs.readFileSync(path.join(root, 'scripts/cpp-runtime-license-sources.json'), 'utf8');
  const licenseDirectory = path.join(root, compiler, 'licenses');
  assert.equal(fs.readFileSync(path.join(licenseDirectory, 'SOURCES.json'), 'utf8'), expectedSources);
  for (const [name, metadata] of Object.entries(JSON.parse(expectedSources))) {
    assert.ok(metadata.source, `${name} needs its upstream origin`);
    assert.equal(sha256(fs.readFileSync(path.join(licenseDirectory, name))), metadata.sha256, name);
  }
});
