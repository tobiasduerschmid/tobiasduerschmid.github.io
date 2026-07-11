const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const zlib = require('node:zlib');

const repositoryRoot = path.resolve(__dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
}

function parseAssignments(source) {
  return Object.fromEntries(source
    .split('\n')
    .filter(line => /^[A-Z0-9_]+=/.test(line))
    .map(line => {
      const separator = line.indexOf('=');
      return [line.slice(0, separator), line.slice(separator + 1)];
    }));
}

function inspectNewcArchive(bytes, capturedNames = new Set()) {
  const names = new Set();
  const capturedFiles = new Map();
  const align4 = value => (value + 3) & ~3;
  let offset = 0;

  while (offset + 110 <= bytes.length) {
    const magic = bytes.toString('ascii', offset, offset + 6);
    assert.ok(magic === '070701' || magic === '070702',
      `rootfs contains an invalid newc header at byte ${offset}`);
    const fileSize = Number.parseInt(bytes.toString('ascii', offset + 54, offset + 62), 16);
    const nameSize = Number.parseInt(bytes.toString('ascii', offset + 94, offset + 102), 16);
    assert.ok(Number.isSafeInteger(fileSize) && Number.isSafeInteger(nameSize) && nameSize > 0,
      `rootfs contains invalid newc sizes at byte ${offset}`);

    const nameStart = offset + 110;
    const nameEnd = nameStart + nameSize - 1;
    const rawName = bytes.toString('utf8', nameStart, nameEnd);
    const name = rawName.replace(/^\.\//, '');
    const dataStart = align4(nameStart + nameSize);
    const dataEnd = dataStart + fileSize;
    assert.ok(dataEnd <= bytes.length, `rootfs entry ${name} extends beyond the archive`);
    if (name === 'TRAILER!!!') break;

    names.add(name);
    if (capturedNames.has(name)) capturedFiles.set(name, bytes.subarray(dataStart, dataEnd));
    offset = align4(dataEnd);
  }

  return { names, capturedFiles };
}

function parseApkInstalledDatabase(bytes) {
  const packages = new Map();
  for (const record of bytes.toString('utf8').split(/\n\n+/)) {
    const name = record.match(/^P:(.+)$/m)?.[1];
    const version = record.match(/^V:(.+)$/m)?.[1];
    if (name && version) packages.set(name, version);
  }
  return packages;
}

function verifyVmReleaseChecksums() {
  const expectedFiles = ['SNAPSHOT_INPUTS', 'bzImage', 'rootfs.cpio.gz', 'state.bin.gz'];
  const manifestEntries = read('vm/dist/SHA256SUMS').trim().split('\n').map(line => {
    const match = line.match(/^([a-f0-9]{64})  ([A-Za-z0-9._-]+)$/);
    assert.ok(match, `vm/dist/SHA256SUMS has a malformed entry: ${line}`);
    return [match[2], match[1]];
  });
  assert.deepEqual(manifestEntries.map(([filename]) => filename), expectedFiles,
    'VM release checksums must cover every published compatibility artifact in stable order');
  for (const [filename, expectedHash] of manifestEntries) {
    const bytes = fs.readFileSync(path.join(repositoryRoot, 'vm/dist', filename));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), expectedHash,
      `vm/dist/${filename} must match its release checksum`);
  }
}

function relativeFilePathsUnder(relativeDirectory) {
  const root = path.join(repositoryRoot, relativeDirectory);
  const files = [];
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(fullPath);
      else if (entry.isFile()) files.push(path.relative(root, fullPath).split(path.sep).join('/'));
    }
  };
  visit(root);
  return files.sort();
}

function verifyChecksumManifest(relativeDirectory) {
  const manifest = read(path.join(relativeDirectory, 'SHA256SUMS'));
  const entries = new Map(manifest.trim().split('\n').map(line => {
    const match = line.match(/^([a-f0-9]{64})  (.+)$/);
    assert.ok(match, `${relativeDirectory}/SHA256SUMS has a malformed entry: ${line}`);
    return [match[2], match[1]];
  }));
  const actualFiles = relativeFilePathsUnder(relativeDirectory)
    .filter(relativePath => relativePath !== 'SHA256SUMS');
  assert.deepEqual([...entries.keys()].sort(), actualFiles,
    `${relativeDirectory}/SHA256SUMS must cover every vendored file exactly once`);

  for (const [relativePath, expectedHash] of entries) {
    const bytes = fs.readFileSync(path.join(repositoryRoot, relativeDirectory, relativePath));
    assert.equal(
      crypto.createHash('sha256').update(bytes).digest('hex'),
      expectedHash,
      `${relativeDirectory}/${relativePath} must match its reviewed SHA-256`,
    );
  }
  return entries;
}

function sourceFilesUnder(relativeDirectory) {
  const root = path.join(repositoryRoot, relativeDirectory);
  const files = [];
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(fullPath);
      else if (entry.isFile() && entry.name.endsWith('.js')) files.push(fullPath);
    }
  };
  visit(root);
  return files;
}

test('worker dependencies execute only after their pinned SHA-256 digest matches', (t) => {
  const helperPath = path.join(repositoryRoot, 'js/vendor/worker-script-integrity.js');
  const originalXmlHttpRequest = globalThis.XMLHttpRequest;
  const originalImportScripts = globalThis.importScripts;
  delete require.cache[require.resolve(helperPath)];
  require(helperPath);
  t.after(() => {
    delete globalThis.SEBookWorkerScriptIntegrity;
    delete require.cache[require.resolve(helperPath)];
    if (originalXmlHttpRequest === undefined) delete globalThis.XMLHttpRequest;
    else globalThis.XMLHttpRequest = originalXmlHttpRequest;
    if (originalImportScripts === undefined) delete globalThis.importScripts;
    else globalThis.importScripts = originalImportScripts;
  });

  const integrity = globalThis.SEBookWorkerScriptIntegrity;
  assert.equal(
    integrity.sha256Hex(new TextEncoder().encode('')),
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  );
  assert.equal(
    integrity.sha256Hex(new TextEncoder().encode('abc')),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );

  let unverifiedScriptExecuted = false;
  globalThis.XMLHttpRequest = class TamperedDependencyRequest {
    open() {}
    send() {
      this.status = 200;
      this.response = new TextEncoder().encode('globalThis.tampered = true;').buffer;
    }
  };
  globalThis.importScripts = () => { unverifiedScriptExecuted = true; };
  assert.throws(
    () => integrity.importDependency('acorn'),
    /Integrity check failed for worker dependency "acorn"/,
  );
  assert.equal(unverifiedScriptExecuted, false, 'changed CDN bytes must never execute');

  for (const [name, dependency] of Object.entries(integrity.dependencies)) {
    assert.match(dependency.url, /^https:\/\//, `${name} must use HTTPS`);
    assert.doesNotMatch(dependency.url, /(?:@(?:latest|next|\d+)(?:\/|$)|\/master\/)/);
    assert.match(dependency.sha256, /^[a-f0-9]{64}$/, `${name} must pin a SHA-256 digest`);
  }

  for (const filePath of sourceFilesUnder('js')) {
    const source = fs.readFileSync(filePath, 'utf8');
    assert.doesNotMatch(
      source,
      /importScripts\s*\(\s*['"]https:\/\//,
      `${path.relative(repositoryRoot, filePath)} must use the verified worker dependency adapter`,
    );
  }
});

test('cross-origin page scripts are version-pinned and carry SRI metadata', () => {
  const htmlSources = [
    '_includes/head.html',
    '_includes/js.html',
    '_includes/scripts.html',
    '_layouts/tutorial.html',
    'tutorial-instructions-popup.html',
    'tutorial-pane-popup.html',
    'tutorial-tab-popup.html',
    'uml-python-workspace.html',
  ];

  for (const relativePath of htmlSources) {
    const tags = read(relativePath).match(/<script\b[^>]*\bsrc=["']https:\/\/[^>]*>/g) || [];
    for (const tag of tags) {
      assert.match(tag, /\bintegrity=["']sha384-[A-Za-z0-9+/=]+["']/,
        `${relativePath} remote script must carry SHA-384 integrity metadata`);
      assert.match(tag, /\bcrossorigin=["']anonymous["']/i,
        `${relativePath} remote script must request anonymous CORS`);
      assert.doesNotMatch(tag, /(?:@(?:latest|next|\d+)(?:\/|["'])|\/master\/)/,
        `${relativePath} remote script must use an exact version`);
    }
  }

  const tutorialRuntime = read('js/tutorial-code.js');
  const embeddedRemoteTags = tutorialRuntime.match(
    /<(?:script|link)\b[^>]*(?:src|href)=["']https:\/\/[^>]*>/g,
  ) || [];
  assert.equal(embeddedRemoteTags.length, 5,
    'React preview must keep all five reviewed cross-origin dependencies visible to this audit');
  for (const tag of embeddedRemoteTags) {
    assert.match(tag, /\bintegrity=["']sha384-[A-Za-z0-9+/=]+["']/,
      'React preview cross-origin assets must carry SHA-384 integrity metadata');
    assert.match(tag, /\bcrossorigin=["']anonymous["']/i,
      'React preview cross-origin assets must request anonymous CORS');
    const assetUrl = tag.match(/(?:src|href)=["'](https:\/\/[^"']+)["']/)?.[1] || '';
    assert.match(assetUrl,
      /^https:\/\/cdn\.jsdelivr\.net\/npm\/(?:@[^/]+\/)?[^/@]+@\d+\.\d+\.\d+(?:[+-][^/]*)?\//,
      `React preview asset must use an exact package version: ${assetUrl}`);
  }
  assert.doesNotMatch(tutorialRuntime, /react(?:-dom)?@18\//);
  assert.doesNotMatch(tutorialRuntime, /typescript@5\//);
  assert.doesNotMatch(tutorialRuntime, /@babel\/standalone\/babel/);
  assert.match(tutorialRuntime, /WEBCONTAINER: '\/js\/vendor\/webcontainer\/api-1\.6\.4\.js'/,
    'WebContainer API and its transitive modules must be served from a reviewed local snapshot');

  const webContainerSnapshot = read('js/vendor/webcontainer/api-1.6.4.js');
  assert.equal(
    crypto.createHash('sha256').update(webContainerSnapshot).digest('hex'),
    '0a8c0e2e1efdb3b67bfaf67ddcc393fb4cf14a8a2fd89c5e223065d74a98ed0e',
  );
  assert.doesNotMatch(webContainerSnapshot, /\b(?:import|export)\s+[^;]*\sfrom\s*['"]\.\//,
    'the reviewed WebContainer snapshot must not regain unchecked relative imports');
});

test('Monaco loads only from its complete reviewed local AMD runtime', () => {
  const versionDirectory = 'js/vendor/monaco-editor/0.44.0';
  const checksums = verifyChecksumManifest(versionDirectory);
  assert.equal(checksums.size, 116, 'Monaco 0.44.0 snapshot must contain the complete min/vs tree');

  const requiredRuntimeFiles = [
    'LICENSE',
    'README.md',
    'ThirdPartyNotices.txt',
    'min/vs/loader.js',
    'min/vs/editor/editor.main.js',
    'min/vs/editor/editor.main.css',
    'min/vs/base/worker/workerMain.js',
    'min/vs/base/browser/ui/codicons/codicon/codicon.ttf',
    'min/vs/language/css/cssWorker.js',
    'min/vs/language/html/htmlWorker.js',
    'min/vs/language/json/jsonWorker.js',
    'min/vs/language/typescript/tsWorker.js',
  ];
  for (const requiredFile of requiredRuntimeFiles) {
    assert.ok(checksums.has(requiredFile), `Monaco snapshot is missing ${requiredFile}`);
  }

  const tutorialRuntime = read('js/tutorial-code.js');
  const sharedEditor = read('js/popout/shared-editor.js');
  assert.match(tutorialRuntime,
    /MONACO_LOADER: '\/js\/vendor\/monaco-editor\/0\.44\.0\/min\/vs\/loader\.js'/);
  assert.match(tutorialRuntime,
    /MONACO_VS: '\/js\/vendor\/monaco-editor\/0\.44\.0\/min\/vs'/);
  assert.match(sharedEditor,
    /var MONACO_VS = '\/js\/vendor\/monaco-editor\/0\.44\.0\/min\/vs';/);

  for (const relativePath of ['tutorial-pane-popup.html', 'tutorial-tab-popup.html']) {
    const popup = read(relativePath);
    assert.match(popup,
      /\/js\/vendor\/monaco-editor\/0\.44\.0\/min\/vs\/loader\.js/,
      `${relativePath} must bootstrap the reviewed local Monaco loader`);
    assert.doesNotMatch(popup, /cdn\.jsdelivr\.net\/npm\/monaco-editor/);
  }
  assert.doesNotMatch(`${tutorialRuntime}\n${sharedEditor}`,
    /cdn\.jsdelivr\.net\/npm\/monaco-editor/);
});

test('Pyodide boot and tutorial package closures are complete and same-origin', () => {
  const versionDirectory = 'js/vendor/pyodide/0.27.0';
  const checksums = verifyChecksumManifest(versionDirectory);
  for (const requiredFile of [
    'LICENSE',
    'README.md',
    'pyodide.js',
    'pyodide.asm.js',
    'pyodide.asm.wasm',
    'python_stdlib.zip',
    'pyodide-lock.json',
  ]) {
    assert.ok(checksums.has(requiredFile), `Pyodide snapshot is missing ${requiredFile}`);
  }

  const upstreamLockBytes = fs.readFileSync(
    path.join(repositoryRoot, versionDirectory, 'pyodide-lock.upstream.json'),
  );
  assert.equal(
    crypto.createHash('sha256').update(upstreamLockBytes).digest('hex'),
    '92bc66cf0095ea9dbbdab7f86dd6a1c51dc0e1a21f8ed90794304dc5f220dc64',
    'the upstream Pyodide 0.27.0 lock must remain byte-for-byte unchanged',
  );

  const upstreamLock = JSON.parse(upstreamLockBytes);
  const servedLock = JSON.parse(read(path.join(versionDirectory, 'pyodide-lock.json')));
  const overrides = JSON.parse(read(path.join(versionDirectory, 'package-overrides.json')));
  assert.deepEqual(servedLock.info, upstreamLock.info);
  assert.equal(servedLock.info.version, '0.27.0');
  for (const [packageName, metadata] of Object.entries(overrides.packages)) {
    assert.deepEqual(servedLock.packages[packageName], metadata,
      `${packageName} override must be present verbatim in the served lock`);
  }

  const requiredRoots = new Set(['pytest', 'hypothesis', 'pyflakes']);
  const tutorialDirectory = path.join(repositoryRoot, '_data/tutorials');
  for (const entry of fs.readdirSync(tutorialDirectory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.yml')) continue;
    const source = fs.readFileSync(path.join(tutorialDirectory, entry.name), 'utf8');
    for (const match of source.matchAll(/loadPackage\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      requiredRoots.add(match[1]);
    }
  }

  const packageClosure = new Set();
  const includePackage = packageName => {
    if (packageClosure.has(packageName)) return;
    const metadata = servedLock.packages[packageName];
    assert.ok(metadata, `local Pyodide lock is missing required package ${packageName}`);
    packageClosure.add(packageName);
    for (const dependencyName of metadata.depends) includePackage(dependencyName);
  };
  for (const packageName of requiredRoots) includePackage(packageName);

  const expectedWheels = [...packageClosure]
    .map(packageName => servedLock.packages[packageName].file_name)
    .sort();
  const actualWheels = relativeFilePathsUnder(versionDirectory)
    .filter(relativePath => relativePath.endsWith('.whl'));
  assert.deepEqual(actualWheels, expectedWheels,
    'local Pyodide directory must contain exactly the full package closure tutorials execute');
  for (const packageName of packageClosure) {
    const metadata = servedLock.packages[packageName];
    const bytes = fs.readFileSync(path.join(repositoryRoot, versionDirectory, metadata.file_name));
    assert.equal(
      crypto.createHash('sha256').update(bytes).digest('hex'),
      metadata.sha256,
      `${packageName} wheel must match its lockfile SHA-256`,
    );
  }

  const workerSources = ['js/pyodide-worker.js', 'js/python-ast-worker.js'].map(read);
  for (const workerSource of workerSources) {
    assert.match(workerSource,
      /var PYODIDE_INDEX_URL = '\/js\/vendor\/pyodide\/0\.27\.0\/';/);
    assert.match(workerSource, /importScripts\(PYODIDE_INDEX_URL \+ 'pyodide\.js'\);/);
    assert.match(workerSource, /loadPyodide\(\{[\s\S]*?indexURL: PYODIDE_INDEX_URL/);
    assert.doesNotMatch(workerSource, /https:\/\/[^'"\s]*pyodide/i,
      'Pyodide core assets must not regain a cross-origin URL');
  }
  assert.doesNotMatch(workerSources[0], /loadPackage\(['"]micropip|micropip\.install/,
    'the reviewed local Pyflakes wheel must not regain a mutable package-index fallback');
});

test('VM regeneration and deployed snapshots match their pinned compatibility inputs', () => {
  const inputs = read('vm/build-inputs.env');
  const setup = read('vm/setup.sh');
  const rootfsBuild = read('vm/build-rootfs.sh');
  const snapshotBuild = read('vm/build-snapshot.js');
  const values = parseAssignments(inputs);

  assert.match(inputs, /^ALPINE_IMAGE=alpine@sha256:[a-f0-9]{64}$/m);
  assert.match(inputs, /^TCC_COMMIT=[a-f0-9]{40}$/m);
  assert.match(inputs, /^APK_LINUX_VIRT_VERSION=\d+\.\d+\.\d+-r\d+$/m);
  assert.match(inputs, /^V86_LIBV86_SHA256=[a-f0-9]{64}$/m);
  assert.match(inputs, /^V86_WASM_SHA256=[a-f0-9]{64}$/m);
  assert.doesNotMatch(`${setup}\n${rootfsBuild}`, /releases\/latest|\/master\/|clone --depth 1/);
  assert.match(setup, /verify_pinned_artifact "\$V86_DIR\/libv86\.js"/);
  assert.match(rootfsBuild, /"bash=\$APK_BASH_VERSION"/);
  assert.match(rootfsBuild, /"linux-virt=\$APK_LINUX_VIRT_VERSION"/);
  assert.match(rootfsBuild, /expected-apk-runtime\.lock:ro/);
  assert.match(rootfsBuild, /diff -u \/expected-apk-runtime\.lock \/tmp\/apk-runtime\.actual/);
  assert.doesNotMatch(rootfsBuild, /apk add[^\n]*linux-virt[^\n]*\|\| true/);
  assert.match(rootfsBuild, /test -s \/output\/\.bzImage\.new/);
  assert.match(rootfsBuild, /mv "\$DIST_DIR\/\.bzImage\.new" "\$DIST_DIR\/bzImage"/);
  assert.match(rootfsBuild, /gzip -t \/output\/\.rootfs\.cpio\.gz\.new/);
  assert.match(rootfsBuild,
    /mv "\$DIST_DIR\/\.rootfs\.cpio\.gz\.new" "\$DIST_DIR\/rootfs\.cpio\.gz"/);
  assert.match(rootfsBuild, /Invalidated the previous VM snapshot/);
  assert.match(rootfsBuild, /git checkout --detach "\$TCC_COMMIT"/);
  assert.match(snapshotBuild, /fs\.renameSync\(OUT_TMP, OUT\)/);
  assert.match(snapshotBuild, /writeReleaseMetadata\(\)/);

  const pinnedArtifacts = [
    ['assets/v86/libv86.js', 'V86_LIBV86_SHA256'],
    ['assets/v86/v86.wasm', 'V86_WASM_SHA256'],
    ['assets/v86/seabios.bin', 'V86_SEABIOS_SHA256'],
    ['assets/v86/vgabios.bin', 'V86_VGABIOS_SHA256'],
  ];
  for (const [relativePath, hashVariable] of pinnedArtifacts) {
    const bytes = fs.readFileSync(path.join(repositoryRoot, relativePath));
    assert.equal(
      crypto.createHash('sha256').update(bytes).digest('hex'),
      values[hashVariable],
      `${relativePath} must match ${hashVariable}`,
    );
  }

  verifyVmReleaseChecksums();

  const rootfsBytes = zlib.gunzipSync(
    fs.readFileSync(path.join(repositoryRoot, 'vm/dist/rootfs.cpio.gz')),
  );
  const installedDatabasePath = 'lib/apk/db/installed';
  const rootfs = inspectNewcArchive(rootfsBytes, new Set([installedDatabasePath]));
  const installedDatabase = rootfs.capturedFiles.get(installedDatabasePath);
  assert.ok(installedDatabase, 'VM rootfs must contain Alpine installed-package metadata');
  assert.equal(rootfs.names.has('expected-apk-runtime.lock'), false,
    'VM rootfs must not publish its build-only package-closure mount');
  assert.equal(rootfs.names.has('tmp/apk-runtime.actual'), false,
    'VM rootfs must not publish its build-only package-closure scratch file');
  const installedPackages = parseApkInstalledDatabase(installedDatabase);
  const deployedPackageClosure = [...installedPackages]
    .map(([packageName, version]) => `${packageName}=${version}`)
    .sort();
  assert.deepEqual(
    read('vm/apk-runtime.lock').trim().split('\n'),
    deployedPackageClosure,
    'deployed rootfs must match the reviewed complete Alpine runtime closure',
  );
  const pinnedRuntimePackages = {
    APK_BASH_VERSION: 'bash',
    APK_COREUTILS_VERSION: 'coreutils',
    APK_DIFFUTILS_VERSION: 'diffutils',
    APK_FINDUTILS_VERSION: 'findutils',
    APK_GREP_VERSION: 'grep',
    APK_SED_VERSION: 'sed',
    APK_GAWK_VERSION: 'gawk',
    APK_GIT_VERSION: 'git',
    APK_MAKE_VERSION: 'make',
    APK_NANO_VERSION: 'nano',
    APK_LESS_VERSION: 'less',
    APK_FILE_VERSION: 'file',
    APK_TREE_VERSION: 'tree',
    APK_MUSL_DEV_VERSION: 'musl-dev',
    APK_LINUX_VIRT_VERSION: 'linux-virt',
  };
  for (const [variableName, packageName] of Object.entries(pinnedRuntimePackages)) {
    assert.equal(installedPackages.get(packageName), values[variableName],
      `deployed rootfs package ${packageName} must match ${variableName}`);
  }

  const kernelVersion = values.APK_LINUX_VIRT_VERSION.replace(/-r\d+$/, '');
  const kernelRelease = `${kernelVersion}-0-virt`;
  assert.ok(rootfs.names.has(`lib/modules/${kernelRelease}/modules.dep`),
    `rootfs module tree must match deployed kernel ${kernelRelease}`);
  for (const modulePattern of ['9p.ko', '9pnet_virtio.ko', 'virtio_blk.ko', 'virtio_net.ko']) {
    assert.ok([...rootfs.names].some(name =>
      name.startsWith(`lib/modules/${kernelRelease}/`) && name.includes(modulePattern)),
    `rootfs must retain required ${modulePattern} payload`);
  }
  const kernelBytes = fs.readFileSync(path.join(repositoryRoot, 'vm/dist/bzImage'));
  assert.ok(kernelBytes.includes(Buffer.from(kernelRelease)),
    `bzImage must identify itself as ${kernelRelease}`);

  const snapshotInputs = parseAssignments(read('vm/dist/SNAPSHOT_INPUTS'));
  const snapshotDependencies = {
    BZIMAGE_SHA256: 'vm/dist/bzImage',
    ROOTFS_SHA256: 'vm/dist/rootfs.cpio.gz',
    V86_LIBV86_SHA256: 'assets/v86/libv86.js',
    V86_WASM_SHA256: 'assets/v86/v86.wasm',
    V86_SEABIOS_SHA256: 'assets/v86/seabios.bin',
    V86_VGABIOS_SHA256: 'assets/v86/vgabios.bin',
  };
  for (const [hashName, relativePath] of Object.entries(snapshotDependencies)) {
    const bytes = fs.readFileSync(path.join(repositoryRoot, relativePath));
    const actualHash = crypto.createHash('sha256').update(bytes).digest('hex');
    assert.equal(snapshotInputs[hashName], actualHash,
      `VM snapshot must be regenerated when ${relativePath} changes`);
    if (values[hashName]) assert.equal(snapshotInputs[hashName], values[hashName]);
  }
  assert.equal(snapshotInputs.MEMORY_MB, '192');
  assert.equal(snapshotInputs.VGA_MEMORY_MB, '2');
  assert.match(read('vm/snapshot/index.html'), /var MEMORY_MB = 192;/);
  assert.match(read('vm/snapshot/index.html'), /vga_memory_size: 2 \* 1024 \* 1024/);
  assert.match(read('js/tutorial-code.js'), /memoryMB: options\.memoryMB \|\| 192/);
  assert.match(read('js/tutorial-code.js'), /vga_memory_size: 2 \* 1024 \* 1024/);
});
