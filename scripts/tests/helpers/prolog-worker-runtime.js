const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parentPort } = require('node:worker_threads');

const repositoryRoot = path.resolve(__dirname, '../../..');

// Replace only Worker transport. Omit Node globals so Tau follows its genuine
// browser path; every language operation uses the reviewed interpreter bytes.
const context = vm.createContext({
  console: { log() {}, error() {} }, setTimeout, clearTimeout,
  postMessage: message => parentPort.postMessage(message),
  importScripts(...urls) {
    for (const url of urls) {
      assert.ok(url.startsWith('/js/vendor/'), 'Prolog must boot from local reviewed runtime files');
      vm.runInContext(fs.readFileSync(path.join(repositoryRoot, url), 'utf8'), context, { filename: url });
    }
  },
});
context.self = context;
vm.runInContext(fs.readFileSync(path.join(repositoryRoot, 'js/prolog-worker.js'), 'utf8'), context);
parentPort.on('message', data => context.onmessage({ data }));
