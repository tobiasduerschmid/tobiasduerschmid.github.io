'use strict';
/**
 * The one reader of the UML editor's inline script for every source-structure test
 * (plan 2026-11-12-c4-uml-view-editing, Tasks 3, 10, 11, 17-20; spec §3.5, §3.10).
 *
 * The include's script is not JavaScript as it stands: it holds a Liquid output tag
 * (`{{ '/uml-python-workspace.html' | relative_url | jsonify }}`). `includeScript` takes the
 * `<script>` that holds `function init()`, from the include or from a built page, and replaces
 * each output tag by a string literal of its path. `parse` reads the result with @babel/parser.
 *
 * A write site is keyed by its chain, not by its line or offset, so converting one function never
 * shifts another's key, and two listeners that share a target and an event stay apart:
 * - `functionNameOf(path)`: a declaration's name; the variable, the assigned property, or the object
 *   property a function expression is bound to; `<target>:<event>` for a listener; else null.
 * - `functionChainOf(path)`: the names of the named functions around `path`, from the outermost one
 *   inside `init` to the nearest, joined with `>`; anonymous callbacks are left out. A path in init's
 *   own body (or in an anonymous callback there) has the chain `init`.
 * - An entry `{ key, chain, site, ordinal, line, start, end }`: `ordinal` counts the matches of one
 *   query with the same chain in source order, from 1; `key` is `<chain>#<ordinal>`; `site` is the
 *   nearest function of the chain that is not a listener (the outermost listener when the chain holds
 *   only listeners), the name spec §3.5 uses. `line` is a line of the parsed file when `parse` was
 *   given its `startLine`; `start` and `end` are offsets in `code`, the script's own text.
 */

const fs = require('node:fs');
const path = require('node:path');
const babelParser = require('@babel/parser');

const INCLUDE_PATH = path.join(__dirname, '..', '..', '..', '_includes', 'uml-editor.html');
const SCRIPT_BLOCK = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
const LIQUID_OUTPUT_TAG = /\{\{[\s\S]*?\}\}/g;
const QUOTED_PATH = /^\{\{\s*(['"])(.*?)\1/;
const NON_TREE_KEYS = new Set(['loc', 'start', 'end', 'extra', 'range', 'comments', 'tokens',
  'leadingComments', 'trailingComments', 'innerComments']);
const FUNCTION_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression',
  'ObjectMethod', 'ClassMethod']);
const LISTENER_ADDER = /^add(\w*)Listener$/;
const ON_EVENT_PROPERTY = /^on([a-z]+)$/;
const SCOPE_FUNCTION = 'init';
const LISTENER_SEPARATOR = ':';
const CHAIN_SEPARATOR = '>';

// ---------- the script ----------

function lineOfOffset(text, offset) {
  return text.slice(0, offset).split('\n').length;
}

function literalOfTag(tag) {
  const match = QUOTED_PATH.exec(tag);
  if (!match) throw new Error(`includeScript: the Liquid output tag ${tag} names no quoted path`);
  return JSON.stringify(match[2]);
}

/**
 * The inline script that holds `function init()`, from an include or a built page.
 * Returns `{ code, liquid: [{ tag, literal }], line }`: `code` is the script's text with each Liquid
 * output tag replaced by a string literal of its path (lines and line breaks are kept), and `line` is
 * the line of the source on which `code` starts (pass it to `parse` as `startLine`).
 */
function includeScript(source) {
  const blocks = [...source.matchAll(SCRIPT_BLOCK)].filter((block) => block[2].includes('function init()'));
  if (blocks.length !== 1) {
    throw new Error(`includeScript: expected one <script> holding function init(), found ${blocks.length}`);
  }
  const block = blocks[0];
  const scriptStart = block.index + block[0].indexOf('>') + 1;
  const liquid = [];
  const code = block[2].replace(LIQUID_OUTPUT_TAG, (tag) => {
    const literal = literalOfTag(tag);
    liquid.push({ tag, literal });
    return literal;
  });
  return { code, liquid, line: lineOfOffset(source, scriptStart) };
}

/** The script's syntax tree (@babel/parser, script mode); `startLine` numbers its first line. */
function parse(code, { startLine = 1 } = {}) {
  return babelParser.parse(code, { sourceType: 'script', startLine });
}

/** The include's own script, read from disk: `{ code, liquid, line, ast }`, lines numbered as in the include. */
function loadIncludeScript(file = INCLUDE_PATH) {
  const script = includeScript(fs.readFileSync(file, 'utf8'));
  return { ...script, ast: parse(script.code, { startLine: script.line }) };
}

// ---------- walking ----------

/**
 * Visits every node in source order with a path `{ node, parent, key, index }`, where `parent` is the
 * parent's path (null at the root), `key` the parent's property holding the node, and `index` its
 * position when that property is a list.
 */
function walk(ast, visit) {
  function visitNode(node, parent, key, index) {
    const nodePath = { node, parent, key, index };
    visit(nodePath);
    for (const childKey of Object.keys(node)) {
      if (NON_TREE_KEYS.has(childKey)) continue;
      const child = node[childKey];
      if (Array.isArray(child)) {
        child.forEach((item, itemIndex) => {
          if (item && typeof item.type === 'string') visitNode(item, nodePath, childKey, itemIndex);
        });
      } else if (child && typeof child.type === 'string') {
        visitNode(child, nodePath, childKey, null);
      }
    }
  }
  visitNode(ast, null, null, null);
}

function isFunction(node) {
  return FUNCTION_TYPES.has(node.type);
}

/** A short source-like name of an expression: `typeSelect`, `this.panel`, `document.body`, `items[0]`. */
function expressionName(node) {
  switch (node.type) {
    case 'Identifier': return node.name;
    case 'ThisExpression': return 'this';
    case 'StringLiteral': return JSON.stringify(node.value);
    case 'NumericLiteral': return String(node.value);
    case 'MemberExpression':
    case 'OptionalMemberExpression':
      return node.computed
        ? `${expressionName(node.object)}[${expressionName(node.property)}]`
        : `${expressionName(node.object)}.${node.property.name}`;
    case 'CallExpression':
    case 'OptionalCallExpression':
      return `${expressionName(node.callee)}(…)`;
    default: return `(${node.type})`;
  }
}

function propertyKeyName(keyNode, computed) {
  if (!computed && keyNode.type === 'Identifier') return keyNode.name;
  if (keyNode.type === 'StringLiteral' || keyNode.type === 'NumericLiteral') return String(keyNode.value);
  return null;
}

function calleeName(callee) {
  if (callee.type === 'Identifier') return callee.name;
  if (callee.type === 'MemberExpression' && !callee.computed) return callee.property.name;
  return null;
}

function eventName(node) {
  return node && node.type === 'StringLiteral' ? node.value : node ? expressionName(node) : '?';
}

/** `<target>:<event>` when the function at `functionPath` is passed to an `add…Listener` call; else null. */
function listenerName(functionPath) {
  const call = functionPath.parent && functionPath.parent.node;
  if (!call || call.type !== 'CallExpression' || functionPath.key !== 'arguments') return null;
  const adder = LISTENER_ADDER.exec(calleeName(call.callee) || '');
  if (!adder) return null;
  let target;
  if (call.callee.type === 'MemberExpression') target = expressionName(call.callee.object);
  else target = adder[1] ? adder[1][0].toLowerCase() + adder[1].slice(1) : 'window';
  return `${target}${LISTENER_SEPARATOR}${eventName(call.arguments[0])}`;
}

/** The name of the function at `functionPath` (see the header), or null for an anonymous callback. */
function functionNameOf(functionPath) {
  const { node, parent, key } = functionPath;
  if (node.type === 'FunctionDeclaration') return node.id ? node.id.name : null;
  if (node.type === 'ObjectMethod' || node.type === 'ClassMethod') return propertyKeyName(node.key, node.computed);
  const owner = parent && parent.node;
  if (owner && owner.type === 'VariableDeclarator' && key === 'init' && owner.id.type === 'Identifier') {
    return owner.id.name;
  }
  if (owner && owner.type === 'ObjectProperty' && key === 'value') return propertyKeyName(owner.key, owner.computed);
  if (owner && owner.type === 'AssignmentExpression' && key === 'right') {
    const left = owner.left;
    if (left.type === 'Identifier') return left.name;
    if (left.type === 'MemberExpression' && !left.computed) {
      const onEvent = ON_EVENT_PROPERTY.exec(left.property.name);
      return onEvent ? `${expressionName(left.object)}${LISTENER_SEPARATOR}${onEvent[1]}` : left.property.name;
    }
  }
  const listener = listenerName(functionPath);
  if (listener) return listener;
  return node.id ? node.id.name : null;
}

function enclosingFunctionNames(nodePath) {
  const names = [];
  for (let current = nodePath.parent; current; current = current.parent) {
    if (!isFunction(current.node)) continue;
    const name = functionNameOf(current);
    if (name === SCOPE_FUNCTION && current.node.type === 'FunctionDeclaration') return { names: names.reverse(), inScope: true };
    if (name) names.push(name);
  }
  return { names: names.reverse(), inScope: false };
}

/** The chain of named functions around `nodePath` (see the header). */
function functionChainOf(nodePath) {
  const { names, inScope } = enclosingFunctionNames(nodePath);
  if (names.length) return names.join(CHAIN_SEPARATOR);
  return inScope ? SCOPE_FUNCTION : '';
}

function isListenerName(name) {
  return name.includes(LISTENER_SEPARATOR);
}

/** The write site of a chain: its nearest non-listener function, or its outermost listener. */
function siteOfChain(chain) {
  const names = chain.split(CHAIN_SEPARATOR);
  for (let index = names.length - 1; index >= 0; index -= 1) {
    if (!isListenerName(names[index])) return names[index];
  }
  return names[0];
}

function isInsideFunctionNamed(nodePath, name) {
  for (let current = nodePath.parent; current; current = current.parent) {
    if (isFunction(current.node) && functionNameOf(current) === name) return true;
  }
  return false;
}

/** Entries for the matched paths, in source order, numbered per chain. */
function keyedEntries(matches) {
  const ordinals = new Map();
  return matches
    .sort((a, b) => a.path.node.start - b.path.node.start)
    .map(({ path: nodePath, details }) => {
      const chain = functionChainOf(nodePath);
      const ordinal = (ordinals.get(chain) || 0) + 1;
      ordinals.set(chain, ordinal);
      return {
        key: `${chain}#${ordinal}`,
        chain,
        site: siteOfChain(chain),
        ordinal,
        line: nodePath.node.loc.start.line,
        start: nodePath.node.start,
        end: nodePath.node.end,
        ...details,
      };
    });
}

// ---------- queries ----------

function matchesDottedPath(node, parts) {
  if (parts.length === 1) return node.type === 'Identifier' && node.name === parts[0];
  return node.type === 'MemberExpression' && !node.computed
    && node.property.name === parts[parts.length - 1]
    && matchesDottedPath(node.object, parts.slice(0, -1));
}

/** Every assignment to a dotted path such as `textarea.value`, as keyed entries. */
function assignmentsTo(ast, dottedPath) {
  const parts = dottedPath.split('.');
  const matches = [];
  walk(ast, (nodePath) => {
    if (nodePath.node.type === 'AssignmentExpression' && matchesDottedPath(nodePath.node.left, parts)) {
      matches.push({ path: nodePath, details: {} });
    }
  });
  return keyedEntries(matches);
}

/** The value of a literal expression (a string, a number, a template without expressions), else undefined. */
function literalValue(node) {
  if (node.type === 'StringLiteral' || node.type === 'NumericLiteral') return node.value;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0].value.cooked;
  return undefined;
}

function styleAssignmentDetails(node) {
  if (node.type === 'AssignmentExpression' && node.operator === '=' && node.left.type === 'MemberExpression') {
    const styleObject = node.left.object;
    const isStyle = styleObject.type === 'MemberExpression' && !styleObject.computed
      && styleObject.property.name === 'style';
    const property = propertyKeyName(node.left.property, node.left.computed);
    const value = literalValue(node.right);
    if (isStyle && property && value !== undefined) {
      return { property, value, target: expressionName(styleObject.object) };
    }
  }
  if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && !node.callee.computed
    && node.callee.property.name === 'setAttribute' && node.arguments.length === 2
    && node.arguments[0].type === 'StringLiteral' && node.arguments[0].value === 'style') {
    const value = literalValue(node.arguments[1]);
    if (value !== undefined) return { property: 'style', value, target: expressionName(node.callee.object) };
  }
  return null;
}

/**
 * Every literal style assignment (`<el>.style.<property> = <literal>`, a literal `cssText`, a literal
 * `setAttribute('style', …)`), as keyed entries with `property`, `value`, and `target` (the styled
 * element's expression). Computed values are left out. `within` names a function to search inside.
 */
function literalStyleAssignments(ast, { within } = {}) {
  const matches = [];
  walk(ast, (nodePath) => {
    const details = styleAssignmentDetails(nodePath.node);
    if (details && (!within || isInsideFunctionNamed(nodePath, within))) matches.push({ path: nodePath, details });
  });
  return keyedEntries(matches);
}

module.exports = {
  INCLUDE_PATH,
  includeScript,
  parse,
  loadIncludeScript,
  walk,
  functionNameOf,
  functionChainOf,
  siteOfChain,
  assignmentsTo,
  literalStyleAssignments,
};
