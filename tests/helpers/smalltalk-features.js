// Read the production capability declaration; tests must not invent a second flag.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const scope = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../js/smalltalk/protocol.js'), 'utf8'), { self: scope });
module.exports = scope.SEBookSmalltalk.FEATURES;
