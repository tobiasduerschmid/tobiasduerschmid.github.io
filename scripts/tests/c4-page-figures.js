'use strict';

// The C4 figures the site's learner pages draw, read from their sources: ```c4 fences and c4-view.html includes in
// SEBook pages, C4 figures in quiz questions (`data-uml-type="c4"` with the model in `data-uml-spec`), ```c4
// fences in tutorial steps, and the `language-c4` blocks of the ArchUML reference (/SEBook/tools/uml-reference). c4-content.test.js checks that each one draws; c4-route-pages.test.js gates the drawing.

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const REPO_ROOT = path.join(__dirname, '../..');
const MODELS_DIR = path.join(REPO_ROOT, '_includes/c4-models');
const SEBOOK_DIR = path.join(REPO_ROOT, 'SEBook');
const QUIZZES_DIR = path.join(REPO_ROOT, '_data/quizzes');
const TUTORIALS_DIR = path.join(REPO_ROOT, '_data/tutorials');
// The ArchUML reference, which /SEBook/tools/uml-reference renders (its _includes/REFERENCE.md is a link to it).
const REFERENCE = path.join(REPO_ROOT, 'js/ArchUML/REFERENCE.md');

const relative = (file) => path.relative(REPO_ROOT, file);

function filesUnder(dir, extensions) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(full, extensions);
    return extensions.includes(path.extname(entry.name)) ? [full] : [];
  });
}

/**
 * The bodies of ```c4 (or ~~~c4) fences in Markdown text, with their 1-based opening line. A fence nested in a longer
 * fence is displayed source, not a figure, so only top-level fences count.
 */
function c4Fences(text) {
  const fences = [];
  let open = null;
  text.split('\n').forEach((line, index) => {
    if (open) {
      const close = line.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
      if (close && close[1][0] === open.marker[0] && close[1].length >= open.marker.length) {
        if (open.c4) fences.push({ line: open.line, body: open.body.join('\n') });
        open = null;
      } else {
        open.body.push(line);
      }
      return;
    }
    const start = line.match(/^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)/);
    if (start) open = { marker: start[1], c4: start[2] === 'c4', line: index + 1, body: [] };
  });
  return fences;
}

const INCLUDE_PATTERN = /\{%-?\s*include\s+c4-view\.html\b([\s\S]*?)-?%\}/g;
const PARAMETER_PATTERN = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;

/**
 * Every `{% include c4-view.html … %}` in `text` with its literal `model`, `view`, and `panels` (null when not a
 * literal; `panels` is undefined when the include has none).
 */
function c4ViewIncludes(text) {
  return [...text.matchAll(INCLUDE_PATTERN)].map((match) => {
    const parameters = {};
    for (const parameter of match[1].matchAll(PARAMETER_PATTERN)) {
      const literal = parameter[2] !== undefined ? parameter[2] : parameter[3];
      parameters[parameter[1]] = literal === undefined ? null : literal;
    }
    return { line: text.slice(0, match.index).split('\n').length, model: parameters.model, view: parameters.view, panels: parameters.panels };
  });
}

const ENTITIES = { '&#10;': '\n', '&#39;': "'", '&quot;': '"', '&lt;': '<', '&gt;': '>', '&amp;': '&' };
const unescapeHtml = (text) => text.replace(/&#10;|&#39;|&quot;|&lt;|&gt;|&amp;/g, (entity) => ENTITIES[entity]);

/** The models of the C4 figures in a piece of quiz Markdown: each `data-uml-spec` of a `data-uml-type="c4"` element. */
function quizFigureSpecs(markdown) {
  return [...markdown.matchAll(/data-uml-type="c4"\s+data-uml-spec='([^']*)'/g)].map((match) => unescapeHtml(match[1]));
}

/** The models of `<pre><code class="language-c4">` blocks in HTML or Markdown text. */
function preCodeFigures(text) {
  return [...text.matchAll(/<pre><code class="language-c4">\n?([\s\S]*?)<\/code><\/pre>/g)].map((match) => unescapeHtml(match[1]));
}

/** Every string inside a parsed YAML value, depth first. */
function stringsIn(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value && typeof value === 'object') return Object.values(value).flatMap(stringsIn);
  return [];
}

/**
 * Every C4 figure a learner page draws, as `{where, text, selector, drawing}`: `text` is what the figure renders (an
 * include's shared model with its view line), `selector` the view it names (`selectorOf(text)`), and `drawing`, for
 * an include, the shared model and view it shows (`<model>: <view>`), the same on every page.
 */
function learnerFigures(selectorOf) {
  const pages = filesUnder(SEBOOK_DIR, ['.md', '.html']);
  const fences = pages.flatMap((file) => c4Fences(fs.readFileSync(file, 'utf8'))
    .map((fence) => ({ where: `${relative(file)}:${fence.line}`, text: fence.body })));
  const includes = pages.flatMap((file) => c4ViewIncludes(fs.readFileSync(file, 'utf8'))
    .filter((include) => include.model && include.view)
    .map((include) => ({
      where: `${relative(file)}:${include.line}`,
      drawing: `${include.model}: ${include.view}`,
      text: `view: ${include.view}\n${fs.readFileSync(path.join(MODELS_DIR, `${include.model}.yml`), 'utf8')}`,
    })));
  const quizzes = filesUnder(QUIZZES_DIR, ['.yml']).flatMap((file) => quizFigureSpecs(fs.readFileSync(file, 'utf8'))
    .map((spec, index) => ({ where: `${relative(file)} figure ${index + 1}`, text: spec })));
  const tutorials = filesUnder(TUTORIALS_DIR, ['.yml']).flatMap((file) => stringsIn(yaml.load(fs.readFileSync(file, 'utf8')))
    .flatMap((value) => c4Fences(value)).map((fence, index) => ({ where: `${relative(file)} fence ${index + 1}`, text: fence.body })));
  const reference = preCodeFigures(fs.readFileSync(REFERENCE, 'utf8'))
    .map((text, index) => ({ where: `${relative(REFERENCE)} figure ${index + 1}`, text }));
  return fences.concat(includes, quizzes, tutorials, reference).map((figure) => Object.assign(figure, { selector: selectorOf(figure.text) }));
}

module.exports = { REPO_ROOT, MODELS_DIR, SEBOOK_DIR, relative, filesUnder, c4Fences, c4ViewIncludes, quizFigureSpecs, learnerFigures };
