'use strict';

// How the site loads the diagram editor (UML-view editing spec §2.2; plan Task 21): the module's script
// list is js/ArchUML/diagram-editor/manifest.json, which reaches Liquid through the data symlink
// _data/archuml_diagram_editor_manifest.json, and _includes/diagram-editor-scripts.html emits a script
// tag per file of the groups a page asks for. The UML editor's inline script needs the module while it
// runs, so the UML editor include loads the core and text groups, not deferred, before that script.
// Since plan Task 24 the loader also links the module's stylesheet, js/ArchUML/css/diagram-editor.css,
// before its scripts. That stylesheet reads every colour, width, and dash through a --uml-edit-* custom
// property with a fallback and declares none, so a host maps them (the UML editor in
// css/tutorial-uml-editor.css, under #uml-playground-wrap) wherever the stylesheet sits in the cascade,
// and a second link to it on one page changes no computed style.

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const ROOT = path.join(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const MANIFEST = JSON.parse(read('js/ArchUML/diagram-editor/manifest.json'));
const LOADER = '_includes/diagram-editor-scripts.html';
const UML_EDITOR = '_includes/uml-editor.html';
const MODULE_STYLESHEET = 'js/ArchUML/css/diagram-editor.css';
const HOST_STYLESHEET = 'css/tutorial-uml-editor.css';
const EDIT_PROPERTY = /--uml-edit-[a-z0-9-]+/;

/**
 * The loader rendered by Liquid with the include parameters `params` (strings, as a Liquid include tag
 * passes them) and the real manifest as `site.data`; `relative_url` prefixes a base URL, as Jekyll's does.
 * Returns the script tags it emits as `{ src, defer }`.
 */
function renderLoader(params) {
  return [...renderLoaderHtml(params).matchAll(/<script\b([^>]*)><\/script>/g)].map(([, attributes]) => ({
    src: (attributes.match(/\bsrc="([^"]*)"/) || [])[1],
    defer: /\sdefer\b/.test(attributes),
  }));
}

/** The HTML the loader renders with the include parameters `params` (see renderLoader). */
function renderLoaderHtml(params) {
  const ruby = `
    require 'json'
    require 'liquid'
    module RelativeUrl
      def relative_url(input)
        "/base" + input.to_s
      end
    end
    Liquid::Template.register_filter(RelativeUrl)
    input = JSON.parse(STDIN.read)
    print Liquid::Template.parse(input['template']).render(
      'include' => input['params'],
      'site' => { 'data' => { 'archuml_diagram_editor_manifest' => input['manifest'] } }
    )
  `;
  return execFileSync('bundle', ['exec', 'ruby', '-e', ruby], {
    cwd: ROOT,
    input: JSON.stringify({ template: read(LOADER), params, manifest: MANIFEST }),
    encoding: 'utf8',
  });
}

const scriptsOf = (groups, defer) => groups.flatMap((group) => MANIFEST[group]).map((file) => ({ src: `/base/js/ArchUML/${file}`, defer }));

/** The parameters of the one `{% include diagram-editor-scripts.html … %}` tag in `source`, and its offset. */
function loaderTagIn(source) {
  const tags = [...source.matchAll(/\{%-?\s*include\s+diagram-editor-scripts\.html\b([^%]*)-?%\}/g)];
  assert.equal(tags.length, 1, `one include of the loader, found ${tags.length}`);
  const params = Object.fromEntries([...tags[0][1].matchAll(/(\w+)\s*=\s*"([^"]*)"/g)].map(([, name, value]) => [name, value]));
  return { params, offset: tags[0].index };
}

test('the data symlink resolves to the module manifest', () => {
  const link = path.join(ROOT, '_data/archuml_diagram_editor_manifest.json');
  assert.ok(fs.lstatSync(link).isSymbolicLink());
  assert.equal(fs.readlinkSync(link), '../js/ArchUML/diagram-editor/manifest.json');
  assert.equal(fs.realpathSync(link), fs.realpathSync(path.join(ROOT, 'js/ArchUML/diagram-editor/manifest.json')));
});

test('the loader emits the requested groups in manifest order, deferred only when asked', () => {
  assert.deepEqual(renderLoader({}), scriptsOf(['core', 'text'], false), 'by default: core, then text, not deferred');
  assert.deepEqual(renderLoader({ groups: 'core' }), scriptsOf(['core'], false));
  assert.deepEqual(renderLoader({ groups: 'core', defer: 'true' }), scriptsOf(['core'], true));
  assert.deepEqual(renderLoader({ groups: 'core, text', defer: 'false' }), scriptsOf(['core', 'text'], false));
});

test('the UML editor include loads the core and text groups, not deferred, before its inline script', () => {
  const source = read(UML_EDITOR);
  const { params, offset } = loaderTagIn(source);
  const inlineScript = source.search(/<script>\s*\(function \(\) \{/);

  assert.ok(inlineScript > 0, 'the include has its inline script');
  assert.ok(offset < inlineScript, 'the loader comes before the inline script');
  assert.deepEqual(renderLoader(params), scriptsOf(['core', 'text'], false));
});

// The C4 editor edits its UML-notation views through the diagram editor's core group (UML-view editing spec §2.2,
// §7.2; plan Task 41). Its scripts are deferred, so the core comes before them, deferred too: deferred scripts run in
// document order, so the editor parts find ArchUMLDiagramEditorParts when they run.
const C4_EDITOR_HOSTS = [
  { file: '_includes/c4-editor-scripts.html', editorLoop: /\{%-?\s*for\s+file\s+in\s+site\.data\.archuml_c4_manifest\.editor\s*%\}/ },
  { file: '_layouts/tutorial.html', editorLoop: /\{%-?\s*for\s+file\s+in\s+site\.data\.archuml_c4_manifest\.editor\s*%\}/ },
];

for (const { file, editorLoop } of C4_EDITOR_HOSTS) {
  test(`${file} loads the diagram-editor core group, deferred, before the C4 editor scripts`, () => {
    const source = read(file);
    const { params, offset } = loaderTagIn(source);
    const editorScripts = source.search(editorLoop);

    assert.ok(editorScripts > 0, `${file} emits the C4 editor scripts from the manifest`);
    assert.ok(offset < editorScripts, 'the loader comes before the C4 editor scripts');
    assert.deepEqual(renderLoader(params), scriptsOf(['core'], true), 'the core group only, every script deferred');
  });
}

test('the c4 tutorial layout loads the diagram-editor core only for backend c4', () => {
  const source = read('_layouts/tutorial.html');
  const { offset } = loaderTagIn(source);
  const before = source.slice(0, offset);
  const opened = before.lastIndexOf("{% if tutorial_backend == 'c4' %}");
  const closed = before.lastIndexOf('{% endif %}');

  assert.ok(opened > closed, "the loader sits inside an {% if tutorial_backend == 'c4' %} block");
});

/** The declarations of a stylesheet's text: `{ property, value }`, comments removed. */
function declarationsOf(css) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...withoutComments.matchAll(/([-\w]+)\s*:\s*([^;{}]+)(?=;|\})/g)].map(([, property, value]) => ({ property, value: value.trim() }));
}

/** The --uml-edit-* properties read by `var()` in `value`, each with whether the read gives a fallback. */
function editPropertyReads(value) {
  return [...value.matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)].map(([, property, comma]) => ({ property, fallback: !!comma }));
}

for (const [params, what] of [[{}, 'by default'], [{ groups: 'core', defer: 'true' }, 'for deferred core scripts']]) {
  test(`the loader links the module stylesheet before its scripts (${what}), and ${HOST_STYLESHEET} imports nothing`, () => {
    const html = renderLoaderHtml(params);
    const links = [...html.matchAll(/<link\b([^>]*)>/g)].map((match) => ({
      rel: (match[1].match(/\brel="([^"]*)"/) || [])[1],
      href: (match[1].match(/\bhref="([^"]*)"/) || [])[1],
      offset: match.index,
    }));

    assert.deepEqual(links.map(({ rel, href }) => ({ rel, href })), [{ rel: 'stylesheet', href: `/base/${MODULE_STYLESHEET}` }],
      'one stylesheet link, to the module stylesheet');
    assert.ok(links[0].offset < html.search(/<script\b/), 'the stylesheet link comes before the first script');
    assert.ok(fs.existsSync(path.join(ROOT, MODULE_STYLESHEET)), `${MODULE_STYLESHEET} exists`);
    assert.doesNotMatch(read(HOST_STYLESHEET).replace(/\/\*[\s\S]*?\*\//g, ''), /@import\b/,
      `${HOST_STYLESHEET} imports nothing (_includes/head.html loads it on every page)`);
  });
}

test('diagram-editor.css declares no --uml-edit-* property and reads each one with a fallback', () => {
  const declarations = declarationsOf(read(MODULE_STYLESHEET));
  const reads = declarations.flatMap(({ value }) => editPropertyReads(value));

  assert.ok(reads.length > 0, 'the module stylesheet reads --uml-edit-* properties');
  assert.deepEqual(declarations.filter(({ property }) => property.startsWith('--')).map(({ property }) => property), [],
    'custom properties the module stylesheet declares');
  assert.deepEqual(reads.filter(({ property }) => !EDIT_PROPERTY.test(property)).map(({ property }) => property), [],
    'custom properties it reads outside the --uml-edit-* family');
  assert.deepEqual(reads.filter(({ fallback }) => !fallback).map(({ property }) => property), [],
    '--uml-edit-* reads without a fallback');
});

test(`${HOST_STYLESHEET} maps only --uml-edit-* properties the module stylesheet reads, under #uml-playground-wrap`, () => {
  const readByModule = new Set(declarationsOf(read(MODULE_STYLESHEET)).flatMap(({ value }) => editPropertyReads(value)).map(({ property }) => property));
  const hostCss = read(HOST_STYLESHEET).replace(/\/\*[\s\S]*?\*\//g, '');
  const mappings = [...hostCss.matchAll(/([^{}]*)\{([^{}]*)\}/g)].flatMap(([, selector, body]) => declarationsOf(`{${body}}`)
    .filter(({ property }) => property.startsWith('--uml-edit-'))
    .map(({ property }) => ({ property, selector: selector.trim() })));

  assert.ok(mappings.length > 0, `${HOST_STYLESHEET} maps the module's properties`);
  assert.deepEqual(mappings.filter(({ property }) => !readByModule.has(property)).map(({ property }) => property), [],
    'mapped properties the module stylesheet never reads');
  assert.deepEqual(mappings.filter(({ selector }) => !selector.split(',').every((part) => /#uml-playground-wrap\s*$/.test(part.trim())))
    .map(({ property, selector }) => `${property} under ${selector}`), [], 'mappings on another element than #uml-playground-wrap');
});
