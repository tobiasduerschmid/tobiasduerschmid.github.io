// Node CLI wrapper around `js/uml-auto-describe.js` so the Jekyll plugin in
// `_plugins/uml_static.rb` can reuse the browser describer instead of carrying
// a parallel Ruby implementation. Reads a JSON map `{idx: {type, spec}, …}` on
// stdin and writes `{idx: description, …}` on stdout. Errors go to stderr and
// the process exits non-zero so the Ruby caller can fall back to a plain type
// name. The same file backs the live tutorial diagrams via the browser, so
// any change to the parser or output style automatically applies to both
// build paths.
const fs = require('fs');
const path = require('path');

// Mock the browser globals the source file expects. `uml-auto-describe.js`
// only touches `window` (to expose its API) and `console` (warnings); both
// are available or trivially stubbed in Node.
global.window = global.window || {};
const src = fs.readFileSync(path.join(__dirname, 'uml-auto-describe.js'), 'utf8');
// eslint-disable-next-line no-eval -- intentional: load the browser file
// wholesale so its IIFE registers `window.UMLAutoDescribe` for us.
eval(src);

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { buf += chunk; });
process.stdin.on('end', () => {
  try {
    const describe = (global.window.UMLAutoDescribe || {}).describe;
    if (typeof describe !== 'function') {
      throw new Error('uml-auto-describe.js did not register window.UMLAutoDescribe.describe');
    }
    const input = buf.trim() ? JSON.parse(buf) : {};
    const out = {};
    for (const [idx, payload] of Object.entries(input)) {
      const { type, spec } = payload || {};
      out[idx] = describe(type, spec);
    }
    process.stdout.write(JSON.stringify(out));
  } catch (err) {
    process.stderr.write('uml-describe-cli failed: ' + err.message + '\n');
    process.exit(1);
  }
});
