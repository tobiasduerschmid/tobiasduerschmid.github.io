import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const vendor = path.join(root, 'js/vendor/smalltalk');
const nativeSources = ['SEBookWorkspace.st', 'SEBookChanges.st', 'SEBookTransactions.st', 'SEBookInspector.st', 'SEBookBrowser.st', 'SEBookRefactorings.st', 'SEBookStructuralGuard.st', 'SEBookService.st', 'prepare.st'];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const readJSON = async filename => JSON.parse(await fs.readFile(filename, 'utf8'));
const command = (program, args, cwd) => execFileSync(program, args, { cwd, timeout: 180000, stdio: 'inherit' });

/** Verify the complete published distribution without executing unverified bytes. */
export async function verifyDistribution(directory = vendor) {
  const manifest = await readJSON(path.join(directory, 'manifest.json'));
  if (manifest.version !== 1 || !Array.isArray(manifest.artifacts)) throw Error('Invalid Smalltalk manifest');
  const listed = new Set();
  for (const asset of manifest.artifacts) {
    if (!/^[a-f0-9]{64}$/.test(asset.sha256) || !asset.path || asset.path.startsWith('/') || asset.path.split('/').includes('..')) throw Error('Invalid artifact declaration');
    if (listed.has(asset.path)) throw Error('Duplicate artifact: ' + asset.path);
    listed.add(asset.path);
    const bytes = await fs.readFile(path.join(directory, asset.path));
    if (digest(bytes) !== asset.sha256 || bytes.length !== asset.bytes) throw Error('SHA-256 mismatch: ' + asset.path);
  }
  const runtimePaths = manifest.artifacts.filter(asset => asset.kind === 'runtime').map(asset => asset.path).sort();
  if (JSON.stringify([...manifest.runtimeOrder].sort()) !== JSON.stringify(runtimePaths)) throw Error('Runtime order must include every module exactly once');
  if (manifest.inputsSha256 !== digest(await fs.readFile(path.join(root, 'scripts/smalltalk/inputs.json')))) throw Error('Pinned input lock changed; rebuild image');
  for (const adapter of manifest.adapters) {
    const filename = path.resolve(vendor, adapter.path);
    if (!filename.startsWith(path.join(root, 'js/smalltalk/'))) throw Error('Adapter escapes Smalltalk runtime');
    if (digest(await fs.readFile(filename)) !== adapter.sha256) throw Error('SHA-256 mismatch: ' + adapter.path);
  }
  for (const name of nativeSources) {
    const source = await fs.readFile(path.join(root, 'smalltalk/image', name));
    const artifact = manifest.artifacts.find(asset => asset.path === 'source/' + name);
    if (!artifact || digest(source) !== artifact.sha256) throw Error('Image service changed; rebuild: ' + name);
  }
  for (const file of await filesUnder(directory)) {
    if (file !== 'manifest.json' && !listed.has(file)) throw Error('Undeclared artifact: ' + file);
  }
  for (const required of ['sebook.image', 'sebook.changes', 'SqueakV60.sources', 'licenses/SqueakJS-LICENSE', 'licenses/Squeak-LICENSE', 'source/SEBookService.st', 'source/prepare.st']) {
    if (!listed.has(required)) throw Error('Missing required artifact: ' + required);
  }
  return manifest;
}

async function filesUnder(directory, prefix = '') {
  const files = [];
  for (const entry of await fs.readdir(path.join(directory, prefix), { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(directory, relative));
    else if (entry.isFile()) files.push(relative);
    else throw Error('Non-regular distribution artifact: ' + relative);
  }
  return files.sort();
}

async function acquire(input, directory) {
  const filename = path.join(directory, input.file);
  try { await fs.access(filename); }
  catch { command('curl', ['-fL', '--retry', '2', input.url, '-o', filename]); }
  if (digest(await fs.readFile(filename)) !== input.sha256) throw Error('Pinned input mismatch: ' + input.file);
  return filename;
}

async function build() {
  const inputs = await readJSON(path.join(root, 'scripts/smalltalk/inputs.json'));
  if (os.platform() + '-' + os.arch() !== inputs.buildVM.platform) throw Error('Pinned build VM requires ' + inputs.buildVM.platform);
  const cache = process.env.SMALLTALK_INPUTS_DIRECTORY || path.join(os.tmpdir(), 'sebook-smalltalk-inputs');
  await fs.mkdir(cache, { recursive: true });
  const pins = [inputs.squeakJS, inputs.image, inputs.buildVM, ...inputs.refactoringBrowser.packages];
  for (const pin of pins) await acquire(pin, cache);
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'sebook-smalltalk-build-'));
  const imageDirectory = path.join(scratch, 'image');
  await fs.mkdir(imageDirectory);
  command('unzip', ['-q', path.join(cache, inputs.image.file), '-d', imageDirectory]);
  command('tar', ['-xzf', path.join(cache, inputs.squeakJS.file), '-C', scratch]);
  const upstream = path.join(scratch, 'SqueakJS-' + inputs.squeakJS.commit);
  if ((await readJSON(path.join(upstream, 'package.json'))).version !== inputs.squeakJS.version) throw Error('Release commit/version mismatch');
  for (const pin of inputs.refactoringBrowser.packages) await fs.copyFile(path.join(cache, pin.file), path.join(imageDirectory, pin.file));
  await fs.writeFile(path.join(imageDirectory, 'packages.txt'), inputs.refactoringBrowser.packages.map(pin => pin.file).join('\n') + '\n');
  for (const name of nativeSources) await fs.copyFile(path.join(root, 'smalltalk/image', name), path.join(imageDirectory, name));
  const mount = path.join(scratch, 'vm');
  command('hdiutil', ['attach', path.join(cache, inputs.buildVM.file), '-nobrowse', '-readonly', '-mountpoint', mount]);
  let vmFailure;
  try { command(path.join(mount, inputs.buildVM.executable), [...inputs.buildVM.flags, path.join(imageDirectory, 'Squeak6.0-22104-64bit.image'), path.join(imageDirectory, 'prepare.st')], imageDirectory); }
  catch (error) { vmFailure = error; }
  finally { command('hdiutil', ['detach', mount]); }
  const error = await fs.readFile(path.join(imageDirectory, 'build-error.txt'), 'utf8').catch(() => null);
  if (error) throw Error(error);
  if (vmFailure) throw vmFailure;
  const probe = await readJSON(path.join(imageDirectory, 'semantic-probe.json'));
  if (probe.imageBuild !== inputs.image.build || probe.refactoringBrowser !== inputs.refactoringBrowser.version || !probe.hasCompiler || !probe.hasSystemSources || probe.hasSpellingDictionary !== false) throw Error('Native semantic probe failed: ' + JSON.stringify(probe));
  await fs.mkdir(vendor, { recursive: true });
  // Remove the obsolete optional dictionary from this task-owned distribution explicitly.
  await fs.rm(path.join(vendor, 'rb-spelling.dat'), { force: true });
  for (const folder of ['runtime', 'packages', 'licenses', 'source']) await fs.mkdir(path.join(vendor, folder), { recursive: true });
  const copies = [
    ['sebook.image', path.join(imageDirectory, 'sebook.image')],
    ['sebook.changes', path.join(imageDirectory, 'Squeak6.0-22104-64bit.changes')],
    ['SqueakV60.sources', path.join(imageDirectory, 'SqueakV60.sources')],
    ['runtime/squeak_headless_bundle.js', path.join(upstream, 'dist/squeak_headless_bundle.js')],
    ['runtime/vm.plugins.file.browser.js', path.join(upstream, 'vm.plugins.file.browser.js')],
    ['licenses/SqueakJS-LICENSE', path.join(upstream, 'LICENSE.md')],
    ['licenses/Squeak-LICENSE', path.join(imageDirectory, 'Squeak-LICENSE')],
  ];
  const runtimeOrder = ['runtime/squeak_headless_bundle.js', 'runtime/vm.plugins.file.browser.js', 'runtime/vm.plugins.obsolete.js'];
  copies.push(['runtime/vm.plugins.obsolete.js', path.join(upstream, 'vm.plugins.obsolete.js')]);
  for (const name of ['MiscPrimitivePlugin', 'LargeIntegers', 'FloatArrayPlugin', 'BitBltPlugin', 'ZipPlugin']) {
    const filename = 'runtime/' + name + '.js';
    runtimeOrder.push(filename); copies.push([filename, path.join(upstream, 'plugins', name + '.js')]);
  }
  for (const pin of inputs.refactoringBrowser.packages) copies.push(['packages/' + pin.file, path.join(cache, pin.file)]);
  for (const name of nativeSources) copies.push(['source/' + name, path.join(root, 'smalltalk/image', name)]);
  for (const [destination, source] of copies) await fs.copyFile(source, path.join(vendor, destination));
  const artifacts = [];
  for (const filename of await filesUnder(vendor)) {
    if (filename === 'manifest.json') continue;
    const bytes = await fs.readFile(path.join(vendor, filename));
    const kind = filename.endsWith('.image') ? 'image' : filename.endsWith('.sources') ? 'sources' : filename.endsWith('.changes') ? 'changes' : filename.startsWith('runtime/') ? 'runtime' : filename.startsWith('packages/') ? 'package' : 'notice';
    artifacts.push({ path: filename, kind, bytes: bytes.length, sha256: digest(bytes) });
  }
  const adapters = [];
  for (const filename of ['protocol.js', 'filesystem.js', 'checkpoint.js', 'source-watch.js', 'structural-guard.js', 'worker.js']) adapters.push({ path: '../../smalltalk/' + filename, sha256: digest(await fs.readFile(path.join(root, 'js/smalltalk', filename))) });
  const manifest = { version: 1, adapters, runtimeOrder, squeakJS: inputs.squeakJS, image: { build: inputs.image.build, path: 'sebook.image' }, refactoringBrowser: inputs.refactoringBrowser, buildVM: inputs.buildVM, inputsSha256: digest(await fs.readFile(path.join(root, 'scripts/smalltalk/inputs.json'))), semanticProbe: probe, artifacts };
  await fs.writeFile(path.join(vendor, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await verifyDistribution();
  console.log('Prepared source-preserving image; verified manifest. Build evidence: ' + scratch);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.includes('--verify')) { const manifest = await verifyDistribution(); console.log('Verified ' + manifest.artifacts.length + ' Smalltalk artifacts'); }
    else await build();
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
