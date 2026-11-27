const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

test('diagram descriptions work without a document or browser lifecycle timers', () => {
  // The static build needs only text descriptions, with no browser to initialize.
  const environment = { window: {} };
  const source = fs.readFileSync(path.join(__dirname, '../../js/uml-auto-describe.js'), 'utf8');

  vm.runInNewContext(source, environment);

  assert.match(environment.window.UMLAutoDescribe.describe('class', 'class Order'), /1 class.*Order/);
});
