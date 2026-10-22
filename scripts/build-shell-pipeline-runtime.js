// Build the pinned browser interpreter once; GitHub Pages serves this static asset.
const esbuild = require('esbuild');
const fs = require('node:fs/promises');
const path = require('node:path');

async function build() {
  const output = path.resolve(__dirname, '../js/vendor/just-bash/3.6.0');
  await fs.mkdir(output, { recursive: true });
  await esbuild.build({
    stdin: {
      contents: 'export { Bash, getCommandNames, defineCommand } from "just-bash/browser";',
      resolveDir: path.resolve(__dirname, '..'),
      sourcefile: 'just-bash-browser-entry.js',
    },
    outfile: path.join(output, 'browser.mjs'),
    bundle: true,
    platform: 'browser',
    format: 'esm',
    minify: true,
    legalComments: 'linked',
    plugins: [{
      name: 'unavailable-node-compression',
      setup(builder) {
        // Upstream 3.6.0 still statically imports zlib in its browser entry.
        // These commands are excluded by our runtime; never silently fake output.
        builder.onResolve({ filter: /^node:zlib$/ }, () => ({ path: 'zlib', namespace: 'unavailable' }));
        builder.onLoad({ filter: /.*/, namespace: 'unavailable' }, () => ({
          contents: `export const constants = {};
            export function gunzipSync() { throw new Error('Compression is unavailable in this browser lab.'); }
            export const gzipSync = gunzipSync;`,
          loader: 'js',
        }));
      },
    }],
  });
  await fs.copyFile(path.resolve(__dirname, '../node_modules/just-bash/LICENSE'), path.join(output, 'LICENSE'));
}

build().catch(error => { console.error(error); process.exitCode = 1; });
