// Node CLI wrapper around `js/uml-auto-describe.js` so the Jekyll plugin in
// `_plugins/uml_static.rb` can reuse the browser describer instead of carrying
// a parallel Ruby implementation. Reads `{idx: {type, spec}, ...}` on stdin
// and writes `{idx: {brief, verbose}, ...}` on stdout.
const fs = require('fs');
const path = require('path');

global.window = global.window || {};
const src = fs.readFileSync(path.join(__dirname, 'uml-auto-describe.js'), 'utf8');
// eslint-disable-next-line no-eval -- intentional: load the browser file so it
// registers window.UMLAutoDescribe for the production build path.
eval(src);

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { buf += chunk; });
process.stdin.on('end', () => {
  try {
    const api = global.window.UMLAutoDescribe || {};
    const { describe, describeVerbose } = api;
    if (typeof describe !== 'function' || typeof describeVerbose !== 'function') {
      throw new Error('uml-auto-describe.js did not register describe/describeVerbose');
    }

    const input = buf.trim() ? JSON.parse(buf) : {};
    const out = {};
    for (const [idx, payload] of Object.entries(input)) {
      const { type, spec } = payload || {};
      out[idx] = {
        brief: describe(type, spec),
        verbose: describeVerbose(type, spec)
      };
    }
    process.stdout.write(JSON.stringify(out));
  } catch (err) {
    process.stderr.write('uml-describe-cli failed: ' + err.message + '\n');
    process.exit(1);
  }
});
