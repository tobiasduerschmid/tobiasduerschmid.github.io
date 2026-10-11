'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const context = { window: {}, setInterval() {}, clearInterval() {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../js/uml-auto-describe.js'), 'utf8'), context);
const descriptions = context.window.UMLAutoDescribe;

test('deployment text alternatives name aliased nodes, artifacts and components', () => {
  const source='node "Web Server" as web <<device>> {\n artifact "app.war" as App\n component "Application runtime" as Runtime\n}\nartifact "settings.xml" as Config\nnode "Database server" as DB';
  const summary=descriptions.describe('deployment',source);
  assert.match(summary,/2 nodes.*Web Server.*Database server/);
  assert.match(summary,/2 artifacts.*app\.war.*settings\.xml/);
  assert.match(summary,/1 component.*Application runtime/);
  assert.doesNotMatch(summary,/as web|as App|as Runtime/);
  const verbose=descriptions.describeVerbose('deployment',source);
  const text=JSON.stringify(verbose.sections);
  for(const label of ['Web Server','app.war','Application runtime','settings.xml','Database server']) assert.ok(text.includes(label),label+' is announced');
  assert.match(text,/Web Server.*contains.*app\.war.*Application runtime/);
  assert.match(text,/device/);
});

test('deployment text alternatives distinguish plain paths, arrows and dependencies using display names', () => {
  const source='node "Web Server" as web\nnode "Database server" as DB\nartifact "app.war" as App\nweb -- DB : TCP\nweb --> DB dashed : HTTP\nApp ..> web : <<deploy>>';
  const text=JSON.stringify(descriptions.describeVerbose('deployment',source).sections);
  assert.match(text,/Web Server.*communication path.*Database server.*TCP/);
  assert.match(text,/Web Server.*directed communication path.*Database server.*HTTP/);
  assert.match(text,/app\.war.*depend.*Web Server.*deploy/);
  assert.doesNotMatch(text,/\bundefined\b/);
});

test('deployment descriptions preserve inline child display names and ignore position metadata', () => {
  const source='node "The \\"server\\"" as N { artifact "config.xml" as C; component Runtime }\n@layout schema=1\nnode N x=20 y=40\n@endlayout';
  const summary=descriptions.describe('deployment',source);
  assert.match(summary,/1 node/);
  assert.match(summary,/The "server"/);
  assert.match(summary,/1 artifact.*config\.xml/);
  assert.match(summary,/1 component.*Runtime/);
  assert.doesNotMatch(summary,/x=20|y=40|schema/);
});
