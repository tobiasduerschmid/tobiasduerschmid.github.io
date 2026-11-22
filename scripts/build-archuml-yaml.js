'use strict';
// Bundles the `yaml` npm package into a single browser-and-Node file vendored
// under js/ArchUML/vendor/yaml/<version>/. Regenerate with:
//   node scripts/build-archuml-yaml.js
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const esbuild = require('esbuild');

const ROOT = path.resolve(__dirname, '..');
const YAML_VERSION = require('yaml/package.json').version;
const OUT_DIR = path.join(ROOT, 'js', 'ArchUML', 'vendor', 'yaml', YAML_VERSION);
const REGENERATE_COMMAND = 'node scripts/build-archuml-yaml.js';

const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

function npmIntegrity() {
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
  return lock.packages['node_modules/yaml'].integrity;
}

function bundleYaml() {
  const result = esbuild.buildSync({
    stdin: { contents: "module.exports = require('yaml');", resolveDir: ROOT },
    bundle: true,
    format: 'iife',
    globalName: 'ArchUMLYAML',
    platform: 'browser',
    target: 'es2019',
    minify: true,
    legalComments: 'inline',
    footer: { js: "if (typeof module === 'object' && module.exports) { module.exports = ArchUMLYAML; }" },
    write: false,
  });
  return result.outputFiles[0].text;
}

function readmeText() {
  return [
    '# Vendored yaml',
    '',
    '- Package: yaml',
    `- Version: ${YAML_VERSION}`,
    '- Licence: ISC (see LICENSE)',
    `- npm integrity: ${npmIntegrity()}`,
    '',
    'Bundled for browsers and Node as one file that defines the global `ArchUMLYAML`',
    'and also assigns it to `module.exports` when loaded with `require`.',
    '',
    `Regenerate with \`${REGENERATE_COMMAND}\`. Do not edit the vendored files by hand.`,
    '',
  ].join('\n');
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const bundle = bundleYaml();
  const license = fs.readFileSync(path.join(ROOT, 'node_modules', 'yaml', 'LICENSE'), 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'yaml.js'), bundle);
  fs.writeFileSync(path.join(OUT_DIR, 'LICENSE'), license);
  fs.writeFileSync(path.join(OUT_DIR, 'README.md'), readmeText());
  fs.writeFileSync(path.join(OUT_DIR, 'SHA256SUMS'), `${sha256(bundle)}  yaml.js\n${sha256(license)}  LICENSE\n`);
}

main();
